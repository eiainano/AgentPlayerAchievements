#!/usr/bin/env node
/**
 * SVG → pixel_art YAML converter with auto-colorization
 *
 * Usage:
 *   node svg-to-pixelart.mjs <svg-path> [--theme <name>]
 *
 * Themes: fire, ocean, royal, nature, neon, cyber, sunset, mono
 * For multi-color source images, colorization is skipped.
 */

import sharp from 'sharp';
import * as fs from 'fs';

const WIDTH = 48;
const HEIGHT = 48;
const INDICES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ── Color Themes (5-color gradients: shadow → dark → base → light → highlight) ──

const THEMES = {
  fire:       ['#7f1d1d', '#b91c1c', '#ea580c', '#fbbf24', '#fef08a'],
  ocean:      ['#0c4a6e', '#0369a1', '#0ea5e9', '#7dd3fc', '#e0f2fe'],
  royal:      ['#312e81', '#4338ca', '#6366f1', '#a5b4fc', '#e0e7ff'],
  nature:     ['#14532d', '#15803d', '#22c55e', '#86efac', '#dcfce7'],
  neon:       ['#4a044e', '#86198f', '#d946ef', '#f0abfc', '#fdf4ff'],
  cyber:      ['#020617', '#1e3a5f', '#00e5ff', '#39ff14', '#ffffff'],
  sunset:     ['#4c1d95', '#be123c', '#f97316', '#fde047', '#fff7ed'],
  gold:       ['#78350f', '#92400e', '#d97706', '#fbbf24', '#fef3c7'],
  emerald:    ['#022c22', '#065f46', '#10b981', '#6ee7b7', '#d1fae5'],
  ruby:       ['#450a0a', '#991b1b', '#e11d48', '#fb7185', '#ffe4e6'],
  steel:      ['#1e293b', '#334155', '#64748b', '#94a3b8', '#f1f5f9'],
  amber:      ['#451a03', '#78350f', '#d97706', '#f59e0b', '#fef3c7'],
  mono:       ['#000000', '#1f1f1f', '#555555', '#aaaaaa', '#ffffff'],
};

// ── Colorization: 2D distance-based shading ──────────────────────────

function colorizeMask(mask, themeName) {
  const theme = THEMES[themeName] || THEMES.fire;
  const levels = theme.length; // 5 shades

  // Compute interior distance (distance from each filled pixel to nearest background)
  // This gives us depth: edge=0, center=max
  const dist = Array.from({ length: HEIGHT }, () => new Float64Array(WIDTH));
  const LARGE = 9999;

  // Initialize: background=0, filled=LARGE (we measure distance FROM background INTO shape)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      dist[y][x] = mask[y][x] ? LARGE : 0;
    }
  }

  // Two-pass Manhattan distance transform (propagates distances inward)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (x > 0) dist[y][x] = Math.min(dist[y][x], dist[y][x - 1] + 1);
      if (y > 0) dist[y][x] = Math.min(dist[y][x], dist[y - 1][x] + 1);
    }
  }
  for (let y = HEIGHT - 1; y >= 0; y--) {
    for (let x = WIDTH - 1; x >= 0; x--) {
      if (x < WIDTH - 1) dist[y][x] = Math.min(dist[y][x], dist[y][x + 1] + 1);
      if (y < HEIGHT - 1) dist[y][x] = Math.min(dist[y][x], dist[y + 1][x] + 1);
    }
  }

  // Find maximum interior depth (for normalizing)
  let maxDist = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (mask[y][x] && dist[y][x] < LARGE && dist[y][x] > maxDist) {
        maxDist = dist[y][x];
      }
    }
  }

  // Build colored pixel array
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      if (!mask[y][x]) {
        pixels[idx + 3] = 0; // transparent
        continue;
      }
      pixels[idx + 3] = 255;
      const d = dist[y][x];
      const t = maxDist > 1 ? d / maxDist : 0;
      // t=0 is edge (shadow), t=1 is center (highlight)
      const shadeLevel = Math.min(levels - 1, Math.floor(t * levels));
      const c = hexToRgb(theme[shadeLevel]);
      pixels[idx] = c.r;
      pixels[idx + 1] = c.g;
      pixels[idx + 2] = c.b;
    }
  }

  return pixels;
}

// ── Palette extraction from colored pixels ──────────────────────────

function quantizePixels(pixels) {
  const colorMap = new Map();
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const a = pixels[idx + 3];
      if (a < 128) continue;
      const key = `${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
  }

  const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]);
  const paletteColors = sorted.map(([key]) => key.split(',').map(Number));

  // Build palette (max 35 colors)
  const palette = [];
  const indexMap = new Map();
  for (let i = 0; i < Math.min(paletteColors.length, 35); i++) {
    const [r, g, b] = paletteColors[i];
    palette.push(rgbToHex(r, g, b));
    indexMap.set(`${r},${g},${b}`, INDICES[i + 1]);
  }

  // Build data rows
  const dataRows = [];
  for (let y = 0; y < HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const a = pixels[idx + 3];
      if (a < 128) {
        row += '0';
      } else {
        const key = `${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]}`;
        let code = indexMap.get(key);
        if (!code) {
          // Nearest match
          let minDist = Infinity, nearest = 1;
          for (let i = 0; i < paletteColors.length; i++) {
            const dr = pixels[idx] - paletteColors[i][0];
            const dg = pixels[idx+1] - paletteColors[i][1];
            const db = pixels[idx+2] - paletteColors[i][2];
            const d = dr*dr + dg*dg + db*db;
            if (d < minDist) { minDist = d; nearest = i + 1; }
          }
          code = INDICES[nearest];
        }
        row += code;
      }
    }
    dataRows.push(row);
  }

  return { palette, data: dataRows };
}

// ── Helpers ─────────────────────────────────────────────────────────

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

// ── Terminal Rendering ──────────────────────────────────────────────

function renderTerminal(palette, data) {
  const lines = [];
  for (let y = 0; y < data.length; y += 2) {
    let line = '';
    const upper = data[y];
    const lower = data[y + 1] || '0'.repeat(WIDTH);
    for (let x = 0; x < WIDTH; x++) {
      const uIdx = INDICES.indexOf(upper[x]);
      const lIdx = INDICES.indexOf(lower[x]);
      const uColor = uIdx > 0 ? palette[uIdx - 1] : null;
      const lColor = lIdx > 0 ? palette[lIdx - 1] : null;

      let char;
      if (uColor && lColor) {
        char = '█';
      } else if (uColor) {
        char = '▀';
      } else if (lColor) {
        char = '▄';
      } else {
        char = ' ';
        line += char;
        continue;
      }

      const uRgb = hexToRgb(uColor);
      const lRgb = hexToRgb(lColor || '#000000');
      line += `\x1b[38;2;${uRgb.r};${uRgb.g};${uRgb.b}m\x1b[48;2;${lRgb.r};${lRgb.g};${lRgb.b}m${char}\x1b[0m`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function renderTerminalRaw(palette, data) {
  // Render without ANSI escape codes for terminal with true color support
  return renderTerminal(palette, data);
}

// ── YAML Output ─────────────────────────────────────────────────────

function toYAML(palette, data) {
  const codes = palette.map((c, i) => {
    const idx = INDICES[i + 1];
    return `      - "${c}"                              # index ${idx}`;
  }).join('\n');

  const rows = data.map(r => `      - "${r}"`).join('\n');

  return `  pixel_art:
    width: ${WIDTH}
    palette:
      - "⬛"                              # index 0: transparent
${codes}
    data:
${rows}`;
}

// ── SVG Processing ──────────────────────────────────────────────────

async function getSVGBuffer(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  }
  return fs.readFileSync(source);
}

async function renderMask(svgBuffer) {
  // Render to raw grayscale at 48×48
  const { data } = await sharp(svgBuffer)
    .resize(WIDTH, HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build mask: true for any pixel with alpha > 128
  const mask = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(false));
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      mask[y][x] = data[idx + 3] > 128;
    }
  }
  return mask;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node svg-to-pixelart.mjs <svg-path> [--theme <name>]');
    console.error('Themes: ' + Object.keys(THEMES).join(', '));
    process.exit(1);
  }

  const source = args[0];
  const themeIdx = args.indexOf('--theme');
  const theme = themeIdx >= 0 && themeIdx < args.length - 1 ? args[themeIdx + 1] : 'fire';
  const pngFlag = args.includes('--png');

  const svgBuffer = await getSVGBuffer(source);
  const mask = await renderMask(svgBuffer);

  // Check if SVG already has multiple colors by rendering at high quality
  let hasColor = false;
  try {
    const { data: hiData } = await sharp(svgBuffer)
      .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const colors = new Set();
    for (let i = 0; i < hiData.length; i += 4) {
      const r = hiData[i], g = hiData[i+1], b = hiData[i+2], a = hiData[i+3];
      if (a > 128) colors.add(`${r},${g},${b}`);
    }
    hasColor = colors.size > 2; // more than black + white = has color
  } catch {}

  let pixels, palette, pixelData;

  if (hasColor) {
    // Source already has colors — render and quantize directly
    const { data } = await sharp(svgBuffer)
      .resize(WIDTH, HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    pixels = new Uint8Array(data);
    ({ palette, data: pixelData } = quantizePixels(pixels));
  } else {
    // Monochrome SVG — colorize with theme
    pixels = colorizeMask(mask, theme);
    ({ palette, data: pixelData } = quantizePixels(pixels));
  }

  console.log('\n── Terminal Preview ──\n');
  console.log(renderTerminal(palette, pixelData));
  console.log('\n── YAML ──\n');
  console.log(toYAML(palette, pixelData));
  console.log(`\nPalette: ${palette.length} colors (+ 1 transparent)  Theme: ${hasColor ? 'source (native)' : theme}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
