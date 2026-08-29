-- ============================================================
-- MEMBRANE RUN — SUPABASE ŞEMASI (ortak skor tablosu)
-- ============================================================
-- KULLANIM
--   1) Supabase projenizde sol menüden "SQL Editor" > "New query"
--   2) Bu dosyanın TAMAMINI yapıştırıp "Run" deyin
--   3) js/config.js içine Project URL + anon key'i yazın
-- Ayrıntılı anlatım: KURULUM.md
--
-- Bu dosyayı tekrar çalıştırmak güvenlidir (idempotent).
-- ============================================================

create table if not exists public.membrane_run_scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  student_no text,
  group_code text not null default 'genel',
  score integer not null check (score >= 0),
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  missed_count integer not null default 0,
  max_combo integer not null default 0,
  atp_spent integer not null default 0,
  accuracy integer not null default 0,
  duration_seconds integer not null default 300,
  signature text,
  created_at timestamptz not null default now()
);

-- Eski bir kurulumdan geliyorsanız eksik sütunları ekler:
alter table public.membrane_run_scores
  add column if not exists group_code text not null default 'genel';
alter table public.membrane_run_scores
  add column if not exists accuracy integer not null default 0;

create index if not exists membrane_run_scores_board_idx
  on public.membrane_run_scores (group_code, score desc, created_at);

-- ------------------------------------------------------------
-- TEMEL SAHTE SKOR KORUMASI
-- ------------------------------------------------------------
-- Oyunun kuralları gereği ulaşılabilecek EN YÜKSEK skor:
--   her doğru geçiş en fazla 30 puan
--   + her 5'lik combo +50, her 10'luk combo ek +50
-- Ayrıca 300 saniyede üretilebilecek madde sayısı sınırlıdır.
-- Bu kısıt, konsoldan gönderilen "999999" türü imkânsız skorları
-- veritabanı seviyesinde reddeder.
--
-- DÜRÜST NOT: Bu tam bir hile önleme değildir. Kararlı biri hâlâ
-- kuralların İÇİNDE kalan sahte bir skor gönderebilir. Tam koruma
-- için INSERT'i bir Edge Function üzerinden yapıp skoru sunucuda
-- yeniden hesaplamak gerekir; bu sürüm onu içermez.

alter table public.membrane_run_scores
  drop constraint if exists membrane_run_scores_plausible;

alter table public.membrane_run_scores
  add constraint membrane_run_scores_plausible check (
    correct_count >= 0
    and wrong_count >= 0
    and missed_count >= 0
    and accuracy between 0 and 100
    and duration_seconds between 1 and 3600
    -- 300 saniyede en yoğun kademede bile ~200'den fazla madde gelmez
    and correct_count <= (duration_seconds / 1.0)
    and max_combo <= correct_count
    and score <= (
      correct_count * 30
      + floor(correct_count / 5) * 50
      + floor(correct_count / 10) * 50
    )
  );

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Herkes okuyabilir, herkes YENİ satır ekleyebilir (anon key ile),
-- ama kimse mevcut satırları güncelleyemez veya silemez.
-- Öğrenciler yalnızca skor gönderir; tabloyu bozamazlar.

alter table public.membrane_run_scores enable row level security;

drop policy if exists "Herkes skorları okuyabilir" on public.membrane_run_scores;
create policy "Herkes skorları okuyabilir"
  on public.membrane_run_scores for select
  using (true);

drop policy if exists "Herkes yeni skor ekleyebilir" on public.membrane_run_scores;
create policy "Herkes yeni skor ekleyebilir"
  on public.membrane_run_scores for insert
  with check (true);

-- ------------------------------------------------------------
-- ÖĞRETMEN İÇİN KULLANIŞLI SORGULAR
-- ------------------------------------------------------------
-- Bir sınıfın tablosu (her öğrencinin en iyi skoru):
--
--   select distinct on (coalesce(nullif(student_no,''), name))
--          name, student_no, score, accuracy, created_at
--   from public.membrane_run_scores
--   where group_code = 'LVS-1A'
--   order by coalesce(nullif(student_no,''), name), score desc;
--
-- Sınıfın en çok zorlandığı noktayı görmek için ortalamalar:
--
--   select group_code,
--          count(*) as oyun_sayisi,
--          round(avg(score)) as ort_skor,
--          round(avg(accuracy)) as ort_isabet,
--          round(avg(wrong_count)) as ort_yanlis,
--          round(avg(missed_count)) as ort_kacirilan
--   from public.membrane_run_scores
--   group by group_code;
--
-- Dersten sonra tabloyu sıfırlamak (DİKKAT: geri alınamaz):
--
--   delete from public.membrane_run_scores where group_code = 'LVS-1A';
