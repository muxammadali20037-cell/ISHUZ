-- ISH.UZ · 0006 · vakansiyalar

create table public.vacancies (
  id                    uuid primary key default gen_random_uuid(),
  owner_profile_id      uuid references public.profiles(id) on delete set null,          -- yaratgan foydalanuvchi (hisob o'chsa kompaniya vakansiyasi qoladi)
  company_id            uuid references public.companies(id) on delete set null,
  title                 text not null,
  slug                  text not null unique,           -- SEO: kassir-anor-market-toshkent-ab12cd
  category_id           uuid references public.categories(id) on delete set null,
  subcategory_id        uuid references public.subcategories(id) on delete set null,
  description           text,                            -- markdown
  region_id             uuid references public.regions(id) on delete set null,
  district_id           uuid references public.districts(id) on delete set null,
  address               text,
  lat                   double precision,
  lng                   double precision,
  is_remote             boolean not null default false,
  salary_from           int,
  salary_to             int,
  salary_type           public.salary_type not null default 'monthly',
  salary_negotiable     boolean not null default false,
  employment_type       public.employment_type not null default 'full_time',
  schedule              public.work_schedule not null default '5_2',
  work_time_from        time,
  work_time_to          time,
  experience_min_months int not null default 0,          -- 0, 6, 12, 24, 36, 60
  age_min               int,
  age_max               int,
  education_min         public.education_level,
  gender                public.gender,
  work_format           public.work_format not null default 'official',
  official_terms        text[] not null default '{}',   -- benefits.code (kind = official_term)
  status                public.vacancy_status not null default 'draft',
  moderation_note       text,
  requires_review       boolean not null default false,  -- admin yashirgan/rad etgan: qayta e'lon faqat moderatsiya orqali
  published_at          timestamptz,
  expires_at            timestamptz,
  views_count           int not null default 0,
  applications_count    int not null default 0,
  is_featured           boolean not null default false,  -- monetizatsiya (kelajak)
  featured_until        timestamptz,
  search_vector         tsvector,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint vacancies_title_check check (length(trim(title)) between 2 and 120),
  constraint vacancies_salary_check check (
    (salary_from is null or salary_from >= 0) and (salary_to is null or salary_to >= 0) and
    (salary_from is null or salary_to is null or salary_to >= salary_from)),
  constraint vacancies_age_check check (
    (age_min is null or age_min between 14 and 80) and (age_max is null or age_max between 14 and 80) and
    (age_min is null or age_max is null or age_max >= age_min)),
  constraint vacancies_experience_check check (experience_min_months between 0 and 240)
);
create index idx_vacancies_active on public.vacancies(category_id, region_id, published_at desc) where status = 'active';
create index idx_vacancies_owner on public.vacancies(owner_profile_id);
create index idx_vacancies_company on public.vacancies(company_id);
create index idx_vacancies_status on public.vacancies(status, expires_at);
create index idx_vacancies_search on public.vacancies using gin (search_vector);
create index idx_vacancies_title_trgm on public.vacancies using gin (title extensions.gin_trgm_ops);
create trigger trg_vacancies_updated before update on public.vacancies for each row execute function public.set_updated_at();

create table public.vacancy_skills (
  vacancy_id   uuid not null references public.vacancies(id) on delete cascade,
  skill_id     uuid not null references public.skills(id) on delete cascade,
  is_required  boolean not null default true,
  primary key (vacancy_id, skill_id)
);
create index idx_vacancy_skills_skill on public.vacancy_skills(skill_id);

create table public.vacancy_languages (
  vacancy_id     uuid not null references public.vacancies(id) on delete cascade,
  language_code  text not null references public.languages(code) on delete cascade,
  min_level      public.language_level not null default 'b1',
  primary key (vacancy_id, language_code)
);

create table public.vacancy_benefits (
  vacancy_id    uuid not null references public.vacancies(id) on delete cascade,
  benefit_code  text not null references public.benefits(code) on delete cascade,
  primary key (vacancy_id, benefit_code)
);

-- Slug + qidiruv vektori
create or replace function public.handle_vacancy_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cname text;
  rname text;
  base text;
begin
  select name into cname from public.companies where id = new.company_id;
  select name_uz into rname from public.regions where id = new.region_id;
  if new.slug is null or new.slug = '' then
    base := public.slugify(concat_ws(' ', new.title, cname, rname));
    new.slug := left(coalesce(nullif(base, ''), 'vakansiya'), 80) || '-' || left(replace(new.id::text, '-', ''), 6);
  end if;
  new.search_vector :=
    setweight(to_tsvector('public.ishuz', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('public.ishuz', coalesce(cname, '')), 'B') ||
    setweight(to_tsvector('public.ishuz', coalesce(new.description, '')), 'C');
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'active' and new.expires_at is null then
    new.expires_at := now() + make_interval(days => coalesce((select (value)::int from public.app_settings where key = 'vacancy_lifetime_days'), 30));
  end if;
  return new;
end $$;
create trigger trg_vacancy_before_write before insert or update on public.vacancies for each row execute function public.handle_vacancy_before_write();

-- Vakansiyani kim ko'ra/boshqara oladi: egasi yoki kompaniya a'zosi (viewer ham ko'radi)
create or replace function public.manages_vacancy(p_vacancy_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vacancies v
    where v.id = p_vacancy_id
      and (v.owner_profile_id = auth.uid() or (v.company_id is not null and public.is_company_member(v.company_id)))
  );
$$;

-- Vakansiyani kim TAHRIRLAY oladi: egasi yoki owner/admin/recruiter rolidagi a'zo (viewer emas)
create or replace function public.can_edit_vacancy(p_vacancy_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vacancies v
    where v.id = p_vacancy_id
      and (v.owner_profile_id = auth.uid() or (v.company_id is not null and exists (
        select 1 from public.company_members m where m.company_id = v.company_id and m.profile_id = auth.uid() and m.role in ('owner', 'admin', 'recruiter'))))
  ) and public.is_active_user();
$$;

-- Muddati o'tgan vakansiyalarni yopish (pg_cron: har soat)
create or replace function public.expire_vacancies()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update public.vacancies set status = 'expired'
  where status = 'active' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
