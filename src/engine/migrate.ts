/**
 * Data Migration Framework
 *
 * Handles incremental schema migration for state.json.
 * Migrations run automatically at load() entry, user-unaware.
 *
 * Principles:
 *  - Only add fields, never remove
 *  - Only set defaults for missing fields, never overwrite existing values
 *  - Idempotent — repeated migration produces same result
 *  - Fail-safe — any exception logs to stderr and returns original data
 */

// ── Types ──────────────────────────────────────────────────────────

export interface MigrationRecord {
  from: number;
  to: number;
  timestamp: string; // ISO 8601
  description?: string;
}

// ── Constants ──────────────────────────────────────────────────────

/** Current schema version — bump when adding a new migration */
export const CURRENT_VERSION = 1;

// ── Migration Chain ────────────────────────────────────────────────
// Index = target version. MIGRATIONS[1] = v0 → v1, MIGRATIONS[2] = v1 → v2, etc.

const MIGRATIONS: Array<(state: Record<string, unknown>) => void> = [
  // index 0 unused (no migration from v0 to v0)
  () => {},
  // v0 → v1: initial baseline — set version + add empty history
  (state) => {
    if (!('migration_history' in state) || state.migration_history === undefined) {
      state.migration_history = [];
    }
  },
];
// Future: MIGRATIONS[2] = v1 → v2 migration goes here

// ── Core Function ─────────────────────────────────────────────────

/**
 * Migrate raw state to the latest schema version.
 * Returns the migrated copy. If migration fails, returns the original data.
 */
export function migrateState(raw: Record<string, unknown>): Record<string, unknown> {
  // Defensive: if raw isn't an object, return as-is
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return raw;
  }

  // Read current version (default 0 for pre-migration data)
  const currentVersion = (raw.schema_version as number | undefined) ?? 0;

  // Already at latest — no-op
  if (currentVersion >= CURRENT_VERSION) {
    return raw;
  }

  // Run migrations incrementally from currentVersion + 1 → CURRENT_VERSION
  const state = { ...raw }; // shallow copy to avoid mutation side effects

  for (let target = currentVersion + 1; target <= CURRENT_VERSION; target++) {
    const migrateFn = MIGRATIONS[target];
    if (!migrateFn) {
      console.error(`[migrate] Missing migration v${target - 1} → v${target}. Skipping.`);
      continue;
    }

    try {
      // Record the migration before running it (so history is populated even if it fails midway)
      const record: MigrationRecord = {
        from: target - 1,
        to: target,
        timestamp: new Date().toISOString(),
      };

      migrateFn(state);
      state.schema_version = target;

      // Append to history
      const history = (state.migration_history as MigrationRecord[]) ?? [];
      history.push(record);
      state.migration_history = history;
    } catch (err) {
      console.error(`[migrate] Migration v${target - 1} → v${target} failed:`, err);
      // Fail-safe: return original raw data, not a half-migrated state
      return raw;
    }
  }

  return state;
}
