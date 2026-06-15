# 中英文描述一致性审计报告

> 审计日期: 2026-06-16 | 审计方法: LLM 逐对比对 (11 批并行, 213 成就全量) | 结论: 0 个真正矛盾 (Mismatch)

---

## 总体数据

| 判定 | 数量 | 占比 |
|:----:|:----:|:----:|
| ✅ **Match** — 意思完全一致 | 159 | 74.6% |
| ⚠️ **Minor** — 有偏差但核心含义一致 | 54 | 25.4% |
| ❌ **Mismatch** — 说的不是同一件事 | **0** | **0%** |

**好消息**：没有一个成就是中英文"说的完全两码事"。所有 54 个 Minor 问题都在"细节偏差"范围内。

---

## 问题分类

Minor 问题分为 **4 类**：

| 类别 | 数量 | 严重度 |
|:----:|:----:|:------:|
| **A — 趣味尾巴漏译** | 36 | ⭐ 低（只缺一句俏皮话） |
| **B — 语义准确度偏差** | 14 | ⭐⭐⭐ 中（确实改进了翻译） |
| **C — 文化本地化差异** | 2 | 无评级（有意为之，对等选择） |
| **D — 双语对齐问题** | 2 | ⭐⭐ 中低（需双向对齐） |

---

## A 类：趣味尾巴漏译（36 个）

英文描述的末尾常有一句调皮的 tagline / punchline / 绰号，中文只翻译了事实部分，丢掉了这句趣味文案。

### A1 — 语言系列成就（13 个）

整批翻译缺了绰号。原文是 "Edit Python files. Snake charmer."，中文只留下 "编辑了 Python 文件。"。

| 成就 | 英文 Tagline | 缺失 | 建议修复 |
|------|:------------:|:----:|----------|
| `pythonista` | Snake charmer. | ✅ | 耍蛇人。 |
| `type_astronaut` | Type astronaut. | ✅ | 类型宇航员。 |
| `web_weaver` | Web weaver. | ✅ | 网络织者。 |
| `bean_counter` | Bean counter. | ✅ | 咖啡豆计数员。 |
| `pointer_pilot` | Pointer pilot. | ✅ | 指针领航员。 |
| `ferris_fan` | Ferris Fan. | ✅ | 螃蟹粉丝。 |
| `go_getter` | Go getter. | ✅ | 进取者。 |
| `smorgasbord` | Polyglot. | ✅ | 多语言者。 |
| `full_spectrum` | Full spectrum programmer. | ✅ | 全光谱程序员。 |
| `deep_reader` | Student of the codebase. | ✅ | 代码库的好学生。 |
| `code_junkie` | You devour code. | ✅ | 你在吞噬代码。 |
| `stack_trace` | Debugging is a sport. | ✅ | 调试也是一种运动。 |
| `on_a_roll` | Smooth sailing. | ✅ | 顺风顺水。 |

> 注：`pythonista`、`bean_counter` 的英文本身是双关/文化梗，中文 tagline 可以做本地化适配而非直译。

### A2 — Web/网络系列（5 个）

| 成就 | 英文 Tagline | 缺失 | 建议修复 |
|------|:------------:|:----:|----------|
| `web_surfer` | Browse away. | ✅ | 尽情浏览。 |
| `web_hoarder` | Data hoarder. | ✅ | 数据囤积者。 |
| `extreme_hoarder` | Extreme data hoarding. | ✅ | 极端数据囤积。 |
| `librarian` | Read all about it. | ✅ | 读了再说。 |
| `phone_home` | No, E.T., you stay. | ✅ | 不，E.T.，你待着。 |

### A3 — Git/工作流系列（6 个）

| 成就 | 英文 Tagline | 缺失 | 建议修复 |
|------|:------------:|:----:|----------|
| `workflow` | Ship it! | ✅ | 发车！ |
| `contributor` | Open source is in your blood. | ✅ | 你的血液里流着开源基因。 |
| `version_voyager` | Version control tourism. | ✅ | 版本控制观光客。 |
| `git_flow` | You've seen some things. | ✅ | 你也算见过世面了。 |
| `night_owl` | Who needs sleep? | ✅ | 谁需要睡眠？ |
| `marathon` | Call the endurance team. | ✅ | 叫耐力队来。 |

### A4 — Agent/工具系列（5 个）

| 成就 | 英文 Tagline | 缺失 | 建议修复 |
|------|:------------:|:----:|----------|
| `craftsman` | Digital sculptor. | ✅ | 数字雕刻师。 |
| `sprinter` | Speed demon. | ✅ | 速度恶魔。 |
| `power_session` | Peak productivity. | ✅ | 巅峰效率。 |
| `the_scheduler` | Full calendar. | ✅ | 日程满档。 |
| `mcp_bridge` | The bridge is well-trodden. | ✅ | 桥梁已被踏遍。 |

### A5 — 图片/其他系列（4 个）

| 成就 | 英文 Tagline | 缺失 | 建议修复 |
|------|:------------:|:----:|----------|
| `image_whisperer` | Visual communication. | ✅ | 视觉沟通。 |
| `multi_image_day` | Scraping the web… | ✅ | 一张截图一个网页，效率拉满。 |
| `agent_hotswap` | A diverse toolkit. | ✅ | 多样化工具箱。 |
| `multitasker` | Juggling sessions. | ✅ | 穿梭于 session 之间。 |

### A6 — 其他零散缺漏（3 个）

| 成就 | 英文 Tagline | 缺失 | 建议修复 |
|:----:|:------------:|:----:|:----------|
| `pixel_pioneer` | Freedom. | ✅ | 自由。 |
| `talk_my_way_out` | Smooth talker. | ✅ | 巧舌如簧。 |
| `road_warrior` | No days off. | ✅ | 全年无休。 |
| `weekend_warrior` | Dedication. | ✅ | 勤奋。 |
| `golden_hour` | Full day coverage. | ✅ | 全天覆盖。 |

---

## B 类：语义准确度偏差（14 个）

这些是真正可以改进翻译质量的问题。

### B1 — 语义色彩/语境错误（3 个）

| 成就 | 问题 |
|------|------|
| **`caffeinated`** | ⚠️ 英文"Caffeinated"是**积极/游戏感**的（咖啡因加满、精力充沛），中文"咖啡因过量"是**负面/医学**语境。建议：→ "咖啡因上头。" |
| **`infinite_details`** | ⚠️ 英文说"novella"（中篇小说，~2-5 万字），中文说"一本书"（长篇书）。量级不符。建议：中文改为"够写一本中篇小说了"或英文改为"a book"。 |
| **`dedication`** | ⚠️ "Consistency is key"（一致性才是关键）≠ "坚持就是胜利"（Persistence is victory）。两个不同的含义。建议：中文改为"坚持是关键。" |

### B2 — 隐喻偏移（2 个）

| 成就 | 问题 |
|------|------|
| **`mythic_completionist`** | 英文"Every piece fits"用**拼图严丝合缝**隐喻，中文"一切尽在掌握"是**掌控感**——两个不同的画面。建议：→ "每块都严丝合缝。" |
| **`power_hour`** | 英文"Power overwhelming"是 **StarCraft 作弊码**游戏梗，中文"超频模式"是硬件术语。可接受但风格变了。建议：考虑"力量碾压。" |

### B3 — 信息遗漏/增补（4 个）

| 成就 | 问题 |
|------|------|
| **`streak_7`** | 中文整句遗漏 "A full week of agent-assisted development." |
| **`showcase_curator`** | 英文指定 "slot(s)"（展示柜**插槽**），中文只说"展示柜"（整个柜子）。 |
| **`multitasker`** | 英文有 "at least once"（时间限定），中文没有。 |
| **`streak_3`** | 中文**额外加了**"比 7 天更近，比明天更远"——英文没有这半句。需要双向同步或删除。 |

### B4 — 概念错位（3 个）

| 成就 | 问题 |
|------|------|
| **`marathon`** | 英文 "Maintained"（保持持续）与中文 "连续"（consecutive）有细微差别——前者是单次持续，后者暗示多次连续。 |
| **`skill_adept`** | 英文 "More skills, less worries — the master of all trades" 有"less worries"部分，中文"技多不压身"只覆盖了"多技能"这一面。 |
| **`wake_up_samurai`** | 英文 "9pm to midnight"（21:00-00:00 编码），中文"深夜码到 9 点后"（编码到 9 点后）。时间段不一致。建议：统一为一套时间。 |
| **`worktree_trial`** | 英文"worktree isolation"（隔离），中文"worktree 模式工作"（模式）。概念侧重点不同。建议：→ "使用了 worktree 隔离模式工作。" |

### B5 — 对齐模糊（2 个）

| 成就 | 问题 |
|------|------|
| **`completionist`** | 英文"completion milestones"（完成度里程碑），中文"全收集里程碑成就"——"全收集"比英文更具体。"Completion"更宽泛。建议二选一。 |
| **`clone_wars`** | 英文"2+ agents"（数 agent 实例数），中文"同一 type spawn 2 次以上"（数 spawn 次数）。计数维度不同。建议对齐。 |

---

## C 类：文化本地化差异（2 个，有意为之）

不是 bug，而是本地化团队做的创造性适配——但如果在意跨语言一致性可以统一。

| 成就 | 差异 | 建议 |
|------|:----:|------|
| **`fifth_element`** | 英文说希腊四元素（地水火风），中文说"五行齐聚"（中国五行体系）。四元素 vs 五行——两个不同文化体系。 | 二选一：中文改"四元素齐聚"或英文改"five Chinese elements"。 |
| **`bean_counter`** | 英文"Object my my my"（Java 的 `Object` + "Oh my my my"歌词梗），中文"对象啊对象"（对象 = 编程对象 / 恋爱对象的双关）。 | 各自都是优秀的本地化梗，可选择保留现状。 |

---

## D 类：双语对齐问题（2 个）

中英文描述各自说了不同的细节——需要决定哪边是对的，然后让另一边跟上。

| 成就 | 英文 | 中文 | 问题 |
|------|:----:|:----:|------|
| **`universal`** | all **major** supported tools | 所有支持的 Agent 工具 | 英文有"major"中文无，中文加了"Agent"英文无，且缺"通用型 agent。" |
| **`octopus`** | 3+ different **tools** | 3+ 种不同 **Agent** 工具 | 中文多加了"Agent"限定，比英文窄。英文无 "Versatile。" 中文也无。 |

---

## 综合建议优先级

| 优先级 | 范围 | 工作量 | 建议 |
|:------:|:----:|:------:|------|
| **🔥 P0** | B1 + B4 语义错误 | 7 个文件修改 | 语义色彩/概念错位的真正 bug：`caffeinated`、`infinite_details`、`dedication`、`marathon`、`worktree_trial`、`wake_up_samurai`、`streak_7` |
| **P1** | B2 + B3 + B5 偏差 | 8 个文件修改 | 隐喻偏移/信息遗漏：`power_hour`、`mythic_completionist`、`showcase_curator`、`multitasker`、`streak_3`、`skill_adept`、`completionist`、`clone_wars` |
| **P2** | D 类对齐 | 2 个文件修改 | 双向对齐：`universal`、`octopus` |
| **P3** | A 类趣味尾巴 | 36 个文件修改 | 最大批量但最安全——每处只是加一句 tagline。可用脚本批量处理。 |
| **N/A** | C 类本地化 | 2 个（决策） | 需要决定跨语言统一还是要创意本地化。 |

## 方法论

- **工具**: 11 个 LLM 子代理并行处理，每批 20 个成就
- **标准**: 只对比 `description`（EN）和 `description_cn`（CN），忽略 `name`/`name_cn`/`tip`/`tip_cn`
- **判定标准**:
  - `match` — 核心含义一致，语言差异不影响理解
  - `minor` — 有细节偏差但**不导致误解**
  - `mismatch` — 完全不同的含义（本报告为 0）
- **数据源**: `achievement-definitions.yaml`（213 个定义）
