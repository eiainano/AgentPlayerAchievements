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

export const achievementStateSchema = z.object({
  unlocked: z.record(z.string(), z.string()),
  stats: z.object({
    total_unlocked: z.number(),
  }).passthrough(),
  last_evaluated_line: z.number().optional(),
});

export const showcaseDataSchema = z.object({
  slots: z.array(z.string().nullable()),
});

export const appConfigSchema = z.object({
  lang: z.enum(['en', 'zh']).default('en'),
  enabledCategories: z.array(z.string()).optional(),
  debug: z.boolean().optional(),
  telemetry: z.boolean().default(false),
  telemetry_server: z.string().default(''),
  active_profile: z.string().default('default'),
  sound_enabled: z.boolean().default(true),
});

export function safeParse<T>(schema: z.ZodType<T>, data: unknown, fallback: T): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : fallback;
}
