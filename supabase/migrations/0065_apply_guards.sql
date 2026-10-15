-- =====================================================================
-- 0065 · Ariza qo'riqlari va xavfsizlik sozlamasi (R-D/E)
--  1) apply_to_vacancy: muddati o'tgan (cron hali yopmagan) vakansiyaga ham ariza yo'q (avval faqat status tekshirilardi).
--  2) respond_offer: vakansiya bo'yicha taklifni qabul qilish — vakansiya ochiq bo'lsagina (yopilgan/muddati o'tganiga ariza
--     yaratilmaydi); rad etish har doim mumkin.
--  3) Qidiruv (simple_search_vacancies, _v2, search_vacancies_v2): muddati o'tgan e'lonlar ko'rsatilmaydi (pg_cron bo'lmasa ham).
--  4) app_settings: admin MFA talabini faqat adminlarni boshqaruvchi (admins.manage) o'zgartiradi.
-- Faqat "create or replace" (drop yo'q, ma'lumot o'zgarmaydi). Qaytarish: 0008/0055/0060/0045 dagi ta'riflarni qayta qo'llash,
-- trigger'ni o'chirish.
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
  -- muddati o'tgan (cron hali yopmagan) vakansiya ham yopiq hisoblanadi
  if v.id is null or v.status <> 'active' or (v.expires_at is not null and v.expires_at <= now()) then
    raise exception 'vacancy_not_active' using errcode = '23514';
  end if;
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
  -- qabul: vakansiya bo'yicha taklif — vakansiya hali ochiq bo'lishi kerak (yopilgan/muddati o'tganiga ariza yaratilmaydi);
  -- rad etish har doim mumkin
  if p_accept and o.vacancy_id is not null and not exists (
    select 1 from public.vacancies v
    where v.id = o.vacancy_id and v.status in ('active', 'paused') and (v.expires_at is null or v.expires_at > now())
  ) then
    raise exception 'vacancy_not_active' using errcode = '23514';
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

create or replace function public.simple_search_vacancies(
  p_profession_node_id uuid default null,
  p_region_id uuid default null,
  p_district_id uuid default null,
  p_remote boolean default false,
  p_salary_min int default null,
  p_schedule public.work_schedule default null,
  p_no_experience boolean default false,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean,
  profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text,
  category_slug text, category_icon text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  region_wide boolean, is_remote boolean,
  salary_from int, salary_to int, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, work_time_from time, work_time_to time, experience_min_months int,
  summary text, phone text, published_at timestamptz, is_featured boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with matched as (
    -- kasb tanlanmagan: barcha faol (ids is null — bir martalik shart, tarmoq kerak bo'lmasa o'tkazib yuboriladi)
    select v.* from public.vacancies v
    where ids is null and v.status = 'active' and (v.expires_at is null or v.expires_at > now())
    union all
    -- kasb va uning ichidagi kasblar: idx_vacancies_node
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id = any(ids)
    union all
    -- eski e'lonlar (kasb tuguni yo'q): nomi aynan shu kasb nomini o'z ichiga olsa
    select v.* from public.vacancies v
    where ids is not null and node.id is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id is null
      and (lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')
  ),
  base as (
    select m.id as vid, m.published_at as pub,
      (m.is_featured and (m.featured_until is null or m.featured_until > now())) as featured_now,
      (p_district_id is not null and m.district_id is null) as wide
    from matched m
    where (case when p_remote then m.is_remote
                else (p_region_id is null or m.region_id = p_region_id)
                     and (p_district_id is null or m.district_id = p_district_id or m.district_id is null) end)
      and (p_salary_min is null or m.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(m.salary_to, m.salary_from), m.salary_type) >= p_salary_min)
      and (p_schedule is null or m.schedule = p_schedule)
      and (not p_no_experience or m.experience_min_months = 0)
    order by featured_now desc, wide asc, m.published_at desc nulls last, m.id
    limit 5000
  ),
  page as (
    select b.*, count(*) over () as total from base b
    order by b.featured_now desc, b.wide asc, b.pub desc nulls last, b.vid
    limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950))
  )
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    pg.wide, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    case
      when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
      else coalesce(co.phone, case when auth.uid() is not null then ep.contact_phone end)
    end,
    c.published_at, pg.featured_now, pg.total
  from page pg
  join public.vacancies c on c.id = pg.vid
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  order by pg.featured_now desc, pg.wide asc, pg.pub desc nulls last, pg.vid;
end $$;

create or replace function public.simple_search_vacancies_v2(
  p_profession_node_id uuid default null,
  p_region_id uuid default null,
  p_district_id uuid default null,
  p_remote boolean default false,
  p_salary_min int default null,
  p_schedule public.work_schedule default null,
  p_no_experience boolean default false,
  p_limit int default 20,
  p_offset int default 0,
  p_salary_type public.salary_type default null
)
returns table (
  id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean,
  profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text,
  category_slug text, category_icon text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  region_wide boolean, is_remote boolean,
  salary_from int, salary_to int, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, work_time_from time, work_time_to time, experience_min_months int,
  summary text, phone text, published_at timestamptz, is_featured boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with matched as (
    select v.* from public.vacancies v
    where ids is null and v.status = 'active' and (v.expires_at is null or v.expires_at > now())
    union all
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id = any(ids)
    union all
    select v.* from public.vacancies v
    where ids is not null and node.id is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id is null
      and (lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')
  ),
  base as (
    select m.id as vid, m.published_at as pub,
      (m.is_featured and (m.featured_until is null or m.featured_until > now())) as featured_now,
      (p_district_id is not null and m.district_id is null) as wide
    from matched m
    where (case when p_remote then m.is_remote
                else (p_region_id is null or m.region_id = p_region_id)
                     and (p_district_id is null or m.district_id = p_district_id or m.district_id is null) end)
      and (p_salary_min is null or m.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(m.salary_to, m.salary_from), m.salary_type) >= p_salary_min)
      and (p_schedule is null or m.schedule = p_schedule)
      and (not p_no_experience or m.experience_min_months = 0)
      and (p_salary_type is null or m.salary_type = p_salary_type)
    order by featured_now desc, wide asc, m.published_at desc nulls last, m.id
    limit 5000
  ),
  page as (
    select b.*, count(*) over () as total from base b
    order by b.featured_now desc, b.wide asc, b.pub desc nulls last, b.vid
    limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950))
  )
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    pg.wide, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    case
      when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
      else coalesce(co.phone, case when auth.uid() is not null then ep.contact_phone end)
    end,
    c.published_at, pg.featured_now, pg.total
  from page pg
  join public.vacancies c on c.id = pg.vid
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  order by pg.featured_now desc, pg.wide asc, pg.pub desc nulls last, pg.vid;
end $$;

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
    where v.status = 'active' and (v.expires_at is null or v.expires_at > now())
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
    -- indeks bo'yicha eng yangi 10 000 tasi; TOP (featured) yakuniy saralashda baribir birinchi
    order by b.published_at desc
    limit case when wid is not null and p_sort = 'relevant' then 300 else 10000 end  -- moslik faqat oxirgi 300 ta uchun hisoblanadi
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

create or replace function public.app_settings_guard_security()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- server (service role, auth.uid() yo'q) va migratsiyalar cheklanmaydi; admin panelidan — faqat admins.manage
  if new.key = 'admin_mfa_required' and new.value is distinct from old.value
     and auth.uid() is not null and not public.has_admin_permission('admins.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace trigger trg_app_settings_guard_security before update on public.app_settings
  for each row execute function public.app_settings_guard_security();
