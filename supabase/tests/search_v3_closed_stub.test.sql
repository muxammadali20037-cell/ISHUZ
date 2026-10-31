-- 0069 · yopilgan vakansiya ko'rinishi (vacancy_public_stub) va 0070 · qidiruv: maksimal maosh va ma'lumoti filtrlari
\set ON_ERROR_STOP on
\set QUIET on

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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'listings_paid');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('69000000-0000-0000-0000-000000000001', '+998906900001', now(), '{"first_name":"Ish beruvchi"}');
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
values ('69000000-0000-0000-0000-000000000001', 'person', 'S70 ish beruvchi', now()) on conflict (profile_id) do nothing;

-- maosh: oylik 3 mln, oylik 8–12 mln, kunlik 200 000 (≈4,4 mln/oy), kelishiladi; ma'lumot: o'rta, oliy, talabsiz
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, salary_from, salary_to, salary_type, salary_negotiable, education_min, published_at, expires_at)
select '69000000-0000-0000-0000-000000000001', t.title, c.id, r.id, 'Sinov e''loni: ' || t.title || ', ish vaqti 9 dan 18 gacha', 'active',
       t.sfrom, t.sto, t.stype::public.salary_type, t.neg, t.edu::public.education_level, now() - interval '1 hour', now() + interval '5 days'
from public.categories c, public.regions r,
  (values ('S70 arzon', 3000000, null::int, 'monthly', false, 'secondary'),
          ('S70 qimmat', 8000000, 12000000, 'monthly', false, 'higher'),
          ('S70 kunlik', 200000, null, 'daily', false, null),
          ('S70 kelishiladi', null, null, 'negotiable', true, 'master')) as t(title, sfrom, sto, stype, neg, edu)
where c.slug = 'sales' and r.slug = 'tashkent_city';

select pg_temp.anon();
select pg_temp.ok(
  (select array_agg(title order by title) from public.search_vacancies_v3(p_query => 'S70', p_limit => 50))
    = array['S70 arzon', 'S70 kelishiladi', 'S70 kunlik', 'S70 qimmat'],
  'filtrsiz v3 = hammasi (v2 bilan bir xil)');
select pg_temp.ok(
  (select count(*) from public.search_vacancies_v3(p_query => 'S70', p_limit => 50))
    = (select count(*) from public.search_vacancies_v2(p_query => 'S70', p_limit => 50)),
  'v2 va v3 natijalari soni bir xil');
select pg_temp.ok(
  (select array_agg(title order by title) from public.search_vacancies_v3(p_query => 'S70', p_salary_max => 5000000, p_limit => 50))
    = array['S70 arzon', 'S70 kelishiladi', 'S70 kunlik'],
  'max 5 mln: 3 mln, kunlik (≈4,4 mln), kelishiladi; 8–12 mln — yo''q');
select pg_temp.ok(
  (select array_agg(title order by title) from public.search_vacancies_v3(p_query => 'S70', p_salary_max => 4000000, p_limit => 50))
    = array['S70 arzon', 'S70 kelishiladi'],
  'max 4 mln: kunlik 200 000 oylik ekvivalentda (4,4 mln) — o''tmaydi');
select pg_temp.ok(
  (select array_agg(title order by title) from public.search_vacancies_v3(p_query => 'S70', p_education => 'secondary', p_limit => 50))
    = array['S70 arzon', 'S70 kunlik'],
  'ma''lumot o''rta: o''rta talab qiladigan va talabsiz');
select pg_temp.ok(
  (select array_agg(title order by title) from public.search_vacancies_v3(p_query => 'S70', p_education => 'higher', p_limit => 50))
    = array['S70 arzon', 'S70 kunlik', 'S70 qimmat'],
  'ma''lumot oliy: magistr talabidan tashqari hammasi');
select pg_temp.ok(
  (select array_agg(title order by title) from public.search_vacancies_v3(p_query => 'S70', p_salary_min => 4000000, p_salary_max => 10000000, p_limit => 50))
    = array['S70 kelishiladi', 'S70 kunlik', 'S70 qimmat'],
  'min va max birga: oraliq');
select pg_temp.superuser();

-- ---------- 0069: yopilgan vakansiya ko'rinishi ----------
update public.vacancies set status = 'closed' where title = 'S70 arzon';
update public.vacancies set expires_at = now() - interval '1 minute' where title = 'S70 qimmat';
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, published_at)
select '69000000-0000-0000-0000-000000000001', 'S70 qoralama', c.id, r.id, 'Hech qachon ommaviy bo''lmagan qoralama e''lon matni', 'draft', null
from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';
update public.vacancies set status = 'hidden' where title = 'S70 kelishiladi';

select pg_temp.anon();
select pg_temp.ok((select count(*) from public.vacancies where title = 'S70 arzon') = 0, 'RLS: yopilgan vakansiya mehmonga ko''rinmaydi');
select pg_temp.ok(
  (select public.vacancy_public_stub(slug) ->> 'status' from (select slug from public.search_vacancies_v3(p_query => 'S70 kunlik', p_limit => 1)) s) is null,
  'faol vakansiya uchun ko''rinish yo''q (to''liq sahifa ochiladi)');
select pg_temp.superuser();
create temp table slugs as select title, slug from public.vacancies where title like 'S70 %';
grant select on slugs to anon;
select pg_temp.anon();
select pg_temp.ok((select public.vacancy_public_stub(slug) ->> 'status' from slugs where title = 'S70 arzon') = 'closed', 'yopilgan → closed');
select pg_temp.ok((select public.vacancy_public_stub(slug) ->> 'status' from slugs where title = 'S70 qimmat') = 'expired', 'muddati o''tgan (cron yopmagan) → expired');
select pg_temp.ok((select public.vacancy_public_stub(slug) from slugs where title = 'S70 qoralama') is null, 'qoralama — hech qachon');
select pg_temp.ok((select public.vacancy_public_stub(slug) from slugs where title = 'S70 kelishiladi') is null, 'admin yashirgan — hech qachon');
select pg_temp.ok(
  (select not (public.vacancy_public_stub(slug) ?| array['description', 'salary_from', 'owner_profile_id', 'address', 'phone']) from slugs where title = 'S70 arzon'),
  'ko''rinishda maxfiy maydonlar yo''q');
select pg_temp.superuser();

rollback;
\echo ✓ search_v3_closed_stub
