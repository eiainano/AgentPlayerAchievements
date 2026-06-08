#!/usr/bin/env node
/**
 * AGPA Search CLI — search/filter achievements in terminal
 *
 * Usage:
 *   agpa search <query>                     Keyword search (name/desc/id)
 *   agpa search --rarity <rarity>           Filter by rarity
 *   agpa search --category <category>       Filter by category
 *   agpa search --unlocked                  Only unlocked
 *   agpa search --locked                    Only locked
 *   agpa search <query> --rarity epic       Combined filters
 */

import type { AchievementDefinition } from '../engine/types.js';
import { R, B, D, I, RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

const RARITY_LABELS = RARITY_LABELS_EN;

const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

// ── Argument parsing ─────────────────────────────────────────────────

interface FilterOptions {
  query: string | null;
  rarity: string | null;
  category: string | null;
  status: 'unlocked' | 'locked' | null;
  json: boolean;
  profile: string | null;
}

function parseArgs(args: string[]): FilterOptions {
  const opts: FilterOptions = { query: null, rarity: null, category: null, status: null, json: false, profile: null };
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case '--json':
        opts.json = true;
        break;
      case '--profile': {
        const v = args[++i];
        if (v) opts.profile = v;
        break;
      }
      case '--rarity': {
        const v = args[++i];
        if (!v || !VALID_RARITIES.has(v)) {
          console.error(`Invalid rarity. Valid: ${[...VALID_RARITIES].join(', ')}`);
          process.exit(1);
        }
        opts.rarity = v;
        break;
      }
      case '--category': {
        const v = args[++i];
        if (!v) { console.error('--category requires a value'); process.exit(1); }
        opts.category = v;
        break;
      }
      case '--unlocked':
        opts.status = 'unlocked';
        break;
      case '--locked':
        opts.status = 'locked';
        break;
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
        positional.push(a);
    }
  }

  opts.query = positional.length > 0 ? positional.join(' ') : null;
  return opts;
}

// ── Engine helper ────────────────────────────────────────────────────

import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import { AchievementEngine } from '../engine/engine.js';

// ── Filtering ─────────────────────────────────────────────────────────

function matchQuery(def: AchievementDefinition, query: string): boolean {
  const q = query.toLowerCase();
  return def.id.toLowerCase().includes(q)
    || def.name.toLowerCase().includes(q)
    || (def.name_cn?.toLowerCase().includes(q) ?? false)
    || def.description.toLowerCase().includes(q)
    || def.category.toLowerCase().includes(q)
    || (def.rarity?.toLowerCase().includes(q) ?? false);
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  const sliceFrom = process.argv[2] === 'search' ? 3 : 2;
  const opts = parseArgs(process.argv.slice(sliceFrom));

  const resolvedProfile = opts.profile || loadConfig().active_profile || DEFAULT_PROFILE;
  const stateDir = resolvedProfile !== 'default' ? resolveProfileDir(resolvedProfile) : undefined;
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  let results = [...engine.definitions];

  // Apply filters
  if (opts.query) {
    results = results.filter(d => matchQuery(d, opts.query!));
  }
  if (opts.rarity) {
    results = results.filter(d => d.rarity === opts.rarity);
  }
  if (opts.category) {
    const cat = opts.category.toLowerCase();
    results = results.filter(d => d.category?.toLowerCase() === cat);
  }
  if (opts.status === 'unlocked') {
    results = results.filter(d => engine.state.unlocked[d.id]);
  }
  if (opts.status === 'locked') {
    results = results.filter(d => !engine.state.unlocked[d.id]);
  }

  // Separator
  const unlockedCount = results.filter(d => engine.state.unlocked[d.id]).length;
  const total = results.length;

  if (opts.json) {
    const output = results.map(d => ({
      id: d.id,
      name: d.name,
      name_cn: d.name_cn || null,
      description: d.description,
      icon: d.icon || '🏆',
      category: d.category,
      rarity: d.rarity,
      hidden: !!d.hidden,
      unlocked: !!engine.state.unlocked[d.id],
      unlocked_at: engine.state.unlocked[d.id] || null,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const statusLine = opts.status
    ? `(${opts.status})`
    : `(${unlockedCount}/${total} unlocked)`;

  console.log(`\n${B}🔍 Achievement Search${R}  ${D}${total} results ${statusLine}${R}\n`);

  if (results.length === 0) {
    console.log(`  ${D}No achievements match your criteria. Try broader terms.${R}\n`);
    return;
  }

  // Group by category for readability
  const byCategory: Record<string, AchievementDefinition[]> = {};
  for (const d of results) {
    const cat = d.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(d);
  }

  for (const [cat, defs] of Object.entries(byCategory)) {
    console.log(`  ${B}${cat}${R} (${defs.length})`);

    for (const d of defs) {
      const unlocked = !!engine.state.unlocked[d.id];
      const marker = unlocked ? `${B}✔${R}` : `${D}○${R}`;
      const color = unlocked ? RARITY_COLORS[d.rarity] || '' : D;
      const icon = d.icon || '🏆';
      const rarityTag = RARITY_LABELS[d.rarity] || d.rarity;
      const hiddenTag = d.hidden ? ' 🔒' : '';
      const desc = d.description.length > 50 ? d.description.slice(0, 47) + '...' : d.description;

      console.log(`  ${marker} ${color}${icon} ${d.name}${R}`);
      if (unlocked) {
        console.log(`       ${D}${rarityTag}${hiddenTag}${R}  ${D}${desc}${R}`);
      } else {
        console.log(`       ${D}${rarityTag}${hiddenTag} ${desc}${R}`);
      }
    }
    console.log('');
  }

  // Quick stats
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
  console.log(`  ${D}${unlockedCount}/${total} unlocked (${pct}%) in ${Object.keys(byCategory).length} categories${R}`);
  console.log('');
}

main();
