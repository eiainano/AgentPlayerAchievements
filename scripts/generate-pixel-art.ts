#!/usr/bin/env node
/**
 * AGPA Pixel Art Generator
 *
 * Reads docs/pixel-art-ideas.md and generates pixel art images via Gemini API
 * for each achievement.
 *
 * Usage:
 *   npx tsx scripts/generate-pixel-art.ts [options]
 *
 * Options:
 *   --ratio, -r <w:h>     Aspect ratio (default: "1:1")
 *                          Supported: 1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9,
 *                                    4:5, 5:4, 1:4, 4:1, 1:8, 8:1
 *   --ids <id1,id2,...>   Only generate for specific achievement IDs
 *   --category <name>     Only generate for a specific category
 *   --output, -o <dir>    Output directory (default: "pixel-art-output")
 *   --dry-run             Print prompts without calling API
 *   --limit, -n <n>       Max number of images to generate
 *   --help, -h            Show this help
 *
 * Note: GEMINI_API_KEY env var required. This script is NOT included in
 *       the open-source release — dev tool only.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────

const MODEL = 'gemini-3.1-flash-image';
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;

const VALID_RATIOS = new Set([
  '1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9',
  '4:5', '5:4', '1:4', '4:1', '1:8', '8:1',
]);

type CliArgs = {
  ratio: string;
  ids: string[] | null;
  category: string | null;
  outputDir: string;
  dryRun: boolean;
  limit: number;
  apiKey: string;
};

// ── Pixel art system prompt ──────────────────────────────────────────────

function systemPrompt(ratio: string): string {
  const aspect = ratio === '16:9' ? 'widescreen landscape (16:9)'
    : ratio === '9:16' ? 'tall portrait (9:16)'
    : ratio === '4:3' ? 'landscape (4:3)'
    : ratio === '3:2' ? 'landscape (3:2)'
    : ratio === '2:3' ? 'portrait (2:3)'
    : ratio === '3:4' ? 'portrait (3:4)'
    : ratio === '21:9' ? 'ultrawide cinematic (21:9)'
    : ratio === '3:1' ? 'widescreen landscape (3:1)'
    : ratio === '1:1' ? 'square (1:1)'
    : `${ratio}`;

  return `Create a pixel art image in ${aspect} aspect ratio.

CRITICAL STYLE RULES:
- TRUE PIXEL ART style: visible square pixels, limited color palette (10-32 colors max)
- NO anti-aliasing, NO smooth curves, NO gradients, NO photorealism
- Sharp blocky edges — like SNES / GBA era game sprites
- Dark outlines around main subjects (retro game art style)
- Simple background that doesn't compete with the foreground subject
- NO TEXT or labels in the image — unless the SCENE explicitly requires it
- Each pixel should be clearly visible`;
}

// ── CLI parsing ───────────────────────────────────────────────────────────

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  let ratio = '1:1';
  let ids: string[] | null = null;
  let category: string | null = null;
  let outputDir = path.join(PROJECT_ROOT, 'pixel-art-output');
  let dryRun = false;
  let limit = Infinity;
  let apiKey = process.env.GEMINI_API_KEY || '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--ratio':
      case '-r':
        ratio = args[++i]!;
        if (!VALID_RATIOS.has(ratio)) {
          console.error(`Invalid ratio: "${ratio}". Valid: ${[...VALID_RATIOS].join(', ')}`);
          process.exit(1);
        }
        break;
      case '--ids':
        ids = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
        break;
      case '--category':
        category = args[++i]!;
        break;
      case '--output':
      case '-o':
        outputDir = args[++i]!;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--limit':
      case '-n':
        limit = parseInt(args[++i]!, 10);
        if (isNaN(limit) || limit <= 0) {
          console.error(`Invalid limit: "${args[i]}"`);
          process.exit(1);
        }
        break;
      case '--key':
        apiKey = args[++i]!;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown flag: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!apiKey && !dryRun) {
    console.error('GEMINI_API_KEY env var not set. Use --key <key> or set the env var.');
    console.error('Or use --dry-run to test without API calls.');
    process.exit(1);
  }

  return { ratio, ids, category, outputDir, dryRun, limit, apiKey: apiKey || 'dry-run' };
}

function printHelp(): void {
  console.log(`AGPA Pixel Art Generator

Usage: npx tsx scripts/generate-pixel-art.ts [options]

Options:
  --ratio, -r <w:h>     Aspect ratio (default: "1:1")
  --ids <id1,id2,...>   Only generate for specific achievement IDs
  --category <name>     Only generate for a specific category
  --output, -o <dir>    Output directory (default: "pixel-art-output")
  --dry-run             Print prompts without calling API
  --limit, -n <n>       Max number of images to generate
  --key <key>           Gemini API key (or set GEMINI_API_KEY env var)
  --help, -h            Show this help`);

  console.log('\nGEMINI_API_KEY is required. Set via env var or --key flag.');
  console.log(`Valid ratios: ${[...VALID_RATIOS].join(', ')}`);
}

// ── Markdown table parser ─────────────────────────────────────────────────

interface AchievementEntry {
  id: string;
  nameCn: string;
  descCn: string;
  pixelArtDesc: string;
  category: string;
}

function parsePixelArtDoc(filePath: string): { category: string; entries: AchievementEntry[] }[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  const sections: { category: string; entries: AchievementEntry[] }[] = [];
  let currentCategory = '';
  let currentEntries: AchievementEntry[] = [];
  let inTable = false;

  for (const line of lines) {
    const catMatch = line.match(/^## (.+)/);
    if (catMatch) {
      if (currentEntries.length > 0) {
        sections.push({ category: currentCategory, entries: currentEntries });
      }
      currentCategory = catMatch[1]!.trim();
      currentEntries = [];
      inTable = false;
      continue;
    }

    if (line.startsWith('| ID |') || line.startsWith('|----|')) {
      inTable = true;
      continue;
    }

    if (inTable && line.startsWith('|') && !line.startsWith('| ID') && !line.startsWith('|----')) {
      const cells = line.split('|').map(s => s.trim()).filter(Boolean);
      if (cells.length >= 4) {
        currentEntries.push({
          id: cells[0]!,
          nameCn: cells[1]!,
          descCn: cells[2]!,
          pixelArtDesc: cells[3]!,
          category: currentCategory || 'All',
        });
      }
    }

    if (inTable && line.trim() === '') {
      inTable = false;
    }
  }

  if (currentEntries.length > 0) {
    sections.push({ category: currentCategory || 'All', entries: currentEntries });
  }

  return sections;
}

// ── Prompt builder ────────────────────────────────────────────────────────

function getRatioForCategory(category: string, defaultRatio: string): string {
  if (category.toLowerCase().includes('questline')) return '3:1';
  return defaultRatio;
}

function buildPrompt(entry: AchievementEntry, ratio: string): string {
  const actualRatio = getRatioForCategory(entry.category, ratio);
  return `${systemPrompt(actualRatio)}

SCENE: ${entry.pixelArtDesc}

The image should clearly communicate the concept at a glance.`;
}

// ── API call ───────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
    finishReason?: string;
  }>;
}

async function generateImage(prompt: string, apiKey: string): Promise<{ data: string; mimeType: string } | null> {
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
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json: GeminiResponse = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;

  if (!parts) {
    console.error('  ⚠️  No parts in response');
    return null;
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
    }
  }

  for (const part of parts) {
    if (part.text) {
      console.log(`  💬 Model said: ${part.text.slice(0, 200)}`);
    }
  }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  const docPath = path.join(PROJECT_ROOT, 'docs', 'pixel-art-ideas-a-z.md');
  if (!fs.existsSync(docPath)) {
    console.error(`Pixel art document not found: ${docPath}`);
    process.exit(1);
  }

  console.log('\n🖼️  AGPA Pixel Art Generator');
  console.log(`   Model: ${MODEL}  |  Ratio: ${args.ratio}`);
  if (args.dryRun) console.log('   DRY RUN — no API calls\n');

  const sections = parsePixelArtDoc(docPath);
  let allEntries: Array<{ entry: AchievementEntry; category: string }> = [];
  for (const sec of sections) {
    for (const e of sec.entries) {
      allEntries.push({ entry: e, category: sec.category });
    }
  }

  if (args.ids) {
    const idSet = new Set(args.ids);
    allEntries = allEntries.filter(e => idSet.has(e.entry.id));
    if (allEntries.length === 0) {
      console.error(`No achievements found for IDs: ${args.ids.join(', ')}`);
      process.exit(1);
    }
  }
  if (args.category) {
    const lc = args.category.toLowerCase();
    allEntries = allEntries.filter(e => e.category.toLowerCase().includes(lc));
    if (allEntries.length === 0) {
      console.error(`No achievements found in category: "${args.category}"`);
      console.error(`Available categories: ${[...new Set(
        sections.map(s => s.category.replace(/\（.*/, ''))
      )].join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`   Total: ${Math.min(allEntries.length, args.limit)}  |  Output: ${args.outputDir}\n`);

  fs.mkdirSync(args.outputDir, { recursive: true });

  let generated = 0;
  let errors = 0;

  for (let i = 0; i < allEntries.length && generated < args.limit; i++) {
    const { entry, category } = allEntries[i]!;
    const prompt = buildPrompt(entry, args.ratio);
    const safeId = entry.id.replace(/[^a-z0-9_-]/gi, '_');

    console.log(`[${i + 1}/${Math.min(allEntries.length, args.limit)}] ${entry.id} — ${entry.nameCn}`);
    console.log(`  Category: ${category}`);

    if (args.dryRun) {
      console.log(`  Prompt: ${prompt.length} chars → ${safeId}.png\n`);
      generated++;
      continue;
    }

    try {
      const result = await generateImage(prompt, args.apiKey);

      if (result) {
        const ext = result.mimeType === 'image/png' ? 'png' : 'jpg';
        const outPath = path.join(args.outputDir, `${safeId}.${ext}`);
        fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
        console.log(`  ✅ ${safeId}.${ext} (${(fs.statSync(outPath).size / 1024).toFixed(1)}KB)\n`);
        generated++;
      } else {
        console.log(`  ⚠️  No image\n`);
        errors++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`  ❌ ${msg}\n`);
      errors++;
    }

    if (!args.dryRun && i < allEntries.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`Generated: ${generated}  Errors: ${errors}  Output: ${args.outputDir}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
