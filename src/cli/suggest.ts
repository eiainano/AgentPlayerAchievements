#!/usr/bin/env node
/**
 * AGPA Suggest CLI — show nearest unlockable achievements
 *
 * Usage:
 *   agpa suggest              Top 5 nearest unlocks
 *   agpa suggest --N 10       Top 10
 *   agpa suggest --all        All over 20% progress
 *   agpa suggest --hidden     Include hidden achievements (spoilers!)
 */

import { createEngine } from '../engine/factory.js';
import { findNearUnlocks } from '../utils/progress-nudge.js';
import type { NearUnlock } from '../utils/progress-nudge.js';
import { R, B, D, RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

const RARITY_LABELS = RARITY_LABELS_EN;

// ── Argument parsing ─────────────────────────────────────────────────

interface SuggestOptions {
  count: number;
  includeHidden: boolean;
}

function parseArgs(args: string[]): SuggestOptions {
  const opts: SuggestOptions = { count: 5, includeHidden: false };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case '--all':
        opts.count = 999;
        break;
      case '--hidden':
        opts.includeHidden = true;
        break;
      case '--N':
      case '-n': {
        const v = args[++i];
        const n = parseInt(v ?? '', 10);
        if (isNaN(n) || n < 1 || n > 999) {
          console.error('--N requires a number between 1-999');
          process.exit(1);
        }
        opts.count = n;
        break;
      }
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
        console.error(`Unknown argument: ${a}`);
        process.exit(1);
    }
  }

  return opts;
}

// ── Rendering ────────────────────────────────────────────────────────

function renderBar(current: number, target: number, width: number): string {
  const frac = target > 0 ? current / target : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  const green = '\x1b[38;2;100;200;100m';
  const gray = '\x1b[38;2;60;60;60m';
  return `${green}${'█'.repeat(Math.min(filled, width))}${gray}${'░'.repeat(Math.max(0, empty))}${R}`;
}

function formatPct(current: number, target: number): string {
  if (target <= 0) return '  0%';
  const pct = Math.round((current / target) * 100);
  return `${pct.toString().padStart(2)}%`;
}

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  const opts = parseArgs(process.argv.slice(3)); // "agpa" "suggest" ...

  const engine = createEngine();
  const unlockedCount = Object.keys(engine.state.unlocked).length;

  const nearUnlocks = findNearUnlocks(engine.definitions, engine.events, engine.state, {
    maxResults: opts.count,
    minProgress: 0.01,
  });

  // Filter hidden unless --hidden
  const results = opts.includeHidden
    ? nearUnlocks
    : nearUnlocks.filter(n => {
        const def = engine.definitions.find(d => d.id === n.achievement_id);
        return !def?.hidden;
      });

  const shown = results.slice(0, opts.count);

  console.log(`\n${B}🎯 Nearest Unlocks${R}  ${D}${unlockedCount}/${engine.definitions.length} unlocked${R}\n`);

  if (shown.length === 0) {
    const allDone = unlockedCount >= engine.definitions.length;
    if (allDone) {
      console.log(`  ${B}🌟 You've unlocked every achievement!${R}`);
    } else {
      console.log(`  ${D}No achievements with meaningful progress yet.${R}`);
      console.log(`  ${D}Keep coding with AGPA-tracked tools to earn achievements!${R}`);
    }
    console.log('');
    return;
  }

  for (const n of shown) {
    const color = RARITY_COLORS[n.rarity] || '';
    const pct = formatPct(n.current, n.target);
    const bar = renderBar(n.current, n.target, 16);

    console.log(`  ${B}${pct}${R} ${color}${n.icon} ${n.name}${R}`);
    console.log(`       ${color}${RARITY_LABELS[n.rarity] || n.rarity}${R} ${D}—${R} ${D}${n.current} / ${n.target} ${n.unit_label}${R}`);
    console.log(`       ${bar}  ${color}${pct}${R}`);
    console.log('');
  }

  const remaining = nearUnlocks.length - shown.length;
  if (remaining > 0) {
    console.log(`  ${D}… and ${remaining} more. Run 'agpa suggest --all' to see all.${R}\n`);
  }
}

main();
