import { describe, it, expect } from 'vitest';
import { computeStats, aggregateDaily, mergeDaily } from '../../src/engine/stats.js';
import type { AgentToolStats } from '../../src/engine/stats.js';
import type { TrackedEvent } from '../../src/engine/types.js';

function makeEvent(
  event_type: string,
  tool_source: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: crypto.randomUUID ? crypto.randomUUID() : 'test-id',
    timestamp: new Date().toISOString(),
    tool_source,
    event_type,
    payload: {},
    context: { session_id: 'test', model: 'auto' },
    ...overrides,
  };
}

function ts(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe('computeStats', () => {
  it('empty events → all zero counts', () => {
    const result = computeStats([]);
    expect(result.sessions).toEqual({});
    expect(result.user_messages).toEqual({});
    expect(result.usage_time_ms).toEqual({});
  });

  it('one complete session with user messages', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(1000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(5000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(10000) }),
      makeEvent('session.end', 'claude-code', { timestamp: ts(15000) }),
    ];

    const result = computeStats(events);

    expect(result.sessions['claude-code']).toBe(1);
    expect(result.user_messages['claude-code']).toBe(3);
    // usage_time = last msg (10000) - first msg (1000) = 9000
    expect(result.usage_time_ms['claude-code']).toBe(9000);
  });

  it('multiple sessions different tool_source', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(1000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(2000) }),
      makeEvent('session.end', 'claude-code', { timestamp: ts(3000) }),

      makeEvent('session.start', 'openclaw', { timestamp: ts(10000) }),
      makeEvent('user.message', 'openclaw', { timestamp: ts(11000) }),
      makeEvent('user.message', 'openclaw', { timestamp: ts(15000) }),
      makeEvent('session.end', 'openclaw', { timestamp: ts(20000) }),
    ];

    const result = computeStats(events);

    expect(result.sessions['claude-code']).toBe(1);
    expect(result.sessions['openclaw']).toBe(1);
    expect(result.user_messages['claude-code']).toBe(2);
    expect(result.user_messages['openclaw']).toBe(2);
    // CC: last(2000) - first(1000) = 1000
    expect(result.usage_time_ms['claude-code']).toBe(1000);
    // OpenClaw: last(15000) - first(11000) = 4000
    expect(result.usage_time_ms['openclaw']).toBe(4000);
  });

  it('missing session.end → session counted, no usage_time', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(1000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(5000) }),
      // no session.end
    ];

    const result = computeStats(events);

    expect(result.sessions['claude-code']).toBe(1);
    expect(result.user_messages['claude-code']).toBe(2);
    // No end boundary → incomplete → no usage_time
    expect(result.usage_time_ms['claude-code']).toBeUndefined();
  });

  it('0 user messages in a session → session counted, 0 usage_time', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('session.end', 'claude-code', { timestamp: ts(3000) }),
    ];

    const result = computeStats(events);

    expect(result.sessions['claude-code']).toBe(1);
    expect(result.user_messages['claude-code']).toBeUndefined();
    expect(result.usage_time_ms['claude-code']).toBeUndefined();
  });

  it('single user message → no usage_time (needs ≥2 for duration)', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(1000) }),
      makeEvent('session.end', 'claude-code', { timestamp: ts(3000) }),
    ];

    const result = computeStats(events);

    expect(result.sessions['claude-code']).toBe(1);
    expect(result.user_messages['claude-code']).toBe(1);
    // Only 1 message → can't compute duration
    expect(result.usage_time_ms['claude-code']).toBeUndefined();
  });

  it('user.message counted per its own tool_source', () => {
    // MCP server has its own tool_source for user.message events —
    // they should be counted under that tool_source, not the session's.
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(1000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(2000) }),
      makeEvent('session.end', 'claude-code', { timestamp: ts(3000) }),
    ];

    const result = computeStats(events);

    expect(result.user_messages['claude-code']).toBe(2);
  });

  it('back-to-back sessions for same tool_source (missing end on first)', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(1000) }),
      // session.start #2 closes #1 implicitly
      makeEvent('session.start', 'claude-code', { timestamp: ts(5000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(6000) }),
      makeEvent('user.message', 'claude-code', { timestamp: ts(7000) }),
      makeEvent('session.end', 'claude-code', { timestamp: ts(10000) }),
    ];

    const result = computeStats(events);

    // Two session.start = 2 sessions
    expect(result.sessions['claude-code']).toBe(2);
    // All 3 user.message counted
    expect(result.user_messages['claude-code']).toBe(3);
  });

  it('unknown tool_source handled gracefully', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', '', { timestamp: ts(0) }),
      makeEvent('user.message', 'unknown', { timestamp: ts(1000) }),
      makeEvent('user.message', 'unknown', { timestamp: ts(2000) }),
      makeEvent('session.end', '', { timestamp: ts(3000) }),
    ];

    const result = computeStats(events);

    // session events use '' as tool_source → key is '' (or 'unknown' if engine default)
    // user.message events use tool_source as-is
    expect(result.user_messages['unknown']).toBe(2);
  });

  it('returns version and last_updated', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
    ];

    const result = computeStats(events);

    expect(result.version).toBe('2.0');
    expect(result.last_updated).toBeTruthy();
    expect(() => new Date(result.last_updated)).not.toThrow();
  });

  it('includes daily buckets in v2.0', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
      makeEvent('tool.complete', 'claude-code', { timestamp: ts(100), payload: { tool_name: 'Read' } }),
    ];

    const result = computeStats(events);
    expect(result.daily).toBeDefined();
    const dates = Object.keys(result.daily!);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('sets last_aggregated_line on full compute', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'claude-code', { timestamp: ts(0) }),
    ];

    const result = computeStats(events);
    expect(result.last_aggregated_line).toBe(1);
  });
});

describe('aggregateDaily', () => {
  it('empty events → empty daily', () => {
    const result = aggregateDaily([]);
    expect(result).toEqual({});
  });

  it('groups events by date', () => {
    const today = new Date().toISOString().slice(0, 10);
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'cc', { timestamp: `${today}T10:00:00.000Z` }),
      makeEvent('tool.complete', 'cc', { timestamp: `${today}T10:01:00.000Z`, payload: { tool_name: 'Read' } }),
      makeEvent('tool.complete', 'cc', { timestamp: `${today}T10:02:00.000Z`, payload: { tool_name: 'Write' } }),
      makeEvent('user.message', 'cc', { timestamp: `${today}T10:03:00.000Z` }),
    ];

    const result = aggregateDaily(events);
    expect(result[today]).toBeDefined();
    expect(result[today]!.sessions).toBe(1);
    expect(result[today]!.tool_calls).toBe(2);
    expect(result[today]!.user_msgs).toBe(1);
    expect(result[today]!.unique_tools).toBe(2);
    expect(result[today]!.tools_used).toContain('Read');
    expect(result[today]!.tools_used).toContain('Write');
  });

  it('counts token.consumed events', () => {
    const today = new Date().toISOString().slice(0, 10);
    const events: TrackedEvent[] = [
      makeEvent('token.consumed', 'cc', {
        timestamp: `${today}T10:00:00.000Z`,
        payload: { amount: 50000 },
      }),
      makeEvent('token.consumed', 'cc', {
        timestamp: `${today}T10:01:00.000Z`,
        payload: { amount: 30000 },
      }),
    ];

    const result = aggregateDaily(events);
    expect(result[today]!.tokens).toBe(80000);
  });

  it('deduplicates tools via tools_used array', () => {
    const today = new Date().toISOString().slice(0, 10);
    const events: TrackedEvent[] = [
      makeEvent('tool.complete', 'cc', { timestamp: `${today}T10:00:00.000Z`, payload: { tool_name: 'Read' } }),
      makeEvent('tool.complete', 'cc', { timestamp: `${today}T10:01:00.000Z`, payload: { tool_name: 'Read' } }),
      makeEvent('tool.complete', 'cc', { timestamp: `${today}T10:02:00.000Z`, payload: { tool_name: 'Read' } }),
    ];

    const result = aggregateDaily(events);
    expect(result[today]!.tool_calls).toBe(3);
    expect(result[today]!.unique_tools).toBe(1);
  });

  it('accumulates duration_secs from tool.complete', () => {
    const today = new Date().toISOString().slice(0, 10);
    const events: TrackedEvent[] = [
      makeEvent('tool.complete', 'cc', {
        timestamp: `${today}T10:00:00.000Z`,
        payload: { tool_name: 'Read', duration_ms: 1500 },
      }),
      makeEvent('tool.complete', 'cc', {
        timestamp: `${today}T10:01:00.000Z`,
        payload: { tool_name: 'Write', duration_ms: 2300 },
      }),
    ];

    const result = aggregateDaily(events);
    expect(result[today]!.duration_secs).toBe(4); // round(1500/1000) + round(2300/1000) = 2 + 2 = 4
  });
});

describe('mergeDaily', () => {
  it('merges two disjoint daily records', () => {
    const a = { '2026-06-01': { tool_calls: 5, sessions: 2, user_msgs: 10, tokens: 1000, unique_tools: 3, duration_secs: 60, tools_used: ['Read', 'Write'] } };
    const b = { '2026-06-02': { tool_calls: 3, sessions: 1, user_msgs: 5, tokens: 500, unique_tools: 2, duration_secs: 30, tools_used: ['Read'] } };

    const result = mergeDaily(a, b);
    expect(Object.keys(result).length).toBe(2);
  });

  it('merges same-date buckets with union of tools', () => {
    const a = { '2026-06-01': { tool_calls: 5, sessions: 2, user_msgs: 10, tokens: 1000, unique_tools: 2, duration_secs: 60, tools_used: ['Read', 'Write'] } };
    const b = { '2026-06-01': { tool_calls: 3, sessions: 1, user_msgs: 5, tokens: 500, unique_tools: 2, duration_secs: 30, tools_used: ['Read', 'Edit'] } };

    const result = mergeDaily(a, b);
    expect(result['2026-06-01']!.tool_calls).toBe(8);
    expect(result['2026-06-01']!.sessions).toBe(3);
    expect(result['2026-06-01']!.user_msgs).toBe(15);
    expect(result['2026-06-01']!.tokens).toBe(1500);
    expect(result['2026-06-01']!.unique_tools).toBe(3); // Read, Write, Edit
    expect(result['2026-06-01']!.duration_secs).toBe(90);
  });
});

describe('computeStats incremental', () => {
  it('incremental mode only processes new events', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'cc', { timestamp: ts(0) }),
      makeEvent('session.start', 'cc', { timestamp: ts(1000) }),
    ];

    // First full compute
    const first = computeStats(events);
    expect(first.last_aggregated_line).toBe(2);

    // Incremental: no new events
    const second = computeStats(events, first);
    expect(second.last_aggregated_line).toBe(2);
    expect(second.daily).toBeDefined();
  });

  it('falls back to full recompute when events truncated', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start', 'cc', { timestamp: ts(0) }),
    ];

    const existing: AgentToolStats = {
      version: '2.0',
      last_updated: new Date().toISOString(),
      sessions: {},
      user_messages: {},
      usage_time_ms: {},
      last_aggregated_line: 100, // Future line that no longer exists
    };

    const result = computeStats(events, existing);
    expect(result.last_aggregated_line).toBe(1); // Reset to current length
  });
});
