import { describe, it, expect } from 'vitest';
import { buildTimeline } from '../../src/dashboard/timeline.js';

describe('buildTimeline', () => {
  it('returns empty array for empty unlocks', () => {
    expect(buildTimeline({})).toEqual([]);
  });

  it('single entry returns that entry', () => {
    const result = buildTimeline({ test_id: '2026-01-01T00:00:00Z' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('test_id');
    expect(result[0]!.unlocked_at).toBe('2026-01-01T00:00:00Z');
  });

  it('sorts entries by unlocked_at descending (newest first)', () => {
    const result = buildTimeline({
      old: '2026-01-01T00:00:00Z',
      middle: '2026-03-15T00:00:00Z',
      new: '2026-06-01T00:00:00Z',
    });
    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe('new');
    expect(result[1]!.id).toBe('middle');
    expect(result[2]!.id).toBe('old');
  });

  it('handles ISO string timestamps correctly', () => {
    const result = buildTimeline({
      a: '2026-06-01T12:00:00Z',
      b: '2026-06-01T10:00:00Z', // earlier same day
    });
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
  });

  it('preserves original id strings', () => {
    const result = buildTimeline({ 'my.achievement': '2026-01-01T00:00:00Z' });
    expect(result[0]!.id).toBe('my.achievement');
  });
});
