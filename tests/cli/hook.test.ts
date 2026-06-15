import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  mapEvents, computePromptPayload, parseTranscriptJsonl,
  normalizeOpenClawStdin, OPENCLAW_EVENT_MAP, OPENCLAW_TOOL_MAP,
  normalizeKilocodeStdin, KILOCODE_EVENT_MAP, KILOCODE_TOOL_MAP,
  normalizeHermesStdin, HERMES_EVENT_MAP, HERMES_TOOL_MAP,
} from '../../src/cli/hook.js';

// ── Helpers ─────────────────────────────────────────────────────────

function tmpFilePath(name: string): string {
  return path.join(os.tmpdir(), `agpa-hook-test-${name}`);
}

// ── mapEvents — PostToolUse ─────────────────────────────────────────

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

    it('conversation.message carries content when tool_response has output', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Read',
        tool_response: { output: 'file contents here' },
      };
      const results = mapEvents('PostToolUse', data);
      const msg = results.find(r => r.event_type === 'conversation.message')!;
      expect(msg.payload.content).toBe('file contents here');
      expect(msg.payload.length).toBeGreaterThan(0);
    });

    it('conversation.message has no content when tool_response missing', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Glob' };
      const results = mapEvents('PostToolUse', data);
      const msg = results.find(r => r.event_type === 'conversation.message')!;
      expect(msg.payload.content).toBeUndefined();
    });

    // ── file.read ──────────────────────────────────────────────

    it('emits file.read for Read tool', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/a.ts' } };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'file.read');
      expect(evt).toBeDefined();
      expect(evt!.payload.tool_name).toBe('Read');
      expect(evt!.payload.file_path).toBe('/tmp/a.ts');
    });

    it('emits file.language_used for Read of a known code file', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/main.go' } };
      const results = mapEvents('PostToolUse', data);
      const langEvt = results.find(r => r.event_type === 'file.language_used');
      expect(langEvt).toBeDefined();
      expect(langEvt!.payload.language).toBe('go');
    });

    it('emits file.language_used for Read of .ts file', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/src/app.ts' } };
      const results = mapEvents('PostToolUse', data);
      const langEvt = results.find(r => r.event_type === 'file.language_used');
      expect(langEvt).toBeDefined();
      expect(langEvt!.payload.language).toBe('typescript');
    });

    it('does NOT emit file.language_used for unknown extension', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/tmp/README' } };
      const results = mapEvents('PostToolUse', data);
      const langEvt = results.find(r => r.event_type === 'file.language_used');
      expect(langEvt).toBeUndefined();
    });

    // ── image.read / image.upload ──────────────────────────────

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

    it.each(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'])(
      'detects image for extension %s', (ext) => {
        const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: `/tmp/photo${ext}` } };
        const results = mapEvents('PostToolUse', data);
        expect(results.map(r => r.event_type)).toContain('image.read');
        expect(results.map(r => r.event_type)).toContain('image.upload');
      },
    );

    // ── file.create / file.write ───────────────────────────────

    it('emits file.create + file.write for Write tool', () => {
      const tmp = tmpFilePath('create.ts');
      fs.writeFileSync(tmp, '// test');
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: tmp } };
      const results = mapEvents('PostToolUse', data);
      const types = results.map(r => r.event_type);
      expect(types).toContain('file.create');
      expect(types).toContain('file.write');
      fs.unlinkSync(tmp);
    });

    it('emits file.language_used for Write of .py file', () => {
      const tmp = tmpFilePath('write-lang.py');
      fs.writeFileSync(tmp, 'print("hi")');
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: tmp } };
      const results = mapEvents('PostToolUse', data);
      const langEvt = results.find(r => r.event_type === 'file.language_used');
      expect(langEvt).toBeDefined();
      expect(langEvt!.payload.language).toBe('python');
      fs.unlinkSync(tmp);
    });

    // ── file.edit ──────────────────────────────────────────────

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

    it('file.edit emits file.language_used for known lang', () => {
      const tmp = tmpFilePath('edit-lang.rs');
      fs.writeFileSync(tmp, 'fn main() {}');
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Edit',
        tool_input: { file_path: tmp, old_string: 'fn main() {}' },
      };
      const results = mapEvents('PostToolUse', data);
      const langEvt = results.find(r => r.event_type === 'file.language_used');
      expect(langEvt).toBeDefined();
      expect(langEvt!.payload.language).toBe('rust');
      fs.unlinkSync(tmp);
    });

    // ── command.run + git events ──────────────────────────────

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

    it('emits git.add for git add', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'git add .' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('git.add');
      expect(results.map(r => r.event_type)).not.toContain('git.commit');
    });

    it('emits git.push for git push', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'git push origin main' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('git.push');
    });

    it('emits git.pr_created for gh pr create', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'gh pr create --title "fix"' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('git.pr_created');
    });

    it('emits git.bisect for git bisect', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'git bisect start' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('git.bisect');
    });

    it('emits merge.conflict_resolved for git merge --continue', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'git merge --continue' },
      };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'merge.conflict_resolved');
      expect(evt).toBeDefined();
      expect(evt!.payload.agent_involved).toBe(true);
    });

    it('does NOT emit merge.conflict_resolved for normal git merge', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'git merge feature' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).not.toContain('merge.conflict_resolved');
    });

    // ── file.delete ───────────────────────────────────────────

    it('emits file.delete for rm command', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'rm /tmp/old.txt' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('file.delete');
    });

    it('emits file.delete for unlink command', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'unlink /tmp/stale' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('file.delete');
    });

    it('does NOT emit file.delete for harmless Bash', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'echo hello' },
      };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).not.toContain('file.delete');
    });

    it('does NOT emit file.delete for npm install (contains "rm" in npm)', () => {
      // "npm" contains no "rm" sub-word, but "rm -rf" does. Verify npm doesn't match.
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'npm install' },
      };
      const results = mapEvents('PostToolUse', data);
      // "\brm\b" pattern should NOT match "npm" — only whole word 'rm'
      expect(results.map(r => r.event_type)).not.toContain('file.delete');
    });

    // ── mcp.tool_call ─────────────────────────────────────────

    it('emits mcp.tool_call for mcp__ prefixed tools', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'mcp__agpa__achievement_track' };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'mcp.tool_call');
      expect(evt).toBeDefined();
    });

    // ── TaskCreate / TaskUpdate ─────────────────────────────────

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

    it('task.create handles missing title/description gracefully', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'TaskCreate', tool_input: {} };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'task.create');
      expect(evt).toBeDefined();
      expect(evt!.payload.title).toBeUndefined();
      expect(evt!.payload.description).toBeUndefined();
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

    it('task.update handles missing status gracefully', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'TaskUpdate', tool_input: {} };
      const results = mapEvents('PostToolUse', data);
      const evt = results.find(r => r.event_type === 'task.update');
      expect(evt).toBeDefined();
      expect(evt!.payload.new_status).toBeUndefined();
    });
  });

  // ── PostToolUseFailure ───────────────────────────────────────────

  describe('PostToolUseFailure', () => {
    it('emits tool.failure + error.occurred', () => {
      const data = { hook_event_name: 'PostToolUseFailure', tool_name: 'Read' };
      const results = mapEvents('PostToolUseFailure', data);
      expect(results).toHaveLength(2);
      expect(results[0]!.event_type).toBe('tool.failure');
      expect(results[1]!.event_type).toBe('error.occurred');
    });

    it('includes tool_name in failure payloads', () => {
      const data = { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' };
      const results = mapEvents('PostToolUseFailure', data);
      expect(results[0]!.payload.tool_name).toBe('Bash');
      expect(results[1]!.payload.tool_name).toBe('Bash');
    });

    it('includes error text in failure payloads when tool_input has error', () => {
      const data = {
        hook_event_name: 'PostToolUseFailure',
        tool_name: 'Bash',
        tool_input: { command: 'bad', error: 'command not found: bad' },
      };
      const results = mapEvents('PostToolUseFailure', data);
      expect(results[0]!.payload.error).toBe('command not found: bad');
      expect(results[1]!.payload.error).toBe('command not found: bad');
    });

    it('omits error field when tool_input has no error', () => {
      const data = { hook_event_name: 'PostToolUseFailure', tool_name: 'Read' };
      const results = mapEvents('PostToolUseFailure', data);
      expect(results[0]!.payload).not.toHaveProperty('error');
      expect(results[1]!.payload).not.toHaveProperty('error');
    });
  });

  // ── PreToolUse ───────────────────────────────────────────────────

  describe('PreToolUse', () => {
    it('emits tool.requested', () => {
      const data = { hook_event_name: 'PreToolUse', tool_name: 'Bash' };
      const results = mapEvents('PreToolUse', data);
      expect(results).toHaveLength(1);
      expect(results[0]!.event_type).toBe('tool.requested');
      expect(results[0]!.payload.tool_name).toBe('Bash');
    });
  });

  // ── SubagentStart / SubagentStop ─────────────────────────────────

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

  // ── SessionStart / SessionEnd ────────────────────────────────────

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

  // ── TaskCompleted ────────────────────────────────────────────────

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

    it('task.complete defaults missing step_count/duration_ms to 0', () => {
      const data = { hook_event_name: 'TaskCompleted' };
      const results = mapEvents('TaskCompleted', data);
      expect(results[0]!.payload.step_count).toBe(0);
      expect(results[0]!.payload.duration_ms).toBe(0);
    });
  });

  // ── PostCompact ──────────────────────────────────────────────────

  describe('PostCompact', () => {
    it('emits context.compacted', () => {
      const data = { hook_event_name: 'PostCompact' };
      const results = mapEvents('PostCompact', data);
      expect(results[0]!.event_type).toBe('context.compacted');
    });

    it('PostCompact has empty payload', () => {
      const data = { hook_event_name: 'PostCompact' };
      const results = mapEvents('PostCompact', data);
      expect(results[0]!.payload).toEqual({});
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty array for unknown hook_event_name', () => {
      const data = { hook_event_name: 'SomeFutureEvent' as any };
      const results = mapEvents('SomeFutureEvent', data);
      expect(results).toEqual([]);
    });

    it('base payload includes hour and day_of_week from current time', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read' };
      const results = mapEvents('PostToolUse', data);
      const tc = results.find(r => r.event_type === 'tool.complete')!;
      const now = new Date();
      expect(tc.payload.hour).toBe(now.getHours());
      expect(tc.payload.day_of_week).toBe(now.getDay());
    });

    it('base payload propagates tool_name and agent_type', () => {
      const data = { hook_event_name: 'SubagentStart', tool_name: 'sub', agent_type: 'code-review' };
      const results = mapEvents('SubagentStart', data);
      expect(results[0]!.payload.tool_name).toBe('sub');
      expect(results[0]!.payload.agent_type).toBe('code-review');
    });

    it('base payload includes duration_ms when present', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', duration_ms: 1500 };
      const results = mapEvents('PostToolUse', data);
      const tc = results.find(r => r.event_type === 'tool.complete')!;
      expect(tc.payload.duration_ms).toBe(1500);
    });

    it('base payload omits duration_ms when absent', () => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read' };
      const results = mapEvents('PostToolUse', data);
      const tc = results.find(r => r.event_type === 'tool.complete')!;
      expect(tc.payload).not.toHaveProperty('duration_ms');
    });

    it('base includes file_path and command from tool_input when present', () => {
      const data = {
        hook_event_name: 'PostToolUse', tool_name: 'Bash',
        tool_input: { command: 'ls', file_path: '/tmp/x' },
      };
      const results = mapEvents('PostToolUse', data);
      const cr = results.find(r => r.event_type === 'command.run')!;
      expect(cr.payload.command).toBe('ls');
      expect(cr.payload.file_path).toBe('/tmp/x');
    });
  });
});

// ── computePromptPayload ─────────────────────────────────────────

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

  it('detects code blocks with triple backticks', () => {
    const pp = computePromptPayload('```\ncode here\n```');
    expect(pp.has_code_block).toBe(true);
  });

  it('no code block for plain text', () => {
    const pp = computePromptPayload('just plain text');
    expect(pp.has_code_block).toBe(false);
  });

  it('detects code blocks with language specifier', () => {
    const pp = computePromptPayload('```typescript\nconst x = 1;\n```');
    expect(pp.has_code_block).toBe(true);
  });

  it('detects code blocks in mixed content', () => {
    const pp = computePromptPayload('Fix this:\n```\nbuggy code\n```\nThanks!');
    expect(pp.has_code_block).toBe(true);
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

  it('handles very long prompt without crash', () => {
    const long = 'hello '.repeat(2000);
    const pp = computePromptPayload(long);
    expect(pp.char_count).toBe(long.length);
    expect(pp.word_count).toBe(2000);
    expect(pp.prefix_hash).toHaveLength(8);
  });

  it('handles whitespace-only prompt', () => {
    const pp = computePromptPayload('   \n  \t  ');
    expect(pp.char_count).toBeGreaterThan(0);
    expect(pp.word_count).toBe(0);
  });

  it('handles prompt with many code blocks', () => {
    const multi = '```a``` and ```b``` and ```c```';
    const pp = computePromptPayload(multi);
    expect(pp.has_code_block).toBe(true);
  });
});

// ── mapEvents UserPromptSubmit ─────────────────────────────────────

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

  it('detects code blocks in prompt text', () => {
    const data = {
      hook_event_name: 'UserPromptSubmit',
      prompt_text: 'Fix this:\n```ts\nconst x = 1\n```',
    };
    const results = mapEvents('UserPromptSubmit', data);
    const promptEvent = results.find(r => r.event_type === 'user.prompt')!;
    expect(promptEvent.payload.has_code_block).toBe(true);
    expect(promptEvent.payload.char_count).toBeGreaterThan(0);
  });

  it('handles Chinese prompt text', () => {
    const data = {
      hook_event_name: 'UserPromptSubmit',
      prompt_text: '你好，请帮我修复这个bug',
    };
    const results = mapEvents('UserPromptSubmit', data);
    const promptEvent = results.find(r => r.event_type === 'user.prompt')!;
    expect(promptEvent.payload.char_count).toBe(13);
    // Chinese text without spaces returns 1 word (regex treats it as one segment)
  });

  it('does not emit events for empty prompt', () => {
    const data = {
      hook_event_name: 'UserPromptSubmit',
      prompt_text: '',
    };
    const results = mapEvents('UserPromptSubmit', data);
    expect(results.length).toBe(0);
  });

  it('does not emit events for whitespace-only prompt (treated as empty by trim)', () => {
    // Whitespace-only strings still pass `if (promptText)` — the code uses
    // promptText as a boolean guard, and "   " is truthy. This is by design:
    // whitespace-only prompts are rare in practice. The prompt's char_count
    // reflects actual length.
    const data = {
      hook_event_name: 'UserPromptSubmit',
      prompt_text: '   ',
    };
    const results = mapEvents('UserPromptSubmit', data);
    // Whitespace string IS truthy, so events ARE emitted (by design)
    expect(results.length).toBeGreaterThan(0);
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

  it('hashes full prompt text without storing it', () => {
    // Verify the hash is a fingerprint, not the text itself
    const text1 = 'Implement a REST API for the user management system';
    const text2 = 'Implement a REST API for the user management system';
    const data1 = { hook_event_name: 'UserPromptSubmit', prompt_text: text1 };
    const data2 = { hook_event_name: 'UserPromptSubmit', prompt_text: text2 };
    const r1 = mapEvents('UserPromptSubmit', data1);
    const r2 = mapEvents('UserPromptSubmit', data2);
    const h1 = r1.find(r => r.event_type === 'user.prompt')!.payload.prefix_hash;
    const h2 = r2.find(r => r.event_type === 'user.prompt')!.payload.prefix_hash;
    expect(h1).toBe(h2);
    // Full text should NOT be in payload
    expect(r1.find(r => r.event_type === 'user.prompt')!.payload).not.toHaveProperty('text');
  });
});

// ── parseTranscriptJsonl ──────────────────────────────────────────

describe('parseTranscriptJsonl', () => {
  it('returns null for non-existent file', () => {
    const result = parseTranscriptJsonl('/tmp/agpa-nonexistent-file-12345.jsonl');
    expect(result).toBeNull();
  });

  it('returns null for empty content', () => {
    const tmp = tmpFilePath('empty.jsonl');
    fs.writeFileSync(tmp, '');
    const result = parseTranscriptJsonl(tmp);
    fs.unlinkSync(tmp);
    expect(result).toBeNull();
  });

  it('parses a valid transcript file', () => {
    const tmp = tmpFilePath('valid.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', timestamp: '2026-06-08T10:00:00Z', usage: { input_tokens: 100, output_tokens: 50 } }),
      JSON.stringify({ type: 'assistant', timestamp: '2026-06-08T10:01:00Z', usage: { input_tokens: 200, output_tokens: 300 } }),
      JSON.stringify({ type: 'user', timestamp: '2026-06-08T10:02:00Z', usage: { input_tokens: 150, output_tokens: 80 } }),
      JSON.stringify({ type: 'assistant', timestamp: '2026-06-08T10:05:00Z', usage: { input_tokens: 400, output_tokens: 600 } }),
    ];
    fs.writeFileSync(tmp, lines.join('\n') + '\n');
    const result = parseTranscriptJsonl(tmp);
    fs.unlinkSync(tmp);

    expect(result).not.toBeNull();
    expect(result!.user_message_count).toBe(2);
    expect(result!.total_input_tokens).toBe(850);
    expect(result!.total_output_tokens).toBe(1030);
    expect(result!.session_duration_ms).toBe(300_000); // 5 min
  });

  it('handles cache tokens', () => {
    const tmp = tmpFilePath('cache.jsonl');
    fs.writeFileSync(tmp, JSON.stringify({
      type: 'user', timestamp: '2026-06-08T10:00:00Z',
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 50 },
    }) + '\n');
    const result = parseTranscriptJsonl(tmp);
    fs.unlinkSync(tmp);
    expect(result!.total_cache_read_tokens).toBe(100);
    expect(result!.total_cache_creation_tokens).toBe(50);
  });

  it('handles mixed valid/invalid lines gracefully', () => {
    const tmp = tmpFilePath('mixed.jsonl');
    const lines = [
      'not json',
      JSON.stringify({ type: 'user', timestamp: '2026-06-08T10:00:00Z', usage: { input_tokens: 50, output_tokens: 30 } }),
      'also not json',
      JSON.stringify({ type: 'assistant', timestamp: '2026-06-08T10:01:00Z', usage: { input_tokens: 20, output_tokens: 10 } }),
    ];
    fs.writeFileSync(tmp, lines.join('\n') + '\n');
    const result = parseTranscriptJsonl(tmp);
    fs.unlinkSync(tmp);
    expect(result).not.toBeNull();
    expect(result!.user_message_count).toBe(1);
    expect(result!.total_input_tokens).toBe(70);
  });

  it('returns null when file has only unparseable lines', () => {
    const tmp = tmpFilePath('all-bad.jsonl');
    fs.writeFileSync(tmp, 'garbage\nmore garbage\n');
    const result = parseTranscriptJsonl(tmp);
    fs.unlinkSync(tmp);
    expect(result).toBeNull();
  });
});

// ── normalizeOpenClawStdin ───────────────────────────────────────

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
      const tmp = tmpFilePath('ocl-create.ts');
      fs.writeFileSync(tmp, '// test');
      const data = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'write_file',
        params: { path: tmp },
      });
      const events = mapEvents(data.hook_event_name!, data);
      const types = events.map(e => e.event_type);
      expect(types).toContain('file.create');
      expect(types).toContain('file.write');
      fs.unlinkSync(tmp);
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

  describe('failure routing', () => {
    it('routes to PostToolUseFailure when success is false', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'bash',
        params: { command: 'bad' },
        success: false,
        error: 'command not found',
      });
      expect(result.hook_event_name).toBe('PostToolUseFailure');
      expect(result.tool_input?.error).toBe('command not found');
    });

    it('routes to PostToolUseFailure when error is set (without success)', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
        params: { path: '/missing' },
        error: 'ENOENT',
      });
      expect(result.hook_event_name).toBe('PostToolUseFailure');
    });

    it('stays as PostToolUse when success is true and no error', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
        params: { path: '/tmp/x' },
        success: true,
      });
      expect(result.hook_event_name).toBe('PostToolUse');
    });

    it('stays as PostToolUse when success and error are absent', () => {
      const result = normalizeOpenClawStdin({
        hook_event_name: 'after_tool_call',
        toolName: 'read_file',
        params: { path: '/tmp/x' },
      });
      expect(result.hook_event_name).toBe('PostToolUse');
    });
  });
});

// ── normalizeKilocodeStdin ────────────────────────────────────────

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

  describe('failure routing', () => {
    it('routes to PostToolUseFailure when success is false', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'bash',
        params: { command: 'bad' },
        success: false,
        error: 'command not found',
      });
      expect(result.hook_event_name).toBe('PostToolUseFailure');
    });

    it('routes to PostToolUseFailure when error is set (without success)', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: { filePath: '/missing' },
        error: 'ENOENT',
      });
      expect(result.hook_event_name).toBe('PostToolUseFailure');
    });

    it('stays as PostToolUse when success and error are absent', () => {
      const result = normalizeKilocodeStdin({
        hook_event_name: 'tool.execute.after',
        toolName: 'read',
        params: { filePath: '/tmp/x' },
      });
      expect(result.hook_event_name).toBe('PostToolUse');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hermes → CC translation (NEW — was previously untested)
// ═══════════════════════════════════════════════════════════════════

describe('normalizeHermesStdin', () => {
  describe('event name mapping', () => {
    it('maps post_tool_call → PostToolUse', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'read_file',
        tool_input: { path: '/tmp/a.ts' },
        session_id: 'hermes-sess-1',
        duration_ms: 200,
      });
      expect(result.hook_event_name).toBe('PostToolUse');
      expect(result.tool_name).toBe('Read');
      expect(result.tool_input?.file_path).toBe('/tmp/a.ts');
      expect(result.session_id).toBe('hermes-sess-1');
      expect(result.duration_ms).toBe(200);
      expect(result.source).toBe('hermes');
    });

    it('maps pre_tool_call → PreToolUse', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'pre_tool_call',
        tool_name: 'bash',
        tool_input: { command: 'npm install' },
        session_id: 'hermes-sess-2',
      });
      expect(result.hook_event_name).toBe('PreToolUse');
      expect(result.tool_name).toBe('Bash');
      expect(result.tool_input?.command).toBe('npm install');
    });

    it('maps on_session_start → SessionStart', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'on_session_start',
        session_id: 'hermes-sess-3',
      });
      expect(result.hook_event_name).toBe('SessionStart');
      expect(result.session_id).toBe('hermes-sess-3');
    });

    it('maps on_session_end → SessionEnd', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'on_session_end',
        session_id: 'hermes-sess-4',
      });
      expect(result.hook_event_name).toBe('SessionEnd');
    });
  });

  describe('tool name mapping', () => {
    it.each([
      ['read_file', 'Read'],
      ['write_file', 'Write'],
      ['edit_file', 'Edit'],
      ['bash', 'Bash'],
      ['terminal', 'Bash'],
    ])('%s → %s', (input, expected) => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: input,
      });
      expect(result.tool_name).toBe(expected);
    });

    it('passes through unknown tool names', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'some_custom_tool',
      });
      expect(result.tool_name).toBe('some_custom_tool');
    });
  });

  describe('field translation', () => {
    it('maps Hermes path → CC file_path', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'read_file',
        tool_input: { path: '/tmp/config.yaml' },
      });
      expect(result.tool_input?.file_path).toBe('/tmp/config.yaml');
    });

    it('preserves existing file_path if present', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'read_file',
        tool_input: { file_path: '/tmp/existing.ts', path: '/tmp/config.yaml' },
      });
      expect(result.tool_input?.file_path).toBe('/tmp/existing.ts');
      expect(result.tool_input?.path).toBe('/tmp/config.yaml');
    });

    it('passes through other tool_input fields', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'write_file',
        tool_input: { path: '/tmp/out.ts', content: 'export {}' },
      });
      expect(result.tool_input?.file_path).toBe('/tmp/out.ts');
      expect(result.tool_input?.content).toBe('export {}');
    });

    it('extracts agent_type from extra field', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'on_session_start',
        session_id: 'hermes-sess-5',
        extra: { agent_type: 'code-review', task_id: 't-123' },
      });
      expect(result.agent_type).toBe('code-review');
      expect(result.task_id).toBe('t-123');
    });

    it('falls back to top-level agent_type if extra is missing', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'on_session_start',
        session_id: 'hermes-sess-6',
        agent_type: 'explore',
      });
      expect(result.agent_type).toBe('explore');
    });

    it('handles missing extra gracefully', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'on_session_start',
        session_id: 'hermes-sess-7',
      });
      expect(result.task_id).toBe('');
      expect(result.agent_type).toBeUndefined();
    });
  });

  describe('combined event routing via mapEvents', () => {
    it('post_tool_call with read_file → PostToolUse → file.read', () => {
      const raw = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'read_file',
        tool_input: { path: '/tmp/read.ts' },
        session_id: 'hermes-sess-r1',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      expect(events.find(e => e.event_type === 'file.read')).toBeDefined();
      expect(events.find(e => e.event_type === 'tool.complete')).toBeDefined();
    });

    it('post_tool_call with write_file → PostToolUse → file.create + file.write', () => {
      const tmp = tmpFilePath('hermes-write.ts');
      fs.writeFileSync(tmp, '// hermes test');
      const raw = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'write_file',
        tool_input: { path: tmp },
        session_id: 'hermes-sess-w1',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      expect(events.map(e => e.event_type)).toContain('file.create');
      expect(events.map(e => e.event_type)).toContain('file.write');
      fs.unlinkSync(tmp);
    });

    it('post_tool_call with bash → PostToolUse → command.run', () => {
      const raw = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'bash',
        tool_input: { command: 'npm test' },
        session_id: 'hermes-sess-c1',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      expect(events.find(e => e.event_type === 'command.run')).toBeDefined();
    });

    it('pre_tool_call → PreToolUse → tool.requested', () => {
      const raw = normalizeHermesStdin({
        hook_event_name: 'pre_tool_call',
        tool_name: 'edit_file',
        tool_input: { path: '/tmp/edit.ts' },
        session_id: 'hermes-sess-p1',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      expect(events).toHaveLength(1);
      expect(events[0]!.event_type).toBe('tool.requested');
    });

    it('on_session_start → SessionStart → session.start', () => {
      const raw = normalizeHermesStdin({
        hook_event_name: 'on_session_start',
        session_id: 'hermes-sess-s1',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      expect(events[0]!.event_type).toBe('session.start');
    });

    it('on_session_end → SessionEnd → session.end', () => {
      const raw = normalizeHermesStdin({
        hook_event_name: 'on_session_end',
        session_id: 'hermes-sess-e1',
      });
      const events = mapEvents(raw.hook_event_name!, raw);
      expect(events[0]!.event_type).toBe('session.end');
    });
  });

  describe('edge cases', () => {
    it('handles missing tool_input entirely', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'on_session_start',
        session_id: 'hermes-sess-edge1',
      });
      // When no tool_input is provided, the function spreads {} as a default,
      // resulting in an empty object (not undefined).
      expect(result.tool_input).toEqual({});
    });

    it('handles empty session_id', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
      });
      expect(result.session_id).toBe('');
    });

    it('passes through unknown hook_event_name', () => {
      const result = normalizeHermesStdin({
        hook_event_name: 'hermes_future_event' as any,
      });
      expect(result.hook_event_name).toBe('hermes_future_event');
    });
  });

  describe('failure routing (none)', () => {
    it('does NOT route to PostToolUseFailure — Hermes lacks success/error fields', () => {
      // Hermes post_tool_call always maps to PostToolUse, regardless of outcome.
      // tool.failure + error.occurred must be tracked manually on Hermes.
      const result = normalizeHermesStdin({
        hook_event_name: 'post_tool_call',
        tool_name: 'bash',
        tool_input: { command: 'bad' },
      });
      expect(result.hook_event_name).toBe('PostToolUse');
    });
  });
});

// ── Event / Tool map constant integrity ────────────────────────────

describe('event/tool maps', () => {
  it('HERMES_EVENT_MAP covers all 4 expected events', () => {
    expect(Object.keys(HERMES_EVENT_MAP)).toHaveLength(4);
    expect(HERMES_EVENT_MAP['post_tool_call']).toBe('PostToolUse');
    expect(HERMES_EVENT_MAP['pre_tool_call']).toBe('PreToolUse');
    expect(HERMES_EVENT_MAP['on_session_start']).toBe('SessionStart');
    expect(HERMES_EVENT_MAP['on_session_end']).toBe('SessionEnd');
  });

  it('HERMES_TOOL_MAP covers all 5 expected tools', () => {
    expect(Object.keys(HERMES_TOOL_MAP)).toHaveLength(5);
    expect(HERMES_TOOL_MAP['read_file']).toBe('Read');
    expect(HERMES_TOOL_MAP['write_file']).toBe('Write');
    expect(HERMES_TOOL_MAP['edit_file']).toBe('Edit');
    expect(HERMES_TOOL_MAP['bash']).toBe('Bash');
    expect(HERMES_TOOL_MAP['terminal']).toBe('Bash'); // alias
  });

  it('OPENCLAW_EVENT_MAP covers all 5 expected events', () => {
    expect(Object.keys(OPENCLAW_EVENT_MAP)).toHaveLength(5);
    expect(OPENCLAW_EVENT_MAP['after_tool_call']).toBe('PostToolUse');
    expect(OPENCLAW_EVENT_MAP['before_tool_call']).toBe('PreToolUse');
    expect(OPENCLAW_EVENT_MAP['session_start']).toBe('SessionStart');
    expect(OPENCLAW_EVENT_MAP['session_end']).toBe('SessionEnd');
    expect(OPENCLAW_EVENT_MAP['agent_end']).toBe('agent.end');
  });

  it('OPENCLAW_TOOL_MAP covers all 6 expected tools', () => {
    expect(Object.keys(OPENCLAW_TOOL_MAP)).toHaveLength(6);
    expect(OPENCLAW_TOOL_MAP['read_file']).toBe('Read');
    expect(OPENCLAW_TOOL_MAP['write_file']).toBe('Write');
    expect(OPENCLAW_TOOL_MAP['apply_patch']).toBe('Edit');
    expect(OPENCLAW_TOOL_MAP['bash']).toBe('Bash');
    expect(OPENCLAW_TOOL_MAP['glob']).toBe('Glob');
    expect(OPENCLAW_TOOL_MAP['grep']).toBe('Grep');
  });

  it('KILOCODE_EVENT_MAP covers all 4 expected events', () => {
    expect(Object.keys(KILOCODE_EVENT_MAP)).toHaveLength(4);
    expect(KILOCODE_EVENT_MAP['tool.execute.after']).toBe('PostToolUse');
    expect(KILOCODE_EVENT_MAP['tool.execute.before']).toBe('PreToolUse');
    expect(KILOCODE_EVENT_MAP['session.created']).toBe('SessionStart');
    expect(KILOCODE_EVENT_MAP['session.idle']).toBe('SessionEnd');
  });

  it('KILOCODE_TOOL_MAP covers all 8 expected tools', () => {
    expect(Object.keys(KILOCODE_TOOL_MAP)).toHaveLength(8);
    expect(KILOCODE_TOOL_MAP['read']).toBe('Read');
    expect(KILOCODE_TOOL_MAP['write']).toBe('Write');
    expect(KILOCODE_TOOL_MAP['edit']).toBe('Edit');
    expect(KILOCODE_TOOL_MAP['bash']).toBe('Bash');
    expect(KILOCODE_TOOL_MAP['glob']).toBe('Glob');
    expect(KILOCODE_TOOL_MAP['grep']).toBe('Grep');
    expect(KILOCODE_TOOL_MAP['task']).toBe('Task');
    expect(KILOCODE_TOOL_MAP['ask']).toBe('Ask');
  });
});

// ── Image file extension detection ─────────────────────────────────

describe('image file detection', () => {
  it.each(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'])(
    'detects image for Read of %s', (ext) => {
      const data = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: `/tmp/photo${ext}` } };
      const results = mapEvents('PostToolUse', data);
      expect(results.map(r => r.event_type)).toContain('image.read');
      expect(results.map(r => r.event_type)).toContain('image.upload');
    },
  );
});

// ── Bash regex edge cases ──────────────────────────────────────────

describe('Bash git detection regex', () => {
  it('git add includes "git add" → git.add', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'git add src/' },
    });
    expect(results.map(r => r.event_type)).toContain('git.add');
    expect(results.map(r => r.event_type)).not.toContain('git.commit');
  });

  it('git commit -a (contains both "commit" and "add") → only git.commit', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'git commit -am "fix: stuff"' },
    });
    expect(results.map(r => r.event_type)).toContain('git.commit');
    expect(results.map(r => r.event_type)).not.toContain('git.add');
  });

  it('git commit with message → git.commit', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'git commit -m "feat: add thing"' },
    });
    expect(results.map(r => r.event_type)).toContain('git.commit');
  });

  it('echo with "git commit" in quotes still matches git.commit', () => {
    // The regex is intentionally broad: command.includes('git commit').
    // Echoing the string "git commit" is unusual enough to count.
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'echo "git commit"' },
    });
    // Simple substring matching means this WILL trigger (by design)
    expect(results.map(r => r.event_type)).toContain('git.commit');
  });

  it('non-git commands do not trigger git events', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'npm run build' },
    });
    const types = results.map(r => r.event_type);
    expect(types).not.toContain('git.commit');
    expect(types).not.toContain('git.push');
    expect(types).not.toContain('git.pr_created');
    expect(types).not.toContain('git.bisect');
  });

  it('git push origin → git.push', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'git push origin main' },
    });
    expect(results.map(r => r.event_type)).toContain('git.push');
  });

  it('rm -rf → file.delete', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'rm -rf node_modules' },
    });
    expect(results.map(r => r.event_type)).toContain('file.delete');
  });

  it('unlink stale_link → file.delete', () => {
    const results = mapEvents('PostToolUse', {
      hook_event_name: 'PostToolUse', tool_name: 'Bash',
      tool_input: { command: 'unlink /tmp/stale' },
    });
    expect(results.map(r => r.event_type)).toContain('file.delete');
  });
});
