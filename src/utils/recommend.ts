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
