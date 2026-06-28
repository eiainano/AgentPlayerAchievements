# Agent Player Achievements (AGPA) 🏆

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="pixel-art-output/agpa-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="pixel-art-output/agpa-logo-light.png">
    <img alt="AGPA Logo" src="pixel-art-output/agpa-logo-dark.png" width="192">
  </picture>
</p>

<p align="center">
  <strong>EN</strong>&nbsp;|&nbsp;<a href="./README.zh-CN.md">中文</a>&nbsp;|&nbsp;<a href="./README.es.md">ES</a>&nbsp;|&nbsp;<a href="./README.ko.md">한국어</a>&nbsp;|&nbsp;<a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  Gamified achievement system for AI coding agents.<br>
  <em>Earn XP, unlock trophies, level up — just by doing what you already do.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/achievements-217-blueviolet" alt="217 achievements"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-1207-green" alt="1207 tests"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" alt="Node >= 18"></a>
  <a href="#"><img src="https://img.shields.io/badge/CLI-27_commands-orange" alt="27 CLI commands"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements"><img src="https://img.shields.io/github/stars/eiainano/AgentPlayerAchievements?style=flat&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/commits/dev"><img src="https://img.shields.io/github/last-commit/eiainano/AgentPlayerAchievements/dev" alt="Last commit"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/i18n-5_languages-blue" alt="i18n: 5 languages"></a>
</p>

<p align="center">
  <b>Claude Code</b>&nbsp;·&nbsp;<b>Kilo Code</b>&nbsp;·&nbsp;<b>OpenCode</b>&nbsp;·&nbsp;<b>Hermes</b>&nbsp;·&nbsp;<b>OpenClaw</b>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#features">Features</a> ·
  <a href="#supported-tools">Supported Tools</a> ·
  <a href="#cli-commands">CLI Commands</a> ·
  <a href="#community-packs">Community Packs</a> ·
  <a href="#dashboard">Dashboard</a> ·
  <a href="#security--privacy">Security & Privacy</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#faq">FAQ</a>
</p>

---

### Without AGPA ❌

- **No visibility** into your coding habits across sessions
- **Can't track progress** — getting faster? Using more tools? No way to know
- **No motivation** to explore your agent's full feature set
- **Same routine** every day — no surprises, no milestones

### With AGPA ✅

- **Auto-tracking** — every tool call, file edit, and git commit logged automatically
- **Steam-style dashboard** — XP bar, levels, streaks, heatmaps, achievement showcase
- **217 achievements** across 11 categories — from "Hello World" to "Completionist"
- **Instant feedback** — terminal popups, macOS notifications, 8-bit sounds on unlock

---

## Dashboard Preview

<p align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="assets/screenshots/agpa-shot-1.png" alt="AGPA Home" width="100%"><br>
        <sub><b>Home</b> — XP bar, streaks, agent stats</sub>
      </td>
      <td align="center" width="50%">
        <img src="assets/screenshots/agpa-shot-2.png" alt="Achievement Grid" width="100%"><br>
        <sub><b>Achievements</b> — 217 achievements × 11 categories</sub>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <img src="assets/screenshots/agpa-shot-3.png" alt="Achievement Sets" width="100%"><br>
        <sub><b>Sets</b> — themed collections with progress tracking</sub>
      </td>
      <td align="center" width="50%">
        <img src="assets/screenshots/agpa-shot-4.png" alt="Achievement Detail" width="100%"><br>
        <sub><b>Detail Card</b> — rarity, unlock date, replay animation</sub>
      </td>
    </tr>
  </table>
</p>

---

## Quick Start

**Prerequisites:** Node.js ≥ 18

```bash
# Option A: install globally (recommended for users)
npm install -g @eiainano/agpa
agpa init

# Option B: clone and link (recommended for contributors)
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

That's it. Keep using your agent — achievements unlock automatically as you work.

> [!TIP]
> Want to see what the dashboard looks like without waiting for real unlocks? Run `agpa demo` to generate sample data instantly.

```bash
agpa dashboard         # open the achievement dashboard
agpa stats             # check your progress
agpa assets download   # (optional) pre-download all 219 pixel-art badges
```

## How It Works

```
Your Coding Session
  │
  ├─ You code, agent responds — every action is tracked
  │   └─ dual-channel: MCP tools + Hook events
  │
  ├─ Session ends → engine evaluates 217 achievements
  │   └─ unlocked? → macOS notification 🎉
  │
  └─ agpa dashboard → view, sort, filter, share
```

**Two data channels → one engine → one dashboard:**

| Channel | Method | Captures |
|---------|--------|----------|
| **Hook CLI** | Tool hooks (subprocess via stdin) | file.read/write/edit, tool.complete, git.commit, session.start/end, task.complete, agent.spawn |
| **MCP Server** | STDIO protocol (7 tools) | image.read, file.language_used, plan.mode_entered, user.message, automode.start, achievement config, explain |

Both channels write to the same `~/.agent-achievements/` event log. The engine evaluates 12 condition types against 217 achievements.

> [!NOTE]
> **Zero overhead.** The Hook CLI is a sub-millisecond subprocess. The MCP server runs on STDIO with no network calls. All data stays on your machine.

## Features

- 🎮 **Achievement Dashboard** — XP bar, level, streak, activity heatmap, rarity breakdown, showcase
- 🏆 **217 Achievements** across 11 categories — from "Hello World" to "Completionist"
- 🔥 **GitHub-style activity heatmap** — 4 months of coding activity at a glance
- 📸 **Share Card** — dark/light themed, bilingual, downloadable PNG
- 🔊 **8-bit sound effects & notifications** — rarity-graded retro sounds + desktop push notifications on unlock
- 📂 **Multi-profile** — up to 4 profiles, switch anytime (work, personal, experimentation)

## Supported Tools

<p align="center">
  <a href="#claude-code"><img src="https://img.shields.io/badge/Claude_Code-auto_+_MCP-blueviolet?logo=claude" alt="Claude Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/Kilo_Code-auto_+_MCP-00b4d8" alt="Kilo Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/OpenCode-auto_+_MCP-2ec4b6" alt="OpenCode"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/Cursor-MCP_only-007acc?logo=cursor" alt="Cursor"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/VS_Code-MCP_only-007acc?logo=visualstudiocode" alt="VS Code"></a>
  <a href="#hermes"><img src="https://img.shields.io/badge/Hermes-MCP_only-ff6b6b" alt="Hermes"></a>
  <a href="#openclaw"><img src="https://img.shields.io/badge/OpenClaw-auto_+_MCP-ffd166" alt="OpenClaw"></a>
</p>

| Tool | Auto-track | MCP track | Easiest Setup |
|------|:----------:|:---------:|---------------|
| Claude Code | ✅ | ✅ | `agpa init` auto-detects |
| Kilo Code | ✅ | ✅ | TS plugin + MCP config |
| OpenCode | ✅ | ✅ | TS plugin + MCP config |
| Hermes | — | ✅ | MCP JSON config |
| OpenClaw | ✅ | ✅ | Plugin + MCP config |

All five tools have full dual-channel coverage except Hermes (no hook API). For any MCP-compatible client (Cursor, VS Code, Windsurf, etc.), MCP-only tracking works out of the box — you just miss hook-based auto-tracking.

> [!TIP]
> **New to MCP?** Start with `agpa init` — it auto-detects your installed tools and configures everything. Manual JSON configs below are fallbacks.

<details>
<summary><b>Claude Code</b> — auto-track + MCP (full coverage)</summary>

`agpa init` auto-detects Claude Code and registers both channels. For manual setup:

**MCP config** (`~/.claude/.mcp.json` or project-root `.mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```

**Hook registration** — `agpa init` adds hook entries to your Claude Code settings. Verify with `agpa verify`.
</details>

<details>
<summary><b>Cursor / VS Code</b> — MCP only</summary>

These editors support MCP but don't expose hook APIs for auto-tracking. You get tool-call tracking via MCP.

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Kilo Code / OpenCode</b> — auto-track + MCP (full coverage)</summary>

These tools support TS plugins for hook-level auto-tracking. `agpa init` registers the plugin + MCP config.

**Manual MCP config** (`opencode.json` or Kilo Code settings):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```

The TS plugin (registered by `agpa init`) handles PostToolUse, SessionStart, SessionEnd, and other hook events automatically.
</details>

<details>
<summary><b>Hermes</b> — MCP only</summary>

Hermes does not expose a hook API. MCP-based tracking covers tool calls and session events.

**MCP config** (`~/.hermes/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>OpenClaw</b> — auto-track + MCP (full coverage)</summary>

OpenClaw supports a plugin system for hook-level tracking. `agpa init` registers both the plugin and MCP config.

**Manual MCP config**:
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```
</details>

## MCP Server

AGPA runs a [Model Context Protocol](https://modelcontextprotocol.io) server (stdio transport) that exposes 7 tools for any MCP-compatible client — Claude Desktop, Cursor, VS Code, Windsurf, and more.

| Tool | Description |
|------|-------------|
| `achievement.track` | Record an agent event (lightweight, <1ms append-only write) |
| `achievement.poll` | Evaluate pending events → check for unlocks → return new achievements |
| `achievement.stats` | Get player stats: XP, level, total achievements, streaks, recent activity |
| `achievement.showcase` | Display all achievement definitions — name, category, rarity, progress |
| `achievement.config` | Read/write AGPA config: language, notification preferences, profile |
| `achievement.suggest` | Get personalized achievement recommendations based on current progress |
| `achievement.explain` | Explain why an achievement is (un)locked — condition breakdown with event history |

**Quick start with any MCP client:**

```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["-y", "@eiainano/agpa", "agpa-mcp"]
    }
  }
}
```

> Already installed AGPA globally? Run `agpa-mcp` directly. The server auto-detects your active profile and tool source.

## CLI Commands

| Command | Description |
|---------|-------------|
| `agpa init` | Auto-detect and register with your agent tools |
| `agpa uninstall` | Cleanly remove AGPA from all configured tools |
| `agpa verify` | Check installation correctness |
| `agpa doctor` | Diagnose system state |
| `agpa dashboard` | Start achievement dashboard (localhost:3867) |
| `agpa stats` | Show achievement progress summary |
| `agpa progress` | List all achievements with unlock status |
| `agpa profile` | Manage achievement profiles (create, list, switch, softwares, delete) |
| `agpa demo` | Generate MVP demo data for testing |
| `agpa reset` | Reset all tracking data |
| `agpa config` | View/modify config (lang, sound, debug...) |
| `agpa showcase` | Manage showcase (list, pin, unpin, auto-fill) |
| `agpa search` | Search achievements by keyword/rarity/category |
| `agpa suggest` | Suggest next achievement to hunt |
| `agpa sound` | Toggle 8-bit rarity-graded sound effects (on, off) |
| `agpa activity` | View streak + 4-month activity heatmap |
| `agpa export` | Export achievement data as JSON |
| `agpa import` | Import from backup |
| `agpa mcp` | Start MCP server (stdio mode) |
| `agpa web` | Alias for `agpa dashboard` |
| `agpa pack` | List or inspect installed community achievement packs |
| `agpa banner` | Switch terminal banner color theme (Neon/Arcade/Gold) |
| `agpa history` | Browse raw event log entries |
| `agpa explain` | Show why an achievement is locked/unlocked (condition breakdown) |
| `agpa watch` | Real-time achievement progress monitor |
| `agpa upgrade` | Check for updates and upgrade AGPA |
| `agpa completion` | Generate shell completion script (bash/zsh/fish) |

> Full CLI reference: `agpa --help`

## Community Packs

Anyone can create and share achievement packs. Drop a YAML file into `~/.agent-achievements/packs/` to install:

```bash
agpa pack list              # list installed packs
agpa pack info <id>         # show pack details
```

See [Creating Achievement Packs](docs/creating-achievements.md) for the pack format spec, event type catalog, and 12 condition types.

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
├── tool-registry.ts         # Central tool registration
├── cli/
│   ├── index.ts             # Unified CLI entry (27 commands)
│   ├── hook.ts              # Hook CLI (track + poll + auto modes)
│   ├── init.ts              # Interactive install wizard
│   ├── dashboard.ts         # Dashboard launcher
│   ├── doctor.ts            # System diagnostic
│   └── ...                  # 22 more CLI commands
├── engine/
│   ├── engine.ts            # Core engine (track / poll / stats)
│   ├── evaluator.ts         # 12 condition type evaluators
│   ├── store.ts             # JSONL event log + state persistence
│   ├── types.ts             # TypeScript interfaces
│   └── yaml-parser.ts       # YAML achievement definition parser
├── dashboard/
│   ├── server.ts            # HTTP server + API routes
│   ├── api.ts               # Card data, stats aggregation
│   ├── public/              # Zero-framework HTML/CSS/JS frontend
│   └── customize-api.ts     # Self-customize endpoint
├── tools/                   # MCP tool definitions (7 tools)
├── utils/                   # notify, validate, profile, pixel-art, battery, etc.
├── verify/
│   └── auditor.ts           # Achievement verification logic
├── config.ts                # Global configuration
└── helpers.ts               # Shared utilities

pixel-art-output/            # Logo images (README)
achievement-definitions.yaml   # 217 achievement definitions (authoritative)
scripts/                     # dev tools (logo gen, pixel art gen, sounds)
```

## 🔒 Security & Privacy

- **Local-first** — All event data stays in `~/.agent-achievements/`. No telemetry, no cloud sync, no network calls at runtime.
- **Auditable** — The engine is pure TypeScript functions operating on JSONL files. No obfuscation, no binary blobs.
- **Minimal dependencies** — 5 runtime dependencies (`@modelcontextprotocol/sdk`, `yaml`, `zod`, `figlet`, `tsx`) — all widely audited.
- **STDIO isolation** — The MCP server communicates via standard I/O only. No HTTP endpoints exposed.
- **Hook sandbox** — The Hook CLI runs as a sub-millisecond subprocess — it cannot persist state or access the network.
- **Supply chain** — No native modules, no postinstall scripts, no binary downloads at install time.

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## 👥 Contributing

We welcome contributions! Whether it's an achievement pack, a Dashboard improvement, a new tool integration, or an engine fix — there's a path for every skill level.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — setup, coding conventions, PR process, and 4 contribution paths
- **[Creating Achievement Packs](docs/creating-achievements.md)** — the complete guide to writing achievement definitions
- **[`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/)** — issue and PR templates

## 🌐 Environment Variables

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `AGPA_PROFILE` | Active profile name | `default` | any string |
| `AGPA_LANG` | Interface language | `en` | `en`, `zh` |
| `AGPA_ENABLED_CATEGORIES` | Filter which achievement categories are active | all | comma-separated (e.g. `onboarding,tool_mastery`) |
| `AGPA_DEBUG` | Enable verbose debug logging | `false` | `true` |
| `AGPA_SOUND` | Override sound effects | config setting | `on`, `off`, `true`, `false` |
| `AGPA_SIMPLE_ANIMATIONS` | Use simplified terminal animations | `false` | `true` |
| `AGPA_BANNER_THEME` | CLI startup banner style | `Arcade` | `Neon`, `Arcade`, `Gold` |
| `AGPA_TELEMETRY` | Enable anonymous usage telemetry | `false` | `true`, `false` |
| `AGPA_TELEMETRY_SERVER` | Custom telemetry endpoint URL | `''` (none) | URL string |
| `AGPA_TOOL_SOURCE` | Override tool source identifier | auto-detected | `claude-code`, `hermes`, `openclaw`, etc. |
| `AGPA_MODEL` | Current AI model name (for achievements) | `auto` | any model string |

> [!TIP]
> Environment variables override `config.json` settings. Set them in your shell profile or agent configuration for persistent overrides.

## FAQ

**Q: Does this slow down my agent?**
A: No. The Hook CLI is a sub-millisecond subprocess. The MCP server runs on STDIO with zero network overhead.

**Q: Can I use it with multiple agents?**
A: Yes. The init wizard auto-detects Claude Code, Kilo Code, OpenCode, Hermes, and OpenClaw. Each can have its own profile.

**Q: My achievements aren't unlocking?**
A: Run `agpa doctor` — it diagnoses tracking status, hook registration, and event coverage.

**Q: How is this different from WakaTime or coding activity trackers?**
A: WakaTime tells you *what* you did — hours, languages, projects. AGPA makes it *fun* — XP, levels, achievements, streaks, and Steam-style dopamine hits. It's gamification layered on top of your existing workflow, not another dashboard to check. Think of it as the difference between a fitness tracker's raw step count and a Pokémon Go badge — same data, different experience.

**Q: Can I customize achievement names?**
A: Yes. `/customize` page in the dashboard lets you rename any achievement.

## Troubleshooting

> [!IMPORTANT]
> **First step for any issue:** Run `agpa doctor` — it diagnoses tracking status, hook registration, event coverage, and configuration problems in one shot.

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Achievements not unlocking | Hook/MCP not registered | Run `agpa doctor` to check hook registration + event coverage |
| Dashboard won't start | Port 3867 already in use | `agpa dashboard 8080` (or any free port) |
| `agpa init` fails | Agent tool not detected | Check supported tools list; use manual MCP JSON config as fallback |
| No macOS notifications | `terminal-notifier` missing | Run `brew install terminal-notifier`, or `agpa init` auto-installs it |
| Sound not playing | Audio context blocked by browser | Click anywhere on the dashboard page to enable audio |
| Profile switching not working | Profile doesn't exist | `agpa profile list` to see available profiles, then `agpa profile switch <name>` |
| Hook CLI errors in agent logs | stdin pipe is empty (expected for first run) | Normal — hooks are short-lived subprocesses; errors are logged to `~/.agent-achievements/error.log` |

For persistent issues, check `~/.agent-achievements/error.log` or [open an issue](https://github.com/eiainano/AgentPlayerAchievements/issues).

## Star History

<img alt="Star History Chart" src="https://api.star-history.com/svg?repos=eiainano%2Fagentplayerachievements&type=Date" width="100%">

## License

MIT — see [LICENSE](LICENSE)
