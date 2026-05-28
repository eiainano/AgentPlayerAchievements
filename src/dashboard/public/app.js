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

// ── Data & Render ──────────────────────────────────────

let dashboardData = null;

function renderAll(data) {
  renderNav(data);
  renderProfile(data);
  renderAchievements(data);
  renderSets(data);
  renderTimeline(data);
}

(async function () {
  const res = await fetch('/api/data');
  if (!res.ok) {
    document.body.innerHTML = `<div style="padding:40px;color:#888;">Failed to load dashboard data: ${res.status}</div>`;
    return;
  }
  const data = await res.json();
  dashboardData = data;
  initLang(data.config?.lang);

  renderAll(data);

  // Toast for recently unlocked
  const now = Date.now();
  data.timeline.forEach(t => {
    if (now - new Date(t.unlocked_at).getTime() < 300000) {
      const ach = data.achievements.find(a => a.id === t.id);
      if (ach) showToast(ach.icon, displayName(ach), ach.rarity);
    }
  });
})();

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

// ── Showcase management ──────────────────────────────

let pickSlot = null; // slot index currently being picked, or null

async function startPick(slot) {
  if (pickSlot === slot) { cancelPick(); return; }
  pickSlot = slot;

  // Highlight the selected showcase slot
  const slots = document.querySelectorAll('.showcase-slot');
  slots.forEach((el, i) => el.classList.toggle('picking', i === slot));

  // Show pick mode header
  const banner = document.getElementById('pick-banner');
  if (banner) {
    banner.style.display = 'flex';
    banner.querySelector('.pick-banner-text').textContent =
      `Pick an achievement for slot ${slot + 1}`;
  }

  // Re-render grid to show pin buttons
  if (dashboardData) renderGrid(dashboardData);

  // Scroll to achievements section
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
  const res = await fetch('/api/data');
  if (!res.ok) return;
  dashboardData = await res.json();
  renderAll(dashboardData);
}

// ── Profile Hero ─────────────────────────────────────

function renderProfile(data) {
  const { stats } = data;

  const levelEl = document.getElementById('level-number');
  if (levelEl) levelEl.textContent = String(stats.level);

  const fill = document.getElementById('xp-bar-fill');
  const label = document.getElementById('xp-label');
  if (fill && label) {
    const pct = stats.xp_progress.target > 0
      ? (stats.xp_progress.current / stats.xp_progress.target) * 100
      : 0;
    fill.style.width = `${Math.min(pct, 100)}%`;
    label.textContent = `${stats.total_xp.toLocaleString()} XP • Level ${stats.level}`;
  }

  const showcase = document.getElementById('showcase');
  if (showcase) {
    showcase.innerHTML = stats.showcase.map(s => {
      if (s.achievement) {
        return `<div class="showcase-slot filled" data-rarity="${s.achievement.rarity}"
          title="${escHtml(displayName(s.achievement))} — click to remove"
          onclick="clearSlot(${s.slot})">${s.achievement.icon}</div>`;
      }
      return `<div class="showcase-slot empty"
        title="Click to pick an achievement"
        onclick="startPick(${s.slot})">+</div>`;
    }).join('');

    // Auto-fill button
    const hasUnlocked = stats.showcase.some(s => !s.achievement) || true;
    const autoBtn = document.getElementById('showcase-auto');
    if (autoBtn) {
      autoBtn.style.display = stats.unlocked > 0 ? 'inline' : 'none';
    }
  }

  const row = document.getElementById('stats-row');
  if (row) {
    const unlockedCount = data.achievements.filter(a => a.unlocked).length;
    const statItems = [
      { value: unlockedCount.toLocaleString(), label: 'Unlocked' },
      { value: stats.total_events.toLocaleString(), label: 'Events' },
      { value: String(stats.streak), label: 'Day Streak' },
      { value: `${stats.completion_pct}%`, label: 'Complete' },
    ];
    row.innerHTML = statItems.map(s => `
      <div class="stat-card">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');
  }

  // Pick mode banner visibility
  const banner = document.getElementById('pick-banner');
  if (banner && pickSlot === null) banner.style.display = 'none';
}

// ── Achievement Grid ────────────────────────────────

let currentFilter = 'all';
let currentCategory = null;

function renderAchievements(data) {
  // Category nav
  const catNav = document.getElementById('category-nav');
  if (catNav) {
    const cats = [...new Set(data.achievements.map(a => a.category))];
    catNav.innerHTML = `<button class="category-pill active" data-cat="">All</button>` +
      cats.map(c => `<button class="category-pill" data-cat="${c}">${c}</button>`).join('');
    catNav.addEventListener('click', e => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;
      catNav.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.cat || null;
      renderGrid(data);
    });
  }

  // Filter tabs
  const filterTabs = document.getElementById('filter-tabs');
  if (filterTabs) {
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

  if (currentFilter === 'unlocked') items = items.filter(a => a.unlocked);
  else if (currentFilter === 'locked') items = items.filter(a => !a.unlocked);

  if (currentCategory) items = items.filter(a => a.category === currentCategory);

  const inPickMode = pickSlot !== null;

  grid.className = inPickMode ? 'achievement-grid picking' : 'achievement-grid';

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
    const hiddenHint = locked && a.hidden ? '<div class="ach-hidden-hint">&#128275; Hidden</div>' : '';
    const nameDisplay = locked && a.hidden ? '???' : displayName(a);

    const pinBtn = inPickMode && !locked
      ? `<div class="ach-pin" onclick="event.stopPropagation(); pinToSlot('${escAttr(a.id)}')" title="Pin to showcase">📌</div>`
      : '';

    const pickableClass = inPickMode && !locked ? ' pickable' : '';
    const lockedClass = locked ? ' locked' : '';

    return `<div class="ach-card${lockedClass}${pickableClass}" data-rarity="${a.rarity}" style="--delay:${idx * 30}ms">
      <div class="ach-stripe"></div>
      ${pinBtn}
      <div class="ach-icon-wrap"><span class="ach-icon">${showIcon}</span></div>
      <div class="ach-name">${escHtml(nameDisplay)}</div>
      <span class="ach-rarity-badge">${a.rarity}</span>
      ${progressHtml}
      ${hiddenHint}
    </div>`;
  }).join('');
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

// ── Sets ─────────────────────────────────────────────

function renderSets(data) {
  const grid = document.getElementById('sets-grid');
  if (!grid) return;

  if (!data.sets || data.sets.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-dim);">No achievement sets defined.</p>';
    return;
  }

  grid.innerHTML = data.sets.map(set => {
    const pct = set.total > 0 ? (set.completed / set.total) * 100 : 0;
    const highestRarity = set.achievements.reduce((best, a) => {
      const order = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
      return (order[a.rarity] || 0) > (order[best] || 0) ? a.rarity : best;
    }, 'common');

    const membersHtml = set.achievements.map(a =>
      `<div class="set-member ${a.unlocked ? 'unlocked' : 'locked'}" title="${escHtml(displayName(a))}">${a.unlocked ? a.icon : '?'}</div>`
    ).join('');

    const complete = set.completed === set.total && set.total > 0;
    const rewardHtml = complete && set.reward && set.reward.value
      ? `<div class="set-reward" data-type="${escHtml(set.reward.type)}">${escHtml(set.reward.value)}</div>`
      : '';

    return `<div class="set-card ${complete ? 'complete' : ''}">
      <div class="set-header">
        <span style="font-size:24px;">${set.achievements.find(a => a.unlocked)?.icon || '\u{1F4E6}'}</span>
        <span class="set-name">${escHtml(set.name)}</span>
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
    list.innerHTML = '<p style="color:var(--text-dim);">No achievements unlocked yet.</p>';
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
        <span class="tl-icon">${ach.icon}</span>
        <span class="tl-name" style="color:${rarityColor(ach.rarity)}">${escHtml(displayName(ach))}</span>
      </div>
    </div>`;
  }).filter(Boolean).join('');
}

// ── Toast ────────────────────────────────────────────

function showToast(icon, name, rarity) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text" style="color:${rarityColor(rarity)}">${escHtml(name)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
