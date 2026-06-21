#!/usr/bin/env node
/**
 * AGPA Shell Completion — generate autocompletion scripts for bash, zsh, fish
 *
 * Usage:
 *   agpa completion bash  →  source <(agpa completion bash)
 *   agpa completion zsh
 *   agpa completion fish
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Command catalog (must match index.ts COMMANDS) ──────────────────────

interface CmdInfo {
  name: string;
  description: string;
  flags?: string[];
  subcommands?: string[];
  takesValue?: string[]; // flags that take a value argument
}

const COMMANDS: CmdInfo[] = [
  { name: 'init',       description: 'Auto-detect & configure AI coding tools',       flags: ['--tool', '--profile', '--auto', '--upgrade', '--help'], takesValue: ['--tool', '--profile'] },
  { name: 'uninstall',  description: 'Cleanly remove AGPA from all configured tools', flags: ['--all', '--dry-run', '--keep-data', '--yes', '--help'] },
  { name: 'verify',     description: 'Verify AGPA setup — 7 health checks',           flags: ['--profile', '--help'],                                takesValue: ['--profile'] },
  { name: 'doctor',     description: 'Full system diagnosis',                          flags: ['--check', '--json', '--quick', '--help'],             takesValue: ['--check'] },
  { name: 'config',     description: 'View or change AGPA settings',                  flags: ['--help'] },
  { name: 'dashboard',  description: 'Start achievement dashboard',                   flags: ['--profile', '--help'],                                takesValue: ['--profile'] },
  { name: 'web',        description: 'Alias for dashboard',                           flags: ['--profile', '--help'],                                takesValue: ['--profile'] },
  { name: 'profile',    description: 'Manage achievement profiles',                    subcommands: ['create', 'list', 'switch', 'tools', 'delete'] },
  { name: 'showcase',   description: 'Manage achievement showcase',                    subcommands: ['list', 'pin', 'unpin', 'auto-fill'] },
  { name: 'demo',       description: 'Generate MVP demo data',                        flags: ['--help'] },
  { name: 'stats',      description: 'View achievement stats in terminal',            flags: ['--json', '--profile', '--help'],                     takesValue: ['--profile'] },
  { name: 'progress',   description: 'List all achievements with unlock status',      flags: ['--json', '--profile', '--help'],                     takesValue: ['--profile'] },
  { name: 'reset',      description: 'Reset all achievement data',                    flags: ['--profile', '--help'],                                takesValue: ['--profile'] },
  { name: 'search',     description: 'Search achievements by keyword/rarity/category', flags: ['--rarity', '--category', '--unlocked', '--locked', '--json', '--profile', '--help'], takesValue: ['--rarity', '--category', '--profile'] },
  { name: 'suggest',    description: 'Show nearest unlockable achievements',          flags: ['--N', '--all', '--hidden', '--json', '--profile', '--help'], takesValue: ['--N', '--profile'] },
  { name: 'sound',      description: 'Toggle achievement sound effects',              subcommands: ['on', 'off'] },
  { name: 'banner',     description: 'Switch banner color theme',                     subcommands: ['Neon', 'Arcade', 'Gold'] },
  { name: 'activity',   description: 'View coding streak & activity heatmap',        flags: ['--streak', '--heatmap', '--compact', '--json', '--profile', '--help'], takesValue: ['--profile'] },
  { name: 'export',     description: 'Export achievement data to JSON',               flags: ['--output', '--full', '--migrate', '--help'],          takesValue: ['--output'] },
  { name: 'import',     description: 'Import achievement data from backup',           flags: ['--profile', '--dry-run', '--force', '--help'],        takesValue: ['--profile'] },
  { name: 'mcp',        description: 'Start MCP server (stdio)',                      flags: ['--help'] },
  { name: 'completion', description: 'Generate shell completion script',              subcommands: ['bash', 'zsh', 'fish'] },
  { name: 'upgrade',    description: 'Check for updates and upgrade AGPA',            flags: ['--check', '--help'] },
  { name: 'watch',      description: 'Real-time achievement monitor',                 flags: ['--poll', '--profile', '--help'],                       takesValue: ['--poll', '--profile'] },
  { name: 'history',    description: 'Browse raw event log entries',                    flags: ['--N', '--event', '--today', '--json', '--profile', '--help'], takesValue: ['--N', '--event', '--profile'] },
  { name: 'explain',    description: 'Show why an achievement is locked/unlocked',   flags: ['--json', '--profile', '--help'], takesValue: ['--profile'] },
  { name: 'pack',       description: 'List or inspect community achievement packs',  subcommands: ['list', 'info'] },
];

// ── Short aliases (same as index.ts) ────────────────────────────────────

const ALIASES: Record<string, string> = {
  cc: 'claude-code',
  kilo: 'kilocode',
  ha: 'hermes',
  oc: 'opencode',
  claw: 'openclaw',
};

// Flags shared by many commands
const SHARED_FLAGS = ['--help', '-h'];
const GLOBAL_FLAGS = ['--help', '-h', '--version', '-v'];

// ── Bash completion ─────────────────────────────────────────────────────

function generateBash(): string {
  const cmdNames = COMMANDS.map(c => c.name).join(' ');
  const subcmdDefs = COMMANDS
    .filter(c => c.subcommands)
    .map(c => `    ${c.name})\n      COMPREPLY=( $(compgen -W "${c.subcommands!.join(' ')}" -- "$cur") )\n      return 0\n      ;;`)
    .join('\n');

  // Build per-command flag completions
  const flagCases = COMMANDS.map(c => {
    if (!c.flags || c.flags.length === 0) return `    ${c.name})\n      COMPREPLY=()\n      return 0\n      ;;`;
    return `    ${c.name})\n      COMPREPLY=( $(compgen -W "${c.flags.join(' ')}" -- "$cur") )\n      return 0\n      ;;`;
  }).join('\n');

  return `# AGPA bash completion — source this file or add to ~/.bash_completion
_agpa() {
  local cur prev words cword
  _init_completion || return

  if (( cword == 1 )); then
    COMPREPLY=( $(compgen -W "${cmdNames} ${SHARED_FLAGS.join(' ')}" -- "$cur") )
    return 0
  fi

  local cmd="\${words[1]}"
  case "$cmd" in
${subcmdDefs}
${flagCases}
    *)
      COMPREPLY=()
      return 0
      ;;
  esac
}

complete -F _agpa agpa
`;
}

// ── Zsh completion ──────────────────────────────────────────────────────

function generateZsh(): string {
  // For each command, build the case branch with subcommands and/or flags.
  const cmdBranches = COMMANDS.map(c => {
    const parts: string[] = [];
    if (c.subcommands) {
      parts.push(`          _values "subcommand" ${c.subcommands.join(' ')}`);
    }
    if (c.flags && c.flags.length > 0) {
      const flagList = c.flags
        .filter(f => !SHARED_FLAGS.includes(f))
        .map(f => {
          if (c.takesValue?.includes(f)) return `'${f}[${c.description}]:value:'`;
          return `'${f}[${c.description}]'`;
        }).join(' \\\n            ');
      if (flagList) {
        parts.push(`          _arguments -s \\\n            ${flagList}`);
      }
    }
    if (parts.length === 0) return `        ${c.name})\n          _default ;;`;
    const body = parts.map(p => p + ' ;;').join('\n');
    return `        ${c.name})\n${body}`;
  }).join('\n');

  return `#compdef agpa
# AGPA zsh completion — place in a directory on $fpath

_agpa() {
  local -a commands
  commands=(
${COMMANDS.map(c => `    '${c.name}:${c.description}'`).join('\n')}
  )

  _arguments -C \\
    '--help[Show help]' \\
    '-h[Show help]' \\
    '--version[Print version]' \\
    '-v[Print version]' \\
    '1: :_values "command" \\$commands[@]' \\
    '*:: :->args'

  case "$state" in
    args)
      case "$words[1]" in
${cmdBranches}
        *)
          _default ;;
      esac
      ;;
  esac
}

_agpa "$@"
`;
}

// ── Fish completion ─────────────────────────────────────────────────────

function generateFish(): string {
  const cmdDefs = COMMANDS.map(c => {
    const completes: string[] = [];
    if (c.subcommands) {
      completes.push(`complete -c agpa -n "__fish_seen_subcommand_from ${c.name}" -a "${c.subcommands.join(' ')}"`);
    }
    if (c.flags) {
      for (const f of c.flags) {
        if (c.takesValue?.includes(f)) {
          completes.push(`complete -c agpa -n "__fish_seen_subcommand_from ${c.name}" -s '${f.replace('--', '')}' -l '${f.replace('--', '')}' -r -d '${c.description}'`);
        } else {
          completes.push(`complete -c agpa -n "__fish_seen_subcommand_from ${c.name}" -l '${f.replace('--', '')}' -d '${c.description}'`);
        }
      }
    }
    return completes.join('\n');
  }).filter(Boolean).join('\n');

  return `# AGPA fish completion
# Place in ~/.config/fish/completions/agpa.fish
# Or run: agpa completion fish > ~/.config/fish/completions/agpa.fish

# Main commands
${COMMANDS.map(c => `complete -c agpa -n "not __fish_seen_subcommand_from ${COMMANDS.map(x => x.name).join(' ')}" -a '${c.name}' -d '${c.description}'`).join('\n')}

# Subcommands
${COMMANDS.filter(c => c.subcommands).map(c => `complete -c agpa -n "__fish_seen_subcommand_from ${c.name}" -a "${c.subcommands!.join(' ')}"`).join('\n')}

# Flags per command
${cmdDefs}

# Global flags
complete -c agpa -l help -d 'Show help'
complete -c agpa -s h -d 'Show help'
complete -c agpa -l version -d 'Print version'
complete -c agpa -s v -d 'Print version'
`;
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const rawArgs = process.argv.slice(2);
  // When invoked via agpa index.ts, argv[2] is 'completion' followed by the shell name.
  // When invoked directly, argv[2] is the shell name.
  const args = rawArgs[0] === 'completion' ? rawArgs.slice(1) : rawArgs;
  const shell = args[0];

  if (!shell || !['bash', 'zsh', 'fish'].includes(shell)) {
    console.log('Usage: agpa completion <bash|zsh|fish>');
    console.log('');
    console.log('Examples:');
    console.log('  source <(agpa completion bash)       # Activate for current session');
    console.log('  agpa completion bash > ~/.bash_completion.d/agpa  # Permanent install');
    console.log('  agpa completion zsh > ~/.zsh/completions/_agpa');
    console.log('  agpa completion fish > ~/.config/fish/completions/agpa.fish');
    process.exit(1);
  }

  switch (shell) {
    case 'bash': console.log(generateBash()); break;
    case 'zsh':  console.log(generateZsh());  break;
    case 'fish': console.log(generateFish()); break;
  }
}

main();
