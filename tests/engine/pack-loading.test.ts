/**
 * Pack Loading Tests
 *
 * Covers:
 * - parsePackYAML() validation (valid/invalid, missing fields, sets rejection)
 * - Engine pack loading (absent dir, valid packs, ID conflicts, error isolation)
 * - Pack achievement evaluation (unlock via poll)
 * - Pack removal on reload
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AchievementEngine } from '../../src/engine/engine.js';
import { parsePackYAML, isKnownEventType } from '../../src/engine/yaml-parser.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function tmpDir(): string {
  return path.join(os.tmpdir(), `agpa-pack-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

const VALID_PACK_YAML = `pack:
  id: battleaxe
  name: Battleaxe Pack
  author: community_hero
  version: 1.0.0
  description: Achievements for fearless warriors

definitions:
  - id: first_kill
    name: First Kill
    description: Complete your first task
    icon: ⚔️
    category: combat
    rarity: common
    conditions:
      - type: counter
        event: task.complete
        operator: ">="
        value: 1

  - id: warrior_spirit
    name: Warrior Spirit
    description: Complete 10 tasks in a single session
    icon: 🛡️
    category: combat
    rarity: uncommon
    conditions:
      - type: counter
        event: task.complete
        window: single_session
        operator: ">="
        value: 10
`;

const ANOTHER_VALID_PACK = `pack:
  id: mage_tower
  name: Mage Tower Pack
  author: wizard42
  version: 0.5.0

definitions:
  - id: first_spell
    name: First Spell
    description: Use 3 different tools
    icon: 🔮
    category: magic
    rarity: common
    conditions:
      - type: distinct_count
        event: tool.complete
        field: tool_name
        operator: ">="
        value: 3

  - id: ancient_knowledge
    name: Ancient Knowledge
    description: Read 100 files
    icon: 📜
    category: magic
    rarity: rare
    conditions:
      - type: counter
        event: file.read
        operator: ">="
        value: 100
`;

// ── parsePackYAML ──────────────────────────────────────────────────────────

describe('parsePackYAML', () => {
  it('parses a valid pack', () => {
    const result = parsePackYAML(VALID_PACK_YAML);
    expect(result.pack.id).toBe('battleaxe');
    expect(result.pack.name).toBe('Battleaxe Pack');
    expect(result.pack.author).toBe('community_hero');
    expect(result.pack.version).toBe('1.0.0');
    expect(result.pack.description).toBe('Achievements for fearless warriors');
    expect(result.definitions).toHaveLength(2);
    expect(result.definitions[0]!.id).toBe('first_kill');
    expect(result.definitions[1]!.id).toBe('warrior_spirit');
  });

  it('rejects pack missing pack block', () => {
    expect(() => parsePackYAML(`definitions: []`)).toThrow('missing required');
  });

  it('rejects pack missing pack.id', () => {
    expect(() => parsePackYAML(`pack:\n  name: No ID\n  author: x\n\ndefinitions: []`)).toThrow('missing required');
  });

  it('rejects pack missing pack.name', () => {
    expect(() => parsePackYAML(`pack:\n  id: no-name\n  author: x\n\ndefinitions: []`)).toThrow('missing required');
  });

  it('rejects pack missing pack.author', () => {
    expect(() => parsePackYAML(`pack:\n  id: no-author\n  name: X\n\ndefinitions: []`)).toThrow('missing required');
  });

  it('rejects pack.id with invalid format', () => {
    expect(() => parsePackYAML(`pack:\n  id: 123bad\n  name: X\n  author: x\n\ndefinitions: []`)).toThrow('must be lowercase');
    expect(() => parsePackYAML(`pack:\n  id: HAS_UPPER\n  name: X\n  author: x\n\ndefinitions: []`)).toThrow('must be lowercase');
    expect(() => parsePackYAML(`pack:\n  id: has space\n  name: X\n  author: x\n\ndefinitions: []`)).toThrow('must be lowercase');
  });

  it('rejects pack with sets', () => {
    const yaml = `pack:
  id: bad
  name: Bad
  author: x
  version: 1.0.0

definitions: []

sets:
  broken_set:
    name: Broken
    achievements: []
`;
    expect(() => parsePackYAML(yaml)).toThrow('may not define "sets"');
  });

  it('rejects pack with questlines', () => {
    const yaml = `pack:
  id: bad
  name: Bad
  author: x
  version: 1.0.0

definitions: []

questlines:
  - id: broken
    name: Broken
    icon: 💀
    stages: []
`;
    expect(() => parsePackYAML(yaml)).toThrow('may not define "questlines"');
  });

  it('validates condition fields using existing parser', () => {
    const yaml = `pack:
  id: validation-test
  name: Validation
  author: tester
  version: 1.0.0

definitions:
  - id: ok
    name: OK
    description: Works
    icon: ✅
    category: test
    rarity: common
    conditions:
      - type: unknown_type
        event: test.event
        value: 1
`;
    expect(() => parsePackYAML(yaml)).toThrow('unknown condition type');
  });

  it('warns on unknown event types (console.warn)', () => {
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => { warns.push(msg); };

    try {
      const yaml = `pack:
  id: unknown-events
  name: Unknown Events
  author: tester
  version: 1.0.0

definitions:
  - id: mystery
    name: Mystery
    description: Uses unknown event
    icon: ❓
    category: test
    rarity: common
    conditions:
      - type: counter
        event: totally_fake_event_xyz
        value: 1
`;
      parsePackYAML(yaml);
      expect(warns.some(w => w.includes('unknown event type'))).toBe(true);
      expect(warns.some(w => w.includes('totally_fake_event_xyz'))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  it('defaults version to 0.0.0 when absent', () => {
    const yaml = `pack:
  id: no-version
  name: No Version
  author: tester

definitions:
  - id: a
    name: A
    description: A
    icon: ✅
    category: test
    rarity: common
    conditions: []
`;
    const result = parsePackYAML(yaml);
    expect(result.pack.version).toBe('0.0.0');
  });

  it('rejects pack with no definitions', () => {
    const yaml = `pack:
  id: empty
  name: Empty
  author: tester
  version: 1.0.0

definitions: []
`;
    expect(() => parsePackYAML(yaml)).toThrow('no valid definitions');
  });
});

// ── isKnownEventType ───────────────────────────────────────────────────────

describe('isKnownEventType', () => {
  it('returns true for known event types', () => {
    expect(isKnownEventType('session.start')).toBe(true);
    expect(isKnownEventType('tool.complete')).toBe(true);
    expect(isKnownEventType('achievement.unlocked')).toBe(true);
  });

  it('returns false for unknown event types', () => {
    expect(isKnownEventType('my_custom_event')).toBe(false);
    expect(isKnownEventType('')).toBe(false);
  });
});

// ── Engine pack loading ────────────────────────────────────────────────────

describe('Engine pack loading', () => {
  let dir: string;
  let packsDir: string;

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  function createEnv(): void {
    dir = tmpDir();
    packsDir = path.join(dir, 'packs');
    fs.mkdirSync(packsDir, { recursive: true });
  }

  it('loads core achievements when packs dir does not exist', () => {
    dir = tmpDir();
    // No packs dir created at all
    const engine = new AchievementEngine({ stateDir: dir, packsDir: path.join(dir, 'nonexistent') });
    engine.init();
    expect(engine.packs).toEqual([]);
    expect(engine.packDefinitions).toEqual([]);
    expect(engine.definitions.length).toBeGreaterThan(0);
  });

  it('loads pack definitions when packs dir has valid pack YAML', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    expect(engine.packs).toHaveLength(1);
    expect(engine.packs[0]!.id).toBe('battleaxe');
    expect(engine.packDefinitions).toHaveLength(2);
    // Pack defs are appended to core defs
    const packDef = engine.definitions.find(d => d.pack_id === 'battleaxe');
    expect(packDef).toBeDefined();
    expect(packDef!.id).toBe('first_kill');
  });

  it('loads multiple packs in alphabetical order', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'z-pack.yaml'), ANOTHER_VALID_PACK);
    fs.writeFileSync(path.join(packsDir, 'a-pack.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    expect(engine.packs).toHaveLength(2);
    expect(engine.packs[0]!.id).toBe('battleaxe');    // a-pack first
    expect(engine.packs[1]!.id).toBe('mage_tower');   // z-pack second
  });

  it('rejects pack with ID conflict against core', () => {
    createEnv();
    // Use an ID that exists in core achievements
    const conflictingYaml = VALID_PACK_YAML.replace('first_kill', 'first_contact');
    fs.writeFileSync(path.join(packsDir, 'conflict.yaml'), conflictingYaml);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    // Conflict pack should be skipped with warning
    expect(engine.packs).toHaveLength(0);
    expect(engine.packDefinitions).toHaveLength(0);
  });

  it('rejects pack with ID conflict against another pack', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'pack1.yaml'), VALID_PACK_YAML);
    // Second pack with same IDs
    const duplicateYaml = VALID_PACK_YAML.replace('battleaxe', 'pack2');
    fs.writeFileSync(path.join(packsDir, 'pack2.yaml'), duplicateYaml);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    // pack1 loaded, pack2 skipped due to conflict
    expect(engine.packs).toHaveLength(1);
    expect(engine.packs[0]!.id).toBe('battleaxe');
  });

  it('continues loading other packs when one fails', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'good.yaml'), VALID_PACK_YAML);
    fs.writeFileSync(path.join(packsDir, 'bad.yaml'), 'not: valid: yaml::: {{{');

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    expect(engine.packs).toHaveLength(1);
    expect(engine.packs[0]!.id).toBe('battleaxe');
    expect(engine.packDefinitions).toHaveLength(2);
  });

  it('annotates definitions with pack_id', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    for (const def of engine.packDefinitions) {
      expect(def.pack_id).toBe('battleaxe');
    }
    // Core definitions should NOT have pack_id
    const coreDefs = engine.definitions.filter(d => !d.pack_id);
    expect(coreDefs.length).toBeGreaterThan(0);
  });

  it('evaluates pack achievements via poll() and they unlock', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();
    engine.resetState();

    // Track events to trigger pack achievement 'first_kill' (task.complete >= 1)
    engine.track('task.complete', {});
    const unlocked = engine.poll().map(a => a.id);

    expect(unlocked).toContain('first_kill');
    expect(engine.state.unlocked['first_kill']).toBeDefined();
  });

  it('preserves pack unlock data in state.json', () => {
    createEnv();
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();
    engine.resetState();

    // Unlock pack achievement
    engine.track('task.complete', {});
    engine.poll();
    expect(engine.state.unlocked['first_kill']).toBeDefined();

    // Re-init (simulates restart) — state should persist
    const engine2 = new AchievementEngine({ stateDir: dir, packsDir });
    engine2.init();
    expect(engine2.state.unlocked['first_kill']).toBeDefined();
  });
});

// ── Pack removal on reload ─────────────────────────────────────────────────

describe('Pack removal on reload', () => {
  let dir: string;
  let packsDir: string;

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  it('removes pack defs from engine on reloadDefinitions after file deletion', () => {
    dir = tmpDir();
    packsDir = path.join(dir, 'packs');
    fs.mkdirSync(packsDir, { recursive: true });
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();
    expect(engine.packs).toHaveLength(1);

    // Delete pack file and reload
    fs.unlinkSync(path.join(packsDir, 'battleaxe.yaml'));
    engine.reloadDefinitions();

    expect(engine.packs).toHaveLength(0);
    expect(engine.packDefinitions).toHaveLength(0);
    // Core defs should still be intact
    expect(engine.definitions.length).toBeGreaterThan(0);
  });

  it('preserves unlock state after pack removal and reinstallation', () => {
    dir = tmpDir();
    packsDir = path.join(dir, 'packs');
    fs.mkdirSync(packsDir, { recursive: true });
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();
    engine.resetState();

    // Unlock pack achievement
    engine.track('task.complete', {});
    engine.poll();
    expect(engine.state.unlocked['first_kill']).toBeDefined();

    // Remove pack file and reload
    fs.unlinkSync(path.join(packsDir, 'battleaxe.yaml'));
    engine.reloadDefinitions();

    // State still has the unlock even though pack is gone
    expect(engine.state.unlocked['first_kill']).toBeDefined();
    expect(engine.packs).toHaveLength(0);

    // Re-add pack file and reload
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);
    engine.reloadDefinitions();

    expect(engine.packs).toHaveLength(1);
    // Previous unlock is still recognized
    expect(engine.state.unlocked['first_kill']).toBeDefined();
  });
});

// ── getPackInfo ────────────────────────────────────────────────────────────

describe('getPackInfo', () => {
  let dir: string;
  let packsDir: string;

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  it('returns pack info for a loaded pack', () => {
    dir = tmpDir();
    packsDir = path.join(dir, 'packs');
    fs.mkdirSync(packsDir, { recursive: true });
    fs.writeFileSync(path.join(packsDir, 'battleaxe.yaml'), VALID_PACK_YAML);

    const engine = new AchievementEngine({ stateDir: dir, packsDir });
    engine.init();

    const info = engine.getPackInfo('battleaxe');
    expect(info).not.toBeNull();
    expect(info!.pack.name).toBe('Battleaxe Pack');
    expect(info!.definitions).toHaveLength(2);
  });

  it('returns null for unknown pack ID', () => {
    dir = tmpDir();
    const engine = new AchievementEngine({ stateDir: dir });
    engine.init();
    expect(engine.getPackInfo('nonexistent')).toBeNull();
  });
});
