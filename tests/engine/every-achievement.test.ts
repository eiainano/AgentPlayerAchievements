/**
 * Approach B: Per-achievement trigger test (v2).
 *
 * For each of the 160 achievements, auto-generate minimal events that satisfy
 * its conditions, then verify the achievement unlocks.
 *
 * Data-driven regression test: catches evaluator regressions and YAML issues.
 */

import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { AchievementEngine } from '../../src/engine/engine.js';
import { parseYAML } from '../../src/engine/yaml-parser.js';
import type { Condition, TrackedEvent, AchievementDefinition } from '../../src/engine/types.js';

const TEMP_DIR = path.join(os.tmpdir(), `agpa-every-ach-${Date.now()}`);
const YAML_PATH = path.resolve(import.meta.dirname, '../../04-成就定义清单.yaml');

const yamlText = fs.readFileSync(YAML_PATH, 'utf-8');
const { definitions: ALL_DEFS } = parseYAML(yamlText);

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// ── Event factory ────────────────────────────────────────────────

let _seq = 0;
function evt(
  event_type: string,
  payload: Record<string, unknown> = {},
  overrides?: Partial<TrackedEvent>,
): TrackedEvent {
  const id = `evt-${++_seq}`;
  return {
    protocol_version: '1.0',
    event_id: id,
    timestamp: new Date().toISOString(),
    tool_source: 'test',
    event_type,
    payload,
    context: { session_id: 'test-session', model: 'auto' },
    ...overrides,
  };
}

// ── Filter parser — extract payload/context requirements ──────────

interface FilterReqs {
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}

/** Parse AND-chained filters by extracting each atomic predicate */
function parseFilter(filter: string | undefined): FilterReqs {
  const req: FilterReqs = { payload: {}, context: {} };
  if (!filter) return req;

  // Split on && — process each part
  const parts = filter.split('&&').map(s => s.trim());
  for (const part of parts) {
    applyPredicate(part, req);
  }
  return req;
}

function applyPredicate(expr: string, req: FilterReqs): void {
  // model contains 'xxx'
  let m = expr.match(/model\s+contains\s+'([^']+)'/);
  if (m) { req.context.model = 'test-' + m[1]!.trim(); return; }

  // model == 'xxx'
  m = expr.match(/model\s*==\s*'([^']+)'/);
  if (m) { req.context.model = m[1]!; return; }

  // field == true/false (unquoted)
  m = expr.match(/(\w+)\s*==\s*(true|false)\b/);
  if (m) { req.payload[m[1]!] = m[2] === 'true'; return; }

  // field == value (quoted)
  m = expr.match(/(\w+)\s*==\s*'([^']+)'/);
  if (m) { req.payload[m[1]!] = m[2]!; return; }

  // field == number
  m = expr.match(/(\w+)\s*==\s*(\d+)/);
  if (m) { req.payload[m[1]!] = Number(m[2]); return; }

  // field != 'value'
  m = expr.match(/(\w+)\s*!=\s*'([^']+)'/);
  if (m) { req.payload[m[1]!] = 'not-' + m[2]!; return; }

  // field in [v1, v2, ...]
  m = expr.match(/(\w+)\s+in\s+\[(.+?)\]/);
  if (m) {
    const items = m[2]!.split(',').map(s => s.trim().replace(/^'/, '').replace(/'$/, ''));
    req.payload[m[1]!] = items[0] || '';
    return;
  }

  // field matches 'glob'
  m = expr.match(/(\w+)\s+matches\s+'(.+)'/);
  if (m) { req.payload[m[1]!] = m[2]!; return; }

  // command contains 'text'
  m = expr.match(/(\w+)\s+contains\s+'([^']+)'/);
  if (m) { req.payload[m[1]!] = (m[1] === 'command' ? '' : 'prefix ') + m[2]! + ' suffix'; return; }

  // bare contains 'X'
  m = expr.match(/^contains\s+'([^']+)'$/);
  if (m) { req.payload.event_type = m[1]!; return; }
}

// ── Generate events for each condition type ───────────────────────

function genEvents(cond: Condition): TrackedEvent[] {
  const fr = parseFilter(cond.filter);
  const payload = { ...fr.payload };
  const ctx: Partial<TrackedEvent['context']> = {};
  if (fr.context.model) ctx.model = fr.context.model as string;

  // Add role to payload if condition specifies it
  if (cond.role) payload.role = cond.role;

  switch (cond.type) {

    // ── event: just needs one event of given type ────────────
    case 'event':
      return [evt(cond.event || 'test.event', payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } })];

    // ── counter: needs N matching events ─────────────────────
    case 'counter': {
      if ((cond.operator === '==' || cond.operator === '<=') && cond.value === 0) return [];

      // For '>' operators, generate value+1 events
      let target = cond.value;
      if (cond.operator === '>') target += 1;
      target = Math.max(target, 1);

      const result: TrackedEvent[] = [];

      // same_target with field: generate target events all with the SAME field value
      if (cond.same_target && cond.field) {
        for (let i = 0; i < target; i++) {
          result.push(evt(cond.event || 'tool.complete', { ...payload, [cond.field]: 'same-val' }, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
        }
        return result;
      }

      for (let i = 0; i < target; i++) {
        result.push(evt(cond.event || 'tool.complete', payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
      }
      return result;
    }

    // ── threshold ────────────────────────────────────────────
    case 'threshold': {
      if (cond.max_per_day != null) return [];

      if (cond.per_event && cond.field) {
        const eventPayload = { ...payload, [cond.field]: cond.value };
        return [evt(cond.event || 'task.complete', eventPayload, { context: { session_id: 'test-session', model: 'auto', ...ctx } })];
      }

      if (cond.metric) {
        const parts = cond.metric.split('/');
        const numF = parts[0]!.trim();
        const denF = parts[1] ? parts[1]!.trim() : numF;
        // For '<' or '<=' operators, need numerator/denominator < target
        // For others, need numerator/denominator >= target
        const numVal = (cond.operator === '<' || cond.operator === '<=')
          ? Math.max(1, Math.floor(cond.value * 100) - 1)
          : Math.ceil(cond.value * 100) + 1;
        const eventPayload = { ...payload, [numF]: numVal, [denF]: 100 };
        return [evt(cond.event || 'file.edit', eventPayload, { context: { session_id: 'test-session', model: 'auto', ...ctx } })];
      }

      if (cond.field) {
        // For '>' operators, need field value > cond.value
        const adjusted = cond.operator === '>' ? cond.value + 1
          : cond.operator === '>=' ? cond.value
          : cond.value;
        const eventPayload = { ...payload, [cond.field]: adjusted };
        return [evt(cond.event || 'tool.complete', eventPayload, { context: { session_id: 'test-session', model: 'auto', ...ctx } })];
      }

      // No field: count events in window
      const count = Math.max(cond.value, 1);
      const result: TrackedEvent[] = [];
      for (let i = 0; i < count; i++) {
        result.push(evt(cond.event || 'tool.complete', payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
      }
      return result;
    }

    // ── streak ───────────────────────────────────────────────
    case 'streak': {
      const target = cond.value;
      if (cond.event_level) {
        const result: TrackedEvent[] = [];
        for (let i = 0; i < target; i++) {
          result.push(evt(cond.event || 'session.start', payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
        }
        return result;
      }
      const today = new Date();
      const result: TrackedEvent[] = [];
      for (let i = target - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        result.push(evt(cond.event || 'session.start', payload, {
          timestamp: d.toISOString(),
          context: { session_id: `day-${i}`, model: 'auto', ...ctx },
        }));
      }
      return result;
    }

    // ── sequence (standard + consecutive) ────────────────────
    case 'sequence': {
      if (cond.consecutive && cond.count) {
        // Consecutive mode: generate count.value events of cond.event type
        const count = cond.count.value || 1;
        const result: TrackedEvent[] = [];
        for (let i = 0; i < count; i++) {
          result.push(evt(cond.event || 'tool.complete', payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
        }
        return result;
      }
      // Standard ordered sequence
      return (cond.sequence || []).map(et =>
        evt(et, payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } }),
      );
    }

    // ── distinct_count ───────────────────────────────────────
    case 'distinct_count': {
      // If no field, skip (can't distinguish — likely YAML bug)
      if (!cond.field) return [];

      let target = cond.value;
      if (cond.operator === '>') target += 1;

      const field = cond.field;
      const wl = cond.values;
      const result: TrackedEvent[] = [];
      for (let i = 0; i < target; i++) {
        const val = wl ? wl[i % wl.length]! : `v${i}`;
        result.push(evt(cond.event || 'tool.complete', { ...payload, [field]: val }, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
      }
      return result;
    }

    // ── sequence_count ───────────────────────────────────────
    case 'sequence_count': {
      const pattern = (Array.isArray(cond.pattern) ? cond.pattern : []) as string[];
      const target = cond.value;
      const result: TrackedEvent[] = [];
      for (let r = 0; r < target; r++) {
        for (const et of pattern) {
          result.push(evt(et, payload, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
        }
      }
      return result;
    }

    // ── pattern_match ────────────────────────────────────────
    case 'pattern_match': {
      // Generate content that matches the pattern
      let content = 'trigger matching content for achievement';
      if (cond.pattern) {
        const pat = typeof cond.pattern === 'string' ? cond.pattern : '';
        // If pattern contains specific phrases, include a matching string
        if (pat.includes("I'm sorry") || pat.includes("I'm afraid")) {
          content = "I'm sorry I can't do that";
        } else if (pat.includes('humor')) {
          content = 'humor_detected response';
        } else {
          // Use the first simple word from the pattern as matching content
          const words = pat.match(/[a-zA-Z_]+/g);
          if (words && words.length > 0) content = words[0]!;
        }
      }
      return [evt(cond.event || 'conversation.message', { ...payload, content }, { context: { session_id: 'test-session', model: 'auto', ...ctx } })];
    }

    // ── ratio ────────────────────────────────────────────────
    case 'ratio': {
      const pld: Record<string, unknown> = { ...payload };
      // Add buffer to ensure strict operators (> / <) pass
      if (typeof cond.numerator === 'string') pld[cond.numerator] = Math.ceil(cond.value * 100) + 1;
      if (typeof cond.denominator === 'string') pld[cond.denominator] = 100;
      return [evt(cond.event || 'test.event', pld, { context: { session_id: 'test-session', model: 'auto', ...ctx } })];
    }

    // ── mode ─────────────────────────────────────────────────
    case 'mode': {
      const field = cond.field || 'hour';
      const ir = cond.in_range || [0, 23];
      const inVal = ir[0]!;
      const evtField = cond.event || 'session.start';
      const result: TrackedEvent[] = [];
      for (let i = 0; i < 10; i++) {
        result.push(evt(evtField, { ...payload, [field]: String(inVal) }, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
      }
      if (ir[1]! + 1 !== ir[0]!) {
        for (let i = 0; i < 2; i++) {
          result.push(evt(evtField, { ...payload, [field]: String(ir[1]! + 1) }, { context: { session_id: 'test-session', model: 'auto', ...ctx } }));
        }
      }
      return result;
    }

    // ── set_completion ───────────────────────────────────────
    case 'set_completion':
      return [];

    default:
      return [];
  }
}

// ── Wrap events in session/task boundaries ────────────────────────
// IMPORTANT: avoid duplicating task.complete at the end, which would
// create a second task boundary and narrow scopeEvents to nothing.

function wrapForWindows(events: TrackedEvent[], def: AchievementDefinition): TrackedEvent[] {
  const hasTask = def.conditions.some(c => c.window === 'single_task' || c.window === 'same_task');
  const hasSession = def.conditions.some(c => c.window === 'single_session' || c.window === 'same_session');
  if (!hasTask && !hasSession) return events;

  const result: TrackedEvent[] = [evt('session.start', {})];
  result.push(...events);

  // Only add trailing task.complete if the generated events don't already end with one
  const lastType = events.length > 0 ? events[events.length - 1]!.event_type : '';
  if (hasTask && lastType !== 'task.complete') {
    result.push(evt('task.complete', {}));
  }
  if (hasSession && !hasTask) {
    result.push(evt('session.end', {}));
  }
  return result;
}

// ── Is a condition a "negative" constraint? (value==0) ────────────

function isNegative(cond: Condition): boolean {
  if ((cond.operator === '==' || cond.operator === '<=') && cond.value === 0) return true;
  if (cond.max_per_day != null) return true;
  return false;
}

// ── Generate trigger events for a full achievement ────────────────

function genTrigger(def: AchievementDefinition): TrackedEvent[] {
  // Skip generation for set_completion-only — handled by pre-unlock
  const hasSetComp = def.conditions.some(c => c.type === 'set_completion');
  const positiveConds = def.conditions.filter(c => !isNegative(c) && c.type !== 'set_completion');

  let events: TrackedEvent[] = [];
  for (const c of positiveConds) {
    events.push(...genEvents(c));
  }

  events = wrapForWindows(events, def);
  return events;
}

// ── Pre-unlock set members for set_completion achievements ────────

function preUnlockSet(def: AchievementDefinition): Record<string, string> {
  const pre: Record<string, string> = {};
  for (const c of def.conditions) {
    if (c.type !== 'set_completion') continue;

    const targetRarity = c.rarity;
    const includeAbove = c.include_above;
    const startIdx = targetRarity ? RARITY_ORDER.indexOf(targetRarity) : 0;

    const eligible = ALL_DEFS.filter(d => {
      if (d.id === def.id || d.future) return false;
      if (c.all) return true;
      if (c.exclude_hidden) {
        return !d.hidden;
      }
      if (!targetRarity) return d.category === def.category;
      const dIdx = RARITY_ORDER.indexOf(d.rarity || 'common');
      return includeAbove ? dIdx >= startIdx : d.rarity === targetRarity;
    });

    for (const d of eligible) {
      if (!pre[d.id]) {
        pre[d.id] = new Date(Date.now() - (eligible.indexOf(d) + 1) * 86400000).toISOString();
      }
    }
  }
  return pre;
}

// ── Actually test each achievement ────────────────────────────────

describe('every achievement: minimal trigger unlocks it', () => {
  const toSkip = new Set<string>();
  for (const def of ALL_DEFS) {
    if (def.future) toSkip.add(def.id);
    if (!def.conditions || def.conditions.length === 0) toSkip.add(def.id);
  }
  // No known unreachable structural issues remain (all fixed).

  if (toSkip.size > 0) {
    console.log(`\n  Skipping ${toSkip.size}: ${[...toSkip].join(', ')}`);
  }

  const testable = ALL_DEFS.filter(d => !toSkip.has(d.id));

  it.each(testable.map(d => [d.id, d] as [string, AchievementDefinition]))(
    '%s',
    (id, def) => {
      // Unique state dir per test to prevent cross-test pollution
      const stateDir = path.join(TEMP_DIR, id);
      const engine = new AchievementEngine({ stateDir });
      engine.resetState();
      engine.init();

      // Pre-unlock for set_completion: persist to disk BEFORE reload
      const setPre = preUnlockSet(def);
      if (Object.keys(setPre).length > 0) {
        engine.state.unlocked = { ...engine.state.unlocked, ...setPre };
        engine.store.saveState(engine.state);
      }

      // Generate and track events
      const events = genTrigger(def);
      for (const e of events) {
        engine.store.appendEvent(e);
      }

      // Reload so poll picks up saved state + events
      engine.reload();
      const unlocked = engine.poll().map(a => a.id);

      // Debug: show what DID unlock if target isn't there
      if (!unlocked.includes(id)) {
        console.log(`\n  ❌ ${id} — unlocked these instead: ${unlocked.join(', ')}`);
        console.log(`     events generated: ${events.length}`);
        if (Object.keys(setPre).length > 0) {
          console.log(`     pre-unlocked: ${Object.keys(setPre).length} set members`);
        }
      }

      expect(unlocked).toContain(id);
    },
  );
});
