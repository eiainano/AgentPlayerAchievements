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
| `dashboard.ts [port]` | 启动仪表盘 |
| `doctor.ts` | 诊断系统状态 |
| `init.ts --tool <name>` | 注册到 Agent 工具 |

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
│   ├── hook.ts             # Hook CLI（track + poll）
│   ├── init.ts             # 注册到 Agent 工具
│   ├── dashboard.ts        # Dashboard 启动
│   ├── doctor.ts           # 诊断工具
│   └── mvp.ts              # MVP 数据生成
├── engine/
│   ├── engine.ts           # 核心引擎（track / poll / stats）
│   ├── evaluator.ts        # 条件评估器
│   ├── store.ts            # 持久化存储
│   ├── types.ts            # 类型定义
│   ├── counter-cache.ts    # 计数器缓存
│   └── yaml-parser.ts      # YAML 解析器
├── tools/                  # MCP tool 注册
├── dashboard/              # Dashboard HTTP 服务 + 前端
├── config.ts               # 配置管理
└── helpers.ts              # 工具函数

tools/                      # 像素画生成工具
├── img-to-pixelart.mjs     # SVG/PNG → 像素画 YAML
├── render-png.mjs          # YAML → PNG 导出
└── term-preview.mjs        # 终端 ANSI 预览

04-成就定义清单.yaml         # 完整成就定义
```

## 成就定义

所有成就定义在 `04-成就定义清单.yaml`，包含 10 个分类共 109 个成就（其中 30 个 MVP 现可解锁）。

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
- `tsx` — TypeScript 直接执行
- `terminal-notifier`（可选）— macOS 通知
