# AGPA 多工具兼容配置指南

AGPA 基于 MCP (Model Context Protocol) 标准协议，计划支持 5 个 AI 编程工具：Claude Code、Kilo Code、Hermes Agent、OpenCode、OpenClaw。

## 工具总览

| 工具 | 开发者 | MCP 支持 | 指令文件 | 采集评级 | 自动 Track |
|---|---|---|---|---|---|
| **Claude Code** | Anthropic | ✅ stdio | `CLAUDE.md` > `AGENTS.md` | ⭐⭐⭐⭐⭐ | ✅ Hook 全自动 |
| **Kilo Code** | Kilo Org | ✅ stdio/HTTP | `AGENTS.md` > `CLAUDE.md` | ⭐⭐⭐⭐ | ✅ TS 插件 auto-track |
| **Hermes Agent** | Nous Research | ✅ stdio/HTTP | `.hermes.md` > `AGENTS.md` > `CLAUDE.md` | ⭐⭐⭐⭐ | ✅ `on_session_end` |
| **OpenCode** | Anomaly Co | ✅ stdio/HTTP | `AGENTS.md` > `CLAUDE.md` | ⭐⭐⭐⭐ | ✅ TS 插件 auto-track |
| **OpenClaw** | Peter Steinberger | ✅ stdio/SSE/HTTP | `AGENTS.md` > `SOUL.md` | ⭐⭐⭐⭐⭐ | ✅ TS 插件 auto-track |

---

## 一、各工具 MCP 配置

### Claude Code

配置文件：`~/.claude/settings.json` 或项目 `.mcp.json`

```json
{
  "mcpServers": {
    "agpa": {
      "command": "tsx",
      "args": ["/path/to/agpa/src/main.ts"],
      "env": { "AGPA_LANG": "zh" }
    }
  }
}
```

### Kilo Code

配置文件：`~/.config/kilo/config.jsonc` 或项目 `kilo.jsonc`

```jsonc
{
  "mcp": {
    "agpa": {
      "type": "local",
      "command": ["tsx", "/path/to/agpa/src/main.ts"],
      "environment": { "AGPA_LANG": "zh" },
      "enabled": true
    }
  }
}
```

### Hermes Agent

配置文件：`~/.hermes/config.yaml`（注意是 YAML）

```yaml
mcp_servers:
  agpa:
    command: "tsx"
    args: ["/path/to/agpa/src/main.ts"]
    env:
      AGPA_LANG: "zh"
    enabled: true
    timeout: 120
```

CLI 重载：`/reload-mcp`

### OpenCode

配置文件：`~/.config/opencode/opencode.json` 或项目 `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agpa": {
      "type": "local",
      "command": ["tsx", "/path/to/agpa/src/main.ts"],
      "environment": { "AGPA_LANG": "zh" },
      "enabled": true
    }
  }
}
```

### OpenClaw

配置文件：`~/.openclaw/openclaw.json`

```json
{
  "mcp": {
    "servers": {
      "agpa": {
        "command": "tsx",
        "args": ["/path/to/agpa/src/main.ts"],
        "env": { "AGPA_LANG": "zh" }
      }
    }
  }
}
```

---

## 二、指令文件兼容矩阵

各工具读取项目指令文件的优先级：

| 工具 | 第一优先 | 第二优先 | 第三优先 | 全局文件 |
|---|---|---|---|---|
| Claude Code | `CLAUDE.md` | `AGENTS.md` | — | `~/.claude/CLAUDE.md` |
| Kilo Code | `AGENTS.md` | `CLAUDE.md` | `CONTEXT.md` | `~/.config/kilo/AGENTS.md` |
| Hermes Agent | `.hermes.md` | `AGENTS.md` | `CLAUDE.md` | `~/.hermes/SOUL.md` |
| OpenCode | `AGENTS.md` | `CLAUDE.md` | — | `~/.config/opencode/AGENTS.md` |
| OpenClaw | `AGENTS.md` | `SOUL.md` | `TOOLS.md` | `~/.openclaw/workspace/` |

**结论**：`AGENTS.md` 是最大公约数——5 个工具中有 4 个将其作为首选或次选。Claude Code 优先读 `CLAUDE.md`，但也识别 `AGENTS.md`。建议项目同时提供两个文件。

### 推荐的 AGENTS.md 内容

```markdown
# AGPA Achievement System

本项目使用 AGPA（Agent Player Achievements）将 AI 编程过程游戏化。

## 会话工作流

**每次会话结束时**，务必调用：
1. `achievement_track` 记录 `"session.end"` 事件
2. `achievement_poll` 检查是否有新成就解锁
3. 如有新成就，展示给用户

**会话过程中**，适时调用 `achievement_track` 记录：
- `"task.complete"` — 完成子任务
- `"tool.complete"` 附带 `{ tool_name }` — 重要工具调用
- `"conversation.message"` — 对话轮次（可选，可批量）

**查看进度**：调用 `achievement_stats` 查看当前成就状态。
```

---

## 三、自动 Track 策略

### Claude Code（全自动 ✅）

通过 SessionStart/UserPromptSubmit/Stop/PostToolUse 等 10 个 Hook 实现全自动事件采集。在 `~/.claude/settings.json` 中注入 agpa hook.ts 命令，agent 每次工具调用、任务完成、会话结束等均自动 track。

**可靠性：⭐⭐⭐⭐⭐**

### Hermes Agent（全自动 ✅）

Hermes 拥有 `on_session_end` hook，这是 5 个工具中除 Claude Code 外唯一真正支持"会话结束"事件的。通过在 `config.yaml` 配置 shell hook，或编写 Python 插件调用 MCP tool：

```yaml
# ~/.hermes/config.yaml
hooks:
  on_session_end:
    - type: shell
      command: "tsx /path/to/agpa/scripts/auto-track.ts"
```

```python
# ~/.hermes/plugins/agpa_track.py
def register(ctx):
    ctx.register_hook("on_session_end", lambda session:
        ctx.mcp.call("agpa", "achievement_track", {"event": "session.end"})
    )
```

**可靠性：⭐⭐⭐⭐**

### OpenCode（半自动 ⚠️）

无 `session.end` hook，可用 `session.idle` 事件近似。编写 JS 插件：

```javascript
// ~/.config/opencode/plugins/agpa-auto-track.js
export default {
  name: "agpa-auto-track",
  events: {
    "session.idle": async (ctx) => {
      await ctx.mcp.call("agpa", "achievement_track", { event: "session.end" });
      const result = await ctx.mcp.call("agpa", "achievement_poll", {});
      if (result.length > 0) {
        await ctx.shell.run("osascript -e 'display notification \"Achievement unlocked!\"'");
      }
    }
  }
};
```

**可靠性：⭐⭐⭐** — `session.idle` 非精确 end 事件，可能在会话中途误触发。

### OpenClaw

无 `session.end` hook，但 `command:new` 在新会话开始时触发。编写 TypeScript hook handler：

```typescript
// ~/.openclaw/hooks/agpa-track/handler.ts
export default async function(ctx) {
  if (ctx.event === "command:new") {
    await ctx.mcp.call("agpa", "achievement_track", { event: "session.end" });
    await ctx.mcp.call("agpa", "achievement_poll", {});
  }
}
```

**可靠性：⭐⭐⭐⭐** — 触发时机可靠（新会话开始 = 上一会话结束），但每次新会话会多一次调用。

### Kilo Code（手动 ⚠️）

KiloCode 的 hook 无法调用 MCP tool（已知限制 [Kilo-Org/kilocode#9138](https://github.com/Kilo-Org/kilocode/issues/9138)）。只能依赖 `AGENTS.md` 指令让 agent 主动调用，或用户手动触发。

**可靠性：⭐⭐⭐**

---

## 四、Dashboard

所有工具共用同一 Dashboard：

```bash
npm run dashboard          # http://localhost:3867
npm run dashboard -- 8080  # 自定义端口
```

---

## 五、MCP Tools

| Tool | 功能 |
|---|---|
| `achievement_track` | 记录事件（session.end, task.complete 等） |
| `achievement_poll` | 触发成就评估，返回新解锁的成就 |
| `achievement_stats` | 查看统计（等级、XP、完成率） |
| `achievement_showcase` | 管理展示柜 |
| `achievement_config` | 读写配置（语言等） |
| `achievement_suggest` | 推荐成就（Near Win / Discovery / Surprise） |

## 六、跨工具成就

AGPA 支持记录 `tool_source` 字段区分事件来源。`cross_agent` 成就要求在不同工具上都有记录，鼓励多工具使用。

`tool_source` 通过 `AGPA_TOOL_SOURCE` 环境变量注入，支持 claude-code / hermes / kilocode / opencode / openclaw 全部 5 个工具。

## 七、环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `AGPA_LANG` | `en` | 界面语言，`zh` 为中文 |
| `AGPA_DATA_DIR` | `~/.agent-achievements` | 数据存储目录 |
