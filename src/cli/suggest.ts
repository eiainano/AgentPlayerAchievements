#!/usr/bin/env node
/**
 * AGPA Suggest CLI — 3-class achievement recommendations
 *
 * Usage:
 *   agpa suggest                  All 3 categories
 *   agpa suggest --near           Near Win only
 *   agpa suggest --discover       Discovery only
 *   agpa suggest --surprise       Surprise only
 *   agpa suggest --N 10           Top 10 near wins
 *   agpa suggest --json           JSON output
 */

import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import { getRecommendResponse } from '../utils/recommend.js';
import { R, B, D, RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

const RARITY_LABELS = RARITY_LABELS_EN;

interface SuggestOptions {
  filter: 'all' | 'near' | 'discover' | 'surprise';
  count: number;
  includeHidden: boolean;
  json: boolean;
  profile: string | null;
}

function parseArgs(args: string[]): SuggestOptions {
  const opts: SuggestOptions = {
    filter: 'all', count: 5, includeHidden: false, json: false, profile: null,
  };
  let explicitFilter = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case '--json': opts.json = true; break;
      case '--near': opts.filter = 'near'; explicitFilter = true; break;
      case '--discover': opts.filter = 'discover'; explicitFilter = true; break;
      case '--surprise': opts.filter = 'surprise'; explicitFilter = true; break;
      case '--profile': { const v = args[++i]; if (v) opts.profile = v; break; }
      case '--hidden': opts.includeHidden = true; break;
      case '--all': {
        opts.count = 999;
        if (!explicitFilter) opts.filter = 'all';
        break;
      }
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
    }
  }

  return opts;
}

function renderBar(current: number, target: number, width: number): string {
  const frac = target > 0 ? current / target : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  const green = '\x1b[38;2;100;200;100m';
  const gray = '\x1b[38;2;60;60;60m';
  return `${green}${'█'.repeat(Math.min(filled, width))}${gray}${'░'.repeat(Math.max(0, empty))}${R}`;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(3));

  const resolvedProfile = opts.profile || loadConfig().active_profile || DEFAULT_PROFILE;
  const stateDir = resolvedProfile !== 'default' ? resolveProfileDir(resolvedProfile) : undefined;
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  const unlockedCount = Object.keys(engine.state.unlocked).length;

  const resp = getRecommendResponse(
    engine.definitions, engine.events, engine.state,
    engine.stateDir || 'default',
  );

  if (opts.json) {
    const output: Record<string, unknown> = { generated_at: resp.generated_at };
    if (opts.filter === 'all' || opts.filter === 'near') {
      output.near_win = resp.near_win.slice(0, opts.count).map(n => ({
        achievement_id: n.achievement_id, name: n.name, icon: n.icon, rarity: n.rarity,
        current: n.progress?.current, target: n.progress?.target,
        progress_pct: n.progress?.pct ?? 0, unit_label: n.unit_label,
      }));
    }
    if (opts.filter === 'all' || opts.filter === 'discover') output.discovery = resp.discovery;
    if (opts.filter === 'all' || opts.filter === 'surprise') output.surprise = resp.surprise;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`\n${B}🪐  AGPA 推荐中心${R}  ${D}──  ${unlockedCount}/${engine.definitions.length} unlocked${R}\n`);

  // Near Win
  if (opts.filter === 'all' || opts.filter === 'near') {
    console.log(`${B}🎯 Near Win  (${Math.min(resp.near_win.length, opts.count)})${R}`);
    const shown = resp.near_win.slice(0, opts.count);
    if (shown.length === 0) {
      console.log(`  ${D}No near-unlock achievements with meaningful progress yet.${R}\n`);
    } else {
      for (const n of shown) {
        const color = RARITY_COLORS[n.rarity] || '';
        const pct = String(n.progress?.pct ?? 0).padStart(2) + '%';
        const bar = renderBar(n.progress?.current ?? 0, n.progress?.target ?? 1, 16);
        console.log(`  ${B}${pct}${R} ${color}${n.icon} ${n.name}${R}`);
        console.log(`       ${color}${RARITY_LABELS[n.rarity] || n.rarity}${R} ${D}—${R} ${D}${n.progress?.current ?? 0} / ${n.progress?.target ?? '?'} ${n.unit_label || ''}${R}`);
        console.log(`       ${bar}  ${color}${pct}${R}\n`);
      }
    }
  }

  // Discovery
  if (opts.filter === 'all' || opts.filter === 'discover') {
    console.log(`${B}🔍 Discovery${R}`);
    if (!resp.discovery) {
      console.log(`  ${D}No undiscovered features — you've tried everything!${R}\n`);
    } else {
      const d = resp.discovery;
      const color = RARITY_COLORS[d.rarity] || '';
      console.log(`  ${color}${d.icon} ${d.name}${R}  (${RARITY_LABELS[d.rarity] || d.rarity})`);
      console.log(`  ${D}→${R} ${d.discovery_event ? `Event: ${d.discovery_event}` : ''}\n`);
    }
  }

  // Surprise
  if (opts.filter === 'all' || opts.filter === 'surprise') {
    console.log(`${B}🎲 Surprise${R}`);
    if (!resp.surprise) {
      console.log(`  ${D}No hidden hints available right now.${R}\n`);
    } else {
      const s = resp.surprise;
      console.log(`  ??? — "${s.hint || s.hint_cn || ''}"\n`);
    }
  }

  console.log(`💡 ${D}Run 'agpa suggest --near' / '--discover' / '--surprise' to filter.${R}\n`);
}

main();
