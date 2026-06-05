# Shareable Achievement Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "📸 Share" button to the Dashboard that generates and downloads a Steam-style achievement card PNG using hidden DOM + html2canvas.

**Architecture:** New `GET /api/card` endpoint assembles `CardData` from existing engine state. Frontend fetches data, renders into a hidden `#card-preview` div, screenshots it with html2canvas, and triggers a browser download. No new files — all changes in existing dashboard files + one test file.

**Tech Stack:** TypeScript ESM, Node.js http module, vitest, vanilla JS (no framework), html2canvas@1.4.1 (CDN)

---

## File Structure

| File | Role |
|------|------|
| `src/dashboard/api.ts` | New `buildCardResponse()` + `CardData` types |
| `tests/dashboard/card-api.test.ts` | Tests for `buildCardResponse` |
| `src/dashboard/server.ts` | Route registration for `GET /api/card` |
| `src/dashboard/public/index.html` | Share button + hidden `#card-preview` + html2canvas CDN |
| `src/dashboard/public/styles.css` | Card preview styles (Steam dark theme) |
| `src/dashboard/public/app.js` | `generateCard()` + `buildCardHTML()` functions |

---

### Task 1: `buildCardResponse()` in api.ts

**Files:**
- Modify: `src/dashboard/api.ts`

- [ ] **Step 1: Add imports and CardData types**

Add after line 18 (the `import { calcStreak, ... } from '../utils/activity.js';` line):

```typescript
import type { SetDefinition } from '../engine/types.js';
import type { AppConfig } from '../config.js';
```

Add after the `DashboardData` interface (after line 87):

```typescript
// ── Card API types ────────────────────────────────────────────────────

export interface CardAchievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  rarity: string;
  rarity_color: string;
  rarity_label: string;
  unlocked_at?: string;
  set_name?: string;
  set_progress?: string;
  in_progress?: boolean;
  progress_pct?: number;
  progress_text?: string;
}

export interface CardMilestone {
  emoji: string;
  name: string;
  rarity: string;
  rarity_color: string;
  unlocked_at: string;
}

export interface CardData {
  profile: string;
  profile_emoji: string;
  level: number;
  total_xp: number;
  xp_current: number;
  xp_target: number;
  unlocked: number;
  total: number;
  stats: {
    streak_days: number;
    total_tasks: number;
    total_tool_uses: number;
    total_sessions: number;
  };
  rarity_breakdown: Array<{ rarity: string; color: string; count: number }>;
  achievements: CardAchievement[];
  heatmap: Array<{ date: string; count: number }>;
  milestones: CardMilestone[];
}
```

- [ ] **Step 2: Add the `buildCardResponse` function**

Add after the `buildAchievementsResponse` function (after line 126):

```typescript
const RARITY_CARD_COLORS: Record<string, string> = {
  common: '#7eb8da',
  uncommon: '#3b7ec0',
  rare: '#e0b020',
  epic: '#e87830',
  legendary: '#a858f0',
  mythic: '#f04050',
};

const RARITY_LABELS_EN: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

const RARITY_LABELS_ZH: Record<string, string> = {
  common: '普通',
  uncommon: '罕见',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

export function buildCardResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  events: TrackedEvent[],
  setDefinitions: SetDefinition[],
  config: { lang: string },
  profile: string,
  profileEmoji: string,
  existingStats: any,
): CardData {
  const useZh = config.lang === 'zh';
  const setDefMap = new Map(setDefinitions.map(s => [s.id, s]));

  // ── Level & XP ────────────────────────────────────────────────
  const usageBreakdown = calcUsageBreakdown(events);
  const taskXp = (usageBreakdown?.task_xp || 0);
  const achievementXp = (existingStats?.total_unlocked || state.stats?.total_unlocked || 0) * 50;
  const totalXp = taskXp + achievementXp + (existingStats?.usage_xp || 0);
  const level = calcLevel(totalXp);
  const xpProgress = calcLevelProgress(level);

  // ── Stats ─────────────────────────────────────────────────────
  const taskEvents = events.filter(e => e.event_type === 'task.complete').length;
  const toolEvents = events.filter(e => e.event_type === 'tool.complete').length;
  const sessionEvents = events.filter(e => e.event_type === 'session.start').length;

  const streak = existingStats?.daily
    ? calcStreakFromDaily(existingStats.daily)
    : calcStreak(events);

  // ── Rarity breakdown ───────────────────────────────────────────
  const byRarity = existingStats?.by_rarity || {};
  const rarityBreakdown = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(rarity => ({
    rarity,
    color: RARITY_CARD_COLORS[rarity] || '#7eb8da',
    count: byRarity[rarity]?.unlocked || 0,
  }));

  // ── Achievements ──────────────────────────────────────────────
  const unlockedDefs = definitions
    .filter(d => state.unlocked[d.id])
    .sort((a, b) => (RARITY_RANK_INLINE[b.rarity] || 0) - (RARITY_RANK_INLINE[a.rarity] || 0));

  const RARITY_RANK_INLINE: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

  // Take top 6 by rarity, fall back to in-progress if < 6
  const cardAchievements: CardAchievement[] = [];
  for (let i = 0; i < Math.min(6, unlockedDefs.length); i++) {
    const def = unlockedDefs[i]!;
    const setDef = def.set_id ? setDefMap.get(def.set_id) : undefined;
    const setMembers = setDef ? definitions.filter(d => d.set_id === def.set_id) : [];
    const setCompleted = setMembers.filter(m => state.unlocked[m.id]).length;
    cardAchievements.push({
      id: def.id,
      icon: def.icon || '🏆',
      name: useZh ? (def.name_cn || def.name) : def.name,
      description: useZh ? (def.description_cn || def.description) : def.description,
      rarity: def.rarity,
      rarity_color: RARITY_CARD_COLORS[def.rarity] || '#7eb8da',
      rarity_label: useZh
        ? (RARITY_LABELS_ZH[def.rarity] || '普通')
        : (RARITY_LABELS_EN[def.rarity] || 'Common'),
      unlocked_at: state.unlocked[def.id],
      set_name: setDef ? (useZh ? (setDef.name_cn || setDef.name) : setDef.name) : undefined,
      set_progress: setDef ? `${setCompleted}/${setMembers.length}` : undefined,
    });
  }

  // Fill remaining slots with in-progress achievements if needed
  if (cardAchievements.length < 4) {
    const inProgress = definitions
      .filter(d => !state.unlocked[d.id] && !d.hidden && !d.future && d.conditions[0])
      .map(d => {
        const result = evaluateCondition(d.conditions[0]!, events);
        const ratio = result.target > 0 ? result.progress / result.target : 0;
        return { def: d, result, ratio };
      })
      .filter(x => x.ratio >= 0.2)
      .sort((a, b) => b.ratio - a.ratio);

    for (const x of inProgress) {
      if (cardAchievements.length >= 6) break;
      const def = x.def;
      cardAchievements.push({
        id: def.id,
        icon: def.icon || '🏆',
        name: useZh ? (def.name_cn || def.name) : def.name,
        description: useZh ? (def.description_cn || def.description) : def.description,
        rarity: def.rarity,
        rarity_color: RARITY_CARD_COLORS[def.rarity] || '#7eb8da',
        rarity_label: useZh ? '进行中' : 'In Progress',
        in_progress: true,
        progress_pct: Math.round(x.ratio * 100),
        progress_text: `${x.result.progress} / ${x.result.target}`,
      });
    }
  }

  // ── Heatmap ────────────────────────────────────────────────────
  let heatmap: Array<{ date: string; count: number }>;
  try {
    const heatmapData = existingStats?.daily
      ? computeHeatmapFromDaily(existingStats.daily)
      : computeHeatmap(events.filter(e => e.event_type === 'session.start' || e.event_type === 'tool.complete'));
    heatmap = heatmapData.days.map((d: any) => ({ date: d.date, count: d.level }));
  } catch {
    heatmap = [];
  }

  // ── Milestones ─────────────────────────────────────────────────
  const unlockedPairs = definitions
    .filter(d => state.unlocked[d.id])
    .sort((a, b) => {
      const ra = RARITY_RANK_INLINE[a.rarity] || 0;
      const rb = RARITY_RANK_INLINE[b.rarity] || 0;
      if (ra !== rb) return rb - ra;
      return (state.unlocked[b.id] || '').localeCompare(state.unlocked[a.id] || '');
    });

  const milestones: CardMilestone[] = unlockedPairs.slice(0, 3).map(def => ({
    emoji: def.icon || '🏆',
    name: useZh ? (def.name_cn || def.name) : def.name,
    rarity: def.rarity,
    rarity_color: RARITY_CARD_COLORS[def.rarity] || '#7eb8da',
    unlocked_at: state.unlocked[def.id] || '',
  }));

  return {
    profile,
    profile_emoji: profileEmoji,
    level,
    total_xp: totalXp,
    xp_current: xpProgress.current,
    xp_target: xpProgress.target,
    unlocked: state.stats?.total_unlocked || Object.keys(state.unlocked).length,
    total: definitions.length,
    stats: {
      streak_days: streak.current || 0,
      total_tasks: taskEvents,
      total_tool_uses: toolEvents,
      total_sessions: sessionEvents,
    },
    rarity_breakdown: rarityBreakdown,
    achievements: cardAchievements,
    heatmap,
    milestones,
  };
}
```

Wait — there's a scoping issue: `RARITY_RANK_INLINE` is used before it's defined. Move it above the unlockedDefs computation.

Fix in declaration order:
```typescript
const RARITY_RANK_INLINE: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

const unlockedDefs = definitions
  .filter(d => state.unlocked[d.id])
  .sort((a, b) => (RARITY_RANK_INLINE[b.rarity] || 0) - (RARITY_RANK_INLINE[a.rarity] || 0));
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Run existing tests**

Run: `npm test`
Expected: 478 tests pass (no regression)

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/api.ts
git commit -m "feat: add buildCardResponse for shareable card API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Test `buildCardResponse`

**Files:**
- Create: `tests/dashboard/card-api.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import type { AchievementDefinition, AchievementState, TrackedEvent, SetDefinition } from '../../src/engine/types.js';
import { buildCardResponse, type CardData } from '../../src/dashboard/api.js';

function makeDef(overrides: Partial<AchievementDefinition> = {}): AchievementDefinition {
  return {
    id: 'test_ach',
    name: 'Test Achievement',
    description: 'A test achievement',
    icon: '🧪',
    category: 'test',
    rarity: 'common',
    conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: 'evt-test',
    timestamp: new Date().toISOString(),
    tool_source: 'test',
    event_type: 'tool.complete',
    payload: {},
    context: { session_id: 's1', model: 'test' },
    ...overrides,
  };
}

function makeState(unlocked: string[] = []): AchievementState {
  const u: Record<string, string> = {};
  for (const id of unlocked) u[id] = new Date().toISOString();
  return {
    unlocked: u,
    stats: { total_unlocked: unlocked.length },
  };
}

describe('buildCardResponse', () => {
  it('returns complete CardData with all fields present', () => {
    const defs = [makeDef({ id: 'a' }), makeDef({ id: 'b' })];
    const state = makeState(['a']);
    const events = [makeEvent()];
    const setDefs: SetDefinition[] = [];
    const config = { lang: 'en' };

    const result = buildCardResponse(defs, state, events, setDefs, config, 'default', '🎮', {});

    // Check all top-level keys
    expect(result.profile).toBe('default');
    expect(result.profile_emoji).toBe('🎮');
    expect(typeof result.level).toBe('number');
    expect(typeof result.total_xp).toBe('number');
    expect(typeof result.unlocked).toBe('number');
    expect(typeof result.total).toBe('number');
    expect(result.stats).toBeDefined();
    expect(result.rarity_breakdown).toBeDefined();
    expect(result.rarity_breakdown).toHaveLength(6);
    expect(result.achievements).toBeDefined();
    expect(result.heatmap).toBeDefined();
    expect(result.milestones).toBeDefined();
  });

  it('includes unlocked achievements sorted by rarity', () => {
    const defs = [
      makeDef({ id: 'a', rarity: 'common' }),
      makeDef({ id: 'b', rarity: 'epic' }),
      makeDef({ id: 'c', rarity: 'rare' }),
    ];
    const state = makeState(['a', 'b', 'c']);
    const result = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});

    expect(result.achievements.length).toBeGreaterThanOrEqual(3);
    // epic > rare > common
    expect(result.achievements[0]!.id).toBe('b');
    expect(result.achievements[1]!.id).toBe('c');
    expect(result.achievements[2]!.id).toBe('a');
  });

  it('caps achievements at 6', () => {
    const defs = Array.from({ length: 10 }, (_, i) => makeDef({ id: `a${i}` }));
    const state = makeState(defs.map(d => d.id));

    const result = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});
    expect(result.achievements.length).toBeLessThanOrEqual(6);
  });

  it('uses Chinese names when lang is zh', () => {
    const defs = [
      makeDef({ id: 'a', name: 'English Name', name_cn: '中文名', description: 'Desc', description_cn: '描述', rarity: 'common' }),
    ];
    const state = makeState(['a']);

    const resultZh = buildCardResponse(defs, state, [], [], { lang: 'zh' }, 'default', '🎮', {});
    expect(resultZh.achievements[0]!.name).toBe('中文名');

    const resultEn = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});
    expect(resultEn.achievements[0]!.name).toBe('English Name');
  });

  it('returns empty milestones when nothing unlocked', () => {
    const defs = [makeDef()];
    const state = makeState([]);

    const result = buildCardResponse(defs, state, [], [], { lang: 'en' }, 'default', '🎮', {});
    expect(result.milestones).toEqual([]);
    expect(result.achievements).toEqual([]);
    expect(result.unlocked).toBe(0);
  });

  it('fills in-progress achievements when < 4 unlocked', () => {
    const defs = [
      makeDef({ id: 'unlocked', rarity: 'common' }),
      makeDef({ id: 'progress', rarity: 'rare', conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }] }),
    ];
    const state = makeState(['unlocked']);
    const events = Array.from({ length: 7 }, () => makeEvent()); // 7/10 = 70% >= 20%

    const result = buildCardResponse(defs, state, events, [], { lang: 'en' }, 'default', '🎮', {});
    expect(result.achievements.length).toBeGreaterThanOrEqual(2);
    const inProg = result.achievements.find(a => a.in_progress);
    expect(inProg).toBeDefined();
    expect(inProg!.progress_pct).toBe(70);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/dashboard/card-api.test.ts`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: ~483 tests pass (478 + 5 new)

- [ ] **Step 4: Commit**

```bash
git add tests/dashboard/card-api.test.ts
git commit -m "test: add 5 tests for buildCardResponse API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Register `/api/card` route in server.ts

**Files:**
- Modify: `src/dashboard/server.ts`

- [ ] **Step 1: Add import of `buildCardResponse`**

Change line 10 from:
```typescript
import { buildApiResponse } from './api.js';
```
to:
```typescript
import { buildApiResponse, buildCardResponse } from './api.js';
```

- [ ] **Step 2: Add route handler before the `serveStatic` fallback**

Insert before line 454 (`serveStatic(res, url.pathname);`):

```typescript
    // ── GET /api/card — shareable achievement card data ──────────────
    if (url.pathname === '/api/card' && req.method === 'GET') {
      try {
        const cfg = loadConfig();
        const meta = getProfileMeta(resolvedProfile);
        const cardData = buildCardResponse(
          engine.definitions,
          engine.state,
          engine.events,
          engine.setDefinitions,
          cfg,
          resolvedProfile,
          meta.emoji,
          engine.toolStats(),
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cardData));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Card generation failed';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/server.ts
git commit -m "feat: register GET /api/card route for shareable achievement card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add Share button + hidden card DOM + html2canvas CDN in index.html

**Files:**
- Modify: `src/dashboard/public/index.html`

- [ ] **Step 1: Add html2canvas CDN in `<head>`**

After line 9 (`<link rel="stylesheet" href="/styles.css">`), add:
```html
<script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
```

- [ ] **Step 2: Add Share button in the hero section**

After the XP bar container (after line 75, the `</div>` closing `xp-bar-container`), add:
```html
<button id="share-btn" class="share-btn" onclick="generateCard()" data-i18n="share_card">📸 Share</button>
```

- [ ] **Step 3: Add hidden card preview at the bottom**

Before `</body>` (before line 220), add:
```html
<div id="card-preview"></div>
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/public/index.html
git commit -m "feat: add Share button, hidden card DOM, and html2canvas CDN to Dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Card preview CSS styles

**Files:**
- Modify: `src/dashboard/public/styles.css`

- [ ] **Step 1: Add card preview styles**

Add at the end of `styles.css`:

```css
/* ── Shareable Card Preview ───────────────────────────────────── */

.share-btn {
  padding: 6px 14px;
  background: rgba(102, 192, 244, 0.12);
  border: 1px solid rgba(102, 192, 244, 0.25);
  border-radius: 6px;
  color: #66c0f4;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  font-family: inherit;
}
.share-btn:hover { background: rgba(102, 192, 244, 0.22); border-color: #66c0f4; }
.share-btn:disabled { opacity: 0.5; cursor: not-allowed; }

#card-preview {
  visibility: hidden;
  position: absolute;
  left: -9999px;
  top: 0;
  width: 420px;
  background: linear-gradient(180deg, #171a21 0%, #1b2838 30%, #2a475e 100%);
  border-radius: 12px;
  padding: 32px;
  color: #c7d5e0;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  z-index: -1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}
.card-avatar {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f94cd, #27ae60);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; flex-shrink: 0;
}
.card-profile-name { font-weight: bold; font-size: 17px; color: #fff; }
.card-level { font-size: 13px; color: #66c0f4; }
.card-unlocked-stat { margin-left: auto; text-align: right; flex-shrink: 0; }
.card-unlocked-num { font-size: 22px; font-weight: 700; color: #fff; }
.card-unlocked-label { font-size: 10px; color: #888; }

.card-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 6px;
  margin-bottom: 22px;
}
.card-stat {
  background: rgba(0,0,0,.25);
  padding: 8px 4px; border-radius: 6px;
  text-align: center;
}
.card-stat-val { font-size: 18px; font-weight: 700; color: #fff; }
.card-stat-label { font-size: 9px; color: #888; }

.card-xp-bar { margin-bottom: 22px; }
.card-xp-header { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; color: #888; }
.card-xp-track { height: 6px; background: rgba(0,0,0,.4); border-radius: 3px; overflow: hidden; }
.card-xp-fill { height: 100%; background: linear-gradient(90deg, #4f94cd, #66c0f4); border-radius: 3px; }

.card-divider { height: 1px; background: rgba(255,255,255,.06); margin: 0 0 20px 0; }

.card-section-title {
  font-size: 11px;
  color: #66c0f4;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.card-ach-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.card-ach-row {
  background: rgba(0,0,0,.4);
  padding: 14px; border-radius: 8px;
  display: flex; align-items: flex-start; gap: 12px;
}
.card-ach-left { width: 4px; align-self: stretch; border-radius: 2px; flex-shrink: 0; }
.card-ach-icon { font-size: 30px; flex-shrink: 0; line-height: 1; }
.card-ach-info { flex: 1; min-width: 0; }
.card-ach-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.card-ach-name { font-weight: bold; font-size: 14px; }
.card-ach-tag { font-size: 9px; padding: 2px 8px; border-radius: 4px; }
.card-ach-desc { font-size: 11px; color: #aaa; line-height: 1.5; margin-bottom: 8px; }
.card-ach-desc b { color: #ddd; }
.card-ach-meta { display: flex; align-items: center; gap: 12px; font-size: 10px; color: #666; }

.card-progress-bar {
  height: 5px;
  background: rgba(255,255,255,.08);
  border-radius: 2px;
  overflow: hidden;
}

.card-heatmap-box { background: rgba(0,0,0,.35); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
.card-heatmap-title { font-size: 11px; color: #888; margin-bottom: 10px; }
.card-heatmap-grid {
  display: flex; gap: 2px; justify-content: center; flex-wrap: wrap; margin-bottom: 6px;
}
.card-hm-cell { width: 11px; height: 11px; border-radius: 2px; }
.card-heatmap-legend { display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 8px; color: #666; }

.card-rarity-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 16px; }
.card-rarity-item { text-align: center; }
.card-rarity-label { font-size: 10px; }
.card-rarity-count { font-size: 16px; font-weight: 700; }

.card-milestone-box { background: rgba(0,0,0,.3); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
.card-milestone-title { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.card-milestone-list { display: flex; flex-direction: column; gap: 6px; }
.card-milestone-row { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.card-milestone-bullet { color: #3b7ec0; }
.card-milestone-date { color: #aaa; }
.card-milestone-name { color: #ddd; }
.card-milestone-rarity { margin-left: auto; font-size: 9px; }

.card-footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/public/styles.css
git commit -m "feat: add shareable card preview CSS styles (Steam dark theme)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Add `generateCard()` + `buildCardHTML()` in app.js

**Files:**
- Modify: `src/dashboard/public/app.js`

- [ ] **Step 1: Add the card generation functions**

Add at the end of `app.js` (before the final line if any):

```javascript
// ── Shareable Card Generation ─────────────────────────────────

function generateCard() {
  const btn = document.getElementById('share-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    if (typeof html2canvas === 'undefined') {
      alert('This feature requires an internet connection to load html2canvas.');
      btn.disabled = false;
      btn.textContent = '📸 Share';
      return;
    }

    fetch(apiUrl('/api/card'))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var preview = document.getElementById('card-preview');
        preview.innerHTML = buildCardHTML(data);
        preview.style.visibility = 'visible';

        // Delay one frame so the DOM is laid out before capture
        requestAnimationFrame(function() {
          html2canvas(preview, {
            scale: 2,
            backgroundColor: '#171a21',
            useCORS: true,
            logging: false
          }).then(function(canvas) {
            var date = new Date().toISOString().slice(0, 10);
            var profileName = data.profile || 'default';
            var link = document.createElement('a');
            link.download = 'agpa-card-' + profileName + '-' + date + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();

            preview.innerHTML = '';
            preview.style.visibility = 'hidden';
            btn.disabled = false;
            btn.textContent = '📸 Share';
          }).catch(function(err) {
            console.error('Card capture failed:', err);
            alert('Failed to generate card. Please try again.');
            preview.innerHTML = '';
            preview.style.visibility = 'hidden';
            btn.disabled = false;
            btn.textContent = '📸 Share';
          });
        });
      })
      .catch(function(err) {
        console.error('Card API failed:', err);
        alert('Failed to load card data. Please try again.');
        btn.disabled = false;
        btn.textContent = '📸 Share';
      });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '📸 Share';
  }
}

function buildCardHTML(data) {
  // ── Helpers ─────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hmColor(level) {
    var colors = ['#1e2529', '#0e4429', '#006d32', '#26a641', '#39d353'];
    return colors[level] || colors[0];
  }

  // ── Header ─────────────────────────────────────────────────
  var html = '';
  html += '<div class="card-header">';
  html += '<div class="card-avatar">' + esc(data.profile_emoji) + '</div>';
  html += '<div>';
  html += '<div class="card-profile-name">' + esc(data.profile) + '</div>';
  html += '<div class="card-level">Agent Level ' + data.level + ' · ' + (data.total_xp || 0).toLocaleString() + ' XP</div>';
  html += '</div>';
  html += '<div class="card-unlocked-stat">';
  html += '<div class="card-unlocked-num">' + data.unlocked + '</div>';
  html += '<div class="card-unlocked-label">/ ' + data.total + ' unlocked</div>';
  html += '</div></div>';

  // ── Stats grid ──────────────────────────────────────────────
  html += '<div class="card-stats-grid">';
  html += '<div class="card-stat"><div class="card-stat-val">' + data.stats.streak_days + '</div><div class="card-stat-label">🔥 streak</div></div>';
  html += '<div class="card-stat"><div class="card-stat-val">' + (data.stats.total_tasks || 0).toLocaleString() + '</div><div class="card-stat-label">📋 tasks</div></div>';
  html += '<div class="card-stat"><div class="card-stat-val">' + (data.stats.total_tool_uses || 0).toLocaleString() + '</div><div class="card-stat-label">🔧 tools</div></div>';
  html += '<div class="card-stat"><div class="card-stat-val">' + (data.stats.total_sessions || 0).toLocaleString() + '</div><div class="card-stat-label">💻 sessions</div></div>';
  html += '</div>';

  // ── XP bar ──────────────────────────────────────────────────
  var xpPct = data.xp_target > 0 ? Math.round((data.xp_current / data.xp_target) * 100) : 0;
  html += '<div class="card-xp-bar">';
  html += '<div class="card-xp-header"><span>Level ' + data.level + '</span><span>' + (data.xp_current || 0).toLocaleString() + ' / ' + (data.xp_target || 1).toLocaleString() + ' XP</span></div>';
  html += '<div class="card-xp-track"><div class="card-xp-fill" style="width:' + xpPct + '%"></div></div>';
  html += '</div>';

  html += '<div class="card-divider"></div>';

  // ── Achievement list ────────────────────────────────────────
  html += '<div class="card-section-title">🏆 ' + (data.achievements.length > 0 ? 'Showcase' : 'Start your journey →') + '</div>';
  html += '<div class="card-ach-list">';

  for (var i = 0; i < data.achievements.length; i++) {
    var ach = data.achievements[i];
    html += '<div class="card-ach-row">';
    html += '<div class="card-ach-left" style="background:' + esc(ach.rarity_color) + ';min-height:auto"></div>';
    html += '<div class="card-ach-icon">' + esc(ach.icon) + '</div>';
    html += '<div class="card-ach-info">';
    html += '<div class="card-ach-name-row">';
    html += '<span class="card-ach-name" style="color:' + esc(ach.rarity_color) + '">' + esc(ach.name) + '</span>';
    html += '<span class="card-ach-tag" style="color:' + esc(ach.rarity_color) + ';background:' + esc(ach.rarity_color) + '22">' + esc(ach.rarity_label) + '</span>';
    html += '</div>';
    html += '<div class="card-ach-desc">' + esc(ach.description) + '</div>';

    if (ach.in_progress) {
      html += '<div class="card-ach-meta" style="margin-bottom:4px">';
      html += '<div class="card-progress-bar" style="flex:1"><div style="height:100%;width:' + (ach.progress_pct || 0) + '%;background:' + esc(ach.rarity_color) + ';border-radius:2px"></div></div>';
      html += '<span style="font-size:9px;color:' + esc(ach.rarity_color) + '">' + esc(ach.progress_text || '') + '</span>';
      html += '</div>';
      html += '<div class="card-ach-meta"><span>In Progress</span></div>';
    } else {
      html += '<div class="card-ach-meta">';
      html += '<span>📅 ' + (ach.unlocked_at ? ach.unlocked_at.slice(0, 10) : '') + '</span>';
      if (ach.set_name) html += '<span>Set: ' + esc(ach.set_name) + (ach.set_progress ? ' (' + esc(ach.set_progress) + ')' : '') + '</span>';
      html += '</div>';
    }

    html += '</div></div>';
  }
  html += '</div>';

  // ── Heatmap ──────────────────────────────────────────────────
  if (data.heatmap && data.heatmap.length > 0) {
    html += '<div class="card-heatmap-box">';
    html += '<div class="card-heatmap-title">📊 Activity · last 4 months</div>';
    html += '<div class="card-heatmap-grid">';
    for (var j = 0; j < data.heatmap.length; j++) {
      var d = data.heatmap[j];
      html += '<div class="card-hm-cell" style="background:' + hmColor(d.count) + '"></div>';
    }
    html += '</div>';
    html += '<div class="card-heatmap-legend"><span>Less</span>';
    html += '<div class="card-hm-cell" style="background:#1e2529"></div><div class="card-hm-cell" style="background:#0e4429"></div><div class="card-hm-cell" style="background:#006d32"></div><div class="card-hm-cell" style="background:#26a641"></div><div class="card-hm-cell" style="background:#39d353"></div>';
    html += '<span>More</span></div>';
    html += '</div>';
  }

  // ── Rarity breakdown ────────────────────────────────────────
  html += '<div class="card-rarity-grid">';
  for (var k = 0; k < data.rarity_breakdown.length; k++) {
    var rb = data.rarity_breakdown[k];
    html += '<div class="card-rarity-item"><div class="card-rarity-label" style="color:' + esc(rb.color) + '">' + esc(rb.rarity) + '</div><div class="card-rarity-count" style="color:' + esc(rb.color) + '">' + rb.count + '</div></div>';
  }
  html += '</div>';

  // ── Milestones ──────────────────────────────────────────────
  if (data.milestones && data.milestones.length > 0) {
    html += '<div class="card-milestone-box">';
    html += '<div class="card-milestone-title">📌 Milestones</div>';
    html += '<div class="card-milestone-list">';
    for (var m = 0; m < data.milestones.length; m++) {
      var ms = data.milestones[m];
      html += '<div class="card-milestone-row">';
      html += '<span class="card-milestone-bullet">✦</span>';
      html += '<span class="card-milestone-date">' + esc(ms.unlocked_at ? ms.unlocked_at.slice(0, 10) : '') + '</span>';
      html += '<span class="card-milestone-name">' + esc(ms.name) + '</span>';
      html += '<span class="card-milestone-rarity" style="color:' + esc(ms.rarity_color) + '">' + esc(ms.rarity) + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  // ── Footer ──────────────────────────────────────────────────
  html += '<div class="card-footer">🎮 Generated by AGPA · agpa v0.1.6 · ' + new Date().toISOString().slice(0, 10) + '</div>';

  return html;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/public/app.js
git commit -m "feat: add generateCard + buildCardHTML for shareable card generation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: ~483 tests pass

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: Quick smoke test — start Dashboard and test API**

Run:
```bash
npm run dashboard &
sleep 2
curl -s http://localhost:3867/api/card | head -c 200
```

Expected: JSON response with `profile`, `level`, `stats`, `achievements`, `heatmap`, `milestones` keys.

- [ ] **Step 4: Push**

```bash
git push origin dev2
```

---

### Task 8: Update CHANGELOG and push

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Insert after the terminal ANSI popup entry at the top of the [0.1.6] section:

```markdown
### Dashboard 分享卡片 — 2026-06-05

- `src/dashboard/api.ts` — 新增 `buildCardResponse()` 函数，聚合 stats + showcase + heatmap + milestones → CardData JSON
- `src/dashboard/server.ts` — 注册 `GET /api/card` 路由
- `src/dashboard/public/index.html` — 新增 📸 Share 按钮 + 隐藏 `#card-preview` DOM + html2canvas CDN
- `src/dashboard/public/styles.css` — 新增卡片预览样式（Steam 深色主题，420px 宽 layout）
- `src/dashboard/public/app.js` — 新增 `generateCard()` + `buildCardHTML()`，html2canvas 截图 + 下载 PNG
- 新增 5 个 API 测试
```

- [ ] **Step 2: Commit and push**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG — shareable achievement card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin dev2
```
