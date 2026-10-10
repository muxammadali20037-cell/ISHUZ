-- ISH.UZ · 0055: RLS qoidalarida auth.uid() bir marta hisoblanadi, halqali jadvallar tegilmagan,
-- qidiruv natijalari o'zgarmagan (kasb tarmog'i, eski e'lonlar nomi bo'yicha, sahifalash, umumiy son)
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end $$;
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
-- 1) Qoidalar: asosiy jadvallarda (select auth.uid()), halqali jadvallar (vacancies) o'zgarmagan
select pg_temp.ok((select qual ~ 'SELECT auth\.uid\(\)' from pg_policies where tablename = 'notifications' and policyname = 'notifications_own'), 'bildirishnomalar: (select auth.uid())');
select pg_temp.ok((select qual ~ 'SELECT current_worker_id\(\)' and qual ~ 'SELECT is_admin\(\)' from pg_policies where tablename = 'applications' and policyname = 'applications_read'), 'arizalar: yordamchi funksiyalar bir marta');
select pg_temp.ok((select qual !~ 'SELECT' from pg_policies where tablename = 'vacancies' and policyname = 'vacancies_read_own'), 'vacancies (o''ziga murojaat qiluvchi qoida bor) — tegilmagan');
select pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'SELECT \(SELECT') = 0, 'ikki marta o''ralgan ifoda yo''q');

-- 2) Ma'lumot: ikki ish beruvchi, bitta ishchi; kasb (ota tugun + bola) va eski (kasb tugunisiz) e'lon
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid');
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('55000000-0000-0000-0000-000000000001', '+998905500001', now(), '{"first_name":"Ega","last_name":""}'),
  ('55000000-0000-0000-0000-000000000002', '+998905500002', now(), '{"first_name":"Ishchi","last_name":""}');

create temp table fx on commit drop as
select p.id as parent, c.id as child, p.category_id, p.name_uz as parent_name,
  (select id from public.regions where slug = 'tashkent_city') as region
from public.profession_nodes c join public.profession_nodes p on p.id = c.parent_id
where c.selectable and c.is_active and p.is_active
order by p.depth, p.sort_order nulls last, c.sort_order nulls last limit 1;
grant select on fx to anon, authenticated;
select pg_temp.ok((select parent is not null and child is not null from fx), 'kasb daraxti tayyor');

-- 12 ta faol e'lon: 10 tasi bola kasbda (bir xil vaqt — tartib id bo'yicha barqaror), 1 tasi eski (kasb tugunisiz,
-- nomida ota kasb nomi), 1 tasi boshqa hududda
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, published_at, expires_at,
                              salary_type, salary_negotiable, slug, employment_type, schedule, experience_min_months)
select '55000000-0000-0000-0000-000000000001', 'Test ' || g, fx.category_id, fx.child, fx.region, 'draft', null, null,
       'monthly', true, 'scale-test-' || g, 'full_time', '5_2', 0
from fx, generate_series(1, 10) g;
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, salary_type, salary_negotiable, slug, employment_type, schedule, experience_min_months)
select '55000000-0000-0000-0000-000000000001', 'Tajribali ' || fx.parent_name || ' kerak', fx.category_id, null, fx.region, 'draft', 'monthly', true, 'scale-test-legacy', 'full_time', '5_2', 0 from fx;
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, salary_type, salary_negotiable, slug, employment_type, schedule, experience_min_months)
select '55000000-0000-0000-0000-000000000001', 'Boshqa hudud', fx.category_id, fx.child, (select id from public.regions where slug <> 'tashkent_city' order by slug limit 1), 'draft', 'monthly', true, 'scale-test-other', 'full_time', '5_2', 0 from fx;
update public.vacancies set status = 'active', published_at = '2026-01-01T00:00:00Z', expires_at = now() + interval '20 days'
where slug like 'scale-test-%';

-- 3) Egasi o'z vakansiyasini tahrirlaydi (vacancies_update o'zidan eski qiymatni o'qiydi — rekursiya yo'q)
select pg_temp.login('55000000-0000-0000-0000-000000000001');
update public.vacancies set title = 'Test 1 (yangilandi)' where slug = 'scale-test-1';
select pg_temp.ok((select title from public.vacancies where slug = 'scale-test-1') = 'Test 1 (yangilandi)', 'egasi vakansiyani tahrirladi (RLS rekursiyasiz)');
select pg_temp.ok((select count(*) from public.vacancies where owner_profile_id = auth.uid()) = 12, 'egasi o''z e''lonlarini ko''radi');
select pg_temp.ok((select count(*) from public.notifications) = (select count(*) from public.notifications where profile_id = auth.uid()), 'bildirishnomalar: faqat o''ziniki');

-- 4) Qidiruv: ota kasb — bola kasbdagi 10 ta + eski e'lon (nomi bo'yicha); boshqa hudud chiqmaydi
select pg_temp.anon();
select pg_temp.ok((select max(total_count) from public.simple_search_vacancies((select parent from fx), (select region from fx))) = 11, 'ota kasb: 10 ta + eski e''lon = 11');
select pg_temp.ok((select count(*) from public.simple_search_vacancies((select parent from fx), (select region from fx), p_limit => 50) where title like 'Tajribali %') = 1, 'eski (kasb tugunisiz) e''lon nomi bo''yicha topildi');
select pg_temp.ok((select max(total_count) from public.simple_search_vacancies((select child from fx), (select region from fx))) = 10, 'bola kasb: eski e''lon qo''shilmaydi (nomi bola kasbga mos emas)');
select pg_temp.ok((select max(total_count) from public.simple_search_vacancies((select parent from fx))) = 12, 'butun mamlakat: boshqa hudud ham');
-- sahifalash: bir xil vaqtdagi e'lonlar sahifalar orasida takrorlanmaydi va tushib qolmaydi
select pg_temp.ok((
  select count(distinct id) = 11 and count(*) = 11 from (
    select id from public.simple_search_vacancies((select parent from fx), (select region from fx), p_limit => 4, p_offset => 0)
    union all select id from public.simple_search_vacancies((select parent from fx), (select region from fx), p_limit => 4, p_offset => 4)
    union all select id from public.simple_search_vacancies((select parent from fx), (select region from fx), p_limit => 4, p_offset => 8)) s
), 'sahifalar takrorlanmaydi va hammasi chiqadi');
select pg_temp.ok((select count(*) from public.simple_search_vacancies(null, (select region from fx))) >= 1, 'kasbsiz qidiruv ham ishlaydi');

rollback;
\echo '✓ masshtab (RLS initPlan, qidiruv) testlari o''tdi'
