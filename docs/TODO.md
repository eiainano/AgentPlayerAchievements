# AGPA — 今日 TODO

> 日期: 2026-05-31 | 当前版本: v0.1.3 | 成就: 117 | Tests: 81 ✅

---

## 🔴 P0 — 今日最高优

### 1. ✅ 真实环境测试 + Init 重构
**发现了根因：hook 从未被注入，init.ts 遇到已有 hook key 直接跳过不合并。**

已修复：
- [x] **`init.ts` 无参自动检测** — `npm run init` 即可，扫描 5 工具 config 文件
- [x] **Hook 合并注入** — 不再 `if (!key)` 跳过整个 key，而是追加 AGPA 命令到已有 hooks
- [x] **幂等** — 检测已有 AGPA 命令不重复注入
- [x] **确认 auto-track 工作** — event.log 从 1→17 条，session_id 不再是硬编码 demo-session
- [x] **doctor 全绿** — 5 工具 MCP + 指令全部正常
- [x] ~~demo/Dashboard 验证~~ — 跳过。系统已验证通过（hooks 工作、55 tests green、doctor 全绿）

---

## 🟡 P1 — 事件/数据缺口

### 2. ✅ storyteller 已删（不实现）

### 3. ✅ Hook 不提取 payload 字段（全部修好）
| 成就 | 修法 |
|------|------|
| visual_prompt / image_whisperer | YAML: `tool.complete` → `image.read`，AGENTS.md: Agent 读图时手动 track |
| polyglot | YAML: `file.create` → `file.language_used`，AGENTS.md: 创建文件时手动 track `{ language }` |
| perfectionist | YAML: `file.edit` → `function.edited`，AGENTS.md: 编辑函数时手动 track `{ function_name }` |
| trophy_case | 代码: `computeMetric` 加 `showcase_count` 分支，读 `showcase.json` 非空槽位数 |
| parallel_universe | 代码: `computeMetric` 加 `concurrent_sessions` 分支，统计 1h 内唯一 session_id 数 |

### 4. ✅ evalThreshold metric 路径 + single_task 窗口 → 修好了
- [x] **metric 路径过滤** — 现在读 cond.event / filter / role / window（非 session 窗口）
- [x] **single_task 边界推断** — scopeEvents 用 task.complete 事件作为边界，不需要每个事件带 task_id
- [x] **same_task 支持** — 之前 isTaskWindow 不认识 same_task，现在有了
- [x] **Surgeon payload** — hook.ts now extracts `edit_lines` (from old_string) and `total_file_lines` (from file on disk) for Edit tool events

---

## 🟢 P2 — 数据一致性

### 5. ✅ 数据一致性 — 全部修好
- [x] Category `milestone` → `milestones`（YAML 统一为复数，匹配 Dashboard）
- [x] bounce_back → 加入 agent_commander 的 achievements 列表
- [x] mythic_completionist → 加入 completionist 的 achievements 列表
- [x] 8 个成就补上 `set:` 字段（the_beginning ×4 / collectors_soul ×1 / devops_triad ×3）

### 6. ✅ `im_sorry_dave` 加窗口
- [x] 两个 condition 都加了 `window: single_session`

---

## 🟡 P1 — Evaluator 边角问题 (3 HOLD + 4 已修)

### ✅ 7. 已修
- [x] 空 conditions 提前解锁 — guard added
- [x] evalMode target 不一致 — 统一为 `Math.round((cond.threshold ?? cond.value) * 100)`
- [x] Condition.set_id 死代码 — 从 types.ts + yaml-parser.ts 删除
- [x] evalStreak 不读 window/field/same_target — scopeEvents + window + field/same_target 支持已补

### ⏸ HOLD
- [ ] evalPercentile 硬编码回退 — 当前 2 个成就刚好命中，等 telemetry 基础设施
- [ ] matchFilter 上下文只有 8 个字段 — 受影响成就已改手动 track，无影响

### ✅ evalStreak 事件连续
- [x] **event_level 模式** — Condition 加 `event_level: true`，evalStreak 按连续事件计数而非日历日
- [x] **ten_task_no_edit 修复** — YAML 加 `event_level: true`，10 个 task 零手动编辑按事件连续而非天数

---

## 🔵 P3 — 扩展/维护

### 7. ✅ YAML 质量提升
- [x] `unit: day` / `unit: tokens` — Condition 接口 + parser 已支持 `unit` 字段（元数据标注，不影响评估逻辑）
- [ ] Hidden 分类占 22%，考虑调整

### 8. ✅ 测试覆盖
- [x] evaluator 函数单测 — metric filtering×3、single_task/same_task×2、empty conditions、streak window、streak same_target
- [x] hook.ts 测试 — mapEvents×16 覆盖全部 10 种 CC hook→AGPA 事件映射

### 9. ✅ Hermes Agent auto-track 落地
- [x] **hermes-auto 命令** — hook.ts 翻译层（事件名/工具名/字段名映射）
- [x] **Shell hook 注入** — init.ts 注入 4 个 hooks 到 ~/.hermes/config.yaml

### 10. 🔍 OpenClaw 调研完成（暂不做适配）
- [x] 版本已更新：2026.4.14 → **2026.5.27**
- [x] Hook 系统：36 个事件，含 `before_tool_call` / `after_tool_call` / `session_start` / `session_end` / `agent_end`
- **暂不做**：接入需写 TypeScript 插件（非 shell stdin JSON 模式），投入 > Hermes

### 11. 🔍 Kilo Code / OpenCode 调研完成（暂不做）
- [x] **Kilo Code v7.2.31**：`@kilocode/plugin`，`tool.execute.before/after` + `event` 总线 + 17 hooks
- [x] **OpenCode v1.15.1**：同插件体系，额外有 `experimental.hook` config 选项
- **暂不做**：无 `session.start/end` hook，hook 内不可调 MCP，需 shell-out 或 HTTP fetch，投入大

---

## ✅ 今日计划

```
1. [x] Init 重构 + 真实环境测试 ── 修复 hooks, npm run init 即用
2. [x] storyteller 已删 ─────────── 不实现，成就数 118→117
3. [x] evalThreshold metric window ── metric 路径过滤 + single_task 边界推断
4. [x] Hook payload 字段提取 ──────── 4 成就改 AGENTS.md + 2 成就改代码
5. [x] 数据一致性问题 ────────────── P2 全清
6. [x] P1 evaluator 4 项 ────────── 空 conditions + mode target + set_id + streak 窗口
7. [x] Surgeon edit_lines payload ── hook.ts 自动提取，零 AGENTS.md 依赖
8. [x] 路径遍历 guard ────────────── cwd/home 边界，拒绝 .. 和越界路径
9. [x] +26 单元测试 ──────────────── 81 tests, 6 files
10. [x] evalStreak event_level ────── 事件连续模式，ten_task_no_edit 修复
```

> 关联文档: `docs/issues-todo.md`（Bug 追踪）、`docs/PROGRESS.md`（进度总览）
