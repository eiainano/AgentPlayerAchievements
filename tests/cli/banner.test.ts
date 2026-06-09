import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderBanner, getVersion } from '../../src/cli/index.js';

vi.mock('figlet', () => ({
  default: { textSync: vi.fn() },
}));

import figlet from 'figlet';
const mockTextSync = vi.mocked(figlet.textSync);

// Test art fixtures (text content doesn't matter — we mock figlet.textSync)
const LARRY_3D_ART = ` ______  ____    ____    ______     \n/\\  _  \\/\\  _\`\\ /\\  _\`\\ /\\  _  \\    \n\\ \\ \\L\\ \\ \\ \\L\\_\\ \\ \\L\\ \\ \\ \\L\\ \\   \n \\ \\  __ \\ \\ \\L_L\\ \\ ,__/\\ \\  __ \\  \n  \\ \\ \\/\\ \\ \\ \\/, \\ \\ \\/  \\ \\ \\/\\ \\ \n   \\ \\_\\ \\_\\ \\____/\\ \\_\\   \\ \\_\\ \\_\\\n    \\/_/\\/_/\\/___/  \\/_/    \\/_/\\/_/`;

const SMALL_ART = `    _   ___ ___  _   \n   /_\\ / __| _ \\/_\\  \n  / _ \\ (_ |  _/ _ \\ \n /_/ \\_\\___|_|/_/ \\_\\`;

describe('renderBanner', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Text fallback (< 60 cols) ───────────────────────────────────

  it('returns text fallback when width < 60', () => {
    const result = renderBanner(50, '0.1.0');
    expect(result).toContain('▸ AGPA');
    expect(result).toContain('v0.1.0');
    expect(mockTextSync).not.toHaveBeenCalled();
  });

  // ── Font selection ──────────────────────────────────────────────

  it('uses Larry 3D font for width >= 80', () => {
    mockTextSync.mockReturnValue(LARRY_3D_ART);
    renderBanner(80, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Larry 3D' }));
  });

  it('uses Small font for width 60-79', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    renderBanner(70, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Small' }));
  });

  // ── Neon gradient ───────────────────────────────────────────────

  it('applies cyan→magenta gradient to art rows', () => {
    mockTextSync.mockReturnValue(LARRY_3D_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('\x1b[38;2;0;255;255m');   // cyan
    expect(result).toContain('\x1b[38;2;220;50;220m');  // purple
  });

  // ── No decorations ──────────────────────────────────────────────

  it('has no box-drawing characters (borderless)', () => {
    mockTextSync.mockReturnValue(LARRY_3D_ART);
    const result = renderBanner(100, '0.1.0');
    expect(result).not.toContain('┌'); expect(result).not.toContain('┐');
    expect(result).not.toContain('╔'); expect(result).not.toContain('╗');
    expect(result).not.toContain('║'); expect(result).not.toContain('═');
  });

  // ── Content ─────────────────────────────────────────────────────

  it('includes version in subtitle', () => {
    mockTextSync.mockReturnValue(LARRY_3D_ART);
    expect(renderBanner(100, '9.9.9')).toContain('v9.9.9');
  });

  it('includes GitHub link in standard mode', () => {
    mockTextSync.mockReturnValue(LARRY_3D_ART);
    expect(renderBanner(100, '0.1.0')).toContain('github.com/eiainano/AgentPlayerAchievements');
  });

  it('omits GitHub link in compact mode', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    expect(renderBanner(70, '0.1.0')).not.toContain('github.com');
  });

  // ── Fallback ────────────────────────────────────────────────────

  it('returns text fallback when figlet throws', () => {
    mockTextSync.mockImplementation(() => { throw new Error('font not found'); });
    const result = renderBanner(100, '0.1.0');
    expect(result).toContain('▸ AGPA');
    expect(result).not.toContain('___');
  });

  // ── Boundaries ──────────────────────────────────────────────────

  it('uses Larry 3D at exactly 80', () => {
    mockTextSync.mockReturnValue(LARRY_3D_ART);
    renderBanner(80, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Larry 3D' }));
  });

  it('uses Small at exactly 79', () => {
    mockTextSync.mockReturnValue(SMALL_ART);
    renderBanner(79, '0.1.0');
    expect(mockTextSync).toHaveBeenCalledWith('AGPA', expect.objectContaining({ font: 'Small' }));
  });

  it('uses text fallback at exactly 59', () => {
    const result = renderBanner(59, '0.1.0');
    expect(result).toContain('▸ AGPA');
    expect(mockTextSync).not.toHaveBeenCalled();
  });
});

describe('getVersion', () => {
  it('returns a non-empty string', () => {
    expect(typeof getVersion()).toBe('string');
    expect(getVersion().length).toBeGreaterThan(0);
  });

  it('matches semver or fallback pattern', () => {
    expect(getVersion()).toMatch(/^(\d+\.\d+\.\d+|0\.1\.x)$/);
  });
});
