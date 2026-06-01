import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';

export function registerStatsTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.stats',
    'Return user achievement statistics: total unlocked, completion %, breakdown by category and rarity.',
    {},
    { readOnlyHint: true, idempotentHint: true },
    async () => {
      const engine = getEngine();
      const stats = engine.stats();
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    },
  );
}
