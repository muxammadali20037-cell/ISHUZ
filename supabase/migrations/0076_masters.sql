-- 0076 · "Universal ustalar" — xizmat ko'rsatuvchi ustalar bozori (2026-11-12, egasi talabi).
--
-- Doimiy ish vakansiyalaridan ALOHIDA jadvallar (aralashmaydi): master_categories (12 ta xizmat turi), master_listings (usta
-- e'lonlari), master_requests (mijoz so'rovlari), master_reviews (sharhlar — bitta foydalanuvchi bitta e'longa bir marta).
--
-- Qoidalar:
--  • Yangi e'lon admin (vacancies.moderate huquqi) tasdig'idan keyin chiqadi: draft → pending_review → active | rejected.
--    Egasi faol e'lonni yashirishi/qaytarishi mumkin; mazmuni o'zgarsa — qayta moderatsiya (trigger).
--  • Telefon faqat egasi roziligi (phone_public) bilan va faqat faol e'londa ko'rsatiladi; ommaviy o'qish faqat
--    SECURITY DEFINER funksiyalar orqali (jadvalga anon kira olmaydi). Ro'yxatda ham telefon yo'q — faqat e'lon sahifasida.
--  • Reyting faqat haqiqiy sharhlardan (trigger hisoblaydi); demo e'lonlarga sharh yozib bo'lmaydi, reytingi yo'q.
--  • Demo e'lonlar (is_demo) — har kategoriyaga 4 tadan, egasiz, telefonsiz, "Demo" belgisi bilan; master_demo_remove()
--    bir buyruqda olib tashlaydi. Haqiqiy e'lonlar bilan aralashmaydi (alohida bayroq, alohida tozalash).
--  • Ko'rishlar va telefon bosishlar — hisoblagichlar (master_listing_hit) va mijoz so'rovi (master_request_create) — faqat
--    server kaliti bilan: ilova IP/foydalanuvchi limitini qo'yib chaqiradi (to'g'ridan-to'g'ri REST'dan chaqirib bo'lmaydi).
--  • anon chaqira oladigan SECURITY DEFINER funksiyalar faqat o'qish: master_listings_public, master_listing_public,
--    master_category_counts (telefonsiz / rozilik bilan) — supabase/tests/security_hardening.test.sql ro'yxatiga qo'shilgan.
--
-- Rollback: supabase/rollbacks/0076_masters.down.sql

-- ---------------------------------------------------------------------------------------------------
-- 1. Turlar va jadvallar
-- ---------------------------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'master_listing_status') then
    create type public.master_listing_status as enum ('draft', 'pending_review', 'active', 'hidden', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'master_request_status') then
    create type public.master_request_status as enum ('new', 'seen', 'done');
  end if;
end $$;

create table if not exists public.master_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]{2,40}$'),
  name_uz text not null,
  name_ru text not null,
  name_en text not null,
  name_oz text not null,
  /** lucide belgisi nomi (ilova xaritasi bo'yicha) */
  icon text not null default 'wrench',
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table if not exists public.master_listings (
  id uuid primary key default gen_random_uuid(),
  -- egasi; faqat demo e'londa bo'sh
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  category_id uuid not null references public.master_categories(id),
  slug text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 60),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  experience_years int not null default 0 check (experience_years between 0 and 60),
  -- qo'shimcha xizmatlar (chiplar), har biri qisqa
  services text[] not null default '{}' check (cardinality(services) <= 12),
  region_id uuid references public.regions(id),
  district_id uuid references public.districts(id),
  service_area text check (char_length(service_area) <= 200),
  phone text check (phone ~ '^\+998\d{9}$'),
  phone_public boolean not null default false,
  price_from int check (price_from is null or price_from between 0 and 1000000000),
  price_to int check (price_to is null or price_to between 0 and 1000000000),
  price_negotiable boolean not null default true,
  work_from time,
  work_to time,
  -- tekshirilgan rasmlar (vacancy-photos: <egasi>/v-<sha256>.webp), eng ko'pi 4 ta
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  status public.master_listing_status not null default 'draft',
  reject_reason text check (char_length(reject_reason) <= 500),
  is_demo boolean not null default false,
  views_count int not null default 0,
  phone_clicks_count int not null default 0,
  rating_avg numeric(3,2) check (rating_avg is null or (rating_avg between 1 and 5)),
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint master_listings_owner_or_demo check (is_demo or owner_profile_id is not null),
  constraint master_listings_demo_no_phone check (not is_demo or (phone is null and not phone_public)),
  constraint master_listings_price check (price_negotiable or price_from is not null or price_to is not null),
  constraint master_listings_price_order check (price_from is null or price_to is null or price_to >= price_from),
  constraint master_listings_phone_consent check (not phone_public or phone is not null)
);

create index if not exists idx_master_listings_active on public.master_listings (category_id, published_at desc) where status = 'active';
create index if not exists idx_master_listings_active_region on public.master_listings (region_id, published_at desc) where status = 'active';
create index if not exists idx_master_listings_owner on public.master_listings (owner_profile_id);
create index if not exists idx_master_listings_pending on public.master_listings (created_at) where status = 'pending_review';
create index if not exists idx_master_listings_title_trgm on public.master_listings using gin (title extensions.gin_trgm_ops);

create table if not exists public.master_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.master_listings(id) on delete cascade,
  client_profile_id uuid references public.profiles(id) on delete set null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_phone text not null check (client_phone ~ '^\+998\d{9}$'),
  message text check (char_length(message) <= 1000),
  status public.master_request_status not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists idx_master_requests_listing on public.master_requests (listing_id, created_at desc);

create table if not exists public.master_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.master_listings(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text text check (char_length(text) <= 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, author_profile_id)
);
create index if not exists idx_master_reviews_listing on public.master_reviews (listing_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------
-- 2. Kategoriyalar (12 ta) — tahrirlash: admin → ma'lumotnomalar
-- ---------------------------------------------------------------------------------------------------
insert into public.master_categories (slug, name_uz, name_ru, name_en, name_oz, icon, sort_order) values
  ('ac',        'Konditsioner ustasi',     'Мастер по кондиционерам',   'Air conditioner technician', 'Кондиционер устаси',      'snowflake',    10),
  ('plumber',   'Santexnik',               'Сантехник',                 'Plumber',                    'Сантехник',               'droplets',     20),
  ('electric',  'Elektrik',                'Электрик',                  'Electrician',                'Электрик',                'zap',          30),
  ('appliance', 'Maishiy texnika ustasi',  'Мастер по бытовой технике', 'Appliance repair',           'Маиший техника устаси',   'washing',      40),
  ('repair',    'Ta''mirlash ustasi',      'Мастер по ремонту',         'Home repair',                'Таъмирлаш устаси',        'hammer',       50),
  ('painter',   'Bo''yoqchi',              'Маляр',                     'Painter',                    'Бўёқчи',                  'paint',        60),
  ('builder',   'Quruvchi',                'Строитель',                 'Builder',                    'Қурувчи',                 'brick',        70),
  ('welder',    'Payvandchi',              'Сварщик',                   'Welder',                     'Пайвандчи',               'flame',        80),
  ('locksmith', 'Qulf ustasi',             'Мастер по замкам',          'Locksmith',                  'Қулф устаси',             'key',          90),
  ('moving',    'Yuk tashish',             'Грузоперевозки',            'Moving and transport',       'Юк ташиш',                'truck',       100),
  ('furniture', 'Mebel yig''uvchi',        'Сборщик мебели',            'Furniture assembly',         'Мебель йиғувчи',          'armchair',    110),
  ('other',     'Boshqa xizmatlar',        'Другие услуги',             'Other services',             'Бошқа хизматлар',         'grid',        120)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 3. Triggerlar: updated_at; egasining holat o'tishlari va qayta moderatsiya; reyting
-- ---------------------------------------------------------------------------------------------------
-- Rasm yo'llari: faqat egasining papkasidagi tekshirilgan (serverda qayta kodlangan) fayllar — <egasi>/v-<sha256>.webp.
-- Mijoz "v-" faylni o'zi yoza olmaydi (0058 storage siyosati), shuning uchun boshqa yo'l = tekshirilmagan fayl.
create or replace function public.master_photos_ok(p_owner uuid, p_photos text[])
returns boolean language sql immutable set search_path = public as $$
  select coalesce(bool_and(p ~ ('^' || p_owner::text || '/v-[0-9a-f]{64}\.webp$')), true) from unnest(p_photos) p;
$$;

create or replace function public.trg_master_listing_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_master_listing_touch on public.master_listings;
create trigger trg_master_listing_touch before update on public.master_listings for each row execute function public.trg_master_listing_touch();

-- Egasi (admin emas) uchun: ruxsat etilgan o'tishlar — draft→pending_review, active↔hidden, rejected→pending_review;
-- faol/yashirin/rad etilgan e'lon mazmuni o'zgarsa — pending_review (qayta moderatsiya). 'active' ni faqat admin qo'yadi.
create or replace function public.trg_master_listing_owner_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  content_changed boolean;
begin
  -- server kaliti / SECURITY DEFINER funksiya (moderatsiya, demo) yoki admin — cheklovsiz
  if not public.is_client_write() or public.has_admin_permission('vacancies.moderate') then
    if new.status = 'active' and old.status <> 'active' then new.published_at := coalesce(new.published_at, now()); end if;
    return new;
  end if;
  if new.photos <> old.photos and not public.master_photos_ok(old.owner_profile_id, new.photos) then
    raise exception 'master_listing_photo_path' using errcode = '42501';
  end if;
  if new.owner_profile_id is distinct from old.owner_profile_id or new.is_demo or new.views_count <> old.views_count
     or new.phone_clicks_count <> old.phone_clicks_count or new.rating_avg is distinct from old.rating_avg or new.rating_count <> old.rating_count
     or new.published_at is distinct from old.published_at or new.reject_reason is distinct from old.reject_reason then
    raise exception 'master_listing_readonly_fields' using errcode = '42501';
  end if;
  content_changed := new.category_id <> old.category_id or new.title <> old.title or new.description <> old.description
    or new.display_name <> old.display_name or new.experience_years <> old.experience_years or new.services <> old.services
    or new.region_id is distinct from old.region_id or new.district_id is distinct from old.district_id
    or new.service_area is distinct from old.service_area or new.phone is distinct from old.phone
    or new.price_from is distinct from old.price_from or new.price_to is distinct from old.price_to
    or new.price_negotiable <> old.price_negotiable or new.work_from is distinct from old.work_from
    or new.work_to is distinct from old.work_to or new.photos <> old.photos;
  if new.status <> old.status then
    if not ((old.status = 'draft' and new.status = 'pending_review')
         or (old.status = 'rejected' and new.status = 'pending_review')
         or (old.status = 'active' and new.status = 'hidden')
         or (old.status = 'hidden' and new.status = 'active' and not content_changed)
         or (old.status in ('pending_review', 'rejected', 'hidden') and new.status = 'draft')) then
      raise exception 'master_listing_status_transition' using errcode = '42501';
    end if;
  end if;
  if content_changed and old.status in ('active', 'hidden', 'rejected') and new.status in ('active', 'hidden', 'rejected') then
    new.status := 'pending_review';
  end if;
  -- telefon ko'rsatish roziligi o'zgarishi moderatsiya talab qilmaydi
  return new;
end $$;
drop trigger if exists trg_master_listing_owner_guard on public.master_listings;
create trigger trg_master_listing_owner_guard before update on public.master_listings for each row execute function public.trg_master_listing_owner_guard();

-- Insert: egasi faqat draft yoki pending_review bilan, demo emas, hisoblagichlar nol
create or replace function public.trg_master_listing_insert_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_client_write() or public.has_admin_permission('vacancies.moderate') then return new; end if;
  if new.is_demo or new.status not in ('draft', 'pending_review') or new.owner_profile_id is distinct from auth.uid()
     or new.views_count <> 0 or new.phone_clicks_count <> 0 or new.rating_avg is not null or new.rating_count <> 0 or new.published_at is not null then
    raise exception 'master_listing_insert_fields' using errcode = '42501';
  end if;
  if not public.master_photos_ok(new.owner_profile_id, new.photos) then
    raise exception 'master_listing_photo_path' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_master_listing_insert_guard on public.master_listings;
create trigger trg_master_listing_insert_guard before insert on public.master_listings for each row execute function public.trg_master_listing_insert_guard();

create or replace function public.trg_master_review_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lid uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.master_listings l
     set rating_avg = s.avg, rating_count = s.n
    from (select round(avg(r.rating)::numeric, 2) as avg, count(*)::int as n from public.master_reviews r where r.listing_id = lid) s
   where l.id = lid;
  return null;
end $$;
drop trigger if exists trg_master_review_rating on public.master_reviews;
create trigger trg_master_review_rating after insert or update or delete on public.master_reviews for each row execute function public.trg_master_review_rating();

-- ---------------------------------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------------------------------
alter table public.master_categories enable row level security;
alter table public.master_listings enable row level security;
alter table public.master_requests enable row level security;
alter table public.master_reviews enable row level security;

drop policy if exists master_categories_read on public.master_categories;
create policy master_categories_read on public.master_categories for select to anon, authenticated using (true);
drop policy if exists master_categories_admin on public.master_categories;
create policy master_categories_admin on public.master_categories for all to authenticated
  using ((select public.has_admin_permission('categories.manage'))) with check ((select public.has_admin_permission('categories.manage')));

-- e'lonlar: egasi o'zinikini (barcha holatlar), admin hammasini; ommaviy o'qish — faqat funksiyalar orqali (telefon himoyasi)
drop policy if exists master_listings_owner_select on public.master_listings;
create policy master_listings_owner_select on public.master_listings for select to authenticated
  using (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.view')));
drop policy if exists master_listings_owner_insert on public.master_listings;
create policy master_listings_owner_insert on public.master_listings for insert to authenticated
  with check (owner_profile_id = (select auth.uid()) and (select public.is_active_user()));
drop policy if exists master_listings_owner_update on public.master_listings;
create policy master_listings_owner_update on public.master_listings for update to authenticated
  using (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.moderate')))
  with check (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.moderate')));
drop policy if exists master_listings_owner_delete on public.master_listings;
create policy master_listings_owner_delete on public.master_listings for delete to authenticated
  using (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.moderate')));

-- so'rovlar: e'lon egasi o'qiydi va holatini belgilaydi; admin ko'radi; yozish — faqat funksiya orqali
drop policy if exists master_requests_owner_select on public.master_requests;
create policy master_requests_owner_select on public.master_requests for select to authenticated
  using (exists (select 1 from public.master_listings l where l.id = listing_id and l.owner_profile_id = (select auth.uid()))
         or client_profile_id = (select auth.uid())
         or (select public.has_admin_permission('vacancies.view')));
drop policy if exists master_requests_owner_update on public.master_requests;
create policy master_requests_owner_update on public.master_requests for update to authenticated
  using (exists (select 1 from public.master_listings l where l.id = listing_id and l.owner_profile_id = (select auth.uid())))
  with check (exists (select 1 from public.master_listings l where l.id = listing_id and l.owner_profile_id = (select auth.uid())));

-- sharhlar: faol e'lonning sharhlari hammaga ochiq; muallif o'zinikini o'chira oladi; yozish — funksiya orqali
drop policy if exists master_reviews_read on public.master_reviews;
create policy master_reviews_read on public.master_reviews for select to anon, authenticated
  using (exists (select 1 from public.master_listings l where l.id = listing_id and l.status = 'active') or author_profile_id = (select auth.uid()));
drop policy if exists master_reviews_author_delete on public.master_reviews;
create policy master_reviews_author_delete on public.master_reviews for delete to authenticated
  using (author_profile_id = (select auth.uid()) or (select public.has_admin_permission('reviews.moderate')));

-- Supabase standart huquqlari (anon/authenticated ga hamma jadval) bekor: anon e'lonlar va so'rovlar jadvaliga umuman kirmaydi
-- (telefon ustuni), faqat funksiyalar orqali; authenticated — RLS doirasida (egasi / admin)
revoke all on public.master_listings, public.master_requests from anon;
revoke all on public.master_listings, public.master_requests, public.master_reviews, public.master_categories from authenticated;
grant select on public.master_categories to anon, authenticated;
grant select, insert, update, delete on public.master_listings to authenticated;
grant select, update on public.master_requests to authenticated;
grant select on public.master_reviews to anon, authenticated;
grant delete on public.master_reviews to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 5. Ommaviy o'qish (SECURITY DEFINER): ro'yxat (telefonsiz), bitta e'lon (telefon faqat rozilik bilan), kategoriya sonlari
-- ---------------------------------------------------------------------------------------------------
create or replace function public.master_listings_public(
  p_category uuid default null,
  p_region uuid default null,
  p_query text default null,
  p_min_experience int default null,
  p_sort text default 'new',
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid, slug text, display_name text, title text, category_id uuid, category_slug text, experience_years int, services text[],
  region_id uuid, district_id uuid, service_area text, phone_public boolean, price_from int, price_to int, price_negotiable boolean,
  work_from time, work_to time, photos text[], avatar_url text, is_demo boolean, rating_avg numeric, rating_count int,
  published_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public as $$
  select l.id, l.slug, l.display_name, l.title, l.category_id, c.slug, l.experience_years, l.services,
         l.region_id, l.district_id, l.service_area, l.phone_public, l.price_from, l.price_to, l.price_negotiable,
         l.work_from, l.work_to, l.photos, p.avatar_url, l.is_demo, l.rating_avg, l.rating_count, l.published_at, count(*) over ()
  from public.master_listings l
  join public.master_categories c on c.id = l.category_id
  left join public.profiles p on p.id = l.owner_profile_id and not p.is_blocked
  where l.status = 'active' and c.is_active
    and (l.owner_profile_id is null or exists (select 1 from public.profiles pp where pp.id = l.owner_profile_id and not pp.is_blocked))
    and (p_category is null or l.category_id = p_category)
    and (p_region is null or l.region_id = p_region)
    and (p_min_experience is null or l.experience_years >= p_min_experience)
    and (coalesce(btrim(p_query), '') = '' or l.title ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
         or l.description ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
         or c.name_uz ilike '%' || btrim(p_query) || '%' or c.name_ru ilike '%' || btrim(p_query) || '%')
  order by
    -- haqiqiy e'lonlar demo'dan avval; keyin tanlangan tartib
    l.is_demo asc,
    case when p_sort = 'rating' then coalesce(l.rating_avg, 0) end desc nulls last,
    case when p_sort = 'experience' then l.experience_years end desc nulls last,
    l.published_at desc nulls last, l.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.master_listings_public(uuid, uuid, text, int, text, int, int) from public;
grant execute on function public.master_listings_public(uuid, uuid, text, int, text, int, int) to anon, authenticated;

-- Bitta e'lon: telefon faqat egasi rozilik bergan va e'lon faol bo'lsa; tavsif to'liq
create or replace function public.master_listing_public(p_slug text)
returns table (
  id uuid, slug text, display_name text, title text, description text, category_id uuid, category_slug text, experience_years int,
  services text[], region_id uuid, district_id uuid, service_area text, phone text, phone_public boolean, price_from int, price_to int,
  price_negotiable boolean, work_from time, work_to time, photos text[], avatar_url text, is_demo boolean, rating_avg numeric,
  rating_count int, views_count int, published_at timestamptz, owner_profile_id uuid
)
language sql stable security definer set search_path = public as $$
  select l.id, l.slug, l.display_name, l.title, l.description, l.category_id, c.slug, l.experience_years, l.services,
         l.region_id, l.district_id, l.service_area, case when l.phone_public then l.phone end, l.phone_public,
         l.price_from, l.price_to, l.price_negotiable, l.work_from, l.work_to, l.photos, p.avatar_url, l.is_demo,
         l.rating_avg, l.rating_count, l.views_count, l.published_at, l.owner_profile_id
  from public.master_listings l
  join public.master_categories c on c.id = l.category_id
  left join public.profiles p on p.id = l.owner_profile_id
  where l.slug = p_slug and l.status = 'active'
    and (l.owner_profile_id is null or coalesce(not p.is_blocked, false))
  limit 1
$$;
revoke all on function public.master_listing_public(text) from public;
grant execute on function public.master_listing_public(text) to anon, authenticated;

create or replace function public.master_category_counts()
returns table (category_id uuid, active_count bigint, real_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, count(l.id), count(l.id) filter (where not l.is_demo)
  from public.master_categories c
  left join public.master_listings l on l.category_id = c.id and l.status = 'active'
  where c.is_active
  group by c.id
$$;
revoke all on function public.master_category_counts() from public;
grant execute on function public.master_category_counts() to anon, authenticated;

-- Hisoblagich: ko'rish yoki telefon bosish; demo e'londa hisoblanmaydi. FAQAT server kaliti (service_role): ilova IP + e'lon
-- bo'yicha soatiga bir marta chaqiradi — brauzerdan to'g'ridan-to'g'ri chaqirib sonni sun'iy oshirib bo'lmaydi.
create or replace function public.master_listing_hit(p_id uuid, p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.master_listings
     set views_count = views_count + (case when p_kind = 'view' then 1 else 0 end),
         phone_clicks_count = phone_clicks_count + (case when p_kind = 'phone' then 1 else 0 end)
   where id = p_id and status = 'active' and not is_demo and p_kind in ('view', 'phone')
$$;
revoke all on function public.master_listing_hit(uuid, text) from public, anon, authenticated;
grant execute on function public.master_listing_hit(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- 6. Mijoz so'rovi va sharh (yozish faqat funksiya orqali)
-- ---------------------------------------------------------------------------------------------------
-- So'rov: FAQAT server kaliti (ilova spam limitini qo'yib chaqiradi — to'g'ridan-to'g'ri REST orqali ustani so'rovlar bilan
-- to'ldirib bo'lmaydi). p_client — kirgan mijoz (bo'lsa); o'z e'loniga so'rov yuborib bo'lmaydi; demo/faol emas e'longa — yo'q.
create or replace function public.master_request_create(p_listing uuid, p_name text, p_phone text, p_message text default null, p_client uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  l public.master_listings;
begin
  select * into l from public.master_listings where id = p_listing and status = 'active' and not is_demo;
  if not found then raise exception 'master_listing_not_found' using errcode = 'P0002'; end if;
  if p_client is not null and l.owner_profile_id = p_client then raise exception 'master_request_own' using errcode = '42501'; end if;
  insert into public.master_requests (listing_id, client_profile_id, client_name, client_phone, message)
  values (p_listing, p_client, btrim(p_name), p_phone, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.master_request_create(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.master_request_create(uuid, text, text, text, uuid) to service_role;

create or replace function public.master_review_add(p_listing uuid, p_rating int, p_text text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  l public.master_listings;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'master_review_auth' using errcode = '42501'; end if;
  select * into l from public.master_listings where id = p_listing and status = 'active' and not is_demo;
  if not found then raise exception 'master_listing_not_found' using errcode = 'P0002'; end if;
  if l.owner_profile_id = auth.uid() then raise exception 'master_review_own' using errcode = '42501'; end if;
  insert into public.master_reviews (listing_id, author_profile_id, rating, text)
  values (p_listing, auth.uid(), p_rating, nullif(btrim(coalesce(p_text, '')), ''))
  on conflict (listing_id, author_profile_id) do update set rating = excluded.rating, text = excluded.text, created_at = now()
  returning id into rid;
  return rid;
end $$;
revoke all on function public.master_review_add(uuid, int, text) from public, anon;
grant execute on function public.master_review_add(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 7. Moderatsiya (admin, vacancies.moderate)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.master_moderate(p_id uuid, p_action text, p_reason text default null)
returns public.master_listing_status language plpgsql security definer set search_path = public as $$
declare
  st public.master_listing_status;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action = 'approve' then
    update public.master_listings set status = 'active', reject_reason = null, published_at = coalesce(published_at, now())
     where id = p_id and status in ('pending_review', 'hidden', 'rejected') returning status into st;
  elsif p_action = 'reject' then
    update public.master_listings set status = 'rejected', reject_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500)
     where id = p_id and status in ('pending_review', 'active', 'hidden') returning status into st;
  else
    raise exception 'master_moderate_action' using errcode = '22023';
  end if;
  if st is null then raise exception 'master_listing_not_found' using errcode = 'P0002'; end if;
  return st;
end $$;
revoke all on function public.master_moderate(uuid, text, text) from public, anon;
grant execute on function public.master_moderate(uuid, text, text) to authenticated;

-- Server kaliti (service_role), baza operatori (migratsiya, SQL Editor, psql) yoki moderatsiya huquqli admin.
-- SET ROLE qiymati ("role" sozlamasi) SECURITY DEFINER ichida ham o'qiladi — current_user esa definer bo'lib qoladi.
-- Operator: SET ROLE yo'q ('none') yoki vosita o'zi "SET ROLE postgres" qilgan (ba'zi CLI/boshqaruv vositalari shunday ishlaydi).
-- API orqali kelgan so'rovda bu qiymat faqat anon / authenticated / service_role bo'la oladi (authenticator boshqasiga o'ta olmaydi).
create or replace function public.master_privileged()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('role', true), 'none') in ('service_role', 'none', '', 'postgres', 'supabase_admin')
      or public.has_admin_permission('vacancies.moderate');
$$;
revoke all on function public.master_privileged() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 8. Demo e'lonlar: har kategoriyaga 4 tadan (egasiz, telefonsiz, reytingsiz, "Demo" belgisi); olib tashlash — bitta buyruq
-- ---------------------------------------------------------------------------------------------------
create or replace function public.master_demo_seed()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  c record;
  i int;
  r_slugs text[] := array['tashkent_city', 'samarkand', 'andijan', 'fergana'];
  exp int[] := array[3, 5, 7, 10];
  rid uuid;
begin
  if not public.master_privileged() then raise exception 'forbidden' using errcode = '42501'; end if;
  for c in select * from public.master_categories where is_active order by sort_order loop
    for i in 1..4 loop
      if exists (select 1 from public.master_listings where is_demo and category_id = c.id and slug = 'demo-' || c.slug || '-' || i) then continue; end if;
      select id into rid from public.regions where slug = r_slugs[i];
      insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, experience_years, services,
        region_id, service_area, phone, phone_public, price_negotiable, work_from, work_to, status, is_demo, published_at)
      values (null, c.id, 'demo-' || c.slug || '-' || i, 'Demo usta ' || i, c.name_uz || ' — namuna e''lon ' || i,
        'Bu demo e''lon: haqiqiy usta emas. Haqiqiy ustalar e''lon joylab, admin tasdig''idan o''tgach shu yerda ko''rinadi. ' ||
        'Xizmatlar, tajriba va ish vaqti namuna sifatida ko''rsatilgan.',
        exp[i], array['O''rnatish', 'Ta''mirlash', 'Maslahat'], rid, null, null, false, true, '09:00', '19:00', 'active', true, now() - (i || ' days')::interval);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.master_demo_seed() from public, anon;
grant execute on function public.master_demo_seed() to authenticated;

create or replace function public.master_demo_remove()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.master_privileged() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.master_listings where is_demo;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.master_demo_remove() from public, anon;
grant execute on function public.master_demo_remove() to authenticated;

-- Egasi talabi: dastlab har kategoriyada 4 ta demo e'lon ko'rinsin (olib tashlash: admin → Ustalar → "Demo e'lonlarni olib tashlash"
-- yoki SQL: select public.master_demo_remove();).
-- Faqat birinchi o'rnatishda (jadval bo'sh): fayl tasodifan qayta ishga tushirilsa, olib tashlangan demo e'lonlar haqiqiy
-- e'lonlar yoniga qaytib qolmaydi. Qaytarish kerak bo'lsa — admin tugmasi yoki select public.master_demo_seed();
do $$
begin
  if not exists (select 1 from public.master_listings) then
    perform public.master_demo_seed();
  end if;
end $$;
