# AGPA vs 生态系统：完整差距分析 & 建议表

> 日期：2026-06-05
> AGPA 版本：v0.1.6
> 调研项目：11 个 GitHub 仓库 + 3 个 Web 资源

---

## 0. AGPA 当前能力基线

| 维度 | 数据 |
|------|------|
| 成就总数 | 160（含 35 hidden, 2 future, 9 challenge） |
| 套装 (Sets) | 10 套（59 成员有归属）|
| 条件类型 | 11 种 (counter/threshold/streak/sequence/distinct_count/event/set_completion/ratio/pattern_match/mode/sequence_count) |
| 稀有度层级 | 6 级 (common/uncommon/rare/epic/legendary/mythic) |
| 类别 | 10 个 (onboarding/milestones/tool_mastery/hidden/skill/style/creator/challenge/community/workflow) |
| CC Hooks | 9 个 (SessionStart/Stop/PostToolUse/PreToolUse/PostToolUseFailure/TaskCompleted/SubagentStart/SubagentStop/PostCompact) |
| 事件类型 | ~48 个 EventType 联合成员 + string catch-all |
| MCP 工具 | 5 个 (track/poll/stats/showcase/config) |
| 数据采集通道 | 双通道 (Hook 自动 + MCP 手动) |
| Agent 工具接入 | 5 个 (CC/Hermes/OpenClaw/KiloCode/OpenCode), init CLI 一键配置 |
| Dashboard | 4 section Web 仪表板 (Hero/Grid/Sets/Timeline + streak + heatmap) |
| 测试 | ~115 tests / 7 files |
| 存储 | JSON 文件 (state.json/event.log/showcase.json/config.json/stats.json/pending.json) |
| 文件总数 | ~50+ 源文件，~5000 行代码 |
| 特色功能 | 双语 i18n / 暗亮主题 / 成就搜索+筛选+排序 / 音效系统 / 多 profile / self-customize / 热力图 |

---

## 1. 功能能力矩阵（12 项目 × 40+ 维度）

"✅" = 已实现, "⚠️" = 部分实现, "❌" = 未实现

### 1.1 数据采集层

| 能力 | AGPA | cc-lens | bashstats | cc-prof | guide | CCA | history-viewer | WakaTime | VibeDashboard | quest | level-up | @levelup-log | codex-mcp |
|------|------|---------|-----------|---------|-------|-----|---------------|----------|--------------|-------|---------|-------------|----------|
| **Hook 事件采集** | ✅ 9 hooks | ❌(纯文件读取) | ✅ 12 hooks | ✅ 1 hook | ✅ 3 hooks | ✅ 3 hooks | ❌ | ✅ 全hooks | ❌ | ✅ 5 hooks | ❌ | ❌ | ❌ |
| **MCP track 手动** | ✅ 5 tools | ❌ | ✅ MCP query | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 75 tools | ✅ 4 tools | ✅ 8 tools |
| **JSONL 文件解析** | ❌ | ✅(核心) | ⚠️(Stop时) | ✅(核心) | ❌ | ❌ | ✅(核心,9格式) | ❌ | ❌(间接) | ❌ | ❌ | ❌ | ❌ |
| **实时文件监控** | ❌ | ❌(5s poll) | ❌ | ❌ | ❌ | ❌ | ✅(notify debounce) | ❌ | ❌(GitHub Actions) | ❌ | ❌ | ❌ | ❌ |
| **外部服务心跳** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(WakaTime) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Git hook 采集** | ⚠️(Bash检测) | ❌ | ❌ | ❌ | ❌ | ⚠️(Bash检测) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **跨工具归一化** | ✅(5工具) | ❌(仅CC) | ✅(3工具) | ❌(仅CC) | ❌(仅CC) | ❌(仅CC) | ✅(9工具) | ❌(仅CC) | ⚠️(CC+OpenCode) | ❌(仅CC) | ❌(通用) | ❌(通用) | ❌(仅Claude) |

**AGPA 优势:** 唯一同时具备 Hook 自动 + MCP 手动双通道的系统；唯一为 5 个工具提供一键 init 的系统。
**AGPA 劣势:** 缺少 JSONL 文件解析——这是获取精确 user message 计数、token 用量、session 时长的最可靠来源（cc-lens/history-viewer/cc-proficiency 都用此方式）。

### 1.2 统计与聚合层

| 能力 | AGPA | cc-lens | bashstats | cc-prof | guide | CCA | history-viewer | WakaTime | VibeDashboard | quest | level-up | @levelup-log |
|------|------|---------|-----------|---------|-------|-----|---------------|----------|--------------|-------|---------|-------------|
| **Session 计数** | ✅(stats.json) | ✅ | ✅(SQLite) | ⚠️(间接) | ✅(game-data.json) | ❌ | ✅ | ❌(WakaTime托管) | ❌ | ✅(quest.json) | ❌ | ❌ |
| **用户消息计数** | ⚠️(MCP track,不可靠) | ✅(JSONL 解析) | ✅(UserPromptSubmit hook) | ❌ | ⚠️(间接) | ❌ | ✅(JSONL 解析) | ❌ | ❌ | ⚠️(rebind) | ❌ | ❌ |
| **Token 使用统计** | ❌ | ✅(JSONL + usage-data) | ✅(Stop hook JSONL) | ❌ | ✅(Stop hook) | ❌ | ✅(JSONL 解析) | ❌ | ✅(ccusage) | ❌ | ❌ | ❌ |
| **成本估算** | ❌ | ✅(per-model pricing) | ⚠️(仅total_cost) | ❌ | ❌ | ❌ | ✅(client-side) | ✅(WakaTime托管) | ✅(ccusage) | ❌ | ❌ | ❌ |
| **工具使用排行** | ❌ | ✅(工具排名) | ✅(tool breakdown) | ❌(仅聚合) | ✅(per-feature计数) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **模型分布** | ❌ | ✅(model donut) | ❌ | ❌ | ❌ | ❌ | ✅(per-turn) | ❌ | ✅(model bars) | ❌ | ❌ | ❌ |
| **日聚合缓存** | ❌ | ❌(实时计算) | ✅(daily_activity表) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **周/月聚合** | ❌ | ⚠️(date filter) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️(period filter) | ❌ | ❌ | ❌ |
| **项目级统计** | ❌ | ✅(project detail) | ✅(project breakdown) | ✅(per-project 评分) | ❌ | ❌ | ✅(project tree) | ❌ | ❌ | ✅(per-project level/xp/quests) | ❌ | ❌ |
| **多机器合并** | ❌(仅单机profile) | ❌ | ⚠️(bashstats sync) | ❌ | ❌ | ❌ | ❌ | ⚠️(多端汇总) | ✅(multi-source merge) | ❌ | ❌ | ✅(central DB) |
| **Session 时长** | ⚠️(timestamp 推算) | ✅(JSONL 首末) | ✅(started_at/ended_at) | ✅(session duration) | ❌(仅count) | ❌ | ✅(JSONL timestamp) | ✅(heartbeat) | ❌ | ❌ | ❌ | ❌ |
| **文件编辑追踪** | ⚠️(file.edit事件) | ✅(recent files) | ❌ | ⚠️(仅计数) | ❌ | ❌ | ✅(recent file edits) | ❌ | ❌ | ❌ | ❌ | ❌ |

**AGPA 优势:** stats.json 是轻量缓存层的正确方向；多 profile 隔离做得最完善。
**AGPA 劣势:** Token 统计和成本估算是零；没有工具使用排行；缺少日聚合导致大量事件时性能下降。

### 1.3 游戏化与进程层

| 能力 | AGPA | cc-lens | bashstats | cc-prof | guide | CCA | history-viewer | quest | level-up | @levelup-log | codex-mcp |
|------|------|---------|-----------|---------|-------|-----|---------------|-------|---------|-------------|----------|
| **一次性成就** | ✅ 160 | ❌ | ✅ 124 badges | ✅ 18 | ❌ | ✅ 29 | ❌ | ❌(quest-based) | ✅ 54 | ✅ 15类 | ❌ |
| **Tiered 成就(铜→银→金)** | ❌ | ❌ | ✅(5 tiers/badge) | ❌(仅18个) | ❌(段位带) | ❌ | ❌ | ❌(quest级别) | ⚠️(段位系统) | ⚠️(15 titles) | ❌ |
| **段位/段位带** | ❌ | ❌ | ❌(rank≠belt) | ❌ | ✅(7 belts) | ❌ | ❌ | ❌ | ✅(6段位) | ❌ | ❌ |
| **Level 系统** | ✅(sqrt XP) | ❌ | ✅(500 ranks) | ❌(仅score) | ✅(5 levels) | ❌ | ❌ | ✅(per-project) | ✅(30+ 轨道) | ✅(age=level) | ✅(simple XP) |
| **XP 系统** | ⚠️(仅成就XP) | ❌ | ✅(成就+活动) | ❌ | ❌(score≠XP) | ❌ | ❌ | ✅(25XP/quest) | ✅(complex公式) | ✅(5-500XP) | ✅(25+bonus) |
| **Usage-based XP** | ❌(只有成就XP) | ❌ | ✅(daily_activity) | ❌ | ✅(usage×multiplier) | ❌ | ❌ | ✅(25XP/task) | ✅(75 tools) | ❌ | ✅(completion) |
| **套装(Set)** | ✅ 10 sets | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **隐藏成就** | ✅ 35 hidden | ❌ | ✅ 17 secret | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Weekly goals** | ❌ | ❌ | ✅(hash-generated) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(quests) | ❌ | ❌ |
| **反刷分机制** | ❌ | ❌ | ❌ | ✅(maxPerSession/bucket caps) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **反模式检测(罚分)** | ❌ | ❌ | ❌ | ✅(anti-pattern rules) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **相位/新手加权** | ❌ | ❌ | ❌ | ✅(Phase-weighting) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **斐波那契 nudge** | ❌ | ❌ | ❌ | ❌ | ✅(会话1,2,3,5...) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **feature 依赖图** | ❌ | ❌ | ❌ | ❌ | ✅(需要前置解锁) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **图标/徽章渲染** | ✅(emoji/pixel) | ❌(纯数据) | ✅(SVG icons) | ✅(SVG badge) | ❌ | ✅(emoji) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **通知系统** | ✅(cross-platform) | ❌ | ❌ | ❌ | ❌ | ✅(osascript/notify-send) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **音效** | ✅(6 rarity WAV) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **主题切换** | ✅(dark/light) | ✅(dark/light) | ❌ | ❌(SVG theme) | ❌ | ❌ | ❌ | ✅(pokemon/storybook...) | ❌ | ❌ | ✅(narrator) |

**AGPA 优势:** 成就系统最丰富——160 个 vs 最接近的 bashstats 124 个；套装系统独一无二；隐藏成就 + 音效是情绪化设计的标杆。
**AGPA 劣势:** Tiered 成就缺失——bashstats 的 124×5=620 个解锁点远优于 160 个一次性成就；无 usage-based XP；无反刷分机制。

### 1.4 Dashboard 与 UI 层

| 能力 | AGPA | cc-lens | bashstats | cc-prof | history-viewer | quest | VibeDashboard |
|------|------|---------|-----------|---------|---------------|-------|--------------|
| **成就网格** | ✅(filter+sort+search) | ❌(无成就系统) | ✅(achievement tab) | ❌(SVG only) | ❌(CLI table) | ❌(RPG地图) | ❌(SVG card) |
| **进度条** | ✅ | ❌ | ✅(tier progress) | ⚠️(score bar) | ✅(level progress) | ✅(quest progress) | ❌ |
| **统计卡片** | ✅(Hero stats) | ✅(多卡片) | ✅(多卡片) | ❌ | ❌(CLI table) | ✅(trainer hall) | ✅(token/cost) |
| **时间线** | ✅ | ❌ | ✅(session log) | ❌ | ❌ | ❌ | ❌ |
| **热力图** | ✅ | ✅(GitHub style) | ✅(activity heatmap) | ❌ | ❌ | ❌ | ✅(daily bar) |
| **Streak 追踪** | ✅ | ✅(activity streak) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **搜索** | ✅(CMD+K 实时) | ✅(FlexSearch global) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **导出** | ❌ | ✅(Export JSON) | ❌ | ❌(Gist sync) | ❌ | ❌ | ❌(JSON push) |
| **多语言** | ✅(zh/en) | ✅(5 languages) | ❌(EN only) | ✅(SVG multi-lang) | ❌ | ❌ | ✅(3 languages) |
| **公共资料页** | ❌ | ❌ | ✅(bashstats.com) | ❌ | ❌ | ❌ | ❌ |
| **CLI 仪表板** | ✅(agpa stats) | ❌(web only) | ❌(web only) | ✅(CLI bar chart) | ✅(CLI table) | ✅(CLI rich) | ❌(GitHub Actions) |
| **桌面应用** | ❌(web only) | ❌(web only) | ❌(web only) | ❌(SVG file) | ❌(CLI only) | ❌(web server) | ❌(SVG card) |
| **leaderboard** | ❌ | ❌ | ✅(bashstats.com) | ❌(share gist) | ❌ | ❌ | ❌(readme card) |
| **Session 回放** | ❌ | ✅(replay parser) | ❌ | ❌ | ✅(session replay) | ❌ | ❌ |

**AGPA 优势:** Dashboard 功能密度最高——唯一兼备成就网格+统计卡片+时间线+热力图+streak+搜索的系统。
**AGPA 劣势:** 无导出功能；无公共资料页；无 session 回放。

### 1.5 架构与质量层

| 能力 | AGPA | cc-lens | bashstats | cc-prof | guide | CCA | history-viewer |
|------|------|---------|-----------|---------|-------|-----|---------------|
| **测试** | ✅ 115 tests, 7 files | ❌(0 tests) | ❌(0 visible tests) | ⚠️(CLAUDE.md rules) | ❌(0 tests) | ❌(0 tests) | ❌(0 visible tests) |
| **类型安全** | ✅(TypeScript) | ✅(TS strict) | ✅(TS) | ✅(TS strict) | ❌(shell) | ❌(shell) | ✅(Rust types) |
| **声明式成就定义** | ✅(YAML, 160条) | ❌ | ❌(JS hardcoded) | ❌(TS rules) | ❌(shell vars) | ✅(JSON, 29条) | ❌ |
| **零运行时依赖** | ⚠️(3 deps) | ⚠️(Next.js) | ⚠️(SQLite+Express) | ✅(0 deps) | ✅(0 deps) | ✅(0 deps) | ⚠️(Tauri) |
| **条件引擎** | ✅(11 types) | ❌ | ❌(SQL queries) | ✅(55 rules) | ❌(if/else) | ❌(case/match) | ❌ |
| **多 profile 隔离** | ✅(4 profiles) | ❌(single source) | ❌(single DB) | ❌(single state) | ❌(single file) | ❌(single file) | ❌(multi-provider) |
| **数据迁移** | ⚠️(无 schema 迁移) | ❌ | ✅(SQLite migrations) | ❌ | ❌ | ❌ | ❌ |
| **存储备份** | ❌ | ❌ | ✅(snapshot upload) | ❌ | ❌ | ❌ | ❌ |
| **CSRF 防护** | ✅(dev token) | ❌(local only) | ❌ | ✅(file lock) | ❌ | ❌ | ✅(Bearer auth) |
| **幂等性** | ✅(init/event) | ❌ | ❌ | ✅(queue dedup) | ❌ | ❌ | ❌ |
| **代码行数** | ~5000 TS | ~3000 TS | ~4000 TS | ~2000 TS | ~500 shell | ~400 shell | ~10000 Rust+TS |
| **自定义成就名** | ✅(self-customize) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**AGPA 优势:** 测试覆盖率遥遥领先(唯一>100 tests的项目)；声明式YAML定义最优雅；条件引擎最泛用；self-customize 独一无二。
**AGPA 劣势:** 无数据迁移机制；无 backup/restore；cc-proficiency 的纯函数规则引擎比 AGPA 的 evaluator 更模块化可测试。

---

## 2. 核心差距 → 具体建议（按价值排序）

### 🔴 P0 — 高价值，应尽快实施

#### P0-1: JSONL 文件解析补充精确统计数据

**差距:** AGPA 的用户消息计数依赖 Agent 自觉调 MCP track，不可靠。Token、session时长、模型分布完全缺失。cc-lens、bashstats、history-viewer 三家用 JSONL 解析解决了这个问题。

**方案:**
- 在 `Stop` hook 触发时，读取当前 session 的 JSONL 文件 (`~/.claude/projects/<slug>/<session-id>.jsonl`)
- 解析所有 `type: "user"` 行 → 精确 user message 计数
- 解析 `usage` 字段 → 累计 input/output/cache tokens
- 首行→末行 timestamp → session 精确时长
- 写入 `session.end` 事件的 payload → event.log 中永久保存
- 不影响现有的 `user.message` MCP track（两条线并存，JSONL 为 ground truth）

**参考:** cc-lens `lib/claude-reader.ts::parseSessionFile()` + history-viewer `src-tauri/src/providers/claude.rs`
**工作量:** 2-3天 **依赖:** 需确认 CC 的 Stop hook 是否提供 transcript_path

---

#### P0-2: Token 使用统计 + 成本估算

**差距:** AGPA 完全没有 token 统计。这是最基础的使用指标，几乎所有统计类项目（cc-lens, bashstats, history-viewer, VibeDashboard, WakaTime）都提供。

**方案:**
- 在 P0-1 的 JSONL 解析基础上，从 `usage` 对象提取 token 数据
- 存储到 `stats.json` 的日聚合中
- 新增 MCP 工具可选 `achievement_stats` 返回 token 细目
- Dashboard 新增简单的 token 概览卡片（今日/本周/总计）
- 成本估算参考 cc-lens 的 `lib/pricing.ts` per-model 定价表

**参考:** cc-lens `lib/pricing.ts` — Opus/Sonnet/Haiku per-1M-token 定价
**工作量:** 1-2天（在 P0-1 基础上）

---

### 🟡 P1 — 显著提升游戏深度

#### P1-1: Tiered 成就——从 160→500+ 个解锁点

**差距:** AGPA 的 160 个成就全是一次性解锁。bashstats 的 124 个 badge × 5 tiers = 620 个解锁点提供了 4 倍的持续激励密度。

**方案:**
- 对可计数的成就添加 `tiers` 字段（不替代现有的一次性成就，而是互补）
- 格式：
```yaml
- id: tool_master_read
  tiers:
    - { name: "阅读新手", value: 100,  rarity: common, points: 10 }
    - { name: "阅读熟手", value: 500,  rarity: uncommon, points: 25 }
    - { name: "阅读专家", value: 2000, rarity: rare, points: 50 }
    - { name: "阅读大师", value: 5000, rarity: epic, points: 100 }
    - { name: "阅读之神", value: 10000, rarity: legendary, points: 200 }
```
- 新 condition type `tiered` — 自动给定员生成多个内部条件，分别评估
- Dashboard 中，tiered 成就显示"N/5"进度而非 "✓/✗"
- 先试点 10-20 个成就（Read/Write/Edit/Bash 等高频工具），观察效果

**参考:** bashstats `src/achievements/compute.ts::generateTiers(base, exponent)`
**工作量:** 4-5天

---

#### P1-2: Usage-based XP — 成就XP + 活动XP 双轨

**差距:** AGPA 的 XP 只来自成就解锁。bashstats、level-up、claude-quest 都用 activity XP 作为持续增长来源。guide 的 `sqrt(count×multiplier)` 提供了优雅的公式。

**方案:**
```typescript
// 与 achievement XP 并行
usageXP = sqrt(
  totalToolCalls * 1 +
  totalSessions * 10 +
  totalUserMessages * 5 +
  totalTokens / 1000 * 0.5 +
  uniqueToolTypes * 20
)

totalLevel = calcLevel(achievementXP + usageXP)
```
- usage XP 在 dashboard 中显示为独立的进度条
- Level ring 总进度 = achievementXP + usageXP
- XP 乘数随 rarity 不同（现有设计保持不变）

**参考:** guide `track-stop.sh` sqrt 公式 + bashstats `floor(10*N^2.2)` 500 rank 系统
**工作量:** 1-2天

---

#### P1-3: UserPromptSubmit Hook 补充

**差距:** bashstats 和 guide 订阅了 `UserPromptSubmit` hook——这是唯一能获取用户消息内容和字数的 hook 事件。AGPA 没有这个 hook。

**方案:**
- `init.ts` 添加 `UserPromptSubmit` hook → 调用 `hook.ts auto`
- `mapEvents()` 新增 case → 生成 `user.prompt` 事件
- payload: `{ char_count, word_count, prefix_hash }` (隐私保护,只存前20字符的hash)
- 不存原文——bashstats 存原文有隐私风险

**参考:** bashstats `src/hooks/handler.ts::handleHookEvent('UserPromptSubmit')` + `src/db/writer.ts::recordPrompt()`
**工作量:** 1天

---

#### P1-4: 日聚合缓存表

**差距:** 当前 `poll()` 全量扫描 event.log。5228 个事件还好，但到 50000+ 会有性能问题。bashstats 的 `daily_activity` SQLite 表是最佳实践。

**方案:**
- 扩展 `stats.json`，添加 `daily` 数组
```json
{
  "daily": {
    "2026-06-03": { "sessions": 3, "tools": 45, "user_msgs": 28, "tokens": 150000, "unique_tools": 8 },
    "2026-06-04": { "sessions": 2, "tools": 32, "user_msgs": 18, "tokens": 90000, "unique_tools": 6 }
  }
}
```
- `computeStats()` 增量更新（只处理新日期的事件）
- Dashboard heatmap 直接从日聚合读取（不再按事件级别计算）
- 可选: 在 `Store` 中维护 `last_aggregated_line` 只处理增量

**参考:** bashstats `src/db/writer.ts::recordDailyActivity()` + `daily_activity` 表
**工作量:** 2-3天

---

### 🟢 P2 — 提升质量与深度

#### P2-1: 反刷分机制（maxPerSession + Bucket Caps）

**差距:** cc-proficiency 的 `maxPerSession` 和 bucket caps 保证了系统公正性。AGPA 没有任何防刷机制。

**方案:**
- 在 YAML condition 添加 `max_per_session` 字段
- evaluator 在评估时，同一 session 内超过上限的触发不计数
- 对关键的高稀有度成就（epic+）默认启用
- 不影响历史数据——只对新 unlock 生效

**参考:** cc-proficiency `src/scoring/rules.ts::maxPerSession` + `src/scoring/engine.ts::bucket caps`
**工作量:** 1-2天

---

#### P2-2: 斐波那契 Nudge——关键 session 节点引导

**差距:** guide 的斐波那契触发（第 1, 2, 3, 5, 8, 13, 21... session 时）—在关键节点向用户推荐新功能。AGPA 的 tip/hint 系统已就绪但只在解锁后显示。

**方案:**
- 在 `poll()` 返回时附加 `nudges[]`
- Nudge 基于 session 计数：`fibonacciNumbers.includes(sessionCount)`
- 每个斐波那契节点对应一个主题（session 3: "试试搜索", session 5: "配置 MCP"...）
- Dashboard toast 显示 nudge 提示，不超过 1 条/次
- 已有 hint 系统可复用为 nudge 文案的来源

**参考:** guide `track-stop.sh::fibonacci_evening_suggestions()`
**工作量:** 2-3天

---

#### P2-3: 规则引擎模式重构成就检测（长期架构改进）

**差距:** cc-proficiency 的 `ScoringRule` 纯函数模式是目前最优雅的检测单元。AGPA 的 evaluator 是一个大型 switch-case 函数，难以单独测试每个条件类型。

**方案:**
- 定义 `AchievementRule` 接口：
```typescript
interface AchievementRule {
  id: string;
  domain: string;
  detect(events: TrackedEvent[], state: AchievementState): Progress;
}

interface Progress { met: boolean; current: number; target: number; }
```
- 每个 condition type 封装为一个独立的 Rule class
- 现有 evaluator 作为 Rule 的编排器（不变）
- 每条 Rule 可以独立单元测试
- 渐进重构——不一次性改完，先抽 2-3 个 condition type

**参考:** cc-proficiency `src/scoring/rules.ts` 55 条规则 + `src/scoring/rule-engine.ts`
**工作量:** 5-7天（分阶段）

---

#### P2-4: 数据导出功能（Export/Import JSON）

**差距:** 没有备份/导出。cc-lens 和 bashstats 提供了 export。这是用户数据安全的基本需求。

**方案:**
- `agpa export <profile>` → 导出 state.json + stats.json + showcase.json → 一个 .agpa-export.json 文件
- `agpa import <file>` → 恢复，冲突提示
- Dashboard 添加"导出数据"按钮
- 格式：
```json
{
  "version": "0.1.6",
  "exported_at": "ISO8601",
  "state": { "unlocked": {...}, "stats": {...} },
  "stats": { "sessions": {...}, "user_messages": {...}, "usage_time_ms": {...} },
  "showcase": { "slots": [...] }
}
```

**参考:** cc-lens export JSON 格式
**工作量:** 1-2天

---

#### P2-5: 每周目标系统（Weekly Goals）

**差距:** bashstats 的 weekly goals 系统自动按周生成挑战目标（按 hash 确定性生成，无随机性），activity multiplier 奖励活跃用户。

**方案:**
- 每周日/周一自动生成 3 个目标
- 目标类型：tool 使用次数、session 次数、user message 次数
- 基于用户历史数据设定合理阈值（50th percentile = common, 75th = uncommon, 90th = rare）
- 完成目标获得额外 XP multiplier（1.0x-2.0x）
- Dashboard 的 Hero section 下方显示本周目标进度

**参考:** bashstats `src/constants.ts::WEEKLY_GOAL_STATS` + 周 hash 确定性选择
**工作量:** 3-4天

---

### ⚪ P3 — 可选增强，长期

#### P3-1: 特征依赖图——成就前置条件

**差距:** guide 的特征依赖图确保了正确的学习路径。AGPA 没有成就解锁前置条件。

**方案:** YAML 新增 `requires: []` 字段，指向前置成就 ID。evaluator 先检查前置条件再评估主条件。适合 onboarding → milestones → mastery 的渐进路径。

**参考:** guide `game-data.json::featureDependencies`
**工作量:** 2天

---

#### P3-2: 公共资料页 + Share Card

**差距:** bashstats.com、VibeDashboard README badge、level-up 公共 profile。AGPA 完全没有对外分享能力。

**方案:**
- 可选 opt-in 生成 SVG share card（类似 VibeDashboard）
- 包含：Level、成就数、top 3 最稀有的成就、连续天数
- 纯客户端生成，不依赖外部服务

**参考:** VibeDashboard `src/generator.js::generateCard()` + cc-proficiency `src/renderer/svg.ts`
**工作量:** 3-4天

---

#### P3-3: Session 回放——查看历史对话

**差距:** cc-lens 和 history-viewer 提供了 session 回放功能——从 JSONL 重建对话。这是高级分析功能。

**方案:**
- Dashboard 新增 session 列表页
- 点击进入回放模式：对话气泡，区分 user/assistant，工具调用折叠
- 可选显示 token 消耗 per turn

**参考:** cc-lens `lib/replay-parser.ts` + history-viewer 虚拟滚动
**工作量:** 5-7天

---

#### P3-4: 反模式检测——坏习惯扣分

**差距:** cc-proficiency 的 anti-pattern rules（shotgun 并行调用、wall of text）扣分。

**方案:**
- 定义几个反模式规则：
  - `shotgun_call`: 同一 session 内超过 10 个并行 tool call → -5 XP
  - `wall_of_text`: 单条 prompt 超过 5000 字符 → hint 建议精简
  - `error_loop`: 连续 5 个 tool failure → 建议休息
- 仅警告，不实际扣 XP（避免挫败感）
- Dashboard hint 显示"效率提示"

**参考:** cc-proficiency `src/scoring/rules.ts::anti-pattern` 规则
**工作量:** 2天

---

#### P3-5: 叙事者角色/主题切换

**差距:** codex-mcp 的 narrator 角色 (GLaDOS/赛博朋克/教官/金毛) 很有趣。claude-quest 的 pokemon/storybook 主题皮肤也增加了沉浸感。

**方案:**
- 轻量版：Dashboard 自定义 narrator 风格（成就解锁提示文案风格切换）
- 不改架构，只改 string template
- 预设 3 个风格：默认 / 程序员冷笑话 / 史诗冒险

**参考:** codex-mcp `set_narrator_voice` tool
**工作量:** 1天

---

## 3. 实施路线图建议

```
Phase 1 (1-2 周) — P0 补齐核心数据缺口
├─ JSONL 解析 → 精确 user message 计数 + session 时长
├─ Token 统计 + 成本估算
└─ UserPromptSubmit hook

Phase 2 (2-3 周) — P1 游戏深度提升
├─ Tiered 成就（10-20 个试点）
├─ Usage-based XP（双轨）
└─ 日聚合缓存表

Phase 3 (2-3 周) — P2 质量与体验
├─ 反刷分机制
├─ 斐波那契 nudge
├─ 数据导出
└─ 每周目标

Phase 4 (future) — P3 可选增强
├─ 特征依赖图
├─ Share card
├─ Session 回放
└─ 反模式检测
```

---

## 4. 竞品定位图

```
            简单/Casual                         硬核/RPG
                  │                                  │
      CCA(29成就)  │              bashstats(124×5)    │
         ●         │                   ●              │ codex-mcp
                   │                                  │    ●
    @levelup-log   │         AGPA(160+sets)  ●       │
         ●         │          ●           claude-quest│
                   │     cc-proficiency(55rules)  ●  │
  VibeDashboard ●  │                     level-up-mcp│
                   │                           ●     │
    WakaTime ●     │                                  │
                   │                                  │
  ─────────────────┼──────────────────────────────────│
                   │                                  │
  纯统计/无游戏化   │          cc-lens（纯分析，无成就）  │
                   │               ●                  │
         history-viewer ●                             │
                   │                                  │
         guide（段位，无成就）                         │
              ●    │                                  │
                   │                                  │
            工具使用分析                         成就/游戏化/角色扮演
```

**AGPA 的定位:** 在统计分析和 RPG 游戏化之间找到了最佳平衡点——比纯统计类项目多了完整的成就系统，比纯 RPG 类多了真实的数据分析价值。唯一在两条轴上都有深度的项目。

**下一步最优路径:** 在统计轴上补齐 JSONL 解析 → 在游戏化轴上增加 tiered 成就 → 两条腿同时走强。

---

## 5. 总结：AGPA 的 3 个独特优势 + 3 个最大短板

### ✅ 三大优势（含竞争对手均未做到的事）

1. **声明式 YAML 成就引擎 + 11 种条件类型** — 最灵活、最可扩展的成就定义系统。bashstats 硬编码 SQL，CCA 硬编码 shell，只有 AGPA 可以用 YAML 定义任意新成就而不改代码。

2. **双通道架构 (Hook + MCP) + 5 工具 init** — 唯一同时用两个通道采集数据、唯一为 5 种工具提供一键配置的系统。cc-lens 只能被动读文件，bashstats 只能被动收 hook。

3. **Dashboard 功能密度最高** — 唯一集成了成就网格 + 搜索 + 排序 + 过滤 + 统计卡片 + 时间线 + 热力图 + streak + 双语 + 音效的仪表板。

### ❌ 三大短板

1. **无 JSONL 解析** — 无法精确获取 user message、token、时长等核心数据。导致统计层完全依赖不可靠的 Agent 自上报。

2. **无 Tiered 成就** — 160 个一次性成就 vs bashstats 的 620 个分层解锁点。成就系统的"重玩价值"和持续激励密度远低于 bashstats。

3. **无 Usage-based XP** — XP 只来自成就解锁，不来自日常使用。导致空窗期（没有成就解锁时）Level 完全不增长。
