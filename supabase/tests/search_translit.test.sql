-- 0082 · Qidiruv: kasbi ro'yxatdan tanlanmagan e'lon kirill/lotin va tutuq belgisidan qat'i nazar topiladi
-- (ega, 2026-11-18: "Men o'qituvchiman" — "Ўқитувчи" e'loni topilmasdi).
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;

-- uz_fold
select pg_temp.ok(public.uz_fold('Ўқитувчи') = 'oqituvchi', 'kirill → lotin');
select pg_temp.ok(public.uz_fold('O''qituvchi') = public.uz_fold('Oʻqituvchi') and public.uz_fold('O‘qituvchi') = 'oqituvchi', 'tutuq belgisining har xil shakli');
select pg_temp.ok(public.uz_fold('Етказиб берувчи') = 'yetkazib beruvchi', 'so''z boshidagi е → ye');
select pg_temp.ok(public.uz_fold('Учитель') = 'uchitel', 'ruscha ham lotinga');
select pg_temp.ok(public.uz_fold('Шофёр, Ғалла-қоровул!') = 'shofyor galla qorovul', 'ш, ё, ғ, қ va tinish belgilari');
select pg_temp.ok(public.uz_fold(null) = '', 'null → bo''sh');

-- majburiy moderatsiya bu yerda sinalmaydi (moderation.test.sql): e'lonlar darhol faol bo'lsin
update public.app_settings set value = 'false'::jsonb where key in ('worker_phone_required', 'moderation_enabled', 'employer_verification_required', 'listings_paid');

-- ma'lumot: ish beruvchi va kasbi ro'yxatdan tanlanmagan e'lonlar
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('82000000-0000-0000-0000-000000000001', '+998908200001', now(), '{"first_name":"Muhammadali","last_name":""}');
create temp table fx on commit drop as
select
  (select id from public.profession_nodes where name_uz = 'O''qituvchi' and not selectable limit 1) as grp,
  (select id from public.profession_nodes where name_uz = 'Oshpaz' and selectable limit 1) as cook,
  (select id from public.regions where slug = 'tashkent_city') as region,
  (select id from public.categories where slug = 'education') as cat;
select pg_temp.ok((select grp is not null and cook is not null and region is not null from fx), 'kasblar va hudud bor');

insert into public.vacancies (owner_profile_id, title, custom_profession, category_id, region_id, description, status, salary_negotiable, published_at, expires_at)
select '82000000-0000-0000-0000-000000000001', t.title, t.custom, fx.cat, fx.region, 'Matematika', 'active', true, now(), now() + interval '10 days'
from fx, (values ('Ўқитувчи', 'Ўқитувчи'), ('Oqituvchi kerak', null), ('Ingliz tili oʻqituvchisi', null), ('Qorovul', 'Qorovul')) as t(title, custom);

-- kasb guruhi bo'yicha qidiruv (sun'iy yordamchi "Men o'qituvchiman" → "O'qituvchi" guruhi)
select pg_temp.ok(
  (select count(*) from public.simple_search_vacancies((select grp from fx), null, null, false, null, null, false, 50, 0) where title in ('Ўқитувчи', 'Oqituvchi kerak', 'Ingliz tili oʻqituvchisi')) = 3,
  'kirillcha, tutuq belgisisiz va boshqa tutuq belgili e''lonlar topiladi');
select pg_temp.ok(
  (select count(*) from public.simple_search_vacancies((select grp from fx), null, null, false, null, null, false, 50, 0) where title = 'Qorovul') = 0,
  'boshqa kasb — topilmaydi');
select pg_temp.ok(
  (select count(*) from public.simple_search_vacancies_v2((select grp from fx), null, null, false, null, null, false, 50, 0, null) where title = 'Ўқитувчи') = 1,
  'v2 ham');
select pg_temp.ok(
  (select count(*) from public.simple_search_vacancies_v3((select grp from fx), null, null, false, null, null, false, 50, 0, null, null, false, false) where title = 'Ўқитувчи') = 1,
  'v3 ham');
select pg_temp.ok(
  (select count(*) from public.simple_search_vacancies((select cook from fx), null, null, false, null, null, false, 50, 0) where title like '%итувчи' or title ilike '%qituvchi%') = 0,
  'oshpaz qidiruvida o''qituvchi chiqmaydi');

-- ishchi: kasbi ro'yxatdan tanlanmagan (o'zi yozgan) — kirillcha
insert into public.worker_profiles (profile_id, headline, custom_profession, about, region_id, category_id, experience_level, is_public, onboarding_completed_at)
select '82000000-0000-0000-0000-000000000001', null, 'Ўқитувчи', 'Matematika', fx.region, fx.cat, '3_5y', true, now() from fx;
select pg_temp.ok(
  (select count(*) from public.simple_search_workers((select grp from fx), null, null, false, false, 50, 0) where first_name = 'Muhammadali') = 1,
  'ishchi: o''zi yozgan kirillcha kasb nomi bo''yicha topiladi');

rollback;
\echo '✓ search_translit'
