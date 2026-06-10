# AGPA Development

## Commands

```
npm run test       # vitest (1034 tests, 42 files)
npm run build      # tsc --noEmit
npm run dashboard  # start on :3867, then open browser (supports --profile <name>)
npm run demo       # generate MVP data + stats
npm run doctor     # diagnose system state
npm run profile    # manage achievement profiles (create <name> | list)
```

Unified CLI via `bin` field (npm link): 24 commands — `agpa init | uninstall | verify | doctor | config | dashboard | web | profile <create|list|switch|softwares> | showcase | demo | stats | progress | reset | search | suggest | sound | activity | export | import | mcp | completion | upgrade | watch | history`

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

- **MCP Server** (channel 1) — STDIO protocol, 6 tools (track/poll/stats/showcase/config/suggest). Agent **actively calls** these for semantic events that hooks can't capture (image.read, file.language_used, plan.mode_entered, etc.)
- **Hook CLI** (channel 2) — Short-lived subprocess called by tool hooks. **Agent is unaware** — hooks fire automatically. Events: tool.complete, file.read/edit/write, session.start/end, task.complete, agent.spawn, git.commit, etc.
- **Engine** — pure functions on in-memory data. `track()` appends to event.log via both channels. `poll()` evaluates and writes state.json. File I/O only in store.ts.
- **Dashboard** — zero-framework HTML/CSS/JS, HTTP server in dashboard/server.ts, API layer in dashboard/api.ts.

### Hook CLI modes (all stdin-pipe, short-lived)

| Mode | Tool | How hook.ts gets data |
|------|------|----------------------|
| `auto` | CC | CC hook manager spawns hook.ts, writes JSON to stdin |
| `hermes-auto` | Hermes | Hermes hook manager spawns hook.ts, writes JSON to stdin |
| `openclaw-auto` | OpenClaw | Our TS plugin spawns hook.ts, writes JSON to stdin |
| `kilocode-auto` | Kilo Code / OpenCode | Our TS plugin Bun.spawns hook.ts, writes JSON to stdin |

All four share the same translation pattern: tool-specific fields → CC standard `HookStdin` → `mapEvents()` → `ENGINE.track()`.

Useful for quick testing: `echo '{"hook_event_name":"PostToolUse","tool_name":"Read"}' | npx tsx src/cli/hook.ts auto`

## Conventions

- **版本号永远沿用 0.1.x**（0.1.4 → 0.1.5 → 0.1.6 …），除非用户明确说要跳大版本号。不要自行升 0.2、1.0 等。
- The YAML file (`achievement-definitions.yaml`) is the **authoritative data source**. If you add a condition field, update `types.ts` Condition interface AND `yaml-parser.ts` buildCondition().
- **After each commit + push, update `CHANGELOG.md`** with the changes you just pushed. Don't batch changes across multiple commits — update it with each push.
- No new npm dependencies without strong reason. We have exactly 3: mcp-sdk, yaml, zod.
- ESM only (`"type": "module"`). No CommonJS.
- All JSON parsing uses `safeParse()` from `src/utils/validate.ts` — never raw `JSON.parse()`.
- Notifications go through `src/utils/notify.ts` — not duplicated in hook.ts and poll.ts.
- Hook stdin parsing happens exactly once (cached), then `mapEvents()` transforms.

## The YAML Condition Types (all 11 implemented)

counter, threshold, streak, sequence, distinct_count, event, mode,
sequence_count, pattern_match, ratio, set_completion

If evaluator behavior seems wrong, check src/engine/evaluator.ts — each type has its own `eval*()` function now (no more fall-through hacks).

## Known Sharp Edges

- `evalThreshold` with `metric:` uses `evaluateMetric()` which splits on `/` for ratio expressions. If you add a metric format, update that parser.
- `evalSequence` has two modes: standard (ordered match) and consecutive (longest run). The `consecutive` flag and `count` sub-object drive the switch.
- `distinct_count` with `values:` whitelist filters candidates before counting.
- Engine.stateDir defaults to `~/.agent-achievements/`. Tests use a temp dir.
- **Multi-profile**: stateDir = `resolveProfileDir(name)`. "default" → `~/.agent-achievements/`, named → `~/.agent-achievements/profiles/<name>/`. Max 3 named + 1 default = 4 total. Profile management in `src/utils/profile.ts`.
- Hook `auto` mode handles: PostToolUse, PreToolUse, PostToolUseFailure, TaskCompleted, PostCompact, SubagentStart, SubagentStop, SessionStart, SessionEnd. If CC adds new hook types, add cases to `mapEvents()`.

## Known Issues & TODOs

### 代码更新后：文档核查

每次代码变更后（尤其是改动成就数量、condition type数量、事件映射、架构设计），运行"文档核查"——扫描 `docs/` 下所有 `.md` 文件，将过时的数字（成就总数、条件类型数、套装成员数等）同步到与代码一致。**CHANGELOG.md 中的历史记录不修改。**

用户说"文档核查"或"根据代码核查文档"时执行此操作。

`docs/issues-todo.md` tracks all known bugs, gaps, and data inconsistencies in the achievement system. Always read it before starting evaluator or YAML work.

## Documentation Index

### Core tracking docs（日常维护，数字需与代码同步）

| 文件 | 用途 |
|------|------|
| `docs/issues-todo.md` | 问题/功能/改进追踪，按 P0→P3 优先级组织。给 AI 看的，每次代码变更后同步 |
| `docs/PROGRESS.md` | 高层开发进度总览 + 版本对比表。给人看的，了解项目整体状态 |
| `docs/multi-tool-setup.md` | 5 工具 MCP 配置指南 + init 流程 + 环境变量说明 |
| `docs/multi-tool-research.md` | Hermes/OpenClaw/KiloCode/OpenCode 的 hook API 调研（2026-06-06，Kilo/OpenCode auto-track 已实施） |

### Design docs（`docs/design/`，方案蓝图，不会随代码每版同步）

| 文件 | 内容 |
|------|------|
| `01-成就分类体系.md` | 成就分类、命名规范、定义语言（YAML 字段说明） |
| `02-系统机制.md` | XP/等级、稀有度、套装、展示柜机制设计 |
| `03-技术架构.md` ⚠️ | 早期技术架构蓝图（与实际代码有差异） |
| `05-核心引擎设计.md` ⚠️ | 事件流 → 评估 → 展示的引擎设计蓝图 |
| `06-首次体验与安装流设计.md` ⚠️ | `init.ts` 安装流程设计 |
| `07-各工具事件采集设计.md` | 5 个 Agent 工具的事件采集能力分析与方案 |
| `08-EventCapture落地设计.md` | 从工具事件到 event.log 的完整链路设计 |
| `09-开发调试与恢复设计.md` ⚠️ | 开发调试、数据恢复、reset 流程设计 |
| `10-版本路线图.md` ⚠️ | MVP → v1.0 版本规划 |
| `11-像素画方案设计.md` | 像素画 icon 存储/渲染方案（未实施） |
| `12-Steam游戏成就设计调研.md` | 21 款 Steam 游戏成就系统调研（2026-05-31） |

⚠️ = 早期设计蓝图，当前代码才是权威来源

### External references（只读，不修改）

| 文件 | 来源 |
|------|------|
| `docs/claude-code-best-practices.md` | Claude Code 官方文档 + 社区实践调研 |
| `docs/superpowers/` | Superpowers 插件的归档 spec/plan（不再使用） |
| `CHANGELOG.md` | 每次 commit+push 的变更记录（历史记录，不修改） |
