// ── Event types ────────────────────────────────────────────────

export type EventType =
  | 'session.start'
  | 'session.end'
  | 'user.message'
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
  | 'sequence_count';

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
}

export type RarityLevel = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
  pixel_art?: Record<string, unknown>;
  unlocked_at?: string;
  future?: boolean;  // pending event/hook support before reachable
  challenge?: boolean;  // requires user to actively attempt (opt-in challenge)
}

export interface EvaluationResult {
  met: boolean;
  progress: number;
  target: number;
}

export interface AchievementState {
  unlocked: Record<string, string>;
  stats: {
    total_unlocked: number;
    [key: string]: unknown;
  };
  last_evaluated_line?: number;
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
}

export interface EngineOptions {
  stateDir?: string;
  defsPath?: string;
  enabledCategories?: string[];
  toolSource?: string;
  sessionId?: string;
}

