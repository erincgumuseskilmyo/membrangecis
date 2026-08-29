/* ============================================================
   SCORE.JS
   Skor, combo, ATP ve mekanizma bazlı istatistik yönetimi.
============================================================ */

const SCORE_RULES = {
  simple_diffusion: 20,
  facilitated_diffusion: 20,
  osmosis: 20,
  active_transport: 25,
  endocytosis: 30,
  exocytosis: 30,
  wrong: -10,
  missed: -5,
  comboBonus5: 50,
  comboBonus10: 100,
};

const START_ATP = 20;

class ScoreManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.atp = START_ATP;
    this.atpSpent = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.missedCount = 0;

    // Mekanizma bazlı doğru/yanlış dökümü (sonuç ekranındaki geri bildirim)
    this.byMechanism = {};
    TRANSPORT_MODES.forEach((m) => {
      this.byMechanism[m.id] = { correct: 0, wrong: 0 };
    });
  }

  _add(points) {
    this.score = Math.max(0, this.score + points);
  }

  // returns { points, comboBonus, comboMilestone }
  registerCorrect(mechanismId) {
    const base = SCORE_RULES[mechanismId] || 0;
    this._add(base);
    this.correctCount++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.byMechanism[mechanismId]) this.byMechanism[mechanismId].correct++;

    let comboBonus = 0;
    let comboMilestone = null;
    if (this.combo % 10 === 0) {
      comboBonus = SCORE_RULES.comboBonus10;
      comboMilestone = 10;
    } else if (this.combo % 5 === 0) {
      comboBonus = SCORE_RULES.comboBonus5;
      comboMilestone = 5;
    }
    if (comboBonus > 0) this._add(comboBonus);

    if (mechanismId === 'active_transport') {
      this.atp = Math.max(0, this.atp - 1);
      this.atpSpent++;
    }

    return { points: base, comboBonus, comboMilestone };
  }

  /* expectedMechanismId: maddenin doğru mekanizması (istatistik için) */
  registerWrong(expectedMechanismId) {
    this._add(SCORE_RULES.wrong);
    this.wrongCount++;
    this.combo = 0;
    if (expectedMechanismId && this.byMechanism[expectedMechanismId]) {
      this.byMechanism[expectedMechanismId].wrong++;
    }
  }

  registerMissed() {
    this._add(SCORE_RULES.missed);
    this.missedCount++;
    this.combo = 0;
  }

  get attempts() {
    return this.correctCount + this.wrongCount + this.missedCount;
  }

  get accuracy() {
    return this.attempts === 0 ? 0 : Math.round((this.correctCount / this.attempts) * 100);
  }

  /* En çok yanlış yapılan mekanizma — sonuç ekranındaki çalışma önerisi.
     En az 2 hata olmadan öneri verilmez (rastgele tek hatayı öne çıkarmamak için). */
  get weakestMechanism() {
    let worst = null;
    Object.entries(this.byMechanism).forEach(([id, s]) => {
      if (s.wrong < 2) return;
      if (!worst || s.wrong > worst.wrong) worst = { id, ...s };
    });
    return worst;
  }
}
