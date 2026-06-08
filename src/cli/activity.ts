#!/usr/bin/env node
/**
 * AGPA Activity — terminal streak + heatmap viewer
 *
 * Usage:
 *   agpa activity               Full output (streak + heatmap)
 *   agpa activity --streak      Streak only
 *   agpa activity --heatmap     Heatmap only
 *   agpa activity --compact     Compact 1-char-per-cell heatmap mode
 */

import { AchievementEngine } from '../engine/engine.js';
import { loadConfig } from '../config.js';
import { resolveProfileDir, DEFAULT_PROFILE } from '../utils/profile.js';
import { calcStreak, computeHeatmap } from '../utils/activity.js';
import type { StreakData, HeatmapData } from '../utils/activity.js';

function parseProfile(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) return args[i + 1]!;
  }
  return process.env.AGPA_PROFILE || loadConfig().active_profile || DEFAULT_PROFILE;
}

const activeProfile = parseProfile(process.argv.slice(3));
const stateDir = resolveProfileDir(activeProfile);

// ── ANSI helpers ─────────────────────────────────────────────────────────

/** 24-bit true-color background */
function bg(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

const RESET = '\x1b[0m';

const HEAT_COLORS: Record<number, [number, number, number]> = {
  0: [30, 30, 40],   // dark gray
  1: [198, 228, 139], // light green
  2: [123, 201, 111], // medium green
  3: [35, 154, 59],   // deep green
  4: [25, 111, 45],   // darkest green
};

const BLOCK_FG: Record<number, string> = {
  0: '\x1b[38;2;60;60;70m',
  1: '\x1b[38;2;198;228;139m',
  2: '\x1b[38;2;123;201;111m',
  3: '\x1b[38;2;35;154;59m',
  4: '\x1b[38;2;25;111;45m',
};

// ── CLI args ─────────────────────────────────────────────────────────────

function parseArgs(): { streak: boolean; heatmap: boolean; compact: boolean; json: boolean } {
  const args = process.argv.slice(3); // 0=node, 1=index.ts, 2=activity
  const streak = args.includes('--streak');
  const heatmap = args.includes('--heatmap');
  const compact = args.includes('--compact');
  const json = args.includes('--json');
  // No flags → show all
  if (!streak && !heatmap && !json) return { streak: true, heatmap: true, compact, json: false };
  return { streak, heatmap, compact, json };
}

// ── Streak rendering ─────────────────────────────────────────────────────

function renderStreak(data: StreakData): void {
  const useZh = loadConfig().lang === 'zh';

  if (data.current === 0 && data.longest === 0) {
    console.log(useZh ? '\n🔥 还没有数据，开始你的第一天！\n' : '\n🔥 No data yet — start your first session!\n');
    return;
  }

  const title = useZh ? '🔥 编码连胜' : '🔥 Coding Streak';
  const daysUnit = useZh ? '天' : 'days';
  const bestLabel = useZh ? '最高' : 'Best';
  const activeLabel = data.today_active
    ? (useZh ? '今天已活跃 ✓' : 'Active today ✓')
    : (useZh ? '今天还没写代码' : 'Not yet today');

  console.log(`\n${title}`);
  console.log(`   ${data.current} ${daysUnit}  |  ${bestLabel} ${data.longest} ${daysUnit}  |  ${activeLabel}\n`);
}

// ── Heatmap rendering ────────────────────────────────────────────────────

function renderHeatmap(data: HeatmapData, compact: boolean, columns: number): void {
  const days = data.days;
  if (!days || days.length === 0) {
    console.log('No activity data available.\n');
    return;
  }

  // Check terminal width
  if (columns < 50) {
    console.log('Terminal too narrow for heatmap. Use --streak or open the Dashboard.\n');
    return;
  }

  const useCompact = compact || columns < 80;
  const cellW = useCompact ? 1 : 2;
  const gap = 1;

  // Pad front so first data cell lands on its correct day-of-week row.
  // Grid rows: 0=Sun, 1=Mon, ..., 6=Sat. frontPad = how many empty cells before first data.
  const firstDate = new Date(days[0]!.date);
  const startDow = firstDate.getDay(); // 0=Sun
  const frontPad = startDow;

  // Row labels (1-based index in week, Mon=1)
  const ROW_LABELS = ['一', '三', '五', '日']; // Mon, Wed, Fri, Sun
  const LABEL_ROW_INDICES = [1, 3, 5, 0]; // Mon=1, Wed=3, Fri=5, Sun=0

  // Build weeks
  const totalCells = frontPad + days.length;
  const totalCols = Math.ceil(totalCells / 7);

  // Month labels: find which columns start new months
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthCols = new Map<number, string>(); // colIndex → month label
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i]!.date);
    const col = Math.floor((frontPad + i) / 7);
    if (!monthCols.has(col) || i === 0) {
      monthCols.set(col, MONTH_NAMES[d.getMonth()]!);
    }
  }
  // Deduplicate adjacent same-month labels
  let lastMonth = '';
  const finalMonthCols = new Map<number, string>();
  for (const [col, month] of monthCols) {
    if (month !== lastMonth) finalMonthCols.set(col, month);
    lastMonth = month;
  }

  // Render month labels row
  let monthLine = '      '; // pad for row labels
  for (let c = 0; c < totalCols; c++) {
    const label = finalMonthCols.get(c) || '';
    const totalCellSpace = cellW + gap;
    monthLine += label.padEnd(totalCellSpace, ' ').slice(0, totalCellSpace);
  }
  console.log(monthLine);

  // Render grid rows (row 0 = Sunday, row 1 = Monday, ..., row 6 = Saturday)
  for (let row = 0; row < 7; row++) {
    // Row label
    const labelIdx = LABEL_ROW_INDICES.indexOf(row);
    const label = labelIdx >= 0 ? ROW_LABELS[labelIdx]! : '  ';
    let line = `  ${label} `;

    for (let col = 0; col < totalCols; col++) {
      const cellIdx = col * 7 + row - frontPad;
      if (cellIdx < 0 || cellIdx >= days.length) {
        // Empty padding cell
        line += ' '.repeat(cellW + gap);
        continue;
      }
      const day = days[cellIdx]!;
      const [r, g, b] = HEAT_COLORS[day.level] ?? HEAT_COLORS[0]!;

      if (useCompact) {
        // Single char with foreground color
        const fg = BLOCK_FG[day.level] || BLOCK_FG[0];
        const ch = day.level === 0 ? '·' : day.level >= 3 ? '█' : day.level >= 2 ? '▓' : '▒';
        line += `${fg}${ch}${RESET}`;
      } else {
        // Two chars with background color
        line += `${bg(r, g, b)}  ${RESET}`;
      }
      // Gap between cells (not after last col)
      if (col < totalCols - 1) line += ' '.repeat(gap);
    }
    console.log(line);
  }

  // Legend
  const useZh = loadConfig().lang === 'zh';
  const less = useZh ? '少' : 'Less';
  const more = useZh ? '多' : 'More';

  let legendLine = '       ';
  legendLine += less + ' ';
  for (let level = 0; level <= 4; level++) {
    const [r, g, b] = HEAT_COLORS[level]!;
    legendLine += `${bg(r, g, b)}  ${RESET}` + ' ';
  }
  legendLine += more;
  console.log(`\n${legendLine}`);
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const { streak: showStreak, heatmap: showHeatmap, compact, json } = parseArgs();
  const columns = process.stdout.columns || 80;

  const engine = new AchievementEngine({ stateDir });
  engine.init();
  const events = engine.events;

  if (json) {
    const streakData = calcStreak(events);
    const heatmapData = computeHeatmap(events);
    const output = {
      streak: {
        current: streakData.current,
        longest: streakData.longest,
        today_active: streakData.today_active,
      },
      heatmap: {
        days: heatmapData.days.map(d => ({
          date: d.date,
          level: d.level,
          count: d.count,
        })),
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (showStreak) {
    renderStreak(calcStreak(events));
  }
  if (showHeatmap) {
    renderHeatmap(computeHeatmap(events), compact, columns);
  }
}

main();
