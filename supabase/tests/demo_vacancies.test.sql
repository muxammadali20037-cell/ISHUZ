-- 0077 · Namuna (demo) vakansiyalar: alohida jadval, to'g'ridan-to'g'ri kirish yo'q, o'qish faqat funksiya orqali,
-- boshqaruv faqat admin/operator, haqiqiy vakansiyalarga tegmaydi, takror o'rnatish namunalarni qaytarmaydi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
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
create or replace function pg_temp.fails(p_sql text, p_name text, p_expect text default null) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if p_expect is not null and sqlstate <> p_expect and position(p_expect in sqlerrm) = 0 then
      raise exception 'TEST FAILED: % — kutilgan %, olingan % (%)', p_name, p_expect, sqlstate, sqlerrm;
    end if;
    raise notice 'ok - % (% %)', p_name, sqlstate, left(sqlerrm, 60); return;
  end;
  raise exception 'TEST FAILED: % — xato kutilgan edi', p_name;
end $$;

begin;

-- F: oddiy foydalanuvchi · A: moderator admin
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('c7700000-0000-0000-0000-00000000000a', '+998909770001', now(), '{"first_name":"Oddiy","last_name":"F"}'),
  ('c7700000-0000-0000-0000-00000000000b', '+998909770002', now(), '{"first_name":"Admin","last_name":"A"}');
insert into public.admin_users (profile_id, role, permissions, is_active)
values ('c7700000-0000-0000-0000-00000000000b', 'moderator', '{vacancies.moderate}', true);

-- 1) birinchi o'rnatish: har faol sohada 4 tadan
select pg_temp.ok((select count(*) from public.demo_vacancies) = 4 * (select count(*) from public.categories where is_active),
  'har faol sohada 4 tadan namuna');
select pg_temp.ok((select count(*) from public.demo_vacancies) >= 100, 'namunalar soni 100 dan ko''p (38 soha × 4)');
select pg_temp.ok(not exists (select 1 from public.demo_vacancies group by category_id having count(*) <> 4), 'har sohada aynan 4 ta');
select pg_temp.ok(not exists (select 1 from public.demo_vacancies where slug !~ '^namuna-'), 'barcha slug "namuna-" bilan boshlanadi');
select pg_temp.ok(not exists (select 1 from public.demo_vacancies where region_id is null), 'har namunada viloyat bor');
select pg_temp.ok((select count(distinct region_id) from public.demo_vacancies) = (select count(*) from public.regions where is_active),
  'namunalar barcha viloyatlarga taqsimlangan');
select pg_temp.ok(not exists (select 1 from public.demo_vacancies where salary_negotiable and (salary_from is not null or salary_to is not null)),
  '"kelishiladi" namunada raqam yo''q');
select pg_temp.ok(not exists (select 1 from public.demo_vacancies where not salary_negotiable and (salary_from is null or salary_to < salary_from)),
  'maosh oralig''i to''g''ri');

-- 2) mehmon: jadvalga to'g'ridan-to'g'ri kira olmaydi, funksiya orqali o'qiydi
select pg_temp.anon();
select pg_temp.fails($$select count(*) from public.demo_vacancies$$, 'mehmon jadvalni to''g''ridan-to''g''ri o''qiy olmaydi', '42501');
select pg_temp.fails($$insert into public.demo_vacancies (slug, category_id, title_uz) select 'namuna-xato-1', id, 'Xato' from public.categories limit 1$$,
  'mehmon namuna qo''sha olmaydi', '42501');
select pg_temp.ok((select count(*) from public.demo_vacancies_public(null, null, null, 60, 0)) = 60, 'ro''yxat: limit 60 dan oshmaydi');
select pg_temp.ok((select max(total_count) from public.demo_vacancies_public(null, null, null, 5, 0)) >= 100, 'ro''yxat: umumiy son qaytadi');
select pg_temp.ok((select count(*) from public.demo_vacancies_public('it', null, null, 60, 0)) = 4, 'soha bo''yicha filtr: 4 ta');
select pg_temp.ok((select count(*) from public.demo_vacancies_public('yoq_soha', null, null, 60, 0)) = 0, 'noma''lum soha: bo''sh');
select pg_temp.ok((select bool_and(category_slug = 'it') from public.demo_vacancies_public('it', null, null, 60, 0)), 'soha filtri faqat o''sha sohani beradi');
select pg_temp.ok(
  (select r.region_name_uz from public.demo_vacancies_public(null, 'samarkand', null, 1, 0) r)
    = (select name_uz from public.regions where slug = 'samarkand'),
  'hudud berilsa — o''sha viloyatdagilar birinchi');
select pg_temp.ok((select count(*) from public.demo_vacancies_public(null, null, '%', 60, 0)) >= 0, 'qidiruv matni xavfsiz (maxsus belgi xato bermaydi)');
select pg_temp.ok((select count(*) from public.demo_vacancy_public('namuna-it-1')) = 1, 'bitta namuna slug bo''yicha topiladi');
select pg_temp.ok((select count(*) from public.demo_vacancy_public('yoq')) = 0, 'yo''q slug: bo''sh');
select pg_temp.fails($$select public.demo_vacancies_seed()$$, 'mehmon namunalarni yarata olmaydi', '42501');
select pg_temp.fails($$select public.demo_vacancies_remove()$$, 'mehmon namunalarni o''chira olmaydi', '42501');
select pg_temp.fails($$select public.demo_privileged()$$, 'ichki tekshiruv funksiyasi mehmonga yopiq', '42501');

-- 3) oddiy foydalanuvchi: boshqara olmaydi
select pg_temp.login('c7700000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select count(*) from public.demo_vacancies$$, 'oddiy foydalanuvchi jadvalni o''qiy olmaydi', '42501');
select pg_temp.fails($$select public.demo_vacancies_remove()$$, 'oddiy foydalanuvchi namunalarni o''chira olmaydi', 'forbidden');
select pg_temp.fails($$select public.demo_vacancies_seed()$$, 'oddiy foydalanuvchi namunalarni yarata olmaydi', 'forbidden');
select pg_temp.ok((select count(*) from public.demo_vacancies_public('sales', null, null, 60, 0)) = 4, 'oddiy foydalanuvchi ro''yxatni funksiya orqali o''qiydi');

-- 4) admin: bir buyruqda olib tashlaydi va qaytaradi
select pg_temp.login('c7700000-0000-0000-0000-00000000000b');
select pg_temp.ok((select public.demo_vacancies_remove()) >= 100, 'admin barcha namunalarni bir buyruqda olib tashlaydi');
select pg_temp.ok((select count(*) from public.demo_vacancies_public(null, null, null, 60, 0)) = 0, 'olib tashlangach ro''yxat bo''sh');
select pg_temp.ok((select public.demo_vacancies_remove()) = 0, 'takror olib tashlash — 0 (xato emas)');
select pg_temp.superuser();
create temp table real_before as select count(*) as n from public.vacancies;
select pg_temp.login('c7700000-0000-0000-0000-00000000000b');
select pg_temp.ok((select public.demo_vacancies_seed()) >= 100, 'admin namunalarni qaytaradi');
select pg_temp.ok((select public.demo_vacancies_seed()) >= 100, 'qayta yaratish — xatosiz');
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.demo_vacancies) = 4 * (select count(*) from public.categories where is_active),
  'qayta yaratishdan keyin ham har sohada 4 ta (ikkilanmagan)');
select pg_temp.ok((select count(*) from public.vacancies) = (select n from real_before), 'haqiqiy vakansiyalar jadvaliga hech narsa qo''shilmagan');
select pg_temp.ok(not exists (select 1 from pg_constraint where conrelid = 'public.demo_vacancies'::regclass and confrelid = 'public.vacancies'::regclass)
  and not exists (select 1 from pg_constraint where confrelid = 'public.demo_vacancies'::regclass),
  'namuna jadvali haqiqiy vakansiyalar, arizalar va boshqa jadvallar bilan bog''lanmagan');

-- 5) operator (SQL Editor / "SET ROLE postgres" qiladigan vosita)
set role postgres;
select pg_temp.ok((select public.demo_vacancies_remove()) >= 100, 'operator (SET ROLE postgres) namunalarni olib tashlaydi');
reset role;

-- 6) migratsiya fayli takror ishga tushirilsa (namunalar olib tashlangan) — ular qaytib qolmaydi
\i supabase/migrations/0077_demo_vacancies.sql
select pg_temp.ok((select count(*) from public.demo_vacancies) = 0, 'takror o''rnatish olib tashlangan namunalarni qaytarmaydi');
select pg_temp.ok((select public.demo_vacancies_seed()) >= 100, 'qo''lda qaytarish ishlaydi');

rollback;
