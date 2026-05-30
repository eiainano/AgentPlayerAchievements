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
import { homedir } from 'node:os';
import { TOOLS, findTool, INSTRUCTION_FILES } from '../tool-registry.js';
import type { ToolDef } from '../tool-registry.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');
const AGPA_MAIN = path.resolve(import.meta.dirname, '../main.ts');
const AGPA_HOOK = path.resolve(import.meta.dirname, 'hook.ts');
const TSX_BIN = path.resolve(import.meta.dirname, '../../node_modules/.bin/tsx');

const HOOK_ENV = 'AGPA_TOOL_SOURCE=claude-code';
const HOOK_TRACK_START = `${HOOK_ENV} ${TSX_BIN} ${AGPA_HOOK} track session.start`;
const HOOK_TRACK_END = `${HOOK_ENV} ${TSX_BIN} ${AGPA_HOOK} track session.end`;
const HOOK_POLL = `${HOOK_ENV} ${TSX_BIN} ${AGPA_HOOK} poll`;
const HOOK_AUTO = `${HOOK_ENV} ${TSX_BIN} ${AGPA_HOOK} auto`;
const HOOK_HERMES_ENV = 'AGPA_TOOL_SOURCE=hermes';
const HOOK_HERMES_AUTO = `${HOOK_HERMES_ENV} ${TSX_BIN} ${AGPA_HOOK} hermes-auto`;
const HOOK_HERMES_TRACK_START = `${HOOK_HERMES_ENV} ${TSX_BIN} ${AGPA_HOOK} track session.start`;
const HOOK_HERMES_TRACK_END = `${HOOK_HERMES_ENV} ${TSX_BIN} ${AGPA_HOOK} track session.end`;

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

**When you do something:**
- Read an image file → \`image.read\` (auto: any Read of png/jpg/gif/svg counts)
- Create a file in a specific language → \`file.language_used\` with \`{ language }\` (e.g. "typescript", "python")
- Edit the same function repeatedly → \`function.edited\` with \`{ function_name }\`
- Slash command runs → \`command.slash_used\` with \`{ command }\`
- Enter plan mode → \`plan.mode_entered\`
- Read help/docs → \`help.accessed\`
- Connect MCP server → \`mcp.server_used\` with \`{ server_name }\`
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
  console.log('\n\u{1F50D}  Auto-detecting AI coding tools...\n');
  const found: string[] = [];
  for (const t of TOOLS) {
    if (fs.existsSync(t.configPath)) {
      found.push(t.id);
      console.log(`  \u{2713}  Found: ${t.name}`);
    }
  }
  if (found.length === 0) {
    console.log('  ℹ  No config files found. Defaulting to Claude Code.');
    console.log('  ℹ  Use --tool <name> to configure a different tool.');
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
const ALL_HOOK_KEYS: Array<{ key: string; command: string; async?: boolean; timeout?: number }> = [
  { key: 'SessionStart',       command: HOOK_TRACK_START,                                          async: false },
  { key: 'Stop',               command: `${HOOK_TRACK_END} && ${HOOK_POLL}`,                        async: true, timeout: 15 },
  { key: 'PostToolUse',        command: HOOK_AUTO },
  { key: 'PreToolUse',         command: HOOK_AUTO },
  { key: 'PostToolUseFailure', command: HOOK_AUTO },
  { key: 'TaskCompleted',      command: HOOK_AUTO },
  { key: 'SubagentStart',      command: HOOK_AUTO },
  { key: 'SubagentStop',       command: HOOK_AUTO },
  { key: 'PostCompact',        command: HOOK_AUTO },
];

// ── Init a single tool ─────────────────────────────────────────────────

/**
 * Initialize one AI coding tool with MCP config, instruction files, and hooks.
 */
function initTool(
  toolDef: ToolDef,
  initData: InitToolData,
  profile: string | null,
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
    console.log(`  \u{23ED}  MCP:       ${toolDef.configPath} (already present)`);
  } else {
    if (toolDef.configFormat === 'yaml') {
      if (!configExists) {
        console.log(`  \u{1F195} New file: ${toolDef.configPath}`);
        const dir = path.dirname(toolDef.configPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(toolDef.configPath, '');
      }
      const injected = injectYamlMCPBlock(toolDef.configPath, 'agent-achievements', {
        command: 'tsx',
        args: [AGPA_MAIN],
        enabled: true,
        env: { AGPA_TOOL_SOURCE: toolDef.id },
      });
      if (injected) {
        console.log(`  \u{2705} MCP:       ${toolDef.configPath}`);
      } else {
        console.log(`  \u{23ED}  MCP:       ${toolDef.configPath} (already present)`);
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
      writeJSON(toolDef.configPath, updated);
      console.log(`  \u{2705} MCP:       ${toolDef.configPath}`);
    }
  }

  // ── Inject instruction files ────────────────────────────────────────
  for (const inst of initData.instructionFiles) {
    const injected = injectInstructions(inst.path, inst.marker);
    if (injected) {
      console.log(`  \u{2705} Instruct:  ${inst.path}`);
    } else {
      console.log(`  \u{23ED}  Instruct:  ${inst.path} (already present)`);
    }
  }

  // ── Inject CC hooks (merge-aware, only for claude-code) ────────────
  if (toolDef.id === 'claude-code') {
    let hookCfg = readJSON(toolDef.configPath);
    if (!hookCfg) {
      console.log(`  \u{26A0}  Hooks:     cannot read ${toolDef.configPath} \u{2014} skipping`);
    } else {
      const hooks = (hookCfg.hooks as Record<string, unknown>) || {};
      const injectedKeys: string[] = [];

      for (const hk of ALL_HOOK_KEYS) {
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
        console.log(`  \u{2705} Hooks:     ${injectedKeys.join(', ')}`);
      } else {
        console.log(`  \u{23ED}  Hooks:     (all already present)`);
      }
    }
  }

  // ── Inject Hermes shell hooks (YAML config) ─────────────────────────
  if (toolDef.id === 'hermes') {
    const cfgPath = toolDef.configPath;
    if (fs.existsSync(cfgPath) && !fs.readFileSync(cfgPath, 'utf-8').includes('agpa-hermes-hook')) {
      const injected = injectHermesHooks(cfgPath, {
        pre_tool_call:     HOOK_HERMES_AUTO,
        post_tool_call:    HOOK_HERMES_AUTO,
        on_session_start:  HOOK_HERMES_TRACK_START,
        on_session_end:    `${HOOK_HERMES_TRACK_END} && ${HOOK_HERMES_ENV} ${TSX_BIN} ${AGPA_HOOK} poll`,
      });
      if (injected) {
        console.log(`  \u{2705} Hooks:     hermes shell hooks (4 events)`);
      }
    } else {
      console.log(`  \u{23ED}  Hooks:     (already present or config missing)`);
    }
  }

  return toolDef.name;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const { tool: toolArg, profile } = parseCliArgs();

  // Determine which tools to configure
  const toolIds = toolArg ? [toolArg] : detectTools();

  // Shared data directory
  const dataDir = profile
    ? path.join(AGPA_DIR, 'profiles', profile)
    : AGPA_DIR;
  if (!toolArg) {
    console.log(`  \u{1F4C1} Data:      ${dataDir}`);
  }
  ensureDataDir(dataDir);
  initEngineState();

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

    const name = initTool(toolDef, initData, profile, dataDir, !multiTool);
    if (name) configuredTools.push(name);
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const toolList = configuredTools.join(', ');
  const toolCount = configuredTools.length;
  const toolLine = toolCount > 1
    ? `${toolCount} tools configured`
    : `Tool:      ${configuredTools[0]!}`;
  console.log(`\n  ┌─────────────────────────────────────────────────┐`);
  console.log(`  │  Agent Player Achievements initialized!          │`);
  console.log(`  │                                                 │`);
  console.log(`  │  ${toolLine.padEnd(47)}│`);
  console.log(`  │  Data:    ${dataDir.padEnd(37)}│`);
  console.log(`  │                                                 │`);
  console.log(`  │  Quick start:                                   │`);
  console.log(`  │    npm run dashboard    # View your achievements │`);
  console.log(`  │    npm run doctor       # Diagnose your setup    │`);
  console.log(`  └─────────────────────────────────────────────────┘`);
}

main();
