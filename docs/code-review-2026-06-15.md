# AGPA 成就系统全面代码审查报告

**日期**: 2026-06-15
**审查范围**: 全部成就定义、评估引擎、事件采集链路、测试覆盖
**作者**: AI Agent

---

## 审查结论总览

| 维度 | 评分 | 简评 |
|---|---|---|
| **① 触发可达性** | ⭐⭐ 2/5 | ~1/4 成就在正常使用中不可达 |
| **② 系统稳健性** | ⭐⭐⭐ 3/5 | 架构扎实，但测试覆盖有盲区，event.log 无上限 |
| **③ 描述-条件一致性** | ⭐⭐⭐ 3/5 | 多数一致，但具体数值/逻辑细节有 6 处偏离 |

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

### 既无 Hook 也无自动发射器的事件——成就在正常使用中不可达

| 事件类型 | 被依赖的成就 | 现状 |
|---|---|---|
| `help.accessed` | `read_manual` ("Read the Manual") | 🔴 无发射器 |
| `permission.mode_changed` | `permission_granted` ("Permission Granted") | 🔴 无发射器 |
| `permission.dangerously_skipped` | `hold_my_beer`, `true_vibe_coder` | 🔴 无发射器 |
| `tool.deny` | `ill_do_it_myself`, `the_negotiator`, `full_auto`（部分）, `im_sorry_dave` | 🔴 无发射器 |
| `model.switch` | `model_hopper`, `multi_model` | 🔴 无发射器 |
| `plan.mode_entered` | `plan_mode_user`, `plan_strategist`, `the_switch` | 🔴 无发射器 |
| `automode.start` | `automode_first`, `clockwork_orange` | 🔴 无发射器 |
| `code.review_requested` | `code_reviewer`, `review_regular` | 🔴 无发射器 |
| `code.review_completed` | `deep_review` | 🔴 无发射器 |
| `test.pass` | `test_centurion`, `test_champion`, `speed_run_*`, `first_try`, `the_debugger`, `triple_debugger` | 🔴 无发射器 |
| `test.fail` | `the_debugger`, `triple_debugger` | 🔴 无发射器 |
| `command.slash_used` | `first_shot`, `slash_commander` | 🔴 无发射器 |
| `file.revert` | `undo_master`, `u_turn` | 🔴 无发射器 |
| `mcp.connect` | `mcp_first_connect` | 🔴 无发射器 |
| `mcp.server_used` | `mcp_first_contact`, `mcp_explorer` | 🔴 无发射器 |
| `agent.self_fix` | `self_aware`, `the_debugger`, `triple_debugger` | 🔴 无发射器 |
| `agent.created` | `agent_architect` | 🔴 无发射器 |
| `skill.created` / `skill.published` / `skill.invoke` | `skill_creator`, `skill_publisher`, `skill_adept` | 🔴 无发射器 |
| `plugin.installed` | `plugin_explorer` | 🔴 无发射器 |
| `hook.configured` | `hooks_master` | 🔴 无发射器 |
| `template.created` | `template_master` | 🔴 无发射器 |
| `command.created` | `command_crafter`, `command_library` | 🔴 无发射器 |
| `worktree.created` | `worktree_trial` | 🔴 无发射器 |
| `config.file_edited` | `tinkerer` | 🔴 无发射器 |
| `function.edited` | `perfectionist` | 🔴 无发射器 |

**受影响的成就累计约 40+ 个** —— 占全部成就的近 1/4。

> 注意：`init.ts` 中确实列出了所有这些事件类型，并说明它们需要手动触发。但 **CLAUDE.md 只告诉 Agent 自动调用 4 种事件**（session.start、user.message、task.complete、tool.complete）—— 其余事件 Agent 不知道也不会调用。所以这些成就在正常使用中不可达，除非用户手动 `agpa track <event>` 或有人扩展 Hook 映射。

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

#### 偏离 6（最重要）：~40 个成就引用从未发射的事件

最大的描述-条件不匹配：

| 成就 | 描述（暗示可达成） | 实际 | 严重程度 |
|---|---|---|---|
| `read_manual` | "Read the Manual" → 你读了手册吗？ | `help.accessed` 事件永不发射 | HIGH |
| `plan_mode_user` | "Strategy Master" → 你用计划模式吗？ | `plan.mode_entered` 永不发射 | HIGH |
| `test_centurion` | "Green Bar" → 你通过了 100 次测试？ | `test.pass` 永不发射 | HIGH |
| `self_aware` | "Self-Aware" → Agent 自我修复？ | `agent.self_fix` 永不发射 | HIGH |
| `undo_master` | "Take back a Move" → 你回退过文件吗？ | `file.revert` 永不发射 | HIGH |

这些成就描述承诺了一种成就体验，但正常使用完全无法实现。

---

## 优先级建议

| 优先级 | 事项 | 影响 |
|---|---|---|
| **P0** | 为 Hook 增加 `tool.deny`、`permission.*`、`plan.mode_entered`、`model.switch`、`automode.start` 的映射 | 解决 10+ 不可达成就 |
| **P0** | 在 `engine.ts` 中 auto-emit `achievement.unlocked` 的级联集成测试 | 防止级联链静默断裂 |
| **P1** | 为 `time_gap` + `ratio group_by` + `first_in_session` 写单元测试 | 填补条件类型测试盲区 |
| **P1** | 实现测试结果的 auto-emit（`test.pass` / `test.fail`，从 Bash 命令输出解析） | 解决 speed_run、the_debugger 等基础成就 |
| **P2** | 添加 auditor/verify 插件来检测「定义用到的事件 → 没有发射器」 | 防止未来继续添加不可达成就 |
| **P2** | 统一 `==` vs `>=` 的设计原则，让 swat_team/ultraman_8 更宽容 | 改善用户体验 |
| **P3** | event.log 自动轮转或基于 LRU 的紧凑策略 | 长期性能保障 |

---

## 数据来源

- `achievement-definitions.yaml` — 全部成就定义（约 154 个成就）
- `src/engine/evaluator.ts` — 条件评估引擎（11 种条件类型）
- `src/cli/hook.ts` — Hook 事件映射（~30 种事件自动发射）
- `src/engine/engine.ts` — 引擎核心（track / poll / init）
- `src/engine/types.ts` — 事件类型定义
- `src/engine/store.ts` — 存储层
- `tests/engine/evaluator.test.ts` — 单元测试
- `tests/engine/integration.test.ts` — 端到端测试（6 个场景）
- `tests/engine/every-achievement.test.ts` — 每个成就的自动生成测试
- `src/cli/init.ts` — 事件列表文档
- `docs/issues-todo.md` — 已知问题追踪
