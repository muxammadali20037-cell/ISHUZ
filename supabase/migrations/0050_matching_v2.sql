-- ISH.UZ · 0050 · moslik v2: hisoblangan, tushuntiriladigan va versiyalangan ko'rsatkich.
--
-- Bu ishga qabul qilinish ehtimoli EMAS — profil va e'lon shartlarining mosligi. AI raqam o'ylab topmaydi:
-- ball faqat shu funksiyadagi tekshiriladigan qoidalar bilan hisoblanadi (yagona manba; qidiruv, kesh va
-- xabarnomalar shu natijani ishlatadi).
--
-- Og'irliklar (admin o'zgartira oladi, jami 100): kasb 25, hudud 15, maosh 15, tajriba 10, ko'nikmalar 15,
-- jadval 10, bandlik+rasmiylik 5, til 5. Har mezon 0..1 ulush beradi:
--   * talab qilinmagan mezon — to'liq ball (ok=true);
--   * talab qilingan, lekin ishchida ma'lumot yo'q — 0 ball, ok='unknown' va missing ro'yxatiga yoziladi;
--   * "Kelishiladi" maosh — qisman (to'liq moslik emas);
--   * oylik va kunlik/soatlik maosh asossiz tenglashtirilmaydi (taqqoslab bo'lmaydi → 'unknown').
-- Qat'iy talablar (hard): mos kelmaydigan kasb, majburiy guvohnoma yo'qligi, majburiy jadvalga aniq
-- nomuvofiqlik, boshqa viloyat (masofaviy bo'lmasa). Qat'iy talab buzilsa avtomatik tavsiya yuborilmaydi.

insert into public.app_settings (key, value, is_public) values
  ('match_weights', '{"profession":25,"location":15,"salary":15,"experience":10,"skills":15,"schedule":10,"employment":5,"language":5}'::jsonb, false),
  ('match_notify_threshold', '90'::jsonb, true),
  ('match_rules_version', '2'::jsonb, false)
on conflict (key) do nothing;
-- chegara foydalanuvchiga ham ko'rsatiladi ("90%+ mos")
update public.app_settings set is_public = true where key = 'match_notify_threshold';

alter table public.matches
  add column if not exists hard_fail boolean not null default false,
  add column if not exists complete boolean not null default true,
  add column if not exists missing text[] not null default '{}',
  add column if not exists rules_version int not null default 1;
create index if not exists matches_vacancy_score_idx on public.matches (vacancy_id, score desc) where not hard_fail;

-- Majburiy guvohnoma / sertifikat ko'nikmalari (qat'iy talab sifatida tekshiriladi)
alter table public.skills add column if not exists is_license boolean not null default false;
update public.skills set is_license = true
where not is_license and (slug like 'driver_license%' or slug like '%_license%' or slug like '%certificate%' or slug like '%sertifikat%');

create or replace function public.match_weights()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = 'match_weights'),
    '{"profession":25,"location":15,"salary":15,"experience":10,"skills":15,"schedule":10,"employment":5,"language":5}'::jsonb);
$$;

create or replace function public.match_rules_version()
returns int language sql stable security definer set search_path = public as $$
  select public.setting_int('match_rules_version', 2);
$$;

-- Ichki: to'liq tushuntirish (auth tekshiruvisiz — faqat definer funksiyalar chaqiradi)
create or replace function public.compute_match_v2(p_worker_id uuid, p_vacancy_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  w public.worker_profiles;
  pr public.worker_preferences;
  v public.vacancies;
  p public.profiles;
  wt jsonb := public.match_weights();
  total numeric := 0;
  r jsonb := '[]'::jsonb;
  hard text[] := '{}';
  missing text[] := '{}';
  f numeric;
  v_path uuid[];
  rel int;
  km double precision;
  w_months int;
  w_expect int;
  w_min int;
  w_type public.salary_type;
  vmax int;
  req_skills int;
  matched int;
  w_skills int;
  lic_missing int;
  lang_total int;
  lang_matched int;
  w_langs int;
  age int;
begin
  select * into w from public.worker_profiles where id = p_worker_id;
  select * into v from public.vacancies where id = p_vacancy_id;
  if w.id is null or v.id is null then
    return jsonb_build_object('score', 0, 'hard_fail', true, 'complete', false, 'reasons', '[]'::jsonb,
      'hard', '[]'::jsonb, 'missing', '[]'::jsonb, 'version', public.match_rules_version());
  end if;
  select * into pr from public.worker_preferences where worker_id = w.id;
  select * into p from public.profiles where id = w.profile_id;

  -- 1. Kasb va mutaxassislik
  if v.profession_node_id is not null then
    select n.path into v_path from public.profession_nodes n where n.id = v.profession_node_id;
    select max(public.profession_relation(n.path, v_path)) into rel
    from public.profession_nodes n
    where n.id = w.profession_node_id
       or n.id in (select wp.node_id from public.worker_professions wp where wp.worker_id = w.id);
  end if;
  if rel is not null and rel >= 0 then
    f := case rel when 3 then 1 when 2 then 0.92 when 1 then 0.68 else 0.48 end;
    r := r || jsonb_build_object('key', case rel when 3 then 'profession_exact' when 2 then 'profession_specialist'
                                                 when 1 then 'profession_general' else 'profession_related' end,
                                 'ok', case when rel >= 2 then to_jsonb(true) else to_jsonb('warn'::text) end);
  elsif w.category_id is null and w.profession_node_id is null then
    f := 0; missing := missing || 'profession'::text;
    r := r || jsonb_build_object('key', 'profession_unknown', 'ok', 'unknown');
  elsif rel = -1 and w.category_id = v.category_id then
    f := 0.32; hard := hard || 'profession_mismatch'::text;
    r := r || jsonb_build_object('key', 'profession_other_branch', 'ok', false);
  elsif w.category_id is not null and w.category_id = v.category_id and rel is null then
    if v.subcategory_id is null or w.subcategory_id = v.subcategory_id then
      f := 1; r := r || jsonb_build_object('key', 'category_match', 'ok', true);
    else
      f := 0.72; r := r || jsonb_build_object('key', 'category_match_partial', 'ok', 'warn');
    end if;
  else
    f := 0; hard := hard || 'profession_mismatch'::text;
    r := r || jsonb_build_object('key', 'category_mismatch', 'ok', false);
  end if;
  total := total + f * coalesce((wt->>'profession')::numeric, 25);

  -- 2. Hudud yoki masofaviy ish
  if v.is_remote then
    if w.remote_preference in ('yes', 'any') then
      f := 1; r := r || jsonb_build_object('key', 'remote_ok', 'ok', true);
    else
      f := 0.5; r := r || jsonb_build_object('key', 'remote_not_preferred', 'ok', 'warn');
    end if;
  elsif v.region_id is null then
    f := 0; r := r || jsonb_build_object('key', 'location_unknown', 'ok', 'unknown');
  elsif w.region_id is null then
    f := 0; missing := missing || 'location'::text;
    r := r || jsonb_build_object('key', 'location_unknown', 'ok', 'unknown');
  else
    select public.distance_km(g.lat, g.lng, v.lat, v.lng) into km from public.worker_geo g where g.worker_id = w.id;
    if v.district_id is not null and (v.district_id = w.district_id or exists (
        select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = v.district_id)) then
      f := 1; r := r || jsonb_build_object('key', 'district_match', 'ok', true, 'km', case when km is not null then greatest(1, ceil(km))::int end);
    elsif km is not null and km <= 5 then
      f := 1; r := r || jsonb_build_object('key', 'distance_near', 'ok', true, 'km', greatest(1, ceil(km))::int);
    elsif km is not null and km <= 15 then
      f := 0.67; r := r || jsonb_build_object('key', 'distance_ok', 'ok', 'warn', 'km', greatest(1, ceil(km))::int);
    elsif v.region_id = w.region_id and (v.district_id is null or w.district_id is null) then
      f := 0.8; r := r || jsonb_build_object('key', 'region_match', 'ok', true);
    elsif v.region_id = w.region_id then
      f := 0.53; r := r || jsonb_build_object('key', 'region_other_district', 'ok', 'warn');
    elsif exists (select 1 from public.worker_locations wl join public.districts d on d.id = wl.district_id
                  where wl.worker_id = w.id and d.region_id = v.region_id) then
      f := 0.8; r := r || jsonb_build_object('key', 'region_match', 'ok', true);
    else
      f := 0; hard := hard || 'location_mismatch'::text;
      r := r || jsonb_build_object('key', 'location_far', 'ok', false);
    end if;
    if w.remote_preference = 'yes' and f > 0 then
      f := least(f, 0.5); r := r || jsonb_build_object('key', 'remote_preferred', 'ok', 'warn');
    end if;
  end if;
  total := total + f * coalesce((wt->>'location')::numeric, 15);

  -- 3. Maosh (bir xil davr bo'yicha taqqoslanadi)
  w_expect := coalesce(pr.salary_expected, pr.salary_min);
  w_min := coalesce(pr.salary_min, pr.salary_expected);
  w_type := coalesce(pr.salary_type, 'monthly');
  vmax := coalesce(v.salary_to, v.salary_from);
  if w_expect is null then
    f := 1; r := r || jsonb_build_object('key', 'salary_not_required', 'ok', true);
  elsif v.salary_negotiable or vmax is null or v.salary_type = 'negotiable' then
    f := 0.5; r := r || jsonb_build_object('key', 'salary_negotiable', 'ok', 'unknown');
  elsif w_type = 'negotiable' then
    f := 1; r := r || jsonb_build_object('key', 'salary_not_required', 'ok', true);
  elsif v.salary_type <> w_type then
    f := 0; r := r || jsonb_build_object('key', 'salary_type_differs', 'ok', 'unknown', 'vacancy_type', v.salary_type);
  elsif vmax >= w_expect then
    f := 1; r := r || jsonb_build_object('key', 'salary_ok', 'ok', true);
  elsif vmax >= w_min then
    f := 0.8; r := r || jsonb_build_object('key', 'salary_min_ok', 'ok', true);
  elsif vmax >= w_min * 0.85 then
    f := 0.5; r := r || jsonb_build_object('key', 'salary_close', 'ok', 'warn', 'vacancy_max', vmax, 'worker_min', w_min);
  else
    f := 0; r := r || jsonb_build_object('key', 'salary_below', 'ok', false, 'vacancy_max', vmax, 'worker_min', w_min);
  end if;
  total := total + f * coalesce((wt->>'salary')::numeric, 15);

  -- 4. Tajriba
  w_months := public.experience_level_months(w.experience_level);
  if coalesce(v.experience_min_months, 0) = 0 then
    f := 1; r := r || jsonb_build_object('key', 'experience_not_required', 'ok', true);
  elsif w.experience_level is null then
    f := 0; missing := missing || 'experience'::text;
    r := r || jsonb_build_object('key', 'experience_unknown', 'ok', 'unknown', 'required_months', v.experience_min_months);
  elsif w_months >= v.experience_min_months then
    f := 1; r := r || jsonb_build_object('key', 'experience_ok', 'ok', true);
  elsif w_months + 6 >= v.experience_min_months then
    f := 0.5; r := r || jsonb_build_object('key', 'experience_close', 'ok', 'warn', 'required_months', v.experience_min_months);
  else
    f := 0; r := r || jsonb_build_object('key', 'experience_low', 'ok', false, 'required_months', v.experience_min_months);
  end if;
  total := total + f * coalesce((wt->>'experience')::numeric, 10);

  -- 5. Ko'nikmalar (+ majburiy guvohnoma — qat'iy talab)
  select count(*) into w_skills from public.worker_skills ws where ws.worker_id = w.id;
  select count(*) into req_skills from public.vacancy_skills vs where vs.vacancy_id = v.id and vs.is_required;
  if req_skills = 0 then
    select count(*) into req_skills from public.vacancy_skills vs where vs.vacancy_id = v.id;
    select count(*) into matched from public.vacancy_skills vs
      join public.worker_skills ws on ws.skill_id = vs.skill_id and ws.worker_id = w.id
    where vs.vacancy_id = v.id;
  else
    select count(*) into matched from public.vacancy_skills vs
      join public.worker_skills ws on ws.skill_id = vs.skill_id and ws.worker_id = w.id
    where vs.vacancy_id = v.id and vs.is_required;
  end if;
  select count(*) into lic_missing from public.vacancy_skills vs join public.skills s on s.id = vs.skill_id
  where vs.vacancy_id = v.id and vs.is_required and s.is_license
    and not exists (select 1 from public.worker_skills ws where ws.worker_id = w.id and ws.skill_id = vs.skill_id);
  if req_skills = 0 then
    f := 1; r := r || jsonb_build_object('key', 'skills_not_required', 'ok', true);
  elsif w_skills = 0 then
    f := 0; missing := missing || 'skills'::text;
    r := r || jsonb_build_object('key', 'skills_unknown', 'ok', 'unknown', 'required', req_skills);
  else
    f := matched::numeric / req_skills;
    r := r || jsonb_build_object('key', 'skills_matched',
      'ok', case when matched = req_skills then to_jsonb(true) when matched > 0 then to_jsonb('warn'::text) else to_jsonb(false) end,
      'matched', matched, 'required', req_skills);
    if lic_missing > 0 then
      hard := hard || 'license_missing'::text;
      r := r || jsonb_build_object('key', 'license_missing', 'ok', false, 'required', lic_missing);
    end if;
  end if;
  total := total + f * coalesce((wt->>'skills')::numeric, 15);

  -- 6. Ish jadvali
  if v.schedule in ('flexible', 'negotiable') or pr.worker_id is null or cardinality(coalesce(pr.schedules, '{}')) = 0
     or v.schedule = any(pr.schedules) or 'negotiable' = any(pr.schedules) then
    f := 1; r := r || jsonb_build_object('key', 'schedule_ok', 'ok', true);
  elsif 'flexible' = any(pr.schedules) then
    f := 0.5; r := r || jsonb_build_object('key', 'schedule_partial', 'ok', 'warn');
  else
    f := 0; hard := hard || 'schedule_mismatch'::text;
    r := r || jsonb_build_object('key', 'schedule_mismatch', 'ok', false, 'vacancy_schedule', v.schedule);
  end if;
  total := total + f * coalesce((wt->>'schedule')::numeric, 10);

  -- 7. Bandlik turi (60%) va rasmiylik (40%)
  if pr.worker_id is null or cardinality(coalesce(pr.employment_types, '{}')) = 0 or v.employment_type = any(pr.employment_types) then
    f := 0.6; r := r || jsonb_build_object('key', 'employment_ok', 'ok', true);
  else
    f := 0; r := r || jsonb_build_object('key', 'employment_mismatch', 'ok', false, 'vacancy_type', v.employment_type);
  end if;
  if w.work_format = 'any' or v.work_format = 'any' or w.work_format = v.work_format then
    f := f + 0.4; r := r || jsonb_build_object('key', 'work_format_ok', 'ok', true);
  else
    r := r || jsonb_build_object('key', 'work_format_mismatch', 'ok', false, 'vacancy_format', v.work_format);
  end if;
  total := total + f * coalesce((wt->>'employment')::numeric, 5);

  -- 8. Til
  select count(*) into lang_total from public.vacancy_languages vl where vl.vacancy_id = v.id;
  select count(*) into w_langs from public.worker_languages wl where wl.worker_id = w.id;
  if lang_total = 0 then
    f := 1;
  elsif w_langs = 0 then
    f := 0; missing := missing || 'languages'::text;
    r := r || jsonb_build_object('key', 'languages_unknown', 'ok', 'unknown');
  else
    select count(*) into lang_matched from public.vacancy_languages vl
    where vl.vacancy_id = v.id and exists (
      select 1 from public.worker_languages wl where wl.worker_id = w.id and wl.language_code = vl.language_code
        and public.language_level_rank(wl.level) >= public.language_level_rank(vl.min_level));
    f := lang_matched::numeric / lang_total;
    if lang_matched = lang_total then
      r := r || jsonb_build_object('key', 'languages_ok', 'ok', true);
    else
      r := r || jsonb_build_object('key', 'languages_partial', 'ok', case when lang_matched > 0 then to_jsonb('warn'::text) else to_jsonb(false) end,
        'matched', lang_matched, 'required', lang_total);
    end if;
  end if;
  total := total + f * coalesce((wt->>'language')::numeric, 5);

  -- Ogohlantirishlar (ballga ta'sir qilmaydi)
  if v.education_min is not null and not exists (
      select 1 from public.worker_education e where e.worker_id = w.id and public.education_rank(e.level) >= public.education_rank(v.education_min)) then
    r := r || jsonb_build_object('key', 'education_required', 'ok', 'warn', 'level', v.education_min);
  end if;
  if p.birth_date is not null and (v.age_min is not null or v.age_max is not null) then
    age := extract(year from age(p.birth_date))::int;
    if (v.age_min is not null and age < v.age_min) or (v.age_max is not null and age > v.age_max) then
      r := r || jsonb_build_object('key', 'age_out_of_range', 'ok', 'warn', 'min', v.age_min, 'max', v.age_max);
    end if;
  end if;

  return jsonb_build_object(
    'score', greatest(0, least(100, round(total)))::int,
    'hard_fail', cardinality(hard) > 0,
    'hard', to_jsonb(hard),
    'complete', cardinality(missing) = 0,
    'missing', to_jsonb(missing),
    'reasons', r,
    'version', public.match_rules_version());
end $$;

-- Eski imzo (qidiruv saralash, ariza, UI) — endi v2 natijasi
create or replace function public.compute_match(p_worker_id uuid, p_vacancy_id uuid)
returns table (score int, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  w public.worker_profiles;
  m jsonb;
begin
  select * into w from public.worker_profiles where id = p_worker_id;
  if w.id is null or not exists (select 1 from public.vacancies where id = p_vacancy_id) then
    score := 0; reasons := '[]'::jsonb; return next; return;
  end if;
  if auth.role() = 'anon' or (auth.uid() is not null and not (w.profile_id = auth.uid() or public.is_admin()
      or (public.manages_vacancy(p_vacancy_id) and public.can_view_worker(p_worker_id)))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  m := public.compute_match_v2(p_worker_id, p_vacancy_id);
  score := (m->>'score')::int;
  reasons := m->'reasons';
  return next;
end $$;

-- To'liq tushuntirish (UI: sabablar, yetishmayotgan ma'lumot, qat'iy talablar)
create or replace function public.match_explain(p_worker_id uuid, p_vacancy_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w public.worker_profiles;
begin
  select * into w from public.worker_profiles where id = p_worker_id;
  if w.id is null then return null; end if;
  if auth.uid() is null or not (w.profile_id = auth.uid() or public.is_admin()
      or (public.manages_vacancy(p_vacancy_id) and public.can_view_worker(p_worker_id))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.compute_match_v2(p_worker_id, p_vacancy_id);
end $$;

-- Kesh: nomzodlar doirasi avval kasb sohasi, hudud (yoki masofaviy) va faol holat bo'yicha qisqartiriladi
create or replace function public.refresh_matches_for_vacancy(p_vacancy_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int; v public.vacancies;
begin
  if auth.uid() is not null and not (public.is_admin() or public.manages_vacancy(p_vacancy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v from public.vacancies where id = p_vacancy_id;
  delete from public.matches where vacancy_id = p_vacancy_id;
  if v.id is null or v.status <> 'active' then return 0; end if;
  insert into public.matches (worker_id, vacancy_id, score, reasons, hard_fail, complete, missing, rules_version)
  select w.id, p_vacancy_id, (m->>'score')::int, m->'reasons', (m->>'hard_fail')::boolean, (m->>'complete')::boolean,
         array(select jsonb_array_elements_text(m->'missing')), (m->>'version')::int
  from (
    select w.id from public.worker_profiles w
    join public.profiles p on p.id = w.profile_id
    where w.is_public and w.onboarding_completed_at is not null and not p.is_blocked and w.status <> 'not_looking'
      and w.category_id = v.category_id
      and (v.is_remote or w.region_id = v.region_id or w.remote_preference in ('yes', 'any')
           or exists (select 1 from public.worker_locations wl join public.districts d on d.id = wl.district_id
                      where wl.worker_id = w.id and d.region_id = v.region_id))
    order by w.last_active_at desc
    limit 1000
  ) w
  cross join lateral (select public.compute_match_v2(w.id, p_vacancy_id) as m) mm;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.refresh_matches_for_worker(p_worker_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int; w public.worker_profiles;
begin
  if auth.uid() is not null and not (public.is_admin() or exists (select 1 from public.worker_profiles x where x.id = p_worker_id and x.profile_id = auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into w from public.worker_profiles where id = p_worker_id;
  delete from public.matches where worker_id = p_worker_id;
  if w.id is null then return 0; end if;
  insert into public.matches (worker_id, vacancy_id, score, reasons, hard_fail, complete, missing, rules_version)
  select p_worker_id, v.id, (m->>'score')::int, m->'reasons', (m->>'hard_fail')::boolean, (m->>'complete')::boolean,
         array(select jsonb_array_elements_text(m->'missing')), (m->>'version')::int
  from (
    select v.id from public.vacancies v
    where v.status = 'active' and (v.category_id = w.category_id or w.category_id is null)
      and (v.is_remote or w.region_id is null or v.region_id = w.region_id or w.remote_preference in ('yes', 'any')
           or exists (select 1 from public.worker_locations wl join public.districts d on d.id = wl.district_id
                      where wl.worker_id = w.id and d.region_id = v.region_id))
    order by v.published_at desc
    limit 500
  ) v
  cross join lateral (select public.compute_match_v2(p_worker_id, v.id) as m) mm;
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin: og'irliklar va chegara (audit; versiya oshadi; eski tavsiyalar QAYTA yuborilmaydi —
-- xabarnomalar faqat yangi nashr/yangilanish hodisalarida hisoblanadi)
create or replace function public.admin_update_matching(p_weights jsonb, p_threshold int)
returns int language plpgsql security definer set search_path = public as $$
declare
  keys text[] := array['profession', 'location', 'salary', 'experience', 'skills', 'schedule', 'employment', 'language'];
  k text;
  s numeric := 0;
  before_row jsonb;
  ver int;
begin
  if not public.has_admin_permission('settings.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_threshold is null or p_threshold < 50 or p_threshold > 100 then raise exception 'invalid_threshold' using errcode = '22023'; end if;
  foreach k in array keys loop
    if jsonb_typeof(p_weights->k) <> 'number' or (p_weights->>k)::numeric < 0 or (p_weights->>k)::numeric > 60 then
      raise exception 'invalid_weights' using errcode = '22023';
    end if;
    s := s + (p_weights->>k)::numeric;
  end loop;
  if s <> 100 then raise exception 'weights_must_sum_100' using errcode = '22023'; end if;
  before_row := jsonb_build_object('weights', public.match_weights(), 'threshold', public.setting_int('match_notify_threshold', 90),
                                   'version', public.match_rules_version());
  ver := public.match_rules_version() + 1;
  insert into public.app_settings (key, value, is_public) values
    ('match_weights', (select jsonb_object_agg(k2, (p_weights->>k2)::numeric) from unnest(keys) k2), false),
    ('match_notify_threshold', to_jsonb(p_threshold), false),
    ('match_rules_version', to_jsonb(ver), false)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.write_audit('matching.update', 'app_settings', 'match_weights', before_row,
    jsonb_build_object('weights', p_weights, 'threshold', p_threshold, 'version', ver));
  return ver;
end $$;

revoke execute on function public.compute_match_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.compute_match_v2(uuid, uuid) to service_role;
revoke execute on function public.match_explain(uuid, uuid), public.admin_update_matching(jsonb, int) from public, anon;
grant execute on function public.match_explain(uuid, uuid), public.admin_update_matching(jsonb, int) to authenticated;
grant execute on function public.match_weights(), public.match_rules_version() to authenticated, service_role;
