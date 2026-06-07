import { describe, it, expect } from 'vitest';
import { mapEvents, computePromptPayload, parseTranscriptJsonl, normalizeOpenClawStdin, OPENCLAW_EVENT_MAP, OPENCLAW_TOOL_MAP, normalizeKilocodeStdin, KILOCODE_EVENT_MAP, KILOCODE_TOOL_MAP } from '../../src/cli/hook.js';

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

    it('emits image.read + image.upload when Read reads an image file', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/screenshot.png' } };
      const results = mapEvents('PostToolUse', data);
      const types = results.map(r => r.event_type);
      expect(types).toContain('file.read');
      expect(types).toContain('image.read');
      expect(types).toContain('image.upload');
    });

    it('does NOT emit image.read for non-image files', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/a.ts' } };
      const results = mapEvents('PostToolUse', data);
      const types = results.map(r => r.event_type);
      expect(types).not.toContain('image.read');
      expect(types).not.toContain('image.upload');
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

    it('emits task.create for TaskCreate tool', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'TaskCreate',
        tool_input: { title: 'Do the thing', description: 'A thing to do' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'task.create');
      expect(evt).toBeDefined();
      expect(evt!.payload.title).toBe('Do the thing');
      expect(evt!.payload.description).toBe('A thing to do');
    });

    it('emits task.update for TaskUpdate tool', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'TaskUpdate',
        tool_input: { status: 'completed' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'task.update');
      expect(evt).toBeDefined();
      expect(evt!.payload.new_status).toBe('completed');
    });
  });

  describe('PostToolUseFailure', () => {
    it('emits tool.failure + error.occurred', () => {
      const data = { hook_event_name: 'PostToolUseFailure', tool_name: 'Read' };
      const results = mapEvents('PostToolUseFailure', data);
      expect(results).toHaveLength(2);
      expect(results[0]!.event_type).toBe('tool.failure');
      expect(results[1]!.event_type).toBe('error.occurred');
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

    it('SubagentStop emits agent.end', () => {
      const data = { hook_event_name: 'SubagentStop', agent_type: 'explore' };
      const results = mapEvents('SubagentStop', data);
      expect(results).toHaveLength(1);
      expect(results[0]!.event_type).toBe('agent.end');
      expect(results[0]!.payload.agent_type).toBe('explore');
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

// ── KiloCode / OpenCode normalization ──────────────────────────────

describe('normalizeKilocodeStdin', () => {
  describe('event name mapping', () => {
    it('maps tool.execute.after → PostToolUse', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: { filePath: '/tmp/a.ts' },
        sessionId: 'sess-001',
        durationMs: 150,
      });
      expect(result.hook_event_name).toBe('PostToolUse');
      expect(result.tool_name).toBe('Read');
      expect(result.tool_input).toBeDefined();
      expect(result.tool_input!.file_path).toBe('/tmp/a.ts');
      expect(result.session_id).toBe('sess-001');
      expect(result.duration_ms).toBe(150);
      expect(result.source).toBe('kilocode');
    });

    it('maps tool.execute.before → PreToolUse', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.before',
        toolName: 'bash',
        params: {},
        sessionId: 'sess-002',
      });
      expect(result.hook_event_name).toBe('PreToolUse');
      expect(result.tool_name).toBe('Bash');
      expect(result.session_id).toBe('sess-002');
    });

    it('maps session.created → SessionStart', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'session.created',
        sessionId: 'sess-003',
      });
      expect(result.hook_event_name).toBe('SessionStart');
      expect(result.session_id).toBe('sess-003');
    });

    it('maps session.idle → SessionEnd', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'session.idle',
        sessionId: 'sess-004',
      });
      expect(result.hook_event_name).toBe('SessionEnd');
      expect(result.session_id).toBe('sess-004');
    });
  });

  describe('tool name mapping', () => {
    it('maps read → Read', () => {
      expect(normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'read' }).tool_name).toBe('Read');
    });
    it('maps write → Write', () => {
      expect(normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'write' }).tool_name).toBe('Write');
    });
    it('maps edit → Edit', () => {
      expect(normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'edit' }).tool_name).toBe('Edit');
    });
    it('maps bash → Bash', () => {
      expect(normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'bash' }).tool_name).toBe('Bash');
    });
    it('maps glob → Glob', () => {
      expect(normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'glob' }).tool_name).toBe('Glob');
    });
    it('maps grep → Grep', () => {
      expect(normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'grep' }).tool_name).toBe('Grep');
    });
    it('preserves mcp__ prefixed tools unchanged', () => {
      const result = normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'mcp__my_server__my_tool' });
      expect(result.tool_name).toBe('mcp__my_server__my_tool');
    });
    it('passes through unknown tool names', () => {
      const result = normalizeKilocodeStdin({ hook_event_name: 'tool.execute.after', toolName: 'unknown_tool' });
      expect(result.tool_name).toBe('unknown_tool');
    });
  });

  describe('params field mapping (camelCase → snake_case)', () => {
    it('maps params.filePath → tool_input.file_path', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: { filePath: '/tmp/foo.ts' },
      });
      expect(result.tool_input!.file_path).toBe('/tmp/foo.ts');
    });

    it('maps params.command → tool_input.command', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'bash',
        params: { command: 'npm test' },
      });
      expect(result.tool_input!.command).toBe('npm test');
    });

    it('maps params.old_string → tool_input.old_string (snake_case pass-through)', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'edit',
        params: { old_string: 'line1\nline2' },
      });
      expect(result.tool_input!.old_string).toBe('line1\nline2');
    });

    it('maps params.oldString → tool_input.old_string (camelCase variant)', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'edit',
        params: { oldString: 'camelStyle' },
      });
      expect(result.tool_input!.old_string).toBe('camelStyle');
    });

    it('maps params.content → tool_input.content', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'write',
        params: { content: 'hello world' },
      });
      expect(result.tool_input!.content).toBe('hello world');
    });

    it('captures error for tool.failure detection', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'bash',
        params: { command: 'bad' },
        error: 'command not found',
      });
      expect(result.tool_input!.error).toBe('command not found');
    });

    it('snake_case file_path passes through untouched', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: { file_path: '/tmp/snake.ts' },
      });
      expect(result.tool_input!.file_path).toBe('/tmp/snake.ts');
    });
  });

  describe('combined event routing via mapEvents', () => {
    it('tool.execute.after with read → file.read event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: { filePath: '/tmp/x.ts' },
        sessionId: 'sess-x',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const fileRead = events.find(e => e.event_type === 'file.read');
      expect(fileRead).toBeDefined();
      expect(fileRead!.payload.file_path).toBe('/tmp/x.ts');
    });

    it('tool.execute.after with bash → command.run event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'bash',
        params: { command: 'git status' },
        sessionId: 'sess-y',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const cmdRun = events.find(e => e.event_type === 'command.run');
      expect(cmdRun).toBeDefined();
      expect(cmdRun!.payload.command).toBe('git status');
    });

    it('tool.execute.after with edit → file.edit event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'edit',
        params: { filePath: '/tmp/z.ts', old_string: 'a\nb' },
        sessionId: 'sess-z',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const fileEdit = events.find(e => e.event_type === 'file.edit');
      expect(fileEdit).toBeDefined();
      expect(fileEdit!.payload.edit_lines).toBe(2);
    });

    it('tool.execute.before → tool.requested event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.before',
        toolName: 'bash',
        params: { command: 'echo hi' },
        sessionId: 'sess-w',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const requested = events.find(e => e.event_type === 'tool.requested');
      expect(requested).toBeDefined();
      expect(requested!.payload.tool_name).toBe('Bash');
    });

    it('session.created → session.start event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'session.created',
        sessionId: 'sess-v',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const sessStart = events.find(e => e.event_type === 'session.start');
      expect(sessStart).toBeDefined();
    });

    it('session.idle → session.end event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'session.idle',
        sessionId: 'sess-u',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const sessEnd = events.find(e => e.event_type === 'session.end');
      expect(sessEnd).toBeDefined();
    });

    it('tool.execute.after with mcp__ tool → mcp.tool_call event', () => {
      const raw = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'mcp__my_server__my_tool',
        params: { query: 'test' },
        sessionId: 'sess-t',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      const mcpEvent = events.find(e => e.event_type === 'mcp.tool_call');
      expect(mcpEvent).toBeDefined();
      expect(mcpEvent!.payload.tool_name).toBe('mcp__my_server__my_tool');
    });
  });

  describe('edge cases', () => {
    it('handles missing params gracefully', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        sessionId: 'sess-edge',
      });
      expect(result.tool_input).toBeUndefined();
      expect(result.tool_name).toBe('Read');
      expect(result.session_id).toBe('sess-edge');
    });

    it('handles empty sessionId', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'session.created',
      });
      expect(result.session_id).toBe('');
    });

    it('passes through unknown hook_event_name', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'some_future_event' as any,
      });
      expect(result.hook_event_name).toBe('some_future_event');
    });

    it('returns undefined tool_input for empty params', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: {},
      });
      expect(result.tool_input).toBeUndefined();
    });
  });
});

// ── P1-2: computePromptPayload ─────────────────────────────────────────

describe('computePromptPayload', () => {
  it('computes char_count and word_count', () => {
    const pp = computePromptPayload('hello world');
    expect(pp.char_count).toBe(11);
    expect(pp.word_count).toBe(2);
  });

  it('computes prefix_hash deterministically', () => {
    const pp1 = computePromptPayload('hello world this is a test');
    const pp2 = computePromptPayload('hello world this is a test');
    expect(pp1.prefix_hash).toBe(pp2.prefix_hash);
    expect(pp1.prefix_hash).toHaveLength(8);
  });

  it('detects code blocks', () => {
    const pp = computePromptPayload('```\ncode here\n```');
    expect(pp.has_code_block).toBe(true);
  });

  it('no code block for plain text', () => {
    const pp = computePromptPayload('just plain text');
    expect(pp.has_code_block).toBe(false);
  });

  it('handles Chinese text word count', () => {
    const pp = computePromptPayload('你好世界');
    expect(pp.char_count).toBe(4);
  });

  it('handles empty string', () => {
    const pp = computePromptPayload('');
    expect(pp.char_count).toBe(0);
    expect(pp.word_count).toBe(0);
  });
});

// ── P1-2: UserPromptSubmit mapEvents ────────────────────────────────────

describe('mapEvents UserPromptSubmit', () => {
  it('emits user.prompt + user.message events', () => {
    const data = {
      hook_event_name: 'UserPromptSubmit',
      prompt_text: 'hello world',
      tool_input: { prompt_text: 'hello world' },
    };
    const results = mapEvents('UserPromptSubmit', data);
    const types = results.map(r => r.event_type);
    expect(types).toContain('user.prompt');
    expect(types).toContain('user.message');

    const promptEvent = results.find(r => r.event_type === 'user.prompt');
    expect(promptEvent!.payload.char_count).toBe(11);
    expect(promptEvent!.payload.word_count).toBe(2);
    expect(promptEvent!.payload.has_code_block).toBe(false);

    const msgEvent = results.find(r => r.event_type === 'user.message');
    expect(msgEvent!.payload.source).toBe('hook_auto');
  });

  it('does not emit events for empty prompt', () => {
    const data = {
      hook_event_name: 'UserPromptSubmit',
      prompt_text: '',
    };
    const results = mapEvents('UserPromptSubmit', data);
    expect(results.length).toBe(0);
  });

  it('reads prompt_text from tool_input fallback', () => {
    const data = {
      hook_event_name: 'UserPromptSubmit',
      tool_input: { prompt_text: 'from tool input' },
    };
    const results = mapEvents('UserPromptSubmit', data);
    expect(results.length).toBeGreaterThan(0);
    const promptEvent = results.find(r => r.event_type === 'user.prompt');
    expect(promptEvent!.payload.char_count).toBe(15);
  });
});

// ── P0-1: parseTranscriptJsonl ─────────────────────────────────────────

describe('parseTranscriptJsonl', () => {
  it('returns null for non-existent file', () => {
    const result = parseTranscriptJsonl('/tmp/agpa-nonexistent-file-12345.jsonl');
    expect(result).toBeNull();
  });

  it('returns null for empty content', () => {
    const tmp = require('fs').mkdtempSync('/tmp/agpa-test-');
    const filePath = require('path').join(tmp, 'empty.jsonl');
    require('fs').writeFileSync(filePath, '');
    const result = parseTranscriptJsonl(filePath);
    require('fs').rmSync(tmp, { recursive: true, force: true });
    expect(result).toBeNull();
  });
});
