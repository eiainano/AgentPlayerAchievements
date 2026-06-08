# 技术栈 + 时间维度成就设计

> 发布日期: 2026-06-07 | 状态: 草案

## 概要

为 AGPA 增加 12 个新成就，覆盖编程语言广度/深度、测试里程碑、会话维度三个方向。

- **成就增量**: 171 → **183** (+12)
- **新套装**: `linguist`（语言学者, 9 成员）
- **套装扩展**: `endurance` 5→7 (+2)
- **基础设施变更**: hook.ts 加语言自动检测 + 所有事件 payload 补 `hour` 字段
- **零基础设施变更**: 3 个成就（test_champion / the_scheduler / power_session）

---

## 1. 基础设施变更

### 1.1 hook.ts: 语言自动检测

**位置**: `src/cli/hook.ts` — `mapEvents()` 中处理 `Read`/`Write`/`Edit` 工具时

**行为**: 当检测到文件操作时，根据文件扩展名推断编程语言，发射 `file.language_used` 事件

```ts
// 在 Read/Write/Edit 的 payload 构建后
const language = detectLanguage(filePath);  // 文件扩展名→语言名
if (language) {
  results.push({
    event_type: 'file.language_used',
    payload: { ...base, language }
  });
}
```

**语言映射表**（覆盖 30+ 语言，保证所有新成就可达）：

| 扩展名 | 语言值 |
|--------|--------|
| `.ts`, `.tsx` | `typescript` |
| `.js`, `.jsx`, `.mjs` | `javascript` |
| `.py` | `python` |
| `.java` | `java` |
| `.c`, `.h` | `c` |
| `.cpp`, `.cc`, `.cxx`, `.hpp` | `cpp` |
| `.rs` | `rust` |
| `.go` | `go` |
| `.rb` | `ruby` |
| `.php` | `php` |
| `.swift` | `swift` |
| `.kt`, `.kts` | `kotlin` |
| `.cs` | `csharp` |
| `.scala` | `scala` |
| `.r`, `.R` | `r` |
| `.m` | `matlab` |
| `.lua` | `lua` |
| `.hs` | `haskell` |
| `.ex`, `.exs` | `elixir` |
| `.clj`, `.cljs` | `clojure` |
| `.zig` | `zig` |
| `.sol` | `solidity` |
| `.dart` | `dart` |
| `.sh`, `.bash` | `bash` |
| `.sql` | `sql` |
| `.yaml`, `.yml` | `yaml` |
| `.json` | `json` |
| `.md` | `markdown` |
| `.css`, `.scss` | `css` |
| `.html` | `html` |
| `.dockerfile`, `Dockerfile` | `dockerfile` |
| `.toml` | `toml` |

`detectLanguage()` 函数封装到独立模块 `src/utils/lang-detect.ts`（可测试，可扩展）。

### 1.2 hook.ts: 所有事件 payload 加 `hour`

**当前**: 只有 `git.push` 事件 payload 含 `hour` / `day_of_week`。

**变更**: 在 `base` 对象构建时注入：

```ts
const now = new Date();
base.hour = now.getHours();
base.day_of_week = now.getDay();
```

**影响**: 所有 hook 发射的事件均自动携带 `hour` / `day_of_week`。Evaluator 的 `matchFilter` 已可读取这两个字段，`distinct_count` 的 `getField()` 也能读到 `payload.hour`。零 evaluator 变更。

### 1.3 evaluator: matchFilter 上下文补 `language`

```ts
// matchFilter() ctx 新增:
language: event.payload?.language || '',
```

使基于 `filter: language == 'python'` 的条件判断可用。

---

## 2. 成就设计

### 2.1 新套装: `linguist`（语言学者）

9 成员 — 7 语言深度 + 2 语言广度。

#### 2.1.1 单语言里程碑（7 个）

统一条件模式：`counter file.language_used filter: language == 'X' >= 50 window: all`

所有语言深度成就共享同一"文件编辑 50 次"门槛。稀有度差异反映该语言在 AI 辅助编程中的使用频率（Common=最高频, Rare=较低频）。

| # | ID | 英文名 | 中文名 | Icon | 英文描述 | 中文描述 | 稀有度 |
|---|-----|--------|--------|------|----------|----------|--------|
| 1 | `pythonista` | Pythonista | Pythonista | 🐍 | Write 50+ Python files. Snake? No, Python. | 写了 50+ 个 Python 文件。是蟒蛇不是巨蟒。 | Common |
| 2 | `type_astronaut` | Type Astronaut | 类型宇航员 | 📘 | Write 50+ TypeScript files. Types are rocket fuel. | 写了 50+ 个 TypeScript 文件。类型就是火箭燃料。 | Common |
| 3 | `web_weaver` | Web Weaver | 网络织者 | 🕸️ | Write 50+ JavaScript files. Weaving the web since '95. | 写了 50+ 个 JavaScript 文件。95 年就开始织网。 | Common |
| 4 | `bean_counter` | Bean Counter | 咖啡豆计数员 | ☕ | Write 50+ Java files. Object my my my. | 写了 50+ 个 Java 文件。对象啊对象。 | Uncommon |
| 5 | `pointer_pilot` | Pointer Pilot | 指针领航员 | 🔗 | Write 50+ C or C++ files. Manual memory? manual fun. | 写了 50+ 个 C 或 C++ 文件。手动内存，手动乐趣。 | Rare |
| 6 | `ferris_fan` | Ferris Fan | 螃蟹粉丝 | 🦀 | Write 50+ Rust files. The borrow checker approves. | 写了 50+ 个 Rust 文件。借用检查器表示通过。 | Rare |
| 7 | `go_getter` | Go Getter | 进取者 | 🏃 | Write 50+ Go files. Simplicity is a feature. | 写了 50+ 个 Go 文件。简洁就是一种特性。 | Uncommon |

**设计决策**: 没有包含 C# / Swift / Kotlin / Ruby / PHP。它们虽然是 Top 10 语言，但在 AI 辅助编程场景中与已有 7 个相比使用频率有明显断层，以后可按需加入。

#### 2.1.2 语言广度（2 个）

| # | ID | 英文名 | 中文名 | Icon | 英文描述 | 中文描述 | 条件 | 稀有度 | 分类 |
|---|-----|--------|--------|------|----------|----------|------|--------|------|
| 8 | `smorgasbord` | Smorgasbord | 丰盛大餐 | 🧩 | Use 6+ languages in one session. All-you-can-code buffet. | 单次 session 用 6+ 种语言。编码自助餐。 | `distinct_count file.language_used field: language window: single_session >= 6` | Rare | challenge |
| 9 | `full_spectrum` | Full Spectrum | 全光谱 | 🌈 | Use 10+ languages cumulatively. True polyglot, no impostor. | 累计使用过 10+ 种语言。真多语言者。 | `distinct_count file.language_used field: language window: all >= 10` | Epic | milestones |

`smorgasbord` 是现有 `polyglot_challenge`（单 task 3+ 语言）的 session 级别增强版。`full_spectrum` 是 `polyglot`（5 种）的里程碑扩展。

### 2.2 测试里程碑（1 个）

| # | ID | 英文名 | 中文名 | Icon | 英文描述 | 中文描述 | 条件 | 稀有度 | 分类 | 套装 |
|---|-----|--------|--------|------|----------|----------|------|--------|------|------|
| 10 | `test_champion` | Test Champion | 测试冠军 | 🏆 | 500 tests passed. The CI pipeline worships you. | 累计 500 个测试通过。CI 流程视你为神。 | `counter test.pass >= 500 window: all` | Epic | milestones | endurance |

**为什么是这个阈值**: 已有 `test_centurion`（100 次，Rare），500 是合理的 Epic 扩展。Legendary/Mythic 级别（1000/5000）留白给 future。

### 2.3 时间维度（2 个）

| # | ID | 英文名 | 中文名 | Icon | 英文描述 | 中文描述 | 条件 | 稀有度 | 分类 | 套装 |
|---|-----|--------|--------|------|----------|----------|------|--------|------|------|
| 11 | `the_scheduler` | The Scheduler | 日程规划师 | 📅 | Start sessions at 12+ different hours. You're always there. | 在 12+ 个不同时间段启动过 session。你无处不在。 | `distinct_count session.start field: hour window: all >= 12` | Uncommon | style | — |
| 12 | `power_session` | Power Session | 全力冲刺 | ⚡ | 25+ tools in a single session. Full throttle. | 单次 session 中发起 25+ 次工具调用。马力全开。 | `counter tool.complete window: single_session >= 25` | Uncommon | endurance | endurance |

**the_scheduler 验证**: `field: hour` 依赖 hook.ts 基础设施变更 §1.2（所有事件 payload 加 `hour`）。加上后 evaluator 的 `getField()` 自动读 `payload.hour`，无需额外代码。

**power_session 验证**: 零基础设施变更。`tool.complete` + `single_session` 组合已在 `chain_reaction`（5+）和 `full_auto`（10+ consecutive）中使用。25 是量级扩展。

---

## 3. 与现有成就的差异化矩阵

审查了所有 171 个现有成就，以下 12 个全部通过"不重复"检查：

| 新成就 | 易混淆的现有成就 | 差异化 | 判定 |
|--------|------------------|--------|------|
| smorgasbord | polyglot_challenge (3+ 语言/single_task) | session 级 ≠ task 级；6+ ≠ 3+ | ✅ 明确不重复 |
| full_spectrum | polyglot (5+ 语言/all) | 10+ ≠ 5+；Epic ≠ Uncommon | ✅ 里程碑扩展 |
| pythonista | — | 无任何按语言过滤的单语言成就 | ✅ 全新维度 |
| type_astronaut | — | 同上 | ✅ |
| web_weaver | — | 同上 | ✅ |
| bean_counter | — | 同上 | ✅ |
| pointer_pilot | — | 同上 | ✅ |
| ferris_fan | — | 同上 | ✅ |
| go_getter | — | 同上 | ✅ |
| test_champion | test_centurion (100, Rare) | 500 ≠ 100；Epic ≠ Rare | ✅ 合理扩展 |
| the_scheduler | night_owl/early_bird/afternoon_tea | 时段广度 ≠ 单时段触发 | ✅ 不同条件类型 |
| power_session | chain_reaction (5, same) + full_auto (10, consecutive+same) | 25 ≠ 5；纯吞吐量 ≠ 连续 | ✅ 不同量级 |

---

## 4. 受影响文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/utils/lang-detect.ts` | **新建** | `detectLanguage(filePath)` 函数 + 语言映射表 |
| `src/cli/hook.ts` | 修改 | 检测文件扩展名时发射 `file.language_used` + `base` 加 `hour` |
| `src/engine/evaluator.ts` | 修改 | matchFilter ctx 补 `language` 字段 |
| `achievement-definitions.yaml` | 修改 | 新增 12 个成就定义 + `linguist` 套装 + `endurance` 扩展 |
| `src/cli/init.ts` | 修改 | AGENTS.md 注入文档更新（说明语言事件已 auto-track） |
| `tests/` | 新增/修改 | `lang-detect.test.ts`（映射表覆盖） + every-achievement.ts 新 12 条 + test 总数 |

---

## 5. 测试计划

| 测试范围 | 类型 | 数量 |
|---------|------|------|
| `lang-detect.test.ts` — 扩展名→语言映射全覆盖 | Unit | ~35 |
| `lang-detect.test.ts` — 无效/边界输入 | Unit | ~5 |
| `every-achievement.test.ts` — 12 新成就最小触发验证 | Integration | +12 |
| 总测试增量 | | ~52 |
| 预期总测试 | 519 → 571 | ✅ |

---

## 6. 实现顺序

1. **基础设施**: `src/utils/lang-detect.ts` → hook.ts 修改 → evaluator 补 `language`
2. **YAML 定义**: 7 语言深度 + 2 语言广度 + 3 其他
3. **测试**: lang-detect 映射表 → every-achievement 覆盖
4. **文档**: init.ts AGENTS.md 同步 + CHANGELOG

---

*本设计不涉及 Dashboard UI 变更、不涉及 state.json 格式变更、不涉及 evaluator 新增条件类型。*
