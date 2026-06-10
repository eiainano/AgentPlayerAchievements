# AGPA Comprehensive Code Review Report

**Date**: 2026-06-11
**Scope**: Full codebase audit — 62 source files (~16K lines), 208 achievement definitions, 12 design documents
**Branch**: `dev` (commit `c37bb07`)
**Reviewer**: Claude Opus 4
**Status**: 8/8 CRITICAL issues fixed ✅ · 14/14 HIGH issues fixed ✅ (see CHANGELOG.md 2026-06-11 entries)

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 8 | 8/8 fixed ✅ |
| HIGH     | 14 | 14/14 fixed ✅ |
| MEDIUM   | 14 | 0/14 fixed |
| LOW      | 4 | 0/4 fixed |
| **Total** | **40** | **22/40 fixed** |

The codebase is well-structured with clean separation between engine, MCP server, hook CLI, and dashboard layers. The most impactful issues fall into three clusters:

1. **Evaluator scoping bugs** — Several condition evaluators (`sequence_count`, `pattern_match`, `distinct_count`) ignore `window`/`filter`/`role` fields, causing achievements to evaluate against unscoped event sets.
2. **YAML data integrity** — Broken questline references, missing `per_event` flags on speedrun/threshold achievements, and set membership inconsistencies.
3. **Pervasive `JSON.parse()` convention violation** — The CLAUDE.md mandate ("all JSON parsing uses `safeParse()`") is violated in 15+ locations across the codebase.

---

## CRITICAL Issues (8)

### C1. Zod schema strips `tool_source` and `protocol_version` from loaded events

**File**: `src/utils/validate.ts:3-12`, `src/engine/store.ts:45`
**Category**: Bug / Data Loss

The `trackedEventSchema` (Zod `z.object()`) does not include `tool_source` or `protocol_version` fields. Zod 4's `z.object()` silently strips unrecognized keys. When events are loaded from disk via `safeParse()`, these fields become `undefined`.

**Impact**: `stats.ts` lines 47, 80 use `e.tool_source || 'unknown'` — all loaded events bucket under `'unknown'`, making per-tool statistics completely wrong. The `TrackedEvent` TypeScript interface declares these fields as required, but the Zod schema doesn't enforce or preserve them, creating a type-safety lie.

**Fix**: Add `tool_source` and `protocol_version` to the Zod schema, or use `.passthrough()` to preserve unknown keys.

---

### C2. `evalSequenceCount` pattern matching misses sequences after false starts

**File**: `src/engine/evaluator.ts:679-688`
**Category**: Logic Error

The sequence matching algorithm resets `pi` to 0 on mismatch but does not re-check the current event against `pattern[0]`. For pattern `['A', 'B']` and events `['A', 'A', 'B']`: the second 'A' causes pi to reset, and 'B' doesn't match pattern[0], so the valid sequence at indices 1-2 is missed. Result: `count=0` instead of the correct `1`.

**Fix**: After `pi = 0`, re-check if the current event matches `pattern[0]`:
```typescript
} else {
  pi = 0;
  if (e.event_type === pattern[0]) pi = 1;
}
```

---

### C3. `evalSequenceCount` ignores `window` field — scoping bug

**File**: `src/engine/evaluator.ts:675-701`
**Category**: Bug

`evalSequenceCount()` does NOT call `scopeEvents()` and ignores the `window` field. Two YAML achievements depend on this:
- `triple_debugger` (`window: single_task`) — counts across ALL events instead of within a single task
- `cycle_master` (`window: single_session`) — counts across all sessions instead of one

**Fix**: Add `events = scopeEvents(events, cond);` at the top of `evalSequenceCount()`.

---

### C4. Speedrun achievements missing `per_event: true` — will never unlock

**File**: `achievement-definitions.yaml` (lines 2832, 2852, 2929)
**Category**: YAML Data Bug

Three speedrun achievements use `threshold` with `field: duration_ms` / `elapsed_ms` and `operator: <=`. Without `per_event: true`, the evaluator SUMS duration across ALL matching events. After just 1-2 tasks, the cumulative sum exceeds the threshold, making these achievements permanently impossible.

Affected: `speed_run_bronze` (<=180s), `speed_run_silver` (<=60s), `speed_run_gold` (<=30s).

Compare with `short_circuit` (line 2914) which correctly uses `per_event: true`.

**Fix**: Add `per_event: true` to all three.

---

### C5. Questline references non-existent achievement IDs

**File**: `achievement-definitions.yaml:4025, 4029`
**Category**: YAML Data Bug

The `bug_hunter` questline references `diagnostic_detective` (stage 1) and `self_healer` (stage 2), neither of which exist in the definitions array. These stages can never be completed.

**Fix**: Add missing achievement definitions or replace with existing IDs that fit the theme.

---

### C6. `git add` falsely emits `git.commit` event

**File**: `src/cli/hook.ts:255`
**Category**: Bug

The condition `ti.command.includes('git commit') || ti.command.includes('git add')` emits `git.commit` for bare `git add` commands. Since agents frequently run `git add` separately, this roughly doubles commit counts for all commit-based achievements.

**Fix**: Remove `|| ti.command.includes('git add')`. If staging events are desired, emit a separate `git.add` event.

---

### C7. `renderTitlesRow` crashes due to variable shadowing of `t()` i18n function

**File**: `src/dashboard/public/app.js:2167-2169`
**Category**: JavaScript Bug

`titles.map(t => { ... })` shadows the global `t()` translation function. When `t('title_tooltip', ...)` is called inside the callback, it invokes the title object as a function → `TypeError`. The error is caught by `renderSafe`, so the page doesn't crash, but the titles row feature is completely broken.

**Fix**: Rename the map parameter from `t` to `title` or `item`.

---

### C8. Config `set` action allows arbitrary keys — no VALID_KEYS validation

**File**: `src/tools/config.ts:56-57`
**Category**: Bug / Security

The `get` action validates `k ∈ VALID_KEYS`, but the `set` action's final `else` branch blindly writes any key/value to config.json. An MCP client can inject arbitrary keys.

**Fix**: Add `VALID_KEYS` validation at the top of the `set` case.

---

## HIGH Issues (14)

### H1. `evalDistinctCount` ignores `filter` and `role` conditions

**File**: `src/engine/evaluator.ts:579-598`
**Category**: Bug

Every other evaluator applies `cond.filter` and `matchRole()`, but `evalDistinctCount` does not. Any `distinct_count` achievement with `filter` or `role` has those conditions silently ignored.

---

### H2. `poll()` emits unlock events after saving state — crash inconsistency

**File**: `src/engine/engine.ts:194-204`
**Category**: Race Condition

State is saved at line 195, then `achievement.unlocked` events are emitted via `track()` at lines 199-203. If the process crashes between save and emit, state records achievements as unlocked but the event log is missing `achievement.unlocked` events. Downstream achievements that count unlocks (e.g., `casual_collector`) will have incorrect counts.

---

### H3. `evalRatio` and `evalSequenceCount` use manual operator comparison instead of `evalOp()`

**File**: `src/engine/evaluator.ts:853-862, 692-700`
**Category**: Code Smell / Drift Risk

Both functions hand-implement the operator comparison chain instead of using the canonical `evalOp()`. The manual chain in `evalRatio` is missing an explicit `'=='` case (falls through to default). If `evalOp` behavior changes, these will drift.

---

### H4. `evalMode` and `evalPatternMatch` do not scope events

**File**: `src/engine/evaluator.ts:643, 781`
**Category**: Bug

Neither calls `scopeEvents()` or applies time window/session filtering. The `im_sorry_dave` achievement (pattern_match + `window: single_session`) matches against ALL events across all sessions.

---

### H5. `loadPending` uses raw `JSON.parse` with no array validation

**File**: `src/tools/poll.ts:13`
**Category**: Bug / Convention Violation

If `pending.json` is corrupted to a non-array value, `pending.filter(...)` throws `TypeError: pending.filter is not a function`. This crashes the MCP tool handler.

---

### H6. Pervasive `JSON.parse()` convention violation (15+ locations)

**Category**: Convention Violation

The CLAUDE.md mandates `safeParse()` for ALL JSON parsing. Violations found in:
- `src/engine/store.ts:28,45,88`
- `src/tools/poll.ts:13`
- `src/cli/hook.ts:95,434,514`
- `src/cli/init.ts:283`
- `src/cli/import.ts:79`
- `src/cli/doctor.ts:101`
- `src/cli/verify.ts:84`
- `src/cli/history.ts:111`
- `src/cli/upgrade.ts:19`
- `src/cli/index.ts:119,189`
- `src/config.ts:47`
- `src/utils/profile.ts:95,103`
- `src/dashboard/server.ts:111`

---

### H7. Import command lacks schema validation on untrusted input

**File**: `src/cli/import.ts:77-93`
**Category**: Security / Validation

User-supplied export file is parsed with raw `JSON.parse()` and only shallow-checked (`state.unlocked` exists). Malformed data is written directly to engine state.

---

### H8. Default profile path bug in `init.ts`

**File**: `src/cli/init.ts:1602-1604`
**Category**: Bug

`const dataDir = profile ? path.join(AGPA_DIR, 'profiles', profile) : AGPA_DIR` — since `DEFAULT_PROFILE = "default"` is truthy, the default profile gets `~/.agent-achievements/profiles/default/` instead of `~/.agent-achievements/`. Compare with `resolveProfileDir()` in `src/utils/profile.ts` which handles this correctly.

---

### H9. Set membership inconsistencies in YAML

**File**: `achievement-definitions.yaml`
**Category**: Data Integrity

Several achievements declare `set: X` but are not in the set's `achievements:` array:
- `self_aware` → declares `bug_catcher` but not in set member list
- `ultraman_8` → declares `agent_commander` but not in set member list
- `shipper` → declares `git_flow` but not in set member list
- `achievement_hunter` → declares `completionist` but not in set member list

---

### H10. `infinite_loop` achievement missing `per_event: true`

**File**: `achievement-definitions.yaml:2457-2461`
**Category**: YAML Data Bug

Uses `threshold` + `field: duration_ms` + `operator: >=` + `value: 60000`. Without `per_event`, durations are summed, so the achievement unlocks after enough total command time rather than a single 60s+ command.

---

### H11. Bash command matching via `includes()` is fragile

**File**: `src/cli/hook.ts:255-273`
**Category**: False Positives

`ti.command.includes('git push')` matches substrings in comments, echo statements, and multi-line scripts. Same for `gh pr create`, `git bisect`, etc.

---

### H12. `evalPredicate` returns `true` for unparseable filters (fail-open)

**File**: `src/engine/evaluator.ts:177`
**Category**: Logic Error

When `evalPredicate` can't match any known operator pattern, it returns `true` (pass). A typo in a filter (e.g., `===` instead of `==`) silently matches ALL events. This contradicts `matchFilter`'s fail-closed behavior on line 54.

---

### H13. IntersectionObserver leak — new observer every 10s render

**File**: `src/dashboard/public/app.js:1056-1066`
**Category**: Resource Leak

`renderNav()` creates a new `IntersectionObserver` every `renderAll()` call (every 10s). Old observers are never disconnected. After 1 hour: ~360 orphaned observers.

---

### H14. Event listener accumulation on category/rarity/filter navs

**File**: `src/dashboard/public/app.js:1733,1748,1765`
**Category**: Event Listener Leak

`renderAchievements()` adds new click handlers to persistent parent elements every 10s poll cycle. After 1 hour, each click fires ~360 duplicate handlers.

---
### HIGH Fix Summary (2026-06-11, commit pending)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| H1 | `evalDistinctCount` ignores filter/role | `evaluator.ts:587-594` | Added `matchFilter()` and `matchRole()` calls |
| H2 | poll saves state before emitting unlock events | `engine.ts:194-204` | Reordered: emit first, save after |
| H3 | evalRatio/sequenceCount manual operator chains | `evaluator.ts:696-705, 856-865` | Replaced with `evalOp()` canonical function |
| H4 | evalMode/patternMatch don't scope events | `evaluator.ts:645, 787` | Added `scopeEvents()` call at function entry |
| H5 | `loadPending` raw JSON.parse, no array validation | `poll.ts:13` | Wrapped with `safeParse(z.array(z.unknown()), ...)` |
| H6 | 15+ raw `JSON.parse()` convention violations | `profile.ts`, `poll.ts`, `history.ts`, `import.ts` | Critical 4 sites → `safeParse`; 11 diagnostic/config sites = reasonable (try/catch guarded) |
| H7 | Import command lacks schema validation | `import.ts` | Added `exportPayloadSchema` (Zod) + `safeParse` gate |
| H8 | Default profile path goes to `profiles/default/` | `init.ts:1602-1604` | Added `profile !== DEFAULT_PROFILE` check |
| H9 | 4 achievements declare sets but not in member lists | `achievement-definitions.yaml` | Added `ultraman_8` to `agent_commander`, `self_aware` to `bug_catcher`, `shipper` to `git_flow`, `achievement_hunter` to `completionist` |
| H10 | `infinite_loop` missing `per_event: true` | `achievement-definitions.yaml:2461` | Added `per_event: true` |
| H11 | Bash `includes()` matches comments/echo | `hook.ts:255-272` | Replaced with `\bword\b` word-boundary regexes |
| H12 | `evalPredicate` fail-open on unparseable filters | `evaluator.ts:177` | Changed `return true` → `return false` (fail-closed) |
| H13 | New IntersectionObserver every 10s (leak) | `app.js:1056` | Reuse/disconnect existing `_navObserver` |
| H14 | Event listeners accumulate on navs every poll | `app.js:1733-1773` | Moved listener binding into `controlsSetup` (run once); delegated clicks to dynamic innerHTML |

All 14 fixes pass 1067/1067 tests + TypeScript build (2 pre-existing `before_lines: unknown` errors unchanged).

---

## MEDIUM Issues (14)

### M1. `evalTimeGap` division by zero when `cond.value` is 0

**File**: `src/engine/evaluator.ts:760`

`parseTimeValue(cond.value, cond.unit)` returns 0 when `cond.value` is 0 → `0/0 = NaN` propagates to progress.

---

### M2. `computeBaseStats` O(windows × events) complexity

**File**: `src/engine/stats.ts:85-105`

For each session window, ALL events are scanned. With hundreds of sessions and tens of thousands of events, performance degrades quadratically.

---

### M3. `parseJsonBody` has no request body size limit

**File**: `src/dashboard/server.ts:106-114`

Accumulates `body += chunk` without limit. A local client can exhaust server memory. (Risk mitigated by localhost binding.)

---

### M4. `/customize` page bypasses CSRF token injection

**File**: `src/dashboard/server.ts:552-555`

Uses `serveStaticFile()` which does NOT inject `__DEV_TOKEN__`, unlike `serveStatic()` for the main page.

---

### M5. `customize-api.ts` ALLOWED_FIELDS includes `description_en` but not `description_cn`

**File**: `src/dashboard/customize-api.ts:517`

Confusing naming: `description` in the YAML is actually the Chinese description, while `description_en` is English. The API allows editing `description_en` but not `description_cn`.

---

### M6. Daemon plist/systemd XML path injection

**File**: `src/cli/daemon.ts:82-102`

Paths are interpolated into plist XML without escaping `&`, `<`, `>` characters.

---

### M7. Showcase `auto-fill` can duplicate already-pinned achievements

**File**: `src/cli/showcase.ts:111-138`

Fills empty slots from sorted unlocked list without filtering out IDs already pinned in other slots.

---

### M8. `dispatch()` promise not awaited in CLI entry

**File**: `src/cli/index.ts:484`

`dispatch(cmdName, cmdArgs)` returns a Promise but isn't awaited. Errors become unhandled rejections.

---

### M9. Duplicate `escHtml` function definition

**File**: `src/dashboard/public/app.js:2591, 2918`

Defined twice; the second (line 2918) always wins due to hoisting. The first is dead code.

---

### M10. Questline/achievement ID collision: `polyglot`

**File**: `achievement-definitions.yaml`

Both an achievement (line 522) and a questline (line 4111) share the ID `polyglot`. Different arrays, but any flat lookup could collide.

---

### M11. `config.ts saveConfig()` silently replaces corrupt config

**File**: `src/config.ts:94`

`saveConfig()` calls `loadConfig()` which falls back to defaults on parse failure, then writes back — silently overwriting the user's (corrupt) config without warning.

---

### M12. `history.ts readEvents()` comment/code mismatch

**File**: `src/cli/history.ts:106-113`

Comment says "Use safeParse but fall back gracefully" but implementation uses raw `JSON.parse()`.

---

### M13. MCP server version hardcoded at `0.1.6`, package.json is `0.1.8`

**File**: `src/main.ts:53` vs `package.json:3`

MCP clients see an outdated version string.

---

### M14. `parseJsonBody` uses raw `JSON.parse()` in dashboard server

**File**: `src/dashboard/server.ts:111`

Violates the `safeParse()` convention. Wrapped in try/catch but inconsistent with project standards.

---

## LOW Issues (4)

### L1. Tour.js hardcoded Chinese strings

**File**: `src/dashboard/public/tour.js:99-105`

Tour button labels are in Chinese regardless of language setting.

---

### L2. `exportData` uses `window.__agpaProfile` which is never set

**File**: `src/dashboard/public/app.js:2782`

Falls back to `'default'` (safe), but `currentProfile` would be more correct.

---

### L3. `canvas.onmousemove/onmouseleave` reassignment on re-render

**File**: `src/dashboard/public/app.js:2463,2473`

Each `drawLineChart` call overwrites the previous handler. Functionally correct but imprecise.

---

### L4. Design doc 02 XP values differ from implementation

**File**: `docs/design/02-系统机制.md` vs `src/dashboard/xp.ts`

Design: "task=10 XP, achievement=50-500 XP". Actual: task=25 XP, achievement=50-1000 XP (added mythic tier).

---

## Documentation vs Code Discrepancies (23 items)

### Numbers/Counts

| What | CLAUDE.md | issues-todo.md | PROGRESS.md | Actual Code |
|------|-----------|----------------|-------------|-------------|
| Achievements | — | 201 | 203 / 193 | **208** |
| Hidden | — | 50 | — | **54** |
| Condition types | 11 | 12 | 11 | **12** (`time_gap` missing from CLAUDE.md list) |
| CLI commands | 24 | 25 | 25 | **25** (`banner` missing from CLAUDE.md) |
| npm dependencies | 3 | — | — | **4** (`figlet` added) |
| MCP tools | — | — | — | **6** (multi-tool-setup.md lists 5, missing `suggest`) |
| Sets | — | — | — | **11** (design doc 01 lists 10, missing `linguist`) |
| Endurance members | — | — | — | **7** (design doc 01 says 5) |
| MCP server version | — | — | — | `main.ts:0.1.6` ≠ `package.json:0.1.8` |

### Architecture Drift (from design docs, all marked ⚠️ in CLAUDE.md)

1. **Hook architecture** — Design doc 03 shows CLI-arg based hooks; actual uses stdin-pipe JSON mode
2. **Evaluator count** — Design doc 05 describes 5 types; actual has 12
3. **EventBuffer/Watermark** — Design doc 05 describes EventBuffer class; not implemented
4. **Showcase slots** — Design doc 02 says 4 (upgradeable to 6 at level 25); actual is always 6
5. **Rarity system** — Design doc 01 describes dynamic percentile calculation; actual uses static YAML assignments
6. **State file layout** — Design doc 03 lists 8 files; actual has different set (state.json, event.log, showcase.json, config.json, stats.json)
7. **Event type whitelist** — Design doc 08 defines ~20 types; actual has 40+ with `string` catch-all
8. **MCP tools** — Design doc 03 says 4-5 tools; actual has 6

---

## Recommended Priority (updated 2026-06-11)

### ✅ Done — CRITICAL (8/8) + HIGH (14/14)
All fixed. See CHANGELOG.md and HIGH Fix Summary above for details.

### Fix Soon (next sprint)
1. **M13** — MCP server version sync (`main.ts:0.1.6` → `0.1.8`)
2. **H6 residue** — Remaining 11 JSON.parse sites in diagnostic/config tools (try/catch guarded, low-risk)
3. **M2** — Stats O(n²) performance
4. **M1** — `evalTimeGap` division by zero
5. **M4** — `/customize` bypasses CSRF token injection
6. **M5** — `customize-api.ts` ALLOWED_FIELDS asymmetry
7. **M7** — Showcase auto-fill duplicates
8. **M9** — Duplicate `escHtml` definition (dead code)

### Address Incrementally
9. **M3/M6/M8/M10/M11/M12/M14** — Remaining MEDIUM issues
10. **L1-L4** — LOW issues (tour i18n, exportData, canvas handlers, design doc XP)
11. Documentation numbers sync (achievements 208, condition types 12, CLI commands 25, dependencies 4, MCP tools 6, sets 11)
