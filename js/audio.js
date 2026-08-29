/* ============================================================
   AUDIO.JS
   İki katmanlı ses sistemi:

   1) EFEKTLER  -> assets/sfx/*.wav (Kenney "Interface Sounds",
      CC0 / kamu malı; bkz. assets/CREDITS.md). HTMLAudioElement
      havuzu kullanılır; böylece dosyalar hem yerel sunucuda hem de
      index.html'e çift tıklayınca (file://) çalışır.
      Bir dosya yüklenemezse aynı olay için Web Audio ile üretilen
      yedek ton çalınır — oyun sessiz kalmaz.

   2) MÜZİK -> dosya yok. Web Audio API ile üretilen sakin, döngüsel
      bir arka plan dokusu. Zorluk arttıkça temposu hafifçe artar.

   Ses ve müzik ayrı ayrı açılıp kapatılabilir; tercih tarayıcıda
   saklanır. İkisi de kapalıyken oyun tamamen normal çalışır.
============================================================ */

const SFX_MANIFEST = {
  correct: 'assets/sfx/correct.wav',
  wrong: 'assets/sfx/wrong.wav',
  missed: 'assets/sfx/missed.wav',
  atp: 'assets/sfx/atp.wav',
  combo: 'assets/sfx/combo.wav',
  switch: 'assets/sfx/switch.wav',
  tick: 'assets/sfx/tick.wav',
  start: 'assets/sfx/start.wav',
  gameover: 'assets/sfx/gameover.wav',
  click: 'assets/sfx/click.wav',
};

const SFX_VOLUME = {
  correct: 0.55,
  wrong: 0.5,
  missed: 0.4,
  atp: 0.45,
  combo: 0.6,
  switch: 0.35,
  tick: 0.45,
  start: 0.6,
  gameover: 0.6,
  click: 0.3,
};

const POOL_SIZE = 3;

class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = this._loadPref('membraneRun.soundEnabled', true);
    this.musicEnabled = this._loadPref('membraneRun.musicEnabled', true);

    this.pools = {};
    this.poolIndex = {};
    this.sampleOk = {};
    this._loadSamples();

    this._music = null;
    this._musicTimer = null;
    this._musicStep = 0;
    this._musicTempo = 0.42; // saniye/nota
  }

  /* ---------------- tercihler ---------------- */

  _loadPref(key, dflt) {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? dflt : saved === 'true';
    } catch {
      return dflt;
    }
  }

  _savePref(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* localStorage kapalı olabilir; sessizce geç */
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    this._savePref('membraneRun.soundEnabled', this.enabled);
    return this.enabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this._savePref('membraneRun.musicEnabled', this.musicEnabled);
    if (!this.musicEnabled) this.stopMusic();
    return this.musicEnabled;
  }

  /* ---------------- örnek (wav) yükleme ---------------- */

  _loadSamples() {
    if (typeof Audio === 'undefined') return;
    Object.entries(SFX_MANIFEST).forEach(([key, src]) => {
      const pool = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        try {
          const a = new Audio();
          a.preload = 'auto';
          a.volume = SFX_VOLUME[key] != null ? SFX_VOLUME[key] : 0.5;
          if (i === 0) {
            a.addEventListener('canplaythrough', () => {
              this.sampleOk[key] = true;
            });
            a.addEventListener('error', () => {
              this.sampleOk[key] = false;
            });
          }
          a.src = src;
          pool.push(a);
        } catch {
          /* Audio kullanılamıyorsa yedek tonlara düşülür */
        }
      }
      if (pool.length) {
        this.pools[key] = pool;
        this.poolIndex[key] = 0;
      }
    });
  }

  _playSample(key) {
    const pool = this.pools[key];
    if (!pool || this.sampleOk[key] === false) return false;
    const a = pool[this.poolIndex[key] % pool.length];
    this.poolIndex[key]++;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  /* ---------------- Web Audio (yedek tonlar + müzik) ---------------- */

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended' && this.ctx.resume) {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /* Tarayıcılar sesi ilk kullanıcı etkileşimine kadar bloklar;
     BAŞLA'ya basıldığında bu çağrılır. */
  unlock() {
    this._ensureCtx();
  }

  _tone(freq, duration, type = 'sine', gainPeak = 0.18, delay = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this._musicBusOrDestination());
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  _musicBusOrDestination() {
    return this.ctx.destination;
  }

  /* Örnek varsa onu, yoksa yedek tonu çalar. */
  _play(key, fallback) {
    if (!this.enabled) return;
    if (this._playSample(key)) return;
    if (fallback) fallback();
  }

  /* ---------------- olay sesleri ---------------- */

  playCorrect() {
    this._play('correct', () => {
      this._tone(523.25, 0.12, 'triangle', 0.2, 0);
      this._tone(783.99, 0.16, 'triangle', 0.18, 0.07);
    });
  }

  playWrong() {
    this._play('wrong', () => this._tone(180, 0.22, 'sawtooth', 0.16, 0));
  }

  playMissed() {
    this._play('missed', () => this._tone(140, 0.18, 'square', 0.1, 0));
  }

  playAtp() {
    this._play('atp', () => {
      this._tone(660, 0.09, 'square', 0.12, 0);
      this._tone(440, 0.12, 'square', 0.1, 0.05);
    });
  }

  playCombo() {
    this._play('combo', () => {
      this._tone(660, 0.1, 'triangle', 0.18, 0);
      this._tone(880, 0.1, 'triangle', 0.18, 0.06);
      this._tone(1108.73, 0.16, 'triangle', 0.2, 0.12);
    });
  }

  playSwitch() {
    this._play('switch', () => this._tone(520, 0.06, 'triangle', 0.1, 0));
  }

  playClick() {
    this._play('click', () => this._tone(440, 0.04, 'triangle', 0.08, 0));
  }

  playCountdownTick() {
    this._play('tick', () => this._tone(400, 0.1, 'sine', 0.15, 0));
  }

  playStart() {
    this._play('start', () => {
      this._tone(392, 0.1, 'triangle', 0.2, 0);
      this._tone(523.25, 0.1, 'triangle', 0.2, 0.08);
      this._tone(659.25, 0.2, 'triangle', 0.22, 0.16);
    });
  }

  playGameOver() {
    this._play('gameover', () => {
      this._tone(523.25, 0.15, 'triangle', 0.18, 0);
      this._tone(440, 0.15, 'triangle', 0.18, 0.14);
      this._tone(349.23, 0.3, 'triangle', 0.18, 0.28);
    });
  }

  /* ---------------- arka plan müziği (üretimsel) ----------------
     Pentatonik bir dizide yavaş arpej + altta sabit bir bas nota.
     Dosya gerektirmez, döngü dikişi duyulmaz, kısıksızdır. */

  startMusic() {
    if (!this.musicEnabled || this._musicTimer) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;

    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(ctx.destination);
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0.075, ctx.currentTime + 2.5);
    this._music = bus;
    this._musicStep = 0;

    const SCALE = [220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 587.33];
    const PATTERN = [0, 2, 4, 3, 5, 2, 6, 4, 1, 3, 5, 2];

    const tick = () => {
      if (!this._music) return;
      const now = ctx.currentTime;
      const note = SCALE[PATTERN[this._musicStep % PATTERN.length]];

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc.connect(g);
      g.connect(this._music);
      osc.start(now);
      osc.stop(now + 1.7);

      // her 4 notada bir yumuşak bas
      if (this._musicStep % 4 === 0) {
        const bass = ctx.createOscillator();
        const bg = ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.value = 110;
        bg.gain.setValueAtTime(0, now);
        bg.gain.linearRampToValueAtTime(0.35, now + 0.2);
        bg.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        bass.connect(bg);
        bg.connect(this._music);
        bass.start(now);
        bass.stop(now + 2.5);
      }

      this._musicStep++;
      this._musicTimer = setTimeout(tick, this._musicTempo * 1000);
    };
    tick();
  }

  /* Zorluk kademesine göre tempo (0 = başlangıç, 1 = en zor). */
  setMusicIntensity(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    this._musicTempo = 0.46 - r * 0.16;
  }

  stopMusic() {
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._musicTimer = null;
    }
    if (this._music && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this._music.gain.cancelScheduledValues && this._music.gain.cancelScheduledValues(now);
        this._music.gain.setValueAtTime(this._music.gain.value || 0.075, now);
        this._music.gain.linearRampToValueAtTime(0, now + 0.5);
      } catch {
        /* yoksay */
      }
    }
    this._music = null;
  }

  pauseMusic() {
    this.stopMusic();
  }
}
