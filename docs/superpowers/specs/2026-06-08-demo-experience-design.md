# Demo Experience — 新手引导式演示功能

**日期**: 2026-06-08  
**状态**: 设计完成  
**版本**: 0.1.8

## 目标

给新用户一个"看到 AGPA 能做什么"的体验入口——CLI 和 Dashboard 双通道，模拟一天使用历史，解锁 5 个入门成就，带可选的交互式产品导览。

## 核心原则

1. **数据完全隔离** — `_demo` profile，不影响任何用户 profile
2. **一键体验** — `agpa demo` → 终端输出 → 自动打开浏览器
3. **可选深度** — Dashboard 有引导 banner，"带我逛逛"按钮可选
4. **不引入新依赖** — 纯 JS/CSS 实现产品导览

## 架构

```
agpa demo (CLI, 修改 src/cli/demo.ts + index.ts)
  │
  ├── 1. 创建/重置 _demo profile
  ├── 2. 写入 55 事件 × 3 sessions（伪造时间戳）
  ├── 3. engine.poll() → 解锁 5 个成就
  ├── 4. 终端彩色输出（成就弹窗 + 统计总结）
  └── 5. spawn agpa dashboard --profile _demo
            │
            ▼
        Dashboard (demo 模式, 修改 public/index.html + app.js + styles.css)
          ├── 导航栏紫色 "🔬 Demo 数据" 标签 + "切换到真实数据 →"
          ├── 顶部引导 Banner "🎮 这是你的 Demo 体验数据"
          ├── [👀 带我逛逛] 4 步导览 (纯 JS/CSS 实现)
          └── 已解锁成就卡片金色闪光动画
```

## Demo 事件脚本

3 个 session，55 个事件，时间戳从当天 `TODAY 09:00` → `TODAY 21:00`，每次递增 5-15 分钟随机间隔。

### Session 1（上午开发，09:00-10:15，~17 事件）

```
session.start
conversation.message ×3
tool.complete(Read) ×2, (Grep), (Read)
task.complete { task_name: "审查认证模块代码" }
tool.complete(Edit), (Read)
task.complete { task_name: "重构错误处理逻辑" }
conversation.message
session.end
```

### Session 2（下午深度开发，14:00-15:30，~21 事件）

```
session.start
conversation.message ×2
tool.complete(Read) ×2, (Edit)
permission.mode_changed { old_mode: "default", new_mode: "acceptEdits" }  ← 🔐 Permission Granted
tool.complete(Bash) ×2
task.complete { task_name: "运行单元测试" }
tool.complete(Write), (Read)
conversation.message
task.complete { task_name: "添加用户认证中间件" }
tool.complete(Bash)
conversation.message
task.complete { task_name: "修复登录页样式bug" }
session.end
```

### Session 3（晚上探索 MCP，20:00-21:00，~17 事件）

```
session.start
conversation.message ×2
tool.complete(Read)
mcp.server_used { server_name: "github" }  ← 🔌 MCP Plug-in
tool.complete(Read)
task.complete { task_name: "集成 GitHub MCP" }
conversation.message
tool.complete(Bash)
task.complete { task_name: "测试 API 接口" }
session.end
```

### 解锁的 5 个成就

| # | 成就 | 触发条件 | 触发点 |
|---|------|----------|--------|
| 1 | 👋 Hello World | `conversation.message >= 1` | Session 1 第一条消息 |
| 2 | 🔧 Prometheus | `tool.complete >= 1` | Session 1 第一个 Read |
| 3 | 🤝 Hat Trick | `task.complete >= 3` | 总共 7 个 task 完成 |
| 4 | 🔐 Permission Granted | `permission.mode_changed >= 1` | Session 2 权限切换 |
| 5 | 🔌 MCP Plug-in | `mcp.server_used >= 1` | Session 3 MCP 连接 |

全部属于 `onboarding` 类别 + `the_beginning` 套装（5/6）。

## CLI 输出

`agpa demo` 分三阶段输出：

### 阶段 1：数据生成进度
```
🎮  AGPA Demo — 模拟一天使用体验
────────────────────────────────────────────
⏳  生成 Demo 数据...  ████████████████  55 事件, 3 sessions
```

### 阶段 2：成就解锁（复用现有 renderPopup 样式）
逐个弹出 5 个成就的彩色卡片（宽 52 字符，含 icon、名称、描述、稀有度徽章）。

### 阶段 3：统计总结
```
📊  今日战绩
  成就: 5/183 解锁 (2.7%)
  事件: 55 条记录
  Sessions: 3 次
  活跃时段: 09:00 - 21:00
  按类别:  onboarding  ██  5/32
  🎖️  the_beginning 套装: 5/6 (还差 1 个!)
────────────────────────────────────────────
🌐  正在打开 Dashboard...
  浏览器已打开 → http://localhost:3867
```

CLI 结束后自动 spawn Dashboard 子进程。

## Dashboard Demo 模式

### 检测机制
Dashboard server 启动时读 `--profile _demo` flag。前端通过 API 获取 profile 名称，检测到 `_demo` 进入 demo 模式。

### 导航栏
```
[Logo] Agent Player Achievements  🔬 Demo 数据  |  成就  时间线  统计  [切换到真实数据 →]
```

- `🔬 Demo 数据`：紫色底色白色文字标签（`border-radius: 4px; padding: 2px 8px; background: #7c3aed`）
- `切换到真实数据 →`：点击后切换到用户默认 profile，刷新页面

### 引导 Banner
页面加载后显示在导航栏下方：
```
┌──────────────────────────────────────────────────────────────┐
│ 🎮  这是你的 Demo 体验数据                                    │
│                                                              │
│  我们用模拟的一天使用历史帮你解锁了 5 个入门成就。               │
│  探索下面的面板，了解 AGPA 能追踪什么。                        │
│                                                              │
│  [👀 带我逛逛]                              [✕ 关闭]          │
└──────────────────────────────────────────────────────────────┘
```
- 紫色渐变背景，白色文字
- "带我逛逛"按钮：purple 实心按钮
- "关闭"：文字链接，点击后 banner 滑出消失（CSS transition）
- banner 关闭后不再显示（localStorage 记录 `agpa_demo_banner_dismissed`）

### 产品导览（4 步）

纯 JS/CSS 实现，不引入 Shepherd.js 等库。核心组件：一个 `TourOverlay` 类。

**步骤流程：**
1. **成就面板** — 高亮成就网格区域，"每个成就追踪一种 Agent 行为"
2. **统计行** — 高亮 stats row，"进度、分类、稀有度一目了然"
3. **时间线 Tab** — 自动切换到时间线，"回顾你和 Agent 的对话 session"
4. **热力图** — 自动切换到 Insights tab，"GitHub 风格的活动热力图"

**UI 组成：**
- 半透明黑色遮罩层（`rgba(0,0,0,0.5)`）
- 目标元素被克隆/提升到遮罩层上方（`z-index` 提升）
- 高亮元素有 pulsing border（`box-shadow` 动画）
- 底部 tooltip 卡片：步骤标题 + 描述 + ← 上一步 / 下一步 → / ✕ 跳过
- 点击遮罩空白区域关闭导览

### 成就卡片动画
已解锁的 5 个 Demo 成就卡片（`first_contact`, `tool_time`, `three_company`, `permission_granted`, `mcp_first_contact`）添加细微金色边框闪光动画：
```css
@keyframes demo-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(250, 204, 21, 0.4); }
  50%      { box-shadow: 0 0 12px rgba(250, 204, 21, 0.8); }
}
```
- 仅 demo 模式下生效
- 不影响 gacha-reveal 动画

## 数据隔离实现

### `_demo` Profile
- 存储路径：`~/.agent-achievements/profiles/_demo/`
- 不在 4 个用户 profile 上限内
- `resolveProfileDir("_demo")` 返回此路径
- `agpa demo` 总是先 `engine.resetState()` 清空 demo 数据再写入
- 用户 profile 上的 `agpa track`、`agpa poll` 等操作完全不影响 demo 数据

### 自我保护
- `_demo` profile 不能被用户手动 `agpa profile create` 创建（同名校验）
- `_demo` profile 不出现在 `agpa profile list` 中
- `agpa reset --profile _demo` 可以重置 demo（dev 场景，对用户透明）

## 修改文件清单

### 新文件
- `src/cli/demo.ts` — demo 命令实现（从 mvp.ts 的 runDemo 逻辑独立出来）
- `src/dashboard/public/tour.js` — 产品导览 TourOverlay 类（~150 行）

### 修改文件
- `src/cli/index.ts` — `demo` command 指向新的 `./demo.ts`
- `src/cli/mvp.ts` — 移除 runDemo 函数，stats/progress/reset 保持不变
- `src/dashboard/public/index.html` — 引入 tour.js
- `src/dashboard/public/app.js` — 检测 `_demo` profile、渲染 banner、卡片动画、tour 触发
- `src/dashboard/public/styles.css` — demo banner、badge、卡片 glow、tour overlay 样式
- `src/dashboard/api.ts` — API 返回当前 profile 名称
- `src/dashboard/server.ts` — 支持 `--profile` flag 传递到前端
- `src/utils/profile.ts` — `_demo` profile 的特殊处理（不占上限、不在列表、不可手动创建）

### 不改动
- `achievement-definitions.yaml` — 不变
- `src/engine/` — 不变
- `src/tools/` — 不变
- Dashboard 其他 tab（timeline, insights）— 仅 tour 可能自动切换 tab

## 测试计划

- `tests/cli/demo.test.ts` — 验证 demo 生成 55 事件、5 成就解锁、_demo profile 隔离
- `tests/dashboard/demo-mode.test.ts` — 验证 API 返回 demo profile、banner 渲染、tour DOM 操作
- 全量回归（目前 ~845 tests）应保持 green

## 非目标（明确不做）

- 不引入 Shepherd.js / intro.js 等第三方 tour 库
- 不做成就声音效果（demo 模式静音？不做特殊处理）
- 不做国际化的 demo banner 文字（只中文）
- 不做 demo 数据的导出/导入
- 不在 demo 中展示 gacha 动画
