import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderBanner, getVersion } from '../../src/cli/index.js';

vi.mock('figlet', () => ({
  default: {
    textSync: vi.fn(),
  },
}));

import figlet from 'figlet';
const mockTextSync = vi.mocked(figlet.textSync);

const SLANT_ART = `    ___   __________  ___ \n   /   | / ____/ __ \\/   |\n  / /| |/ / __/ /_/ / /| |\n / ___ / /_/ / ____/ ___ |\n/_/  |_\\____/_/   /_/  |_|\n                           `;

const SMALL_ART = `    _   ___ ___  _   \n   /_\\ / __| _ \\/_\\  \n  / _ \\ (_ |  _/ _ \\ \n /_/ \\_\\___|_|/_/ \\_\\`;

describe('renderBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Text fallback (< 60 cols) ─────────────────────────────────

  it('returns text-only fallback when width < 60 (no figlet call)', () => {
    const result = renderBanner(50, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).toContain('AGPA');
    expect(result).toContain('v0.1.0');
    // Should NOT contain box-drawing chars or figlet art
    expect(result).not.toContain('┌');
    expect(result).not.toContain('└');
    expect(mockTextSync).not.toHaveBeenCalled();
  });

  // ── Figlet font selection ─────────────────────────────────────

  it('uses Slant font for width >= 80', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    renderBanner(80, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Slant' }));
  });

  it('uses Small font for width 60-79', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    renderBanner(70, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Small' }));
  });

  // ── Box-drawing panel ─────────────────────────────────────────

  it('draws Unicode box-drawing border around art', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('┌');
    expect(result).toContain('┐');
    expect(result).toContain('└');
    expect(result).toContain('┘');
    expect(result).toContain('│');
  });

  it('includes title in top bar', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('🏆 Agent Player Achievements');
  });

  // ── Gold gradient ─────────────────────────────────────────────

  it('applies gold gradient ANSI codes to art rows', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('\x1b[38;2;255;215;0m'); // bright gold
    expect(result).toContain('\x1b[38;2;184;134;11m'); // dark gold
  });

  // ── Subtitle & version ───────────────────────────────────────

  it('includes version in subtitle', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '9.9.9');
    expect(result).toContain('v9.9.9');
  });

  it('includes GitHub link in standard mode (>= 80)', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('github.com/eiainano/AgentPlayerAchievements');
  });

  it('omits GitHub link in compact mode (< 80)', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    const result = renderBanner(70, '0.1.0');
    expect(result).not.toContain('github.com');
  });

  // ── Figlet failure fallback ───────────────────────────────────

  it('returns text fallback when figlet throws', () => {
    mockTextSync.mockImplementation(() => { throw new Error('font not found'); });
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).toContain('AGPA');
    expect(result).not.toContain('┌');
  });

  // ── Boundary values ───────────────────────────────────────────

  it('uses Slant at exactly 80', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    renderBanner(80, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Slant' }));
  });

  it('uses Small at exactly 79', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    renderBanner(79, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Small' }));
  });

  it('uses Small at exactly 60', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    renderBanner(60, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Small' }));
  });

  it('uses text fallback at exactly 59', () => {
    const result = renderBanner(59, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).not.toContain('┌');
    expect(mockTextSync).not.toHaveBeenCalled();
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
