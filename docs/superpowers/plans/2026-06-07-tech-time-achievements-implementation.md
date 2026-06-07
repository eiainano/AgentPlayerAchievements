# Tech + Time Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add 12 new achievements (7 language depth + 2 language breadth + 1 test milestone + 2 time/session) and supporting infrastructure to AGPA.

**Architecture:** New `src/utils/lang-detect.ts` module provides file-extension→language mapping. `hook.ts` calls it on file Read/Write/Edit to auto-emit `file.language_used`. `evaluator.ts` adds `language` to `matchFilter` context. All events get `hour`/`day_of_week` injected into base payload. YAML adds 12 definitions + `linguist` set.

**Tech Stack:** TypeScript, Vitest, YAML

---

### Task 1: Create `src/utils/lang-detect.ts`

**Files:**
- Create: `src/utils/lang-detect.ts`
- Test: `tests/utils/lang-detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/lang-detect.test.ts
import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/utils/lang-detect.js';

describe('detectLanguage', () => {
  it('returns "python" for .py files', () => {
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('/abs/path/main.py')).toBe('python');
  });
  it('returns "typescript" for .ts/.tsx', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
    expect(detectLanguage('/src/components/Button.tsx')).toBe('typescript');
  });
  it('returns "javascript" for .js/.jsx/.mjs', () => {
    expect(detectLanguage('index.js')).toBe('javascript');
    expect(detectLanguage('App.jsx')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
  });
  it('returns "java" for .java', () => {
    expect(detectLanguage('Main.java')).toBe('java');
  });
  it('returns "cpp" for .cpp/.cc/.cxx/.hpp', () => {
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('util.cc')).toBe('cpp');
    expect(detectLanguage('util.cxx')).toBe('cpp');
    expect(detectLanguage('util.hpp')).toBe('cpp');
  });
  it('returns "c" for .c/.h', () => {
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('header.h')).toBe('c');
  });
  it('returns "rust" for .rs', () => {
    expect(detectLanguage('lib.rs')).toBe('rust');
  });
  it('returns "go" for .go', () => {
    expect(detectLanguage('main.go')).toBe('go');
  });
  it('returns null for unknown extensions', () => {
    expect(detectLanguage('notes.txt')).toBeNull();
    expect(detectLanguage('Makefile')).toBeNull();
    expect(detectLanguage('noext')).toBeNull();
  });
  it('returns null for empty path', () => {
    expect(detectLanguage('')).toBeNull();
  });
  it('handles Dockerfile naming', () => {
    expect(detectLanguage('Dockerfile')).toBe('dockerfile');
    expect(detectLanguage('dockerfile.prod')).toBeNull(); // dot in name, not extension
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/lang-detect.test.ts --reporter=verbose 2>&1 | head -5`
Expected: ERROR, module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/lang-detect.ts

const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  scala: 'scala',
  r: 'r',
  lua: 'lua',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  cljs: 'clojure',
  zig: 'zig',
  sol: 'solidity',
  dart: 'dart',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  toml: 'toml',
};

/**
 * Detect programming language from a file path based on its extension.
 * Returns null if the extension is not in the known map.
 */
export function detectLanguage(filePath: string): string | null {
  if (!filePath || filePath.trim() === '') return null;

  // Special case: Dockerfile (no extension)
  const basename = filePath.split('/').pop() || filePath;
  if (basename === 'Dockerfile' || basename === 'dockerfile') return 'dockerfile';

  // Extract extension (the part after the last dot)
  const dotIdx = basename.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const ext = basename.slice(dotIdx + 1).toLowerCase();
  if (!ext) return null;

  return EXTENSION_MAP[ext] ?? null;
}

/**
 * The full list of known language names (for documentation/testing).
 */
export const KNOWN_LANGUAGES: string[] = [...new Set(Object.values(EXTENSION_MAP))].sort();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/lang-detect.test.ts --reporter=verbose`
Expected: 11 tests all PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/lang-detect.ts tests/utils/lang-detect.test.ts
git commit -m "feat: add detectLanguage() — file extension to programming language mapper

Supports 35+ language mappings. Used by hook.ts to auto-emit file.language_used events.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add `hour`/`day_of_week` to base payload in hook.ts

**Files:**
- Modify: `src/cli/hook.ts:97-101`

- [ ] **Step 1: Modify base payload construction**

In hook.ts, right after the existing base object construction (line 101 `if (data.source) base.source = data.source;`), add:

```ts
const now = new Date();
base.hour = now.getHours();
base.day_of_week = now.getDay();
```

This replaces the per-event `hour`/`day_of_week` injection that currently only exists for `git.push` (line 178). Remove the duplicate `const now = new Date(); ...` from the `git.push` block since `now` is already defined above.

Change lines 176-179 from:
```ts
if (ti.command.includes('git push')) {
  const now = new Date();
  results.push({ event_type: 'git.push', payload: { ...base, day_of_week: now.getDay(), hour: now.getHours() } });
}
```

To:
```ts
if (ti.command.includes('git push')) {
  results.push({ event_type: 'git.push', payload: { ...base } });
}
```

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `npm run test 2>&1 | tail -5`
Expected: 514+ tests PASS (or whatever the current count is; should not decrease)

- [ ] **Step 3: Commit**

```bash
git add src/cli/hook.ts
git commit -m "feat: inject hour/day_of_week into all event payloads

Moves hour/day_of_week from git.push-specific to base payload, so
all hook-emitted events carry timestamp context. Enables time-based
achievements via distinct_count session.start field: hour.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Add `language` auto-emission and `matchFilter` context

**Files:**
- Modify: `src/cli/hook.ts`
- Modify: `src/engine/evaluator.ts`

- [ ] **Step 1: Add `language` to `matchFilter` context in evaluator.ts**

After line 36 (`has_question_mark: ...`), add:
```ts
language: event.payload?.language || '',
```

- [ ] **Step 2: Import `detectLanguage` and add auto-emission in hook.ts mapEvents()**

At the top of hook.ts, add the import after existing imports (around line 53):
```ts
import { detectLanguage } from '../utils/lang-detect.js';
```

In the `mapEvents()` function, in each of the three file-tool branches (`Read`, `Write`, `Edit`), add language detection and emission:

**PostToolUse → Read** (after line 132 `results.push({ event_type: 'image.upload', ... })` — but only for non-image files):
```ts
// Emit file.language_used for code files
const lang = detectLanguage(ti.file_path as string || '');
if (lang) {
  results.push({ event_type: 'file.language_used', payload: { ...base, language: lang } });
}
```

**PostToolUse → Write** (after line 136 `results.push({ event_type: 'file.write', ... })`):
```ts
const writeLang = detectLanguage(ti.file_path as string || '');
if (writeLang) {
  results.push({ event_type: 'file.language_used', payload: { ...base, language: writeLang } });
}
```

**PostToolUse → Edit** (after line 157 `results.push({ event_type: 'file.edit', ... })`):
```ts
const editLang = detectLanguage(ti.file_path as string || '');
if (editLang) {
  results.push({ event_type: 'file.language_used', payload: { ...base, language: editLang } });
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `npm run test 2>&1 | tail -5`
Expected: All tests pass (545+)

- [ ] **Step 4: Commit**

```bash
git add src/cli/hook.ts src/engine/evaluator.ts
git commit -m "feat: auto-emit file.language_used from hook.ts + matchFilter language field

detectLanguage() called on file_path in Read/Write/Edit tool handlers.
matchFilter ctx now includes 'language' for filter expressions like
filter: language == 'python'.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add 12 achievements to YAML + `linguist` set

**Files:**
- Modify: `04-成就定义清单.yaml`

- [ ] **Step 1: Insert 12 new achievement definitions before the `sets:` section**

Find the last definition (end around line 3023) and insert before `sets:` (line 3024).

The 12 entries to add (in this order: 7 language depth, 2 language breadth, 1 test, 2 time):

```yaml
  - id: pythonista
    name: Pythonista
    name_cn: Pythonista
    description: Write 50+ Python files. Snake? No, Python.
    description_cn: 写了 50+ 个 Python 文件。是蟒蛇不是巨蟒。
    icon: 🐍
    category: tool_mastery
    rarity: common
    hidden: false
    hint: Work with Python files regularly
    hint_cn: 经常使用 Python 写代码
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language == 'python'
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: type_astronaut
    name: Type Astronaut
    name_cn: 类型宇航员
    description: Write 50+ TypeScript files. Types are rocket fuel.
    description_cn: 写了 50+ 个 TypeScript 文件。类型就是火箭燃料。
    icon: 📘
    category: tool_mastery
    rarity: common
    hidden: false
    hint: Work with TypeScript regularly — types pay off in the long run
    hint_cn: 经常使用 TypeScript——类型系统长期来看是值得的
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language == 'typescript'
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: web_weaver
    name: Web Weaver
    name_cn: 网络织者
    description: Write 50+ JavaScript files. Weaving the web since '95.
    description_cn: 写了 50+ 个 JavaScript 文件。95 年就开始织网。
    icon: 🕸️
    category: tool_mastery
    rarity: common
    hidden: false
    hint: Work with JavaScript files regularly
    hint_cn: 经常使用 JavaScript 写代码
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language == 'javascript'
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: bean_counter
    name: Bean Counter
    name_cn: 咖啡豆计数员
    description: Write 50+ Java files. Object my my my.
    description_cn: 写了 50+ 个 Java 文件。对象啊对象。
    icon: ☕
    category: tool_mastery
    rarity: uncommon
    hidden: false
    hint: Work with Java files
    hint_cn: 经常使用 Java 写代码
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language == 'java'
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: pointer_pilot
    name: Pointer Pilot
    name_cn: 指针领航员
    description: Write 50+ C or C++ files. Manual memory? manual fun.
    description_cn: 写了 50+ 个 C 或 C++ 文件。手动内存，手动乐趣。
    icon: 🔗
    category: tool_mastery
    rarity: rare
    hidden: false
    hint: Work with C or C++ files
    hint_cn: 经常使用 C 或 C++ 写代码
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language in ['c', 'cpp']
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: ferris_fan
    name: Ferris Fan
    name_cn: 螃蟹粉丝
    description: Write 50+ Rust files. The borrow checker approves.
    description_cn: 写了 50+ 个 Rust 文件。借用检查器表示通过。
    icon: 🦀
    category: tool_mastery
    rarity: rare
    hidden: false
    hint: Work with Rust files — fearless concurrency awaits
    hint_cn: 经常使用 Rust——无畏并发在等你
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language == 'rust'
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: go_getter
    name: Go Getter
    name_cn: 进取者
    description: Write 50+ Go files. Simplicity is a feature.
    description_cn: 写了 50+ 个 Go 文件。简洁就是一种特性。
    icon: 🏃
    category: tool_mastery
    rarity: uncommon
    hidden: false
    hint: Work with Go files regularly
    hint_cn: 经常使用 Go 写代码
    progress_trackable: true
    conditions:
      - type: threshold
        event: file.language_used
        filter: language == 'go'
        field: language
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: smorgasbord
    name: Smorgasbord
    name_cn: 丰盛大餐
    description: Use 6+ languages in one session. All-you-can-code buffet.
    description_cn: 单次 session 用 6+ 种语言。编码自助餐。
    icon: 🧩
    category: challenge
    rarity: rare
    hidden: false
    hint: Switch between many programming languages in a single session
    hint_cn: 单次 session 中使用多种编程语言
    challenge: true
    conditions:
      - type: distinct_count
        event: file.language_used
        field: language
        window: single_session
        operator: ">="
        value: 6
    set: linguist
  - id: full_spectrum
    name: Full Spectrum
    name_cn: 全光谱
    description: Use 10+ languages cumulatively. True polyglot, no impostor.
    description_cn: 累计使用过 10+ 种语言。真多语言者。
    icon: 🌈
    category: milestones
    rarity: epic
    hidden: false
    progress_trackable: true
    conditions:
      - type: distinct_count
        event: file.language_used
        field: language
        window: all
        operator: ">="
        value: 10
    set: linguist
  - id: test_champion
    name: Test Champion
    name_cn: 测试冠军
    description: 500 tests passed. The CI pipeline worships you.
    description_cn: 累计 500 个测试通过。CI 流程视你为神。
    icon: 🏆
    category: milestones
    rarity: epic
    hidden: false
    hint: Keep writing tests — green is the best color
    hint_cn: 持续写测试——绿色是最好的颜色
    progress_trackable: true
    conditions:
      - type: counter
        event: test.pass
        operator: ">="
        value: 500
        window: all
    set: endurance
  - id: the_scheduler
    name: The Scheduler
    name_cn: 日程规划师
    description: Start sessions at 12+ different hours. You're always there.
    description_cn: 在 12+ 个不同时间段启动过 session。你无处不在。
    icon: 📅
    category: style
    rarity: uncommon
    hidden: false
    hint: Code at different times of day — see how the world changes
    hint_cn: 在不同时间编码——看看世界如何变化
    progress_trackable: true
    conditions:
      - type: distinct_count
        event: session.start
        field: hour
        window: all
        operator: ">="
        value: 12
  - id: power_session
    name: Power Session
    name_cn: 全力冲刺
    description: 25+ tools in a single session. Full throttle.
    description_cn: 单次 session 中发起 25+ 次工具调用。马力全开。
    icon: ⚡
    category: endurance
    rarity: uncommon
    hidden: false
    hint: A focused session with high tool throughput — go deep
    hint_cn: 一次高工具吞吐量的专注 session——深度工作
    progress_trackable: true
    conditions:
      - type: counter
        event: tool.complete
        window: single_session
        operator: ">="
        value: 25
    set: endurance
```

- [ ] **Step 2: Add `linguist` set to `sets:` section and expand `endurance`**

Find the `endurance:` set entry (around line 3086) and update it from 5 to 7 members, adding `test_champion` and `power_session`:

```yaml
  endurance:
    name: Endurance
    name_cn: 持之以恒
    achievements:
      - streak_3
      - streak_7
      - streak_30
      - streak_100
      - marathon
      - test_champion
      - power_session
    reward:
      type: badge
      value: streak_master
```

Then add the `linguist` set after `endurance` (or anywhere in the sets section):

```yaml
  linguist:
    name: Linguist
    name_cn: 语言学者
    achievements:
      - pythonista
      - type_astronaut
      - web_weaver
      - bean_counter
      - pointer_pilot
      - ferris_fan
      - go_getter
      - smorgasbord
      - full_spectrum
    reward:
      type: title
      value: Polyglot
```

- [ ] **Step 3: Verify YAML is valid**

Run: `npx tsx src/cli/verify.ts 2>&1`
Expected: no errors (all 183 definitions parse correctly)

- [ ] **Step 4: Commit**

```bash
git add 04-成就定义清单.yaml
git commit -m "feat: add 12 achievements + linguist set

New achievements: pythonista, type_astronaut, web_weaver, bean_counter,
pointer_pilot, ferris_fan, go_getter (language depth), smorgasbord,
full_spectrum (language breadth), test_champion (test milestone),
the_scheduler (time breadth), power_session (tool throughput).

Endurance set: 5→7 (+test_champion, +power_session).
New set: linguist (9 members, reward: Polyglot title).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Add every-achievement test cases for 12 new achievements

**Files:**
- Test: `tests/engine/every-achievement.test.ts`

The data-driven test (`it.each`) automatically picks up all new definitions from the YAML and generates trigger events. **No code change needed** for the test runner itself — it loops `ALL_DEFS` which now includes 183 entries.

However, we need to verify the auto-generated events work for our new condition combinations:

- `threshold` with `filter: language == 'X'` + `field: language` + `>= 50` — genEvents handles `threshold` with `field` by emitting one event with `{ [field]: cond.value }` (=50). The `filter` is parsed by `parseFilter` which extracts `language: 'python'` into payload. But `field: language` is the same as the filter field — `evaluateThreshold` sums `field` values across matching events. Since we emit one event with `payload.language = 50` (the numeric threshold) AND we also pass filter-specified `language: 'python'` — there's a collision: `payload.language` can't be both `'python'` and `50`.

**The fix**: These 7 language depth achievements should use `counter` instead of `threshold` with `filter`. Let me verify...

Actually no - looking more carefully at the condition: `threshold` with `field: language` means "sum the `language` field of all matching events". For the language depth achievements, we want "how many times has `file.language_used` with `language == 'python'` been emitted?" — this is a **counter**, not a threshold.

Wait, let me re-examine. The `file.language_used` event has a `language` field (like 'python', 'typescript'). A `counter` condition counts events of a given type. A `threshold` with `field` sums a numeric field value. So:

- `counter event: file.language_used filter: language == 'python' >= 50` — correct approach! Counts events where filter matches.

Let me correct the YAML definitions to use `counter` instead of `threshold`.

Check: the existing `test_centurion` uses `counter event: test.pass >= 100`. This is the right pattern.

Re-check whether `distinct_count` for `the_scheduler` with `field: hour` will work as intended:
- `distinct_count event: session.start field: hour >= 12` — counts distinct `hour` values across all `session.start` events. `hour` is in payload (added in Task 2). `getField()` reads `event.payload?.[field] ?? event[field]`. Yes, payload.hour works.

- `multi_image_day` already uses `threshold event: image.read field: amount >= 5 window: 24h` — that's a different pattern (summing a numeric field `amount`). Counter would be: `counter event: image.read >= 5 window: 24h`.

So the 7 language depth achievements should use `counter`, not `threshold`. Let me plan for that.

For `pointer_pilot` with `filter: language in ['c', 'cpp']`, the test genEvents will call `parseFilter` which extracts `language` into payload requirements. The `distinct_count` test genEvents for `genEvents` handles this by including the parsed filter payload in each event.

Wait, but `genEvents` for `counter` type also handles `parseFilter` — yes, it does: `const payload = { ...fr.payload };` at the top.

OK so the correct pattern for language depth:
```yaml
conditions:
  - type: counter
    event: file.language_used
    filter: language == 'python'
    operator: ">="
    value: 50
    window: all
```

genEvents will:
1. `parseFilter('language == \'python\'')` → `{ payload: { language: 'python' } }`
2. Generate 51 events (value 50 + 1 buffer for `>=`)
3. Each event: `evt('file.language_used', { language: 'python' })`

This correctly triggers `evaluateCounter` which counts events of type `file.language_used` with matching filter `language == 'python'`.

Good — let me correct the YAML accordingly. The plan above had `threshold` which was wrong.

Let me also recheck: for `pointer_pilot` filter `language in ['c', 'cpp']` — parseFilter handles `in` operator:

Looking at evalFilter:
```
if (m) return globMatch(m[2]!, String(ctxValue(ctx, m[1]!)));   // glob/regex
```

Wait, `in` isn't directly handled for non-numeric contexts. Let me check how existing achievements use `in` with string values...

Looking at the YAML, I see `filter: language in ['c', 'cpp']` — but does the filter parser actually handle `in` for strings?

Let me look at evalPredicate more carefully. The in operator for numbers uses `<` comparisons. For strings, `in` isn't explicitly handled...

Actually, looking at `evalPredicate`:
```
// in [a, b, c] — value check
if (m) ... // glob match
```

Hmm, the `in` operator for strings that I need would be something like `language == 'c' || language == 'cpp'`. Let me check if the filter supports `||`...

Yes! Looking at `evalFilter`:
```
const orParts = expr.split('||').map(s => s.trim());
if (orParts.length > 1) return orParts.some(p => evalFilter(p, ctx));
```

So `language == 'c' || language == 'cpp'` would work! Let me use that instead.

Wait, but `pointer_pilot` has filter `language in ['c', 'cpp']`. Does `evalPredicate` handle `in` with strings?

Looking at evalPredicate again:
```
const m1 = /^(\w+)\s+in\s+\[(.+)\]$/.exec(expr);
if (m1) {
  const field = ctxValue(ctx, m1[1]!);
  const items = m1[2]!.split(',').map(s => s.trim().replace(/^'/, '').replace(/'$/, ''));
  if (typeof field === 'number') {
    return items.some(item => {
      const num = Number(item);
      return !isNaN(num) && field >= num;
    });
  }
  return items.includes(String(field));
}
```

Yes! For string `field`, it returns `items.includes(String(field))`. So `language in ['c', 'cpp']` works correctly — checks if the language field matches either 'c' or 'cpp'. Perfect.

Now for the genEvents parseFilter — let me check if `in` is handled there:

```
const m = /^(\w+)\s+in\s+\[(.+)\]$/.exec(filter);
if (m) {
  const field = m[1]!;
  const items = m[2]!.split(',').map(s => s.trim().replace(/^'/, '').replace(/'$/, ''));
  // Use first item as payload value (sufficient to trigger the condition)
  if (items.length > 0) {
    req.payload[field] = items[0]!;
  }
}
```

Yes, it extracts the first value from the list. So `filter: language in ['c', 'cpp']` → `payload: { language: 'c' }`. The generated events will have `language: 'c'`, and the evaluator's `matchFilter` will match it against `language in ['c', 'cpp']` correctly (since `'c'` is in the list). Good.

OK so the 7 language depth achievements should use:
```yaml
conditions:
  - type: counter
    event: file.language_used
    filter: language == 'python'
    operator: ">="
    value: 50
    window: all
```

And for pointer_pilot:
```yaml
conditions:
  - type: counter
    event: file.language_used
    filter: language in ['c', 'cpp']
    operator: ">="
    value: 50
    window: all
```

This is the correct approach. The plan needs to be updated.

For the `power_session` - `counter tool.complete >= 25 single_session` - genEvents:
1. Generates 26 events (target = value+1 for `>=`)
2. wrapForWindows detects `single_session` → wraps with session.start at start, no trailing needed since hasTask is false but hasSession is true. Wait, looking at wrapForWindows:
```
if (hasSession && !hasTask) {
  result.push(evt('session.end', {}));
}
```
So it wraps with session.start + events + session.end. But wait — the events generated by genEvents already have session_id: 'test-session', and wrapForWindows adds `evt('session.start', {})` which does NOT specify a timestamp. The original events will have `new Date()` timestamps and session_id 'test-session'. The wrapping session.start will have the same timestamp (also `new Date()`).

The evaluator's `scopeEvents` for `single_session` looks for session.start/session.end boundaries. Since wrapForWindows adds session.start at the beginning and the events between session.start and the implicit "now" (since no session.end is in the data for single_session)... actually, looking more carefully:

```ts
function scopeEvents(events: TrackedEvent[], cond: Condition): TrackedEvent[] {
  if (isTaskWindow(cond)) { ... }
  if (isSessionWindow(cond)) {
    // Find most recent session start
    const lastSessionStart = events.findLastIndex(e => e.event_type === 'session.start');
    if (lastSessionStart < 0) return [];
    return events.slice(lastSessionStart);
  }
```

So for `single_session`, it finds the last `session.start` and returns everything after it. Since wrapForWindows adds `session.start` at the beginning, that will be the boundary. The generated 26 tool.complete events all fall within this session. Good.

For `the_scheduler` with `distinct_count session.start field: hour >= 12`:
- genEvents for `distinct_count` with `field: hour` and `value: 12` generates 12 events with `hour: v0` through `hour: v11` (where `v0` is the string "v0").
- Wait, but hour is supposed to be a number in the evaluator context. genEvents does:
  ```
  for (let i = 0; i < target; i++) {
    const val = wl ? wl[i % wl.length] : `v${i}`;
    result.push(evt(cond.event || 'tool.complete', { ...payload, [field]: val }, ...));
  }
  ```
  So it passes `hour: "v0"`, `hour: "v1"`, etc.

But `getField(event, 'hour')` reads `event.payload?.hour` — it'll be the string "v0". The evaluator's `evalDistinctCount` just counts distinct values, so "v0", "v1", ... "v11" gives 12 distinct values. That's fine for the test trigger.

In real usage, hour will be a number from 0-23 via the hook.ts base payload injection (Task 2). The test doesn't need to exactly match production — it just needs to produce 12 distinct values for the `hour` field.

OK, everything checks out. Let me finalize the plan. But I realize I need to correct the YAML in the plan — I wrote `threshold` but should be `counter` for the 7 language depth achievements.

Now let me also re-examine `smorgasbord`: `distinct_count file.language_used field: language >= 6 single_session` — genEvents sees distinct_count with field='language', value=6, no values whitelist. Generates 6 events: `language: v0`, `language: v1`, ... `language: v5`. wrapForWindows adds session.start at start. Evaluator counts distinct `language` values within session → 6 distinct. Correct.

`full_spectrum`: `distinct_count file.language_used field: language >= 10 all` — same pattern, generates 10 events with distinct language values. No window wrapping needed. Correct.

OK, I need to write the corrected plan now. The task list above had `threshold` which should be `counter` for the 7 language depth achievements. Let me rewrite.

Wait, actually — `genEvents` handles `threshold` with `field` by generating one event with payload[field] = value. For 50 events, it generates ONE event with `language: 50`. But the evaluator `evalThreshold` with `field` sums the field values across matching events. So one event with `language: 50` → sum = 50 → >= 50 passes.

But the filter says `language == 'python'`. So `matchFilter` checks `payload.language === 'python'`. But the event payload has `language: 50` (from the threshold genEvents logic). That fails.

So either:
1. Use `counter` type (correct counting of events) — genEvents generates 51 events with payload.language = 'python'
2. The filter and the field value are the same — can't use threshold with filter that targets the same field

Definitely go with `counter`. Let me finalize the corrected plan.<｜end▁of▁thinking｜>Now I have all the context I need. Let me write the plan with full detail.

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="Write">
<｜｜DSML｜｜parameter name="content" string="true"># Tech + Time Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add 12 new achievements (7 language depth + 2 language breadth + 1 test milestone + 2 time/session) and supporting infrastructure to AGPA.

**Architecture:** New `src/utils/lang-detect.ts` — file extension → language mapping. `hook.ts` uses it on Read/Write/Edit to auto-emit `file.language_used`. `evaluator.ts` adds `language` to matchFilter ctx. All events get `hour`/`day_of_week` in base payload. YAML adds 12 definitions + `linguist` set.

**Tech Stack:** TypeScript, Vitest, YAML

---

### Task 1: Create `src/utils/lang-detect.ts`

**Files:**
- Create: `src/utils/lang-detect.ts`
- Create: `tests/utils/lang-detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/lang-detect.test.ts
import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/utils/lang-detect.js';

describe('detectLanguage', () => {
  it('returns "python" for .py files', () => {
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('/abs/path/main.py')).toBe('python');
  });
  it('returns "typescript" for .ts/.tsx', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
    expect(detectLanguage('/src/components/Button.tsx')).toBe('typescript');
  });
  it('returns "javascript" for .js/.jsx/.mjs', () => {
    expect(detectLanguage('index.js')).toBe('javascript');
    expect(detectLanguage('App.jsx')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
  });
  it('returns "java" for .java', () => {
    expect(detectLanguage('Main.java')).toBe('java');
  });
  it('returns "cpp" for .cpp/.cc/.cxx/.hpp', () => {
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('util.cc')).toBe('cpp');
    expect(detectLanguage('util.cxx')).toBe('cpp');
    expect(detectLanguage('util.hpp')).toBe('cpp');
  });
  it('returns "c" for .c/.h', () => {
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('header.h')).toBe('c');
  });
  it('returns "rust" for .rs', () => {
    expect(detectLanguage('lib.rs')).toBe('rust');
  });
  it('returns "go" for .go', () => {
    expect(detectLanguage('main.go')).toBe('go');
  });
  it('returns null for unknown extensions', () => {
    expect(detectLanguage('notes.txt')).toBeNull();
    expect(detectLanguage('Makefile')).toBeNull();
    expect(detectLanguage('noext')).toBeNull();
  });
  it('returns null for empty path', () => {
    expect(detectLanguage('')).toBeNull();
  });
  it('handles Dockerfile naming', () => {
    expect(detectLanguage('Dockerfile')).toBe('dockerfile');
  });
  it('returns "bash" for .sh/.bash/.zsh', () => {
    expect(detectLanguage('deploy.sh')).toBe('bash');
    expect(detectLanguage('build.bash')).toBe('bash');
    expect(detectLanguage('aliases.zsh')).toBe('bash');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/lang-detect.test.ts 2>&1 | head -5`
Expected: ERROR — mod not found (no such module)

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/lang-detect.ts

const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  scala: 'scala',
  r: 'r',
  lua: 'lua',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  cljs: 'clojure',
  zig: 'zig',
  sol: 'solidity',
  dart: 'dart',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  toml: 'toml',
};

export function detectLanguage(filePath: string): string | null {
  if (!filePath || filePath.trim() === '') return null;

  const basename = filePath.split('/').pop() || filePath;
  // Special case: Dockerfile (no meaningful extension)
  if (/^Dockerfile$/i.test(basename)) return 'dockerfile';

  const dotIdx = basename.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const ext = basename.slice(dotIdx + 1).toLowerCase();
  if (!ext) return null;

  return EXTENSION_MAP[ext] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/lang-detect.test.ts`
Expected: 13 tests all PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/lang-detect.ts tests/utils/lang-detect.test.ts
git commit -m "feat: add detectLanguage() — file extension to programming language mapper

Maps 35+ file extensions to language names (python, typescript, javascript,
java, c, cpp, rust, go, etc.). Used by hook.ts to auto-emit file.language_used.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Inject `hour`/`day_of_week` into all event payloads

**Files:**
- Modify: `src/cli/hook.ts` (around lines 97-101)

**Why:** Currently only `git.push` events carry `hour`/`day_of_week`. We need all events to carry them for the `the_scheduler` achievement (distinct_count `session.start` `field: hour`).

- [ ] **Step 1: Modify base payload construction**

In `src/cli/hook.ts`, find the `base` object construction block (lines 97-101):

```ts
const base: Record<string, unknown> = {};
if (data.tool_name) base.tool_name = data.tool_name;
if (data.agent_type) base.agent_type = data.agent_type;
if (typeof data.duration_ms === 'number') base.duration_ms = data.duration_ms;
if (data.source) base.source = data.source;
```

After the existing lines (after `if (data.source) base.source = data.source;`), add:

```ts
const now = new Date();
base.hour = now.getHours();
base.day_of_week = now.getDay();
```

Then find the `git push` block (around lines 176-179):

```ts
if (ti.command.includes('git push')) {
  const now = new Date();
  results.push({ event_type: 'git.push', payload: { ...base, day_of_week: now.getDay(), hour: now.getHours() } });
}
```

Replace with (the `now` is already defined above, and `hour`/`day_of_week` are already in `base`):

```ts
if (ti.command.includes('git push')) {
  results.push({ event_type: 'git.push', payload: { ...base } });
}
```

- [ ] **Step 2: Run tests to verify no breakage**

Run: `npm run test 2>&1 | tail -5`
Expected: All 519+ tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/cli/hook.ts
git commit -m "feat: inject hour/day_of_week into all event base payloads

Moves timestamp fields from git.push-specific to base payload so all
hook-emitted events carry hour/day_of_week context. Enables time-based
achievements via distinct_count session.start field: hour.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Auto-emit `file.language_used` in hook.ts + add `language` to evaluator context

**Files:**
- Modify: `src/cli/hook.ts` (import + 3 injection points in mapEvents)
- Modify: `src/engine/evaluator.ts` (add `language` to matchFilter ctx)

- [ ] **Step 1: Add import at top of hook.ts**

After the existing import block (around line 53), add:

```ts
import { detectLanguage } from '../utils/lang-detect.js';
```

- [ ] **Step 2: Add auto-emission in each file tool handler**

**Read** — after the image.upload lines (around line 132). Find:

```ts
if (data.tool_name === 'Read') {
  results.push({ event_type: 'file.read', payload: { ...base } });
  // If reading an image file, also emit image.read + image.upload
  const readPath = ti.file_path as string;
  if (readPath && /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(readPath)) {
    results.push({ event_type: 'image.read', payload: { ...base } });
    results.push({ event_type: 'image.upload', payload: { ...base } });
  }
}
```

Add after the inner if block (before the closing `}` of `if (data.tool_name === 'Read')`):

```ts
  const readLang = detectLanguage(ti.file_path as string || '');
  if (readLang) {
    results.push({ event_type: 'file.language_used', payload: { ...base, language: readLang } });
  }
```

**Write** — after `file.write` emission (around line 136):

```ts
if (data.tool_name === 'Write') {
  results.push({ event_type: 'file.create', payload: { ...base } });
  results.push({ event_type: 'file.write', payload: { ...base } });
}
```

Add after `file.write`:

```ts
  const writeLang = detectLanguage(ti.file_path as string || '');
  if (writeLang) {
    results.push({ event_type: 'file.language_used', payload: { ...base, language: writeLang } });
  }
```

**Edit** — after `file.edit` emission (around line 157):

```ts
  results.push({ event_type: 'file.edit', payload: editPayload });
```

Add after `file.edit`:

```ts
  const editLang = detectLanguage(ti.file_path as string || '');
  if (editLang) {
    results.push({ event_type: 'file.language_used', payload: { ...base, language: editLang } });
  }
```

- [ ] **Step 3: Add `language` to matchFilter context in evaluator.ts**

Find the ctx object inside `matchFilter()` (line 21-37). After line 36 (`has_question_mark: ...`), add:

```ts
    language: event.payload?.language || '',
```

- [ ] **Step 4: Run tests**

Run: `npm run test 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/hook.ts src/engine/evaluator.ts
git commit -m "feat: auto-emit file.language_used from hook.ts on file read/write/edit

Hook now calls detectLanguage() on file_path in Read/Write/Edit tool handlers
to auto-emit file.language_used events. matchFilter context gains 'language'
field for filter expressions like 'language == python'.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add 12 achievement definitions + `linguist` set to YAML

**Files:**
- Modify: `04-成就定义清单.yaml`

**Design notes:**
- 7 language depth achievements use `counter` (not `threshold`) with `filter: language == 'X'` — this counts events correctly.
- `pointer_pilot` uses `filter: language in ['c', 'cpp']` — filter parser handles `in` for strings.
- `smorgasbord` uses `distinct_count` with `single_session` window.
- `the_scheduler` uses `distinct_count session.start field: hour` — requires Task 2 for payload.hour.
- `power_session` uses `counter tool.complete single_session`.

- [ ] **Step 1: Insert 12 new definitions before `sets:` section**

Insert these blocks right before the `sets:` line (currently line 3024):

```yaml
  - id: pythonista
    name: Pythonista
    name_cn: Pythonista
    description: Write 50+ Python files. Snake? No, Python.
    description_cn: 写了 50+ 个 Python 文件。是蟒蛇不是巨蟒。
    icon: 🐍
    category: tool_mastery
    rarity: common
    hidden: false
    hint: Work with Python files regularly
    hint_cn: 经常使用 Python 写代码
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language == 'python'
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: type_astronaut
    name: Type Astronaut
    name_cn: 类型宇航员
    description: Write 50+ TypeScript files. Types are rocket fuel.
    description_cn: 写了 50+ 个 TypeScript 文件。类型就是火箭燃料。
    icon: 📘
    category: tool_mastery
    rarity: common
    hidden: false
    hint: Work with TypeScript regularly — types pay off in the long run
    hint_cn: 经常使用 TypeScript——类型系统长期来看是值得的
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language == 'typescript'
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: web_weaver
    name: Web Weaver
    name_cn: 网络织者
    description: Write 50+ JavaScript files. Weaving the web since '95.
    description_cn: 写了 50+ 个 JavaScript 文件。95 年就开始织网。
    icon: 🕸️
    category: tool_mastery
    rarity: common
    hidden: false
    hint: Work with JavaScript files regularly
    hint_cn: 经常使用 JavaScript 写代码
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language == 'javascript'
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: bean_counter
    name: Bean Counter
    name_cn: 咖啡豆计数员
    description: Write 50+ Java files. Object my my my.
    description_cn: 写了 50+ 个 Java 文件。对象啊对象。
    icon: ☕
    category: tool_mastery
    rarity: uncommon
    hidden: false
    hint: Work with Java files
    hint_cn: 经常使用 Java 写代码
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language == 'java'
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: pointer_pilot
    name: Pointer Pilot
    name_cn: 指针领航员
    description: Write 50+ C or C++ files. Manual memory? manual fun.
    description_cn: 写了 50+ 个 C 或 C++ 文件。手动内存，手动乐趣。
    icon: 🔗
    category: tool_mastery
    rarity: rare
    hidden: false
    hint: Work with C or C++ files
    hint_cn: 经常使用 C 或 C++ 写代码
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language in ['c', 'cpp']
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: ferris_fan
    name: Ferris Fan
    name_cn: 螃蟹粉丝
    description: Write 50+ Rust files. The borrow checker approves.
    description_cn: 写了 50+ 个 Rust 文件。借用检查器表示通过。
    icon: 🦀
    category: tool_mastery
    rarity: rare
    hidden: false
    hint: Work with Rust files — fearless concurrency awaits
    hint_cn: 经常使用 Rust——无畏并发在等你
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language == 'rust'
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: go_getter
    name: Go Getter
    name_cn: 进取者
    description: Write 50+ Go files. Simplicity is a feature.
    description_cn: 写了 50+ 个 Go 文件。简洁就是一种特性。
    icon: 🏃
    category: tool_mastery
    rarity: uncommon
    hidden: false
    hint: Work with Go files regularly
    hint_cn: 经常使用 Go 写代码
    progress_trackable: true
    conditions:
      - type: counter
        event: file.language_used
        filter: language == 'go'
        operator: ">="
        value: 50
        window: all
    set: linguist
  - id: smorgasbord
    name: Smorgasbord
    name_cn: 丰盛大餐
    description: Use 6+ languages in one session. All-you-can-code buffet.
    description_cn: 单次 session 用 6+ 种语言。编码自助餐。
    icon: 🧩
    category: challenge
    rarity: rare
    hidden: false
    hint: Switch between many programming languages in a single session
    hint_cn: 单次 session 中使用多种编程语言
    challenge: true
    conditions:
      - type: distinct_count
        event: file.language_used
        field: language
        window: single_session
        operator: ">="
        value: 6
    set: linguist
  - id: full_spectrum
    name: Full Spectrum
    name_cn: 全光谱
    description: Use 10+ languages cumulatively. True polyglot, no impostor.
    description_cn: 累计使用过 10+ 种语言。真多语言者。
    icon: 🌈
    category: milestones
    rarity: epic
    hidden: false
    progress_trackable: true
    conditions:
      - type: distinct_count
        event: file.language_used
        field: language
        window: all
        operator: ">="
        value: 10
    set: linguist
  - id: test_champion
    name: Test Champion
    name_cn: 测试冠军
    description: 500 tests passed. The CI pipeline worships you.
    description_cn: 累计 500 个测试通过。CI 流程视你为神。
    icon: 🏆
    category: milestones
    rarity: epic
    hidden: false
    hint: Keep writing tests — green is the best color
    hint_cn: 持续写测试——绿色是最好的颜色
    progress_trackable: true
    conditions:
      - type: counter
        event: test.pass
        operator: ">="
        value: 500
        window: all
    set: endurance
  - id: the_scheduler
    name: The Scheduler
    name_cn: 日程规划师
    description: Start sessions at 12+ different hours. You're always there.
    description_cn: 在 12+ 个不同时间段启动过 session。你无处不在。
    icon: 📅
    category: style
    rarity: uncommon
    hidden: false
    hint: Code at different times of day — see how the world changes
    hint_cn: 在不同时间编码——看看世界如何变化
    progress_trackable: true
    conditions:
      - type: distinct_count
        event: session.start
        field: hour
        window: all
        operator: ">="
        value: 12
  - id: power_session
    name: Power Session
    name_cn: 全力冲刺
    description: 25+ tools in a single session. Full throttle.
    description_cn: 单次 session 中发起 25+ 次工具调用。马力全开。
    icon: ⚡
    category: endurance
    rarity: uncommon
    hidden: false
    hint: A focused session with high tool throughput — go deep
    hint_cn: 一次高工具吞吐量的专注 session——深度工作
    progress_trackable: true
    conditions:
      - type: counter
        event: tool.complete
        window: single_session
        operator: ">="
        value: 25
    set: endurance
```

- [ ] **Step 2: Add `linguist` set + update `endurance` set**

Find `endurance` (around line 3086) and add `test_champion` and `power_session` to its achievements list:

```yaml
  endurance:
    name: Endurance
    name_cn: 持之以恒
    achievements:
      - streak_3
      - streak_7
      - streak_30
      - streak_100
      - marathon
      - test_champion
      - power_session
    reward:
      type: badge
      value: streak_master
```

After `endurance` (or after `completionist` at the end — either works), add:

```yaml
  linguist:
    name: Linguist
    name_cn: 语言学者
    achievements:
      - pythonista
      - type_astronaut
      - web_weaver
      - bean_counter
      - pointer_pilot
      - ferris_fan
      - go_getter
      - smorgasbord
      - full_spectrum
    reward:
      type: title
      value: Polyglot
```

- [ ] **Step 3: Verify YAML parses correctly**

Run: `npx tsx -e "import {parseYAML} from './src/engine/yaml-parser.js'; import fs from 'fs'; const r=parseYAML(fs.readFileSync('04-成就定义清单.yaml','utf-8')); console.log('defs:', r.definitions.length, 'sets:', Object.keys(r.sets || {}).length)"`
Expected: `defs: 183 sets: 11` (or whatever correct count)

- [ ] **Step 4: Run full test suite**

Run: `npm run test 2>&1 | tail -5`
Expected: All 531+ tests PASS (12 new achievements auto-picked by data-driven test)

- [ ] **Step 5: Commit**

```bash
git add 04-成就定义清单.yaml
git commit -m "feat: add 12 achievements + linguist set (183 total, 11 sets)

Language depth (7): pythonista, type_astronaut, web_weaver, bean_counter,
pointer_pilot, ferris_fan, go_getter — each 50 file writes in that language.
Language breadth (2): smorgasbord (6+ lang/session), full_spectrum (10+ lang/all).
Test (1): test_champion (500 test.pass).
Time (2): the_scheduler (12+ different hours), power_session (25+ tools/session).

New set: linguist (9 members, reward: 'Polyglot' title).
Endurance set: 5→7 (+test_champion, +power_session).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify and document

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/issues-todo.md`

- [ ] **Step 1: Run `npm run test` and `npm run build`**

```bash
npm run test 2>&1 | tail -10
npm run build 2>&1
```

Expected: All tests PASS, tsc 0 errors.

- [ ] **Step 2: Update counts in documentation**

Update `docs/PROGRESS.md`:
- Total achievements: 171→183
- Tests: 519→571 (13 lang-detect + 12 auto-covered every-achievement = +52 expected)
- File count: 24→26 (new lang-detect.ts + test)
- Sets: 10→11

Update `docs/issues-todo.md` header:
- 总成就数: 171→183
- Tests: 519→571 (predicted)

- [ ] **Step 3: Update CHANGELOG** (only after push)

```bash
git add docs/PROGRESS.md docs/issues-todo.md
git commit -m "docs: sync achievement count 171→183 and test count for 12 new achievements

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Self-Review

| Spec requirement | Task covers it? |
|-----------------|----------------|
| `src/utils/lang-detect.ts` module | ✅ Task 1 |
| 30+ language mappings | ✅ Task 1 — 35 languages |
| hook.ts auto-emit file.language_used on Read/Write/Edit | ✅ Task 3 |
| All events get hour/day_of_week in base payload | ✅ Task 2 |
| matchFilter context gains `language` | ✅ Task 3 |
| 7 language depth achievements (counter + filter) | ✅ Task 4 |
| smorgasbord (6+ lang/single_session) | ✅ Task 4 |
| full_spectrum (10+ lang/all) | ✅ Task 4 |
| test_champion (500 test.pass) | ✅ Task 4 |
| the_scheduler (12+ distinct hours) | ✅ Task 4 |
| power_session (25+ tools/single_session) | ✅ Task 4 |
| linguist set (9 members, Polyglot title) | ✅ Task 4 |
| endurance set expanded (5→7) | ✅ Task 4 |
| YAML validity | ✅ Task 4 Step 3 |
| every-achievement test auto-coverage | ✅ Task 4 Step 4 — data-driven |
| Document sync | ✅ Task 5 |
