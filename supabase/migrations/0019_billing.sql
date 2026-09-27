-- =====================================================================
-- 0019: To'lovlar (Payme / Click), bepul limitlar, aksiya davri, TOP profil
--
-- Qoidalar (narxlar app_settings'da, admin o'zgartiradi):
--   * Vakansiya e'loni: price_vacancy_publish (50 000 so'm) — vacancy_lifetime_days (30) kunga.
--   * Har profilga 1 ta bepul vakansiya — free_vacancy_hours (24) soat, keyin avtomatik yopiladi.
--   * Ishchi profilini TOP ga chiqarish: price_worker_promotion (20 000) — promotion_hours (24) soat; 1 marta bepul.
--   * billing_free_until gacha (ishga tushgandan 1 oy) — hammasi bepul.
-- To'lov holati faqat server (service_role) funksiyalari orqali o'zgaradi; mijozga ishonilmaydi.
-- =====================================================================

create type public.payment_purpose as enum ('vacancy_publish', 'worker_promotion');
create type public.payment_status as enum ('pending', 'paid', 'cancelled', 'failed');
create type public.payment_provider as enum ('payme', 'click');

insert into public.app_settings (key, value, is_public) values
  ('billing_free_until', to_jsonb(to_char((now() + interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), true),
  ('price_vacancy_publish', '50000'::jsonb, true),
  ('price_worker_promotion', '20000'::jsonb, true),
  ('free_vacancy_hours', '24'::jsonb, true),
  ('promotion_hours', '24'::jsonb, true)
on conflict (key) do nothing;

alter table public.vacancies add column paid_until timestamptz;
alter table public.worker_profiles add column promoted_until timestamptz;
create index worker_profiles_promoted_idx on public.worker_profiles (promoted_until) where promoted_until is not null;

-- Bepul imkoniyatlardan foydalanish (profilga bitta)
create table public.billing_usage (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  free_vacancy_used_at timestamptz,
  free_promotion_used_at timestamptz
);
alter table public.billing_usage enable row level security;
create policy "billing_usage_own" on public.billing_usage for select to authenticated using (profile_id = auth.uid());

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- Qisqa raqamli buyurtma raqami: Payme account.order_id va Click merchant_trans_id / merchant_prepare_id
  order_no bigint generated always as identity unique,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  purpose public.payment_purpose not null,
  vacancy_id uuid references public.vacancies (id) on delete set null,
  worker_id uuid references public.worker_profiles (id) on delete set null,
  amount bigint not null check (amount > 0), -- so'm
  status public.payment_status not null default 'pending',
  provider public.payment_provider,
  provider_txn_id text,
  provider_state int,
  provider_create_time bigint,
  provider_perform_time bigint,
  provider_cancel_time bigint,
  cancel_reason int,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  constraint payments_target check ((purpose = 'vacancy_publish' and vacancy_id is not null) or (purpose = 'worker_promotion' and worker_id is not null))
);
create unique index payments_provider_txn_idx on public.payments (provider, provider_txn_id) where provider_txn_id is not null;
create index payments_profile_idx on public.payments (profile_id, created_at desc);
alter table public.payments enable row level security;
create policy "payments_own" on public.payments for select to authenticated using (profile_id = auth.uid() or public.has_admin_permission('settings.manage'));

-- ---------------------------------------------------------------------
-- RLS: to'lov maydonlarini mijoz o'zgartira olmaydi
-- ---------------------------------------------------------------------
drop policy "vacancies_insert" on public.vacancies;
create policy "vacancies_insert" on public.vacancies for insert to authenticated
  with check (owner_profile_id = auth.uid() and status = 'draft' and public.is_active_user()
    and not is_featured and featured_until is null and not requires_review and moderation_note is null
    and published_at is null and expires_at is null and paid_until is null and views_count = 0 and applications_count = 0
    and (company_id is null or exists (select 1 from public.company_members m where m.company_id = vacancies.company_id and m.profile_id = auth.uid() and m.role in ('owner', 'admin', 'recruiter'))));

drop policy "vacancies_update" on public.vacancies;
create policy "vacancies_update" on public.vacancies for update to authenticated
  using (public.can_edit_vacancy(id) and status <> 'hidden')
  with check (public.can_edit_vacancy(id)
    and (status in ('draft', 'paused', 'closed', 'pending_review', 'rejected', 'expired')
         or (status = 'active' and (select v.status from public.vacancies v where v.id = vacancies.id) = 'active'))
    and (company_id is null or public.is_company_member(company_id))
    and owner_profile_id is not distinct from (select v.owner_profile_id from public.vacancies v where v.id = vacancies.id)
    and company_id is not distinct from (select v.company_id from public.vacancies v where v.id = vacancies.id)
    and is_featured is not distinct from (select v.is_featured from public.vacancies v where v.id = vacancies.id)
    and featured_until is not distinct from (select v.featured_until from public.vacancies v where v.id = vacancies.id)
    and requires_review is not distinct from (select v.requires_review from public.vacancies v where v.id = vacancies.id)
    and moderation_note is not distinct from (select v.moderation_note from public.vacancies v where v.id = vacancies.id)
    and published_at is not distinct from (select v.published_at from public.vacancies v where v.id = vacancies.id)
    and expires_at is not distinct from (select v.expires_at from public.vacancies v where v.id = vacancies.id)
    and paid_until is not distinct from (select v.paid_until from public.vacancies v where v.id = vacancies.id)
    and views_count is not distinct from (select v.views_count from public.vacancies v where v.id = vacancies.id)
    and applications_count is not distinct from (select v.applications_count from public.vacancies v where v.id = vacancies.id));

drop policy "worker_profiles_insert" on public.worker_profiles;
create policy "worker_profiles_insert" on public.worker_profiles for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_user() and promoted_until is null);
drop policy "worker_profiles_update" on public.worker_profiles;
create policy "worker_profiles_update" on public.worker_profiles for update to authenticated using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_active_user()
    and views_count is not distinct from (select w.views_count from public.worker_profiles w where w.id = worker_profiles.id)
    and completeness is not distinct from (select w.completeness from public.worker_profiles w where w.id = worker_profiles.id)
    and promoted_until is not distinct from (select w.promoted_until from public.worker_profiles w where w.id = worker_profiles.id));

-- ---------------------------------------------------------------------
-- Sozlamalar
-- ---------------------------------------------------------------------
create or replace function public.setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default);
$$;

create or replace function public.billing_promo_until()
returns timestamptz language sql stable security definer set search_path = public as $$
  select (select nullif(value #>> '{}', '')::timestamptz from public.app_settings where key = 'billing_free_until');
$$;

create or replace function public.billing_promo_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.billing_promo_until() > now(), false);
$$;

-- ---------------------------------------------------------------------
-- Vakansiya e'loni: qaysi rejim (UI oldindan ko'rsatadi, publish_vacancy xuddi shu qoidani qo'llaydi)
--   paid_window — to'langan/berilgan muddat hali tugamagan (pauzadan qaytish bepul)
--   promo       — aksiya davri
--   free_trial  — birinchi bepul vakansiya (24 soat)
--   payment_required
-- ---------------------------------------------------------------------
create or replace function public.vacancy_publish_mode(p_vacancy_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v public.vacancies;
begin
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.id is null then return null; end if;
  if v.paid_until is not null and v.paid_until > now() + interval '1 minute' then return 'paid_window'; end if;
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
    'price', public.setting_int('price_vacancy_publish', 50000),
    'lifetime_days', public.setting_int('vacancy_lifetime_days', 30),
    'free_hours', public.setting_int('free_vacancy_hours', 24),
    'promo_until', public.billing_promo_until(),
    'paid_until', (select paid_until from public.vacancies where id = p_vacancy_id));
end $$;

-- Ichki: vakansiyani window_end gacha faollashtiradi (ruxsat va to'lov chaqiruvchida tekshirilgan)
create or replace function public.activate_vacancy_internal(p_vacancy_id uuid, p_window_end timestamptz)
returns public.vacancy_status language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  moderation boolean := coalesce((select (value)::boolean from public.app_settings where key = 'vacancy_moderation_enabled'), false);
  new_status public.vacancy_status;
begin
  select * into v from public.vacancies where id = p_vacancy_id for update;
  if v.category_id is null or (v.region_id is null and not v.is_remote) then
    raise exception 'vacancy_incomplete' using errcode = '23514';
  end if;
  if v.status not in ('draft', 'paused', 'closed', 'expired', 'pending_review', 'rejected') then
    raise exception 'invalid_status' using errcode = '23514';
  end if;
  new_status := case when moderation or v.requires_review then 'pending_review' else 'active' end;
  update public.vacancies
  set status = new_status,
      paid_until = p_window_end,
      published_at = case when new_status = 'active' then now() else published_at end,
      expires_at = case when new_status = 'active' then p_window_end else expires_at end
  where id = p_vacancy_id;
  if new_status = 'active' then
    perform public.refresh_matches_for_vacancy(p_vacancy_id);
    if v.published_at is null then perform public.notify_matching_workers(p_vacancy_id); end if;
  end if;
  return new_status;
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
  elsif mode = 'promo' then
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

-- ---------------------------------------------------------------------
-- TOP profil (ishchi)
-- ---------------------------------------------------------------------
create or replace function public.worker_promotion_mode()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if public.billing_promo_active() then return 'promo'; end if;
  if not exists (select 1 from public.billing_usage u where u.profile_id = auth.uid() and u.free_promotion_used_at is not null) then return 'free_trial'; end if;
  return 'payment_required';
end $$;

create or replace function public.worker_promotion_quote()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare wid uuid := public.current_worker_id();
begin
  if wid is null then raise exception 'worker_profile_required' using errcode = '23514'; end if;
  return jsonb_build_object(
    'mode', public.worker_promotion_mode(),
    'price', public.setting_int('price_worker_promotion', 20000),
    'hours', public.setting_int('promotion_hours', 24),
    'promo_until', public.billing_promo_until(),
    'promoted_until', (select promoted_until from public.worker_profiles where id = wid));
end $$;

create or replace function public.extend_worker_promotion_internal(p_worker_id uuid)
returns timestamptz language sql security definer set search_path = public as $$
  update public.worker_profiles
  set promoted_until = greatest(coalesce(promoted_until, now()), now()) + make_interval(hours => public.setting_int('promotion_hours', 24))
  where id = p_worker_id
  returning promoted_until;
$$;

-- Bepul/aksiya bo'yicha TOP; aks holda payment_required (to'lov create_payment orqali)
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
  if mode = 'promo' then
    -- aksiyada ham suiiste'mol bo'lmasin: faol TOP tugamaguncha qayta uzaytirilmaydi
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

-- ---------------------------------------------------------------------
-- To'lovlar
-- ---------------------------------------------------------------------
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
    amt := public.setting_int('price_vacancy_publish', 50000);
    insert into public.payments (profile_id, purpose, vacancy_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  else
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.setting_int('price_worker_promotion', 20000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  end if;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount);
end $$;

-- Ichki: to'lov tasdiqlangach xizmatni berish (idempotent emas — faqat pending→paid o'tishida chaqiriladi)
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
    window_end := greatest(coalesce(v.paid_until, now()), now()) + make_interval(days => public.setting_int('vacancy_lifetime_days', 30));
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
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Nomzodlar qidiruvi: TOP profillar birinchi (qaytariladigan ustunlar o'zgarmaydi)
-- ---------------------------------------------------------------------
create or replace function public.search_workers(
  p_query text default null,
  p_category_id uuid default null,
  p_subcategory_id uuid default null,
  p_region_id uuid default null,
  p_district_ids uuid[] default null,
  p_experience_min_months int default null,
  p_salary_max int default null,
  p_schedules public.work_schedule[] default null,
  p_employment_types public.employment_type[] default null,
  p_work_format public.work_format default null,
  p_gender public.gender default null,
  p_education_min public.education_level default null,
  p_language_codes text[] default null,
  p_skill_ids uuid[] default null,
  p_statuses public.worker_status[] default null,
  p_availability public.availability[] default null,
  p_has_portfolio boolean default false,
  p_verified_only boolean default false,
  p_remote boolean default null,
  p_vacancy_id uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_distance_km double precision default null,
  p_sort text default 'relevant',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, profile_id uuid, first_name text, last_initial text, avatar_url text, headline text,
  category_id uuid, category_name_uz text, category_name_ru text, subcategory_name_uz text, subcategory_name_ru text,
  region_name_uz text, region_name_ru text, district_name_uz text, district_name_ru text,
  experience_level public.experience_level, status public.worker_status, work_format public.work_format,
  remote_preference public.remote_preference, salary_min int, salary_expected int, salary_type public.salary_type,
  employment_types public.employment_type[], schedules public.work_schedule[], availability public.availability,
  skills jsonb, languages jsonb, completeness int, has_portfolio boolean, phone_verified boolean,
  match_score int, match_reasons jsonb, distance_km double precision, is_saved boolean, last_active_at timestamptz, total_count bigint
)
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.current_employer_id() is null and not public.is_admin() then
    raise exception 'employer_only' using errcode = '42501';
  end if;
  if p_vacancy_id is not null and not public.manages_vacancy(p_vacancy_id) and not public.is_admin() then
    p_vacancy_id := null;
  end if;
  if not public.check_rate_limit('search_workers:' || me, 120, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
  with base as (
    select w.*, pf.first_name as fn, pf.last_name as ln, pf.avatar_url as av, pf.gender as gd, pf.birth_date as bd,
      pr.salary_min as smin, pr.salary_expected as sexp, pr.salary_type as stype, pr.employment_types as etypes,
      pr.schedules as scheds, pr.availability as avail,
      -- masofa butun km gacha yaxlitlanadi: aniq koordinatani trilateratsiya bilan topib bo'lmaydi
      case when p_lat is null then null else greatest(1.0, ceil(public.distance_km(p_lat, p_lng, g.lat, g.lng))) end as dist
    from public.worker_profiles w
    join public.profiles pf on pf.id = w.profile_id
    left join public.worker_preferences pr on pr.worker_id = w.id
    left join public.worker_geo g on g.worker_id = w.id
    where w.is_public and not pf.is_blocked and w.onboarding_completed_at is not null
      and (p_statuses is null or cardinality(p_statuses) = 0 or w.status = any(p_statuses))
      and (p_statuses is not null and cardinality(p_statuses) > 0 or w.status <> 'not_looking')
      and (p_category_id is null or w.category_id = p_category_id)
      and (p_subcategory_id is null or w.subcategory_id = p_subcategory_id)
      and (p_region_id is null or w.region_id = p_region_id)
      and (p_district_ids is null or cardinality(p_district_ids) = 0 or w.district_id = any(p_district_ids)
           or exists (select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = any(p_district_ids)))
      and (p_experience_min_months is null or public.experience_level_months(w.experience_level) >= p_experience_min_months)
      and (p_salary_max is null or pr.salary_min is null or pr.salary_min <= p_salary_max)
      and (p_schedules is null or cardinality(p_schedules) = 0 or pr.schedules is null or cardinality(pr.schedules) = 0 or pr.schedules && p_schedules)
      and (p_employment_types is null or cardinality(p_employment_types) = 0 or pr.employment_types is null or cardinality(pr.employment_types) = 0 or pr.employment_types && p_employment_types)
      and (p_work_format is null or p_work_format = 'any' or w.work_format = p_work_format or w.work_format = 'any')
      and (p_gender is null or pf.gender = p_gender)
      and (p_education_min is null or exists (select 1 from public.worker_education e where e.worker_id = w.id and public.education_rank(e.level) >= public.education_rank(p_education_min)))
      and (p_language_codes is null or cardinality(p_language_codes) = 0 or not exists (
            select 1 from unnest(p_language_codes) lc where not exists (
              select 1 from public.worker_languages wl where wl.worker_id = w.id and wl.language_code = lc)))
      and (p_skill_ids is null or cardinality(p_skill_ids) = 0 or exists (
            select 1 from public.worker_skills ws where ws.worker_id = w.id and ws.skill_id = any(p_skill_ids)))
      and (p_availability is null or cardinality(p_availability) = 0 or pr.availability = any(p_availability))
      and (not p_has_portfolio or exists (select 1 from public.worker_portfolio wp where wp.worker_id = w.id))
      and (not p_verified_only or exists (select 1 from public.profile_contacts c where c.profile_id = w.profile_id and c.phone_verified_at is not null))
      and (p_remote is null or (p_remote and w.remote_preference <> 'no') or (not p_remote and w.remote_preference <> 'yes'))
      and (p_max_distance_km is null or p_lat is null or public.distance_km(p_lat, p_lng, g.lat, g.lng) <= p_max_distance_km)
      and (p_query is null or trim(p_query) = '' or w.headline ilike '%' || p_query || '%' or w.about ilike '%' || p_query || '%'
           or exists (select 1 from public.worker_skills ws join public.skills sk on sk.id = ws.skill_id
                      where ws.worker_id = w.id and (sk.name_uz ilike '%' || p_query || '%' or sk.name_ru ilike '%' || p_query || '%')))
  ),
  scored as (
    select b.*,
      case when p_vacancy_id is not null then m.score end as ms,
      case when p_vacancy_id is not null then m.reasons end as mr,
      count(*) over () as total
    from base b
    left join lateral (select * from public.compute_match(b.id, p_vacancy_id)) m on p_vacancy_id is not null
  )
  select
    s.id, s.profile_id, s.fn, left(s.ln, 1), s.av, s.headline,
    s.category_id, cat.name_uz, cat.name_ru, sub.name_uz, sub.name_ru,
    rg.name_uz, rg.name_ru, d.name_uz, d.name_ru,
    s.experience_level, s.status, s.work_format, s.remote_preference, s.smin, s.sexp, s.stype,
    coalesce(s.etypes, '{}'), coalesce(s.scheds, '{}'), s.avail,
    coalesce((select jsonb_agg(jsonb_build_object('id', sk.id, 'name_uz', sk.name_uz, 'name_ru', sk.name_ru, 'level', ws.level) order by ws.level desc)
              from public.worker_skills ws join public.skills sk on sk.id = ws.skill_id where ws.worker_id = s.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('code', wl.language_code, 'level', wl.level)) from public.worker_languages wl where wl.worker_id = s.id), '[]'::jsonb),
    s.completeness,
    exists (select 1 from public.worker_portfolio wp where wp.worker_id = s.id),
    exists (select 1 from public.profile_contacts c where c.profile_id = s.profile_id and c.phone_verified_at is not null),
    s.ms, s.mr, s.dist,
    exists (select 1 from public.saved_workers sw where sw.employer_profile_id = me and sw.worker_id = s.id),
    s.last_active_at, s.total
  from scored s
  left join public.categories cat on cat.id = s.category_id
  left join public.subcategories sub on sub.id = s.subcategory_id
  left join public.regions rg on rg.id = s.region_id
  left join public.districts d on d.id = s.district_id
  order by
    -- TOP (to'langan/bepul reklama) profillar har doim birinchi
    (s.promoted_until is not null and s.promoted_until > now()) desc,
    case when p_sort = 'newest' then s.last_active_at end desc nulls last,
    case when p_sort = 'distance' then s.dist end asc nulls last,
    case when p_sort = 'relevant' then coalesce(s.ms, s.completeness) end desc nulls last,
    s.last_active_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
end $$;

-- =====================================================================
-- Payme Merchant API (JSON-RPC). Summa tiyinda. Faqat service_role chaqiradi.
-- Javob: {"result": {...}} yoki {"error": {"code", "message": {uz,ru,en}, "data"}}
-- =====================================================================
create or replace function public.payme_error(p_code int, p_uz text, p_ru text, p_en text, p_data text default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('error', jsonb_build_object('code', p_code, 'message', jsonb_build_object('uz', p_uz, 'ru', p_ru, 'en', p_en), 'data', p_data));
$$;

-- Buyurtmani tekshirish (CheckPerformTransaction va CreateTransaction uchun umumiy)
create or replace function public.payme_validate_order(p_order text, p_amount bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.payments;
begin
  if p_order is null or p_order !~ '^\d{1,18}$' then
    return public.payme_error(-31050, 'Buyurtma topilmadi', 'Заказ не найден', 'Order not found', 'order_id');
  end if;
  select * into p from public.payments where order_no = p_order::bigint;
  if p.id is null then return public.payme_error(-31050, 'Buyurtma topilmadi', 'Заказ не найден', 'Order not found', 'order_id'); end if;
  if p.status = 'paid' then return public.payme_error(-31051, 'Buyurtma allaqachon to''langan', 'Заказ уже оплачен', 'Order already paid', 'order_id'); end if;
  if p.status <> 'pending' then return public.payme_error(-31052, 'Buyurtma bekor qilingan', 'Заказ отменён', 'Order cancelled', 'order_id'); end if;
  if p.amount * 100 <> p_amount then return public.payme_error(-31001, 'Noto''g''ri summa', 'Неверная сумма', 'Incorrect amount'); end if;
  return jsonb_build_object('ok', true, 'payment_id', p.id);
end $$;

create or replace function public.payme_check_perform(p_order text, p_amount bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public.payme_validate_order(p_order, p_amount);
begin
  if r ? 'error' then return r; end if;
  return jsonb_build_object('result', jsonb_build_object('allow', true));
end $$;

create or replace function public.payme_create(p_txn text, p_time bigint, p_order text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  r jsonb;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into p from public.payments where provider = 'payme' and provider_txn_id = p_txn for update;
  if p.id is not null then
    if p.provider_state <> 1 then return public.payme_error(-31008, 'Amalni bajarib bo''lmaydi', 'Невозможно выполнить операцию', 'Unable to perform operation'); end if;
    if now_ms - p.provider_create_time > 43200000 then
      update public.payments set provider_state = -1, status = 'cancelled', cancel_reason = 4, provider_cancel_time = now_ms, cancelled_at = now() where id = p.id;
      return public.payme_error(-31008, 'Tranzaksiya muddati o''tgan', 'Время транзакции истекло', 'Transaction timed out');
    end if;
    return jsonb_build_object('result', jsonb_build_object('create_time', p.provider_create_time, 'transaction', p.id::text, 'state', 1));
  end if;

  r := public.payme_validate_order(p_order, p_amount);
  if r ? 'error' then return r; end if;
  select * into p from public.payments where id = (r ->> 'payment_id')::uuid for update;
  -- Buyurtmada boshqa faol tranzaksiya bo'lsa — band
  if p.provider_txn_id is not null and p.provider_state = 1 then
    return public.payme_error(-31099, 'Buyurtma boshqa tranzaksiyada', 'Заказ ожидает оплаты в другой транзакции', 'Order is busy', 'order_id');
  end if;
  update public.payments
  set provider = 'payme', provider_txn_id = p_txn, provider_state = 1, provider_create_time = p_time,
      provider_perform_time = null, provider_cancel_time = null, cancel_reason = null
  where id = p.id;
  return jsonb_build_object('result', jsonb_build_object('create_time', p_time, 'transaction', p.id::text, 'state', 1));
end $$;

create or replace function public.payme_perform(p_txn text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into p from public.payments where provider = 'payme' and provider_txn_id = p_txn for update;
  if p.id is null then return public.payme_error(-31003, 'Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'); end if;
  if p.provider_state = 2 then
    return jsonb_build_object('result', jsonb_build_object('transaction', p.id::text, 'perform_time', p.provider_perform_time, 'state', 2));
  end if;
  if p.provider_state <> 1 then return public.payme_error(-31008, 'Amalni bajarib bo''lmaydi', 'Невозможно выполнить операцию', 'Unable to perform operation'); end if;
  if now_ms - p.provider_create_time > 43200000 then
    update public.payments set provider_state = -1, status = 'cancelled', cancel_reason = 4, provider_cancel_time = now_ms, cancelled_at = now() where id = p.id;
    return public.payme_error(-31008, 'Tranzaksiya muddati o''tgan', 'Время транзакции истекло', 'Transaction timed out');
  end if;
  update public.payments set provider_state = 2, provider_perform_time = now_ms, status = 'paid', paid_at = now() where id = p.id;
  perform public.apply_payment_internal(p.id);
  return jsonb_build_object('result', jsonb_build_object('transaction', p.id::text, 'perform_time', now_ms, 'state', 2));
end $$;

create or replace function public.payme_cancel(p_txn text, p_reason int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into p from public.payments where provider = 'payme' and provider_txn_id = p_txn for update;
  if p.id is null then return public.payme_error(-31003, 'Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'); end if;
  if p.provider_state = 1 then
    update public.payments set provider_state = -1, status = 'cancelled', cancel_reason = p_reason, provider_cancel_time = now_ms, cancelled_at = now() where id = p.id;
    return jsonb_build_object('result', jsonb_build_object('transaction', p.id::text, 'cancel_time', now_ms, 'state', -1));
  end if;
  if p.provider_state = 2 then
    -- Xizmat allaqachon berilgan (vakansiya e'lon qilingan / TOP yoqilgan) — bekor qilib bo'lmaydi
    return public.payme_error(-31007, 'Xizmat ko''rsatilgan, bekor qilib bo''lmaydi', 'Услуга оказана, отмена невозможна', 'Service delivered, cannot cancel');
  end if;
  return jsonb_build_object('result', jsonb_build_object('transaction', p.id::text, 'cancel_time', p.provider_cancel_time, 'state', p.provider_state));
end $$;

create or replace function public.payme_check(p_txn text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.payments;
begin
  select * into p from public.payments where provider = 'payme' and provider_txn_id = p_txn;
  if p.id is null then return public.payme_error(-31003, 'Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'); end if;
  return jsonb_build_object('result', jsonb_build_object(
    'create_time', p.provider_create_time, 'perform_time', coalesce(p.provider_perform_time, 0), 'cancel_time', coalesce(p.provider_cancel_time, 0),
    'transaction', p.id::text, 'state', p.provider_state, 'reason', p.cancel_reason));
end $$;

create or replace function public.payme_statement(p_from bigint, p_to bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('result', jsonb_build_object('transactions', coalesce(jsonb_agg(jsonb_build_object(
    'id', provider_txn_id, 'time', provider_create_time, 'amount', amount * 100, 'account', jsonb_build_object('order_id', order_no::text),
    'create_time', provider_create_time, 'perform_time', coalesce(provider_perform_time, 0), 'cancel_time', coalesce(provider_cancel_time, 0),
    'transaction', id::text, 'state', provider_state, 'reason', cancel_reason) order by provider_create_time), '[]'::jsonb)))
  from public.payments
  where provider = 'payme' and provider_create_time between p_from and p_to;
$$;

-- =====================================================================
-- Click SHOP API. Imzo (md5) route'da tekshiriladi; summa so'mda.
-- Xato kodlari: -2 summa, -4 allaqachon to'langan, -5 buyurtma yo'q, -6 tranzaksiya yo'q, -9 bekor qilingan
-- =====================================================================
create or replace function public.click_prepare(p_click_trans_id bigint, p_order text, p_amount numeric, p_error int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  if p_order is null or p_order !~ '^\d{1,18}$' then return jsonb_build_object('error', -5, 'error_note', 'Order not found'); end if;
  select * into p from public.payments where order_no = p_order::bigint for update;
  if p.id is null then return jsonb_build_object('error', -5, 'error_note', 'Order not found'); end if;
  if p.status = 'paid' then return jsonb_build_object('error', -4, 'error_note', 'Already paid'); end if;
  if p.status <> 'pending' then return jsonb_build_object('error', -9, 'error_note', 'Transaction cancelled'); end if;
  if p.amount::numeric <> p_amount then return jsonb_build_object('error', -2, 'error_note', 'Incorrect amount'); end if;
  if p_error < 0 then
    update public.payments set status = 'cancelled', cancelled_at = now() where id = p.id;
    return jsonb_build_object('error', -9, 'error_note', 'Transaction cancelled');
  end if;
  update public.payments set provider = 'click', provider_txn_id = p_click_trans_id::text, provider_state = 1 where id = p.id;
  return jsonb_build_object('error', 0, 'error_note', 'Success', 'merchant_prepare_id', p.order_no);
end $$;

create or replace function public.click_complete(p_click_trans_id bigint, p_order text, p_prepare_id bigint, p_amount numeric, p_error int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  if p_order is null or p_order !~ '^\d{1,18}$' then return jsonb_build_object('error', -5, 'error_note', 'Order not found'); end if;
  select * into p from public.payments where order_no = p_order::bigint for update;
  if p.id is null then return jsonb_build_object('error', -5, 'error_note', 'Order not found'); end if;
  if p.order_no <> p_prepare_id or p.provider is distinct from 'click' or p.provider_txn_id is distinct from p_click_trans_id::text then
    return jsonb_build_object('error', -6, 'error_note', 'Transaction not found');
  end if;
  if p.status = 'paid' then return jsonb_build_object('error', -4, 'error_note', 'Already paid', 'merchant_confirm_id', p.order_no); end if;
  if p.status <> 'pending' then return jsonb_build_object('error', -9, 'error_note', 'Transaction cancelled'); end if;
  if p.amount::numeric <> p_amount then return jsonb_build_object('error', -2, 'error_note', 'Incorrect amount'); end if;
  if p_error < 0 then
    update public.payments set status = 'cancelled', provider_state = -1, cancelled_at = now() where id = p.id;
    return jsonb_build_object('error', -9, 'error_note', 'Transaction cancelled');
  end if;
  update public.payments set status = 'paid', provider_state = 2, paid_at = now() where id = p.id;
  perform public.apply_payment_internal(p.id);
  return jsonb_build_object('error', 0, 'error_note', 'Success', 'merchant_confirm_id', p.order_no);
end $$;

-- =====================================================================
-- Huquqlar: foydalanuvchiga faqat quote/publish/promote/create_payment; qolgani faqat service_role
-- (Supabase standart huquqlari yangi funksiyalarni anon/authenticated ga ochadi — yopamiz)
-- =====================================================================
revoke execute on function
  public.setting_int(text, int), public.billing_promo_until(), public.billing_promo_active(), public.vacancy_publish_mode(uuid),
  public.vacancy_publish_quote(uuid), public.activate_vacancy_internal(uuid, timestamptz), public.worker_promotion_mode(),
  public.worker_promotion_quote(), public.extend_worker_promotion_internal(uuid), public.promote_worker(),
  public.create_payment(public.payment_purpose, uuid), public.apply_payment_internal(uuid),
  public.payme_error(int, text, text, text, text), public.payme_validate_order(text, bigint), public.payme_check_perform(text, bigint),
  public.payme_create(text, bigint, text, bigint), public.payme_perform(text), public.payme_cancel(text, int), public.payme_check(text),
  public.payme_statement(bigint, bigint), public.click_prepare(bigint, text, numeric, int), public.click_complete(bigint, text, bigint, numeric, int)
from public, anon, authenticated;

grant execute on function
  public.vacancy_publish_quote(uuid), public.worker_promotion_quote(), public.promote_worker(),
  public.create_payment(public.payment_purpose, uuid), public.billing_promo_until()
to authenticated;
grant execute on function public.billing_promo_until() to anon;
grant execute on all functions in schema public to service_role;

grant select on public.payments, public.billing_usage to authenticated;
grant all on public.payments, public.billing_usage to service_role;

-- =====================================================================
-- 24 soatlik bepul vakansiyalar o'z vaqtida yopilsin: har soatda muddati o'tganlarni yopish
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ishuz-expire-hourly', '7 * * * *', $job$select public.expire_vacancies();$job$);
  end if;
end $$;
