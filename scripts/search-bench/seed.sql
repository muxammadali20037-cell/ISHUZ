-- ISH TOPDIM · qidiruv benchmarki uchun NAMUNAVIY ma'lumot (1200+ vakansiya). FAQAT LOKAL E2E STEND (ishuz_e2e).
-- Prod bazaga HECH QACHON qo'llanmaydi: pastdagi tekshiruv boshqa bazada to'xtatadi.
-- Ishga tushirish: npm run bench:search (README: scripts/search-bench/bench.test.ts boshida)

\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'ishuz_e2e' then raise exception 'search-bench: faqat ishuz_e2e (lokal stend) bazasida'; end if; end $$;
begin;
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data)
values ('7e2e0000-0000-4000-8000-00000000be01', '+998900000901', now(), '{"first_name":"Bench","last_name":"Employer"}')
on conflict (id) do nothing;
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
values ('7e2e0000-0000-4000-8000-00000000be01', 'person', 'Bench', now()) on conflict (profile_id) do nothing;
delete from public.vacancies where owner_profile_id = '7e2e0000-0000-4000-8000-00000000be01';

-- tasodifiy emas, takrorlanadigan: setseed
select setseed(0.42);
with nodes as (
  select n.id, n.name_uz, n.name_ru, n.category_id, row_number() over (order by md5(n.id::text)) as rn
  from public.profession_nodes n
  where n.selectable and n.is_active and n.name_uz is not null
),
picked as (select * from nodes where rn <= 300),
regs as (select id, row_number() over (order by slug) as rn, count(*) over () as cnt from public.regions),
gen as (
  select p.*, g as k from picked p cross join generate_series(1, 4) g
)
insert into public.vacancies (owner_profile_id, title, slug, category_id, description, region_id, status, profession_node_id,
  salary_from, salary_type, published_at, expires_at, experience_min_months, schedule, moderation_state)
select '7e2e0000-0000-4000-8000-00000000be01',
  case (gen.k + gen.rn) % 5
    when 0 then coalesce(gen.name_ru, gen.name_uz)
    when 1 then gen.name_uz || ' kerak'
    when 2 then gen.name_uz || ' — kafe/firma'
    when 3 then 'Tajribali ' || lower(gen.name_uz)
    else gen.name_uz end,
  'bench-' || gen.rn || '-' || gen.k,
  gen.category_id,
  'Bench vakansiya: ' || gen.name_uz || '. Ish vaqti 9:00–18:00.',
  (select r.id from regs r where r.rn = 1 + ((gen.rn * 7 + gen.k) % (select max(cnt) from regs))),
  'active', gen.id,
  (3 + (gen.rn + gen.k) % 10) * 1000000, 'monthly',
  now() - ((gen.rn * 13 + gen.k * 5) % 720) * interval '1 hour',
  now() + interval '20 days',
  case when (gen.rn + gen.k) % 3 = 0 then 0 else 12 end,
  (array['5_2','6_1','2_2','shift','flexible']::work_schedule[])[1 + (gen.rn + gen.k) % 5],
  'approved'
from gen;

-- aniq tekshiriladigan kasblar (har biridan bir nechta, owner aytgan misollar bilan)
with want(name, title) as (values
  ('Oshpaz', 'Oshpaz yordamchisi'), ('Oshpaz', 'Milliy taomlar oshpazi'), ('Oshpaz', 'Restoran oshpazi'), ('Oshpaz', 'Повар в кафе'),
  ('Haydovchi', 'Haydovchi (B toifa)'), ('Haydovchi', 'Водитель-экспедитор'), ('Haydovchi', 'Taksi haydovchisi'),
  ('Sotuvchi', 'Sotuvchi-konsultant'), ('Sotuvchi', 'Продавец в магазин'), ('Sotuvchi', 'Do''konga sotuvchi'),
  ('Buxgalter', 'Bosh buxgalter'), ('Buxgalter', 'Бухгалтер'), ('Kassir', 'Kassir (supermarket)'),
  ('Farrosh', 'Ofisga farrosh'), ('Farrosh', 'Уборщица'), ('Qorovul', 'Qorovul (smenali)'),
  ('Ofitsiant', 'Ofitsiant kerak'), ('Ofitsiant', 'Официант'), ('Elektrik', 'Elektrik montajchi'),
  ('Santexnik', 'Santexnik usta'), ('Kuryer', 'Kuryer (piyoda)'), ('Kuryer', 'Курьер на авто')
)
insert into public.vacancies (owner_profile_id, title, slug, category_id, description, region_id, status, profession_node_id,
  salary_from, salary_type, published_at, expires_at, moderation_state)
select '7e2e0000-0000-4000-8000-00000000be01', w.title, 'bench-x-' || md5(w.title), n.category_id, 'Bench vakansiya: ' || w.title,
  (select id from public.regions where slug = 'tashkent_city'), 'active', n.id, 5000000, 'monthly', now() - interval '2 hours', now() + interval '20 days', 'approved'
from want w
cross join lateral (select id, category_id from public.profession_nodes where name_uz = w.name and selectable order by depth limit 1) n;

-- kasb tuguni yo'q eski/erkin e'lonlar (matn qidiruvi)
insert into public.vacancies (owner_profile_id, title, slug, description, region_id, status, custom_profession, salary_from, salary_type, published_at, expires_at, moderation_state)
select '7e2e0000-0000-4000-8000-00000000be01', t, 'bench-c-' || md5(t), 'Bench vakansiya: ' || t,
  (select id from public.regions where slug = 'tashkent_city'), 'active', t, 8000000, 'monthly', now() - interval '3 hours', now() + interval '20 days', 'approved'
from unnest(array['Python dasturchi (Django)', 'Frontend developer (React)', 'Программист 1С', 'SMM mutaxassis', 'Konchi (shaxta)']) t;
commit;
