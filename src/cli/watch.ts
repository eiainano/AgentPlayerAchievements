#!/usr/bin/env node
/**
 * AGPA Watch — real-time achievement monitor
 *
 * Usage:
 *   agpa watch               Live monitor (3s default poll)
 *   agpa watch --poll 5       Poll every 5 seconds
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import type { AchievementDefinition } from '../engine/types.js';
import { RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';

// ── Rendering ──────────────────────────────────────────────────────────

function renderUnlock(ach: AchievementDefinition): string {
  const rarity = ach.rarity || 'common';
  const color = RARITY_COLORS[rarity] || '';
  const rarityLabel = RARITY_LABELS_EN[rarity] || rarity;
  const icon = ach.icon || '🏆';

  const lines: string[] = [];
  lines.push(`\n${color}${B}  ╔══════════════════════════════════════════════╗${R}`);
  lines.push(`${color}${B}  ║${R}  🏆 ${B}ACHIEVEMENT UNLOCKED!${R}${' '.repeat(24)}${color}${B}║${R}`);
  lines.push(`${color}${B}  ║${R}${' '.repeat(46)}${color}${B}║${R}`);
  lines.push(`${color}${B}  ║${R}    ${icon}  ${B}${ach.name}${R}${' '.repeat(Math.max(0, 40 - ach.name.length))}${color}${B}║${R}`);
  lines.push(`${color}${B}  ║${R}    ${D}${ach.description}${R}${' '.repeat(Math.max(0, 40 - ach.description.length))}${color}${B}║${R}`);
  lines.push(`${color}${B}  ║${R}${' '.repeat(46)}${color}${B}║${R}`);
  lines.push(`${color}${B}  ║${R}    ${rarityLabel}${' '.repeat(40 - rarityLabel.length)}${color}${B}║${R}`);
  lines.push(`${color}${B}  ╚══════════════════════════════════════════════╝${R}`);
  return lines.join('\n');
}

function renderStats(engine: AchievementEngine): string {
  const s = engine.stats();
  const lines: string[] = [];
  lines.push(`\n${B}📊 Current Progress${R}`);
  lines.push(`  Achievements: ${s.unlocked}/${s.total_achievements} (${s.completion_pct}%)`);
  lines.push(`  Events:       ${s.total_events}`);
  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  const rawArgs = process.argv.slice(2);
  // When invoked via agpa index.ts, argv[2] is 'watch' followed by flags.
  const args = rawArgs[0] === 'watch' ? rawArgs.slice(1) : rawArgs;

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${B}AGPA Watch${R} — real-time achievement monitor

Usage:
  agpa watch                Live monitor (3s poll interval)
  agpa watch --poll <N>     Poll every N seconds (min 1, max 60)

Monitor your achievement progress in real-time as you code.
Shows live event log changes and unlocks achievements with animations.
Press Ctrl+C to exit.
`);
    process.exit(0);
  }

  let pollSec = 3;
  let profile: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--poll' && args[i + 1]) {
      const n = parseInt(args[i + 1]!, 10);
      if (isNaN(n) || n < 1 || n > 60) {
        console.error('--poll requires a number between 1-60');
        process.exit(1);
      }
      pollSec = n;
    } else if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]!;
    }
  }

  const resolvedProfile = profile || loadConfig().active_profile || DEFAULT_PROFILE;
  const stateDir = resolvedProfile !== 'default' ? resolveProfileDir(resolvedProfile) : undefined;

  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();

  // Non-TTY mode (piped, non-interactive): show current stats once and exit.
  // This makes watch usable in scripts and testable.
  if (!process.stdout.isTTY) {
    console.log(JSON.stringify(engine.stats()));
    process.exit(0);
  }

  console.log(`\n${B}👁️  AGPA Watch${R}  ${D}polling every ${pollSec}s${R}`);
  console.log(`  ${D}Press Ctrl+C to exit${R}`);
  console.log(`  ${D}Run "agpa watch --help" for details${R}`);
  let prevUnlocked = new Set(Object.keys(engine.state.unlocked));
  let prevEventCount = engine.events.length;
  let lastSummaryShown = Date.now();

  function tick(): void {
    // Reload engine to pick up new events
    engine.reload();

    const currentUnlocked = new Set(Object.keys(engine.state.unlocked));
    const currentEventCount = engine.events.length;

    // Check for newly unlocked achievements
    const newlyUnlocked: AchievementDefinition[] = [];
    for (const id of currentUnlocked) {
      if (!prevUnlocked.has(id)) {
        const def = engine.definitions.find(d => d.id === id);
        if (def) newlyUnlocked.push(def);
      }
    }

    if (newlyUnlocked.length > 0) {
      for (const ach of newlyUnlocked) {
        console.log(renderUnlock(ach));
      }
    }

    // Show event delta
    const delta = currentEventCount - prevEventCount;
    if (delta > 0) {
      const timeStr = new Date().toLocaleTimeString();
      const deltaStr = delta > 0 ? `${G}+${delta}${R} events` : '';
      const unlockedStr = newlyUnlocked.length > 0
        ? `  ${Y}🏆 ${newlyUnlocked.length} unlocked!${R}`
        : '';
      console.log(`  ${D}${timeStr}${R}  ${deltaStr}  ${currentEventCount} total${unlockedStr}`);
    }

    // Periodic summary (every 30s)
    if (Date.now() - lastSummaryShown > 30_000) {
      console.log(renderStats(engine));
      lastSummaryShown = Date.now();
    }

    prevUnlocked = currentUnlocked;
    prevEventCount = currentEventCount;
  }

  // Run immediately
  tick();

  // Then poll
  const interval = setInterval(tick, pollSec * 1000);

  // Graceful shutdown
  const cleanup = () => {
    clearInterval(interval);
    console.log(`\n${D}👋 Watch ended.${R}\n`);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main();
