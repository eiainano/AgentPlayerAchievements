---
description: View your AGPA achievement progress — Steam-style gamification for Claude Code
argument-hint: "[unlocked|locked|all|stats|recent|settings|<rarity>|<set>]"
allowed-tools: Read Bash
---

## /achievements — AGPA Achievement Viewer

Display achievement progress in chat. Output directly in your response — no Bash needed for display.

### Step 1: Determine state directory

Read `~/.agent-achievements/config.json`. If it has `active_profile` (not "default"), stateDir = `~/.agent-achievements/profiles/<active_profile>/`. Otherwise stateDir = `~/.agent-achievements/`.

If `AGPA_PROFILE` env is set, use `~/.agent-achievements/profiles/<AGPA_PROFILE>/` instead (hard override).

### Step 2: Load data

Read these files (all JSON):

1. `{stateDir}/state.json` — unlock status, XP, counters, session data
2. `{stateDir}/achievements.json` — achievement metadata (name, description, icon, rarity, category, set, tip, hint)

If `achievements.json` doesn't exist, tell user: "Run `npx tsx scripts/compile-achievements.ts` from the AGPA project to generate achievement metadata." and stop.

### Step 3: Determine view mode from $ARGUMENTS

| Argument | Mode |
|----------|------|
| (none) or `unlocked` | Show unlocked achievements with tips |
| `locked` | Show locked achievements with hints |
| `all` | All achievements grouped by category |
| `stats` | Stats panel (XP, level, rarity distribution) |
| `recent` | Most recently unlocked (last 5 by unlocked_at) |
| `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic` | Filter by rarity |
| `<set_name>` (e.g. `the_beginning`, `git_flow`) | Filter by set |

### Step 4: Format output

#### Header (all modes except stats)

Always show:
```
🏆 AGPA ACHIEVEMENTS
▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  {unlocked}/{total}  {pct}%
```

Progress bar: 20 blocks. Filled = `▰`, empty = `▱`. Calculate: `filled = Math.round((unlocked / total) * 20)`.

#### Mode: unlocked (default)

Show each unlocked achievement:
```
✓ {icon} **{display_name}** ({rarity})
   └─ {description}
💡 {tip}
```

- `display_name`: use `name_cn` if user's language appears to be Chinese, else `name`
- `description`: use `description_cn` for Chinese, else `description`
- `tip`: use `tip_cn` or `tip` (may be absent — omit 💡 line if no tip)
- Sort: by rarity first (mythic → common), then alphabetically

If 0 unlocked: show encouraging message with the 6 onboarding guide items and how to unlock them (use their hints).

#### Mode: locked

Show locked achievements (non-hidden only). Sort: by rarity (common → mythic, easiest first). For achievements with `progress_trackable: true`, show a progress indicator and hint; otherwise just show the description:

```
○ {icon} {display_name} ({rarity})
   └─ {description}
💡 {hint}  (use hint or hint_cn based on language; omit if no hint)
📊 Progress-tracked  ← only if progress_trackable: true
```

If all unlocked: "🎉 All achievements unlocked! You're a legend."

#### Mode: all

Group by category. For each category:
```
**{category_display_name}** ({category_unlocked}/{category_total})

✓ {icon} **{name}** ({rarity}) — {desc}     ← unlocked
○ {icon} {name} ({rarity}) — {desc}          ← locked
```

#### Mode: stats

Show:
```
🏆 Achievement Stats
━━━━━━━━━━━━━━━━━━━━
⭐ XP: {xp} (Level {level})
📊 Progress: {unlocked}/{total} ({pct}%)
🎯 Next level: {xp_needed} XP
🔥 Streak: {streak_current} days (best: {streak_longest})  ×{streak_multiplier}

Rarity Distribution:
▰ Common:     {common_unlocked}/{common_total}
▰ Uncommon:   {uncommon_unlocked}/{uncommon_total}
▰ Rare:       {rare_unlocked}/{rare_total}
▰ Epic:       {epic_unlocked}/{epic_total}
▰ Legendary:  {legendary_unlocked}/{legendary_total}
▰ Mythic:     {mythic_unlocked}/{mythic_total}

Top Sets:
{set_name}: {set_unlocked}/{set_total}
```

XP and level: from state.json `stats` object. Unlock XP by rarity: Common=50, Uncommon=100, Rare=200, Epic=300, Legendary=500, Mythic=1000. Task XP: 25 each. Level = floor(sqrt(totalXp / 100)). Streak multiplier: 1.0 + (streakDays - 1) × 0.1, cap 2.0×.

Streak data: count consecutive days with `session.start` from event.log (filter event_type === 'session.start' in event.log lines). Each unique date = 1 day. Current streak = consecutive days ending today/yesterday. Longest = max consecutive run in history.

#### Mode: recent

Show last 5 unlocked achievements sorted by unlock date (newest first):
```
✓ {icon} **{name}** ({rarity}) — unlocked {relative_time}
   └─ {description}
```

#### Rarity colors in output

Use subtle visual cues: common=⚪, uncommon=🔵, rare=🟡, epic=🟠, legendary=🟣, mythic=🔴 as rarity icons.

### Step 5: If achievements.json is missing

Tell the user: "Run this from the AGPA project root to compile achievement metadata:"

```bash
npx tsx scripts/compile-achievements.ts
```

### IMPORTANT

- Output directly in your response text. Do NOT use Bash to format or echo.
- Use Read tool for JSON files (not Bash cat/grep).
- Do NOT expose exact condition values (like "window: 24h" or "value: 5") in hints.
- If the user's first message was in Chinese, default to `_cn` variants of all text.
