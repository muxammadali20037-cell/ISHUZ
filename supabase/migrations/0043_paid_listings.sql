-- ISH.UZ · 0043 · E'lonlar 10 kun turadi; har bir tomon uchun 1 marta 10 kun bepul, keyingisi 20 000 so'm.
--  * Ish beruvchi: vakansiya e'loni (purpose vacancy_publish), muddat tugasa status = expired (har soat).
--  * Ish qidiruvchi: "ish qidirish e'loni" = qidiruvda ko'rinish (worker_profiles.is_public). Muddat tugasa is_public=false
--    (qidiruvdan chiqadi, ariza yuborgan ish beruvchilarga ko'rinishda qoladi); qayta yoqish — bepul (bir marta) yoki to'lov.
--  * Ko'rish, qidirish, ariza yuborish — hammaga bepul. Umumiy billing (TOP) o'chiq qoladi: o'z bayrog'i listings_paid.

insert into public.app_settings (key, value, is_public) values
  ('listings_paid', 'true'::jsonb, true),
  ('listing_days', '10'::jsonb, true),
  ('price_worker_listing', '20000'::jsonb, true)
on conflict (key) do nothing;
-- Vakansiya narxi va muddati yangi qoidaga
update public.app_settings set value = '20000'::jsonb where key = 'price_vacancy_publish';
update public.app_settings set value = '10'::jsonb where key = 'vacancy_lifetime_days';

-- To'lov yozuvi: worker_listing — ishchi profiliga bog'lanadi
alter table public.payments drop constraint if exists payments_target;
alter table public.payments add constraint payments_target check (
  (purpose = 'vacancy_publish' and vacancy_id is not null)
  or (purpose in ('worker_promotion', 'worker_listing') and worker_id is not null)
  or purpose = 'ai_alerts');

create or replace function public.listings_paid()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'listings_paid'), false);
$$;

alter table public.billing_usage add column if not exists free_worker_listing_used_at timestamptz;
alter table public.worker_profiles add column if not exists listed_until timestamptz;
alter table public.worker_profiles add column if not exists listing_warned_at timestamptz;
create index if not exists idx_worker_profiles_listed_until on public.worker_profiles (listed_until) where is_public;

-- ---------------------------------------------------------------------
-- Ish qidiruvchi e'loni: qidiruvga chiqish (is_public false→true yoki onboarding tugashi) = e'lon joylash
-- ---------------------------------------------------------------------
create or replace function public.trg_worker_listing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  internal boolean := coalesce(current_setting('ishuz.listing_internal', true), '') = '1';
  publishing boolean;
begin
  -- listed_until faqat server funksiyalari orqali o'zgaradi
  if not internal then
    if tg_op = 'INSERT' then
      new.listed_until := null;
    else
      new.listed_until := old.listed_until;
      new.listing_warned_at := old.listing_warned_at;
    end if;
  end if;

  if internal or not public.listings_paid() then
    return new;
  end if;

  publishing := new.is_public and new.onboarding_completed_at is not null and new.status <> 'not_looking'
    and (tg_op = 'INSERT' or not old.is_public or old.onboarding_completed_at is null or old.status = 'not_looking');
  if not publishing or (new.listed_until is not null and new.listed_until > now()) then
    return new;
  end if;

  -- birinchi marta — bepul 10 kun
  if not exists (select 1 from public.billing_usage u where u.profile_id = new.profile_id and u.free_worker_listing_used_at is not null) then
    insert into public.billing_usage (profile_id, free_worker_listing_used_at) values (new.profile_id, now())
    on conflict (profile_id) do update set free_worker_listing_used_at = now();
    new.listed_until := now() + make_interval(days => public.setting_int('listing_days', 10));
    new.listing_warned_at := null;
    return new;
  end if;
  raise exception 'listing_payment_required' using errcode = 'P0001';
end $$;
create or replace trigger trg_worker_listing before insert or update on public.worker_profiles
  for each row execute function public.trg_worker_listing();

-- Ichki: e'lonni uzaytirish (to'lov tasdiqlangach)
create or replace function public.extend_worker_listing_internal(p_worker_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare result timestamptz;
begin
  perform set_config('ishuz.listing_internal', '1', true);
  update public.worker_profiles
  set listed_until = greatest(coalesce(listed_until, now()), now()) + make_interval(days => public.setting_int('listing_days', 10)),
      listing_warned_at = null,
      is_public = true,
      status = case when status = 'not_looking' then 'active' else status end
  where id = p_worker_id
  returning listed_until into result;
  perform set_config('ishuz.listing_internal', '', true);
  return result;
end $$;

create or replace function public.worker_listing_quote()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare wid uuid := public.current_worker_id();
begin
  if wid is null then raise exception 'worker_profile_required' using errcode = '23514'; end if;
  return jsonb_build_object(
    'mode', case
      when not public.listings_paid() then 'free'
      when (select listed_until from public.worker_profiles where id = wid) > now() then 'paid_window'
      when not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_worker_listing_used_at is not null) then 'free_trial'
      else 'payment_required' end,
    'price', public.setting_int('price_worker_listing', 20000),
    'lifetime_days', public.setting_int('listing_days', 10),
    'listed_until', (select listed_until from public.worker_profiles where id = wid));
end $$;

-- Har soat: muddati tugagan ish qidiruvchi e'lonlari qidiruvdan chiqadi; 1 kun qolganda ogohlantirish
create or replace function public.expire_worker_listings()
returns int language plpgsql security definer set search_path = public as $$
declare
  w record;
  n int := 0;
begin
  perform set_config('ishuz.listing_internal', '1', true);
  for w in
    select id, profile_id, listed_until from public.worker_profiles
    where is_public and listed_until is not null and listed_until > now() and listed_until < now() + interval '1 day' and listing_warned_at is null
    limit 5000
  loop
    perform public.notify(w.profile_id, 'system', jsonb_build_object('kind', 'listing_expiring', 'until', w.listed_until), '/profile/listing');
    update public.worker_profiles set listing_warned_at = now() where id = w.id;
  end loop;
  for w in
    select id, profile_id from public.worker_profiles
    where is_public and listed_until is not null and listed_until <= now()
    limit 5000
  loop
    update public.worker_profiles set is_public = false where id = w.id;
    perform public.notify(w.profile_id, 'system', jsonb_build_object('kind', 'listing_expired'), '/profile/listing');
    n := n + 1;
  end loop;
  perform set_config('ishuz.listing_internal', '', true);
  return n;
end $$;

-- Hozir qidiruvda ko'rinib turgan ish qidiruvchilar: 10 kunlik muddat beriladi (bu ularning bepul e'loni hisoblanadi)
do $$
begin
  perform set_config('ishuz.listing_internal', '1', true);
  update public.worker_profiles set listed_until = now() + interval '10 days'
  where is_public and onboarding_completed_at is not null and listed_until is null;
  insert into public.billing_usage (profile_id, free_worker_listing_used_at)
  select w.profile_id, now() from public.worker_profiles w where w.listed_until is not null
  on conflict (profile_id) do update set free_worker_listing_used_at = coalesce(public.billing_usage.free_worker_listing_used_at, now());
  perform set_config('ishuz.listing_internal', '', true);
end $$;

-- ---------------------------------------------------------------------
-- Vakansiya: o'z bayrog'i bilan pullik; birinchi bepul e'lon ham 10 kun
-- ---------------------------------------------------------------------
create or replace function public.vacancy_publish_mode(p_vacancy_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v public.vacancies;
begin
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.id is null then return null; end if;
  if v.paid_until is not null and v.paid_until > now() + interval '1 minute' then return 'paid_window'; end if;
  if not public.billing_enabled() and not public.listings_paid() then return 'free'; end if;
  if public.billing_promo_active() then return 'promo'; end if;
  if not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_vacancy_used_at is not null) then return 'free_trial'; end if;
  return 'payment_required';
end $$;

create or replace function public.vacancy_publish_quote(p_vacancy_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mode', public.vacancy_publish_mode(p_vacancy_id),
    'price', public.setting_int('price_vacancy_publish', 20000),
    'lifetime_days', public.setting_int('vacancy_lifetime_days', 10),
    'free_hours', public.setting_int('vacancy_lifetime_days', 10) * 24,
    'promo_until', public.billing_promo_until(),
    'paid_until', (select paid_until from public.vacancies where id = p_vacancy_id));
end $$;

create or replace function public.publish_vacancy(p_vacancy_id uuid)
returns public.vacancy_status language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  mode text;
  window_end timestamptz;
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.category_id is null or (v.region_id is null and not v.is_remote) then
    raise exception 'vacancy_incomplete' using errcode = '23514';
  end if;
  if v.status not in ('draft', 'paused', 'closed', 'expired', 'pending_review', 'rejected') then
    raise exception 'invalid_status' using errcode = '23514';
  end if;
  mode := public.vacancy_publish_mode(p_vacancy_id);
  if mode = 'paid_window' then
    window_end := v.paid_until;
  elsif mode in ('promo', 'free') then
    window_end := now() + make_interval(days => public.setting_int('vacancy_lifetime_days', 10));
  elsif mode = 'free_trial' then
    -- birinchi e'lon ham to'liq muddatga (10 kun)
    window_end := now() + make_interval(days => public.setting_int('vacancy_lifetime_days', 10));
    insert into public.billing_usage (profile_id, free_vacancy_used_at) values (auth.uid(), now())
    on conflict (profile_id) do update set free_vacancy_used_at = now() where public.billing_usage.free_vacancy_used_at is null;
  else
    raise exception 'payment_required' using errcode = 'P0001';
  end if;
  return public.activate_vacancy_internal(p_vacancy_id, window_end);
end $$;

-- To'lov yaratish: e'lonlar pullik bo'lsa umumiy billing o'chiq bo'lsa ham ruxsat
create or replace function public.billing_guard_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.purpose <> 'ai_alerts'
     and not (public.listings_paid() and new.purpose in ('vacancy_publish', 'worker_listing'))
     and not public.billing_enabled()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.create_payment(p_purpose public.payment_purpose, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  amt bigint;
  p public.payments;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.check_rate_limit('create_payment:' || me, 20, 3600) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if p_purpose = 'vacancy_publish' then
    if not public.can_edit_vacancy(p_target_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if exists (select 1 from public.vacancies where id = p_target_id and paid_until > now() + interval '1 day') then
      raise exception 'already_paid' using errcode = 'P0001';
    end if;
    amt := public.setting_int('price_vacancy_publish', 20000);
    insert into public.payments (profile_id, purpose, vacancy_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  elsif p_purpose = 'ai_alerts' then
    amt := public.setting_int('price_ai_alerts', 15000);
    insert into public.payments (profile_id, purpose, amount) values (me, p_purpose, amt) returning * into p;
  elsif p_purpose = 'worker_listing' then
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.setting_int('price_worker_listing', 20000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  else
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.setting_int('price_worker_promotion', 20000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  end if;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount);
end $$;

create or replace function public.apply_payment_internal(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  v public.vacancies;
  window_end timestamptz;
begin
  select * into p from public.payments where id = p_payment_id;
  if p.purpose = 'vacancy_publish' and p.vacancy_id is not null then
    select * into v from public.vacancies where id = p.vacancy_id for update;
    if v.id is null then return; end if;
    window_end := greatest(coalesce(v.paid_until, now()), now()) + make_interval(days => public.setting_int('vacancy_lifetime_days', 10));
    if v.status in ('draft', 'paused', 'closed', 'expired', 'rejected') and v.category_id is not null and (v.region_id is not null or v.is_remote) then
      perform public.activate_vacancy_internal(v.id, window_end);
    else
      update public.vacancies set paid_until = window_end,
        expires_at = case when status = 'active' then window_end else expires_at end
      where id = v.id;
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/employer/vacancies/' || v.id);
  elsif p.purpose = 'worker_promotion' and p.worker_id is not null then
    perform public.extend_worker_promotion_internal(p.worker_id);
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/');
  elsif p.purpose = 'worker_listing' and p.worker_id is not null then
    perform public.extend_worker_listing_internal(p.worker_id);
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/profile/listing');
  elsif p.purpose = 'ai_alerts' then
    insert into public.ai_alert_subscriptions (profile_id, paid_until)
    values (p.profile_id, now() + make_interval(days => public.setting_int('ai_alerts_days', 30)))
    on conflict (profile_id) do update
      set paid_until = greatest(public.ai_alert_subscriptions.paid_until, now()) + make_interval(days => public.setting_int('ai_alerts_days', 30)),
          updated_at = now();
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/ai-alerts');
  end if;
end $$;

-- Har soatlik vazifa: vakansiyalar + ish qidiruvchi e'lonlari
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ishuz-expire-hourly', '7 * * * *', $job$select public.expire_vacancies(); select public.expire_worker_listings();$job$);
  end if;
end $$;

revoke execute on function public.trg_worker_listing(), public.extend_worker_listing_internal(uuid), public.expire_worker_listings() from public, anon, authenticated;
grant execute on function public.worker_listing_quote(), public.listings_paid() to authenticated;
grant execute on function public.listings_paid() to anon;
revoke execute on function public.create_payment(public.payment_purpose, uuid), public.apply_payment_internal(uuid) from public, anon;
grant execute on function public.create_payment(public.payment_purpose, uuid) to authenticated;
revoke execute on function public.apply_payment_internal(uuid) from authenticated;
