/**
 * Achievement Explain Layer
 *
 * Pure functions: take definitions + events + state, return structured
 * explanation. Does NOT modify any state, emit events, or affect the
 * evaluation pipeline. Uses evaluator's `evaluateCondition()` for accurate
 * met/progress/target values, then does a separate informational pass to
 * collect exclusion traces.
 */

import type {
  AchievementDefinition,
  AchievementExplanation,
  AchievementState,
  Condition,
  ConditionExplanation,
  ExclusionTrace,
  TrackedEvent,
} from '../engine/types.js';
import { evaluateCondition, matchFilter } from '../engine/evaluator.js';

// ── Window helpers (replicated from evaluator.ts — minimal, intentional) ─

function parseWindowMs(w: string): number {
  if (w === 'all' || w === 'lifetime') return Infinity;
  const m = /(\d+)\s*(h|d|m)/.exec(w);
  if (!m || !m[1] || !m[2]) return 86400000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 'h': return n * 3600000;
    case 'd': return n * 86400000;
    case 'm': return n * 60000;
    default: return 86400000;
  }
}

function windowLabel(raw: string, windowMs: number): string {
  if (raw === 'all' || raw === 'lifetime' || windowMs === Infinity) return 'lifetime (all events)';
  if (raw === 'single_session' || raw === 'same_session') return 'current session';
  if (raw === 'single_task' || raw === 'same_task') return 'current task';
  if (windowMs >= 86400000) return `${windowMs / 86400000}d`;
  if (windowMs >= 3600000) return `${windowMs / 3600000}h`;
  return `${windowMs / 60000}m`;
}

function isSessionWindow(cond: Condition): boolean {
  return cond.window === 'single_session' || cond.window === 'same_session';
}

function isTaskWindow(cond: Condition): boolean {
  return cond.window === 'single_task' || cond.window === 'same_task';
}

function latestSessionId(events: TrackedEvent[]): string | null {
  if (events.length === 0) return null;
  return events[events.length - 1]!.context?.session_id || null;
}

function scopeEvents(events: TrackedEvent[], cond: Condition): TrackedEvent[] {
  if (isTaskWindow(cond)) {
    const boundaries: number[] = [];
    for (let i = 0; i < events.length; i++) {
      if (events[i]!.event_type === 'task.complete') boundaries.push(i);
    }
    if (boundaries.length === 0) {
      const sid = latestSessionId(events);
      if (!sid) return [];
      return events.filter(e => e.context?.session_id === sid);
    }
    const lastIdx = boundaries[boundaries.length - 1]!;
    if (boundaries.length >= 2) {
      const prevIdx = boundaries[boundaries.length - 2]!;
      return events.slice(prevIdx + 1, lastIdx + 1);
    }
    let startIdx = 0;
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (events[i]!.event_type === 'session.start') { startIdx = i; break; }
    }
    return events.slice(startIdx, lastIdx + 1);
  }
  if (isSessionWindow(cond)) {
    const sid = latestSessionId(events);
    if (!sid) return events;
    return events.filter(e => e.context?.session_id === sid);
  }
  return events;
}

function matchRole(event: TrackedEvent, role?: string): boolean {
  if (!role) return true;
  return event.payload?.role === role;
}

function getField(event: TrackedEvent, field: string): string {
  return String(event.payload?.[field] ?? (event as unknown as Record<string, unknown>)[field] ?? '');
}

// ── Window boundary dates ─────────────────────────────────────────

function computeWindowBounds(
  events: TrackedEvent[],
  windowMs: number,
): { start: string; end: string } {
  if (windowMs === Infinity) {
    if (events.length === 0) return { start: '', end: '' };
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return { start: sorted[0]!.timestamp.slice(0, 10), end: sorted[sorted.length - 1]!.timestamp.slice(0, 10) };
  }
  const start = new Date(Date.now() - windowMs).toISOString().slice(0, 10);
  return { start, end: new Date().toISOString().slice(0, 10) };
}

// ── Exclusion trace ──────────────────────────────────────────────

const MAX_EXCLUSIONS = 5;

interface CollectResult {
  matched: TrackedEvent[];
  excluded: ExclusionTrace[];
}

function makeExclusion(
  event: TrackedEvent,
  code: ExclusionTrace['reason_code'],
  cond: Condition,
  windowStart: string,
): ExclusionTrace {
  const en = (() => {
    switch (code) {
      case 'event_type': return `event_type='${event.event_type}', need '${cond.event}'`;
      case 'filter': return `filter not matched: ${cond.filter}`;
      case 'role': return `role='${event.payload?.role || ''}', need '${cond.role}'`;
      case 'window': return `timestamp ${event.timestamp.slice(0, 10)} outside window ≥${windowStart}`;
      case 'field_value': return `field '${cond.field}' missing or empty`;
    }
  })();
  const zh = (() => {
    switch (code) {
      case 'event_type': return `事件类型 '${event.event_type}' ≠ '${cond.event}'`;
      case 'filter': return `不匹配过滤器: ${cond.filter}`;
      case 'role': return `role='${event.payload?.role || ''}' ≠ '${cond.role}'`;
      case 'window': return `时间 ${event.timestamp.slice(0, 10)} 超出窗口 ≥${windowStart}`;
      case 'field_value': return `字段 '${cond.field}' 缺失或为空`;
    }
  })();
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    event_type: event.event_type,
    tool_name: (event.payload?.tool_name as string) || undefined,
    reason_code: code,
    reason: en,
    reason_cn: zh,
  };
}

function collectExclusions(
  events: TrackedEvent[],
  cond: Condition,
  windowMs: number,
  bounds: { start: string },
): CollectResult {
  const matched: TrackedEvent[] = [];
  const excluded: ExclusionTrace[] = [];
  const sessionWindow = isSessionWindow(cond) || isTaskWindow(cond);
  const now = Date.now();

  // sequence / sequence_count match against event_type directly via pattern;
  // they do NOT pre-filter by cond.event
  const skipEventFilter = cond.type === 'sequence' || cond.type === 'sequence_count';

  for (const e of events) {
    // Filter by event_type (skip for pattern-matching types)
    if (!skipEventFilter && cond.event && e.event_type !== cond.event) {
      continue; // don't collect — only trace events of the target type
    }

    // Check time window
    if (!sessionWindow && windowMs !== Infinity) {
      if (now - new Date(e.timestamp).getTime() > windowMs) {
        if (excluded.length < MAX_EXCLUSIONS) {
          excluded.push(makeExclusion(e, 'window', cond, bounds.start));
        }
        continue;
      }
    }

    // Check filter
    if (cond.filter && !matchFilter(e, cond.filter)) {
      if (excluded.length < MAX_EXCLUSIONS) {
        excluded.push(makeExclusion(e, 'filter', cond, bounds.start));
      }
      continue;
    }

    // Check role
    if (!matchRole(e, cond.role)) {
      if (excluded.length < MAX_EXCLUSIONS) {
        excluded.push(makeExclusion(e, 'role', cond, bounds.start));
      }
      continue;
    }

    // Check field value for types that require it.
    // Evaluator skips empty-field events for: distinct_count, mode,
    // counter (same_target), streak (event_level).
    const needsFieldCheck = cond.field && (
      cond.type === 'distinct_count' || cond.type === 'mode' ||
      (cond.type === 'counter' && cond.same_target) ||
      (cond.type === 'streak' && cond.event_level)
    );
    if (needsFieldCheck) {
      const fv = getField(e, cond.field!);
      if (!fv) {
        if (excluded.length < MAX_EXCLUSIONS) {
          excluded.push(makeExclusion(e, 'field_value', cond, bounds.start));
        }
        continue;
      }
      // Check whitelist
      if (cond.type === 'distinct_count' && cond.values && cond.values.length > 0) {
        if (!cond.values.includes(fv)) {
          if (excluded.length < MAX_EXCLUSIONS) {
            excluded.push({
              ...makeExclusion(e, 'filter', cond, bounds.start),
              reason: `value '${fv}' not in whitelist [${cond.values.join(', ')}]`,
              reason_cn: `值 '${fv}' 不在白名单 [${cond.values.join(', ')}] 中`,
            });
          }
          continue;
        }
      }
    }

    matched.push(e);
  }

  return { matched, excluded };
}

// ── Type-specific details ────────────────────────────────────────

function isSessionWin(cond: Condition): boolean {
  return cond.window === 'single_session' || cond.window === 'same_session';
}

function buildDetails(
  cond: Condition,
  scopedEvents: TrackedEvent[],
  matched: TrackedEvent[],
): Record<string, unknown> {
  switch (cond.type) {
    case 'counter': {
      if (cond.same_target && cond.field) {
        const fieldCounts: Record<string, number> = {};
        for (const e of matched) {
          const val = getField(e, cond.field);
          if (!val) continue;
          fieldCounts[val] = (fieldCounts[val] || 0) + 1;
        }
        let maxVal = '';
        let maxCount = 0;
        for (const [k, v] of Object.entries(fieldCounts)) {
          if (v > maxCount) { maxVal = k; maxCount = v; }
        }
        return { mode: 'same_target', field: cond.field, max_field_value: maxVal, max_count: maxCount, all_counts: fieldCounts };
      }
      return { mode: 'count' };
    }

    case 'threshold': {
      const d: Record<string, unknown> = {};
      if (cond.per_event) d.per_event = true;
      if (cond.metric) d.metric = cond.metric;
      if (cond.field) {
        d.field = cond.field;
        let sum = 0;
        for (const e of matched) sum += Number(e.payload?.[cond.field]) || 0;
        d.sum_value = sum;
      }
      if (cond.max_per_day != null) d.max_per_day = cond.max_per_day;
      if (cond.max_value != null) d.max_value = cond.max_value;
      return d;
    }

    case 'streak': {
      if (cond.event_level) {
        const sw = isSessionWin(cond);
        const wMs = sw ? 0 : parseWindowMs(cond.window || '24h');
        const n = Date.now();
        let realMax = 0, realCur = 0;
        for (const e of scopedEvents) {
          const isMatch = e.event_type === cond.event
            && (sw || n - new Date(e.timestamp).getTime() <= wMs)
            && (!cond.filter || matchFilter(e, cond.filter))
            && matchRole(e, cond.role)
            && (!cond.field || !!getField(e, cond.field));
          if (isMatch) { realCur++; if (realCur > realMax) realMax = realCur; }
          else realCur = 0;
        }
        return { mode: 'event_level', longest_streak: realMax, active_streak: realCur };
      }
      const days = new Set(matched.map(e => e.timestamp.slice(0, 10)));
      const sorted = [...days].sort().reverse();
      let streak = 0;
      if (sorted.length > 0) {
        streak = 1;
        for (let i = 0; i < sorted.length - 1; i++) {
          const d1 = new Date(sorted[i]!), d2 = new Date(sorted[i + 1]!);
          if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) streak++; else break;
        }
      }
      return { mode: 'calendar_days', active_streak: streak, days_checked: sorted.slice(0, 30), total_active_days: days.size };
    }

    case 'sequence': {
      const seq = cond.sequence || [];
      const sw = isSessionWin(cond);
      const wMs = sw ? 0 : parseWindowMs(cond.window || '24h');
      const n = Date.now();
      const prefix: string[] = [];
      let si = 0;
      for (const e of scopedEvents) {
        if (si >= seq.length) break;
        if (!sw && cond.window && n - new Date(e.timestamp).getTime() > wMs) continue;
        if (e.event_type === seq[si]) { prefix.push(seq[si]!); si++; }
      }
      return { consecutive: !!cond.consecutive, matched_prefix: prefix, next_required: si < seq.length ? seq[si] : null, full_sequence: seq };
    }

    case 'distinct_count': {
      const seen = new Set<string>();
      for (const e of matched) {
        const val = cond.field ? getField(e, cond.field) : '';
        if (!val) continue;
        seen.add(val);
      }
      return { seen_values: [...seen].sort(), seen_count: seen.size, whitelist: cond.values || null };
    }

    case 'event': {
      return { has_match: matched.length > 0 };
    }

    case 'mode': {
      const freq: Record<string, number> = {};
      for (const e of matched) {
        const val = cond.field ? String(e.payload?.[cond.field] ?? '') : '';
        if (!val) continue;
        freq[val] = (freq[val] || 0) + 1;
      }
      let modeVal = '', modeCount = 0;
      for (const [k, v] of Object.entries(freq)) { if (v > modeCount) { modeVal = k; modeCount = v; } }
      return { distribution: freq, mode_value: modeVal, mode_count: modeCount, mode_target: cond.value };
    }

    case 'sequence_count': {
      const pattern = Array.isArray(cond.pattern) ? (cond.pattern as string[]) : null;
      if (!pattern) return {};
      let cycles = 0, pi = 0;
      for (const e of matched) {
        if (e.event_type === pattern[pi]) {
          pi++;
          if (pi >= pattern.length) { cycles++; pi = 0; }
        } else {
          pi = 0;
          if (e.event_type === pattern[0]) pi = 1;
        }
      }
      return { pattern, completed_cycles: cycles, partial_step: pi };
    }

    case 'pattern_match': {
      return { first_in_session: !!cond.first_in_session, matched_count: matched.length, pattern: cond.pattern || null };
    }

    case 'ratio': {
      return { metric: cond.metric || null };
    }

    case 'time_gap': {
      // Match evaluator: sort by timestamp, scan adjacent pairs, compute max gap.
      // The evaluator measures the largest gap between consecutive matching events.
      if (matched.length < 2) return { from_count: matched.length, max_adjacent_gap_ms: null, pair_count: 0, cross_day: !!cond.cross_day };
      const sorted = [...matched].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const fromFilter = cond.from_filter || null;
      const toFilter = cond.to_filter || null;
      const crossDay = cond.cross_day === true;
      let maxGapMs = 0;
      let pairCount = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        const t1 = new Date(prev.timestamp).getTime();
        const t2 = new Date(curr.timestamp).getTime();
        const gap = t2 - t1; // timestamps are sorted ⇒ non-negative
        // Apply pairwise filters if configured (matching evaluator)
        if (fromFilter && !matchFilter(prev, fromFilter)) continue;
        if (toFilter && !matchFilter(curr, toFilter)) continue;
        if (crossDay) {
          const d1 = prev.timestamp.slice(0, 10);
          const d2 = curr.timestamp.slice(0, 10);
          if (d1 === d2) continue; // skip same-day pairs
        }
        pairCount++;
        if (gap > maxGapMs) maxGapMs = gap;
      }
      return { from_count: matched.length, max_adjacent_gap_ms: maxGapMs || null, pair_count: pairCount, cross_day: !!cond.cross_day };
    }

    default: return {};
  }
}

// ── Unit label inference ─────────────────────────────────────────

const TYPE_UNITS: Record<string, string> = {
  counter: 'events', threshold: 'value', streak: 'days', sequence: 'steps',
  distinct_count: 'items', event: '', set_completion: 'members', mode: '%',
  sequence_count: 'cycles', pattern_match: 'matches', ratio: 'ratio', time_gap: 'ms',
};

function inferUnit(cond: Condition): string {
  if (cond.unit) return cond.unit;
  if (cond.type === 'streak' && cond.event_level) return 'consecutive events';
  if ((cond.type === 'distinct_count' || cond.type === 'counter' || cond.type === 'threshold') && cond.field) return cond.field;
  return TYPE_UNITS[cond.type] || '';
}

// ── Single condition ─────────────────────────────────────────────

function explainOneCondition(
  cond: Condition,
  events: TrackedEvent[],
  index: number,
): ConditionExplanation {
  // Real evaluator for accurate met/progress
  const evalResult = evaluateCondition(cond, events);

  const sessionWindow = isSessionWindow(cond) || isTaskWindow(cond);
  const windowMs = sessionWindow ? 0 : parseWindowMs(cond.window || '24h');
  const bounds = computeWindowBounds(events, sessionWindow ? 0 : windowMs);

  // Scoped + collected events
  const scoped = scopeEvents(events, cond);
  const { matched, excluded } = collectExclusions(scoped, cond, windowMs, bounds);

  // Total events of the target event_type in scope
  let totalScoped = scoped.length;
  if (cond.event) totalScoped = scoped.filter(e => e.event_type === cond.event).length;

  // Progress
  const met = evalResult.met;
  const cur = evalResult.progress;
  const tgt = evalResult.target;
  const pct = tgt > 0 ? Math.round((cur / tgt) * 100) : (met ? 100 : 0);
  const excludedCount = Math.max(0, totalScoped - matched.length);

  return {
    index,
    type: cond.type,
    met,
    current_value: cur,
    target_value: tgt,
    progress_pct: pct,
    unit_label: inferUnit(cond),
    event_type: cond.event || '',
    filter_expr: cond.filter || '',
    field: cond.field || '',
    window_raw: cond.window || '',
    window_label: windowLabel(cond.window || '', windowMs),
    window_start: bounds.start,
    window_end: bounds.end,
    matched_count: matched.length,
    excluded_count: excludedCount,
    total_scoped_events: totalScoped,
    excluded_events: excluded,
    details: buildDetails(cond, scoped, matched),
  };
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Build a structured explanation for a single achievement.
 *
 * @param def        The achievement definition
 * @param allDefs    All definitions (needed for set_completion conditions)
 * @param events     All tracked events
 * @param state      Current achievement state (unlocked map)
 * @returns          Structured explanation, or null if def is somehow invalid
 */
export function explainAchievement(
  def: AchievementDefinition,
  allDefs: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
): AchievementExplanation {
  const unlocked = !!state.unlocked[def.id];
  const conditions: ConditionExplanation[] = [];

  for (let i = 0; i < def.conditions.length; i++) {
    const cond = def.conditions[i]!;

    if (cond.type === 'set_completion') {
      // set_completion needs the full definition list to compute eligibility
      const eligible: Array<{ id: string; rarity: string; hidden?: boolean; future?: boolean; name?: string; name_cn?: string }> = [];
      const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

      if (cond.all) {
        for (const d of allDefs) {
          if (d.id !== def.id && !d.future) eligible.push(d);
        }
      } else if (cond.exclude_hidden) {
        for (const d of allDefs) {
          if (d.id !== def.id && !d.hidden && !d.future) eligible.push(d);
        }
      } else {
        const targetRarity = cond.rarity || 'common';
        const startIdx = RARITY_ORDER.indexOf(targetRarity);
        for (const d of allDefs) {
          if (d.id === def.id || d.future) continue;
          if (!cond.include_above) { if (d.rarity !== targetRarity) continue; }
          else { if (RARITY_ORDER.indexOf(d.rarity) < startIdx) continue; }
          eligible.push(d);
        }
      }

      const total = eligible.length;
      const completed = eligible.filter(d => state.unlocked[d.id]).length;
      const met = total > 0 && completed >= total;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      const members = eligible.map(d => ({
        id: d.id,
        name: d.name || d.id,
        name_cn: (d as { name_cn?: string }).name_cn || d.name || d.id,
        unlocked: !!state.unlocked[d.id],
      }));

      conditions.push({
        index: i + 1,
        type: 'set_completion',
        met,
        current_value: completed,
        target_value: total,
        progress_pct: pct,
        unit_label: 'members',
        event_type: '',
        filter_expr: '',
        field: '',
        window_raw: cond.window || '',
        window_label: 'lifetime (all events)',
        window_start: '',
        window_end: '',
        matched_count: completed,
        excluded_count: total - completed,
        total_scoped_events: total,
        excluded_events: [],
        details: { all: !!cond.all, exclude_hidden: !!cond.exclude_hidden, target_rarity: cond.rarity, include_above: !!cond.include_above, members },
      });
    } else {
      // Standard condition — use real evaluator + trace collection
      conditions.push(explainOneCondition(cond, events, i + 1));
    }
  }

  return {
    achievement_id: def.id,
    name: def.name,
    name_cn: def.name_cn || def.name,
    description: def.description,
    description_cn: def.description_cn || def.description,
    icon: typeof def.icon === 'string' ? def.icon : '🏆',
    rarity: def.rarity,
    category: def.category,
    hidden: def.hidden || false,
    unlocked,
    unlocked_at: state.unlocked[def.id] || '',
    hint: def.hint || '',
    hint_cn: def.hint_cn || '',
    conditions,
  };
}
