-- ISH.UZ · 0004 · ish qidiruvchi (worker) jadvallari

create table public.worker_profiles (
  id                       uuid primary key default gen_random_uuid(),
  profile_id               uuid not null unique references public.profiles(id) on delete cascade,
  headline                 text,                                -- "Sotuvchi-konsultant"
  category_id              uuid references public.categories(id) on delete set null,
  subcategory_id           uuid references public.subcategories(id) on delete set null,
  experience_level         public.experience_level not null default 'none',
  about                    text,
  status                   public.worker_status not null default 'active',
  region_id                uuid references public.regions(id) on delete set null,
  district_id              uuid references public.districts(id) on delete set null,
  area_hint                text,                                -- mahalla / hudud (ixtiyoriy)
  remote_preference        public.remote_preference not null default 'any',
  work_format              public.work_format not null default 'any',   -- rasmiy / norasmiy / farqi yo'q
  is_public                boolean not null default true,
  onboarding_step          int not null default 1,
  onboarding_completed_at  timestamptz,
  completeness             int not null default 0,              -- 0..100, trigger/RPC hisoblaydi
  views_count              int not null default 0,
  last_active_at           timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint worker_profiles_completeness_check check (completeness between 0 and 100),
  constraint worker_profiles_onboarding_step_check check (onboarding_step between 1 and 9)
);
create index idx_worker_profiles_search on public.worker_profiles(category_id, region_id, status) where is_public;
create index idx_worker_profiles_district on public.worker_profiles(district_id);
create index idx_worker_profiles_last_active on public.worker_profiles(last_active_at desc);
create trigger trg_worker_profiles_updated before update on public.worker_profiles for each row execute function public.set_updated_at();

-- Aniq joylashuv faqat masofa hisoblash uchun; boshqa foydalanuvchilar ko'rmaydi (RLS: faqat egasi)
create table public.worker_geo (
  worker_id   uuid primary key references public.worker_profiles(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  updated_at  timestamptz not null default now()
);
create trigger trg_worker_geo_updated before update on public.worker_geo for each row execute function public.set_updated_at();

-- STEP 8: ish istagi
create table public.worker_preferences (
  worker_id             uuid primary key references public.worker_profiles(id) on delete cascade,
  employment_types      public.employment_type[] not null default '{}',
  schedules             public.work_schedule[] not null default '{}',
  work_time_from        time,
  work_time_to          time,
  salary_min            int,
  salary_expected       int,
  salary_type           public.salary_type not null default 'monthly',
  availability          public.availability not null default 'negotiable',
  official_terms        text[] not null default '{}',           -- benefits.code (kind = official_term)
  updated_at            timestamptz not null default now(),
  constraint worker_preferences_salary_check check (
    (salary_min is null or salary_min >= 0) and (salary_expected is null or salary_expected >= 0)
    and (salary_min is null or salary_expected is null or salary_expected >= salary_min))
);
create trigger trg_worker_preferences_updated before update on public.worker_preferences for each row execute function public.set_updated_at();

-- Qayerlarda ishlay oladi (bir nechta tuman)
create table public.worker_locations (
  worker_id    uuid not null references public.worker_profiles(id) on delete cascade,
  district_id  uuid not null references public.districts(id) on delete cascade,
  primary key (worker_id, district_id)
);
create index idx_worker_locations_district on public.worker_locations(district_id);

create table public.worker_skills (
  worker_id   uuid not null references public.worker_profiles(id) on delete cascade,
  skill_id    uuid not null references public.skills(id) on delete cascade,
  level       public.skill_level not null default 'good',
  primary key (worker_id, skill_id)
);
create index idx_worker_skills_skill on public.worker_skills(skill_id);

create table public.worker_languages (
  worker_id      uuid not null references public.worker_profiles(id) on delete cascade,
  language_code  text not null references public.languages(code) on delete cascade,
  level          public.language_level not null default 'b1',
  primary key (worker_id, language_code)
);

create table public.worker_experience (
  id                uuid primary key default gen_random_uuid(),
  worker_id         uuid not null references public.worker_profiles(id) on delete cascade,
  company_name      text not null,
  position          text not null,
  started_on        date not null,
  ended_on          date,
  is_current        boolean not null default false,
  responsibilities  text,
  achievements      text,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  constraint worker_experience_dates_check check (ended_on is null or ended_on >= started_on),
  constraint worker_experience_current_check check (not (is_current and ended_on is not null))
);
create index idx_worker_experience_worker on public.worker_experience(worker_id);

create table public.worker_education (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references public.worker_profiles(id) on delete cascade,
  level         public.education_level not null,
  institution   text,
  field         text,
  started_year  int,
  ended_year    int,
  created_at    timestamptz not null default now(),
  constraint worker_education_years_check check (
    (started_year is null or started_year between 1950 and 2100) and
    (ended_year is null or ended_year between 1950 and 2100) and
    (started_year is null or ended_year is null or ended_year >= started_year))
);
create index idx_worker_education_worker on public.worker_education(worker_id);

create table public.worker_portfolio (
  id           uuid primary key default gen_random_uuid(),
  worker_id    uuid not null references public.worker_profiles(id) on delete cascade,
  title        text not null,
  description  text,
  type         public.portfolio_type not null default 'image',
  media_paths  text[] not null default '{}',   -- storage: portfolio/<worker_id>/...
  link_url     text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  constraint worker_portfolio_link_check check (link_url is null or link_url ~* '^https?://'),
  constraint worker_portfolio_media_limit check (cardinality(media_paths) <= 10)
);
create index idx_worker_portfolio_worker on public.worker_portfolio(worker_id);

-- Profil to'liqligi (0..100) va tavsiyalar
create or replace function public.worker_completeness(p_worker_id uuid)
returns table (score int, suggestions text[]) language plpgsql stable security definer set search_path = public as $$
declare
  w public.worker_profiles;
  p public.profiles;
  pr public.worker_preferences;
  s int := 0;
  tips text[] := '{}';
begin
  select * into w from public.worker_profiles where id = p_worker_id;
  if not found then return; end if;
  select * into p from public.profiles where id = w.profile_id;
  select * into pr from public.worker_preferences where worker_id = w.id;

  if p.first_name <> '' and p.last_name <> '' then s := s + 10; else tips := array_append(tips, 'add_name'); end if;
  if p.avatar_url is not null then s := s + 10; else tips := array_append(tips, 'add_photo'); end if;
  if w.category_id is not null then s := s + 15; else tips := array_append(tips, 'add_category'); end if;
  if w.headline is not null and length(w.headline) > 2 then s := s + 5; else tips := array_append(tips, 'add_headline'); end if;
  if w.region_id is not null then s := s + 10; else tips := array_append(tips, 'add_location'); end if;
  if (select count(*) from public.worker_skills where worker_id = w.id) >= 3 then s := s + 15; else tips := array_append(tips, 'add_skills'); end if;
  if (select count(*) from public.worker_experience where worker_id = w.id) >= 1 or w.experience_level = 'none' then s := s + 10; else tips := array_append(tips, 'add_experience'); end if;
  if (select count(*) from public.worker_education where worker_id = w.id) >= 1 then s := s + 5; else tips := array_append(tips, 'add_education'); end if;
  if pr.worker_id is not null and (pr.salary_expected is not null or pr.salary_min is not null) then s := s + 10; else tips := array_append(tips, 'add_salary'); end if;
  if (select count(*) from public.worker_languages where worker_id = w.id) >= 1 then s := s + 5; else tips := array_append(tips, 'add_languages'); end if;
  if (select count(*) from public.worker_portfolio where worker_id = w.id) >= 1 then s := s + 5; else tips := array_append(tips, 'add_portfolio'); end if;

  score := least(s, 100);
  suggestions := tips;
  return next;
end $$;

create or replace function public.refresh_worker_completeness(p_worker_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  sc int;
begin
  select score into sc from public.worker_completeness(p_worker_id);
  update public.worker_profiles set completeness = coalesce(sc, 0) where id = p_worker_id;
  return coalesce(sc, 0);
end $$;

-- Bog'liq jadvallar o'zgarganda to'liqlikni qayta hisoblash
create or replace function public.trg_refresh_worker_completeness()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wid uuid;
begin
  if tg_table_name = 'worker_profiles' then
    wid := coalesce(new.id, old.id);
  elsif tg_table_name = 'profiles' then
    select id into wid from public.worker_profiles where profile_id = coalesce(new.id, old.id);
  else
    wid := coalesce(new.worker_id, old.worker_id);
  end if;
  if wid is not null then
    perform public.refresh_worker_completeness(wid);
  end if;
  return null;
end $$;

create trigger trg_wp_completeness after insert or update of headline, category_id, region_id, experience_level on public.worker_profiles
  for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_profiles_completeness after update of first_name, last_name, avatar_url on public.profiles
  for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_ws_completeness after insert or delete on public.worker_skills for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_we_completeness after insert or delete on public.worker_experience for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_wed_completeness after insert or delete on public.worker_education for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_wl_completeness after insert or delete on public.worker_languages for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_wpf_completeness after insert or delete on public.worker_portfolio for each row execute function public.trg_refresh_worker_completeness();
create trigger trg_wpr_completeness after insert or update on public.worker_preferences for each row execute function public.trg_refresh_worker_completeness();
