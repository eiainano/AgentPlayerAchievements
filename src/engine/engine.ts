import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseYAML, parsePackYAML } from './yaml-parser.js';
import { evaluateAll } from './evaluator.js';
import { Store } from './store.js';
import { computeStats } from './stats.js';
import { getBatteryStatus } from '../utils/battery.js';
import { calcStreak } from '../utils/activity.js';
import type { AgentToolStats } from './stats.js';
import type {
  TrackedEvent, EventType, EventPayload,
  AchievementDefinition, AchievementState, AchievementStats,
  EngineOptions, PackMetadata, SetDefinition, QuestlineDefinition,
  AchievementExplanation,
} from './types.js';
import { explainAchievement } from '../utils/explain.js';

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

function uuid(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class AchievementEngine {
  readonly stateDir: string;
  readonly defsPath: string;
  readonly enabledCategories?: string[];
  private _packsDir: string;

  definitions: AchievementDefinition[] = [];
  setDefinitions: SetDefinition[] = [];
  questlineDefinitions: QuestlineDefinition[] = [];
  packs: PackMetadata[] = [];                        // metadata for all loaded packs
  packDefinitions: AchievementDefinition[] = [];     // defs from packs only (subset of definitions)
  events: TrackedEvent[] = [];
  state: AchievementState = { unlocked: {}, stats: { total_unlocked: 0 } };
  unlockedThisPoll: AchievementDefinition[] = [];
  toolSource: string;
  sessionId: string;
  currentModel: string;
  taskId: string | null = null;
  sessionStartTime: number | null = null;

  private store: Store;

  constructor(opts: EngineOptions = {}) {
    const defaultStateDir = path.join(process.env.HOME || '~', '.agent-achievements');
    this.stateDir = opts.stateDir || defaultStateDir;
    this.defsPath = opts.defsPath || path.join(ROOT, 'achievement-definitions.yaml');
    this.enabledCategories = opts.enabledCategories;
    this.toolSource = opts.toolSource || process.env.AGPA_TOOL_SOURCE || 'unknown';
    this.sessionId = opts.sessionId || `agpa_${Date.now()}`;
    this.currentModel = process.env.AGPA_MODEL || 'auto';
    this._packsDir = opts.packsDir || path.join(process.env.HOME || '~', '.agent-achievements', 'packs');
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
    this.questlineDefinitions = parsed.questlines;

    // Filter by enabled categories if set
    this.definitions = this.enabledCategories
      ? parsed.definitions.filter(d => this.enabledCategories!.includes(d.category))
      : parsed.definitions;

    // Load community pack definitions from ~/.agent-achievements/packs/
    const packResult = this.loadPacks();
    this.packs = packResult.packs;
    this.packDefinitions = packResult.definitions;
    this.definitions.push(...packResult.definitions);

    // Load state, events from store
    const { state, events } = this.store.load();
    this.state = state;
    this.events = events;

    // Bootstrap achievement.unlocked events for existing unlocks (idempotent)
    const hasUnlockEvents = this.events.some(e => e.event_type === 'achievement.unlocked');
    if (!hasUnlockEvents) {
      for (const [id, unlockedAt] of Object.entries(state.unlocked)) {
        const def = this.definitions.find(d => d.id === id);
        const evt: TrackedEvent = {
          protocol_version: '1.0',
          event_id: uuid(),
          timestamp: unlockedAt as string,
          tool_source: this.toolSource,
          event_type: 'achievement.unlocked',
          payload: { achievement_id: id, rarity: def?.rarity || 'common' },
          context: { session_id: this.sessionId, model: 'auto' },
        };
        this.events.push(evt);
        this.store.appendEvent(evt);
      }
    }

    return this;
  }

  track(eventType: EventType, payload: EventPayload = {}): TrackedEvent {
    // Enrich payload based on event type
    let enrichedPayload: Record<string, unknown> = { ...payload, tool_source: this.toolSource };
    if (eventType === 'session.start') {
      const now = new Date();
      enrichedPayload.hour = now.getHours();
      enrichedPayload.day_of_week = now.getDay();
      this.sessionStartTime = now.getTime();
    }
    if (eventType === 'task.complete' && this.sessionStartTime != null) {
      enrichedPayload.elapsed_ms = Date.now() - this.sessionStartTime;
    }
    // Auto-enrich user.message with battery status (covers manual-track + non-CC tools)
    if (eventType === 'user.message' && !('on_battery' in enrichedPayload)) {
      const battery = getBatteryStatus();
      if (battery) Object.assign(enrichedPayload, battery);
    }
    // Auto-detect model from model.switch events so context.model stays accurate
    if (eventType === 'model.switch' && typeof payload.to === 'string' && payload.to) {
      this.currentModel = payload.to;
    }
    // Auto-emit deepseek.conversation when any event happens in a DeepSeek session
    const isDeepSeek = this.currentModel.toLowerCase().includes('deepseek') ||
                       this.toolSource.toLowerCase().includes('deepseek');
    if (isDeepSeek && eventType !== 'deepseek.conversation') {
      const hasInSession = this.events.some(
        e => e.event_type === 'deepseek.conversation' && e.context?.session_id === this.sessionId
      );
      if (!hasInSession) {
        const dsEvent: TrackedEvent = {
          protocol_version: '1.0',
          event_id: crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: new Date().toISOString(),
          tool_source: this.toolSource,
          event_type: 'deepseek.conversation',
          payload: { model: this.currentModel },
          context: { session_id: this.sessionId, model: this.currentModel },
        };
        this.events.push(dsEvent);
        this.store.appendEvent(dsEvent);
      }
    }
    const event: TrackedEvent = {
      protocol_version: '1.0',
      event_id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      tool_source: this.toolSource,
      event_type: eventType,
      payload: enrichedPayload,
      context: { session_id: this.sessionId, model: this.currentModel, ...(this.taskId ? { task_id: this.taskId } : {}) },
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

    // Emit achievement.unlocked events BEFORE saving state so downstream
    // achievements (casual_collector, trophy_case) can count them. If the
    // process crashes after emit but before save, the next poll re-evaluates
    // and re-emits — no data inconsistency.
    for (const def of newlyUnlocked) {
      this.track('achievement.unlocked', {
        achievement_id: def.id,
        rarity: def.rarity,
      } as EventPayload);
    }

    if (newlyUnlocked.length > 0) {
      this.store.saveState(this.state);
    }

    this.unlockedThisPoll = newlyUnlocked;

    // Compute + cache usage statistics after poll (P1-3: incremental mode)
    try {
      const existingStats = this.store.loadStats();
      const stats = computeStats(this.events, existingStats);
      this.store.saveStats(stats);
    } catch {
      // stats computation should never block poll; drop silently
    }

    return newlyUnlocked;
  }

  /** Load cached tool stats; if missing, compute from events. Does NOT write — poll() handles persistence. */
  toolStats(): AgentToolStats {
    const cached = this.store.loadStats();
    if (cached) return cached;
    return computeStats(this.events);
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

    // Compute XP/level for MCP agent awareness.
    // Must stay in sync with dashboard/xp.ts formulas.
    const ACHIEVEMENT_XP: Record<string, number> = {
      common: 50, uncommon: 100, rare: 200, epic: 300, legendary: 500, mythic: 1000,
    };
    let achievementXp = 0;
    for (const def of this.definitions) {
      if (this.state.unlocked[def.id]) {
        achievementXp += ACHIEVEMENT_XP[def.rarity] || 50;
      }
    }
    const taskCount = this.events.filter(e => e.event_type === 'task.complete').length;

    // Usage XP (mirrors calcUsageBreakdown in dashboard/xp.ts)
    const toolCalls = this.events.filter(e => e.event_type === 'tool.complete').length;
    const sessions = this.events.filter(e => e.event_type === 'session.start').length;
    const messages = this.events.filter(e => e.event_type === 'user.message').length;
    const tokenEvents = this.events.filter(e => e.event_type === 'token.consumed');
    const totalTokens = tokenEvents.reduce(
      (sum, e) => sum + ((e.payload.amount as number) || 0), 0,
    );
    const toolNames = this.events
      .filter(e => e.event_type === 'tool.complete')
      .map(e => e.payload.tool_name as string | undefined)
      .filter((t): t is string => !!t);
    const uniqueTools = new Set(toolNames).size;
    const usageXp = Math.round(Math.sqrt(
      toolCalls * 4 + sessions * 40 + messages * 20 +
      (totalTokens / 1000) * 2 + uniqueTools * 80,
    ));

    // Streak multiplier (mirrors calcStreakMultiplier in dashboard/xp.ts)
    const streakDays = calcStreak(this.events).current;
    const streakMultiplier = streakDays <= 1 ? 1.0 : Math.min(2.0, 1.0 + (streakDays - 1) * 0.1);

    const totalXp = Math.round((achievementXp + taskCount * 25 + usageXp) * streakMultiplier);
    const level = Math.floor(Math.sqrt(totalXp / 100));

    return {
      total_achievements: total,
      unlocked,
      completion_pct: Math.round((unlocked / total) * 100),
      total_events: this.events.length,
      by_category: byCategory,
      by_rarity: byRarity,
      state_dir: this.stateDir,
      level,
      total_xp: totalXp,
    };
  }

  /** Explain why an achievement is locked/unlocked — pure read, no side effects.
   *  Hidden + locked achievements have their condition details masked here so that
   *  all consumers (MCP, CLI, Dashboard) get the same protection automatically. */
  explain(achievementId: string): AchievementExplanation | null {
    const def = this.definitions.find(d => d.id === achievementId);
    if (!def) return null;
    const raw = explainAchievement(def, this.definitions, this.events, this.state);
    // Mask condition details for hidden achievements that are still locked.
    // Consumers (MCP tool, CLI) no longer need to duplicate this logic.
    if (raw.hidden && !raw.unlocked) {
      raw.conditions = [];
      raw.description = '';
      raw.description_cn = '';
    }
    return raw;
  }

  /** Reload state + events from disk (for long-running servers like Dashboard) */
  reload(): void {
    const latest = this.store.load();
    this.state = latest.state;
    this.events = latest.events;
  }

  /** Reload YAML definitions from disk (for Dashboard hot-reload after YAML edits) */
  reloadDefinitions(): void {
    const yaml = fs.readFileSync(this.defsPath, 'utf-8');
    const parsed = parseYAML(yaml);
    if (parsed.definitions.length === 0) throw new Error('No achievement definitions loaded');
    this.setDefinitions = parsed.sets;
    this.questlineDefinitions = parsed.questlines;
    this.definitions = this.enabledCategories
      ? parsed.definitions.filter(d => this.enabledCategories!.includes(d.category))
      : parsed.definitions;

    // Reload pack definitions: strip old pack defs, re-merge from packs dir
    this.packs = [];
    this.packDefinitions = [];
    const packResult = this.loadPacks();
    this.packs = packResult.packs;
    this.packDefinitions = packResult.definitions;
    this.definitions.push(...packResult.definitions);
  }

  /**
   * Scan ~/.agent-achievements/packs/ for .yaml files, parse each as
   * a community achievement pack, and merge eligible definitions.
   *
   * ID conflicts (core vs pack, or pack vs pack) cause the offending pack
   * to be skipped with a warning. Other packs continue loading.
   * Unknown event types produce a warning.
   */
  loadPacks(): { packs: PackMetadata[]; definitions: AchievementDefinition[] } {
    const dir = this._packsDir;
    if (!fs.existsSync(dir)) return { packs: [], definitions: [] };

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort();

    const packs: PackMetadata[] = [];
    const definitions: AchievementDefinition[] = [];
    const seenIds = new Set(this.definitions.map(d => d.id));

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = parsePackYAML(raw);

        // ID conflict detection
        const conflicts = parsed.definitions.filter(d => seenIds.has(d.id));
        if (conflicts.length > 0) {
          console.warn(
            `[AGPA] Pack "${parsed.pack.id}" (${file}): ID conflict(s): ${conflicts.map(c => c.id).join(', ')} — skipping pack`,
          );
          continue;
        }

        // Annotate definitions with pack_id and merge
        for (const def of parsed.definitions) {
          def.pack_id = parsed.pack.id;
          seenIds.add(def.id);
        }

        packs.push(parsed.pack);
        definitions.push(...parsed.definitions);
      } catch (err) {
        console.warn(`[AGPA] Failed to load pack ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { packs, definitions };
  }

  /** Look up a loaded pack by its ID. Returns null if not found. */
  getPackInfo(packId: string): { pack: PackMetadata; definitions: AchievementDefinition[] } | null {
    const pack = this.packs.find(p => p.id === packId);
    if (!pack) return null;
    return {
      pack,
      definitions: this.packDefinitions.filter(d => d.pack_id === packId),
    };
  }

  resetState(): void {
    this.state = { unlocked: {}, stats: { total_unlocked: 0 } };
    this.events = [];
    this.store.reset();
  }

  /** Import: save state (used by import.ts) */
  saveState(state: AchievementState): void {
    this.store.saveState(state);
    this.state = state;
  }

  /** Import: save stats (used by import.ts) */
  saveStats(stats: AgentToolStats): void {
    this.store.saveStats(stats);
  }

  /** Import: append a batch of events (used by import.ts) */
  appendEvents(events: TrackedEvent[]): void {
    for (const e of events) {
      this.store.appendEvent(e);
    }
    this.events = this.events.concat(events);
  }
}
