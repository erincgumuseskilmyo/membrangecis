/* ============================================================
   LEADERBOARD.JS
   Online (Supabase) + yerel (localStorage) skor tablosu.

   Ayarlar js/config.js dosyasındadır. Orası boşken oyun
   OFFLINE modda çalışır: skorlar yalnızca oynayan kişinin
   tarayıcısında saklanır ve arayüz bunu açıkça söyler —
   hiçbir zaman sahte biçimde "online tablo hazır" demez.
============================================================ */

const SUPABASE_CONFIG = {
  url: (typeof MEMBRANE_RUN_CONFIG !== 'undefined' && MEMBRANE_RUN_CONFIG.supabaseUrl) || '',
  anonKey: (typeof MEMBRANE_RUN_CONFIG !== 'undefined' && MEMBRANE_RUN_CONFIG.supabaseAnonKey) || '',
  table:
    (typeof MEMBRANE_RUN_CONFIG !== 'undefined' && MEMBRANE_RUN_CONFIG.table) ||
    'membrane_run_scores',
  groupCode:
    (typeof MEMBRANE_RUN_CONFIG !== 'undefined' && MEMBRANE_RUN_CONFIG.groupCode) || 'genel',
  bestPerStudent:
    typeof MEMBRANE_RUN_CONFIG === 'undefined' ? true : MEMBRANE_RUN_CONFIG.bestPerStudent !== false,
};

const LOCAL_KEY = 'membraneRun.localScores';
const LOCAL_PLAYER_KEY = 'membraneRun.player';

class LeaderboardManager {
  constructor() {
    this.isOnlineConfigured = !!(
      SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.anonKey &&
      /^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_CONFIG.url.trim())
    );
    this.online = typeof navigator === 'undefined' ? true : navigator.onLine;
    this.lastSource = 'local'; // 'online' | 'local'
    this.lastError = null;
    window.addEventListener('online', () => (this.online = true));
    window.addEventListener('offline', () => (this.online = false));
  }

  get baseUrl() {
    return SUPABASE_CONFIG.url.trim().replace(/\/+$/, '');
  }

  get headers() {
    return {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
    };
  }

  /* Arayüzde gösterilecek dürüst durum mesajı. */
  get statusMessage() {
    if (!this.isOnlineConfigured) {
      return 'Ortak skor tablosu kurulu değil — skorlar yalnızca bu cihazda saklanıyor. Kurulum için KURULUM.md';
    }
    if (!this.online) {
      return 'İnternet bağlantısı yok. Oyun offline devam ediyor; skor ortak tabloya gönderilemedi.';
    }
    if (this.lastError) {
      return `Ortak tabloya ulaşılamadı (${this.lastError}). Şimdilik bu cihazdaki skorlar gösteriliyor.`;
    }
    return null;
  }

  savePlayer(name, studentNo) {
    try {
      localStorage.setItem(
        LOCAL_PLAYER_KEY,
        JSON.stringify({ name: name || 'Öğrenci', studentNo: studentNo || '' })
      );
    } catch {
      /* localStorage kapalı olabilir */
    }
  }

  getPlayer() {
    try {
      return (
        JSON.parse(localStorage.getItem(LOCAL_PLAYER_KEY)) || { name: 'Öğrenci', studentNo: '' }
      );
    } catch {
      return { name: 'Öğrenci', studentNo: '' };
    }
  }

  /* Basit istemci taraflı bütünlük özeti.
     NOT: Gerçek bir güvenlik önlemi DEĞİLDİR; tarayıcı konsolundan
     sahte istek göndermek isteyen biri yine gönderebilir. Asıl
     koruma supabase-schema.sql içindeki CHECK kısıtıdır (imkânsız
     skorları veritabanı reddeder). */
  _buildIntegritySignature(payload) {
    const raw = `${payload.score}|${payload.correctCount}|${payload.wrongCount}|${payload.missedCount}|${payload.maxCombo}|${payload.durationSeconds}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  }

  async submitScore(payload) {
    const entry = {
      ...payload,
      signature: this._buildIntegritySignature(payload),
      createdAt: new Date().toISOString(),
    };

    this._saveLocal(entry);

    if (!this.isOnlineConfigured) return { ok: false, reason: 'not_configured' };
    if (!this.online) return { ok: false, reason: 'offline' };

    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/${SUPABASE_CONFIG.table}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name: entry.name,
          student_no: entry.studentNo,
          group_code: SUPABASE_CONFIG.groupCode,
          score: entry.score,
          correct_count: entry.correctCount,
          wrong_count: entry.wrongCount,
          missed_count: entry.missedCount,
          max_combo: entry.maxCombo,
          atp_spent: entry.atpSpent,
          accuracy: entry.accuracy,
          duration_seconds: entry.durationSeconds,
          signature: entry.signature,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${body ? ' — ' + body.slice(0, 120) : ''}`);
      }
      this.lastError = null;
      return { ok: true };
    } catch (err) {
      this.lastError = this._shortError(err);
      console.warn('[Membrane Run] Online skor gönderilemedi:', err);
      return { ok: false, reason: 'network_error' };
    }
  }

  /* { list, source } döndürür. list: [{name, studentNo, score, accuracy}] */
  async fetchTop(limit) {
    const n = limit || (typeof MEMBRANE_RUN_CONFIG !== 'undefined' && MEMBRANE_RUN_CONFIG.topCount) || 10;

    if (this.isOnlineConfigured && this.online) {
      try {
        // Aynı öğrencinin en iyi skorunu bulabilmek için biraz
        // fazlasını çekip elemeyi istemci tarafında yapıyoruz.
        const fetchCount = SUPABASE_CONFIG.bestPerStudent ? Math.max(n * 8, 80) : n;
        const params = new URLSearchParams({
          select: 'name,student_no,score,accuracy,created_at',
          group_code: `eq.${SUPABASE_CONFIG.groupCode}`,
          order: 'score.desc,created_at.asc',
          limit: String(fetchCount),
        });
        const res = await fetch(`${this.baseUrl}/rest/v1/${SUPABASE_CONFIG.table}?${params}`, {
          headers: this.headers,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        this.lastError = null;
        this.lastSource = 'online';
        const list = rows.map((r) => ({
          name: r.name,
          studentNo: r.student_no,
          score: r.score,
          accuracy: r.accuracy,
        }));
        return { list: this._trim(list, n), source: 'online' };
      } catch (err) {
        this.lastError = this._shortError(err);
        console.warn('[Membrane Run] Ortak skor tablosu alınamadı:', err);
      }
    }

    this.lastSource = 'local';
    return { list: this._trim(this._readLocalRaw(), n), source: 'local' };
  }

  /* Aynı öğrenciyi tekrar tekrar listelememek için ele + kırp. */
  _trim(list, n) {
    let out = list.slice().sort((a, b) => b.score - a.score);
    if (SUPABASE_CONFIG.bestPerStudent) {
      const seen = new Set();
      out = out.filter((e) => {
        const key = (e.studentNo || '').trim() || (e.name || '').trim().toLocaleLowerCase('tr');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return out.slice(0, n);
  }

  _shortError(err) {
    const m = (err && err.message) || String(err);
    if (/Failed to fetch|NetworkError|load failed/i.test(m)) return 'bağlantı kurulamadı';
    return m.slice(0, 80);
  }

  _saveLocal(entry) {
    try {
      const list = this._readLocalRaw();
      list.push({
        name: entry.name,
        studentNo: entry.studentNo,
        score: entry.score,
        accuracy: entry.accuracy,
      });
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 50)));
    } catch {
      /* localStorage kapalı olabilir */
    }
  }

  _readLocalRaw() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
    } catch {
      return [];
    }
  }

  /* "Ayşe Yılmaz" -> "Ayşe Y."  (sınıf listesinde soyadı gizlemek için) */
  static formatDisplayName(name, studentNo) {
    const parts = (name || 'Öğrenci').trim().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts.slice(0, -1).join(' ');
      const lastInitial = parts[parts.length - 1][0] + '.';
      return `${first} ${lastInitial}`;
    }
    return name || 'Öğrenci';
  }

  /* Sonuç ekranında "sen kaçıncısın" satırı için. */
  static isSamePlayer(entry, player) {
    const no = (player.studentNo || '').trim();
    if (no && (entry.studentNo || '').trim() === no) return true;
    if (!no && !(entry.studentNo || '').trim()) {
      return (entry.name || '').trim().toLocaleLowerCase('tr') ===
        (player.name || '').trim().toLocaleLowerCase('tr');
    }
    return false;
  }
}
