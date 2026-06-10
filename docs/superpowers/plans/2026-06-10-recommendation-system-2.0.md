# Recommendation System 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AGPA's single-dimension "near unlock" recommendation into a 3-class recommendation engine (Near Win, Discovery, Surprise) with 4 contact points: MCP suggest tool, CLI suggest command, Dashboard floating carousel widget, and poll-time recommendation prompt injection.

**Architecture:** Pure functions in `src/utils/recommend.ts` aggregate 3 recommendation types from definitions + events + state. This feeds into MCP tool (STDIO), CLI (terminal output), Dashboard API (HTTP JSON), and `achievement_poll` (probability-gated prompt injection). `progress-nudge.ts` is extended from 5 to 8 condition types for richer Near Win progress calculation.

**Tech Stack:** TypeScript ESM, vitest (no new deps), Zod for MCP tool params, zero-framework Dashboard (HTML/CSS/JS), YAML definitions unchanged.

---

## File Structure

```
src/
├── engine/types.ts                  (改) +RecommendItem, +RecommendResponse, +PollResponse.recommendation_prompt
├── config.ts                         (改) +recommend_probability (default 0.2)
├── utils/
│   ├── progress-nudge.ts            (改) +sequenceProgress, +patternMatchProgress, +ratioProgress
│   └── recommend.ts                  (新) recommendNearWin, recommendDiscovery, recommendSurprise,
│                                          hashString, buildRecommendationPrompt, getDiscoveryReason,
│                                          DISCOVERY_REASON_MAP, selectRecommendContent
├── tools/
│   ├── suggest.ts                   (改) 升级 achievement_suggest → 3 类返回
│   └── poll.ts                      (改) 概率门控 + recommendation_prompt 注入
├── cli/
│   ├── suggest.ts                   (改) CLI 按类别分组 + --near/--discover/--surprise flags
│   └── config.ts                    (改) 支持 recommend_probability 读写
└── dashboard/
    ├── api.ts                        (改) buildApiResponse 内嵌 recommend 到主数据响应
    └── public/
        ├── index.html                (改) widget DOM 结构
        ├── app.js                    (改) widget 初始化 + 轮播逻辑
        └── styles.css                (改) widget 样式 + 脉冲动画

tests/
├── utils/
│   ├── progress-nudge.test.ts       (改) +3 种 type 测试
│   └── recommend.test.ts            (新) 推荐算法 17+ 测试用例
├── tools/
│   └── poll.test.ts                 (改) recommendation_prompt 触发测试
└── cli/
    └── config.test.ts               (改) recommend_probability 读写测试

docs/
└── superpowers/
    └── specs/
        └── 2026-06-10-recommendation-system-2.0-design.md  (已存在，本次不改)
```

---

## Phase 1: Core Algorithms + Types

### Task 1: Add RecommendItem, RecommendResponse types to types.ts

**Files:**
- Modify: `src/engine/types.ts` (append after existing types)

- [ ] **Step 1: Add types at end of types.ts**

```typescript
// ── Recommendation types ───────────────────────────────────────

export type RecommendCategory = 'near_win' | 'discovery' | 'surprise';

export interface RecommendItem {
  category: RecommendCategory;
  achievement_id: string;
  name: string;
  name_cn?: string;
  icon: string;
  rarity: RarityLevel;

  // Near Win 专用
  progress?: { current: number; target: number; pct: number };
  unit_label?: string;

  // Discovery 专用
  discovery_event?: string;
  discovery_reason?: string;

  // Surprise 专用
  hint?: string | null;
  hint_cn?: string | null;
}

export interface RecommendResponse {
  near_win: RecommendItem[];
  discovery: RecommendItem | null;
  surprise: RecommendItem | null;
  generated_at: string;
  session_id?: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npm run build`
Expected: No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add RecommendItem, RecommendResponse types for recommendation system 2.0

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Extend progress-nudge.ts with 3 new condition types

**Files:**
- Modify: `src/utils/progress-nudge.ts` (add 3 functions + update switch in `findNearUnlocks`)

- [ ] **Step 1: Add `sequenceProgress` function** (after `sequenceCountProgress` around line 184)

```typescript
/** Compute partial match progress for ordered sequence conditions */
function sequenceProgress(events: TrackedEvent[], cond: Condition): number | null {
  const pattern = Array.isArray(cond.pattern) ? (cond.pattern as string[]) : null;
  if (!pattern || pattern.length === 0) return null;
  let matched = 0;
  for (const e of events) {
    if (e.event_type === pattern[matched]) {
      matched++;
      if (matched >= pattern.length) return pattern.length; // fully matched
    }
  }
  return matched; // partial match steps
}
```

- [ ] **Step 2: Add `patternMatchProgress` function**

```typescript
/** Estimate progress for pattern_match conditions — count matching events */
function patternMatchProgress(events: TrackedEvent[], cond: Condition): number | null {
  if (!cond.pattern) return null;
  const scoped = scopedEvents(events, cond);
  const hits = scoped.filter(e => matchFilter(e, { pattern: cond.pattern })).length;
  return Math.min(hits, cond.value);
}
```

- [ ] **Step 3: Add `ratioProgress` function**

```typescript
/** Progress for ratio conditions — current numerator value (denominator handled by evaluator) */
function ratioProgress(events: TrackedEvent[], cond: Condition): number | null {
  if (!cond.metric) return null;
  const val = evaluateMetric(cond.metric, events);
  if (val === null || val === undefined) return null;
  return Math.round(val * 1000) / 1000;
}
```

- [ ] **Step 4: Update `findNearUnlocks()` switch statement to add 3 new cases**

In the `switch (cond.type)` block (around line 223), add after the `sequence_count` case:

```typescript
      case 'sequence': {
        const val = sequenceProgress(events, cond);
        if (val === null) continue;
        current = val;
        target = cond.value;
        unitLabel = cond.unit || 'events';
        break;
      }
      case 'pattern_match': {
        const val = patternMatchProgress(events, cond);
        if (val === null) continue;
        current = val;
        target = cond.value;
        unitLabel = cond.unit || 'events';
        break;
      }
      case 'ratio': {
        const val = ratioProgress(events, cond);
        if (val === null) continue;
        current = val;
        target = cond.value;
        unitLabel = cond.unit || cond.metric || 'ratio';
        break;
      }
```

- [ ] **Step 5: Run existing tests to verify no regressions**

Run: `npx vitest run tests/utils/progress-nudge.test.ts`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/progress-nudge.ts
git commit -m "feat: extend progress-nudge to 8 condition types (sequence, pattern_match, ratio)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Create recommend.ts — Discovery algorithm

**Files:**
- Create: `src/utils/recommend.ts`

- [ ] **Step 1: Write the first test for `recommendDiscovery`**

Create file `tests/utils/recommend.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { recommendDiscovery } from '../../src/utils/recommend.js';
import type {
  AchievementDefinition,
  AchievementState,
  TrackedEvent,
} from '../../src/engine/types.js';

// ── Factories ──────────────────────────────────────────────────────

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

function makeState(overrides: Partial<AchievementState> = {}): AchievementState {
  return {
    unlocked: {},
    stats: { total_unlocked: 0 },
    ...overrides,
  };
}

// ── Discovery tests ────────────────────────────────────────────────

describe('recommendDiscovery', () => {
  it('returns achievement whose event type has never been triggered', () => {
    const defs = [
      makeDef({
        id: 'agent_first',
        name: 'Agent First',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        rarity: 'common',
      }),
      makeDef({
        id: 'tool_first',
        name: 'Tool First',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 1 }],
        rarity: 'common',
      }),
    ];
    const events = [makeEvent({ event_type: 'tool.complete' })];

    const result = recommendDiscovery(defs, events, makeState());
    expect(result).not.toBeNull();
    expect(result!.achievement_id).toBe('agent_first');
    expect(result!.category).toBe('discovery');
    expect(result!.discovery_event).toBe('agent.spawn');
  });

  it('returns null when all event types have been triggered', () => {
    const defs = [
      makeDef({
        id: 'tool_first',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 1 }],
      }),
    ];
    const events = [makeEvent({ event_type: 'tool.complete' })];

    const result = recommendDiscovery(defs, events, makeState());
    expect(result).toBeNull();
  });

  it('filters out hidden achievements', () => {
    const defs = [
      makeDef({
        id: 'secret_thing',
        name: 'Secret',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        hidden: true,
      }),
    ];
    const result = recommendDiscovery(defs, [], makeState());
    expect(result).toBeNull(); // only hidden candidate, filtered out
  });

  it('filters out already-unlocked achievements', () => {
    const defs = [
      makeDef({
        id: 'already_got',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
      }),
    ];
    const state = makeState({ unlocked: { already_got: '2026-01-01T00:00:00Z' } });
    const result = recommendDiscovery(defs, [], state);
    expect(result).toBeNull();
  });

  it('prefers lower rarity (Common before Rare)', () => {
    const defs = [
      makeDef({
        id: 'rare_feature',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        rarity: 'rare',
      }),
      makeDef({
        id: 'common_feature',
        conditions: [{ type: 'counter', event: 'mcp.connect', value: 1 }],
        rarity: 'common',
      }),
    ];
    // No events → both agent.spawn and mcp.connect are untriggered
    const result = recommendDiscovery(defs, [], makeState());
    expect(result).not.toBeNull();
    expect(result!.achievement_id).toBe('common_feature'); // Common wins
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: FAIL — `recommendDiscovery` not defined.

- [ ] **Step 3: Implement `recommendDiscovery` in `src/utils/recommend.ts`**

```typescript
import type {
  AchievementDefinition,
  AchievementState,
  RecommendItem,
  TrackedEvent,
  Condition,
} from '../engine/types.js';

// ── Rarity sort order (lower index = preferred) ───────────────────

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

// ── Discovery: event blind-spot ───────────────────────────────────

/**
 * Find one achievement whose primary event type the user has never triggered.
 * Prefers lower rarity, then YAML definition order. Filters hidden + unlocked.
 */
export function recommendDiscovery(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
): RecommendItem | null {
  // 1. Collect all triggered event types
  const triggeredTypes = new Set(events.map(e => e.event_type));

  // 2. Build candidate pool
  const candidates: AchievementDefinition[] = [];
  for (const def of definitions) {
    if (state.unlocked[def.id]) continue;
    if (def.hidden) continue;
    const cond = def.conditions[0];
    if (!cond) continue;
    if (!cond.event) continue;
    if (triggeredTypes.has(cond.event)) continue;
    candidates.push(def);
  }

  if (candidates.length === 0) return null;

  // 3. Sort: rarity priority, then definition order (stable)
  candidates.sort((a, b) => {
    const ra = RARITY_ORDER[a.rarity] ?? 99;
    const rb = RARITY_ORDER[b.rarity] ?? 99;
    return ra - rb;
  });

  const pick = candidates[0]!;
  const cond = pick.conditions[0]!;

  return {
    category: 'discovery',
    achievement_id: pick.id,
    name: pick.name,
    name_cn: pick.name_cn,
    icon: pick.icon || '🔍',
    rarity: pick.rarity,
    discovery_event: cond.event,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: All 5 Discovery tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recommend.ts tests/utils/recommend.test.ts
git commit -m "feat: add recommendDiscovery — event blind-spot algorithm

Recommends achievements whose primary event type the user has
never triggered. Sorted by rarity (common first), hidden + unlocked
achievements filtered out.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Add `hashString` and `recommendSurprise` to recommend.ts

**Files:**
- Modify: `src/utils/recommend.ts` (append functions)
- Modify: `tests/utils/recommend.test.ts` (add Surprise tests)

- [ ] **Step 1: Write Surprise tests**

In `tests/utils/recommend.test.ts`, append after Discovery tests:

```typescript
import { recommendSurprise, hashString } from '../../src/utils/recommend.js';

// ── hashString tests ──────────────────────────────────────────────

describe('hashString', () => {
  it('returns same output for same input', () => {
    expect(hashString('session-abc')).toBe(hashString('session-abc'));
  });

  it('returns different output for different input', () => {
    expect(hashString('session-abc')).not.toBe(hashString('session-xyz'));
  });

  it('returns non-negative integer', () => {
    const h = hashString('test');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

// ── Surprise tests ────────────────────────────────────────────────

describe('recommendSurprise', () => {
  it('returns a deterministic surprise for given sessionId', () => {
    const defs = [
      makeDef({
        id: 'hidden_one',
        name: 'Hidden One',
        hidden: true,
        hint: 'Try something at midnight',
        hint_cn: '午夜时分试一试',
        rarity: 'rare',
      }),
      makeDef({
        id: 'hidden_two',
        name: 'Hidden Two',
        hidden: true,
        hint: 'The early bird catches the worm',
        rarity: 'uncommon',
      }),
    ];
    const state = makeState();
    const result1 = recommendSurprise(defs, state, 'session-123');
    const result2 = recommendSurprise(defs, state, 'session-123');
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.achievement_id).toBe(result2!.achievement_id);
  });

  it('returns null when no hidden achievements available', () => {
    const defs = [
      makeDef({ id: 'not_hidden', hidden: false }),
    ];
    const result = recommendSurprise(defs, makeState(), 'session-123');
    expect(result).toBeNull();
  });

  it('returns null when all hidden are already unlocked', () => {
    const defs = [
      makeDef({ id: 'hidden_ach', hidden: true, hint: 'clue' }),
    ];
    const state = makeState({ unlocked: { hidden_ach: '2026-01-01T00:00:00Z' } });
    const result = recommendSurprise(defs, state, 'session-123');
    expect(result).toBeNull();
  });

  it('filters out hidden achievements without hint', () => {
    const defs = [
      makeDef({ id: 'no_hint', hidden: true }), // no hint field
    ];
    const result = recommendSurprise(defs, makeState(), 'session-123');
    expect(result).toBeNull();
  });

  it('returns item with null name, "?" icon, and non-null hint', () => {
    const defs = [
      makeDef({
        id: 'hidden_surprise',
        name: 'SECRET NAME',
        hidden: true,
        hint: 'A cryptic clue',
        hint_cn: '一个谜之线索',
        description: 'SECRET DESC',
        rarity: 'epic',
      }),
    ];
    const state = makeState();
    const result = recommendSurprise(defs, state, 'session-abc');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('');   // stripped
    expect(result!.name_cn).toBe(''); // stripped
    expect(result!.icon).toBe('?');
    expect(result!.hint).toBe('A cryptic clue');
    expect(result!.hint_cn).toBe('一个谜之线索');
    expect(result!.category).toBe('surprise');
    expect(result!.rarity).toBe('epic');
  });

  it('returns null for future hidden achievements', () => {
    const defs = [
      makeDef({
        id: 'future_secret',
        hidden: true,
        future: true,
        hint: 'coming soon',
      }),
    ];
    const result = recommendSurprise(defs, makeState(), 'session-123');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: FAIL — `recommendSurprise` and `hashString` not defined.

- [ ] **Step 3: Implement `hashString` and `recommendSurprise`**

Append to `src/utils/recommend.ts`:

```typescript
// ── djb2 hash (deterministic, no Math.random / Date.now) ─────────

/**
 * Deterministic hash function (djb2).
 * Same input → same output. Used for session-bound Surprise selection.
 */
export function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0; // 32-bit integer
  }
  return Math.abs(hash);
}

// ── Surprise: deterministic hidden pick ──────────────────────────

/**
 * Pick one hidden achievement with a hint, deterministically bound to sessionId.
 * Returns name/name_cn/description stripped — only hint + rarity + "?" icon exposed.
 */
export function recommendSurprise(
  definitions: AchievementDefinition[],
  state: AchievementState,
  sessionId: string,
): RecommendItem | null {
  const pool = definitions.filter(d =>
    d.hidden === true
    && d.future !== true
    && !state.unlocked[d.id]
    && !!(d.hint_cn || d.hint),
  );

  if (pool.length === 0) return null;

  const index = hashString(sessionId) % pool.length;
  const pick = pool[index]!;

  return {
    category: 'surprise',
    achievement_id: pick.id,
    name: '',
    name_cn: '',
    icon: '?',
    rarity: pick.rarity,
    hint: pick.hint ?? null,
    hint_cn: pick.hint_cn ?? null,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: All tests PASS (5 Discovery + 3 hashString + 6 Surprise = 14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recommend.ts tests/utils/recommend.test.ts
git commit -m "feat: add recommendSurprise + hashString for deterministic hidden recommendations

Uses djb2 hash for session-bound deterministic selection.
Surprise items have name/description stripped, only hint + '?' icon exposed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Add `recommendNearWin` wrap function and `RecommendResponse` builder

**Files:**
- Modify: `src/utils/recommend.ts` (append functions)
- Modify: `tests/utils/recommend.test.ts` (add Near Win + integration tests)

- [ ] **Step 1: Write Near Win and integration tests**

Append to `tests/utils/recommend.test.ts`:

```typescript
import { recommendNearWin, getRecommendResponse } from '../../src/utils/recommend.js';

// ── Near Win tests ───────────────────────────────────────────────

describe('recommendNearWin', () => {
  it('returns top 5 near-unlock achievements', () => {
    const defs = [
      makeDef({
        id: 'ach_a',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
      }),
      makeDef({
        id: 'ach_b',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
      }),
    ];
    const events = Array.from({ length: 8 }, () => makeEvent());
    const result = recommendNearWin(defs, events, makeState());
    expect(result).toHaveLength(2);
    expect(result[0]!.current).toBe(8);
    expect(result[0]!.progress!.pct).toBe(80);
  });

  it('filters out hidden achievements', () => {
    const defs = [
      makeDef({
        id: 'visible',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
      }),
      makeDef({
        id: 'secret_near',
        hidden: true,
        conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
      }),
    ];
    const events = Array.from({ length: 9 }, () => makeEvent());
    const result = recommendNearWin(defs, events, makeState());
    expect(result).toHaveLength(1);
    expect(result[0]!.achievement_id).toBe('visible');
  });
});

// ── Integration tests ─────────────────────────────────────────────

describe('getRecommendResponse', () => {
  it('returns all 3 categories populated when data available', () => {
    const defs = [
      makeDef({
        id: 'ach_1',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
      }),
      makeDef({
        id: 'discover_me',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
      }),
      makeDef({
        id: 'secret_one',
        hidden: true,
        hint: 'mystery',
        hint_cn: '谜',
      }),
    ];
    const events = [
      makeEvent({ event_type: 'tool.complete' }),
      makeEvent({ event_type: 'tool.complete' }),
      makeEvent({ event_type: 'tool.complete' }),
    ];
    const state = makeState();
    const resp = getRecommendResponse(defs, events, state, 'sess-001');

    expect(resp.near_win.length).toBeGreaterThan(0);
    expect(resp.discovery).not.toBeNull();
    expect(resp.surprise).not.toBeNull();
    expect(resp.generated_at).toBeTruthy();
    expect(resp.session_id).toBe('sess-001');
  });

  it('returns null discovery and null surprise when pools are empty', () => {
    const defs: AchievementDefinition[] = [];
    const events: TrackedEvent[] = [];
    const state = makeState();
    const resp = getRecommendResponse(defs, events, state, 'sess-001');

    expect(resp.near_win).toEqual([]);
    expect(resp.discovery).toBeNull();
    expect(resp.surprise).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: FAIL — `recommendNearWin`, `getRecommendResponse` not defined.

- [ ] **Step 3: Implement `recommendNearWin` and `getRecommendResponse`**

Append to `src/utils/recommend.ts`:

```typescript
import { findNearUnlocks, type NearUnlock } from './progress-nudge.js';

// ── Near Win: delegate to progress-nudge ────────────────────────

/**
 * Wrap findNearUnlocks() output as RecommendItem[].
 * Returns top 5 by progress percentage.
 */
export function recommendNearWin(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
): RecommendItem[] {
  const near = findNearUnlocks(definitions, events, state, {
    maxResults: 5,
    minProgress: 0.01,
  });

  return near.map((n: NearUnlock) => ({
    category: 'near_win' as const,
    achievement_id: n.achievement_id,
    name: n.name,
    icon: n.icon,
    rarity: n.rarity,
    progress: {
      current: n.current,
      target: n.target,
      pct: n.target > 0 ? Math.round((n.current / n.target) * 100) : 0,
    },
    unit_label: n.unit_label,
  }));
}

// ── Response builder ─────────────────────────────────────────────

/**
 * Build a full RecommendResponse for all 3 categories.
 * Used by MCP tool, CLI, and Dashboard API.
 * sessionId is required — surrogate is used for deterministic Surprise.
 */
export function getRecommendResponse(
  definitions: AchievementDefinition[],
  events: TrackedEvent[],
  state: AchievementState,
  sessionId: string,
): import('../engine/types.js').RecommendResponse {
  return {
    near_win: recommendNearWin(definitions, events, state),
    discovery: recommendDiscovery(definitions, events, state),
    surprise: recommendSurprise(definitions, state, sessionId),
    generated_at: new Date().toISOString(),
    session_id: sessionId,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: All tests PASS (14 previous + 2 Near Win + 2 integration = 18 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recommend.ts tests/utils/recommend.test.ts
git commit -m "feat: add recommendNearWin wrap + getRecommendResponse builder

recommendNearWin delegates to findNearUnlocks (extended to 8 types).
getRecommendResponse aggregates all 3 categories into a single response.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 2: MCP + CLI + Poll Recommendation Prompt

### Task 6: Upgrade `achievement_suggest` MCP tool

**Files:**
- Modify: `src/tools/suggest.ts`

- [ ] **Step 1: Rewrite `src/tools/suggest.ts` to use recommend.ts**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { getRecommendResponse } from '../utils/recommend.js';
import { loadConfig } from '../config.js';

// ── Unit label i18n (kept from old suggest.ts) ────────────────────

const UNIT_EN: Record<string, string> = {
  sessions: 'sessions', tasks: 'tasks', 'tool uses': 'tool uses',
  messages: 'messages', prompts: 'prompts', agents: 'agents',
  skills: 'skills', connections: 'connections', commands: 'commands',
  events: 'events', days: 'days', edits: 'edits',
  commits: 'commits', pushes: 'pushes', mcp_connects: 'connections',
  achievements: 'achievements',
};

const UNIT_ZH: Record<string, string> = {
  sessions: '个会话', tasks: '个任务', 'tool uses': '次工具调用',
  messages: '条消息', prompts: '次提示', agents: '个Agent',
  skills: '个技能', connections: '次连接', commands: '条命令',
  events: '个事件', days: '天', edits: '次编辑',
  commits: '次提交', pushes: '次推送', mcp_connects: '次连接',
  achievements: '个成就',
};

function translateUnit(unit: string, lang: 'en' | 'zh'): string {
  const map = lang === 'zh' ? UNIT_ZH : UNIT_EN;
  return map[unit] || unit;
}

// ── Category labels ───────────────────────────────────────────────

const CATEGORY_LABELS_EN: Record<string, string> = { near_win: 'Near Win', discovery: 'Discovery', surprise: 'Surprise' };
const CATEGORY_LABELS_ZH: Record<string, string> = { near_win: '近在咫尺', discovery: '探索发现', surprise: '神秘彩蛋' };

// ── Tool registration ─────────────────────────────────────────────

export function registerSuggestTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement_suggest',
    'Return personalized achievement recommendations. Call periodically after the user completes work. Weave a natural mention if something is >75% complete.',
    {
      categories: z.array(z.enum(['near_win', 'discovery', 'surprise'])).optional()
        .describe('Filter to specific recommendation categories. Omit for all 3.'),
      max_results: z.number().int().min(1).max(10).default(5)
        .describe('Maximum near_win suggestions (only affects near_win category).'),
      min_progress: z.number().min(0).max(1).default(0.01)
        .describe('Minimum completion ratio for near_win (0.0–1.0).'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ categories, max_results, min_progress }) => {
      const engine = getEngine();
      const cfg = loadConfig();
      const lang: 'en' | 'zh' = cfg.lang === 'zh' ? 'zh' : 'en';

      const resp = getRecommendResponse(
        engine.definitions,
        engine.events,
        engine.state,
        engine.stateDir, // surrogate sessionId from stateDir
      );

      // Filter by categories if requested
      const wantsAll = !categories || categories.length === 0;
      const result: Record<string, unknown> = {};

      if (wantsAll || categories.includes('near_win')) {
        // Apply max_results + min_progress filters (only to near_win)
        let nw = resp.near_win;
        nw = nw.filter(item => (item.progress?.pct ?? 0) / 100 >= (min_progress ?? 0.01));
        nw = nw.slice(0, max_results ?? 5);
        result.near_win = nw.map(item => ({
          ...item,
          unit_label: item.unit_label ? translateUnit(item.unit_label, lang) : undefined,
        }));
      }

      if (wantsAll || categories.includes('discovery')) {
        result.discovery = resp.discovery;
      }

      if (wantsAll || categories.includes('surprise')) {
        result.surprise = resp.surprise;
      }

      result.generated_at = resp.generated_at;
      result.session_id = resp.session_id;

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/suggest.ts
git commit -m "feat: upgrade achievement_suggest to 3-class recommendation

Returns near_win + discovery + surprise from getRecommendResponse.
Supports categories filter for backward compatibility.
Kept old max_results/min_progress filters applied to near_win only.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Upgrade `agpa suggest` CLI

**Files:**
- Modify: `src/cli/suggest.ts`

- [ ] **Step 1: Rewrite `src/cli/suggest.ts` to support 3 categories**

```typescript
#!/usr/bin/env node
/**
 * AGPA Suggest CLI — 3-class achievement recommendations
 *
 * Usage:
 *   agpa suggest                  All 3 categories
 *   agpa suggest --near           Near Win only
 *   agpa suggest --discover       Discovery only
 *   agpa suggest --surprise       Surprise only
 *   agpa suggest --N 10           Top 10 near wins
 *   agpa suggest --json           JSON output
 *   agpa suggest --hidden         Include hidden in near_win
 */

import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import { getRecommendResponse } from '../utils/recommend.js';
import { R, B, D, RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

const RARITY_LABELS = RARITY_LABELS_EN;

// ── Argument parsing ─────────────────────────────────────────────

interface SuggestOptions {
  filter: 'all' | 'near' | 'discover' | 'surprise';
  count: number;
  includeHidden: boolean;
  json: boolean;
  profile: string | null;
}

function parseArgs(args: string[]): SuggestOptions {
  const opts: SuggestOptions = {
    filter: 'all', count: 5, includeHidden: false, json: false, profile: null,
  };
  let explicitFilter = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case '--json': opts.json = true; break;
      case '--near': opts.filter = 'near'; explicitFilter = true; break;
      case '--discover': opts.filter = 'discover'; explicitFilter = true; break;
      case '--surprise': opts.filter = 'surprise'; explicitFilter = true; break;
      case '--profile': {
        const v = args[++i];
        if (v) opts.profile = v;
        break;
      }
      case '--hidden': opts.includeHidden = true; break;
      case '--all': {
        opts.count = 999;
        // --all without explicit filter implies 'all' categories
        if (!explicitFilter) opts.filter = 'all';
        break;
      }
      case '--N':
      case '-n': {
        const v = args[++i];
        const n = parseInt(v ?? '', 10);
        if (isNaN(n) || n < 1 || n > 999) {
          console.error('--N requires a number between 1-999');
          process.exit(1);
        }
        opts.count = n;
        break;
      }
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
    }
  }

  return opts;
}

// ── Rendering ────────────────────────────────────────────────────

function renderBar(current: number, target: number, width: number): string {
  const frac = target > 0 ? current / target : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  const green = '\x1b[38;2;100;200;100m';
  const gray = '\x1b[38;2;60;60;60m';
  return `${green}${'█'.repeat(Math.min(filled, width))}${gray}${'░'.repeat(Math.max(0, empty))}${R}`;
}

// ── Main ─────────────────────────────────────────────────────────

function main(): void {
  const opts = parseArgs(process.argv.slice(3));

  const resolvedProfile = opts.profile || loadConfig().active_profile || DEFAULT_PROFILE;
  const stateDir = resolvedProfile !== 'default' ? resolveProfileDir(resolvedProfile) : undefined;
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();
  const unlockedCount = Object.keys(engine.state.unlocked).length;

  const resp = getRecommendResponse(
    engine.definitions,
    engine.events,
    engine.state,
    engine.stateDir || 'default',
  );

  // ── JSON output ────────────────────────────────────────────────
  if (opts.json) {
    const output: Record<string, unknown> = { generated_at: resp.generated_at };
    if (opts.filter === 'all' || opts.filter === 'near') {
      output.near_win = resp.near_win.slice(0, opts.count).map(n => ({
        achievement_id: n.achievement_id, name: n.name, icon: n.icon, rarity: n.rarity,
        current: n.progress?.current, target: n.progress?.target,
        progress_pct: n.progress?.pct ?? 0, unit_label: n.unit_label,
      }));
    }
    if (opts.filter === 'all' || opts.filter === 'discover') output.discovery = resp.discovery;
    if (opts.filter === 'all' || opts.filter === 'surprise') output.surprise = resp.surprise;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // ── Text output ────────────────────────────────────────────────
  console.log(`\n${B}🪐  AGPA 推荐中心${R}  ${D}──  ${unlockedCount}/${engine.definitions.length} unlocked${R}\n`);

  // Near Win
  if (opts.filter === 'all' || opts.filter === 'near') {
    console.log(`${B}🎯 Near Win  (${Math.min(resp.near_win.length, opts.count)})${R}`);
    const shown = resp.near_win.slice(0, opts.count);
    if (shown.length === 0) {
      console.log(`  ${D}No near-unlock achievements with meaningful progress yet.${R}\n`);
    } else {
      for (const n of shown) {
        const color = RARITY_COLORS[n.rarity] || '';
        const pct = String(n.progress?.pct ?? 0).padStart(2) + '%';
        const bar = renderBar(n.progress?.current ?? 0, n.progress?.target ?? 1, 16);
        console.log(`  ${B}${pct}${R} ${color}${n.icon} ${n.name}${R}`);
        console.log(`       ${color}${RARITY_LABELS[n.rarity] || n.rarity}${R} ${D}—${R} ${D}${n.progress?.current ?? 0} / ${n.progress?.target ?? '?'} ${n.unit_label || ''}${R}`);
        console.log(`       ${bar}  ${color}${pct}${R}\n`);
      }
    }
  }

  // Discovery
  if (opts.filter === 'all' || opts.filter === 'discover') {
    console.log(`${B}🔍 Discovery${R}`);
    if (!resp.discovery) {
      console.log(`  ${D}No undiscovered features — you've tried everything!${R}\n`);
    } else {
      const d = resp.discovery;
      const color = RARITY_COLORS[d.rarity] || '';
      console.log(`  ${color}${d.icon} ${d.name}${R}  (${RARITY_LABELS[d.rarity] || d.rarity})`);
      console.log(`  ${D}→${R} ${d.discovery_event ? `Event: ${d.discovery_event}` : ''}\n`);
    }
  }

  // Surprise
  if (opts.filter === 'all' || opts.filter === 'surprise') {
    console.log(`${B}🎲 Surprise${R}`);
    if (!resp.surprise) {
      console.log(`  ${D}No hidden hints available right now.${R}\n`);
    } else {
      const s = resp.surprise;
      console.log(`  ??? — "${s.hint || s.hint_cn || ''}"\n`);
    }
  }

  console.log(`💡 ${D}Run 'agpa suggest --near' / '--discover' / '--surprise' to filter.${R}\n`);
}

main();
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/cli/suggest.ts
git commit -m "feat: upgrade agpa suggest CLI to 3-class recommendation

Now shows Near Win + Discovery + Surprise sections.
New flags: --near, --discover, --surprise for filtering.
Backward compatible: no flags shows all 3 categories.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Add `recommend_probability` config

**Files:**
- Modify: `src/config.ts`
- Modify: `src/utils/validate.ts`
- Modify: `src/cli/config.ts`

- [ ] **Step 1: Add `recommend_probability` to `AppConfig` and defaults**

In `src/config.ts`, add to the `AppConfig` interface after `banner_theme`:

```typescript
  recommend_probability: number;
```

In `DEFAULTS` constant, add:

```typescript
  recommend_probability: 0.2,
```

- [ ] **Step 2: Update `appConfigSchema` in `src/utils/validate.ts`**

Add after `banner_theme` line:

```typescript
  recommend_probability: z.number().min(0).max(1).default(0.2),
```

- [ ] **Step 3: Add `recommend_probability` CLI handler in `src/cli/config.ts`**

In `main()` function, add a new case after the `banner` case:

```typescript
    case 'recommend_probability':
    case 'rp': {
      if (!value) {
        console.error('Usage: agpa config recommend_probability <0.0-1.0>');
        process.exit(1);
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 1) {
        console.error('recommend_probability must be between 0.0 and 1.0');
        process.exit(1);
      }
      saveConfig({ recommend_probability: num });
      const pct = Math.round(num * 100);
      console.log(`✅ Recommendation probability set to ${num} (${pct}%)`);
      break;
    }
```

Also update the `showConfig()` function to display it:

```typescript
  console.log(`  ${B}recommend_prob${R}     ${cfg.recommend_probability}`);
```

And update the help section in `showConfig()`:

```typescript
    console.log(`    ${C}agpa config recommend_probability <0.0-1.0>${R}  ${D}Recommend probability${R}`);
```

- [ ] **Step 4: Verify build + test**

Run: `npm run build`
Expected: No TypeScript errors.

Run: `npx vitest run tests/cli/config.test.ts --reporter=verbose`
Expected: Existing config tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/utils/validate.ts src/cli/config.ts
git commit -m "feat: add recommend_probability config (default 0.2)

Configurable via agpa config recommend_probability <0.0-1.0>.
Controls how often poll injects recommendation prompts after unlocks.
0.0 = never, 1.0 = every unlock. Stored in config.json.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Add `buildRecommendationPrompt` and `DISCOVERY_REASON_MAP` to recommend.ts

**Files:**
- Modify: `src/utils/recommend.ts` (append)
- Modify: `tests/utils/recommend.test.ts` (add prompt tests)

- [ ] **Step 1: Add test for `buildRecommendationPrompt`**

Append to `tests/utils/recommend.test.ts`:

```typescript
import { buildRecommendationPrompt, getDiscoveryReason, DISCOVERY_REASON_MAP } from '../../src/utils/recommend.js';
import type { RecommendItem } from '../../src/engine/types.js';

describe('DISCOVERY_REASON_MAP', () => {
  it('has entries for common event types', () => {
    expect(DISCOVERY_REASON_MAP['agent.spawn']).toBeDefined();
    expect(DISCOVERY_REASON_MAP['skill.invoke']).toBeDefined();
    expect(DISCOVERY_REASON_MAP['mcp.connect']).toBeDefined();
  });

  it('getDiscoveryReason returns reason for known event', () => {
    const reason = getDiscoveryReason('agent.spawn', 'zh');
    expect(reason).toBe('你还没用过 Agent 模式');
  });

  it('getDiscoveryReason returns fallback for unknown event', () => {
    const reason = getDiscoveryReason('unknown.event', 'en');
    expect(reason).toBe('a new feature');
  });
});

describe('buildRecommendationPrompt', () => {
  it('builds surprise prompt (zh)', () => {
    const item: RecommendItem = {
      category: 'surprise', achievement_id: 'x', name: '', icon: '?',
      rarity: 'rare', hint: null, hint_cn: '夜深人静时...',
    };
    const prompt = buildRecommendationPrompt(item, 'zh');
    expect(prompt).toContain('🎲 探索提示');
    expect(prompt).toContain('夜深人静时...');
    expect(prompt).toContain('不要暴露成就名称');
  });

  it('builds surprise prompt (en)', () => {
    const item: RecommendItem = {
      category: 'surprise', achievement_id: 'x', name: '', icon: '?',
      rarity: 'rare', hint: 'at midnight...',
    };
    const prompt = buildRecommendationPrompt(item, 'en');
    expect(prompt).toContain('🎲 Discovery hint');
    expect(prompt).toContain('at midnight...');
    expect(prompt).toContain('Do NOT reveal');
  });

  it('builds discovery prompt', () => {
    const item: RecommendItem = {
      category: 'discovery', achievement_id: 'y',
      name: 'MCP Explorer', name_cn: 'MCP探索者', icon: '🔌',
      rarity: 'uncommon', discovery_event: 'mcp.connect',
    };
    const prompt = buildRecommendationPrompt(item, 'en');
    expect(prompt).toContain('💡 Feature discovery');
    expect(prompt).toContain('MCP Explorer');
  });

  it('builds near_win prompt', () => {
    const item: RecommendItem = {
      category: 'near_win', achievement_id: 'z',
      name: 'First Edit', icon: '📝', rarity: 'common',
      progress: { current: 8, target: 10, pct: 80 },
    };
    const prompt = buildRecommendationPrompt(item, 'en');
    expect(prompt).toContain('🎯 Near win');
    expect(prompt).toContain('80%');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: FAIL — `buildRecommendationPrompt`, `getDiscoveryReason`, `DISCOVERY_REASON_MAP` not exported.

- [ ] **Step 3: Implement `DISCOVERY_REASON_MAP`, `getDiscoveryReason`, `buildRecommendationPrompt`**

Append to `src/utils/recommend.ts`:

```typescript
// ── Discovery reason mapping ─────────────────────────────────────

export const DISCOVERY_REASON_MAP: Record<string, { en: string; zh: string }> = {
  'agent.spawn':   { en: "You haven't tried Agent mode yet", zh: '你还没用过 Agent 模式' },
  'skill.invoke':  { en: "You haven't used Custom Skills yet", zh: '你还没用过自定义技能' },
  'mcp.connect':   { en: "You haven't connected an MCP server", zh: '你还没连接过 MCP 服务器' },
  'plan.enter':    { en: "You haven't used Plan Mode yet", zh: '你还没用过计划模式' },
  'plan.exit':     { en: "You haven't used Plan Mode yet", zh: '你还没用过计划模式' },
  'file.create':   { en: "You haven't created any files yet", zh: '你还没创建过文件' },
  'file.edit':     { en: "You haven't edited any files yet", zh: '你还没编辑过文件' },
  'file.delete':   { en: "You haven't deleted any files yet", zh: '你还没删除过文件' },
  'image.upload':  { en: "You haven't uploaded any images yet", zh: '你还没上传过图片' },
  'command.run':   { en: "You haven't run any commands yet", zh: '你还没运行过命令' },
  'task.create':   { en: "You haven't created any tasks yet", zh: '你还没创建过任务' },
  'task.update':   { en: "You haven't updated any tasks yet", zh: '你还没更新过任务' },
};

export function getDiscoveryReason(eventType: string, lang: 'en' | 'zh'): string {
  const entry = DISCOVERY_REASON_MAP[eventType];
  if (!entry) return lang === 'zh' ? '一个你未曾尝试过的新功能' : 'a new feature';
  return entry[lang];
}

// ── Poll prompt builder ──────────────────────────────────────────

/**
 * Build a pre-written natural language prompt for the Agent to follow.
 * The Agent reads this and naturally weaves the recommendation into its reply.
 */
export function buildRecommendationPrompt(
  item: import('../engine/types.js').RecommendItem,
  lang: 'en' | 'zh',
): string {
  if (item.category === 'surprise') {
    return lang === 'zh'
      ? `🎲 探索提示: ${item.hint_cn || item.hint}\n\n在回复结尾，用一句自然的话引导用户注意这条线索。不要暴露成就名称或具体条件——保持神秘感。`
      : `🎲 Discovery hint: ${item.hint}\n\nAt the end of your reply, naturally guide the user toward this clue. Do NOT reveal the achievement name or unlock conditions — keep it mysterious.`;
  }
  if (item.category === 'discovery') {
    const reason = getDiscoveryReason(item.discovery_event!, lang);
    return lang === 'zh'
      ? `💡 新功能推荐: ${item.name_cn || item.name} — ${reason}\n\n在回复结尾，用一句自然的话引导用户尝试这个他们还没用过的功能。`
      : `💡 Feature discovery: ${item.name} — ${reason}\n\nAt the end of your reply, naturally suggest the user try this feature they haven't explored yet.`;
  }
  // near_win
  const pct = item.progress?.pct ?? 0;
  return lang === 'zh'
    ? `🎯 近在咫尺: ${item.name_cn || item.name}（已完成 ${pct}%）\n\n在回复结尾，用一句自然的话提醒用户这个成就近在眼前，鼓励加把劲解锁它。`
    : `🎯 Near win: ${item.name}（${pct}% complete）\n\nAt the end of your reply, naturally remind the user this achievement is close and encourage them to push for it.`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/utils/recommend.test.ts --reporter=verbose`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recommend.ts tests/utils/recommend.test.ts
git commit -m "feat: add buildRecommendationPrompt + DISCOVERY_REASON_MAP

Pre-written natural language prompts for the 4th contact point (poll injection).
DISCOVERY_REASON_MAP maps event types to human-readable discovery reasons
in both zh and en.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Integrate probability-gated recommendation prompt into `achievement_poll`

**Files:**
- Modify: `src/tools/poll.ts`

- [ ] **Step 1: Rewrite `src/tools/poll.ts` with recommendation prompt logic**

```typescript
import * as fs from 'fs';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { formatAchievement } from '../helpers.js';
import { loadConfig } from '../config.js';
import { getRecommendResponse, buildRecommendationPrompt } from '../utils/recommend.js';

function loadPending(stateDir: string): unknown[] {
  const pendingPath = `${stateDir}/pending.json`;
  try {
    if (fs.existsSync(pendingPath)) {
      return JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function savePending(stateDir: string, pending: unknown[]): void {
  const pendingPath = `${stateDir}/pending.json`;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
}

/**
 * Select the best recommendation for poll prompt.
 * Priority: Surprise > Discovery > Near Win top1
 */
function selectRecommendContent(resp: ReturnType<typeof getRecommendResponse>) {
  if (resp.surprise) return resp.surprise;
  if (resp.discovery) return resp.discovery;
  if (resp.near_win.length > 0) return resp.near_win[0]!;
  return null;
}

export function registerPollTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.poll',
    'Evaluate all achievement conditions against event history. Returns newly unlocked achievements (max 5 at a time). May include a recommendation_prompt suggesting next achievements if new unlocks occurred.',
    {
      acknowledged_ids: z.array(z.string()).optional().describe('IDs of previously shown achievements to acknowledge, clearing pending queue slots for new ones'),
      limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum achievements to return'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ acknowledged_ids, limit }) => {
      const engine = getEngine();
      const ack: string[] = Array.isArray(acknowledged_ids) ? acknowledged_ids as string[] : [];
      const maxResults = (limit as number) || 5;
      const cfg = loadConfig();
      const lang: 'en' | 'zh' = cfg.lang === 'zh' ? 'zh' : 'en';

      let pending = loadPending(engine.stateDir);

      // Remove acknowledged
      if (ack.length > 0) {
        pending = pending.filter((a: any) => !ack.includes(a.id));
      }

      // Return from pending first
      if (pending.length > 0) {
        const batch = pending.slice(0, maxResults);
        const rest = pending.slice(maxResults);
        savePending(engine.stateDir, rest);
        // No recommendation prompt for pending (no new unlocks this round)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              achievements: batch.map((a: any) => formatAchievement(engine, a)),
              has_more: rest.length > 0,
            }),
          }],
        };
      }

      const newlyUnlocked = engine.poll();

      if (newlyUnlocked.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ achievements: [], has_more: false }) }],
        };
      }

      const batch = newlyUnlocked.slice(0, maxResults);
      const rest = newlyUnlocked.slice(maxResults);
      if (rest.length > 0) savePending(engine.stateDir, rest);

      // ── Recommendation prompt (double gate) ─────────────────────
      let recommendationPrompt: string | undefined;

      // Gate 1: must have new unlocks
      // Gate 2: probability check (configurable, default 0.2)
      const p = cfg.recommend_probability ?? 0.2;
      if (p > 0 && Math.random() < p) {
        const resp = getRecommendResponse(
          engine.definitions,
          engine.events,
          engine.state,
          engine.stateDir || 'default',
        );
        const content = selectRecommendContent(resp);
        if (content) {
          recommendationPrompt = buildRecommendationPrompt(content, lang);
        }
      }

      const pollResponse: Record<string, unknown> = {
        achievements: batch.map(a => formatAchievement(engine, a)),
        has_more: rest.length > 0,
      };

      if (recommendationPrompt) {
        pollResponse.recommendation_prompt = recommendationPrompt;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(pollResponse),
        }],
      };
    },
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/poll.ts
git commit -m "feat: add probability-gated recommendation prompt to achievement_poll

Double gate: newlyUnlocked > 0 AND Math.random() < recommend_probability.
Priority: Surprise > Discovery > Near Win top1.
Poll response now includes recommendation_prompt field when triggered.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Run full test suite + build to verify Phase 1–2

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All 1043+ tests pass (existing + new recommend tests).

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit (if any minor fix needed)**

Only if tests/build revealed issues. Otherwise skip.

---

## Phase 3: Dashboard Floating Widget

### Task 12: Add widget DOM structure to index.html

**Files:**
- Modify: `src/dashboard/public/index.html`

- [ ] **Step 1: Add widget HTML before closing `</body>` tag**

Insert right before `</body>`:

```html
  <!-- Recommendation floating widget -->
  <div id="recommend-widget" class="recommend-widget collapsed">
    <button id="recommend-toggle" class="recommend-toggle" aria-label="Open recommendations" title="Explore recommendations">
      ✨
    </button>
    <div id="recommend-panel" class="recommend-panel" style="display:none">
      <div class="recommend-header">
        <span class="recommend-title" data-i18n="recommend_title">探索</span>
        <button class="recommend-close" aria-label="Close" onclick="closeRecommendWidget()">✕</button>
      </div>
      <div class="recommend-carousel">
        <div class="carousel-track" id="carousel-track">
          <!-- JS 动态注入 3 frames -->
        </div>
      </div>
      <div class="carousel-dots" id="carousel-dots"></div>
    </div>
  </div>
```

- [ ] **Step 2: Add i18n strings for widget (if needed later, pre-register keys)**

No code changes needed — i18n keys like `recommend_title`, `recommend_near_win` etc. will be added in Task 14 alongside JS.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/public/index.html
git commit -m "feat: add recommendation widget DOM to dashboard

Floating widget container: collapsed pulse badge + expandable
carousel panel. JS injects 3 frames dynamically.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Add widget CSS to styles.css

**Files:**
- Modify: `src/dashboard/public/styles.css`

- [ ] **Step 1: Append widget styles at end of styles.css**

```css
/* ── Recommendation Floating Widget ────────────────────────────── */

#recommend-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
}

/* Collapsed state: pulse badge */
.recommend-toggle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--primary);
  background: var(--surface);
  cursor: pointer;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: recommend-pulse 2s ease-in-out infinite;
  transition: transform 0.15s ease;
  line-height: 1;
  padding: 0;
}

.recommend-toggle:hover {
  transform: scale(1.08);
}

@keyframes recommend-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 195, 247, 0.5); }
  50%      { box-shadow: 0 0 0 12px rgba(79, 195, 247, 0); }
}

/* Expanded panel */
.recommend-panel {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 280px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  animation: panel-in 0.2s ease-out;
}

@keyframes panel-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.recommend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.recommend-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  font-family: 'Lexend', 'Plus Jakarta Sans', sans-serif;
}

.recommend-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 4px;
  border-radius: 4px;
}

.recommend-close:hover { color: var(--text-primary); }

/* Carousel */
.recommend-carousel {
  overflow: hidden;
}

.carousel-track {
  display: flex;
  transition: transform 0.35s ease;
}

.carousel-frame {
  min-width: 100%;
  padding: 14px;
  box-sizing: border-box;
  text-align: center;
}

.frame-icon {
  font-size: 2rem;
  margin-bottom: 4px;
}

.frame-category {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  font-family: 'Lexend', 'Plus Jakarta Sans', sans-serif;
  margin-bottom: 2px;
}

.frame-reason {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.frame-item {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  text-align: left;
}

.frame-ach-icon {
  font-size: 1.2rem;
  margin-bottom: 2px;
}

.frame-ach-name {
  font-weight: 600;
  font-size: 0.82rem;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.frame-ach-rarity {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.frame-ach-rarity.common    { color: var(--rarity-common); }
.frame-ach-rarity.uncommon  { color: var(--rarity-uncommon); }
.frame-ach-rarity.rare      { color: var(--rarity-rare); }
.frame-ach-rarity.epic      { color: var(--rarity-epic); }
.frame-ach-rarity.legendary { color: var(--rarity-legendary); }
.frame-ach-rarity.mythic    { color: var(--rarity-mythic); }

.frame-ach-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.frame-ach-progress .progress-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.frame-ach-progress .progress-bar-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.frame-ach-progress span {
  font-size: 0.75rem;
  color: var(--text-muted);
  min-width: 32px;
  text-align: right;
}

/* Surprise frame tweaks */
.frame-item.surprise {
  text-align: center;
  font-style: italic;
}

/* Carousel dots */
.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 8px 0 12px;
}

.carousel-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;
}

.carousel-dot.active {
  background: var(--primary);
}

/* Responsive: don't overlap on small screens */
@media (max-width: 480px) {
  #recommend-widget {
    bottom: 12px;
    right: 12px;
  }
  .recommend-panel {
    width: 260px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/public/styles.css
git commit -m "feat: add recommendation widget CSS — pulse badge, carousel, responsive

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Add widget JS logic to app.js

**Files:**
- Modify: `src/dashboard/public/app.js`

- [ ] **Step 1: Add i18n keys for widget**

In the `I18N_EN` object (around line 401), add:

```javascript
    recommend_title: 'Explore',
    recommend_near_win: 'These are closest to unlocking',
    recommend_discovery: 'A feature you haven\'t tried yet',
    recommend_surprise: 'A mysterious clue awaits...',
    recommend_no_near: 'No near-unlock achievements yet',
    recommend_no_discovery: 'You\'ve tried all features!',
    recommend_no_surprise: 'No hidden hints right now',
```

And in `I18N_ZH` (around line 509), add:

```javascript
    recommend_title: '探索',
    recommend_near_win: '这些成就近在咫尺',
    recommend_discovery: '一个你未曾尝试的功能',
    recommend_surprise: '一条神秘的线索在等你...',
    recommend_no_near: '暂无接近解锁的成就',
    recommend_no_discovery: '你已体验过所有功能！',
    recommend_no_surprise: '暂时没有神秘线索',
```

- [ ] **Step 2: Add widget initialization function** (append to app.js)

```javascript
// ── Recommendation Widget ──────────────────────────────

const CAROUSEL_INTERVAL = 5000; // 5s auto-rotate
let carouselIndex = 0;
let carouselTimer = null;
let carouselFrameCount = 0;

function initRecommendWidget() {
  const toggle = document.getElementById('recommend-toggle');
  const panel = document.getElementById('recommend-panel');
  const close = document.querySelector('.recommend-close');

  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const widget = document.getElementById('recommend-widget');
    const isCollapsed = widget.classList.contains('collapsed');

    if (isCollapsed) {
      widget.classList.remove('collapsed');
      panel.style.display = 'block';
      toggle.style.display = 'none';
      // Fetch recommend data and start carousel
      fetch('/api/data?include_recommend=true&profile=' + (currentProfile || 'default'))
        .then(r => r.json())
        .then(data => {
          if (data.recommend) startCarousel(data.recommend);
        })
        .catch(() => {}); // silent fail, widget just shows empty
    }
  });

  // Close button: stop carousel, hide panel, show toggle
  panel.addEventListener('click', (e) => {
    if (e.target.classList.contains('recommend-close')) {
      closeRecommendWidget();
    }
  });
}

function closeRecommendWidget() {
  const widget = document.getElementById('recommend-widget');
  const panel = document.getElementById('recommend-panel');
  const toggle = document.getElementById('recommend-toggle');
  if (!widget || !panel || !toggle) return;

  stopCarousel();
  widget.classList.add('collapsed');
  panel.style.display = 'none';
  toggle.style.display = 'flex';
}

function startCarousel(recommendData) {
  stopCarousel();
  buildCarouselFrames(recommendData);
  carouselIndex = 0;
  showFrame(0);

  if (carouselFrameCount > 1) {
    carouselTimer = setInterval(() => {
      carouselIndex = (carouselIndex + 1) % carouselFrameCount;
      showFrame(carouselIndex);
    }, CAROUSEL_INTERVAL);
  }
}

function stopCarousel() {
  if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
}

function buildCarouselFrames(data) {
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  if (!track || !dots) return;

  track.innerHTML = '';
  dots.innerHTML = '';
  carouselFrameCount = 0;

  const frames = [];

  // Near Win frame
  if (data.near_win && data.near_win.length > 0) {
    const top = data.near_win[0];
    frames.push(createFrame({
      icon: '🎯',
      category: t('recommend_near_win'),
      reason: t('recommend_near_win'),
      item: {
        icon: top.icon || '🏆',
        name: top.name_cn || top.name,
        rarity: top.rarity,
        progress: top.progress,
      },
    }));
  }

  // Discovery frame
  if (data.discovery) {
    const d = data.discovery;
    frames.push(createFrame({
      icon: '🔍',
      category: 'Discovery',
      reason: t('recommend_discovery'),
      item: {
        icon: d.icon || '🔌',
        name: d.name_cn || d.name,
        rarity: d.rarity,
        progress: null,
      },
    }));
  }

  // Surprise frame
  if (data.surprise) {
    const s = data.surprise;
    frames.push(createFrame({
      icon: '🎲',
      category: 'Surprise',
      reason: t('recommend_surprise'),
      item: {
        icon: '?',
        name: (s.hint_cn || s.hint || '???'),
        rarity: s.rarity,
        progress: null,
        isSurprise: true,
      },
    }));
  }

  frames.forEach((f, i) => {
    f.dataset.index = i;
    track.appendChild(f);
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', 'Frame ' + (i + 1));
    dot.addEventListener('click', () => { carouselIndex = i; showFrame(i); });
    dots.appendChild(dot);
  });

  carouselFrameCount = frames.length;
}

function createFrame(cfg) {
  const frame = document.createElement('div');
  frame.className = 'carousel-frame';

  let itemHTML = '';
  const item = cfg.item;
  if (item.isSurprise) {
    itemHTML = '<div class="frame-item surprise">' +
      '<div style="font-size:1.5rem;margin-bottom:4px">❓</div>' +
      '<div style="color:var(--text-primary);font-size:0.82rem;font-style:italic">' + escHtml(item.name) + '</div>' +
      '<div class="frame-ach-rarity ' + item.rarity + '" style="margin-top:4px">' + item.rarity + '</div>' +
      '</div>';
  } else if (item.progress) {
    const pct = item.progress.pct || 0;
    itemHTML = '<div class="frame-item">' +
      '<div class="frame-ach-icon">' + escHtml(item.icon) + '</div>' +
      '<div class="frame-ach-name">' + escHtml(item.name) + '</div>' +
      '<div class="frame-ach-rarity ' + item.rarity + '">' + item.rarity + '</div>' +
      '<div class="frame-ach-progress">' +
        '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span>' + pct + '%</span>' +
      '</div>' +
      '</div>';
  } else {
    itemHTML = '<div class="frame-item">' +
      '<div class="frame-ach-icon">' + escHtml(item.icon) + '</div>' +
      '<div class="frame-ach-name">' + escHtml(item.name) + '</div>' +
      '<div class="frame-ach-rarity ' + item.rarity + '">' + item.rarity + '</div>' +
      '</div>';
  }

  frame.innerHTML =
    '<div class="frame-icon">' + cfg.icon + '</div>' +
    '<div class="frame-category">' + escHtml(cfg.category) + '</div>' +
    '<div class="frame-reason">' + escHtml(cfg.reason) + '</div>' +
    itemHTML;

  return frame;
}

function showFrame(index) {
  const track = document.getElementById('carousel-track');
  const dots = document.querySelectorAll('.carousel-dot');
  if (!track) return;

  track.style.transform = 'translateX(-' + (index * 100) + '%)';
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

// Pause carousel on panel hover
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('recommend-panel');
  if (panel) {
    panel.addEventListener('mouseenter', () => stopCarousel());
    panel.addEventListener('mouseleave', () => {
      if (carouselFrameCount > 1 && carouselIndex >= 0) {
        carouselTimer = setInterval(() => {
          carouselIndex = (carouselIndex + 1) % carouselFrameCount;
          showFrame(carouselIndex);
        }, CAROUSEL_INTERVAL);
      }
    });
  }
});
```

- [ ] **Step 2: Call `initRecommendWidget()` from the main DOMContentLoaded handler**

Find the existing `DOMContentLoaded` listener (around line 67-80), add at the end:

```javascript
  initRecommendWidget();
```

- [ ] **Step 3: Ensure `escHtml` utility exists**

Check if `escHtml` function already exists in app.js:

```javascript
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
```

If not present, add it before the widget code.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/public/app.js
git commit -m "feat: add recommendation widget JS — carousel, i18n, fetch

3-frame carousel with 5s auto-rotate, dot indicators, hover pause.
Fetches recommend data from /api/data?include_recommend=true.
i18n keys for all widget labels in en/zh.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: Embed recommend data into Dashboard API response

**Files:**
- Modify: `src/dashboard/api.ts`
- Modify: `src/dashboard/server.ts` (read query param)

- [ ] **Step 1: Add `recommend` field to `buildApiResponse`**

In `buildApiResponse()` function in `src/dashboard/api.ts`, add import at top:

```typescript
import { getRecommendResponse } from '../utils/recommend.js';
import type { RecommendResponse } from '../engine/types.js';
```

Change function signature to accept optional opts — add `opts` as 8th parameter with default `{}`:

```typescript
export function buildApiResponse(
  definitions: AchievementDefinition[],
  state: AchievementState,
  events: TrackedEvent[],
  showcaseData: Array<{ slot: number; achievement: AchievementItem | null }>,
  engineStats: { total_events: number; by_category: Record<string, { total: number; unlocked: number }>; by_rarity: Record<string, { total: number; unlocked: number }> },
  setDefinitions: SetDefinition[],
  toolStats?: AgentToolStats,
  opts?: { includeRecommend?: boolean },
): DashboardData {
```

Before the `return` statement (~line 560), compute recommend:

```typescript
  const recommend = (opts?.includeRecommend)
    ? getRecommendResponse(definitions, events, state, 'dashboard')
    : undefined;
```

In the return object, add after `config: { lang: loadConfig().lang },`:

```typescript
      config: { lang: loadConfig().lang },
      ...(recommend ? { recommend } : {}),
```

- [ ] **Step 2: Add `recommend` to `DashboardData` type**

In the `DashboardData` interface (around line 126 of api.ts), add:

```typescript
  recommend?: RecommendResponse;
```

- [ ] **Step 3: Update server.ts to pass includeRecommend flag**

In `src/dashboard/server.ts`, find the two `buildApiResponse(...)` calls. For the main GET handler (around line 229), read the query param:

```typescript
      const includeRecommend = url.searchParams.get('include_recommend') === 'true';
```

Then pass it:

```typescript
      const data = buildApiResponse(
        engine.definitions,
        engine.state,
        engine.events,
        showcaseData,
        engine.stats(),
        engine.setDefinitions,
        engine.toolStats(),
        { includeRecommend },
      );
```

The second callsite (line 493, share-card handler) doesn't need recommend data — it already passes 7 args, which will default `opts` to `undefined`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/api.ts src/dashboard/server.ts
git commit -m "feat: embed recommend data into Dashboard API response

/api/data?include_recommend=true returns recommend field with
all 3 recommendation categories. Optional parameter avoids
unnecessary computation for non-widget consumers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 16: Run full test suite + final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass with no regressions.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Review diff**

Run: `git diff --stat`
Check that all changed/new files match the plan.

- [ ] **Step 4: Commit any final fixes**

Only if needed.

---

## Summary

| Phase | Tasks | Files Created | Files Modified |
|------|-------|--------------|---------------|
| Phase 1 | Tasks 1–5 | 1 (`recommend.ts`), 1 test | 2 (`types.ts`, `progress-nudge.ts`) |
| Phase 2 | Tasks 6–11 | 0 | 5 (`suggest.ts` MCP, `suggest.ts` CLI, `config.ts`, `validate.ts`, `poll.ts`) |
| Phase 3 | Tasks 12–16 | 0 | 5 (`index.html`, `styles.css`, `app.js`, `api.ts`, `server.ts`) |
| **Total** | **16 tasks** | **2 files** | **12 files** |

**Test coverage**: 18+ new unit tests in `tests/utils/recommend.test.ts`, no change to existing test count (except test files themselves).
