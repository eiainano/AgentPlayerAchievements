# AGPA 开发进度

> 最后更新: 2026-05-23

## 总体状态

MVP (v0.1) 核心功能基本完成，已超出原计划范围（原计划 CC 独占，现已完成 5 工具 init 和完整 Dashboard）。

---

## 已完成 ✅

### 核心引擎
- [x] 5 种 Evaluator：Counter、Threshold、Sequence、Streak、DistinctCount
- [x] YAML 解析器加载 109 个成就定义
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
- [x] **Claude Code Hook 自动 track**：`src/cli/hook.ts` 提供 `track`/`poll` 命令，`init.ts` 注入 `SessionStart`(→ track session.start) + `Stop`(→ track session.end && poll) hooks 到 `~/.claude/settings.json`
- [ ] **真实环境测试**：在实际 Claude Code 会话中端到端测试（需重启 CC 加载新 hooks）

### 中优先级
- [ ] **用户审阅 109 成就清单**：用户之前提到"后面手动审阅"
- [ ] **其余 4 工具的 auto-track 策略落地**

| 工具 | 策略 | 可靠性 |
|------|------|--------|
| Claude Code | Hook `SessionStart` | ⭐⭐⭐⭐⭐ |
| Hermes Agent | `on_session_end` hook | ⭐⭐⭐⭐ |
| OpenClaw | `command:new` hook | ⭐⭐⭐⭐ |
| OpenCode | `session.idle` 近似 | ⭐⭐⭐ |
| Kilo Code | 指令驱动（hook 不可调 MCP） | ⭐⭐⭐ |

- [ ] **测试覆盖**：目前测试几乎为空

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
| 成就数量 | 30 个 | 109 个全部定义 |
| Evaluator | 3 种（Counter/Sequence/Threshold） | 5 种（+Streak/DistinctCount） |
| Dashboard | 基础网格 | 完整 4 section + 主题 + 双语 |
| Event Capture | CC Hook | MCP tools 完成，auto-track 待做 |
| agpa doctor | 要求 | 未开始 |
