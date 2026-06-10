import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const UPGRADE_TS = path.resolve(import.meta.dirname, '../../src/cli/upgrade.ts');

function runUpgrade(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  return spawnSync('npx', ['tsx', UPGRADE_TS, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15_000,
  });
}

describe('upgrade', () => {
  describe('--help', () => {
    it('shows usage with npm install methods', { timeout: 20_000 }, () => {
      const { stdout, status } = runUpgrade('--help');
      expect(status).toBe(0);
      expect(stdout).toContain('AGPA Upgrade');
      expect(stdout).toContain('npm update -g agpa');
      expect(stdout).toContain('git pull');
      expect(stdout).toContain('Current version:');
    });
  });

  describe('--check', () => {
    it('exits 0 or 1 (check-only mode)', () => {
      const { status } = runUpgrade('--check');
      // 0 = up-to-date, 1 = update available — both are valid
      expect([0, 1]).toContain(status);
    });
  });

  describe('default (no flags)', () => {
    it('runs without crashing', () => {
      const { status } = runUpgrade();
      // May exit 0 (up-to-date) or show upgrade instructions
      expect([0]).toContain(status);
    });

    it('shows current version', () => {
      const { stdout } = runUpgrade();
      expect(stdout).toContain('Current:');
    });
  });
});
