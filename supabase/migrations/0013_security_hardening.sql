-- ISH.UZ · 0013 · xavfsizlik qattiqlashtirish (adversarial review natijalari)
-- 1) compute_match: ishchini ko'rish huquqi + anon taqiqi
-- 2) company_members_update: profile_id/company_id o'zgartirib bo'lmaydi
-- 3) admin_log: action prefiksi → kerakli ruxsat
-- 4) profiles: anon uchun shaxsiy ustunlar yopiq
-- 5) birinchi e'londa mos ishchilarga bildirishnoma
-- 6) search_vacancies: total_count 300-limitdan keyin hisoblanadi (bo'sh sahifalar yo'q)

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
  -- Ruxsat: o'zi, admin yoki (vakansiyani boshqaradi VA ishchini ko'ra oladi). anon — hech qachon.
  -- service_role (cron/server) uchun auth.uid() null va auth.role() <> 'anon'.
  if auth.role() = 'anon' or (auth.uid() is not null and not (w.profile_id = auth.uid() or public.is_admin()
      or (public.manages_vacancy(p_vacancy_id) and public.can_view_worker(p_worker_id)))) then
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
  join public.profiles p on p.id = w.profile_id
  where w.is_public and w.onboarding_completed_at is not null and not p.is_blocked
    and w.status <> 'not_looking' and w.category_id = v.category_id
  order by w.last_active_at desc
  limit 1000;
  get diagnostics n = row_count;
  return n;
end $$;

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
    -- birinchi e'lon: mos ishchilarga "yangi mos vakansiya" bildirishnomasi
    if v.published_at is null then perform public.notify_matching_workers(p_vacancy_id); end if;
  end if;
  return new_status;
end $$;

create or replace function public.admin_set_vacancy_status(p_vacancy_id uuid, p_status public.vacancy_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare before_row jsonb; was_unpublished boolean;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('active', 'hidden', 'rejected', 'closed') then raise exception 'invalid_status' using errcode = '23514'; end if;
  select jsonb_build_object('status', status, 'moderation_note', moderation_note) into before_row from public.vacancies where id = p_vacancy_id;
  select published_at is null into was_unpublished from public.vacancies where id = p_vacancy_id;
  if p_status = 'active' then
    update public.vacancies
    set status = 'active', moderation_note = p_note, requires_review = false,
        published_at = coalesce(published_at, now()),
        expires_at = case when expires_at is null or expires_at < now() then now() + make_interval(days => coalesce((select (value)::int from public.app_settings where key = 'vacancy_lifetime_days'), 30)) else expires_at end
    where id = p_vacancy_id;
    perform public.refresh_matches_for_vacancy(p_vacancy_id);
    if was_unpublished then perform public.notify_matching_workers(p_vacancy_id); end if;
  else
    update public.vacancies set status = p_status, moderation_note = p_note, requires_review = (p_status in ('hidden', 'rejected')) where id = p_vacancy_id;
  end if;
  perform public.write_audit('vacancy.' || p_status, 'vacancy', p_vacancy_id::text, before_row, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

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

-- company_members: faqat role o'zgaradi (a'zo qo'shish — faqat taklif orqali)
drop policy if exists "company_members_update" on public.company_members;
create policy "company_members_update" on public.company_members for update to authenticated
  using (public.is_company_admin(company_id) and role <> 'owner')
  with check (public.is_company_admin(company_id) and role <> 'owner'
    and profile_id is not distinct from (select m.profile_id from public.company_members m where m.company_id = company_members.company_id and m.profile_id = company_members.profile_id)
    and company_id is not distinct from (select m.company_id from public.company_members m where m.company_id = company_members.company_id and m.profile_id = company_members.profile_id));

-- admin_log: har bir action prefiksi o'z ruxsatini talab qiladi (support rol soxta audit yoza olmaydi)
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text default null, p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  prefix text;
  perm text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]+\.[a-z_]+$' then raise exception 'invalid_action' using errcode = '23514'; end if;
  prefix := split_part(p_action, '.', 1);
  perm := case prefix
    when 'category' then 'categories.manage'
    when 'subcategory' then 'categories.manage'
    when 'skill' then 'skills.manage'
    when 'region' then 'regions.manage'
    when 'district' then 'regions.manage'
    when 'settings' then 'settings.manage'
    when 'admin' then 'admins.manage'
    else 'admins.manage'
  end;
  if not public.has_admin_permission(perm) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.write_audit(p_action, p_target_type, p_target_id, p_before, p_after);
end $$;

-- profiles: anon (faol vakansiya egasi nomini ko'radi) faqat ochiq ustunlarni o'qiydi.
-- Ustun ruxsatlari qo'shimcha bo'lgani uchun jadval darajasidagi select olib tashlanadi.
revoke select on public.profiles from anon;
grant select (id, first_name, last_name, avatar_url, active_role, is_blocked, created_at, updated_at) on public.profiles to anon;
