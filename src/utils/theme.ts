/**
 * Shared ANSI escape codes and rarity theme constants.
 *
 * All CLI modules (showcase, search, suggest, verify, mvp) import from here
 * to avoid duplicating the same color maps and escape sequences.
 */

// ── ANSI style shortcuts ───────────────────────────────────────────────────

export const ANSI_RESET  = '\x1b[0m';
export const ANSI_BOLD   = '\x1b[1m';
export const ANSI_DIM    = '\x1b[2m';
export const ANSI_ITALIC = '\x1b[3m';
export const ANSI_CYAN   = '\x1b[36m';
export const ANSI_GREEN  = '\x1b[32m';
export const ANSI_RED    = '\x1b[31m';
export const ANSI_YELLOW = '\x1b[33m';

// Legacy single-letter aliases (used by showcase/search/suggest)
export const R = ANSI_RESET;
export const B = ANSI_BOLD;
export const D = ANSI_DIM;
export const I = ANSI_ITALIC;
export const C = ANSI_CYAN;
export const G = ANSI_GREEN;

// ── 24-bit true-color rarity palette ───────────────────────────────────────
// Used by CLI commands (showcase, search, suggest, mvp) and the dashboard frontend

export const RARITY_COLORS: Record<string, string> = {
  common:    '\x1b[38;2;150;150;150m',  // gray
  uncommon:  '\x1b[38;2;100;200;100m',  // green
  rare:      '\x1b[38;2;66;133;244m',   // blue
  epic:      '\x1b[38;2;180;70;240m',   // purple
  legendary: '\x1b[38;2;255;140;0m',    // orange
  mythic:    '\x1b[38;2;255;50;50m',    // red
};

// ── Hex rarity colors (for web / card generation) ──────────────────────────

export const RARITY_HEX: Record<string, string> = {
  common:    '#969696',
  uncommon:  '#64C864',
  rare:      '#4285F4',
  epic:      '#B446F0',
  legendary: '#FF8C00',
  mythic:    '#FF3232',
};

// ── Rarity rank (numeric sort order, ascending) ────────────────────────────

export const RARITY_RANK: Record<string, number> = {
  common:    0,
  uncommon:  1,
  rare:      2,
  epic:      3,
  legendary: 4,
  mythic:    5,
};

// Sorted array for iteration
export const RARITY_ORDER: string[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// ── Rarity labels ──────────────────────────────────────────────────────────

export const RARITY_LABELS_EN: Record<string, string> = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
  mythic:    'Mythic',
};

export const RARITY_LABELS_ZH: Record<string, string> = {
  common:    '普通',
  uncommon:  '罕见',
  rare:      '稀有',
  epic:      '史诗',
  legendary: '传说',
  mythic:    '神话',
};
