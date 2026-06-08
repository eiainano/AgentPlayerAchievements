#!/usr/bin/env -S npx tsx
/**
 * AGPA — Agent Player Achievements CLI
 *
 * Unified entry point for all agpa commands:
 *   agpa init       Auto-detect & configure AI tools
 *   agpa verify     Quick health check (= doctor --quick)
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
 *   agpa completion  Generate shell completion script
 *   agpa upgrade     Check for updates and upgrade
 *   agpa watch       Real-time achievement monitor
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

// ── Subcommand definitions ──────────────────────────────────────────────

interface Subcommand {
  name: string;
  description: string;
  usage?: string;
  module: string; // relative to this file
}

const COMMANDS: Subcommand[] = [
  { name: 'init',       description: 'Auto-detect & configure AI coding tools for achievement tracking', usage: 'agpa init [--tool <name>] [--profile <name>] [--auto]', module: './init.ts' },
  { name: 'uninstall',  description: 'Cleanly remove AGPA from all configured tools',                     usage: 'agpa uninstall [--all|--yes] [--dry-run] [--keep-data]', module: './uninstall.ts' },
  { name: 'verify',     description: 'Quick setup health check (= doctor --quick)',                        usage: 'agpa verify [--profile <name>]',            module: './doctor.ts' },
  { name: 'doctor',     description: 'Full system diagnosis',                                              usage: 'agpa doctor [--check <id>] [--quick] [--json]', module: './doctor.ts' },
  { name: 'config',     description: 'View or change AGPA settings',                                      usage: 'agpa config [key] [value]',                 module: './config.ts' },
  { name: 'dashboard',  description: 'Start achievement dashboard (default :3867)',                        usage: 'agpa dashboard [port] [--profile <name>]',   module: './dashboard.ts' },
  { name: 'web',        description: 'Alias for dashboard',                                                usage: 'agpa web [port] [--profile <name>]',         module: './dashboard.ts' },
  { name: 'profile',    description: 'Manage achievement profiles (create | list | switch)',               usage: 'agpa profile <create|list|switch> [name]',   module: './profile.ts' },
  { name: 'showcase',   description: 'Manage achievement showcase',                                        usage: 'agpa showcase <list|pin|unpin|auto-fill>',   module: './showcase.ts' },
  { name: 'demo',       description: 'Generate MVP demo data',                                             usage: 'agpa demo',                                 module: './mvp.ts' },
  { name: 'stats',      description: 'View achievement stats in terminal',                                 usage: 'agpa stats [--json] [--profile <name>]',    module: './mvp.ts' },
  { name: 'progress',   description: 'List all achievements with unlock status',                           usage: 'agpa progress [--json] [--profile <name>]', module: './mvp.ts' },
  { name: 'reset',      description: 'Reset all achievement data',                                         usage: 'agpa reset [--profile <name>]',             module: './mvp.ts' },
  { name: 'search',     description: 'Search achievements by keyword, rarity, or category',                usage: 'agpa search [query] [--rarity] [--category] [--unlocked|--locked] [--json] [--profile <name>]', module: './search.ts' },
  { name: 'suggest',    description: 'Show nearest unlockable achievements',                               usage: 'agpa suggest [--N <n>] [--all] [--hidden] [--json] [--profile <name>]', module: './suggest.ts' },
  { name: 'sound',      description: 'Toggle achievement sound effects (on | off)',                       usage: 'agpa sound <on|off>',                       module: './sound.ts' },
  { name: 'activity',   description: 'View coding streak & activity heatmap in terminal',                  usage: 'agpa activity [--streak|--heatmap|--compact] [--json] [--profile <name>]', module: './activity.ts' },
  { name: 'export',     description: 'Export achievement data to a portable JSON file',                     usage: 'agpa export [profile] [--output <path>] [--full] [--migrate]', module: './export.ts' },
  { name: 'import',     description: 'Import achievement data from a backup file',                          usage: 'agpa import <file> [--profile <name>] [--dry-run] [--force]', module: './import.ts' },
  { name: 'mcp',        description: 'Start MCP server (stdio)',                                           usage: 'agpa mcp',                                  module: '../main.ts' },
  { name: 'completion', description: 'Generate shell completion script (bash | zsh | fish)',               usage: 'agpa completion <bash|zsh|fish>',           module: './completion.ts' },
  { name: 'upgrade',    description: 'Check for updates and upgrade AGPA',                                 usage: 'agpa upgrade [--check]',                     module: './upgrade.ts' },
  { name: 'watch',      description: 'Real-time achievement progress monitor',                             usage: 'agpa watch [--poll <sec>] [--profile <name>]', module: './watch.ts' },
  { name: 'history',    description: 'Browse raw event log entries',                                       usage: 'agpa history [--N <n>] [--event <type>] [--today] [--json] [--profile <name>]', module: './history.ts' },
];

// ── Help ─────────────────────────────────────────────────────────────────

const COMMAND_GROUPS: Array<{ title: string; names: string[] }> = [
  { title: 'Setup',     names: ['init', 'uninstall', 'verify', 'doctor', 'config'] },
  { title: 'Dashboard', names: ['dashboard', 'web'] },
  { title: 'View',      names: ['stats', 'progress', 'activity', 'search', 'suggest'] },
  { title: 'Profiles',  names: ['profile', 'showcase'] },
  { title: 'Data',      names: ['export', 'import', 'reset'] },
  { title: 'Tools',     names: ['sound', 'mcp', 'completion', 'upgrade', 'watch', 'history'] },
];

function printHelp(): void {
  const nameWidth = Math.max(...COMMANDS.map(c => c.name.length)) + 2;

  console.log('🏆 AGPA — Agent Player Achievements');
  console.log('   gamified achievement tracking for AI coding tools\n');
  console.log('Usage: agpa <command> [options]\n');

  for (const group of COMMAND_GROUPS) {
    console.log(`  ${group.title}:`);
    for (const name of group.names) {
      const cmd = COMMANDS.find(c => c.name === name);
      if (cmd) {
        const padded = cmd.name.padEnd(nameWidth);
        console.log(`    ${padded}${cmd.description}`);
      }
    }
    console.log('');
  }

  console.log('Options:');
  console.log('  --help, -h     Show this help');
  console.log('  --version, -v  Print version');
  console.log('  (no args)       Interactive TUI mode\n');

  // Show version if we can read it
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`Version: ${pkg.version}`);
  } catch {
    // package.json not readable — skip version
  }

  console.log('\nGet started:  agpa init');
  console.log('Quick check:  agpa verify (alias for doctor --quick)');
  console.log('Diagnose:     agpa doctor (full system check + suggestions)');
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

    // verify is an alias for doctor --quick
    case 'verify':
      return ['agpa', 'agpa', 'doctor', '--quick', ...cmdArgs];

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

// ── Levenshtein distance ──────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0]![j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[bn]![an]!;
}

// ── Interactive TUI ───────────────────────────────────────────────────────

async function showTui(): Promise<void> {
  const D = '\x1b[2m';
  const B = '\x1b[1m';
  const G = '\x1b[32m';
  const C = '\x1b[36m';
  const Y = '\x1b[38;2;255;200;0m';
  const R = '\x1b[0m';

  // Read version
  let version = '0.1.x';
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    version = pkg.version;
  } catch { /* ok */ }

  // Quick stats from default profile (best-effort)
  let statsLine = '';
  try {
    const { AchievementEngine } = await import('../engine/engine.js');
    const engine = new AchievementEngine();
    engine.init();
    const s = engine.stats();
    statsLine = `${G}${s.unlocked}${R}/${s.total_achievements} unlocked  ·  ${s.total_events} events  ·  ${s.completion_pct}% complete`;
  } catch { /* no data yet */ }

  console.clear();
  process.stdout.write(`\n  ${Y}${B}    __ _  __ _ _ __   ___  __ _ _ __   ___    ${R}\n`);
  process.stdout.write(`  ${Y}${B}   / _\` |/ _\` | '_ \\ / _ \\/ _\` | '_ \\ / __|${R}\n`);
  process.stdout.write(`  ${Y}${B}  | (_| | (_| | |_) |  __/ (_| | | | | (__ ${R}\n`);
  process.stdout.write(`  ${Y}${B}   \\__, |\\__, | .__/ \\___|\\__,_|_| |_|\\___|${R}\n`);
  process.stdout.write(`  ${Y}${B}   __/ | __/ | |                           ${R}\n`);
  process.stdout.write(`  ${Y}${B}  |___/ |___/|_|                           ${R}\n`);
  process.stdout.write(`\n  ${D}Achievement tracking for AI coding agents  v${version}${R}\n`);
  if (statsLine) {
    process.stdout.write(`\n  ${statsLine}\n`);
  }
  process.stdout.write(`\n  ${C}Commands:${R}\n`);
  process.stdout.write(`    ${B}init${R}         ${D}Auto-detect & configure AI tools${R}\n`);
  process.stdout.write(`    ${B}dashboard${R}    ${D}Open achievement dashboard${R}\n`);
  process.stdout.write(`    ${B}stats${R}        ${D}View your achievement progress${R}\n`);
  process.stdout.write(`    ${B}doctor${R}       ${D}Diagnose system health${R}\n`);
  process.stdout.write(`    ${B}help${R}         ${D}Show all commands${R}\n`);
  process.stdout.write(`\n  ${G}Type a command or press Enter for dashboard${R}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question(`\n  ${C}agpa >${R} `, (answer: string) => {
    rl.close();
    const trimmed = answer.trim().toLowerCase();
    if (!trimmed || trimmed === 'dashboard' || trimmed === 'd') {
      dispatch('dashboard', []).catch(err => {
        console.error(`\n  \x1b[0m✖ dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      });
    } else if (trimmed === 'help' || trimmed === 'h' || trimmed === '?') {
      printHelp();
      process.exit(0);
    } else if (trimmed === 'init') {
      dispatch('init', []).catch(err => {
        console.error(`\n  \x1b[0m✖ dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      });
    } else if (trimmed === 'stats' || trimmed === 's') {
      dispatch('stats', []).catch(err => {
        console.error(`\n  \x1b[0m✖ dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      });
    } else if (trimmed === 'doctor') {
      dispatch('doctor', []).catch(err => {
        console.error(`\n  \x1b[0m✖ dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      });
    } else if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
      process.stdout.write(`\n  ${D}👋${R}\n\n`);
      process.exit(0);
    } else {
      const parts = trimmed.split(/\s+/);
      dispatch(parts[0]!, parts.slice(1)).catch(err => {
        console.error(`\n  \x1b[0m✖ dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      });
    }
  });
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle --help / -h (with or without command)
  if (args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  // Handle --version / -v
  if (args[0] === '--version' || args[0] === '-v') {
    printVersion();
    process.exit(0);
  }

  // No args → interactive TUI mode (only in TTY)
  if (args.length === 0) {
    if (process.stdin.isTTY) {
      await showTui();
    } else {
      printHelp();
    }
    return;
  }

  const cmdName = args[0]!;
  const cmdArgs = args.slice(1);

  // Check if it's a valid command
  const known = COMMANDS.find(c => c.name === cmdName);
  if (!known) {
    // Fuzzy match: suggest closest command
    let bestDist = Infinity;
    let bestName = '';
    for (const c of COMMANDS) {
      const dist = levenshtein(cmdName, c.name);
      if (dist < bestDist && dist <= 3) {
        bestDist = dist;
        bestName = c.name;
      }
    }
    if (bestName) {
      console.error(`Unknown command: "${cmdName}"`);
      console.error(`Did you mean "${bestName}"?`);
    } else {
      console.error(`Unknown command: "${cmdName}"`);
      console.error('Run "agpa --help" for available commands.');
    }
    process.exit(1);
  }

  dispatch(cmdName, cmdArgs);
}


main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
