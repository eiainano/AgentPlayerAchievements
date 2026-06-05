/**
 * Near-unlock progress calculator.
 * Pure function: takes definitions + events + state, returns sorted NearUnlock[].
 * Non-TTY environments: caller should skip output, but the function itself
 * works regardless — it's pure computation.
 */

import type {
  AchievementDefinition,
  AchievementState,
  Condition,
  TrackedEvent,
} from '../engine/types.js';
import { evaluateMetric, matchFilter } from '../engine/evaluator.js';

// ── Types ──────────────────────────────────────────────────────────

export interface NearUnlock {
  achievement_id: string;
  name: string;
  icon: string;
  rarity: string;
  current: number;
  target: number;
  unit_label: string;
}

// ── Window helpers (replicated from evaluator.ts to keep modules decoupled) ─

function parseWindowMs(w: string): number {
  if (w === 'all' || w === 'lifetime') return Infinity;
  const m = /(\d+)\s*(h|d|m)/.exec(w);
  if (!m) return 86400000; // default 24h
  const n = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 'h': return n * 3600000;
    case 'd': return n * 86400000;
    case 'm': return n * 60000;
    default: return 86400000;
  }
}

function isSessionWindow(cond: Condition): boolean {
  return cond.window === 'single_session' || cond.window === 'same_session';
}

/** Get events scoped to the condition's window (simplified — no task boundaries) */
function windowFilter(events: TrackedEvent[], cond: Condition): TrackedEvent[] {
  if (!cond.window || cond.window === 'all' || cond.window === 'lifetime') return events;
  if (isSessionWindow(cond)) {
    const lastSid = events.length > 0 ? events[events.length - 1]!.context?.session_id : null;
    if (!lastSid) return [];
    return events.filter(e => e.context?.session_id === lastSid);
  }
  const windowMs = parseWindowMs(cond.window);
  if (windowMs === Infinity) return events;
  const now = Date.now();
  return events.filter(e => now - new Date(e.timestamp).getTime() <= windowMs);
}

/**
 * Filter events by window + event type + filter expression.
 * Mirrors the evaluator's event scoping logic.
 */
function scopedEvents(events: TrackedEvent[], cond: Condition): TrackedEvent[] {
  const scoped = windowFilter(events, cond);
  return scoped.filter(e => {
    if (cond.event && e.event_type !== cond.event) return false;
    if (cond.filter) {
      try { return matchFilter(e, cond.filter); } catch { return true; }
    }
    return true;
  });
}

function eventTypeLabel(eventType: string): string {
  const map: Record<string, string> = {
    'session.start': 'sessions',
    'session.end': 'sessions',
    'task.complete': 'tasks',
    'tool.complete': 'tool uses',
    'user.message': 'messages',
    'user.prompt': 'prompts',
    'agent.spawn': 'agents',
    'skill.invoke': 'skills',
    'mcp.connect': 'connections',
    'command.run': 'commands',
  };
  return map[eventType] || 'events';
}

// ── Per-type progress calculators ───────────────────────────────────

function counterProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = scopedEvents(events, cond);
  if (cond.same_target && cond.field) {
    const fieldCounts: Record<string, number> = {};
    for (const e of scoped) {
      const val = String(e.payload?.[cond.field] ?? '');
      if (!val) continue;
      fieldCounts[val] = (fieldCounts[val] || 0) + 1;
    }
    let max = 0;
    for (const v of Object.values(fieldCounts)) if (v > max) max = v;
    return max;
  }
  return scoped.length;
}

function thresholdProgress(events: TrackedEvent[], cond: Condition): number | null {
  if (!cond.metric) return null;
  const scoped = scopedEvents(events, cond);
  const val = evaluateMetric(cond.metric, scoped);
  return val !== null ? Math.round(val * 1000) / 1000 : null;
}

function streakProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = scopedEvents(events, cond);
  const days = new Set<string>();
  for (const e of scoped) {
    days.add(e.timestamp.slice(0, 10));
  }
  // Count consecutive days ending today
  if (days.size === 0) return 0;
  const sorted = [...days].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let expected = today;
  for (const day of sorted) {
    if (day === expected) {
      streak++;
      // Decrement expected by 1 day
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else if (streak === 0 && day < today) {
      // Today might not have events yet — start from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = yesterday.toISOString().slice(0, 10);
      if (day === yestStr) {
        streak++;
        expected = yestStr;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
        continue;
      }
      break;
    } else {
      break;
    }
  }
  return streak;
}

function distinctCountProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = scopedEvents(events, cond);
  const whitelist: Set<string> | null = cond.values ? new Set(cond.values) : null;
  const values = new Set<string>();
  for (const e of scoped) {
    const val = cond.field ? String(e.payload?.[cond.field] ?? '') : '';
    if (!val) continue;
    if (whitelist && !whitelist.has(val)) continue;
    values.add(val);
  }
  return values.size;
}

function sequenceCountProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = scopedEvents(events, cond);
  const pattern = Array.isArray(cond.pattern) ? (cond.pattern as string[]) : null;
  if (!pattern || pattern.length === 0) return 0;
  let count = 0;
  let pi = 0;
  for (const e of scoped) {
    if (e.event_type === pattern[pi]) {
      pi++;
      if (pi >= pattern.length) { count++; pi = 0; }
    } else {
      pi = 0;
    }
  }
  return count;
}

// ── Main calculator ────────────────────────────────────────────────

/**
 * Find achievements that are close to unlocking.
 *
 * For each locked achievement, compute current progress vs. target.
 * Filter by supported types, minProgress threshold, and hidden status.
 * Return top N sorted by completion percentage descending.
 */
export function findNearUnlocks(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
  options?: { maxResults?: number; minProgress?: number },
): NearUnlock[] {
  const maxResults = options?.maxResults ?? 3;
  const minProgress = options?.minProgress ?? 0.2;

  const results: NearUnlock[] = [];

  for (const def of definitions) {
    // Skip already unlocked
    if (state.unlocked[def.id]) continue;

    // Skip hidden (don't spoil easter eggs)
    if (def.hidden) continue;

    // Skip future/unreachable
    if (def.future) continue;

    const cond = def.conditions[0];
    if (!cond) continue;

    let current = 0;
    let target = cond.value;
    let unitLabel = '';

    switch (cond.type) {
      case 'counter': {
        current = counterProgress(events, cond);
        unitLabel = cond.unit || eventTypeLabel(cond.event || '');
        break;
      }
      case 'threshold': {
        if (!cond.metric) continue;
        const val = thresholdProgress(events, cond);
        if (val === null) continue;
        current = val;
        unitLabel = cond.unit || cond.metric;
        break;
      }
      case 'streak': {
        current = streakProgress(events, cond);
        unitLabel = 'days';
        break;
      }
      case 'distinct_count': {
        current = distinctCountProgress(events, cond);
        unitLabel = cond.unit || (cond.field ? cond.field : 'items');
        break;
      }
      case 'sequence_count': {
        current = sequenceCountProgress(events, cond);
        unitLabel = cond.unit || 'cycles';
        break;
      }
      default:
        // sequence, event, mode, pattern_match, ratio — skip
        continue;
    }

    if (target <= 0) continue;
    const ratio = current / target;
    if (ratio < minProgress) continue;

    results.push({
      achievement_id: def.id,
      name: def.name,
      icon: def.icon || '🏆',
      rarity: def.rarity,
      current,
      target,
      unit_label: unitLabel,
    });
  }

  // Sort by completion % descending, then by achievement_id for stability
  results.sort((a, b) => {
    const diff = (b.current / b.target) - (a.current / a.target);
    if (diff !== 0) return diff > 0 ? 1 : -1;
    return a.achievement_id.localeCompare(b.achievement_id);
  });

  return results.slice(0, maxResults);
}
