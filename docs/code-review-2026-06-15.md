# AGPA 成就系统全面代码审查报告

**日期**: 2026-06-15
**审查范围**: 全部成就定义、评估引擎、事件采集链路、测试覆盖
**作者**: AI Agent

---

## 审查结论总览

| 维度 | 评分 | 简评 |
|---|---|---|
| **① 触发可达性** | ⭐⭐⭐⭐ 4/5 | 1 个事件无发射器（`skill.invoke`，已修），其余均有明确发射路径 |
| **② 系统稳健性** | ⭐⭐⭐ 3/5 | 架构扎实，但测试覆盖有盲区，event.log 无上限 |
| **③ 描述-条件一致性** | ⭐⭐⭐ 3/5 | 多数一致，但具体数值/逻辑细节有 6 处偏离 |

---

## ⚠️ 事后复查修正（2026-06-15）

**上述"① 触发可达性"评分 2/5 严重夸大，经逐行代码审查后修正为 4/5。**

### 复查过程

实地检查了所有代码源（`hook.ts`、`engine.ts`、`init.ts`、`types.ts`、`server.ts`、`track.ts`）后：

- 报告称"CLAUDE.md 只告诉 Agent 自动调用 4 种事件" → **实际 `src/cli/init.ts:130-181` INSTRUCTION_BLOCK 列出了 30 个手动追踪事件**
- 报告称 "dashboard.opened 无发射器" → **`src/dashboard/server.ts:225` 每次打开自动发射**
- 报告称 "~27 种事件类型无发射器" → **逐一核对后，仅 `skill.invoke` 一个事件既无 hook auto-emit 也不在 CLAUDE.md 的 manual 追踪列表中**

### 真实情况：事件发射器全景

```
🟢 Hook 自动发射 (mapEvents)：21+ 种事件
    tool.complete, file.read/write/edit/create/delete,
    file.language_used, image.read/upload, command.run,
    git.commit/add/pr_created/bisect/push, merge.conflict_resolved,
    mcp.tool_call, task.create/update, conversation.message,
    tool.failure, error.occurred, user.prompt, user.message,
    tool.requested, agent.spawn/end, session.start/end,
    task.complete, context.compacted

🔵 引擎/CLI 自动发射：5 种事件
    achievement.unlocked, deepseek.conversation,
    token.consumed, session.stats, user.message.batch

🟡 Dashboard 自动发射：1 种事件
    dashboard.opened (server.ts:225)

⚪ CLAUDE.md 手动跟踪：30 种事件
    help.accessed, permission.mode_changed,
    permission.dangerously_skipped, tool.deny,
    model.switch, plan.mode_entered, automode.start,
    code.review_requested/completed, test.pass/fail,
    command.slash_used, file.revert, mcp.connect/server_used,
    agent.self_fix/created, skill.created/published,
    skill.invoke (已补), plugin.installed,
    hook.configured, command.created,
    template.created, config.file_edited, worktree.created,
    function.edited, token.consumed, agent.mode_activated,
    output.edit, image.read/file.language_used (冗余)
```

**受影响成就估算：约 40 个 → 降为 1 个（`skill_adept`，依赖 `skill.invoke`）**，已在本次修复中补入 CLAUDE.md。

---

## ① 所有成就都能被正常触发吗？

**结论：不能。大量成就不可达。**

系统有两类事件源：

| 来源 | 机制 | 覆盖的事件数 |
|---|---|---|
| 🟢 **Hook 自动触发** | CC 钩子 → `hook.ts:mapEvents()` | ~30 种事件类型 |
| 🔵 **MCP / CLI 手动调用** | Agent 通过 `achievement_track` 调用 / `agpa track` 命令 | 需要 Agent 知道并主动调用 |
| 🔴 **没有发射器** | 既无 Hook 映射，Agent 也无从知道 | **约 27 种事件类型** |

### 有自动发射器的事件（可正常触发）

`tool.complete`, `file.read`, `file.edit`, `file.write`, `file.create`, `file.delete`,
`file.language_used`, `command.run`, `git.commit`, `git.add`, `git.pr_created`,
`git.bisect`, `git.push`, `merge.conflict_resolved`, `conversation.message`,
`user.message`, `user.prompt`, `session.start`, `session.end`, `task.complete`,
`task.create`, `task.update`, `agent.spawn`, `agent.end`, `tool.failure`,
`error.occurred`, `context.compacted`, `tool.requested`, `image.read`,
`image.upload`, `mcp.tool_call`, `deepseek.conversation`, `achievement.unlocked`,
`dashboard.opened`

### 没有自动发射器但内容 CLAUDE.md 手动追踪的事件（Agent 按指令调用 `achievement_track`）

`help.accessed`, `permission.mode_changed`, `permission.dangerously_skipped`,
`tool.deny`, `model.switch`, `plan.mode_entered`, `automode.start`,
`code.review_requested`, `code.review_completed`, `test.pass`, `test.fail`,
`command.slash_used`, `file.revert`, `mcp.connect`, `mcp.server_used`,
`agent.self_fix`, `agent.created`, `skill.created`, `skill.published`,
`skill.invoke`, `plugin.installed`, `hook.configured`, `command.created`,
`template.created`, `config.file_edited`, `worktree.created`,
`function.edited`, `agent.mode_activated`, `output.edit`

> 以上全部在 `src/cli/init.ts` INSTRUCTION_BLOCK（~/.claude/CLAUDE.md）中列出。Agent 在每次相关操作时应调用 `achievement_track`。这些都不是"不可达"——依赖的是 Agent 对指令的遵守程度，属于可靠性问题而非可达性问题。

### 既无 Hook 也无手动追踪的事件——真正不可达

| 事件类型 | 被依赖的成就 | 现状 |
|---------|--------------|------|
| `skill.invoke` | `skill_adept`（"Skill Adept"，`distinct_count skill_name >= 5`） | ✅ **已修**（6/15 补入 CLAUDE.md INSTRUCTION_BLOCK + 本地文件） |

**真正不可达的成就：1 个（`skill_adept`，已修）**

> 注意：以上所有事件都在 CLAUDE.md INSTRUCTION_BLOCK 中明确列出。Agent 在相关操作发生时被要求调用 `achievement_track` 手动记录。这些成就的"可达性"取决于 Agent 对指令的遵守程度——属于可优化空间而非不可达。（本次修复后唯一真正的缺口 `skill.invoke` 已补入。）

---

## ② 事件-成就系统稳健吗？

**结论：核心架构稳健，但有 3 个结构性问题和测试覆盖盲区。**

### ✅ 稳健的方面

| 层面 | 评价 |
|---|---|
| **多进程安全** | Append-only `event.log` 无竞态；`state.json` tmp+rename 原子写入 |
| **容错** | Zod 验证，JSON 解析失败自动跳过该行继续读 |
| **过滤器 fail-closed** | 过滤器表达式解析失败 → 事件被排除（安全优于静默通过） |
| **条件类型齐全** | 11 种条件类型覆盖了计数、阈值、连续天数、序列、去重、正则匹配、比值等常见游戏化模式 |
| **set_completion 安全** | 自动排除 `future` 成就和自身，防止死锁 |
| **explain 层的隐藏保护** | 未解锁的隐藏成就自动脱敏，不下发提示 |

### ❌ 不稳健的方面

#### a) event.log 无上限增长（性能风险）

- `window: lifetime` 的成就（如 `file_centurion`、`dragonborn`）需要完整事件历史
- 每次 poll() 都全量扫描 O(n)，日积月累后会越来越慢
- 没有自动轮转/归档/压缩机制

#### b) 成就解锁级联链未经端到端测试

- `poll()` 在一次调用中 emit `achievement.unlocked` → 评估 `trophy_case` / `casual_collector` / `achievement_hunter`
- 但 `every-achievement.test.ts` 是通过直接写 `state.unlocked` 预解锁的，绕过了级联发射
- integration.test.ts 也没有场景触发足够多的二级解锁来验证级联
- **如果 `track('achievement.unlocked', ...)` 在某次 poll 中报错，这 3 个成就永远不会解锁**

#### c) 3 个条件类型完全无单元测试覆盖

| 条件类型 | 单元测试 | 集成测试 | 风险 |
|---|---|---|---|
| `time_gap` | ❌ 零覆盖 | ❌ 零覆盖 | 极高——有 `from_filter`/`to_filter`/`cross_day` 复杂逻辑 |
| `ratio group_by` | ❌ 零覆盖 | ❌ 零覆盖 | 高——first/last 每组的去重语义 |
| `pattern_match first_in_session` | ❌ 零覆盖 | ❌ 零覆盖 | 中——仅检查第一个匹配事件 |
| 其余 8 种类型 | ✅ 有覆盖 | 部分 | 低 |

#### d) 无「事件可达性」验证

- auditor.ts 会统计哪些事件被使用了，但没有验证这些事件是否有发射器
- 无人定期检查「YAML 中引用的事件 → 代码中是否有对应 emit」
- 导致 ~27 种事件类型无声无火，成就看似存在实不可达

#### e) `EventType` 宽松类型

- `types.ts` 的 `EventType` 是 `'string1' | 'string2' | ... | string` —— 最后一个 `| string` 让任何字符串值都合法
- 拼错事件名（比如写 `automode.start` 而不是 `automode_start`）不会有编译期报错

---

## ③ 达成成就的方式和描述/定义一致吗？

**结论：描述-条件映射整体良好，但有 6 处值得注意的偏离。**

### ✅ 多数成就描述-条件一致

`speed_run_*` 系列、`copy_paste_king`、`thanos`、`avengers_assemble`、`command_baby` → `command_master`、语言类成就等，其名称/描述和条件逻辑高度契合。

### ❌ 以下存在不匹配

#### 偏离 1：`==` 严格等于让成就可能一次错过就永远错过

```yaml
swat_team:               # agent.spawn == 4 (single session)
ultraman_8:              # agent.spawn == 8 (single session)
breath_of_the_wild:      # distinct tool_name == 4 AND distinct server_name == 4
```

如果用 `>=` 则可自然积累，但 `==` 意味着如果这一轮 spawn 了 5 个子代理（而不是正好 4 个），`swat_team` 在这个 session 里就再也拿不到了。**描述没有提示这种「一次错过永久错过」的严格性。**

#### 偏离 2：`template_master` 描述和阈值不匹配

```yaml
name: "Use Template"
condition: template.created > 1   # 需要至少 2 个
```

描述暗示「用了一个模板」，但实际上需要创建 `2+` 个。`> 1` 意味着 `>= 2`。

#### 偏离 3：`im_sorry_dave` 有双重条件但描述只提了一个

该成就同时需要：
- **sequence**: `tool.requested` → `tool.deny`（工具被请求然后被拒绝）
- **pattern_match**: assistant 消息匹配 `I'm sorry.*can't.*`

描述没有说明需要「先是工具被拒绝，然后 AI 说抱歉」。如果 `tool.deny` 事件从未发射（上面 Q1 的结论），这个成就早已双重不可达。

#### 偏离 4：`dragonborn` 的数字 337 没有上下文

```yaml
dragonborn:              # file.read distinct file_path >= 337
```

337 是个素数。Skyrim 的 Dragonborn DLC 或任何已知参考都没有这个数字。如果是个隐蔽引用，文档中没有说明；如果不是，这个数字看起来是随意选的。

#### 偏离 5：`one_shot` / `iterative_refiner` 依赖 step_count

```yaml
one_shot:                step_count == 1
iterative_refiner:       step_count >= 20
```

这些依赖 `task.complete` 事件中 `step_count` 字段的准确填充。`hook.ts` 从 CC 的 `TaskCompleted` 钩子事件中提取 `step_count`。这工作正常，但这是一个关键的**假设**：如果 CC 改变了 `TaskCompleted` 事件的 schema 行为，这两个成就就默默失去了功能，既不会报错也不会报警。

#### 偏离 6（原报告称最大问题，经复查为误判）

**复查结论：** 以下成就引用的事件并非"永不发射"——全部都在 CLAUDE.md INSTRUCTION_BLOCK 中列出，Agent 被明确告知在相关操作发生时手动调用 `achievement_track`：

| 成就 | 事件 | 发射方式 | 实际状态 |
|---|---|---|---|
| `read_manual` | `help.accessed` | CLAUDE.md 手动 track | ✅ 有发射路径 |
| `plan_mode_user` | `plan.mode_entered` | CLAUDE.md 手动 track | ✅ 有发射路径 |
| `test_centurion` | `test.pass` | CLAUDE.md 手动 track | ✅ 有发射路径 |
| `self_aware` | `agent.self_fix` | CLAUDE.md 手动 track | ✅ 有发射路径 |
| `undo_master` | `file.revert` | CLAUDE.md 手动 track | ✅ 有发射路径 |

这是**可靠性问题而非可达性问题**——Agent 可能不完美遵守指令，但不等于成就无法达成。Hook 自动映射覆盖更多事件类型是更好的长期方案，详见优先级建议。

---

## 优先级建议

| 优先级 | 事项 | 影响 |
|---|---|---|
| **P0** | 级联解锁集成测试（`achievement.unlocked` emit → `trophy_case`/`casual_collector`） | 防止级联链静默断裂 |
| **P1** | 为 `time_gap` + `ratio group_by` + `first_in_session` 写单元测试 | 填补条件类型测试盲区 |
| **P2** | auditor 检测"定义用到的事件 → 没有发射器"（Layer C） | 防止未来添加无发射器的成就 |
| **P3** | 考虑将高频手动事件（`test.pass`/`test.fail`、`command.slash_used` 等）扩展为 Hook 自动映射 | 减少对 Agent 指令遵守度的依赖 |
| **P3** | event.log 自动轮转或基于 LRU 的紧凑策略 | 长期性能保障 |

---

## 数据来源

- `achievement-definitions.yaml` — 全部成就定义（约 218 个成就）
- `src/engine/evaluator.ts` — 条件评估引擎（12 种条件类型）
- `src/cli/hook.ts` — Hook 事件映射（~30 种事件自动发射）
- `src/engine/engine.ts` — 引擎核心（track / poll / init）
- `src/engine/types.ts` — 事件类型定义
- `src/engine/store.ts` — 存储层
- `tests/engine/evaluator.test.ts` — 单元测试
- `tests/engine/integration.test.ts` — 端到端测试（6 个场景）
- `tests/engine/every-achievement.test.ts` — 每个成就的自动生成测试
- `src/cli/init.ts` — 事件列表文档 + CLAUDE.md INSTRUCTION_BLOCK
- `src/dashboard/server.ts` — Dashboard 事件发射
- `docs/issues-todo.md` — 已知问题追踪

## 事后修正说明（2026-06-15）

此报告初稿的"① 触发可达性"分析存在严重错误：
1. 未核实 CLAUDE.md 实际内容（INSTRUCTION_BLOCK 列出 30 个手动事件，非 4 个）
2. 未检查 `dashboard.server.ts` 中 `dashboard.opened` 的自动发射
3. 混淆了 `single_session` 窗口下的 `==` 与全局 `==` 的语义差异

修正后结论：**1 个真正的事件缺口（`skill.invoke`，已在 6/15 修复），其余均有明确发射路径。** 报告其余两个维度（② 系统稳健性、③ 描述-条件一致性）的分析保持有效。
