# UserPromptSubmit Hook — 用户消息精确采集设计

**日期:** 2026-06-05
**状态:** 设计阶段，待实施
**上下文:** P1-2 建议落地。bashstats 和 guide 订阅了 `UserPromptSubmit` hook——这是 CC 唯一能获取用户消息内容和字数的 hook 事件。AGPA 没有这个 hook，导致 `user.message` 完全依赖 Agent 自觉调 MCP track。

---

## 1. 背景

### 1.1 当前状态

| 数据 | 当前方式 | 问题 |
|------|---------|------|
| 用户消息计数 | `user.message` MCP track（Agent 自报） | Agent 可能遗漏；需手动维护 AGENTS.md 指令 |
| 消息字数 | ❌ 未采集 | 无法做 char_count/word_count 相关成就 |
| 消息内容 | ❌ 未采集 | 无法做 prompt 质量分析 |

### 1.2 为什么需要 UserPromptSubmit Hook

CC 的 `UserPromptSubmit` hook 在用户每次提交消息时触发，能提供：
- **精确的用户消息时机** — 不依赖 Agent 自觉
- **char_count / word_count** — 消息长度数据
- **隐私安全的 prefix hash** — 内容指纹，不存原文

bashstats 和 guide 都使用此 hook 作为用户活动的基础数据源。AGPA 应该在 MCP track 之外建立这个可靠的自动采集通道。

---

## 2. 架构设计

### 2.1 数据流

```
用户提交消息
    │
    ▼
CC UserPromptSubmit Hook 触发
    │
    ├─ hook_event_name: "UserPromptSubmit"
    ├─ prompt_text: string           ← 完整消息文本
    ├─ stdin: { prompt_text, ... }
    │
    ▼
hook.ts cmdAuto() → parseStdin() → mapEvents()
    │
    ├─ 新增 case 'UserPromptSubmit':
    │
    └─ 生成 2 个事件：
        ├─ user.prompt { char_count, word_count, prefix_hash }
        │   └─ 驱动 "话痨"、"精简大师" 等成就
        └─ user.message { char_count, word_count }
            └─ 替代 Agent 自报的 user.message MCP track
```

### 2.2 分层职责

```
┌─────────────────────────────────────────────┐
│  CC Hook Manager                             │
│  自动传入 prompt_text 到 stdin               │
└──────────────────────┬──────────────────────┘
                       │ stdin JSON { hook_event_name, prompt_text, ... }
                       ▼
┌─────────────────────────────────────────────┐
│  hook.ts::parseStdin()                       │  ← 已存在，无需改动
│  raw: { hook_event_name, prompt_text, ... }  │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  hook.ts::mapEvents()                        │  ← 新增 case
│  case 'UserPromptSubmit':                    │
│    → computePrivacySafePayload(prompt_text)  │
│    → 返回 [user.prompt, user.message]        │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
              ENGINE.track() → event.log
```

---

## 3. 隐私设计

**原则：不存原文，只存统计量 + hash。**

```typescript
interface PromptPayload {
  char_count: number;      // 字符数
  word_count: number;      // 单词数（英文按空格，中文按字符）
  prefix_hash: string;     // 前 20 字符的 SHA-256 前 8 位 hex
  has_code_block: boolean; // 是否包含 ``` 代码块
}
```

- `prefix_hash`: 取 `prompt_text.slice(0, 20)` 的 SHA-256 前 8 位 → 避免存原文，但能检测重复消息
- bashstats 存原文有隐私风险，AGPA 不这么做
- 不采集 prompt 内容 → 不做内容分析，只做统计

---

## 4. 文件变更

### 4.1 MODIFY: `src/cli/hook.ts`

**新增工具函数（mapEvents 同文件内）：**

```typescript
import { createHash } from 'crypto';

interface PromptPayload {
  char_count: number;
  word_count: number;
  prefix_hash: string;
  has_code_block: boolean;
}

function computePromptPayload(promptText: string): PromptPayload {
  const prefix = promptText.slice(0, 20);
  const hash = createHash('sha256').update(prefix).digest('hex').slice(0, 8);

  return {
    char_count: promptText.length,
    word_count: promptText.split(/\s+/).filter(Boolean).length,
    prefix_hash: hash,
    has_code_block: promptText.includes('```'),
  };
}
```

**修改 `mapEvents()` — 新增 case：**

```typescript
case 'UserPromptSubmit': {
  const promptText = (ti.prompt_text as string) || '';
  if (promptText) {
    const pp = computePromptPayload(promptText);
    // user.prompt — 详细统计事件（驱动成就）
    results.push({
      event_type: 'user.prompt',
      payload: { ...base, ...pp },
    });
    // user.message — 替换 Agent 自报的 MCP track
    results.push({
      event_type: 'user.message',
      payload: {
        char_count: pp.char_count,
        word_count: pp.word_count,
        source: 'hook_auto',  // 区别于 MCP 手动 track
      },
    });
  }
  break;
}
```

**修改 `HookStdin` 接口 — 新增字段：**

```typescript
interface HookStdin {
  // ... existing fields ...
  prompt_text?: string;  // UserPromptSubmit hook provides this
}
```

**修改 `mapEvents()` 中 tool_input 提取 — 增加 prompt_text：**

```typescript
const ti = data.tool_input || {};
// ... existing extractions ...
if (typeof ti.prompt_text === 'string') base.prompt_text = ti.prompt_text;
```

### 4.2 MODIFY: `src/engine/types.ts`

新增事件类型：

```typescript
| 'user.prompt'    // UserPromptSubmit hook → 用户消息统计（char_count, word_count, prefix_hash）
```

### 4.3 MODIFY: `src/cli/init.ts`

**`getHookKeys()` 新增一个 hook：**

```typescript
{ key: 'UserPromptSubmit', command: hookCmd(HOOK_ENV, 'auto', profile) },
```

CC 的 `UserPromptSubmit` hook 在 `settings.json` 中的配置格式与其他 hook 一致：
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "AGPA_TOOL_SOURCE=claude-code /path/to/node_modules/.bin/tsx /path/to/src/cli/hook.ts auto",
            "async": false
          }
        ]
      }
    ]
  }
}
```

**⚠️ 注意：** `UserPromptSubmit` 应该是 `async: false`（同步），因为它在每次用户提交消息时触发，非常频繁。异步模式会导致大量并发子进程。

### 4.4 不需要改动的文件

| 文件 | 理由 |
|------|------|
| `src/engine/evaluator.ts` | `user.prompt` 事件可由 `counter`/`threshold` 直接处理（field: char_count/word_count） |
| `src/engine/stats.ts` | `user.message` 事件已被 computeStats 处理，hook 自动生成的事件自动生效 |
| `src/dashboard/api.ts` | 无需特殊展示 |
| `04-成就定义清单.yaml` | 成就定义后用 counter/threshold 驱动，待事件稳定后再加 |

---

## 5. 与 MCP track `user.message` 的关系

| 通道 | 事件 | 触发方式 | 可靠性 |
|------|------|---------|--------|
| Hook Auto (Channel A) | `user.message` | `UserPromptSubmit` hook 自动触发 | ✅ 100% 可靠 |
| MCP Track (Channel B) | `user.message` | Agent 自觉调用 `achievement_track` | ⚠️ 可能遗漏 |

**共存策略：**

- Hook 通道生成 `user.message` 时带 `source: 'hook_auto'`
- MCP 通道生成 `user.message` 时带 `source: 'mcp_track'`（或无 source）
- `computeStats()` 去重：同一 timestamp ±1s 内的两个 `user.message` 视为同一消息
- 优先使用 Hook 通道的数据（更可靠）

### 5.1 stats.ts 去重逻辑（后续实施时调整）

```typescript
// computeStats() 中，按 timestamp 窗口去重：
// 如果 hook_auto 和 mcp_track 在同一秒内都记录了 user.message，
// 只计一次（优先 hook_auto）
```

---

## 6. 工具兼容矩阵

| 工具 | UserPromptSubmit hook？ | 行为 |
|------|------------------------|------|
| **Claude Code** | ✅ 原生支持 | stdin 传入 prompt_text |
| **Hermes** | ❌ 无此 hook | 回退到 MCP track user.message |
| **OpenClaw** | ❌ 无此 hook | 回退到 MCP track user.message |
| **KiloCode** | ❓ 待调研 | 回退到 MCP track |
| **OpenCode** | ❓ 待调研 | 回退到 MCP track |

**原则：** CC 优先增强。其他工具保持现有 MCP track 行为。

---

## 7. 潜在成就孵化

`user.prompt` 事件稳定采集后可定义以下成就：

| 成就 ID | 条件 | 描述 |
|---------|------|------|
| `wordsmith` | `char_count` threshold ≥ 10000 单次 | 一次输入超过 10000 字符 |
| `concise_communicator` | `word_count` threshold ≤ 10，连续 10 次 | 连续 10 次消息 ≤ 10 词 |
| `code_block_master` | `has_code_block` counter ≥ 100 | 100 次消息包含代码块 |
| `echo_chamber` | `prefix_hash` distinct_count ≥ 200 | 200 种不同的消息前缀 |

但这些成就不在本次实施范围内——先建数据通道，成就后补。

---

## 8. 测试计划

### 8.1 单元测试：`tests/cli/hook.test.ts` 新增

| # | 场景 | 预期 |
|---|------|------|
| 1 | UserPromptSubmit + 正常 prompt_text | 生成 user.prompt + user.message 事件 |
| 2 | UserPromptSubmit + 空 prompt_text | 无事件生成（空消息无效） |
| 3 | prompt_text 包含代码块 | `has_code_block: true` |
| 4 | prompt_text 纯英文 | word_count 正确（按空格分词） |
| 5 | prompt_text 纯中文 | word_count = char_count（中文按字符计） |
| 6 | prefix_hash 确定性 | 相同前 20 字符 → 相同 hash |
| 7 | user.message 带 source: 'hook_auto' | payload.source === 'hook_auto' |

### 8.2 集成测试：真实 CC 环境

```
1. init.ts 运行后 settings.json 包含 UserPromptSubmit hook
2. 用户发送一条消息
3. 检查 event.log 中有 user.prompt 事件（char_count/word_count/prefix_hash 正确）
4. 检查 event.log 中有 user.message 事件（source: 'hook_auto'）
```

---

## 9. 工作量

| 任务 | 估计 |
|------|------|
| `computePromptPayload()` 实现 | 0.2 天 |
| `mapEvents()` 新增 case | 0.2 天 |
| `init.ts` 新增 hook key | 0.1 天 |
| `types.ts` 新增事件类型 | 0.1 天 |
| `stats.ts` 去重逻辑 | 0.2 天 |
| 测试 | 0.2 天 |
| **总计** | **~1 天** |

---

## 10. 依赖 & 风险

| 项目 | 说明 |
|------|------|
| **弱依赖：** P0-1 JSONL 解析 | 互补关系，不阻塞。Hook 通道实时采集，JSONL 解析 session 结束时批量校准 |
| **风险：** UserPromptSubmit 触发频率极高 | 设置 `async: false` 避免并发风暴。每次用户消息触发 1 次 hook，每次 < 20ms（同步写 event.log） |
| **风险：** prompt_text 可能包含敏感信息 | 只存统计量 + hash，不存原文 |
| **不依赖：** 无新 npm 包 | `crypto.createHash` 是 Node.js 内置 |
