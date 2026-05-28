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
}

const DEFAULTS: AppConfig = {
  lang: 'en',
  telemetry: false,
  telemetry_server: '',
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
