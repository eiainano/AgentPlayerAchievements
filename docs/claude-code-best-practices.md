# Claude Code 小型项目开发最佳实践

> 调研来源：Claude Code 官方文档 (code.claude.com)、社区实践、Claude-Code-知识总结
> 最后更新：2026-05-20

---

## 1. 核心原则：一条铁律

**上下文窗口是最宝贵的资源。** 所有最佳实践都围绕这一约束展开——Claude 的性能会随上下文填满而下降，早期指令可能被"遗忘"。

---

## 2. CLAUDE.md — 一切的基础

### 2.1 生成与维护

运行 `/init` 让 Claude 自动分析项目结构和代码习惯，生成初始 `CLAUDE.md`，然后逐步完善。

```bash
cd your-project
claude
/init
```

### 2.2 放什么 vs 不放什么

| ✅ 放 | ❌ 不放 |
|------|--------|
| Claude 猜不到的构建/测试命令 | Claude 读代码就能推断出来的 |
| 与默认不同的代码风格规则 | 通用的语言规范（如"用 async/await"） |
| 架构决策（关键依赖、文件组织） | 频繁变化的信息（如 API keys） |
| 测试框架和测试指令 | 长篇幅的解释或教程 |
| 常见坑点和非直观行为 | 文件级别的代码描述 |
| 仓库约定（分支命名、PR 规范） | 显而易见的规则（如"写干净的代码"） |
| 开发环境 quirks（必须的 env vars） | 详细的 API 文档（链接即可） |

### 2.3 精简原则

对每条规则问自己：**"去掉这条 Claude 会犯错吗？"** 不会就删掉。控制在 200 行以内。如果 Claude 反复忽略某个规则，说明文件太长、规则被淹没了。

可以用强调词（如 `IMPORTANT`、`YOU MUST`）来提高依从性。

### 2.4 使用 @import 引用外部文件

CLAUDE.md 支持 import 语法引用其他文件：

```markdown
See @README.md for project overview and @package.json for available npm commands.

# Additional Instructions
- Git workflow: @docs/git-instructions.md
- Personal overrides: @~/.claude/my-project-instructions.md
```

### 2.5 分层位置

| 位置 | 作用域 | 用途 |
|---|---|---|
| `~/.claude/CLAUDE.md` | 全部项目 | 个人通用偏好（代码风格、工具链） |
| `./CLAUDE.md` | 当前项目（入版本控制） | 团队共享的规范和流程 |
| `./CLAUDE.local.md` | 当前项目（gitignore） | 个人项目偏好（sandbox URL、测试数据） |
| 父目录 CLAUDE.md | 子项目继承 | monorepo 共享规则 |
| 子目录 CLAUDE.md | 按需加载 | 子目录专属规则 |

### 2.6 进阶：`.claude/rules/`

将指令拆成多个主题文件，按目录/文件类型限定作用域：

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API 开发规则
- 所有端点必须包含输入校验
- 使用标准错误响应格式
```

---

## 3. 核心工作流

### 3.1 四阶段流程

| 阶段 | 模式 | 示例 Prompt |
|---|---|---|
| **探索** | plan mode | "读一下 src/auth 了解我们怎么做认证" |
| **规划** | plan mode | "我想加 Google OAuth，哪些文件要改？列个计划" |
| **实现** | 默认模式 | "按计划实现，写测试，跑测试确认" |
| **提交** | 默认模式 | "commit 并创建 PR" |

**什么时候跳过规划：** 单文件修改、修 typo、加日志、重命名——一句能说清楚的改动直接做。

### 3.2 先让 Claude 采访你

对于较大的 feature，先让 Claude 用 `AskUserQuestion` 收集需求：

```text
我想做一个[描述]。用 AskUserQuestion 工具详细采访我，涵盖技术实现、
UI/UX、边界情况、取舍。问完所有问题后写一份完整的 spec 到 SPEC.md。
```

输出完整的 spec 后，用新会话执行实现。干净的上下文 + 书面 spec = 最高效率。

### 3.3 Prompt 具体化

| 差 | 好 |
|---|---|
| "给 foo.py 加测试" | "写一个 foo.py 的测试覆盖登出用户的边界场景，不要用 mock，跑测试确认通过" |
| "修登录 bug" | "<粘贴错误>。检查 src/auth/ 的认证流程，特别关注 token 刷新。先写一个复现的失败测试，修好它" |
| "加日历 widget" | "参考主页现有 widget 的模式（HotDogWidget.php 是个好参考），实现一个新日历 widget，支持月份选择和前后翻页，不要引入额外依赖" |
| "不懂这个 API" | "查看 ExecutionFactory 的 git history，总结它的 API 为什么长这样" |

**高效 Prompt 四要素：**
1. **划定范围** — 指定文件、场景、测试偏好
2. **指向来源** — "@"引用相关文件或 gti history
3. **参考现有模式** — 指出代码库中已有的类似实现
4. **描述症状而非假设** — 提供错误信息、复现步骤，让 Claude 自己定位根因

### 3.4 善用 @ 引用

```text
解释 @src/utils/auth.js 的逻辑
@src/components 的结构是怎样的？
```

文件路径可以是相对路径或绝对路径。引用多个文件用多个 @。

### 3.5 使用图片提供上下文

将截图拖入或粘贴到对话中：
- 报错截图 → "这个错误是什么引起的？"
- UI 设计稿 → "生成匹配这个设计的 CSS"
- 数据库 schema 图 → "基于这个 schema 设计新 feature 的表结构"

---

## 4. 最高杠杆技巧：自我验证

> 官方文档称这是 **"the single highest-leverage thing"**——给 Claude 提供测试、截图、预期输出，让它能自己检查结果。

| 策略 | 之前 | 之后 |
|---|---|---|
| **提供验证标准** | "实现一个 email 验证函数" | "写一个 validateEmail。测试用例：user@example.com → true, invalid → false, user@.com → false。实现后跑测试" |
| **UI 视觉验证** | "让 dashboard 好看点" | "[截图] 实现这个设计。完成后截图对比，列出差异并修正" |
| **修根因而非压错误** | "build 失败了" | "build 报这个错：[粘贴]。修好它并验证 build 通过。找根因" |

**不能验证的结果就不要合入。**

---

## 5. 上下文管理

### 5.1 黄金法则

- **`/clear`** — 不同 task 之间清上下文
- **两次修正还不对 → `/clear` + 写更好的 prompt** — 失败尝试的历史只会让问题更难解决
- **不要"厨房水池会话"** — 做一半问不相关的问题再切回来，上下文全是垃圾
- **`/btw`** — 快速旁路提问，答案不进入会话历史，适合查小问题

### 5.2 Subagent 隔离

把调研类任务委托给 subagent：

```text
use subagents to investigate how our authentication system handles token refresh
```

Subagent 在独立上下文里读文件，只把结论报告回来，不污染主会话。

### 5.3 上下文压缩

- **自动压缩**：接近上下文限制时自动触发，保留关键代码和决策
- **`/compact <指令>`**：手动压缩，如 `/compact Focus on the API changes`
- **`/rewind` 选择 summarize**：从 checkpoint 往前或往后压缩

### 5.4 检查点（Checkpoints）

每次 prompt 发送时自动创建 checkpoint。双按 `Esc` 或 `/rewind` 打开恢复菜单：
- **回复一个 checkpoiont** — 回滚对话
- **仅恢复代码** — 回到修改前的文件状态
- **同时恢复** — 对话 + 代码回退
- **Summarize** — 压缩部分对话

Checkpoint 跨会话存在，关了终端还能回来 rewind。

### 5.5 会话管理

- `/rename` — 给会话起名（如 `oauth-migration`）
- `claude --continue` — 继续最近会话
- `claude --resume` — 从列表中选择会话恢复

把命名会话当分支用：每个工作流保持独立的持久上下文。

### 5.6 善用 undo 和 rewind

- `Esc` — 中途打断 Claude，上下文保留
- `Esc + Esc` 或 `/rewind` — 回滚到任意 checkpoint
- `/clear` — 彻底清空上下文
- "Undo that" — 让 Claude 自己撤销修改

---

## 6. 配置你的环境

### 6.1 权限管理

减少不必要的审批弹窗：

| 方式 | 说明 | 适用场景 |
|---|---|---|
| **Auto mode** | 自动分类器判断风险，阻止高危操作 | 明确、低风险的批量任务 |
| **`/permissions` allowlist** | 白名单特定命令 | 如 `npm run lint`、`git commit` |
| **Sandbox** | OS 级文件系统/网络隔离 | 不信任的任务 |

```bash
claude --permission-mode auto -p "fix all lint errors"
```

### 6.2 善用 CLI 工具

Claude 能直接使用 CLI 工具（`gh`、`aws`、`gcloud`、`sentry-cli`），这是与外部服务交互最高效的方式。

```text
用 gh CLI 查看 issue #123 的详情并创建 PR
```

### 6.3 连接 MCP 服务器

```bash
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub
```

让 Claude 直接查询数据库、读取 Notion/Figma/Slack 中的数据。

### 6.4 Hooks

把每次都必须执行的检查变成 hook，而非写在 CLAUDE.md 里：

```text
帮我加个 hook，每次文件编辑后自动格式化
帮我加个 hook，block 写入 migrations 文件夹
```

Hooks 是确定性的（advisory 的 CLAUDE.md 规则可能被忽略）。

### 6.5 自定义 Skills

把不常用的、有明确步骤的工作流封装成 Skill：

```markdown .claude/skills/deploy-staging/SKILL.md
---
name: deploy-staging
description: 部署到 staging 环境
disable-model-invocation: true
---
按步骤执行：1. 运行测试 2. 构建 3. 部署到 staging 4. 验证健康检查
```

调用：`/deploy-staging`

### 6.6 自定义 Subagents

定义专门化的助手，在独立上下文中处理特定任务：

```markdown .claude/agents/security-reviewer.md
---
name: security-reviewer
description: 审查代码安全漏洞
tools: Read, Bash
model: opus
---
你是一个资深安全工程师。审查代码中的注入漏洞、认证缺陷、凭据泄露等。
提供具体的行号引用和修复建议。
```

调用："用 security-reviewer 审查这段代码"

### 6.7 安装 Plugin

```text
/plugin     # 浏览插件市场
```

代码智能插件（Pyright、TypeScript LSP 等）提供符号导航和自动错误检测。

---

## 7. 能力扩展机制选择

### 7.1 对比总览

| 机制 | 触发方式 | 持久性 | 适用场景 |
|---|---|---|---|
| **CLAUDE.md** | 每次会话自动加载 | 跨会话 | 长期有效的项目规范 |
| **Rules** | 按路径匹配自动加载 | 跨会话 | 目录/文件级别的局部规则 |
| **Skills** | `/skill-name` 或自动匹配 | 文件系统 | 可复用的工作流 |
| **Hooks** | 事件触发 | 配置级 | 必须执行的动作（lint、格式化） |
| **MCP** | 按需查询 | 实时 | 外部系统集成（DB、Jira、Figma） |
| **Subagents** | 委托调用 | 独立上下文 | 隔离调研、独立审查 |
| **Plugins** | 一次性安装 | 组合能力 | 团队级打包分发 |
| **Auto memory** | 会话启动时 | 跨会话（前 200 行） | Claude 自己保存的学习笔记 |

### 7.2 选择原则

- **CLAUDE.md** → Claude 必须记住的全局规则
- **Rules** → 只对特定目录/文件类型生效的规则
- **Skills** → 不常用的、有步骤的流程
- **Hooks** → 零例外必须执行的检查
- **Subagents** → 需要读很多文件的调研
- **MCP** → 需要实时数据的外部系统

---

## 8. 自动化与规模化

### 8.1 非交互模式

用于 CI、pre-commit hooks、批量处理：

```bash
# 单次查询
claude -p "解释这个项目做什么"

# 结构化输出
claude -p "列出所有 API 端点" --output-format json

# 管道输入
cat error.log | claude -p "分析这些错误的根因"
tail -200 app.log | claude -p "发现异常就通知我"
```

### 8.2 Writer/Reviewer 模式

使用两个并行会话：

| 会话 A（写） | 会话 B（审） |
|---|---|
| "实现 API rate limiter" | |
| | "审查 @src/middleware/rateLimiter.ts，找边界情况和竞态条件" |
| "处理以上 review 反馈" | |

### 8.3 批量 Fan-Out

```bash
for file in $(cat files.txt); do
  claude -p "把 $file 从 React 迁移到 Vue。返回 OK 或 FAIL" \
    --allowedTools "Edit,Bash(git commit *)"
done
```

先试 2-3 个文件调优 prompt，再跑全量。

### 8.4 Worktree 并行会话

```bash
# 终端 1
claude --worktree feature-auth
# 终端 2
claude --worktree fix-bug
```

每个 worktree 是独立分支的独立 checkout，编辑互不干扰。

---

## 9. 常见失败模式

| 错误模式 | 表现 | 修复 |
|---|---|---|
| **厨房水池会话** | 一个会话堆多个无关 task | `/clear` 分割 |
| **重复修正** | 同一问题修正两次以上 | `/clear` + 更好的 prompt |
| **CLAUDE.md 太长** | Claude 忽略重要规则 | 精简到 200 行以内 |
| **信任不足验证** | 代码看起来对了但没处理边界 | 提供测试用例/验证方法 |
| **无限调研** | "调研一下"没有范围限制，填满上下文 | 限定范围或用 subagent |
| **过度指定 CLAUDE.md** | Claude 忽略了实际重要的规则 | 删掉不必须的规则，把必须的转成 hook |
| **不分割上下文** | 修复历史污染了当前 task | `/clear` 或用 `/btw` 问小问题 |

---

## 10. 小型项目推荐配置

```
your-project/
├── .claude/
│   ├── settings.local.json     # 本地设置（gitignore）
│   ├── rules/                  # 路径限定规则（可选）
│   └── skills/                 # 自定义 workflow（可选）
├── CLAUDE.md                   # 项目级指令
├── CLAUDE.local.md              # 个人偏好（gitignore）
├── vitest.config.ts            # 测试框架
├── tsconfig.json
├── package.json
└── src/
```

**快速上手三步：**

```bash
cd your-project
claude                              # 1. 启动
/init                               # 2. 生成 CLAUDE.md
"帮我加个 hook，每次文件编辑后自动格式化"  # 3. Claude 自己写 hook
```

### 成本控制建议

| 场景 | 推荐 |
|---|---|
| 日常开发 | 单会话 + 偶尔并行 |
| 复杂调研 | Subagent（用 Haiku 更快更便宜） |
| 批量任务 | 非交互模式 + auto mode |
| 并行开发 | 2-3 个会话：核心逻辑 / UI / 测试 |
| 代码审查 | 新会话或 Reviewer subagent |

---

## 11. AGPA 项目落地建议

结合当前项目状态，建议立即做：

- [ ] **CLAUDE.md 补充**：添加 "TypeScript strict mode（noUncheckedIndexedAccess），destructuring 后必须加 null guard"
- [ ] **添加 Hook**：`npm test` 后置 hook，改完代码自动跑测试
- [ ] **添加 Skill**：定义一个 skill 描述 `src/engine/` 各文件职责，方便快速理解架构
- [ ] **开发习惯**：每完成一个独立 feature 就 `/clear`
- [ ] **配置 auto mode**：对常规操作减少审批弹窗
- [ ] **使用 session 命名**：每个 feature 一个命名会话

---

*本文档整合自 Claude Code 官方文档 (code.claude.com)、社区最佳实践和实战经验。*
