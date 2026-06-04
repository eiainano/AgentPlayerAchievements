import type { AchievementState, TrackedEvent } from '../engine/types.js';
import type { AgentToolStats } from '../engine/stats.js';
import type { AppConfig } from '../config.js';
import type { ShowcaseData } from '../helpers.js';

export interface ExportPayload {
  format_version: '1.0';
  exported_at: string;
  source: {
    tool: 'agpa';
    version: string;
    profile: string;
    profile_emoji: string;
  };
  state: AchievementState;
  stats: AgentToolStats | null;
  showcase: ShowcaseData;
  events?: TrackedEvent[];
  config?: AppConfig;
}
