/* ============================================================
   GAME.JS
   Ana oyun döngüsü, çarpışma/çözümleme mantığı, state machine
   ve tüm oyun alanı çizimi.
============================================================ */

/* Oyun süresi. 2 dakika: bir ders saatinde sınıfça birkaç tur
   oynanabilsin diye kısa tutuldu. */
const GAME_SECONDS = 120;

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.field = document.getElementById('game-field');

    this.assets = new AssetManager(ASSET_MANIFEST);
    this.audio = new AudioManager();

    this.transport = new TransportSystem();
    this.channel = new Channel(() => this.fieldWidth);
    this.score = new ScoreManager();
    this.spawner = new ParticleSpawner(() => this.fieldWidth);
    this.timer = new Timer(GAME_SECONDS, (r) => this.onTick(r), () => this.onTimeUp());
    this.leaderboard = new LeaderboardManager();
    this.tutorial = new TutorialManager(this.assets, this.audio);

    this.particles = [];
    this.effects = [];
    this.state = 'start'; // start | countdown | playing | paused | gameover
    this.fieldWidth = 0;
    this.fieldHeight = 0;
    this.membraneY = 0;
    this.bandHalf = 22;
    this.shake = 0;
    this.tier = 'KOLAY';
    this.gameMode = 'exam';
    this.player = { name: 'Öğrenci', studentNo: '' };

    this.ui = new UIManager(
      {
        onStart: () => this.handleStart(),
        onPauseToggle: () => this.togglePause(),
        onResume: () => this.resume(),
        onQuit: () => this.quitToMenu(),
        onReplay: () => this.handleStart(),
        onRequestLeaderboard: () => this.openLeaderboard(),
        onRefreshBoard: () => this.refreshResultsBoard(),
        onMoveDir: (dir) => this.channel.setDirection(dir),
        onDragTo: (ratio) => this.handleDragTo(ratio),
        isOnMembrane: (ratio) => this.isOnMembrane(ratio),
        onTutorial: () => this.openTutorial(),
        onTransportChange: (dir) => this.handleTransportChange(dir),
        onTransportSelect: (index) => this.handleTransportSelect(index),
        onMusicEnabled: () => {
          if (this.state === 'playing') this.audio.startMusic();
        },
      },
      this.audio
    );

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Sekme arka plana geçerse oyun kendiliğinden duraklasın
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });

    this.assets.preload().then(() => this.ui.setAssetsReady(true));

    this._lastTs = null;
    requestAnimationFrame((ts) => this._loop(ts));
  }

  _resize() {
    const rect = this.field.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.fieldWidth = Math.max(1, rect.width);
    this.fieldHeight = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.fieldWidth * dpr);
    this.canvas.height = Math.round(this.fieldHeight * dpr);
    this.canvas.style.width = this.fieldWidth + 'px';
    this.canvas.style.height = this.fieldHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Maddelerin 8'inden 7'si yukarıdan geldiği için zar merkezin
    // biraz altında: oyuncu geleni daha erken görür ve daha uzun
    // süre karar verebilir.
    this.membraneY = Math.round(this.fieldHeight * 0.6);
    this.bandHalf = Math.max(18, Math.min(32, this.fieldHeight * 0.05));

    if (this.channel.x === 0) {
      this.channel.reset();
    } else {
      this.channel.x = Math.min(
        Math.max(this.channel.x, this.channel.radius),
        this.fieldWidth - this.channel.radius
      );
    }
  }

  /* ---------------- State transitions ---------------- */

  /* İlk kez oynayan (veya öğrenme modunu seçen) oyuncuya önce
     mekanizma tanıtımını gösterir; sonra turu başlatır. */
  handleStart() {
    const needsTutorial = !TutorialManager.seen || this.ui.gameMode === 'learn';
    if (needsTutorial && !this.tutorial.isOpen) {
      this.tutorial.open(() => this._beginRound());
      return;
    }
    this._beginRound();
  }

  openTutorial() {
    this.tutorial.open(null);
  }

  handleDragTo(ratio) {
    if (this.state !== 'playing') return;
    this.channel.setX(ratio * this.fieldWidth);
  }

  /* Dokunulan nokta zar bandının üstünde mi? (mekanizma değiştirme bölgesi) */
  isOnMembrane(yRatio) {
    if (!this.fieldHeight) return false;
    const y = yRatio * this.fieldHeight;
    return Math.abs(y - this.membraneY) <= this.bandHalf * 2.6;
  }

  _beginRound() {
    this.player = this.ui.getPlayerInfo();
    this.gameMode = this.ui.gameMode;
    this.leaderboard.savePlayer(this.player.name, this.player.studentNo);
    this.audio.unlock();

    this.score.reset();
    this.transport.reset();
    this.particles = [];
    this.effects = [];
    this.channel.reset();
    this.spawner.reset(this.gameMode === 'learn');
    this.timer.reset();
    this.shake = 0;
    this.tier = 'KOLAY';

    this.ui.updateScore(0);
    this.ui.updateAtp(START_ATP);
    this.ui.updateCombo(0);
    this.ui.updateTime(this.timer.totalSeconds);
    this.ui.updateTier(this.tier);
    this.ui.updateTransportMode(this.transport.current);
    this.ui.showResultsOnlineStatus(null);

    this.ui.showScreen('game');
    // Oyun ekranı görünür olmadan canvas ölçülemez (display:none -> 0x0),
    // bu yüzden ekranı gösterdikten HEMEN SONRA yeniden ölçüyoruz.
    this._resize();
    this.channel.reset();

    this.hintUntil = 0;
    this.state = 'countdown';
    this.ui.runCountdown(() => {
      if (this.state !== 'countdown') return; // kullanıcı ana menüye dönmüş olabilir
      this.state = 'playing';
      this.hintUntil = this.timer.totalSeconds - 7; // ilk 7 saniye ipucu
      this.timer.start();
      this.audio.startMusic();
    });
  }

  handleTransportChange(dir) {
    if (this.state !== 'playing') return;
    const mode = this.transport.change(dir);
    this.ui.updateTransportMode(mode);
    this.audio.playSwitch();
  }

  handleTransportSelect(index) {
    if (this.state !== 'playing') return;
    const mode = this.transport.selectIndex(index);
    if (!mode) return;
    this.ui.updateTransportMode(mode);
    this.audio.playSwitch();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.timer.pause();
    this.channel.setDirection(0);
    this.audio.pauseMusic();
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.timer.resume();
    this.audio.startMusic();
    this.ui.hidePause();
  }

  quitToMenu() {
    this.state = 'start';
    this.timer.pause();
    this.particles = [];
    this.effects = [];
    this.channel.setDirection(0);
    this.audio.stopMusic();
    this.ui.hidePause();
    this.ui.showScreen('start');
  }

  onTick(remaining) {
    this.ui.updateTime(remaining);
  }

  onTimeUp() {
    this.state = 'gameover';
    this.channel.setDirection(0);
    this.audio.stopMusic();
    this.finishGame();
  }

  async finishGame() {
    const stats = {
      score: this.score.score,
      correctCount: this.score.correctCount,
      wrongCount: this.score.wrongCount,
      missedCount: this.score.missedCount,
      maxCombo: this.score.maxCombo,
      atpSpent: this.score.atpSpent,
      accuracy: this.score.accuracy,
      attempts: this.score.attempts,
      byMechanism: this.score.byMechanism,
      weakest: this.score.weakestMechanism,
      gameMode: this.gameMode,
      durationSeconds: this.timer.totalSeconds,
    };
    this.ui.renderResults(stats);
    this.ui.showScreen('results');
    this.audio.playGameOver();

    // Öğrenme modunda ipuçları açık olduğu için skor tabloya işlenmez.
    if (this.gameMode === 'learn') {
      this.ui.showResultsOnlineStatus(
        'Öğrenme modu skorları kaydedilmez. Değerlendirme modunda oynayarak tabloya gir.'
      );
      await this.refreshResultsBoard();
      return;
    }

    const payload = {
      name: this.player.name,
      studentNo: this.player.studentNo,
      ...stats,
    };
    const result = await this.leaderboard.submitScore(payload);
    if (!result.ok) {
      this.ui.showResultsOnlineStatus(
        this.leaderboard.statusMessage || 'Skor bu cihazda kaydedildi.'
      );
    } else {
      this.ui.showResultsOnlineStatus(null);
    }
    await this.refreshResultsBoard();
  }

  /* Sonuç ekranındaki skor tablosunu (yeniden) yükler. */
  async refreshResultsBoard() {
    this.ui.setBoardLoading(this.ui.el.resLeaderboard);
    const board = await this.leaderboard.fetchTop();
    this.ui.renderResultsBoard(board, this.leaderboard.statusMessage, this.player);
  }

  async openLeaderboard() {
    this.ui.openModal(this.ui.el.modalLeaderboard);
    this.ui.setBoardLoading(this.ui.el.leaderboardList);
    const board = await this.leaderboard.fetchTop();
    this.ui.renderLeaderboard(board, this.leaderboard.statusMessage, this.player);
  }

  /* ---------------- Main loop ---------------- */

  _loop(ts) {
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    dt = Math.min(dt, 0.05);

    if (this.state === 'playing') {
      this._update(dt);
    }
    this._render(ts / 1000);
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    this.timer.update(dt);
    this.channel.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 34);

    const elapsed = this.timer.elapsed;
    const { spawned, tier } = this.spawner.update(
      dt,
      elapsed,
      this.particles,
      this.membraneY,
      this.fieldHeight
    );
    this.particles.push(...spawned);

    if (tier !== this.tier) {
      this.tier = tier;
      this.ui.updateTier(tier);
    }
    this.audio.setMusicIntensity(elapsed / this.timer.totalSeconds);

    for (const p of this.particles) {
      p.update(dt);
      if (p.state === 'moving' && p.hasReachedMembrane()) {
        this._resolveParticle(p);
      }
    }

    const remaining = [];
    for (const p of this.particles) {
      if (p.state === 'moving') {
        if (p.hasExited()) {
          this._handleMissed(p);
        } else {
          remaining.push(p);
        }
      } else if (p.progress < 1) {
        remaining.push(p);
      }
    }
    this.particles = remaining;

    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);

    this.ui.updateScore(this.score.score);
    this.ui.updateAtp(this.score.atp);
    this.ui.updateCombo(this.score.combo);
  }

  _resolveParticle(p) {
    p.crossedMembrane = true;
    const tolerance = p.def.radius + this.channel.radius * 0.55;
    const aligned = Math.abs(p.x - this.channel.x) < tolerance;
    const mechanismOk = this.transport.current.id === p.def.correctMechanism;

    if (aligned && mechanismOk) {
      p.resolve('success');
      const { points, comboBonus, comboMilestone } = this.score.registerCorrect(
        p.def.correctMechanism
      );
      this.audio.playCorrect();
      this._addEffect('ring', this.channel.x, this.membraneY, this.transport.current.color, 0.55);
      if (p.def.correctMechanism === 'endocytosis' || p.def.correctMechanism === 'exocytosis') {
        this._addEffect('vesicle', this.channel.x, this.membraneY, this.transport.current.color, 0.8);
      }
      this.ui.showToast(
        'correct',
        `✓ ${this.transport.current.short}  +${points}`,
        p.x / this.fieldWidth,
        p.y / this.fieldHeight
      );
      if (p.def.correctMechanism === 'active_transport') {
        this._addEffect('atp', this.channel.x, this.membraneY - this.bandHalf, '#ffe08a', 0.6);
        setTimeout(() => {
          this.audio.playAtp();
          this.ui.showToast(
            'atp',
            '⚡ ATP HARCANDI',
            p.x / this.fieldWidth,
            p.y / this.fieldHeight - 0.07
          );
        }, 220);
      }
      if (comboMilestone) {
        setTimeout(() => {
          this.audio.playCombo();
          this.ui.showToast('combo', `COMBO ×${this.score.combo}  +${comboBonus}`, 0.5, 0.32);
        }, 260);
      }
    } else if (aligned && !mechanismOk) {
      p.resolve('wrong');
      this.score.registerWrong(p.def.correctMechanism);
      this.audio.playWrong();
      this.shake = 9;
      this.ui.flashField('wrong');
      const expected = TRANSPORT_BY_ID[p.def.correctMechanism];
      this.ui.showToast(
        'wrong',
        this.gameMode === 'learn' ? `✕ DOĞRUSU: ${expected.short}` : '✕ YANLIŞ TAŞIMA  −10',
        p.x / this.fieldWidth,
        p.y / this.fieldHeight
      );
    }
    // hizasız ise madde durdurulmaz; ekran dışına çıkınca "kaçırıldı" işlenir.
  }

  _handleMissed(p) {
    this.score.registerMissed();
    this.audio.playMissed();
    const x = p.x / this.fieldWidth;
    const y = p.isInbound ? 0.94 : 0.06;
    this.ui.showToast('missed', 'MADDE KAÇIRILDI  −5', x, y);
  }

  _addEffect(kind, x, y, color, life) {
    this.effects.push({ kind, x, y, color, life, t: 0 });
  }

  /* ---------------- Render ---------------- */

  _render(t) {
    const ctx = this.ctx;
    const w = this.fieldWidth;
    const h = this.fieldHeight;
    ctx.clearRect(0, 0, w, h);
    if (!w || !h) return;

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }

    this._drawBackground(ctx, w, h, t);
    const gap = {
      x: this.channel.x,
      width: ChannelArt.gapWidth(this.transport.current, this.channel.radius * 2),
    };
    MembraneArt.draw(ctx, this.assets, w, this.membraneY, this.bandHalf, t, gap);
    this._drawAlignmentGuide(ctx);

    // hücre dışındaki maddeler zarın arkasında kalmasın diye
    // önce hücre içi (out) sonra hücre dışı (in) maddeler çizilir
    for (const p of this.particles) this._drawParticle(ctx, p, t);

    this._drawChannel(ctx, t);
    this._drawEffects(ctx);
    this._drawControlHint(ctx, w, h);

    ctx.restore();
  }

  _drawBackground(ctx, w, h, t) {
    // hücre dışı (üst) / hücre içi (alt) ayrımı
    ctx.save();
    const top = ctx.createLinearGradient(0, 0, 0, this.membraneY);
    top.addColorStop(0, 'rgba(24, 68, 102, 0.55)');
    top.addColorStop(1, 'rgba(15, 43, 64, 0.35)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, this.membraneY);

    const bot = ctx.createLinearGradient(0, this.membraneY, 0, h);
    bot.addColorStop(0, 'rgba(10, 28, 43, 0.45)');
    bot.addColorStop(1, 'rgba(6, 18, 28, 0.7)');
    ctx.fillStyle = bot;
    ctx.fillRect(0, this.membraneY, w, h - this.membraneY);
    ctx.restore();

    // hücre içinde yavaşça süzülen sitoplazma kabarcıkları
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#8fd7ff';
    for (let i = 0; i < 7; i++) {
      const bx = ((i * 137) % Math.max(1, w - 40)) + 20;
      const by = this.membraneY + 40 + ((t * 12 + i * 90) % Math.max(1, h - this.membraneY));
      ctx.beginPath();
      ctx.arc(bx, by, 16 + (i % 3) * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // hücre dışı nokta dokusu
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    const spacing = 46;
    const offset = (t * 6) % spacing;
    for (let y = -spacing + offset; y < this.membraneY; y += spacing) {
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath();
        ctx.arc(x + (Math.floor(y / spacing) % 2) * spacing * 0.5, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.font = '700 10px Poppins, sans-serif';
    ctx.fillStyle = 'rgba(244,248,251,0.30)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('HÜCRE DIŞI', 12, 20);
    ctx.fillText('HÜCRE İÇİ', 12, h - 12);
    ctx.restore();
  }

  /* Kanalın yakalama bölgesi — oyuncunun hizayı görmesi için. */
  _drawAlignmentGuide(ctx) {
    const mode = this.transport.current;
    const x = this.channel.x;
    const tolerance = this.channel.radius * 0.55 * 2 + 24;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, this.fieldHeight);
    g.addColorStop(0, Draw.rgba(mode.color, 0));
    g.addColorStop(0.5, Draw.rgba(mode.color, 0.16));
    g.addColorStop(1, Draw.rgba(mode.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - tolerance / 2, 0, tolerance, this.fieldHeight);
    ctx.restore();
  }

  _drawChannel(ctx, t) {
    const mode = this.transport.current;
    const y = this.membraneY;
    const x = this.channel.x;
    const w = this.channel.radius * 2;

    ctx.save();
    ctx.shadowColor = mode.color;
    ctx.shadowBlur = 16;

    if (this.assets.has(mode.channelAsset)) {
      const img = this.assets.get(mode.channelAsset);
      const size = w * 1.6;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    } else {
      ChannelArt.draw(ctx, mode, x, y, w, this.bandHalf, t);
    }
    ctx.restore();

    // kanalın altında mekanizma etiketi
    ctx.save();
    ctx.font = '700 10px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = mode.short;
    const tw = ctx.measureText(label).width;
    const ly = y + this.bandHalf + 16;
    ctx.fillStyle = 'rgba(8, 22, 34, 0.78)';
    Draw.roundRect(ctx, x - tw / 2 - 8, ly - 9, tw + 16, 18, 9);
    ctx.fill();
    ctx.strokeStyle = Draw.rgba(mode.color, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = mode.color;
    ctx.fillText(label, x, ly);
    ctx.restore();
  }

  _drawParticle(ctx, p, t) {
    const def = p.def;
    let x = p.x;
    let y = p.y;
    let scale = 1;
    let alpha = 1;

    if (p.state === 'resolved') {
      if (p.resolution === 'success') {
        x = p.x + (this.channel.x - p.x) * p.progress;
        y = this.membraneY + (p.isInbound ? 1 : -1) * p.progress * this.bandHalf * 1.2;
        scale = 1 - p.progress * 0.85;
        alpha = 1 - p.progress;
      } else if (p.resolution === 'wrong') {
        const shakeX = Math.sin(p.progress * Math.PI * 8) * 7 * (1 - p.progress);
        x = p.x + shakeX;
        alpha = 1 - p.progress;
      }
    }

    if (alpha <= 0.02) return;

    const r = def.radius * scale;
    ctx.save();
    ctx.globalAlpha = alpha;

    MoleculeArt.draw(ctx, this.assets, def, x, y, r, {
      glow: p.state === 'moving' ? p.approach : 0,
    });

    if (p.resolution === 'wrong') {
      ctx.fillStyle = 'rgba(255, 80, 80, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.state === 'moving') {
      this._drawParticleLabel(ctx, p, x, y, r);
    }

    ctx.restore();
  }

  _drawParticleLabel(ctx, p, x, y, r) {
    const def = p.def;
    const below = p.isInbound;
    const baseY = below ? y + r + 13 : y - r - 13;

    ctx.save();
    ctx.font = '700 11px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const name = def.label;
    const nameW = ctx.measureText(name).width;
    const clampX = Math.min(this.fieldWidth - nameW / 2 - 10, Math.max(nameW / 2 + 10, x));

    // Etiket zarın altın rengi üzerine de düşebildiği için zemin opak
    ctx.fillStyle = 'rgba(6, 18, 28, 0.9)';
    Draw.roundRect(ctx, clampX - nameW / 2 - 7, baseY - 9, nameW + 14, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,248,251,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(244,248,251,0.96)';
    ctx.fillText(name, clampX, baseY);

    // Öğrenme modunda doğru mekanizmayı da göster
    if (this.gameMode === 'learn') {
      const mode = TRANSPORT_BY_ID[def.correctMechanism];
      const hint = `→ ${mode.short}`;
      ctx.font = '700 10px Poppins, sans-serif';
      const hw = ctx.measureText(hint).width;
      const hy = below ? baseY + 20 : baseY - 20;
      ctx.fillStyle = 'rgba(6, 18, 28, 0.9)';
      Draw.roundRect(ctx, clampX - hw / 2 - 7, hy - 8, hw + 14, 17, 8);
      ctx.fill();
      ctx.strokeStyle = Draw.rgba(mode.color, 0.65);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = mode.color;
      ctx.fillText(hint, clampX, hy);
    }
    ctx.restore();
  }

  /* Turun ilk saniyelerinde dokunmatik kontrol hatırlatması. */
  _drawControlHint(ctx, w, h) {
    if (this.state !== 'playing' || this.timer.remaining <= this.hintUntil) return;
    const left = this.timer.remaining - this.hintUntil;
    const alpha = Math.min(1, left / 2);
    const lines = ['Parmağını sürükle → kanal', 'Zara dokun → mekanizma değişir'];
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = '700 11px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 26;
    const y = this.membraneY + this.bandHalf + 46;
    ctx.fillStyle = 'rgba(8, 22, 34, 0.72)';
    Draw.roundRect(ctx, w / 2 - width / 2, y - 20, width, 40, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,248,251,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(244,248,251,0.85)';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y - 8 + i * 16));
    ctx.restore();
  }

  _drawEffects(ctx) {
    for (const fx of this.effects) {
      const p = Math.min(1, fx.t / fx.life);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      if (fx.kind === 'ring') {
        const r = 12 + p * 52;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3 * (1 - p) + 0.5;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.stroke();
        const g = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, r);
        g.addColorStop(0, Draw.rgba(fx.color, 0.35));
        g.addColorStop(1, Draw.rgba(fx.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (fx.kind === 'vesicle') {
        // zarın maddeyi saran vezikülü
        const r = 26 * (1 - p * 0.55);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y + p * 26, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'atp') {
        ctx.fillStyle = fx.color;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const d = 8 + p * 30;
          ctx.beginPath();
          ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * 0.7, 2.4 * (1 - p), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Çift kurulum koruması: script yanlışlıkla iki kez yüklenirse ya da
  // DOMContentLoaded iki kez tetiklenirse ikinci bir Game örneği
  // oluşmasın — aynı düğmelere iki dinleyici bağlanır ve her tıklama
  // iki kez işlenirdi.
  if (window.membraneRunGame) return;
  window.membraneRunGame = new Game();
});
