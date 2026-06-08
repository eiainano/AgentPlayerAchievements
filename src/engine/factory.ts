/**
 * Shared engine factory — used by CLI commands that need an AchievementEngine instance.
 */

import { AchievementEngine } from './engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir } from '../utils/profile.js';

export function createEngine(): AchievementEngine {
  const cfg = loadConfig();
  const stateDir = cfg.active_profile !== 'default' ? resolveProfileDir(cfg.active_profile) : undefined;
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  return engine;
}
