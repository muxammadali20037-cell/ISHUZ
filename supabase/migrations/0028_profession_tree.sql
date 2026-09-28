-- ISH.UZ · 0028 · Cheksiz chuqurlikdagi kasblar daraxti (profession_nodes).
-- Soha (categories) → guruh → kasb → yo'nalish → ... (chuqurlik cheklanmagan, parent_id orqali).
-- Ishchi va ish beruvchi BITTA daraxtdan tanlaydi. Eski category/subcategory ustunlari tugundan
-- avtomatik to'ldiriladi — filtrlar, SEO, bot va eski moslik mantig'i o'zgarmasdan ishlayveradi.

-- ---------------------------------------------------------------------------
-- Ingliz tili uchun nomlar (bo'sh bo'lsa ilovada o'zbekcha nom ko'rsatiladi)
-- ---------------------------------------------------------------------------
alter table public.categories add column if not exists name_en text;
alter table public.subcategories add column if not exists name_en text;
alter table public.regions add column if not exists name_en text;
alter table public.districts add column if not exists name_en text;
alter table public.skills add column if not exists name_en text;

-- ---------------------------------------------------------------------------
-- Matnni qidiruv uchun normallashtirish: kichik harf, apostroflar bir xil, ortiqcha bo'sh joysiz
-- ---------------------------------------------------------------------------
create or replace function public.normalize_search_text(p text)
returns text language sql immutable parallel safe as $$
  select btrim(regexp_replace(translate(lower(coalesce(p, '')), '‘’ʻʼ`´ё', repeat('''', 6) || 'е'), '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------------
-- Tugunlar
-- ---------------------------------------------------------------------------
create table if not exists public.profession_nodes (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references public.profession_nodes(id) on delete restrict,
  category_id     uuid not null references public.categories(id) on delete cascade,
  -- eski "yo'nalish" bilan bog'lanish (filtrlar/SEO uchun). Bo'sh bo'lsa ota-tugundan meros olinadi
  subcategory_id  uuid references public.subcategories(id) on delete set null,
  slug            text not null unique,
  kind            text not null default 'profession' check (kind in ('group', 'profession', 'specialization')),
  name_uz         text not null check (length(btrim(name_uz)) between 2 and 120),
  name_ru         text not null check (length(btrim(name_ru)) between 2 and 120),
  name_en         text,
  icon            text,
  aliases         text[] not null default '{}',
  -- false — faqat navigatsiya guruhi (masalan "Shifokorlar"), true — kasb sifatida tanlash mumkin
  selectable      boolean not null default true,
  is_popular      boolean not null default false,
  sort_order      int not null default 100,
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  -- trigger to'ldiradi:
  depth           int not null default 1,
  path            uuid[] not null default '{}',          -- ildizdan o'zigacha (o'zi ham)
  effective_subcategory_id uuid references public.subcategories(id) on delete set null,
  search_text     text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profession_nodes_not_self check (parent_id is distinct from id)
);
create index if not exists idx_profession_nodes_parent on public.profession_nodes(parent_id, sort_order) where is_active;
create index if not exists idx_profession_nodes_root on public.profession_nodes(category_id, sort_order) where parent_id is null and is_active;
create index if not exists idx_profession_nodes_path on public.profession_nodes using gin (path);
create index if not exists idx_profession_nodes_search on public.profession_nodes using gin (search_text extensions.gin_trgm_ops);
create index if not exists idx_profession_nodes_subcat on public.profession_nodes(effective_subcategory_id);

-- Yo'l, chuqurlik, meros subcategory va qidiruv matni. Ota o'zgarsa — butun shox qayta hisoblanadi.
create or replace function public.profession_nodes_before_write()
returns trigger language plpgsql set search_path = public as $$
declare
  parent public.profession_nodes;
begin
  if new.parent_id is not null then
    select * into parent from public.profession_nodes where id = new.parent_id;
    if parent.id is null then raise exception 'parent_not_found' using errcode = '23503'; end if;
    if new.id = any(parent.path) then raise exception 'cycle_detected' using errcode = '23514'; end if;
    new.category_id := parent.category_id;
    new.path := parent.path || new.id;
    new.depth := parent.depth + 1;
    new.effective_subcategory_id := coalesce(new.subcategory_id, parent.effective_subcategory_id);
  else
    new.path := array[new.id];
    new.depth := 1;
    new.effective_subcategory_id := new.subcategory_id;
  end if;
  new.search_text := public.normalize_search_text(concat_ws(' ', new.name_uz, new.name_ru, new.name_en, array_to_string(new.aliases, ' ')));
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profession_nodes_before on public.profession_nodes;
create trigger trg_profession_nodes_before before insert or update of parent_id, subcategory_id, name_uz, name_ru, name_en, aliases, category_id
  on public.profession_nodes for each row execute function public.profession_nodes_before_write();

-- Bolalarni qayta hisoblash (ota ko'chirilganda yoki meros o'zgarganda)
create or replace function public.profession_nodes_after_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (old.path is distinct from new.path or old.effective_subcategory_id is distinct from new.effective_subcategory_id or old.category_id is distinct from new.category_id) then
    -- bolalarning parent_id si o'zgarmaydi, lekin "update" triggerni qayta ishga tushiradi → rekursiv yangilanadi
    update public.profession_nodes c set parent_id = c.parent_id where c.parent_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists trg_profession_nodes_after on public.profession_nodes;
create trigger trg_profession_nodes_after after update on public.profession_nodes
  for each row execute function public.profession_nodes_after_write();

alter table public.profession_nodes enable row level security;
drop policy if exists "profession_nodes_read" on public.profession_nodes;
drop policy if exists "profession_nodes_admin" on public.profession_nodes;
create policy "profession_nodes_read" on public.profession_nodes for select using (true);
create policy "profession_nodes_admin" on public.profession_nodes for all
  using (public.has_admin_permission('categories.manage')) with check (public.has_admin_permission('categories.manage'));
grant select on public.profession_nodes to anon, authenticated;
grant insert, update, delete on public.profession_nodes to authenticated;

-- ---------------------------------------------------------------------------
-- Ishchi va vakansiyada tanlangan tugun. category/subcategory avtomatik to'ldiriladi.
-- ---------------------------------------------------------------------------
alter table public.worker_profiles add column if not exists profession_node_id uuid references public.profession_nodes(id) on delete set null;
alter table public.vacancies add column if not exists profession_node_id uuid references public.profession_nodes(id) on delete set null;
alter table public.vacancies add column if not exists positions_count int not null default 1 check (positions_count between 1 and 1000);
create index if not exists idx_worker_profiles_node on public.worker_profiles(profession_node_id);
create index if not exists idx_vacancies_node on public.vacancies(profession_node_id) where status = 'active';

create or replace function public.sync_profession_node_columns()
returns trigger language plpgsql set search_path = public as $$
declare n public.profession_nodes;
begin
  if new.profession_node_id is not null
     and (tg_op = 'INSERT' or new.profession_node_id is distinct from old.profession_node_id) then
    select * into n from public.profession_nodes where id = new.profession_node_id;
    if n.id is not null then
      new.category_id := n.category_id;
      new.subcategory_id := n.effective_subcategory_id;
    end if;
  elsif tg_op = 'UPDATE' and new.profession_node_id is not null and new.category_id is distinct from old.category_id then
    -- soha qo'lda almashtirilsa — eski tugun endi mos emas
    new.profession_node_id := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_worker_profiles_node on public.worker_profiles;
create trigger trg_worker_profiles_node before insert or update of profession_node_id, category_id on public.worker_profiles
  for each row execute function public.sync_profession_node_columns();
drop trigger if exists trg_vacancies_node on public.vacancies;
create trigger trg_vacancies_node before insert or update of profession_node_id, category_id on public.vacancies
  for each row execute function public.sync_profession_node_columns();

-- ---------------------------------------------------------------------------
-- Qo'shimcha kasblar (masalan: asosiy — Barista, qo'shimcha — Ofitsiant, Kassir). Tajriba har biriga alohida.
-- ---------------------------------------------------------------------------
create table if not exists public.worker_professions (
  worker_id         uuid not null references public.worker_profiles(id) on delete cascade,
  node_id           uuid not null references public.profession_nodes(id) on delete cascade,
  experience_level  public.experience_level not null default 'none',
  created_at        timestamptz not null default now(),
  primary key (worker_id, node_id)
);
alter table public.worker_professions enable row level security;
drop policy if exists "worker_professions_read" on public.worker_professions;
drop policy if exists "worker_professions_own" on public.worker_professions;
create policy "worker_professions_read" on public.worker_professions for select
  using (exists (select 1 from public.worker_profiles w where w.id = worker_id and (w.profile_id = auth.uid() or public.can_view_worker(w.id))));
create policy "worker_professions_own" on public.worker_professions for all
  using (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()))
  with check (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()));
grant select, insert, update, delete on public.worker_professions to authenticated;

create or replace function public.worker_professions_limit()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.worker_professions where worker_id = new.worker_id) >= 5 then
    raise exception 'too_many_professions' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_worker_professions_limit on public.worker_professions;
create trigger trg_worker_professions_limit before insert on public.worker_professions
  for each row execute function public.worker_professions_limit();

-- ---------------------------------------------------------------------------
-- Kasbga xos savollar tugunga ham bog'lanadi va daraxt bo'ylab meros bo'ladi
-- (masalan "Tibbiy ma'lumotingiz?" — Tibbiyotdagi barcha kasblarga, "Yurak jarrohligi tajribasi" — faqat Kardiojarrohga)
-- ---------------------------------------------------------------------------
alter table public.skill_questions add column if not exists profession_node_id uuid references public.profession_nodes(id) on delete cascade;
create index if not exists idx_skill_questions_node on public.skill_questions(profession_node_id);

-- ---------------------------------------------------------------------------
-- Qidiruv: "urolog", "svarchik", "bolalar kardiojarrohi" → tugun + to'liq yo'l (breadcrumb)
-- ---------------------------------------------------------------------------
create or replace function public.search_profession_nodes(p_query text, p_category_id uuid default null, p_limit int default 20)
returns table (
  id uuid, parent_id uuid, category_id uuid, slug text, name_uz text, name_ru text, name_en text, icon text,
  selectable boolean, has_children boolean, depth int, trail jsonb, score real
)
language sql stable security invoker set search_path = public, extensions as $$
  with q as (select public.normalize_search_text(p_query) as t),
  hits as (
    select n.*,
      (case when public.normalize_search_text(n.name_uz) = q.t or public.normalize_search_text(n.name_ru) = q.t
                 or public.normalize_search_text(coalesce(n.name_en, '')) = q.t or q.t = any(select public.normalize_search_text(a) from unnest(n.aliases) a) then 3
            when n.search_text like q.t || '%' or n.search_text like '% ' || q.t || '%' then 2
            when n.search_text like '%' || q.t || '%' then 1
            else 0 end)::real
      + word_similarity(q.t, n.search_text) as sc
    from public.profession_nodes n, q
    where n.is_active and length(q.t) >= 2
      and (p_category_id is null or n.category_id = p_category_id)
      and (n.search_text like '%' || q.t || '%' or q.t <% n.search_text)
  )
  select h.id, h.parent_id, h.category_id, h.slug, h.name_uz, h.name_ru, h.name_en, h.icon,
    h.selectable,
    exists (select 1 from public.profession_nodes c where c.parent_id = h.id and c.is_active),
    h.depth,
    (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name_uz', a.name_uz, 'name_ru', a.name_ru, 'name_en', a.name_en) order by a.depth), '[]'::jsonb)
       from public.profession_nodes a where a.id = any(h.path) and a.id <> h.id),
    h.sc
  from hits h
  order by h.sc desc, h.selectable desc, h.depth, h.sort_order
  limit greatest(1, least(p_limit, 50))
$$;
grant execute on function public.search_profession_nodes(text, uuid, int) to anon, authenticated;

-- Tugunning to'liq yo'li (breadcrumb)
create or replace function public.profession_node_trail(p_node_id uuid)
returns table (id uuid, name_uz text, name_ru text, name_en text, selectable boolean, depth int)
language sql stable security invoker set search_path = public as $$
  select a.id, a.name_uz, a.name_ru, a.name_en, a.selectable, a.depth
  from public.profession_nodes n
  join public.profession_nodes a on a.id = any(n.path)
  where n.id = p_node_id
  order by a.depth
$$;
grant execute on function public.profession_node_trail(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ierarxik moslik: ikki tugun qanchalik yaqin.
-- 3 — aynan bir kasb, 2 — ishchi so'ralgan kasbning ichki yo'nalishi (masalan Frontend → React),
-- 1 — ishchi umumiyroq (React so'ralgan, ishchi Frontend), 0 — bir shox (umumiy guruh), -1 — faqat bir soha
-- ---------------------------------------------------------------------------
create or replace function public.profession_relation(p_worker_path uuid[], p_vacancy_path uuid[])
returns int language sql immutable parallel safe as $$
  select case
    when p_worker_path is null or p_vacancy_path is null or cardinality(p_worker_path) = 0 or cardinality(p_vacancy_path) = 0 then null
    when p_worker_path = p_vacancy_path then 3
    when p_worker_path @> p_vacancy_path then 2
    when p_vacancy_path @> p_worker_path then 1
    when p_worker_path[1] = p_vacancy_path[1] then 0
    else -1 end
$$;

-- ---------------------------------------------------------------------------
-- compute_match: 1-bo'lim (kasb, 25 ball) endi daraxtni hisobga oladi. Qolgan bo'limlar 0013 dagidek.
-- Tugun yo'q bo'lsa — eski category/subcategory mantig'i.
-- ---------------------------------------------------------------------------
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
  v_path uuid[];
  rel int;
begin
  select * into w from public.worker_profiles where id = p_worker_id;
  select * into v from public.vacancies where id = p_vacancy_id;
  if w.id is null or v.id is null then
    score := 0; reasons := '[]'::jsonb; return next; return;
  end if;
  if auth.role() = 'anon' or (auth.uid() is not null and not (w.profile_id = auth.uid() or public.is_admin()
      or (public.manages_vacancy(p_vacancy_id) and public.can_view_worker(p_worker_id)))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into pr from public.worker_preferences where worker_id = w.id;
  select * into p from public.profiles where id = w.profile_id;

  -- 1. Kasb (25)
  if v.profession_node_id is not null then
    select n.path into v_path from public.profession_nodes n where n.id = v.profession_node_id;
    -- asosiy va qo'shimcha kasblardan eng yaqini
    select max(public.profession_relation(n.path, v_path)) into rel
    from public.profession_nodes n
    where n.id = w.profession_node_id
       or n.id in (select wp.node_id from public.worker_professions wp where wp.worker_id = w.id);
  end if;
  if rel is not null and rel >= 0 then
    if rel = 3 then
      s := s + 25; r := r || jsonb_build_object('key', 'profession_exact', 'ok', true);
    elsif rel = 2 then
      s := s + 23; r := r || jsonb_build_object('key', 'profession_specialist', 'ok', true);
    elsif rel = 1 then
      s := s + 17; r := r || jsonb_build_object('key', 'profession_general', 'ok', 'warn');
    else
      s := s + 12; r := r || jsonb_build_object('key', 'profession_related', 'ok', 'warn');
    end if;
  elsif rel = -1 and w.category_id = v.category_id then
    s := s + 8; r := r || jsonb_build_object('key', 'profession_other_branch', 'ok', 'warn');
  elsif w.category_id is not null and w.category_id = v.category_id then
    if v.subcategory_id is null or w.subcategory_id = v.subcategory_id then
      s := s + 25; r := r || jsonb_build_object('key', 'category_match', 'ok', true);
    else
      s := s + 18; r := r || jsonb_build_object('key', 'category_match_partial', 'ok', 'warn');
    end if;
  else
    r := r || jsonb_build_object('key', 'category_mismatch', 'ok', false);
  end if;

  -- 2. Joylashuv (15)
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

  -- 3. Maosh (15)
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

  -- 5. Ko'nikmalar (15)
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

-- ---------------------------------------------------------------------------
-- Admin: tugunni o'chirish o'rniga birlashtirish (ishlatilgan kasb yo'qolmasin)
-- ---------------------------------------------------------------------------
create or replace function public.admin_merge_profession_node(p_from uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f public.profession_nodes; t public.profession_nodes;
begin
  if not public.has_admin_permission('categories.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into f from public.profession_nodes where id = p_from;
  select * into t from public.profession_nodes where id = p_into;
  if f.id is null or t.id is null or f.id = t.id then raise exception 'invalid_nodes' using errcode = '23514'; end if;
  if f.id = any(t.path) then raise exception 'cannot_merge_into_descendant' using errcode = '23514'; end if;
  update public.profession_nodes set parent_id = t.id where parent_id = f.id;
  update public.worker_profiles set profession_node_id = t.id where profession_node_id = f.id;
  update public.vacancies set profession_node_id = t.id where profession_node_id = f.id;
  insert into public.worker_professions (worker_id, node_id, experience_level)
    select worker_id, t.id, experience_level from public.worker_professions where node_id = f.id
    on conflict do nothing;
  delete from public.worker_professions where node_id = f.id;
  update public.skill_questions set profession_node_id = t.id where profession_node_id = f.id;
  update public.profession_nodes set aliases = (select array(select distinct unnest(t.aliases || f.aliases || array[f.name_uz, f.name_ru]))) where id = t.id;
  update public.profession_nodes set is_active = false, parent_id = null where id = f.id;
  perform public.write_audit('profession.merge', 'profession_node', f.id::text, to_jsonb(f), jsonb_build_object('into', t.id));
end $$;
revoke execute on function public.admin_merge_profession_node(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_profession_node(uuid, uuid) to authenticated;

-- O'zgarishlar tarixi (kim, nima, eski ota/nom)
create or replace function public.profession_nodes_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if; -- migratsiya/seed yozuvlari tarixga yozilmaydi
  if tg_op = 'INSERT' then
    perform public.write_audit('profession.create', 'profession_node', new.id::text, null, jsonb_build_object('name_uz', new.name_uz, 'parent_id', new.parent_id));
  elsif tg_op = 'UPDATE' and (old.parent_id is distinct from new.parent_id or old.name_uz is distinct from new.name_uz or old.is_active is distinct from new.is_active or old.name_ru is distinct from new.name_ru) then
    perform public.write_audit('profession.update', 'profession_node', new.id::text,
      jsonb_build_object('name_uz', old.name_uz, 'name_ru', old.name_ru, 'parent_id', old.parent_id, 'is_active', old.is_active),
      jsonb_build_object('name_uz', new.name_uz, 'name_ru', new.name_ru, 'parent_id', new.parent_id, 'is_active', new.is_active));
  end if;
  return null;
end $$;
drop trigger if exists trg_profession_nodes_audit on public.profession_nodes;
create trigger trg_profession_nodes_audit after insert or update on public.profession_nodes
  for each row execute function public.profession_nodes_audit();

-- Ishlatilayotgan tugunni o'chirib bo'lmaydi — faqat nofaol qilish yoki birlashtirish
create or replace function public.profession_nodes_guard_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.worker_profiles where profession_node_id = old.id)
     or exists (select 1 from public.vacancies where profession_node_id = old.id)
     or exists (select 1 from public.worker_professions where node_id = old.id) then
    raise exception 'node_in_use' using errcode = '23503';
  end if;
  return old;
end $$;
drop trigger if exists trg_profession_nodes_guard_delete on public.profession_nodes;
create trigger trg_profession_nodes_guard_delete before delete on public.profession_nodes
  for each row execute function public.profession_nodes_guard_delete();

-- Admin statistikasi: har bir tugunda nechta faol vakansiya va profil (butun shox bilan)
create or replace function public.admin_profession_node_stats(p_parent_id uuid default null, p_category_id uuid default null)
returns table (id uuid, vacancies bigint, profiles bigint)
language sql stable security definer set search_path = public as $$
  select n.id,
    (select count(*) from public.vacancies v join public.profession_nodes x on x.id = v.profession_node_id where v.status = 'active' and n.id = any(x.path)),
    (select count(*) from public.worker_profiles w join public.profession_nodes x on x.id = w.profession_node_id where n.id = any(x.path))
  from public.profession_nodes n
  where public.has_admin_permission('categories.manage')
    and (case when p_parent_id is not null then n.parent_id = p_parent_id else n.parent_id is null and n.category_id = p_category_id end)
$$;
revoke execute on function public.admin_profession_node_stats(uuid, uuid) from public, anon;
grant execute on function public.admin_profession_node_stats(uuid, uuid) to authenticated;
