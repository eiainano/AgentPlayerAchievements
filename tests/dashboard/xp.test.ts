import { describe, it, expect } from 'vitest';
import {
  calcLevel,
  calcXpForLevel,
  calcLevelProgress,
  calcTotalXp,
  ACHIEVEMENT_XP,
  XP_PER_TASK,
} from '../../src/dashboard/xp.js';

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

  it('XP_PER_TASK is 10', () => {
    expect(XP_PER_TASK).toBe(10);
  });

  it('calcTotalXp sums achievement XP and task XP', () => {
    const achievements = [
      { rarity: 'common' as const },
      { rarity: 'mythic' as const },
      { rarity: 'uncommon' as const },
    ];
    expect(calcTotalXp(achievements, 10)).toBe(50 + 1000 + 100 + 10 * 10);
  });
});
