import { describe, it, expect } from 'vitest';
import {
  calcLevel,
  calcXpForLevel,
  calcLevelProgress,
  calcTotalXp,
  calcUsageXP,
  calcUsageBreakdown,
  calcStreakMultiplier,
  ACHIEVEMENT_XP,
  XP_PER_TASK,
} from '../../src/dashboard/xp.js';
import type { TrackedEvent } from '../../src/engine/types.js';

function makeEvent(
  event_type: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: crypto.randomUUID ? crypto.randomUUID() : 'test-id',
    timestamp: new Date().toISOString(),
    tool_source: 'claude-code',
    event_type,
    payload: {},
    context: { session_id: 'test', model: 'auto' },
    ...overrides,
  };
}

describe('xp', () => {
  it('calcLevel returns correct level', () => {
    expect(calcLevel(0)).toBe(0);
    expect(calcLevel(100)).toBe(1);
    expect(calcLevel(10000)).toBe(10);
    expect(calcLevel(250000)).toBe(50);
    expect(calcLevel(1000000)).toBe(100);
  });

  it('calcXpForLevel returns XP needed for level', () => {
    expect(calcXpForLevel(1)).toBe(100);
    expect(calcXpForLevel(10)).toBe(10000);
    expect(calcXpForLevel(50)).toBe(250000);
    expect(calcXpForLevel(100)).toBe(1_000_000);
  });

  it('calcLevelProgress returns current/target for next level', () => {
    // Level 5 = 2500 XP. At 3000 XP:
    const result = calcLevelProgress(3000);
    expect(result.current).toBe(500);  // 3000 - 2500
    expect(result.target).toBe(3600 - 2500); // xp_for_level(6) - xp_for_level(5)
  });

  it('ACHIEVEMENT_XP has correct values', () => {
    expect(ACHIEVEMENT_XP.common).toBe(50);
    expect(ACHIEVEMENT_XP.uncommon).toBe(100);
    expect(ACHIEVEMENT_XP.rare).toBe(200);
    expect(ACHIEVEMENT_XP.epic).toBe(300);
    expect(ACHIEVEMENT_XP.legendary).toBe(500);
    expect(ACHIEVEMENT_XP.mythic).toBe(1000);
  });

  it('XP_PER_TASK is 25', () => {
    expect(XP_PER_TASK).toBe(25);
  });

  it('calcTotalXp sums achievement XP and task XP', () => {
    const achievements = [
      { rarity: 'common' as const },
      { rarity: 'mythic' as const },
      { rarity: 'uncommon' as const },
    ];
    // 50 + 1000 + 100 + 25 * 10 = 1400 (no multiplier)
    expect(calcTotalXp(achievements, 10)).toBe(1400);
  });

  it('calcTotalXp includes optional usageXP', () => {
    const achievements = [{ rarity: 'common' as const }];
    expect(calcTotalXp(achievements, 0, 100)).toBe(150); // 50 + 100
    expect(calcTotalXp(achievements, 0)).toBe(50); // backward compatible
  });

  it('calcTotalXp applies streak multiplier', () => {
    const achievements = [{ rarity: 'common' as const }];
    // Base = 50, with 7-day streak = 1.6x → round(80) = 80
    expect(calcTotalXp(achievements, 0, 0, 1.6)).toBe(80);
    // With 11-day streak = 2.0x cap → round(100) = 100
    expect(calcTotalXp(achievements, 0, 0, 2.0)).toBe(100);
  });

  it('calcStreakMultiplier returns 1.0 for 0 or 1 day streak', () => {
    expect(calcStreakMultiplier(0)).toBe(1.0);
    expect(calcStreakMultiplier(1)).toBe(1.0);
  });

  it('calcStreakMultiplier scales linearly from day 2', () => {
    expect(calcStreakMultiplier(2)).toBe(1.1);
    expect(calcStreakMultiplier(3)).toBe(1.2);
    expect(calcStreakMultiplier(7)).toBe(1.6);
  });

  it('calcStreakMultiplier caps at 2.0 from day 11', () => {
    expect(calcStreakMultiplier(11)).toBe(2.0);
    expect(calcStreakMultiplier(30)).toBe(2.0);
    expect(calcStreakMultiplier(100)).toBe(2.0);
  });
});

describe('usage-based XP', () => {
  it('calcUsageXP returns 0 for empty events', () => {
    expect(calcUsageXP([])).toBe(0);
  });

  it('calcUsageBreakdown counts tool.complete events', () => {
    const events: TrackedEvent[] = [
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Write' } }),
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } }), // duplicate tool
    ];

    const b = calcUsageBreakdown(events);
    expect(b.tool_calls).toBe(3);
    expect(b.unique_tools).toBe(2);
  });

  it('calcUsageBreakdown counts sessions', () => {
    const events: TrackedEvent[] = [
      makeEvent('session.start'),
      makeEvent('session.start'),
    ];

    const b = calcUsageBreakdown(events);
    expect(b.sessions).toBe(2);
  });

  it('calcUsageBreakdown counts user messages', () => {
    const events: TrackedEvent[] = [
      makeEvent('user.message'),
      makeEvent('user.message'),
      makeEvent('user.message'),
    ];

    const b = calcUsageBreakdown(events);
    expect(b.messages).toBe(3);
  });

  it('calcUsageBreakdown accumulates token.consumed amounts', () => {
    const events: TrackedEvent[] = [
      makeEvent('token.consumed', { payload: { amount: 100000 } }),
      makeEvent('token.consumed', { payload: { amount: 50000 } }),
    ];

    const b = calcUsageBreakdown(events);
    expect(b.total_tokens).toBe(150000);
  });

  it('calcUsageXP is deterministic', () => {
    const events: TrackedEvent[] = [
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } }),
      makeEvent('session.start'),
      makeEvent('user.message'),
    ];

    const xp1 = calcUsageXP(events);
    const xp2 = calcUsageXP(events);
    expect(xp1).toBe(xp2);
    expect(xp1).toBeGreaterThan(0);
  });

  it('calcUsageXP grows sub-linearly with usage (sqrt effect)', () => {
    const manyEvents: TrackedEvent[] = Array.from({ length: 100 }, () =>
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } })
    );
    const fewEvents: TrackedEvent[] = Array.from({ length: 10 }, () =>
      makeEvent('tool.complete', { payload: { tool_name: 'Read' } })
    );

    const manyXp = calcUsageXP(manyEvents);
    const fewXp = calcUsageXP(fewEvents);
    // 10x events should give less than 10x XP (sqrt effect)
    expect(manyXp).toBeLessThan(fewXp * 10);
  });
});
