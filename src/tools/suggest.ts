import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { getRecommendResponse } from '../utils/recommend.js';
import { loadConfig } from '../config.js';

const UNIT_EN: Record<string, string> = {
  sessions: 'sessions', tasks: 'tasks', 'tool uses': 'tool uses',
  messages: 'messages', prompts: 'prompts', agents: 'agents',
  skills: 'skills', connections: 'connections', commands: 'commands',
  events: 'events', days: 'days', edits: 'edits',
  commits: 'commits', pushes: 'pushes', mcp_connects: 'connections',
  achievements: 'achievements',
};

const UNIT_ZH: Record<string, string> = {
  sessions: '个会话', tasks: '个任务', 'tool uses': '次工具调用',
  messages: '条消息', prompts: '次提示', agents: '个Agent',
  skills: '个技能', connections: '次连接', commands: '条命令',
  events: '个事件', days: '天', edits: '次编辑',
  commits: '次提交', pushes: '次推送', mcp_connects: '次连接',
  achievements: '个成就',
};

function translateUnit(unit: string, lang: 'en' | 'zh'): string {
  const map = lang === 'zh' ? UNIT_ZH : UNIT_EN;
  return map[unit] || unit;
}

export function registerSuggestTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement_suggest',
    'Return personalized achievement recommendations. Call periodically after the user completes work. Weave a natural mention if something is >75% complete.',
    {
      categories: z.array(z.enum(['near_win', 'discovery', 'surprise'])).optional()
        .describe('Filter to specific recommendation categories. Omit for all 3.'),
      max_results: z.number().int().min(1).max(10).default(5)
        .describe('Maximum near_win suggestions (only affects near_win category).'),
      min_progress: z.number().min(0).max(1).default(0.01)
        .describe('Minimum completion ratio for near_win (0.0–1.0).'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ categories, max_results, min_progress }) => {
      const engine = getEngine();
      const cfg = loadConfig();
      const lang: 'en' | 'zh' = cfg.lang === 'zh' ? 'zh' : 'en';

      const resp = getRecommendResponse(
        engine.definitions,
        engine.events,
        engine.state,
        engine.sessionId,
      );

      const wantsAll = !categories || categories.length === 0;
      const result: Record<string, unknown> = {};

      if (wantsAll || categories.includes('near_win')) {
        let nw = resp.near_win;
        nw = nw.filter(item => (item.progress?.pct ?? 0) / 100 >= (min_progress ?? 0.01));
        nw = nw.slice(0, max_results ?? 5);
        result.near_win = nw.map(item => ({
          ...item,
          unit_label: item.unit_label ? translateUnit(item.unit_label, lang) : undefined,
        }));
      }

      if (wantsAll || categories.includes('discovery')) {
        result.discovery = resp.discovery;
      }

      if (wantsAll || categories.includes('surprise')) {
        result.surprise = resp.surprise;
      }

      result.generated_at = resp.generated_at;
      result.session_id = resp.session_id;

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
