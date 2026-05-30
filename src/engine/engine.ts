import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseYAML } from './yaml-parser.js';
import { evaluateAll } from './evaluator.js';
import { Store } from './store.js';
import { runTelemetry } from '../telemetry.js';
import type {
  TrackedEvent, EventType, EventPayload,
  AchievementDefinition, AchievementState, AchievementStats,
  EngineOptions, SetDefinition,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const TOOL_SOURCE_MAP: Record<string, string> = {
  'claude-code': 'claude-code',
  'claude': 'claude-code',
  'kilo': 'kilocode',
  'kilocode': 'kilocode',
  'hermes': 'hermes',
  'hermes-agent': 'hermes',
  'opencode': 'opencode',
  'openclaw': 'openclaw',
};

export class AchievementEngine {
  readonly stateDir: string;
  readonly defsPath: string;
  readonly enabledCategories?: string[];

  definitions: AchievementDefinition[] = [];
  setDefinitions: SetDefinition[] = [];
  events: TrackedEvent[] = [];
  state: AchievementState = { unlocked: {}, stats: { total_unlocked: 0 } };
  unlockedThisPoll: AchievementDefinition[] = [];
  toolSource: string;
  sessionId: string;
  taskId: string | null = null;

  private store: Store;

  constructor(opts: EngineOptions = {}) {
    const defaultStateDir = path.join(process.env.HOME || '~', '.agent-achievements');
    this.stateDir = opts.stateDir || defaultStateDir;
    this.defsPath = opts.defsPath || path.join(ROOT, '04-成就定义清单.yaml');
    this.enabledCategories = opts.enabledCategories;
    this.toolSource = opts.toolSource || process.env.AGPA_TOOL_SOURCE || 'unknown';
    this.sessionId = opts.sessionId || `agpa_${Date.now()}`;
    this.store = new Store(this.stateDir);
  }

  detectToolSource(clientInfo: { name: string; version: string } | undefined): void {
    if (!clientInfo || this.toolSource !== 'unknown') return;
    const name = clientInfo.name.toLowerCase();
    for (const [key, value] of Object.entries(TOOL_SOURCE_MAP)) {
      if (name.includes(key)) {
        this.toolSource = value;
        return;
      }
    }
  }

  init(): this {
    // Load YAML definitions
    const yaml = fs.readFileSync(this.defsPath, 'utf-8');
    const parsed = parseYAML(yaml);
    if (parsed.definitions.length === 0) throw new Error('No achievement definitions loaded');

    this.setDefinitions = parsed.sets;

    // Filter by enabled categories if set
    this.definitions = this.enabledCategories
      ? parsed.definitions.filter(d => this.enabledCategories!.includes(d.category))
      : parsed.definitions;

    // Load state, events from store
    const { state, events } = this.store.load();
    this.state = state;
    this.events = events;

    return this;
  }

  track(eventType: EventType, payload: EventPayload = {}): TrackedEvent {
    const event: TrackedEvent = {
      protocol_version: '1.0',
      event_id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      tool_source: this.toolSource,
      event_type: eventType,
      payload,
      context: { session_id: this.sessionId, model: 'auto', ...(this.taskId ? { task_id: this.taskId } : {}) },
    };

    this.events.push(event);
    this.store.appendEvent(event);

    return event;
  }

  poll(): AchievementDefinition[] {
    // Reload state from disk so concurrent processes see latest unlocks
    const latest = this.store.load();
    this.state = latest.state;
    this.events = latest.events;

    const unlockedIds = evaluateAll(this.definitions, this.events, this.state.unlocked);
    const newlyUnlocked: AchievementDefinition[] = [];

    for (const id of unlockedIds) {
      const def = this.definitions.find(d => d.id === id);
      if (!def) continue;

      const now = new Date().toISOString();
      this.state.unlocked[id] = now;
      this.state.stats.total_unlocked = (this.state.stats.total_unlocked || 0) + 1;

      newlyUnlocked.push({ ...def, unlocked_at: now });
    }

    if (newlyUnlocked.length > 0) {
      this.store.saveState(this.state);
    }

    // Fire-and-forget telemetry (non-blocking)
    runTelemetry(this.stateDir, this.events).catch(() => { /* silent */ });

    this.unlockedThisPoll = newlyUnlocked;
    return newlyUnlocked;
  }

  stats(): AchievementStats {
    const total = this.definitions.length;
    const unlocked = Object.keys(this.state.unlocked).length;
    const byCategory: Record<string, { total: number; unlocked: number }> = {};
    const byRarity: Record<string, { total: number; unlocked: number }> = {};

    for (const def of this.definitions) {
      const cat = def.category || 'unknown';
      const rar = def.rarity || 'common';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, unlocked: 0 };
      if (!byRarity[rar]) byRarity[rar] = { total: 0, unlocked: 0 };
      byCategory[cat]!.total++;
      byRarity[rar]!.total++;
      if (this.state.unlocked[def.id]) {
        byCategory[cat]!.unlocked++;
        byRarity[rar]!.unlocked++;
      }
    }

    return {
      total_achievements: total,
      unlocked,
      completion_pct: Math.round((unlocked / total) * 100),
      total_events: this.events.length,
      by_category: byCategory,
      by_rarity: byRarity,
      state_dir: this.stateDir,
    };
  }

  resetState(): void {
    this.state = { unlocked: {}, stats: { total_unlocked: 0 } };
    this.events = [];
    this.store.reset();
  }
}
