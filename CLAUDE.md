# AGPA Development

## Commands

```
npm run test       # vitest (48 tests, 5 files)
npm run build      # tsc --noEmit
npm run dashboard  # start on :3867, then open browser
npm run demo       # generate MVP data + stats
npm run doctor     # diagnose system state
```

## Architecture

Three layers, two channels:

```
Hook CLI (src/cli/hook.ts) ──┐
                              ├──→ engine (src/engine/) ──→ ~/.agent-achievements/
MCP Server (src/main.ts) ────┘                                   ├── event.log
                                                                 ├── state.json
                                                                 ├── showcase.json
                                                                 └── config.json
```

- **Engine** — pure functions on in-memory data. `track()` appends to event.log, `poll()` evaluates and writes state.json. File I/O only in store.ts.
- **Hook CLI** — called by CC hooks. `auto` mode reads stdin JSON, maps CC hook events to AGPA events, appends via engine. Useful for quick testing: `echo '{"hook_event_name":"PostToolUse","tool_name":"Read"}' | npx tsx src/cli/hook.ts auto`
- **MCP Server** — 5 tools (track/poll/stats/showcase/config), STDIO protocol.
- **Dashboard** — zero-framework HTML/CSS/JS, HTTP server in dashboard/server.ts, API layer in dashboard/api.ts.

## Conventions

- The YAML file (`04-成就定义清单.yaml`) is the **authoritative data source**. If you add a condition field, update `types.ts` Condition interface AND `yaml-parser.ts` buildCondition().
- No new npm dependencies without strong reason. We have exactly 3: mcp-sdk, yaml, zod.
- ESM only (`"type": "module"`). No CommonJS.
- All JSON parsing uses `safeParse()` from `src/utils/validate.ts` — never raw `JSON.parse()`.
- Notifications go through `src/utils/notify.ts` — not duplicated in hook.ts and poll.ts.
- Hook stdin parsing happens exactly once (cached), then `mapEvents()` transforms.

## The YAML Condition Types (all 12 implemented)

counter, threshold, streak, sequence, distinct_count, event, mode,
sequence_count, pattern_match, ratio, percentile, set_completion

If evaluator behavior seems wrong, check src/engine/evaluator.ts — each type has its own `eval*()` function now (no more fall-through hacks).

## Known Sharp Edges

- `evalThreshold` with `metric:` uses `evaluateMetric()` which splits on `/` for ratio expressions. If you add a metric format, update that parser.
- `evalSequence` has two modes: standard (ordered match) and consecutive (longest run). The `consecutive` flag and `count` sub-object drive the switch.
- `distinct_count` with `values:` whitelist filters candidates before counting.
- `percentile` conditions need opt-in telemetry + stats-server running. Without it, falls back to hardcoded thresholds.
- Engine.stateDir defaults to `~/.agent-achievements/`. Tests use a temp dir.
- Hook `auto` mode handles: PostToolUse, PreToolUse, PostToolUseFailure, TaskCompleted, PostCompact, SubagentStart, SubagentStop, SessionStart, SessionEnd. If CC adds new hook types, add cases to `mapEvents()`.

## Known Issues & TODOs

`docs/issues-todo.md` tracks all known bugs, gaps, and data inconsistencies in the achievement system. 10 P0 bugs, ~20 P1 gaps, ~6 P2 data issues. Always read it before starting evaluator or YAML work.
