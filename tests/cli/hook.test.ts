import { describe, it, expect } from 'vitest';
import { mapEvents } from '../../src/cli/hook.js';

describe('mapEvents', () => {
  describe('PostToolUse', () => {
    it('emits tool.complete + conversation.message for any tool', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'SomeTool' };
      const results = mapEvents('PostToolUse', data);
      const types = results.map(r => r.event_type);
      expect(types).toContain('tool.complete');
      expect(types).toContain('conversation.message');
      expect(results.find(r => r.event_type === 'tool.complete')!.payload.role).toBe('assistant');
    });

    it('emits file.read for Read tool', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/a.ts' } };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'file.read');
      expect(evt).toBeDefined();
      expect(evt!.payload.tool_name).toBe('Read');
      expect(evt!.payload.file_path).toBe('/tmp/a.ts');
    });

    it('emits file.create + file.write for Write tool', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: '/tmp/b.ts' } };
      const results = mapEvents('PostToolUse', data);
      const types = results.map(r => r.event_type);
      expect(types).toContain('file.create');
      expect(types).toContain('file.write');
    });

    it('emits file.edit with edit_lines from old_string', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Edit',
        tool_input: { file_path: '/tmp/c.ts', old_string: 'line1\nline2\nline3' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'file.edit');
      expect(evt).toBeDefined();
      expect(evt!.payload.edit_lines).toBe(3);
    });

    it('file.edit edit_lines defaults to 1 for single-line old_string', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Edit',
        tool_input: { old_string: 'single line' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'file.edit');
      expect(evt!.payload.edit_lines).toBe(1);
    });

    it('file.edit excludes total_file_lines for traversal paths', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Edit',
        tool_input: { file_path: '../../etc/passwd', old_string: 'x' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'file.edit');
      expect(evt!.payload.edit_lines).toBe(1);
      expect(evt!.payload.total_file_lines).toBeUndefined();
    });

    it('emits command.run for Bash', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'npm test' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'command.run');
      expect(evt).toBeDefined();
      expect(evt!.payload.command).toBe('npm test');
    });

    it('emits git.commit when Bash includes git commit', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'git commit -m "fix"' },
      };
      const results = mapEvents('PostToolUse', data);
      const types = results.map(r => r.event_type);
      expect(types).toContain('command.run');
      expect(types).toContain('git.commit');
    });

    it('emits mcp.tool_call for mcp__ prefixed tools', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'mcp__agpa__achievement_track' };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'mcp.tool_call');
      expect(evt).toBeDefined();
    });
  });

  describe('PostToolUseFailure', () => {
    it('emits tool.failure', () => {
      const data = { hook_event_name: 'PostToolUseFailure', tool_name: 'Read' };
      const results = mapEvents('PostToolUseFailure', data);
      expect(results).toHaveLength(1);
      expect(results[0]!.event_type).toBe('tool.failure');
    });
  });

  describe('PreToolUse', () => {
    it('emits tool.requested', () => {
      const data = { hook_event_name: 'PreToolUse', tool_name: 'Bash' };
      const results = mapEvents('PreToolUse', data);
      expect(results).toHaveLength(1);
      expect(results[0]!.event_type).toBe('tool.requested');
      expect(results[0]!.payload.tool_name).toBe('Bash');
    });
  });

  describe('SubagentStart / SubagentStop', () => {
    it('emits agent.spawn', () => {
      const data = { hook_event_name: 'SubagentStart', agent_type: 'explore' };
      const results = mapEvents('SubagentStart', data);
      expect(results).toHaveLength(1);
      expect(results[0]!.event_type).toBe('agent.spawn');
      expect(results[0]!.payload.agent_type).toBe('explore');
    });

    it('SubagentStop emits nothing', () => {
      const data = { hook_event_name: 'SubagentStop' };
      const results = mapEvents('SubagentStop', data);
      expect(results).toHaveLength(0);
    });
  });

  describe('SessionStart / SessionEnd', () => {
    it('emits session.start', () => {
      const data = { hook_event_name: 'SessionStart', source: 'claude-code' };
      const results = mapEvents('SessionStart', data);
      expect(results[0]!.event_type).toBe('session.start');
    });

    it('emits session.end', () => {
      const data = { hook_event_name: 'SessionEnd' };
      const results = mapEvents('SessionEnd', data);
      expect(results[0]!.event_type).toBe('session.end');
    });
  });

  describe('TaskCompleted', () => {
    it('emits task.complete with task_id and step_count', () => {
      const data = {
        hook_event_name: 'TaskCompleted', task_id: 'task-123',
        step_count: 5, duration_ms: 1200,
      };
      const results = mapEvents('TaskCompleted', data);
      expect(results).toHaveLength(1);
      expect(results[0]!.event_type).toBe('task.complete');
      expect(results[0]!.payload.task_id).toBe('task-123');
      expect(results[0]!.payload.step_count).toBe(5);
      expect(results[0]!.payload.duration_ms).toBe(1200);
    });
  });

  describe('PostCompact', () => {
    it('emits context.compacted', () => {
      const data = { hook_event_name: 'PostCompact' };
      const results = mapEvents('PostCompact', data);
      expect(results[0]!.event_type).toBe('context.compacted');
    });
  });
});
