#!/usr/bin/env node
/**
 * AGPA Init — detect & configure AI coding tools for achievement tracking
 *
 * Usage:
 *   npx tsx src/cli/init.ts --tool claude-code
 *   npx tsx src/cli/init.ts --tool kilocode
 *   npx tsx src/cli/init.ts --tool hermes
 *   npx tsx src/cli/init.ts --tool opencode
 *   npx tsx src/cli/init.ts --tool openclaw
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
- Run git revert/reset --hard → \`git.revert_all\`
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

function parseCliArgs(): { tool: string; profile: string | null } {
  const args = process.argv.slice(2);
  let tool = '';
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
  npx tsx src/cli/init.ts --tool <tool> [--profile <name>]

Tools:
  claude-code, cc        Claude Code
  kilocode, kilo         Kilo Code
  hermes, ha             Hermes Agent
  opencode, oc           OpenCode
  openclaw, claw         OpenClaw

Options:
  --profile <name>       Use a named profile (default: "default")
  --help, -h             Show this help
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

// ── Main ───────────────────────────────────────────────────────────────

const { tool: toolArg, profile } = parseCliArgs();

if (!toolArg) {
  console.error('✖ Missing --tool argument. Use --help for usage.');
  process.exit(1);
}

const toolDef = findTool(toolArg);
if (!toolDef) {
  console.error(`✖ Unknown tool: "${toolArg}"`);
  console.error('  Supported: claude-code, kilocode, hermes, opencode, openclaw');
  process.exit(1);
}
const initData = INIT_DATA[toolDef.id];
if (!initData) {
  console.error(`✖ No init data for tool: "${toolDef.id}"`);
  process.exit(1);
}

// Step 1: Ensure data directory
const dataDir = profile
  ? path.join(AGPA_DIR, 'profiles', profile)
  : AGPA_DIR;
ensureDataDir(dataDir);
initEngineState();
console.log(`  📁 Data:     ${dataDir}`);

// Step 2: Check tool config file & inject MCP
const configExists = fs.existsSync(toolDef.configPath);
if (configExists && fs.readFileSync(toolDef.configPath, 'utf-8').includes('agent-achievements')) {
  console.log(`  ⏭  Skipped:  ${toolDef.configPath} (already present)`);
} else {
  // Step 3: Inject MCP config
  if (toolDef.configFormat === 'yaml') {
    if (!configExists) {
      console.log(`  🆕 New file: ${toolDef.configPath}`);
      const dir = path.dirname(toolDef.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(toolDef.configPath, '');
    }
    const injected = injectYamlMCPBlock(toolDef.configPath, 'agent-achievements', {
      command: 'tsx',
      args: [AGPA_MAIN],
      enabled: true,
      env: { AGPA_TOOL_SOURCE: 'hermes' },
    });
    if (injected) {
      console.log(`  ✅ MCP:      ${toolDef.configPath}`);
    } else {
      console.log(`  ⏭  Skipped:  ${toolDef.configPath} (already present)`);
    }
  } else {
    let config: Record<string, unknown> | null;
    if (configExists) {
      config = readJSON(toolDef.configPath);
      if (!config) {
        const bak = toolDef.configPath + '.agpa.bak';
        try { fs.copyFileSync(toolDef.configPath, bak); } catch { /* ok */ }
        console.log(`  📋 Backup:   ${bak}`);
        config = {};
      }
    } else {
      console.log(`  🆕 New file: ${toolDef.configPath}`);
      config = {};
    }
    const updated = initData.mcpInject(config);
    writeJSON(toolDef.configPath, updated);
    console.log(`  ✅ MCP:      ${toolDef.configPath}`);
  }
}

// Step 4: Inject instruction files
for (const inst of initData.instructionFiles) {
  const injected = injectInstructions(inst.path, inst.marker);
  if (injected) {
    console.log(`  ✅ Injected: ${inst.path}`);
  } else {
    console.log(`  ⏭  Skipped:  ${inst.path} (already present)`);
  }
}

// Step 5: Inject CC hooks (9 hooks for auto event tracking)
if (toolDef.id === 'claude-code') {
  let hookCfg = readJSON(toolDef.configPath);
  if (!hookCfg) {
    console.log(`  ⚠  Skipped hooks: cannot read ${toolDef.configPath}`);
  } else {
    let hooksInjected = false;
    if (!hookCfg.SessionStart) {
      hookCfg.SessionStart = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_TRACK_START }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.Stop) {
      hookCfg.Stop = [{
        matcher: '*',
        hooks: [{ type: 'command', command: `${HOOK_TRACK_END} && ${HOOK_POLL}` }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.PostToolUse) {
      hookCfg.PostToolUse = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.PreToolUse) {
      hookCfg.PreToolUse = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.PostToolUseFailure) {
      hookCfg.PostToolUseFailure = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.TaskCompleted) {
      hookCfg.TaskCompleted = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.SubagentStart) {
      hookCfg.SubagentStart = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.SubagentStop) {
      hookCfg.SubagentStop = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (!hookCfg.PostCompact) {
      hookCfg.PostCompact = [{
        matcher: '*',
        hooks: [{ type: 'command', command: HOOK_AUTO, async: true, timeout: 5 }],
      }];
      hooksInjected = true;
    }
    if (hooksInjected) {
      writeJSON(toolDef.configPath, hookCfg);
      console.log('  ✅ Hooks:    auto track (9 events) + poll');
    } else {
      console.log('  ⏭  Skipped:  hooks (already present)');
    }
  }
}

// Step 6: Summary
console.log(`\n  ┌─────────────────────────────────────────────────┐`);
console.log(`  │  Agent Player Achievements initialized!          │`);
console.log(`  │                                                 │`);
console.log(`  │  Tool:    ${toolDef.name.padEnd(37)}│`);
console.log(`  │  Data:    ${dataDir.padEnd(37)}│`);
console.log(`  │                                                 │`);
console.log(`  │  Next time you start ${toolDef.name}:${' '.repeat(19 + (24 - toolDef.name.length))}│`);
console.log(`  │  First achievement awaits you!                  │`);
console.log(`  │                                                 │`);
console.log(`  │  Quick start:                                   │`);
console.log(`  │    npm run dashboard    # View your achievements │`);
console.log(`  └─────────────────────────────────────────────────┘`);
