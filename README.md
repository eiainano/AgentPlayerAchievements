# Agent Player Achievements (AGPA) 🏆

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="pixel-art-output/agpa-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="pixel-art-output/agpa-logo-light.png">
    <img alt="AGPA Logo" src="pixel-art-output/agpa-logo-dark.png" width="192">
  </picture>
</p>

<p align="center">
  <strong>English</strong>&nbsp;|&nbsp;<a href="./README.zh-CN.md">中文</a>
</p>

<p align="center">
  Gamified achievement system for AI coding agents.<br>
  <em>Earn XP, unlock trophies, level up — just by doing what you already do.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/achievements-171-blueviolet" alt="171 achievements"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-519-green" alt="519 tests"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" alt="Node >= 18"></a>
  <a href="#"><img src="https://img.shields.io/badge/CLI-19_commands-orange" alt="19 CLI commands"></a>
</p>

<p align="center">
  <b>Claude Code</b>&nbsp;·&nbsp;<b>Kilo Code</b>&nbsp;·&nbsp;<b>OpenCode</b>&nbsp;·&nbsp;<b>Hermes</b>&nbsp;·&nbsp;<b>OpenClaw</b>
</p>

---

## Quick Start

```bash
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

That's it. Keep using your agent — achievements unlock automatically as you work.

```bash
agpa dashboard   # open the achievement dashboard
agpa stats       # check your progress
```

## How It Works

```
Your Coding Session
  │
  ├─ You code, agent responds — every action is tracked
  │   └─ dual-channel: MCP tools + Hook events
  │
  ├─ Session ends → engine evaluates 171 conditions
  │   └─ unlocked? → macOS notification 🎉
  │
  └─ agpa dashboard → view, sort, filter, share
```

**Two data channels → one engine → one dashboard:**

| Channel | Method | Captures |
|---------|--------|----------|
| **Hook CLI** | Tool hooks (subprocess via stdin) | file.read/write/edit, tool.complete, git.commit, session.start/end, task.complete, agent.spawn |
| **MCP Server** | STDIO protocol (5 tools) | image.read, file.language_used, plan.mode_entered, user.message, automode.start |

Both channels write to the same `~/.agent-achievements/` event log. The engine evaluates 11 condition types against 171 achievements.

## Features

- 🎮 **Achievement Dashboard** — XP bar, level, streak, activity heatmap, rarity breakdown, showcase
- 🏆 **171 Achievements** across 10 categories (Onboarding, Tool Mastery, Milestones, Skill, Style, Workflow, Creator, Hidden, Challenge, Community)
- 🔥 **GitHub-style heatmap** — 4 months of coding activity at a glance
- 📸 **Share Card** — dark/light themed, bilingual (EN/ZH), downloadable PNG
- 🔊 **8-bit sound effects** — rarity-graded retro sounds for unlocks
- 🔔 **macOS notifications** — click to jump to dashboard
- 📊 **XP & Level system** — usage-scaled XP with level ladder
- 📂 **Multi-profile** — up to 4 profiles, switch any time
- 🌓 **Dark & Light themes** — auto-detects system preference
- 🖥️ **Terminal ANSI popups** — achievement unlocked banners in terminal

## Supported Tools

| Tool | Auto-track | MCP track | Setup |
|------|:----------:|:---------:|-------|
| Claude Code | ✅ | ✅ | `agpa init` auto-detects |
| Kilo Code | ✅ | ✅ | TS plugin + MCP config |
| OpenCode | ✅ | ✅ | TS plugin + MCP config |
| Hermes | — | ✅ | MCP JSON config |
| OpenClaw | ✅ | ✅ | Plugin + MCP config |

All five tools have full dual-channel coverage except Hermes (no hook API).

## CLI Commands

```bash
agpa init             # auto-detect and register with your agent tools
agpa verify           # check installation correctness
agpa doctor           # diagnose system state
agpa dashboard        # start achievement dashboard (localhost:3867)
agpa stats            # show achievement progress summary
agpa progress         # list all achievements with status
agpa profile          # manage achievement profiles
agpa demo             # generate MVP demo data
agpa reset            # reset all data
agpa config           # view/modify config (lang, sound, debug...)
agpa showcase         # manage showcase (list, pin, unpin, auto-fill)
agpa search           # search achievements by keyword/rarity/category
agpa suggest          # suggest next achievement to hunt
agpa sound            # test sound effects
agpa activity         # view streak + activity heatmap
agpa export           # export achievement data
agpa import           # import from backup
agpa mcp              # start MCP server (stdio)
agpa web              # alias for dashboard
```

## Achievement Categories

| # | Category | Count | Highlight |
|---|----------|:-----:|-----------|
| 1 | Onboarding | 14 | Hello World, first tool call, first PR |
| 2 | Tool Mastery | 30 | Read/Edit/Bash skill thresholds |
| 3 | Milestones | 18 | task count, streak, token usage |
| 4 | Skill | 14 | chain reactions, debugger, one-shots |
| 5 | Style | 10 | minimalist, night owl, copy-paste king |
| 6 | Workflow | 19 | PRs, CI/CD, code review, merge conflict |
| 7 | Creator | 9 | slash commands, skills, agents, hooks |
| 8 | Hidden | 20 | easter eggs and surprise unlocks |
| 9 | Challenge | 10 | speed runs, multi-model, no-edit streaks |
| 10 | Community | 10 | completionist tiers, cross-tool collector |

## Dashboard

<p align="center">
  <em>Stats row → Streak + Heatmap → Showcase → Achievement grid with search/filter</em>
</p>

```bash
agpa dashboard           # default :3867
agpa dashboard 8080      # custom port
agpa dashboard --profile work   # launch with specific profile
```

- **Stats**: XP, level, total achievements, streak, tasks, tool uses
- **Heatmap**: GitHub-style 4-month activity grid
- **Showcase**: Pinned favorite achievements (up to 6)
- **Achievement Grid**: search, sort by rarity/category, filter unlocked/locked
- **Sound toggle**: 8-bit rarity-graded effects
- **Share button**: generates a beautiful bilingual card → PNG download

## Architecture

```
                    ┌─────────────────────────┐
                    │   Engine (src/engine/)   │
                    │   track() / poll()       │
                    └─────────────────────────┘
                      ↗                    ↖
            MCP Server               Hook CLI
          (src/main.ts)           (src/cli/hook.ts)
                │                        │
          STDIO long-lived      short-lived subprocess
                │                  (stdin pipe)
                │                        │
          Agent calls             Hooks fire
          consciously             automatically
                │                        │
          ┌─────┴─────┐          ┌──────┴──────┐
          │ Manual     │          │ Auto-track  │
          │ image.read │          │ tool.complete│
          │ lang_used  │          │ file.edit   │
          │ plan.mode  │          │ session.*   │
          │ ...        │          │ agent.spawn │
          └───────────┘          └─────────────┘
                    ╲            ╱
                     event.log  ← both write here
                          │
                     engine.poll()
                          │
                     state.json
                          │
                     Dashboard
```

## Project Structure

```
src/
├── main.ts                  # MCP Server entry (STDIO)
├── cli/
│   ├── hook.ts              # Hook CLI (track + poll + auto modes)
│   ├── init.ts              # Interactive install wizard
│   ├── dashboard.ts         # Dashboard launcher
│   ├── doctor.ts            # System diagnostic
│   ├── mvp.ts               # Demo data generator
│   └── ...                  # 13 more CLI commands
├── engine/
│   ├── engine.ts            # Core engine (track / poll / stats)
│   ├── evaluator.ts         # 11 condition type evaluators
│   ├── store.ts             # JSONL event log + state persistence
│   ├── types.ts             # TypeScript interfaces
│   └── yaml-parser.ts       # YAML achievement definition parser
├── dashboard/
│   ├── server.ts            # HTTP server + API routes
│   ├── api.ts               # Card data, stats aggregation
│   ├── public/              # Zero-framework HTML/CSS/JS frontend
│   └── customize-api.ts     # Self-customize endpoint
├── tools/                   # MCP tool definitions (5 tools)
├── utils/                   # notify, validate, log, errors, profile
├── config.ts                # Global configuration
└── helpers.ts               # Shared utilities

pixel-art-output/            # Logo + achievement pixel art
04-成就定义清单.yaml          # 171 achievement definitions (authoritative)
scripts/                     # dev tools (logo gen, pixel art gen, sounds)
```

## Development

```bash
npm install          # install dependencies (3 runtime deps)
npm run build        # tsc --noEmit
npm test             # 519 tests, 23 files
npm run dashboard    # start dev dashboard
npm run demo         # generate MVP data
```

## Dependencies

- **Runtime** (3): `@modelcontextprotocol/sdk` · `yaml` · `zod`
- **Dev**: `typescript` · `vitest` · `tsx`
- **Optional** (macOS): `terminal-notifier` — system notifications for unlocks

No heavy frameworks. No database. Pure in-memory engine with JSONL file storage.

## FAQ

**Q: Does this slow down my agent?**
A: No. The Hook CLI is a sub-millisecond subprocess. The MCP server runs on STDIO with zero network overhead.

**Q: Can I use it with multiple agents?**
A: Yes. The init wizard auto-detects Claude Code, Kilo Code, OpenCode, Hermes, and OpenClaw. Each can have its own profile.

**Q: My achievements aren't unlocking?**
A: Run `agpa doctor` — it diagnoses tracking status, hook registration, and event coverage.

**Q: Can I customize achievement names?**
A: Yes. `/customize` page in the dashboard lets you rename any achievement.

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  <sub>Built for developers who love gamification. 171 achievements and counting.</sub>
</p>
