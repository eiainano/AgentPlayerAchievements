# 代码审计 & Top 7 TODO — 2026-06-21

> 审计范围：全部 src/ + tests/ + docs/ + YAML 数据源。5 个 agent 并行深入探索。

## 审计方法

| Agent | 范围 | 发现 |
|-------|------|------|
| Test failures | `npm test` 全量运行 | 5 文件 9 失败 + 1 unhandled error |
| Dashboard frontend | `src/dashboard/public/` 全部 HTML/CSS/JS | 热力图标签 DOM 断裂、alert() 滥用、无 onerror 兜底 |
| Questline + Engine | questline 链路 + auditor + evaluator + TODO 扫描 | 全部完成，零 FIXME/TODO |
| Pixel art | `pixel-art-output/` + 生成脚本 + Dashboard 渲染 | 217/217 JPG 就绪，全链路通畅 |
| CLI 27 命令 | `src/cli/` 逐个检查 | 100% 实现，零 stub |

---

## 关键发现：推翻的假设

| 审计前的假设 | 审计后的真相 |
|-------------|------------|
| "像素画需要 Dashboard 集成试点" | **已完成**。217 张 JPG，SVG 渲染管线，全部 UI 组件都在用 |
| "Questline 内容为空" | **已完成**。5 条 QL，YAML 完整，Dashboard 渲染，测试覆盖 |
| "1 个测试因 ESM 解析失败" | **5 个文件 9 个测试失败**。8 超时 + 1 数据漂移 + jsdom 未安装 |
| "CLI 可能有空心壳" | **27/27 全实现**，零 stub。2 个最近新增的（explain、pack）也是完整实现 |
| "代码库有技术债" | grep 整个 src/：零 TODO/FIXME/HACK/XXX |

---

## 项目实际状态

```
v0.1.8 · 217 成就 · 1204 测试（1195 pass / 9 fail） · 27 CLI 命令
7 MCP 工具 · 5 个 Agent 工具支持 · 11 个 set · 5 条 Questline
217/217 像素画 JPG · 217/217 emoji icon · 0 个 stub
```

### 已完成的（之前认为缺失）

- **像素画全链路**：217/217 JPG 已生成，Dashboard `iconHtml()` 以 JPG > SVG > emoji 三级渲染，`pixel-art-output/` ↔ `public/pixel-art/` 同步
- **Questline 系统**：YAML 定义 5 条 QL（Bug Hunter/Toolsmith/Builder/Night Shift/Polyglot），各 3 阶段，Dashboard 渲染 + API 响应 + 完成徽章，9 个测试覆盖
- **`mode` 条件类型**：评估器 `evalMode()` 完整实现 + 2 个测试 + explain 支持，只是暂无 YAML 成就使用它
- **CLI explain 命令**：214 行，7 种条件类型的详细进度展示，支持 `--json`
- **CLI pack 命令**：129 行，list/info 子命令，社区成就包管理
- **Auditor**：928 行，3 层审计（数值一致性 / 语义一致性 / 事件可达性），跨中英文描述比对

### 实际存在的问题

| # | 问题 | 严重度 | 位置 | 修复成本 |
|---|------|:------:|------|:------:|
| 1 | 测试套件不绿（5 文件 9 失败） | P0 | vitest config + auditor.test.ts + 缺 jsdom | 极低（~10 行） |
| 2 | 热力图 col-labels / row-labels 元素不存在于 HTML | P1 | app.js:1924, index.html | 低 |
| 3 | 像素画 `<img>` 无 onerror 兜底 | P1 | app.js iconHtml() | 极低 |
| 4 | 5 处 alert() + 5 处空 catch 块 | P1 | app.js 多处 | 中 |
| 5 | 开源就绪度（CONTRIBUTING.md 等） | P1 | 项目根目录 | 低 |
| 6 | Event Log 无界增长 | P2 | engine/store.ts | 中 |
| 7 | 死代码（孤儿 verify.ts + 未使用 CSS + dead HTML） | P2 | 多个文件 | 低 |

---

## Top 7 TODO（优先级排序）

### P0 — 阻塞性

**1. 修复测试套件至 1204/1204 全绿**

| 子项 | 修复 | 影响文件 |
|------|------|---------|
| 8 个 CLI 测试超时（completion/history/upgrade/watch，默认 5000ms 不够子进程启动） | vitest.config.ts 加 `testTimeout: 20000` | 1 行 |
| auditor.test.ts L779: `expect(report.total).toBe(213)` 实际 212 | 更新期望值 | 1 行 |
| frontend.test.ts 缺 jsdom 依赖 | `npm install -D jsdom` | package.json |

→ CI 绿灯是一切后续工作的前提。

### P1 — 本里程碑交付

**2. 热力图标签 DOM 断裂**

`renderHeatmap()` 寻找 `#heatmap-col-labels` 和 `#heatmap-row-labels`，但 index.html 中这两个元素不存在。用户永远看不到月份列标签和星期行标签——属于"不知道应该有"的功能缺失。

→ 要么补上 HTML 元素让标签生效，要么从 JS 中移除死代码。

**3. 像素画 `<img>` onerror 兜底**

`iconHtml()` 渲染 `<img src="/pixel-art/xxx.jpg">` 无 `onerror` handler。任何 JPG 加载失败 → 破碎图片图标，不会回退到 emoji/SVG。影响所有渲染位置（卡片、模态、展示柜、套装、时间线、gacha、分享卡）。

→ 加一行 `onerror="this.replaceWith(emojiSpan)"` 或等效逻辑。

**4. Dashboard 错误处理现代化**

- 5 处 `alert()` → toast/banner（profile 创建失败、分享卡失败等）
- 5 处空 catch 块 → 至少 `console.warn`（自动轮询、推荐加载等静默失败）

→ 移动端体验 + 可调试性。

**5. 开源就绪度补齐**

- `CONTRIBUTING.md`
- Issue/PR 模板（`.github/ISSUE_TEMPLATE/`、`PULL_REQUEST_TEMPLATE.md`）
- `npm pack --dry-run` 确认发布文件列表
- CI badge 验证（仓库名 `eiainano/AgentPlayerAchievements` 确认）
- README badge 自检（opening GitHub 主页确认全部显示正常）

→ 这些是公开发布的前置条件，按 CLAUDE.md 发布清单执行。

### P2 — 下个里程碑

**6. Event Log 无界增长管理**

当前 `event.log` 只增不减。短期 <50ms/call 但无上限意味着长期退化。PROGRESS.md 标记"监控中"已有时日。

→ 方案：日志轮转（保留最近 N 天）或 `agpa doctor` 诊断警告（文件 >10MB 时提醒）。

**7. 死代码清理**

| 文件 | 问题 |
|------|------|
| `src/cli/verify.ts` | 347 行，不再被 COMMANDS 引用（verify 命令已路由到 doctor.ts --quick） |
| `index.html:L244` | `<select id="sort-select" style="display:none">` 永不可见 |
| `styles.css` | `.dev-reset-btn`、`.card-body-compact`、`.modal-desc-cn`、`@keyframes pulse-highlight` 从未使用 |
| `app.js` | `nav_questlines` / `section_questlines` 等 questline 导航 i18n key 定义了但 Questline 没有独立 tab |

→ 不影响功能，但增加新贡献者的认知负担。

---

## 未入选但值得注意

| 项目 | 原因 |
|------|------|
| `mode` 条件类型无 YAML 使用 | 不影响现有功能；新成就需求时自然用上 |
| 非 CC 工具手动 track 可靠性 | 12 个成就依赖 CLAUDE.md 指令，属文档声明范畴 |
| `GUIDE_ITEMS` 硬编码 | 6 个 achievement ID，当前都有效；ID 变更时才需要关注 |
| Recommend widget 空状态 | 面板空但不可见（auto-expand 20%），低影响 |
| ESC cache 500 条目上限 | 长会话中 `escHtml()` 缓存全清，但性能影响可忽略 |
| 孤儿 `verify.ts` 功能 | doctor.ts --quick 已覆盖其全部功能 |

---

## 审计后修正的文档数字

在审计前已完成文档核查，以下数字已同步至代码实际值：

- 成就总数：218/213 → **217**
- 测试数：1176/1205 → **1204**（46 文件）
- CLI 命令：25 → **27**
- MCP 工具：6 → **7**
- Skill 类别：17 → **16**
- 隐藏成就：64 → **63**
- README 5 文件行数：491 → **510**
