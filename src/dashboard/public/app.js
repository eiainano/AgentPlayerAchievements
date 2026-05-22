(async function () {
  const res = await fetch('/api/data');
  if (!res.ok) {
    document.body.innerHTML = `<div style="padding:40px;color:#888;">Failed to load dashboard data: ${res.status}</div>`;
    return;
  }
  const data = await res.json();

  renderNav(data);
  renderProfile(data);
  renderAchievements(data);
  renderSets(data);
  renderTimeline(data);

  // Toast for recently unlocked
  const now = Date.now();
  data.timeline.forEach(t => {
    if (now - new Date(t.unlocked_at).getTime() < 300000) {
      const ach = data.achievements.find(a => a.id === t.id);
      if (ach) showToast(ach.icon, ach.name, ach.rarity);
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
        return `<div class="showcase-slot filled" data-rarity="${s.achievement.rarity}" title="${s.achievement.name}">${s.achievement.icon}</div>`;
      }
      return `<div class="showcase-slot empty">+</div>`;
    }).join('');
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

  grid.innerHTML = items.map(a => {
    const locked = !a.unlocked;
    const showIcon = locked && a.hidden ? '\u{1F512}' : a.icon;
    const progressHtml = a.progress && a.progress.target > 0
      ? `<div class="ach-progress"><div class="ach-progress-fill" style="width:${Math.min((a.progress.current / a.progress.target) * 100, 100)}%"></div></div>`
      : '';
    const hiddenHint = locked && a.hidden ? '<div class="ach-hidden-hint">Hidden</div>' : '';
    const nameDisplay = locked && a.hidden ? '???' : a.name;

    return `<div class="ach-card ${locked ? 'locked' : ''}" data-rarity="${a.rarity}">
      <div class="ach-icon">${showIcon}</div>
      <div class="ach-name">${escHtml(nameDisplay)}</div>
      <div class="ach-rarity" style="color:${rarityColor(a.rarity)}">${a.rarity}</div>
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
      `<div class="set-member ${a.unlocked ? 'unlocked' : 'locked'}" title="${escHtml(a.name)}">${a.unlocked ? a.icon : '?'}</div>`
    ).join('');

    return `<div class="set-card">
      <div class="set-header">
        <span style="font-size:24px;">${set.achievements.find(a => a.unlocked)?.icon || '\u{1F4E6}'}</span>
        <span class="set-name">${escHtml(set.name)}</span>
      </div>
      <div class="set-count">${set.completed}/${set.total}</div>
      <div class="set-bar">
        <div class="set-bar-fill" style="width:${pct}%;background:${rarityColor(highestRarity)}"></div>
      </div>
      <div class="set-members">${membersHtml}</div>
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
        <span class="tl-name" style="color:${rarityColor(ach.rarity)}">${escHtml(ach.name)}</span>
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
