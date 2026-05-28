# 开发日志

---

## 2026-05-24 (condition-types)

### 完成
- **6 个 condition type 全部实现** — evaluator.ts 新增 ~100 行，覆盖全部 12 个类型：
  - `set_completion` — 检查某稀有度全收集（支持 include_above），在 evaluateAll 中特殊处理
  - `mode` — 最频繁值是否在指定区间，支持 threshold（如 >50% 的 session 在凌晨）
  - `sequence_count` — 统计事件模式重复次数
  - `pattern_match` — 正则匹配事件 payload 字段，支持 role 过滤
  - `ratio` — 两个字段累计值之比
  - `percentile` — 占位实现（MVP 无全局数据），始终返回 false

### 改动文件
- 修改：`src/engine/evaluator.ts`、`src/engine/types.ts`、`src/engine/yaml-parser.ts`、`tests/engine/evaluator.test.ts`、`tests/engine/integration.test.ts`

---

## 2026-05-24 (review-round-2)

### 完成
- **集成测试** — `tests/engine/integration.test.ts`，加载真实 YAML、模拟会话、检查解锁结果。发现：单次会话解锁 6 个成就，5 次重会话解锁 10 个；6 个 condition type 未实现（mode, pattern_match, percentile, ratio, sequence_count, set_completion）
- **替换 filter 的 Function() eval** — `evaluator.ts` 的 `matchFilter` 从 JS eval 替换为安全解析器（支持 `==` / `!=` / `in` / `matches` / `contains` / `&&` / `||`），兼容遗留的 bare `contains 'X'` 语法
- **删除 CounterCache** — 117 行文件 + 80 行测试删除；engine.ts -12 行，store.ts -20 行，types.ts -7 行。Cache 在 track() 时维护但 evaluator 从未读取——纯死代码
- 改动文件：新增 `tests/engine/integration.test.ts`；修改 `src/engine/evaluator.ts`、`src/engine/engine.ts`、`src/engine/store.ts`、`src/engine/types.ts`、`tests/engine/evaluator.test.ts`；删除 `src/engine/counter-cache.ts`、`tests/engine/counter-cache.test.ts`

---

## 2026-05-24 (continued)

### 完成
- **.gitignore** — 新增，忽略 node_modules/、.playwright-mcp/、head、dashboard 截图、.env
- **TOOL_PATHS 去重** — 新建 `src/tool-registry.ts` 共享工具注册表，`init.ts` 和 `doctor.ts` 统一引用
- **YAML 解析器替换** — 手写正则 → `yaml` npm 包，带完整错误提示（未知 condition type、缺少 id 等）
- **通知 fallback** — `terminal-notifier` 不可用时自动降级到 `osascript`
- 改动文件：新增 `src/tool-registry.ts`、`.gitignore`；修改 `src/engine/yaml-parser.ts`、`src/cli/init.ts`、`src/cli/doctor.ts`、`src/cli/hook.ts`、`src/tools/poll.ts`、`tests/engine/yaml-parser.test.ts`

### 技术债清理
- `init.ts` 从 453 行 → 387 行（-66 行，移除重复 TOOLS 定义）
- `doctor.ts` 从 282 行 → 268 行（-14 行，移除重复 TOOL_PATHS/INSTRUCTION_FILES）
- `yaml-parser.ts` 从 87 行 → 81 行（更健壮、完整的类型校验）

---

## 2026-05-24

### 完成
- **OS 原生通知升级** — `osascript` → `terminal-notifier`
  - 通知 icon 使用像素画盾牌（`pixelart-shield-gold.png`），首次使用自动复制到 `~/.agent-achievements/`
  - 点击通知 → 跳转 Dashboard（`http://localhost:3867`）
  - 通知带 emoji（来自成就定义中的 `icon` 字段）
  - 通知分组（`agpa.achievement`），后一条替换前一条
  - 播放系统默认提示音
- 改动文件：`src/cli/hook.ts`（Hook 自动追踪）、`src/tools/poll.ts`（MCP poll 工具）

### 依赖
- 需要 `terminal-notifier`（已通过 Homebrew 安装于 `/opt/homebrew/bin/terminal-notifier`）

---

## 2026-05-19

### 完成
- **img-to-pixelart.mjs** — 统一图像→像素画转换工具，支持 SVG（单色自动着色）和 PNG（直接量化）输入，输出 48/128/256 三种分辨率 YAML
- **更新 11-像素画方案设计.md** — 24×24 改为多分辨率格式，palette ≤35 色，补充输入管线文档
- 测试 Claude icon PNG 输入全流程，验证终端预览、YAML 输出、PNG 导出一致性

### 决策
- 输入方案：混合 SVG（Phosphor 图标，抽象概念）+ AI 生图 PNG（nano banana，具体物体）
- 分辨率：48（终端/弹窗）、128（Dashboard 卡片）、256（详情页）
- 终端 ANSI 预览为调试用，实际场景是成就通知弹窗
- CC 默认折叠 ANSI 输出块，需 ctrl+o 展开
- 建立 DEVLOG.md 手动记录开发进展（保留决策上下文）

### 工具文件
| 文件 | 用途 |
|------|------|
| `tools/img-to-pixelart.mjs` | SVG/PNG → 多分辨率 pixel_art YAML |
| `tools/term-preview.mjs` | 纯终端 ANSI 预览（调试用） |
| `tools/render-png.mjs` | YAML → PNG 文件导出 |
| `tools/svg-to-pixelart.mjs` | 旧版单分辨率转换器（已被 img-to-pixelart 取代） |

### 完成
- **MVP 从 .mjs 迁移到 TypeScript** — 建立 `package.json` / `tsconfig.json`，`agpa-engine.ts` 带完整类型定义（EventType, Condition, AchievementDefinition, EvaluationResult 等），通过 `tsx` 无编译直接运行
- **删除旧 .mjs 文件** — `agpa-engine.mjs` / `agpa-mvp.mjs` 已被 `.ts` 替代

### 技术栈
- 运行时：`tsx`（TypeScript 免编译执行）
- 类型系统：strict mode + `noUncheckedIndexedAccess`
- 模块格式：ES Module（`"type": "module"`）
- 依赖：仅 `tsx` + `typescript` + `@types/node`，零运行时依赖（YAML 解析自研）

### 待做
- 30 个 MVP 成就批量配图生成
- Dashboard SVG 渲染引擎
- agpa CLI `pixelart` 子命令集成
### 完成
- **MCP Server MVP** (`agpa-mcp.ts`) — 基于 `@modelcontextprotocol/sdk`，注册 4 个 tools：
  - `achievement.track(event_type, payload)` — 事件记录，<1ms，append-only
  - `achievement.poll()` — 评估条件，返回新解锁成就（每次最多 5 个，pending 队列防止刷屏）
  - `achievement.stats()` — 用户统计数据
  - `achievement.showcase(action, slot?, achievement_id?)` — 展示柜管理（view / set / auto 三种操作）
- **STDIO 协议测试通过** — JSON-RPC initialize / tools/list / tools/call 全流程验证
- **`.mcp.json` 配置** — 可直接被 Claude Code 等 Agent 工具识别

### 待做
- 30 个 MVP 成就批量配图生成
- Dashboard SVG 渲染引擎
- agpa CLI `pixelart` 子命令集成
- Pending 队列完善（当前内存+文件，后续改纯文件以保证多进程安全）
- OS 原生通知通道

---

## 2026-05-24 (route-a-cleanup)

### 完成
- **evalThreshold 升级** — 补全 role 过滤、session window、filter 支持、operator 运算符分发，与 evalCounter 功能对齐
- **Showcase 存储去重** — `loadShowcase` / `saveShowcase` 提取到 `helpers.ts`，MCP tool 和 Dashboard server 共用
- **`contains '?'` 过滤器** — 遗留 bare `contains 'X'` 语法正常工作

### 改动文件
- 修改：`src/engine/evaluator.ts`、`src/dashboard/server.ts`、`src/tools/showcase.ts`、`src/helpers.ts`

---

## 2026-05-24 (code-quality)

### 完成
- **P0: YAML 条件字段修复** — 解析器 `events` → `sequence` fallback（影响 9 个成就）；`chain_reaction` 改为标准 counter；移除 5 处无用的 `order: true`
- **P1: evalCounter/evalThreshold 合并** — 删除 `evalThreshold`（35行），dispatcher 中 fall-through
- **P1: 通知逻辑去重** — 新建 `src/utils/notify.ts`，hook.ts / poll.ts 导入共享模块
- **P2: 统计数据去重** — `buildApiResponse` 接受 `engine.stats()`，删除 15 行重复计算
- **P2: npm run build** — 新增 `"build": "tsc --noEmit"`
- **P2: Slot 对齐** — 移除 `slice(0,4)` 限制，6 格全部展示
- **P3: 死代码清理** — 删除 `tools/types.ts`（25行）、Condition 中 4 个未使用字段（min_matches/window_size/mode_field/metric）、`AchievementDefinition.progress`、`num()` 函数
- **P3: JSON.parse Zod 校验** — 新建 `src/utils/validate.ts`，store / config / helpers 的 JSON.parse 全部改用 `safeParse()`，数据损坏时安全降级

### 改动文件
- 修改：`src/engine/types.ts`、`src/engine/yaml-parser.ts`、`src/engine/evaluator.ts`、`src/engine/engine.ts`、`src/engine/store.ts`、`src/cli/hook.ts`、`src/tools/poll.ts`、`src/dashboard/api.ts`、`src/dashboard/server.ts`、`src/dashboard/public/app.js`、`src/dashboard/public/styles.css`、`src/config.ts`、`src/helpers.ts`、`package.json`、`04-成就定义清单.yaml`、`tests/dashboard/api.test.ts`
- 新增：`src/utils/notify.ts`、`src/utils/validate.ts`
- 删除：`src/tools/types.ts`

---

## 2026-05-24 (sets-rewards)

### 完成
- **套装 rewards 接入** — 解析 YAML 顶层 `sets:` 块，9 个套装定义完整加载
- **类型系统** — 新增 `SetDefinition`、`SetReward`、`SetRewardType`（6 种奖励类型）
- **Dashboard 前端** — 套装完成时显示奖励徽章（title/badge/theme/border/animation/stat_counter 各独立配色）

### 改动文件
- 修改：`src/engine/types.ts`、`src/engine/yaml-parser.ts`、`src/engine/engine.ts`、`src/dashboard/api.ts`、`src/dashboard/server.ts`、`src/dashboard/public/app.js`、`src/dashboard/public/styles.css`、`tests/dashboard/api.test.ts`

---

## 2026-05-24 (hook-auto-track)

### 完成
- **hook.ts `auto` 命令** — 从 stdin 读取 CC hook JSON，自动映射为 AGPA 事件
- **多重事件派生** — PostToolUse Write → `tool.complete` + `file.create`；Read → `tool.complete` + `file.read`；Edit → `tool.complete` + `file.edit`；Bash → `tool.complete` + `command.run`（+ `git.commit`）；MCP → `tool.complete` + `mcp.tool_call`
- **init.ts 扩展** — 新增 PostToolUse、PostToolUseFailure、SubagentStart、SubagentStop 四个 hook 注入，全部 `async: true` + `timeout: 5` 不阻塞工具执行
- **AGENTS.md 优化** — 简化提示：自动化事件说明 + 手动 track 列表 + poll 提醒
- **手动验证通过** — 模拟 PostToolUse (Write/Bash) 和 SubagentStart JSON，事件正确写入 event.log

### 改动文件
- 修改：`src/cli/hook.ts`、`src/cli/init.ts`、`AGENTS.md`

### 事件映射表
| CC Hook | AGPA 事件 |
|---------|-----------|
| PostToolUse (Write) | `tool.complete` + `file.create` |
| PostToolUse (Read) | `tool.complete` + `file.read` |
| PostToolUse (Edit) | `tool.complete` + `file.edit` |
| PostToolUse (Bash) | `tool.complete` + `command.run` (+ `git.commit`) |
| PostToolUse (mcp__*) | `tool.complete` + `mcp.tool_call` |
| PostToolUseFailure | `tool.failure` |
| SubagentStart | `agent.spawn` |
| SubagentStop | `agent.complete` |

### 待验证
- 真实 CC 会话中 `async: true` + `timeout: 5` 稳定性
- 需重跑 `npm run init -- --tool claude-code` 写入新 hook 配置

---

## 2026-05-24 (percentile)

### 完成
- **Percentile 条件类型实现** — 不再是 stub，完整的客户端-服务端架构
- **Stats Server** (`src/server/stats-server.ts`) — 零依赖 HTTP 服务
  - POST `/report` — 匿名上报 `{ metric, value }`，reservoir sampling 存储（上限 10000）
  - GET `/thresholds` — 返回 `{ metric: { p10, p25, p50, p75, p90 } }`（≥10 样本才计算）
  - GET `/health` — 服务状态
  - 5 秒防抖写盘，`~/.agpa-stats-server/data.json` 持久化
- **Telemetry 客户端** (`src/telemetry.ts`)
  - `computeLocalMetrics()` — 从 events 计算 `avg_prompt_length` 等指标
  - `reportMetrics()` + `fetchThresholds()` — POST 上报 + GET 阈值缓存
  - `runTelemetry()` — 集成到 `engine.poll()`，默认关闭
- **evalPercentile 实现** — 计算本地 metric → 读缓存阈值（fallback 硬编码）→ 判断是否达到百分位
- **配置扩展** — `telemetry: boolean` + `telemetry_server: string`，支持 env var 覆盖，MCP config tool 可读写
- **端到端验证通过** — 服务端 20 条种子数据 → 客户端上报 avg=49.8 → 阈值 p10=80 → minimalist 正确解锁，novelist 正确锁定

### 改动文件
- 新增：`src/server/stats-server.ts`、`src/telemetry.ts`
- 修改：`src/engine/evaluator.ts`、`src/engine/engine.ts`、`src/engine/types.ts`、`src/engine/yaml-parser.ts`、`src/config.ts`、`src/utils/validate.ts`、`src/tools/config.ts`、`package.json`

### Percentile 数据流
```
conversation.message events → computeMetric(avg_prompt_length)
  → telemetry: POST /report → server reservoir sampling
  → telemetry: GET /thresholds → cache thresholds.json
  → evalPercentile: local_value ≤ p10? → minimalist UNLOCK
```
