import type { RarityLevel, TrackedEvent } from '../engine/types.js';

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
  usageXP?: number,
): number {
  const achXp = unlockedAchievements.reduce(
    (sum, a) => sum + (ACHIEVEMENT_XP[a.rarity] || 0),
    0,
  );
  return achXp + taskCount * XP_PER_TASK + (usageXP || 0);
}

// ── P1-1: Usage-based XP ────────────────────────────────────────────────

export interface UsageBreakdown {
  tool_calls: number;
  sessions: number;
  messages: number;
  total_tokens: number;
  unique_tools: number;
  usage_xp: number;
}

export function calcUsageXP(events: TrackedEvent[]): number {
  return calcUsageBreakdown(events).usage_xp;
}

export function calcUsageBreakdown(events: TrackedEvent[]): UsageBreakdown {
  const toolCalls = events.filter(e => e.event_type === 'tool.complete').length;
  const sessions = events.filter(e => e.event_type === 'session.start').length;
  const messages = events.filter(e => e.event_type === 'user.message').length;
  const tokenEvents = events.filter(e => e.event_type === 'token.consumed');
  const totalTokens = tokenEvents.reduce(
    (sum, e) => sum + ((e.payload.amount as number) || 0), 0
  );
  const toolNames = events
    .filter(e => e.event_type === 'tool.complete')
    .map(e => e.payload.tool_name as string | undefined)
    .filter((t): t is string => !!t);
  const uniqueTools = new Set(toolNames).size;

  const usageXP = Math.round(Math.sqrt(
    toolCalls * 1 +
    sessions * 10 +
    messages * 5 +
    (totalTokens / 1000) * 0.5 +
    uniqueTools * 20
  ));

  return {
    tool_calls: toolCalls,
    sessions,
    messages,
    total_tokens: totalTokens,
    unique_tools: uniqueTools,
    usage_xp: usageXP,
  };
}
