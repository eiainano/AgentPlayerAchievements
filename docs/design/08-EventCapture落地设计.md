# Event Capture 落地方案：从事件发生到 event.log

> 文档目的：定义事件从 Agent 工具内部发生，经过 agpa 捕获、标准化，最终落地到 event.log 的完整链路

---

## 一、事件捕获总链路

```
Agent 工具内部动作
      │
      ├── Hook 触发（CC Only）
      │   │
      │   ▼
      │   agpa track <event_type> --param1 val1 --param2 val2
      │      │
      │      ├── agpa (CLI 模式)
      │      │   ├── argv 解析 → 构造 event 对象
      │      │   ├── 校验 event_type + payload
      │      │   └── 追加到 event.log（O_APPEND）
      │      │
      ├── MCP tool 调用（All tools）
      │   │
      │   ▼
      │   achievement.track(event_type, payload)  ← agent 按指令调用
      │      │
      │      ├── agpa (MCP 模式)
      │      │   ├── JSON-RPC handler 收到请求
      │      │   ├── 构造 event 对象
      │      │   ├── 校验 event_type + payload
      │      │   └── 追加到 event.log（O_APPEND）
      │      │
      └── 人工调用
          │
          ▼
          $ agpa track session.start --duration 3600
```

**两种模式（CLI / MCP）的 event 构建路径完全一致**，区别只在于入口：

```
CLI 入口:  argv → parseNamedArgs() → buildEvent() → validate() → append()
MCP 入口:  JSON-RPC params → buildEvent() → validate() → append()
          ↑ 共享同一段校验 + 写入逻辑
```

---

## 二、agpa track CLI 规范

### 调用格式

```bash
agpa track <event_type> [--key value ...]
```

### 三路入参

| 入口 | 调用者 | 示例 |
|------|--------|------|
| **进程参数** | CC Hook、shell 脚本 | `agpa track tool.complete --tool Bash --result ok` |
| **stdin JSON** | 管道工具、wrapper | `echo '{"event_type":"session.end","duration":3600}' \| agpa track --stdin` |
| **环境变量** | CC Hook（$CLAUDE_*） | 见下文环境变量提升部分 |

### 参数 → 事件对象映射

```
agpa track tool.complete --tool Bash --result ok --session abc-123

→ event object:
{
  "protocol_version": "1.0",
  "event_id": "auto-generated-uuid",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "tool_source": "infer|cli-arg",
  "event_type": "tool.complete",
  "payload": {
    "tool_name": "Bash",
    "tool_result_summary": "ok"
  },
  "context": {
    "session_id": "abc-123",
    "model": "unknown",
    "step_number": null
  }
}
```

**命名参数到 payload 的映射规则**：

```
--tool value        → payload.tool_name = value
--result value      → payload.tool_result_summary = value
--tool_source value → event.tool_source = value
--duration value    → payload.duration_ms = int(value)
--session value     → context.session_id = value
--model value       → context.model = value
--step value        → context.step_number = int(value)
--task value        → context.task_id = value

--event_id value    → event.event_id = value  （罕见，只用于手动回放历史）
--timestamp value   → event.timestamp = value （罕见，只用于手动回放历史）

其他未识别的 --key value → payload.key = value
```

### 校验规则

```
event_type 必须是标准化协议中的已注册类型:
  session.start | session.end | task.start | task.complete | task.abandon |
  tool.call | tool.complete | tool.deny |
  output.accept | output.edit | output.reject |
  model.switch |
  conversation.message |
  file.edit | file.create | file.delete |
  git.commit | test.run | test.pass | test.fail

验证失败 → 输出错误到 stderr，exit code 1，不写入 event.log

--key 不能以数字开头（JSON 字段名限制）
payload 单层展开（不允许嵌套对象通过 CLI 传入）
```

### 环境变量提升

CC Hook 中有几个环境变量在 `agpa track` 内自动使用（不需要--参数传递）：

```
自动读取的环境变量（如果未通过 CLI 传参覆盖）：
  $CLAUDE_TOOL_NAME          → 自动设为 --tool（如果 event_type 是 tool.*）
  $CLAUDE_TOOL_INPUT         不使用（不进 payload）
  $CLAUDE_TOOL_RESULT         自动设为 --result（如果 event_type 是 tool.complete）
  $CLAUDE_DURATION_MS        自动设为 --duration
  $CLAUDE_SESSION_DURATION   自动设为 --duration（如果 event_type 是 session.end）
```

这样 CC Hook 的 agpa track 调用可以极简：

```json
// Hook 配置中只需要写：
"command": "agpa track tool.complete"
// 不用传 --tool --result --duration，agpa track 内部自动读取环境变量
// 但如果用户想在非 CC 场景使用，也支持手动传参
```

### stdin 模式

```bash
echo '{"event_type":"session.end","payload":{"duration_ms":3600},"context":{"session_id":"abc"}}' | agpa track --stdin
```

用途：
- `terminal.Send` 工具的输出管道
- 其他工具通过 pipe 调用 agpa

入参必须是合法的 JSON 单行对象。`event_id` 和 `timestamp` 不传时自动补全。

---

## 三、agpa init 对每个工具的配置注入

### 3.1 Claude Code

```json
// ~/.claude/settings.json 追加（或新建）以下段：

mcpServers -> agent-achievements:
  command: "agpa"
  args: ["mcp"]

hooks:
  SessionStart:       agpa track session.start
  SessionEnd:         agpa track session.end
  TaskCreated:        agpa track task.start
  TaskCompleted:      agpa track task.complete
  PreToolUse:         agpa track tool.call
  PostToolUse:        agpa track tool.complete
  PostToolUseFailure: agpa track tool.fail
  PostCompact:        agpa track context.compact
```

共 8 个 Hook。command 极简——`agpa track` 内部自动读取 `$CLAUDE_*` 环境变量补充参数。

**init 行为**：
- 解析 settings.json（JSON parse）
- 追加 `mcpServers.agent-achievements`（已存在则跳过）
- 追加 8 个 Hook（每个合并到已有数组尾部，不覆盖已有 Hook）
- 写回 settings.json（保留原格式、缩进、注释）

**异常处理**：
- settings.json 不存在 → 创建含最小 MCP 配置的新文件
- settings.json 非法 JSON → 备份为 `.settings.json.agpa.bak`，新建
- 写入无权限 → 提示 `chmod` / 文件归属
- 某个 Hook 已存在同源配置 → 跳过不重复追加（幂等）

### 3.2 Kilo Code

```json
// VS Code settings.json（user 级或 workspace 级）
kilocode.mcpServers -> agent-achievements:
  command: "agpa"
  args: ["mcp"]
```

Kilo Code 无 Hook，只注入 MCP Server 配置和一个 AGENTS.md 指令段。

**AGENTS.md 追加内容**：

```
## Achievement Tracking
Each turn: call achievement.track("conversation.message")
Each tool use: call achievement.track("tool.complete")
When task done: call achievement.track("task.complete")
End of response: call achievement.poll()
When display pending: use ANSI colored box by rarity
```

### 3.3 Hermes Agent

```yaml
# ~/.config/hermes/cli-config.yaml 追加
mcp_servers:
  agent-achievements:
    command: agpa
    args: ["mcp"]
```

Hermes 也无 Hook。同 Kilo，注入 MCP + AGENTS.md 指令。支持 YAML 语法，init 解析时用 YAML parser 而非 JSON。

### 3.4 OpenCode

```toml
# ~/.opencode/settings.toml 追加
[mcp]
command = "agpa"
args = ["mcp"]
```

OpenCode 配置为 TOML 格式。指令文件为 `.opencode/rules`（Markdown）。无 Hook，全面依赖指令遵循。

### 3.5 OpenClaw

```json
// ~/.openclaw/openclaw.json 追加
mcp.servers["agent-achievements"]:
  transport: "stdio"
  command: "agpa"
  args: ["mcp"]
```

**注入量最大**（多 instructions 文件）：

```
openclaw.json  → MCP server 注册
AGENTS.md      → poll + track conversation.message
TOOLS.md       → track tool.complete + task.complete
```

**init 命令**：

```bash
agpa init --tool openclaw
# 内部调 openclaw mcp set 注册 MCP server
# + 在 ~/.openclaw/workspace/AGENTS.md 追加 poll 指令
# + 在 ~/.openclaw/workspace/TOOLS.md 追加 track 指令
```

---

## 四、事件标准化 Pipeline

```
原始输入（CLI argv / JSON-RPC params / stdin JSON）
      │
      ▼
┌─────────────────────────────┐
│  Step 1: buildEvent()        │
│  ├─ 补充 event_id (uuid v7)  │
│  ├─ 补充 timestamp (ISO8601) │
│  ├─ 补充 protocol_version    │
│  ├─ 推测 tool_source          │
│  │   (CLI 模式如何推测?)      │
│  └─ payload 字段映射          │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Step 2: validate()          │
│  ├─ event_type 在白名单?     │
│  ├─ payload 非空?            │
│  ├─ 必填字段存在?            │
│  └─ 类型正确?                │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Step 3: dedup()            │
│  ├─ (event_type, session_id, │
│  │   payload_hash) 组合去重  │
│  └─ 去重窗口: 1s            │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Step 4: append()           │
│  ├─ json.dumps(sort_keys)   │
│  ├─ + '\n'                  │
│  ├─ fd.write() (O_APPEND)   │
│  └─ 可选 fsync (按策略)     │
└─────────────────────────────┘
      │
      ▼
  event.log (一行)
```

### Step 1 detail: tool_source 推测

```
优先级:
  1. 显式 --tool_source 参数  → 用该值
  2. 环境变量 $AGPA_TOOL      → 用该值
  3. CLI 调用路径:
     agpa mcp (MCP 模式)      → 从 JSON-RPC session 上下文取（CC 初始注册时带 tool_source）
     agpa track (CLI 模式)    → 设为 "unknown"，由 Evaluator 后续更新
  4. 都取不到                  → "unknown"
```

### Step 2 detail: 校验规则

```typescript
type ValidationRule = {
  requiredPayload: string[];     // 必填 payload 字段
  optionalPayload: string[];     // 可选 payload 字段
  requiredContext: string[];     // 必填 context 字段
  validate?: (obj: Event) => boolean;  // 自定义校验
};

const VALIDATION_RULES: Record<string, ValidationRule> = {
  "session.start": {
    requiredPayload: [],
    requiredContext: ["session_id"],
  },
  "session.end": {
    requiredPayload: ["duration_ms"],
    requiredContext: ["session_id"],
  },
  "task.complete": {
    requiredPayload: ["task_id", "step_count"],
    requiredContext: ["task_id"],
  },
  "tool.complete": {
    requiredPayload: ["tool_name"],
    requiredContext: [],
  },
  // ... 每个 event_type 的规则
};
```

校验失败时，按严重程度分级：

```
ERROR 级（不写入 event.log）：
  - event_type 不在白名单
  - payload 缺少必填字段
  - 类型不匹配（如 duration_ms 不是数字）

WARN 级（写入，但标 warning）：
  - 缺少非核心字段（如没有 model）
  - tool_source 为 "unknown"
  - context 缺少 session_id

INFO 级（静默修复）：
  - timestamp 没有时区 → 补 Z
  - 多余空白字段 → 丢弃
```

### Step 3 detail: 去重窗口

只在同一个进程中做去重（内存缓存最近 1 秒内的 event hash），不跨进程做去重。跨进程重复由 Evaluator 扫描时处理。

```python
# 内存级去重缓存（不在进程间共享）
_dedup_cache: set[tuple[str, str, str]]  # (event_type, session_id, payload_hash)

# 去重窗口：1 秒
def should_dedup(event) -> bool:
    key = (event.event_type, event.context.session_id, hash_payload(event.payload))
    if key in _dedup_cache:
        return True
    _dedup_cache.add(key)
    # 1 秒后从 cache 移除（由定时器或 LRU 管理）
    return False
```

---

## 五、错误处理

### 写入失败

```
event.log 不可写（权限、磁盘满、路径不存在）：

CLI 模式（agpa track）:
  → stderr: "✖ Cannot write to event.log: Permission denied"
  → exit code: 2
  → 不阻塞调用方（Hook 调用者只花 < 1ms 就拿到错误返回）
  → 不影响 agent 继续工作

MCP 模式（achievement.track）:
  → 返回 JSON-RPC error 响应: { "code": -32000, "message": "event.log write failed: ..." }
  → agent 收到 error，继续执行（track 返回值对 agent 不重要）
  → 成就事件丢失（但不影响 agent 功能）
```

### 启动时发现 event.log 不存在

```
agpa mcp 启动时:
  检测 ~/.agent-achievements/event.log
  不存在 → 自动创建空文件（不会 panic）
  存在但不可写 → 输出错误日志到 stderr，继续运行（track 返回 error）

agpa track 调用时:
  检测 event.log 不存在 → 自动创建（包括中间目录）
  写失败 → stderr 错误，不重试
```

### 参数不合法

```
CLI 模式:
  agpa track                    → "✖ Missing event_type", exit code 1
  agpa track invalid-type       → "✖ Unknown event_type: invalid-type", exit code 1
  agpa track task.complete      → "✖ Missing required payload: task_id", exit code 1
  agpa track --invalid          → "✖ Unknown option: --invalid", exit code 1
  agpa track --help             → 输出帮助文本，exit code 0

MCP 模式:
  achievement.track(event_type="invalid") → JSON-RPC error: Invalid params
  achievement.track() missing event_type  → JSON-RPC error: Invalid params
```

### event.log 行格式损坏

```
Evaluator 扫描 event.log 时遇到不可解析的行：
  → 跳过该行（不中断扫描）
  → 记录错误日志（stderr/crash log）
  → 在日志中标记行号，供用户手动检查

损坏示例：
  {"event_id":"a1",...}        ✅ 正常
  {"event_id":"a2",...         ❌ JSON 截断 → 跳过
  garbage line                 ❌ 非 JSON → 跳过
  2026-05-18 log message       ❌ 其他进程误写入 → 跳过

用户手动修复：
  tail -n +<line_number> event.log > event.log.fixed
  mv event.log.fixed event.log
```

---

## 六、Event Capture 链路完整一览

```
         Agent 工具内部
              │
              │ 第一步：事件产生
              │   - 用户发消息 → conversation.message
              │   - Tool 执行 → tool.complete
              │   - 任务完成 → task.complete
              │   - Session 结束 → session.end
              │
              ▼
       ┌──────────────┐
       │ 捕获入口      │
       │              │
       │ CC: Hook     │──→ agpa track <event_type>
       │ Kilo: MCP   │──→ achievement.track()
       │ Hermes: MCP │──→ achievement.track()
       │ OC: MCP     │──→ achievement.track()
       │ OpenClaw: MCP│──→ achievement.track()
       └──────────────┘
              │
              ▼
       ┌──────────────┐
       │ 标准化 Pipeline│
       │              │
       │ 1. buildEvent │   补充 event_id, timestamp, tool_source
       │ 2. validate   │   event_type 白名单, 必填字段
       │ 3. dedup      │   1s 窗口, (type+session+payload_hash)
       │ 4. append     │   JSON.dumps → O_APPEND → event.log
       └──────────────┘
              │
              ▼
       ┌──────────────┐
       │ event.log    │
       │ (JSONL)      │
       │              │
       │ 一行一个事件   │
       │ 追加写入，不修改│
       │ 跨进程安全     │
       └──────────────┘
              │
              ▼
       下一步：Evaluator（poll() 时触发，详见 05-核心引擎设计.md）
```
