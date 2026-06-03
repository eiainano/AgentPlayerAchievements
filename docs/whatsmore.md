# CCA 调研后续行动计划

> 基于 `subinium/claude-code-achievements` 调研（2026-06-02）及用户逐点反馈整理
> 状态标记：🔜 近期可开工 ｜ ⏳ 待定 ｜ 📝 低优先级 TODO ｜ ❌ 暂不采纳

---

## 背景

调研了 [subinium/claude-code-achievements](https://github.com/subinium/claude-code-achievements)（CCA），一个 29 成就的 Bash 插件。相比我们的 160 成就 TypeScript 引擎，CCA 在**用户可感知体验**上有几点做得更好：成就教育提示、聊天内查询、线索系统、跨平台通知、一键安装。以下整理哪些要采纳、哪些暂缓。

## 🧠 设计哲学 — CCA 最大的启示

CCA 最值得学习的不只是技术实现，而是**用成就系统当教程**的设计哲学：

- 29 个成就按 4 个 skill tree（Getting Started → Workflow → Power Tools → Mastery）自底向上排列
- 每解锁一个成就，用户就学到一项 Claude Code 功能
- 成就 Tip 直接告诉用户怎么更好使用该功能（而非单纯描述"你做了什么"）
- 整个成就列表就是一份 Claude Code 学习路径

我们 160 个成就更侧重"记录行为 + 趣味奖励"，缺少从新手到大师的学习路径感。未来设计新成就时，应同时考虑两个维度：
1. **行为记录**：你做了什么
2. **教学指引**：解锁后你能学会什么 / 能用什么新技巧

---

## 🔜 1. Tip 与 Hint 分离：两个字段，两种用途

### 1a. `tip` — 教育提示（已解锁用）

**做什么**：告诉用户**解锁后能学到什么、怎么更好用这个功能**。语气是教程式、实用的。

**示例**：
```yaml
- id: first_edit
  tip_cn: "不要只说「修一下 Bug」，尝试具体指向文件和行号——比如「修复 login.js 第 42 行的 TypeError」。更精确的上下文让 Claude 输出更准确。"
  tip_en: "Instead of 'fix the bug', say 'fix the TypeError in login.js line 42'. Specific context helps Claude give better results."
```

**范围**：仅 onboarding 入门成就 + Common/Uncommon。不铺全量。

**展示方式**（待定）：通过 `/achievements` 已解锁视图展示，不在 Dashboard 默认显示。

### 1b. `hint` — 解锁线索（未解锁用）

**做什么**：给未解锁用户一个**语义化暗示**，帮他们猜怎么解锁，但**不暴露精确条件**。语气是谜语式、悬念感。

**与 `tip` 关键区别**：
| 维度 | tip | hint |
|------|-----|------|
| 谁看 | 已解锁用户 | 未解锁用户 |
| 目的 | 教更好使用该功能 | 引导猜测如何解锁 |
| 语气 | 教程式 | 谜语式 |
| 场景 | `/achievements` unlocked | `/achievements locked` |

**示例**：
```yaml
- id: first_edit
  hint_cn: "动手改点什么吧——你的第一次编辑"
  hint_en: "Make your first edit — change something and see what happens"

- id: night_owl
  hint_cn: "夜深人静时和 Claude 聊聊工作"
  hint_en: "Some of your best ideas come after midnight"
```

不要写成 "在 0:00-5:00 用 mode:'single' 完成任务"——这样就剧透了。

**原则**：
- 太具体 → 失去惊喜感
- 太模糊 → 没有引导作用
- 好 Hint：用户看到后大致知道该做什么，但不知道精确边界

**范围**：仅 Common / Uncommon。Rare+ 成就保留神秘感，不给 Hint。

**涉及文件（1a + 1b 共享）**：
- `04-成就定义清单.yaml` — 新增 `tip_cn` / `tip_en` / `hint_cn` / `hint_en`（均为可选）
- `src/types.ts` — `AchievementDef` 接口新增 `tip` 和 `hint` 字段
- `src/utils/yaml-parser.ts` — 解析新字段

---

## 🔜 2. `/achievements` 聊天内命令 — 技术方案

### 2a. Claude Code 自定义命令机制

Claude Code 已把自定义命令合并到 Skill 系统。两种方式均可创建 `/achievements`：

- **项目命令文件**：`.claude/commands/achievements.md`（推荐——项目内共享）
- **个人技能目录**：`~/.claude/skills/achievements/SKILL.md`（全局可用）

命令文件本质是**一段 Markdown 指令给 Claude 读**——不是可执行代码。Claude 加载命令文件后，按指令调用工具（Read、Bash）去读取数据，然后按格式输出。

关键能力：
- **`!command`**：动态上下文注入——Claude Code 在显示指令前先执行命令，把输出内联替换。可用于预读 state.json
- **`$ARGUMENTS`**：获取命令参数，如 `/achievements locked` → `$ARGUMENTS` = `"locked"`
- **`allowed-tools`**：预授权工具，避免每步都弹出权限确认

### 2b. 实现方案

创建 `.claude/commands/achievements.md`，内容结构：

```markdown
当用户输入 /achievements 时：
1. 读取 ~/.agent-achievements/state.json（注意多档案：如设置了 AGPA_PROFILE 或 config.json 中 active_profile）
2. 根据 $ARGUMENTS 决定展示模式：
   - (无参数) → 已解锁成就列表 + 进度条
   - locked   → 未解锁成就 + hint 线索
   - all      → 全部按稀有度/set 分组
   - stats    → XP、等级、稀有度分布
   - recent   → 最近 10 个解锁
   - settings → 跳转到设置模式（见第 2c 项）
   - common / uncommon / rare / epic / legendary / mythic → 按稀有度过滤
   - <set_name> → 按套装过滤
3. 格式化输出（进度条用 ▰▱，已解锁 ✓，未解锁 ○）
```

**注意**：YAML 定义文件 Claude 无法直接解析，需要提前把成就元数据导出为 JSON（如 `stateDir/achievements.json`），或内嵌在命令文件中。建议方案：**把 `04-成就定义清单.yaml` 编译后的 JSON 快照存在 stateDir 下**，命令文件读取它。

### 2c. `/achievements settings` — 聊天内设置

创建 `.claude/commands/achievements-settings.md`（或作为 `/achievements settings` 参数内联），让用户在聊天内切换语言/通知/重置：

| 参数 | 功能 |
|------|------|
| `/achievements settings` | 显示当前设置 + 可选项 |
| `/achievements settings language zh\|en` | 切换语言 |
| `/achievements settings notifications on\|off` | 开关通知 |
| `/achievements settings reset` | 重置成就进度（需二次确认） |

参考 CCA `commands/achievements-settings.md` 的模式：用 AskUserQuestion 交互菜单，或直接参数执行。

### 2d. 技术依赖说明

| 需求 | 实现 |
|------|------|
| Claude 读取成就数据 | Read 工具读 `~/.agent-achievements/state.json` |
| Claude 知道成就元数据（名称/描述/icon） | 从编译后的 JSON 读取（YAML → JSON 快照存在 stateDir） |
| 多档案支持 | 检测 `~/.agent-achievements/config.json` 的 `active_profile` |
| 无需权限弹窗 | frontmatter 中 `allowed-tools: Read` |

**文件**：
- `.claude/commands/achievements.md` — 主命令（新建）
- `.claude/commands/achievements-settings.md` — 设置命令（新建）

---

## 🔜 3. 进度条 — `/achievements` 命令终端输出

Chunk 合并到第 2 项。进度条作为 `/achievements` 默认输出的 Header 部分：

```
▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  64/160  40%
```

20 格 Unicode 方块（`▰` 已解锁比例，`▱` 剩余），后跟数字 + 百分比。在命令文件中用格式化指令描述即可，Claude 按指令输出。

---

## 📝 4. 跨平台通知增强

**做什么**：加强 `src/utils/notify.ts` 的跨平台桌面通知支持。

**当前状态**：仅 macOS + 终端 fallback

**目标**：
- macOS: `osascript` ✅（已有）
- Linux: `notify-send`
- Windows: PowerShell Toast
- 全部 fallback → 终端打印

**限制**：通知中**不要带上 Tip**，只要成就名称 + 描述 + 进度信息即可。

**低优先级**，记录为 TODO。

---

## ❌ 5. 插件化注册 — 暂不采纳

CCA 的方式（`npx` → 复制文件 → 注册 hooks → 注册 commands）不适用于我们，因为：
- 我们有 MCP Server 的长连接
- MCP 和 plugin 模型需要共存设计
- 当前不需要额外复杂化安装流程

---

## 📝 6. 重新组织成就分类/难度分级

**做什么**：考虑给成就加 `difficulty` 或 `tier` 字段，映射用户学习路径：
- Tier 1: 基本工具（Edit, Read, Bash）
- Tier 2: 进阶（MCP, Task, Plan Mode）
- Tier 3: 专家（Hooks, Custom Skills）
- Tier 4: 大师（多 Agent、长序列）

**低优先级**，记录在册。

---

## 📝 7. 国际化扩展

**当前**：中英文已有（name/name_cn, description/description_cn）

**未来目标**：简中、繁中、英文、日语、韩语，覆盖 name、description、tip、hint 四个字段

**低优先级**，等 tip/hint 字段稳定后再扩展。

---

## 执行路线图

```
Phase 1 (近期可开工)
├── 🔜 1a. YAML 添加 tip_cn/tip_en 字段（入门 + Common/Uncommon）
├── 🔜 1b. YAML 添加 hint_cn/hint_en 字段（仅 Common/Uncommon）
├── 🔜 2a. 创建 .claude/commands/achievements.md
├── 🔜 2b. 创建 .claude/commands/achievements-settings.md
├── 🔜 2c. YAML → JSON 编译快照，写入 stateDir 供命令文件读取
├── 🔜 3.  进度条融入 /achievements 命令输出
└── 配套：types.ts / yaml-parser.ts 同步更新（tip + hint 字段）

Phase 2 (后续)
├── 📝 4. 跨平台通知增强（notify.ts）
├── 📝 6. 成就难度分级
└── 📝 7. 国际化扩展（繁中/日/韩）

不做的
└── ❌ 5. 插件化注册
```

---

## 验证方式

- `npm run test` 全部通过（types.ts / yaml-parser.ts 更新后测试断言同步）
- `npm run build` 无 TypeScript 错误
- `/achievements` 在聊天中正常输出
- `/achievements locked` 展示 hint，不暴露精确条件
- `/achievements settings language zh` 正常切换
- `npx tsx src/cli/hook.ts auto` 模拟事件，track 正常

---

# 第二轮调研：Claude Code 游戏化生态 Top 5（2026-06-03）

通过 GitHub 搜索关键字 `achievement`、`gamification`、`quest`、`play`，按 stars 排序筛选出非教程类项目，取 top 5 克隆至 `research/` 目录深读。以下是各项目可借鉴点汇总。

> **2026-06-03 补充**：Star 数来自调研当日。CCA 已在第一轮深度调研过，本轮新增其他 4 个项目的分析。

---

## Top 5 概览

| # | 项目 | Stars | 类型 | 核心亮点 |
|---|------|-------|------|---------|
| 1 | [claude-code-guide](https://github.com/OriNachum/claude-code-guide) | 114 | 游戏化进度指南 | Fibonacci 间隔 nudging、腰带段位、特性依赖图 |
| 2 | [claude-code-achievements](https://github.com/subinium/claude-code-achievements) | 84 | Steam 风格成就 | 第一轮已深入分析（CCA） |
| 3 | [sc2-claude-hooks](https://github.com/samhayek-code/sc2-claude-hooks) | 26 | 音效反馈 | StarCraft 2 语音线、主题/阵营切换、智能冷却 |
| 4 | [buddy-evolution](https://github.com/FrankFMY/buddy-evolution) | 5 | RPG 伴侣养成 | 34 成就触发函数、5 维属性递减增长、18 物种进化树、12 人格影响 Claude 行为 |
| 5 | [claude-code-quest](https://github.com/ytrofr/claude-code-quest) | 1 | RPG 路线图 | plan 文件 checkbox 自动追踪进度、多项目、零依赖 Python |

---

## 各项目可借鉴点

### 1. claude-code-guide（114⭐）— 游戏化进度指南

**架构**：7 个 Skill + 3 个 Bash Hook → JSON 状态文件 → `/guide:game-mode` 和 `/guide:level-up` 两条 slash 命令。

**值得借鉴**：

| 特性 | 描述 | 对 AGPA 的启发 |
|------|------|---------------|
| **Fibonacci 间隔 Nudging** | 不是每 session 都提示，而是 session 1, 2, 3, 5, 8, 13, 21... 才弹出推荐。避免骚扰 | 📝 我们的通知节奏可以参照——不在每次 poll 都弹窗，而是按 Fibonacci 间隔 |
| **腰带段位系统** | 16 个特性领域，每个独立跟踪使用次数，按 2^n 划分白→黄→橙→绿→蓝→棕→黑腰带，512+ 进段位 | 📝 可以给成就增加"熟练度"维度——已解锁 vs. 精通（累计触发 N 次） |
| **特性依赖图** | agents 需要 skills+planning，worktrees 需要 agents。锁定特性显示 🔒 | 📝 我们的成就之间可以有"前置解锁"关系，在 Dashboard 展示路径 |
| **评分公式** | `score = sqrt(raw_points)` + Beginner x1 / Intermediate x10 / Expert x100 三档权重 | 📝 我们的 XP 系统可以加 sqrt 压缩，防止数字膨胀 |
| **数据迁移框架** | `migrate-data.sh` 每次 hook 调用前置执行——从缓存恢复 + 填充缺失字段 + 记录 migration 历史 | 🔜 **高价值**：我们的 YAML schema 一直在演进（刚加了 tip/hint），需要一个迁移系统 |
| **Level-up 推荐算法** | 按腰带（低优先）→ 档位（高优先）→ 次数（少优先）排序，确保没用过的特性最先出现 | 📝 我们的 `/achievements unlocked` 可以加一个"recommended next"板块 |

---

### 2. claude-code-achievements（84⭐）— 第一轮已分析

详见第一轮 CCA 调研。Phase 1 已完成：`/achievements` 命令、tip/hint 分离、init 集成编译。

---

### 3. sc2-claude-hooks（26⭐）— 音效反馈

**架构**：Hook → Bash 脚本 → `afplay`（macOS）播放 faction 对应目录的随机 mp3。`active` 符号链接指向当前选择的阵营。

**值得借鉴**：

| 特性 | 描述 | 对 AGPA 的启发 |
|------|------|---------------|
| **成就解锁音效** | 不同的 Claude Code 事件映射到不同的音效分类 | 🔜 **高价值**：成就解锁时播放音效，极大增强"游戏手感"。当前只有文本通知和系统弹窗 |
| **主题/阵营切换** | Terran / Protoss / Zerg 三套音效，通过符号链接切换 | 📝 可以做成"通知主题包"——用户选择 sci-fi / retro / minimal 风格 |
| **智能冷却** | 15 秒 cooldown + 错误过滤（grep no-match 等无趣错误不触发），防止音效轰炸 | 📝 我们的通知也可以加冷却逻辑——短时间内多成就同时解锁时合并通知 |
| **一键安装** | `install.sh` 搞定一切：复制文件、设置 faction、合并 hooks 到 settings.json（Python 脚本保留已有配置） | 我们的 `agpa init` 已经做到类似效果 ✅ |

---

### 4. buddy-evolution（5⭐）— RPG 伴侣养成

**架构**：SessionStart/SessionEnd 两个 JS Hook → 17 步端到端管线 → `~/.buddy-evolution/soul.json` 持久化。

**值得借鉴**：

| 特性 | 描述 | 对 AGPA 的启发 |
|------|------|---------------|
| **成就触发函数（代码驱动）** | 34 成就每个都有 `trigger(session, soul) => boolean` 函数，而非 YAML 声明式条件。支持复杂逻辑（如 `hasHomecoming` 检查文件上次编辑距今 > 60 天） | 📝 我们的 11 种 condition type 覆盖了大部分场景，但极复杂逻辑（如"跨 session 文件回溯"）无法表达。可考虑加 `custom` condition type 支持脚本 |
| **属性递减增长** | 5 维属性（debugging/patience/chaos/wisdom/snark），增长公式 `growth × 100/(100+current)`，渐进逼近 200 上限 | 📝 如果我们加"技能点"系统，递减增长比线性增长好——早期进步快，后期需要"大师级"成就 |
| **Streak 乘法** | 连续天数 x1.0→x2.0（每天 +0.1，11 天封顶），断签重置。中等 session ~600 XP，约 14 次到 Level 5 | 📝 我们的 streak 成就只记录"是否达成"，没有乘法奖励。加 streak multiplier 能激励日常使用 |
| **18 物种进化树** | 创建时随机分配物种，Level 5/10 各有二选一的分支进化，选择永久 | 📝 如果我们引入"伴侣系统"，进化树是一个强烈的留存机制 |
| **人格注入 Claude 行为** | 12 种人格 + 7 种心情 → `generateCompanionContext()` 生成文本块注入 Claude system prompt，影响 Claude 的沟通风格 | 📝 成就可以解锁"人格特质"，允许用户选择 Claude 的交流风格（严谨/活泼/精简） |
| **文件熟悉度跟踪** | 每个编辑过的文件跟踪 touches 次数，New → Familiar → Expert → Nostalgic 四阶 | 📝 可以解锁"文件羁绊"类成就——对同一个文件编辑 N 次 |
| **17 步 Session 端管线的健壮性** | 转录解析 → 跳过空 session → 终身统计 → streak → 属性增量 → 熟悉度 → 成就 → XP → 项目 XP → 升级 → 进度 → 周报 → lastSession → 保存 → 日志 → 通知 | 我们的 `poll()` 相对简单。可以借鉴 buddy 的"session 结束总结"概念——完成 session 后生成迷你报告 |

---

### 5. claude-code-quest（1⭐）— RPG 路线图

**架构**：PostToolUse Hook → 异步 fork `autosync.py` → 解析 Claude plan 文件 checkbox → 更新 `quests.json` → `render.py` → 静态 HTML 仪表盘（`:8770`）。

**值得借鉴**：

| 特性 | 描述 | 对 AGPA 的启发 |
|------|------|---------------|
| **Plan Checkbox → 进度自动同步** | Claude 的 plan 文件（`Section 13 -- Post-Validation`）中 `- [x]` 进度自动映射为 quest 进度 | 📝 我们可以跟踪用户的"项目完成度"——不只跟踪工具使用，还跟踪实际开发进度 |
| **RPG 主题 Dashboard** | Pokemon 和 Storybook 两套视觉主题，手写模板引擎 `{{var}}`/`{{#each}}`/`{{>partial}}` | 📝 我们的 Dashboard 可以加主题系统——Sci-Fi / Fantasy / Minimal |
| **多项目支持** | 每个项目独立 level/XP/quest 列表，通过路径映射自动关联 | 📝 我们已有 profile 系统（4 档位），但缺少"项目感知"——不同 repo 的成就独立追踪 |
| **Claim/Bind 机制** | Session 与 quest 的关联——"这个 session 是在做哪个 quest" | 📝 可以加"任务系统"：用户声明一个目标，session 结束后评估完成度，解锁对应成就 |
| **安全不变量文档化** | Plan 解析器从不自动 lock quest（`"current" is plural`），reset 需要显式 `--clean` 标志。不变量清晰记录在 SKILL.md 中 | 我们的 `safeParse` + `validate.ts` 已经有类似思路 ✅，但缺少显式不变量文档 |

---

## 新增行动项

基于以上分析，以下新增行动项合并到现有路线图：

```
Phase 1+ (已有 + 新增建议)
├── ✅ /achievements 聊天命令
├── ✅ tip/hint 字段分离
├── ✅ 跨平台通知
└── 📝 数据迁移框架 — 来自 claude-code-guide

Phase 2 (后续)
├── 📝 成就解锁音效 — 来自 sc2-claude-hooks（"游戏手感"最大提升）
├── 📝 Session 结束迷你报告 — 来自 buddy-evolution
├── 📝 Streak 乘法奖励 — 来自 buddy-evolution
├── 📝 Dashboard 主题系统 — 来自 claude-code-quest
├── 📝 成就"熟练度"维度（腰带段位）— 来自 claude-code-guide
├── 📝 发布间隔 Nudging — 来自 claude-code-guide
├── 📝 成就难度分级（Tier 1-4）— 已有
└── 📝 国际化扩展（繁中/日/韩）— 已有
```

## 已放弃/低 ROI

以下特性在本次调研中评估过但不适合 AGPA 当前阶段：

| 特性 | 来源 | 放弃原因 |
|------|------|---------|
| RPG 伴侣养成（物种/进化/人格注入） | buddy-evolution | 太大，需要全新的 Companion 子系统，偏离当前成就核心 |
| Plan 文件 checkbox 自动同步 | claude-code-quest | 依赖 Claude 的 plan 格式，脆弱；AGPA 不是项目管理工具 |
| 手写模板引擎 Dashboard | claude-code-quest | 我们的 Dashboard 已经是零框架 HTML/CSS/JS，不需要换 |
| 代码驱动成就触发器 | buddy-evolution | 我们的 11 种 YAML condition type 已经很强大，加 custom type 值得但要谨慎 |

---

# 第二轮调研 · 三大特性详细设计方案

> 来源：claude-code-guide、sc2-claude-hooks、buddy-evolution 深读分析
> 状态：📐 方案设计阶段，暂不实施

---

## 📐 设计 1：成就解锁音效系统

### 现状

成就解锁时只有系统通知弹窗 + 终端文本输出。缺少"游戏手感"——玩家期待"叮"一声的音效反馈。

### 目标

不同稀有度的成就解锁时播放差异化的音效，让听觉成为一个独立的信息通道。

### 音效分级

| 稀有度 | 音效类型 | 示例 | 音色方向 |
|--------|---------|------|---------|
| Common | 轻柔提示音 | "叮" | 短促（<0.5s），高频铃音 |
| Uncommon | 清晰成就音 | 单音阶梯 | 中高频，1-2 个音符上升 |
| Rare | 饱满成就音 | 三和弦 | 有共鸣感，0.8-1.2s |
| Epic | 史诗短乐句 | 小号 / 管弦升调 | 1-2s，有"重大成就"感 |
| Legendary | 长乐句 | 全管弦乐 + 鼓点 | 2-3s，有"传奇"感 |
| Mythic | 终极乐句 | 合唱 + 管弦 + 回响 | 3-5s，全系统最重的音效 |

### 技术方案

```
src/utils/notify.ts 的 sendNotification()
    │
    ├── 现有：系统弹窗 + 终端输出
    └── 新增：playSound(rarity)
              │
              ├── macOS:  afplay
              ├── Linux:  paplay / aplay
              └── Windows: PowerShell MediaPlayer
```

**实现改动**：

1. **音效文件**：6 个音频文件（`.wav`）打包在 `assets/sounds/` 下，与 `pixelart-shield-gold.png` 同级。命名：`common.wav`、`uncommon.wav` 等。

2. **`notify.ts` 新增 `playSound(rarity: RarityLevel)`**：自动检测 OS，选择对应播放器。不依赖任何外部程序——`afplay` 在 macOS 上自 PHP 7+ 就存在，`aplay` 在 Linux 发行版基本都有，PowerShell 在 Windows 上自带。

3. **播放时机**：在 `poll.ts` 和 `hook.ts` 的解锁通知循环里，`sendNotification()` 之前调用 `playSound()`。音效先播（即时反馈），弹窗后出。

4. **去重/冷却**：如果同一轮 poll 解锁多个成就，只播放**最高稀有度**的音效，避免音效轰炸。用 `Math.max(...newlyUnlocked.map(a => rarityRank[a.rarity]))` 取最高档。

### 音效来源

两种选择：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **自制**（SFXR/Chiptone） | 无版权、文件极小（<5KB each）、8-bit 风格独特 | 音色有限，不够"高级" |
| **免版税素材库**（Mixkit、Freesound） | 音质好、可选风格多 | 需要筛选、文件较大 |
| **Pixabay / ZapSplat** | 大量免版税短音效，CC0 | 需要手动试听筛选 |

**建议**：先用 SFXR 生成 6 个 8-bit 风格音效做 PoC——文件极小、零版权问题、快速验证全链路。如果反馈音质不够好，再换免版税素材。

### 涉及的代码改动

| 文件 | 改动 |
|------|------|
| `assets/sounds/{common,uncommon,rare,epic,legendary,mythic}.wav` | 新建：6 个音效文件 |
| `src/utils/notify.ts` | 新增 `playSound()` 函数，`sendNotification()` 调用它 |
| `src/tools/poll.ts` | 无需改动（已有通知循环，`sendNotification` 内部已含音效） |
| `src/cli/hook.ts` | 无需改动 |
| `src/engine/types.ts` | 新增 `RARITY_RANK` 常量（用于取最高稀有度） |

### 未来扩展方向

- 用户自定义音效主题包（与 sc2 的 faction 切换类似）
- 连击音效（短时间内连续解锁多个成就时播特殊音效）
- Dashboard 上手动触发试听按钮

---

## 📐 设计 2：数据迁移框架

### 问题

`04-成就定义清单.yaml` schema 持续演进（新增 `tip/tip_cn/hint/hint_cn`、`name_cn`、`description_cn`、`future`、`challenge` 等字段），但用户的 `state.json` 是旧格式。没有迁移机制 = 静默数据丢失或功能退化。

### 目标

每次 schema 变化时，用户的 `state.json`（及 `achievements.json` 编译快照）自动补全缺失字段，不丢数据、不破坏已有的解锁记录。用户无感知。

### 设计方案

参考 claude-code-guide 的 `migrate-data.sh` 模式——**在前置入口自动执行**，不依赖用户手动操作。

**State.json 版本化**：

```json
{
  "schema_version": 1,
  "migrations": [
    { "from": 1, "to": 2, "date": "2026-06-03T...", "description": "Added streak tracking" }
  ],
  "unlocked": { ... },
  "stats": { ... }
}
```

**迁移链**（增量，链式执行）：

```
v1 → v2: 添加 streak 字段
v2 → v3: 添加 XP 字段
v3 → v4: 添加文件熟悉度字段
...
```

每个版本的迁移函数只负责从 `vN` 补到 `vN+1`，引擎启动时自动跑完整个迁移链。

### 涉及的新文件

`src/engine/migrate.ts`：

```typescript
// 核心函数
export function migrateState(state: Record<string, unknown>): Record<string, unknown>;

// 迁移链
const MIGRATIONS: Array<(state: Record<string, unknown>) => Record<string, unknown>> = [
  // v1 → v2: add streak
  (s) => ({ ...s, schema_version: 2, streak: { currentDays: 0, longestDays: 0, lastSessionDate: null } }),
  // v2 → v3: add XP accumulator
  (s) => ({ ...s, schema_version: 3, xp: { total: 0, bySource: { achievements: 0, tasks: 0, streakBonus: 0 } } }),
  // ... 未来版本在这里加
];
```

**调用位置**：`src/engine/store.ts` 的 `loadState()` 函数——在读取 `state.json` 后、返回给调用方前，自动执行 `migrateState()`。

**`achievements.json` 编译快照的迁移更简单**：不迁移旧数据，因为它是无状态派生数据——每次 `agpa init` 或 `compile-achievements.ts` 重新从 YAML 编译即可覆盖。init 每次都重新做，不需要增量迁移逻辑。

### 迁移的安全约束

- **只补字段，不删字段**：旧字段永远保留
- **只设默认值，不改已有值**：用 `//=` 语义
- **幂等**：重复执行同一个迁移不会产生副作用
- **失败熔断**：任何迁移抛出异常 → 日志告警 + 返回原始 state（不破坏现有数据）

### 涉及的代码改动

| 文件 | 改动 |
|------|------|
| `src/engine/migrate.ts` | 新建：迁移引擎 + 迁移链 |
| `src/engine/store.ts` | `loadState()` 调用 `migrateState()` |
| `src/engine/types.ts` | 新增 `StateSchema` 类型（含 `schema_version`） |
| `tests/engine/migrate.test.ts` | 新建：测试增量迁移正确性 |

---

## 📐 设计 3：Streak 乘法奖励

### 现状

我们有 streak 类成就（`streak_3`、`streak_7`、`streak_30`、`streak_100`），通过 `evalStreak` 条件评估 session.start 事件的连续天数。但：

- **Streak 是"过去时"评估**——用户不知道自己当前连续了多少天
- **Streak 没有激励机制**——只是二元标记（达成/未达成），没有"维持惯性"的动力
- **Dashboard 不展示 streak**——用户不知道自己的活跃状态

### 现有 XP 系统（对照用）

```typescript
// src/dashboard/xp.ts
XP_PER_TASK = 10
ACHIEVEMENT_XP = { common: 50, uncommon: 100, rare: 200, epic: 300, legendary: 500, mythic: 1000 }
Level = floor(sqrt(totalXp / 100))
// L1: 100 XP, L2: 400, L3: 900, L4: 1600, ..., L10: 10000
```

### 目标

在现有 XP 系统上叠加 streak multiplier，形成"每天使用 → streak 增长 → XP 加速 → 升级更快"的正向循环。

### 方案：Streak 乘法器 + Dashboard 可视化

**核心机制**：

```
achievement_xp = base_xp * streak_multiplier

streak_multiplier = min(2.0, 1.0 + (currentStreak - 1) × 0.1)
```

| 连续天数 | 乘数 | 示例：Uncommon 成就 XP |
|---------|------|---------------------|
| 1 | 1.0x | 100 XP |
| 2 | 1.1x | 110 XP |
| 3 | 1.2x | 120 XP |
| 7 | 1.6x | 160 XP |
| 11+ | **2.0x** | 200 XP（封顶）|

**Streak 判定**（参照 buddy-evolution）：

- 每天有一次 `session.start` 事件即视为"当天活跃"
- 连续每天活跃 → `currentStreak += 1`
- 同一天多次 session → 不累加
- 中断 1 天以上 → `currentStreak = 1`
- 同时记录 `longestStreak`（历史最高）

**在 Dashboard 和 `/achievements` 命令中展示**：

```
🔥 连续 7 天  |  × 1.6 XP    ┌──────────────┐
📅 最高纪录 14 天             │  Streak 进度  │
                              │  7 → 8 明天   │
                              └──────────────┘
```

**成就联动**：已有的 `streak_3`、`streak_7`、`streak_30`、`streak_100` 成就**照常工作**（通过 `evalStreak` 评估历史事件），新的 streak multiplier 是独立计算的——一个用来判定成就解锁（条件引擎），一个用来影响 XP（引擎层）。两者共享同一数据源（session.start 事件），但不互相依赖。

### 涉及的代码改动

| 文件 | 改动 |
|------|------|
| `src/engine/types.ts` | `AchievementState` 新增 `streak: { currentDays, longestDays, lastSessionDate }` |
| `src/engine/engine.ts` | `poll()` 或 `track()` 新增 streak 更新逻辑 |
| `src/engine/store.ts` | `loadState()` / `saveState()` 持久化 streak 字段 |
| `src/dashboard/xp.ts` | `calcTotalXp()` 接受 `streakMultiplier` 参数 |
| `src/dashboard/api.ts` | API 返回 streak 数据 |
| `src/dashboard/public/app.js` | Dashboard 渲染 streak 卡片 |
| `src/dashboard/public/styles.css` | Streak 卡片样式 |
| `.claude/commands/achievements.md` | `/achievements stats` 输出 streak 信息 |

### 可选的升级（不做现阶段）

- **分阶段 streak 奖励**：每达到 7 的倍数（7/14/21/28 天）额外送一次性 XP bonus
- **周末豁免**：周六日断签不算断
- **断签保护**：允许 1 天缓冲（miss 1 day → streak 冻结而非归零）

---

## 三者关系 & 建议实施顺序

```
第 1 步：数据迁移框架
    └── 不先做这个，后面加字段都在沙子上盖楼

第 2 步：Streak 乘法奖励
    └── 依赖 state.json schema 变更（加 streak 字段）
    └── 迁移框架保证老用户数据不丢
    └── 改动面最大（engine + dashboard + api + 命令文件）

第 3 步：成就解锁音效
    └── 独立模块，不涉及 schema 变更
    └── 改动面最小（notify.ts + 6 个音频文件）
    └── 可以独立开发测试，不耦合其他
```

实际上 2 和 3 可以并行开发（互不依赖），但在 1 完成后再做 2 更安全。

---

# 现有系统分析

## XP 与等级系统现状

> 2026-06-03 基准分析，为 streak multiplier 和后续数值调整提供参考

### 架构位置

XP/等级计算**不在引擎层**，而是在 Dashboard API 层（`src/dashboard/api.ts`）每次请求时即时计算。引擎层只管理成就状态和事件，不感知 XP。两个调用方都走同一路径：

```
engine.stats() → stats 数据
definitions[]  → 成就数组
events[]       → 全部历史事件
    │
    ▼
buildApiResponse() in src/dashboard/api.ts
    ├── taskCount  = events.filter('task.complete').length
    ├── totalXp    = calcTotalXp(unlockedDefs by rarity, taskCount)
    ├── level      = calcLevel(totalXp)
    ├── xpProgress = calcLevelProgress(totalXp)
    └── streak     = calcStreak(events)
```

**注意**：XP 不写入 `state.json`，纯粹是展示层派生数据。每次请求重新从成就列表 + 事件日志计算。

### XP 来源

只有两个来源，定义在 `src/dashboard/xp.ts`：

```typescript
XP_PER_TASK = 10

ACHIEVEMENT_XP = {
  common:    50,
  uncommon:  100,
  rare:      200,
  epic:      300,
  legendary: 500,
  mythic:    1000,
}

calcTotalXp(unlockedAchievements, taskCount):
  return sum(ACHIEVEMENT_XP[each.rarity]) + taskCount × XP_PER_TASK
```

**XP 不来自**：tool 调用次数、文件编辑、session 时长、token 消耗。只有两个来源。

**taskCount 计算**：统计全部历史事件中 `event_type === 'task.complete'` 的次数。这是引擎自动 emit 的（`engine.ts` 中 `track('task.complete')` 发生在 `hook.ts` 的 `TaskCompleted` 处理中）。

### 等级公式

```typescript
// Level: sqrt(totalXp / 100)，向下取整
calcLevel(totalXp) → floor(sqrt(totalXp / 100))

// Level N 需要的 XP: N² × 100
calcXpForLevel(level) → level × level × 100

// 等级进度条
calcLevelProgress(totalXp):
  current = totalXp - xpForLevel(currentLevel)
  target  = xpForLevel(nextLevel) - xpForLevel(currentLevel)
```

**完整等级表**：

| Level | XP 门槛 | 升到下一级需 | 累计 | 示例：怎样达成 |
|-------|--------|------------|------|-------------|
| **L1** | 0 | +100 | 100 | 2 个 Common 成就 |
| **L2** | 100 | +300 | 400 | 8 个 Common 成就 |
| **L3** | 400 | +500 | 900 | 14 Common + 2 Rare |
| **L4** | 900 | +700 | 1,600 | 24 Common + 4 Rare |
| **L5** | 1,600 | +900 | 2,500 | 10 Rare + 30 Common |
| **L6** | 2,500 | +1,100 | 3,600 | 3 Epic + 10 Rare + 30 Common |
| **L7** | 3,600 | +1,300 | 4,900 | 5 Epic + 10 Rare + 50 Common |
| **L8** | 4,900 | +1,500 | 6,400 | 2 Legendary + 5 Epic + 20 Rare |
| **L9** | 6,400 | +1,700 | 8,100 | 全部 160 成就 ≈ Level 11 |
| **L10** | 8,100 | +1,900 | 10,000 | |

### 当前数值问题诊断

**问题 1：升级极度靠成就解锁，task 贡献微乎其微**

一个 Common 成就 = 50 XP = 5 个 task 的价值。完成 100 个 task 才等于 1 个 Mythic 成就。task 在 XP 系统中几乎不可见——`XP_PER_TASK = 10` 对于 `N² × 100` 的等级曲线来说太边缘。

**问题 2：升级曲线过于陡峭**

`N² × 100` 意味着 Level 5 需要 2,500 XP（50 个 Common 成就），Level 10 需要 10,000 XP（200 个 Common，但只有 160 个成就）。用户解锁全部 160 个成就的理论最大 XP 约为 `48×50 + 44×100 + 30×200 + 24×300 + 9×500 + 5×1000 = 2,400 + 4,400 + 6,000 + 7,200 + 4,500 + 5,000 = 29,500`。加上 task 约几百。理论最高 Level ≈ `floor(sqrt(30000/100))` = **Level 17**。

但这需要**全成就解锁**。实际上大多数用户在 24-50 成就区间（~1,200-5,000 XP），对应 **Level 3-7**。等级区分度不足——解锁 24 成就的人 Level 3，解锁 60 成就的人才 Level 7。

**问题 3：Streak 只是 API 层的展示字段，不参与 XP 计算**

`calcStreak()` 统计事件日志中连续出现的日期数，在 API 响应中作为 `stats.streak` 返回，Dashboard 不渲染它（没有 HTML 元素对应）。它**不是引擎状态的一部分**，不写入 `state.json`，不影响 XP，也不触发任何成就条件。它是一个"只读装饰"。

**问题 4：MCP stats 工具不包含 XP/等级**

`achievement_stats` 工具返回的是 `engine.stats()` 的数据（总数、完成率、分类/稀有度分布），不含 XP、等级、streak。这些只在 Dashboard HTTP API 中计算。用户通过 MCP 查不到 XP 进度。

### 用户 24 成就的实际案例

当前 state.json 有 24 个解锁，按实际稀有度分布估算 XP：

```
Legendary: 1 × 500 = 500
Epic:      2 × 300 = 600
Rare:      3 × 200 = 600
Uncommon:  8 × 100 = 800
Common:   10 × 50  = 500
───────────────────────
成就 XP: 3,000
Task XP:  ~30 × 10 = 300
───────────────────────
Total XP: ~3,300 → Level 5 (门槛 2,500，进度 800/900)
```

一个真实用户 24 成就 = Level 5。如果达成 streak 1.6x multiplier，每次新解锁 Uncommon 成就从 100 XP 变 160 XP——仍需 4-6 个新成就才能感觉到等级变化。

### 建议：与 streak multiplier 配套的数值微调

| 调整项 | 当前值 | 建议值 | 理由 |
|--------|--------|--------|------|
| `XP_PER_TASK` | 10 | **25** | 完成 20 个 task = 1 个 Rare 成就，让 task 贡献可见 |
| 等级缩放 | `N² × 100` | 保持 | 暂时不动，曲线本身还行 |
| streak multiplier | 无 | 1.0x → 2.0x（每天 +0.1） | 叠加后 Level 5 用户每天的价值变高 |
| MCP stats 加 XP | 不返回 | 加 `level`、`total_xp` 字段 | 与 Dashboard 对齐 |
| Dashboard 显 streak | 不渲染 | Hero section 加 🔥 streak 卡片 | 可视化用户活跃状态 |

这些微调可以在做 streak multiplier 时一起落地，改动面不大（`xp.ts` 改常量 + `api.ts` 加字段 + MCP stats 加数据）。

---

# 第三轮调研：Duolingo 游戏化留存设计（2026-06-04）

> 分析 Duolingo 的 12 大游戏化机制与 7 种心理学钩子，映射到 AGPA 的可借鉴方案。

---

## 背景

Duolingo 是全球最成功的游戏化学习产品，DAU 从 2020 年的 ~5M 增长到 2024 年的 40M+，用户次日留存从 12% 提升到 55%。它的游戏化被列为"工程与设计的核心优先级"，而非表面功能。这与 AGPA 的定位高度相关——我们也是用游戏化激励"枯燥"的日常行为（编码）。

---

## Duolingo 12 大游戏化机制全景

### 1. 🔥 Streak（连胜）— 核心留存引擎

**机制**：
- 每天完成至少 1 节课，连胜 +1
- 断签 → 连胜归零（除非有 Streak Freeze）
- 2024 年降低门槛：1 节课/天（原来更严格）
- 有连胜的用户**3 倍更可能次日返回**

**心理学钩子**：损失厌恶（Loss Aversion）— 用户为保护已有的连胜天数而回来

**Duolingo 的 Streak 配套机制**：
- **Streak Freeze**（连胜冻结）— 用宝石购买，错过一天自动消耗，保护连胜不归零
- **Streak Repair**（连胜修复）— 连胜断了后，限时内完成额外任务可恢复
- **Streak Society**（连胜社团）— 长连胜用户（365 天+）进入专属俱乐部
- **Streak Wager**（连胜赌注）— 用户押注宝石，保持 7 天连胜可赢双倍

**对 AGPA 的启发**：
- ✅ **Streak Freeze 代币** — 解锁成就时偶尔奖励"冻结令牌"，自动消费保护连胜
- ✅ **Streak Repair** — 断签后 24h 内完成 3 个 task 可恢复
- ✅ **Dashboard 连胜可视化** — Hero section 加 🔥 streak 卡片（已经是之前的设计）
- 📝 **连"赌"机制** — 用户可设定"这周写 5 天代码"目标，达成获 bonus XP

---

### 2. ⚡ XP（经验值）系统

**机制**：
- 每节课获得 XP（基础 10-15 XP + 正确率 bonus）
- **XP Boost**（双倍 XP 道具）— 限时 15-30 分钟，期间所有 XP 翻倍
- XP 驱动排行榜排名，而不只是等级
- 早期解锁（6:00-12:00）自动获得 XP Boost（激励晨间学习）

**对 AGPA 的启发**：
- ✅ **XP Boost 道具** — 解锁 Epic+ 成就时偶尔奖励"2x XP 30min"，限时内解锁成就双倍 XP
- ✅ **晨间 Bonus** — 上午 session 获得 1.2x XP（`day_period` 已在 matchFilter 中可用）
- 📝 **正确率 Bonus** — 太复杂，不适配 AGPA

---

### 3. 🏆 Leagues & Leaderboards（段位联赛）

**机制**：
- **10 级段位**：Bronze → Silver → Gold → Sapphire → Ruby → Emerald → Amethyst → Pearl → Obsidian → Diamond
- **每周升降级**：前 7 名晋级，后 5 名降级
- 每周一重置，排名基于当周 XP
- Diamond Tournament：最高段位的淘汰赛（3 周，逐周淘汰）

**心理学钩子**：社会比较 + 可变奖励 + FOMO（错失恐惧）

**对 AGPA 的启发**：
- 📝 **团队周排行榜** — 同一 repo/team 成员按周 XP 排名（需要多用户系统，大工程）
- 📝 **个人周目标 vs 实际对比** — 更轻量：自己跟自己比，而非跟别人比
- ❌ 段位联赛 — 需要多用户系统，当前阶段不适合

---

### 4. ❤️ Hearts（生命值/心）

**机制**：
- 每节课 5 颗心（早期是 3 颗）
- 答错一题扣 1 心
- 心用完 = 不能继续学习，需要等回复或用宝石购买
- Super Duolingo 订阅者无限心

**心理学钩子**：稀缺性（Scarcity）— 限制制造紧张感，让每道题都有"后果"

**对 AGPA 的启发**：
- ❌ 不直接适用 — AGPA 没有"答错题"的概念
- 📝 **"专注token"概念** — 可考虑"每日深度思考配额"，消耗后需通过成就回复（太复杂，暂不考虑）

---

### 5. 💎 Gems / Lingots（虚拟货币）

**机制**：
- 完成课程 → 获得宝石
- 完成 quest → 获得宝石
- 用途：购买 Streak Freeze、Timer Boost、心回复、外观道具
- 宝石是**赚来的**不是买来的（核心设计决策）

**心理学钩子**：可变奖励（Variable Rewards）— 不知道下次会得多少宝石

**对 AGPA 的启发**：
- ✅ **AGPA 币（Token 系统）** — 解锁成就时获得 tokens，可用于：
  - Streak Freeze（保护连胜）
  - XP Boost（双倍 XP）
  - 自定义成就名（已有 /customize 功能，可考虑用 tokens 解锁）
  - 像素画头像 / 主题
- 📝 token 比宝石更有"游戏感"，且能与现有成就系统形成闭环

---

### 6. 📋 Quests（任务系统）

**机制**：
- **Daily Quests**（3 个/天）— 简单目标：完成 2 节课、得 50 XP、花 15 分钟学习
- **Monthly Quests** — 50 个 quest/月，完成获月度 badge
- **Friend Quests**（协作任务）— 与好友一起完成目标，选好友 → 共同完成 N 节课

**心理学钩子**：目标梯度效应（Goal Gradient）— 越接近目标，动力越强

**对 AGPA 的启发**：
- ✅ **Daily Quests（每日任务）** — 3 个轻量目标/天：
  - "今天编辑一个文件" (Edit tool)
  - "今天运行一次测试" (Bash + test command)
  - "今天用 agent 完成一个 task"
  - 刷新时间：每天 00:00
  - 完成奖励：少量 XP bonus
- ✅ **Weekly Challenge** — 每周一个稍大目标："本周创建 3 个 PR"、"本周 spawn 5 种不同 agent"
- 📝 **Friend Quests** — 需要多用户系统，暂不考虑

---

### 7. 🎖️ Achievements & Badges（成就与徽章）

**机制**：
- 2017 年重新设计为**分级成就**（Tiered）
- 里程碑型：学习 100 个单词 → 500 → 1000 → 2000
- 每个成就附带宝石奖励
- 在个人资料页展示

**心理学钩子**：进度可视化 + 收集欲

**对 AGPA 的启发**：
- ✅ **AGPA 已有 160 成就** — 这是我们的核心优势
- ✅ **成就分层 + 宝石奖励** — 解锁成就时附带 token 奖励
- 📝 **成就在 Dashboard profile 中展示** — Showcase 已有，但可更突出

---

### 8. 🎯 Daily Goal（每日目标）

**机制**：
- 用户自设：Casual (5min) / Regular (10min) / Serious (15min) / Insane (30min)
- 可随时调整
- Dashboard 显示今日进度环

**心理学钩子**：承诺与一致性（Commitment & Consistency）

**对 AGPA 的启发**：
- ✅ **编码目标设定** — 用户在 Dashboard 设定周目标：
  - "这周编码 5 天" → streak 追踪
  - "这周完成 3 个 task"
  - "这周解锁 2 个成就"
  - 周报：目标 vs 实际对比
- ✅ **周末报告卡片** — Session 结束时生成迷你周报："本周达成 3/5 天，解锁 2 个成就"

---

### 9. 🔔 Notifications（通知系统）

**机制**（Duolingo 的通知是多层漏斗）：
- **第一层**：App 内提醒 — "继续你的连胜！"
- **第二层**：Push 通知（基于用户最佳活跃时间的数据驱动）— "还剩 2 小时保住连胜！"
- **第三层**：邮件 — "你的周报已生成"
- **第四层（杀手锏）**：情感通知 — Duo 哭泣："这些提醒似乎没用……"

**对 AGPA 的启发**：
- ✅ **分级通知策略**：
  - L1: Dashboard 内 streak 可视化
  - L2: Session 结束时提醒"连胜还剩 X 小时"
  - L3: 系统通知（已有 macOS/Linux/Win）— 仅在解锁成就时触发
- ✅ **Fibonacci 间隔 Nudging** — 来自 claude-code-guide 的设计，与 Duolingo 的数据驱动通知异曲同工
- ✅ **"连胜告急"通知** — 如果用户当天还没 session，21:00 提醒（需 cron/外部触发，暂不可行但值得记录）

---

### 10. 🦉 Mascot（吉祥物 Duo）

**机制**：
- Duo 是品牌核心 — 绿色猫头鹰 = Duolingo
- 情感操控大师 — 开心/伤心/催促/庆祝多套表情
- Duo 的 meme 化 = 免费病毒营销
- 角色动画 + 音效加深情感连接

**心理学钩子**：拟人化（Anthropomorphism）+ 情感依附

**对 AGPA 的启发**：
- ❌ 我们没有也做不了 Duo 级别的吉祥物
- 📝 **Dashboard 角色概念** — 可考虑一个像素风格小角色，随等级进化外观（参考 buddy-evolution）
- 📝 **成就解锁时的角色反应** — "🎉 恭喜！你已经解锁了 28 个成就，Duo 为你感到骄傲"（文字+emoji 即可）

---

### 11. ⚡ Instant Feedback（即时反馈）

**机制**：
- 正确：绿色 ✓ + 音效 + 动画
- 错误：红色 ✗ + 正确展示
- 课程完成：庆祝动画 + XP 滚动 + combo 计数

**心理学钩子**：即时满足（Immediate Gratification）

**对 AGPA 的启发**：
- ✅ **我们已有**：成就解锁 → 音效（刚做的！）+ 系统弹窗 + 终端输出
- ✅ **Dashboard Toast** — 已有新成就弹窗
- 📝 **Combo 连击视觉** — 短期多个成就解锁时触发"COMBO x3"特效

---

### 12. 🤝 Social Features（社交功能）

**机制**：
- **好友系统** — 关注好友，看他们的进度和连胜
- **Friend Quest** — 协作完成目标
- **分享成就** — 社交媒体分享成就 badge
- **排行榜** — 好友间周排名

**对 AGPA 的启发**：
- ❌ 全部需要多用户系统，当前阶段不做
- 📝 未来如果 AGPA 有 cloud sync，社交功能将成为第二增长曲线

---

## 心理学钩子汇总

| # | 钩子 | Duolingo 如何用 | AGPA 可借鉴 |
|---|------|----------------|-----------|
| 1 | **损失厌恶** | Streak 断了痛 | Streak Freeze/Repair |
| 2 | **可变奖励** | XP Boost、宝石掉落随机 | Token 奖励 + 随机 XP Boost |
| 3 | **社会比较** | Leagues 升降级 | 暂不可行（需多用户）|
| 4 | **承诺与一致** | Daily Goal 自设目标 | 周目标设定 |
| 5 | **稀缺性** | 心用完了不能学 | 每日任务限时 |
| 6 | **目标梯度** | 进度条越近越想做 | Quest 进度可视化 |
| 7 | **即时满足** | 答对秒反馈 | 音效+Toast+弹窗（已有）|

---

## 从 Duolingo 到 AGPA：优先级排序

综合考虑实现复杂度 × 留存影响力，推荐实施优先级：

```
第一梯队 🔜（高影响 / 低复杂度 — 近期可做）
├── 1. Streak Freeze + Repair 令牌系统
│       └── Epic+ 成就解锁时获得 Freeze Token / Repair Token
│       └── 自动消费保护连胜
├── 2. Daily Quests（每日任务 3 个）
│       └── 每天 00:00 刷新，轻量目标（Edit/Bash/Agent task）
│       └── 完成奖励：XP bonus + 进度条
├── 3. Dashboard Streak 可视化
│       └── Hero section 🔥 卡片，预览明日 streak，显示 max streak
└── 4. Combo 连击视觉效果
        └── 短期多成就解锁 → "COMBO x3!" 动画

第二梯队 ⏳（中影响 / 中复杂度 — 后续）
├── 5. 周目标设定（Daily Goal）
│       └── "本周编码 5 天" → 进度环 + 周末报告
├── 6. Token 经济系统（AGPA Coins）
│       └── 解锁成就 → 获得 Coins → 消费 Freeze/Boost/主题
├── 7. XP Boost 道具
│       └── 解锁 Epic+ 成就 → 2x XP 30min
└── 8. Weekly Challenge
        └── 每周一个中等目标：本周编辑 10 个文件 / 跑 50 次测试

第三梯队 📝（高影响 / 高复杂度 — 远期）
├── 9. 团队周排行榜（需多用户）
├── 10. Friend Quest 协作（需多用户）
├── 11. 角色进化系统（参考 buddy-evolution）
└── 12. 晨间 Bonus / 时段敏感奖励
```

---

## 关键洞察

Duolingo 最值得 AGPA 学习的不是哪一个功能，而是**系统的分层设计哲学**：

```
Duolingo 的保留漏斗：
                        新用户
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
       每日目标         成就系统        通知提醒
    (承诺一致性)     (收集欲+进度)    (不让你忘)
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                      🔥 Streak
                   (损失厌恶 — 核心)
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
       段位联赛       Daily Quests     XP Boost
    (社会竞争)        (目标梯度)     (可变奖励)
                          │
                          ▼
                    习惯固化 → 长期留存
```

**AGPA 当前的状态**：我们有核心（160 成就），有反馈（音效+通知），但缺少**日常钩子**（daily quest、streak 保护、可变奖励）。Duolingo 告诉我们——光有成就列表不够，需要**每日理由**让用户打开工具。

**一句话总结**：Duolingo 不是"做得最好的语言学习 app"，它是"做得最好的习惯养成 app，恰好教语言"。AGPA 的目标应该类似——不是"记录编码行为的工具"，而是"帮你养成编码习惯的游戏化系统"。
