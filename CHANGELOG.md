# Changelog

## [0.1.6] — 2026-05-31

### 第二轮调研：Claude Code 游戏化生态 Top 5 + 三大特性详细设计 — 2026-06-03

GitHub 搜索 `achievement`/`gamification`/`quest`/`play` 关键词，star 排序筛选 5 个项目克隆至 `research/`（已 gitignore），深读后产出分析报告写入 `docs/whatsmore.md`：

- **claude-code-guide**（114⭐）— Fibonacci 间隔 nudging / 16 领域腰带段位 / 特性依赖图 / 数据迁移框架 / 评分公式
- **sc2-claude-hooks**（26⭐）— StarCraft 2 阵营音效 / 15s 冷却 + 智能错误过滤 / 一键安装
- **buddy-evolution**（5⭐）— 34 触发函数成就 / 5 维属性递减增长 / 18 物种进化树 / 12 人格
- **claude-code-quest**（1⭐）— Plan checkbox → quest 进度 / 多项目 RPG Dashboard / 安全不变量
- **claude-code-achievements**（84⭐）— 第一轮已分析

新增三大特性详细设计方案（📐 方案设计阶段，暂不实施）：

1. **成就解锁音效系统** — 6 级稀有度 6 种音效，SFXR PoC，`notify.ts` + `assets/sounds/`
2. **数据迁移框架** — `schema_version` + 增量迁移链，`store.ts` 入口自动执行，幂等
3. **Streak 乘法奖励** — `1.0x→2.0x`（每天 +0.1），叠加到现有 XP 系统

新增**现有 XP 系统基准分析**：2 来源（成就 + task）、`N²×100` 等级曲线、4 问题诊断（task 贡献低 / 等级区分度不足 / streak 装饰 / MCP 缺失 XP）、数值微调建议。

### 像素画概念描述文档 — 2026-06-02

`docs/pixel-art-ideas.md` — 为全部 160 个成就编写像素画描述，按 10 个分类组织表格。每项包含成就 ID、中文名、中文描述、像素画场景描述（前景/背景构成 + 调色板方向），与成就的中英文命名和描述一致，适当联想扩展。

### 跨平台桌面通知 — 2026-06-02

`src/utils/notify.ts` 重写，自动检测 OS 并选择最佳通知机制：

| 平台 | 机制 | 回退 |
|------|------|------|
| macOS | `terminal-notifier`（可点击跳转 Dashboard） | `osascript` |
| Linux | `notify-send` + 自定义图标 (libnotify) | — |
| Windows | PowerShell + `System.Windows.Forms.MessageBox` | — |
| 全部 | 终端输出 ★ title + body | TTY/headless 永不落空 |

`detectOS()` 自动从 `process.platform` 识别；解锁时同时弹系统通知 + 终端输出。

### CCA 调研 Phase 1 — /achievements 聊天命令 + tip/hint 系统 — 2026-06-02

调研 [subinium/claude-code-achievements](https://github.com/subinium/claude-code-achievements)（29 成就 Bash 插件），借鉴其学习型成就设计哲学与聊天内查询能力，8 方向评估后采纳 4 项近期实施：

- **tip/hint 字段分离**（`04-成就定义清单.yaml` + `src/engine/types.ts` + `yaml-parser.ts`）— `tip`（教育提示，已解锁后教用户更好使用该功能）vs `hint`（解锁线索，给未解锁用户语义暗示但绝不暴露精确条件）。14 个 onboarding 成就全部含 tip+hint，73 个 Common/Uncommon 成就含 hint。Rare+ 保留神秘感。
- **`/achievements` 聊天内命令**（`.claude/commands/achievements.md`）— 7 种视图模式：默认已解锁列表、locked（未解锁+hint）、all（分类分组）、stats（XP/等级/稀有度分布）、recent（最近 5 个）、按稀有度/set 过滤。20 格 `▰▱` 进度条 + 百分比。
- **`/achievements settings` 设置命令**（`.claude/commands/achievements-settings.md`）— 聊天内切换语言（zh/en）、开关通知、重置进度（需二次确认）。
- **init 一键安装命令**（`src/cli/init.ts`）— `agpa init` 自动编译 YAML→JSON（Claude 无法直接解析 YAML）+ 复制命令文件到 `~/.claude/commands/`，全局可用。Summary 框第 4 步增加 `/achievements` 指引。
- **编译工具链**（`scripts/compile-achievements.ts` — YAML→stateDir/achievements.json，`scripts/add-tips-hints.ts` — 一次性 YAML 注入脚本）
- **行动计划文档**（`docs/whatsmore.md`）— 8 条目状态追踪，Phase 1/2 路线图

### 统一 CLI + 安装体验重构 — 2026-06-02

- **`agpa` 统一 CLI**（`src/cli/index.ts`）— 10 子命令路由，`--help`/`--version`。`package.json` 加 `bin`/`files`/`engines` 字段，`npm link` 即用。
- **init 体验增强**（`src/cli/init.ts`）— Welcome banner + 自动检测可视化 + 配置进度输出 + 总结框含 3 步下一步指引 + 首成就预告。
- **`agpa verify` 新命令**（`src/cli/verify.ts`）— 11 项健康检查（数据目录→state→YAML→引擎 dry-run→MCP 配置→指令文件），复用 doctor 逻辑 + engine 干跑测试。
- **Dashboard 引导增强**（`app.js`/`index.html`/`styles.css`）— 首次访问 tip（1-5 成就时显示，可关闭），下一个推荐成就卡片（1-10 成就时显示，带进度条和 click-to-scroll）。
- **文档同步**（`README.md`/`CLAUDE.md`/`docs/multi-tool-setup.md`）— 命令改为 `agpa` 方式，138→160 成就，`~/.agpa`→`~/.agent-achievements` 路径修正。
- 用户完整旅程：`npm link` → `agpa init` → `agpa verify` → 日常使用 → 🏆 → `agpa dashboard`。

### 🎯 稀有度全量重平衡 — 2026-06-01

160 项成就稀有度大调整（48 项变更），构建健康的金字塔分布：

| 稀有度 | 变前 | 变后 | Δ | 占比 |
|--------|------|------|---|------|
| Common | 20 | **48** | +28 | 30% |
| Uncommon | 56 | **44** | -12 | 27.5% |
| Rare | 46 | **30** | -16 | 18.8% |
| Epic | 24 | **24** | 0 | 15% |
| Legendary | 12 | **9** | -3 | 5.6% |
| Mythic | 2 | **5** | +3 | 3.1% |

**核心修复**：
- **Uncommon 不再当垃圾场** — 28 个"一次性触发"成就从 Uncommon 降为 Common，与现有 Common（first_shot、tool_time 等）门槛对齐。覆盖：首次 permission 调整/MCP 连接/图片分享/Plan 模式/code review/PR/skill/hook/force push/kill -9 等。
- **Rare 更 Rare** — 12 个中度门槛降为 Uncommon（error_resilient、file_purger、regex_sorcerer、hold_my_beer、ill_do_it_myself 等），2 个高门槛升为 Epic（token_titan 10M、session_centurion 300）。
- **Epic 纠偏** — `cerberus`（2 条管道命令）Epic→Common，`minimalist`/`novelist`（短/长消息）Epic→Uncommon。这些是 Epic 中最名不副实的。
- **Mythic 扩容** — `streak_100`（连续 100 天）、`cycle_master`（10 次全流程）、`failure_mother`（累计 100 次失败）从 Legendary 升为 Mythic——真正的"几乎不可能"。

### Steam 调研驱动新增 2 成就 + 文档同步 — 2026-06-01

- **avengers_assemble（复仇者集结）** — `agent.spawn` distinct_count(`agent_type`) == 6。Spawn 过恰好 6 种不同类型 agent（致敬初代复仇者六人组）。Epic，set: agent_commander（5→7）。
- **skill_adept（技多不压身）** — `skill.invoke` distinct_count(`skill_name`) >= 5。调用过 5 种以上不同 skill（全新事件 `skill.invoke` 首次使用）。Rare，set: creators_forge（5→6）。
- 基于《12-Steam游戏成就设计调研》21 款游戏分析，从 25 个提案中筛选 2 个无重叠新增。

### Dashboard 新用户体验 + 配色升级 — 2026-06-01

- **入门引导卡片** — 0 成就新用户自动展示 6 个一步可得的 onboarding 成就 + 如何获取的指引文字，中英双语。解锁任何成就后自动消失，reset 后重新出现。
- **一行代码一键重置成就** — Nav 栏 🗑 按钮，POST `/api/reset`，带 CSRF token（`crypto.randomBytes` + `<meta>` 注入 + `x-dev-token` header 校验）。Reset 同时清理 `showcase.json` + 防御 showcase 展示前 unlocked 校验。
- **Modal 单语言显示** — 修复之前 modal 同时显示中英文的 bug，现在严格跟随当前语言模式，缺失时 fallback 到另一种语言。
- **解锁卡片名称发光** — `--card-color` CSS 变量 + `@keyframes name-glow` 呼吸动画，按稀有度着色发光（锁定的卡片无效果）。
- **稀有度配色全面换新** — Common 浅蓝、Uncommon 深蓝、Rare 金黄、Epic 橙、Legendary 紫、Mythic 红（不变）。cold→warm→hot 递进逻辑。
- **Dashboard 版面紧凑化** — Hero/引导/Grid 各区段 padding & gap 收紧，减少不必要的 vertical 留白。

### 成就扩展 +19（138→160）— 2026-06-01

- **事件覆盖型 +15** — 覆盖 `automode.start`、`mcp.connect`、`task.create`、`task.update`、`error.occurred`、`file.delete`、`image.upload`、`deepseek.conversation` 等 10 个全新事件类型。新增 `dual_wielder`（单 task 多工具）、`token_1m`（百万 token）、`test_centurion`（100 测试通过）等。
- **科幻片彩蛋 ×3** — 《Alien》异形（首次 spawn sub-agent）、发条橙（automode 3 次）、第五元素（单 task 5 种工具）。
- **Skyrim 彩蛋 ×1** — 龙裔（阅读 337 个不同文件，致敬冬堡学院藏书）。使用 `distinct_count file.path` 新维度。
- **模型品牌成就 ×3** — 鲸歌（DeepSeek）、通信的数学理论（Claude）、花朵（GPT），使用 `task.complete` + filter `model contains`，首次引入 `matchFilter` 的 `context.model` 字段。
- **matchFilter 上下文扩展** — 从 8 字段增至 11 字段（+model/+day_of_week/+duration_ms），解除 P1 遗留项。
- **总成就数**：109→138→153→157→**160**（+51 from 5月30日至今），**测试 110 个** ✅

### Set 系统重构 + Hidden 重组 + Modal 动画升级 — 2026-06-01

- **Set 系统重构** — 9→10 个 set，全部添加 `name_cn`，套装页中英双语切换。`git_flow`（7→9）、`agent_commander`（5→6）、`polar_night`（2→4）扩充。`collectors_soul`/`devops_triad`/`night_shift` 解散，成员归入合理 set。57/160 有归属。
- **Hidden 分类重组** — 41→21（26%→13%），25 个成就重新归类到 tool_mastery（+10）、milestones（+3）、style（+2）、workflow（+2）等。剩余 21 个全是真彩蛋。
- **Modal 入场 5 层动画** — backdrop blur 淡入、container spring pop-in（scale+.blur）、icon 弹跳回旋、内容 staggered reveal、✕ 按钮旋转弹入。
- **Modal 退场动画** — container shrink+blur out、backdrop 渐变消失，JS closeModal 400ms 延迟。
- **Modal 状态标识** — 解锁卡片显示金色呼吸 "✓ 已解锁"，未解锁卡片显示灰色 "未解锁"，右对齐于成就名右侧。隐藏成就详情默认隐藏，支持 "查看描述/隐藏描述" 按钮切换，中英双语。
- **SetDefinition +name_cn** — types.ts、yaml-parser.ts、api.ts、app.js 全链路透传 set 中文名。

### 成就名称全面升级（Steam 化）

通过 `/customize` 页面整体过了一遍 138 个成就的英文名、中文名和描述。

- **英文名 Steam 化** — 大量改用 pop culture 梗：`Ghost in the Shell`、`Copy-Paste is All You Need`、`Command & Conquer`、`Smooth Criminal`、`Not Invited to Party` 等
- **`name_cn` 基本全覆盖** — 之前大量缺失中文名，现在几乎每个成就都有中文名
- **描述去冗长** — 删掉主观抒情，保留客观陈述，该幽默的地方保留
- **`streak_30` 名字回正** — `Streak 3` → `Streak 30`，与 `condition.value: 30` 一致
- **`Hold My Beer` 去感叹号** — 避免裸 YAML 解析风险

### 新增 Customize 页面

独立于 Dashboard 的成就名称编辑器，路由隔离，支持文本安全的 YAML 写回并保留注释。

- 4 个新文件：`customize-api.ts`、`customize.html`、`customize.css`、`customize.js`
- YAML 注入防护 + 防 XSS（textContent 而非 innerHTML）

### 138 条描述中译英 + description_cn 字段

- **`description`** — 138 条全替换为英文翻译，与 Steam 化新名称风格统一
- **`description_cn`** — 新增字段，保留原始中文描述
- **Dashboard 双语完整** — 中文模式显示中文描述，英文模式显示英文描述，不再是同一种语言
- 零代码变更（YAML-only），全线测试通过

## [0.1.5] — 2026-05-31

### Evaluator Bug 修复

代码审查发现并修复 6 个问题，3 个新增测试覆盖（106→109）。

- **streak event_level 时间窗口取反** — `evaluator.ts:367`: `!sessionWindow` → `sessionWindow`，与所有其他 evaluator 一致。`uncanny_accuracy` 成就受益
- **same_target event-level streak 计数总次数而非连续次数** — `evaluator.ts:347-356`: 重写跟踪算法，检测不同字段值出现时重置计数器
- **distinct_count 忽略 operator** — `evaluator.ts:491`: 始终 `>=` → 改用 `evalOp()`，支持全部 5 种操作符
- **evalRatio 缺少 scope/window/filter** — `evaluator.ts:623+`: 添加 `scopeEvents()` + time window + custom filter + role，与所有其他 evaluator 对齐
- **Hermes 会话 ID 死代码** — `hook.ts:413-414`: 空 if 块 → 从 event log 反向扫描恢复 session_id
- **numerator/denominator 不支持嵌套 Condition 对象** — `yaml-parser.ts`: 新增 `parseConditionField()` 处理 `Condition | string` 两种类型

## [0.2.0] — 2026-05-31

### OpenClaw Auto-Track

OpenClaw 从"仅 MCP + 指令文件"升级为完整的 auto-track 支持，与 CC / Hermes 对齐。

- **`openclaw-auto` 命令** — hook.ts 新增 stdin pipe 模式，翻译层（事件名/工具名/字段名）→ CC 标准 `HookStdin` → `mapEvents()` 复用
- **OpenClaw TS 插件** — `init.ts` 生成 `~/.openclaw/extensions/agpa-track.ts`，注册 5 个 hook（session_start/end、before/after_tool_call、agent_end），异步 spawn hook.ts + stdin pipe，unref'd 不阻塞主进程
- **幂等注入** — `injectOpenClawPlugin()` 检测 `agpa-openclaw-track` 标记，不重复注入
- **`agent.end` 事件类型** — `EventType` 联合新增，`agent_end` hook 独立路由（不经过 `mapEvents()`）
- **工具名映射** — `read_file`→`Read`, `write_file`→`Write`, `apply_patch`→`Edit`, `bash`→`Bash`, `glob`/`grep`
- **+25 测试** — 翻译层全量覆盖（事件名×5、工具名×7、字段映射×5、集成×5、边界×3），81→106 tests

### Dashboard UX Overhaul

Dashboard 从"功能骨架"升级为"可日常使用的成就浏览器"。

- **搜索框** — 实时过滤成就，搜 ID / 英文名 / 中文名 / 描述，输入框带清除按钮。空结果友好提示
- **排序下拉** — 4 种排序：默认（YAML 定义序）/ 稀有度 ↓ / 最近解锁 / A → Z
- **稀有度筛选** — 一排 rarity pills（All + 6 级），可与分类筛选叠加
- **成就详情 Modal** — 点击任意卡片弹出：完整图标 + 名称 + 中英双语描述 + 稀有度/分类标签 + 进度条（未解锁）+ 解锁时间（已解锁）。Esc 或遮罩关闭
- **10s 自动轮询** — 静默拉取 `/api/data`，新解锁成就 → Toast 通知 + 自动刷新界面（Modal 打开中不刷新，Toast 不影响）
- **锁定/解锁视觉重设计** — 锁定卡：`grayscale(85%)`（冻结灰阶） + 色条统一灰 + 无稀有度 glow。已解锁卡：永久 ambient glow + `✓ Unlocked` 绿色标签 + icon-wrap 高亮边框
- **Showcase 显示名称** — 展示柜格子从纯 icon → icon + 成就名称两行，76px → 90px 宽高
- **`engine.reload()`** — Dashboard 每次请求从磁盘重读 state + events，修复"明明有解锁却显示 0%" bug
- **`iconHtml()` 渲染函数** — 统一 9 处渲染点：emoji → `<span>`，图片路径 → `<img>`（`image-rendering: pixelated`）。icon 切换只需改 YAML，零代码改动
- **YAML icon 对象格式** — parseIconField 支持 `icon: { src: "pixelart/x.png" }`，兼容原有 emoji 字符串
- **UI 微调** — Level ring 移除，hero-section 最小高度 92vh → 60vh，暗色模式 emoji `brightness(1.15)`

### Percentile 子系统移除

Percentile 依赖社区数据做排名评估，与"个人成就系统"定位不符。整体移除，改用绝对数值。

- **2 成就改写** — Minimalist（`threshold` + `metric: "length"` + ≤80 字符）、Novelist（≥500 字符）
- **AGENTS.md** — 新增 `conversation.message` + `{ length }` 手动 track 指令
- **types.ts** — `ConditionType` 从 12 种缩减为 11 种（移除 `percentile`）
- **evaluator.ts** — 删除 `evalPercentile`（~50 行）、`FALLBACK_THRESHOLDS`、`computeMetric`（~40 行）、`fs`/`path` imports
- **engine.ts** — 移除 `runTelemetry` import + `poll()` 内遥测调用
- **文件删除** — `src/telemetry.ts` + `src/server/stats-server.ts`（零消费者）
- **效果** — 2 个 P1 HOLD 中的 percentile 项清零，代码净删 ~180 行

### 文档更新

- **CLAUDE.md** — 架构图从双线改为两通道对比图（MCP 主动调用 vs Hook 自动触发），加 Hook CLI 三工具对照表
- **`docs/multi-tool-research.md`** — OpenClaw 节从"调研完成暂不做"→"方案已定待实现"→现已实现，补数据流图、为什么不能复用 CC/Hermes、工具名映射表

### 架构要点

OpenClaw 与 CC/Hermes 本质区别仅在于数据如何到达 hook.ts：
- CC/Hermes：hook 管理器 spawn 子进程 + stdin pipe（操作系统行为）
- OpenClaw：我们的 TS 插件在 `api.on()` 回调中自己 spawn 子进程 + stdin pipe

翻译层和 `mapEvents()` 三者完全共享。CC / Hermes 零影响。

### Tech Stack Unchanged

Runtime: tsx, MCP: @modelcontextprotocol/sdk, Parsing: yaml, Validation: zod, Testing: vitest (106 tests, 6 files, all passing)

---

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

### Condition `unit` Field

- **Parser no longer drops `unit`** — 6 achievements now retain `unit: day` / `unit: tokens` metadata

### Hermes Agent Auto-Track

- **`hermes-auto` command** — translates Hermes stdin JSON → CC format via mapping tables (event names + tool names + field names)
- **Shell hook injection** — `init.ts` injects 4 hooks (pre_tool_call, post_tool_call, on_session_start, on_session_end) into `~/.hermes/config.yaml`
- **CC unchanged** — all existing CC paths untouched; Hermes has independent pipeline

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
