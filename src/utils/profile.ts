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
import { safeParse, profileMetaSchema } from './validate.js';

export const DEFAULT_PROFILE = 'default';
export const MAX_PROFILES = 3;

/** Profile name: lowercase start, alphanumeric/dash/underscore, 1–32 chars */
const PROFILE_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;

/** Reserved names that cannot be used for profiles */
const RESERVED_NAMES = new Set(['default', 'profiles', 'config', '_demo']);

function getLegacyDir(): string {
  return path.join(homedir(), '.agent-achievements');
}

function getProfilesBaseDir(): string {
  return path.join(homedir(), '.agent-achievements', 'profiles');
}

/** Resolve a profile name to its on-disk stateDir */
export function resolveProfileDir(name: string): string {
  if (name === DEFAULT_PROFILE) return getLegacyDir();
  // System profiles: _demo uses its own dir under profiles/ but doesn't count toward limits
  if (name === '_demo') return path.join(getProfilesBaseDir(), '_demo');
  // Reject traversal attempts and invalid names at the boundary
  if (!PROFILE_NAME_RE.test(name)) {
    throw new Error(`Invalid profile name: "${name}". Use lowercase letters, digits, dashes, underscores (1-32 chars).`);
  }
  return path.join(getProfilesBaseDir(), name);
}

/** Check if a profile exists on disk */
export function profileExists(name: string): boolean {
  if (name === DEFAULT_PROFILE) return true; // always exists
  return fs.existsSync(path.join(getProfilesBaseDir(), name, 'state.json'));
}

export interface ProfileMeta {
  name: string;
  emoji: string;
  created_at: string;
  /** Which AI coding tools this profile tracks (by tool ID) */
  tracked_tools?: string[];
}

const DEFAULT_EMOJI = '📂';
const NEW_PROFILE_DEFAULT_EMOJI = '🎮';

/**
 * Save metadata for a profile. Returns the written meta.
 * For "default", writes to ~/.agent-achievements/profile.json.
 * For named profiles, writes to ~/.agent-achievements/profiles/<name>/profile.json.
 */
export function saveProfileMeta(name: string, meta: ProfileMeta): ProfileMeta {
  let metaPath: string;
  if (name === DEFAULT_PROFILE) {
    metaPath = path.join(getLegacyDir(), 'profile.json');
  } else {
    metaPath = path.join(getProfilesBaseDir(), name, 'profile.json');
  }
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  return meta;
}

/**
 * Set tracked_tools for a profile. Merges with existing metadata.
 */
export function setTrackedTools(profileName: string, toolIds: string[]): ProfileMeta {
  const meta = getProfileMeta(profileName);
  return saveProfileMeta(profileName, { ...meta, tracked_tools: toolIds });
}

/** Get profile metadata. Returns defaults if profile.json doesn't exist. */
export function getProfileMeta(name: string): ProfileMeta {
  if (name === DEFAULT_PROFILE) {
    // Try reading legacy profile.json, fall back to default emoji
    const metaPath = path.join(getLegacyDir(), 'profile.json');
    try {
      if (fs.existsSync(metaPath)) {
        const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        return safeParse(profileMetaSchema, { ...raw, name: DEFAULT_PROFILE }, { name: DEFAULT_PROFILE, emoji: DEFAULT_EMOJI, created_at: new Date().toISOString() });
      }
    } catch { /* ignore corrupt meta */ }
    return { name: DEFAULT_PROFILE, emoji: DEFAULT_EMOJI, created_at: new Date().toISOString() };
  }
  const metaPath = path.join(getProfilesBaseDir(), name, 'profile.json');
  try {
    if (fs.existsSync(metaPath)) {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const fallback = { name, emoji: NEW_PROFILE_DEFAULT_EMOJI, created_at: '' };
      return safeParse(profileMetaSchema, { ...raw, name }, fallback);
    }
  } catch { /* ignore */ }
  return { name, emoji: NEW_PROFILE_DEFAULT_EMOJI, created_at: '' };
}

/** List all profiles with metadata (emoji, created_at). */
export function listProfilesWithMeta(): ProfileMeta[] {
  const profiles = listProfiles();
  return profiles.map(name => getProfileMeta(name));
}

/* Validate a profile name. Returns error string or null. */
export function validateProfileName(name: string): string | null {
  if (!name || typeof name !== 'string') return 'Profile name is required';
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return 'Profile name is required';
  if (trimmed !== name) return 'Profile name must be lowercase with no leading/trailing spaces';
  if (RESERVED_NAMES.has(name)) return `"${name}" is a reserved name`;
  if (!PROFILE_NAME_RE.test(name)) {
    return 'Profile name must be 1-32 chars, start with a letter, and contain only lowercase letters, digits, dashes, and underscores';
  }
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
      if (entry.name === '_demo') continue;
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
export function createProfile(name: string, emoji = NEW_PROFILE_DEFAULT_EMOJI): string {
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

  // Save profile metadata
  const meta: ProfileMeta = {
    name: trimmed,
    emoji: emoji || NEW_PROFILE_DEFAULT_EMOJI,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(meta, null, 2));

  // Bootstrap with empty state so it's recognized as a valid profile
  const emptyState = {
    unlocked: {},
    stats: { total_unlocked: 0 },
  };
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(emptyState, null, 2));

  return dir;
}

/**
 * Delete a named profile (recursively removes its directory).
 * Default profile and system profiles (_demo) cannot be deleted.
 * Throws on invalid/unknown profile.
 */
export function deleteProfile(name: string): void {
  if (name === DEFAULT_PROFILE) {
    throw new Error('Cannot delete the default profile.');
  }
  if (name === '_demo') {
    throw new Error('Cannot delete the system demo profile.');
  }
  if (!profileExists(name)) {
    throw new Error(`Profile "${name}" does not exist.`);
  }
  const dir = resolveProfileDir(name);
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Ensure the legacy default directory exists (idempotent) */
export function ensureDefaultProfile(): void {
  fs.mkdirSync(getLegacyDir(), { recursive: true });
}
