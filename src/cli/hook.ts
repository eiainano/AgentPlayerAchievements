#!/usr/bin/env node
/**
 * AGPA Hook CLI — event ingestion entry point for all AI coding tools
 *
 * Architecture: All tools feed events into hook.ts via stdin pipe (short-lived subprocess).
 * hook.ts → translate tool format → CC standard format → mapEvents() → ENGINE.track() → event.log
 *
 * Modes:
 *   track <event_type> [payload_json]  — explicit tracking (legacy)
 *   poll                                — evaluate & notify
 *   auto                                — read CC hook stdin JSON, auto-map to AGPA event
 *   hermes-auto                         — read Hermes hook stdin JSON, translate → CC format → AGPA event
 *   openclaw-auto                       — read OpenClaw hook stdin JSON, translate → CC format → AGPA event
 *
 * CC Hook events → AGPA event mapping:
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
 *
 * Hermes Hook events → CC event mapping (translation layer):
 *   post_tool_call     → PostToolUse
 *   pre_tool_call      → PreToolUse
 *   on_session_start   → SessionStart
 *   on_session_end     → SessionEnd
 *
 * OpenClaw Hook events → CC event mapping (translation layer):
 *   after_tool_call    → PostToolUse
 *   before_tool_call   → PreToolUse
 *   session_start      → SessionStart
 *   session_end        → SessionEnd
 *   agent_end          → agent.end
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

export function mapEvents(hookEvent: string, data: HookStdin): Array<{ event_type: string; payload: Record<string, unknown> }> {
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
      const msgPayload: Record<string, unknown> = { role: 'assistant' };
      if (data.tool_response && typeof (data.tool_response as Record<string, unknown>).output === 'string') {
        const output = (data.tool_response as Record<string, unknown>).output as string;
        msgPayload.content = output;
        msgPayload.length = output.length;
      }
      results.push({ event_type: 'conversation.message', payload: msgPayload });
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
        const cmdPayload: Record<string, unknown> = { ...base, command: ti.command };
        if (typeof data.duration_ms === 'number') {
          cmdPayload.duration_ms = data.duration_ms;
        }
        results.push({ event_type: 'command.run', payload: cmdPayload });
        if (ti.command.includes('git commit') || ti.command.includes('git add')) {
          results.push({ event_type: 'git.commit', payload: { ...base } });
        }
        if (ti.command.includes('gh pr create')) {
          results.push({ event_type: 'git.pr_created', payload: { ...base } });
        }
        if (ti.command.includes('git bisect')) {
          results.push({ event_type: 'git.bisect', payload: { ...base } });
        }
        if (ti.command.includes('git merge') && ti.command.includes('--continue')) {
          results.push({ event_type: 'merge.conflict_resolved', payload: { ...base, agent_involved: true } });
        }
        if (ti.command.includes('git push')) {
          const now = new Date();
          results.push({ event_type: 'git.push', payload: { ...base, day_of_week: now.getDay(), hour: now.getHours() } });
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

// ── Hermes → CC stdin translation ─────────────────────────────

/**
 * Hermes hook event names → CC hook event names
 */
const HERMES_EVENT_MAP: Record<string, string> = {
  'post_tool_call':   'PostToolUse',
  'pre_tool_call':    'PreToolUse',
  'on_session_start': 'SessionStart',
  'on_session_end':   'SessionEnd',
};

/**
 * Hermes tool names → CC tool names
 */
const HERMES_TOOL_MAP: Record<string, string> = {
  'read_file':    'Read',
  'write_file':   'Write',
  'edit_file':    'Edit',
  'bash':         'Bash',
  'terminal':     'Bash',
};

/**
 * Normalize Hermes stdin to CC-compatible HookStdin.
 * - Maps event names: post_tool_call → PostToolUse
 * - Maps tool names: write_file → Write, read_file → Read, etc.
 * - Maps field names: tool_input.path → tool_input.file_path
 */
function normalizeHermesStdin(raw: Record<string, unknown>): HookStdin {
  const event = HERMES_EVENT_MAP[raw.hook_event_name as string] || raw.hook_event_name as string;
  let toolName = (raw.tool_name as string) || '';
  toolName = HERMES_TOOL_MAP[toolName] || toolName;

  const ti = (raw.tool_input || {}) as Record<string, unknown>;
  // Hermes uses 'path', CC uses 'file_path'
  const normalizedTi: Record<string, unknown> = { ...ti };
  if (typeof ti.path === 'string' && !ti.file_path) {
    normalizedTi.file_path = ti.path;
  }

  const extra = (raw.extra || {}) as Record<string, unknown>;

  return {
    hook_event_name: event,
    tool_name: toolName,
    tool_input: normalizedTi,
    session_id: (raw.session_id as string) || '',
    task_id: (extra.task_id as string) || '',
    duration_ms: typeof raw.duration_ms === 'number' ? raw.duration_ms : undefined,
    agent_type: (extra.agent_type || raw.agent_type) as string | undefined,
    source: 'hermes',
    cwd: raw.cwd as string | undefined,
  };
}

// ── OpenClaw → CC stdin translation ───────────────────────────

/**
 * OpenClaw hook event names → CC hook event names
 */
export const OPENCLAW_EVENT_MAP: Record<string, string> = {
  'after_tool_call':  'PostToolUse',
  'before_tool_call': 'PreToolUse',
  'session_start':    'SessionStart',
  'session_end':      'SessionEnd',
  'agent_end':        'agent.end',
};

/**
 * OpenClaw tool names → CC tool names
 */
export const OPENCLAW_TOOL_MAP: Record<string, string> = {
  'read_file':    'Read',
  'write_file':   'Write',
  'apply_patch':  'Edit',
  'bash':         'Bash',
  'glob':         'Glob',
  'grep':         'Grep',
};

interface OpenClawStdin {
  hook_event_name: string;
  toolName?: string;
  params?: Record<string, unknown>;
  sessionId?: string;
  durationMs?: number;
  runId?: string;
  error?: string;
  messageCount?: number;
  reason?: string;
  success?: boolean;
  [key: string]: unknown;
}

/**
 * Normalize OpenClaw stdin to CC-compatible HookStdin.
 *
 * Key field mappings:
 *   toolName        → tool_name
 *   params.path     → tool_input.file_path
 *   params.command  → tool_input.command
 *   params.content  → tool_input.content
 *   params.old_string → tool_input.old_string
 *   sessionId       → session_id
 *   durationMs      → duration_ms
 *   error           → tool_input.error  (for after_tool_call failures)
 */
export function normalizeOpenClawStdin(raw: OpenClawStdin): HookStdin {
  const event = OPENCLAW_EVENT_MAP[raw.hook_event_name] || raw.hook_event_name;

  let toolName = (raw.toolName || '') as string;
  toolName = OPENCLAW_TOOL_MAP[toolName] || toolName;

  // Map OpenClaw params → CC tool_input format
  const params = raw.params || {};
  const ti: Record<string, unknown> = {};
  if (typeof params.path === 'string') ti.file_path = params.path;
  if (typeof params.command === 'string') ti.command = params.command;
  if (typeof params.content === 'string') ti.content = params.content;
  if (typeof params.old_string === 'string') ti.old_string = params.old_string;
  if (typeof params.description === 'string') ti.description = params.description;
  // Capture error from after_tool_call for tool.failure detection
  if (typeof raw.error === 'string' && raw.error) ti.error = raw.error;

  return {
    hook_event_name: event,
    tool_name: toolName,
    tool_input: Object.keys(ti).length > 0 ? ti : undefined,
    session_id: (raw.sessionId as string) || '',
    duration_ms: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    source: 'openclaw',
  };
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

function cmdHermesAuto(): void {
  const raw = parseStdin() as Record<string, unknown> | null;
  if (!raw?.hook_event_name) {
    process.exit(0);
  }

  const data = normalizeHermesStdin(raw);
  const events = mapEvents(data.hook_event_name!, data);
  if (events.length === 0) {
    process.exit(0);
  }

  // Hermes session_id can be empty for pre_tool_call — use latest from engine
  if (data.session_id) ENGINE.sessionId = data.session_id;
  if (data.task_id) ENGINE.taskId = data.task_id;
  ENGINE.init();
  // Fallback: if Hermes didn't provide session_id, recover from event log
  if (!data.session_id || ENGINE.sessionId.startsWith('agpa_')) {
    for (let i = ENGINE.events.length - 1; i >= 0; i--) {
      const sid = ENGINE.events[i]?.context?.session_id;
      if (sid && !sid.startsWith('agpa_')) {
        ENGINE.sessionId = sid;
        break;
      }
    }
  }
  for (const { event_type, payload } of events) {
    const event = ENGINE.track(event_type, payload);
    process.stderr.write(`[AGPA:Hermes] ${raw.hook_event_name} → ${event_type} (${event.event_id})\n`);
  }
}

function cmdOpenClawAuto(): void {
  const raw = parseStdin() as Record<string, unknown> | null;
  if (!raw?.hook_event_name) {
    process.exit(0);
  }

  const hookName = process.argv[3] || (raw.hook_event_name as string);

  const data = normalizeOpenClawStdin(raw as OpenClawStdin);
  if (data.hook_event_name === 'agent.end') {
    // agent_end is a standalone event — not routed through mapEvents()
    if (data.session_id) ENGINE.sessionId = data.session_id;
    ENGINE.init();
    const event = ENGINE.track('agent.end', {
      session_id: data.session_id,
      duration_ms: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
      success: raw.success,
    });
    process.stderr.write(`[AGPA:OpenClaw] ${hookName} → agent.end (${event.event_id})\n`);
    return;
  }

  const events = mapEvents(data.hook_event_name!, data);
  if (events.length === 0) {
    process.exit(0);
  }

  if (data.session_id) ENGINE.sessionId = data.session_id;
  if (data.task_id) ENGINE.taskId = data.task_id;
  ENGINE.init();
  for (const { event_type, payload } of events) {
    const event = ENGINE.track(event_type, payload);
    process.stderr.write(`[AGPA:OpenClaw] ${hookName} → ${event_type} (${event.event_id})\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────

// Only execute CLI when run directly (not via import in tests)
const isMain = process.argv[1]?.endsWith('hook.ts') || process.argv[1]?.endsWith('hook');
if (isMain) {
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
  case 'hermes-auto':
    cmdHermesAuto();
    break;
  case 'openclaw-auto':
    cmdOpenClawAuto();
    break;
  default:
    process.stderr.write('Usage: hook.ts <track|poll|auto|hermes-auto|openclaw-auto> [args...]\n');
    process.exit(1);
}
} // isMain
