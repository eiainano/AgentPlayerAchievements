import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderPixelArtSVG, renderPixelArtSVGRaw, renderPixelArtANSI, PixelArtBrowserJS } from '../../src/utils/pixel-art.js';
import type { PixelArtSize } from '../../src/engine/types.js';
import { parseYAML } from '../../src/engine/yaml-parser.js';
import { renderPopup, type PopupAchievement } from '../../src/utils/ansi-popup.js';

// ── Test fixtures ────────────────────────────────────────────────────────

function makePixelArtSize(overrides: Partial<{ palette: string[]; data: string[] }> = {}): PixelArtSize {
  const palette = overrides.palette ?? ['⬛', '#ff6b35', '#ffd700', '#8b4513'];
  // Build a simple 5×5 test grid: a colored square in the center
  const size = overrides.data?.[0]?.length ?? 5;
  const data = overrides.data ?? [
    '00000',
    '01110',
    '01210',
    '01110',
    '00000',
  ];
  return { palette, data };
}

// A typical 48×48-style YAML snippet for parseYAML testing
function pixelArtYamlFixture(): string {
  // Build 48 properly-indented YAML data rows
  const dataRows = Array.from({ length: 48 }, (_, i) => {
    if (i === 0) return '          - "000000000000000000000000000000000000000000000000"';
    if (i === 1) return '          - "000000000000000111000000000000000000000000000000"';
    if (i === 2) return '          - "000000000000001221000000000000000000000000000000"';
    if (i === 3) return '          - "000000000000011111000000000000000000000000000000"';
    return `          - "${'0'.repeat(48)}"`;
  }).join('\n');

  return `definitions:
  - id: pixel-test
    name: Pixel Test
    description: Has pixel art
    icon: 🎨
    category: testing
    rarity: rare
    conditions: []
    pixel_art:
      48:
        palette:
          - "⬛"
          - "#ff6b35"
          - "#ffd700"
        data:
${dataRows}`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// ── Shared Rendering ──────────────────────────────────────────────────────

describe('renderPixelArtSVG', () => {
  it('returns a data URI with svg content', () => {
    const pa = makePixelArtSize();
    const result = renderPixelArtSVG(pa, 2);
    expect(result).toMatch(/^data:image\/svg\+xml,/);
    // Decode to verify structure
    const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('viewBox="0 0 10 10"');
    expect(decoded).toContain('<rect');
    expect(decoded).toContain('shape-rendering="crispEdges"');
  });

  it('skips transparent pixels (index 0)', () => {
    const pa = makePixelArtSize();
    const result = renderPixelArtSVG(pa, 2);
    const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
    // The rects should only cover non-'0' pixels
    // In our fixture: 5×5 grid, 0s on border, 1/2 in center = 9 non-transparent pixels
    const rectMatches = decoded.match(/<rect/g);
    expect(rectMatches).not.toBeNull();
    expect(rectMatches!.length).toBe(9);
  });

  it('skips ⬛ marker in palette', () => {
    const pa = makePixelArtSize({ palette: ['⬛', '#ff0000'] });
    const result = renderPixelArtSVG(pa, 2);
    const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
    // Only index 1 (#ff0000) should render; ⬛ at index 0 is skipped
    expect(decoded).toContain('#ff0000');
    expect(decoded).not.toContain('fill="⬛"');
  });

  it('handles empty data gracefully', () => {
    const pa: PixelArtSize = { palette: ['⬛'], data: [] };
    const result = renderPixelArtSVG(pa, 2);
    const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
    expect(decoded).toContain('<svg');
    expect(decoded).not.toContain('<rect'); // no rects for empty data
  });

  it('accepts custom cellSize', () => {
    const pa = makePixelArtSize();
    const result4 = renderPixelArtSVG(pa, 4);
    const decoded = decodeURIComponent(result4.replace('data:image/svg+xml,', ''));
    expect(decoded).toContain('viewBox="0 0 20 20"');
    expect(decoded).toContain('width="20"');
  });

  it('handles palette with hex colors including # prefix', () => {
    const pa = makePixelArtSize({ palette: ['⬛', '#ff0000', '#00ff00'] });
    const result = renderPixelArtSVG(pa, 2);
    // # gets encoded to %23 in data URI
    expect(result).toContain('%23ff0000');
  });
});

describe('renderPixelArtSVGRaw', () => {
  it('returns raw SVG string (not data URI)', () => {
    const pa = makePixelArtSize();
    const result = renderPixelArtSVGRaw(pa, 2);
    expect(result).not.toMatch(/^data:/);
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
    // Contains actual hex colors (not URL-encoded)
    expect(result).toContain('#ff6b35');
  });

  it('includes shape-rendering crispEdges for pixelated look', () => {
    const pa = makePixelArtSize();
    expect(renderPixelArtSVGRaw(pa)).toContain('shape-rendering="crispEdges"');
  });
});

// ── Terminal ANSI Rendering ───────────────────────────────────────────────

describe('renderPixelArtANSI', () => {
  let columnsOrig: number | undefined;

  beforeEach(() => {
    columnsOrig = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true, writable: true });
  });

  afterEach(() => {
    if (columnsOrig !== undefined) {
      Object.defineProperty(process.stdout, 'columns', { value: columnsOrig, configurable: true, writable: true });
    }
  });

  it('returns empty string when terminal is too narrow', () => {
    Object.defineProperty(process.stdout, 'columns', { value: 40, configurable: true, writable: true });
    // Our test data is 5 columns wide, terminal is 40 which is >= 5 → should render
    // Need a wider fixture to test narrow terminal
    const wideData = Array.from({ length: 48 }, () => '0'.repeat(48));
    const widePa: PixelArtSize = { palette: ['⬛', '#ff0000'], data: wideData };
    Object.defineProperty(process.stdout, 'columns', { value: 30, configurable: true, writable: true });
    expect(renderPixelArtANSI(widePa)).toBe('');
  });

  it('renders ANSI-colored half-block characters', () => {
    // 4×4 grid with both upper and lower pixels filled
    const pa: PixelArtSize = {
      palette: ['⬛', '#ff0000', '#0000ff'],
      data: [
        '0110',
        '0220',
        '0220',
        '0110',
      ],
    };
    const result = renderPixelArtANSI(pa);
    // Should produce 2 lines (4 pixel rows / 2)
    const lines = result.split('\n');
    // Each line ends with reset
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(result).toContain('\x1b['); // ANSI escapes present
    expect(result).toContain('\x1b[0m'); // reset at line end
  });

  it('renders transparent-only rows as spaces with reset', () => {
    const pa: PixelArtSize = {
      palette: ['⬛', '#ff0000'],
      data: [
        '0000',
        '0000',
      ],
    };
    const result = renderPixelArtANSI(pa);
    // All transparent → one line of spaces, ending with reset
    const stripped = stripAnsi(result);
    // 4 space chars (one per column), trimmed → empty (all spaces)
    expect(stripped.trim()).toBe('');
    // But raw result should have the reset escape
    expect(result).toContain('\x1b[0m');
  });

  it('respects maxWidth parameter', () => {
    const pa: PixelArtSize = {
      palette: ['⬛', '#ff0000'],
      data: Array.from({ length: 10 }, () => '0'.repeat(10)),
    };
    // maxWidth=5 < data width=10 → should return ""
    expect(renderPixelArtANSI(pa, 5)).toBe('');
  });
});

// ── Browser JS Snippet ────────────────────────────────────────────────────

describe('PixelArtBrowserJS', () => {
  it('defines a self-contained JS snippet', () => {
    expect(PixelArtBrowserJS).toContain('var PixelArtRenderer');
    expect(PixelArtBrowserJS).toContain('toDataURI');
    expect(PixelArtBrowserJS).toContain('toSVGRaw');
  });

  it('is parseable JavaScript', () => {
    // The snippet should be valid JS (no syntax errors)
    expect(() => {
      // Strip the comment header
      const code = PixelArtBrowserJS.replace(/\/\*.*?\*\//s, '');
      new Function(code);
    }).not.toThrow();
  });
});

// ── YAML Parser Integration ───────────────────────────────────────────────

describe('parseYAML pixel_art', () => {
  it('parses pixel_art field from YAML', () => {
    const yaml = pixelArtYamlFixture();
    const result = parseYAML(yaml);
    expect(result.definitions).toHaveLength(1);
    const def = result.definitions[0]!;
    expect(def.pixel_art).toBeDefined();
    expect(def.pixel_art!['48']).toBeDefined();
  });

  it('parses 48×48 palette correctly', () => {
    const yaml = pixelArtYamlFixture();
    const result = parseYAML(yaml);
    const pa48 = result.definitions[0]!.pixel_art!['48']!;
    expect(pa48.palette).toHaveLength(3);
    expect(pa48.palette[0]).toBe('⬛');
    expect(pa48.palette[1]).toBe('#ff6b35');
    expect(pa48.palette[2]).toBe('#ffd700');
  });

  it('parses 48×48 data with correct row count', () => {
    const yaml = pixelArtYamlFixture();
    const result = parseYAML(yaml);
    const pa48 = result.definitions[0]!.pixel_art!['48']!;
    expect(pa48.data).toHaveLength(48);
    expect(pa48.data[0]!).toHaveLength(48);
  });

  it('returns undefined when pixel_art is absent', () => {
    const yaml = `definitions:
  - id: no-pixel
    name: No Pixel
    description: No pixel art here
    icon: ❌
    category: testing
    rarity: common
    conditions: []`;
    const result = parseYAML(yaml);
    expect(result.definitions[0]!.pixel_art).toBeUndefined();
  });

  it('rejects pixel_art with invalid palette (missing ⬛)', () => {
    const yaml = `definitions:
  - id: bad-palette
    name: Bad Palette
    description: Missing transparent marker
    icon: ❌
    category: testing
    rarity: common
    conditions: []
    pixel_art:
      48:
        palette:
          - "#ff0000"
          - "#00ff00"
        data:
          - "010"
          - "101"
          - "010"`;
    const result = parseYAML(yaml);
    expect(result.definitions[0]!.pixel_art).toBeUndefined();
  });

  it('rejects pixel_art with wrong data row count', () => {
    const yaml = `definitions:
  - id: bad-rows
    name: Bad Rows
    description: Wrong number of rows
    icon: ❌
    category: testing
    rarity: common
    conditions: []
    pixel_art:
      48:
        palette:
          - "⬛"
          - "#ff0000"
        data:
          - "01"
          - "10"`;
    const result = parseYAML(yaml);
    // 48 resolution but only 2 data rows → should be rejected
    expect(result.definitions[0]!.pixel_art).toBeUndefined();
  });

  it('rejects pixel_art with invalid index chars in data', () => {
    const yaml = `definitions:
  - id: bad-chars
    name: Bad Chars
    description: Invalid characters in data
    icon: ❌
    category: testing
    rarity: common
    conditions: []
    pixel_art:
      10:
        palette:
          - "⬛"
          - "#ff0000"
        data:
          - "0101010101"
          - "1010101010"
          - "0101X01010"
          - "1010101010"
          - "0101010101"
          - "1010101010"
          - "0101010101"
          - "1010101010"
          - "0101010101"
          - "1010101010"`;
    const result = parseYAML(yaml);
    // 'X' is not a valid palette index for a 2-color palette
    expect(result.definitions[0]!.pixel_art).toBeUndefined();
  });

  it('skips invalid resolution but keeps valid ones', () => {
    const yaml = `definitions:
  - id: mixed
    name: Mixed Resolutions
    description: One valid, one invalid
    icon: 🎨
    category: testing
    rarity: common
    conditions: []
    pixel_art:
      48:
        palette:
          - "⬛"
          - "#ff0000"
        data:
          - "000000000000000000000000000000000000000000000000"
          - "000000000000000000000000000000000000000000000000"
${'          - "000000000000000000000000000000000000000000000000"\n'.repeat(44)}          - "000000000000000000000000000000000000000000000000"
          - "000000000000000000000000000000000000000000000000"
      999:
        palette:
          - "#ff0000"
        data:
          - "0"`;
    const result = parseYAML(yaml);
    // 48 is valid, 999 is not a recognized resolution
    expect(result.definitions[0]!.pixel_art).toBeDefined();
    expect(result.definitions[0]!.pixel_art!['48']).toBeDefined();
    // 999 should not be present
    expect(Object.keys(result.definitions[0]!.pixel_art!)).toHaveLength(1);
  });

  it('handles pixel_art with palette at max capacity (36 colors)', () => {
    // Generate a valid 48×48 all-transparent grid
    const rows = Array.from({ length: 48 }, () => '0'.repeat(48));
    const paletteColors = Array.from({ length: 36 }, (_, i) =>
      i === 0 ? '⬛' : `#${i.toString(16).padStart(2, '0')}${i.toString(16).padStart(2, '0')}${i.toString(16).padStart(2, '0')}`
    );
    const yaml = `definitions:
  - id: max-palette
    name: Max Palette
    description: 36 colors
    icon: 🎨
    category: testing
    rarity: common
    conditions: []
    pixel_art:
      48:
        palette:
${paletteColors.map(c => `          - "${c}"`).join('\n')}
        data:
${rows.map(r => `          - "${r}"`).join('\n')}`;

    const result = parseYAML(yaml);
    expect(result.definitions[0]!.pixel_art!['48']!.palette).toHaveLength(36);
  });
});

describe('badge_pixel_art', () => {
  it('parses 48×24 badge pixel art from set definitions', () => {
    const yaml = `
definitions:
  - id: a1
    name: A1
    icon: 🏆
    category: test
    rarity: common
    set: test_set
    conditions: []
sets:
  test_set:
    name: Test Set
    achievements: [a1]
    reward:
      type: badge
      value: Test Badge
    pixel_art:
      palette:
        - "⬛"
        - "#ffd700"
        - "#b8860b"
      data:
${Array.from({length: 24}, (_, i) => {
  if (i < 3) return '        - "000000000011111111111100000000000000000000000000"';
  if (i >= 21) return '        - "000000000011111111111100000000000000000000000000"';
  return '        - "000011111111111111111111111100000000000000000000"';
}).join('\n')}
`;
    const result = parseYAML(yaml);
    expect(result.sets).toHaveLength(1);
    const set = result.sets[0]!;
    expect(set.id).toBe('test_set');
    expect(set.pixel_art).toBeDefined();
    expect(set.pixel_art!.palette).toHaveLength(3);
    expect(set.pixel_art!.palette[0]).toBe('⬛');
    expect(set.pixel_art!.palette[1]).toBe('#ffd700');
    expect(set.pixel_art!.data).toHaveLength(24);
    expect(set.pixel_art!.data[0]).toHaveLength(48);
  });

  it('rejects badge pixel art with wrong row count', () => {
    const dataRows = Array.from({length: 20}, () => '        - "' + '0'.repeat(48) + '"').join('\n');
    const yaml = `
definitions:
  - id: a1
    name: A1
    icon: 🏆
    category: test
    rarity: common
    set: test_set
    conditions: []
sets:
  test_set:
    name: Test Set
    achievements: [a1]
    reward:
      type: badge
      value: Test Badge
    pixel_art:
      palette:
        - "⬛"
        - "#ffd700"
      data:
${dataRows}
`;
    const result = parseYAML(yaml);
    expect(result.sets[0]!.pixel_art).toBeUndefined();
  });

  it('rejects badge pixel art with wrong column count', () => {
    const dataRows = Array.from({length: 24}, () => '        - "' + '0'.repeat(32) + '"').join('\n');
    const yaml = `
definitions:
  - id: a1
    name: A1
    icon: 🏆
    category: test
    rarity: common
    set: test_set
    conditions: []
sets:
  test_set:
    name: Test Set
    achievements: [a1]
    reward:
      type: badge
      value: Test Badge
    pixel_art:
      palette:
        - "⬛"
        - "#ffd700"
      data:
${dataRows}
`;
    const result = parseYAML(yaml);
    expect(result.sets[0]!.pixel_art).toBeUndefined();
  });

  it('rejects badge pixel art without transparent marker', () => {
    const dataRows = Array.from({length: 24}, () => '        - "' + '0'.repeat(48) + '"').join('\n');
    const yaml = `
definitions:
  - id: a1
    name: A1
    icon: 🏆
    category: test
    rarity: common
    set: test_set
    conditions: []
sets:
  test_set:
    name: Test Set
    achievements: [a1]
    reward:
      type: badge
      value: Test Badge
    pixel_art:
      palette:
        - "#ffd700"
      data:
${dataRows}
`;
    const result = parseYAML(yaml);
    expect(result.sets[0]!.pixel_art).toBeUndefined();
  });
});

// ── ANSI Popup Integration ─────────────────────────────────────────────────

describe('renderPopup with pixel_art', () => {
  let isTTYOrig: boolean;

  beforeEach(() => {
    isTTYOrig = process.stdout.isTTY!;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: isTTYOrig, configurable: true });
  });

  it('renders popup without pixel_art (backward compatible)', () => {
    const ach: PopupAchievement = {
      icon: '🏆',
      name: 'Test',
      description: 'A test achievement',
      rarity: 'common',
    };
    const result = renderPopup([ach]);
    expect(result).toContain('🏆');
    expect(result).toContain('Achievement Unlocked!');
  });

  it('renders popup with pixel_art_48', () => {
    // Simple 8×8 pixel art that's small enough not to overwhelm
    const pixelArt: PixelArtSize = {
      palette: ['⬛', '#ff0000', '#0000ff'],
      data: [
        '00011000',
        '00122100',
        '01200210',
        '01000010',
        '01000010',
        '01200210',
        '00122100',
        '00011000',
      ],
    };
    const ach: PopupAchievement = {
      icon: '🏆',
      name: 'Pixel Achievement',
      description: 'Has pixel art',
      rarity: 'rare',
      pixel_art_48: pixelArt,
    };
    const result = renderPopup([ach]);
    // Should contain ANSI color codes from pixel art
    expect(result).toContain('\x1b[');
    // Should still contain the card
    expect(stripAnsi(result)).toContain('"Pixel Achievement"');
  });

  it('falls back when terminal is too narrow for pixel art', () => {
    Object.defineProperty(process.stdout, 'columns', { value: 20, configurable: true, writable: true });
    const widePa: PixelArtSize = {
      palette: ['⬛', '#ff0000'],
      data: Array.from({ length: 48 }, () => '0'.repeat(48)),
    };
    const ach: PopupAchievement = {
      icon: '🏆',
      name: 'Wide Pixel',
      description: 'Too wide for terminal',
      rarity: 'common',
      pixel_art_48: widePa,
    };
    const result = renderPopup([ach]);
    // Should still render the card (pixel art skipped)
    const s = stripAnsi(result);
    expect(s).toContain('"Wide Pixel"');
    // But should NOT contain block characters (pixel art was skipped)
    expect(result).not.toContain('█');
  });

  it('does not crash with pixel_art but non-TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const ach: PopupAchievement = {
      icon: '🏆',
      name: 'Non-TTY Test',
      description: 'Should return empty',
      rarity: 'common',
      pixel_art_48: makePixelArtSize(),
    };
    expect(renderPopup([ach])).toBe('');
  });
});
