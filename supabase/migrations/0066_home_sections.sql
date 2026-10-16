-- 0066 · Bosh sahifa bo'limlari (S2, Yandex Go uslubida): har bo'lim — haqiqiy son va shu bo'lim bo'yicha qidiruv.
--  1) simple_search_vacancies_v3: v2 + ish beruvchi turi (kompaniya/MChJ, YaTT, jismoniy shaxs, davlat), TOP, ommaviy (5+ o'rin)
--  2) vacancy_section_counts: hudud bo'yicha bo'lim sonlari (bitta o'tishda)
--  3) simple_search_workers_v2: v1 + "kunlik ishchilar" (kunlik to'lov istagi yoki bugun/ertaga tayyor)
--  4) worker_section_counts: ishchilar bo'limlari sonlari
-- Faqat YANGI nomli funksiyalar: eski chaqiruvlar o'zgarmaydi, drop yo'q. 0065 dan keyin qo'llanadi
-- (muddati o'tgan e'lonlar hech bir bo'limda hisoblanmaydi — qidiruv bilan bir xil qoida).

-- Vakansiya kimdan: davlat belgisi ustun; aks holda ish beruvchi profilidagi tur; profil turi yo'q, lekin kompaniyaga
-- bog'langan — kompaniya. "MChJ" alohida yuridik shakl sifatida saqlanmaydi: kompaniyalar (company) bo'limi.
create or replace function public.vacancy_employer_kind(p_is_government boolean, p_employer_type public.employer_type, p_company_id uuid)
returns public.employer_type language sql immutable set search_path = public as $$
  select case
    when p_is_government then 'government'::public.employer_type
    else coalesce(p_employer_type, case when p_company_id is not null then 'company'::public.employer_type end)
  end;
$$;

create or replace function public.simple_search_vacancies_v3(
  p_profession_node_id uuid default null,
  p_region_id uuid default null,
  p_district_id uuid default null,
  p_remote boolean default false,
  p_salary_min int default null,
  p_schedule public.work_schedule default null,
  p_no_experience boolean default false,
  p_limit int default 20,
  p_offset int default 0,
  p_salary_type public.salary_type default null,
  p_employer_type public.employer_type default null,
  p_featured boolean default false,
  p_mass boolean default false
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
    left join public.employer_profiles kp on kp.profile_id = m.owner_profile_id
    where (case when p_remote then m.is_remote
                else (p_region_id is null or m.region_id = p_region_id)
                     and (p_district_id is null or m.district_id = p_district_id or m.district_id is null) end)
      and (p_salary_min is null or m.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(m.salary_to, m.salary_from), m.salary_type) >= p_salary_min)
      and (p_schedule is null or m.schedule = p_schedule)
      and (not p_no_experience or m.experience_min_months = 0)
      and (p_salary_type is null or m.salary_type = p_salary_type)
      and (p_employer_type is null or public.vacancy_employer_kind(m.is_government, kp.employer_type, m.company_id) = p_employer_type)
      and (not p_featured or (m.is_featured and (m.featured_until is null or m.featured_until > now())))
      and (not p_mass or m.positions_count >= 5)
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

-- Bo'lim sonlari: faqat faol, muddati o'tmagan e'lonlar (qidiruvdagi bilan bir xil). Masofaviy — hududdan qat'i nazar.
-- Faqat yig'ma son qaytaradi (shaxsiy ma'lumot yo'q) — mehmon ham ko'radi.
create or replace function public.vacancy_section_counts(p_region_id uuid default null, p_district_id uuid default null)
returns table (
  total bigint, today bigint, daily bigint, remote bigint, no_experience bigint,
  company bigint, entrepreneur bigint, person bigint, government bigint, featured bigint, mass bigint
)
language sql stable security definer set search_path = public as $$
  with act as (
    select v.published_at, v.salary_type, v.is_remote, v.experience_min_months, v.positions_count,
      (v.is_featured and (v.featured_until is null or v.featured_until > now())) as featured_now,
      public.vacancy_employer_kind(v.is_government, kp.employer_type, v.company_id) as kind,
      ((p_region_id is null or v.region_id = p_region_id)
        and (p_district_id is null or v.district_id = p_district_id or v.district_id is null)) as here
    from public.vacancies v
    left join public.employer_profiles kp on kp.profile_id = v.owner_profile_id
    where v.status = 'active' and (v.expires_at is null or v.expires_at > now())
  )
  select
    count(*) filter (where here),
    count(*) filter (where here and published_at >= (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent')),
    count(*) filter (where here and salary_type = 'daily'),
    count(*) filter (where is_remote),
    count(*) filter (where here and experience_min_months = 0),
    count(*) filter (where here and kind = 'company'),
    count(*) filter (where here and kind = 'individual_entrepreneur'),
    count(*) filter (where here and kind = 'person'),
    count(*) filter (where here and kind = 'government'),
    count(*) filter (where here and featured_now),
    count(*) filter (where here and positions_count >= 5)
  from act;
$$;

-- Ishchilar: v1 + p_daily — kunlik to'lov istagi yoki bugun/ertaga ishga chiqa oladi (worker_preferences)
create or replace function public.simple_search_workers_v2(
  p_profession_node_id uuid default null,
  p_region_id uuid default null,
  p_district_id uuid default null,
  p_remote boolean default false,
  p_experienced boolean default false,
  p_limit int default 20,
  p_offset int default 0,
  p_daily boolean default false
)
returns table (
  id uuid, first_name text, last_initial text, avatar_url text, headline text,
  profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text,
  category_slug text, category_icon text, about text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  region_wide boolean, remote_ok boolean, experience_level public.experience_level, salary_expected int,
  phone text, last_active_at timestamptz, is_promoted boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with base as (
    select w.*,
      (w.promoted_until is not null and w.promoted_until > now()) as promoted_now,
      (p_district_id is not null and w.district_id is null) as wide
    from public.worker_profiles w
    join public.profiles pf on pf.id = w.profile_id
    where w.is_public and w.onboarding_completed_at is not null and not pf.is_blocked and w.status <> 'not_looking'
      and (ids is null or w.profession_node_id = any(ids)
           or (w.profession_node_id is null and node.id is not null
               and (lower(coalesce(w.headline, '')) like '%' || lower(node.name_uz) || '%' or lower(coalesce(w.headline, '')) like '%' || lower(node.name_ru) || '%')))
      and (case when p_remote then w.remote_preference = 'yes'
                else (p_region_id is null or w.region_id = p_region_id)
                     and (p_district_id is null or w.district_id = p_district_id or w.district_id is null
                          or exists (select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = p_district_id)) end)
      and (not p_experienced or w.experience_level not in ('none', 'lt_6m'))
      and (not p_daily or exists (select 1 from public.worker_preferences dp where dp.worker_id = w.id
                                  and (dp.salary_type = 'daily' or dp.availability in ('today', 'tomorrow'))))
    order by promoted_now desc, wide asc, w.last_active_at desc nulls last
    limit 5000
  ),
  counted as (select b.*, count(*) over () as total from base b)
  select c.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, c.headline,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    left(regexp_replace(coalesce(c.about, ''), '\s+', ' ', 'g'), 220),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    c.wide, c.remote_preference = 'yes', c.experience_level, pr.salary_expected,
    case when pc.phone_visibility = 'everyone' or (auth.uid() is not null and public.can_view_phone(c.profile_id)) then pc.phone end,
    c.last_active_at, c.promoted_now, c.total
  from counted c
  join public.profiles pf on pf.id = c.profile_id
  left join public.profile_contacts pc on pc.profile_id = c.profile_id
  left join public.worker_preferences pr on pr.worker_id = c.id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  order by c.promoted_now desc, c.wide asc, c.last_active_at desc nulls last
  limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950));
end $$;

-- Ishchilar bo'limlari soni: qidiruvda ko'rinadiganlar (ochiq, onboarding tugagan, bloklanmagan, "izlamayapman" emas)
create or replace function public.worker_section_counts(p_region_id uuid default null, p_district_id uuid default null)
returns table (total bigint, daily bigint, experienced bigint, remote bigint)
language sql stable security definer set search_path = public as $$
  with vis as (
    select w.id, w.experience_level, w.remote_preference,
      ((p_region_id is null or w.region_id = p_region_id)
        and (p_district_id is null or w.district_id = p_district_id or w.district_id is null
             or exists (select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = p_district_id))) as here,
      exists (select 1 from public.worker_preferences dp where dp.worker_id = w.id
              and (dp.salary_type = 'daily' or dp.availability in ('today', 'tomorrow'))) as daily
    from public.worker_profiles w
    join public.profiles pf on pf.id = w.profile_id
    where w.is_public and w.onboarding_completed_at is not null and not pf.is_blocked and w.status <> 'not_looking'
  )
  select
    count(*) filter (where here),
    count(*) filter (where here and daily),
    count(*) filter (where here and experience_level not in ('none', 'lt_6m')),
    count(*) filter (where remote_preference = 'yes')
  from vis;
$$;

revoke execute on function public.vacancy_employer_kind(boolean, public.employer_type, uuid) from public;
revoke execute on function public.simple_search_vacancies_v3(uuid, uuid, uuid, boolean, int, public.work_schedule, boolean, int, int, public.salary_type, public.employer_type, boolean, boolean) from public;
revoke execute on function public.vacancy_section_counts(uuid, uuid) from public;
revoke execute on function public.simple_search_workers_v2(uuid, uuid, uuid, boolean, boolean, int, int, boolean) from public;
revoke execute on function public.worker_section_counts(uuid, uuid) from public;
grant execute on function public.vacancy_employer_kind(boolean, public.employer_type, uuid) to anon, authenticated;
grant execute on function public.simple_search_vacancies_v3(uuid, uuid, uuid, boolean, int, public.work_schedule, boolean, int, int, public.salary_type, public.employer_type, boolean, boolean) to anon, authenticated;
grant execute on function public.vacancy_section_counts(uuid, uuid) to anon, authenticated;
grant execute on function public.simple_search_workers_v2(uuid, uuid, uuid, boolean, boolean, int, int, boolean) to anon, authenticated;
grant execute on function public.worker_section_counts(uuid, uuid) to anon, authenticated;
