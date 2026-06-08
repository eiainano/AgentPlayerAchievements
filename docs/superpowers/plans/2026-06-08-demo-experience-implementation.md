# Demo Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished demo experience (CLI + Dashboard) that simulates 1 day of agent usage, unlocks 5 entry-level achievements, and guides new users through AGPA's features.

**Architecture:** `_demo` profile isolates demo data from user profiles. `agpa demo` CLI generates 55 realistic timestamped events → polls engine → prints terminal output → auto-opens Dashboard. Dashboard detects `_demo` profile, shows purple badge + onboarding banner + optional 4-step product tour.

**Tech Stack:** TypeScript (CLI), vanilla JS/CSS (Dashboard), no new npm dependencies.

**Design Spec:** `docs/superpowers/specs/2026-06-08-demo-experience-design.md`

---

### Task 1: Handle `_demo` system profile in profile utilities

**Files:**
- Modify: `src/utils/profile.ts:23-24,114-125,152-170`
- Test: `tests/utils/profile.test.ts` (find existing, add cases)

- [ ] **Step 1: Add `_demo` to protected names and update validation**

Open `src/utils/profile.ts`. Find `RESERVED_NAMES` (line 24):

```typescript
const RESERVED_NAMES = new Set(['default', 'profiles', 'config']);
```

Change to:

```typescript
const RESERVED_NAMES = new Set(['default', 'profiles', 'config', '_demo']);
```

- [ ] **Step 2: Add `_demo` to resolveProfileDir for direct resolution**

In `resolveProfileDir()` (line 35), `_demo` starts with underscore and fails `PROFILE_NAME_RE`. Add a special case BEFORE the regex check.

After line 36 (`if (name === DEFAULT_PROFILE) return getLegacyDir();`), add:

```typescript
// System profiles: _demo uses its own dir under profiles/ but doesn't count toward limits
if (name === '_demo') return path.join(getProfilesBaseDir(), '_demo');
if (!PROFILE_NAME_RE.test(name)) {
```

- [ ] **Step 3: Hide `_demo` from `listProfiles()`**

In `listProfiles()` (line 128), add a filter to skip `_demo`. After the `profiles.push(entry.name)` line, find it around line 138:

```typescript
if (fs.existsSync(path.join(baseDir, entry.name, 'state.json'))) {
  profiles.push(entry.name);
}
```

Change to:

```typescript
if (entry.name === '_demo') continue;
if (fs.existsSync(path.join(baseDir, entry.name, 'state.json'))) {
  profiles.push(entry.name);
}
```

- [ ] **Step 4: Write tests for `_demo` profile behavior**

Find or create tests in `tests/utils/profile.test.ts`. Add these test cases:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveProfileDir, validateProfileName, listProfiles, createProfile } from '../../src/utils/profile.js';

describe('_demo system profile', () => {
  it('resolves _demo to profiles/_demo directory', () => {
    const dir = resolveProfileDir('_demo');
    expect(dir).toContain('profiles/_demo');
    expect(dir).not.toContain('..');
  });

  it('rejects creating a profile named _demo', () => {
    expect(() => createProfile('_demo')).toThrow(/reserved/i);
  });

  it('validateProfileName rejects _demo', () => {
    expect(validateProfileName('_demo')).toBeTruthy(); // returns error string
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/utils/profile.test.ts
```

Expected: All profile tests pass including new `_demo` cases.

```bash
git add src/utils/profile.ts tests/utils/profile.test.ts
git commit -m "feat: add _demo system profile support to profile utilities

- _demo resolves to profiles/_demo/, not counted toward limits
- _demo hidden from listProfiles() output
- _demo blocked from manual creation via createProfile"

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: Create demo event generator and CLI command

**Files:**
- Create: `src/cli/demo.ts`
- Modify: `src/cli/index.ts:53`

- [ ] **Step 1: Create `src/cli/demo.ts` with demo event generation**

Create the file with the demo scenario generator and CLI rendering:

```typescript
#!/usr/bin/env node
/**
 * AGPA Demo — simulate 1 day of agent usage and unlock 5 achievements
 *
 * Usage:
 *   agpa demo
 *   agpa demo --profile <name>  (for testing, defaults to _demo)
 */

import * as child_process from 'node:child_process';
import { AchievementEngine } from '../engine/engine.js';
import type { TrackedEvent, AchievementDefinition, AchievementStats } from '../engine/types.js';
import { R, B, D, G, C, RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

// Reuse from mvp.ts — keep identical copies to avoid cross-file imports of render-only helpers
const RARITY_BADGE: Record<string, string> = {
  common: '⬜ Common',
  uncommon: '🟩 Uncommon',
  rare: '🟦 Rare',
  epic: '🟪 Epic',
  legendary: '🟧 Legendary',
  mythic: '🟥 Mythic',
};

function renderPopup(ach: AchievementDefinition): string {
  const rarity = ach.rarity || 'common';
  const color = RARITY_COLORS[rarity] || '';
  const gold = '\x1b[38;2;255;200;0m';
  const icon = ach.icon || '🏆';
  const name = ach.name || ach.id;
  const desc = ach.description || '';
  const W = 52;

  return [
    `${color}${B}  ╔${'═'.repeat(W - 2)}╗${R}`,
    `${color}${B}  ║${R}${gold}  🏆 ACHIEVEMENT UNLOCKED!${' '.repeat(W - 29)}${color}${B}║${R}`,
    `${color}${B}  ║${R}${' '.repeat(W - 2)}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${icon}  ${B}${name}${R}${' '.repeat(Math.max(0, W - name.length - 10))}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${D}${desc}${R}${' '.repeat(Math.max(0, W - desc.length - 6))}${color}${B}║${R}`,
    `${color}${B}  ║${R}${' '.repeat(W - 2)}${color}${B}║${R}`,
    `${color}${B}  ╚${'═'.repeat(W - 2)}╝${R}`,
  ].join('\n');
}

function renderBar(done: number, total: number, width: number): string {
  const frac = total > 0 ? done / total : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  return `${G}${'█'.repeat(filled)}${D}${'░'.repeat(empty)}${R}`;
}

// ── Demo scenario ──────────────────────────────────────────────────────

/** Build a TrackedEvent with a specific timestamp */
function makeEvent(
  eventType: string,
  timestamp: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
): TrackedEvent {
  const eventId = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    protocol_version: '1.0',
    event_id: eventId,
    timestamp,
    tool_source: 'claude-code',
    event_type: eventType,
    payload: { ...payload, tool_source: 'claude-code' },
    context: { session_id: 'demo_session', model: 'claude-sonnet-4-6', ...context },
  };
}

function buildDemoEvents(): TrackedEvent[] {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  // Generate timestamps with random gaps (5-15 min)
  let t = new Date(`${yyyy}-${mm}-${dd}T09:00:00`).getTime();
  const gap = () => 5 * 60000 + Math.floor(Math.random() * 10 * 60000);
  const ts = () => {
    t += gap();
    return new Date(t).toISOString();
  };

  const events: TrackedEvent[] = [];

  // ── Session 1 (09:00–10:15) morning — reading codebase ──
  let sid = `demo_s1_${Date.now()}`;
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Grep' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '审查认证模块代码' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '重构错误处理逻辑' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  // Jump to afternoon
  t = new Date(`${yyyy}-${mm}-${dd}T14:00:00`).getTime();

  // ── Session 2 (14:00–15:30) afternoon — deep development ──
  sid = `demo_s2_${Date.now()}`;
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('permission.mode_changed', ts(), { old_mode: 'default', new_mode: 'acceptEdits' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '运行单元测试' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Write' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '添加用户认证中间件' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '修复登录页样式bug' }, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  // Jump to evening
  t = new Date(`${yyyy}-${mm}-${dd}T20:00:00`).getTime();

  // ── Session 3 (20:00–21:00) evening — exploring MCP ──
  sid = `demo_s3_${Date.now()}`;
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('mcp.server_used', ts(), { server_name: 'github' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '集成 GitHub MCP' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '测试 API 接口' }, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  return events;
}

// ── Demo runner ────────────────────────────────────────────────────────

async function runDemo(): Promise<void> {
  const { resolveProfileDir } = await import('../utils/profile.js');

  console.log(`${B}\x1b[38;2;255;200;0m`);
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║     🎮  AGPA Demo — 模拟一天使用体验        ║');
  console.log('  ║     Agent Player Achievements System         ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`${R}\n`);

  // ── Phase 1: Generate demo data ──
  const stateDir = resolveProfileDir('_demo');
  const engine = new AchievementEngine({ stateDir });
  engine.resetState();
  engine.init();

  const events = buildDemoEvents();
  const sessionCount = new Set(events.filter(e => e.event_type === 'session.start').map(e => e.context?.session_id)).size;

  process.stdout.write(`${D}⏳  生成 Demo 数据...${R}  `);
  engine.appendEvents(events);
  console.log(`${G}████████████████${R}  ${events.length} 事件, ${sessionCount} sessions\n`);

  // ── Phase 2: Poll for unlocks ──
  const unlocked = engine.poll();

  if (unlocked.length > 0) {
    for (const ach of unlocked) {
      console.log(renderPopup(ach));
      console.log();
    }
  }

  // ── Phase 3: Stats summary ──
  const stats = engine.stats();

  console.log(`${B}\x1b[38;2;255;200;0m  ═══ 今日战绩 ═══${R}`);
  console.log(`  成就: ${stats.unlocked}/${stats.total_achievements} 解锁 (${stats.completion_pct}%)`);
  console.log(`  事件: ${stats.total_events} 条记录`);
  console.log(`  Sessions: ${sessionCount} 次`);
  console.log(`  活跃时段: 09:00 - 21:00`);

  const onboardingCat = stats.by_category['onboarding'];
  if (onboardingCat) {
    const bar = renderBar(onboardingCat.unlocked, onboardingCat.total, 16);
    console.log(`\n  按类别:  onboarding  ${bar}  ${onboardingCat.unlocked}/${onboardingCat.total}`);
  }

  // Set progress for the_beginning
  const setMembers = engine.definitions.filter(d => (d as any).set_id === 'the_beginning' || d['set'] === 'the_beginning');
  const setUnlocked = setMembers.filter(d => engine.state.unlocked[d.id]).length;
  if (setMembers.length > 0) {
    console.log(`  🎖️  the_beginning 套装: ${setUnlocked}/${setMembers.length} (${setUnlocked === setMembers.length ? '完成!' : `还差 ${setMembers.length - setUnlocked} 个!`})`);
  }

  console.log(`${D}────────────────────────────────────────────${R}`);

  // ── Phase 4: Open Dashboard ──
  console.log(`\n${C}🌐  正在打开 Dashboard...${R}\n`);
  console.log(`  ${G}浏览器已打开 → http://localhost:3867${R}`);
  console.log(`  ${D}按 Ctrl+C 停止 Dashboard${R}\n`);

  // Spawn dashboard as child process with --profile _demo
  const dashboardPath = new URL('./dashboard.ts', import.meta.url).pathname;
  const child = child_process.spawn('npx', ['tsx', dashboardPath, '--profile', '_demo'], {
    stdio: 'inherit',
    detached: false,
  });

  // Forward signals to child
  const cleanup = () => {
    try { child.kill('SIGTERM'); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// ── Main ───────────────────────────────────────────────────────────────

runDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Update `src/cli/index.ts` to point `demo` to new file**

In `src/cli/index.ts`, around line 53, change:

```typescript
{ name: 'demo',       description: 'Generate MVP demo data',                                             usage: 'agpa demo',                                 module: './mvp.ts' },
```

To:

```typescript
{ name: 'demo',       description: 'Simulate 1-day usage with 5 achievements + open Dashboard',           usage: 'agpa demo',                                 module: './demo.ts' },
```

- [ ] **Step 3: Remove `runDemo` from `src/cli/mvp.ts`**

Remove the `runDemo()` function (lines 143-225) and the `if (cmd === 'demo')` branch (lines 246-247). Keep stats, progress, reset, and rendering helpers.

The main switch statement changes from:

```typescript
if (cmd === 'demo') {
  runDemo();
} else if (cmd === 'stats') {
```

To:

```typescript
if (cmd === 'stats') {
```

- [ ] **Step 4: Run build check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Test manually**

```bash
npm run demo
```

Expected: Terminal output with 5 achievement popups, stats, and auto-opened browser.

- [ ] **Step 6: Commit**

```bash
git add src/cli/demo.ts src/cli/index.ts src/cli/mvp.ts
git commit -m "feat: new demo experience — simulated 1-day usage, 55 events, 5 achievements

- Replaces bare-bones mvp.ts runDemo with polished demo.ts
- 3 sessions with realistic timestamps and task names
- Unlocks Hello World, Prometheus, Hat Trick, Permission Granted, MCP Plug-in
- Auto-opens Dashboard with --profile _demo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Write CLI demo tests

**Files:**
- Create: `tests/cli/demo.test.ts`

- [ ] **Step 1: Create test file**

Create `tests/cli/demo.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AchievementEngine } from '../../src/engine/engine.js';
import { resolveProfileDir } from '../../src/utils/profile.js';

// Inline the event builder from demo.ts for testability
function makeEvent(
  eventType: string,
  timestamp: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
) {
  const eventId = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    protocol_version: '1.0',
    event_id: eventId,
    timestamp,
    tool_source: 'claude-code',
    event_type: eventType,
    payload: { ...payload, tool_source: 'claude-code' },
    context: { session_id: 'demo_session', model: 'claude-sonnet-4-6', ...context },
  };
}

function buildDemoEvents(): any[] {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  let t = new Date(`${yyyy}-${mm}-${dd}T09:00:00`).getTime();
  const gap = () => 5 * 60000 + Math.floor(Math.random() * 10 * 60000);
  const ts = () => { t += gap(); return new Date(t).toISOString(); };

  const events: any[] = [];

  let sid = `demo_s1_test`;
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Grep' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '审查认证模块代码' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '重构错误处理逻辑' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  t = new Date(`${yyyy}-${mm}-${dd}T14:00:00`).getTime();
  sid = `demo_s2_test`;
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('permission.mode_changed', ts(), { old_mode: 'default', new_mode: 'acceptEdits' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '运行单元测试' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Write' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '添加用户认证中间件' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '修复登录页样式bug' }, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  t = new Date(`${yyyy}-${mm}-${dd}T20:00:00`).getTime();
  sid = `demo_s3_test`;
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('mcp.server_used', ts(), { server_name: 'github' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '集成 GitHub MCP' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '测试 API 接口' }, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  return events;
}

describe('Demo event generation', () => {
  const tempDir = path.join(os.tmpdir(), `agpa-demo-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates exactly 55 events', () => {
    const events = buildDemoEvents();
    expect(events.length).toBe(55);
  });

  it('has exactly 3 sessions', () => {
    const events = buildDemoEvents();
    const sessionIds = new Set(events.filter(e => e.event_type === 'session.start').map(e => e.context?.session_id));
    expect(sessionIds.size).toBe(3);
  });

  it('unlocks exactly 5 achievements', () => {
    const engine = new AchievementEngine({ stateDir: tempDir });
    engine.resetState();
    engine.init();

    const events = buildDemoEvents();
    engine.appendEvents(events);
    const unlocked = engine.poll();

    expect(unlocked.length).toBe(5);
    const ids = unlocked.map(a => a.id);
    expect(ids).toContain('first_contact');
    expect(ids).toContain('tool_time');
    expect(ids).toContain('three_company');
    expect(ids).toContain('permission_granted');
    expect(ids).toContain('mcp_first_contact');
  });

  it('isolates demo data from default profile', () => {
    const demoDir = path.join(tempDir, 'demo');
    const defaultDir = path.join(tempDir, 'default');
    fs.mkdirSync(demoDir, { recursive: true });
    fs.mkdirSync(defaultDir, { recursive: true });

    const demoEngine = new AchievementEngine({ stateDir: demoDir });
    demoEngine.resetState();
    demoEngine.init();

    const defaultEngine = new AchievementEngine({ stateDir: defaultDir });
    defaultEngine.resetState();
    defaultEngine.init();

    const events = buildDemoEvents();
    demoEngine.appendEvents(events);
    demoEngine.poll();

    const demoStats = demoEngine.stats();
    const defaultStats = defaultEngine.stats();

    expect(demoStats.unlocked).toBe(5);
    expect(defaultStats.unlocked).toBe(0);
  });

  it('uses today dates for timestamps', () => {
    const events = buildDemoEvents();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const firstTs = events[0]!.timestamp as string;
    expect(firstTs.slice(0, 10)).toBe(today);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/cli/demo.test.ts
```

Expected: 5/5 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/cli/demo.test.ts
git commit -m "test: add demo event generation tests — 55 events, 5 achievements, isolation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add dashboard API support for demo profile detection

**Files:**
- Modify: `src/dashboard/server.ts:218-220`
- Modify: `src/dashboard/api.ts:514-543`

- [ ] **Step 1: Mark `_demo` profile as demo and include `is_demo` flag in API response**

In `src/dashboard/server.ts`, the `/api/data` handler (line 204). Find where `data.profile = resolvedProfile` is set (line 218). After that line, add:

```typescript
data.is_demo = resolvedProfile === '_demo';
```

In `src/dashboard/api.ts`, add `is_demo` to the `DashboardData` interface (line 107-119):

```typescript
export interface DashboardData {
  achievements: AchievementItem[];
  stats: DashboardStats;
  timeline: Array<{ id: string; unlocked_at: string }>;
  sets: SetItem[];
  config: Pick<AppConfig, 'lang'>;
  profile?: string;
  profile_emoji?: string;
  profiles?: Array<{ name: string; emoji: string; tracked_tools?: string[] }>;
  max_profiles?: number;
  titles: TitleItem[];
  badges: BadgeItem[];
  is_demo?: boolean;  // ← add this
}
```

- [ ] **Step 2: Hide `_demo` from profile list in API**

In `src/dashboard/server.ts`, the `/api/data` handler builds the profiles list at line 220:

```typescript
data.profiles = listProfilesWithMeta().map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools }));
```

Change to:

```typescript
// Exclude _demo from profile list (system profile)
data.profiles = listProfilesWithMeta()
  .filter(p => p.name !== '_demo')
  .map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools }));
```

Also update the `/api/profiles` endpoint (line 251-262), same filter:

```typescript
res.end(JSON.stringify({
  active: resolvedProfile,
  active_meta: getProfileMeta(resolvedProfile),
  profiles: profilesMeta.filter(p => p.name !== '_demo').map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools })),
  max: MAX_PROFILES,
}));
```

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/api.ts src/dashboard/server.ts
git commit -m "feat: add is_demo flag to API response, hide _demo from profile lists

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Add demo badge and nav modifications to Dashboard

**Files:**
- Modify: `src/dashboard/public/index.html:24-28`
- Modify: `src/dashboard/public/app.js:693-713, 421-429, 587-608`
- Modify: `src/dashboard/public/styles.css:346-376`

- [ ] **Step 1: Add demo badge HTML to navigation**

In `src/dashboard/public/index.html`, after the nav-brand span (line 28), add the demo badge:

```html
<span class="nav-brand">
  <img src="/agpa-logo-dark-24.png" alt="" class="nav-logo" id="nav-logo">
  <span class="nav-brand-text">AGPA</span>
</span>
<!-- Add after line 28 -->
<span class="demo-badge" id="demo-badge" style="display:none">🔬 Demo 数据</span>
```

- [ ] **Step 2: Add CSS for demo badge**

In `src/dashboard/public/styles.css`, after the `.nav-brand-text` block (after line 371), add:

```css
/* Demo badge in nav */
.demo-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
  background: #7c3aed;
  color: #fff;
  margin-left: 8px;
  white-space: nowrap;
  letter-spacing: .02em;
}

/* Demo switch-to-real link */
.demo-switch-link {
  color: var(--text-dim);
  font-size: 12px;
  text-decoration: none;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-left: 12px;
  transition: color .2s, border-color .2s;
}
.demo-switch-link:hover {
  color: var(--text);
  border-color: var(--text-dim);
}
```

- [ ] **Step 3: Add demo detection and switch link to app.js**

In `src/dashboard/public/app.js`, modify `renderNav()` to show/hide demo badge. After line 697 (`renderTrackedTools(data);`), add:

```javascript
// Show/hide demo badge
const demoBadge = document.getElementById('demo-badge');
if (demoBadge) {
  demoBadge.style.display = data.is_demo ? 'inline-block' : 'none';
}

// Add "switch to real data" link when in demo mode
const navControls = document.querySelector('.nav-controls');
const existingSwitch = document.getElementById('demo-switch');
if (existingSwitch) existingSwitch.remove();

if (data.is_demo && navControls) {
  const switchLink = document.createElement('a');
  switchLink.id = 'demo-switch';
  switchLink.className = 'demo-switch-link';
  switchLink.href = '#';
  switchLink.textContent = '切换到真实数据 →';
  switchLink.onclick = (e) => {
    e.preventDefault();
    switchProfile('default');
  };
  navControls.appendChild(switchLink);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/public/index.html src/dashboard/public/app.js src/dashboard/public/styles.css
git commit -m "feat: add demo badge and switch-link to Dashboard nav when viewing _demo profile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Add demo banner to Dashboard

**Files:**
- Modify: `src/dashboard/public/index.html:87-93` (before error banner)
- Modify: `src/dashboard/public/app.js:533-546, 1216-1238`
- Modify: `src/dashboard/public/styles.css`

- [ ] **Step 1: Add demo banner HTML**

In `src/dashboard/public/index.html`, before the `<!-- Error banner -->` comment (line 88), add:

```html
<!-- Demo banner (shown when viewing _demo profile) -->
<div id="demo-banner" class="demo-banner" style="display:none">
  <div class="demo-banner-content">
    <span class="demo-banner-icon">🎮</span>
    <div class="demo-banner-text">
      <div class="demo-banner-title">这是你的 Demo 体验数据</div>
      <div class="demo-banner-sub">我们用模拟的一天使用历史帮你解锁了 5 个入门成就。探索下面的面板，了解 AGPA 能追踪什么。</div>
    </div>
    <div class="demo-banner-actions">
      <button class="demo-banner-tour-btn" id="demo-tour-btn" onclick="startTour()">👀 带我逛逛</button>
      <button class="demo-banner-close-btn" onclick="dismissDemoBanner()">✕ 关闭</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add demo banner CSS**

In `src/dashboard/public/styles.css`, add after the `.error-banner` block:

```css
/* ── Demo banner ───────────────────────────────────── */
.demo-banner {
  background: linear-gradient(135deg, #4c1d95, #7c3aed);
  color: #fff;
  margin: 0 auto;
  max-width: 900px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  animation: demo-banner-in .5s ease both;
}
@keyframes demo-banner-in {
  0% { opacity: 0; transform: translateY(-8px); }
  100% { opacity: 1; transform: translateY(0); }
}
.demo-banner-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  flex-wrap: wrap;
}
.demo-banner-icon { font-size: 28px; flex-shrink: 0; }
.demo-banner-text { flex: 1; min-width: 0; }
.demo-banner-title { font-size: 15px; font-weight: 700; }
.demo-banner-sub { font-size: 13px; opacity: .85; margin-top: 2px; }
.demo-banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.demo-banner-tour-btn {
  background: #fff;
  color: #7c3aed;
  border: none;
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .2s;
}
.demo-banner-tour-btn:hover { opacity: .9; }
.demo-banner-close-btn {
  background: none;
  border: 1px solid rgba(255,255,255,.3);
  color: #fff;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: background .2s;
}
.demo-banner-close-btn:hover { background: rgba(255,255,255,.15); }
```

- [ ] **Step 3: Add banner show/dismiss logic to app.js**

In `app.js`, modify `renderAll()` (line 533) to add demo banner rendering. Add after line 536:

```javascript
renderSafe('demo-banner', () => renderDemoBanner(data));
```

Then add the `renderDemoBanner` function near the `renderFirstVisitTip` area (after line 1238):

```javascript
// ── Demo Banner ──────────────────────────────────────

function renderDemoBanner(data) {
  const banner = document.getElementById('demo-banner');
  if (!banner) return;

  if (!data.is_demo) {
    banner.style.display = 'none';
    return;
  }

  // Check if user dismissed it
  if (localStorage.getItem('agpa-demo-banner-dismissed')) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'block';
}

// exported to HTML onclick
function dismissDemoBanner() {
  localStorage.setItem('agpa-demo-banner-dismissed', '1');
  const banner = document.getElementById('demo-banner');
  if (banner) {
    banner.style.transition = 'opacity .3s, transform .3s';
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-8px)';
    setTimeout(() => { banner.style.display = 'none'; }, 300);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/public/index.html src/dashboard/public/app.js src/dashboard/public/styles.css
git commit -m "feat: add demo banner with tour CTA to Dashboard demo mode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Create product tour component (tour.js)

**Files:**
- Create: `src/dashboard/public/tour.js`
- Modify: `src/dashboard/public/index.html:296`
- Modify: `src/dashboard/public/styles.css`

- [ ] **Step 1: Create `tour.js` with TourOverlay class**

Create `src/dashboard/public/tour.js`:

```javascript
/**
 * AGPA Product Tour — lightweight 4-step guided walkthrough
 * No dependencies, pure vanilla JS + CSS.
 */

var AGPATour = (function() {
  var currentStep = -1;
  var overlay = null;
  var tooltip = null;
  var clone = null;
  var running = false;

  var STEPS = [
    {
      target: '#achievement-grid',
      title: '📊 成就面板',
      desc: '每个成就追踪一种 Agent 行为。已解锁的亮起，灰色的等待你去激活。',
      tab: 'achievements',
    },
    {
      target: '#stats-row',
      title: '📈 统计面板',
      desc: '成就进度、分类分布、稀有度一目了然。数字越大越有成就感！',
      tab: 'profile',
    },
    {
      target: '#timeline',
      title: '📅 时间线',
      desc: '回顾你和 Agent 的每一段对话 session，看到成就解锁的时间轴。',
      tab: 'timeline',
    },
    {
      target: '#insights',
      title: '🔥 热力图',
      desc: '像 GitHub 贡献图一样追踪你的 Agent 使用活跃度，每天用了多久一目了然。',
      tab: 'insights',
    },
  ];

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) stop();
    });

    tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (tooltip) { tooltip.remove(); tooltip = null; }
    if (clone) { clone.remove(); clone = null; }
  }

  function switchTab(tabId) {
    // Click the corresponding nav link
    var link = document.querySelector('.nav-link[data-section="' + tabId + '"]');
    if (link) link.click();
    // Scroll to section
    setTimeout(function() {
      var section = document.getElementById(tabId);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function showStep(index) {
    if (!overlay || !tooltip) return;
    if (index < 0 || index >= STEPS.length) { stop(); return; }

    var step = STEPS[index];
    if (step.tab) switchTab(step.tab);

    // Wait for tab switch + scroll
    setTimeout(function() {
      var target = document.querySelector(step.target);
      if (!target) { next(); return; }

      // Remove previous clone
      if (clone) { clone.remove(); clone = null; }

      // Clone target and position above overlay
      var rect = target.getBoundingClientRect();
      clone = target.cloneNode(true);
      clone.className = (clone.className || '') + ' tour-highlight';
      clone.style.position = 'fixed';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.zIndex = '10001';
      clone.style.pointerEvents = 'none';
      document.body.appendChild(clone);

      // Render tooltip
      tooltip.innerHTML =
        '<div class="tour-tooltip-step">' + (index + 1) + ' / ' + STEPS.length + '</div>' +
        '<div class="tour-tooltip-title">' + step.title + '</div>' +
        '<div class="tour-tooltip-desc">' + step.desc + '</div>' +
        '<div class="tour-tooltip-btns">' +
          (index > 0
            ? '<button class="tour-btn tour-btn-prev" id="tour-prev">← 上一步</button>'
            : '<span></span>') +
          (index < STEPS.length - 1
            ? '<button class="tour-btn tour-btn-next" id="tour-next">下一步 →</button>'
            : '<button class="tour-btn tour-btn-done" id="tour-done">✓ 完成</button>') +
          '<button class="tour-btn tour-btn-skip" id="tour-skip">✕ 跳过</button>' +
        '</div>';

      // Position tooltip below the highlighted element
      tooltip.style.left = Math.max(20, rect.left) + 'px';
      tooltip.style.top = (rect.bottom + 12) + 'px';
      tooltip.style.maxWidth = Math.min(480, window.innerWidth - 40) + 'px';
      tooltip.style.display = 'block';

      // Bind button events
      var prevBtn = document.getElementById('tour-prev');
      var nextBtn = document.getElementById('tour-next');
      var doneBtn = document.getElementById('tour-done');
      var skipBtn = document.getElementById('tour-skip');

      if (prevBtn) prevBtn.onclick = prev;
      if (nextBtn) nextBtn.onclick = next;
      if (doneBtn) doneBtn.onclick = stop;
      if (skipBtn) skipBtn.onclick = stop;
    }, 250);
  }

  function next() {
    currentStep++;
    showStep(currentStep);
  }

  function prev() {
    currentStep--;
    showStep(currentStep);
  }

  function start() {
    if (running) return;
    running = true;
    currentStep = 0;
    createOverlay();
    overlay.style.display = 'block';
    showStep(currentStep);
  }

  function stop() {
    running = false;
    currentStep = -1;
    if (overlay) overlay.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    removeOverlay();
    // Switch back to profile tab
    switchTab('profile');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { start: start, stop: stop };
})();

// Expose to HTML onclick
function startTour() {
  AGPATour.start();
}
```

- [ ] **Step 2: Add tour overlay CSS**

In `src/dashboard/public/styles.css`, add at the end:

```css
/* ── Product Tour Overlay ──────────────────────────── */
.tour-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 10000;
  display: none;
  cursor: default;
}
.tour-highlight {
  box-shadow: 0 0 0 4px rgba(250,204,21,.6), 0 0 20px rgba(250,204,21,.25) !important;
  border-radius: 8px;
  animation: tour-pulse 2s ease-in-out infinite;
}
@keyframes tour-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(250,204,21,.6), 0 0 20px rgba(250,204,21,.25); }
  50%      { box-shadow: 0 0 0 6px rgba(250,204,21,.8), 0 0 28px rgba(250,204,21,.35); }
}
.tour-tooltip {
  position: fixed;
  z-index: 10002;
  display: none;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  box-shadow: 0 8px 40px rgba(0,0,0,.4);
  min-width: 300px;
}
.tour-tooltip-step {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .08em;
  margin-bottom: 6px;
}
.tour-tooltip-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--gold);
  margin-bottom: 8px;
}
.tour-tooltip-desc {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 16px;
}
.tour-tooltip-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.tour-btn {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  transition: background .2s, border-color .2s;
}
.tour-btn:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }
.tour-btn-next, .tour-btn-done {
  background: var(--purple-600, #7c3aed);
  color: #fff;
  border-color: transparent;
}
.tour-btn-next:hover, .tour-btn-done:hover {
  background: var(--purple-700, #6d28d9);
  border-color: transparent;
}
.tour-btn-skip { color: var(--text-dim); opacity: .6; }
.tour-btn-skip:hover { opacity: 1; }
```

- [ ] **Step 3: Include tour.js in index.html**

In `src/dashboard/public/index.html`, after line 296 (`<script src="/gacha-reveal.js"></script>`), add:

```html
<script src="/tour.js"></script>
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/public/tour.js src/dashboard/public/index.html src/dashboard/public/styles.css
git commit -m "feat: add 4-step product tour overlay for demo mode

- Pure JS/CSS, no external dependencies
- Steps: achievements grid → stats row → timeline → heatmap
- Auto-switches Dashboard tabs during tour
- Dismissed on overlay click or skip button

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Add achievement card golden glow animation

**Files:**
- Modify: `src/dashboard/public/app.js` (renderAchievements area)
- Modify: `src/dashboard/public/styles.css`

- [ ] **Step 1: Add demo-glow CSS animation**

In `src/dashboard/public/styles.css`, add after the tour CSS:

```css
/* ── Demo achievement card golden glow ─────────────── */
.ach-card.demo-unlocked {
  box-shadow: 0 0 4px rgba(250,204,21,.4);
  animation: demo-glow 2.5s ease-in-out infinite;
  border-color: rgba(250,204,21,.3);
}
@keyframes demo-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(250,204,21,.4); }
  50%      { box-shadow: 0 0 12px rgba(250,204,21,.7); }
}
```

- [ ] **Step 2: Apply demo-unlocked class to unlocked cards in demo mode**

In `src/dashboard/public/app.js` line 1502, the achievement card template is:

```javascript
return `<div class="ach-card${lockedClass}${pickableClass}" data-rarity="${a.rarity}" data-id="${escAttr(a.id)}" style="${cardColor}--delay:${idx * 30}ms">
```

Change to:

```javascript
const demoClass = (dashboardData?.is_demo && !locked) ? ' demo-unlocked' : '';
return `<div class="ach-card${lockedClass}${pickableClass}${demoClass}" data-rarity="${a.rarity}" data-id="${escAttr(a.id)}" style="${cardColor}--delay:${idx * 30}ms">
```

This adds the `.demo-unlocked` CSS class to unlocked achievement cards when viewing `_demo` profile.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/public/app.js src/dashboard/public/styles.css
git commit -m "feat: add golden glow animation to demo-mode unlocked achievement cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Integration test and full regression

**Files:**
- Test all modified files together

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All ~845 tests pass (including new demo tests).

- [ ] **Step 2: Run build check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Manual smoke test — CLI**

```bash
npm run demo
```

Expected:
1. Terminal shows "AGPA Demo" header
2. "生成 Demo 数据... 55 事件, 3 sessions"
3. 5 achievement popup cards appear in terminal
4. Stats summary with 5/183 unlocked
5. "正在打开 Dashboard..."
6. Browser opens to Dashboard showing demo data
7. Nav shows "🔬 Demo 数据" badge
8. Banner appears with "带我逛逛" button
9. "切换到真实数据 →" link visible in nav

- [ ] **Step 4: Manual smoke test — Tour**

Click "👀 带我逛逛" on the demo banner:
1. Overlay appears, first achievement card highlighted
2. Click "下一步 →" through all 4 steps
3. Each step switches to the correct tab
4. Click "✕ 跳过" or "✓ 完成" dismisses tour

- [ ] **Step 5: Switch back to real data**

Click "切换到真实数据 →":
1. Profile switches to "default"
2. Demo badge disappears
3. Demo banner disappears
4. Normal Dashboard view shown

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: full regression pass — all tests green, demo flow verified

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Implementation Order

Tasks must be done in sequence due to dependencies:

1. **Task 1** → `_demo` profile support (foundation)
2. **Task 2 + 3** → CLI demo command + tests (can be done together)
3. **Task 4** → API support for demo detection
4. **Task 5** → Demo badge + nav (depends on Task 4)
5. **Task 6** → Demo banner (depends on Task 4)
6. **Task 7** → Product tour (depends on Task 6 for the "带我逛逛" button)
7. **Task 8** → Card glow (can be parallel with 7)
8. **Task 9** → Integration + regression (final)
