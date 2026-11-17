-- ISH TOPDIM · prod bazani yangilash: 0079…0081 migratsiyalari BITTA faylda (3 ta).
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

-- ═══════════════ 0080_tariffs.sql ═══════════════
-- ISH TOPDIM · 0080 · Tariflar: Oddiy · Tezkor · Maksimal (vakansiya va ishchi e'loni)
--
-- Ega (2026-11-14): "tariflarni mukammal tuzib chiq — tarif ko'tarilgan sari imkoniyatlar kengayib borsin; narxni baland
-- qo'yma". Har xizmat turi uchun uch daraja; yuqori daraja — uzoqroq muddat, qidiruvda TOP (birinchi o'rinlarda) va
-- ishchida — AI PRO (yangi mos ish chiqsa darhol xabar):
--
--   Vakansiya (ish beruvchi)             Ishchi e'loni (ish izlovchi)
--   Oddiy    — 10 kun                    Oddiy    — 10 kun qidiruvda
--   Tezkor   — 15 kun + 3 kun TOP        Tezkor   — 30 kun + 3 kun TOP
--   Maksimal — 30 kun + 10 kun TOP       Maksimal — 30 kun + 7 kun TOP + 30 kun AI PRO
--
-- Narxlar (so'm, past): Oddiy — mavjud sozlama (vakansiya 50 000 → 30 000, ishchi 10 000 → 5 000; admin o'zgartirgan
-- bo'lsa — tegilmaydi); Tezkor/Maksimal — app_settings.tariffs (admin o'zgartiradi): 49 000 / 99 000 va 12 000 / 19 000.
-- Hozir e'lon joylash bepul (listings_paid = false) — Oddiy daraja bepul, yuqorisi — ixtiyoriy kuchaytirish.
-- Birinchi to'lov chegirmasi (0046, listing_discount_*) hamma darajaga amal qiladi.
--
-- E'lon joylash bepul bo'lsa ham (listings_paid = false) Tezkor/Maksimal — faol e'lonni kuchaytirish sifatida sotiladi
-- (tariffs_enabled = true). Oddiy daraja va mavjud oqimlar o'zgarmaydi: eski 2 argumentli create_payment / wallet_pay
-- "Oddiy" bilan ishlaydi (eski ilova nusxasi ham buzilmaydi).
--
--  1) payments.plan ('basic' | 'boost' | 'max'), standart — 'basic'.
--  2) tariff_of(tur, daraja), tariff_price(maqsad, daraja), public_tariffs() — narx va imkoniyatlar bitta joyda.
--  3) create_payment / wallet_pay — 3 argumentli (daraja bilan); 2 argumentlisi "Oddiy"ni chaqiradi.
--  4) apply_payment_internal — daraja bo'yicha muddat, TOP (vakansiya: is_featured/featured_until; ishchi: promoted_until)
--     va AI PRO (ai_alert_subscriptions).
--  5) vacancy_publish_quote / worker_listing_quote — "tiers" (har daraja narxi, chegirma bilan) va "tariffs_enabled".
--  6) billing_guard_payment / wallet_enabled — Tezkor/Maksimal uchun to'lov va hamyon tariflar yoqilganda ham ishlaydi.
--
-- Faqat qo'shimcha va create or replace: ma'lumot o'chirilmaydi, mavjud to'lovlar "basic" bo'lib qoladi.
-- Rollback: create_payment/wallet_pay 3 argumentli versiyalarini olib tashlash; apply_payment_internal,
-- billing_guard_payment, wallet_enabled, vacancy_publish_quote, worker_listing_quote ni 0063/0046 holatiga qaytarish.

-- ---------------------------------------------------------------------------------------------------
-- 1. To'lovdagi daraja
-- ---------------------------------------------------------------------------------------------------
alter table public.payments add column if not exists plan text not null default 'basic';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_plan_check' and conrelid = 'public.payments'::regclass) then
    alter table public.payments add constraint payments_plan_check check (plan in ('basic', 'boost', 'max'));
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Sozlamalar
-- ---------------------------------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public) values
  ('tariffs', '{
     "vacancy": {"boost": {"price": 49000, "days": 15, "top_days": 3},  "max": {"price": 99000, "days": 30, "top_days": 10}},
     "worker":  {"boost": {"price": 12000, "days": 30, "top_days": 3, "ai_days": 0}, "max": {"price": 19000, "days": 30, "top_days": 7, "ai_days": 30}}
   }'::jsonb, true),
  ('tariffs_enabled', 'true'::jsonb, true)
on conflict (key) do nothing;

-- "Oddiy" narxi pasaytiriladi — faqat eski standart qiymatda bo'lsa (admin o'zi o'zgartirgan narxga tegilmaydi)
update public.app_settings set value = '30000'::jsonb where key = 'price_vacancy_publish' and value = '50000'::jsonb;
update public.app_settings set value = '5000'::jsonb where key = 'price_worker_listing' and value = '10000'::jsonb;

create or replace function public.tariffs_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'tariffs_enabled'), true);
$$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Daraja: narx (to'liq), muddat (kun), TOP (kun), AI PRO (kun) — chegaralangan qiymatlar
-- ---------------------------------------------------------------------------------------------------
create or replace function public.tariff_of(p_kind text, p_plan text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  defaults jsonb := '{
    "vacancy": {"boost": {"price": 49000, "days": 15, "top_days": 3}, "max": {"price": 99000, "days": 30, "top_days": 10}},
    "worker":  {"boost": {"price": 12000, "days": 30, "top_days": 3, "ai_days": 0}, "max": {"price": 19000, "days": 30, "top_days": 7, "ai_days": 30}}
  }'::jsonb;
  t jsonb;
  d jsonb;
  num int;
begin
  if p_kind not in ('vacancy', 'worker') or p_plan not in ('basic', 'boost', 'max') then return null; end if;
  if p_plan = 'basic' then
    return case p_kind
      when 'vacancy' then jsonb_build_object('plan', 'basic', 'price', public.setting_int('price_vacancy_publish', 30000),
        'days', public.setting_int('vacancy_lifetime_days', 10), 'top_days', 0, 'ai_days', 0)
      else jsonb_build_object('plan', 'basic', 'price', public.setting_int('price_worker_listing', 5000),
        'days', public.setting_int('listing_days', 10), 'top_days', 0, 'ai_days', 0) end;
  end if;
  d := defaults -> p_kind -> p_plan;
  select value -> p_kind -> p_plan into t from public.app_settings where key = 'tariffs';
  t := coalesce(d, '{}'::jsonb) || coalesce(case when jsonb_typeof(t) = 'object' then t end, '{}'::jsonb);
  return jsonb_build_object(
    'plan', p_plan,
    'price', least(10000000, greatest(1000, coalesce((t ->> 'price')::numeric, (d ->> 'price')::numeric)::int)),
    'days', least(90, greatest(1, coalesce((t ->> 'days')::numeric, (d ->> 'days')::numeric)::int)),
    'top_days', least(30, greatest(0, coalesce((t ->> 'top_days')::numeric, 0)::int)),
    'ai_days', case when p_kind = 'worker' then least(90, greatest(0, coalesce((t ->> 'ai_days')::numeric, 0)::int)) else 0 end);
exception when invalid_text_representation or numeric_value_out_of_range then
  -- admin noto'g'ri qiymat yozgan bo'lsa — standart
  return d || jsonb_build_object('plan', p_plan, 'ai_days', coalesce((d ->> 'ai_days')::int, 0));
end $$;

/** Joriy foydalanuvchi uchun narx (birinchi to'lov chegirmasi bilan, 100 so'mga yaxlitlangan) */
create or replace function public.tariff_price(p_purpose public.payment_purpose, p_plan text)
returns int language sql stable security definer set search_path = public as $$
  select (round(((public.tariff_of(case when p_purpose = 'vacancy_publish' then 'vacancy' else 'worker' end, p_plan) ->> 'price')::int)
    * (100 - public.listing_discount_percent(p_purpose)) / 100.0 / 100) * 100)::int;
$$;

create or replace function public.tariff_tiers(p_purpose public.payment_purpose)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_agg(t.tier || jsonb_build_object('price', public.tariff_price(p_purpose, t.plan), 'full_price', (t.tier ->> 'price')::int) order by t.ord)
  from (values (1, 'basic'), (2, 'boost'), (3, 'max')) as v(ord, plan),
       lateral (select v.ord, v.plan, public.tariff_of(case when p_purpose = 'vacancy_publish' then 'vacancy' else 'worker' end, v.plan) as tier) t;
$$;

/** Ochiq "Tariflar" sahifasi uchun: to'liq narxlar (chegirmasiz), chegirma qoidasi va joylash bepulmi */
create or replace function public.public_tariffs()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'vacancy', jsonb_build_array(public.tariff_of('vacancy', 'basic'), public.tariff_of('vacancy', 'boost'), public.tariff_of('vacancy', 'max')),
    'worker', jsonb_build_array(public.tariff_of('worker', 'basic'), public.tariff_of('worker', 'boost'), public.tariff_of('worker', 'max')),
    'listings_paid', public.listings_paid(),
    'tariffs_enabled', public.tariffs_enabled(),
    'ai_alerts_price', public.setting_int('price_ai_alerts', 15000),
    'ai_alerts_days', public.setting_int('ai_alerts_days', 30),
    'discount_percent', public.setting_int('listing_discount_percent', 0),
    'discount_until', (select value #>> '{}' from public.app_settings where key = 'listing_discount_until'));
$$;

-- ---------------------------------------------------------------------------------------------------
-- 4. To'lov yaratish (daraja bilan) va eski chaqiruv
-- ---------------------------------------------------------------------------------------------------
create or replace function public.create_payment(p_purpose public.payment_purpose, p_target_id uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  amt bigint;
  p public.payments;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_plan is null or p_plan not in ('basic', 'boost', 'max') then raise exception 'validation' using errcode = 'P0001'; end if;
  if p_plan <> 'basic' and p_purpose not in ('vacancy_publish', 'worker_listing') then raise exception 'validation' using errcode = 'P0001'; end if;
  if p_plan <> 'basic' and not public.tariffs_enabled() then raise exception 'billing_disabled' using errcode = 'P0001'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.check_rate_limit('create_payment:' || me, 20, 3600) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if p_purpose = 'vacancy_publish' then
    if not public.can_edit_vacancy(p_target_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    -- "Oddiy": muddati to'langan e'lon uchun qayta to'lov yo'q; Tezkor/Maksimal — faol e'lonni ham kuchaytiradi (muddat + TOP)
    if p_plan = 'basic' and exists (select 1 from public.vacancies where id = p_target_id and paid_until > now() + interval '1 day') then
      raise exception 'already_paid' using errcode = 'P0001';
    end if;
    amt := public.tariff_price('vacancy_publish', p_plan);
    insert into public.payments (profile_id, purpose, vacancy_id, amount, plan) values (me, p_purpose, p_target_id, amt, p_plan) returning * into p;
  elsif p_purpose = 'ai_alerts' then
    amt := public.setting_int('price_ai_alerts', 15000);
    insert into public.payments (profile_id, purpose, amount) values (me, p_purpose, amt) returning * into p;
  elsif p_purpose = 'worker_listing' then
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.tariff_price('worker_listing', p_plan);
    insert into public.payments (profile_id, purpose, worker_id, amount, plan) values (me, p_purpose, p_target_id, amt, p_plan) returning * into p;
  elsif p_purpose = 'worker_promotion' then
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.setting_int('price_worker_promotion', 20000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  else
    raise exception 'validation' using errcode = 'P0001';
  end if;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount, 'plan', p.plan);
end $$;

create or replace function public.create_payment(p_purpose public.payment_purpose, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.create_payment(p_purpose, p_target_id, 'basic');
end $$;

create or replace function public.wallet_pay(p_purpose public.payment_purpose, p_target_id uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pay jsonb;
  pid uuid;
  amt bigint;
  bal bigint;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_purpose = 'wallet_topup' then raise exception 'validation' using errcode = 'P0001'; end if;
  -- narx, huquq, "allaqachon to'langan", bloklash va chastota — oddiy to'lov bilan aynan bir xil
  pay := public.create_payment(p_purpose, p_target_id, p_plan);
  pid := (pay ->> 'id')::uuid;
  amt := (pay ->> 'amount')::bigint;
  select balance into bal from public.wallets where profile_id = me for update;
  if coalesce(bal, 0) < amt then raise exception 'insufficient_balance' using errcode = 'P0001'; end if;
  update public.wallets set balance = balance - amt, updated_at = now() where profile_id = me;
  insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (me, -amt, 'spend', pid);
  update public.payments set status = 'paid', provider = 'wallet', paid_at = now() where id = pid;
  perform public.apply_payment_internal(pid);
  return jsonb_build_object('order_no', pay -> 'order_no', 'amount', amt, 'balance', bal - amt, 'plan', p_plan);
end $$;

create or replace function public.wallet_pay(p_purpose public.payment_purpose, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.wallet_pay(p_purpose, p_target_id, 'basic');
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. To'lov tasdiqlanganda: daraja bo'yicha muddat, TOP va AI PRO
-- ---------------------------------------------------------------------------------------------------
create or replace function public.extend_worker_listing_internal(p_worker_id uuid, p_days int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare result timestamptz;
begin
  perform set_config('ishuz.listing_internal', '1', true);
  update public.worker_profiles
  set listed_until = greatest(coalesce(listed_until, now()), now()) + make_interval(days => greatest(1, p_days)),
      listing_warned_at = null,
      is_public = true,
      status = case when status = 'not_looking' then 'active' else status end
  where id = p_worker_id
  returning listed_until into result;
  perform set_config('ishuz.listing_internal', '', true);
  return result;
end $$;

create or replace function public.apply_payment_internal(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  v public.vacancies;
  tier jsonb;
  window_end timestamptz;
  bonus bigint;
  top int;
  ai int;
begin
  select * into p from public.payments where id = p_payment_id;
  if p.purpose = 'vacancy_publish' and p.vacancy_id is not null then
    select * into v from public.vacancies where id = p.vacancy_id for update;
    if v.id is null then return; end if;
    tier := public.tariff_of('vacancy', coalesce(p.plan, 'basic'));
    window_end := greatest(coalesce(v.paid_until, now()), now()) + make_interval(days => (tier ->> 'days')::int);
    if v.status in ('draft', 'paused', 'closed', 'expired', 'rejected') and v.category_id is not null and (v.region_id is not null or v.is_remote) then
      perform public.activate_vacancy_internal(v.id, window_end);
    else
      -- faol e'lon (bepul joylangan bo'lsa ham) — muddat uzayadi, hech qachon qisqarmaydi
      update public.vacancies set paid_until = window_end,
        expires_at = case when status = 'active' then greatest(coalesce(expires_at, window_end), window_end) else expires_at end
      where id = v.id;
    end if;
    top := (tier ->> 'top_days')::int;
    if top > 0 then
      update public.vacancies
         set is_featured = true,
             featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => top)
       where id = v.id;
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount, 'plan', p.plan), '/employer/vacancies/' || v.id);
  elsif p.purpose = 'worker_promotion' and p.worker_id is not null then
    perform public.extend_worker_promotion_internal(p.worker_id);
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/');
  elsif p.purpose = 'worker_listing' and p.worker_id is not null then
    tier := public.tariff_of('worker', coalesce(p.plan, 'basic'));
    perform public.extend_worker_listing_internal(p.worker_id, (tier ->> 'days')::int);
    top := (tier ->> 'top_days')::int;
    if top > 0 then
      update public.worker_profiles
         set promoted_until = greatest(coalesce(promoted_until, now()), now()) + make_interval(days => top)
       where id = p.worker_id;
    end if;
    ai := (tier ->> 'ai_days')::int;
    if ai > 0 then
      insert into public.ai_alert_subscriptions (profile_id, paid_until)
      values (p.profile_id, now() + make_interval(days => ai))
      on conflict (profile_id) do update
        set paid_until = greatest(public.ai_alert_subscriptions.paid_until, now()) + make_interval(days => ai),
            updated_at = now();
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount, 'plan', p.plan), '/profile/listing');
  elsif p.purpose = 'ai_alerts' then
    insert into public.ai_alert_subscriptions (profile_id, paid_until)
    values (p.profile_id, now() + make_interval(days => public.setting_int('ai_alerts_days', 30)))
    on conflict (profile_id) do update
      set paid_until = greatest(public.ai_alert_subscriptions.paid_until, now()) + make_interval(days => public.setting_int('ai_alerts_days', 30)),
          updated_at = now();
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/ai-alerts');
  elsif p.purpose = 'wallet_topup' then
    -- bir to'lov — bir marta (qayta chaqirilsa ham balans ikki marta oshmaydi)
    if exists (select 1 from public.wallet_ledger where payment_id = p.id and kind = 'topup') then return; end if;
    bonus := case when p.amount >= public.setting_int('wallet_bonus_min', 100000)
                  then (p.amount * greatest(0, least(50, public.setting_int('wallet_bonus_percent', 0)))) / 100 else 0 end;
    insert into public.wallets (profile_id, balance) values (p.profile_id, p.amount + bonus)
    on conflict (profile_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now();
    insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (p.profile_id, p.amount, 'topup', p.id);
    if bonus > 0 then
      insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (p.profile_id, bonus, 'bonus', p.id);
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount, 'bonus', bonus), '/billing');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. Narx so'rovlari: har daraja (chegirma bilan)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.worker_listing_quote()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare wid uuid := public.current_worker_id();
begin
  if wid is null then raise exception 'worker_profile_required' using errcode = '23514'; end if;
  return jsonb_build_object(
    'mode', case
      when not public.listings_paid() then 'free'
      when (select listed_until from public.worker_profiles where id = wid) > now() then 'paid_window'
      when public.listing_free_trial() and not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_worker_listing_used_at is not null) then 'free_trial'
      else 'payment_required' end,
    'price', public.tariff_price('worker_listing', 'basic'),
    'full_price', public.setting_int('price_worker_listing', 5000),
    'discount_percent', public.listing_discount_percent('worker_listing'),
    'discount_until', (select value #>> '{}' from public.app_settings where key = 'listing_discount_until'),
    'lifetime_days', public.setting_int('listing_days', 10),
    'listed_until', (select listed_until from public.worker_profiles where id = wid),
    'tiers', public.tariff_tiers('worker_listing'),
    'tariffs_enabled', public.tariffs_enabled());
end $$;

create or replace function public.vacancy_publish_quote(p_vacancy_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mode', public.vacancy_publish_mode(p_vacancy_id),
    'price', public.tariff_price('vacancy_publish', 'basic'),
    'full_price', public.setting_int('price_vacancy_publish', 30000),
    'discount_percent', public.listing_discount_percent('vacancy_publish'),
    'discount_until', (select value #>> '{}' from public.app_settings where key = 'listing_discount_until'),
    'lifetime_days', public.setting_int('vacancy_lifetime_days', 10),
    'free_hours', public.setting_int('vacancy_lifetime_days', 10) * 24,
    'promo_until', public.billing_promo_until(),
    'paid_until', (select paid_until from public.vacancies where id = p_vacancy_id),
    'featured_until', (select featured_until from public.vacancies where id = p_vacancy_id and is_featured),
    'tiers', public.tariff_tiers('vacancy_publish'),
    'tariffs_enabled', public.tariffs_enabled());
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. To'lov ruxsati va hamyon: Tezkor/Maksimal — tariflar yoqilgan bo'lsa (e'lon joylash bepul bo'lsa ham)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.wallet_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select public.listings_paid() or public.ai_alerts_paid() or public.billing_enabled() or public.tariffs_enabled();
$$;

create or replace function public.billing_guard_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.purpose <> 'ai_alerts'
     and not (public.listings_paid() and new.purpose in ('vacancy_publish', 'worker_listing'))
     and not (new.plan in ('boost', 'max') and new.purpose in ('vacancy_publish', 'worker_listing') and public.tariffs_enabled())
     and not (new.purpose = 'wallet_topup' and public.wallet_enabled())
     and not public.billing_enabled()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Huquqlar
-- ---------------------------------------------------------------------------------------------------
revoke execute on function public.create_payment(public.payment_purpose, uuid, text), public.wallet_pay(public.payment_purpose, uuid, text),
  public.extend_worker_listing_internal(uuid, int), public.tariff_price(public.payment_purpose, text), public.tariff_tiers(public.payment_purpose)
  from public, anon;
grant execute on function public.create_payment(public.payment_purpose, uuid, text), public.wallet_pay(public.payment_purpose, uuid, text) to authenticated;
revoke execute on function public.extend_worker_listing_internal(uuid, int) from authenticated;
grant execute on function public.tariff_price(public.payment_purpose, text), public.tariff_tiers(public.payment_purpose) to authenticated;
grant execute on function public.tariff_of(text, text), public.public_tariffs(), public.tariffs_enabled() to anon, authenticated;

-- ═══════════════ 0081_listing_phones.sql ═══════════════
-- ISH TOPDIM · 0081 · Ishchi e'lonidagi telefon raqami — oynada qo'lda yoziladi, ikkinchi raqam ham bo'lishi mumkin
--
-- Ega (2026-11-17): "telefon raqamini qo'lda kiritsin, kiritmasa e'lon berilmasin; 2 ta nomer bo'lsa — «yana nomer»;
-- nomer majburiy, profildagi nomer emas — boshqa nomer joylasin, xohlasa profildagini, lekin qo'lda yozilsin".
--
--  1) worker_listing_phones — e'londa ko'rsatiladigan raqam (majburiy) va qo'shimcha raqam (ixtiyoriy). Hisob raqami
--     (profile_contacts.phone — kirish va tasdiqlash uchun) o'zgarmaydi va e'londa ko'rsatilmaydi.
--     O'qish/yozish — faqat e'lon egasi (RLS). Boshqalar raqamni faqat e'lon sahifasida ko'radi: simple_worker_listing
--     orqali, kirgan va 0074 limiti ichida (mehmon va ro'yxatlar — telefonsiz, avvalgidek).
--  2) save_simple_worker_listing — `listing_phone` / `listing_phone2` qabul qiladi (aniq yamoq, naqsh 1 marta uchramasa —
--     migratsiya to'xtaydi; allaqachon yamalgan bo'lsa — tegmaydi):
--       · raqam yozilgan bo'lsa — hisobda tasdiqlangan raqam bo'lishi shart emas (vakansiyadagidek), e'londa shu raqam,
--         hisob raqamining ko'rinish sozlamasi o'zgarmaydi;
--       · raqamsiz saqlansa (to'liq forma, /post/worker) — e'lon avvalgidek hisob raqami va rozilik qoidasiga qaytadi.
--  3) simple_worker_listing — e'londagi raqam (bo'lsa) hisob raqami o'rniga, oxirida yangi `phone2` ustuni.
--     Qaytaradigan ustunlar o'zgargani uchun funksiya qayta yaratiladi (drop + create, bitta tranzaksiyada).
--
-- Faqat qo'shimcha: mavjud ma'lumotga tegilmaydi. Takror ishga tushirish xavfsiz.
-- Rollback: supabase/rollbacks/0081_listing_phones.down.sql

-- ---------------------------------------------------------------------------------------------------
-- 1. Jadval
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.worker_listing_phones (
  worker_id   uuid primary key references public.worker_profiles(id) on delete cascade,
  phone       text not null,
  phone2      text,
  updated_at  timestamptz not null default now(),
  constraint worker_listing_phones_phone_format check (phone ~ '^\+998[0-9]{9}$'),
  constraint worker_listing_phones_phone2_format check (phone2 is null or (phone2 ~ '^\+998[0-9]{9}$' and phone2 <> phone))
);
drop trigger if exists trg_worker_listing_phones_updated on public.worker_listing_phones;
create trigger trg_worker_listing_phones_updated before update on public.worker_listing_phones
  for each row execute function public.set_updated_at();

alter table public.worker_listing_phones enable row level security;
revoke all on public.worker_listing_phones from public, anon, authenticated;
grant select, insert, update, delete on public.worker_listing_phones to authenticated;
grant all on public.worker_listing_phones to service_role;
drop policy if exists worker_listing_phones_own on public.worker_listing_phones;
create policy worker_listing_phones_own on public.worker_listing_phones for all to authenticated
  using (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()))
  with check (not public.is_blocked(auth.uid())
              and exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()));

-- ---------------------------------------------------------------------------------------------------
-- 2. save_simple_worker_listing: e'londagi raqam(lar)
-- ---------------------------------------------------------------------------------------------------
do $patch$
declare
  def text := replace(pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure), E'\r', '');
  olds text[];
  news text[];
  n int;
begin
  if position('listing_phone' in def) > 0 then
    return; -- allaqachon yamalgan (takror ishga tushirish)
  end if;

  olds := array[
$o1$  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
$o1$,
$o2$  if not exists (select 1 from public.profile_contacts c where c.profile_id = me and c.phone is not null) then
    raise exception 'phone_required' using errcode = '23514';
  end if;
$o2$,
$o3$  update public.profile_contacts set phone_visibility = case
      when v_show_phone then 'everyone'::public.phone_visibility
      when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
      else phone_visibility end
  where profile_id = me;
$o3$];

  news := array[
$n1$  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
  v_lphone text := nullif(btrim(coalesce(p->>'listing_phone', '')), '');
  v_lphone2 text := nullif(btrim(coalesce(p->>'listing_phone2', '')), '');
$n1$,
$n2$  -- 0081: e'londagi raqam oynada qo'lda yoziladi; yozilgan bo'lsa hisobda tasdiqlangan raqam shart emas (vakansiyadagidek)
  if v_lphone is not null and v_lphone !~ '^\+998[0-9]{9}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_lphone2 is not null and (v_lphone is null or v_lphone2 !~ '^\+998[0-9]{9}$') then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_lphone2 = v_lphone then v_lphone2 := null; end if;
  if v_lphone is null and not exists (select 1 from public.profile_contacts c where c.profile_id = me and c.phone is not null) then
    raise exception 'phone_required' using errcode = '23514';
  end if;
$n2$,
$n3$  if v_lphone is not null then
    -- 0081: e'londa — qo'lda yozilgan raqam(lar); hisob raqamining ko'rinish sozlamasi o'zgarmaydi
    insert into public.worker_listing_phones (worker_id, phone, phone2) values (wid, v_lphone, v_lphone2)
    on conflict (worker_id) do update set phone = excluded.phone, phone2 = excluded.phone2;
  else
    -- raqamsiz saqlandi (to'liq forma): e'lon yana hisob raqami va rozilik qoidasiga qaytadi
    delete from public.worker_listing_phones where worker_id = wid;
    -- telefonni e'londa ko'rsatish roziligi: rozilik → hammaga; rozilik olib tashlansa → faqat ariza yuborgan ish beruvchiga
    update public.profile_contacts set phone_visibility = case
        when v_show_phone then 'everyone'::public.phone_visibility
        when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
        else phone_visibility end
    where profile_id = me;
  end if;
$n3$];

  for i in 1 .. array_length(olds, 1) loop
    n := (length(def) - length(replace(def, olds[i], ''))) / length(olds[i]);
    if n <> 1 then raise exception '0081: save_simple_worker_listing naqsh #% % marta uchradi (1 kutilgan)', i, n; end if;
    def := replace(def, olds[i], news[i]);
  end loop;
  execute def;
end $patch$;

-- ---------------------------------------------------------------------------------------------------
-- 3. simple_worker_listing: e'londagi raqam(lar)
-- ---------------------------------------------------------------------------------------------------
drop function if exists public.simple_worker_listing(uuid);
create function public.simple_worker_listing(p_id uuid)
 returns table(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, remote_ok boolean, experience_level experience_level, salary_expected integer, schedules work_schedule[], phone text, is_owner boolean, is_listed boolean, last_active_at timestamp with time zone, phone2 text)
 language sql
 volatile security definer
 set search_path to 'public'
as $function$
  select w.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, w.headline,
    w.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon), w.about,
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    w.remote_preference = 'yes', w.experience_level, pr.salary_expected, coalesce(pr.schedules, '{}'),
    -- 0081: e'londa qo'lda yozilgan raqam (egasi e'lon uchun bergan) — hisob raqami va uning ko'rinish sozlamasi o'rniga
    case when coalesce(lp.phone, pc.phone) is not null
      and (lp.phone is not null or pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id))
      and public.contact_reveal_allowed('worker', w.id, w.profile_id)
    then coalesce(lp.phone, pc.phone) end,
    w.profile_id = auth.uid(),
    (w.is_public and w.status <> 'not_looking'),
    w.last_active_at,
    -- shu e'lonning raqami 24 soat ichida ochilgan bo'lsa, qayta tekshiruv limitni sarflamaydi (0074)
    case when lp.phone2 is not null and public.contact_reveal_allowed('worker', w.id, w.profile_id) then lp.phone2 end
  from public.worker_profiles w
  join public.profiles pf on pf.id = w.profile_id
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_listing_phones lp on lp.worker_id = w.id
  left join public.worker_preferences pr on pr.worker_id = w.id
  left join public.profession_nodes pn on pn.id = w.profession_node_id
  left join public.categories cat on cat.id = w.category_id
  left join public.regions rg on rg.id = w.region_id
  left join public.districts d on d.id = w.district_id
  where w.id = p_id
    and w.onboarding_completed_at is not null
    and (w.profile_id = auth.uid() or (w.is_public and not pf.is_blocked and w.status <> 'not_looking'));
$function$;
grant execute on function public.simple_worker_listing(uuid) to anon, authenticated, service_role;

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
  ('0079', 'stories va channel_posts jadvallari (hikoyalar, kanalga avtomatik e''lon)', to_regclass('public.stories') is not null and to_regclass('public.channel_posts') is not null),
  ('0080', 'tariflar (payments.plan, public_tariffs)',  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'plan') and to_regprocedure('public.public_tariffs()') is not null),
  ('0081', 'e''londagi qo''lda yozilgan raqamlar (worker_listing_phones)', to_regclass('public.worker_listing_phones') is not null and position('listing_phone' in pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure)) > 0)
) as m(migration, tekshiruv, bor)
order by m.migration;
