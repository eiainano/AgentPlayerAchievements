// ── Event types ────────────────────────────────────────────────

export type EventType =
  | 'session.start'
  | 'session.end'
  | 'user.message'
  | 'user.message.batch'
  | 'user.prompt'
  | 'token.consumed'
  | 'session.stats'
  | 'conversation.message'
  | 'tool.complete'
  | 'task.complete'
  | 'task.create'
  | 'task.update'
  | 'plan.enter'
  | 'plan.exit'
  | 'hook.trigger'
  | 'mcp.connect'
  | 'mcp.tool_call'
  | 'skill.invoke'
  | 'agent.spawn'
  | 'agent.complete'
  | 'agent.end'
  | 'automode.start'
  | 'automode.end'
  | 'checkpoint.long'
  | 'checkpoint.extreme'
  | 'checkpoint.unusual'
  | 'error.occurred'
  | 'model.switch'
  | 'validation.fail'
  | 'image.upload'
  | 'file.create'
  | 'file.edit'
  | 'file.delete'
  | 'command.run'
  | 'state.reset'
  | 'deepseek.conversation'
  | 'deepseek.tool_use'
  | 'deepseek.session_start'
  | string;

export interface EventPayload {
  tool_name?: string;
  file_type?: string;
  command?: string;
  file_path?: string;
  agent_involved?: boolean;
  manual_edits?: number;
  issues_found?: number;
  hour?: number;
  day_of_week?: number;
  elapsed_ms?: number;
  [key: string]: unknown;
}

export interface TrackedEvent {
  protocol_version: string;
  event_id: string;
  timestamp: string;
  tool_source: string;
  event_type: EventType;
  payload: EventPayload;
  context: {
    session_id: string;
    model: string;
    task_id?: string;
    [key: string]: unknown;
  };
}

// ── Condition types ────────────────────────────────────────────

export type ConditionType =
  | 'counter'
  | 'threshold'
  | 'streak'
  | 'sequence'
  | 'distinct_count'
  | 'event'
  | 'set_completion'
  | 'ratio'
  | 'pattern_match'
  | 'mode'
  | 'sequence_count'
  | 'time_gap';

export type ConditionOperator = '>=' | '<=' | '==' | '>' | '<';

export interface Condition {
  type: ConditionType;
  event?: string;
  filter?: string;
  value: number;
  operator?: ConditionOperator;
  window?: string;
  field?: string;
  sequence?: string[];
  pattern?: string[] | string;
  numerator?: Condition | string;
  denominator?: Condition | string;
  // set_completion
  rarity?: string;
  include_above?: boolean;
  all?: boolean;
  exclude_hidden?: boolean;
  // mode
  in_range?: [number, number];
  threshold?: number;
  // pattern_match
  role?: string;
  first_in_session?: boolean;
  // threshold (metric expressions)
  metric?: string;
  // distinct_count
  values?: string[];
  // sequence / consecutive
  consecutive?: boolean;
  count?: { operator?: ConditionOperator; value: number };
  // counter
  same_target?: boolean;
  // threshold / counter
  max_per_day?: number;
  // streak
  event_level?: boolean;
  // metadata
  unit?: string;
  // threshold: check each event individually instead of summing
  per_event?: boolean;
  // threshold: upper bound for per_event range checks (exclusive)
  max_value?: number;
  // ratio: deduplicate events by this field before computing ratio
  group_by?: string;
  // time_gap: filter the first event in the pair
  from_filter?: string;
  // time_gap: filter the second event in the pair
  to_filter?: string;
  // time_gap: require the pair to span different calendar days
  cross_day?: boolean;
}

export type RarityLevel = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

/**
 * Pixel art stored as palette + index-encoded data rows.
 * Palette uses index characters 0-9A-Z (36 slots); index 0 (⬛) is transparent.
 */
export interface PixelArtSize {
  palette: string[];  // ["⬛", "#ff6b35", "#ffd700", ...], max 36 entries
  data: string[];     // ["0000111...", ...], each char is palette index, length = resolution
}

/**
 * Multi-resolution pixel art. Each key is a numeric string ("48", "128", "256").
 * All keys are optional — missing resolutions fall back to emoji icon.
 */
export interface PixelArt {
  '48'?: PixelArtSize;
  '128'?: PixelArtSize;
  '256'?: PixelArtSize;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  name_cn?: string;
  description: string;
  description_cn?: string;
  icon: string;
  category: string;
  rarity: RarityLevel;
  hidden?: boolean;
  progress_trackable?: boolean;
  set_id?: string;
  conditions: Condition[];
  tip?: string;      // educational tip (English), shown after unlock
  tip_cn?: string;   // educational tip (Chinese)
  hint?: string;     // unlock clue for locked view (English), does NOT expose exact condition
  hint_cn?: string;  // unlock clue for locked view (Chinese)
  pixel_art?: PixelArt;
  unlocked_at?: string;
  future?: boolean;  // pending event/hook support before reachable
  challenge?: boolean;  // requires user to actively attempt (opt-in challenge)
}

export interface EvaluationResult {
  met: boolean;
  progress: number;
  target: number;
}

// ── Explain layer types ──────────────────────────────────────────

export type ExclusionReasonCode = 'event_type' | 'filter' | 'role' | 'window' | 'field_value';

export interface ExclusionTrace {
  event_id: string;
  timestamp: string;
  event_type: string;
  tool_name?: string;
  reason_code: ExclusionReasonCode;
  reason: string;          // human-readable English
  reason_cn: string;       // human-readable Chinese
}

export interface ConditionExplanation {
  index: number;            // 1-based condition index within the achievement
  type: string;
  met: boolean;
  // Progress
  current_value: number;
  target_value: number;
  progress_pct: number;
  unit_label: string;
  // Scope
  event_type: string;
  filter_expr: string;
  field: string;
  window_raw: string;
  window_label: string;
  window_start: string;     // ISO date or '' for lifetime
  window_end: string;       // ISO date or ''
  // Counts
  matched_count: number;
  excluded_count: number;
  total_scoped_events: number;
  // Exclusion trace (max 5)
  excluded_events: ExclusionTrace[];
  // Type-specific details
  details: Record<string, unknown>;
}

export interface AchievementExplanation {
  achievement_id: string;
  name: string;
  name_cn: string;
  description: string;
  description_cn: string;
  icon: string;
  rarity: string;
  category: string;
  hidden: boolean;
  unlocked: boolean;
  unlocked_at: string;
  hint: string;
  hint_cn: string;
  conditions: ConditionExplanation[];
}

export interface MigrationRecord {
  from: number;
  to: number;
  timestamp: string; // ISO 8601
  description?: string;
}

export interface AchievementState {
  unlocked: Record<string, string>;
  stats: {
    total_unlocked: number;
    session_count?: number;
    [key: string]: unknown;
  };
  last_evaluated_line?: number;
  schema_version?: number;
  migration_history?: MigrationRecord[];
}

export type SetRewardType = 'title' | 'showcase_border' | 'stat_counter' | 'theme' | 'animation' | 'badge';

export interface SetReward {
  type: SetRewardType;
  value: string;
}

export interface SetDefinition {
  id: string;
  name: string;
  name_cn?: string;
  achievements: string[];
  reward: SetReward;
}

export interface AchievementStats {
  total_achievements: number;
  unlocked: number;
  completion_pct: number;
  total_events: number;
  by_category: Record<string, { total: number; unlocked: number }>;
  by_rarity: Record<string, { total: number; unlocked: number }>;
  state_dir: string;
  level?: number;
  total_xp?: number;
}

export interface EngineOptions {
  stateDir?: string;
  defsPath?: string;
  enabledCategories?: string[];
  toolSource?: string;
  sessionId?: string;
}

// ── Questline types ──────────────────────────────────────────

export interface StageDefinition {
  stage: number;
  name: string;
  name_cn: string;
  achievements: string[];
}

export interface QuestlineDefinition {
  id: string;
  name: string;
  name_cn: string;
  icon: string;
  description: string;
  description_cn: string;
  stages: StageDefinition[];
  reward: SetReward;
}

// ── Recommendation types ───────────────────────────────────────

export type RecommendCategory = 'near_win' | 'discovery' | 'surprise';

export interface RecommendItem {
  category: RecommendCategory;
  achievement_id: string;
  name: string;
  name_cn?: string;
  icon: string;
  rarity: RarityLevel;

  // Near Win 专用
  progress?: { current: number; target: number; pct: number };
  unit_label?: string;

  // Discovery 专用
  discovery_event?: string;
  discovery_reason?: string;

  // Surprise 专用
  hint?: string | null;
  hint_cn?: string | null;
}

export interface RecommendResponse {
  near_win: RecommendItem[];
  discovery: RecommendItem | null;
  surprise: RecommendItem | null;
  generated_at: string;
  session_id?: string;
}

