import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { formatAchievement, RARITY_RANK, loadShowcase, saveShowcase } from '../helpers.js';
import type { ShowcaseData } from '../helpers.js';
import { formatMcpError, ErrorCodes } from '../utils/errors.js';

export function registerShowcaseTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.showcase',
    'Manage your achievement showcase (display cabinet). View current showcase, set specific slots, or auto-fill with rarest achievements.',
    {
      action: z.enum(['view', 'set', 'auto']).describe('Action to perform'),
      slot: z.number().int().min(0).max(5).optional().describe('Slot index (0–5) for "set" action'),
      achievement_id: z.string().optional().describe('Achievement ID to place in slot'),
    },
    async ({ action, slot, achievement_id }) => {
      try {
        const engine = getEngine();
        const act = action as string;
        const showcase = loadShowcase(engine.stateDir);

        switch (act) {
          case 'view': {
            const filled = showcase.slots.map((id, i) => {
              if (!id) return { slot: i, empty: true };
              const def = engine.definitions.find(d => d.id === id);
              return def
                ? { slot: i, achievement: formatAchievement(engine, def) }
                : { slot: i, empty: true };
            });
            return { content: [{ type: 'text', text: JSON.stringify({ showcase: filled }, null, 2) }] };
          }

          case 'set': {
            if (slot === undefined || slot < 0 || slot > 5) {
              return formatMcpError(ErrorCodes.INVALID_EVENT, 'slot must be 0–5');
            }
            const aid = achievement_id as string | undefined;
            if (aid && !engine.state.unlocked[aid]) {
              return formatMcpError(ErrorCodes.NOT_FOUND, 'achievement not yet unlocked');
            }
            showcase.slots[slot] = aid || null;
            saveShowcase(engine.stateDir, showcase);
            return {
              content: [{ type: 'text', text: JSON.stringify({ status: 'ok', slot, achievement_id: aid || null }) }],
            };
          }

          case 'auto': {
            const unlocked = engine.definitions
              .filter(d => engine.state.unlocked[d.id])
              .sort((a, b) => (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0));

            const newSlots: (string | null)[] = [null, null, null, null, null, null];
            for (let i = 0; i < Math.min(6, unlocked.length); i++) {
              newSlots[i] = unlocked[i]!.id;
            }
            showcase.slots = newSlots;
            saveShowcase(engine.stateDir, showcase);

            const filled = showcase.slots.map((id, i) => {
              if (!id) return { slot: i, empty: true };
              const def = engine.definitions.find(d => d.id === id);
              return def
                ? { slot: i, achievement: formatAchievement(engine, def) }
                : { slot: i, empty: true };
            });
            return { content: [{ type: 'text', text: JSON.stringify({ status: 'ok', showcase: filled }, null, 2) }] };
          }

          default:
            return formatMcpError(ErrorCodes.UNKNOWN_ACTION, `unknown action: ${act}`);
        }
      } catch (e) {
        return formatMcpError(ErrorCodes.STORE_ERROR, String(e));
      }
    },
  );
}
