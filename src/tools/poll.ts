import * as fs from 'fs';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { formatAchievement } from '../helpers.js';
import { loadConfig } from '../config.js';
import { sendNotification } from '../utils/notify.js';

function loadPending(stateDir: string): unknown[] {
  const pendingPath = `${stateDir}/pending.json`;
  try {
    if (fs.existsSync(pendingPath)) {
      return JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function savePending(stateDir: string, pending: unknown[]): void {
  const pendingPath = `${stateDir}/pending.json`;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
}

export function registerPollTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.poll',
    'Evaluate all achievement conditions against event history. Returns newly unlocked achievements (max 5 at a time). Call this after each agent turn.',
    {
      acknowledged_ids: z.array(z.string()).optional().describe('IDs of previously shown achievements to acknowledge, clearing pending queue slots for new ones'),
      limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum achievements to return'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ acknowledged_ids, limit }) => {
      const engine = getEngine();
      const ack: string[] = Array.isArray(acknowledged_ids) ? acknowledged_ids as string[] : [];
      const maxResults = (limit as number) || 5;

      let pending = loadPending(engine.stateDir);

      // Remove acknowledged
      if (ack.length > 0) {
        pending = pending.filter((a: any) => !ack.includes(a.id));
      }

      // Return from pending first
      if (pending.length > 0) {
        const batch = pending.slice(0, maxResults);
        const rest = pending.slice(maxResults);
        savePending(engine.stateDir, rest);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              achievements: batch.map((a: any) => formatAchievement(engine, a)),
              has_more: rest.length > 0,
            }),
          }],
        };
      }

      const newlyUnlocked = engine.poll();

      if (newlyUnlocked.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ achievements: [], has_more: false }) }],
        };
      }

      // Fire macOS notification
      const cfg = loadConfig();
      const useZh = cfg.lang === 'zh';
      for (const ach of newlyUnlocked) {
        const icon = ach.icon || '🏆';
        const title = useZh ? (ach.name_cn || ach.name) : ach.name;
        const desc = useZh ? (ach.description_cn || ach.description) : ach.description;
        sendNotification(`${icon} ${title}`, desc, engine.stateDir);
      }

      const batch = newlyUnlocked.slice(0, maxResults);
      const rest = newlyUnlocked.slice(maxResults);
      if (rest.length > 0) savePending(engine.stateDir, rest);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            achievements: batch.map(a => formatAchievement(engine, a)),
            has_more: rest.length > 0,
          }),
        }],
      };
    },
  );
}
