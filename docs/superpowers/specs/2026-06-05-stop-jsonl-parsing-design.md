# Stop Hook JSONL 解析 — 精确 Session 统计设计

**日期:** 2026-06-05
**状态:** 设计阶段，待实施
**上下文:** P0-1 建议落地。当前 user message / token 统计依赖 Agent 自觉调 MCP track，不可靠。通过 Stop hook 时解析 CC JSONL 文件获取精确数据，补充并校准 MCP track 通道。

---

## 1. 背景

### 1.1 当前数据采集的局限

| 数据 | 当前方式 | 问题 |
|------|---------|------|
| 用户消息计数 | `user.message` MCP track（Agent 自报） | Agent 可能遗漏；需手动维护指令 |
| Token 消耗 | `token.consumed` MCP track（Agent 自报） | Agent 无法精确知道自己的 token 消耗 → `token_1m`/`token_titan`/`token_legend` 基本是 dead achievements |
| Session 精确时长 | timestamp 窗口近似 | Hook/MCP 跨进程 session_id 不匹配，只能时间窗口近似 |
| Output tokens | `conversation.message` payload 中 Agent 自报 `output_tokens` | 不可靠，Agent 不知道自己的 output token 数 |

### 1.2 为什么 JSONL 解析是答案

Claude Code 的 `~/.claude/projects/<slug>/<session-id>.jsonl` 文件包含每个 conversation turn 的完整记录，每条消息都有精确的 `usage` 对象：

```json
{
  "uuid": "...",
  "sessionId": "...",
  "timestamp": "2026-06-03T10:00:00.000Z",
  "type": "user",                    // ← 用户消息精确标识
  "message": { "role": "user", "content": [...] }
}
{
  "uuid": "...",
  "sessionId": "...",
  "type": "assistant",
  "message": { "role": "assistant", "content": [...] },
  "usage": {                          // ← 精确 token 数据
    "input_tokens": 1234,
    "output_tokens": 567,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  }
}
```

---

## 2. 架构设计

### 2.1 数据流

```
CC Session 结束
    │
    ▼
Stop Hook 触发
    │
    ├─ transcript_path = $CLAUDE_TRANSCRIPT_PATH  (CC 环境变量)
    │
    ▼
hook.ts cmdTrack('session.end')
    │
    ├─ 1. 现有逻辑：ENGINE.track('session.end', payload)  ← 保持不变
    │
    └─ 2. 新增：parseTranscriptJsonl(transcript_path)
           │
           ├─ 遍历 JSONL 每一行
           │   ├─ type === "user" → userMsgCount++
           │   ├─ usage 存在 → 累加 input/output/cache tokens
           │   └─ 记录首行/末行 timestamp
           │
           ├─ 生成补充事件：
           │   ├─ track("token.consumed", { amount: totalTokens })
           │   │   └─ 驱动 token_1m / token_titan / token_legend 成就
           │   └─ track("user.message.batch", { count: userMsgCount })
           │       └─ 批量补报本 session 的用户消息总数
           │
           └─ 丰富 session.end payload：
               ├─ user_message_count: number
               ├─ total_input_tokens: number
               ├─ total_output_tokens: number
               ├─ total_cache_read_tokens: number
               ├─ total_cache_creation_tokens: number
               ├─ session_started_at: ISO string
               └─ session_duration_ms: number
```

### 2.2 分层职责

```
┌─────────────────────────────────────────────┐
│  hook.ts::parseTranscriptJsonl(path)         │  ← 纯函数：读文件 → 返回统计数据
│  - 流式逐行解析 JSONL                       │
│  - 不依赖 ENGINE，不写 event.log            │
│  - 解析失败返回 null（不抛异常）             │
└──────────────────────┬──────────────────────┘
                       │ 返回 { userMsgCount, tokens, timestamps }
                       ▼
┌─────────────────────────────────────────────┐
│  hook.ts::cmdTrack('session.end')           │  ← 调用方
│  - 调用 parseTranscriptJsonl()             │
│  - 成功 → 写入补充事件 + 丰富 payload        │
│  - 失败 → 回退现有行为，仅写 base session.end │
└─────────────────────────────────────────────┘
```

---

## 3. 文件变更

### 3.1 MODIFY: `src/cli/hook.ts`

**新增函数 `parseTranscriptJsonl(path: string)`：**

```typescript
interface TranscriptStats {
  user_message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  session_started_at: string;    // 首行 timestamp
  session_ended_at: string;      // 末行 timestamp
  session_duration_ms: number;
}

function parseTranscriptJsonl(filePath: string): TranscriptStats | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    let userMsgCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let firstTimestamp = '';
    let lastTimestamp = '';

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Track first/last timestamps
        if (!firstTimestamp) firstTimestamp = entry.timestamp;
        lastTimestamp = entry.timestamp;

        // Count user messages
        if (entry.type === 'user') userMsgCount++;

        // Accumulate token usage
        if (entry.usage) {
          inputTokens += entry.usage.input_tokens || 0;
          outputTokens += entry.usage.output_tokens || 0;
          cacheReadTokens += entry.usage.cache_read_input_tokens || 0;
          cacheCreationTokens += entry.usage.cache_creation_input_tokens || 0;
        }
      } catch {
        // Skip malformed lines
      }
    }

    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
    if (totalTokens === 0 && userMsgCount === 0) return null;

    const durationMs = firstTimestamp && lastTimestamp
      ? new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()
      : 0;

    return {
      user_message_count: userMsgCount,
      total_input_tokens: inputTokens,
      total_output_tokens: outputTokens,
      total_cache_read_tokens: cacheReadTokens,
      total_cache_creation_tokens: cacheCreationTokens,
      session_started_at: firstTimestamp,
      session_ended_at: lastTimestamp,
      session_duration_ms: durationMs,
    };
  } catch {
    return null; // file not found, permission denied, etc.
  }
}
```

**修改 `cmdTrack()` 函数 — session.end 分支：**

```typescript
// 在 cmdTrack() 中，eventType === 'session.end' 时：
if (eventType === 'session.end') {
  // 1. 现有：写入基础 session.end
  ENGINE.track('session.end', payload);

  // 2. 新增：尝试 JSONL 解析（仅 CC 有效）
  const transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH
                      || payload.transcript_path as string
                      || process.argv.slice(2).find(a => a.endsWith('.jsonl'));

  if (transcriptPath) {
    const stats = parseTranscriptJsonl(transcriptPath);
    if (stats) {
      // 写入精确 token 事件（驱动 token 成就）
      ENGINE.track('token.consumed', {
        amount: stats.total_input_tokens + stats.total_output_tokens
               + stats.total_cache_read_tokens + stats.total_cache_creation_tokens,
        input_tokens: stats.total_input_tokens,
        output_tokens: stats.total_output_tokens,
        source: 'jsonl_parsed',
      });

      // 批量补报用户消息（校准 user.message MCP track）
      if (stats.user_message_count > 0) {
        ENGINE.track('user.message.batch', {
          count: stats.user_message_count,
          source: 'jsonl_parsed',
        });
      }

      // 丰富 session.end payload（供 stats.json 直接使用）
      // 注意：已经 track 了一次 session.end，这里用后续的
      // payload 字段来承载统计数据
      ENGINE.track('session.stats', {
        user_message_count: stats.user_message_count,
        total_input_tokens: stats.total_input_tokens,
        total_output_tokens: stats.total_output_tokens,
        total_cache_read_tokens: stats.total_cache_read_tokens,
        total_cache_creation_tokens: stats.total_cache_creation_tokens,
        session_started_at: stats.session_started_at,
        session_ended_at: stats.session_ended_at,
        session_duration_ms: stats.session_duration_ms,
        source: 'jsonl_parsed',
      });
    }
  }

  // 3. 现有：poll
  ENGINE.poll();
}
```

### 3.2 MODIFY: `src/cli/init.ts`

**Stop hook 命令传入 transcript_path：**

```typescript
// 当前（line ~560）:
{ key: 'Stop', command: `${hookCmd(HOOK_ENV, 'track session.end', profile)} && ${hookCmd(HOOK_ENV, 'poll', profile)}`, ... }

// 改为传入环境变量:
// CC 的 Stop hook 环境变量中包含 $CLAUDE_TRANSCRIPT_PATH
// hook.ts cmdTrack() 中 process.env.CLAUDE_TRANSCRIPT_PATH 即可获取
// 无需修改命令本身，因为 CC 自动设置环境变量
```

**注意：** CC 的 `Stop` hook 自动提供 `$CLAUDE_TRANSCRIPT_PATH` 环境变量（指向当前 session 的 JSONL 文件）。无需额外配置。如果 CC 不提供此变量，回退到现有行为。

### 3.3 MODIFY: `src/engine/types.ts`

新增事件类型：

```typescript
| 'user.message.batch'   // JSONL 批量补报用户消息计数
| 'session.stats'        // JSONL 解析出的 session 级统计数据
```

### 3.4 MODIFY: `src/engine/engine.ts`

`track()` 函数对 `session.stats` 无特殊处理（仅记录，不触发逻辑变更）。

`track('token.consumed', ...)` 已有支持（现有的 `threshold` 条件类型可直接累加 `field: amount` 驱动 `token_1m`/`token_titan`/`token_legend`）。

### 3.5 MODIFY: `src/engine/stats.ts`

`computeStats()` 函数：
- `session.stats` 事件 → 直接读取 `user_message_count`, `session_duration_ms` → 更新 usage_time 计算
- 优先级：`session.stats.user_message_count` > `user.message` 事件计数
- `user.message.batch` 事件 → 可以直接累加到 user_messages total，比逐条计数更高效

### 3.6 不需要改动的文件

| 文件 | 理由 |
|------|------|
| `src/engine/evaluator.ts` | `token.consumed` 事件已能被 `threshold` 条件类型处理 |
| `src/dashboard/api.ts` | stats 字段已支持扩展，新增字段自动进入 Dashboard |
| `04-成就定义清单.yaml` | token_1m/token_titan/token_legend 成就无需修改，只是数据源从 Agent 自报变成了 JSONL 解析 |

---

## 4. 错误处理 & 边界情况

| 场景 | 行为 |
|------|------|
| `transcript_path` 不存在(非 CC 工具) | `parseTranscriptJsonl()` 返回 null → 回退现有行为 |
| JSONL 文件不存在 | 返回 null → 回退 |
| JSONL 文件被截断/损坏 | `try/catch` per line → 解析能解析的部分 |
| JSONL 量为空（0 条消息） | 返回 null → 回退 |
| 全是 system/summary 消息，无 user message | stats 返回 0 userMsgCount，token 正常累计 |
| JSONL 超大（10MB+） | 逐行解析，不一次性加载到内存（流式读取） |
| 同步 I/O 阻塞 Stop hook | Stop hook 配置 `async: true, timeout: 15`（已存在），不阻塞 CC |
| `user.message` MCP track + `user.message.batch` 双写 | stats.json 优先使用 `session.stats` 数据，MCP track 数据作为 fallback |

---

## 5. 工具兼容矩阵

| 工具 | transcript_path 可用？ | 行为 |
|------|----------------------|------|
| **Claude Code** | ✅ `$CLAUDE_TRANSCRIPT_PATH` | JSONL 解析 → 精确统计 |
| **Hermes** | ❓ 待调研 checkpoint 格式 | 回退到 MCP track |
| **OpenClaw** | ❓ 待调研 `completions/` 格式 | 回退到 MCP track |
| **KiloCode** | ❓ SQLite 数据库 | 回退到 MCP track |
| **OpenCode** | ❓ SQLite + 文件 | 回退到 MCP track |

**原则：** 此功能是 CC 优先的增强。其他工具不受影响，保持现有 MCP track 行为。未来可为每种工具添加各自的解析器。

---

## 6. 测试计划

### 6.1 单元测试：`tests/cli/hook-transcript.test.ts`

| # | 场景 | 预期 |
|---|------|------|
| 1 | 空 JSONL 文件 | 返回 null |
| 2 | 正常 session（3 user + 2 assistant，含 usage） | 正确计数：userMsgCount=3, input/output tokens 正确累加 |
| 3 | 只有 assistant 消息，无 user | userMsgCount=0 |
| 4 | JSONL 中某行 JSON 损坏 | skip 该行，继续解析其余 |
| 5 | 首末行 timestamp 正确计算 duration | session_duration_ms > 0 |
| 6 | 大文件（1000+ 行） | 解析成功，不超时 |
| 7 | 文件不存在 | 返回 null |

### 6.2 集成测试：真实 event.log 验证

```
1. 手动触发一次 session.end + JSONL 解析
2. 检查 event.log 中有 token.consumed 事件（带正确的 amount）
3. 检查 event.log 中有 user.message.batch 事件
4. 检查 event.log 中有 session.stats 事件
5. call achievement_poll → token_1m 成就进度应正确更新
```

---

## 7. 工作量

| 任务 | 估计 |
|------|------|
| `parseTranscriptJsonl()` 实现 | 0.5 天 |
| `cmdTrack()` session.end 分支改造 | 0.5 天 |
| `types.ts` 新增 2 个事件类型 | 0.1 天 |
| `stats.ts` computeStats 适配 | 0.5 天 |
| 测试文件 | 0.5 天 |
| 真实环境验证 | 0.3 天 |
| **总计** | **~2.5 天** |

---

## 8. 依赖 & 风险

| 项目 | 说明 |
|------|------|
| **强依赖：** CC 的 `Stop` hook 提供 `$CLAUDE_TRANSCRIPT_PATH` | 需在真实 CC 环境中验证此环境变量可用 |
| **风险：** JSONL 同步读取可能阻塞 Stop hook (15s timeout) | 大 session（>500条消息）的 JSONL 约 500KB，fs.readFileSync 耗时 <50ms，安全 |
| **风险：** `user.message` 双写导致计数偏高 | `computeStats()` 优先用 `session.stats` 数据，MCP track 作为 fallback |
| **不依赖：** 无新 npm 包 | 纯 Node.js `fs` + `JSON.parse` |

---

## 9. 与现有系统的关系

```
                ┌──────────────────────────────────┐
                │      MCP Track (Channel B)        │
                │  user.message (实时，Agent 自觉)   │
                │  token.consumed (Agent 自报)       │
                └──────────────┬───────────────────┘
                               │ 可能遗漏，数字不准
                               ▼
                ┌──────────────────────────────────┐
                │   event.log                       │
                │   (两种来源的事件共存)              │
                └──────────────┬───────────────────┘
                               │
                ┌──────────────┴───────────────────┐
                │   stats.json (computeStats)       │
                │   优先读 session.stats (JSONL)     │
                │   fallback 到 user.message (MCP)   │
                └──────────────────────────────────┘

                ┌──────────────────────────────────┐
                │   JSONL 解析 (Channel C, 新增)     │
                │   token.consumed (精确)            │
                │   user.message.batch (校准)        │
                │   session.stats (精确时长等)        │
                └──────────────────────────────────┘
```

三个通道并存：
- **Channel A (Hook 自动):** session.start/end, tool.* — 可靠，Agent 无感知
- **Channel B (MCP Track):** user.message, model.switch 等语义事件 — Agent 主动，可能遗漏
- **Channel C (JSONL 解析):** token, 精确消息计数, session 时长 — 100% 精确，仅 CC，session 结束时触发
