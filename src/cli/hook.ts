#!/usr/bin/env node
/**
 * AGPA Hook CLI — called by Claude Code hooks
 *
 * Three modes:
 *   track <event_type> [payload_json]  — explicit tracking (legacy)
 *   poll                                — evaluate & notify
 *   auto                                — read CC hook stdin JSON, auto-map to AGPA event
 *
 * Hook events → AGPA event mapping:
 *   PostToolUse        → tool.complete   { tool_name, tool_input, duration_ms }
 *                     → conversation.message
 *                     → file.read/create/edit/write (by tool type)
 *                     → command.run, git.commit, git.pr_created (Bash)
 *   PreToolUse         → tool.requested  { tool_name }
 *   PostToolUseFailure → tool.failure    { tool_name, tool_input, error }
 *   TaskCompleted      → task.complete   { task_id, duration_ms }
 *   PostCompact        → context.compacted
 *   SubagentStart      → agent.spawn     { agent_type }
 *   SubagentStop       → (no event emitted)
 *   SessionStart       → session.start   { source }
 *   SessionEnd         → session.end     { reason }
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { sendNotification } from '../utils/notify.js';

const ENGINE = new AchievementEngine();

// ── stdin helpers ─────────────────────────────────────────────

interface HookStdin {
  hook_event_name?: string;
  session_id?: string;
  task_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  duration_ms?: number;
  step_count?: number;
  agent_type?: string;
  source?: string;
  cwd?: string;
}

let stdinCache: string | null = null;

function readStdin(): string {
  if (stdinCache !== null) return stdinCache;
  try {
    stdinCache = fs.readFileSync(0, 'utf-8').trim();
  } catch {
    stdinCache = '';
  }
  return stdinCache;
}

function parseStdin(): HookStdin | null {
  const raw = readStdin();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── CC hook event → AGPA event mapping ────────────────────────

function mapEvents(hookEvent: string, data: HookStdin): Array<{ event_type: string; payload: Record<string, unknown> }> {
  const base: Record<string, unknown> = {};
  if (data.tool_name) base.tool_name = data.tool_name;
  if (data.agent_type) base.agent_type = data.agent_type;
  if (typeof data.duration_ms === 'number') base.duration_ms = data.duration_ms;
  if (data.source) base.source = data.source;

  // Extract context from tool_input
  const ti = data.tool_input || {};
  if (typeof ti.file_path === 'string') base.file_path = ti.file_path;
  if (typeof ti.command === 'string') base.command = ti.command;
  if (typeof ti.description === 'string') base.description = ti.description;

  const results: Array<{ event_type: string; payload: Record<string, unknown> }> = [];

  switch (hookEvent) {
    case 'PostToolUse':
      results.push({ event_type: 'tool.complete', payload: { ...base, role: 'assistant' } });
      // Also emit conversation message (every tool use implies a conversation exchange)
      results.push({ event_type: 'conversation.message', payload: {} });
      // Also emit file-type events based on tool name
      if (data.tool_name === 'Read') results.push({ event_type: 'file.read', payload: { ...base } });
      if (data.tool_name === 'Write') {
        results.push({ event_type: 'file.create', payload: { ...base } });
        results.push({ event_type: 'file.write', payload: { ...base } });
      }
      if (data.tool_name === 'Edit') {
        // Extract edit_lines from old_string, total_file_lines from file on disk (for surgeon metric)
        const editPayload = { ...base };
        if (typeof ti.old_string === 'string') {
          editPayload.edit_lines = ti.old_string.split('\n').length;
        }
        if (typeof ti.file_path === 'string') {
          // Guard: only read files within cwd or home, no traversal
          const fp = ti.file_path as string;
          const resolved = fp.startsWith('/') ? fp : path.resolve(data.cwd || process.cwd(), fp);
          const cwdBase = path.resolve(data.cwd || process.cwd());
          const homeBase = path.resolve(homedir());
          if (fp.includes('..') || (!resolved.startsWith(cwdBase + '/') && !resolved.startsWith(homeBase + '/'))) {
            // skip — path outside allowed boundary
          } else {
            try { editPayload.total_file_lines = fs.readFileSync(resolved, 'utf-8').split('\n').length; } catch { /* file gone */ }
          }
        }
        results.push({ event_type: 'file.edit', payload: editPayload });
      }
      if (data.tool_name === 'Bash' && typeof ti.command === 'string') {
        results.push({ event_type: 'command.run', payload: { ...base } });
        if (ti.command.includes('git commit') || ti.command.includes('git add')) {
          results.push({ event_type: 'git.commit', payload: { ...base } });
        }
        if (ti.command.includes('gh pr create')) {
          results.push({ event_type: 'git.pr_created', payload: { ...base } });
        }
      }
      // MCP tool call
      if (data.tool_name?.startsWith('mcp__')) {
        results.push({ event_type: 'mcp.tool_call', payload: { ...base } });
      }
      break;
    case 'PostToolUseFailure':
      results.push({ event_type: 'tool.failure', payload: { ...base } });
      break;
    case 'PreToolUse':
      results.push({ event_type: 'tool.requested', payload: { tool_name: data.tool_name } });
      break;
    case 'SubagentStart':
      results.push({ event_type: 'agent.spawn', payload: { ...base } });
      break;
    case 'SubagentStop':
      break;
    case 'SessionStart':
      results.push({ event_type: 'session.start', payload: { ...base } });
      break;
    case 'SessionEnd':
      results.push({ event_type: 'session.end', payload: { ...base } });
      break;
    case 'TaskCompleted':
      results.push({
        event_type: 'task.complete',
        payload: {
          task_id: data.task_id || '',
          step_count: data.step_count || 0,
          duration_ms: data.duration_ms || 0,
        },
      });
      break;
    case 'PostCompact':
      results.push({ event_type: 'context.compacted', payload: {} });
      break;
  }

  return results;
}

// ── Commands ──────────────────────────────────────────────────

function cmdTrack(): void {
  const eventType = process.argv[3];
  if (!eventType) {
    process.stderr.write('Usage: hook.ts track <event_type> [payload_json]\n');
    process.exit(1);
  }

  let payload: Record<string, unknown> = {};
  if (process.argv[4]) {
    try { payload = JSON.parse(process.argv[4]); } catch {
      process.stderr.write(`Invalid JSON payload: ${process.argv[4]}\n`);
      process.exit(1);
    }
  }

  ENGINE.init();
  const event = ENGINE.track(eventType, payload);
  process.stderr.write(`[AGPA] track ${eventType} → ${event.event_id}\n`);
}

function cmdPoll(): void {
  ENGINE.init();

  const newlyUnlocked = ENGINE.poll();

  if (newlyUnlocked.length === 0) {
    process.stderr.write('[AGPA] poll: no new achievements\n');
    return;
  }

  const cfg = loadConfig();
  const useZh = cfg.lang === 'zh';
  for (const ach of newlyUnlocked) {
    const icon = ach.icon || '🏆';
    const title = useZh ? (ach.name_cn || ach.name) : ach.name;
    const desc = useZh ? (ach.description_cn || ach.description) : ach.description;
    sendNotification(`${icon} ${title}`, desc, ENGINE.stateDir);
  }

  process.stderr.write(`[AGPA] poll: ${newlyUnlocked.length} new achievement(s) unlocked!\n`);
}

function cmdAuto(): void {
  const data = parseStdin();
  if (!data?.hook_event_name) {
    process.exit(0);
  }

  const events = mapEvents(data.hook_event_name, data);
  if (events.length === 0) {
    process.exit(0);
  }

  if (data.session_id) ENGINE.sessionId = data.session_id;
  if (data.task_id) ENGINE.taskId = data.task_id;
  ENGINE.init();
  for (const { event_type, payload } of events) {
    const event = ENGINE.track(event_type, payload);
    process.stderr.write(`[AGPA] ${data.hook_event_name} → ${event_type} (${event.event_id})\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────

const cmd = process.argv[2];
switch (cmd) {
  case 'track':
    cmdTrack();
    break;
  case 'poll':
    cmdPoll();
    break;
  case 'auto':
    cmdAuto();
    break;
  default:
    process.stderr.write('Usage: hook.ts <track|poll|auto> [args...]\n');
    process.exit(1);
}
