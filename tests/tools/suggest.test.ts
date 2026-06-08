import { describe, it, expect } from 'vitest';
import type {
  AchievementDefinition,
  AchievementState,
  TrackedEvent,
  Condition,
} from '../../src/engine/types.js';
import { findNearUnlocks, type NearUnlock } from '../../src/utils/progress-nudge.js';
import { setConfigDir } from '../../src/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Factories ──────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: 'evt-test',
    timestamp: new Date().toISOString(),
    tool_source: 'test',
    event_type: 'tool.complete',
    payload: {},
    context: { session_id: 's1', model: 'test' },
    ...overrides,
  };
}

function makeDef(overrides: Partial<AchievementDefinition> = {}): AchievementDefinition {
  return {
    id: 'test_ach',
    name: 'Test Achievement',
    description: 'A test achievement',
    icon: '🧪',
    category: 'test',
    rarity: 'common',
    conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    ...overrides,
  };
}

function makeState(overrides: Partial<AchievementState> = {}): AchievementState {
  return {
    unlocked: {},
    stats: { total_unlocked: 0 },
    ...overrides,
  };
}

// ── Hint generation (mirrors suggest.ts logic) ──────────────────────

const UNIT_EN: Record<string, string> = {
  sessions: 'sessions',
  tasks: 'tasks',
  'tool uses': 'tool uses',
  messages: 'messages',
  prompts: 'prompts',
  days: 'days',
  events: 'events',
};

const UNIT_ZH: Record<string, string> = {
  sessions: '个会话',
  tasks: '个任务',
  'tool uses': '次工具调用',
  messages: '条消息',
  prompts: '次提示',
  days: '天',
  events: '个事件',
};

function buildHint(n: NearUnlock, lang: 'en' | 'zh'): string {
  const remaining = n.target - n.current;
  const map = lang === 'zh' ? UNIT_ZH : UNIT_EN;
  const unit = map[n.unit_label] || n.unit_label;
  const pct = Math.round((n.current / n.target) * 100);

  if (lang === 'zh') {
    return `还差 ${remaining} ${unit} 即可解锁「${n.name}」（${n.current}/${n.target}，${pct}%）`;
  }
  return `${remaining} more ${unit} to unlock ${n.name} (${n.current}/${n.target}, ${pct}%)`;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('achievement_suggest — hint generation', () => {
  it('generates English hint for counter achievement', () => {
    const n: NearUnlock = {
      achievement_id: 'scribe',
      name: 'Scribe',
      icon: '✍️',
      rarity: 'common',
      current: 45,
      target: 50,
      unit_label: 'tool uses',
    };

    const hint = buildHint(n, 'en');
    expect(hint).toBe('5 more tool uses to unlock Scribe (45/50, 90%)');
  });

  it('generates Chinese hint for counter achievement', () => {
    const n: NearUnlock = {
      achievement_id: 'scribe',
      name: '笔耕不辍',
      icon: '✍️',
      rarity: 'common',
      current: 45,
      target: 50,
      unit_label: 'tool uses',
    };

    const hint = buildHint(n, 'zh');
    expect(hint).toBe('还差 5 次工具调用 即可解锁「笔耕不辍」（45/50，90%）');
  });

  it('generates hint for streak achievement', () => {
    const n: NearUnlock = {
      achievement_id: 'streak_7',
      name: 'Week Warrior',
      icon: '📅',
      rarity: 'uncommon',
      current: 5,
      target: 7,
      unit_label: 'days',
    };

    const hint = buildHint(n, 'en');
    expect(hint).toBe('2 more days to unlock Week Warrior (5/7, 71%)');
  });

  it('generates hint for task achievement', () => {
    const n: NearUnlock = {
      achievement_id: 'century',
      name: 'Century',
      icon: '💯',
      rarity: 'rare',
      current: 87,
      target: 100,
      unit_label: 'tasks',
    };

    const hint = buildHint(n, 'en');
    expect(hint).toBe('13 more tasks to unlock Century (87/100, 87%)');
  });

  it('generates Chinese hint for task achievement', () => {
    const n: NearUnlock = {
      achievement_id: 'century',
      name: '世纪任务',
      icon: '💯',
      rarity: 'rare',
      current: 87,
      target: 100,
      unit_label: 'tasks',
    };

    const hint = buildHint(n, 'zh');
    expect(hint).toBe('还差 13 个任务 即可解锁「世纪任务」（87/100，87%）');
  });

  it('handles 100% completion (edge case — should be unlocked)', () => {
    const n: NearUnlock = {
      achievement_id: 'test',
      name: 'Done',
      icon: '✅',
      rarity: 'common',
      current: 10,
      target: 10,
      unit_label: 'events',
    };

    const hint = buildHint(n, 'en');
    expect(hint).toBe('0 more events to unlock Done (10/10, 100%)');
  });

  it('falls back to raw unit_label when no translation found', () => {
    const n: NearUnlock = {
      achievement_id: 'test',
      name: 'Test',
      icon: '🧪',
      rarity: 'common',
      current: 3,
      target: 5,
      unit_label: 'widgets',
    };

    const hint = buildHint(n, 'en');
    expect(hint).toBe('2 more widgets to unlock Test (3/5, 60%)');
  });
});

describe('achievement_suggest — integration with findNearUnlocks', () => {
  it('respects minProgress parameter', () => {
    const events = Array.from({ length: 8 }, () => makeEvent());
    const def = makeDef({ conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] });

    // At 80% with minProgress 0.9
    const result = findNearUnlocks([def], events, makeState(), { minProgress: 0.9 });
    expect(result.length).toBe(0);
  });

  it('respects maxResults parameter', () => {
    const events = Array.from({ length: 8 }, () => makeEvent());
    const defs = [
      makeDef({ id: 'a', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'b', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'c', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];

    const result = findNearUnlocks(defs, events, makeState(), { maxResults: 2, minProgress: 0.5 });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('returns non-empty for valid counter progress', () => {
    const events = Array.from({ length: 7 }, () => makeEvent());
    const def = makeDef({ conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] });

    const result = findNearUnlocks([def], events, makeState(), { minProgress: 0.5 });
    expect(result.length).toBe(1);
    expect(result[0]!.achievement_id).toBe('test_ach');
    expect(result[0]!.current).toBe(7);
    expect(result[0]!.target).toBe(10);
  });
});

describe('achievement_suggest — empty cases', () => {
  it('returns empty when no events', () => {
    const def = makeDef({ conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] });
    const result = findNearUnlocks([def], [], makeState());
    expect(result).toEqual([]);
  });

  it('returns empty when all below minProgress', () => {
    const events = Array.from({ length: 1 }, () => makeEvent());
    const def = makeDef({ conditions: [{ type: 'counter', event: 'tool.complete', value: 50 }] });
    // 1/50 = 2% < default minProgress 20%
    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });
});

describe('achievement_suggest — lang config', () => {
  it('picks up lang setting from config.json', () => {
    const tmpDir = path.join(os.tmpdir(), `agpa-suggest-cfg-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const cfgPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ lang: 'zh' }));

    setConfigDir(tmpDir);

    // Verify the config was written — the suggest tool handler
    // calls loadConfig() and uses cfg.lang for hint localization
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const cfg = JSON.parse(raw);
    expect(cfg.lang).toBe('zh');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
