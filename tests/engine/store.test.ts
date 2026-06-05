import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Store } from '../../src/engine/store.js';
import type { AchievementState, TrackedEvent } from '../../src/engine/types.js';
import type { AgentToolStats } from '../../src/engine/stats.js';

function tmpDir(): string {
  return path.join(os.tmpdir(), `agpa-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function touchFile(dir: string, name: string, content: string = '{}'): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
}

describe('Store', () => {
  let dir: string;
  let store: Store;

  beforeEach(() => {
    dir = tmpDir();
    store = new Store(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('load()', () => {
    it('returns defaults when no files exist', () => {
      const { state, events } = store.load();
      expect(state.unlocked).toEqual({});
      expect(state.stats.total_unlocked).toBe(0);
      expect(events).toEqual([]);
    });

    it('recovers from corrupt state.json via safeParse fallback', () => {
      touchFile(dir, 'event.log', '');
      fs.writeFileSync(path.join(dir, 'state.json'), 'not valid json');
      const { state } = store.load();
      expect(state.unlocked).toEqual({});
      expect(state.stats.total_unlocked).toBe(0);
    });

    it('recovers from corrupt event.log line via safeParse', () => {
      touchFile(dir, 'state.json', JSON.stringify({ unlocked: {}, stats: { total_unlocked: 0 } }));
      // One good line, one corrupt
      const goodEvent = {
        protocol_version: '1.0',
        event_id: 'evt-1',
        timestamp: '2026-01-01T00:00:00Z',
        tool_source: 'test',
        event_type: 'test.event',
        payload: {},
        context: { session_id: 's1', model: 'auto' },
      };
      fs.writeFileSync(path.join(dir, 'event.log'),
        JSON.stringify(goodEvent) + '\ncorrupt line\n');
      const { events } = store.load();
      expect(events).toHaveLength(1);
      expect(events[0]!.event_id).toBe('evt-1');
    });

    it('loads persisted data after saveState + appendEvent', () => {
      const state: AchievementState = {
        unlocked: { first_contact: '2026-01-01T00:00:00Z' },
        stats: { total_unlocked: 1 },
      };
      store.saveState(state);

      const evt: TrackedEvent = {
        protocol_version: '1.0',
        event_id: 'evt-1',
        timestamp: '2026-01-01T00:00:00Z',
        tool_source: 'test',
        event_type: 'test.event',
        payload: {},
        context: { session_id: 's1', model: 'auto' },
      };
      store.appendEvent(evt);

      const result = store.load();
      expect(result.state.unlocked.first_contact).toBe('2026-01-01T00:00:00Z');
      expect(result.state.stats.total_unlocked).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.event_id).toBe('evt-1');
    });
  });

  describe('reset()', () => {
    it('removes all state files', () => {
      // Setup: write all 4 files
      touchFile(dir, 'state.json', JSON.stringify({ unlocked: {}, stats: { total_unlocked: 0 } }));
      touchFile(dir, 'event.log', '{"event_id":"e1"}\n');
      touchFile(dir, 'showcase.json', JSON.stringify({ slots: [null, null, null, null, null, null] }));
      touchFile(dir, 'stats.json', JSON.stringify({
        version: '2.0', last_updated: '2026-01-01T00:00:00Z',
        sessions: {}, user_messages: {}, usage_time_ms: {},
      }));

      store.reset();

      expect(fs.existsSync(path.join(dir, 'state.json'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'event.log'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'showcase.json'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'stats.json'))).toBe(false);
      // Dir should still exist
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('after reset, load() returns empty defaults', () => {
      // Pre-populate
      store.saveState({ unlocked: { test: '2026-01-01' }, stats: { total_unlocked: 1 } });
      store.appendEvent({
        protocol_version: '1.0',
        event_id: 'e1', timestamp: '2026-01-01T00:00:00Z',
        tool_source: 'test', event_type: 'test.event',
        payload: {}, context: { session_id: 's1', model: 'auto' },
      });

      store.reset();
      const { state, events } = store.load();
      expect(state.unlocked).toEqual({});
      expect(events).toEqual([]);
    });
  });

  describe('loadStats() / saveStats()', () => {
    it('returns null when stats.json missing', () => {
      expect(store.loadStats()).toBeNull();
    });

    it('returns null when stats.json is corrupt', () => {
      touchFile(dir, 'stats.json', 'corrupt');
      expect(store.loadStats()).toBeNull();
    });

    it('round-trips stats data', () => {
      const stats: AgentToolStats = {
        version: '2.0',
        last_updated: '2026-06-05T00:00:00Z',
        sessions: { 'claude-code': 3 },
        user_messages: { 'claude-code': 10 },
        usage_time_ms: { 'claude-code': 5000 },
        last_aggregated_line: 42,
        daily: {
          '2026-06-05': {
            tool_calls: 15, sessions: 3, user_msgs: 10,
            tokens: 50000, unique_tools: 4, duration_secs: 120,
            tools_used: ['Read', 'Edit', 'Bash', 'Grep'],
          },
        },
      };
      store.saveStats(stats);
      const loaded = store.loadStats();
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe('2.0');
      expect(loaded!.sessions['claude-code']).toBe(3);
      expect(loaded!.last_aggregated_line).toBe(42);
      expect(loaded!.daily!['2026-06-05'].tool_calls).toBe(15);
      expect(loaded!.daily!['2026-06-05'].tools_used).toEqual(['Read', 'Edit', 'Bash', 'Grep']);
    });

    it('loadStats() returns null for mismatched schema', () => {
      // Missing required fields → safeParse returns null
      touchFile(dir, 'stats.json', JSON.stringify({ version: '2.0' }));
      expect(store.loadStats()).toBeNull();
    });
  });

  describe('appendEvent()', () => {
    it('creates event.log if missing', () => {
      store.appendEvent({
        protocol_version: '1.0',
        event_id: 'e1', timestamp: '2026-01-01T00:00:00Z',
        tool_source: 'test', event_type: 'test.event',
        payload: {}, context: { session_id: 's1', model: 'auto' },
      });
      expect(fs.existsSync(path.join(dir, 'event.log'))).toBe(true);
      const { events } = store.load();
      expect(events).toHaveLength(1);
    });

    it('appends to existing event.log', () => {
      store.appendEvent({
        protocol_version: '1.0',
        event_id: 'e1', timestamp: '2026-01-01T00:00:00Z',
        tool_source: 'test', event_type: 'test.event',
        payload: {}, context: { session_id: 's1', model: 'auto' },
      });
      store.appendEvent({
        protocol_version: '1.0',
        event_id: 'e2', timestamp: '2026-01-02T00:00:00Z',
        tool_source: 'test', event_type: 'test.event',
        payload: {}, context: { session_id: 's1', model: 'auto' },
      });
      const { events } = store.load();
      expect(events).toHaveLength(2);
      expect(events[0]!.event_id).toBe('e1');
      expect(events[1]!.event_id).toBe('e2');
    });
  });
});
