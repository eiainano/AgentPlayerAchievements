# AGPA CLI ASCII Banner — Design Spec

2026-06-09 | Status: Approved

## Goal

Add a prominent terminal ASCII art banner to the AGPA CLI, replacing the current hand-written small 6-line "agpa" art in TUI mode. The banner should use doom/block-style pixel font, render "AGPA" in Unicode block elements with a gold gradient, and adapt to terminal width.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Font style | Doom/block pixel art | Matches game-achievement theme; bold terminal presence |
| Text content | "AGPA" in block art + full name subtitle | Full name "AgentPlayerAchievements" (25 chars) is too wide for pixel rendering |
| Color | Gold gradient (top bright → bottom dark) | Consistent with existing AGPA gold brand (`\x1b[38;2;255;200;0m`) |
| Width adaptation | 3-tier: standard (≥80), compact (60–79), text-only (<60) | Covers all common terminal sizes |
| Dependency | Zero (hand-written string constants) | Project constraint: no new npm dependencies |

## Appearance Targets

### Where

| Trigger | Behavior |
|---------|----------|
| `agpa` (no args, TUI) | Replace existing 6-line hand-written art at `index.ts:233-238` |
| `agpa --help` / `agpa -h` | Display standard banner above command list |
| `agpa --version` | Unchanged (just print version number) |

### Standard Banner (≥80 cols)

AGPA in 5-line Unicode block-art (█▀▄ ▌▐), ~40 columns wide, gold gradient:

```
(simplified structure — actual art in code)
███╗   ███╗ ██████╗ ██████╗  █████╗
████╗ ████║██╔════╝██╔═══██╗██╔══██╗
██╔████╔██║██║  ███╗██████╔╝███████║
██║╚██╔╝██║██║   ██║██╔═══╝ ██╔══██║
██║ ╚═╝ ██║╚██████╔╝██║     ██║  ██║

  Agent Player Achievements  v0.1.x
```

Each row gets progressively darker gold via true-color ANSI codes:
- Row 1: `\x1b[38;2;255;215;0m` (bright gold)
- Row 2: `\x1b[38;2;238;180;0m`
- Row 3: `\x1b[38;2;218;165;0m`
- Row 4: `\x1b[38;2;198;150;0m`
- Row 5: `\x1b[38;2;184;134;11m` (dark gold)

Subtitle line: `\x1b[2m` (dim) + `\x1b[3m` (italic, if supported).

### Compact Banner (60–79 cols)

Uses ▀/▄/▌ half-height blocks to compress to 3 lines with similar visual density.

### Text-Only Fallback (<60 cols)

Plain text: `🏆 AGPA — Agent Player Achievements  v0.1.x`

## Implementation Plan

### Single file: `src/cli/index.ts`

Add `renderBanner(width: number): string` function that:

1. Takes `process.stdout.columns || 80`
2. Returns the appropriate banner string (already colorized)
3. Three private constants: `BANNER_STANDARD`, `BANNER_COMPACT`, `BANNER_FALLBACK`

Integration points:

1. **TUI mode** (`showTui()`, line 232–238): Replace the 6-line hand-written art with `renderBanner()`
2. **Help mode** (`printHelp()`, line 84): Insert `renderBanner()` before the existing `console.log('🏆 AGPA — Agent Player Achievements')`

### Unicode Block Elements Reference

Characters used for pixel art construction:

| Char | Unicode | Visual |
|------|---------|--------|
| `█` | U+2588 | Full block |
| `▀` | U+2580 | Upper half block |
| `▄` | U+2584 | Lower half block |
| `▌` | U+258C | Left half block |
| `▐` | U+2590 | Right half block |
| `░` | U+2591 | Light shade |
| `▒` | U+2592 | Medium shade |
| `▓` | U+2593 | Dark shade |

These are standard in all modern terminals (Unicode 1.1, 1993). No CJK terminal concerns — these are single-width characters.

## Scope Boundaries

**In scope:**
- TUI banner (`agpa` with no args)
- `--help` banner
- 3-tier width adaptation

**Out of scope:**
- `agpa --version` (stays as-is)
- `agpa init` welcome banner (stays as emoji header)
- Sound effects or animation
- Custom font selection / configurable banner
- Other CLI commands' output

## Test Plan

1. Manual: run `agpa` in 120, 80, 70, 50 col terminals → verify correct tier
2. Manual: run `agpa --help` at 80 cols → verify banner appears above command list
3. Manual: pipe to file (`agpa --help > out.txt`) → verify no ANSI codes corrupt the output
4. Automated: unit test for `renderBanner()` returning string of expected tier for each width bucket

## Spec Self-Review

- No TBD/TODO/placeholders — all concrete
- Internal consistency: color gradient, width tiers, integration points all cross-referenced
- Scoped to 2 integration points + 1 function + 3 constants — single file, ~60 lines of code
- No ambiguous requirements — width thresholds, colors, characters all specified explicitly
