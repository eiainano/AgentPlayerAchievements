#!/usr/bin/env -S npx tsx
/**
 * AGPA — Agent Player Achievements CLI
 *
 * Unified entry point for all agpa commands:
 *   agpa init       Auto-detect & configure AI tools
 *   agpa verify     Verify setup health
 *   agpa doctor     Diagnose system state
 *   agpa config     View/change settings
 *   agpa dashboard  Start web dashboard
 *   agpa web        Alias for dashboard
 *   agpa profile    Manage achievement profiles
 *   agpa showcase   Manage achievement showcase
 *   agpa demo       Generate MVP demo data
 *   agpa stats      View achievement stats
 *   agpa progress   List all achievements
 *   agpa search     Search achievements
 *   agpa suggest    Show nearest unlocks
 *   agpa activity   View streak & heatmap
 *   agpa sound      Toggle sound effects
 *   agpa export     Export achievement data
 *   agpa import     Import achievement data
 *   agpa reset      Reset all data
 *   agpa mcp        Start MCP server
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Subcommand definitions ──────────────────────────────────────────────

interface Subcommand {
  name: string;
  description: string;
  usage?: string;
  module: string; // relative to this file
}

const COMMANDS: Subcommand[] = [
  { name: 'init',       description: 'Auto-detect & configure AI coding tools for achievement tracking', usage: 'agpa init [--tool <name>] [--profile <name>]', module: './init.ts' },
  { name: 'verify',     description: 'Verify AGPA setup — 7 health checks',                               usage: 'agpa verify',                               module: './verify.ts' },
  { name: 'doctor',     description: 'Full system diagnosis',                                              usage: 'agpa doctor [--check <id>] [--json]',       module: './doctor.ts' },
  { name: 'config',     description: 'View or change AGPA settings',                                      usage: 'agpa config [key] [value]',                 module: './config.ts' },
  { name: 'dashboard',  description: 'Start achievement dashboard (default :3867)',                        usage: 'agpa dashboard [port] [--profile <name>]',   module: './dashboard.ts' },
  { name: 'web',        description: 'Alias for dashboard',                                                usage: 'agpa web [port] [--profile <name>]',         module: './dashboard.ts' },
  { name: 'profile',    description: 'Manage achievement profiles (create | list | switch)',               usage: 'agpa profile <create|list|switch> [name]',   module: './profile.ts' },
  { name: 'showcase',   description: 'Manage achievement showcase',                                        usage: 'agpa showcase <list|pin|unpin|auto-fill>',   module: './showcase.ts' },
  { name: 'demo',       description: 'Generate MVP demo data',                                             usage: 'agpa demo',                                 module: './mvp.ts' },
  { name: 'stats',      description: 'View achievement stats in terminal',                                 usage: 'agpa stats',                                module: './mvp.ts' },
  { name: 'progress',   description: 'List all achievements with unlock status',                           usage: 'agpa progress',                             module: './mvp.ts' },
  { name: 'reset',      description: 'Reset all achievement data',                                         usage: 'agpa reset',                                module: './mvp.ts' },
  { name: 'search',     description: 'Search achievements by keyword, rarity, or category',                usage: 'agpa search [query] [--rarity] [--category] [--unlocked]', module: './search.ts' },
  { name: 'suggest',    description: 'Show nearest unlockable achievements',                               usage: 'agpa suggest [--N <n>] [--all] [--hidden]', module: './suggest.ts' },
  { name: 'sound',      description: 'Toggle achievement sound effects (on | off)',                       usage: 'agpa sound <on|off>',                       module: './sound.ts' },
  { name: 'activity',   description: 'View coding streak & activity heatmap in terminal',                  usage: 'agpa activity [--streak|--heatmap|--compact]', module: './activity.ts' },
  { name: 'export',     description: 'Export achievement data to a portable JSON file',                     usage: 'agpa export [profile] [--output <path>] [--full] [--migrate]', module: './export.ts' },
  { name: 'import',     description: 'Import achievement data from a backup file',                          usage: 'agpa import <file> [--profile <name>] [--dry-run] [--force]', module: './import.ts' },
  { name: 'mcp',        description: 'Start MCP server (stdio)',                                           usage: 'agpa mcp',                                  module: '../main.ts' },
];

// ── Help ─────────────────────────────────────────────────────────────────

function printHelp(): void {
  const nameWidth = Math.max(...COMMANDS.map(c => c.name.length)) + 2;

  console.log('🏆 AGPA — Agent Player Achievements');
  console.log('   gamified achievement tracking for AI coding tools\n');
  console.log('Usage: agpa <command> [options]\n');
  console.log('Commands:');

  for (const cmd of COMMANDS) {
    const padded = cmd.name.padEnd(nameWidth);
    console.log(`  ${padded}${cmd.description}`);
  }

  console.log('\nOptions:');
  console.log('  --help, -h     Show this help');
  console.log('  --version, -v  Print version');

  // Show version if we can read it
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`\nVersion: ${pkg.version}`);
  } catch {
    // package.json not readable — skip version
  }

  console.log('\nGet started:  agpa init');
  console.log('Verify setup: agpa verify');
}

function printVersion(): void {
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(pkg.version);
  } catch {
    console.log('unknown');
  }
}

// ── Dispatch ─────────────────────────────────────────────────────────────

/**
 * Build process.argv for the target script.
 *
 * Each CLI script parses argv differently:
 *   - init/doctor/dashboard: use slice(2) for flags → cmdName at [2] is fine
 *   - mvp.ts (demo/stats/progress/reset): reads argv[2] directly as subcommand
 *   - profile.ts: reads slice(2) and expects create/list at args[0] → strip "profile"
 *   - main.ts (mcp): no argv parsing, just runs
 */
function buildArgv(cmdName: string, cmdArgs: string[]): string[] {
  switch (cmdName) {
    // mvp.ts: const cmd = process.argv[2] || 'demo'
    case 'demo':
    case 'stats':
    case 'progress':
    case 'reset':
      return ['agpa', 'agpa', cmdName, ...cmdArgs];

    // profile.ts: const args = process.argv.slice(2); switch(args[0])
    // args[0] must be "create" or "list", not "profile"
    case 'profile':
      return ['agpa', 'agpa', ...cmdArgs];

    // All others: slice(2) for flags, cmdName at [2] is harmless
    default:
      return ['agpa', 'agpa', cmdName, ...cmdArgs];
  }
}

async function dispatch(cmdName: string, cmdArgs: string[]): Promise<void> {
  const cmd = COMMANDS.find(c => c.name === cmdName);
  if (!cmd) {
    console.error(`Unknown command: "${cmdName}"`);
    console.error('Run "agpa --help" for available commands.');
    process.exit(1);
  }

  // Swap process.argv so the imported module sees the right args
  const originalArgv = process.argv;
  process.argv = buildArgv(cmdName, cmdArgs);

  try {
    await import(cmd.module);
  } finally {
    process.argv = originalArgv;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  // Handle --help / -h (with or without command)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  // Handle --version / -v
  if (args[0] === '--version' || args[0] === '-v') {
    printVersion();
    process.exit(0);
  }

  const cmdName = args[0]!;
  const cmdArgs = args.slice(1);

  dispatch(cmdName, cmdArgs);
}

main();
