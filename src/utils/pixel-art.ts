/**
 * Pixel art rendering utilities — shared between terminal (ANSI) and
 * browser (inline SVG). Pure functions, zero side effects.
 *
 * Palette format:
 *   palette[0] = "⬛" (transparent placeholder — never rendered)
 *   palette[1..N] = hex colors (e.g. "#ff6b35")
 *
 * Data format:
 *   data[row][col] = '0'-'9','A'-'Z' (index into palette via parseInt(ch, 36))
 *   '0' always maps to palette[0] = transparent → skip
 */

import type { PixelArtSize } from '../engine/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Parse hex color to [r, g, b] tuple. Returns [0,0,0] on invalid input. */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

/** Convert character index ('0'-'9','A'-'Z') to numeric palette index. */
function charToIndex(ch: string): number {
  return parseInt(ch, 36);
}

// ── Terminal ANSI Half-Block Renderer ────────────────────────────────────

/**
 * Render pixel art as half-block ANSI escape sequences for terminal display.
 *
 * Strategy:
 *   - Upper pixel exists + lower exists → █ (full block, fg=upper, bg=lower)
 *   - Upper only → ▀ (upper half block, fg=upper)
 *   - Lower only → ▄ (lower half block, fg=lower)
 *   - Neither → space
 *
 * @param pa Pixel art data (assumed 48×48).
 * @param maxWidth Optional max terminal columns (defaults to 96 to match 48×2).
 * @returns ANSI-colored string, or "" if pixel art is too wide for terminal.
 */
export function renderPixelArtANSI(pa: PixelArtSize, maxWidth = 96): string {
  const data = pa.data;
  const palette = pa.palette;
  const height = data.length;
  const width = data[0]?.length ?? 0;

  // Need at least 2× width columns (2 cells per pixel column for readability
  // when using block characters), or 1× in tight terminals
  if (process.stdout.columns && process.stdout.columns < width) return '';
  if (maxWidth < width) return '';

  const lines: string[] = [];

  // Process two pixel rows per terminal line
  for (let y = 0; y < height; y += 2) {
    const upperRow = data[y]!;
    const lowerRow = data[y + 1]; // may be undefined on odd-height

    let line = '';
    let prevFg = '';
    let prevBg = '';

    for (let x = 0; x < width; x++) {
      const upperIdx = charToIndex(upperRow[x]!);
      const lowerIdx = lowerRow ? charToIndex(lowerRow[x]!) : 0;

      const upperColor = upperIdx > 0 ? palette[upperIdx]! : null;
      const lowerColor = lowerIdx > 0 ? palette[lowerIdx]! : null;

      let char: string;
      let fg = '';
      let bg = '';

      if (upperColor && lowerColor) {
        char = '█'; // █ full block
        fg = upperColor;
        bg = lowerColor;
      } else if (upperColor) {
        char = '▀'; // ▀ upper half block
        fg = upperColor;
      } else if (lowerColor) {
        char = '▄'; // ▄ lower half block
        fg = lowerColor;
      } else {
        char = ' ';
      }

      // Build ANSI escape — skip if same as previous cell (color run optimization)
      if (fg !== prevFg || bg !== prevBg) {
        const [fr, fg2, fb] = hexToRgb(fg);
        if (bg) {
          const [br, bg2, bb] = hexToRgb(bg);
          line += `\x1b[38;2;${fr};${fg2};${fb}m\x1b[48;2;${br};${bg2};${bb}m`;
        } else if (fg) {
          line += `\x1b[38;2;${fr};${fg2};${fb}m`;
        } else {
          line += '\x1b[0m';
        }
        prevFg = fg;
        prevBg = bg;
      }

      line += char;
    }

    lines.push(line + '\x1b[0m');
  }

  return lines.join('\n');
}

// ── SVG Renderer (Node & Browser) ────────────────────────────────────────

/**
 * Render pixel art as an inline SVG data URI (suitable for `<img src="...">`).
 *
 * Uses `<rect>` elements — one per non-transparent pixel. Can be scaled
 * to any display size via CSS without losing the pixelated look.
 *
 * @param pa Pixel art data (any resolution).
 * @param cellSize SVG pixels per pixel cell (default 2).
 * @returns data:image/svg+xml URI string.
 */
export function renderPixelArtSVG(pa: PixelArtSize, cellSize = 2): string {
  const data = pa.data;
  const palette = pa.palette;
  const height = data.length;
  const width = data[0]?.length ?? 0;

  const viewW = width * cellSize;
  const viewH = height * cellSize;

  let rects = '';

  for (let y = 0; y < height; y++) {
    const row = data[y]!;
    for (let x = 0; x < width; x++) {
      const idx = charToIndex(row[x]!);
      if (idx === 0) continue; // transparent

      const color = palette[idx];
      if (!color || color === '⬛') continue; // skip transparent marker

      rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" width="${viewW}" height="${viewH}" shape-rendering="crispEdges">${rects}</svg>`;

  // URL-encode for data URI (only # and % need encoding in SVG)
  const encoded = svg.replace(/#/g, '%23');
  return `data:image/svg+xml,${encoded}`;
}

// ── Browser-compatible inline renderer ───────────────────────────────────

/**
 * Browser-only: same as renderPixelArtSVG but returns the raw SVG string
 * (not a data URI). Used when you need to inject SVG directly into DOM,
 * e.g., for html2canvas screenshots where data URIs in <img> may not render.
 */
export function renderPixelArtSVGRaw(pa: PixelArtSize, cellSize = 2): string {
  const data = pa.data;
  const palette = pa.palette;
  const height = data.length;
  const width = data[0]?.length ?? 0;

  const viewW = width * cellSize;
  const viewH = height * cellSize;

  let rects = '';

  for (let y = 0; y < height; y++) {
    const row = data[y]!;
    for (let x = 0; x < width; x++) {
      const idx = charToIndex(row[x]!);
      if (idx === 0) continue;
      const color = palette[idx];
      if (!color || color === '⬛') continue;
      rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" shape-rendering="crispEdges">${rects}</svg>`;
}

// ── Browser JS snippet (inlined in app.js) ──────────────────────────────

/**
 * Pure-JS rendering functions for the dashboard frontend.
 * These are intentionally self-contained (no dependencies) so they can
 * be inlined into app.js without pulling in the TS module system.
 *
 * Usage in app.js:
 *   const svg = PixelArtRenderer.toSVG(pixelArtData, cellSize);
 *   return `<img src="${svg}" ...>`;
 */
export const PixelArtBrowserJS = `
/* ═══ Pixel Art Renderer (browser) ═══ */
var PixelArtRenderer = (function() {
  function charToIndex(ch) { return parseInt(ch, 36); }

  function toDataURI(pa, cellSize) {
    cellSize = cellSize || 2;
    var data = pa.data, palette = pa.palette;
    var h = data.length, w = data[0] ? data[0].length : 0;
    var vw = w * cellSize, vh = h * cellSize;
    var rects = '';
    for (var y = 0; y < h; y++) {
      var row = data[y];
      for (var x = 0; x < w; x++) {
        var idx = charToIndex(row[x]);
        if (idx === 0) continue;
        var c = palette[idx];
        if (!c || c === '⬛') continue;
        rects += '<rect x="' + (x * cellSize) + '" y="' + (y * cellSize) + '" width="' + cellSize + '" height="' + cellSize + '" fill="' + c + '"/>';
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vw + ' ' + vh + '" width="' + vw + '" height="' + vh + '" shape-rendering="crispEdges">' + rects + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function toSVGRaw(pa, cellSize) {
    cellSize = cellSize || 2;
    var data = pa.data, palette = pa.palette;
    var h = data.length, w = data[0] ? data[0].length : 0;
    var vw = w * cellSize, vh = h * cellSize;
    var rects = '';
    for (var y = 0; y < h; y++) {
      var row = data[y];
      for (var x = 0; x < w; x++) {
        var idx = charToIndex(row[x]);
        if (idx === 0) continue;
        var c = palette[idx];
        if (!c || c === '⬛') continue;
        rects += '<rect x="' + (x * cellSize) + '" y="' + (y * cellSize) + '" width="' + cellSize + '" height="' + cellSize + '" fill="' + c + '"/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vw + ' ' + vh + '" shape-rendering="crispEdges">' + rects + '</svg>';
  }

  return { toDataURI: toDataURI, toSVGRaw: toSVGRaw };
})();
`;
