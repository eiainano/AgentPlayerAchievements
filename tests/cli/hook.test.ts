import { describe, it, expect } from 'vitest';
import { mapEvents, normalizeOpenClawStdin, OPENCLAW_EVENT_MAP, OPENCLAW_TOOL_MAP } from '../../src/cli/hook.js';

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

describe('normalizeOpenClawStdin', () => {
  describe('event name mapping', () => {
    it('maps after_tool_call → PostToolUse', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
        params: { path: '/tmp/a.ts' },
        sessionId: 'sess-1',
        durationMs: 150,
      });
      expect(result.hook_event_name).toBe('PostToolUse');
      expect(result.tool_name).toBe('Read');
      expect(result.tool_input?.file_path).toBe('/tmp/a.ts');
      expect(result.session_id).toBe('sess-1');
      expect(result.duration_ms).toBe(150);
      expect(result.source).toBe('openclaw');
    });

    it('maps before_tool_call → PreToolUse', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'before_tool_call',
        toolName: 'bash',
        params: { command: 'npm test' },
        sessionId: 'sess-2',
      });
      expect(result.hook_event_name).toBe('PreToolUse');
      expect(result.tool_name).toBe('Bash');
      expect(result.tool_input?.command).toBe('npm test');
    });

    it('maps session_start → SessionStart', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'session_start',
        sessionId: 'sess-3',
      });
      expect(result.hook_event_name).toBe('SessionStart');
      expect(result.session_id).toBe('sess-3');
    });

    it('maps session_end → SessionEnd', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'session_end',
        sessionId: 'sess-4',
        reason: 'user',
        messageCount: 42,
      });
      expect(result.hook_event_name).toBe('SessionEnd');
    });

    it('maps agent_end → agent.end', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'agent_end',
        sessionId: 'sess-5',
        durationMs: 5000,
        success: true,
      });
      expect(result.hook_event_name).toBe('agent.end');
    });
  });

  describe('tool name mapping', () => {
    it.each([
      ['read_file', 'Read'],
      ['write_file', 'Write'],
      ['apply_patch', 'Edit'],
      ['bash', 'Bash'],
      ['glob', 'Glob'],
      ['grep', 'Grep'],
    ])('%s → %s', (input, expected) => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: input,
      });
      expect(result.tool_name).toBe(expected);
    });

    it('passes through unknown tool names', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'some_unknown_tool',
      });
      expect(result.tool_name).toBe('some_unknown_tool');
    });
  });

  describe('params field mapping', () => {
    it('maps params.path → tool_input.file_path', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'write_file',
        params: { path: '/tmp/foo.ts', content: 'hello' },
      });
      expect(result.tool_input?.file_path).toBe('/tmp/foo.ts');
      expect(result.tool_input?.content).toBe('hello');
    });

    it('maps params.command → tool_input.command', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'bash',
        params: { command: 'npm install' },
      });
      expect(result.tool_input?.command).toBe('npm install');
    });

    it('maps params.old_string → tool_input.old_string', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'apply_patch',
        params: { old_string: 'line1\nline2\nline3' },
      });
      expect(result.tool_input?.old_string).toBe('line1\nline2\nline3');
    });

    it('maps params.description → tool_input.description', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'bash',
        params: { description: 'install deps', command: 'npm i' },
      });
      expect(result.tool_input?.description).toBe('install deps');
    });

    it('captures error from after_tool_call failure', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
        params: { path: '/missing.txt' },
        error: 'ENOENT: no such file',
      });
      expect(result.tool_input?.error).toBe('ENOENT: no such file');
    });
  });

  describe('combined event routing via mapEvents', () => {
    it('after_tool_call with Read → file.read', () => {
      const data = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
        params: { path: '/tmp/a.ts' },
        sessionId: 'sess-1',
      });
      const events = mapEvents(data.hook_event_name!, data);
      const types = events.map(e => e.event_type);
      expect(types).toContain('file.read');
      expect(types).toContain('tool.complete');
      expect(types).toContain('conversation.message');
    });

    it('after_tool_call with write_file → file.create + file.write', () => {
      const data = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'write_file',
        params: { path: '/tmp/b.ts' },
      });
      const events = mapEvents(data.hook_event_name!, data);
      const types = events.map(e => e.event_type);
      expect(types).toContain('file.create');
      expect(types).toContain('file.write');
    });

    it('after_tool_call with apply_patch → file.edit with edit_lines', () => {
      const data = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'apply_patch',
        params: { old_string: 'a\nb\nc', path: '/tmp/c.ts' },
      });
      const events = mapEvents(data.hook_event_name!, data);
      const editEvt = events.find(e => e.event_type === 'file.edit');
      expect(editEvt).toBeDefined();
      expect(editEvt!.payload.edit_lines).toBe(3);
    });

    it('after_tool_call with bash → command.run', () => {
      const data = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'bash',
        params: { command: 'npm run build' },
      });
      const events = mapEvents(data.hook_event_name!, data);
      const evt = events.find(e => e.event_type === 'command.run');
      expect(evt).toBeDefined();
      expect(evt!.payload.command).toBe('npm run build');
    });

    it('before_tool_call → tool.requested', () => {
      const data = normalizeOpenClawStdin({
        hook_event_name: 'before_tool_call',
        toolName: 'read_file',
        params: { path: '/tmp/a.ts' },
      });
      const events = mapEvents(data.hook_event_name!, data);
      expect(events).toHaveLength(1);
      expect(events[0]!.event_type).toBe('tool.requested');
    });
  });

  describe('edge cases', () => {
    it('handles missing params gracefully', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'session_start',
        sessionId: 'sess-1',
      });
      expect(result.tool_input).toBeUndefined();
      expect(result.session_id).toBe('sess-1');
    });

    it('handles empty sessionId', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
      });
      expect(result.session_id).toBe('');
    });

    it('passes through unknown hook_event_name', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'some_unknown_hook' as any,
      });
      expect(result.hook_event_name).toBe('some_unknown_hook');
    });
  });
});
