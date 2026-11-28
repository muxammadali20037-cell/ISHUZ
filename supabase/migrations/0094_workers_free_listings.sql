-- 0094: ishchi e'loni bepul, vakansiya pullik (ega, 2026-11-28: "ish beruvchi e'lon joylash va ishchi raqamini ko'rish uchun
-- to'laydi; TOP — xohlasa"; "ishchilar bepul").
--
-- Avval listings_paid() ikkala e'lonni birga pullik qilardi. Endi:
--   listings_paid()        — vakansiya joylash pullik (avvalgidek);
--   worker_listings_paid() — ishchi e'loni pullik: listings_paid() VA app_settings.worker_listings_paid (sukut — false).
-- Ishchi e'loniga tegishli joylar (trigger, holat, narx so'rovi, to'lov qo'riqchisi, ommaviy tariflar) yangi funksiyaga
-- o'tadi; matnning qolgani — 0080/0088/0049/0046 dagi joriy ta'rif bilan aynan bir xil (pg_get_functiondef'dan olingan).
-- Ishchi TOP (Tezkor/Maksimal) — avvalgidek tariffs_enabled bilan. Ma'lumot o'zgarmaydi; qayta ishga tushirsa xavfsiz.

insert into public.app_settings (key, value, is_public)
values ('worker_listings_paid', 'false'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.worker_listings_paid()
returns boolean language sql stable security definer set search_path = public as $$
  select public.listings_paid() and public.setting_bool('worker_listings_paid', false);
$$;
-- anon'ga kerak emas: ommaviy public_tariffs (security definer) ichida chaqiriladi; billing_guard_payment (invoker) — authenticated
revoke execute on function public.worker_listings_paid() from public, anon;
grant execute on function public.worker_listings_paid() to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_worker_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  internal boolean := coalesce(current_setting('ishuz.listing_internal', true), '') = '1';
  publishing boolean;
  onboarding boolean;
begin
  if not internal then
    if tg_op = 'INSERT' then
      new.listed_until := null;
    else
      new.listed_until := old.listed_until;
      new.listing_warned_at := old.listing_warned_at;
    end if;
  end if;

  if internal or not public.worker_listings_paid() then
    return new;
  end if;

  onboarding := tg_op = 'INSERT' or old.onboarding_completed_at is null;
  publishing := new.is_public and new.onboarding_completed_at is not null and new.status <> 'not_looking'
    and (onboarding or not old.is_public or old.status = 'not_looking');
  if not publishing or (new.listed_until is not null and new.listed_until > now()) then
    return new;
  end if;

  if public.listing_free_trial()
     and not exists (select 1 from public.billing_usage u where u.profile_id = new.profile_id and u.free_worker_listing_used_at is not null) then
    insert into public.billing_usage (profile_id, free_worker_listing_used_at) values (new.profile_id, now())
    on conflict (profile_id) do update set free_worker_listing_used_at = now();
    new.listed_until := now() + make_interval(days => public.setting_int('listing_days', 10));
    new.listing_warned_at := null;
    return new;
  end if;

  if onboarding then
    new.is_public := false;
    return new;
  end if;
  raise exception 'listing_payment_required' using errcode = 'P0001';
end $function$;

CREATE OR REPLACE FUNCTION public.my_listing_state(p_entity text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.vacancies;
  w public.worker_profiles;
  st text;
begin
  if p_entity = 'vacancy' then
    select * into v from public.vacancies where id = p_id;
    if v.id is null or not (public.can_edit_vacancy(p_id) or public.is_admin()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    st := case
      when v.status = 'active' then 'active'
      when v.status in ('closed', 'expired', 'hidden', 'paused') then v.status::text
      when public.moderation_enabled() and v.moderation_state = 'rejected' then 'rejected'
      when public.moderation_enabled() and v.moderation_state = 'review' then 'review'
      when public.moderation_enabled() and v.moderation_state = 'pending' and (v.status = 'pending_review' or v.moderation_requested_at is not null) then 'moderation_pending'
      when public.moderation_enabled() and v.moderation_state = 'pending' then 'saved'
      when v.status = 'pending_review' and not public.employer_can_publish(v.owner_profile_id, v.company_id) then 'verification_pending'
      when v.status = 'pending_review' then 'review'
      when v.status = 'draft' and public.vacancy_publish_mode(p_id) = 'payment_required' then 'payment_required'
      when v.status = 'rejected' then 'rejected'
      else 'saved' end;
    return jsonb_build_object('state', st, 'message', v.moderation_message, 'fields', to_jsonb(v.moderation_fields),
      'category', v.moderation_category, 'slug', v.slug,
      'can_appeal', v.moderation_state = 'rejected' and v.moderation_appeal_at is null);
  elsif p_entity = 'worker' then
    select * into w from public.worker_profiles where id = p_id;
    if w.id is null or not (w.profile_id = auth.uid() or public.is_admin()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    st := case
      when w.is_public then 'listed'
      when w.status = 'not_looking' then 'closed'
      when public.setting_bool('worker_phone_required', true) and not public.worker_has_visible_phone(w.id, w.profile_id) then 'phone_required'
      when public.moderation_enabled() and w.moderation_state = 'rejected' then 'rejected'
      when public.moderation_enabled() and w.moderation_state = 'review' then 'review'
      when public.moderation_enabled() and w.moderation_state = 'pending' and w.publish_requested then 'moderation_pending'
      when (w.publish_requested or not public.moderation_enabled()) and public.worker_listings_paid() then 'payment_required'
      else 'saved' end;
    return jsonb_build_object('state', st, 'message', w.moderation_message, 'fields', to_jsonb(w.moderation_fields),
      'category', w.moderation_category, 'listed_until', w.listed_until,
      'can_appeal', w.moderation_state = 'rejected' and w.moderation_appeal_at is null);
  end if;
  raise exception 'invalid_entity' using errcode = '22023';
end $function$;

CREATE OR REPLACE FUNCTION public.worker_listing_quote()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare wid uuid := public.current_worker_id();
begin
  if wid is null then raise exception 'worker_profile_required' using errcode = '23514'; end if;
  return jsonb_build_object(
    'mode', case
      when not public.worker_listings_paid() then 'free'
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
end $function$;

CREATE OR REPLACE FUNCTION public.billing_guard_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.purpose <> 'ai_alerts'
     and not (public.listings_paid() and new.purpose = 'vacancy_publish')
     and not (public.worker_listings_paid() and new.purpose = 'worker_listing')
     and not (new.plan in ('boost', 'max') and new.purpose in ('vacancy_publish', 'worker_listing') and public.tariffs_enabled())
     and not (new.purpose = 'wallet_topup' and public.wallet_enabled())
     and not (new.purpose::text = 'contact_unlock' and public.contact_unlock_paid())
     and not public.billing_enabled()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.public_tariffs()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'vacancy', jsonb_build_array(public.tariff_of('vacancy', 'basic'), public.tariff_of('vacancy', 'boost'), public.tariff_of('vacancy', 'max')),
    'worker', jsonb_build_array(public.tariff_of('worker', 'basic'), public.tariff_of('worker', 'boost'), public.tariff_of('worker', 'max')),
    'listings_paid', public.listings_paid(),
    'worker_listings_paid', public.worker_listings_paid(),
    'tariffs_enabled', public.tariffs_enabled(),
    'ai_alerts_price', public.setting_int('price_ai_alerts', 15000),
    'ai_alerts_days', public.setting_int('ai_alerts_days', 30),
    'discount_percent', public.setting_int('listing_discount_percent', 0),
    'discount_until', (select value #>> '{}' from public.app_settings where key = 'listing_discount_until'));
$function$;
