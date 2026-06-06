#!/usr/bin/env node
/**
 * AGPA Logo Pixel Art Generator v3
 * Generates dark and light theme 128×128 pixel art logos.
 *
 * Composition: Screen (top) with LARGE >_ + think cloud filling it,
 *              cable (middle), DS4 controller (bottom).
 *              Two versions: dark navy bg and white bg.
 *
 * Usage: npx tsx scripts/generate-logo.ts [--output <dir>] [--skip-light]
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
let skipLight = false;
let skipDark = false;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
    outputDir = args[++i]!;
  }
  if (args[i] === '--skip-light') skipLight = true;
  if (args[i] === '--skip-dark') skipDark = true;
}

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

function buildPrompt(theme: 'dark' | 'light'): string {
  const screenBg = theme === 'dark' ? '#0a0e17 dark navy' : '#ffffff white';
  const screenFrame = theme === 'dark' ? '#8a8a9a light grey' : '#707080 medium grey';
  const controllerBody = theme === 'dark' ? '#2a2a38 charcoal grey' : '#f0f0f0 off-white';
  const controllerAccent = theme === 'dark' ? '#8a8a9a light grey' : '#707080 medium grey';
  const cableColor = theme === 'dark' ? '#2a2a38 charcoal grey' : '#707080 medium grey';

  const palette = theme === 'dark'
    ? `1. #0a0e17 dark navy — background
2. #2a2a38 charcoal grey — controller body, stick bases, cable
3. #8a8a9a light grey — D-pad, touchpad, screen border
4. #b0b0c0 muted white — stick dots, minor details
5. #c0d0e8 blue-white — think cloud
6. #40c840 green — ">_" prompt, triangle △ button
7. #c84040 red — circle ○ button
8. #4080c8 blue — cross ✕ button
9. #d0a0c0 pink — square □ button
10. #e8c840 gold — PS button`
    : `1. #ffffff white — background + screen interior + controller body
2. #707080 medium grey — D-pad, touchpad, screen border, cable
3. #c0c0d0 light grey — subtle controller body shading/details
4. #202030 near-black — stick dots, outlines, details
5. #c0d0e8 blue-white — think cloud
6. #40c840 green — ">_" prompt, triangle △ button
7. #c84040 red — circle ○ button
8. #4080c8 blue — cross ✕ button
9. #d0a0c0 pink — square □ button
10. #e8c840 gold — PS button`;

  return `Create a 128x128 pixel art image in square (1:1) aspect ratio.

ABSOLUTE FOREGROUND RULE — THIS IS THE MOST CRITICAL INSTRUCTION:
The ENTIRE canvas background must be a SINGLE SOLID COLOR: ${screenBg}.
Every pixel that is NOT part of the screen frame, ">_", think cloud, cable, or controller MUST be ${screenBg}.
There is NO white background anywhere in the image — the controller sits on the same ${screenBg} background as the screen interior.
The controller body is ${controllerBody}, which should be clearly distinguishable from the ${screenBg} background behind it.
DO NOT fill the area behind or around the controller with white or any other color — it must be ${screenBg}.

CRITICAL STYLE RULES:
- TRUE PIXEL ART style: visible square pixels, limited palette (8-10 colors max)
- NO anti-aliasing, NO smooth curves, NO gradients, NO photorealism
- Sharp blocky edges — like SNES / GBA era game sprites
- Dark outlines around main subjects (retro game art style)
- NO text or labels besides the specific ">_" mentioned
- Each pixel clearly visible at 128x128
- The BACKGROUND BEHIND AND AROUND EVERYTHING is ONE uniform color: ${screenBg}

SCENE (top-to-bottom, exact proportions):

=== TOP ~42% — display screen (smaller than the controller) ===
A large screen/display panel with thin rectangular border frame (${screenFrame}, 1-2px wide) occupying the upper ~42% of the canvas. Screen interior background: ${screenBg}.

Inside the screen, ONLY TWO elements — roughly equal in height and size, creating a balanced visual dialogue.

[1] ">_" PROMPT (left side):
A bold green (#40c840) terminal ">_" symbol positioned in the left half of the screen. The ">" should be thick and prominent, about 22-28px wide and 24-28px tall. The underscore "_" is a thick horizontal bar immediately after it. Together the symbol occupies roughly 1/3 of the screen width and about half the screen height — DOMINANT but not overwhelming.

[2] THINK CLOUD (right side, matching height):
A fluffy pixel-art thought bubble in blue-white (#c0d0e8) on the right half of the screen. The cloud should be approximately 32×28 px (width×height) — matching the height of the ">_" symbol so they feel like a balanced pair. It has rounded lumpy cartoon edges and a small triangular pointer tail at its bottom-left pointing toward the ">_", creating the impression the cloud is responding to the prompt.

The ">_" and think cloud should have SIMILAR HEIGHT (within 2-4px of each other) so they feel like two halves of a conversation. Minimal gap between them. They occupy almost all the screen area.

=== MIDDLE ~7% — Cable ===
A single straight vertical cable (${cableColor}, 2-3px wide) dropping from the exact bottom-center edge of the screen frame down to the top-center of the controller.

=== BOTTOM ~51% — DS4 Controller (top-down view, larger than screen) ===
A PlayStation 4 DualShock 4 controller viewed from directly above. Controller body: ${controllerBody}.

Shape: Narrower at top center where cable attaches, widening into two rounded symmetrical grips at left and right bottom. The grips extend wider than the screen above.

Details (top to bottom):
- Touchpad: narrow horizontal bar across upper body, ${controllerAccent}
- D-pad (left): cross-shaped directional pad, ${controllerAccent}, clear up/down/left/right arrows
- Face buttons (right): diamond layout of four colored buttons:
  Top=Triangle(#40c840 green) Right=Circle(#c84040 red) Bottom=Cross(#4080c8 blue) Left=Square(#d0a0c0 pink)
- Analog sticks: two small symmetrical circular nubs below D-pad and buttons, pale center dots
- PS button: tiny gold (#e8c840) circle centered between D-pad and face buttons
- All elements have dark pixel-art outlines

COLOR PALETTE:
${palette}

The metaphor: ">" prompt and think cloud dominate the screen (the conversation between you and AI), connected via cable to a game controller below (the achievement system you play while coding).`;
}

async function generateImage(prompt: string, filename: string): Promise<void> {
  console.log(`  Generating ${filename}...`);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
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
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.text) {
      console.log(`  💬 Gemini:`, part.text.slice(0, 300));
    }
    if (part.inlineData?.data) {
      const buf = Buffer.from(part.inlineData.data, 'base64');
      fs.mkdirSync(outputDir, { recursive: true });
      const outPath = path.join(outputDir, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`  ✅ Saved → ${outPath}  (${buf.length} bytes)`);
      return;
    }
  }

  console.error('No image in response. Full response:');
  console.error(JSON.stringify(data, null, 2).slice(0, 500));
}

async function main() {
  console.log('🎮 AGPA Logo Pixel Art Generator v3\n');

  if (!skipDark) {
    const darkPrompt = buildPrompt('dark');
    await generateImage(darkPrompt, 'agpa-logo-dark.png');
  }

  if (!skipLight) {
    const lightPrompt = buildPrompt('light');
    await generateImage(lightPrompt, 'agpa-logo-light.png');
  }

  console.log('\n✅ Done! Both logos generated in:', outputDir);
}

main().catch(err => { console.error(err); process.exit(1); });
