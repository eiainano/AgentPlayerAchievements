# Achievement System Issues & TODOs

> 最后更新: 2026-06-08 | 总成就数: 183 | 条件类型: 11 | Tests: 845 ✅ (33 files) | 0 不可达 ✅ | Kilo Code / OpenCode 双通道覆盖 ✅ | Logo 像素画 + Dashboard 集成 ✅ | 语言自动检测 ✅ | CLI 24 命令 ✅ | agpa uninstall ✅ | 跨平台通知增强 ✅ | macOS JXA 通知 ✅ | Dashboard 导出按钮 ✅ | 共享主题常量 ✅

---

## 🆕 系统可触发审计 & 全量修复 (v0.1.6, 6/7)

全链路审计（YAML → hook.ts → AGENTS.md → evaluator → test）发现 8 个不可达/几乎不可达成就，全部修复至 0：

### 修复清单

| 成就 | 事件 | 修复方式 |
|------|------|----------|
| `error_resilient` | `error.occurred` | hook.ts: `PostToolUseFailure` 新增 `error.occurred` 发射 |
| `file_purger` | `file.delete` | hook.ts: Bash `rm`/`unlink` 检测 → `file.delete` |
| `task_creator` | `task.create` | hook.ts: `PostToolUse` 检测 `TaskCreate` tool → `task.create` |
| `task_updater` | `task.update` | hook.ts: `PostToolUse` 检测 `TaskUpdate` tool → `task.update` |
| `multi_image_day` | `image.upload` | hook.ts: Read image 文件扩展名匹配 → `image.read` + `image.upload` |
| `visual_prompt` + `image_whisperer` | `image.read` | 同上（Read 图像文件现在也 emit `image.read`，此前仅 emit `file.read`） |
| `deepseek_dabbler` | `deepseek.conversation` | engine.ts: `track()` 中检测 `currentModel` 含 'deepseek' → 每 session 发一次 |
| `its_learning` | `conversation.message` | YAML: role `agent`→`assistant` + pattern `humor_detected`→真实可匹配内容 |
| `dashboard_visitor` | `dashboard.opened` | ✅ 已有（dashboard server L153 auto-track） |

### tool.deny 已知限制（仍依赖手动 track）

`tool.deny` 无 hook auto-track（PreToolUse → tool.requested 仅记录请求，拒绝由用户操作决定）。受影响：`ill_do_it_myself` / `the_negotiator` / `im_sorry_dave` — 需 agent 手动 track。`full_auto` — `tool.deny == 0` 条件因无事件而永真，解锁比设计意图更容易。

## 🆕 本次新增 — 5 新成就 (v0.1.6, 6/7)

基于事件利用率分析，选择 5 个 hook 自动写入但无成就覆盖的真实事件：

- **tool_mastery** — `scribe` (Scribe/笔耕不辍)，file.write×50，Common
- **workflow** — `shipper` (Ship It/一键发货)，git.push×10，Common，set: git_flow
- **challenge** — `in_the_zone` (In the Zone/心流状态)，task.complete×5/single_session，Rare
- **hidden** — `meltdown` (Meltdown/熔断)，tool.failure×5/single_session，Uncommon
- **community** — `achievement_hunter` (Achievement Hunter/成就猎人)，achievement.unlocked×50，Rare，set: completionist
- 测试自动覆盖 +5，183 成就/549 测试/22 文件全绿

---

## 🆕 本次新增 — Kilo Code / OpenCode 双通道 + 交互式安装 + CLI 扩展 (v0.1.6, 6/6)

5 个工具全部实现 MCP + auto-track 双通道覆盖，24 个 CLI 命令：

- **Kilo Code / OpenCode auto-track** — `hook.ts` 新增 `kilocode-auto` 模式（`KILOCODE_EVENT_MAP` + `KILOCODE_TOOL_MAP` + `normalizeKilocodeStdin()`），init.ts 生成 `Bun.spawn` 驱动的 TS 插件，监听 `tool.execute.before/after` + `event` 32+ 事件
- **交互式安装** — 语言 → profile 创建 → 多选工具（↑↓ Space Enter），非 TTY 自动回退
- **Profile-tracked_tools** — `agpa profile tools [name]` 交互式管理，`profile.json` 记录，Dashboard 5 工具官方 logo 徽章 + 暗亮主题双语
- **CLI 扩展** — `agpa config` / `profile switch` / `showcase` / `search` / `suggest` / `web`，共 24 命令
- **Share 卡片主题化** — 暗/亮 + 中/英跟随 Dashboard，480px 现代化设计
- **Hero 布局** — 统计大字居中 → Streak(紧凑) + 热力图同行 → 展示柜独占行
- **AGPA logo** — `scripts/generate-logo.ts`，PS4 手柄 + 星光像素画
- **安全** — `--profile` CLI 验证 + config 测试隔离 + XSS defense-in-depth
- 测试 484→514（+30 KiloCode 翻译），23 文件全绿

## 🎉 本次实施 — 不可达成就全面清零 + 测试覆盖 446 (v0.1.6, 6/5)

Phase 1-3 全线实施完毕后，集中扫清 11 个不可达成就并大幅扩展测试：

### 不可达成就修复（11 个 → 0）

**YAML Bug（6 个）**
- `streak_3/7/30/100` + `daily_checkin` — 缺 `window: all`，默认 24h 窗口下日历连续天成就永不可达。补上 `window: all`。
- `mcp_explorer` — `distinct_count` 缺 `field: server_name`，无法区分不同事件。

**Evaluator Bug（4 个）**
- `completionist_bronze/silver/gold/mythic_completionist` — `evalSetCompletion` 不排除 `future: true` 成就，永远缺 2 个不可达成就导致完成不了。

**手动 track 补全（2 个）**
- `automode_first` / `mcp_first_connect` — 去掉 `future: true`，AGENTS.md + init.ts 新增 `automode.start` / `mcp.connect` 手动 track 指令。

**新增场景矩阵 + 逐成就触发测试（+296 tests）**
- **Approach A** — `integration.test.ts` 全面重写，6 个真实 Agent 使用场景回归保护
- **Approach B** — `every-achievement.test.ts` 每个成就自动生成最小触发事件验证解锁，160/160 全可达
- **Phase 1 纯函数覆盖** — 6 新文件（config/helpers/engine/errors/validate/timeline）+81 tests
- **测试总量**: 150 → 446 (18 文件, 全绿)

---

## 🆕 本次新增 — Dashboard 分享卡片 (v0.1.6, 6/5)

Dashboard 新增 📸 Share 按钮，生成 Steam 风格成就卡片 PNG：

- `src/dashboard/api.ts` — `buildCardResponse()` 聚合 stats + 展示柜 + 热力图 + 里程碑
- `src/dashboard/server.ts` — 注册 `GET /api/card` 路由
- 前端 — 隐藏 DOM 渲染 + html2canvas 截图 + 浏览器下载（960px @2x）
- 支持中英双语、进行中成就补位、稀有度分布
- 新增 6 个 API 测试

## 🆕 本次新增 — 终端 ANSI 弹窗 + 进度感知 (v0.1.6, 6/5)

基于方案 B 设计文档，两阶段（ANSI popup + progress nudge）全部落地：

- `src/utils/ansi-popup.ts` — ANSI 256 色 Unicode 框线卡片，6 级稀有度着色，最多 5 张/次
- `src/utils/progress-nudge.ts` — 近锁成就计算器，支持 counter/threshold/streak/distinct_count/sequence_count 5 种类型
- `src/cli/hook.ts` `cmdPoll()` — Stop hook 触发时同时输出 popup + nudge
- Non-TTY 自动跳过，纯文本 fallback 不受影响
- 新增 26 个测试（12 popup + 14 nudge）

## 🆕 本次新增 — 6 事件填空型新成就 (v0.1.6, 6/5)

基于事件利用率分析，针对 `user.prompt` 和 `agent.self_fix` 两个缺口填充：

**user.prompt 系列（5 个，hook auto-track）**
- `brevity_scout` — 5 次 prompt < 10 词，Common style
- `executive_summary` — 25 次 prompt > 100 词，Uncommon style
- `code_talker` — 10 次含代码块，Uncommon style
- `no_questions_asked` — 3 次无问号，Uncommon hidden
- `infinite_details` — 累计 50,000 字符，Rare style progress_trackable

**agent.self_fix 系列（1 个，manual track）**
- `self_aware` — 首次自修复，Common skill，set: bug_catcher

**Evaluator 扩展**
- `evalPredicate` 新增 `<` 和 `>` 数值比较操作符
- `matchFilter` ctx 新增 `word_count` / `has_code_block` / `has_question_mark`
- `computePromptPayload` 新增 `has_question_mark` 字段

**测试**: 446 → 452 (6 新成就全部 Approach B 验证可达)

---

## P0 — 逻辑 Bug（影响成就正确性）

- [x] **`store.reset()` 漏删 `stats.json`** — `reset()` 清理了 state/event.log/showcase.json 但漏了 stats.json，导致 reset 后 Dashboard stats 返回残留旧数据（heatmap/streak/usage_xp 异常直到下次 poll 覆盖）。修复：`store.ts` 加一行 `statsPath` 清理。（6/5 fix）
- [x] **`scopeEvents()` 单 task 泄露前序会话** — `single_task` 窗口只在有 ≥2 个 `task.complete` 时正确切片。第一次 task 时 `prevIdx = -1` → `slice(0, tc)` 跨越 session 边界，把前序 session 事件也计入"当前 task"。修复：三层边界——0 task 限当前 session，1 task 从最近 `session.start` 切片，≥2 不变。（6/5 fix）

✅ **其余全部修完。** evalStreak filter/operator、set_completion all/exclude_hidden、max_per_day、swat_team 窗口、25 个 lifetime achievement window:all。

---

## P1 — 事件覆盖缺口

✅ **全部修完。** plan.mode、storyteller 删除、agent.complete、git.revert_all。

## P1 — Hook 不提取的 payload 字段

✅ **全部修完。** file_type→image.read、language→file.language_used、function_name→function.edited、showcase_count/concurrent_sessions→改条件为 counter 可测量事件。

## P1 — Evaluator 功能缺口（2 项 HOLD）

- [x] sequence 忽略 window / evalThreshold metric 路径 / 空 conditions / evalMode target / evalStreak 事件连续 / set_id 死代码 — 全部修好
- [x] **evalPercentile 硬编码回退阈值** — 整个 percentile 子系统已移除（v0.1.4）。Minimalist/Novelist 改为 `threshold` + `metric: "length"` + AGENTS.md 手动 track。stats-server.ts / telemetry.ts 删除。
- [x] **matchFilter 上下文只有 8 个字段** — 已扩展为 11 个字段（+model、+day_of_week、+duration_ms），model 字段用于按模型品牌筛选成就（鲸歌/DeepSeek、通信数学理论/Claude、Blossom/GPT）。

---

## P2 — 数据与体验缺口

- [x] **中文描述（`description_cn`）大面积缺失** — Dashboard 双语切换已就绪，但大多数成就只有英文。通过脚本逐条翻译并添加 138 条 description_cn，中文模式下完整显示中文描述。
- [x] **Dashboard 默认 0 成就解锁** — 新用户（或 `rm state.json` 后）Dashboard 全空。解决方案：添加入门引导卡片（6 个 onboarding 成就 + 如何获取指引），解锁成就后自动消失。同时添加开发者一键重置按钮（CSRF 防护）方便测试。
- [x] **issues-todo 上次更新 5/31，跟进 6 项 evaluator bugfix** — streak window/same_target/distinct_count op/ratio scope/Hermes session/nested Condition。+3 测试（106→109）。

---

## ✅ 今日新增 — 2 个成就（v0.1.6, 6/1）

- [x] **avengers_assemble** — `agent.spawn` distinct_count(`agent_type`) == 6。需要 spawn 过恰好 6 种不同类型 agent。Epic，set: agent_commander。
- [x] **skill_adept** — `skill.invoke` distinct_count(`skill_name`) >= 5。调用过 5 种以上不同 skill（全新事件）。Rare，set: creators_forge。

---

## P3 — YAML 质量 / 资产

- [x] **Hidden 分类** — 约 35 个（183 个总成就中约 19%）。41→21→35（经过一次重归类又部分回退）。剩余 35 个全是真彩蛋。
- [ ] **手动 review 全部 183 条 pixelArtDesc** — `docs/pixel-art-ideas.md` 中每个成就的像素画描述，逐条审阅和修改。改完后重跑 `npx tsx scripts/generate-pixel-art.ts` 即可用最新描述生图。
- [ ] **像素画 icon 资产暂缺** — `scripts/generate-pixel-art.ts` 已就绪（Gemini 3.1 Nano Banana 2），`docs/pixel-art-ideas.md` 已含 171 条描述（含新 5 条待加）。下一步：review 描述 → 生成全部 171 张 → 选 The Beginning（14 个）做 Dashboard icon 试点。方案：32×32 pixel art PNG → `public/icons/` → YAML `icon: { src, alt }` → Dashboard `iconHtml()` 渲染。emoji 和 pixel art 并存，渐进替换。
- [x] **Set 名称只有英文** — 9→11 个 set，全部添加 `name_cn`，套装页中英双语切换。Set 系统重构：合并散装 set，扩充合理 set。`git_flow`（7→9）、`agent_commander`（5→7）、`creators_forge`（5→6）、`polar_night`（2→3）、`endurance`（5→7）、`linguist`（新增 9）。71/183 有归属。

---

## 今日新增 — 稀有度重平衡 + 多档案系统 + 修复（v0.1.6, 6/2）

- [x] **稀有度全量重平衡** — 49 项变更，金字塔分布：Common 21→49, Uncommon 56→45, Rare 46→30, Epic 24→24, Legendary 12→9, Mythic 2→5。
- [x] **多档案系统** — 1 default + 最多 3 命名 = 4 存档。每份独立 stateDir。Dashboard 下拉创建/切换 + CLI `npm run profile create` + MCP `achievement_config set active_profile`。Profile emoji 选择器。
- [x] **档案切换全局同步** — Dashboard 切换 → 写 config.json → MCP server 下次调用自动切换 engine。`AGPA_PROFILE` env var 硬锁定可选。
- [x] **Modal 动画 locked/unlocked 一致** — `animation:none` + `requestAnimationFrame` 重启动画，消除 unlocked 卡顿。
- [x] **P0 model 追踪修复** — context.model 从硬编码 `'auto'` → 通过 model.switch 事件动态追踪，修复 3 个模型品牌成就。
- [x] **路径穿越防护** — resolveProfileDir() 正则验证后 path.join()。
- [x] **版本同步** — main.ts 0.1.5→0.1.6, CLAUDE.md 12→11 condition types, percentile 过时说明删除。

## 已完成 — Dashboard 新用户体验 + 配色升级（v0.1.6, 6/1）

- [x] **入门引导卡片** — 0 成就时 Hero 下方展示 6 个 onboarding 成就 + 获取指引，中英双语。unlock>0 后自动消失。
- [x] **开发者一键重置** — 🗑 按钮 POST `/api/reset` + CSRF token 防护（meta 注入 + x-dev-token header）。
- [x] **Modal 单语言显示** — 修复双语泄漏，英文模式只显示英文，中文模式只显示中文。
- [x] **解锁卡片名称发光** — `--card-color` + `@keyframes name-glow` 呼吸动画，按稀有度着色。
- [x] **稀有度配色换新** — Common 浅蓝、Uncommon 深蓝、Rare 金黄、Epic 橙、Legendary 紫、Mythic 红。
- [x] **Dashboard 版面紧凑化** — 各 section padding/gap 收紧，减少 vertical 留白。
- [x] **Showcase 残留数据防御** — `store.reset()` 清理 showcase.json + `buildShowcaseResponse` 校验 unlocked。

## 已完成 — 自定义 + Steam 化命名（v0.1.6, 5/31）

- [x] **Customize 页面** — 4 个新文件，YAML 注入防护 + XSS 防护
- [x] **英文名全面 Steam 化** — pop culture 梗：`Ghost in the Shell`、`Copy-Paste is All You Need` 等
- [x] **`name_cn` 基本全覆盖** — 几乎所有成就都有中文名
- [x] **`streak_30` 名字回正** — 与 value:30 一致
- [x] **issues-todo 同步** — 6 项 evaluator bugfix 标记完成

## 已完成 — Dashboard UX Overhaul（v0.1.4, 5/31）

- [x] **搜索框** — 实时过滤，搜 ID/英文名/中文名/描述，空结果友好提示
- [x] **排序下拉** — Default / Rarity ↓ / Recently Unlocked / A → Z
- [x] **稀有度筛选** — All + 6 级 rarity pills，可与分类筛选叠加
- [x] **成就详情 Modal** — 图标 + 双语名称 + 描述 + 进度条/解锁时间。Esc/遮罩关闭
- [x] **10s 自动轮询** — 新解锁 → Toast + 静默刷新（Modal 保护）
- [x] **锁定/解锁视觉重设计** — grayscale(85%) 冻结 vs. ambient glow + ✓ Unlocked 标签
- [x] **Showcase 显示名称** — icon + 成就名两行，76→90px
- [x] **engine.reload()** — 修复 Dashboard 0% bug
- [x] **iconHtml() 渲染函数** — 统一 9 处渲染点，emoji / 图片自动适配
- [x] **YAML icon 对象格式** — `{ src, alt }` 支持，兼容字符串 emoji
- [x] **Level ring 移除** — Hero section 精简

---

## 已解决 ✓

- [x] ~~evaluator threshold 错映射到 evalCounter~~ — 5/29
- [x] ~~sequence 不支持 consecutive/count~~ — 5/29
- [x] ~~distinct_count 忽略 values 白名单~~ — 5/29
- [x] ~~counter 忽略 same_target~~ — 5/29
- [x] ~~hook 补 4 个事件映射~~ — 5/29
- [x] ~~AGENTS.md 补充 24 个手动 track 事件~~ — 5/29-5/30
- [x] ~~12 个事件驱动型新成就~~ — 5/30
- [x] ~~3 个不可达成就删除~~ — 5/30
- [x] ~~Dashboard 中英双语~~ — 5/29
- [x] ~~MCP context 硬编码~~ — 5/29
- [x] ~~10 P0 逻辑 Bug~~ — 5/30
- [x] ~~5 P1 Hook payload 字段缺失~~ — 5/30
- [x] ~~4 P1 Evaluator 功能缺口~~ — 5/30
- [x] ~~6 P2 数据一致性问题~~ — 5/30
- [x] ~~Hermes Agent auto-track~~ — 5/30
- [x] ~~OpenClaw auto-track~~ — 5/31
