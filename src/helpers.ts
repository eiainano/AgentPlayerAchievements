import * as fs from 'fs';
import * as path from 'path';
import type { AchievementEngine } from './engine/engine.js';
import type { AchievementDefinition, PixelArtSize, RarityLevel } from './engine/types.js';
import { safeParse, showcaseDataSchema } from './utils/validate.js';

// ── Showcase storage ──────────────────────────────────────────────

export interface ShowcaseData {
  slots: (string | null)[];
}

export function loadShowcase(stateDir: string): ShowcaseData {
  const p = path.join(stateDir, 'showcase.json');
  const fallback: ShowcaseData = { slots: [null, null, null, null, null, null] };
  try {
    if (fs.existsSync(p)) return safeParse(showcaseDataSchema, JSON.parse(fs.readFileSync(p, 'utf-8')), fallback);
  } catch { /* ignore */ }
  return fallback;
}

export function saveShowcase(stateDir: string, sc: ShowcaseData): void {
  const p = path.join(stateDir, 'showcase.json');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(sc, null, 2));
}

export interface FormattedAchievement {
  id: string;
  name: string;
  name_cn?: string;
  name_es?: string;
  name_ko?: string;
  name_ja?: string;
  description: string;
  description_cn?: string;
  description_es?: string;
  description_ko?: string;
  description_ja?: string;
  icon: string;
  rarity: RarityLevel;
  category: string;
  unlocked_at?: string;
  set_id?: string;
  set_progress?: { current: number; total: number; members: string[] };
  hidden?: boolean;
  pixel_art_48?: PixelArtSize;
}

export function formatAchievement(
  engine: AchievementEngine,
  ach: AchievementDefinition,
): FormattedAchievement {
  return {
    id: ach.id,
    name: ach.name,
    name_cn: ach.name_cn,
    name_es: ach.name_es,
    name_ko: ach.name_ko,
    name_ja: ach.name_ja,
    description: ach.description,
    description_cn: ach.description_cn,
    description_es: ach.description_es,
    description_ko: ach.description_ko,
    description_ja: ach.description_ja,
    icon: ach.icon,
    rarity: ach.rarity,
    category: ach.category,
    unlocked_at: ach.unlocked_at,
    set_id: ach.set_id,
    set_progress: ach.set_id ? computeSetProgress(engine, ach.set_id) : undefined,
    hidden: ach.hidden,
    pixel_art_48: ach.pixel_art?.['48'],
  };
}

export function computeSetProgress(
  engine: AchievementEngine,
  setId: string,
): { current: number; total: number; members: string[] } | undefined {
  const members = engine.definitions.filter(d => d.set_id === setId);
  if (members.length === 0) return undefined;
  const unlocked = members.filter(d => engine.state.unlocked[d.id]);
  return {
    current: unlocked.length,
    total: members.length,
    members: members.map(m => m.id),
  };
}

export const RARITY_RANK: Record<RarityLevel, number> = {
  mythic: 5,
  legendary: 4,
  epic: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};
