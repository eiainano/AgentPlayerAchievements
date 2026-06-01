/**
 * AGPA Profile Manager — multi-profile support for achievement data
 *
 * Directory structure:
 *   ~/.agent-achievements/           ← "default" profile (legacy dir)
 *   ~/.agent-achievements/profiles/
 *     ├── work/                      ← named profile "work"
 *     └── fun/                       ← named profile "fun"
 *
 * Max 3 named profiles + 1 default = 4 total.
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export const DEFAULT_PROFILE = 'default';
export const MAX_PROFILES = 3;

/** Profile name: lowercase start, alphanumeric/dash/underscore, 1–32 chars */
const PROFILE_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;

/** Reserved names that cannot be used for profiles */
const RESERVED_NAMES = new Set(['default', 'profiles', 'config']);

function getLegacyDir(): string {
  return path.join(homedir(), '.agent-achievements');
}

function getProfilesBaseDir(): string {
  return path.join(homedir(), '.agent-achievements', 'profiles');
}

/** Resolve a profile name to its on-disk stateDir */
export function resolveProfileDir(name: string): string {
  if (name === DEFAULT_PROFILE) return getLegacyDir();
  return path.join(getProfilesBaseDir(), name);
}

/** Check if a profile exists on disk */
export function profileExists(name: string): boolean {
  if (name === DEFAULT_PROFILE) return true; // always exists
  return fs.existsSync(path.join(getProfilesBaseDir(), name, 'state.json'));
}

/* Validate a profile name. Returns error string or null. */
export function validateProfileName(name: string): string | null {
  if (!name || typeof name !== 'string') return 'Profile name is required';
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return 'Profile name is required';
  if (trimmed !== name) return 'Profile name must be lowercase with no leading/trailing spaces';
  if (!PROFILE_NAME_RE.test(name)) {
    return 'Profile name must be 1-32 chars, start with a letter, and contain only lowercase letters, digits, dashes, and underscores';
  }
  if (RESERVED_NAMES.has(name)) return `"${name}" is a reserved name`;
  return null;
}

/** List all existing profiles. Always includes 'default'. */
export function listProfiles(): string[] {
  const profiles = [DEFAULT_PROFILE];
  const baseDir = getProfilesBaseDir();
  try {
    if (!fs.existsSync(baseDir)) return profiles;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // A valid profile must contain state.json
      if (fs.existsSync(path.join(baseDir, entry.name, 'state.json'))) {
        profiles.push(entry.name);
      }
    }
  } catch {
    /* if dir doesn't exist or can't be read, just return default */
  }
  return profiles;
}

/**
 * Create a new named profile.
 * Returns the stateDir path.
 * Throws on validation error, duplicate name, or max limit reached.
 */
export function createProfile(name: string): string {
  const trimmed = name.trim().toLowerCase();

  // Validate name format
  const error = validateProfileName(trimmed);
  if (error) throw new Error(error);

  // Check max limit (named profiles only, default doesn't count)
  const existing = listProfiles();
  if (!existing.includes(trimmed) && existing.length - 1 >= MAX_PROFILES) {
    throw new Error(`Maximum ${MAX_PROFILES} named profiles reached (plus default = 4 total)`);
  }

  // Check duplicate (case-insensitive)
  const lowerExisting = existing.map(p => p.toLowerCase());
  if (lowerExisting.includes(trimmed.toLowerCase())) {
    throw new Error(`Profile "${trimmed}" already exists`);
  }

  const dir = resolveProfileDir(trimmed);
  fs.mkdirSync(dir, { recursive: true });

  // Bootstrap with empty state so it's recognized as a valid profile
  const emptyState = {
    unlocked: {},
    stats: { total_unlocked: 0 },
  };
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(emptyState, null, 2));

  return dir;
}

/** Ensure the legacy default directory exists (idempotent) */
export function ensureDefaultProfile(): void {
  fs.mkdirSync(getLegacyDir(), { recursive: true });
}
