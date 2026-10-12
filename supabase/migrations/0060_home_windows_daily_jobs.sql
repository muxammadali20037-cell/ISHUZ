-- 0060 · Bosh sahifa oynalari, kunlik ishlar, AI qidiruv tugmasi (D3–D6)
--
--  1) save_simple_vacancy: haq turi — oylik yoki kunlik (p.salary_type = 'monthly' | 'daily'; boshqa qiymat e'tiborsiz).
--     Yangi e'lon — sukut bo'yicha oylik (avvalgidek); tahrirda berilmasa — mavjud tur saqlanadi.
--  2) simple_search_vacancies_v2 — simple_search_vacancies (0055) bilan bir xil + p_salary_type filtri ("Kunlik ishlar").
--     Eski funksiya o'zgarmaydi (ilova 0060 bo'lmasa uni ishlatadi).
--  3) app_settings: home_banners (bosh sahifa oynalari; null — ilovadagi standart oynalar), ai_search_button (lupa tugmasi).
--     Ikkalasi ochiq (is_public) — sahifa anon kalit bilan o'qiydi; yozish — faqat settings.manage (0010 RLS).
--  4) site-media — ommaviy bucket (oyna rasmlari). Mijoz yozuvi siyosati YO'Q: faqat server (service role), admin huquqi
--     tekshirilgandan va rasm qayta kodlangandan keyin yozadi.
--  5) simple_listing_features(): daily_jobs = true.
--
-- Faqat qo'shimcha: DROP/DELETE yo'q. Rollback: save_simple_vacancy ni 0057 holatiga qaytarish (2 ta yamoq teskari),
-- simple_search_vacancies_v2 ni o'chirish, simple_listing_features() ni 0059 holatiga qaytarish.

create or replace function pg_temp.patch_fn(p_fn regprocedure, p_old text, p_new text) returns void
language plpgsql as $$
declare
  def text := replace(pg_get_functiondef(p_fn), E'\r', '');
  o text := replace(p_old, E'\r', '');
  r text := replace(p_new, E'\r', '');
  n int;
begin
  n := (length(def) - length(replace(def, o, ''))) / greatest(length(o), 1);
  if n <> 1 then raise exception 'patch_fn %: naqsh % marta uchradi (1 kutilgan)', p_fn, n; end if;
  execute replace(def, o, r);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 1. Oddiy vakansiya: oylik yoki kunlik haq
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$  v_to int := nullif(p->>'salary_to', '')::int;$o$,
  $n$  v_to int := nullif(p->>'salary_to', '')::int;
  v_pay public.salary_type := case when p->>'salary_type' in ('monthly', 'daily') then (p->>'salary_type')::public.salary_type end;$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$            v_remote, v_from, v_to, v_negotiable, 'monthly', v_schedule,$o$,
  $n$            v_remote, v_from, v_to, v_negotiable, coalesce(v_pay, 'monthly'), v_schedule,$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$      salary_from = v_from, salary_to = v_to, salary_negotiable = v_negotiable,
      schedule = v_schedule,$o$,
  $n$      salary_from = v_from, salary_to = v_to, salary_negotiable = v_negotiable, salary_type = coalesce(v_pay, salary_type),
      schedule = v_schedule,$n$);

-- ---------------------------------------------------------------------------------------------------
-- 2. Qidiruv: haq turi bo'yicha filtr ("Kunlik ishlar")
-- ---------------------------------------------------------------------------------------------------
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
    where ids is null and v.status = 'active'
    union all
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and v.profession_node_id = any(ids)
    union all
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
grant execute on function public.simple_search_vacancies_v2(uuid, uuid, uuid, boolean, int, public.work_schedule, boolean, int, int, public.salary_type) to anon, authenticated;

-- kunlik ishlar ro'yxati: faol e'lonlar ichidan haq turi bo'yicha (qisman indeks — kunliklar kam)
create index if not exists vacancies_active_daily_idx on public.vacancies (published_at desc) where status = 'active' and salary_type = 'daily';

-- ---------------------------------------------------------------------------------------------------
-- 3. Sozlamalar (admin panel)
-- ---------------------------------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public) values
  ('home_banners', 'null'::jsonb, true),
  ('ai_search_button', 'true'::jsonb, true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 4. Oyna rasmlari (faqat server yozadi)
-- ---------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 2097152, array['image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 5. Imkoniyat bayrog'i
-- ---------------------------------------------------------------------------------------------------
create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true, 'photo_quarantine', true, 'media_quarantine', true, 'daily_jobs', true);
$$;
