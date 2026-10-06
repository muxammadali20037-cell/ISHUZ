-- ISH BERUVCHI · 0033 · Imkoniyat turi (spec §8, §13) va ish beruvchi turlari (spec §5).
-- Imkoniyat turi bandlik (employment_type) va ish formatidan MUSTAQIL: masofaviy stajirovka yarim kunlik bo'lishi mumkin.

do $$ begin
  create type public.opportunity_type as enum ('job', 'fixed_term', 'one_time', 'seasonal', 'internship', 'practice', 'apprenticeship');
exception when duplicate_object then null; end $$;

alter table public.vacancies add column if not exists opportunity_type public.opportunity_type not null default 'job';
-- Stajirovka/amaliyot/shogirdlikda haq to'lanadimi: null — ko'rsatilmagan (oddiy ishda doim to'lanadi)
alter table public.vacancies add column if not exists is_paid boolean;
-- Talabalarga mos: darsdan keyin / moslashuvchan jadval
alter table public.vacancies add column if not exists student_friendly boolean not null default false;

create index if not exists idx_vacancies_opportunity on public.vacancies(opportunity_type) where status = 'active';
create index if not exists idx_vacancies_student on public.vacancies(student_friendly) where status = 'active' and student_friendly;

-- Haq to'lanmaydigan imkoniyat faqat stajirovka/amaliyot/shogirdlikda bo'lishi mumkin ("haq to'lanmaydi" yashirilmaydi)
do $$ begin
  alter table public.vacancies add constraint vacancies_unpaid_only_learning
    check (is_paid is not false or opportunity_type in ('internship', 'practice', 'apprenticeship'));
exception when duplicate_object then null; end $$;

-- Ish beruvchi turlari: o'zini o'zi band qilgan shaxs va "boshqa" (izoh bilan)
alter type public.employer_type add value if not exists 'self_employed';
alter type public.employer_type add value if not exists 'other';
alter table public.employer_profiles add column if not exists employer_type_note text check (employer_type_note is null or length(employer_type_note) <= 120);

-- Qidiruv: imkoniyat turi va talabalarga moslik filtrlari (natijada ham qaytadi)
drop function if exists public.search_vacancies(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, text, int, int);
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
  p_government_only boolean default false,
  p_opportunity_types public.opportunity_type[] default null,
  p_student_friendly boolean default false,
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
grant execute on function public.search_vacancies(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, text, int, int) to anon, authenticated;
