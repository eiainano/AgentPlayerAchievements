import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  safeParse,
  trackedEventSchema,
  achievementStateSchema,
  showcaseDataSchema,
  dailyBucketSchema,
  agentToolStatsSchema,
  appConfigSchema,
} from '../../src/utils/validate.js';

describe('safeParse', () => {
  const stringSchema = z.string();

  it('returns parsed data on success', () => {
    expect(safeParse(stringSchema, 'hello', 'fallback')).toBe('hello');
  });

  it('returns fallback on parse failure', () => {
    expect(safeParse(stringSchema, 42, 'fallback')).toBe('fallback');
  });

  it('returns fallback for null input', () => {
    expect(safeParse(stringSchema, null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined input', () => {
    expect(safeParse(stringSchema, undefined, 'fallback')).toBe('fallback');
  });
});

describe('trackedEventSchema', () => {
  it('validates a minimal event', () => {
    const result = trackedEventSchema.safeParse({
      event_id: 'e1',
      event_type: 'test.event',
      timestamp: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_id).toBe('e1');
      expect(result.data.payload).toEqual({});
      // context is optional and defaults to undefined in the schema
    }
  });

  it('rejects missing event_id', () => {
    const result = trackedEventSchema.safeParse({
      event_type: 'test.event',
      timestamp: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all fields', () => {
    const result = trackedEventSchema.safeParse({
      protocol_version: '1.0',
      event_id: 'e1',
      timestamp: '2026-01-01T00:00:00Z',
      tool_source: 'test',
      event_type: 'test.event',
      payload: { key: 'value', num: 42 },
      context: { session_id: 's1', model: 'auto' },
    });
    expect(result.success).toBe(true);
  });
});

describe('achievementStateSchema', () => {
  it('validates a minimal state', () => {
    const result = achievementStateSchema.safeParse({
      unlocked: {},
      stats: { total_unlocked: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts extra fields in stats via passthrough', () => {
    const result = achievementStateSchema.safeParse({
      unlocked: { test_id: '2026-01-01T00:00:00Z' },
      stats: { total_unlocked: 1, some_extra: 'value' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing total_unlocked', () => {
    const result = achievementStateSchema.safeParse({
      unlocked: {},
      stats: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('showcaseDataSchema', () => {
  it('validates 6 slots', () => {
    const result = showcaseDataSchema.safeParse({
      slots: ['id1', null, 'id3', null, null, 'id6'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-array slots', () => {
    const result = showcaseDataSchema.safeParse({
      slots: 'not-an-array',
    });
    expect(result.success).toBe(false);
  });
});

describe('dailyBucketSchema', () => {
  it('validates a complete bucket', () => {
    const result = dailyBucketSchema.safeParse({
      tool_calls: 10,
      sessions: 2,
      user_msgs: 5,
      tokens: 10000,
      unique_tools: 3,
      duration_secs: 300,
      tools_used: ['Read', 'Edit', 'Bash'],
    });
    expect(result.success).toBe(true);
  });

  it('fills defaults for missing fields', () => {
    const result = dailyBucketSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tool_calls).toBe(0);
      expect(result.data.sessions).toBe(0);
      expect(result.data.tools_used).toEqual([]);
    }
  });
});

describe('agentToolStatsSchema', () => {
  it('validates v2.0 with daily', () => {
    const result = agentToolStatsSchema.safeParse({
      version: '2.0',
      last_updated: '2026-01-01T00:00:00Z',
      sessions: { cc: 1 },
      user_messages: { cc: 5 },
      usage_time_ms: { cc: 1000 },
      last_aggregated_line: 100,
      daily: {
        '2026-01-01': {
          tool_calls: 5, sessions: 1, user_msgs: 3,
          tokens: 5000, unique_tools: 2, duration_secs: 60,
          tools_used: ['Read', 'Edit'],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = agentToolStatsSchema.safeParse({
      version: '2.0',
    });
    expect(result.success).toBe(false);
  });
});

describe('appConfigSchema', () => {
  it('validates a complete config with defaults', () => {
    const result = appConfigSchema.safeParse({
      lang: 'zh',
      sound_enabled: false,
      telemetry: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Optional fields should retain their defaults
      expect(result.data.active_profile).toBe('default');
      expect(result.data.telemetry_server).toBe('');
    }
  });

  it('rejects invalid lang', () => {
    const result = appConfigSchema.safeParse({
      lang: 'fr',
    });
    expect(result.success).toBe(false);
  });

  it('validates minimal (no fields)', () => {
    const result = appConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lang).toBe('en');
      expect(result.data.sound_enabled).toBe(true);
    }
  });
});
