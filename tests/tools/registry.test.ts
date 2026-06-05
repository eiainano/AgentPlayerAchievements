import { describe, it, expect } from 'vitest';
import { findTool, TOOLS } from '../../src/tool-registry.js';

describe('findTool', () => {
  it('finds tools by their standard id', () => {
    const tool = findTool('claude-code');
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe('Claude Code');
  });

  it('finds tools by aliases', () => {
    expect(findTool('cc')!.id).toBe('claude-code');
    expect(findTool('claude')!.id).toBe('claude-code');
    expect(findTool('kilo')!.id).toBe('kilo-code');
    expect(findTool('ha')!.id).toBe('hermes');
    expect(findTool('oc')!.id).toBe('opencode');
    expect(findTool('ocw')!.id).toBe('openclaw');
  });

  it('returns null for unknown tools', () => {
    expect(findTool('unknown')).toBeNull();
    expect(findTool('vscode')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(findTool('CLAUDE-CODE')!.id).toBe('claude-code');
    expect(findTool('CC')!.id).toBe('claude-code');
  });
});

describe('TOOLS', () => {
  it('has all 5 expected tools', () => {
    const ids = TOOLS.map(t => t.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('kilo-code');
    expect(ids).toContain('hermes');
    expect(ids).toContain('opencode');
    expect(ids).toContain('openclaw');
  });

  it('each tool has at least 1 alias', () => {
    for (const tool of TOOLS) {
      expect(tool.aliases.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each tool has a configFormat', () => {
    for (const tool of TOOLS) {
      expect(['json', 'yaml']).toContain(tool.configFormat);
    }
  });
});
