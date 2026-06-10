import * as fs from 'fs';
import * as path from 'path';
import type { AchievementState, TrackedEvent } from './types.js';
import type { AgentToolStats } from './stats.js';
import { safeParse, achievementStateSchema, trackedEventSchema, agentToolStatsSchema } from '../utils/validate.js';
import { migrateState } from './migrate.js';

export class Store {
  readonly stateDir: string;

  constructor(stateDir: string) {
    this.stateDir = stateDir;
  }

  ensureDir(): void {
    fs.mkdirSync(this.stateDir, { recursive: true });
  }

  /** Load state and events from disk */
  load(): { state: AchievementState; events: TrackedEvent[] } {
    this.ensureDir();

    // Load state
    const statePath = path.join(this.stateDir, 'state.json');
    let state: AchievementState = { unlocked: {}, stats: { total_unlocked: 0 } };
    try {
      if (fs.existsSync(statePath)) {
        const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        const migrated = migrateState(raw);
        state = safeParse(achievementStateSchema, migrated, state);
      }
    } catch {
      // state stays default
    }

    // Load event log
    const logPath = path.join(this.stateDir, 'event.log');
    let events: TrackedEvent[] = [];
    try {
      if (fs.existsSync(logPath)) {
        const text = fs.readFileSync(logPath, 'utf-8').trim();
        if (text) {
          events = text.split('\n').filter(Boolean).map(line => {
            try {
              return safeParse(trackedEventSchema, JSON.parse(line), null);
            } catch { return null; }
          }).filter((e): e is TrackedEvent => e !== null);
        }
      }
    } catch {
      events = [];
    }

    return { state, events };
  }

  /** Atomic write: tmp file then rename */
  saveState(state: AchievementState): void {
    this.ensureDir();
    const target = path.join(this.stateDir, 'state.json');
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, target);
  }

  /** Append event to log */
  appendEvent(event: TrackedEvent): void {
    this.ensureDir();
    const logPath = path.join(this.stateDir, 'event.log');
    fs.appendFileSync(logPath, JSON.stringify(event) + '\n');
  }

  /** Atomic write of stats cache */
  saveStats(stats: AgentToolStats): void {
    this.ensureDir();
    const target = path.join(this.stateDir, 'stats.json');
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(stats));
    fs.renameSync(tmp, target);
  }

  /** Load stats cache from disk. Returns null if missing or corrupt. */
  loadStats(): AgentToolStats | null {
    this.ensureDir();
    const statsPath = path.join(this.stateDir, 'stats.json');
    try {
      if (fs.existsSync(statsPath)) {
        const raw = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        return safeParse(agentToolStatsSchema, raw, null);
      }
    } catch {
      // stats stays null — caller falls back to computeStats
    }
    return null;
  }

  /** Full reset */
  reset(): void {
    const statePath = path.join(this.stateDir, 'state.json');
    const logPath = path.join(this.stateDir, 'event.log');
    const showcasePath = path.join(this.stateDir, 'showcase.json');
    const statsPath = path.join(this.stateDir, 'stats.json');
    try { if (fs.existsSync(statePath)) fs.unlinkSync(statePath); } catch {}
    try { if (fs.existsSync(logPath)) fs.unlinkSync(logPath); } catch {}
    try { if (fs.existsSync(showcasePath)) fs.unlinkSync(showcasePath); } catch {}
    try { if (fs.existsSync(statsPath)) fs.unlinkSync(statsPath); } catch {}
    this.ensureDir();
  }
}
