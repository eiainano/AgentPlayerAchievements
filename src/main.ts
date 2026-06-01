#!/usr/bin/env node
/**
 * AGPA MCP Server — exposes achievement tools via Model Context Protocol
 *
 * Dynamic profile: reads active_profile from config.json on every tool call,
 * swaps engine if profile changed (e.g. via Dashboard profile switch).
 * AGPA_PROFILE env var locks the profile (overrides config.json).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AchievementEngine } from './engine/engine.js';
import { registerAllTools } from './tools/index.js';
import { resolveProfileDir, DEFAULT_PROFILE } from './utils/profile.js';
import { loadConfig } from './config.js';

// ── Dynamic engine (profile-aware) ────────────────────────────────────

let currentProfile: string;
let engine: AchievementEngine;

// If AGPA_PROFILE is set, lock to that profile (explicit user intent).
// Otherwise, follow config.json's active_profile dynamically.
const lockedProfile = process.env.AGPA_PROFILE || null;

function createEngine(profile: string): AchievementEngine {
  const stateDir = resolveProfileDir(profile);
  const eng = new AchievementEngine({ stateDir });
  eng.init();
  return eng;
}

function getEngine(): AchievementEngine {
  if (lockedProfile) return engine; // locked, never changes

  const cfg = loadConfig();
  const activeProfile = cfg.active_profile || DEFAULT_PROFILE;
  if (activeProfile !== currentProfile) {
    process.stderr.write(`[AGPA] profile switch: ${currentProfile} → ${activeProfile}\n`);
    currentProfile = activeProfile;
    engine = createEngine(activeProfile);
  }
  return engine;
}

// Initialize
currentProfile = lockedProfile || loadConfig().active_profile || DEFAULT_PROFILE;
engine = createEngine(currentProfile);

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer(
  { name: 'agpa', version: '0.1.6' },
  { capabilities: { tools: {} } },
);

// ── Register tools ───────────────────────────────────────────────────

registerAllTools(server, getEngine);

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Poll for client info (MCP initialize handshake happens async after connect)
  for (let i = 0; i < 20; i++) {
    const clientInfo = server.server.getClientVersion();
    if (clientInfo) {
      const eng = getEngine();
      eng.detectToolSource(clientInfo);
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  const eng = getEngine();
  process.stderr.write(
    `AGPA MCP v0.1.6 · ${eng.definitions.length} achievements · ${currentProfile} · ${eng.toolSource}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e.message}\n`);
  process.exit(1);
});
