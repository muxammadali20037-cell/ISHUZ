-- ISH.UZ · 0008 · biznes-mantiq: moslik, qidiruv, ariza, taklif, chat, kontakt

-- =====================================================================
-- Telefon maxfiyligi
-- =====================================================================
create or replace function public.can_view_phone(p_owner uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  vis public.phone_visibility;
  owner_worker uuid;
  viewer_worker uuid;
begin
  if viewer is null then return false; end if;
  if viewer = p_owner then return true; end if;
  if public.has_admin_permission('users.contacts') then return true; end if;
  select phone_visibility into vis from public.profile_contacts where profile_id = p_owner;
  if vis is null or vis = 'nobody' then return false; end if;
  if vis = 'everyone' then return true; end if;
  if exists (select 1 from public.contact_grants g where g.owner_profile_id = p_owner and g.grantee_profile_id = viewer) then
    return true;
  end if;
  if vis = 'on_request' then return false; end if;

  -- 'applicants': o'rtada ariza yoki qabul qilingan taklif bo'lsa
  select id into owner_worker from public.worker_profiles where profile_id = p_owner;
  select id into viewer_worker from public.worker_profiles where profile_id = viewer;

  -- egasi ishchi, ko'ruvchi ish beruvchi
  if owner_worker is not null and exists (
    select 1 from public.applications a
    join public.vacancies v on v.id = a.vacancy_id
    where a.worker_id = owner_worker and a.status <> 'withdrawn'
      and (v.owner_profile_id = viewer or (v.company_id is not null and exists (
        select 1 from public.company_members m where m.company_id = v.company_id and m.profile_id = viewer)))
  ) then return true; end if;
  if owner_worker is not null and exists (
    select 1 from public.job_offers o where o.worker_id = owner_worker and o.employer_profile_id = viewer and o.status = 'accepted'
  ) then return true; end if;

  -- egasi ish beruvchi, ko'ruvchi ishchi
  if viewer_worker is not null and exists (
    select 1 from public.applications a
    join public.vacancies v on v.id = a.vacancy_id
    where a.worker_id = viewer_worker and a.status <> 'withdrawn'
      and (v.owner_profile_id = p_owner or (v.company_id is not null and exists (
        select 1 from public.company_members m where m.company_id = v.company_id and m.profile_id = p_owner)))
  ) then return true; end if;
  if viewer_worker is not null and exists (
    select 1 from public.job_offers o where o.worker_id = viewer_worker and o.employer_profile_id = p_owner and o.status = 'accepted'
  ) then return true; end if;

  return false;
end $$;

-- Kontaktni olish: ruxsat bo'lsa telefon/telegram, aks holda null
create or replace function public.get_contact(p_profile_id uuid)
returns table (phone text, telegram_username text, phone_verified boolean, allowed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.can_view_phone(p_profile_id) then
    return query
      select c.phone, coalesce(c.telegram_username, t.username), c.phone_verified_at is not null, true
      from public.profile_contacts c
      left join public.telegram_accounts t on t.profile_id = c.profile_id
      where c.profile_id = p_profile_id;
  else
    return query select null::text, null::text, false, false;
  end if;
end $$;

-- =====================================================================
-- Moslik (rule-based). Og'irliklar: kategoriya 25, joylashuv 15, maosh 15,
-- tajriba 10, ko'nikma 15, grafik 10, bandlik turi 5, til 5.
-- Sabablar: [{key, ok: true|false|'warn', ...params}]
-- =====================================================================
create or replace function public.compute_match(p_worker_id uuid, p_vacancy_id uuid)
returns table (score int, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  w public.worker_profiles;
  pr public.worker_preferences;
  v public.vacancies;
  p public.profiles;
  s int := 0;
  r jsonb := '[]'::jsonb;
  req_skills int; matched_skills int;
  worker_months int;
  km double precision;
  lang record;
  lang_ok boolean := true;
  lang_total int := 0;
  lang_matched int := 0;
  age int;
  worker_min int;
begin
  select * into w from public.worker_profiles where id = p_worker_id;
  select * into v from public.vacancies where id = p_vacancy_id;
  if w.id is null or v.id is null then
    score := 0; reasons := '[]'::jsonb; return next; return;
  end if;
  -- Ruxsat: ishchining o'zi, vakansiyani boshqaruvchi, admin yoki server (service role)
  if auth.uid() is not null and not (w.profile_id = auth.uid() or public.manages_vacancy(p_vacancy_id) or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into pr from public.worker_preferences where worker_id = w.id;
  select * into p from public.profiles where id = w.profile_id;

  -- 1. Kategoriya (25)
  if w.category_id is not null and w.category_id = v.category_id then
    if v.subcategory_id is null or w.subcategory_id = v.subcategory_id then
      s := s + 25; r := r || jsonb_build_object('key', 'category_match', 'ok', true);
    else
      s := s + 18; r := r || jsonb_build_object('key', 'category_match_partial', 'ok', 'warn');
    end if;
  else
    r := r || jsonb_build_object('key', 'category_mismatch', 'ok', false);
  end if;

  -- 2. Joylashuv (15). Masofa butun km gacha yaxlitlanadi (aniq koordinata oshkor bo'lmasligi uchun)
  if v.is_remote and w.remote_preference <> 'no' then
    s := s + 15; r := r || jsonb_build_object('key', 'remote_ok', 'ok', true);
  elsif w.remote_preference = 'yes' and not v.is_remote then
    s := s + 5; r := r || jsonb_build_object('key', 'remote_preferred', 'ok', 'warn');
  else
    select public.distance_km(g.lat, g.lng, v.lat, v.lng) into km from public.worker_geo g where g.worker_id = w.id;
    if v.district_id is not null and (v.district_id = w.district_id or exists (
        select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = v.district_id)) then
      s := s + 15;
      r := r || jsonb_build_object('key', 'district_match', 'ok', true, 'km', case when km is not null then greatest(1, ceil(km))::int end);
    elsif km is not null and km <= 5 then
      s := s + 15; r := r || jsonb_build_object('key', 'distance_near', 'ok', true, 'km', greatest(1, ceil(km))::int);
    elsif km is not null and km <= 15 then
      s := s + 10; r := r || jsonb_build_object('key', 'distance_ok', 'ok', 'warn', 'km', greatest(1, ceil(km))::int);
    elsif v.region_id is not null and v.region_id = w.region_id then
      s := s + 8; r := r || jsonb_build_object('key', 'region_match', 'ok', 'warn');
    else
      r := r || jsonb_build_object('key', 'location_far', 'ok', false);
    end if;
  end if;

  -- 3. Maosh (15). Turlari (oylik/kunlik/soatlik) farq qilsa taqqoslanmaydi
  worker_min := coalesce(pr.salary_min, pr.salary_expected);
  if worker_min is null then
    s := s + 10; r := r || jsonb_build_object('key', 'salary_unspecified', 'ok', 'warn');
  elsif v.salary_negotiable or (v.salary_from is null and v.salary_to is null) then
    s := s + 8; r := r || jsonb_build_object('key', 'salary_negotiable', 'ok', 'warn');
  elsif pr.salary_type <> 'negotiable' and v.salary_type <> 'negotiable' and pr.salary_type <> v.salary_type then
    s := s + 8; r := r || jsonb_build_object('key', 'salary_type_differs', 'ok', 'warn', 'vacancy_type', v.salary_type);
  elsif coalesce(v.salary_to, v.salary_from) >= coalesce(pr.salary_expected, worker_min) then
    s := s + 15; r := r || jsonb_build_object('key', 'salary_ok', 'ok', true);
  elsif coalesce(v.salary_to, v.salary_from) >= worker_min then
    s := s + 12; r := r || jsonb_build_object('key', 'salary_min_ok', 'ok', true);
  else
    r := r || jsonb_build_object('key', 'salary_below', 'ok', false, 'vacancy_max', coalesce(v.salary_to, v.salary_from), 'worker_min', worker_min);
  end if;

  -- 4. Tajriba (10)
  worker_months := public.experience_level_months(w.experience_level);
  if worker_months >= v.experience_min_months then
    s := s + 10; r := r || jsonb_build_object('key', 'experience_ok', 'ok', true);
  elsif worker_months + 6 >= v.experience_min_months then
    s := s + 5; r := r || jsonb_build_object('key', 'experience_close', 'ok', 'warn', 'required_months', v.experience_min_months);
  else
    r := r || jsonb_build_object('key', 'experience_low', 'ok', false, 'required_months', v.experience_min_months);
  end if;

  -- 5. Ko'nikmalar (15): faqat majburiy (is_required) ko'nikmalar hisoblanadi; majburiysi bo'lmasa — barchasi
  select count(*) into req_skills from public.vacancy_skills vs where vs.vacancy_id = v.id and vs.is_required;
  if req_skills = 0 then
    select count(*) into req_skills from public.vacancy_skills vs where vs.vacancy_id = v.id;
    select count(*) into matched_skills
    from public.vacancy_skills vs join public.worker_skills ws on ws.skill_id = vs.skill_id and ws.worker_id = w.id
    where vs.vacancy_id = v.id;
  else
    select count(*) into matched_skills
    from public.vacancy_skills vs join public.worker_skills ws on ws.skill_id = vs.skill_id and ws.worker_id = w.id
    where vs.vacancy_id = v.id and vs.is_required;
  end if;
  if req_skills = 0 then
    s := s + 15; r := r || jsonb_build_object('key', 'skills_not_required', 'ok', true);
  else
    s := s + round(15.0 * matched_skills / req_skills)::int;
    r := r || jsonb_build_object('key', 'skills_matched', 'ok', case when matched_skills = req_skills then to_jsonb(true) when matched_skills > 0 then to_jsonb('warn'::text) else to_jsonb(false) end, 'matched', matched_skills, 'required', req_skills);
  end if;

  -- 6. Grafik (10)
  if pr.worker_id is null or cardinality(pr.schedules) = 0 or v.schedule = any(pr.schedules) or 'negotiable' = any(pr.schedules) then
    s := s + 10; r := r || jsonb_build_object('key', 'schedule_ok', 'ok', true);
  elsif 'flexible' = any(pr.schedules) or v.schedule in ('flexible', 'negotiable') then
    s := s + 5; r := r || jsonb_build_object('key', 'schedule_partial', 'ok', 'warn');
  else
    r := r || jsonb_build_object('key', 'schedule_mismatch', 'ok', false, 'vacancy_schedule', v.schedule);
  end if;

  -- 7. Bandlik turi + rasmiylik (5)
  if pr.worker_id is null or cardinality(pr.employment_types) = 0 or v.employment_type = any(pr.employment_types) then
    s := s + 3; r := r || jsonb_build_object('key', 'employment_ok', 'ok', true);
  else
    r := r || jsonb_build_object('key', 'employment_mismatch', 'ok', false, 'vacancy_type', v.employment_type);
  end if;
  if w.work_format = 'any' or v.work_format = 'any' or w.work_format = v.work_format then
    s := s + 2; r := r || jsonb_build_object('key', 'work_format_ok', 'ok', true);
  else
    r := r || jsonb_build_object('key', 'work_format_mismatch', 'ok', false, 'vacancy_format', v.work_format);
  end if;

  -- 8. Til (5)
  for lang in select vl.language_code, vl.min_level from public.vacancy_languages vl where vl.vacancy_id = v.id loop
    lang_total := lang_total + 1;
    if exists (select 1 from public.worker_languages wl where wl.worker_id = w.id and wl.language_code = lang.language_code
               and public.language_level_rank(wl.level) >= public.language_level_rank(lang.min_level)) then
      lang_matched := lang_matched + 1;
    else
      lang_ok := false;
      r := r || jsonb_build_object('key', 'language_required', 'ok', false, 'lang', lang.language_code, 'level', lang.min_level);
    end if;
  end loop;
  if lang_total = 0 then
    s := s + 5;
  else
    s := s + round(5.0 * lang_matched / lang_total)::int;
    if lang_ok then
      r := r || jsonb_build_object('key', 'languages_ok', 'ok', true);
    elsif lang_matched > 0 then
      r := r || jsonb_build_object('key', 'languages_partial', 'ok', 'warn', 'matched', lang_matched, 'required', lang_total);
    end if;
  end if;

  -- Ogohlantirishlar (ballga ta'sir qilmaydi)
  if v.education_min is not null then
    if not exists (select 1 from public.worker_education e where e.worker_id = w.id and public.education_rank(e.level) >= public.education_rank(v.education_min)) then
      r := r || jsonb_build_object('key', 'education_required', 'ok', 'warn', 'level', v.education_min);
    end if;
  end if;
  if p.birth_date is not null and (v.age_min is not null or v.age_max is not null) then
    age := extract(year from age(p.birth_date))::int;
    if (v.age_min is not null and age < v.age_min) or (v.age_max is not null and age > v.age_max) then
      r := r || jsonb_build_object('key', 'age_out_of_range', 'ok', 'warn', 'min', v.age_min, 'max', v.age_max);
    end if;
  end if;

  score := greatest(0, least(100, s));
  reasons := r;
  return next;
end $$;

create or replace function public.refresh_matches_for_worker(p_worker_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not (public.is_admin() or exists (select 1 from public.worker_profiles w where w.id = p_worker_id and w.profile_id = auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.matches where worker_id = p_worker_id;
  insert into public.matches (worker_id, vacancy_id, score, reasons)
  select p_worker_id, v.id, m.score, m.reasons
  from public.vacancies v
  join public.worker_profiles w on w.id = p_worker_id
  cross join lateral public.compute_match(p_worker_id, v.id) m
  where v.status = 'active' and (v.category_id = w.category_id or w.category_id is null)
  order by v.published_at desc
  limit 500;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.refresh_matches_for_vacancy(p_vacancy_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not (public.is_admin() or public.manages_vacancy(p_vacancy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.matches where vacancy_id = p_vacancy_id;
  insert into public.matches (worker_id, vacancy_id, score, reasons)
  select w.id, p_vacancy_id, m.score, m.reasons
  from public.worker_profiles w
  join public.vacancies v on v.id = p_vacancy_id
  cross join lateral public.compute_match(w.id, p_vacancy_id) m
  where w.is_public and w.status <> 'not_looking' and w.category_id = v.category_id
  order by w.last_active_at desc
  limit 1000;
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- Qidiruv: vakansiyalar (anonim ham ko'ra oladi; moslik faqat worker uchun)
-- =====================================================================
create or replace function public.search_vacancies(
  p_query text default null,
  p_category_id uuid default null,
  p_subcategory_id uuid default null,
  p_region_id uuid default null,
  p_district_ids uuid[] default null,
  p_salary_min int default null,
  p_employment_types public.employment_type[] default null,
  p_schedules public.work_schedule[] default null,
  p_work_format public.work_format default null,
  p_experience_max_months int default null,
  p_is_remote boolean default null,
  p_benefits text[] default null,
  p_verified_only boolean default false,
  p_no_experience boolean default false,
  p_start_today boolean default false,
  p_company_id uuid default null,
  p_sort text default 'relevant',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, slug text, title text, company_id uuid, company_name text, company_logo_url text, company_verified boolean,
  category_id uuid, category_slug text, region_id uuid, region_name_uz text, region_name_ru text,
  district_id uuid, district_name_uz text, district_name_ru text, is_remote boolean,
  salary_from int, salary_to int, salary_type public.salary_type, salary_negotiable boolean,
  employment_type public.employment_type, schedule public.work_schedule, work_time_from time, work_time_to time,
  experience_min_months int, work_format public.work_format, benefits text[],
  published_at timestamptz, expires_at timestamptz, views_count int, applications_count int, is_featured boolean,
  match_score int, match_reasons jsonb, is_saved boolean, has_applied boolean, total_count bigint
)
language plpgsql stable security invoker set search_path = public as $$
declare
  wid uuid := public.current_worker_id();
  q tsquery := case when p_query is null or trim(p_query) = '' then null else plainto_tsquery('public.ishuz', p_query) end;
begin
  return query
  with base as (
    select v.*
    from public.vacancies v
    left join public.companies c on c.id = v.company_id
    where v.status = 'active'
      and (p_category_id is null or v.category_id = p_category_id)
      and (p_subcategory_id is null or v.subcategory_id = p_subcategory_id)
      and (p_region_id is null or v.region_id = p_region_id or v.is_remote)
      and (p_district_ids is null or cardinality(p_district_ids) = 0 or v.district_id = any(p_district_ids) or v.is_remote)
      and (p_salary_min is null or v.salary_negotiable or coalesce(v.salary_to, v.salary_from) >= p_salary_min)
      and (p_employment_types is null or cardinality(p_employment_types) = 0 or v.employment_type = any(p_employment_types))
      and (p_schedules is null or cardinality(p_schedules) = 0 or v.schedule = any(p_schedules))
      and (p_work_format is null or p_work_format = 'any' or v.work_format = p_work_format or v.work_format = 'any')
      and (p_experience_max_months is null or v.experience_min_months <= p_experience_max_months)
      and (not p_no_experience or v.experience_min_months = 0)
      and (p_is_remote is null or v.is_remote = p_is_remote)
      and (not p_verified_only or c.verification_status = 'verified')
      and (p_company_id is null or v.company_id = p_company_id)
      and (p_benefits is null or cardinality(p_benefits) = 0 or not exists (
            select 1 from unnest(p_benefits) b where not exists (
              select 1 from public.vacancy_benefits vb where vb.vacancy_id = v.id and vb.benefit_code = b)))
      and (q is null or v.search_vector @@ q or v.title ilike '%' || p_query || '%' or c.name ilike '%' || p_query || '%')
  ),
  counted as (
    select b.*, count(*) over () as total,
      (b.is_featured and (b.featured_until is null or b.featured_until > now())) as featured_now
    from base b
    order by (b.is_featured and (b.featured_until is null or b.featured_until > now())) desc, b.published_at desc
    limit case when wid is not null and p_sort = 'relevant' then 300 else 100000 end  -- moslik faqat oxirgi 300 ta uchun hisoblanadi
  ),
  scored as (
    select b.*,
      case when wid is not null then m.score end as ms,
      case when wid is not null then m.reasons end as mr,
      case when q is not null then ts_rank(b.search_vector, q) else 0 end as rank
    from counted b
    left join lateral (select * from public.compute_match(wid, b.id)) m on wid is not null
  )
  select
    s.id, s.slug, s.title, s.company_id, c.name, c.logo_url, c.verification_status = 'verified',
    s.category_id, cat.slug, s.region_id, rg.name_uz, rg.name_ru, s.district_id, d.name_uz, d.name_ru, s.is_remote,
    s.salary_from, s.salary_to, s.salary_type, s.salary_negotiable,
    s.employment_type, s.schedule, s.work_time_from, s.work_time_to, s.experience_min_months, s.work_format,
    coalesce((select array_agg(vb.benefit_code order by vb.benefit_code) from public.vacancy_benefits vb where vb.vacancy_id = s.id), '{}'),
    s.published_at, s.expires_at, s.views_count, s.applications_count, s.featured_now,
    s.ms, s.mr,
    (wid is not null and exists (select 1 from public.saved_vacancies sv where sv.worker_id = wid and sv.vacancy_id = s.id)),
    (wid is not null and exists (select 1 from public.applications a where a.worker_id = wid and a.vacancy_id = s.id)),
    s.total
  from scored s
  left join public.companies c on c.id = s.company_id
  left join public.categories cat on cat.id = s.category_id
  left join public.regions rg on rg.id = s.region_id
  left join public.districts d on d.id = s.district_id
  order by
    s.featured_now desc,
    case when p_sort = 'newest' then s.published_at end desc nulls last,
    case when p_sort = 'salary' then coalesce(s.salary_to, s.salary_from, 0) end desc nulls last,
    case when p_sort = 'relevant' then coalesce(s.ms, 0) + s.rank * 20 end desc nulls last,
    s.published_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
end $$;

-- =====================================================================
-- Qidiruv: ishchilar (faqat ish beruvchi yoki admin)
-- =====================================================================
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
    case when p_sort = 'newest' then s.last_active_at end desc nulls last,
    case when p_sort = 'distance' then s.dist end asc nulls last,
    case when p_sort = 'relevant' then coalesce(s.ms, s.completeness) end desc nulls last,
    s.last_active_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
end $$;

-- Ish beruvchi nomzodning to'liq profilini ko'rganda ko'rishlar sonini oshirish
create or replace function public.record_worker_view(p_worker_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.worker_profiles set views_count = views_count + 1
  where id = p_worker_id and profile_id <> auth.uid() and auth.uid() is not null;
$$;

create or replace function public.record_vacancy_view(p_vacancy_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.vacancies set views_count = views_count + 1 where id = p_vacancy_id and status = 'active';
$$;

-- =====================================================================
-- Vakansiya hayot sikli
-- =====================================================================
create or replace function public.publish_vacancy(p_vacancy_id uuid)
returns public.vacancy_status language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  moderation boolean := coalesce((select (value)::boolean from public.app_settings where key = 'vacancy_moderation_enabled'), false);
  new_status public.vacancy_status;
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.category_id is null or (v.region_id is null and not v.is_remote) then
    raise exception 'vacancy_incomplete' using errcode = '23514';
  end if;
  if v.status not in ('draft', 'paused', 'closed', 'expired', 'pending_review', 'rejected') then
    raise exception 'invalid_status' using errcode = '23514';
  end if;
  -- admin yashirgan/rad etgan vakansiya faqat moderatsiya orqali qaytadi
  new_status := case when moderation or v.requires_review then 'pending_review' else 'active' end;
  update public.vacancies
  set status = new_status,
      published_at = case when new_status = 'active' then now() else published_at end,
      expires_at = case when new_status = 'active' then now() + make_interval(days => coalesce((select (value)::int from public.app_settings where key = 'vacancy_lifetime_days'), 30)) else expires_at end
  where id = p_vacancy_id;
  if new_status = 'active' then
    perform public.refresh_matches_for_vacancy(p_vacancy_id);
  end if;
  return new_status;
end $$;

create or replace function public.set_vacancy_status(p_vacancy_id uuid, p_status public.vacancy_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('paused', 'closed', 'draft') then raise exception 'invalid_status' using errcode = '23514'; end if;
  update public.vacancies set status = p_status where id = p_vacancy_id and status in ('active', 'paused', 'pending_review', 'draft', 'expired');
end $$;

-- =====================================================================
-- Arizalar
-- =====================================================================
create or replace function public.apply_to_vacancy(p_vacancy_id uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  wid uuid := public.current_worker_id();
  v public.vacancies;
  m record;
  app_id uuid;
  daily int := coalesce((select (value)::int from public.app_settings where key = 'application_daily_limit'), 30);
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  if wid is null then raise exception 'worker_profile_required' using errcode = '23514'; end if;
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.id is null or v.status <> 'active' then raise exception 'vacancy_not_active' using errcode = '23514'; end if;
  if v.owner_profile_id = auth.uid() then raise exception 'own_vacancy' using errcode = '23514'; end if;
  select id into app_id from public.applications a where a.vacancy_id = p_vacancy_id and a.worker_id = wid;
  if app_id is not null and (select status from public.applications where id = app_id) <> 'withdrawn' then
    raise exception 'already_applied' using errcode = '23505';
  end if;
  if not public.check_rate_limit('apply:' || auth.uid(), daily, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select * into m from public.compute_match(wid, p_vacancy_id);
  if app_id is null then
    insert into public.applications (vacancy_id, worker_id, cover_message, match_score, match_reasons)
    values (p_vacancy_id, wid, nullif(trim(p_message), ''), m.score, m.reasons)
    returning id into app_id;
    insert into public.application_events (application_id, from_status, to_status, actor_id) values (app_id, null, 'sent', auth.uid());
  else
    -- qaytarib olingan ariza qayta yuboriladi
    update public.applications set status = 'sent', cover_message = nullif(trim(p_message), ''), match_score = m.score, match_reasons = m.reasons, viewed_at = null
    where id = app_id;
    insert into public.application_events (application_id, from_status, to_status, actor_id) values (app_id, 'withdrawn', 'sent', auth.uid());
  end if;
  return app_id;
end $$;

create or replace function public.application_stage_rank(s public.application_status)
returns int language sql immutable as $$
  select case s when 'sent' then 1 when 'viewed' then 2 when 'shortlisted' then 3 when 'interview' then 4 when 'offered' then 5 when 'hired' then 6 else 0 end;
$$;

create or replace function public.set_application_status(p_application_id uuid, p_status public.application_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.applications;
  is_employer boolean;
  is_worker boolean;
begin
  select * into a from public.applications where id = p_application_id;
  if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  is_employer := public.can_edit_vacancy(a.vacancy_id);
  is_worker := a.worker_id is not distinct from public.current_worker_id();
  if not (is_employer or is_worker or public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status in ('hired', 'rejected', 'withdrawn') then raise exception 'application_closed' using errcode = '23514'; end if;

  if is_worker and not is_employer then
    if p_status <> 'withdrawn' then raise exception 'forbidden' using errcode = '42501'; end if;
  else
    if p_status not in ('viewed', 'shortlisted', 'interview', 'offered', 'hired', 'rejected') then
      raise exception 'invalid_status' using errcode = '23514';
    end if;
    if p_status = 'viewed' and a.status <> 'sent' then return; end if;
    -- faqat oldinga: sent → viewed → shortlisted → interview → offered → hired (bosqich tashlab o'tish mumkin, orqaga yo'q)
    if p_status <> 'rejected' and public.application_stage_rank(p_status) <= public.application_stage_rank(a.status) then
      raise exception 'invalid_transition' using errcode = '23514';
    end if;
  end if;
  if p_status = a.status then return; end if;

  update public.applications
  set status = p_status, viewed_at = coalesce(viewed_at, case when p_status <> 'sent' then now() end)
  where id = p_application_id;
  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (p_application_id, a.status, p_status, auth.uid(), nullif(trim(p_note), ''));
end $$;

-- =====================================================================
-- Takliflar
-- =====================================================================
create or replace function public.send_offer(
  p_worker_id uuid, p_vacancy_id uuid default null, p_title text default null, p_message text default null,
  p_salary_from int default null, p_salary_to int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  eid uuid := public.current_employer_id();
  v public.vacancies;
  oid uuid;
  daily int := coalesce((select (value)::int from public.app_settings where key = 'offer_daily_limit'), 50);
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  if eid is null then raise exception 'employer_profile_required' using errcode = '23514'; end if;
  if not exists (select 1 from public.worker_profiles w where w.id = p_worker_id and w.is_public) then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;
  if p_vacancy_id is not null then
    if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    select * into v from public.vacancies where id = p_vacancy_id;
    if v.status <> 'active' then raise exception 'vacancy_not_active' using errcode = '23514'; end if;
    if exists (select 1 from public.job_offers o where o.vacancy_id = p_vacancy_id and o.worker_id = p_worker_id and o.status in ('sent', 'viewed')) then
      raise exception 'already_offered' using errcode = '23505';
    end if;
  elsif p_title is null or length(trim(p_title)) < 2 then
    raise exception 'title_required' using errcode = '23514';
  end if;
  if not public.check_rate_limit('offer:' || auth.uid(), daily, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.job_offers (vacancy_id, employer_profile_id, company_id, worker_id, title, message, salary_from, salary_to, expires_at)
  values (p_vacancy_id, auth.uid(), coalesce(v.company_id, (select company_id from public.employer_profiles where id = eid)),
          p_worker_id, coalesce(nullif(trim(p_title), ''), v.title), nullif(trim(p_message), ''),
          coalesce(p_salary_from, v.salary_from), coalesce(p_salary_to, v.salary_to), now() + interval '14 days')
  returning id into oid;
  return oid;
end $$;

create or replace function public.respond_offer(p_offer_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.job_offers;
  app_id uuid;
  prev_status public.application_status;
begin
  select * into o from public.job_offers where id = p_offer_id;
  if o.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.worker_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.status not in ('sent', 'viewed') then raise exception 'offer_closed' using errcode = '23514'; end if;
  if o.expires_at is not null and o.expires_at < now() then
    -- (holatni bu yerda yangilab bo'lmaydi: exception tranzaksiyani qaytaradi; expire_offers() cron bajaradi)
    raise exception 'offer_expired' using errcode = '23514';
  end if;
  update public.job_offers set status = case when p_accept then 'accepted'::public.offer_status else 'declined'::public.offer_status end, responded_at = now() where id = p_offer_id;
  -- Qabul qilingan taklif vakansiya bo'yicha bo'lsa — ariza "offered" holatiga o'tadi (yakunlangan arizalar qayta ochilmaydi)
  if p_accept and o.vacancy_id is not null then
    select id, status into app_id, prev_status from public.applications where vacancy_id = o.vacancy_id and worker_id = o.worker_id;
    if app_id is null then
      insert into public.applications (vacancy_id, worker_id, status, cover_message)
      values (o.vacancy_id, o.worker_id, 'offered', null)
      returning id into app_id;
      insert into public.application_events (application_id, from_status, to_status, actor_id, note)
      values (app_id, null, 'offered', auth.uid(), 'offer_accepted');
    elsif prev_status in ('sent', 'viewed', 'shortlisted', 'interview') then
      update public.applications set status = 'offered' where id = app_id;
      insert into public.application_events (application_id, from_status, to_status, actor_id, note)
      values (app_id, prev_status, 'offered', auth.uid(), 'offer_accepted');
    end if;
  end if;
end $$;

create or replace function public.mark_offer_viewed(p_offer_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.job_offers set status = 'viewed', viewed_at = now()
  where id = p_offer_id and status = 'sent' and worker_id = public.current_worker_id();
$$;

create or replace function public.withdraw_offer(p_offer_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.job_offers set status = 'withdrawn'
  where id = p_offer_id and employer_profile_id = auth.uid() and status in ('sent', 'viewed');
$$;

-- Custom (vakansiyasiz) taklif bo'yicha ishga olindi: sharh va statistika uchun
create or replace function public.mark_offer_hired(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.job_offers; app_id uuid;
begin
  select * into o from public.job_offers where id = p_offer_id;
  if o.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.employer_profile_id is distinct from auth.uid() and not (o.company_id is not null and public.is_company_admin(o.company_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if o.status <> 'accepted' then raise exception 'offer_not_accepted' using errcode = '23514'; end if;
  update public.job_offers set hired_at = now() where id = p_offer_id and hired_at is null;
  if o.vacancy_id is not null then
    select id into app_id from public.applications where vacancy_id = o.vacancy_id and worker_id = o.worker_id and status = 'offered';
    if app_id is not null then perform public.set_application_status(app_id, 'hired', 'offer_hired'); end if;
  end if;
end $$;

-- Muddati o'tgan takliflar (cron)
create or replace function public.expire_offers()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.job_offers set status = 'expired' where status in ('sent', 'viewed') and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- Chat
-- =====================================================================
create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members m where m.conversation_id = p_conversation_id and m.profile_id = auth.uid());
$$;

create or replace function public.get_or_create_conversation(p_application_id uuid default null, p_job_offer_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
  worker_profile uuid;
  employer_profile uuid;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if num_nonnulls(p_application_id, p_job_offer_id) <> 1 then raise exception 'one_source_required' using errcode = '23514'; end if;

  if p_application_id is not null then
    select w.profile_id, v.owner_profile_id into worker_profile, employer_profile
    from public.applications a join public.worker_profiles w on w.id = a.worker_id join public.vacancies v on v.id = a.vacancy_id
    where a.id = p_application_id;
    if worker_profile is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if me <> worker_profile and not public.manages_vacancy((select vacancy_id from public.applications where id = p_application_id)) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select id into cid from public.conversations where application_id = p_application_id;
    if cid is null then
      insert into public.conversations (application_id) values (p_application_id) returning id into cid;
    end if;
  else
    select w.profile_id, o.employer_profile_id into worker_profile, employer_profile
    from public.job_offers o join public.worker_profiles w on w.id = o.worker_id where o.id = p_job_offer_id;
    if worker_profile is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if me not in (worker_profile, employer_profile) then raise exception 'forbidden' using errcode = '42501'; end if;
    select id into cid from public.conversations where job_offer_id = p_job_offer_id;
    if cid is null then
      insert into public.conversations (job_offer_id) values (p_job_offer_id) returning id into cid;
    end if;
  end if;

  insert into public.conversation_members (conversation_id, profile_id) values (cid, worker_profile), (cid, employer_profile)
  on conflict do nothing;
  -- kompaniya a'zosi bo'lsa, u ham qo'shiladi
  if me <> worker_profile and me <> employer_profile then
    insert into public.conversation_members (conversation_id, profile_id) values (cid, me) on conflict do nothing;
  end if;
  return cid;
end $$;

create or replace function public.send_message(
  p_conversation_id uuid, p_type public.message_type default 'text', p_body text default null,
  p_attachment_path text default null, p_attachment_meta jsonb default null,
  p_lat double precision default null, p_lng double precision default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid bigint;
  per_minute int := coalesce((select (value)::int from public.app_settings where key = 'message_minute_limit'), 30);
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation_id and cm.profile_id = me) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation_id and cm.profile_id <> me and cm.is_blocked) then
    raise exception 'blocked_by_member' using errcode = '42501';
  end if;
  if p_type = 'system' then raise exception 'invalid_type' using errcode = '23514'; end if;
  if not public.check_rate_limit('msg:' || me, per_minute, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.messages (conversation_id, sender_id, type, body, attachment_path, attachment_meta, lat, lng)
  values (p_conversation_id, me, p_type, nullif(trim(p_body), ''), p_attachment_path, p_attachment_meta, p_lat, p_lng)
  returning id into mid;
  update public.conversations
  set last_message_at = now(),
      last_message_preview = case p_type when 'text' then left(p_body, 120) when 'image' then '📷' when 'document' then '📎' when 'location' then '📍' when 'voice' then '🎤' else '' end::text
  where id = p_conversation_id;
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation_id and profile_id = me;
  return mid;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation_id and profile_id = auth.uid();
$$;

create or replace function public.set_conversation_block(p_conversation_id uuid, p_blocked boolean)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set is_blocked = p_blocked where conversation_id = p_conversation_id and profile_id = auth.uid();
$$;

-- O'z xabarini o'chirish (yumshoq)
create or replace function public.delete_message(p_message_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.messages set deleted_at = now(), body = null, attachment_path = null, attachment_meta = null, lat = null, lng = null
  where id = p_message_id and sender_id = auth.uid() and deleted_at is null;
$$;

-- Shikoyat (blok + rate limit bilan)
create or replace function public.submit_report(p_target_type public.report_target, p_target_id text, p_reason public.report_reason, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.check_rate_limit('report:' || auth.uid(), 20, 86400) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if exists (select 1 from public.reports r where r.reporter_profile_id = auth.uid() and r.target_type = p_target_type and r.target_id = p_target_id and r.status in ('open', 'in_review')) then
    raise exception 'already_reported' using errcode = '23505';
  end if;
  insert into public.reports (reporter_profile_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  returning id into rid;
  return rid;
end $$;

-- Mening suhbatlarim (ro'yxat uchun)
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
    coalesce(v.title, jo.title),
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
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

-- =====================================================================
-- Bildirishnomalar
-- =====================================================================
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notifications set read_at = now()
  where profile_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.unread_counts()
returns table (notifications bigint, messages bigint, applications bigint, offers bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.notifications n where n.profile_id = auth.uid() and n.read_at is null),
    (select count(*) from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id and cm.profile_id = auth.uid()
       where m.sender_id <> auth.uid() and m.deleted_at is null and m.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)),
    (select count(*) from public.applications a join public.vacancies v on v.id = a.vacancy_id
       where a.status = 'sent' and (v.owner_profile_id = auth.uid() or (v.company_id is not null and public.is_company_member(v.company_id)))),
    (select count(*) from public.job_offers o where o.worker_id = public.current_worker_id() and o.status = 'sent');
$$;

-- =====================================================================
-- Sharhlar (faqat "hired" dan keyin)
-- =====================================================================
create or replace function public.create_review(p_application_id uuid default null, p_rating int default 5, p_text text default null, p_job_offer_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.applications;
  o public.job_offers;
  worker_profile uuid;
  employer_profile uuid;
  target uuid;
  rid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  if num_nonnulls(p_application_id, p_job_offer_id) <> 1 then raise exception 'one_source_required' using errcode = '23514'; end if;
  if not public.check_rate_limit('review:' || auth.uid(), 20, 86400) then raise exception 'rate_limited' using errcode = 'P0001'; end if;

  if p_application_id is not null then
    select * into a from public.applications where id = p_application_id;
    if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if a.status <> 'hired' then raise exception 'review_requires_hire' using errcode = '23514'; end if;
    select w.profile_id into worker_profile from public.worker_profiles w where w.id = a.worker_id;
    select coalesce(v.owner_profile_id, (select m.profile_id from public.company_members m where m.company_id = v.company_id and m.role = 'owner' limit 1))
      into employer_profile from public.vacancies v where v.id = a.vacancy_id;
    if auth.uid() = worker_profile then target := employer_profile;
    elsif public.manages_vacancy(a.vacancy_id) then target := worker_profile;
    else raise exception 'forbidden' using errcode = '42501'; end if;
  else
    select * into o from public.job_offers where id = p_job_offer_id;
    if o.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if o.hired_at is null then raise exception 'review_requires_hire' using errcode = '23514'; end if;
    select w.profile_id into worker_profile from public.worker_profiles w where w.id = o.worker_id;
    employer_profile := o.employer_profile_id;
    if auth.uid() = worker_profile then target := employer_profile;
    elsif auth.uid() = employer_profile then target := worker_profile;
    else raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  if target is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.reviews (author_profile_id, target_profile_id, application_id, job_offer_id, rating, text)
  values (auth.uid(), target, p_application_id, p_job_offer_id, p_rating, nullif(trim(p_text), ''))
  returning id into rid;
  return rid;
end $$;

create or replace function public.profile_rating(p_profile_id uuid)
returns table (avg_rating numeric, reviews_count bigint) language sql stable security definer set search_path = public as $$
  select round(avg(rating)::numeric, 1), count(*) from public.reviews where target_profile_id = p_profile_id and status = 'approved';
$$;

-- =====================================================================
-- Statistika
-- =====================================================================
create or replace function public.employer_dashboard_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  with mine as (
    select v.* from public.vacancies v
    where v.owner_profile_id = auth.uid() or (v.company_id is not null and public.is_company_member(v.company_id))
  )
  select jsonb_build_object(
    'active_vacancies', (select count(*) from mine where status = 'active'),
    'total_vacancies', (select count(*) from mine),
    'applications', (select count(*) from public.applications a where a.vacancy_id in (select id from mine)),
    'new_applications', (select count(*) from public.applications a where a.vacancy_id in (select id from mine) and a.status = 'sent'),
    'views', (select coalesce(sum(views_count), 0) from mine),
    'saved_workers', (select count(*) from public.saved_workers where employer_profile_id = auth.uid()),
    'offers_sent', (select count(*) from public.job_offers where employer_profile_id = auth.uid()),
    'hired', (select count(*) from public.applications a where a.vacancy_id in (select id from mine) and a.status = 'hired')
  );
$$;

create or replace function public.worker_dashboard_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'applications', (select count(*) from public.applications where worker_id = public.current_worker_id()),
    'active_applications', (select count(*) from public.applications where worker_id = public.current_worker_id() and status not in ('hired', 'rejected', 'withdrawn')),
    'offers', (select count(*) from public.job_offers where worker_id = public.current_worker_id() and status in ('sent', 'viewed')),
    'profile_views', (select coalesce(views_count, 0) from public.worker_profiles where id = public.current_worker_id()),
    'saved', (select count(*) from public.saved_vacancies where worker_id = public.current_worker_id()),
    'completeness', (select coalesce(completeness, 0) from public.worker_profiles where id = public.current_worker_id())
  );
$$;

-- Ish qidiruvchi uchun tavsiyalar (kesh + jonli)
create or replace function public.recommended_vacancies(p_limit int default 10)
returns table (vacancy_id uuid, score int, reasons jsonb)
language sql stable security definer set search_path = public as $$
  select m.vacancy_id, m.score, m.reasons
  from public.matches m join public.vacancies v on v.id = m.vacancy_id and v.status = 'active'
  where m.worker_id = public.current_worker_id()
  order by m.score desc, v.published_at desc
  limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.recommended_workers(p_vacancy_id uuid, p_limit int default 10)
returns table (worker_id uuid, score int, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.manages_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select m.worker_id, m.score, m.reasons
  from public.matches m join public.worker_profiles w on w.id = m.worker_id and w.is_public and w.status <> 'not_looking'
  where m.vacancy_id = p_vacancy_id
  order by m.score desc, w.last_active_at desc
  limit greatest(1, least(p_limit, 50));
end $$;

-- =====================================================================
-- Admin RPC (audit bilan)
-- =====================================================================
create or replace function public.admin_set_user_block(p_profile_id uuid, p_block boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare before_row jsonb;
begin
  if not public.has_admin_permission('users.block') then raise exception 'forbidden' using errcode = '42501'; end if;
  select to_jsonb(p) into before_row from public.profiles p where id = p_profile_id;
  update public.profiles set is_blocked = p_block, blocked_reason = case when p_block then p_reason end, blocked_at = case when p_block then now() end
  where id = p_profile_id;
  perform public.write_audit(case when p_block then 'user.block' else 'user.unblock' end, 'profile', p_profile_id::text, before_row, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_set_vacancy_status(p_vacancy_id uuid, p_status public.vacancy_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare before_row jsonb;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('active', 'hidden', 'rejected', 'closed') then raise exception 'invalid_status' using errcode = '23514'; end if;
  select jsonb_build_object('status', status, 'moderation_note', moderation_note) into before_row from public.vacancies where id = p_vacancy_id;
  if p_status = 'active' then
    update public.vacancies
    set status = 'active', moderation_note = p_note, requires_review = false,
        published_at = coalesce(published_at, now()),
        expires_at = case when expires_at is null or expires_at < now() then now() + make_interval(days => coalesce((select (value)::int from public.app_settings where key = 'vacancy_lifetime_days'), 30)) else expires_at end
    where id = p_vacancy_id;
    perform public.refresh_matches_for_vacancy(p_vacancy_id);
  else
    update public.vacancies set status = p_status, moderation_note = p_note, requires_review = (p_status in ('hidden', 'rejected')) where id = p_vacancy_id;
  end if;
  perform public.write_audit('vacancy.' || p_status, 'vacancy', p_vacancy_id::text, before_row, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

create or replace function public.admin_review_verification(p_request_id uuid, p_status public.verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.verification_requests;
begin
  if not public.has_admin_permission('employers.verify') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('verified', 'rejected') then raise exception 'invalid_status' using errcode = '23514'; end if;
  select * into r from public.verification_requests where id = p_request_id;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.verification_requests set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;
  if r.company_id is not null then
    update public.companies set verification_status = p_status, verified_at = case when p_status = 'verified' then now() end where id = r.company_id;
    update public.employer_profiles set verification_status = p_status where company_id = r.company_id;
  elsif r.type in ('identity', 'company', 'tin', 'documents') then
    update public.employer_profiles set verification_status = p_status where profile_id = r.profile_id;
  end if;
  perform public.write_audit('verification.' || p_status, 'verification_request', p_request_id::text, to_jsonb(r), jsonb_build_object('status', p_status, 'note', p_note));
end $$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('reports.resolve') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.reports set status = p_status, resolution_note = p_note, resolved_by = auth.uid() where id = p_report_id;
  perform public.write_audit('report.' || p_status, 'report', p_report_id::text, null, jsonb_build_object('note', p_note));
end $$;

create or replace function public.admin_moderate_review(p_review_id uuid, p_status public.review_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('reviews.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.reviews set status = p_status, moderation_note = p_note, moderated_by = auth.uid() where id = p_review_id;
  perform public.write_audit('review.' || p_status, 'review', p_review_id::text, null, jsonb_build_object('note', p_note));
end $$;

create or replace function public.admin_broadcast(p_title text, p_body text, p_role public.app_role default null, p_link text default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.has_admin_permission('notifications.broadcast') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.notifications (profile_id, type, payload, link)
  select p.id, 'system', jsonb_build_object('title', p_title, 'body', p_body), p_link
  from public.profiles p
  where not p.is_blocked and (p_role is null or exists (select 1 from public.user_roles r where r.profile_id = p.id and r.role = p_role));
  get diagnostics n = row_count;
  perform public.write_audit('notifications.broadcast', 'broadcast', null, null, jsonb_build_object('title', p_title, 'role', p_role, 'count', n));
  return n;
end $$;

-- Admin to'g'ridan-to'g'ri jadval yozuvlari (kategoriya, ko'nikma, hudud, sozlamalar, adminlar) uchun audit
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text default null, p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]+\.[a-z_]+$' then raise exception 'invalid_action' using errcode = '23514'; end if;
  perform public.write_audit(p_action, p_target_type, p_target_id, p_before, p_after);
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_permission('analytics.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'workers', (select count(*) from public.worker_profiles),
    'employers', (select count(*) from public.employer_profiles),
    'verified_employers', (select count(*) from public.companies where verification_status = 'verified'),
    'active_vacancies', (select count(*) from public.vacancies where status = 'active'),
    'pending_vacancies', (select count(*) from public.vacancies where status = 'pending_review'),
    'applications', (select count(*) from public.applications),
    'hires', (select count(*) from public.applications where status = 'hired') + (select count(*) from public.job_offers where hired_at is not null and vacancy_id is null),
    'new_registrations_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'open_reports', (select count(*) from public.reports where status in ('open', 'in_review')),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'dau', (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
    'wau', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'mau', (select count(*) from public.profiles where last_seen_at > now() - interval '30 days')
  );
end $$;

create or replace function public.admin_daily_stats(p_days int default 30)
returns table (day date, registrations bigint, vacancies bigint, applications bigint, hires bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_permission('analytics.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select d::date,
    (select count(*) from public.profiles p where (p.created_at at time zone 'Asia/Tashkent')::date = d::date),
    (select count(*) from public.vacancies v where (v.created_at at time zone 'Asia/Tashkent')::date = d::date),
    (select count(*) from public.applications a where (a.created_at at time zone 'Asia/Tashkent')::date = d::date),
    (select count(*) from public.application_events e where e.to_status = 'hired' and (e.created_at at time zone 'Asia/Tashkent')::date = d::date)
  from generate_series((now() at time zone 'Asia/Tashkent')::date - (greatest(1, least(p_days, 365)) - 1), (now() at time zone 'Asia/Tashkent')::date, interval '1 day') d
  order by 1;
end $$;

-- Foydalanuvchi faolligi
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
  update public.worker_profiles set last_active_at = now() where profile_id = auth.uid() and last_active_at < now() - interval '1 hour';
$$;
