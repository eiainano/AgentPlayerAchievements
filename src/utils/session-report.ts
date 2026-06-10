/**
 * Session Mini Report — lightweight summary of the just-ended session.
 *
 * Shows: tasks completed, files edited, tool calls (with top tools),
 *        tokens consumed (approx), streak days, duration.
 *
 * Display interval: Fibonacci sequence [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ...]
 * — so the user sees reports on session 1, 2, 3, 5, 8, 13, 21... never spammy.
 */
import type { TrackedEvent } from '../engine/types.js';

const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]);

export function shouldReport(sessionCount: number): boolean {
  return FIBONACCI.has(sessionCount);
}

export interface SessionReport {
  tasks: number;
  toolCalls: number;
  toolBreakdown: Record<string, number>;
  filesEdited: number;
  filesCreated: number;
  agentsSpawned: number;
  commandsRun: number;
  gitCommits: number;
  durationMs: number;
  tokenEstimate: number;
}

/** Find the most recent active session ID from the event log. */
export function findLastSessionId(events: TrackedEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const sid = events[i]?.context?.session_id;
    if (sid && typeof sid === 'string' && !sid.startsWith('agpa_')) {
      return sid;
    }
  }
  return null;
}

/** Compute session report from events for the given session ID. */
export function computeSessionReport(events: TrackedEvent[], sessionId: string): SessionReport {
  if (!sessionId) { return emptyReport(); }
  const sessionEvents = events.filter(e => e.context?.session_id === sessionId);

  let tasks = 0;
  let toolCalls = 0;
  const toolBreakdown: Record<string, number> = {};
  let filesEdited = 0;
  let filesCreated = 0;
  let agentsSpawned = 0;
  let commandsRun = 0;
  let gitCommits = 0;
  let firstTs = Infinity;
  let lastTs = 0;
  let tokenEstimate = 0;

  for (const e of sessionEvents) {
    const ts = new Date(e.timestamp).getTime();
    if (ts < firstTs) firstTs = ts;
    if (ts > lastTs) lastTs = ts;

    switch (e.event_type) {
      case 'tool.complete': {
        toolCalls++;
        const tn = e.payload?.tool_name;
        if (tn && typeof tn === 'string') {
          toolBreakdown[tn] = (toolBreakdown[tn] || 0) + 1;
        }
        break;
      }
      case 'file.edit':
        filesEdited++;
        break;
      case 'file.create':
        filesCreated++;
        break;
      case 'task.complete':
        tasks++;
        break;
      case 'agent.spawn':
        agentsSpawned++;
        break;
      case 'command.run':
        commandsRun++;
        break;
      case 'git.commit':
        gitCommits++;
        break;
      case 'token.consumed': {
        const amt = e.payload?.amount;
        if (typeof amt === 'number') tokenEstimate += amt;
        break;
      }
    }
  }

  const durationMs = lastTs > firstTs ? lastTs - firstTs : 0;

  return {
    tasks,
    toolCalls,
    toolBreakdown,
    filesEdited,
    filesCreated,
    agentsSpawned,
    commandsRun,
    gitCommits,
    durationMs,
    tokenEstimate,
  };
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function emptyReport(): SessionReport {
  return { tasks: 0, toolCalls: 0, toolBreakdown: {}, filesEdited: 0, filesCreated: 0, agentsSpawned: 0, commandsRun: 0, gitCommits: 0, durationMs: 0, tokenEstimate: 0 };
}

/** Render a formatted session report. */
export function renderSessionReport(report: SessionReport): string {
  const rows: string[] = [];
  rows.push(`  \x1b[1m\x1b[33m📋 Session Summary\x1b[0m`);

  if (report.tasks > 0) {
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m${report.tasks} task${report.tasks !== 1 ? 's' : ''} completed\x1b[0m`);
  }

  const fileCount = report.filesEdited + report.filesCreated;
  if (fileCount > 0) {
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m${fileCount} file${fileCount !== 1 ? 's' : ''} modified (${report.filesEdited} edit${report.filesEdited !== 1 ? 's' : ''}, ${report.filesCreated} new)\x1b[0m`);
  }

  if (report.toolCalls > 0) {
    const sorted = Object.entries(report.toolBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const toolStr = sorted.length > 0
      ? ` (${sorted.map(([n, c]) => `${n}:${c}`).join(', ')})`
      : '';
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m${report.toolCalls} tool call${report.toolCalls !== 1 ? 's' : ''}${toolStr}\x1b[0m`);
  }

  if (report.commandsRun > 0) {
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m${report.commandsRun} command${report.commandsRun !== 1 ? 's' : ''} run\x1b[0m`);
  }

  if (report.gitCommits > 0) {
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m${report.gitCommits} commit${report.gitCommits !== 1 ? 's' : ''}\x1b[0m`);
  }

  if (report.agentsSpawned > 0) {
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m${report.agentsSpawned} sub-agent${report.agentsSpawned !== 1 ? 's' : ''} spawned\x1b[0m`);
  }

  if (report.tokenEstimate > 0) {
    const t = report.tokenEstimate >= 1_000_000
      ? `${(report.tokenEstimate / 1_000_000).toFixed(1)}M`
      : `${Math.round(report.tokenEstimate / 1000)}k`;
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37m~${t} tokens consumed\x1b[0m`);
  }

  if (report.durationMs > 0) {
    rows.push(`  \x1b[32m✓\x1b[0m \x1b[37mSession: ${formatDuration(report.durationMs)}\x1b[0m`);
  }

  return rows.join('\n');
}
