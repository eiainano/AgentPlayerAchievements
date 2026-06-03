import type {
  AchievementDefinition,
  AchievementState,
  RarityLevel,
  TrackedEvent,
  Condition,
  EvaluationResult,
  SetDefinition,
  SetReward,
} from '../engine/types.js';
import type { AgentToolStats } from '../engine/stats.js';
import { evaluateCondition } from '../engine/evaluator.js';
import { calcTotalXp, calcLevel, calcLevelProgress } from './xp.js';
import { buildTimeline } from './timeline.js';
import { loadConfig } from '../config.js';
import type { AppConfig } from '../config.js';
import type { StreakData, HeatmapData, DayActivity } from '../utils/activity.js';
import { calcStreak, computeHeatmap } from '../utils/activity.js';

// ── Response types ────────────────────────────────────────────────────

export interface AchievementItem {
  id: string;
  name: string;
  name_cn?: string;
  description: string;
  description_cn?: string;
  icon: string;
  category: string;
  rarity: RarityLevel;
  hidden?: boolean;
  set_id?: string;
  unlocked: boolean;
  unlocked_at?: string;
  progress?: { current: number; target: number };
}

export interface SetAchievementMember {
  id: string;
  name: string;
  icon: string;
  rarity: RarityLevel;
  unlocked: boolean;
}

export interface SetItem {
  id: string;
  name: string;
  name_cn?: string;
  achievements: SetAchievementMember[];
  completed: number;
  total: number;
  reward: SetReward;
}

export type { StreakData, DayActivity, HeatmapData } from '../utils/activity.js';

export interface DashboardStats {
  total_achievements: number;
  unlocked: number;
  completion_pct: number;
  total_events: number;
  by_category: Record<string, { total: number; unlocked: number }>;
  by_rarity: Record<string, { total: number; unlocked: number }>;
  level: number;
  total_xp: number;
  xp_progress: { current: number; target: number };
  showcase: Array<{ slot: number; achievement: AchievementItem | null }>;
  streak: StreakData;
  heatmap: HeatmapData;
  tool_stats?: AgentToolStats;
}

export interface DashboardData {
  achievements: AchievementItem[];
  stats: DashboardStats;
  timeline: Array<{ id: string; unlocked_at: string }>;
  sets: SetItem[];
  config: Pick<AppConfig, 'lang'>;
  profile?: string;
  profile_emoji?: string;
  profiles?: Array<{ name: string; emoji: string }>;
  max_profiles?: number;
}

// ── Compute progress for a single achievement ─────────────────────────

function computeProgress(
  def: AchievementDefinition,
  events: TrackedEvent[],
): { current: number; target: number } | undefined {
  if (!def.conditions || def.conditions.length === 0) return undefined;
  const result = evaluateCondition(def.conditions[0]!, events);
  if (result.target <= 0) return undefined;
  return { current: Math.min(result.progress, result.target), target: result.target };
}

// ── API response builders ────────────────────────────────────────────

export function buildAchievementsResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  opts: { events?: TrackedEvent[]; taskCount?: number },
): AchievementItem[] {
  return definitions.map(def => {
    const unlockedAt = state.unlocked[def.id];
    const unlocked = !!unlockedAt;
    return {
      id: def.id,
      name: def.name,
      name_cn: def.name_cn,
      description: def.description,
      description_cn: def.description_cn,
      icon: def.icon || '🏆',
      category: def.category,
      rarity: def.rarity,
      hidden: def.hidden,
      set_id: def.set_id,
      unlocked,
      unlocked_at: unlockedAt,
      progress: unlocked ? undefined : computeProgress(def, opts.events || []),
    };
  });
}

export function buildSetsResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  setDefinitions: SetDefinition[],
): SetItem[] {
  const setDefMap = new Map(setDefinitions.map(s => [s.id, s]));
  const sets = new Map<string, AchievementDefinition[]>();
  for (const def of definitions) {
    if (!def.set_id) continue;
    const list = sets.get(def.set_id) || [];
    list.push(def);
    sets.set(def.set_id, list);
  }

  return Array.from(sets.entries()).map(([setId, members]) => {
    const setDef = setDefMap.get(setId);
    return {
      id: setId,
      name: setDef?.name || setId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      name_cn: setDef?.name_cn,
      achievements: members.map(m => ({
        id: m.id,
        name: m.name,
        icon: m.icon || '🏆',
        rarity: m.rarity,
        unlocked: !!state.unlocked[m.id],
      })),
      completed: members.filter(m => state.unlocked[m.id]).length,
      total: members.length,
      reward: setDef?.reward || { type: 'badge', value: '' },
    };
  });
}

export function buildApiResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  events: TrackedEvent[],
  showcaseData: Array<{ slot: number; achievement: AchievementItem | null }>,
  engineStats: { total_events: number; by_category: Record<string, { total: number; unlocked: number }>; by_rarity: Record<string, { total: number; unlocked: number }> },
  setDefinitions: SetDefinition[],
  toolStats?: AgentToolStats,
): DashboardData {
  const taskCount = events.filter(e => e.event_type === 'task.complete').length;
  const achievements = buildAchievementsResponse(definitions, state, { events, taskCount });

  const unlockedDefs = definitions.filter(d => state.unlocked[d.id]);
  const totalXp = calcTotalXp(
    unlockedDefs.map(d => ({ rarity: d.rarity })),
    taskCount,
  );

  return {
    achievements,
    stats: {
      total_achievements: definitions.length,
      unlocked: Object.keys(state.unlocked).length,
      completion_pct: Math.round((Object.keys(state.unlocked).length / definitions.length) * 100),
      total_events: engineStats.total_events,
      by_category: engineStats.by_category,
      by_rarity: engineStats.by_rarity,
      level: calcLevel(totalXp),
      total_xp: totalXp,
      xp_progress: calcLevelProgress(totalXp),
      showcase: showcaseData,
      streak: calcStreak(events),
      heatmap: computeHeatmap(events),
      tool_stats: toolStats,
    },
    timeline: buildTimeline(state.unlocked),
    sets: buildSetsResponse(definitions, state, setDefinitions),
    config: { lang: loadConfig().lang },
  };
}
