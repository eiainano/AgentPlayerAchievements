#!/usr/bin/env node
/**
 * AGPA Demo — simulate 1 day of agent usage and unlock 5 achievements
 *
 * Usage:
 *   agpa demo
 */

import * as child_process from 'node:child_process';
import { AchievementEngine } from '../engine/engine.js';
import type { TrackedEvent, AchievementDefinition, EventType } from '../engine/types.js';
import { R, B, D, G, C, RARITY_COLORS } from '../utils/theme.js';

const RARITY_BADGE: Record<string, string> = {
  common: '⬜ Common',
  uncommon: '🟩 Uncommon',
  rare: '🟦 Rare',
  epic: '🟪 Epic',
  legendary: '🟧 Legendary',
  mythic: '🟥 Mythic',
};

function renderPopup(ach: AchievementDefinition): string {
  const rarity = ach.rarity || 'common';
  const color = RARITY_COLORS[rarity] || '';
  const gold = '\x1b[38;2;255;200;0m';
  const icon = ach.icon || '🏆';
  const name = ach.name || ach.id;
  const desc = ach.description || '';
  const W = 52;

  return [
    `${color}${B}  ╔${'═'.repeat(W - 2)}╗${R}`,
    `${color}${B}  ║${R}${gold}  🏆 ACHIEVEMENT UNLOCKED!${' '.repeat(W - 29)}${color}${B}║${R}`,
    `${color}${B}  ║${R}${' '.repeat(W - 2)}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${icon}  ${B}${name}${R}${' '.repeat(Math.max(0, W - name.length - 10))}${color}${B}║${R}`,
    `${color}${B}  ║${R}    ${D}${desc}${R}${' '.repeat(Math.max(0, W - desc.length - 6))}${color}${B}║${R}`,
    `${color}${B}  ║${R}${' '.repeat(W - 2)}${color}${B}║${R}`,
    `${color}${B}  ╚${'═'.repeat(W - 2)}╝${R}`,
  ].join('\n');
}

function renderBar(done: number, total: number, width: number): string {
  const frac = total > 0 ? done / total : 0;
  const filled = Math.round(frac * width);
  const empty = width - filled;
  return `${G}${'█'.repeat(filled)}${D}${'░'.repeat(empty)}${R}`;
}

function makeEvent(
  eventType: EventType,
  timestamp: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
): TrackedEvent {
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

function buildDemoEvents(): TrackedEvent[] {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  let t = new Date(`${yyyy}-${mm}-${dd}T09:00:00`).getTime();
  const gap = () => 5 * 60000 + Math.floor(Math.random() * 10 * 60000);
  const ts = () => {
    t += gap();
    return new Date(t).toISOString();
  };

  const events: TrackedEvent[] = [];

  // ── Session 1 (09:00–10:15) morning — reading codebase ──
  let sid = `demo_s1_${Date.now()}`;
  events.push(makeEvent('session.start' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Grep' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '审查认证模块代码' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '重构错误处理逻辑' }, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('session.end' as EventType, ts(), {}, { session_id: sid }));

  // ── Session 2 (14:00–15:30) afternoon — deep development ──
  t = new Date(`${yyyy}-${mm}-${dd}T14:00:00`).getTime();
  sid = `demo_s2_${Date.now()}`;
  events.push(makeEvent('session.start' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Edit' }, { session_id: sid }));
  events.push(makeEvent('permission.mode_changed' as EventType, ts(), { old_mode: 'default', new_mode: 'acceptEdits' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '运行单元测试' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Write' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '添加用户认证中间件' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '修复登录页样式bug' }, { session_id: sid }));
  events.push(makeEvent('session.end' as EventType, ts(), {}, { session_id: sid }));

  // ── Session 3 (20:00–21:00) evening — exploring MCP ──
  t = new Date(`${yyyy}-${mm}-${dd}T20:00:00`).getTime();
  sid = `demo_s3_${Date.now()}`;
  events.push(makeEvent('session.start' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('mcp.server_used' as EventType, ts(), { server_name: 'github' }, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Read' }, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '集成 GitHub MCP' }, { session_id: sid }));
  events.push(makeEvent('conversation.message' as EventType, ts(), {}, { session_id: sid }));
  events.push(makeEvent('tool.complete' as EventType, ts(), { tool_name: 'Bash' }, { session_id: sid }));
  events.push(makeEvent('task.complete' as EventType, ts(), { task_name: '测试 API 接口' }, { session_id: sid }));
  events.push(makeEvent('session.end' as EventType, ts(), {}, { session_id: sid }));

  return events;
}

async function runDemo(): Promise<void> {
  const { resolveProfileDir } = await import('../utils/profile.js');

  console.log(`${B}\x1b[38;2;255;200;0m`);
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║     🎮  AGPA Demo — 模拟一天使用体验        ║');
  console.log('  ║     Agent Player Achievements System         ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`${R}\n`);

  // ── Phase 1: Generate demo data ──
  const stateDir = resolveProfileDir('_demo');
  const engine = new AchievementEngine({ stateDir });
  engine.resetState();
  engine.init();

  const events = buildDemoEvents();
  const sessionCount = new Set(events.filter(e => e.event_type === 'session.start').map(e => e.context?.session_id)).size;

  process.stdout.write(`${D}⏳  生成 Demo 数据...${R}  `);
  engine.appendEvents(events);
  console.log(`${G}████████████████${R}  ${events.length} 事件, ${sessionCount} sessions\n`);

  // ── Phase 2: Poll for unlocks ──
  const unlocked = engine.poll();

  if (unlocked.length > 0) {
    for (const ach of unlocked) {
      console.log(renderPopup(ach));
      console.log();
    }
  }

  // ── Phase 3: Stats summary ──
  const stats = engine.stats();

  console.log(`${B}\x1b[38;2;255;200;0m  ═══ 今日战绩 ═══${R}`);
  console.log(`  成就: ${stats.unlocked}/${stats.total_achievements} 解锁 (${stats.completion_pct}%)`);
  console.log(`  事件: ${stats.total_events} 条记录`);
  console.log(`  Sessions: ${sessionCount} 次`);
  console.log(`  活跃时段: 09:00 - 21:00`);

  const onboardingCat = stats.by_category['onboarding'];
  if (onboardingCat) {
    const bar = renderBar(onboardingCat.unlocked, onboardingCat.total, 16);
    console.log(`\n  按类别:  onboarding  ${bar}  ${onboardingCat.unlocked}/${onboardingCat.total}`);
  }

  // Set progress for the_beginning
  const setMembers = engine.definitions.filter(d => d.set_id === 'the_beginning');
  const setUnlocked = setMembers.filter(d => engine.state.unlocked[d.id]).length;
  if (setMembers.length > 0) {
    const diff = setMembers.length - setUnlocked;
    console.log(`  🎖️  the_beginning 套装: ${setUnlocked}/${setMembers.length} (${diff === 0 ? '完成!' : `还差 ${diff} 个!`})`);
  }

  console.log(`${D}────────────────────────────────────────────${R}`);

  // ── Phase 4: Open Dashboard ──
  console.log(`\n${C}🌐  正在打开 Dashboard...${R}\n`);
  console.log(`  ${G}浏览器已打开 → http://localhost:3867${R}`);
  console.log(`  ${D}按 Ctrl+C 停止 Dashboard${R}\n`);

  const dashboardPath = new URL('./dashboard.ts', import.meta.url).pathname;
  const child = child_process.spawn('npx', ['tsx', dashboardPath, '--profile', '_demo'], {
    stdio: 'inherit',
    detached: false,
  });

  const cleanup = () => {
    try { child.kill('SIGTERM'); } catch { /* already dead */ }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

runDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
