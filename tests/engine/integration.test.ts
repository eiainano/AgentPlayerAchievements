import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { AchievementEngine } from '../../src/engine/engine.js';
import type { AchievementDefinition } from '../../src/engine/types.js';

const TEMP_DIR = path.join(os.tmpdir(), `agpa-integration-test-${Date.now()}`);

function createEngine(): AchievementEngine {
  const engine = new AchievementEngine({ stateDir: TEMP_DIR });
  engine.resetState();
  engine.init();
  return engine;
}

describe('integration: real YAML definitions', () => {
  it('loads all 138 achievements without errors', () => {
    const engine = createEngine();
    expect(engine.definitions.length).toBe(138);
  });

  it('unlocks basic achievements in a minimal session', () => {
    const engine = createEngine();

    // Simulate one session
    engine.track('session.start');
    engine.track('conversation.message');
    engine.track('conversation.message');
    engine.track('conversation.message');
    engine.track('tool.complete', { tool_name: 'Read' });
    engine.track('conversation.message');
    engine.track('tool.complete', { tool_name: 'Edit' });
    engine.track('conversation.message');
    engine.track('tool.complete', { tool_name: 'Bash' });
    engine.track('task.complete');
    engine.track('session.end');

    const unlocked = engine.poll();

    // Expect at least: first_contact (1st message), tool_time (1st tool)
    const ids = unlocked.map(a => a.id);
    expect(ids).toContain('first_contact');
    expect(ids).toContain('tool_time');

    console.log(`\n  Minimal session unlocked ${unlocked.length}:`);
    for (const ach of unlocked) {
      console.log(`    ${ach.icon} ${ach.id} [${ach.rarity}] ${ach.name}`);
    }
  });

  it('unlocks more after simulated heavy usage', () => {
    const engine = createEngine();

    // 5 sessions of heavy activity
    const toolNames = ['Read', 'Edit', 'Bash', 'Write', 'Grep', 'WebSearch', 'WebFetch', 'Glob'];
    for (let s = 0; s < 5; s++) {
      engine.track('session.start');
      for (let i = 0; i < 8; i++) {
        engine.track('conversation.message');
        engine.track('tool.complete', { tool_name: toolNames[i % toolNames.length]! });
      }
      engine.track('task.complete');
      engine.track('task.complete');
      engine.track('session.end');
    }

    const unlocked = engine.poll();

    console.log(`\n  5-session unlock: ${unlocked.length} total`);
    const ids = unlocked.map(a => a.id);
    expect(ids).toContain('first_contact');
    expect(ids).toContain('three_company'); // 3 tasks
    expect(ids).toContain('tool_time');
  });

  it('reports condition types actually used in YAML', () => {
    const engine = createEngine();

    const types = new Set<string>();
    let totalConds = 0;
    for (const def of engine.definitions) {
      for (const cond of def.conditions) {
        types.add(cond.type);
        totalConds++;
      }
    }

    const defined = [...types].sort();
    console.log(`\n  Condition types in YAML: ${defined.join(', ')}`);

    // All 12 condition types should be handled
    const unimplemented = defined.filter(t => ![
      'counter', 'threshold', 'streak', 'sequence', 'distinct_count', 'event',
      'set_completion', 'mode', 'sequence_count', 'pattern_match', 'ratio',
    ].includes(t));

    if (unimplemented.length > 0) {
      console.log(`  ⚠️  Missing: ${unimplemented.join(', ')}`);
    }
    expect(unimplemented.length).toBe(0);
    expect(totalConds).toBeGreaterThan(0);
  });
});
