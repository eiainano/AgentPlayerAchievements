# Agent Achievement Proximity & Set Completion Rewards

> 2026-06-08 | Two features: MCP `achievement_suggest` tool + Dashboard set-completion visual rewards (Phase 1: title + badge)

## Problem

**#3 Agent proximity awareness** — `findNearUnlocks()` exists but only fires at SessionEnd hook (TTY only). The Agent has no way to know what the user is close to unlocking during conversation. Missed engagement opportunity.

**#5 Set completion rewards** — YAML defines 11 sets with 6 reward types. The Dashboard renders reward text on completed sets, but the reward has no real visual effect — a "Founder" title doesn't appear anywhere on the profile, a "streak_master" badge is just words in a set card. Missing the "collection payoff" moment.

## Goals

| Feature | Goal |
|---------|------|
| `achievement_suggest` MCP tool | Agent can query near-unlock achievements during conversation, with AI-friendly `hint` strings ready to drop into replies |
| Set title rewards | Completed set titles appear as golden pills in profile hero area (below stats-row) |
| Set badge rewards | Completed set badges appear as collectible cards in new "🏅 Badges" section |

## Non-goals (Phase 2+)

- `theme`, `showcase_border`, `animation`, `stat_counter` reward types — Phase 2
- Agent auto-calling suggest every turn — Agent uses judgment
- Badge equipping/unequipping — static display only

---

## Feature #3: `achievement_suggest` MCP Tool

### Architecture

```
Agent calls achievement_suggest({ min_progress: 0.5 })
  → src/tools/suggest.ts  registerSuggestTool()
  → getEngine() → findNearUnlocks(engine.definitions, engine.events, engine.state, opts)
  → add hint field (NL string per suggestion)
  → return { suggestions: [...] }
```

### Tool Schema

```
Tool: achievement_suggest
Description: Return achievements the user is close to unlocking.
  Call periodically after the user completes work, not every turn.

Parameters:
  min_progress  number  0.0–1.0  default 0.5  Only return ≥ this completion %
  max_results   number  1–10     default 3    Max suggestions to return

Response:
{
  suggestions: [
    {
      id:          string    achievement id
      name:        string    localized achievement name
      icon:        string    emoji icon
      rarity:      string    common/uncommon/rare/epic/legendary/mythic
      current:     number    current progress value
      target:      number    target value to unlock
      unit_label:  string    human-readable unit (e.g. "edits", "days", "tasks")
      pct:         number    0-100 completion percentage
      hint:        string    NL hint for Agent to use in reply,
                             e.g. "5 more edits to unlock (45/50)"
    }
  ]
}
```

### Hint generation

`hint` is localized based on `config.lang`:
- EN: `"{remaining} more {unit} to unlock ({current}/{target})"`
- ZH: `"还差{remaining}次{unit}即可解锁({current}/{target})"`

Unit labels map: `src/utils/progress-nudge.ts` `eventTypeLabel()` + i18n extension.

### AGENTS.md update

Insert before "Session end checklist":

```
## During the session — achievement suggestions

When the user has completed a batch of meaningful work (several tool calls,
edits, or tasks), call `achievement_suggest` to check for near-unlock
achievements. If suggestions return with high completion (>75%), weave a
natural mention into your next response — don't force it if it doesn't fit
the conversation flow.

Don't call every turn. Every 5-10 meaningful actions is a good cadence.
```

### Files

| File | Action | Lines |
|------|--------|-------|
| `src/tools/suggest.ts` | NEW — tool handler | ~60 |
| `src/tools/index.ts` | EDIT — register new tool | +3 |
| `AGENTS.md` | EDIT — usage instructions | +7 |
| `tests/tools/suggest.test.ts` | NEW — tool handler tests | ~80 |

---

## Feature #5: Set Completion Visual Rewards (Phase 1)

### Architecture

```
YAML sets[].reward
  → yaml-parser.ts: parseYAML() → sets: SetDefinition[]
  → api.ts: buildSetsResponse() → sets: SetItem[] (already has completed + reward)
  → api.ts: buildApiResponse() → NEW titles: TitleItem[], badges: BadgeItem[]
  → app.js: renderProfile() calls renderTitlesRow()
  → app.js: renderAll() calls renderBadgesSection()
```

### New API types

```typescript
interface TitleItem {
  set_id: string;
  title: string;      // reward.value, e.g. "Founder", "Polyglot"
  set_name: string;   // localized set name
  set_name_cn?: string;
  icon: string;       // first unlocked member's icon (for pill display)
  rarity: string;     // highest member rarity
}

interface BadgeItem {
  set_id: string;
  badge: string;      // reward.value, e.g. "streak_master", "100% Complete"
  set_name: string;
  set_name_cn?: string;
  icon: string;
  completed: number;
  total: number;
}
```

### DashboardData extension

```typescript
export interface DashboardData {
  // ... existing ...
  titles: TitleItem[];   // NEW
  badges: BadgeItem[];   // NEW
}
```

### UI Layout

**Titles row** — inside profile hero, between stats-row and next-ach-card:

```
┌──────────────────────────────────────────────────────┐
│  Lv.7  │  2,450 XP  │  34 Unlocked  │  18.6%  │ ... │  ← stats-row (existing)
├──────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌────────────┐  ┌──────────┐        │  ← titles-row (NEW)
│  │ 🏆 Founder│  │ 🏆 Polyglot│  │ 🏆 Maker │        │
│  └──────────┘  └────────────┘  └──────────┘        │
└──────────────────────────────────────────────────────┘
```

Title pills: golden gradient text, subtle border, hover tooltip shows source set name. Hidden if no titles unlocked.

**Badges section** — between Sets and Timeline sections:

```
┌─ 🏅 Badges ──────────────────────────────────────────┐
│  ┌──────────────┐  ┌───────────────┐                 │
│  │    🔥        │  │     ✅        │                 │
│  │  Endurance   │  │ Completionist │                 │
│  │ streak_master│  │ 100% Complete │                 │
│  │   7/7 ✓      │  │    4/4 ✓      │                 │
│  └──────────────┘  └───────────────┘                 │
└──────────────────────────────────────────────────────┘
```

Badge cards: dark gradient background, gold glowing border, pixel-art-style badge centerpiece. Hidden if no badges unlocked.

### CSS

- `.titles-row` — flex, gap, centered
- `.title-pill` — golden gradient text, rounded bg, border, hover scale
- `.badges-grid` — flex-wrap, gap
- `.badge-card` — dark gradient bg, gold border, set-complete-glow, 160×200px
- `.badge-card .badge-icon` — large centered emoji/icon
- `.badge-card .badge-name` — set name, small muted text
- `.badge-card .badge-badge` — reward text, bold golden

### Files

| File | Action | Lines |
|------|--------|-------|
| `src/dashboard/api.ts` | EDIT — new types, buildApiResponse fills titles/badges | +40 |
| `src/dashboard/public/index.html` | EDIT — titles-row + badges section | +15 |
| `src/dashboard/public/app.js` | EDIT — renderTitlesRow(), renderBadgesSection(), i18n strings | +70 |
| `src/dashboard/public/styles.css` | EDIT — title pills, badge cards | +80 |
| `tests/dashboard/api.test.ts` | EDIT — verify titles/badges in response | +30 |
| `tests/dashboard/server.test.ts` | EDIT — verify API endpoint includes new fields | +15 |

---

## Implementation Order

1. `src/tools/suggest.ts` — tool handler (depends on nothing new)
2. `src/tools/index.ts` — register
3. `tests/tools/suggest.test.ts` — test handler
4. `AGENTS.md` — usage instructions
5. `src/dashboard/api.ts` — titles/badges in DashboardData
6. `src/dashboard/public/index.html` — new DOM containers
7. `src/dashboard/public/app.js` — rendering functions
8. `src/dashboard/public/styles.css` — visual styles
9. `tests/dashboard/api.test.ts` + `server.test.ts` — verify
10. Run full test suite, verify green

## Edge Cases

- **No near-unlock achievements** → suggest returns empty suggestions[]
- **No completed sets** → titles-row hidden, badges section hidden
- **Set completed but reward type is not title/badge** → not included (Phase 2 types)
- **Multiple sets with same reward type** → all displayed, no dedup needed
- **Profile switch** → titles/badges recomputed per profile (same as existing sets behavior)
- **Chinese language active** → hint, title, badge all use localized strings
