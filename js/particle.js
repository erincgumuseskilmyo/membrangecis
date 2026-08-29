/* ============================================================
   PARTICLE.JS
   Gelen maddeler, hareketleri ve spawn (üretim) sistemi.

   Not: Her taşıma mekanizmasının en az bir maddesi vardır; böylece
   altı mekanizmanın hepsi oyun boyunca gerçekten kullanılır.
============================================================ */

const PARTICLE_DEFS = {
  water: {
    type: 'water',
    label: 'SU',
    hint: 'H₂O',
    correctMechanism: 'osmosis',
    points: 20,
    assetKey: 'particle_water',
    color: '#63B3ED',
    fallbackInk: '#1a4e7a',
    radius: 23,
    direction: 'in',
  },
  oxygen: {
    type: 'oxygen',
    label: 'OKSİJEN',
    hint: 'O₂ — küçük, yüksüz',
    correctMechanism: 'simple_diffusion',
    points: 20,
    assetKey: 'particle_oxygen',
    color: '#68D391',
    fallbackInk: '#c53030',
    radius: 22,
    direction: 'in',
  },
  hormone: {
    type: 'hormone',
    label: 'STEROİD HORMON',
    hint: 'Yağda çözünür',
    correctMechanism: 'simple_diffusion',
    points: 20,
    assetKey: 'particle_hormone',
    color: '#F6E05E',
    fallbackInk: '#7b5c00',
    radius: 24,
    direction: 'in',
  },
  facilitated: {
    type: 'facilitated',
    label: 'GLUKOZ',
    hint: 'Taşıyıcı protein gerekir',
    correctMechanism: 'facilitated_diffusion',
    points: 20,
    assetKey: 'particle_facilitated',
    color: '#B794F4',
    fallbackInk: '#4c1d95',
    radius: 24,
    direction: 'in',
  },
  sodium_ion: {
    type: 'sodium_ion',
    label: 'SODYUM Na⁺',
    hint: 'Gradyana karşı — ATP gerekir',
    correctMechanism: 'active_transport',
    points: 25,
    assetKey: 'particle_sodium_ion',
    color: '#F6AD55',
    fallbackInk: '#9c4221',
    radius: 22,
    direction: 'in',
  },
  big_molecule: {
    type: 'big_molecule',
    label: 'BÜYÜK PROTEİN',
    hint: 'Kanaldan geçemeyecek kadar büyük',
    correctMechanism: 'endocytosis',
    points: 30,
    assetKey: 'particle_big_molecule',
    color: '#F687B3',
    fallbackInk: '#702459',
    radius: 29,
    direction: 'in',
  },
  bacteria: {
    type: 'bacteria',
    label: 'BAKTERİ',
    hint: 'Fagositoz ile alınır',
    correctMechanism: 'endocytosis',
    points: 30,
    assetKey: 'particle_bacteria',
    color: '#68D391',
    fallbackInk: '#276749',
    radius: 28,
    direction: 'in',
    isPhagocytosis: true,
  },
  export_product: {
    type: 'export_product',
    label: 'ANTİKOR',
    hint: 'Hücreden dışarı atılır',
    correctMechanism: 'exocytosis',
    points: 30,
    assetKey: 'particle_export_product',
    color: '#FC8181',
    fallbackInk: '#822727',
    radius: 25,
    direction: 'out', // hücre içinden dışa
  },
};

const PARTICLE_KEYS = Object.keys(PARTICLE_DEFS);

/* Her mekanizmanın çıkma olasılığı eşit olsun diye ağırlık:
   bir mekanizmayı iki madde paylaşıyorsa her biri yarı ağırlıkta. */
const PARTICLE_WEIGHTS = (() => {
  const perMechanism = {};
  PARTICLE_KEYS.forEach((k) => {
    const m = PARTICLE_DEFS[k].correctMechanism;
    perMechanism[m] = (perMechanism[m] || 0) + 1;
  });
  const w = {};
  PARTICLE_KEYS.forEach((k) => {
    w[k] = 1 / perMechanism[PARTICLE_DEFS[k].correctMechanism];
  });
  return w;
})();

class Particle {
  constructor(def, x, membraneY, fieldHeight, speed) {
    this.def = def;
    this.x = x;
    this.membraneY = membraneY;
    this.speed = speed;
    this.state = 'moving'; // moving | resolved
    this.resolution = null; // 'success' | 'wrong' | 'missed'
    this.progress = 0; // çözümleme animasyonu (0-1)
    this.wobbleSeed = Math.random() * Math.PI * 2;

    if (def.direction === 'in') {
      this.y = -40;
      this.vy = speed;
      this.exitY = fieldHeight + 60;
    } else {
      this.y = fieldHeight + 40;
      this.vy = -speed;
      this.exitY = -60;
    }
    this.crossedMembrane = false;
  }

  get isInbound() {
    return this.def.direction === 'in';
  }

  /* Zara ne kadar yakın (0 = uzak, 1 = zarın üstünde).
     Yaklaşma efekti ve öğrenme modundaki ipucu için kullanılır. */
  get approach() {
    const d = Math.abs(this.y - this.membraneY);
    return Math.max(0, 1 - d / 150);
  }

  update(dt) {
    if (this.state === 'resolved') {
      this.progress = Math.min(1, this.progress + dt * 2.6);
      return;
    }
    this.y += this.vy * dt;
  }

  // Zara ulaştı mı? (zar çizgisine değme anı)
  hasReachedMembrane() {
    if (this.crossedMembrane) return false;
    if (this.isInbound && this.y >= this.membraneY) return true;
    if (!this.isInbound && this.y <= this.membraneY) return true;
    return false;
  }

  hasExited() {
    if (this.isInbound) return this.y >= this.exitY;
    return this.y <= this.exitY;
  }

  resolve(kind) {
    this.state = 'resolved';
    this.resolution = kind;
    this.progress = 0;
    if (kind === 'success') {
      this.vy = 0; // kanaldan geçirilir, animasyonla kaybolur
    }
  }
}

class ParticleSpawner {
  constructor(fieldWidthGetter) {
    this.getFieldWidth = fieldWidthGetter;
    this.timeSinceSpawn = 0;
    this.rng = Math.random;
    this.recent = [];
    this.easyMode = false; // öğrenme modunda zorluk daha yavaş artar
  }

  reset(easyMode) {
    this.timeSinceSpawn = 0;
    this.recent = [];
    this.easyMode = !!easyMode;
  }

  /* Zaman bazlı zorluk kademeleri (120 saniyelik oyun, 5 x 24 sn).

     Hız belirgin biçimde YAVAŞ başlar (50 px/sn) ve kademe kademe
     artarak son kademede 165 px/sn'ye ulaşır — bu, eski 5 dakikalık
     sürümün en yüksek hızıdır, yani oyun hiçbir zaman eskisinden
     hızlı akmaz; sadece oraya daha kısa sürede varır. */
  getDifficulty(elapsedSeconds) {
    const t = this.easyMode ? elapsedSeconds * 0.6 : elapsedSeconds;
    if (t < 24) {
      return { spawnInterval: 2.9, speed: 50, maxConcurrent: 1, tier: 'ISINMA' };
    } else if (t < 48) {
      return { spawnInterval: 2.4, speed: 75, maxConcurrent: 2, tier: 'KOLAY' };
    } else if (t < 72) {
      return { spawnInterval: 2.0, speed: 100, maxConcurrent: 2, tier: 'ORTA' };
    } else if (t < 96) {
      return { spawnInterval: 1.6, speed: 130, maxConcurrent: 3, tier: 'ZOR' };
    }
    return { spawnInterval: 1.3, speed: 165, maxConcurrent: 3, tier: 'ÇOK ZOR' };
  }

  /* Ağırlıklı seçim + aynı maddenin arka arkaya tekrarını engelleme. */
  pickDefinition() {
    for (let attempt = 0; attempt < 6; attempt++) {
      const key = this._weightedKey();
      if (this.recent.length < 2 || !this.recent.slice(-2).every((k) => k === key)) {
        this.recent.push(key);
        if (this.recent.length > 4) this.recent.shift();
        return PARTICLE_DEFS[key];
      }
    }
    const fallback = PARTICLE_KEYS[Math.floor(this.rng() * PARTICLE_KEYS.length)];
    this.recent.push(fallback);
    if (this.recent.length > 4) this.recent.shift();
    return PARTICLE_DEFS[fallback];
  }

  _weightedKey() {
    const total = PARTICLE_KEYS.reduce((s, k) => s + PARTICLE_WEIGHTS[k], 0);
    let roll = this.rng() * total;
    for (const k of PARTICLE_KEYS) {
      roll -= PARTICLE_WEIGHTS[k];
      if (roll <= 0) return k;
    }
    return PARTICLE_KEYS[PARTICLE_KEYS.length - 1];
  }

  /* Aynı anda ekranda olan maddelerin üst üste binmemesi için
     yatayda yeterince uzak bir konum arar. */
  _pickX(def, activeParticles) {
    const w = this.getFieldWidth();
    const margin = def.radius + 22;
    const span = Math.max(1, w - margin * 2);
    let best = margin + this.rng() * span;
    let bestGap = -1;
    for (let i = 0; i < 8; i++) {
      const x = margin + this.rng() * span;
      let gap = Infinity;
      for (const p of activeParticles) {
        if (p.state !== 'moving') continue;
        gap = Math.min(gap, Math.abs(p.x - x));
      }
      if (gap === Infinity) return x;
      if (gap > bestGap) {
        bestGap = gap;
        best = x;
      }
      if (gap > def.radius * 3) break;
    }
    return best;
  }

  update(dt, elapsedSeconds, activeParticles, membraneY, fieldHeight) {
    const diff = this.getDifficulty(elapsedSeconds);
    const movingCount = activeParticles.filter((p) => p.state === 'moving').length;
    this.timeSinceSpawn += dt;
    const spawned = [];
    if (this.timeSinceSpawn >= diff.spawnInterval && movingCount < diff.maxConcurrent) {
      this.timeSinceSpawn = 0;
      const def = this.pickDefinition();
      const x = this._pickX(def, activeParticles);
      spawned.push(new Particle(def, x, membraneY, fieldHeight, diff.speed));
    }
    return { spawned, tier: diff.tier, speed: diff.speed };
  }
}
