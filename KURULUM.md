# MEMBRANE RUN — ONLINE KURULUM

Bu rehber iki şeyi yapar:

1. **Oyunu internete koyar** (GitHub Pages) → öğrencileriniz telefondan
   bir linke tıklayıp oynar, hiçbir şey kurmalarına gerek kalmaz.
2. **Ortak skor tablosunu açar** (Supabase) → herkesin skoru aynı
   tabloda görünür.

Toplam süre: yaklaşık **15 dakika**. Kod yazmanız gerekmez, sadece
kopyala-yapıştır.

> İkisi birbirinden bağımsızdır. Sadece 1. bölümü yaparsanız oyun
> yayında olur ama her öğrenci kendi skorunu görür. Sadece 2. bölümü
> yaparsanız oyun bilgisayarınızda ortak tabloyla çalışır.

---

## BÖLÜM 1 — ORTAK SKOR TABLOSU (Supabase)

Önce bunu yapın; sonra oyunu yayınlarken ayarlar hazır olur.

### 1.1 Ücretsiz proje oluşturun

1. [supabase.com](https://supabase.com) adresine girin, **Start your
   project** ile ücretsiz bir hesap açın (GitHub hesabınızla
   girebilirsiniz).
2. **New project** deyin.
   - **Name:** `membrane-run`
   - **Database Password:** güçlü bir şifre üretip **bir yere kaydedin**
     (oyun için gerekmez, ama Supabase panelinde lazım olabilir).
   - **Region:** `Central EU (Frankfurt)` — Türkiye'ye en yakın seçenek.
3. Projenin hazırlanması 1–2 dakika sürer.

### 1.2 Tabloyu oluşturun

1. Sol menüden **SQL Editor** → **New query**.
2. Bu klasördeki **`supabase-schema.sql`** dosyasını bir metin
   düzenleyiciyle açın, **tamamını** kopyalayıp pencereye yapıştırın.
3. Sağ alttan **Run** deyin. `Success. No rows returned` görmelisiniz.

Bu adım şunları kurar: skor tablosu, sınıf koduna göre hızlı sıralama
indeksi, "kimse mevcut skorları silemez/değiştiremez" güvenlik
politikası ve imkânsız skorları reddeden bir kontrol kısıtı.

### 1.3 Anahtarları kopyalayın

1. Sol menüde en altta **Project Settings** (dişli) → **Data API**.
2. **Project URL** değerini kopyalayın
   (`https://xxxxxxxxxxxx.supabase.co` biçiminde).
3. Aynı sayfada (veya **API Keys** sekmesinde) **anon / public**
   anahtarını kopyalayın — `eyJ...` ile başlayan uzun bir metin.

> **`anon` anahtarı gizli değildir**, tarayıcıya gömülmesi normaldir.
> Yetkileri 1.2'de kurduğunuz politikalarla sınırlıdır: okuma ve yeni
> skor ekleme. `service_role` anahtarını **asla** kullanmayın.

### 1.4 `js/config.js` dosyasını doldurun

`js/config.js` dosyasını bir metin düzenleyiciyle açın ve yalnızca üç
satırı değiştirin:

```js
const MEMBRANE_RUN_CONFIG = {
  supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
  table: 'membrane_run_scores',
  groupCode: 'LVS-1A',        // <- sınıfınızın kodu
  topCount: 10,
  bestPerStudent: true,
};
```

**`groupCode` neden önemli?** Aynı Supabase projesini birden fazla
sınıf için kullanabilirsiniz. Her sınıfa farklı bir kod verirseniz
(`LVS-1A`, `VET-2B`, `2026-guz` gibi) her sınıf yalnızca kendi
tablosunu görür.

### 1.5 Kontrol edin

Oyunu açın, kısa bir oyun oynayın (duraklatıp beklemeniz yeterli değil,
süre dolmalı — test için `js/game.js` içindeki `GAME_SECONDS` değerini
geçici olarak `20` yapabilirsiniz).

Sonuç ekranında skor tablosunun üstünde **"SINIF SKOR TABLOSU"**
yazıyorsa online çalışıyordur. **"BU CİHAZDAKİ SKORLAR"** yazıyorsa
bağlantı kurulamamıştır; ekrandaki sarı uyarı sebebini söyler.

---

## BÖLÜM 2 — OYUNU YAYINLAMA (GitHub Pages)

### 2.1 GitHub hesabı ve depo

1. [github.com](https://github.com) → hesabınız yoksa **Sign up**.
2. Sağ üstteki **+** → **New repository**.
   - **Repository name:** `membran-gecis`
   - **Public** seçin (GitHub Pages ücretsiz planda public depo ister).
   - **README, .gitignore, license eklemeyin** — hepsi zaten hazır.
3. **Create repository** deyin. Açılan sayfadaki
   `https://github.com/KULLANICI_ADINIZ/membran-gecis.git`
   adresini not edin.

### 2.2 Dosyaları yükleyin

**Kolay yol (komut satırı yok):**

1. Bu klasörün içeriğini bir ZIP'e koymayın — **dosyaları doğrudan**
   yükleyeceksiniz.
2. Deponun sayfasında **uploading an existing file** bağlantısına
   tıklayın.
3. `index.html`, `style.css`, `js` klasörü, `assets` klasörü ve
   diğer dosyaları sürükleyip bırakın.
4. Altta **Commit changes** deyin.

> Tarayıcıdan yükleme klasörleri de kabul eder; `js` ve `assets`
> klasörlerini olduğu gibi sürükleyin.

**Git kullanıyorsanız (bu klasörde depo hazır kuruldu):**

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/membran-gecis.git
git branch -M main
git push -u origin main
```

### 2.3 Pages'i açın

1. Deponun **Settings** sekmesi → sol menüden **Pages**.
2. **Source:** `Deploy from a branch`
3. **Branch:** `main` , klasör: `/ (root)` → **Save**.
4. 1–2 dakika sonra sayfanın üstünde adresiniz görünür:

```
https://KULLANICI_ADINIZ.github.io/membran-gecis/
```

Bu linki öğrencilerinizle paylaşın. Telefon, tablet, bilgisayar —
hepsinde çalışır.

### 2.4 Sonradan değişiklik yaparsanız

Dosyaları güncelledikten sonra öğrencilerin tarayıcısı eski sürümü
gösteriyorsa, `index.html` içindeki tüm `?v=2` ifadelerini `?v=3`
yapın (Ctrl+H ile toplu değiştirin). Bu, tarayıcı önbelleğini kırar.

---

## SIK KARŞILAŞILAN SORUNLAR

**Sonuç ekranında "BU CİHAZDAKİ SKORLAR" yazıyor**
`js/config.js` içindeki URL veya anahtar eksik/yanlış. URL
`https://` ile başlayıp `.supabase.co` ile bitmeli, sonunda `/`
olmamalı.

**"Ortak tabloya ulaşılamadı (HTTP 401)"**
`anon` anahtarı yanlış kopyalanmış. Baştan sona, boşluksuz kopyalayın.

**"Ortak tabloya ulaşılamadı (HTTP 404)"**
`supabase-schema.sql` çalıştırılmamış ya da tablo adı değiştirilmiş.
1.2 adımını tekrarlayın.

**"HTTP 400 — violates check constraint"**
Veritabanı, kurallara göre imkânsız olan bir skoru reddetti. Normal
oynayışta olmaz; birisi konsoldan sahte skor göndermeye çalışmıştır.

**Skorlar geliyor ama tablo boş görünüyor**
`groupCode` değeri, skorların gönderildiği koddan farklı. Aynı olmalı.

**Öğrenme modunda oynadım, skorum tabloya girmedi**
Beklenen davranış: öğrenme modunda ipuçları açık olduğu için skorlar
kaydedilmez. Değerlendirme modunda oynayın.

**Ses gelmiyor**
Tarayıcılar, kullanıcı sayfaya dokunana kadar sesi engeller. BAŞLA'ya
basıldığında açılır. Sağ üstteki 🔊 ve ♪ düğmelerini de kontrol edin.

---

## DERS SONRASI

Sınıfın genel durumunu görmek için Supabase **SQL Editor**'de:

```sql
select group_code,
       count(*) as oyun_sayisi,
       round(avg(score)) as ort_skor,
       round(avg(accuracy)) as ort_isabet,
       round(avg(wrong_count)) as ort_yanlis
from public.membrane_run_scores
group by group_code;
```

Tabloyu bir sonraki dönem için sıfırlamak (**geri alınamaz**):

```sql
delete from public.membrane_run_scores where group_code = 'LVS-1A';
```

Hazır sorguların tamamı `supabase-schema.sql` dosyasının sonundadır.

---

## GİZLİLİK NOTU

Oyun, öğrencinin **girdiği ad ve öğrenci numarasını** Supabase
veritabanınıza gönderir. Skor tablosunda soyadı kısaltılarak gösterilir
(“Ayşe Y.”), ama veritabanında tam hâliyle durur. Öğrencilerinizi
bilgilendirin; isterlerse takma ad kullanabilecekleri şekilde
duyurabilir ya da öğrenci numarası alanını boş bırakmalarını
söyleyebilirsiniz.
