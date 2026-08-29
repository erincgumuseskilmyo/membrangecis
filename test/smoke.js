const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
});

const { window } = dom;

// ---- Stubs for browser APIs jsdom doesn't implement ----

window.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return {
    clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop, arc: noop, ellipse: noop,
    arcTo: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    translate: noop, setTransform: noop, drawImage: noop,
    rotate: noop, scale: noop, clip: noop, roundRect: noop, setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    fillText: noop, measureText: () => ({ width: 10 }),
    set fillStyle(v) {}, get fillStyle() { return '#000'; },
    set strokeStyle(v) {}, get strokeStyle() { return '#000'; },
    set globalAlpha(v) {}, get globalAlpha() { return 1; },
    set globalCompositeOperation(v) {},
    set lineWidth(v) {}, get lineWidth() { return 1; },
    set font(v) {}, set textAlign(v) {},
    set textBaseline(v) {}, set shadowColor(v) {}, set shadowBlur(v) {},
    set lineCap(v) {}, set lineJoin(v) {}, set filter(v) {},
  };
};

window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { width: 380, height: 640, top: 0, left: 0, right: 380, bottom: 640 };
};

let rafId = 0;
window.requestAnimationFrame = (cb) => {
  rafId++;
  if (rafId < 5) setTimeout(() => cb(rafId * 16), 0);
  return rafId;
};

class FakeAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  createOscillator() {
    return { type: '', frequency: { value: 0 }, connect: () => {}, start: () => {}, stop: () => {} };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }
  resume() {}
}
window.AudioContext = FakeAudioContext;

window.fetch = () => Promise.reject(new Error('no network in test'));

// jsdom ses dosyası oynatamaz: yükleme hatasını simüle edip
// AudioManager'ın sentezlenmiş yedek ton yoluna düşmesini test ediyoruz.
window.Audio = class {
  constructor() { this._h = {}; }
  addEventListener(type, fn) {
    this._h[type] = fn;
    if (type === 'error') setTimeout(() => fn(), 0);
  }
  set src(v) {}
  play() { throw new Error('jsdom cannot play audio'); }
};

window.Image = class {
  constructor() { setTimeout(() => this.onerror && this.onerror(), 0); }
  set src(v) {}
};

let errors = [];
window.addEventListener('error', (e) => {
  errors.push(e.error ? (e.error.stack || e.error.message) : e.message);
});
process.on('unhandledRejection', (err) => {
  errors.push('unhandledRejection: ' + (err.stack || err));
});

// ---- Load scripts in order (mirrors index.html) ----
const scripts = [
  'js/config.js', 'js/assets.js', 'js/audio.js', 'js/timer.js', 'js/transport.js',
  'js/particle.js', 'js/player.js', 'js/score.js', 'js/leaderboard.js',
  'js/ui.js', 'js/game.js',
];

const exposeForTest = `
;window.__test = { PARTICLE_DEFS, Particle, TRANSPORT_MODES, Timer };
`;
const combined =
  scripts.map((s) => fs.readFileSync(path.join(root, s), 'utf8')).join('\n;\n') +
  exposeForTest;
window.eval(combined);
const { PARTICLE_DEFS, Particle, TRANSPORT_MODES } = window.__test;

window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));

setTimeout(() => {
  try {
    const doc = window.document;
    const game = window.membraneRunGame;
    if (!game) throw new Error('Game instance oluşturulamadı');

    // Simulate filling the form & starting the game
    doc.getElementById('input-name').value = 'Test Öğrenci';
    doc.getElementById('input-studentno').value = '12345';
    doc.getElementById('btn-start').click();

    if (game.state !== 'countdown') throw new Error('Oyun countdown durumuna geçmedi: ' + game.state);

    // fast-forward past countdown
    game.state = 'playing';
    game.timer.start();

    // simulate a few loop ticks with manual update calls
    for (let i = 0; i < 30; i++) {
      game._update(0.1);
      game._render(i * 0.1);
    }

    // simulate keyboard controls
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    game._update(0.1);
    window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    if (game.state !== 'paused') throw new Error('ESC ile duraklatma çalışmadı: ' + game.state);
    game.resume();

    // force a particle through success + wrong + missed paths
    const waterDef = PARTICLE_DEFS.water;
    const pSuccess = new Particle(waterDef, 50, game.membraneY, game.fieldHeight, 80);
    game.transport.index = TRANSPORT_MODES.findIndex((m) => m.id === 'osmosis');
    game.channel.x = 50;
    pSuccess.y = game.membraneY;
    game.particles.push(pSuccess);
    game._update(0.016);

    const pWrong = new Particle(PARTICLE_DEFS.oxygen, 50, game.membraneY, game.fieldHeight, 80);
    pWrong.y = game.membraneY;
    game.channel.x = 50;
    game.transport.index = TRANSPORT_MODES.findIndex((m) => m.id === 'osmosis'); // yanlış mekanizma oksijen için
    game.particles.push(pWrong);
    game._update(0.016);

    // kanaldan uzakta, hizasiz gecen madde -> "kacirildi"
    game.channel.x = game.fieldWidth - 20;
    const pMissed = new Particle(PARTICLE_DEFS.hormone, 10, game.membraneY, game.fieldHeight, 5000);
    pMissed.y = game.fieldHeight + 100; // dogrudan exit sinirinin otesinde
    game.particles.push(pMissed);
    game._update(0.016);

    // her taşıma mekanizmasının en az bir maddesi olmalı
    const covered = new Set(Object.values(PARTICLE_DEFS).map((d) => d.correctMechanism));
    TRANSPORT_MODES.forEach((m) => {
      if (!covered.has(m.id)) throw new Error('Bu mekanizma için madde yok: ' + m.id);
    });

    // 1-6 tuşuyla doğrudan mekanizma seçimi
    const activeIdx = TRANSPORT_MODES.findIndex((m) => m.id === 'active_transport');
    window.dispatchEvent(new window.KeyboardEvent('keydown', {
      key: String(activeIdx + 1), bubbles: true, cancelable: true,
    }));
    if (game.transport.current.id !== 'active_transport') {
      throw new Error('Sayı tuşuyla mekanizma seçimi çalışmadı: ' + game.transport.current.id);
    }

    // aktif taşıma: +25 ve ATP -1
    const atpBefore = game.score.atp;
    const pNa = new Particle(PARTICLE_DEFS.sodium_ion, 120, game.membraneY, game.fieldHeight, 80);
    pNa.y = game.membraneY;
    game.channel.x = 120;
    game.particles.push(pNa);
    game._update(0.016);
    if (game.score.atp !== atpBefore - 1) throw new Error('Aktif taşımada ATP harcanmadı');

    if (game.score.correctCount < 1) throw new Error('Doğru geçiş sayılmadı');
    if (game.score.wrongCount < 1) throw new Error('Yanlış geçiş sayılmadı');
    if (game.score.missedCount < 1) throw new Error('Kaçırılan madde sayılmadı');

    // finish game -> results screen
    game.onTimeUp();

    setTimeout(() => {
      if (errors.length) {
        console.error('HATALAR BULUNDU:\n' + errors.join('\n---\n'));
        process.exit(1);
      } else {
        console.log('SMOKE TEST OK');
        console.log('score:', game.score.score, 'correct:', game.score.correctCount,
          'wrong:', game.score.wrongCount, 'missed:', game.score.missedCount,
          'atp:', game.score.atp, 'isabet: %' + game.score.accuracy);
        process.exit(0);
      }
    }, 50);
  } catch (err) {
    console.error('TEST HATASI:', err.stack || err);
    process.exit(1);
  }
}, 100);
