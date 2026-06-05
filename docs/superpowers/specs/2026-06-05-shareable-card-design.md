# Shareable Achievement Card — Design

> 设计文档，2026-06-05
>
> **范围：** Dashboard 生成可分享的成就卡片 PNG 图片
> **前提：** AGPA v0.1.6，166 成就，478 测试全绿，终端 ANSI 弹窗已上线

---

## 一、问题陈述

AGPA 当前缺少社交/分享能力。用户解锁成就后，只能自己在 Dashboard 查看或终端看到 ANSI 弹窗。没有方式生成一张漂亮的图片分享给朋友或社群。

目标：在 Dashboard 加一个按钮，点击即生成 Steam 风格的成就卡片 PNG 并下载。

## 二、架构

新增 1 个后端 API 端点，前端加渲染 + 截图逻辑。不新增文件。

```
Dashboard 页面                      后端
    │                                │
    ├─ [📸 Share] 按钮               │
    │   ↓                            │
    │   fetch GET /api/card  ─────────→ api.ts buildCardResponse()
    │                               │   └─ 聚合 stats + showcase + milestones
    │   拿到 CardData                 │
    │   ↓                            │
    │   渲染隐藏 #card-preview DOM    │
    │   ↓                            │
    │   html2canvas 截图 (scale:2)    │
    │   ↓                            │
    │   <a download> → PNG            │
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/dashboard/api.ts` | 新增 `GET /api/card` 端点响应 `CardData` |
| `src/dashboard/server.ts` | 注册 `/api/card` 路由 |
| `src/dashboard/public/index.html` | 新增 📸 Share 按钮 + 隐藏 `<div id="card-preview">` + html2canvas CDN |
| `src/dashboard/public/app.js` | 新增 `renderCard()` + `captureAndDownload()` |
| `src/dashboard/public/styles.css` | 新增 `#card-preview` 卡片样式 |

### 设计约束

- html2canvas 从 CDN 加载（`html2canvas.hertzen.com/dist/html2canvas.min.js`），不算 npm 依赖。CDN 版本固定到 `@1.4.1` 以避免 breaking change；如有条件可加 `integrity` 哈希
- 卡片 DOM 隐藏渲染（`visibility: hidden; position: absolute`），用完清空
- API 复用现有 stats 计算逻辑，不新增引擎代码

---

## 三、后端 API

### `GET /api/card?profile=<name>`

profile 可选，默认 active profile。

### 格式

```typescript
interface CardData {
  profile: string;
  profile_emoji: string;
  level: number;
  total_xp: number;
  xp_current: number;
  xp_target: number;         // 下一级所需 XP
  unlocked: number;
  total: number;

  stats: {
    streak_days: number;
    total_tasks: number;
    total_tool_uses: number;
    total_sessions: number;
  };

  rarity_breakdown: Array<{
    rarity: string;          // common | uncommon | rare | epic | legendary | mythic
    color: string;           // hex from CSS vars
    count: number;
  }>;

  achievements: Array<{
    id: string;
    icon: string;
    name: string;            // 已国际化（en/zh）
    description: string;     // 已国际化
    rarity: string;
    rarity_color: string;
    rarity_label: string;    // "Legendary · Top 2%"
    unlocked_at?: string;    // ISO date，进行中则为空
    set_name?: string;
    set_progress?: string;   // "2/4"
    in_progress?: boolean;
    progress_pct?: number;   // 0-100，仅进行中
    progress_text?: string;  // "31,000 / 50,000 char"
  }>;

  heatmap: Array<{
    date: string;            // YYYY-MM-DD
    count: number;           // 0-4 level
  }>;

  milestones: Array<{
    emoji: string;
    name: string;
    rarity: string;
    rarity_color: string;
    unlocked_at: string;     // formatted date
  }>;
}
```

### 实现

在 `api.ts` 中新增 `buildCardResponse()`：

```typescript
export function buildCardResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  events: TrackedEvent[],
  setDefinitions: SetDefinition[],
  config: AppConfig,
  profile: string,
  profileEmoji: string,
  existingStats: any,       // from engine.stats or cached stats.json
): CardData { ... }
```

- 成就：取展示柜中已解锁的成就（最多 6 个），按稀有度降序排列。不足 6 个时用其他已解锁成就补位。如果已解锁总数 < 6，混入 1-2 个进行中的高进度成就。
- 语言：`config.lang === 'zh'` 时返回中文 name/description，否则英文。
- 热力图：优先用 stats.json v2.0 daily cache（`computeHeatmapFromDaily`），fallback 事件扫描。
- 里程碑：取最近解锁的成就按稀有度排序，取 top 3。
- 稀有度颜色：硬编码 hex map（与 Dashboard CSS 变量一致）。

### 路由注册

`server.ts` 中新增：

```typescript
if (pathname === '/api/card' && req.method === 'GET') {
  const cardData = buildCardResponse(...);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cardData));
  return;
}
```

---

## 四、前端渲染 & 截图

### html2canvas CDN

`index.html` `<head>` 中插入：

```html
<script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
```

> ⚠️ Security：部署前建议确定 CDN 版本号（如 `html2canvas@1.4.1`）并加 `integrity` 哈希。

### Share 按钮

Profile Hero 区域的 XP bar 旁边新增：

```html
<button id="share-btn" onclick="generateCard()" data-i18n="share_card">📸 Share</button>
```

### 卡片预览 DOM

```html
<div id="card-preview">
  <!-- JS 动态填充 -->
</div>
```

CSS（`styles.css`）：
```css
#card-preview {
  visibility: hidden;
  position: absolute;
  left: -9999px;
  top: 0;
  width: 420px;             /* 2x retina → 840px 输出 */
  background: linear-gradient(180deg, #171a21 0%, #1b2838 30%, #2a475e 100%);
  border-radius: 12px;
  padding: 32px;
  color: #c7d5e0;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  z-index: -1;
}
```

- 卡片样式全部内联在用 CSS 类中，避免受 Dashboard 主题变量影响
- 稀有度配色直接用 hex 值（与 CSS 变量一致：Common #7eb8da, Uncommon #3b7ec0, Rare #e0b020, Epic #e87830, Legendary #a858f0, Mythic #f04050）
- 热力图用 CSS Grid 绿阶（#1e2529 → #0e4429 → #006d32 → #26a641 → #39d353）

### 渲染 & 下载流程（app.js）

```javascript
async function generateCard() {
  const btn = document.getElementById('share-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    // 1. Fetch card data
    const params = new URLSearchParams();
    const profile = getActiveProfile();
    if (profile) params.set('profile', profile);
    const resp = await fetch('/api/card?' + params);
    const data = await resp.json();

    // 2. Build DOM
    const preview = document.getElementById('card-preview');
    preview.innerHTML = buildCardHTML(data);
    preview.style.visibility = 'visible';

    // 3. Screenshot
    const canvas = await html2canvas(preview, {
      scale: 2,
      backgroundColor: '#171a21',
      useCORS: true,
      logging: false,
    });

    // 4. Download
    const date = new Date().toISOString().slice(0, 10);
    const profileName = data.profile || 'default';
    const link = document.createElement('a');
    link.download = `agpa-card-${profileName}-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // 5. Cleanup
    preview.innerHTML = '';
    preview.style.visibility = 'hidden';
  } catch (err) {
    console.error('Card generation failed:', err);
    alert('Failed to generate card. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = '📸 Share';
  }
}

function buildCardHTML(data) {
  // Returns HTML string for the full card layout:
  // 1. Header: emoji + profile name + level + unlocked count
  // 2. 4-column stats grid (streak, tasks, tools, sessions)
  // 3. XP progress bar
  // 4. Divider
  // 5. "荣誉墙" title
  // 6. Achievement list (up to 6): icon + name + description + rarity tag + date/progress
  // 7. Heatmap (CSS Grid, green scale)
  // 8. Rarity breakdown (6 columns)
  // 9. Milestones (3 items)
  // 10. Footer watermark
  return html;
}
```

### 边界情况

- **html2canvas 加载失败（离线环境）：** 检查 `window.html2canvas`，未定义时提示 "需要网络连接"
- **API 返回空数据：** 提示 "暂无成就数据，开始使用 AGPA 解锁第一个成就吧！"
- **0 解锁成就：** 成绩列表为空，展示引导文案 "Start your journey →"
- **showcase 为空：** 自动从所有已解锁成就中按稀有度取 top N
- **热力图无数据：** 热力图区域显示单行 "No activity data yet"
- **截图失败（浏览器策略）：** try/catch 捕获，alert 提示用户

---

## 五、国际化

卡片内容语言跟随 Dashboard 当前语言设置：

- `lang === 'zh'`：成就名用 `name_cn`、描述用 `description_cn`、标签用中文
- 否则：英文

"荣誉墙" / "SHOWCASE" 等标题同理。

---

## 六、测试策略

### 后端测试（API）

- 新增 3-4 个测试在现有 dashboard 测试中（或新建 `tests/dashboard/card-api.test.ts`）：
  1. `buildCardResponse` 返回完整 CardData 结构
  2. 成就按稀有度排序正确
  3. 语言切换（zh/en）正确
  4. 0 解锁成就时返回空成就列表但不报错

### 前端测试

- 卡片渲染不写自动化测试（依赖 DOM + html2canvas，vitest 环境不适合）
- 依赖冒烟测试：Dashboard 启动后手动点 Share 按钮验证

---

## 七、Affected Files Summary

| 文件 | 操作 | 估计新增行 |
|------|------|-----------|
| `src/dashboard/api.ts` | 修改 | +50 (buildCardResponse) |
| `src/dashboard/server.ts` | 修改 | +8 (路由) |
| `src/dashboard/public/index.html` | 修改 | +4 |
| `src/dashboard/public/app.js` | 修改 | +120 (renderCard + capture) |
| `src/dashboard/public/styles.css` | 修改 | +80 (卡片样式) |
| `tests/dashboard/card-api.test.ts` | 新建 | +80 |
| **总计** | | **~342 行** |

### 不修改的

- 引擎层（engine.ts、evaluator.ts、types.ts）
- Hook CLI
- MCP Server
- YAML 定义
- init.ts

---

## 八、后续跟进（不做本次）

- CLI `agpa card` 命令：生成独立 HTML 文件，浏览器打开后自动截图保存
- 自定义卡片背景色/主题
- 分享到社交平台一键按钮（X/Twitter、Slack）
- 像素画 icon 替代 emoji（等像素画资产生成后）
