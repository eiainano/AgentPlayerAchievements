#!/usr/bin/env node
/**
 * AGPA Verify — confirm your setup is working (post-init health check)
 *
 * Usage:
 *   agpa verify
 *   agpa verify --profile <name>
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { homedir } from 'node:os';
import { TOOLS, INSTRUCTION_FILES } from '../tool-registry.js';
import { AchievementEngine } from '../engine/engine.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const DEFS_YAML = path.join(PROJECT_ROOT, '04-成就定义清单.yaml');

// ── Types ─────────────────────────────────────────────────────────────────

type Status = 'ok' | 'warn' | 'error';

interface CheckResult {
  id: string;
  label: string;
  status: Status;
  detail: string;
  fix?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

function icon(s: Status): string {
  return { ok: `${GREEN}✅${RESET}`, warn: `${YELLOW}⚠️ ${RESET}`, error: `${RED}❌${RESET}` }[s];
}

// ── Checks ────────────────────────────────────────────────────────────────

function checkDataDir(profile: string | null): CheckResult {
  const dir = profile ? path.join(AGPA_DIR, 'profiles', profile) : AGPA_DIR;
  const exists = fs.existsSync(dir);
  if (!exists) {
    return {
      id: 'data-dir', label: 'Data directory', status: 'error',
      detail: `${dir} does not exist`,
      fix: 'agpa init',
    };
  }
  // Check writable
  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    return {
      id: 'data-dir', label: 'Data directory', status: 'error',
      detail: `${dir} is not writable`,
    };
  }
  const files = fs.readdirSync(dir);
  const hasState = files.includes('state.json');
  const hasLog = files.includes('event.log');
  let detail = dir;
  if (hasState && hasLog) detail += ' (state + event log)';
  else if (hasState) detail += ' (state only, no events yet)';
  else detail += ' (empty)';
  return { id: 'data-dir', label: 'Data directory', status: 'ok', detail };
}

function checkStateJson(profile: string | null): CheckResult {
  const statePath = profile
    ? path.join(AGPA_DIR, 'profiles', profile, 'state.json')
    : path.join(AGPA_DIR, 'state.json');
  if (!fs.existsSync(statePath)) {
    return {
      id: 'state', label: 'State file', status: 'error',
      detail: `${statePath} does not exist`,
      fix: 'agpa init',
    };
  }
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    const state = JSON.parse(raw);
    const unlocked = Object.keys(state.unlocked || {}).length;
    return {
      id: 'state', label: 'State file', status: 'ok',
      detail: `${unlocked} unlocked, valid JSON`,
    };
  } catch {
    return {
      id: 'state', label: 'State file', status: 'error',
      detail: `${statePath} is corrupt (invalid JSON)`,
    };
  }
}

function checkDefsYaml(): CheckResult {
  if (!fs.existsSync(DEFS_YAML)) {
    return {
      id: 'defs-yaml', label: 'Achievement definitions', status: 'error',
      detail: `${DEFS_YAML} not found`,
    };
  }
  try {
    const raw = fs.readFileSync(DEFS_YAML, 'utf-8');
    const count = (raw.match(/^\s+- id:/gm) || []).length;
    if (count < 100) {
      return {
        id: 'defs-yaml', label: 'Achievement definitions', status: 'warn',
        detail: `Only ${count} achievements found (expected ≥100)`,
      };
    }
    return {
      id: 'defs-yaml', label: 'Achievement definitions', status: 'ok',
      detail: `${count} achievements loaded from YAML`,
    };
  } catch {
    return {
      id: 'defs-yaml', label: 'Achievement definitions', status: 'error',
      detail: `Cannot parse ${DEFS_YAML}`,
    };
  }
}

function checkEngine(): CheckResult {
  // Dry-run: initialize engine in a temp directory, track + poll
  const tmpDir = path.join(os.tmpdir(), `agpa-verify-${Date.now()}`);
  let clean = false;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const engine = new AchievementEngine({
      stateDir: tmpDir,
      defsPath: DEFS_YAML,
      toolSource: 'claude-code',
    }).init();

    // Track a test event
    engine.track('session.start');

    // Poll should not throw
    engine.poll();

    // Verify definitions loaded
    if (engine.definitions.length === 0) {
      return {
        id: 'engine', label: 'Engine dry-run', status: 'error',
        detail: 'No achievements loaded — YAML parsing may have failed',
      };
    }

    clean = true;
    return {
      id: 'engine', label: 'Engine dry-run', status: 'ok',
      detail: `track + poll OK (${engine.definitions.length} achievements)`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      id: 'engine', label: 'Engine dry-run', status: 'error',
      detail: `Engine crashed: ${msg}`,
    };
  } finally {
    if (clean) {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
    }
  }
}

function checkMcpConfigs(): CheckResult[] {
  return TOOLS.map(t => {
    if (!fs.existsSync(t.configPath)) {
      return {
        id: `mcp-${t.id}`, label: `MCP: ${t.name}`, status: 'warn',
        detail: `Config not found (${t.configPath})`,
        fix: `agpa init --tool ${t.id}`,
      };
    }
    try {
      const raw = fs.readFileSync(t.configPath, 'utf-8');
      if (raw.includes('agent-achievements')) {
        return {
          id: `mcp-${t.id}`, label: `MCP: ${t.name}`, status: 'ok',
          detail: t.configPath,
        };
      }
      return {
        id: `mcp-${t.id}`, label: `MCP: ${t.name}`, status: 'warn',
        detail: 'Config exists but agent-achievements not registered',
        fix: `agpa init --tool ${t.id}`,
      };
    } catch {
      return {
        id: `mcp-${t.id}`, label: `MCP: ${t.name}`, status: 'error',
        detail: `Cannot read ${t.configPath}`,
      };
    }
  });
}

function checkInstructions(): CheckResult[] {
  return INSTRUCTION_FILES.map(f => {
    if (!fs.existsSync(f.path)) {
      return {
        id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
        status: 'warn',
        detail: `File not found: ${f.path}`,
        fix: 'agpa init',
      };
    }
    try {
      const raw = fs.readFileSync(f.path, 'utf-8');
      if (raw.includes('AGPA ACHIEVEMENT TRACKING')) {
        return {
          id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
          status: 'ok', detail: f.path,
        };
      }
      return {
        id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
        status: 'warn',
        detail: 'Missing AGPA instruction block',
        fix: 'agpa init',
      };
    } catch {
      return {
        id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
        status: 'error', detail: `Cannot read ${f.path}`,
      };
    }
  });
}

// ── Output ─────────────────────────────────────────────────────────────────

function printHeader(): void {
  console.log('');
  console.log('  🔍  AGPA Setup Verification');
  console.log(`  ${DIM}${'═'.repeat(46)}${RESET}`);
  console.log('');
}

function printResult(r: CheckResult): void {
  const statusIcon = icon(r.status);
  const line = `  ${statusIcon} ${r.label.padEnd(28)} ${r.detail}`;
  console.log(line);
  if (r.fix) {
    console.log(`     ${DIM}Fix: ${r.fix}${RESET}`);
  }
}

function printSummary(results: CheckResult[]): void {
  const errors = results.filter(r => r.status === 'error');
  const warns = results.filter(r => r.status === 'warn');
  const oks = results.filter(r => r.status === 'ok');

  console.log('');
  console.log(`  ${DIM}${'═'.repeat(46)}${RESET}`);

  if (errors.length === 0 && warns.length === 0) {
    console.log(`  ${GREEN}${BOLD}✅ All ${oks.length} checks passed${RESET}`);
    console.log('');
    console.log('  🚀  Your setup is ready!');
    console.log('      Start your AI tool and chat normally.');
    console.log('      Achievements will unlock automatically.');
    console.log('');
    console.log(`  ${DIM}💡 Browse achievements: agpa dashboard${RESET}`);
  } else {
    const total = oks.length + warns.length + errors.length;
    console.log(`  ${oks.length}/${total} passed`);
    if (errors.length > 0) {
      console.log(`  ${RED}${errors.length} error(s)${RESET} — fix these before using AGPA`);
    }
    if (warns.length > 0) {
      console.log(`  ${YELLOW}${warns.length} warning(s)${RESET} — optional but recommended`);
    }
  }

  console.log('');
}

// ── Main ───────────────────────────────────────────────────────────────────

function parseArgs(): { profile: string | null } {
  const args = process.argv.slice(2);
  let profile: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]!;
      i++;
    }
  }
  return { profile };
}

function main(): void {
  const { profile } = parseArgs();

  printHeader();

  if (profile) {
    console.log(`  👤 Profile: ${profile}`);
    console.log('');
  }

  // Core checks (always run)
  const core: CheckResult[] = [
    checkDataDir(profile),
    checkStateJson(profile),
    checkDefsYaml(),
    checkEngine(),
  ];

  for (const r of core) {
    printResult(r);
  }

  // MCP configs (only for detected tools)
  console.log('');
  const mcpResults = checkMcpConfigs();
  const detectedMcps = mcpResults.filter(r => r.status !== 'warn' || !r.detail.includes('not found'));
  for (const r of mcpResults) {
    // Only show tools that have config files (don't show 5 "not found" for fresh installs)
    if (r.status !== 'warn' || !r.detail.includes('not found')) {
      printResult(r);
    }
  }

  // Instructions
  console.log('');
  for (const r of checkInstructions()) {
    printResult(r);
  }

  const allResults = [...core, ...mcpResults, ...checkInstructions()];
  printSummary(allResults);
}

main();
