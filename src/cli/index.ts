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
import figlet from 'figlet';

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
  { name: 'profile',    description: 'Manage achievement profiles (create | list | switch | softwares)',               usage: 'agpa profile <create|list|switch|softwares> [name]',   module: './profile.ts' },
  { name: 'showcase',   description: 'Manage achievement showcase',                                        usage: 'agpa showcase <list|pin|unpin|auto-fill>',   module: './showcase.ts' },
  { name: 'demo',       description: 'Simulate 1-day usage with 5 achievements + open Dashboard',           usage: 'agpa demo',                                 module: './demo.ts' },
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

  console.log(renderBanner(termWidth(), getVersion()));

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

  console.log(`Version: ${getVersion()}`);

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

// ── Banner (figlet Slant font + cyberpunk neon gradient) ──────────────

const NEON_GRADIENT = [
  '\x1b[38;2;0;255;255m',   // #00FFFF cyan
  '\x1b[38;2;0;220;255m',   // #00DCFF
  '\x1b[38;2;77;180;255m',  // #4DB4FF
  '\x1b[38;2;150;80;255m',  // #9650FF
  '\x1b[38;2;220;50;220m',  // #DC32DC magenta
  '\x1b[38;2;255;0;170m',   // #FF00AA hot pink
] as const;

function visualWidth(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function getVersion(): string {
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.1.x';
  }
}

function termWidth(): number {
  if (process.stdout.columns) return process.stdout.columns;
  const envCols = parseInt(process.env.COLUMNS || '', 10);
  if (envCols > 0) return envCols;
  return 80;
}

function renderBanner(width: number, version: string): string {
  const DIM = '\x1b[2m';
  const RST = '\x1b[0m';
  const CY = '\x1b[38;2;0;255;255m';
  const MG = '\x1b[38;2;255;0;170m';
  const W = '\x1b[38;2;230;240;255m';   // off-white (neon tube glow)

  if (width < 60) {
    return `\n${CY}▸ AGPA — Agent Player Achievements${RST}  ${DIM}v${version}${RST}\n`;
  }

  const isCompact = width < 85;

  // ── Figlet art ───────────────────────────────────────────────────
  let artRaw: string;
  try {
    artRaw = figlet.textSync('AGPA', {
      font: isCompact ? 'Italic' : 'Slant',
      horizontalLayout: 'default',
    });
  } catch {
    return `\n${CY}▸ AGPA — Agent Player Achievements${RST}  ${DIM}v${version}${RST}\n`;
  }

  const artLines = artRaw.split('\n').filter(l => l.trim().length > 0);

  // ── Neon reflection effect ───────────────────────────────────────
  // Primary: off-white (neon tube glow)
  // Reflection below: dim colored copy (light spilling on wet asphalt)
  const artW = Math.max(...artLines.map(l => l.length));
  const reflection = artLines.map((line, i) => {
    const colorIdx = Math.min(i, NEON_GRADIENT.length - 1);
    return {
      glow: `${W}${line}${RST}`,
      refl: `${DIM}${NEON_GRADIENT[colorIdx]}${line}${RST}`,
    };
  });

  // Separator: thin sparkle line matching art width
  const sepLine = `${DIM}${CY}${'▁'.repeat(artW)}${RST}`;

  // ── Subtitle ─────────────────────────────────────────────────────
  const desc = !isCompact
    ? `  ${DIM}gamified achievement tracking for AI coding tools${RST}  ${CY}▸ ${DIM}v${version}${RST}`
    : `  ${DIM}v${version}${RST}`;
  const repo = !isCompact
    ? `  ${DIM}github.com/eiainano/AgentPlayerAchievements${RST}`
    : '';

  // ── Assemble ─────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('');

  // Glow
  for (const rl of reflection) lines.push(`  ${rl.glow}`);

  // Separator + reflection
  lines.push(`  ${sepLine}`);
  for (const rl of reflection) lines.push(`  ${rl.refl}`);

  // Subtitle
  lines.push('');
  lines.push(desc);
  if (repo) lines.push(repo);
  lines.push('');

  // ── Center in terminal ───────────────────────────────────────────
  const maxW = Math.max(...lines.map(l => visualWidth(l)));
  const leftPad = Math.max(0, Math.floor((width - maxW) / 2));
  const centered = lines.map(l => ' '.repeat(leftPad) + l);

  return '\n' + centered.join('\n') + '\n';
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
  const R = '\x1b[0m';

  const version = getVersion();

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
  process.stdout.write(renderBanner(termWidth(), version));
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
  process.stdout.write(`  ${D}⭐ Star on GitHub → https://github.com/eiainano/AgentPlayerAchievements${R}\n`);

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


// Only run main() when this file is the entry point (not when imported by tests)
const argv1 = process.argv[1] || '';
if (argv1.endsWith('index.ts') || argv1.endsWith('index.js')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

// Exported for testing
export { renderBanner, getVersion };
