/* ============================================================
   TUTORIAL.JS
   Oyun başlamadan önce altı taşıma mekanizmasını tek tek,
   "İLERİ" diyerek anlatan tanıtım.

   Her adımda mekanizmanın oyundaki GERÇEK kanal görseli
   (ChannelArt) canlı olarak çizilir ve o mekanizmayla geçen
   madde animasyonla zardan geçirilir. Böylece öğrenci oyunda
   göreceği şeyi birebir tanır.

   Son adım kontrolleri anlatır ve doğrudan oyunu başlatır.
============================================================ */

/* Her mekanizmayı temsil eden örnek madde. */
const TUTORIAL_SAMPLE = {
  simple_diffusion: 'oxygen',
  facilitated_diffusion: 'facilitated',
  osmosis: 'water',
  active_transport: 'sodium_ion',
  endocytosis: 'bacteria',
  exocytosis: 'export_product',
};

const TUTORIAL_SEEN_KEY = 'membraneRun.tutorialSeen';

class TutorialManager {
  constructor(assets, audio) {
    this.assets = assets;
    this.audio = audio;
    this.onDone = null;
    this.index = 0;
    this.raf = null;
    this._t0 = 0;

    const $ = (id) => document.getElementById(id);
    this.el = {
      modal: $('modal-tutorial'),
      canvas: $('tut-canvas'),
      dots: $('tut-dots'),
      step: $('tut-step'),
      title: $('tut-title'),
      energy: $('tut-energy'),
      info: $('tut-info'),
      subs: $('tut-subs'),
      points: $('tut-points'),
      controls: $('tut-controls'),
      stage: $('tut-stage'),
      btnPrev: $('tut-prev'),
      btnNext: $('tut-next'),
      btnSkip: $('tut-skip'),
    };
    this.ctx = this.el.canvas ? this.el.canvas.getContext('2d') : null;

    // Son adım: kontroller kartı
    this.totalSteps = TRANSPORT_MODES.length + 1;

    this._buildDots();
    this._bind();
  }

  static get seen() {
    try {
      return localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }

  static markSeen() {
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      /* localStorage kapalı olabilir */
    }
  }

  _buildDots() {
    if (!this.el.dots) return;
    this.el.dots.innerHTML = '';
    for (let i = 0; i < this.totalSteps; i++) {
      const d = document.createElement('span');
      d.className = 'tut-dot';
      this.el.dots.appendChild(d);
    }
  }

  _bind() {
    if (this.el.btnNext) {
      this.el.btnNext.addEventListener('click', () => {
        this.audio.playClick();
        if (this.index >= this.totalSteps - 1) this.finish();
        else this.go(this.index + 1);
      });
    }
    if (this.el.btnPrev) {
      this.el.btnPrev.addEventListener('click', () => {
        this.audio.playClick();
        this.go(this.index - 1);
      });
    }
    if (this.el.btnSkip) {
      this.el.btnSkip.addEventListener('click', () => {
        this.audio.playClick();
        this.finish();
      });
    }
  }

  get isOpen() {
    return this.el.modal && !this.el.modal.classList.contains('hidden');
  }

  /* onDone: tanıtım bitince (veya atlanınca) çağrılır. */
  open(onDone) {
    if (!this.el.modal) {
      if (onDone) onDone();
      return;
    }
    this.onDone = onDone || null;
    this.el.modal.classList.remove('hidden');
    this.go(0);
    this._startLoop();
  }

  finish() {
    TutorialManager.markSeen();
    this.close();
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }

  close() {
    if (this.el.modal) this.el.modal.classList.add('hidden');
    this._stopLoop();
  }

  go(index) {
    this.index = Math.max(0, Math.min(this.totalSteps - 1, index));
    this._t0 = performance.now();
    this._render(0);
    this._paintText();
  }

  _paintText() {
    const isControls = this.index === this.totalSteps - 1;
    const last = this.index >= this.totalSteps - 1;

    if (this.el.dots) {
      Array.from(this.el.dots.children).forEach((d, i) => {
        d.classList.toggle('is-active', i === this.index);
        d.classList.toggle('is-done', i < this.index);
      });
    }
    if (this.el.step) {
      this.el.step.textContent = `${this.index + 1} / ${this.totalSteps}`;
    }
    if (this.el.btnPrev) this.el.btnPrev.disabled = this.index === 0;
    if (this.el.btnNext) this.el.btnNext.textContent = last ? 'OYUNA BAŞLA' : 'İLERİ ▶';
    if (this.el.btnSkip) this.el.btnSkip.classList.toggle('hidden', last);

    if (this.el.stage) this.el.stage.classList.toggle('hidden', isControls);
    if (this.el.controls) this.el.controls.classList.toggle('hidden', !isControls);

    if (isControls) {
      if (this.el.title) {
        this.el.title.textContent = 'KONTROLLER';
        this.el.title.style.color = 'var(--membrane-gold)';
      }
      if (this.el.energy) this.el.energy.classList.add('hidden');
      if (this.el.info) this.el.info.textContent = '';
      if (this.el.subs) this.el.subs.textContent = '';
      if (this.el.points) this.el.points.classList.add('hidden');
      return;
    }

    const mode = TRANSPORT_MODES[this.index];
    const subs = Object.values(PARTICLE_DEFS)
      .filter((d) => d.correctMechanism === mode.id)
      .map((d) => d.label);

    if (this.el.title) {
      this.el.title.textContent = mode.label;
      this.el.title.style.color = mode.color;
    }
    if (this.el.energy) {
      this.el.energy.textContent = mode.energy === 'ATP' ? 'ATP HARCAR' : 'ENERJİ GEREKTİRMEZ';
      this.el.energy.classList.remove('hidden');
      this.el.energy.style.color = mode.color;
      this.el.energy.style.borderColor = mode.color;
    }
    if (this.el.info) this.el.info.textContent = mode.info;
    if (this.el.subs) this.el.subs.textContent = 'Bu yolla geçer: ' + subs.join(' · ');
    if (this.el.points) {
      this.el.points.textContent = `+${SCORE_RULES[mode.id]} puan`;
      this.el.points.classList.remove('hidden');
      this.el.points.style.color = mode.color;
    }
  }

  /* ---------------- canlı önizleme ---------------- */

  _startLoop() {
    if (this.raf || !this.ctx) return;
    const tick = () => {
      const t = (performance.now() - this._t0) / 1000;
      this._render(t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  _render(t) {
    const ctx = this.ctx;
    const cv = this.el.canvas;
    if (!ctx || !cv || this.index >= TRANSPORT_MODES.length) return;

    const rect = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || cv.width));
    const h = Math.max(1, Math.round(rect.height || cv.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const mode = TRANSPORT_MODES[this.index];
    const membraneY = Math.round(h * 0.55);
    const bandHalf = 18;

    // hücre dışı / içi zemin
    ctx.save();
    ctx.fillStyle = 'rgba(24, 68, 102, 0.35)';
    ctx.fillRect(0, 0, w, membraneY);
    ctx.fillStyle = 'rgba(8, 22, 34, 0.45)';
    ctx.fillRect(0, membraneY, w, h - membraneY);
    ctx.font = '700 9px Poppins, sans-serif';
    ctx.fillStyle = 'rgba(244,248,251,0.35)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('HÜCRE DIŞI', 8, 14);
    ctx.fillText('HÜCRE İÇİ', 8, h - 8);
    ctx.restore();

    MembraneArt.draw(ctx, this.assets, w, membraneY, bandHalf, t);

    const cx = w / 2;
    ChannelArt.draw(ctx, mode, cx, membraneY, 64, bandHalf, t);

    // örnek maddeyi zardan geçir
    const def = PARTICLE_DEFS[TUTORIAL_SAMPLE[mode.id]];
    if (def) {
      const period = 3.4;
      const p = (t % period) / period;
      const outbound = def.direction === 'out';
      const from = outbound ? h + 30 : -30;
      const to = outbound ? -30 : h + 30;
      const y = from + (to - from) * p;
      // zarın tam ortasında hafif duraklayıp küçülsün
      const d = Math.abs(y - membraneY);
      const squeeze = d < 26 ? 0.72 + (d / 26) * 0.28 : 1;
      const r = def.radius * 0.82 * squeeze;
      MoleculeArt.draw(ctx, this.assets, def, cx, y, r, { glow: d < 90 ? 1 - d / 90 : 0 });

      ctx.save();
      ctx.font = '700 10px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = def.label;
      const tw = ctx.measureText(label).width;
      const ly = outbound ? y - r - 12 : y + r + 12;
      ctx.fillStyle = 'rgba(8, 22, 34, 0.75)';
      Draw.roundRect(ctx, cx - tw / 2 - 7, ly - 8, tw + 14, 16, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(244,248,251,0.92)';
      ctx.fillText(label, cx, ly);
      ctx.restore();
    }
  }
}
