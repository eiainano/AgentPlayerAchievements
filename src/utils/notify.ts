import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const DASHBOARD_URL = 'http://localhost:3867';

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

export function sendNotification(title: string, subtitle: string, stateDir: string): void {
  const icon = ensureIcon(stateDir);
  const args = [
    '-title', title,
    '-message', subtitle,
    '-group', 'agpa.achievement',
    '-sound', 'default',
    '-open', DASHBOARD_URL,
  ];
  if (icon) args.push('-appIcon', icon);

  execFile('terminal-notifier', args, (err) => {
    if (!err) return;
    const script = `display notification "${subtitle.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
    execFile('osascript', ['-e', script], () => {});
  });
}
