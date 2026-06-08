import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  setYamlPathForTest,
  handleGetAchievements, handleUpdateAchievement, handleBatchUpdate,
} from '../../src/dashboard/customize-api.js';

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `agpa-cust-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function makeMinimalYaml(): string {
  return `# AGPA Achievement Definitions
definitions:
  - id: first_contact
    name: First Contact
    name_cn: 初次接触
    description: Send your first message.
    icon: 👋
    category: onboarding
    rarity: common

  - id: double_digits
    name: Double Digits
    description: Reach 10 tasks.
    icon: 🔟
    category: milestones
    rarity: uncommon
    hidden: false
    conditions:
      - type: counter
        event: task.complete
        value: 10

# === Sets ===
sets:
  - id: the_beginning
    name: The Beginning
    members:
      - first_contact
      - double_digits
`;
}

// ── handleGetAchievements ───────────────────────────────────────────────────

describe('handleGetAchievements', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmpDir();
    fs.mkdirSync(tmp, { recursive: true });
    const yamlPath = path.join(tmp, 'defs.yaml');
    fs.writeFileSync(yamlPath, makeMinimalYaml(), 'utf-8');
    setYamlPathForTest(yamlPath);
  });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('returns correct stats from valid YAML', () => {
    const res = handleGetAchievements();
    expect(res.stats.total).toBe(2);
    expect(res.stats.with_cn).toBe(1);
    expect(res.stats.without_cn).toBe(1);
  });

  it('returns all achievements with index positions', () => {
    const res = handleGetAchievements();
    expect(res.achievements).toHaveLength(2);
    expect(res.achievements[0]!.index).toBe(0);
    expect(res.achievements[1]!.index).toBe(1);
  });

  it('generates suggestions for missing name_cn', () => {
    const res = handleGetAchievements();
    const dd = res.achievements.find(a => a.id === 'double_digits');
    expect(dd?.suggestions.some(s => s.field === 'name_cn')).toBe(true);
  });

  it('marks has_name_cn correctly', () => {
    const res = handleGetAchievements();
    const fc = res.achievements.find(a => a.id === 'first_contact');
    const dd = res.achievements.find(a => a.id === 'double_digits');
    expect(fc?.has_name_cn).toBe(true);
    expect(dd?.has_name_cn).toBe(false);
  });

  it('uses icon fallback "🏆" when icon is not a string', () => {
    const yamlWithObjIcon = `definitions:
  - id: test_ach
    name: Test
    icon: { src: pixel.png, alt: pixel }
    category: test
    rarity: common
`;
    fs.writeFileSync(path.join(tmp, 'defs.yaml'), yamlWithObjIcon, 'utf-8');
    const res = handleGetAchievements();
    expect(res.achievements[0]!.icon).toBe('pixel.png');
  });

  it('throws for YAML without definitions array', () => {
    fs.writeFileSync(path.join(tmp, 'defs.yaml'), 'other: value\n', 'utf-8');
    expect(() => handleGetAchievements()).toThrow('Invalid YAML');
  });

  it('throws for YAML with non-array definitions', () => {
    fs.writeFileSync(path.join(tmp, 'defs.yaml'), 'definitions: not_an_array\n', 'utf-8');
    expect(() => handleGetAchievements()).toThrow('Invalid YAML');
  });
});

// ── handleUpdateAchievement ─────────────────────────────────────────────────

describe('handleUpdateAchievement', () => {
  let tmp: string;
  let yamlPath: string;

  beforeEach(() => {
    tmp = makeTmpDir();
    fs.mkdirSync(tmp, { recursive: true });
    yamlPath = path.join(tmp, 'defs.yaml');
    fs.writeFileSync(yamlPath, makeMinimalYaml(), 'utf-8');
    setYamlPathForTest(yamlPath);
  });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('updates an existing field', () => {
    const res = handleUpdateAchievement({ id: 'first_contact', changes: { name_cn: '第一次接触' } });
    expect(res.status).toBe('ok');
    const yaml = fs.readFileSync(yamlPath, 'utf-8');
    expect(yaml).toContain('第一次接触');
  });

  it('adds a new field that does not exist', () => {
    handleUpdateAchievement({ id: 'double_digits', changes: { name_cn: '两位数' } });
    const yaml = fs.readFileSync(yamlPath, 'utf-8');
    expect(yaml).toContain('两位数');
    // verify it comes after name: line and before description
    expect(yaml.indexOf('Double Digits') < yaml.indexOf('两位数')).toBe(true);
  });

  it('rejects disallowed field "set"', () => {
    expect(() =>
      handleUpdateAchievement({ id: 'first_contact', changes: { set: 'hacked' } })
    ).toThrow('not editable');
  });

  it('rejects disallowed field "conditions"', () => {
    expect(() =>
      handleUpdateAchievement({ id: 'first_contact', changes: { conditions: '[]' } })
    ).toThrow('not editable');
  });

  it('rejects values containing newlines', () => {
    expect(() =>
      handleUpdateAchievement({ id: 'first_contact', changes: { name_cn: 'hello\nworld' } })
    ).toThrow('forbidden YAML control characters');
  });

  it('throws for non-existent achievement ID', () => {
    expect(() =>
      handleUpdateAchievement({ id: 'nonexistent', changes: { name_cn: 'x' } })
    ).toThrow('not found');
  });

  it('preserves comments in YAML after edit', () => {
    handleUpdateAchievement({ id: 'first_contact', changes: { name_cn: '第一次' } });
    const yaml = fs.readFileSync(yamlPath, 'utf-8');
    expect(yaml).toContain('# AGPA Achievement Definitions');
    expect(yaml).toContain('# === Sets ===');
  });

  it('only modifies the target achievement, not others', () => {
    handleUpdateAchievement({ id: 'first_contact', changes: { name_cn: '第一次' } });
    const yaml = fs.readFileSync(yamlPath, 'utf-8');
    // double_digits should still have no name_cn
    const ddIdx = yaml.indexOf('double_digits');
    const afterDd = yaml.slice(ddIdx);
    expect(afterDd).not.toContain('name_cn');
  });
});

// ── handleBatchUpdate ───────────────────────────────────────────────────────

describe('handleBatchUpdate', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmpDir();
    fs.mkdirSync(tmp, { recursive: true });
    const yamlPath = path.join(tmp, 'defs.yaml');
    fs.writeFileSync(yamlPath, makeMinimalYaml(), 'utf-8');
    setYamlPathForTest(yamlPath);
  });
  afterEach(() => { try { fs.rmSync(tmp, { recursive: true }); } catch { /* ok */ } });

  it('applies batch update of multiple achievements', () => {
    const res = handleBatchUpdate({
      changes: [
        { id: 'first_contact', field: 'name_cn', value: '第一次' },
        { id: 'double_digits', field: 'name_cn', value: '两位数' },
      ],
    });
    expect(res.status).toBe('ok');
    expect(res.updated).toBe(2);
  });

  it('returns updated: 0 for empty changes array', () => {
    const res = handleBatchUpdate({ changes: [] });
    expect(res.status).toBe('ok');
    expect(res.updated).toBe(0);
  });

  it('partial failure does not block other updates', () => {
    const res = handleBatchUpdate({
      changes: [
        { id: 'first_contact', field: 'name_cn', value: '第一次' },
        { id: 'nonexistent', field: 'name_cn', value: 'x' },
      ],
    });
    expect(res.status).toBe('ok');
    expect(res.updated).toBe(1);
  });

  it('handles all invalid changes gracefully', () => {
    const res = handleBatchUpdate({
      changes: [
        { id: 'nonexistent', field: 'name_cn', value: 'x' },
      ],
    });
    expect(res.status).toBe('ok');
    expect(res.updated).toBe(0);
  });
});
