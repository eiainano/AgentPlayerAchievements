import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { formatMcpError, ErrorCodes } from '../utils/errors.js';

export function registerTrackTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.track',
    'Record an agent event. Lightweight append-only write, returns immediately (<1ms). Does NOT evaluate achievements — that happens in poll().',
    {
      event_type: z.string().describe('Event type (e.g. session.start, tool.complete, task.complete)'),
      payload: z.object({}).passthrough().optional().describe('Optional event payload'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ event_type, payload }) => {
      try {
        const engine = getEngine();
        const event = engine.track(
          event_type as string,
          (payload || {}) as Record<string, unknown>,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'ok', event_id: event.event_id }) }],
        };
      } catch (e) {
        return formatMcpError(ErrorCodes.INVALID_EVENT, String(e));
      }
    },
  );
}
