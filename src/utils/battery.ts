import { execFileSync } from 'child_process';

export interface BatteryStatus {
  on_battery: boolean;
  battery_pct: number;
}

/** Read macOS battery status via `pmset -g batt`. Returns null on failure or non-macOS. */
export function getBatteryStatus(): BatteryStatus | null {
  try {
    const out = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf-8', timeout: 1000 });
    const lines = out.split('\n');

    // Line 0: "Now drawing from 'Battery Power'" or "Now drawing from 'AC Power'"
    const onBattery = /Battery Power/i.test(lines[0] ?? '');

    // Line 1: " -InternalBattery-0 (id=...)  15%; discharging; ..."
    const pctMatch = lines[1]?.match(/(\d{1,3})%/);
    if (!pctMatch) return null;

    return {
      on_battery: onBattery,
      battery_pct: Number(pctMatch[1]),
    };
  } catch {
    return null; // non-macOS, no battery, or execution failure
  }
}
