#!/usr/bin/env node
/**
 * AGPA Import — import achievement data from a backup file
 *
 * Usage:
 *   agpa import <file> [--profile <name>] [--dry-run] [--force]
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { AchievementEngine } from '../engine/engine.js';
import { resolveProfileDir, getProfileMeta } from '../utils/profile.js';
import { loadConfig } from '../config.js';
import { loadShowcase, saveShowcase } from '../helpers.js';
import { safeParse } from '../utils/validate.js';
import type { ExportPayload } from './types.js';
import type { AchievementState } from '../engine/types.js';

const exportPayloadSchema = z.object({
  format_version: z.literal('1.0'),
  exported_at: z.string(),
  source: z.object({
    tool: z.literal('agpa'),
    version: z.string(),
    profile: z.string(),
    profile_emoji: z.string(),
  }),
  state: z.object({
    unlocked: z.record(z.string(), z.string()),
  }).passthrough(),
}).passthrough();

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.1.6';
  } catch {
    return '0.1.6';
  }
}

type ImportStrategy = 'merge' | 'replace';

export function resolveImportConflict(
  existing: AchievementState,
  incoming: AchievementState,
  strategy: ImportStrategy,
): AchievementState {
  switch (strategy) {
    case 'merge': {
      const merged: Record<string, string> = { ...existing.unlocked };
      for (const [id, unlockedAt] of Object.entries(incoming.unlocked)) {
        if (!merged[id] || merged[id]! > unlockedAt) {
          merged[id] = unlockedAt;
        }
      }
      return { ...existing, unlocked: merged, stats: { total_unlocked: Object.keys(merged).length } };
    }
    case 'replace':
      return incoming;
  }
}

export function cmdImport(): void {
  const args = process.argv.slice(3);

  let filePath = '';
  let targetProfile = '';
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' || args[i] === '-p') {
      targetProfile = args[++i] || '';
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--force') {
      force = true;
    } else if (!args[i]?.startsWith('-')) {
      filePath = args[i]!;
    }
  }

  if (!filePath) {
    console.error('Usage: agpa import <file> [--profile <name>] [--dry-run] [--force]');
    process.exit(1);
  }

  // Read and parse the export file with schema validation
  let payload: ExportPayload | null = null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const validated = safeParse(exportPayloadSchema, parsed, null);
    payload = validated ? (validated as unknown as ExportPayload) : null;
    if (!payload) {
      console.error('Error: invalid export file — schema validation failed');
      console.error('Expected: format_version "1.0", source.tool "agpa", state.unlocked');
      process.exit(1);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error reading file: ${msg}`);
    process.exit(1);
  }

  // state.unlocked already validated by schema, but double-check for TypeScript narrowing
  if (!payload.state?.unlocked) {
    console.error('Error: invalid export file — missing state.unlocked');
    process.exit(1);
  }

  const profile = targetProfile || payload.source?.profile || 'default';
  let stateDir: string;
  try {
    stateDir = resolveProfileDir(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid profile';
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  const meta = getProfileMeta(profile);

  // Check for existing data
  const statePath = path.join(stateDir, 'state.json');
  const hasExisting = fs.existsSync(statePath);

  if (dryRun) {
    console.log(`\n🔍 AGPA Import (dry-run)`);
    console.log(`Source:      ${payload.source.tool} v${payload.source.version} (${payload.source.profile})`);
    console.log(`Target:      ${meta.emoji} ${profile}`);
    console.log(`Strategy:    ${hasExisting ? 'merge' : 'create'}`);
    console.log(`\nContents:`);
    console.log(`  Achievements: ${Object.keys(payload.state.unlocked).length}`);
    console.log(`  Stats:        ${payload.stats ? 'yes' : 'no'}`);
    console.log(`  Showcase:     ${payload.showcase ? payload.showcase.slots.filter(s => !!s).length : 0} slots`);
    console.log(`  Events:       ${payload.events?.length || 0}`);
    console.log(`  Config:       ${payload.config ? 'yes' : 'no'}`);
    console.log(`\nNo changes made (--dry-run).`);
    return;
  }

  const strategy: ImportStrategy = force ? 'replace' : 'merge';

  if (hasExisting && !force) {
    console.log(`\n⚠️  Target profile "${profile}" already has data.`);
    console.log(`   Strategy: merge (union of achievements, keeping earliest unlock time)`);
    console.log(`   Use --force to replace all data instead.`);
  }

  // Init engine for target
  const engine = new AchievementEngine({ stateDir });
  engine.init();

  // Resolve state
  const resolvedState = hasExisting
    ? resolveImportConflict(engine.state, payload.state, strategy)
    : payload.state;

  if (!dryRun) {
    // Write state
    engine.saveState(resolvedState);

    // Write stats
    if (payload.stats) {
      engine.saveStats(payload.stats);
    }

    // Write showcase
    if (payload.showcase) {
      saveShowcase(stateDir, payload.showcase);
    }

    // Write events (append mode to avoid overwriting existing)
    if (payload.events && payload.events.length > 0) {
      engine.appendEvents(payload.events);
    }

    console.log(`\n✅ Import complete`);
    console.log(`Profile:      ${meta.emoji} ${profile}`);
    console.log(`Strategy:     ${strategy}`);
    console.log(`Achievements: ${Object.keys(resolvedState.unlocked).length} unlocked`);
    if (payload.events) console.log(`Events:       ${payload.events.length} imported`);
  }
}

// Only execute when run directly
const isMain = process.argv[1]?.endsWith('import.ts') || process.argv[1]?.endsWith('import');
if (isMain) {
  cmdImport();
}
