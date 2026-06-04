# Usage-based XP — 成就XP + 活动XP 双轨设计

**日期:** 2026-06-05
**状态:** 设计阶段，待实施
**上下文:** P1-1 建议落地。当前 XP 只来自成就解锁 + task count。成就解锁有间歇期（新手每天几个，老手几周一个），间歇期 Level 完全冻结。bashstats、level-up、claude-quest 都用 activity XP 作为持续增长来源。

---

## 1. 背景

### 1.1 当前 XP 公式

```typescript
// src/dashboard/xp.ts
totalXP = sum(achievementXP) + taskCount × 10

// Level = floor(sqrt(totalXP / 100))
// Level 1 = 100 XP, Level 2 = 400 XP, Level 3 = 900 XP, ...
```

| 稀有度 | XP |
|--------|-----|
| common | 50 |
| uncommon | 100 |
| rare | 200 |
| epic | 300 |
| legendary | 500 |
| mythic | 1000 |

### 1.2 问题

- 新手期（前 30 个成就）→ Level 快速增长 → 体验好
- 中后期（剩 100+ 成就未解锁）→ 几周才解锁 1 个 → Level 冻结 → 挫败感
- 用户每天都在用工具，但使用行为不贡献 XP

### 1.3 解决思路

引入与成就 XP **平行**的 Usage XP——从日常使用行为中计算：
- tool 调用次数
- session 次数
- 用户消息数
- token 消耗量
- 使用的工具种类数

两项 XP 相加作为总 XP，Level 持续增长。

---

## 2. 设计

### 2.1 XP 公式

```typescript
function calcUsageXP(events: TrackedEvent[]): number {
  const toolCalls = events.filter(e => e.event_type === 'tool.complete').length;
  const sessions = events.filter(e => e.event_type === 'session.start').length;
  const messages = events.filter(e => e.event_type === 'user.message').length;
  const tokenEvents = events.filter(e => e.event_type === 'token.consumed');
  const totalTokens = tokenEvents.reduce((sum, e) => sum + (e.payload.amount as number || 0), 0);
  const uniqueTools = new Set(
    events.filter(e => e.event_type === 'tool.complete')
      .map(e => e.payload.tool_name)
      .filter(Boolean)
  ).size;

  // sqrt 平滑，各维度权重可调
  const usageXP = Math.sqrt(
    toolCalls * 1 +
    sessions * 10 +
    messages * 5 +
    (totalTokens / 1000) * 0.5 +
    uniqueTools * 20
  );

  return Math.round(usageXP);
}
```

**权重设计原理：**

| 维度 | 权重 | 理由 |
|------|------|------|
| toolCalls × 1 | 每次工具调用 1 点 | 高频行为，低权重防通胀 |
| sessions × 10 | 每次 session 10 点 | 中频行为，代表"回来用了" |
| messages × 5 | 每条用户消息 5 点 | 中频行为，代表真实交互 |
| tokens/1000 × 0.5 | 每 1000 token 0.5 点 | 高频行为，最低权重。100K token = 50 XP |
| uniqueTools × 20 | 每种工具 20 点 | 低频行为，鼓励工具多样性 |

**sqrt 平滑效果：**
- 100 次调用 → sqrt(100) = 10 XP（而不是 100 XP）
- 10,000 次调用 → sqrt(10000) = 100 XP
- 防止高频行为线性增长导致 XP 通胀

### 2.2 合并 Level 计算

```typescript
// 新的 calcTotalXp 签名
function calcTotalXp(
  unlockedAchievements: Array<{ rarity: RarityLevel }>,
  taskCount: number,
  usageXP: number,  // ← 新增参数
): number {
  const achXp = unlockedAchievements.reduce(
    (sum, a) => sum + (ACHIEVEMENT_XP[a.rarity] || 0),
    0,
  );
  return achXp + taskCount * XP_PER_TASK + usageXP;
}

// Level 公式不变
function calcLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}
```

### 2.3 Dashboard 展示

```
┌──────────────────────────────────────────────┐
│  Level 7  ████████░░░░░░░░░░  840 / 1600 XP  │
│                                              │
│  🏆 Achievement XP:  720 XP  (12 成就)       │
│  ⚡ Activity XP:      120 XP  (日常使用)       │
│  📋 Task XP:           0 XP  (0 任务完成)     │
│                                              │
│  Activity XP breakdown:                      │
│  🔧 234 tools  📁 15 sessions  💬 89 msgs    │
└──────────────────────────────────────────────┘
```

- Level 进度条显示总 XP（成就 + 活动 + 任务）
- Activity XP 作为独立进度条，标注"日常使用奖励"
- Activity breakdown 显示各维度计数

### 2.4 更新 strategy

- Usage XP **实时计算**（不缓存到 state.json），每次 poll/Dashboard API 调用时从 event.log 计算
- 优点：永远精确、不需要迁移、公式调整立刻生效
- 性能：当前 5228 事件计算 < 5ms，即使 50000 事件也 < 50ms
- 日后 P1-3（日聚合缓存）实施后可改用预计算值

---

## 3. 文件变更

### 3.1 MODIFY: `src/dashboard/xp.ts`

新增 `calcUsageXP()` 函数，修改 `calcTotalXp()` 签名：

```typescript
import type { TrackedEvent } from '../engine/types.js';

export function calcUsageXP(events: TrackedEvent[]): number {
  const toolCalls = events.filter(e => e.event_type === 'tool.complete').length;
  const sessions = events.filter(e => e.event_type === 'session.start').length;
  const messages = events.filter(e => e.event_type === 'user.message').length;
  const tokenEvents = events.filter(e => e.event_type === 'token.consumed');
  const totalTokens = tokenEvents.reduce(
    (sum, e) => sum + ((e.payload.amount as number) || 0), 0
  );
  const uniqueTools = new Set(
    events.filter(e => e.event_type === 'tool.complete')
      .map(e => e.payload.tool_name)
      .filter(Boolean)
  ).size;

  return Math.round(Math.sqrt(
    toolCalls * 1 +
    sessions * 10 +
    messages * 5 +
    (totalTokens / 1000) * 0.5 +
    uniqueTools * 20
  ));
}

// calcTotalXp 增加 usageXP 参数
export function calcTotalXp(
  unlockedAchievements: Array<{ rarity: RarityLevel }>,
  taskCount: number,
  usageXP?: number,  // ← 新增，可选以保持向后兼容
): number {
  const achXp = unlockedAchievements.reduce(
    (sum, a) => sum + (ACHIEVEMENT_XP[a.rarity] || 0),
    0,
  );
  return achXp + taskCount * XP_PER_TASK + (usageXP || 0);
}

// calcUsageBreakdown: 返回各维度明细（用于 Dashboard 展示）
export interface UsageBreakdown {
  tool_calls: number;
  sessions: number;
  messages: number;
  total_tokens: number;
  unique_tools: number;
  usage_xp: number;
}

export function calcUsageBreakdown(events: TrackedEvent[]): UsageBreakdown {
  const toolCalls = events.filter(e => e.event_type === 'tool.complete').length;
  const sessions = events.filter(e => e.event_type === 'session.start').length;
  const messages = events.filter(e => e.event_type === 'user.message').length;
  const tokenEvents = events.filter(e => e.event_type === 'token.consumed');
  const totalTokens = tokenEvents.reduce(
    (sum, e) => sum + ((e.payload.amount as number) || 0), 0
  );
  const uniqueTools = new Set(
    events.filter(e => e.event_type === 'tool.complete')
      .map(e => e.payload.tool_name)
      .filter(Boolean)
  ).size;

  return {
    tool_calls: toolCalls,
    sessions,
    messages,
    total_tokens: totalTokens,
    unique_tools: uniqueTools,
    usage_xp: Math.round(Math.sqrt(
      toolCalls * 1 + sessions * 10 + messages * 5 +
      (totalTokens / 1000) * 0.5 + uniqueTools * 20
    )),
  };
}
```

### 3.2 MODIFY: `src/dashboard/api.ts`

`buildApiResponse()` 中注入 usage XP：

```typescript
// buildApiResponse() 内部：
const usageBreakdown = calcUsageBreakdown(events);
const totalXp = calcTotalXp(
  unlockedDefs.map(d => ({ rarity: d.rarity })),
  taskCount,
  usageBreakdown.usage_xp,
);

// DashboardStats 中新增：
export interface DashboardStats {
  // ... existing fields ...
  usage_xp: number;
  usage_breakdown: UsageBreakdown;
}
```

### 3.3 MODIFY: `src/dashboard/server.ts`

`/api/data` handler 传入 events 给 `calcUsageXP()`。（已经传了 events，无需额外改动）

### 3.4 MODIFY: Dashboard HTML/CSS/JS

Hero section 新增 Activity XP 行：
- XP bar 下方加一行小字："⚡ Activity XP: {usage_xp} (from daily usage)"
- 可选：展开显示 usage_breakdown 明细

### 3.5 MODIFY: `src/engine/engine.ts`

`toolStats()` 返回的数据中可选加入 usage_xp（如果调用方传入 events）。

### 3.6 不需要改动的文件

| 文件 | 理由 |
|------|------|
| `src/engine/evaluator.ts` | 不改成就检测逻辑 |
| `src/engine/types.ts` | 不改事件类型 |
| `04-成就定义清单.yaml` | 不改成就定义 |
| `src/cli/hook.ts` | 不改事件采集 |

---

## 4. 平衡性分析

### 4.1 预期 Level 对比

以一个典型用户 1 个月数据估算：

| 维度 | 月均数量 | 贡献 XP |
|------|---------|---------|
| tool 调用 | 2000 | sqrt(2000) ≈ 45 |
| sessions | 30 | sqrt(300) ≈ 17 |
| user messages | 500 | sqrt(2500) ≈ 50 |
| tokens | 1,500,000 | sqrt(750) ≈ 27 |
| unique tools | 10 | sqrt(200) ≈ 14 |
| **Total Usage XP** | | **~153** |

加上成就 XP（假设解锁 20-30 个，含新手期 burst）：
- Achievement XP ≈ 2,000-4,000
- Usage XP ≈ 150 → 占总 XP 的 ~5-7%

**效果：** Usage XP 不会主导 Level，但在成就空窗期提供持续的增长感。大约每 2-3 天在没有成就解锁的情况下涨 1 级（低级别时）。

### 4.2 极端情况

| 场景 | 工具调用 | Usage XP | 影响 |
|------|---------|---------|------|
| 轻度用户（月 200 调用） | 200 | ~14 | 可忽略 |
| 普通用户（月 2000 调用） | 2000 | ~45 | 每月多 ~0.5 级 |
| 重度用户（月 10000 调用） | 10000 | ~100 | 每月多 ~1 级 |

Usage XP 不会让 Level 通胀——sqrt 函数天然限制极端值。重度用户比轻度用户每月多不到 1 级。

### 4.3 权重调整策略

如果未来觉得某维度贡献太高/太低，`calcUsageXP()` 是纯函数，改权重数字即可，无需数据迁移。Dashboard 实时计算，改完即时生效。

---

## 5. 测试计划

### 5.1 单元测试：`tests/dashboard/xp.test.ts` 新增

| # | 场景 | 预期 |
|---|------|------|
| 1 | 空 events → Usage XP 0 | calcUsageXP([]) === 0 |
| 2 | 100 tool.complete + 10 session.start | sqrt(100+100) = 14 |
| 3 | token.consumed 累加正确 | 多条 token.consumed 的 amount 求和 |
| 4 | uniqueTools 去重正确 | Read×50 + Write×50 → uniqueTools=2 |
| 5 | calcTotalXp 合并正确 | achXp + taskXP + usageXP 正确 |
| 6 | 混合事件类型（无关事件不干扰） | 包含 file.read 等不影响结果 |

---

## 6. 工作量

| 任务 | 估计 |
|------|------|
| `calcUsageXP()` + `calcUsageBreakdown()` 实现 | 0.3 天 |
| `api.ts` 集成 + DashboardStats 扩展 | 0.3 天 |
| Dashboard HTML 展示 | 0.3 天 |
| 测试 | 0.3 天 |
| **总计** | **~1-2 天** |

---

## 7. 依赖 & 风险

| 项目 | 说明 |
|------|------|
| **弱依赖：** P0-1 JSONL 解析 | Token 统计先于 JSONL 时会偏少，但公式中 token 权重最低（×0.5），影响有限 |
| **弱依赖：** P1-2 UserPromptSubmit Hook | messages 计数在 hook 上线前依赖 MCP track，可能偏少。但权重 ×5 也不高 |
| **风险：** 公式调整导致 Level 波动 | Level 回归？不会——Usage XP 只增不减。公式调整只是增量速度变化 |
| **不依赖：** 无新 npm 包 | 纯 JS Math |
