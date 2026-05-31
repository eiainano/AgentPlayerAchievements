/**
 * Self-Customize Editor — personalize achievement names & descriptions.
 *
 * Features:
 * - Left sidebar: filtered list of all achievements
 * - Right panel: editable fields (name, name_cn, description) + read-only previews
 * - Inline suggestions with one-click accept/reject
 * - Keyboard nav (↑↓) + Ctrl+S save
 * - Batch save with dirty tracking
 */

// ── State ────────────────────────────────────────────────────────────────
const STATE = {
  achievements: [],       // CustomizeAchievement[]
  stats: null,
  selectedIdx: -1,
  dirtyFields: new Map(), // "id:field" → value
  filters: {
    search: '',
    category: '',
    rarity: '',
    noCnOnly: true,      // default: only show those missing Chinese name
    suggestionsOnly: false,
  },
};

// ── DOM Refs ─────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

const DOM = {
  statTotal: $('#stat-total'),
  statCn: $('#stat-cn'),
  statMissing: $('#stat-missing'),
  statSuggestions: $('#stat-suggestions'),
  btnSaveAll: $('#btn-save-all'),
  dirtyCount: $('#dirty-count'),
  btnReload: $('#btn-reload'),
  searchInput: $('#search-input'),
  filterCategory: $('#filter-category'),
  filterRarity: $('#filter-rarity'),
  filterNoCn: $('#filter-no-cn'),
  filterSuggestions: $('#filter-suggestions'),
  achList: $('#ach-list'),
  editorEmpty: $('#editor-empty'),
  editorContent: $('#editor-content'),
  editIcon: $('#edit-icon'),
  editId: $('#edit-id'),
  editCategory: $('#edit-category'),
  editRarity: $('#edit-rarity'),
  editHidden: $('#edit-hidden'),
  editSet: $('#edit-set'),
  editPos: $('#edit-pos'),
  fieldName: $('#field-name'),
  fieldNameCn: $('#field-name_cn'),
  fieldDesc: $('#field-description'),
  fieldDescEn: $('#field-description_en'),
  fieldConditions: $('#field-conditions'),
  suggestionsName: $('#suggestions-name'),
  suggestionsNameCn: $('#suggestions-name_cn'),
  suggestionsDesc: $('#suggestions-description'),
  btnPrev: $('#btn-prev'),
  btnNext: $('#btn-next'),
  toastContainer: $('#toast-container'),
};

// ── Init ─────────────────────────────────────────────────────────────────
async function loadData(silent = false) {
  try {
    const resp = await fetch('/api/customize/achievements');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    STATE.achievements = data.achievements;
    STATE.stats = data.stats;
    populateCategoryFilter();
    updateStats();
    renderList();
    if (!silent) {
      toast('Reloaded', `${data.stats.total} achievements loaded`, 'info');
    }
  } catch (err) {
    console.error('Failed to load achievements:', err);
    if (!silent) toast('Error', 'Failed to reload achievements', 'error');
  }
}

async function init() {
  bindEvents();
  await loadData(true);
}

// ── Category Filter Population ──────────────────────────────────────────
function populateCategoryFilter() {
  // Clear all except the first "All Categories" option
  while (DOM.filterCategory.options.length > 1) {
    DOM.filterCategory.remove(1);
  }
  const cats = [...new Set(STATE.achievements.map(a => a.category))].sort();
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    DOM.filterCategory.appendChild(opt);
  });
}

// ── Filtered List ───────────────────────────────────────────────────────
function getFiltered() {
  const s = STATE.filters.search.toLowerCase();
  return STATE.achievements.filter(a => {
    if (STATE.filters.category && a.category !== STATE.filters.category) return false;
    if (STATE.filters.rarity && a.rarity !== STATE.filters.rarity) return false;
    if (STATE.filters.noCnOnly && a.has_name_cn) return false;
    if (STATE.filters.suggestionsOnly && a.suggestions.length === 0) return false;
    if (s) {
      return a.id.toLowerCase().includes(s)
        || a.name.toLowerCase().includes(s)
        || (a.name_cn && a.name_cn.toLowerCase().includes(s));
    }
    return true;
  });
}

// ── Rendering ───────────────────────────────────────────────────────────
function renderList() {
  const filtered = getFiltered();
  DOM.achList.innerHTML = '';

  if (filtered.length === 0) {
    DOM.achList.innerHTML = '<li style="padding:12px;color:var(--text-muted);font-size:13px;">No matches</li>';
    return;
  }

  filtered.forEach((ach, idx) => {
    const li = document.createElement('li');
    li.className = 'ach-item';
    if (idx === STATE.selectedIdx) li.classList.add('active');
    li.dataset.idx = idx;

    const isDirty = hasDirty(ach.id);
    const hasSuggestions = ach.suggestions.length > 0;
    const cnDisplay = ach.name_cn || (STATE.dirtyFields.get(`${ach.id}:name_cn`) || '');

    // Build with DOM APIs (not innerHTML) — prevents stored XSS
    const iconSpan = document.createElement('span');
    iconSpan.className = 'ach-icon';
    iconSpan.textContent = ach.icon || '🏆';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'ach-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'ach-name';
    nameDiv.textContent = ach.name + (isDirty ? ' *' : '');

    const cnDiv = document.createElement('div');
    cnDiv.className = 'ach-name-cn';
    if (cnDisplay) {
      cnDiv.textContent = cnDisplay;
    } else {
      cnDiv.style.color = 'var(--danger)';
      cnDiv.textContent = '(missing CN)';
    }

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(cnDiv);

    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'ach-badges';
    if (!cnDisplay) {
      const dot = document.createElement('span');
      dot.className = 'dot missing';
      dot.title = 'Missing Chinese name';
      badgesDiv.appendChild(dot);
    }
    if (hasSuggestions) {
      const dot = document.createElement('span');
      dot.className = 'dot suggestion';
      dot.title = 'Has suggestions';
      badgesDiv.appendChild(dot);
    }

    li.appendChild(iconSpan);
    li.appendChild(infoDiv);
    li.appendChild(badgesDiv);

    li.addEventListener('click', () => selectAchievement(idx));
    DOM.achList.appendChild(li);
  });

  if (STATE.selectedIdx >= 0) {
    DOM.editPos.textContent = `${Math.min(STATE.selectedIdx + 1, filtered.length)} / ${filtered.length}`;
  }
}

function selectAchievement(idx) {
  const filtered = getFiltered();
  if (idx < 0 || idx >= filtered.length) return;
  saveCurrentEdits();
  STATE.selectedIdx = idx;
  renderList();
  renderEditor(filtered[idx]);
  scrollToActive();
}

function scrollToActive() {
  const active = DOM.achList.querySelector('.ach-item.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── Editor Rendering ────────────────────────────────────────────────────
function renderEditor(ach) {
  DOM.editorEmpty.style.display = 'none';
  DOM.editorContent.style.display = 'block';

  DOM.editIcon.textContent = ach.icon || '🏆';
  DOM.editId.textContent = ach.id;
  DOM.editCategory.textContent = ach.category;
  DOM.editCategory.className = 'badge badge-cat';
  DOM.editRarity.textContent = ach.rarity;
  DOM.editRarity.className = `badge badge-rarity rarity-${ach.rarity}`;

  DOM.editHidden.style.display = ach.hidden ? 'inline' : 'none';
  DOM.editSet.style.display = ach.set ? 'inline' : 'none';
  if (ach.set) DOM.editSet.textContent = `set: ${ach.set}`;

  // Editable fields
  DOM.fieldName.value = STATE.dirtyFields.get(`${ach.id}:name`) ?? ach.name;
  DOM.fieldNameCn.value = STATE.dirtyFields.get(`${ach.id}:name_cn`) ?? ach.name_cn ?? '';
  DOM.fieldDesc.value = STATE.dirtyFields.get(`${ach.id}:description`) ?? ach.description ?? '';

  // Read-only English description preview
  DOM.fieldDescEn.textContent = '';
  if (ach.description_en) {
    const span = document.createElement('span');
    span.className = 'en-text';
    span.textContent = ach.description_en;
    DOM.fieldDescEn.appendChild(span);
  } else {
    const span = document.createElement('span');
    span.className = 'en-placeholder';
    span.textContent = '(will be translated from Chinese after you save)';
    DOM.fieldDescEn.appendChild(span);
  }

  // Dirty classes
  [DOM.fieldName, DOM.fieldNameCn, DOM.fieldDesc].forEach(el => {
    el.classList.remove('dirty', 'modified');
    if (hasDirty(ach.id, el.dataset.field)) el.classList.add('dirty');
  });

  DOM.fieldConditions.textContent = formatConditions(ach.conditions);

  renderSuggestions(ach.id, 'name', DOM.suggestionsName, ach);
  renderSuggestions(ach.id, 'name_cn', DOM.suggestionsNameCn, ach);
  renderSuggestions(ach.id, 'description', DOM.suggestionsDesc, ach);
}

function renderSuggestions(achId, field, container, ach) {
  const relevant = ach.suggestions.filter(s => s.field === field);
  container.innerHTML = '';
  if (relevant.length === 0) return;

  relevant.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = `suggestion-card ${s.severity}`;

    const body = document.createElement('div');
    body.className = 'suggestion-body';

    const reason = document.createElement('div');
    reason.className = 'suggestion-reason';
    reason.textContent = `💡 ${s.reason}`;

    const text = document.createElement('div');
    text.className = 'suggestion-text';

    const curSpan = document.createElement('span');
    curSpan.className = 'current';
    curSpan.textContent = `"${s.current}"`;

    const arrow = document.createElement('span');
    arrow.className = 'suggestion-arrow';
    arrow.textContent = '→';

    const sugSpan = document.createElement('span');
    sugSpan.className = 'suggested';
    sugSpan.textContent = `"${s.suggested}"`;

    text.appendChild(curSpan);
    text.appendChild(arrow);
    text.appendChild(sugSpan);
    body.appendChild(reason);
    body.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'suggestion-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn accept small';
    acceptBtn.dataset.action = 'accept';
    acceptBtn.dataset.field = field;
    acceptBtn.dataset.value = s.suggested;
    acceptBtn.dataset.sid = String(i);
    acceptBtn.textContent = 'Accept';

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn reject small';
    rejectBtn.dataset.action = 'reject';
    rejectBtn.dataset.sid = String(i);
    rejectBtn.textContent = 'Ignore';

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);
    card.appendChild(body);
    card.appendChild(actions);

    card.querySelector('[data-action="accept"]').addEventListener('click', () => {
      const input = document.getElementById(`field-${field}`);
      if (input) {
        input.value = s.suggested;
        input.classList.add('modified');
        markDirty(ach.id, field, s.suggested);
        updateDirtyCount();
      }
    });

    card.querySelector('[data-action="reject"]').addEventListener('click', () => {
      card.style.opacity = '0.3';
      card.style.textDecoration = 'line-through';
      const achObj = STATE.achievements.find(a => a.id === ach.id);
      if (achObj) achObj.suggestions = achObj.suggestions.filter((_, j) => j !== i);
    });

    container.appendChild(card);
  });
}

// ── Conditions Formatting ──────────────────────────────────────────────
function formatConditions(conditions) {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return '(no conditions)';
  }
  return conditions.map(c => {
    const parts = [`[${c.type}]`];
    if (c.event) parts.push(c.event);
    if (c.filter) parts.push(`filter:${c.filter}`);
    if (c.field) parts.push(`.${c.field}`);
    if (c.operator) parts.push(c.operator);
    if (c.value !== undefined && c.value !== 0) parts.push(c.value);
    if (c.window) parts.push(`(${c.window})`);
    if (c.metric) parts.push(`metric:${c.metric}`);
    if (c.sequences || c.events) parts.push(`seq:[${(c.sequences || c.events).join(',')}]`);
    if (c.unit) parts.push(`unit:${c.unit}`);
    return parts.join(' ');
  }).join('\n');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Dirty Tracking ──────────────────────────────────────────────────────
function markDirty(id, field, value) {
  STATE.dirtyFields.set(`${id}:${field}`, value);
}

function hasDirty(id, field) {
  if (field) return STATE.dirtyFields.has(`${id}:${field}`);
  for (const key of STATE.dirtyFields.keys()) {
    if (key.startsWith(`${id}:`)) return true;
  }
  return false;
}

function updateDirtyCount() {
  const count = new Set([...STATE.dirtyFields.keys()].map(k => k.split(':')[0])).size;
  DOM.dirtyCount.textContent = count;
  DOM.btnSaveAll.disabled = count === 0;
}

function saveCurrentEdits() {
  if (STATE.selectedIdx < 0) return;
  const filtered = getFiltered();
  if (STATE.selectedIdx >= filtered.length) return;
  const ach = filtered[STATE.selectedIdx];

  for (const field of ['name', 'name_cn', 'description']) {
    const input = document.getElementById(`field-${field}`);
    if (!input) continue;
    const orig = field === 'name_cn' ? (ach.name_cn ?? '') : (ach[field] ?? '');
    if (input.value !== orig) {
      markDirty(ach.id, field, input.value);
      input.classList.add('dirty');
    }
  }
  updateDirtyCount();
}

// ── Save ────────────────────────────────────────────────────────────────
async function saveAll() {
  if (STATE.dirtyFields.size === 0) return;

  const changes = [];
  for (const [key, value] of STATE.dirtyFields) {
    const [id, field] = key.split(':');
    changes.push({ id, field, value });
  }

  try {
    const resp = await fetch('/api/customize/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const result = await resp.json();

    for (const change of changes) {
      const ach = STATE.achievements.find(a => a.id === change.id);
      if (!ach) continue;
      if (change.field === 'name_cn') {
        ach.name_cn = change.value;
        ach.has_name_cn = true;
        ach.suggestions = ach.suggestions.filter(s => s.field !== 'name_cn');
      }
      if (change.field === 'name') ach.name = change.value;
      if (change.field === 'description') ach.description = change.value;
    }

    STATE.dirtyFields.clear();
    updateDirtyCount();
    updateStats();
    renderList();

    toast('Saved', `${result.updated} changes written to YAML`, 'success');
  } catch (err) {
    console.error('Save failed:', err);
    toast('Error', 'Failed to save changes', 'error');
  }
}

// ── Stats ───────────────────────────────────────────────────────────────
function updateStats() {
  const withCn = STATE.achievements.filter(a => a.has_name_cn).length;
  const withoutCn = STATE.achievements.length - withCn;
  const totalSug = STATE.achievements.reduce((sum, a) => sum + a.suggestions.length, 0);

  DOM.statTotal.textContent = `${STATE.achievements.length} total`;
  DOM.statCn.textContent = `${withCn} CN`;
  DOM.statMissing.textContent = `${withoutCn} missing`;
  DOM.statSuggestions.textContent = `${totalSug} suggestions`;
}

// ── Toast ───────────────────────────────────────────────────────────────
function toast(title, message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<strong>${escapeHtml(title)}</strong> ${escapeHtml(message)}`;
  DOM.toastContainer.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Events ──────────────────────────────────────────────────────────────
function bindEvents() {
  DOM.searchInput.addEventListener('input', debounce(() => {
    STATE.filters.search = DOM.searchInput.value;
    STATE.selectedIdx = 0;
    renderList();
    const filtered = getFiltered();
    if (filtered.length > 0) renderEditor(filtered[0]);
  }, 200));

  DOM.filterCategory.addEventListener('change', () => {
    STATE.filters.category = DOM.filterCategory.value;
    STATE.selectedIdx = 0;
    renderList();
    const filtered = getFiltered();
    if (filtered.length > 0) selectAchievement(0);
    else { DOM.editorContent.style.display = 'none'; DOM.editorEmpty.style.display = 'flex'; }
  });

  DOM.filterRarity.addEventListener('change', () => {
    STATE.filters.rarity = DOM.filterRarity.value;
    STATE.selectedIdx = 0;
    renderList();
    const filtered = getFiltered();
    if (filtered.length > 0) selectAchievement(0);
    else { DOM.editorContent.style.display = 'none'; DOM.editorEmpty.style.display = 'flex'; }
  });

  DOM.filterNoCn.addEventListener('change', () => {
    STATE.filters.noCnOnly = DOM.filterNoCn.checked;
    STATE.selectedIdx = 0;
    renderList();
    const filtered = getFiltered();
    if (filtered.length > 0) selectAchievement(0);
    else { DOM.editorContent.style.display = 'none'; DOM.editorEmpty.style.display = 'flex'; }
  });

  DOM.filterSuggestions.addEventListener('change', () => {
    STATE.filters.suggestionsOnly = DOM.filterSuggestions.checked;
    STATE.selectedIdx = 0;
    renderList();
    const filtered = getFiltered();
    if (filtered.length > 0) selectAchievement(0);
    else { DOM.editorContent.style.display = 'none'; DOM.editorEmpty.style.display = 'flex'; }
  });

  DOM.btnPrev.addEventListener('click', () => navigateSelect(-1));
  DOM.btnNext.addEventListener('click', () => navigateSelect(1));

  [DOM.fieldName, DOM.fieldNameCn, DOM.fieldDesc].forEach(input => {
    input.addEventListener('input', () => {
      if (STATE.selectedIdx < 0) return;
      const filtered = getFiltered();
      if (STATE.selectedIdx >= filtered.length) return;
      const ach = filtered[STATE.selectedIdx];
      const field = input.dataset.field;
      const orig = field === 'name_cn' ? (ach.name_cn ?? '') : (ach[field] ?? '');
      if (input.value !== orig) {
        markDirty(ach.id, field, input.value);
        input.classList.add('dirty');
        input.classList.remove('modified');
      } else {
        STATE.dirtyFields.delete(`${ach.id}:${field}`);
        input.classList.remove('dirty');
      }
      updateDirtyCount();
    });
  });

  DOM.btnSaveAll.addEventListener('click', () => { saveCurrentEdits(); saveAll(); });

  DOM.btnReload.addEventListener('click', async () => {
    STATE.dirtyFields.clear();
    updateDirtyCount();
    STATE.selectedIdx = -1;
    DOM.editorContent.style.display = 'none';
    DOM.editorEmpty.style.display = 'flex';
    await loadData();  // show toast on manual reload
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentEdits();
      saveAll();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      navigateSelect(e.key === 'ArrowUp' ? -1 : 1);
    }
  });

  DOM.achList.addEventListener('click', (e) => {
    const item = e.target.closest('.ach-item');
    if (item && item.dataset.idx !== undefined) {
      selectAchievement(parseInt(item.dataset.idx));
    }
  });
}

function navigateSelect(delta) {
  const filtered = getFiltered();
  if (filtered.length === 0) return;
  saveCurrentEdits();
  STATE.selectedIdx = Math.max(0, Math.min(filtered.length - 1, STATE.selectedIdx + delta));
  renderList();
  renderEditor(filtered[STATE.selectedIdx]);
  scrollToActive();
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ── Start ────────────────────────────────────────────────────────────────
init();
