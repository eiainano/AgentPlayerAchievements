# Terminal UX Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ANSI-colored achievement popup cards and "close to unlock" progress nudges to terminal output during `agpa poll`.

**Architecture:** Two new pure-function modules (`ansi-popup.ts`, `progress-nudge.ts`) plus one integration point (`hook.ts cmdPoll()`). One evaluator export (`evaluateMetric`). Non-TTY environments fall back to existing plaintext output.

**Tech Stack:** TypeScript ESM, vitest, ANSI 256-color escape codes, Unicode box-drawing characters

---

## File Structure

| File | Role |
|------|------|
| `src/utils/ansi-popup.ts` | ANSI card renderer — pure function, input → string |
| `src/utils/progress-nudge.ts` | Near-unlock calculator — pure function, input → NearUnlock[] |
| `src/engine/evaluator.ts:355` | Export `evaluateMetric` (1-line change) |
| `src/cli/hook.ts:384-415` | Wire popup + nudge into `cmdPoll()` |
| `tests/utils/ansi-popup.test.ts` | 12 tests for popup rendering |
| `tests/utils/progress-nudge.test.ts` | 15 tests for progress calculation |

---

### Task 1: Export `evaluateMetric` from evaluator.ts

**Files:**
- Modify: `src/engine/evaluator.ts:355`

- [ ] **Step 1: Add `export` keyword to `evaluateMetric`**

Change line 355 from:
```typescript
function evaluateMetric(expr: string, events: TrackedEvent[]): number | null {
```
to:
```typescript
export function evaluateMetric(expr: string, events: TrackedEvent[]): number | null {
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: exit 0, no new errors

- [ ] **Step 3: Run existing tests to confirm no regression**

Run: `npm test`
Expected: 452 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/engine/evaluator.ts
git commit -m "feat: export evaluateMetric for progress-nudge reuse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Create `ansi-popup.ts`

**Files:**
- Create: `src/utils/ansi-popup.ts`

- [ ] **Step 1: Write the module**

```typescript
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
  return colorize(BOX.vt, GRAY) + '  ' + padRight(coloredText, CARD_WIDTH - 2) + ' ' + colorize(BOX.vt, GRAY);
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
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/utils/ansi-popup.ts
git commit -m "feat: add ANSI popup renderer for achievement unlocks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Test `ansi-popup.ts`

**Files:**
- Create: `tests/utils/ansi-popup.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderPopup, type PopupAchievement } from '../../src/utils/ansi-popup.js';

function makeAch(overrides: Partial<PopupAchievement> = {}): PopupAchievement {
  return {
    icon: '🏆',
    name: 'Test Achievement',
    description: 'This is a test achievement for unit testing.',
    rarity: 'common',
    ...overrides,
  };
}

// Helper: strip ANSI for content assertions
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('renderPopup', () => {
  let isTTYOrig: boolean;

  beforeEach(() => {
    isTTYOrig = process.stdout.isTTY!;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: isTTYOrig, configurable: true });
  });

  // ── TTY=true ────────────────────────────────────────────────────────

  it('renders a single achievement with all elements', () => {
    const result = renderPopup([makeAch()]);
    const s = stripAnsi(result);
    expect(s).toContain('🏆');
    expect(s).toContain('Achievement Unlocked!');
    expect(s).toContain('"Test Achievement"');
    expect(s).toContain('This is a test achievement');
    expect(s).toContain('Rarity:');
    expect(s).toContain('Common');
    // Check box chars present
    expect(s).toContain('┌');
    expect(s).toContain('┐');
    expect(s).toContain('└');
    expect(s).toContain('┘');
  });

  it('renders 3 achievements separated by blank lines', () => {
    const result = renderPopup([
      makeAch({ name: 'First' }),
      makeAch({ name: 'Second' }),
      makeAch({ name: 'Third' }),
    ]);
    const s = stripAnsi(result);
    expect(s).toContain('"First"');
    expect(s).toContain('"Second"');
    expect(s).toContain('"Third"');
    // Blank line padding between cards
    const cardCount = (s.match(/┌/g) || []).length;
    expect(cardCount).toBe(3);
  });

  it('caps at 5 cards and shows summary for 6+ achievements', () => {
    const six = Array.from({ length: 6 }, (_, i) => makeAch({ name: `Ach ${i}` }));
    const result = renderPopup(six);
    const s = stripAnsi(result);
    const cardCount = (s.match(/┌/g) || []).length;
    expect(cardCount).toBe(5);
    expect(s).toContain('1 more achievement');
  });

  it('uses rarity-specific ANSI 256 colors', () => {
    // Mythic = 197 (red), Common = 110 (light blue)
    const mythic = renderPopup([makeAch({ rarity: 'mythic' })]);
    expect(mythic).toContain('38;5;197m');

    const common = renderPopup([makeAch({ rarity: 'common' })]);
    expect(common).toContain('38;5;110m');

    const rare = renderPopup([makeAch({ rarity: 'rare' })]);
    expect(rare).toContain('38;5;178m');
  });

  it('renders progress bar when progress is provided', () => {
    const result = renderPopup([makeAch({ progress: { current: 5, max: 10 } })]);
    const s = stripAnsi(result);
    expect(s).toContain('Progress:');
    expect(s).toContain('5/10');
    expect(s).toContain('50%');
  });

  it('omits category and set when not provided', () => {
    const result = renderPopup([makeAch()]);
    const s = stripAnsi(result);
    expect(s).not.toContain('Cat:');
    expect(s).not.toContain('Set:');
  });

  it('includes category and set when provided', () => {
    const result = renderPopup([makeAch({ category: 'style', set_name: 'Bug Catcher', set_progress: '1/4' })]);
    const s = stripAnsi(result);
    expect(s).toContain('Cat:');
    expect(s).toContain('style');
    expect(s).toContain('Set:');
    expect(s).toContain('Bug Catcher');
    expect(s).toContain('1/4');
  });

  it('truncates long descriptions', () => {
    const longDesc = 'A'.repeat(200);
    const result = renderPopup([makeAch({ description: longDesc })]);
    // Should not contain all 200 chars — wrapping truncates
    const clean = stripAnsi(result).replace(/\s+/g, ' ').trim();
    expect(clean.length).toBeLessThan(800); // reasonable upper bound for a card
  });

  it('truncates long names', () => {
    const longName = 'X'.repeat(80);
    const result = renderPopup([makeAch({ name: longName })]);
    const s = stripAnsi(result);
    expect(s).toContain('…');
    expect(s).not.toContain('X'.repeat(80));
  });

  // ── TTY=false ───────────────────────────────────────────────────────

  it('returns empty string when not TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const result = renderPopup([makeAch()]);
    expect(result).toBe('');
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('returns empty string for empty array', () => {
    const result = renderPopup([]);
    expect(result).toBe('');
  });

  it('output does not contain bare unclosed ANSI sequences', () => {
    const result = renderPopup([makeAch()]);
    // Every \x1b[ should have a matching m
    const escapes = result.match(/\x1b\[[0-9;]*m/g) || [];
    // All escape sequences should be well-formed
    for (const esc of escapes) {
      expect(esc).toMatch(/^\x1b\[[0-9;]+m$/);
    }
    // Should end with reset after the card
    expect(result).toContain('\x1b[0m');
  });
});
```

- [ ] **Step 2: Run the tests and verify they pass**

Run: `npx vitest run tests/utils/ansi-popup.test.ts`
Expected: 12 tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/utils/ansi-popup.test.ts
git commit -m "test: add 12 tests for ANSI popup renderer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Create `progress-nudge.ts`

**Files:**
- Create: `src/utils/progress-nudge.ts`

- [ ] **Step 1: Write the module**

```typescript
/**
 * Near-unlock progress calculator.
 * Pure function: takes definitions + events + state, returns sorted NearUnlock[].
 * Non-TTY environments: caller should skip output, but the function itself
 * works regardless — it's pure computation.
 */

import type {
  AchievementDefinition,
  AchievementState,
  Condition,
  TrackedEvent,
} from '../engine/types.js';
import { evaluateMetric } from '../engine/evaluator.js';

// ── Types ──────────────────────────────────────────────────────────

export interface NearUnlock {
  achievement_id: string;
  name: string;
  icon: string;
  rarity: string;
  current: number;
  target: number;
  unit_label: string;
}

// ── Window helpers (replicated from evaluator.ts to keep modules decoupled) ─

function parseWindowMs(w: string): number {
  if (w === 'all' || w === 'lifetime') return Infinity;
  const m = /(\d+)\s*(h|d|m)/.exec(w);
  if (!m) return 86400000; // default 24h
  const n = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 'h': return n * 3600000;
    case 'd': return n * 86400000;
    case 'm': return n * 60000;
    default: return 86400000;
  }
}

function isSessionWindow(cond: Condition): boolean {
  return cond.window === 'single_session' || cond.window === 'same_session';
}

/** Get events scoped to the condition's window (simplified — no task boundaries) */
function windowFilter(events: TrackedEvent[], cond: Condition): TrackedEvent[] {
  if (!cond.window || cond.window === 'all' || cond.window === 'lifetime') return events;
  if (isSessionWindow(cond)) {
    const lastSid = events.length > 0 ? events[events.length - 1]!.context?.session_id : null;
    if (!lastSid) return [];
    return events.filter(e => e.context?.session_id === lastSid);
  }
  const windowMs = parseWindowMs(cond.window);
  if (windowMs === Infinity) return events;
  const now = Date.now();
  return events.filter(e => now - new Date(e.timestamp).getTime() <= windowMs);
}

function eventTypeLabel(eventType: string): string {
  const map: Record<string, string> = {
    'session.start': 'sessions',
    'session.end': 'sessions',
    'task.complete': 'tasks',
    'tool.complete': 'tool uses',
    'user.message': 'messages',
    'user.prompt': 'prompts',
    'agent.spawn': 'agents',
    'skill.invoke': 'skills',
    'mcp.connect': 'connections',
    'command.run': 'commands',
  };
  return map[eventType] || 'events';
}

// ── Per-type progress calculators ───────────────────────────────────

function counterProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = windowFilter(events, cond);
  if (cond.same_target && cond.field) {
    const fieldCounts: Record<string, number> = {};
    for (const e of scoped) {
      if (cond.event && e.event_type !== cond.event) continue;
      const val = String(e.payload?.[cond.field] ?? '');
      if (!val) continue;
      fieldCounts[val] = (fieldCounts[val] || 0) + 1;
    }
    let max = 0;
    for (const v of Object.values(fieldCounts)) if (v > max) max = v;
    return max;
  }
  let count = 0;
  for (const e of scoped) {
    if (cond.event && e.event_type !== cond.event) continue;
    count++;
  }
  return count;
}

function thresholdProgress(events: TrackedEvent[], cond: Condition): number | null {
  if (!cond.metric) return null;
  const scoped = windowFilter(events, cond);
  const filtered = cond.event
    ? scoped.filter(e => e.event_type === cond.event)
    : scoped;
  const val = evaluateMetric(cond.metric, filtered);
  return val !== null ? Math.round(val * 1000) / 1000 : null;
}

function streakProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = windowFilter(events, cond);
  const days = new Set<string>();
  for (const e of scoped) {
    if (cond.event && e.event_type !== cond.event) continue;
    days.add(e.timestamp.slice(0, 10));
  }
  // Count consecutive days ending today
  if (days.size === 0) return 0;
  const sorted = [...days].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let expected = today;
  for (const day of sorted) {
    if (day === expected) {
      streak++;
      // Decrement expected by 1 day
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else if (streak === 0 && day < today) {
      // Today might not have events yet — start from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = yesterday.toISOString().slice(0, 10);
      if (day === yestStr) {
        streak++;
        expected = yestStr;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
        continue;
      }
      break;
    } else {
      break;
    }
  }
  return streak;
}

function distinctCountProgress(events: TrackedEvent[], cond: Condition): number {
  const scoped = windowFilter(events, cond);
  const values = new Set<string>();
  for (const e of scoped) {
    if (cond.event && e.event_type !== cond.event) continue;
    const val = cond.field ? String(e.payload?.[cond.field] ?? '') : '';
    if (!val) continue;
    values.add(val);
  }
  return values.size;
}

function sequenceCountProgress(events: TrackedEvent[], cond: Condition): number {
  const pattern = Array.isArray(cond.pattern) ? (cond.pattern as string[]) : null;
  if (!pattern || pattern.length === 0) return 0;
  let count = 0;
  let pi = 0;
  for (const e of events) {
    if (e.event_type === pattern[pi]) {
      pi++;
      if (pi >= pattern.length) { count++; pi = 0; }
    } else {
      pi = 0;
    }
  }
  return count;
}

function setCompletionProgress(
  def: AchievementDefinition,
  state: AchievementState,
  definitions: AchievementDefinition[],
): number {
  // Count how many members of this set are unlocked
  if (!def.set_id) return 0;
  const memberIds = definitions
    .filter(d => d.set_id === def.set_id && d.id !== def.id)
    .map(d => d.id);
  if (memberIds.length === 0) return 0;
  let unlocked = 0;
  for (const id of memberIds) {
    if (state.unlocked[id]) unlocked++;
  }
  return unlocked;
}

// ── Main calculator ────────────────────────────────────────────────

/**
 * Find achievements that are close to unlocking.
 *
 * For each locked achievement, compute current progress vs. target.
 * Filter by supported types, minProgress threshold, and hidden status.
 * Return top N sorted by completion percentage descending.
 */
export function findNearUnlocks(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
  options?: { maxResults?: number; minProgress?: number },
): NearUnlock[] {
  const maxResults = options?.maxResults ?? 3;
  const minProgress = options?.minProgress ?? 0.2;

  const results: NearUnlock[] = [];

  for (const def of definitions) {
    // Skip already unlocked
    if (state.unlocked[def.id]) continue;

    // Skip hidden (don't spoil easter eggs)
    if (def.hidden) continue;

    // Skip future/unreachable
    if (def.future) continue;

    const cond = def.conditions[0];
    if (!cond) continue;

    let current = 0;
    let target = cond.value;
    let unitLabel = '';

    switch (cond.type) {
      case 'counter': {
        current = counterProgress(events, cond);
        unitLabel = cond.unit || eventTypeLabel(cond.event || '');
        break;
      }
      case 'threshold': {
        if (!cond.metric) continue;
        const val = thresholdProgress(events, cond);
        if (val === null) continue;
        current = val;
        unitLabel = cond.unit || cond.metric;
        break;
      }
      case 'streak': {
        current = streakProgress(events, cond);
        unitLabel = 'days';
        break;
      }
      case 'distinct_count': {
        current = distinctCountProgress(events, cond);
        unitLabel = cond.unit || (cond.field ? cond.field : 'items');
        break;
      }
      case 'sequence_count': {
        current = sequenceCountProgress(events, cond);
        unitLabel = cond.unit || 'cycles';
        break;
      }
      case 'set_completion': {
        current = setCompletionProgress(def, state, definitions);
        if (!def.set_id) continue;
        const members = definitions.filter(d => d.set_id === def.set_id && d.id !== def.id);
        target = members.length;
        if (target === 0) continue;
        unitLabel = cond.unit || 'members';
        break;
      }
      default:
        // sequence, event, mode, pattern_match, ratio — skip
        continue;
    }

    if (target <= 0) continue;
    const ratio = current / target;
    if (ratio < minProgress) continue;

    results.push({
      achievement_id: def.id,
      name: def.name,
      icon: def.icon || '🏆',
      rarity: def.rarity,
      current,
      target,
      unit_label: unitLabel,
    });
  }

  // Sort by completion % descending, then by achievement_id for stability
  results.sort((a, b) => {
    const diff = (b.current / b.target) - (a.current / a.target);
    if (diff !== 0) return diff > 0 ? 1 : -1;
    return a.achievement_id.localeCompare(b.achievement_id);
  });

  return results.slice(0, maxResults);
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/utils/progress-nudge.ts
git commit -m "feat: add progress nudge calculator for near-unlock achievements

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Test `progress-nudge.ts`

**Files:**
- Create: `tests/utils/progress-nudge.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import type {
  AchievementDefinition,
  AchievementState,
  TrackedEvent,
  Condition,
} from '../../src/engine/types.js';
import { findNearUnlocks, type NearUnlock } from '../../src/utils/progress-nudge.js';

// ── Factories ──────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: 'evt-test',
    timestamp: new Date().toISOString(),
    tool_source: 'test',
    event_type: 'tool.complete',
    payload: {},
    context: { session_id: 's1', model: 'test' },
    ...overrides,
  };
}

function makeDef(overrides: Partial<AchievementDefinition> = {}): AchievementDefinition {
  return {
    id: 'test_ach',
    name: 'Test Achievement',
    description: 'A test achievement',
    icon: '🧪',
    category: 'test',
    rarity: 'common',
    conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    ...overrides,
  };
}

function makeState(overrides: Partial<AchievementState> = {}): AchievementState {
  return {
    unlocked: {},
    stats: { total_unlocked: 0 },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('findNearUnlocks', () => {
  // ── Basic cases ─────────────────────────────────────────────────

  it('returns empty for no events', () => {
    const result = findNearUnlocks([makeDef()], [], makeState());
    expect(result).toEqual([]);
  });

  it('returns near-unlock for counter achievement at 70%', () => {
    const events = Array.from({ length: 7 }, () => makeEvent());
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });
    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(7);
    expect(result[0]!.target).toBe(10);
    expect(result[0]!.unit_label).toBe('tool uses');
  });

  it('excludes achievements below minProgress (default 20%)', () => {
    const events = Array.from({ length: 1 }, () => makeEvent());
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });
    // 1/10 = 10% < 20%
    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });

  it('excludes already-unlocked achievements', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    const state = makeState({ unlocked: { test_ach: new Date().toISOString() } });
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });

    const result = findNearUnlocks([def], events, state);
    expect(result).toEqual([]);
  });

  it('excludes hidden achievements', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    const def = makeDef({
      hidden: true,
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });

  it('excludes future achievements', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    const def = makeDef({
      future: true,
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toEqual([]);
  });

  // ── Distinct count ──────────────────────────────────────────────

  it('computes distinct_count progress correctly', () => {
    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Bash' } }),
    ];
    const def = makeDef({
      conditions: [{ type: 'distinct_count', event: 'tool.complete', field: 'tool_name', value: 5 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(3);
    expect(result[0]!.target).toBe(5);
  });

  // ── Streak ──────────────────────────────────────────────────────

  it('computes streak progress from calendar days', () => {
    const today = new Date().toISOString().slice(0, 10);
    // 3 consecutive days including today
    const dates = [today];
    for (let i = 1; i <= 2; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const events = dates.map(d =>
      makeEvent({ event_type: 'session.start', timestamp: `${d}T12:00:00Z` }),
    );

    const def = makeDef({
      conditions: [{ type: 'streak', event: 'session.start', value: 7, window: 'all' }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(3);
    expect(result[0]!.target).toBe(7);
    expect(result[0]!.unit_label).toBe('days');
  });

  // ── Threshold with metric ───────────────────────────────────────

  it('computes threshold metric progress', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        event_type: 'tool.complete',
        payload: { tool_name: 'Edit', edit_lines: 10 + i },
      }),
    );
    const def = makeDef({
      conditions: [{ type: 'threshold', metric: 'edit_lines', event: 'tool.complete', value: 100, window: 'all' }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    // Sum of edit_lines: 10+11+12+13+14 = 60
    expect(result[0]!.current).toBe(60);
    expect(result[0]!.target).toBe(100);
  });

  // ── Sequence count ──────────────────────────────────────────────

  it('computes sequence_count progress', () => {
    const events = [
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Read' } }),
      makeEvent({ event_type: 'tool.complete', payload: { tool_name: 'Write' } }),
    ];
    const def = makeDef({
      conditions: [{ type: 'sequence_count', pattern: ['tool.complete', 'tool.complete'], value: 3 }],
    });

    const result = findNearUnlocks([def], events, makeState());
    expect(result).toHaveLength(1);
    // Read,Write = cycle 1, Read,Write = cycle 2
    expect(result[0]!.current).toBe(2);
    expect(result[0]!.target).toBe(3);
  });

  // ── Set completion ──────────────────────────────────────────────

  it('computes set_completion progress', () => {
    const defs: AchievementDefinition[] = [
      makeDef({ id: 's1', set_id: 'bug_catcher', conditions: [{ type: 'set_completion', value: 3 }] }),
      makeDef({ id: 's2', set_id: 'bug_catcher' }),
      makeDef({ id: 's3', set_id: 'bug_catcher' }),
      makeDef({ id: 's4', set_id: 'bug_catcher' }),
    ];
    const state = makeState({
      unlocked: { s2: '2026-01-01', s3: '2026-01-02' },
    });
    // s1 is our target (unlocked), s2/s3 unlocked, s4 locked
    // Progress for s1 = 2/3 (s2, s3 unlocked out of s2,s3,s4)

    const result = findNearUnlocks(defs, [], state);
    expect(result).toHaveLength(1);
    expect(result[0]!.current).toBe(2); // s2 + s3
    expect(result[0]!.target).toBe(3);  // s2, s3, s4 (excluding self)
  });

  // ── Sorting and truncation ──────────────────────────────────────

  it('returns maxResults (default 3) sorted by completion desc', () => {
    const events = Array.from({ length: 8 }, () => makeEvent());
    const defs = [
      makeDef({ id: 'a', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'b', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'c', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
      makeDef({ id: 'd', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];
    // All at 8/10 = 80%

    const result = findNearUnlocks(defs, events, makeState());
    expect(result).toHaveLength(3);
    // All at 80%, sorted by id
    expect(result[0]!.achievement_id).toBe('a');
    expect(result[1]!.achievement_id).toBe('b');
    expect(result[2]!.achievement_id).toBe('c');
  });

  // ── Unsupported types skipped ───────────────────────────────────

  it('skips sequence, event, pattern_match, ratio, mode types', () => {
    const defs: AchievementDefinition[] = [
      makeDef({ id: 'seq', conditions: [{ type: 'sequence', value: 1 }] as Condition[] }),
      makeDef({ id: 'evt', conditions: [{ type: 'event', value: 1 }] as Condition[] }),
      makeDef({ id: 'pm', conditions: [{ type: 'pattern_match', value: 1 }] as Condition[] }),
      makeDef({ id: 'rat', conditions: [{ type: 'ratio', value: 1 }] as Condition[] }),
      makeDef({ id: 'mod', conditions: [{ type: 'mode', value: 1 }] as Condition[] }),
    ];

    const result = findNearUnlocks(defs, [makeEvent()], makeState());
    expect(result).toEqual([]);
  });

  it('returns empty when all achievements are unlocked', () => {
    const def = makeDef({
      conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    });
    const state = makeState({ unlocked: { test_ach: '2026-01-01' } });

    const result = findNearUnlocks([def], [makeEvent()], state);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they pass**

Run: `npx vitest run tests/utils/progress-nudge.test.ts`
Expected: 15 tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/utils/progress-nudge.test.ts
git commit -m "test: add 15 tests for progress nudge calculator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Integrate into `cmdPoll()` in hook.ts

**Files:**
- Modify: `src/cli/hook.ts:384-415`

- [ ] **Step 1: Add imports at top of hook.ts**

Add after line 49 (`import { sendNotification } from '../utils/notify.js';`):
```typescript
import { renderPopup, type PopupAchievement } from '../utils/ansi-popup.js';
import { findNearUnlocks } from '../utils/progress-nudge.js';
```

- [ ] **Step 2: Replace `cmdPoll()` body with integrated version**

Replace the current `cmdPoll()` function (lines 384-415) with:

```typescript
function cmdPoll(): void {
  ENGINE.init();

  const newlyUnlocked = ENGINE.poll();

  if (newlyUnlocked.length === 0) {
    process.stderr.write('[AGPA] poll: no new achievements\n');
    return;
  }

  // Compute highest rarity for sound dedup
  const RARITY_RANK: Record<string, number> = {
    common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
  };
  let topRarity = 'common';
  let topRank = -1;
  for (const ach of newlyUnlocked) {
    const rank = RARITY_RANK[ach.rarity] ?? 0;
    if (rank > topRank) { topRank = rank; topRarity = ach.rarity; }
  }

  const cfg = loadConfig();
  const useZh = cfg.lang === 'zh';
  for (const ach of newlyUnlocked) {
    const icon = ach.icon || '🏆';
    const title = useZh ? (ach.name_cn || ach.name) : ach.name;
    const desc = useZh ? (ach.description_cn || ach.description) : ach.description;
    sendNotification(`${icon} ${title}`, desc, ENGINE.stateDir, activeProfile, topRarity);
  }

  // ── ANSI popup (TTY only) ─────────────────────────────────────
  const popupData: PopupAchievement[] = newlyUnlocked.map(ach => ({
    icon: ach.icon || '🏆',
    name: useZh ? (ach.name_cn || ach.name) : ach.name,
    description: useZh ? (ach.description_cn || ach.description) : ach.description,
    rarity: ach.rarity,
    category: ach.category,
    set_name: undefined, // populated from setDefinitions if available
    set_progress: undefined,
    progress: ach.progress_trackable
      ? { current: (ach as any).current ?? 0, max: (ach as any).target ?? 1 }
      : undefined,
  }));
  const popup = renderPopup(popupData);
  if (popup) process.stdout.write(popup + '\n');

  // ── Progress nudge (TTY only) ─────────────────────────────────
  if (process.stdout.isTTY) {
    const near = findNearUnlocks(ENGINE.definitions, ENGINE.events, ENGINE.state);
    if (near.length > 0) {
      const lines: string[] = ['  \x1b[33m⚡ Getting close:\x1b[0m'];
      for (const n of near) {
        const pct = Math.round((n.current / n.target) * 100);
        lines.push(`   ◦ \x1b[37m${n.icon}  ${n.name} — ${n.current}/${n.target} ${n.unit_label} (${pct}%)\x1b[0m`);
      }
      process.stdout.write('\n' + lines.join('\n') + '\n');
    }
  }

  process.stderr.write(`[AGPA] poll: ${newlyUnlocked.length} new achievement(s) unlocked!\n`);
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: 452 + 27 = 479 tests pass (or close to this — existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/cli/hook.ts
git commit -m "feat: integrate ANSI popup + progress nudge into cmdPoll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass (~479 tests)

- [ ] **Step 2: Quick manual smoke test**

Run:
```bash
echo '{"hook_event_name":"PostToolUse","tool_name":"Read","session_id":"s_test"}' | npx tsx src/cli/hook.ts auto
echo '{"hook_event_name":"SessionEnd","session_id":"s_test"}' | npx tsx src/cli/hook.ts auto
npx tsx src/cli/hook.ts poll
```

Expected: stdout shows `[AGPA] poll:` message (may or may not unlock depending on state). No crashes, no ANSI output in non-TTY pipe. No errors on stderr aside from expected `[AGPA:auto]` tracking lines.

- [ ] **Step 3: Verify non-TTY fallback**

Run:
```bash
npx tsx src/cli/hook.ts poll 2>/dev/null | cat
```
Expected: No ANSI escape codes in output (since pipe is not a TTY). Only `[AGPA] poll:` messages if any.

- [ ] **Step 4: Push**

```bash
git push origin dev2
```

---

### Task 8: Update CHANGELOG and push

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Insert after the existing terminal UX design entry at the top of the [0.1.6] section:

```markdown
### 终端 ANSI 弹窗 + 进度感知 — 2026-06-05

- `src/utils/ansi-popup.ts` — ANSI 256 色成就解锁弹窗渲染器（Unicode 框线 + 稀有度着色 + 进度条）
- `src/utils/progress-nudge.ts` — 近锁成就计算器，支持 counter/threshold/streak/distinct_count/sequence_count/set_completion 6 种条件类型
- `src/cli/hook.ts` `cmdPoll()` — 集成 ANSI popup + progress nudge 输出（Stop hook 触发时）
- `src/engine/evaluator.ts` — `evaluateMetric` 改为 export 供 progress-nudge 复用
- Non-TTY fallback：管道/CI 环境自动跳过 ANSI 渲染，保持纯文本
- 新增 27 个测试（ansi-popup: 12, progress-nudge: 15）
```

- [ ] **Step 2: Commit and push**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG — terminal ANSI popup + progress nudge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin dev2
```
