import { describe, it, expect } from 'vitest';
import type { TrackedEvent } from '../../src/engine/types.js';
import {
  calcStreak, computeHeatmap,
  calcStreakFromDaily, computeHeatmapFromDaily,
} from '../../src/utils/activity.js';

function makeSession(isoDate: string): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: 'test',
    timestamp: `${isoDate}T12:00:00Z`,
    tool_source: 'test',
    event_type: 'session.start',
    payload: {},
    context: { session_id: 's1', model: 'auto' },
  };
}

// ── calcStreak ──────────────────────────────────────────────────────

describe('calcStreak', () => {
  it('returns zeros for empty events', () => {
    const result = calcStreak([]);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.today_active).toBe(false);
  });

  it('single session today is streak of 1', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = calcStreak([makeSession(today)]);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.today_active).toBe(true);
  });

  it('consecutive days ending today builds streak', () => {
    const today = new Date();
    const events = [0, 1, 2, 3].map(daysAgo => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return makeSession(d.toISOString().slice(0, 10));
    });
    const result = calcStreak(events);
    expect(result.current).toBe(4);
    expect(result.longest).toBe(4);
    expect(result.today_active).toBe(true);
  });

  it('gap breaks streak — current resets, longest preserved', () => {
    const today = new Date();
    const events = [
      // Old streak: 3 days, 10+ days ago
      makeSession(new Date(today.getTime() - 15 * 86400000).toISOString().slice(0, 10)),
      makeSession(new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)),
      makeSession(new Date(today.getTime() - 13 * 86400000).toISOString().slice(0, 10)),
      // Current streak: 2 days ending today
      makeSession(new Date(today.getTime() - 1 * 86400000).toISOString().slice(0, 10)),
      makeSession(today.toISOString().slice(0, 10)),
    ];
    const result = calcStreak(events);
    expect(result.current).toBe(2);
    expect(result.longest).toBe(3);
    expect(result.today_active).toBe(true);
  });

  it('last active day older than yesterday — current=0', () => {
    const today = new Date();
    const events = [
      makeSession(new Date(today.getTime() - 5 * 86400000).toISOString().slice(0, 10)),
      makeSession(new Date(today.getTime() - 4 * 86400000).toISOString().slice(0, 10)),
    ];
    const result = calcStreak(events);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
    expect(result.today_active).toBe(false);
  });

  it('non-session events are ignored', () => {
    const events: TrackedEvent[] = [
      { ...makeSession('2026-01-01'), event_type: 'tool.complete' },
    ];
    const result = calcStreak(events);
    expect(result.current).toBe(0);
  });
});

// ── computeHeatmap ──────────────────────────────────────────────────

describe('computeHeatmap', () => {
  it('no events returns 122 days all at level 0', () => {
    const result = computeHeatmap([]);
    expect(result.days).toHaveLength(122);
    expect(result.days.every(d => d.level === 0)).toBe(true);
    expect(result.days.every(d => d.count === 0)).toBe(true);
    expect(result.quantiles).toEqual([1, 2, 3]); // fallback
  });

  it('single session sets count=1 for that day only', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeHeatmap([makeSession(today)]);
    const todayEntry = result.days.find(d => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.count).toBe(1);
    expect(todayEntry!.level).toBe(1); // fallback q1=1
    const otherDays = result.days.filter(d => d.date !== today);
    expect(otherDays.every(d => d.count === 0)).toBe(true);
  });

  it('many sessions per day produce higher quantile levels', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const events: TrackedEvent[] = [
      // Yesterday: 10 sessions → should be in top quartile
      ...Array.from({ length: 10 }, () => makeSession(yesterday.toISOString().slice(0, 10))),
      // Today: 3 sessions → mid-range
      ...Array.from({ length: 3 }, () => makeSession(today.toISOString().slice(0, 10))),
    ];
    const result = computeHeatmap(events);
    const yesterdayEntry = result.days.find(d => d.date === yesterday.toISOString().slice(0, 10));
    const todayEntry = result.days.find(d => d.date === today.toISOString().slice(0, 10));
    expect(yesterdayEntry).toBeDefined();
    expect(todayEntry).toBeDefined();
    // Yesterday (10) should be higher level than today (3)
    expect(yesterdayEntry!.level).toBeGreaterThanOrEqual(todayEntry!.level);
    expect(yesterdayEntry!.count).toBe(10);
    expect(todayEntry!.count).toBe(3);
  });

  it('less than 4 non-zero days uses fallback thresholds', () => {
    const today = new Date().toISOString().slice(0, 10);
    const events = [makeSession(today)]; // only 1 non-zero day
    const result = computeHeatmap(events);
    expect(result.quantiles).toEqual([1, 2, 3]);
  });
});

// ── calcStreakFromDaily ─────────────────────────────────────────────

describe('calcStreakFromDaily', () => {
  it('empty daily returns zeros', () => {
    expect(calcStreakFromDaily({})).toEqual({ current: 0, longest: 0, today_active: false });
  });

  it('single active day is streak of 1', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(calcStreakFromDaily({ [today]: { sessions: 3 } }))
      .toEqual({ current: 1, longest: 1, today_active: true });
  });

  it('gap breaks streak, longest preserved', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = calcStreakFromDaily({
      '2026-01-01': { sessions: 1 },
      '2026-01-02': { sessions: 1 },
      '2026-01-03': { sessions: 1 },
      [today]: { sessions: 1 },
    });
    expect(result.current).toBe(1);
    expect(result.longest).toBe(3);
    expect(result.today_active).toBe(true);
  });
});

// ── computeHeatmapFromDaily ─────────────────────────────────────────

describe('computeHeatmapFromDaily', () => {
  it('empty daily returns 122 zero-level days', () => {
    const result = computeHeatmapFromDaily({});
    expect(result.days).toHaveLength(122);
    expect(result.days.every(d => d.level === 0)).toBe(true);
  });

  it('preserves session counts from daily buckets', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeHeatmapFromDaily({ [today]: { sessions: 5 } });
    const todayEntry = result.days.find(d => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.count).toBe(5);
  });
});
