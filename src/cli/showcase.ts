#!/usr/bin/env node
/**
 * AGPA Showcase CLI — manage achievement showcase
 *
 * Usage:
 *   agpa showcase                      List current showcase
 *   agpa showcase list                 List showcase slots
 *   agpa showcase pin <id> [slot]      Pin achievement to slot (1-6)
 *   agpa showcase unpin <slot>         Remove from slot (1-6)
 *   agpa showcase auto-fill            Auto-fill with rarest unlocked
 */

import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir } from '../utils/profile.js';
import { loadShowcase, saveShowcase } from '../helpers.js';
import type { AchievementDefinition } from '../engine/types.js';

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const C = '\x1b[36m';
const G = '\x1b[32m';

const RARITY_ORDER: Record<string, number> = {
  mythic: 5, legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0,
};

const RARITY_COLORS: Record<string, string> = {
  common: '\x1b[38;2;150;150;150m',
  uncommon: '\x1b[38;2;100;200;100m',
  rare: '\x1b[38;2;66;133;244m',
  epic: '\x1b[38;2;180;70;240m',
  legendary: '\x1b[38;2;255;140;0m',
  mythic: '\x1b[38;2;255;50;50m',
};

const SLOT_EMOJIS = ['❶', '❷', '❸', '❹', '❺', '❻'];

function createEngine(): AchievementEngine {
  const cfg = loadConfig();
  const stateDir = cfg.active_profile !== 'default' ? resolveProfileDir(cfg.active_profile) : undefined;
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  return engine;
}

function formatSlot(slot: number, aid: string | null, definitions: AchievementDefinition[]): string {
  const emoji = SLOT_EMOJIS[slot]!;
  if (!aid) return `  ${emoji}  ${D}— empty —${R}`;
  const def = definitions.find(d => d.id === aid);
  if (!def) return `  ${emoji}  ${aid} ${D}(unknown)${R}`;
  const color = RARITY_COLORS[def.rarity] || '';
  const icon = def.icon || '🏆';
  return `  ${emoji}  ${color}${icon} ${def.name}${R}  ${D}(${aid})${R}`;
}

function cmdList(): void {
  const engine = createEngine();
  const showcase = loadShowcase(engine.stateDir);

  const cfg = loadConfig();
  console.log(`\n${B}🎪 Showcase${R}  ${D}${cfg.active_profile}${R}\n`);

  if (showcase.slots.every(s => !s)) {
    console.log(`  ${D}All slots empty — use 'agpa showcase auto-fill' or 'agpa showcase pin <id> [slot]'${R}\n`);
    return;
  }

  for (let i = 0; i < 6; i++) {
    console.log(formatSlot(i, showcase.slots[i] ?? null, engine.definitions));
  }
  console.log('');
}

function cmdPin(id: string, slotArg?: string): void {
  const engine = createEngine();
  const showcase = loadShowcase(engine.stateDir);

  // Validate achievement exists and is unlocked
  const def = engine.definitions.find(d => d.id === id);
  if (!def) {
    console.error(`Achievement "${id}" not found. Use 'agpa search ${id}' to find it.`);
    process.exit(1);
  }
  if (!engine.state.unlocked[id]) {
    console.error(`Achievement "${def.name}" is not yet unlocked.`);
    process.exit(1);
  }

  let slot: number;
  if (slotArg !== undefined) {
    slot = parseInt(slotArg, 10);
    if (isNaN(slot) || slot < 1 || slot > 6) {
      console.error('Slot must be 1-6');
      process.exit(1);
    }
    slot -= 1; // 0-indexed
  } else {
    // Find first empty slot
    slot = showcase.slots.findIndex(s => !s);
    if (slot === -1) {
      console.error('All showcase slots are full. Specify a slot (1-6) to replace.');
      process.exit(1);
    }
  }

  showcase.slots[slot] = id;
  saveShowcase(engine.stateDir, showcase);

  const color = RARITY_COLORS[def.rarity] || '';
  const icon = def.icon || '🏆';
  console.log(`✅ Pinned ${color}${icon} ${def.name}${R} to slot ${SLOT_EMOJIS[slot]}`);
}

function cmdUnpin(slotArg: string): void {
  const engine = createEngine();
  const showcase = loadShowcase(engine.stateDir);

  const slot = parseInt(slotArg, 10);
  if (isNaN(slot) || slot < 1 || slot > 6) {
    console.error('Slot must be 1-6');
    process.exit(1);
  }

  const idx = slot - 1;
  const current = showcase.slots[idx];
  showcase.slots[idx] = null;
  saveShowcase(engine.stateDir, showcase);

  if (current) {
    console.log(`🗑 Cleared slot ${SLOT_EMOJIS[idx]}`);
  } else {
    console.log(`Slot ${SLOT_EMOJIS[idx]} was already empty`);
  }
}

function cmdAutoFill(): void {
  const engine = createEngine();
  const showcase = loadShowcase(engine.stateDir);

  // Get unlocked achievements sorted by rarity descending (rarest first)
  const unlocked = engine.definitions
    .filter(d => engine.state.unlocked[d.id])
    .sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));

  // Fill empty slots
  let filled = 0;
  const newSlots = [...showcase.slots];
  for (let i = 0; i < 6; i++) {
    if (!newSlots[i] && filled < unlocked.length) {
      newSlots[i] = unlocked[filled]!.id;
      filled++;
    }
  }

  showcase.slots = newSlots;
  saveShowcase(engine.stateDir, showcase);

  console.log(`🎪 Auto-filled ${filled} slot(s) with rarest unlocked achievements:`);
  for (let i = 0; i < 6; i++) {
    console.log(formatSlot(i, newSlots[i] ?? null, engine.definitions));
  }
  console.log('');
}

function main(): void {
  const args = process.argv.slice(3); // "agpa" "showcase" ...
  const cmd = args[0];

  switch (cmd) {
    case undefined:
    case 'list':
      cmdList();
      break;
    case 'pin':
      if (!args[1]) {
        console.error('Usage: agpa showcase pin <achievement_id> [slot]');
        process.exit(1);
      }
      cmdPin(args[1], args[2]);
      break;
    case 'unpin':
      if (!args[1]) {
        console.error('Usage: agpa showcase unpin <slot>  (1-6)');
        process.exit(1);
      }
      cmdUnpin(args[1]);
      break;
    case 'auto-fill':
      cmdAutoFill();
      break;
    default:
      console.error(`Unknown showcase command: "${cmd}"`);
      console.error('Usage: agpa showcase <list|pin|unpin|auto-fill>');
      process.exit(1);
  }
}

main();
