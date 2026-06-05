import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AchievementEngine } from '../../src/engine/engine.js';

function tmpDir(): string {
  return path.join(os.tmpdir(), `agpa-engine-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('AchievementEngine', () => {
  let dir: string;
  let engine: AchievementEngine;

  beforeEach(() => {
    dir = tmpDir();
    engine = new AchievementEngine({ stateDir: dir });
  });

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  // ── detectToolSource ───────────────────────────────────────────

  describe('detectToolSource', () => {
    it('detects claude-code by name', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'claude-code', version: '1.0' });
      expect(eng.toolSource).toBe('claude-code');
    });

    it('detects claude-code via "claude" short name', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'claude', version: '1.0' });
      expect(eng.toolSource).toBe('claude-code');
    });

    it('detects kilocode', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'Kilo Code', version: '2.0' });
      expect(eng.toolSource).toBe('kilocode');
    });

    it('detects hermes', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'Hermes Agent', version: '1.0' });
      expect(eng.toolSource).toBe('hermes');
    });

    it('detects opencode', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'OpenCode', version: '1.0' });
      expect(eng.toolSource).toBe('opencode');
    });

    it('detects openclaw', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'OpenClaw', version: '0.1' });
      expect(eng.toolSource).toBe('openclaw');
    });

    it('ignores unknown clients (stays unknown)', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource({ name: 'VS Code', version: '1.0' });
      expect(eng.toolSource).toBe('unknown');
    });

    it('skips detection when toolSource is already set', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'hermes' });
      eng.detectToolSource({ name: 'claude-code', version: '1.0' });
      expect(eng.toolSource).toBe('hermes'); // unchanged
    });

    it('handles undefined clientInfo gracefully', () => {
      const eng = new AchievementEngine({ stateDir: dir, toolSource: 'unknown' });
      eng.detectToolSource(undefined);
      expect(eng.toolSource).toBe('unknown');
    });
  });

  // ── track ──────────────────────────────────────────────────────

  describe('track', () => {
    it('creates an event with correct event_type', () => {
      const event = engine.track('test.event');
      expect(event.event_type).toBe('test.event');
      expect(event.event_id).toBeTruthy();
      expect(event.protocol_version).toBe('1.0');
    });

    it('appends event to internal array', () => {
      engine.track('test.event');
      expect(engine.events).toHaveLength(1);
      expect(engine.events[0]!.event_type).toBe('test.event');
    });

    it('enriches session.start with hour and day_of_week', () => {
      const event = engine.track('session.start');
      expect(typeof event.payload.hour).toBe('number');
      expect(typeof event.payload.day_of_week).toBe('number');
    });

    it('sets sessionStartTime on session.start', () => {
      engine.track('session.start');
      expect(engine.sessionStartTime).not.toBeNull();
      expect(typeof engine.sessionStartTime).toBe('number');
    });

    it('computes elapsed_ms for task.complete after session.start', () => {
      engine.track('session.start');
      // slight real time delay
      const event = engine.track('task.complete');
      expect(event.payload.elapsed_ms).toBeGreaterThanOrEqual(0);
    });

    it('tracks model.switch to update currentModel', () => {
      expect(engine.currentModel).toBe('auto');
      engine.track('model.switch', { to: 'claude-opus-4-8' });
      expect(engine.currentModel).toBe('claude-opus-4-8');
    });

    it('includes task_id in context when set', () => {
      const engine = new AchievementEngine({ stateDir: dir, sessionId: 'test-session' });
      engine.taskId = 'task-123';
      const event = engine.track('tool.complete');
      expect(event.context.task_id).toBe('task-123');
    });
  });

  // ── stats ──────────────────────────────────────────────────────

  describe('stats', () => {
    it('returns zero counts with no definitions and no state', () => {
      const eng = new AchievementEngine({ stateDir: dir });
      eng.definitions = [];
      eng.state = { unlocked: {}, stats: { total_unlocked: 0 } };
      const s = eng.stats();
      expect(s.total_achievements).toBe(0);
      expect(s.unlocked).toBe(0);
      expect(s.total_events).toBe(0);
    });

    it('counts unlocked achievements correctly', () => {
      const eng = new AchievementEngine({ stateDir: dir });
      eng.definitions = [
        { id: 'a', category: 'test', rarity: 'common', conditions: [] } as any,
        { id: 'b', category: 'test', rarity: 'uncommon', conditions: [] } as any,
        { id: 'c', category: 'test', rarity: 'common', conditions: [] } as any,
      ];
      eng.state = { unlocked: { a: '2026-01-01T00:00:00Z' }, stats: { total_unlocked: 1 } };

      const s = eng.stats();
      expect(s.total_achievements).toBe(3);
      expect(s.unlocked).toBe(1);
      expect(s.by_rarity.common.unlocked).toBe(1);
      expect(s.by_rarity.common.total).toBe(2);
      expect(s.by_rarity.uncommon.unlocked).toBe(0);
    });
  });

  // ── resetState ─────────────────────────────────────────────────

  describe('resetState', () => {
    it('clears state and events, deletes files on disk', () => {
      // First, persist something
      engine.track('test.event');
      engine.state.unlocked = { test_ach: '2026-01-01T00:00:00Z' };

      engine.resetState();

      expect(Object.keys(engine.state.unlocked)).toHaveLength(0);
      expect(engine.events).toHaveLength(0);
      // Files on disk should also be gone
      const statePath = path.join(dir, 'state.json');
      const logPath = path.join(dir, 'event.log');
      const statsPath = path.join(dir, 'stats.json');
      const showcasePath = path.join(dir, 'showcase.json');
      expect(fs.existsSync(statePath)).toBe(false);
      expect(fs.existsSync(logPath)).toBe(false);
      expect(fs.existsSync(statsPath)).toBe(false);
      expect(fs.existsSync(showcasePath)).toBe(false);
    });
  });

  // ── reload ─────────────────────────────────────────────────────

  describe('reload', () => {
    it('re-reads state from disk after external changes', () => {
      // Simulate external write to state.json
      engine.state.unlocked = {};
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
        unlocked: { external_ach: '2026-06-05T00:00:00Z' },
        stats: { total_unlocked: 1 },
      }));
      // Also write an event.log
      fs.writeFileSync(path.join(dir, 'event.log'), JSON.stringify({
        protocol_version: '1.0',
        event_id: 'external-evt',
        timestamp: '2026-06-05T00:00:00Z',
        tool_source: 'test',
        event_type: 'external.event',
        payload: {},
        context: { session_id: 's1', model: 'auto' },
      }) + '\n');

      engine.reload();
      expect(engine.state.unlocked.external_ach).toBe('2026-06-05T00:00:00Z');
      expect(engine.events.some(e => e.event_type === 'external.event')).toBe(true);
    });
  });

  // ── reloadDefinitions ──────────────────────────────────────────

  describe('reloadDefinitions', () => {
    it('loads YAML definitions from disk, rejecting empty result', () => {
      // Reload from the real YAML file — should succeed with >0 definitions
      engine.reloadDefinitions();
      expect(engine.definitions.length).toBeGreaterThan(0);
      expect(engine.setDefinitions.length).toBeGreaterThan(0);
    });
  });

  // ── saveState / saveStats / appendEvents ───────────────────────

  describe('import helper methods', () => {
    it('saveState persists to disk and updates in-memory state', () => {
      const newState = { unlocked: { imported: '2026-01-01T00:00:00Z' }, stats: { total_unlocked: 1 } };
      engine.saveState(newState);
      expect(engine.state.unlocked.imported).toBe('2026-01-01T00:00:00Z');
      // Verify on disk
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf-8'));
      expect(onDisk.unlocked.imported).toBe('2026-01-01T00:00:00Z');
    });

    it('appendEvents adds events both in-memory and on disk', () => {
      engine.appendEvents([{
        protocol_version: '1.0',
        event_id: 'imported-evt',
        timestamp: '2026-01-01T00:00:00Z',
        tool_source: 'test',
        event_type: 'imported.event',
        payload: {},
        context: { session_id: 's1', model: 'auto' },
      }]);
      expect(engine.events).toHaveLength(1);
      expect(engine.events[0]!.event_type).toBe('imported.event');
      // Verify on disk
      const logContent = fs.readFileSync(path.join(dir, 'event.log'), 'utf-8');
      expect(logContent).toContain('imported-evt');
    });
  });

  // ── toolStats ──────────────────────────────────────────────────

  describe('toolStats', () => {
    it('returns a valid stats object even with no events', () => {
      const stats = engine.toolStats();
      expect(stats.version).toBe('2.0');
      expect(stats.sessions).toEqual({});
      expect(stats.user_messages).toEqual({});
      expect(typeof stats.daily).toBe('object');
    });

    it('returns cached stats after poll computes them', () => {
      // After poll, stats should be cached and returned from cache
      const st1 = engine.toolStats();
      const st2 = engine.toolStats();
      expect(st2.last_updated).toBe(st1.last_updated); // same cached version
    });
  });
});
