import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Helpers ──────────────────────────────────────────────────────────

async function loadDaemon() {
  return await import('../../src/cli/daemon.js');
}

describe('daemon — module exports', () => {
  it('exports all public functions', async () => {
    const mod = await loadDaemon();
    expect(mod.installDaemon).toBeDefined();
    expect(mod.uninstallDaemon).toBeDefined();
    expect(mod.isDaemonInstalled).toBeDefined();
    expect(mod.getDaemonInfo).toBeDefined();
    expect(typeof mod.installDaemon).toBe('function');
    expect(typeof mod.uninstallDaemon).toBe('function');
  });
});

describe('daemon — getDaemonInfo', () => {
  it('returns valid DaemonInfo shape', async () => {
    const { getDaemonInfo } = await loadDaemon();
    const info = getDaemonInfo();
    expect(info).toHaveProperty('installed');
    expect(info).toHaveProperty('os');
    expect(info).toHaveProperty('configPath');
    expect(['macos', 'linux', 'windows', 'unknown']).toContain(info.os);
    expect(typeof info.installed).toBe('boolean');
    expect(typeof info.configPath).toBe('string');
  });
});

describe('daemon — isDaemonInstalled returns boolean', () => {
  it('returns boolean without throwing', async () => {
    const { isDaemonInstalled } = await loadDaemon();
    const result = isDaemonInstalled();
    expect(typeof result).toBe('boolean');
  });
});

describe('daemon — install/uninstall return structured result', () => {
  it('installDaemon returns { ok, message }', async () => {
    const { installDaemon } = await loadDaemon();
    const result = installDaemon();
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('message');
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('uninstallDaemon returns { ok, message }', async () => {
    const { uninstallDaemon } = await loadDaemon();
    const result = uninstallDaemon();
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('message');
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('daemon — install/uninstall cycle does not throw', () => {
  let tmpHome: string;
  let origHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agpa-daemon-test-'));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;

    // Create LaunchAgents dir to avoid mkdir failures
    if (process.platform === 'darwin') {
      fs.mkdirSync(path.join(tmpHome, 'Library', 'LaunchAgents'), { recursive: true });
    }
  });

  afterEach(() => {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch { /* ok */ }
    if (origHome) process.env.HOME = origHome;
  });

  it('does not throw on install + uninstall cycle', async () => {
    const { installDaemon, uninstallDaemon } = await loadDaemon();

    // Install (may fail on non-macOS/Linux in CI, that's expected)
    const inst = installDaemon();
    expect(typeof inst.ok).toBe('boolean');

    // Uninstall (cleanup regardless of install success)
    const uninst = uninstallDaemon();
    expect(typeof uninst.ok).toBe('boolean');
  });
});
