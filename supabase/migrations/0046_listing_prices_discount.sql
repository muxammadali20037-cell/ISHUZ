-- ISH.UZ · 0046 · Bepul e'lon yo'q. Narxlar: ish qidiruvchi e'loni 10 000 so'm, vakansiya 50 000 so'm (10 kun).
-- Aksiya: 2027-yil 1-yanvargacha (Toshkent vaqti) har bir tomonning BIRINCHI to'lovida 50% chegirma → 5 000 va 25 000 so'm.
-- Narx va chegirma app_settings'da — keyin bitta qiymatni o'zgartirish yetarli.

insert into public.app_settings (key, value, is_public) values
  ('listing_free_trial', 'false'::jsonb, true),
  ('listing_discount_percent', '50'::jsonb, true),
  ('listing_discount_until', to_jsonb('2027-01-01T00:00:00+05:00'::text), true)
on conflict (key) do nothing;
update public.app_settings set value = '50000'::jsonb where key = 'price_vacancy_publish';
update public.app_settings set value = '10000'::jsonb where key = 'price_worker_listing';

-- Joriy foydalanuvchi uchun chegirma foizi: aksiya muddatida va shu turdagi e'lon uchun hali to'lamagan bo'lsa
create or replace function public.listing_discount_percent(p_purpose public.payment_purpose)
returns int language sql stable security definer set search_path = public as $$
  select case
    when coalesce((select nullif(value #>> '{}', '')::timestamptz from public.app_settings where key = 'listing_discount_until'), '-infinity') > now()
     and not exists (select 1 from public.payments p where p.profile_id = auth.uid() and p.purpose = p_purpose and p.status = 'paid')
    then greatest(0, least(100, public.setting_int('listing_discount_percent', 0)))
    else 0 end;
$$;

-- Chegirma bilan narx (so'm, 100 ga yaxlitlangan)
create or replace function public.listing_price(p_purpose public.payment_purpose, p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select (round(public.setting_int(p_key, p_default) * (100 - public.listing_discount_percent(p_purpose)) / 100.0 / 100) * 100)::int;
$$;

create or replace function public.listing_free_trial()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'listing_free_trial'), true);
$$;

-- Ish qidiruvchi: bepul birinchi e'lon faqat sozlama yoqilgan bo'lsa. Ro'yxatdan o'tish to'xtamaydi —
-- to'lov kerak bo'lsa profil yaratiladi, lekin qidiruvda ko'rinmaydi (ariza yuborish ishlayveradi).
create or replace function public.trg_worker_listing()
returns trigger language plpgsql security definer set search_path = public as $$
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

  if internal or not public.listings_paid() then
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
      when public.listing_free_trial() and not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_worker_listing_used_at is not null) then 'free_trial'
      else 'payment_required' end,
    'price', public.listing_price('worker_listing', 'price_worker_listing', 10000),
    'full_price', public.setting_int('price_worker_listing', 10000),
    'discount_percent', public.listing_discount_percent('worker_listing'),
    'discount_until', (select value #>> '{}' from public.app_settings where key = 'listing_discount_until'),
    'lifetime_days', public.setting_int('listing_days', 10),
    'listed_until', (select listed_until from public.worker_profiles where id = wid));
end $$;

create or replace function public.vacancy_publish_mode(p_vacancy_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v public.vacancies;
begin
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.id is null then return null; end if;
  if v.paid_until is not null and v.paid_until > now() + interval '1 minute' then return 'paid_window'; end if;
  if not public.billing_enabled() and not public.listings_paid() then return 'free'; end if;
  if public.billing_promo_active() then return 'promo'; end if;
  if public.listing_free_trial()
     and not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_vacancy_used_at is not null) then return 'free_trial'; end if;
  return 'payment_required';
end $$;

create or replace function public.vacancy_publish_quote(p_vacancy_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mode', public.vacancy_publish_mode(p_vacancy_id),
    'price', public.listing_price('vacancy_publish', 'price_vacancy_publish', 50000),
    'full_price', public.setting_int('price_vacancy_publish', 50000),
    'discount_percent', public.listing_discount_percent('vacancy_publish'),
    'discount_until', (select value #>> '{}' from public.app_settings where key = 'listing_discount_until'),
    'lifetime_days', public.setting_int('vacancy_lifetime_days', 10),
    'free_hours', public.setting_int('vacancy_lifetime_days', 10) * 24,
    'promo_until', public.billing_promo_until(),
    'paid_until', (select paid_until from public.vacancies where id = p_vacancy_id));
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
    amt := public.listing_price('vacancy_publish', 'price_vacancy_publish', 50000);
    insert into public.payments (profile_id, purpose, vacancy_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  elsif p_purpose = 'ai_alerts' then
    amt := public.setting_int('price_ai_alerts', 15000);
    insert into public.payments (profile_id, purpose, amount) values (me, p_purpose, amt) returning * into p;
  elsif p_purpose = 'worker_listing' then
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.listing_price('worker_listing', 'price_worker_listing', 10000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  else
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.setting_int('price_worker_promotion', 20000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  end if;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount);
end $$;

revoke execute on function public.create_payment(public.payment_purpose, uuid) from public, anon;
grant execute on function public.create_payment(public.payment_purpose, uuid) to authenticated;
grant execute on function public.listing_price(public.payment_purpose, text, int), public.listing_discount_percent(public.payment_purpose), public.listing_free_trial() to anon, authenticated;
