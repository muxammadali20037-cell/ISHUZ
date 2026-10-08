-- ISH.UZ · davlat tashkilotlari: vakansiya belgisi faqat tasdiqlangan davlat tashkilotida
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
-- 0049+: bu fayl eski oqimlarni sinaydi; majburiy moderatsiya va ish beruvchi darvozasi — moderation.test.sql da
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('b1000000-0000-0000-0000-000000000001', '+998902000001', now(), '{"first_name":"Hokimlik","last_name":"HR"}'),
  ('b1000000-0000-0000-0000-000000000002', '+998902000002', now(), '{"first_name":"Firma","last_name":"HR"}'),
  ('b1000000-0000-0000-0000-000000000009', null, null, '{"first_name":"Admin","last_name":"A"}');
insert into public.admin_users (profile_id, role) values ('b1000000-0000-0000-0000-000000000009', 'admin');

-- davlat tashkiloti ro'yxatdan o'tadi va vakansiya e'lon qiladi
select pg_temp.login('b1000000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'government');
insert into public.companies (name, created_by, is_government) values ('Chilonzor tumani hokimligi', auth.uid(), true);
create temp table g as select id as company_id from public.companies where name = 'Chilonzor tumani hokimligi';
grant select on g to public;
insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id)
select auth.uid(), g.company_id, 'Bosh mutaxassis', c.id, r.id from g, public.categories c, public.regions r where c.slug = 'office' and r.slug = 'tashkent_city';
select public.publish_vacancy((select id from public.vacancies where title = 'Bosh mutaxassis'));
select pg_temp.ok((select not is_government from public.vacancies where title = 'Bosh mutaxassis'), 'tasdiqlanmagan tashkilot: davlat belgisi yo''q');
select pg_temp.ok((select count(*) from public.search_vacancies(p_government_only => true)) = 0, 'tasdiqlanmagan: davlat filtrida chiqmaydi');
update public.vacancies set is_government = true where title = 'Bosh mutaxassis';
select pg_temp.ok((select not is_government from public.vacancies where title = 'Bosh mutaxassis'), 'is_government ni qo''lda qo''yib bo''lmaydi (trigger qayta hisoblaydi)');
insert into public.verification_requests (profile_id, company_id, type) select auth.uid(), company_id, 'company' from g;

-- oddiy firma o'zini davlat tashkiloti qilib o'zgartira olmaydi
select pg_temp.login('b1000000-0000-0000-0000-000000000002');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'company');
insert into public.companies (name, created_by) values ('Oddiy firma', auth.uid());
select pg_temp.fails($$update public.companies set is_government = true where name = 'Oddiy firma'$$, 'RLS: kompaniya o''zini keyin davlat tashkiloti qila olmaydi', '42501');

-- admin tasdiqlaydi → vakansiya davlat belgisini oladi
select pg_temp.login('b1000000-0000-0000-0000-000000000009');
select public.admin_review_verification((select id from public.verification_requests where company_id = (select company_id from g)), 'verified');
select pg_temp.anon();
select pg_temp.ok((select is_government from public.search_vacancies(p_query => 'mutaxassis')), 'tasdiqlangach: is_government = true');
select pg_temp.ok((select count(*) from public.search_vacancies(p_government_only => true)) = 1, 'davlat filtri: 1 ta vakansiya');

-- tashkilot bloklansa belgi olib tashlanadi
select pg_temp.superuser();
update public.companies set is_blocked = true where id = (select company_id from g);
select pg_temp.ok((select not is_government from public.vacancies where title = 'Bosh mutaxassis'), 'bloklangan tashkilot: belgi olib tashlandi');

select pg_temp.superuser();
rollback;
\echo '✓ davlat tashkilotlari testlari o''tdi'
