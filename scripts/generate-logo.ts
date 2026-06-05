#!/usr/bin/env node
/**
 * AGPA Logo Pixel Art Generator
 * Uses Gemini 3.1 Flash Image to generate the AGPA logo.
 * Usage: npx tsx scripts/generate-logo.ts [--output <dir>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const MODEL = 'gemini-3.1-flash-image';
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;

const args = process.argv.slice(2);
let outputDir = path.join(PROJECT_ROOT, 'pixel-art-output');
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
    outputDir = args[++i]!;
  }
}

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

const PROMPT = `Create a 32x32 pixel art image in square (1:1) aspect ratio.

CRITICAL STYLE RULES:
- TRUE PIXEL ART style: visible square pixels, limited color palette (6 colors max)
- NO anti-aliasing, NO smooth curves, NO gradients, NO photorealism
- Sharp blocky edges — like SNES / GBA era game sprites
- Dark outlines around main subjects (retro game art style)
- Simple background that doesn't compete with the foreground subject
- NO TEXT or labels in the image
- Each pixel should be clearly visible

SCENE DESCRIPTION:
A top-down pixel art view of a PlayStation 4 DualShock 4 controller centered on a dark navy-blue background (#0a0e17). The controller has the signature streamlined silhouette — slightly narrower at the top, widening into two rounded grips at the bottom. Across the upper body sits a narrow horizontal touchpad bar in dark grey. The left area holds a recessed D-pad cross in light grey. The right area has four tiny colored face buttons in a diamond layout (pink square, green triangle, red circle, blue X). Below each button cluster, one small symmetrical analog stick nub in charcoal grey with a pale center dot.

OUTSIDE the controller frame, at the upper-left corner of the image, a single golden four-point star sparkles, representing an achievement unlocking.

Along the bottom edge, three faint rows of abstract terminal-prompt dashes in muted white, suggesting AI coding.

COLOR PALETTE (exactly 6 colors):
1. #0a0e17 dark navy — background
2. #2a2a38 charcoal grey — controller body + stick bases
3. #8a8a9a light grey — D-pad + touchpad edges
4. #e8c840 gold — four-point star + Circle button
5. #40c8e0 cyan — Cross button
6. #b0b0c0 muted white — terminal dashes + stick center dots

COMPOSITION:
- Controller occupies center ~80% of the frame
- Star is small (6-8 pixels), upper-left area
- Terminal dashes are 3 sparse rows at the very bottom
- No shadows, no gradients, no glow effects — pure pixel art`;

async function main() {
  console.log('🎮 Generating AGPA Logo pixel art...\n');

  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
  };

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`API error ${res.status}: ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  let foundImg = false;
  for (const part of parts) {
    if (part.text) {
      console.log('💬 Gemini:', part.text.slice(0, 300));
    }
    if (part.inlineData?.data) {
      const buf = Buffer.from(part.inlineData.data, 'base64');
      fs.mkdirSync(outputDir, { recursive: true });
      const outPath = path.join(outputDir, 'agpa-logo.png');
      fs.writeFileSync(outPath, buf);
      console.log(`✅ Logo saved → ${outPath}  (${buf.length} bytes)`);
      foundImg = true;
    }
  }

  if (!foundImg) {
    console.error('No image in response. Full response:');
    console.error(JSON.stringify(data, null, 2).slice(0, 500));
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
