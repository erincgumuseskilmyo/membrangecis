/* ============================================================
   UI.JS
   Ekran geçişleri, HUD güncellemeleri, mekanizma şeridi,
   klavye / dokunmatik / swipe kontrol bağlama, toast bildirimleri,
   geri sayım ve sonuç dökümü.
============================================================ */

class UIManager {
  constructor(callbacks, audioManager) {
    this.cb = callbacks;
    this.audio = audioManager;
    this.gameMode = 'exam'; // 'exam' | 'learn'
    this._cacheDom();
    this._buildModeRail();
    this._buildMechanismList();
    this._bindStaticEvents();
    this._bindKeyboard();
    this._bindTouchControls();
    this._bindSwipe();
    this.syncSoundIcons();
    this.setAssetsReady(false);
  }

  _cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      screens: {
        start: $('screen-start'),
        game: $('screen-game'),
        results: $('screen-results'),
      },
      modalHowto: $('modal-howto'),
      modalMechanisms: $('modal-mechanisms'),
      modalCredits: $('modal-credits'),
      modalLeaderboard: $('modal-leaderboard'),
      screenPause: $('screen-pause'),
      countdownOverlay: $('countdown-overlay'),
      countdownNumber: $('countdown-number'),

      inputName: $('input-name'),
      inputStudentNo: $('input-studentno'),

      btnStart: $('btn-start'),
      btnHowto: $('btn-howto'),
      btnMechanisms: $('btn-mechanisms'),
      btnCredits: $('btn-credits'),
      btnLeaderboard: $('btn-leaderboard'),
      btnResume: $('btn-resume'),
      btnQuit: $('btn-quit'),
      btnPause: $('btn-pause'),
      btnReplay: $('btn-replay'),
      btnViewLeaderboard: $('btn-view-leaderboard'),
      btnMenu: $('btn-menu'),
      btnSoundStart: $('btn-sound-start'),
      btnSoundGame: $('btn-sound-game'),
      btnMusicStart: $('btn-music-start'),
      btnMusicGame: $('btn-music-game'),
      btnModeExam: $('btn-mode-exam'),
      btnModeLearn: $('btn-mode-learn'),
      assetStatus: $('asset-status'),

      btnLeft: $('btn-left'),
      btnRight: $('btn-right'),
      btnUp: $('btn-up'),
      btnDown: $('btn-down'),

      hudScore: $('hud-score'),
      hudAtp: $('hud-atp'),
      hudCombo: $('hud-combo'),
      hudTime: $('hud-time'),
      hudTransportMode: $('hud-transport-mode'),
      hudTransportInfo: $('hud-transport-info'),
      hudTier: $('hud-tier'),
      modeRail: $('mode-rail'),
      learnBadge: $('learn-badge'),

      gameField: $('game-field'),
      toastLayer: $('toast-layer'),

      mechanismList: $('mechanism-list'),
      leaderboardStatus: $('leaderboard-status'),
      leaderboardSource: $('leaderboard-source'),
      leaderboardList: $('leaderboard-list'),
      resultsOnlineStatus: $('results-online-status'),
      resLeaderboard: $('res-leaderboard'),
      resBoardTitle: $('res-board-title'),
      resBoardRank: $('res-board-rank'),
      btnBoardRefresh: $('btn-board-refresh'),

      resScore: $('res-score'),
      resCorrect: $('res-correct'),
      resWrong: $('res-wrong'),
      resMissed: $('res-missed'),
      resAccuracy: $('res-accuracy'),
      resCombo: $('res-combo'),
      resAtp: $('res-atp'),
      resDuration: $('res-duration'),
      resBreakdown: $('res-breakdown'),
      resFeedback: $('res-feedback'),
      resModeNote: $('res-mode-note'),
    };
  }

  /* ---------------- Mekanizma şeridi ---------------- */

  _buildModeRail() {
    const rail = this.el.modeRail;
    if (!rail) return;
    rail.innerHTML = '';
    this._chips = TRANSPORT_MODES.map((mode, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-chip';
      btn.style.setProperty('--chip-color', mode.color);
      btn.setAttribute('aria-label', mode.label);
      btn.innerHTML =
        `<span class="chip-key">${i + 1}</span>` +
        `<span class="chip-name">${this._escape(mode.chip || mode.short)}</span>`;
      btn.addEventListener('click', () => this.cb.onTransportSelect(i));
      rail.appendChild(btn);
      return btn;
    });
  }

  _buildMechanismList() {
    const list = this.el.mechanismList;
    if (!list) return;
    const substances = {};
    Object.values(PARTICLE_DEFS).forEach((d) => {
      (substances[d.correctMechanism] = substances[d.correctMechanism] || []).push(d.label);
    });
    list.innerHTML = '';
    TRANSPORT_MODES.forEach((mode, i) => {
      const li = document.createElement('li');
      li.className = 'mechanism-item';
      li.style.setProperty('--chip-color', mode.color);
      li.innerHTML =
        `<span class="mechanism-head"><span class="mechanism-key">${i + 1}</span>` +
        `<span class="mechanism-name">${this._escape(mode.label)}</span>` +
        `<span class="mechanism-energy">${this._escape(mode.energy)}</span></span>` +
        `<span class="mechanism-info">${this._escape(mode.info)}</span>` +
        `<span class="mechanism-subs">${this._escape((substances[mode.id] || []).join(' · '))}</span>`;
      list.appendChild(li);
    });
  }

  /* ---------------- Screens & modals ---------------- */

  showScreen(name) {
    Object.entries(this.el.screens).forEach(([key, node]) => {
      node.classList.toggle('active', key === name);
    });
  }

  openModal(node) {
    node.classList.remove('hidden');
  }

  closeModal(node) {
    node.classList.add('hidden');
  }

  get anyModalOpen() {
    return [
      this.el.modalHowto,
      this.el.modalMechanisms,
      this.el.modalCredits,
      this.el.modalLeaderboard,
      this.el.screenPause,
    ].some((n) => n && !n.classList.contains('hidden'));
  }

  showPause() {
    this.openModal(this.el.screenPause);
  }

  hidePause() {
    this.closeModal(this.el.screenPause);
  }

  setAssetsReady(ready) {
    this.assetsReady = ready;
    if (!this.el.assetStatus) return;
    if (ready) {
      this.el.assetStatus.classList.add('hidden');
      this.el.btnStart.removeAttribute('disabled');
    } else {
      this.el.assetStatus.classList.remove('hidden');
      this.el.btnStart.setAttribute('disabled', 'disabled');
    }
  }

  /* ---------------- Player form ---------------- */

  getPlayerInfo() {
    const name = this.el.inputName.value.trim() || 'Öğrenci';
    const studentNo = this.el.inputStudentNo.value.trim();
    return { name, studentNo };
  }

  setGameMode(mode) {
    this.gameMode = mode;
    this.el.btnModeExam.classList.toggle('is-active', mode === 'exam');
    this.el.btnModeLearn.classList.toggle('is-active', mode === 'learn');
    this.el.learnBadge.classList.toggle('hidden', mode !== 'learn');
  }

  /* ---------------- Countdown ---------------- */

  runCountdown(onDone) {
    this.openModal(this.el.countdownOverlay);
    const seq = ['3', '2', '1', 'BAŞLA!'];
    let i = 0;
    const step = () => {
      this.el.countdownNumber.textContent = seq[i];
      this.el.countdownNumber.style.animation = 'none';
      void this.el.countdownNumber.offsetWidth; // animasyonu yeniden başlat
      this.el.countdownNumber.style.animation = '';
      if (i < 3) this.audio.playCountdownTick();
      else this.audio.playStart();
      i++;
      if (i < seq.length) {
        setTimeout(step, 700);
      } else {
        setTimeout(() => {
          this.closeModal(this.el.countdownOverlay);
          onDone();
        }, 550);
      }
    };
    step();
  }

  /* ---------------- HUD ---------------- */

  updateScore(score) {
    this.el.hudScore.textContent = score;
  }

  updateAtp(atp) {
    this.el.hudAtp.textContent = atp;
    this.el.hudAtp.classList.toggle('low', atp <= 3);
  }

  updateCombo(combo) {
    this.el.hudCombo.textContent = `×${combo}`;
    this.el.hudCombo.classList.toggle('hot', combo >= 5);
  }

  updateTime(seconds) {
    this.el.hudTime.textContent = Timer.format(seconds);
    this.el.hudTime.classList.toggle('warning', seconds <= 30 && seconds > 0);
  }

  updateTier(tier) {
    if (this.el.hudTier && this.el.hudTier.textContent !== tier) {
      this.el.hudTier.textContent = tier;
    }
  }

  updateTransportMode(mode) {
    this.el.hudTransportMode.textContent = mode.label;
    this.el.hudTransportMode.style.color = mode.color;
    this.el.hudTransportInfo.textContent = mode.info;
    const idx = TRANSPORT_MODES.indexOf(mode);
    if (this._chips) {
      this._chips.forEach((chip, i) => chip.classList.toggle('is-active', i === idx));
    }
  }

  /* ---------------- Toasts ---------------- */

  showToast(kind, text, xRatio, yRatio) {
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.textContent = text;
    // toast'ın alan dışına taşmaması için kenarlardan uzak tut
    const x = Math.min(0.84, Math.max(0.16, xRatio));
    const y = Math.min(0.92, Math.max(0.08, yRatio));
    node.style.left = `${x * 100}%`;
    node.style.top = `${y * 100}%`;
    this.el.toastLayer.appendChild(node);
    setTimeout(() => node.remove(), 950);
  }

  flashField(kind) {
    const f = this.el.gameField;
    f.classList.remove('flash-wrong', 'flash-correct');
    void f.offsetWidth;
    f.classList.add(kind === 'wrong' ? 'flash-wrong' : 'flash-correct');
    setTimeout(() => f.classList.remove('flash-wrong', 'flash-correct'), 420);
  }

  /* ---------------- Results ---------------- */

  renderResults(stats) {
    this.el.resScore.textContent = stats.score;
    this.el.resCorrect.textContent = stats.correctCount;
    this.el.resWrong.textContent = stats.wrongCount;
    this.el.resMissed.textContent = stats.missedCount;
    this.el.resAccuracy.textContent = `%${stats.accuracy}`;
    this.el.resCombo.textContent = `×${stats.maxCombo}`;
    this.el.resAtp.textContent = stats.atpSpent;
    this.el.resDuration.textContent = Timer.format(stats.durationSeconds);

    // mekanizma dökümü
    this.el.resBreakdown.innerHTML = '';
    TRANSPORT_MODES.forEach((mode) => {
      const s = stats.byMechanism[mode.id] || { correct: 0, wrong: 0 };
      const total = s.correct + s.wrong;
      const pct = total === 0 ? 0 : Math.round((s.correct / total) * 100);
      const li = document.createElement('li');
      li.className = 'breakdown-item';
      li.style.setProperty('--chip-color', mode.color);
      li.innerHTML =
        `<span class="bd-name">${this._escape(mode.short)}</span>` +
        `<span class="bd-bar"><span class="bd-fill" style="width:${total === 0 ? 0 : pct}%"></span></span>` +
        `<span class="bd-num">${s.correct}/${total}</span>`;
      this.el.resBreakdown.appendChild(li);
    });

    if (stats.weakest) {
      const mode = TRANSPORT_BY_ID[stats.weakest.id];
      this.el.resFeedback.textContent =
        `Tekrar çalış: ${mode.label} — ${stats.weakest.wrong} yanlış. ${mode.info}`;
      this.el.resFeedback.classList.remove('hidden');
    } else if (stats.accuracy >= 85 && stats.attempts >= 10) {
      this.el.resFeedback.textContent = 'Mekanizmaların hepsinde isabetlisin. Süreyi kısaltmayı dene!';
      this.el.resFeedback.classList.remove('hidden');
    } else {
      this.el.resFeedback.classList.add('hidden');
    }

    this.setBoardLoading(this.el.resLeaderboard);
    this.el.resBoardRank.classList.add('hidden');

    if (stats.gameMode === 'learn') {
      this.el.resModeNote.textContent =
        'Öğrenme modu — ipuçları açıktı, bu skor liderlik tablosuna işlenmez.';
      this.el.resModeNote.classList.remove('hidden');
    } else {
      this.el.resModeNote.classList.add('hidden');
    }
  }

  showResultsOnlineStatus(message) {
    if (!message) {
      this.el.resultsOnlineStatus.classList.add('hidden');
      return;
    }
    this.el.resultsOnlineStatus.textContent = message;
    this.el.resultsOnlineStatus.classList.remove('hidden');
  }

  /* ---------------- Leaderboard ---------------- */

  /* Skor tablosu modalı. */
  renderLeaderboard(result, statusMessage, player) {
    const list = result.list;
    if (statusMessage) {
      this.el.leaderboardStatus.textContent = statusMessage;
      this.el.leaderboardStatus.classList.remove('hidden');
    } else {
      this.el.leaderboardStatus.classList.add('hidden');
    }
    this._renderBoardSource(this.el.leaderboardSource, result.source, false);
    this._fillBoard(this.el.leaderboardList, list, player);
  }

  /* Sonuç ekranındaki gömülü tablo + sıralama satırı. */
  renderResultsBoard(result, statusMessage, player) {
    const list = result.list;
    this._renderBoardSource(this.el.resBoardTitle, result.source, true);
    this._fillBoard(this.el.resLeaderboard, list, player);

    const online = result.source === 'online';
    const idx = player ? list.findIndex((e) => LeaderboardManager.isSamePlayer(e, player)) : -1;
    if (idx === 0) {
      this.el.resBoardRank.textContent = online
        ? 'Tebrikler, sınıf birincisisin! 🏆'
        : 'Bu cihazdaki en yüksek skor sende! 🏆';
      this.el.resBoardRank.classList.remove('hidden');
    } else if (idx > 0) {
      this.el.resBoardRank.textContent = online
        ? 'Sınıf tablosunda ' + (idx + 1) + '. sıradasın.'
        : 'Bu cihazda ' + (idx + 1) + '. sıradasın.';
      this.el.resBoardRank.classList.remove('hidden');
    } else if (list.length) {
      this.el.resBoardRank.textContent =
        'İlk ' + list.length + ' arasına giremedin — tekrar dene!';
      this.el.resBoardRank.classList.remove('hidden');
    } else {
      this.el.resBoardRank.classList.add('hidden');
    }

    if (statusMessage) {
      this.el.resultsOnlineStatus.textContent = statusMessage;
      this.el.resultsOnlineStatus.classList.remove('hidden');
    }
  }

  _renderBoardSource(node, source, isTitle) {
    if (!node) return;
    const online = source === 'online';
    if (isTitle) {
      node.textContent = online ? 'SINIF SKOR TABLOSU' : 'BU CİHAZDAKİ SKORLAR';
      return;
    }
    node.textContent = online
      ? '🌐 Ortak sınıf tablosu (canlı)'
      : '📴 Yalnızca bu cihazdaki skorlar';
    node.classList.toggle('is-online', online);
  }

  _fillBoard(listNode, list, player) {
    if (!listNode) return;
    listNode.innerHTML = '';
    if (!list || list.length === 0) {
      const li = document.createElement('li');
      li.className = 'leaderboard-empty';
      li.textContent = 'Henüz skor kaydedilmedi. İlk skoru sen yap!';
      li.style.background = 'none';
      listNode.appendChild(li);
      return;
    }
    list.forEach((entry, idx) => {
      const li = document.createElement('li');
      if (player && LeaderboardManager.isSamePlayer(entry, player)) li.classList.add('is-me');
      if (idx < 3) li.classList.add('podium', 'podium-' + (idx + 1));
      const displayName = LeaderboardManager.formatDisplayName(entry.name, entry.studentNo);
      const acc =
        entry.accuracy == null ? '' : '<span class="lb-acc">%' + entry.accuracy + '</span>';
      li.innerHTML =
        '<span class="rank">' + (idx + 1) + '.</span>' +
        '<span class="lb-name">' + this._escape(displayName) + '</span>' +
        acc +
        '<span class="lb-score">' + entry.score + '</span>';
      listNode.appendChild(li);
    });
  }

  setBoardLoading(node) {
    if (!node) return;
    node.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = 'Skor tablosu yükleniyor…';
    li.style.background = 'none';
    node.appendChild(li);
  }

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  /* ---------------- Sound / music icon sync ---------------- */

  syncSoundIcons() {
    const on = this.audio.enabled;
    [this.el.btnSoundStart, this.el.btnSoundGame].forEach((btn) => {
      if (!btn) return;
      btn.textContent = on ? '🔊' : '🔇';
      btn.classList.toggle('is-muted', !on);
    });
    const m = this.audio.musicEnabled;
    [this.el.btnMusicStart, this.el.btnMusicGame].forEach((btn) => {
      if (!btn) return;
      btn.textContent = m ? '♪' : '♪̸';
      btn.classList.toggle('is-muted', !m);
    });
  }

  /* ---------------- Static button bindings ---------------- */

  _bindStaticEvents() {
    const click = (btn, fn) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        this.audio.playClick();
        fn();
      });
    };

    click(this.el.btnStart, () => this.cb.onStart());
    click(this.el.btnHowto, () => this.openModal(this.el.modalHowto));
    click(this.el.btnMechanisms, () => this.openModal(this.el.modalMechanisms));
    click(this.el.btnCredits, () => this.openModal(this.el.modalCredits));
    click(this.el.btnLeaderboard, () => this.cb.onRequestLeaderboard());
    click(this.el.btnViewLeaderboard, () => this.cb.onRequestLeaderboard());

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playClick();
        this.closeModal(document.getElementById(btn.dataset.close));
      });
    });

    click(this.el.btnPause, () => this.cb.onPauseToggle());
    click(this.el.btnResume, () => this.cb.onResume());
    click(this.el.btnQuit, () => this.cb.onQuit());
    click(this.el.btnReplay, () => this.cb.onReplay());
    click(this.el.btnMenu, () => this.cb.onQuit());

    click(this.el.btnBoardRefresh, () => this.cb.onRefreshBoard());
    click(this.el.btnModeExam, () => this.setGameMode('exam'));
    click(this.el.btnModeLearn, () => this.setGameMode('learn'));

    [this.el.btnSoundStart, this.el.btnSoundGame].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        this.audio.toggle();
        this.syncSoundIcons();
        this.audio.playClick();
      });
    });

    [this.el.btnMusicStart, this.el.btnMusicGame].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        const on = this.audio.toggleMusic();
        this.syncSoundIcons();
        this.audio.playClick();
        if (on) this.cb.onMusicEnabled();
      });
    });
  }

  /* ---------------- Keyboard ---------------- */

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // form alanlarında yazarken oyun kısayolları çalışmasın
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (/^[0-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < TRANSPORT_MODES.length) {
          e.preventDefault();
          this.cb.onTransportSelect(idx);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.cb.onMoveDir(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.cb.onMoveDir(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!e.repeat) this.cb.onTransportChange(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!e.repeat) this.cb.onTransportChange(1);
          break;
        case 'Escape':
        case 'p':
        case 'P':
          this.cb.onPauseToggle();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.cb.onMoveDir(0);
      }
    });
  }

  /* ---------------- Touch buttons (hold-to-repeat) ---------------- */

  _bindTouchControls() {
    this._bindHold(this.el.btnLeft, () => this.cb.onMoveDir(-1), () => this.cb.onMoveDir(0));
    this._bindHold(this.el.btnRight, () => this.cb.onMoveDir(1), () => this.cb.onMoveDir(0));
    this._bindRepeatPress(this.el.btnUp, () => this.cb.onTransportChange(-1));
    this._bindRepeatPress(this.el.btnDown, () => this.cb.onTransportChange(1));
  }

  _bindHold(btn, onDown, onUp) {
    const start = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      onDown();
    };
    const end = (e) => {
      if (e) e.preventDefault();
      btn.classList.remove('pressed');
      onUp();
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('pointercancel', end);
  }

  _bindRepeatPress(btn, action) {
    let timeout = null;
    let interval = null;
    const start = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      action();
      timeout = setTimeout(() => {
        interval = setInterval(action, 420);
      }, 480);
    };
    const stop = (e) => {
      if (e) e.preventDefault();
      btn.classList.remove('pressed');
      clearTimeout(timeout);
      clearInterval(interval);
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  }

  /* ---------------- Swipe (destekleyici kontrol) ---------------- */

  _bindSwipe() {
    const field = this.el.gameField;
    let startX = 0;
    let startY = 0;
    let startedInLeftHalf = true;
    let active = false;

    field.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const rect = field.getBoundingClientRect();
        startX = t.clientX;
        startY = t.clientY;
        startedInLeftHalf = t.clientX - rect.left < rect.width / 2;
        active = true;
      },
      { passive: true }
    );

    field.addEventListener(
      'touchend',
      (e) => {
        if (!active) return;
        active = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const THRESHOLD = 36;

        if (startedInLeftHalf) {
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESHOLD) {
            this.cb.onNudge(dx > 0 ? 1 : -1);
          }
        } else {
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > THRESHOLD) {
            this.cb.onTransportChange(dy > 0 ? 1 : -1);
          }
        }
      },
      { passive: true }
    );
  }
}
