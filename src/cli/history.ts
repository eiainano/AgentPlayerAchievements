#!/usr/bin/env node
/**
 * AGPA History — browse raw event log entries
 *
 * Usage:
 *   agpa history                       Recent 20 events
 *   agpa history --N 50                Last 50 events
 *   agpa history --event session       Filter by event type (substring match)
 *   agpa history --today               Only today's events
 *   agpa history --json                Machine-readable JSON output
 *   agpa history --profile <name>      Use a named profile
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeParse, trackedEventSchema } from '../utils/validate.js';
import { homedir } from 'node:os';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import type { TrackedEvent } from '../engine/types.js';

const AGPA_DIR = path.join(homedir(), '.agent-achievements');
const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const C = '\x1b[36m';
const Y = '\x1b[33m';

// ── Parse CLI args ──────────────────────────────────────────────────────

interface HistoryOpts {
  count: number;
  eventFilter: string | null;
  todayOnly: boolean;
  jsonOutput: boolean;
  profile: string | null;
}

function parseArgs(args: string[]): HistoryOpts {
  const opts: HistoryOpts = { count: 20, eventFilter: null, todayOnly: false, jsonOutput: false, profile: null };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case '--N':
      case '-n': {
        const v = args[++i];
        const n = parseInt(v ?? '', 10);
        if (isNaN(n) || n < 1 || n > 10_000) {
          console.error('--N requires a number between 1-10000');
          process.exit(1);
        }
        opts.count = n;
        break;
      }
      case '--event': {
        const v = args[++i];
        if (!v) { console.error('--event requires a value'); process.exit(1); }
        opts.eventFilter = v.toLowerCase();
        break;
      }
      case '--today':
        opts.todayOnly = true;
        break;
      case '--json':
        opts.jsonOutput = true;
        break;
      case '--profile': {
        const v = args[++i];
        if (!v) { console.error('--profile requires a name'); process.exit(1); }
        opts.profile = v;
        break;
      }
      default:
        if (a === '--help' || a === '-h') {
          console.log(`
${B}AGPA History${R} — browse raw event log entries

Usage:
  agpa history                       Recent 20 events
  agpa history --N 50                Last 50 events
  agpa history --event session       Filter by event type (substring match)
  agpa history --today               Only today's events
  agpa history --json                Machine-readable JSON output
  agpa history --profile <name>      Use a named profile
`);
          process.exit(0);
        }
        if (a.startsWith('--')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
    }
  }

  return opts;
}

// ── Event log helpers ───────────────────────────────────────────────────

function getEventLogPath(profile: string | null): string {
  if (profile) return path.join(AGPA_DIR, 'profiles', profile, 'event.log');
  return path.join(AGPA_DIR, 'event.log');
}

function readEvents(logPath: string): TrackedEvent[] {
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf-8');
  return raw.trim().split('\n').filter(Boolean).map(line => {
    // Use safeParse for validated deserialization
    try { return safeParse(trackedEventSchema, JSON.parse(line), null); } catch { return null; }
  }).filter(Boolean) as TrackedEvent[];
}

// ── Rendering ──────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function formatPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload || Object.keys(payload).length === 0) return '';
  const entries = Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 3);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    return `${D}${k}=${val}${R}`;
  }).join(' ');
}

function getEventIcon(eventType: string): string {
  if (eventType.startsWith('session')) return '🟢';
  if (eventType.startsWith('tool')) return '🔧';
  if (eventType.startsWith('file')) return '📄';
  if (eventType.startsWith('task')) return '✅';
  if (eventType.startsWith('achievement')) return '🏆';
  if (eventType.startsWith('conversation')) return '💬';
  if (eventType.startsWith('agent')) return '🤖';
  if (eventType.startsWith('git')) return '📦';
  return '•';
}

function renderEvent(e: TrackedEvent, index: number, total: number): string {
  const num = `${total - index}`.padStart(Math.max(3, total.toString().length), ' ');
  const time = formatTime(e.timestamp);
  const icon = getEventIcon(e.event_type);
  const payload = formatPayload(e.payload);
  const date = formatDate(e.timestamp);

  return `  ${D}${num}${R}  ${date} ${time}  ${icon} ${C}${e.event_type}${R}  ${payload}`;
}

// ── JSON output ────────────────────────────────────────────────────────

function renderJSON(events: TrackedEvent[]): string {
  const summary = events.map(e => ({
    timestamp: e.timestamp,
    event_type: e.event_type,
    tool_source: e.tool_source,
    payload: e.payload,
  }));
  return JSON.stringify(summary, null, 2);
}

// ── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const rawArgs = process.argv.slice(2);
  // When invoked via agpa index.ts, argv[2] is 'history' followed by flags.
  const args = rawArgs[0] === 'history' ? rawArgs.slice(1) : rawArgs;
  const opts = parseArgs(args);

  const profile = opts.profile || loadConfig().active_profile || DEFAULT_PROFILE;
  const logPath = getEventLogPath(profile === 'default' ? null : profile);

  let events = readEvents(logPath);
  const totalEvents = events.length; // cache — avoid double-read below

  if (events.length === 0) {
    if (opts.jsonOutput) {
      console.log(JSON.stringify({ events: [], total: 0 }));
    } else {
      console.log(`\n  ${D}No events recorded yet.${R}`);
      console.log(`  ${D}Event log: ${logPath}${R}`);
      console.log(`  ${D}Start coding with AGPA-tracked tools to generate events!${R}\n`);
    }
    return;
  }

  // Apply filters
  if (opts.todayOnly) {
    const today = formatDate(new Date().toISOString());
    events = events.filter(e => formatDate(e.timestamp) === today);
  }

  if (opts.eventFilter) {
    events = events.filter(e => e.event_type.toLowerCase().includes(opts.eventFilter!));
  }

  // Take last N
  events = events.slice(-opts.count);

  if (opts.jsonOutput) {
    console.log(renderJSON(events));
    return;
  }

  // Text output
  const filterDesc = opts.eventFilter ? `matching "${opts.eventFilter}"` : '';
  const todayDesc = opts.todayOnly ? ' today' : '';

  console.log(`\n${B}📜 Event History${R}  ${D}${events.length} of ${totalEvents} events${filterDesc}${todayDesc}${R}`);
  if (profile !== 'default') {
    console.log(`  ${D}Profile: ${profile}${R}`);
  }
  console.log(`  ${D}${logPath}${R}\n`);

  if (events.length === 0) {
    console.log(`  ${Y}No events match your filters. Try broader criteria.${R}\n`);
    return;
  }

  for (let i = 0; i < events.length; i++) {
    console.log(renderEvent(events[i]!, i, events.length));
  }

  // Stats footer
  const types = new Map<string, number>();
  for (const e of events) {
    types.set(e.event_type, (types.get(e.event_type) || 0) + 1);
  }
  const topTypes = [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`\n  ${D}Top event types: ${topTypes.map(([t, c]) => `${C}${t}${R}${D}(${c})${R}${D}`).join(', ')}${R}\n`);
}

main();
