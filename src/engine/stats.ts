import type { TrackedEvent } from './types.js';

export interface AgentToolStats {
  version: '1.0';
  last_updated: string;
  sessions: Record<string, number>;
  user_messages: Record<string, number>;
  usage_time_ms: Record<string, number>;
}

/**
 * Compute per-Agent-tool usage statistics from event.log events.
 *
 * Strategy: use session.start/end timestamp pairs as windows.
 * For each session, find user.message events within [start, end]
 * and compute count + duration (last message − first message).
 *
 * Groups everything by the event's `tool_source` field.
 */
export function computeStats(events: TrackedEvent[]): AgentToolStats {
  const sessions: Record<string, number> = {};
  const user_messages: Record<string, number> = {};
  const usage_time_ms: Record<string, number> = {};

  // Collect all session (start, end) windows, grouped by tool_source
  // Walk events chronologically; each session.start opens a window,
  // next session.end (same tool_source) closes it.
  interface SessionWindow {
    toolSource: string;
    start: string; // ISO timestamp
    end: string | null; // null if no session.end seen yet
  }

  const windows: SessionWindow[] = [];
  const openWindows: Map<string, SessionWindow> = new Map(); // tool_source → window

  for (const e of events) {
    const ts = e.tool_source || 'unknown';

    // Count session starts
    if (e.event_type === 'session.start') {
      if (!sessions[ts]) sessions[ts] = 0;
      sessions[ts]++;

      // Start a new window. If an earlier window for the same tool_source
      // is still open (missing session.end), close it first as best-effort.
      const prev = openWindows.get(ts);
      if (prev) {
        prev.end = e.timestamp;
        windows.push(prev);
      }
      openWindows.set(ts, { toolSource: ts, start: e.timestamp, end: null });
    }

    // Close the latest open window for this tool_source
    if (e.event_type === 'session.end') {
      const open = openWindows.get(ts);
      if (open) {
        open.end = e.timestamp;
        windows.push(open);
        openWindows.delete(ts);
      }
    }
  }

  // Flush any remaining open windows (missing session.end) — mark end as null
  for (const open of openWindows.values()) {
    if (open.end === null) {
      // Try to use the last user.message timestamp as end if available
      windows.push(open);
    }
  }
  openWindows.clear();

  // Now count user.message events per tool_source, and compute usage_time per window
  // user.message events are tracked by their own tool_source (MCP channel B)
  for (const e of events) {
    if (e.event_type !== 'user.message') continue;
    const ts = e.tool_source || 'unknown';
    if (!user_messages[ts]) user_messages[ts] = 0;
    user_messages[ts]++;
  }

  // Compute usage_time: for each closed window, find user.message events
  // whose timestamp falls within [window.start, window.end]
  for (const window of windows) {
    if (window.end === null) continue; // skip incomplete sessions

    const msgsInWindow: string[] = [];
    for (const e of events) {
      if (e.event_type !== 'user.message') continue;
      if (e.timestamp >= window.start && e.timestamp <= window.end) {
        msgsInWindow.push(e.timestamp);
      }
    }

    // Need ≥2 messages to compute a meaningful duration
    if (msgsInWindow.length >= 2) {
      const sorted = msgsInWindow.sort();
      const first = new Date(sorted[0]!).getTime();
      const last = new Date(sorted[sorted.length - 1]!).getTime();
      const duration = last - first;

      if (!usage_time_ms[window.toolSource]) usage_time_ms[window.toolSource] = 0;
      usage_time_ms[window.toolSource]! += duration;
    }
  }

  return {
    version: '1.0',
    last_updated: new Date().toISOString(),
    sessions,
    user_messages,
    usage_time_ms,
  };
}
