# AGPA 开发进度

> 最后更新: 2026-06-10

## 总体状态

v0.1.8 完成。25 个 CLI 命令，5 个 Agent 双通道覆盖，**201 个成就**，**1041 个测试（1038 通过 / 42 文件）**。

**本次新增 (2026-06-09 Legendary/Mythic 卡片动画 + 称号 & 徽章):**
- **Legendary 呼吸光效**：成就网格卡片 4s 边框光晕呼吸脉冲（`legendary-breathe`），与 `name-glow` 叠加
- **Mythic 烟花动画**：`::before` 3 粒子 box-shadow 循环 + `::after` 径向渐变底光，2.5s 周期
- **简化模式兼容**：`syncSimpleAnim()` → `<body data-simple-anim>`，CSS `:not()` 选择器精确控制
- **称号系统**：从已完成套装 reward 提取 title，金色 pill `·` 分隔，Hero 统计行上方渲染
- **徽章系统**：从已完成套装 reward 提取 badge，圆角 pill 标签 + hover 金色辉光
- **空态引导**：0 称号+0 徽章时中英双语斜体提示
- **零后端改动**：YAML reward → `buildSetsResponse()` → `SetItem.reward` 管道已有，纯前端消费
- **涉及文件**：`styles.css` +146 行 / `app.js` +60 行 / `index.html` +3 行

**之前新增 (2026-06-08 成就审计系统 Phase 1 + 2):**
- **Phase 1 规则引擎** (`src/verify/auditor.ts` 已有) — Layer A（数值/窗口/操作符）+ Layer B（语义模式）的自审计，51 测试
- **Phase 2 LLM 审计脚本** (`scripts/audit-achievements.ts`) — 双 Provider（Anthropic/OpenAI），智能分批 20，默认仅审计 102 个 flagged 成就，结构化报告 + dry-run 模式，38 测试
- **测试扩展**：924 → 962（+38），35 → 36 文件

**本次新增 (2026-06-08 全面审视):**
- **Bug 修复**：`evalPredicate` `<`/`>` fail-safe、`file.create` birthtime 检测、CSS keyframes 冲突、crypto.randomUUID 去重
- **测试扩展**：新增 7 个测试文件（init/verify/customize-api/server/doctor/uninstall/import），550→722 测试
- **主题常量提取**：`src/utils/theme.ts` 共享 ANSI/RARITY/RARITY_HEX/RARITY_RANK/RARITY_LABELS，消除 ~80 行重复
- **`agpa uninstall`**：卸载命令，`--all`/`--dry-run`/`--keep-data`，清 MCP/Hooks/指令/插件/命令/数据 6 类
- **跨平台通知**：Linux notify-send 点击 action + category，Windows 原生 ToastNotification + MessageBox 回退
- **macOS 通知**：JXA NSUserNotification 点击跳转 Dashboard，init 自动 brew install terminal-notifier
- **Dashboard 导出按钮**：📦 Export 一键下载完整 JSON 备份
- **`createEngine` 去重**：`src/engine/factory.ts`，showcase/search/suggest 消除重复

**本次新增 (2026-06-07):**
- **✨ Gacha Reveal 抽卡动画**：替换纯文字 Toast，6 级稀有度渐进式翻牌动画（Common→Mythic）
- Common/Uncommon：缩放入场 + 辉光脉冲；Rare+：CSS 3D 卡片翻转；Epic+：Canvas 粒子爆发 + 冲击环 + 边缘辉光
- Legendary：屏幕震动 + 60 星尘粒子 + 拖尾轨迹；Mythic：从天而降 + 落地冲击波 + 100+ 金红粒子爆炸
- **多成就排队**：按稀有度降序逐一播放，点击跳过当前 / Esc 跳过全部
- **简化模式开关**：导航栏 ✨/🎴 切换，关闭后所有稀有度统一淡入（配置持久化）
- 新文件 `gacha-reveal.js`（GachaQueue + GachaReveal + ParticleSystem）+ ~235 行 CSS（overlay/3D flip/keyframes）
- 配置后端：`simple_animations` config 字段 + API 端点
- AGPA Logo 像素画：128×128，`>_` 绿色 + 思考云蓝白色 + PS4 DS4 手柄，暗/亮双主题
- Dashboard favicon、导航栏 logo（主题自适应）、分享卡片水印、README banner 全部落地
- 5 新成就：Scribe(笔耕不辍, file.write×50)、Ship It(一键发货, git.push×10)、In the Zone(心流状态, task×5/session)、Meltdown(熔断, tool.failure×5/session)、Achievement Hunter(成就猎人, unlock×50)
- 全部基于 hook 自动写入的真实事件，零手动 track 依赖
- **12 新成就 + 语言自动检测**：7 语言深度（Pythonista/Type Astronaut/Web Weaver/Bean Counter/Pointer Pilot/Ferris Fan/Go Getter）+ 2 语言广度（Smorgasbord/Full Spectrum）+ 测试里程碑 Test Champion + 时间维度 The Scheduler/Power Session
- 新套装 `linguist`（9 成员，Polyglot 称号），Endurance 5→7
- 新增基础设施：`src/utils/lang-detect.ts`（35+ 语言映射）、hook.ts 文件操作自动检测语言、evaluator matchFilter 新增 `language` 字段
- 所有事件 payload 自动注入 `hour`/`day_of_week`（替代原先仅 git.push 特有）
- 测试 519→549（+30），26 文件全绿

**之前新增 (2026-06-06):**
- Kilo Code / OpenCode auto-track 双通道：`hook.ts` 新增 `kilocode-auto` 模式 + 翻译层，`init.ts` 生成 `Bun.spawn` TS 插件
- 交互式安装流程：语言 → profile 创建 → 多选工具（↑↓ Space Enter）
- `agpa profile softwares [name]`：交互式管理每个 profile 跟踪的 Agent 软件
- Profile-tracked_tools：`profile.json` 记录，Dashboard 5 工具官方 logo 徽章展示
- Share 卡片暗/亮主题 + 中英双语跟随
- Dashboard Hero 布局：统计大字居中 → Streak + 热力图同行 → 展示柜独占行
- AGPA logo 像素画生成器（`scripts/generate-logo.ts`，PS4 手柄 + 星光）
- CLI 扩展：`agpa config`、`profile switch`、`showcase`、`search`、`suggest`、`web`
- `scanTools()` 移至 `tool-registry.ts`（init.ts + profile.ts 共用）
- 测试 484→514（+30），23 文件全绿

**之前 (2026-06-05):**
- Dashboard 分享卡片：`buildCardResponse()` API + 📸 Share 按钮 + html2canvas 截图 + PNG 下载
- 终端 ANSI 弹窗 + 进度感知：`ansi-popup.ts` × `progress-nudge.ts`
- 6 事件填空型新成就：brevity_scout 等
- 不可达成就清零：YAML 6 + evaluator 4 + 手动 track 2
- P0-1 JSONL 解析 / P1-1 Usage XP / P1-2 UserPromptSubmit / P1-3 日聚合 / P1-4 数据导出

---

## 已完成 ✅

### 核心引擎
- [x] 11 种 Condition Type：Counter、Threshold（含 field 求和 + metric 表达式）、Streak、Sequence（含 consecutive 模式）、DistinctCount（含 values 白名单）、Event、SetCompletion、Mode、SequenceCount、PatternMatch、Ratio（Percentile 已移除）
- [x] YAML 解析器加载 193 个成就定义（含 12 个事件驱动型，异步发审计已全部修复）
- [x] PendingQueue 并发安全
- [x] MCP Tools：`achievement_track`、`achievement_poll`、`achievement_stats`、`achievement_showcase`、`achievement_config`
- [x] cross-platform Notification（macOS terminal-notifier/osascript、Linux notify-send、Windows PowerShell）
- [x] 音效系统：6 级稀有度 8-bit WAV 音效 + `agpa sound on|off` CLI + Dashboard 🔊/🔇 开关
- [x] state.json 持久化

### Dashboard (Web UI)
- [x] 4 个 section：Profile Hero（等级环 + XP bar + 展示柜）、成就网格、套装卡片、时间线
- [x] 暗/亮主题切换（iOS 风格 switch 开关）
- [x] 中/英文切换（成就名在 `name` / `name_cn` 之间切换）
- [x] 成就按 rarity 着色（common → mythic 6 级）
- [x] 隐藏成就显示 🔒 + "???"
- [x] 进度条显示（有 `progress_trackable` 的成就）
- [x] 分类过滤、已解锁/未解锁过滤
- [x] Toast 弹窗（5 分钟内新解锁的成就）
- [x] 展示柜（profile hero 中的 6 个槽位）
- [x] 🔥 Streak 卡片 — 当前连续天数 + 历史最高 + 今天活跃状态（XP bar 下方）
- [x] 📊 活动热力图 — GitHub 风格 4 个月贡献图，分位桶自适应染色，CSS Grid 渲染

### Init CLI (`agpa init --tool <tool>`)
- [x] 5 工具全部支持

| 工具 | 配置格式 | 状态 |
|------|---------|------|
| Claude Code | JSON (`~/.claude/settings.json`) | ✅ MCP + CC hooks |
| Kilo Code | JSON (`~/.config/kilo/config.jsonc`) | ✅ MCP + TS 插件 |
| Hermes Agent | YAML (`~/.hermes/config.yaml`) | ✅ MCP + Shell hooks |
| OpenCode | JSON (`~/.config/opencode/opencode.json`) | ✅ MCP + TS 插件 |
| OpenClaw | JSON (`~/.openclaw/openclaw.json`) | ✅ MCP + TS 插件 |
| OpenCode | JSON (`~/.config/opencode/opencode.json`) | ✅ MCP + TS 插件 |

- [x] MCP server 配置注入（JSON parse-modify-write / YAML 文本注入）
- [x] 指令文件注入（CLAUDE.md / AGENTS.md / TOOLS.md）
- [x] 幂等性检测（重复运行不重复注入）
- [x] 配置文件不存在时自动创建
- [x] 损坏配置文件自动备份后重建

### Bug 修复
- [x] 成就套装显示"空"：YAML `set:` 字段未映射到 `set_id:`（yaml-parser.ts）
- [x] KiloCode 配置路径错误：`kilo.jsonc` → `config.jsonc`
- [x] Hermes YAML 数据丢失风险：从 parse-modify-write 改为文本注入

### 文档
- [x] `docs/multi-tool-setup.md`：5 工具 MCP 配置指南、指令文件兼容矩阵、auto-track 策略

---

## 待完成 ⏳

### 高优先级
- [x] **`tool_source` 硬编码问题**：`engine.ts` 中写死为 `'claude-code'` → 改为从 MCP clientInfo 动态检测 + `AGPA_TOOL_SOURCE` 环境变量 fallback + `init.ts` 注入 env var
- [x] **展示柜管理**：点击槽位进入 pick 模式，为已解锁成就显示 📌 按钮，支持 auto-fill、点击清除
- [x] **agpa doctor 命令**：诊断数据目录、event.log、state.json、成就定义、MCP 配置、指令文件
- [x] **Claude Code Hook 自动 track**：`src/cli/hook.ts` 提供 `track`/`poll`/`auto` 命令，`init.ts` 注入 10 个 hooks（含 SessionStart/UserPromptSubmit/Stop/PostToolUse 等）到 `~/.claude/settings.json`，支持与已有 hooks 合并
- [x] **真实环境测试**：event.log 验证 hooks 正常写入，session_id 正确传递，5 工具 MCP + 指令全绿
- [x] **交互式安装**：`agpa init` 无参模式扫描工具 → 多选 → profile 创建，非 TTY 自动回退全选
- [x] **evaluator single_task 窗口**：用 task.complete 事件边界推断，不依赖 task_id
- [x] **evalThreshold metric 路径过滤**：now respects cond.event/filter/role/window
- [x] **computeMetric 扩展**：showcase_count + concurrent_sessions 分支 → 已改为 counter 可测量事件
- [x] **Surgeon 成就 payload**：hook.ts 从 Edit 的 old_string + 磁盘文件自动提取 edit_lines / total_file_lines
- [x] **路径遍历 guard**：拒绝 .. 和越界绝对路径读文件
- [x] **P1 evaluator 4 项修复**：空 conditions guard、evalMode target、set_id 删除、evalStreak窗口/field/same_target
- [x] **P2 数据一致性**：milestone 命名、set 成员补全、缺失 set 字段、im_sorry_dave 窗口
- [x] 测试覆盖：897 tests, 34 files（Phase 1 + 全面审视修复 + init/verify/customize-api/server/doctor/uninstall/import + verify/auditor）

### 中优先级
- [x] **用户审阅 193 成就清单**：已逐条 review，修复 30+ 个不一致，删除 3 个重复，新增 1 个 + 语言系列 9 个 + 时间/测试 3 个 + 关键词/节日/电池系列 10 个
- [x] **其余 3 工具的 auto-track 策略落地**

| 工具 | 策略 | 可靠性 |
|------|------|--------|
| Claude Code | Hook `SessionStart` | ⭐⭐⭐⭐⭐ |
| Hermes Agent | Shell hooks (4 events) | ⭐⭐⭐⭐⭐ |
| OpenClaw | TS 插件 (36 hooks) | ⭐⭐⭐⭐⭐ | ✅ v0.1.4 完成 |
| Kilo Code | TS 插件 (32+ events, Bun.spawn) | ⭐⭐⭐⭐ | ✅ v0.1.6 完成 |
| OpenCode | 同 Kilo Code（共用 API） | ⭐⭐⭐⭐ | ✅ v0.1.6 完成 |

### 低优先级（v1.0）
- [x] 全球统计 opt-in + 稀有度动态计算 — **暂缓（2026-06-09 决策）**。当前成就稀有度基于设计意图分级，社区规模不足时动态计算无意义。待用户量足够大后重新评估。
- [x] agpa export/import
- [x] 响应式布局（手机可看）— ✅ 6/9 完成（4 断点 desktop-first）
- [x] Legendary 呼吸光效 / Mythic 烟花动画 — ✅ 6/9 完成
- [x] 多 profile 支持

---

## 版本对比

| 维度 | MVP 原计划 | 当前实际 |
|------|-----------|---------|
| 工具支持 | Claude Code 独占 | 5 工具 init + 双通道覆盖 |
| 成就数量 | 30 个 | 193 个全部可达成 |
| Evaluator | 3 种 | 11 种全部实现 |
| Dashboard | 基础网格 | 4 section + 暗亮主题 + 双语 + 分享卡片 + 工具徽章 |
| Event Capture | CC Hook | 4 种 auto-track 模式 (CC/Hermes/OpenClaw/KiloCode) |
| Init | 手动 --tool claude-code | 交互式安装：语言 → profile → 多选工具 |
| CLI 命令 | 3 个 | 25 个命令（含 uninstall/export/import/config/showcase/search/suggest/profile/banner/activity/history） |
| Profile | — | 多 profile + tracked_tools 管理 |
| single_task 窗口 | — | task.complete 边界推断 |
