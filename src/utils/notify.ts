import { execFile } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { isSoundEnabled } from '../config.js';
import { RARITY_RANK } from './theme.js';

export const DASHBOARD_URL = 'http://localhost:3867';

type RarityLevel = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

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

/**
 * Resolve the filesystem path to a pixel-art JPG for a given achievement ID.
 * Returns null if the image doesn't exist (graceful fallback to emoji).
 */
export function getPixelArtPath(achievementId: string): string | null {
  try {
    const dir = path.resolve(import.meta.dirname, '../dashboard/public/pixel-art');
    const filePath = path.join(dir, `${achievementId}.jpg`);
    return fs.existsSync(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

// ── Platform-specific notifiers ─────────────────────────────────

function sendJxaNotification(
  title: string,
  body: string,
  dashboardUrl: string,
  imagePath: string | null,
): void {
  // JXA (JavaScript for Automation) — built into macOS since 10.10.
  // Uses modern UserNotifications.framework (UNNotificationAttachment) for
  // pixel-art image display and UNUserNotificationCenterDelegate for
  // click-to-open. Auto-terminates after a 30 s timeout.
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  let attachmentBlock = '';
  if (imagePath) {
    // UNNotificationAttachment copies the image into the notification
    // service's data store so it renders inline in the notification banner.
    attachmentBlock = `
  var imgURL = $.NSURL.fileURLWithPath($('${esc(imagePath)}'));
  var attachment = $.UNNotificationAttachment.attachmentWithIdentifierURLOptionsError(
    $('pixel-art'), imgURL, null, null
  );
  if (attachment) content.attachments = [attachment];`;
  }

  const jxa = `
ObjC.import('UserNotifications');
ObjC.import('AppKit');

var app = $.NSApplication.sharedApplication;
var center = $.UNUserNotificationCenter.currentNotificationCenter;

// Request notification permission (no-op if already granted).
// badge (1<<0) | sound (1<<1) | alert (1<<2) = alert | sound.
center.requestAuthorizationWithOptionsCompletionHandler(
  6,  // alert (4) | sound (2)
  function(granted, error) {
    if (!granted) { app.terminate(null); return; }

    var content = $.UNMutableNotificationContent.alloc.init;
    content.title = $('${esc(title)}');
    content.body = $('${esc(body)}');
    content.sound = $.UNNotificationSound.defaultSound;
    content.userInfo = $.NSDictionary.dictionaryWithObjectForKey(
      $('${esc(dashboardUrl)}'), $('url')
    );${attachmentBlock}

    // Delegate — fires when the user clicks the notification
    var Delegate = $.NSObject.extend('AGPANotifyDelegate2');
    Delegate.addMethod(
      'userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:',
      'v@:@@@?',
      function(_self, _cmd, _ctr, response, handler) {
        var info = response.notification.content.userInfo;
        if (info) {
          var urlStr = info.objectForKey('url');
          if (urlStr && urlStr.js) {
            $.NSWorkspace.sharedWorkspace.openURL(
              $.NSURL.URLWithString(urlStr.js)
            );
          }
        }
        if (handler) handler();
        app.terminate(null);
      }
    );
    center.delegate = $.Delegate.alloc.init;

    var request = $.UNNotificationRequest.requestWithIdentifierContentTrigger(
      $('agpa-unlock'), content, null
    );
    center.addNotificationRequestWithCompletionHandler(request, function(err) {
      // notification delivered
    });

    // Auto-exit after 30 s if the user never clicks
    $.NSTimer.scheduledTimerWithTimeIntervalTargetSelectorUserInfoRepeats(
      30, app, 'terminate:', null, false
    );
  }
);

app.run();
`;

  execFile('osascript', ['-l', 'JavaScript', '-e', jxa], (err) => {
    if (err) {
      // JXA failed — last-resort plain AppleScript
      const escapedTitle = title.replace(/"/g, '\\"');
      const escapedBody = body.replace(/"/g, '\\"');
      const script = `display notification "${escapedBody}" with title "${escapedTitle}" sound name "Glass"`;
      execFile('osascript', ['-e', script], (osErr) => {
        if (osErr) process.stderr.write(`[AGPA] macOS notify failed: ${osErr.message}\n`);
      });
    }
  });
}

function sendMacNotification(title: string, body: string, stateDir: string, profile?: string, imagePath?: string): void {
  const icon = ensureIcon(stateDir);
  const dashboardUrl = profile && profile !== 'default'
    ? `${DASHBOARD_URL}?profile=${encodeURIComponent(profile)}`
    : DASHBOARD_URL;

  // Primary: terminal-notifier (signed macOS app bundle — most reliable
  // for both basic text and -contentImage rich notifications).
  // Fallback: JXA with modern UserNotifications.framework.
  const args = [
    '-title', title,
    '-message', body,
    '-group', 'agpa.achievement',
    '-sound', 'default',
    '-open', dashboardUrl,
  ];
  if (icon) args.push('-appIcon', icon);
  if (imagePath && fs.existsSync(imagePath)) {
    args.push('-contentImage', imagePath);
  }

  execFile('terminal-notifier', args, (err) => {
    if (!err) return;
    // terminal-notifier unavailable — fall back to JXA
    sendJxaNotification(title, body, dashboardUrl, imagePath ?? icon);
  });
}

function sendLinuxNotification(title: string, body: string, stateDir: string, imagePath?: string): void {
  const icon = ensureIcon(stateDir);
  const args = [
    ...(icon ? ['-i', icon] : ['-i', 'dialog-information']),
    '-a', 'AGPA',
    '-u', 'normal',       // urgency: low / normal / critical
    '-c', 'games',        // category (for notification center grouping)
    title,
    body,
    // GNOME Shell supports clickable action buttons with --action.
    // Label=command pairs; the command is executed when the action is clicked.
    '--action', `Open Dashboard=xdg-open ${DASHBOARD_URL}`,
  ];
  if (imagePath && fs.existsSync(imagePath)) {
    // notify-send supports image-path hint for rich notifications
    args.splice(1, 0, '--hint', `string:image-path:${imagePath}`);
  }
  execFile('notify-send', args, (err) => {
    if (err) {
      process.stderr.write(`[AGPA] Linux notify failed (is libnotify installed?): ${err.message}\n`);
    }
  });
}

function sendWindowsNotification(title: string, body: string): void {
  // Use PowerShell toast notification (Windows 10+) when available,
  // falling back to a non-blocking MessageBox for older systems.
  const escapedTitle = title.replace(/'/g, "''");
  const escapedBody = body.replace(/'/g, "''");

  // Modern toast notification via PowerShell — non-blocking, native look.
  // The Start-Sleep keeps the PS process alive just long enough for
  // the toast to be delivered to the notification center (~500ms).
  const psToastScript =
    `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; ` +
    `$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(` +
    `  [Windows.UI.Notifications.ToastTemplateType]::ToastText02); ` +
    `$texts = $template.GetElementsByTagName('text'); ` +
    `$texts.Item(0).AppendChild($template.CreateTextNode('${escapedTitle}')) > $null; ` +
    `$texts.Item(1).AppendChild($template.CreateTextNode('${escapedBody}')) > $null; ` +
    `$toast = [Windows.UI.Notifications.ToastNotification]::new($template); ` +
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(` +
    `  'AGPA Achievement').Show($toast); ` +
    `Start-Sleep -Milliseconds 600`;

  let child: ChildProcess | null = null;
  try {
    child = execFile(
      'powershell',
      ['-WindowStyle', 'Hidden', '-NoProfile', '-NonInteractive', '-Command', psToastScript],
      (err) => {
        // If toast API fails (pre-Win10 or no notification center),
        // fall back to the simpler MessageBox approach.
        if (err) {
          const mbScript =
            `Add-Type -AssemblyName System.Windows.Forms; ` +
            `[System.Windows.Forms.MessageBox]::Show('${escapedBody}','${escapedTitle}','OK','Information')`;
          const mbChild = execFile(
            'powershell',
            ['-WindowStyle', 'Hidden', '-NoProfile', '-NonInteractive', '-Command', mbScript],
            (mbErr) => {
              if (mbErr) process.stderr.write(`[AGPA] Windows notify failed: ${mbErr.message}\n`);
            },
          );
          if (mbChild) mbChild.unref();
        }
      },
    );
  } catch {
    process.stderr.write(`[AGPA] Windows notify: PowerShell unavailable\n`);
    return;
  }
  if (child) child.unref();
}

/** Terminal fallback — always printed so TTY users never miss an unlock. */
function sendTerminalNotification(title: string, body: string): void {
  process.stdout.write(`\n★ ${title}\n  ${body}\n\n`);
}

// ── Sound effects ───────────────────────────────────────────────────

/**
 * Play the achievement sound for a given rarity level.
 *
 * Sound files are expected at `stateDir/sounds/{rarity}.wav`.
 * Falls back silently if file is missing or sound is disabled.
 */
export function playSound(rarity: string, stateDir: string): void {
  if (!isSoundEnabled()) return;

  const soundFile = path.join(stateDir, 'sounds', `${rarity}.wav`);
  if (!fs.existsSync(soundFile)) return;

  const os = detectOS();
  let child: ChildProcess | null = null;

  switch (os) {
    case 'macos':
      child = execFile('afplay', [soundFile]);
      break;
    case 'linux':
      // paplay for PulseAudio, aplay for ALSA
      child = execFile('paplay', [soundFile], (err) => {
        if (err) execFile('aplay', [soundFile], () => {});
      });
      break;
    case 'windows':
      child = execFile('powershell', [
        '-WindowStyle', 'Hidden', '-NoProfile', '-NonInteractive', '-Command',
        `(New-Object Media.SoundPlayer '${soundFile.replace(/'/g, "''")}').PlaySync()`,
      ]);
      break;
  }
  if (child) child.unref(); // don't block parent
}

// ── Public API (backward-compatible signature) ──────────────────

/**
 * Send an achievement-unlock notification on the user's desktop.
 *
 * @param title     e.g. "Hello World" (clean title — shown on desktop notification)
 * @param body      e.g. "开启你的第一次Agent对话。"
 * @param stateDir  Achievements state directory (for icon asset)
 * @param profile   Named profile (used for clickable dashboard URL on macOS)
 * @param rarity    Achievement rarity — if provided, plays the corresponding sound
 * @param imagePath Optional filesystem path to a pixel-art JPG shown as the notification image
 * @param termTitle Title for terminal fallback (e.g. includes emoji prefix);
 *                  falls back to `title` when omitted
 */
export function sendNotification(
  title: string,
  body: string,
  stateDir: string,
  profile?: string,
  rarity?: string,
  imagePath?: string,
  termTitle?: string,
): void {
  if (rarity) {
    playSound(rarity, stateDir);
  }

  const os = detectOS();

  switch (os) {
    case 'macos':
      sendMacNotification(title, body, stateDir, profile, imagePath);
      break;
    case 'linux':
      sendLinuxNotification(title, body, stateDir, imagePath);
      break;
    case 'windows':
      sendWindowsNotification(title, body);
      break;
  }

  // Terminal fallback always fires — TTY users / headless systems rely on it
  // Uses termTitle (emoji-prefixed) when available so emoji is shown in TTY
  sendTerminalNotification(termTitle ?? title, body);
}
