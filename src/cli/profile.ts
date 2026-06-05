#!/usr/bin/env node
/**
 * AGPA Profile CLI — manage achievement profiles
 *
 * Usage:
 *   npx tsx src/cli/profile.ts create [name]   Create a new profile
 *   npx tsx src/cli/profile.ts list             List all profiles
 */

import { createProfile, listProfiles, listProfilesWithMeta, validateProfileName, MAX_PROFILES } from '../utils/profile.js';
import { TOOLS } from '../tool-registry.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log('AGPA Profile Manager');
  console.log('');
  console.log('Usage:');
  console.log('  npx tsx src/cli/profile.ts create [name]  Create a new profile (default: profile0)');
  console.log('  npx tsx src/cli/profile.ts list            List all profiles');
  console.log('');
  console.log(`Max ${MAX_PROFILES} named profiles + 1 default = ${MAX_PROFILES + 1} total.`);
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

  default:
    printHelp();
    break;
}
