#!/usr/bin/env node
/**
 * AGPA Achievement Audit — Phase 2: LLM Semantic Audit
 *
 * Reads achievement definitions from YAML, batches them, and sends each batch
 * to an LLM for deep semantic consistency checking (Layer B/C).
 *
 * Usage:
 *   npx tsx scripts/audit-achievements.ts [options]
 *
 * Options:
 *   --all              Audit ALL achievements (default: only needsLLMReview flagged ones)
 *   --provider <name>  LLM provider: "anthropic" (default) or "openai"
 *   --model <name>     Model name (provider-specific defaults)
 *   --api-key <key>    API key (default: ANTHROPIC_API_KEY or OPENAI_API_KEY env)
 *   --base-url <url>   Custom API base URL
 *   --batch-size <n>   Achievements per batch (default: 20)
 *   --output <path>    Write report JSON to file (default: stdout)
 *   --yaml <path>      Path to achievement-definitions.yaml (default: auto-detect)
 *   --dry-run          Build prompts but don't call API — print to stdout
 *   --verbose, -v      Print progress per batch
 *   --help, -h         Show this help
 *
 * Requirements:
 *   ANTHROPIC_API_KEY (for provider: anthropic) or OPENAI_API_KEY (for provider: openai)
 *
 * Exit codes:
 *   0 = all pass            (no FAIL findings)
 *   1 = some WARN findings  (minor issues)
 *   2 = some FAIL findings  (description-contradicting conditions)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYAML } from '../src/engine/yaml-parser.js';
import { auditAchievements } from '../src/verify/auditor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Types ─────────────────────────────────────────────────────────────────

interface AuditLLMConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface BatchAchievementCard {
  id: string;
  name: string;
  name_cn?: string;
  description: string;
  description_cn?: string;
  category: string;
  rarity: string;
  hidden?: boolean;
  challenge?: boolean;
  conditions: Array<{
    type: string;
    event?: string;
    operator?: string;
    value: number;
    window?: string;
    filter?: string;
    field?: string;
    metric?: string;
    all?: boolean;
    exclude_hidden?: boolean;
    consecutive?: boolean;
    same_target?: boolean;
    per_event?: boolean;
    values?: string[];
    count?: { operator?: string; value: number };
    numerator?: string;
    denominator?: string;
  }>;
}

// Per-achievement audit result from LLM
interface LLMAuditVerdict {
  id: string;
  pass: boolean;
  b_semantic: { ok: boolean; issue?: string };
  b_event: { ok: boolean; issue?: string };
  b_window: { ok: boolean; issue?: string };
  b_operator: { ok: boolean; issue?: string };
  c_missing: { ok: boolean; constraint?: string };
  c_extra: { ok: boolean; constraint?: string };
  suggestions: string[];
  verdict: 'pass' | 'warn' | 'fail';
}

interface BatchResult {
  achievements: LLMAuditVerdict[];
}

interface AuditAggregateReport {
  generated_at: string;
  config: {
    total_achievements: number;
    audited: number;
    batches: number;
    batch_size: number;
    provider: string;
    model: string;
  };
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  achievements: Array<{
    id: string;
    verdict: 'pass' | 'warn' | 'fail';
    pass: boolean;
    details: {
      b_semantic: { ok: boolean; issue?: string };
      b_event: { ok: boolean; issue?: string };
      b_window: { ok: boolean; issue?: string };
      b_operator: { ok: boolean; issue?: string };
      c_missing: { ok: boolean; constraint?: string };
      c_extra: { ok: boolean; constraint?: string };
    };
    suggestions: string[];
  }>;
}

// ── CLI parsing ───────────────────────────────────────────────────────────

function parseArgs(): {
  all: boolean;
  provider: string;
  model: string | undefined;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  batchSize: number;
  output: string | undefined;
  yamlPath: string | undefined;
  dryRun: boolean;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 && i < args.length - 1 ? args[i + 1] : undefined;
  };
  const has = (flag: string): boolean => args.includes(flag);

  if (has('--help') || has('-h')) {
    printHelp();
    process.exit(0);
  }

  return {
    all: has('--all'),
    provider: get('--provider') || 'anthropic',
    model: get('--model'),
    apiKey: get('--api-key'),
    baseUrl: get('--base-url'),
    batchSize: parseInt(get('--batch-size') || '20', 10),
    output: get('--output'),
    yamlPath: get('--yaml'),
    dryRun: has('--dry-run'),
    verbose: has('--verbose') || has('-v'),
  };
}

function printHelp(): void {
  const h = `AGPA Achievement Audit — Phase 2: LLM Semantic Audit

Usage: npx tsx scripts/audit-achievements.ts [options]

Options:
  --all              Audit ALL achievements (default: only needsLLMReview flagged)
  --provider <name>  LLM provider: "anthropic" (default) or "openai"
  --model <name>     Model name (default: claude-sonnet-4-20250514 or deepseek-chat)
  --api-key <key>    API key (default: ANTHROPIC_API_KEY or OPENAI_API_KEY env)
  --base-url <url>   Custom API base URL
  --batch-size <n>   Achievements per batch (default: 20)
  --output <path>    Write report JSON to file (default: stdout)
  --yaml <path>      Path to achievement-definitions.yaml
  --dry-run          Build prompts without calling API
  --verbose, -v      Print progress per batch
  --help, -h         Show this help

Examples:
  npx tsx scripts/audit-achievements.ts --all
  npx tsx scripts/audit-achievements.ts --dry-run --verbose
  npx tsx scripts/audit-achievements.ts --provider openai --model deepseek-chat --all
  npx tsx scripts/audit-achievements.ts --output audit-report.json
`;
  console.log(h);
}

// ── Prompt building ───────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an achievement definition auditor. Your job is to verify that natural-language achievement descriptions match their programmatic conditions.

## AGPA Condition Types (11 total)

1. **counter** — Simple counter: fires when event count >= value. No deduplication. Supports \`same_target\` (same entity required) and \`max_per_day\`.
2. **threshold** — Sums a numeric field across matching events: e.g. total duration, total edits. Supports \`metric\` expressions (like \`length\` for prompt word count, \`duration\` for elapsed time). \`per_event: true\` checks each event individually rather than summing.
3. **streak** — Consecutive days (or event occurrences on consecutive days). Standard streak uses calendar days. \`event_level\` streak checks consecutive event occurrences without calendar gap requirement.
4. **sequence** — Events must occur in a specific ordered sequence (e.g. tool A → tool B → tool C). Supports \`consecutive\` mode (longest run) and nested \`count\` with operator/value.
5. **distinct_count** — Count of distinct values for a field (e.g. different languages used, different tools). Supports \`values\` whitelist to restrict which values count.
6. **event** — Simple existence check: fires if at least one matching event occurred.
7. **mode** — Most frequent value of a field. Requires \`in_range\` and \`threshold\` parameters.
8. **set_completion** — Completion of a set of achievements. Uses YAML \`set\` definitions. Supports \`all\`, \`rarity\`, \`include_above\`, \`exclude_hidden\` filters.
9. **ratio** — Ratio between two conditions (\`numerator\` / \`denominator\`). Each is a nested Condition or event reference string.
10. **pattern_match** — Content matching a regex pattern. Uses \`pattern\` (array of strings or single string). Supports \`role\` (participant in conversation) and \`field\` to specify which message field to check.
11. **sequence_count** — Count how many times a sequence pattern occurs. Similar to sequence but counts repetitions instead of requiring ordered match.

## Window types
- \`single_session\` / \`same_session\` — Events within one session only
- \`single_task\` / \`same_task\` — Events within one task only
- \`<N>h\` — Within N hours
- \`<N>d\` — Within N days
- \`all\` / \`lifetime\` — Cumulative across all time (no window limit)
- Default (no window): events in the last 24h

## What to check for each achievement

1. **B-Semantic**: Does the condition type correctly capture the description's intent? (e.g. "N different languages" should use \`distinct_count\`, not \`counter\`)
2. **B-Event**: Does the event name match what the description is about? (e.g. "Edit N files" should use \`file.edit\`, not \`tool.complete\`)
3. **B-Window**: Are the window/scoping constraints correct? (e.g. "single session" needs \`window: single_session\`)
4. **B-Operator**: Is the comparison operator consistent with the description? (e.g. "at least 5" needs \`operator: >=\`, "more than 5" needs \`operator: >\`)
5. **C-Missing**: Does the description mention any constraint or qualifier that the conditions don't enforce?
6. **C-Extra**: Do the conditions enforce something the description doesn't mention? (e.g. unexpected filter or window)

For each check, set \`ok: true\` if the condition is correct, or \`ok: false\` with a clear \`issue\` explaining the problem.

For the overall \`verdict\`:
- **pass** — All checks ok or only trivial issues
- **warn** — Minor ambiguities or potential improvements (doesn't prevent proper function)
- **fail** — Description and conditions actively contradict each other`;
}

function buildUserPromptForBatch(achievements: BatchAchievementCard[]): string {
  const cards = achievements.map((a, i) => {
    const condsStr = JSON.stringify(a.conditions, null, 2);
    return `## Achievement ${i + 1}: ${a.id}
- Name: ${a.name}${a.name_cn ? ` / ${a.name_cn}` : ''}
- Description: ${a.description}${a.description_cn ? ` / ${a.description_cn}` : ''}
- Category: ${a.category}
- Rarity: ${a.rarity}${a.hidden ? ' (hidden)' : ''}${a.challenge ? ' (challenge)' : ''}
- Conditions:
\`\`\`json
${condsStr}
\`\`\``;
  });

  return `Please audit the following ${achievements.length} achievement definitions. For each one, check that the description and conditions are semantically consistent.

${cards.join('\n\n')}`;
}

// ── API calls ─────────────────────────────────────────────────────────────

async function callAnthropic(
  config: AuditLLMConfig,
  systemPrompt: string,
  userPrompt: string,
  batchSize: number,
): Promise<BatchResult> {
  const url = `${config.baseUrl}/v1/messages`;
  const toolSchema = buildToolSchema(batchSize);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [toolSchema],
      tool_choice: { type: 'tool', name: 'audit_batch' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; name?: string; input?: unknown }>;
  };

  const toolUse = data.content?.find(c => c.type === 'tool_use' && c.name === 'audit_batch');
  if (!toolUse?.input) {
    throw new Error('Anthropic: no audit_batch tool_use in response');
  }

  return toolUse.input as BatchResult;
}

async function callOpenAI(
  config: AuditLLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<BatchResult> {
  const url = `${config.baseUrl}/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${userPrompt}\n\nRespond with a JSON object matching this schema:\n{\n  "achievements": [\n    {\n      "id": "achievement_id",\n      "pass": true/false,\n      "b_semantic": { "ok": true/false, "issue": "..." },\n      "b_event": { "ok": true/false, "issue": "..." },\n      "b_window": { "ok": true/false, "issue": "..." },\n      "b_operator": { "ok": true/false, "issue": "..." },\n      "c_missing": { "ok": true/false, "constraint": "..." },\n      "c_extra": { "ok": true/false, "constraint": "..." },\n      "suggestions": ["suggestion1", "suggestion2"],\n      "verdict": "pass" | "warn" | "fail"\n    }\n  ]\n}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI: empty response');
  }

  return JSON.parse(content) as BatchResult;
}

function buildToolSchema(batchSize: number) {
  return {
    name: 'audit_batch',
    description: `Audit a batch of up to ${batchSize} achievement definitions for semantic consistency between descriptions and conditions`,
    input_schema: {
      type: 'object',
      properties: {
        achievements: {
          type: 'array',
          description: `Audit results for ${batchSize} achievements`,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Achievement ID' },
              pass: {
                type: 'boolean',
                description: 'True if this achievement passes all semantic checks (no contradictions)',
              },
              b_semantic: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  issue: { type: 'string', description: 'Description of the semantic mismatch, if any' },
                },
                required: ['ok'],
              },
              b_event: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  issue: { type: 'string', description: 'Description of the event mismatch, if any' },
                },
                required: ['ok'],
              },
              b_window: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  issue: { type: 'string', description: 'Description of the window/scoping mismatch, if any' },
                },
                required: ['ok'],
              },
              b_operator: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  issue: { type: 'string', description: 'Description of the operator mismatch, if any' },
                },
                required: ['ok'],
              },
              c_missing: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean', description: 'True if no constraints are mentioned in description that conditions miss' },
                  constraint: { type: 'string', description: 'The missing constraint, if any' },
                },
                required: ['ok'],
              },
              c_extra: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean', description: 'True if conditions don\'t enforce anything not in the description' },
                  constraint: { type: 'string', description: 'The extra/unexpected constraint, if any' },
                },
                required: ['ok'],
              },
              suggestions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggested improvements or fixes',
              },
              verdict: {
                type: 'string',
                enum: ['pass', 'warn', 'fail'],
                description: 'pass=all good, warn=minor ambiguity, fail=description contradicts conditions',
              },
            },
            required: ['id', 'pass', 'b_semantic', 'b_event', 'b_window', 'b_operator', 'c_missing', 'c_extra', 'suggestions', 'verdict'],
          },
        },
      },
      required: ['achievements'],
    },
  };
}

// ─── Data helpers ────────────────────────────────────────────────────────

function prepareCards(achievements: BatchAchievementCard[]): BatchAchievementCard[] {
  return achievements.map(a => ({
    ...a,
    conditions: a.conditions.map(c => ({
      type: c.type,
      event: c.event,
      operator: c.operator,
      value: c.value,
      window: c.window,
      filter: c.filter,
      field: c.field,
      metric: c.metric,
      all: c.all,
      exclude_hidden: c.exclude_hidden,
      consecutive: c.consecutive,
      same_target: c.same_target,
      per_event: c.per_event,
      values: c.values,
      count: c.count,
      numerator: typeof c.numerator === 'string' ? c.numerator : undefined,
      denominator: typeof c.denominator === 'string' ? c.denominator : undefined,
    })),
  }));
}

function toCard(def: { id: string; name: string; name_cn?: string; description: string; description_cn?: string; category: string; rarity: string; hidden?: boolean; challenge?: boolean; conditions: BatchAchievementCard['conditions'] }): BatchAchievementCard {
  return {
    id: def.id,
    name: def.name,
    name_cn: def.name_cn,
    description: def.description,
    description_cn: def.description_cn,
    category: def.category,
    rarity: def.rarity,
    hidden: def.hidden,
    challenge: def.challenge,
    conditions: def.conditions,
  };
}

// ─── Report merging ─────────────────────────────────────────────────────

function mergeResults(batchResults: BatchResult[]): AuditAggregateReport {
  const allAchievements: AuditAggregateReport['achievements'] = [];
  let pass = 0;
  let warn = 0;
  let fail = 0;

  for (const batch of batchResults) {
    for (const a of batch.achievements) {
      allAchievements.push({
        id: a.id,
        verdict: a.verdict,
        pass: a.pass,
        details: {
          b_semantic: a.b_semantic,
          b_event: a.b_event,
          b_window: a.b_window,
          b_operator: a.b_operator,
          c_missing: a.c_missing,
          c_extra: a.c_extra,
        },
        suggestions: a.suggestions,
      });

      if (a.verdict === 'pass') pass++;
      else if (a.verdict === 'fail') fail++;
      else warn++;
    }
  }

  // Re-order to match the input order
  allAchievements.sort((a, b) => a.id.localeCompare(b.id));

  return {
    generated_at: new Date().toISOString(),
    config: {
      total_achievements: 0, // filled in main()
      audited: allAchievements.length,
      batches: batchResults.length,
      batch_size: 0, // filled in main()
      provider: '',  // filled in main()
      model: '',     // filled in main()
    },
    summary: { total: allAchievements.length, pass, warn, fail },
    achievements: allAchievements,
  };
}

// ─── Dry run: print prompts ─────────────────────────────────────────────

function printDryRun(
  batches: BatchAchievementCard[][],
  systemPrompt: string,
): void {
  console.log('%s\n%s\n', '='.repeat(60), 'SYSTEM PROMPT');
  console.log(systemPrompt);

  for (let i = 0; i < batches.length; i++) {
    console.log('\n%s', '='.repeat(60));
    console.log('BATCH %d (%d achievements)', i + 1, batches[i].length);
    console.log('%s\n', '='.repeat(60));
    console.log(buildUserPromptForBatch(batches[i]));
  }
}

// ─── Load YAML definitions ──────────────────────────────────────────────

function loadYamlDefinitions(yamlPath?: string): {
  definitions: BatchAchievementCard[];
  yamlUsed: string;
} {
  const candidates = yamlPath
    ? [yamlPath]
    : [
        path.resolve(PROJECT_ROOT, 'achievement-definitions.yaml'),
        path.resolve(PROJECT_ROOT, 'achievements_define.yaml'),
      ];

  let yamlFile = '';
  for (const c of candidates) {
    if (fs.existsSync(c)) { yamlFile = c; break; }
  }

  if (!yamlFile) {
    console.error('❌ YAML file not found. Checked:', candidates.join(', '));
    process.exit(1);
  }

  const yamlText = fs.readFileSync(yamlFile, 'utf8');
  const { definitions } = parseYAML(yamlText);

  const cards = definitions
    .filter(d => !d.future)
    .map(d => toCard({
      id: d.id,
      name: d.name,
      name_cn: d.name_cn,
      description: d.description,
      description_cn: d.description_cn,
      category: d.category,
      rarity: d.rarity,
      hidden: d.hidden,
      challenge: d.challenge,
      conditions: d.conditions as BatchAchievementCard['conditions'],
    }));

  return { definitions: cards, yamlUsed: yamlFile };
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const opts = parseArgs();

  // 1. Load YAML definitions
  const { definitions: allDefs, yamlUsed } = loadYamlDefinitions(opts.yamlPath);
  const totalAchievements = allDefs.length;

  // 2. Determine which achievements to audit
  let toAudit: BatchAchievementCard[];
  if (opts.all) {
    toAudit = allDefs;
  } else {
    // Run Phase 1 auditor to get the flagged list
    const yamlText = fs.readFileSync(yamlUsed, 'utf8');
    const { definitions: fullDefs } = parseYAML(yamlText);
    const report = auditAchievements(
      fullDefs.map(d => ({
        ...d,
        conditions: d.conditions as BatchAchievementCard['conditions'],
      })) as Parameters<typeof auditAchievements>[0],
    );
    const flaggedSet = new Set(report.needsLLMReview);
    toAudit = allDefs.filter(d => flaggedSet.has(d.id));

    if (opts.verbose) {
      console.log('📋 Phase 1 auditor flagged %d/%d achievements for LLM review', toAudit.length, totalAchievements);
    }
  }

  if (toAudit.length === 0) {
    console.log('✅ No achievements need LLM audit.');
    return 0;
  }

  // 3. Prepare config
  const provider = (opts.provider === 'openai' ? 'openai' : 'anthropic') as 'anthropic' | 'openai';
  const apiKey = opts.apiKey || (provider === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY);

  if (!apiKey && !opts.dryRun) {
    console.error('❌ No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY, or use --api-key.');
    console.error('   Use --dry-run to build prompts without calling API.');
    return 1;
  }

  const config: AuditLLMConfig = {
    provider,
    apiKey: apiKey || '',
    baseUrl: opts.baseUrl || (provider === 'anthropic'
      ? 'https://api.anthropic.com'
      : 'https://api.openai.com/v1'),
    model: opts.model || (provider === 'anthropic'
      ? 'claude-sonnet-4-20250514'
      : 'deepseek-chat'),
  };

  // 4. Batch achievements
  const batchSize = Math.max(1, Math.min(opts.batchSize, 50));
  const batches: BatchAchievementCard[][] = [];
  for (let i = 0; i < toAudit.length; i += batchSize) {
    batches.push(prepareCards(toAudit.slice(i, i + batchSize)));
  }

  // 5. Build system prompt (shared across all batches)
  const systemPrompt = buildSystemPrompt();
  if (opts.verbose) {
    console.log('🧠 System prompt: ~%d chars', systemPrompt.length);
  }

  // 6. Dry run
  if (opts.dryRun) {
    printDryRun(batches, systemPrompt);
    console.log('\n── Summary ──');
    console.log('Total achievements: %d', totalAchievements);
    console.log('To audit: %d (%d batches of %d)', toAudit.length, batches.length, batchSize);
    console.log('Provider: %s | Model: %s', config.provider, config.model);
    return 0;
  }

  // 7. Call LLM for each batch
  if (opts.verbose) {
    console.log('🔍 Auditing %d achievements in %d batches (batch size: %d)...', toAudit.length, batches.length, batchSize);
    console.log('   Provider: %s  Model: %s', config.provider, config.model);
  }

  const batchResults: BatchResult[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const userPrompt = buildUserPromptForBatch(batch);

    if (opts.verbose) {
      console.log('   Batch %d/%d (%d achievements)...', i + 1, batches.length, batch.length);
    }

    try {
      const result = provider === 'anthropic'
        ? await callAnthropic(config, systemPrompt, userPrompt, batch.length)
        : await callOpenAI(config, systemPrompt, userPrompt);

      batchResults.push(result);

      if (opts.verbose) {
        const passCount = result.achievements.filter(a => a.verdict === 'pass').length;
        const warnCount = result.achievements.filter(a => a.verdict === 'warn').length;
        const failCount = result.achievements.filter(a => a.verdict === 'fail').length;
        console.log('      ✓ %d pass, ⚠ %d warn, ❌ %d fail', passCount, warnCount, failCount);
      }
    } catch (err) {
      console.error('❌ Batch %d failed:', i + 1, err instanceof Error ? err.message : err);
      // Continue with remaining batches
    }
  }

  if (batchResults.length === 0) {
    console.error('❌ All batches failed. No results.');
    return 1;
  }

  // 8. Merge and output
  const report = mergeResults(batchResults);
  report.config = {
    total_achievements: totalAchievements,
    audited: toAudit.length,
    batches: batches.length,
    batch_size: batchSize,
    provider: config.provider,
    model: config.model,
  };

  const reportJson = JSON.stringify(report, null, 2);

  if (opts.output) {
    fs.writeFileSync(opts.output, reportJson, 'utf8');
    console.log('\n📄 Report written to: %s', opts.output);
  } else {
    console.log('\n%s', reportJson);
  }

  // 9. Summary
  const { summary } = report;
  const total = summary.pass + summary.warn + summary.fail;
  console.log('\n── Audit Complete ──');
  console.log('   Total: %d | Pass: %d | Warn: %d | Fail: %d', total, summary.pass, summary.warn, summary.fail);

  if (summary.fail > 0) {
    console.log('\n❌ FAIL achievements:');
    for (const a of report.achievements.filter(a => a.verdict === 'fail')) {
      console.log('   - %s', a.id);
    }
  }
  if (summary.warn > 0) {
    console.log('\n⚠️  WARN achievements:');
    for (const a of report.achievements.filter(a => a.verdict === 'warn')) {
      console.log('   - %s', a.id);
    }
  }

  // Exit code: 0 = all pass, 1 = has warn, 2 = has fail
  if (summary.fail > 0) return 2;
  if (summary.warn > 0) return 1;
  return 0;
}

// ─── Entry ────────────────────────────────────────────────────────────────

const isDirectlyExecuted = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectlyExecuted) {
  main().then(code => process.exit(code)).catch(err => {
    console.error('❌ Fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

// ─── Exports for testing ──────────────────────────────────────────────────

export {
  buildSystemPrompt,
  buildUserPromptForBatch,
  buildToolSchema,
  mergeResults,
  prepareCards,
  toCard,
  loadYamlDefinitions,
  parseArgs,
};
