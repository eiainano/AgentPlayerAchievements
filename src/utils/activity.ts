/**
 * Activity analytics — shared computation layer for Dashboard API and CLI.
 *
 * All functions are pure: events in → data out. No file I/O, no engine coupling.
 */

import type { TrackedEvent } from '../engine/types.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface StreakData {
  current: number;
  longest: number;
  today_active: boolean;
}

export interface DayActivity {
  date: string;   // "2026-06-04"
  count: number;  // sessions on that day
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapData {
  days: DayActivity[];
  quantiles: [number, number, number];
}

// ── Streak computation ───────────────────────────────────────────────────

export function calcStreak(events: TrackedEvent[]): StreakData {
  const days = new Set<string>();
  for (const e of events) {
    days.add(e.timestamp.slice(0, 10));
  }
  const sorted = [...days].sort(); // ascending order
  if (sorted.length === 0) return { current: 0, longest: 0, today_active: false };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const lastDay = sorted[sorted.length - 1]!;
  const today_active = lastDay === today;

  // If last active day is older than yesterday, streak is broken
  if (lastDay < yesterday) {
    let longest = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i]!);
      const d2 = new Date(sorted[i - 1]!);
      if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 1;
      }
    }
    return { current: 0, longest, today_active: false };
  }

  // Count current streak from end
  let current = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const d1 = new Date(sorted[i]!);
    const d2 = new Date(sorted[i - 1]!);
    if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) current++;
    else break;
  }

  // Find longest streak across all history
  let longest = current, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const d1 = new Date(sorted[i]!);
    const d2 = new Date(sorted[i - 1]!);
    if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest, today_active };
}

// ── Heatmap computation ──────────────────────────────────────────────────

export function computeHeatmap(events: TrackedEvent[]): HeatmapData {
  const today = new Date();
  const days = new Map<string, number>();

  // 1. Generate all dates for past 4 months (~122 days)
  for (let i = 121; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.set(d.toISOString().slice(0, 10), 0);
  }

  // 2. Count session.start per day
  for (const e of events) {
    if (e.event_type !== 'session.start') continue;
    const key = e.timestamp.slice(0, 10);
    if (days.has(key)) days.set(key, (days.get(key) || 0) + 1);
  }

  // 3. Compute quantile thresholds (exclude 0 values)
  const nonZero = [...days.values()].filter(c => c > 0).sort((a, b) => a - b);
  let q1 = 1, q2 = 2, q3 = 3; // fallback fixed thresholds
  if (nonZero.length >= 4) {
    q1 = nonZero[Math.floor(nonZero.length * 0.25)]!;
    q2 = nonZero[Math.floor(nonZero.length * 0.50)]!;
    q3 = nonZero[Math.floor(nonZero.length * 0.75)]!;
    if (q2 <= q1) q2 = q1 + 1;
    if (q3 <= q2) q3 = q2 + 1;
  }

  // 4. Assign levels (0 is always a separate bucket)
  const result: DayActivity[] = [];
  for (const [date, count] of days) {
    let level: DayActivity['level'] = 0;
    if (count > 0) {
      if (count <= q1) level = 1;
      else if (count <= q2) level = 2;
      else if (count <= q3) level = 3;
      else level = 4;
    }
    result.push({ date, count, level });
  }

  return { days: result.sort((a, b) => a.date.localeCompare(b.date)), quantiles: [q1, q2, q3] };
}

// ── P1-3: Heatmap from daily cache (zero event scan) ─────────────────────

export function computeHeatmapFromDaily(
  daily: Record<string, { sessions: number }>,
): HeatmapData {
  const today = new Date();
  const days = new Map<string, number>();

  for (let i = 121; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.set(d.toISOString().slice(0, 10), 0);
  }

  for (const [date, bucket] of Object.entries(daily)) {
    if (days.has(date)) {
      days.set(date, bucket.sessions);
    }
  }

  const nonZero = [...days.values()].filter(c => c > 0).sort((a, b) => a - b);
  let q1 = 1, q2 = 2, q3 = 3;
  if (nonZero.length >= 4) {
    q1 = nonZero[Math.floor(nonZero.length * 0.25)]!;
    q2 = nonZero[Math.floor(nonZero.length * 0.50)]!;
    q3 = nonZero[Math.floor(nonZero.length * 0.75)]!;
    if (q2 <= q1) q2 = q1 + 1;
    if (q3 <= q2) q3 = q2 + 1;
  }

  const result: DayActivity[] = [];
  for (const [date, count] of days) {
    let level: DayActivity['level'] = 0;
    if (count > 0) {
      if (count <= q1) level = 1;
      else if (count <= q2) level = 2;
      else if (count <= q3) level = 3;
      else level = 4;
    }
    result.push({ date, count, level });
  }

  return { days: result.sort((a, b) => a.date.localeCompare(b.date)), quantiles: [q1, q2, q3] };
}

export function calcStreakFromDaily(
  daily: Record<string, { sessions: number }>,
): StreakData {
  const activeDays = Object.entries(daily)
    .filter(([, b]) => b.sessions > 0)
    .map(([date]) => date)
    .sort();

  if (activeDays.length === 0) return { current: 0, longest: 0, today_active: false };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const lastDay = activeDays[activeDays.length - 1]!;
  const today_active = lastDay === today;

  if (lastDay < yesterday) {
    let longest = 1, run = 1;
    for (let i = 1; i < activeDays.length; i++) {
      const d1 = new Date(activeDays[i]!);
      const d2 = new Date(activeDays[i - 1]!);
      if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 1;
      }
    }
    return { current: 0, longest, today_active: false };
  }

  let current = 1;
  for (let i = activeDays.length - 1; i > 0; i--) {
    const d1 = new Date(activeDays[i]!);
    const d2 = new Date(activeDays[i - 1]!);
    if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) current++;
    else break;
  }

  let longest = current, run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    const d1 = new Date(activeDays[i]!);
    const d2 = new Date(activeDays[i - 1]!);
    if ((d1.getTime() - d2.getTime()) / 86400000 <= 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest, today_active };
}
