-- ISH.UZ · 0047 · Sodda jarayonlar: 4 qadamli e'lon berish (ishchi / ish beruvchi), mehmon uchun qidiruv,
-- qo'ng'iroq tugmasi uchun ruxsat etilgan telefonlar, takroriy e'londan himoya, tuman↔viloyat tekshiruvi, kasb rasmlari.
-- Hech narsa o'chirilmaydi: mavjud jadvallar, e'lonlar va to'lovlar o'z holicha qoladi.

-- =====================================================================
-- 1. Vakansiya aloqa raqami (alohida jadval: raqam RLS bilan yopiq, ochiq ko'rinish faqat rozilik bo'lsa RPC orqali)
-- =====================================================================
create table if not exists public.vacancy_contacts (
  vacancy_id uuid primary key references public.vacancies(id) on delete cascade,
  phone text not null check (phone ~ '^\+998[0-9]{9}$'),
  show_phone boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.vacancy_contacts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vacancy_contacts' and policyname = 'vacancy_contacts_read') then
    create policy "vacancy_contacts_read" on public.vacancy_contacts for select to authenticated using (public.manages_vacancy(vacancy_id) or public.can_edit_vacancy(vacancy_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vacancy_contacts' and policyname = 'vacancy_contacts_write') then
    create policy "vacancy_contacts_write" on public.vacancy_contacts for all to authenticated
      using (public.can_edit_vacancy(vacancy_id)) with check (public.can_edit_vacancy(vacancy_id));
  end if;
end $$;
revoke all on public.vacancy_contacts from anon;

-- Ikki marta bosish / tarmoq qayta yuborishi ikkinchi vakansiya yaratmasin: mijoz har qoralama uchun bitta UUID beradi
alter table public.vacancies add column if not exists client_ref uuid;
create unique index if not exists vacancies_owner_client_ref_uq on public.vacancies (owner_profile_id, client_ref) where client_ref is not null;

-- =====================================================================
-- 2. Tuman tanlangan viloyatga tegishli bo'lishi shart (bazada ham)
-- =====================================================================
create or replace function public.trg_check_district_region()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.district_id is not null
     and (tg_op = 'INSERT' or new.district_id is distinct from old.district_id or new.region_id is distinct from old.region_id)
     and not exists (select 1 from public.districts d where d.id = new.district_id and d.region_id is not distinct from new.region_id) then
    raise exception 'district_region_mismatch' using errcode = '23514';
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'vacancies_district_region' and tgrelid = 'public.vacancies'::regclass) then
    create trigger vacancies_district_region before insert or update of region_id, district_id on public.vacancies
      for each row execute function public.trg_check_district_region();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'worker_profiles_district_region' and tgrelid = 'public.worker_profiles'::regclass) then
    create trigger worker_profiles_district_region before insert or update of region_id, district_id on public.worker_profiles
      for each row execute function public.trg_check_district_region();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'employer_profiles_district_region' and tgrelid = 'public.employer_profiles'::regclass) then
    create trigger employer_profiles_district_region before insert or update of region_id, district_id on public.employer_profiles
      for each row execute function public.trg_check_district_region();
  end if;
end $$;

-- =====================================================================
-- 3. Ishchi e'loni: bitta tranzaksiyada saqlash + haqiqiy holat (joylandi / to'lov kerak)
-- =====================================================================
create or replace function public.save_simple_worker_listing(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  v_first text := btrim(coalesce(p->>'first_name', ''));
  v_last text := btrim(coalesce(p->>'last_name', ''));
  v_about text := btrim(coalesce(p->>'about', ''));
  v_node uuid := nullif(p->>'profession_node_id', '')::uuid;
  v_region uuid := nullif(p->>'region_id', '')::uuid;
  v_district uuid := nullif(p->>'district_id', '')::uuid;
  v_remote boolean := coalesce((p->>'remote')::boolean, false);
  v_exp public.experience_level := coalesce(nullif(p->>'experience_level', ''), 'none')::public.experience_level;
  v_salary int := nullif(p->>'salary_expected', '')::int;
  v_schedule public.work_schedule := nullif(p->>'schedule', '')::public.work_schedule;
  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
  v_headline text;
  node public.profession_nodes;
  wid uuid;
  w public.worker_profiles;
  st text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if char_length(v_first) < 2 or char_length(v_first) > 60 then raise exception 'invalid_first_name' using errcode = '22023'; end if;
  if char_length(v_last) > 60 then raise exception 'invalid_last_name' using errcode = '22023'; end if;
  if char_length(v_about) < 10 or char_length(v_about) > 1000 then raise exception 'invalid_about' using errcode = '22023'; end if;
  select * into node from public.profession_nodes where id = v_node and is_active and selectable;
  if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
  if v_region is null then raise exception 'invalid_region' using errcode = '22023'; end if;
  if v_district is not null and not exists (select 1 from public.districts d where d.id = v_district and d.region_id = v_region) then
    raise exception 'district_region_mismatch' using errcode = '23514';
  end if;
  if v_salary is not null and (v_salary < 0 or v_salary > 1000000000) then raise exception 'invalid_salary' using errcode = '22023'; end if;
  if not exists (select 1 from public.profile_contacts c where c.profile_id = me and c.phone is not null) then
    raise exception 'phone_required' using errcode = '23514';
  end if;
  v_headline := left(coalesce(nullif(btrim(p->>'headline'), ''), node.name_uz), 80);

  update public.profiles set first_name = v_first, last_name = v_last, active_role = coalesce(active_role, 'worker') where id = me;

  select id into wid from public.worker_profiles where profile_id = me;
  if wid is null then
    insert into public.worker_profiles (profile_id, is_public) values (me, false) returning id into wid;
  end if;

  update public.worker_profiles set
    profession_node_id = node.id,
    custom_profession = null,
    headline = v_headline,
    about = v_about,
    region_id = v_region,
    district_id = v_district,
    remote_preference = case when v_remote then 'yes'::public.remote_preference else 'no'::public.remote_preference end,
    experience_level = v_exp,
    status = 'active',
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    onboarding_step = 9
  where id = wid;

  -- ish joyi tumanlari: tanlangan tuman qo'shiladi, boshqa viloyatdagilari olib tashlanadi
  delete from public.worker_locations wl using public.districts d
   where wl.worker_id = wid and d.id = wl.district_id and d.region_id is distinct from v_region;
  if v_district is not null then
    insert into public.worker_locations (worker_id, district_id) values (wid, v_district) on conflict do nothing;
  end if;

  insert into public.worker_preferences (worker_id, salary_expected, schedules)
  values (wid, v_salary, case when v_schedule is null then '{}'::public.work_schedule[] else array[v_schedule] end)
  on conflict (worker_id) do update set
    salary_expected = excluded.salary_expected,
    schedules = case when v_schedule is null then public.worker_preferences.schedules else excluded.schedules end;

  -- telefonni e'londa ko'rsatish roziligi: rozilik → hammaga; rozilik olib tashlansa → faqat ariza yuborgan ish beruvchiga
  update public.profile_contacts set phone_visibility = case
      when v_show_phone then 'everyone'::public.phone_visibility
      when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
      else phone_visibility end
  where profile_id = me;

  -- qidiruvga chiqarish: pullik rejimda to'lov bo'lmasa trigger ruxsat bermaydi — shunda ma'lumotlar saqlanib qoladi
  begin
    update public.worker_profiles set is_public = true where id = wid;
  exception when raise_exception then
    if sqlerrm <> 'listing_payment_required' then raise; end if;
  end;

  begin
    perform public.refresh_worker_completeness(wid);
    perform public.refresh_matches_for_worker(wid);
  exception when others then
    null; -- yordamchi hisoblar; e'lonni saqlashga xalaqit bermasin
  end;

  select * into w from public.worker_profiles where id = wid;
  st := case
    when w.is_public and (not public.listings_paid() or w.listed_until > now()) then 'listed'
    when public.listings_paid() then 'payment_required'
    else 'saved' end;
  return jsonb_build_object('worker_id', wid, 'state', st, 'listed_until', w.listed_until);
end $$;

-- =====================================================================
-- 4. Ish beruvchi e'loni: profil (+ tashkilot) + vakansiya + aloqa raqami + joylash, bitta tranzaksiyada
-- =====================================================================
create or replace function public.save_simple_vacancy(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  v_type public.employer_type := coalesce(nullif(p->>'employer_type', ''), 'company')::public.employer_type;
  v_org text := btrim(coalesce(p->>'org_name', ''));
  v_phone text := btrim(coalesce(p->>'contact_phone', ''));
  v_show boolean := coalesce((p->>'show_phone')::boolean, false);
  v_desc text := btrim(coalesce(p->>'description', ''));
  v_node uuid := nullif(p->>'profession_node_id', '')::uuid;
  v_title text := btrim(coalesce(p->>'title', ''));
  v_region uuid := nullif(p->>'region_id', '')::uuid;
  v_district uuid := nullif(p->>'district_id', '')::uuid;
  v_remote boolean := coalesce((p->>'remote')::boolean, false);
  v_negotiable boolean := coalesce((p->>'salary_negotiable')::boolean, false);
  v_from int := nullif(p->>'salary_from', '')::int;
  v_to int := nullif(p->>'salary_to', '')::int;
  v_schedule public.work_schedule := coalesce(nullif(p->>'schedule', ''), 'negotiable')::public.work_schedule;
  v_exp int := coalesce(nullif(p->>'experience_min_months', '')::int, 0);
  v_id uuid := nullif(p->>'vacancy_id', '')::uuid;
  v_ref uuid := nullif(p->>'client_ref', '')::uuid;
  is_org boolean;
  node public.profession_nodes;
  ep public.employer_profiles;
  cid uuid;
  v public.vacancies;
  st text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if v_type not in ('company', 'government', 'individual_entrepreneur', 'person') then raise exception 'invalid_employer_type' using errcode = '22023'; end if;
  is_org := v_type <> 'person';
  if char_length(v_org) < 2 or char_length(v_org) > 120 then raise exception 'invalid_org_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+998[0-9]{9}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 4000 then raise exception 'invalid_description' using errcode = '22023'; end if;
  select * into node from public.profession_nodes where id = v_node and is_active and selectable;
  if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
  v_title := left(coalesce(nullif(v_title, ''), node.name_uz), 120);
  if char_length(v_title) < 2 then raise exception 'invalid_title' using errcode = '22023'; end if;
  if v_remote then
    v_district := null;
  elsif v_region is null then
    raise exception 'invalid_region' using errcode = '22023';
  end if;
  if v_district is not null and not exists (select 1 from public.districts d where d.id = v_district and d.region_id = v_region) then
    raise exception 'district_region_mismatch' using errcode = '23514';
  end if;
  if v_negotiable then
    v_from := null; v_to := null;
  elsif v_from is null and v_to is null then
    raise exception 'salary_required' using errcode = '22023';
  end if;
  if (v_from is not null and (v_from < 0 or v_from > 1000000000)) or (v_to is not null and (v_to < 0 or v_to > 1000000000))
     or (v_from is not null and v_to is not null and v_to < v_from) then
    raise exception 'invalid_salary' using errcode = '22023';
  end if;
  if v_exp < 0 or v_exp > 600 then raise exception 'invalid_experience' using errcode = '22023'; end if;

  -- ish beruvchi profili (bo'lmasa yaratiladi; jismoniy shaxsdan rekvizit so'ralmaydi)
  select * into ep from public.employer_profiles where profile_id = me;
  if ep.profile_id is null then
    insert into public.employer_profiles (profile_id, employer_type, display_name, contact_phone, region_id, district_id)
    values (me, v_type, v_org, v_phone, v_region, v_district);
    select * into ep from public.employer_profiles where profile_id = me;
  end if;
  cid := ep.company_id;
  if is_org and cid is null then
    insert into public.companies (name, slug, created_by, is_government, phone, region_id, district_id)
    values (v_org, '', me, v_type = 'government', v_phone, v_region, v_district)
    returning id into cid;
  elsif is_org then
    -- tashkilot nomi o'zgargan bo'lsa (faqat tashkilot admini o'zgartira oladi; bo'lmasa eski nom qoladi)
    begin
      update public.companies set name = v_org where id = cid and name is distinct from v_org;
    exception when others then null;
    end;
  end if;
  update public.employer_profiles set
    employer_type = v_type,
    display_name = case when is_org then coalesce(display_name, v_org) else v_org end,
    contact_phone = coalesce(contact_phone, v_phone),
    company_id = coalesce(company_id, cid),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where profile_id = me;
  -- "O'zim uchun": kiritilgan ism profilda bo'lmasa — profilga ham yoziladi (hisob nomsiz qolmasin)
  update public.profiles set
    active_role = coalesce(active_role, 'employer'),
    first_name = case when not is_org and btrim(coalesce(first_name, '')) = '' then left(v_org, 60) else first_name end
  where id = me;

  -- vakansiya: tahrirlash (id) yoki qoralama UUID bo'yicha topiladi — takroriy bosish yangi e'lon yaratmaydi
  if v_id is not null then
    select * into v from public.vacancies where id = v_id;
    if v.id is null or not public.can_edit_vacancy(v.id) then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif v_ref is not null then
    select * into v from public.vacancies where owner_profile_id = me and client_ref = v_ref;
  end if;

  if v.id is null then
    insert into public.vacancies (owner_profile_id, company_id, title, slug, profession_node_id, description, region_id, district_id,
                                  is_remote, salary_from, salary_to, salary_negotiable, salary_type, schedule, experience_min_months,
                                  is_government, client_ref)
    values (me, case when is_org then cid end, v_title, '', node.id, v_desc, case when v_remote then null else v_region end, v_district,
            v_remote, v_from, v_to, v_negotiable, 'monthly', v_schedule, v_exp, v_type = 'government', v_ref)
    returning * into v;
  else
    if v.status = 'hidden' then raise exception 'vacancy_locked' using errcode = '42501'; end if;
    update public.vacancies set
      title = v_title, profession_node_id = node.id, custom_profession = null, description = v_desc,
      region_id = case when v_remote then null else v_region end, district_id = v_district, is_remote = v_remote,
      salary_from = v_from, salary_to = v_to, salary_negotiable = v_negotiable,
      schedule = v_schedule, experience_min_months = v_exp
    where id = v.id
    returning * into v;
  end if;

  insert into public.vacancy_contacts (vacancy_id, phone, show_phone) values (v.id, v_phone, v_show)
  on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = excluded.show_phone, updated_at = now();

  -- joylash: faol e'lon tahrirlansa holati saqlanadi; aks holda publish_vacancy (to'lov/tekshiruv qoidalari bilan)
  if v.status <> 'active' then
    begin
      perform public.publish_vacancy(v.id);
    exception when others then
      if sqlerrm = 'payment_required' then st := 'payment_required'; else raise; end if;
    end;
  end if;

  select * into v from public.vacancies where id = v.id;
  st := coalesce(st, case v.status when 'active' then 'active' when 'pending_review' then 'review' else v.status::text end);
  return jsonb_build_object('vacancy_id', v.id, 'slug', v.slug, 'state', st);
end $$;

revoke execute on function public.save_simple_worker_listing(jsonb), public.save_simple_vacancy(jsonb) from public, anon;
grant execute on function public.save_simple_worker_listing(jsonb), public.save_simple_vacancy(jsonb) to authenticated;

-- =====================================================================
-- 5. Qidiruv (mehmon ham ishlatadi): kasb (va uning ichki kasblari) + viloyat + tuman → kartalar uchun tayyor maydonlar
--    Telefon faqat egasi e'londa ko'rsatishga rozilik bergan bo'lsa qaytadi.
-- =====================================================================
create or replace function public.profession_subtree(p_node_id uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  with recursive d as (
    select n.id from public.profession_nodes n where n.id = p_node_id
    union all
    select c.id from public.profession_nodes c join d on c.parent_id = d.id
  ) select case when p_node_id is null then null else array_agg(d.id) end from d;
$$;

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
  with base as (
    select v.*,
      (v.is_featured and (v.featured_until is null or v.featured_until > now())) as featured_now,
      (p_district_id is not null and v.district_id is null) as wide
    from public.vacancies v
    where v.status = 'active'
      and (ids is null or v.profession_node_id = any(ids)
           -- eski e'lonlar (kasb tuguni yo'q): nomi aynan shu kasb nomini o'z ichiga olsa
           or (v.profession_node_id is null and node.id is not null
               and (lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')))
      and (case when p_remote then v.is_remote
                else (p_region_id is null or v.region_id = p_region_id)
                     and (p_district_id is null or v.district_id = p_district_id or v.district_id is null) end)
      and (p_salary_min is null or v.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) >= p_salary_min)
      and (p_schedule is null or v.schedule = p_schedule)
      and (not p_no_experience or v.experience_min_months = 0)
    order by featured_now desc, wide asc, v.published_at desc nulls last
    limit 5000
  ),
  counted as (select b.*, count(*) over () as total from base b)
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    c.wide, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    case
      when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
      else coalesce(co.phone, case when auth.uid() is not null then ep.contact_phone end)
    end,
    c.published_at, c.featured_now, c.total
  from counted c
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  order by c.featured_now desc, c.wide asc, c.published_at desc nulls last
  limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950));
end $$;

create or replace function public.simple_search_workers(
  p_profession_node_id uuid default null,
  p_region_id uuid default null,
  p_district_id uuid default null,
  p_remote boolean default false,
  p_experienced boolean default false,
  p_limit int default 20,
  p_offset int default 0
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

grant execute on function public.profession_subtree(uuid) to anon, authenticated;
grant execute on function public.simple_search_vacancies(uuid, uuid, uuid, boolean, int, public.work_schedule, boolean, int, int) to anon, authenticated;
grant execute on function public.simple_search_workers(uuid, uuid, uuid, boolean, boolean, int, int) to anon, authenticated;

-- =====================================================================
-- 6. Kasb rasmlari: har kasb uchun bir marta yaratiladi va qayta ishlatiladi
-- =====================================================================
create table if not exists public.profession_images (
  node_id uuid primary key references public.profession_nodes(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  image_url text,
  storage_path text,
  prompt text,
  model text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profession_images enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profession_images' and policyname = 'profession_images_read') then
    create policy "profession_images_read" on public.profession_images for select using (status = 'ready');
  end if;
end $$;
revoke insert, update, delete on public.profession_images from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profession-images', 'profession-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

insert into public.app_settings (key, value, is_public) values
  ('profession_images_enabled', 'true'::jsonb, false),
  ('profession_images_daily_limit', '30'::jsonb, false)
on conflict (key) do nothing;

-- Generatsiyaga navbat olish (faqat server, service role): yoqilgan, kunlik limit, bir vaqtda bitta urinish, 3 martadan ko'p emas
create or replace function public.claim_profession_image(p_node_id uuid, p_prompt text, p_model text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  claimed boolean;
begin
  if not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'profession_images_enabled'), false) then return false; end if;
  if not exists (select 1 from public.profession_nodes n where n.id = p_node_id and n.is_active) then return false; end if;
  perform pg_advisory_xact_lock(hashtext('profession_images'));
  insert into public.profession_images (node_id, status, prompt, model, attempts, updated_at)
  values (p_node_id, 'pending', p_prompt, p_model, 1, now())
  on conflict (node_id) do update set status = 'pending', prompt = excluded.prompt, model = excluded.model,
    attempts = public.profession_images.attempts + 1, last_error = null, updated_at = now()
  where (public.profession_images.status = 'failed' and public.profession_images.attempts < 3 and public.profession_images.updated_at < now() - interval '30 minutes')
     or (public.profession_images.status = 'pending' and public.profession_images.updated_at < now() - interval '15 minutes')
  returning true into claimed;
  if not coalesce(claimed, false) then return false; end if;
  -- xarajat cheklovi: sutkada N ta urinish
  if not public.check_rate_limit('profession_images:day', public.setting_int('profession_images_daily_limit', 30), 86400) then
    update public.profession_images set status = 'failed', last_error = 'daily_limit', attempts = greatest(attempts - 1, 0) where node_id = p_node_id;
    return false;
  end if;
  return true;
end $$;
revoke execute on function public.claim_profession_image(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_profession_image(uuid, text, text) to service_role;

-- =====================================================================
-- 7. Bitta e'lon: ishchi e'loni sahifasi (mehmon ham ko'radi) va vakansiya telefoni (rozilik bo'yicha)
-- =====================================================================
create or replace function public.simple_worker_listing(p_id uuid)
returns table (
  id uuid, first_name text, last_initial text, avatar_url text, headline text,
  profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text,
  category_slug text, category_icon text, about text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  remote_ok boolean, experience_level public.experience_level, salary_expected int, schedules public.work_schedule[],
  phone text, is_owner boolean, is_listed boolean, last_active_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select w.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, w.headline,
    w.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon), w.about,
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    w.remote_preference = 'yes', w.experience_level, pr.salary_expected, coalesce(pr.schedules, '{}'),
    case when pc.phone_visibility = 'everyone' or (auth.uid() is not null and public.can_view_phone(w.profile_id)) then pc.phone end,
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
$$;

create or replace function public.simple_vacancy_phone(p_vacancy_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
    else coalesce(co.phone, case when auth.uid() is not null then ep.contact_phone end)
  end
  from public.vacancies v
  left join public.vacancy_contacts vc on vc.vacancy_id = v.id
  left join public.companies co on co.id = v.company_id
  left join public.employer_profiles ep on ep.profile_id = v.owner_profile_id
  where v.id = p_vacancy_id and v.status = 'active';
$$;

grant execute on function public.simple_worker_listing(uuid), public.simple_vacancy_phone(uuid) to anon, authenticated;

-- =====================================================================
-- 8. Kasb rasmlari uchun soatlik fon vazifasi: faqat rasmi yo'q (faol e'lonlardagi) kasb bo'lsa ilovani chaqiradi.
--    Kalit (IMAGE_GEN_API_KEY) sozlanmagan bo'lsa ilova hech narsa qilmaydi; xarajat kunlik limit bilan cheklangan.
-- =====================================================================
create or replace function public.dispatch_profession_images_cron()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  base text;
  secret text;
begin
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then return null; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'profession_images_enabled'), false) then return null; end if;
  if not exists (
    select 1 from public.vacancies v
    where v.status = 'active' and v.profession_node_id is not null
      and not exists (select 1 from public.profession_images i where i.node_id = v.profession_node_id
                      and (i.status in ('ready', 'pending') or (i.status = 'failed' and i.attempts >= 3)))
  ) and not exists (
    select 1 from public.worker_profiles w
    where w.is_public and w.profession_node_id is not null
      and not exists (select 1 from public.profession_images i where i.node_id = w.profession_node_id
                      and (i.status in ('ready', 'pending') or (i.status = 'failed' and i.attempts >= 3)))
  ) then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into base using 'ishuz_app_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into secret using 'ishuz_cron_secret';
  if base is null or secret is null then return null; end if;
  return net.http_post(
    url := rtrim(base, '/') || '/api/cron/profession-images',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function public.dispatch_profession_images_cron() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ishuz-profession-images', '23 * * * *', $job$select public.dispatch_profession_images_cron();$job$);
  else
    raise notice 'pg_cron yo''q (lokal muhit) — rejalashtirish o''tkazib yuborildi';
  end if;
end $$;
