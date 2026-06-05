import { describe, it, expect } from 'vitest';
import type {
  AchievementDefinition,
  AchievementState,
  TrackedEvent,
  Condition,
} from '../../src/engine/types.js';
import { findNearUnlocks, type NearUnlock } from '../../src/utils/progress-nudge.js';

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

// ── Tests ──────────────────────────────────────────────────────────

describe('findNearUnlocks', () => {
  // ── Basic cases ─────────────────────────────────────────────────

  it('returns empty for no events', () => {
    const result = findNearUnlocks([makeDef()], [], makeState());
    expect(result).toEqual([]);
  });

  it('returns near-unlock for counter achievement at 70%', () => {
    const events = Array.from({ length: 7 }, () => makeEvent());
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });
    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(7);
    expect(result[0]!.target).toBe(10);
    expect(result[0]!.unit_label).toBe('tool uses');
  });

  it('excludes achievements below minProgress (default 20%)', () => {
    const events = Array.from({ length: 1 }, () => makeEvent());
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });
    // 1/10 = 10% < 20%
    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });

  it('excludes already-unlocked achievements', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    const state = makeState({ unlocked: { test_ach: new Date().toISOString() } });
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });

    const result = findNearUnlocks([def], events, state);
    expect(result).toEqual([]);
  });

  it('excludes hidden achievements', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    const def = makeDef({
      hidden: true,
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });

  it('excludes future achievements', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    const def = makeDef({
      future: true,
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });

  // ── Distinct count ──────────────────────────────────────────────

  it('computes distinct_count progress correctly', () => {
    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Bash' } }),
    ];
    const def = makeDef({
      conditions: [{ type: 'distinct_count', event: 'tool.complete', field: 'tool_name', value: 5 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(3);
    expect(result[0]!.target).toBe(5);
  });

  // ── Streak ──────────────────────────────────────────────────────

  it('computes streak progress from calendar days', () => {
    const today = new Date().toISOString().slice(0, 10);
    // 3 consecutive days including today
    const dates = [today];
    for (let i = 1; i <= 2; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const events = dates.map(d =>
      makeEvent({ event_type: 'session.start', timestamp: `${d}T12:00:00Z` }),
    );

    const def = makeDef({
      conditions: [{ type: 'streak', event: 'session.start', value: 7, window: 'all' }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(3);
    expect(result[0]!.target).toBe(7);
    expect(result[0]!.unit_label).toBe('days');
  });

  // ── Threshold with metric ───────────────────────────────────────

  it('computes threshold metric progress', () => {
    // evaluateMetric computes average for single-field metrics, so use
    // values that make the average meet the 20% minProgress threshold.
    const events = Array.from({ length: 5 }, () =>
      makeEvent({
        event_type: 'tool.complete',
        payload: { tool_name: 'Edit', edit_lines: 15 },
      }),
    );
    const def = makeDef({
      conditions: [{ type: 'threshold', metric: 'edit_lines', event: 'tool.complete', value: 50, window: 'all' }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    // Average of edit_lines: 15
    expect(result[0]!.current).toBe(15);
    expect(result[0]!.target).toBe(50);
  });

  // ── Sequence count ──────────────────────────────────────────────

  it('computes sequence_count progress', () => {
    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
    ];
    const def = makeDef({
      conditions: [{ type: 'sequence_count', pattern: ['tool.complete', 'tool.complete'], value: 3 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    // Read,Write = cycle 1, Read,Write = cycle 2
    expect(result[0]!.current).toBe(2);
    expect(result[0]!.target).toBe(3);
  });

  // ── Set completion is skipped (removed — used set_id not condition fields) ─

  it('skips set_completion type', () => {
    const defs: AchievementDefinition[] = [
      makeDef({ id: 's1', set_id: 'bug_catcher', conditions: [{ type: 'set_completion', value: 3 }] as Condition[] }),
      makeDef({ id: 's2', set_id: 'bug_catcher' }),
      makeDef({ id: 's3', set_id: 'bug_catcher' }),
    ];
    const state = makeState({
      unlocked: { s2: '2026-01-01', s3: '2026-01-02' },
    });

    const result = findNearUnlocks(defs, [], state);
    // set_completion is no longer supported — should return empty
    expect(result).toEqual([]);
  });

  // ── Sorting and truncation ──────────────────────────────────────

  it('returns maxResults (default 3) sorted by completion desc', () => {
    const events = Array.from({ length: 8 }, () => makeEvent());
    const defs = [
      makeDef({ id: 'a', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'b', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'c', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'd', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];
    // All at 8/10 = 80%

    const result = findNearUnlocks(defs, events, makeState());
    expect(result).toHaveLength(3);
    // All at 80%, sorted by id
    expect(result[0]!.achievement_id).toBe('a');
    expect(result[1]!.achievement_id).toBe('b');
    expect(result[2]!.achievement_id).toBe('c');
  });

  // ── Unsupported types skipped ───────────────────────────────────

  it('skips sequence, event, pattern_match, ratio, mode, set_completion types', () => {
    const defs: AchievementDefinition[] = [
      makeDef({ id: 'seq', conditions: [{ type: 'sequence', value: 1 }] as Condition[] }),
      makeDef({ id: 'evt', conditions: [{ type: 'event', value: 1 }] as Condition[] }),
      makeDef({ id: 'pm', conditions: [{ type: 'pattern_match', value: 1 }] as Condition[] }),
      makeDef({ id: 'rat', conditions: [{ type: 'ratio', value: 1 }] as Condition[] }),
      makeDef({ id: 'mod', conditions: [{ type: 'mode', value: 1 }] as Condition[] }),
      makeDef({ id: 'set', conditions: [{ type: 'set_completion', value: 1 }] as Condition[] }),
    ];

    const result = findNearUnlocks(defs, [makeEvent()], makeState());
    expect(result).toEqual([]);
  });

  it('returns empty when all achievements are unlocked', () => {
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });
    const state = makeState({ unlocked: { test_ach: '2026-01-01' } });

    const result = findNearUnlocks([def], [makeEvent()], state);
    expect(result).toEqual([]);
  });
});
