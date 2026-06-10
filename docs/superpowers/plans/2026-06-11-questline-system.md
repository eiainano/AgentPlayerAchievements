# Questline System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organize 203 achievements into 5 RPG questlines (3 stages each) with Dashboard progress cards between Achievements and Sets tabs.

**Architecture:** YAML `questlines:` block → `parseYAML()` → `engine.questlineDefinitions` → `buildQuestlinesResponse()` → Dashboard. Pure query layer — no engine/evaluator changes. Each questline is a 3-stage linear progression; a single achievement can belong to multiple questlines.

**Tech Stack:** TypeScript ESM, vitest, YAML (authoritative source), zero-framework Dashboard (HTML/CSS/JS), no new deps.

---

## File Structure

```
src/
├── engine/types.ts                  (改) +StageDefinition, +QuestlineDefinition interface
├── engine/yaml-parser.ts            (改) parseYAML() return +questlines, parseQuestlines()
├── engine/engine.ts                 (改) +questlineDefinitions field, init() loads parsed.questlines
├── dashboard/
│   ├── api.ts                       (改) +buildQuestlinesResponse(), DashboardData +questlines
│   └── public/
│       ├── index.html               (改) +nav link + <section id="questlines">
│       ├── app.js                   (改) +renderQuestlines(), +i18n keys, +renderSafe() call
│       └── styles.css               (改) +questline card styles (~90 lines)
└── (no change to evaluator, store, tools)

achievement-definitions.yaml         (改) +questlines: block (~300 lines)
tests/
├── engine/yaml-parser.test.ts       (改) +questline parsing tests
└── dashboard/api.test.ts            (改) +questline response tests
```

---

## Phase 1: YAML Data + Types + Parsing

### Task 1: Add StageDefinition, QuestlineDefinition types

**Files:**
- Modify: `src/engine/types.ts` (append after existing types, before "Recommendation types")

- [ ] **Step 1: Append types to types.ts**

Read the end of `src/engine/types.ts`, find where recommendation types were appended. Insert BEFORE the recommendation types section (around line 248):

```typescript
// ── Questline types ──────────────────────────────────────────

export interface StageDefinition {
  stage: number;
  name: string;
  name_cn: string;
  achievements: string[];
}

export interface QuestlineDefinition {
  id: string;
  name: string;
  name_cn: string;
  icon: string;
  description: string;
  description_cn: string;
  stages: StageDefinition[];
  reward: SetReward;
}
```

`SetReward` is already defined at line ~217: `{ type: SetRewardType; value: string; }`. The import is already in scope — no additional imports needed.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No new TypeScript errors (2 pre-existing hook.ts errors unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add StageDefinition, QuestlineDefinition types for questline system

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Add questlines YAML block to achievement-definitions.yaml

**Files:**
- Modify: `achievement-definitions.yaml` (append at end)

- [ ] **Step 1: Append the questlines block**

Read the last line of `achievement-definitions.yaml`, then append this block:

```yaml
# ═══════════════════════════════════════════════════════════════
# Questlines — 5 RPG growth paths, 3 stages each
# ═══════════════════════════════════════════════════════════════

questlines:
  # ── Bug Hunter ──────────────────────────────────────────────
  - id: bug_hunter
    name: "Bug Hunter"
    name_cn: "除虫大师"
    icon: "🐛"
    description: "From your first bug to debugging mastery"
    description_cn: "从第一只 bug 到调试艺术的掌控者"
    reward:
      type: title
      value: "Elite Bug Hunter"
      value_cn: "精英除虫师"
    stages:
      - stage: 1
        name: "Rookie Exterminator"
        name_cn: "实习除虫员"
        achievements: [error_resilient, the_debugger, diagnostic_detective]
      - stage: 2
        name: "Seasoned Hunter"
        name_cn: "老练猎手"
        achievements: [self_healer, sisyphus, mitosis, chain_reaction]
      - stage: 3
        name: "Debugging Legend"
        name_cn: "调试传说"
        achievements: [surgeon, iterative_refiner, power_session]

  # ── Toolsmith ───────────────────────────────────────────────
  - id: toolsmith
    name: "Toolsmith"
    name_cn: "工具匠人"
    icon: "🔧"
    description: "Master the tools that shape your workflow"
    description_cn: "精进工具，塑造你的工作流"
    reward:
      type: title
      value: "Master Toolsmith"
      value_cn: "工具大师"
    stages:
      - stage: 1
        name: "Apprentice"
        name_cn: "学徒"
        achievements: [mcp_first_contact, task_creator, permission_granted]
      - stage: 2
        name: "Journeyman"
        name_cn: "熟练工"
        achievements: [mcp_first_connect, task_updater, automode_first, dashboard_visitor]
      - stage: 3
        name: "Master Craftsman"
        name_cn: "匠人大师"
        achievements: [full_auto, the_scheduler, architect]

  # ── Builder ─────────────────────────────────────────────────
  - id: builder
    name: "Builder"
    name_cn: "建造大师"
    icon: "🏗️"
    description: "From hello world to shipping production code"
    description_cn: "从 Hello World 到交付生产代码"
    reward:
      type: title
      value: "Master Builder"
      value_cn: "建造大师"
    stages:
      - stage: 1
        name: "Apprentice Builder"
        name_cn: "建造学徒"
        achievements: [tool_time, file_centurion, first_shot]
      - stage: 2
        name: "Journeyman Builder"
        name_cn: "建造熟手"
        achievements: [dual_wielder, double_digits, century, multi_image_day]
      - stage: 3
        name: "Master Builder"
        name_cn: "建造大师"
        achievements: [millennium, marathon, test_centurion, polyglot]

  # ── Night Shift ─────────────────────────────────────────────
  - id: night_shift
    name: "Night Shift"
    name_cn: "夜行者"
    icon: "🌙"
    description: "Burn the midnight oil, push through the long sessions"
    description_cn: "熬夜奋战，马拉松式编码之旅"
    reward:
      type: title
      value: "Night Owl"
      value_cn: "暗夜猫头鹰"
    stages:
      - stage: 1
        name: "After Hours"
        name_cn: "深夜初探"
        achievements: [first_sunrise, model_hopper]
      - stage: 2
        name: "Night Owl"
        name_cn: "夜猫子"
        achievements: [streak_3, streak_7, half_century]
      - stage: 3
        name: "Nocturnal Legend"
        name_cn: "暗夜传说"
        achievements: [streak_30, token_1m, wake_up_samurai]

  # ── Polyglot ────────────────────────────────────────────────
  - id: polyglot
    name: "Polyglot"
    name_cn: "语言通才"
    icon: "🌐"
    description: "Speak every language the machine understands"
    description_cn: "通晓机器语言的万国之民"
    reward:
      type: title
      value: "True Polyglot"
      value_cn: "语言通才"
    stages:
      - stage: 1
        name: "Hello World"
        name_cn: "初识世界"
        achievements: [first_contact, three_company, read_manual]
      - stage: 2
        name: "Code Explorer"
        name_cn: "代码探索者"
        achievements: [visual_prompt, worktree_trial, seeker]
      - stage: 3
        name: "Linguistic Master"
        name_cn: "语言大师"
        achievements: [full_spectrum, attention_is_all_you_need, test_champion]
```

- [ ] **Step 2: Verify YAML parses**

Run: `npx tsx -e "import * as fs from 'fs'; import { parseYAML } from './src/engine/yaml-parser.js'; const y = fs.readFileSync('achievement-definitions.yaml','utf-8'); const r = parseYAML(y); console.log('defs:', r.definitions.length, 'sets:', r.sets.length);"`
Expected: Prints `defs: 203 sets: 11` (questlines not parsed yet — that's Task 3).

- [ ] **Step 3: Commit**

```bash
git add achievement-definitions.yaml
git commit -m "feat: add 5 questlines YAML block (Bug Hunter, Toolsmith, Builder, Night Shift, Polyglot)

3 stages each, ~49 unique achievements covered across 5 growth paths.
Achievements can belong to multiple questlines.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Parse questlines in yaml-parser.ts

**Files:**
- Modify: `src/engine/yaml-parser.ts`

- [ ] **Step 1: Update parseYAML return type and function body**

Change the function signature (line 78) from:
```typescript
export function parseYAML(text: string): { definitions: AchievementDefinition[]; sets: SetDefinition[] } {
```
to:
```typescript
export function parseYAML(text: string): { definitions: AchievementDefinition[]; sets: SetDefinition[]; questlines: QuestlineDefinition[] } {
```

Add import at top (line 2):
```typescript
import type { AchievementDefinition, Condition, ConditionType, PixelArt, PixelArtSize, SetDefinition, SetRewardType, QuestlineDefinition, StageDefinition } from './types.js';
```

Replace the raw parse line (line 79) to also capture `questlines`:
```typescript
  const raw = YAML.parse(text) as {
    definitions?: Array<Record<string, unknown>>;
    sets?: Record<string, Record<string, unknown>>;
    questlines?: Array<Record<string, unknown>>;
  } | null;
```

After the sets parsing block (after line 137), add questline parsing:

```typescript
  // Parse questlines
  const questlines: QuestlineDefinition[] = [];
  if (raw.questlines && Array.isArray(raw.questlines)) {
    for (const qRaw of raw.questlines) {
      const id = typeof qRaw.id === 'string' ? qRaw.id : null;
      if (!id) throw new Error('Questline is missing "id"');

      const stagesRaw = Array.isArray(qRaw.stages) ? qRaw.stages : [];
      const stages: StageDefinition[] = stagesRaw.map((s: Record<string, unknown>, si: number) => {
        if (typeof s.stage !== 'number') throw new Error(`Questline "${id}" stage ${si}: missing "stage" number`);
        return {
          stage: s.stage as number,
          name: typeof s.name === 'string' ? s.name : `Stage ${si + 1}`,
          name_cn: typeof s.name_cn === 'string' ? s.name_cn : `第${si + 1}阶段`,
          achievements: Array.isArray(s.achievements) && s.achievements.every((x: unknown) => typeof x === 'string')
            ? s.achievements as string[] : [],
        };
      });

      const rewardRaw = qRaw.reward as Record<string, unknown> | undefined;
      const rewardType = typeof rewardRaw?.type === 'string' ? rewardRaw.type : null;
      const rewardValue = typeof rewardRaw?.value === 'string' ? rewardRaw.value : '';

      questlines.push({
        id,
        name: typeof qRaw.name === 'string' ? qRaw.name : id,
        name_cn: typeof qRaw.name_cn === 'string' ? qRaw.name_cn : undefined,
        icon: typeof qRaw.icon === 'string' ? qRaw.icon : '🧭',
        description: typeof qRaw.description === 'string' ? qRaw.description : '',
        description_cn: typeof qRaw.description_cn === 'string' ? qRaw.description_cn : undefined,
        stages,
        reward: {
          type: rewardType && VALID_REWARD_TYPES.has(rewardType) ? rewardType as SetRewardType : 'badge',
          value: rewardValue,
        },
      });
    }
  }
```

Update the return statement (line 139) from:
```typescript
  return { definitions, sets };
```
to:
```typescript
  return { definitions, sets, questlines };
```

- [ ] **Step 2: Verify build + parse**

Run: `npm run build`
Expected: No new TypeScript errors.

Run: `npx tsx -e "import * as fs from 'fs'; import { parseYAML } from './src/engine/yaml-parser.js'; const y = fs.readFileSync('achievement-definitions.yaml','utf-8'); const r = parseYAML(y); console.log('questlines:', r.questlines.length, 'stages:', r.questlines.map(q => q.stages.length).join(','), 'total_achs:', r.questlines.reduce((s, q) => s + q.stages.reduce((ss, st) => ss + st.achievements.length, 0), 0));"`
Expected: Prints `questlines: 5 stages: 3,3,3,3,3 total_achs: ~49`

- [ ] **Step 3: Commit**

```bash
git add src/engine/yaml-parser.ts
git commit -m "feat: parse questlines YAML block in parseYAML()

Returns { definitions, sets, questlines } now. Questlines parsed
into QuestlineDefinition[] with stages, achievements, and rewards.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Add questlineDefinitions to engine.ts

**Files:**
- Modify: `src/engine/engine.ts`

- [ ] **Step 1: Add questlineDefinitions field and init loading**

Add field after `setDefinitions` (line 41):
```typescript
  questlineDefinitions: QuestlineDefinition[] = [];
```

Add import at top (line 2 area):
```typescript
import type { QuestlineDefinition } from './types.js';
```

In `init()` method, after `this.setDefinitions = parsed.sets;` (line 81), add:
```typescript
    this.questlineDefinitions = parsed.questlines;
```

In `reloadDefinitions()` method (around line 283), after `this.setDefinitions = parsed.sets;`, add:
```typescript
    this.questlineDefinitions = parsed.questlines;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/engine.ts
git commit -m "feat: load questlineDefinitions from YAML into engine

engine.questlineDefinitions populated during init() and reloadDefinitions().

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Add yaml-parser questline tests

**Files:**
- Modify: `tests/engine/yaml-parser.test.ts`

- [ ] **Step 1: Add questline parsing test**

Read existing test patterns in `tests/engine/yaml-parser.test.ts`, then append:

```typescript
describe('questlines parsing', () => {
  it('parses questlines with stages and achievements', () => {
    const yaml = `
definitions:
  - id: test_ach
    name: Test
    icon: "🧪"
    category: test
    rarity: common
    conditions:
      - type: counter
        event: tool.complete
        value: 1

questlines:
  - id: test_quest
    name: "Test Quest"
    icon: "🐛"
    description: "A test questline"
    stages:
      - stage: 1
        name: "Stage One"
        achievements: [test_ach]
      - stage: 2
        name: "Stage Two"
        achievements: []
    reward:
      type: title
      value: "Test Title"
`;
    const result = parseYAML(yaml);
    expect(result.questlines).toHaveLength(1);
    const q = result.questlines[0]!;
    expect(q.id).toBe('test_quest');
    expect(q.name).toBe('Test Quest');
    expect(q.icon).toBe('🐛');
    expect(q.stages).toHaveLength(2);
    expect(q.stages[0]!.stage).toBe(1);
    expect(q.stages[0]!.achievements).toEqual(['test_ach']);
    expect(q.reward.type).toBe('title');
    expect(q.reward.value).toBe('Test Title');
  });

  it('returns empty questlines array when YAML has no questlines block', () => {
    const yaml = `
definitions:
  - id: test_ach
    name: Test
    icon: "🧪"
    category: test
    rarity: common
    conditions:
      - type: counter
        event: tool.complete
        value: 1
`;
    const result = parseYAML(yaml);
    expect(result.questlines).toEqual([]);
  });

  it('validates real achievement-definitions.yaml has 5 questlines', () => {
    const fs = require('fs');
    const yaml = fs.readFileSync('achievement-definitions.yaml', 'utf-8');
    const result = parseYAML(yaml);
    expect(result.questlines).toHaveLength(5);
    for (const q of result.questlines) {
      expect(q.stages.length).toBe(3);
      const totalAchs = q.stages.reduce((s, st) => s + st.achievements.length, 0);
      expect(totalAchs).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/engine/yaml-parser.test.ts --reporter=verbose`
Expected: All tests pass (existing + 3 new).

- [ ] **Step 3: Commit**

```bash
git add tests/engine/yaml-parser.test.ts
git commit -m "test: add questline parsing tests (3 new test cases)

Verifies: questline parsing, empty questlines fallback, real YAML has 5 questlines.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 2: Dashboard API + Frontend

### Task 6: Add buildQuestlinesResponse() to api.ts

**Files:**
- Modify: `src/dashboard/api.ts`

- [ ] **Step 1: Add QuestlineItem type and buildQuestlinesResponse function**

Add after the `DashboardData` interface (around line 126, before `buildAchievementsResponse`):

```typescript
export interface QuestlineStageItem {
  stage: number;
  name: string;
  name_cn?: string;
  achievements: Array<{
    id: string;
    name: string;
    name_cn?: string;
    icon: string;
    rarity: RarityLevel;
    unlocked: boolean;
  }>;
  completed: number;
  total: number;
}

export interface QuestlineItem {
  id: string;
  name: string;
  name_cn?: string;
  icon: string;
  description: string;
  description_cn?: string;
  stages: QuestlineStageItem[];
  unlocked_count: number;
  total_count: number;
  current_stage: number;
  current_stage_name: string;
  current_stage_name_cn?: string;
  completed: boolean;
  reward: SetReward;
  reward_earned: boolean;
}
```

Add the `buildQuestlinesResponse` function (before `buildSetsResponse`, around line 410):

```typescript
export function buildQuestlinesResponse(
  questlineDefinitions: QuestlineDefinition[],
  definitions: AchievementDefinition[],
  state: AchievementState,
): QuestlineItem[] {
  if (!questlineDefinitions || questlineDefinitions.length === 0) return [];

  const defMap = new Map(definitions.map(d => [d.id, d]));

  const items: QuestlineItem[] = questlineDefinitions.map(q => {
    let totalCount = 0;
    let unlockedCount = 0;
    let currentStage = 1;
    let currentStageName = q.stages[0]?.name || 'Stage 1';
    let currentStageNameCn = q.stages[0]?.name_cn || '第1阶段';

    const stages: QuestlineStageItem[] = q.stages.map(stage => {
      let stageUnlocked = 0;
      const stageAchs = stage.achievements.map(achId => {
        const def = defMap.get(achId);
        const unlocked = !!state.unlocked[achId];
        if (unlocked) stageUnlocked++;
        return {
          id: achId,
          name: def?.name || achId,
          name_cn: def?.name_cn,
          icon: def?.icon || '🏆',
          rarity: def?.rarity || 'common',
          unlocked,
        };
      });

      totalCount += stageAchs.length;
      unlockedCount += stageUnlocked;

      return {
        stage: stage.stage,
        name: stage.name,
        name_cn: stage.name_cn,
        achievements: stageAchs,
        completed: stageUnlocked,
        total: stageAchs.length,
      };
    });

    // Determine current stage: first incomplete stage, or last if all done
    for (const s of stages) {
      if (s.completed < s.total) {
        currentStage = s.stage;
        currentStageName = s.name;
        currentStageNameCn = s.name_cn;
        break;
      }
      // If this stage is complete and it's the last one, stay on last stage
      if (s.stage === stages.length) {
        currentStage = s.stage;
        currentStageName = s.name;
        currentStageNameCn = s.name_cn;
      }
    }

    const completed = unlockedCount === totalCount && totalCount > 0;

    return {
      id: q.id,
      name: q.name,
      name_cn: q.name_cn,
      icon: q.icon,
      description: q.description,
      description_cn: q.description_cn,
      stages,
      unlocked_count: unlockedCount,
      total_count: totalCount,
      current_stage: currentStage,
      current_stage_name: currentStageName,
      current_stage_name_cn: currentStageNameCn,
      completed,
      reward: q.reward,
      reward_earned: completed,
    };
  });

  // Sort by completion percentage descending
  items.sort((a, b) => {
    const pa = a.total_count > 0 ? a.unlocked_count / a.total_count : 0;
    const pb = b.total_count > 0 ? b.unlocked_count / b.total_count : 0;
    return pb - pa;
  });

  return items;
}
```

- [ ] **Step 2: Update DashboardData and buildApiResponse**

In `DashboardData` interface, add:
```typescript
  questlines?: QuestlineItem[];
```

In `buildApiResponse()`, add `questlineDefinitions` parameter after `setDefinitions`:
```typescript
  setDefinitions: SetDefinition[],
  questlineDefinitions?: QuestlineDefinition[],
```

Before the return statement (after the recommend block), add:
```typescript
  const questlines = questlineDefinitions
    ? buildQuestlinesResponse(questlineDefinitions, definitions, state)
    : undefined;
```

In the return object, add after `recommend` spread:
```typescript
      ...(recommend ? { recommend } : {}),
      ...(questlines ? { questlines } : {}),
```

Import `QuestlineDefinition` at top:
```typescript
import type { RecommendResponse, QuestlineDefinition, SetReward } from '../engine/types.js';
```

- [ ] **Step 3: Update server.ts to pass questlineDefinitions**

In `src/dashboard/server.ts`, find both `buildApiResponse(...)` calls.

For the main GET handler (around line 229):
```typescript
      const data = buildApiResponse(
        engine.definitions, engine.state, engine.events,
        showcaseData, engine.stats(), engine.setDefinitions,
        engine.toolStats(), { includeRecommend },
      );
```
Add `engine.questlineDefinitions` as the 8th parameter (before toolStats):
```typescript
      const data = buildApiResponse(
        engine.definitions, engine.state, engine.events,
        showcaseData, engine.stats(), engine.setDefinitions,
        engine.questlineDefinitions, engine.toolStats(),
        { includeRecommend },
      );
```

For the second call (line 495, share-card): add `engine.questlineDefinitions` similarly.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/api.ts src/dashboard/server.ts
git commit -m "feat: add buildQuestlinesResponse() + questlines to Dashboard API

/api/data now returns questlines array with stage progress, current stage,
and completion status. Sorted by completion percentage descending.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Add API questline response tests

**Files:**
- Modify: `tests/dashboard/api.test.ts`

- [ ] **Step 1: Add questline response test**

Find existing test patterns in `tests/dashboard/api.test.ts`, append:

```typescript
describe('buildQuestlinesResponse', () => {
  it('builds questline items with stage progress', () => {
    const defs: AchievementDefinition[] = [
      { id: 'ach_a', name: 'A', description: '', icon: '🌟', category: 'test', rarity: 'common', conditions: [] },
      { id: 'ach_b', name: 'B', description: '', icon: '🌟', category: 'test', rarity: 'common', conditions: [] },
      { id: 'ach_c', name: 'C', description: '', icon: '🌟', category: 'test', rarity: 'common', conditions: [] },
    ];
    const qDefs: QuestlineDefinition[] = [{
      id: 'test_quest',
      name: 'Test Quest',
      icon: '🐛',
      description: 'A test',
      stages: [
        { stage: 1, name: 'S1', name_cn: 'S1', achievements: ['ach_a', 'ach_b'] },
        { stage: 2, name: 'S2', name_cn: 'S2', achievements: ['ach_c'] },
      ],
      reward: { type: 'title', value: 'Winner' },
    }];
    const state = makeState({ unlocked: { ach_a: '2026-01-01T00:00:00Z' } });
    const result = buildQuestlinesResponse(qDefs, defs, state);
    expect(result).toHaveLength(1);
    expect(result[0]!.unlocked_count).toBe(1);
    expect(result[0]!.total_count).toBe(3);
    expect(result[0]!.current_stage).toBe(1); // stage 1 incomplete
    expect(result[0]!.completed).toBe(false);
  });

  it('returns empty array when no questline definitions', () => {
    const result = buildQuestlinesResponse([], [], makeState());
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/dashboard/api.test.ts --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/dashboard/api.test.ts
git commit -m "test: add questline API response tests

Verifies stage progress calculation, completion detection, empty fallback.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Add nav tab + section HTML to index.html

**Files:**
- Modify: `src/dashboard/public/index.html`

- [ ] **Step 1: Add nav link**

After the achievements nav link (around line 53):
```html
        <a href="#questlines" class="nav-link" data-section="questlines" data-i18n="nav_questlines">Quests</a>
```

- [ ] **Step 2: Add section container**

After `</section>` of achievements (around line 246, right before `<!-- Sets -->`):
```html

  <!-- Questlines -->
  <section id="questlines" class="section">
    <div class="section-header">
      <h2 data-i18n="section_questlines">Questlines</h2>
    </div>
    <p class="section-desc" data-i18n="questlines_desc">Your growth path</p>
    <div class="questlines-stack" id="questlines-stack"></div>
  </section>

```

- [ ] **Step 3: Update nav observer in app.js**

In `app.js`, find the observer section list (around line 1025):
```javascript
  const sections = ['profile', 'achievements', 'sets', 'timeline', 'insights'];
```
Change to:
```javascript
  const sections = ['profile', 'achievements', 'questlines', 'sets', 'timeline', 'insights'];
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/public/index.html src/dashboard/public/app.js
git commit -m "feat: add Questlines nav tab + section between Achievements and Sets

Nav order: Profile → Achievements → Questlines → Sets → Timeline → Insights.
Intersection observer updated to track new section.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Add questline card CSS to styles.css

**Files:**
- Modify: `src/dashboard/public/styles.css` (append at end)

- [ ] **Step 1: Append questline styles**

```css
/* ── Questlines ─────────────────────────────────────────────── */

.questlines-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.questline-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.questline-card:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 12px rgba(79, 195, 247, 0.15);
}

.questline-card.complete {
  border-color: var(--gold);
}

.questline-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.questline-card-icon {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.questline-card-info {
  flex: 1;
  min-width: 0;
}

.questline-card-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
  font-family: 'Lexend', 'Plus Jakarta Sans', sans-serif;
}

.questline-card-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.questline-card-meta {
  text-align: right;
  flex-shrink: 0;
  min-width: 120px;
}

.questline-card-stage {
  font-weight: 600;
  font-size: 0.82rem;
  color: var(--text-primary);
}

.questline-card-progress {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.questline-card-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}

.questline-card-bar-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.questline-card.complete .questline-card-bar-fill {
  background: var(--gold);
}

/* Expanded stages */
.questline-stages {
  display: none;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.questline-card.expanded .questline-stages {
  display: block;
}

.questline-stage {
  margin-bottom: 10px;
}

.questline-stage-header {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.questline-stage-achs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.questline-ach-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  border: 1px solid var(--border);
  background: var(--bg);
}

.questline-ach-badge.unlocked {
  border-color: var(--primary);
  opacity: 1;
}

.questline-ach-badge.locked {
  opacity: 0.45;
}

.questline-ach-badge .ach-icon {
  font-size: 0.85rem;
}

/* Reward display (completed only) */
.questline-reward {
  margin-top: 10px;
  padding: 6px 10px;
  background: linear-gradient(135deg, rgba(255,200,0,0.1), rgba(168,88,240,0.05));
  border: 1px solid var(--gold);
  border-radius: 8px;
  font-size: 0.78rem;
  color: var(--gold);
  text-align: center;
  font-weight: 600;
}

/* Responsive */
@media (max-width: 768px) {
  .questline-card-header {
    flex-direction: column;
  }
  .questline-card-meta {
    text-align: left;
    min-width: auto;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/public/styles.css
git commit -m "feat: add questline card CSS (expandable stages, gold completion)

Horizontal progress cards with expand-on-click for 3-stage detail view.
Completed questlines get gold border + reward display.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Add renderQuestlines() + i18n to app.js

**Files:**
- Modify: `src/dashboard/public/app.js`

- [ ] **Step 1: Add i18n keys**

In `I18N_EN` object (search for `section_sets`), add:
```javascript
    nav_questlines: 'Quests',
    section_questlines: 'Questlines',
    questlines_desc: 'Your growth path',
    questlines_stage: 'Stage',
    questlines_reward: 'Reward',
    questlines_complete: 'Complete!',
```

In `I18N_ZH` object, add:
```javascript
    nav_questlines: '旅程',
    section_questlines: '旅程',
    questlines_desc: '你的成长之路',
    questlines_stage: '第',
    questlines_reward: '奖励',
    questlines_complete: '全部完成！',
```

- [ ] **Step 2: Add renderSafe call**

Find the renderSafe calls (search for `renderSets`), add before it:
```javascript
  renderSafe('questlines', () => renderQuestlines(data));
```

- [ ] **Step 3: Add renderQuestlines function**

Append after `renderSets` function:

```javascript
// ── Questlines ─────────────────────────────────────────

function renderQuestlines(data) {
  const stack = document.getElementById('questlines-stack');
  if (!stack) return;

  if (!data.questlines || data.questlines.length === 0) {
    stack.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🧭</span><div class="empty-state-text">No quests defined yet.</div></div>`;
    return;
  }

  stack.innerHTML = data.questlines.map(ql => {
    const pct = ql.total_count > 0 ? Math.round((ql.unlocked_count / ql.total_count) * 100) : 0;
    const complete = ql.completed;
    const stageName = currentLang === 'zh' ? (ql.current_stage_name_cn || `第${ql.current_stage}阶段`) : ql.current_stage_name;
    const displayNameQl = currentLang === 'zh' && ql.name_cn ? ql.name_cn : ql.name;
    const displayDesc = currentLang === 'zh' && ql.description_cn ? ql.description_cn : ql.description;

    // Build expanded stage detail
    const stagesHtml = ql.stages.map(s => {
      const stageNameStr = currentLang === 'zh' ? (s.name_cn || s.name) : s.name;
      const achsHtml = s.achievements.map(a =>
        `<div class="questline-ach-badge ${a.unlocked ? 'unlocked' : 'locked'}">` +
          `<span class="ach-icon">${a.unlocked ? escHtml(a.icon) : '○'}</span>` +
          `<span>${escHtml(currentLang === 'zh' && a.name_cn ? a.name_cn : a.name)}</span>` +
        `</div>`
      ).join('');
      return `<div class="questline-stage">
        <div class="questline-stage-header">${t('questlines_stage')} ${s.stage}: ${escHtml(stageNameStr)} — ${s.completed}/${s.total}</div>
        <div class="questline-stage-achs">${achsHtml}</div>
      </div>`;
    }).join('');

    const rewardHtml = complete && ql.reward && ql.reward.value
      ? `<div class="questline-reward">${t('questlines_reward')}: ${escHtml(currentLang === 'zh' && ql.reward.value_cn ? ql.reward_value_cn : ql.reward.value)}</div>`
      : '';

    // Fix reward value_cn access
    const rewardText = complete && ql.reward && ql.reward.value
      ? (currentLang === 'zh' && ql.reward_value_cn ? ql.reward_value_cn : ql.reward.value)
      : null;

    return `<div class="questline-card ${complete ? 'complete' : ''}" onclick="toggleQuestlineCard(this)" data-id="${escHtml(ql.id)}">
      <div class="questline-card-header">
        <span class="questline-card-icon">${escHtml(ql.icon)}</span>
        <div class="questline-card-info">
          <div class="questline-card-name">${escHtml(displayNameQl)}</div>
          <div class="questline-card-desc">${escHtml(displayDesc)}</div>
        </div>
        <div class="questline-card-meta">
          <div class="questline-card-stage">${t('questlines_stage')} ${ql.current_stage}: ${escHtml(stageName)}</div>
          <div class="questline-card-progress">${ql.unlocked_count}/${ql.total_count}</div>
        </div>
      </div>
      <div class="questline-card-bar">
        <div class="questline-card-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="questline-stages">${stagesHtml}${rewardText ? `<div class="questline-reward">${t('questlines_reward')}: ${escHtml(rewardText)}</div>` : ''}</div>
    </div>`;
  }).join('');
}

function toggleQuestlineCard(card) {
  card.classList.toggle('expanded');
}
```

- [ ] **Step 4: Verify no JS syntax errors**

Run: `node --check src/dashboard/public/app.js`
Expected: No syntax errors (note: this may fail on `window` references — just check for parse errors, acceptable).

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/public/app.js
git commit -m "feat: add renderQuestlines() + i18n for Dashboard questline cards

Expandable cards with 3-stage detail, progress bars, gold completion.
Click to toggle stage view. i18n: nav + section + stage + reward labels.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 3: Verification

### Task 11: Run full test suite + build

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass (1061+).

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Only 2 pre-existing hook.ts errors.

- [ ] **Step 3: Manual verification — parse real YAML**

Run: `npx tsx -e "import { AchievementEngine } from './src/engine/engine.js'; const e = new AchievementEngine(); e.init(); console.log('questlines:', e.questlineDefinitions.length); for (const q of e.questlineDefinitions) { const total = q.stages.reduce((s,st) => s+st.achievements.length, 0); console.log('  ', q.id, '—', total, 'achievements,', q.stages.length, 'stages'); }"`
Expected: Prints 5 questlines with 8-11 achievements each.

- [ ] **Step 4: Commit (only if fixes needed)**

No commit needed if all pass. If fixes needed, commit them.

---

### Task 12: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entry at top**

```markdown
### Questline 成就旅程线系统 — 2026-06-11

- **5 条 RPG 成长路线**：Bug Hunter（除虫大师）、Toolsmith（工具匠人）、Builder（建造大师）、Night Shift（夜行者）、Polyglot（语言通才）
- **每线 3 阶段**（开始→中段→终章），~49 个成就覆盖（24%）
- **Dashboard**：新增"旅程" nav tab（成就与套装之间），可展开的横向进度卡片 + 阶段成就列表
- **完成奖励**：全部 3 阶段解锁获得专属 title（如"精英除虫师"）
- **YAML 权威源**：`achievement-definitions.yaml` 新增 `questlines:` 区块（~100 行）
- **纯展示层**：不改 engine/evaluator，进度 = state.unlocked 查询
- **多归属**：一个成就可出现在多条 questline 中
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG — questline system implementation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Summary

| Phase | Tasks | Files Created | Files Modified |
|-------|-------|--------------|----------------|
| Phase 1 | Tasks 1–5 | 0 | 5 (`types.ts`, `achievement-definitions.yaml`, `yaml-parser.ts`, `engine.ts`, `yaml-parser.test.ts`) |
| Phase 2 | Tasks 6–10 | 0 | 5 (`api.ts`, `server.ts`, `api.test.ts`, `index.html`, `app.js`, `styles.css`) |
| Phase 3 | Tasks 11–12 | 0 | 1 (`CHANGELOG.md`) |
| **Total** | **12 tasks** | **0 files** | **10 files** |

**Test coverage**: +5 test cases across 2 test files. No engine/evaluator/store changes — questline is a pure display-layer feature.
