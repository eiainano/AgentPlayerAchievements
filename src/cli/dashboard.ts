#!/usr/bin/env node
import { startDashboard } from '../dashboard/server.js';
import { installDaemon, uninstallDaemon, isDaemonInstalled } from './daemon.js';

function parseArgs(): { port: number; profile: string | null; daemon: boolean; noDaemon: boolean } {
  const args = process.argv.slice(2);
  let port = 3867;
  let profile: string | null = null;
  let daemon = false;
  let noDaemon = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]!;
      i++;
    } else if (args[i] === '--daemon') {
      daemon = true;
    } else if (args[i] === '--no-daemon') {
      noDaemon = true;
    } else if (!isNaN(parseInt(args[i]!, 10))) {
      port = parseInt(args[i]!, 10);
    }
  }
  return { port, profile, daemon, noDaemon };
}

const { port, profile, daemon, noDaemon } = parseArgs();

// ── Daemon management (exit immediately, no server) ──────────────────────

if (daemon || noDaemon) {
  if (daemon) {
    const { ok, message } = installDaemon();
    console.log(message);
    process.exit(ok ? 0 : 1);
  }
  if (noDaemon) {
    const { ok, message } = uninstallDaemon();
    console.log(message);
    process.exit(ok ? 0 : 1);
  }
}

if (isNaN(port) || port < 1 || port > 65535) {
  console.error('Usage: npx tsx src/cli/dashboard.ts [port] [--profile <name>] [--daemon|--no-daemon]');
  process.exit(1);
}

const server = startDashboard(port, profile ?? undefined);

// Print daemon status at startup
const daemonActive = isDaemonInstalled();
if (daemonActive) {
  process.stderr.write('  [daemon] active — Dashboard auto-restarts on crash/reboot\n');
}

process.on('SIGINT', () => {
  process.stderr.write('\nShutting down AGPA Dashboard...\n');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
