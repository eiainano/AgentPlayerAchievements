#!/usr/bin/env node
/**
 * AGPA Doctor — diagnose configuration & data health
 *
 * Usage:
 *   npx tsx src/cli/doctor.ts
 *   npx tsx src/cli/doctor.ts --check mcp-config
 *   npx tsx src/cli/doctor.ts --json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { TOOLS, INSTRUCTION_FILES } from '../tool-registry.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');
const EVENT_LOG = path.join(AGPA_DIR, 'event.log');
const STATE_JSON = path.join(AGPA_DIR, 'state.json');
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const DEFS_YAML = path.join(PROJECT_ROOT, '04-成就定义清单.yaml');

// ── Types ─────────────────────────────────────────────────────────────

type Status = 'ok' | 'warn' | 'error';

interface CheckResult {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function statusIcon(s: Status): string {
  return { ok: '✅', warn: '⚠️', error: '❌' }[s];
}

function ago(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Checks ────────────────────────────────────────────────────────────

function checkDataDir(): CheckResult {
  const exists = fs.existsSync(AGPA_DIR);
  if (!exists) {
    return { id: 'data-dir', label: 'Data directory', status: 'error',
      detail: `${AGPA_DIR} does not exist. Run agpa init first.` };
  }
  const files = fs.readdirSync(AGPA_DIR);
  const missing: string[] = [];
  if (!files.includes('event.log')) missing.push('event.log');
  if (!files.includes('state.json')) missing.push('state.json');
  if (missing.length > 0) {
    return { id: 'data-dir', label: 'Data directory', status: 'warn',
      detail: `Exists, missing: ${missing.join(', ')}` };
  }
  return { id: 'data-dir', label: 'Data directory', status: 'ok',
    detail: `${AGPA_DIR} (${files.length} files)` };
}

function checkEventLog(): CheckResult {
  if (!fs.existsSync(EVENT_LOG)) {
    return { id: 'event-log', label: 'Event log', status: 'error',
      detail: `${EVENT_LOG} does not exist` };
  }
  try {
    const stat = fs.statSync(EVENT_LOG);
    const lines = fs.readFileSync(EVENT_LOG, 'utf-8').trim().split('\n').filter(Boolean);
    const mtime = Date.now() - stat.mtimeMs;
    let mtimeStatus = '';
    if (mtime < 300_000) mtimeStatus = `(last write ${ago(mtime)})`;
    else if (mtime < 3_600_000) mtimeStatus = `(last write ${ago(mtime)})`;
    else mtimeStatus = `(⚠ last write ${ago(mtime)})`;

    return { id: 'event-log', label: 'Event log', status: 'ok',
      detail: `${lines.length} lines, ${(stat.size / 1024).toFixed(1)}KB ${mtimeStatus}` };
  } catch {
    return { id: 'event-log', label: 'Event log', status: 'error',
      detail: `Cannot read ${EVENT_LOG}` };
  }
}

function checkStateJson(): CheckResult {
  if (!fs.existsSync(STATE_JSON)) {
    return { id: 'state', label: 'State file', status: 'error',
      detail: `${STATE_JSON} does not exist` };
  }
  try {
    const raw = fs.readFileSync(STATE_JSON, 'utf-8');
    const state = JSON.parse(raw);
    const unlocked = Object.keys(state.unlocked || {}).length;
    return { id: 'state', label: 'State file', status: 'ok',
      detail: `${unlocked} unlocked, valid JSON` };
  } catch {
    return { id: 'state', label: 'State file', status: 'error',
      detail: `${STATE_JSON} is corrupt (invalid JSON)` };
  }
}

function checkDefsYaml(): CheckResult {
  if (!fs.existsSync(DEFS_YAML)) {
    return { id: 'defs-yaml', label: 'Achievement definitions', status: 'error',
      detail: `${DEFS_YAML} not found` };
  }
  try {
    const raw = fs.readFileSync(DEFS_YAML, 'utf-8');
    // Quick parse check: count "- id:" entries
    const count = (raw.match(/^\s+- id:/gm) || []).length;
    return { id: 'defs-yaml', label: 'Achievement definitions', status: 'ok',
      detail: `${count} achievements defined` };
  } catch {
    return { id: 'defs-yaml', label: 'Achievement definitions', status: 'error',
      detail: `Cannot read ${DEFS_YAML}` };
  }
}

function checkMcpConfigs(): CheckResult[] {
  return TOOLS.map(t => {
    if (!fs.existsSync(t.configPath)) {
      return { id: `mcp-${t.id}`,
        label: `MCP: ${t.name}`, status: 'warn',
        detail: `Config not found at ${t.configPath}` };
    }
    try {
      const raw = fs.readFileSync(t.configPath, 'utf-8');
      if (raw.includes('agent-achievements')) {
        return { id: `mcp-${t.id}`,
          label: `MCP: ${t.name}`, status: 'ok',
          detail: t.configPath };
      }
      return { id: `mcp-${t.id}`,
        label: `MCP: ${t.name}`, status: 'warn',
        detail: `Config exists but agent-achievements not registered. Run: agpa init --tool ${t.id}` };
    } catch {
      return { id: `mcp-${t.id}`,
        label: `MCP: ${t.name}`, status: 'error',
        detail: `Cannot read ${t.configPath}` };
    }
  });
}

function checkInstructionFiles(): CheckResult[] {
  return INSTRUCTION_FILES.map(f => {
    if (!fs.existsSync(f.path)) {
      return { id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
        status: 'warn', detail: `File not found: ${f.path}` };
    }
    try {
      const raw = fs.readFileSync(f.path, 'utf-8');
      if (raw.includes('AGPA ACHIEVEMENT TRACKING')) {
        return { id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
          status: 'ok', detail: f.path };
      }
      return { id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
        status: 'warn', detail: 'File exists but missing AGPA instructions. Run agpa init.' };
    } catch {
      return { id: `instr-${f.name.toLowerCase()}`, label: `Instructions: ${f.name}`,
        status: 'error', detail: `Cannot read ${f.path}` };
    }
  });
}

// ── Output ─────────────────────────────────────────────────────────────

function renderReport(results: CheckResult[]): string {
  const l: string[] = [];
  l.push('');
  for (const r of results) {
    const icon = statusIcon(r.status);
    l.push(`  ${icon} ${r.label}`);
    l.push(`     ${r.detail}`);
  }

  const errors = results.filter(r => r.status === 'error');
  const warns = results.filter(r => r.status === 'warn');

  if (errors.length > 0 || warns.length > 0) {
    l.push('');
    l.push('  Recommendations:');
    for (const w of warns) {
      if (w.id.startsWith('mcp-')) {
        const tool = w.id.replace('mcp-', '');
        l.push(`    agpa init --tool ${tool}`);
      }
    }
  }

  l.push('');
  l.push(`  Data: ${AGPA_DIR}`);
  l.push('');
  return l.join('\n');
}

function renderJson(results: CheckResult[]): string {
  return JSON.stringify(results, null, 2);
}

// ── Main ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let jsonMode = false;
let singleCheck: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') {
    jsonMode = true;
  } else if (args[i] === '--check' && args[i + 1]) {
    singleCheck = args[i + 1]!;
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
AGPA Doctor — diagnose configuration & data health

Usage:
  npx tsx src/cli/doctor.ts
  npx tsx src/cli/doctor.ts --check <check-id>
  npx tsx src/cli/doctor.ts --json

Checks:
  data-dir      Directory integrity
  event-log     Event log status
  state         State file status
  defs-yaml     Achievement definitions
  mcp-config    MCP server registration (all 5 tools)
  instructions  Instruction file injection
`);
    process.exit(0);
  }
}

let results: CheckResult[] = [];

if (!singleCheck || singleCheck === 'data-dir') {
  results.push(checkDataDir());
}
if (!singleCheck || singleCheck === 'event-log') {
  results.push(checkEventLog());
}
if (!singleCheck || singleCheck === 'state') {
  results.push(checkStateJson());
}
if (!singleCheck || singleCheck === 'defs-yaml') {
  results.push(checkDefsYaml());
}
if (!singleCheck || singleCheck === 'mcp-config') {
  results.push(...checkMcpConfigs());
}
if (!singleCheck || singleCheck === 'instructions') {
  results.push(...checkInstructionFiles());
}

if (jsonMode) {
  console.log(renderJson(results));
} else {
  console.log(renderReport(results));
}

const hasErrors = results.some(r => r.status === 'error');
process.exit(hasErrors ? 1 : 0);
