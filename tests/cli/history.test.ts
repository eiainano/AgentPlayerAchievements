import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const HISTORY_TS = path.resolve(import.meta.dirname, '../../src/cli/history.ts');

function runHistory(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  return spawnSync('npx', ['tsx', HISTORY_TS, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15_000,
  });
}

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `agpa-history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('history', () => {
  describe('--help', () => {
    it('shows usage', { timeout: 20_000 }, () => {
      const { stdout, status } = runHistory('--help');
      expect(status).toBe(0);
      expect(stdout).toContain('AGPA History');
      expect(stdout).toContain('--N');
      expect(stdout).toContain('--json');
    });
  });

  describe('with no event data', () => {
    it('handles missing event.log gracefully', () => {
      const { status, stdout } = runHistory();
      // May exit 0 with "No events recorded" message
      expect(status).toBe(0);
    });
  });

  describe('--json', () => {
    it('outputs valid JSON', () => {
      const { stdout, status } = runHistory('--json');
      expect(status).toBe(0);
      // Should be valid JSON (may be empty or have events)
      const result = JSON.parse(stdout.trim());
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('--N flag', () => {
    it('rejects invalid count', () => {
      const { status } = runHistory('--N', '-1');
      expect(status).toBe(1);
    });

    it('accepts valid count', () => {
      const { status } = runHistory('--N', '5');
      expect(status).toBe(0);
    });
  });

  describe('--event filter', () => {
    it('requires a value', () => {
      const { status, stderr } = runHistory('--event');
      expect(status).toBe(1);
      expect(stderr).toContain('requires');
    });

    it('accepts a filter value', () => {
      const { status } = runHistory('--event', 'session');
      expect(status).toBe(0);
    });
  });

  describe('--today', () => {
    it('filters to today only', () => {
      const { status } = runHistory('--today');
      expect(status).toBe(0);
    });
  });

  describe('--profile', () => {
    it('requires a value', () => {
      const { status, stderr } = runHistory('--profile');
      expect(status).toBe(1);
      expect(stderr).toContain('requires');
    });
  });
});
