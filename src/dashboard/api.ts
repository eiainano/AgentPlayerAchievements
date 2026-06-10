import type {
  AchievementDefinition,
  AchievementState,
  PixelArtSize,
  RarityLevel,
  TrackedEvent,
  Condition,
  EvaluationResult,
  SetDefinition,
  SetReward,
} from '../engine/types.js';
import type { AgentToolStats } from '../engine/stats.js';
import { evaluateCondition } from '../engine/evaluator.js';
import { calcTotalXp, calcLevel, calcLevelProgress, calcUsageBreakdown, XP_PER_TASK, calcStreakMultiplier } from './xp.js';
import type { UsageBreakdown } from './xp.js';
import { buildTimeline } from './timeline.js';
import { loadConfig } from '../config.js';
import type { AppConfig } from '../config.js';
import type { StreakData, HeatmapData, DayActivity } from '../utils/activity.js';
import { calcStreak, computeHeatmap, computeHeatmapFromDaily, calcStreakFromDaily } from '../utils/activity.js';
import { getRecommendResponse } from '../utils/recommend.js';
import type { RecommendResponse, QuestlineDefinition } from '../engine/types.js';

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
  tip?: string;
  tip_cn?: string;
  hint?: string;
  hint_cn?: string;
  unlocked: boolean;
  unlocked_at?: string;
  progress?: { current: number; target: number };
  pixel_art_48?: PixelArtSize;
}

export interface SetAchievementMember {
  id: string;
  name: string;
  icon: string;
  rarity: RarityLevel;
  unlocked: boolean;
  pixel_art_48?: PixelArtSize;
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

export interface TitleItem {
  set_id: string;
  title: string;      // reward.value, e.g. "Founder", "Polyglot"
  set_name: string;
  set_name_cn?: string;
  icon: string;       // first unlocked member icon
  rarity: string;     // highest member rarity
}

export interface BadgeItem {
  set_id: string;
  badge: string;      // reward.value, e.g. "streak_master", "100% Complete"
  set_name: string;
  set_name_cn?: string;
  icon: string;
  completed: number;
  total: number;
}

export type { StreakData, DayActivity, HeatmapData } from '../utils/activity.js';

export interface DailyStatPoint {
  date: string;
  sessions: number;
  tool_calls: number;
  tasks_completed: number;
}

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
  streak_multiplier: number;
  heatmap: HeatmapData;
  tool_stats?: AgentToolStats;
  usage_xp: number;
  usage_breakdown?: UsageBreakdown;
  daily_stats?: Array<{ date: string; sessions: number; tool_calls: number; tasks: number }>;
}

export interface QuestlineStageItem {
  stage: number;
  name: string;
  name_cn?: string;
  achievements: Array<{
    id: string;
    name: string;
    name_cn?: string;
    icon: string;
    rarity: RarityLevel;
    unlocked: boolean;
  }>;
  completed: number;
  total: number;
}

export interface QuestlineItem {
  id: string;
  name: string;
  name_cn?: string;
  icon: string;
  description: string;
  description_cn?: string;
  stages: QuestlineStageItem[];
  unlocked_count: number;
  total_count: number;
  current_stage: number;
  current_stage_name: string;
  current_stage_name_cn?: string;
  completed: boolean;
  reward: SetReward;
  reward_earned: boolean;
}

export interface DashboardData {
  achievements: AchievementItem[];
  stats: DashboardStats;
  timeline: Array<{ id: string; unlocked_at: string }>;
  sets: SetItem[];
  config: Pick<AppConfig, 'lang'>;
  profile?: string;
  profile_emoji?: string;
  profiles?: Array<{ name: string; emoji: string; tracked_tools?: string[] }>;
  max_profiles?: number;
  titles: TitleItem[];
  badges: BadgeItem[];
  is_demo?: boolean;
  has_demo?: boolean;
  recommend?: RecommendResponse;
  questlines?: QuestlineItem[];
}

// ── Card API types ────────────────────────────────────────────────────

const RARITY_CARD_COLORS: Record<string, string> = {
  common: '#7eb8da',
  uncommon: '#3b7ec0',
  rare: '#e0b020',
  epic: '#e87830',
  legendary: '#a858f0',
  mythic: '#f04050',
};

const RARITY_LABELS_EN: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

const RARITY_LABELS_ZH: Record<string, string> = {
  common: '普通',
  uncommon: '罕见',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

const RARITY_RANK_INLINE: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
};

export interface CardAchievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  rarity: string;
  rarity_color: string;
  rarity_label: string;
  unlocked_at?: string;
  set_name?: string;
  set_progress?: string;
  in_progress?: boolean;
  progress_pct?: number;
  progress_text?: string;
  pixel_art_48?: PixelArtSize;
}

export interface CardMilestone {
  emoji: string;
  name: string;
  rarity: string;
  rarity_color: string;
  unlocked_at: string;
}

export interface CardData {
  profile: string;
  profile_emoji: string;
  lang: string;
  level: number;
  total_xp: number;
  xp_current: number;
  xp_target: number;
  unlocked: number;
  total: number;
  stats: {
    streak_days: number;
    total_tasks: number;
    total_tool_uses: number;
    total_sessions: number;
  };
  rarity_breakdown: Array<{ rarity: string; color: string; count: number }>;
  achievements: CardAchievement[];
  heatmap: Array<{ date: string; count: number }>;
  milestones: CardMilestone[];
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
      tip: def.tip,
      tip_cn: def.tip_cn,
      hint: def.hint,
      hint_cn: def.hint_cn,
      unlocked,
      unlocked_at: unlockedAt,
      progress: unlocked ? undefined : computeProgress(def, opts.events || []),
      pixel_art_48: def.pixel_art?.['48'],
    };
  });
}

export function buildCardResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  events: TrackedEvent[],
  setDefinitions: SetDefinition[],
  config: { lang: string },
  profile: string,
  profileEmoji: string,
  existingStats: any,
): CardData {
  const useZh = config.lang === 'zh';
  const setDefMap = new Map(setDefinitions.map(s => [s.id, s]));

  // ── Streak multiplier (computed before XP since it affects XP) ─
  const streak = existingStats?.daily
    ? calcStreakFromDaily(existingStats.daily)
    : calcStreak(events);
  const cardStreakMultiplier = calcStreakMultiplier(streak.current);

  // ── Level & XP ────────────────────────────────────────────────
  const taskCount = events.filter(e => e.event_type === 'task.complete').length;
  const taskXp = taskCount * XP_PER_TASK;
  const usageBreakdown = calcUsageBreakdown(events);
  const achievementXp = (state.stats?.total_unlocked || 0) * 50;
  const totalXp = Math.round((taskXp + achievementXp + (usageBreakdown?.usage_xp || 0)) * cardStreakMultiplier);
  const level = calcLevel(totalXp);
  const xpProgress = calcLevelProgress(totalXp);

  // ── Stats ─────────────────────────────────────────────────────
  const toolEvents = events.filter(e => e.event_type === 'tool.complete').length;
  const sessionEvents = events.filter(e => e.event_type === 'session.start').length;

  // ── Rarity breakdown ───────────────────────────────────────────
  const byRarity = existingStats?.by_rarity || {};
  const rarityBreakdown = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(rarity => ({
    rarity,
    color: RARITY_CARD_COLORS[rarity] || '#7eb8da',
    count: byRarity[rarity]?.unlocked || 0,
  }));

  // ── Achievements ──────────────────────────────────────────────
  const unlockedDefs = definitions
    .filter(d => state.unlocked[d.id])
    .sort((a, b) => (RARITY_RANK_INLINE[b.rarity] || 0) - (RARITY_RANK_INLINE[a.rarity] || 0));

  // Take top 6 by rarity, fall back to in-progress if < 6
  const cardAchievements: CardAchievement[] = [];
  for (let i = 0; i < Math.min(6, unlockedDefs.length); i++) {
    const def = unlockedDefs[i]!;
    const setDef = def.set_id ? setDefMap.get(def.set_id) : undefined;
    const setMembers = setDef ? definitions.filter(d => d.set_id === def.set_id) : [];
    const setCompleted = setMembers.filter(m => state.unlocked[m.id]).length;
    cardAchievements.push({
      id: def.id,
      icon: def.icon || '🏆',
      name: useZh ? (def.name_cn || def.name) : def.name,
      description: useZh ? (def.description_cn || def.description) : def.description,
      rarity: def.rarity,
      rarity_color: RARITY_CARD_COLORS[def.rarity] || '#7eb8da',
      rarity_label: useZh
        ? (RARITY_LABELS_ZH[def.rarity] || '普通')
        : (RARITY_LABELS_EN[def.rarity] || 'Common'),
      unlocked_at: state.unlocked[def.id],
      set_name: setDef ? (useZh ? (setDef.name_cn || setDef.name) : setDef.name) : undefined,
      set_progress: setDef ? `${setCompleted}/${setMembers.length}` : undefined,
      pixel_art_48: def.pixel_art?.['48'],
    });
  }

  // Fill remaining slots with in-progress achievements if needed
  if (cardAchievements.length < 4) {
    const inProgress = definitions
      .filter(d => !state.unlocked[d.id] && !d.hidden && !d.future && d.conditions[0])
      .map(d => {
        const result = evaluateCondition(d.conditions[0]!, events);
        const ratio = result.target > 0 ? result.progress / result.target : 0;
        return { def: d, result, ratio };
      })
      .filter(x => x.ratio >= 0.2)
      .sort((a, b) => b.ratio - a.ratio);

    for (const x of inProgress) {
      if (cardAchievements.length >= 6) break;
      const def = x.def;
      cardAchievements.push({
        id: def.id,
        icon: def.icon || '🏆',
        name: useZh ? (def.name_cn || def.name) : def.name,
        description: useZh ? (def.description_cn || def.description) : def.description,
        rarity: def.rarity,
        rarity_color: RARITY_CARD_COLORS[def.rarity] || '#7eb8da',
        rarity_label: useZh ? '进行中' : 'In Progress',
        in_progress: true,
        progress_pct: Math.round(x.ratio * 100),
        progress_text: `${x.result.progress} / ${x.result.target}`,
        pixel_art_48: def.pixel_art?.['48'],
      });
    }
  }

  // ── Heatmap ────────────────────────────────────────────────────
  let heatmap: Array<{ date: string; count: number }> = [];
  try {
    const heatmapData = existingStats?.daily
      ? computeHeatmapFromDaily(existingStats.daily)
      : computeHeatmap(events.filter(e => e.event_type === 'session.start' || e.event_type === 'tool.complete'));
    if (heatmapData?.days) {
      heatmap = heatmapData.days.map((d: { date: string; level: number }) => ({ date: d.date, count: d.level }));
    }
  } catch {
    // empty heatmap on error
  }

  // ── Milestones ─────────────────────────────────────────────────
  const unlockedPairs = definitions
    .filter(d => state.unlocked[d.id])
    .sort((a, b) => {
      const ra = RARITY_RANK_INLINE[a.rarity] || 0;
      const rb = RARITY_RANK_INLINE[b.rarity] || 0;
      if (ra !== rb) return rb - ra;
      return (state.unlocked[b.id] || '').localeCompare(state.unlocked[a.id] || '');
    });

  const milestones: CardMilestone[] = unlockedPairs.slice(0, 3).map(def => ({
    emoji: def.icon || '🏆',
    name: useZh ? (def.name_cn || def.name) : def.name,
    rarity: def.rarity,
    rarity_color: RARITY_CARD_COLORS[def.rarity] || '#7eb8da',
    unlocked_at: state.unlocked[def.id] || '',
  }));

  return {
    profile,
    profile_emoji: profileEmoji,
    lang: config.lang || 'en',
    level,
    total_xp: totalXp,
    xp_current: xpProgress.current,
    xp_target: xpProgress.target,
    unlocked: state.stats?.total_unlocked || Object.keys(state.unlocked).length,
    total: definitions.length,
    stats: {
      streak_days: streak.current || 0,
      total_tasks: taskCount,
      total_tool_uses: toolEvents,
      total_sessions: sessionEvents,
    },
    rarity_breakdown: rarityBreakdown,
    achievements: cardAchievements,
    heatmap,
    milestones,
  };
}

export function buildQuestlinesResponse(
  questlineDefinitions: QuestlineDefinition[],
  definitions: AchievementDefinition[],
  state: AchievementState,
): QuestlineItem[] {
  if (!questlineDefinitions || questlineDefinitions.length === 0) return [];

  const defMap = new Map(definitions.map(d => [d.id, d]));

  const items: QuestlineItem[] = questlineDefinitions.map(q => {
    let totalCount = 0;
    let unlockedCount = 0;
    let currentStage = 1;
    let currentStageName = q.stages[0]?.name || 'Stage 1';
    let currentStageNameCn: string | undefined = q.stages[0]?.name_cn || '第1阶段';

    const stages: QuestlineStageItem[] = q.stages.map(stage => {
      let stageUnlocked = 0;
      const stageAchs = stage.achievements.map(achId => {
        const def = defMap.get(achId);
        const unlocked = !!state.unlocked[achId];
        if (unlocked) stageUnlocked++;
        return {
          id: achId,
          name: def?.name || achId,
          name_cn: def?.name_cn,
          icon: def?.icon || '🏆',
          rarity: def?.rarity || 'common',
          unlocked,
        };
      });

      totalCount += stageAchs.length;
      unlockedCount += stageUnlocked;

      return {
        stage: stage.stage,
        name: stage.name,
        name_cn: stage.name_cn,
        achievements: stageAchs,
        completed: stageUnlocked,
        total: stageAchs.length,
      };
    });

    // Determine current stage: first incomplete stage
    for (const s of stages) {
      if (s.completed < s.total) {
        currentStage = s.stage;
        currentStageName = s.name;
        currentStageNameCn = s.name_cn;
        break;
      }
      // If we're at the last stage and it's complete, stay there
      if (s.stage === stages.length) {
        currentStage = s.stage;
        currentStageName = s.name;
        currentStageNameCn = s.name_cn;
      }
    }

    const completed = unlockedCount === totalCount && totalCount > 0;

    return {
      id: q.id,
      name: q.name,
      name_cn: q.name_cn,
      icon: q.icon,
      description: q.description,
      description_cn: q.description_cn,
      stages,
      unlocked_count: unlockedCount,
      total_count: totalCount,
      current_stage: currentStage,
      current_stage_name: currentStageName,
      current_stage_name_cn: currentStageNameCn,
      completed,
      reward: q.reward,
      reward_earned: completed,
    };
  });

  // Sort by completion percentage descending
  items.sort((a, b) => {
    const pa = a.total_count > 0 ? a.unlocked_count / a.total_count : 0;
    const pb = b.total_count > 0 ? b.unlocked_count / b.total_count : 0;
    return pb - pa;
  });

  return items;
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
        pixel_art_48: m.pixel_art?.['48'],
      })),
      completed: members.filter(m => state.unlocked[m.id]).length,
      total: members.length,
      reward: setDef?.reward || { type: 'badge', value: '' },
    };
  });
}

function buildTitlesAndBadges(sets: SetItem[], definitions: AchievementDefinition[]): { titles: TitleItem[]; badges: BadgeItem[] } {
  const titles: TitleItem[] = [];
  const badges: BadgeItem[] = [];

  for (const set of sets) {
    if (set.completed !== set.total || set.total === 0) continue;

    const reward = set.reward;
    if (!reward || !reward.value) continue;

    // Find the highest rarity among members for visual coloring
    const rarityOrder: Record<string, number> = {
      common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
    };
    let highestRarity = 'common';
    for (const m of set.achievements) {
      if ((rarityOrder[m.rarity] || 0) > (rarityOrder[highestRarity] || 0)) {
        highestRarity = m.rarity;
      }
    }

    if (reward.type === 'title') {
      titles.push({
        set_id: set.id,
        title: reward.value,
        set_name: set.name,
        set_name_cn: set.name_cn,
        icon: set.achievements.find(a => a.unlocked)?.icon || '🏆',
        rarity: highestRarity,
      });
    } else if (reward.type === 'badge') {
      badges.push({
        set_id: set.id,
        badge: reward.value,
        set_name: set.name,
        set_name_cn: set.name_cn,
        icon: set.achievements[0]?.icon || '🏆',
        completed: set.completed,
        total: set.total,
      });
    }
  }

  return { titles, badges };
}

export function buildApiResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  events: TrackedEvent[],
  showcaseData: Array<{ slot: number; achievement: AchievementItem | null }>,
  engineStats: { total_events: number; by_category: Record<string, { total: number; unlocked: number }>; by_rarity: Record<string, { total: number; unlocked: number }> },
  setDefinitions: SetDefinition[],
  questlineDefinitions?: QuestlineDefinition[],
  toolStats?: AgentToolStats,
  opts?: { includeRecommend?: boolean },
): DashboardData {
  const taskCount = events.filter(e => e.event_type === 'task.complete').length;
  const achievements = buildAchievementsResponse(definitions, state, { events, taskCount });

  // Compute streak data for multiplier
  const streakData = toolStats?.daily
    ? calcStreakFromDaily(toolStats.daily as Record<string, { sessions: number }>)
    : calcStreak(events);
  const streakMultiplier = calcStreakMultiplier(streakData.current);
  const unlockedDefs = definitions.filter(d => state.unlocked[d.id]);
  const usageBreakdown = calcUsageBreakdown(events);
  const totalXp = calcTotalXp(
    unlockedDefs.map(d => ({ rarity: d.rarity })),
    taskCount,
    usageBreakdown.usage_xp,
    streakMultiplier,
  );

  // Build daily_stats from stats.json cache (30 most recent days)
  const dailyStats: Array<{ date: string; sessions: number; tool_calls: number; tasks: number }> = [];
  if (toolStats?.daily) {
    const dates = Object.keys(toolStats.daily).sort().slice(-30);
    for (const date of dates) {
      const b = toolStats.daily[date]!;
      dailyStats.push({
        date,
        sessions: b.sessions,
        tool_calls: b.tool_calls,
        tasks: (b as { tasks_completed?: number }).tasks_completed ?? 0,
      });
    }
  }

  // Build sets response — needed for sets field and titles/badges
  const setItems = buildSetsResponse(definitions, state, setDefinitions);
  const { titles, badges } = buildTitlesAndBadges(setItems, definitions);

  const recommend = (opts?.includeRecommend)
    ? getRecommendResponse(definitions, events, state, 'dashboard')
    : undefined;

  const questlines = questlineDefinitions
    ? buildQuestlinesResponse(questlineDefinitions, definitions, state)
    : undefined;

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
      streak: streakData,
      streak_multiplier: streakMultiplier,
      heatmap: toolStats?.daily
        ? computeHeatmapFromDaily(toolStats.daily as Record<string, { sessions: number }>)
        : computeHeatmap(events),
      tool_stats: toolStats,
      usage_xp: usageBreakdown.usage_xp,
      usage_breakdown: usageBreakdown,
      daily_stats: dailyStats,
    },
    timeline: buildTimeline(state.unlocked),
    sets: setItems,
    titles,
    badges,
    config: { lang: loadConfig().lang },
    ...(recommend ? { recommend } : {}),
    ...(questlines ? { questlines } : {}),
  };
}
