# 第三轮调研报告：12 个 Claude Code 生态项目全方位分析

> 调研日期：2026-06-05
> 范围：6 个新项目 + 6 个已有项目深度重读
> 目标：为 AGPA 系统找出可借鉴的设计模式、数据采集策略、游戏化机制

---

## 1. 项目总览

共调研 12 个项目，按核心功能分为 4 类：

### 1.1 统计 / 使用分析类（5 个）

| 项目 | 定位 | 数据源 | 存储 | UI |
|------|------|--------|------|-----|
| **cc-lens** | 本地分析仪表板 | 直接读取 `~/.claude/` 文件 | 无（纯读取） | Next.js Web |
| **claude-code-history-viewer** | 跨工具历史浏览器 | 9 种工具本地文件 | 无（纯读取） | Tauri 桌面 + Web |
| **claude-code-wakatime** | WakaTime 时间追踪插件 | CC Hook stdin | WakaTime 云端 | WakaTime.com |
| **bashstats** | 全能统计 + 成就系统 | 12 个 CC Hook | SQLite | Express Web |
| **VibeDashboard** | GitHub README SVG 卡片 | ccusage JSON（外部工具） | Git 仓库 | SVG + Markdown |

### 1.2 成就 / 进度 / 游戏化类（4 个）

| 项目 | 定位 | 成就数 | 数据源 | 核心机制 |
|------|------|--------|--------|---------|
| **subinium/claude-code-achievements** | Steam 风格成就 | 29 个 | 3 个 CC Hook | 一次性解锁 |
| **level-up-mcp-server** | 协作开发游戏化 | 54 个 | 75 个 MCP Tool | 经验值 × 难度 × 乘数 |
| **@levelup-log/mcp-server** | 日常生活游戏化 | 15 类 | 4 个 MCP Tool | 等级 = 年龄 |
| **aickathon-2025-08-codex-mcp** | 任务 RPG 化 | 无固定 | 8 个 MCP Tool | 对话式任务 |

### 1.3 熟练度 / 段位类（2 个）

| 项目 | 定位 | 核心机制 | 数据源 |
|------|------|---------|--------|
| **OriNachum/claude-code-guide** | 技能段位 + 斐波那契引导 | sqrt(count×multiplier) 评分，16 类特征，段位带 | 3 个 CC Hook |
| **cc-proficiency** | 熟练度 SVG 徽章 | 55 条规则 × 5 领域，桶上限，相位加权 | Stop Hook + JSONL 解析 |

### 1.4 任务管理类（1 个）

| 项目 | 定位 | 核心机制 | 数据源 |
|------|------|---------|--------|
| **gked2121/claude-quest** | RPG 风格项目管理 | 关卡/经验值/地标建筑/主题皮肤 | 5 个 CC Hook + 自动同步 |

---

## 2. 各项目深度分析

### 2.1 cc-lens ⭐⭐⭐⭐⭐ (最相关 — 数据分析)

**核心能力：** 零依赖本地 Web 仪表板，`npx cc-lens` 一键启动。

**数据结构亮点：**
```typescript
// 从 JSONL 逐行解析的 Session 结构
interface ParsedSession {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalCost: number;
  toolCount: number;
  userMessageCount: number;      // ← 精确解析每个 user message！
  assistantMessageCount: number;
  thinkingCount: number;
  compactionCount: number;
  modelDistribution: Record<string, number>;
  duration: number;
  projectName: string;
  gitBranch: string;
  ccVersion: string;
}
```

**关键设计：**
- **mtime-keyed 缓存**：已完成的 JSONL 按 (filepath, mtime) 缓存，避免重复解析
- **双数据源优先级**：优先解析 JSONL（精确），回退 `stats-cache.json`（快速）
- **并行文件读取**：所有项目 JSONL 并行解析
- **Token 成本计算**：per-model 定价表（opus/sonnet/haiku），用户可覆盖 `~/.cc-lens/pricing.json`
- **SWR 5 秒轮询**：Dashboard 自动刷新

**AGPA 可借鉴：**
1. **用户消息计数的精确解析法** — 直接解析 JSONL 中 `message.role === 'user'` 的条目
2. **双源 fallback 模式** — 精确 JSONL vs 快速 stats-cache 的双轨策略
3. **mtime 缓存** — 避免重复解析的轻量方案

---

### 2.2 bashstats ⭐⭐⭐⭐⭐ (最相关 — 全能统计+成就)

**规模：** 124 个 badge、500 个 rank、12 个 CC Hook 全覆盖

**Hook 事件覆盖（全部 12 个）：**
```
SessionStart, UserPromptSubmit, PreToolUse, PostToolUse,
PostToolUseFailure, Stop, Notification, SubagentStart,
SubagentStop, PreCompact, PermissionRequest, Setup
```

**SQLite 表结构（核心）：**
```sql
events: session_id, hook_type, tool_name, tool_input, tool_output,
        exit_code, success, cwd, project, timestamp

sessions: session_id, project, agent_type, started_at, ended_at,
          duration_seconds, total_cost, prompt_tokens, completion_tokens

prompts: id, session_id, prompt_text, character_count, word_count, timestamp

daily_activity: date, project, session_count, tool_calls, total_tokens,
                unique_tools, unique_mcps

achievement_unlocks: badge_id, tier, unlocked_at

weekly_goals: week_start, stat_name, target, current, is_completed
```

**XP 公式：**
```typescript
cumXP(N) = floor(10 * N^2.2)  // 500 级需要约 28,000 XP
rankTier(xp):
  < 100 → Bronze
  < 500 → Silver
  < 2000 → Gold
  < 8000 → Diamond
  < 30000 → Obsidian
  30000+ → System Anomaly
```

**badge 的层级设计：**
每个 badge 有 5 个 tier（Bronze → System Anomaly），阈值指数分布：
```typescript
generateTiers(base, exponent): // tier[n] = base * exponent^n
```

**AGPA 可借鉴：**
1. **UserPromptSubmit Hook** — 唯一能精确捕获用户消息文本和字数的 hook
2. **会话级聚合表** — `daily_activity` 预聚合表避免每次扫描全量事件
3. **Tiered badge 设计** — 不是 1 个成就 = 1 次解锁，而是 5 个 tier 的渐进式成就
4. **Weekly goals 系统** — 每周自动生成目标，activity multiplier（1.0x-2.0x）
5. **SQLite 方案** — 比纯 JSON 更适合高频写入和聚合查询

---

### 2.3 cc-proficiency ⭐⭐⭐⭐⭐ (架构最精巧)

**规则引擎架构（55 条规则 × 5 领域）：**
```
Transcript JSONL + Config Files
    ↓
signals.ts: 提取信号（tool calls, feature usage, patterns）
    ↓
rules.ts: 55 条 ScoringRule，每条 { domain, tier, points, maxPerSession, detect() }
    ↓
rule-engine.ts: 发射规则 → 聚合到桶 → 上限裁剪
    ↓
engine.ts: 计算总分 + feature inventory → 生成 SVG 徽章
```

**5 领域桶 + 上限：**
| 领域 | 配置分上限 | 行为分上限 | 罚分 |
|------|----------|----------|------|
| CC Mastery | 25 | 75 | -15 |
| Tool & MCP | 25 | 75 | -15 |
| Agentic | 25 | 75 | -15 |
| Prompt Craft | 25 | 75 | -15 |
| Context Mgmt | 25 | 75 | -15 |

**相位感知加权：**
```typescript
CALIBRATING (0-2 sessions): config × 2.0, behavior × 0.8
EARLY (3-9 sessions):       config × 1.5, behavior × 1.0
FULL (10+ sessions):        config × 1.0, behavior × 1.15
```

**反刷分措施：**
- 每条规则 `maxPerSession: number` — 单 session 最多触发 N 次
- 桶上限裁剪 — 不可能无限堆分
- 反模式检测 — 坏习惯扣分（shotgun 并行调用、wall of text）

**AGPA 可借鉴：**
1. **规则引擎模式** — 纯函数的 `ScoringRule` 是最优雅的成就检测单元
2. **桶上限机制** — 防止刷分，每个领域有最大分数上限
3. **相位加权** — 新手期 vs 成熟期的不同评分标准
4. **config 证据 vs behavior 证据** — 二分类，权重不同
5. **队列异步处理** — Stop hook → queue.jsonl → batch process，解耦采集和计算

---

### 2.4 claude-code-history-viewer ⭐⭐⭐

**9 工具 Provider 抽象模式：**
```rust
trait Provider {
    fn load_sessions(&self) -> Vec<Session>;
    fn fetch_recent_files(&self) -> Vec<FileEdit>;
    fn watch_changes(&self, sender: Sender);
}
// 实现: claude.rs, codex.rs, opencode.rs, aider.rs, cline.rs,
//        cursor.rs, gemini.rs, antigravity.rs, forgecode.rs
```

**CC JSONL 精确结构：**
```json
{
  "uuid": "...", "parentUuid": "...", "sessionId": "...",
  "timestamp": "ISO8601",
  "type": "user" | "assistant" | "system" | "summary",
  "message": {
    "role": "user" | "assistant",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "name": "Read", "input": {...} },
      { "type": "tool_result", "content": [...] },
      { "type": "thinking", "thinking": "..." }
    ]
  },
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 567,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  }
}
```

**AGPA 可借鉴：**
1. 多工具 provider 抽象 — 将所有 Agent 工具归一化到统一接口
2. JSONL 中 `type: "user"` 精确标识用户消息 — 最权威的用户消息来源

---

### 2.5 claude-code-guide ⭐⭐⭐⭐

**评分公式：**
```typescript
score = sqrt(SUM(feature_count * tier_multiplier))
// tier_multiplier: beginner ×1, intermediate ×10, expert ×100
```

**5 等级系统：**
| Level | 分数门槛 | 最少 feature 数 |
|-------|---------|---------------|
| Novice | 0 | 0 |
| Apprentice | ≥ 5.00 | 3 |
| Practitioner | ≥ 15.00 | 5 |
| Expert | ≥ 30.00 | 8 |
| Master | ≥ 55.00 | 10 |

**段位带（每个 feature 独立）：**
```
White (0-15) → Yellow (16-31) → Orange (32-63) → Green (64-127)
→ Blue (128-255) → Brown (256-511) → Black (512+)
```

**斐波那契触发（第 1, 2, 3, 5, 8, 13, 21... 个 session 时给建议）：**
一个优雅的 nudging 机制——在关键 session 节点提示用户尝试新功能。

**AGPA 可借鉴：**
1. **sqrt 凹函数评分** — 防止线性增长导致分数通胀
2. **段位带** — 无限进度，不是一次解锁就结束
3. **斐波那契 nudge** — 关键节点触发特殊事件/成就
4. **feature 依赖图** — 某些成就需要先解锁前置成就

---

### 2.6 subinium/claude-code-achievements ⭐⭐⭐

**29 个成就，4 类：**
- 入门（7 个）：first_message, first_tool_call, first_file_edit 等
- 工作流（8 个）：git_commit_first, task_complete_first 等
- 高级工具（8 个）：first_mcp, first_agent, first_web_search 等
- 精通（6 个）：ralph_master, power_user 等

**纯 shell 实现（零运行时依赖）：**
```
hooks.json → track-achievement.sh (PostToolUse)
           → track-stop.sh (Stop)
state.json ← 成就 + 计数器
show-achievements.sh ← 仪表板渲染
```

**AGPA 可借鉴：**
1. "首次使用 X" 是最简单有效的成就类型
2. 零依赖 shell 方案 — 极致轻量
3. 但缺乏计数器聚合、段位、统计 — 这正是 AGPA 要补齐的

---

### 2.7 level-up-mcp-server ⭐⭐⭐

**经验值公式（最复杂）：**
```
totalXP = baseXP × difficulty(1-7) × outputType(1.0-2.5x) × completion%
        + speedBonus + streakBonus + firstTimeBonus + qualityBonus
```

**54 个成就，8 个类别：**
- 入门、代码、协作、工具、学习、社区、挑战、隐藏

**75 个 MCP 工具**（过于庞大，适合 Supabase 后端的企业级方案）

**AGPA 可借鉴：**
1. 分层的经验值乘数系统（难度 × 输出类型 × 完成度）
2. 8 类别成就体系可作为 AGPA 10 类的参考

---

### 2.8 其他 4 个项目速览

| 项目 | 一句话 | AGPA 启发 |
|------|--------|----------|
| **claude-code-wakatime** | 60s 心跳 + WakaTime CLI 桥接 | subagent 路径解析法 |
| **VibeDashboard** | ccusage JSON → GitHub Actions → SVG 卡片 | 多机器数据合并逻辑 |
| **claude-quest** | RPG 主题任务管理 + 自动同步 | 会话 PID 标识法 |
| **@levelup-log** | 年龄 = 等级的游戏化 | 类别 × 稀有度框架 |
| **codex-mcp** | 对话式任务分解 + 叙事者角色 | 叙事者角色/主题切换 |

---

## 3. 跨项目模式总结

### 3.1 数据采集策略对比

```
                   Hook 驱动             文件解析            MCP Track
                   ─────────            ────────            ────────
bashstats          ✅ 12 hooks          -                   ✅ MCP server
cc-proficiency     ✅ Stop hook         ✅ JSONL 解析        -
claude-code-guide  ✅ 3 hooks           -                   -
CCA                ✅ 3 hooks           -                   -
cc-lens            -                    ✅ JSONL + stats     -
history-viewer     -                    ✅ 10 格式解析       -
WakaTime           ✅ 全 hooks          -                   -
claude-quest       ✅ 5 hooks           ✅ plan 文件解析     -
VibeDashboard      -                    间接（ccusage）      -
level-up-mcp       -                    -                   ✅ 75 MCP tools
AGPA 当前          ✅ 9 hooks           -                   ✅ 5 MCP tools
```

**AGPA 启示：** 我们已有双通道（Hook + MCP），但缺少第 3 种——**JSONL 文件解析**。
JSONL 精确包含 user message 计数、token 用量、模型分布，是统计数据的最佳来源。

### 3.2 游戏化机制对比

| 机制 | 项目 | AGPA 当前状态 |
|------|------|-------------|
| 一次性成就（"首次 X"） | CCA, bashstats | ✅ 已实现（160 个） |
| Tiered 成就（铜→银→金→…） | bashstats (5 tiers) | ❌ 未实现 |
| 段位/段位带 | guide (7 belts) | ❌ 未实现 |
| Rank/Level | bashstats (500 ranks), guide (5 levels) | ✅ 部分（Level 环） |
| XP 系统 | bashstats, level-up, claude-quest | ✅ 部分（Achievement XP） |
| 套装 (Set) | CCA, bashstats | ✅ 已实现（10 套） |
| 反模式/罚分 | cc-proficiency | ❌ 未实现 |
| 斐波那契 nudge | guide | ❌ 未实现 |
| Weekly goals | bashstats | ❌ 未实现 |

### 3.3 技术架构模式

| 模式 | 代表项目 | 适用场景 |
|------|---------|---------|
| **Hook → Queue → Batch** | cc-proficiency | 高频写入，异步处理 |
| **mtime 缓存** | cc-lens, history-viewer | 避免重复解析大文件 |
| **双源 fallback** | cc-lens (JSONL → stats-cache) | 精度 vs 速度的平衡 |
| **Provider 抽象** | history-viewer | 多工具归一化 |
| **纯函数规则引擎** | cc-proficiency | 可测试的检测逻辑 |
| **日聚合表** | bashstats | 加速 Dashboard 查询 |

---

## 4. AGPA 应该怎么做：10 项具体建议

### 建议 1：增加 JSONL 解析作为第 3 数据源 🔴 高优先级

**动机：** JSONL 是唯一能精确获取 user message 计数、token 用量、模型分布的来源。
当前 AGPA 的 `user.message` MCP track 依赖 Agent 自觉，不可靠。

**方案：** 在 `Stop` hook 或 `poll()` 时，解析当前 session 的 JSONL 文件：
```
~/.claude/projects/<project-slug>/<session-id>.jsonl
```
从中提取：
- user message 数量（`type: "user"` 的行数）
- assistant message 数量
- total tokens（所有 `usage` 对象求和）
- session 精确 duration（首行→末行 timestamp 差值）
- model 分布

**参考：** cc-lens 的 `parseSessionFile()` 函数 + history-viewer 的 `claude.rs` provider

### 建议 2：实现 Tiered 成就（铜→银→金→钻→星）🟡 中优先级

当前 160 个成就全是一次性解锁。bashstats 的 124 个 badge × 5 tier = 620 个解锁点提供了更强的持续激励。

**方案：** 对可计数的成就添加 `tiers` 字段：
```yaml
- id: tool_master_read
  tiers:
    - value: 100   rarity: common    name: 阅读新手
    - value: 500   rarity: uncommon  name: 阅读熟手
    - value: 2000  rarity: rare      name: 阅读专家
    - value: 5000  rarity: epic      name: 阅读大师
    - value: 10000 rarity: legendary name: 阅读之神
```

### 建议 3：实现日聚合缓存表 🟡 中优先级

当前每次 poll() 全量扫描 event.log。随着事件增长到 5000+、10000+，性能下降。

**方案：** 参考 bashstats 的 `daily_activity` 表，在 `stats.json` 中添加日聚合：
```json
{
  "daily": {
    "2026-06-03": { "sessions": 3, "tools": 45, "user_msgs": 28, "tokens": 150000 },
    "2026-06-04": { "sessions": 2, "tools": 32, "user_msgs": 18, "tokens": 90000 }
  }
}
```
增量更新，只计算新日期的数据。

### 建议 4：引入 sqrt 凹函数评分 🟡 中优先级

当前 XP = 成就稀有度固定值。但 guide 的 `sqrt(count × multiplier)` 提供了更平滑的进度曲线。

**方案：** 为 Level 系统添加 usage XP（与 achievement XP 并行）：
```typescript
usageXP = sqrt(totalToolCalls * 1 + totalSessions * 10 + totalUserMessages * 5)
totalLevel = calcLevel(achievementXP + usageXP)
```

### 建议 5：斐波那契 nudge 引导 🟢 低优先级

在用户的第 1、2、3、5、8、13、21… 个 session 时，系统给出特定提示。参考 guide 的 `track-stop.sh` 斐波那契触发。

**方案：** `poll()` 返回时附带 tips，按 session 计数决定：
```typescript
if (fibonacciNumbers.includes(sessionCount)) {
  tips.push(getNudgeForSession(sessionCount));
}
```

### 建议 6：规则引擎重构成就检测 🟢 低优先级

cc-proficiency 的 `ScoringRule` 模式是成就检测的终极形态——纯函数、可组合、可测试。

**方案：** 将来重构 evaluator，将每个 condition type 封装为独立的 `Rule`：
```typescript
interface AchievementRule {
  id: string;
  domain: string;
  tier: number;
  points: number;
  detect(events: TrackedEvent[], state: AchievementState): number; // returns progress 0.0-1.0
}
```

### 建议 7：补充 UserPromptSubmit Hook 🟡 中优先级

bashstats 和 guide 都订阅了 `UserPromptSubmit`，这是唯一能获取用户消息内容的 hook。

**方案：** 在 `init.ts` 中为 CC 添加 `UserPromptSubmit` hook，采集：
- 消息字数
- 消息内容 hash（隐私保护，不存原文）
- 发送时间戳

### 建议 8：反刷分机制 🟢 低优先级

cc-proficiency 的反刷分措施（maxPerSession、桶上限、反模式罚分）保证了系统的公平性。

**方案：** 为关键成就添加 `max_per_session` 字段，防止在单 session 内刷成就。

### 建议 9：日活跃热力图 🔴 已实现

bashstats 和 cc-lens 都有 GitHub 风格的热力图。AGPA 已在 Dashboard 中实现了 activity heatmap + streak 卡片。

✅ 无需额外开发。

### 建议 10：多工具数据归并 🟢 低优先级

VibeDashboard 的多机器/多源 JSON 合并逻辑对 AGPA 的多 profile 系统有参考价值。
history-viewer 的 provider 抽象是最优雅的多工具归一化方案。

---

## 5. 优先级排序

| 优先级 | 建议 | 工作量 | 收益 | 参考项目 |
|--------|------|--------|------|---------|
| 🔴 P0 | JSONL 解析补充统计数据 | 中 | 极高 | cc-lens, history-viewer |
| 🟡 P1 | Tiered 成就体系 | 大 | 高 | bashstats |
| 🟡 P1 | 日聚合缓存表 | 中 | 高 | bashstats |
| 🟡 P1 | UserPromptSubmit hook | 小 | 高 | bashstats, guide |
| 🟡 P1 | sqrt 凹函数评分 | 小 | 中 | guide |
| 🟢 P2 | 斐波那契 nudge | 小 | 中 | guide |
| 🟢 P2 | 规则引擎重构 | 大 | 高（长期） | cc-proficiency |
| 🟢 P2 | 反刷分机制 | 小 | 中 | cc-proficiency |
| 🟢 P2 | 多工具数据归并 | 中 | 中 | history-viewer, VibeDashboard |

---

## 6. 研究仓库清单

已下载至 `research/` 目录：

| 目录 | 来源 | 状态 |
|------|------|------|
| `research/cca/` | subinium/claude-code-achievements | 已有（重读） |
| `research/claude-code-guide/` | OriNachum/claude-code-guide | 已有（重读） |
| `research/claude-code-quest/` | gked2121/claude-quest | 已有（重读） |
| `research/buddy-evolution/` | buddy-evolution | 已有 |
| `research/sc2-claude-hooks/` | sc2-claude-hooks | 已有 |
| `research/claude-code-history-viewer/` | jhlee0409/claude-code-history-viewer | 🆕 新下载 |
| `research/cc-lens/` | Arindam200/cc-lens | 🆕 新下载 |
| `research/claude-code-wakatime/` | wakatime/claude-code-wakatime | 🆕 新下载 |
| `research/bashstats/` | GhostPeony/bashstats | 🆕 新下载 |
| `research/VibeDashboard/` | mjyoo2/VibeDashboard | 🆕 新下载 |
| `research/cc-proficiency/` | Z-M-Huang/cc-proficiency | 🆕 新下载 |

非 GitHub 资源（Web 调研）：
- level-up-mcp-server (npm) — 75 MCP tools, Supabase
- @levelup-log/mcp-server (LobeHub) — 年龄 = 等级
- aickathon-2025-08-codex-mcp (LobeHub) — 叙事者 RPG 任务

---

## 7. 结论

12 个项目的调研揭示了一个清晰的生态全景：

- **统计层**（cc-lens, history-viewer, bashstats）— JSONL 文件解析 + 日聚合是标准做法
- **成就层**（CCA, bashstats, level-up）— 一次性解锁 + 层级进展是主流范式
- **进度层**（guide, cc-proficiency, claude-quest）— 段位、经验值、相位加权提升参与度

AGPA 当前在**成就层**最完善（160 个定义、11 种条件类型），在**统计层**刚起步（user.message + stats.json），在**进度层**有基础（XP + Level 环）。

**下一步最优路径：** 补充 JSONL 解析 → 实现日聚合 → 扩展 tiered 成就 → 引入 usage XP。这与我们当前架构完全兼容，每一步都能渐进交付。
