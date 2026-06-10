import type {
  AchievementDefinition,
  AchievementState,
  RarityLevel,
  RecommendItem,
  TrackedEvent,
} from '../engine/types.js';
import { findNearUnlocks, type NearUnlock } from './progress-nudge.js';

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

/**
 * recommendDiscovery — event blind-spot algorithm.
 *
 * Scans all achievement definitions for ones whose primary condition's event
 * type has NEVER appeared in the event log. Returns the lowest-rarity such
 * achievement (or null if all event types have been touched).
 *
 * Filtered out:
 *  - Already-unlocked achievements
 *  - Hidden achievements
 *  - Achievements with no condition or no event on the first condition
 */
export function recommendDiscovery(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
): RecommendItem | null {
  const triggeredTypes = new Set(events.map((e) => e.event_type));

  const candidates: AchievementDefinition[] = [];
  for (const def of definitions) {
    if (state.unlocked[def.id]) continue;
    if (def.hidden) continue;
    const cond = def.conditions[0];
    if (!cond) continue;
    if (!cond.event) continue;
    if (triggeredTypes.has(cond.event)) continue;
    candidates.push(def);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const ra = RARITY_ORDER[a.rarity] ?? 99;
    const rb = RARITY_ORDER[b.rarity] ?? 99;
    return ra - rb;
  });

  const pick = candidates[0]!;
  const cond = pick.conditions[0]!;

  return {
    category: 'discovery',
    achievement_id: pick.id,
    name: pick.name,
    name_cn: pick.name_cn,
    icon: pick.icon || '🔍',
    rarity: pick.rarity,
    discovery_event: cond.event,
  };
}

export function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function recommendSurprise(
  definitions: AchievementDefinition[],
  state: AchievementState,
  sessionId: string,
): RecommendItem | null {
  const pool = definitions.filter(d =>
    d.hidden === true
    && d.future !== true
    && !state.unlocked[d.id]
    && !!(d.hint_cn || d.hint),
  );

  if (pool.length === 0) return null;

  const index = hashString(sessionId) % pool.length;
  const pick = pool[index]!;

  return {
    category: 'surprise',
    achievement_id: pick.id,
    name: '',
    name_cn: '',
    icon: '?',
    rarity: pick.rarity,
    hint: pick.hint ?? null,
    hint_cn: pick.hint_cn ?? null,
  };
}

export function recommendNearWin(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
): RecommendItem[] {
  const near = findNearUnlocks(definitions, events, state, { maxResults: 5, minProgress: 0.01 });
  return near.map((n: NearUnlock) => ({
    category: 'near_win' as const,
    achievement_id: n.achievement_id,
    name: n.name,
    icon: n.icon,
    rarity: n.rarity as RarityLevel,
    progress: { current: n.current, target: n.target, pct: n.target > 0 ? Math.round((n.current / n.target) * 100) : 0 },
    unit_label: n.unit_label,
  }));
}

export function getRecommendResponse(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
  sessionId: string,
): import('../engine/types.js').RecommendResponse {
  return {
    near_win: recommendNearWin(definitions, events, state),
    discovery: recommendDiscovery(definitions, events, state),
    surprise: recommendSurprise(definitions, state, sessionId),
    generated_at: new Date().toISOString(),
    session_id: sessionId,
  };
}

export const DISCOVERY_REASON_MAP: Record<string, { en: string; zh: string }> = {
  'agent.spawn':   { en: "You haven't tried Agent mode yet", zh: '你还没用过 Agent 模式' },
  'skill.invoke':  { en: "You haven't used Custom Skills yet", zh: '你还没用过自定义技能' },
  'mcp.connect':   { en: "You haven't connected an MCP server", zh: '你还没连接过 MCP 服务器' },
  'plan.enter':    { en: "You haven't used Plan Mode yet", zh: '你还没用过计划模式' },
  'plan.exit':     { en: "You haven't used Plan Mode yet", zh: '你还没用过计划模式' },
  'file.create':   { en: "You haven't created any files yet", zh: '你还没创建过文件' },
  'file.edit':     { en: "You haven't edited any files yet", zh: '你还没编辑过文件' },
  'file.delete':   { en: "You haven't deleted any files yet", zh: '你还没删除过文件' },
  'image.upload':  { en: "You haven't uploaded any images yet", zh: '你还没上传过图片' },
  'command.run':   { en: "You haven't run any commands yet", zh: '你还没运行过命令' },
  'task.create':   { en: "You haven't created any tasks yet", zh: '你还没创建过任务' },
  'task.update':   { en: "You haven't updated any tasks yet", zh: '你还没更新过任务' },
};

export function getDiscoveryReason(eventType: string, lang: 'en' | 'zh'): string {
  const entry = DISCOVERY_REASON_MAP[eventType];
  if (!entry) return lang === 'zh' ? '一个你未曾尝试过的新功能' : 'a new feature';
  return entry[lang];
}

export function buildRecommendationPrompt(
  item: import('../engine/types.js').RecommendItem,
  lang: 'en' | 'zh',
): string {
  if (item.category === 'surprise') {
    return lang === 'zh'
      ? `🎲 探索提示: ${item.hint_cn || item.hint}\n\n在回复结尾，用一句自然的话引导用户注意这条线索。不要暴露成就名称或具体条件——保持神秘感。`
      : `🎲 Discovery hint: ${item.hint}\n\nAt the end of your reply, naturally guide the user toward this clue. Do NOT reveal the achievement name or unlock conditions — keep it mysterious.`;
  }
  if (item.category === 'discovery') {
    const reason = getDiscoveryReason(item.discovery_event!, lang);
    return lang === 'zh'
      ? `💡 新功能推荐: ${item.name_cn || item.name} — ${reason}\n\n在回复结尾，用一句自然的话引导用户尝试这个他们还没用过的功能。`
      : `💡 Feature discovery: ${item.name} — ${reason}\n\nAt the end of your reply, naturally suggest the user try this feature they haven't explored yet.`;
  }
  const pct = item.progress?.pct ?? 0;
  return lang === 'zh'
    ? `🎯 近在咫尺: ${item.name_cn || item.name}（已完成 ${pct}%）\n\n在回复结尾，用一句自然的话提醒用户这个成就近在眼前，鼓励加把劲解锁它。`
    : `🎯 Near win: ${item.name}（${pct}% complete）\n\nAt the end of your reply, naturally remind the user this achievement is close and encourage them to push for it.`;
}
