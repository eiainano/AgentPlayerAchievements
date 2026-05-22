#!/usr/bin/env node
import { startDashboard } from '../dashboard/server.js';

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 3867;

if (isNaN(port) || port < 1 || port > 65535) {
  console.error('Usage: npx tsx src/cli/dashboard.ts [port]');
  process.exit(1);
}

const server = startDashboard(port);

process.on('SIGINT', () => {
  process.stderr.write('\nShutting down AGPA Dashboard...\n');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
