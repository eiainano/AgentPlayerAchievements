# 多工具 Auto-Track 调研

> 日期: 2026-05-31 | AGPA v0.1.3

---

## Claude Code ✅

- **接入方式**：9 个 hooks in `~/.claude/settings.json`
- **事件**：`SessionStart/Stop`, `PostToolUse/PreToolUse/PostToolUseFailure`, `TaskCompleted`, `SubagentStart/Stop`, `PostCompact`
- **stdin 协议**：`{hook_event_name, tool_name, tool_input: {file_path, command, old_string, ...}, session_id, ...}`

---

## Hermes Agent ✅

- **版本**：v0.15.0 (2026.5.28)
- **接入方式**：Shell hooks via `~/.hermes/config.yaml`
- **格式**：`hooks:` block → `pre_tool_call / post_tool_call / on_session_start / on_session_end`
  - 每个事件是数组，包含 `matcher` + `command` + `timeout`
- **stdin 协议**：`{hook_event_name, tool_name, tool_input: {path, content, ...}, session_id, cwd, extra: {task_id, result, ...}}`
- **AGPA 适配**：`hermes-auto` 命令负责翻译层（事件名 + 工具名 + 字段名映射）
- **覆盖**：`pre_tool_call` → PreToolUse, `post_tool_call` → PostToolUse, `on_session_start` → SessionStart, `on_session_end` → SessionEnd

---

## OpenClaw 🔍 （调研完成，暂不做）

- **版本**：2026.5.27（已从 2026.4.14 更新）
- **接入方式**：TypeScript 插件 in `~/.openclaw/extensions/`
- **注册 API**：`api.on("hook_name", handler, {priority, timeoutMs})`
- **核心事件**（36 个 total）：

| Hook | Payload | 可决策 |
|------|---------|--------|
| `session_start` | `{sessionId, sessionKey, resumedFrom}` | ❌ |
| `session_end` | `{sessionId, sessionKey, messageCount, durationMs, reason}` | ❌ |
| `before_tool_call` | `{toolName, params, runId, toolCallId, derivedPaths}` | ✅ block / params rewrite / requireApproval |
| `after_tool_call` | `{toolName, params, result, error, durationMs, runId, toolCallId}` | ❌ |
| `agent_end` | `{runId, messages, success, error, durationMs}` | ❌ |

- **不能复用 CC/Hermes 模式**：没有 shell stdin JSON，必须是 in-process TS 插件
- **接入方案**：写最小插件，`api.on(...)` 中用 `child_process.spawn` 调 `hook.ts track ...` 或直接用 MCP client 调 `achievement_track`
- **工具名映射**：OpenClaw 用 `read_file/write_file/apply_patch/bash` 等，和 CC/Hermes 类似
- **结论**：能做，但投入比 Hermes 大。等有需求再动手。

---

## Kilo Code / OpenCode ⏸

- **Kilo Code**：v7.2.31，插件体系`.tool.execute.before` / `tool.execute.after` + SSE event bus
- **OpenCode**：v1.15.1，Kilo Code 开源内核，同体系
- **接入方式**：TypeScript 插件
- **限制**：hook 内不能调 MCP tool（架构限制），只能用指令驱动
- **结论**：能做，但效果打折。低优先级。

---

## 对比总结

| 工具 | Shell stdin JSON | 接入难度 | 当前状态 |
|------|-----------------|---------|---------|
| Claude Code | ✅ | 低 | ✅ 已支持 |
| Hermes Agent | ✅ | 低 | ✅ 已支持 |
| OpenClaw | ❌ (TS 插件) | 中 | 🔍 调研完成 |
| Kilo Code | ❌ (TS 插件) | 高 | ⏸ 待调研 |
| OpenCode | ❌ (TS 插件) | 高 | ⏸ 待调研 |
