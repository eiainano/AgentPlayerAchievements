#!/usr/bin/env node
/**
 * AGPA Export — export achievement data to a portable JSON file
 *
 * Usage:
 *   agpa export [profile] [--output <path>] [--full] [--migrate]
 */

import * as fs from 'fs';
import * as path from 'path';
import { AchievementEngine } from '../engine/engine.js';
import { resolveProfileDir, getProfileMeta } from '../utils/profile.js';
import { loadConfig } from '../config.js';
import { loadShowcase } from '../helpers.js';
import type { ExportPayload } from './types.js';

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.1.6';
  } catch {
    return '0.1.6';
  }
}

export function cmdExport(): void {
  const args = process.argv.slice(3);

  let profile = 'default';
  let outputPath = '';
  let full = false;
  let migrate = false;
  let mode: string = 'core';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i] || '';
    } else if (args[i] === '--full') {
      full = true;
    } else if (args[i] === '--migrate') {
      migrate = true;
      full = true;
    } else if (!args[i]?.startsWith('-')) {
      profile = args[i]!;
    }
  }

  let stateDir: string;
  try {
    stateDir = resolveProfileDir(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid profile';
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  const engine = new AchievementEngine({ stateDir });
  engine.init();

  const meta = getProfileMeta(profile);
  const pkgVersion = readPackageVersion();

  const payload: ExportPayload = {
    format_version: '1.0',
    exported_at: new Date().toISOString(),
    source: {
      tool: 'agpa',
      version: pkgVersion,
      profile: meta.name,
      profile_emoji: meta.emoji,
    },
    state: engine.state,
    stats: engine.toolStats(),
    showcase: loadShowcase(stateDir),
  };

  if (full) {
    payload.events = engine.events;
  }
  if (migrate) {
    payload.config = loadConfig();
  }

  // Determine mode and output path
  mode = migrate ? 'migrate' : full ? 'full' : 'core';
  if (!outputPath) {
    const exportDir = path.join(stateDir, 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    outputPath = path.join(exportDir, `agpa-${profile}-${dateStr}-${mode}.json`);
  }

  // Atomic write
  const tmp = outputPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, outputPath);

  const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);

  console.log(`\n🏆 AGPA Export`);
  console.log(`Profile: ${meta.emoji} ${profile}`);
  console.log(`Format:  ${mode || 'core'}\n`);
  console.log(`✓ state.json     — ${Object.keys(payload.state.unlocked).length} achievements unlocked`);
  console.log(`✓ stats.json     — ${Object.keys(payload.stats?.sessions || {}).length} tools tracked`);
  console.log(`✓ showcase.json  — ${payload.showcase.slots.filter(s => !!s).length} slots configured`);
  if (full) console.log(`✓ event.log      — ${payload.events?.length || 0} events`);
  if (migrate) console.log(`✓ config.json    — exported`);

  console.log(`\nExport saved to: ${outputPath} (~${sizeKB} KB)`);
}

// Only execute when run directly
const isMain = process.argv[1]?.endsWith('export.ts') || process.argv[1]?.endsWith('export');
if (isMain) {
  cmdExport();
}
