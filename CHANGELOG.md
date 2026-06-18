# Changelog

### ES/KO/JA 多语言支持 + Dashboard 测试覆盖 + 指令增强 — 2026-06-18

- **213 个成就全面中/英/西/韩/日 5 语**: 1278 条翻译（name + description × 3 语言）写入 YAML
  - 后端全线透传: types.ts → yaml-parser → helpers/FormattedAchievement → api.ts/AchievementItem
  - 推荐系统同时多语: recommend.ts → RecommendItem, progress-nudge.ts → NearUnlock
  - Card builder 从硬编码 `useZh` 改为通用 `_name()`/`_desc()` 多语选择函数
- **Dashboard 语言选择器 5 语切换**: ES/KO/JA 选项 🇪🇸🇰🇷🇯🇵
  - `displayName()`/`displayDesc()`、`syncLangPicker()` 全面支持
  - I18N 表新增 ES/KO/JA 的 165 个 UI key 翻译（导航、统计、导览、热力图等）
  - 搜索过滤覆盖 5 语、Modal 改用 `displayName()`、Gacha Reveal 同步
  - 配置白名单: `achievement.config lang` 从 `en|zh` 扩展为 `en|zh|es|ko|ja`
- **CLAUDE.md 指令强化**: Session 结束 MUST 结构化展示成就 + 按 `config.lang` 匹配字段
- **指令文件路径修复**: Kilo Code/Hermes/OpenCode/OpenClaw 从项目级 `./AGENTS.md` 改为全局路径
- **Dashboard 前端测试**: 30 个测试覆盖 i18n/displayName/displayDesc/rarityColor/iconHtml/filter/sort
- **修复**: engine.test.ts flaky test (缓存 stats 缺 poll 前置)
- 测试 47 文件 1235 全绿，TypeScript 零错误

### 古典名曲 8-bit 音效 v2 — 2026-06-18

- **6 个稀有度音效全面替换**: 从程序合成琶音改为古典名曲最经典/最昂扬片段，原曲速度 (bpm 匹配)
  - Common → Vivaldi《春》(E大调鸟鸣式 ritornello)
  - Uncommon → Bach《G大调小步舞曲》(巴洛克舞步)
  - Rare → Rossini《威廉·退尔序曲》终曲 (号角 + 奔马 gallop)
  - Epic → Beethoven《英雄交响曲》第四乐章 "普罗米修斯" 变奏 (弱起 pizz → 辉煌胜利)
  - Legendary → Beethoven《命运交响曲》第四乐章 (定音鼓黑暗 → C大调号角齐鸣)
  - Mythic → Beethoven《欢乐颂》(大提琴宣叙调呼唤 → 主题迸发)
- **新增能力**: Note 接口加 `legato?` 标志实现音符无缝过渡；补全半音程音高常量 (A2–B6)；新增 STACC/LEG/MARC/CHORD 包络类型
- **批量声音去重**: `playSound()` 导出供外部调用；hook 中声音移到通知循环外层，只按最高稀有度播放一次

### README 数字同步 + 项目结构更新 — 2026-06-17

- **数字修正**: 成就数 218→213, 测试数 1203→1205, 测试文件数 45→46, CLI 命令数 25→27, MCP 工具数 5→7, 运行时依赖 4→5
- **CLI 表补充**: 新增 6 条遗漏命令（banner, history, explain, watch, upgrade, completion）
- **项目结构同步**: 新增 index.ts, tool-registry.ts, verify/auditor.ts；更新 utils/ 描述
- **多语言同步**: 5 份 README 文件行数统一为 510 行

### 徽章图片路径定义 — 2026-06-17

- **YAML 存路径不存像素数据**: Set 定义新增 `badge_image` 字段（如 `badge_image: "badges/founder.png"`），指向预渲染的 24×48 徽章图片；`SetDefinition.pixel_art` 移除
- **Dashboard 渲染**: `renderBadges` 中检测 `badge_image` → `<img>` 标签，无则回退 emoji iconHtml；新增 `.badge-image` / `.badge-icon-img` CSS
- **转换工具**: `img-to-pixelart.mjs --badge` 将 SVG 处理后写入 `pixel-art-output/badges/` 目录并输出 `badge_image:` YAML；移除废弃的 `sectionToYAML` / `badgeToYAML`
- **测试**: 4 个 inline pixel_art 测试 → 2 个 `badge_image` 解析/缺省测试

### Questline 徽章进入 Badges 列表 — 2026-06-17

- **Questline 徽章补齐**: `buildBadges()` 新增 `questlineDefinitions` 参数，完成全部 stage 的 questline badge 奖励现在会出现在 Hero 区徽章行和 Badges 页，不再只局限在 questline 卡片内

### 新增等级徽章 + 等级曲线重设计 — 2026-06-17

- **等级系统重设计**: 公式从 `sqrt(XP/100)` 改为 `(XP/100)^0.4`，上限 Lv 20（非硬 clamp 而是曲线自然收敛）；`calcXpForLevel` 逆运算调整为 `ceil(100 * n^2.5)`；Lv 20 需要 178,886 XP（≈全成就 + 数千 task + streak），非一日之功
- **5 个等级徽章**: Bronze Agent (Lv 3)、Silver Agent (Lv 7)、Gold Agent (Lv 11)、Diamond Agent (Lv 15)、Grandmaster (Lv 20)，达到等级自动解锁

### 新增稀有度全收集徽章 — 2026-06-17

- **6 个稀有度徽章**: 集齐某一稀有度的全部成就后解锁对应徽章（Common / Uncommon / Rare / Epic / Legendary / Mythic Completion），动态计算，支持中英文名；`BadgeItem` 新增 `badge_cn` 字段；排除 future 成就

### 统一称号和徽章 — 2026-06-17

- **称号合并到徽章**: 移除 `title` reward type，4 个套装称号 + 5 个 Questline 称号全部改为 `badge` type；删除 `TitleItem` 接口、`buildTitlesAndBadges` 函数、`hero-titles-row`/`titles-row` 等 UI 元素；清理残余 CSS 和 i18n key

### XP/Level 系统修复 + 成就稀有度 Cleanup — 2026-06-17

- **P0 — Card API XP 计算错误**: `buildCardData()` 中所有成就按 50 XP 算（`total_unlocked * 50`），修复为按稀有度映射 `ACHIEVEMENT_XP`；全成就用户卡片 Level 从 10 回到 19
- **P1 — Engine/Dashboard XP 双通道一致**: `engine.ts getStats()` 加入 usage XP 计算和 streak multiplier，精确匹配 dashboard 的 `calcTotalXp()`，消除 MCP 通道输出低估
- **P2 — Usage XP 权重 4x**: toolCalls×1→4, sessions×10→40, messages×5→20, tokens×0.5→2, uniqueTools×20→80
- **稀有度 Cleanup**: 重新按达成难度评定 38 个成就稀有度（24 降级 + 14 升级），移除 hidden 状态对稀有度的虚高影响；mythic 5→4, legendary 10→8, epic 35→31, rare 48→45, uncommon 59→71, common 56→54

### Dashboard UI 修复 — 2026-06-17

- **主题切换**: Polar Night 装扮在白天模式下不再覆盖 CSS 变量；自动填充展示柜后不再重置暗色装扮
- **稀有度颜色统一**: JS `RARITY_COLORS` 与 CSS `--rarity-*` 变量同步；成就详情 badge 边框色从错乱硬编码改为匹配稀有度
- **热力图**: 删除右侧图例、月份/周几标签；格子动态填满卡片；`overflow:visible` 修复 tooltip 截断
- **连击卡片**: 新增 "当前连续"/"历史最高记录" 标签；右侧数字字号与左侧统一(42px)；右侧加 "天" 单位；multiplier 格式改为 "XP ×1.9"；"今天已编码" 移至左上角
- **动画开关 tooltip**: CSS `::after` 伪元素实现，往下弹出，中英文说明
- **Questline/Set 间距**: `.questlines-stack` 加 `margin-bottom: 24px`
- **修复**: `generateCardCore` 多余 catch 块（导致 JS 语法错误）、`totalColumns` 作用域 bug

### 修复像素画描述 — 2026-06-17

- **pixel-art-ideas.md**: 修复 5 处像素画描述——dual_wielder（三刀流→Zoro）、permission_granted（控制面板→门禁卡）、execute_order_66（加闪电天罚）、rubber_duck（浴缸→办公桌）、its_learning（简化去冗余）
- **pixel-art-ideas.md**: 追加修复 4 处——fifth_element（致敬同名电影）、oops_all_bash（纯终端全屏命令）、agent_collector（花花公子兔子头 logo）、pipemaster（马力欧水管工）
- **pixel-art-review-2026-06-16.md**: 全部 8 项标记已修复，YAML 数量同步到 218；补充 pipemaster（马力欧水管工）修复

### 修复 YAML ID 冲突 — 2026-06-16

- **achievement-definitions.yaml**: 探索线 `polyglot` ID 与 Milestones 成就 `polyglot` 冲突（YAML 218 条行 / 217 个唯⼀ ID），重命名为 `polyglot_quest`，现为 218 行 / 218 唯⼀

### Dashboard i18n 全面补齐 — 2026-06-16

- **app.js I18N 表**: 124→165 key（+41），EN↔ZH 零缺失。移除全部 `L()` 内联双语函数，替换 ~15 处硬编码字符串为 `t()`（旅程空状态、热力图标签、档案弹窗描述、demo 标签、加载按钮、分享卡片等）
- **index.html**: `data-i18n` 属性 30→41 个，新增 `data-i18n-title` 3 处（音效/动画/主题开关、档案弹窗关闭按钮）
- **tour.js**: 导览 4 步标题/描述改用 `t()` 动态获取（`tour_step{1-4}_title/desc`），支持中英切换
- **customize page**: 新增独立 `I18N_CZ` + `tc()` i18n 层（44 key），替换 ~21 处硬编码字符串（统计/按钮/提示/编辑栏），`customize.html` 新增 12 个 `data-i18n` 属性
- **热力图 i18n**: 星期缩写（Mon/Wed/Fri→周一/周三/周五）、月份缩写（Jan→1月）、session 提示词全部走 `t()`
- **验证**: tsc 零错误，1203/1203 测试全绿，app.js 165:165 + customize.js 44:44 中英 key 完全对称

### 社区成就 Pack 基础设施 — 2026-06-16

- **Pack 加载引擎**: 扫描 `~/.agent-achievements/packs/*.yaml`，冲突检测（core vs pack vs pack），错误包隔离不阻断
- **`parsePackYAML()`**: 新增 YAML 解析导出函数，校验 `pack:` 元数据、拒绝 `sets`/`questlines`、warn 未知事件类型
- **`isKnownEventType()`**: 基于 auditor Layer C emitter 列表的 42+ 事件校验
- **Engine**: 新增 `packs[]`/`packDefinitions[]`/`loadPacks()`/`getPackInfo()`，`init()` 和 `reloadDefinitions()` 追加 pack 加载
- **类型扩展**: `PackMetadata` 接口、`AchievementDefinition.pack_id`、`EngineOptions.packsDir`
- **CLI**: `agpa pack list` / `agpa pack info` 命令，注册到 "Packs" 帮助分组
- **Dashboard API**: `AchievementItem.pack_name` 标识非核心成就，`DashboardData.packs` 元数据数组
- **测试**: 27 个 pack loading 测试（解析/冲突/异常隔离/删除保留/评估），1203 全绿
- **文档**: `docs/creating-achievements.md`（~500 行，12 种条件类型 + 42+ 事件目录 + filter 语法 + 窗口 + 最佳实践）
- **社区模板**: GitHub issue/PR 模板（`achievement-idea.md` / `new-pack.md`）
- **示例**: `examples/example-pack.yaml`（2 个成就的 demo pack，counter + distinct_count）
- **README**: 更新 badge（218/1203/25）、新增 Community Packs 章节 + nav 链接 + CLI 命令行，5 语言同步

### Dashboard 性能优化 — 2026-06-16

- `renderAll` 只重建当前可见 tab（IntersectionObserver 追踪活跃 section），auto-poll 和 scoped 调用省 ~60% DOM/Canvas 操作。语言切换传 `full=true` 保持全量
- auto-poll 加 Page Visibility API——tab 切到后台暂停轮询，切回前台恢复。`beforeunload` 清理
- `escHtml` 字符串缓存 500 条上限，超限清空重建，防止长时间运行泄漏
- Showcase PUT/DELETE 端点返回更新后数据，前端 `applyShowcase()` 只重绘 hero section，不再 fetch + renderAll
- `renderInsights` Canvas 节流至 1 小时一次（4 张每日统计图变化缓慢，每 10s 重绘浪费）
- `/api/data` 移除 auto-poll 中的 `reloadDefinitions()`，YAML 仅在 `/api/customize/reload` 时主动重载（修复了该端点之前不真正 reload 引擎的潜在 bug）
- Dashboard 版本号从 `package.json` 动态读取，不再硬编码 `'0.1.8'`
- 删除死代码 `toggleLang()` stub

### README Phase 1 改进 + 五语言国际化 — 2026-06-16

**README 改进 (7)**:
- 导航栏: 9 节点快速跳转行（EN + zh-CN/ES/KO/JA 五语言均含本地化锚点）
- CLI 命令: 代码块 → 可扫描表格（20 条命令 + `agpa --help` 提示）
- 文档索引: 新增 📚 Documentation 章节，链接 7 篇核心文档 + CHANGELOG
- 安全与隐私: 新增 🔒 Security & Privacy 章节（本地优先/可审计/STDIO 隔离/Hook 沙箱/供应链 6 点）
- 环境变量: 新增 🌐 Environment Variables 参考表（11 个 AGPA_* 变量）
- 徽章行: 从 6 个扩展到 9 个（+GitHub stars / last-commit / i18n）
- CHANGELOG 链接: 在文档索引表中

**国际化 (4)**:
- `README.zh-CN.md` — 同步到与英文版完全一致（之前落后 4KB）
- `README.es.md` — 新建（西班牙语）
- `README.ko.md` — 新建（韩语）
- `README.ja.md` — 新建（日语）
- 每份 README 含统一的 5 语言切换器: EN | 中文 | ES | 한국어 | 日本語

**对照分析评分**: README 总分从 5.3/10 → ~7.8/10（P1 全部完成 + P3 部分完成）

**工程约定**: CLAUDE.md 新增"每次改 README 后同步翻译"规则

### README 竞品分析 — 2026-06-16

**文档新增 (1)**:
- `docs/readme-competitive-analysis-2026-06-16.md` — 对比 25 个 GitHub Top MCP/Agent 项目的 README 最佳实践。AGPA README 综合评分 5.3/10 vs top-5 平均 6.6/10。识别 12 个改进方向: P0 (视觉效果缺失、无导航栏) , P1 (无用户评价、无安全专区、无对比表), P2 (无环境变量文档、无文档索引), P3 (CLI 表格化、Changelog 链接、徽章扩展、赞助信息)

### 描述一致性审计 + 像素画审查 — 2026-06-16

**文档新增 (2)**:
- `docs/description-lang-audit-2026-06-16.md` — 213 成就中英文描述 LLM 逐对审核。结果: 0 Mismatch, 54 Minor（A-趣味尾巴漏译 36 个, B-语义偏差 14 个, C-本地化 2 个, D-对齐 2 个），含逐项修复建议和优先级
- `docs/pixel-art-review-2026-06-16.md` — 213 成就像素画描述按 4 项原则审查（名关联/描述关联/流行文化梗/无关细节）。结果: 1 Critical (`dual_wielder` 漏 One Piece Zoro 梗), 1 Significant (`permission_granted` "门禁卡"名称与画面脱节), 5 Moderate, 3 Minor，0 遗漏（全部 213 个 YAML 成就都有像素画条目 ✅）

### Dashboard 审计修复 — 2026-06-15

**Bug 修复 (5)**:
- B1: 时间热力图强度计算 — `1 > 0 ? grid[day][h] / 1 : 0`（永远满强度，二元色块）→ 先算 `maxVal` 做归一化
- B2: 3 个缺失 CSS 变量 — `:root` 补充 `--primary: #4fc3f7`、`--card-bg: var(--bg-card)`、`--text-primary: var(--text)`，修复 Recommend 面板边框、Questline 进度条、Insights 卡片背景
- B4: Theme Flash — `<head>` 最前面加 inline `<script>` 读取 localStorage 在首帧前设 `data-theme`，消除 light 主题刷新暗闪
- B6: 删除重复的 `stat_complete: 'Complete'` (I18N.en)
- B7: Insights canvas 在 `renderAll` DOM 重建后不再重播入场动画

**UX 改进 (6)**:
- U1: 页面加载 spinner（CSS-only），首次 API 返回后淡出
- U3: 搜索输入 250ms debounce，不再每次按键重建 DOM
- U5: Recommend 面板改为始终显示 toggle 按钮（保留 20% 自动展开）
- U6: 回到顶部按钮（scrollY > 500 出现，固定 bottom:80px right:28px）
- U7: 成就卡片 `tabindex="0" role="button"`，Enter/Space 打开 modal

**性能优化 (5)**:
- P1: html2canvas 200KB 从同步加载改为 `generateCard()` 时动态 `<script>` 注入
- P2: Google Fonts `<link>` 加 `media="print" onload="this.media='all'"`
- P3+P4: 成就过滤结果缓存 (`_gridMemo` keyed by filter/category/search/sort/rarity + item count)，仅输入变化时重算
- P5: `<meta name="description">` + `<link rel="preload" href="/styles.css">`

**代码质量 (3)**:
- C3: `RARITY_ORDER` 统一（消除 `renderSets` / `renderTimeline` 中的 2 处内联 `order` 对象）
- B3: `escHtml()` 从假缓存改为 `_map` 对象缓存（输入→输出 memoization）
- C1: `buildCardHTML` 添加注释说明独立的卡片渲染管线

文件: `src/dashboard/public/app.js` +171/-77, `src/dashboard/public/index.html` +9/-0, `src/dashboard/public/styles.css` +63/-0

### Poll 优化: 脏检查 + 去重 dashboard.opened — 2026-06-15

- **全量重渲染消除**: autopoll 从 `JSON.stringify(stats)` 替换为 `hasVisualChange()`，只检查 `unlocked/level/total_xp/completion_pct` 4 个字段。无新解锁时调用 `updateStatsInPlace()` 只更新数字 textContent + streak/heatmap，不重建 DOM 或重播入场动画。~90% 的轮询周期不再触达成就网格/套装/时间线/走势图
- **dashboard.opened 去重**: 每次 `/api/data` 请求都会记一条 `dashboard.opened`（10s 轮询 → 每分钟 6 条虚高），改为每个 profile 在每次 server 进程中只第一次记数。避免成就条件被轮询流量错误解锁
- 文件: `src/dashboard/public/app.js` +71/-20, `src/dashboard/server.ts` +9/-1

### 发布就绪准备 (P0) — 2026-06-15

- **README 数字同步 (EN + CN)**: 成就 183→213、测试 897→1176、测试文件 33→45、条件类型 11→12、分类 10→11(含 Endurance)、运行时依赖 3→4(含 figlet)、各分类计数全部精确更新
- **CI 矩阵扩展**: Node 版本矩阵 22→[18, 20, 22]；push 分支 main→[main, dev]；验证 engine.json 声明的 `>=18` 断言
- **npm 发布修复**:
  - `package.json` `files` 字段：`04-成就定义清单.yaml`（不存在）→ `achievement-definitions.yaml` + `LICENSE` + `README.zh-CN.md`
  - `tsx` 从 devDependencies 提升到 dependencies（`bin` 入口依赖 `#!/usr/bin/env -S npx tsx`，全局安装后 `agpa` 命令可用）
  - `npm pack --dry-run` 验证：358 KB 压缩 / 1.4 MB 解压 / 90 文件，无内部脚本泄露
- **README 文件名修复**: 项目结构 block 中 `04-成就定义清单.yaml` → `achievement-definitions.yaml`

### 非 CC 工具事件缺口修复 + 引擎电池 enrichment — 2026-06-15

- **Cross-tool 事件覆盖审计**：发现 6/15 代码审查的"0 不可达"结论仅对 CC 用户成立——Hermes/OpenClaw/KiloCode 有 20 个成就因 5 类事件无发射器而不可达。修复后 **0 真正不可达**，~12 个靠 CLAUDE.md 指令覆盖（agent 严格执行即可解锁，属于手动 track 可靠性范畴，非功能缺口）
- **翻译层失败路由**: `normalizeOpenClawStdin()`/`normalizeKilocodeStdin()` — `success=false` 或 `error` 非空 → `hook_event_name` 覆写为 `PostToolUseFailure`，自动 emit `tool.failure` + `error.occurred`（之前失败也路由为 `PostToolUse`，只产 `tool.complete`）
- **mapEvents PostToolUseFailure**: error 文本现在注入 `tool.failure`/`error.occurred` payload（此前 payload 无错误信息）
- **Hermes JSDoc**: 注明 Hermes 无 success/error 字段，失败事件只能通过 CLAUDE.md 手动 track
- **CLAUDE.md 指令扩展**: `INSTRUCTION_BLOCK` 新增 5 条手动 track 条目：`user.prompt`(带 char_count/word_count/has_code_block/has_question_mark)、`tool.failure`、`error.occurred`、`agent.spawn`、`context.compacted`
- **Marker v1→v2 升级**: `INIT_DATA` 6 处 marker 更新；`injectInstructions()` 新增 v1→v2 升级逻辑——检测到旧块时自动替换为新块，避免指令重复；`~/.claude/CLAUDE.md` 已升级
- **引擎电池 enrichment**: `engine.ts track()` 对 `user.message` 自动注入 `on_battery`/`battery_pct`（条件 `!('on_battery' in payload)` 避免重复），4 行代码全通道修复 `last_stand` 成就
- **TypeScript 修复**: `AuditFinding.layer` 新增 `'C'` 联合类型 + `hook.ts` `before_lines`/`total_file_lines` unknown 值断言，`tsc --noEmit` 零错误
- **Auditor 同步**: `MANUAL_TRACK_EVENTS` 补入 5 事件；Layer C 追加 per-tool-source 覆盖限制注释
- **测试**: 1161 → 1176（+15），hook.test.ts +10 测试（OpenClaw/KiloCode 失败路由 + error payload + Hermes 确认无路由），init.test.ts +6 测试（block 内容 + v1→v2 升级 + idempotent）

### 代码审查跟进修复 + 报告修正 — 2026-06-15

- **报告修正**: `docs/code-review-2026-06-15.md` 的"触发可达性"评分经实地代码逐行审查后判定为夸大——唯一真正的缺口是 `skill.invoke`（已修复），其余均有发射源
- **skill.invoke 补入 CLAUDE.md**: `src/cli/init.ts` INSTRUCTION_BLOCK + `~/.claude/CLAUDE.md` 新增 `skill.invoke` 手动 track 指令
- **2b: 级联解锁测试 (P0)**: 新文件 `tests/engine/cascading.test.ts`（6 测试），覆盖 bootstrap、三轮 poll 级联、持久化
- **2c: 填测试空白 (P1)**: `tests/engine/evaluator.test.ts` 新增 21 测试——`time_gap`(9)、`ratio group_by`(6)、`pattern_match first_in_session`(6)
- **2d: Auditor Layer C (P2)**: `src/verify/auditor.ts` 新增事件可达性验证层，4 类发射源（hook_auto 30/engine_auto 5/dashboard 1/manual 29），9 测试
- **`==` vs `>=`**: 决议为 false alarm——`single_session` 窗口下的 `==` 不影响可达性
- **测试**: 1078 → 1161（+83），43 → 45 文件

### 成就系统全面代码审查报告 — 2026-06-15

- **新增文档**: `docs/code-review-2026-06-15.md` — 三个维度的全面审查：
  - **① 触发可达性 (2/5)**: 发现 ~27 种事件类型无任何发射器，导致约 40+ 成就（近 1/4）正常使用中不可达。根源是 `CLAUDE.md` 只指导 Agent 调用 4 种事件，其余既无 Hook 映射也无人为触发
  - **② 系统稳健性 (3/5)**: 核心架构扎实（多进程安全、fail-closed 过滤器、Zod 验证），但 `time_gap` / `ratio group_by` / `pattern_match first_in_session` 三个条件类型零单元测试覆盖，`achievement.unlocked` 级联链无集成测试，`event.log` 无上限增长
  - **③ 描述-条件一致性 (3/5)**: 多数一致，6 处偏离——`==` 严格等号令成就可能永久错过、`template_master` 阈值 `>1` 与描述不符、`im_sorry_dave` 双重条件未说明、40+ 成就有名无实
- **优先级建议**: 7 项从 P0-P3，P0 两项（Hook 事件映射补充 + 级联链集成测试）

### 可解释层 Bug 修复 + 隐藏保护加固 — 2026-06-15

- **`collectExclusions` field-empty 检查扩展**: `counter(same_target)` 和 `streak(event_level)` 的空 field 事件现在正确标记为 `field_value` 排除，不再错误计入 `matched_count`
- **`buildDetails` scope 修复**: streak(event_level) 和 sequence 的 detail 计算改用 scoped events，session/task-windowed 条件不再错误显示全历史数据
- **`buildDetails` time_gap 重写**: 从 O(n²) min-pair-gap 改为 O(n) max-adjacent-gap，与 evaluator 算法一致；新增 `from_filter`/`to_filter`/`cross_day` 支持；字段 `closest_pair_gap_ms`→`max_adjacent_gap_ms`
- **隐藏保护移至 engine 层**: `engine.explain()` 统一处理 `hidden && !unlocked` masking（conditions=[], description=''），MCP/CLI 不再各自实现
- **Evaluator 一致性 cross-check**: 对全部 12 condition types 验证 explain 的 met/progress/target 与 `evaluateCondition()` 一致
- **测试**: +14 测试（field-empty 排除、scoped details、time_gap max-gap、engine masking、evaluator cross-check）；explain 测试 46 个，总测试 1138 个 — 全绿零 regression
- **文件**: `src/utils/explain.ts`、`src/engine/engine.ts`、`src/tools/explain.ts`（注释）、`src/cli/explain.ts`（注释）、`tests/utils/explain.test.ts`

### 成就可解释层 (Explain Layer) — 2026-06-15

- **`src/utils/explain.ts`**: 核心解释引擎 `explainAchievement()`，纯函数，复用 `evaluateCondition()` + `matchFilter()` 保证进度准确性，独立 trace pass 收集排除事件（最多 5 条/条件）+ 排除原因（filter/role/window/field_value）
- **MCP tool**: `achievement_explain` — Agent 对话中调用，返回条件拆解 + progress + 排除追踪；hidden 成就只暴露 hint
- **CLI**: `agpa explain <id> [--json] [--profile <name>]` — 终端格式化输出，稀有度着色，进度条
- **类型**: `ExclusionTrace` / `ConditionExplanation` / `AchievementExplanation` 三个新 interface
- **不修改**: evaluator.ts、store.ts、hook.ts、Dashboard 均未动，不影响现有评估/事件链路
- **测试**: +32 测试（`tests/utils/explain.test.ts`），覆盖全部 12 condition types + hidden 保护 + 排除追踪
- **issues-todo.md**: Event Log 增长从 P2→监控（6/15 复审：当前性能足够，增量方案复杂度 > 收益）

### 文档同步 + pixel-art-ideas desc 对齐 — 2026-06-12

- **issues-todo.md**: 校正数字（218→213、64→63 隐藏成就）、更新日期
- **PROGRESS.md**: 数字同步 + 版本对比表 218→213
- **top10-next-todos**: 推荐系统状态修正为"部分完成"（Near Win/Discovery/Surprise ✅，缺 Challenge），数字同步
- **pixel-art-ideas.md**: 20 个 Type A desc_cn 同步 YAML（追加风味文字）、`its_learning` 描述重写（旧"幽默模式"→新版"被逗笑"）、`shell_shocker` 引号统一为中文弯引号

### 修复 sequence_count nudge false-start — 2026-06-11

- `progress-nudge.ts` `sequenceCountProgress` 缺少 evaluator 中已有的 false-start fallback
- Pattern `['A','B']` 流 `'A','A','B'` 时 evaluator 正确计数 1，nudge 显示 0
- 补了一行代码 + 新测试，1077→1078 tests

### 7 个 Shell 命令成就 — 2026-06-11

新增 7 个基于 shell 命令触发的隐藏成就，与已有的危险命令成就风格一致：
- **art_of_letting_go**（断舍离 🔥）：`rm -rf` / `rm -f` / `rmdir`
- **moving_company**（搬家公司 📦）：`mv`
- **sharingan**（写轮眼 🖨️）：`cp`
- **inventory_check**（仓储检查 📊）：`df` / `du`
- **my_turf_my_rules**（我的地盘我做主 🔓）：`chmod`
- **peek_a_boo**（管中窥豹 👀）：`head`
- **stalker**（尾行者 🐾）：`tail`
- 全部 hidden，使用 `counter` + `tool.complete` + `command contains` filter
- 成就总数 206→213

### 作弊码 + 创造模式成就 — 2026-06-11

新增两个探测核心文件访问的隐藏成就：
- **cheat_code**（作弊码 🎮，rare）：agent 读取 AGPA 10 大核心文件之一，偷看引擎盖下的秘密
- **creative_mode**（创造模式 🛠️，epic）：agent 编辑 AGPA 10 大核心文件之一，解锁创造权限
- 使用 `counter` + `file_path contains` filter 实现，通过 `||` OR 逻辑同时匹配 10 个核心路径
- 成就总数 204→206

### 甜蜜与烦恼成就 + first_in_session 模式匹配标志 — 2026-06-11

新增 `sweet_troubles`（甜蜜与烦恼）成就：用户在当前 session 第一条消息中提及伴侣称呼时触发。
- **YAML**: 新增 `sweet_troubles` 成就（category: hidden, rarity: rare），pattern 覆盖中英文 20 种伴侣称呼
- **引擎**: `evalPatternMatch` 新增 `first_in_session` 模式，仅检查 scoped window 中第一条匹配事件
- **类型**: Condition 接口新增 `first_in_session?: boolean`
- **解析器**: YAML 解析器映射 `first_in_session` 字段
- **测试**: `genEvents` 支持多词 `|` 分隔 pattern；auditor 总数 203→204

### 像素画描述系统性完善 — 2026-06-11

三轮审查+改进全部 207 条像素画描述，确保与 YAML 定义的中英文名、描述和 pop culture 梗源对齐：
- **Bug 修复**: 删除 `cerberus` 在 Workflow 节中的重复行；修正 `whale_song`/`deepseek_dabbler` 中文名互换
- **P1 梗缺失 (8)**: `three_company`→足球帽子戏法；`parallel_universe`→Zerg虫族母巢；`code_talker`→二战Navajo密码员；`u_turn`→重制版游戏卡带；`im_root`→阿西莫夫三定律；`wake_up_samurai`→赛博朋克霓虹色调；`task_creator`→Windows任务管理器；`tool_time`→普罗米修斯盗火
- **P2 通用化 (11)**: `read_manual` 书结蜘蛛网；`error_resilient` 烈火锻造哑铃；`task_updater` 看板移任务；`file_purger` 春日开窗大扫除；`token_titan` 收银台结账；`command_baby`/`command_master` 丰富命令细节；`session_veteran`/`session_centurion` 修正 emoji；`delegator` 悠闲喝咖啡；`speed_run_bronze` 主动秒表
- **P3 小幅完善 (35)**: 时间标记补全（night_owl +3:00钟）、emoji修正、色调修正、梗彩蛋（thanos打响指、im_sorry_dave HAL字幕、hooks_master心形双关）、4 条 questline stage 引用实际子成就
- **第一轮 (19)**: 新增 49 条缺失像素画 + quality fix（first_try Smooth Criminal MJ、copy_paste_king 论文戏仿等）+ 4 条可选润色

### 成就提示 + Dashboard 外观系统 — 2026-06-11

为 9 个成就添加教育性 `tip`/`tip_cn` 字段，实现从已完成套装解锁视觉外观的外观系统：
- **YAML**: auto_mode, big_refactor, arrow_keys_edit, self_fix, debug_chain, tool_diversity, offline_first, tdd_champion, git_flow, js_ts_debug 添加 tip
- **API**: `buildCosmeticsResponse()` 从已完成套装提取 showcase_border/stat_counter/animation/theme
- **前端**: 角色头像区渲染 stat counter（提交数、Bug 数），应用展示框金色光晕和 Polar Night 暗色主题，Speedrun 套装加速 gacha 动画
- **测试**: 修复 banner 字体选择测试的环境变量隔离

### 文档数字同步 — 2026-06-11

根据代码核查同步 `docs/` 中过时数字：
- `issues-todo.md`: 套装成员 `71/208` → `74/208`
- `top10-next-todos-2026-06-10.md`: 成就总数 `203` → `208`
- `PROGRESS.md`: 更新日期到 2026-06-11

### 8 个 CRITICAL Bug 修复 — 2026-06-11

基于全代码审查报告（`docs/code-review-2026-06-11.md`）修复了 8 个致命问题：

| # | 问题 | 文件 | 修复 |
|---|------|------|------|
| C1 | Zod schema 丢弃 `tool_source` 字段 → 按工具统计全错 | `src/utils/validate.ts` | 显式添加 `tool_source` + `protocol_version` 可选字段 |
| C2 | `evalSequenceCount` 模式匹配在假启动后漏检序列 | `src/engine/evaluator.ts` | 指针重置后重检 `pattern[0]` |
| C3 | `evalSequenceCount` 忽略 `window` 字段 | `src/engine/evaluator.ts` | 开头加 `scopeEvents()` 调用 |
| C4 | 3 枚速通成就缺 `per_event: true` → 永远无法解锁 | `achievement-definitions.yaml` | `speed_run_bronze/silver/gold` 各加 `per_event: true` |
| C5 | `bug_hunter` 任务线引用不存在的成就 ID | `achievement-definitions.yaml` | `diagnostic_detective` → `triple_debugger`, `self_healer` → `bounce_back` |
| C6 | `git add` 误发 `git.commit` 事件 | `src/cli/hook.ts` | 拆分为 `git.add` 独立事件 + 防重叠 guard |
| C7 | Dashboard `renderTitlesRow` 变量遮蔽导致功能崩溃 | `src/dashboard/public/app.js` | `t` → `title` 重命名 |
| C8 | Config `set` 操作绕过 `VALID_KEYS` 校验 | `src/tools/config.ts` | 添加 key 校验，无效 key 返回 error |

**测试**: 1067/1067 全部通过 ✅ （新增 `git commit -a` 防回归测试）
**TypeScript**: 0 新错误 ✅ （2 个预存错误未受影响）

### 14 个 HIGH Bug 修复 — 2026-06-11

基于同一份审查报告的 14 个 HIGH 问题全部修复：

| # | 问题 | 文件 | 修复 |
|---|------|------|------|
| H1 | `evalDistinctCount` 忽略 `filter`/`role` 条件 | `evaluator.ts` | 添加 `matchFilter()` + `matchRole()` 调用 |
| H2 | poll 先存 state 再发 unlock 事件 → crash 不一致 | `engine.ts` | 调换顺序：先 emit 后 save |
| H3 | evalRatio/sequenceCount 手动操作符比较 | `evaluator.ts` | 统一使用 `evalOp()` 规范函数 |
| H4 | evalMode/patternMatch 不调用 `scopeEvents()` | `evaluator.ts` | 函数入口添加 `scopeEvents()` |
| H5 | loadPending raw JSON.parse + 无数组校验 | `poll.ts` | `safeParse(z.array(...), ...)` |
| H6 | 15+ 处 JSON.parse 违反正则 | 4 core files | profile.ts/poll.ts/history.ts/import.ts → safeParse；11 diagnostic 站点 try/catch 合理保留 |
| H7 | Import 命令无 schema 校验 | `import.ts` | 新增 `exportPayloadSchema` + `safeParse` gate |
| H8 | init.ts default profile 路径 bug | `init.ts` | 添加 `profile !== DEFAULT_PROFILE` 判断 |
| H9 | 4 个成就声明 set 但不在成员列表 | `achievement-definitions.yaml` | 补全 4 处 set 成员 |
| H10 | `infinite_loop` 缺 `per_event: true` | `achievement-definitions.yaml` | 添加 `per_event: true` |
| H11 | Bash 命令匹配用 `includes()` 太脆弱 | `hook.ts` | 替换为 word-boundary regex |
| H12 | `evalPredicate` fail-open | `evaluator.ts` | `return true` → `return false`（fail-closed） |
| H13 | IntersectionObserver 每 10s 新建 → 泄漏 | `app.js` | 复用现有 `_navObserver`，disconnect 后再建 |
| H14 | nav 事件监听器每 poll 累积 | `app.js` | 移至 `controlsSetup` 一次绑定 + 事件委托 |

**测试**: 1067/1067 全部通过 ✅
**TypeScript**: 2 预存错误未受影响 ✅

### Questline 成就旅程线系统全面实施 — 2026-06-11

- **5 条 RPG 旅程线**：Bug Hunter（除虫大师）、Toolsmith（工具匠人）、Builder（建造大师）、Night Shift（夜行者）、Polyglot（语言通才）
- **每线 3 阶段**（开始→中段→终章），~49 个成就覆盖（24%），成就可多归属
- **Dashboard**：新增"旅程" nav tab（成就与套装之间），可展开的横向进度卡片 + 阶段成就详细列表
- **完成奖励**：全部 3 阶段解锁获得专属 title（如"精英除虫师"、"工具大师"等）
- **YAML 权威源**：`achievement-definitions.yaml` 新增 `questlines:` 区块（130 行）
- **实现文件**：types.ts → yaml-parser.ts → engine.ts → api.ts → server.ts → index.html → styles.css → app.js
- **纯展示层**：不改 engine/evaluator，进度 = state.unlocked 查询，排列按完成百分比降序
- **设计/计划文档**：`docs/superpowers/specs/2026-06-11-questline-system-design.md` + `docs/superpowers/plans/2026-06-11-questline-system.md`

### buildQuestlinesResponse API — 2026-06-11

- **`src/dashboard/api.ts`**：新增 `buildQuestlinesResponse()` 函数，将 `QuestlineDefinition[]` 转换为带阶段进度、当前阶段和完成状态的响应数据；按完成百分比降序排列
- 新增 `QuestlineStageItem` 和 `QuestlineItem` 接口作为响应类型
- `DashboardData` 新增可选字段 `questlines?: QuestlineItem[]`
- `buildApiResponse()` 新增参数 `questlineDefinitions?: QuestlineDefinition[]`
- **`src/dashboard/server.ts`**：两处 `buildApiResponse()` 调用均传入 `engine.questlineDefinitions`

### 推荐系统 2.0 全面实施 — 2026-06-11

- **设计 spec**：`docs/superpowers/specs/2026-06-10-recommendation-system-2.0-design.md`（630 行完整设计）
- **实施计划**：`docs/superpowers/plans/2026-06-10-recommendation-system-2.0.md`（16 任务，3 阶段）
- **4 个接触点全部落地**：

| 接触点 | 功能 |
|------|------|
| `achievement_suggest` MCP tool | 返回 near_win + discovery + surprise 三类推荐，支持 `categories` 过滤 |
| `agpa suggest` CLI | 按类别分组终端输出，新增 `--near`/`--discover`/`--surprise` flags |
| Dashboard 浮动 widget | 左下角脉冲徽章（p=0.2 概率出现），点击展开 3 帧轮播大卡片，ESC/点击外部关闭 |
| `achievement_poll` prompt 注入 | 解锁成就后概率（默认 p=0.2）注入 `recommendation_prompt` 字段，Agent 在回复中自然推荐 |

- **推荐算法**：
  - **Near Win**：`progress-nudge.ts` 从 5 种扩展到 8 种 condition type（新增 sequence / pattern_match / ratio），top 5 按进度排序
  - **Discovery**：事件盲区法 — 扫描用户从未触发的事件类型，推荐关联成就（Common 优先）
  - **Surprise**：未解锁 hidden 成就 + 有 hint + session 确定性选取（djb2 hash，不依赖 Math.random）
- **新文件**：`src/utils/recommend.ts`（~240 行，8 个导出函数）+ `tests/utils/recommend.test.ts`（18 测试）
- **配置**：`recommend_probability` 通过 `agpa config recommend_probability <0.0-1.0>` 可调，默认 0.2，存储在 config.json
- **UI 决策**（通过 visual companion 确定）：浮动 widget + 脉冲光环徽章 + 轮播大卡片（5s 自动切换，hover 暂停）
- **修复**：widget `var(--surface)` → `var(--bg-surface)` 透明背景修复；rarity 字段 XSS escape

### Embed recommend data into Dashboard API response — 2026-06-11

- **新功能**：Dashboard API `/api/data?include_recommend=true` 现在返回 `recommend` 字段，包含以下三类推荐数据：
  - `near_win`：接近解锁的成就列表（前 5 个，基于 progress-nudge）
  - `discovery`：一个未被发现的成就推荐（基于事件盲区检测）
  - `surprise`：一个随机的隐藏成就提示（基于 sessionId 确定性哈希选取）
- **设计原则**：`include_recommend` 为可选 query 参数，默认为 false，避免对非 widget 消费者产生不必要的计算开销
- **实现位置**：`src/dashboard/api.ts`（buildApiResponse）和 `src/dashboard/server.ts`（GET /api/data handler）

### Top 10 下一阶段 TODO 路线文档 — 2026-06-10

- **新增产品路线文档**：`docs/top10-next-todos-2026-06-10.md`
- **内容定位**：基于当前项目状态、设计文档与 Steam 成就调研，总结 AGPA 下一阶段最有价值的 10 个方向
- **核心结论**：项目重心应从“继续补底层可用性”转向“Discovery / Structure / Collectibility / Trust”四个产品层面
- **Top 10 覆盖**：推荐系统 2.0、Questline/旅程线、成就作者工具链、像素画高价值试点、Profile Cosmetics、可解释层、精品内容扩展、Daily/Weekly Challenges、叙事化分享、文档真相源治理
- **附带结论**：明确不建议当前优先投入的方向，包括继续机械扩容成就数量、过早推进全球社区稀有度、以及继续将主要精力投向更多工具接入

### Wake Up, Samurai 成就 + time_gap 成对过滤扩展 — 2026-06-10

- **新成就 `wake_up_samurai`** — "Wake Up, Samurai" / 醒醒，武士 🔥，hidden rare，单 session 内跨天回归：深夜离去（任意时间），次日 7am 后发第一条消息。We've got a city to burn.
- **`time_gap` 扩展 — 成对过滤**：新增三个可选字段支持事件对的精确匹配：
  - `from_filter`：对配对中的**前一条**事件做 filter 过滤
  - `to_filter`：对配对中的**后一条**事件做 filter 过滤
  - `cross_day`：要求前后两条事件跨越不同的日历日（`date_str` 不同）
  - 当启用成对过滤时，评估模式从"最大时间间隔"切换为"符合条件的配对计数"
- **`matchFilter` 增强**：`hour` 字段现在从 timestamp 中自动推导（当 payload 未设置时），不再依赖 hook 端显式注入
- **测试更新**：auditor 成就计数 202→203；every-achievement 新增 wake_up_samurai 测试，time_gap 生成器支持 `cross_day` 跨日事件

### Gwent 成就 + session_duration_ms + dashboard 事件增强 — 2026-06-10

- **新成就 `how_bout_a_round_of_gwent`** — "How 'Bout a Round of Gwent?" / 来局昆特牌吗 ♠️，hidden rare，同一 session 中写代码 + 狂聊 + 打开 Dashboard 查看成就，且 session 已持续 ≥30min。不务正业的猎魔人。
- **Dashboard 事件增强**：`/api/data` 被访问时自动计算当前持续中的 session 时长（找最后一个 `session.start` 且无后继 `session.end`），附加 `session_duration_ms` 字段到 `dashboard.opened` 事件的 payload
- **evaluator 上下文扩展**：新增 `session_duration_ms` 数值字段，filter 表达式支持 `session_duration_ms >= 1800000` 类似语法
- **测试更新**：auditor 成就计数 201→202；every-achievement 新增 gwent 测试

### 有丝分裂成就 + has_doubled_lines boolean flag — 2026-06-10

- **新成就 `mitosis`** — "Mitosis" / 有丝分裂 🧬，hidden rare，一次编辑让文件行数恰好翻倍。细胞分裂了。
- **新 boolean flag `has_doubled_lines`** — hook.ts 在 `file.edit` 事件中本地计算 `total_file_lines === before_lines * 2`，evaluator 上下文新增对应字段，无内容泄露
- **测试更新**：auditor 成就计数 200→201；every-achievement 新增 mitosis 测试，counter 生成器支持从 filter 中提取 `== true` 布尔标志

### 灭霸成就 + ratio group_by + 行数变更追踪 — 2026-06-10

- **新成就 `thanos`** — "Thanos" / 灭霸 🧤，hidden epic，单 session 中所有修改文件的最终行数总和恰好等于修改前的一半。完美平衡。
- **新 condition 字段 `group_by`** — `ratio` 类型新增可选 `group_by` 字段，按指定字段（如 `file_path`）去重后再计算比率。每组取第一个事件的 denominator（初始状态）和最后一个事件的 numerator（最终状态），避免同一文件多次编辑的权重被重复计算
- **line-delta 追踪**：`file.edit` 事件新增 `new_lines`（新代码行数）、`before_lines`（编辑前文件行数）、`delta_lines`（净变化行数）三个字段，为代码增减分析打基础。使用 existing `ti.new_string` 在 hook 端本地计算，无内容泄露
- **yaml-parser / types 扩展**：`Condition` 接口和 `buildCondition()` 增加 `group_by` 字段透传
- **测试更新**：auditor 成就计数 199→200；every-achievement 新增 thanos 测试，ratio 生成器支持 `==` 精确匹配和 `group_by` payload

### Attention 判定优化 — 三档位打分：内建 API / matmul+softmax / QKV 投影层 — 2026-06-10

- **改写 `has_attention_pattern`** 检测逻辑：移除泛化的 `query`/`key`（太容易误匹配），改用三级打分制：
  - **Level A（内建 API，自带满分）**：`F.scaled_dot_product_attention`、`nn.MultiheadAttention`、`MultiHeadAttention` → 任一命中直接判 true
  - **Level B（中频指标）**：`softmax`、`matmul`/`transpose`、`multi_head`、`num_heads`/`nhead`、`scaled_dot`、`attn_weights`、`qkv`/`q_proj`/`k_proj`/`v_proj` → 命中 ≥ 2 即 true
  - **Level C（弱信号）**：`sqrt` + (`d_k` 或 `d_model`) → 仅在有 B 级指标时计为辅助分
- **要点**：`attention` 关键字仍是必要条件，然后 `isBuiltin || attnScore >= 2`

- **新成就 `matrix`** — "The Matrix" / 黑客帝国 💊，hidden rare，编辑一个 `.m` (MATLAB) 文件触发。红药丸还是蓝药丸？
- **新成就 `attention_is_all_you_need`** — "Attention Is All You Need" / 变形金刚 🚚，hidden rare，编辑包含 Transformer 经典 Multi-Head Attention 代码的 `.py` 文件触发。汽车人，变形出发！
- **安全增强**：`file.edit` 事件不再将原始文件内容写入事件日志。改用本地计算的 boolean 特征标志 `has_attention_pattern`，仅当文件中包含 "attention" + ≥2 个 QKV/softmax/multihead/scaled_dot 指标时才设为 true
- **evaluator 上下文扩展**：新增 `has_attention_pattern` 布尔字段
- **测试更新**：auditor 成就计数 197→199（两次累加），hook file.edit 新增 `has_attention_pattern` 测试覆盖

- **新增条件类型 `time_gap`**：检查同一窗口内连续两个同类型事件的时间间隔，支持 `unit` 字段（ms/s/m/h/d，默认 h）。在 `types.ts`、`evaluator.ts`（`evalTimeGap()`）、`yaml-parser.ts`（白名单）全链路实现
- **Filter DSL 增强**：`evaluator.ts` 新增 `<=` 和 `>=` 运算符支持；test 中新增 `time_gap` 用例（生成间隔>2h 的两个事件）
- **新成就 `mind_the_gap`** — "Mind the Gap" / 时光裂缝 ⏳，隐藏 epic，同 session 内两次 user.message 间隔≥2h 触发
- **测试更新**：auditor 193→194，every-achievement 194/194 通过，全量 1030/1034 通过

### 低电量成就（Last Stand）+ battery 检测 + filter DSL 扩展 — 2026-06-10

- **电池检测跨平台**：`src/utils/battery.ts`，支持 macOS（`pmset -g batt`）、Linux（`/sys/class/power_supply/`）、Windows（`wmic path Win32_Battery`），统一返回 `on_battery` + `battery_pct`
- **Hook 集成**：每次 `UserPromptSubmit` 自动检测电池状态，注入 `on_battery`/`battery_pct` 到 `user.message` payload
- **matchFilter 上下文扩展**：evaluator.ts 新增 `on_battery` (boolean) 和 `battery_pct` (number) 字段
- **Filter DSL 扩展**：新增 `<=` 和 `>=` 运算符支持（此前只有 `<` 和 `>`）
- **新成就 `last_stand`** — "Last Stand" / 背水一战 🪫，隐藏 rare，电池≤15% 时使用 Agent 触发
- **测试更新**：auditor 192→193，every-achievement 193/193 通过（含 battery_pct filter 解析），全量 1030/1033 通过，42 个测试文件

### 春节成就 — 2026-06-10

- **修正 `spring_festival`** — 从浮动范围改为精确查表（2020-2035 共 16 个精确公历日期），新增 `date_str`（`MM-DD`）filter 上下文配合 `in [list]` 语法实现
- **测试更新**：auditor 成就计数 191→192

### 节日成就（圣诞/元旦/情人节）+ month/day filter 支持 — 2026-06-10

- **matchFilter 增加 month/day**：从 `event.timestamp` 提取月份和日期，filter 表达式支持 `month == 12 && day == 25` 的语法
- **3 个节日隐藏 epic 成就**：
  - `merry_christmas` — "Silent Night, Code Bright"（圣诞日，12月25日）
  - `new_year_code` — "First Dispatch of the Year"（元旦，1月1日）
  - `code_valentine` — "Be My Code Valentine"（情人节，2月14日）
- **测试更新**：auditor 成就计数 188→191

### 关键词匹配成就 + user.message text_content + filter 增强 — 2026-06-10

- **`user.message` 事件新增 text_content**：hook.ts 在 `UserPromptSubmit` 时将用户消息经 `redactSecrets()` 脱敏（strip API key/Bearer/JWT/GitHub token/AWS key/SSH key/内联密码）后截取前 200 字符存入 payload.text_content，pattern_match 和 counter+filter 可以直接匹配关键词，同时防止凭据泄露
- **matchFilter 上下文扩展**：`evaluator.ts` 添加 text_content 字段，filter 表达式支持 `text_content contains 'keyword'` 语法
- **6 个关键词触发成就**：`please_maybe`（说"请"）、`say_please`（5次礼貌）、`magic_word`（说咒语）、`swear_jar`（说了脏话）、`tl_dr`（让 agent 总结）
- **移除** `rewrite_king`（"One More Time" 成就）
- **测试更新**：auditor 成就计数 183→188，全量 1025/1028 测试通过（3 个 banner 测试为已有失败）

### 数据迁移框架 + XP 系统调优 + Streak 乘法 + /achievements 命令增强 — 2026-06-10

- **数据迁移框架**：`src/engine/migrate.ts` 新建，`migrateState()` 在 `store.load()` 入口自动执行增量迁移链。只补字段不删不改，失败熔断，幂等。`AchievementState` 新增 `schema_version` + `migration_history`
- **XP 调优**：`XP_PER_TASK` 10→25（task 贡献从 micro→visible）。`calcStreakMultiplier()` +0.1/天，1.0x→2.0x，11 天封顶
- **Dashboard Streak 乘数**：Streak 卡片右下角显示金色 ×N pill，hover 显示"streak bonus"提示。中英双语 i18n 键
- **MCP stats 扩展**：`engine.stats()` 返回 `level` + `total_xp`，Agent 通过 `achievement.stats` 工具可直接读取等级/XP
- **`/achievements` 命令增强**：`compile-achievements.ts` 支持 `--profile` 参数；命令文件 XP 计算用真实值（50/100/200/...）；stats 模式显示 streak 信息；locked 模式显示 `📊 Progress-tracked` 标记；compile 和 init 输出含 `progress_trackable` 字段
- **测试更新**：XP 测试 14→18 测试（+7 multiplier 测试），1022 总测试通过（原有 3 banner 测试待修），TS 编译零错误

### Tip/Hint 覆盖 + Dashboard 渲染 + Session Mini Report + Hook launcher — 2026-06-10

- **Tip/Hint 内容**：81 tips (14→81, 85 个 Common/Uncommon 非隐藏)，143 hints (93→143, 147 个非隐藏)，hidden 0 tips。`scripts/generate-tip-hint-content.ts` 一键生成
- **Dashboard tip/hint 渲染**：`AchievementItem` 新增 tip/hint 字段；locked 卡片显示 💡 线索；unlocked modal 显示 💡 小贴士；中英双语标签；CSS `.ach-hint` + `.modal-tip-section`
- **Session Mini Report**：`src/utils/session-report.ts`，Fibonacci 间隔 (1,2,3,5,8,13,21...) 显示 session 总结（tasks、files、tool calls、tokens、duration）
- **Hook launcher 解耦路径**：`~/.agent-achievements/run-hook.sh` 替代 CC/Hermes hooks 中的绝对路径。项目移动后 `npm run init --upgrade` 重生 launcher，无需编辑 settings.json
- **`session_count` 字段**：`AchievementState.stats` 新增可选字段，供 Fibonacci 间隔计数
- **测试更新**：`tests/cli/init.test.ts` hookCmd 预期改为 `run-hook.sh`

### `agpa profile delete` + Dashboard 移除 dev-reset + 修复 Profile 下拉菜单 — 2026-06-10

- **`agpa profile delete`**：新子命令，交互式删除命名 profile（列出可删 profile → 输入名称 → 再次输入确认 → 输入当日日期确认 → 永久删除）
- **`deleteProfile()`**：`src/utils/profile.ts` 新增，递归删除 profile 目录，`default` 和 `_demo` 受保护
- **Dashboard 移除 dev-reset 按钮**：`index.html` 删除 🗑️ 按钮，`app.js` 删除 `devReset()` 函数及其引用
- **CLI 整合**：`index.ts` 帮助描述 + `completion.ts` shell 补全都更新了 `delete` 子命令
- **修复 Profile 下拉菜单**：HTML 内联 `style="display:none"` 阻塞 CSS `.open` 动画（已移除）；`getElementById('profile-selector')` → `querySelector()`；自动刷新时保留输入框 value；Demo 标签硬编码中文 → i18n 键

### `agpa banner` CLI — 3 主题系统 (Neon/Arcade/Gold) — 2026-06-10

- **`agpa banner [Neon|Arcade|Gold]`**：新 CLI 命令，运行时切换终端 banner 颜色主题，持久化到 config.json
- **config.ts**：新增 `BannerTheme` 类型、`banner_theme` 配置字段、`AGPA_BANNER_THEME` 环境变量覆盖
- **validate.ts**：Zod schema 新增 `banner_theme` enum 校验
- **index.ts**：CLI 命令注册 + 3 主题动态渐变渲染（Neon 青→紫、Arcade PS4 四色、Gold 品牌金色渐变）
- **completion.ts**：shell 补全添加 banner 子命令
- **banner.ts (新)**：`agpa banner` 运行时切换实现（展示当前主题 / 切换 / 显示色板）
- **scripts/**：5 个 banner 设计对比/预览工具

### 终端 ASCII Banner — figlet ANSI Shadow 游戏标题大字 — 2026-06-09

- **ANSI Shadow 字体**：街机/主机游戏标题风格，Unicode half-block 字符（█╔╗╚╝║═），33×6 大字 "AGPA"，金色渐变（亮金 → 暗金 5 级）
- **双层线面板**：`╔═╗║╚═╝` double-line box-drawing 替代单线，标题栏 `╔═ AGPA · Agent Player Achievements ══╗`，全终端居中
- **宽度膨胀**：标准模式框体占终端 82% 宽度，比原来大一圈
- **装饰底栏**：`⭐ github.com/... · v0.1.8 ⭐` 星号装饰版本号行
- **3 级自适应**：ANSI Shadow ≥80 列（6 行）、Small ≥60 列（4 行 compact）、纯文本 <60 列
- **依赖**：`figlet`（MIT, 8.5k+ stars），字体 lazy load ~5KB
- **测试**：16 个新测试覆盖 ANSI Shadow/Small 字体选择、双层线边框、边界值

### Dashboard 交互控件全面美化 + profile tools → softwares — 2026-06-09

- **`agpa profile tools` → `agpa profile softwares`**：CLI 命令、shell 补全、文档同步重命名
- **Tracked-tools bar 点击提示**：Dashboard 软件图标点击 → i18n toast "使用 agpa profile softwares 更改追踪工具"
- **语言选择器美化**：原生 `<select>` → 自定义 dropdown（🌐 地球图标 + chevron 翻转动画 + 玻璃感面板 + 国旗 emoji）
- **排序选择器美化**：原生 `<select>` → 自定义 dropdown（↕ 图标 + emoji 选项图标 + 同款动画模式）
- **三档开关重设计**：轨道 40px 加宽、凹槽内阴影、选中态金橙渐变 + 外发光、18px 旋钮弹性过渡、hover 金色边框
- **Profile 下拉动画化**：`display:none` → `opacity/visibility/transform` + `backdrop-filter` 玻璃感 + `scale(0.96)` 弹出
- **搜索框增强**：focus 金色发光（`0 0 16px`）、图标弹跳缩放、placeholder 提亮
- **Filter tabs**：凹槽容器 + 内阴影、active tab 金色渐变底部指示线
- **Category pills**：active 加强金色 glow + 外圈光晕 + hover scale(1.02)
- **Rarity pills**：active 各稀有度对应颜色 glow（6 种）
- **Share/Export 按钮**：hover emoji 弹跳 keyframe 动画 + 按压 inset shadow

## [0.1.8] — 2026-06-09

### Legendary/Mythic 卡片动画 + 称号 & 徽章系统 — 2026-06-09

- **Legendary 呼吸光效**：成就网格卡片 4s 边框光晕呼吸脉冲（`legendary-breathe` keyframe），与现有 `name-glow` 叠加，仅全动画模式下生效
- **Mythic 烟花动画**：`::before` 伪元素 3 个 box-shadow 粒子循环闪烁 + `::after` 径向渐变底光，卡片子元素 `z-index: 1` 防止遮挡
- **简化模式兼容**：`syncSimpleAnim()` 写入 `<body data-simple-anim="true">`，CSS 通过 `:not([data-simple-anim="true"])` 选择器自动关闭 Legendary/Mythic 特效
- **称号系统**：从已完成套装的 `reward.type === 'title'` 提取称号，金色 pill 文字 · 分隔，渲染在 Hero 统计行上方
- **徽章系统**：从已完成套装的 `reward.type === 'badge'` 提取徽章，圆角 pill 标签 + hover 金色辉光
- **空态引导**：0 称号且 0 徽章时显示斜体提示文案（中英双语），鼓励继续 Vibe Coding
- **数据管道**：零后端改动 — YAML reward 字段 → `buildSetsResponse()` → `SetItem.reward` 已有，纯前端渲染消费

### Dashboard 响应式布局 — 2026-06-09

- **4 个断点**（desktop-first，仅追加 194 行 CSS）：900px / 760px / 600px / 440px
- **平板横屏 (≤900px)**：Hero 标题缩小、Hero 卡片竖排堆叠、导航间距压缩、toast 位置调整
- **平板竖屏 (≤760px)**：导航链接可横向滑动、统计数字缩小、Section controls 竖排、Modal 近全屏、overflow-x 防护
- **大屏手机 (≤600px)**：品牌文字隐藏、Insights 单列、统计 2×2+1 布局、展示柜格子缩小、Insight canvas max-width 防溢出
- **小屏手机 (≤440px)**：统计全竖排、开关标签隐藏、时间线最小缩进、tracked tools 横向滚动
- **桌面端完全不受影响**：所有 `@media` CSS 在 >900px 不激活，现有样式一字未动

### Dashboard UX 优化 — 语言下拉框、档案切换、分享剪贴板 — 2026-06-09

- **语言选择器**：EN/中 toggle 开关 → 圆角 pill 下拉框，hover 金色边框+辉光，与 profile-btn 风格统一
- **移除右上角解锁计数**（`nav-stats` 0/0 badge）— 精简导航栏
- **移除"下一个目标"卡片**：删除 `renderNextAchievement()` / `scrollToAchievement()` / `.next-ach-*` CSS 共 ~100 行
- **等级圆环移除**：5 个统计项统一为纯数字 counter-animate，删除 `.stat-ring-*` CSS 43 行
- **Export 修复**：`apiUrl()` 始终追加 `?profile=`（默认档案不加导致跳回 demo）；export URL `?full=true` → `&full=true`
- **Share/Export 按钮重叠修复**：第二个 `.share-btn` CSS 块改为 `#card-preview .share-btn`，仅作用于预览卡片
- **📸 Share 按钮**：下载 PNG + `canvas.toBlob()` → `navigator.clipboard.write()` 复制到剪贴板，成功后左上角 toast "📋 Card image copied to clipboard"
- **Toast 容器**：从右下角 `bottom: 28px; right: 28px` → 左上角 `top: 72px; left: 28px`（避开 GitHub Star 按钮）
- **档案切换**：API 新增 `has_demo` 字段，档案下拉菜单始终显示 `🔬 Demo 数据` 条目（无论当前哪个档案）；切换时关闭下拉框、清除 URL hash
- **测试**：990 测试全绿，TypeScript 编译干净

### Demo 体验功能 — CLI + Dashboard 双通道新手引导 — 2026-06-09

- **CLI `agpa demo`**：`src/cli/demo.ts`（新建）— 模拟 1 天使用历史（3 sessions, 44 事件, 真实时间戳），精准解锁 5 个入门成就（Hello World / Prometheus / Hat Trick / Permission Granted / MCP Plug-in），终端彩色成就弹窗 + 统计总结，自动 spawn Dashboard `--profile _demo`
- **`_demo` 系统 profile**：`src/utils/profile.ts` 新增系统 profile 支持 — 独立存储于 `profiles/_demo/`，不占 4 个用户 profile 上限，`listProfiles()` 隐藏，`createProfile()` 阻止手动创建
- **Dashboard demo 模式**：导航栏紫色 `🔬 Demo 数据` badge + `切换到真实数据 →` 链接；紫色渐变引导 Banner（`👀 带我逛逛` + 关闭按钮，localStorage 持久化已关闭状态）
- **4 步产品导览**：`src/dashboard/public/tour.js`（新建）— 纯 JS/CSS 遮罩层，第 1 步成就面板 → 第 2 步统计行 → 第 3 步时间线 → 第 4 步热力图，自动切换 Dashboard tab，金色脉冲高亮 + tooltip 卡片
- **成就卡片金色辉光**：Demo 模式下已解锁卡片 `demo-glow` CSS 动画（2.5s 呼吸周期，金色 box-shadow）
- **API 扩展**：`DashboardData.is_demo?: boolean`，`/api/profiles` 和 `/api/data` 排除 `_demo` profile
- **移除旧版**：`src/cli/mvp.ts` 删除 `runDemo()` 函数，`index.ts` 的 `demo` command 指向新文件
- **测试**：profile `_demo` 3 测试 + demo 事件生成 5 测试 + 全量 990 测试全绿（39 文件）
- **Spec/Plan**：`docs/superpowers/specs/2026-06-08-demo-experience-design.md` / `docs/superpowers/plans/2026-06-08-demo-experience-implementation.md`

## [0.1.7] — 2026-06-08

### Dashboard 进程守护 — OS 级 daemon + health endpoint + Agent 感知 — 2026-06-08

- **Layer 1 — OS daemon（opt-in）**：`src/cli/daemon.ts`（新建）— macOS launchd plist / Linux systemd user unit，`KeepAlive` 崩溃重启 + `RunAtLoad` 开机自启，默认关闭，仅 `agpa init` 末尾询问
- **Layer 2 — `/api/health` endpoint**：`server.ts` 新增 GET `/api/health`，返回 `{ status, uptime, profile, version }`，5 行代码
- **Layer 3 — Agent 感知**：`achievement_stats` 返回 `dashboard_running: boolean`（fetch 127.0.0.1:3867/api/health, 500ms timeout）；AGENTS.md 新增 Dashboard health 指引
- **CLI 扩展**：`agpa web --daemon` 手动安装守护进程，`agpa web --no-daemon` 卸载；`agpa uninstall` 自动清理 daemon 配置
- **测试**：daemon 模块 8 测试 + `/api/health` endpoint 2 测试，全量 982 测试全绿（38 文件）
- **Spec**：`docs/superpowers/specs/2026-06-08-dashboard-daemon-design.md`

### Agent 成就感知 + 套装完成视觉奖励 — 2026-06-08

- **`achievement_suggest` MCP 工具**：新 MCP tool，复用 `findNearUnlocks()` 返回近锁成就，包含 AI 友好 `hint` 字段（中英双语），Agent 可在对话中自然提及
- **AGENTS.md 新增指令**：会话中适时调用 `achievement_suggest` 的指引
- **Dashboard 称号行**：完成套装后 Profile hero 区域显示金色 title pill（Founder/Polyglot/Maker 等），hover 显示来源套装
- **Dashboard 徽章 section**：Sets 下方新增 "🏅 Badges" section，展示 badge 型套装的收藏卡（streak_master/100% Complete），暗色渐变背景 + 金色呼吸辉光
- **API 扩展**：`DashboardData` 新增 `titles: TitleItem[]` 和 `badges: BadgeItem[]` 字段，`buildTitlesAndBadges()` 按 reward type 自动分类
- **测试**：suggest tool handler 13 测试 + 全量 975 测试全绿（37 文件）
- **Spec**：`docs/superpowers/specs/2026-06-08-agent-proximity-set-rewards-design.md`

### GitHub Star 提示 — 5 个触点的自然增长引导 — 2026-06-08

- **Dashboard 浮动按钮**：右下角 ⭐ "Star us on GitHub"，金色 hover 动效，移动端只显示图标
- **第 10 次成就解锁**：桌面系统通知（macOS/Linux/Windows）提醒 star
- **第 3 次成就解锁**：Agent TUI 终端尾部金色链接（仅 TTY）
- **`agpa upgrade` 成功**：git/npm 升级完成后金色提示行
- **`agpa` TUI 底部**：灰色低调链接，不干扰交互
- 所有触点的文案、颜色、时机经过协调设计（关联 vs 打扰）

### 像素画渲染管线补全 — YAML→类型→API→双端渲染 — 2026-06-08

- **强类型化**：`PixelArt` / `PixelArtSize` 接口替代 `Record<string, unknown>`（`src/engine/types.ts`）
- **YAML 解析**：`parsePixelArt()` 校验 48/128/256 三种分辨率，6 边界检查（palette 透明标记 ⬛、行数、列宽、索引字符合法性、36 色调色板上限、混合有效/无效分辨率按 key 跳过）
- **共享渲染器**：`src/utils/pixel-art.ts`（新建）— `renderPixelArtANSI()` 半块字符终端渲染（48 像素 → 24 行），`renderPixelArtSVG()` SVG data URI（`shape-rendering="crispEdges"`），`PixelArtBrowserJS` 内联 snippet
- **终端弹窗**：`ansi-popup.ts` — `PopupAchievement.pixel_art_48`，卡片上方 ANSI 像素画 banner，窄终端自适应降级
- **API 层**：`api.ts` — `AchievementItem`/`CardAchievement`/`SetAchievementMember` 均新增 `pixel_art_48`（只传 48×48 避免 JSON 膨胀）
- **Dashboard 浏览器渲染**：`app.js` — 内联 `PixelArtRenderer`，`iconHtml()` 第 3 分支（pixel_art → SVG `<img>`），9 个调用点传递 `pixelArt`
- **数据传递**：`hook.ts` → `PopupAchievement`、`helpers.ts` → `FormattedAchievement`
- **测试**：`tests/utils/pixel-art.test.ts`（新建）27 测试 — 解析校验、ANSI/SVG 渲染、YAML 集成、弹出窗集成、边界条件
- Emoji fallback 保留不变
- 9 文件 +907/-12，35 文件 / 924 测试全绿，TS 编译零错误

### 成就审计系统 Phase 1 + 2 — 规则引擎 + LLM 审计脚本 — 2026-06-08

- **审计规则引擎**：`src/verify/auditor.ts` — Layer A（数值/窗口/操作符一致性）+ Layer B（语义 type/event/window 匹配），EN + CN 描述双向核对
- **审计测试**：`tests/verify/auditor.test.ts` — 51 测试，含全部 183 成就集成（0 error）
- **LLM 审计脚本**：`scripts/audit-achievements.ts` — 双 Provider（Anthropic tool_use / OpenAI json_object），智能分批，与 Phase 1 联动（默认仅审计 102 个 flagged 成就），dry-run 模式，结构化 pass/warn/fail 报告
- **LLM 审计测试**：`tests/scripts/audit-achievements.test.ts` — 38 测试（prompt 构建、schema 验证、分组合并、CLI 解析）
- **手动 LLM 审计**：全部 183 成就人工语义核查 — 0 FAIL, 0 WARN
- YAML 3 个历史 Bug（`marathon`/`iterative_refiner`/`the_all_nighter` 缺 `per_event`）已于 Phase 1 修复
- 102 个 `needsLLMReview` 标记成就全部确认 — 描述与条件完全一致，无残留语义问题
- Test: 924 → 962（+38），文件 35 → 36
- **Bug `marathon`**：加 `per_event: true`（原 threshold 累加全部 session 的 duration，实际任何单 session 都不必 ≥ 3h 也能解锁）
- **Bug `iterative_refiner`**：加 `per_event: true` + `>`→`>=`（同累加问题；"20+" = ≥20，原 `>` 要求 21+）
- **Bug `the_all_nighter`**：加 `per_event: true`（同累加问题）
- **重命名**：`04-成就定义清单.yaml` → `achievement-definitions.yaml`（kebab-case，9 处代码/脚本引用 + 3 份文档同步更新）
- **Spec**：`docs/superpowers/specs/2026-06-08-achievement-audit-system-design.md`
- Phase 2（LLM 审计脚本）待实施；标注 103 个 `needsLLMReview` 成就

### CLI UX 大修 — 11 项用户体验改进 — 2026-06-08

- **#3 输错命令自动纠正**：Levenshtein 模糊匹配（距离 ≤ 3），`agpa dashbord` → "Did you mean **dashboard**?"
- **#4 Dashboard 离线化**：html2canvas 本地缓存（`public/lib/`），Server 端 CDN 懒加载+磁盘回退+内存缓存三级保障
- **#5 统一 `--json` 输出**：stats/progress/search/suggest/activity 等所有展示命令一致支持
- **#6 Shell 补全自动安装**：`agpa init` 末尾互动询问，自动检测 bash/zsh/fish 并写入对应 rc 文件
- **#7 交互式 TUI**：`agpa` 无参数进入 TUI，ASCII art logo + 实时状态 + 命令菜单 + 提示符
- **#9 init 分步指示**：3 阶段进度提示（Detecting → Configuring → Verification），每阶段前彩色分隔线
- **#10 自动升级**：`agpa upgrade --yes` 自动执行 `git pull && npm install` 或 `npm update -g agpa`
- **#13 reset 双重确认**：先显示当前进度摘要（解锁数/事件数/完成率），输入 "yes" 才执行
- **#16 Dashboard 防闪白**：内联关键背景色 CSS + `font-display: swap` 消除 Google Fonts 加载闪烁
- **#17 help 分组 + verify/doctor 澄清**：Setup/Dashboard/View 等 6 组分区；末行提示 verify = `doctor --quick`
- **#24 命令行进度条**：`agpa progress` 每个分类旁 `[████░░░░]` 色块进度条 + 总进度条
- 6 文件 +396 行，845 测试全绿，TypeScript 编译无错误

### 中英文名润色 + 误导 hint 清理 — 2026-06-08

- **tool_time**: `I Got Tools / 工具学徒` → `Prometheus / 普罗米修斯`
- **deepseek_dabbler**: `Deep Diversified / 深海探索者` → `Whale Song / 鲸歌`
- **whale_song**(旧): `Whale Song / 鲸歌` → `Orca / 杀手鲸`
- **u_turn**: `Scorched Earth Redux / 推倒重来` → `Remastered / 重制版`
- **first_try**: `一次就过` → `尽享丝滑`
- **off_the_grid**: 删除 hint（原本错误指向"深夜凌晨"）
- **cerberus**: 删除 hint（原本错误指向"连做三次"）
- 1 文件，11 行插入 / 13 行删除

## [0.1.6] — 2026-06-08

### Dashboard 视觉大修 — 字体/氛围/等级环/计数动画/卡片时间线/图表动效 — 2026-06-08

- **字体升级**：Body → DM Sans、Display → Plus Jakarta Sans、Mono → JetBrains Mono，通过 Google Fonts 加载（`--font-display` 新增变量）
- **背景氛围**：暗/亮双主题 body 叠加 ambient blue+purple radial-gradient 辉光 + 微点噪声纹理（24px 网格），主题切换自动适配
- **等级进度环**：Level 统计替换为 gold conic-gradient 圆环（`--ring-pct` CSS 变量驱动），环形内衬与背景同色随主题变化
- **统计数字计数动画**：首屏加载时 XP/Unlocked/Complete/Events 从 0 → 目标值滚动（requestAnimationFrame + ease-out cubic，1200ms），auto-poll 渲染跳过动画直接显示终值
- **Showcase 增强**：稀有度专用呼吸辉光动画（Rare+ 3 种 `slot-glow-*` keyframes），悬停 icon scale 1.15 + rotate -3deg
- **Section 交叠入场**：6 个 section(`<section>`) 依次 fade-in + translateY（偏移 0.06s 间隔）
- **卡片 icon wiggle**：已解锁成就卡片 hover 时 icon 执行 400ms 弹性 wiggle 动画
- **时间线卡片化**：移除旧 `tl-ach-row`/`tl-name`，改用于完整 `.tl-ach-card`（稀有度色左边条 + 圆角 icon 容器 + 彩色名称 + rarity badge），交叠入场动画（`--tl-delay` 逐项偏移 60ms），hover 时卡片右移 4px + 辉光 + strip 扩展 + icon scale 1.12
- **时间线日期 badge**：原 `tl-time` 改为 `.tl-date-badge` pill（📅 图标 + 渐变背景），hover 时文字淡入
- **图表绘制动画**：`drawLineChart()` 重构为 `drawStatic()` + `drawPartialLine(count)` 拆分，首屏 canvas 从左到右逐帧绘制折线+area fill（ease-out cubic），`canvas._animated` 标记防止重复动画
- **图表 CSS fade-in**：所有 insight canvas opacity 0→1 渐入（`chart-fade-in` 0.6s 0.15s 延迟）
- 845 测试全绿，3 文件 +450/-80 行

### Dashboard 细节打磨 — Hero/套装/筛选/空状态/Modal — 2026-06-08

- **Hero 标题**：gold shimmer 渐变动画（`hero-shimmer` 4s 循环），新增金色装饰分隔线（`hero-accent` 3px）
- **Share/Export 按钮**：统一为金色镶边胶囊 pill（`border-radius: 20px`），hover 时 golden glow + lift
- **套装卡片**：100% 完成套装箱金边呼吸辉光 + 右上角 gold ✓ badge（`set-complete-glow`）；成员图标 hover scale 1.15；名称改用 `--font-display`
- **筛选/搜索栏**：filter/category/rarity pill hover 时 `translateY(-1px)` lift；search icon focus 时 scale 1.1 + gold 变色（`focus-within`）；sort select 增加 focus ring
- **空状态**：统一 `.empty-state` 样式（浮动 emoji 动画 `empty-icon-float` + 加强文案排版），应用于无套装/无时间线
- **Modal 装饰**：`.modal-container::before` 顶部稀有度色条，通过 `--modal-rarity-color` 赋值，未锁定成就显示对应 rarity 颜色
- 845 测试全绿，3 文件 +239/-52 行

### Dashboard 收尾 — 进度条金渐变 + 火焰动画 — 2026-06-08

- **进度条美化**：`ach-progress-fill` 改为蓝→绿渐变（default），达到 100% 时替换为金→琥珀渐变 + 呼吸辉光动画（`progress-full-glow`）
- **火焰动画**：Streak 卡片的 🔥 emoji 增加 `streak-fire` 2s 弹性摆动（scale + rotate 组合 loop）
- 845 测试全绿，1 文件 +24/-2 行

### CLI 大扩展 + Hook 测试覆盖 + 文档同步 — 2026-06-08

- **4 新命令**：`agpa completion <bash|zsh|fish>`（Shell 自动补全）、`agpa upgrade [--check]`（版本检查+升级引导）、`agpa watch [--poll <sec>]`（实时成就监控，非 TTY 输出 JSON 快速退出）、`agpa history [--N] [--event] [--today] [--json]`（事件日志浏览，彩色表格式输出 + Top 5 事件类型统计）
- **CLI 增强**：`--json` 输出支持（stats/progress/search/suggest/activity，脚本化消费）；`--profile` 一致性（stats/progress/reset/search/suggest/activity/watch 全部支持）；`init --auto`（非交互模式，一键全自动配置）；`init --upgrade`（仅刷新 hooks+instructions+commands，不动 MCP 配置）；`uninstall --yes`（`--all` 别名，脚本友好）；`doctor --quick`（= verify 的 6 项检查）；`watch` 非 TTY 模式输出 stats JSON 立即退出
- **verify 合并到 doctor**：`agpa verify` → `doctor --quick`，共享检查函数，消除 ~350 行重复维护
- **init auto-verify**：`agpa init` 完成后自动运行健康检查（5 项）并显示摘要
- **Hook 测试覆盖率**（750→845 tests，+95）：`normalizeHermesStdin` 35 tests（原 0），4 个事件/工具映射表完整性检查，Bash git 事件全覆盖（push/pr_created/bisect/merge/file.delete），`file.language_used` 5 tests，图片扩展名全 8 格式检测，`computePromptPayload` 边界情况，`parseTranscriptJsonl` 有效/混合/无效行，`UserPromptSubmit` 中文+代码块+hash 指纹
- **hook.ts 导出**：`HERMES_EVENT_MAP`、`HERMES_TOOL_MAP`、`normalizeHermesStdin` 从 `const` → `export const`
- **文档同步**：CLAUDE.md / README.md / README.zh-CN.md / PROGRESS.md / issues-todo.md — 722→845 tests，29→33 files，20→24 CLI commands，171→183 achievements
- 构建 + 845 测试全绿（33 文件）

### 全面审视 + 修复 — 2026-06-08

- **Bug 修复**：`evalPredicate` `<`/`>` 非数字值改回 `false`（fail-safe）；`file.create` 仅在文件首次创建时触发（birthtime ≈ mtime 检测）；`crypto.randomUUID` 去重提取为 `uuid()`；CSS `card-in` keyframes 重名冲突修复
- **测试覆盖率**：22 文件 550 测试 → 29 文件 722 测试，新增 init(54)、verify(25)、customize-api(19)、server(22)、doctor(26)、uninstall(17)、import(7) 共 7 个测试文件
- **主题常量提取**：`src/utils/theme.ts` — 共享 ANSI/RARITY/RARITY_HEX/RARITY_RANK/RARITY_LABELS，showcase/search/suggest/verify/notify 全部改用该模块，消除 ~80 行重复
- **`createEngine` 去重**：`src/engine/factory.ts`，showcase/search/suggest 3 个 CLI 文件各减少 10 行
- **`agpa uninstall`**：新增卸载命令，支持 `--all`/`--dry-run`/`--keep-data`，清理 MCP 配置、CC hooks、Hermes hooks、指令块、插件文件、命令文件、数据目录，注册为第 20 个 CLI 命令
- **跨平台通知增强**：Linux `notify-send` 增加点击跳转 Dashboard 的 action 按钮 + 分类分组；Windows 改用原生 ToastNotification API（含 MessageBox 回退）；notify.ts 改用共享 RARITY_RANK
- **Dashboard 导出按钮**：Hero 标题旁新增 📦 Export 按钮，一键下载完整 JSON 备份（含事件日志）
- **init.ts 完善**：summary 框新增 `agpa uninstall --all` 提示，纯函数导出供测试
- **doctor.ts 完善**：导出所有检查函数 + 纯工具函数，checkDataDir/checkEventLog/checkStateJson/checkDefsYaml 接受 baseDir 参数，加执行守卫
- 构建 + 722 测试全绿

### Dashboard UX 打磨 — 2026-06-08

- **Error Boundary**：`renderSafe()` 包裹全部 10 个 render 函数，任意渲染崩溃不白屏，顶部红色 banner 显示错误详情可关闭
- **Canvas Retina**：`setupRetinaCanvas()` 统一适配 4 张 Insights 图表，2×/3× 屏幕线条文字不再模糊
- **热力图**：色谱 GitHub 绿→蓝青，与 Dashboard 主色调统一，图例从底部横排改为右侧竖排节省空间，tooltip 从上方改为下方避免滚动容器截断
- **Showcase 卡片化**：橱柜从独立 1×6 行移入 hero-cards-row，2×3 网格 + icon-only 槽位，Auto/重播按钮在标题栏内联
- **Streak 卡片重设计**：左侧当前连胜（🔥+大数字金色渐变）+ 居中竖线分割 + 右侧历史最高（📅+Best），右上角 Today pill 绝对定位
- **统计行扩展**：取消 XP 进度条，新增 Level、XP、Events 三项统计（Unlocked + Complete 保持不变）
- **Hero 标题**：`Agent Achievements` → `Agent Player Achievements` / `Agent 玩家成就`
- **Hero 宽度**：`max-width: 960px` → `1160px`，与下方成就区对齐
- **Gacha 重播**：解锁成就详情 Modal 右下角新增 🎴 Replay 按钮，重播动画后卡片不自动消失，需用户点击或按键关闭
- **安全**：Modal replay 按钮 inline onclick → `data-ach-id` + 委托事件监听
- 测试 550/550，tsc 零错误，4 文件

### Timeline 里程碑 + Insights 趋势看板 — 2026-06-07/08

- **Timeline 重写**：同日合并显示（"同一天"标签）+ 里程碑卡片（第10/50/100个成就、首个 Mythic、套装集齐），橙色渐变背景+左边框醒目样式，中英双语
- **Insights Tab**：3 个 Canvas 2D 折线图（每日 Session / Tool / Task 30天趋势）+ 24h×7d 编码活跃热力图，hover 显示日期+数值 tooltip，10 秒自动轮询刷新
- **后端**：DailyBucket +`tasks_completed`（可选，向后兼容），API 暴露 `daily_stats[]` 数组，zod schema 同步
- **CSS**：milestone 卡片、多成就分组、insights 2列网格、热力图图例、响应式 (@800px)
- 测试 550/550，tsc clean，22 文件全绿

### 系统可触发审计 & 全量修复：不可达成就 8→0 — 2026-06-07

- **替换纯文字 Toast**：新增 `gacha-reveal.js`（439 行），6 级稀有度渐进式翻牌解锁动画系统
- **6 级动画矩阵**：
  - Common：淡入 0.6s，无翻转无粒子
  - Uncommon：缩放入场 1s + 辉光脉冲
  - Rare：CSS 3D 卡片 180° 翻转 1.5s + 12 金色粒子
  - Epic：翻转 2s + 30 火焰粒子喷射 + 冲击环 + 屏幕边缘辉光
  - Legendary：翻转 3s + 60 星尘粒子（带拖尾）+ 冲击环 + 屏幕震动
  - Mythic：从天而降 4s + 落地冲击波 + 100+ 红金粒子爆炸 + 全屏辉光
- **多成就排队**：按稀有度降序逐一播放，动画启动时 renderAll() 延迟到队列排空后执行
- **跳过机制**：点击动画任意位置跳到当前成就详情 / Esc 跳过全部队列
- **简化动画模式**：持久化配置 `simple_animations`（`src/config.ts` + `src/utils/validate.ts` + `src/dashboard/server.ts` API）
- **导航栏开关**：✨/🎴 switch 切换全动画 / 简化模式（reuse 现有 CSS switch 模式）
- **Canvas 粒子系统**：仅 Epic+ 激活，`requestAnimationFrame` 驱动，低核设备（<4）自动降半
- **音效同步**：Rare+ 在翻转瞬间触发稀有度音效；Common/Uncommon 在动画结束时触发
- 新增 ~235 行 CSS（overlay/card flip/particle container/5 组 @keyframes 动画）
- 7 次 commit，全部 549 测试通过，tsc 零错误

### AGPA Logo 像素画 + README 双语改版 — 2026-06-07

- 128×128 像素画 logo：屏幕上 `>_`（绿色） + 思考云（蓝白色）通过数据线连接 PS4 DS4 手柄（PS4 官方按键配色）
- 暗色版（深蓝 #0a0e17 背景）和亮色版（白色背景）双主题
- Dashboard 集成：favicon（32px）、导航栏 logo（24px，主题自动切换）、分享卡片底部水印
- README 双语改版：全新结构（Logo hero、Badges、快速开始、工作原理、功能特性、Dashboard、架构图、FAQ），新增 `README.zh-CN.md` 中文版
- 参考 `modelcontextprotocol/servers`、Continue.dev、`anthropic-quickstarts` 等热门 MCP 项目 README 结构
- 设计文档：`docs/superpowers/specs/2026-06-07-agpa-logo-design.md`
- `.gitignore` 添加 logo PNG 例外规则

### 12 新成就：语言深度/广度 + 测试/时间维度 — 2026-06-07

基础设施：
- **`src/utils/lang-detect.ts`** — 35+ 编程语言扩展名→语言名映射模块
- **hook.ts auto-track 扩展**：文件 Read/Write/Edit 时自动调用 detectLanguage() 发射 `file.language_used` 事件
- **hook.ts 所有事件 payload** 注入 `hour`/`day_of_week`（替代仅 git.push 特有），`the_scheduler` 成就依赖此机制
- **evaluator.ts matchFilter** 上下文新增 `language` 字段，支持 `filter: language == 'python'` 表达式

语言深度成就（7 个，`linguist` 套装）：
- `pythonista` — Pythonista 🐍，50×Python 文件，Common
- `type_astronaut` — 类型宇航员 📘，50×TypeScript 文件，Common
- `web_weaver` — 网络织者 🕸️，50×JavaScript 文件，Common
- `bean_counter` — 咖啡豆计数员 ☕，50×Java 文件，Uncommon
- `pointer_pilot` — 指针领航员 🔗，50×C/C++ 文件，Rare
- `ferris_fan` — 螃蟹粉丝 🦀，50×Rust 文件，Rare
- `go_getter` — 进取者 🏃，50×Go 文件，Uncommon

语言广度成就（2 个，`linguist` 套装）：
- `smorgasbord` — 丰盛大餐 🧩，单 session 6+ 语言，Rare challenge
- `full_spectrum` — 全光谱 🌈，累计 10+ 语言，Epic

测试/时间维度（3 个）：
- `test_champion` — 测试冠军 🏆，500×test.pass，Epic（`endurance` 套装）
- `the_scheduler` — 日程规划师 📅，12+ 不同时段启动 session，Uncommon
- `power_session` — 全力冲刺 ⚡，单 session 25+ tool 调用，Uncommon（`endurance` 套装）

套装变更：新增 `linguist`（9 成员，Polyglot 称号），`endurance` 5→7
测试：519→549（+30），26 文件全绿，tsc 零错误

### 5 新成就：基于真实事件填充 — 2026-06-07

- `scribe` — Scribe / 笔耕不辍，file.write×50，Common tool_mastery
- `shipper` — Ship It / 一键发货，git.push×10，Common workflow (set: git_flow)
- `in_the_zone` — In the Zone / 心流状态，task.complete×5/single_session，Rare challenge
- `meltdown` — Meltdown / 熔断，tool.failure×5/single_session，Uncommon hidden
- `achievement_hunter` — Achievement Hunter / 成就猎人，achievement.unlocked×50，Rare community (set: completionist)
- 全部基于 hook 自动写入的真实事件（tool.requested/file.write/git.push/tool.failure/task.complete），零手动 track
- 测试 514→519（+5 自动覆盖），171 成就/24 文件全绿

### CLI 扩展：6 新命令 — 2026-06-06

- `agpa config` — 通用配置中心：查看/修改 lang、sound、profile、debug 等设置
- `agpa profile switch <name>` — 命令行切换活跃 profile（不需进 Dashboard）
- `agpa showcase` — 展示柜管理：`list`、`pin <id> [slot]`、`unpin <slot>`、`auto-fill`
- `agpa search [query]` — 终端搜索成就：关键词 + `--rarity`、`--category`、`--unlocked/--locked`
- `agpa suggest` — "下一步做什么"：展示最近解锁成就进度 + 进度条，支持 `--N`、`--all`、`--hidden`
- `agpa web` — `dashboard` 别名，更直觉
- CLI 从 16 命令扩展至 19 命令，5 个新模块（config.ts/search.ts/showcase.ts/suggest.ts + profile switch），tsc 零错误，514 测试全绿

### suggest 过滤修复 + 安全加固 — 2026-06-06

- `progress-nudge.ts` 忽略 `filter` 字段导致 `agpa suggest` 过度计算（seeker 显示 8350%），新增 `scopedEvents()` 统一合并 window/event/filter 三层过滤，所有 5 个进度计算函数全部修正
- `matchFilter` 抛异常时 fail-open（return true）→ fail-closed（return false），防止畸形 filter 导致误计数
- `matchFilter` 改为 `export` 供 progress-nudge 复用，去掉重复的 try-catch 包装

### Kilo Code / OpenCode 双通道 + 交互式安装 — 2026-06-06

- Kilo Code / OpenCode auto-track：`hook.ts` 新增 `kilocode-auto` 模式、`KILOCODE_EVENT_MAP`、`KILOCODE_TOOL_MAP`、`normalizeKilocodeStdin()`，`init.ts` 生成 `Bun.spawn` TS 插件，监听 32+ 事件
- 交互式安装：语言 → profile 创建 → 多选工具（↑↓ Space Enter），非 TTY 自动全选
- Profile-tracked_tools：`profile.json` 记录跟踪工具，Dashboard 官方 logo 徽章展示
- Dashboard Hero 布局重构：Streak + 热力图同行，展示柜 + 统计同行，Share 右上角
- 安全：`--profile` CLI 验证、config 测试隔离 `setConfigDir()`、XSS defense-in-depth
- 测试：484→514（+30），23 文件全绿

### Dashboard 分享成就卡片 — 2026-06-05

- `src/dashboard/api.ts` — 新增 `buildCardResponse()`，聚合 stats + 展示柜成就 + 热力图 + 里程碑 → CardData JSON
- `src/dashboard/server.ts` — 注册 `GET /api/card` 路由
- `src/dashboard/public/index.html` — 新增 📸 Share 按钮 + 隐藏卡片 DOM + html2canvas CDN
- `src/dashboard/public/styles.css` — 新增卡片预览样式（Steam 深色主题，420px 宽 layout）
- `src/dashboard/public/app.js` — 新增 `generateCard()` + `buildCardHTML()`，html2canvas 截图 + 下载 PNG（840px @2x）
- 支持中英双语、进行中成就补位、稀有度分布、里程碑时间线
- 新增 6 个 API 测试，全量 484 ✅

### 终端 ANSI 弹窗 + 进度感知 — 2026-06-05

- `src/utils/ansi-popup.ts` — ANSI 256 色成就解锁弹窗渲染器（Unicode 框线 + 6 级稀有度着色 + 进度条）
- `src/utils/progress-nudge.ts` — 近锁成就计算器，支持 counter/threshold/streak/distinct_count/sequence_count 5 种条件类型，过滤 hidden/future/已解锁，按完成度排序取 top 3
- `src/cli/hook.ts` `cmdPoll()` — 集成 ANSI popup + progress nudge 输出（Stop hook 触发时）
- `src/engine/evaluator.ts` — `evaluateMetric` 改为 export 供 progress-nudge 复用
- Non-TTY fallback：管道/CI 环境自动跳过 ANSI 渲染，保持纯文本
- 新增 26 个测试（ansi-popup: 12, progress-nudge: 14），全量 478 ✅

### Init 体验优化 — 2026-06-05

- `agpa init` 新增 pre-flight 检查：Node ≥ 18 + tsx 已安装，不满足报错退出
- 输出文案去技术化：MCP → Tracking、Hooks → Auto-track、Instruct → Instructions
- 总结框重构：重启警告置顶，下一步指引更简洁
- 新增方向键交互式语言选择（English / 中文），非 TTY 默认 en
- 所选语言写入 MCP env `AGPA_LANG`，控制成就通知/Dashboard/activity 展示语言

### P0-P1 全线实施 — 2026-06-05

基于 Round 3 竞品调研（12 项目 × 40+ 维度）的 Gap Analysis 全部 6 条建议（P0-1, P1-1~P1-4）完整落地：

**P0-1: JSONL 解析 (Stop hook session.end)**
- `src/cli/hook.ts` — `parseTranscriptJsonl()` 纯函数，逐行解析 CC JSONL transcript
- `cmdTrack()` session.end 分支 — 自动读取 `$CLAUDE_TRANSCRIPT_PATH`，写入 `token.consumed` + `user.message.batch` + `session.stats` 事件
- 新增事件类型：`token.consumed`, `user.message.batch`, `session.stats`
- 复活 3 个 dead achievements: `token_1m`, `token_titan`, `token_legend`

**P1-2: UserPromptSubmit Hook (CC hook → user.prompt)**
- `mapEvents()` 新增 `UserPromptSubmit` case → 生成 `user.prompt`（char_count/word_count/prefix_hash/has_code_block）+ `user.message`（source: hook_auto）
- `computePromptPayload()` — SHA-256 前 20 字符 hash，隐私保护，不存原文
- `HookStdin` 新增 `prompt_text` 字段
- `init.ts` `getHookKeys()` 新增 `UserPromptSubmit` hook key（async: false，高频同步）
- 新增事件类型：`user.prompt`

**P1-1: Usage-based XP (成就 + 活动双轨)**
- `src/dashboard/xp.ts` — `calcUsageXP()` / `calcUsageBreakdown()` 5 维 sqrt 公式
- Level = achievement XP + task XP + usage XP（sqrt 防通胀：10000 调用 → 100 XP）
- `api.ts` 集成，`DashboardStats` 新增 `usage_xp` + `usage_breakdown` 字段

**P1-4: 数据导出/导入**
- `src/cli/export.ts` — `agpa export [profile] [--full] [--migrate] [--output <path>]`
- `src/cli/import.ts` — `agpa import <file> [--dry-run] [--force]` + merge/replace 冲突解决
- `src/cli/types.ts` — `ExportPayload` 共享类型（format_version 1.0）
- `src/dashboard/server.ts` — `GET /api/export` 端点（Content-Disposition attachment）
- `src/cli/index.ts` — 注册 `export` / `import` 两个子命令
- `src/engine/engine.ts` — 新增 `saveState()` / `saveStats()` / `appendEvents()` 公共方法

**P1-3: 日聚合缓存 (增量更新 + 零扫描热力图)**
- `src/engine/stats.ts` — `DailyBucket` 接口 + `aggregateDaily()` + `mergeDaily()` + `computeStats()` 增量模式（`last_aggregated_line`）
- stats.json v2.0 — `daily` 字段 + 向后兼容 v1.0 schema
- `src/utils/activity.ts` — `computeHeatmapFromDaily()` / `calcStreakFromDaily()` 从 daily cache 零扫描
- `src/dashboard/api.ts` — 优先使用 daily cache，fallback 事件扫描
- `src/engine/engine.ts` — `poll()` 传入 existing stats 做增量
- `src/utils/validate.ts` — `dailyBucketSchema` + agentToolStatsSchema 升级为 v2.0 union

**测试:** +30 tests → 150/150 ✅ (stats: +11, xp: +9, hook: +10)

### Bugfix: reset 漏删 stats.json + single_task 会话泄露 — 2026-06-05

- **`store.reset()` 漏删 `stats.json`** — `store.ts` 新增 `statsPath` 清理，修复 reset 后 Dashboard stats 残留旧数据（heatmap/streak/usage_xp 显示异常直到下次 poll 覆盖）
- **`scopeEvents()` 单 task 边界泄露** — `evaluator.ts` 三层语义边界重构：0 task → 限当前 session（原行为 return entire events），1 task → 从最近 `session.start` 切片（原行为 `slice(0,)` 泄露前序 session 事件），≥2 task → 不变。修复 20+ 个 single_task 成就规则边界

### 测试覆盖扩展 P0-P1 — 2026-06-05

新增 53 个测试用例，7 文件→11 文件，150→203 tests：

**P0: 引擎层脆弱路径锁死（+18）**
- `tests/engine/store.test.ts`（12） — `reset()` 4 文件清理、load 损坏恢复、saveState+appendEvent 全周期、loadStats 缺失/损坏/corrupt schema
- `tests/engine/evaluator.test.ts`（+3）— `scopeEvents` 三层边界：0 task 限当前 session、1 task 跨 session 隔离、无 session.start fallback
- `tests/engine/stats.test.ts`（修复 1 个时序断言, 21→21）

**P1: 工具函数 + 安全边界（+35）**
- `tests/utils/activity.test.ts`（15）— `calcStreak` 全部路径（空/单日/连续/中断/历史最长）、`computeHeatmap` 量变分位桶、`calcStreakFromDaily`/`computeHeatmapFromDaily` 对称覆盖
- `tests/utils/profile.test.ts`（16）— `validateProfileName` 12 场景（合法/空/大写/数字开头/特殊字符/超长/保留名）、`resolveProfileDir` 穿越防御
- `tests/tools/registry.test.ts`（7）— `findTool` 按 id/别名/未知查找、TOOLS 结构完整性

### 场景矩阵集成测试 + streak 窗口 bugfix — 2026-06-05

- **YAML Bugfix**: `streak_3`/`streak_7`/`streak_30` 缺少 `window: all`。默认 24h 窗口使这些每日连续成就永不可达（单个 24h 时间窗口最多容纳 2 个日历日）。修复：追加 `window: all`。（6/5 fix）
- **Approach A — 6 个标准使用场景** (`tests/engine/integration.test.ts` 全面重写)：
  - S1 newbie: 最小 session → first_contact + tool_time；验证三公司/链式反应不触发
  - S2 power user: 3 session × 2 task × 3 tool → dual_wielder + three_company
  - S3 daily driver: store.appendEvent 14 连续天 → streak_3 + streak_7，不触发 streak_30
  - S4 commander: MCP/agent spawn/plan mode/git/命令/插件 → 8 个对应成就
  - S5 error recovery: 3 轮 fail→fix→pass → the_debugger + triple_debugger
  - S6 baseline: 最小触发（单消息+单工具）验证引擎能解锁

**Approach B — 逐成就触发测试** (`tests/engine/every-achievement.test.ts`): 为每个成就自动生成最小触发事件并验证解锁。153/160 可达，7 跳过的包含 2 future + 5 set_completion（需 evaluator 修复 future 过滤）。覆盖 11 种条件类型、filter && 链、role、consecutive sequences、per_event、metric 表达式。

**YAML Bug 修复**: streak_3/7/30/100 + daily_checkin 补上 `window: all`（5 个成就永不可达）；`mcp_explorer` 补 `field: server_name`（`distinct_count` 缺 field）。

**Evaluator 修复**: `evalSetCompletion` 全部 3 个分支（all/exclude_hidden/rarity）排除 `future: true` 成就，修复 4 个 completionist 成就。

**测试总量**: 18 文件, 444 tests ✅

### P1-1~P1-4 设计文档 — 2026-06-05

基于 Round 3 竞品调研 + Gap Analysis 的 6 条建议，完成 4 篇 P1 优先级设计文档：

- **P1-2: UserPromptSubmit Hook** (`2026-06-05-user-prompt-submit-hook-design.md`) — CC hook `UserPromptSubmit` → `user.prompt` 事件（char_count/word_count/prefix_hash 隐私保护），`user.message` 双通道（hook auto + MCP track）共存去重。~1 天工作量。
- **P1-1: Usage-based XP** (`2026-06-05-usage-based-xp-design.md`) — 成就 XP + 活动 XP 双轨。`calcUsageXP()` = sqrt(toolCalls + sessions×10 + messages×5 + tokens/1000×0.5 + uniqueTools×20)，Level 合并计算，sqrt 防通胀。~1-2 天工作量。
- **P1-3: 日聚合缓存表** (`2026-06-05-daily-aggregation-cache-design.md`) — stats.json 新增 daily buckets，增量更新（last_aggregated_line），Dashboard 热力图零扫描。~2-3 天工作量。
- **P1-4: 数据导出/导入** (`2026-06-05-data-export-import-design.md`) — `agpa export/import` CLI + Dashboard 按钮 + merge/replace 冲突解决 + `.agpa-export.json` 格式。~1-2 天工作量。

Specs 目录当前共 7 篇设计文档。

### Agent 工具使用统计系统 — 2026-06-04

新增按 Agent 工具（CC/Hermes/OpenClaw 等）的 usage 统计数据，统一通过 MCP Channel B 采集：

- **三种指标** — session 次数、用户发言次数 (`user.message`)、使用时长（同 session 首条→末条用户消息差值），均按 `tool_source` 分组
- **`src/engine/stats.ts`** — `computeStats()` 使用 timestamp window 策略关联 session 与 user message（规避 MCP/Hook 跨进程 session_id 不一致问题），`AgentToolStats` 接口
- **`user.message`** 事件类型 — Agent 在每个用户 turn 开始时通过 `achievement_track("user.message")` 自上报，所有工具统一
- **`stats.json` 缓存** — `Store.saveStats()`/`loadStats()` 原子读写，poll() 完成后自动重算，Dashboard `/api/data` 直接读取
- **DashboardStats 新增 `tool_stats` 字段** — 可选，向后兼容
- **指令更新** — `AGENTS.md`、`~/.claude/CLAUDE.md`、`init.ts INSTRUCTION_BLOCK` 均新增 `user.message` 跟踪条目
- **10 个测试用例** — 覆盖空事件、完整 session、多工具、缺失 end、0 message、单 message、背靠背 session、unknown tool_source
- **设计文档** — `docs/superpowers/specs/2026-06-03-agent-tool-statistics-design.md`

### Dashboard 活动面板：Streak 卡片 + 热力图 — 2026-06-04

基于 Duolingo + GitHub 两轮调研，在 Hero section 新增两个可视化组件：

- **🔥 Streak 卡片**（XP bar 下方）— `StreakData { current, longest, today_active }` 替换原有的 `number` 类型，显示当前连续天数 + 历史最高 + 今天活跃状态（绿勾/灰提示）
- **📊 活动热力图**（Streak 卡片下方）— GitHub 风格 4 个月贡献图，18 列 × 7 行 CSS Grid，5 级绿色阶（0 独立桶 + 分位桶自适应染色，新用户回退固定阈值），hover tooltip
- **数据源** — `session.start` 事件按日聚合，`computeHeatmap()` / `calcStreak()` 都在 `api.ts` 层计算，不修改引擎
- **设计文档** — `docs/superpowers/specs/2026-06-04-dashboard-streak-visualization-design.md` / `2026-06-04-activity-heatmap-design.md`

### 第三、四轮调研 — 2026-06-04

- **Duolingo** — 分析 12 大游戏化机制与 7 种心理学钩子，最终仅采纳 Dashboard streak 可视化（其余因多用户需求、定位冲突、ROI 不明等原因放弃，详见 `docs/whatsmore.md` 结论）
- **GitHub 贡献图** — 解剖 53×7 热力图的设计细节（分位桶、SVG/CSS Grid、滚动窗口），映射为 AGPA 的 4 个月版本

### 第二轮调研：Claude Code 游戏化生态 Top 5 + 三大特性详细设计 — 2026-06-03

GitHub 搜索 `achievement`/`gamification`/`quest`/`play` 关键词，star 排序筛选 5 个项目克隆至 `research/`（已 gitignore），深读后产出分析报告写入 `docs/whatsmore.md`：

- **claude-code-guide**（114⭐）— Fibonacci 间隔 nudging / 16 领域腰带段位 / 特性依赖图 / 数据迁移框架 / 评分公式
- **sc2-claude-hooks**（26⭐）— StarCraft 2 阵营音效 / 15s 冷却 + 智能错误过滤 / 一键安装
- **buddy-evolution**（5⭐）— 34 触发函数成就 / 5 维属性递减增长 / 18 物种进化树 / 12 人格
- **claude-code-quest**（1⭐）— Plan checkbox → quest 进度 / 多项目 RPG Dashboard / 安全不变量
- **claude-code-achievements**（84⭐）— 第一轮已分析

新增三大特性详细设计方案（📐 方案设计阶段，暂不实施）：

1. **成就解锁音效系统** — 6 级稀有度 6 种音效，SFXR PoC，`notify.ts` + `assets/sounds/`
2. **数据迁移框架** — `schema_version` + 增量迁移链，`store.ts` 入口自动执行，幂等
3. **Streak 乘法奖励** — `1.0x→2.0x`（每天 +0.1），叠加到现有 XP 系统

### 音效系统实施 — 2026-06-03

基于设计 1 实施方案，完全落地：

- **6 个 8-bit WAV 音效** — `scripts/generate-sounds.ts` 纯算法生成（零依赖），输出到 `assets/sounds/`
  - Common 1.2s / Uncommon 1.8s / Rare 2.5s / Epic 3.0s / Legendary 3.7s / Mythic 4.3s
- **`notify.ts` 新增 `playSound()`** — 自动检测 OS（macOS afplay / Linux paplay/aplay / Windows PowerShell），在弹窗之前播放
- **`sendNotification()` 签名新增 `rarity?` 参数** — 向后兼容，不传不播音效
- **同轮去重** — poll 轮次多个成就同时解锁时，只播放最高稀有度的音效
- **全局开关** — `config.json` `sound_enabled` 字段（默认 true），跨 profile 生效
  - CLI: `agpa sound on|off` + `agpa sound` 查看状态
  - 环境变量: `AGPA_SOUND=off` 强制关闭
  - Dashboard: 🔊/🔇 切换开关，`GET/POST /api/config/sound`
- **`agpa init` 自动部署** — 复制音效文件到 `stateDir/sounds/`，支持用户自定义替换
- **配置文件同步** — `AppConfig` + `appConfigSchema` 新增 `sound_enabled`，`isSoundEnabled()` / `setSoundEnabled()`

新增**现有 XP 系统基准分析**：2 来源（成就 + task）、`N²×100` 等级曲线、4 问题诊断（task 贡献低 / 等级区分度不足 / streak 装饰 / MCP 缺失 XP）、数值微调建议。

### 像素画概念描述文档 — 2026-06-02

`docs/pixel-art-ideas.md` — 为全部 160 个成就编写像素画描述，按 10 个分类组织表格。每项包含成就 ID、中文名、中文描述、像素画场景描述（前景/背景构成 + 调色板方向），与成就的中英文命名和描述一致，适当联想扩展。

### 跨平台桌面通知 — 2026-06-02

`src/utils/notify.ts` 重写，自动检测 OS 并选择最佳通知机制：

| 平台 | 机制 | 回退 |
|------|------|------|
| macOS | `terminal-notifier`（可点击跳转 Dashboard） | `osascript` |
| Linux | `notify-send` + 自定义图标 (libnotify) | — |
| Windows | PowerShell + `System.Windows.Forms.MessageBox` | — |
| 全部 | 终端输出 ★ title + body | TTY/headless 永不落空 |

`detectOS()` 自动从 `process.platform` 识别；解锁时同时弹系统通知 + 终端输出。

### CCA 调研 Phase 1 — /achievements 聊天命令 + tip/hint 系统 — 2026-06-02

调研 [subinium/claude-code-achievements](https://github.com/subinium/claude-code-achievements)（29 成就 Bash 插件），借鉴其学习型成就设计哲学与聊天内查询能力，8 方向评估后采纳 4 项近期实施：

- **tip/hint 字段分离**（`04-成就定义清单.yaml` + `src/engine/types.ts` + `yaml-parser.ts`）— `tip`（教育提示，已解锁后教用户更好使用该功能）vs `hint`（解锁线索，给未解锁用户语义暗示但绝不暴露精确条件）。14 个 onboarding 成就全部含 tip+hint，73 个 Common/Uncommon 成就含 hint。Rare+ 保留神秘感。
- **`/achievements` 聊天内命令**（`.claude/commands/achievements.md`）— 7 种视图模式：默认已解锁列表、locked（未解锁+hint）、all（分类分组）、stats（XP/等级/稀有度分布）、recent（最近 5 个）、按稀有度/set 过滤。20 格 `▰▱` 进度条 + 百分比。
- **`/achievements settings` 设置命令**（`.claude/commands/achievements-settings.md`）— 聊天内切换语言（zh/en）、开关通知、重置进度（需二次确认）。
- **init 一键安装命令**（`src/cli/init.ts`）— `agpa init` 自动编译 YAML→JSON（Claude 无法直接解析 YAML）+ 复制命令文件到 `~/.claude/commands/`，全局可用。Summary 框第 4 步增加 `/achievements` 指引。
- **编译工具链**（`scripts/compile-achievements.ts` — YAML→stateDir/achievements.json，`scripts/add-tips-hints.ts` — 一次性 YAML 注入脚本）
- **行动计划文档**（`docs/whatsmore.md`）— 8 条目状态追踪，Phase 1/2 路线图

### 统一 CLI + 安装体验重构 — 2026-06-02

- **`agpa` 统一 CLI**（`src/cli/index.ts`）— 10 子命令路由，`--help`/`--version`。`package.json` 加 `bin`/`files`/`engines` 字段，`npm link` 即用。
- **init 体验增强**（`src/cli/init.ts`）— Welcome banner + 自动检测可视化 + 配置进度输出 + 总结框含 3 步下一步指引 + 首成就预告。
- **`agpa verify` 新命令**（`src/cli/verify.ts`）— 11 项健康检查（数据目录→state→YAML→引擎 dry-run→MCP 配置→指令文件），复用 doctor 逻辑 + engine 干跑测试。
- **Dashboard 引导增强**（`app.js`/`index.html`/`styles.css`）— 首次访问 tip（1-5 成就时显示，可关闭），下一个推荐成就卡片（1-10 成就时显示，带进度条和 click-to-scroll）。
- **文档同步**（`README.md`/`CLAUDE.md`/`docs/multi-tool-setup.md`）— 命令改为 `agpa` 方式，138→160 成就，`~/.agpa`→`~/.agent-achievements` 路径修正。
- 用户完整旅程：`npm link` → `agpa init` → `agpa verify` → 日常使用 → 🏆 → `agpa dashboard`。

### 🎯 稀有度全量重平衡 — 2026-06-01

160 项成就稀有度大调整（48 项变更），构建健康的金字塔分布：

| 稀有度 | 变前 | 变后 | Δ | 占比 |
|--------|------|------|---|------|
| Common | 20 | **48** | +28 | 30% |
| Uncommon | 56 | **44** | -12 | 27.5% |
| Rare | 46 | **30** | -16 | 18.8% |
| Epic | 24 | **24** | 0 | 15% |
| Legendary | 12 | **9** | -3 | 5.6% |
| Mythic | 2 | **5** | +3 | 3.1% |

**核心修复**：
- **Uncommon 不再当垃圾场** — 28 个"一次性触发"成就从 Uncommon 降为 Common，与现有 Common（first_shot、tool_time 等）门槛对齐。覆盖：首次 permission 调整/MCP 连接/图片分享/Plan 模式/code review/PR/skill/hook/force push/kill -9 等。
- **Rare 更 Rare** — 12 个中度门槛降为 Uncommon（error_resilient、file_purger、regex_sorcerer、hold_my_beer、ill_do_it_myself 等），2 个高门槛升为 Epic（token_titan 10M、session_centurion 300）。
- **Epic 纠偏** — `cerberus`（2 条管道命令）Epic→Common，`minimalist`/`novelist`（短/长消息）Epic→Uncommon。这些是 Epic 中最名不副实的。
- **Mythic 扩容** — `streak_100`（连续 100 天）、`cycle_master`（10 次全流程）、`failure_mother`（累计 100 次失败）从 Legendary 升为 Mythic——真正的"几乎不可能"。

### Steam 调研驱动新增 2 成就 + 文档同步 — 2026-06-01

- **avengers_assemble（复仇者集结）** — `agent.spawn` distinct_count(`agent_type`) == 6。Spawn 过恰好 6 种不同类型 agent（致敬初代复仇者六人组）。Epic，set: agent_commander（5→7）。
- **skill_adept（技多不压身）** — `skill.invoke` distinct_count(`skill_name`) >= 5。调用过 5 种以上不同 skill（全新事件 `skill.invoke` 首次使用）。Rare，set: creators_forge（5→6）。
- 基于《12-Steam游戏成就设计调研》21 款游戏分析，从 25 个提案中筛选 2 个无重叠新增。

### Dashboard 新用户体验 + 配色升级 — 2026-06-01

- **入门引导卡片** — 0 成就新用户自动展示 6 个一步可得的 onboarding 成就 + 如何获取的指引文字，中英双语。解锁任何成就后自动消失，reset 后重新出现。
- **一行代码一键重置成就** — Nav 栏 🗑 按钮，POST `/api/reset`，带 CSRF token（`crypto.randomBytes` + `<meta>` 注入 + `x-dev-token` header 校验）。Reset 同时清理 `showcase.json` + 防御 showcase 展示前 unlocked 校验。
- **Modal 单语言显示** — 修复之前 modal 同时显示中英文的 bug，现在严格跟随当前语言模式，缺失时 fallback 到另一种语言。
- **解锁卡片名称发光** — `--card-color` CSS 变量 + `@keyframes name-glow` 呼吸动画，按稀有度着色发光（锁定的卡片无效果）。
- **稀有度配色全面换新** — Common 浅蓝、Uncommon 深蓝、Rare 金黄、Epic 橙、Legendary 紫、Mythic 红（不变）。cold→warm→hot 递进逻辑。
- **Dashboard 版面紧凑化** — Hero/引导/Grid 各区段 padding & gap 收紧，减少不必要的 vertical 留白。

### 成就扩展 +19（138→160）— 2026-06-01

- **事件覆盖型 +15** — 覆盖 `automode.start`、`mcp.connect`、`task.create`、`task.update`、`error.occurred`、`file.delete`、`image.upload`、`deepseek.conversation` 等 10 个全新事件类型。新增 `dual_wielder`（单 task 多工具）、`token_1m`（百万 token）、`test_centurion`（100 测试通过）等。
- **科幻片彩蛋 ×3** — 《Alien》异形（首次 spawn sub-agent）、发条橙（automode 3 次）、第五元素（单 task 5 种工具）。
- **Skyrim 彩蛋 ×1** — 龙裔（阅读 337 个不同文件，致敬冬堡学院藏书）。使用 `distinct_count file.path` 新维度。
- **模型品牌成就 ×3** — 鲸歌（DeepSeek）、通信的数学理论（Claude）、花朵（GPT），使用 `task.complete` + filter `model contains`，首次引入 `matchFilter` 的 `context.model` 字段。
- **matchFilter 上下文扩展** — 从 8 字段增至 11 字段（+model/+day_of_week/+duration_ms），解除 P1 遗留项。
- **总成就数**：109→138→153→157→**160**（+51 from 5月30日至今），**测试 110 个** ✅

### Set 系统重构 + Hidden 重组 + Modal 动画升级 — 2026-06-01

- **Set 系统重构** — 9→10 个 set，全部添加 `name_cn`，套装页中英双语切换。`git_flow`（7→9）、`agent_commander`（5→6）、`polar_night`（2→4）扩充。`collectors_soul`/`devops_triad`/`night_shift` 解散，成员归入合理 set。57/160 有归属。
- **Hidden 分类重组** — 41→21（26%→13%），25 个成就重新归类到 tool_mastery（+10）、milestones（+3）、style（+2）、workflow（+2）等。剩余 21 个全是真彩蛋。
- **Modal 入场 5 层动画** — backdrop blur 淡入、container spring pop-in（scale+.blur）、icon 弹跳回旋、内容 staggered reveal、✕ 按钮旋转弹入。
- **Modal 退场动画** — container shrink+blur out、backdrop 渐变消失，JS closeModal 400ms 延迟。
- **Modal 状态标识** — 解锁卡片显示金色呼吸 "✓ 已解锁"，未解锁卡片显示灰色 "未解锁"，右对齐于成就名右侧。隐藏成就详情默认隐藏，支持 "查看描述/隐藏描述" 按钮切换，中英双语。
- **SetDefinition +name_cn** — types.ts、yaml-parser.ts、api.ts、app.js 全链路透传 set 中文名。

### 成就名称全面升级（Steam 化）

通过 `/customize` 页面整体过了一遍 138 个成就的英文名、中文名和描述。

- **英文名 Steam 化** — 大量改用 pop culture 梗：`Ghost in the Shell`、`Copy-Paste is All You Need`、`Command & Conquer`、`Smooth Criminal`、`Not Invited to Party` 等
- **`name_cn` 基本全覆盖** — 之前大量缺失中文名，现在几乎每个成就都有中文名
- **描述去冗长** — 删掉主观抒情，保留客观陈述，该幽默的地方保留
- **`streak_30` 名字回正** — `Streak 3` → `Streak 30`，与 `condition.value: 30` 一致
- **`Hold My Beer` 去感叹号** — 避免裸 YAML 解析风险

### 新增 Customize 页面

独立于 Dashboard 的成就名称编辑器，路由隔离，支持文本安全的 YAML 写回并保留注释。

- 4 个新文件：`customize-api.ts`、`customize.html`、`customize.css`、`customize.js`
- YAML 注入防护 + 防 XSS（textContent 而非 innerHTML）

### 138 条描述中译英 + description_cn 字段

- **`description`** — 138 条全替换为英文翻译，与 Steam 化新名称风格统一
- **`description_cn`** — 新增字段，保留原始中文描述
- **Dashboard 双语完整** — 中文模式显示中文描述，英文模式显示英文描述，不再是同一种语言
- 零代码变更（YAML-only），全线测试通过

### 不可达成就清零 + 测试大幅扩展 — 2026-06-05

**不可达成就修复（11 个 → 0）**
- YAML Bug（6 个）: streak_3/7/30/100 + daily_checkin 缺 `window: all`; mcp_explorer 缺 `field: server_name`
- Evaluator Bug（4 个）: `evalSetCompletion` 不排除 `future: true` 成就
- 手动 track 补全（2 个）: automode_first / mcp_first_connect，去掉 `future: true`，AGENTS.md + init.ts 新增指令

**测试覆盖大幅扩展（+296, 150 → 446）**
- Approach A — integration.test.ts 重写，6 个真实 Agent 使用场景回归保护
- Approach B — every-achievement.test.ts，每个成就自动生成最小触发事件，160/160 全可达
- Phase 1 — 6 新文件（config/helpers/engine/errors/validate/timeline）+ 81 tests
- 测试文件: 7 → 18，全绿

### 6 事件填空型新成就 — 2026-06-05

基于事件利用率分析，针对 `user.prompt` 和 `agent.self_fix` 两个事件缺口填充：

**user.prompt 系列（5 个，hook auto-track）**
- `brevity_scout` — 5 次 prompt < 10 词（Common·style）
- `executive_summary` — 25 次 prompt > 100 词（Uncommon·style）
- `code_talker` — 10 次含代码块（Uncommon·style）
- `no_questions_asked` — 3 次无问号（Uncommon·hidden）
- `infinite_details` — 累计 50,000 字符（Rare·style·progress_trackable）

**agent.self_fix 系列（1 个，manual track）**
- `self_aware` — 首次自修复（Common·skill·set: bug_catcher）

**Evaluator 扩展**
- `evalPredicate` 新增 `<` 和 `>` 数值比较操作符
- `matchFilter` ctx 新增 `word_count` / `has_code_block` / `has_question_mark`
- `computePromptPayload` 新增 `has_question_mark` 字段
- 测试全绿: 446 → 452

**文档同步**
- issues-todo + PROGRESS: 成就数 160→166, 测试 446→452, 添加新成就节

## [0.1.5] — 2026-05-31

### Evaluator Bug 修复

代码审查发现并修复 6 个问题，3 个新增测试覆盖（106→109）。

- **streak event_level 时间窗口取反** — `evaluator.ts:367`: `!sessionWindow` → `sessionWindow`，与所有其他 evaluator 一致。`uncanny_accuracy` 成就受益
- **same_target event-level streak 计数总次数而非连续次数** — `evaluator.ts:347-356`: 重写跟踪算法，检测不同字段值出现时重置计数器
- **distinct_count 忽略 operator** — `evaluator.ts:491`: 始终 `>=` → 改用 `evalOp()`，支持全部 5 种操作符
- **evalRatio 缺少 scope/window/filter** — `evaluator.ts:623+`: 添加 `scopeEvents()` + time window + custom filter + role，与所有其他 evaluator 对齐
- **Hermes 会话 ID 死代码** — `hook.ts:413-414`: 空 if 块 → 从 event log 反向扫描恢复 session_id
- **numerator/denominator 不支持嵌套 Condition 对象** — `yaml-parser.ts`: 新增 `parseConditionField()` 处理 `Condition | string` 两种类型

## [0.2.0] — 2026-05-31

### OpenClaw Auto-Track

OpenClaw 从"仅 MCP + 指令文件"升级为完整的 auto-track 支持，与 CC / Hermes 对齐。

- **`openclaw-auto` 命令** — hook.ts 新增 stdin pipe 模式，翻译层（事件名/工具名/字段名）→ CC 标准 `HookStdin` → `mapEvents()` 复用
- **OpenClaw TS 插件** — `init.ts` 生成 `~/.openclaw/extensions/agpa-track.ts`，注册 5 个 hook（session_start/end、before/after_tool_call、agent_end），异步 spawn hook.ts + stdin pipe，unref'd 不阻塞主进程
- **幂等注入** — `injectOpenClawPlugin()` 检测 `agpa-openclaw-track` 标记，不重复注入
- **`agent.end` 事件类型** — `EventType` 联合新增，`agent_end` hook 独立路由（不经过 `mapEvents()`）
- **工具名映射** — `read_file`→`Read`, `write_file`→`Write`, `apply_patch`→`Edit`, `bash`→`Bash`, `glob`/`grep`
- **+25 测试** — 翻译层全量覆盖（事件名×5、工具名×7、字段映射×5、集成×5、边界×3），81→106 tests

### Dashboard UX Overhaul

Dashboard 从"功能骨架"升级为"可日常使用的成就浏览器"。

- **搜索框** — 实时过滤成就，搜 ID / 英文名 / 中文名 / 描述，输入框带清除按钮。空结果友好提示
- **排序下拉** — 4 种排序：默认（YAML 定义序）/ 稀有度 ↓ / 最近解锁 / A → Z
- **稀有度筛选** — 一排 rarity pills（All + 6 级），可与分类筛选叠加
- **成就详情 Modal** — 点击任意卡片弹出：完整图标 + 名称 + 中英双语描述 + 稀有度/分类标签 + 进度条（未解锁）+ 解锁时间（已解锁）。Esc 或遮罩关闭
- **10s 自动轮询** — 静默拉取 `/api/data`，新解锁成就 → Toast 通知 + 自动刷新界面（Modal 打开中不刷新，Toast 不影响）
- **锁定/解锁视觉重设计** — 锁定卡：`grayscale(85%)`（冻结灰阶） + 色条统一灰 + 无稀有度 glow。已解锁卡：永久 ambient glow + `✓ Unlocked` 绿色标签 + icon-wrap 高亮边框
- **Showcase 显示名称** — 展示柜格子从纯 icon → icon + 成就名称两行，76px → 90px 宽高
- **`engine.reload()`** — Dashboard 每次请求从磁盘重读 state + events，修复"明明有解锁却显示 0%" bug
- **`iconHtml()` 渲染函数** — 统一 9 处渲染点：emoji → `<span>`，图片路径 → `<img>`（`image-rendering: pixelated`）。icon 切换只需改 YAML，零代码改动
- **YAML icon 对象格式** — parseIconField 支持 `icon: { src: "pixelart/x.png" }`，兼容原有 emoji 字符串
- **UI 微调** — Level ring 移除，hero-section 最小高度 92vh → 60vh，暗色模式 emoji `brightness(1.15)`

### Percentile 子系统移除

Percentile 依赖社区数据做排名评估，与"个人成就系统"定位不符。整体移除，改用绝对数值。

- **2 成就改写** — Minimalist（`threshold` + `metric: "length"` + ≤80 字符）、Novelist（≥500 字符）
- **AGENTS.md** — 新增 `conversation.message` + `{ length }` 手动 track 指令
- **types.ts** — `ConditionType` 从 12 种缩减为 11 种（移除 `percentile`）
- **evaluator.ts** — 删除 `evalPercentile`（~50 行）、`FALLBACK_THRESHOLDS`、`computeMetric`（~40 行）、`fs`/`path` imports
- **engine.ts** — 移除 `runTelemetry` import + `poll()` 内遥测调用
- **文件删除** — `src/telemetry.ts` + `src/server/stats-server.ts`（零消费者）
- **效果** — 2 个 P1 HOLD 中的 percentile 项清零，代码净删 ~180 行

### 文档更新

- **CLAUDE.md** — 架构图从双线改为两通道对比图（MCP 主动调用 vs Hook 自动触发），加 Hook CLI 三工具对照表
- **`docs/multi-tool-research.md`** — OpenClaw 节从"调研完成暂不做"→"方案已定待实现"→现已实现，补数据流图、为什么不能复用 CC/Hermes、工具名映射表

### 架构要点

OpenClaw 与 CC/Hermes 本质区别仅在于数据如何到达 hook.ts：
- CC/Hermes：hook 管理器 spawn 子进程 + stdin pipe（操作系统行为）
- OpenClaw：我们的 TS 插件在 `api.on()` 回调中自己 spawn 子进程 + stdin pipe

翻译层和 `mapEvents()` 三者完全共享。CC / Hermes 零影响。

### Tech Stack Unchanged

Runtime: tsx, MCP: @modelcontextprotocol/sdk, Parsing: yaml, Validation: zod, Testing: vitest (106 tests, 6 files, all passing)

---

## [0.1.3] — 2026-05-30

### Init: Zero-config One-command Setup

- **`npm run init` without `--tool`** — auto-detects all 5 AI coding tools by scanning config files, configures them all
- **Hook merge injection** — appends AGPA hooks to existing CC hook entries (sound effects, etc.) instead of skipping when keys already exist
- **Idempotent** — re-running never duplicates commands
- **3 new npm scripts** — `npm run hook-auto`, `hook-track`, `hook-poll` for quick testing

### Evaluator Fixes & Improvements

- **evalThreshold metric path** — now respects `cond.event`, `cond.filter`, `cond.role`, and time windows (was silently ignoring all of them)
- **single_task window** — uses `task.complete` events as task boundaries to infer scope (no per-event task_id needed)
- **same_task window** — `isTaskWindow` now recognizes this alias (7 achievements were silently un-scoped)
- **computeMetric expanded** — 2 new branches: `showcase_count` (reads showcase.json), `concurrent_sessions` (counts unique session_ids within 1h)

### Event Coverage: 6 Previously-Blocked Achievements Fixed

| Achievement | Fix |
|-------------|-----|
| visual_prompt, image_whisperer | YAML: `tool.complete` → `image.read` via AGENTS.md manual track |
| polyglot | YAML: `file.create` → `file.language_used` via AGENTS.md `{ language }` |
| perfectionist | YAML: `file.edit` → `function.edited` via AGENTS.md `{ function_name }` |
| trophy_case | Code: `computeMetric` reads `showcase.json` non-null slot count |
| parallel_universe | Code: `computeMetric` counts unique session_ids |

### Cleanup

- **storyteller** deleted (not implementing "share conversation" feature)
- Achievement count: 118 → 117
- Integration test updated to match new count

### Data Consistency (P2)

- **`category: milestone` → `milestones`** — 8 achievements aligned with Dashboard category names
- **Set membership** — `bounce_back` added to agent_commander list, `mythic_completionist` added to completionist list
- **Missing `set:` fields** — 8 achievements now have correct set reference (the_beginning ×4, collectors_soul ×1, devops_triad ×3)
- **`im_sorry_dave` window** — both conditions now have `window: single_session`

### Evaluator Hardening (P1)

- **Empty conditions guard** — `if (def.conditions.length === 0) continue;` prevents false positives
- **evalMode target** — no-event path now uses same format as with-event path
- **`set_id` removed** — dead code from Condition interface + yaml-parser (never read by any evaluator)
- **evalStreak window/field/same_target** — now reads scopeEvents, time windows, field filtering, and same_target (consistent with all other evaluators)

### Surgeon Achievement Unblocked

- **hook.ts Edit payload** — extracts `edit_lines` from `tool_input.old_string`, `total_file_lines` from file on disk (within cwd/home boundary)
- **Path traversal guard** — rejects `..` paths and absolute paths outside cwd/home
- **Zero AGENTS.md dependency** — fully automatic from CC stdin data

### Test Coverage (P3)

- **+25 unit tests** — metric path filtering×3, single_task/same_task×2, empty conditions guard, streak window, streak same_target, hook mapEvents×16
- **New test file** — `tests/cli/hook.test.ts` covering all 10 CC hook→AGPA event mappings
- 55 → 80 tests (6 files), all passing

### evalStreak event_level Mode

- **`event_level: true`** — new Condition field for per-event streak counting (not calendar-day)
- **ten_task_no_edit** — now correctly counts consecutive zero-edit tasks, not consecutive days
- Backward compatible: existing streak achievements (streak_7/30/100/365) unchanged

### Condition `unit` Field

- **Parser no longer drops `unit`** — 6 achievements now retain `unit: day` / `unit: tokens` metadata

### Hermes Agent Auto-Track

- **`hermes-auto` command** — translates Hermes stdin JSON → CC format via mapping tables (event names + tool names + field names)
- **Shell hook injection** — `init.ts` injects 4 hooks (pre_tool_call, post_tool_call, on_session_start, on_session_end) into `~/.hermes/config.yaml`
- **CC unchanged** — all existing CC paths untouched; Hermes has independent pipeline

### Known Gaps (HOLD)

- evalPercentile fallback thresholds (2 percentile achievements work, others need telemetry)
- matchFilter context limited to 8 hardcoded fields (no current impact — affected achievements moved to manual track)
- evalStreak calendar-day vs event-consecutive semantics (ten_task_no_edit may need revisit)

### Tech Stack Unchanged

Runtime: tsx, MCP: @modelcontextprotocol/sdk, Parsing: yaml, Validation: zod, Testing: vitest (81 tests, 6 files, all passing)

---

## [0.1.2] — 2026-05-30

### System Audit & P0 Bug Fixes (10 fixed)

- **evalStreak** — now reads `cond.filter` and `cond.operator` (was hardcoded `>=`)
- **set_completion** — `all` and `exclude_hidden` fields parsed and evaluated; `completionist_gold`/`mythic_completionist` now distinct from `completionist_bronze`
- **max_per_day** — Condition field + parser + per-day grouping in `evalThreshold`; `daily_checkin` second condition now functional
- **sequence standard mode** — window filtering added (was silently ignoring `window:` on 7 sequence achievements)
- **session-scoped filtering** — `scopeEvents()` added to evaluator, filters events to latest `session_id` when `single_session`/`same_session` window is set; swat_team fixed
- **lifetime achievements** — `parseWindow` supports `all`/`lifetime` returning Infinity; 25 achievements upgraded from implicit 24h default to explicit `window: all`

### Event System Overhaul

- **4 evaluator bugs fixed** — threshold → independent evalThreshold (field summation + metric expressions); sequence → consecutive mode with count sub-object; distinct_count → values whitelist; counter → same_target support
- **4 new hook event mappings** — task.complete (TaskCompleted), context.compacted (PostCompact), tool.requested (PreToolUse), file.write (PostToolUse Write)
- **3 new CC hooks registered** — PreToolUse, TaskCompleted, PostCompact added to init.ts; 9 hooks total (was 6)
- **24 manual track events in AGENTS.md** — comprehensive two-category table (agent actions + user actions observable), each with specific payload hints
- **init.ts INSTRUCTION_BLOCK rewritten** — matching AGENTS.md, injected into user's CLAUDE.md during init

### Achievements

- **12 new event-driven achievements** — Pipemaster, Command Baby, Cerberus (command.run); Fail Forward, Bounce Back, Phoenix (tool.failure); MCP Connoisseur, MCP Collector (mcp.tool_call); Command Master (command.run, legendary); Failure Is the Mother of Success (tool.failure, legendary); Delegator, SWAT Team (agent.spawn)
- **3 unreachable achievements deleted** — perfect_review, photographic_memory, scorched_earth
- **3 achievements unblocked** — the_switch, the_debugger, triple_debugger via new manual track events
- **All 5 previously-unused hook events now serve achievements** — command.run, tool.failure, mcp.tool_call, agent.spawn all have consumer achievements
- **109 → 118 total achievements**, all events needed by any achievement are now either auto-tracked or covered by manual instructions

### Documentation & Tooling

- **CLAUDE.md** — project-level instructions: build/test commands, architecture diagram, conventions, known sharp edges
- **`docs/issues-todo.md`** — comprehensive issue tracker: 10 P0 bugs, ~20 P1 gaps, ~6 P2 data issues
- **README.md** — updated project structure, CLI table (added hook auto + mvp), dependency list
- **DEVLOG.md** — 2026-05-29 evaluator-fix entry + 2026-05-30 event system entries
- **docs/PROGRESS.md** — 5→12 condition types, achievement count updated
- **docs/design/** — 5 files now carry design-phase disclaimer headers

### Housekeeping

- `@types/node` → devDependencies
- MCP engine `session_id` no longer hardcoded `demo-session`; hook.ts passes real session_id from CC stdin
- `package.json`: version 0.1.0→0.1.1, license field added

### Tech Stack Unchanged

Runtime: tsx, MCP: @modelcontextprotocol/sdk, Parsing: yaml, Validation: zod, Testing: vitest (55 tests, 5 files, all passing)

## [0.1.1] — 2026-05-29

### Added

- **Dashboard 中英双语** — 完整 i18n 词典（16 个 UI 文本 + 10 个分类名 + 6 个稀有度名），`t()` 翻译函数支持 `{placeholder}` 替换，静态 HTML 通过 `data-i18n` 属性翻译，动态渲染文本全部走 `t()`
- **Dashboard 分类名翻译** — `onboarding` → Onboarding / 入门，`milestones` → Milestones / 里程碑 等
- **Dashboard 稀有度翻译** — `common` → Common / 普通 等，用于 badge 显示
- **Rarity badge 本地化** — 原本硬编码英文 rarity 名，现根据当前语言翻译显示
- **`renderI18n()`** — 统一处理 `data-i18n` 属性，切换语言时同步 `<html lang>`
- **API `description_cn` 字段暴露** — `AchievementItem` 新增 `description_cn`，前端 `displayDesc()` 就绪（YAML 后续补上描述即自动生效）

### Changed

- **Filter tab 标签** — 由硬编码改为动态 i18n（All→ 全部/Unlocked→ 已解锁/Locked→ 未解锁）
- **Category pill 标签** — 由英文 category ID 改为翻译后的分类名
- **Stats card 标签** — Unlocked/Events/Day Streak/Complete → 中文对应翻译
- **XP label** — 模板化 `{xp} XP • Level {level}` / `{xp} XP • {level} 级`
- **Showcase tooltip** — `click to remove` / `Click to pick` / `Pin to showcase` 翻译
- **Empty state 提示** — `No achievement sets defined.` → 中文"暂无套装定义"等
- **Language toggle 切换** — 切语言时同步更新 `<html lang>` 属性

## [0.1.0] — 2026-05-29

### Added

- **12 condition types fully implemented** — counter, threshold, streak, sequence, distinct_count, event, set_completion, ratio, pattern_match, percentile, mode, sequence_count
- **Achievement engine** (`src/engine/`) — event tracking, condition evaluation, file persistence, YAML parsing with full type validation
- **MCP Server** (`src/main.ts`) — STDIO protocol via `@modelcontextprotocol/sdk`, 5 tools: track, poll, stats, showcase, config
- **CLI tools** — `init` (agent registration), `hook` (auto event tracking), `doctor` (diagnostics), `dashboard`, `mvp` (demo data)
- **Dashboard** — HTTP server + frontend (HTML/CSS/JS), dark/light themes, achievement grid, stats, XP/level, timeline, 6-slot showcase cabinet, set rewards
- **Hook auto-track** — SessionStart/Stop, PostToolUse, PostToolUseFailure, SubagentStart/Stop; multi-event derivation per tool action
- **macOS notifications** — `terminal-notifier` with custom icon, emoji, sound, grouping, Dashboard deep-link
- **Percentile system** — standalone stats server (`src/server/stats-server.ts`), telemetry client, reservoir sampling, threshold caching
- **Set/rewards system** — 9 set definitions, 6 reward types (title, badge, theme, border, animation, stat_counter)
- **Filter evaluator** — safe `matchFilter` parser (no JS eval), supports `==`, `!=`, `in`, `matches`, `contains`, `&&`, `||`
- **Tool registry** — shared `src/tool-registry.ts` for duplicate TOOL_PATHS across CLI tools
- **Zod validation** — safe JSON parsing in store/config/helpers with graceful degradation
- **CI workflow** — `.github/workflows/ci.yml`
- **Pixel art toolchain** — `tools/img-to-pixelart.mjs`, `render-png.mjs`, `term-preview.mjs`, supporting SVG/PNG → multi-resolution YAML pipeline
- **Test suite** — 5 test files, 41 tests (unit + integration), all passing

### Changed

- **YAML parser replaced** — hand-written regex → `yaml` npm package, full error messages for unknown condition types, missing IDs etc.
- **evalThreshold upgraded** — role filtering, session window, filter support, operator dispatch aligned with evalCounter
- **Showcase storage deduplicated** — `loadShowcase`/`saveShowcase` extracted to `src/helpers.ts`, shared by MCP tool and Dashboard
- **Notification refactored** — `src/utils/notify.ts` extracted, shared by hook.ts and poll.ts
- **TypeScript migration** — MVP from `.mjs` → `.ts`, strict mode, `noUncheckedIndexedAccess`, ES modules

### Removed

- **CounterCache** — dead code, 117 lines + 80 test lines removed
- **`evalThreshold` function** — merged into `evalCounter` via fall-through dispatcher
- **Unused Condition fields** — `min_matches`, `window_size`, `mode_field`, `metric`
- **`AchievementDefinition.progress`** — unused field
- **Old MJS files** — `agpa-engine.mjs`, `agpa-mvp.mjs`
- **`tools/types.ts`** — dead code
- **Showcase slot limit** — `slice(0,4)` removed, all 6 slots displayed

### Fixed

- YAML `events` → `sequence` field fallback (affected 9 achievements)
- `chain_reaction` achievement changed to standard counter type
- 5 unused `order: true` fields removed
- `contains '?'` filter syntax for legacy bare-form compatibility

### Tech Stack

- Runtime: `tsx` (TypeScript direct execution)
- Type system: strict mode + `noUncheckedIndexedAccess`
- Module format: ESM (`"type": "module"`)
- Build: `tsc --noEmit`
- Testing: vitest
- External deps: `@modelcontextprotocol/sdk`, `yaml`, `zod`

### Achievement Definitions

- 109 achievements across 10 categories (30 MVP-unlockable)
- 6 rarity levels: common → mythic
- 9 set definitions with visual rewards
- Chinese/English bilingual names and descriptions

### Supported Agents

Claude Code, Kilo Code, OpenCode, Hermes Agent, OpenClaw.
