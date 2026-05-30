import * as fs from 'fs';
import * as path from 'path';
import type { TrackedEvent, Condition, EvaluationResult } from './types.js';
import type { ConditionOperator } from './types.js';

function parseWindow(w: string): number {
  if (w === 'all' || w === 'lifetime') return Infinity;
  const m = /(\d+)\s*(h|d|m)/.exec(w);
  if (!m) return 86400000;
  const nStr = m[1];
  const unit = m[2];
  if (!nStr || !unit) return 86400000;
  const n = Number(nStr);
  switch (unit) {
    case 'h': return n * 3600000;
    case 'd': return n * 86400000;
    case 'm': return n * 60000;
    default: return 86400000;
  }
}

function matchFilter(event: TrackedEvent, filter: string): boolean {
  const ctx: Record<string, string | boolean | number> = {
    event_type: event.event_type,
    tool_name: event.payload?.tool_name || '',
    file_type: event.payload?.file_type || '',
    command: event.payload?.command || '',
    file_path: event.payload?.file_path || '',
    agent_involved: event.payload?.agent_involved || false,
    manual_edits: event.payload?.manual_edits || 0,
    issues_found: event.payload?.issues_found || 0,
  };
  try {
    return evalFilter(filter, ctx);
  } catch {
    return true; // unparseable filters pass (graceful fallback)
  }
}

/** Split string by operator (&& or ||), respecting single-quoted string literals */
function splitByOp(expr: string, op: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === "'") depth = depth ? 0 : 1;
    if (depth === 0 && expr.slice(i, i + 2) === op && expr[i - 1] !== op[0]) {
      parts.push(current.trim());
      current = '';
      i += 2;
      continue;
    }
    current += expr[i];
    i++;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function evalFilter(expr: string, ctx: Record<string, string | boolean | number>): boolean {
  const orParts = splitByOp(expr, '||');
  if (orParts.length > 1) return orParts.some(p => evalFilter(p, ctx));

  const andParts = splitByOp(expr, '&&');
  if (andParts.length > 1) return andParts.every(p => evalFilter(p, ctx));

  return evalPredicate(expr.trim(), ctx);
}

function globMatch(pattern: string, text: string): boolean {
  // Handle {a,b} alternation
  const braceM = pattern.match(/^(.+)\\{([^}]+)\\}(.*)$/);
  if (braceM) {
    const prefix = braceM[1]!;
    const alts = braceM[2]!.split(',');
    const suffix = braceM[3]!;
    return alts.some(alt => globMatch(prefix + alt + suffix, text));
  }
  // Convert glob to regex: * → .*, ? → .
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(text);
}

function evalPredicate(expr: string, ctx: Record<string, string | boolean | number>): boolean {
  // field == value
  let m = expr.match(/^(\w+)\s*==\s*(.+)$/);
  if (m) return ctxValue(ctx, m[1]!) === parseRhs(m[2]!);

  // field != value
  m = expr.match(/^(\w+)\s*!=\s*(.+)$/);
  if (m) return ctxValue(ctx, m[1]!) !== parseRhs(m[2]!);

  // field in [v1, v2, ...]
  m = expr.match(/^(\w+)\s+in\s+\[(.+)\]$/);
  if (m) {
    const field = ctxValue(ctx, m[1]!);
    const list = m[2]!.split(',').map(s => parseRhs(s.trim()));
    return list.includes(field);
  }

  // field matches 'glob'
  m = expr.match(/^(\w+)\s+matches\s+'(.+)'$/);
  if (m) return globMatch(m[2]!, String(ctxValue(ctx, m[1]!)));

  // field contains 'substring'
  m = expr.match(/^(\w+)\s+contains\s+'(.+)'$/);
  if (m) return String(ctxValue(ctx, m[1]!)).includes(m[2]!);

  // Legacy: bare "contains 'X'" → check all string fields
  m = expr.match(/^contains\s+'(.+)'$/);
  if (m) {
    const needle = m[1]!;
    for (const val of Object.values(ctx)) {
      if (typeof val === 'string' && val.includes(needle)) return true;
    }
    return false;
  }

  return true; // unparseable → pass
}

function parseRhs(raw: string): string | boolean | number {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  const num = Number(trimmed);
  return isNaN(num) ? trimmed : num;
}

function ctxValue(ctx: Record<string, string | boolean | number>, field: string): string | boolean | number {
  return ctx[field] ?? '';
}

function getField(event: TrackedEvent, field: string): string {
  return String(event.payload?.[field] || '');
}

function matchRole(event: TrackedEvent, role?: string): boolean {
  if (!role) return true;
  return event.payload?.role === role;
}

function isSessionWindow(cond: Condition): boolean {
  return cond.window === 'single_session' || cond.window === 'same_session';
}

function isTaskWindow(cond: Condition): boolean {
  return cond.window === 'single_task' || cond.window === 'same_task';
}

/** Return latest session_id from events, or null */
function latestSessionId(events: TrackedEvent[]): string | null {
  if (events.length === 0) return null;
  return events[events.length - 1]!.context?.session_id || null;
}

/** Filter events to the scoped session/task, return subset */
function scopeEvents(events: TrackedEvent[], cond: Condition): TrackedEvent[] {
  if (isTaskWindow(cond)) {
    // Use task.complete events as boundaries to infer task grouping
    const boundaries: number[] = [];
    for (let i = 0; i < events.length; i++) {
      if (events[i]!.event_type === 'task.complete') boundaries.push(i);
    }
    if (boundaries.length === 0) return events; // no task boundary yet
    const lastIdx = boundaries[boundaries.length - 1]!;
    const prevIdx = boundaries.length >= 2 ? boundaries[boundaries.length - 2]! : -1;
    return events.slice(prevIdx + 1, lastIdx + 1);
  }
  if (isSessionWindow(cond)) {
    const sid = latestSessionId(events);
    if (!sid) return events;
    return events.filter(e => e.context?.session_id === sid);
  }
  return events;
}

function evalCounter(events: TrackedEvent[], cond: Condition): EvaluationResult {
  events = scopeEvents(events, cond);
  const sessionWindow = isSessionWindow(cond);
  const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
  const now = Date.now();
  const target = cond.value;
  const op: ConditionOperator = cond.operator || '>=';

  // same_target = true: find max count for any single field value
  if (cond.same_target && cond.field) {
    const fieldCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type !== cond.event) continue;
      if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
      if (cond.filter && !matchFilter(e, cond.filter)) continue;
      if (!matchRole(e, cond.role)) continue;
      const val = getField(e, cond.field);
      if (!val) continue;
      fieldCounts[val] = (fieldCounts[val] || 0) + 1;
    }
    let maxCount = 0;
    for (const v of Object.values(fieldCounts)) {
      if (v > maxCount) maxCount = v;
    }
    return {
      met: evalOp(op, maxCount, target),
      progress: maxCount,
      target,
    };
  }

  let count = 0;
  for (const e of events) {
    if (e.event_type !== cond.event) continue;
    if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
    if (cond.filter && !matchFilter(e, cond.filter)) continue;
    if (!matchRole(e, cond.role)) continue;
    count++;
  }
  return { met: evalOp(op, count, target), progress: count, target };
}

function evalThreshold(events: TrackedEvent[], cond: Condition): EvaluationResult {
  events = scopeEvents(events, cond);
  // Handle metric-based threshold (e.g. "edit_lines / total_file_lines")
  if (cond.metric) {
    const sessionWindow = isSessionWindow(cond);
    const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
    const now = Date.now();
    const filtered = events.filter(e => {
      if (cond.event && e.event_type !== cond.event) return false;
      if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) return false;
      if (cond.filter && !matchFilter(e, cond.filter)) return false;
      if (!matchRole(e, cond.role)) return false;
      return true;
    });
    const val = evaluateMetric(cond.metric, filtered);
    if (val === null) return { met: false, progress: 0, target: cond.value };
    const op: ConditionOperator = cond.operator || '>=';
    return { met: evalOp(op, val, cond.value), progress: Math.round(val * 1000) / 1000, target: cond.value };
  }

  // max_per_day: check that no single day exceeds the limit
  if (cond.max_per_day != null) {
    const sessionWindow = isSessionWindow(cond);
    const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
    const now = Date.now();
    const perDay: Record<string, number> = {};
    for (const e of events) {
      if (cond.event && e.event_type !== cond.event) continue;
      if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
      if (cond.filter && !matchFilter(e, cond.filter)) continue;
      if (!matchRole(e, cond.role)) continue;
      const day = e.timestamp.slice(0, 10);
      perDay[day] = (perDay[day] || 0) + 1;
    }
    let maxCount = 0;
    let activeDays = 0;
    for (const v of Object.values(perDay)) {
      if (v > maxCount) maxCount = v;
      activeDays++;
    }
    const op: ConditionOperator = cond.operator || '<=';
    return { met: evalOp(op, maxCount, cond.max_per_day), progress: maxCount, target: cond.max_per_day };
  }

  // Standard threshold: sum field values across matching events
  const sessionWindow = isSessionWindow(cond);
  const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
  const now = Date.now();
  const target = cond.value;
  const op: ConditionOperator = cond.operator || '>=';
  let sum = 0;
  for (const e of events) {
    if (cond.event && e.event_type !== cond.event) continue;
    if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
    if (cond.filter && !matchFilter(e, cond.filter)) continue;
    if (!matchRole(e, cond.role)) continue;
    if (cond.field) {
      sum += Number(e.payload?.[cond.field]) || 0;
    } else {
      sum += 1;
    }
  }
  return { met: evalOp(op, sum, target), progress: Math.round(sum), target };
}

function evaluateMetric(expr: string, events: TrackedEvent[]): number | null {
  // Support simple expressions like "edit_lines / total_file_lines"
  const parts = expr.split('/');
  if (parts.length === 2) {
    const numField = parts[0]!.trim();
    const denField = parts[1]!.trim();
    let numerator = 0;
    let denominator = 0;
    for (const e of events) {
      numerator += Number(e.payload?.[numField]) || 0;
      denominator += Number(e.payload?.[denField]) || 0;
    }
    return denominator > 0 ? numerator / denominator : null;
  }
  // Single field: average
  let sum = 0;
  let count = 0;
  for (const e of events) {
    const v = Number(e.payload?.[expr.trim()]);
    if (!isNaN(v)) { sum += v; count++; }
  }
  return count > 0 ? sum / count : null;
}

function evalOp(op: ConditionOperator, actual: number, target: number): boolean {
  switch (op) {
    case '>=': return actual >= target;
    case '<=': return actual <= target;
    case '==': return actual === target;
    case '>':  return actual > target;
    case '<':  return actual < target;
    default:   return actual >= target;
  }
}

function evalStreak(events: TrackedEvent[], cond: Condition): EvaluationResult {
  events = scopeEvents(events, cond);
  const sessionWindow = isSessionWindow(cond);
  const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
  const now = Date.now();

  const days = new Set<string>();
  for (const e of events) {
    if (e.event_type !== cond.event) continue;
    if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
    if (cond.filter && !matchFilter(e, cond.filter)) continue;
    if (!matchRole(e, cond.role)) continue;
    if (cond.field && !getField(e, cond.field)) continue;
    days.add(e.timestamp.slice(0, 10));
  }

  if (cond.same_target && cond.field) {
    // Find max streak for any single field value
    const byTarget: Record<string, Set<string>> = {};
    for (const e of events) {
      if (e.event_type !== cond.event) continue;
      if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
      if (cond.filter && !matchFilter(e, cond.filter)) continue;
      if (!matchRole(e, cond.role)) continue;
      const val = getField(e, cond.field);
      if (!val) continue;
      if (!byTarget[val]) byTarget[val] = new Set();
      byTarget[val]!.add(e.timestamp.slice(0, 10));
    }
    let maxStreak = 0;
    for (const targetDays of Object.values(byTarget)) {
      const sorted = [...targetDays].sort().reverse();
      let streak = 1;
      for (let i = 0; i < sorted.length - 1; i++) {
        const d1 = new Date(sorted[i]!);
        const d2 = new Date(sorted[i + 1]!);
        if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) streak++;
        else break;
      }
      if (streak > maxStreak) maxStreak = streak;
    }
    const target = cond.value;
    const op: ConditionOperator = cond.operator || '>=';
    return { met: evalOp(op, maxStreak, target), progress: maxStreak, target };
  }

  const sorted = [...days].sort().reverse();
  if (sorted.length === 0) return { met: false, progress: 0, target: cond.value };

  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = new Date(sorted[i]!);
    const d2 = new Date(sorted[i + 1]!);
    if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) streak++;
    else break;
  }
  const target = cond.value;
  const op: ConditionOperator = cond.operator || '>=';
  return { met: evalOp(op, streak, target), progress: streak, target };
}

function evalSequence(events: TrackedEvent[], cond: Condition): EvaluationResult {
  events = scopeEvents(events, cond);
  // consecutive mode: count longest run of matching events without gaps
  if (cond.consecutive) {
    const sessionWindow = isSessionWindow(cond);
    const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
    const now = Date.now();
    const target = cond.count?.value ?? cond.value;
    const op: ConditionOperator = cond.count?.operator ?? cond.operator ?? '>=';

    let maxConsecutive = 0;
    let currentRun = 0;
    for (const e of events) {
      if (e.event_type !== cond.event) { currentRun = 0; continue; }
      if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) { currentRun = 0; continue; }
      if (cond.filter && !matchFilter(e, cond.filter)) { currentRun = 0; continue; }
      currentRun++;
      if (currentRun > maxConsecutive) maxConsecutive = currentRun;
    }
    return { met: evalOp(op, maxConsecutive, target), progress: maxConsecutive, target };
  }

  // Standard ordered sequence mode
  const seq = cond.sequence || [];
  if (seq.length === 0) return { met: false, progress: 0, target: 0 };
  const seqSessionWindow = isSessionWindow(cond);
  const seqWindowMs = seqSessionWindow ? 0 : parseWindow(cond.window || '24h');
  const seqNow = Date.now();
  let si = 0;
  for (const e of events) {
    if (si >= seq.length) break;
    if (!seqSessionWindow && cond.window && seqNow - new Date(e.timestamp).getTime() > seqWindowMs) continue;
    if (e.event_type === seq[si]) si++;
  }
  return { met: si >= seq.length, progress: si, target: seq.length };
}

function evalDistinctCount(events: TrackedEvent[], cond: Condition): EvaluationResult {
  events = scopeEvents(events, cond);
  const sessionWindow = isSessionWindow(cond);
  const windowMs = sessionWindow ? 0 : parseWindow(cond.window || '24h');
  const now = Date.now();
  const whitelist: Set<string> | null = cond.values ? new Set(cond.values) : null;

  const values = new Set<string>();
  for (const e of events) {
    if (e.event_type !== cond.event) continue;
    if (!sessionWindow && now - new Date(e.timestamp).getTime() > windowMs) continue;
    const val = cond.field ? getField(e, cond.field) : null;
    if (!val) continue;
    if (whitelist && !whitelist.has(val)) continue;
    values.add(val);
  }
  const target = cond.value;
  return { met: values.size >= target, progress: values.size, target };
}

function evalEvent(events: TrackedEvent[], cond: Condition): EvaluationResult {
  for (const e of events) {
    if (e.event_type === cond.event) return { met: true, progress: 1, target: 1 };
  }
  return { met: false, progress: 0, target: 1 };
}

// ── Set completion ──────────────────────────────────────────────────

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function evalSetCompletion(
  cond: Condition,
  definitions: Array<{ id: string; rarity: string; hidden?: boolean }>,
  unlocked: Record<string, string>,
  selfId: string,
): EvaluationResult {
  let eligible: Array<{ id: string; rarity: string; hidden?: boolean }>;

  if (cond.all) {
    // All achievements, including hidden
    eligible = definitions.filter(d => d.id !== selfId);
  } else if (cond.exclude_hidden) {
    // All non-hidden achievements
    eligible = definitions.filter(d => d.id !== selfId && !d.hidden);
  } else {
    const targetRarity = cond.rarity || 'common';
    const startIdx = RARITY_ORDER.indexOf(targetRarity);
    eligible = definitions.filter(d => {
      if (d.id === selfId) return false;
      if (!cond.include_above) return d.rarity === targetRarity;
      return RARITY_ORDER.indexOf(d.rarity) >= startIdx;
    });
  }

  const total = eligible.length;
  const completed = eligible.filter(d => unlocked[d.id]).length;
  return { met: total > 0 && completed >= total, progress: completed, target: total };
}

// ── Mode ────────────────────────────────────────────────────────────

function evalMode(events: TrackedEvent[], cond: Condition): EvaluationResult {
  const freq: Record<string, number> = {};
  let total = 0;

  for (const e of events) {
    if (cond.event && e.event_type !== cond.event) continue;
    const val = cond.field ? String(e.payload?.[cond.field] ?? '') : '';
    if (!val) continue;
    freq[val] = (freq[val] || 0) + 1;
    total++;
  }

  if (total === 0) return { met: false, progress: 0, target: Math.round((cond.threshold ?? cond.value) * 100) };

  let modeVal = '';
  let modeCount = 0;
  for (const [k, v] of Object.entries(freq)) {
    if (v > modeCount) { modeVal = k; modeCount = v; }
  }

  const modeNum = Number(modeVal);
  const fraction = modeCount / total;
  const threshold = cond.threshold ?? 0;

  const inRange = !cond.in_range || (modeNum >= cond.in_range[0]! && modeNum <= cond.in_range[1]!);
  const met = fraction >= threshold && inRange;

  return { met, progress: Math.round(fraction * 100), target: Math.round(threshold * 100) };
}

// ── Sequence count ──────────────────────────────────────────────────

function evalSequenceCount(events: TrackedEvent[], cond: Condition): EvaluationResult {
  const pattern = Array.isArray(cond.pattern) ? cond.pattern as string[] : null;
  if (!pattern || pattern.length === 0) return { met: false, progress: 0, target: cond.value };

  let count = 0;
  let pi = 0;
  for (const e of events) {
    if (e.event_type === pattern[pi]) {
      pi++;
      if (pi >= pattern.length) { count++; pi = 0; }
    } else {
      pi = 0;
    }
  }

  const target = cond.value;
  const op = cond.operator || '>=';
  const met = op === '>='
    ? count >= target
    : op === '<='
      ? count <= target
      : op === '=='
        ? count === target
        : op === '>'
          ? count > target
          : count < target;
  return { met, progress: count, target };
}

// ── Pattern match ───────────────────────────────────────────────────

function evalPatternMatch(events: TrackedEvent[], cond: Condition): EvaluationResult {
  const regexSrc = typeof cond.pattern === 'string' ? cond.pattern : null;
  if (!regexSrc) return { met: false, progress: 0, target: 1 };

  let regex: RegExp;
  try { regex = new RegExp(regexSrc, 'i'); } catch { return { met: false, progress: 0, target: 1 }; }

  for (const e of events) {
    if (cond.event && e.event_type !== cond.event) continue;
    if (cond.role && e.payload?.role !== cond.role) continue;

    // Check all payload string values against regex
    for (const val of Object.values(e.payload || {})) {
      if (typeof val === 'string' && regex.test(val)) {
        return { met: true, progress: 1, target: 1 };
      }
    }
  }

  return { met: false, progress: 0, target: 1 };
}

// ── Ratio ───────────────────────────────────────────────────────────

function evalRatio(events: TrackedEvent[], cond: Condition): EvaluationResult {
  const numField = typeof cond.numerator === 'string' ? cond.numerator : null;
  const denField = typeof cond.denominator === 'string' ? cond.denominator : null;
  if (!numField || !denField) return { met: false, progress: 0, target: cond.value };

  let numerator = 0;
  let denominator = 0;
  for (const e of events) {
    if (cond.event && e.event_type !== cond.event) continue;
    numerator += Number(e.payload?.[numField]) || 0;
    denominator += Number(e.payload?.[denField]) || 0;
  }

  if (denominator === 0) return { met: false, progress: 0, target: cond.value };

  const ratio = numerator / denominator;
  const target = cond.value;
  const op = cond.operator || '>=';
  const met = op === '>='
    ? ratio >= target
    : op === '<='
      ? ratio <= target
      : op === '>'
        ? ratio > target
        : op === '<'
          ? ratio < target
          : ratio === target;

  return { met, progress: Math.round(ratio * 100), target: Math.round(target * 100) };
}

// ── Percentile ──────────────────────────────────────────────────────

const AGPA_STATE_DIR = path.join(process.env.HOME || '~', '.agent-achievements');

const FALLBACK_THRESHOLDS: Record<string, Record<number, number>> = {
  avg_prompt_length: { 10: 80, 90: 600 },
};

function computeMetric(events: TrackedEvent[], metric: string): number | null {
  switch (metric) {
    case 'avg_prompt_length': {
      const lengths = events
        .filter(e => e.event_type === 'conversation.message' || e.event_type === 'user.prompt')
        .map(e => Number(e.payload?.length))
        .filter(n => n > 0);
      if (lengths.length === 0) return null;
      return lengths.reduce((a, b) => a + b, 0) / lengths.length;
    }
    case 'showcase_count': {
      const p = path.join(AGPA_STATE_DIR, 'showcase.json');
      try {
        if (fs.existsSync(p)) {
          const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
          return (data.slots as Array<string | null>).filter(s => s !== null).length;
        }
      } catch { /* ignore */ }
      return 0;
    }
    case 'concurrent_sessions': {
      // Count unique session_ids in events from the last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const sids = new Set<string>();
      for (const e of events) {
        if (new Date(e.timestamp).getTime() > oneHourAgo && e.context?.session_id) {
          sids.add(e.context.session_id);
        }
      }
      return sids.size;
    }
    default:
      return null;
  }
}

function evalPercentile(events: TrackedEvent[], cond: Condition): EvaluationResult {
  const metric = cond.metric;
  if (!metric) return { met: false, progress: 0, target: cond.value };

  const localValue = computeMetric(events, metric);
  if (localValue === null) return { met: false, progress: 0, target: cond.value };

  const targetPct = cond.value; // e.g. 10 (p10) or 90 (p90)
  const pctKey = `p${targetPct}`;

  // Try cached thresholds from telemetry server
  let threshold: number | null = null;
  try {
    const cachePath = path.join(AGPA_STATE_DIR, 'thresholds.json');
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      threshold = cache.thresholds?.[metric]?.[pctKey] ?? null;
    }
  } catch { /* ignore */ }

  // Fallback to hardcoded thresholds
  if (threshold === null) {
    threshold = FALLBACK_THRESHOLDS[metric]?.[targetPct] ?? null;
  }
  if (threshold === null) return { met: false, progress: Math.round(localValue), target: cond.value };

  const operator = cond.operator || '>=';
  const met = operator === '>='
    ? localValue >= threshold
    : operator === '<='
      ? localValue <= threshold
      : localValue === threshold;

  return { met, progress: Math.round(localValue), target: Math.round(threshold) };
}

// ── Dispatcher ──────────────────────────────────────────────────────

export function evaluateCondition(cond: Condition, events: TrackedEvent[]): EvaluationResult {
  switch (cond.type) {
    case 'counter': return evalCounter(events, cond);
    case 'threshold': return evalThreshold(events, cond);
    case 'streak': return evalStreak(events, cond);
    case 'sequence': return evalSequence(events, cond);
    case 'distinct_count': return evalDistinctCount(events, cond);
    case 'event': return evalEvent(events, cond);
    case 'mode': return evalMode(events, cond);
    case 'sequence_count': return evalSequenceCount(events, cond);
    case 'pattern_match': return evalPatternMatch(events, cond);
    case 'ratio': return evalRatio(events, cond);
    case 'percentile': return evalPercentile(events, cond);
    default: return { met: false, progress: 0, target: 0 };
  }
}

export function evaluateAll(
  definitions: Array<{ id: string; rarity?: string; hidden?: boolean; conditions: Condition[] }>,
  events: TrackedEvent[],
  unlocked: Record<string, string>,
): string[] {
  const newlyUnlocked: string[] = [];
  for (const def of definitions) {
    if (unlocked[def.id]) continue;
    if (def.conditions.length === 0) continue; // empty conditions = never unlock

    const allMet = def.conditions.every(c => {
      if (c.type === 'set_completion') {
        return evalSetCompletion(c, definitions as Array<{ id: string; rarity: string; hidden?: boolean }>, unlocked, def.id).met;
      }
      return evaluateCondition(c, events).met;
    });

    if (allMet) newlyUnlocked.push(def.id);
  }
  return newlyUnlocked;
}
