#!/usr/bin/env node
/**
 * AGPA Init — detect & configure AI coding tools for achievement tracking
 *
 * Usage:
 *   npx tsx src/cli/init.ts               Auto-detect & configure all tools
 *   npx tsx src/cli/init.ts --tool <tool>  Configure a specific tool
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { homedir } from 'node:os';
import { TOOLS, findTool, INSTRUCTION_FILES } from '../tool-registry.js';
import type { ToolDef } from '../tool-registry.js';
import { parseYAML } from '../engine/yaml-parser.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');
const AGPA_MAIN = path.resolve(import.meta.dirname, '../main.ts');
const AGPA_HOOK = path.resolve(import.meta.dirname, 'hook.ts');
const AGPA_ROOT = path.resolve(import.meta.dirname, '../..');
const TSX_BIN = path.resolve(import.meta.dirname, '../../node_modules/.bin/tsx');

/** Build hook command with optional profile env var */
function hookCmd(toolSourceEnv: string, mode: string, profile: string | null): string {
  const profileEnv = profile ? `AGPA_PROFILE=${profile} ` : '';
  return `${profileEnv}${toolSourceEnv} ${TSX_BIN} ${AGPA_HOOK} ${mode}`;
}

const HOOK_ENV = 'AGPA_TOOL_SOURCE=claude-code';
const HOOK_HERMES_ENV = 'AGPA_TOOL_SOURCE=hermes';
const HOOK_OPENCLAW_ENV = 'AGPA_TOOL_SOURCE=openclaw';
const HOOK_KILOCODE_ENV = 'AGPA_TOOL_SOURCE=kilocode';
// Profile-aware versions built dynamically in getHookKeys() and Hermes/OpenClaw init

// ── Per-tool init data (mcpInject + instructionFiles) ──────────────────

interface InitToolData {
  mcpInject: (config: Record<string, unknown>) => Record<string, unknown>;
  instructionFiles: Array<{ path: string; marker: string }>;
}

const INIT_DATA: Record<string, InitToolData> = {
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
      { path: path.join(homedir(), '.claude', 'CLAUDE.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING -->' },
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
      { path: path.join(process.cwd(), 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING -->' },
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
      { path: path.join(process.cwd(), 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING -->' },
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
      { path: path.join(process.cwd(), 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING -->' },
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
      { path: path.join(process.cwd(), 'AGENTS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING -->' },
      { path: path.join(homedir(), '.openclaw', 'workspace', 'TOOLS.md'), marker: '<!-- AGPA ACHIEVEMENT TRACKING -->' },
    ],
  },
};

// ── Instruction template ──────────────────────────────────────────────

const INSTRUCTION_BLOCK = `<!-- AGPA ACHIEVEMENT TRACKING -->
## 🏆 Achievement Tracking (AGPA)

This project uses AGPA (Agent Player Achievements). Most tool/file/session events are auto-tracked via CC hooks.

### Events to track manually

Call \`achievement_track\` when you observe these:

**Each user turn (before processing):**
- Each time the user sends you a message → \`user.message\`

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
2. **If poll returns achievements**, display them proudly with icon + name + description
3. \`achievement_stats\` — optional, if user asks about progress
<!-- /AGPA ACHIEVEMENT TRACKING -->`;

// ── Helpers ────────────────────────────────────────────────────────────

function parseCliArgs(): { tool: string | null; profile: string | null } {
  const args = process.argv.slice(2);
  let tool: string | null = null;
  let profile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) {
      tool = args[i + 1]!;
      i++;
    } else if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]!;
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return { tool, profile };
}

function printHelp(): void {
  console.log(`
🏆 AGPA Init — Connect AI coding tools to the achievement system

Usage:
  npx tsx src/cli/init.ts               Auto-detect & configure all tools
  npx tsx src/cli/init.ts --tool <name>  Configure a specific tool

Tools:
  claude-code, cc        Claude Code
  kilocode, kilo         Kilo Code
  hermes, ha             Hermes Agent
  opencode, oc           OpenCode
  openclaw, claw         OpenClaw

Options:
  --profile <name>       Use a named profile (default: "default")
  --help, -h             Show this help

Without --tool, scans existing config files and configures all tools found.
Default: Claude Code if nothing detected.
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
    const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function writeJSON(filePath: string, data: Record<string, unknown>): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── YAML config (text-based injection) ─────────────────────────────────

function injectYamlMCPBlock(
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

function generateOpenClawPlugin(profile: string | null): string {
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

function generateKiloCodePlugin(profile: string | null, toolSource: 'kilocode' | 'opencode'): string {
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

function injectInstructions(filePath: string, marker: string): boolean {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(marker)) return false;
  }

  const sep = content.trimEnd() ? '\n\n' : '';
  fs.writeFileSync(filePath, content.trimEnd() + sep + INSTRUCTION_BLOCK + '\n');
  return true;
}

// ── Tool Detection ─────────────────────────────────────────────────────

/**
 * When no --tool is provided, scan for existing tool config files
 * and offer to configure all found tools.
 */
function detectTools(): string[] {
  const found: string[] = [];
  const scanResults: Array<{ name: string; id: string; detected: boolean }> = [];

  for (const t of TOOLS) {
    const detected = fs.existsSync(t.configPath);
    scanResults.push({ name: t.name, id: t.id, detected });
    if (detected) found.push(t.id);
  }

  // Display scan results
  console.log('');
  for (const r of scanResults) {
    if (r.detected) {
      console.log(`  \u{2705} ${r.name.padEnd(18)} ${r.id}`);
    } else {
      console.log(`  \u{2014} ${r.name.padEnd(18)} not detected`);
    }
  }

  if (found.length === 0) {
    console.log('\n  \u{2139}\u{FE0F}  No config files found. Defaulting to Claude Code.');
    console.log('  \u{2139}\u{FE0F}  Use --tool <name> to configure a different tool.');
    found.push('claude-code');
  }

  console.log('');
  return found;
}

// ── CC Hook injector (merge-aware) ─────────────────────────────────────

interface HookEntry {
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
function injectHook(
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
function getHookKeys(profile: string | null): Array<{ key: string; command: string; async?: boolean; timeout?: number }> {
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
 */
function compileAchievementsJSON(dataDir: string): string | null {
  const yamlPath = path.join(AGPA_ROOT, '04-成就定义清单.yaml');
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
    })),
  };

  const outPath = path.join(dataDir, 'achievements.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  return outPath;
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

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { tool: toolArg, profile } = parseCliArgs();

  printWelcome();

  if (!runPreflight()) {
    process.exit(1);
  }

  const lang = await promptLanguage();

  // Determine which tools to configure
  const toolIds = toolArg ? [toolArg] : detectTools();

  if (toolArg) {
    const toolDef = findTool(toolArg);
    if (toolDef) {
      console.log(`  🎯 Configuring: ${toolDef.name}`);
    }
    console.log('');
  }

  // Shared data directory
  const dataDir = profile
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
  console.log(`  \u{2502}  Data:    ${dataDir.padEnd(37)}\u{2502}`);
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
  if (jsonCompiled) {
    console.log(`  \u{2502}  \u{1F4E6} 160 achievements compiled — /achievements ready  \u{2502}`);
    console.log(`  \u{2502}                                                 \u{2502}`);
  }
  console.log(`  \u{2502}  \u{1F4A1} Your first achievement unlocks the moment    \u{2502}`);
  console.log(`  \u{2502}     you send your first message!                  \u{2502}`);
  console.log(`  \u{2502}                                                 \u{2502}`);
  console.log(`  \u{2514}${'\u{2500}'.repeat(W)}\u{2518}`);
}

main().catch((err: unknown) => {
  console.error((err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
