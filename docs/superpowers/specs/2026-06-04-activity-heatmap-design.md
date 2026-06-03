# Dashboard 活动热力图设计

> 状态：✅ 已确认 | 日期：2026-06-04 | 来源：GitHub Contribution Graph 调研

---

## 1. 设计目标

在 Dashboard Streak 卡片下方新增一个 GitHub 风格的活动热力图，可视化用户过去 4 个月的编码活跃模式。Streak 看"今天"，热力图看"过去"，合在一起形成连贯的活动面板。

---

## 2. 数据模型

### 2.1 原始数据

从 `event.log` 中统计 `session.start` 事件，按日期聚合：

```typescript
// API 层计算
interface DayActivity {
  date: string;       // "2026-06-04"
  count: number;      // 当天 session.start 次数
  level: 0 | 1 | 2 | 3 | 4;  // 色阶（计算得出）
}
```

### 2.2 计算逻辑

```typescript
function computeHeatmap(events: TrackedEvent[]): {
  days: DayActivity[];   // 过去 4 个月每天一条
  quantiles: number[];   // [q1, q2, q3, q4] 分位阈值
} {
  // 1. 确定时间窗口：过去 4 个月（从今天往前 122 天）
  // 2. 收集所有 session.start 的日期，按天计数
  // 3. 对每天生成 DayActivity（无 session 的日期 count=0）
  // 4. 提取非零值 day.count，排序后计算 3 个分位点（25%/50%/75%）
  // 5. 非零值 >= 4 才用分位；< 4 个非零值则用固定阈值 [1, 2, 3]
  // 6. 每条 DayActivity.level = 
  //      count === 0  → 0
  //      count <= q1  → 1
  //      count <= q2  → 2
  //      count <= q3  → 3
  //      count >  q3  → 4
}
```

**分位桶规则**：0 永远对应 `level=0`（独立桶，不参与分位计算）。只有 `count > 0` 的值才进入分位排序。

**新用户退路**：非零值 < 4 天时，回退为固定阈值：

| count | level |
|-------|-------|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4+ | 4 |

---

## 3. 网格布局

```
4 个月 ≈ 17-18 周
18 列 × 7 行

        May                          Jun
Mon  ░░▒▒▓▓░░░▓▓▒▒░░░▓▓▓▓▓░░░▓▓▓▓░░░▓▓▓▒░░░▓▓▓▓
     ░░▒▒▓▓▓▓▓▓░░░▓▓░░░░░▓▓▒▒░░░▓▓▓▒░░░▓▓▓▓░░░▓▓
Wed  ░░▓▓▓▓░░░▓▓░░░▓▓▒▒░░░▓▓▓▓░░░▓▓▒▒░░░▓▓▓▒░░░▓▓
     ░░░░▓▓░░░▓▓▓▒░░░▓▓░░░░░▓▓▓▒░░░▓▓▓▓░░░░░░░░░▓▓
Fri  ░░░░░░░░▓▓▓▓░░░▓▓▓▓▓▓░░░░░▓▓▓▓░░░░░░░░░▓▓░░░
     ░░░░░░░░░░▓▓░░░▓▓▓▒░░░▓▓░░░░░▓▓░░░▓▓░░░▓▓▓░░░
Sun  ░░░░░░░░▓▓░░░▓▓▓▓░░░▓▓░░░░░▓▓▓░░░▓▓▓░░░▓▓▓░░░

     Less ░░▒▒▓▓▓▓▓▓ More
```

**格子规格**：

| 参数 | 值 |
|------|----|
| 列数 | 动态（4 个月对应的周数，约 17-18） |
| 行数 | 7（周一至周日） |
| 格宽 | 14px |
| 格高 | 14px |
| 间距 | 3px |
| 圆角 | 2px |
| 总宽 | ~306px（18 × 17px） |

**行列标签**：
- 行标签：周一至周日，只标 Mon / Wed / Fri（如 GitHub），左侧 3 个 label
- 列标签：月份名（显示在每月的第一周上方），如 GitHub

---

## 4. 颜色方案

### 4.1 色阶（4+1 级）

```
Level 0 (0 sessions)   → var(--bg-card)         空/灰色
Level 1 (≤ q1)         → #c6e48b                浅绿
Level 2 (≤ q2)         → #7bc96f                中绿
Level 3 (≤ q3)         → #239a3b                深绿
Level 4 (> q3)         → #196f2d                最深绿
```

这些绿色值与 GitHub 的调色板一致，在深色/浅色背景下都有良好对比度。

### 4.2 深色模式适配

深色模式下格子背景（level 0）用 `--border` 色（`#1e1e30`），形成微妙的网格可见性。

---

## 5. HTML 结构

```html
<div class="heatmap-card" id="heatmap-card">
  <div class="heatmap-header">
    <span class="heatmap-icon">📊</span>
    <span class="heatmap-title" data-i18n="heatmap_title">Activity</span>
  </div>
  <div class="heatmap-grid-wrapper">
    <div class="heatmap-row-labels" id="heatmap-row-labels"></div>
    <div class="heatmap-scroll">
      <div class="heatmap-col-labels" id="heatmap-col-labels"></div>
      <div class="heatmap-grid" id="heatmap-grid"></div>
    </div>
  </div>
  <div class="heatmap-legend">
    <span class="heatmap-legend-label" data-i18n="heatmap_less">Less</span>
    <span class="heatmap-legend-cell" data-level="0"></span>
    <span class="heatmap-legend-cell" data-level="1"></span>
    <span class="heatmap-legend-cell" data-level="2"></span>
    <span class="heatmap-legend-cell" data-level="3"></span>
    <span class="heatmap-legend-cell" data-level="4"></span>
    <span class="heatmap-legend-label" data-i18n="heatmap_more">More</span>
  </div>
</div>
```

位置：`index.html` 中 streak-card 之后、showcase 之前。

---

## 6. CSS 样式

```css
.heatmap-card {
  background: var(--stat-card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 20px;
  margin-bottom: 12px;
}

.heatmap-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 10px;
}
.heatmap-icon { font-size: 16px; }

.heatmap-grid-wrapper {
  display: flex;
  gap: 4px;
}

.heatmap-row-labels {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 18px; /* align with grid rows below col labels */
  font-size: 10px;
  color: var(--text-muted);
  line-height: 14px;
}

.heatmap-scroll {
  overflow-x: auto;
  /* scroll to right edge on load (show most recent weeks) */
}

.heatmap-col-labels {
  display: flex;
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 4px;
  height: 14px;
}

.heatmap-col-label {
  width: 14px;
  margin-right: 3px;
}

.heatmap-grid {
  display: grid;
  grid-template-rows: repeat(7, 14px);
  grid-auto-flow: column;
  gap: 3px;
}

.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: var(--bg-card);
  cursor: default;
  position: relative;
}

.heatmap-cell[data-level="1"] { background: #c6e48b; }
.heatmap-cell[data-level="2"] { background: #7bc96f; }
.heatmap-cell[data-level="3"] { background: #239a3b; }
.heatmap-cell[data-level="4"] { background: #196f2d; }

/* Tooltip on hover */
.heatmap-cell:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 10;
  pointer-events: none;
}

/* Legend */
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 10px;
  justify-content: flex-end;
}

.heatmap-legend-label {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0 4px;
}

.heatmap-legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}
.heatmap-legend-cell[data-level="0"] { background: var(--bg-card); }
.heatmap-legend-cell[data-level="1"] { background: #c6e48b; }
.heatmap-legend-cell[data-level="2"] { background: #7bc96f; }
.heatmap-legend-cell[data-level="3"] { background: #239a3b; }
.heatmap-legend-cell[data-level="4"] { background: #196f2d; }
```

---

## 7. JS 渲染逻辑

```javascript
function renderHeatmap(days) {
  const card = document.getElementById('heatmap-card');
  const grid = document.getElementById('heatmap-grid');
  const colLabels = document.getElementById('heatmap-col-labels');
  const rowLabels = document.getElementById('heatmap-row-labels');
  if (!card || !grid || !days || days.length === 0) {
    if (card) card.style.display = 'none';
    return;
  }
  card.style.display = '';

  // Days array is sorted ascending, each: { date, count, level }
  
  // 1. Pad to start on Monday (front-fill empty cells)
  // 2. Render row labels: Mon / (skip Tue) / Wed / (skip Thu) / Fri / (skip Sat) / Sun
  // 3. Render column labels: month name at first column of each month
  // 4. Render grid cells with data-level and data-tooltip attributes
  
  const ROW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  rowLabels.innerHTML = ROW_LABELS.map(l => `<span>${l}</span>`).join('');

  // Compute week boundaries for month labels
  // ...

  // Render cells
  grid.style.gridTemplateColumns = `repeat(${numWeeks}, 14px)`;
  grid.innerHTML = days.map(d => 
    `<div class="heatmap-cell" data-level="${d.level}" 
          data-tooltip="${formatDate(d.date)} · ${d.count} sessions"></div>`
  ).join('');
  
  // Scroll to right edge (most recent data)
  const scroll = grid.closest('.heatmap-scroll');
  if (scroll) scroll.scrollLeft = scroll.scrollWidth;
}
```

在 `renderProfile()` 中：
```javascript
renderStreakCard(stats.streak);
renderHeatmap(stats.heatmap);  // ← 新增
```

---

## 8. API 层

### 8.1 类型定义（`src/dashboard/api.ts`）

```typescript
export interface DayActivity {
  date: string;   // "2026-06-04"
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapData {
  days: DayActivity[];
  quantiles: [number, number, number]; // [q1, q2, q3] — 分位阈值信息
}
```

### 8.2 DashboardStats 扩展

```typescript
export interface DashboardStats {
  // ...现有字段
  heatmap: HeatmapData;  // ← 新增
}
```

### 8.3 计算函数

```typescript
function computeHeatmap(events: TrackedEvent[]): HeatmapData {
  const today = new Date();
  const days: Map<string, number> = new Map();
  
  // 1. 生成过去 122 天的所有日期 key
  for (let i = 121; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.set(d.toISOString().slice(0, 10), 0);
  }
  
  // 2. 统计 session.start
  for (const e of events) {
    if (e.event_type !== 'session.start') continue;
    const key = e.timestamp.slice(0, 10);
    if (days.has(key)) days.set(key, (days.get(key) || 0) + 1);
  }
  
  // 3. 计算分位阈值（排除 0 值）
  const nonZero = [...days.values()].filter(c => c > 0).sort((a, b) => a - b);
  let q1 = 1, q2 = 2, q3 = 3; // 默认固定阈值
  if (nonZero.length >= 4) {
    q1 = nonZero[Math.floor(nonZero.length * 0.25)]!;
    q2 = nonZero[Math.floor(nonZero.length * 0.50)]!;
    q3 = nonZero[Math.floor(nonZero.length * 0.75)]!;
    // 保证分位点有区分度（两两不同）
    if (q2 <= q1) q2 = q1 + 1;
    if (q3 <= q2) q3 = q2 + 1;
  }
  
  // 4. 赋 level
  const result: DayActivity[] = [];
  for (const [date, count] of days) {
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0) {
      if (count <= q1) level = 1;
      else if (count <= q2) level = 2;
      else if (count <= q3) level = 3;
      else level = 4;
    }
    result.push({ date, count, level });
  }
  
  return { days: result.sort((a, b) => a.date.localeCompare(b.date)), quantiles: [q1, q2, q3] };
}
```

---

## 9. i18n

| key | EN | ZH |
|-----|----|----|
| `heatmap_title` | Activity | 活动热力图 |
| `heatmap_less` | Less | 少 |
| `heatmap_more` | More | 多 |

---

## 10. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/dashboard/api.ts` | 新增 `computeHeatmap()`、`DayActivity`/`HeatmapData` 类型；`DashboardStats` 加 `heatmap` 字段 |
| `src/dashboard/public/index.html` | streak-card 下方插入热力图 HTML |
| `src/dashboard/public/app.js` | 新增 `renderHeatmap()`；`renderProfile()` 调用；i18n 3 个 key |
| `src/dashboard/public/styles.css` | 热力图全套样式 |

---

## 11. 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 时间窗口 | 4 个月 | 编码节奏比 GitHub 的一年更快，4 个月足够看到近期趋势 |
| 活动指标 | 每日 session 数 | 数据已有、语义清晰 |
| 位置 | Streak 卡片下方 | 形成"今天→过去"的连贯活动面板 |
| 色阶 | 分位桶 + 0 独立桶 | GitHub 同款策略，自适应个体差异 |
| 新用户退路 | 固定阈值 `[1,2,3]` | 非零值 < 4 天时分位无意义 |
| 渲染 | 纯 JS + CSS Grid | 零依赖，与 Dashboard 技术栈一致 |
| 默认滚动 | 滚到最右 | 最新数据最相关 |
