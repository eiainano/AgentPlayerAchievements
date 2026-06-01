#!/usr/bin/env node
/**
 * AGPA Profile CLI — manage achievement profiles
 *
 * Usage:
 *   npx tsx src/cli/profile.ts create [name]   Create a new profile
 *   npx tsx src/cli/profile.ts list             List all profiles
 */

import { createProfile, listProfiles, validateProfileName, MAX_PROFILES } from '../utils/profile.js';

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
    const profiles = listProfiles();
    console.log(`Profiles (${profiles.length}/${MAX_PROFILES + 1} max):`);
    for (const p of profiles) {
      const marker = p === 'default' ? ' (default)' : '';
      console.log(`  ${p}${marker}`);
    }
    break;
  }

  default:
    printHelp();
    break;
}
