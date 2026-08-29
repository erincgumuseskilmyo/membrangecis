/* ============================================================
   ASSETS.JS
   Görsel asset yönetimi + oyun içi çizim (canvas) katmanı.

   ASSET POLİTİKASI
   ----------------
   - Moleküller  -> gerçek görsel dosyası (assets/molecules/*.png).
     Tamamı kamu malı / serbest lisanslı bilimsel görsellerden
     hazırlanmıştır; kaynak listesi assets/CREDITS.md içindedir.
   - Hücre zarı  -> assets/membrane/bilayer_tile.png yatayda kusursuz
     tekrar eden fosfolipid deseni olarak döşenir.
   - Kanallar    -> canvas ile çizilir (ChannelArt). Altı mekanizmanın
     görsel dili böylece birbiriyle tutarlı, her ekran çözünürlüğünde
     net ve animasyonlu olur.
   - Efektler ve UI ikonları -> canvas / SVG ile çizilir.

   Herhangi bir görsel bulunamazsa oyun sade bir vektör yedek çizimle
   sorunsuz çalışmaya devam eder (bkz. MoleculeArt.drawFallback).

   İleride elinize altı mekanizma için de kanal görseli geçerse:
   aşağıdaki USE_CHANNEL_IMAGES bayrağını true yapıp dosyaları
   assets/channels/ içine koymanız yeterlidir.
============================================================ */

const USE_CHANNEL_IMAGES = false;

const ASSET_MANIFEST = {
  // Hücre zarı deseni (yatayda kusursuz döşenir)
  bilayer: 'assets/membrane/bilayer_tile.png',

  // Maddeler
  particle_water: 'assets/molecules/water.png',
  particle_oxygen: 'assets/molecules/oxygen.png',
  particle_hormone: 'assets/molecules/hormone.png',
  particle_facilitated: 'assets/molecules/facilitated_molecule.png',
  particle_sodium_ion: 'assets/molecules/sodium_ion.png',
  particle_big_molecule: 'assets/molecules/big_molecule.png',
  particle_bacteria: 'assets/molecules/bacteria.png',
  particle_export_product: 'assets/molecules/export_product.png',
};

if (USE_CHANNEL_IMAGES) {
  Object.assign(ASSET_MANIFEST, {
    channel_simple_diffusion: 'assets/channels/channel_simple_diffusion.png',
    channel_facilitated_diffusion: 'assets/channels/channel_facilitated_diffusion.png',
    channel_osmosis: 'assets/channels/channel_osmosis.png',
    channel_active_transport: 'assets/channels/channel_active_transport.png',
    channel_endocytosis: 'assets/channels/channel_endocytosis.png',
    channel_exocytosis: 'assets/channels/channel_exocytosis.png',
  });
}

class AssetManager {
  constructor(manifest) {
    this.manifest = manifest;
    this.images = {};
    this.available = {};
    this.total = Object.keys(manifest).length;
    this.loaded = 0;
    this.missing = [];
    this.ready = false;
  }

  preload() {
    const promises = Object.entries(this.manifest).map(([key, src]) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images[key] = img;
          this.available[key] = true;
          this.loaded++;
          resolve();
        };
        img.onerror = () => {
          this.available[key] = false;
          this.missing.push(src);
          this.loaded++;
          resolve();
        };
        img.src = src;
      });
    });
    return Promise.all(promises).then(() => {
      this.ready = true;
      if (this.missing.length) {
        console.info(
          '[Membrane Run] Bulunamayan görseller (sade çizimle devam ediliyor):\n  ' +
            this.missing.join('\n  ')
        );
      }
      return this.available;
    });
  }

  get progress() {
    return this.total === 0 ? 1 : this.loaded / this.total;
  }

  has(key) {
    return !!this.available[key];
  }

  get(key) {
    return this.images[key];
  }
}

/* ------------------------------------------------------------
   Ortak çizim yardımcıları
------------------------------------------------------------ */

const Draw = {
  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  },

  // "#4fd1c5" + alpha -> "rgba(79,209,197,alpha)"
  rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  },

  arrow(ctx, x, y, len, dir, width) {
    const d = dir >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y - (len / 2) * d);
    ctx.lineTo(x, y + (len / 2) * d);
    ctx.moveTo(x - width, y + (len / 2 - width) * d);
    ctx.lineTo(x, y + (len / 2) * d);
    ctx.lineTo(x + width, y + (len / 2 - width) * d);
    ctx.stroke();
  },
};

/* ------------------------------------------------------------
   MoleculeArt
   Maddeleri, altındaki açık renk disk + renkli halka ile birlikte
   çizer. Koyu arka planda hem molekül görselleri hem de yedek
   vektör çizimler net görünür.
------------------------------------------------------------ */

const MoleculeArt = {
  draw(ctx, assets, def, x, y, r, opts = {}) {
    const glow = opts.glow || 0;
    ctx.save();
    ctx.translate(x, y);

    // dış hâle (zara yaklaşınca / doğru geçişte parlar)
    if (glow > 0) {
      const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.7);
      g.addColorStop(0, Draw.rgba(def.color, 0.45 * glow));
      g.addColorStop(1, Draw.rgba(def.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // açık zemin diski — molekül görsellerinin okunurluğu için
    const disc = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
    disc.addColorStop(0, 'rgba(255,255,255,0.97)');
    disc.addColorStop(1, Draw.rgba(def.color, 0.55));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // renkli halka
    const ringW = Math.max(2, r * 0.11);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = ringW;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, r - ringW / 2), 0, Math.PI * 2);
    ctx.stroke();

    const img = assets && assets.has(def.assetKey) ? assets.get(def.assetKey) : null;
    if (img) {
      const s = r * 1.55;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      this.drawFallback(ctx, def, r * 0.78);
    }

    ctx.restore();
  },

  /* Görsel dosyası yoksa: sade, tanınabilir vektör çizim. */
  drawFallback(ctx, def, r) {
    const color = def.fallbackInk || '#123049';
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    switch (def.type) {
      case 'water': {
        ctx.beginPath();
        ctx.arc(0, r * 0.15, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-r * 0.6, -r * 0.5, r * 0.32, 0, Math.PI * 2);
        ctx.arc(r * 0.6, -r * 0.5, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'oxygen': {
        ctx.beginPath();
        ctx.arc(-r * 0.42, 0, r * 0.6, 0, Math.PI * 2);
        ctx.arc(r * 0.42, 0, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sodium_ion': {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${r * 0.8}px ${'Poppins, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', 0, r * 0.04);
        break;
      }
      case 'hormone': {
        ctx.lineWidth = Math.max(2, r * 0.16);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k;
            const px = (i - 1) * r * 0.85 + Math.cos(a) * r * 0.5;
            const py = Math.sin(a) * r * 0.5;
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        break;
      }
      case 'facilitated': {
        ctx.lineWidth = Math.max(2, r * 0.16);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k - Math.PI / 2;
          const px = Math.cos(a) * r * 0.85;
          const py = Math.sin(a) * r * 0.85;
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'bacteria': {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(r * 0.9, 0);
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          ctx.lineTo(r * (0.9 + t * 0.75), Math.sin(t * Math.PI * 3) * r * 0.22);
        }
        ctx.stroke();
        break;
      }
      case 'export_product': {
        ctx.lineWidth = Math.max(2, r * 0.18);
        ctx.beginPath();
        ctx.moveTo(0, r * 0.85);
        ctx.lineTo(0, -r * 0.1);
        ctx.moveTo(0, -r * 0.1);
        ctx.lineTo(-r * 0.8, -r * 0.85);
        ctx.moveTo(0, -r * 0.1);
        ctx.lineTo(r * 0.8, -r * 0.85);
        ctx.stroke();
        break;
      }
      default: {
        // büyük molekül vb.: yumuşak çok köşeli kütle
        ctx.beginPath();
        const pts = 11;
        for (let i = 0; i < pts; i++) {
          const a = (Math.PI * 2 * i) / pts;
          const wob = 0.72 + 0.28 * Math.abs(Math.sin(i * 1.7));
          const px = Math.cos(a) * r * wob;
          const py = Math.sin(a) * r * wob;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  },
};

/* ------------------------------------------------------------
   ChannelArt
   Altı taşıma mekanizmasının kanal görselleri. Hepsi aynı görsel
   dille (zarı dikine kesen protein gövdesi + mekanizmaya özgü iç
   sembol) çizilir, böylece öğrenci mekanizmaları şekilden ayırt
   edebilir.

   x  : zar üzerindeki yatay konum
   y  : zar orta çizgisi
   w  : kanal genişliği
   bh : zar bandının yarı yüksekliği
   t  : saniye cinsinden zaman (animasyon)
------------------------------------------------------------ */

const ChannelArt = {
  /* Kanalın zarda açtığı boşluğun genişliği. Zar deseni bu aralıkta
     çizilmez; böylece kanal, fosfolipidlerin arasına gerçekten
     yerleşmiş görünür. */
  gapWidth(mode, w) {
    switch (mode.id) {
      case 'endocytosis':
      case 'exocytosis':
        return w * 1.3;
      case 'osmosis':
        return w * 1.42;
      default:
        return w * 1.06;
    }
  },

  draw(ctx, mode, x, y, w, bh, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const c = mode.color;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);

    switch (mode.id) {
      case 'simple_diffusion':
        this._pore(ctx, c, w, bh, 0.62, pulse);
        this._flowArrows(ctx, c, w, bh, t, 1);
        break;
      case 'facilitated_diffusion':
        this._carrier(ctx, c, w, bh, pulse);
        this._flowArrows(ctx, c, w, bh, t, 1);
        break;
      case 'osmosis':
        this._aquaporin(ctx, c, w, bh, t);
        break;
      case 'active_transport':
        this._pump(ctx, c, w, bh, t, pulse);
        break;
      case 'endocytosis':
        this._invagination(ctx, c, w, bh, t);
        break;
      case 'exocytosis':
        this._evagination(ctx, c, w, bh, t);
        break;
      default:
        this._pore(ctx, c, w, bh, 0.6, pulse);
    }

    ctx.restore();
  },

  /* --- ortak gövde parçaları --- */

  _wall(ctx, color, x, w, bh, r) {
    const g = ctx.createLinearGradient(0, -bh, 0, bh);
    g.addColorStop(0, Draw.rgba(color, 0.95));
    g.addColorStop(0.5, Draw.rgba(color, 0.62));
    g.addColorStop(1, Draw.rgba(color, 0.95));
    ctx.fillStyle = g;
    Draw.roundRect(ctx, x, -bh, w, bh * 2, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  // İki duvar + ortada açıklık (basit difüzyon / genel gözenek)
  _pore(ctx, color, w, bh, openRatio, pulse) {
    const gap = w * openRatio * 0.5;
    const wallW = w * 0.5 - gap * 0.5;
    if (wallW > 2) {
      this._wall(ctx, color, -w / 2, wallW, bh, 6);
      this._wall(ctx, color, w / 2 - wallW, wallW, bh, 6);
    }
    // açıklıktaki ışıltı
    const g = ctx.createLinearGradient(0, -bh, 0, bh);
    g.addColorStop(0, Draw.rgba(color, 0.05 + 0.2 * pulse));
    g.addColorStop(0.5, Draw.rgba(color, 0.3 + 0.25 * pulse));
    g.addColorStop(1, Draw.rgba(color, 0.05 + 0.2 * pulse));
    ctx.fillStyle = g;
    ctx.fillRect(-gap, -bh, gap * 2, bh * 2);
  },

  // Taşıyıcı protein: geniş huni ağızlı, ortada dar boğaz
  _carrier(ctx, color, w, bh, pulse) {
    const lobe = (dir) => {
      ctx.beginPath();
      ctx.moveTo(dir * (w * 0.5), -bh);
      ctx.lineTo(dir * (w * 0.2), -bh * 0.18);
      ctx.lineTo(dir * (w * 0.2), bh * 0.18);
      ctx.lineTo(dir * (w * 0.5), bh);
      ctx.lineTo(dir * (w * 0.62), bh);
      ctx.lineTo(dir * (w * 0.62), -bh);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -bh, 0, bh);
      g.addColorStop(0, Draw.rgba(color, 0.95));
      g.addColorStop(0.5, Draw.rgba(color, 0.6));
      g.addColorStop(1, Draw.rgba(color, 0.95));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    lobe(-1);
    lobe(1);
    ctx.fillStyle = Draw.rgba(color, 0.18 + 0.22 * pulse);
    ctx.fillRect(-w * 0.2, -bh, w * 0.4, bh * 2);
  },

  // Akuaporin: dar, kum saati biçimli su kanalı
  _aquaporin(ctx, color, w, bh, t) {
    const side = (dir) => {
      ctx.beginPath();
      ctx.moveTo(dir * w * 0.55, -bh);
      ctx.quadraticCurveTo(dir * w * 0.12, 0, dir * w * 0.55, bh);
      ctx.lineTo(dir * w * 0.68, bh);
      ctx.lineTo(dir * w * 0.68, -bh);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -bh, 0, bh);
      g.addColorStop(0, Draw.rgba(color, 0.95));
      g.addColorStop(0.5, Draw.rgba(color, 0.66));
      g.addColorStop(1, Draw.rgba(color, 0.95));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    side(-1);
    side(1);
    // kanaldan akan su damlacıkları
    ctx.fillStyle = 'rgba(190,230,255,0.9)';
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.9 + i / 3) % 1);
      const yy = -bh + p * bh * 2;
      const rr = 2.6 - Math.abs(yy) / bh * 1.1;
      ctx.beginPath();
      ctx.arc(0, yy, Math.max(1.2, rr), 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Pompa: kapalı gövde + ATP rozeti + yukarı (gradyana karşı) ok
  _pump(ctx, color, w, bh, t, pulse) {
    Draw.roundRect(ctx, -w * 0.42, -bh, w * 0.84, bh * 2, 8);
    const g = ctx.createLinearGradient(0, -bh, 0, bh);
    g.addColorStop(0, Draw.rgba(color, 0.98));
    g.addColorStop(0.5, Draw.rgba(color, 0.72));
    g.addColorStop(1, Draw.rgba(color, 0.98));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // gradyana karşı taşıma oku
    ctx.strokeStyle = 'rgba(26,16,0,0.75)';
    ctx.lineWidth = 2.6;
    Draw.arrow(ctx, 0, 0, bh * 1.2, -1, 4.5);

    // ATP kıvılcımı
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    ctx.fillStyle = '#ffe08a';
    const s = w * 0.16;
    ctx.beginPath();
    ctx.moveTo(w * 0.34 - s * 0.2, -bh - s * 0.55);
    ctx.lineTo(w * 0.34 + s * 0.5, -bh - s * 0.55);
    ctx.lineTo(w * 0.34 + s * 0.05, -bh + s * 0.05);
    ctx.lineTo(w * 0.34 + s * 0.55, -bh + s * 0.05);
    ctx.lineTo(w * 0.34 - s * 0.35, -bh + s * 0.95);
    ctx.lineTo(w * 0.34 - s * 0.02, -bh + s * 0.15);
    ctx.lineTo(w * 0.34 - s * 0.5, -bh + s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Endositoz: içe doğru çöken zar cebi
  _invagination(ctx, color, w, bh, t) {
    const depth = bh * (1.7 + 0.25 * Math.sin(t * 2.2));
    ctx.beginPath();
    ctx.moveTo(-w * 0.62, -bh);
    ctx.bezierCurveTo(-w * 0.5, depth * 0.9, w * 0.5, depth * 0.9, w * 0.62, -bh);
    ctx.lineTo(w * 0.62, bh * 0.2);
    ctx.bezierCurveTo(w * 0.42, depth * 1.35, -w * 0.42, depth * 1.35, -w * 0.62, bh * 0.2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -bh, 0, depth);
    g.addColorStop(0, Draw.rgba(color, 0.95));
    g.addColorStop(1, Draw.rgba(color, 0.6));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // cebin içine çeken oklar
    ctx.strokeStyle = Draw.rgba(color, 0.85);
    ctx.lineWidth = 2.2;
    Draw.arrow(ctx, 0, -bh * 0.15, bh * 1.1, 1, 4);
  },

  // Ekzositoz: dışa doğru kabaran zar + ayrılan vezikül
  _evagination(ctx, color, w, bh, t) {
    const rise = bh * (1.7 + 0.25 * Math.sin(t * 2.2));
    ctx.beginPath();
    ctx.moveTo(-w * 0.62, bh);
    ctx.bezierCurveTo(-w * 0.5, -rise * 0.9, w * 0.5, -rise * 0.9, w * 0.62, bh);
    ctx.lineTo(w * 0.62, -bh * 0.2);
    ctx.bezierCurveTo(w * 0.42, -rise * 1.35, -w * 0.42, -rise * 1.35, -w * 0.62, -bh * 0.2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, bh, 0, -rise);
    g.addColorStop(0, Draw.rgba(color, 0.95));
    g.addColorStop(1, Draw.rgba(color, 0.6));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = Draw.rgba(color, 0.85);
    ctx.lineWidth = 2.2;
    Draw.arrow(ctx, 0, bh * 0.15, bh * 1.1, -1, 4);

    // kopan vezikül
    const p = (t * 0.55) % 1;
    ctx.save();
    ctx.globalAlpha = 0.75 * (1 - p);
    ctx.strokeStyle = Draw.rgba(color, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -rise - 6 - p * bh * 1.6, bh * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // Kanaldan geçen akış okları
  _flowArrows(ctx, color, w, bh, t, dir) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.8 + i / 2) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
      const yy = -bh + p * bh * 2;
      Draw.arrow(ctx, 0, yy, 9, dir, 3.5);
    }
    ctx.restore();
  },
};

/* ------------------------------------------------------------
   MembraneArt
   Fosfolipid çift katmanı: bilayer_tile.png yatayda döşenir.
   Görsel yoksa sade nokta+bant çizimine düşer.
------------------------------------------------------------ */

const MembraneArt = {
  _pattern: null,
  _patternKey: '',

  /* gap: { x, width } verilirse zar deseni o aralıkta çizilmez. */
  draw(ctx, assets, w, y, bandHalf, t, gap) {
    ctx.save();

    // yumuşak altın hâle
    const glow = ctx.createLinearGradient(0, y - bandHalf * 2.2, 0, y + bandHalf * 2.2);
    glow.addColorStop(0, 'rgba(232,163,61,0)');
    glow.addColorStop(0.5, 'rgba(232,163,61,0.20)');
    glow.addColorStop(1, 'rgba(232,163,61,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, y - bandHalf * 2.2, w, bandHalf * 4.4);

    const img = assets && assets.has('bilayer') ? assets.get('bilayer') : null;
    const pattern = img ? this._getPattern(ctx, img, bandHalf * 2) : null;

    // Kanalın oturduğu aralık boş bırakılır: zar, kanalın solunda ve
    // sağında iki parça hâlinde çizilir.
    const segments = [];
    if (gap && gap.width > 0) {
      const left = gap.x - gap.width / 2;
      const right = gap.x + gap.width / 2;
      if (left > 0) segments.push([0, Math.min(left, w)]);
      if (right < w) segments.push([Math.max(0, right), w]);
    } else {
      segments.push([0, w]);
    }

    if (pattern) {
      ctx.save();
      ctx.translate(0, y - bandHalf);
      ctx.fillStyle = pattern;
      segments.forEach(([x0, x1]) => ctx.fillRect(x0, 0, x1 - x0, bandHalf * 2));
      ctx.restore();
    } else {
      segments.forEach(([x0, x1]) => this._fallbackBand(ctx, x0, x1, y, bandHalf, t));
    }

    ctx.restore();
  },

  _getPattern(ctx, img, height) {
    const key = `${img.src}@${Math.round(height)}`;
    if (this._pattern && this._patternKey === key) return this._pattern;
    try {
      const tw = Math.max(2, Math.round((img.width / img.height) * height));
      const off = document.createElement('canvas');
      off.width = tw;
      off.height = Math.max(2, Math.round(height));
      const octx = off.getContext('2d');
      if (!octx || !octx.drawImage) return null;
      octx.drawImage(img, 0, 0, off.width, off.height);
      const p = ctx.createPattern(off, 'repeat-x');
      if (!p) return null;
      this._pattern = p;
      this._patternKey = key;
      return p;
    } catch (err) {
      return null;
    }
  },

  _fallbackBand(ctx, x0, x1, y, bandHalf, t) {
    const grad = ctx.createLinearGradient(0, y - bandHalf, 0, y + bandHalf);
    grad.addColorStop(0, 'rgba(232,163,61,0.30)');
    grad.addColorStop(0.5, 'rgba(232,163,61,0.14)');
    grad.addColorStop(1, 'rgba(232,163,61,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y - bandHalf, x1 - x0, bandHalf * 2);

    const spacing = 22;
    ctx.strokeStyle = 'rgba(255,214,140,0.45)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 2; row++) {
      const rowY = row === 0 ? y - bandHalf + 5 : y + bandHalf - 5;
      ctx.fillStyle = '#e8a33d';
      for (let x = Math.ceil(x0 / spacing) * spacing + spacing / 2; x < x1; x += spacing) {
        const wave = Math.sin(t * 1.3 + x * 0.045 + row * 2) * 1.4;
        ctx.beginPath();
        ctx.arc(x, rowY + wave, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, rowY + wave + (row === 0 ? 4 : -4));
        ctx.lineTo(x, y + (row === 0 ? -2 : 2));
        ctx.stroke();
      }
    }
  },
};
