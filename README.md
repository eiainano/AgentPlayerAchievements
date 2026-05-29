# Agent Player Achievements (AGPA)

给 AI coding Agent 的成就系统。支持 Claude Code、Kilo Code、OpenCode、Hermes Agent、OpenClaw。

当你等 AI 输出时，不妨看看成就面板？

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 注册到你的 Agent 工具（自动配置 MCP 和 hook）
npx tsx src/cli/init.ts --tool claude-code
# npx tsx src/cli/init.ts --tool kilocode
# npx tsx src/cli/init.ts --tool opencode
# npx tsx src/cli/init.ts --tool hermes
# npx tsx src/cli/init.ts --tool openclaw

# 3. 启动 Dashboard 看看
npm run dashboard
```

之后正常使用 Agent，hook 会自动记录事件，session 结束时自动评估成就。

## 工作原理

```
Agent 运行
  │
  ├─ SessionStart hook → track session.start
  ├─ 日常使用 → 事件自动记录（MCP / Hook 双通道）
  └─ Stop hook → track session.end + poll（评估解锁）
                        │
                        ├─ 有新成就？→ macOS 通知（terminal-notifier）
                        └─ 无新成就？→ 静默
```

项目分两层：

- **Hook CLI** — 通过 Claude Code 的 SessionStart / Stop hook 运行，直接操作引擎文件，快速轻量
- **MCP Server** — 通过 `src/main.ts` 暴露 tool 给 Agent（MCP stdio 协议），支持 `achievement.track` / `achievement.poll` / `achievement.stats` / `achievement.showcase`

两个路径写同一套数据文件（`~/.agent-achievements/`），互相兼容。

## Dashboard

展示成就进度、统计数据、XP/等级。

```bash
npm run dashboard
# 或指定端口
npx tsx src/cli/dashboard.ts 8080
```

打开 http://localhost:3867

## CLI 命令

| 命令 | 用途 |
|------|------|
| `hook.ts track <event_type>` | 记录一个事件（hook 自动调用） |
| `hook.ts poll` | 评估成就条件（hook 自动调用） |
| `hook.ts auto` | 读取 CC hook stdin JSON 自动映射 AGPA 事件 |
| `dashboard.ts [port]` | 启动仪表盘 |
| `doctor.ts` | 诊断系统状态 |
| `init.ts --tool <name>` | 注册到 Agent 工具 |
| `mvp.ts demo` | 生成 MVP 演示数据 |
| `mvp.ts stats` | 查看成就进度 |

## macOS 通知

解锁新成就时，会通过 `terminal-notifier` 弹出系统通知：

- 自定义 AGPA 图标（像素画盾牌）
- 包含成就 emoji + 名称 + 描述
- 点击跳转 Dashboard
- 带系统提示音，自动分组防刷屏

需要安装 `terminal-notifier`：`brew install terminal-notifier`

## 项目结构

```
src/
├── main.ts                 # MCP Server 入口
├── cli/
│   ├── hook.ts             # Hook CLI（track + poll + auto）
│   ├── init.ts             # 注册到 Agent 工具
│   ├── dashboard.ts        # Dashboard 启动
│   ├── doctor.ts           # 诊断工具
│   └── mvp.ts              # MVP 数据生成
├── engine/
│   ├── engine.ts           # 核心引擎（track / poll / stats）
│   ├── evaluator.ts        # 条件评估器（12 种条件类型）
│   ├── store.ts            # 持久化存储
│   ├── types.ts            # 类型定义
│   └── yaml-parser.ts      # YAML 解析器
├── tools/                  # MCP tool 注册
├── dashboard/              # Dashboard HTTP 服务 + 前端
├── server/                 # Stats server（percentile）
├── utils/                  # 通知、校验、日志、错误处理
├── config.ts               # 配置管理
├── telemetry.ts            # 遥测客户端
├── tool-registry.ts        # 共享工具注册表
└── helpers.ts              # 工具函数

tools/                      # 像素画生成工具
├── img-to-pixelart.mjs     # SVG/PNG → 像素画 YAML
├── render-png.mjs          # YAML → PNG 导出
├── term-preview.mjs        # 终端 ANSI 预览
├── svg-to-pixelart.mjs     # SVG → 像素画（旧版）
├── preview.html            # 像素画预览
├── pixelart-*.png          # 像素画素材

04-成就定义清单.yaml         # 118 个完整成就定义
```

## 成就定义

所有成就定义在 `04-成就定义清单.yaml`，包含 10 个分类共 118 个成就。

每个成就包含：
- id / name / description（中英文）
- icon（emoji）
- category / rarity / hidden
- conditions（触发条件）

## 开发

```bash
npm run build    # 编译检查
npm run test     # 运行测试
npm run dev      # 开发模式
```

## 依赖

- Node.js 18+
- `@modelcontextprotocol/sdk` — MCP 协议
- `yaml` — YAML 解析
- `zod` — 运行时类型校验
- `tsx` — TypeScript 直接执行
- `terminal-notifier`（可选）— macOS 通知
