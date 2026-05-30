# AGPA 开发进度

> 最后更新: 2026-05-31

## 总体状态

v0.2.0 完成。OpenClaw auto-track 落地——与 CC/Hermes 对齐的三工具 auto-track 架构。117 个成就全部可达成，106 个测试全绿。

---

## 已完成 ✅

### 核心引擎
- [x] 12 种 Condition Type：Counter、Threshold（含 field 求和 + metric 表达式）、Streak、Sequence（含 consecutive 模式）、DistinctCount（含 values 白名单）、Event、SetCompletion、Mode、SequenceCount、PatternMatch、Ratio、Percentile
- [x] YAML 解析器加载 117 个成就定义（含 12 个事件驱动型，4 个不可达已删除）
- [x] PendingQueue 并发安全
- [x] MCP Tools：`achievement_track`、`achievement_poll`、`achievement_stats`、`achievement_showcase`、`achievement_config`
- [x] macOS Notification Center 弹窗（poll 时触发）
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
- [x] 展示柜（profile hero 中的 4 个槽位）

### Init CLI (`agpa init --tool <tool>`)
- [x] 5 工具全部支持

| 工具 | 配置格式 | 状态 |
|------|---------|------|
| Claude Code | JSON (`~/.claude/settings.json`) | ✅ |
| Kilo Code | JSON (`~/.config/kilo/config.jsonc`) | ✅ |
| Hermes Agent | YAML (`~/.hermes/config.yaml`) | ✅ |
| OpenCode | JSON (`~/.config/opencode/opencode.json`) | ✅ |
| OpenClaw | JSON (`~/.openclaw/openclaw.json`) | ✅ |

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
- [x] **Claude Code Hook 自动 track**：`src/cli/hook.ts` 提供 `track`/`poll`/`auto` 命令，`init.ts` 注入 9 个 hooks（含 SessionStart/Stop/PostToolUse 等）到 `~/.claude/settings.json`，支持与已有 hooks 合并
- [x] **真实环境测试**：event.log 验证 hooks 正常写入，session_id 正确传递，5 工具 MCP + 指令全绿
- [x] **`npm run init` 无参模式**：自动检测 5 工具配置文件，一键配置全部
- [x] **evaluator single_task 窗口**：用 task.complete 事件边界推断，不依赖 task_id
- [x] **evalThreshold metric 路径过滤**：now respects cond.event/filter/role/window
- [x] **computeMetric 扩展**：showcase_count + concurrent_sessions 分支
- [x] **Surgeon 成就 payload**：hook.ts 从 Edit 的 old_string + 磁盘文件自动提取 edit_lines / total_file_lines
- [x] **路径遍历 guard**：拒绝 .. 和越界绝对路径读文件
- [x] **P1 evaluator 4 项修复**：空 conditions guard、evalMode target、set_id 删除、evalStreak窗口/field/same_target
- [x] **P2 数据一致性**：milestone 命名、set 成员补全、缺失 set 字段、im_sorry_dave 窗口
- [x] **测试覆盖**：81 tests, 6 files（evaluator 43 + integration 4 + yaml-parser 6 + api 5 + xp 6 + hook 17）

### 中优先级
- [ ] **用户审阅 117 成就清单**：用户之前提到"后面手动审阅"
- [ ] **其余 3 工具的 auto-track 策略落地**

| 工具 | 策略 | 可靠性 |
|------|------|--------|
| Claude Code | Hook `SessionStart` | ⭐⭐⭐⭐⭐ |
| Hermes Agent | Shell hooks (4 events) | ⭐⭐⭐⭐⭐ |
| OpenClaw | TS 插件 (36 hooks) | ⭐⭐⭐⭐⭐ | ✅ v0.2.0 完成 |
| OpenCode | TS 插件 (event bus) | ⭐⭐⭐ | ⏸ 待调研 |
| Kilo Code | TS 插件 (hook不可调MCP) | ⭐⭐ | ⏸ 待调研 |

### 低优先级（v1.0）
- [ ] 全球统计 opt-in + 稀有度动态计算
- [ ] agpa export/import
- [ ] 响应式布局（手机可看）
- [ ] Legendary 呼吸光效 / Mythic 烟花动画
- [ ] 多 profile 支持

---

## 版本对比

| 维度 | MVP 原计划 | 当前实际 |
|------|-----------|---------|
| 工具支持 | Claude Code 独占 | 5 工具 init 完成 |
| 成就数量 | 30 个 | 117 个全部可达成 |
| Evaluator | 3 种 | 12 种全部实现 |
| Dashboard | 基础网格 | 完整 4 section + 主题 + 双语 |
| Event Capture | CC Hook | 9 hooks auto-track + 27 手动 track |
| Init | 手动 --tool claude-code | `npm run init` 一键 5 工具 |
| single_task 窗口 | — | task.complete 边界推断 |
