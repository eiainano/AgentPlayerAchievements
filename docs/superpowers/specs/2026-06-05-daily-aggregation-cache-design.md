# 日聚合缓存表 — 增量统计与 Dashboard 性能优化设计

**日期:** 2026-06-05
**状态:** 设计阶段，待实施
**上下文:** P1-3 建议落地。当前 `poll()` 和 Dashboard API 全量扫描 event.log。5228 个事件还好，但 bashstats 的 `daily_activity` 预聚合表是最佳实践——增量更新、O(1) 读取。

---

## 1. 背景

### 1.1 当前性能路径

```
poll() / Dashboard API
  → Store.load()         ← 全量读取 event.log
  → computeStats()       ← 全量遍历 events
  → computeHeatmap()     ← 全量遍历 events（按 session.start 分组）
  → calcStreak()         ← 全量遍历 events（提取日期）
  → buildApiResponse()   ← 遍历 definitions
```

每个请求都全量扫描 event.log。单用户日均 50-100 事件，一个月 1500-3000 事件，一年 18000-36000 事件。

### 1.2 性能估算

| 事件数 | 全量扫描耗时 | 日聚合读取 |
|--------|------------|-----------|
| 5,000 | ~5ms | ~0.1ms |
| 50,000 | ~40ms | ~0.1ms |
| 200,000 | ~150ms | ~0.2ms |

当前 5228 事件无感知，但在到瓶颈前修路是最佳实践。

### 1.3 bashstats 参考

bashstats 的 `daily_activity` 表（SQLite）结构：
```sql
CREATE TABLE daily_activity (
  date TEXT PRIMARY KEY,
  tool_calls INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  user_msgs INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  unique_tools INTEGER DEFAULT 0,
  duration_secs INTEGER DEFAULT 0
);
```

AGPA 不需要 SQLite——JSON 文件 + 增量更新即可。

---

## 2. 设计

### 2.1 数据结构

扩展 `stats.json`（与现有 `AgentToolStats` 合并存储）：

```json
{
  "version": "2.0",
  "last_updated": "2026-06-05T10:00:00.000Z",
  "last_aggregated_line": 5228,
  "sessions": { "claude-code": 45, "hermes": 3 },
  "user_messages": { "claude-code": 890, "hermes": 12 },
  "usage_time_ms": { "claude-code": 3600000, "hermes": 120000 },
  "daily": {
    "2026-06-01": {
      "tool_calls": 87,
      "sessions": 3,
      "user_msgs": 45,
      "tokens": 250000,
      "unique_tools": 8,
      "duration_secs": 5400,
      "tools_used": ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task", "WebSearch"]
    },
    "2026-06-02": { ... }
  }
}
```

### 2.2 增量更新算法

```
computeStats() 调用时：

1. 读取现有 stats.json（如果有）
2. 读取 last_aggregated_line（已处理到 event.log 第几行）
3. 从 event.log 第 (last_aggregated_line + 1) 行开始读取新事件
4. 按日期分组新事件
5. 合并到 daily 缓存中
6. 更新 last_aggregated_line
7. 写入 stats.json
```

### 2.3 日聚合计算逻辑

```typescript
interface DailyBucket {
  tool_calls: number;
  sessions: number;
  user_msgs: number;
  tokens: number;
  unique_tools: Set<string>;  // 计算时用 Set，序列化时转数组
  duration_secs: number;
  tools_used: string[];        // 序列化时为数组
}

function aggregateDaily(events: TrackedEvent[]): Record<string, DailyBucket> {
  const buckets: Record<string, DailyBucket> = {};

  for (const e of events) {
    const date = e.timestamp.slice(0, 10);
    if (!buckets[date]) {
      buckets[date] = {
        tool_calls: 0, sessions: 0, user_msgs: 0,
        tokens: 0, unique_tools: new Set(), duration_secs: 0,
        tools_used: [],
      };
    }
    const b = buckets[date]!;

    switch (e.event_type) {
      case 'tool.complete':
        b.tool_calls++;
        if (e.payload.tool_name) b.unique_tools.add(e.payload.tool_name as string);
        if (typeof e.payload.duration_ms === 'number') {
          b.duration_secs += Math.round(e.payload.duration_ms / 1000);
        }
        break;
      case 'session.start':
        b.sessions++;
        break;
      case 'user.message':
        b.user_msgs++;
        break;
      case 'token.consumed':
        b.tokens += (e.payload.amount as number) || 0;
        break;
    }
  }

  return buckets;
}
```

### 2.4 Dashboard 热力图改造

当前 `computeHeatmap()` 遍历所有 events 的 `session.start`。改造后：

```typescript
// 新版本：从 daily cache 读取
export function computeHeatmapFromDaily(
  daily: Record<string, DailyBucket>
): HeatmapData {
  const today = new Date();
  const days = new Map<string, number>();

  for (let i = 121; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.set(d.toISOString().slice(0, 10), 0);
  }

  // 从预聚合数据填充
  for (const [date, bucket] of Object.entries(daily)) {
    if (days.has(date)) {
      days.set(date, bucket.sessions);  // 热力图以 session 数为颜色
    }
  }

  // ... 后续 quantile 计算不变 ...
}
```

### 2.5 streak 计算改造

`calcStreak()` 可以从 daily cache 直接读取活跃日期（任何有 session > 0 的日期），无需遍历全部 events。

---

## 3. 文件变更

### 3.1 MODIFY: `src/engine/stats.ts`

新增 `DailyBucket` 接口 + `aggregateDaily()` 函数 + `computeStats()` 增量模式：

```typescript
export interface DailyBucket {
  tool_calls: number;
  sessions: number;
  user_msgs: number;
  tokens: number;
  unique_tools: number;     // 序列化时为数组长度
  duration_secs: number;
  tools_used: string[];     // 当天使用的工具列表
}

export interface AgentToolStats {
  version: '2.0';           // ← 升级版本号
  last_updated: string;
  last_aggregated_line: number;
  sessions: Record<string, number>;
  user_messages: Record<string, number>;
  usage_time_ms: Record<string, number>;
  daily: Record<string, DailyBucket>;  // ← 新增
}

export function computeStats(
  events: TrackedEvent[],
  existing?: AgentToolStats | null,
): AgentToolStats {
  // 如果提供了 existing stats，做增量更新
  if (existing && existing.last_aggregated_line > 0) {
    const newEvents = events.slice(existing.last_aggregated_line);
    const newDaily = aggregateDaily(newEvents);
    // 合并到 existing.daily
    const merged = mergeDaily(existing.daily, newDaily);
    return {
      ...computeBaseStats(events),  // 重新计算基础统计
      daily: merged,
      last_aggregated_line: events.length,
      last_updated: new Date().toISOString(),
    };
  }

  // 否则全量计算
  return {
    ...computeBaseStats(events),
    daily: serializeDaily(aggregateDaily(events)),
    last_aggregated_line: events.length,
    last_updated: new Date().toISOString(),
  };
}

// 辅助：合并两个 daily 对象
function mergeDaily(
  existing: Record<string, DailyBucket>,
  incoming: Record<string, DailyBucket>,
): Record<string, DailyBucket> {
  const merged = { ...existing };
  for (const [date, bucket] of Object.entries(incoming)) {
    if (merged[date]) {
      const e = merged[date]!;
      merged[date] = {
        tool_calls: e.tool_calls + bucket.tool_calls,
        sessions: e.sessions + bucket.sessions,
        user_msgs: e.user_msgs + bucket.user_msgs,
        tokens: e.tokens + bucket.tokens,
        unique_tools: new Set([...e.tools_used, ...bucket.tools_used]).size,
        duration_secs: e.duration_secs + bucket.duration_secs,
        tools_used: [...new Set([...e.tools_used, ...bucket.tools_used])],
      };
    } else {
      merged[date] = bucket;
    }
  }
  return merged;
}
```

### 3.2 MODIFY: `src/engine/engine.ts`

`poll()` 调用 `computeStats()` 时传入 existing stats：

```typescript
poll(): AchievementDefinition[] {
  // ... 现有逻辑 ...
  const existingStats = this.store.loadStats();
  const stats = computeStats(this.events, existingStats);
  this.store.saveStats(stats);
  // ...
}
```

### 3.3 MODIFY: `src/engine/store.ts`

`stats.json` 现在包含 daily 字段，`loadStats()` 的 schema 需要更新：

```typescript
// validate.ts 中新增 dailyBucketSchema
const dailyBucketSchema = z.object({
  tool_calls: z.number(),
  sessions: z.number(),
  user_msgs: z.number(),
  tokens: z.number(),
  unique_tools: z.number(),
  duration_secs: z.number(),
  tools_used: z.array(z.string()),
});

const agentToolStatsSchemaV2 = z.object({
  version: z.literal('2.0'),
  last_updated: z.string(),
  last_aggregated_line: z.number(),
  sessions: z.record(z.number()),
  user_messages: z.record(z.number()),
  usage_time_ms: z.record(z.number()),
  daily: z.record(dailyBucketSchema),
});
```

### 3.4 MODIFY: `src/dashboard/api.ts`

Dashboard API 优先从 daily cache 构建热力图：

```typescript
// buildApiResponse() 中：
import { computeHeatmapFromDaily } from '../utils/activity.js';

// 如果有 toolStats.daily，用它；否则 fallback 到事件扫描
const heatmap = toolStats?.daily
  ? computeHeatmapFromDaily(toolStats.daily)
  : computeHeatmap(events);
```

### 3.5 MODIFY: `src/utils/activity.ts`

新增 `computeHeatmapFromDaily()`：

```typescript
export function computeHeatmapFromDaily(
  daily: Record<string, { sessions: number }>
): HeatmapData {
  const today = new Date();
  const days = new Map<string, number>();

  for (let i = 121; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.set(d.toISOString().slice(0, 10), 0);
  }

  for (const [date, bucket] of Object.entries(daily)) {
    if (days.has(date)) {
      days.set(date, bucket.sessions);
    }
  }

  const nonZero = [...days.values()].filter(c => c > 0).sort((a, b) => a - b);
  let q1 = 1, q2 = 2, q3 = 3;
  if (nonZero.length >= 4) {
    q1 = nonZero[Math.floor(nonZero.length * 0.25)]!;
    q2 = nonZero[Math.floor(nonZero.length * 0.50)]!;
    q3 = nonZero[Math.floor(nonZero.length * 0.75)]!;
    if (q2 <= q1) q2 = q1 + 1;
    if (q3 <= q2) q3 = q2 + 1;
  }

  const result: DayActivity[] = [];
  for (const [date, count] of days) {
    let level: DayActivity['level'] = 0;
    if (count > 0) {
      if (count <= q1) level = 1;
      else if (count <= q2) level = 2;
      else if (count <= q3) level = 3;
      else level = 4;
    }
    result.push({ date, count, level });
  }

  return { days: result.sort((a, b) => a.date.localeCompare(b.date)), quantiles: [q1, q2, q3] };
}
```

另外新增 `calcStreakFromDaily()`：

```typescript
export function calcStreakFromDaily(
  daily: Record<string, { sessions: number }>
): StreakData {
  const activeDays = Object.entries(daily)
    .filter(([_, b]) => b.sessions > 0)
    .map(([date]) => date)
    .sort();

  // ... 与 calcStreak 相同的 streak 计算逻辑，但输入是日期数组
  // ...
}
```

### 3.6 不需要改动的文件

| 文件 | 理由 |
|------|------|
| `src/cli/hook.ts` | 不改变事件采集 |
| `src/engine/evaluator.ts` | 不改变成就检测 |
| `04-成就定义清单.yaml` | 不改变成就定义 |
| Dashboard HTML | 热力图 API 接口不变，后端切换数据源对前端透明 |

---

## 4. 数据一致性

### 4.1 增量 vs 全量

- `poll()` 时：增量更新（从 `last_aggregated_line` 开始）
- `agpa reset` 后：`stats.json` 删除 → 下次全量重建
- `agpa doctor`：校验 `last_aggregated_line` ≤ event.log 行数
- 手动编辑 event.log：`last_aggregated_line` 可能不对 → 下次 poll 时检测到行数变化，全量重建

### 4.2 last_aggregated_line 校验

```typescript
// engine.ts poll() 中：
if (existingStats && existingStats.last_aggregated_line > this.events.length) {
  // 事件被删除了（手动编辑或 reset 后重写），全量重建
  const stats = computeStats(this.events);  // 不带 existing
  this.store.saveStats(stats);
}
```

### 4.3 迁移

stats.json v1.0 → v2.0：
- 检测到 version === '1.0' → 全量重建（删除旧 stats.json，computStats 自动生成新的）
- 不写迁移脚本，直接重建

---

## 5. 测试计划

### 5.1 单元测试：`tests/engine/stats.test.ts` 新增

| # | 场景 | 预期 |
|---|------|------|
| 1 | 空 events → daily 为空 | stats.daily = {} |
| 2 | 单日多种事件 | daily["2026-06-05"] 各字段正确 |
| 3 | 跨天事件分组 | 两个日期的 bucket 独立 |
| 4 | 增量合并 | mergeDaily 各字段累加正确 |
| 5 | unique_tools 跨天去重 | tools_used 合并后 Set 去重 |
| 6 | last_aggregated_line 正确 | 等于 events.length |
| 7 | 增量模式：新事件追加 | daily 包含新旧两天的数据 |

### 5.2 单元测试：`tests/utils/activity.test.ts` 新增

| # | 场景 | 预期 |
|---|------|------|
| 8 | computeHeatmapFromDaily 等价于 computeHeatmap | 相同 events → 相同 heatmap 输出 |

---

## 6. 存储增长预估

| 时间 | 事件数 | stats.json 大小 |
|------|--------|-----------------|
| 1 个月 | ~2,000 | ~3 KB |
| 6 个月 | ~12,000 | ~8 KB |
| 1 年 | ~24,000 | ~15 KB |
| 3 年 | ~72,000 | ~40 KB |

stats.json 保持轻量。每天一条记录 ~200 bytes，3 年 1095 天 ≈ 200 KB。完全可接受。

---

## 7. 工作量

| 任务 | 估计 |
|------|------|
| `DailyBucket` 类型 + `aggregateDaily()` 实现 | 0.5 天 |
| `computeStats()` 增量模式改造 | 0.5 天 |
| `computeHeatmapFromDaily()` + `calcStreakFromDaily()` | 0.5 天 |
| `api.ts` / `engine.ts` / `store.ts` 集成 | 0.5 天 |
| schema 更新（validate.ts） | 0.2 天 |
| 测试 | 0.5 天 |
| **总计** | **~2-3 天** |

---

## 8. 依赖 & 风险

| 项目 | 说明 |
|------|------|
| **无强依赖** | 可以独立实施，不依赖 P0-1/P1-1/P1-2/P1-4 |
| **前置于 P1-1** | Usage XP 的 `calcUsageBreakdown()` 可以从 daily cache 读取（而不是扫描 events），但非必须 |
| **风险：** 增量更新 bug 导致 daily 数据不一致 | `agpa doctor` 增加一致性检查：统计 daily 中 tool_calls 总数 vs event.log 中 tool.complete 总数 |
| **风险：** stats.json 格式变更导致 Dashboard 读取失败 | Zod schema 校验 + fallback 到事件扫描 |
