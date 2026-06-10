import { describe, it, expect } from 'vitest';
import { getBatteryStatus } from '../../src/utils/battery.js';

describe('battery detection', () => {
  it('getBatteryStatus returns a valid shape or null', () => {
    const result = getBatteryStatus();
    if (result !== null) {
      expect(typeof result.on_battery).toBe('boolean');
      expect(typeof result.battery_pct).toBe('number');
      expect(result.battery_pct).toBeGreaterThanOrEqual(0);
      expect(result.battery_pct).toBeLessThanOrEqual(100);
    }
    // null is valid on desktop machines or unsupported platforms
  });
});
