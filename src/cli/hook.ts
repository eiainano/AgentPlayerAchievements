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
 *   kilocode-auto                       — read Kilo Code / OpenCode plugin stdin JSON, translate → CC format → AGPA event
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
 *   SubagentStop       → agent.end        { agent_type }
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
import { createHash } from 'crypto';
import { homedir } from 'os';
import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { sendNotification } from '../utils/notify.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import { renderPopup, type PopupAchievement } from '../utils/ansi-popup.js';
import { findNearUnlocks } from '../utils/progress-nudge.js';
import { detectLanguage } from '../utils/lang-detect.js';
import { evaluateCondition } from '../engine/evaluator.js';

const activeProfile = process.env.AGPA_PROFILE || loadConfig().active_profile || DEFAULT_PROFILE;
const stateDir = resolveProfileDir(activeProfile);
const ENGINE = new AchievementEngine({ stateDir });

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
  prompt_text?: string;
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
  const now = new Date();
  base.hour = now.getHours();
  base.day_of_week = now.getDay();

  // Extract context from tool_input
  const ti = data.tool_input || {};
  if (typeof ti.file_path === 'string') base.file_path = ti.file_path;
  if (typeof ti.command === 'string') base.command = ti.command;
  if (typeof ti.description === 'string') base.description = ti.description;
  // prompt_text is intentionally NOT added to base — the UserPromptSubmit case
  // reads it directly and only stores metadata (hash, counts), never the full text.

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
      if (data.tool_name === 'Read') {
        results.push({ event_type: 'file.read', payload: { ...base } });
        // If reading an image file, also emit image.read + image.upload
        const readPath = ti.file_path as string;
        if (readPath && /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(readPath)) {
          results.push({ event_type: 'image.read', payload: { ...base } });
          results.push({ event_type: 'image.upload', payload: { ...base } });
        }
        // Emit file.language_used for known code file types
        const readLang = detectLanguage(ti.file_path as string || '');
        if (readLang) {
          results.push({ event_type: 'file.language_used', payload: { ...base, language: readLang } });
        }
      }
      if (data.tool_name === 'Write') {
        // Determine whether this is truly a new file (create) vs overwrite.
        // Post‑hook runs after the write completes, so we compare birthtime
        // vs mtime: a freshly created file has birthtime ≈ mtime; an
        // overwritten existing file retains its original birthtime.
        let isCreate = false;
        if (typeof ti.file_path === 'string') {
          try {
            const fp = ti.file_path as string;
            const resolved = fp.startsWith('/') ? fp : path.resolve(data.cwd || process.cwd(), fp);
            const stat = fs.statSync(resolved);
            // On platforms without birthtime (very old Linux), birthtimeMs is 0
            // (epoch). In that case we can't distinguish → skip create event.
            isCreate = stat.birthtimeMs > 0 &&
              Math.abs(stat.birthtimeMs - stat.mtimeMs) < 500;
          } catch { /* stat failed — file may not exist, skip create */ }
        }
        if (isCreate) {
          results.push({ event_type: 'file.create', payload: { ...base } });
        }
        results.push({ event_type: 'file.write', payload: { ...base } });
        const writeLang = detectLanguage(ti.file_path as string || '');
        if (writeLang) {
          results.push({ event_type: 'file.language_used', payload: { ...base, language: writeLang } });
        }
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
        const editLang = detectLanguage(ti.file_path as string || '');
        if (editLang) {
          results.push({ event_type: 'file.language_used', payload: { ...base, language: editLang } });
        }
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
          results.push({ event_type: 'git.push', payload: { ...base } });
        }
        // Detect file deletion via rm / unlink
        if (/\brm\b/.test(ti.command) || /\bunlink\b/.test(ti.command)) {
          results.push({ event_type: 'file.delete', payload: { ...base } });
        }
      }
      // MCP tool call
      if (data.tool_name?.startsWith('mcp__')) {
        results.push({ event_type: 'mcp.tool_call', payload: { ...base } });
      }
      // Task management tools (CC deferred tools TaskCreate / TaskUpdate)
      if (data.tool_name === 'TaskCreate') {
        const taskPayload: Record<string, unknown> = { ...base };
        if (typeof ti.title === 'string') taskPayload.title = ti.title;
        if (typeof ti.description === 'string') taskPayload.description = ti.description;
        results.push({ event_type: 'task.create', payload: taskPayload });
      }
      if (data.tool_name === 'TaskUpdate') {
        const updatePayload: Record<string, unknown> = { ...base };
        if (typeof ti.status === 'string') updatePayload.new_status = ti.status;
        results.push({ event_type: 'task.update', payload: updatePayload });
      }
      break;
    case 'PostToolUseFailure':
      results.push({ event_type: 'tool.failure', payload: { ...base } });
      results.push({ event_type: 'error.occurred', payload: { ...base } });
      break;
    case 'UserPromptSubmit': {
      const promptText = (ti.prompt_text as string) || (data.prompt_text as string) || '';
      if (promptText) {
        const pp = computePromptPayload(promptText);
        results.push({
          event_type: 'user.prompt',
          payload: { ...base, ...pp },
        });
        results.push({
          event_type: 'user.message',
          payload: {
            char_count: pp.char_count,
            word_count: pp.word_count,
            source: 'hook_auto',
          },
        });
      }
      break;
    }
    case 'PreToolUse':
      results.push({ event_type: 'tool.requested', payload: { tool_name: data.tool_name } });
      break;
    case 'SubagentStart':
      results.push({ event_type: 'agent.spawn', payload: { ...base } });
      break;
    case 'SubagentStop':
      results.push({ event_type: 'agent.end', payload: { ...base } });
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

// ── P1-2: Prompt payload computation ──────────────────────────

interface PromptPayload {
  char_count: number;
  word_count: number;
  prefix_hash: string;
  has_code_block: boolean;
  has_question_mark: boolean;
}

export function computePromptPayload(promptText: string): PromptPayload {
  const prefix = promptText.slice(0, 20);
  const hash = createHash('sha256').update(prefix).digest('hex').slice(0, 8);

  return {
    char_count: promptText.length,
    word_count: promptText.split(/\s+/).filter(Boolean).length,
    prefix_hash: hash,
    has_code_block: promptText.includes('```'),
    has_question_mark: promptText.includes('?'),
  };
}

// ── P0-1: JSONL transcript parsing ────────────────────────────

interface TranscriptStats {
  user_message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  session_started_at: string;
  session_ended_at: string;
  session_duration_ms: number;
}

export function parseTranscriptJsonl(filePath: string): TranscriptStats | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    let userMsgCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let firstTimestamp = '';
    let lastTimestamp = '';

    // Format validation counters
    let validJsonCount = 0;
    let parseErrorCount = 0;
    let hasTypeField = false;
    let hasUsageField = false;
    let hasTimestamp = false;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        validJsonCount++;

        if (!firstTimestamp) firstTimestamp = entry.timestamp;
        lastTimestamp = entry.timestamp;

        if (entry.type === 'user') userMsgCount++;

        if (entry.usage) {
          hasUsageField = true;
          inputTokens += entry.usage.input_tokens || 0;
          outputTokens += entry.usage.output_tokens || 0;
          cacheReadTokens += entry.usage.cache_read_input_tokens || 0;
          cacheCreationTokens += entry.usage.cache_creation_input_tokens || 0;
        }

        // Track field presence on first valid entry
        if (validJsonCount === 1) {
          hasTypeField = !!entry.type;
          hasTimestamp = !!entry.timestamp;
        }
      } catch {
        parseErrorCount++;
      }
    }

    // ═══ Format structure check ═══
    // If nothing parsed, warn: file may not be JSONL at all
    if (validJsonCount === 0) {
      process.stderr.write(`[AGPA] ⚠ JSONL format warning: "${path.basename(filePath)}" — 0/${lines.length} lines parsed as JSON. CC log format may have changed.\n`);
      return null;
    }

    // If expected fields are missing, warn: structure likely changed
    const formatHints: string[] = [];
    if (!hasTypeField) formatHints.push('missing "type" field');
    if (!hasTimestamp) formatHints.push('missing "timestamp"');
    if (!hasUsageField && validJsonCount > 3) {
      formatHints.push('no "usage" object found in any entry');
    }
    if (parseErrorCount > lines.length * 0.2) {
      formatHints.push(`${parseErrorCount}/${lines.length} lines unparseable`);
    }
    if (formatHints.length > 0) {
      process.stderr.write(`[AGPA] ⚠ JSONL format warning: "${path.basename(filePath)}" — ${formatHints.join(', ')}. CC log format may have changed.\n`);
    }

    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
    if (totalTokens === 0 && userMsgCount === 0) return null;

    const durationMs = firstTimestamp && lastTimestamp
      ? new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()
      : 0;

    return {
      user_message_count: userMsgCount,
      total_input_tokens: inputTokens,
      total_output_tokens: outputTokens,
      total_cache_read_tokens: cacheReadTokens,
      total_cache_creation_tokens: cacheCreationTokens,
      session_started_at: firstTimestamp,
      session_ended_at: lastTimestamp,
      session_duration_ms: durationMs,
    };
  } catch {
    return null;
  }
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

  // P0-1: Parse JSONL transcript for precise session stats (CC only)
  if (eventType === 'session.end') {
    const transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH
                        || (payload.transcript_path as string)
                        || process.argv.slice(4).find(a => a.endsWith('.jsonl'));

    if (transcriptPath) {
      const stats = parseTranscriptJsonl(transcriptPath);
      if (stats) {
        const totalTokens = stats.total_input_tokens + stats.total_output_tokens
                          + stats.total_cache_read_tokens + stats.total_cache_creation_tokens;
        ENGINE.track('token.consumed', {
          amount: totalTokens,
          input_tokens: stats.total_input_tokens,
          output_tokens: stats.total_output_tokens,
          cache_read_tokens: stats.total_cache_read_tokens,
          cache_creation_tokens: stats.total_cache_creation_tokens,
          source: 'jsonl_parsed',
        });

        if (stats.user_message_count > 0) {
          ENGINE.track('user.message.batch', {
            count: stats.user_message_count,
            source: 'jsonl_parsed',
          });
        }

        ENGINE.track('session.stats', {
          user_message_count: stats.user_message_count,
          total_input_tokens: stats.total_input_tokens,
          total_output_tokens: stats.total_output_tokens,
          total_cache_read_tokens: stats.total_cache_read_tokens,
          total_cache_creation_tokens: stats.total_cache_creation_tokens,
          session_started_at: stats.session_started_at,
          session_ended_at: stats.session_ended_at,
          session_duration_ms: stats.session_duration_ms,
          source: 'jsonl_parsed',
        });
      }
    }
  }
}

function cmdPoll(): void {
  ENGINE.init();

  const newlyUnlocked = ENGINE.poll();

  if (newlyUnlocked.length === 0) {
    process.stderr.write('[AGPA] poll: no new achievements\n');
    return;
  }

  // Compute highest rarity for sound dedup
  const RARITY_RANK: Record<string, number> = {
    common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
  };
  let topRarity = 'common';
  let topRank = -1;
  for (const ach of newlyUnlocked) {
    const rank = RARITY_RANK[ach.rarity] ?? 0;
    if (rank > topRank) { topRank = rank; topRarity = ach.rarity; }
  }

  const cfg = loadConfig();
  const useZh = cfg.lang === 'zh';
  for (const ach of newlyUnlocked) {
    const icon = ach.icon || '🏆';
    const title = useZh ? (ach.name_cn || ach.name) : ach.name;
    const desc = useZh ? (ach.description_cn || ach.description) : ach.description;
    sendNotification(`${icon} ${title}`, desc, ENGINE.stateDir, activeProfile, topRarity);
  }

  // ── ANSI popup (TTY only) ─────────────────────────────────────
  const popupData: PopupAchievement[] = newlyUnlocked.map(ach => {
    // Compute real progress from the first condition — AchievementDefinition
    // has no 'current'/'target' fields; those come from evaluateCondition().
    let progress: { current: number; max: number } | undefined;
    if (ach.progress_trackable && ach.conditions.length > 0) {
      const result = evaluateCondition(ach.conditions[0]!, ENGINE.events);
      progress = { current: Math.min(result.progress, result.target), max: result.target };
    }
    return {
      icon: ach.icon || '🏆',
      name: useZh ? (ach.name_cn || ach.name) : ach.name,
      description: useZh ? (ach.description_cn || ach.description) : ach.description,
      rarity: ach.rarity,
      category: ach.category,
      set_name: undefined,
      set_progress: undefined,
      progress,
      pixel_art_48: ach.pixel_art?.['48'],
    };
  });
  const popup = renderPopup(popupData);
  if (popup) process.stdout.write(popup + '\n');

  // ── Progress nudge (TTY only) ─────────────────────────────────
  if (process.stdout.isTTY) {
    const near = findNearUnlocks(ENGINE.definitions, ENGINE.events, ENGINE.state);
    if (near.length > 0) {
      const lines: string[] = ['  \x1b[33m⚡ Getting close:\x1b[0m'];
      for (const n of near) {
        const pct = Math.round((n.current / n.target) * 100);
        lines.push(`   ◦ \x1b[37m${n.icon}  ${n.name} — ${n.current}/${n.target} ${n.unit_label} (${pct}%)\x1b[0m`);
      }
      process.stdout.write('\n' + lines.join('\n') + '\n');
    }
  }

  process.stderr.write(`[AGPA] poll: ${newlyUnlocked.length} new achievement(s) unlocked!\n`);
}

// ── Hermes → CC stdin translation ─────────────────────────────

/**
 * Hermes hook event names → CC hook event names
 */
export const HERMES_EVENT_MAP: Record<string, string> = {
  'post_tool_call':   'PostToolUse',
  'pre_tool_call':    'PreToolUse',
  'on_session_start': 'SessionStart',
  'on_session_end':   'SessionEnd',
};

/**
 * Hermes tool names → CC tool names
 */
export const HERMES_TOOL_MAP: Record<string, string> = {
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
export function normalizeHermesStdin(raw: Record<string, unknown>): HookStdin {
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

// ── Kilo Code / OpenCode → CC stdin translation ──────────────────

/**
 * Kilo Code / OpenCode event names → CC hook event names.
 * Both products share the same plugin API (only npm package name differs).
 */
export const KILOCODE_EVENT_MAP: Record<string, string> = {
  'tool.execute.after':  'PostToolUse',
  'tool.execute.before': 'PreToolUse',
  'session.created':     'SessionStart',
  'session.idle':        'SessionEnd',
};

/**
 * Kilo Code / OpenCode tool names → CC tool names.
 */
export const KILOCODE_TOOL_MAP: Record<string, string> = {
  'read':   'Read',
  'write':  'Write',
  'edit':   'Edit',
  'bash':   'Bash',
  'glob':   'Glob',
  'grep':   'Grep',
  'task':   'Task',
  'ask':    'Ask',
};

interface KilocodeStdin {
  hook_event_name: string;
  toolName?: string;
  params?: Record<string, unknown>;
  sessionId?: string;
  durationMs?: number;
  error?: string;
  success?: boolean;
  output?: string;
  [key: string]: unknown;
}

/**
 * Normalize Kilo Code / OpenCode stdin to CC-compatible HookStdin.
 *
 * Key field mappings:
 *   tool.execute.*  → PostToolUse / PreToolUse
 *   session.*       → SessionStart / SessionEnd
 *   toolName        → tool_name
 *   params.filePath → tool_input.file_path (camelCase → snake_case)
 *   sessionId       → session_id
 *   durationMs      → duration_ms
 *   error           → tool_input.error
 */
export function normalizeKilocodeStdin(raw: KilocodeStdin): HookStdin {
  const event = KILOCODE_EVENT_MAP[raw.hook_event_name] || raw.hook_event_name;

  let toolName = (raw.toolName || '') as string;
  // Map known tool aliases, leave MCP tools (mcp__*) unchanged
  toolName = KILOCODE_TOOL_MAP[toolName] || toolName;

  const params = raw.params || {};
  const ti: Record<string, unknown> = {};
  // CamelCase params → snake_case (Kilo/OpenCode tools use camelCase internally)
  if (typeof params.filePath === 'string') ti.file_path = params.filePath;
  if (typeof params.command === 'string') ti.command = params.command;
  if (typeof params.content === 'string') ti.content = params.content;
  if (typeof params.old_string === 'string') ti.old_string = params.old_string;
  if (typeof params.oldString === 'string') ti.old_string = params.oldString;
  if (typeof params.new_string === 'string') ti.new_string = params.new_string;
  if (typeof params.newString === 'string') ti.new_string = params.newString;
  if (typeof params.description === 'string') ti.description = params.description;
  // Pass through snake_case params directly (belt-and-suspenders)
  if (typeof params.file_path === 'string' && !ti.file_path) ti.file_path = params.file_path;
  // Capture error for tool.failure detection
  if (typeof raw.error === 'string' && raw.error) ti.error = raw.error;

  return {
    hook_event_name: event,
    tool_name: toolName,
    tool_input: Object.keys(ti).length > 0 ? ti : undefined,
    session_id: (raw.sessionId as string) || '',
    duration_ms: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    source: 'kilocode',
  };
}

function cmdKilocodeAuto(): void {
  const raw = parseStdin() as Record<string, unknown> | null;
  if (!raw?.hook_event_name) {
    process.exit(0);
  }

  const hookName = process.argv[3] || (raw.hook_event_name as string);
  const data = normalizeKilocodeStdin(raw as KilocodeStdin);

  const events = mapEvents(data.hook_event_name!, data);
  if (events.length === 0) {
    process.exit(0);
  }

  if (data.session_id) ENGINE.sessionId = data.session_id;
  if (data.task_id) ENGINE.taskId = data.task_id;
  ENGINE.init();
  for (const { event_type, payload } of events) {
    const event = ENGINE.track(event_type, payload);
    process.stderr.write(`[AGPA:KiloCode] ${hookName} → ${event_type} (${event.event_id})\n`);
  }
}

// ── Commands ──────────────────────────────────────────────────

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
  case 'kilocode-auto':
    cmdKilocodeAuto();
    break;
  default:
    process.stderr.write('Usage: hook.ts <track|poll|auto|hermes-auto|openclaw-auto|kilocode-auto> [args...]\n');
    process.exit(1);
}
} // isMain
