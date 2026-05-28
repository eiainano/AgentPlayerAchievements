import * as path from 'node:path';
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

export function findTool(toolId: string): ToolDef | null {
  const lower = toolId.toLowerCase();
  for (const t of TOOLS) {
    if (t.id === lower || t.aliases.includes(lower)) return t;
  }
  return null;
}
