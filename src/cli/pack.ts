#!/usr/bin/env -S npx tsx
/**
 * AGPA Pack Commands
 *
 *   agpa pack list         — List all installed community packs
 *   agpa pack info <id>    — Show pack details + achievements
 */

import { AchievementEngine } from '../engine/engine.js';

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function printPackList(engine: AchievementEngine): void {
  const packs = engine.packs;
  if (packs.length === 0) {
    console.log(`\n  ${DIM}No community packs installed.${RESET}`);
    console.log(`  ${DIM}Drop .yaml files into ~/.agent-achievements/packs/ to install.${RESET}\n`);
    return;
  }

  console.log(`\n  ${BOLD}Installed Community Packs${RESET}  ${DIM}(${packs.length})${RESET}\n`);

  for (const p of packs) {
    const count = engine.packDefinitions.filter(d => d.pack_id === p.id).length;
    const unlocked = engine.packDefinitions.filter(
      d => d.pack_id === p.id && engine.state.unlocked[d.id],
    ).length;
    const pct = count > 0 ? Math.round((unlocked / count) * 100) : 0;

    console.log(`  ${CYAN}${p.name}${RESET}  ${DIM}(${p.id})${RESET}`);
    console.log(`    by ${p.author}  ·  v${p.version}`);
    if (p.description) console.log(`    ${p.description}`);
    console.log(`    ${GREEN}${unlocked}${RESET}/${count} unlocked  ${DIM}(${pct}%)${RESET}`);
    console.log('');
  }
}

function printPackInfo(engine: AchievementEngine, packId: string): void {
  const info = engine.getPackInfo(packId);

  if (!info) {
    console.error(`\n  ${YELLOW}Pack "${packId}" not found.${RESET}`);
    console.error(`  ${DIM}Run "agpa pack list" to see available packs.${RESET}\n`);
    process.exit(1);
  }

  const { pack, definitions } = info;

  console.log(`\n  ${BOLD}${pack.name}${RESET}  ${DIM}(${pack.id})${RESET}`);
  console.log(`  by ${pack.author}  ·  v${pack.version}`);
  if (pack.description) console.log(`  ${pack.description}`);

  const unlocked = definitions.filter(d => engine.state.unlocked[d.id]).length;
  const pct = definitions.length > 0 ? Math.round((unlocked / definitions.length) * 100) : 0;
  console.log(`  ${GREEN}${unlocked}${RESET}/${definitions.length} unlocked  ${DIM}(${pct}%)${RESET}`);

  if (definitions.length > 0) {
    console.log(`\n  ${BOLD}Achievements:${RESET}`);
    for (const def of definitions) {
      const status = engine.state.unlocked[def.id] ? '✅' : '  ';
      const rarityColors: Record<string, string> = {
        common: '\x1b[36m', uncommon: '\x1b[34m', rare: '\x1b[33m',
        epic: '\x1b[38;2;255;165;0m', legendary: '\x1b[35m', mythic: '\x1b[31m',
      };
      const rarityColor = rarityColors[def.rarity] || '';
      const rarityLabel = def.hidden ? `${def.rarity} 🔒` : def.rarity;
      console.log(`  ${status} ${def.icon} ${BOLD}${def.name}${RESET} ${DIM}(${def.id})${RESET}`);
      console.log(`    ${rarityColor}${rarityLabel}${RESET}  ·  ${def.description}`);
    }
    console.log('');
  } else {
    console.log(`  ${DIM}(no achievements)${RESET}\n`);
  }
}

function printHelp(): void {
  console.log(`\n  ${BOLD}Usage:${RESET}`);
  console.log('    agpa pack list              List all installed packs');
  console.log('    agpa pack info <id>         Show pack details');
  console.log('');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcmd = args[0];

  if (!subcmd || subcmd === '--help' || subcmd === '-h') {
    printHelp();
    process.exit(0);
  }

  // Create engine and load core + packs
  const engine = new AchievementEngine();
  engine.init();

  switch (subcmd) {
    case 'list': {
      printPackList(engine);
      break;
    }

    case 'info': {
      const packId = args[1];
      if (!packId) {
        console.error(`${YELLOW}Usage: agpa pack info <id>${RESET}`);
        process.exit(1);
      }
      printPackInfo(engine, packId);
      break;
    }

    default: {
      console.error(`${YELLOW}Unknown pack subcommand: "${subcmd}"${RESET}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(`pack command failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
