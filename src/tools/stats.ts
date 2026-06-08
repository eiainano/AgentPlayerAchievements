import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';

const DASHBOARD_URL = 'http://127.0.0.1:3867/api/health';

async function checkDashboardRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    const res = await fetch(DASHBOARD_URL, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function registerStatsTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.stats',
    'Return user achievement statistics: total unlocked, completion %, breakdown by category and rarity.',
    {},
    { readOnlyHint: true, idempotentHint: true },
    async () => {
      const engine = getEngine();
      const stats = engine.stats();
      const cfg = loadConfig();
      const dashboardRunning = await checkDashboardRunning();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ...stats, dashboard_running: dashboardRunning, lang: cfg.lang }, null, 2),
        }],
      };
    },
  );
}
