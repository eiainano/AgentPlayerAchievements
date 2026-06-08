import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AchievementEngine } from '../../src/engine/engine.js';

function makeEvent(
  eventType: string,
  timestamp: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
) {
  const eventId = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    protocol_version: '1.0',
    event_id: eventId,
    timestamp,
    tool_source: 'claude-code',
    event_type: eventType,
    payload: { ...payload, tool_source: 'claude-code' },
    context: { session_id: 'demo_session', model: 'claude-sonnet-4-6', ...context },
  };
}

function buildDemoEvents() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  let t = new Date(`${yyyy}-${mm}-${dd}T09:00:00`).getTime();
  const gap = () => 5 * 60000 + Math.floor(Math.random() * 10 * 60000);
  const ts = () => { t += gap(); return new Date(t).toISOString(); };

  const events: any[] = [];

  let sid = 'demo_s1_test';
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Grep' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '审查认证模块代码' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '重构错误处理逻辑' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  t = new Date(`${yyyy}-${mm}-${dd}T14:00:00`).getTime();
  sid = 'demo_s2_test';
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('permission.mode_changed', ts(), { old_mode: 'default', new_mode: 'acceptEdits' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '运行单元测试' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Write' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '添加用户认证中间件' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '修复登录页样式bug' }, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  t = new Date(`${yyyy}-${mm}-${dd}T20:00:00`).getTime();
  sid = 'demo_s3_test';
  events.push(makeEvent('session.start', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('mcp.server_used', ts(), { server_name: 'github' }, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '集成 GitHub MCP' }, { session_id: sid }));
  events.push(makeEvent('conversation.message', ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete', ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete', ts(), { task_name: '测试 API 接口' }, { session_id: sid }));
  events.push(makeEvent('session.end', ts(), {}, { session_id: sid }));

  return events;
}

describe('Demo event generation', () => {
  const tempDir = path.join(os.tmpdir(), `agpa-demo-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates at least 40 events', () => {
    const events = buildDemoEvents();
    expect(events.length).toBeGreaterThanOrEqual(40);
  });

  it('has exactly 3 sessions', () => {
    const events = buildDemoEvents();
    const sessionIds = new Set(events.filter(e => e.event_type === 'session.start').map(e => e.context?.session_id));
    expect(sessionIds.size).toBe(3);
  });

  it('unlocks at least 5 achievements including the 5 demo ones', () => {
    const engine = new AchievementEngine({ stateDir: tempDir });
    engine.resetState();
    engine.init();

    const events = buildDemoEvents();
    engine.appendEvents(events);
    const unlocked = engine.poll();

    expect(unlocked.length).toBeGreaterThanOrEqual(5);
    const ids = unlocked.map(a => a.id);
    expect(ids).toContain('first_contact');
    expect(ids).toContain('tool_time');
    expect(ids).toContain('three_company');
    expect(ids).toContain('permission_granted');
    expect(ids).toContain('mcp_first_contact');
  });

  it('isolates demo data from default profile', () => {
    const demoDir = path.join(tempDir, 'demo');
    const defaultDir = path.join(tempDir, 'default');
    fs.mkdirSync(demoDir, { recursive: true });
    fs.mkdirSync(defaultDir, { recursive: true });

    const demoEngine = new AchievementEngine({ stateDir: demoDir });
    demoEngine.resetState();
    demoEngine.init();

    const defaultEngine = new AchievementEngine({ stateDir: defaultDir });
    defaultEngine.resetState();
    defaultEngine.init();

    const events = buildDemoEvents();
    demoEngine.appendEvents(events);
    demoEngine.poll();

    const demoStats = demoEngine.stats();
    const defaultStats = defaultEngine.stats();

    expect(demoStats.unlocked).toBeGreaterThanOrEqual(5);
    expect(defaultStats.unlocked).toBe(0);
  });

  it('uses recent dates for timestamps', () => {
    const events = buildDemoEvents();
    const firstTs = events[0]!.timestamp as string;
    const firstDate = new Date(firstTs).getTime();
    const now = Date.now();
    // Should be within 48 hours of now (in either direction — demo may use future times today)
    expect(Math.abs(now - firstDate)).toBeLessThan(48 * 3600 * 1000);
  });
});
