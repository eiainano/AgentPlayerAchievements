import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AchievementEngine } from '../engine/engine.js';
import { registerTrackTool } from './track.js';
import { registerPollTool } from './poll.js';
import { registerStatsTool } from './stats.js';
import { registerShowcaseTool } from './showcase.js';
import { registerConfigTool } from './config.js';

export function registerAllTools(server: McpServer, engine: AchievementEngine): void {
  registerTrackTool(server, engine);
  registerPollTool(server, engine);
  registerStatsTool(server, engine);
  registerShowcaseTool(server, engine);
  registerConfigTool(server);
}
