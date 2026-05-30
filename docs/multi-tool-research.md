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

## OpenClaw 🛠️（方案已定，待实现）

- **版本**：2026.5.27
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

### 为什么不能复用 CC/Hermes 模式

CC 和 Hermes 的 hook 管理器会**自己 spawn 子进程并把事件 JSON 写到子进程 stdin**——hook.ts 只管 `readFileSync(0)` 读取即可。

OpenClaw 是 **in-process 回调**——`api.on("after_tool_call", (payload) => {...})` 在 OpenClaw 自己的 Node 进程里直接拿到 JS 对象。**没有"hook 管理器帮你调"这回事**——你必须自己在回调里把数据送出去。

### 接入方案：插件 spawn hook.ts + stdin pipe

写一个极薄插件（~40 行 TS），在 `api.on(...)` 回调中**自己 spawn hook.ts 子进程，通过 stdin pipe 传入 JSON**——与 CC/Hermes 完全统一的数据流：

```
OpenClaw 进程
┌────────────┐  api.on callback  ┌───────────────┐  spawn + stdin  ┌──────────┐
│ after_tool │ ────────────────→ │ agpa-track.ts │ ──────────────→ │ hook.ts  │ → event.log
│ _call hook │  JS 对象直接传入    │ (我们的插件)    │  JSON → fd 0    │ 读取 stdin│
└────────────┘                   └───────────────┘                 └──────────┘
```

- **插件**只管 `api.on(...)` 注册 + spawn 子进程（`detached: true` + `unref()`，非阻塞）
- **hook.ts** 新增 `openclaw-auto` 命令，负责翻译层（字段映射 → CC 标准格式 → `mapEvents()`）
- **翻译层**与 Hermes 的 `normalizeHermesStdin()` 同模式：工具名映射（`read_file`→`Read` 等）、字段映射（`toolName`→`tool_name`、`params.path`→`tool_input.file_path` 等）
- **MCP 通道不受影响**：auto-track 覆盖工具调用类事件，AGENTS.md 手动 track 继续覆盖语义类事件——与 CC/Hermes 对齐

### 工具名映射

| OpenClaw | CC 标准 |
|----------|--------|
| `read_file` | `Read` |
| `write_file` | `Write` |
| `apply_patch` | `Edit` |
| `bash` | `Bash` |
| `glob` | `Glob` |
| `grep` | `Grep` |

---

## Kilo Code / OpenCode 🔍 （调研完成，暂不做）

### 关系

**本质上是同一个产品**。OpenCode v1.15.1 是 Kilo Code 的 rebrand + 原生 Mach-O 二进制打包版本：
- 共享同一个插件 API 结构（类型定义仅 2 行 import 路径不同：`@kilocode/sdk` ↔ `@opencode-ai/sdk`）
- 其余 300+ 行 hooks 类型定义完全一致
- 二进制内同时包含 `opencode.ai` 和 `kilocode` 引用

### 版本
- **Kilo Code**: v7.2.31（npm `@kilocode/cli`，JS 脚本）
- **OpenCode**: v1.15.1（Mach-O 二进制，`~/.opencode/bin/opencode`）
- **插件包**: Kilo 用 `@kilocode/plugin` v7.2.31，OpenCode 用 `@opencode-ai/plugin` v1.14.22（import 路径不同，API 一致）
1. 全局 config (`~/.config/kilo/config.jsonc` / `~/.config/opencode/opencode.json`)
2. 项目 config (`opencode.json`)
3. 全局插件目录
4. 项目插件目录 (`.opencode/plugins/` / `.kilo/plugin/`)

### Hooks API（`@kilocode/plugin` / `@opencode-ai/plugin` — 同一套 hook key 列表）

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

Kilo Code 和 OpenCode 是同一产品的两个发行版本。TS 插件方式能做但限制多：无 session 生命周期 hook + 无 MCP 访问。**优先级最低**——等 CC + Hermes + OpenClaw 稳了再说。

---

## 对比总结

| 工具 | Shell stdin JSON | 接入难度 | 当前状态 |
|------|-----------------|---------|---------|
| Claude Code | ✅ | 低 | ✅ 已支持 |
| Hermes Agent | ✅ | 低 | ✅ 已支持 |
| OpenClaw | ❌ (TS 插件) | 中 | 🔍 调研完成 |
| Kilo Code / OpenCode | ❌ (TS 插件) | 高 | 🔍 调研完成（同一产品） |
