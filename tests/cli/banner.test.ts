import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderBanner, getVersion } from '../../src/cli/index.js';

vi.mock('figlet', () => ({
  default: { textSync: vi.fn() },
}));

import figlet from 'figlet';
const mockTextSync = vi.mocked(figlet.textSync);

const SLANT_ART = `    ___   __________  ___ \n   /   | / ____/ __ \\/   |\n  / /| |/ / __/ /_/ / /| |\n / ___ / /_/ / ____/ ___ |\n/_/  |_\\____/_/   /_/  |_|\n                           `;

const ITALIC_ART = `  _   __  __  _  \n /_| / _ /__)/_| \n(  |(__)/   (  | `;

describe('renderBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Text fallback ───────────────────────────────────────────────

  it('returns text fallback when width < 60', () => {
    const result = renderBanner(50, '0.1.0');
    expect(result).toContain('▸ AGPA');
    expect(result).toContain('v0.1.0');
    expect(result).toContain('\x1b[38;2;0;255;255m'); // cyan
    expect(mockTextSync).not.toHaveBeenCalled();
  });

  // ── Font selection ──────────────────────────────────────────────

  it('uses Slant font for width >= 85', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    renderBanner(85, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Slant' }));
  });

  it('uses Italic font for width 60-84', () => {
    mockTextSync.mockReturnValue(ITALIC_ART);
    renderBanner(70, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Italic' }));
  });

  // ── Neon gradient ───────────────────────────────────────────────

  it('applies cyan→magenta gradient to reflection rows', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('\x1b[38;2;0;255;255m');   // cyan
    expect(result).toContain('\x1b[38;2;220;50;220m');  // purple
  });

  // ── Neon reflection ─────────────────────────────────────────────

  it('draws neon reflection: white glow above dim colored copy', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    // White glow text
    expect(result).toContain('\x1b[38;2;230;240;255m');
    // Dim separator line
    expect(result).toContain('\x1b[2m');
    expect(result).toContain('▁');
    // Reflection should contain dim colored art
    const dimCount = (result.match(/\x1b\[2m/g) || []).length;
    // One per reflection row + separator
    expect(dimCount).toBeGreaterThanOrEqual(6);
  });

  // ── Content ─────────────────────────────────────────────────────

  it('includes version', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '9.9.9');
    expect(result).toContain('v9.9.9');
  });

  it('includes GitHub link in standard mode', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('github.com/eiainano/AgentPlayerAchievements');
  });

  it('omits GitHub link in compact mode', () => {
    mockTextSync.mockReturnValue(ITALIC_ART);
    const result = renderBanner(70, '0.1.0');
    expect(result).not.toContain('github.com');
  });

  // ── Fallback ────────────────────────────────────────────────────

  it('returns text fallback when figlet throws', () => {
    mockTextSync.mockImplementation(() => { throw new Error('font not found'); });
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('▸ AGPA');
    expect(result).not.toContain('━');
  });

  // ── Boundaries ──────────────────────────────────────────────────

  it('uses Slant at exactly 85', () => {
    mockTextSync.mockReturnValue(SLANT_ART);
    renderBanner(85, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Slant' }));
  });

  it('uses Italic at exactly 84', () => {
    mockTextSync.mockReturnValue(ITALIC_ART);
    renderBanner(84, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Italic' }));
  });

  it('uses Italic at exactly 60', () => {
    mockTextSync.mockReturnValue(ITALIC_ART);
    renderBanner(60, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Italic' }));
  });

  it('uses text fallback at exactly 59', () => {
    const result = renderBanner(59, '0.1.0');
    expect(result).toContain('▸ AGPA');
    expect(result).not.toContain('━');
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
