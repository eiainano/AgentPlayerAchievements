# Dashboard Streak 可视化设计

> 状态：✅ 已确认 | 日期：2026-06-04 | 来源：Duolingo 调研第 1 项

---

## 1. 设计目标

在 Dashboard Hero section 中新增一张独立的 streak 卡片，展示用户连续编码天数。数据已有（`calcStreak()` 已在计算），只增加渲染层。不改引擎、不改事件流。

---

## 2. 架构

```
API (api.ts)
    calcStreak() → 返回结构体 { current, longest, today_active }
    ↓
DashboardStats.streak 类型从 number → 对象
    ↓
app.js renderProfile()
    ├── renderStreakCard()  ← 新增
    └── stats-row 从 4 个 mini-card 减为 3 个（移除 streak mini-card）
```

---

## 3. 数据模型

### 3.1 API 层（`src/dashboard/api.ts`）

`calcStreak()` 重写，从返回 `number` 变为返回对象：

```typescript
interface StreakData {
  current: number;      // 当前连续天数
  longest: number;      // 历史最高连续天数
  today_active: boolean; // 今天是否已有 session.start 事件
}

function calcStreak(events: TrackedEvent[]): StreakData {
  // 1. 收集所有活跃日期（去重）
  const days = new Set<string>();
  for (const e of events) {
    days.add(e.timestamp.slice(0, 10));
  }
  const sorted = [...days].sort(); // 升序

  // 2. 计算 current streak（从最新日期往回数连续天数）
  // 3. 计算 longest streak（遍历找出最长连续段）
  // 4. 判断 today_active（最新日期 === 今天 YYYY-MM-DD）
}
```

### 3.2 Dashboard 类型（`src/dashboard/api.ts`）

```typescript
export interface DashboardStats {
  // ...现有字段不变
  streak: StreakData;  // 之前是 streak: number
}
```

---

## 4. UI 布局

```
Hero section:

    🏆 Agent Achievements
    ██████████████░░░░░░  3,300 XP • Level 5

    ┌──────────────────────────────┐
    │ 🔥 Streak                    │
    │                              │
    │  7              14           │
    │  天              最高纪录      │
    │                         📅    │
    └──────────────────────────────┘

    ┌─────┐┌─────┐┌─────┐┌─────┐
    │ 展示柜 ×4                    │
    └─────┘└─────┘└─────┘└─────┘
    [ Auto ]

    28 已解锁 | 4,727 事件 | 18% 完成度
```

**关键行为**：
- `today_active === true` → 卡片显示绿色勾 + "今天已编码 ✓"
- `today_active === false` → 卡片显示灰色提示 "今天还没写代码"（不施加压力，纯状态）
- `current === 0`（无事件） → 卡片不显示，或显示 "开始你的第一天"
- `current === longest && current > 0` → 显示 "🔥 新纪录！"

---

## 5. HTML 结构

插入位置：`index.html` 中 XP 进度条之后、展示柜之前：

```html
<div class="streak-card" id="streak-card">
  <div class="streak-header">
    <span class="streak-icon">🔥</span>
    <span class="streak-title" data-i18n="streak_title">Coding Streak</span>
    <span class="streak-today" id="streak-today"></span>
  </div>
  <div class="streak-body">
    <div class="streak-main">
      <span class="streak-count" id="streak-current">0</span>
      <span class="streak-unit" data-i18n="streak_days">天</span>
    </div>
    <div class="streak-divider"></div>
    <div class="streak-record">
      <span class="streak-record-icon">📅</span>
      <span class="streak-record-value" id="streak-longest">0</span>
      <span class="streak-record-label" data-i18n="streak_best">最高纪录</span>
    </div>
  </div>
</div>
```

---

## 6. CSS 设计

```css
.streak-card {
  --streak-card-bg: var(--stat-card-bg);
  border-radius: var(--radius-md);
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* same width as xp-bar-container */
  margin-bottom: 12px;
}

.streak-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
}

.streak-icon { font-size: 18px; }

.streak-today {
  margin-left: auto;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.streak-today.active { color: #4caf50; background: rgba(76, 175, 80, 0.1); }
.streak-today.idle   { color: var(--text-muted); }

.streak-body {
  display: flex;
  align-items: center;
  gap: 20px;
}

.streak-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.streak-count {
  font-size: 36px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.streak-unit {
  font-size: 16px;
  color: var(--text-dim);
}

.streak-divider {
  width: 1px;
  height: 40px;
  background: var(--border-strong);
}

.streak-record {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.streak-record-icon { font-size: 16px; }

.streak-record-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}

.streak-record-label {
  font-size: 11px;
  color: var(--text-dim);
}
```

**暗/亮主题**：复用现有 `--var`，不新增颜色 token。

---

## 7. JS 渲染逻辑

```javascript
function renderStreakCard(streak) {
  const card = document.getElementById('streak-card');
  if (!card) return;

  const currentEl = document.getElementById('streak-current');
  const longestEl = document.getElementById('streak-longest');
  const todayEl = document.getElementById('streak-today');

  if (streak.current === 0 && !streak.today_active) {
    // 全新用户 — 不显示卡片
    card.style.display = 'none';
    return;
  }

  card.style.display = '';
  currentEl.textContent = streak.current;
  longestEl.textContent = streak.longest;

  if (streak.today_active) {
    todayEl.textContent = t('streak_today_done');     // "今天已编码 ✓"
    todayEl.className = 'streak-today active';
  } else {
    todayEl.textContent = t('streak_today_pending');  // "今天还没写代码"
    todayEl.className = 'streak-today idle';
  }
}
```

在 `renderProfile()` 中调用：
```javascript
if (stats.streak) {
  renderStreakCard(stats.streak);
}
```

---

## 8. i18n 新增 key

| key | EN | ZH |
|-----|----|----|
| `streak_title` | Coding Streak | 编码连胜 |
| `streak_days` | days | 天 |
| `streak_best` | Best | 最高纪录 |
| `streak_today_done` | Coded today ✓ | 今天已编码 ✓ |
| `streak_today_pending` | Not yet today | 今天还没写代码 |

---

## 9. stats-row 调整

从 4 个 mini-card 减为 3 个，移除 streak mini-card：

```javascript
const statItems = [
  { value: unlockedCount.toLocaleString(), label: t('stat_unlocked') },
  { value: stats.total_events.toLocaleString(), label: t('stat_events') },
  { value: `${stats.completion_pct}%`, label: t('stat_complete') },
];
```

---

## 10. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/dashboard/api.ts` | `calcStreak()` 重写，返回 `StreakData` 结构体；`DashboardStats.streak` 类型变更 |
| `src/dashboard/public/index.html` | Hero section 新增 streak 卡片 HTML |
| `src/dashboard/public/app.js` | 新增 `renderStreakCard()`；`renderProfile()` 调用；stats-row 减为 3 项；i18n 新增 5 个 key |
| `src/dashboard/public/styles.css` | 新增 streak 卡片样式 |

---

## 11. 实施步骤

```
1. api.ts — calcStreak() 重写，返回 { current, longest, today_active }
2. api.ts — DashboardStats.streak 类型从 number → StreakData
3. index.html — 插入 streak 卡片 HTML 结构
4. styles.css — 添加 streak 卡片样式
5. app.js — 新增 renderStreakCard() + i18n keys + stats-row 调整
6. 构建 + 测试
```

---

## 12. 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 不改引擎 | 纯 Dashboard 渲染 | `calcStreak` 在 API 层已经是派生数据，不需要引擎感知 streak 概念 |
| 不做 freeze/repair | 纯信息展示 | 编码断签是正常的（周末/休假），不应该像 Duolingo 那样制造焦虑 |
| `today_active: false` 不惩罚 | 灰色提示 | "今天还没写代码" 是信息，不是催逼。绿色勾是正向反馈 |
| 位置放 XP bar 之下 | 与 XP 同级视觉权重 | streak 是核心入驻指标，应该显眼 |
