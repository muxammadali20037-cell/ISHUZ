-- ISH TOPDIM · prod bazani yangilash: 0087…0088 migratsiyalari BITTA faylda (2 ta).
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

-- ═══════════════ 0087_listing_images.sql ═══════════════
-- ISH TOPDIM · 0087 · E'lon rasmi (AI)
--
-- Ega (2026-11-20): "e'lon berayotganda oxirida so'rasin — e'lon rasmi yaratilsinmi? Ha bo'lsa, e'lonni avtomatik o'qib,
-- e'longa mos real rasm joylashi kerak; kanalda ham, ilovada ham ixcham ko'rinsin" (provayder — OpenAI, ega tanlovi).
--
--  · listing_images — har e'longa (vakansiya yoki ishchi e'loni) bitta rasm: holat (pending → ready | failed), saqlangan
--    joyi va ochiq manzili. Yozish faqat server (service role) orqali; o'qish — tayyor rasmlar hammaga (rasm baribir ochiq
--    bucket'da), egasi o'z yozuvlarini (holatini) ko'radi.
--  · listing-images — ochiq bucket (5 MB, jpeg/png/webp).
--  · claim_listing_image — navbat va xarajat nazorati (faqat service role): bir vaqtda bitta generatsiya, bir e'longa ko'pi
--    bilan 3 urinish, bir kishiga sutkada N ta (listing_images_user_daily, standart 5), umumiy sutkalik chegara
--    (listing_images_daily_limit, standart 100). Natija matni: ok | busy | too_many | user_limit | daily_limit.
-- Hech narsa o'chirilmaydi; takror ishga tushirish xavfsiz.

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('vacancy', 'worker')),
  entity_id uuid not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  image_url text,
  storage_path text,
  prompt text,
  model text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity, entity_id)
);
create index if not exists listing_images_owner_idx on public.listing_images (owner_profile_id, updated_at desc);

alter table public.listing_images enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_images' and policyname = 'listing_images_read_ready') then
    create policy "listing_images_read_ready" on public.listing_images for select using (status = 'ready');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_images' and policyname = 'listing_images_read_own') then
    create policy "listing_images_read_own" on public.listing_images for select to authenticated using (owner_profile_id = auth.uid());
  end if;
end $$;
revoke insert, update, delete on public.listing_images from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

insert into public.app_settings (key, value, is_public) values
  ('listing_images_daily_limit', '100'::jsonb, false),
  ('listing_images_user_daily', '5'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.claim_listing_image(p_entity text, p_entity_id uuid, p_owner uuid, p_prompt text, p_model text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.listing_images;
begin
  if p_entity not in ('vacancy', 'worker') then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('listing_images:' || p_entity || ':' || p_entity_id::text));
  select * into r from public.listing_images where entity = p_entity and entity_id = p_entity_id;
  if r.id is not null and r.status = 'pending' and r.updated_at > now() - interval '5 minutes' then return 'busy'; end if;
  if r.id is not null and r.attempts >= 3 then return 'too_many'; end if;
  -- xarajat: avval shaxsiy, keyin umumiy sutkalik chegara (har biri hisoblagichni oshiradi)
  if not public.check_rate_limit('listing_images:user:' || p_owner::text, public.setting_int('listing_images_user_daily', 5), 86400) then return 'user_limit'; end if;
  if not public.check_rate_limit('listing_images:day', public.setting_int('listing_images_daily_limit', 100), 86400) then return 'daily_limit'; end if;
  insert into public.listing_images (entity, entity_id, owner_profile_id, status, prompt, model, attempts, updated_at)
  values (p_entity, p_entity_id, p_owner, 'pending', p_prompt, p_model, 1, now())
  on conflict (entity, entity_id) do update set status = 'pending', owner_profile_id = excluded.owner_profile_id, prompt = excluded.prompt,
    model = excluded.model, attempts = public.listing_images.attempts + 1, last_error = null, updated_at = now();
  return 'ok';
end $$;
revoke execute on function public.claim_listing_image(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_listing_image(text, uuid, uuid, text, text) to service_role;

-- ═══════════════ 0088_contact_unlocks.sql ═══════════════
-- ISH TOPDIM · 0088 · Ishchi raqamini ochish (master prompt, 4-bosqich)
--
-- Ega (2026-11-22): ish beruvchi ishchining raqamini 5 000 so'mga ochadi (narx — admin sozlamasida). Bir marta to'lanadi:
-- raqam va chat shu juftlik uchun doim ochiq qoladi; ochishlar soni cheklanmaydi; to'lov — hamyondan (balans yetsa) yoki
-- Payme/Click. Payme/Click kalitlari ulanmaguncha pullik rejim O'CHIQ: raqam avvalgidek bepul (shaxsiy limit bilan), lekin
-- kirgan foydalanuvchi raqamni ochganda juftlik yoziladi — chat ham ochiladi. Ish izlovchi uchun hammasi bepul
-- (vakansiyadagi raqamlar o'zgarmaydi).
-- Raqami ko'rinmaydigan ishchi e'loni (e'londa raqam yo'q va hisob raqami "hamma"ga ochiq emas) qidiruvdan yashiriladi;
-- egasi raqam qo'shishi bilan qaytadan chiqadi.
--
--  1) payment_purpose: 'contact_unlock'. Yangi qiymat shu faylda faqat matn sifatida solishtiriladi (purpose::text) —
--     pending.sql bitta tranzaksiyada ishlaganda ham xavfsiz.
--  2) Sozlamalar: contact_unlock_paid (false — pullik rejim o'chiq), price_contact_unlock (5000), worker_phone_required (true).
--  3) contact_unlocks — kim kimning raqamini ochgan (juftlik), qaysi e'londan, to'lov va summa (bepul rejimda 0).
--  4) unlock_worker_contact(e'lon) — raqamni ochish; contact_unlock_quote(e'lon) — to'lov oynasi uchun.
--  5) create_payment / apply_payment_internal / billing_guard_payment / wallet_enabled — yangi turni qo'llaydi.
--  6) simple_worker_listing(id, p_phone default true): p_phone = false — raqam faqat egasi, admin va ochgan uchun (yangi ilova);
--     true — avvalgi yo'l (eski ilova nusxasi ishlab turadi). Pullik rejimda ikkalasida ham faqat ochganga. Oxirida `unlocked`.
--     listing_phones_public / can_view_phone / my_saved_workers — pullik rejimda ishchi raqami faqat ochganga.
--  7) Chat: conversations.unlock_viewer / unlock_target — ochilgan juftlik suhbati; open_contact_chat(suhbatdosh);
--     my_conversations — shunday suhbat sarlavhasi (ishchi kasbi).
--  8) Raqamsiz ishchi e'loni: trg_worker_b_phone_gate (ommaga faqat ochiq raqam bilan), raqam qo'shilsa — qayta joylash;
--     my_listing_state → 'phone_required'; my_listings_without_phone() — egasiga eslatma. Hozir ochiq turgan raqamsiz
--     e'lonlar yashiriladi (publish_requested = true — raqam qo'shilishi bilan qaytadi).
--
-- Ma'lumot o'chirilmaydi. Takror ishga tushirish xavfsiz.
-- Rollback: supabase/rollbacks/0088_contact_unlocks.down.sql

-- ---------------------------------------------------------------------------------------------------
-- 1. To'lov turi
-- ---------------------------------------------------------------------------------------------------
alter type public.payment_purpose add value if not exists 'contact_unlock';

-- ---------------------------------------------------------------------------------------------------
-- 2. Sozlamalar
-- ---------------------------------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public) values
  ('contact_unlock_paid', 'false'::jsonb, true),
  ('price_contact_unlock', '5000'::jsonb, true),
  ('worker_phone_required', 'true'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.contact_unlock_paid()
returns boolean language sql stable security definer set search_path = public as $$
  select public.setting_bool('contact_unlock_paid', false);
$$;

create or replace function public.contact_unlock_price()
returns int language sql stable security definer set search_path = public as $$
  select greatest(100, least(10000000, public.setting_int('price_contact_unlock', 5000)));
$$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Ochilgan juftliklar
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.contact_unlocks (
  viewer_profile_id  uuid not null references public.profiles(id) on delete cascade,
  target_profile_id  uuid not null references public.profiles(id) on delete cascade,
  worker_id          uuid references public.worker_profiles(id) on delete set null,
  payment_id         uuid references public.payments(id) on delete set null,
  amount             bigint not null default 0 check (amount >= 0),
  created_at         timestamptz not null default now(),
  primary key (viewer_profile_id, target_profile_id),
  constraint contact_unlocks_not_self check (viewer_profile_id <> target_profile_id)
);
create index if not exists contact_unlocks_target_idx on public.contact_unlocks (target_profile_id);

alter table public.contact_unlocks enable row level security;
revoke all on public.contact_unlocks from public, anon, authenticated;
grant select on public.contact_unlocks to authenticated;
grant all on public.contact_unlocks to service_role;
drop policy if exists contact_unlocks_own on public.contact_unlocks;
create policy contact_unlocks_own on public.contact_unlocks for select to authenticated
  using (viewer_profile_id = (select auth.uid()) or target_profile_id = (select auth.uid()) or public.has_admin_permission('users.contacts'));

create or replace function public.has_contact_unlock(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contact_unlocks u where u.viewer_profile_id = p_viewer and u.target_profile_id = p_target);
$$;

-- ---------------------------------------------------------------------------------------------------
-- 4. E'londagi ochiq raqam, raqamni ochish va narx
-- ---------------------------------------------------------------------------------------------------
-- e'londagi raqam (0081, egasi e'lon uchun bergan) yoki hisob raqami — faqat ko'rinishi "hamma" bo'lsa
create or replace function public.worker_visible_phone(p_worker_id uuid)
returns table (phone text, phone2 text)
language sql stable security definer set search_path = public as $$
  select x.phone, x.phone2 from (
    select coalesce(lp.phone, case when pc.phone_visibility = 'everyone' then pc.phone end) as phone,
           case when lp.phone is not null then lp.phone2 end as phone2
      from public.worker_profiles w
      left join public.worker_listing_phones lp on lp.worker_id = w.id
      left join public.profile_contacts pc on pc.profile_id = w.profile_id
     where w.id = p_worker_id
  ) x
  where x.phone is not null;
$$;

create or replace function public.worker_has_visible_phone(p_worker_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.worker_listing_phones lp where lp.worker_id = p_worker_id)
      or exists (select 1 from public.profile_contacts pc
                  where pc.profile_id = p_profile_id and pc.phone is not null and pc.phone_visibility = 'everyone');
$$;

-- Raqamni ochish (kirgan foydalanuvchi). Natija:
--   {status: 'shown', phone, phone2, unlocked}  — egasi / admin / allaqachon ochgan / bepul rejimda ochildi (juftlik yoziladi)
--   {status: 'payment_required', price}         — pullik rejim, hali ochilmagan
--   {status: 'limit'}                           — bepul rejimda shaxsiy limit (0074: soatiga 40, sutkasiga 150)
--   {status: 'none'}                            — e'lon yo'q / yopiq / ochiq raqam yo'q
create or replace function public.unlock_worker_contact(p_worker_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  w public.worker_profiles;
  v_phone text;
  v_phone2 text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select x.* into w from public.worker_profiles x join public.profiles pf on pf.id = x.profile_id
   where x.id = p_worker_id and x.onboarding_completed_at is not null
     and (x.profile_id = me or (x.is_public and not pf.is_blocked and x.status <> 'not_looking'));
  if w.id is null then return jsonb_build_object('status', 'none'); end if;

  if w.profile_id = me or public.has_admin_permission('users.contacts') then
    select coalesce(lp.phone, pc.phone), lp.phone2 into v_phone, v_phone2
      from public.worker_profiles x
      left join public.worker_listing_phones lp on lp.worker_id = x.id
      left join public.profile_contacts pc on pc.profile_id = x.profile_id
     where x.id = w.id;
    if v_phone is null then return jsonb_build_object('status', 'none'); end if;
    return jsonb_build_object('status', 'shown', 'phone', v_phone, 'phone2', v_phone2, 'unlocked', w.profile_id <> me);
  end if;

  select vp.phone, vp.phone2 into v_phone, v_phone2 from public.worker_visible_phone(w.id) vp;
  if v_phone is null then return jsonb_build_object('status', 'none'); end if;

  if public.has_contact_unlock(me, w.profile_id) then
    return jsonb_build_object('status', 'shown', 'phone', v_phone, 'phone2', v_phone2, 'unlocked', true);
  end if;
  if public.is_blocked(me) then return jsonb_build_object('status', 'none'); end if;

  if public.contact_unlock_paid() then
    return jsonb_build_object('status', 'payment_required', 'price', public.contact_unlock_price());
  end if;

  -- bepul rejim: avvalgi shaxsiy limit, keyin juftlik yoziladi (chat ochiladi)
  if not public.contact_reveal_allowed('worker', w.id, w.profile_id) then
    return jsonb_build_object('status', 'limit');
  end if;
  insert into public.contact_unlocks (viewer_profile_id, target_profile_id, worker_id, amount)
  values (me, w.profile_id, w.id, 0)
  on conflict (viewer_profile_id, target_profile_id) do nothing;
  return jsonb_build_object('status', 'shown', 'phone', v_phone, 'phone2', v_phone2, 'unlocked', true);
end $$;

-- To'lov oynasi: holat va narx (o'zgartirmaydi)
create or replace function public.contact_unlock_quote(p_worker_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select x.profile_id into owner from public.worker_profiles x join public.profiles pf on pf.id = x.profile_id
   where x.id = p_worker_id and x.onboarding_completed_at is not null and x.is_public and not pf.is_blocked and x.status <> 'not_looking';
  return jsonb_build_object(
    'mode', case
      when owner is null or not exists (select 1 from public.worker_visible_phone(p_worker_id)) then 'none'
      when owner = me then 'owner'
      when public.has_contact_unlock(me, owner) then 'unlocked'
      when not public.contact_unlock_paid() then 'free'
      else 'payment_required' end,
    'price', public.contact_unlock_price(),
    'full_price', public.contact_unlock_price());
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. To'lov: yaratish, tasdiqlanganda ochish, ruxsat
-- ---------------------------------------------------------------------------------------------------
-- kutilayotgan to'lovda obyekt majburiy (0063): raqam ochish — ishchi e'loni
alter table public.payments drop constraint if exists payments_target;
alter table public.payments add constraint payments_target check (
  status <> 'pending'
  or (purpose = 'vacancy_publish' and vacancy_id is not null)
  or (purpose::text in ('worker_promotion', 'worker_listing', 'contact_unlock') and worker_id is not null)
  or purpose in ('ai_alerts', 'wallet_topup'));

create or replace function public.create_payment(p_purpose public.payment_purpose, p_target_id uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  amt bigint;
  p public.payments;
  tgt uuid;
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
  elsif p_purpose::text = 'contact_unlock' then
    -- 0088: ishchi raqamini ochish — faqat pullik rejimda, ochiq raqamli faol e'lon, o'ziniki emas, hali ochilmagan
    if not public.contact_unlock_paid() then raise exception 'billing_disabled' using errcode = 'P0001'; end if;
    select x.profile_id into tgt from public.worker_profiles x join public.profiles pf on pf.id = x.profile_id
     where x.id = p_target_id and x.onboarding_completed_at is not null and x.is_public and not pf.is_blocked and x.status <> 'not_looking';
    if tgt is null or not exists (select 1 from public.worker_visible_phone(p_target_id)) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if tgt = me then raise exception 'forbidden' using errcode = '42501'; end if;
    if public.has_contact_unlock(me, tgt) then raise exception 'already_paid' using errcode = 'P0001'; end if;
    amt := public.contact_unlock_price();
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  else
    raise exception 'validation' using errcode = 'P0001';
  end if;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount, 'plan', p.plan);
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
  tgt uuid;
  prev public.contact_unlocks;
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
  elsif p.purpose::text = 'contact_unlock' and p.worker_id is not null and p.profile_id is not null then
    -- 0088: raqam ochildi — juftlik yoziladi (raqam va chat doim ochiq)
    select profile_id into tgt from public.worker_profiles where id = p.worker_id;
    if tgt is null or tgt = p.profile_id then return; end if;
    select * into prev from public.contact_unlocks where viewer_profile_id = p.profile_id and target_profile_id = tgt;
    if prev.viewer_profile_id is null then
      insert into public.contact_unlocks (viewer_profile_id, target_profile_id, worker_id, payment_id, amount)
      values (p.profile_id, tgt, p.worker_id, p.id, p.amount)
      on conflict (viewer_profile_id, target_profile_id) do nothing;
    elsif prev.payment_id is distinct from p.id then
      -- allaqachon ochilgan (ikkinchi to'lov yoki bepul davrda ochilgan) — pul hamyonga qaytadi, bir marta
      if exists (select 1 from public.wallet_ledger where payment_id = p.id and kind = 'adjust') then return; end if;
      insert into public.wallets (profile_id, balance) values (p.profile_id, p.amount)
      on conflict (profile_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now();
      insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (p.profile_id, p.amount, 'adjust', p.id);
      return;
    else
      return; -- shu to'lov allaqachon qo'llangan
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/listing/' || p.worker_id);
  end if;
end $$;

create or replace function public.wallet_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select public.listings_paid() or public.ai_alerts_paid() or public.billing_enabled() or public.tariffs_enabled()
      or public.contact_unlock_paid();
$$;

create or replace function public.billing_guard_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.purpose <> 'ai_alerts'
     and not (public.listings_paid() and new.purpose in ('vacancy_publish', 'worker_listing'))
     and not (new.plan in ('boost', 'max') and new.purpose in ('vacancy_publish', 'worker_listing') and public.tariffs_enabled())
     and not (new.purpose = 'wallet_topup' and public.wallet_enabled())
     and not (new.purpose::text = 'contact_unlock' and public.contact_unlock_paid())
     and not public.billing_enabled()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. Raqam ko'rsatish yo'llari: pullik rejimda ishchi raqami faqat ochganga
-- ---------------------------------------------------------------------------------------------------
drop function if exists public.simple_worker_listing(uuid);
drop function if exists public.simple_worker_listing(uuid, boolean);
create function public.simple_worker_listing(p_id uuid, p_phone boolean default true)
 returns table(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, remote_ok boolean, experience_level experience_level, salary_expected integer, schedules work_schedule[], phone text, is_owner boolean, is_listed boolean, last_active_at timestamp with time zone, phone2 text, unlocked boolean)
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
    case
      -- egasi va admin — o'z/e'lon raqami
      when w.profile_id = auth.uid() or public.has_admin_permission('users.contacts') then coalesce(lp.phone, pc.phone)
      -- 0088: raqamni ochgan — e'londagi ochiq raqam
      when u.viewer_profile_id is not null then coalesce(lp.phone, case when pc.phone_visibility = 'everyone' then pc.phone end)
      -- avvalgi yo'l (eski ilova; faqat bepul rejimda): rozilik bo'yicha va 0074 limiti bilan
      when p_phone and not public.contact_unlock_paid() and coalesce(lp.phone, pc.phone) is not null
        and (lp.phone is not null or pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id))
        and public.contact_reveal_allowed('worker', w.id, w.profile_id)
      then coalesce(lp.phone, pc.phone)
    end,
    w.profile_id = auth.uid(),
    (w.is_public and w.status <> 'not_looking'),
    w.last_active_at,
    case
      when lp.phone2 is null then null
      when w.profile_id = auth.uid() or public.has_admin_permission('users.contacts') or u.viewer_profile_id is not null then lp.phone2
      -- shu e'lonning raqami 24 soat ichida ochilgan bo'lsa, qayta tekshiruv limitni sarflamaydi (0074)
      when p_phone and not public.contact_unlock_paid() and public.contact_reveal_allowed('worker', w.id, w.profile_id) then lp.phone2
    end,
    u.viewer_profile_id is not null
  from public.worker_profiles w
  join public.profiles pf on pf.id = w.profile_id
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_listing_phones lp on lp.worker_id = w.id
  left join public.contact_unlocks u on u.viewer_profile_id = auth.uid() and u.target_profile_id = w.profile_id
  left join public.worker_preferences pr on pr.worker_id = w.id
  left join public.profession_nodes pn on pn.id = w.profession_node_id
  left join public.categories cat on cat.id = w.category_id
  left join public.regions rg on rg.id = w.region_id
  left join public.districts d on d.id = w.district_id
  where w.id = p_id
    and w.onboarding_completed_at is not null
    and (w.profile_id = auth.uid() or (w.is_public and not pf.is_blocked and w.status <> 'not_looking'));
$function$;
grant execute on function public.simple_worker_listing(uuid, boolean) to anon, authenticated, service_role;

-- mehmon (0084): pullik rejimda ishchi raqami berilmaydi (vakansiya — avvalgidek)
create or replace function public.listing_phones_public(p_kind text, p_id uuid)
returns table (phone text, phone2 text)
language sql stable security definer set search_path = public as $$
  select x.phone, x.phone2 from (
    select case
             when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
             else coalesce(co.phone, ep.contact_phone)
           end as phone,
           null::text as phone2
      from public.vacancies v
      left join public.profiles op on op.id = v.owner_profile_id
      left join public.vacancy_contacts vc on vc.vacancy_id = v.id
      left join public.companies co on co.id = v.company_id
      left join public.employer_profiles ep on ep.profile_id = v.owner_profile_id
     where p_kind = 'vacancy' and v.id = p_id and v.status = 'active' and coalesce(op.is_blocked, false) = false
    union all
    select coalesce(lp.phone, case when pc.phone_visibility = 'everyone' then pc.phone end),
           lp.phone2
      from public.worker_profiles w
      join public.profiles pf on pf.id = w.profile_id
      left join public.worker_listing_phones lp on lp.worker_id = w.id
      left join public.profile_contacts pc on pc.profile_id = w.profile_id
     where p_kind = 'worker' and w.id = p_id and not public.contact_unlock_paid()
       and w.is_public and w.status <> 'not_looking' and w.onboarding_completed_at is not null and not pf.is_blocked
  ) x
  where x.phone is not null;
$$;

-- hisob raqami (get_contact va boshqalar): pullik rejimda ish izlovchi bo'lgan egasining raqami — faqat ochganga va rozilik
-- ("hamma") bilan; ish beruvchi raqami (ish izlovchi uchun) — avvalgidek. Aniq yamoq (0086 holati saqlanadi).
do $patch$
declare
  def text := replace(pg_get_functiondef('public.can_view_phone(uuid)'::regprocedure), E'\r', '');
  old_s text := replace($o$  if vis is null or vis = 'nobody' then return false; end if;
$o$, E'\r', '');
  new_s text := replace($n$  if vis is null or vis = 'nobody' then return false; end if;
  -- 0088: pullik rejimda ishchining raqami — faqat ochgan ko'radi
  if public.contact_unlock_paid()
     and exists (select 1 from public.worker_profiles where profile_id = p_owner)
     and not exists (select 1 from public.employer_profiles where profile_id = p_owner) then
    return vis = 'everyone' and public.has_contact_unlock(viewer, p_owner);
  end if;
$n$, E'\r', '');
  n int;
begin
  if position('contact_unlock_paid' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, old_s, ''))) / length(old_s);
  if n <> 1 then raise exception '0088: can_view_phone naqsh % marta uchradi (1 kutilgan)', n; end if;
  execute replace(def, old_s, new_s);
end $patch$;

-- saqlangan ishchilar (0061): raqam endi faqat can_view_phone orqali (bepul rejimda "hamma" — avvalgidek ko'rinadi,
-- pullik rejimda — faqat ochganga). Aniq yamoq.
do $patch$
declare
  def text := replace(pg_get_functiondef('public.my_saved_workers(integer)'::regprocedure), E'\r', '');
  old_s text := $o$case when pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id) then pc.phone end$o$;
  new_s text := $n$case when public.can_view_phone(w.profile_id) then pc.phone end$n$;
  n int;
begin
  n := (length(def) - length(replace(def, old_s, ''))) / length(old_s);
  if n = 0 and position(new_s in def) > 0 then
    return; -- allaqachon yamalgan
  end if;
  if n <> 1 then raise exception '0088: my_saved_workers naqsh % marta uchradi (1 kutilgan)', n; end if;
  execute replace(def, old_s, new_s);
end $patch$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Chat: faqat raqami ochilgan juftlik
-- ---------------------------------------------------------------------------------------------------
alter table public.conversations add column if not exists unlock_viewer uuid;
alter table public.conversations add column if not exists unlock_target uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_unlock_fkey') then
    alter table public.conversations add constraint conversations_unlock_fkey foreign key (unlock_viewer, unlock_target)
      references public.contact_unlocks (viewer_profile_id, target_profile_id) on delete cascade;
  end if;
end $$;
create unique index if not exists conversations_unlock_pair_idx on public.conversations (unlock_viewer, unlock_target)
  where unlock_viewer is not null;
alter table public.conversations drop constraint if exists conversations_source_check;
alter table public.conversations add constraint conversations_source_check check (
  num_nonnulls(application_id, job_offer_id, unlock_viewer) = 1 and (unlock_viewer is null) = (unlock_target is null));

-- Suhbatni ochish: raqam ochilgan juftlik (qaysi tomondan bo'lsa ham) — topiladi yoki yaratiladi
create or replace function public.open_contact_chat(p_other uuid)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  u public.contact_unlocks;
  cid uuid;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_other is null or p_other = me then raise exception 'validation' using errcode = 'P0001'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  select * into u from public.contact_unlocks
   where (viewer_profile_id = me and target_profile_id = p_other) or (viewer_profile_id = p_other and target_profile_id = me)
   order by (viewer_profile_id = me) desc
   limit 1;
  if u.viewer_profile_id is null then raise exception 'chat_requires_unlock' using errcode = '42501'; end if;

  select id into cid from public.conversations where unlock_viewer = u.viewer_profile_id and unlock_target = u.target_profile_id;
  if cid is null then
    insert into public.conversations (unlock_viewer, unlock_target) values (u.viewer_profile_id, u.target_profile_id)
    on conflict (unlock_viewer, unlock_target) where unlock_viewer is not null do nothing
    returning id into cid;
    if cid is null then
      select id into cid from public.conversations where unlock_viewer = u.viewer_profile_id and unlock_target = u.target_profile_id;
    end if;
  end if;
  insert into public.conversation_members (conversation_id, profile_id)
  values (cid, u.viewer_profile_id), (cid, u.target_profile_id)
  on conflict do nothing;
  return cid;
end $$;

create or replace function public.my_conversations()
returns table (
  id uuid, application_id uuid, job_offer_id uuid, last_message_at timestamptz, last_message_preview text,
  unread_count bigint, other_profile_id uuid, other_name text, other_avatar_url text, context_title text, company_name text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.application_id, c.job_offer_id, c.last_message_at, c.last_message_preview,
    (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
       and m.created_at > coalesce(me.last_read_at, 'epoch'::timestamptz) and m.deleted_at is null),
    o.profile_id, trim(p.first_name || ' ' || p.last_name), p.avatar_url,
    coalesce(v.title, jo.title, upn.name_uz, uw.custom_profession, uw.headline),
    coalesce(cv.name, cjo.name)
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.profile_id = auth.uid()
  join lateral (select cm.profile_id from public.conversation_members cm where cm.conversation_id = c.id and cm.profile_id <> auth.uid() order by cm.joined_at limit 1) o on true
  join public.profiles p on p.id = o.profile_id
  left join public.applications a on a.id = c.application_id
  left join public.vacancies v on v.id = a.vacancy_id
  left join public.companies cv on cv.id = v.company_id
  left join public.job_offers jo on jo.id = c.job_offer_id
  left join public.companies cjo on cjo.id = jo.company_id
  -- 0088: raqami ochilgan juftlik suhbati — qaysi e'londan ochilgan bo'lsa, o'sha kasb
  left join public.contact_unlocks cu on cu.viewer_profile_id = c.unlock_viewer and cu.target_profile_id = c.unlock_target
  left join public.worker_profiles uw on uw.id = cu.worker_id
  left join public.profession_nodes upn on upn.id = uw.profession_node_id
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Raqamsiz ishchi e'loni ommaga chiqmaydi
-- ---------------------------------------------------------------------------------------------------
create or replace function public.trg_worker_b_phone_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_public and new.onboarding_completed_at is not null
     and public.setting_bool('worker_phone_required', true)
     and not public.worker_has_visible_phone(new.id, new.profile_id) then
    new.is_public := false;
    if new.status <> 'not_looking' then new.publish_requested := true; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_worker_b_phone_gate on public.worker_profiles;
create trigger trg_worker_b_phone_gate before insert or update on public.worker_profiles
  for each row execute function public.trg_worker_b_phone_gate();

-- e'lonni ommaga chiqarish: raqam yo'q bo'lsa — 'phone_required' (so'rov saqlanib qoladi)
create or replace function public.moderation_try_list_worker(p_worker_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare w public.worker_profiles; st text;
begin
  select * into w from public.worker_profiles where id = p_worker_id for update;
  if w.id is null then return 'not_found'; end if;
  if w.is_public then return 'listed'; end if;
  if not w.publish_requested or w.status = 'not_looking' then return 'saved'; end if;
  if public.moderation_enabled() and not (w.moderation_state = 'allowed' and w.moderated_version = w.moderation_version) then
    return case w.moderation_state when 'rejected' then 'rejected' when 'review' then 'review' else 'moderation_pending' end;
  end if;
  if public.setting_bool('worker_phone_required', true) and not public.worker_has_visible_phone(w.id, w.profile_id) then
    return 'phone_required';
  end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  begin
    update public.worker_profiles set is_public = true where id = p_worker_id;
    st := 'listed';
  exception when raise_exception then
    perform set_config('ishuz.moderation_internal', '', true);
    if sqlerrm <> 'listing_payment_required' then raise; end if;
    st := 'payment_required';
  end;
  perform set_config('ishuz.moderation_internal', '', true);
  if st = 'listed' then
    begin
      perform public.refresh_matches_for_worker(p_worker_id);
    exception when others then null;
    end;
  end if;
  return st;
end $$;

-- raqam qo'shildi (e'lon raqami yoki hisob raqami "hamma"ga ochildi) — kutayotgan e'lonlar qaytadan chiqadi
create or replace function public.relist_worker_phone_ready(p_profile_id uuid, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select w.id from public.worker_profiles w
     where (w.id = p_worker_id or (p_worker_id is null and w.profile_id = p_profile_id))
       and not w.is_public and w.publish_requested and w.status <> 'not_looking' and w.onboarding_completed_at is not null
  loop
    perform public.moderation_try_list_worker(r.id);
  end loop;
end $$;

create or replace function public.trg_listing_phone_relist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.relist_worker_phone_ready(null, new.worker_id);
  return null;
end $$;
drop trigger if exists trg_listing_phone_relist on public.worker_listing_phones;
create trigger trg_listing_phone_relist after insert or update of phone on public.worker_listing_phones
  for each row execute function public.trg_listing_phone_relist();

create or replace function public.trg_contact_phone_relist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null and new.phone_visibility = 'everyone'
     and (tg_op = 'INSERT' or old.phone is distinct from new.phone or old.phone_visibility is distinct from new.phone_visibility) then
    perform public.relist_worker_phone_ready(new.profile_id, null);
  end if;
  return null;
end $$;
drop trigger if exists trg_contact_phone_relist on public.profile_contacts;
create trigger trg_contact_phone_relist after insert or update of phone, phone_visibility on public.profile_contacts
  for each row execute function public.trg_contact_phone_relist();

-- egasiga: holat "raqam kerak" (0049 my_listing_state — aniq yamoq; allaqachon yamalgan bo'lsa tegmaydi)
do $patch$
declare
  def text := replace(pg_get_functiondef('public.my_listing_state(text, uuid)'::regprocedure), E'\r', '');
  old_s text := replace($o$      when w.status = 'not_looking' then 'closed'
$o$, E'\r', '');
  new_s text := replace($n$      when w.status = 'not_looking' then 'closed'
      when public.setting_bool('worker_phone_required', true) and not public.worker_has_visible_phone(w.id, w.profile_id) then 'phone_required'
$n$, E'\r', '');
  n int;
begin
  if position('phone_required' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, old_s, ''))) / length(old_s);
  if n <> 1 then raise exception '0088: my_listing_state naqsh % marta uchradi (1 kutilgan)', n; end if;
  execute replace(def, old_s, new_s);
end $patch$;

-- egasining raqamsiz e'lonlari (eslatma uchun)
create or replace function public.my_listings_without_phone()
returns table (worker_id uuid, headline text, profession_name_uz text, profession_name_ru text, profession_name_en text)
language sql stable security definer set search_path = public as $$
  select w.id, coalesce(w.custom_profession, w.headline), pn.name_uz, pn.name_ru, pn.name_en
    from public.worker_profiles w
    left join public.profession_nodes pn on pn.id = w.profession_node_id
   where w.profile_id = auth.uid() and w.onboarding_completed_at is not null and w.status <> 'not_looking'
     and public.setting_bool('worker_phone_required', true)
     and not public.worker_has_visible_phone(w.id, w.profile_id)
   order by w.is_primary desc, w.created_at;
$$;

-- hozir ochiq turgan raqamsiz e'lonlar yashiriladi (so'rov saqlanadi — raqam qo'shilishi bilan qaytadi)
do $$
begin
  if public.setting_bool('worker_phone_required', true) then
    perform set_config('ishuz.moderation_internal', '1', true);
    update public.worker_profiles w set is_public = false, publish_requested = true
     where w.is_public and w.onboarding_completed_at is not null and not public.worker_has_visible_phone(w.id, w.profile_id);
    perform set_config('ishuz.moderation_internal', '', true);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Huquqlar
-- ---------------------------------------------------------------------------------------------------
revoke execute on function public.has_contact_unlock(uuid, uuid), public.worker_visible_phone(uuid),
  public.worker_has_visible_phone(uuid, uuid), public.relist_worker_phone_ready(uuid, uuid),
  public.trg_worker_b_phone_gate(), public.trg_listing_phone_relist(), public.trg_contact_phone_relist(),
  public.moderation_try_list_worker(uuid)
  from public, anon, authenticated;
grant execute on function public.moderation_try_list_worker(uuid) to service_role;
revoke execute on function public.unlock_worker_contact(uuid), public.contact_unlock_quote(uuid), public.open_contact_chat(uuid),
  public.my_listings_without_phone()
  from public, anon;
grant execute on function public.unlock_worker_contact(uuid), public.contact_unlock_quote(uuid), public.open_contact_chat(uuid),
  public.my_listings_without_phone()
  to authenticated;
revoke execute on function public.contact_unlock_paid(), public.contact_unlock_price() from public, anon;
grant execute on function public.contact_unlock_paid(), public.contact_unlock_price() to authenticated;

comment on table public.contact_unlocks is
  'Ishchi raqami ochilgan juftliklar (0088): to''lov bilan yoki bepul rejimda. Raqam va chat shu juftlik uchun doim ochiq.';

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
  ('0081', 'e''londagi qo''lda yozilgan raqamlar (worker_listing_phones)', to_regclass('public.worker_listing_phones') is not null and position('listing_phone' in pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure)) > 0),
  ('0082', 'qidiruv: kirill/lotin (uz_fold)', to_regprocedure('public.uz_fold(text)') is not null and position('uz_fold' in pg_get_functiondef('public.simple_search_vacancies(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer)'::regprocedure)) > 0),
  ('0083', 'vakansiya raqami kanalda: rozilik vaqti (vacancy_contacts.channel_phone_at)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vacancy_contacts' and column_name = 'channel_phone_at')),
  ('0084', 'mehmonga "Raqamni ko''rsatish" (listing_phones_public)', to_regprocedure('public.listing_phones_public(text, uuid)') is not null),
  ('0085', 'Telegram orqali kodsiz kirish (telegram_web_logins)', to_regclass('public.telegram_web_logins') is not null),
  ('0086', 'bir kishida bir nechta ishchi e''loni (worker_profiles.is_primary)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'worker_profiles' and column_name = 'is_primary') and position('new_listing' in pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure)) > 0),
  ('0087', 'listing_images jadvali (e''lon rasmi, AI)', to_regclass('public.listing_images') is not null and to_regprocedure('public.claim_listing_image(text, uuid, uuid, text, text)') is not null),
  ('0088', 'contact_unlocks jadvali (ishchi raqamini ochish, chat)', to_regclass('public.contact_unlocks') is not null and to_regprocedure('public.unlock_worker_contact(uuid)') is not null and to_regprocedure('public.simple_worker_listing(uuid, boolean)') is not null)
) as m(migration, tekshiruv, bor)
order by m.migration;
