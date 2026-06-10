# AGPA Questline 系统设计方案

> 日期：2026-06-11
> 状态：📐 设计确认
> 基于：`docs/top10-next-todos-2026-06-10.md` #2 Questline / 成就旅程线

---

## 一、目标

把 203 个成就从"大型目录"组织成 **5 条 RPG 成长路径**，每条线有 3 个阶段（开始→中段→终章），终点给更强感知的奖励（专属标题）。

### 与现有 Set 的关系

| | Set（套装） | Questline（旅程线） |
|------|------|------|
| 成就关系 | 同一主题，无序收集 | **有序分段，渐进式** |
| 用户感知 | "我收集了几个" | "我走到了第几步" |
| Dashboard | 网格卡片 | **横向进度条 + 阶段里程碑** |
| 一个成就 | 属于一个 set | 可以出现在多条 questline 中 |

---

## 二、YAML 新区块

在 `achievement-definitions.yaml` 末尾新增 `questlines:` 区块。

### 类型定义

```typescript
// src/engine/types.ts 新增
interface StageDefinition {
  stage: number;          // 1, 2, 3
  name: string;
  name_cn: string;
  achievements: string[]; // achievement IDs (可引用任意成就, 可跨 set)
}

interface QuestlineDefinition {
  id: string;
  name: string;
  name_cn: string;
  icon: string;
  description: string;
  description_cn: string;
  stages: StageDefinition[];
  reward: SetReward;      // type: title, 复用已有 reward 结构
}
```

### YAML 示例

```yaml
questlines:
  - id: bug_hunter
    name: "Bug Hunter"
    name_cn: "除虫大师"
    icon: "🐛"
    description: "From your first bug to debugging mastery"
    description_cn: "从第一只 bug 到调试艺术的掌控者"
    reward:
      type: title
      value: "Elite Bug Hunter"
      value_cn: "精英除虫师"
    stages:
      - stage: 1
        name: "Rookie Exterminator"
        name_cn: "实习除虫员"
        achievements: [first_error, error_resilient, diagnostic_detective]
      - stage: 2
        name: "Seasoned Hunter"
        name_cn: "老练猎手"
        achievements: [bug_squasher, self_healer, sisyphus, mitosis]
      - stage: 3
        name: "Debugging Legend"
        name_cn: "调试传说"
        achievements: [surgeon, the_all_nighter, iterative_refiner]
```

### 5 条旅程线

| ID | 中文名 | 成就来源 | ~成就数 |
|------|------|------|:--:|
| `bug_hunter` | 除虫大师 | bug_catcher + endurance 部分 | 10 |
| `toolsmith` | 工具匠人 | tool_connoisseur + agent_commander 部分 | 10 |
| `builder` | 建造大师 | creators_forge + git_flow 部分 | 11 |
| `night_shift` | 夜行者 | endurance + polar_night | 9 |
| `polyglot` | 语言通才 | linguist | 9 |

**总计：~49 个成就被覆盖（占 203 的 24%）**。部分成就同时出现在多条线（如 `marathon` 既属 builder 也属 night_shift），通过多归属减少硬拆分感。

---

## 三、代码改动

### 解析链

```
YAML questlines: 区块
  ↓ parser
engine.questlineDefinitions: QuestlineDefinition[]
  ↓ Dashboard API
/api/data 返回 questlines: QuestlineItem[]
  ↓ 前端渲染
<questline-card> 组件
```

### 文件清单

| 文件 | 改动 | 内容 |
|------|:--:|------|
| `src/engine/types.ts` | 改 | 新增 `StageDefinition`, `QuestlineDefinition` |
| `src/engine/yaml-parser.ts` | 改 | `parseYAML()` 解析 `questlines` 新区块 |
| `src/engine/engine.ts` | 改 | 新增 `questlineDefinitions` 字段 + init 注入 |
| `src/dashboard/api.ts` | 改 | 新增 `buildQuestlinesResponse()` |
| `src/dashboard/public/index.html` | 改 | 新 nav tab "旅程" (Achievements 和 Sets 之间) + section 容器 |
| `src/dashboard/public/app.js` | 改 | 新增 `renderQuestlines()` 渲染逻辑 + i18n |
| `src/dashboard/public/styles.css` | 改 | 旅程线卡片样式 (~80 行) |
| `achievement-definitions.yaml` | 改 | 新增 `questlines:` 区块 (~300 行) |
| `tests/engine/yaml-parser.test.ts` | 改 | 验证 questlines 解析 |
| `tests/dashboard/api.test.ts` | 改 | 验证 questlines 响应构建 |

### 不改的文件

- `src/engine/evaluator.ts` — questline 进度 = 纯 state.unlocked 查询
- `src/engine/store.ts` — 无新持久化
- `src/tools/*.ts` — MCP 工具不需要 questline 数据（本期）

---

## 四、Dashboard UI

### 位置

Nav tab 顺序：个人主页 → 成就 → **旅程** → 套装 → 时间线 → 洞察

### 每条旅程线渲染

一条横向卡片，分为三区域：

```
┌──────────────────────────────────────────────────────────┐
│ 🐛 除虫大师              阶段 2: 老练猎手      4/10 ████░░ │
│     从第一只 bug 到调试艺术的掌控者                         │
└──────────────────────────────────────────────────────────┘
```

- 左：icon + 名称 + 描述
- 右：当前阶段名 + 进度（已解锁数/总数 + 微型进度条）
- 每 card 点击展开 → 显示 3 个 stage 的详细列表，每 stage 列出各自成就（小图标 + 名称 + ✓/○ 状态）
- 全部 3 stage 完成 → card 边框从 `var(--border)` 变为金色 `var(--gold)` + 显示奖励 title

### 整体布局

```html
<section id="questlines" class="section">
  <h2 data-i18n="section_questlines">旅程</h2>
  <p class="section-desc" data-i18n="questlines_desc">你的成长之路</p>
  <div class="questlines-stack" id="questlines-stack">
    <!-- 5 条 questline card -->
  </div>
</section>
```

5 条线垂直排列，`gap: 12px`。展开态：card 高度扩展，显示 3 个 stage 的成就网格。

### i18n

| key | EN | ZH |
|------|------|------|
| `nav_questlines` | Quests | 旅程 |
| `section_questlines` | Questlines | 旅程 |
| `questlines_desc` | Your growth path | 你的成长之路 |
| `questlines_stage` | Stage | 第 阶段 |
| `questlines_reward` | Reward | 奖励 |
| `questlines_complete` | Complete! | 全部完成！ |

---

## 五、算法

### 进度计算（纯查询，位于 `buildQuestlinesResponse()`）

```
for each questline:
  total = 0, unlocked = 0
  for each stage:
    for each achievement_id:
      total++
      if state.unlocked[id] → unlocked++
  currentStage = 第一个未全部完成的 stage 编号 (1-indexed)
  allDone = (unlocked === total)

questlineItem = {
  questline + stages 元数据
  unlocked_count, total_count,
  current_stage,        // 当前所在阶段编号（已全部完成进入下一个）
  current_stage_name,   // 本地化阶段名
  completed: allDone,
  reward_earned: allDone,
}
```

### 排序

5 条线按 `unlocked_count / total_count` 降序排列（完成度高的在前），把用户自然注意力引向"快完成"的路线上。

---

## 六、实施顺序

```
Phase 1: YAML 数据 + 解析
├── 手写 5 条 questline 的 YAML (~300 行)
├── types.ts 新增 StageDefinition / QuestlineDefinition
├── yaml-parser.ts 解析 questlines
├── engine.ts 新增 questlineDefinitions 字段
└── tests: yaml-parser 解析验证

Phase 2: Dashboard API + 前端
├── api.ts: buildQuestlinesResponse()
├── index.html: nav tab + section 容器
├── app.js: renderQuestlines() + i18n
├── styles.css: questline card 样式
└── tests: api 响应验证

Phase 3: 验证
├── 全量测试
├── Dashboard 浏览器验证
└── CHANGELOG
```

---

## 七、不在本期范围

- ❌ Questline 完成后的 profile flair（留到 TODO #5 套装视觉奖励一起做）
- ❌ 完成分享海报（留到 TODO #9 分享叙事化）
- ❌ Questline 到 MCP 工具的暴露（本期只 Dashboard 可见）
- ❌ skill-tree 式的连线依赖（每线 3 stage 线性即可，不做分支）
