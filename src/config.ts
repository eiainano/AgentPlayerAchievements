import * as fs from 'fs';
import * as path from 'path';
import { safeParse, appConfigSchema } from './utils/validate.js';

const CONFIG_DIR = path.join(process.env.HOME || '~', '.agent-achievements');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export type Lang = 'en' | 'zh';

export interface AppConfig {
  lang: Lang;
  enabledCategories?: string[];
  debug?: boolean;
  telemetry: boolean;
  telemetry_server: string;
  active_profile: string;
  sound_enabled: boolean;
}

const DEFAULTS: AppConfig = {
  lang: 'en',
  telemetry: false,
  telemetry_server: '',
  active_profile: 'default',
  sound_enabled: true,
};

/** Read config from file, then override with env vars */
export function loadConfig(): AppConfig {
  let cfg = { ...DEFAULTS };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      cfg = safeParse(appConfigSchema, raw, cfg);
    }
  } catch {
    /* ignore corrupt config, return defaults */
  }

  // Environment variable overrides
  if (process.env.AGPA_PROFILE) {
    cfg.active_profile = process.env.AGPA_PROFILE;
  }
  if (process.env.AGPA_LANG === 'zh' || process.env.AGPA_LANG === 'en') {
    cfg.lang = process.env.AGPA_LANG;
  }
  if (process.env.AGPA_ENABLED_CATEGORIES) {
    cfg.enabledCategories = process.env.AGPA_ENABLED_CATEGORIES.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (process.env.AGPA_DEBUG === 'true') {
    cfg.debug = true;
  }
  if (process.env.AGPA_TELEMETRY === 'true' || process.env.AGPA_TELEMETRY === 'false') {
    cfg.telemetry = process.env.AGPA_TELEMETRY === 'true';
  }
  if (process.env.AGPA_TELEMETRY_SERVER) {
    cfg.telemetry_server = process.env.AGPA_TELEMETRY_SERVER;
  }

  if (process.env.AGPA_SOUND === 'true' || process.env.AGPA_SOUND === 'false') {
    cfg.sound_enabled = process.env.AGPA_SOUND === 'true';
  }

  return cfg;
}

export function saveConfig(partial: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const merged = { ...current, ...partial };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

export function getConfig(key: keyof AppConfig): string {
  return String(loadConfig()[key]);
}

/** Check if sound effects are enabled (env var overrides config) */
export function isSoundEnabled(): boolean {
  if (process.env.AGPA_SOUND === 'off') return false;
  if (process.env.AGPA_SOUND === 'on') return true;
  if (process.env.AGPA_SOUND === 'true') return true;
  if (process.env.AGPA_SOUND === 'false') return false;
  return loadConfig().sound_enabled;
}

/** Toggle sound effects on/off, persisted to config.json */
export function setSoundEnabled(enabled: boolean): void {
  saveConfig({ sound_enabled: enabled });
}
