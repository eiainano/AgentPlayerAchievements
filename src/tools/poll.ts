import * as fs from 'fs';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { formatAchievement } from '../helpers.js';
import { loadConfig } from '../config.js';
import { getRecommendResponse, buildRecommendationPrompt } from '../utils/recommend.js';
import { safeParse } from '../utils/validate.js';

function loadPending(stateDir: string): unknown[] {
  const pendingPath = `${stateDir}/pending.json`;
  try {
    if (fs.existsSync(pendingPath)) {
      return safeParse(z.array(z.unknown()), JSON.parse(fs.readFileSync(pendingPath, 'utf-8')), []);
    }
  } catch { /* ignore */ }
  return [];
}

function savePending(stateDir: string, pending: unknown[]): void {
  const pendingPath = `${stateDir}/pending.json`;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
}

function selectRecommendContent(resp: ReturnType<typeof getRecommendResponse>) {
  if (resp.surprise) return resp.surprise;
  if (resp.discovery) return resp.discovery;
  if (resp.near_win.length > 0) return resp.near_win[0]!;
  return null;
}

export function registerPollTool(server: McpServer, getEngine: () => AchievementEngine): void {
  server.tool(
    'achievement.poll',
    'Evaluate all achievement conditions against event history. Returns newly unlocked achievements (max 5 at a time). May include a recommendation_prompt suggesting next achievements if new unlocks occurred.',
    {
      acknowledged_ids: z.array(z.string()).optional().describe('IDs of previously shown achievements to acknowledge'),
      limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum achievements to return'),
    },
    { readOnlyHint: true, idempotentHint: true },
    async ({ acknowledged_ids, limit }) => {
      const engine = getEngine();
      const ack: string[] = Array.isArray(acknowledged_ids) ? acknowledged_ids as string[] : [];
      const maxResults = (limit as number) || 5;
      const cfg = loadConfig();
      const lang: 'en' | 'zh' = cfg.lang === 'zh' ? 'zh' : 'en';

      let pending = loadPending(engine.stateDir);

      if (ack.length > 0) {
        pending = pending.filter((a: any) => !ack.includes(a.id));
      }

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

      const batch = newlyUnlocked.slice(0, maxResults);
      const rest = newlyUnlocked.slice(maxResults);
      if (rest.length > 0) savePending(engine.stateDir, rest);

      // Recommendation prompt (double gate)
      let recommendationPrompt: string | undefined;
      const p = cfg.recommend_probability ?? 0.2;
      if (p > 0 && Math.random() < p) {
        const resp = getRecommendResponse(
          engine.definitions, engine.events, engine.state,
          engine.stateDir || 'default',
        );
        const content = selectRecommendContent(resp);
        if (content) {
          recommendationPrompt = buildRecommendationPrompt(content, lang);
        }
      }

      const pollResponse: Record<string, unknown> = {
        achievements: batch.map(a => formatAchievement(engine, a)),
        has_more: rest.length > 0,
      };

      if (recommendationPrompt) {
        pollResponse.recommendation_prompt = recommendationPrompt;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(pollResponse),
        }],
      };
    },
  );
}
