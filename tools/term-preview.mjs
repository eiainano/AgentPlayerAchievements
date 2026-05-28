#!/usr/bin/env node
/**
 * 在终端中预览 pixel art（48×48 → 24 行 Unicode 半块字符）
 *
 * 用法:
 *   node term-preview.mjs <svg路径> [--theme 主题名]
 *
 * 主题: fire, ocean, gold, neon, nature, royal, cyber, sunset
 */

import sharp from 'sharp';
import * as fs from 'fs';

const INDICES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const THEMES = {
  fire:    ['#7f1d1d','#b91c1c','#ea580c','#fbbf24','#fef08a'],
  ocean:   ['#0c4a6e','#0369a1','#0ea5e9','#7dd3fc','#e0f2fe'],
  gold:    ['#78350f','#92400e','#d97706','#fbbf24','#fef3c7'],
  neon:    ['#4a044e','#86198f','#d946ef','#f0abfc','#fdf4ff'],
  nature:  ['#14532d','#15803d','#22c55e','#86efac','#dcfce7'],
  royal:   ['#312e81','#4338ca','#6366f1','#a5b4fc','#e0e7ff'],
  cyber:   ['#020617','#1e3a5f','#00e5ff','#39ff14','#ffffff'],
  sunset:  ['#4c1d95','#be123c','#f97316','#fde047','#fff7ed'],
};

const W = 48, H = 48;

function hexToRgb(h) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : { r:0, g:0, b:0 };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const ts = Object.keys(THEMES).join(', ');
    console.error(`用法: node term-preview.mjs <svg路径> [--theme 主题]\n主题: ${ts}`);
    process.exit(1);
  }

  const svg = args[0];
  const ti = args.indexOf('--theme');
  const theme = (ti >= 0 && ti < args.length - 1) ? args[ti + 1] : 'fire';
  const palette = THEMES[theme] || THEMES.fire;

  let buf;
  if (svg.startsWith('http')) {
    const r = await fetch(svg);
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    buf = fs.readFileSync(svg);
  }

  // Render mask
  const { data } = await sharp(buf)
    .resize(W, H, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = Array.from({length:H}, () => new Array(W).fill(false));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      mask[y][x] = data[(y*W+x)*4+3] > 128;

  // Distance transform
  const dist = Array.from({length:H}, () => new Float64Array(W));
  const LARGE = 9999;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      dist[y][x] = mask[y][x] ? LARGE : 0;
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { if (x>0) dist[y][x] = Math.min(dist[y][x], dist[y][x-1]+1); if (y>0) dist[y][x] = Math.min(dist[y][x], dist[y-1][x]+1); } }
  for (let y = H-1; y >= 0; y--) { for (let x = W-1; x >= 0; x--) { if (x<W-1) dist[y][x] = Math.min(dist[y][x], dist[y][x+1]+1); if (y<H-1) dist[y][x] = Math.min(dist[y][x], dist[y+1][x]+1); } }
  let maxDist = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x] && dist[y][x] < LARGE && dist[y][x] > maxDist) maxDist = dist[y][x];

  // Build colored pixel data
  const pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (!mask[y][x]) { pixels[idx+3] = 0; continue; }
      pixels[idx+3] = 255;
      const t = maxDist > 1 ? dist[y][x] / maxDist : 0;
      const sl = Math.min(palette.length-1, Math.floor(t * palette.length));
      const c = hexToRgb(palette[sl]);
      pixels[idx] = c.r; pixels[idx+1] = c.g; pixels[idx+2] = c.b;
    }
  }

  // Quantize colors
  const colorMap = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = (y*W+x)*4;
    if (pixels[idx+3] < 128) continue;
    const k = `${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]}`;
    colorMap.set(k, (colorMap.get(k)||0)+1);
  }
  const sorted = [...colorMap.entries()].sort((a,b)=>b[1]-a[1]);
  const pals = sorted.map(e=>e[0].split(',').map(Number));
  const pMap = new Map();
  pals.forEach(([r,g,b],i) => pMap.set(`${r},${g},${b}`, i+1));

  // Build data rows
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const idx = (y*W+x)*4;
      if (pixels[idx+3] < 128) { row += '0'; continue; }
      const k = `${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]}`;
      let c = pMap.get(k);
      if (!c) {
        let md = Infinity, mi = 1;
        for (let i = 0; i < pals.length; i++) {
          const d = (pixels[idx]-pals[i][0])**2 + (pixels[idx+1]-pals[i][1])**2 + (pixels[idx+2]-pals[i][2])**2;
          if (d < md) { md = d; mi = i+1; }
        }
        c = mi;
      }
      row += INDICES[c];
    }
    rows.push(row);
  }

  // Terminal rendering (Unicode half-blocks)
  const out = [];
  for (let y = 0; y < rows.length; y += 2) {
    let line = '';
    const u = rows[y], l = rows[y+1] || '0'.repeat(W);
    for (let x = 0; x < W; x++) {
      const ui = INDICES.indexOf(u[x]), li = INDICES.indexOf(l[x]);
      const uc = ui>0 ? pals[ui-1] : null;
      const lc = li>0 ? pals[li-1] : null;

      let ch;
      if (uc && lc) ch = '█';
      else if (uc) ch = '▀';
      else if (lc) ch = '▄';
      else { line += ' '; continue; }

      const ur = uc||[0,0,0], lr = lc||[0,0,0];
      line += `\x1b[38;2;${ur[0]};${ur[1]};${ur[2]}m\x1b[48;2;${lr[0]};${lr[1]};${lr[2]}m${ch}\x1b[0m`;
    }
    out.push(line);
  }

  console.log(`\n  Pixel Art · ${theme} theme · ${pals.length} colors (+ transparent)\n`);
  console.log(out.join('\n'));
  console.log();
}

main().catch(e => { console.error(e.message); process.exit(1); });
