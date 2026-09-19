import * as path from 'node:path';
import * as fs from 'node:fs';
import { homedir } from 'node:os';

const HOME = homedir();
const ROOT = path.resolve(import.meta.dirname, '..');
const AGPA_MAIN = path.join(ROOT, 'src/main.ts');

export interface ToolDef {
  id: string;
  aliases: string[];
  name: string;
  configPath: string;
  configFormat: 'json' | 'yaml';
}

export const TOOLS: ToolDef[] = [
  {
    id: 'claude-code',
    aliases: ['cc', 'claude'],
    name: 'Claude Code',
    configPath: path.join(HOME, '.claude', 'settings.json'),
    configFormat: 'json',
  },
  {
    id: 'kilo-code',
    aliases: ['kilo', 'kilocode'],
    name: 'Kilo Code',
    configPath: path.join(HOME, '.config', 'kilo', 'config.jsonc'),
    configFormat: 'json',
  },
  {
    id: 'hermes',
    aliases: ['hermes-agent', 'ha'],
    name: 'Hermes Agent',
    configPath: path.join(HOME, '.hermes', 'config.yaml'),
    configFormat: 'yaml',
  },
  {
    id: 'opencode',
    aliases: ['oc', 'open-code'],
    name: 'OpenCode',
    configPath: path.join(HOME, '.config', 'opencode', 'opencode.json'),
    configFormat: 'json',
  },
  {
    id: 'openclaw',
    aliases: ['ocw', 'claw', 'clawdbot'],
    name: 'OpenClaw',
    configPath: path.join(HOME, '.openclaw', 'openclaw.json'),
    configFormat: 'json',
  },
];

export const INSTRUCTION_FILES = [
  { name: 'CLAUDE.md', path: path.join(HOME, '.claude', 'CLAUDE.md') },
  { name: 'AGENTS.md', path: path.join(process.cwd(), 'AGENTS.md') },
];

export interface ScanResult {
  name: string;
  id: string;
  detected: boolean;
  configPath: string;
}

/** Scan for installed AI coding tools (check config file existence). */
export function scanTools(): ScanResult[] {
  const results: ScanResult[] = [];
  for (const t of TOOLS) {
    results.push({
      name: t.name,
      id: t.id,
      detected: fs.existsSync(t.configPath),
      configPath: t.configPath,
    });
  }
  return results;
}

export function findTool(toolId: string): ToolDef | null {
  const lower = toolId.toLowerCase();
  for (const t of TOOLS) {
    if (t.id === lower || t.aliases.includes(lower)) return t;
  }
  return null;
}

/**
 * External tool *sources* — harnesses that report events to AGPA through their
 * own integration rather than an `agpa init` hook. DeepSeek Harness is wired up
 * by the `agpa-dsh-plugin` Cordis plugin, which stamps events with
 * `AGPA_TOOL_SOURCE=dsh`.
 *
 * These ids deliberately do NOT belong in `TOOLS`: that array drives hook
 * installation, and `init` rejects any id without `INIT_DATA` ("No init data for
 * tool"), so adding `dsh` there would surface a bogus error. They still need a
 * human-readable name and a place in the tracked-tools picker, otherwise a
 * profile that tracks one would print a bare `dsh` and silently lose it the next
 * time the picker is saved.
 */
export interface ExternalToolSource {
  id: string;
  name: string;
  /** Representative install path; its existence marks the harness as present. */
  detectPath: string;
}

export const EXTERNAL_TOOL_SOURCES: ExternalToolSource[] = [
  {
    id: 'dsh',
    name: 'DeepSeek Harness',
    detectPath: path.join(HOME, '.dsh'),
  },
];

export function findExternalToolSource(toolId: string): ExternalToolSource | null {
  return EXTERNAL_TOOL_SOURCES.find((t) => t.id === toolId) ?? null;
}

/** Resolve a tool id to its display name across init targets and external sources. */
export function toolDisplayName(toolId: string): string {
  return TOOLS.find((t) => t.id === toolId)?.name
    ?? findExternalToolSource(toolId)?.name
    ?? toolId;
}

/**
 * Rows for the tracked-tools picker: `agpa init` targets plus external sources.
 * External rows are marked detected when their install path exists, and carry a
 * synthetic config path so the picker has something to render.
 */
export function trackedToolRows(): ScanResult[] {
  const rows: ScanResult[] = scanTools();
  for (const src of EXTERNAL_TOOL_SOURCES) {
    rows.push({
      id: src.id,
      name: src.name,
      detected: fs.existsSync(src.detectPath),
      configPath: src.detectPath,
    });
  }
  return rows;
}
