import { describe, it, expect } from 'vitest';
import { buildAchievementsResponse, buildSetsResponse } from '../../src/dashboard/api.js';
import type { AchievementDefinition, AchievementState } from '../../src/engine/types.js';

function makeDef(overrides: Partial<AchievementDefinition>): AchievementDefinition {
  return {
    id: 'test',
    name: 'Test',
    description: 'A test achievement',
    icon: '🏆',
    category: 'onboarding',
    rarity: 'common',
    conditions: [],
    ...overrides,
    // ensure conditions is always an array
    conditions: overrides.conditions || [],
  };
}

const defs: AchievementDefinition[] = [
  makeDef({ id: 'ach_a', name: 'A', category: 'onboarding', rarity: 'common', conditions: [{ type: 'counter' as const, event: 'task.complete', value: 1 }] }),
  makeDef({ id: 'ach_b', name: 'B', category: 'skill', rarity: 'epic', conditions: [{ type: 'counter' as const, event: 'tool.complete', value: 10 }] }),
  makeDef({ id: 'ach_c', name: 'C', category: 'onboarding', rarity: 'rare', hidden: true, conditions: [{ type: 'counter' as const, event: 'tool.complete', value: 5 }] }),
  makeDef({ id: 'ach_d', name: 'D', category: 'style', rarity: 'mythic', conditions: [] }),
];

const state: AchievementState = {
  unlocked: { ach_a: '2026-05-01T00:00:00Z', ach_b: '2026-05-15T00:00:00Z' },
  stats: { total_unlocked: 2 },
};

describe('buildAchievementsResponse', () => {
  it('marks unlocked achievements with unlocked_at', () => {
    const result = buildAchievementsResponse(defs, state, { events: [], taskCount: 0 });
    const a = result.find(r => r.id === 'ach_a')!;
    expect(a.unlocked).toBe(true);
    expect(a.unlocked_at).toBe('2026-05-01T00:00:00Z');
  });

  it('marks locked achievements with progress', () => {
    const result = buildAchievementsResponse(defs, state, { events: [], taskCount: 0 });
    const c = result.find(r => r.id === 'ach_c')!;
    expect(c.unlocked).toBe(false);
    expect(c.progress).toBeDefined();
  });

  it('includes all achievements', () => {
    const result = buildAchievementsResponse(defs, state, { events: [], taskCount: 0 });
    expect(result).toHaveLength(4);
  });
});

describe('buildSetsResponse', () => {
  it('returns empty array when no sets', () => {
    const result = buildSetsResponse(defs, state);
    expect(Array.isArray(result)).toBe(true);
  });

  it('groups achievements by set_id', () => {
    const defsWithSets: AchievementDefinition[] = [
      makeDef({ id: 's1', name: 'S1', set_id: 'set_a', conditions: [] }),
      makeDef({ id: 's2', name: 'S2', set_id: 'set_a', conditions: [] }),
      makeDef({ id: 's3', name: 'S3', set_id: 'set_b', conditions: [] }),
    ];
    const result = buildSetsResponse(defsWithSets, state);
    expect(result).toHaveLength(2);
    const setA = result.find(s => s.id === 'set_a')!;
    expect(setA.total).toBe(2);
    expect(setA.completed).toBe(0); // none of set_a members are in state.unlocked
  });
});
