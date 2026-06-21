#!/usr/bin/env node
/**
 * AGPA Init — detect & configure AI coding tools for achievement tracking
 *
 * Usage:
 *   npx tsx src/cli/init.ts               Scan & pick tools interactively
 *   npx tsx src/cli/init.ts --tool <tool>  Configure a specific tool
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { TOOLS, findTool, INSTRUCTION_FILES, scanTools, type ScanResult } from '../tool-registry.js';
import type { ToolDef } from '../tool-registry.js';
import { parseYAML } from '../engine/yaml-parser.js';
import { setTrackedTools, getProfileMeta, createProfile, validateProfileName, DEFAULT_PROFILE } from '../utils/profile.js';
import { loadConfig } from '../config.js';
import { checkDataDir, checkStateJson, checkDefsYaml, checkMcpConfigs, checkInstructionFiles, statusIcon } from './doctor.js';
import { installDaemon, isDaemonInstalled } from './daemon.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');
const AGPA_MAIN = path.resolve(import.meta.dirname, '../main.ts');
const AGPA_HOOK = path.resolve(import.meta.dirname, 'hook.ts');
const AGPA_ROOT = path.resolve(import.meta.dirname, '../..');
const TSX_BIN = path.resolve(import.meta.dirname, '../../node_modules/.bin/tsx');

/** Build hook command with optional profile env var */
export function hookCmd(toolSourceEnv: string, mode: string, profile: string | null): string {
  const profileEnv = profile ? `AGPA_PROFILE=${profile} ` : '';
  const launcher = path.join(AGPA_DIR, 'run-hook.sh');
  return `${profileEnv}${toolSourceEnv} sh ${launcher} ${mode}`;
}

const HOOK_ENV = 'AGPA_TOOL_SOURCE=claude-code';
const HOOK_HERMES_ENV = 'AGPA_TOOL_SOURCE=hermes';
const HOOK_OPENCLAW_ENV = 'AGPA_TOOL_SOURCE=openclaw';
const HOOK_KILOCODE_ENV = 'AGPA_TOOL_SOURCE=kilocode';
// Profile-aware versions built dynamically in getHookKeys() and Hermes/OpenClaw init

// ── Per-tool init data (mcpInject + instructionFiles) ──────────────────

export interface InitToolData {
  mcpInject: (config: Record<string, unknown>) => Record<string, unknown>;
  instructionFiles: Array<{ path: string; marker: string }>;
}

export const INIT_DATA: Record<string, InitToolData> = {
  'claude-code': {
    mcpInject(cfg) {
      const mcps = (cfg.mcpServers as Record<string, unknown>) || {};
      mcps['agent-achievements'] = {
        command: 'tsx',
        args: [AGPA_MAIN],
        env: { AGPA_TOOL_SOURCE: 'claude-code' },
      };
      cfg.mcpServers = mcps;
      return cfg;
    },
    instructionFiles: [
      { path: path.join(homedir(), '.claude', 'CLAUDE.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING v2 -->' },
    ],
  },
  'kilo-code': {
    mcpInject(cfg) {
      const mcp = (cfg.mcp as Record<string, unknown>) || {};
      mcp['agent-achievements'] = {
        type: 'local',
        command: ['tsx', AGPA_MAIN],
        enabled: true,
        env: { AGPA_TOOL_SOURCE: 'kilocode' },
      };
      cfg.mcp = mcp;
      return cfg;
    },
    instructionFiles: [
      { path: path.join(homedir(), '.config', 'kilo', 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING v2 -->' },
    ],
  },
  'hermes': {
    mcpInject(cfg) {
      const servers = (cfg.mcp_servers as Record<string, unknown>) || {};
      servers['agent-achievements'] = { command: 'tsx', args: [AGPA_MAIN], enabled: true };
      cfg.mcp_servers = servers;
      return cfg;
    },
    instructionFiles: [
      { path: path.join(homedir(), '.hermes', 'SOUL.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING v2 -->' },
    ],
  },
  'opencode': {
    mcpInject(cfg) {
      const mcp = (cfg.mcp as Record<string, unknown>) || {};
      mcp['agent-achievements'] = {
        type: 'local',
        command: ['tsx', AGPA_MAIN],
        enabled: true,
        env: { AGPA_TOOL_SOURCE: 'opencode' },
      };
      cfg.mcp = mcp;
      return cfg;
    },
    instructionFiles: [
      { path: path.join(homedir(), '.config', 'opencode', 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING v2 -->' },
    ],
  },
  'openclaw': {
    mcpInject(cfg) {
      const mcp = (cfg.mcp as Record<string, unknown>) || {};
      const servers = (mcp.servers as Record<string, unknown>) || {};
      servers['agent-achievements'] = {
        command: 'tsx',
        args: [AGPA_MAIN],
        env: { AGPA_TOOL_SOURCE: 'openclaw' },
      };
      mcp.servers = servers;
      cfg.mcp = mcp;
      return cfg;
    },
    instructionFiles: [
      { path: path.join(homedir(), '.openclaw', 'workspace', 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING v2 -->' },
      { path: path.join(homedir(), '.openclaw', 'workspace', 'TOOLS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING v2 -->' },
    ],
  },
};

// ── Instruction template ──────────────────────────────────────────────

const INSTRUCTION_BLOCK = `<!-- AGPA ACHIEVEMENT TRACKING v2 -->
## 🏆 Achievement Tracking (AGPA)

This project uses AGPA (Agent Player Achievements). Most tool/file/session events are auto-tracked via CC hooks.

### Events to track manually

Call \`achievement_track\` when you observe these:

**Each user turn (before processing):**
- Each time the user sends you a message → \`user.message\`
- For non-CC tools, after receiving user's message → \`user.prompt\` with \`{ char_count, word_count, has_code_block, has_question_mark }\` (compute from the user's message text)

**When you do something:**
- Read an image file → \`image.read\` (auto: any Read of png/jpg/gif/svg counts)
- Create a file in a specific language → \`file.language_used\` with \`{ language }\` (e.g. "typescript", "python")
- Edit the same function repeatedly → \`function.edited\` with \`{ function_name }\`
- Slash command runs → \`command.slash_used\` with \`{ command }\`
- Enter plan mode → \`plan.mode_entered\`
- Read help/docs → \`help.accessed\`
- Connect MCP server → \`mcp.server_used\` with \`{ server_name }\`
- MCP connection first established → \`mcp.connect\`
- Activate Auto Mode → \`automode.start\`
- Install plugin → \`plugin.installed\` with \`{ plugin_name }\`
- Configure hooks → \`hook.configured\` with \`{ hook_count }\`
- Create agent/subagent → \`agent.created\` with \`{ agent_type }\`
- Create skill → \`skill.created\` with \`{ skill_name }\`
- Publish skill → \`skill.published\` with \`{ skill_name }\`
- Invoke a skill → \`skill.invoke\` with \`{ skill_name }\`
- Create slash command → \`command.created\` with \`{ command_name }\`
- Create template → \`template.created\` with \`{ template_name }\`
- Edit config/settings → \`config.file_edited\` with \`{ file_path }\`
- Create worktree → \`worktree.created\` with \`{ path }\`
- Request code review → \`code.review_requested\`
- Complete code review → \`code.review_completed\` with \`{ issues_found }\`
- Generate 10k+ tokens → \`token.consumed\` with \`{ amount }\`
- Revert a file → \`file.revert\` with \`{ file_path }\`
- Switch from plan mode to agent mode → \`agent.mode_activated\`
- Fix your own bug successfully → \`agent.self_fix\` with \`{ fix_description }\`
- Tool call fails → \`tool.failure\` with \`{ tool_name, error }\` (auto on CC/OpenClaw/KiloCode; manual fallback for Hermes)
- Agent encounters an error → \`error.occurred\` with \`{ error }\` (manual fallback)
- Context window compacted → \`context.compacted\` (manual for non-CC tools)
- Sub-agent spawned → \`agent.spawn\` with \`{ agent_type }\` (manual for non-CC tools)

**When user does something you can see:**
- User switches model → \`model.switch\` with \`{ from, to }\`
- User changes permission mode → \`permission.mode_changed\` with \`{ old_mode, new_mode }\`
- User skip-approves dangerous tool → \`permission.dangerously_skipped\` with \`{ tool_name }\`
- User denies a tool call → \`tool.deny\` with \`{ tool_name }\`
- User edits your output → \`output.edit\` with \`{ amount }\`
- Tests pass during execution → \`test.pass\` with \`{ count }\`
- Tests fail during execution → \`test.fail\` with \`{ count }\`

### Session end
1. \`achievement_poll\` — check for newly unlocked achievements
2. **If poll returns achievements, you MUST display them at the end of your response** as a structured text block with icon + name + description. Use \`achievement.config get lang\` to read AGPA's language setting, then pick the matching name/description field: \`name_cn\`/desc for zh, \`name_es\`/desc for es, \`name_ko\`/desc for ko, \`name_ja\`/desc for ja, fallback to \`name\`/desc for en. Do not let the moment pass silently — highlight it.
3. If no new achievements, consider calling \`achievement_stats\` to show the user their overall progress (optional).
<!-- /AGPA ACHIEVEMENT TRACKING -->`;

// ── Helpers ────────────────────────────────────────────────────────────

function parseCliArgs(): { tool: string | null; profile: string | null; auto: boolean; upgrade: boolean } {
  const args = process.argv.slice(2);
  let tool: string | null = null;
  let profile: string | null = null;
  let auto = false;
  let upgrade = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) {
      tool = args[i + 1]!;
      i++;
    } else if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]!;
      i++;
    } else if (args[i] === '--auto') {
      auto = true;
    } else if (args[i] === '--upgrade') {
      upgrade = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return { tool, profile, auto, upgrade };
}

function printHelp(): void {
  console.log(`
🏆 AGPA Init — Connect AI coding tools to the achievement system

Usage:
  agpa init [options]             Auto-detect & configure (recommended)
  npx tsx src/cli/init.ts [...]   Development alias (same as agpa init)

Tools:
  claude-code, cc        Claude Code
  kilocode, kilo         Kilo Code
  hermes, ha             Hermes Agent
  opencode, oc           OpenCode
  openclaw, claw         OpenClaw

Options:
  --profile <name>       Use a named profile (default: "default")
  --auto                 Skip all prompts, auto-detect & configure all tools
  --upgrade              Update hooks, instructions & commands (skip MCP config)
  --help, -h             Show this help

Without --tool, scans for installed tools & lets you pick which to configure.
--auto skips all interactive prompts — ideal for scripting and CI.
--upgrade is safe to run repeatedly — only injects missing items.
`);
}

function ensureDataDir(baseDir: string): void {
  fs.mkdirSync(baseDir, { recursive: true });
}

/**
 * Copy sound effect files from project assets to the state directory.
 * This enables user-custom sounds later (just replace files in stateDir/sounds/).
 */
function copySounds(dataDir: string): void {
  const srcDir = path.join(AGPA_ROOT, 'assets', 'sounds');
  if (!fs.existsSync(srcDir)) return;
  const destDir = path.join(dataDir, 'sounds');
  fs.mkdirSync(destDir, { recursive: true });

  const soundFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.wav'));
  let copied = 0;
  for (const f of soundFiles) {
    const src = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    // Only copy if newer (or destination missing)
    if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
      fs.copyFileSync(src, dest);
      copied++;
    }
  }
  if (copied > 0) {
    console.log(`  ✅ Sounds:    ${copied} file(s) copied → ${destDir}`);
  }
}

function initEngineState(): void {
  const statePath = path.join(AGPA_DIR, 'state.json');
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify({ unlocked: {} }));
  }
}

// ── JSON config helpers ────────────────────────────────────────────────

function readJSON(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    // Native parse first — fast path for well-formed JSON
    return JSON.parse(raw);
  } catch {
    // Retry with trailing-comma cleanup (some tools produce JSON5-like output)
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function writeJSON(filePath: string, data: Record<string, unknown>): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── YAML config (text-based injection) ─────────────────────────────────

export function injectYamlMCPBlock(
  filePath: string,
  serverName: string,
  serverConfig: Record<string, unknown>,
): boolean {
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf-8');

  if (raw.includes(serverName)) return false;

  const lines = raw.split('\n');
  let mcpLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^mcp_servers:/.test(lines[i]!)) {
      mcpLineIdx = i;
      break;
    }
  }

  const pad = mcpLineIdx >= 0 ? '  ' : '';
  const blockParts = [
    `${pad}${serverName}:`,
    `${pad}  command: ${JSON.stringify(serverConfig.command)}`,
    `${pad}  args: ${JSON.stringify(serverConfig.args)}`,
    `${pad}  enabled: true`,
  ];
  if (serverConfig.env) {
    const env = serverConfig.env as Record<string, string>;
    blockParts.push(`${pad}  env:`);
    for (const [k, v] of Object.entries(env)) {
      blockParts.push(`${pad}    ${k}: ${v}`);
    }
  }
  const block = blockParts.join('\n');

  let result: string;
  if (mcpLineIdx >= 0) {
    const before = lines.slice(0, mcpLineIdx + 1).join('\n');
    const after = lines.slice(mcpLineIdx + 1).join('\n');
    result = before + '\n' + block + (after ? '\n' + after : '');
  } else {
    result = raw.trimEnd() + '\n\n' + 'mcp_servers:\n' + block + '\n';
  }

  fs.writeFileSync(filePath, result);
  return true;
}

// ── Hermes YAML shell hook injection ──────────────────────────────────

function injectHermesHooks(filePath: string, hookCommands: {
  pre_tool_call: string;
  post_tool_call: string;
  on_session_start: string;
  on_session_end: string;
}): boolean {
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Check if already injected
  if (raw.includes('agpa-hermes-hook')) return false;

  const hookBlock = [
    'hooks:',
    '  # ── AGPA Hermes auto-track hooks (agpa-hermes-hook) ──',
    '  pre_tool_call:',
    '    - matcher: ".*"',
    `      command: "${hookCommands.pre_tool_call}"`,
    '      timeout: 5',
    '  post_tool_call:',
    '    - matcher: ".*"',
    `      command: "${hookCommands.post_tool_call}"`,
    '      timeout: 5',
    '  on_session_start:',
    `    - command: "${hookCommands.on_session_start}"`,
    '      timeout: 10',
    '  on_session_end:',
    `    - command: "${hookCommands.on_session_end}"`,
    '      timeout: 10',
    'hooks_auto_accept: true',
  ];

  // Line-by-line: replace hooks: {} / hooks_auto_accept section, preserving rest
  const lines = raw.split('\n');
  const resultLines: string[] = [];
  let skipUntilHooksAuto = false;
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i]!.trim();
    if (skipUntilHooksAuto) {
      if (stripped.startsWith('hooks_auto_accept:')) skipUntilHooksAuto = false;
      continue;
    }
    if (stripped === 'hooks: {}' || stripped === 'hooks:') {
      resultLines.push(...hookBlock);
      skipUntilHooksAuto = true;
    } else if (stripped.startsWith('hooks_auto_accept:')) {
      // skip — already injected in hookBlock
      continue;
    } else {
      resultLines.push(lines[i]!);
    }
  }

  fs.writeFileSync(filePath, resultLines.join('\n'));
  return true;
}

// ── OpenClaw TS plugin injection ──────────────────────────────────────

const OPENCLAW_PLUGIN_MARKER = '// agpa-openclaw-track';

export function generateOpenClawPlugin(profile: string | null): string {
  const profileEnv = profile ? `AGPA_PROFILE: '${profile}', ` : '';
  return `${OPENCLAW_PLUGIN_MARKER}
/**
 * AGPA Auto-Track plugin for OpenClaw
 * Registers 5 lifecycle hooks → spawns hook.ts via stdin pipe → event.log
 *
 * Compatible with OpenClaw >= 2026.3.22 (definePluginEntry API).
 */
import { spawn } from 'node:child_process';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

const TSX_BIN = '${TSX_BIN}';
const HOOK_TS = '${AGPA_HOOK}';

function track(hookName: string, payload: unknown) {
  const child = spawn(TSX_BIN, [HOOK_TS, 'openclaw-auto', hookName], {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, ${profileEnv}AGPA_TOOL_SOURCE: 'openclaw' },
  });
  if (child.stdin) {
    const json = JSON.stringify(payload);
    child.stdin.write(json);
    child.stdin.end();
  }
  child.unref();
}

export default definePluginEntry({
  id: 'agpa-track',
  name: 'AGPA Achievement Tracking',
  kind: 'general',
  register(api: any) {
    api.on('session_start', (payload: unknown) => track('session_start', payload));
    api.on('session_end', (payload: unknown) => {
      track('session_end', payload);
      // Also run poll at session end
      const pollChild = spawn(TSX_BIN, [HOOK_TS, 'poll'], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, ${profileEnv}AGPA_TOOL_SOURCE: 'openclaw' },
      });
      pollChild.unref();
    });
    api.on('before_tool_call', (payload: unknown) => track('before_tool_call', payload));
    api.on('after_tool_call', (payload: unknown) => track('after_tool_call', payload));
    api.on('agent_end', (payload: unknown) => track('agent_end', payload));
  }
});
`;
}

function injectOpenClawPlugin(profile: string | null): boolean {
  const extDir = path.join(homedir(), '.openclaw', 'extensions');
  const pluginPath = path.join(extDir, 'agpa-track.ts');

  // Idempotency: check if already injected
  if (fs.existsSync(pluginPath)) {
    const existing = fs.readFileSync(pluginPath, 'utf-8');
    if (existing.includes(OPENCLAW_PLUGIN_MARKER)) return false;
  }

  fs.mkdirSync(extDir, { recursive: true });
  fs.writeFileSync(pluginPath, generateOpenClawPlugin(profile));
  return true;
}

// ── Kilo Code / OpenCode TS plugin injection ────────────────────────────
// Both products share the same plugin API (only config directories differ).
// Kilo Code: ~/.config/kilo/plugins/, OpenCode: ~/.config/opencode/plugins/

const KILOCODE_PLUGIN_MARKER = '// agpa-kilocode-track';

export function generateKiloCodePlugin(profile: string | null, toolSource: 'kilocode' | 'opencode'): string {
  const profileEnv = profile ? `AGPA_PROFILE: '${profile}', ` : '';
  return `${KILOCODE_PLUGIN_MARKER}
/**
 * AGPA Auto-Track plugin for ${toolSource === 'kilocode' ? 'Kilo Code' : 'OpenCode'}
 *
 * Hooks tool.execute.* and session.* lifecycle events,
 * spawns hook.ts via Bun.spawn stdin pipe → event.log.
 *
 * Compatible with Kilo Code >= v7.2 and OpenCode >= v1.15.
 */
const TSX_BIN = '${TSX_BIN}';
const HOOK_TS = '${AGPA_HOOK}';

function track(hookName: string, payload: Record<string, unknown>) {
  const proc = Bun.spawn([TSX_BIN, HOOK_TS, 'kilocode-auto', hookName], {
    stdin: 'pipe',
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, ${profileEnv}AGPA_TOOL_SOURCE: '${toolSource}' },
  });
  if (proc.stdin) {
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  }
  proc.unref();
}

export default async (_ctx: Record<string, unknown>) => {
  return {
    'tool.execute.before': async (input: Record<string, unknown>) => {
      track('tool.execute.before', {
        hook_event_name: 'tool.execute.before',
        toolName: input.tool,
        params: input.args,
        sessionId: input.sessionID,
      });
    },
    'tool.execute.after': async (input: Record<string, unknown>) => {
      track('tool.execute.after', {
        hook_event_name: 'tool.execute.after',
        toolName: input.tool,
        params: input.args,
        sessionId: input.sessionID,
        durationMs: input.duration,
        error: input.error,
        success: input.success,
      });
    },
    event: async ({ event }: { event: Record<string, unknown> }) => {
      if (event.type === 'session.created') {
        track('session.created', {
          hook_event_name: 'session.created',
          sessionId: (event.data as Record<string, unknown>)?.sessionKey,
        });
      }
      if (event.type === 'session.idle') {
        track('session.idle', {
          hook_event_name: 'session.idle',
          sessionId: (event.data as Record<string, unknown>)?.sessionKey,
        });
        // Also run poll at session end
        const pollProc = Bun.spawn([TSX_BIN, HOOK_TS, 'poll'], {
          stdin: 'ignore',
          stdout: 'inherit',
          stderr: 'inherit',
          env: { ...process.env, ${profileEnv}AGPA_TOOL_SOURCE: '${toolSource}' },
        });
        pollProc.unref();
      }
    },
  };
};
`;
}

function injectKiloCodePlugin(toolId: string, profile: string | null): boolean {
  const source = toolId === 'kilocode' ? 'kilocode' as const : 'opencode' as const;
  const configDir = toolId === 'kilocode'
    ? path.join(homedir(), '.config', 'kilo')
    : path.join(homedir(), '.config', 'opencode');
  const pluginDir = path.join(configDir, 'plugins');
  const pluginPath = path.join(pluginDir, 'agpa-track.ts');

  // Idempotency: check if already injected
  if (fs.existsSync(pluginPath)) {
    const existing = fs.readFileSync(pluginPath, 'utf-8');
    if (existing.includes(KILOCODE_PLUGIN_MARKER)) return false;
  }

  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(pluginPath, generateKiloCodePlugin(profile, source));
  return true;
}

// ── Instruction file injection ─────────────────────────────────────────

export function injectInstructions(filePath: string, marker: string): boolean {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const oldMarker = '<!-- AGPA ACHIEVEMENT TRACKING -->';

  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(marker)) return false;

    // Upgrade: replace old v1 block with new v2 block (avoid duplication)
    if (marker !== oldMarker && content.includes(oldMarker)) {
      const idx = content.indexOf(oldMarker);
      content = content.slice(0, idx).trimEnd();
      const sep = content ? '\n\n' : '';
      fs.writeFileSync(filePath, content + sep + INSTRUCTION_BLOCK + '\n');
      return true;
    }
  }

  const sep = content.trimEnd() ? '\n\n' : '';
  fs.writeFileSync(filePath, content.trimEnd() + sep + INSTRUCTION_BLOCK + '\n');
  return true;
}

// ── Profile creation prompt ─────────────────────────────────────────────

/**
 * Optional profile creation step.
 * User can type a name to create a named profile, or press Enter to skip
 * and use the default profile (shared across all tools).
 *
 * Non-TTY fallback: use default profile.
 */
function promptProfileName(lang: string): Promise<string> {
  if (!process.stdin.isTTY) {
    console.log('  📂 Using default profile');
    return Promise.resolve(DEFAULT_PROFILE);
  }

  const isZh = lang === 'zh';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise(resolve => {
    console.log('');
    console.log(isZh
      ? '  👤 创建 profile（可选）— 不同 profile 可以跟踪不同的工具'
      : '  👤 Create a profile (optional) — different profiles can track different tools');
    console.log(isZh
      ? '  \x1b[90m  输入名字创建新 profile，回车跳过（使用 default）\x1b[0m'
      : '  \x1b[90m  Enter a name to create a new profile, or press Enter to use default\x1b[0m');
    console.log('');

    rl.question(isZh ? '  Profile 名称 > ' : '  Profile name > ', (raw) => {
      rl.close();
      const trimmed = raw.trim();

      if (!trimmed) {
        // Skip — use default
        console.log(isZh ? '  ✅ 使用 default profile' : '  ✅ Using default profile');
        resolve(DEFAULT_PROFILE);
        return;
      }

      const error = validateProfileName(trimmed);
      if (error) {
        console.log(`  \x1b[33m⚠ ${error}\x1b[0m`);
        console.log(isZh ? '  ✅ 回退到 default profile' : '  ✅ Falling back to default profile');
        resolve(DEFAULT_PROFILE);
        return;
      }

      try {
        createProfile(trimmed);
        console.log(isZh
          ? `  ✅ Profile "${trimmed}" 已创建`
          : `  ✅ Profile "${trimmed}" created`);
        resolve(trimmed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.log(`  \x1b[33m⚠ ${msg}\x1b[0m`);
        console.log(isZh ? '  ✅ 回退到 default profile' : '  ✅ Falling back to default profile');
        resolve(DEFAULT_PROFILE);
      }
    });
  });
}

// ── Tool Detection ─────────────────────────────────────────────────────
// scanTools() and ScanResult are imported from ../tool-registry.js

/**
 * Interactive multi-select prompt for picking which tools to configure.
 * Shows detected/not-detected status for all 5 tools.
 * User navigates with ↑/↓, toggles selection with Space, confirms with Enter.
 * Default: all detected tools pre-selected. Undetected tools can still be selected
 * (we'll create their config files later).
 */
function promptTools(scanResults: ScanResult[]): Promise<string[]> {
  // Non-TTY fallback: auto-select all detected tools (no keyboard available)
  if (!process.stdin.isTTY) {
    const detectedIds = scanResults.filter(r => r.detected).map(r => r.id);
    if (detectedIds.length === 0) {
      console.log('\n  \u{2139}\u{FE0F}  No config files found. Defaulting to Claude Code.');
      return Promise.resolve(['claude-code']);
    }
    console.log('');
    for (const r of scanResults) {
      if (r.detected) {
        console.log(`  \u{2705} ${r.name.padEnd(18)} detected  (auto-selected)`);
      } else {
        console.log(`  \u{2014} ${r.name.padEnd(18)} not detected`);
      }
    }
    console.log('');
    return Promise.resolve(detectedIds);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    // Pre-select all detected tools; none detected → default to claude-code
    const selected: boolean[] = scanResults.map(r => r.detected);
    const hasAnyDetected = scanResults.some(r => r.detected);
    if (!hasAnyDetected) {
      const ccIdx = scanResults.findIndex(r => r.id === 'claude-code');
      if (ccIdx >= 0) selected[ccIdx] = true;
    }

    let cursor = 0;
    let lineCount = 0;

    const clear = () => {
      if (lineCount > 0) {
        process.stdout.write(`\x1b[${lineCount}A\x1b[J`);
        lineCount = 0;
      }
    };

    const render = () => {
      clear();
      const lines: string[] = [];
      lines.push('');
      lines.push('  \u{1F50D} Select AI coding tools to configure:');
      lines.push('');
      for (let i = 0; i < scanResults.length; i++) {
        const r = scanResults[i]!;
        const isCursor = i === cursor;
        const isSelected = selected[i]!;
        const prefix = isCursor ? ' ❯' : '  ';
        const check = isSelected ? '\x1b[32m[✓]\x1b[0m' : '\x1b[90m[ ]\x1b[0m';
        const status = r.detected ? `  \x1b[32mdetected\x1b[0m` : `  \x1b[90mnot detected\x1b[0m`;
        const pathInfo = r.detected ? ` \x1b[90m${r.configPath.replace(homedir(), '~')}\x1b[0m` : '';
        lines.push(`${prefix}${check} ${r.name}${pathInfo}${status}`);
      }
      lines.push('');
      if (!hasAnyDetected) {
        lines.push('  \x1b[33m\u{26A0}  No config files found. Select a tool to create its config.\x1b[0m');
      }
      lines.push('  \x1b[90m↑/↓ navigate  Space toggle  Enter confirm | Ctrl+C cancel\x1b[0m');
      const out = '\n' + lines.join('\n') + '\n';
      process.stdout.write(out);
      lineCount = lines.length + 1;
    };

    render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const onKeypress = (_str: string, key: readline.Key) => {
      if (key.name === 'up') {
        cursor = (cursor - 1 + scanResults.length) % scanResults.length;
        render();
      } else if (key.name === 'down') {
        cursor = (cursor + 1) % scanResults.length;
        render();
      } else if (key.name === 'space') {
        selected[cursor] = !selected[cursor];
        render();
      } else if (key.name === 'return') {
        cleanup();
        clear();
        const chosen = scanResults.filter((_, i) => selected[i]).map(r => r.id);
        if (chosen.length === 0) {
          // User deselected everything — default to claude-code
          resolve(['claude-code']);
        } else {
          resolve(chosen);
        }
      } else if (key.name === 'c' && key.ctrl) {
        cleanup();
        console.log('\n  Cancelled.\n');
        process.exit(0);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
    };

    process.stdin.on('keypress', onKeypress);
  });
}

// ── CC Hook injector (merge-aware) ─────────────────────────────────────

export interface HookEntry {
  type: string;
  command: string;
  async?: boolean;
  timeout?: number;
}

/**
 * Inject an AGPA hook command into a CC settings.json hook key.
 * Merges with existing hook entries rather than overwriting.
 * Returns true if the command was newly injected, false if already present.
 */
export function injectHook(
  hooks: Record<string, unknown>,
  key: string,
  command: string,
  opts?: HookEntry,
): boolean {
  const matchers = (hooks[key] as Array<Record<string, unknown>>) || [];
  if (matchers.length === 0) {
    // Create new hook entry
    hooks[key] = [{
      matcher: '*',
      hooks: [opts || { type: 'command', command, async: true, timeout: 5 }],
    }];
    return true;
  }

  // Deduplicate: check if this command already exists in any matcher
  const existingCmds = new Set<string>();
  for (const m of matchers) {
    for (const h of (m.hooks as Array<{ type: string; command: string }>) || []) {
      if (h.type === 'command') existingCmds.add(h.command);
    }
  }
  if (existingCmds.has(command)) return false;

  // Append to the first matcher's hooks array
  const firstMatcher = matchers[0] as Record<string, unknown> | undefined;
  if (!firstMatcher) return false;
  let mHooks = firstMatcher.hooks as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(mHooks)) {
    mHooks = [];
    firstMatcher.hooks = mHooks;
  }
  // Ensure matcher field exists
  if (!firstMatcher.matcher) firstMatcher.matcher = '*';
  mHooks.push((opts || { type: 'command', command, async: true, timeout: 5 }) as unknown as Record<string, unknown>);
  return true;
}

/**
 * All CC hook keys that AGPA needs, with their commands and settings.
 */
export function getHookKeys(profile: string | null): Array<{ key: string; command: string; async?: boolean; timeout?: number }> {
  return [
    { key: 'SessionStart',       command: hookCmd(HOOK_ENV, 'track session.start', profile),               async: false },
    { key: 'UserPromptSubmit',   command: hookCmd(HOOK_ENV, 'auto', profile),                               async: false },
    { key: 'Stop',               command: `${hookCmd(HOOK_ENV, 'track session.end', profile)} && ${hookCmd(HOOK_ENV, 'poll', profile)}`, async: true, timeout: 15 },
    { key: 'PostToolUse',        command: hookCmd(HOOK_ENV, 'auto', profile) },
    { key: 'PreToolUse',         command: hookCmd(HOOK_ENV, 'auto', profile) },
    { key: 'PostToolUseFailure', command: hookCmd(HOOK_ENV, 'auto', profile) },
    { key: 'TaskCompleted',      command: hookCmd(HOOK_ENV, 'auto', profile) },
    { key: 'SubagentStart',      command: hookCmd(HOOK_ENV, 'auto', profile) },
    { key: 'SubagentStop',       command: hookCmd(HOOK_ENV, 'auto', profile) },
    { key: 'PostCompact',        command: hookCmd(HOOK_ENV, 'auto', profile) },
  ];
}

// ── Init a single tool ─────────────────────────────────────────────────

/**
 * Initialize one AI coding tool with MCP config, instruction files, and hooks.
 */
function initTool(
  toolDef: ToolDef,
  initData: InitToolData,
  profile: string | null,
  lang: string,
  dataDir: string,
  quiet: boolean,
): string | null {
  const label = toolDef.name;

  if (!quiet) {
    console.log(`\n  \u{2500}\u{2500} ${label} \u{2500}\u{2500}`);
  }

  // ── Inject MCP config ──────────────────────────────────────────────
  const configExists = fs.existsSync(toolDef.configPath);
  if (configExists && fs.readFileSync(toolDef.configPath, 'utf-8').includes('agent-achievements')) {
    console.log(`  \u{23ED}  Tracking:  ${toolDef.configPath} (already set up)`);
  } else {
    if (toolDef.configFormat === 'yaml') {
      if (!configExists) {
        console.log(`  \u{1F195} New file: ${toolDef.configPath}`);
        const dir = path.dirname(toolDef.configPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(toolDef.configPath, '');
      }
      const mcpEnv: Record<string, string> = { AGPA_TOOL_SOURCE: toolDef.id };
      if (lang !== 'en') mcpEnv.AGPA_LANG = lang;
      if (profile) mcpEnv.AGPA_PROFILE = profile;
      const injected = injectYamlMCPBlock(toolDef.configPath, 'agent-achievements', {
        command: 'tsx',
        args: [AGPA_MAIN],
        enabled: true,
        env: mcpEnv,
      });
      if (injected) {
        console.log(`  \u{2705} Tracking:  ${toolDef.configPath}`);
      } else {
        console.log(`  \u{23ED}  Tracking:  ${toolDef.configPath} (already set up)`);
      }
    } else {
      let config: Record<string, unknown> | null;
      if (configExists) {
        config = readJSON(toolDef.configPath);
        if (!config) {
          const bak = toolDef.configPath + '.agpa.bak';
          try { fs.copyFileSync(toolDef.configPath, bak); } catch { /* ok */ }
          console.log(`  \u{1F4CB} Backup:    ${bak}`);
          config = {};
        }
      } else {
        console.log(`  \u{1F195} New file: ${toolDef.configPath}`);
        config = {};
      }
      const updated = initData.mcpInject(config);
      // Inject lang & profile into MCP server env
      {
        const mcps = (updated as Record<string, unknown>).mcpServers as Record<string, { env?: Record<string, string> }> | undefined;
        const server = mcps?.['agent-achievements'];
        if (server?.env) {
          if (lang !== 'en') server.env.AGPA_LANG = lang;
          if (profile) server.env.AGPA_PROFILE = profile;
        }
        // OpenClaw uses .mcp.servers instead of .mcpServers
        const mcp = (updated as Record<string, unknown>).mcp as Record<string, Record<string, { env?: Record<string, string> }>> | undefined;
        const altServers = mcp?.servers;
        const altServer = altServers?.['agent-achievements'];
        if (altServer?.env) {
          if (lang !== 'en') altServer.env.AGPA_LANG = lang;
          if (profile) altServer.env.AGPA_PROFILE = profile;
        }
      }
      writeJSON(toolDef.configPath, updated);
      console.log(`  \u{2705} Tracking:  ${toolDef.configPath}`);
    }
  }

  // ── Inject instruction files ────────────────────────────────────────
  for (const inst of initData.instructionFiles) {
    const injected = injectInstructions(inst.path, inst.marker);
    if (injected) {
      console.log(`  \u{2705} Instructions: ${inst.path}`);
    } else {
      console.log(`  \u{23ED}  Instructions: ${inst.path} (already present)`);
    }
  }

  // ── Inject CC hooks (merge-aware, only for claude-code) ────────────
  if (toolDef.id === 'claude-code') {
    let hookCfg = readJSON(toolDef.configPath);
    if (!hookCfg) {
      console.log(`  \u{26A0}  Auto-track cannot read ${toolDef.configPath} \u{2014} skipping`);
    } else {
      const hooks = (hookCfg.hooks as Record<string, unknown>) || {};
      const injectedKeys: string[] = [];

      for (const hk of getHookKeys(profile)) {
        const opts: HookEntry = { type: 'command', command: hk.command };
        if (hk.async !== undefined) opts.async = hk.async;
        if (hk.timeout !== undefined) opts.timeout = hk.timeout;
        if (injectHook(hooks, hk.key, hk.command, opts)) {
          injectedKeys.push(hk.key);
        }
      }

      if (injectedKeys.length > 0) {
        hookCfg.hooks = hooks;
        writeJSON(toolDef.configPath, hookCfg);
        console.log(`  \u{2705} Auto-track (${injectedKeys.length} hooks)`);
      } else {
        console.log(`  \u{23ED}  Auto-track (already present)`);
      }
    }
  }

  // ── Inject Hermes shell hooks (YAML config) ─────────────────────────
  if (toolDef.id === 'hermes') {
    const cfgPath = toolDef.configPath;
    if (fs.existsSync(cfgPath) && !fs.readFileSync(cfgPath, 'utf-8').includes('agpa-hermes-hook')) {
      const injected = injectHermesHooks(cfgPath, {
        pre_tool_call:     hookCmd(HOOK_HERMES_ENV, 'hermes-auto', profile),
        post_tool_call:    hookCmd(HOOK_HERMES_ENV, 'hermes-auto', profile),
        on_session_start:  hookCmd(HOOK_HERMES_ENV, 'track session.start', profile),
        on_session_end:    `${hookCmd(HOOK_HERMES_ENV, 'track session.end', profile)} && ${hookCmd(HOOK_HERMES_ENV, 'poll', profile)}`,
      });
      if (injected) {
        console.log(`  \u{2705} Auto-track (4 hooks)`);
      }
    } else {
      console.log(`  \u{23ED}  Auto-track (already present or config missing)`);
    }
  }

  // ── Inject OpenClaw TS plugin ──────────────────────────────────────
  if (toolDef.id === 'openclaw') {
    const injected = injectOpenClawPlugin(profile);
    if (injected) {
      console.log(`  ✅ Auto-track (TS plugin)`);
    } else {
      console.log(`  ⏭  Auto-track (plugin already present)`);
    }
  }

  // ── Inject Kilo Code / OpenCode TS plugin ──────────────────────────
  if (toolDef.id === 'kilo-code' || toolDef.id === 'opencode') {
    const injected = injectKiloCodePlugin(toolDef.id, profile);
    if (injected) {
      console.log(`  ✅ Auto-track (TS plugin)`);
    } else {
      console.log(`  ⏭  Auto-track (plugin already present)`);
    }
  }

  return toolDef.name;
}

// ── Hook launcher script ─────────────────────────────────────────────

/**
 * Write a launcher shell script to ~/.agent-achievements/run-hook.sh
 * that cd's to the AGPA project dir and runs hook.ts.
 *
 * This is the indirection layer between the globally-configured CC hooks
 * (which live in ~/.claude/settings.json) and the local AGPA project
 * installation. If the user moves the project, they re-run `agpa init`
 * from the new location and the launcher is regenerated — no need to
 * manually edit settings.json.
 */
function writeHookLauncher(): void {
  const launcherPath = path.join(AGPA_DIR, 'run-hook.sh');
  const script = [
    '#!/bin/bash',
    '# AGPA hook launcher — regenerated by agpa init / agpa init --upgrade',
    `cd ${JSON.stringify(AGPA_ROOT)} || exit 1`,
    'exec ./node_modules/.bin/tsx src/cli/hook.ts "$@"',
    '',
  ].join('\n');
  fs.mkdirSync(AGPA_DIR, { recursive: true });
  fs.writeFileSync(launcherPath, script, { mode: 0o755 });
}

// ── Achievement commands & JSON compilation ────────────────────────────

/**
 * Copy /achievements and /achievements-settings command files to
 * ~/.claude/commands/ so they're available globally in Claude Code sessions.
 */
function installAchievementCommands(): boolean {
  const srcDir = path.join(AGPA_ROOT, '.claude', 'commands');
  const destDir = path.join(homedir(), '.claude', 'commands');
  const files = ['achievements.md', 'achievements-settings.md'];

  fs.mkdirSync(destDir, { recursive: true });

  let installed = 0;
  let alreadyPresent = 0;
  for (const f of files) {
    const src = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    if (!fs.existsSync(src)) continue;
    const srcContent = fs.readFileSync(src, 'utf-8');
    // Skip if already installed and unchanged
    if (fs.existsSync(dest)) {
      const destContent = fs.readFileSync(dest, 'utf-8');
      if (destContent === srcContent) { alreadyPresent++; continue; }
    }
    fs.writeFileSync(dest, srcContent);
    installed++;
  }

  if (installed > 0) {
    console.log(`  \u{2705} Commands:  /achievements, /achievements-settings`);
  } else if (alreadyPresent > 0) {
    console.log(`  \u{23ED}  Commands:  (already present)`);
  }

  return installed > 0 || alreadyPresent > 0;
}

/**
 * Compile YAML achievement definitions → JSON snapshot in the state dir.
 * Claude command files read this JSON to know metadata (Claude can't parse YAML).
 * Returns compiled file path and the count of achievements found.
 */
function compileAchievementsJSON(dataDir: string): { path: string; count: number } | null {
  const yamlPath = path.join(AGPA_ROOT, 'achievement-definitions.yaml');
  if (!fs.existsSync(yamlPath)) return null;

  const yamlText = fs.readFileSync(yamlPath, 'utf-8');
  const { definitions, sets } = parseYAML(yamlText);

  const CATEGORY_META: Record<string, { name: string; name_cn: string; order: number }> = {
    onboarding: { name: 'Getting Started', name_cn: '入门', order: 1 },
    tool_mastery: { name: 'Tool Mastery', name_cn: '工具精通', order: 2 },
    workflow: { name: 'Workflow', name_cn: '工作流', order: 3 },
    milestones: { name: 'Milestones', name_cn: '里程碑', order: 4 },
    skill: { name: 'Skills', name_cn: '技能', order: 5 },
    creator: { name: 'Creator', name_cn: '创造者', order: 6 },
    challenge: { name: 'Challenge', name_cn: '挑战', order: 7 },
    hidden: { name: 'Hidden', name_cn: '隐藏', order: 8 },
    style: { name: 'Style', name_cn: '风格', order: 9 },
    community: { name: 'Community', name_cn: '社区', order: 10 },
  };

  const byCategory: Record<string, number> = {};
  const byRarity: Record<string, number> = {};
  const bySet: Record<string, string[]> = {};
  for (const d of definitions) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    byRarity[d.rarity] = (byRarity[d.rarity] || 0) + 1;
    if (d.set_id) {
      bySet[d.set_id] = bySet[d.set_id] || [];
      bySet[d.set_id]!.push(d.id);
    }
  }

  const categories: Record<string, { name: string; name_cn?: string; order: number }> = {};
  for (const cat of Object.keys(byCategory)) {
    const meta = CATEGORY_META[cat];
    categories[cat] = meta ? { ...meta } : { name: cat, order: 99 };
  }

  const output = {
    total: definitions.length,
    by_category: byCategory,
    by_rarity: byRarity,
    by_set: bySet,
    categories,
    sets: sets.map(s => ({ id: s.id, name: s.name, name_cn: s.name_cn, achievements: s.achievements })),
    achievements: definitions.map(d => ({
      id: d.id,
      name: d.name,
      name_cn: d.name_cn,
      description: d.description,
      description_cn: d.description_cn,
      icon: d.icon,
      category: d.category,
      rarity: d.rarity,
      hidden: d.hidden,
      set_id: d.set_id,
      tip: d.tip,
      tip_cn: d.tip_cn,
      hint: d.hint,
      hint_cn: d.hint_cn,
      future: d.future,
      challenge: d.challenge,
      progress_trackable: d.progress_trackable,
    })),
  };

  const outPath = path.join(dataDir, 'achievements.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  return { path: outPath, count: definitions.length };
}

// ── Welcome banner ─────────────────────────────────────────────────────

function printWelcome(): void {
  let version = '0.1.x';
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    version = pkg.version;
  } catch { /* use default */ }

  console.log('');
  console.log('  🏆  AGPA — Agent Player Achievements');
  console.log(`  🎮  gamified achievement tracking for AI coding tools  v${version}`);
  console.log('');
}

// ── Preflight ────────────────────────────────────────────────────────────

function runPreflight(): boolean {
  let ok = true;

  // Node.js >= 18
  const majorMatch = process.version.match(/^v(\d+)/);
  const major = majorMatch ? parseInt(majorMatch[1]!, 10) : 0;
  if (major < 18) {
    console.log(`  \u{274C} Node.js ${process.version} \u{2014} need ≥ 18.0.0`);
    console.log('     Fix: brew install node@20  or  nvm install 20');
    ok = false;
  }

  // tsx available (local install)
  if (!fs.existsSync(TSX_BIN)) {
    console.log(`  \u{274C} tsx not found \u{2014} run: npm install`);
    ok = false;
  }

  return ok;
}

// ── Language picker ──────────────────────────────────────────────────────

const LANG_CHOICES = [
  { label: 'English',  value: 'en' },
  { label: '中文',     value: 'zh' },
];

/**
 * Arrow-key language picker. Returns "en" or "zh".
 * Only shows when stdin is a TTY; otherwise default to "en".
 */
function promptLanguage(): Promise<string> {
  if (!process.stdin.isTTY) return Promise.resolve('en');

  return new Promise((resolve) => {
    let selected = 0;
    let lineCount = 0;

    const rl = readline.createInterface({
      input: process.stdin,
      escapeCodeTimeout: 50,
    });

    const clear = () => {
      if (lineCount > 0) {
        process.stdout.write(`[${lineCount}A[J`);
        lineCount = 0;
      }
    };

    const render = () => {
      clear();
      const lines: string[] = [];
      lines.push('  \u{1F310} Language / \u{8BED}\u{8A00}');
      for (let i = 0; i < LANG_CHOICES.length; i++) {
        const prefix = i === selected ? '  ❯' : '   ';
        lines.push(`${prefix} ${LANG_CHOICES[i]!.label}`);
      }
      const out = '\n' + lines.join('\n') + '\n';
      process.stdout.write(out);
      lineCount = lines.length + 1; // +1 for the leading \n
    };

    render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const onKeypress = (_str: string, key: readline.Key) => {
      if (key.name === 'up') {
        selected = (selected - 1 + LANG_CHOICES.length) % LANG_CHOICES.length;
        render();
      } else if (key.name === 'down') {
        selected = (selected + 1) % LANG_CHOICES.length;
        render();
      } else if (key.name === 'return') {
        cleanup();
        clear();
        resolve(LANG_CHOICES[selected]!.value);
      } else if (key.name === 'c' && key.ctrl) {
        process.exit(0);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
    };

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Auto-verify after init — runs a quick health check and returns a summary line.
 * toolIds limits MCP config checks to only the tools the user configured,
 * so users don't see misleading warnings for tools they didn't set up.
 */
function autoVerify(dataDir: string, toolIds: string[]): string | null {
  const results = [
    checkDataDir(dataDir),
    checkStateJson(dataDir),
    checkDefsYaml(),
    // Only check MCP configs for tools the user just configured
    ...checkMcpConfigs().filter(r => {
      const toolId = r.id.startsWith('mcp-') ? r.id.slice(4) : '';
      return toolIds.includes(toolId) || !r.id.startsWith('mcp-');
    }),
    ...checkInstructionFiles(),
  ];

  const errors = results.filter(r => r.status === 'error');
  const warns = results.filter(r => r.status === 'warn');
  const oks = results.filter(r => r.status === 'ok');

  const lines: string[] = [];
  lines.push(`\n  ${'─'.repeat(51)}`);
  lines.push(`  Auto-verify: ${oks.length}/${results.length} checks passed`);

  if (errors.length > 0) {
    for (const e of errors) {
      lines.push(`  ${statusIcon('error')} ${e.label}: ${e.detail}`);
    }
  }
  if (warns.length > 0 && warns.length <= 3) {
    for (const w of warns) {
      lines.push(`  ${statusIcon('warn')} ${w.label}: ${w.detail}`);
    }
  } else if (warns.length > 3) {
    lines.push(`  ${statusIcon('warn')} ${warns.length} warnings — run 'agpa verify' for details`);
  }

  if (errors.length === 0 && warns.length === 0) {
    lines.push(`  ${'─'.repeat(51)}`);
  } else {
    lines.push(`  ${'─'.repeat(51)}`);
    if (errors.length > 0) {
      lines.push(`  Run 'agpa verify' for fix suggestions.`);
    }
  }

  return lines.join('\n');
}

// ── Phase indicator helper ──────────────────────────────────────────────

function printPhase(num: number, total: number, label: string): void {
  const DIM = '\x1b[2m';
  const RST = '\x1b[0m';
  const BLD = '\x1b[1m';
  const CYN = '\x1b[36m';
  console.log(`\n  ${CYN}${BLD}═══ Phase ${num}/${total}: ${label} ═══${RST}\n`);
}

// ── Dashboard daemon opt-in prompt ──────────────────────────────────────

async function promptDaemon(lang: string, auto: boolean): Promise<void> {
  if (!process.stdin.isTTY || auto) return;
  if (isDaemonInstalled()) return; // already installed, skip

  const isZh = lang === 'zh';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise(resolve => {
    console.log('');
    console.log(isZh
      ? '  🎮 开机自动启动 Dashboard？(y/N)'
      : '  🎮 Auto-start Dashboard on login? (y/N)');
    console.log(isZh
      ? '     （崩溃或重启后自动恢复，默认不开启）'
      : '     (auto-restarts on crash/reboot, default: no)');
    const question = isZh ? '  自动启动？(y/N) ' : '  Auto-start? (y/N) ';
    rl.question(question, (answer: string) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'y' || trimmed === 'yes') {
        const { ok, message } = installDaemon();
        console.log(ok ? `  ✅ ${message}` : `  ⚠ ${message}`);
      } else {
        console.log(isZh
          ? '  ⏭  跳过——随时可以用 agpa web --daemon 手动开启'
          : '  ⏭  Skipped — enable anytime with agpa web --daemon');
      }
      resolve();
    });
  });
}

// ── Shell completion install prompt ──────────────────────────────────────

async function promptCompletion(lang: string, auto: boolean): Promise<void> {
  if (!process.stdin.isTTY || auto) return;

  const isZh = lang === 'zh';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise(resolve => {
    console.log('');
    console.log(isZh
      ? '  💡 要安装命令自动补全吗？（tab 键提示 agpa 命令）'
      : '  💡 Install shell tab-completion for agpa commands?');
    const question = isZh ? '  安装 shell 补全？(Y/n) ' : '  Install shell completion? (Y/n) ';

    rl.question(question, (answer: string) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '' || trimmed === 'y' || trimmed === 'yes') {
        // Detect shell and install
        const shell = process.env.SHELL || '';
        const home = homedir();

        if (shell.includes('zsh')) {
          const rcFile = path.join(home, '.zshrc');
          const marker = 'source <(COMP_WORDS="" agpa completion zsh)';
          let content = '';
          if (fs.existsSync(rcFile)) content = fs.readFileSync(rcFile, 'utf-8');
          if (!content.includes('agpa completion')) {
            const newContent = content.trimEnd() + '\n\n# AGPA shell completion\nautoload -Uz compinit && compinit\n' + marker + '\n';
            fs.writeFileSync(rcFile, newContent);
            console.log(isZh
              ? `  ✅ 补全已添加到 ${rcFile}（重启终端生效）`
              : `  ✅ Completion added to ${rcFile} (restart terminal)`);
          } else {
            console.log(isZh ? '  ⏭  已安装' : '  ⏭  Already installed');
          }
        } else if (shell.includes('bash')) {
          const rcFile = path.join(home, '.bashrc');
          const marker = 'source <(agpa completion bash)';
          let content = '';
          if (fs.existsSync(rcFile)) content = fs.readFileSync(rcFile, 'utf-8');
          if (!content.includes('agpa completion')) {
            const newContent = content.trimEnd() + '\n\n# AGPA shell completion\n' + marker + '\n';
            fs.writeFileSync(rcFile, newContent);
            console.log(isZh
              ? `  ✅ 补全已添加到 ${rcFile}（重启终端生效）`
              : `  ✅ Completion added to ${rcFile} (restart terminal)`);
          } else {
            console.log(isZh ? '  ⏭  已安装' : '  ⏭  Already installed');
          }
        } else if (shell.includes('fish')) {
          const fishDir = path.join(home, '.config', 'fish', 'completions');
          fs.mkdirSync(fishDir, { recursive: true });
          const dest = path.join(fishDir, 'agpa.fish');
          if (!fs.existsSync(dest)) {
            const completionScript = path.resolve(import.meta.dirname, 'completion.ts');
            const result = spawnSync(TSX_BIN, [completionScript, 'fish'], { stdio: ['ignore', 'pipe', 'pipe'] });
            if (result.status === 0 && result.stdout) {
              fs.writeFileSync(dest, result.stdout.toString());
              console.log(isZh
                ? `  ✅ 补全已安装到 ${dest}`
                : `  ✅ Completion installed: ${dest}`);
            }
          } else {
            console.log(isZh ? '  ⏭  已安装' : '  ⏭  Already installed');
          }
        } else {
          console.log(isZh
            ? '  ⚠️  无法检测 shell。运行: agpa completion <bash|zsh|fish>'
            : '  ⚠️  Unknown shell. Run: agpa completion <bash|zsh|fish>');
        }
        console.log('');
      } else {
        console.log(isZh ? '  ⏭  跳过' : '  ⏭  Skipped\n');
      }
      resolve();
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { tool: toolArg, profile: cliProfile, auto, upgrade } = parseCliArgs();

  printWelcome();

  // --upgrade mode: re-inject hooks, instructions, commands, achievement JSON
  if (upgrade) {
    const lang = loadConfig().lang === 'zh' ? 'zh' : 'en';
    const profile = cliProfile || DEFAULT_PROFILE;

    // Detect what's installed from existing configs
    const scanResults = scanTools();
    const detectedIds = scanResults.filter(r => r.detected).map(r => r.id);
    const toolIds = toolArg ? [toolArg] : (detectedIds.length > 0 ? detectedIds : ['claude-code']);

    const DIM = '\x1b[2m';
    const RESET = '\x1b[0m';
    console.log(lang === 'zh' ? `\n  \u{1F504} 升级模式 — 刷新 hooks + instructions + commands` : `\n  \u{1F504} Upgrade mode — refreshing hooks + instructions + commands`);
    console.log(`  ${DIM}  MCP configs will not be touched.${RESET}`);
    console.log(`  ${DIM}  Profile: ${profile}${RESET}`);

    const dataDir = profile === DEFAULT_PROFILE
      ? AGPA_DIR
      : path.join(AGPA_DIR, 'profiles', profile);
    ensureDataDir(dataDir);
    initEngineState();
    copySounds(dataDir);
    writeHookLauncher();

    // Re-run instruction injection for each tool
    for (const tid of toolIds) {
      const toolDef = findTool(tid);
      if (!toolDef) continue;
      const initData = INIT_DATA[toolDef.id];
      if (!initData) continue;

      for (const inst of initData.instructionFiles) {
        injectInstructions(inst.path, inst.marker);
      }

      // Re-inject hooks for CC
      if (toolDef.id === 'claude-code') {
        let hookCfg = readJSON(toolDef.configPath);
        if (hookCfg) {
          const hooks = (hookCfg.hooks as Record<string, unknown>) || {};
          for (const hk of getHookKeys(profile === DEFAULT_PROFILE ? null : profile)) {
            const opts: HookEntry = { type: 'command', command: hk.command };
            if (hk.async !== undefined) opts.async = hk.async;
            if (hk.timeout !== undefined) opts.timeout = hk.timeout;
            injectHook(hooks, hk.key, hk.command, opts);
          }
          hookCfg.hooks = hooks;
          writeJSON(toolDef.configPath, hookCfg);
        }
      }

      // Re-inject Hermes hooks
      if (toolDef.id === 'hermes') {
        injectHermesHooks(toolDef.configPath, {
          pre_tool_call:     hookCmd(HOOK_HERMES_ENV, 'hermes-auto', profile === DEFAULT_PROFILE ? null : profile),
          post_tool_call:    hookCmd(HOOK_HERMES_ENV, 'hermes-auto', profile === DEFAULT_PROFILE ? null : profile),
          on_session_start:  hookCmd(HOOK_HERMES_ENV, 'track session.start', profile === DEFAULT_PROFILE ? null : profile),
          on_session_end:    `${hookCmd(HOOK_HERMES_ENV, 'track session.end', profile === DEFAULT_PROFILE ? null : profile)} && ${hookCmd(HOOK_HERMES_ENV, 'poll', profile === DEFAULT_PROFILE ? null : profile)}`,
        });
      }

      // Re-inject plugins
      if (toolDef.id === 'openclaw') injectOpenClawPlugin(profile === DEFAULT_PROFILE ? null : profile);
      if (toolDef.id === 'kilo-code' || toolDef.id === 'opencode') injectKiloCodePlugin(toolDef.id, profile === DEFAULT_PROFILE ? null : profile);
    }

    // Commands + JSON
    installAchievementCommands();
    compileAchievementsJSON(dataDir);

    console.log(`\n  \u{2705} ${lang === 'zh' ? '升级完成！' : 'Upgrade complete!'}`);
    console.log(`  ${DIM}  ${lang === 'zh' ? '重启工具以生效。' : 'Restart your tools to activate.'}${RESET}\n`);
    return;
  }

  if (!runPreflight()) {
    process.exit(1);
  }

  printPhase(1, 3, 'Detecting tools & preferences');

  // --auto mode: skip all interactive prompts
  const lang = auto ? 'en' : await promptLanguage();

  // If --profile was passed on CLI, use it. Otherwise prompt interactively (skip in --auto).
  let profile: string;
  if (cliProfile) {
    const error = validateProfileName(cliProfile);
    if (error) {
      console.log(`  \x1b[33m⚠ ${error}\x1b[0m`);
      console.log(lang === 'zh' ? '  ✅ 回退到 default profile' : '  ✅ Falling back to default profile');
      profile = DEFAULT_PROFILE;
    } else {
      profile = cliProfile;
    }
  } else if (auto) {
    console.log('  📂 Auto mode: using default profile');
    profile = DEFAULT_PROFILE;
  } else {
    profile = await promptProfileName(lang);
  }

  // Determine which tools to configure
  let toolIds: string[];
  if (toolArg) {
    // Explicit --tool: use that tool directly
    toolIds = [toolArg];
    const toolDef = findTool(toolArg);
    if (toolDef) {
      console.log(`  🎯 Configuring: ${toolDef.name}`);
    }
    console.log('');

    // Persist tracked_tools for this profile
    if (profile === DEFAULT_PROFILE) {
      // Default profile: merge with all detected tools + the explicit one
      const detected = scanTools().filter(r => r.detected).map(r => r.id);
      const merged = [...new Set([...detected, ...toolIds])];
      setTrackedTools(profile, merged.length > 0 ? merged : toolIds);
    } else {
      // Named profile: union existing tracked tools with the newly added one
      const existing = getProfileMeta(profile).tracked_tools || [];
      const merged = [...new Set([...existing, ...toolIds])];
      setTrackedTools(profile, merged);
    }
  } else if (auto) {
    // --auto mode: auto-select all detected tools (same as non-TTY fallback)
    const scanResults = scanTools();
    const detectedIds = scanResults.filter(r => r.detected).map(r => r.id);
    if (detectedIds.length === 0) {
      console.log('\n  ℹ️  No config files found. Defaulting to Claude Code.\n');
      toolIds = ['claude-code'];
    } else {
      console.log('');
      for (const r of scanResults) {
        if (r.detected) {
          console.log(`  ✅ ${r.name.padEnd(18)} detected  (auto-selected)`);
        } else {
          console.log(`  — ${r.name.padEnd(18)} not detected`);
        }
      }
      console.log('');
      toolIds = detectedIds;
    }
    // Persist tracked_tools
    const allDetected = scanTools().filter(r => r.detected).map(r => r.id);
    setTrackedTools(profile, allDetected.length > 0 ? allDetected : ['claude-code']);
  } else {
    // No --tool: scan + interactive picker
    const scanResults = scanTools();
    toolIds = await promptTools(scanResults);
    console.log('');
    console.log(`  ✅ Selected: ${toolIds.length} tool(s)`);
    console.log('');

    // Persist tracked_tools to profile metadata
    if (profile === DEFAULT_PROFILE) {
      // Default profile: track all detected tools
      const detectedIds = scanResults.filter(r => r.detected).map(r => r.id);
      const allIds = detectedIds.length > 0 ? detectedIds : ['claude-code'];
      setTrackedTools(profile, allIds);
    } else {
      // Named profile: track exactly what user selected
      setTrackedTools(profile, toolIds);
    }
  }

  // Shared data directory (DEFAULT_PROFILE "default" → legacy dir, named → profiles/<name>)
  const dataDir = (profile && profile !== DEFAULT_PROFILE)
    ? path.join(AGPA_DIR, 'profiles', profile)
    : AGPA_DIR;
  if (profile) {
    console.log(`  👤 Profile:   ${profile}`);
    console.log(`  📂 Data:      ${dataDir}`);
    console.log('');
  }
  ensureDataDir(dataDir);
  initEngineState();
  copySounds(dataDir);
  writeHookLauncher();

  // ── macOS: auto-install terminal-notifier for clickable notifications ──
  if (process.platform === 'darwin') {
    const intelPath = '/usr/local/bin/terminal-notifier';
    const armPath = '/opt/homebrew/bin/terminal-notifier';
    if (!fs.existsSync(intelPath) && !fs.existsSync(armPath)) {
      // Check if Homebrew is available
      let brewOk = false;
      try {
        spawnSync('brew', ['--version'], { stdio: 'ignore' });
        brewOk = true;
      } catch { /* brew not installed */ }

      if (brewOk) {
        console.log('\n  🍺 Installing terminal-notifier (for clickable achievement notifications)...');
        try {
          spawnSync('brew', ['install', '--quiet', 'terminal-notifier'], { stdio: 'pipe' });
          console.log('     ✓ terminal-notifier installed');
        } catch {
          console.log('     ⚠️  brew install failed — notifications will use built-in fallback');
        }
      } else {
        console.log('');
        console.log('  💡 For clickable achievement notifications, install Homebrew:');
        console.log('     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
        console.log('     Then: brew install terminal-notifier');
      }
    }
  }

  printPhase(2, 3, 'Configuring tools');

  const configuredTools: string[] = [];
  const multiTool = toolIds.length > 1;

  for (const tid of toolIds) {
    const toolDef = findTool(tid);
    if (!toolDef) {
      console.error(`  \u{2716} Unknown tool: "${tid}"`);
      continue;
    }
    const initData = INIT_DATA[toolDef.id];
    if (!initData) {
      console.error(`  \u{2716} No init data for tool: "${toolDef.id}"`);
      continue;
    }

    const name = initTool(toolDef, initData, profile, lang, dataDir, !multiTool);
    if (name) configuredTools.push(name);
  }

  // ── Achievement commands & JSON ──
  let commandsInstalled = false;
  let jsonCompiled: string | null = null;
  commandsInstalled = installAchievementCommands();
  jsonCompiled = compileAchievementsJSON(dataDir);

  // ── Summary ──────────────────────────────────────────────────────────
  const toolList = configuredTools.join(', ');
  const toolCount = configuredTools.length;
  const toolLine = toolCount > 1
    ? `${toolCount} tools configured`
    : `Tool:      ${configuredTools[0]!}`;
  const W = 51;

  console.log(`\n  \u{250C}${'\u{2500}'.repeat(W)}\u{2510}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2502}  \u{1F389}  AGPA is ready!                              \u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2502}  ${toolLine.padEnd(47)}\u{2502}`);
  const langLabel = `Language: ${lang === 'zh' ? '中文' : 'English'}`;
  console.log(`  \u{2502}  ${langLabel.padEnd(47)}\u{2502}`);
  // Truncate long dataDir paths so the box doesn't break
  const maxPath = 38;
  const shortPath = dataDir.length > maxPath
    ? '…' + dataDir.slice(-(maxPath - 1))
    : dataDir.padEnd(maxPath);
  console.log(`  \u{2502}  Data:    ${shortPath}\u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2502}  \u{26A0}\u{FE0F}  Restart your AI tool to activate            \u{2502}`);
  console.log(`  \u{2502}     Achievements won\u{2019}t track until you do       \u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2502}  After restart:                                  \u{2502}`);
  console.log(`  \u{2502}    agpa verify        quick health check          \u{2502}`);
  if (commandsInstalled) {
    console.log(`  \u{2502}    /achievements      view progress in chat       \u{2502}`);
  }
  console.log(`  \u{2502}    agpa dashboard     browse all 160 achievements \u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2502}    \u{1F6AE} To remove:    agpa uninstall --all           \u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  if (jsonCompiled) {
    console.log(`  \u{2502}  \u{1F4E6} 160 achievements compiled — /achievements ready  \u{2502}`);
    console.log(`  \u{2502}                                                 \u{2502}`);
  }
  console.log(`  \u{2502}  \u{1F4A1} Your first achievement unlocks the moment    \u{2502}`);
  console.log(`  \u{2502}     you send your first message!                  \u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2514}${'\u{2500}'.repeat(W)}\u{2518}`);

  printPhase(3, 3, 'Verification');

  // ── Auto-verify after init ────────────────────────────────────────────
  const verifyResults = autoVerify(dataDir, toolIds);
  if (verifyResults) console.log(verifyResults);

  // ── Daemon opt-in ─────────────────────────────────────────────────────
  await promptDaemon(lang, auto);

  // ── Shell completion prompt ───────────────────────────────────────────
  await promptCompletion(lang, auto);
}

const isDirectlyExecuted = process.argv[1]
  && (import.meta.url.endsWith(process.argv[1]!)
      || process.argv[1]!.endsWith('init.ts')
      || process.argv[1]!.endsWith('init.js')
      || process.argv[2] === 'init');   // routed via agpa index.ts dispatch
if (isDirectlyExecuted) {
  main().catch((err: unknown) => {
    console.error((err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });
}
