/* ============================================================
   PLAYER.JS
   Oyuncunun kanalı: ← → ile hücre zarı üzerinde yatay hareket.
============================================================ */

class Channel {
  constructor(fieldWidthGetter) {
    this.getFieldWidth = fieldWidthGetter;
    this.x = 0;
    this.baseSpeed = 480; // px/sn (dar ekran)
    this.radius = 34;
    this.moveDir = 0; // -1, 0, 1 (basılı tutma için)
  }

  reset() {
    this.x = this.getFieldWidth() / 2;
    this.moveDir = 0;
  }

  setDirection(dir) {
    this.moveDir = dir;
  }

  /* Dokunmatik sürükleme: kanalı doğrudan verilen x'e taşır. */
  setX(x) {
    const w = this.getFieldWidth();
    this.moveDir = 0;
    this.x = Math.min(Math.max(x, this.radius), Math.max(this.radius, w - this.radius));
  }

  update(dt) {
    if (this.moveDir !== 0) {
      this._move(this.moveDir, dt);
    }
  }

  /* Geniş ekranda kanalın bir uçtan diğerine ulaşması yaklaşık aynı
     sürede olsun diye hız alan genişliğiyle ölçeklenir. */
  get speed() {
    const w = this.getFieldWidth();
    return Math.max(this.baseSpeed, w / 1.35);
  }

  _move(dir, dt) {
    const w = this.getFieldWidth();
    const min = this.radius;
    const max = w - this.radius;
    this.x += dir * this.speed * dt;
    if (this.x < min) this.x = min;
    if (this.x > max) this.x = max;
  }
}
