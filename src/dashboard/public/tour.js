/**
 * AGPA Product Tour — lightweight 4-step guided walkthrough
 * No dependencies, pure vanilla JS + CSS.
 */

var AGPATour = (function() {
  var currentStep = -1;
  var overlay = null;
  var tooltip = null;
  var clone = null;
  var running = false;

  var STEPS = [
    {
      target: '#achievement-grid',
      title: '📊 成就面板',
      desc: '每个成就追踪一种 Agent 行为。已解锁的亮起，灰色的等待你去激活。',
      tab: 'achievements',
    },
    {
      target: '#stats-row',
      title: '📈 统计面板',
      desc: '成就进度、分类分布、稀有度一目了然。数字越大越有成就感！',
      tab: 'profile',
    },
    {
      target: '#timeline',
      title: '📅 时间线',
      desc: '回顾你和 Agent 的每一段对话 session，看到成就解锁的时间轴。',
      tab: 'timeline',
    },
    {
      target: '#insights',
      title: '🔥 热力图',
      desc: '像 GitHub 贡献图一样追踪你的 Agent 使用活跃度，每天用了多久一目了然。',
      tab: 'insights',
    },
  ];

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) stop();
    });

    tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (tooltip) { tooltip.remove(); tooltip = null; }
    if (clone) { clone.remove(); clone = null; }
  }

  function switchTab(tabId) {
    var link = document.querySelector('.nav-link[data-section="' + tabId + '"]');
    if (link) link.click();
    setTimeout(function() {
      var section = document.getElementById(tabId);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function showStep(index) {
    if (!overlay || !tooltip) return;
    if (index < 0 || index >= STEPS.length) { stop(); return; }

    var step = STEPS[index];
    if (step.tab) switchTab(step.tab);

    setTimeout(function() {
      var target = document.querySelector(step.target);
      if (!target) { next(); return; }

      if (clone) { clone.remove(); clone = null; }

      var rect = target.getBoundingClientRect();
      clone = target.cloneNode(true);
      clone.className = (clone.className || '') + ' tour-highlight';
      clone.style.position = 'fixed';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.zIndex = '10001';
      clone.style.pointerEvents = 'none';
      document.body.appendChild(clone);

      tooltip.innerHTML =
        '<div class="tour-tooltip-step">' + (index + 1) + ' / ' + STEPS.length + '</div>' +
        '<div class="tour-tooltip-title">' + step.title + '</div>' +
        '<div class="tour-tooltip-desc">' + step.desc + '</div>' +
        '<div class="tour-tooltip-btns">' +
          (index > 0
            ? '<button class="tour-btn tour-btn-prev" id="tour-prev">' + (typeof t === 'function' ? t('tour_prev') : '← Previous') + '</button>'
            : '<span></span>') +
          (index < STEPS.length - 1
            ? '<button class="tour-btn tour-btn-next" id="tour-next">' + (typeof t === 'function' ? t('tour_next') : 'Next →') + '</button>'
            : '<button class="tour-btn tour-btn-done" id="tour-done">' + (typeof t === 'function' ? t('tour_done') : '✓ Done') + '</button>') +
          '<button class="tour-btn tour-btn-skip" id="tour-skip">' + (typeof t === 'function' ? t('tour_skip') : '✕ Skip') + '</button>' +
        '</div>';

      tooltip.style.left = Math.max(20, rect.left) + 'px';
      tooltip.style.top = (rect.bottom + 12) + 'px';
      tooltip.style.maxWidth = Math.min(480, window.innerWidth - 40) + 'px';
      tooltip.style.display = 'block';

      var prevBtn = document.getElementById('tour-prev');
      var nextBtn = document.getElementById('tour-next');
      var doneBtn = document.getElementById('tour-done');
      var skipBtn = document.getElementById('tour-skip');

      if (prevBtn) prevBtn.onclick = prev;
      if (nextBtn) nextBtn.onclick = next;
      if (doneBtn) doneBtn.onclick = stop;
      if (skipBtn) skipBtn.onclick = stop;
    }, 250);
  }

  function next() {
    currentStep++;
    showStep(currentStep);
  }

  function prev() {
    currentStep--;
    showStep(currentStep);
  }

  function start() {
    if (running) return;
    running = true;
    currentStep = 0;
    createOverlay();
    overlay.style.display = 'block';
    showStep(currentStep);
  }

  function stop() {
    running = false;
    currentStep = -1;
    if (overlay) overlay.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    removeOverlay();
    switchTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { start: start, stop: stop };
})();

function startTour() {
  AGPATour.start();
}
