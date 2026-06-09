# AGPA CLI ASCII Banner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6-line handwritten "agpa" ASCII art in TUI/help with a bold doom-style Unicode block-art "AGPA" banner featuring gold gradient and 3-tier terminal width adaptation.

**Architecture:** Single function `renderBanner(width)` in `src/cli/index.ts` returns a pre-built colorized banner string. Three private string constants (`BANNER_STANDARD`, `BANNER_COMPACT`, `BANNER_TEXT`) hold the art for each width tier. Two call sites (TUI `showTui()` and `printHelp()`) replace existing art with `console.log(renderBanner(width))`. Zero dependencies — pure TypeScript string constants.

**Tech Stack:** TypeScript (ESM), Node.js ≥18, Unicode block elements (U+2580–U+2593), ANSI true-color escape codes

---

## File Structure

| File | Role |
|------|------|
| `src/cli/index.ts` | All banner code: `renderBanner()`, 3 banner constants, 2 integration points |
| `tests/cli/index.test.ts` | Unit tests for `renderBanner()` width tier selection + ANSI code validation |

No new files. No npm dependencies.

---

## Banner Art Design

### Standard Banner (≥80 cols)

AGPA in 7×5 pixel grid per letter, rendered with `█` (U+2588) for solid and space for background. 4 letters + 1-column gap = 31 columns total. Gold gradient per row.

```
Row 1 (bright gold):  █████  █████  ██████   █████
Row 2:               ██   ██ ██     ██   ██ ██   ██
Row 3:               ███████ ██ ███ ██████  ███████
Row 4:               ██   ██ ██   ██ ██      ██   ██
Row 5 (dark gold):   ██   ██  ████  ██      ██   ██
```

Each row is a self-contained colorized string using true-color ANSI:
- Row 1: `\x1b[38;2;255;215;0m` (#FFD700, bright gold)
- Row 2: `\x1b[38;2;238;180;0m` (#EEB400)
- Row 3: `\x1b[38;2;218;165;0m` (#DAA500)
- Row 4: `\x1b[38;2;198;150;0m` (#C69600)
- Row 5: `\x1b[38;2;184;134;11m` (#B8860B, dark gold)

Subtitle line (after 5 art rows): `\x1b[2m\x1b[3m  Agent Player Achievements  v0.1.x\x1b[0m`

### Compact Banner (60–79 cols)

Uses `▀` (U+2580, upper half block) and `▄` (U+2584, lower half block) to pack two pixel rows into one terminal line, compressing to 3 lines. Gold gradient per line.

```
Row 1 (bright gold):  ▀▀█▀▀  ▀▀█▀▀  ▀▀█▀▀▀  ▀▀█▀▀
Row 2:                 ████  ██ ██  ████   █████
Row 3 (dark gold):    ██  ██  ▀▀▀▀  ██     ██  ██
```

Subtitle line: `\x1b[2m  Agent Player Achievements  v0.1.x\x1b[0m`

### Text-Only Fallback (<60 cols)

Plain emoji text — no block art: `\x1b[38;2;255;215;0m\x1b[1m🏆 AGPA — Agent Player Achievements\x1b[0m  \x1b[2mv0.1.x\x1b[0m`

---

### Task 1: Add `renderBanner()` function and banner constants

**Files:**
- Modify: `src/cli/index.ts` (insert new function after `printVersion()` at line 127)

- [ ] **Step 1: Add the three banner constants and `renderBanner()` function**

Insert the following code block after `printVersion()` (after line 127, before `// ── Dispatch` comment at line 129):

```typescript
// ── Banner (doom-style block-art "AGPA" with gold gradient) ────────────────

const GOLD_COLORS = [
  '\x1b[38;2;255;215;0m', // Row 0: bright gold #FFD700
  '\x1b[38;2;238;180;0m', // Row 1: #EEB400
  '\x1b[38;2;218;165;0m', // Row 2: #DAA500
  '\x1b[38;2;198;150;0m', // Row 3: #C69600
  '\x1b[38;2;184;134;11m', // Row 4: dark gold #B8860B
] as const;

const GOLD_RESET = '\x1b[0m';

const BANNER_STANDARD = GOLD_COLORS.map((c, i) => {
  const rows = [
    '  █████  █████  ██████   █████',
    '  ██   ██ ██     ██   ██ ██   ██',
    '  ███████ ██ ███ ██████  ███████',
    '  ██   ██ ██   ██ ██      ██   ██',
    '  ██   ██  ████  ██      ██   ██',
  ];
  return `${c}${rows[i]}${GOLD_RESET}`;
}).join('\n');

const BANNER_COMPACT = [
  `\x1b[38;2;255;215;0m  ▀▀█▀▀  ▀▀█▀▀  ▀▀█▀▀▀  ▀▀█▀▀${GOLD_RESET}`,
  `\x1b[38;2;218;165;0m  ▀▀▀▀▀  ██ ██  ▀▀▀▀▀  ▀▀▀▀▀${GOLD_RESET}`,
  `\x1b[38;2;184;134;11m  ██  ██  ▀▀▀▀  ██      ██  ██${GOLD_RESET}`,
].join('\n');

const BANNER_TEXT = `\x1b[38;2;255;215;0m\x1b[1m🏆 AGPA — Agent Player Achievements\x1b[0m`;

function renderBanner(width: number, version: string): string {
  const subtitle = `\x1b[2m\x1b[3m  Agent Player Achievements  v${version}\x1b[0m`;

  if (width >= 80) {
    return `\n${BANNER_STANDARD}\n\n${subtitle}\n`;
  }
  if (width >= 60) {
    return `\n${BANNER_COMPACT}\n\n${subtitle}\n`;
  }
  return `\n${BANNER_TEXT}  \x1b[2mv${version}\x1b[0m\n`;
}
```

- [ ] **Step 2: Run TypeScript compilation check**

```bash
cd /Users/bytedance/SkunkWorks/forClaude/AgentPlayerAchievements && npm run build
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: add renderBanner() with doom-style AGPA block art, gold gradient, 3-tier width adaptation"
```

---

### Task 2: Integrate banner into TUI mode (`showTui()`)

**Files:**
- Modify: `src/cli/index.ts` (lines 232–239 in `showTui()`)

- [ ] **Step 1: Replace the 6-line handwritten ASCII art with `renderBanner()`**

In `showTui()`, replace lines 232–239 (the 6 `process.stdout.write` calls for the old ASCII art) with a single call to `renderBanner()`.

Also replace the standalone subtitle on line 239:
```
  process.stdout.write(`\n  ${D}Achievement tracking for AI coding agents  v${version}${R}\n`);
```

The replacement block:

```typescript
  const columns = process.stdout.columns || 80;
  process.stdout.write(renderBanner(columns, version));
```

**Before** (lines 232–239):
```typescript
  console.clear();
  process.stdout.write(`\n  ${Y}${B}    __ _  __ _ _ __   ___  __ _ _ __   ___    ${R}\n`);
  process.stdout.write(`  ${Y}${B}   / _\` |/ _\` | '_ \\ / _ \\/ _\` | '_ \\ / __|${R}\n`);
  process.stdout.write(`  ${Y}${B}  | (_| | (_| | |_) |  __/ (_| | | | | (__ ${R}\n`);
  process.stdout.write(`  ${Y}${B}   \\__, |\\__, | .__/ \\___|\\__,_|_| |_|\\___|${R}\n`);
  process.stdout.write(`  ${Y}${B}   __/ | __/ | |                           ${R}\n`);
  process.stdout.write(`  ${Y}${B}  |___/ |___/|_|                           ${R}\n`);
  process.stdout.write(`\n  ${D}Achievement tracking for AI coding agents  v${version}${R}\n`);
```

**After:**
```typescript
  console.clear();
  process.stdout.write(renderBanner(process.stdout.columns || 80, version));
```

Note: The ANSI color variables `Y`, `B`, `D` are no longer used after this change but are still referenced by other parts of `showTui()` (the stats line at line 229 and command menu below), so we keep them.

- [ ] **Step 2: Run TypeScript compilation check**

```bash
cd /Users/bytedance/SkunkWorks/forClaude/AgentPlayerAchievements && npm run build
```

Expected: No type errors.

- [ ] **Step 3: Manual visual test — run TUI at different widths**

```bash
# Test at standard width (80 cols)
COLUMNS=80 npx tsx src/cli/index.ts
# Should show 5-row block art with gold gradient

# Test at compact width (70 cols)
COLUMNS=70 npx tsx src/cli/index.ts
# Should show 3-row half-block art

# Test at narrow width (50 cols)
COLUMNS=50 npx tsx src/cli/index.ts
# Should show plain text "🏆 AGPA — Agent Player Achievements"
```

Expected: Each width tier shows the correct banner variant.

- [ ] **Step 4: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: integrate renderBanner() into TUI mode, replacing old 6-line ASCII art"
```

---

### Task 3: Integrate banner into `--help` mode (`printHelp()`)

**Files:**
- Modify: `src/cli/index.ts` (line 84 in `printHelp()`)

- [ ] **Step 1: Add banner before the help text heading**

In `printHelp()`, replace line 84:
```typescript
  console.log('🏆 AGPA — Agent Player Achievements');
```
with:
```typescript
  console.log(renderBanner(process.stdout.columns || 80, getVersion()));

  console.log('Usage: agpa <command> [options]\n');
```

And remove line 85 (the old subtitle line):
```typescript
  console.log('   gamified achievement tracking for AI coding tools\n');
```

The banner already includes the subtitle, so this line is now redundant.

We also need a helper to read the version since `printHelp()` currently reads it inline. Add a small helper above `printBanner` or reuse the version-reading pattern. Since `printHelp()` already reads version at lines 106–112, we can extract that into a small `getVersion()` function to avoid duplication with `showTui()`.

Actually, looking more carefully, `printHelp()` reads the version inline at lines 106-112 and `showTui()` reads it at lines 215-220. To avoid duplication, add a `getVersion()` helper:

```typescript
function getVersion(): string {
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.1.x';
  }
}
```

Insert this right before `renderBanner()`. Then update both `printHelp()` and `showTui()` to use it.

**Full change in `printHelp()`** (lines 81–117):

```typescript
function printHelp(): void {
  const nameWidth = Math.max(...COMMANDS.map(c => c.name.length)) + 2;

  console.log(renderBanner(process.stdout.columns || 80, getVersion()));

  console.log('Usage: agpa <command> [options]\n');

  for (const group of COMMAND_GROUPS) {
    console.log(`  ${group.title}:`);
    for (const name of group.names) {
      const cmd = COMMANDS.find(c => c.name === name);
      if (cmd) {
        const padded = cmd.name.padEnd(nameWidth);
        console.log(`    ${padded}${cmd.description}`);
      }
    }
    console.log('');
  }

  console.log('Options:');
  console.log('  --help, -h     Show this help');
  console.log('  --version, -v  Print version');
  console.log('  (no args)       Interactive TUI mode\n');

  console.log(`Version: ${getVersion()}`);

  console.log('\nGet started:  agpa init');
  console.log('Quick check:  agpa verify (alias for doctor --quick)');
  console.log('Diagnose:     agpa doctor (full system check + suggestions)');
}
```

- [ ] **Step 2: Update `showTui()` to use `getVersion()`**

Replace the inline version reading in `showTui()` (lines 214–220):

**Before:**
```typescript
  // Read version
  let version = '0.1.x';
  try {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    version = pkg.version;
  } catch { /* ok */ }
```

**After:**
```typescript
  const version = getVersion();
```

- [ ] **Step 3: Run TypeScript compilation check**

```bash
cd /Users/bytedance/SkunkWorks/forClaude/AgentPlayerAchievements && npm run build
```

Expected: No type errors.

- [ ] **Step 4: Manual visual test — run `--help` at different widths**

```bash
# Test at standard width
COLUMNS=80 npx tsx src/cli/index.ts --help

# Test at narrow width
COLUMNS=50 npx tsx src/cli/index.ts --help
```

Expected: Banner displays correctly above the command list.

- [ ] **Step 5: Verify piped output works (no ANSI codes in file)**

```bash
agpa --help > /tmp/agpa-help.txt 2>/dev/null || npx tsx src/cli/index.ts --help > /tmp/agpa-help.txt
cat /tmp/agpa-help.txt
```

Expected: No raw escape codes corrupt the output (banner shows because it uses `console.log` which will write escape codes, but for non-TTY output we should ideally detect that). **Note:** This is a known limitation — ANSI codes will appear in piped output since we always colorize. The existing code already has this behavior (`printHelp()` uses emoji directly). If this matters, we can add a TTY check later.

- [ ] **Step 6: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: integrate renderBanner() into --help, extract getVersion() helper"
```

---

### Task 4: Add unit tests

**Files:**
- Create: `tests/cli/banner.test.ts`

- [ ] **Step 1: Write the test file**

Note: `renderBanner()` is not exported from `index.ts` (it's private to the module). We have two options:
1. Export `renderBanner` for testing (adds a tiny export)
2. Test indirectly via `printHelp()` by capturing stdout

Option 1 is simpler and more targeted. We'll add a test-only export.

First, export `renderBanner` from `index.ts`. Add this line right after the function definition:

```typescript
// Exported for testing
export { renderBanner, getVersion };
```

Then create `tests/cli/banner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderBanner, getVersion } from '../../src/cli/index.js';

describe('renderBanner', () => {
  it('returns standard banner (5 art rows) when width >= 80', () => {
    const result = renderBanner(80, '0.1.0');
    // Standard banner has 5 gold rows matching █ block pattern
    expect(result).toContain('\x1b[38;2;255;215;0m');
    expect(result).toContain('█████');
    // Should have 5 gold color codes (one per row)
    const goldCount = (result.match(/\x1b\[38;2;255;215;0m/g) || []).length;
    expect(goldCount).toBe(1);
    expect(result).toContain('Agent Player Achievements');
    expect(result).toContain('v0.1.0');
  });

  it('returns compact banner (3 art rows) when width 60-79', () => {
    const result = renderBanner(70, '0.1.0');
    expect(result).toContain('▀▀█▀▀');
    expect(result).toContain('Agent Player Achievements');
    // Compact banner has 3 lines (not 5)
    const artLines = result.split('\n').filter(l => l.includes('▀') || l.includes('▄') || l.includes('█'));
    expect(artLines.length).toBeLessThanOrEqual(3);
  });

  it('returns text-only fallback when width < 60', () => {
    const result = renderBanner(50, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).toContain('AGPA');
    expect(result).not.toContain('████');
    expect(result).not.toContain('▀▀█');
  });

  it('includes version in subtitle', () => {
    const result = renderBanner(80, '9.9.9');
    expect(result).toContain('v9.9.9');
  });

  it('returns standard at exactly 80', () => {
    const result = renderBanner(80, '0.1.0');
    expect(result).toContain('█████');
  });

  it('returns compact at exactly 79', () => {
    const result = renderBanner(79, '0.1.0');
    expect(result).toContain('▀▀█▀▀');
  });

  it('returns compact at exactly 60', () => {
    const result = renderBanner(60, '0.1.0');
    expect(result).toContain('▀▀█▀▀');
  });

  it('returns text-only at exactly 59', () => {
    const result = renderBanner(59, '0.1.0');
    expect(result).toContain('🏆');
    expect(result).not.toContain('████');
  });
});

describe('getVersion', () => {
  it('returns a non-empty string', () => {
    const v = getVersion();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it('matches semver or fallback pattern', () => {
    const v = getVersion();
    expect(v).toMatch(/^(\d+\.\d+\.\d+|0\.1\.x)$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/bytedance/SkunkWorks/forClaude/AgentPlayerAchievements && npx vitest run tests/cli/banner.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 3: Run full test suite to verify no regressions**

```bash
cd /Users/bytedance/SkunkWorks/forClaude/AgentPlayerAchievements && npm run test
```

Expected: All tests pass (should be ~990 tests).

- [ ] **Step 4: Commit**

```bash
git add tests/cli/banner.test.ts src/cli/index.ts
git commit -m "test: add renderBanner() unit tests for 3-tier width adaptation"
```

---

### Task 5: Docs audit — sync stale counts

**Files:**
- Modify: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/issues-todo.md`

- [ ] **Step 1: Check if banner feature requires doc updates**

Per CLAUDE.md: "每次代码变更后（尤其是改动成就数量、condition type数量、事件映射、架构设计），运行'文档核查'"

The banner feature doesn't change achievement counts, condition types, or architecture — it's purely a cosmetic CLI enhancement. No doc audit needed for this change.

- [ ] **Step 2: Update CHANGELOG.md**

Per CLAUDE.md: "After each commit + push, update `CHANGELOG.md`"

Add entry under latest version:

```markdown
- **终端 ASCII Banner**：`agpa` TUI 和 `--help` 新增 doom 风格 Unicode block-art "AGPA" 大字，5 行金色渐变，3 级终端宽度自适应（标准 ≥80、紧凑 60–79、纯文本 <60），零依赖纯字符串常量
```

This will be done after push.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG — terminal ASCII banner"
```

---

## Self-Review

### 1. Spec coverage check

| Spec requirement | Covered by |
|-----------------|------------|
| Doom-style block art "AGPA" 5 rows | Task 1 — `BANNER_STANDARD` constant |
| Gold gradient (bright→dark) | Task 1 — `GOLD_COLORS` array, 5 hex values |
| 3-tier width: ≥80 standard, 60-79 compact, <60 text | Task 1 — `renderBanner()` if-else; Task 4 — boundary tests |
| TUI integration (replace lines 232-238) | Task 2 |
| `--help` integration | Task 3 |
| Zero dependencies | Task 1 — string constants, no imports |
| Unicode block elements | Task 1 — U+2580 (▀), U+2584 (▄), U+2588 (█) |

### 2. Placeholder scan
No TBD, TODO, or vague instructions. All code blocks are complete.

### 3. Type consistency
- `renderBanner(width: number, version: string): string` — consistent across all tasks
- `getVersion(): string` — defined in Task 3, used in Task 2 and Task 3
- Export `{ renderBanner, getVersion }` added in Task 4 — consistent with Task 1/3 definitions
