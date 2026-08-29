/* ============================================================
   TIMER.JS
   5 dakikalık (300 saniye) oyun süresi yönetimi.
============================================================ */

class Timer {
  constructor(totalSeconds, onTick, onEnd) {
    this.totalSeconds = totalSeconds;
    this.remaining = totalSeconds;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.running = false;
    this._acc = 0;
  }

  reset() {
    this.remaining = this.totalSeconds;
    this._acc = 0;
    this.running = false;
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  resume() {
    this.running = true;
  }

  update(dt) {
    if (!this.running) return;
    this._acc += dt;
    if (this._acc >= 1) {
      const wholeSecs = Math.floor(this._acc);
      this._acc -= wholeSecs;
      this.remaining = Math.max(0, this.remaining - wholeSecs);
      if (this.onTick) this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.running = false;
        if (this.onEnd) this.onEnd();
      }
    }
  }

  get elapsed() {
    return this.totalSeconds - this.remaining;
  }

  static format(seconds) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  }
}
