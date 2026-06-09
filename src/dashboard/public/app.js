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
  // Swap nav logo to match theme
  const logo = document.getElementById('nav-logo');
  if (logo) {
    logo.src = theme === 'dark' ? '/agpa-logo-dark-24.png' : '/agpa-logo-light-24.png';
  }
}

initTheme();

// ── Ambient Particles ───────────────────────────────────

function initAmbientParticles() {
  let container = document.getElementById('bg-particles');
  if (!container) {
    container = document.createElement('div');
    container.id = 'bg-particles';
    // Insert as first child of body so it stays behind content
    document.body.insertBefore(container, document.body.firstChild);
  }
  // Clear old particles
  container.innerHTML = '';
  const count = Math.min(30, Math.floor(window.innerWidth / 40));
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'bg-particle';
    const size = 1.5 + Math.random() * 3;
    dot.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      background:${['rgba(79,195,247,0.4)','rgba(168,88,240,0.35)','rgba(245,184,0,0.3)','rgba(240,64,80,0.25)'][Math.floor(Math.random() * 4)]};
      opacity:0;
      transition: opacity 2s ease;
    `;
    container.appendChild(dot);
    // Stagger reveal
    setTimeout(() => { dot.style.opacity = (0.2 + Math.random() * 0.5).toString(); }, i * 120);
  }
}

function updateAmbientIntensity(data) {
  const total = data.achievements ? data.achievements.length : 1;
  const unlocked = data.achievements ? data.achievements.filter(a => a.unlocked).length : 0;
  const pct = Math.min(unlocked / total, 1);
  // Map: 0% → 0.3, 50% → 0.55, 100% → 0.9
  const intensity = 0.3 + pct * 0.6;
  document.documentElement.style.setProperty('--ambient-intensity', String(intensity));
}

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('change', toggleTheme);
  // Sync logo to initial theme (handles saved "light" preference)
  const logo = document.getElementById('nav-logo');
  if (logo) {
    const t = document.documentElement.getAttribute('data-theme');
    logo.src = t === 'dark' ? '/agpa-logo-dark-24.png' : '/agpa-logo-light-24.png';
  }
  initLangPicker();
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('change', toggleSound);
    // Load initial state from server
    loadSoundState(soundToggle);
  }
  const animToggle = document.getElementById('anim-toggle');
  if (animToggle) {
    animToggle.addEventListener('change', toggleAnimations);
    loadAnimState(animToggle);
  }
});

// ── Language ────────────────────────────────────────────

let currentLang = 'en';

function initLang(configLang) {
  const saved = localStorage.getItem('agpa-lang');
  currentLang = saved || configLang || 'en';
  syncLangPicker();
}

function syncLangPicker() {
  const trigger = document.getElementById('lang-trigger');
  if (!trigger) return;

  // Update trigger display
  const globe = trigger.querySelector('.lang-globe');
  const code = trigger.querySelector('.lang-code');
  if (currentLang === 'zh') {
    if (globe) globe.textContent = '🌐';
    if (code) code.textContent = '中文';
  } else {
    if (globe) globe.textContent = '🌐';
    if (code) code.textContent = 'EN';
  }

  // Update active option
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.value === currentLang);
    opt.setAttribute('aria-selected', opt.dataset.value === currentLang ? 'true' : 'false');
  });
}

function toggleLang() {
  // stub — kept for backward compat, actual switching via pickLang()
}

function pickLang(value) {
  if (value === currentLang) return;
  currentLang = value;
  localStorage.setItem('agpa-lang', currentLang);
  syncLangPicker();
  if (dashboardData) renderAll(dashboardData);
}

// ── Lang picker dropdown ─────────────────────────────────

function initLangPicker() {
  const trigger = document.getElementById('lang-trigger');
  const dropdown = document.getElementById('lang-dropdown');
  if (!trigger || !dropdown) return;

  // Toggle open/close
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeLangPicker();
    } else {
      openLangPicker();
    }
  });

  // Option clicks
  dropdown.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      pickLang(opt.dataset.value);
      closeLangPicker();
    });
    // Keyboard: Enter/Space to select
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickLang(opt.dataset.value);
        closeLangPicker();
        trigger.focus();
      }
      if (e.key === 'Escape') {
        closeLangPicker();
        trigger.focus();
      }
    });
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('lang-picker');
    if (picker && !picker.contains(e.target)) {
      closeLangPicker();
    }
  });

  // Keyboard: Escape on trigger
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLangPicker();
    }
    if (e.key === 'ArrowDown' && trigger.getAttribute('aria-expanded') !== 'true') {
      e.preventDefault();
      openLangPicker();
      const first = dropdown.querySelector('.lang-option');
      if (first) first.focus();
    }
  });
}

function openLangPicker() {
  const trigger = document.getElementById('lang-trigger');
  const dropdown = document.getElementById('lang-dropdown');
  if (!trigger || !dropdown) return;
  trigger.setAttribute('aria-expanded', 'true');
  dropdown.classList.add('open');
}

function closeLangPicker() {
  const trigger = document.getElementById('lang-trigger');
  const dropdown = document.getElementById('lang-dropdown');
  if (!trigger) return;
  trigger.setAttribute('aria-expanded', 'false');
  if (dropdown) dropdown.classList.remove('open');
}

// ── Sort picker ──────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'default', icon: '📋' },
  { value: 'rarity',  icon: '💎' },
  { value: 'recent',  icon: '🕐' },
  { value: 'name',    icon: '🔤' },
];

function initSortPicker(data) {
  const trigger = document.getElementById('sort-trigger');
  const dropdown = document.getElementById('sort-dropdown');
  if (!trigger || !dropdown) return;

  // Toggle open/close
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    if (isOpen) closeSortPicker(); else openSortPicker();
  });

  // Option clicks — delegated
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.sort-option');
    if (!opt) return;
    currentSort = opt.dataset.value;
    syncSortPicker();
    closeSortPicker();
    if (data || dashboardData) renderGrid(data || dashboardData);
  });

  // Keyboard
  dropdown.addEventListener('keydown', (e) => {
    const opt = e.target.closest('.sort-option');
    if (!opt) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      currentSort = opt.dataset.value;
      syncSortPicker();
      closeSortPicker();
      trigger.focus();
      if (dashboardData) renderGrid(dashboardData);
    }
    if (e.key === 'Escape') { closeSortPicker(); trigger.focus(); }
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSortPicker();
    if (e.key === 'ArrowDown' && trigger.getAttribute('aria-expanded') !== 'true') {
      e.preventDefault();
      openSortPicker();
      const first = dropdown.querySelector('.sort-option');
      if (first) first.focus();
    }
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('sort-picker');
    if (picker && !picker.contains(e.target)) closeSortPicker();
  });
}

function populateSortPicker() {
  const dropdown = document.getElementById('sort-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = SORT_OPTIONS.map(opt =>
    `<div class="sort-option${currentSort === opt.value ? ' active' : ''}" role="option" data-value="${opt.value}" tabindex="0">
      <span class="sort-opt-icon">${opt.icon}</span>
      <span class="sort-opt-label">${t('sort_' + opt.value)}</span>
    </div>`
  ).join('');
  syncSortPicker();
}

function syncSortPicker() {
  const trigger = document.getElementById('sort-trigger');
  const label = document.getElementById('sort-label');
  if (!trigger || !label) return;

  const opt = SORT_OPTIONS.find(o => o.value === currentSort) || SORT_OPTIONS[0];
  if (label) label.textContent = t('sort_' + currentSort);

  document.querySelectorAll('#sort-dropdown .sort-option').forEach(el => {
    el.classList.toggle('active', el.dataset.value === currentSort);
    el.setAttribute('aria-selected', el.dataset.value === currentSort ? 'true' : 'false');
  });
}

function openSortPicker() {
  const trigger = document.getElementById('sort-trigger');
  const dropdown = document.getElementById('sort-dropdown');
  if (!trigger || !dropdown) return;
  trigger.setAttribute('aria-expanded', 'true');
  dropdown.classList.add('open');
}

function closeSortPicker() {
  const trigger = document.getElementById('sort-trigger');
  const dropdown = document.getElementById('sort-dropdown');
  if (!trigger) return;
  trigger.setAttribute('aria-expanded', 'false');
  if (dropdown) dropdown.classList.remove('open');
}

// ── Sound Toggle ───────────────────────────────────────

async function toggleSound() {
  const toggle = document.getElementById('sound-toggle');
  if (!toggle) return;
  const enabled = toggle.checked;
  try {
    await fetch('/api/config/sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sound_enabled: enabled }),
    });
  } catch {
    // Revert on failure
    toggle.checked = !enabled;
  }
}

async function loadSoundState(toggle) {
  try {
    const res = await fetch('/api/config/sound');
    if (res.ok) {
      const data = await res.json();
      toggle.checked = data.sound_enabled;
    }
  } catch { /* use default (checked) */ }
}

// ── Animation Toggle ────────────────────────────────────

function syncSimpleAnim(enabled) {
  if (enabled) {
    document.body.setAttribute('data-simple-anim', 'true');
  } else {
    document.body.removeAttribute('data-simple-anim');
  }
}

async function toggleAnimations() {
  const toggle = document.getElementById('anim-toggle');
  if (!toggle) return;
  const enabled = toggle.checked;
  try {
    await fetch('/api/config/animations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simple_animations: !enabled }),
    });
    syncSimpleAnim(!enabled);
  } catch {
    toggle.checked = !enabled;
  }
}

async function loadAnimState(toggle) {
  try {
    const res = await fetch('/api/config/animations');
    if (res.ok) {
      const data = await res.json();
      // checked = full animations (toggle ON), unchecked = simple
      const simple = data.simple_animations;
      toggle.checked = !simple;
      syncSimpleAnim(simple);
    }
  } catch { /* use default (checked) */ }
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
    hero_title: 'Agent Player Achievements',
    xp_label: '{xp} XP • Level {level}',
    streak_title: 'Coding Streak',
    streak_days: 'days',
    streak_best: 'Best',
    streak_today_done: 'Coded today ✓',
    streak_today_pending: 'Not yet today',
    stat_level: 'Level',
    stat_xp: 'XP',
    stat_unlocked: 'Unlocked',

    stat_streak: 'Day Streak',
    stat_complete: 'Complete',
    stat_events: 'Events',
    heatmap_title: 'Activity',
    heatmap_less: 'Less',
    heatmap_more: 'More',
    stat_complete: 'Complete',
    filter_all: 'All',
    filter_unlocked: 'Unlocked',
    filter_locked: 'Locked',
    cat_all: 'All',
    pick_cancel: '✕ Cancel',
    pick_banner: 'Pick an achievement for slot {n}',
    click_to_remove: 'click to remove',
    click_to_pick: 'Click to pick an achievement',
    showcase_title: 'Showcase',
    showcase_sub: 'Pick your 6 best',
    showcase_auto: '⚡',
    showcase_auto_title: 'Auto-fill with rarest',
    no_sets: 'No achievement sets defined.',
    nav_insights: 'Insights',
    section_insights: 'Insights',
    no_timeline: 'No achievements unlocked yet.',
    load_error: 'Failed to load dashboard data: {status}',
    insight_sessions: 'Daily Sessions',
    insight_tools: 'Daily Tool Calls',
    insight_tasks: 'Daily Tasks',
    insight_heatmap: 'Coding Hours',
    insight_nodata: 'Not enough data yet — keep coding!',
    milestone_tenth: '🏅 10 achievements unlocked!',
    milestone_fiftieth: '🎖️ 50 achievements unlocked!',
    milestone_hundredth: '👑 100 achievements unlocked!',
    milestone_first_mythic: '💫 First Mythic achievement!',
    milestone_set: '🎯 Set complete: {name}',
    tl_sameday: 'on the same day',
    hidden_hint: '\u{1F512} Hidden',
    hero_titles_label: 'Titles',
    hero_badges_label: 'Badges',
    hero_no_titles_badges: 'No titles or badges yet — keep vibing on your coding journey!',
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
    modal_replay: 'Replay',
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
    profile_demo: '🔬 Demo Data (try it out)',
    profile_max: 'Max 3 profiles',
    profile_name_placeholder: 'New profile...',
    share_card: '📸 Share',
    export_data: '📦 Export',
    section_badges: '🏅 Badges',
    no_badges: 'No badges yet — complete sets to earn them.',
    title_tooltip: 'From set: {set}',
    badge_unlocked: '✓ {completed}/{total}',
    tools_hint: '💡 Use "agpa profile softwares" in your terminal to change which tools are tracked.',
  },
  zh: {
    nav_profile: '个人主页',
    nav_achievements: '成就',
    nav_sets: '套装',
    nav_timeline: '时间线',
    nav_insights: '洞察',
    section_achievements: '成就',
    section_sets: '套装',
    section_timeline: '时间线',
    section_insights: '洞察',
    hero_title: 'Agent 玩家成就',
    xp_label: '{xp} XP • {level} 级',
    streak_title: '编码连胜',
    streak_days: '天',
    streak_best: '最高纪录',
    streak_today_done: '今天已编码 ✓',
    streak_today_pending: '今天还没写代码',
    stat_level: '等级',
    stat_xp: '经验',
    stat_unlocked: '已解锁',

    stat_streak: '连续天数',
    stat_complete: '完成度',
    stat_events: '总事件',
    heatmap_title: '活动热力图',
    heatmap_less: '少',
    heatmap_more: '多',
    filter_all: '全部',
    filter_unlocked: '已解锁',
    filter_locked: '未解锁',
    cat_all: '全部',
    pick_cancel: '✕ 取消',
    pick_banner: '为第 {n} 格选择成就',
    click_to_remove: '点击移除',
    click_to_pick: '点击选择成就',
    showcase_title: '展示柜',
    showcase_sub: '挑选6个最佳成就',
    showcase_auto: '⚡',
    showcase_auto_title: '自动填充(最稀有)',
    no_sets: '暂无套装定义。',
    no_timeline: '还没有解锁任何成就。',
    load_error: '加载仪表盘数据失败: {status}',
    insight_sessions: '每日会话',
    insight_tools: '每日工具调用',
    insight_tasks: '每日任务',
    insight_heatmap: '编码时段',
    insight_nodata: '数据不足——继续写代码吧！',
    milestone_tenth: '🏅 解锁 10 个成就！',
    milestone_fiftieth: '🎖️ 解锁 50 个成就！',
    milestone_hundredth: '👑 解锁 100 个成就！',
    milestone_first_mythic: '💫 首个神话级成就！',
    milestone_set: '🎯 套装完成: {name}',
    tl_sameday: '同一天',
    hidden_hint: '\u{1F512} 隐藏成就',
    hero_titles_label: '称号',
    hero_badges_label: '徽章',
    hero_no_titles_badges: '还没有获得称号和徽章哦，继续你的 Vibe Coding 旅程吧！',
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
    modal_replay: '重播',
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
    profile_demo: '🔬 Demo 数据（试用体验）',
    profile_max: '最多3个档案',
    profile_name_placeholder: '新建档案...',
    share_card: '📸 分享',
    export_data: '📦 导出',
    section_badges: '🏅 徽章',
    no_badges: '暂无徽章——完成套装来获取。',
    title_tooltip: '来自套装：{set}',
    badge_unlocked: '✓ {completed}/{total}',
    tools_hint: '💡 在终端中使用 "agpa profile softwares" 来更改要追踪的工具。',
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
  return `${path}${sep}profile=${encodeURIComponent(currentProfile)}`;
}

// ── Icon render helper ─────────────────────────────────

// ── Pixel Art Renderer (browser) ─────────────────────────

var PixelArtRenderer = (function() {
  function charToIndex(ch) { return parseInt(ch, 36); }

  function toDataURI(pa, cellSize) {
    cellSize = cellSize || 2;
    var data = pa.data, palette = pa.palette;
    var h = data.length, w = data[0] ? data[0].length : 0;
    var vw = w * cellSize, vh = h * cellSize;
    var rects = '';
    for (var y = 0; y < h; y++) {
      var row = data[y];
      for (var x = 0; x < w; x++) {
        var idx = charToIndex(row[x]);
        if (idx === 0) continue;
        var c = palette[idx];
        if (!c || c === '⬛') continue; // ⬛ transparent marker
        rects += '<rect x="' + (x * cellSize) + '" y="' + (y * cellSize) + '" width="' + cellSize + '" height="' + cellSize + '" fill="' + c + '"/>';
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vw + ' ' + vh + '" width="' + vw + '" height="' + vh + '" shape-rendering="crispEdges">' + rects + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function toSVGRaw(pa, cellSize) {
    cellSize = cellSize || 2;
    var data = pa.data, palette = pa.palette;
    var h = data.length, w = data[0] ? data[0].length : 0;
    var vw = w * cellSize, vh = h * cellSize;
    var rects = '';
    for (var y = 0; y < h; y++) {
      var row = data[y];
      for (var x = 0; x < w; x++) {
        var idx = charToIndex(row[x]);
        if (idx === 0) continue;
        var c = palette[idx];
        if (!c || c === '⬛') continue;
        rects += '<rect x="' + (x * cellSize) + '" y="' + (y * cellSize) + '" width="' + cellSize + '" height="' + cellSize + '" fill="' + c + '"/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vw + ' ' + vh + '" shape-rendering="crispEdges">' + rects + '</svg>';
  }

  return { toDataURI: toDataURI, toSVGRaw: toSVGRaw };
})();

/** Render achievement icon as emoji span, pixel-art img, or file-path img */
function iconHtml(icon, opts = {}) {
  const { size = 20, className = '', pixelArt } = opts;

  // Pixel art data → inline SVG image (takes priority)
  if (pixelArt && pixelArt.palette && pixelArt.data) {
    const cellSize = Math.max(2, Math.round(size / 24)); // scale to ~target size
    const svg = PixelArtRenderer.toDataURI(pixelArt, cellSize);
    const sizeStyle = `width:${size}px;height:${size}px;object-fit:contain`;
    return `<img src="${escAttr(svg)}" class="ach-icon-pixel ${className}" style="${sizeStyle}" alt="">`;
  }

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

// ── Error Boundary ──────────────────────────────────────

let renderErrors = [];

function renderSafe(name, fn) {
  try { fn(); } catch (e) {
    console.error(`[AGPA] render "${name}" failed:`, e);
    renderErrors.push({ name, message: e.message || String(e) });
    showErrorBanner();
  }
}

function showErrorBanner() {
  const banner = document.getElementById('error-banner');
  const msg = document.getElementById('error-banner-msg');
  if (!banner || !msg) return;
  msg.textContent = renderErrors.length === 1
    ? renderErrors[0].name + ': ' + renderErrors[0].message
    : renderErrors.length + ' sections failed to render. Check console for details.';
  banner.style.display = 'flex';
}

function dismissErrors() {
  renderErrors = [];
  const banner = document.getElementById('error-banner');
  if (banner) banner.style.display = 'none';
}

function renderAll(data) {
  renderErrors = [];
  renderSafe('i18n', () => renderI18n());
  renderSafe('nav', () => renderNav(data));
  renderSafe('demo-banner', () => renderDemoBanner(data));
  renderSafe('profile', () => renderProfile(data));
  renderSafe('visit-tip', () => renderFirstVisitTip(data));
  renderSafe('onboarding', () => renderOnboardingGuide(data));
  renderSafe('achievements', () => renderAchievements(data));
  renderSafe('sets', () => renderSets(data));
  renderSafe('badges', () => renderBadges(data));
  renderSafe('timeline', () => renderTimeline(data));
  renderSafe('insights', () => renderInsights(data));
}

// ── Setup global listeners (once) ──────────────────────

function setupGlobalHandlers() {
  // Click on achievement grid → open modal (delegated)
  const grid = document.getElementById('achievement-grid');
  if (grid) {
    grid.addEventListener('click', e => {
      if (pickSlot !== null) return; // suppress during showcase pick
      if (isModalOpen) return;

      // Click ripple
      const card = e.target.closest('.ach-card');
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ripple = document.createElement('span');
        ripple.className = 'ach-ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        card.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      }

      const achId = card?.dataset.id;
      if (!achId) return;
      const ach = dashboardData?.achievements.find(a => a.id === achId);
      if (ach) openModal(ach);
    });

    // 3D tilt on card hover — inline style to override animation
    let tiltRAF = null;
    grid.addEventListener('mousemove', e => {
      if (tiltRAF) return;
      tiltRAF = requestAnimationFrame(() => {
        tiltRAF = null;
        const card = e.target.closest('.ach-card');
        if (!card || card.classList.contains('locked')) return;
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rx = (y - 0.5) * -12;
        const ry = (x - 0.5) * 12;
        card.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-3px)';
      });
    });
    grid.addEventListener('mouseleave', () => {
      const cards = grid.querySelectorAll('.ach-card');
      for (const c of cards) {
        c.style.transform = '';
      }
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
    // Delegated: replay gacha button in modal
    if (e.target.closest('.modal-replay-btn')) {
      const btn = e.target.closest('.modal-replay-btn');
      const achId = btn.dataset.achId;
      if (achId) replayGacha(achId);
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

  // Ambient background effects
  initAmbientParticles();
  updateAmbientIntensity(data);

  // Gacha reveal for recently unlocked (within 5 min)
  const now = Date.now();
  const recentAchs = [];
  data.timeline.forEach(t => {
    if (now - new Date(t.unlocked_at).getTime() < 300000) {
      const ach = data.achievements.find(a => a.id === t.id);
      if (ach) recentAchs.push(ach);
    }
  });
  if (recentAchs.length > 0) {
    window.gachaQueue.enqueue(recentAchs);
  }

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
        updateAmbientIntensity(newData);
        // Gacha reveal for new unlocks
        const freshAchs = [];
        for (const id of freshIds) {
          const ach = newData.achievements.find(a => a.id === id);
          if (ach) freshAchs.push(ach);
        }

        if (freshAchs.length > 0) {
          triggerHeroBurst();
          window.gachaQueue.enqueue(freshAchs, {
            onDrain: function() {
              if (!isModalOpen) renderAll(newData);
            },
          });
        } else {
          // No gacha (stats-only change), render immediately
          if (!isModalOpen) renderAll(newData);
        }
      }
    } catch {}
  }, 10000);
}

// ── Helpers ──────────────────────────────────────────

function triggerHeroBurst() {
  const hero = document.querySelector('.hero-section');
  if (!hero) return;
  const burst = document.createElement('div');
  burst.className = 'hero-burst';
  hero.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove());
}

const RARITY_COLORS = {
  common: '#969696', uncommon: '#64C864', rare: '#4285F4',
  epic: '#B446F0', legendary: '#FF8C00', mythic: '#FF3232',
};
function rarityColor(r) { return RARITY_COLORS[r] || RARITY_COLORS.common; }

// Bridge for gacha-reveal.js sound sync (respects sound toggle state)
window.__playAchievementSound = function(rarity) {
  var toggle = document.getElementById('sound-toggle');
  if (toggle && !toggle.checked) return;
  // Sound plays server-side via notification system; the gacha visual
  // sync uses this as a timing anchor. The sound effect itself is
  // triggered by the server's notification (poll), so we just ensure
  // the sound toggle state is respected at the flip moment.
};

// ── Navigation ───────────────────────────────────────

function renderNav(data) {
  renderProfileSelector(data);
  renderTrackedTools(data);

  // Demo badge visibility
  const demoBadge = document.getElementById('demo-badge');
  if (demoBadge) {
    demoBadge.style.display = data.is_demo ? 'inline-block' : 'none';
  }

  const links = document.querySelectorAll('.nav-link');
  const sections = ['profile', 'achievements', 'sets', 'timeline', 'insights'];
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
  const isDemo = data.is_demo;
  const hasDemo = data.has_demo;
  const activeMeta = profiles.find(p => p.name === active) || { name: active, emoji: active === '_demo' ? '🔬' : active === 'default' ? '📂' : '👤' };
  const maxProfiles = data.max_profiles || 3;

  // Update nav button
  const display = document.getElementById('profile-name-display');
  if (display) display.textContent = active === '_demo' ? 'Demo' : active;

  const emojiEl = document.getElementById('profile-emoji');
  if (emojiEl) emojiEl.textContent = active === '_demo' ? '🔬' : (activeMeta.emoji || '📂');

  // Preserve create-input value across re-renders
  const existingInput = document.getElementById('new-profile-input');
  const savedInputValue = existingInput ? existingInput.value : '';

  const list = document.getElementById('profile-list');
  if (!list) return;

  // Build profile options
  let options = '';
  const demoLabel = t('profile_demo');
  if (hasDemo && !isDemo) {
    options += `<div class="profile-option" onclick="event.stopPropagation();switchProfile('_demo')">
      <span>${escHtml(demoLabel)}</span>
    </div>
    <div class="profile-option-sep"></div>`;
  } else if (isDemo) {
    options += `<div class="profile-option active" onclick="event.stopPropagation();switchProfile('_demo')">
      <span>${escHtml(demoLabel)}</span>
      <span class="profile-check">✓</span>
    </div>
    <div class="profile-option-sep"></div>`;
  }
  options += profiles.map(p => `
    <div class="profile-option ${p.name === active ? 'active' : ''}"
         onclick="event.stopPropagation();switchProfile('${escAttr(p.name)}')">
      <span>${escHtml(p.emoji || '👤')} ${escHtml(p.name)}</span>
      ${p.name === active ? '<span class="profile-check">✓</span>' : ''}
    </div>
  `).join('');

  // Only rebuild list content if it actually changed (avoid flicker on auto-poll)
  if (list.innerHTML !== options) {
    list.innerHTML = options;
  }

  // Show/hide create section
  const createSection = document.getElementById('profile-create-section');
  const limitHint = document.getElementById('profile-limit-hint');
  if (createSection && limitHint) {
    const atLimit = profiles.length - 1 >= maxProfiles;
    createSection.style.display = atLimit ? 'none' : 'flex';
    limitHint.style.display = atLimit ? 'block' : 'none';
  }

  // Restore create-input value (the input element is outside #profile-list so it survives)
  if (existingInput && existingInput !== document.activeElement) {
    existingInput.value = savedInputValue;
  }
}

// ── Tracked Tools Badges ─────────────────────────────

// Official logos served from /tool-logos/
const TOOL_META = {
  'claude-code': { logo: '/tool-logos/claude-code.png', class: 'tool-claude-code' },
  'kilo-code':   { logo: '/tool-logos/kilocode.png',    class: 'tool-kilo-code' },
  'hermes':      { logo: '/tool-logos/hermes.png',      class: 'tool-hermes' },
  'opencode':    { logo: '/tool-logos/opencode.png',    class: 'tool-opencode' },
  'openclaw':    { logo: '/tool-logos/openclaw.svg',    class: 'tool-openclaw' },
};

function renderTrackedTools(data) {
  const bar = document.getElementById('tracked-tools-bar');
  if (!bar) return;

  const active = data.profile || currentProfile || 'default';
  const profiles = data.profiles || [];
  const activeProfile = profiles.find(p => p.name === active);
  const tracked = activeProfile?.tracked_tools || [];
  const allTracked = active === 'default' && (!tracked || tracked.length === 0)
    ? Object.keys(TOOL_META) // default profile with no explicit list → show all
    : tracked;

  if (!allTracked || allTracked.length === 0) {
    bar.style.display = 'none';
    return;
  }

  const toolNames = {
    'claude-code': 'Claude Code',
    'kilo-code': 'Kilo Code',
    'hermes': 'Hermes Agent',
    'opencode': 'OpenCode',
    'openclaw': 'OpenClaw',
  };

  bar.style.display = '';
  bar.style.cursor = 'pointer';
  bar.onclick = () => showHintToast(t('tools_hint'));
  bar.innerHTML = allTracked.map(id => {
    const meta = TOOL_META[id];
    const name = toolNames[id] || id;
    if (!meta) return '';
    const imgTag = meta.logo.endsWith('.svg')
      ? `<img src="${escAttr(meta.logo)}" alt="${escHtml(name)}" class="tool-logo-svg" loading="lazy">`
      : `<img src="${escAttr(meta.logo)}" alt="${escHtml(name)}" class="tool-logo-png" loading="lazy">`;
    return `<span class="tracked-tool-badge ${meta.class}" title="${escHtml(name)}">
      <span class="tool-icon">${imgTag}</span>
      <span class="tool-name">${escHtml(name)}</span>
    </span>`;
  }).join('');
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('open');
}

function closeProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

// Close profile dropdown on outside click (delegated)
document.addEventListener('click', (e) => {
  const selector = document.querySelector('.profile-selector');
  const dropdown = document.getElementById('profile-dropdown');
  if (selector && dropdown && !selector.contains(e.target) && dropdown.classList.contains('open')) {
    closeProfileDropdown();
  }
});

async function switchProfile(profileName) {
  closeProfileDropdown();

  // _demo is a read-only system profile — don't persist as active
  if (profileName !== '_demo') {
    try {
      await fetch('/api/profiles/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileName }),
      });
    } catch { /* ignore, still navigate even if API fails */ }
  }

  const url = new URL(window.location);
  url.searchParams.set('profile', profileName);
  // Remove hash to avoid anchoring into a section on the new profile
  url.hash = '';
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

async function refreshData() {
  const res = await fetch(apiUrl('/api/data'));
  if (!res.ok) return;
  dashboardData = await res.json();
  if (dashboardData.profile) currentProfile = dashboardData.profile;
  lastUnlockedIds = new Set(dashboardData.achievements.filter(a => a.unlocked).map(a => a.id));
  renderAll(dashboardData);
}

// ── Profile Hero ─────────────────────────────────────

function renderStreakCard(streak) {
  const card = document.getElementById('streak-card');
  if (!card) return;

  const currentEl = document.getElementById('streak-current');
  const longestEl = document.getElementById('streak-longest');
  const todayEl = document.getElementById('streak-today');

  if (!streak || (streak.current === 0 && !streak.today_active)) {
    card.style.display = 'none';
    return;
  }

  card.style.display = '';
  if (currentEl) currentEl.textContent = streak.current;
  if (longestEl) longestEl.textContent = streak.longest;

  if (todayEl) {
    if (streak.today_active) {
      todayEl.textContent = t('streak_today_done');
      todayEl.className = 'streak-today active';
    } else {
      todayEl.textContent = t('streak_today_pending');
      todayEl.className = 'streak-today idle';
    }
  }
}

function renderHeatmap(heatmap) {
  const card = document.getElementById('heatmap-card');
  const grid = document.getElementById('heatmap-grid');
  const colLabels = document.getElementById('heatmap-col-labels');
  const rowLabels = document.getElementById('heatmap-row-labels');
  if (!card || !grid || !heatmap || !heatmap.days || heatmap.days.length === 0) {
    if (card) card.style.display = 'none';
    return;
  }
  card.style.display = '';

  const days = heatmap.days;
  // Find the first Monday in the data to pad front with empty cells
  const firstDate = new Date(days[0].date);
  const startDow = firstDate.getDay(); // 0=Sun, 1=Mon...
  // Pad so grid starts on Monday (day=1); if first day is Sunday(0), pad 6; Monday(1), pad 0
  const frontPad = startDow === 0 ? 6 : startDow - 1;

  // Row labels: show Mon/Wed/Fri
  const ROW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  rowLabels.innerHTML = ROW_LABELS.map(l => `<span>${l}</span>`).join('');

  // Build column labels (month names at first column of each month)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const colLabelSpans = [];
  // Collect week boundaries
  const weeks = [];
  let weekStart = frontPad > 0 ? -frontPad : 0;
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i].date);
    const dow = d.getDay(); // 0=Sun
    if (dow === 1 || i === 0) {
      // Start of week (Monday) — record month
      colLabelSpans.push({ idx: weeks.length, month: months[d.getMonth()], label: months[d.getMonth()] });
    }
    if (dow === 0) {
      weeks.push(i - weekStart + 1);
      weekStart = i + 1;
    }
  }

  // Deduplicate adjacent month labels
  const deduped = [];
  for (const cl of colLabelSpans) {
    const last = deduped[deduped.length - 1];
    if (!last || last.month !== cl.month) deduped.push(cl);
  }

  const totalColumns = Math.ceil((frontPad + days.length) / 7);
  colLabels.innerHTML = Array.from({ length: totalColumns }, (_, i) => {
    const match = deduped.find(cl => cl.idx === i);
    return `<span class="heatmap-col-label">${match ? match.label : ''}</span>`;
  }).join('');

  // Build cells
  const cells = [];
  // Front pad empty cells
  for (let i = 0; i < frontPad; i++) {
    cells.push('<div class="heatmap-cell" data-level="0"></div>');
  }
  // Date cells
  for (const d of days) {
    const dStr = d.date.slice(5); // "06-04"
    const tooltip = `${dStr} · ${d.count} session${d.count !== 1 ? 's' : ''}`;
    cells.push(`<div class="heatmap-cell" data-level="${d.level}" data-tooltip="${escHtml(tooltip)}"></div>`);
  }
  grid.style.gridTemplateColumns = `repeat(${totalColumns}, 14px)`;
  grid.innerHTML = cells.join('');

  // Scroll to right edge (most recent)
  const scrollEl = card.querySelector('.heatmap-scroll');
  if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
}

function renderProfile(data) {
  const { stats } = data;

  renderStreakCard(stats.streak);
  renderHeatmap(stats.heatmap);
  renderTitlesRow(data);

  // ── Titles & Badges (from completed set rewards) ──
  {
    const completedSets = (data.sets || []).filter(s => s.completed > 0 && s.completed === s.total && s.reward?.value);
    const titles = completedSets.filter(s => s.reward.type === 'title').map(s => s.reward.value);
    const badges = completedSets.filter(s => s.reward.type === 'badge').map(s => s.reward.value);

    const titlesRow = document.getElementById('hero-titles-row');
    const badgesRow = document.getElementById('hero-badges-row');

    if (!titles.length && !badges.length) {
      // Empty state — single friendly nudge
      if (titlesRow) {
        titlesRow.className = 'hero-titles-row hero-empty-hint';
        titlesRow.innerHTML = `<span class="hero-empty-msg">${t('hero_no_titles_badges')}</span>`;
        titlesRow.style.display = '';
      }
      if (badgesRow) badgesRow.style.display = 'none';
    } else {
      if (titlesRow) {
        titlesRow.className = 'hero-titles-row';
        if (titles.length) {
          titlesRow.innerHTML = `<span class="hero-section-label titles-label">${t('hero_titles_label')}</span>` +
            titles.map(t => `<span class="hero-title-pill">${escHtml(t)}</span>`).join('<span class="hero-title-sep">·</span>');
          titlesRow.style.display = '';
        } else {
          titlesRow.style.display = 'none';
        }
      }

      if (badgesRow) {
        if (badges.length) {
          badgesRow.innerHTML = `<span class="hero-section-label badges-label">${t('hero_badges_label')}</span>` +
            badges.map(b => `<span class="hero-badge">${escHtml(b)}</span>`).join('');
          badgesRow.style.display = '';
        } else {
          badgesRow.style.display = 'none';
        }
      }
    }
  }

  const showcase = document.getElementById('showcase');
  if (showcase) {
    showcase.innerHTML = stats.showcase.map(s => {
      if (s.achievement) {
        const nameDisplay = displayName(s.achievement);
        return `<div class="showcase-slot filled" data-rarity="${s.achievement.rarity}"
          title="${escHtml(nameDisplay)} — ${t('click_to_remove')}"
          onclick="clearSlot(${s.slot})">
          ${iconHtml(s.achievement.icon, { size: 32, className: 'showcase-slot-icon', pixelArt: s.achievement.pixel_art_48 })}
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
    const totalXp = stats.total_xp || 0;
    const lvl = stats.level || 1;

    // 5 numeric stats (all plain counter-animate, no ring)
    const statItems = [
      { raw: lvl, label: t('stat_level'), prefix: '', suffix: '' },
      { raw: totalXp, label: t('stat_xp'), prefix: '', suffix: '' },
      { raw: unlockedCount, label: t('stat_unlocked'), prefix: '', suffix: '' },
      { raw: stats.completion_pct, label: t('stat_complete'), prefix: '', suffix: '%' },
      { raw: (stats.total_events || 0), label: t('stat_events'), prefix: '', suffix: '' },
    ];

    row.innerHTML = statItems.map((s) => {
      return `<div class="stat-big">
        <div class="stat-big-value counter-value" data-target="${s.raw}" data-prefix="${s.prefix}" data-suffix="${s.suffix}">0</div>
        <div class="stat-big-label">${s.label}</div>
      </div>`;
    }).join('');

    triggerCounters();
  }

  const banner = document.getElementById('pick-banner');
  if (banner && pickSlot === null) banner.style.display = 'none';
}

// ── Onboarding Guide ─────────────────────────────────

function renderOnboardingGuide(data) {
  const section = document.getElementById('onboarding-guide');
  if (!section) return;

  // Demo mode has its own banner+tour; suppress onboarding guide + first-visit-tip
  if (data.is_demo || data.stats.unlocked > 0) {
    section.style.display = 'none';
    // Also suppress first-visit-tip
    const visitTip = document.getElementById('first-visit-tip');
    if (visitTip) visitTip.style.display = 'none';
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

  // Show only when 1-5 achievements unlocked, not in demo mode, and not dismissed
  if (data.is_demo || unlocked < 1 || unlocked > 5 || localStorage.getItem('agpa-visit-tip-dismissed')) {
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

// ── Demo Banner ──────────────────────────────────────

function renderDemoBanner(data) {
  const banner = document.getElementById('demo-banner');
  if (!banner) return;

  if (!data.is_demo) {
    banner.style.display = 'none';
    return;
  }

  if (localStorage.getItem('agpa-demo-banner-dismissed')) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'block';
}

function dismissDemoBanner() {
  localStorage.setItem('agpa-demo-banner-dismissed', '1');
  const banner = document.getElementById('demo-banner');
  if (banner) {
    banner.style.transition = 'opacity .3s, transform .3s';
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-8px)';
    setTimeout(function() { banner.style.display = 'none'; }, 300);
  }
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

    initSortPicker(data);

    controlsSetup = true;
  }

  // ── Update search placeholder (i18n) ──
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = t('search_placeholder');

  // ── Populate sort options (i18n) ──
  populateSortPicker();

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
    const showPixelArt = locked && a.hidden ? undefined : a.pixel_art_48;
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
    const demoClass = (dashboardData?.is_demo && !locked) ? ' demo-unlocked' : '';

    const cardColor = locked ? '' : `--card-color:var(--rarity-${a.rarity});`;
    const cornerOrnament = !locked && (a.rarity === 'mythic') ? '<span class="ach-corner-mythic">✦</span>' : '';
    return `<div class="ach-card${lockedClass}${pickableClass}${demoClass}" data-rarity="${a.rarity}" data-id="${escAttr(a.id)}" style="${cardColor}--delay:${idx * 30}ms">
      <div class="ach-stripe"></div>
      ${cornerOrnament}
      ${pinBtn}
      <div class="ach-icon-wrap">${iconHtml(showIcon, { pixelArt: showPixelArt })}</div>
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
  const rarityHex = RARITY_COLORS[ach.rarity] || '#666';

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
      <div class="modal-unlock-row">
        <span class="modal-unlock-date">${t('modal_unlocked')}: ${dateStr}</span>
        <button class="modal-replay-btn" data-ach-id="${escHtml(ach.id)}" title="${escHtml(t('modal_replay'))}">🎴 ${escHtml(t('modal_replay'))}</button>
      </div>`;
  }

  // Build innerHTML and set card-color in one synchronous block,
  // THEN restart the animation from a clean frame for both locked & unlocked.
  container.innerHTML = `
    <div class="modal-header">
      <span class="modal-icon-wrap">${iconHtml(locked && ach.hidden ? '\u{1F512}' : ach.icon, { size: 48, className: 'modal-icon', pixelArt: locked && ach.hidden ? undefined : ach.pixel_art_48 })}</span>
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

  // Apply card-color for unlocked glow + rarity top bar — after innerHTML
  if (!locked) {
    container.style.setProperty('--card-color', rarityColor);
  } else {
    container.style.removeProperty('--card-color');
  }
  container.style.setProperty('--modal-rarity-color', rarityHex);

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

function replayGacha(achId) {
  if (!window.gachaQueue || !dashboardData) return;
  const ach = dashboardData.achievements.find(a => a.id === achId);
  if (!ach) return;
  closeModal();
  // Wait briefly for modal to close, then play
  setTimeout(function() {
    window.gachaQueue.enqueue([ach], { noAutoDismiss: true });
  }, 200);
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
    grid.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📦</span><div class="empty-state-text">${t('no_sets')}</div></div>`;
    return;
  }

  grid.innerHTML = data.sets.map(set => {
    const pct = set.total > 0 ? (set.completed / set.total) * 100 : 0;
    const highestRarity = set.achievements.reduce((best, a) => {
      const order = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
      return (order[a.rarity] || 0) > (order[best] || 0) ? a.rarity : best;
    }, 'common');

    const membersHtml = set.achievements.map(a =>
      `<div class="set-member ${a.unlocked ? 'unlocked' : 'locked'}" title="${escHtml(displayName(a))}">${iconHtml(a.unlocked ? a.icon : '?', { size: 16, pixelArt: a.unlocked ? a.pixel_art_48 : undefined })}</div>`
    ).join('');

    const complete = set.completed === set.total && set.total > 0;
    const rewardHtml = complete && set.reward && set.reward.value
      ? `<div class="set-reward" data-type="${escHtml(set.reward.type)}">${escHtml(set.reward.value)}</div>`
      : '';

    return `<div class="set-card ${complete ? 'complete' : ''}">
      <div class="set-header">
        ${iconHtml(set.achievements.find(a => a.unlocked)?.icon || '\u{1F4E6}', { size: 24, pixelArt: set.achievements.find(a => a.unlocked)?.pixel_art_48 })}
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

// ── Titles Row ────────────────────────────────────────

function renderTitlesRow(data) {
  const row = document.getElementById('titles-row');
  if (!row) return;

  const titles = data.titles || [];
  if (titles.length === 0) {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'flex';
  row.innerHTML = titles.map(t => {
    const setName = currentLang === 'zh' && t.set_name_cn ? t.set_name_cn : t.set_name;
    return `<span class="title-pill" data-rarity="${t.rarity}" title="${t('title_tooltip', { set: setName })}">
      ${iconHtml(t.icon, { size: 16 })} ${escHtml(t.title)}
    </span>`;
  }).join('');
}

// ── Badges Section ─────────────────────────────────────

function renderBadges(data) {
  const section = document.getElementById('badges');
  const grid = document.getElementById('badges-grid');
  if (!section || !grid) return;

  const badges = data.badges || [];
  if (badges.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  grid.innerHTML = badges.map(b => {
    const setName = currentLang === 'zh' && b.set_name_cn ? b.set_name_cn : b.set_name;
    const unlockedLabel = t('badge_unlocked', { completed: b.completed, total: b.total });
    return `<div class="badge-card">
      <div class="badge-icon">${iconHtml(b.icon, { size: 36 })}</div>
      <div class="badge-badge">${escHtml(b.badge)}</div>
      <div class="badge-set-name">${escHtml(setName)}</div>
      <div class="badge-progress">${unlockedLabel}</div>
    </div>`;
  }).join('');
}

// ── Timeline ─────────────────────────────────────────

function renderTimeline(data) {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  if (!data.timeline || data.timeline.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📅</span><div class="empty-state-text">${t('no_timeline')}</div></div>`;
    return;
  }

  // Resolve each entry chronologically (oldest first)
  const chrono = data.timeline
    .map(t => ({ ach: data.achievements.find(a => a.id === t.id), unlocked_at: t.unlocked_at }))
    .filter(e => e.ach)
    .sort((a, b) => a.unlocked_at.localeCompare(b.unlocked_at));

  // Build milestone map: key = unlocked_at timestamp → [labels]
  const milestoneMap = {};
  const announcedSets = new Set();
  let count = 0, mythicSeen = false;
  for (const e of chrono) {
    count++;
    // Count-based: only fire once at exact threshold
    if (count === 10 || count === 50 || count === 100) {
      (milestoneMap[e.unlocked_at] ||= []).push(
        count === 10 ? t('milestone_tenth') : count === 50 ? t('milestone_fiftieth') : t('milestone_hundredth')
      );
    }
    // First mythic: only once
    if (!mythicSeen && e.ach.rarity === 'mythic') {
      mythicSeen = true;
      (milestoneMap[e.unlocked_at] ||= []).push(t('milestone_first_mythic'));
    }
    // Set completion: only once per set globally
    if (e.ach.set_id && data.sets && !announcedSets.has(e.ach.set_id)) {
      const set = data.sets.find(s => s.id === e.ach.set_id);
      if (set && set.completed === set.total) {
        announcedSets.add(e.ach.set_id);
        (milestoneMap[e.unlocked_at] ||= []).push(
          (t('milestone_set') || 'Set: {name}').replace('{name}', displayName(set))
        );
      }
    }
  }

  // Group chronologically by day
  const groups = [];
  for (const e of chrono) {
    const day = e.unlocked_at.slice(0, 10);
    let last = groups[groups.length - 1];
    if (!last || last.day !== day) {
      last = { day, dateStr: e.unlocked_at, items: [], milestones: [] };
      groups.push(last);
    }
    last.items.push(e);
    // Collect milestones from this exact timestamp
    if (milestoneMap[e.unlocked_at]) {
      last.milestones.push(...milestoneMap[e.unlocked_at]);
    }
    // Deduplicate per group
    last.milestones = [...new Set(last.milestones)];
  }

  // Reverse: newest first
  groups.reverse();

  list.innerHTML = groups.map(g => {
    const d = new Date(g.dateStr);
    const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const itemsHtml = g.items.map((e, idx) => {
      const achRarity = e.ach.rarity || 'common';
      const achColor = rarityColor(achRarity);
      const nameHtml = escHtml(displayName(e.ach));
      const iconHtmlStr = iconHtml(e.ach.icon, { size: 16, pixelArt: e.ach.pixel_art_48 });
      return `<div class="tl-ach-card" data-rarity="${achRarity}" style="--tl-delay:${idx * 60}ms">
        <div class="tl-ach-card-strip" style="background:${achColor}"></div>
        <div class="tl-ach-card-icon">${iconHtmlStr}</div>
        <div class="tl-ach-card-body">
          <div class="tl-ach-card-name" style="color:${achColor}">${nameHtml}</div>
        </div>
        <span class="tl-ach-card-rarity" style="color:${achColor}">${displayRarity(achRarity)}</span>
      </div>`;
    }).join('');
    const sameDayTag = g.items.length > 1 ? `<div class="tl-sameday">${t('tl_sameday')}</div>` : '';
    const milestonesHtml = g.milestones.map(m => `<div class="tl-milestone">${m}</div>`).join('');

    const bestRarity = g.items.reduce((best, e) => {
      const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
      return (order[e.ach.rarity] || 0) > (order[best] || 0) ? e.ach.rarity : best;
    }, 'common');

    return `<div class="timeline-entry" data-rarity="${bestRarity}">
      <div class="tl-date-badge"><span class="tl-date-badge-icon">📅</span>${escHtml(dateLabel)}</div>
      ${itemsHtml}${sameDayTag}
      ${milestonesHtml}
    </div>`;
  }).join('');
}


// ── Insights ──────────────────────────────────────────

function renderInsights(data) {
  const daily = data.stats?.daily_stats;
  if (!daily || daily.length < 2) {
    for (const id of ['chart-sessions', 'chart-tools', 'chart-tasks', 'chart-heatmap']) {
      const canvas = document.getElementById(id);
      if (canvas) {
        setupRetinaCanvas(canvas);
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const W = canvas.clientWidth || canvas.width / dpr;
        const H = canvas.clientHeight || canvas.height / dpr;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(128,128,128,0.5)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('insight_nodata'), W / 2, H / 2);
      }
    }
    return;
  }

  drawLineChart('chart-sessions', daily, 'sessions', '#4fc3f7', t('insight_sessions'));
  drawLineChart('chart-tools', daily, 'tool_calls', '#81c784', t('insight_tools'));
  drawLineChart('chart-tasks', daily, 'tasks', '#ffb74d', t('insight_tasks'));
  drawTimeHeatmap('chart-heatmap', data);
}

// ── Retina Canvas Helper ──────────────────────────────

function setupRetinaCanvas(canvas) {
  if (!canvas || canvas._retinaReady) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || parseInt(canvas.getAttribute('width')) || 560;
  const origW = parseInt(canvas.getAttribute('width')) || 560;
  const origH = parseInt(canvas.getAttribute('height')) || 160;
  const cssH = cssW * (origH / origW);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas._retinaReady = true;
}

function drawLineChart(canvasId, daily, field, color, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  setupRetinaCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = canvas.clientWidth || canvas.width / dpr;
  const H = canvas.clientHeight || canvas.height / dpr;
  const pad = { top: 12, right: 16, bottom: 24, left: 32 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const max = Math.max(...daily.map(d => d[field] || 0), 1);
  const pts = daily.map((d, i) => ({
    x: pad.left + (i / Math.max(daily.length - 1, 1)) * pw,
    y: pad.top + ph - ((d[field] || 0) / max) * ph,
    val: d[field] || 0,
    date: d.date,
  }));

  canvas._chartData = { daily, field, color, label, pts, max, pad, W, H, pw, ph };

  // ── Static grid + labels ──
  function drawStatic() {
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (ph / 3) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
      if (i < 3) {
        ctx.fillStyle = 'rgba(128,128,128,0.5)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - (max / 3) * i), pad.left - 6, y + 3);
      }
    }
    ctx.fillStyle = 'rgba(128,128,128,0.6)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < daily.length; i += Math.max(Math.floor(daily.length / 6), 1)) {
      ctx.fillText(daily[i].date.slice(5), pts[i].x, H - 4);
    }
  }

  // ── Partial line + area up to `count` points ──
  function drawPartialLine(count) {
    const visible = pts.slice(0, count);
    if (visible.length < 2) return;
    // Area fill
    ctx.beginPath();
    ctx.moveTo(visible[0].x, pad.top + ph);
    for (const p of visible) ctx.lineTo(p.x, p.y);
    ctx.lineTo(visible[visible.length - 1].x, pad.top + ph);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad;
    ctx.fill();
    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < visible.length; i++) {
      i === 0 ? ctx.moveTo(visible[i].x, visible[i].y) : ctx.lineTo(visible[i].x, visible[i].y);
    }
    ctx.stroke();
  }

  // ── Full redraw with hover highlight ──
  canvas._redraw = function(hoverIdx) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawStatic();
    drawPartialLine(pts.length);

    if (hoverIdx != null && hoverIdx >= 0 && hoverIdx < pts.length) {
      const hp = pts[hoverIdx];
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();

      const dateLabel = hp.date.slice(5);
      const text = `${dateLabel}  ${hp.val}`;
      ctx.font = 'bold 11px monospace';
      const tw = ctx.measureText(text).width + 14;
      const th = 22;
      let tx = hp.x - tw / 2;
      let ty = hp.y - th - 10;
      if (tx < pad.left) tx = pad.left;
      if (tx + tw > pad.left + pw) tx = pad.left + pw - tw;
      if (ty < pad.top) ty = hp.y + 10;
      ctx.fillStyle = 'rgba(20,20,30,0.92)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath(); roundRect(ctx, tx, ty, tw, th, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(text, tx + tw / 2, ty + 15);
    }
    ctx.restore();
  };

  function setupHover() {
    canvas.onmousemove = function(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let closestIdx = -1, closestDist = 30;
      for (let i = 0; i < pts.length; i++) {
        const dist = Math.abs(pts[i].x - mx);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      }
      canvas._redraw(closestIdx);
    };
    canvas.onmouseleave = function() { canvas._redraw(); };
  }

  // ── First draw: animate line left-to-right ──
  if (!canvas._animated) {
    canvas._animated = true;
    const totalFrames = Math.min(pts.length * 2, 40);
    let frame = 0;
    function animTick() {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const drawCount = Math.max(2, Math.floor(eased * (pts.length - 1)) + 1);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawStatic();
      drawPartialLine(drawCount);
      ctx.restore();
      if (frame < totalFrames) {
        requestAnimationFrame(animTick);
      } else {
        canvas._redraw();
        setupHover();
      }
    }
    animTick();
  } else {
    canvas._redraw();
    setupHover();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

function drawTimeHeatmap(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  setupRetinaCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = canvas.clientWidth || canvas.width / dpr;
  const H = canvas.clientHeight || canvas.height / dpr;
  const pad = { top: 8, right: 8, bottom: 4, left: 32 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom - 24;

  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  const daily = data.stats?.daily_stats;
  let hasData = false;

  if (daily && daily.length > 0) {
    for (const d of daily) {
      const dow = new Date(d.date + 'T12:00:00Z').getDay();
      if (d.sessions > 0) {
        hasData = true;
        for (let h = 9; h <= 18; h++) {
          grid[dow][h] += d.sessions;
        }
      }
    }
  }

  if (!hasData) {
    ctx.fillStyle = 'rgba(128,128,128,0.5)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('insight_nodata'), W / 2, H / 2);
    return;
  }

  const cellW = pw / 24;
  const cellH = ph / 7;
  const levels = [0.1, 0.3, 0.6, 1.0];

  for (let day = 0; day < 7; day++) {
    for (let h = 0; h < 24; h++) {
      const intensity = 1 > 0 ? Math.min(grid[day][h] / 1, 1) : 0;
      let fill = 'rgba(128,128,128,0.06)';
      if (intensity > levels[3]) fill = 'rgba(79,195,247,0.7)';
      else if (intensity > levels[2]) fill = 'rgba(79,195,247,0.45)';
      else if (intensity > levels[1]) fill = 'rgba(79,195,247,0.25)';
      else if (intensity > levels[0]) fill = 'rgba(79,195,247,0.1)';

      const x = pad.left + h * cellW;
      const y = pad.top + day * cellH;
      ctx.fillStyle = fill;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  ctx.fillStyle = 'rgba(128,128,128,0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let d = 0; d < 7; d++) {
    ctx.fillText(days[d], pad.left - 6, pad.top + d * cellH + cellH / 2 + 3);
  }

  ctx.textAlign = 'center';
  for (let h = 0; h < 24; h += 3) {
    ctx.fillText(h + 'h', pad.left + h * cellW + cellW / 2, pad.top + ph + 16);
  }
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

function showHintToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Dedupe: don't stack identical hints
  if (container.querySelector('.hint-toast')) return;

  const toast = document.createElement('div');
  toast.className = 'toast hint-toast';
  toast.innerHTML = `<span class="toast-text">${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Counter animation ──────────────────────────────

let _countersInitialized = false;

function animateValue(el, start, end, duration, prefix, suffix) {
  prefix = prefix || '';
  suffix = suffix || '';
  var startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    var current = Math.round(eased * (end - start) + start);
    el.textContent = prefix + current.toLocaleString() + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = prefix + end.toLocaleString() + suffix;
    }
  }
  requestAnimationFrame(step);
}

function triggerCounters() {
  // Small delay so the DOM is fully painted
  setTimeout(function() {
    var els = document.querySelectorAll('.counter-value');
    els.forEach(function(el) {
      var target = parseFloat(el.dataset.target);
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      if (!isNaN(target)) {
        if (!_countersInitialized && target > 0) {
          animateValue(el, 0, target, 1200, prefix, suffix);
        } else {
          // Subsequent renders: show final value directly (no re-animation)
          el.textContent = prefix + Number(target).toLocaleString() + suffix;
        }
      }
      el.classList.add('counter-ready');
    });
    _countersInitialized = true;
  }, 100);
}

// ── Shareable Card Generation ─────────────────────────────────

function generateCard() {
  var btn = document.getElementById('share-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    if (typeof html2canvas === 'undefined') {
      alert('This feature requires an internet connection to load html2canvas.');
      btn.disabled = false;
      btn.textContent = '📸 Share';
      return;
    }

    fetch(apiUrl('/api/card'))
      .then(function(res) {
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
      })
      .then(function(data) {
        var preview = document.getElementById('card-preview');
        preview.innerHTML = buildCardHTML(data);
        preview.style.visibility = 'visible';

        requestAnimationFrame(function() {
          html2canvas(preview, {
            scale: 2,
            backgroundColor: '#14151f',
            useCORS: true,
            logging: false
          }).then(function(canvas) {
            var date = new Date().toISOString().slice(0, 10);
            var profileName = data.profile || 'default';
            var dataUrl = canvas.toDataURL('image/png');

            // Download
            var link = document.createElement('a');
            link.download = 'agpa-card-' + profileName + '-' + date + '.png';
            link.href = dataUrl;
            link.click();

            // Copy to clipboard on success, silently ignore on failure
            canvas.toBlob(function(blob) {
              if (blob && navigator.clipboard && navigator.clipboard.write) {
                navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
                ]).then(function() {
                  showToast('📋 Card image copied to clipboard');
                }).catch(function() {
                  /* clipboard not available — image still downloaded */
                });
              }
            }, 'image/png');

            preview.innerHTML = '';
            preview.style.visibility = 'hidden';
            btn.disabled = false;
            btn.textContent = '📸 Share';
          }).catch(function(err) {
            console.error('Card capture failed:', err);
            alert('Failed to generate card. Please try again.');
            preview.innerHTML = '';
            preview.style.visibility = 'hidden';
            btn.disabled = false;
            btn.textContent = '📸 Share';
          });
        });
      })
      .catch(function(err) {
        console.error('Card API failed:', err);
        alert('Failed to load card data. Please try again.');
        btn.disabled = false;
        btn.textContent = '📸 Share';
      });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '📸 Share';
  }
}

// ── Data Export ──────────────────────────────────────────────────────

function exportData() {
  var btn = document.getElementById('export-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Exporting...';

  var url = apiUrl('/api/export') + '&full=true';

  fetch(url)
    .then(function(res) {
      if (!res.ok) throw new Error('Export failed: ' + res.status);
      return res.blob();
    })
    .then(function(blob) {
      var date = new Date().toISOString().slice(0, 10);
      var profile = window.__agpaProfile || 'default';
      var link = document.createElement('a');
      link.download = 'agpa-export-' + profile + '-' + date + '.json';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      btn.disabled = false;
      btn.textContent = '📦 Export';
      showToast('✅ Export downloaded');
    })
    .catch(function(err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
      btn.disabled = false;
      btn.textContent = '📦 Export';
    });
}

function buildCardHTML(data) {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hmClr(l) { var c=['rgba(128,128,144,.06)','rgba(79,195,247,.18)','rgba(79,195,247,.40)','rgba(79,195,247,.68)','#4fc3f7']; return c[l]||c[0]; }
  var isZh = (data.lang || 'en') === 'zh';
  var L = function(en, zh) { return isZh ? zh : en; };

  var unlockPct = data.total > 0 ? Math.round((data.unlocked / data.total) * 100) : 0;
  var xpPct = data.xp_target > 0 ? Math.round((data.xp_current / data.xp_target) * 100) : 0;
  var h = '';

  // ═══ TOP BANNER ═══
  h += '<div class="card-top">';
  h += '<div class="card-avatar-row">';
  h += '<div class="card-avatar">' + esc(data.profile_emoji) + '</div>';
  h += '<div>';
  h += '<div class="card-profile-name">' + esc(data.profile) + '</div>';
  h += '<div class="card-subtitle">Lv.' + esc(data.level) + ' · ' + esc((data.total_xp || 0).toLocaleString()) + ' XP</div>';
  h += '</div>';
  h += '<div class="card-unlocked-stat">';
  h += '<div class="card-unlocked-ring" style="--unlock-pct:' + (unlockPct * 3.6) + 'deg">';
  h += '<div class="card-unlocked-num">' + esc(data.unlocked) + '</div>';
  h += '</div>';
  h += '<div class="card-unlocked-label">/ ' + esc(data.total) + ' ' + L('UNLOCKED', '已解锁') + '</div>';
  h += '</div></div></div>';

  // ═══ STATS ═══
  h += '<div class="card-stats-row">';
  h += '<div class="card-stat-box"><div class="card-stat-icon">🔥</div><div class="card-stat-val">' + esc(data.stats.streak_days) + '</div><div class="card-stat-label">' + L('Streak', '连续天数') + '</div></div>';
  h += '<div class="card-stat-box"><div class="card-stat-icon">📋</div><div class="card-stat-val">' + esc((data.stats.total_tasks || 0).toLocaleString()) + '</div><div class="card-stat-label">' + L('Tasks', '任务') + '</div></div>';
  h += '<div class="card-stat-box"><div class="card-stat-icon">🔧</div><div class="card-stat-val">' + esc((data.stats.total_tool_uses || 0).toLocaleString()) + '</div><div class="card-stat-label">' + L('Tools', '工具调用') + '</div></div>';
  h += '<div class="card-stat-box"><div class="card-stat-icon">💻</div><div class="card-stat-val">' + esc((data.stats.total_sessions || 0).toLocaleString()) + '</div><div class="card-stat-label">' + L('Sessions', '会话') + '</div></div>';
  h += '</div>';

  // ═══ BODY ═══
  h += '<div class="card-body">';

  // XP progress (class-based for theme support)
  h += '<div class="card-xp-wrap">';
  h += '<div class="card-xp-label-row"><span>' + L('LEVEL PROGRESS', '等级进度') + '</span><span>' + esc((data.xp_current || 0).toLocaleString()) + ' / ' + esc((data.xp_target || 1).toLocaleString()) + '</span></div>';
  h += '<div class="card-xp-track"><div class="card-xp-fill" style="width:' + xpPct + '%"></div></div></div>';

  // Showcase
  h += '<div class="card-section-head">🏆 ' + L('SHOWCASE', '展示柜') + '</div>';
  for (var i = 0; i < data.achievements.length; i++) {
    var a = data.achievements[i];
    h += '<div class="card-ach-item">';
    h += '<div class="card-ach-rarity-strip" style="background:' + esc(a.rarity_color) + '"></div>';
    h += '<div class="card-ach-icon">' + esc(a.icon) + '</div>';
    h += '<div class="card-ach-body">';
    h += '<div class="card-ach-name-row"><span class="card-ach-name" style="color:' + esc(a.rarity_color) + '">' + esc(a.name) + '</span><span class="card-ach-badge" style="color:' + esc(a.rarity_color) + ';background:' + esc(a.rarity_color) + '22">' + esc(a.rarity_label) + '</span></div>';
    h += '<div class="card-ach-desc">' + esc(a.description) + '</div>';
    if (a.in_progress) {
      h += '<div class="card-ach-progress">';
      h += '<div class="card-ach-progress-bar"><div style="height:100%;width:' + (a.progress_pct||0) + '%;background:' + esc(a.rarity_color) + ';border-radius:2px"></div></div>';
      h += '<span class="card-ach-progress-text" style="color:' + esc(a.rarity_color) + '">' + esc(a.progress_text||'') + '</span></div>';
    }
    h += '<div class="card-ach-meta">';
    if (a.in_progress) { h += '<span>🔷 ' + L('In Progress', '进行中') + '</span>'; }
    else {
      h += '<span>📅 ' + (a.unlocked_at ? a.unlocked_at.slice(0,10) : '') + '</span>';
      if (a.set_name) h += '<span>📦 ' + esc(a.set_name) + (a.set_progress ? ' (' + esc(a.set_progress) + ')' : '') + '</span>';
    }
    h += '</div></div></div>';
  }

  // Heatmap
  if (data.heatmap && data.heatmap.length > 0) {
    h += '<div class="card-heatmap-wrap">';
    h += '<div class="card-hm-title">📊 ' + L('Activity · Last 4 Months', '活跃度 · 近4个月') + '</div>';
    h += '<div class="card-hm-grid">';
    for (var j = 0; j < data.heatmap.length; j++) {
      var dt = data.heatmap[j];
      h += '<div class="card-hm-cell" style="background:' + hmClr(dt.count) + '"></div>';
    }
    h += '</div>';
    h += '<div class="card-hm-legend"><span>' + L('Less', '少') + '</span><div class="card-hm-cell" style="background:rgba(128,128,144,.15)"></div><div class="card-hm-cell" style="background:rgba(79,195,247,.18)"></div><div class="card-hm-cell" style="background:rgba(79,195,247,.40)"></div><div class="card-hm-cell" style="background:rgba(79,195,247,.68)"></div><div class="card-hm-cell" style="background:#4fc3f7"></div><span>' + L('More', '多') + '</span></div>';
    h += '</div>';
  }

  // Rarity breakdown
  h += '<div class="card-rarity-strip">';
  for (var k = 0; k < data.rarity_breakdown.length; k++) {
    var rb = data.rarity_breakdown[k];
    h += '<div class="card-rarity-chip"><span class="rarity-name" style="color:' + esc(rb.color) + '">' + esc(rb.rarity) + '</span><span class="rarity-count" style="color:' + esc(rb.color) + '">' + esc(rb.count) + '</span></div>';
  }
  h += '</div>';

  // Milestones
  if (data.milestones && data.milestones.length > 0) {
    h += '<div class="card-section-head">📌 ' + L('MILESTONES', '里程碑') + '</div>';
    h += '<div class="card-ms-wrap"><div class="card-ms-list">';
    for (var m = 0; m < data.milestones.length; m++) {
      var ms = data.milestones[m];
      h += '<div class="card-ms-row">';
      h += '<span class="card-ms-bullet">✦</span>';
      h += '<span class="card-ms-date">' + esc(ms.unlocked_at ? ms.unlocked_at.slice(0,10) : '') + '</span>';
      h += '<span class="card-ms-name">' + esc(ms.name) + '</span>';
      h += '<span class="card-ms-rarity" style="color:' + esc(ms.rarity_color) + '">' + esc(ms.rarity) + '</span>';
      h += '</div>';
    }
    h += '</div></div>';
  }

  h += '</div>'; // card-body

  // ═══ FOOTER ═══
  h += '<div class="card-footer-wrap"><img src="/agpa-logo-dark-24.png" class="card-footer-logo" alt=""> ' + L('Generated by AGPA', '由 AGPA 生成') + ' · v0.1.8 · ' + new Date().toISOString().slice(0, 10) + '</div>';

  return h;
}
