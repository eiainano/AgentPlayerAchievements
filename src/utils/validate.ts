import * as z from 'zod';

export const trackedEventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  timestamp: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  context: z.object({
    session_id: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
});

export const migrationRecordSchema = z.object({
  from: z.number(),
  to: z.number(),
  timestamp: z.string(),
  description: z.string().optional(),
});

export const achievementStateSchema = z.object({
  unlocked: z.record(z.string(), z.string()),
  stats: z.object({
    total_unlocked: z.number(),
  }).passthrough(),
  last_evaluated_line: z.number().optional(),
  schema_version: z.number().optional(),
  migration_history: z.array(migrationRecordSchema).optional(),
});

export const showcaseDataSchema = z.object({
  slots: z.array(z.string().nullable()),
});

// P1-3: Daily aggregation bucket schema
export const dailyBucketSchema = z.object({
  tool_calls: z.number().default(0),
  sessions: z.number().default(0),
  user_msgs: z.number().default(0),
  tokens: z.number().default(0),
  unique_tools: z.number().default(0),
  duration_secs: z.number().default(0),
  tools_used: z.array(z.string()).default([]),
  tasks_completed: z.number().optional(),
});

export const agentToolStatsSchema = z.object({
  version: z.enum(['1.0', '2.0']).default('2.0'),
  last_updated: z.string(),
  sessions: z.record(z.string(), z.number()),
  user_messages: z.record(z.string(), z.number()),
  usage_time_ms: z.record(z.string(), z.number()),
  last_aggregated_line: z.number().optional(),
  daily: z.record(z.string(), dailyBucketSchema).optional(),
});

export const appConfigSchema = z.object({
  lang: z.enum(['en', 'zh']).default('en'),
  enabledCategories: z.array(z.string()).optional(),
  debug: z.boolean().optional(),
  telemetry: z.boolean().default(false),
  telemetry_server: z.string().default(''),
  active_profile: z.string().default('default'),
  sound_enabled: z.boolean().default(true),
  simple_animations: z.boolean().default(false),
  banner_theme: z.enum(['Neon', 'Arcade', 'Gold']).default('Arcade'),
  recommend_probability: z.number().min(0).max(1).default(0.2),
});

export function safeParse<T>(schema: z.ZodType<T>, data: unknown, fallback: T): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : fallback;
}
