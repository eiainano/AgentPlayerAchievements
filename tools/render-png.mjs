#!/usr/bin/env node
/**
 * Render pixel_art YAML data to a PNG image for visual inspection.
 * Each pixel is rendered as a 10×10 block for visibility.
 */

import sharp from 'sharp';
import * as fs from 'fs';

const SCALE = 10; // each pixel = 10×10 in the output PNG

const INDICES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

async function renderPixelArt(svgPath, theme, outputPath) {
  // Import and run the converter
  const { default: sharp_ } = await import('sharp');

  const svgBuffer = fs.readFileSync(svgPath);

  // Get mask
  const { data } = await sharp_(svgBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = 48, H = 48;
  const mask = Array.from({ length: H }, () => new Array(W).fill(false));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      mask[y][x] = data[(y * W + x) * 4 + 3] > 128;
    }
  }

  // Distance transform
  const colorTheme = getTheme(theme);
  const dist = Array.from({ length: H }, () => new Float64Array(W));
  const LARGE = 9999;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      dist[y][x] = mask[y][x] ? LARGE : 0;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x > 0) dist[y][x] = Math.min(dist[y][x], dist[y][x-1] + 1);
      if (y > 0) dist[y][x] = Math.min(dist[y][x], dist[y-1][x] + 1);
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      if (x < W - 1) dist[y][x] = Math.min(dist[y][x], dist[y][x+1] + 1);
      if (y < H - 1) dist[y][x] = Math.min(dist[y][x], dist[y+1][x] + 1);
    }
  }
  let maxDist = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y][x] && dist[y][x] < LARGE && dist[y][x] > maxDist) maxDist = dist[y][x];
    }
  }

  // Build scaled-up RGBA buffer
  const sz = W * SCALE;
  const rgba = Buffer.alloc(sz * sz * 4, 0);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r, g, b, a;
      if (!mask[y][x]) {
        a = 0; r = g = b = 0;
      } else {
        a = 255;
        const d = dist[y][x];
        const t = maxDist > 1 ? d / maxDist : 0;
        const sl = Math.min(colorTheme.length - 1, Math.floor(t * colorTheme.length));
        const c = hexToRgb(colorTheme[sl]);
        r = c.r; g = c.g; b = c.b;
      }

      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const pi = ((y * SCALE + dy) * sz + (x * SCALE + dx)) * 4;
          rgba[pi] = r;
          rgba[pi + 1] = g;
          rgba[pi + 2] = b;
          rgba[pi + 3] = a;
        }
      }
    }
  }

  // Render to PNG
  await sharp_(rgba, { raw: { width: sz, height: sz, channels: 4 } })
    .png()
    .toFile(outputPath);

  console.log(`Rendered: ${outputPath} (${sz}×${sz}px)`);
}

function getTheme(name) {
  const themes = {
    ocean:  ['#0c4a6e', '#0369a1', '#0ea5e9', '#7dd3fc', '#e0f2fe'],
    fire:   ['#7f1d1d', '#b91c1c', '#ea580c', '#fbbf24', '#fef08a'],
    gold:   ['#78350f', '#92400e', '#d97706', '#fbbf24', '#fef3c7'],
    neon:   ['#4a044e', '#86198f', '#d946ef', '#f0abfc', '#fdf4ff'],
    nature: ['#14532d', '#15803d', '#22c55e', '#86efac', '#dcfce7'],
  };
  return themes[name] || themes.ocean;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node render-png.mjs <svg-path> [--theme T] [--output path.png]');
    process.exit(1);
  }

  const svgPath = args[0];
  const themeIdx = args.indexOf('--theme');
  const theme = themeIdx >= 0 && themeIdx < args.length - 1 ? args[themeIdx + 1] : 'ocean';
  const outIdx = args.indexOf('--output');
  const outBase = outIdx >= 0 && outIdx < args.length - 1 ? args[outIdx + 1] : null;

  const name = svgPath.split('/').pop().replace('-bold.svg', '').replace('.svg', '');
  const outPath = outBase || `/tmp/pixelart-${name}-${theme}.png`;

  await renderPixelArt(svgPath, theme, outPath);
}

main().catch(e => { console.error(e.message); process.exit(1); });
