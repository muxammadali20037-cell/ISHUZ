-- ISH TOPDIM · prod bazani yangilash: 0079…0079 migratsiyalari BITTA faylda (1 ta).
-- BU FAYL AVTOMATIK YARATILADI (scripts/gen-prod-pending.mjs) — qo'lda tahrirlamang.
--
-- Qanday qo'llanadi (ega):
--   1) Supabase → loyiha → Database → Backups: bugungi zaxira nusxa borligini ko'ring.
--   2) Shu faylni to'liq nusxalang (GitHub'da "Raw" → Ctrl+A → Ctrl+C).
--   3) Supabase → SQL Editor → New query → joylang → Run.
--   4) Pastda jadval chiqadi: har qatorda "bor" bo'lishi kerak. Xato chiqsa — matnini yuboring (hech narsa o'zgarmagan bo'ladi).
--
-- Xavfsizlik: hammasi bitta tranzaksiyada (xato bo'lsa to'liq bekor qilinadi). Takror ishga tushirish zarar qilmaydi:
-- allaqachon bor narsalar qayta yaratilmaydi, ma'lumot o'chirilmaydi.

begin;

-- ═══════════════ 0079_stories_channel_autopost.sql ═══════════════
-- ISH TOPDIM · 0079 · "Ish Topdim" hikoyalari (Instagram'dagidek) va Telegram kanalga avtomatik e'lon
--
-- Ega (2026-11-14): "qayerda bo'lsa ham ko'rinadigan, halal bermaydigan yangilanish — videolar, rasmlar, reklama banneri
-- sifatida; bosganda men joylagan videolar, xuddi Instagramda qanday bo'lsa — Ish Topdimning o'zi joylaydi" va
-- "har bir joylangan rezyume kanalga tashlansin; ish beruvchilar kanaliga — ishchi, ishchilarga — ish".
--
--  1) stories — admin joylaydigan rasm/video hikoyalar. Ochiq o'qiladi: faqat yoqilgan va muddati ichidagilar.
--     Yozish — settings.manage huquqli admin (o'z sessiyasi bilan, RLS). Rasm — site-media/stories/v-<sha256>.webp
--     (server qayta kodlaydi, 0060 bucket'i); video — story-videos/v/<uuid>.<mp4|webm|mov> (admin brauzeri bir martalik
--     imzolangan havola bilan to'g'ridan-to'g'ri yuklaydi; mijoz yozish siyosati YO'Q). Muqova — site-media/stories/….
--  2) story-videos — ommaviy bucket, 50 MB gacha, faqat video turlari.
--  3) channel_posts — kanalga yuborilgan vakansiya/ishchi e'lonlari (takror yuborilmasin; xato bo'lsa — cheklangan qayta
--     urinish). Faqat server (service role) yozadi; admin o'qiydi.
--
-- Faqat qo'shimcha: mavjud jadval/ma'lumotga tegilmaydi. Takror ishga tushirish xavfsiz.
-- Rollback: drop table public.channel_posts; drop table public.stories; story-videos bucket'ini Storage'dan o'chirish.

-- ---------------------------------------------------------------------------------------------------
-- 1. Hikoyalar
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 40),
  caption text check (caption is null or char_length(caption) <= 300),
  media_kind text not null check (media_kind in ('image', 'video')),
  media_path text not null check (
    media_path ~ '^site-media/stories/v-[0-9a-f]{64}\.webp$'
    or media_path ~ '^story-videos/v/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|mov)$'
  ),
  poster_path text check (poster_path is null or poster_path ~ '^site-media/stories/v-[0-9a-f]{64}\.webp$'),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 30),
  -- faqat sayt ichidagi yo'l (/…) yoki https havola; javascript:/data: va boshqalar yo'q
  cta_url text check (cta_url is null or (char_length(cta_url) <= 500 and (cta_url ~ '^/[^/\\]' or cta_url = '/' or cta_url ~ '^https://[^\s]+$'))),
  audience text not null default 'all' check (audience in ('all', 'seeker', 'employer')),
  duration_sec smallint not null default 7 check (duration_sec between 3 and 30),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stories_period check (ends_at is null or ends_at > starts_at),
  constraint stories_cta_pair check ((cta_label is null) = (cta_url is null))
);

create index if not exists stories_live_idx on public.stories (sort_order, created_at desc) where is_active;

drop trigger if exists trg_stories_updated_at on public.stories;
create trigger trg_stories_updated_at before update on public.stories
  for each row execute function public.set_updated_at();

alter table public.stories enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stories' and policyname = 'stories_public_read') then
    create policy "stories_public_read" on public.stories for select
      using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stories' and policyname = 'stories_admin') then
    create policy "stories_admin" on public.stories for all
      using (public.has_admin_permission('settings.manage'))
      with check (public.has_admin_permission('settings.manage'));
  end if;
end $$;

grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 2. Hikoya videolari (ommaviy o'qish; yozish — faqat server bergan imzolangan havola)
-- ---------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-videos', 'story-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 3. Telegram kanalga avtomatik e'lonlar
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.channel_posts (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('vacancy', 'worker')),
  entity_id uuid not null,
  chat_id text not null check (char_length(chat_id) between 2 and 100),
  status text not null default 'claimed' check (status in ('claimed', 'posted', 'failed')),
  message_id bigint,
  attempts smallint not null default 0,
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (entity_type, entity_id, chat_id)
);

create index if not exists channel_posts_recent_idx on public.channel_posts (created_at desc);

alter table public.channel_posts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_posts' and policyname = 'channel_posts_admin_read') then
    create policy "channel_posts_admin_read" on public.channel_posts for select
      using (public.has_admin_permission('notifications.broadcast'));
  end if;
end $$;

grant select on public.channel_posts to authenticated;

commit;

-- Natija: har migratsiya bo'yicha holat (hammasi "bor" bo'lishi kerak)
select m.migration, m.tekshiruv,
       case when m.bor then 'bor' else 'YO''Q' end as holat
from (values
  ('0068', 'search_vacancies_v2 funksiyasi',          to_regprocedure('public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)') is not null),
  ('0069', 'vacancy_public_stub funksiyasi',          to_regprocedure('public.vacancy_public_stub(text)') is not null),
  ('0070', 'search_vacancies_v3 funksiyasi',          exists (select 1 from pg_proc where proname = 'search_vacancies_v3' and pronamespace = 'public'::regnamespace)),
  ('0071', 'public_companies funksiyasi',             exists (select 1 from pg_proc where proname = 'public_companies' and pronamespace = 'public'::regnamespace)),
  ('0072', 'find_duplicate_vacancy funksiyasi',       exists (select 1 from pg_proc where proname = 'find_duplicate_vacancy' and pronamespace = 'public'::regnamespace)),
  ('0073', 'profile_interests jadvali',               to_regclass('public.profile_interests') is not null),
  ('0074', 'contact_reveals jadvali',                 to_regclass('public.contact_reveals') is not null),
  ('0075', 'telegram_updates.attempts ustuni',        exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'telegram_updates' and column_name = 'attempts')),
  ('0076', 'master_listings jadvali (Universal ustalar)', to_regclass('public.master_listings') is not null),
  ('0077', 'demo_vacancies jadvali (namuna vakansiyalar)', to_regclass('public.demo_vacancies') is not null),
  ('0078', 'massaj/spa kasblari katalogdan olingan',  not exists (select 1 from public.profession_nodes where is_active and (name_ru ~* 'массаж' or name_uz ~* 'massaj'))),
  ('0079', 'stories va channel_posts jadvallari (hikoyalar, kanalga avtomatik e''lon)', to_regclass('public.stories') is not null and to_regclass('public.channel_posts') is not null)
) as m(migration, tekshiruv, bor)
order by m.migration;
