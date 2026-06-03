# `agpa activity` 终端活动面板设计

> 状态：📐 设计中 | 日期：2026-06-04

---

## 1. 设计目标

在终端中用 `agpa activity` 命令展示 streak 和热力图，复用 Dashboard 现有的计算逻辑，免浏览器查看。

输出：

```
$ agpa activity

🔥 编码连胜
   当前 7 天  |  最高 14 天  |  今天已活跃 ✓

📊 活动热力图（近 4 个月）
         May                    Jun
  一  ░░▒▒▓▓░░▓▓▓▓▓░░▓▓▓▓░░▓▓▓▓
  三  ░░▓▓▓▓░░▓▓▒▒░░▓▓▓▒░░▓▓▓▓▓
  五  ░░░░░░░▓▓▓▓░░▓▓▓░░▓▓░░░▓▓
  日  ░░░░░░░▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓
        Less  ░░▒▒▓▓▓▓▓▓  More
```

---

## 2. 架构决策：提取共享逻辑

### 问题

`calcStreak()` 和 `computeHeatmap()` 当前写在 `src/dashboard/api.ts` 中，CLI 无法直接复用（api.ts 依赖 dashboard 上下文）。

### 方案：提取到独立模块

```
当前：                         改为：
src/dashboard/api.ts           src/dashboard/api.ts
  ├── calcStreak()              ├── import { calcStreak, computeHeatmap } from '../utils/activity.js'
  └── computeHeatmap()          ├── 只做 Dashboard 特有的组装（buildApiResponse）
                                └── 不改其他任何调用方
                             
                                src/utils/activity.ts  ← 新建
                                  ├── StreakData, DayActivity, HeatmapData 类型定义
                                  ├── calcStreak(events) → StreakData
                                  └── computeHeatmap(events) → HeatmapData

                                src/cli/activity.ts  ← 新建
                                  ├── import { calcStreak, computeHeatmap } from '../utils/activity.js'
                                  ├── 读取 engine 的 event.log
                                  ├── 调用计算函数
                                  └── ANSI 终端渲染输出
```

**优势**：
- Dashboard API 和 CLI 共享同一套计算逻辑，不会出现结果不一致
- `api.ts` 只是删掉两个函数定义、改为 import，改动最小
- 类型定义移出 api.ts 后，StreakData / HeatmapData 成为独立的公共类型，不需要 dashboard 耦合

### 类型最终归属

| 类型 | 之前 | 之后 |
|------|------|------|
| `StreakData` | `api.ts` | `src/utils/activity.ts` |
| `DayActivity` | `api.ts` | `src/utils/activity.ts` |
| `HeatmapData` | `api.ts` | `src/utils/activity.ts` |
| `DashboardStats`（引用上述类型）| `api.ts` | `api.ts`（不变，import 即可）|

注意：`DashboardStats` 中 `streak: StreakData` 和 `heatmap: HeatmapData` 的类型引用路径不变——`api.ts` import 后 re-export，API 层消费者无感知。

---

## 3. `agpa activity` 命令规格

### 3.1 子命令

```
agpa activity             完整输出（streak + heatmap）
agpa activity --streak    仅 streak
agpa activity --heatmap   仅 heatmap
agpa activity --compact   紧凑模式：heatmap 单元格 1 字符宽（窄终端用）
```

### 3.2 Streak 输出

```
🔥 编码连胜
   当前 7 天  |  最高 14 天  |  今天已活跃 ✓
```

- `today_active: true` → 绿色 "今天已活跃 ✓"
- `today_active: false` → 灰色 "今天还没写代码"
- `current === 0`（无事件）→ "还没有数据，开始你的第一天！"

不依赖 ANSI 颜色，普通文本即可。

### 3.3 热力图输出

ANSI 24-bit 真彩色渲染。每个单元格 = 2 个字符宽的背景色块：

```
渲染原理：
  \x1b[48;2;R;G;Bm  \x1b[0m
  ├── 24-bit 背景色 ──┤├关闭格式┤
```

色阶映射：

| Level | 颜色 | ANSI RGB |
|-------|------|----------|
| 0 | 暗灰 | `48;2;30;30;40` |
| 1 | 浅绿 | `48;2;198;228;139` |
| 2 | 中绿 | `48;2;123;201;111` |
| 3 | 深绿 | `48;2;35;154;59` |
| 4 | 最深绿 | `48;2;25;111;45` |

**网格布局**（标准模式，2 字符/格）：

```
         May                    Jun
  一  ░░▒▒▓▓░░▓▓▓▓▓░░▓▓▓▓░░▓▓▓▓
  三  ░░▓▓▓▓░░▓▓▒▒░░▓▓▓▒░░▓▓▓▓▓
  五  ░░░░░░░▓▓▓▓░░▓▓▓░░▓▓░░░▓▓
  日  ░░░░░░░▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓
        Less  ░░▒▒▓▓▓▓▓▓  More
```

- 行标签：`一` `三` `五` `日`（周一/三/五/日），左侧对齐
- 列标签：月份缩写，对齐到每月第一周
- 底部图例：5 个色块 + Less/More

**紧凑模式**（`--compact`，1 字符/格）：

用 ANSI 背景色 + 单个空格 ` ` 代替 `  `：

```
       May               Jun
  一  ░▒▓░▓▓░░▓▓▓░░▓▓▓░▓▓▓
  三  ░▓▓▒░▓▒░▓▓░░▓▓▓░▓▓▓▓
  ...
```

单元格字符 `░`/`▒`/`▓` + 对应 ANSI 前景色（而非背景色），这样 1 字符也清晰可辨。

### 3.4 终端宽度自适应

启动时读取 `process.stdout.columns`：

| 宽度 | 行为 |
|------|------|
| ≥ 80 | 标准模式，2 字符/格，完整月份标签 |
| 60-79 | 自动 compact 模式，1 字符/格 |
| < 60 | 仅显示 streak，heatmap 提示 "终端太窄，请用 agpa activity --streak 或 Dashboard 查看热力图" |

---

## 4. 文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/utils/activity.ts` | **新建** | `StreakData`/`DayActivity`/`HeatmapData` 类型 + `calcStreak()` + `computeHeatmap()` |
| `src/dashboard/api.ts` | **修改** | 删除 `calcStreak()`/`computeHeatmap()` 定义和类型，改为从 `utils/activity.js` import |
| `src/cli/activity.ts` | **新建** | `agpa activity` 命令实现 |
| `src/cli/index.ts` | **修改** | `COMMANDS` 数组注册 activity |
| `tests/utils/activity.test.ts` | **新建** | calcStreak + computeHeatmap 单元测试 |

---

## 5. 实施顺序

```
1. 新建 src/utils/activity.ts — 从 api.ts 移动类型和函数
2. 修改 src/dashboard/api.ts — 删除原定义，改为 import
   验证：npm run build ✅ / npm run test ✅（确保 Dashboard 不受影响）
3. 新建 tests/utils/activity.test.ts — 单测
4. 新建 src/cli/activity.ts — CLI 渲染逻辑
5. 修改 src/cli/index.ts — 注册命令
6. 验证：npm run build + npm run test + 手动 agpa activity
```

---

## 6. 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 提取共享逻辑 vs 重复代码 | 提取到 `utils/activity.ts` | 保证 CLI 和 Dashboard 数据一致；改动面小 |
| 统一命令 vs 两个子命令 | 统一 `agpa activity` | streak 和 heatmap 是同一概念（活动面板），分开展示意义小于一起 |
| ANSI 24-bit 色 vs 256 色 | 24-bit | 几乎所有现代终端（iTerm2 / macOS Terminal / Windows Terminal）都支持，视觉效果好得多 |
| 2 字符/格 vs 1 字符 | 默认 2，窄终端自动降级 | 2 字符更接近 Dashboard 的方形格子视觉 |
| 紧凑模式字符 | `░▒▓█` 前景色 | 比纯背景色块 + 空格的 1 字符方案更有"块"感 |
