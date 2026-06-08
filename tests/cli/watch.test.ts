import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const WATCH_TS = path.resolve(import.meta.dirname, '../../src/cli/watch.ts');

function runWatch(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  return spawnSync('npx', ['tsx', WATCH_TS, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });
}

describe('watch', () => {
  describe('--help', () => {
    it('shows usage', () => {
      const { stdout, status } = runWatch('--help');
      expect(status).toBe(0);
      expect(stdout).toContain('AGPA Watch');
      expect(stdout).toContain('--poll');
      expect(stdout).toContain('Ctrl+C');
    });
  });

  describe('--poll flag', () => {
    it('accepts valid poll interval', () => {
      // In non-TTY mode (test runner), watch exits immediately with stats JSON
      const { status, stdout } = runWatch('--poll', '10');
      expect(status).toBe(0);
      // Non-TTY mode outputs JSON stats
      const parsed = JSON.parse(stdout.trim());
      expect(parsed).toHaveProperty('total_achievements');
    });

    it('rejects poll interval < 1', () => {
      const { status, stderr } = runWatch('--poll', '0');
      expect(status).toBe(1);
      expect(stderr).toContain('1-60');
    });

    it('rejects poll interval > 60', () => {
      const { status, stderr } = runWatch('--poll', '999');
      expect(status).toBe(1);
      expect(stderr).toContain('1-60');
    });

    it('rejects non-numeric poll value', () => {
      const { status } = runWatch('--poll', 'abc');
      expect(status).toBe(1);
    });
  });

  describe('--profile', () => {
    it('accepts a profile name', () => {
      // Non-TTY mode exits immediately with stats (no infinite loop)
      const { status, stdout } = runWatch('--profile', 'test');
      expect(status).toBe(0);
      const parsed = JSON.parse(stdout.trim());
      expect(parsed).toHaveProperty('total_achievements');
    });
  });
});
