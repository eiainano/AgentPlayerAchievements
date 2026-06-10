# 数据迁移框架设计

> 日期: 2026-06-10 | 状态: 待审阅
> 来源: claude-code-guide migrate-data.sh 启发 + state.json schema 演进需求

## 问题

`state.json` 无 schema 版本号。每次加字段（tip/hint → daily stats → streak → session_count → ...），现有用户的 state 静默缺失字段。当前通过 Zod `.optional()` 兜底，但非长期方案：

- 已有 `session_count` 字段在 `AchievementState.stats` 中可选，但新用户永远不会有
- 未来加必选字段会破坏现有用户数据
- 无 schema 演进的历史记录

## 解决方案

### 核心机制

**在前置入口自动执行**，用户无感知。`store.ts` 的 `load()` 函数中，读取 `state.json` 后立即执行 `migrateState()`，返回已迁移到最新版本的数据。

```
store.load() → readFile → JSON.parse → migrateState() → return
                                 │
                    只补字段，不删不改
                    失败熔断（返回原始 data）
                    幂等
```

### 版本号设计

- `schema_version` 从 0 开始（即所有无此字段的旧 state 视为 v0）
- 当前最新版本号 = `CURRENT_VERSION = 1`
- 迁移链从 v0→v1→v2... 增量执行

### v0→v1 迁移（初始）

这是第一条（也是当前唯一一条）迁移。它对现有 state 的影响：

```typescript
MIGRATIONS[1] = (state) => {
  state.schema_version = 1;
  state.migration_history = [];
  // 不对任何已有字段做改动
};
```

**完全不改变现有数据**。只是标记版本号 + 添加空的历史记录数组。后续添加新字段时追加迁移即可。

### 安全约束

1. **只补字段，不删字段** — 任何迁移不删除已有 key
2. **只设默认值，不改已有值** — 使用 `??=` 语义
3. **幂等** — 重复执行同迁移无副作用
4. **失败熔断** — 任何迁移抛出异常 → 日志告警（目前 stderr 输出）+ 返回原始 state

### 类型改动

`AchievementState` 接口新增两个可选字段：

```typescript
interface AchievementState {
  // 已有字段
  unlocked: Record<string, string>;
  stats: { total_unlocked: number; session_count?: number; [key: string]: unknown; };
  last_evaluated_line?: number;
  
  // 新增
  schema_version?: number;           // 当前 schema 版本号
  migration_history?: MigrationRecord[];  // 迁移历史记录
}

interface MigrationRecord {
  from: number;
  to: number;
  timestamp: string;  // ISO 8601
  description?: string;
}
```

### 调用位置

`src/engine/store.ts` 的 `load()` 方法 —— 在 `safeParse` 之前调用 `migrateState()`：

```
load():
  readFile → JSON.parse(raw)
  state = migrateState(raw)    // ← 新增
  state = safeParse(schema, state, default)  // 保持 Zod schema 校验
```

### 不做的

- `stats.json` / `event.log` — 它们是独立数据流，schema 由各自的 Zod schema 管控
- `achievements.json` 编译快照 — 无状态派生数据，`agpa init` 重新编译即覆盖
- 外部工具迁移（如 claude-code-guide 的 shell 脚本方式）

## 涉及文件

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/engine/migrate.ts` | 新建 | 迁移引擎 + v0→v1 迁移 + 常量 |
| `src/engine/types.ts` | 修改 | `AchievementState` 加 `schema_version` 和 `migration_history` |
| `src/engine/store.ts` | 修改 | `load()` 中调用 `migrateState()` |
| `tests/engine/migrate.test.ts` | 新建 | 完整迁移测试 |

## 测试要点

1. v0（无版本号）→ v1 迁移正确
2. v1 数据不做任何变更
3. 已有字段不被覆盖
4. 损坏 JSON 不阻塞（熔断返回原始数据）
5. 迁移历史正确记录
6. 幂等性：两次迁移结果一致
7. 边界：空对象、空字符串、null、超大 number
