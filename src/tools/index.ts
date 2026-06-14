import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { registerTrackTool } from './track.js';
import { registerPollTool } from './poll.js';
import { registerStatsTool } from './stats.js';
import { registerShowcaseTool } from './showcase.js';
import { registerConfigTool } from './config.js';
import { registerSuggestTool } from './suggest.js';
import { registerExplainTool } from './explain.js';

export function registerAllTools(server: McpServer, getEngine: () => AchievementEngine): void {
  registerTrackTool(server, getEngine);
  registerPollTool(server, getEngine);
  registerStatsTool(server, getEngine);
  registerShowcaseTool(server, getEngine);
  registerConfigTool(server);
  registerSuggestTool(server, getEngine);
  registerExplainTool(server, getEngine);
}
