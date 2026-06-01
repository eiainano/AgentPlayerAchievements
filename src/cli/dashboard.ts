#!/usr/bin/env node
import { startDashboard } from '../dashboard/server.js';

function parseArgs(): { port: number; profile: string | null } {
  const args = process.argv.slice(2);
  let port = 3867;
  let profile: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]!;
      i++;
    } else if (!isNaN(parseInt(args[i]!, 10))) {
      port = parseInt(args[i]!, 10);
    }
  }
  return { port, profile };
}

const { port, profile } = parseArgs();

if (isNaN(port) || port < 1 || port > 65535) {
  console.error('Usage: npx tsx src/cli/dashboard.ts [port] [--profile <name>]');
  process.exit(1);
}

const server = startDashboard(port, profile ?? undefined);

process.on('SIGINT', () => {
  process.stderr.write('\nShutting down AGPA Dashboard...\n');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
