/**
 * Cascading unlock tests (code review P0 recommendation)
 *
 * Verifies the chain:
 *   1. poll() unlocks achievements → emits achievement.unlocked events
 *   2. Those events persist to disk
 *   3. Next poll() counts them → downstream achievements (trophy_case, casual_collector) unlock
 *
 * Without this chain, ~3 achievements are silently unreachable.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { AchievementEngine } from '../../src/engine/engine.js';
import { Store } from '../../src/engine/store.js';
import type { AchievementState } from '../../src/engine/types.js';

function tmpDir(): string {
  return path.join(os.tmpdir(), `agpa-cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('cascading unlocks', () => {
  // ── Bootstrap: init() creates achievement.unlocked from pre-existing state ──

  it('bootstrap: init() creates achievement.unlocked events from state → trophy_case unlocks', () => {
    const dir = tmpDir();
    const store = new Store(dir);
    const state: AchievementState = {
      unlocked: {
        prev_1: '2025-01-01T00:00:00Z',
        prev_2: '2025-01-02T00:00:00Z',
        prev_3: '2025-01-03T00:00:00Z',
        prev_4: '2025-01-04T00:00:00Z',
        prev_5: '2025-01-05T00:00:00Z',
        prev_6: '2025-01-06T00:00:00Z',
      },
      stats: { total_unlocked: 6 },
    };
    store.saveState(state);

    const engine = new AchievementEngine({ stateDir: dir });
    engine.init();

    // First poll: 6 achievement.unlocked events from bootstrap → trophy_case (>=6)
    const unlocked = engine.poll().map(a => a.id);
    expect(unlocked).toContain('trophy_case');
  });

  it('bootstrap: 5/6 pre-unlocked → first poll shows no trophy_case, sixth unlocks it', () => {
    const dir = tmpDir();
    const store = new Store(dir);
    store.saveState({
      unlocked: {
        a: '2025-01-01T00:00:00Z',
        b: '2025-01-02T00:00:00Z',
        c: '2025-01-03T00:00:00Z',
        d: '2025-01-04T00:00:00Z',
        e: '2025-01-05T00:00:00Z',
      },
      stats: { total_unlocked: 5 },
    });

    const engine = new AchievementEngine({ stateDir: dir });
    engine.init();

    // First poll: 5/6 for trophy_case
    const first = engine.poll();
    expect(first.find(a => a.id === 'trophy_case')).toBeUndefined();

    // Track one more achievement.unlocked directly
    engine.track('achievement.unlocked', { achievement_id: 'f', rarity: 'common' });

    // Second poll: 6/6 → trophy_case
    const second = engine.poll();
    expect(second.map(a => a.id)).toContain('trophy_case');
  });

  // ── Two-phase cascade: real achievements → emit → downstream ──

  it('three-poll cascade: real unlocks emit achievement.unlocked, downstream picks them up', () => {
    const dir = tmpDir();
    const store = new Store(dir);

    // Start with 5 pre-unlocked (bootstrap creates 5 achievement.unlocked events)
    store.saveState({
      unlocked: {
        s1: '2025-01-01T00:00:00Z', s2: '2025-01-02T00:00:00Z',
        s3: '2025-01-03T00:00:00Z', s4: '2025-01-04T00:00:00Z',
        s5: '2025-01-05T00:00:00Z',
      },
      stats: { total_unlocked: 5 },
    });

    const engine = new AchievementEngine({ stateDir: dir });
    engine.init();

    // ── Poll 1: 5/6, no trophy_case ──
    const poll1 = engine.poll();
    expect(poll1.find(a => a.id === 'trophy_case')).toBeUndefined();

    // ── Track events that unlock real achievements ──
    // first_contact (conversation.message >= 1) + tool_time (tool.complete >= 1)
    engine.track('session.start');
    engine.track('conversation.message', { role: 'user' });
    engine.track('tool.complete', { tool_name: 'Read' });

    // ── Poll 2: first_contact + tool_time unlock.
    //     poll() emits achievement.unlocked for each, BUT evaluateAll already ran
    //     so trophy_case still only sees 5 events (the bootstrap ones). ──
    const poll2 = engine.poll().map(a => a.id);
    expect(poll2).toContain('first_contact');
    expect(poll2).toContain('tool_time');
    // trophy_case should NOT unlock yet — the events from poll2 haven't been emitted yet
    // (evaluateAll runs before emission)
    expect(poll2).not.toContain('trophy_case');

    // ── Poll 3: the 2 achievement.unlocked events emitted in poll2 are now in the log ──
    const poll3 = engine.poll().map(a => a.id);
    // Now 5 (bootstrap) + 2 (from poll2) = 7 achievement.unlocked events
    expect(poll3).toContain('trophy_case');
  });

  // ── Persistence: events survive engine reload ──

  it('persistence: achievement.unlocked events survive engine.reload()', () => {
    const dir = tmpDir();
    const engine = new AchievementEngine({ stateDir: dir });
    engine.init();

    // Track 6 achievement.unlocked events directly
    for (let i = 0; i < 6; i++) {
      engine.track('achievement.unlocked', { achievement_id: `p${i}`, rarity: 'common' });
    }

    // Reload from disk (simulates mid-session restart)
    engine.reload();

    const unlocked = engine.poll().map(a => a.id);
    expect(unlocked).toContain('trophy_case');
  });

  it('persistence: achievement.unlocked events survive fresh engine construction', () => {
    const dir = tmpDir();
    const engine1 = new AchievementEngine({ stateDir: dir });
    engine1.init();

    for (let i = 0; i < 6; i++) {
      engine1.track('achievement.unlocked', { achievement_id: `q${i}`, rarity: 'common' });
    }

    // Fresh engine, same dir (simulates new session)
    const engine2 = new AchievementEngine({ stateDir: dir });
    engine2.init();

    const unlocked = engine2.poll().map(a => a.id);
    expect(unlocked).toContain('trophy_case');
  });

  // ── Casual collector (threshold 20) ──

  it('casual_collector unlocks at 20 achievement.unlocked events across two polls', () => {
    const dir = tmpDir();
    const engine = new AchievementEngine({ stateDir: dir });
    engine.init();

    // Track 19 achievement.unlocked events (one short of casual_collector)
    for (let i = 0; i < 19; i++) {
      engine.track('achievement.unlocked', { achievement_id: `c${i}`, rarity: 'common' });
    }

    const poll1 = engine.poll().map(a => a.id);
    expect(poll1).toContain('trophy_case');     // 19 >= 6
    expect(poll1).not.toContain('casual_collector'); // 19 < 20

    // Track 1 more
    engine.track('achievement.unlocked', { achievement_id: 'c20', rarity: 'common' });

    const poll2 = engine.poll().map(a => a.id);
    expect(poll2).toContain('casual_collector'); // 20 >= 20
  });
});
