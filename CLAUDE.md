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

Three layers, **two channels**:

```
                    ┌─────────────────────────┐
                    │   Engine (src/engine/)   │
                    │   track() / poll()       │
                    └─────────────────────────┘
                      ↗                    ↖
            MCP Server               Hook CLI
          (src/main.ts)           (src/cli/hook.ts)
                │                        │
          STDIO 长连接              短命子进程 stdin pipe
                │                        │
          Agent 主动调用            Hook 回调自动触发
          "有意识的行为"            "Agent 无感知"
                │                        │
          ┌─────┴─────┐          ┌──────┴──────┐
          │ 手动 track │          │ auto-track  │
          │ image.read │          │ tool.complete│
          │ lang_used  │          │ file.edit   │
          │ plan.mode  │          │ session.*   │
          │ ...        │          │ agent.spawn │
          └───────────┘          └─────────────┘
```

- **MCP Server** (channel 1) — STDIO protocol, 5 tools (track/poll/stats/showcase/config). Agent **actively calls** these for semantic events that hooks can't capture (image.read, file.language_used, plan.mode_entered, etc.)
- **Hook CLI** (channel 2) — Short-lived subprocess called by tool hooks. **Agent is unaware** — hooks fire automatically. Events: tool.complete, file.read/edit/write, session.start/end, task.complete, agent.spawn, git.commit, etc.
- **Engine** — pure functions on in-memory data. `track()` appends to event.log via both channels. `poll()` evaluates and writes state.json. File I/O only in store.ts.
- **Dashboard** — zero-framework HTML/CSS/JS, HTTP server in dashboard/server.ts, API layer in dashboard/api.ts.

### Hook CLI modes (all stdin-pipe, short-lived)

| Mode | Tool | How hook.ts gets data |
|------|------|----------------------|
| `auto` | CC | CC hook manager spawns hook.ts, writes JSON to stdin |
| `hermes-auto` | Hermes | Hermes hook manager spawns hook.ts, writes JSON to stdin |
| `openclaw-auto` | OpenClaw | Our TS plugin spawns hook.ts, writes JSON to stdin |

All three share the same translation pattern: tool-specific fields → CC standard `HookStdin` → `mapEvents()` → `ENGINE.track()`.

Useful for quick testing: `echo '{"hook_event_name":"PostToolUse","tool_name":"Read"}' | npx tsx src/cli/hook.ts auto`

## Conventions

- The YAML file (`04-成就定义清单.yaml`) is the **authoritative data source**. If you add a condition field, update `types.ts` Condition interface AND `yaml-parser.ts` buildCondition().
- **After each commit + push, update `CHANGELOG.md`** with the changes you just pushed. Don't batch changes across multiple commits — update it with each push.
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
