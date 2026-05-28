import * as YAML from 'yaml';
import type { AchievementDefinition, Condition, ConditionType, SetDefinition, SetRewardType } from './types.js';

const VALID_REWARD_TYPES: Set<string> = new Set([
  'title', 'showcase_border', 'stat_counter', 'theme', 'animation', 'badge',
]);

const VALID_CONDITION_TYPES: Set<string> = new Set([
  'counter', 'threshold', 'streak', 'sequence', 'distinct_count',
  'event', 'set_completion', 'ratio', 'pattern_match', 'percentile',
  'mode', 'sequence_count',
]);

export function parseYAML(text: string): { definitions: AchievementDefinition[]; sets: SetDefinition[] } {
  const raw = YAML.parse(text) as { definitions?: Array<Record<string, unknown>>; sets?: Record<string, Record<string, unknown>> } | null;
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
      description: typeof entry.description === 'string' ? entry.description : '',
      description_cn: typeof entry.description_cn === 'string' ? entry.description_cn : undefined,
      icon: typeof entry.icon === 'string' ? entry.icon : '🏆',
      category: typeof entry.category === 'string' ? entry.category : 'other',
      rarity: typeof entry.rarity === 'string' ? entry.rarity as AchievementDefinition['rarity'] : 'common',
      hidden: entry.hidden === true || undefined,
      progress_trackable: entry.progress_trackable === true || undefined,
      set_id: typeof entry.set === 'string' ? entry.set : typeof entry.set_id === 'string' ? entry.set_id : undefined,
      conditions,
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
        achievements: Array.isArray(entry.achievements) && entry.achievements.every((x: unknown) => typeof x === 'string')
          ? entry.achievements as string[] : [],
        reward: {
          type: rewardType && VALID_REWARD_TYPES.has(rewardType) ? rewardType as SetRewardType : 'badge',
          value: rewardValue,
        },
      });
    }
  }

  return { definitions, sets };
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
    set_id: str(cond, 'set_id'),
    numerator: str(cond, 'numerator'),
    denominator: str(cond, 'denominator'),
    rarity: str(cond, 'rarity'),
    include_above: cond.include_above === true || undefined,
    in_range: Array.isArray(cond.in_range) && cond.in_range.length === 2
      ? cond.in_range as [number, number] : undefined,
    threshold: typeof cond.threshold === 'number' ? cond.threshold : undefined,
    role: str(cond, 'role'),
    metric: str(cond, 'metric'),
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
