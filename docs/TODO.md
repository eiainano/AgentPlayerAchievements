# AGPA — 今日 TODO

> 日期: 2026-05-30 | 当前版本: v0.1.3 | 成就: 117 | Tests: 55 ✅

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
- [ ] 运行 `npm run demo` 生成 MVP 数据
- [ ] 启动 Dashboard 验证展示

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
- [ ] 但 Surgeon 还需要 `edit_lines / total_file_lines` payload，那是 item 3 的事

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

## 🔵 P3 — 扩展/维护

### 7. YAML 质量提升
- [ ] `unit: day` / `unit: tokens` 字段被忽略
- [ ] Hidden 分类占 22%，考虑调整

### 8. 测试覆盖
- [ ] 为 fix 过的 evaluator 函数补充单元测试
- [ ] hook.ts stdin 解析测试

### 9. 其余 4 工具的 auto-track 策略落地
- [ ] Hermes: `on_session_end` hook
- [ ] OpenClaw: `command:new` hook
- [ ] OpenCode: `session.idle` 近似
- [ ] Kilo Code: 指令驱动（hook 不可调 MCP）

---

## ✅ 今日计划

```
1. [x] Init 重构 + 真实环境测试 ── 修复 hooks, npm run init 即用
2. [x] storyteller 已删 ─────────── 不实现，成就数 118→117
3. [x] evalThreshold metric window ── metric 路径过滤 + single_task 边界推断
4. [x] Hook payload 字段提取 ──────── 4 成就改 AGENTS.md + 2 成就改代码
5. [x] 数据一致性问题 ────────────── P2 全清
```

> 关联文档: `docs/issues-todo.md`（Bug 追踪）、`docs/PROGRESS.md`（进度总览）
