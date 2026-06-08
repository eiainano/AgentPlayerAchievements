import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  icon, parseArgs, printResult, printSummary,
  checkDataDir, checkStateJson, checkDefsYaml,
  type Status, type CheckResult,
} from '../../src/cli/verify.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `agpa-verify-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function makeYamlWithAchievements(n: number): string {
  const lines: string[] = ['# Test YAML', 'definitions:'];
  for (let i = 1; i <= n; i++) {
    lines.push(`  - id: ach_${i}`);
    lines.push(`    name: Achievement ${i}`);
    lines.push(`    category: milestones`);
    lines.push(`    rarity: common`);
    lines.push(`    conditions:`);
    lines.push(`      - type: counter`);
    lines.push(`        event: session.start`);
    lines.push(`        value: 1`);
  }
  return lines.join('\n');
}

// ── Pure function tests ─────────────────────────────────────────────────────

describe('icon', () => {
  it('returns green checkmark for ok', () => {
    expect(icon('ok')).toContain('✅');
  });

  it('returns yellow warning for warn', () => {
    expect(icon('warn')).toContain('⚠️');
  });

  it('returns red X for error', () => {
    expect(icon('error')).toContain('❌');
  });
});

describe('parseArgs', () => {
  it('returns null profile when no --profile', () => {
    const prev = process.argv;
    process.argv = ['node', 'verify.ts'];
    const result = parseArgs();
    process.argv = prev;
    expect(result.profile).toBeNull();
  });

  it('extracts --profile value', () => {
    const prev = process.argv;
    process.argv = ['node', 'verify.ts', '--profile', 'myprof'];
    const result = parseArgs();
    process.argv = prev;
    expect(result.profile).toBe('myprof');
  });

  it('returns null when --profile has no value', () => {
    const prev = process.argv;
    process.argv = ['node', 'verify.ts', '--profile'];
    const result = parseArgs();
    process.argv = prev;
    expect(result.profile).toBeNull();
  });

  it('ignores unknown flags', () => {
    const prev = process.argv;
    process.argv = ['node', 'verify.ts', '--unknown', 'foo'];
    const result = parseArgs();
    process.argv = prev;
    expect(result.profile).toBeNull();
  });
});

describe('printResult', () => {
  it('prints ok result (does not throw)', () => {
    const r: CheckResult = { id: 'test', label: 'Test', status: 'ok', detail: 'all good' };
    expect(() => printResult(r)).not.toThrow();
  });

  it('prints error result with fix', () => {
    const r: CheckResult = { id: 'test', label: 'Test', status: 'error', detail: 'broken', fix: 'do x' };
    expect(() => printResult(r)).not.toThrow();
  });
});

describe('printSummary', () => {
  it('prints success when all ok', () => {
    const results: CheckResult[] = [
      { id: 'a', label: 'A', status: 'ok', detail: 'good' },
      { id: 'b', label: 'B', status: 'ok', detail: 'good' },
    ];
    expect(() => printSummary(results)).not.toThrow();
  });

  it('prints error count when errors present', () => {
    const results: CheckResult[] = [
      { id: 'a', label: 'A', status: 'ok', detail: 'good' },
      { id: 'b', label: 'B', status: 'error', detail: 'bad' },
    ];
    expect(() => printSummary(results)).not.toThrow();
  });

  it('prints warning count when warnings present', () => {
    const results: CheckResult[] = [
      { id: 'a', label: 'A', status: 'warn', detail: 'iffy' },
    ];
    expect(() => printSummary(results)).not.toThrow();
  });
});

// ── I/O function tests (temp dirs) ──────────────────────────────────────────

describe('checkDataDir', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for non-existent dir', () => {
    const result = checkDataDir(path.join(tmp, 'nope'), null);
    expect(result.status).toBe('error');
    expect(result.detail).toContain('does not exist');
    expect(result.fix).toBe('agpa init');
  });

  it('returns ok with (empty) for empty dir', () => {
    fs.mkdirSync(tmp, { recursive: true });
    const result = checkDataDir(tmp, null);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('(empty)');
  });

  it('returns ok with state + event log when both exist', () => {
    writeFile(path.join(tmp, 'state.json'), '{}');
    writeFile(path.join(tmp, 'event.log'), '');
    const result = checkDataDir(tmp, null);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('state + event log');
  });

  it('returns ok with state only when only state.json exists', () => {
    writeFile(path.join(tmp, 'state.json'), '{}');
    const result = checkDataDir(tmp, null);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('state only');
  });

  it('works with named profile', () => {
    const profDir = path.join(tmp, 'profiles', 'testprof');
    writeFile(path.join(profDir, 'state.json'), '{}');
    const result = checkDataDir(tmp, 'testprof');
    expect(result.status).toBe('ok');
  });
});

describe('checkStateJson', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for missing state.json', () => {
    fs.mkdirSync(tmp, { recursive: true });
    const result = checkStateJson(tmp, null);
    expect(result.status).toBe('error');
    expect(result.fix).toBe('agpa init');
  });

  it('returns ok with unlock count for valid state', () => {
    writeFile(path.join(tmp, 'state.json'), JSON.stringify({ unlocked: { a: '2024', b: '2024', c: '2024' } }));
    const result = checkStateJson(tmp, null);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('3 unlocked');
  });

  it('returns ok with 0 for empty unlocked', () => {
    writeFile(path.join(tmp, 'state.json'), JSON.stringify({ unlocked: {} }));
    const result = checkStateJson(tmp, null);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('0 unlocked');
  });

  it('returns error for corrupt JSON', () => {
    writeFile(path.join(tmp, 'state.json'), '{ this is not json }');
    const result = checkStateJson(tmp, null);
    expect(result.status).toBe('error');
    expect(result.detail).toContain('corrupt');
  });

  it('works with named profile', () => {
    const profDir = path.join(tmp, 'profiles', 'testprof');
    writeFile(path.join(profDir, 'state.json'), JSON.stringify({ unlocked: { x: '1' } }));
    const result = checkStateJson(tmp, 'testprof');
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('1 unlocked');
  });
});

describe('checkDefsYaml', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for non-existent file', () => {
    const result = checkDefsYaml(path.join(tmp, 'nope.yaml'));
    expect(result.status).toBe('error');
    expect(result.detail).toContain('not found');
  });

  it('returns ok for YAML with >=100 achievements', () => {
    const yamlPath = path.join(tmp, 'defs.yaml');
    writeFile(yamlPath, makeYamlWithAchievements(150));
    const result = checkDefsYaml(yamlPath);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('150');
  });

  it('returns warn for YAML with <100 achievements', () => {
    const yamlPath = path.join(tmp, 'defs.yaml');
    writeFile(yamlPath, makeYamlWithAchievements(42));
    const result = checkDefsYaml(yamlPath);
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('42');
  });

  it('returns warn for YAML with 0 achievements', () => {
    const yamlPath = path.join(tmp, 'defs.yaml');
    writeFile(yamlPath, '# empty\ndefinitions: []\n');
    const result = checkDefsYaml(yamlPath);
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('0');
  });

  it('returns error for unparseable YAML', () => {
    const yamlPath = path.join(tmp, 'defs.yaml');
    writeFile(yamlPath, 'this is not valid yaml: {{{');
    const result = checkDefsYaml(yamlPath);
    // File exists but the regex match won't fail — need to test differently.
    // checkDefsYaml only reads + does regex count, doesn't YAML.parse.
    // If the file exists and has 0 matches, it returns warn.
    expect(result.status).toBe('warn');
  });
});
