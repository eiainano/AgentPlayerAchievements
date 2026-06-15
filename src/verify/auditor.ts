/**
 * Achievement Auditor — Rule Engine (Phase 1)
 *
 * Three-layer verification that YAML descriptions match condition definitions:
 *   Layer A: Numeric / window / operator consistency (regex-extractable)
 *   Layer B: Semantic consistency (condition type, event, window patterns)
 *   Layer C: (delegated to LLM audit script — flagged via needsLLMReview)
 *
 * Runs deterministically — suitable for CI (vitest).
 */

import type { AchievementDefinition, Condition } from '../engine/types.js';

// ── Types ────────────────────────────────────────────────────────────

export interface AuditFinding {
  id: string;
  layer: 'A' | 'B';
  severity: 'error' | 'warn';
  field: string;        // e.g. "description", "description_cn", "conditions[0].value"
  message: string;
  expected: string;     // human-readable, what the description implies
  actual: string;       // human-readable, what the conditions say
}

export interface AuditReport {
  total: number;
  passed: number;
  findings: AuditFinding[];
  needsLLMReview: string[];
}

// ── Layer A: Numeric value extraction ─────────────────────────────────

interface ExtractedNumber {
  value: number | 'all';
  raw: string;          // original matched text
  subject: string;      // the word after the number ("tasks", "files", etc.)
  index: number;        // character position in the string
}

/** Extract numbers followed by a subject word from English text. */
function extractNumbersEN(text: string): ExtractedNumber[] {
  const results: ExtractedNumber[] = [];

  // Comma-formatted large numbers: "1,000 tasks", "50,000 characters"
  const commaNum = /(\d{1,3}(?:,\d{3})+(?:,\d{3})*)\s*(tokens?|characters?|lines?|words?|files?|tasks?|edits?|calls?|steps?|prompts?)/gi;
  for (const m of text.matchAll(commaNum)) {
    results.push({
      value: parseInt(m[1]!.replace(/,/g, ''), 10),
      raw: m[0]!,
      subject: m[2]!.toLowerCase().replace(/s$/, ''),
      index: m.index!,
    });
  }

  // N+ / "at least N" patterns
  const atLeast = /\b(\d+)\+\s*(tasks?|files?|tools?|times?|sessions?|steps?|days?|images?|tests?|edits?|commands?|errors?|conversations?|languages?|calls?|prompts?|questions?|tools?)/gi;
  for (const m of text.matchAll(atLeast)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: m[2]!.toLowerCase().replace(/s$/, ''),
      index: m.index!,
    });
  }

  // "at least N X"
  const atLeast2 = /\bat least\s+(\d+)\s+(tasks?|files?|tools?|times?|sessions?|steps?|days?|images?|tests?|edits?|commands?|errors?|conversations?|languages?|calls?|prompts?|questions?)\b/gi;
  for (const m of text.matchAll(atLeast2)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: m[2]!.toLowerCase().replace(/s$/, ''),
      index: m.index!,
    });
  }

  // "more than N X" / "over N X"
  const moreThan = /\b(?:more than|over)\s+(\d+)\s+(tasks?|files?|tools?|times?|sessions?|steps?|days?|images?|tests?|edits?|commands?|errors?|conversations?|languages?|calls?|prompts?|questions?)\b/gi;
  for (const m of text.matchAll(moreThan)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: m[2]!.toLowerCase().replace(/s$/, ''),
      index: m.index!,
    });
  }

  // Standard "N X" pattern: "5 tasks", "10 files", "3 hours", "100 files"
  // But NOT inside "within N hours" (handled by window extraction)
  // Also NOT partial matches inside comma-formatted numbers (e.g. "000" inside "1,000")
  const stdNum = /\b(\d+)\s+(tasks?|files?|tools?|times?|sessions?|steps?|days?|images?|tests?|edits?|commands?|errors?|conversations?|languages?|calls?|prompts?|questions?|turns?|hours?)\b/gi;
  for (const m of text.matchAll(stdNum)) {
    // Skip if this digit is preceded by a comma (part of a comma-formatted number)
    if (m.index! > 0 && text[m.index! - 1] === ',') continue;

    // Skip if this is already covered by a comma-formatted or at-least match
    // at the same position
    const overlaps = results.some(r => r.index === m.index);
    if (!overlaps) {
      // Skip "N hours" inside "within N hours" (window patterns)
      if (m[2]!.toLowerCase().startsWith('hour')) {
        if (/\bwithin\s+\d+\s+hours?\b/i.test(text.slice(Math.max(0, m.index! - 20), m.index! + 20))) {
          continue;
        }
      }
      results.push({
        value: parseInt(m[1]!, 10),
        raw: m[0]!,
        subject: m[2]!.toLowerCase().replace(/s$/, ''),
        index: m.index!,
      });
    }
  }

  // "all" / "every" → signals set_completion
  const allMatch = /\b(all|every)\s+(achievements?|tasks?|files?|tools?)\b/gi;
  for (const m of text.matchAll(allMatch)) {
    results.push({
      value: 'all',
      raw: m[0]!,
      subject: m[2]!.toLowerCase(),
      index: m.index!,
    });
  }

  return results;
}

/** Extract numbers followed by a subject word from Chinese text. */
function extractNumbersCN(text: string): ExtractedNumber[] {
  const results: ExtractedNumber[] = [];

  // "N 个/次/种/天/步/张/条/轮/门/句 X" — Chinese measure words
  const cnNum = /(\d+)\s*(?:个|次|种|天|步|张|条|轮|门|句)\s*(task|文件|工具|次|session|天|图|图片|测试|编辑|命令|错误|对话|语言|调用|prompt|问题|小时|工具)/gi;
  for (const m of text.matchAll(cnNum)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: m[2]!.toLowerCase(),
      index: m.index!,
    });
  }

  // "N 以上" / "≥ N"
  const cnAbove = /(\d+)\s*(?:以上|个以上|次以上|种以上)/g;
  for (const m of text.matchAll(cnAbove)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: '',
      index: m.index!,
    });
  }

  // "≥ N"
  const cnGe = /≥\s*(\d+)/g;
  for (const m of text.matchAll(cnGe)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: '',
      index: m.index!,
    });
  }

  // "首次" / "第一次"
  const cnFirst = /(?:首次|第一次)/g;
  for (const m of text.matchAll(cnFirst)) {
    results.push({
      value: 1,
      raw: m[0]!,
      subject: '',
      index: m.index!,
    });
  }

  // "全部" / "所有"
  const cnAll = /(?:全部|所有)\s*(成就|的)?/g;
  for (const m of text.matchAll(cnAll)) {
    results.push({
      value: 'all',
      raw: m[0]!,
      subject: 'achievements',
      index: m.index!,
    });
  }

  // "超过 N" / "大于 N"
  const cnOver = /(?:超过|大于)\s*(\d+)/g;
  for (const m of text.matchAll(cnOver)) {
    results.push({
      value: parseInt(m[1]!, 10),
      raw: m[0]!,
      subject: '',
      index: m.index!,
    });
  }

  return results;
}

/** Check if "first" / "first time" patterns exist in description */
function hasFirstMention(text: string): boolean {
  return /\b(first|for the first time|first time|your first)\b/i.test(text);
}

// ── Layer A: Operator inference ──────────────────────────────────────

interface InferredOp {
  operator: string;
  reason: string;
}

function inferOperatorEN(text: string): InferredOp | null {
  if (/\bat least\b/i.test(text) || /\d+\+/i.test(text)) {
    return { operator: '>=', reason: `"at least" / "+" in: ${text.slice(0, 80)}` };
  }
  // "more than"/"over" — but only when followed by a number (e.g. "over 20 times"),
  // not when preceding a word threshold ("over 100 words": the "over" modifies
  // the word count, not the count of prompts)
  if (/\bmore than\s+\d+\s+(?:tasks?|files?|tools?|times?|sessions?|steps?|days?|images?|tests?|edits?|commands?|errors?|conversations?|languages?|calls?|prompts?|questions?)/i.test(text)) {
    return { operator: '>', reason: `"more than" in: ${text.slice(0, 80)}` };
  }
  // "over N X" — same constraint but only when X is a count subject
  if (/\bover\s+\d+\s+(?:tasks?|files?|tools?|times?|sessions?|days?|errors?|calls?)\b/i.test(text)) {
    return { operator: '>', reason: `"over" in: ${text.slice(0, 80)}` };
  }
  if (/\bexactly\b/i.test(text)) {
    return { operator: '==', reason: `"exactly" in: ${text.slice(0, 80)}` };
  }
  if (hasFirstMention(text)) {
    return { operator: '>=', reason: `"first" implies at-least-1: ${text.slice(0, 80)}` };
  }
  return null;
}

function inferOperatorCN(text: string): InferredOp | null {
  if (/以上/.test(text) || /≥/.test(text)) {
    return { operator: '>=', reason: `"以上" / "≥" in: ${text.slice(0, 80)}` };
  }
  if (/超过/.test(text) || /大于/.test(text)) {
    return { operator: '>', reason: `"超过" / "大于" in: ${text.slice(0, 80)}` };
  }
  if (/首次/.test(text) || /第一次/.test(text)) {
    return { operator: '>=', reason: `"首次" / "第一次" implies at-least-1: ${text.slice(0, 80)}` };
  }
  return null;
}

// ── Layer A: Window extraction ───────────────────────────────────────

interface ExtractedWindow {
  window: string;
  raw: string;
}

function extractWindowEN(text: string): ExtractedWindow | null {
  if (/\bsingle (?:session|conversation)\b/i.test(text) || /\bsame session\b/i.test(text)) {
    return { window: 'single_session', raw: text.match(/\b(?:single|same)\s+session\b/i)?.[0] || 'single session' };
  }
  if (/\bsingle task\b/i.test(text) || /\bsame task\b/i.test(text) || /\bone task\b/i.test(text)) {
    return { window: 'single_task', raw: text.match(/\b(?:single|same|one)\s+task\b/i)?.[0] || 'single task' };
  }
  const withinH = /\bwithin\s+(\d+)\s+hours?\b/i.exec(text);
  if (withinH) {
    return { window: `${withinH[1]}h`, raw: withinH[0]! };
  }
  if (/\bcumulative(?:ly)?\b/i.test(text) || /\bever\b/i.test(text) || /\blifetime\b/i.test(text)) {
    return { window: 'all', raw: text.match(/\b(?:cumulatively|cumulative|ever|lifetime)\b/i)?.[0] || 'all' };
  }
  if (/\bso far\b/i.test(text) || /\bin total\b/i.test(text)) {
    return { window: 'all', raw: text.match(/\b(?:so far|in total)\b/i)?.[0] || 'all' };
  }
  return null;
}

function extractWindowCN(text: string): ExtractedWindow | null {
  if (/单\s*session/.test(text) || /同一\s*session/.test(text) || /单次对话/.test(text)) {
    return { window: 'single_session', raw: text.match(/(?:单\s*session|同一\s*session|单次对话)/i)?.[0] || '单 session' };
  }
  if (/单\s*task/.test(text) || /同一\s*task/.test(text) || /单次\s*task/.test(text)) {
    return { window: 'single_task', raw: text.match(/(?:单\s*task|同一\s*task|单次\s*task)/i)?.[0] || '单 task' };
  }
  const withinH = /(\d+)\s*小时/i.exec(text);
  if (withinH) {
    return { window: `${withinH[1]}h`, raw: withinH[0]! };
  }
  if (/累计/.test(text) || /总计/.test(text) || /一生/.test(text)) {
    return { window: 'all', raw: '累计' };
  }
  return null;
}

// ── Layer A: Checks ──────────────────────────────────────────────────

function checkLayerA(def: AchievementDefinition): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Check English description
  const enNums = extractNumbersEN(def.description);
  const enWindow = extractWindowEN(def.description);
  const enOp = inferOperatorEN(def.description);

  // Check Chinese description if present
  const cnNums = def.description_cn ? extractNumbersCN(def.description_cn) : [];
  const cnWindow = def.description_cn ? extractWindowCN(def.description_cn) : null;
  const cnOp = def.description_cn ? inferOperatorCN(def.description_cn) : null;

  // Flatten conditions for easy access
  const allConds = def.conditions;

  // Skip numeric check if audit_ignore_numeric is set
  const ignoreNumeric = (def as unknown as Record<string, unknown>).audit_ignore_numeric === true;

  if (!ignoreNumeric) {
    // A1: Check numeric values against condition values
    for (const num of [...enNums, ...cnNums]) {
      if (num.value === 'all') continue; // handled by B layer (set_completion check)
      const matched = allConds.some(c =>
        c.value === num.value ||
        // sequence with consecutve count → check nested count.value
        (c.type === 'sequence' && c.count?.value === num.value) ||
        // sequence_count uses pattern length * value — value alone is the repeat count
        (c.type === 'sequence_count' && c.value === num.value),
      );
      if (!matched && num.subject && !isTimeSubject(num.subject)) {
        findings.push({
          id: def.id,
          layer: 'A',
          severity: 'warn',
          field: 'description',
          message: `Description says "${num.raw}" (${num.value}) but no condition has value=${num.value}`,
          expected: String(num.value),
          actual: `condition values: ${allConds.map(c => c.value).join(', ')}`,
        });
      }
    }

    // A2: Check window against condition window
    const extWindow = enWindow || cnWindow;
    if (extWindow && extWindow.window !== 'all') {
      // per_event on naturally-scoped events already enforces single-instance
      const hasWindow = isPerEventScoped(allConds) || allConds.some(c =>
        c.window === extWindow.window ||
        (extWindow.window === 'single_session' && (c.window === 'same_session' || c.window === 'single_session')) ||
        (extWindow.window === 'single_task' && (c.window === 'same_task' || c.window === 'single_task')) ||
        (extWindow.window.endsWith('h') && c.window === extWindow.window),
      );
      if (!hasWindow) {
        findings.push({
          id: def.id,
          layer: 'A',
          severity: 'error',
          field: 'description',
          message: `Description says "${extWindow.raw}" but no condition has window="${extWindow.window}"`,
          expected: extWindow.window,
          actual: `condition windows: ${allConds.map(c => c.window || 'default(24h)').join(', ')}`,
        });
      }
    }

    // A3: Check operator consistency
    const extOp = enOp || cnOp;
    if (extOp) {
      for (const c of allConds) {
        if (c.type === 'set_completion' || c.type === 'event' || c.type === 'pattern_match') continue;
        // Skip operator check for negative constraints (value==0 is intentional exact match)
        if (c.value === 0 && c.operator === '==') continue;
        // "first" + value > 1 is suspicious
        if (hasFirstMention(def.description) && c.value > 1 && c.operator !== '<=') {
          findings.push({
            id: def.id,
            layer: 'A',
            severity: 'warn',
            field: `conditions[${allConds.indexOf(c)}].value`,
            message: `Description says "first" but condition has value=${c.value}`,
            expected: 'value=1 (for "first" achievement)',
            actual: `value=${c.value}`,
          });
        }
        // Check operator mismatch
        if (extOp.operator !== c.operator && c.operator) {
          // Only flag when desc says >= but condition is == (strict mismatch)
          if ((extOp.operator === '>=' && c.operator === '==') ||
              (extOp.operator === '>' && c.operator === '>=')) {
            findings.push({
              id: def.id,
              layer: 'A',
              severity: 'warn',
              field: `conditions[${allConds.indexOf(c)}].operator`,
              message: `Description implies "${extOp.operator}" (${extOp.reason}) but condition uses "${c.operator}"`,
              expected: extOp.operator,
              actual: c.operator,
            });
          }
        }
      }
    }
  }

  return findings;
}

function isTimeSubject(subject: string): boolean {
  return ['hour', 'hours', 'year', 'years', 'month', 'months', 'minute', 'minutes', 'second', 'seconds'].includes(subject.toLowerCase());
}

// ── Layer B: Condition type ↔ description intent ─────────────────────

const TYPE_HINTS_EN: Array<{ pattern: RegExp; expectedType: string; message: string }> = [
  { pattern: /\b\d+\s*different\b/i, expectedType: 'distinct_count', message: '"N different" implies distinct_count (deduplication), not just counter' },
  { pattern: /\b\d+\s*consecutive\b/i, expectedType: 'streak', message: '"N consecutive" implies streak (temporal adjacency), not just counter' },
  { pattern: /\b\d+\s*unique\b/i, expectedType: 'distinct_count', message: '"N unique" implies distinct_count' },
  { pattern: /\bratio\b|\bpercentage\b|%\b/i, expectedType: 'ratio', message: '"ratio/percentage" implies ratio condition type' },
  { pattern: /\ball\s+achievements\b/i, expectedType: 'set_completion', message: '"all achievements" implies set_completion' },
  // pattern_match is rare and descriptions usually talk about content, not the condition type.
  // LLM audit handles these cases. Unambiguous numeric patterns above are handled by distinct_count/streak.
  // "mode" excluded when preceded by "permission" or "plan" (different meaning)
  { pattern: /\bmost common\b|(?:^|(?<!(?:permission\s|plan\s)))\bmode\b/i, expectedType: 'mode', message: '"most common/mode" implies mode condition type' },
];

const TYPE_HINTS_CN: Array<{ pattern: RegExp; expectedType: string; message: string }> = [
  { pattern: /种不同/, expectedType: 'distinct_count', message: '"N 种不同" 暗示 distinct_count（去重），而非 counter' },
  { pattern: /连续/, expectedType: 'streak', message: '"连续" 暗示 streak（时序连续性），而非 counter' },
  { pattern: /占比|比率|比例|%/, expectedType: 'ratio', message: '"占比/比率" 暗示 ratio 条件类型' },
  { pattern: /全部.*成就|所有.*成就/, expectedType: 'set_completion', message: '"全部/所有成就" 暗示 set_completion' },
];

function checkLayerB(def: AchievementDefinition): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const allConds = def.conditions;

  // B1: Condition type matches description intent
  for (const hint of TYPE_HINTS_EN) {
    if (hint.pattern.test(def.description)) {
      const hasType = allConds.some(c => c.type === hint.expectedType);
      if (!hasType && hint.expectedType !== 'set_completion') {
        // set_completion is special — skip if not found, handled by LLM
        findings.push({
          id: def.id,
          layer: 'B',
          severity: 'error',
          field: 'description',
          message: hint.message,
          expected: hint.expectedType,
          actual: `condition types: ${allConds.map(c => c.type).join(', ')}`,
        });
      }
    }
  }

  // CN hints
  for (const hint of TYPE_HINTS_CN) {
    if (def.description_cn && hint.pattern.test(def.description_cn)) {
      const hasType = allConds.some(c => c.type === hint.expectedType);
      if (!hasType && hint.expectedType !== 'set_completion') {
        findings.push({
          id: def.id,
          layer: 'B',
          severity: 'error',
          field: 'description_cn',
          message: hint.message,
          expected: hint.expectedType,
          actual: `condition types: ${allConds.map(c => c.type).join(', ')}`,
        });
      }
    }
  }

  // B2: Window required by description semantics
  const enWindow = extractWindowEN(def.description);
  const cnWindow = def.description_cn ? extractWindowCN(def.description_cn) : null;

  if (enWindow) {
    checkWindowPresence(def, enWindow, findings);
  } else if (cnWindow) {
    checkWindowPresence(def, cnWindow, findings);
  }

  // B3: Event type vs description subject
  for (const c of allConds) {
    if (!c.event || c.type === 'set_completion') continue;
    const subjectsFromDesc = extractSubjects(def.description);
    const subjectsFromDescCN = def.description_cn ? extractSubjects(def.description_cn) : [];

    // Check if any condition event maps reasonably to at least one subject
    const allSubjects = [...subjectsFromDesc, ...subjectsFromDescCN];
    if (allSubjects.length > 0 && !eventMatchesAnySubject(c.event, allSubjects)) {
      findings.push({
        id: def.id,
        layer: 'B',
        severity: 'warn',
        field: `conditions.event: "${c.event}"`,
        message: `Event "${c.event}" doesn't obviously match any subject mentioned in the description (${allSubjects.join(', ')})`,
        expected: 'event matching description subject',
        actual: c.event,
      });
    }
  }

  // B4: Filter required by description qualifiers
  for (const c of allConds) {
    if (!c.event || c.type === 'set_completion') continue;
    checkFilterPresence(def, c, findings);
  }

  return findings;
}

/** per_event + a naturally-scoped event type already enforces single-instance semantics */
function isPerEventScoped(conds: Condition[]): boolean {
  return conds.some(c =>
    c.per_event === true &&
    c.event != null &&
    /^(session\.(start|end)|task\.(complete|create|update))$/.test(c.event),
  );
}

function checkWindowPresence(def: AchievementDefinition, ext: ExtractedWindow, findings: AuditFinding[]): void {
  if (ext.window === 'all') {
    // Cumulative/lifetime — warn if window is a short duration
    for (const c of def.conditions) {
      if (c.window && c.window !== 'all' && c.window !== 'lifetime') {
        const winMs = parseWindowMs(c.window);
        if (winMs > 0 && winMs < Infinity) {
          findings.push({
            id: def.id,
            layer: 'B',
            severity: 'warn',
            field: `conditions.window: "${c.window}"`,
            message: `Description says "${ext.raw}" (cumulative) but condition window is "${c.window}" (time-limited)`,
            expected: '"all" or "lifetime" (cumulative)',
            actual: `"${c.window}"`,
          });
        }
      }
    }
  }

  // per_event on naturally-scoped events already enforces single-instance semantics
  // (e.g. session.end with per_event checks each session's duration individually)
  if (isPerEventScoped(def.conditions)) return;

  if (ext.window === 'single_session') {
    const hasSessionWindow = def.conditions.some(c =>
      c.window === 'single_session' || c.window === 'same_session',
    );
    if (!hasSessionWindow) {
      findings.push({
        id: def.id,
        layer: 'B',
        severity: 'error',
        field: 'conditions[*].window',
        message: `Description says "${ext.raw}" but no condition has window="single_session" or "same_session"`,
        expected: 'window: single_session',
        actual: `windows: ${def.conditions.map(c => c.window || 'default(24h)').join(', ')}`,
      });
    }
  }

  if (ext.window === 'single_task') {
    const hasTaskWindow = def.conditions.some(c =>
      c.window === 'single_task' || c.window === 'same_task',
    );
    if (!hasTaskWindow) {
      findings.push({
        id: def.id,
        layer: 'B',
        severity: 'error',
        field: 'conditions[*].window',
        message: `Description says "${ext.raw}" but no condition has window="single_task" or "same_task"`,
        expected: 'window: single_task',
        actual: `windows: ${def.conditions.map(c => c.window || 'default(24h)').join(', ')}`,
      });
    }
  }
}

function extractSubjects(text: string): string[] {
  const subjects: string[] = [];
  const map: Record<string, RegExp> = {
    task: /\btasks?\b/i,
    tool: /\btools?\b|\btool call/i,
    session: /\bsessions?\b|\bconversation|\bdaily\b|\broutine\b|\bhabit\b/i,
    MCP: /\bMCP\b/i,
    image: /\bimages?\b|\bpicture/i,
    file: /\bfiles?\b/i,
    language: /\blanguages?\b|\bprogramming/i,
    permission: /\bpermission/i,
    automode: /\bautomode\b/i,
    agent: /\bagent\b/i,
    search: /\bsearch/i,
    slash: /\bslash\b/i,
    test: /\btests?\b/i,
    token: /\btokens?\b/i,
    error: /\berrors?\b/i,
    conversation: /\bconversation\b|\bmessages?\b/i,
    command: /\bcommand/i,
    achievement: /\bachievement/i,
    dashboard: /\bdashboard/i,
    prompt: /\bprompts?\b/i,
  };

  for (const [subject, re] of Object.entries(map)) {
    if (re.test(text)) subjects.push(subject);
  }
  return subjects;
}

function eventMatchesAnySubject(event: string, subjects: string[]): boolean {
  const map: Record<string, string[]> = {
    'task.complete': ['task'],
    'task.create': ['task'],
    'task.update': ['task'],
    'tool.complete': ['tool', 'search', 'slash', 'command'],
    'session.start': ['session'],
    'session.end': ['session'],
    'mcp.connect': ['MCP'],
    'mcp.server_used': ['MCP'],
    'mcp.tool_call': ['MCP', 'tool'],
    'image.upload': ['image'],
    'image.read': ['image'],
    'file.read': ['file'],
    'file.edit': ['file'],
    'file.write': ['file'],
    'file.create': ['file'],
    'file.delete': ['file'],
    'file.language_used': ['language'],
    'permission.mode_changed': ['permission'],
    'automode.start': ['automode'],
    'agent.self_fix': ['agent', 'error'],
    'agent.spawn': ['agent'],
    'agent.complete': ['agent'],
    'agent.end': ['agent'],
    'test.pass': ['test'],
    'test.fail': ['test'],
    'token.consumed': ['token'],
    'error.occurred': ['error'],
    'conversation.message': ['conversation', 'agent'],
    'command.run': ['command', 'slash'],
    'command.slash_used': ['slash', 'command'],
    'dashboard.opened': ['dashboard'],
    'user.prompt': ['prompt'],
    'achievement.unlocked': ['achievement'],
    'help.accessed': ['dashboard'],
    'plan.mode_entered': ['plan'],
    'plan.mode_exited': ['plan'],
  };

  const allowed = map[event] || [];
  return subjects.some(s => allowed.includes(s));
}

function checkFilterPresence(def: AchievementDefinition, cond: Condition, findings: AuditFinding[]): void {
  // Check if description mentions specific tool names
  const toolMentions: Array<{ tool: string; pattern: RegExp }> = [
    { tool: 'Search', pattern: /\bsearch\b(?!.*tool)/i },
    { tool: 'Read', pattern: /\bread\b/i },
    { tool: 'Edit', pattern: /\bedit\b/i },
    { tool: 'Write', pattern: /\bwrite\b/i },
    { tool: 'Bash', pattern: /\bbash\b/i },
  ];

  for (const { tool, pattern } of toolMentions) {
    if (pattern.test(def.description) && cond.event === 'tool.complete' && !cond.filter) {
      // Only warn if this is the only condition and it doesn't already have a filter
      // (filters are often used to narrow tool.complete to specific tools)
      // This is a soft check — many tool.complete counters are intentionally broad
    }
  }

  // Check for "search-type" qualifier
  if (/\bsearch[- ]type tools?\b/i.test(def.description) && !cond.filter) {
    findings.push({
      id: def.id,
      layer: 'B',
      severity: 'warn',
      field: 'conditions[*].filter',
      message: 'Description mentions "search-type tools" but condition has no filter to narrow to search tools',
      expected: 'filter: tool_name in [Search, ...]',
      actual: 'no filter',
    });
  }
}

function parseWindowMs(w: string): number {
  if (w === 'all' || w === 'lifetime') return Infinity;
  const m = /(\d+)\s*(h|d|m)/.exec(w);
  if (!m) return 0;
  const n = Number(m[1]);
  switch (m[2]) {
    case 'h': return n * 3600000;
    case 'd': return n * 86400000;
    case 'm': return n * 60000;
    default: return 0;
  }
}

// ── Layer C: Event reachability ───────────────────────────────────────

/**
 * Events emitted by hook.ts mapEvents() — automatic, no agent action needed.
 */
const HOOK_AUTO_EVENTS = new Set([
  'tool.complete', 'conversation.message',
  'file.read', 'file.create', 'file.write', 'file.edit', 'file.delete', 'file.language_used',
  'image.read', 'image.upload',
  'command.run', 'git.commit', 'git.add', 'git.pr_created', 'git.bisect', 'git.push',
  'merge.conflict_resolved',
  'mcp.tool_call',
  'task.create', 'task.update',
  'tool.failure', 'error.occurred',
  'tool.requested',
  'user.prompt', 'user.message',
  'agent.spawn', 'agent.end',
  'session.start', 'session.end',
  'task.complete', 'context.compacted',
]);

/**
 * Events emitted automatically by engine.ts / hook CLI — not manual.
 */
const ENGINE_AUTO_EVENTS = new Set([
  'achievement.unlocked',
  'deepseek.conversation',
  'token.consumed',
  'session.stats',
  'user.message.batch',
]);

/**
 * Events emitted by dashboard server.ts on page load.
 */
const DASHBOARD_EVENTS = new Set([
  'dashboard.opened',
]);

/**
 * Events listed in CLAUDE.md INSTRUCTION_BLOCK (src/cli/init.ts).
 * Agent is instructed to call achievement_track for these.
 * Also includes events that were recently added as manual tracking
 * (like skill.invoke, function.edited).
 */
const MANUAL_TRACK_EVENTS = new Set([
  'help.accessed',
  'permission.mode_changed', 'permission.dangerously_skipped',
  'tool.deny',
  'model.switch',
  'plan.mode_entered',
  'automode.start',
  'code.review_requested', 'code.review_completed',
  'test.pass', 'test.fail',
  'command.slash_used',
  'file.revert',
  'mcp.connect', 'mcp.server_used',
  'agent.self_fix', 'agent.created',
  'skill.created', 'skill.published', 'skill.invoke',
  'plugin.installed',
  'hook.configured',
  'command.created',
  'template.created',
  'config.file_edited',
  'worktree.created',
  'function.edited',
  'agent.mode_activated',
  'output.edit',
]);

/**
 * All known emitter sources combined for fast lookup.
 */
const ALL_KNOWN_EMITTERS = new Set<string>();
for (const set of [HOOK_AUTO_EVENTS, ENGINE_AUTO_EVENTS, DASHBOARD_EVENTS, MANUAL_TRACK_EVENTS]) {
  for (const e of set) ALL_KNOWN_EMITTERS.add(e);
}

/** Human-readable label for each emitter category */
function emitterCategory(event: string): string {
  if (HOOK_AUTO_EVENTS.has(event)) return 'hook_auto';
  if (ENGINE_AUTO_EVENTS.has(event)) return 'engine_auto';
  if (DASHBOARD_EVENTS.has(event)) return 'dashboard';
  if (MANUAL_TRACK_EVENTS.has(event)) return 'manual';
  return 'none';
}

/**
 * Extract all unique event types referenced by conditions in a definition.
 * Returns empty array for set_completion-only achievements (they don't reference events).
 */
function extractConditionEvents(def: AchievementDefinition): string[] {
  const events = new Set<string>();
  for (const c of def.conditions) {
    if (c.event) events.add(c.event);
  }
  return [...events];
}

function checkLayerC(def: AchievementDefinition): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const referencedEvents = extractConditionEvents(def);

  for (const event of referencedEvents) {
    const cat = emitterCategory(event);
    if (cat === 'none') {
      findings.push({
        id: def.id,
        layer: 'C',
        severity: 'error',
        field: `conditions.event: "${event}"`,
        message: `Event "${event}" has no emitter in the codebase (not in hook auto-map, engine auto-emit, dashboard, or manual tracking list)`,
        expected: `${event} should have at least one emitter source`,
        actual: 'no emitter found',
      });
    }
  }

  return findings;
}

// ── LLM flagging heuristic ───────────────────────────────────────────

function shouldFlagForLLM(def: AchievementDefinition, layerA: AuditFinding[], layerB: AuditFinding[], layerC: AuditFinding[]): boolean {
  // set_completion conditions — complex cross-achievement logic
  if (def.conditions.some(c => c.type === 'set_completion')) return true;

  // Multiple conditions of different types
  const types = new Set(def.conditions.map(c => c.type));
  if (types.size > 1) return true;

  // Description has no extractable numbers (figurative language)
  const enNums = extractNumbersEN(def.description);
  const cnNums = def.description_cn ? extractNumbersCN(def.description_cn) : [];
  if (enNums.length === 0 && cnNums.length === 0 && !hasFirstMention(def.description)) return true;

  // pattern_match or ratio — complex types worth human review
  if (def.conditions.some(c => c.type === 'pattern_match' || c.type === 'ratio')) return true;

  // Has errors or multiple warnings
  if (layerA.some(f => f.severity === 'error') || layerB.some(f => f.severity === 'error') || layerC.some(f => f.severity === 'error')) return true;
  if (layerA.length + layerB.length + layerC.length >= 2) return true;

  // Explicit marker
  if ((def as unknown as Record<string, unknown>).needs_llm_review === true) return true;

  return false;
}

// ── Main entry ───────────────────────────────────────────────────────

export function auditAchievements(defs: AchievementDefinition[]): AuditReport {
  const allFindings: AuditFinding[] = [];
  const needsLLM: string[] = [];
  let passed = 0;

  for (const def of defs) {
    if (def.future) { passed++; continue; }
    if (!def.conditions || def.conditions.length === 0) { passed++; continue; }

    const layerA = checkLayerA(def);
    const layerB = checkLayerB(def);
    const layerC = checkLayerC(def);
    const allForDef = [...layerA, ...layerB, ...layerC];

    allFindings.push(...allForDef);

    if (shouldFlagForLLM(def, layerA, layerB, layerC)) {
      needsLLM.push(def.id);
    }

    const hasErrors = allForDef.some(f => f.severity === 'error');
    if (!hasErrors) passed++;
  }

  return {
    total: defs.length,
    passed,
    findings: allFindings,
    needsLLMReview: [...new Set(needsLLM)].sort(),
  };
}

/**
 * Audit only errors (fatal). Warnings are informational.
 */
export function hasErrors(report: AuditReport): boolean {
  return report.findings.some(f => f.severity === 'error');
}

/**
 * Format a report as human-readable text for CLI output.
 */
export function formatReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`\n📋 Achievement Audit Report`);
  lines.push(`   Total: ${report.total} | Passed: ${report.passed} | Findings: ${report.findings.length}`);
  lines.push(`   Errors: ${report.findings.filter(f => f.severity === 'error').length} | Warnings: ${report.findings.filter(f => f.severity === 'warn').length}`);
  if (report.needsLLMReview.length > 0) {
    lines.push(`   🧠 Needs LLM Review: ${report.needsLLMReview.length} (${report.needsLLMReview.join(', ')})`);
  }
  lines.push('');

  for (const f of report.findings) {
    const icon = f.severity === 'error' ? '❌' : '⚠️';
    lines.push(`  ${icon} [${f.layer}] ${f.id} — ${f.message}`);
    lines.push(`     Expected: ${f.expected}`);
    lines.push(`     Actual:   ${f.actual}`);
    lines.push('');
  }

  return lines.join('\n');
}
