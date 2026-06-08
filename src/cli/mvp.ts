#!/usr/bin/env node
/**
 * AGPA MVP Demo — simulate agent usage and watch achievements unlock
 *
 * Usage:
 *   agpa mvp demo
 *   agpa mvp stats [--json]
 *   agpa mvp progress [--json]
 *   agpa mvp reset
 */

import * as fs from 'node:fs';
import { AchievementEngine } from '../engine/engine.js';
import type { AchievementDefinition, AchievementStats, AchievementState } from '../engine/types.js';
import { R, B, D, G, C, RARITY_COLORS, RARITY_LABELS_EN, RARITY_ORDER } from '../utils/theme.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';

// ── Terminal rendering helpers ───────────────────────────────────────

const RARITY_BADGE: Record<string, string> = {
  common: '⬜ Common',
  uncommon: '🟩 Uncommon',
  rare: '🟦 Rare',
  epic: '🟪 Epic',
  legendary: '🟧 Legendary',
  mythic: '🟥 Mythic',
};

function renderPopup(ach: AchievementDefinition): string {
  const rarity = ach.rarity || 'common';
  const color = RARITY_COLORS[rarity] || '';
  const gold = '\x1b[38;2;255;200;0m';
  const icon = ach.icon || '🏆';
  const name = ach.name || ach.id;
  const desc = ach.description || '';
  const W = 52;

  return [
    `${color}${B}  ╔${'═'.repeat(W - 2)}╗${R}`,
    `${color}${B}  ║${R}${gold}  🏆 ACHIEVEMENT UNLOCKED!${' '.repeat(W - 29)}${color}${B}║${R}`,
    `${color}${B}  ║${R}${' '.repeat(W - 2)}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${icon}  ${B}${name}${R}${' '.repeat(Math.max(0, W - name.length - 10))}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${D}${desc}${R}${' '.repeat(Math.max(0, W - desc.length - 6))}${color}${B}║${R}`,
    `${color}${B}  ║${R}${' '.repeat(W - 2)}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${RARITY_BADGE[rarity] || rarity}${' '.repeat(W - rarity.length - 16)}${color}${B}║${R}`,
    `${color}${B}  ╚${'═'.repeat(W - 2)}╝${R}`,
  ].join('\n');
}

function renderBar(done: number, total: number, width: number): string {
  const frac = total > 0 ? done / total : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  return `${G}${'█'.repeat(filled)}${D}${'░'.repeat(empty)}${R}`;
}

function renderStats(stats: AchievementStats): string {
  const lines: string[] = [];
  lines.push(`\n${B}\x1b[38;2;255;200;0m  ═══ AGPA Stats ═══${R}`);
  lines.push(`  Achievements: ${stats.unlocked}/${stats.total_achievements} (${stats.completion_pct}%)`);
  lines.push(`  Events logged: ${stats.total_events}`);

  lines.push(`\n  ${B}By Category:${R}`);
  for (const [cat, v] of Object.entries(stats.by_category)) {
    const bar = renderBar(v.unlocked, v.total, 20);
    lines.push(`  ${cat.padEnd(14)} ${bar} ${v.unlocked}/${v.total}`);
  }

  lines.push(`\n  ${B}By Rarity:${R}`);
  for (const rar of RARITY_ORDER) {
    if (stats.by_rarity[rar]) {
      const v = stats.by_rarity[rar]!;
      const bar = renderBar(v.unlocked, v.total, 20);
      lines.push(`  ${(RARITY_BADGE[rar] || rar).padEnd(14)} ${bar} ${v.unlocked}/${v.total}`);
    }
  }

  return lines.join('\n');
}

function renderStatsJSON(stats: AchievementStats): string {
  return JSON.stringify(stats, null, 2);
}

function renderProgress(defs: AchievementDefinition[], state: AchievementState): string {
  const lines: string[] = [];
  lines.push(`\n${B}\x1b[38;2;255;200;0m  ═══ All Achievements ═══${R}\n`);

  const byCategory: Record<string, AchievementDefinition[]> = {};
  for (const d of defs) {
    const cat = d.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(d);
  }

  let totalUnlocked = 0;
  const totalDefs = defs.length;

  for (const [cat, catDefs] of Object.entries(byCategory)) {
    const catUnlocked = catDefs.filter(d => !!state.unlocked[d.id]).length;
    const catTotal = catDefs.length;
    totalUnlocked += catUnlocked;

    // Category header with inline progress bar
    const catBar = renderBar(catUnlocked, catTotal, 16);
    lines.push(`  ${B}── ${cat.toUpperCase()} ──${R} ${catBar} ${catUnlocked}/${catTotal}`);
    for (const d of catDefs) {
      const unlocked = !!state.unlocked[d.id];
      const icon = unlocked ? `${G}✔${R}` : `${D}○${R}`;
      const color = unlocked ? '' : D;
      const hiddenTag = d.hidden ? ' 🔒' : '';
      const rarityLabel = RARITY_LABELS_EN[d.rarity] || d.rarity;
      const displayIcon = (d.icon || '🏆').padEnd(2);
      lines.push(`  ${icon} ${color}${displayIcon} ${d.name.padEnd(24)} ${rarityLabel}${hiddenTag}${R}`);
    }
    lines.push('');
  }

  // Overall progress bar
  const overallBar = renderBar(totalUnlocked, totalDefs, 32);
  lines.push(`  ${B}TOTAL${R}    ${overallBar} ${totalUnlocked}/${totalDefs} (${totalDefs > 0 ? Math.round(totalUnlocked / totalDefs * 100) : 0}%)\n`);

  return lines.join('\n');
}

function renderProgressJSON(defs: AchievementDefinition[], state: AchievementState): string {
  const items = defs.map(d => ({
    id: d.id,
    name: d.name,
    category: d.category,
    rarity: d.rarity,
    icon: d.icon,
    unlocked: !!state.unlocked[d.id],
    hidden: !!d.hidden,
    unlocked_at: state.unlocked[d.id] || null,
  }));
  return JSON.stringify(items, null, 2);
}

// ── Main ─────────────────────────────────────────────────────────────

function parseProfile(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) return args[i + 1]!;
  }
  return null;
}

function resolveStateDir(profile: string | null): string | undefined {
  const p = profile || loadConfig().active_profile || DEFAULT_PROFILE;
  return p !== 'default' ? resolveProfileDir(p) : undefined;
}

const cmd = process.argv[2] || 'stats';
const args = process.argv.slice(3);
const jsonOutput = args.includes('--json');
const profile = parseProfile(args);

if (cmd === 'stats') {
  const stateDir = resolveStateDir(profile);
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  const stats = engine.stats();
  if (jsonOutput) {
    console.log(renderStatsJSON(stats));
  } else {
    console.log(renderStats(stats));
  }
} else if (cmd === 'progress') {
  const stateDir = resolveStateDir(profile);
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  if (jsonOutput) {
    console.log(renderProgressJSON(engine.definitions, engine.state));
  } else {
    console.log(renderProgress(engine.definitions, engine.state));
  }
} else if (cmd === 'reset') {
  // Require confirmation in TTY mode
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  if (isTTY) {
    const stateDirTmp = resolveStateDir(profile);
    const engineTmp = new AchievementEngine(stateDirTmp ? { stateDir: stateDirTmp } : {});
    engineTmp.init();
    const statsTmp = engineTmp.stats();
    console.log(`\n${B}⚠️  Reset Achievement Data${R}\n`);
    console.log(`  Current profile: ${profile || 'default'}`);
    console.log(`  ${G}${statsTmp.unlocked}${R}/${statsTmp.total_achievements} achievements unlocked`);
    console.log(`  ${statsTmp.total_events} events logged`);
    console.log(`  ${statsTmp.completion_pct}% complete`);
    console.log(`\n${C}This will DELETE all achievement data for this profile.${R}`);
    console.log(`  ${D}To keep a backup, run: agpa export [profile]${R}`);
    process.stdout.write(`\n${B}Type "yes" to confirm:${R} `);
    // Synchronous stdin read (single line)
    const buf = Buffer.alloc(1024);
    const fd = process.stdin.fd !== undefined ? process.stdin.fd : 0;
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
    const input = buf.toString('utf-8', 0, bytesRead).trim().toLowerCase();
    if (input !== 'yes') {
      console.log(`\n  ${C}Reset cancelled.${R}\n`);
      process.exit(0);
    }
  }
  const stateDir = resolveStateDir(profile);
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  engine.resetState();
  console.log(`\n${G}✔ State reset.${R} ${D}Run "agpa demo" to start fresh.${R}\n`);
} else if (cmd === '--help' || cmd === '-h') {
  console.log('Usage: agpa mvp [demo|stats|progress|reset] [--json] [--profile <name>]');
} else {
  console.log('Usage: agpa mvp [demo|stats|progress|reset] [--json] [--profile <name>]');
}
