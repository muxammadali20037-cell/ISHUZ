-- ISH.UZ · 0005 · ish beruvchi: kompaniya, a'zolar, verifikatsiya

create table public.companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text not null unique,
  logo_url             text,
  phone                text,
  telegram             text,
  website              text,
  instagram            text,
  address              text,
  region_id            uuid references public.regions(id) on delete set null,
  district_id          uuid references public.districts(id) on delete set null,
  industry_category_id uuid references public.categories(id) on delete set null,
  about                text,
  size                 public.company_size,
  tin                  text,                     -- STIR
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  is_blocked           boolean not null default false,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint companies_name_check check (length(trim(name)) between 2 and 120),
  constraint companies_website_check check (website is null or website ~* '^https?://'),
  constraint companies_tin_check check (tin is null or tin ~ '^[0-9]{9}$')
);
create index idx_companies_verification on public.companies(verification_status);
create index idx_companies_name_trgm on public.companies using gin (name extensions.gin_trgm_ops);
create trigger trg_companies_updated before update on public.companies for each row execute function public.set_updated_at();

create table public.company_members (
  company_id   uuid not null references public.companies(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  role         public.company_member_role not null default 'recruiter',
  invited_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (company_id, profile_id)
);
create index idx_company_members_profile on public.company_members(profile_id);

create table public.employer_profiles (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null unique references public.profiles(id) on delete cascade,
  employer_type        public.employer_type not null default 'person',
  company_id           uuid references public.companies(id) on delete set null,
  display_name         text,                    -- YaTT / shaxs uchun ko'rinadigan nom
  about                text,
  contact_phone        text,                    -- e'lonlarda ko'rsatiladigan telefon (ixtiyoriy)
  region_id            uuid references public.regions(id) on delete set null,
  district_id          uuid references public.districts(id) on delete set null,
  verification_status  public.verification_status not null default 'unverified',
  onboarding_completed_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint employer_profiles_phone_check check (contact_phone is null or contact_phone ~ '^\+998[0-9]{9}$')
);
create index idx_employer_profiles_company on public.employer_profiles(company_id);
create trigger trg_employer_profiles_updated before update on public.employer_profiles for each row execute function public.set_updated_at();

create table public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  type          public.verification_type not null,
  document_paths text[] not null default '{}',     -- storage: documents/<profile_id>/...
  note          text,
  status        public.verification_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  review_note   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_verification_requests_status on public.verification_requests(status, created_at);
create index idx_verification_requests_profile on public.verification_requests(profile_id);

-- Kompaniya yaratilganda yaratuvchi avtomatik owner bo'ladi
create or replace function public.handle_company_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, profile_id, role) values (new.id, new.created_by, 'owner')
    on conflict do nothing;
    update public.employer_profiles set company_id = new.id, employer_type = 'company'
    where profile_id = new.created_by and company_id is null;
  end if;
  return new;
end $$;
create trigger trg_company_created after insert on public.companies for each row execute function public.handle_company_created();

-- Slug avtomatik: "Anor Market" -> "anor-market" (+ raqam, agar band bo'lsa)
create or replace function public.handle_company_slug()
returns trigger language plpgsql as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.slug is null or new.slug = '' then
    base := nullif(public.slugify(new.name), '');
    if base is null then base := 'company'; end if;
    candidate := base;
    while exists (select 1 from public.companies where slug = candidate and id <> new.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end $$;
create trigger trg_company_slug before insert or update of name, slug on public.companies for each row execute function public.handle_company_slug();

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m where m.company_id = p_company_id and m.profile_id = auth.uid());
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m where m.company_id = p_company_id and m.profile_id = auth.uid() and m.role in ('owner', 'admin'));
$$;

create or replace function public.current_worker_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.worker_profiles where profile_id = auth.uid();
$$;

create or replace function public.current_employer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employer_profiles where profile_id = auth.uid();
$$;
