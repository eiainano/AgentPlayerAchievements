import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateAll } from '../../src/engine/evaluator.js';
import type { TrackedEvent, Condition, EvaluationResult } from '../../src/engine/types.js';

function makeEvent(event_type: string, overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: 'test-id',
    timestamp: new Date().toISOString(),
    tool_source: 'test',
    event_type,
    payload: {},
    context: { session_id: 'test', model: 'test' },
    ...overrides,
  };
}

describe('evaluateCondition', () => {
  it('counter: meets threshold when count >= value', () => {
    const events = [makeEvent('test.event'), makeEvent('test.event')];
    const cond: Condition = { type: 'counter', event: 'test.event', value: 2, operator: '>=' };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('counter: fails when count < value', () => {
    const events = [makeEvent('test.event')];
    const cond: Condition = { type: 'counter', event: 'test.event', value: 3, operator: '>=' };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: false, progress: 1, target: 3 });
  });

  it('counter: respects filter', () => {
    const events = [
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Edit' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } }),
    ];
    const cond: Condition = { type: 'counter', event: 'tool.complete', filter: "tool_name == 'Read'", value: 2 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('threshold: counts events within time window', () => {
    const now = Date.now();
    const events = [
      makeEvent('test.e', { timestamp: new Date(now - 1000).toISOString() }),
      makeEvent('test.e', { timestamp: new Date(now - 3600001).toISOString() }), // outside 1h window
    ];
    const cond: Condition = { type: 'threshold', event: 'test.e', window: '1h', value: 1 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 1, target: 1 });
  });

  it('streak: counts consecutive days', () => {
    const events = [
      makeEvent('daily', { timestamp: '2025-01-03T00:00:00Z' }),
      makeEvent('daily', { timestamp: '2025-01-02T00:00:00Z' }),
      makeEvent('daily', { timestamp: '2025-01-01T00:00:00Z' }),
    ];
    const cond: Condition = { type: 'streak', event: 'daily', value: 3 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 3 });
  });

  it('streak: breaks on gap', () => {
    const events = [
      makeEvent('daily', { timestamp: '2025-01-05T00:00:00Z' }),
      makeEvent('daily', { timestamp: '2025-01-03T00:00:00Z' }), // gap on the 4th
      makeEvent('daily', { timestamp: '2025-01-02T00:00:00Z' }),
    ];
    const cond: Condition = { type: 'streak', event: 'daily', value: 3 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: false, progress: 1, target: 3 });
  });

  it('sequence: matches events in order', () => {
    const events = [
      makeEvent('step.a'),
      makeEvent('step.b'),
      makeEvent('step.c'),
    ];
    const cond: Condition = { type: 'sequence', sequence: ['step.a', 'step.b', 'step.c'], value: 3 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 3 });
  });

  it('sequence: fails when order is wrong', () => {
    const events = [
      makeEvent('step.b'),
      makeEvent('step.a'),
    ];
    const cond: Condition = { type: 'sequence', sequence: ['step.a', 'step.b'], value: 2 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: false, progress: 1, target: 2 });
  });

  it('distinct_count: counts unique field values', () => {
    const events = [
      makeEvent('tool.run', { payload: { tool_name: 'Read' } }),
      makeEvent('tool.run', { payload: { tool_name: 'Edit' } }),
      makeEvent('tool.run', { payload: { tool_name: 'Read' } }),
    ];
    const cond: Condition = { type: 'distinct_count', event: 'tool.run', field: 'tool_name', value: 2 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('event: met when event exists', () => {
    const events = [makeEvent('my.event')];
    const cond: Condition = { type: 'event', event: 'my.event', value: 1 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 1, target: 1 });
  });

  it('event: not met when event missing', () => {
    const events = [makeEvent('other.event')];
    const cond: Condition = { type: 'event', event: 'my.event', value: 1 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: false, progress: 0, target: 1 });
  });

  it('mode: detects most frequent value in range', () => {
    const events = [
      makeEvent('session.start', { payload: { hour: '5' } }),
      makeEvent('session.start', { payload: { hour: '6' } }),
      makeEvent('session.start', { payload: { hour: '5' } }),
    ];
    const cond: Condition = {
      type: 'mode', event: 'session.start', field: 'hour',
      in_range: [0, 5], threshold: 0.5, value: 1,
    };
    const result = evaluateCondition(cond, events);
    expect(result.met).toBe(true);
  });

  it('mode: fails when mode outside range', () => {
    const events = [
      makeEvent('session.start', { payload: { hour: '12' } }),
      makeEvent('session.start', { payload: { hour: '13' } }),
    ];
    const cond: Condition = {
      type: 'mode', event: 'session.start', field: 'hour',
      in_range: [0, 5], threshold: 0.5, value: 1,
    };
    expect(evaluateCondition(cond, events).met).toBe(false);
  });

  it('sequence_count: counts pattern repetitions', () => {
    const events = [
      makeEvent('task.complete'), makeEvent('commit'), makeEvent('pr'),
      makeEvent('task.complete'), makeEvent('commit'), makeEvent('pr'),
      makeEvent('task.complete'), makeEvent('commit'), makeEvent('pr'),
    ];
    const cond: Condition = {
      type: 'sequence_count', pattern: ['task.complete', 'commit', 'pr'],
      operator: '>=', value: 3,
    };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 3 });
  });

  it('pattern_match: matches regex against payload', () => {
    const events = [
      makeEvent('conversation.message', { payload: { content: "I'm sorry I can't do that" } }),
    ];
    const cond: Condition = {
      type: 'pattern_match', event: 'conversation.message',
      pattern: "sorry.*can.*t", value: 1,
    };
    expect(evaluateCondition(cond, events).met).toBe(true);
  });

  it('pattern_match: filters by role', () => {
    const events = [
      makeEvent('conversation.message', { payload: { role: 'agent', content: 'hello' } }),
      makeEvent('conversation.message', { payload: { role: 'user', content: "I'm sorry" } }),
    ];
    const cond: Condition = {
      type: 'pattern_match', event: 'conversation.message',
      role: 'agent', pattern: 'hello', value: 1,
    };
    expect(evaluateCondition(cond, events).met).toBe(true);
  });

  it('ratio: computes field ratio', () => {
    const events = [
      makeEvent('input', { payload: { paste: '50', total: '100' } }),
      makeEvent('input', { payload: { paste: '25', total: '100' } }),
    ];
    const cond: Condition = {
      type: 'ratio', event: 'input',
      numerator: 'paste', denominator: 'total',
      operator: '>=', value: 0.3,
    };
    const result = evaluateCondition(cond, events);
    // (50+25)/(100+100) = 75/200 = 0.375 → progress=38, target=30
    expect(result.met).toBe(true);
    expect(result.progress).toBe(38);
  });

  it('threshold: sums field values (not count)', () => {
    const events = [
      makeEvent('task.complete', { payload: { step_count: '5' } }),
      makeEvent('task.complete', { payload: { step_count: '3' } }),
    ];
    const cond: Condition = { type: 'threshold', event: 'task.complete', field: 'step_count', operator: '>=', value: 8 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 8, target: 8 });
  });

  it('threshold: metric expression', () => {
    const events = [
      makeEvent('task.complete', { payload: { edit_lines: '5', total_file_lines: '200' } }),
      makeEvent('task.complete', { payload: { edit_lines: '3', total_file_lines: '100' } }),
    ];
    const cond: Condition = {
      type: 'threshold', metric: 'edit_lines / total_file_lines', window: '24h', operator: '<', value: 0.05,
    };
    const result = evaluateCondition(cond, events);
    // (5+3)/(200+100) = 8/300 = 0.0267 < 0.05 → true
    expect(result.met).toBe(true);
  });

  it('counter: same_target finds max of same field value', () => {
    const events = [
      makeEvent('file.edit', { payload: { function_name: 'foo' } }),
      makeEvent('file.edit', { payload: { function_name: 'foo' } }),
      makeEvent('file.edit', { payload: { function_name: 'foo' } }),
      makeEvent('file.edit', { payload: { function_name: 'bar' } }),
    ];
    const cond: Condition = { type: 'counter', event: 'file.edit', field: 'function_name', same_target: true, value: 3 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 3 });
  });

  it('counter: same_target fails when no field value reaches target', () => {
    const events = [
      makeEvent('file.edit', { payload: { function_name: 'foo' } }),
      makeEvent('file.edit', { payload: { function_name: 'bar' } }),
    ];
    const cond: Condition = { type: 'counter', event: 'file.edit', field: 'function_name', same_target: true, value: 2 };
    expect(evaluateCondition(cond, events).met).toBe(false);
  });

  it('sequence: consecutive mode counts longest run', () => {
    const events = [
      makeEvent('tool.complete'), makeEvent('tool.complete'), makeEvent('tool.complete'),
      makeEvent('tool.deny'), // breaks the run
      makeEvent('tool.complete'), makeEvent('tool.complete'),
    ];
    const cond: Condition = {
      type: 'sequence', event: 'tool.complete', consecutive: true,
      count: { operator: '>=', value: 3 },
    };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 3 });
  });

  it('distinct_count: respects values whitelist', () => {
    const events = [
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Edit' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Write' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Other' } }), // not in whitelist
    ];
    const cond: Condition = {
      type: 'distinct_count', event: 'tool.complete', field: 'tool_name',
      values: ['Read', 'Edit', 'Write', 'Bash', 'ToolSearch'], value: 3,
    };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 3 });
  });

  it('distinct_count: values whitelist excludes non-matches', () => {
    const events = [
      makeEvent('tool.complete', { payload: { tool_name: 'Other' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Unknown' } }),
    ];
    const cond: Condition = {
      type: 'distinct_count', event: 'tool.complete', field: 'tool_name',
      values: ['Read', 'Edit'], value: 1,
    };
    expect(evaluateCondition(cond, events).met).toBe(false);
  });

  it('threshold: max_per_day checks daily limits', () => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const events = [
      makeEvent('conversation.message', { timestamp: `${today}T08:00:00Z` }),
      makeEvent('conversation.message', { timestamp: `${today}T09:00:00Z` }),
      makeEvent('conversation.message', { timestamp: `${today}T10:00:00Z` }),
    ];
    const cond: Condition = { type: 'threshold', event: 'conversation.message', max_per_day: 1, operator: '<=', value: 0 };
    // 3 events on today → max per day = 3 → exceeds limit of 1
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: false, progress: 3, target: 1 });
  });

  it('threshold: max_per_day passes when daily limit respected', () => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const events = [
      makeEvent('conversation.message', { timestamp: `${today}T08:00:00Z` }),
    ];
    const cond: Condition = { type: 'threshold', event: 'conversation.message', max_per_day: 1, operator: '<=', value: 0 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 1, target: 1 });
  });

  it('counter: single_session window scopes to latest session only', () => {
    const events = [
      makeEvent('agent.spawn', { context: { session_id: 'old', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'old', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'old', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'old', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'current', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'current', model: 'test' } }),
    ];
    const cond: Condition = { type: 'counter', event: 'agent.spawn', window: 'single_session', operator: '>=', value: 2 };
    // Latest session = 'current' with 2 spawns → >=2 is met
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('counter: single_session scoped to <= also works per session', () => {
    const events = [
      makeEvent('agent.spawn', { context: { session_id: 'current', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'current', model: 'test' } }),
      makeEvent('agent.spawn', { context: { session_id: 'current', model: 'test' } }),
    ];
    const cond: Condition = { type: 'counter', event: 'agent.spawn', window: 'single_session', operator: '<=', value: 4 };
    // 3 ≤ 4 → true (the 5th kill bug is fixed)
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 3, target: 4 });
  });

  it('streak: respects filter', () => {
    const events = [
      makeEvent('task.complete', { payload: { manual_edits: 0 }, timestamp: '2025-06-03T00:00:00Z' }),
      makeEvent('task.complete', { payload: { manual_edits: 0 }, timestamp: '2025-06-02T00:00:00Z' }),
      makeEvent('task.complete', { payload: { manual_edits: 5 }, timestamp: '2025-06-01T00:00:00Z' }),
    ];
    const cond: Condition = {
      type: 'streak', event: 'task.complete', filter: "manual_edits == 0", operator: '>=', value: 2,
    };
    // Only the two manual_edits==0 events count → 2-day streak
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('streak: respects operator', () => {
    const events = [
      makeEvent('daily', { timestamp: '2025-06-03T00:00:00Z' }),
      makeEvent('daily', { timestamp: '2025-06-02T00:00:00Z' }),
    ];
    const cond: Condition = { type: 'streak', event: 'daily', operator: '==', value: 2 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('sequence: standard mode respects window', () => {
    const now = Date.now();
    const events = [
      makeEvent('step.a', { timestamp: new Date(now - 1000).toISOString() }),
      makeEvent('step.b', { timestamp: new Date(now - 500).toISOString() }),
    ];
    const cond: Condition = { type: 'sequence', sequence: ['step.a', 'step.b'], window: '1h', value: 2 };
    expect(evaluateCondition(cond, events)).toEqual<EvaluationResult>({ met: true, progress: 2, target: 2 });
  });

  it('set_completion: via evaluateAll', () => {
    const defs = [
      { id: 'a', rarity: 'common', conditions: [{ type: 'set_completion' as const, rarity: 'common', value: 1 }] },
      { id: 'b', rarity: 'common', conditions: [{ type: 'event' as const, event: 'x', value: 1 }] },
      { id: 'c', rarity: 'uncommon', conditions: [{ type: 'event' as const, event: 'x', value: 1 }] },
    ];
    const events: TrackedEvent[] = [];
    // All common achievements unlocked → set_completion should pass for 'a'
    const unlocked = { b: 't1', c: 't2' };
    expect(evaluateAll(defs, events, unlocked)).toContain('a');
  });
});

describe('evaluateAll', () => {
  it('returns IDs of newly unlocked achievements', () => {
    const defs = [
      { id: 'ach-1', conditions: [{ type: 'event' as const, event: 'my.event', value: 1 }] },
      { id: 'ach-2', conditions: [{ type: 'event' as const, event: 'missing.event', value: 1 }] },
    ];
    const events = [makeEvent('my.event')];
    const unlocked: Record<string, string> = {};
    expect(evaluateAll(defs, events, unlocked)).toEqual(['ach-1']);
  });

  it('skips already unlocked achievements', () => {
    const defs = [
      { id: 'ach-1', conditions: [{ type: 'event' as const, event: 'my.event', value: 1 }] },
    ];
    const events = [makeEvent('my.event')];
    const unlocked: Record<string, string> = { 'ach-1': '2025-01-01T00:00:00Z' };
    expect(evaluateAll(defs, events, unlocked)).toEqual([]);
  });
});
