#!/usr/bin/env node
/**
 * AGPA MCP Server — exposes achievement tools via Model Context Protocol
 *
 * Tools:
 *   achievement.track   — record an event
 *   achievement.poll    — evaluate & return newly unlocked achievements
 *   achievement.stats   — return user statistics
 *   achievement.showcase— manage display cabinet
 *   achievement.config  — read/write settings (lang, etc.)
 *
 * Usage:
 *   npx tsx src/main.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AchievementEngine } from './engine/engine.js';
import { registerAllTools } from './tools/index.js';

// ── Engine ───────────────────────────────────────────────────────────

const engine = new AchievementEngine();
engine.init();

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer(
  { name: 'agpa', version: '0.1.6' },
  { capabilities: { tools: {} } },
);

// ── Register tools ───────────────────────────────────────────────────

registerAllTools(server, engine);

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Poll for client info (MCP initialize handshake happens async after connect)
  for (let i = 0; i < 20; i++) {
    const clientInfo = server.server.getClientVersion();
    if (clientInfo) {
      engine.detectToolSource(clientInfo);
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  process.stderr.write(
    `AGPA MCP v0.1.6 · ${engine.definitions.length} achievements · ${engine.stateDir} · ${engine.toolSource}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e.message}\n`);
  process.exit(1);
});
