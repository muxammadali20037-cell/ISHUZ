-- 0077 · Namuna (demo) vakansiyalar — haqiqiy vakansiyalardan ALOHIDA jadval.
--
-- Ega (2026-11-12): "barcha sohalar bo'yicha … vakansiyalar qo'sh"; avvalroq: "har biriga 4 tadan demo … keyin bir marta
-- olib tashla desam olib tashlaysan". Bazada hali haqiqiy e'lon yo'q — ilova bo'sh ko'rinmasin.
--
-- Nega alohida jadval (public.vacancies ga aralashtirilmaydi):
--   namuna e'lon haqiqiy e'lonlar quvuriga UMUMAN kirmaydi — ariza yuborib bo'lmaydi, moslik va xabarnomalar (AI kuzatuv,
--   saqlangan qidiruv, Telegram kanal) ishga tushmaydi, statistika va hisoblagichlarga qo'shilmaydi, sitemap va JobPosting'ga
--   chiqmaydi. Ilova ularni faqat haqiqiy e'lon bo'lmagan joyda, "Namuna" belgisi bilan alohida blokda ko'rsatadi.
--   Kompaniya nomi, telefon, rasm yo'q — o'ylab topilgan tashkilot ko'rsatilmaydi.
--
-- Olib tashlash: admin → "Namuna e'lonlar" → "Olib tashlash" yoki  select public.demo_vacancies_remove();
-- Takror ishga tushirish xavfsiz (if not exists / create or replace; seed faqat jadval bo'sh bo'lsa).

-- Birinchi o'rnatishmi (jadval hali yo'q)? Faqat shunda fayl oxirida namunalar yaratiladi: ega namunalarni olib tashlagach
-- fayl takror ishga tushirilsa (masalan, supabase/prod/pending.sql qayta qo'yilsa), ular qaytib qolmaydi.
select set_config('ishuz.demo_vacancies_first_install', (to_regclass('public.demo_vacancies') is null)::text, false);

create table if not exists public.demo_vacancies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^namuna-[a-z0-9-]{3,80}$'),
  category_id uuid not null references public.categories (id) on delete cascade,
  profession_node_id uuid references public.profession_nodes (id) on delete set null,
  title_uz text not null check (length(btrim(title_uz)) between 2 and 120),
  title_ru text,
  title_en text,
  region_id uuid references public.regions (id) on delete set null,
  district_id uuid references public.districts (id) on delete set null,
  is_remote boolean not null default false,
  salary_from integer check (salary_from is null or salary_from >= 0),
  salary_to integer check (salary_to is null or salary_to >= 0),
  salary_type public.salary_type not null default 'monthly',
  salary_negotiable boolean not null default false,
  schedule public.work_schedule not null default '5_2',
  employment_type public.employment_type not null default 'full_time',
  experience_min_months integer not null default 0 check (experience_min_months between 0 and 240),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint demo_vacancies_salary_order check (salary_from is null or salary_to is null or salary_to >= salary_from)
);

comment on table public.demo_vacancies is
  'Namuna (demo) vakansiyalar: faqat ko''rsatish uchun, "Namuna" belgisi bilan. Haqiqiy vakansiyalar (public.vacancies) bilan bog''lanmagan.';

create index if not exists demo_vacancies_category_idx on public.demo_vacancies (category_id, sort_order);

-- To'g'ridan-to'g'ri kirish yo'q: o'qish faqat quyidagi funksiyalar orqali (RLS yoqilgan, siyosat yo'q)
alter table public.demo_vacancies enable row level security;
revoke all on public.demo_vacancies from public, anon, authenticated;
grant select, insert, update, delete on public.demo_vacancies to service_role;

-- Server kaliti (service_role), baza operatori (migratsiya, SQL Editor, psql; vosita "SET ROLE postgres" qilgan bo'lsa ham)
-- yoki moderatsiya huquqli admin. API orqali "role" faqat anon / authenticated / service_role bo'la oladi.
create or replace function public.demo_privileged()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('role', true), 'none') in ('service_role', 'none', '', 'postgres', 'supabase_admin')
      or public.has_admin_permission('vacancies.moderate');
$$;
revoke all on function public.demo_privileged() from public, anon, authenticated;

-- Ommaviy ro'yxat: kartaga kerakli maydonlar (haqiqiy vakansiya kartasi bilan bir xil nomlar). p_region berilsa — o'sha
-- viloyatdagilar birinchi (boshqalari ham ko'rinadi: namuna hududga bog'lab yashirilmaydi).
create or replace function public.demo_vacancies_public(
  p_category text default null,
  p_region text default null,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title_uz text, title_ru text, title_en text,
  category_slug text, category_icon text, profession_node_id uuid,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  lat double precision, lng double precision,
  is_remote boolean, salary_from integer, salary_to integer, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, employment_type public.employment_type, experience_min_months integer,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  select v.id, v.slug, v.title_uz, v.title_ru, v.title_en,
         c.slug, c.icon, v.profession_node_id,
         r.name_uz, r.name_ru, r.name_en, r.name_oz,
         d.name_uz, d.name_ru, d.name_en, d.name_oz,
         d.lat, d.lng,
         v.is_remote, v.salary_from, v.salary_to, v.salary_type, v.salary_negotiable,
         v.schedule, v.employment_type, v.experience_min_months,
         count(*) over () as total_count
  from public.demo_vacancies v
  join public.categories c on c.id = v.category_id and c.is_active
  left join public.regions r on r.id = v.region_id
  left join public.districts d on d.id = v.district_id
  where (p_category is null or p_category = '' or c.slug = p_category)
    and (p_query is null or btrim(p_query) = ''
         or v.title_uz ilike '%' || btrim(p_query) || '%'
         or coalesce(v.title_ru, '') ilike '%' || btrim(p_query) || '%'
         or coalesce(v.title_en, '') ilike '%' || btrim(p_query) || '%')
  order by (p_region is not null and p_region <> '' and r.slug = p_region) desc, v.sort_order, v.slug
  limit least(greatest(coalesce(p_limit, 12), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Bitta namuna e'lon (sahifa uchun)
create or replace function public.demo_vacancy_public(p_slug text)
returns table (
  id uuid, slug text, title_uz text, title_ru text, title_en text,
  category_slug text, category_icon text, category_name_uz text, category_name_ru text, category_name_en text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  is_remote boolean, salary_from integer, salary_to integer, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, employment_type public.employment_type, experience_min_months integer
)
language sql stable security definer set search_path = public as $$
  select v.id, v.slug, v.title_uz, v.title_ru, v.title_en,
         c.slug, c.icon, c.name_uz, c.name_ru, c.name_en,
         r.name_uz, r.name_ru, r.name_en, r.name_oz,
         d.name_uz, d.name_ru, d.name_en, d.name_oz,
         v.is_remote, v.salary_from, v.salary_to, v.salary_type, v.salary_negotiable,
         v.schedule, v.employment_type, v.experience_min_months
  from public.demo_vacancies v
  join public.categories c on c.id = v.category_id
  left join public.regions r on r.id = v.region_id
  left join public.districts d on d.id = v.district_id
  where v.slug = p_slug;
$$;

-- Namuna e'lonlarni (qayta) yaratish: har faol sohada 4 tadan — o'sha sohaning ommabop kasblari, hududlar navbat bilan.
-- Maosh oralig'i — sohaga xos TAXMINIY namuna (statistika emas); 4-e'lon "kelishiladi". Avvalgi namunalar almashtiriladi.
create or replace function public.demo_vacancies_seed()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.demo_privileged() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.demo_vacancies;
  with cats as (
    select c.id, c.slug, row_number() over (order by c.sort_order, c.slug) - 1 as ci
    from public.categories c where c.is_active
  ),
  regs as (
    select r.id, row_number() over (order by r.sort_order, r.slug) - 1 as ri, count(*) over () as rc
    from public.regions r where r.is_active
  ),
  picks as (
    select c.id as category_id, c.slug as category_slug, c.ci, p.id as node_id, p.name_uz, p.name_ru, p.name_en,
           row_number() over (partition by c.id order by p.is_popular desc, p.sort_order, p.name_uz) as rn
    from cats c
    join public.profession_nodes p on p.category_id = c.id and p.selectable and p.is_active
  ),
  pay(slug, lo, hi) as (values
    ('it', 8000000, 20000000), ('sales', 4000000, 9000000), ('marketing', 5000000, 12000000), ('design', 5000000, 12000000),
    ('finance', 5000000, 12000000), ('driver', 5000000, 10000000), ('logistics', 4000000, 8000000), ('courier', 4000000, 9000000),
    ('construction', 5000000, 12000000), ('craftsman', 5000000, 10000000), ('electrician', 5000000, 10000000),
    ('plumber', 5000000, 10000000), ('mechanic', 5000000, 10000000), ('auto_service', 5000000, 10000000),
    ('restaurant', 3500000, 8000000), ('call_center', 3500000, 6000000), ('office', 4000000, 8000000),
    ('education', 3500000, 8000000), ('medicine', 4000000, 10000000), ('cleaning', 3000000, 5000000),
    ('security', 3000000, 5000000), ('sewing', 4000000, 8000000), ('beauty', 4000000, 10000000),
    ('production', 4000000, 8000000), ('agriculture', 3500000, 7000000), ('hotel', 4000000, 8000000),
    ('legal', 6000000, 14000000), ('science', 5000000, 10000000), ('management', 10000000, 25000000),
    ('government', 4000000, 8000000), ('engineering', 7000000, 15000000), ('telecom', 4000000, 9000000),
    ('energy', 5000000, 10000000), ('mining', 7000000, 15000000), ('culture', 4000000, 9000000),
    ('real_estate', 5000000, 15000000), ('crafts', 4000000, 9000000)
  )
  insert into public.demo_vacancies (
    slug, category_id, profession_node_id, title_uz, title_ru, title_en, region_id, district_id, is_remote,
    salary_from, salary_to, salary_type, salary_negotiable, schedule, employment_type, experience_min_months, sort_order
  )
  select
    'namuna-' || replace(p.category_slug, '_', '-') || '-' || p.rn,
    p.category_id, p.node_id, p.name_uz, p.name_ru, p.name_en,
    r.id,
    (select d.id from public.districts d where d.region_id = r.id and d.is_active and d.lat is not null order by d.sort_order, d.slug limit 1),
    (p.rn = 4 and p.category_slug in ('it', 'marketing', 'design', 'call_center')),
    case when p.rn = 4 then null
         else (round(coalesce(pay.lo, 4000000) * (1 + (p.rn - 1) * 0.15) / 100000.0) * 100000)::integer end,
    case when p.rn = 4 then null
         else (round(coalesce(pay.hi, 8000000) * (1 + (p.rn - 1) * 0.15) / 100000.0) * 100000)::integer end,
    'monthly'::public.salary_type,
    p.rn = 4,
    (case p.rn
       when 1 then '5_2'
       when 2 then case when p.category_slug = any(shift_cats.s) or p.category_slug = any(six_cats.s) then '6_1' else '5_2' end
       when 3 then case when p.category_slug = any(shift_cats.s) then '2_2' else '5_2' end
       else 'flexible' end)::public.work_schedule,
    (case p.rn
       when 3 then case when p.category_slug = any(shift_cats.s) then 'shift' else 'full_time' end
       when 4 then 'part_time'
       else 'full_time' end)::public.employment_type,
    (array[12, 0, 36, 0])[p.rn],
    p.rn * 100 + p.ci
  from picks p
  join regs r on r.ri = (p.ci * 4 + p.rn - 1) % r.rc
  left join pay on pay.slug = p.category_slug
  -- smenali ish odatiy bo'lgan sohalar (2/2) va olti kunlik hafta odatiy bo'lgan sohalar
  cross join (select array['security', 'restaurant', 'call_center', 'hotel', 'production', 'medicine', 'energy', 'mining',
                           'courier', 'driver', 'logistics', 'cleaning', 'auto_service'] as s) shift_cats
  cross join (select array['sales', 'construction', 'craftsman', 'beauty', 'sewing', 'agriculture', 'crafts', 'electrician',
                           'plumber', 'mechanic'] as s) six_cats
  where p.rn <= 4;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.demo_vacancies_remove()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.demo_privileged() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.demo_vacancies;
  get diagnostics n = row_count;
  return n;
end $$;

-- Huquqlar: ommaviy o'qish — hammaga; boshqaruv — faqat kirgan (ichida admin tekshiruvi) va server
revoke all on function public.demo_vacancies_public(text, text, text, integer, integer) from public;
revoke all on function public.demo_vacancy_public(text) from public;
grant execute on function public.demo_vacancies_public(text, text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.demo_vacancy_public(text) to anon, authenticated, service_role;
revoke all on function public.demo_vacancies_seed() from public, anon;
revoke all on function public.demo_vacancies_remove() from public, anon;
grant execute on function public.demo_vacancies_seed() to authenticated, service_role;
grant execute on function public.demo_vacancies_remove() to authenticated, service_role;

-- Birinchi o'rnatishda: har sohada 4 tadan namuna. Keyingi ishga tushirishlarda tegilmaydi (olib tashlangan bo'lsa — qaytmaydi).
-- Qaytarish: admin tugmasi yoki  select public.demo_vacancies_seed();
do $$
begin
  if coalesce(current_setting('ishuz.demo_vacancies_first_install', true), 'false') = 'true' then
    perform public.demo_vacancies_seed();
  end if;
  perform set_config('ishuz.demo_vacancies_first_install', 'false', false);
end $$;
