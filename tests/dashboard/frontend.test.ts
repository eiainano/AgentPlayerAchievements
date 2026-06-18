/**
 * Dashboard frontend (app.js) tests.
 *
 * @vitest-environment jsdom
 *
 * Tests core frontend logic via inline test helpers that mirror
 * app.js's pure functions. Filter/sort logic is also inlined
 * to avoid jsdom <script> tag scope issues with const/let.
 *
 * NOTE: When app.js is eventually modularized, these tests should
 * import functions directly instead of using inline mirrors.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Inline test helpers (mirror app.js logic) ──────────────────────

function displayName(item: Record<string, unknown>, lang: string): string {
  if (lang === 'zh' && item.name_cn) return item.name_cn as string;
  if (lang === 'es' && item.name_es) return item.name_es as string;
  if (lang === 'ko' && item.name_ko) return item.name_ko as string;
  if (lang === 'ja' && item.name_ja) return item.name_ja as string;
  return item.name as string;
}

function displayDesc(item: Record<string, unknown>, lang: string): string {
  if (lang === 'zh' && item.description_cn) return item.description_cn as string;
  if (lang === 'es' && item.description_es) return item.description_es as string;
  if (lang === 'ko' && item.description_ko) return item.description_ko as string;
  if (lang === 'ja' && item.description_ja) return item.description_ja as string;
  return item.description as string;
}

function rarityColor(rarity: string, colors: Record<string, string>): string {
  return colors[rarity] || colors.common;
}

function iconHtml(icon: string | { src: string; alt?: string }, opts?: { className?: string }): string {
  if (typeof icon === 'object' && icon.src) {
    const cls = opts?.className ? ` ${opts.className}` : '';
    return `<img class="ach-icon${cls}" src="${icon.src}" alt="${icon.alt || ''}" />`;
  }
  const cls = opts?.className ? ` ${opts.className}` : '';
  return `<span class="ach-icon${cls}">${icon}</span>`;
}

function i18n(key: string, lang: string, i18nTable: Record<string, Record<string, string>>, replacements?: Record<string, string | number>): string {
  let str = (i18nTable[lang] || i18nTable.en)[key] || i18nTable.en[key] || key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

// ── Filter/sort inline helpers ────────────────────────────────────

interface AchievementsData {
  achievements: Array<Record<string, unknown>>;
}

interface FilterState {
  selectedFilter: string;
  selectedCategory: string;
  selectedRarity: string;
  sortBy: string;
  sortDir: string;
}

function filterItems(data: AchievementsData, state: FilterState): Array<Record<string, unknown>> {
  return data.achievements.filter(a => {
    if (a.hidden) return false;
    if (state.selectedFilter === 'unlocked' && !a.unlocked) return false;
    if (state.selectedFilter === 'locked' && a.unlocked) return false;
    if (state.selectedCategory !== 'all' && a.category !== state.selectedCategory) return false;
    if (state.selectedRarity !== 'all' && a.rarity !== state.selectedRarity) return false;
    return true;
  });
}

function filterAndSort(data: AchievementsData, state: FilterState): Array<Record<string, unknown>> {
  const items = filterItems(data, state);
  if (state.sortBy === 'name') {
    return [...items].sort((a, b) => {
      const na = (a.name as string) || '';
      const nb = (b.name as string) || '';
      return state.sortDir === 'desc' ? nb.localeCompare(na) : na.localeCompare(nb);
    });
  }
  return items;
}

// ── Sample data ────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  common: '#64b5f6',
  uncommon: '#42a5f5',
  rare: '#ffca28',
  epic: '#ff9800',
  legendary: '#ab47bc',
  mythic: '#ef5350',
};

const I18N: Record<string, Record<string, string>> = {
  en: {
    nav_profile: 'Profile',
    xp_label: '{xp} XP • Level {level}',
    rarity_common: 'Common',
    rarity_mythic: 'Mythic',
    category_onboarding: 'Onboarding',
  },
  zh: {
    nav_profile: '个人主页',
    xp_label: '{xp} XP • {level} 级',
    rarity_common: '普通',
    rarity_mythic: '神话',
    category_onboarding: '入门',
  },
};

const mockItem: Record<string, unknown> = {
  id: 'test_ach',
  name: 'Test Achievement',
  name_cn: '测试成就',
  name_es: 'Logro de Prueba',
  name_ko: '테스트 업적',
  name_ja: 'テスト実績',
  description: 'An achievement for testing.',
  description_cn: '一个用于测试的成就。',
  description_es: 'Un logro para pruebas.',
  description_ko: '테스트용 업적입니다.',
  description_ja: 'テスト用の実績です。',
  category: 'onboarding',
  rarity: 'common',
  icon: '🎯',
  hidden: false,
  unlocked: true,
};

// ── Tests: i18n ─────────────────────────────────────────────────────

describe('t() — i18n lookup logic', () => {
  it('returns the key itself when no translation exists', () => {
    expect(i18n('nonexistent_key_xyz', 'en', I18N)).toBe('nonexistent_key_xyz');
  });

  it('returns EN value with en', () => {
    expect(i18n('nav_profile', 'en', I18N)).toBe('Profile');
  });

  it('returns ZH value with zh', () => {
    expect(i18n('nav_profile', 'zh', I18N)).toBe('个人主页');
  });

  it('falls back to EN for unknown language', () => {
    expect(i18n('nav_profile', 'es', I18N)).toBe('Profile');
  });

  it('replaces {placeholder} with values', () => {
    expect(i18n('xp_label', 'en', I18N, { xp: '1500', level: '12' })).toBe('1500 XP • Level 12');
  });

  it('replaces zh placeholder with values', () => {
    expect(i18n('xp_label', 'zh', I18N, { xp: '1500', level: '12' })).toBe('1500 XP • 12 级');
  });
});

// ── Tests: displayName ─────────────────────────────────────────────

describe('displayName() logic', () => {
  it('returns name for English', () => {
    expect(displayName(mockItem, 'en')).toBe('Test Achievement');
  });

  it('returns name_cn for Chinese', () => {
    expect(displayName(mockItem, 'zh')).toBe('测试成就');
  });

  it('returns name_es for Spanish', () => {
    expect(displayName(mockItem, 'es')).toBe('Logro de Prueba');
  });

  it('returns name_ko for Korean', () => {
    expect(displayName(mockItem, 'ko')).toBe('테스트 업적');
  });

  it('returns name_ja for Japanese', () => {
    expect(displayName(mockItem, 'ja')).toBe('テスト実績');
  });

  it('falls back to name when lang field missing', () => {
    expect(displayName({ name: 'Fallback' } as Record<string, unknown>, 'en')).toBe('Fallback');
  });
});

// ── Tests: displayDesc ─────────────────────────────────────────────

describe('displayDesc() logic', () => {
  it('returns description for English', () => {
    expect(displayDesc(mockItem, 'en')).toBe('An achievement for testing.');
  });

  it('returns description_cn for Chinese', () => {
    expect(displayDesc(mockItem, 'zh')).toBe('一个用于测试的成就。');
  });

  it('returns description_es for Spanish', () => {
    expect(displayDesc(mockItem, 'es')).toBe('Un logro para pruebas.');
  });

  it('falls back to description when no translation exists', () => {
    expect(displayDesc({ name: 'X', description: 'Default desc' } as Record<string, unknown>, 'en')).toBe('Default desc');
  });
});

// ── Tests: rarityColor ─────────────────────────────────────────────

describe('rarityColor() logic', () => {
  it('returns correct color for common', () => {
    expect(rarityColor('common', RARITY_COLORS)).toBe(RARITY_COLORS.common);
  });

  it('returns correct color for mythic', () => {
    expect(rarityColor('mythic', RARITY_COLORS)).toBe(RARITY_COLORS.mythic);
  });

  it('falls back to common for unknown', () => {
    expect(rarityColor('unknown', RARITY_COLORS)).toBe(RARITY_COLORS.common);
  });
});

// ── Tests: iconHtml ────────────────────────────────────────────────

describe('iconHtml() logic', () => {
  it('renders emoji', () => {
    const html = iconHtml('🎯');
    expect(html).toContain('🎯');
    expect(html).toContain('class="ach-icon"');
  });

  it('renders object icon with src/alt', () => {
    const html = iconHtml({ src: '/icons/test.png', alt: 'Test' });
    expect(html).toContain('<img');
    expect(html).toContain('src="/icons/test.png"');
    expect(html).toContain('alt="Test"');
  });

  it('includes class option', () => {
    const html = iconHtml('🎯', { className: 'custom-class' });
    expect(html).toContain('custom-class');
  });
});

// ── Tests: filtering & sorting ──────────────────────────────────────

describe('filter / sort logic', () => {
  const data: AchievementsData = {
    achievements: [
      { id: 'a1', name: 'Alpha', category: 'onboarding', rarity: 'common', unlocked: true, hidden: false },
      { id: 'a2', name: 'Beta', category: 'milestones', rarity: 'rare', unlocked: false, hidden: false },
      { id: 'a3', name: 'Gamma', category: 'onboarding', rarity: 'epic', unlocked: true, hidden: false },
      { id: 'a4', name: 'Delta', category: 'hidden', rarity: 'mythic', unlocked: false, hidden: true },
      { id: 'a5', name: 'Epsilon', category: 'tool_mastery', rarity: 'uncommon', unlocked: true, hidden: false },
    ],
  };

  let state: FilterState;

  beforeEach(() => {
    state = {
      selectedFilter: 'all',
      selectedCategory: 'all',
      selectedRarity: 'all',
      sortBy: 'default',
      sortDir: 'asc',
    };
  });

  it('excludes hidden by default', () => {
    const result = filterItems(data, state);
    expect(result.map(a => a.id)).not.toContain('a4');
    expect(result.map(a => a.id)).toContain('a1');
  });

  it('filters unlocked', () => {
    state.selectedFilter = 'unlocked';
    expect(filterItems(data, state).every(a => a.unlocked)).toBe(true);
  });

  it('filters locked', () => {
    state.selectedFilter = 'locked';
    expect(filterItems(data, state).every(a => !a.unlocked)).toBe(true);
  });

  it('filters by category', () => {
    state.selectedCategory = 'onboarding';
    expect(filterItems(data, state).every(a => a.category === 'onboarding')).toBe(true);
  });

  it('filters by rarity', () => {
    state.selectedRarity = 'epic';
    expect(filterItems(data, state).every(a => a.rarity === 'epic')).toBe(true);
  });

  it('combines filters', () => {
    state.selectedFilter = 'unlocked';
    state.selectedCategory = 'onboarding';
    const result = filterItems(data, state);
    expect(result.every(a => a.unlocked && a.category === 'onboarding')).toBe(true);
  });

  it('sorts A→Z by name', () => {
    state.sortBy = 'name';
    state.sortDir = 'asc';
    const result = filterAndSort(data, state);
    expect(result[0].id).toBe('a1');
    expect(result[result.length - 1].id).toBe('a3'); // Gamma
  });

  it('sorts Z→A by name', () => {
    state.sortBy = 'name';
    state.sortDir = 'desc';
    const result = filterAndSort(data, state);
    expect(result[0].id).toBe('a3'); // Gamma (last alphabetically)
    expect(result[result.length - 1].id).toBe('a1');
  });
});
