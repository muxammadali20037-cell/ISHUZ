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
