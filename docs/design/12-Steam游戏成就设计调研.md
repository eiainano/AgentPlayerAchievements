# Steam 开放世界 & 策略类游戏成就设计调研

> 调研时间: 2026-05-31
> 目的: 研究 Steam 上过去 10 年销量最高的开放世界和策略游戏的成就系统设计，提炼可借鉴的模式与原则，为 AGPA 的成就扩展提供参考。

---

## 一、调研范围

选取 **2015–2025 年间** Steam 平台销量/活跃度最高的 **21 款**开放世界和策略游戏：

### 开放世界（13 款）
| 游戏 | 开发商 | Steam 上线 | 成就数 | 核心设计特征 |
|------|--------|-----------|--------|------------|
| Grand Theft Auto V | Rockstar | 2015 | 43 | 沙盒 + 探索 + 收集 |
| The Witcher 3 | CD Projekt Red | 2015 | 78 | 任务 + 战斗 + 卡牌 |
| Fallout 4 | Bethesda | 2015 | 50 | 建造 + 阵营 + 探索 |
| Skyrim SE | Bethesda | 2016 | 75 | 公会 + 任务 + 技能 |
| Monster Hunter: World | Capcom | 2018 | 100 | 狩猎 + 装备 + 收集 |
| Red Dead Redemption 2 | Rockstar | 2019 | 51 | 叙事 + 探索 + 博物 |
| Cyberpunk 2077 | CD Projekt Red | 2020 | 44 | 任务 + 战斗 + 驾驶 |
| Horizon Zero Dawn | Guerrilla | 2020 | 56 | 狩猎机器 + 探索 |
| Elden Ring | FromSoftware | 2022 | 42 | BOSS + 收集 + 结局 |
| Hogwarts Legacy | Avalanche | 2023 | 46 | 魔法 + 收集 + 探索 |
| Baldur's Gate 3 | Larian | 2023 | 54 | CRPG + 抉择 + 同伴 |
| Palworld | Pocketpair | 2024 | 10 | 收集 + 建造 + BOSS |
| Black Myth: Wukong | Game Science | 2024 | 81 | BOSS + 收集 + 变 |

### 策略类（8 款）
| 游戏 | 开发商 | Steam 上线 | 成就数 | 核心设计特征 |
|------|--------|-----------|--------|------------|
| Cities: Skylines | Colossal Order | 2015 | 127 | 城建 + 管理 + DLC |
| Civilization VI | Firaxis | 2016 | ~320 | 文明 + 胜利条件 + DLC |
| Stellaris | Paradox | 2016 | ~211 | 4X + 事件 + DLC |
| Hearts of Iron IV | Paradox | 2016 | ~273 | 二战 + 历史 + DLC |
| Crusader Kings III | Paradox | 2020 | 127 | 角色扮演 + 继承 + DLC |
| Factorio | Wube | 2020 | 88 | 自动化 + 量产 + 挑战 |
| RimWorld | Ludeon | 2018 | ~50 | 殖民模拟 + 叙事 |
| Total War: WARHAMMER III | Creative Assembly | 2022 | ~150 | 战役 + 战斗 + 派系 |

> 成就数包含 DLC 扩展。Paradox 系游戏因持续更新，成就是所有 DLC 累计。

---

## 二、开放世界游戏成就设计模式

### 2.1 叙事驱动型成就

**模式：** 推进主线剧情自动解锁的成就，通常是顺路解锁（unmissable）。

| 游戏 | 例子 | 比例 |
|------|------|------|
| Cyberpunk 2077 | "The Fool" (完成序章)、"The World" (通关任意结局) | ~14% (6/44) |
| The Witcher 3 | "Lilac and Gooseberries" (找到叶奈法)、"Something More" (找到希里) | ~12% (6/52) |
| Black Myth: Wukong | "Home is Behind" (序章通关) — 97.6% 达成 | ~10% |
| Elden Ring | "Roundtable Hold" (到达圆桌厅堂) | ~7% |
| Baldur's Gate 3 | "Descent from Avernus" (逃离地狱)、"All's Well That Ends Well" (通关) | ~13% (7/54) |

**AGPA 借鉴：** 对应我们的 Onboarding 类别 — "First Contact"、"Tool Time" 都是顺路解锁的入门成就。可扩展更多"首次操作即解锁"的成就。

---

### 2.2 多重结局型成就

**模式：** 需要专门选择特定结局路径。通常需要多周目或回头存档。

| 游戏 | 例子 | 设计要点 |
|------|------|---------|
| Elden Ring | "Elden Lord" / "Age of the Stars" / "Lord of Frenzied Flame" | 3 个结局成就，需要至少 NG+ 或存档备份 |
| Cyberpunk 2077 | "The Devil" / "The Star" / "The Sun" / "Temperance" | 4 个结局，存档备份可一周目完成 |
| Baldur's Gate 3 | "Absolute Power Corrupts" / "Hero of the Forgotten Realms" / "Sins of the Father" / "Ceremorphosis" | 4 个终局抉择，至少 2 周目 |
| The Witcher 3 | (无结局成就，结局由任务选择决定) | 靠任务选择驱动，不硬设结局成就 |

**AGPA 借鉴：** 我们的隐藏成就中 "It's Learning"（幽默模式）、"im_sorry_dave"（被拒绝）已经隐含了"不同路径触发"的思想。可扩展"不同使用风格触发不同成就"的模式。

---

### 2.3 探索开放世界型成就

**模式：** 鼓励玩家走遍世界的每个角落。

| 游戏 | 例子 | 设计意图 |
|------|------|---------|
| GTA V | "San Andreas Sightseer" (探索所有地点) | 覆盖整个开放世界 |
| Red Dead Redemption 2 | "Western Stranger" (完成 10 个陌生人任务线) — 不要求全清 | **克制式设计**：31 个中只需 10 个 |
| Cyberpunk 2077 | "Frequent Flyer" (解锁所有快速旅行点，138 个中约 121 个弹出) | 渐进式收集 |
| Black Myth: Wukong | "Scenic Seeker" (所有冥想地点) | 探索奖励 |
| The Witcher 3 | 7 个区域全清成就（如 "Little Tokyo" — 全部 Westbrook 委托） | 区域完成主义 |

**Red Dead Redemption 2 的克制设计特别值得一提：** "Friends With Benefits"（每个营地完成一个同伴活动）和 "Western Stranger"（10 个陌生人任务线）的设计哲学是 **"引导你体验核心内容，但不强求全清"**。与 GTA V 的 "Career Criminal"（100% 完成度）形成鲜明对比。

**AGPA 借鉴：** 我们已经有 "polyglot"（5 种语言）、"seeker"（搜索 10 次）这类"体验过即可"的成就。未来可以增加更多"引导尝试特定功能"但不要求"全收集"的成就。

---

### 2.4 收集 / 完成主义型成就

**模式：** 要求玩家集齐某类物品。双刃剑 — 延长游戏时间但也可能造成疲惫。

| 游戏 | 例子 | 评价 |
|------|------|------|
| Elden Ring | "Legendary Armaments" / "Legendary Talismans" / "Legendary Ashen Remains" / "Legendary Sorceries" | **克制式收集**：每个类别只有 6-10 件，刚好覆盖主线关键道具 |
| Monster Hunter: World | "Miniature Crown Master" / "Giant Crown Master" | **争议设计**：纯 RNG，可能需要数百小时 |
| The Witcher 3 | "Card Collector" (全部昆特牌) | **高危错过式收集**：NPC 会随时间线消失 |
| Black Myth: Wukong | "A Curious Collection" (全部珍玩)、"Seeds to Sow" (全部种子) | **内客合理**：81 个成就中收集类约占 15 个 |
| GTA V | "From Beyond the Stars" (飞船零件) / "Waste Management" (核废料) | 引导探索水下/外星人等边缘区域 |

**Elden Ring 的克制收集设计值得学习：** 4 个传说收集成就各仅需 6-10 件物品，分布在主线可及位置。不设置"全武器收集"（游戏有 300+ 武器）或"全护符收集"这样可以理解的痛苦门槛。

**AGPA 借鉴：** 我们已经有 "tool_completist"（同一 session 使用全部核心 tool），属于"克制式收集"。未来如果要增加收集类成就，应学习 Elden Ring 的"只收集关键项"而非"全收集"。

---

### 2.5 BOSS / 挑战型成就

**模式：** 击败某个特定强敌。开放世界最经典的成就类型之一。

| 游戏 | 成就设计策略 |
|------|------------|
| Elden Ring | **22 个 BOSS 成就**（占总数 52%）— 从主线 BOSS 到可选隐藏 BOSS 全部覆盖。是所有调研游戏中 BOSS 成就比例最高的 |
| Black Myth: Wukong | 81 个成就中大量是章节 BOSS 和隐藏 BOSS |
| Monster Hunter: World | "Elderslayer" (50 只古龙) / "Temper Temper" (历战调查) — 从单体到累计 |
| Baldur's Gate 3 | BOSS 成就较少，但要求特殊条件（如 "No Free Lunches" — 在米尔寇吸收死灵之前击杀） |

**AGPA 借鉴：** 我们的 "the_debugger"（自修复）和 "triple_debugger"（3 次自修复）已经属于"特定挑战条件"成就。但 AGPA 的"挑战"更具叙事性，而非数值 BOSS。

---

### 2.6 沙盒 / 涌现行为型成就

**模式：** 鼓励玩家尝试非正常玩法的"沙盒行为"——这类成就是开放世界独有的设计空间，因为只有沙盒环境才能提供足够的机制交互。

| 游戏 | 例子 | 设计意图 |
|------|------|---------|
| GTA V | "Altruist Acolyte" (把醉汉喂给食人族) | **最出色的开放世界成就之一**。你不太可能自然触发，但一旦知道就会会心一笑 |
| Baldur's Gate 3 | "You Have Two Hands for a Reason" (同时摸狗和猫头鹰)；"Kill Two Birds with One Gnome" (用敌人当武器砸另一个敌人) | **用成就引导发现游戏的物理/交互系统** |
| The Witcher 3 | "Moo-rderer" (杀死 20 头牛) | 纯搞怪 |
| Red Dead Redemption 2 | "Grin and Bear It" (被熊攻击 18 次并反杀) | 变相鼓励玩家"别逃跑，正面刚" |

**AGPA 借鉴：** "Execute Order 66"（kill -9）、"im_root"（sudo）、"hold_my_beer"（skip permissions）已经属于这个方向。可以继续扩展这类"反常操作"成就。

---

### 2.7 难度挑战型成就

**模式：** 要求在高难度下完成游戏。

| 游戏 | 例子 | 达成率 |
|------|------|--------|
| The Witcher 3 | "Walked the Path" (死而无憾难度通关) | ~5% |
| Baldur's Gate 3 | "Critical Hit" (战术家)、"Foehammer" (荣誉模式) | 6.1% / 3.1% |

**AGPA 借鉴：** 我们目前没有直接的难度成就，但 "surgeon"（零多余改动）、"speed_run_bronze/silver"（限时完成 task）本质上是挑战型成就。

---

### 2.8 叙事 / 角色羁绊型成就

**模式：** 完成特定角色的个人任务线。开放世界 RPG 的典型设计。

| 游戏 | 例子 |
|------|------|
| Cyberpunk 2077 | "Life of the Road" (帕南线)、"Judy vs Night City" (朱迪线) |
| Baldur's Gate 3 | "To Bloom in Darkest Night" (给影心夜兰花)、"Hot Date" (卡拉克约会)、"Just a Nibble" (让阿斯代伦咬你) |
| The Witcher 3 | "Full Crew" (全盟友齐聚凯尔莫罕) |
| Red Dead Redemption 2 | "Friends With Benefits" (每个营地完成一个同伴活动) |

**AGPA 借鉴：** 我们还没有这类"角色羁绊"成就，因为 AGPA 的"角色"不是游戏 NPC 而是不同 AI 工具。但 "agent_collector"（同时使用 3 个厂商 agent）可视为多工具"交友"成就的雏形。

---

## 三、策略类游戏成就设计模式

### 3.1 胜利条件 + 修饰语模式

**模式：** 策略游戏最核心的成就模式 = "以 [限定条件] [胜利]"。通过组合不同条件派生出大量成就。

**Civilization VI 的典范级实现：**
```
成就 = 文明/领袖 + 地图 + 难度 + 胜利类型 + 额外条件
```

| 维度 | 选项 |
|------|------|
| 领袖 | ~60+ 个领袖，各有专属成就 |
| 地图 | 巨大/极小/群岛/盘古... |
| 难度 | 开拓者→ deity (8 级) |
| 胜利类型 | 科技/文化/征服/宗教/分数 |
| 额外条件 | 特定宗教 + 特定城邦宗主国等 |

这种组合式设计使得 Civ VI 仅凭基础组合就能产生 100+ 成就，每个 DLC 再追加新领袖的专属成就。

**Paradox 系游戏（EU4 / HOI4 / CK3 / Stellaris）则将组合简化为：**
```
成就 = [特定国家/开局] + [特定条件达成]
```
- EU4: "Norwegian Wood"（作为挪威，拥有所有造船省份）
- CK3: "Blood Eagle"（作为拉格纳之子，征服不列颠群岛）
- HOI4: "Operation Sea Lion"（作为德国，控制英国本土）
- Stellaris: "Hear me Roar"（孵化以太龙蛋）

这种"起始+目标"的配方，天然鼓励玩家尝试不同国家和起始条件 → **极大提升重玩性**。

**AGPA 借鉴：** 我们可以借鉴"组合式成就"的思路。例如：
```
成就 = [特定 MCP 工具] + [特定操作类型] + [累计次数]
```
但目前 AGPA 更强调"自然解锁"而非"特定工具组合"，所以不宜完全照搬。

---

### 3.2 难度阶梯型成就

**模式：** 按难度级别设置的成就阶梯，既覆盖休闲玩家也满足 hardcore 玩家。

| 游戏 | 阶梯 |
|------|------|
| Civ VI | Settler → Chieftain → Warlord → Prince → King → Emperor → Immortal → Deity (8 级阶梯) |
| EU4 | Very Easy → Easy → Medium → Hard → Very Hard → Insane (6 级) |
| HOI4 | VE → E → M → H → VH → I (同上) |
| Factorio | "There is no spoon" (8 小时通关) / "No time for chitchat" (15 小时) / "Lazy bastard" (≤111 手造) |

**Factorio 的挑战型阶梯设计尤为突出：**
- 不是纯粹的"高难度通关"，而是**增加机制限制**（禁止手造、禁止太阳能、禁止激光炮塔）
- 每个限制强迫玩家探索不同的解决方法，相当于**游戏机制的教学工具**

**AGPA 借鉴：** "speed_run_bronze"/"speed_run_silver"（3 分钟/1 分钟完成任务）和 "no_edit_challenge"（零手动编辑）已经属于这类挑战型成就。

---

### 3.3 数值 / 产量型成就

**模式：** 基于游戏内生产或资源的累积数值。适合资源管理类策略游戏。

| 游戏 | 例子 | 设计 |
|------|------|------|
| Factorio | "Mass Production 1/2/3" (1 万/100 万/2000 万电路)、"Iron Throne 1/2/3" (2 万/20 万/40 万铁板/小时) | **三档递进**，从"学会造"到"大规模量产" |
| Cities: Skylines | "Metropolis" (人口 10 万)、"City in Motion 2" (50 条交通线路) | 城市规模的自然度量 |
| EU4 | "Trade Hegemon" (贸易收入第一)、"Sikh Pun" (作为锡克教，10 个贸易公司区域) | 数值与条件结合 |

**Factorio 的"三档递进"设计值得学习：** 相同需求分三级（铜/银/金），从轻松获取到极具挑战。每档给玩家渐进的成就感，同时通过"/ 小时"这样的速率指标（而非累计总量）强调持续优化。

**AGPA 借鉴：** "double_digits" (10 tasks) → "century" (100) → "millennium" (1000) 已经是这个模式。还可以扩展到其他维度（如文件编辑数、搜索次数等）做三档递进。

---

### 3.4 叙事 / 文化引用型成就

**模式：** Paradox 和 Firaxis 是这一类别的王者。成就不再是机械任务，而是迷因、双关、历史梗。

**Civilization VI：**
| 成就名 | 引用来源 |
|--------|---------|
| "Luftballons" | 歌曲《99 Luftballons》 |
| "Pizza Party!" | 忍者神龟（李奥纳多、米开朗基罗、多纳泰罗在纽约下水道） |
| "Nobody Expects the Spanish Inquisition" | Monty Python 小品 |
| "I Thought We'd Moved Past This Joke" | 甘地 + 核弹梗（系列经典 meme） |
| "Crouching Tiger Hidden Cannon" | 《卧虎藏龙》 |

**Paradox 游戏：**
| 游戏 | 成就名 | 梗 |
|------|--------|----|
| EU4 | "Norwegian Wood" | Beatles 歌曲 + 挪威 + 木材省份 |
| EU4 | "The Three Mountains" | 作为琉球世界征服 — 荒谬的挑战，名字取自三座山（琉球三山时代） |
| HOI4 | "Our Words Are Backed With Nuclear Weapons" | Dune 引用 + 核威慑 |
| HOI4 | "Crusader Kings 2" | 跨游戏彩蛋 — 用十字军征服王国 |
| CK3 | "The Emperor's New Clothes" | 童话 + 裸奔的皇帝 — 达成条件也是裸体称帝 |
| CK3 | "It's not a Cult!" | 经典名言 — 创建一个新信仰 |

**AGPA 借鉴：** "Execute Order 66"（星战梗）、"I'm sorry, Dave"（2001 太空漫游梗）、"Hold My Beer"（美国 meme）已经是这个方向。可以进一步扩展文化引用。

---

### 3.5 事件 / 意外行为型成就

**模式：** 捕捉游戏中偶然发生的趣味事件。

| 游戏 | 例子 |
|------|------|
| CK3 | "Death Did Us Part" (用计谋谋杀配偶) |
| Factorio | "Watch your step" (被火车撞死) |
| Cities: Skylines | "Frenetic Player" (连续点击警局 100 次) |
| RimWorld | 受伤/崩溃事件相关成就 |

**AGPA 借鉴：** "luck_777" (输出恰好 777 tokens)、"lucky_number" 系列都属于这类。可以继续扩展"捕捉意外瞬间"的成就。

---

## 四、跨类型对比分析

### 4.1 成就数量对比

```
策略类平均成就数: ~168（含 DLC）
开放世界平均成就数: ~55
```
策略游戏成就数远超开放世界，主要原因：
- 策略游戏通过 DLC/扩展持续更新，每次添加新文明/派系/剧本同时补充成就
- 策略游戏的"组合式成就设计"（胜利条件 + 修饰语）天然可派生大量成就
- 开放世界成就更注重手工叙事设计，产量有限

### 4.2 隐藏成就占比

| 类型 | 典型隐藏比例 | 代表游戏 |
|------|------------|---------|
| 开放世界 | 30-60% | BG3 54 个中 29 个隐藏（54%）、Elden Ring 结局/BOSS（约 50%） |
| 策略 | 10-25% | Factorio ~15%、CK3 部分结局隐藏 |

开放世界更倾向隐藏成就（避免剧透剧情/BOSS）。
策略游戏隐藏成就较少（策略游戏的"内容"不依赖剧透保护）。

### 4.3 自然解锁 vs. 刻意解锁

| 维度 | 开放世界 | 策略游戏 |
|------|---------|---------|
| 自然解锁比例 | ~40% | ~20% |
| 需要刻意追求 | 收集 + 特定挑战 | 特定国家 + 特定胜利条件 |
| "错过即无"风险 | 中高（NPC 随时间线消失） | 低（可重开） |
| "纯 RNG"成分 | 低到中 | 低 |

开放世界更容易自然解锁约 40% 的成就（流程中顺路获得），但收集型和错过型成就占比较大。
策略游戏的成就几乎都需要**刻意追求**——你不可能"顺路"用挪威完成世界征服。

### 4.4 DLC 与成就的关系

| 策略 | 代表游戏 | 做法 |
|------|---------|------|
| 捆绑 | Civ VI / EU4 / HOI4 / Stellaris | **成就随 DLC 发布**，无对应 DLC 的成就不可见 |
| 基础 + DLC 混合 | Factorio | 基础 59 + Space Age 29，分开算 |
| 追加但不捆绑 | Cities: Skylines | 每个 DLC 追加成就，但基础版玩家看不到 DLC 成就 |

开放世界游戏的 DLC 成就通常较少（如 Witcher 3 的 DLC 各 13 个），而策略游戏 DLC 常贡献大量成就（如 Civ VI 的 320 个中约 220 个来自 DLC）。

---

## 五、最具启发性的设计案例

### 5.1 Red Dead Redemption 2 — "克制成就设计"的标杆

RDR2 的设计哲学对我们参考价值最大：
- **不要求全收集**：31 个陌生人任务只需 10 个 → 体验过即可
- **不追求"完美存档"**：100% 完成度的唯一成就 "Best in the West"
- **引导式而非压迫式**：成就告诉你"去体验这个系统的魅力"而非"你必须做完"
- **角色扮演友好**：不会强迫你做违背角色性格的事（除了少数荣誉值成就）

### 5.2 Factorio — "限制性挑战设计"的典范

Factorio 的挑战成就是我们可参考的第二大来源：
- **三档递进**（铜/银/金）：让玩家体验到"渐进的征服感"
- **限制不是增加数值而是改变玩法**："Steam all the way" 强迫使用蒸汽，"Lazy bastard" 要求全自动化
- **速率指标**："/ 小时"而非累计量，强调持续优化

### 5.3 Elden Ring — "克制式收集"的最佳实践

Elden Ring 证明了 **收集成就可以不痛苦**：
- 每个传说收集类别只设 6-10 件
- 不要求全武器/全护符（游戏有 300+ 武器）
- 隐藏 BOSS 成就增加了探索回报感

### 5.4 Civilization VI — "组合式成就系统"的工程化

Civ VI 的成就系统对策略游戏有参考价值：
- **模板化产出**：[文明/领袖 + 地图 + 难度 + 胜利类型] 的组合数学
- **文化引用层**：在模板之上加一层命名创意
- **新 DLC 即新成就**：每次扩展自动带来新领袖成就

---

## 六、对 AGPA 的启示与扩展建议

### 6.1 可直接借鉴的模式

| 模式 | 游戏来源 | AGPA 对应建议 |
|------|---------|--------------|
| 三档递进 | Factorio / MHW | 现有 "double_digits → century → millennium" 已对齐。可在其他维度扩展（编辑文件数、tool call 数） |
| 克制引导型收集 | RDR2 / Elden Ring | "体验过即可"而非"全收集" — 现有 "polyglot"（5 种语言）就是好例子 |
| 沙盒/涌现行为 | GTA V / BG3 | 继续扩展 "Execute Order 66"/"hold_my_beer" 这种"特定反常操作"成就 |
| 叙事型隐藏 | BG3 / Elden Ring | 隐藏成就应该用神秘描述引发好奇心，而不是简单的"[达成条件]" |
| 文化引用命名 | Civ VI / Paradox | "im_sorry_dave"（2001 太空漫游）、"Execute Order 66"（星战）已对齐。可再增加 |

### 6.2 需要避免的陷阱

| 陷阱 | 案例 | 原因 |
|------|------|------|
| 纯 RNG 收集 | MHW 大小金冠 | 数百小时无意义重复 |
| 高错过风险收集 | Witcher 3 昆特牌 | NPC 随时间消失，懊恼感 > 成就感 |
| 无意义刷量 | GTA V "Solid Gold Baby"（70 个金牌） | 强制玩家做不喜欢的重玩 |
| 信息不对称 | Skyrim 某些隐蔽任务 | 不看攻略完全不知道有这个成就 |
| 强迫多周目 | Elden Ring 3 结局（无保存备份） | 强制重复劳动 |

### 6.3 开放问题（待讨论）

1. **AGPA 的帕累托最优成就数量是多少？** 策略游戏可以几百个，但 AI coding agent 的成就应该多少？
2. **是否引入"组合式成就"？** 如"在 X 工具中用 Y 功能达 Z 次"？这确实能派生大量成就，但可能偏离"自然发现"的设计目标。
3. **是否加入社区成就？** 如"你的某个成就解锁率低于 1%"（类似 Xbox 的稀有成就系统）。
4. **成就的"难度阶梯"要不要和工具版本挂钩？** 如某版本新增功能可解锁专属成就。

---

## 七、调研总结

### 核心发现

1. **开放世界成就** ≈ 引导探索 + 奖励探索 + 捕捉意外
2. **策略游戏成就** ≈ 扩展重玩性 + 鼓励不同玩法 + 文化引用
3. **好的成就设计** 是引导玩家**发现**游戏已有乐趣，而不是**定义**乐趣本身
4. **克制比堆量重要**：Elden Ring 的 42 个成就比 MHW 的 100 个更受好评
5. **隐藏成就是双刃剑**：保护新手的好奇心 vs. 照顾收集癖的知情权

### 对 AGPA 最适用的三条原则

> **① 引导发现，而非定义行为** — 成就是你做了有趣事情之后的**确认**，不是前置指令
> **② 先体验感，再完成度** — "用过 5 种语言" > "在一门语言中写了 1 万行"
> **③ 克制是美德** — 50 个精心设计的成就 > 500 个"顺路解锁"的水成就

---

## 附录：数据来源

- Steam Community / SteamDB — 成就达成率统计数据
- Paradox Wikis（EU4 / HOI4 / CK3 / Stellaris / Cities: Skylines）— 官方成就列表
- TrueSteamAchievements — 跨游戏成就数据对比
- VGtimes — 成就列表与隐藏标记
- Red Dead Redemption 2 成就分析论文 — University of Waterloo (UWSpace)
- Game Informer — GTA V 成就设计回顾 (2013)
