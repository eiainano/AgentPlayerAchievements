import { describe, it, expect } from 'vitest';
import { recommendDiscovery, hashString, recommendSurprise, recommendNearWin, getRecommendResponse } from '../../src/utils/recommend.js';
import type {
  AchievementDefinition,
  AchievementState,
  TrackedEvent,
} from '../../src/engine/types.js';

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

describe('recommendDiscovery', () => {
  it('returns achievement whose event type has never been triggered', () => {
    const defs = [
      makeDef({
        id: 'agent_first',
        name: 'Agent First',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        rarity: 'common',
      }),
      makeDef({
        id: 'tool_first',
        name: 'Tool First',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 1 }],
        rarity: 'common',
      }),
    ];
    const events = [makeEvent({ event_type: 'tool.complete' })];

    const result = recommendDiscovery(defs, events, makeState());
    expect(result).not.toBeNull();
    expect(result!.achievement_id).toBe('agent_first');
    expect(result!.category).toBe('discovery');
    expect(result!.discovery_event).toBe('agent.spawn');
  });

  it('returns null when all event types have been triggered', () => {
    const defs = [
      makeDef({
        id: 'tool_first',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 1 }],
      }),
    ];
    const events = [makeEvent({ event_type: 'tool.complete' })];

    const result = recommendDiscovery(defs, events, makeState());
    expect(result).toBeNull();
  });

  it('filters out hidden achievements', () => {
    const defs = [
      makeDef({
        id: 'secret_thing',
        name: 'Secret',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        hidden: true,
      }),
    ];
    const result = recommendDiscovery(defs, [], makeState());
    expect(result).toBeNull();
  });

  it('filters out already-unlocked achievements', () => {
    const defs = [
      makeDef({
        id: 'already_got',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
      }),
    ];
    const state = makeState({ unlocked: { already_got: '2026-01-01T00:00:00Z' } });
    const result = recommendDiscovery(defs, [], state);
    expect(result).toBeNull();
  });

  it('prefers lower rarity (Common before Rare)', () => {
    const defs = [
      makeDef({
        id: 'rare_feature',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        rarity: 'rare',
      }),
      makeDef({
        id: 'common_feature',
        conditions: [{ type: 'counter', event: 'mcp.connect', value: 1 }],
        rarity: 'common',
      }),
    ];
    const result = recommendDiscovery(defs, [], makeState());
    expect(result).not.toBeNull();
    expect(result!.achievement_id).toBe('common_feature');
  });
});

describe('hashString', () => {
  it('returns same output for same input', () => {
    expect(hashString('session-abc')).toBe(hashString('session-abc'));
  });

  it('returns different output for different input', () => {
    expect(hashString('session-abc')).not.toBe(hashString('session-xyz'));
  });

  it('returns non-negative integer', () => {
    const h = hashString('test');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe('recommendSurprise', () => {
  it('returns a deterministic surprise for given sessionId', () => {
    const defs = [
      makeDef({
        id: 'hidden_one', name: 'Hidden One', hidden: true,
        hint: 'Try something at midnight', hint_cn: '午夜时分试一试', rarity: 'rare',
      }),
      makeDef({
        id: 'hidden_two', name: 'Hidden Two', hidden: true,
        hint: 'The early bird catches the worm', rarity: 'uncommon',
      }),
    ];
    const state = makeState();
    const result1 = recommendSurprise(defs, state, 'session-123');
    const result2 = recommendSurprise(defs, state, 'session-123');
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.achievement_id).toBe(result2!.achievement_id);
  });

  it('returns null when no hidden achievements available', () => {
    const defs = [makeDef({ id: 'not_hidden', hidden: false })];
    const result = recommendSurprise(defs, makeState(), 'session-123');
    expect(result).toBeNull();
  });

  it('returns null when all hidden are already unlocked', () => {
    const defs = [makeDef({ id: 'hidden_ach', hidden: true, hint: 'clue' })];
    const state = makeState({ unlocked: { hidden_ach: '2026-01-01T00:00:00Z' } });
    const result = recommendSurprise(defs, state, 'session-123');
    expect(result).toBeNull();
  });

  it('filters out hidden achievements without hint', () => {
    const defs = [makeDef({ id: 'no_hint', hidden: true })];
    const result = recommendSurprise(defs, makeState(), 'session-123');
    expect(result).toBeNull();
  });

  it('returns item with empty name, "?" icon, and non-null hint', () => {
    const defs = [makeDef({
      id: 'hidden_surprise', name: 'SECRET NAME', hidden: true,
      hint: 'A cryptic clue', hint_cn: '一个谜之线索', description: 'SECRET DESC', rarity: 'epic',
    })];
    const state = makeState();
    const result = recommendSurprise(defs, state, 'session-abc');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('');
    expect(result!.name_cn).toBe('');
    expect(result!.icon).toBe('?');
    expect(result!.hint).toBe('A cryptic clue');
    expect(result!.hint_cn).toBe('一个谜之线索');
    expect(result!.category).toBe('surprise');
    expect(result!.rarity).toBe('epic');
  });

  it('returns null for future hidden achievements', () => {
    const defs = [makeDef({ id: 'future_secret', hidden: true, future: true, hint: 'coming soon' })];
    const result = recommendSurprise(defs, makeState(), 'session-123');
    expect(result).toBeNull();
  });
});

describe('recommendNearWin', () => {
  it('returns top 5 near-unlock achievements', () => {
    const defs = [
      makeDef({ id: 'ach_a', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'ach_b', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];
    const events = Array.from({ length: 8 }, () => makeEvent());
    const result = recommendNearWin(defs, events, makeState());
    expect(result).toHaveLength(2);
    expect(result[0]!.progress!.current).toBe(8);
    expect(result[0]!.progress!.pct).toBe(80);
  });

  it('filters out hidden achievements', () => {
    const defs = [
      makeDef({ id: 'visible', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'secret_near', hidden: true, conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];
    const events = Array.from({ length: 9 }, () => makeEvent());
    const result = recommendNearWin(defs, events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.achievement_id).toBe('visible');
  });
});

describe('getRecommendResponse', () => {
  it('returns all 3 categories populated when data available', () => {
    const defs = [
      makeDef({ id: 'ach_1', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'discover_me', conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }] }),
      makeDef({ id: 'secret_one', hidden: true, hint: 'mystery', hint_cn: '谜' }),
    ];
    const events = [makeEvent(), makeEvent(), makeEvent()];
    const state = makeState();
    const resp = getRecommendResponse(defs, events, state, 'sess-001');
    expect(resp.near_win.length).toBeGreaterThan(0);
    expect(resp.discovery).not.toBeNull();
    expect(resp.surprise).not.toBeNull();
    expect(resp.generated_at).toBeTruthy();
    expect(resp.session_id).toBe('sess-001');
  });

  it('returns null discovery and null surprise when pools are empty', () => {
    const resp = getRecommendResponse([], [], makeState(), 'sess-001');
    expect(resp.near_win).toEqual([]);
    expect(resp.discovery).toBeNull();
    expect(resp.surprise).toBeNull();
  });
});
