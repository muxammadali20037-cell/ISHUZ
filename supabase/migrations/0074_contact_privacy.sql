-- 0074 · Aloqa maxfiyligi (2026-11, audit: anonim telefon yig'ish va admin rollari telefon ko'rishi).
--
--   1. Qidiruv ro'yxatlari (simple_search_vacancies v1/v2/v3, simple_search_workers v1/v2) endi telefon qaytarmaydi.
--      Avval anonim so'rov bir chaqiruvda 50 tagacha raqam olardi (offset 4950 gacha, cheklovsiz) — ommaviy yig'ish yo'li.
--      Funksiya imzolari va qaytaradigan ustunlar o'zgarmaydi: `phone` ustuni bor, lekin har doim null.
--   2. Raqam faqat bitta e'lon sahifasida ochiladi (simple_vacancy_phone, simple_worker_listing) va faqat:
--      kirgan, faol foydalanuvchiga · avvalgi ko'rinish qoidalari bajarilganda · soatiga 40 / sutkasiga 150 ta turli
--      e'lon limiti ichida (contact_reveals jurnali). Egasi va `users.contacts` huquqli admin limitga kirmaydi.
--      Bir e'lonning raqamini 24 soat ichida qayta ko'rish limitni sarflamaydi.
--   3. telegram_accounts.phone / phone_shared_at ustunlari foydalanuvchi sessiyasidan (anon, authenticated) o'qilmaydi.
--      Avval `telegram_own` siyosati har qanday admin rolga (support, analyst ham) raqamni ochardi. Ilova bu ustunlarni
--      faqat server kaliti (service role) bilan o'qiydi, shuning uchun hech narsa buzilmaydi.
--      DIQQAT: jadvalga yangi ustun qo'shilsa, uni pastdagi grant ro'yxatiga ham qo'shing.
--
--   Qaytarish (rollback): supabase/rollbacks/0074_contact_privacy.down.sql

-- ---------------------------------------------------------------- 2a. reveal jurnali va limit
create table if not exists public.contact_reveals (
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_kind       text not null check (target_kind in ('vacancy', 'worker')),
  target_id         uuid not null,
  revealed_at       timestamptz not null default now(),
  primary key (viewer_profile_id, target_kind, target_id)
);
create index if not exists idx_contact_reveals_viewer_time on public.contact_reveals (viewer_profile_id, revealed_at desc);
alter table public.contact_reveals enable row level security;
-- siyosat yo'q: jadvalga faqat security definer funksiyalar yozadi/o'qiydi
revoke all on public.contact_reveals from public, anon, authenticated;

create or replace function public.contact_reveal_allowed(p_kind text, p_target uuid, p_owner uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  last_at timestamptz;
  per_hour int;
  per_day int;
begin
  if viewer is null then return false; end if;
  if not public.is_active_user() then return false; end if;
  if viewer = p_owner or public.has_admin_permission('users.contacts') then return true; end if;

  select revealed_at into last_at from public.contact_reveals
   where viewer_profile_id = viewer and target_kind = p_kind and target_id = p_target;
  if last_at is not null and last_at > now() - interval '24 hours' then return true; end if;

  select count(*) filter (where revealed_at > now() - interval '1 hour'), count(*)
    into per_hour, per_day
    from public.contact_reveals
   where viewer_profile_id = viewer and revealed_at > now() - interval '24 hours';
  if per_hour >= 40 or per_day >= 150 then return false; end if;

  insert into public.contact_reveals (viewer_profile_id, target_kind, target_id, revealed_at)
  values (viewer, p_kind, p_target, now())
  on conflict (viewer_profile_id, target_kind, target_id) do update set revealed_at = excluded.revealed_at;
  return true;
end $$;
revoke execute on function public.contact_reveal_allowed(text, uuid, uuid) from public, anon, authenticated;

-- eski yozuvlar (30 kundan eski) — limit faqat 24 soatga qaraydi
create or replace function public.purge_contact_reveals() returns int
language sql volatile security definer set search_path = public as $$
  with d as (delete from public.contact_reveals where revealed_at < now() - interval '30 days' returning 1) select count(*)::int from d;
$$;
revoke execute on function public.purge_contact_reveals() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ishuz-contact-reveals-purge';
    perform cron.schedule('ishuz-contact-reveals-purge', '17 22 * * *', 'select public.purge_contact_reveals()');
  end if;
end $$;

-- ---------------------------------------------------------------- 2b. vakansiya sahifasidagi raqam
create or replace function public.simple_vacancy_phone(p_vacancy_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_owner uuid;
  v_phone text;
begin
  select v.owner_profile_id,
    case
      when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
      else coalesce(co.phone, ep.contact_phone)
    end
  into v_owner, v_phone
  from public.vacancies v
  left join public.vacancy_contacts vc on vc.vacancy_id = v.id
  left join public.companies co on co.id = v.company_id
  left join public.employer_profiles ep on ep.profile_id = v.owner_profile_id
  where v.id = p_vacancy_id and v.status = 'active';

  if v_phone is null then return null; end if;
  if not public.contact_reveal_allowed('vacancy', p_vacancy_id, v_owner) then return null; end if;
  return v_phone;
end $$;
revoke execute on function public.simple_vacancy_phone(uuid) from public;
grant execute on function public.simple_vacancy_phone(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- 2c. ishchi e'loni sahifasi
CREATE OR REPLACE FUNCTION public.simple_worker_listing(p_id uuid)
 RETURNS TABLE(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, remote_ok boolean, experience_level experience_level, salary_expected integer, schedules work_schedule[], phone text, is_owner boolean, is_listed boolean, last_active_at timestamp with time zone)
 LANGUAGE sql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, w.headline,
    w.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon), w.about,
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    w.remote_preference = 'yes', w.experience_level, pr.salary_expected, coalesce(pr.schedules, '{}'),
    case when pc.phone is not null
      and (pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id))
      and public.contact_reveal_allowed('worker', w.id, w.profile_id)
    then pc.phone end,
    w.profile_id = auth.uid(),
    (w.is_public and w.status <> 'not_looking'),
    w.last_active_at
  from public.worker_profiles w
  join public.profiles pf on pf.id = w.profile_id
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_preferences pr on pr.worker_id = w.id
  left join public.profession_nodes pn on pn.id = w.profession_node_id
  left join public.categories cat on cat.id = w.category_id
  left join public.regions rg on rg.id = w.region_id
  left join public.districts d on d.id = w.district_id
  where w.id = p_id
    and w.onboarding_completed_at is not null
    and (w.profile_id = auth.uid() or (w.is_public and not pf.is_blocked and w.status <> 'not_looking'));
$function$;

-- ---------------------------------------------------------------- 1. qidiruv ro'yxatlari: telefon yo'q
CREATE OR REPLACE FUNCTION public.simple_search_vacancies(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_salary_min integer DEFAULT NULL::integer, p_schedule work_schedule DEFAULT NULL::work_schedule, p_no_experience boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, is_remote boolean, salary_from integer, salary_to integer, salary_type salary_type, salary_negotiable boolean, schedule work_schedule, work_time_from time without time zone, work_time_to time without time zone, experience_min_months integer, summary text, phone text, published_at timestamp with time zone, is_featured boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi (ommaviy yig'ishga qarshi); raqam faqat vakansiya sahifasida, kirgan va limit ichida
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
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_vacancies_v2(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_salary_min integer DEFAULT NULL::integer, p_schedule work_schedule DEFAULT NULL::work_schedule, p_no_experience boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_salary_type salary_type DEFAULT NULL::salary_type)
 RETURNS TABLE(id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, is_remote boolean, salary_from integer, salary_to integer, salary_type salary_type, salary_negotiable boolean, schedule work_schedule, work_time_from time without time zone, work_time_to time without time zone, experience_min_months integer, summary text, phone text, published_at timestamp with time zone, is_featured boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi (ommaviy yig'ishga qarshi); raqam faqat vakansiya sahifasida, kirgan va limit ichida
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
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_vacancies_v3(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_salary_min integer DEFAULT NULL::integer, p_schedule work_schedule DEFAULT NULL::work_schedule, p_no_experience boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_salary_type salary_type DEFAULT NULL::salary_type, p_employer_type employer_type DEFAULT NULL::employer_type, p_featured boolean DEFAULT false, p_mass boolean DEFAULT false)
 RETURNS TABLE(id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, is_remote boolean, salary_from integer, salary_to integer, salary_type salary_type, salary_negotiable boolean, schedule work_schedule, work_time_from time without time zone, work_time_to time without time zone, experience_min_months integer, summary text, phone text, published_at timestamp with time zone, is_featured boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi (ommaviy yig'ishga qarshi); raqam faqat vakansiya sahifasida, kirgan va limit ichida
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
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_workers(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_experienced boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, remote_ok boolean, experience_level experience_level, salary_expected integer, phone text, last_active_at timestamp with time zone, is_promoted boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi; raqam faqat e'lon sahifasida, kirgan va limit ichida
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
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_workers_v2(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_experienced boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_daily boolean DEFAULT false)
 RETURNS TABLE(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, remote_ok boolean, experience_level experience_level, salary_expected integer, phone text, last_active_at timestamp with time zone, is_promoted boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi; raqam faqat e'lon sahifasida, kirgan va limit ichida
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
end $function$;

-- ---------------------------------------------------------------- 3. telegram_accounts: telefon ustunlari yopiq
revoke select on public.telegram_accounts from anon, authenticated;
grant select (telegram_user_id, profile_id, username, first_name, last_name, photo_url, language_code,
              bot_started, linked_at, last_seen_at, chat_verified_at)
  on public.telegram_accounts to authenticated;
