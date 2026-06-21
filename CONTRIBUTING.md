# Contributing to AGPA

Welcome! AGPA (Agent Player Achievements) is a gamified achievement system for AI coding agents — think "Steam Achievements, but for your AI assistant."

Whether you want to fix a typo, add an achievement, improve the Dashboard, or wire up support for a new agent tool, you're in the right place.

## Quick Start

```bash
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements
npm install
npm test          # 1207 tests, ~46 files
npm run build     # tsc --noEmit — must exit clean
npm run dashboard # starts on :3867, open browser
```

You need **Node ≥ 18**. No other system dependencies.

## Ways to Contribute

There are four contribution paths, ordered from easiest to deepest:

| Path | What you need to know | Example |
|------|----------------------|---------|
| **Achievement Pack** | YAML + achievement design | Create a themed pack of 5–10 achievements |
| **Dashboard / Frontend** | HTML, CSS, vanilla JS | Fix a UI bug, improve an interaction |
| **Hook / Tool integration** | TypeScript + one agent tool's plugin API | Wire up event auto-tracking for a new tool |
| **Engine core** | TypeScript + evaluator/counter logic | Add a condition type, fix evaluator correctness |

### 1. Achievement Packs (easiest)

This is the best place to start. You don't need to touch any TypeScript — just YAML.

1. Read **[Creating Community Achievement Packs](docs/creating-achievements.md)** — covers all 12 condition types, 42+ event types, filter syntax, windows, and best practices
2. Copy `examples/example-pack.yaml` as a starting point
3. Write your achievements, test them locally by dropping your `.yaml` file into `~/.agent-achievements/packs/`
4. Open a PR with your `.yaml` file

See [`.github/ISSUE_TEMPLATE/achievement-idea.md`](.github/ISSUE_TEMPLATE/achievement-idea.md) if you just have an idea but don't want to write the YAML yourself.

**Rules for packs:**
- Packs can define **achievements only** — no sets, questlines, or engine changes
- Every `id` must be unique across all packs and core
- Every event type must be in the known event list (the pack loader will warn you)
- Packs with errors are **isolated** — one broken pack won't crash the others

### 2. Dashboard / Frontend

The Dashboard is zero-framework: vanilla HTML, CSS, and JavaScript. Entry points:

| File | What it does |
|------|-------------|
| `src/dashboard/public/index.html` | Page structure + i18n `data-i18n` attributes |
| `src/dashboard/public/styles.css` | All styles (desktop-first, 4 responsive breakpoints) |
| `src/dashboard/public/app.js` | Main rendering logic, API calls, event handling |
| `src/dashboard/public/tour.js` | 4-step guided tour overlay |
| `src/dashboard/public/gacha-reveal.js` | Achievement unlock animation system |
| `src/dashboard/server.ts` | HTTP server (static files + API routes) |
| `src/dashboard/api.ts` | API response builders |

**Conventions:**
- New UI strings need both `en` and `zh-CN` entries in the I18N table (extend to ES/KO/JA if you can)
- Test changes with `npm run dashboard` and open `http://localhost:3867`
- Use `npm run demo` first if you need sample data to work with

### 3. Hook / Tool Integration

AGPA supports 5 agent tools through two channels: MCP Server (agent actively calls AGPA tools) and Hook CLI (tool events are auto-tracked without agent awareness).

| Tool | Auto-track mechanism | Translation layer |
|------|---------------------|-------------------|
| Claude Code | CC hooks → stdin pipe | `src/cli/hook.ts` `auto` mode |
| Hermes Agent | Shell hooks → stdin pipe | `src/cli/hook.ts` `hermes-auto` mode |
| OpenClaw | TS plugin → `Bun.spawn` stdin pipe | `src/cli/hook.ts` `openclaw-auto` mode |
| Kilo Code / OpenCode | TS plugin → `Bun.spawn` stdin pipe | `src/cli/hook.ts` `kilocode-auto` mode |

To add a new tool, you need:
1. A translation layer in `src/cli/hook.ts` (tool-specific fields → `HookStdin`)
2. Init logic in `src/cli/init.ts` (MCP config injection + instruction injection)
3. Installation docs in `docs/multi-tool-setup.md`

Read [`docs/multi-tool-research.md`](docs/multi-tool-research.md) for the hook API research behind each tool.

### 4. Engine Core

The engine is a set of pure functions operating on in-memory data. It's where achievement evaluation logic lives.

| Directory | Responsibility |
|-----------|---------------|
| `src/engine/` | `track()`, `poll()`, `evaluateCondition()`, 12 evaluators |
| `src/engine/evaluator.ts` | All 12 condition types (counter, threshold, streak, sequence, etc.) |
| `src/engine/types.ts` | TypeScript interfaces — the source of truth for data shapes |
| `src/engine/store.ts` | File I/O (event.log, state.json, stats.json, config.json) |

**Before touching the evaluator**, review existing tests in `tests/engine/evaluator.test.ts` — they document edge cases and expected behavior for every condition type.

## Coding Conventions

- **ESM only** (`"type": "module"`). No CommonJS.
- **No new npm dependencies** without strong justification. We currently have exactly 5: `mcp-sdk`, `yaml`, `zod`, `figlet`, `tsx` (tsx is runtime for the `bin` shebang)
- **All JSON parsing** uses `safeParse()` from `src/utils/validate.ts` — never raw `JSON.parse()`
- **TypeScript compiles clean**: `npx tsc --noEmit` must exit with zero errors
- **Version numbers**: always bump within `0.1.x` (`0.1.8` → `0.1.9`) unless the user explicitly says otherwise
- **The YAML file** (`achievement-definitions.yaml`) is the **authoritative data source**. If you add a condition field, update `types.ts` `Condition` interface AND `yaml-parser.ts` `buildCondition()`
- **Notifications** go through `src/utils/notify.ts` — don't duplicate in hook.ts or poll.ts
- **Dashboard** stays zero-framework — no React, Vue, or npm UI libraries

## Testing

```bash
npm test              # full suite (~11s)
npm run build         # type-check
```

**We require tests with contributions:**
- Engine/evaluator changes: add tests in `tests/engine/evaluator.test.ts`
- New achievements: every achievement gets an auto-generated reachability test via `tests/verify/every-achievement.test.ts` — just add it to the achievement list
- Hook changes: add tests in `tests/cli/hook.test.ts`
- Dashboard changes: add tests in `tests/dashboard/`

Test infrastructure: [Vitest](https://vitest.dev/), with `testTimeout: 20000` for CLI tests that spawn subprocesses.

## Project Documentation

## Pull Request Process

1. **Check existing work** — search [issues](https://github.com/eiainano/AgentPlayerAchievements/issues) to avoid duplication
2. **Branch from `dev`** — `main` is the stable release branch
3. **Keep it focused** — one PR = one logical change. A new achievement pack, a bug fix, a feature — not all three at once
4. **Write tests** — CI will not pass without them
5. **If you changed docs, sync the numbers** — achievement count, test count, CLI command count, etc. across `README*.md`
6. **PR description** should say what you did and why

A maintainer will review within a few days. Don't be discouraged if we ask for changes — it's how we keep quality high.

## Getting Help

- **Bug reports & feature requests**: [GitHub Issues](https://github.com/eiainano/AgentPlayerAchievements/issues)
- **Questions about writing achievements**: read [`docs/creating-achievements.md`](docs/creating-achievements.md) first
- **Architecture questions**: the [CLAUDE.md](CLAUDE.md) file at the repo root is the definitive technical reference

---

Thank you for contributing! Every achievement, bug fix, and improvement makes AGPA better for the entire AI-coding community.
