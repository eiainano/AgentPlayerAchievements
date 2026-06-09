import { describe, it, expect } from 'vitest';
import {
  removeMcpFromJson, removeCcHooks, removeHermesHooks, removeInstructionBlock,
  removeYamlMcpBlock,
} from '../../src/cli/uninstall.js';

// ── removeMcpFromJson ───────────────────────────────────────────────────────

describe('removeMcpFromJson', () => {
  it('removes agent-achievements from CC mcpServers', () => {
    const input = JSON.stringify({
      mcpServers: { 'existing-server': { command: 'echo' }, 'agent-achievements': { command: 'tsx', args: ['main.ts'] } },
    });
    const result = removeMcpFromJson(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('agent-achievements');
    expect(result.cleaned).toContain('existing-server');
  });

  it('cleans up empty mcpServers after removal', () => {
    const input = JSON.stringify({
      mcpServers: { 'agent-achievements': { command: 'tsx' } },
    });
    const result = removeMcpFromJson(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('mcpServers');
  });

  it('removes from KiloCodes mcp key', () => {
    const input = JSON.stringify({
      mcp: { 'agent-achievements': { type: 'local', command: ['tsx'] } },
    });
    const result = removeMcpFromJson(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('agent-achievements');
  });

  it('removes from OpenClaw nested mcp.servers', () => {
    const input = JSON.stringify({
      mcp: {
        servers: { 'other': { command: 'echo' }, 'agent-achievements': { command: 'tsx' } },
      },
    });
    const result = removeMcpFromJson(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).toContain('other');
    expect(result.cleaned).not.toContain('agent-achievements');
  });

  it('returns removed=false when nothing to remove', () => {
    const input = JSON.stringify({ mcpServers: { other: { command: 'echo' } } });
    const result = removeMcpFromJson(input);
    expect(result.removed).toBe(false);
  });

  it('handles invalid JSON gracefully', () => {
    const result = removeMcpFromJson('not json');
    expect(result.removed).toBe(false);
    expect(result.cleaned).toBe('not json');
  });

  it('handles empty config', () => {
    const result = removeMcpFromJson('{}');
    expect(result.removed).toBe(false);
  });
});

// ── removeCcHooks ───────────────────────────────────────────────────────────

describe('removeCcHooks', () => {
  it('removes AGPA hook commands from CC settings', () => {
    const input = JSON.stringify({
      hooks: {
        SessionStart: [{
          matcher: '*',
          hooks: [
            { type: 'command', command: 'AGPA_TOOL_SOURCE=claude-code tsx hook.ts track session.start' },
            { type: 'other', handler: 'custom' },
          ],
        }],
      },
    });
    const result = removeCcHooks(input);
    expect(result.removed).toBe(true);
    const parsed = JSON.parse(result.cleaned);
    const hooks = (parsed.hooks as Record<string, unknown>).SessionStart as Array<Record<string, unknown>>;
    expect(hooks[0]!.hooks as Array<unknown>).toHaveLength(1); // only 'other' remains
  });

  it('cleans up empty hook keys', () => {
    const input = JSON.stringify({
      hooks: {
        PostToolUse: [{
          matcher: '*',
          hooks: [
            { type: 'command', command: 'AGPA_TOOL_SOURCE=claude-code tsx hook.ts auto' },
          ],
        }],
      },
    });
    const result = removeCcHooks(input);
    expect(result.removed).toBe(true);
    // After removing the only hook, the key should be deleted
    expect(result.cleaned).not.toContain('PostToolUse');
  });

  it('cleans up empty hooks object entirely', () => {
    const input = JSON.stringify({
      hooks: {
        Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'AGPA_TOOL_SOURCE=claude-code tsx hook.ts poll' }] }],
      },
      otherSetting: 'value',
    });
    const result = removeCcHooks(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('hooks');
    expect(result.cleaned).toContain('otherSetting');
  });

  it('returns removed=false when no AGPA hooks present', () => {
    const input = JSON.stringify({
      hooks: {
        PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo hello' }] }],
      },
    });
    const result = removeCcHooks(input);
    expect(result.removed).toBe(false);
    expect(result.cleaned).toContain('echo hello');
  });

  it('handles settings without hooks', () => {
    const input = JSON.stringify({ theme: 'dark' });
    const result = removeCcHooks(input);
    expect(result.removed).toBe(false);
  });
});

// ── removeHermesHooks ───────────────────────────────────────────────────────

describe('removeHermesHooks', () => {
  it('removes AGPA Hermes hook block', () => {
    const input = [
      'other: value',
      '  # ── AGPA Hermes auto-track hooks (agpa-hermes-hook) ──',
      '  pre_tool_call:',
      '    - command: "AGPA_TOOL_SOURCE=hermes tsx hook.ts"',
      '  post_tool_call:',
      '    - command: "AGPA_TOOL_SOURCE=hermes tsx hook.ts"',
      '  hooks_auto_accept: true',
      'next_setting: foo',
    ].join('\n');
    const result = removeHermesHooks(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).toContain('other: value');
    expect(result.cleaned).toContain('next_setting: foo');
    expect(result.cleaned).not.toContain('agpa-hermes-hook');
    expect(result.cleaned).not.toContain('pre_tool_call');
    expect(result.cleaned).not.toContain('hooks_auto_accept');
  });

  it('returns removed=false when no Hermes marker', () => {
    const input = 'some: config\nother: value\n';
    const result = removeHermesHooks(input);
    expect(result.removed).toBe(false);
  });
});

// ── removeYamlMcpBlock ──────────────────────────────────────────────────────

describe('removeYamlMcpBlock', () => {
  it('removes agent-achievements from YAML mcp_servers', () => {
    const input = [
      'some: setting',
      'mcp_servers:',
      '  other-server:',
      '    command: echo',
      '  agent-achievements:',
      '    command: "tsx"',
      '    args: ["/path/to/main.ts"]',
      '    enabled: true',
      'other: value',
    ].join('\n');
    const result = removeYamlMcpBlock(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('agent-achievements');
    expect(result.cleaned).toContain('other-server');
    expect(result.cleaned).toContain('mcp_servers:');
    expect(result.cleaned).toContain('some: setting');
    expect(result.cleaned).toContain('other: value');
  });

  it('cleans up empty mcp_servers after removing last entry', () => {
    const input = [
      'some: setting',
      'mcp_servers:',
      '  agent-achievements:',
      '    command: "tsx"',
      '    enabled: true',
      'other: value',
    ].join('\n');
    const result = removeYamlMcpBlock(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('agent-achievements');
    expect(result.cleaned).not.toContain('mcp_servers:');
    expect(result.cleaned).toContain('some: setting');
    expect(result.cleaned).toContain('other: value');
  });

  it('removes agent-achievements block with env sub-keys', () => {
    const input = [
      'mcp_servers:',
      '  agent-achievements:',
      '    command: "tsx"',
      '    args: ["/path"]',
      '    enabled: true',
      '    env:',
      '      AGPA_TOOL_SOURCE: hermes',
      '      AGPA_LANG: zh',
      'other: value',
    ].join('\n');
    const result = removeYamlMcpBlock(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).not.toContain('agent-achievements');
    expect(result.cleaned).not.toContain('AGPA_TOOL_SOURCE');
    // mcp_servers should be removed (no children left)
    expect(result.cleaned).not.toContain('mcp_servers:');
  });

  it('returns removed=false when no agent-achievements in YAML', () => {
    const input = [
      'mcp_servers:',
      '  other-server:',
      '    command: echo',
    ].join('\n');
    const result = removeYamlMcpBlock(input);
    expect(result.removed).toBe(false);
    expect(result.cleaned).toBe(input);
  });

  it('returns removed=false for non-YAML content', () => {
    const input = JSON.stringify({ nothing: 'here' });
    const result = removeYamlMcpBlock(input);
    expect(result.removed).toBe(false);
  });

  it('handles empty string', () => {
    const result = removeYamlMcpBlock('');
    expect(result.removed).toBe(false);
  });

  it('preserves surrounding YAML structure when removing block', () => {
    const input = [
      '# My Hermes Config',
      '',
      'version: 1',
      'mcp_servers:',
      '  agent-achievements:',
      '    command: "tsx"',
      '    args: ["/path"]',
      '    enabled: true',
      '',
      'other_top_level:',
      '  nested: true',
    ].join('\n');
    const result = removeYamlMcpBlock(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).toContain('# My Hermes Config');
    expect(result.cleaned).toContain('version: 1');
    expect(result.cleaned).toContain('other_top_level:');
    expect(result.cleaned).toContain('nested: true');
    expect(result.cleaned).not.toContain('agent-achievements');
    expect(result.cleaned).not.toContain('mcp_servers:');
  });
});

// ── removeInstructionBlock ──────────────────────────────────────────────────

describe('removeInstructionBlock', () => {
  it('removes AGPA instruction block between markers', () => {
    const input = [
      '# My Project',
      '',
      '<!-- AGPA ACHIEVEMENT TRACKING -->',
      '## Achievement Tracking',
      'Some content here',
      '<!-- /AGPA ACHIEVEMENT TRACKING -->',
      '',
      '## Other Section',
    ].join('\n');
    const result = removeInstructionBlock(input);
    expect(result.removed).toBe(true);
    expect(result.cleaned).toContain('# My Project');
    expect(result.cleaned).toContain('## Other Section');
    expect(result.cleaned).not.toContain('Achievement Tracking');
    expect(result.cleaned).not.toContain('AGPA ACHIEVEMENT TRACKING');
  });

  it('handles missing close marker — removes marker line only', () => {
    const input = [
      '# My Project',
      '<!-- AGPA ACHIEVEMENT TRACKING -->',
      '## Achievement Tracking',
    ].join('\n');
    const result = removeInstructionBlock(input);
    expect(result.removed).toBe(true);
    // Without close marker, only the marker line itself is stripped;
    // the content after the marker is kept (can't determine block boundary).
    expect(result.cleaned).not.toContain('<!-- AGPA ACHIEVEMENT TRACKING -->');
    expect(result.cleaned).toContain('# My Project');
  });

  it('returns removed=false when no marker present', () => {
    const input = '# Just a normal file\n';
    const result = removeInstructionBlock(input);
    expect(result.removed).toBe(false);
  });
});
