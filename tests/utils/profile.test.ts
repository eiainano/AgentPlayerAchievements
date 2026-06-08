import { describe, it, expect } from 'vitest';
import {
  validateProfileName,
  resolveProfileDir,
  DEFAULT_PROFILE, MAX_PROFILES,
  createProfile,
} from '../../src/utils/profile.js';

describe('validateProfileName', () => {
  it('accepts simple valid names', () => {
    expect(validateProfileName('work')).toBeNull();
    expect(validateProfileName('playground')).toBeNull();
    expect(validateProfileName('dev-2')).toBeNull();
    expect(validateProfileName('my_profile')).toBeNull();
    expect(validateProfileName('a')).toBeNull();
  });

  it('rejects empty strings', () => {
    expect(validateProfileName('')).not.toBeNull();
    expect(validateProfileName('   ')).not.toBeNull();
  });

  it('rejects uppercase letters', () => {
    expect(validateProfileName('Work')).not.toBeNull();
    expect(validateProfileName('DEV')).not.toBeNull();
  });

  it('rejects names starting with a digit', () => {
    expect(validateProfileName('2fast')).not.toBeNull();
  });

  it('rejects names with spaces', () => {
    expect(validateProfileName('my work')).not.toBeNull();
  });

  it('rejects names with special characters', () => {
    expect(validateProfileName('work!')).not.toBeNull();
    expect(validateProfileName('fun/project')).not.toBeNull();
    expect(validateProfileName('a.b')).not.toBeNull();
  });

  it('rejects names longer than 32 characters', () => {
    expect(validateProfileName('a'.repeat(33))).not.toBeNull();
  });

  it('accepts names up to 32 characters', () => {
    expect(validateProfileName('a'.repeat(32))).toBeNull();
  });

  it('rejects reserved names', () => {
    expect(validateProfileName('default')).not.toBeNull();
    expect(validateProfileName('profiles')).not.toBeNull();
    expect(validateProfileName('config')).not.toBeNull();
  });

  it('rejects non-string input', () => {
    expect(validateProfileName(null as unknown as string)).not.toBeNull();
    expect(validateProfileName(undefined as unknown as string)).not.toBeNull();
  });
});

describe('resolveProfileDir', () => {
  it('default profile returns legacy directory', () => {
    const dir = resolveProfileDir(DEFAULT_PROFILE);
    expect(dir).toContain('.agent-achievements');
    // Named profiles go to ~/.agent-achievements/profiles/<name>
    expect(dir).not.toContain('/profiles/');
  });

  it('rejects traversal attack with ..', () => {
    expect(() => resolveProfileDir('../etc')).toThrow('Invalid profile name');
  });

  it('rejects absolute path in profile name', () => {
    expect(() => resolveProfileDir('/tmp/evil')).toThrow('Invalid profile name');
  });

  it('rejects names with special characters', () => {
    expect(() => resolveProfileDir('work!')).toThrow('Invalid profile name');
  });
});

describe('constants', () => {
  it('DEFAULT_PROFILE is "default"', () => {
    expect(DEFAULT_PROFILE).toBe('default');
  });

  it('MAX_PROFILES is 3', () => {
    expect(MAX_PROFILES).toBe(3);
  });
});

describe('_demo system profile', () => {
  it('resolves _demo to profiles/_demo directory', () => {
    const dir = resolveProfileDir('_demo');
    expect(dir).toContain('profiles/_demo');
    expect(dir).not.toContain('..');
  });

  it('rejects creating a profile named _demo', () => {
    expect(() => createProfile('_demo')).toThrow(/reserved/i);
  });

  it('validateProfileName rejects _demo', () => {
    expect(validateProfileName('_demo')).toBeTruthy();
  });
});
