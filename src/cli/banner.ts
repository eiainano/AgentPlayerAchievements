#!/usr/bin/env node
/**
 * AGPA Banner — switch the terminal ASCII banner color theme
 *
 * Usage:
 *   agpa banner            Show current theme
 *   agpa banner <theme>    Switch to Neon | Arcade | Gold
 */

import { getBannerTheme, setBannerTheme } from '../config.js';
import type { BannerTheme } from '../config.js';

const VALID_THEMES: BannerTheme[] = ['Neon', 'Arcade', 'Gold'];

const THEME_LABELS: Record<BannerTheme, string> = {
  Neon:   'Cyan → Magenta cyberpunk gradient (default)',
  Arcade: 'PS4 △○×□ Green / Red / Blue / Pink — one color per letter',
  Gold:   'Gold gradient matching Dashboard brand (#f5b800)',
};

function main(): void {
  const action = process.argv[3]; // argv[2] is 'banner'

  // ── No argument → show status ────────────────────────────────────
  if (!action) {
    const current = getBannerTheme();
    console.log(`\n  Current banner theme: \x1b[1m${current}\x1b[0m`);
    console.log(`  ${THEME_LABELS[current]}\n`);
    console.log('  Available themes:');
    for (const t of VALID_THEMES) {
      const marker = t === current ? '  \x1b[38;2;0;255;255m*\x1b[0m' : '  ';
      console.log(`${marker} \x1b[1m${t.padEnd(8)}\x1b[0m ${THEME_LABELS[t]}`);
    }
    console.log('\n  Usage: agpa banner <Neon|Arcade|Gold>\n');
    process.exit(0);
  }

  // ── Set theme ────────────────────────────────────────────────────
  const theme = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  if (!VALID_THEMES.includes(theme as BannerTheme)) {
    console.log(`\n\x1b[31m  ✕ Invalid theme: "${action}"\x1b[0m`);
    console.log(`  Valid themes: ${VALID_THEMES.join(', ')}\n`);
    console.log(`  Usage: agpa banner <Neon|Arcade|Gold>\n`);
    process.exit(1);
  }

  setBannerTheme(theme as BannerTheme);
  const label = THEME_LABELS[theme as BannerTheme];
  console.log(`\x1b[32m  ✓\x1b[0m Banner theme set to \x1b[1m${theme}\x1b[0m`);
  console.log(`  ${label}\n`);
  console.log('  Run \x1b[1magpa\x1b[0m to see the new banner.\n');
}

main();
