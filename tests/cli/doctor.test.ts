import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  statusIcon, ago, renderReport, renderJson,
  checkDataDir, checkEventLog, checkStateJson, checkDefsYaml,
  type Status, type CheckResult,
} from '../../src/cli/doctor.js';

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `agpa-doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ── Pure function tests ─────────────────────────────────────────────────────

describe('statusIcon', () => {
  it('returns ✅ for ok', () => {
    expect(statusIcon('ok')).toBe('✅');
  });
  it('returns ⚠️ for warn', () => {
    expect(statusIcon('warn')).toBe('⚠️');
  });
  it('returns ❌ for error', () => {
    expect(statusIcon('error')).toBe('❌');
  });
});

describe('ago', () => {
  it('formats seconds (< 60s)', () => {
    expect(ago(30_000)).toBe('30s ago');
  });
  it('formats 0 seconds', () => {
    expect(ago(0)).toBe('0s ago');
  });
  it('formats minutes (< 60min)', () => {
    expect(ago(120_000)).toBe('2min ago');
  });
  it('formats exactly 60 minutes as 1h', () => {
    expect(ago(3_600_000)).toBe('1h ago');
  });
  it('formats hours (< 24h)', () => {
    expect(ago(7_200_000)).toBe('2h ago');
  });
  it('formats days (>= 24h)', () => {
    expect(ago(86_400_000)).toBe('1d ago');
  });
  it('formats multiple days', () => {
    expect(ago(259_200_000)).toBe('3d ago');
  });
});

describe('renderReport', () => {
  it('includes all result labels', () => {
    const results: CheckResult[] = [
      { id: 'a', label: 'Test A', status: 'ok', detail: 'all good' },
      { id: 'b', label: 'Test B', status: 'error', detail: 'broken' },
    ];
    const out = renderReport(results);
    expect(out).toContain('Test A');
    expect(out).toContain('Test B');
    expect(out).toContain('all good');
  });

  it('includes recommendations for mcp warns', () => {
    const results: CheckResult[] = [
      { id: 'mcp-claude-code', label: 'MCP: Claude Code', status: 'warn', detail: '...' },
    ];
    const out = renderReport(results);
    expect(out).toContain('Recommendations');
    expect(out).toContain('agpa init --tool claude-code');
  });

  it('includes data directory path', () => {
    const results: CheckResult[] = [{ id: 'a', label: 'A', status: 'ok', detail: 'ok' }];
    const out = renderReport(results);
    expect(out).toContain('Data:');
  });

  it('does not include recommendations when all ok', () => {
    const results: CheckResult[] = [{ id: 'a', label: 'A', status: 'ok', detail: 'ok' }];
    expect(renderReport(results)).not.toContain('Recommendations');
  });
});

describe('renderJson', () => {
  it('returns valid JSON with 2-space indent', () => {
    const results: CheckResult[] = [
      { id: 'a', label: 'A', status: 'ok', detail: 'good' },
    ];
    const json = renderJson(results);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('a');
  });

  it('handles empty array', () => {
    const json = renderJson([]);
    expect(JSON.parse(json)).toEqual([]);
  });
});

// ── I/O function tests (temp dirs) ──────────────────────────────────────────

describe('checkDataDir', () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for non-existent dir', () => {
    const r = checkDataDir(path.join(tmp, 'nope'));
    expect(r.status).toBe('error');
  });

  it('returns ok with file count for dir with state + event', () => {
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'state.json'), '{}');
    fs.writeFileSync(path.join(tmp, 'event.log'), '');
    const r = checkDataDir(tmp);
    expect(r.status).toBe('ok');
    expect(r.detail).toContain('2 files');
  });

  it('returns warn when missing event.log', () => {
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'state.json'), '{}');
    const r = checkDataDir(tmp);
    expect(r.status).toBe('warn');
    expect(r.detail).toContain('event.log');
  });
});

describe('checkEventLog', () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for non-existent event.log', () => {
    fs.mkdirSync(tmp, { recursive: true });
    const r = checkEventLog(tmp);
    expect(r.status).toBe('error');
  });

  it('returns ok with line count for valid log', () => {
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'event.log'), 'line1\nline2\nline3\n');
    const r = checkEventLog(tmp);
    expect(r.status).toBe('ok');
    expect(r.detail).toContain('3 lines');
  });
});

describe('checkStateJson', () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for non-existent state.json', () => {
    fs.mkdirSync(tmp, { recursive: true });
    const r = checkStateJson(tmp);
    expect(r.status).toBe('error');
  });

  it('returns ok with unlock count', () => {
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'state.json'), JSON.stringify({ unlocked: { a: 'x', b: 'y', c: 'z' } }));
    const r = checkStateJson(tmp);
    expect(r.status).toBe('ok');
    expect(r.detail).toContain('3 unlocked');
  });

  it('returns error for corrupt JSON', () => {
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'state.json'), 'not json');
    const r = checkStateJson(tmp);
    expect(r.status).toBe('error');
    expect(r.detail).toContain('corrupt');
  });
});

describe('checkDefsYaml', () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns error for non-existent file', () => {
    const r = checkDefsYaml(path.join(tmp, 'nope.yaml'));
    expect(r.status).toBe('error');
  });

  it('returns ok with count for valid YAML', () => {
    const yamlPath = path.join(tmp, 'defs.yaml');
    const defs = ['# Test', 'definitions:', '  - id: a', '  - id: b', '  - id: c'].join('\n');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(yamlPath, defs);
    const r = checkDefsYaml(yamlPath);
    expect(r.status).toBe('ok');
    expect(r.detail).toContain('3 achievements');
  });
});
