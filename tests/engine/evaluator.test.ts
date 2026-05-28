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
