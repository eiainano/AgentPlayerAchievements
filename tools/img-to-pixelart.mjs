#!/usr/bin/env node
/**
 * Image → pixel_art YAML converter (SVG + PNG input)
 *
 * Converts any image (SVG, PNG, JPEG, etc.) to pixel art stored in YAML.
 * For monochrome SVGs, applies auto-colorization via distance transform.
 *
 * Usage:
 *   node img-to-pixelart.mjs <image-path> [--theme T] [--sizes 48,128,256]
 *
 * Themes: fire ocean gold neon nature royal cyber sunset emerald ruby steel
 * Sizes:  comma-separated list of pixel sizes (default: 48,128,256)
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const INDICES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_PALETTE = 35; // 0-9 + A-Z = 36 total, index 0 = transparent
const BADGE_W = 48;
const BADGE_H = 24;

const THEMES = {
  fire:    ['#7f1d1d','#b91c1c','#ea580c','#fbbf24','#fef08a'],
  ocean:   ['#0c4a6e','#0369a1','#0ea5e9','#7dd3fc','#e0f2fe'],
  gold:    ['#78350f','#92400e','#d97706','#fbbf24','#fef3c7'],
  neon:    ['#4a044e','#86198f','#d946ef','#f0abfc','#fdf4ff'],
  nature:  ['#14532d','#15803d','#22c55e','#86efac','#dcfce7'],
  royal:   ['#312e81','#4338ca','#6366f1','#a5b4fc','#e0e7ff'],
  cyber:   ['#020617','#1e3a5f','#00e5ff','#39ff14','#ffffff'],
  sunset:  ['#4c1d95','#be123c','#f97316','#fde047','#fff7ed'],
  emerald: ['#022c22','#065f46','#10b981','#6ee7b7','#d1fae5'],
  ruby:    ['#450a0a','#991b1b','#e11d48','#fb7185','#ffe4e6'],
  steel:   ['#1e293b','#334155','#64748b','#94a3b8','#f1f5f9'],
  amber:   ['#451a03','#78350f','#d97706','#f59e0b','#fef3c7'],
};

function hexToRgb(h) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m ? { r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16) } : { r:0,g:0,b:0 };
}

function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(c=>Math.round(c).toString(16).padStart(2,'0')).join('');
}

// ── Load image buffer ───────────────────────────────────────────────

async function loadImage(source) {
  if (/^https?:\/\//.test(source)) {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return Buffer.from(await resp.arrayBuffer());
  }
  return fs.readFileSync(source);
}

// ── Detect if image is monochrome (for SVG colorization) ────────────

async function isMonochrome(buffer) {
  try {
    const { data } = await sharp(buffer)
      .resize(16, 16, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] > 128) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
    }
    return colors.size <= 2;
  } catch { return false; }
}

// ── Colorize monochrome mask ────────────────────────────────────────

function colorize(mask, width, height, themeColors) {
  const levels = themeColors.length;
  const dist = Array.from({length:height}, () => new Float64Array(width));
  const LARGE = 9999;

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      dist[y][x] = mask[y][x] ? LARGE : 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x > 0) dist[y][x] = Math.min(dist[y][x], dist[y][x-1] + 1);
      if (y > 0) dist[y][x] = Math.min(dist[y][x], dist[y-1][x] + 1);
    }
  }
  for (let y = height-1; y >= 0; y--) {
    for (let x = width-1; x >= 0; x--) {
      if (x < width-1) dist[y][x] = Math.min(dist[y][x], dist[y][x+1] + 1);
      if (y < height-1) dist[y][x] = Math.min(dist[y][x], dist[y+1][x] + 1);
    }
  }

  let maxDist = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mask[y][x] && dist[y][x] < LARGE && dist[y][x] > maxDist) maxDist = dist[y][x];

  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (!mask[y][x]) { pixels[idx+3] = 0; continue; }
      pixels[idx+3] = 255;
      const t = maxDist > 1 ? dist[y][x] / maxDist : 0;
      const sl = Math.min(levels - 1, Math.floor(t * levels));
      const c = hexToRgb(themeColors[sl]);
      pixels[idx] = c.r; pixels[idx+1] = c.g; pixels[idx+2] = c.b;
    }
  }
  return pixels;
}

// ── Quantize RGBA pixels to palette + data rows ─────────────────────

function quantize(pixels, width, height) {
  const colorMap = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx+3] < 128) continue;
      const k = `${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]}`;
      colorMap.set(k, (colorMap.get(k)||0)+1);
    }
  }

  const sorted = [...colorMap.entries()].sort((a,b) => b[1] - a[1]);
  const palColors = sorted.slice(0, MAX_PALETTE).map(e => e[0].split(',').map(Number));
  const indexMap = new Map();
  const palette = palColors.map(([r,g,b], i) => {
    indexMap.set(`${r},${g},${b}`, INDICES[i+1]);
    return rgbToHex(r,g,b);
  });

  const data = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx+3] < 128) { row += '0'; continue; }
      const k = `${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]}`;
      let c = indexMap.get(k);
      if (!c) {
        let md = Infinity, mi = 1;
        for (let i = 0; i < palColors.length; i++) {
          const d = (pixels[idx]-palColors[i][0])**2 + (pixels[idx+1]-palColors[i][1])**2 + (pixels[idx+2]-palColors[i][2])**2;
          if (d < md) { md = d; mi = i+1; }
        }
        c = INDICES[mi];
      }
      row += c;
    }
    data.push(row);
  }

  return { palette, data };
}

// ── Process image at a given (width × height) ──────────────────────

async function processSize(buffer, w, h, isMono, themeColors) {

  if (isMono && themeColors) {
    // For monochrome: render grayscale mask, then colorize
    const { data } = await sharp(buffer)
      .resize(w, h, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const mask = Array.from({length:h}, () => new Array(w).fill(false));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        mask[y][x] = data[(y*w+x)*4+3] > 128;

    const pixels = colorize(mask, w, h, themeColors);
    return quantize(pixels, w, h);
  } else {
    // For color images: direct render and quantize
    const { data } = await sharp(buffer)
      .resize(w, h, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return quantize(new Uint8Array(data), w, h);
  }
}

// ── Terminal rendering (uses 48×48 data) ────────────────────────────

function renderTerminal(palette, data) {
  const width = data[0].length;
  const lines = [];
  for (let y = 0; y < data.length; y += 2) {
    let line = '';
    const u = data[y], l = data[y+1] || '0'.repeat(width);
    for (let x = 0; x < width; x++) {
      const ui = INDICES.indexOf(u[x]), li = INDICES.indexOf(l[x]);
      const uc = ui > 0 ? palette[ui-1] : null;
      const lc = li > 0 ? palette[li-1] : null;
      let ch;
      if (uc && lc) ch = '█';
      else if (uc) ch = '▀';
      else if (lc) ch = '▄';
      else { line += ' '; continue; }
      const ur = hexToRgb(uc||'#000'), lr = hexToRgb(lc||'#000');
      line += `\x1b[38;2;${ur.r};${ur.g};${ur.b}m\x1b[48;2;${lr.r};${lr.g};${lr.b}m${ch}\x1b[0m`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ── YAML output ─────────────────────────────────────────────────────

function sectionToYAML(size, { palette, data }, indent) {
  const pfx = ' '.repeat(indent);
  const paletteYaml = palette.map((c, i) => `${pfx}- "${c}"`).join('\n');
  const dataYaml = data.map(r => `${pfx}- "${r}"`).join('\n');

  const hexCodes = palette.map((c, i) => {
    return `      - "${c}"                              # index ${INDICES[i+1]}`;
  }).join('\n');

  const rows = data.map(r => `      - "${r}"`).join('\n');

  return `  pixel_art:
    48:
      palette:
        - "⬛"                              # index 0: transparent
${hexCodes}
      data:
${rows}`;
}

function badgeToYAML({ palette, data }, indent) {
  const pfx = ' '.repeat(indent);
  const paletteYaml = palette.map((c, i) => `${pfx}  - "${c}"`).join('\n');
  const dataYaml = data.map(r => `${pfx}  - "${r}"`).join('\n');
  return (
`${pfx}pixel_art:
${pfx}  palette:
${pfx}    - "⬛"                              # index 0: transparent
${paletteYaml}
${pfx}  data:
${dataYaml}`
  );
}

function multiToYAML(results) {
  // results = { 48: {palette, data}, 128: {...}, 256: {...} }
  const sizes = Object.keys(results).sort((a,b) => Number(a)-Number(b));
  let out = '  pixel_art:\n';

  for (const size of sizes) {
    const { palette, data } = results[size];
    const hexCodes = palette.map((c, i) => {
      return `        - "${c}"                              # index ${INDICES[i+1]}`;
    }).join('\n');
    const rows = data.map(r => `        - "${r}"`).join('\n');

    out += `    ${size}:\n`;
    out += `      palette:\n`;
    out += `        - "⬛"                              # index 0: transparent\n`;
    out += hexCodes + '\n';
    out += `      data:\n`;
    out += rows + '\n';
  }
  return out.trimEnd();
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node img-to-pixelart.mjs <image-path> [options]');
    console.error('Options:');
    console.error('  --theme T     Color theme for monochrome SVGs (default: fire)');
    console.error('  --sizes S     Comma-separated square resolutions (default: 48,128,256)');
    console.error('  --badge       Generate 48×24 badge pixel art (flat format for sets)');
    console.error(`  Themes: ${Object.keys(THEMES).join(', ')}`);
    process.exit(1);
  }

  const isBadge = args.includes('--badge');
  const source = args[0];
  const themeIdx = args.indexOf('--theme');
  const themeName = themeIdx >= 0 && themeIdx < args.length-1 ? args[themeIdx+1] : 'fire';

  const input = await loadImage(source);
  const ext = path.extname(source).toLowerCase();
  const isSVG = ext === '.svg';
  const mono = isSVG ? await isMonochrome(input) : false;
  const theme = mono ? (THEMES[themeName] || THEMES.fire) : null;

  if (isBadge) {
    console.error(`Input: ${path.basename(source)}  Type: ${isSVG ? 'SVG' : 'Image'}  ${mono ? `(monochrome → theme: ${themeName})` : '(color)'}`);
    console.error(`Output: ${BADGE_W}×${BADGE_H} badge pixel art`);

    const result = await processSize(input, BADGE_W, BADGE_H, mono, theme);
    console.error(`  Colors: ${result.palette.length}`);

    console.log(`\n── Terminal Preview (${BADGE_W}×${BADGE_H}) ──\n`);
    console.log(renderTerminal(result.palette, result.data));

    console.log('\n── Badge YAML (copy into set definition) ──\n');
    console.log(badgeToYAML(result, 4));
    console.log(`\n# 48×24 badge · ${mono ? themeName : 'native colors'}`);
    return;
  }

  const sizesIdx = args.indexOf('--sizes');
  const sizes = sizesIdx >= 0 && sizesIdx < args.length-1
    ? args[sizesIdx+1].split(',').map(Number)
    : [48, 128, 256];

  console.error(`Input: ${path.basename(source)}  Type: ${isSVG ? 'SVG' : 'Image'}  ${mono ? `(monochrome → theme: ${themeName})` : '(color — direct quantization)'}`);
  console.error(`Output sizes: ${sizes.join(', ')}`);

  const results = {};
  for (const size of sizes) {
    results[size] = await processSize(input, size, size, mono, theme);
    console.error(`  ${size}×${size}: ${results[size].palette.length} colors`);
  }

  if (results[48]) {
    console.log('\n── Terminal Preview (48×48) ──\n');
    console.log(renderTerminal(results[48].palette, results[48].data));
  } else {
    const smallest = Math.min(...sizes);
    console.log(`\n── Terminal Preview (${smallest}×${smallest}) ──\n`);
    console.log(renderTerminal(results[smallest].palette, results[smallest].data));
  }

  console.log('\n── YAML (multi-resolution) ──\n');
  console.log(multiToYAML(results));
  console.log(`\n# ${Object.keys(results).length} resolutions · ${mono ? themeName : 'native colors'}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
