#!/usr/bin/env node
/**
 * AGPA Config CLI — view and update AGPA settings
 *
 * Usage:
 *   agpa config                           Show all settings
 *   agpa config lang <en|zh>              Set language
 *   agpa config sound <on|off>            Toggle sound
 *   agpa config profile <name>            Switch active profile
 *   agpa config debug <true|false>        Toggle debug mode
 */

import { loadConfig, saveConfig } from '../config.js';
import { listProfiles, profileExists } from '../utils/profile.js';

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const C = '\x1b[36m';
const G = '\x1b[32m';

function boolLabel(v: boolean | undefined): string {
  return v ? `${G}yes${R}` : `no`;
}

function showConfig(): void {
  const cfg = loadConfig();
  const profiles = listProfiles();

  console.log(`\n${B}⚙ AGPA Configuration${R}\n`);
  console.log(`  ${B}lang${R}              ${cfg.lang.padEnd(6)}${D}(en | zh)${R}`);
  console.log(`  ${B}sound_enabled${R}     ${boolLabel(cfg.sound_enabled).padEnd(6)}`);
  console.log(`  ${B}active_profile${R}    ${cfg.active_profile}`);
  console.log(`  ${B}debug${R}             ${boolLabel(cfg.debug).padEnd(6)}`);
  console.log(`  ${B}telemetry${R}         ${boolLabel(cfg.telemetry).padEnd(6)}${D}(anonymous usage data)${R}`);
  console.log(`  ${B}recommend_prob${R}     ${cfg.recommend_probability}`);

  if (profiles.length > 1) {
    console.log(`\n  ${D}Profiles:${R} ${profiles.join(', ')}`);
  }

  console.log(`\n  ${D}Set values:${R}`);
  console.log(`    ${C}agpa config lang en|zh${R}         ${D}Language${R}`);
  console.log(`    ${C}agpa config sound on|off${R}       ${D}Sound effects${R}`);
  console.log(`    ${C}agpa config profile <name>${R}     ${D}Switch profile${R}`);
  console.log(`    ${C}agpa config debug true|false${R}   ${D}Debug mode${R}`);
  console.log(`    ${C}agpa config recommend_probability <0.0-1.0>${R}  ${D}Recommend probability${R}`);
  console.log('');
}

function showConfigJSON(): void {
  const cfg = loadConfig();
  const profiles = listProfiles();
  console.log(JSON.stringify({ ...cfg, profiles }, null, 2));
}

function main(): void {
  const args = process.argv.slice(3); // "agpa", "config", ...

  if (args.length === 0 || (args.length === 1 && args[0] === '--json')) {
    if (args[0] === '--json') {
      showConfigJSON();
    } else {
      showConfig();
    }
    process.exit(0);
  }

  const key = args[0]!;
  const value = args[1];

  switch (key) {
    case 'lang': {
      if (value !== 'en' && value !== 'zh') {
        console.error('Usage: agpa config lang <en|zh>');
        process.exit(1);
      }
      saveConfig({ lang: value });
      console.log(`✅ Language set to ${value === 'zh' ? '中文' : 'English'}`);
      break;
    }

    case 'sound': {
      if (value === 'on') {
        saveConfig({ sound_enabled: true });
        console.log('✅ Sound effects enabled \x1b[38;2;255;200;0m🔊\x1b[0m');
      } else if (value === 'off') {
        saveConfig({ sound_enabled: false });
        console.log('\x1b[90m🔇\x1b[0m Sound effects disabled');
      } else {
        console.error('Usage: agpa config sound <on|off>');
        process.exit(1);
      }
      break;
    }

    case 'profile': {
      if (!value) {
        console.error('Usage: agpa config profile <name>');
        process.exit(1);
      }
      if (!profileExists(value)) {
        console.error(`Profile "${value}" does not exist.`);
        console.error(`  Existing: ${listProfiles().join(', ')}`);
        console.error(`  Create:   agpa profile create ${value}`);
        process.exit(1);
      }
      saveConfig({ active_profile: value });
      console.log(`✅ Active profile switched to "${value}"`);
      break;
    }

    case 'debug': {
      if (value === 'true') {
        saveConfig({ debug: true });
        console.log('✅ Debug mode enabled');
      } else if (value === 'false') {
        saveConfig({ debug: false });
        console.log('✅ Debug mode disabled');
      } else {
        console.error('Usage: agpa config debug <true|false>');
        process.exit(1);
      }
      break;
    }

    case 'recommend_probability':
    case 'rp': {
      if (!value) {
        console.error('Usage: agpa config recommend_probability <0.0-1.0>');
        process.exit(1);
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 1) {
        console.error('recommend_probability must be between 0.0 and 1.0');
        process.exit(1);
      }
      saveConfig({ recommend_probability: num });
      const pct = Math.round(num * 100);
      console.log(`✅ Recommendation probability set to ${num} (${pct}%)`);
      break;
    }

    default:
      console.error(`Unknown config key: "${key}"`);
      console.error('Available keys: lang, sound, profile, debug, recommend_probability');
      process.exit(1);
  }
}

main();
