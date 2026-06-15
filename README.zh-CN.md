# Agent Player Achievements (AGPA) 🏆

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="pixel-art-output/agpa-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="pixel-art-output/agpa-logo-light.png">
    <img alt="AGPA Logo" src="pixel-art-output/agpa-logo-dark.png" width="192">
  </picture>
</p>

<p align="center">
  <a href="./README.md">English</a>&nbsp;|&nbsp;<strong>中文</strong>
</p>

<p align="center">
  给 AI 编程 Agent 的游戏化成就系统。<br>
  <em>写代码、攒经验、解锁成就——你本来就在做的事，现在有了进度条。</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/成就-213-blueviolet" alt="213 成就"></a>
  <a href="#"><img src="https://img.shields.io/badge/测试-1176-green" alt="1176 测试"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml"><img src="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" alt="Node >= 18"></a>
  <a href="#"><img src="https://img.shields.io/badge/CLI-24_命令-orange" alt="24 命令"></a>
</p>

<p align="center">
  <b>Claude Code</b>&nbsp;·&nbsp;<b>Kilo Code</b>&nbsp;·&nbsp;<b>OpenCode</b>&nbsp;·&nbsp;<b>Hermes</b>&nbsp;·&nbsp;<b>OpenClaw</b>
</p>

---

### 没有 AGPA ❌

- **不可见** — 无法看到自己的 Coding 习惯和进步轨迹
- **无法追踪** — 变快了？用了更多工具？无从知晓
- **缺乏动力** — 没有理由去探索 Agent 的全部功能
- **日复一日** — 每天都是相同的流程，没有惊喜，没有里程碑

### 有了 AGPA ✅

- **自动追踪** — 每次工具调用、文件编辑、git commit 都自动记录
- **Steam 风格 Dashboard** — XP 进度条、等级、连续天数、热力图、成就展示柜
- **213 个成就** — 覆盖 11 个分类，从 "Hello World" 到 "完美主义者"
- **即时反馈** — 终端弹窗、macOS 通知、8-bit 解锁音效

---

## 快速开始

```bash
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

就这些。之后正常使用 Agent，成就会在你工作过程中自动解锁。

> [!TIP]
> 想提前看看 Dashboard 长什么样？运行 `agpa demo` 即可生成演示数据，无需等待真实解锁。

```bash
agpa dashboard   # 打开成就面板
agpa stats       # 查看进度
```

## 工作原理

```
你的 Coding Session
  │
  ├─ 你写代码，Agent 回应 — 每一次操作都被自动记录
  │   └─ 双通道：MCP 工具调用 + Hook 事件
  │
  ├─ Session 结束 → 引擎评估 213 个成就条件
  │   └─ 解锁了？→ macOS 通知弹窗 🎉
  │
  └─ agpa dashboard → 查看、筛选、排序、分享
```

**两条数据通道 → 一个引擎 → 一个 Dashboard：**

| 通道 | 方式 | 采集的事件 |
|------|------|-----------|
| **Hook CLI** | 工具钩子（短命子进程，通过 stdin） | file.read/write/edit、tool.complete、git.commit、session.start/end、task.complete、agent.spawn |
| **MCP Server** | STDIO 协议（5 个工具） | image.read、file.language_used、plan.mode_entered、user.message、automode.start |

两个通道写入同一份 `~/.agent-achievements/` 事件日志。引擎用 12 种条件类型评估 213 个成就。

> [!NOTE]
> **零性能开销。** Hook CLI 是亚毫秒级子进程。MCP Server 运行在 STDIO 上，零网络调用。所有数据只存在于你的机器上。

## 功能特性

- 🎮 **成就 Dashboard** — XP 进度条、等级、连续天数、活跃热力图、稀有度分布、展示柜
- 🏆 **213 个成就** — 覆盖 11 个分类（入门、工具精通、里程碑、技能、风格、工作流、创造者、隐藏、挑战、社区、持久力）
- 🔥 **GitHub 风格热力图** — 近 4 个月 Coding 活跃度一览
- 📸 **分享卡片** — 暗/亮主题，中英双语，一键下载 PNG
- 🔊 **8-bit 音效** — 按稀有度分级的复古解锁音效
- 🔔 **macOS 通知** — 解锁时弹窗，点击跳转 Dashboard
- 📊 **XP & 等级系统** — 使用量加权 XP + 等级阶梯
- 📂 **多档案** — 最多 4 个 profile，随时切换
- 🌓 **暗/亮双主题** — 自动检测系统偏好
- 🖥️ **终端 ANSI 弹窗** — 终端内成就解锁横幅

## 支持的工具

<p align="center">
  <a href="#claude-code"><img src="https://img.shields.io/badge/Claude_Code-auto_+_MCP-blueviolet?logo=claude" alt="Claude Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/Kilo_Code-auto_+_MCP-00b4d8" alt="Kilo Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/OpenCode-auto_+_MCP-2ec4b6" alt="OpenCode"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/Cursor-MCP_only-007acc?logo=cursor" alt="Cursor"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/VS_Code-MCP_only-007acc?logo=visualstudiocode" alt="VS Code"></a>
  <a href="#hermes"><img src="https://img.shields.io/badge/Hermes-MCP_only-ff6b6b" alt="Hermes"></a>
  <a href="#openclaw"><img src="https://img.shields.io/badge/OpenClaw-auto_+_MCP-ffd166" alt="OpenClaw"></a>
</p>

| 工具 | 自动追踪 | MCP 追踪 | 推荐方式 |
|------|:------:|:-------:|---------|
| Claude Code | ✅ | ✅ | `agpa init` 自动检测 |
| Kilo Code | ✅ | ✅ | TS 插件 + MCP 配置 |
| OpenCode | ✅ | ✅ | TS 插件 + MCP 配置 |
| Hermes | — | ✅ | MCP JSON 配置 |
| OpenClaw | ✅ | ✅ | 插件 + MCP 配置 |

全部 5 个工具均有双通道覆盖（Hermes 除外，仅 MCP）。任何 MCP 兼容客户端（Cursor、VS Code、Windsurf 等）均可通过 MCP 追踪使用，只是缺少 Hook 级别的自动追踪。

> [!TIP]
> **刚接触 MCP？** 从 `agpa init` 开始 — 它会自动检测已安装的工具并完成配置。以下手动 JSON 配置供参考。

<details>
<summary><b>Claude Code</b> — 自动追踪 + MCP（完整覆盖）</summary>

`agpa init` 自动检测 Claude Code 并注册双通道。手动配置如下：

**MCP 配置** (`~/.claude/.mcp.json` 或项目根目录 `.mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```

**Hook 注册** — `agpa init` 自动添加 hook 配置到 Claude Code 设置。用 `agpa verify` 验证。
</details>

<details>
<summary><b>Cursor / VS Code</b> — 仅 MCP</summary>

这些编辑器支持 MCP 但不支持 Hook API 的自动追踪。通过 MCP 获得工具调用追踪。

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>Kilo Code / OpenCode</b> — 自动追踪 + MCP（完整覆盖）</summary>

这些工具通过 TS 插件支持 Hook 级自动追踪。`agpa init` 注册插件 + MCP 配置。

**手动 MCP 配置** (`opencode.json` 或 Kilo Code 设置):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```

TS 插件（由 `agpa init` 注册）自动处理 PostToolUse、SessionStart、SessionEnd 等 hook 事件。
</details>

<details>
<summary><b>Hermes</b> — 仅 MCP</summary>

Hermes 不提供 Hook API。MCP 追踪覆盖工具调用和会话事件。

**MCP 配置** (`~/.hermes/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>OpenClaw</b> — 自动追踪 + MCP（完整覆盖）</summary>

OpenClaw 支持插件系统以进行 Hook 级追踪。`agpa init` 同时注册插件和 MCP 配置。

**手动 MCP 配置**:
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```
</details>

## CLI 命令

```bash
agpa init             # 自动检测并注册到你的 Agent 工具
agpa verify           # 验证安装是否正确
agpa doctor           # 诊断系统状态
agpa dashboard        # 启动成就面板 (localhost:3867)
agpa stats            # 查看成就进度摘要
agpa progress         # 列出所有成就及状态
agpa profile          # 管理成就档案
agpa demo             # 生成 MVP 演示数据
agpa reset            # 重置所有数据
agpa config           # 查看/修改配置（语言、音效、debug...）
agpa showcase         # 管理展示柜（list、pin、unpin、auto-fill）
agpa search           # 按关键词/稀有度/分类搜索成就
agpa suggest          # 推荐下一个可狩猎的成就
agpa sound            # 测试音效
agpa activity         # 查看连续天数 + 活跃热力图
agpa export           # 导出成就数据
agpa import           # 从备份文件导入
agpa mcp              # 启动 MCP 服务器（STDIO）
agpa web              # dashboard 别名
```

## 成就分类

| # | 分类 | 数量 | 亮点 |
|---|------|:---:|------|
| 1 | 入门 (Onboarding) | 14 | Hello World、首次工具调用、首次 PR |
| 2 | 工具精通 (Tool Mastery) | 38 | Read/Edit/Bash 技能门槛 |
| 3 | 里程碑 (Milestones) | 19 | 任务数、连续天数、Token 消耗 |
| 4 | 技能 (Skill) | 17 | 链式反应、捉虫、一发入魂 |
| 5 | 风格 (Style) | 17 | 极简主义、夜猫子、Ctrl C+V 之王 |
| 6 | 工作流 (Workflow) | 29 | PR、CI/CD、Code Review、Merge Conflict |
| 7 | 创造者 (Creator) | 9 | 斜杠命令、技能、自定义 Agent、Hook |
| 8 | 隐藏 (Hidden) | 47 | 彩蛋和惊喜解锁 |
| 9 | 挑战 (Challenge) | 13 | 速通、多模型、零编辑连击 |
| 10 | 社区 (Community) | 9 | 完美主义等级、跨工具收集者 |
| 11 | 持久力 (Endurance) | 1 | 马拉松 session、长期连续 |

## Dashboard

<p align="center">
  <em>统计行 → 连续天数 + 热力图 → 展示柜 → 成就网格（搜索/筛选）</em>
</p>

```bash
agpa dashboard                # 默认 :3867
agpa dashboard 8080           # 自定义端口
agpa dashboard --profile work # 指定 profile 启动
```

- **统计行**：XP、等级、总成就数、连续天数、任务数、工具调用数
- **热力图**：GitHub 风格 4 个月活跃度网格
- **展示柜**：置顶你最爱的成就（最多 6 个）
- **成就网格**：搜索、稀有度/分类排序、已解锁/未解锁过滤
- **音效开关**：8-bit 稀有度分级音效
- **分享按钮**：生成精美双语卡片 → PNG 下载

## 架构

```
                    ┌─────────────────────────┐
                    │   Engine (src/engine/)   │
                    │   track() / poll()       │
                    └─────────────────────────┘
                      ↗                    ↖
            MCP Server               Hook CLI
          (src/main.ts)           (src/cli/hook.ts)
                │                        │
          STDIO 长连接               短命子进程
                │                  (stdin pipe)
                │                        │
          Agent 主动调用            Hook 自动触发
          "有意识的行为"            "Agent 无感知"
                │                        │
          ┌─────┴─────┐          ┌──────┴──────┐
          │ 手动 track │          │ auto-track  │
          │ image.read │          │ tool.complete│
          │ lang_used  │          │ file.edit   │
          │ plan.mode  │          │ session.*   │
          │ ...        │          │ agent.spawn │
          └───────────┘          └─────────────┘
                    ╲            ╱
                     event.log  ← 双通道写同一份
                          │
                     engine.poll()
                          │
                     state.json
                          │
                     Dashboard
```

## 项目结构

```
src/
├── main.ts                  # MCP Server 入口（STDIO）
├── cli/
│   ├── hook.ts              # Hook CLI（track + poll + auto 模式）
│   ├── init.ts              # 交互式安装向导
│   ├── dashboard.ts         # Dashboard 启动
│   ├── doctor.ts            # 系统诊断
│   ├── mvp.ts               # 演示数据生成
│   └── ...                  # 13 个更多 CLI 命令
├── engine/
│   ├── engine.ts            # 核心引擎（track / poll / stats）
│   ├── evaluator.ts         # 12 种条件类型评估器
│   ├── store.ts             # JSONL 事件日志 + 状态持久化
│   ├── types.ts             # TypeScript 类型定义
│   └── yaml-parser.ts       # YAML 成就定义解析器
├── dashboard/
│   ├── server.ts            # HTTP 服务器 + API 路由
│   ├── api.ts               # 卡片数据、统计聚合
│   ├── public/              # 零框架 HTML/CSS/JS 前端
│   └── customize-api.ts     # 自定义名称端点
├── tools/                   # MCP 工具定义（5 个工具）
├── utils/                   # 通知、校验、日志、错误处理、profile
├── config.ts                # 全局配置
└── helpers.ts               # 共享工具函数

pixel-art-output/            # Logo + 成就像素画
achievement-definitions.yaml   # 213 个成就定义（权威数据源）
scripts/                     # 开发工具（logo 生成、像素画生成、音效）
```

## 开发

```bash
npm install          # 安装依赖（仅 3 个运行时依赖）
npm run build        # tsc --noEmit
npm test             # 1176 个测试，45 个文件
npm run dashboard    # 启动开发模式 Dashboard
npm run demo         # 生成演示数据
```

## 依赖

- **运行时** (4): `@modelcontextprotocol/sdk` · `yaml` · `zod` · `figlet`
- **开发**: `typescript` · `vitest` · `tsx`
- **可选** (macOS): `terminal-notifier` — 解锁时系统通知弹窗

无重型框架。无数据库。纯内存引擎 + JSONL 文件存储。

> [!NOTE]
> **刻意极简。** 仅 4 个运行时依赖，零网络调用。引擎是纯函数 + JSONL 存储 — 易于审计，难以出错。

## FAQ

**Q: 会影响我的 Agent 速度吗？**
A: 不影响。Hook CLI 是亚毫秒级子进程。MCP Server 在 STDIO 上运行，零网络开销。

**Q: 能同时用于多个 Agent 工具吗？**
A: 可以。安装向导会自动检测 Claude Code、Kilo Code、OpenCode、Hermes、OpenClaw。每个工具可以有独立的 profile。

**Q: 成就为什么没解锁？**
A: 运行 `agpa doctor` — 它会诊断追踪状态、Hook 注册情况和事件覆盖率。

**Q: 可以自定义成就名称吗？**
A: 可以。Dashboard 里的 `/customize` 页面允许你重命名任何成就。

## 故障排除

> [!IMPORTANT]
> **遇到任何问题，第一步：** 运行 `agpa doctor` — 它一次性诊断追踪状态、Hook 注册、事件覆盖率和配置问题。

| 症状 | 可能原因 | 解决方案 |
|------|---------|---------|
| 成就未解锁 | Hook/MCP 未注册 | 运行 `agpa doctor` 检查 Hook 注册 + 事件覆盖 |
| Dashboard 无法启动 | 端口 3867 被占用 | `agpa dashboard 8080`（或任意空闲端口） |
| `agpa init` 失败 | 未检测到 Agent 工具 | 检查支持的工具列表；使用手动 MCP JSON 配置作为备选 |
| 无 macOS 通知 | 缺少 `terminal-notifier` | 运行 `brew install terminal-notifier`，或 `agpa init` 自动安装 |
| 音效不播放 | 浏览器阻止了音频上下文 | 点击 Dashboard 页面任意位置以启用音频 |
| Profile 切换无效 | Profile 不存在 | `agpa profile list` 查看可用 profile，然后 `agpa profile switch <name>` |
| Agent 日志中有 Hook CLI 报错 | stdin pipe 为空（首次运行正常现象） | 正常 — Hook 是短命子进程；报错会记录到 `~/.agent-achievements/error.log` |

如果问题持续，检查 `~/.agent-achievements/error.log` 或 [提交 Issue](https://github.com/eiainano/AgentPlayerAchievements/issues)。

## Star History

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=eiainao/AgentPlayerAchievements&theme=dark&type=Date">
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=eiainao/AgentPlayerAchievements&type=Date" width="100%">
</picture>

## License

MIT — 详见 [LICENSE](LICENSE)

---

<p align="center">
  <sub>为喜爱游戏化的开发者而建。213 个成就，还在增长中。</sub>
</p>
