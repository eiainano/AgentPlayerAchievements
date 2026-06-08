#!/usr/bin/env node
/**
 * AGPA Uninstall — cleanly remove all AGPA traces from AI coding tools.
 *
 * Usage:
 *   agpa uninstall                  Interactive: scan & prompt for each tool
 *   agpa uninstall --all            Remove everything without prompts
 *   agpa uninstall --dry-run        Show what would be removed (no changes)
 *   agpa uninstall --keep-data      Remove configs only, keep ~/.agent-achievements/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { TOOLS, INSTRUCTION_FILES } from '../tool-registry.js';

const HOME = homedir();
const AGPA_DIR = path.join(HOME, '.agent-achievements');

const R = '\x1b[0m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const D = '\x1b[2m';

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

function buildActions(): RemovalAction[] {
  const actions: RemovalAction[] = [];

  // 1. MCP configs (all 5 tools)
  for (const t of TOOLS) {
    actions.push({
      label: `MCP config: ${t.name}`,
      file: t.configPath,
      remove() {
        if (!fs.existsSync(t.configPath)) return false;
        const raw = fs.readFileSync(t.configPath, 'utf-8');
        if (!raw.includes('agent-achievements')) return false;
        const { cleaned, removed } = removeMcpFromJson(raw);
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

  // 2. CC hooks (~/.claude/settings.json)
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

  // 3. Hermes hooks
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

  // 4. Instruction files
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

  // 5. Plugin files
  const plugins = [
    { label: 'OpenClaw plugin', path: path.join(HOME, '.openclaw', 'extensions', 'agpa-track.ts') },
    { label: 'Kilo Code plugin', path: path.join(HOME, '.config', 'kilo', 'plugins', 'agpa-track.ts') },
    { label: 'OpenCode plugin', path: path.join(HOME, '.config', 'opencode', 'plugins', 'agpa-track.ts') },
  ];
  for (const p of plugins) {
    actions.push({
      label: p.label,
      file: p.path,
      remove() {
        return removeFile(p.path);
      },
    });
  }

  // 6. Achievement slash commands
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

function main(): void {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  dryRun = args.includes('--dry-run');
  const keepData = args.includes('--keep-data');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AGPA Uninstall — cleanly remove AGPA from your AI coding tools

Usage:
  agpa uninstall                   Interactive removal
  agpa uninstall --all             Remove everything without confirmation
  agpa uninstall --dry-run         Preview what would be removed
  agpa uninstall --keep-data       Keep ~/.agent-achievements/ directory

What this removes:
  • MCP server entries from tool configs (Claude Code, Kilo Code, Hermes, OpenCode, OpenClaw)
  • CC auto-track hooks from ~/.claude/settings.json
  • Hermes auto-track hooks from ~/.hermes/config.yaml
  • Instruction blocks from CLAUDE.md / AGENTS.md / TOOLS.md
  • Plugin files (openclaw/extensions, kilo/opencode/plugins)
  • /achievements and /achievements-settings slash commands
  • ~/.agent-achievements/ data directory (unless --keep-data)
`);
    process.exit(0);
  }

  if (dryRun) {
    log(`\n${Y}⚡ DRY RUN${R} — no files will be modified\n`);
  }

  const actions = buildActions();
  let removed = 0;

  for (const action of actions) {
    const wasRemoved = action.remove();
    if (wasRemoved) removed++;
  }

  // Remove data directory (last, after configs are cleaned)
  if (!keepData && !dryRun && fs.existsSync(AGPA_DIR)) {
    fs.rmSync(AGPA_DIR, { recursive: true });
    log(`  ${G}✓${R} removed data directory ${AGPA_DIR}`);
    removed++;
  } else if (!keepData && dryRun && fs.existsSync(AGPA_DIR)) {
    log(`  ${D}would remove${R} ${AGPA_DIR}`);
  } else if (keepData) {
    log(`\n  ${D}Data kept at${R} ${AGPA_DIR}`);
  }

  log(`\n${G}Done.${R} ${removed} item(s) removed.\n`);
  log('  💡 To reinstall: agpa init');
  log('');
}

const isDirectlyExecuted = process.argv[1]
  && (import.meta.url.endsWith(process.argv[1]!)
      || process.argv[1]!.endsWith('uninstall.ts')
      || process.argv[1]!.endsWith('uninstall.js'));
if (isDirectlyExecuted) {
  main();
}
