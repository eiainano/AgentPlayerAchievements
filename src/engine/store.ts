import * as fs from 'fs';
import * as path from 'path';
import type { AchievementState, TrackedEvent } from './types.js';
import { safeParse, achievementStateSchema, trackedEventSchema } from '../utils/validate.js';

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
        state = safeParse(achievementStateSchema, raw, state);
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

  /** Full reset */
  reset(): void {
    const statePath = path.join(this.stateDir, 'state.json');
    const logPath = path.join(this.stateDir, 'event.log');
    try { if (fs.existsSync(statePath)) fs.unlinkSync(statePath); } catch {}
    try { if (fs.existsSync(logPath)) fs.unlinkSync(logPath); } catch {}
    this.ensureDir();
  }
}
