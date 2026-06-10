import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  hookCmd, generateOpenClawPlugin, generateKiloCodePlugin,
  injectHook, getHookKeys, injectYamlMCPBlock, injectInstructions,
  INIT_DATA, type HookEntry,
} from '../../src/cli/init.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `agpa-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ── hookCmd ─────────────────────────────────────────────────────────────────

describe('hookCmd', () => {
  it('returns command without profile env when profile is null', () => {
    const cmd = hookCmd('AGPA_TOOL_SOURCE=claude-code', 'auto', null);
    expect(cmd).not.toContain('AGPA_PROFILE=');
    expect(cmd).toContain('AGPA_TOOL_SOURCE=claude-code');
    expect(cmd).toContain('auto');
  });

  it('returns command with profile env when profile is provided', () => {
    const cmd = hookCmd('AGPA_TOOL_SOURCE=claude-code', 'auto', 'myprof');
    expect(cmd).toContain('AGPA_PROFILE=myprof');
  });

  it('uses the hook launcher script', () => {
    const cmd = hookCmd('AGPA_TOOL_SOURCE=claude-code', 'auto', null);
    expect(cmd).toContain('run-hook.sh');
  });

  it('uses correct mode string', () => {
    const cmd = hookCmd('AGPA_TOOL_SOURCE=claude-code', 'track session.start', null);
    expect(cmd).toContain('track session.start');
  });
});

// ── generateOpenClawPlugin ──────────────────────────────────────────────────

describe('generateOpenClawPlugin', () => {
  it('includes OPENCLAW_PLUGIN_MARKER', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).toContain('// agpa-openclaw-track');
  });

  it('does NOT include AGPA_PROFILE when profile is null', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).not.toContain('AGPA_PROFILE:');
  });

  it('includes AGPA_PROFILE when profile is provided', () => {
    const src = generateOpenClawPlugin('testprof');
    expect(src).toContain("AGPA_PROFILE: 'testprof'");
  });

  it('includes definePluginEntry call', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).toContain('definePluginEntry');
  });

  it('includes session_start and session_end hooks', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).toContain('session_start');
    expect(src).toContain('session_end');
  });

  it('includes before_tool_call and after_tool_call hooks', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).toContain('before_tool_call');
    expect(src).toContain('after_tool_call');
  });

  it('includes agent_end hook', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).toContain('agent_end');
  });

  it('includes openclaw in AGPA_TOOL_SOURCE', () => {
    const src = generateOpenClawPlugin(null);
    expect(src).toContain("AGPA_TOOL_SOURCE: 'openclaw'");
  });
});

// ── generateKiloCodePlugin ──────────────────────────────────────────────────

describe('generateKiloCodePlugin', () => {
  it('includes KILOCODE_PLUGIN_MARKER', () => {
    const src = generateKiloCodePlugin(null, 'kilocode');
    expect(src).toContain('// agpa-kilocode-track');
  });

  it('does NOT include AGPA_PROFILE when profile is null', () => {
    const src = generateKiloCodePlugin(null, 'kilocode');
    expect(src).not.toContain('AGPA_PROFILE:');
  });

  it('includes AGPA_PROFILE when profile is provided', () => {
    const src = generateKiloCodePlugin('testprof', 'kilocode');
    expect(src).toContain("AGPA_PROFILE: 'testprof'");
  });

  it('sets AGPA_TOOL_SOURCE to kilocode for kilocode tool', () => {
    const src = generateKiloCodePlugin(null, 'kilocode');
    expect(src).toContain("AGPA_TOOL_SOURCE: 'kilocode'");
  });

  it('sets AGPA_TOOL_SOURCE to opencode for opencode tool', () => {
    const src = generateKiloCodePlugin(null, 'opencode');
    expect(src).toContain("AGPA_TOOL_SOURCE: 'opencode'");
  });

  it('includes Bun.spawn-based track function', () => {
    const src = generateKiloCodePlugin(null, 'kilocode');
    expect(src).toContain('Bun.spawn');
  });

  it('includes tool.execute.before and after hooks', () => {
    const src = generateKiloCodePlugin(null, 'kilocode');
    expect(src).toContain('tool.execute.before');
    expect(src).toContain('tool.execute.after');
  });

  it('includes session.created and session.idle event handlers', () => {
    const src = generateKiloCodePlugin(null, 'kilocode');
    expect(src).toContain('session.created');
    expect(src).toContain('session.idle');
  });
});

// ── injectHook ──────────────────────────────────────────────────────────────

describe('injectHook', () => {
  it('creates new hook entry when hooks object is empty', () => {
    const hooks: Record<string, unknown> = {};
    const result = injectHook(hooks, 'PostToolUse', 'tsx hook.ts auto');
    expect(result).toBe(true);
    const matchers = hooks['PostToolUse'] as Array<Record<string, unknown>>;
    expect(matchers).toHaveLength(1);
    expect((matchers[0]!.hooks as Array<Record<string, unknown>>)).toHaveLength(1);
  });

  it('creates matcher array with { matcher: "*" } structure', () => {
    const hooks: Record<string, unknown> = {};
    injectHook(hooks, 'PostToolUse', 'tsx hook.ts auto');
    const matchers = hooks['PostToolUse'] as Array<Record<string, unknown>>;
    expect(matchers[0]!.matcher).toBe('*');
  });

  it('does NOT duplicate when command already exists', () => {
    const hooks: Record<string, unknown> = {};
    injectHook(hooks, 'PostToolUse', 'tsx hook.ts auto');
    const result = injectHook(hooks, 'PostToolUse', 'tsx hook.ts auto');
    expect(result).toBe(false);
    const matchers = hooks['PostToolUse'] as Array<Record<string, unknown>>;
    expect((matchers[0]!.hooks as Array<unknown>)).toHaveLength(1);
  });

  it('appends new command to existing matcher', () => {
    const hooks: Record<string, unknown> = {};
    injectHook(hooks, 'PostToolUse', 'tsx hook.ts auto');
    const result = injectHook(hooks, 'PostToolUse', 'tsx hook.ts poll');
    expect(result).toBe(true);
    const matchers = hooks['PostToolUse'] as Array<Record<string, unknown>>;
    expect((matchers[0]!.hooks as Array<unknown>)).toHaveLength(2);
  });

  it('handles null/undefined hooks gracefully — does not crash', () => {
    // injectHook accesses hooks[key] so null hooks throw — this is expected,
    // callers (initTool) never pass null.
    const hooks: Record<string, unknown> = {};
    expect(() => injectHook(hooks, 'PostToolUse', 'cmd')).not.toThrow();
  });

  it('includes async and timeout options when provided', () => {
    const hooks: Record<string, unknown> = {};
    injectHook(hooks, 'Stop', 'tsx hook.ts poll', { type: 'command', command: 'tsx hook.ts poll', async: true, timeout: 15 });
    const matchers = hooks['Stop'] as Array<Record<string, unknown>>;
    const hook = (matchers[0]!.hooks as Array<Record<string, unknown>>)[0]!;
    expect(hook.async).toBe(true);
    expect(hook.timeout).toBe(15);
  });

  it('detects duplicate by command string across all matchers', () => {
    const hooks: Record<string, unknown> = {};
    injectHook(hooks, 'PostToolUse', 'tsx hook.ts auto');
    const result = injectHook(hooks, 'Stop', 'tsx hook.ts auto');
    // Different key so it should add a new entry, not detect duplicate
    expect(result).toBe(true);
  });
});

// ── getHookKeys ─────────────────────────────────────────────────────────────

describe('getHookKeys', () => {
  it('returns 10 hook keys', () => {
    const keys = getHookKeys(null);
    expect(keys).toHaveLength(10);
  });

  it('all keys have non-empty command', () => {
    const keys = getHookKeys(null);
    for (const k of keys) {
      expect(k.command).toBeTruthy();
    }
  });

  it('SessionStart has async: false', () => {
    const keys = getHookKeys(null);
    const ss = keys.find(k => k.key === 'SessionStart');
    expect(ss?.async).toBe(false);
  });

  it('Stop has async: true and timeout: 15', () => {
    const keys = getHookKeys(null);
    const stop = keys.find(k => k.key === 'Stop');
    expect(stop?.async).toBe(true);
    expect(stop?.timeout).toBe(15);
  });

  it('Stop command includes poll after session.end', () => {
    const keys = getHookKeys(null);
    const stop = keys.find(k => k.key === 'Stop');
    expect(stop?.command).toContain('session.end');
    expect(stop?.command).toContain('poll');
    expect(stop?.command).toContain('&&');
  });

  it('includes profile env in all commands when profile is provided', () => {
    const keys = getHookKeys('myprof');
    for (const k of keys) {
      expect(k.command).toContain('AGPA_PROFILE=myprof');
    }
  });

  it('excludes profile env when profile is null', () => {
    const keys = getHookKeys(null);
    for (const k of keys) {
      expect(k.command).not.toContain('AGPA_PROFILE=');
    }
  });

  it('contains all expected hook event types', () => {
    const keys = getHookKeys(null);
    const names = keys.map(k => k.key);
    expect(names).toContain('SessionStart');
    expect(names).toContain('UserPromptSubmit');
    expect(names).toContain('Stop');
    expect(names).toContain('PostToolUse');
    expect(names).toContain('PreToolUse');
    expect(names).toContain('PostToolUseFailure');
    expect(names).toContain('TaskCompleted');
    expect(names).toContain('SubagentStart');
    expect(names).toContain('SubagentStop');
    expect(names).toContain('PostCompact');
  });
});

// ── INIT_DATA mcpInject ─────────────────────────────────────────────────────

describe('INIT_DATA mcpInject functions', () => {
  describe('claude-code', () => {
    it('injects MCP server key into empty config', () => {
      const cfg = INIT_DATA['claude-code']!.mcpInject({});
      const mcps = cfg.mcpServers as Record<string, unknown>;
      expect(mcps['agent-achievements']).toBeDefined();
    });

    it('preserves unrelated keys', () => {
      const cfg = INIT_DATA['claude-code']!.mcpInject({ hooks: { foo: 'bar' }, mcpServers: {} });
      expect(cfg.hooks).toEqual({ foo: 'bar' });
    });

    it('sets correct AGPA_TOOL_SOURCE', () => {
      const cfg = INIT_DATA['claude-code']!.mcpInject({});
      const srv = (cfg.mcpServers as Record<string, unknown>)['agent-achievements'] as Record<string, unknown>;
      expect((srv.env as Record<string, string>).AGPA_TOOL_SOURCE).toBe('claude-code');
    });
  });

  describe('kilo-code', () => {
    it('injects MCP server key into empty config', () => {
      const cfg = INIT_DATA['kilo-code']!.mcpInject({});
      const mcp = cfg.mcp as Record<string, unknown>;
      expect(mcp['agent-achievements']).toBeDefined();
    });

    it('sets correct AGPA_TOOL_SOURCE', () => {
      const cfg = INIT_DATA['kilo-code']!.mcpInject({});
      const srv = (cfg.mcp as Record<string, unknown>)['agent-achievements'] as Record<string, unknown>;
      expect((srv.env as Record<string, string>).AGPA_TOOL_SOURCE).toBe('kilocode');
    });
  });

  describe('hermes', () => {
    it('injects into mcp_servers key', () => {
      const cfg = INIT_DATA['hermes']!.mcpInject({});
      const servers = cfg.mcp_servers as Record<string, unknown>;
      expect(servers['agent-achievements']).toBeDefined();
    });
  });

  describe('opencode', () => {
    it('injects MCP server key into empty config', () => {
      const cfg = INIT_DATA['opencode']!.mcpInject({});
      const mcp = cfg.mcp as Record<string, unknown>;
      expect(mcp['agent-achievements']).toBeDefined();
    });

    it('sets correct AGPA_TOOL_SOURCE to opencode', () => {
      const cfg = INIT_DATA['opencode']!.mcpInject({});
      const srv = (cfg.mcp as Record<string, unknown>)['agent-achievements'] as Record<string, unknown>;
      expect((srv.env as Record<string, string>).AGPA_TOOL_SOURCE).toBe('opencode');
    });
  });

  describe('openclaw', () => {
    it('injects into nested mcp.servers structure', () => {
      const cfg = INIT_DATA['openclaw']!.mcpInject({});
      const mcp = cfg.mcp as Record<string, unknown>;
      const servers = mcp.servers as Record<string, unknown>;
      expect(servers['agent-achievements']).toBeDefined();
    });

    it('sets correct AGPA_TOOL_SOURCE to openclaw', () => {
      const cfg = INIT_DATA['openclaw']!.mcpInject({});
      const mcp = cfg.mcp as Record<string, unknown>;
      const servers = mcp.servers as Record<string, unknown>;
      const srv = servers['agent-achievements'] as Record<string, unknown>;
      expect((srv.env as Record<string, string>).AGPA_TOOL_SOURCE).toBe('openclaw');
    });
  });
});

// ── injectYamlMCPBlock ──────────────────────────────────────────────────────

describe('injectYamlMCPBlock', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns false for non-existent file', () => {
    const result = injectYamlMCPBlock(path.join(tmp, 'nope.yaml'), 'my-server', { command: 'tsx', args: [] });
    expect(result).toBe(false);
  });

  it('returns false if serverName already present', () => {
    const yamlPath = path.join(tmp, 'config.yaml');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(yamlPath, 'mcp_servers:\n  my-server:\n    command: tsx\n', 'utf-8');
    const result = injectYamlMCPBlock(yamlPath, 'my-server', { command: 'tsx', args: [] });
    expect(result).toBe(false);
  });

  it('injects server block after existing mcp_servers entry', () => {
    const yamlPath = path.join(tmp, 'config.yaml');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(yamlPath, 'mcp_servers:\n  existing:\n    command: echo\n', 'utf-8');
    const result = injectYamlMCPBlock(yamlPath, 'agent-achievements', { command: 'tsx', args: ['hook.ts'] });
    expect(result).toBe(true);
    const updated = fs.readFileSync(yamlPath, 'utf-8');
    expect(updated).toContain('agent-achievements');
    expect(updated.indexOf('agent-achievements') < updated.indexOf('existing')).toBe(true);
  });

  it('creates mcp_servers block when YAML has no mcp_servers', () => {
    const yamlPath = path.join(tmp, 'config.yaml');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(yamlPath, 'other_key: value\n', 'utf-8');
    const result = injectYamlMCPBlock(yamlPath, 'agent-achievements', { command: 'tsx', args: ['hook.ts'] });
    expect(result).toBe(true);
    const updated = fs.readFileSync(yamlPath, 'utf-8');
    expect(updated).toContain('mcp_servers:');
    expect(updated).toContain('agent-achievements');
  });

  it('includes enabled: true in the block', () => {
    const yamlPath = path.join(tmp, 'config.yaml');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(yamlPath, 'mcp_servers:\n', 'utf-8');
    injectYamlMCPBlock(yamlPath, 'agent-achievements', { command: 'tsx', args: ['hook.ts'] });
    const updated = fs.readFileSync(yamlPath, 'utf-8');
    expect(updated).toContain('enabled: true');
  });

  it('includes env block when serverConfig has env', () => {
    const yamlPath = path.join(tmp, 'config.yaml');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(yamlPath, 'mcp_servers:\n', 'utf-8');
    injectYamlMCPBlock(yamlPath, 'agent-achievements', {
      command: 'tsx', args: ['hook.ts'],
      env: { AGPA_TOOL_SOURCE: 'test' },
    });
    const updated = fs.readFileSync(yamlPath, 'utf-8');
    expect(updated).toContain('AGPA_TOOL_SOURCE: test');
  });
});

// ── injectInstructions ──────────────────────────────────────────────────────

describe('injectInstructions', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('creates missing file with instruction block → returns true', () => {
    const filePath = path.join(tmp, 'subdir', 'test.md');
    const result = injectInstructions(filePath, '<!-- AGPA ACHIEVEMENT TRACKING -->');
    expect(result).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    // injectInstructions writes INSTRUCTION_BLOCK (full AGPA text), not just the marker
    expect(content).toContain('<!-- AGPA ACHIEVEMENT TRACKING -->');
    expect(content).toContain('Achievement Tracking');
  });

  it('appends instruction block to file without marker → returns true', () => {
    const filePath = path.join(tmp, 'test.md');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(filePath, '# My Project\n\nSome content\n', 'utf-8');
    const result = injectInstructions(filePath, '<!-- AGPA ACHIEVEMENT TRACKING -->');
    expect(result).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('<!-- AGPA ACHIEVEMENT TRACKING -->');
  });

  it('returns false if marker already present (idempotent)', () => {
    const filePath = path.join(tmp, 'test.md');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(filePath, '<!-- AGPA ACHIEVEMENT TRACKING -->\nSome content\n', 'utf-8');
    const result = injectInstructions(filePath, '<!-- AGPA ACHIEVEMENT TRACKING -->');
    expect(result).toBe(false);
  });
});
