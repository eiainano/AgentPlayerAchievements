import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AchievementEngine } from '../../src/engine/engine.js';
import type { TrackedEvent } from '../../src/engine/types.js';

const TEMP_DIR = path.join(os.tmpdir(), `agpa-integration-test-${Date.now()}`);

function freshEngine(): AchievementEngine {
  const engine = new AchievementEngine({ stateDir: TEMP_DIR });
  engine.resetState();
  engine.init();
  return engine;
}

/** Track multiple raw events, then poll and return sorted unlocked IDs */
function simulate(engine: AchievementEngine, events: Array<{ type: string; payload?: Record<string, unknown> }>): string[] {
  for (const e of events) {
    engine.track(e.type, e.payload || {});
  }
  return engine.poll().map(a => a.id).sort();
}

function report(unlocked: string[], label: string): void {
  console.log(`\n  [${label}] unlocked ${unlocked.length}:`);
  for (const id of unlocked) console.log(`    + ${id}`);
}

// ── Scenario 1: Newbie — minimal first session ─────────────────

describe('S1: newbie (minimal first session)', () => {
  it('unlocks first_contact and tool_time, nothing expensive', () => {
    const engine = freshEngine();
    const unlocked = simulate(engine, [
      { type: 'session.start' },
      { type: 'conversation.message', payload: { role: 'user' } },
      { type: 'tool.complete', payload: { tool_name: 'Read' } },
      { type: 'conversation.message', payload: { role: 'user' } },
      { type: 'tool.complete', payload: { tool_name: 'Edit' } },
      { type: 'conversation.message', payload: { role: 'user' } },
      { type: 'task.complete', payload: { step_count: 10 } },
      { type: 'session.end' },
    ]);
    report(unlocked, 'S1 newbie');

    // Should unlock
    expect(unlocked).toContain('first_contact');  // 1+ conv.msg
    expect(unlocked).toContain('tool_time');       // 1+ tool.complete

    // Should NOT unlock
    expect(unlocked).not.toContain('three_company');   // 3+ tasks
    expect(unlocked).not.toContain('chain_reaction');  // 5+ tools in same-session
    expect(unlocked).not.toContain('seeker');           // 10+ filtered tools
    expect(unlocked).not.toContain('first_sunrise');    // 2 sessions in 24h
    expect(unlocked).not.toContain('streak_3');         // 3 consecutive days
    expect(unlocked).not.toContain('iterative_refiner');// 20-step tasks
  });
});

// ── Scenario 2: Power user — 2 tasks per session, each with tools ──

describe('S2: power user (3 sessions × 2 tasks × 4 tools)', () => {
  it('unlocks dual_wielder, tool_completist, three_company', () => {
    const engine = freshEngine();
    const toolPool = ['Read', 'Edit', 'Bash', 'Write', 'Grep', 'Glob'];

    for (let s = 0; s < 3; s++) {
      engine.track('session.start');
      for (let t = 0; t < 2; t++) {
        engine.track('conversation.message', { role: 'user' });
        // 3 tool calls per task
        for (let ti = 0; ti < 3; ti++) {
          engine.track('conversation.message', { role: 'user' });
          engine.track('tool.complete', { tool_name: toolPool[(s * 2 + t + ti) % toolPool.length] });
        }
        engine.track('task.complete', { step_count: 10 });
      }
      engine.track('session.end');
    }

    const unlocked = engine.poll().map(a => a.id).sort();
    report(unlocked, 'S2 power user');

    expect(unlocked).toContain('first_contact');
    expect(unlocked).toContain('tool_time');
    expect(unlocked).toContain('three_company');  // 6+ tasks

    // Tools are interleaved within each task → single_task sees 3 distinct tools
    expect(unlocked).toContain('dual_wielder');    // 3+ distinct tools in a task

    expect(unlocked).not.toContain('double_digits'); // 10+ tasks
    expect(unlocked).not.toContain('century');
  });
});

// ── Scenario 3: Daily driver — 14 consecutive days ────────────

describe('S3: daily driver (14 consecutive days)', () => {
  function d(dayOffset: number): string {
    const dt = new Date();
    dt.setDate(dt.getDate() + dayOffset);
    return dt.toISOString();
  }

  function dayEvents(dateStr: string, sid: string): TrackedEvent[] {
    return [
      { protocol_version: '1.0', event_id: `start-${sid}`, timestamp: dateStr, tool_source: 'test', event_type: 'session.start', payload: {}, context: { session_id: sid, model: 'auto' } },
      { protocol_version: '1.0', event_id: `msg-${sid}`, timestamp: dateStr, tool_source: 'test', event_type: 'conversation.message', payload: { role: 'user' }, context: { session_id: sid, model: 'auto' } },
      { protocol_version: '1.0', event_id: `tool-${sid}`, timestamp: dateStr, tool_source: 'test', event_type: 'tool.complete', payload: { tool_name: 'Read' }, context: { session_id: sid, model: 'auto' } },
      { protocol_version: '1.0', event_id: `tc-${sid}`, timestamp: dateStr, tool_source: 'test', event_type: 'task.complete', payload: {}, context: { session_id: sid, model: 'auto' } },
    ];
  }

  it('unlocks streak_3 and streak_7, not streak_30', () => {
    const engine = freshEngine();

    // Write 14 consecutive days to disk, then reload and poll
    for (let offset = -13; offset <= 0; offset++) {
      const ts = d(offset);
      const sid = `day-${offset}`;
      for (const e of dayEvents(ts, sid)) {
        engine.store.appendEvent(e);
      }
    }

    // Reload from disk so engine sees the events
    engine.reload();
    const unlocked = engine.poll().map(a => a.id).sort();
    report(unlocked, 'S3 daily driver (14d)');

    // These require window:all, so they should unlock
    expect(unlocked).toContain('first_contact'); // conversation.message >= 1
    expect(unlocked).toContain('tool_time');      // tool.complete >= 1

    // 14 consecutive days with a session.start each day
    expect(unlocked).toContain('streak_3');        // 3-day streak
    expect(unlocked).toContain('streak_7');        // 7-day streak

    // NOT enough
    expect(unlocked).not.toContain('streak_30');   // needs 30-day streak
  });
});

// ── Scenario 4: Commander — agents, MCP, plan, git, skills ────

describe('S4: commander (agents, MCP, plan, git)', () => {
  it('unlocks agent/MCP/plan/git achievements', () => {
    const engine = freshEngine();
    const unlocked = simulate(engine, [
      // Session + basic events (needed for first_contact, tool_time)
      { type: 'session.start' },
      { type: 'conversation.message', payload: { role: 'user' } },
      { type: 'tool.complete', payload: { tool_name: 'Read' } },
      { type: 'conversation.message', payload: { role: 'user' } },
      // MCP
      { type: 'mcp.connect' },
      { type: 'mcp.server_used' },
      { type: 'mcp.tool_call', payload: { tool_name: 'mcp__fs' } },
      // Agent spawns (different types)
      { type: 'agent.spawn', payload: { agent_type: 'coder' } },
      { type: 'agent.spawn', payload: { agent_type: 'researcher' } },
      { type: 'agent.spawn', payload: { agent_type: 'editor' } },
      // Plan mode
      { type: 'plan.mode_entered' },
      // Git
      { type: 'tool.complete', payload: { tool_name: 'Bash', command: 'git commit -m x' } },
      { type: 'git.commit' },
      { type: 'tool.complete', payload: { tool_name: 'Bash', command: 'gh pr create' } },
      { type: 'git.pr_created' },
      // Skill
      { type: 'skill.invoke', payload: { skill_name: 'code-review' } },
      // Task completion
      { type: 'conversation.message', payload: { role: 'user' } },
      { type: 'tool.complete', payload: { tool_name: 'Write', file_path: '/tmp/x.ts' } },
      // Command
      { type: 'command.created' },
      { type: 'plugin.installed' },
      { type: 'task.complete' },
      { type: 'session.end' },
    ]);
    report(unlocked, 'S4 commander');

    // Basic
    expect(unlocked).toContain('first_contact');
    expect(unlocked).toContain('tool_time');
    // MCP
    expect(unlocked).toContain('mcp_first_contact');
    expect(unlocked).toContain('mcp_first_connect');
    // Agent spawn
    expect(unlocked).toContain('alien');
    // Plan mode
    expect(unlocked).toContain('plan_mode_user');
    // Commands / plugins
    expect(unlocked).toContain('command_crafter');
    expect(unlocked).toContain('plugin_explorer');

    // NOT yet: git requires 10+ commits with agent_involved flag
    expect(unlocked).not.toContain('git_tenderfoot');
    expect(unlocked).not.toContain('three_company');
  });
});

// ── Scenario 5: Error bounce-back ─────────────────────────────

describe('S5: error recovery (fail → fix → pass cycles)', () => {
  it('unlocks the_debugger and triple_debugger', () => {
    const engine = freshEngine();
    const events: Array<{ type: string; payload?: Record<string, unknown> }> = [
      { type: 'session.start' },
      { type: 'conversation.message', payload: { role: 'user' } },
      { type: 'tool.complete', payload: { tool_name: 'Edit' } },
    ];
    // 3 rounds of fail→fix→pass — each cycle contiguous so sequence_count matches
    for (let r = 0; r < 3; r++) {
      events.push(
        { type: 'conversation.message', payload: { role: 'user' } },
        { type: 'test.fail', payload: { role: 'user' } },
        { type: 'agent.self_fix' },
        { type: 'test.pass' },
      );
    }
    events.push(
      { type: 'task.complete' },
      { type: 'session.end' },
    );

    const unlocked = simulate(engine, events);
    report(unlocked, 'S5 error recovery');

    expect(unlocked).toContain('first_contact');
    expect(unlocked).toContain('tool_time');
    expect(unlocked).toContain('the_debugger');
    expect(unlocked).toContain('triple_debugger');
  });
});

// ── Scenario 6: Verified unlocking of first_contact (lightning test) ──

describe('S6: verified baseline', () => {
  it('single msg + single tool unlocks first_contact and tool_time', () => {
    const engine = freshEngine();
    engine.track('session.start');
    engine.track('conversation.message', { role: 'user' });
    engine.track('tool.complete', { tool_name: 'Read' });

    const unlocked = engine.poll().map(a => a.id);
    expect(unlocked).toContain('first_contact');
    expect(unlocked).toContain('tool_time');
  });
});
