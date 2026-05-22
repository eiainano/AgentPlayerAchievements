import type { RarityLevel } from '../engine/types.js';

export const XP_PER_TASK = 10;

export const ACHIEVEMENT_XP: Record<RarityLevel, number> = {
  common: 50,
  uncommon: 100,
  rare: 200,
  epic: 300,
  legendary: 500,
  mythic: 1000,
};

export function calcLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}

export function calcXpForLevel(level: number): number {
  return level * level * 100;
}

export function calcLevelProgress(totalXp: number): { current: number; target: number } {
  const level = calcLevel(totalXp);
  const currentLevelXp = calcXpForLevel(level);
  const nextLevelXp = calcXpForLevel(level + 1);
  return {
    current: totalXp - currentLevelXp,
    target: nextLevelXp - currentLevelXp,
  };
}

export function calcTotalXp(
  unlockedAchievements: Array<{ rarity: RarityLevel }>,
  taskCount: number,
): number {
  const achXp = unlockedAchievements.reduce(
    (sum, a) => sum + (ACHIEVEMENT_XP[a.rarity] || 0),
    0,
  );
  return achXp + taskCount * XP_PER_TASK;
}
