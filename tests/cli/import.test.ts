import { describe, it, expect } from 'vitest';
import { resolveImportConflict } from '../../src/cli/import.js';
import type { AchievementState } from '../../src/engine/types.js';

function makeState(unlocked: Record<string, string>): AchievementState {
  return { unlocked, stats: { total_unlocked: Object.keys(unlocked).length } };
}

// ── resolveImportConflict ───────────────────────────────────────────────────

describe('resolveImportConflict', () => {
  it('merge: union of both unlock sets', () => {
    const existing = makeState({ a: '2024-01-01T00:00:00Z', b: '2024-02-01T00:00:00Z' });
    const incoming = makeState({ b: '2024-03-01T00:00:00Z', c: '2024-04-01T00:00:00Z' });
    const result = resolveImportConflict(existing, incoming, 'merge');
    expect(Object.keys(result.unlocked)).toEqual(['a', 'b', 'c']);
  });

  it('merge: keeps earliest unlock time when both have same achievement', () => {
    const existing = makeState({ x: '2024-01-01T00:00:00Z' });  // earlier
    const incoming = makeState({ x: '2024-06-01T00:00:00Z' });  // later
    const result = resolveImportConflict(existing, incoming, 'merge');
    expect(result.unlocked['x']).toBe('2024-01-01T00:00:00Z'); // keeps existing (earlier)
  });

  it('merge: uses incoming when existing is newer (same key)', () => {
    // "earliest unlock time" — if incoming is earlier, use it
    const existing = makeState({ x: '2024-06-01T00:00:00Z' }); // later
    const incoming = makeState({ x: '2024-01-01T00:00:00Z' }); // earlier
    const result = resolveImportConflict(existing, incoming, 'merge');
    expect(result.unlocked['x']).toBe('2024-01-01T00:00:00Z'); // keeps incoming (earlier)
  });

  it('merge: handles empty existing', () => {
    const existing = makeState({});
    const incoming = makeState({ a: '2024-01-01T00:00:00Z', b: '2024-02-01T00:00:00Z' });
    const result = resolveImportConflict(existing, incoming, 'merge');
    expect(Object.keys(result.unlocked)).toEqual(['a', 'b']);
    expect(result.stats?.total_unlocked).toBe(2);
  });

  it('merge: handles empty incoming', () => {
    const existing = makeState({ a: '2024-01-01T00:00:00Z' });
    const incoming = makeState({});
    const result = resolveImportConflict(existing, incoming, 'merge');
    expect(Object.keys(result.unlocked)).toEqual(['a']);
  });

  it('replace: completely overwrites existing', () => {
    const existing = makeState({ a: '2024-01-01T00:00:00Z', b: '2024-02-01T00:00:00Z' });
    const incoming = makeState({ c: '2024-03-01T00:00:00Z' });
    const result = resolveImportConflict(existing, incoming, 'replace');
    expect(Object.keys(result.unlocked)).toEqual(['c']);
  });

  it('replace: preserves incoming state fields', () => {
    const existing = makeState({ a: 'x' });
    const incoming: AchievementState = {
      unlocked: { b: 'y' },
      stats: { total_unlocked: 1, last_evaluated_line: 42 },
    };
    const result = resolveImportConflict(existing, incoming, 'replace');
    expect(result.stats?.last_evaluated_line).toBe(42);
  });
});
