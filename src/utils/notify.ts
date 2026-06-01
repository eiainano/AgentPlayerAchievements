import { execFile } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const DASHBOARD_URL = 'http://localhost:3867';

// ── OS detection ────────────────────────────────────────────────

type Platform = 'macos' | 'linux' | 'windows';

function detectOS(): Platform {
  const p = process.platform;
  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  return 'linux'; // linux, freebsd, openbsd, sunos, aix
}

// ── Icon helper ─────────────────────────────────────────────────

export function ensureIcon(stateDir: string): string | null {
  const target = path.join(stateDir, 'agpa-icon.png');
  if (fs.existsSync(target)) return target;
  const src = path.resolve(import.meta.dirname, '../../tools/pixelart-shield-gold.png');
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(stateDir, { recursive: true });
      fs.copyFileSync(src, target);
      return target;
    }
  } catch { /* silent fallback */ }
  return null;
}

// ── Platform-specific notifiers ─────────────────────────────────

function sendMacNotification(title: string, body: string, stateDir: string, profile?: string): void {
  const icon = ensureIcon(stateDir);
  const dashboardUrl = profile && profile !== 'default'
    ? `${DASHBOARD_URL}?profile=${encodeURIComponent(profile)}`
    : DASHBOARD_URL;

  // Best effort: terminal-notifier (brew install terminal-notifier)
  // Provides clickable URL + custom app icon. If unavailable, fall back to osascript.
  const args = [
    '-title', title,
    '-message', body,
    '-group', 'agpa.achievement',
    '-sound', 'default',
    '-open', dashboardUrl,
  ];
  if (icon) args.push('-appIcon', icon);

  execFile('terminal-notifier', args, (err) => {
    if (!err) return;
    // Fallback to built-in osascript (no icon, no clickable URL, but always available)
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"');
    const script = `display notification "${escapedBody}" with title "${escapedTitle}" sound name "Glass"`;
    execFile('osascript', ['-e', script], (osErr) => {
      if (osErr) process.stderr.write(`[AGPA] macOS notify failed: ${osErr.message}\n`);
    });
  });
}

function sendLinuxNotification(title: string, body: string, stateDir: string): void {
  const icon = ensureIcon(stateDir);
  const args = [
    ...(icon ? ['-i', icon] : ['-i', 'dialog-information']),
    '-a', 'AGPA',
    title,
    body,
  ];
  execFile('notify-send', args, (err) => {
    if (err) {
      process.stderr.write(`[AGPA] Linux notify failed (is libnotify installed?): ${err.message}\n`);
    }
  });
}

function sendWindowsNotification(title: string, body: string): void {
  // PowerShell MessageBox — fire and forget (detached child, non-blocking).
  // Use single-quoted strings to prevent $() subexpression injection.
  // Escape embedded single quotes by doubling them (PowerShell convention).
  const escapedTitle = title.replace(/'/g, "''");
  const escapedBody = body.replace(/'/g, "''");
  const psScript =
    `Add-Type -AssemblyName System.Windows.Forms; ` +
    `[System.Windows.Forms.MessageBox]::Show('${escapedBody}','${escapedTitle}','OK','Information')`;

  let child: ChildProcess | null = null;
  try {
    child = execFile(
      'powershell',
      ['-WindowStyle', 'Hidden', '-NoProfile', '-NonInteractive', '-Command', psScript],
      (err) => {
        if (err) process.stderr.write(`[AGPA] Windows notify failed: ${err.message}\n`);
      },
    );
  } catch {
    process.stderr.write(`[AGPA] Windows notify: PowerShell unavailable\n`);
    return;
  }
  if (child) child.unref(); // don't block the parent process
}

/** Terminal fallback — always printed so TTY users never miss an unlock. */
function sendTerminalNotification(title: string, body: string): void {
  process.stdout.write(`\n★ ${title}\n  ${body}\n\n`);
}

// ── Public API (backward-compatible signature) ──────────────────

/**
 * Send an achievement-unlock notification on the user's desktop.
 *
 * @param title   e.g. "👋 Hello World"
 * @param body    e.g. "开启你的第一次Agent对话。"
 * @param stateDir  Achievements state directory (for icon asset)
 * @param profile   Named profile (used for clickable dashboard URL on macOS)
 */
export function sendNotification(title: string, body: string, stateDir: string, profile?: string): void {
  const os = detectOS();

  switch (os) {
    case 'macos':
      sendMacNotification(title, body, stateDir, profile);
      break;
    case 'linux':
      sendLinuxNotification(title, body, stateDir);
      break;
    case 'windows':
      sendWindowsNotification(title, body);
      break;
  }

  // Terminal fallback always fires — TTY users / headless systems rely on it
  sendTerminalNotification(title, body);
}
