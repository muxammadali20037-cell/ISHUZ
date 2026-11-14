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
