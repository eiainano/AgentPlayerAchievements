# 数据导出/导入 — 备份 & 迁移设计

**日期:** 2026-06-05
**状态:** 设计阶段，待实施
**上下文:** P1-4 建议落地。当前无备份/导出功能。用户数月解锁的成就，`rm state.json` 就全没了，换机器/系统重装也无恢复途径。cc-lens 提供了 export JSON 功能——这是数据安全基本保障。

---

## 1. 背景

### 1.1 当前存储文件

| 文件 | 内容 | 大小（典型） |
|------|------|-------------|
| `state.json` | 成就解锁状态 + stats | ~5 KB |
| `stats.json` | Agent 工具统计 + 日聚合 | ~3 KB |
| `showcase.json` | 展示柜 slot 配置 | ~0.5 KB |
| `config.json` | 全局配置（active_profile 等） | ~0.2 KB |
| `event.log` | 全量事件日志 | ~500 KB（5228 事件）|
| `profile.json` | profile 元数据（emoji, created_at） | ~0.1 KB |

### 1.2 导出策略

- **默认导出 core**（state + stats + showcase），不含 event.log（太大）
- **可选导出 full**（含 event.log），用于完整迁移
- 导出文件为单一 `.agpa-export.json`，方便传输
- 不加密——数据不包含用户代码或提示词，隐私风险低

---

## 2. 设计

### 2.1 导出格式

```typescript
interface ExportPayload {
  // 元数据
  format_version: '1.0';
  exported_at: string;              // ISO 8601
  source: {
    tool: 'agpa';
    version: string;                // AGPA 版本号
    profile: string;                // 来源 profile 名
    profile_emoji: string;
  };

  // 核心数据（总是导出）
  state: AchievementState;          // state.json 内容
  stats: AgentToolStats | null;     // stats.json 内容
  showcase: ShowcaseData;           // showcase.json 内容

  // 可选数据
  events?: TrackedEvent[];         // event.log 内容（full 模式）
  config?: AppConfig;               // config.json 内容（迁移模式）
}
```

### 2.2 导出文件示例

```json
{
  "format_version": "1.0",
  "exported_at": "2026-06-05T10:00:00.000Z",
  "source": {
    "tool": "agpa",
    "version": "0.1.6",
    "profile": "default",
    "profile_emoji": "📂"
  },
  "state": {
    "unlocked": {
      "first_steps": "2026-05-15T10:30:00.000Z",
      "century_club": "2026-06-01T14:00:00.000Z"
    },
    "stats": { "total_unlocked": 45 },
    "last_evaluated_line": 5228
  },
  "stats": {
    "version": "2.0",
    "last_updated": "2026-06-05T09:00:00.000Z",
    "last_aggregated_line": 5228,
    "sessions": { "claude-code": 45 },
    "user_messages": { "claude-code": 890 },
    "usage_time_ms": { "claude-code": 3600000 },
    "daily": { "2026-06-01": { "tool_calls": 87, "sessions": 3, "user_msgs": 45, "tokens": 250000, "unique_tools": 8, "duration_secs": 5400, "tools_used": ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task", "WebSearch"] } }
  },
  "showcase": {
    "slots": [
      { "slot": 0, "achievement_id": "first_steps" },
      { "slot": 1, "achievement_id": "century_club" },
      { "slot": 2, "achievement_id": null },
      { "slot": 3, "achievement_id": null }
    ]
  }
}
```

### 2.3 导出命令

```bash
# 导出当前 profile
agpa export

# 导出指定 profile
agpa export work

# 导出到指定路径
agpa export --output ~/Desktop/agpa-backup.json

# 完整导出（含 event.log）
agpa export --full

# 迁移导出（含 config.json）
agpa export --migrate
```

输出：
```
🏆 AGPA Export
Profile: 📂 default
Format:  core

✓ state.json     — 45 achievements unlocked
✓ stats.json     — 45 sessions, 3 tools
✓ showcase.json  — 2 slots configured

Export saved to: ~/.agent-achievements/exports/agpa-default-2026-06-05.json (~8 KB)
```

### 2.4 导入命令

```bash
# 导入备份文件
agpa import ~/Desktop/agpa-backup.json

# 导入到指定 profile
agpa import backup.json --profile work

# 预览（dry-run，不实际导入）
agpa import backup.json --dry-run

# 强制覆盖（不提示冲突）
agpa import backup.json --force
```

导入流程：
```
1. 读取 & 校验导出文件
2. 检查格式版本兼容性
3. DRY-RUN: 显示将要导入的内容
4. 冲突检测:
   ├─ 目标 profile 已有 state.json → 提示冲突
   │   ├─ 用户选择: [m]erge / [r]eplace / [c]ancel
   │   ├─ merge: 合并 unlocked 成就（取 union，保留较早的 unlocked_at）
   │   └─ replace: 覆盖全部数据
   └─ 无冲突 → 直接导入
5. 写入文件（state.json + stats.json + showcase.json）
6. 可选: 写入 event.log（如果有 --full）
7. 写入 config.json（如果有 --migrate）
8. 显示导入摘要
```

### 2.5 冲突解决策略

```typescript
type ImportStrategy = 'merge' | 'replace' | 'cancel';

function resolveImportConflict(
  existing: AchievementState,
  incoming: AchievementState,
  strategy: ImportStrategy,
): AchievementState {
  switch (strategy) {
    case 'merge':
      // Union of unlocked achievements
      // For same achievement, keep the EARLIER unlocked_at
      const merged: Record<string, string> = { ...existing.unlocked };
      for (const [id, unlockedAt] of Object.entries(incoming.unlocked)) {
        if (!merged[id] || merged[id]! > unlockedAt) {
          merged[id] = unlockedAt;
        }
      }
      return { ...existing, unlocked: merged };

    case 'replace':
      return incoming;

    case 'cancel':
      throw new Error('Import cancelled by user');
  }
}
```

### 2.6 Dashboard 按钮

在 Dashboard settings 区域添加两个按钮：

```
┌──────────────────────────────────────────┐
│  ⚙️ Settings                              │
│                                          │
│  📥 Export Data    ─ 下载备份文件         │
│  📤 Import Data    ─ 从备份恢复           │
│                                          │
│  Export 下载 .agpa-export.json 到浏览器   │
│  Import 打开文件选择器上传                │
└──────────────────────────────────────────┘
```

Dashboard 的 export/import 使用 HTTP API：
- `GET /api/export?profile=default&full=true` → 返回 JSON
- `POST /api/import` → body 为导出文件内容，参数 profile + strategy

---

## 3. 文件变更

### 3.1 NEW: `src/cli/export.ts`

```typescript
#!/usr/bin/env node
/**
 * AGPA Export — export achievement data to a portable JSON file
 *
 * Usage:
 *   agpa export [profile] [--output <path>] [--full] [--migrate]
 */

import * as fs from 'fs';
import * as path from 'path';
import { AchievementEngine } from '../engine/engine.js';
import { resolveProfileDir, getProfileMeta } from '../utils/profile.js';
import { loadConfig } from '../config.js';
import type { ExportPayload } from './types.js';

function cmdExport(): void {
  const args = process.argv.slice(3);
  
  // Parse profile (first non-flag arg)
  let profile = 'default';
  let outputPath = '';
  let full = false;
  let migrate = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i] || '';
    } else if (args[i] === '--full') {
      full = true;
    } else if (args[i] === '--migrate') {
      migrate = true;
      full = true; // migrate implies full
    } else if (!args[i]?.startsWith('-')) {
      profile = args[i]!;
    }
  }
  
  const stateDir = resolveProfileDir(profile);
  const engine = new AchievementEngine({ stateDir });
  engine.init();
  
  const meta = getProfileMeta(profile);
  const pkgVersion = readPackageVersion();
  
  const payload: ExportPayload = {
    format_version: '1.0',
    exported_at: new Date().toISOString(),
    source: {
      tool: 'agpa',
      version: pkgVersion,
      profile: meta.name,
      profile_emoji: meta.emoji,
    },
    state: engine.state,
    stats: engine.toolStats(),
    showcase: loadShowcase(stateDir),
  };
  
  if (full) {
    payload.events = engine.events;
  }
  if (migrate) {
    payload.config = loadConfig();
  }
  
  // Determine output path
  if (!outputPath) {
    const exportDir = path.join(stateDir, 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    const mode = full ? (migrate ? 'migrate' : 'full') : 'core';
    outputPath = path.join(exportDir, `agpa-${profile}-${dateStr}-${mode}.json`);
  }
  
  // Atomic write
  const tmp = outputPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, outputPath);
  
  // Summary
  const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`\n🏆 AGPA Export`);
  console.log(`Profile: ${meta.emoji} ${profile}`);
  console.log(`Format:  ${migrate ? 'migrate' : full ? 'full' : 'core'}\n`);
  console.log(`✓ state.json     — ${Object.keys(payload.state.unlocked).length} achievements unlocked`);
  console.log(`✓ stats.json     — ${Object.keys(payload.stats?.sessions || {}).length} tools tracked`);
  console.log(`✓ showcase.json  — ${payload.showcase?.slots?.filter(s => s.achievement_id).length || 0} slots configured`);
  if (full) console.log(`✓ event.log      — ${payload.events?.length || 0} events`);
  
  console.log(`\nExport saved to: ${outputPath} (~${sizeKB} KB)`);
}
```

### 3.2 NEW: `src/cli/import.ts`

类似结构，包含：
- 文件读取 + JSON 校验
- 格式版本兼容性检查
- 冲突检测 + 交互式选择（或 --force / --dry-run）
- 原子写入

### 3.3 NEW: `src/cli/types.ts`

共享的 export/import 类型定义：

```typescript
import type { AchievementState, TrackedEvent } from '../engine/types.js';
import type { AgentToolStats } from '../engine/stats.js';
import type { AppConfig } from '../config.js';

export interface ExportPayload {
  format_version: '1.0';
  exported_at: string;
  source: {
    tool: 'agpa';
    version: string;
    profile: string;
    profile_emoji: string;
  };
  state: AchievementState;
  stats: AgentToolStats | null;
  showcase: ShowcaseData;
  events?: TrackedEvent[];
  config?: AppConfig;
}

export interface ShowcaseData {
  slots: Array<{ slot: number; achievement_id: string | null }>;
}
```

### 3.4 MODIFY: `src/cli/index.ts`

新增两个 COMMANDS 条目：

```typescript
{ name: 'export', description: 'Export achievement data to a portable JSON file', usage: 'agpa export [profile] [--output <path>] [--full] [--migrate]', module: './export.ts' },
{ name: 'import', description: 'Import achievement data from a backup file',          usage: 'agpa import <file> [--profile <name>] [--dry-run] [--force]', module: './import.ts' },
```

### 3.5 MODIFY: `src/dashboard/server.ts`

新增两个 API 端点：

```typescript
// GET /api/export?profile=default&full=true
// → 返回 JSON（Content-Disposition: attachment）

// POST /api/import
// → Body: { data: ExportPayload, profile?: string, strategy?: 'merge' | 'replace' }
// → 返回导入摘要
```

### 3.6 MODIFY: Dashboard HTML/JS

Settings 区域新增 Export/Import 按钮，调用上述 API。

### 3.7 MODIFY: `src/utils/validate.ts`

新增 `exportPayloadSchema` Zod schema 用于导入时的数据校验。

---

## 4. 安全设计

### 4.1 导出安全

- 不导出文件内容（file_path 引用存于 event.log，但无文件内容）
- 不导出用户 prompt 文本（event.log 中的 conversation.message 只存 length，不存 content）
- 不导出敏感配置（API keys 等不在 AGPA 管理范围内）

### 4.2 导入安全

- Zod schema 校验全部输入 → 拒绝格式不匹配的文件
- 路径穿越防护：导入只写入 stateDir 内文件，不写外部路径
- 版本兼容性检查：format_version 不匹配时警告但允许尝试
- 不执行导入文件中的任何代码（纯 JSON）

### 4.3 Dashboard 安全

- Export API：GET 请求，已有 CSRF 防护（x-dev-token header）
- Import API：POST 请求，已有 CSRF 防护
- Import body 大小限制：10 MB（预防 OOM）

---

## 5. 用例

| 场景 | 命令 |
|------|------|
| 日常备份 | `agpa export` |
| 换电脑迁移 | `agpa export --migrate` → 复制文件 → `agpa import backup.json` |
| 分享成就给朋友 | `agpa export` → 发送文件 |
| 多 profile 之间合并 | `agpa export work` → `agpa import work-backup.json --profile personal` |
| 系统重装前备份 | `agpa export --full --output ~/backup/agpa.json` |

---

## 6. 测试计划

### 6.1 单元测试

| # | 场景 | 预期 |
|---|------|------|
| 1 | 导出空 profile | payload 中 state.unlocked = {} |
| 2 | 导出有成就的 profile | state.unlocked 正确包含所有成就 |
| 3 | 导出 --full 含 events | payload.events.length > 0 |
| 4 | 导出到指定路径 | 文件在正确位置 |
| 5 | 导入空目标 | 直接写入，无冲突 |
| 6 | 导入冲突 → merge | union of unlocked，保留更早的时间 |
| 7 | 导入冲突 → replace | 完全覆盖 |
| 8 | 导入损坏文件 | Zod 校验失败，返回错误 |
| 9 | 导入版本不兼容 | 警告但尝试导入 |
| 10 | dry-run 不写入 | 目标文件未被修改 |

### 6.2 集成测试

```
1. agpa demo → 生成测试数据
2. agpa export --full → 验证导出文件结构
3. agpa reset → 清空
4. agpa import backup.json → 恢复
5. 验证 state.json 与导出前一致
6. 验证 event.log 与导出前一致
```

---

## 7. 工作量

| 任务 | 估计 |
|------|------|
| `export.ts` CLI 实现 | 0.3 天 |
| `import.ts` CLI + 冲突解决 | 0.4 天 |
| `cli/types.ts` 类型定义 | 0.1 天 |
| `cli/index.ts` 注册命令 | 0.1 天 |
| Dashboard API 端点 | 0.2 天 |
| Dashboard HTML 按钮 | 0.2 天 |
| `validate.ts` schema | 0.1 天 |
| 测试 | 0.3 天 |
| **总计** | **~1-2 天** |

---

## 8. 依赖 & 风险

| 项目 | 说明 |
|------|------|
| **无强依赖** | 完全独立功能 |
| **弱依赖：** P1-3 日聚合 | stats.json 包含 daily 字段后，导出文件会稍大（~200 KB for 3 years），但完全可接受 |
| **风险：** event.log 导出后文件过大 | --full 模式下 event.log 可达 500 KB-2 MB。不推荐日常使用，仅用于完整迁移 |
| **风险：** 不同 AGPA 版本间的数据格式不兼容 | format_version 检查 + Zod schema 校验提供两道防线 |
