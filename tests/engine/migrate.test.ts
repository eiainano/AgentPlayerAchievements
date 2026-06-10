import { describe, it, expect } from 'vitest';
import { migrateState, CURRENT_VERSION } from '../../src/engine/migrate.js';
import type { MigrationRecord } from '../../src/engine/types.js';

describe('migrateState', () => {
  // ── v0 → v1 ──────────────────────────────────────────────────────

  it('migrates v0 (no schema_version) to v1', () => {
    const raw: Record<string, unknown> = {
      unlocked: { first_contact: '2026-06-01T00:00:00Z' },
      stats: { total_unlocked: 1 },
    };
    const result = migrateState(raw);
    expect(result.schema_version).toBe(1);
    expect(Array.isArray(result.migration_history)).toBe(true);
    expect((result.migration_history as MigrationRecord[]).length).toBe(1);
    expect((result.migration_history as MigrationRecord[])[0].from).toBe(0);
    expect((result.migration_history as MigrationRecord[])[0].to).toBe(1);
    // Existing data untouched
    expect((result as Record<string, unknown>).unlocked).toEqual(raw.unlocked);
  });

  // ── v1 no-op ─────────────────────────────────────────────────────

  it('leaves v1 data unchanged', () => {
    const raw: Record<string, unknown> = {
      schema_version: 1,
      migration_history: [
        { from: 0, to: 1, timestamp: '2026-06-01T00:00:00.000Z' },
      ],
      unlocked: { first_contact: '2026-06-01T00:00:00Z' },
      stats: { total_unlocked: 1 },
    };
    const result = migrateState(raw);
    expect(result.schema_version).toBe(1);
    expect((result.migration_history as MigrationRecord[]).length).toBe(1);
  });

  // ── Field protection ─────────────────────────────────────────────

  it('never overwrites existing fields', () => {
    const raw: Record<string, unknown> = {
      unlocked: { first_contact: '2026-06-01T00:00:00Z' },
      stats: { total_unlocked: 1, custom_field: 'should stay' },
      last_evaluated_line: 42,
    };
    const result = migrateState(raw);
    // All original fields preserved
    expect((result as Record<string, unknown>).last_evaluated_line).toBe(42);
    expect((result as Record<string, unknown>).stats).toEqual(
      expect.objectContaining({ custom_field: 'should stay' })
    );
    // New fields added
    expect(result.schema_version).toBe(1);
    expect(Array.isArray(result.migration_history)).toBe(true);
  });

  // ── Fail-safe ────────────────────────────────────────────────────

  it('returns original data on migration failure', () => {
    const raw: Record<string, unknown> = {
      schema_version: 0,
      unlocked: { test: 'value' },
    };
    // Mimic failure by passing something that would cause migrateFn to throw
    // We can't easily inject bad MIGRATIONS entries, but we test the guard:
    // non-object / null / array returns as-is
    expect(migrateState(null as unknown as Record<string, unknown>)).toBe(null);
    expect(migrateState(undefined as unknown as Record<string, unknown>)).toBe(undefined);
    expect(migrateState([] as unknown as Record<string, unknown>)).toEqual([]);
    expect(migrateState('string' as unknown as Record<string, unknown>)).toBe('string');
  });

  // ── Idempotent ───────────────────────────────────────────────────

  it('is idempotent — running twice produces same result', () => {
    const raw: Record<string, unknown> = {
      unlocked: {},
      stats: { total_unlocked: 0 },
    };
    const once = migrateState(raw);
    const twice = migrateState(once);
    expect(twice.schema_version).toBe(1);
    expect(twice.schema_version).toBe(once.schema_version);
    // Migration history should not be duplicated
    expect((twice.migration_history as MigrationRecord[]).length).toBe(1);
  });

  // ── Version tracking ─────────────────────────────────────────────

  it('has CURRENT_VERSION >= 1', () => {
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(1);
  });

  // ── v0 with schema_version: 0 ────────────────────────────────────

  it('migrates when schema_version is explicitly 0', () => {
    const raw: Record<string, unknown> = {
      schema_version: 0,
      unlocked: { first_contact: '2026-06-01T00:00:00Z' },
      stats: { total_unlocked: 1 },
    };
    const result = migrateState(raw);
    expect(result.schema_version).toBe(1);
    expect((result.migration_history as MigrationRecord[]).length).toBe(1);
  });
});
