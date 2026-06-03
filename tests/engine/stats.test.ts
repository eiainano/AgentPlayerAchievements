import { describe, it, expect } from 'vitest';
import { computeStats } from '../../src/engine/stats.js';
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

    expect(result.version).toBe('1.0');
    expect(result.last_updated).toBeTruthy();
    expect(() => new Date(result.last_updated)).not.toThrow();
  });
});
