-- =====================================================================
-- 0055: 1 mln foydalanuvchiga tayyorlik (Supabase performance advisor)
--
-- 1) RLS qoidalarida auth.uid(), argumentsiz yordamchi funksiyalar (is_admin(), is_active_user(),
--    current_worker_id(), current_employer_id()) va has_admin_permission('...') HAR QATOR uchun qayta
--    chaqirilardi (1 mln qatorli jadvalda — 1 mln chaqiruv, har biri alohida so'rov). "(select f())"
--    ko'rinishida — so'rov boshida BIR MARTA hisoblanadi (initPlan). Mantiq o'zgarmaydi: barcha bu
--    funksiyalar STABLE (bitta so'rov ichida bir xil qiymat). Qoidalar o'chirilmaydi — ALTER POLICY bilan
--    faqat ifoda almashtiriladi. Qayta ishga tushirilsa ikki marta o'ramaydi.
-- 2) Profil/vakansiyaga ishora qiluvchi indekssiz tashqi kalitlar: profil yoki vakansiya o'chirilganda
--    (yoki tekshirilganda) katta jadvallar butunlay ko'rib chiqilmasin. AI kuzatuvlari mosligi — kasb/hudud.
-- (Advisor'dagi "search_path aniqlanmagan" 4 funksiya ataylab o'zgartirilmadi: ular faqat pg_catalog
--  funksiyalaridan foydalanadigan oddiy SQL funksiyalar — SET search_path ularni so'rov ichiga joylashni
--  (inlining) o'chirib, qidiruv/moslikni sekinlashtiradi. Batafsil: docs/SCALE.md)
-- =====================================================================

do $rls$
declare
  r record;
  skip oid[];
  -- (?<!SELECT ) — allaqachon "( SELECT auth.uid() AS uid)" bo'lsa tegmaymiz; (?<![\w.]) — boshqa nom ichida emas
  pat constant text := '(?<!SELECT )(?<![\w.])((?:public\.)?(?:is_active_user|is_admin|current_worker_id|current_employer_id)\(\)|auth\.uid\(\)|(?:public\.)?has_admin_permission\(''[a-z_.]+''::text\))';
  q text;
  w text;
  stmt text;
begin
  -- Qoidalari bir-biriga (yoki o'ziga) halqa bo'lib murojaat qiladigan jadvallar chetda qoladi: ularning
  -- qoidasiga ichki so'rov qo'shilsa, Postgres RLS'ni yoyishda "infinite recursion detected in policy"
  -- xatosini beradi (masalan vacancies_update o'z jadvalidan eski qiymatni o'qiydi). Halqasiz jadvalga
  -- (select auth.uid()) qo'shish xavfsiz: u boshqa jadvalga murojaat qilmaydi, yangi halqa hosil qilmaydi.
  with recursive edges as (
    select distinct p.polrelid as src, d.refobjid as dst
    from pg_policy p
    join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = p.oid
     and d.refclassid = 'pg_class'::regclass and d.deptype = 'n' and d.refobjid <> p.polrelid
    union
    select c.oid, c.oid
    from pg_policies pp
    join pg_class c on c.relname = pp.tablename and c.relnamespace = 'public'::regnamespace
    where pp.schemaname = 'public'
      and (coalesce(pp.qual, '') || ' ' || coalesce(pp.with_check, '')) ~ ('(FROM|JOIN)\s+(public\.)?' || pp.tablename || '\M')
  ),
  reach(src, dst) as (
    select e.src, e.dst from edges e
    union
    select r2.src, e.dst from reach r2 join edges e on e.src = r2.dst
  )
  select coalesce(array_agg(distinct reach.src), '{}') into skip from reach where reach.src = reach.dst;

  for r in
    select p.schemaname, p.tablename, p.policyname, p.qual, p.with_check
    from pg_policies p
    join pg_class c on c.relname = p.tablename and c.relnamespace = 'public'::regnamespace
    where p.schemaname = 'public'
      and c.oid <> all(skip)
      and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) ~ pat
  loop
    q := case when r.qual is not null then regexp_replace(r.qual, pat, '(select \1)', 'g') end;
    w := case when r.with_check is not null then regexp_replace(r.with_check, pat, '(select \1)', 'g') end;
    if q is not distinct from r.qual and w is not distinct from r.with_check then
      continue;
    end if;
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if w is not null then stmt := stmt || ' with check (' || w || ')'; end if;
    execute stmt;
  end loop;
end $rls$;

-- Profil o'chirilishi/tekshiruvi: ishora qiluvchi ustunlar
create index if not exists idx_analytics_events_profile on public.analytics_events (profile_id) where profile_id is not null;
create index if not exists idx_match_notifications_recipient on public.match_notifications (recipient_id);
create index if not exists idx_match_notifications_vacancy on public.match_notifications (vacancy_id);
create index if not exists idx_moderation_checks_actor on public.moderation_checks (actor_id) where actor_id is not null;
create index if not exists idx_companies_created_by on public.companies (created_by);
create index if not exists idx_company_invites_invited_by on public.company_invites (invited_by);
create index if not exists idx_company_invites_accepted_by on public.company_invites (accepted_by) where accepted_by is not null;
create index if not exists idx_company_members_invited_by on public.company_members (invited_by) where invited_by is not null;
create index if not exists idx_custom_occupation_requests_created_by on public.custom_occupation_requests (created_by);
create index if not exists idx_reports_resolved_by on public.reports (resolved_by) where resolved_by is not null;
create index if not exists idx_reviews_moderated_by on public.reviews (moderated_by) where moderated_by is not null;
create index if not exists idx_verification_requests_reviewed_by on public.verification_requests (reviewed_by) where reviewed_by is not null;
create index if not exists idx_admin_users_created_by on public.admin_users (created_by) where created_by is not null;
create index if not exists idx_skills_created_by on public.skills (created_by) where created_by is not null;

-- AI kuzatuvlari va mos ish obunalari: yangi e'lon chiqqanda kasb/hudud bo'yicha topiladi
create index if not exists idx_ai_worker_alerts_node on public.ai_worker_alerts (profession_node_id) where is_active;
create index if not exists idx_ai_worker_alerts_region on public.ai_worker_alerts (region_id);
create index if not exists idx_ai_job_alerts_region on public.ai_job_alerts (region_id);
create index if not exists idx_match_subscriptions_node on public.match_subscriptions (profession_node_id);
create index if not exists idx_match_subscriptions_region on public.match_subscriptions (region_id);

-- =====================================================================
-- 4) Qidiruv natijalari (eng ko'p chaqiriladigan so'rov) — natija o'sha-o'sha, tezroq:
--    - "kasb tanlanmaganmi YOKI kasb tuguni YOKI eski e'lon nomi" bitta OR'da bo'lgani uchun kasb indeksi
--      ishlatilmay, barcha faol vakansiyalar ko'rib chiqilardi. Endi uchta alohida tarmoq (UNION ALL, kesishmaydi).
--    - Kompaniya/hudud/kasb nomlari va tavsif qisqartmasi 5000 qatorga emas, faqat sahifadagi 20 tasiga.
--    - Bir xil sana/holatdagi e'lonlar sahifalar orasida takrorlanmasin: oxirgi tartib kaliti — id.
-- =====================================================================
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
    where ids is null and v.status = 'active'
    union all
    -- kasb va uning ichidagi kasblar: idx_vacancies_node
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and v.profession_node_id = any(ids)
    union all
    -- eski e'lonlar (kasb tuguni yo'q): nomi aynan shu kasb nomini o'z ichiga olsa
    select v.* from public.vacancies v
    where ids is not null and node.id is not null and v.status = 'active' and v.profession_node_id is null
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
