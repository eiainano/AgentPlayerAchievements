import { execFileSync } from 'child_process';
import { platform } from 'os';

export interface BatteryStatus {
  on_battery: boolean;
  battery_pct: number;
}

// ── Platform-specific readers ──────────────────────────────────────

/** macOS: `pmset -g batt` */
function readMacBattery(): BatteryStatus | null {
  try {
    const out = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf-8', timeout: 1000 });
    const lines = out.split('\n');
    const onBattery = /Battery Power/i.test(lines[0] ?? '');
    const pctMatch = lines[1]?.match(/(\d{1,3})%/);
    if (!pctMatch) return null;
    return { on_battery: onBattery, battery_pct: Number(pctMatch[1]) };
  } catch {
    return null;
  }
}

/** Linux: read `/sys/class/power_supply/` — no extra packages needed */
function readLinuxBattery(): BatteryStatus | null {
  // Find a battery device — try BAT0, BAT1, or first battery named device
  const candidates = ['BAT0', 'BAT1'];
  for (const name of candidates) {
    const status = readLinuxBatteryDevice(name);
    if (status) return status;
  }
  return null;
}

function readLinuxBatteryDevice(name: string): BatteryStatus | null {
  try {
    const capacity = execFileSync('cat', [`/sys/class/power_supply/${name}/capacity`], { encoding: 'utf-8', timeout: 500 }).trim();
    const status = execFileSync('cat', [`/sys/class/power_supply/${name}/status`], { encoding: 'utf-8', timeout: 500 }).trim();

    const pct = Number(capacity);
    if (isNaN(pct)) return null;

    // Status values: Charging, Discharging, Full, Not charging
    return {
      on_battery: status === 'Discharging',
      battery_pct: pct,
    };
  } catch {
    return null;
  }
}

/** Windows: `wmic path Win32_Battery Get EstimatedChargeRemaining, BatteryStatus` */
function readWinBattery(): BatteryStatus | null {
  try {
    const out = execFileSync('wmic', [
      'path', 'Win32_Battery', 'get', 'EstimatedChargeRemaining,BatteryStatus',
    ], { encoding: 'utf-8', timeout: 2000 });

    // Output looks like:
    // BatteryStatus  EstimatedChargeRemaining
    // 1              85
    const matches = [...out.matchAll(/(\d+)\s+(\d{1,3})/g)];
    if (matches.length === 0) return null;

    // BatteryStatus: 1=Discharging, 2=AC Power, 3=Fully Charged, ...
    const statusCode = Number(matches[0]![1]);
    const pct = Number(matches[0]![2]);

    return {
      on_battery: statusCode === 1, // 1 = discharging
      battery_pct: pct,
    };
  } catch {
    return null;
  }
}

// ── Unified entry point ────────────────────────────────────────────

/** Read battery status on macOS, Linux, or Windows. Returns null on desktop, failure, or unsupported platform. */
export function getBatteryStatus(): BatteryStatus | null {
  const pf = platform();
  if (pf === 'darwin') return readMacBattery();
  if (pf === 'linux') return readLinuxBattery();
  if (pf === 'win32') return readWinBattery();
  return null;
}
