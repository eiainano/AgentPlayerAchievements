# Achievement Audit System Design

> 2026-06-08 | Hybrid rule-engine + LLM audit for YAML description ↔ condition consistency

## Problem

183 achievements, 198 conditions across 10 condtion types. Every achievement has both:

1. **YAML conditions** — what the evaluator actually measures
2. **Natural language descriptions** (EN + CN) — what the user reads

No automated check verifies that these two agree. Manual review doesn't scale.

## Goals

Three verification layers, named after their coverage depth:

| Layer | Check | Meaning |
|-------|-------|---------|
| **A** | Numeric consistency | Does every number in the description match a number in the conditions? |
| **B** | Semantic consistency | Does the condition *type* and *structure* match the description's intent? |
| **C** | Completeness | Does the description mention constraints the conditions don't enforce? Do the conditions enforce things the description doesn't mention? |

## Architecture

```
achievement-definitions.yaml (183 defs)
         │
         ├─── Phase 1: Rule Engine (vitest, CI gate)
         │    src/verify/auditor.ts  →  tests/verify/auditor.test.ts
         │    Covers: Layer A (numbers) + Layer B (patterns regex can catch)
         │    Runs: npm test (deterministic, no API calls)
         │
         └─── Phase 2: LLM Audit (manual/periodic script)
              scripts/audit-achievements.ts
              Covers: Layer B (deep semantics) + Layer C (completeness)
              Runs: on demand, outputs structured JSON report
```

## Phase 1: Rule Engine

### Entry point: `src/verify/auditor.ts`

Exports a single function:

```ts
function auditAchievements(defs: AchievementDefinition[]): AuditReport
```

Where `AuditReport` is:

```ts
interface AuditFinding {
  id: string;                  // achievement ID
  layer: 'A' | 'B';            // which layer caught it
  severity: 'error' | 'warn';  // error = hard fail, warn = needs human review
  field: string;               // "description" | "description_cn" | "conditions[0].value" etc.
  message: string;             // human-readable explanation
  expected: unknown;           // what the description implies
  actual: unknown;             // what the conditions say
}

interface AuditReport {
  total: number;
  passed: number;
  findings: AuditFinding[];
  needsLLMReview: string[];    // achievement IDs flagged for LLM audit
}
```

### Layer A Checks (numeric / window consistency)

For each achievement, parse both `description` and `description_cn`.

#### A1: Numeric value extraction

| Pattern (EN) | Pattern (CN) | Extracts | Compared to |
|---|---|---|---|
| `/\b(\d+)\s*(?:tasks?\|files?\|tools?\|times?\|sessions?\|steps?\|days?\|images?\|tests?\|edits?\|commands?\|errors?\|conversations?\|languages?\|files?\|calls?\|prompts?\|questions?)\b/` | `/(\d+)\s*(?:个\|次\|种\|天\|步\|张\|条\|轮\|门\|句)\s*(?:task\|文件\|工具\|次\|session\|天\|图\|图片\|测试\|编辑\|命令\|错误\|对话\|语言\|文件\|调用\|prompt\|问题\|小时)/` | `{number: N, subject: word}` | `cond.value == N` if subject matches event |
| `/\b(\d{1,3}(?:,\d{3})*(?:,\d{3})*)\s*(?:tokens?\|characters?\|lines?\|words?)\b/` | same | `{number: parsed_int}` | `cond.value == parsed_int` (comma-formatted) |
| `/\b(\d+)\+\b/` or `"at least \d+"` | `/(\d+)\s*以上/` or `≥\s*\d+/` | `{number: N, op: ">="}` | `cond.operator == ">="` AND `cond.value == N` |
| `"first"` / `"for the first time"` / `"首次"` / `"第一次"` | same | `{number: 1, op: ">="}` | `cond.value == 1` |
| `"more than \d+"` / `"over \d+"` | `/\d+\s*以上/` | `{number: N, op: ">"}` | `cond.operator == ">"` AND `cond.value >= N` |
| `"all"` / `"every"` / `"全部"` | same | `{number: "all"}` | condition type is `set_completion` or `event` |

#### A2: Window extraction

| Pattern (EN) | Pattern (CN) | Extracts | Compared to |
|---|---|---|---|
| `"single session"` / `"same session"` | `"单 session"` / `"单次"` / `"同一 session"` | `{window: "single_session"}` | `cond.window == "single_session"` |
| `"single task"` / `"same task"` / `"one task"` | `"单 task"` / `"单次"` / `"同一 task"` | `{window: "single_task"}` | `cond.window == "single_task"` |
| `"within (\d+) hours?"` | `"(\d+)\s*小时"` / `"(\d+)h"` | `{window: "Nh"}` | `cond.window == "Nh"` or `cond.window` contains the number |
| `"(\d+) consecutive days?"` / `"连续 (\d+) 天"` | same | type is `streak` | condition type matches |
| `"cumulatively"` / `"ever"` / `"lifetime"` | `"累计"` / `"总计"` / `"一生"` | `{window: "all"}` | `cond.window` is `"all"` or `"lifetime"` or absent (default is 24h — warn) |

#### A3: Operator consistency

If description says "exactly N" → condition operator must be `==`
If description says "at least N" / "N+" → condition operator must be `>=`
If description says "more than N" / "over N" → condition operator must be `>`

#### Numeric metadata

Some achievement descriptions contain numbers that are stylistic/flavor, not constraints:

```yaml
# audit_ignore_numeric: true  ← manual opt-out marker
```

These achievements are skipped for Layer A numeric checking. The field goes in YAML under the achievement's root.

### Layer B Checks (structural / pattern-based)

#### B1: Condition type ↔ description intent

| Description implies | Expected condition type(s) | If mismatch → |
|---|---|---|
| `"N different X"` / `"N 种不同的 X"` | `distinct_count` | error if `counter` (doesn't dedupe) |
| `"N consecutive days"` / `"连续 N 天"` | `streak` | error if `counter` (doesn't require consecutive) |
| `"ratio"` / `"percentage"` / `"%"/"占比"` | `ratio` or `threshold` with `metric` | warn if `counter` |
| `"all X achievements"` / `"全部 X"` | `set_completion` | error if `counter` (can't measure "all") |
| `"pattern"` / `"regex"` / `"match"` | `pattern_match` | warn if `counter` |
| `"mode"` / `"most common"` / `"最常见"` | `mode` | warn |

#### B2: Window required by description semantics

If description says "single task" but no window is set → **error** (default behavior leaks events from other tasks).

If description says "single session" but no window is set → **error**.

If description says "within Nh" but `window` doesn't match → **warn**.

If description says "cumulatively" / "lifetime" but `window` is a short duration → **warn**.

#### B3: Event type ↔ description subject

For each `cond.event`, check that the event name matches the subject mentioned in the description:

```ts
const SUBJECT_EVENT_MAP: Record<string, string[]> = {
  task: ['task.complete', 'task.create', 'task.update'],
  tool: ['tool.complete'],
  session: ['session.start'],
  MCP: ['mcp.connect', 'mcp.tool_call'],
  image: ['image.upload', 'image.read'],
  file: ['file.read', 'file.edit', 'file.write', 'file.create', 'file.delete'],
  language: ['file.language_used'],
  permission: ['permission.mode_changed'],
  automode: ['automode.start'],
  agent: ['agent.spawn', 'agent.complete', 'agent.self_fix'],
  search: ['tool.complete'],  // + filter check
  slash: ['command.run'],      // + filter check
  achievement: ['achievement.unlocked'],
  test: ['test.passed'],
  token: ['token.consumed'],
  error: ['error.occurred'],
  conversation: ['conversation.message'],
  plan: ['plan.enter', 'plan.exit'],
  dashboard: ['dashboard.opened'],
};
```

If none of the condition events match any subject from this map → **warn**.

#### B4: Filter required by description qualifiers

If description mentions a specific tool name, model, or file type, the condition should have a corresponding filter.

Examples:
- "search-type tools" → needs `tool_name in [Search, WebSearch, Grep, Glob]` or similar in filter
- "Bash commands" → needs `tool_name == 'Bash'`
- "image files" → needs `file_type matches '*.{png,jpg,...}'`

This is a **warn**-level check: filter absence doesn't prove brokenness, but the description implies narrowing.

### LLM Flagging

Achievements that meet any of these criteria are flagged for LLM review:

1. Description contains figurative/metaphorical language (no numeric match found)
2. `set_completion` condition (complex cross-achievement logic)
3. Multiple conditions of different types (interaction effects)
4. Description in one language has numbers the other doesn't
5. `needs_llm_review: true` explicitly set in YAML

### Handling `description_cn` vs `description`

Both languages are checked independently. A finding that appears in EN but not CN (or vice versa) is flagged as a **warn** (potential translation gap). Mismatched findings between the two are elevated to LLM review.

---

## Phase 2: LLM Audit Script

### Entry point: `scripts/audit-achievements.ts`

Run via: `npx tsx scripts/audit-achievements.ts [--model claude] [--output report.json]`

### Input

Each achievement passed to the LLM with a structured prompt:

```json
{
  "id": "first_contact",
  "name": "Hello World",
  "description": "Start your first agent conversation.",
  "description_cn": "开启你的第一次Agent对话。",
  "conditions": [
    { "type": "counter", "event": "conversation.message", "operator": ">=", "value": 1 }
  ]
}
```

### LLM Prompt Structure

The LLM answers a fixed questionnaire for each achievement:

1. **B-Semantic**: Does the condition type correctly capture the description's intent?
2. **B-Event**: Does the event name match what the description describes?
3. **B-Window**: Are the window/scoping constraints correct for what the description says?
4. **B-Operator**: Is the comparison operator consistent with the description's wording?
5. **C-Missing**: Does the description mention any constraint that the conditions don't enforce?
6. **C-Extra**: Do the conditions enforce something the description doesn't mention?
7. **Overall verdict**: PASS / WARN (minor ambiguity) / FAIL (description-contradicting condition)

### Output

```json
{
  "findings": [
    {
      "id": "some_ach",
      "pass": false,
      "issues": [
        { "layer": "B", "severity": "error", "message": "...", "suggestion": "..." }
      ]
    }
  ],
  "summary": {
    "total": 183,
    "pass": 170,
    "warn": 10,
    "fail": 3
  }
}
```

### Batching

To contain token costs, achievements are batched in groups of 20 into a single LLM call. Each batch gets:

1. System prompt: explanation of the 11 condition types and AGPA event system
2. User prompt: 20 achievement cards with conditions
3. Structured output schema for the response

---

## Test Strategy

### Unit tests (`tests/verify/auditor.test.ts`)

- ~30 test cases covering each Layer A pattern (numeric extraction, window extraction, operator inference)
- ~20 test cases covering each Layer B pattern (type mismatch, window-missing, event-subject mismatch)
- 3-5 test cases for the LLM flagging heuristic
- Use synthetic YAML defs, not real ones (fast, independent of YAML changes)

### Integration

- The `every-achievement.test.ts` already proves reachability
- `auditor.test.ts` reads the real YAML and runs audit → asserts 0 errors
- Warnings are non-blocking (informational) but tracked

### CI behavior

- `auditReport.findings.filter(f => f.severity === 'error').length === 0` → pass
- Warnings printed to console, do not fail CI
- `needsLLMReview` list printed to console

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `docs/superpowers/specs/2026-06-08-achievement-audit-system-design.md` | This spec |
| `src/verify/auditor.ts` | Rule engine: auditAchievements() + all Layer A/B checks |
| `tests/verify/auditor.test.ts` | Unit tests for rule engine |
| `scripts/audit-achievements.ts` | LLM audit script (Phase 2) |

## Implementation Order

1. **`src/verify/auditor.ts`** — Layer A checks first (numeric), then Layer B (patterns)
2. **`tests/verify/auditor.test.ts`** — write tests as each check function is built
3. **Run against real YAML** — fix false positives, add `audit_ignore_numeric` tags where needed
4. **`scripts/audit-achievements.ts`** — LLM script, built after rule engine stabilizes

---

## Edge Cases & Design Decisions

1. **Description with multiple numbers**: "5 tasks in 3 different languages" → both numbers extracted, each matched to the nearest condition
2. **No description_cn**: ~45 achievements lack `description_cn`. Chinese audit is skipped for those.
3. **Hidden achievements**: hint text may contain clues but is NOT a description — excluded from audit
4. **Challenge achievements**: manual track, description may use imperative mood ("Do X 10 times") — same extraction rules apply
5. **False positives are expected**: the rule engine is intentionally conservative (prefers `warn` over `error` when uncertain). The `audit_ignore_numeric` escape hatch exists for achievements with metaphorical numbers.
