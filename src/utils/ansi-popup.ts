/**
 * ANSI popup renderer for achievement unlocks.
 * Pure function: data in, styled string out. No side effects.
 *
 * Non-TTY environments (piped output, CI) return "" — callers fall back
 * to plaintext [AGPA] poll: ... lines.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface PopupAchievement {
  icon: string;
  name: string;
  description: string;
  rarity: string; // common | uncommon | rare | epic | legendary | mythic
  category?: string;
  set_name?: string;
  set_progress?: string; // e.g. "1/4"
  progress?: { current: number; max: number };
}

// ── ANSI helpers ────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const RARITY_ANSI: Record<string, string> = {
  common:    '\x1b[38;5;110m',   // #7eb8da light blue
  uncommon:  '\x1b[38;5;32m',    // #3b7ec0 darker blue
  rare:      '\x1b[38;5;178m',   // #e0b020 gold
  epic:      '\x1b[38;5;172m',   // #e87830 orange
  legendary: '\x1b[38;5;135m',   // #a858f0 purple
  mythic:    '\x1b[38;5;197m',   // #f04050 red
};

const WHITE  = '\x1b[37m';
const GRAY   = '\x1b[38;5;240m';
const BOLD_WHITE = '\x1b[1;37m';
const YELLOW = '\x1b[33m';

const CARD_WIDTH = 46;

// ── Unicode box-drawing ─────────────────────────────────────────────

const BOX = { tl: '┌', tr: '┐', bl: '└', br: '┘', hz: '─', vt: '│' };

// ── Helpers ─────────────────────────────────────────────────────────

function padRight(text: string, width: number): string {
  // Strip ANSI escapes for width calculation, then pad
  const visible = text.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, width - visible.length);
  return text + ' '.repeat(padding);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '…';
}

function wrapLine(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > width) {
    // Try to break at space
    let breakAt = remaining.lastIndexOf(' ', width);
    if (breakAt <= 0) breakAt = width;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function colorize(text: string, ansi: string): string {
  return ansi + text + RESET;
}

function rarityLabel(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// ── Border row ──────────────────────────────────────────────────────

function topBorder(rarityCode: string): string {
  return colorize(`  ${BOX.tl}${BOX.hz.repeat(CARD_WIDTH)}${BOX.tr}`, rarityCode);
}

function bottomBorder(rarityCode: string): string {
  return colorize(`  ${BOX.bl}${BOX.hz.repeat(CARD_WIDTH)}${BOX.br}`, rarityCode);
}

function contentRow(text: string, ansi?: string): string {
  const coloredText = ansi ? colorize(text, ansi) : text;
  return '  ' + colorize(BOX.vt, GRAY) + ' ' + padRight(coloredText, CARD_WIDTH - 2) + ' ' + colorize(BOX.vt, GRAY);
}

function emptyRow(): string {
  return contentRow('');
}

// ── Progress bar ────────────────────────────────────────────────────

function progressBar(current: number, max: number, rarityCode: string): string {
  const barWidth = CARD_WIDTH - 14; // room for "Progress: N/M"
  const filled = Math.round((current / Math.max(max, 1)) * barWidth);
  const empty = barWidth - filled;
  const pct = Math.round((current / Math.max(max, 1)) * 100);
  const filledBar = colorize('█'.repeat(filled), rarityCode);
  const emptyBar = colorize('░'.repeat(empty), GRAY);
  return `Progress: ${current}/${max} ${filledBar}${emptyBar} ${pct}%`;
}

// ── Main renderer ───────────────────────────────────────────────────

/**
 * Render achievement-unlock popup card(s) with ANSI colors and box-drawing.
 * Returns "" for non-TTY environments or empty input.
 * Caps at 5 cards to prevent terminal flooding.
 */
export function renderPopup(achievements: PopupAchievement[]): string {
  if (!process.stdout.isTTY) return '';
  if (achievements.length === 0) return '';

  const cards: string[] = [];
  const display = achievements.slice(0, 5);

  for (const ach of display) {
    const rCode = RARITY_ANSI[ach.rarity] || WHITE;

    const lines: string[] = [];
    lines.push(topBorder(rCode));

    // Title row
    const titleText = `${ach.icon}  Achievement Unlocked!`;
    lines.push(contentRow(padRight(titleText, CARD_WIDTH - 2), BOLD_WHITE));
    lines.push(emptyRow());

    // Name
    const name = truncate(`"${ach.name}"`, CARD_WIDTH - 5);
    lines.push(contentRow(padRight(name, CARD_WIDTH - 2), BOLD + rCode));
    lines.push(emptyRow());

    // Description — wrap to max 2 lines
    const descWrapped = wrapLine(ach.description, CARD_WIDTH - 4);
    for (let i = 0; i < Math.min(descWrapped.length, 2); i++) {
      let d = descWrapped[i]!;
      if (i === 1 && descWrapped.length > 2) {
        d = d.slice(0, CARD_WIDTH - 7) + '…';
      }
      lines.push(contentRow(padRight(d, CARD_WIDTH - 2)));
    }
    lines.push(emptyRow());

    // Meta row: Rarity + optional Category + optional Set
    const metaParts: string[] = [];
    metaParts.push(`${colorize('Rarity:', GRAY)} ${colorize(rarityLabel(ach.rarity), rCode)}`);
    if (ach.category) {
      metaParts.push(`${colorize('· Cat:', GRAY)} ${ach.category}`);
    }
    if (ach.set_name) {
      let setText = `${colorize('· Set:', GRAY)} ${ach.set_name}`;
      if (ach.set_progress) setText += ` ${ach.set_progress}`;
      metaParts.push(setText);
    }
    lines.push(contentRow(padRight(metaParts.join('  '), CARD_WIDTH - 2)));

    // Progress bar (if applicable)
    if (ach.progress) {
      lines.push(emptyRow());
      const bar = progressBar(ach.progress.current, ach.progress.max, rCode);
      lines.push(contentRow(padRight(bar, CARD_WIDTH - 2)));
    }

    lines.push(bottomBorder(rCode));
    cards.push(lines.join('\n'));
  }

  // Summary for overflow
  if (achievements.length > 5) {
    const remaining = achievements.length - 5;
    cards.push(colorize(`  … and ${remaining} more achievement${remaining > 1 ? 's' : ''}`, YELLOW));
  }

  return '\n' + cards.join('\n\n') + '\n';
}
