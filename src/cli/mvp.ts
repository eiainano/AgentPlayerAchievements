#!/usr/bin/env node
/**
 * AGPA MVP Demo — simulate agent usage and watch achievements unlock
 *
 * Usage:
 *   npx tsx src/cli/mvp.ts demo
 *   npx tsx src/cli/mvp.ts stats
 *   npx tsx src/cli/mvp.ts progress
 *   npx tsx src/cli/mvp.ts reset
 */

import { AchievementEngine } from '../engine/engine.js';
import type { AchievementDefinition, AchievementStats, AchievementState } from '../engine/types.js';

// ── Terminal rendering helpers ───────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  common: '\x1b[38;2;150;150;150m',
  uncommon: '\x1b[38;2;100;200;100m',
  rare: '\x1b[38;2;66;133;244m',
  epic: '\x1b[38;2;180;70;240m',
  legendary: '\x1b[38;2;255;140;0m',
  mythic: '\x1b[38;2;255;50;50m',
};

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
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const gold = '\x1b[38;2;255;200;0m';

  const icon = ach.icon || '🏆';
  const name = ach.name || ach.id;
  const desc = ach.description || '';

  const W = 52;

  return [
    `${color}${bold}  ╔${'═'.repeat(W - 2)}╗${reset}`,
    `${color}${bold}  ║${reset}${gold}  🏆 ACHIEVEMENT UNLOCKED!${' '.repeat(W - 29)}${color}${bold}║${reset}`,
    `${color}${bold}  ║${reset}${' '.repeat(W - 2)}${color}${bold}║${reset}`,
    `${color}${bold}  ║${reset}    ${icon}  ${bold}${name}${reset}${' '.repeat(Math.max(0, W - name.length - 10))}${color}${bold}║${reset}`,
    `${color}${bold}  ║${reset}    ${dim}${desc}${reset}${' '.repeat(Math.max(0, W - desc.length - 6))}${color}${bold}║${reset}`,
    `${color}${bold}  ║${reset}${' '.repeat(W - 2)}${color}${bold}║${reset}`,
    `${color}${bold}  ║${reset}    ${RARITY_BADGE[rarity] || rarity}${' '.repeat(W - rarity.length - 16)}${color}${bold}║${reset}`,
    `${color}${bold}  ╚${'═'.repeat(W - 2)}╝${reset}`,
  ].join('\n');
}

function renderStats(stats: AchievementStats): string {
  const lines: string[] = [];
  lines.push(`\n\x1b[1m\x1b[38;2;255;200;0m  ═══ AGPA Stats ═══\x1b[0m`);
  lines.push(`  Achievements: ${stats.unlocked}/${stats.total_achievements} (${stats.completion_pct}%)`);
  lines.push(`  Events logged: ${stats.total_events}`);

  lines.push(`\n  \x1b[1mBy Category:\x1b[0m`);
  for (const [cat, v] of Object.entries(stats.by_category)) {
    const bar = renderBar(v.unlocked, v.total, 20);
    lines.push(`  ${cat.padEnd(14)} ${bar} ${v.unlocked}/${v.total}`);
  }

  lines.push(`\n  \x1b[1mBy Rarity:\x1b[0m`);
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  for (const rar of order) {
    if (stats.by_rarity[rar]) {
      const v = stats.by_rarity[rar]!;
      const bar = renderBar(v.unlocked, v.total, 20);
      lines.push(`  ${(RARITY_BADGE[rar] || rar).padEnd(14)} ${bar} ${v.unlocked}/${v.total}`);
    }
  }

  return lines.join('\n');
}

function renderBar(done: number, total: number, width: number): string {
  const frac = total > 0 ? done / total : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  const green = '\x1b[38;2;100;200;100m';
  const gray = '\x1b[38;2;60;60;60m';
  const reset = '\x1b[0m';
  return `${green}${'█'.repeat(filled)}${gray}${'░'.repeat(empty)}${reset}`;
}

function renderProgress(defs: AchievementDefinition[], state: AchievementState): string {
  const lines: string[] = [];
  lines.push(`\n\x1b[1m\x1b[38;2;255;200;0m  ═══ All Achievements ═══\x1b[0m\n`);

  const byCategory: Record<string, AchievementDefinition[]> = {};
  for (const d of defs) {
    const cat = d.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(d);
  }

  for (const [cat, catDefs] of Object.entries(byCategory)) {
    lines.push(`  \x1b[1m── ${cat.toUpperCase()} ──\x1b[0m`);
    for (const d of catDefs) {
      const unlocked = !!state.unlocked[d.id];
      const icon = unlocked ? '\x1b[38;2;100;200;100m✔\x1b[0m' : '\x1b[38;2;60;60;60m○\x1b[0m';
      const color = unlocked ? '' : '\x1b[2m';
      const reset_ = unlocked ? '\x1b[0m' : '\x1b[0m';
      const hiddenTag = d.hidden ? ' 🔒' : '';
      const rarityLabel = RARITY_BADGE[d.rarity] || d.rarity;
      const displayIcon = (d.icon || '🏆').padEnd(2);
      lines.push(`  ${icon} ${color}${displayIcon} ${d.name.padEnd(24)} ${rarityLabel}${hiddenTag}${reset_}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Demo scenario ────────────────────────────────────────────────────

function runDemo(): void {
  const engine = new AchievementEngine();
  engine.resetState();
  engine.init();

  console.log('\x1b[1m\x1b[38;2;255;200;0m');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║     🎮  AGPA MVP — Simulation Mode  🎮      ║');
  console.log('  ║    Agent Player Achievements System          ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  const session: Array<{ event: string; payload?: Record<string, unknown> }> = [
    { event: 'session.start' },
    { event: 'conversation.message' },
    { event: 'conversation.message' },
    { event: 'conversation.message' },
    { event: 'tool.complete', payload: { tool_name: 'Read' } },
    { event: 'conversation.message' },
    { event: 'tool.complete', payload: { tool_name: 'Edit' } },
    { event: 'task.complete' },
    { event: 'conversation.message' },
    { event: 'tool.complete', payload: { tool_name: 'Bash' } },
    { event: 'task.complete' },
    { event: 'tool.complete', payload: { tool_name: 'Write' } },
    { event: 'task.complete' },
    { event: 'conversation.message' },
    { event: 'session.end' },
  ];

  console.log('\x1b[2mSimulating first session...\x1b[0m\n');

  for (const { event, payload } of session) {
    engine.track(event, payload || {});
    process.stdout.write('.');
  }

  const first = engine.poll();
  if (first.length > 0) {
    console.log(`\n`);
    for (const ach of first) {
      console.log(renderPopup(ach));
      console.log();
    }
  }

  console.log('\x1b[2mSimulating continued usage (10 sessions)...\x1b[0m\n');

  for (let s = 0; s < 10; s++) {
    engine.track('session.start');
    engine.track('conversation.message');
    engine.track('tool.complete', { tool_name: 'Read' });
    engine.track('conversation.message');
    engine.track('tool.complete', { tool_name: 'Edit' });
    engine.track('task.complete');
    engine.track('conversation.message');
    engine.track('tool.complete', { tool_name: 'Bash' });
    engine.track('tool.complete', { tool_name: 'Read' });
    engine.track('conversation.message');
    engine.track('task.complete');

    if (s % 2 === 0) {
      engine.track('task.complete');
      engine.track('conversation.message');
    }

    engine.track('session.end');
  }

  const more = engine.poll();
  if (more.length > 0) {
    for (const ach of more) {
      console.log(renderPopup(ach));
      console.log();
    }
  }

  const stats = engine.stats();
  console.log(renderStats(stats));

  console.log(`\n\n\x1b[2mRun "npm run progress" to see all achievements.\x1b[0m`);
  console.log(`\x1b[2mRun "npm run reset" to start over.\x1b[0m\n`);
}

// ── Main ─────────────────────────────────────────────────────────────

const cmd = process.argv[2] || 'demo';

if (cmd === 'demo') {
  runDemo();
} else if (cmd === 'stats') {
  const engine = new AchievementEngine();
  engine.init();
  console.log(renderStats(engine.stats()));
} else if (cmd === 'progress') {
  const engine = new AchievementEngine();
  engine.init();
  console.log(renderProgress(engine.definitions, engine.state));
} else if (cmd === 'reset') {
  const engine = new AchievementEngine();
  engine.init();
  engine.resetState();
  console.log('\x1b[32m✔ State reset. Run "npm run demo" to start fresh.\x1b[0m');
} else {
  console.log('Usage: npx tsx src/cli/mvp.ts [demo|stats|progress|reset]');
}
