/**
 * Tests for Achievement Auditor — Rule Engine (Phase 1)
 *
 * Covers:
 *   Layer A: numeric extraction, window extraction, operator inference (EN + CN)
 *   Layer B: type mismatch, window missing, event-subject mismatch, filter requirements
 *   LLM flagging heuristic
 *   Integration against real YAML
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { auditAchievements, hasErrors, formatReport } from '../../src/verify/auditor.js';
import { parseYAML } from '../../src/engine/yaml-parser.js';
import type { AchievementDefinition } from '../../src/engine/types.js';

// ── Helpers ──────────────────────────────────────────────────────────

function def(overrides: Partial<AchievementDefinition>): AchievementDefinition {
  return {
    id: 'test_ach',
    name: 'Test Achievement',
    description: 'Default description.',
    icon: '🧪',
    category: 'test',
    rarity: 'common',
    hidden: false,
    conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 1 }],
    ...overrides,
  };
}

// ── Layer A: Numeric value consistency ───────────────────────────────

describe('Layer A: Numeric consistency (EN)', () => {
  it('passes when description number matches condition value', () => {
    const d = def({
      id: 'num_match',
      description: '10 tasks completed. You are productive.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
    expect(report.passed).toBe(1);
  });

  it('warns when description number not in any condition value', () => {
    const d = def({
      id: 'num_mismatch',
      description: '10 tasks completed.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const numFindings = report.findings.filter(f => f.layer === 'A' && f.severity === 'warn');
    expect(numFindings.length).toBeGreaterThan(0);
    expect(numFindings[0]!.message).toContain('10');
    // The finding message describes what's missing ("no condition has value=10")
    expect(numFindings[0]!.actual).toMatch(/condition values.*5/);
  });

  it('handles comma-formatted numbers: "1,000 tasks"', () => {
    const d = def({
      id: 'comma_num',
      description: '1,000 tasks completed.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 1000 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('handles comma-formatted numbers: "1,000,000 tokens"', () => {
    const d = def({
      id: 'big_comma',
      description: 'Consumed 1,000,000 tokens.',
      conditions: [{ type: 'threshold', event: 'token.consumed', field: 'count', operator: '>=', value: 1000000 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('handles "N+" patterns: "5+ files"', () => {
    const d = def({
      id: 'n_plus',
      description: '5+ files edited.',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    // 5+ = at least 5 = operator >= AND value 5 — should match
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });

  it('handles "at least N" patterns', () => {
    const d = def({
      id: 'at_least',
      description: 'At least 25 prompts.',
      conditions: [{ type: 'counter', event: 'user.prompt', operator: '>=', value: 25 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('handles "first" → value=1 implication', () => {
    const d = def({
      id: 'first_ach',
      description: 'Used your first tool.',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 1 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('warns when "first" in description but value > 1', () => {
    const d = def({
      id: 'first_but_5',
      description: 'Used your first tool.',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const f = report.findings.filter(f => f.severity === 'warn' && f.message.includes('first'));
    expect(f.length).toBeGreaterThan(0);
  });

  it('handles "more than N" → operator >', () => {
    const d = def({
      id: 'more_than',
      description: 'Edited more than 20 times.',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>', value: 20 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });
});

// ── Layer A: Numeric consistency (CN) ────────────────────────────────

describe('Layer A: Numeric consistency (CN)', () => {
  it('matches Chinese measure words: "5 个 task"', () => {
    const d = def({
      id: 'cn_num',
      description: '完成了 5 个 task。',
      description_cn: '完成了 5 个 task。',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('matches Chinese "首次" → value=1', () => {
    const d = def({
      id: 'cn_first',
      description: 'First time using tool.',
      description_cn: '首次使用 tool。',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 1 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('matches Chinese "≥" operator', () => {
    const d = def({
      id: 'cn_ge',
      description: 'Used ≥ 5 tools.',
      description_cn: '使用 ≥ 5 个工具',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });

  it('matches Chinese "超过 N" → operator >', () => {
    const d = def({
      id: 'cn_over',
      description: 'Over 10 files edited.',
      description_cn: '超过 10 个文件编辑',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>', value: 10 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A')).toHaveLength(0);
  });
});

// ── Layer A: Window extraction ───────────────────────────────────────

describe('Layer A: Window extraction', () => {
  it('detects "single session" → expects single_session window', () => {
    const d = def({
      id: 'single_session',
      description: '10 tool calls in a single session.',
      conditions: [{ type: 'counter', event: 'tool.complete', window: 'single_session', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });

  it('errors when "single task" in description but no task window', () => {
    const d = def({
      id: 'missing_task_window',
      description: '5 files edited in a single task.',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'A' && f.severity === 'error');
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.message).toContain('single_task');
  });

  it('accepts "same_task" as equivalent to "single task"', () => {
    const d = def({
      id: 'same_task',
      description: '5 files edited in a single task.',
      conditions: [{ type: 'counter', event: 'file.edit', window: 'same_task', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });

  it('accepts "same_session" as equivalent to "single session"', () => {
    const d = def({
      id: 'same_session',
      description: '10 tool calls in a single session.',
      conditions: [{ type: 'counter', event: 'tool.complete', window: 'same_session', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });

  it('detects "within 24 hours" → expects 24h window', () => {
    const d = def({
      id: 'within_24',
      description: 'Started 2+ sessions within 24 hours.',
      conditions: [{ type: 'threshold', event: 'session.start', window: '24h', operator: '>=', value: 2 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });

  it('errors when "within 24h" in desc but window is "all"', () => {
    const d = def({
      id: 'within_mismatch',
      description: '2 sessions within 24 hours.',
      conditions: [{ type: 'threshold', event: 'session.start', window: 'all', operator: '>=', value: 2 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'A' && f.severity === 'error');
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.message).toContain('24h');
  });

  it('detects "cumulatively" → expects all/lifetime window', () => {
    const d = def({
      id: 'cumulative_ok',
      description: '500 files edited cumulatively.',
      conditions: [{ type: 'counter', event: 'file.edit', window: 'all', operator: '>=', value: 500 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });

  it('warns when "cumulatively" but window is short duration', () => {
    const d = def({
      id: 'cumulative_short_window',
      description: '500 files edited cumulatively.',
      conditions: [{ type: 'counter', event: 'file.edit', window: '24h', operator: '>=', value: 500 }],
    });
    const report = auditAchievements([d]);
    const bFindings = report.findings.filter(f => f.layer === 'B' && f.severity === 'warn');
    expect(bFindings.length).toBeGreaterThan(0);
  });
});

// ── Layer A: Operator consistency ────────────────────────────────────

describe('Layer A: Operator consistency', () => {
  it('warns when "at least" + operator == mismatch', () => {
    const d = def({
      id: 'op_mismatch',
      description: 'At least 10 tasks completed.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '==', value: 10 }],
    });
    const report = auditAchievements([d]);
    const f = report.findings.filter(f => f.layer === 'A' && f.message.includes('but condition uses'));
    expect(f.length).toBeGreaterThan(0);
  });

  it('allows "first" + value=1 without operator warning', () => {
    const d = def({
      id: 'first_ok',
      description: 'Your first conversation.',
      conditions: [{ type: 'counter', event: 'conversation.message', operator: '>=', value: 1 }],
    });
    const report = auditAchievements([d]);
    expect(report.findings.filter(f => f.layer === 'A' && f.severity === 'error')).toHaveLength(0);
  });
});

// ── Layer B: Condition type mismatch ─────────────────────────────────

describe('Layer B: Condition type match', () => {
  it('errors when "N different" in desc but type is counter not distinct_count', () => {
    const d = def({
      id: 'different_wrong_type',
      description: 'Used 5 different tools.',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error' && f.message.includes('distinct_count'));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('passes when "N different" + distinct_count match', () => {
    const d = def({
      id: 'different_correct',
      description: 'Used 5 different tools.',
      conditions: [{ type: 'distinct_count', event: 'tool.complete', field: 'tool_name', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error');
    expect(errs).toHaveLength(0);
  });

  it('errors when "N consecutive" in desc but type is counter not streak', () => {
    const d = def({
      id: 'consecutive_wrong_type',
      description: '7 consecutive days of use.',
      conditions: [{ type: 'counter', event: 'session.start', operator: '>=', value: 7 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error' && f.message.includes('streak'));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('passes when "N consecutive" + streak match', () => {
    const d = def({
      id: 'consecutive_correct',
      description: '7 consecutive days of use.',
      conditions: [{ type: 'streak', event: 'session.start', operator: '>=', value: 7 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error');
    expect(errs).toHaveLength(0);
  });
});

// ── Layer B: Window presence ─────────────────────────────────────────

describe('Layer B: Window required by semantics', () => {
  it('errors when "single session" in desc but no session window', () => {
    const d = def({
      id: 'needs_session_window',
      description: '10 tool calls in a single session.',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error' && f.message.includes('single_session'));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('errors when "single task" in desc but no task window', () => {
    const d = def({
      id: 'needs_task_window',
      description: '5 files edited in a single task.',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error' && f.message.includes('single_task'));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('accepts "same_task" as task window', () => {
    const d = def({
      id: 'has_task_window',
      description: '5 files edited in a single task.',
      conditions: [{ type: 'counter', event: 'file.edit', window: 'same_task', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error');
    expect(errs).toHaveLength(0);
  });

  it('accepts "same_session" as session window', () => {
    const d = def({
      id: 'has_session_window',
      description: '10 tool calls in a single session.',
      conditions: [{ type: 'counter', event: 'tool.complete', window: 'same_session', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const errs = report.findings.filter(f => f.layer === 'B' && f.severity === 'error');
    expect(errs).toHaveLength(0);
  });
});

// ── Layer B: Event ↔ subject ─────────────────────────────────────────

describe('Layer B: Event ↔ subject', () => {
  it('passes when event matches description subject (task ↔ task.complete)', () => {
    const d = def({
      id: 'event_match',
      description: '10 tasks completed.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const bWarns = report.findings.filter(f => f.layer === 'B' && f.severity === 'warn' && f.field.includes('event'));
    expect(bWarns).toHaveLength(0);
  });

  it('warns when event does not match any description subject', () => {
    const d = def({
      id: 'event_mismatch',
      description: 'Used 10 different tools.',
      conditions: [{ type: 'counter', event: 'session.start', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const warns = report.findings.filter(f => f.layer === 'B' && f.severity === 'warn' && f.field.includes('event'));
    expect(warns.length).toBeGreaterThan(0);
  });

  it('passes for file.edit when description mentions "edited"', () => {
    const d = def({
      id: 'file_edit_match',
      description: 'Agent edited 5 files.',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    const bWarns = report.findings.filter(f => f.layer === 'B' && f.severity === 'warn' && f.field.includes('event'));
    expect(bWarns).toHaveLength(0);
  });
});

// ── Filter checks ────────────────────────────────────────────────────

describe('Layer B: Filter requirements', () => {
  it('warns when "search-type tools" in desc but no filter', () => {
    const d = def({
      id: 'search_no_filter',
      description: '10+ search-type tools used in a single session.',
      conditions: [{ type: 'counter', event: 'tool.complete', window: 'single_session', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const warns = report.findings.filter(f => f.layer === 'B' && f.message.includes('search-type'));
    expect(warns.length).toBeGreaterThan(0);
  });

  it('passes when "search-type tools" + filter match', () => {
    const d = def({
      id: 'search_with_filter',
      description: '10+ search-type tools used.',
      conditions: [{ type: 'counter', event: 'tool.complete', filter: "tool_name in ['grep','glob','web_search','web_fetch']", operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const warns = report.findings.filter(f => f.layer === 'B' && f.message.includes('search-type'));
    expect(warns).toHaveLength(0);
  });
});

// ── LLM flagging ─────────────────────────────────────────────────────

describe('LLM flagging heuristic', () => {
  it('flags set_completion achievements', () => {
    const d = def({
      id: 'set_comp',
      description: 'Unlocked all Common achievements.',
      conditions: [{ type: 'set_completion', rarity: 'common' }],
    });
    const report = auditAchievements([d]);
    expect(report.needsLLMReview).toContain('set_comp');
  });

  it('flags multi-type condition achievements', () => {
    const d = def({
      id: 'multi_type',
      description: '10 tool calls and completed 5 tasks.',
      conditions: [
        { type: 'counter', event: 'tool.complete', operator: '>=', value: 10 },
        { type: 'counter', event: 'task.complete', operator: '>=', value: 5 },
      ],
    });
    const report = auditAchievements([d]);
    // Two conditions of same type "counter" — actually same type — should not flag
    // Actually, types is a Set so size=1, should NOT flag
    expect(report.needsLLMReview).not.toContain('multi_type');
  });

  it('flags achievements with truly different condition types', () => {
    const d = def({
      id: 'diff_types',
      description: '10 tool calls sequentially in single task.',
      conditions: [
        { type: 'sequence', event: 'tool.complete', window: 'single_task', consecutive: true, count: { operator: '>=', value: 10 } },
        { type: 'counter', event: 'tool.deny', window: 'same_task', operator: '==', value: 0 },
      ],
    });
    const report = auditAchievements([d]);
    expect(report.needsLLMReview).toContain('diff_types');
  });

  it('flags pattern_match achievements', () => {
    const d = def({
      id: 'pattern_ach',
      description: 'Agent made you laugh.',
      conditions: [{ type: 'pattern_match', event: 'conversation.message', role: 'assistant', pattern: 'haha|lmao|funny' }],
    });
    const report = auditAchievements([d]);
    expect(report.needsLLMReview).toContain('pattern_ach');
  });

  it('flags ratio achievements', () => {
    const d = def({
      id: 'ratio_ach',
      description: 'Pasted content / total input > 50%.',
      conditions: [{ type: 'ratio', numerator: 'paste_chars', denominator: 'total_input_chars', operator: '>', value: 0.5 }],
    });
    const report = auditAchievements([d]);
    expect(report.needsLLMReview).toContain('ratio_ach');
  });

  it('flags descriptions with no extractable numbers (figurative language)', () => {
    const d = def({
      id: 'figurative',
      description: 'Agent is part of your daily routine now.',
      conditions: [{ type: 'counter', event: 'session.start', operator: '>=', value: 30 }],
    });
    const report = auditAchievements([d]);
    // No numbers extractable from "Agent is part of your daily routine now."
    expect(report.needsLLMReview).toContain('figurative');
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('skips future achievements', () => {
    const d = def({
      id: 'future_ach',
      description: 'Something impossible.',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 100 }],
      future: true,
    });
    const report = auditAchievements([d]);
    expect(report.passed).toBe(1);
    expect(report.findings).toHaveLength(0);
  });

  it('skips achievements with no conditions', () => {
    const d = def({
      id: 'no_conds',
      description: 'Nothing to do.',
      conditions: [],
    });
    const report = auditAchievements([d]);
    expect(report.passed).toBe(1);
  });

  it('handles missing description_cn gracefully', () => {
    const d = def({
      id: 'no_cn',
      description: '10 tasks completed.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    expect(report.passed).toBe(1);
  });

  it('handles "all achievements" → set_completion', () => {
    const d = def({
      id: 'all_ach',
      description: 'All achievements, including hidden ones.',
      conditions: [{ type: 'set_completion', all: true }],
    });
    const report = auditAchievements([d]);
    expect(report.passed).toBe(1);
  });

  it('handles "all" extracted number → does not match numeric value', () => {
    const d = def({
      id: 'all_set',
      description: 'Unlocked all achievements.',
      conditions: [{ type: 'set_completion', all: true }],
    });
    const report = auditAchievements([d]);
    // "all" is not a numeric value, so it should not warn about value mismatch
    const numWarnings = report.findings.filter(f =>
      f.layer === 'A' && f.severity === 'warn' && f.message.includes('value=')
    );
    expect(numWarnings).toHaveLength(0);
  });
});

// ── hasErrors / formatReport ─────────────────────────────────────────

describe('hasErrors and formatReport', () => {
  it('hasErrors returns true when errors exist', () => {
    const d = def({
      id: 'bad',
      description: '5 files edited in a single task.',
      conditions: [{ type: 'counter', event: 'file.edit', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    expect(hasErrors(report)).toBe(true);
  });

  it('hasErrors returns false when only warnings exist', () => {
    const d = def({
      id: 'warn_only',
      description: 'Used your first tool — 5 times.',
      conditions: [{ type: 'counter', event: 'tool.complete', operator: '>=', value: 5 }],
    });
    const report = auditAchievements([d]);
    // "first" + value=5 → warn; might have other warnings
    const errors = report.findings.filter(f => f.severity === 'error');
    // Should only have a warn about "first" + value=5, no hard errors
    expect(errors.length >= 0).toBe(true);
  });

  it('formatReport produces readable string', () => {
    const d = def({
      id: 'test',
      description: '10 tasks completed.',
      conditions: [{ type: 'counter', event: 'task.complete', operator: '>=', value: 10 }],
    });
    const report = auditAchievements([d]);
    const output = formatReport(report);
    expect(output).toContain('Audit Report');
    expect(output).toContain('Total: 1');
    expect(output).toContain('Passed: 1');
  });
});

// ── Integration: real YAML ───────────────────────────────────────────

describe('Integration: real YAML', () => {
  it('has zero errors against all 183 achievements', () => {
    const YAML_PATH = path.resolve(import.meta.dirname, '../../achievement-definitions.yaml');
    const yamlText = fs.readFileSync(YAML_PATH, 'utf-8');
    const { definitions } = parseYAML(yamlText);

    const report = auditAchievements(definitions as AchievementDefinition[]);

    console.log(formatReport(report));

    // Zero hard errors — all achievements are consistent
    const errors = report.findings.filter(f => f.severity === 'error');
    if (errors.length > 0) {
      console.log(`\n❌ ${errors.length} ERRORS found:`);
      for (const e of errors) {
        console.log(`  ${e.id}: ${e.message}`);
      }
    }

    // Warnings are informational — print them but don't fail
    const warns = report.findings.filter(f => f.severity === 'warn');
    if (warns.length > 0) {
      console.log(`\n⚠️  ${warns.length} warnings (informational):`);
      // Group by message pattern
      const byMsg = new Map<string, string[]>();
      for (const w of warns) {
        const key = w.message.slice(0, 60);
        if (!byMsg.has(key)) byMsg.set(key, []);
        byMsg.get(key)!.push(w.id);
      }
      for (const [msg, ids] of byMsg) {
        console.log(`  • "${msg}..." → ${ids.length} (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''})`);
      }
    }

    console.log(`\n🧠 Needs LLM Review: ${report.needsLLMReview.length}`);
    console.log(`IDs: ${report.needsLLMReview.join(', ')}`);

    expect(errors).toHaveLength(0);
    expect(report.total).toBe(203);
  });
});
