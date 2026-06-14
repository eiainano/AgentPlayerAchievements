import { describe, it, expect } from 'vitest';
import { explainAchievement } from '../../src/utils/explain.js';
import type { AchievementDefinition, AchievementState, TrackedEvent } from '../../src/engine/types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TrackedEvent> & { event_type: string }): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: overrides.event_id || `evt-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: overrides.timestamp || new Date().toISOString(),
    tool_source: 'claude-code',
    event_type: overrides.event_type,
    payload: overrides.payload || {},
    context: overrides.context || { session_id: 's1', model: 'claude-sonnet-4-6' },
  };
}

function makeDef(overrides: Partial<AchievementDefinition> & { id: string }): AchievementDefinition {
  return {
    id: overrides.id,
    name: overrides.name || overrides.id,
    name_cn: overrides.name_cn,
    description: overrides.description || '',
    description_cn: overrides.description_cn,
    icon: overrides.icon || '🏆',
    category: overrides.category || 'skill',
    rarity: overrides.rarity || 'common',
    hidden: overrides.hidden || false,
    hint: overrides.hint,
    hint_cn: overrides.hint_cn,
    future: overrides.future || false,
    conditions: overrides.conditions || [],
  };
}

function emptyState(): AchievementState {
  return { unlocked: {}, stats: { total_unlocked: 0 } };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('explainAchievement', () => {
  it('returns basic metadata for a simple achievement', () => {
    const def = makeDef({
      id: 'test_ach',
      name: 'Test Achievement',
      name_cn: '测试成就',
      category: 'milestone',
      rarity: 'uncommon',
      conditions: [{ type: 'event', event: 'session.start', value: 1 }],
    });

    const result = explainAchievement(def, [def], [], emptyState());

    expect(result.achievement_id).toBe('test_ach');
    expect(result.name).toBe('Test Achievement');
    expect(result.name_cn).toBe('测试成就');
    expect(result.unlocked).toBe(false);
    expect(result.hidden).toBe(false);
    expect(result.conditions).toHaveLength(1);
  });

  it('marks achievement as unlocked when in state', () => {
    const def = makeDef({
      id: 'unlocked_ach',
      conditions: [{ type: 'event', event: 'session.start', value: 1 }],
    });
    const state: AchievementState = {
      unlocked: { unlocked_ach: '2026-06-01T00:00:00Z' },
      stats: { total_unlocked: 1 },
    };

    const result = explainAchievement(def, [def], [], state);

    expect(result.unlocked).toBe(true);
    expect(result.unlocked_at).toBe('2026-06-01T00:00:00Z');
  });
});

describe('explainAchievement — condition types', () => {
  it('counter: shows progress with matched/excluded counts', () => {
    const def = makeDef({
      id: 'counter_ach',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 5, operator: '>=', window: 'all' }],
    });

    const events = Array.from({ length: 3 }, (_, i) =>
      makeEvent({ event_type: 'tool.complete', timestamp: `2026-06-${String(10 + i).padStart(2, '0')}T10:00:00Z` })
    );

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;

    expect(c.type).toBe('counter');
    expect(c.current_value).toBe(3);
    expect(c.target_value).toBe(5);
    expect(c.met).toBe(false);
    expect(c.matched_count).toBe(3);
    expect(c.progress_pct).toBe(60);
  });

  it('counter: shows met when threshold reached', () => {
    const def = makeDef({
      id: 'counter_met',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 2, operator: '>=', window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'tool.complete' }),
      makeEvent({ event_type: 'tool.complete' }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    expect(result.conditions[0]!.met).toBe(true);
    expect(result.conditions[0]!.progress_pct).toBe(100);
  });

  it('counter: same_target mode shows field counts in details', () => {
    const def = makeDef({
      id: 'same_target_ach',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 3, operator: '>=', window: 'all', same_target: true, field: 'tool_name' }],
    });

    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Edit' } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.details.mode).toBe('same_target');
    expect(c.details.max_field_value).toBe('Read');
    expect(c.details.max_count).toBe(2);
  });

  it('threshold: shows progress for field-sum threshold', () => {
    const def = makeDef({
      id: 'threshold_ach',
      conditions: [{ type: 'threshold', event: 'task.complete', field: 'step_count', value: 10, operator: '>=', window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'task.complete', payload: { step_count: 3 } }),
      makeEvent({ event_type: 'task.complete', payload: { step_count: 4 } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.type).toBe('threshold');
    expect(c.current_value).toBe(7);
    expect(c.target_value).toBe(10);
    expect(c.details.sum_value).toBe(7);
  });

  it('threshold: per_event mode flag shown', () => {
    const def = makeDef({
      id: 'pe_ach',
      conditions: [{ type: 'threshold', event: 'session.end', field: 'duration_ms', value: 3600000, per_event: true, window: 'all' }],
    });
    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.conditions[0]!.details.per_event).toBe(true);
  });

  it('streak: calendar mode shows active streak and days', () => {
    const def = makeDef({
      id: 'streak_ach',
      conditions: [{ type: 'streak', event: 'session.start', value: 3, window: 'all' }],
    });

    // 3 consecutive days
    const events = [
      makeEvent({ event_type: 'session.start', timestamp: '2026-06-13T10:00:00Z' }),
      makeEvent({ event_type: 'session.start', timestamp: '2026-06-14T10:00:00Z' }),
      makeEvent({ event_type: 'session.start', timestamp: '2026-06-15T10:00:00Z' }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.type).toBe('streak');
    expect(c.details.mode).toBe('calendar_days');
    expect(c.details.active_streak).toBe(3);
    expect(c.current_value).toBe(3);
    expect(c.met).toBe(true);
  });

  it('streak: shows partial progress', () => {
    const def = makeDef({
      id: 'streak_partial',
      conditions: [{ type: 'streak', event: 'session.start', value: 7, window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'session.start', timestamp: '2026-06-13T10:00:00Z' }),
      makeEvent({ event_type: 'session.start', timestamp: '2026-06-14T10:00:00Z' }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    expect(result.conditions[0]!.current_value).toBe(2);
    expect(result.conditions[0]!.met).toBe(false);
  });

  it('sequence: shows matched prefix and next required', () => {
    const def = makeDef({
      id: 'seq_ach',
      conditions: [{ type: 'sequence', sequence: ['test.fail', 'tool.complete', 'tool.complete'], value: 3, window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'test.fail' }),
      makeEvent({ event_type: 'tool.complete' }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.current_value).toBe(2);
    expect(c.target_value).toBe(3);
    expect(c.details.matched_prefix).toEqual(['test.fail', 'tool.complete']);
    expect(c.details.next_required).toBe('tool.complete');
  });

  it('distinct_count: shows seen values', () => {
    const def = makeDef({
      id: 'dc_ach',
      conditions: [{ type: 'distinct_count', event: 'tool.complete', field: 'tool_name', value: 3, window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Edit' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.type).toBe('distinct_count');
    expect(c.current_value).toBe(3);
    expect(c.met).toBe(true);
    expect((c.details.seen_values as string[]).sort()).toEqual(['Edit', 'Read', 'Write']);
  });

  it('event: shows has_match in details', () => {
    const def = makeDef({
      id: 'event_ach',
      conditions: [{ type: 'event', event: 'mcp.connect', value: 1 }],
    });

    const events = [makeEvent({ event_type: 'mcp.connect' })];
    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.met).toBe(true);
    expect(c.details.has_match).toBe(true);
  });

  it('mode: shows frequency distribution', () => {
    const def = makeDef({
      id: 'mode_ach',
      conditions: [{ type: 'mode', event: 'tool.complete', field: 'tool_name', value: 50, window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Edit' } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    const dist = c.details.distribution as Record<string, number>;
    expect(dist.Read).toBe(2);
    expect(dist.Edit).toBe(1);
    expect(c.details.mode_value).toBe('Read');
    expect(c.details.mode_count).toBe(2);
  });

  it('sequence_count: shows cycles and partial step', () => {
    const def = makeDef({
      id: 'sc_ach',
      conditions: [{ type: 'sequence_count', event: 'tool.complete', pattern: ['file.edit', 'command.run'], value: 2, window: 'all' }],
    });

    // Pattern matches event_type, not payload fields
    const events = [
      makeEvent({ event_type: 'file.edit', payload: { tool_name: 'Edit' } }),
      makeEvent({ event_type: 'command.run', payload: { tool_name: 'Bash' } }),
      makeEvent({ event_type: 'file.edit', payload: { tool_name: 'Edit' } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.details.completed_cycles).toBe(1);
    expect(c.details.partial_step).toBe(1);
  });

  it('pattern_match: shows first_in_session flag', () => {
    const def = makeDef({
      id: 'pm_ach',
      conditions: [{ type: 'pattern_match', event: 'user.message', pattern: 'hello', value: 1, first_in_session: true, window: 'single_session' }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.conditions[0]!.details.first_in_session).toBe(true);
  });

  it('ratio: shows metric', () => {
    const def = makeDef({
      id: 'ratio_ach',
      conditions: [{ type: 'ratio', metric: 'edit_lines / total_file_lines', value: 50, window: 'all' }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.conditions[0]!.details.metric).toBe('edit_lines / total_file_lines');
  });

  it('time_gap: shows gap info', () => {
    const def = makeDef({
      id: 'tg_ach',
      conditions: [{ type: 'time_gap', value: 60000, window: 'all' }],
    });

    const e1 = makeEvent({ event_type: 'tool.complete', timestamp: '2026-06-15T10:00:00Z' });
    const e2 = makeEvent({ event_type: 'tool.complete', timestamp: '2026-06-15T10:00:30Z' });

    const result = explainAchievement(def, [def], [e1, e2], emptyState());
    const c = result.conditions[0]!;
    expect(c.details.closest_pair_gap_ms).toBe(30000);
    expect(c.details.pair_count).toBe(1);
  });
});

describe('explainAchievement — set_completion', () => {
  it('shows member progress for set_completion condition', () => {
    const defs: AchievementDefinition[] = [
      makeDef({ id: 'master', rarity: 'common', conditions: [{ type: 'set_completion', rarity: 'common', value: 3 }] }),
      makeDef({ id: 'member_a', rarity: 'common', conditions: [{ type: 'counter', event: 'tool.complete', value: 1, window: 'all' }] }),
      makeDef({ id: 'member_b', rarity: 'common', conditions: [{ type: 'counter', event: 'tool.complete', value: 1, window: 'all' }] }),
      makeDef({ id: 'member_c', rarity: 'common', conditions: [{ type: 'counter', event: 'tool.complete', value: 1, window: 'all' }] }),
    ];

    const state: AchievementState = {
      unlocked: { member_a: '2026-06-01T00:00:00Z' },
      stats: { total_unlocked: 1 },
    };

    const result = explainAchievement(defs[0]!, defs, [], state);
    const c = result.conditions[0]!;
    expect(c.type).toBe('set_completion');
    expect(c.current_value).toBe(1);
    expect(c.target_value).toBe(3);
    expect(c.met).toBe(false);
    expect(c.progress_pct).toBe(33);

    const members = c.details.members as Array<{ id: string; unlocked: boolean }>;
    expect(members).toHaveLength(3);
    expect(members.find(m => m.id === 'member_a')!.unlocked).toBe(true);
    expect(members.find(m => m.id === 'member_b')!.unlocked).toBe(false);
    expect(members.find(m => m.id === 'member_c')!.unlocked).toBe(false);
  });

  it('set_completion: all mode excludes self and future', () => {
    const defs: AchievementDefinition[] = [
      makeDef({ id: 'master', rarity: 'common', conditions: [{ type: 'set_completion', all: true, value: 0 }] }),
      makeDef({ id: 'member_a', rarity: 'common', conditions: [{ type: 'event', event: 'session.start', value: 1 }] }),
      makeDef({ id: 'future_x', rarity: 'common', future: true, conditions: [{ type: 'event', event: 'x', value: 1 }] }),
    ];

    const result = explainAchievement(defs[0]!, defs, [], emptyState());
    const c = result.conditions[0]!;
    expect(c.target_value).toBe(1); // only member_a, excluding self + future
  });
});

describe('explainAchievement — hidden achievements', () => {
  it('still builds full explanation in the raw result (caller must mask)', () => {
    const def = makeDef({
      id: 'secret',
      hidden: true,
      hint: 'look closer',
      conditions: [{ type: 'event', event: 'mcp.connect', value: 1 }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    // The explain function returns full data — masking is the caller's job
    expect(result.hidden).toBe(true);
    expect(result.unlocked).toBe(false);
    expect(result.hint).toBe('look closer');
    expect(result.conditions).toHaveLength(1);
  });
});

describe('explainAchievement — exclusion trace', () => {
  it('excludes events that do not match filter', () => {
    const def = makeDef({
      id: 'filtered_ach',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 5, window: 'all', filter: "tool_name == 'TaskCreate'" }],
    });

    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'TaskCreate' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Edit' } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.matched_count).toBe(1);
    expect(c.excluded_count).toBe(2);
    expect(c.excluded_events.length).toBeGreaterThan(0);
    expect(c.excluded_events[0]!.reason_code).toBe('filter');
  });

  it('caps exclusion trace at 5 events', () => {
    const def = makeDef({
      id: 'many_excluded',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 1, window: 'all', filter: "tool_name == 'RareTool'" }],
    });

    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: `Tool${i}` } })
    );

    const result = explainAchievement(def, [def], events, emptyState());
    expect(result.conditions[0]!.excluded_events.length).toBeLessThanOrEqual(5);
  });

  it('excludes events outside time window', () => {
    const def = makeDef({
      id: 'window_ach',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 5, window: '1h' }],
    });

    const oldEvent = makeEvent({
      event_type: 'tool.complete',
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    });

    const result = explainAchievement(def, [def], [oldEvent], emptyState());
    const c = result.conditions[0]!;
    expect(c.matched_count).toBe(0);
    expect(c.excluded_events.length).toBeGreaterThan(0);
    if (c.excluded_events.length > 0) {
      expect(c.excluded_events[0]!.reason_code).toBe('window');
    }
  });

  it('excludes events that fail role check', () => {
    const def = makeDef({
      id: 'role_ach',
      conditions: [{ type: 'counter', event: 'user.message', value: 3, window: 'all', role: 'agent' }],
    });

    const events = [
      makeEvent({ event_type: 'user.message', payload: { role: 'user' } }),
      makeEvent({ event_type: 'user.message', payload: { role: 'user' } }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.matched_count).toBe(0);
    expect(c.excluded_events.length).toBeGreaterThan(0);
    const roleExclusions = c.excluded_events.filter(e => e.reason_code === 'role');
    expect(roleExclusions.length).toBeGreaterThan(0);
  });
});

describe('explainAchievement — window info', () => {
  it('shows lifetime window for window: all', () => {
    const def = makeDef({
      id: 'lifetime',
      conditions: [{ type: 'counter', event: 'session.start', value: 1, window: 'all' }],
    });

    const events = [
      makeEvent({ event_type: 'session.start', timestamp: '2026-03-01T10:00:00Z' }),
      makeEvent({ event_type: 'session.start', timestamp: '2026-06-15T10:00:00Z' }),
    ];

    const result = explainAchievement(def, [def], events, emptyState());
    const c = result.conditions[0]!;
    expect(c.window_label).toBe('lifetime (all events)');
    expect(c.window_start).toBe('2026-03-01');
    expect(c.window_end).toBe('2026-06-15');
  });

  it('shows session window for single_session', () => {
    const def = makeDef({
      id: 'session_ach',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 1, window: 'single_session' }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.conditions[0]!.window_label).toBe('current session');
  });

  it('shows time-bounded window label', () => {
    const def = makeDef({
      id: 'time_ach',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 1, window: '90d' }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.conditions[0]!.window_label).toBe('90d');
  });
});

describe('explainAchievement — unlocked achievements', () => {
  it('shows unlocked status and unlock date', () => {
    const def = makeDef({
      id: 'done',
      conditions: [{ type: 'event', event: 'session.start', value: 1 }],
    });
    const state: AchievementState = {
      unlocked: { done: '2026-06-10T14:30:00Z' },
      stats: { total_unlocked: 1 },
    };

    const result = explainAchievement(def, [def], [makeEvent({ event_type: 'session.start' })], state);
    expect(result.unlocked).toBe(true);
    expect(result.unlocked_at).toBe('2026-06-10T14:30:00Z');
    expect(result.conditions[0]!.met).toBe(true);
    expect(result.conditions[0]!.progress_pct).toBe(100);
  });
});

describe('explainAchievement — edge cases', () => {
  it('handles empty conditions gracefully', () => {
    const def = makeDef({ id: 'empty', conditions: [] });
    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.conditions).toHaveLength(0);
  });

  it('handles condition with 0 target value', () => {
    const def = makeDef({
      id: 'zero_target',
      conditions: [{ type: 'counter', event: 'tool.complete', value: 0, window: 'all' }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    const c = result.conditions[0]!;
    expect(c.target_value).toBe(0);
    expect(c.progress_pct).toBe(100); // met=true → 100%
    expect(c.met).toBe(true);
  });

  it('handles achievement without name_cn', () => {
    const def = makeDef({
      id: 'en_only',
      name: 'English Only',
      conditions: [{ type: 'event', event: 'session.start', value: 1 }],
    });

    const result = explainAchievement(def, [def], [], emptyState());
    expect(result.name_cn).toBe('English Only'); // falls back to name
  });

  it('returns correct unit labels for each type', () => {
    const types: Array<{ type: string; cond: Partial<AchievementDefinition['conditions'][number]>; expectedUnit: string }> = [
      { type: 'counter', cond: { type: 'counter', event: 'tool.complete', value: 1, window: 'all' }, expectedUnit: 'events' },
      { type: 'threshold', cond: { type: 'threshold', event: 'task.complete', value: 1, window: 'all', field: 'step_count' }, expectedUnit: 'step_count' },
      { type: 'streak', cond: { type: 'streak', event: 'session.start', value: 7, window: 'all' }, expectedUnit: 'days' },
      { type: 'sequence', cond: { type: 'sequence', sequence: ['a'], value: 1, window: 'all' }, expectedUnit: 'steps' },
      { type: 'distinct_count', cond: { type: 'distinct_count', event: 'tool.complete', value: 1, window: 'all', field: 'tool_name' }, expectedUnit: 'tool_name' },
      { type: 'set_completion', cond: { type: 'set_completion', value: 1 }, expectedUnit: 'members' },
      { type: 'mode', cond: { type: 'mode', event: 'tool.complete', value: 50, window: 'all', field: 'tool_name' }, expectedUnit: '%' },
      { type: 'sequence_count', cond: { type: 'sequence_count', event: 'tool.complete', value: 1, window: 'all' }, expectedUnit: 'cycles' },
      { type: 'pattern_match', cond: { type: 'pattern_match', event: 'user.message', value: 1, window: 'all' }, expectedUnit: 'matches' },
      { type: 'time_gap', cond: { type: 'time_gap', value: 60000, window: 'all' }, expectedUnit: 'ms' },
    ];

    for (const { type, cond, expectedUnit } of types) {
      const def = makeDef({ id: `unit_${type}`, conditions: [cond as any] });
      const allDefs = type === 'set_completion' ? [
        def,
        makeDef({ id: 'm1', rarity: 'common', conditions: [{ type: 'event', event: 'x', value: 1 }] }),
      ] : [def];
      const result = explainAchievement(def, allDefs, [], emptyState());
      expect(result.conditions[0]!.unit_label).toBe(expectedUnit);
    }
  });
});
