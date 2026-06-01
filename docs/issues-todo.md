# Achievement System Issues & TODOs

> 最后更新: 2026-06-01 | 总成就数: 158 | 条件类型: 11 | Tests: 110 ✅ | 5 Agent 全接入

---

## P0 — 逻辑 Bug（影响成就正确性）

✅ **全部修完。** evalStreak filter/operator、set_completion all/exclude_hidden、max_per_day、swat_team 窗口、25 个 lifetime achievement window:all。

---

## P1 — 事件覆盖缺口

✅ **全部修完。** plan.mode、storyteller 删除、agent.complete、git.revert_all。

## P1 — Hook 不提取的 payload 字段

✅ **全部修完。** file_type→image.read、language→file.language_used、function_name→function.edited、showcase_count/concurrent_sessions→改条件为 counter 可测量事件。

## P1 — Evaluator 功能缺口（2 项 HOLD）

- [x] sequence 忽略 window / evalThreshold metric 路径 / 空 conditions / evalMode target / evalStreak 事件连续 / set_id 死代码 — 全部修好
- [x] **evalPercentile 硬编码回退阈值** — 整个 percentile 子系统已移除（v0.1.4）。Minimalist/Novelist 改为 `threshold` + `metric: "length"` + AGENTS.md 手动 track。stats-server.ts / telemetry.ts 删除。
- [x] **matchFilter 上下文只有 8 个字段** — 已扩展为 11 个字段（+model、+day_of_week、+duration_ms），model 字段用于按模型品牌筛选成就（鲸歌/DeepSeek、通信数学理论/Claude、Blossom/GPT）。

---

## P2 — 数据与体验缺口

- [x] **中文描述（`description_cn`）大面积缺失** — Dashboard 双语切换已就绪，但大多数成就只有英文。通过脚本逐条翻译并添加 138 条 description_cn，中文模式下完整显示中文描述。
- [x] **Dashboard 默认 0 成就解锁** — 新用户（或 `rm state.json` 后）Dashboard 全空。解决方案：添加入门引导卡片（6 个 onboarding 成就 + 如何获取指引），解锁成就后自动消失。同时添加开发者一键重置按钮（CSRF 防护）方便测试。
- [x] **issues-todo 上次更新 5/31，跟进 6 项 evaluator bugfix** — streak window/same_target/distinct_count op/ratio scope/Hermes session/nested Condition。+3 测试（106→109）。

---

## P3 — YAML 质量 / 资产

- [x] **Hidden 分类占 22%** — 41→21（26%→13%）。25 个重新归类到 tool_mastery（+10）、milestones（+3）、style/workflow（各+2）等。剩余 21 个全是真彩蛋。
- [ ] **像素画 icon 资产暂缺** — 下一步：选 The Beginning（14 个）做第一批试点。方案：AI 生成 32×32 pixel art PNG → `public/icons/` → YAML `icon: { src, alt }` → Dashboard `iconHtml()` 渲染。验证全链路后再铺开全量 158 个。emoji 和 pixel art 并存，渐进替换。
- [x] **Set 名称只有英文** — 9→10 个 set，全部添加 `name_cn`，套装页中英双语切换。Set 系统重构：合并散装 set，扩充合理 set。`git_flow`（7→9）、`agent_commander`（5→6）、`polar_night`（2→3）。57/158 有归属。

---

## 已完成 — Dashboard 新用户体验 + 配色升级（v0.1.6, 6/1）

- [x] **入门引导卡片** — 0 成就时 Hero 下方展示 6 个 onboarding 成就 + 获取指引，中英双语。unlock>0 后自动消失。
- [x] **开发者一键重置** — 🗑 按钮 POST `/api/reset` + CSRF token 防护（meta 注入 + x-dev-token header）。
- [x] **Modal 单语言显示** — 修复双语泄漏，英文模式只显示英文，中文模式只显示中文。
- [x] **解锁卡片名称发光** — `--card-color` + `@keyframes name-glow` 呼吸动画，按稀有度着色。
- [x] **稀有度配色换新** — Common 浅蓝、Uncommon 深蓝、Rare 金黄、Epic 橙、Legendary 紫、Mythic 红。
- [x] **Dashboard 版面紧凑化** — 各 section padding/gap 收紧，减少 vertical 留白。
- [x] **Showcase 残留数据防御** — `store.reset()` 清理 showcase.json + `buildShowcaseResponse` 校验 unlocked。

## 已完成 — 自定义 + Steam 化命名（v0.1.6, 5/31）

- [x] **Customize 页面** — 4 个新文件，YAML 注入防护 + XSS 防护
- [x] **英文名全面 Steam 化** — pop culture 梗：`Ghost in the Shell`、`Copy-Paste is All You Need` 等
- [x] **`name_cn` 基本全覆盖** — 几乎所有成就都有中文名
- [x] **`streak_30` 名字回正** — 与 value:30 一致
- [x] **issues-todo 同步** — 6 项 evaluator bugfix 标记完成

## 已完成 — Dashboard UX Overhaul（v0.1.4, 5/31）

- [x] **搜索框** — 实时过滤，搜 ID/英文名/中文名/描述，空结果友好提示
- [x] **排序下拉** — Default / Rarity ↓ / Recently Unlocked / A → Z
- [x] **稀有度筛选** — All + 6 级 rarity pills，可与分类筛选叠加
- [x] **成就详情 Modal** — 图标 + 双语名称 + 描述 + 进度条/解锁时间。Esc/遮罩关闭
- [x] **10s 自动轮询** — 新解锁 → Toast + 静默刷新（Modal 保护）
- [x] **锁定/解锁视觉重设计** — grayscale(85%) 冻结 vs. ambient glow + ✓ Unlocked 标签
- [x] **Showcase 显示名称** — icon + 成就名两行，76→90px
- [x] **engine.reload()** — 修复 Dashboard 0% bug
- [x] **iconHtml() 渲染函数** — 统一 9 处渲染点，emoji / 图片自动适配
- [x] **YAML icon 对象格式** — `{ src, alt }` 支持，兼容字符串 emoji
- [x] **Level ring 移除** — Hero section 精简

---

## 已解决 ✓

- [x] ~~evaluator threshold 错映射到 evalCounter~~ — 5/29
- [x] ~~sequence 不支持 consecutive/count~~ — 5/29
- [x] ~~distinct_count 忽略 values 白名单~~ — 5/29
- [x] ~~counter 忽略 same_target~~ — 5/29
- [x] ~~hook 补 4 个事件映射~~ — 5/29
- [x] ~~AGENTS.md 补充 24 个手动 track 事件~~ — 5/29-5/30
- [x] ~~12 个事件驱动型新成就~~ — 5/30
- [x] ~~3 个不可达成就删除~~ — 5/30
- [x] ~~Dashboard 中英双语~~ — 5/29
- [x] ~~MCP context 硬编码~~ — 5/29
- [x] ~~10 P0 逻辑 Bug~~ — 5/30
- [x] ~~5 P1 Hook payload 字段缺失~~ — 5/30
- [x] ~~4 P1 Evaluator 功能缺口~~ — 5/30
- [x] ~~6 P2 数据一致性问题~~ — 5/30
- [x] ~~Hermes Agent auto-track~~ — 5/30
- [x] ~~OpenClaw auto-track~~ — 5/31
