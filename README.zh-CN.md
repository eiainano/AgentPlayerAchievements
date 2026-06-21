# Agent Player Achievements (AGPA) 🏆

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="pixel-art-output/agpa-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="pixel-art-output/agpa-logo-light.png">
    <img alt="AGPA Logo" src="pixel-art-output/agpa-logo-dark.png" width="192">
  </picture>
</p>

<p align="center">
  <a href="./README.md">EN</a>&nbsp;|&nbsp;<strong>中文</strong>&nbsp;|&nbsp;<a href="./README.es.md">ES</a>&nbsp;|&nbsp;<a href="./README.ko.md">한국어</a>&nbsp;|&nbsp;<a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  给 AI 编程 Agent 的游戏化成就系统。<br>
  <em>写代码、攒经验、解锁成就——你本来就在做的事，现在有了进度条。</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/achievements-217-blueviolet" alt="217 achievements"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-1204-green" alt="1204 tests"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml"><img src="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" alt="Node >= 18"></a>
  <a href="#"><img src="https://img.shields.io/badge/CLI-27_commands-orange" alt="27 CLI commands"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements"><img src="https://img.shields.io/github/stars/eiainano/AgentPlayerAchievements?style=flat&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/commits/dev"><img src="https://img.shields.io/github/last-commit/eiainano/AgentPlayerAchievements/dev" alt="Last commit"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/i18n-5_languages-blue" alt="i18n: 5 languages"></a>
</p>

<p align="center">
  <b>Claude Code</b>&nbsp;·&nbsp;<b>Kilo Code</b>&nbsp;·&nbsp;<b>OpenCode</b>&nbsp;·&nbsp;<b>Hermes</b>&nbsp;·&nbsp;<b>OpenClaw</b>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#工作原理">工作原理</a> ·
  <a href="#功能特性">功能特性</a> ·
  <a href="#支持的工具">支持的工具</a> ·
  <a href="#cli-命令">CLI 命令</a> ·
  <a href="#社区包">社区包</a> ·
  <a href="#仪表盘">仪表盘</a> ·
  <a href="#文档">文档</a> ·
  <a href="#安全与隐私">安全与隐私</a> ·
  <a href="#常见问题">常见问题</a>
</p>

---

### 没有 AGPA ❌

- **看不见**你的编码习惯，跨会话无法追溯
- **无法追踪进步**——变快了？用了更多工具？无从得知
- **没有动力**去探索 Agent 的全部功能
- **每天重复**——没有惊喜，没有里程碑

### 有了 AGPA ✅

- **自动追踪**——每次工具调用、文件编辑、Git 提交都被自动记录
- **Steam 风格仪表盘**——经验条、等级、连胜、热力图、成就展柜
- **217 个成就**，覆盖 11 个类别——从「Hello World」到「完美主义者」
- **即时反馈**——终端弹窗、macOS 通知、8-bit 音效

---

## 快速开始

```bash
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

就这样。继续使用你的 Agent——成就会随着你的工作自动解锁。

> [!TIP]
> 想立刻看看仪表盘长什么样？运行 `agpa demo` 即可生成演示数据。

```bash
agpa dashboard   # 打开成就仪表盘
agpa stats       # 查看进度
```

## 工作原理

```
你的编码会话
  │
  ├─ 你写代码，Agent 响应——每个动作都被追踪
  │   └─ 双通道：MCP 工具 + Hook 事件
  │
  ├─ 会话结束 → 引擎评估 217 个成就
  │   └─ 解锁了？→ macOS 通知 🎉
  │
  └─ agpa dashboard → 查看、排序、筛选、分享
```

**两个数据通道 → 一个引擎 → 一个仪表盘：**

| 通道 | 方式 | 捕获内容 |
|---------|--------|----------|
| **Hook CLI** | 工具钩子（通过 stdin 的子进程） | file.read/write/edit, tool.complete, git.commit, session.start/end, task.complete, agent.spawn |
| **MCP Server** | STDIO 协议（7 个工具） | image.read, file.language_used, plan.mode_entered, user.message, automode.start |

两个通道都写入同一个 `~/.agent-achievements/` 事件日志。引擎用 12 种条件类型评估 217 个成就。

> [!NOTE]
> **零开销。** Hook CLI 是亚毫秒级的子进程。MCP 服务器在 STDIO 上运行，无网络调用。所有数据留在你的机器上。

## 功能特性

- 🎮 **成就仪表盘** — 经验条、等级、连胜、活动热力图、稀有度分布、展柜
- 🏆 **217 个成就**，11 个类别（入门、工具精通、里程碑、技能、风格、工作流、创造者、隐藏、挑战、社区、耐力）
- 🔥 **GitHub 风格热力图** — 4 个月的编码活动一目了然
- 📸 **分享卡片** — 暗色/亮色主题、双语（中/英）、可下载 PNG
- 🔊 **8-bit 音效** — 按稀有度分级的复古解锁音效
- 🔔 **macOS 通知** — 点击即可跳转到仪表盘
- 📊 **XP 和等级系统** — 按使用量缩放的经验值和等级阶梯
- 📂 **多配置文件** — 最多 4 个配置，随时切换
- 🌓 **暗色 & 亮色主题** — 自动检测系统偏好
- 🖥️ **终端 ANSI 弹窗** — 成就解锁横幅直接在终端显示

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

| 工具 | 自动追踪 | MCP 追踪 | 最简单的安装方式 |
|------|:----------:|:---------:|---------------|
| Claude Code | ✅ | ✅ | `agpa init` 自动检测 |
| Kilo Code | ✅ | ✅ | TS 插件 + MCP 配置 |
| OpenCode | ✅ | ✅ | TS 插件 + MCP 配置 |
| Hermes | — | ✅ | MCP JSON 配置 |
| OpenClaw | ✅ | ✅ | 插件 + MCP 配置 |

所有五个工具都有完整的双通道覆盖（Hermes 除外，因为没有 Hook API）。对于任何支持 MCP 的客户端（Cursor、VS Code、Windsurf 等），MCP 追踪开箱即用——只是缺少基于 Hook 的自动追踪。

> [!TIP]
> **刚接触 MCP？** 从 `agpa init` 开始——它会自动检测你安装的工具并完成所有配置。下面的手动 JSON 配置是备选方案。

<details>
<summary><b>Claude Code</b> — 自动追踪 + MCP（完整覆盖）</summary>

`agpa init` 会自动检测 Claude Code 并注册两个通道。手动配置：

**MCP 配置** (`~/.claude/.mcp.json` 或项目根目录的 `.mcp.json`)：
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

**Hook 注册** — `agpa init` 会将 Hook 条目添加到你的 Claude Code 设置中。用 `agpa verify` 验证。
</details>

<details>
<summary><b>Cursor / VS Code</b> — 仅 MCP</summary>

这些编辑器支持 MCP，但没有暴露 Hook API 用于自动追踪。你可以通过 MCP 获得工具调用追踪。

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

这些工具支持 TS 插件进行 Hook 级别的自动追踪。`agpa init` 会注册插件 + MCP 配置。

**手动 MCP 配置** (`opencode.json` 或 Kilo Code 设置)：
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

TS 插件（由 `agpa init` 注册）会自动处理 PostToolUse、SessionStart、SessionEnd 和其他 Hook 事件。
</details>

<details>
<summary><b>Hermes</b> — 仅 MCP</summary>

Hermes 没有暴露 Hook API。基于 MCP 的追踪覆盖工具调用和会话事件。

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

OpenClaw 支持插件系统进行 Hook 级别的追踪。`agpa init` 会注册插件和 MCP 配置。

**手动 MCP 配置**：
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

| 命令 | 描述 |
|---------|-------------|
| `agpa init` | 自动检测并注册到你的 Agent 工具 |
| `agpa uninstall` | 从所有已配置的工具中干净卸载 AGPA |
| `agpa verify` | 检查安装正确性 |
| `agpa doctor` | 诊断系统状态 |
| `agpa dashboard` | 启动成就仪表盘 (localhost:3867) |
| `agpa stats` | 显示成就进度摘要 |
| `agpa progress` | 列出所有成就及其解锁状态 |
| `agpa profile` | 管理成就配置文件（创建、列表、切换） |
| `agpa demo` | 生成 MVP 演示数据用于测试 |
| `agpa reset` | 重置所有追踪数据 |
| `agpa config` | 查看/修改配置（语言、音效、调试等） |
| `agpa showcase` | 管理展柜（列表、固定、取消固定、自动填充） |
| `agpa search` | 按关键词/稀有度/类别搜索成就 |
| `agpa suggest` | 推荐下一个要追求的成就 |
| `agpa sound` | 测试 8-bit 稀有度分级音效 |
| `agpa activity` | 查看连胜 + 4 个月活动热力图 |
| `agpa export` | 导出成就数据为 JSON |
| `agpa import` | 从备份导入 |
| `agpa mcp` | 启动 MCP 服务器（stdio 模式） |
| `agpa web` | `agpa dashboard` 的别名 |
| `agpa pack` | 列出或查看已安装的社区成就包 |
| `agpa banner` | 切换终端 banner 主题色（Neon/Arcade/Gold） |
| `agpa history` | 浏览事件日志 |
| `agpa explain` | 展示成就锁定的条件分析 |
| `agpa watch` | 实时成就监控 |
| `agpa upgrade` | 检查更新并升级 AGPA |
| `agpa completion` | 生成 shell 补全脚本 (bash/zsh/fish) |

> 完整 CLI 参考：`agpa --help`

## 社区包

任何人都可以创建和分享成就包。将 YAML 文件放入 `~/.agent-achievements/packs/` 即可安装：

```bash
agpa pack list              # 列出已安装的包
agpa pack info <id>         # 查看包详情
```

参见[创建成就包指南](docs/creating-achievements.md)，了解包格式规范、事件类型目录和 12 种条件类型。

## 成就类别

| # | 类别 | 数量 | 亮点 |
|---|----------|:-----:|-----------|
| 1 | 入门 | 14 | Hello World, 首次工具调用, 首次 PR |
| 2 | 工具精通 | 38 | Read/Edit/Bash 技能阈值 |
| 3 | 里程碑 | 19 | 任务数, 连胜, token 用量 |
| 4 | 技能 | 16 | 链式反应, 调试器, 一击必中 |
| 5 | 风格 | 17 | 极简主义者, 夜猫子, 复制粘贴之王 |
| 6 | 工作流 | 29 | PR, CI/CD, 代码审查, 合并冲突 |
| 7 | 创造者 | 9 | 斜杠命令, 技能, Agent, Hook |
| 8 | 隐藏 | 47 | 彩蛋和惊喜解锁 |
| 9 | 挑战 | 13 | 极速模式, 多模型, 零编辑连胜 |
| 10 | 社区 | 9 | 完美主义者等级, 跨工具收集者 |
| 11 | 耐力 | 1 | 马拉松会话, 超长连胜 |

## 仪表盘

<p align="center">
  <em>统计行 → 连胜 + 热力图 → 展柜 → 成就网格（带搜索/筛选）</em>
</p>

```bash
agpa dashboard           # 默认 :3867
agpa dashboard 8080      # 自定义端口
agpa dashboard --profile work   # 使用特定配置启动
```

- **统计**：XP、等级、总成就数、连胜、任务数、工具使用次数
- **热力图**：GitHub 风格的 4 个月活动网格
- **展柜**：固定的最爱成就（最多 6 个）
- **成就网格**：搜索、按稀有度/类别排序、筛选已解锁/未解锁
- **音效开关**：8-bit 稀有度分级效果
- **分享按钮**：生成精美的双语卡片 → PNG 下载

## 架构

```
                    ┌─────────────────────────┐
                    │   引擎 (src/engine/)     │
                    │   track() / poll()      │
                    └─────────────────────────┘
                      ↗                    ↖
            MCP Server               Hook CLI
          (src/main.ts)           (src/cli/hook.ts)
                │                        │
          STDIO 长连接            短生命周期子进程
                │                  (stdin pipe)
                │                        │
          Agent 主动调用          Hook 自动触发
          有意识的行为              Agent 无感知
                │                        │
          ┌─────┴─────┐          ┌──────┴──────┐
          │ 手动追踪   │          │ 自动追踪    │
          │ image.read │          │ tool.complete│
          │ lang_used  │          │ file.edit   │
          │ plan.mode  │          │ session.*   │
          │ ...        │          │ agent.spawn │
          └───────────┘          └─────────────┘
                    ╲            ╱
                event.log  ← 两个通道都在此写入
                          │
                     engine.poll()
                          │
                     state.json
                          │
                     仪表盘
```

## 项目结构

```
src/
├── main.ts                  # MCP Server 入口 (STDIO)
├── tool-registry.ts         # 中心工具注册
├── cli/
│   ├── index.ts             # 统一 CLI 入口（27 个命令）
│   ├── hook.ts              # Hook CLI (track + poll + auto 模式)
│   ├── init.ts              # 交互式安装向导
│   ├── dashboard.ts         # 仪表盘启动器
│   ├── doctor.ts            # 系统诊断
│   └── ...                  # 22 个 CLI 命令
├── engine/
│   ├── engine.ts            # 核心引擎 (track / poll / stats)
│   ├── evaluator.ts         # 12 种条件类型求值器
│   ├── store.ts             # JSONL 事件日志 + 状态持久化
│   ├── types.ts             # TypeScript 接口
│   └── yaml-parser.ts       # YAML 成就定义解析器
├── dashboard/
│   ├── server.ts            # HTTP 服务器 + API 路由
│   ├── api.ts               # 卡片数据、统计聚合
│   ├── public/              # 零框架 HTML/CSS/JS 前端
│   └── customize-api.ts     # 自定义 API 端点
├── tools/                   # MCP 工具定义 (8 个工具)
├── utils/                   # 通知、验证、配置、像素画、电池等
├── verify/
│   └── auditor.ts           # 成就验证逻辑
├── config.ts                # 全局配置
└── helpers.ts               # 共享工具函数

pixel-art-output/            # Logo + 成就像素画
achievement-definitions.yaml   # 217 个成就定义（权威数据源）
scripts/                     # 开发工具（Logo 生成、像素画生成、音效）
```

## 开发

```bash
npm install          # 安装依赖 (5 个运行时依赖)
npm run build        # tsc --noEmit
npm test             # 1204 个测试, 46 个文件
npm run dashboard    # 启动开发仪表盘
npm run demo         # 生成 MVP 数据
```

## 依赖

- **运行时** (4): `@modelcontextprotocol/sdk` · `yaml` · `zod` · `figlet` · 
- **开发**: `typescript` · `vitest` · `tsx`
- **可选** (macOS): `terminal-notifier` — 系统解锁通知

> [!NOTE]
> **刻意保持精简。** 五个运行时依赖，零运行时网络调用。引擎是纯函数配合 JSONL 存储——易于审计，不可能出错。

## 📚 文档

| 文档 | 描述 |
|----------|-------------|
| [多工具配置](docs/multi-tool-setup.md) | 在 5 个支持的 Agent 工具中配置 AGPA |
| [成就设计](docs/design/01-成就分类体系.md) | 成就分类、命名规范与 YAML 字段参考 |
| [引擎架构](docs/design/05-核心引擎设计.md) | 事件流 → 条件评估 → 状态持久化 |
| [事件采集设计](docs/design/08-EventCapture落地设计.md) | 双通道采集：Hook CLI + MCP Server |
| [Steam 调研](docs/design/12-Steam游戏成就设计调研.md) | 21 款热门 Steam 游戏的成就系统调研 |
| [问题与待办](docs/issues-todo.md) | 已知 Bug、差距和 P0–P3 优先级 |
| [更新日志](CHANGELOG.md) | 版本历史与发布说明 |

## 🔒 安全与隐私

- **本地优先** — 所有事件数据保存在 `~/.agent-achievements/`。无遥测、无云同步、运行时无网络调用。
- **可审计** — 引擎是操作 JSONL 文件的纯 TypeScript 函数。无混淆、无二进制文件。
- **依赖精简** — 5 个运行时依赖 (`@modelcontextprotocol/sdk`, `yaml`, `zod`, `figlet`) — 全部经过广泛审计。
- **STDIO 隔离** — MCP 服务器仅通过标准 I/O 通信。不暴露 HTTP 端点。
- **Hook 沙箱** — Hook CLI 以亚毫秒级子进程运行 — 无法持久化状态或访问网络。
- **供应链安全** — 无原生模块、无 postinstall 脚本、安装时不下载任何二进制文件。

## 🌐 环境变量

| 变量 | 描述 | 默认值 | 可选值 |
|----------|-------------|---------|--------|
| `AGPA_PROFILE` | 当前使用的配置名称 | `default` | 任意字符串 |
| `AGPA_LANG` | 界面语言 | `en` | `en`, `zh` |
| `AGPA_ENABLED_CATEGORIES` | 筛选激活的成就类别 | 全部 | 逗号分隔（如 `onboarding,tool_mastery`） |
| `AGPA_DEBUG` | 启用详细调试日志 | `false` | `true` |
| `AGPA_SOUND` | 覆盖音效设置 | 配置中的值 | `on`, `off`, `true`, `false` |
| `AGPA_SIMPLE_ANIMATIONS` | 使用精简版终端动画 | `false` | `true` |
| `AGPA_BANNER_THEME` | CLI 启动横幅样式 | `Arcade` | `Neon`, `Arcade`, `Gold` |
| `AGPA_TELEMETRY` | 启用匿名使用遥测 | `false` | `true`, `false` |
| `AGPA_TELEMETRY_SERVER` | 自定义遥测端点 URL | `''` (无) | URL 字符串 |
| `AGPA_TOOL_SOURCE` | 覆盖工具来源标识 | 自动检测 | `claude-code`, `hermes`, `openclaw` 等 |
| `AGPA_MODEL` | 当前 AI 模型名称（用于成就判定） | `auto` | 任意模型字符串 |

> [!TIP]
> 环境变量会覆盖 `config.json` 的设置。在 Shell 配置或 Agent 配置中设置它们以持久化覆盖。

## 常见问题

**Q: 这会让我的 Agent 变慢吗？**
A: 不会。Hook CLI 是亚毫秒级的子进程。MCP 服务器在 STDIO 上运行，零网络开销。

**Q: 我可以配合多个 Agent 使用吗？**
A: 可以。安装向导会自动检测 Claude Code、Kilo Code、OpenCode、Hermes 和 OpenClaw。每个 Agent 可以有独立的配置。

**Q: 我的成就没有解锁？**
A: 运行 `agpa doctor`——它会诊断追踪状态、Hook 注册情况和事件覆盖。

**Q: 这和 WakaTime 或其他编码活动追踪器有什么区别？**
A: WakaTime 告诉你*做了*什么——时长、语言、项目。AGPA 让它变得*有趣*——经验值、等级、成就、连胜，以及 Steam 风格的多巴胺刺激。它是在你现有工作流之上的游戏化层，而不是另一个需要查看的仪表盘。就像健身追踪器的原始步数和 Pokémon Go 徽章的区别——同样的数据，不同的体验。

**Q: 我可以自定义成就名称吗？**
A: 可以。仪表盘中的 `/customize` 页面允许你重命名任何成就。

## 故障排除

> [!IMPORTANT]
> **遇到任何问题第一步：** 运行 `agpa doctor`——它能一次性诊断追踪状态、Hook 注册、事件覆盖和配置问题。

| 症状 | 可能原因 | 解决方法 |
|---------|-------------|-----|
| 成就无法解锁 | Hook/MCP 未注册 | 运行 `agpa doctor` 检查 Hook 注册 + 事件覆盖 |
| 仪表盘无法启动 | 端口 3867 被占用 | `agpa dashboard 8080`（或任何空闲端口） |
| `agpa init` 失败 | Agent 工具未检测到 | 检查支持的工具列表；使用手动 MCP JSON 配置作为备选 |
| 没有 macOS 通知 | `terminal-notifier` 缺失 | 运行 `brew install terminal-notifier`，或 `agpa init` 会自动安装 |
| 音效不播放 | 浏览器音频上下文被阻止 | 在仪表盘页面任意位置点击以启用音频 |
| 配置切换不工作 | 配置不存在 | `agpa profile list` 查看可用配置，然后 `agpa profile switch <name>` |
| Agent 日志中有 Hook CLI 错误 | stdin pipe 为空（首次运行正常） | 正常——Hook 是短生命周期子进程；错误记录在 `~/.agent-achievements/error.log` |

持续性问题请检查 `~/.agent-achievements/error.log` 或[提交 Issue](https://github.com/eiainano/AgentPlayerAchievements/issues)。

## Star 历史

<img alt="Star History Chart" src="https://api.star-history.com/svg?repos=eiainao/AgentPlayerAchievements&type=Date" width="100%">

## 许可

MIT — 详见 [LICENSE](LICENSE)

---

<p align="center">
  <sub>为热爱游戏化的开发者而建。217 个成就，持续更新中。</sub>
</p>
