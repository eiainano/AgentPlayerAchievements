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
