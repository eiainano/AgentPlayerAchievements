import type {
  AchievementDefinition,
  AchievementState,
  RecommendItem,
  TrackedEvent,
} from '../engine/types.js';

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
