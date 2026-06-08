#!/usr/bin/env node
/**
 * AGPA Upgrade — check for updates and upgrade AGPA
 *
 * Usage:
 *   agpa upgrade            Interactive upgrade check + prompt
 *   agpa upgrade --check    Only check for updates (exit 0 = up-to-date, 1 = update available)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

function getCurrentVersion(): string {
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) return 'unknown';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.version || 'unknown';
}

function getLatestVersion(): { version: string; error?: string } {
  try {
    const result = spawnSync('npm', ['view', 'agpa', 'version'], {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const version = (result.stdout || '').trim();
    return { version };
  } catch {
    return { version: '', error: 'Cannot reach npm registry. Check your network connection.' };
  }
}

function compareVersions(a: string, b: string): number {
  const ap = a.split('.').map(Number);
  const bp = b.split('.').map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] || 0;
    const bv = bp[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function isGitRepo(): boolean {
  return fs.existsSync(path.join(PROJECT_ROOT, '.git'));
}

function getGitRemote(): string | null {
  try {
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return (result.stdout || '').trim() || null;
  } catch {
    return null;
  }
}

function isNpmPackage(): boolean {
  try {
    const result = spawnSync('npm', ['list', '-g', 'agpa', '--depth=0'], {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';

function main(): void {
  const rawArgs = process.argv.slice(2);
  // When invoked via agpa index.ts, argv[2] is 'upgrade' followed by flags.
  const args = rawArgs[0] === 'upgrade' ? rawArgs.slice(1) : rawArgs;
  const checkOnly = args.includes('--check');
  const autoYes = args.includes('--yes');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${B}AGPA Upgrade${R} — check for updates and upgrade

Usage:
  agpa upgrade              Check for updates and upgrade interactively
  agpa upgrade --check      Only check (exit 0 = up-to-date, 1 = update available)
  agpa upgrade --yes        Auto-upgrade without prompt (non-interactive)
  agpa upgrade --help       Show this help

Install methods:
  npm:  npm update -g agpa           (global install)
  git:  git pull && npm install      (source checkout)

Current version: ${getCurrentVersion()}
`);
    process.exit(0);
  }

  const current = getCurrentVersion();
  console.log(`\n${B}🔍 AGPA Upgrade Check${R}\n`);
  console.log(`  Current: ${C}${current}${R}`);

  const latest = getLatestVersion();
  if (latest.error) {
    console.log(`  ${Y}⚠ ${latest.error}${R}`);
    if (isGitRepo()) {
      console.log(`\n  ${D}You're using a git checkout. To update:${R}`);
      console.log(`  ${D}  git pull && npm install${R}`);
    }
    console.log('');
    process.exit(0);
  }

  if (!latest.version) {
    console.log(`  ${Y}⚠ AGPA is not published on npm yet.${R}`);
    console.log(`  ${D}Update via git: git pull && npm install${R}\n`);
    process.exit(0);
  }

  const cmp = compareVersions(latest.version, current);
  if (cmp <= 0) {
    console.log(`  Latest:  ${C}${latest.version}${R}`);
    console.log(`\n  ${G}✅ AGPA is up-to-date!${R}\n`);
    process.exit(0);
  }

  console.log(`  Latest:  ${G}${latest.version}${R} ${Y}(update available!)${R}\n`);

  if (checkOnly) {
    console.log(`  Run "${B}agpa upgrade${R}" to upgrade.\n`);
    process.exit(1);
  }

  // ── Auto upgrade with --yes ──────────────────────────────────────────
  if (autoYes) {
    console.log(`  ${B}Auto-upgrading...${R}\n`);
    if (isGitRepo()) {
      console.log(`  ${D}git pull...${R}`);
      const pullResult = spawnSync('git', ['pull'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      if (pullResult.status !== 0) {
        console.log(`\n  ${Y}⚠ git pull failed (status ${pullResult.status})${R}\n`);
        process.exit(1);
      }
      console.log(`  ${D}npm install...${R}`);
      const installResult = spawnSync('npm', ['install'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      if (installResult.status !== 0) {
        console.log(`\n  ${Y}⚠ npm install failed${R}\n`);
        process.exit(1);
      }
      console.log(`\n  ${G}✅ Upgraded to ${latest.version}!${R}`);
      console.log(`  ${D}Run "agpa init --upgrade" to refresh hooks/configs.${R}`);
      console.log(`\n  \x1b[38;5;178m⭐ Enjoying AGPA? Star us on GitHub → \x1b[4mhttps://github.com/eiainano/AgentPlayerAchievements\x1b[0m\n`);
    } else {
      console.log(`  ${D}npm update -g agpa...${R}`);
      const npmResult = spawnSync('npm', ['update', '-g', 'agpa'], { stdio: 'inherit' });
      if (npmResult.status !== 0) {
        console.log(`\n  ${Y}⚠ npm update failed${R}\n`);
        process.exit(1);
      }
      console.log(`\n  ${G}✅ Upgraded to ${latest.version}!${R}`);
      console.log(`  ${D}Run "agpa init --auto" to refresh hooks/configs.${R}`);
      console.log(`\n  \x1b[38;5;178m⭐ Enjoying AGPA? Star us on GitHub → \x1b[4mhttps://github.com/eiainano/AgentPlayerAchievements\x1b[0m\n`);
    }
    process.exit(0);
  }

  // Show upgrade instructions based on install method
  if (isGitRepo()) {
    const remote = getGitRemote();
    console.log(`  ${B}Upgrade via git:${R}`);
    console.log(`  ${D}  cd ${PROJECT_ROOT}${R}`);
    console.log(`  ${D}  git pull${R}`);
    console.log(`  ${D}  npm install${R}`);
    if (remote) {
      console.log(`\n  ${D}Remote: ${remote}${R}`);
    }
  } else {
    console.log(`  ${B}Upgrade via npm:${R}`);
    console.log(`  ${D}  npm update -g agpa${R}`);
    console.log(`\n  ${D}After upgrading, run: agpa init --auto${R}`);
    console.log(`  ${D}(This ensures hook + instruction files are up-to-date.)${R}`);
  }

  console.log('');
}

main();
