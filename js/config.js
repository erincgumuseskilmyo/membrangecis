/* ============================================================
   CONFIG.JS  —  TEK AYAR DOSYASI

   Online skor tablosunu açmak için SADECE bu dosyayı
   düzenlemeniz yeterlidir. Adım adım kurulum: KURULUM.md

   Boş bırakırsanız oyun tamamen çalışmaya devam eder; skorlar
   yalnızca oynayan kişinin kendi tarayıcısında saklanır ve
   arayüzde bu açıkça belirtilir.
============================================================ */

const MEMBRANE_RUN_CONFIG = {
  /* Supabase > Project Settings > Data API > Project URL
     Örnek: 'https://abcdefghijklm.supabase.co'  */
  supabaseUrl: 'https://fopolcaxcsnxlarhpyts.supabase.co/rest/v1/',

  /* Supabase > Project Settings > API Keys > anon public
     Bu anahtar herkese açıktır, gizli değildir; tarayıcıya
     gömülmesi normaldir. Yetkileri supabase-schema.sql
     içindeki RLS politikalarıyla sınırlanmıştır.  */
  supabaseAnonKey: '',

  /* SQL şemasında oluşturulan tablo adı. Değiştirmeyin. */
  table: 'membrane_run_scores',

  /* Sınıf / şube kodu. Aynı Supabase projesini birden fazla
     sınıf için kullanacaksanız her sınıfa farklı bir kod verin;
     skor tablosu yalnızca aynı kodu taşıyan skorları gösterir.
     Örnek: 'LVS-1A', 'VET-2026-guz'  */
  groupCode: 'vet2026guz',

  /* Skor tablosunda kaç kişi gösterilsin. */
  topCount: 20,

  /* true: her öğrencinin yalnızca EN İYİ skoru tabloda görünür.
     false: her oyun ayrı satır olarak listelenir. */
  bestPerStudent: true,
};
