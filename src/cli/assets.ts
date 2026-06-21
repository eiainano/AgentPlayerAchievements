#!/usr/bin/env node
/**
 * AGPA Assets — download pixel-art badges and other assets
 *
 * Usage:
 *   agpa assets download    Download all pixel-art images from GitHub
 *   agpa assets status      Show which assets are present/missing
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIXEL_ART_DIR = path.resolve(__dirname, '../dashboard/public/pixel-art');

const OWNER = 'eiainano';
const REPO = 'AgentPlayerAchievements';
const PIXEL_ART_REPO_PATH = 'src/dashboard/public/pixel-art';
const GITHUB_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PIXEL_ART_REPO_PATH}`;
const GITHUB_RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${PIXEL_ART_REPO_PATH}`;

function httpGetJson(url: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'agpa-cli' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} — ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpGetBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} — ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function download(): Promise<void> {
  console.log('🔍 Fetching file list from GitHub...');

  let files: unknown[];
  try {
    files = (await httpGetJson(GITHUB_API)) as unknown[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed to list pixel-art files: ${msg}`);
    process.exit(1);
  }

  const imageFiles = (files as Array<{ name: string; download_url: string; type: string }>)
    .filter(f => f.type === 'file' && /\.(jpg|png)$/i.test(f.name));

  if (imageFiles.length === 0) {
    console.error('❌ No pixel-art images found on GitHub');
    process.exit(1);
  }

  console.log(`📦 Found ${imageFiles.length} images — downloading...\n`);

  fs.mkdirSync(PIXEL_ART_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of imageFiles) {
    const filePath = path.join(PIXEL_ART_DIR, file.name);

    // Skip if already exists and non-empty
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 0) {
        skipped++;
        continue;
      }
    } catch { /* doesn't exist — download */ }

    process.stdout.write(`  ⬇️  ${file.name}... `);
    try {
      const buf = await httpGetBuffer(file.download_url);
      fs.writeFileSync(filePath, buf);
      process.stdout.write(`✅ (${(buf.length / 1024).toFixed(0)} KB)\n`);
      downloaded++;
    } catch {
      process.stdout.write('❌ failed\n');
      failed++;
    }
  }

  console.log(`\n✅ Done! ${imageFiles.length} total — ${downloaded} downloaded, ${skipped} cached, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

function status(): void {
  fs.mkdirSync(PIXEL_ART_DIR, { recursive: true });

  let files: string[];
  try {
    files = fs.readdirSync(PIXEL_ART_DIR).filter(f => /\.(jpg|png)$/i.test(f));
  } catch {
    files = [];
  }

  const totalSize = files.reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(PIXEL_ART_DIR, f)).size; } catch { return sum; }
  }, 0);

  console.log(`📁 ${path.relative(path.resolve(__dirname, '..'), PIXEL_ART_DIR)}`);
  console.log(`   ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  if (files.length === 0) {
    console.log('   (no pixel-art assets — run `agpa assets download`)');
  }
}

function main(): void {
  const action = process.argv[3];

  if (!action || action === 'status') {
    status();
    return;
  }

  if (action === 'download') {
    download().catch(() => process.exit(1));
    return;
  }

  console.log('Usage: agpa assets <download|status>');
  process.exit(1);
}

main();
