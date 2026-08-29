# MEMBRANE RUN — Hücre Zarını Yönet

Laborant ve Veteriner Sağlık önlisans öğrencileri için 2 dakikalık,
tarayıcı tabanlı hücre zarı taşıma mekanizmaları eğitim/arcade oyunu.

> **Oyunu internete koymak ve ortak skor tablosunu açmak için:**
> **[KURULUM.md](KURULUM.md)** — GitHub Pages + Supabase, adım adım,
> yaklaşık 15 dakika.

---

## 0. GÖRSEL VE SES ASSETLERİ

Oyun artık **gerçek görsel ve ses dosyalarıyla** geliyor. Tamamı kamu
malı veya serbest lisanslıdır; kaynak ve atıf listesi
**`assets/CREDITS.md`** dosyasındadır.

| Katman | Nasıl geliyor |
|---|---|
| Moleküller (8 madde) | Wikimedia Commons kamu malı bilimsel görselleri (`assets/molecules/`) |
| Hücre zarı | `assets/membrane/bilayer_tile.png` — yatayda kusursuz tekrar eden fosfolipid deseni |
| Ses efektleri (10 ses) | Kenney "Interface Sounds", CC0 (`assets/sfx/`) |
| Arka plan müziği | Web Audio ile üretilir, dosya yok |
| Kanal / mekanizma görselleri | Oyun içinde canvas ile çizilir (`ChannelArt`) |
| Efektler ve UI ikonları | Canvas / CSS ile çizilir |

**Kanallar neden çizim?** Altı taşıma mekanizmasının tamamı için
birbiriyle uyumlu, saydam zeminli bir görsel seti bulunmuyordu.
Karışık stilde altı ayrı görsel yerine altısı da aynı görsel dille
(zarı kesen protein gövdesi + mekanizmaya özgü iç sembol) çizildi:
her çözünürlükte net, animasyonlu, sıfır dosya boyutlu ve
birbirinden ayırt edilebilir. Elinize altı görselden oluşan uyumlu
bir set geçerse `js/assets.js` içindeki

```js
const USE_CHANNEL_IMAGES = false;
```

satırını `true` yapıp dosyaları `assets/channels/` klasörüne koymanız
yeterlidir (ayrıntı: `assets/channels/README.txt`).

Eski `assets/channels/*.png` ve `assets/membrane/membrane*.png`
dosyaları silinmedi; oyun tarafından yüklenmiyorlar.

Bir görsel dosyası bulunamazsa oyun otomatik olarak sade vektör
çizime, bir ses dosyası bulunamazsa Web Audio ile üretilen yedek tona
düşer — hiçbir durumda bozulmaz.

---

## 1. NASIL ÇALIŞTIRILIR

En sağlıklı yöntem, klasörü basit bir yerel sunucu ile açmaktır:

```bash
python -m http.server 8000
```

sonra tarayıcıda `http://localhost:8000` adresini açın. VS Code
kullanıyorsanız "Live Server" eklentisiyle `index.html`'i de
açabilirsiniz.

`index.html` dosyasına doğrudan çift tıklamak (file://) da çalışır;
ses dosyaları `<audio>` öğesiyle yüklendiği için `file://` altında da
duyulur. Yine de sınıfta yerel sunucu önerilir.

**İnternet olmadan tam oynanabilir.** İnternet yalnızca Google Fonts
(Poppins/Inter) ve isteğe bağlı online skor tablosu için kullanılır;
ikisi de yoksa oyun sistem fontlarına ve offline moda düşer.

---

## 2. DOSYA YAPISI

```
/Membran Geçiş
    index.html
    style.css
    README.md
    KURULUM.md         -> online yayın + Supabase kurulum rehberi
    supabase-schema.sql
    .nojekyll          -> GitHub Pages için
    js/
        config.js       -> TEK AYAR DOSYASI (Supabase + sınıf kodu)
        assets.js       -> asset yönetimi + tüm canvas çizimleri
                           (MoleculeArt, ChannelArt, MembraneArt)
        tutorial.js     -> oyun öncesi mekanizma tanıtımı (7 adım)
        audio.js        -> wav efektleri + üretimsel arka plan müziği
        timer.js        -> 120 saniyelik geri sayım
        transport.js    -> 6 taşıma mekanizması tanımı
        particle.js     -> madde tanımları + ağırlıklı spawn sistemi
        player.js       -> oyuncunun kanalı (yatay hareket)
        score.js        -> skor / combo / ATP / mekanizma istatistiği
        leaderboard.js  -> yerel + (opsiyonel) Supabase online skor
        ui.js           -> ekranlar, HUD, mekanizma şeridi, kontroller
        game.js         -> ana oyun döngüsü, çarpışma mantığı, render
    assets/
        CREDITS.md      -> kaynak ve lisans listesi
        molecules/  membrane/  sfx/  channels/  effects/  ui/
    test/
        smoke.js        -> otomatik mantık testi (bkz. bölüm 10)
```

---

## 3. KONTROLLER

**Mobil / dokunmatik — doğrudan manipülasyon:**

| Hareket | Etki |
|---|---|
| Oyun alanında **parmağını sürükle** | Kanal parmağını takip eder |
| **Zara dokun** | Sıradaki taşıma mekanizmasına geçer |
| Zar dışına dokun | Kanal dokunulan noktaya gider |
| Üstteki **mekanizma şeridine** dokun | O mekanizmayı doğrudan seçer |

Ok tuşu butonları kaldırıldı. Sebebi iki yönlü: (1) parmağı kanalın
üstünde tutmak, ekranın altındaki butonlara bakmaktan çok daha hızlı ve
doğal; (2) butonların kapladığı yer oyun alanına eklendiğinde oyuncu
gelen maddeyi çok daha erken görüyor.

Sürükleme ile dokunma 10 px / 400 ms eşiğiyle ayrılır: zar üzerinde
sürüklerken yanlışlıkla mekanizma değişmez.

**Masaüstü (klavye + fare):**
| Tuş | Etki |
|---|---|
| ← / → | Kanalı sola / sağa hareket ettirir |
| ↑ / ↓ | Sıradaki / önceki taşıma mekanizması |
| 1 – 6 | Mekanizmayı doğrudan seçer |
| ESC veya P | Duraklat / devam et |

Fareyle de sürükleme ve tıklama aynı şekilde çalışır.

Oyun, sekme arka plana geçtiğinde veya pencere odağı kaybettiğinde
kendiliğinden duraklar.

---

## 4. MADDELER VE DOĞRU MEKANİZMALARI

| Madde | Doğru mekanizma | Puan |
|---|---|---|
| SU | Osmoz | +20 |
| OKSİJEN | Basit difüzyon | +20 |
| STEROİD HORMON | Basit difüzyon | +20 |
| GLUKOZ | Kolaylaştırılmış difüzyon | +20 |
| SODYUM (Na⁺) | Aktif taşıma | +25, ATP −1 |
| BÜYÜK PROTEİN | Endositoz | +30 |
| BAKTERİ | Endositoz (fagositoz) | +30 |
| ANTİKOR (hücre ürünü) | Ekzositoz | +30 |

Maddeler, **her mekanizmanın çıkma olasılığı eşit olacak şekilde**
ağırlıklandırılarak üretilir (bir mekanizmayı iki madde paylaşıyorsa
her biri yarı ağırlıkta çıkar) ve aynı madde arka arkaya üç kez
gelmez. Aynı anda ekrandaki maddeler yatayda birbirinden uzak
konumlara yerleştirilir.

Bu liste oyun içinde **MEKANİZMALAR** ekranından da görülebilir.

---

## 5. PUANLAMA

| Olay | Puan |
|---|---|
| Basit difüzyon / kolaylaştırılmış difüzyon / osmoz | +20 |
| Aktif taşıma | +25 (ATP −1) |
| Endositoz / Ekzositoz | +30 |
| Yanlış mekanizma | −10, combo sıfırlanır |
| Madde kaçırıldı (kanal hizasız) | −5, combo sıfırlanır |
| 5'li combo | +50 bonus |
| 10'lu combo | +100 bonus |

Skor asla 0'ın altına düşmez. ATP 0'a düşse bile oyun bitmez; ATP
burada tamamen eğitimsel geri bildirimdir.

Oyun **120 saniye** sürer ve 24 saniyelik beş kademeye bölünür:

| Süre | Kademe | Madde hızı | Aynı anda |
|---|---|---|---|
| 0–24 sn | ISINMA | 50 px/sn | 1 |
| 24–48 sn | KOLAY | 75 px/sn | 2 |
| 48–72 sn | ORTA | 100 px/sn | 2 |
| 72–96 sn | ZOR | 130 px/sn | 3 |
| 96–120 sn | ÇOK ZOR | 165 px/sn | 3 |

Hız belirgin biçimde yavaş başlar; en yüksek kademedeki 165 px/sn,
önceki 5 dakikalık sürümün de en yüksek hızıydı — yani oyun hiçbir
zaman eskisinden hızlı akmaz, sadece oraya daha kısa sürede varır.
Aktif kademe HUD'ın sağ üstünde gösterilir.

Oyun alanı ekran yüksekliğinin yaklaşık **%80'ini** kaplar ve zar
merkezin biraz altındadır (%60); maddelerin 8'inden 7'si yukarıdan
geldiği için bu, karar vermek için en uzun yolu bırakır.

---

## 6. MEKANİZMA TANITIMI

Oyuncu **ilk kez** oynadığında (ve öğrenme modunu her seçtiğinde) oyun
başlamadan önce 7 adımlık bir tanıtım açılır: altı mekanizma tek tek,
"İLERİ" diyerek anlatılır, son adımda kontroller özetlenir.

Her adımda mekanizmanın **oyundaki gerçek kanal görseli** canlı olarak
çizilir ve o mekanizmayla geçen madde animasyonla zardan geçirilir —
öğrenci oyunda göreceği şeyi birebir tanır. Adımda ayrıca mekanizmanın
adı, ATP gerektirip gerektirmediği, tanımı, o yolla geçen maddeler ve
puanı yazar.

Tanıtım bir kez tamamlandığında (veya atlandığında) `localStorage`'a
işaretlenir ve sonraki oyunlarda otomatik açılmaz. Başlangıç ekranındaki
**MEKANİZMA TANITIMI** düğmesiyle istendiği zaman tekrar açılabilir.

---

## 7. OYUN MODLARI

**DEĞERLENDİRME MODU** (varsayılan)
İpucu yok, tam hız, skor liderlik tablosuna işlenir.

**ÖĞRENME MODU**
- Her maddenin altında doğru mekanizma ipucu gösterilir.
- Yanlış yapıldığında "DOĞRUSU: …" bildirimi çıkar.
- Zorluk kademeleri %40 daha yavaş ilerler.
- Skor **kaydedilmez** (adil olması için) ve ekranda bu açıkça
  belirtilir.

Sonuç ekranı her iki modda da **mekanizma bazlı doğru/yanlış
dökümünü**, isabet oranını ve en çok hata yapılan mekanizma için bir
çalışma önerisi gösterir.

---

## 8. ORTAK SKOR TABLOSU

Skor tablosunun iki çalışma biçimi vardır ve oyun hangisinde olduğunu
ekranda **açıkça söyler** — hiçbir zaman sahte biçimde "online tablo
hazır" demez.

| Durum | Sonuç ekranındaki başlık |
|---|---|
| `js/config.js` doldurulmuş, bağlantı var | **SINIF SKOR TABLOSU** (🌐 canlı) |
| Kurulmamış / internet yok / hata | **BU CİHAZDAKİ SKORLAR** (📴) + sarı uyarı |

Kurulum tek dosyadan yapılır: **`js/config.js`**. Supabase URL'i, anon
key'i ve sınıf kodunu oraya yazmanız yeterlidir; başka hiçbir dosyaya
dokunmanız gerekmez. Adım adım anlatım **[KURULUM.md](KURULUM.md)**
dosyasındadır.

Skor tablosu artık:

- **Sonuç ekranında doğrudan görünür** (ayrıca butonla da açılabilir),
- Oyuncunun kendi satırını vurgular ve "sınıfta kaçıncı oldun"u söyler,
- İsabet oranını da gösterir,
- `bestPerStudent` ayarıyla her öğrencinin yalnızca **en iyi** skorunu
  listeler,
- `groupCode` ile aynı Supabase projesini birden fazla sınıf için
  kullanmanıza izin verir.

**Sahte skor koruması hakkında dürüst not.** `supabase-schema.sql`
içindeki CHECK kısıtı, oyunun kurallarına göre **imkânsız** olan
skorları (ör. 3 doğruyla 999999 puan) veritabanı seviyesinde reddeder;
RLS politikaları da mevcut satırların değiştirilmesini/silinmesini
engeller. Ama bu tam bir hile önleme değildir: kararlı biri hâlâ
kuralların içinde kalan sahte bir skor gönderebilir. Tam koruma için
INSERT'in bir Supabase Edge Function üzerinden yapılıp skorun sunucuda
yeniden hesaplanması gerekir; bu sürüm onu içermez.

**Gizlilik.** Öğrencinin girdiği ad ve numara veritabanına gider;
tabloda soyadı kısaltılarak gösterilir ("Ayşe Y."). Ayrıntı:
KURULUM.md sonundaki gizlilik notu.

---

## 9. SES

- **Efektler:** `assets/sfx/` içindeki 10 kısa CC0 wav dosyası
  (doğru, yanlış, kaçırma, ATP, combo, mekanizma değişimi, geri
  sayım, başlangıç, bitiş, tıklama). Dosya yüklenemezse Web Audio ile
  üretilen yedek ton çalar.
- **Müzik:** dosya yok; pentatonik bir arpej Web Audio ile üretilir
  ve zorluk arttıkça tempo hafifçe yükselir.
- Sağ üstteki 🔊 ve ♪ butonlarıyla ses ve müzik ayrı ayrı açılıp
  kapatılır; tercih tarayıcıda saklanır.

---

## 10. TEST

```bash
npm install jsdom
node test/smoke.js
```

`test/smoke.js`, jsdom ile tüm modülleri yükleyip şunları doğrular:

- Tüm scriptler ve oyun nesnesi hatasız kuruluyor.
- BAŞLA → geri sayım geçişi; ana döngü 30 kare hatasız çalışıyor.
- ← → ile kanal, ↑ ↓ ile mekanizma, **1–6 ile doğrudan mekanizma**
  seçimi çalışıyor; ESC duraklatıyor.
- **Her taşıma mekanizmasının en az bir maddesi var.**
- Su + osmoz (hizalı) → başarılı geçiş.
- Oksijen + osmoz → −10.
- Hizasız/kaçırılan madde → −5.
- **Sodyum + aktif taşıma → +25 ve ATP −1.**
- Skor 0'ın altına düşmüyor; toplam beklenen değerle eşleşiyor
  (`score: 30 correct: 2 wrong: 1 missed: 1 atp: 19`).
- 300. saniyede sonuç ekranına hatasız geçiş.

Ayrıca gerçek tarayıcıda (masaüstü 1280×800 ve mobil 430×860) elle
doğrulandı: asset yüklemesi (9/9 görsel, 10/10 ses), zar deseninin
kanal boşluğuyla döşenmesi, altı kanal çiziminin ayırt edilebilirliği,
öğrenme modu ipuçları, mekanizma şeridi (tıklama + 1–6 tuşları),
sonuç ekranı dökümü ve konsolun hatasız olması.

Online skor tablosu, Supabase'in PostgREST arayüzünü taklit eden yerel
bir sunucuya karşı uçtan uca doğrulandı: skor gönderimi (INSERT),
tablonun çekilmesi (sınıf koduna göre filtreli SELECT), aynı öğrencinin
yalnızca en iyi skorunun listelenmesi, oyuncunun kendi satırının
vurgulanması, "sınıfta kaçıncısın" satırı ve imkânsız skorun CHECK
kısıtıyla reddedilmesi (HTTP 400).

Ayrıca test şunları doğrular: süre 120 saniye, hız kademeleri
50→75→100→130→165, ilk oyunda tanıtımın açılması, yedi adımın
tamamlanınca oyunun başlaması, tanıtım görüldükten sonra doğrudan
başlaması, sürüklemenin kanalı taşıması (ve alan dışına taşmaması) ile
zar hizasının doğru tanınması.

Sürükle/dokun kontrolleri ayrıca gerçek tarayıcıda, gerçek
`PointerEvent`'lerle uçtan uca denendi: sürükleme kanalı parmağa
taşıyor, zara dokunma mekanizmayı değiştirip kanalı yerinde bırakıyor,
zar dışına dokunma kanalı oraya taşıyıp mekanizmayı değiştirmiyor ve
zar üzerinde sürüklerken mekanizma yanlışlıkla değişmiyor.

**Gerçek bir Supabase projesine karşı test edilmedi** — hesap
açılmasını gerektirdiği için. KURULUM.md'deki adımları uyguladıktan
sonra 1.5'teki kontrolü yapmanız yeterlidir. Gerçek dokunmatik cihazda
parmak kontrolü de elle test edilmelidir.

---

## 11. BU SÜRÜMDE DÜZELTİLEN ÖNEMLİ HATALAR

Oyun ekranı `display:none` iken canvas ölçülüyordu; BAŞLA'dan sonra
yeniden ölçülmediği için oyun alanı **1×1 piksel** kalıyor ve hiçbir
şey görünmüyordu (yalnızca pencere yeniden boyutlandırılırsa
düzeliyordu). `handleStart()` artık ekranı gösterdikten hemen sonra
`_resize()` çağırıyor.

**Çift kurulum koruması.** `DOMContentLoaded` iki kez tetiklenirse (ya da
script yanlışlıkla iki kez yüklenirse) ikinci bir `Game` örneği oluşuyor,
aynı düğmelere ikinci bir dinleyici bağlanıyor ve her tıklama iki kez
işleniyordu. Tanıtım eklenince bu, "BAŞLA"ya basınca tanıtımın açılıp
oyunun da aynı anda başlaması olarak ortaya çıktı. Artık `game.js`
ikinci örneğin oluşmasını engelliyor.
