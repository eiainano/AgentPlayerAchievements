# Terminal UX Enhancement — ANSI Popup + Progress Nudge

> 设计文档，2026-06-05
>
> **范围：** 终端即时反馈体验升级（方案 B）
> **前提：** AGPA v0.1.6，166 成就，452 测试全绿

---

## 一、问题陈述

当前成就解锁的终端反馈仅依赖 OS 桌面通知 + 纯文本 stdout fallback。缺失两种关键体验：

1. **解锁爽感** — 没有彩色、卡片化的 ANSI 弹窗，纯文本行不够"游戏化"
2. **持续动力** — 用户不知道离下一个成就还有多远，解锁后缺乏"下一个目标"

## 二、架构

新增 2 个纯函数模块，修改 1 个集成点。不改变 poll 时机，不改变事件数据流。

```
                        Stop hook 触发
                             │
                  hook.ts cmdPoll()
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                 ▼
     ENGINE.poll()    renderPopup()     findNearUnlocks()
      (不变)          ansi-popup.ts     progress-nudge.ts
                            │                 │
                            ▼                 ▼
                        stdout            stdout
                   ANSI 彩色卡片      近锁成就列表
```

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/utils/ansi-popup.ts` | ANSI 弹窗渲染 — Unicode 框线 + 稀有度着色 + 进度条 |
| `src/utils/progress-nudge.ts` | 近锁成就计算 — 对未解锁成就算完成度，取 top 3 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/cli/hook.ts` `cmdPoll()` | OS 通知后 → ANSI popup → progress nudge 输出 |

### 设计约束

- 两个新模块都是**纯函数**：输入数据，输出字符串/对象数组。不读文件，不调引擎
- `process.stdout.isTTY === false` 时跳过 ANSI 渲染，返回空字符串（fallback 到当前 `[AGPA] poll:` 纯文本行）
- 不新增 npm 依赖
- ESM only

---

## 三、`ansi-popup.ts` — ANSI 弹窗渲染器

### API

```typescript
interface PopupAchievement {
  icon: string;          // emoji or icon tag
  name: string;          // localized name
  description: string;   // localized description
  rarity: string;        // common | uncommon | rare | epic | legendary | mythic
  category?: string;
  set_name?: string;
  set_progress?: string; // e.g. "1/4"
  progress?: { current: number; max: number };
}

function renderPopup(achievements: PopupAchievement[]): string;
// Returns ANSI-decorated multiline string.
// If !process.stdout.isTTY, returns "".
// Caps at 5 achievements to prevent terminal flooding.
```

### ANSI 配色映射

从 Dashboard CSS 变量提取，映射到 ANSI 256 色：

| 稀有度 | Hex | ANSI 256 | CSS Variable |
|--------|-----|----------|-------------|
| Common | #7eb8da | 110 | `--rarity-common` |
| Uncommon | #3b7ec0 | 32 | `--rarity-uncommon` |
| Rare | #e0b020 | 178 | `--rarity-rare` |
| Epic | #e87830 | 172 | `--rarity-epic` |
| Legendary | #a858f0 | 135 | `--rarity-legendary` |
| Mythic | #f04050 | 197 | `--rarity-mythic` |

### 渲染元素

- **边框：** Unicode box-drawing (light: `─│┌┐└┘`)，按稀有度着色
- **标题行：** icon + "Achievement Unlocked!"（en）/ "成就解锁！"（zh），粗体白色
- **成就名：** 稀有度着色、粗体
- **描述：** 普通白色，最多 2 行（超长截断加 `…`）
- **稀有度行：** 灰色 `Rarity:` + 稀有度标签（稀有度着色） + 可选 `· Cat:` + 可选 `· Set: X`
- **进度条：** 仅 `progress_trackable` 成就渲染，`current/target` 填充 + 百分比

### 输出示例（English）

```
  ┌──────────────────────────────────────────────┐
  │  🏆  Achievement Unlocked!                   │
  │                                              │
  │  "Code Talker"                               │
  │  Prompt 中包含代码块的次数达标。              │
  │                                              │
  │  Rarity: Uncommon · Cat: style               │
  └──────────────────────────────────────────────┘
```

多成就之间空一行分隔。超过 5 个时，前 4 个完整渲染 + "… and N more" 汇总行。

### 边界情况

- **空列表：** 返回 ""
- **无 set：** 不渲染 `· Set:` 部分
- **无 category：** 不渲染 `· Cat:` 部分
- **描述超长（> 120 chars）：** 截断至 117 chars + `...`
- **名超长（> 50 chars）：** 截断至 47 chars + `...`

---

## 四、`progress-nudge.ts` — 进度感知

### API

```typescript
interface NearUnlock {
  achievement_id: string;
  name: string;            // localized
  icon: string;
  rarity: string;
  current: number;
  target: number;
  unit_label: string;      // e.g. "tasks", "days", "tools", "cycles"
}

function findNearUnlocks(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
  options?: { maxResults?: number; minProgress?: number }
): NearUnlock[];
```

### 支持的进度计算

| 条件类型 | 计算方式 | unit_label |
|----------|---------|-----------|
| `counter` | 计数事件数 / `count`（含 `same_target`/`window` 过滤） | 从 `field` 或事件类型推断 |
| `threshold` (metric) | `evaluateMetric(expr, events)` / `value` | 从 metric expr 推断 |
| `streak` | 当前连续天数 / `value` | "days" |
| `distinct_count` | 去重计数（含 `values` 过滤） / `count` | 从 `field` 推断 |
| `sequence_count` | 序列计数 / `count` | "cycles" |
| `set_completion` | `state.unlocked` 中已有成员数 / set 总人数 | "完成" |

**不支持的**（跳过，不在进度结果中）：
- `sequence` — 阶段逻辑太复杂
- `event` — 布尔型，无中间进度
- `mode` — 统计型
- `pattern_match` — 匹配型
- `ratio` — 比率型

### 过滤规则

1. **仅未解锁** — 已解锁的不提示
2. **仅 progress_trackable 或 counter/threshold/streak/distinct_count** — 这些天然有"进度"概念。`sequence_count`/`set_completion` 选择性支持
3. **排除 hidden** — 不剧透彩蛋成就
4. **排除 future: true** — 不提示不可达成就
5. **`minProgress` 默认 0.2 (20%)** — 过滤掉"1/1000"这种离解锁太远的
6. **最多返回 3 条**（`maxResults` 默认 3）
7. **排序：进度降序**（最接近解锁的排最前面）

### 输出示例

```
  ⚡ Getting close:
   ◦   Century — 73/100 tasks (73%)
   ◦   Dual Wielder  — 2/3 tool types (67%)
   ◦   Streak 7  — 5/7 days (71%)
```

### 边界情况

- **没有近锁成就：** 输出空字符串，不显示 "⚡ Getting close:" 标题
- **全部已解锁：** 空
- **events 为空（新用户）：** 所有 counter 进度为 0，minProgress 过滤掉，返回 ""
- **Non-TTY：** 返回 []

---

## 五、`hook.ts` 集成改动

修改 `cmdPoll()` 函数（`src/cli/hook.ts:384-415`）：

```typescript
function cmdPoll(): void {
  ENGINE.init();

  const newlyUnlocked = ENGINE.poll();

  // ... 现有通知逻辑不变 ...

  // ── ANSI popup (TTY only) ──
  if (newlyUnlocked.length > 0) {
    const popupData: PopupAchievement[] = newlyUnlocked.map(ach => ({
      icon: ach.icon || '🏆',
      name: useZh ? (ach.name_cn || ach.name) : ach.name,
      description: useZh ? (ach.description_cn || ach.description) : ach.description,
      rarity: ach.rarity,
      category: ach.category,
      set_name: ach.set_name,
      progress: ach.progress_trackable ? { current: ach.current, max: ach.target } : undefined,
    }));
    const popup = renderPopup(popupData);
    if (popup) process.stdout.write(popup + '\n');
  }

  // ── Progress nudge (TTY only) ──
  const near = findNearUnlocks(ENGINE.definitions, ENGINE.events, ENGINE.state);
  if (near.length > 0) {
    const lines = [colorize('  ⚡ Getting close:', '33')]; // 33 = ANSI yellow
    for (const n of near) {
      const pct = Math.round((n.current / n.target) * 100);
      lines.push(colorize(`   ◦ ${n.icon}  ${n.name} — ${n.current}/${n.target} ${n.unit_label} (${pct}%)`, '37'));
    }
    process.stdout.write('\n' + lines.join('\n') + '\n');
  }
}
```

改动量：`cmdPoll()` 增加约 25 行。

---

## 六、测试策略

两个新模块是纯函数，测试不需要引擎实例或磁盘 I/O。

### `ansi-popup.test.ts` (~12 tests)

1. TTY=true: 单成就渲染包含所有元素
2. TTY=true: 3 成就并列（空行分隔）
3. TTY=true: 6 成就 → 5 张卡片 + summary
4. TTY=true: Mythic 稀有度使用 197 色
5. TTY=true: Common 稀有度使用 110 色
6. TTY=true: 含进度条的成就
7. TTY=true: 无 set/category 字段 → 不渲染对应部分
8. TTY=true: 描述超长截断
9. TTY=true: 名称超长截断
10. TTY=false: 返回 ""
11. 空数组 → ""
12. 正确性：输出不包含 ANSI reset 之外的裸转义序列

### `progress-nudge.test.ts` (~15 tests)

1. 空 events → 空结果
2. counter 成就 70/100 → 返回一条
3. counter: same_target → 正确过滤计数
4. threshold(metric) → 正确计算 metric
5. streak: 5/7 连续天 → 返回正确进度
6. distinct_count → 正确去重计数
7. 多个成就按完成度降序
8. hidden 成就被排除
9. future:true 被排除
10. 低于 minProgress (20%) 的成就被过滤
11. maxResults=3 截断
12. set_completion: 3/8 members → 进度 37%
13. sequence/event/pattern_match/ratio 类型跳过
14. 已解锁成就被排除
15. 全部已解锁 → 空数组

---

## 七、Affected Files Summary

| 文件 | 操作 | 估计新增行 |
|------|------|-----------|
| `src/utils/ansi-popup.ts` | 新建 | ~100 |
| `src/utils/progress-nudge.ts` | 新建 | ~110 |
| `src/cli/hook.ts` `cmdPoll()` | 修改 | ~25 |
| `src/engine/evaluator.ts` | 修改 | ~1（`evaluateMetric` 改为 export） |
| `tests/utils/ansi-popup.test.ts` | 新建 | ~80 |
| `tests/utils/progress-nudge.test.ts` | 新建 | ~120 |
| **总计** | | **~436 行** |

### 不修改的

- `src/engine/engine.ts` — `poll()` 不变
- `src/utils/notify.ts` — OS 通知机制不变
- `src/cli/init.ts` — hook 配置不变
- Dashboard 文件
- YAML 定义

## 八、后续跟进（不做本次）

- 稀有度差异化动画：Mythic/Legendary 双行边框、渐变着色
- Combo 检测：单次 poll 解锁 3+ 成就触发特殊效果
- SessionStart hook 开场进度欢迎
- 终端 bell 字符 `\x07` 解锁提示（macOS Terminal 铃铛）
