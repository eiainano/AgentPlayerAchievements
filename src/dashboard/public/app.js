// ── Theme ──────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('agpa-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = (theme === 'dark');
}

function toggleTheme() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const theme = toggle.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('agpa-theme', theme);
}

initTheme();

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('change', toggleTheme);
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) langToggle.addEventListener('change', toggleLang);
});

// ── Language ────────────────────────────────────────────

let currentLang = 'en';

function initLang(configLang) {
  const saved = localStorage.getItem('agpa-lang');
  currentLang = saved || configLang || 'en';
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.checked = (currentLang === 'zh');
}

function toggleLang() {
  const toggle = document.getElementById('lang-toggle');
  if (!toggle) return;
  currentLang = toggle.checked ? 'zh' : 'en';
  localStorage.setItem('agpa-lang', currentLang);
  if (dashboardData) renderAll(dashboardData);
}

function displayName(item) {
  if (currentLang === 'zh' && item.name_cn) return item.name_cn;
  return item.name;
}

function displayDesc(item) {
  if (currentLang === 'zh' && item.description_cn) return item.description_cn;
  return item.description;
}

// ── i18n ─────────────────────────────────────────────────

const I18N = {
  en: {
    nav_profile: 'Profile',
    nav_achievements: 'Achievements',
    nav_sets: 'Sets',
    nav_timeline: 'Timeline',
    section_achievements: 'Achievements',
    section_sets: 'Sets',
    section_timeline: 'Timeline',
    hero_title: 'Agent Achievements',
    xp_label: '{xp} XP • Level {level}',
    stat_unlocked: 'Unlocked',
    stat_events: 'Events',
    stat_streak: 'Day Streak',
    stat_complete: 'Complete',
    filter_all: 'All',
    filter_unlocked: 'Unlocked',
    filter_locked: 'Locked',
    cat_all: 'All',
    pick_cancel: '✕ Cancel',
    pick_banner: 'Pick an achievement for slot {n}',
    click_to_remove: 'click to remove',
    click_to_pick: 'Click to pick an achievement',
    showcase_auto: '⚡ Auto',
    showcase_auto_title: 'Auto-fill with rarest',
    no_sets: 'No achievement sets defined.',
    no_timeline: 'No achievements unlocked yet.',
    load_error: 'Failed to load dashboard data: {status}',
    hidden_hint: '\u{1F512} Hidden',
    pin_title: 'Pin to showcase',
    rarity_common: 'Common',
    rarity_uncommon: 'Uncommon',
    rarity_rare: 'Rare',
    rarity_epic: 'Epic',
    rarity_legendary: 'Legendary',
    rarity_mythic: 'Mythic',
    search_placeholder: 'Search by name or keyword...',
    sort_default: 'Default',
    sort_rarity: 'Rarity ↓',
    sort_recent: 'Recently Unlocked',
    sort_name: 'A → Z',
    rarity_all: 'All Rarities',
    modal_close: 'Close',
    modal_unlocked: 'Unlocked',
    modal_locked: 'Locked',
    unlocked_label: '✓ Unlocked',
    modal_category: 'Category',
    modal_progress: 'Progress',
    modal_no_desc: 'No description available.',
    search_empty: 'No achievements match your search.',
    modal_hidden_desc: 'Achievement details are hidden.',
    modal_hidden_reveal: 'Reveal',
    modal_hidden_hide: 'Hide',
    guide_title: 'Getting Started',
    guide_subtitle: 'Try these easy achievements to get your first unlocks.',
    guide_empty_title: 'This page is empty for now.',
    guide_empty_text: 'Achievements unlock as your agent works. Give it a try!',
    no_timeline_guide: 'Achievements will appear here once unlocked.',
    first_visit_tip: '💡 Browse achievements below to see what you can unlock. Switch tabs to explore Sets and Timeline.',
    next_ach_title: '🎯 Next to aim for',
    next_ach_progress: '{current}/{target}',
    profile_switch: 'Switch Profile',
    profile_create: '+',
    profile_max: 'Max 3 profiles',
    profile_name_placeholder: 'New profile...',
  },
  zh: {
    nav_profile: '个人主页',
    nav_achievements: '成就',
    nav_sets: '套装',
    nav_timeline: '时间线',
    section_achievements: '成就',
    section_sets: '套装',
    section_timeline: '时间线',
    hero_title: 'Agent 成就系统',
    xp_label: '{xp} XP • {level} 级',
    stat_unlocked: '已解锁',
    stat_events: '事件',
    stat_streak: '连续天数',
    stat_complete: '完成度',
    filter_all: '全部',
    filter_unlocked: '已解锁',
    filter_locked: '未解锁',
    cat_all: '全部',
    pick_cancel: '✕ 取消',
    pick_banner: '为第 {n} 格选择成就',
    click_to_remove: '点击移除',
    click_to_pick: '点击选择成就',
    showcase_auto: '⚡ 自动',
    showcase_auto_title: '自动填充(最稀有)',
    no_sets: '暂无套装定义。',
    no_timeline: '还没有解锁任何成就。',
    load_error: '加载仪表盘数据失败: {status}',
    hidden_hint: '\u{1F512} 隐藏成就',
    pin_title: '放入展示柜',
    rarity_common: '普通',
    rarity_uncommon: '优秀',
    rarity_rare: '稀有',
    rarity_epic: '史诗',
    rarity_legendary: '传说',
    rarity_mythic: '神话',
    search_placeholder: '搜索名称或关键词...',
    sort_default: '默认',
    sort_rarity: '稀有度 ↓',
    sort_recent: '最近解锁',
    sort_name: '名称 A → Z',
    rarity_all: '全部稀有度',
    modal_close: '关闭',
    modal_unlocked: '已解锁',
    modal_locked: '未解锁',
    unlocked_label: '✓ 已解锁',
    modal_category: '分类',
    modal_progress: '进度',
    modal_no_desc: '暂无描述。',
    search_empty: '没有匹配的成就。',
    modal_hidden_desc: '成就详情已隐藏。',
    modal_hidden_reveal: '查看描述',
    modal_hidden_hide: '隐藏描述',
    guide_title: '从这里开始',
    guide_subtitle: '尝试解锁这些简单成就，迈出第一步。',
    guide_empty_title: '这里是空的。',
    guide_empty_text: '成就随着 agent 的工作逐步解锁，去试试吧！',
    no_timeline_guide: '成就解锁后会出现在这里。',
    first_visit_tip: '💡 浏览下方成就了解可以解锁什么。切换标签查看套装和时间线。',
    next_ach_title: '🎯 下一个目标',
    next_ach_progress: '{current}/{target}',
    profile_switch: '切换档案',
    profile_create: '+',
    profile_max: '最多3个档案',
    profile_name_placeholder: '新建档案...',
  },
};

const CATEGORY_NAMES = {
  en: {
    onboarding: 'Onboarding',
    milestones: 'Milestones',
    skill: 'Skill',
    style: 'Style',
    tool_mastery: 'Tool Mastery',
    workflow: 'Workflow',
    creator: 'Creator',
    hidden: 'Hidden',
    challenge: 'Challenge',
    community: 'Community',
  },
  zh: {
    onboarding: '入门',
    milestones: '里程碑',
    skill: '技能',
    style: '风格',
    tool_mastery: '工具精通',
    workflow: '工作流',
    creator: '创造者',
    hidden: '隐藏',
    challenge: '挑战',
    community: '社区',
  },
};

// Onboarding guide — easy entry-level achievements with how-to tips
const GUIDE_ITEMS = [
  { id: 'first_contact', tip_en: 'Just start chatting with your agent', tip_zh: '直接跟 agent 开始对话' },
  { id: 'tool_time', tip_en: 'Ask your agent to read or write a file', tip_zh: '让 agent 读取或编辑一个文件' },
  { id: 'first_shot', tip_en: 'Type a slash command like /help', tip_zh: '输入一个斜杠命令，比如 /help' },
  { id: 'dashboard_visitor', tip_en: "You're already here — open the Dashboard!", tip_zh: '你已经在这里了！打开 Dashboard 即解锁' },
  { id: 'model_hopper', tip_en: 'Switch models with /model', tip_zh: '用 /model 切换一次模型' },
  { id: 'read_manual', tip_en: 'Type /help to read the manual', tip_zh: '输入 /help 阅读手册' },
];

function t(key, replacements = {}) {
  let str = (I18N[currentLang] || I18N.en)[key] || I18N.en[key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

function displayCategory(catId) {
  const map = CATEGORY_NAMES[currentLang] || CATEGORY_NAMES.en;
  return map[catId] || catId;
}

function displayRarity(rarity) {
  return t(`rarity_${rarity}`);
}

function renderI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  document.documentElement.setAttribute('lang', currentLang === 'zh' ? 'zh-CN' : 'en');
}

// ── Data & State ──────────────────────────────────────

let dashboardData = null;
let currentFilter = 'all';
let currentCategory = null;
let currentSearch = '';
let currentSort = 'default';
let currentRarity = null;
let lastUnlockedIds = new Set();
let isModalOpen = false;
let controlsSetup = false;

// Current profile from URL or API response
let currentProfile = 'default';

/** Build API URL with current profile query param */
function apiUrl(path) {
  const sep = path.includes('?') ? '&' : '?';
  return currentProfile && currentProfile !== 'default'
    ? `${path}${sep}profile=${encodeURIComponent(currentProfile)}`
    : path;
}

// ── Icon render helper ─────────────────────────────────

/** Render achievement icon as emoji span or pixel-art img */
function iconHtml(icon, opts = {}) {
  const { size = 20, className = '' } = opts;
  // Image path (starts with /, has file extension)
  if (icon.startsWith('/') || /\.(png|svg|webp|jpg|gif)$/i.test(icon)) {
    const sizeStyle = `width:${size}px;height:${size}px;object-fit:contain`;
    return `<img src="${escAttr(icon)}" class="ach-icon-img ${className}" style="${sizeStyle}" alt="">`;
  }
  // Emoji / Unicode text
  return `<span class="ach-icon ${className}">${icon}</span>`;
}
let pickSlot = null;

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
const RARITY_LEVELS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function renderAll(data) {
  renderI18n();
  renderNav(data);
  renderProfile(data);
  renderFirstVisitTip(data);
  renderNextAchievement(data);
  renderOnboardingGuide(data);
  renderAchievements(data);
  renderSets(data);
  renderTimeline(data);
}

// ── Setup global listeners (once) ──────────────────────

function setupGlobalHandlers() {
  // Click on achievement grid → open modal (delegated)
  const grid = document.getElementById('achievement-grid');
  if (grid) {
    grid.addEventListener('click', e => {
      if (pickSlot !== null) return; // suppress during showcase pick
      if (isModalOpen) return;
      const card = e.target.closest('.ach-card');
      if (!card) return;
      const achId = card.dataset.id;
      if (!achId) return;
      const ach = dashboardData?.achievements.find(a => a.id === achId);
      if (ach) openModal(ach);
    });
  }

  // Keyboard: Escape to close modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isModalOpen) {
      closeModal();
    }
  });

  // Click backdrop to close modal
  document.addEventListener('click', e => {
    if (e.target.id === 'modal-backdrop') {
      closeModal();
    }
  });
}

(async function () {
  setupGlobalHandlers();

  // Read profile from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  currentProfile = urlParams.get('profile') || 'default';

  const res = await fetch(apiUrl('/api/data'));
  if (!res.ok) {
    document.body.innerHTML = `<div style="padding:40px;color:#888;">${t('load_error', { status: res.status })}</div>`;
    return;
  }
  const data = await res.json();
  dashboardData = data;
  // Sync profile from API response (authoritative)
  if (data.profile) currentProfile = data.profile;
  initLang(data.config?.lang);

  // Track initial unlocked IDs
  lastUnlockedIds = new Set(data.achievements.filter(a => a.unlocked).map(a => a.id));

  renderAll(data);

  // Toast for recently unlocked (within 5 min)
  const now = Date.now();
  data.timeline.forEach(t => {
    if (now - new Date(t.unlocked_at).getTime() < 300000) {
      const ach = data.achievements.find(a => a.id === t.id);
      if (ach) showToast(ach.icon, displayName(ach), ach.rarity);
    }
  });

  startAutoPoll();
})();

// ── Auto-Poll (10s) ───────────────────────────────────

function startAutoPoll() {
  setInterval(async () => {
    try {
      const res = await fetch(apiUrl('/api/data'));
      if (!res.ok) return;
      const newData = await res.json();

      const newUnlocked = new Set(
        newData.achievements.filter(a => a.unlocked).map(a => a.id)
      );

      // Genuinely new unlocks
      const freshIds = [...newUnlocked].filter(id => !lastUnlockedIds.has(id));
      lastUnlockedIds = newUnlocked;

      // Detect any stats change
      const oldUnlockedCount = dashboardData.stats?.unlocked || 0;
      const hasNewUnlocks = freshIds.length > 0;
      const statsChanged = JSON.stringify(dashboardData.stats) !== JSON.stringify(newData.stats);

      if (hasNewUnlocks || statsChanged) {
        dashboardData = newData;

        // Toast for new unlocks
        for (const id of freshIds) {
          const ach = newData.achievements.find(a => a.id === id);
          if (ach) showToast(ach.icon, displayName(ach), ach.rarity);
        }

        // Re-render only if modal isn't open
        if (!isModalOpen) {
          renderAll(newData);
        }
      }
    } catch {}
  }, 10000);
}

// ── Helpers ──────────────────────────────────────────

const RARITY_COLORS = {
  common: '#969696', uncommon: '#64C864', rare: '#4285F4',
  epic: '#B446F0', legendary: '#FF8C00', mythic: '#FF3232',
};
function rarityColor(r) { return RARITY_COLORS[r] || RARITY_COLORS.common; }

// ── Navigation ───────────────────────────────────────

function renderNav(data) {
  const navStats = document.getElementById('nav-stats');
  if (navStats) navStats.textContent = `${data.stats.unlocked}/${data.stats.total_achievements}`;

  renderProfileSelector(data);

  const links = document.querySelectorAll('.nav-link');
  const sections = ['profile', 'achievements', 'sets', 'timeline'];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active', l.dataset.section === e.target.id));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ── Profile Selector ─────────────────────────────────

function renderProfileSelector(data) {
  const profiles = data.profiles || [{ name: 'default', emoji: '📂' }];
  const active = data.profile || currentProfile || 'default';
  const activeMeta = profiles.find(p => p.name === active) || { name: active, emoji: active === 'default' ? '📂' : '👤' };
  const maxProfiles = data.max_profiles || 3;

  // Update nav button with profile emoji + name
  const display = document.getElementById('profile-name-display');
  if (display) display.textContent = active;

  const emojiEl = document.getElementById('profile-emoji');
  if (emojiEl) emojiEl.textContent = activeMeta.emoji || '📂';

  const list = document.getElementById('profile-list');
  if (!list) return;

  list.innerHTML = profiles.map(p => `
    <div class="profile-option ${p.name === active ? 'active' : ''}"
         onclick="switchProfile('${escAttr(p.name)}')">
      <span>${escHtml(p.emoji || '👤')} ${escHtml(p.name)}</span>
      ${p.name === active ? '<span class="profile-check">✓</span>' : ''}
    </div>
  `).join('');

  // Show/hide create section based on limit (named profiles only, excluding default)
  const createSection = document.getElementById('profile-create-section');
  const limitHint = document.getElementById('profile-limit-hint');
  if (createSection && limitHint) {
    const atLimit = profiles.length - 1 >= maxProfiles;
    createSection.style.display = atLimit ? 'none' : 'flex';
    limitHint.style.display = atLimit ? 'block' : 'none';
  }

  // Dev reset only for default profile
  const resetBtn = document.getElementById('dev-reset-btn');
  if (resetBtn) {
    resetBtn.style.display = active === 'default' ? '' : 'none';
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (!dropdown) return;
  const visible = dropdown.style.display !== 'none';
  dropdown.style.display = visible ? 'none' : 'block';
}

async function switchProfile(profileName) {
  // Persist choice to config.json so MCP server tracks to this profile
  try {
    await fetch('/api/profiles/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profileName }),
    });
  } catch { /* ignore, still navigate even if API fails */ }

  const url = new URL(window.location);
  url.searchParams.set('profile', profileName);
  window.location = url.toString();
}

// Profile-create emoji picker
const PROFILE_EMOJIS = ['🎮', '🕹️', '🎯', '🎲', '🎸', '🎨', '📚', '💻', '🚀', '🌟',
                        '🔥', '⚡', '🧠', '🛠️', '🏗️', '🔬', '🎭', '🗺️', '🌊', '🏆'];

let pendingProfileName = '';

function openProfileModal() {
  const input = document.getElementById('new-profile-input');
  const rawName = input?.value?.trim() || 'profile0';
  pendingProfileName = rawName;

  // Populate emoji grid
  const grid = document.getElementById('profile-emoji-grid');
  if (grid) {
    grid.innerHTML = PROFILE_EMOJIS.map((e, i) =>
      `<button class="profile-emoji-btn ${i === 0 ? 'selected' : ''}"
               data-emoji="${e}" onclick="selectProfileEmoji(this)">${e}</button>`
    ).join('');
  }

  // Set modal text
  const desc = document.getElementById('profile-modal-desc');
  if (desc) desc.textContent = `Create profile "${rawName}"? This action cannot be undone.`;

  const backdrop = document.getElementById('profile-modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('closing');
    backdrop.style.display = 'flex';
  }
}

function closeProfileModal() {
  const backdrop = document.getElementById('profile-modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.add('closing');
  setTimeout(() => {
    backdrop.style.display = 'none';
    backdrop.classList.remove('closing');
  }, 200);
}

function selectProfileEmoji(btn) {
  const grid = document.getElementById('profile-emoji-grid');
  if (grid) grid.querySelectorAll('.profile-emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function confirmCreateProfile() {
  const selected = document.querySelector('#profile-emoji-grid .profile-emoji-btn.selected');
  const emoji = selected?.dataset.emoji || '🎮';

  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pendingProfileName, emoji }),
    });
    if (res.ok) {
      const data = await res.json();
      closeProfileModal();
      switchProfile(data.name);
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to create profile');
      closeProfileModal();
    }
  } catch (e) {
    alert('Failed to create profile');
    closeProfileModal();
  }
}

function handleProfileInputKey(event) {
  if (event.key === 'Enter') openProfileModal();
}

// Close profile dropdown on outside click
document.addEventListener('click', (e) => {
  const selector = document.querySelector('.profile-selector');
  const dropdown = document.getElementById('profile-dropdown');
  if (selector && dropdown && !selector.contains(e.target) && dropdown.style.display !== 'none') {
    dropdown.style.display = 'none';
  }
});

// ── Showcase management ──────────────────────────────

async function startPick(slot) {
  if (pickSlot === slot) { cancelPick(); return; }
  pickSlot = slot;

  const slots = document.querySelectorAll('.showcase-slot');
  slots.forEach((el, i) => el.classList.toggle('picking', i === slot));

  const banner = document.getElementById('pick-banner');
  if (banner) {
    banner.style.display = 'flex';
    banner.querySelector('.pick-banner-text').textContent =
      t('pick_banner', { n: slot + 1 });
  }

  if (dashboardData) renderGrid(dashboardData);

  document.getElementById('achievements')?.scrollIntoView({ behavior: 'smooth' });
}

function cancelPick() {
  pickSlot = null;
  const slots = document.querySelectorAll('.showcase-slot');
  slots.forEach(el => el.classList.remove('picking'));
  const banner = document.getElementById('pick-banner');
  if (banner) banner.style.display = 'none';
  if (dashboardData) renderGrid(dashboardData);
}

async function pinToSlot(achId) {
  if (pickSlot === null) return;
  const res = await fetch('/api/showcase', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot: pickSlot, achievement_id: achId }),
  });
  if (!res.ok) return;
  await refreshData();
  pickSlot = null;
  const banner = document.getElementById('pick-banner');
  if (banner) banner.style.display = 'none';
}

async function clearSlot(slot) {
  if (pickSlot !== null) { cancelPick(); return; }
  const res = await fetch('/api/showcase', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  });
  if (!res.ok) return;
  await refreshData();
}

async function autoFillShowcase() {
  const res = await fetch('/api/showcase/auto', { method: 'POST' });
  if (!res.ok) return;
  await refreshData();
}

async function devReset() {
  const meta = document.querySelector('meta[name="dev-token"]');
  const token = meta?.getAttribute('content') || '';
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers: { 'x-dev-token': token },
  });
  if (!res.ok) return;
  const json = await res.json();
  dashboardData = json.data;
  lastUnlockedIds = new Set();
  renderAll(dashboardData);
}

async function refreshData() {
  const res = await fetch(apiUrl('/api/data'));
  if (!res.ok) return;
  dashboardData = await res.json();
  if (dashboardData.profile) currentProfile = dashboardData.profile;
  lastUnlockedIds = new Set(dashboardData.achievements.filter(a => a.unlocked).map(a => a.id));
  renderAll(dashboardData);
}

// ── Profile Hero ─────────────────────────────────────

function renderProfile(data) {
  const { stats } = data;

  const fill = document.getElementById('xp-bar-fill');
  const label = document.getElementById('xp-label');
  if (fill && label) {
    const pct = stats.xp_progress.target > 0
      ? (stats.xp_progress.current / stats.xp_progress.target) * 100
      : 0;
    fill.style.width = `${Math.min(pct, 100)}%`;
    label.textContent = t('xp_label', { xp: stats.total_xp.toLocaleString(), level: stats.level });
  }

  const showcase = document.getElementById('showcase');
  if (showcase) {
    showcase.innerHTML = stats.showcase.map(s => {
      if (s.achievement) {
        const nameDisplay = displayName(s.achievement);
        return `<div class="showcase-slot filled" data-rarity="${s.achievement.rarity}"
          title="${escHtml(nameDisplay)} — ${t('click_to_remove')}"
          onclick="clearSlot(${s.slot})">
          ${iconHtml(s.achievement.icon, { size: 28, className: 'showcase-slot-icon' })}
          <span class="showcase-slot-name">${escHtml(nameDisplay)}</span>
        </div>`;
      }
      return `<div class="showcase-slot empty"
        title="${t('click_to_pick')}"
        onclick="startPick(${s.slot})">+</div>`;
    }).join('');

    const autoBtn = document.getElementById('showcase-auto');
    if (autoBtn) {
      autoBtn.textContent = t('showcase_auto');
      autoBtn.title = t('showcase_auto_title');
      autoBtn.style.display = stats.unlocked > 0 ? 'inline' : 'none';
    }
  }

  const row = document.getElementById('stats-row');
  if (row) {
    const unlockedCount = data.achievements.filter(a => a.unlocked).length;
    const statItems = [
      { value: unlockedCount.toLocaleString(), label: t('stat_unlocked') },
      { value: stats.total_events.toLocaleString(), label: t('stat_events') },
      { value: String(stats.streak), label: t('stat_streak') },
      { value: `${stats.completion_pct}%`, label: t('stat_complete') },
    ];
    row.innerHTML = statItems.map(s => `
      <div class="stat-card">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');
  }

  const banner = document.getElementById('pick-banner');
  if (banner && pickSlot === null) banner.style.display = 'none';
}

// ── Onboarding Guide ─────────────────────────────────

function renderOnboardingGuide(data) {
  const section = document.getElementById('onboarding-guide');
  if (!section) return;

  if (data.stats.unlocked > 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  section.className = 'section onboarding-guide-section';

  // Title & subtitle
  const title = document.getElementById('guide-title');
  const subtitle = document.getElementById('guide-subtitle');
  if (title) title.textContent = t('guide_title');
  if (subtitle) subtitle.textContent = t('guide_subtitle');

  // Build guide items
  const items = document.getElementById('guide-items');
  if (!items) return;

  items.innerHTML = GUIDE_ITEMS.map(g => {
    const ach = data.achievements.find(a => a.id === g.id);
    if (!ach) return '';
    const name = displayName(ach);
    const tip = currentLang === 'zh' ? g.tip_zh : g.tip_en;
    return `<div class="guide-item">
      <span class="guide-item-icon">${escHtml(ach.icon)}</span>
      <div class="guide-item-body">
        <div class="guide-item-name">${escHtml(name)}</div>
        <div class="guide-item-tip">${escHtml(tip)}</div>
      </div>
      <span class="guide-item-arrow">→</span>
    </div>`;
  }).join('');
}

// ── First-visit tip (1-5 achievements) ──────────────

function renderFirstVisitTip(data) {
  const section = document.getElementById('first-visit-tip');
  if (!section) return;

  const unlocked = data.stats.unlocked;

  // Show only when 1-5 achievements unlocked and not dismissed
  if (unlocked < 1 || unlocked > 5 || localStorage.getItem('agpa-visit-tip-dismissed')) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
}

// Exposed to HTML onclick
function dismissVisitTip() {
  localStorage.setItem('agpa-visit-tip-dismissed', '1');
  const section = document.getElementById('first-visit-tip');
  if (section) section.style.display = 'none';
}

// ── Next achievement recommendation (1-10 unlocked) ──

function renderNextAchievement(data) {
  const card = document.getElementById('next-ach-card');
  if (!card) return;

  const unlocked = data.stats.unlocked;
  if (unlocked < 1 || unlocked > 10) {
    card.style.display = 'none';
    return;
  }

  // Find the locked achievement with highest progress ratio
  let best = null, bestRatio = -1;
  for (const ach of data.achievements) {
    if (ach.unlocked) continue;
    if (!ach.progress || ach.progress.target === 0) continue;
    const ratio = ach.progress.current / ach.progress.target;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = ach;
    }
  }

  if (!best || bestRatio <= 0) {
    card.style.display = 'none';
    return;
  }

  const name = displayName(best);
  const desc = currentLang === 'zh' ? (best.description_cn || best.description) : (best.description || '');
  const progressText = t('next_ach_progress', {
    current: best.progress.current,
    target: best.progress.target,
  });

  card.style.display = 'block';
  card.innerHTML = `
    <div class="next-ach-header">${t('next_ach_title')}</div>
    <div class="next-ach-body" onclick="scrollToAchievement(${JSON.stringify(best.id)})" title="${t('click_to_pick')}">
      <span class="next-ach-icon">${iconHtml(best.icon, { size: 22 })}</span>
      <div class="next-ach-info">
        <span class="next-ach-name">${escHtml(name)}</span>
        <span class="next-ach-desc">${escHtml(desc)}</span>
        <div class="next-ach-bar"><div class="next-ach-bar-fill" style="width:${Math.min(bestRatio * 100, 100)}%"></div></div>
        <span class="next-ach-pct">${progressText}</span>
      </div>
      <span class="next-ach-rarity">${escHtml(best.rarity)}</span>
    </div>
  `;
}

function scrollToAchievement(id) {
  // Switch to achievements tab if not active
  const achSection = document.getElementById('achievements');
  if (achSection) achSection.scrollIntoView({ behavior: 'smooth' });
  // Find and highlight the card
  setTimeout(() => {
    const card = document.querySelector(`.ach-card[data-id="${CSS.escape(id)}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.animation = 'none';
      card.offsetHeight; // trigger reflow
      card.style.animation = 'pulse-highlight .8s ease 2';
    }
  }, 300);
}

// ── Achievement Grid ────────────────────────────────

function renderAchievements(data) {
  // ── Controls setup (once) ──
  if (!controlsSetup) {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        currentSearch = searchInput.value.trim();
        if (searchClear) searchClear.style.display = currentSearch ? 'flex' : 'none';
        renderGrid(data);
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) { searchInput.value = ''; currentSearch = ''; }
        searchClear.style.display = 'none';
        renderGrid(data);
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        renderGrid(data);
      });
    }

    controlsSetup = true;
  }

  // ── Update search placeholder (i18n) ──
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = t('search_placeholder');

  // ── Populate sort options (i18n) ──
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.innerHTML = `
      <option value="default" ${currentSort === 'default' ? 'selected' : ''}>${t('sort_default')}</option>
      <option value="rarity" ${currentSort === 'rarity' ? 'selected' : ''}>${t('sort_rarity')}</option>
      <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>${t('sort_recent')}</option>
      <option value="name" ${currentSort === 'name' ? 'selected' : ''}>${t('sort_name')}</option>
    `;
  }

  // ── Category nav ──
  const catNav = document.getElementById('category-nav');
  if (catNav) {
    const cats = [...new Set(data.achievements.map(a => a.category))];
    catNav.innerHTML = `<button class="category-pill ${!currentCategory ? 'active' : ''}" data-cat="">${t('cat_all')}</button>` +
      cats.map(c => `<button class="category-pill ${currentCategory === c ? 'active' : ''}" data-cat="${c}">${displayCategory(c)}</button>`).join('');
    catNav.addEventListener('click', e => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;
      catNav.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.cat || null;
      renderGrid(data);
    });
  }

  // ── Rarity nav ──
  const rarityNav = document.getElementById('rarity-nav');
  if (rarityNav) {
    rarityNav.innerHTML = `<button class="rarity-pill ${!currentRarity ? 'active' : ''}" data-rarity="">${t('rarity_all')}</button>` +
      RARITY_LEVELS.map(r => `<button class="rarity-pill ${currentRarity === r ? 'active' : ''}" data-rarity="${r}">${displayRarity(r)}</button>`).join('');
    rarityNav.addEventListener('click', e => {
      const pill = e.target.closest('.rarity-pill');
      if (!pill) return;
      rarityNav.querySelectorAll('.rarity-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentRarity = pill.dataset.rarity || null;
      renderGrid(data);
    });
  }

  // ── Filter tabs ──
  const filterTabs = document.getElementById('filter-tabs');
  if (filterTabs) {
    filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
      const key = tab.dataset.filter === 'all' ? 'filter_all' : tab.dataset.filter === 'unlocked' ? 'filter_unlocked' : 'filter_locked';
      tab.textContent = t(key);
    });
    filterTabs.addEventListener('click', e => {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;
      filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderGrid(data);
    });
  }

  renderGrid(data);
}

function renderGrid(data) {
  const grid = document.getElementById('achievement-grid');
  if (!grid) return;

  let items = data.achievements;

  // Step 1: Filter by unlock state
  if (currentFilter === 'unlocked') items = items.filter(a => a.unlocked);
  else if (currentFilter === 'locked') items = items.filter(a => !a.unlocked);

  // Step 2: Filter by category
  if (currentCategory) items = items.filter(a => a.category === currentCategory);

  // Step 3: Filter by search query
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    items = items.filter(a =>
      a.id.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.name_cn || '').toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      (a.description_cn || '').toLowerCase().includes(q)
    );
  }

  // Step 4: Filter by rarity
  if (currentRarity) {
    items = items.filter(a => a.rarity === currentRarity);
  }

  // Step 5: Sort
  if (currentSort !== 'default') {
    const sorted = [...items];
    switch (currentSort) {
      case 'rarity':
        sorted.sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
        break;
      case 'recent':
        sorted.sort((a, b) => {
          if (a.unlocked && !b.unlocked) return -1;
          if (!a.unlocked && b.unlocked) return 1;
          if (a.unlocked && b.unlocked) {
            return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
          }
          return 0;
        });
        break;
      case 'name':
        sorted.sort((a, b) => displayName(a).localeCompare(displayName(b)));
        break;
    }
    items = sorted;
  }

  const inPickMode = pickSlot !== null;
  grid.className = inPickMode ? 'achievement-grid picking' : 'achievement-grid';

  // ── Empty state ──
  if (items.length === 0) {
    grid.innerHTML = `<div class="search-empty">
      <div class="search-empty-icon">${currentSearch ? '🔍' : '🏆'}</div>
      <div class="search-empty-text">${currentSearch ? t('search_empty') : '—'}</div>
    </div>`;
    return;
  }

  grid.innerHTML = items.map((a, idx) => {
    const locked = !a.unlocked;
    const showIcon = locked && a.hidden ? '\u{1F512}' : a.icon;
    const progressPct = a.progress && a.progress.target > 0
      ? Math.min((a.progress.current / a.progress.target) * 100, 100)
      : 0;
    const progressText = a.progress && a.progress.target > 0
      ? `${a.progress.current}/${a.progress.target}`
      : '';
    const progressHtml = a.progress && a.progress.target > 0
      ? `<div class="ach-progress"><div class="ach-progress-fill" style="width:${progressPct}%"></div><span class="ach-progress-text">${progressText}</span></div>`
      : '';
    const hiddenHint = locked && a.hidden ? `<div class="ach-hidden-hint">${t('hidden_hint')}</div>` : '';
    const nameDisplay = locked && a.hidden ? '???' : displayName(a);

    const pinBtn = inPickMode && !locked
      ? `<div class="ach-pin" onclick="event.stopPropagation(); pinToSlot('${escAttr(a.id)}')" title="${t('pin_title')}">📌</div>`
      : '';

    const unlockedLabel = !locked ? `<span class="ach-unlocked-label">${t('unlocked_label')}</span>` : '';

    const pickableClass = inPickMode && !locked ? ' pickable' : '';
    const lockedClass = locked ? ' locked' : '';

    const cardColor = locked ? '' : `--card-color:var(--rarity-${a.rarity});`;
    return `<div class="ach-card${lockedClass}${pickableClass}" data-rarity="${a.rarity}" data-id="${escAttr(a.id)}" style="${cardColor}--delay:${idx * 30}ms">
      <div class="ach-stripe"></div>
      ${pinBtn}
      <div class="ach-icon-wrap">${iconHtml(showIcon)}</div>
      <div class="ach-name">${escHtml(nameDisplay)}</div>
      ${unlockedLabel}
      <span class="ach-rarity-badge">${displayRarity(a.rarity)}</span>
      ${progressHtml}
      ${hiddenHint}
    </div>`;
  }).join('');
}

// ── Modal ────────────────────────────────────────────

function openModal(ach) {
  isModalOpen = true;
  const backdrop = document.getElementById('modal-backdrop');
  const container = document.getElementById('modal-container');
  if (!backdrop || !container) return;

  // Remove any closing animation state
  backdrop.classList.remove('closing');

  const locked = !ach.unlocked;
  const rarityColor = `var(--rarity-${ach.rarity})`;

  const name = currentLang === 'zh'
    ? (ach.name_cn || ach.name)
    : (ach.name || ach.name_cn || '');
  const desc = currentLang === 'zh'
    ? (ach.description_cn || ach.description || t('modal_no_desc'))
    : (ach.description || ach.description_cn || t('modal_no_desc'));

  let bottomSections = '';
  if (locked && ach.progress && ach.progress.target > 0) {
    const pct = Math.min((ach.progress.current / ach.progress.target) * 100, 100);
    bottomSections += `
      <div class="modal-divider"></div>
      <div class="modal-progress-section">
        <div class="modal-progress-label">${t('modal_progress')}</div>
        <div class="modal-progress-bar">
          <div class="modal-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="modal-progress-text">${ach.progress.current} / ${ach.progress.target}</div>
      </div>`;
  }

  if (ach.unlocked && ach.unlocked_at) {
    const date = new Date(ach.unlocked_at);
    const dateStr = date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    bottomSections += `
      <div class="modal-divider"></div>
      <div class="modal-unlock-info">
        ${t('modal_unlocked')}: <span class="modal-unlock-date">${dateStr}</span>
      </div>`;
  }

  // Build innerHTML and set card-color in one synchronous block,
  // THEN restart the animation from a clean frame for both locked & unlocked.
  container.innerHTML = `
    <div class="modal-header">
      <span class="modal-icon-wrap">${iconHtml(locked && ach.hidden ? '\u{1F512}' : ach.icon, { size: 48, className: 'modal-icon' })}</span>
      <button class="modal-close" onclick="closeModal()" title="${t('modal_close')}">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title"${locked ? '' : ` style="--card-color:${rarityColor}"`}>${escHtml(name)}</div>
        ${locked ? `<span class="modal-status locked">${t('modal_locked')}</span>` : `<span class="modal-status unlocked" style="color:${rarityColor}">${t('modal_unlocked')}</span>`}
      </div>
      <div class="modal-meta">
        <span class="modal-badge rarity-${ach.rarity}">${displayRarity(ach.rarity)}</span>
        <span class="modal-badge category">${displayCategory(ach.category)}</span>
      </div>
      ${locked && ach.hidden ? `
      <div class="modal-hidden-section">
        <div class="modal-hidden-placeholder">
          <span class="modal-hidden-icon">🔒</span>
          <p class="modal-hidden-text">${t('modal_hidden_desc')}</p>
          <button class="modal-hidden-toggle" onclick="toggleHiddenDesc(event)" data-reveal="${t('modal_hidden_reveal')}" data-hide="${t('modal_hidden_hide')}">${t('modal_hidden_reveal')}</button>
        </div>
        <div class="modal-hidden-desc" style="display:none">${escHtml(desc)}</div>
      </div>
      ` : `
      <div class="modal-desc">${escHtml(desc)}</div>
      `}
      ${bottomSections}
    </div>`;

  // Apply card-color for unlocked glow — after innerHTML so it never
  // interferes with layout during the DOM swap.
  if (!locked) {
    container.style.setProperty('--card-color', rarityColor);
  } else {
    container.style.removeProperty('--card-color');
  }

  backdrop.style.display = 'flex';

  // Restart the pop-in animation on the next frame so it always starts
  // from a clean state — identical timing for locked and unlocked cards.
  container.style.animation = 'none';
  requestAnimationFrame(() => {
    // Force the browser to apply animation:none before re-enabling
    container.offsetHeight;
    container.style.animation = '';
  });
}

function toggleHiddenDesc(e) {
  e.stopPropagation();
  const btn = e.target.closest('.modal-hidden-toggle');
  if (!btn) return;
  const section = btn.closest('.modal-hidden-section');
  const placeholder = section.querySelector('.modal-hidden-placeholder');
  const desc = section.querySelector('.modal-hidden-desc');
  const hidden = placeholder.style.display !== 'none';
  if (hidden) {
    placeholder.style.display = 'none';
    desc.style.display = 'block';
    btn.textContent = btn.dataset.hide;
  } else {
    placeholder.style.display = '';
    desc.style.display = 'none';
    btn.textContent = btn.dataset.reveal;
  }
}

function closeModal() {
  isModalOpen = false;
  const backdrop = document.getElementById('modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.add('closing');
  // Match CSS exit animation duration (250ms)
  setTimeout(() => {
    backdrop.style.display = 'none';
    backdrop.classList.remove('closing');
  }, 250);
}

// ── Sets ─────────────────────────────────────────────

function renderSets(data) {
  const grid = document.getElementById('sets-grid');
  if (!grid) return;

  if (!data.sets || data.sets.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-dim);">${t('no_sets')}</p>`;
    return;
  }

  grid.innerHTML = data.sets.map(set => {
    const pct = set.total > 0 ? (set.completed / set.total) * 100 : 0;
    const highestRarity = set.achievements.reduce((best, a) => {
      const order = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
      return (order[a.rarity] || 0) > (order[best] || 0) ? a.rarity : best;
    }, 'common');

    const membersHtml = set.achievements.map(a =>
      `<div class="set-member ${a.unlocked ? 'unlocked' : 'locked'}" title="${escHtml(displayName(a))}">${iconHtml(a.unlocked ? a.icon : '?', { size: 16 })}</div>`
    ).join('');

    const complete = set.completed === set.total && set.total > 0;
    const rewardHtml = complete && set.reward && set.reward.value
      ? `<div class="set-reward" data-type="${escHtml(set.reward.type)}">${escHtml(set.reward.value)}</div>`
      : '';

    return `<div class="set-card ${complete ? 'complete' : ''}">
      <div class="set-header">
        ${iconHtml(set.achievements.find(a => a.unlocked)?.icon || '\u{1F4E6}', { size: 24 })}
        <span class="set-name">${escHtml(currentLang === 'zh' && set.name_cn ? set.name_cn : set.name)}</span>
      </div>
      <div class="set-count">${set.completed}/${set.total}</div>
      <div class="set-bar">
        <div class="set-bar-fill" style="width:${pct}%;background:${rarityColor(highestRarity)}"></div>
      </div>
      <div class="set-members">${membersHtml}</div>
      ${rewardHtml}
    </div>`;
  }).join('');
}

// ── Timeline ─────────────────────────────────────────

function renderTimeline(data) {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  if (!data.timeline || data.timeline.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim);">${t('no_timeline')}</p>`;
    return;
  }

  list.innerHTML = data.timeline.map(t => {
    const ach = data.achievements.find(a => a.id === t.id);
    if (!ach) return '';
    const date = new Date(t.unlocked_at);
    const timeStr = date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return `<div class="timeline-entry" data-rarity="${ach.rarity}">
      <div class="tl-time">${timeStr}</div>
      <div class="tl-ach">
        ${iconHtml(ach.icon, { size: 18, className: 'tl-icon' })}
        <span class="tl-name" style="color:${rarityColor(ach.rarity)}">${escHtml(displayName(ach))}</span>
      </div>
    </div>`;
  }).filter(Boolean).join('');
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

// ── Toast ────────────────────────────────────────────

function showToast(icon, name, rarity) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${iconHtml(icon, { size: 22, className: 'toast-icon' })}<span class="toast-text" style="color:${rarityColor(rarity)}">${escHtml(name)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
