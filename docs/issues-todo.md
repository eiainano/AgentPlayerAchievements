# Achievement System Issues & TODOs

> 最后更新: 2026-05-30 | 总成就数: 117 | 条件类型: 12

---

## P0 — 逻辑 Bug（影响成就正确性）

- [x] **evalStreak 忽略 filter** — `ten_task_no_edit` 的 `filter: "manual_edits == 0"` 静默无效，streak 函数从来不读 `cond.filter`。成就变成普通 10 天连续而非"无手动编辑的连续天"。
- [x] **evalStreak 忽略 operator** — 第 274 行写死 `>=`，YAML 里所有 streak 的 `operator` 字段等于无操作。
- [x] **set_completion 不支持 `all` / `exclude_hidden`** — parser 不解构这两个字段，evaluator 也不认识。`completionist_gold`(exclude_hidden) 和 `mythic_completionist`(all) 回退到 `rarity: common`，跟 `completionist_bronze` 同条件，三个普通等级同时解锁。
- [x] **max_per_day 被丢** — `daily_checkin` 第二个条件 `max_per_day: 1` 不在 Condition 接口中，parser 丢弃，evaluator 永远返回 true。成就退化为纯 15 天 streak。
- [x] **swat_team 逻辑矛盾** — `agent.spawn >= 2` + `agent.spawn <= 4` 无窗口，第 5 个 spawn 后 `<=4` 永久 false。已加 `window: single_session` + evaluator 支持 session_id 过滤，每次 session 独立计数。
- [x] **很多成就丢 window 默认用 24h** — 25 个 lifetime 成就已加 `window: all`。parseWindow 支持 `all`/`lifetime` 返回 Infinity。

---

## P1 — 事件覆盖缺口

- [x] **`plan.mode_activated` 无人 track** — `the_switch` 序列第一步永远匹配不上。AGENTS.md 里已有 `plan.mode_entered`（进 plan 模式），但 YAML 写的是 `plan.mode_activated`。两种修法：① 把 YAML 改成 `plan.mode_entered` ② AGENTS.md 补一个 `plan.mode_activated`。推荐①——`plan.mode_entered` 已经存在，语义一致。
- [x] **`achievement.shared` 无人 track** — storyteller 已删除（不实现）。AGENTS.md 无需补事件。
- [x] **`agent.complete` emit 了没人用** — SubagentStop 不再 emit agent.complete 事件。hook.ts 中 SubagentStop case 返回空数组（无成就依赖此事件）。
- [x] **`git.revert_all` 在 AGENTS.md 但没成就用** — `scorched_earth` 删掉后就没消费者了。如果短期不打算加新成就，可以从 AGENTS.md 删掉这条。

---

## P1 — Hook 不提取的 payload 字段（成就永远匹配不上）

- [x] **`file_type` 不被 hook 提取** — visual_prompt + image_whisperer: YAML 改为 `event: image.read`，AGENTS.md 加手动 track 指令。
- [x] **`language` 不被 hook 提取** — polyglot: YAML 改为 `event: file.language_used`，AGENTS.md 加手动 track `{ language }` 指令。
- [x] **`function_name` 不被 hook 提取** — perfectionist: YAML 改为 `event: function.edited`，AGENTS.md 加手动 track `{ function_name }` 指令。
- [x] **`showcase_count` 无数据源** — trophy_case: `computeMetric` 加分支读 `showcase.json` 非空槽位数。
- [x] **`concurrent_sessions` 无数据源** — parallel_universe: `computeMetric` 加分支统计 1h 内唯一 session_id 数。

---

## P1 — Evaluator 功能缺口

- [x] **sequence（非连续模式）忽略 window** — `the_debugger`、`the_switch`、`full_cycle`、`true_vibe_coder`、`u_turn`、`the_negotiator` 在 YAML 里指定了 `window: single_task` 或 `single_session`，但标准有序 sequence 分支不读 window。事件跨多天也不会重置。
- [x] **evalThreshold metric 路径忽略 window/filter/event/role** — metric 分支现在做完整的 event/window/filter/role 过滤，`single_task` 用 task.complete 边界推断，`same_task` 也被正确识别。
- [x] **空 conditions 数组提前解锁** — guard: `if (def.conditions.length === 0) continue;`
- [x] **evalMode 提前返回 target 不一致** — 无事件路径改为 `Math.round((cond.threshold ?? cond.value) * 100)`
- [ ] **evalPercentile 硬编码回退阈值** — HOLD，等 telemetry 基础设施。当前 2 个 percentile 成就刚好命中唯一回退值。
- [ ] **matchFilter 上下文只有 8 个字段** — HOLD。受影响成就已改为手动 track，无实际影响。
- [x] **`evalStreak` 日历日 vs 事件连续** — Condition 加 `event_level` 字段。`ten_task_no_edit` 设 `event_level: true` 后按连续事件计数，不再按日历日。
- [x] **Condition.set_id 字段** — 从 types.ts + yaml-parser.ts 删除，dead code。

---

## P2 — 数据一致性

- [x] **Category 枚举** — YAML `milestone` → `milestones`，与 Dashboard 对齐，8 成就修复。
- [x] **`bounce_back`** — 加入 agent_commander 的 achievements 列表。
- [x] **`mythic_completionist`** — 加入 completionist 的 achievements 列表。
- [x] **8 个成就缺 `set:` 字段** — the_beginning ×4 / collectors_soul ×1 / devops_triad ×3 已补。
- [x] **`im_sorry_dave` 无时间窗口** — 两个 condition 加 `window: single_session`。
- [x] **`evalStreak` 不读 role/window/field/same_target** — scopeEvents + window/filter + field/same_target 支持已补。

---

## P3 — YAML 质量提示（非阻塞）

- [x] **`unit: day` / `unit: tokens` 字段** — Condition 接口 + parser 已支持 `unit` 字段。元数据标注，不影响评估逻辑，YAML 中 6 处使用全部保留。
- [ ] **Hidden 分类占 22%** — 26 个隐藏成就是最大分类，可以考虑挪几个非隐藏的到更合适的分类。

---

## 已解决 ✓

- [x] ~~evaluator threshold 错映射到 evalCounter~~ — 5/29 修好
- [x] ~~sequence 不支持 consecutive/count~~ — 5/29 修好
- [x] ~~distinct_count 忽略 values 白名单~~ — 5/29 修好
- [x] ~~counter 忽略 same_target~~ — 5/29 修好
- [x] ~~hook 补 4 个事件映射~~ — 5/29 修好（task.complete/context.compacted/file.write/tool.requested）
- [x] ~~AGENTS.md 补充 24 个手动 track 事件~~ — 5/29-5/30 修好
- [x] ~~12 个事件驱动型新成就~~ — 5/30 添加（Pipemaster/Command Baby/Cerberus/Fail Forward/Bounce Back/Phoenix/MCP Connoisseur/MCP Collector/Command Master/Failure Mother/Delegator/SWAT Team）
- [x] ~~3 个不可达成就删除~~ — 5/30 删掉（perfect_review/photographic_memory/scorched_earth）
- [x] ~~Dashboard 中英双语~~ — 5/29 完成
- [x] ~~MCP context 硬编码~~ — 5/29 修好
