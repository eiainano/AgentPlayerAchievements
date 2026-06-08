/**
 * Tests for scripts/audit-achievements.ts — LLM Audit Phase 2
 *
 * Covers prompt construction, batch splitting, response parsing,
 * report aggregation, and CLI argument parsing.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  buildSystemPrompt,
  buildUserPromptForBatch,
  buildToolSchema,
  mergeResults,
  prepareCards,
  parseArgs,
} from '../../scripts/audit-achievements.js';
import type { BatchResult } from '../../scripts/audit-achievements.js';

// ─── Sample data ──────────────────────────────────────────────────────────

const sampleCard = {
  id: 'test_achievement',
  name: 'Test Achievement',
  name_cn: '测试成就',
  description: 'Complete 5 tasks in a single session',
  description_cn: '在单次会话中完成5个任务',
  category: 'productivity',
  rarity: 'common' as const,
  hidden: false,
  challenge: false,
  conditions: [
    { type: 'counter' as const, event: 'task.complete', operator: '>=' as const, value: 5, window: 'single_session' },
  ],
};

const sampleCardNoCN = {
  id: 'no_cn_ach',
  name: 'No CN Achievement',
  description: 'Use 3 different tools in one task',
  category: 'exploration',
  rarity: 'uncommon' as const,
  conditions: [
    { type: 'distinct_count' as const, event: 'tool.complete', operator: '>=' as const, value: 3, window: 'single_task', field: 'tool_name' },
  ],
};

const sampleCards = [sampleCard, sampleCardNoCN];

// ─── buildSystemPrompt ────────────────────────────────────────────────────

describe('buildSystemPrompt()', () => {
  it('should return a string', () => {
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should describe all 11 condition types', () => {
    const prompt = buildSystemPrompt();
    const types = ['counter', 'threshold', 'streak', 'sequence', 'distinct_count',
      'event', 'mode', 'set_completion', 'ratio', 'pattern_match', 'sequence_count'];
    for (const t of types) {
      expect(prompt).toContain(t);
    }
  });

  it('should mention all window types', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('single_session');
    expect(prompt).toContain('single_task');
    expect(prompt).toContain('lifetime');
    expect(prompt).toContain('24h');
  });

  it('should mention B-Semantic, B-Event, B-Window, B-Operator, C-Missing, C-Extra checks', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('B-Semantic');
    expect(prompt).toContain('B-Event');
    expect(prompt).toContain('B-Window');
    expect(prompt).toContain('B-Operator');
    expect(prompt).toContain('C-Missing');
    expect(prompt).toContain('C-Extra');
  });

  it('should describe verdict levels (pass/warn/fail)', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('pass');
    expect(prompt).toContain('warn');
    expect(prompt).toContain('fail');
  });
});

// ─── buildUserPromptForBatch ──────────────────────────────────────────────

describe('buildUserPromptForBatch()', () => {
  it('should include achievement IDs', () => {
    const result = buildUserPromptForBatch(sampleCards);
    expect(result).toContain('test_achievement');
    expect(result).toContain('no_cn_ach');
  });

  it('should include names and descriptions', () => {
    const result = buildUserPromptForBatch(sampleCards);
    expect(result).toContain('Test Achievement');
    expect(result).toContain('Complete 5 tasks in a single session');
    expect(result).toContain('测试成就');
  });

  it('should include condition JSON', () => {
    const result = buildUserPromptForBatch(sampleCards);
    // Conditions should appear as JSON blocks
    expect(result).toContain('"task.complete"');
    expect(result).toContain('"distinct_count"');
    expect(result).toContain('"single_session"');
    expect(result).toContain('"single_task"');
  });

  it('should handle achievements without CN fields', () => {
    const result = buildUserPromptForBatch([sampleCardNoCN]);
    expect(result).toContain('no_cn_ach');
    expect(result).not.toContain('name_cn');
  });

  it('should number achievements sequentially', () => {
    const result = buildUserPromptForBatch(sampleCards);
    expect(result).toContain('Achievement 1:');
    expect(result).toContain('Achievement 2:');
  });

  it('should include category and rarity', () => {
    const result = buildUserPromptForBatch(sampleCards);
    expect(result).toContain('productivity');
    expect(result).toContain('exploration');
    expect(result).toContain('common');
    expect(result).toContain('uncommon');
  });
});

// ─── buildToolSchema ──────────────────────────────────────────────────────

describe('buildToolSchema()', () => {
  it('should return a valid tool schema object', () => {
    const schema = buildToolSchema(20);
    expect(schema).toHaveProperty('name', 'audit_batch');
    expect(schema).toHaveProperty('description');
    expect(schema).toHaveProperty('input_schema');
  });

  it('should include all required response fields', () => {
    const schema = buildToolSchema(20);
    const props = schema.input_schema.properties.achievements.items.properties;
    expect(props).toHaveProperty('id');
    expect(props).toHaveProperty('pass');
    expect(props).toHaveProperty('b_semantic');
    expect(props).toHaveProperty('b_event');
    expect(props).toHaveProperty('b_window');
    expect(props).toHaveProperty('b_operator');
    expect(props).toHaveProperty('c_missing');
    expect(props).toHaveProperty('c_extra');
    expect(props).toHaveProperty('suggestions');
    expect(props).toHaveProperty('verdict');
  });

  it('should include pass/warn/fail enum for verdict', () => {
    const schema = buildToolSchema(20);
    const verdict = schema.input_schema.properties.achievements.items.properties.verdict;
    expect(verdict.enum).toEqual(['pass', 'warn', 'fail']);
  });

  it('should include batch size in description', () => {
    const schema = buildToolSchema(15);
    expect(schema.description).toContain('15');
    const schema2 = buildToolSchema(30);
    expect(schema2.description).toContain('30');
  });
});

// ─── prepareCards ─────────────────────────────────────────────────────────

describe('prepareCards()', () => {
  it('should return cards with all fields preserved', () => {
    const result = prepareCards(sampleCards);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('test_achievement');
    expect(result[0].name).toBe('Test Achievement');
  });

  it('should clean condition objects to only needed fields', () => {
    const card = {
      ...sampleCard,
      conditions: [
        { type: 'counter' as const, event: 'task.complete', operator: '>=' as const, value: 5, window: 'single_session', extraField: 'should be removed' },
      ],
    };
    const result = prepareCards([card]);
    expect(result[0].conditions[0]).not.toHaveProperty('extraField');
    expect(result[0].conditions[0]).toHaveProperty('type', 'counter');
    expect(result[0].conditions[0]).toHaveProperty('event', 'task.complete');
    expect(result[0].conditions[0]).toHaveProperty('value', 5);
  });

  it('should handle conditions with optional fields', () => {
    const card = {
      ...sampleCard,
      conditions: [
        { type: 'distinct_count' as const, event: 'tool.complete', operator: '>=' as const, value: 3, field: 'tool_name', values: ['Bash', 'Grep', 'Search'] },
      ],
    };
    const result = prepareCards([card]);
    expect(result[0].conditions[0]).toHaveProperty('field', 'tool_name');
    expect(result[0].conditions[0]).toHaveProperty('values');
    expect(result[0].conditions[0].values).toEqual(['Bash', 'Grep', 'Search']);
  });
});

// ─── mergeResults ─────────────────────────────────────────────────────────

describe('mergeResults()', () => {
  it('should merge a single batch result', () => {
    const batchResult: BatchResult = {
      achievements: [
        {
          id: 'ach_1',
          pass: true,
          b_semantic: { ok: true },
          b_event: { ok: true },
          b_window: { ok: true },
          b_operator: { ok: true },
          c_missing: { ok: true },
          c_extra: { ok: true },
          suggestions: [],
          verdict: 'pass',
        },
      ],
    };

    const report = mergeResults([batchResult]);
    expect(report.summary.total).toBe(1);
    expect(report.summary.pass).toBe(1);
    expect(report.summary.warn).toBe(0);
    expect(report.summary.fail).toBe(0);
    expect(report.achievements).toHaveLength(1);
    expect(report.achievements[0].id).toBe('ach_1');
  });

  it('should merge multiple batches and correctly count verdicts', () => {
    const batch1: BatchResult = {
      achievements: [
        { id: 'a1', pass: true, b_semantic: { ok: true }, b_event: { ok: true }, b_window: { ok: true }, b_operator: { ok: true }, c_missing: { ok: true }, c_extra: { ok: true }, suggestions: [], verdict: 'pass' },
        { id: 'a2', pass: false, b_semantic: { ok: true }, b_event: { ok: false, issue: 'wrong event' }, b_window: { ok: true }, b_operator: { ok: true }, c_missing: { ok: true }, c_extra: { ok: true }, suggestions: ['fix event'], verdict: 'warn' },
      ],
    };
    const batch2: BatchResult = {
      achievements: [
        { id: 'a3', pass: false, b_semantic: { ok: false, issue: 'wrong type' }, b_event: { ok: true }, b_window: { ok: true }, b_operator: { ok: true }, c_missing: { ok: true }, c_extra: { ok: true }, suggestions: ['change to distinct_count'], verdict: 'fail' },
      ],
    };

    const report = mergeResults([batch1, batch2]);
    expect(report.summary.total).toBe(3);
    expect(report.summary.pass).toBe(1);
    expect(report.summary.warn).toBe(1);
    expect(report.summary.fail).toBe(1);
    expect(report.achievements).toHaveLength(3);
  });

  it('should sort achievements by ID', () => {
    const batch: BatchResult = {
      achievements: [
        { id: 'z_ach', pass: true, b_semantic: { ok: true }, b_event: { ok: true }, b_window: { ok: true }, b_operator: { ok: true }, c_missing: { ok: true }, c_extra: { ok: true }, suggestions: [], verdict: 'pass' },
        { id: 'a_ach', pass: true, b_semantic: { ok: true }, b_event: { ok: true }, b_window: { ok: true }, b_operator: { ok: true }, c_missing: { ok: true }, c_extra: { ok: true }, suggestions: [], verdict: 'pass' },
      ],
    };

    const report = mergeResults([batch]);
    expect(report.achievements[0].id).toBe('a_ach');
    expect(report.achievements[1].id).toBe('z_ach');
  });

  it('should preserve details in merged output', () => {
    const batch: BatchResult = {
      achievements: [
        {
          id: 'det_ach',
          pass: false,
          b_semantic: { ok: false, issue: 'should be distinct_count' },
          b_event: { ok: true },
          b_window: { ok: false, issue: 'missing single_session window' },
          b_operator: { ok: true },
          c_missing: { ok: false, constraint: 'description mentions "different tools" but no filter' },
          c_extra: { ok: true },
          suggestions: ['Change type to distinct_count', 'Add window: single_session'],
          verdict: 'fail',
        },
      ],
    };

    const report = mergeResults([batch]);
    const det = report.achievements[0].details;
    expect(det.b_semantic.issue).toBe('should be distinct_count');
    expect(det.b_window.issue).toBe('missing single_session window');
    expect(det.c_missing.constraint).toBe('description mentions "different tools" but no filter');
    expect(report.achievements[0].suggestions).toHaveLength(2);
  });

  it('should handle empty batch results', () => {
    const report = mergeResults([]);
    expect(report.summary.total).toBe(0);
    expect(report.summary.pass).toBe(0);
    expect(report.achievements).toHaveLength(0);
  });

  it('should set generated_at as ISO string', () => {
    const batch: BatchResult = {
      achievements: [
        { id: 't', pass: true, b_semantic: { ok: true }, b_event: { ok: true }, b_window: { ok: true }, b_operator: { ok: true }, c_missing: { ok: true }, c_extra: { ok: true }, suggestions: [], verdict: 'pass' },
      ],
    };
    const report = mergeResults([batch]);
    expect(report.generated_at).toBeTruthy();
    expect(new Date(report.generated_at).toISOString()).toBe(report.generated_at);
  });
});

// ─── parseArgs ────────────────────────────────────────────────────────────

describe('parseArgs()', () => {
  const origArgv = process.argv;

  function withArgs(args: string[]) {
    process.argv = ['node', 'scripts/audit-achievements.ts', ...args];
  }

  afterEach(() => {
    process.argv = origArgv;
  });

  it('should return defaults with no args', () => {
    withArgs([]);
    const opts = parseArgs();
    expect(opts.all).toBe(false);
    expect(opts.provider).toBe('anthropic');
    expect(opts.model).toBeUndefined();
    expect(opts.batchSize).toBe(20);
    expect(opts.output).toBeUndefined();
    expect(opts.dryRun).toBe(false);
    expect(opts.verbose).toBe(false);
  });

  it('should parse --all flag', () => {
    withArgs(['--all']);
    expect(parseArgs().all).toBe(true);
  });

  it('should parse --provider and --model', () => {
    withArgs(['--provider', 'openai', '--model', 'gpt-4o']);
    const opts = parseArgs();
    expect(opts.provider).toBe('openai');
    expect(opts.model).toBe('gpt-4o');
  });

  it('should parse --batch-size', () => {
    withArgs(['--batch-size', '10']);
    expect(parseArgs().batchSize).toBe(10);
  });

  it('should parse --output', () => {
    withArgs(['--output', './test-report.json']);
    expect(parseArgs().output).toBe('./test-report.json');
  });

  it('should parse --dry-run and --verbose', () => {
    withArgs(['--dry-run', '--verbose']);
    const opts = parseArgs();
    expect(opts.dryRun).toBe(true);
    expect(opts.verbose).toBe(true);
  });

  it('should use short flags -v for verbose', () => {
    withArgs(['-v']);
    expect(parseArgs().verbose).toBe(true);
  });

  it('should parse --api-key', () => {
    withArgs(['--api-key', 'sk-test-123']);
    expect(parseArgs().apiKey).toBe('sk-test-123');
  });

  it('should parse --base-url', () => {
    withArgs(['--base-url', 'https://custom.api.com']);
    expect(parseArgs().baseUrl).toBe('https://custom.api.com');
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('buildUserPromptForBatch handles empty array', () => {
    const result = buildUserPromptForBatch([]);
    expect(typeof result).toBe('string');
    expect(result).toContain('0 achievement');
  });

  it('buildUserPromptForBatch handles single achievement', () => {
    const result = buildUserPromptForBatch([sampleCard]);
    expect(result).toContain('Achievement 1:');
    expect(result).not.toContain('Achievement 2:');
  });

  it('prepareCards handles empty conditions', () => {
    const card = {
      ...sampleCard,
      conditions: [],
    };
    const result = prepareCards([card]);
    expect(result[0].conditions).toEqual([]);
  });

  it('buildToolSchema allows up to 50 achievements per batch', () => {
    // The schema description reflects the batch size
    const schema = buildToolSchema(50);
    expect(schema.description).toContain('50');
  });

  it('buildSystemPrompt mentions B-Semantic check', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('B-Semantic');
    expect(prompt).toContain('condition type');
    expect(prompt).toContain('description');
  });
});
