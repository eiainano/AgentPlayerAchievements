/**
 * Gacha Reveal — rarity-graded achievement unlock animations
 *
 * Architecture:
 *   GachaQueue (singleton) -> enqueue(achievements) -> playNext()
 *     -> GachaReveal (per-achievement DOM animation)
 *       -> ParticleSystem (Canvas, Epic+ only)
 *     -> playNext() or all done -> onDrain callback -> renderAll()
 */

(function() {

// ── Rarity configuration matrix ──────────────────────────

const RARITY_CONFIG = {
  common:    { flip: false, particles: 0,  entry: 'fade',   duration: 600,  soundAt: 'end',     hasRing: false, hasGlow: false, hasShake: false },
  uncommon:  { flip: false, particles: 0,  entry: 'scale',  duration: 1000, soundAt: 'end',     hasRing: false, hasGlow: false, hasShake: false },
  rare:      { flip: true,  particles: 12, entry: 'scale',  duration: 1500, soundAt: 'flip',    hasRing: false, hasGlow: false, hasShake: false },
  epic:      { flip: true,  particles: 30, entry: 'scale',  duration: 2000, soundAt: 'flip',    hasRing: true,  hasGlow: true,  hasShake: false },
  legendary: { flip: true,  particles: 60, entry: 'scale',  duration: 3000, soundAt: 'flip',    hasRing: true,  hasGlow: true,  hasShake: true },
  mythic:    { flip: true,  particles: 100, entry: 'drop',  duration: 4000, soundAt: 'flip',    hasRing: true,  hasGlow: true,  hasShake: true },
};

const __gachaRARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];

/** Speed multiplier for gacha animations — "fast" cosmetic (Speedrun set) = 0.5x. */
function __gachaSpeedMultiplier() {
  return document.body.dataset.cosmeticAnimation === 'fast' ? 0.5 : 1.0;
}

// ── Helpers ─────────────────────────────────────────────

function gachaRarityColor(rarity) {
  return {
    common: '#7eb8da', uncommon: '#3b7ec0', rare: '#e0b020',
    epic: '#e87830', legendary: '#a858f0', mythic: '#f04050',
  }[rarity] || '#666';
}

function gachaRarityGlow(rarity) {
  return {
    common: 'rgba(126,184,218,.3)', uncommon: 'rgba(59,126,192,.3)',
    rare: 'rgba(224,176,32,.35)', epic: 'rgba(232,120,48,.4)',
    legendary: 'rgba(168,88,240,.45)', mythic: 'rgba(240,64,80,.5)',
  }[rarity] || 'rgba(100,100,100,.2)';
}

// ── Particle System (Canvas, Epic+ only) ────────────────

class ParticleSystem {
  constructor(canvas, rarity) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.particles = [];
    this.running = false;
    this.animFrame = null;

    const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
    this.count = cfg.particles;

    // Reduce particles on low-core devices
    if (navigator.hardwareConcurrency < 4) this.count = Math.floor(this.count / 2);

    this.color = gachaRarityColor(rarity);
    this.hasTrail = rarity === 'legendary' || rarity === 'mythic';
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  emitBurst(originX, originY) {
    for (let i = 0; i < this.count; i++) {
      const angle = (Math.PI * 2 / this.count) * i + (Math.random() - 0.5) * 0.3;
      const speed = 80 + Math.random() * 240;
      const size = 2 + Math.random() * 6;
      this.particles.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size,
        life: 1,
        decay: 0.4 + Math.random() * 0.4,
        alpha: 1,
      });
    }
  }

  start() {
    this.running = true;
    this.emitBurst(window.innerWidth / 2, window.innerHeight / 2);
    this.tick();
  }

  tick() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.vy += 160 * 0.016; // gravity
      p.life -= p.decay * 0.016;
      p.alpha = Math.max(0, p.life);

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = this.color;

      if (this.hasTrail) {
        this.ctx.shadowColor = this.color;
        this.ctx.shadowBlur = 8;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowBlur = 0;
    }

    this.ctx.globalAlpha = 1;

    if (this.particles.length > 0) {
      this.animFrame = requestAnimationFrame(() => this.tick());
    } else {
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// ── GachaReveal — single achievement animation ──────────

class GachaReveal {
  constructor(achievement, options) {
    this.ach = achievement;
    this.rarity = achievement.rarity || 'common';
    this.config = { ...(RARITY_CONFIG[this.rarity] || RARITY_CONFIG.common) };
    // Apply cosmetic speed multiplier (e.g. Speedrun set — 0.5x)
    this.config.duration = Math.round(this.config.duration * __gachaSpeedMultiplier());
    this.destroyed = false;
    this.particles = null;
    this.canvas = null;
    this.resolvePromise = null;
    this.onClick = null;
    this.onKey = null;
    this.onResize = null;
    this.noAutoDismiss = !!(options && options.noAutoDismiss);
  }

  start() {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this._buildDOM();
      this._playEntry(() => {
        if (this.destroyed) return;
        if (this.config.flip) {
          this._playFlip(() => {
            if (this.destroyed) return;
            this._playEffects(() => {
              this._autoDismiss();
            });
          });
        } else {
          this._showFront();
          if (this.rarity === 'uncommon') {
            this.card.classList.add('uncommon-glow');
          }
          this._playEffects(() => {
            this._autoDismiss();
          });
        }
      });
    });
  }

  skip() {
    if (this.destroyed) return;
    this._cleanup();
    if (this.resolvePromise) this.resolvePromise();
  }

  destroy() {
    this.destroyed = true;
    this._cleanup();
  }

  // ── Internal ────────────────────────────────────────────

  _buildDOM() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'gacha-overlay';
    this.overlay.setAttribute('data-rarity', this.rarity);

    this.card = document.createElement('div');
    this.card.className = 'gacha-card';
    this.card.setAttribute('data-rarity', this.rarity);

    const color = gachaRarityColor(this.rarity);
    const glow = gachaRarityGlow(this.rarity);
    this.card.style.setProperty('--card-color', color);
    this.card.style.setProperty('--card-glow', glow);

    // Card back (question mark)
    const back = document.createElement('div');
    back.className = 'gacha-card-face back';
    back.innerHTML = '<div class="gacha-question-mark">?</div>';

    // Card front
    const front = document.createElement('div');
    front.className = 'gacha-card-face front';
    const name = this.ach.name_cn || this.ach.name || this.ach.id;
    const desc = this.ach.description_cn || this.ach.description || '';
    const icon = this.ach.icon || '\u{1F3C6}';
    const rarityLabel = this.rarity.charAt(0).toUpperCase() + this.rarity.slice(1);
    front.innerHTML = '<div class="gacha-icon-wrap">' + icon +
      '</div><div class="gacha-name">' + this._esc(name) +
      '</div><div class="gacha-desc">' + this._esc(desc) +
      '</div><div class="gacha-rarity-badge">' + rarityLabel + '</div>';

    this.card.appendChild(back);
    this.card.appendChild(front);
    this.overlay.appendChild(this.card);

    // Edge glow element (Epic+)
    if (this.config.hasGlow) {
      const glowEl = document.createElement('div');
      glowEl.className = 'gacha-edge-glow';
      glowEl.setAttribute('data-rarity', this.rarity);
      this.overlay.appendChild(glowEl);
    }

    // Canvas (Epic+)
    if (this.config.particles > 0) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'gacha-particles';
      this.overlay.appendChild(this.canvas);
    }

    document.body.appendChild(this.overlay);

    // Events
    this._onClick = function() {
      // Click skips current + opens modal (handled by caller)
      var gq = window.__gachaQueue;
      if (gq && gq.currentReveal) gq.currentReveal.skip();
    };
    this._onKey = function(e) {
      if (e.key === 'Escape') {
        var gq = window.__gachaQueue;
        if (gq) gq.skipAll();
      }
    };
    this.overlay.addEventListener('click', this._onClick);
    document.addEventListener('keydown', this._onKey);
  }

  _playEntry(cb) {
    var entryClass = this.config.entry === 'drop' ? 'entry-drop'
      : this.config.entry === 'scale' ? 'entry-scale'
      : 'entry-fade';
    this.card.classList.add(entryClass);

    var entryTime = Math.min(this.config.duration * 0.25, 500);
    setTimeout(cb, entryTime);
  }

  _showFront() {
    var back = this.card.querySelector('.gacha-card-face.back');
    if (back) back.style.display = 'none';
    var front = this.card.querySelector('.gacha-card-face.front');
    if (front) {
      front.style.transform = 'none';
      front.style.backfaceVisibility = 'visible';
    }
  }

  _playFlip(cb) {
    if (this.config.soundAt === 'flip') this._playSound();
    this.card.classList.add('flip');

    if (this.config.hasRing) {
      var ring = document.createElement('div');
      ring.className = 'gacha-impact-ring';
      ring.style.setProperty('--card-color', gachaRarityColor(this.rarity));
      this.overlay.appendChild(ring);
    }

    if (this.config.hasShake) {
      this.overlay.classList.add('gacha-shake');
    }

    var flipTime = Math.min(this.config.duration * 0.35, 800);
    setTimeout(cb, flipTime);
  }

  _playEffects(cb) {
    if (this.canvas && this.config.particles > 0) {
      this.particles = new ParticleSystem(this.canvas, this.rarity);
      this._onResize = function() {
        if (this && this.particles) this.particles.resize();
      }.bind(this);
      window.addEventListener('resize', this._onResize);
      this.particles.start();
    }

    var effectsTime = Math.min(this.config.duration * 0.4, 1200);
    setTimeout(cb, effectsTime);
  }

  _autoDismiss() {
    if (this.noAutoDismiss) {
      // Resolve immediately so queue can continue, but leave overlay visible.
      // User dismisses by clicking anywhere or pressing Escape.
      if (this.resolvePromise) this.resolvePromise();
      return;
    }
    var dwellTime = Math.max(this.config.duration * 0.25, 400);
    setTimeout(function() {
      if (this.destroyed) return;
      if (this.config.soundAt === 'end') this._playSound();
      this._cleanup();
      if (this.resolvePromise) this.resolvePromise();
    }.bind(this), dwellTime);
  }

  _playSound() {
    var soundToggle = document.getElementById('sound-toggle');
    if (soundToggle && !soundToggle.checked) return;
    if (typeof window.__playAchievementSound === 'function') {
      window.__playAchievementSound(this.rarity);
    }
  }

  _cleanup() {
    if (this.particles) {
      this.particles.stop();
      this.particles = null;
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    document.removeEventListener('keydown', this._onKey);
    this.destroyed = true;
  }

  _esc(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// ── GachaQueue — manages multiple unlock animations ─────

class GachaQueue {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.onDrain = null;
    this.currentReveal = null;
    window.__gachaQueue = this;
  }

  enqueue(achievements, options) {
    options = options || {};
    // Store for playNext to pass to GachaReveal
    this._enqueueOpts = options;
    var sorted = [].concat(achievements).sort(function(a, b) {
      var ra = __gachaRARITY_ORDER.indexOf(a.rarity) || 0;
      var rb = __gachaRARITY_ORDER.indexOf(b.rarity) || 0;
      if (ra !== rb) return ra - rb;
      return (a.unlocked_at || '').localeCompare(b.unlocked_at || '');
    });

    this.queue = this.queue.concat(sorted);
    if (options.onDrain) this.onDrain = options.onDrain;

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.playNext();
    }
  }

  playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      // Keep currentReveal alive for noAutoDismiss replays so user can click/Esc to dismiss
      if (!(this.currentReveal && this.currentReveal.noAutoDismiss)) {
        this.currentReveal = null;
      }
      this._drain();
      return;
    }

    // Check simple animations mode
    var animToggle = document.getElementById('anim-toggle');
    if (animToggle && !animToggle.checked) {
      // Simple mode: skip all gacha
      this.queue = [];
      this.isPlaying = false;
      this.currentReveal = null;
      this._drain();
      return;
    }

    var ach = this.queue.shift();
    var opts = this._enqueueOpts;
    var reveal = new GachaReveal(ach, opts);
    this.currentReveal = reveal;

    reveal.start().then(function() {
      if (reveal.noAutoDismiss) {
        // Keep overlay alive — user dismisses by click or Escape.
        // Don't call destroy() and keep currentReveal so skip() works.
      } else {
        reveal.destroy();
        this.currentReveal = null;
      }

      // Continue queue on next tick with small delay between animations
      setTimeout(function() {
        this.playNext();
      }.bind(this), 150);
    }.bind(this));
  }

  skipAll() {
    if (this.currentReveal) {
      this.currentReveal.skip();
      this.currentReveal = null;
    }
    this.queue = [];
    this.isPlaying = false;
    this._drain();
  }

  _drain() {
    if (this.onDrain) {
      var cb = this.onDrain;
      this.onDrain = null;
      cb();
    }
  }
}

// ── Singleton ───────────────────────────────────────────
var gachaQueue = new GachaQueue();
window.gachaQueue = gachaQueue;

})();
