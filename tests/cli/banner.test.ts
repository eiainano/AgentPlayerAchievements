import { describe, it, expect } from 'vitest';
import { renderBanner, getVersion } from '../../src/cli/index.js';

describe('renderBanner', () => {
  it('returns standard banner (5 art rows with block chars) when width >= 80', () => {
    const result = renderBanner(80, '0.1.0');
    // Standard banner uses █ (full block) for pixel art
    expect(result).toContain('█');
    // Should have gold ANSI code for first row
    expect(result).toContain('\x1b[38;2;255;215;0m');
    // Should contain subtitle
    expect(result).toContain('Agent Player Achievements');
    expect(result).toContain('v0.1.0');
  });

  it('returns compact banner (half-block art) when width 60-79', () => {
    const result = renderBanner(70, '0.1.0');
    // Compact uses ▀ (upper half block)
    expect(result).toContain('▀');
    expect(result).toContain('Agent Player Achievements');
  });

  it('returns text-only fallback when width < 60', () => {
    const result = renderBanner(50, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).toContain('AGPA');
    // Should NOT contain block art characters
    expect(result).not.toContain('█');
    expect(result).not.toContain('▀');
  });

  it('includes version in subtitle', () => {
    const result = renderBanner(80, '9.9.9');
    expect(result).toContain('v9.9.9');
  });

  it('returns standard at exactly 80 (boundary)', () => {
    const result = renderBanner(80, '0.1.0');
    expect(result).toContain('█');
  });

  it('returns compact at exactly 79 (boundary)', () => {
    const result = renderBanner(79, '0.1.0');
    expect(result).toContain('▀');
  });

  it('returns compact at exactly 60 (boundary)', () => {
    const result = renderBanner(60, '0.1.0');
    expect(result).toContain('▀');
  });

  it('returns text-only at exactly 59 (boundary)', () => {
    const result = renderBanner(59, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).not.toContain('█');
  });
});

describe('getVersion', () => {
  it('returns a non-empty string', () => {
    const v = getVersion();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it('matches semver or fallback pattern', () => {
    const v = getVersion();
    expect(v).toMatch(/^(\d+\.\d+\.\d+|0\.1\.x)$/);
  });
});
