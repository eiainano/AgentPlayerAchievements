/**
 * OS-level dashboard daemon management (opt-in, default off).
 *
 * macOS: launchd plist at ~/Library/LaunchAgents/com.agpa.dashboard.plist
 * Linux: systemd user unit at ~/.config/systemd/user/agpa-dashboard.service
 * Windows: not yet implemented — shows a note during init
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

// ── Types ──────────────────────────────────────────────────────────────

export type OS = 'macos' | 'linux' | 'windows' | 'unknown';

export interface DaemonInfo {
  installed: boolean;
  os: OS;
  configPath: string;
}

// ── OS detection ───────────────────────────────────────────────────────

function detectOS(): OS {
  const p = process.platform;
  if (p === 'darwin') return 'macos';
  if (p === 'linux') return 'linux';
  if (p === 'win32') return 'windows';
  return 'unknown';
}

// ── Paths ──────────────────────────────────────────────────────────────

function plistPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.agpa.dashboard.plist');
}

function systemdUnitPath(): string {
  return path.join(os.homedir(), '.config', 'systemd', 'user', 'agpa-dashboard.service');
}

function logPath(): string {
  return path.join(os.homedir(), '.agent-achievements', 'dashboard.log');
}

// ── Command resolution ─────────────────────────────────────────────────

function resolveAgpaCommand(): { executable: string; args: string[] } {
  // Try 'agpa' from PATH first (global npm install / npm link)
  const which = spawnSync('which', ['agpa'], { stdio: 'pipe' });
  if (which.status === 0 && which.stdout.toString().trim()) {
    return { executable: 'agpa', args: ['web'] };
  }

  // Fallback: use node with tsx and the main CLI
  const nodeExe = process.execPath;
  const agpaDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
  return {
    executable: nodeExe,
    args: ['--import', 'tsx', path.join(agpaDir, 'src', 'cli', 'dashboard.ts')],
  };
}

// ── macOS launchd ───────────────────────────────────────────────────────

function installMacOS(): boolean {
  const plistDir = path.dirname(plistPath());
  fs.mkdirSync(plistDir, { recursive: true });

  const { executable, args } = resolveAgpaCommand();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.agpa.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>${executable}</string>
${args.map(a => `    <string>${a}</string>`).join('\n')}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logPath()}</string>
  <key>StandardErrorPath</key>
  <string>${logPath()}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${os.homedir()}</string>
  </dict>
</dict>
</plist>`;

  fs.writeFileSync(plistPath(), plist, 'utf-8');

  // Bootstrap with the user's GUI domain (no sudo needed)
  const result = spawnSync('launchctl', ['bootstrap', `gui/${process.getuid?.() ?? 501}`, plistPath()], {
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const err = result.stderr.toString().trim();
    // "already bootstrapped" is not an error
    if (err && !err.includes('already bootstrapped') && !err.includes('service already loaded')) {
      process.stderr.write(`  ⚠ launchctl bootstrap failed: ${err}\n`);
      return false;
    }
  }

  return true;
}

function uninstallMacOS(): boolean {
  const p = plistPath();
  if (!fs.existsSync(p)) return true; // nothing to do

  // Unload first
  const unload = spawnSync('launchctl', ['bootout', `gui/${process.getuid?.() ?? 501}/${'com.agpa.dashboard'}`], {
    stdio: 'pipe',
  });
  // Ignore errors on unload — it may not be loaded

  try { fs.unlinkSync(p); } catch { return false; }
  return true;
}

function isMacOSDaemonInstalled(): boolean {
  return fs.existsSync(plistPath());
}

// ── Linux systemd ──────────────────────────────────────────────────────

function installLinux(): boolean {
  const unitDir = path.dirname(systemdUnitPath());
  fs.mkdirSync(unitDir, { recursive: true });

  const { executable, args } = resolveAgpaCommand();
  const cmd = [executable, ...args].join(' ');

  const unit = `[Unit]
Description=AGPA Achievement Dashboard
After=network.target

[Service]
ExecStart=${cmd}
Restart=always
RestartSec=5
StandardOutput=append:${logPath()}
StandardError=append:${logPath()}

[Install]
WantedBy=default.target
`;

  fs.writeFileSync(systemdUnitPath(), unit, 'utf-8');

  // Enable & start as user service
  const cmds = [
    ['systemctl', '--user', 'daemon-reload'],
    ['systemctl', '--user', 'enable', 'agpa-dashboard.service'],
    ['systemctl', '--user', 'start', 'agpa-dashboard.service'],
  ];
  for (const c of cmds) {
    const r = spawnSync(c[0]!, c.slice(1), { stdio: 'pipe' });
    if (r.status !== 0) {
      process.stderr.write(`  ⚠ ${c.join(' ')} failed: ${r.stderr.toString().trim()}\n`);
    }
  }

  return true;
}

function uninstallLinux(): boolean {
  const p = systemdUnitPath();
  if (!fs.existsSync(p)) return true;

  const r = spawnSync('systemctl', ['--user', 'stop', 'agpa-dashboard.service'], { stdio: 'pipe' });
  // Ignore errors if not running

  spawnSync('systemctl', ['--user', 'disable', 'agpa-dashboard.service'], { stdio: 'pipe' });
  try { fs.unlinkSync(p); } catch { return false; }

  // Reload to clean up
  spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'pipe' });
  return true;
}

function isLinuxDaemonInstalled(): boolean {
  return fs.existsSync(systemdUnitPath());
}

// ── Windows (not implemented yet) ──────────────────────────────────────

function windowsMessage(): string {
  return 'Windows auto-start not yet supported. Pin `agpa web` to your startup folder.';
}

// ── Public API ─────────────────────────────────────────────────────────

export function installDaemon(): { ok: boolean; message: string } {
  const osType = detectOS();

  switch (osType) {
    case 'macos': {
      const ok = installMacOS();
      return { ok, message: ok ? 'Dashboard will auto-start on login (launchd).' : 'Failed to install launchd daemon.' };
    }
    case 'linux': {
      const ok = installLinux();
      return { ok, message: ok ? 'Dashboard will auto-start on login (systemd).' : 'Failed to install systemd user unit.' };
    }
    case 'windows':
      return { ok: false, message: windowsMessage() };
    default:
      return { ok: false, message: 'Unsupported operating system.' };
  }
}

export function uninstallDaemon(): { ok: boolean; message: string } {
  const osType = detectOS();

  switch (osType) {
    case 'macos': {
      const ok = uninstallMacOS();
      return { ok, message: ok ? 'Daemon removed.' : 'Failed to remove daemon config.' };
    }
    case 'linux': {
      const ok = uninstallLinux();
      return { ok, message: ok ? 'Daemon removed.' : 'Failed to remove daemon config.' };
    }
    case 'windows':
      return { ok: true, message: 'No daemon to remove on Windows.' };
    default:
      return { ok: false, message: 'Unsupported operating system.' };
  }
}

export function isDaemonInstalled(): boolean {
  const osType = detectOS();
  switch (osType) {
    case 'macos': return isMacOSDaemonInstalled();
    case 'linux': return isLinuxDaemonInstalled();
    default: return false;
  }
}

export function getDaemonInfo(): DaemonInfo {
  const osType = detectOS();
  let configPath = '';
  switch (osType) {
    case 'macos': configPath = plistPath(); break;
    case 'linux': configPath = systemdUnitPath(); break;
    default: configPath = '';
  }
  return {
    installed: isDaemonInstalled(),
    os: osType,
    configPath,
  };
}
