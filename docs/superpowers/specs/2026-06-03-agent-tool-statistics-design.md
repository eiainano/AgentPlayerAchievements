# Agent Tool Statistics System — Design Spec

**Date:** 2026-06-03
**Status:** approved → implementing
**Context:** User wants per-Agent-tool usage statistics (session count, user message count, usage time) exposed in Dashboard and usable as achievement conditions.

---

## 1. Background

### 1.1 Problem

AGPA currently has no aggregate statistics about how users interact with different Agent tools (Claude Code, Hermes, OpenClaw). The event.log has all raw data but no summary layer. Users can't answer basic questions like "how many sessions have I had with CC?" or "how long have I been using OpenClaw?"

### 1.2 The three metrics

| Metric | Definition |
|--------|-----------|
| Session count per tool | Number of `session.start` events, grouped by `tool_source` |
| User message count per tool | Number of `user.message` events, grouped by `tool_source` |
| Usage time per tool (ms) | Sum of per-session duration: `last user.message timestamp − first user.message timestamp` within each session window, grouped by `tool_source` |

### 1.3 Architecture constraint: session_id mismatch

The MCP Server and Hook CLI are two separate processes with different `session_id` values:

```
MCP Server (long-lived):  session_id = "agpa_<one-construction-timestamp>" (static across sessions)
Hook CLI (short-lived):   session_id varies by mode —
  track mode → "agpa_<new-random>" per invocation
  auto mode  → CC's real session UUID
```

These values never match across processes. Instead of matching by `session_id`, we use **timestamp windows**: each (session.start, session.end) pair from Hook defines a time range. `user.message` events falling within that range belong to that session.

### 1.4 User message source: unified MCP track (Channel B)

All tools (CC, Hermes, OpenClaw) use the same mechanism: the Agent calls `achievement_track("user.message")` via MCP at the start of each user turn. The `tool_source` field distinguishes which tool the message came from.

---

## 2. Architecture

```
event.log (facts)
    │
    ├─ session.start  (Hook, auto)       ← timestamp boundary
    ├─ user.message   (MCP, Agent calls) ← counting + inner timing
    ├─ session.end    (Hook, auto)       ← timestamp boundary
    ├─ tool.complete, file.*, ...        ← auto-tracked, ignored for stats
    └─ ...

stats.ts computeStats(events)
    │
    ├─ 1. Group session.start/end pairs by tool_source
    ├─ 2. For each pair, find user.message events in [start, end]
    ├─ 3. Count sessions, messages, usage_time per tool_source
    └─ 4. Return AgentToolStats
           │
           ├─→ store.saveStats() → stats.json (cache)
           └─→ Dashboard API reads stats.json
```

### 2.1 Data flow

```
poll() called (any trigger)
    └─→ events = store.load().events
    └─→ unlockedIds = evaluateAll(...)
    └─→ update state, emit achievement.unlocked
    └─→ NEW: stats = computeStats(events)
    └─→ NEW: store.saveStats(stats)
```

`stats.json` is always a cache, never the source of truth. It can be deleted and will regenerate on next poll.

---

## 3. File Changes

### 3.1 NEW: `src/engine/stats.ts`

Purpose: compute reusable statistics from event.log events.

```typescript
export interface AgentToolStats {
  version: '1.0';
  last_updated: string; // ISO timestamp
  sessions: Record<string, number>;       // tool_source → count
  user_messages: Record<string, number>;  // tool_source → count
  usage_time_ms: Record<string, number>;  // tool_source → total ms
}

export function computeStats(events: TrackedEvent[]): AgentToolStats {
  // 1. Collect all tool_sources seen across session.start and user.message
  // 2. Group session.start and session.end pairs by tool_source
  // 3. For each session: find user.message events with timestamp ∈ [start.timestamp, end.timestamp]
  //    usage_time = last_msg.ts - first_msg.ts (when ≥2 messages)
  // 4. Aggregate counts and totals per tool_source
}
```

Algorithm: `computeAgentToolStats()` walks events chronologically. For each `session.start` event, it opens a window. The next matching `session.end` (same tool_source) closes it. All `user.message` events (any tool_source) within the window are counted and timed.

Edge cases handled:
- Missing `session.end` → session excluded from usage_time (incomplete), but counts toward sessions
- Missing `session.start` for a `user.message` → message counted but usage_time = 0
- Sessions with 0 user messages → counted in session count, ignored for usage_time

### 3.2 MODIFY: `src/engine/store.ts`

Add two methods:

```typescript
saveStats(stats: AgentToolStats): void  // atomic write to stats.json
loadStats(): AgentToolStats | null      // read stats.json, return null if missing/corrupt
```

### 3.3 MODIFY: `src/engine/engine.ts`

In `poll()`, after handling new unlocks (line 174 before return):

```typescript
// Compute + cache usage statistics after poll
import { computeStats } from './stats.js';
const stats = computeStats(this.events);
this.store.saveStats(stats);
```

Also expose a `stats()` enhancement or separate method that includes the AgentToolStats.

### 3.4 MODIFY: `src/engine/types.ts`

Add `'user.message'` to the `EventType` union (line 6-7 area):

```typescript
| 'user.message'
```

### 3.5 MODIFY: `src/dashboard/api.ts`

Add to `DashboardStats`:

```typescript
tool_stats: AgentToolStats;  // or inline: sessions, user_messages, usage_time_ms
```

Update `buildApiResponse()` to load `stats.json` and include it.

### 3.6 MODIFY: `src/cli/init.ts`

In `INSTRUCTION_BLOCK`, add near "Events to track manually":

```
### Per-turn
- `"user.message"` at the beginning of each user turn (before processing)
```

### 3.7 MODIFY: `AGENTS.md` and `CLAUDE.md` (project root)

Add `user.message` to the session start section or as a new entry.

### 3.8 MODIFY: `src/dashboard/server.ts`

In `/api/data`, after building response, inject tool_stats from stats.json cache.

### 3.9 MODIFY: `src/utils/validate.ts`

Add `agentToolStatsSchema` for validating `stats.json` on read.

### 3.10 NEW: `tests/engine/stats.test.ts`

Test cases:
- Empty events → all zero counts
- One complete session → correct counts
- Two sessions different tool_source → per-tool breakout
- Missing session.end → handled gracefully
- 0 user messages in a session → session counted, 0 usage_time
- Cross-tool message scenario

---

## 4. stats.json Format

```json
{
  "version": "1.0",
  "last_updated": "2026-06-03T12:00:00.000Z",
  "sessions": {
    "claude-code": 127,
    "openclaw": 5,
    "hermes": 2,
    "unknown": 3
  },
  "user_messages": {
    "claude-code": 1543,
    "openclaw": 28,
    "hermes": 15
  },
  "usage_time_ms": {
    "claude-code": 86400000,
    "openclaw": 3600000,
    "hermes": 7200000
  }
}
```

Stored at `~/.agent-achievements/stats.json` (or `~/.agent-achievements/profiles/<name>/stats.json`).

---

## 5. Achievement Compatibility

Existing condition types (`counter`, `threshold`) work with `user.message` events out of the box:

```yaml
- id: chatty_coder
  conditions:
    - type: threshold
      event_type: user.message
      filter: tool_source:claude-code
      value: 1000
```

No evaluator changes needed.

---

## 6. Verification Plan

1. **Unit tests**: `tests/engine/stats.test.ts` with the scenarios listed in §3.10
2. **Integration**: Run `npm run build`, start Dashboard, verify `/api/data` includes `tool_stats`
3. **Manual**: Clear stats.json, call `achievement_poll` via MCP, verify stats.json regenerates
4. **Edge case**: Event log with session.start but no session.end → stats should handle gracefully
5. **Cross-profile**: Switch profiles, verify stats.json per profile
6. **Full test suite**: `npm run test` — all 110 existing tests must pass

---

## 7. Files Summary

| Action | File |
|--------|------|
| **CREATE** | `src/engine/stats.ts` |
| **CREATE** | `tests/engine/stats.test.ts` |
| MODIFY | `src/engine/types.ts` (+`'user.message'` in EventType) |
| MODIFY | `src/engine/engine.ts` (computeStats after poll) |
| MODIFY | `src/engine/store.ts` (saveStats/loadStats) |
| MODIFY | `src/dashboard/api.ts` (tool_stats in response) |
| MODIFY | `src/dashboard/server.ts` (inject stats into /api/data) |
| MODIFY | `src/utils/validate.ts` (stats schema) |
| MODIFY | `src/cli/init.ts` (INSTRUCTION_BLOCK + `'user.message'`) |
| MODIFY | `AGENTS.md` (+`'user.message'`) |
| MODIFY | `CLAUDE.md` (+`'user.message'`) |

---

## 8. Out of Scope

- Dashboard UI for tool usage stats (backend only this phase)
- Removing existing session.start/end from Hook CLI (preserving backward compat)
- KiloCode / OpenCode user message tracking (no MCP support in hooks)
- Time-based decay or session idle-time calculation
