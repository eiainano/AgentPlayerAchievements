import * as YAML from 'yaml';
import type { AchievementDefinition, Condition, ConditionType, PackMetadata, PixelArt, PixelArtSize, SetDefinition, SetRewardType, QuestlineDefinition, StageDefinition } from './types.js';

const VALID_REWARD_TYPES: Set<string> = new Set([
  'showcase_border', 'stat_counter', 'theme', 'animation', 'badge',
]);

const VALID_CONDITION_TYPES: Set<string> = new Set([
  'counter', 'threshold', 'streak', 'sequence', 'distinct_count',
  'event', 'set_completion', 'ratio', 'pattern_match',
  'mode', 'sequence_count', 'time_gap',
]);

/**
 * Known event types that have at least one emitter source.
 * Mirrors the Layer C emitter lists in src/verify/auditor.ts.
 */
const KNOWN_EVENT_TYPES = new Set([
  'session.start', 'session.end', 'user.message', 'user.message.batch',
  'user.prompt', 'token.consumed', 'session.stats', 'conversation.message',
  'tool.complete', 'tool.failure', 'tool.requested', 'tool.deny',
  'task.complete', 'task.create', 'task.update',
  'plan.mode_entered', 'plan.mode_exited',
  'hook.trigger', 'hook.configured',
  'mcp.connect', 'mcp.server_used', 'mcp.tool_call',
  'skill.invoke', 'skill.created', 'skill.published',
  'agent.spawn', 'agent.complete', 'agent.end', 'agent.self_fix', 'agent.created', 'agent.mode_activated',
  'automode.start', 'automode.end',
  'checkpoint.long', 'checkpoint.extreme', 'checkpoint.unusual',
  'error.occurred', 'model.switch', 'validation.fail',
  'image.upload', 'image.read',
  'file.read', 'file.create', 'file.write', 'file.edit', 'file.delete', 'file.language_used', 'file.revert',
  'command.run', 'command.slash_used', 'command.created',
  'state.reset', 'config.file_edited',
  'git.commit', 'git.add', 'git.push', 'git.pr_created', 'git.bisect',
  'merge.conflict_resolved',
  'code.review_requested', 'code.review_completed',
  'deepseek.conversation', 'deepseek.tool_use', 'deepseek.session_start',
  'achievement.unlocked',
  'dashboard.opened',
  'permission.mode_changed', 'permission.dangerously_skipped',
  'context.compacted',
  'help.accessed',
  'test.pass', 'test.fail',
  'plugin.installed',
  'template.created',
  'worktree.created',
  'function.edited',
  'output.edit',
  'event',
]);

export function isKnownEventType(eventType: string): boolean {
  return KNOWN_EVENT_TYPES.has(eventType);
}

/**
 * Represents a parsed community achievement pack.
 */
export interface ParsedPack {
  pack: PackMetadata;
  definitions: AchievementDefinition[];
}

/** Parse YAML icon field: supports emoji string or pixel-art object { src, alt } */
function parseIconField(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.src === 'string') return obj.src;
  }
  return '\u{1F3C6}'; // 🏆
}

// ── Pixel Art parsing ──────────────────────────────────────────────────

const VALID_PIXEL_RESOLUTIONS = new Set(['48', '128', '256']);
const PIXEL_INDEX_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Parse pixel_art YAML field. Validates palette + data format for each
 * resolution (48, 128, 256). Skips invalid sizes individually; returns
 * undefined only when ALL sizes are invalid or pixel_art is absent.
 */
function parsePixelArt(raw: unknown): PixelArt | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;

  const result: PixelArt = {};

  for (const [key, sizeRaw] of Object.entries(obj)) {
    if (!VALID_PIXEL_RESOLUTIONS.has(key)) continue;
    if (typeof sizeRaw !== 'object' || sizeRaw === null) continue;

    const parsed = parsePixelArtSize(sizeRaw as Record<string, unknown>, parseInt(key, 10));
    if (parsed) {
      result[key as '48' | '128' | '256'] = parsed;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parsePixelArtSize(raw: Record<string, unknown>, resolution: number): PixelArtSize | undefined {
  const palette = Array.isArray(raw.palette) && raw.palette.every((c: unknown) => typeof c === 'string')
    ? raw.palette as string[]
    : null;
  const data = Array.isArray(raw.data) && raw.data.every((r: unknown) => typeof r === 'string')
    ? raw.data as string[]
    : null;

  if (!palette || !data) return undefined;

  // palette[0] must be the transparent marker "⬛"
  if (palette.length < 2 || palette.length > 36) return undefined;
  if (palette[0] !== '⬛') return undefined;

  // data must have exactly `resolution` rows, each of length `resolution`
  if (data.length !== resolution) return undefined;
  if (!data.every(row => row.length === resolution)) return undefined;

  // Every data char must be a valid palette index
  const validChars = new Set(PIXEL_INDEX_CHARS.slice(0, palette.length));
  if (!data.every(row => row.split('').every(ch => validChars.has(ch)))) return undefined;

  return { palette, data };
}

export function parseYAML(text: string): { definitions: AchievementDefinition[]; sets: SetDefinition[]; questlines: QuestlineDefinition[] } {
  const raw = YAML.parse(text) as {
    definitions?: Array<Record<string, unknown>>;
    sets?: Record<string, Record<string, unknown>>;
    questlines?: Array<Record<string, unknown>>;
  } | null;
  if (!raw?.definitions || !Array.isArray(raw.definitions)) {
    throw new Error('Invalid achievement YAML: missing or empty "definitions" array');
  }

  const definitions: AchievementDefinition[] = [];

  for (let i = 0; i < raw.definitions.length; i++) {
    const entry = raw.definitions[i]!;

    const id = typeof entry.id === 'string' ? entry.id : null;
    if (!id) throw new Error(`Achievement at index ${i} is missing "id"`);

    const conditions = parseConditions(entry.conditions, id);

    definitions.push({
      id,
      name: typeof entry.name === 'string' ? entry.name : id,
      name_cn: typeof entry.name_cn === 'string' ? entry.name_cn : undefined,
      name_es: typeof entry.name_es === 'string' ? entry.name_es : undefined,
      name_ko: typeof entry.name_ko === 'string' ? entry.name_ko : undefined,
      name_ja: typeof entry.name_ja === 'string' ? entry.name_ja : undefined,
      description: typeof entry.description === 'string' ? entry.description : '',
      description_cn: typeof entry.description_cn === 'string' ? entry.description_cn : undefined,
      description_es: typeof entry.description_es === 'string' ? entry.description_es : undefined,
      description_ko: typeof entry.description_ko === 'string' ? entry.description_ko : undefined,
      description_ja: typeof entry.description_ja === 'string' ? entry.description_ja : undefined,
      icon: parseIconField(entry.icon),
      category: typeof entry.category === 'string' ? entry.category : 'other',
      rarity: typeof entry.rarity === 'string' ? entry.rarity as AchievementDefinition['rarity'] : 'common',
      hidden: entry.hidden === true || undefined,
      progress_trackable: entry.progress_trackable === true || undefined,
      set_id: typeof entry.set === 'string' ? entry.set : typeof entry.set_id === 'string' ? entry.set_id : undefined,
      conditions,
      tip: typeof entry.tip === 'string' ? entry.tip : undefined,
      tip_cn: typeof entry.tip_cn === 'string' ? entry.tip_cn : undefined,
      tip_es: typeof entry.tip_es === 'string' ? entry.tip_es : undefined,
      tip_ko: typeof entry.tip_ko === 'string' ? entry.tip_ko : undefined,
      tip_ja: typeof entry.tip_ja === 'string' ? entry.tip_ja : undefined,
      hint: typeof entry.hint === 'string' ? entry.hint : undefined,
      hint_cn: typeof entry.hint_cn === 'string' ? entry.hint_cn : undefined,
      hint_es: typeof entry.hint_es === 'string' ? entry.hint_es : undefined,
      hint_ko: typeof entry.hint_ko === 'string' ? entry.hint_ko : undefined,
      hint_ja: typeof entry.hint_ja === 'string' ? entry.hint_ja : undefined,
      future: entry.future === true || undefined,
      challenge: entry.challenge === true || undefined,
      pixel_art: parsePixelArt(entry.pixel_art),
    });
  }

  // Parse sets
  const sets: SetDefinition[] = [];
  if (raw.sets) {
    for (const [id, entry] of Object.entries(raw.sets)) {
      const rewardRaw = entry.reward as Record<string, unknown> | undefined;
      const rewardType = typeof rewardRaw?.type === 'string' ? rewardRaw.type : null;
      const rewardValue = typeof rewardRaw?.value === 'string' ? rewardRaw.value : '';

      sets.push({
        id,
        name: typeof entry.name === 'string' ? entry.name : id,
        name_cn: typeof entry.name_cn === 'string' ? entry.name_cn : undefined,
        achievements: Array.isArray(entry.achievements) && entry.achievements.every((x: unknown) => typeof x === 'string')
          ? entry.achievements as string[] : [],
        reward: {
          type: rewardType && VALID_REWARD_TYPES.has(rewardType) ? rewardType as SetRewardType : 'badge',
          value: rewardValue,
        },
        badge_image: typeof entry.badge_image === 'string' ? entry.badge_image : undefined,
      });
    }
  }

  // Parse questlines
  const questlines: QuestlineDefinition[] = [];
  if (raw.questlines && Array.isArray(raw.questlines)) {
    for (const qRaw of raw.questlines) {
      const id = typeof qRaw.id === 'string' ? qRaw.id : null;
      if (!id) throw new Error('Questline is missing "id"');

      const stagesRaw = Array.isArray(qRaw.stages) ? qRaw.stages : [];
      const stages: StageDefinition[] = stagesRaw.map((s: Record<string, unknown>, si: number) => {
        if (typeof s.stage !== 'number') throw new Error(`Questline "${id}" stage ${si}: missing "stage" number`);
        return {
          stage: s.stage as number,
          name: typeof s.name === 'string' ? s.name : `Stage ${si + 1}`,
          name_cn: typeof s.name_cn === 'string' ? s.name_cn : `第${si + 1}阶段`,
          achievements: Array.isArray(s.achievements) && s.achievements.every((x: unknown) => typeof x === 'string')
            ? s.achievements as string[] : [],
        };
      });

      const rewardRaw = qRaw.reward as Record<string, unknown> | undefined;
      const rewardType = typeof rewardRaw?.type === 'string' ? rewardRaw.type : null;
      const rewardValue = typeof rewardRaw?.value === 'string' ? rewardRaw.value : '';

      questlines.push({
        id,
        name: typeof qRaw.name === 'string' ? qRaw.name : id,
        name_cn: typeof qRaw.name_cn === 'string' ? qRaw.name_cn : id,
        icon: typeof qRaw.icon === 'string' ? qRaw.icon : '🧭',
        description: typeof qRaw.description === 'string' ? qRaw.description : '',
        description_cn: typeof qRaw.description_cn === 'string' ? qRaw.description_cn : '',
        stages,
        reward: {
          type: rewardType && VALID_REWARD_TYPES.has(rewardType) ? rewardType as SetRewardType : 'badge',
          value: rewardValue,
        },
      });
    }
  }

  return { definitions, sets, questlines };
}

function parseConditions(raw: unknown, achId: string): Condition[] {
  if (!Array.isArray(raw)) {
    if (raw === undefined || raw === null) return [];
    throw new Error(`Achievement "${achId}" has invalid conditions: expected array`);
  }

  return raw.map((c: unknown, j: number) => {
    if (typeof c !== 'object' || c === null) {
      throw new Error(`Achievement "${achId}" condition ${j}: expected object`);
    }
    const cond = c as Record<string, unknown>;
    const type = typeof cond.type === 'string' ? cond.type : null;
    if (!type) throw new Error(`Achievement "${achId}" condition ${j}: missing "type"`);
    if (!VALID_CONDITION_TYPES.has(type)) {
      throw new Error(`Achievement "${achId}" condition ${j}: unknown condition type "${type}"`);
    }

    return buildCondition(type as ConditionType, cond);
  });
}

function buildCondition(type: ConditionType, cond: Record<string, unknown>): Condition {
  const count = cond.count && typeof cond.count === 'object'
    ? {
        operator: str(cond.count as Record<string, unknown>, 'operator') as Condition['operator'],
        value: typeof (cond.count as Record<string, unknown>).value === 'number' ? (cond.count as Record<string, unknown>).value as number : Number((cond.count as Record<string, unknown>).value) || 0,
      }
    : undefined;

  return {
    type,
    value: typeof cond.value === 'number' ? cond.value : Number(cond.value) || 0,
    event: str(cond, 'event'),
    filter: str(cond, 'filter'),
    operator: str(cond, 'operator') as Condition['operator'],
    window: str(cond, 'window'),
    field: str(cond, 'field'),
    sequence: strArr(cond, 'sequence') || strArr(cond, 'events'),
    pattern: cond.pattern && (typeof cond.pattern === 'string' || Array.isArray(cond.pattern)) ? cond.pattern as string | string[] : undefined,
    numerator: parseConditionField(cond, 'numerator'),
    denominator: parseConditionField(cond, 'denominator'),
    rarity: str(cond, 'rarity'),
    include_above: cond.include_above === true || undefined,
    in_range: Array.isArray(cond.in_range) && cond.in_range.length === 2
      ? cond.in_range as [number, number] : undefined,
    threshold: typeof cond.threshold === 'number' ? cond.threshold : undefined,
    role: str(cond, 'role'),
    metric: str(cond, 'metric'),
    values: strArr(cond, 'values'),
    consecutive: cond.consecutive === true || undefined,
    count,
    same_target: cond.same_target === true || undefined,
    all: cond.all === true || undefined,
    exclude_hidden: cond.exclude_hidden === true || undefined,
    max_per_day: typeof cond.max_per_day === 'number' ? cond.max_per_day as number : undefined,
    event_level: cond.event_level === true || undefined,
    per_event: cond.per_event === true || undefined,
    max_value: typeof cond.max_value === 'number' ? cond.max_value : undefined,
    unit: str(cond, 'unit'),
    group_by: str(cond, 'group_by'),
    from_filter: str(cond, 'from_filter'),
    to_filter: str(cond, 'to_filter'),
    cross_day: cond.cross_day === true || undefined,
    first_in_session: cond.first_in_session === true || undefined,
  } satisfies Condition;
}

function str(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === 'string' ? v : undefined;
}

function strArr(o: Record<string, unknown>, k: string): string[] | undefined {
  const v = o[k];
  return Array.isArray(v) && v.every(x => typeof x === 'string') ? v as string[] : undefined;
}

/** Parse a field that can be a plain string or a nested Condition object */
function parseConditionField(o: Record<string, unknown>, k: string): Condition | string | undefined {
  const v = o[k];
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).type === 'string') {
    return buildCondition((v as Record<string, unknown>).type as ConditionType, v as Record<string, unknown>);
  }
  return undefined;
}

/**
 * Parse a community achievement pack YAML file.
 *
 * Validates the `pack:` metadata block, then reuses parseYAML() to
 * validate the `definitions:` array. Rejects files with `sets:` or `questlines:`.
 *
 * Must be called AFTER parseYAML() has been imported — this reuses its
 * full condition validation pipeline.
 */
export function parsePackYAML(text: string): ParsedPack {
  const raw = YAML.parse(text) as Record<string, unknown>;

  // Validate pack metadata
  const packRaw = raw.pack as Record<string, unknown> | undefined;
  if (!packRaw || typeof packRaw.id !== 'string') {
    throw new Error('Pack YAML missing required "pack" block with string "id"');
  }
  if (!packRaw.name || typeof packRaw.name !== 'string') {
    throw new Error('Pack YAML missing required "pack.name"');
  }
  if (!packRaw.author || typeof packRaw.author !== 'string') {
    throw new Error('Pack YAML missing required "pack.author"');
  }

  // Validate pack.id format: lowercase alphanumeric, starting with letter
  if (!/^[a-z][a-z0-9_-]*$/.test(packRaw.id)) {
    throw new Error(`Pack id "${packRaw.id}" must be lowercase alphanumeric starting with a letter`);
  }

  // Reject packs with sets or questlines
  if (raw.sets != null) {
    throw new Error(`Pack "${packRaw.id}" may not define "sets" — only core achievements can define sets`);
  }
  if (raw.questlines != null) {
    throw new Error(`Pack "${packRaw.id}" may not define "questlines" — only core achievements can define questlines`);
  }

  // Parse definitions using the existing full pipeline
  const { definitions, sets, questlines } = parseYAML(text);
  if (definitions.length === 0) {
    throw new Error(`Pack "${packRaw.id}" has no valid definitions`);
  }

  // Warn on definitions that use unknown event types
  for (const def of definitions) {
    for (const cond of def.conditions) {
      if (cond.event && !isKnownEventType(cond.event)) {
        console.warn(`[AGPA] Pack "${packRaw.id}" achievement "${def.id}": unknown event type "${cond.event}" — achievement may never unlock`);
      }
    }
  }

  return {
    pack: {
      id: String(packRaw.id),
      name: String(packRaw.name),
      author: String(packRaw.author),
      version: typeof packRaw.version === 'string' ? packRaw.version : '0.0.0',
      description: typeof packRaw.description === 'string' ? packRaw.description : undefined,
    },
    definitions,
  };
}
