-- ISH BERUVCHI · 0038 · Soha ichidagi yo'nalishlar bo'yicha vakansiyalar (katta "yo'nalishlar" paneli).
-- search_vacancies_v2 = search_vacancies + p_profession_node_id (tugun va barcha avlodlari).
-- Eski search_vacancies o'zgarmaydi (imzo o'zgarishi drop talab qiladi) — ilova v2 ga o'tadi.

create or replace function public.search_vacancies_v2(
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
  p_government_only boolean default false,
  p_opportunity_types public.opportunity_type[] default null,
  p_student_friendly boolean default false,
  p_profession_node_id uuid default null,
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
  published_at timestamptz, expires_at timestamptz, views_count int, applications_count int, is_featured boolean, is_government boolean,
  match_score int, match_reasons jsonb, is_saved boolean, has_applied boolean,
  opportunity_type public.opportunity_type, is_paid boolean, student_friendly boolean, total_count bigint
)
language plpgsql stable security invoker set search_path = public as $$
declare
  wid uuid := public.current_worker_id();
  q tsquery := case when p_query is null or trim(p_query) = '' then null else plainto_tsquery('public.ishuz', p_query) end;
  -- Tanlangan yo'nalish va uning barcha ichki kasblari (masalan: Shifokorlar → kardiolog, pediatr, ...)
  node_ids uuid[] := case when p_profession_node_id is null then null else (
    with recursive d as (
      select n.id from public.profession_nodes n where n.id = p_profession_node_id
      union all
      select c.id from public.profession_nodes c join d on c.parent_id = d.id
    ) select array_agg(d.id) from d) end;
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
      and (p_salary_min is null or v.salary_negotiable or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) >= p_salary_min)
      and (p_employment_types is null or cardinality(p_employment_types) = 0 or v.employment_type = any(p_employment_types))
      and (p_schedules is null or cardinality(p_schedules) = 0 or v.schedule = any(p_schedules))
      and (p_work_format is null or p_work_format = 'any' or v.work_format = p_work_format or v.work_format = 'any')
      and (p_experience_max_months is null or v.experience_min_months <= p_experience_max_months)
      and (not p_no_experience or v.experience_min_months = 0)
      and (p_is_remote is null or v.is_remote = p_is_remote)
      and (not p_verified_only or c.verification_status = 'verified')
      and (p_company_id is null or v.company_id = p_company_id)
      and (not p_government_only or v.is_government)
      and (p_opportunity_types is null or cardinality(p_opportunity_types) = 0 or v.opportunity_type = any(p_opportunity_types))
      and (node_ids is null or v.profession_node_id = any(node_ids))
      and (not p_student_friendly or v.student_friendly or v.opportunity_type in ('internship', 'practice', 'apprenticeship'))
      and (p_benefits is null or cardinality(p_benefits) = 0 or not exists (
            select 1 from unnest(p_benefits) b where not exists (
              select 1 from public.vacancy_benefits vb where vb.vacancy_id = v.id and vb.benefit_code = b)))
      and (q is null or v.search_vector @@ q or v.title ilike '%' || p_query || '%' or c.name ilike '%' || p_query || '%')
  ),
  counted as (
    select b.*,
      (b.is_featured and (b.featured_until is null or b.featured_until > now())) as featured_now
    from base b
    order by (b.is_featured and (b.featured_until is null or b.featured_until > now())) desc, b.published_at desc
    limit case when wid is not null and p_sort = 'relevant' then 300 else 100000 end  -- moslik faqat oxirgi 300 ta uchun hisoblanadi
  ),
  scored as (
    select b.*,
      case when wid is not null then m.score end as ms,
      case when wid is not null then m.reasons end as mr,
      case when q is not null then ts_rank(b.search_vector, q) else 0 end as rank,
      count(*) over () as total  -- total_count limitdan keyin: sahifalar soni real natijaga mos
    from counted b
    left join lateral (select * from public.compute_match(wid, b.id)) m on wid is not null
  )
  select
    s.id, s.slug, s.title, s.company_id, c.name, c.logo_url, c.verification_status = 'verified',
    s.category_id, cat.slug, s.region_id, rg.name_uz, rg.name_ru, s.district_id, d.name_uz, d.name_ru, s.is_remote,
    s.salary_from, s.salary_to, s.salary_type, s.salary_negotiable,
    s.employment_type, s.schedule, s.work_time_from, s.work_time_to, s.experience_min_months, s.work_format,
    coalesce((select array_agg(vb.benefit_code order by vb.benefit_code) from public.vacancy_benefits vb where vb.vacancy_id = s.id), '{}'),
    s.published_at, s.expires_at, s.views_count, s.applications_count, s.featured_now, s.is_government,
    s.ms, s.mr,
    (wid is not null and exists (select 1 from public.saved_vacancies sv where sv.worker_id = wid and sv.vacancy_id = s.id)),
    (wid is not null and exists (select 1 from public.applications a where a.worker_id = wid and a.vacancy_id = s.id)),
    s.opportunity_type, s.is_paid, s.student_friendly,
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
grant execute on function public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int) to anon, authenticated;

-- Yo'nalishlar paneli: soha (yoki yo'nalish) ichidagi bevosita bolalar + har birida nechta faol vakansiya bor (avlodlari bilan)
create or replace function public.profession_direction_counts(p_category_id uuid, p_parent_id uuid default null)
returns table (id uuid, slug text, name_uz text, name_ru text, name_en text, icon text, kind text, has_children boolean, vacancies bigint, sort_order int)
language sql stable security invoker set search_path = public as $$
  with recursive kids as (
    select n.id, n.slug, n.name_uz, n.name_ru, n.name_en, n.icon, n.kind::text as kind, n.sort_order
    from public.profession_nodes n
    where n.is_active and n.category_id = p_category_id
      and ((p_parent_id is null and n.parent_id is null) or n.parent_id = p_parent_id)
  ),
  tree as (
    select k.id as root, k.id as node from kids k
    union all
    select t.root, c.id from public.profession_nodes c join tree t on c.parent_id = t.node where c.is_active
  )
  select k.id, k.slug, k.name_uz, k.name_ru, k.name_en, k.icon, k.kind,
    exists (select 1 from public.profession_nodes c where c.parent_id = k.id and c.is_active) as has_children,
    (select count(*) from public.vacancies v where v.status = 'active' and v.profession_node_id in (select t.node from tree t where t.root = k.id)) as vacancies,
    k.sort_order
  from kids k
  order by vacancies desc, k.sort_order, k.name_uz;
$$;
grant execute on function public.profession_direction_counts(uuid, uuid) to anon, authenticated;


-- Nomzodlar qidiruvi: search_workers + p_profession_node_id (asosiy yoki qo'shimcha kasbi shu yo'nalishda)
CREATE OR REPLACE FUNCTION public.search_workers_v2(p_query text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_subcategory_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_ids uuid[] DEFAULT NULL::uuid[], p_experience_min_months integer DEFAULT NULL::integer, p_salary_max integer DEFAULT NULL::integer, p_schedules work_schedule[] DEFAULT NULL::work_schedule[], p_employment_types employment_type[] DEFAULT NULL::employment_type[], p_work_format work_format DEFAULT NULL::work_format, p_gender gender DEFAULT NULL::gender, p_education_min education_level DEFAULT NULL::education_level, p_language_codes text[] DEFAULT NULL::text[], p_skill_ids uuid[] DEFAULT NULL::uuid[], p_statuses worker_status[] DEFAULT NULL::worker_status[], p_availability availability[] DEFAULT NULL::availability[], p_has_portfolio boolean DEFAULT false, p_verified_only boolean DEFAULT false, p_remote boolean DEFAULT NULL::boolean, p_vacancy_id uuid DEFAULT NULL::uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_max_distance_km double precision DEFAULT NULL::double precision, p_profession_node_id uuid DEFAULT NULL::uuid, p_sort text DEFAULT 'relevant'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, first_name text, last_initial text, avatar_url text, headline text, category_id uuid, category_name_uz text, category_name_ru text, subcategory_name_uz text, subcategory_name_ru text, region_name_uz text, region_name_ru text, district_name_uz text, district_name_ru text, experience_level experience_level, status worker_status, work_format work_format, remote_preference remote_preference, salary_min integer, salary_expected integer, salary_type salary_type, employment_types employment_type[], schedules work_schedule[], availability availability, skills jsonb, languages jsonb, completeness integer, has_portfolio boolean, phone_verified boolean, match_score integer, match_reasons jsonb, distance_km double precision, is_saved boolean, last_active_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  -- Tanlangan yo'nalish va uning barcha ichki kasblari
  node_ids uuid[] := case when p_profession_node_id is null then null else (
    with recursive d as (
      select n.id from public.profession_nodes n where n.id = p_profession_node_id
      union all
      select c.id from public.profession_nodes c join d on c.parent_id = d.id
    ) select array_agg(d.id) from d) end;
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
      and (node_ids is null or w.profession_node_id = any(node_ids)
           or exists (select 1 from public.worker_professions wp where wp.worker_id = w.id and wp.node_id = any(node_ids)))
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
end $function$;
revoke execute on function public.search_workers_v2(text, uuid, uuid, uuid, uuid[], integer, integer, public.work_schedule[], public.employment_type[], public.work_format, public.gender, public.education_level, text[], uuid[], public.worker_status[], public.availability[], boolean, boolean, boolean, uuid, double precision, double precision, double precision, uuid, text, integer, integer) from public, anon;
grant execute on function public.search_workers_v2(text, uuid, uuid, uuid, uuid[], integer, integer, public.work_schedule[], public.employment_type[], public.work_format, public.gender, public.education_level, text[], uuid[], public.worker_status[], public.availability[], boolean, boolean, boolean, uuid, double precision, double precision, double precision, uuid, text, integer, integer) to authenticated;

-- Nomzodlar uchun yo'nalishlar paneli: har yo'nalishda nechta ochiq nomzod (avlodlari bilan)
create or replace function public.profession_direction_worker_counts(p_category_id uuid, p_parent_id uuid default null)
returns table (id uuid, slug text, name_uz text, name_ru text, name_en text, icon text, kind text, has_children boolean, workers bigint, sort_order int)
language sql stable security invoker set search_path = public as $$
  with recursive kids as (
    select n.id, n.slug, n.name_uz, n.name_ru, n.name_en, n.icon, n.kind::text as kind, n.sort_order
    from public.profession_nodes n
    where n.is_active and n.category_id = p_category_id
      and ((p_parent_id is null and n.parent_id is null) or n.parent_id = p_parent_id)
  ),
  tree as (
    select k.id as root, k.id as node from kids k
    union all
    select t.root, c.id from public.profession_nodes c join tree t on c.parent_id = t.node where c.is_active
  )
  select k.id, k.slug, k.name_uz, k.name_ru, k.name_en, k.icon, k.kind,
    exists (select 1 from public.profession_nodes c where c.parent_id = k.id and c.is_active) as has_children,
    (select count(distinct w.id) from public.worker_profiles w
       where w.is_public and w.onboarding_completed_at is not null
         and (w.profession_node_id in (select t.node from tree t where t.root = k.id)
              or exists (select 1 from public.worker_professions wp where wp.worker_id = w.id and wp.node_id in (select t.node from tree t where t.root = k.id)))) as workers,
    k.sort_order
  from kids k
  order by workers desc, k.sort_order, k.name_uz;
$$;
grant execute on function public.profession_direction_worker_counts(uuid, uuid) to authenticated;
