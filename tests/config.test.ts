import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, isSoundEnabled, getConfig, setConfigDir } from '../src/config.js';

// Use a temp dir to isolate tests from the real ~/.agent-achievements/config.json

describe('loadConfig', () => {
  const PREV: Record<string, string | undefined> = {};
  let tempDir: string;

  beforeEach(() => {
    // Save current env state
    for (const key of ['AGPA_PROFILE', 'AGPA_LANG', 'AGPA_ENABLED_CATEGORIES', 'AGPA_DEBUG', 'AGPA_TELEMETRY', 'AGPA_TELEMETRY_SERVER', 'AGPA_SOUND']) {
      PREV[key] = process.env[key];
      delete process.env[key];
    }
    // Point config to a temp dir that has no config.json
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agpa-config-test-'));
    setConfigDir(tempDir);
  });

  afterEach(() => {
    // Restore env state
    for (const [key, val] of Object.entries(PREV)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    // Clean up temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });
    // Reset to default config dir
    setConfigDir(undefined);
  });

  it('returns defaults when no config file and no env vars', () => {
    const cfg = loadConfig();
    expect(cfg.lang).toBe('en');
    expect(cfg.active_profile).toBe('default');
    expect(cfg.sound_enabled).toBe(true);
    expect(cfg.telemetry).toBe(false);
  });

  it('overrides profile from AGPA_PROFILE env var', () => {
    process.env.AGPA_PROFILE = 'work';
    expect(loadConfig().active_profile).toBe('work');
  });

  it('overrides lang from AGPA_LANG env var', () => {
    process.env.AGPA_LANG = 'zh';
    expect(loadConfig().lang).toBe('zh');
  });

  it('rejects invalid AGPA_LANG (stays default or previous)', () => {
    process.env.AGPA_LANG = 'fr';
    // The code only accepts 'zh' or 'en', so 'fr' is ignored
    expect(loadConfig().lang).toBe('en');
  });

  it('parses AGPA_ENABLED_CATEGORIES from comma-separated string', () => {
    process.env.AGPA_ENABLED_CATEGORIES = 'tool_mastery, milestones';
    const cfg = loadConfig();
    expect(cfg.enabledCategories).toBeDefined();
    expect(cfg.enabledCategories).toContain('tool_mastery');
    expect(cfg.enabledCategories).toContain('milestones');
  });

  it('sets debug from AGPA_DEBUG env var', () => {
    process.env.AGPA_DEBUG = 'true';
    expect(loadConfig().debug).toBe(true);
  });

  it('overrides telemetry from env var', () => {
    process.env.AGPA_TELEMETRY = 'true';
    expect(loadConfig().telemetry).toBe(true);
    process.env.AGPA_TELEMETRY = 'false';
    expect(loadConfig().telemetry).toBe(false);
  });

  it('overrides telemetry_server from env var', () => {
    process.env.AGPA_TELEMETRY_SERVER = 'https://example.com';
    expect(loadConfig().telemetry_server).toBe('https://example.com');
  });

  it('overrides sound_enabled from AGPA_SOUND env var', () => {
    process.env.AGPA_SOUND = 'false';
    expect(loadConfig().sound_enabled).toBe(false);
    process.env.AGPA_SOUND = 'true';
    expect(loadConfig().sound_enabled).toBe(true);
  });
});

describe('isSoundEnabled', () => {
  const PREV_SOUND = process.env.AGPA_SOUND;

  afterEach(() => {
    if (PREV_SOUND === undefined) delete process.env.AGPA_SOUND;
    else process.env.AGPA_SOUND = PREV_SOUND;
  });

  it('returns true when AGPA_SOUND=on', () => {
    process.env.AGPA_SOUND = 'on';
    expect(isSoundEnabled()).toBe(true);
  });

  it('returns false when AGPA_SOUND=off', () => {
    process.env.AGPA_SOUND = 'off';
    expect(isSoundEnabled()).toBe(false);
  });

  it('returns true when AGPA_SOUND=true', () => {
    process.env.AGPA_SOUND = 'true';
    expect(isSoundEnabled()).toBe(true);
  });

  it('returns false when AGPA_SOUND=false', () => {
    process.env.AGPA_SOUND = 'false';
    expect(isSoundEnabled()).toBe(false);
  });

  it('falls back to config when AGPA_SOUND is unset', () => {
    delete process.env.AGPA_SOUND;
    // loadConfig default is sound_enabled: true
    expect(isSoundEnabled()).toBe(true);
  });
});

describe('getConfig', () => {
  it('returns a string value for a known key', () => {
    const val = getConfig('lang');
    expect(typeof val).toBe('string');
    expect(['en', 'zh']).toContain(val);
  });
});
