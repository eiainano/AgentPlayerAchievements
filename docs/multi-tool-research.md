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

## Kilo Code / OpenCode 🔍 （调研完成，暂不做）

### 版本
- **Kilo Code**: v7.2.31（npm global `@kilocode/cli`）
- **OpenCode**: v1.15.1（`@anthropic-ai/opencode`）
- **关系**：OpenCode 是 Kilo Code 的开源内核，共享同一套插件体系（`@kilocode/plugin` v7.2.31）

### 插件体系

**加载顺序**（后覆盖前）：
1. 全局 config (`~/.config/kilo/config.jsonc` / `~/.config/opencode/opencode.json`)
2. 项目 config (`opencode.json`)
3. 全局插件目录 (`~/.config/opencode/plugins/`)
4. 项目插件目录 (`.opencode/plugins/`)

### Hooks API（`@kilocode/plugin` 类型定义）

| Hook | 触发时机 | 关键 Payload | 可决策？ |
|------|---------|-------------|---------|
| `tool.execute.before` | 工具调用前 | `{tool, sessionID, callID}` → mutate `output.args` | ✅ args rewrite |
| `tool.execute.after` | 工具调用后 | `{tool, sessionID, callID, args}` → mutate `output.title/output/metadata` | ✅ output rewrite |
| `chat.message` | 新用户消息 | `{sessionID, agent, model}` → mutate `output.message/parts` | ✅ |
| `chat.params` | LLM 参数发送前 | `{sessionID, model}` → mutate `output.temperature/topP/maxOutputTokens` | ✅ |
| `chat.headers` | LLM HTTP 头 | → mutate `output.headers` | ✅ |
| `permission.ask` | 权限请求 | → `output.status = "ask" \| "deny" \| "allow"` | ✅ |
| `command.execute.before` | 斜杠命令 | `{command, sessionID, arguments}` → `output.parts` | ✅ |
| `config` | 启动时 | 全量配置（只读） | ❌ |
| `event` | **全局事件总线** | 所有 Bus event（含 `session.idle` / `session.created` / `session.deleted`） | ❌ 只读 |
| `auth` | 认证注册 | 注册 OAuth / API Key 方法 | — |
| `provider` | 模型提供者注册 | 动态注入 model catalog | — |
| `shell.env` | Shell 执行前 | 注入环境变量 | ✅ |
| `experimental.chat.messages.transform` | 消息发 LLM 前 | 改写完整 message history | ✅ |
| `experimental.chat.system.transform` | System prompt 发前 | 改写 system prompt | ✅ |
| `experimental.session.compacting` | 压缩前 | 注入上下文 / 替换 compaction prompt | ✅ |
| `experimental.text.complete` | LLM 输出后 | 后处理文本 | ✅ |
| `tool.definition` | 工具定义发模型前 | 改写工具描述和参数 | ✅ |

### 核心缺陷

1. **没有 `session.start` / `session.end` hook** — 只能通过 `event` 总线监听 `session.idle` / `session.created` / `session.deleted`，但 `event` 是只读的，不适合做 track
2. **hook 内不能直接调 MCP** — Kilo Code 的 MCP 在 hook 执行期间不可用，只能：
   - 方案 A：`child_process.spawn` 调 `hook.ts track ...`
   - 方案 B：HTTP fetch 到 stats-server 间接写 event.log
3. **OpenCode 有 experimental config hooks** — `opencode.json` 里可以声明 `experimental.hook.session_completed` + shell 命令，但当前是 experimental，不可靠

### 结论

能做，但限制多。TS 插件 + shell-out 可行但不优雅。**优先级最低**——等 CC + Hermes + OpenClaw 都稳了再回来看。

---

## 对比总结

| 工具 | Shell stdin JSON | 接入难度 | 当前状态 |
|------|-----------------|---------|---------|
| Claude Code | ✅ | 低 | ✅ 已支持 |
| Hermes Agent | ✅ | 低 | ✅ 已支持 |
| OpenClaw | ❌ (TS 插件) | 中 | 🔍 调研完成 |
| Kilo Code | ❌ (TS 插件) | 高 | 🔍 调研完成，待实现 |
| OpenCode | ❌ (TS 插件) | 高 | 🔍 调研完成，待实现 |
