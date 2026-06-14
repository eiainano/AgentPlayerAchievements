#!/usr/bin/env node
/**
 * AGPA Explain CLI — show why an achievement is locked/unlocked
 *
 * Usage:
 *   agpa explain <id>              Human-readable breakdown
 *   agpa explain <id> --json       Raw JSON output
 *   agpa explain <id> --profile <name>
 */

import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import { R, B, G, D, C, RARITY_COLORS, RARITY_LABELS_EN } from '../utils/theme.js';

const Y = C; // use cyan as "not-met" indicator

const RARITY_LABELS = RARITY_LABELS_EN;

interface ExplainOptions {
  achievementId: string;
  json: boolean;
  profile: string | null;
}

function parseArgs(args: string[]): ExplainOptions {
  const opts: ExplainOptions = { achievementId: '', json: false, profile: null };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case '--json': opts.json = true; break;
      case '--profile': { const v = args[++i]; if (v) opts.profile = v; break; }
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
        if (!opts.achievementId) opts.achievementId = a;
        break;
    }
  }

  if (!opts.achievementId) {
    console.error('Usage: agpa explain <achievement_id> [--json] [--profile <name>]');
    console.error('Example: agpa explain bug_catcher');
    process.exit(1);
  }

  return opts;
}

function renderBar(current: number, target: number, width: number): string {
  if (target <= 0) return '';
  const frac = Math.min(1, current / target);
  const filled = Math.round(frac * width);
  const empty = width - filled;
  const fg = '\x1b[38;2;100;200;100m';
  const mg = '\x1b[38;2;200;200;100m';
  const gr = '\x1b[38;2;60;60;60m';
  const color = frac >= 1 ? fg : mg;
  return `${color}${'█'.repeat(filled)}${gr}${'░'.repeat(empty)}${R}`;
}

function renderExplanation(expl: ReturnType<AchievementEngine['explain']>): void {
  if (!expl) {
    console.error('Achievement not found.');
    process.exit(1);
  }

  const color = RARITY_COLORS[expl.rarity] || '';
  const rarityLabel = RARITY_LABELS[expl.rarity] || expl.rarity;
  const statusIcon = expl.unlocked ? '✓' : '✗';
  const statusColor = expl.unlocked ? G : Y;

  // ═══ Header ═══
  const line = '═'.repeat(60);
  console.log(`\n${color}${line}${R}`);
  if (expl.hidden && !expl.unlocked) {
    console.log(`${color}  ???  ·  ???  ·  Hidden${R}`);
    console.log(`${color}${line}${R}\n`);
    if (expl.hint || expl.hint_cn) {
      console.log(`  💡 Clue: ${expl.hint_cn || expl.hint}\n`);
    }
    console.log(`  ${D}(Condition details hidden until unlocked)${R}\n`);
    return;
  }

  const displayName = expl.name_cn
    ? `${expl.name} · ${expl.name_cn}`
    : expl.name;
  console.log(`${color}  ${expl.icon}  ${displayName}${R}`);
  console.log(`  ${rarityLabel}  ·  ${expl.category}  ·  ${statusColor}${statusIcon} ${expl.unlocked ? 'Unlocked' : 'Locked'}${R}`);
  if (expl.unlocked && expl.unlocked_at) {
    console.log(`  ${D}Unlocked: ${expl.unlocked_at.slice(0, 10)}${R}`);
  }
  console.log(`${color}${line}${R}\n`);

  // ═══ Conditions ═══
  for (const c of expl.conditions) {
    const checkIcon = c.met ? `${G}✓${R}` : `${Y}✗${R}`;
    const typeColor = c.met ? G : Y;

    console.log(`  ${B}Condition ${c.index}/${expl.conditions.length}:${R} ${typeColor}${c.type}${R} ${checkIcon}`);
    console.log(`  ${D}┌─ Progress:${R} ${c.current_value} / ${c.target_value} ${c.unit_label ? `(${c.unit_label})` : ''}`);
    console.log(`  ${D}│${R}  ${renderBar(c.current_value, c.target_value, 30)} ${c.progress_pct}%`);

    if (c.event_type) {
      console.log(`  ${D}├─ Event:${R} ${c.event_type}`);
    }
    if (c.filter_expr) {
      console.log(`  ${D}├─ Filter:${R} ${c.filter_expr}`);
    }
    if (c.field) {
      console.log(`  ${D}├─ Field:${R} ${c.field}`);
    }
    console.log(`  ${D}├─ Window:${R} ${c.window_label}`);
    if (c.window_start) {
      console.log(`  ${D}│${R}  ${c.window_start} → ${c.window_end || 'now'}`);
    }

    // Matched / excluded summary
    console.log(`  ${D}├─ Matched:${R} ${c.matched_count} events  ${D}|  Excluded:${R} ${c.excluded_count} events`);

    // Exclusion trace
    if (c.excluded_events.length > 0) {
      console.log(`  ${D}└─ Excluded events:${R}`);
      for (const e of c.excluded_events) {
        const ts = e.timestamp.slice(0, 16).replace('T', ' ');
        console.log(`     ${D}✗${R} ${ts}  ${e.event_type}  ${D}→${R} ${e.reason}`);
      }
    }

    // Type-specific details
    const d = c.details;
    if (d && Object.keys(d).length > 0) {
      if (c.excluded_events.length === 0) console.log(`  ${D}└─ Details:${R}`);
      else console.log(`  ${D}  Details:${R}`);

      if (c.type === 'streak' && d.active_streak !== undefined) {
        console.log(`     streak: ${d.active_streak} days  |  total active days: ${d.total_active_days}`);
      }
      if (c.type === 'sequence' && d.matched_prefix) {
        const prefix = d.matched_prefix as string[];
        const next = d.next_required as string | null;
        console.log(`     matched: [${prefix.join(', ')}]`);
        if (next) console.log(`     next required: ${next}`);
      }
      if (c.type === 'distinct_count' && d.seen_values) {
        const vals = d.seen_values as string[];
        console.log(`     seen (${vals.length}): ${vals.join(', ')}`);
      }
      if (c.type === 'set_completion' && d.members) {
        const members = d.members as Array<{ id: string; unlocked: boolean }>;
        console.log(`     members (${members.filter(m => m.unlocked).length}/${members.length}):`);
        for (const m of members.slice(0, 20)) {
          console.log(`     ${m.unlocked ? `${G}✓${R}` : `${D}✗${R}`} ${m.id}`);
        }
        if (members.length > 20) console.log(`     ${D}... and ${members.length - 20} more${R}`);
      }
      if (c.type === 'mode' && d.distribution) {
        const dist = d.distribution as Record<string, number>;
        console.log(`     distribution: ${Object.entries(dist).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
      if (c.type === 'sequence_count' && d.pattern) {
        const pat = d.pattern as string[];
        console.log(`     pattern: [${pat.join(', ')}]  |  cycles: ${d.completed_cycles}`);
      }
      if (c.type === 'threshold' && d.sum_value !== undefined) {
        console.log(`     sum: ${d.sum_value}`);
      }
    }

    console.log('');
  }

  // Hint for locked achievements
  if (!expl.unlocked && (expl.hint || expl.hint_cn)) {
    console.log(`  💡 ${D}Clue:${R} ${expl.hint_cn || expl.hint}\n`);
  }
}

function main(): void {
  // process.argv when dispatched: ['agpa', 'agpa', 'explain', ...args]
  // process.argv when direct:    ['npx', 'src/cli/explain.ts', ...args]
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === 'explain' ? rawArgs.slice(1) : rawArgs;
  const opts = parseArgs(args);

  const resolvedProfile = opts.profile || loadConfig().active_profile || DEFAULT_PROFILE;
  const stateDir = resolvedProfile !== 'default' ? resolveProfileDir(resolvedProfile) : undefined;
  const engine = new AchievementEngine(stateDir ? { stateDir } : {});
  engine.init();

  const expl = engine.explain(opts.achievementId);

  if (!expl) {
    console.error(`\n  Achievement not found: "${opts.achievementId}"`);
    console.error(`  Run 'agpa search' to list all achievements.\n`);
    process.exit(1);
  }

  if (opts.json) {
    if (expl.hidden && !expl.unlocked) {
      // Mask conditions for hidden achievements
      console.log(JSON.stringify({
        achievement_id: expl.achievement_id,
        hidden: true,
        unlocked: false,
        hint: expl.hint || null,
        hint_cn: expl.hint_cn || null,
        rarity: expl.rarity,
        message: 'This is a hidden achievement. Condition details are concealed until unlocked.',
        message_cn: '这是一个隐藏成就，条件详情在解锁前保密。',
      }, null, 2));
    } else {
      console.log(JSON.stringify(expl, null, 2));
    }
    return;
  }

  renderExplanation(expl);
}

main();
