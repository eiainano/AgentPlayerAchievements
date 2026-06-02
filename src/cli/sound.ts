#!/usr/bin/env node
/**
 * AGPA Sound — toggle achievement sound effects
 *
 * Usage:
 *   agpa sound       Show current status
 *   agpa sound on    Enable sounds
 *   agpa sound off   Disable sounds
 */

import { isSoundEnabled, setSoundEnabled } from '../config.js';

function main(): void {
  const arg = process.argv[2]; // 'sound' → arg, then next is on/off
  const action = process.argv[3];

  if (!action || (action !== 'on' && action !== 'off')) {
    const status = isSoundEnabled() ? 'ON 🔊' : 'OFF 🔇';
    console.log(`Sound effects: ${status}`);
    console.log('Usage: agpa sound <on|off>');
    process.exit(0);
  }

  if (action === 'on') {
    setSoundEnabled(true);
    console.log('✅ Sound effects enabled 🔊');
  } else {
    setSoundEnabled(false);
    console.log('🔇 Sound effects disabled');
  }
}

main();
