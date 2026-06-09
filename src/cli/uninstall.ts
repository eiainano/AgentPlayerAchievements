#!/usr/bin/env node
/**
 * AGPA Uninstall — cleanly remove AGPA traces from AI coding tools.
 *
 * Usage:
 *   agpa uninstall                  Interactive: show found traces, confirm before removing
 *   agpa uninstall --all            Remove everything without prompts
 *   agpa uninstall --yes            Same as --all (for scripting)
 *   agpa uninstall --dry-run        Show what would be removed (no changes)
 *   agpa uninstall --keep-data      Remove configs only, keep ~/.agent-achievements/
 *   agpa uninstall --tool <name>    Remove config for a specific tool only
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { homedir } from 'node:os';
import { TOOLS, INSTRUCTION_FILES, findTool } from '../tool-registry.js';
import { uninstallDaemon, isDaemonInstalled } from './daemon.js';
import { checkDataDir, checkStateJson, checkDefsYaml, checkMcpConfigs, checkInstructionFiles } from './doctor.js';

const HOME = homedir();
const AGPA_DIR = path.join(HOME, '.agent-achievements');

const R = '\x1b[0m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const D = '\x1b[2m';
const B = '\x1b[1m';

// ── Helpers ────────────────────────────────────────────────────────────

interface RemovalAction {
  label: string;
  file: string;
  remove: () => boolean;   // returns true if something was removed
}

let dryRun = false;

function log(msg: string): void {
  console.log(msg);
}

function removeFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  if (dryRun) {
    log(`  ${D}would remove${R} ${filePath}`);
    return false;
  }
  fs.unlinkSync(filePath);
  log(`  ${G}✓${R} removed ${filePath}`);
  return true;
}

// ── MCP config cleanup (JSON files) ────────────────────────────────────

export function removeMcpFromJson(raw: string): { cleaned: string; removed: boolean } {
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(raw); } catch { return { cleaned: raw, removed: false }; }

  let removed = false;

  // CC uses mcpServers
  if (obj.mcpServers && typeof obj.mcpServers === 'object') {
    const servers = obj.mcpServers as Record<string, unknown>;
    if (servers['agent-achievements']) {
      delete servers['agent-achievements'];
      removed = true;
      if (Object.keys(servers).length === 0) delete obj.mcpServers;
    }
  }
  // Kilo/OpenCode use mcp
  if (obj.mcp && typeof obj.mcp === 'object') {
    const mcp = obj.mcp as Record<string, unknown>;
    if (mcp['agent-achievements']) {
      delete mcp['agent-achievements'];
      removed = true;
      if (Object.keys(mcp).length === 0) delete obj.mcp;
    }
    // OpenClaw nested: mcp.servers
    if (mcp.servers && typeof mcp.servers === 'object') {
      const servers = mcp.servers as Record<string, unknown>;
      if (servers['agent-achievements']) {
        delete servers['agent-achievements'];
        removed = true;
        if (Object.keys(servers).length === 0) delete mcp.servers;
      }
    }
  }

  return { cleaned: JSON.stringify(obj, null, 2) + '\n', removed };
}

// ── CC hooks cleanup ───────────────────────────────────────────────────

export function removeCcHooks(raw: string): { cleaned: string; removed: boolean } {
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(raw); } catch { return { cleaned: raw, removed: false }; }
  if (!obj.hooks || typeof obj.hooks !== 'object') return { cleaned: raw, removed: false };

  const hooks = obj.hooks as Record<string, unknown>;
  let removed = false;

  for (const key of Object.keys(hooks)) {
    const matchers = hooks[key] as Array<Record<string, unknown>>;
    if (!Array.isArray(matchers)) continue;

    for (const m of matchers) {
      if (!Array.isArray(m.hooks)) continue;
      const beforeLen = (m.hooks as Array<unknown>).length;
      m.hooks = (m.hooks as Array<Record<string, unknown>>).filter(h => {
        if (h.type !== 'command') return true;
        const cmd = h.command as string;
        // Remove commands that spawn the AGPA hook
        return !cmd.includes('AGPA_TOOL_SOURCE=claude-code') &&
               !cmd.includes('agpa-achievement');
      });
      if ((m.hooks as Array<unknown>).length < beforeLen) removed = true;
    }
    // Clean up empty matchers
    hooks[key] = matchers.filter(m => Array.isArray(m.hooks) && (m.hooks as Array<unknown>).length > 0)
      .map(m => ({ matcher: m.matcher, hooks: m.hooks }));
    if ((hooks[key] as Array<unknown>).length === 0) delete hooks[key];
  }

  if (Object.keys(hooks).length === 0) delete obj.hooks;
  return { cleaned: JSON.stringify(obj, null, 2) + '\n', removed };
}

// ── YAML hooks cleanup (Hermes) ────────────────────────────────────────

export function removeHermesHooks(raw: string): { cleaned: string; removed: boolean } {
  const marker = '# ── AGPA Hermes auto-track hooks (agpa-hermes-hook) ──';
  if (!raw.includes(marker)) return { cleaned: raw, removed: false };

  const lines = raw.split('\n');
  let inAgpaBlock = false;
  let hooksAutoAccept = false;
  const out: string[] = [];

  for (const line of lines) {
    if (line.includes('agpa-hermes-hook')) {
      inAgpaBlock = true;
      continue;
    }
    if (inAgpaBlock) {
      // Hermes hook entries are indented under the marker
      // We exit the block when we hit a non-indented, non-empty line
      if (line.trim() === '') continue;
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        inAgpaBlock = false;
        out.push(line);
      }
      // Also catch the hooks_auto_accept line
      if (line.trim() === 'hooks_auto_accept: true') {
        hooksAutoAccept = true;
        continue;
      }
      continue;
    }
    out.push(line);
  }

  return { cleaned: out.join('\n'), removed: true };
}

// ── YAML MCP config cleanup (Hermes) ──────────────────────────────────

/**
 * Remove the agent-achievements MCP server entry from a YAML config file.
 * Handles the mcp_servers: block that injectYamlMCPBlock() creates.
 *
 * The block structure:
 *   mcp_servers:
 *     agent-achievements:
 *       command: "tsx"
 *       args: ["/path/to/main.ts"]
 *       enabled: true
 *       env: ...          (optional)
 *
 * After removal, if mcp_servers: has no remaining children, the mcp_servers:
 * key itself is also removed to leave the config clean.
 */
export function removeYamlMcpBlock(raw: string): { cleaned: string; removed: boolean } {
  if (!raw.includes('agent-achievements')) return { cleaned: raw, removed: false };

  const lines = raw.split('\n');
  const out: string[] = [];
  let inBlock = false;
  let blockIndent = 0;
  let mcpServersLineIdx = -1;
  let removed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === 'agent-achievements:') {
      inBlock = true;
      blockIndent = line.length - trimmed.length;
      removed = true;
      continue;
    }

    if (inBlock) {
      const indent = line.length - trimmed.length;
      // Blank lines inside the block: skip
      if (trimmed === '') continue;
      // Line at same or lower indentation → we've exited the block
      if (indent <= blockIndent) {
        inBlock = false;
        out.push(line);
      }
      // Otherwise still inside the block, skip
      continue;
    }

    // Track mcp_servers: line index for cleanup
    if (/^mcp_servers:/.test(line)) {
      mcpServersLineIdx = out.length;
    }

    out.push(line);
  }

  if (!removed) return { cleaned: raw, removed: false };

  // Clean up: if mcp_servers: has no children left, remove it too
  if (mcpServersLineIdx >= 0) {
    let hasChildren = false;
    for (let i = mcpServersLineIdx + 1; i < out.length; i++) {
      const l = out[i]!;
      if (l.trim() === '') continue;
      if (l.startsWith('  ')) { hasChildren = true; break; }
      break; // next top-level key — no children
    }
    if (!hasChildren) {
      // Remove mcp_servers: line
      out.splice(mcpServersLineIdx, 1);
      // Clean up trailing blank lines left by removal
      while (mcpServersLineIdx < out.length && out[mcpServersLineIdx]?.trim() === '') {
        out.splice(mcpServersLineIdx, 1);
      }
    }
  }

  return { cleaned: out.join('\n'), removed: true };
}

// ── Instruction block cleanup ──────────────────────────────────────────

export function removeInstructionBlock(raw: string): { cleaned: string; removed: boolean } {
  const openMarker = '<!-- AGPA ACHIEVEMENT TRACKING -->';
  const closeMarker = '<!-- /AGPA ACHIEVEMENT TRACKING -->';
  if (!raw.includes(openMarker)) return { cleaned: raw, removed: false };

  const startIdx = raw.indexOf(openMarker);
  const endIdx = raw.indexOf(closeMarker);
  if (startIdx === -1) return { cleaned: raw, removed: false };

  const before = raw.slice(0, startIdx).replace(/\n*$/, '\n');
  const after = endIdx !== -1
    ? raw.slice(endIdx + closeMarker.length).replace(/^\n+/, '\n')
    : raw.slice(startIdx + openMarker.length).replace(/^\n+/, '\n');

  return { cleaned: (before + after).trimEnd() + '\n', removed: true };
}

// ── Removal actions ────────────────────────────────────────────────────

function buildActions(filterTool?: string | null): RemovalAction[] {
  const actions: RemovalAction[] = [];

  // 1. MCP configs (all 5 tools) — dispatch YAML vs JSON cleanup
  for (const t of TOOLS) {
    if (filterTool && t.id !== filterTool) continue;

    const isYaml = t.configFormat === 'yaml';
    actions.push({
      label: `MCP config: ${t.name}`,
      file: t.configPath,
      remove() {
        if (!fs.existsSync(t.configPath)) return false;
        const raw = fs.readFileSync(t.configPath, 'utf-8');
        if (!raw.includes('agent-achievements')) return false;
        const { cleaned, removed } = isYaml ? removeYamlMcpBlock(raw) : removeMcpFromJson(raw);
        if (!removed) return false;
        if (dryRun) {
          log(`  ${D}would remove agent-achievements${R} from ${t.configPath}`);
          return false;
        }
        fs.writeFileSync(t.configPath, cleaned);
        log(`  ${G}✓${R} cleaned ${t.configPath}`);
        return true;
      },
    });
  }

  // 2. CC hooks (~/.claude/settings.json) — only for claude-code or --all
  const isToolFiltered = Boolean(filterTool);
  if (!isToolFiltered || filterTool === 'claude-code') {
    const ccSettings = path.join(HOME, '.claude', 'settings.json');
    actions.push({
      label: 'CC hooks: Claude Code',
      file: ccSettings,
      remove() {
        if (!fs.existsSync(ccSettings)) return false;
        const raw = fs.readFileSync(ccSettings, 'utf-8');
        if (!raw.includes('AGPA_TOOL_SOURCE=claude-code')) return false;
        const { cleaned, removed } = removeCcHooks(raw);
        if (!removed) return false;
        if (dryRun) {
          log(`  ${D}would remove AGPA hooks${R} from ${ccSettings}`);
          return false;
        }
        fs.writeFileSync(ccSettings, cleaned);
        log(`  ${G}✓${R} cleaned hooks from ${ccSettings}`);
        return true;
      },
    });
  }

  // 3. Hermes hooks — only for hermes or --all
  if (!isToolFiltered || filterTool === 'hermes') {
    const hermesCfg = path.join(HOME, '.hermes', 'config.yaml');
    actions.push({
      label: 'Hermes hooks',
      file: hermesCfg,
      remove() {
        if (!fs.existsSync(hermesCfg)) return false;
        const raw = fs.readFileSync(hermesCfg, 'utf-8');
        if (!raw.includes('agpa-hermes-hook')) return false;
        const { cleaned, removed } = removeHermesHooks(raw);
        if (!removed) return false;
        if (dryRun) {
          log(`  ${D}would remove AGPA hooks${R} from ${hermesCfg}`);
          return false;
        }
        fs.writeFileSync(hermesCfg, cleaned);
        log(`  ${G}✓${R} cleaned Hermes hooks from ${hermesCfg}`);
        return true;
      },
    });
  }

  // 4. Instruction files (shared across tools — always included)
  for (const f of INSTRUCTION_FILES) {
    actions.push({
      label: `Instructions: ${f.name}`,
      file: f.path,
      remove() {
        if (!fs.existsSync(f.path)) return false;
        const raw = fs.readFileSync(f.path, 'utf-8');
        if (!raw.includes('AGPA ACHIEVEMENT TRACKING')) return false;
        const { cleaned, removed } = removeInstructionBlock(raw);
        if (!removed) return false;
        if (dryRun) {
          log(`  ${D}would remove instruction block${R} from ${f.path}`);
          return false;
        }
        fs.writeFileSync(f.path, cleaned);
        log(`  ${G}✓${R} cleaned instructions from ${f.path}`);
        return true;
      },
    });
  }

  // 5. Plugin files — filtered by tool
  const plugins: Array<{ label: string; path: string; toolId: string }> = [
    { label: 'OpenClaw plugin', path: path.join(HOME, '.openclaw', 'extensions', 'agpa-track.ts'), toolId: 'openclaw' },
    { label: 'Kilo Code plugin', path: path.join(HOME, '.config', 'kilo', 'plugins', 'agpa-track.ts'), toolId: 'kilocode' },
    { label: 'OpenCode plugin', path: path.join(HOME, '.config', 'opencode', 'plugins', 'agpa-track.ts'), toolId: 'opencode' },
  ];
  for (const p of plugins) {
    if (filterTool && p.toolId !== filterTool) continue;
    actions.push({
      label: p.label,
      file: p.path,
      remove() {
        return removeFile(p.path);
      },
    });
  }

  // 6. Achievement slash commands (shared — always included)
  const cmdDir = path.join(HOME, '.claude', 'commands');
  for (const f of ['achievements.md', 'achievements-settings.md']) {
    const fp = path.join(cmdDir, f);
    actions.push({
      label: `Slash command: /${f.replace('.md', '')}`,
      file: fp,
      remove() { return removeFile(fp); },
    });
  }

  return actions;
}

// ── Main ──────────────────────────────────────────────────────────────

function parseUninstallArgs(): {
  isAll: boolean;
  dryRun: boolean;
  keepData: boolean;
  filterTool: string | null;
} {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all') || args.includes('--yes');
  const dryRun = args.includes('--dry-run');
  const keepData = args.includes('--keep-data');

  let filterTool: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) {
      filterTool = args[i + 1]!;
      i++;
    }
  }

  return { isAll, dryRun, keepData, filterTool };
}

/**
 * Backup files that will be modified before removal.
 * Creates timestamped .agpa.bak copies so users can rollback.
 */
function backupFiles(actions: RemovalAction[]): void {
  const seen = new Set<string>();
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const action of actions) {
    if (seen.has(action.file)) continue;
    seen.add(action.file);

    if (fs.existsSync(action.file)) {
      const bak = action.file + `.agpa-${stamp}.bak`;
      if (!fs.existsSync(bak)) {
        try { fs.copyFileSync(action.file, bak); } catch { /* ok */ }
      }
    }
  }
}

/**
 * Run a quick post-uninstall verification using the same checks as init's autoVerify.
 * Reports any leftover traces the user may want to clean up manually.
 */
function postVerify(): void {
  const W = 51;
  log(`\n  ${'─'.repeat(W)}`);
  log(`  Post-uninstall checks`);

  const results = [
    checkDataDir(),
    checkStateJson(),
    checkDefsYaml(),
    ...checkMcpConfigs(),
    ...checkInstructionFiles(),
  ];

  const remaining = results.filter(r => r.status === 'ok');
  const leftover = results.filter(r => r.status === 'warn' || r.status === 'error');

  if (leftover.length === 0) {
    log(`  ${G}✓${R} No AGPA traces detected — clean uninstall.`);
  } else {
    log(`  ${Y}⚠${R} ${remaining.length} traces remain (may be from other tools):`);
    for (const r of remaining) {
      log(`     ${r.label}: ${r.detail}`);
    }
  }
  log(`  ${'─'.repeat(W)}`);
}

function main(): void {
  const { isAll, dryRun: isDryRun, keepData, filterTool: filterToolArg } = parseUninstallArgs();
  dryRun = isDryRun;

  // Resolve --tool alias to canonical id
  let filterTool: string | null = null;
  if (filterToolArg) {
    const resolved = findTool(filterToolArg);
    if (!resolved) {
      log(`\n${Y}⚠ Unknown tool: "${filterToolArg}"${R}`);
      log('  Valid tools: claude-code, kilocode, hermes, opencode, openclaw');
      log('  Aliases: cc, kilo, ha, oc, claw\n');
      process.exit(1);
    }
    filterTool = resolved.id;
  }

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
AGPA Uninstall — cleanly remove AGPA from your AI coding tools

Usage:
  agpa uninstall                   Interactive removal
  agpa uninstall --all             Remove everything without confirmation
  agpa uninstall --yes             Same as --all (for scripting)
  agpa uninstall --dry-run         Preview what would be removed
  agpa uninstall --keep-data       Keep ~/.agent-achievements/ directory
  agpa uninstall --tool <name>     Remove config for a specific tool only

Tools: claude-code, kilocode, hermes, opencode, openclaw (aliases: cc, kilo, ha, oc, claw)

What this removes:
  • MCP server entries from tool configs
  • CC / Hermes auto-track hooks from settings files
  • Instruction blocks from CLAUDE.md / AGENTS.md
  • Plugin files (openclaw/extensions, kilo/opencode/plugins)
  • /achievements and /achievements-settings slash commands
  • Dashboard auto-start daemon (launchd plist / systemd unit)
  • ~/.agent-achievements/ data directory (unless --keep-data)
`);
    process.exit(0);
  }

  if (dryRun) {
    log(`\n${Y}⚡ DRY RUN${R} — no files will be modified\n`);
  }

  const actions = buildActions(filterTool);

  // ── Interactive confirmation (TTY, no --all) ────────────────────────
  if (!isAll && process.stdin.isTTY) {
    // Collect what will actually be removed
    const willModify: string[] = [];
    for (const action of actions) {
      if (fs.existsSync(action.file)) {
        willModify.push(`  ${D}${action.label}${R}  → ${action.file.replace(HOME, '~')}`);
      }
    }
    if (fs.existsSync(AGPA_DIR) && !keepData && !filterTool) {
      willModify.push(`  ${D}Data directory${R}  → ${AGPA_DIR.replace(HOME, '~')}`);
    }
    if (isDaemonInstalled() && !filterTool) {
      willModify.push(`  ${D}Dashboard daemon${R}`);
    }

    if (willModify.length === 0) {
      log('\n  ℹ️  No AGPA traces found. Nothing to remove.\n');
      process.exit(0);
    }

    log(`\n  ${B}Found AGPA traces in:${R}\n`);
    for (const line of willModify) {
      log(line);
    }
    log('');

    // Simple readline prompt
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${Y}Remove these? (y/N)${R} `, (answer: string) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed !== 'y' && trimmed !== 'yes') {
        log('\n  Cancelled.\n');
        process.exit(0);
      }
      // Continue with removal below
      proceed();
    });
    return; // Wait for the prompt callback
  }

  // Non-interactive path (--all or pipe) — proceed immediately
  proceed();

  function proceed() {
    // ── Backup before modification ────────────────────────────────────
    if (!dryRun) {
      backupFiles(actions);
    }

    let removed = 0;

    for (const action of actions) {
      const wasRemoved = action.remove();
      if (wasRemoved) removed++;
    }

    // Remove data directory (last, after configs are cleaned)
    // Skip data dir removal when using --tool (don't wipe shared state)
    const shouldRemoveData = !keepData && !filterTool;
    if (shouldRemoveData && !dryRun && fs.existsSync(AGPA_DIR)) {
      fs.rmSync(AGPA_DIR, { recursive: true });
      log(`  ${G}✓${R} removed data directory ${AGPA_DIR}`);
      removed++;
    } else if (shouldRemoveData && dryRun && fs.existsSync(AGPA_DIR)) {
      log(`  ${D}would remove${R} ${AGPA_DIR}`);
    } else if (keepData) {
      log(`\n  ${D}Data kept at${R} ${AGPA_DIR}`);
    }

    // ── Daemon cleanup (skip for --tool) ──────────────────────────────
    if (!filterTool && isDaemonInstalled()) {
      if (dryRun) {
        log(`  ${D}would remove${R} dashboard auto-start daemon`);
      } else {
        const { ok, message } = uninstallDaemon();
        if (ok) {
          log(`  ${G}✓${R} ${message}`);
          removed++;
        } else {
          log(`  ${Y}⚠${R} ${message}`);
        }
      }
    }

    log(`\n${G}Done.${R} ${removed} item(s) removed.\n`);
    log('  💡 To reinstall: agpa init');
    if (process.platform === 'darwin') {
      log('  ℹ️  terminal-notifier was kept (shared tool, may be used by other apps).');
      log('     To remove it: brew uninstall terminal-notifier');
    }
    log('');

    // ── Post-uninstall verification ───────────────────────────────────
    if (!dryRun && !filterTool) {
      postVerify();
    }
  }
}

const isDirectlyExecuted = process.argv[1]
  && (import.meta.url.endsWith(process.argv[1]!)
      || process.argv[1]!.endsWith('uninstall.ts')
      || process.argv[1]!.endsWith('uninstall.js')
      || process.argv[2] === 'uninstall');   // routed via agpa index.ts dispatch
if (isDirectlyExecuted) {
  main();
}
