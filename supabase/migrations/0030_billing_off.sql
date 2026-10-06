-- ISH BERUVCHI · 0030 · Joriy reliz: to'lov/paywall YO'Q (keyinroq bayroq bilan yoqiladi).
-- Kod va jadvallar saqlanadi. app_settings.billing_enabled=false bo'lsa: vakansiya e'loni va TOP bepul ('free' rejim),
-- to'lov yaratish rad etiladi. Yoqish: update app_settings set value='true' where key='billing_enabled' + BILLING_ENABLED=true (ilova).

insert into public.app_settings (key, value, is_public)
values ('billing_enabled', 'false'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.billing_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'billing_enabled'), false);
$$;

create or replace function public.vacancy_publish_mode(p_vacancy_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v public.vacancies;
begin
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.id is null then return null; end if;
  if v.paid_until is not null and v.paid_until > now() + interval '1 minute' then return 'paid_window'; end if;
  if not public.billing_enabled() then return 'free'; end if;
  if public.billing_promo_active() then return 'promo'; end if;
  if not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_vacancy_used_at is not null) then return 'free_trial'; end if;
  return 'payment_required';
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
    window_end := now() + make_interval(days => public.setting_int('vacancy_lifetime_days', 30));
  elsif mode = 'free_trial' then
    window_end := now() + make_interval(hours => public.setting_int('free_vacancy_hours', 24));
    insert into public.billing_usage (profile_id, free_vacancy_used_at) values (auth.uid(), now())
    on conflict (profile_id) do update set free_vacancy_used_at = now() where public.billing_usage.free_vacancy_used_at is null;
  else
    raise exception 'payment_required' using errcode = 'P0001';
  end if;
  return public.activate_vacancy_internal(p_vacancy_id, window_end);
end $$;

create or replace function public.worker_promotion_mode()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.billing_enabled() then return 'free'; end if;
  if public.billing_promo_active() then return 'promo'; end if;
  if not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_promotion_used_at is not null) then return 'free_trial'; end if;
  return 'payment_required';
end $$;

create or replace function public.promote_worker()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  wid uuid := public.current_worker_id();
  mode text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  if wid is null then raise exception 'worker_profile_required' using errcode = '23514'; end if;
  if not exists (select 1 from public.worker_profiles where id = wid and onboarding_completed_at is not null) then
    raise exception 'onboarding_required' using errcode = '23514';
  end if;
  mode := public.worker_promotion_mode();
  if mode in ('promo', 'free') then
    if exists (select 1 from public.worker_profiles where id = wid and promoted_until > now()) then
      raise exception 'already_promoted' using errcode = 'P0001';
    end if;
  elsif mode = 'free_trial' then
    insert into public.billing_usage (profile_id, free_promotion_used_at) values (auth.uid(), now())
    on conflict (profile_id) do update set free_promotion_used_at = now() where public.billing_usage.free_promotion_used_at is null;
  else
    raise exception 'payment_required' using errcode = 'P0001';
  end if;
  return public.extend_worker_promotion_internal(wid);
end $$;

-- To'lov o'chiq bo'lsa foydalanuvchi so'rovi bilan to'lov yaratilmaydi (create_payment ham shu triggerga uriladi).
-- Server/migratsiya (JWT'siz yoki service_role) yozuvlari — masalan tarixiy import — to'xtatilmaydi.
create or replace function public.billing_guard_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.billing_enabled() and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;
create or replace trigger trg_payments_billing_guard before insert on public.payments
  for each row execute function public.billing_guard_payment();
