# Changelog

## [0.1.3] — 2026-05-30

### Init: Zero-config One-command Setup

- **`npm run init` without `--tool`** — auto-detects all 5 AI coding tools by scanning config files, configures them all
- **Hook merge injection** — appends AGPA hooks to existing CC hook entries (sound effects, etc.) instead of skipping when keys already exist
- **Idempotent** — re-running never duplicates commands
- **3 new npm scripts** — `npm run hook-auto`, `hook-track`, `hook-poll` for quick testing

### Evaluator Fixes & Improvements

- **evalThreshold metric path** — now respects `cond.event`, `cond.filter`, `cond.role`, and time windows (was silently ignoring all of them)
- **single_task window** — uses `task.complete` events as task boundaries to infer scope (no per-event task_id needed)
- **same_task window** — `isTaskWindow` now recognizes this alias (7 achievements were silently un-scoped)
- **computeMetric expanded** — 2 new branches: `showcase_count` (reads showcase.json), `concurrent_sessions` (counts unique session_ids within 1h)

### Event Coverage: 6 Previously-Blocked Achievements Fixed

| Achievement | Fix |
|-------------|-----|
| visual_prompt, image_whisperer | YAML: `tool.complete` → `image.read` via AGENTS.md manual track |
| polyglot | YAML: `file.create` → `file.language_used` via AGENTS.md `{ language }` |
| perfectionist | YAML: `file.edit` → `function.edited` via AGENTS.md `{ function_name }` |
| trophy_case | Code: `computeMetric` reads `showcase.json` non-null slot count |
| parallel_universe | Code: `computeMetric` counts unique session_ids |

### Cleanup

- **storyteller** deleted (not implementing "share conversation" feature)
- Achievement count: 118 → 117
- Integration test updated to match new count

### Data Consistency (P2)

- **`category: milestone` → `milestones`** — 8 achievements aligned with Dashboard category names
- **Set membership** — `bounce_back` added to agent_commander list, `mythic_completionist` added to completionist list
- **Missing `set:` fields** — 8 achievements now have correct set reference (the_beginning ×4, collectors_soul ×1, devops_triad ×3)
- **`im_sorry_dave` window** — both conditions now have `window: single_session`

### Evaluator Hardening (P1)

- **Empty conditions guard** — `if (def.conditions.length === 0) continue;` prevents false positives
- **evalMode target** — no-event path now uses same format as with-event path
- **`set_id` removed** — dead code from Condition interface + yaml-parser (never read by any evaluator)
- **evalStreak window/field/same_target** — now reads scopeEvents, time windows, field filtering, and same_target (consistent with all other evaluators)

### Surgeon Achievement Unblocked

- **hook.ts Edit payload** — extracts `edit_lines` from `tool_input.old_string`, `total_file_lines` from file on disk (within cwd/home boundary)
- **Path traversal guard** — rejects `..` paths and absolute paths outside cwd/home
- **Zero AGENTS.md dependency** — fully automatic from CC stdin data

### Test Coverage (P3)

- **+25 unit tests** — metric path filtering×3, single_task/same_task×2, empty conditions guard, streak window, streak same_target, hook mapEvents×16
- **New test file** — `tests/cli/hook.test.ts` covering all 10 CC hook→AGPA event mappings
- 55 → 80 tests (6 files), all passing

### evalStreak event_level Mode

- **`event_level: true`** — new Condition field for per-event streak counting (not calendar-day)
- **ten_task_no_edit** — now correctly counts consecutive zero-edit tasks, not consecutive days
- Backward compatible: existing streak achievements (streak_7/30/100/365) unchanged

### Known Gaps (HOLD)

- evalPercentile fallback thresholds (2 percentile achievements work, others need telemetry)
- matchFilter context limited to 8 hardcoded fields (no current impact — affected achievements moved to manual track)
- evalStreak calendar-day vs event-consecutive semantics (ten_task_no_edit may need revisit)

### Tech Stack Unchanged

Runtime: tsx, MCP: @modelcontextprotocol/sdk, Parsing: yaml, Validation: zod, Testing: vitest (81 tests, 6 files, all passing)

---

## [0.1.2] — 2026-05-30

### System Audit & P0 Bug Fixes (10 fixed)

- **evalStreak** — now reads `cond.filter` and `cond.operator` (was hardcoded `>=`)
- **set_completion** — `all` and `exclude_hidden` fields parsed and evaluated; `completionist_gold`/`mythic_completionist` now distinct from `completionist_bronze`
- **max_per_day** — Condition field + parser + per-day grouping in `evalThreshold`; `daily_checkin` second condition now functional
- **sequence standard mode** — window filtering added (was silently ignoring `window:` on 7 sequence achievements)
- **session-scoped filtering** — `scopeEvents()` added to evaluator, filters events to latest `session_id` when `single_session`/`same_session` window is set; swat_team fixed
- **lifetime achievements** — `parseWindow` supports `all`/`lifetime` returning Infinity; 25 achievements upgraded from implicit 24h default to explicit `window: all`

### Event System Overhaul

- **4 evaluator bugs fixed** — threshold → independent evalThreshold (field summation + metric expressions); sequence → consecutive mode with count sub-object; distinct_count → values whitelist; counter → same_target support
- **4 new hook event mappings** — task.complete (TaskCompleted), context.compacted (PostCompact), tool.requested (PreToolUse), file.write (PostToolUse Write)
- **3 new CC hooks registered** — PreToolUse, TaskCompleted, PostCompact added to init.ts; 9 hooks total (was 6)
- **24 manual track events in AGENTS.md** — comprehensive two-category table (agent actions + user actions observable), each with specific payload hints
- **init.ts INSTRUCTION_BLOCK rewritten** — matching AGENTS.md, injected into user's CLAUDE.md during init

### Achievements

- **12 new event-driven achievements** — Pipemaster, Command Baby, Cerberus (command.run); Fail Forward, Bounce Back, Phoenix (tool.failure); MCP Connoisseur, MCP Collector (mcp.tool_call); Command Master (command.run, legendary); Failure Is the Mother of Success (tool.failure, legendary); Delegator, SWAT Team (agent.spawn)
- **3 unreachable achievements deleted** — perfect_review, photographic_memory, scorched_earth
- **3 achievements unblocked** — the_switch, the_debugger, triple_debugger via new manual track events
- **All 5 previously-unused hook events now serve achievements** — command.run, tool.failure, mcp.tool_call, agent.spawn all have consumer achievements
- **109 → 118 total achievements**, all events needed by any achievement are now either auto-tracked or covered by manual instructions

### Documentation & Tooling

- **CLAUDE.md** — project-level instructions: build/test commands, architecture diagram, conventions, known sharp edges
- **`docs/issues-todo.md`** — comprehensive issue tracker: 10 P0 bugs, ~20 P1 gaps, ~6 P2 data issues
- **README.md** — updated project structure, CLI table (added hook auto + mvp), dependency list
- **DEVLOG.md** — 2026-05-29 evaluator-fix entry + 2026-05-30 event system entries
- **docs/PROGRESS.md** — 5→12 condition types, achievement count updated
- **docs/design/** — 5 files now carry design-phase disclaimer headers

### Housekeeping

- `@types/node` → devDependencies
- MCP engine `session_id` no longer hardcoded `demo-session`; hook.ts passes real session_id from CC stdin
- `package.json`: version 0.1.0→0.1.1, license field added

### Tech Stack Unchanged

Runtime: tsx, MCP: @modelcontextprotocol/sdk, Parsing: yaml, Validation: zod, Testing: vitest (55 tests, 5 files, all passing)

## [0.1.1] — 2026-05-29

### Added

- **Dashboard 中英双语** — 完整 i18n 词典（16 个 UI 文本 + 10 个分类名 + 6 个稀有度名），`t()` 翻译函数支持 `{placeholder}` 替换，静态 HTML 通过 `data-i18n` 属性翻译，动态渲染文本全部走 `t()`
- **Dashboard 分类名翻译** — `onboarding` → Onboarding / 入门，`milestones` → Milestones / 里程碑 等
- **Dashboard 稀有度翻译** — `common` → Common / 普通 等，用于 badge 显示
- **Rarity badge 本地化** — 原本硬编码英文 rarity 名，现根据当前语言翻译显示
- **`renderI18n()`** — 统一处理 `data-i18n` 属性，切换语言时同步 `<html lang>`
- **API `description_cn` 字段暴露** — `AchievementItem` 新增 `description_cn`，前端 `displayDesc()` 就绪（YAML 后续补上描述即自动生效）

### Changed

- **Filter tab 标签** — 由硬编码改为动态 i18n（All→ 全部/Unlocked→ 已解锁/Locked→ 未解锁）
- **Category pill 标签** — 由英文 category ID 改为翻译后的分类名
- **Stats card 标签** — Unlocked/Events/Day Streak/Complete → 中文对应翻译
- **XP label** — 模板化 `{xp} XP • Level {level}` / `{xp} XP • {level} 级`
- **Showcase tooltip** — `click to remove` / `Click to pick` / `Pin to showcase` 翻译
- **Empty state 提示** — `No achievement sets defined.` → 中文"暂无套装定义"等
- **Language toggle 切换** — 切语言时同步更新 `<html lang>` 属性

## [0.1.0] — 2026-05-29

### Added

- **12 condition types fully implemented** — counter, threshold, streak, sequence, distinct_count, event, set_completion, ratio, pattern_match, percentile, mode, sequence_count
- **Achievement engine** (`src/engine/`) — event tracking, condition evaluation, file persistence, YAML parsing with full type validation
- **MCP Server** (`src/main.ts`) — STDIO protocol via `@modelcontextprotocol/sdk`, 5 tools: track, poll, stats, showcase, config
- **CLI tools** — `init` (agent registration), `hook` (auto event tracking), `doctor` (diagnostics), `dashboard`, `mvp` (demo data)
- **Dashboard** — HTTP server + frontend (HTML/CSS/JS), dark/light themes, achievement grid, stats, XP/level, timeline, 6-slot showcase cabinet, set rewards
- **Hook auto-track** — SessionStart/Stop, PostToolUse, PostToolUseFailure, SubagentStart/Stop; multi-event derivation per tool action
- **macOS notifications** — `terminal-notifier` with custom icon, emoji, sound, grouping, Dashboard deep-link
- **Percentile system** — standalone stats server (`src/server/stats-server.ts`), telemetry client, reservoir sampling, threshold caching
- **Set/rewards system** — 9 set definitions, 6 reward types (title, badge, theme, border, animation, stat_counter)
- **Filter evaluator** — safe `matchFilter` parser (no JS eval), supports `==`, `!=`, `in`, `matches`, `contains`, `&&`, `||`
- **Tool registry** — shared `src/tool-registry.ts` for duplicate TOOL_PATHS across CLI tools
- **Zod validation** — safe JSON parsing in store/config/helpers with graceful degradation
- **CI workflow** — `.github/workflows/ci.yml`
- **Pixel art toolchain** — `tools/img-to-pixelart.mjs`, `render-png.mjs`, `term-preview.mjs`, supporting SVG/PNG → multi-resolution YAML pipeline
- **Test suite** — 5 test files, 41 tests (unit + integration), all passing

### Changed

- **YAML parser replaced** — hand-written regex → `yaml` npm package, full error messages for unknown condition types, missing IDs etc.
- **evalThreshold upgraded** — role filtering, session window, filter support, operator dispatch aligned with evalCounter
- **Showcase storage deduplicated** — `loadShowcase`/`saveShowcase` extracted to `src/helpers.ts`, shared by MCP tool and Dashboard
- **Notification refactored** — `src/utils/notify.ts` extracted, shared by hook.ts and poll.ts
- **TypeScript migration** — MVP from `.mjs` → `.ts`, strict mode, `noUncheckedIndexedAccess`, ES modules

### Removed

- **CounterCache** — dead code, 117 lines + 80 test lines removed
- **`evalThreshold` function** — merged into `evalCounter` via fall-through dispatcher
- **Unused Condition fields** — `min_matches`, `window_size`, `mode_field`, `metric`
- **`AchievementDefinition.progress`** — unused field
- **Old MJS files** — `agpa-engine.mjs`, `agpa-mvp.mjs`
- **`tools/types.ts`** — dead code
- **Showcase slot limit** — `slice(0,4)` removed, all 6 slots displayed

### Fixed

- YAML `events` → `sequence` field fallback (affected 9 achievements)
- `chain_reaction` achievement changed to standard counter type
- 5 unused `order: true` fields removed
- `contains '?'` filter syntax for legacy bare-form compatibility

### Tech Stack

- Runtime: `tsx` (TypeScript direct execution)
- Type system: strict mode + `noUncheckedIndexedAccess`
- Module format: ESM (`"type": "module"`)
- Build: `tsc --noEmit`
- Testing: vitest
- External deps: `@modelcontextprotocol/sdk`, `yaml`, `zod`

### Achievement Definitions

- 109 achievements across 10 categories (30 MVP-unlockable)
- 6 rarity levels: common → mythic
- 9 set definitions with visual rewards
- Chinese/English bilingual names and descriptions

### Supported Agents

Claude Code, Kilo Code, OpenCode, Hermes Agent, OpenClaw.
