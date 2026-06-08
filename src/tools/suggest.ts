import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { findNearUnlocks, type NearUnlock } from '../utils/progress-nudge.js';
import { loadConfig } from '../config.js';

// ── Unit label i18n ──────────────────────────────────────────────────

const UNIT_EN: Record<string, string> = {
  sessions: 'sessions',
  tasks: 'tasks',
  'tool uses': 'tool uses',
  messages: 'messages',
  prompts: 'prompts',
  agents: 'agents',
  skills: 'skills',
  connections: 'connections',
  commands: 'commands',
  events: 'events',
  days: 'days',
  edits: 'edits',
  commits: 'commits',
  pushes: 'pushes',
  mcp_connects: 'connections',
  achievements: 'achievements',
};

const UNIT_ZH: Record<string, string> = {
  sessions: '个会话',
  tasks: '个任务',
  'tool uses': '次工具调用',
  messages: '条消息',
  prompts: '次提示',
  agents: '个Agent',
  skills: '个技能',
  connections: '次连接',
  commands: '条命令',
  events: '个事件',
  days: '天',
  edits: '次编辑',
  commits: '次提交',
  pushes: '次推送',
  mcp_connects: '次连接',
  achievements: '个成就',
};

function translateUnit(unit: string, lang: 'en' | 'zh'): string {
  const map = lang === 'zh' ? UNIT_ZH : UNIT_EN;
  return map[unit] || unit;
}

// ── Response type ────────────────────────────────────────────────────

interface SuggestItem {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  current: number;
  target: number;
  unit_label: string;
  pct: number;
  hint: string;
}

function buildHint(n: NearUnlock, lang: 'en' | 'zh'): string {
  const remaining = n.target - n.current;
  const unit = translateUnit(n.unit_label, lang);
  const pct = Math.round((n.current / n.target) * 100);

  if (lang === 'zh') {
    return `还差 ${remaining} ${unit} 即可解锁「${n.name}」（${n.current}/${n.target}，${pct}%）`;
  }
  return `${remaining} more ${unit} to unlock ${n.name} (${n.current}/${n.target}, ${pct}%)`;
}

// ── Tool registration ────────────────────────────────────────────────

export function registerSuggestTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement_suggest',
    'Return achievements the user is close to unlocking. Call periodically after the user completes work — not every turn. Weave a natural mention into your reply if something is >75% complete.',
    {
      min_progress: z.number().min(0).max(1).default(0.5)
        .describe('Minimum completion ratio (0.0–1.0). Only return achievements at or above this progress.'),
      max_results: z.number().int().min(1).max(10).default(3)
        .describe('Maximum number of suggestions to return.'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ min_progress, max_results }) => {
      const engine = getEngine();
      const cfg = loadConfig();
      const lang: 'en' | 'zh' = cfg.lang === 'zh' ? 'zh' : 'en';

      const near = findNearUnlocks(
        engine.definitions,
        engine.events,
        engine.state,
        { maxResults: max_results, minProgress: min_progress },
      );

      const suggestions: SuggestItem[] = near.map(n => {
        // Pick localized name
        const name = lang === 'zh' ? (engine.definitions.find(d => d.id === n.achievement_id)?.name_cn || n.name) : n.name;
        return {
          id: n.achievement_id,
          name,
          icon: n.icon,
          rarity: n.rarity,
          current: n.current,
          target: n.target,
          unit_label: translateUnit(n.unit_label, lang),
          pct: Math.round((n.current / n.target) * 100),
          hint: buildHint(n, lang),
        };
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({ suggestions }, null, 2) }],
      };
    },
  );
}
