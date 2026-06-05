import { describe, it, expect } from 'vitest';
import type { AchievementDefinition, AchievementState, TrackedEvent, SetDefinition } from '../../src/engine/types.js';
import { buildCardResponse, type CardData } from '../../src/dashboard/api.js';

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

function makeState(unlocked: string[] = []): AchievementState {
  const u: Record<string, string> = {};
  for (const id of unlocked) u[id] = new Date().toISOString();
  return {
    unlocked: u,
    stats: { total_unlocked: unlocked.length },
  };
}

describe('buildCardResponse', () => {
  it('returns complete CardData with all fields present', () => {
    const defs = [makeDef({ id: 'a' }), makeDef({ id: 'b' })];
    const state = makeState(['a']);
    const events = [makeEvent()];
    const setDefs: SetDefinition[] = [];
    const config = { lang: 'en' };

    const result = buildCardResponse(defs, state, events, setDefs, config, 'default', '🎮', {});

    expect(result.profile).toBe('default');
    expect(result.profile_emoji).toBe('🎮');
    expect(typeof result.level).toBe('number');
    expect(typeof result.total_xp).toBe('number');
    expect(typeof result.unlocked).toBe('number');
    expect(typeof result.total).toBe('number');
    expect(result.stats).toBeDefined();
    expect(result.rarity_breakdown).toBeDefined();
    expect(result.rarity_breakdown).toHaveLength(6);
    expect(result.achievements).toBeDefined();
    expect(result.heatmap).toBeDefined();
    expect(result.milestones).toBeDefined();
  });

  it('includes unlocked achievements sorted by rarity', () => {
    const defs = [
      makeDef({ id: 'a', rarity: 'common' }),
      makeDef({ id: 'b', rarity: 'epic' }),
      makeDef({ id: 'c', rarity: 'rare' }),
    ];
    const state = makeState(['a', 'b', 'c']);
    const result = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});

    expect(result.achievements.length).toBeGreaterThanOrEqual(3);
    // epic > rare > common
    expect(result.achievements[0]!.id).toBe('b');
    expect(result.achievements[1]!.id).toBe('c');
    expect(result.achievements[2]!.id).toBe('a');
  });

  it('caps achievements at 6', () => {
    const defs = Array.from({ length: 10 }, (_, i) => makeDef({ id: 'a' + i }));
    const state = makeState(defs.map(d => d.id));

    const result = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});
    expect(result.achievements.length).toBeLessThanOrEqual(6);
  });

  it('uses Chinese names when lang is zh', () => {
    const defs = [
      makeDef({
        id: 'a',
        name: 'English Name',
        name_cn: '中文名',
        description: 'Desc',
        description_cn: '描述',
        rarity: 'common',
      }),
    ];
    const state = makeState(['a']);

    const resultZh = buildCardResponse(defs, state, [], [], { lang: 'zh' }, 'default', '🎮', {});
    expect(resultZh.achievements[0]!.name).toBe('中文名');

    const resultEn = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});
    expect(resultEn.achievements[0]!.name).toBe('English Name');
  });

  it('returns empty milestones and achievements when nothing unlocked', () => {
    const defs = [makeDef()];
    const state = makeState([]);

    const result = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});
    expect(result.milestones).toEqual([]);
    expect(result.achievements).toEqual([]);
    expect(result.unlocked).toBe(0);
  });

  it('fills in-progress achievements when fewer than 4 unlocked', () => {
    const defs = [
      makeDef({ id: 'unlocked', rarity: 'common' }),
      makeDef({ id: 'progress', rarity: 'rare', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];
    const state = makeState(['unlocked']);
    const events = Array.from({ length: 7 }, () => makeEvent()); // 7/10 = 70%

    const result = buildCardResponse(defs, state, events, [], { lang: 'en' }, 'default', '🎮', {});
    expect(result.achievements.length).toBeGreaterThanOrEqual(2);
    const inProg = result.achievements.find(a => a.in_progress);
    expect(inProg).toBeDefined();
    expect(inProg!.progress_pct).toBeGreaterThanOrEqual(60); // ~70%
  });
});
