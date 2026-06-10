import { describe, it, expect } from 'vitest';
import { buildAchievementsResponse, buildSetsResponse, buildQuestlinesResponse } from '../../src/dashboard/api.js';
import type { AchievementDefinition, AchievementState, QuestlineDefinition } from '../../src/engine/types.js';

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
    const result = buildSetsResponse(defs, state, []);
    expect(Array.isArray(result)).toBe(true);
  });

  it('groups achievements by set_id', () => {
    const defsWithSets: AchievementDefinition[] = [
      makeDef({ id: 's1', name: 'S1', set_id: 'set_a', conditions: [] }),
      makeDef({ id: 's2', name: 'S2', set_id: 'set_a', conditions: [] }),
      makeDef({ id: 's3', name: 'S3', set_id: 'set_b', conditions: [] }),
    ];
    const result = buildSetsResponse(defsWithSets, state, []);
    expect(result).toHaveLength(2);
    const setA = result.find(s => s.id === 'set_a')!;
    expect(setA.total).toBe(2);
    expect(setA.completed).toBe(0); // none of set_a members are in state.unlocked
  });
});

describe('buildQuestlinesResponse', () => {
  it('builds questline items with stage progress', () => {
    const defs: any[] = [
      { id: 'ach_a', name: 'A', description: '', icon: '🌟', category: 'test', rarity: 'common', conditions: [] },
      { id: 'ach_b', name: 'B', description: '', icon: '🌟', category: 'test', rarity: 'common', conditions: [] },
      { id: 'ach_c', name: 'C', description: '', icon: '🌟', category: 'test', rarity: 'common', conditions: [] },
    ];
    const qDefs: QuestlineDefinition[] = [{
      id: 'test_quest',
      name: 'Test Quest',
      icon: '🐛',
      description: 'A test',
      description_cn: '测试',
      stages: [
        { stage: 1, name: 'S1', name_cn: 'S1阶段', achievements: ['ach_a', 'ach_b'] },
        { stage: 2, name: 'S2', name_cn: 'S2阶段', achievements: ['ach_c'] },
      ],
      reward: { type: 'title', value: 'Winner' },
    }];
    const state: any = { unlocked: { ach_a: '2026-01-01T00:00:00Z' } };
    const result = buildQuestlinesResponse(qDefs, defs as any, state);
    expect(result).toHaveLength(1);
    expect(result[0]!.unlocked_count).toBe(1);
    expect(result[0]!.total_count).toBe(3);
    expect(result[0]!.current_stage).toBe(1);
    expect(result[0]!.completed).toBe(false);
  });

  it('returns empty array when no questline definitions', () => {
    const result = buildQuestlinesResponse([], [], {} as any);
    expect(result).toEqual([]);
  });
});
