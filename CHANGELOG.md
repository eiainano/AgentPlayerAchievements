# Changelog

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
