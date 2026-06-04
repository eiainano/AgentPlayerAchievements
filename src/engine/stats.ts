import type { TrackedEvent } from './types.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface DailyBucket {
  tool_calls: number;
  sessions: number;
  user_msgs: number;
  tokens: number;
  unique_tools: number;
  duration_secs: number;
  tools_used: string[];
}

export interface AgentToolStats {
  version: '1.0' | '2.0';
  last_updated: string;
  sessions: Record<string, number>;
  user_messages: Record<string, number>;
  usage_time_ms: Record<string, number>;
  last_aggregated_line?: number;
  daily?: Record<string, DailyBucket>;
}

// ── Internal helpers ─────────────────────────────────────────────────────

interface SessionWindow {
  toolSource: string;
  start: string;
  end: string | null;
}

function computeBaseStats(events: TrackedEvent[]): {
  sessions: Record<string, number>;
  user_messages: Record<string, number>;
  usage_time_ms: Record<string, number>;
} {
  const sessions: Record<string, number> = {};
  const user_messages: Record<string, number> = {};
  const usage_time_ms: Record<string, number> = {};

  const windows: SessionWindow[] = [];
  const openWindows: Map<string, SessionWindow> = new Map();

  for (const e of events) {
    const ts = e.tool_source || 'unknown';

    if (e.event_type === 'session.start') {
      if (!sessions[ts]) sessions[ts] = 0;
      sessions[ts]++;

      const prev = openWindows.get(ts);
      if (prev) {
        prev.end = e.timestamp;
        windows.push(prev);
      }
      openWindows.set(ts, { toolSource: ts, start: e.timestamp, end: null });
    }

    if (e.event_type === 'session.end') {
      const open = openWindows.get(ts);
      if (open) {
        open.end = e.timestamp;
        windows.push(open);
        openWindows.delete(ts);
      }
    }
  }

  for (const open of openWindows.values()) {
    if (open.end === null) {
      windows.push(open);
    }
  }
  openWindows.clear();

  for (const e of events) {
    if (e.event_type !== 'user.message') continue;
    const ts = e.tool_source || 'unknown';
    if (!user_messages[ts]) user_messages[ts] = 0;
    user_messages[ts]++;
  }

  for (const window of windows) {
    if (window.end === null) continue;

    const msgsInWindow: string[] = [];
    for (const e of events) {
      if (e.event_type !== 'user.message') continue;
      if (e.timestamp >= window.start && e.timestamp <= window.end) {
        msgsInWindow.push(e.timestamp);
      }
    }

    if (msgsInWindow.length >= 2) {
      const sorted = msgsInWindow.sort();
      const first = new Date(sorted[0]!).getTime();
      const last = new Date(sorted[sorted.length - 1]!).getTime();
      const duration = last - first;

      if (!usage_time_ms[window.toolSource]) usage_time_ms[window.toolSource] = 0;
      usage_time_ms[window.toolSource]! += duration;
    }
  }

  return { sessions, user_messages, usage_time_ms };
}

// ── P1-3: Daily aggregation ──────────────────────────────────────────────

export function aggregateDaily(events: TrackedEvent[]): Record<string, DailyBucket> {
  const buckets: Record<string, DailyBucket> = {};

  for (const e of events) {
    const date = e.timestamp.slice(0, 10);
    if (!buckets[date]) {
      buckets[date] = {
        tool_calls: 0, sessions: 0, user_msgs: 0,
        tokens: 0, unique_tools: 0, duration_secs: 0,
        tools_used: [],
      };
    }
    const b = buckets[date]!;

    switch (e.event_type) {
      case 'tool.complete':
        b.tool_calls++;
        if (e.payload.tool_name && !b.tools_used.includes(e.payload.tool_name as string)) {
          b.tools_used.push(e.payload.tool_name as string);
        }
        if (typeof e.payload.duration_ms === 'number') {
          b.duration_secs += Math.round((e.payload.duration_ms as number) / 1000);
        }
        break;
      case 'session.start':
        b.sessions++;
        break;
      case 'user.message':
        b.user_msgs++;
        break;
      case 'token.consumed':
        b.tokens += (e.payload.amount as number) || 0;
        break;
    }
  }

  // Post-process: unique_tools = tools_used.length
  for (const b of Object.values(buckets)) {
    b.unique_tools = b.tools_used.length;
  }

  return buckets;
}

export function mergeDaily(
  existing: Record<string, DailyBucket>,
  incoming: Record<string, DailyBucket>,
): Record<string, DailyBucket> {
  const merged: Record<string, DailyBucket> = {};

  // Copy existing
  for (const [date, b] of Object.entries(existing)) {
    merged[date] = { ...b, tools_used: [...b.tools_used] };
  }

  // Merge incoming
  for (const [date, b] of Object.entries(incoming)) {
    if (merged[date]) {
      const e = merged[date]!;
      const toolSet = new Set([...e.tools_used, ...b.tools_used]);
      merged[date] = {
        tool_calls: e.tool_calls + b.tool_calls,
        sessions: e.sessions + b.sessions,
        user_msgs: e.user_msgs + b.user_msgs,
        tokens: e.tokens + b.tokens,
        unique_tools: toolSet.size,
        duration_secs: e.duration_secs + b.duration_secs,
        tools_used: [...toolSet],
      };
    } else {
      merged[date] = { ...b, tools_used: [...b.tools_used] };
    }
  }

  return merged;
}

// ── Main compute function ─────────────────────────────────────────────────

/**
 * Compute per-Agent-tool usage statistics from event.log events.
 *
 * When `existing` is provided (v2.0 or later), uses incremental mode:
 * only processes events after last_aggregated_line and merges daily buckets.
 */
export function computeStats(
  events: TrackedEvent[],
  existing?: AgentToolStats | null,
): AgentToolStats {
  const base = computeBaseStats(events);

  // P1-3: Incremental daily aggregation
  if (existing && existing.last_aggregated_line != null && existing.last_aggregated_line > 0) {
    // Validate: if events were truncated, fall back to full recompute
    if (existing.last_aggregated_line > events.length) {
      // Event log was truncated — full recompute
      const daily = aggregateDaily(events);
      return {
        version: '2.0',
        last_updated: new Date().toISOString(),
        sessions: base.sessions,
        user_messages: base.user_messages,
        usage_time_ms: base.usage_time_ms,
        last_aggregated_line: events.length,
        daily,
      };
    }

    const newEvents = events.slice(existing.last_aggregated_line);
    const newDaily = aggregateDaily(newEvents);
    const existingDaily = existing.daily || {};
    const merged = mergeDaily(existingDaily, newDaily);

    return {
      version: '2.0',
      last_updated: new Date().toISOString(),
      sessions: base.sessions,
      user_messages: base.user_messages,
      usage_time_ms: base.usage_time_ms,
      last_aggregated_line: events.length,
      daily: merged,
    };
  }

  // Full compute (v1.0 legacy or no existing stats)
  const daily = aggregateDaily(events);
  return {
    version: '2.0',
    last_updated: new Date().toISOString(),
    sessions: base.sessions,
    user_messages: base.user_messages,
    usage_time_ms: base.usage_time_ms,
    last_aggregated_line: events.length,
    daily,
  };
}
