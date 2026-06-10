# AGPA 推荐系统 2.0 设计方案

> 日期：2026-06-10
> 状态：📐 设计通过，待实施
> 基于：`docs/top10-next-todos-2026-06-10.md` #1 推荐系统 2.0

---

## 一、目标与范围

将现有的"近锁推荐"（`findNearUnlocks()` 单一维度）升级为 **3 类推荐引擎**（Challenge 本期不做）：

| 类别 | 目标 | 核心算法 |
|------|------|---------|
| **Near Win** | 离解锁最近的 Top 5 | 进度百分比排序 + 扩展到 8 种 condition type |
| **Discovery** | 发现尚未用过的功能 | 事件盲区法：找未触发的事件类型 → 推荐关联成就 |
| **Surprise** | 隐藏成就的模糊线索 | 未解锁 + 有 hint 字段 + session 确定性选取 |

### 接触点（3 个）

| 接触点 | 方式 | 改动 |
|------|------|------|
| MCP `achievement_suggest` | 升级返回结构 | `src/tools/suggest.ts` |
| CLI `agpa suggest` | 按类别分组输出 | `src/cli/suggest.ts` |
| Dashboard 浮动 widget | 右下角脉冲徽章 + 轮播大卡片 | `app.js` + `styles.css` + `index.html` |

---

## 二、用户视觉决策总结

以下 4 项 UI 决策通过视觉 companion 确定：

1. **位置**: 浮动小组件（右下角），不占主布局空间
2. **折叠态**: 50px 圆，带脉冲呼吸动画 (2s ease-in-out)，暗示"有内容可探索"
3. **展开交互**: 3 帧轮播（Near Win / Discovery / Surprise），5s 自动切换，底部圆点指示器
4. **展开帧**: 大卡片式 —— 类别名 + 推荐理由 + 1 个精选成就

---

## 三、模块架构

```
src/utils/
├── progress-nudge.ts        (改) 扩展 findNearUnlocks → 8 types
├── recommend.ts             (新) 推荐总控：聚合 3 类推荐
│   ├── recommendNearWin()   — 复用 progress-nudge
│   ├── recommendDiscovery() — 事件盲区法
│   └── recommendSurprise()  — 未解锁 session 确定性选取

API/工具层:
├── src/tools/suggest.ts     (改) 升级 achievement_suggest → 返回 3 类
├── src/cli/suggest.ts       (改) agpa suggest → 按类别分组输出
└── src/dashboard/api.ts     (改) 新增 GET /api/recommend 端点

Dashboard 前端:
├── src/dashboard/public/app.js     (改) 初始化 widget + 轮播逻辑
├── src/dashboard/public/styles.css (改) widget 样式 + 脉冲动画
├── src/dashboard/public/index.html (改) widget DOM 结构
```

**数据流**: definitions + events + state → `recommend.ts` (纯函数) → MCP / CLI / API 三路输出。

---

## 四、数据结构与 API 格式

### 4.1 类型定义 (`src/engine/types.ts` 新增)

```typescript
type RecommendCategory = 'near_win' | 'discovery' | 'surprise';

interface RecommendItem {
  category: RecommendCategory;
  achievement_id: string;
  name: string;          // 本地化名称
  name_cn?: string;
  icon: string;
  rarity: RarityLevel;

  // Near Win 专用
  progress?: { current: number; target: number; pct: number };
  unit_label?: string;

  // Discovery 专用
  discovery_event?: string;     // 未触发的事件类型，如 "agent.spawn"
  discovery_reason?: string;    // 中/英本地化文案 (由前端/CLI 生成)

  // Surprise 专用
  hint?: string | null;         // 模糊线索，不暴露名称和条件
  hint_cn?: string | null;
}

interface RecommendResponse {
  near_win: RecommendItem[];    // top 5
  discovery: RecommendItem | null; // 1 个，无候选时 null
  surprise: RecommendItem | null;  // 1 个，无候选时 null
  generated_at: string;         // ISO timestamp
  session_id?: string;          // surprise 绑定的 session
}
```

### 4.2 MCP `achievement_suggest` 2.0

```
// 无参数 → 全部 3 类
achievement_suggest({})
  → { near_win: [...5], discovery: {...|null}, surprise: {...|null} }

// 按类别过滤（兼容旧行为）
achievement_suggest({ categories: ["near_win"] })
  → { near_win: [...5] }
```

`max_results` / `min_progress` 参数保留但仅作用于 near_win。

### 4.3 CLI `agpa suggest` 2.0

```
🪐  AGPA 推荐中心  ──  27 / 205 unlocked

🎯 Near Win  (5)
  ▰▰▰▰▱▱ 76%  📝 First Edit          Common
  ▰▰▰▱▱▱ 58%  🔧 Toolsmith            Rare
  ▰▰▱▱▱▱ 42%  📊 Stat Collector       Uncommon
  ...

🔍 Discovery
  🔌 MCP Explorer  (Uncommon)
  → 你还没用过 MCP 工具。试试连接第一个 MCP 服务器吧！

🎲 Surprise  (??)
  ??? — "夜深人静时和 Claude 聊聊工作"

💡 Run 'agpa suggest --near' / '--discover' / '--surprise' to filter.
```

### 4.4 Dashboard API (`src/dashboard/api.ts`)

```
GET /api/recommend?profile=default
  → RecommendResponse

// 或内嵌进主数据端点，减少请求数：
GET /api/data?profile=default
  → 原有 DashboardData + { recommend: RecommendResponse }
```

**设计决定**：内嵌进主 `/api/data` 响应中。因为 widget 同时需要解锁数（红点计数），两个数据一次拿到更高效。加 `include_recommend` 字段，前端按需请求。

---

## 五、算法详解

### 5.1 Near Win — 扩展到 8 种 condition type

`src/utils/progress-nudge.ts` 新增 3 种类型的进度计算：

| condition type | 进度计算 | 新增 |
|------|------|:--:|
| `counter` | `scopedEvents.length` | — |
| `threshold` | `evaluateMetric(cond.metric, scoped)` | — |
| `streak` | 连续天数回溯 | — |
| `distinct_count` | `Set<string>` size | — |
| `sequence_count` | 模式匹配完整轮数 | — |
| **`sequence`** | 扫描事件流，匹配到的步数 / 模式总步数 × `cond.count` | ✨ |
| **`pattern_match`** | 命中 pattern 的事件数 / 所有相关事件数 × `cond.value` | ✨ |
| **`ratio`** | `evaluateMetric(分子表达式)` / `cond.value` | ✨ |

**`sequence` 进度计算**:
```typescript
function sequenceProgress(events: TrackedEvent[], cond: Condition): number | null {
  const pattern = Array.isArray(cond.pattern) ? (cond.pattern as string[]) : null;
  if (!pattern || pattern.length === 0) return null;
  let matched = 0;
  for (const e of events) {
    if (e.event_type === pattern[matched]) {
      matched++;
      if (matched >= pattern.length) return pattern.length; // 已完成
    }
  }
  return matched; // 部分匹配步数
}
```

**`pattern_match` 进度估计**:
```typescript
function patternMatchProgress(events: TrackedEvent[], cond: Condition): number | null {
  if (!cond.pattern) return null;
  const scoped = scopedEvents(events, cond);
  const hits = scoped.filter(e => matchFilter(e, { pattern: cond.pattern })).length;
  return Math.min(hits, cond.value);
}
```

**`ratio` 进度**:
```typescript
function ratioProgress(events: TrackedEvent[], cond: Condition): number | null {
  if (!cond.metric) return null;
  // evaluateMetric handles "numerator/denominator" syntax
  const numerator = evaluateMetric(cond.metric, events);
  if (numerator === null) return null;
  return numerator; // 不需要除以 target——target 是 cond.value（ratio 阈值）
}
```

不覆盖的 3 种：`event`（二元触发）、`mode`（状态判断）、`set_completion`（套装完成，二元）。

### 5.2 Discovery — 事件盲区法

```
输入: definitions[], events[], state
输出: RecommendItem | null

算法:
  1. 收集历史事件类型
    triggeredTypes = new Set(events.map(e => e.event_type))

  2. 构建候选池
    for each 未解锁成就:
      cond = 成就.conditions[0]
      if cond.event not in triggeredTypes:
        候选池.push(成就)

  3. 排序
    a. 稀有度优先级: Common > Uncommon > Rare > Epic > Legendary > Mythic
    b. 同稀有度按定义顺序（YAML 中靠前者先推荐）
    c. 过滤 hidden === true（Surprise 专管）

  4. 返回 top 1

  5. 候选池为空 → 返回 null
```

**`discovery_reason` 文案生成规则**：`recommend.ts` 只填充 `discovery_event` 字段，不填 `discovery_reason`。各调用层（MCP tool / CLI / Dashboard API）根据 `discovery_event` + 当前语言自行生成 `discovery_reason` 文本。映射表共享在 `src/utils/recommend.ts` 中导出：
```typescript
const reasonMap: Record<string, { en: string; zh: string }> = {
  'agent.spawn':   { en: "You haven't tried Agent mode yet", zh: "你还没用过 Agent 模式" },
  'skill.invoke':  { en: "You haven't used Custom Skills yet", zh: "你还没用过自定义技能" },
  'mcp.connect':   { en: "You haven't connected an MCP server", zh: "你还没连接过 MCP 服务器" },
  'plan.mode':     { en: "You haven't used Plan Mode yet", zh: "你还没用过计划模式" },
  // ... 更多事件类型在实现时补全
};
```

### 5.3 Surprise — 确定性的未解锁随机

```
输入: definitions[], state, sessionId: string
输出: RecommendItem | null

算法:
  1. 候选池 = definitions.filter(d =>
       d.hidden === true
       && d.future !== true
       && !state.unlocked[d.id]
       && (d.hint_cn || d.hint)  // 至少有一个语言的 hint
     )

  2. 确定性选取
    index = hashString(sessionId) % pool.length
    selected = pool[index]

  3. 返回 RecommendItem:
    - name / name_cn / description / description_cn → 全部 null
    - hint / hint_cn → 原样返回
    - rarity → 原样返回
    - icon → "?"
    - category → "surprise"
    - achievement_id → 原值

  4. 候选池为空 → 返回 null
```

**`hashString()` 实现** (djb2，放在 `src/utils/recommend.ts` 内):
```typescript
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0; // 32-bit integer
  }
  return Math.abs(hash);
}
```

**为什么用 sessionId 而不是随机**: `Date.now()` / `Math.random()` 在 workflow 环境中不可用。确定性选取保证同一 session 返回同一个 Surprise，且 session 切换后自动刷新。

---

## 六、Dashboard Widget 设计

### 6.1 DOM 结构

```html
<!-- 浮动 widget 容器 — 固定右下角 -->
<div id="recommend-widget" class="recommend-widget collapsed">
  <!-- 折叠态：脉冲光环徽章 -->
  <button id="recommend-toggle" class="recommend-toggle" aria-label="Open recommendations">
    ✨
  </button>

  <!-- 展开态：轮播面板 -->
  <div id="recommend-panel" class="recommend-panel" style="display:none">
    <div class="recommend-header">
      <span class="recommend-title">探索</span>
      <button class="recommend-close" aria-label="Close">✕</button>
    </div>
    <div class="recommend-carousel">
      <div class="carousel-track" id="carousel-track">
        <!-- JS 动态注入 3 帧 (near_win / discovery / surprise) -->
      </div>
    </div>
    <div class="carousel-dots" id="carousel-dots"></div>
  </div>
</div>
```

### 6.2 轮播帧模板（每帧一个大卡片）

```html
<div class="carousel-frame" data-index="0">
  <div class="frame-icon">🎯</div>
  <div class="frame-category">Near Win</div>
  <div class="frame-reason" data-i18n="recommend_near_win">这些成就你离解锁最近</div>
  <div class="frame-item">
    <div class="frame-ach-icon">📝</div>
    <div class="frame-ach-name">First Edit</div>
    <div class="frame-ach-rarity common">Common</div>
    <div class="frame-ach-progress">
      <div class="progress-bar" style="width:76%"></div>
      <span>76%</span>
    </div>
  </div>
</div>
```

### 6.3 脉冲动画 (CSS)

```css
@keyframes recommend-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 195, 247, 0.5); }
  50% { box-shadow: 0 0 0 12px rgba(79, 195, 247, 0); }
}

.recommend-toggle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--primary);
  background: var(--surface);
  cursor: pointer;
  animation: recommend-pulse 2s ease-in-out infinite;
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
}

.recommend-panel {
  position: absolute;
  bottom: 60px;  /* 在徽章上方 */
  right: 0;
  width: 280px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  overflow: hidden;
}
```

### 6.4 JS 轮播逻辑

```javascript
const CAROUSEL_INTERVAL = 5000; // 5s
let carouselIndex = 0;
let carouselTimer = null;
let recommendData = null;

function startCarousel(data) {
  recommendData = data;
  buildFrames(data);  // 根据 3 类数据构建帧
  carouselIndex = 0;
  showFrame(0);
  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % frameCount;
    showFrame(carouselIndex);
  }, CAROUSEL_INTERVAL);
}

function stopCarousel() {
  if (carouselTimer) clearInterval(carouselTimer);
}
```

### 6.5 暗/亮主题兼容

- 徽章背景用 `var(--surface)`
- 边框用 `var(--border)`
- 文字用 `var(--text-primary)` / `var(--text-muted)`
- 脉冲光环用 `var(--primary)`
- 不引入新颜色常量

---

## 七、文件改动清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/utils/progress-nudge.ts` | 改 | +3 种类型进度计算 (sequence / pattern_match / ratio) |
| `src/utils/recommend.ts` | **新** | 推荐总控：3 个推荐函数 + hashString |
| `src/tools/suggest.ts` | 改 | MCP tool 升级，返回 3 类推荐 |
| `src/cli/suggest.ts` | 改 | CLI 按类别分组输出 + 新 flag (--near/--discover/--surprise) |
| `src/dashboard/api.ts` | 改 | 主数据响应加 `include_recommend` 字段 |
| `src/dashboard/server.ts` | 改（如需）| 若独立端点，注册 `/api/recommend` |
| `src/dashboard/public/index.html` | 改 | widget DOM 结构 |
| `src/dashboard/public/app.js` | 改 | widget 初始化 + 轮播逻辑 + 数据获取 |
| `src/dashboard/public/styles.css` | 改 | widget 样式 + 脉冲动画 + 响应式 |
| `src/engine/types.ts` | 改 | 新增 RecommendItem / RecommendResponse 类型 |
| `tests/utils/progress-nudge.test.ts` | 改 | 新增 3 种类型测试 |
| `tests/utils/recommend.test.ts` | **新** | 推荐算法单元测试 |

**不改的文件**:
- `achievement-definitions.yaml` — 已有 hint 数据，无需修改
- `src/engine/evaluator.ts` — 推荐系统读取评估器结果，不修改评估器
- `src/engine/engine.ts` — 推荐是只读查询，不改变引擎状态

---

## 八、测试策略

### 8.1 单元测试 (`tests/utils/recommend.test.ts`)

| 测试场景 | 说明 |
|------|------|
| Near Win 全 8 种 type 基础输出 | 每种 type 的进度算对 |
| Near Win 排序正确性 | 高进度在前 |
| Near Win 隐藏成就过滤 | hidden 不出现 |
| Discovery 事件盲区 → 返回成就 | 未触发 agent.spawn → 推 first_agent |
| Discovery 候选池为空 → null | 所有事件类型都触发过 |
| Discovery hidden 过滤 | hidden 不出现在 Discovery |
| Surprise 确定性选取 | 同一 sessionId 返回相同结果 |
| Surprise 候选池为空 → null | 无未解锁 hidden 时 |
| Surprise 返回字段验证 | name/null, hint 有值, icon="?" |
| `hashString()` 一致性 | 相同输入 → 相同输出 |
| 混合场景：3 类各不为空 / 部分为空 | 全部组合 |

### 8.2 集成测试

- MCP tool `achievement_suggest` 返回新格式 JSON
- CLI `agpa suggest` 三类分组输出
- Dashboard API `GET /api/data?include_recommend=true` 返回推荐数据

### 8.3 Dashboard 前端验证

- widget 渲染在 `position: fixed; bottom: 24px; right: 24px`
- 折叠态脉冲动画运行
- 点击展开面板
- 轮播自动切换（5s）
- 轮播暂停在 hover 时
- 关闭按钮收起面板
- 暗/亮主题下颜色正常
- 响应式：< 480px 时不遮挡内容

---

## 九、实施顺序（推荐）

```
Phase 1: 核心算法 + 类型
├── types.ts 新增 RecommendItem / RecommendResponse
├── progress-nudge.ts 扩展 3 种 type
├── recommend.ts 三个推荐函数 + hashString
└── tests/utils/recommend.test.ts

Phase 2: MCP + CLI
├── src/tools/suggest.ts 升级
├── src/cli/suggest.ts 升级 + 新 flag
└── 手动验证: agpa suggest + MCP 调用

Phase 3: Dashboard
├── api.ts 内嵌 recommend 到主响应
├── index.html widget DOM
├── styles.css widget + 动画
├── app.js 初始化 + 轮播
└── 浏览器验证: 暗/亮主题 + 响应式 + 交互
```

---

## 十、未来扩展（本期不做）

1. **Challenge（挑战推荐）** — 高稀缺度 + 30-80% 进度筛选
2. **推荐质量加权** — Discovery 和 Near Win 中考虑"最后一次触发距今时间"，越久越优先
3. **推荐历史去重** — 避免反复推荐同一个 Discovery（用户看了但不想试）
4. **轮播交互增强** — 点击帧内成就跳转到 Dashboard 成就列表并高亮
5. **Agent 主动推荐** — 在 poll 返回结果中嵌入推荐，Agent 在回复中自然提及
