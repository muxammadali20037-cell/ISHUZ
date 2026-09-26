-- ISH.UZ · 0002 · ma'lumotnoma jadvallar (kategoriya, hudud, ko'nikma ...)

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_uz     text not null,
  name_ru     text not null,
  icon        text,                       -- lucide ikonka nomi
  sort_order  int  not null default 100,
  is_active   boolean not null default true,
  portfolio_recommended boolean not null default false, -- dizayn, qurilish, IT kabi sohalar
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_categories_updated before update on public.categories for each row execute function public.set_updated_at();

create table public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  slug        text not null,
  name_uz     text not null,
  name_ru     text not null,
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, slug)
);
create index idx_subcategories_category on public.subcategories(category_id);
create trigger trg_subcategories_updated before update on public.subcategories for each row execute function public.set_updated_at();

create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_uz     text not null,
  name_ru     text not null,
  category_id uuid references public.categories(id) on delete set null, -- qaysi sohada tavsiya qilinadi
  is_custom   boolean not null default false,   -- foydalanuvchi qo'shgan
  is_approved boolean not null default true,    -- admin tasdiqlagan
  created_by  uuid,                             -- profiles.id (FK 0003 da)
  usage_count int not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_skills_category on public.skills(category_id);
create index idx_skills_name_trgm on public.skills using gin ((name_uz || ' ' || name_ru) extensions.gin_trgm_ops);

create table public.regions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_uz     text not null,
  name_ru     text not null,
  sort_order  int not null default 100,
  is_active   boolean not null default true
);

create table public.districts (
  id          uuid primary key default gen_random_uuid(),
  region_id   uuid not null references public.regions(id) on delete cascade,
  slug        text not null,
  name_uz     text not null,
  name_ru     text not null,
  lat         double precision,
  lng         double precision,
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  unique (region_id, slug)
);
create index idx_districts_region on public.districts(region_id);

create table public.languages (
  code        text primary key,           -- 'uz', 'ru', 'en', 'tr', ...
  name_uz     text not null,
  name_ru     text not null,
  sort_order  int not null default 100,
  is_active   boolean not null default true
);

-- Qo'shimcha imkoniyatlar / rasmiy ish shartlari (ovqat, transport, mehnat shartnomasi ...)
create table public.benefits (
  code        text primary key,
  name_uz     text not null,
  name_ru     text not null,
  kind        text not null default 'benefit' check (kind in ('benefit', 'official_term')),
  sort_order  int not null default 100,
  is_active   boolean not null default true
);

-- Platforma sozlamalari (moderatsiya yoqilganmi, vakansiya muddati ...)
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now()
);
create trigger trg_app_settings_updated before update on public.app_settings for each row execute function public.set_updated_at();

insert into public.app_settings (key, value, is_public) values
  ('vacancy_moderation_enabled', 'false'::jsonb, true),
  ('vacancy_lifetime_days', '30'::jsonb, true),
  ('application_daily_limit', '30'::jsonb, false),
  ('offer_daily_limit', '50'::jsonb, false),
  ('message_minute_limit', '30'::jsonb, false);
