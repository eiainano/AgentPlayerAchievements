import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AchievementEngine } from '../src/engine/engine.js';
import type { AchievementDefinition } from '../src/engine/types.js';
import {
  formatAchievement, computeSetProgress,
  loadShowcase, saveShowcase, RARITY_RANK,
} from '../src/helpers.js';

describe('RARITY_RANK', () => {
  it('has all 6 rarities with mythic highest', () => {
    expect(RARITY_RANK.common).toBe(0);
    expect(RARITY_RANK.uncommon).toBe(1);
    expect(RARITY_RANK.rare).toBe(2);
    expect(RARITY_RANK.epic).toBe(3);
    expect(RARITY_RANK.legendary).toBe(4);
    expect(RARITY_RANK.mythic).toBe(5);
  });
});

describe('formatAchievement', () => {
  it('includes all basic fields', () => {
    const eng = new AchievementEngine({ stateDir: '/tmp/nonexistent' });
    // Minimal setup so computeSetProgress doesn't fail on set_id
    eng.definitions = [];

    const def: AchievementDefinition = {
      id: 'test_ach', name: 'Test', description: 'A test achievement',
      icon: '🏆', category: 'testing', rarity: 'rare',
      conditions: [],
    };
    const result = formatAchievement(eng, def);
    expect(result.id).toBe('test_ach');
    expect(result.name).toBe('Test');
    expect(result.description).toBe('A test achievement');
    expect(result.icon).toBe('🏆');
    expect(result.rarity).toBe('rare');
    expect(result.category).toBe('testing');
    expect(result.unlocked_at).toBeUndefined();
    expect(result.set_progress).toBeUndefined();
    expect(result.hidden).toBeUndefined();
  });

  it('includes optional fields when present', () => {
    const eng = new AchievementEngine({ stateDir: '/tmp/nonexistent' });
    eng.definitions = [];

    const def: AchievementDefinition = {
      id: 'hidden_one', name: 'Hidden', description: 'Secret',
      icon: '🤫', category: 'hidden', rarity: 'mythic',
      hidden: true, unlocked_at: '2026-01-01T00:00:00Z',
      conditions: [],
    };
    const result = formatAchievement(eng, def);
    expect(result.hidden).toBe(true);
    expect(result.unlocked_at).toBe('2026-01-01T00:00:00Z');
  });

  it('includes set_progress when achievement has set_id', () => {
    const eng = new AchievementEngine({ stateDir: '/tmp/nonexistent' });
    eng.definitions = [
      { id: 'member1', set_id: 'test_set', conditions: [] } as AchievementDefinition,
      { id: 'member2', set_id: 'test_set', conditions: [] } as AchievementDefinition,
      { id: 'member3', set_id: 'test_set', conditions: [] } as AchievementDefinition,
      { id: 'the_ach', set_id: 'test_set', conditions: [] } as AchievementDefinition,
    ];
    eng.state.unlocked = { member1: '2026-01-01T00:00:00Z', member3: '2026-01-02T00:00:00Z' };
    // the_ach not yet unlocked

    const def = eng.definitions.find(d => d.id === 'the_ach')!;
    const result = formatAchievement(eng, def);
    expect(result.set_progress).toEqual({
      current: 2, total: 4,
      members: ['member1', 'member2', 'member3', 'the_ach'],
    });
  });
});

describe('computeSetProgress', () => {
  it('returns undefined for unknown set', () => {
    const eng = new AchievementEngine({ stateDir: '/tmp/nonexistent' });
    eng.definitions = [];
    expect(computeSetProgress(eng, 'nonexistent')).toBeUndefined();
  });

  it('returns correct unlocked/total counts', () => {
    const eng = new AchievementEngine({ stateDir: '/tmp/nonexistent' });
    eng.definitions = [
      { id: 'a', set_id: 'my_set', conditions: [] } as AchievementDefinition,
      { id: 'b', set_id: 'my_set', conditions: [] } as AchievementDefinition,
      { id: 'c', set_id: 'my_set', conditions: [] } as AchievementDefinition,
    ];
    eng.state.unlocked = { a: '2026-01-01T00:00:00Z', c: '2026-01-02T00:00:00Z' };
    expect(computeSetProgress(eng, 'my_set')).toEqual({
      current: 2, total: 3,
      members: ['a', 'b', 'c'],
    });
  });

  it('filters members by set_id only', () => {
    const eng = new AchievementEngine({ stateDir: '/tmp/nonexistent' });
    eng.definitions = [
      { id: 'in_set', set_id: 's1', conditions: [] } as AchievementDefinition,
      { id: 'no_set', conditions: [] } as AchievementDefinition,
      { id: 'other_set', set_id: 's2', conditions: [] } as AchievementDefinition,
    ];
    eng.state.unlocked = {};
    const result = computeSetProgress(eng, 's1');
    expect(result!.total).toBe(1);
    expect(result!.members).toEqual(['in_set']);
  });
});

describe('loadShowcase / saveShowcase', () => {
  let dir: string;

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `agpa-helpers-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loadShowcase returns 6 null slots when no file', () => {
    const result = loadShowcase(dir);
    expect(result.slots).toHaveLength(6);
    expect(result.slots.every(s => s === null)).toBe(true);
  });

  it('loadShowcase recovers from corrupt JSON', () => {
    fs.writeFileSync(path.join(dir, 'showcase.json'), 'corrupt');
    const result = loadShowcase(dir);
    expect(result.slots).toHaveLength(6);
    expect(result.slots.every(s => s === null)).toBe(true);
  });

  it('saveShowcase and loadShowcase round-trip correctly', () => {
    const data = { slots: ['ach1', null, 'ach2', null, null, 'ach3'] };
    saveShowcase(dir, data);
    const loaded = loadShowcase(dir);
    expect(loaded.slots).toEqual(data.slots);
  });

  it('saveShowcase creates directory if missing', () => {
    const missingDir = path.join(os.tmpdir(), `agpa-helpers-missing-${Date.now()}`);
    try {
      saveShowcase(missingDir, { slots: [null, null, null, null, null, 'test'] });
      expect(fs.existsSync(missingDir)).toBe(true);
      const loaded = loadShowcase(missingDir);
      expect(loaded.slots[5]).toBe('test');
    } finally {
      fs.rmSync(missingDir, { recursive: true, force: true });
    }
  });

  it('validates schema on load — rejects wrong data shape', () => {
    saveShowcase(dir, { slots: 'not-an-array' } as unknown as { slots: (string | null)[] });
    // Schema validation fails → returns fallback with 6 nulls
    const result = loadShowcase(dir);
    expect(result.slots).toHaveLength(6);
    expect(result.slots.every(s => s === null)).toBe(true);
  });
});
