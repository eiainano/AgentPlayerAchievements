import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';

export function registerExplainTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement_explain',
    'Explain why an achievement is locked or unlocked. Shows each condition\'s progress, target, event type, filter, window scope, and up to 5 excluded events with reasons. Hidden achievements only reveal hints — condition details stay hidden until unlocked.',
    {
      achievement_id: z.string()
        .describe('The achievement ID to explain (e.g. "bug_catcher", "file_centurion")'),
      raw: z.boolean().default(false).optional()
        .describe('If true, returns the raw JSON explanation without formatting hints'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ achievement_id, raw }) => {
      const engine = getEngine();
      const explanation = engine.explain(achievement_id);

      if (!explanation) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: 'achievement_not_found',
            message: `No achievement found with id '${achievement_id}'.`,
          }, null, 2) }],
        };
      }

      const output: Record<string, unknown> = {};

      if (explanation.hidden && !explanation.unlocked) {
        // Hidden + locked: engine already masks conditions + description.
        // Return a minimal clean response with hint and bilingual guidance.
        output.achievement_id = explanation.achievement_id;
        output.hidden = true;
        output.unlocked = false;
        output.hint = explanation.hint || null;
        output.hint_cn = explanation.hint_cn || null;
        output.rarity = explanation.rarity;
        output.message = 'This is a hidden achievement. Condition details are concealed until unlocked.';
        output.message_cn = '这是一个隐藏成就，条件详情在解锁前保密。';
      } else {
        // Full explanation
        output.achievement_id = explanation.achievement_id;
        output.name = explanation.name;
        output.name_cn = explanation.name_cn;
        output.description = explanation.description;
        output.description_cn = explanation.description_cn;
        output.icon = explanation.icon;
        output.rarity = explanation.rarity;
        output.category = explanation.category;
        output.hidden = explanation.hidden;
        output.unlocked = explanation.unlocked;
        output.unlocked_at = explanation.unlocked_at || null;
        output.conditions = explanation.conditions.map(c => ({
          index: c.index,
          type: c.type,
          met: c.met,
          progress: { current: c.current_value, target: c.target_value, pct: c.progress_pct },
          unit: c.unit_label,
          event: c.event_type || null,
          filter: c.filter_expr || null,
          field: c.field || null,
          window: c.window_label,
          window_start: c.window_start || null,
          window_end: c.window_end || null,
          matched_events: c.matched_count,
          excluded_events: c.excluded_count,
          exclusion_trace: c.excluded_events.map(e => ({
            event_id: e.event_id,
            timestamp: e.timestamp,
            type: e.event_type,
            reason: e.reason,
            reason_cn: e.reason_cn,
          })),
          details: c.details,
        }));
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    },
  );
}
