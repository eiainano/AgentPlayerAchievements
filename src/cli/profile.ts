#!/usr/bin/env node
/**
 * AGPA Profile CLI — manage achievement profiles
 *
 * Usage:
 *   npx tsx src/cli/profile.ts create [name]   Create a new profile
 *   npx tsx src/cli/profile.ts list             List all profiles
 *   npx tsx src/cli/profile.ts delete           Delete a profile (with confirmation)
 */

import * as readline from 'node:readline';
import { homedir } from 'node:os';
import { createProfile, listProfiles, listProfilesWithMeta, getProfileMeta, setTrackedTools, validateProfileName, profileExists, deleteProfile, DEFAULT_PROFILE, MAX_PROFILES } from '../utils/profile.js';
import { saveConfig } from '../config.js';
import { TOOLS, scanTools } from '../tool-registry.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log('AGPA Profile Manager');
  console.log('');
  console.log('Usage:');
  console.log('  npx tsx src/cli/profile.ts create [name]  Create a new profile (default: profile0)');
  console.log('  npx tsx src/cli/profile.ts list            List all profiles');
  console.log('  npx tsx src/cli/profile.ts switch <name>   Switch active profile');
  console.log('  npx tsx src/cli/profile.ts softwares [name]    Manage tracked software for a profile');
  console.log('  npx tsx src/cli/profile.ts delete          Delete a named profile (interactive confirm)');
  console.log('');
  console.log(`Max ${MAX_PROFILES} named profiles + 1 default = ${MAX_PROFILES + 1} total.`);
  console.log('  (default and _demo cannot be deleted)');
}

// ── Interactive tracked-tools picker ───────────────────────────────

/**
 * Show current tracked tools + installed tools, let user toggle selections.
 * Pre-selected: tools currently tracked by the profile.
 * Fallback (non-TTY): display current state and detected tools; no changes.
 */
function promptTrackedTools(profileName: string): Promise<void> {
  const scanResults = scanTools();
  const meta = getProfileMeta(profileName);
  const current = new Set(meta.tracked_tools || []);
  const home = homedir();

  if (!process.stdin.isTTY) {
    // Non-TTY fallback: show current state
    console.log(`\nTracked tools for profile "${profileName}":`);
    for (const r of scanResults) {
      const prefix = current.has(r.id) ? '✅' : '—';
      const info = r.detected ? `(${r.configPath.replace(home, '~')})` : '(not installed)';
      console.log(`  ${prefix} ${r.name.padEnd(18)} ${info}`);
    }
    console.log('');
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const selected = scanResults.map(r => current.has(r.id));
    const toolNames: Record<string, string> = {
      'claude-code': 'Claude Code',
      'kilo-code': 'Kilo Code',
      'hermes': 'Hermes Agent',
      'opencode': 'OpenCode',
      'openclaw': 'OpenClaw',
    };
    let cursor = 0;
    let lineCount = 0;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const clear = () => {
      if (lineCount > 0) {
        process.stdout.write(`\x1b[${lineCount}A\x1b[J`);
        lineCount = 0;
      }
    };

    const render = () => {
      clear();
      const lines: string[] = [];
      lines.push('');
      lines.push(`  🔧 Manage tracked tools for "${profileName}"`);
      lines.push('');
      for (let i = 0; i < scanResults.length; i++) {
        const r = scanResults[i]!;
        const isCursor = i === cursor;
        const isSelected = selected[i]!;
        const prefix = isCursor ? ' ❯' : '  ';
        const check = isSelected ? '\x1b[32m[✓]\x1b[0m' : '\x1b[90m[ ]\x1b[0m';
        const status = r.detected
          ? `  \x1b[32mdetected\x1b[0m \x1b[90m${r.configPath.replace(home, '~')}\x1b[0m`
          : `  \x1b[90mnot detected\x1b[0m`;
        lines.push(`${prefix}${check} ${r.name}${status}`);
      }
      lines.push('');
      lines.push('  \x1b[90m↑/↓ navigate  Space toggle  Enter save | Ctrl+C cancel\x1b[0m');
      const out = '\n' + lines.join('\n') + '\n';
      process.stdout.write(out);
      lineCount = lines.length + 1;
    };

    render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const onKeypress = (_str: string, key: readline.Key) => {
      if (key.name === 'up') {
        cursor = (cursor - 1 + scanResults.length) % scanResults.length;
        render();
      } else if (key.name === 'down') {
        cursor = (cursor + 1) % scanResults.length;
        render();
      } else if (key.name === 'space') {
        selected[cursor] = !selected[cursor];
        render();
      } else if (key.name === 'return') {
        cleanup();
        clear();
        const chosen = scanResults.filter((_, i) => selected[i]).map(r => r.id);
        setTrackedTools(profileName, chosen);
        console.log(`\n  ✅ Updated "${profileName}" → ${chosen.length} tool(s) tracked:`);
        for (const id of chosen) {
          console.log(`     ${toolNames[id] || id}`);
        }
        console.log('');
        console.log('  💡 Run \x1b[36magpa init --profile ' + profileName + '\x1b[0m to configure any new tools.\n');
        resolve();
      } else if (key.name === 'c' && key.ctrl) {
        cleanup();
        console.log('\n  Cancelled.\n');
        process.exit(0);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
    };

    process.stdin.on('keypress', onKeypress);
  });
}

switch (command) {
  case 'create': {
    const name = args[1]?.trim() || 'profile0';
    const error = validateProfileName(name);
    if (error) {
      console.error(`Invalid profile name: ${error}`);
      process.exit(1);
    }
    try {
      const dir = createProfile(name);
      console.log(`Profile "${name}" created at ${dir}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to create profile: ${msg}`);
      process.exit(1);
    }
    break;
  }

  case 'list': {
    const metaList = listProfilesWithMeta();
    console.log(`Profiles (${metaList.length}/${MAX_PROFILES + 1} max):\n`);
    for (const m of metaList) {
      const marker = m.name === 'default' ? ' (default)' : '';
      const tools = (m.tracked_tools || []).map(id => TOOLS.find(t => t.id === id)?.name || id).join(', ') || 'none';
      console.log(`  ${m.emoji}  ${m.name}${marker}`);
      console.log(`     Tools: ${tools}`);
      console.log('');
    }
    break;
  }

  case 'switch': {
    const targetName = args[1]?.trim();
    if (!targetName) {
      console.error('Usage: agpa profile switch <name>');
      process.exit(1);
    }
    if (!profileExists(targetName)) {
      console.error(`Profile "${targetName}" does not exist.`);
      console.error(`  Existing: ${listProfiles().join(', ')}`);
      console.error(`  Create:   agpa profile create ${targetName}`);
      process.exit(1);
    }
    saveConfig({ active_profile: targetName });
    console.log(`✅ Switched to profile "${targetName}"`);
    break;
  }

  case 'softwares': {
    const profileName = args[1]?.trim() || DEFAULT_PROFILE;
    if (profileName !== DEFAULT_PROFILE && !profileExists(profileName)) {
      console.error(`Profile "${profileName}" does not exist. Use "agpa profile create ${profileName}" first.`);
      process.exit(1);
    }
    promptTrackedTools(profileName).then(() => process.exit(0));
    break;
  }

  case 'delete': {
    const allProfiles = listProfilesWithMeta();
    // Exclude default and _demo from deletable list
    const deletable = allProfiles.filter(p => p.name !== 'default' && p.name !== '_demo');

    if (deletable.length === 0) {
      console.log('No named profiles to delete.');
      console.log('  (default and _demo cannot be deleted)');
      process.exit(0);
    }

    // Show deletable profiles
    console.log('Select a profile to delete:\n');
    for (let i = 0; i < deletable.length; i++) {
      const p = deletable[i]!;
      const meta = getProfileMeta(p.name);
      const tools = (meta.tracked_tools || []).length > 0
        ? ` (tracked tools: ${meta.tracked_tools!.join(', ')})`
        : '';
      const created = meta.created_at
        ? ` · created ${meta.created_at.slice(0, 10)}`
        : '';
      console.log(`  ${i + 1}. ${p.emoji || '👤'} ${p.name}${created}${tools}`);
    }

    // Use simple readline prompts
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const askName = (): Promise<string> => new Promise(resolve => {
      rl.question('\nEnter the profile name to delete: ', resolve);
    });

    const askConfirm = (targetName: string): Promise<boolean> => new Promise(resolve => {
      rl.question(`\n⚠️  WARNING: This will permanently delete all achievement data for "${targetName}".\nThis cannot be undone!\n\nType the profile name again to confirm: `, (answer) => {
        resolve(answer.trim() === targetName);
      });
    });

    const askDate = (): Promise<boolean> => new Promise(resolve => {
      const today = new Date().toISOString().slice(0, 10);
      rl.question(`Type today's date (YYYY-MM-DD) to confirm:\nExpected: ${today}\nEnter: `, (answer) => {
        resolve(answer.trim() === today);
      });
    });

    (async () => {
      const targetRaw = await askName();
      const target = targetRaw.trim();

      if (!target || target === 'default' || target === '_demo') {
        console.log(`\nCannot delete "${target}". Only named profiles can be deleted.`);
        rl.close();
        process.exit(1);
      }

      if (!profileExists(target)) {
        console.log(`\nProfile "${target}" does not exist.`);
        rl.close();
        process.exit(1);
      }

      const nameOk = await askConfirm(target);
      if (!nameOk) {
        console.log('\nProfile name mismatch. Deletion cancelled.');
        rl.close();
        process.exit(0);
      }

      const dateOk = await askDate();
      if (!dateOk) {
        console.log('\nIncorrect date. Deletion cancelled.');
        rl.close();
        process.exit(0);
      }

      rl.close();

      try {
        deleteProfile(target);
        console.log(`\n✅ Profile "${target}" has been permanently deleted.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`\nFailed to delete profile: ${msg}`);
        process.exit(1);
      }
    })();
    break;
  }

  default:
    printHelp();
    break;
}
