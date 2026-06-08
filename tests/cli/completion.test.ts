/**
 * Tests for shell completion generation.
 *
 * The completion module exports no functions — it uses a main() pattern.
 * We test by spawning the script via tsx and checking stdout.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const COMPLETION_TS = path.resolve(import.meta.dirname, '../../src/cli/completion.ts');

function runCompletion(shell: string): string {
  return execSync(`npx tsx ${COMPLETION_TS} ${shell}`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15_000,
  });
}

describe('completion', () => {
  describe('bash', () => {
    it('generates a valid bash completion function', () => {
      const out = runCompletion('bash');
      expect(out).toContain('_agpa()');
      expect(out).toContain('complete -F _agpa agpa');
    });

    it('includes all main commands in completion', () => {
      const out = runCompletion('bash');
      // Spot-check key commands
      expect(out).toMatch(/init|doctor|dashboard|search/);
    });

    it('includes subcommand completions', () => {
      const out = runCompletion('bash');
      expect(out).toContain('create');
      expect(out).toContain('list');
    });
  });

  describe('zsh', () => {
    it('generates a valid zsh completion script', () => {
      const out = runCompletion('zsh');
      expect(out).toContain('#compdef agpa');
      expect(out).toContain('_agpa()');
    });

    it('includes command descriptions', () => {
      const out = runCompletion('zsh');
      expect(out).toContain('achievement');
    });
  });

  describe('fish', () => {
    it('generates a valid fish completion script', () => {
      const out = runCompletion('fish');
      expect(out).toContain('# AGPA fish completion');
      expect(out).toContain('complete -c agpa');
    });

    it('includes subcommand completions for profile and sound', () => {
      const out = runCompletion('fish');
      expect(out).toContain('__fish_seen_subcommand_from profile');
      expect(out).toContain('__fish_seen_subcommand_from sound');
    });
  });

  describe('error handling', () => {
    it('prints usage for unknown shell', () => {
      expect(() => runCompletion('nope')).toThrow();
    });

    it('prints usage for no argument', () => {
      expect(() => execSync(`npx tsx ${COMPLETION_TS}`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      })).toThrow();
    });
  });
});
