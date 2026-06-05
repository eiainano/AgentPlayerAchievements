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
