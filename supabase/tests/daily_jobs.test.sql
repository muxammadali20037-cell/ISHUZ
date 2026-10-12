-- 0060 · kunlik ishlar: oddiy formada haq turi (oylik/kunlik), tahrirda saqlanadi, noto'g'ri qiymat e'tiborsiz;
--        simple_search_vacancies_v2 haq turi bo'yicha filtrlaydi; bosh sahifa sozlamalari ochiq; site-media — faqat server
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2', 'iat', extract(epoch from now())::bigint + 5)::text, false);
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'listings_paid');

grant select, insert, update, delete on storage.objects to anon, authenticated;
alter table storage.objects enable row level security;

create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by depth limit 1) as node,
  (select id from public.regions where slug = 'tashkent_city') as region,
  '5f000000-0000-0000-0000-000000000001'::uuid as a;
grant select on fx to authenticated, anon;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('5f000000-0000-0000-0000-000000000001', '+998907400001', now(), '{"first_name":"Kamol"}');
insert into public.profile_contacts (profile_id, phone, phone_verified_at) values ('5f000000-0000-0000-0000-000000000001', '+998907400001', now())
on conflict (profile_id) do update set phone = excluded.phone;

create temp table vl on commit drop as
select jsonb_build_object('profession_node_id', node, 'region_id', region, 'employer_type', 'person', 'org_name', 'Kamol aka',
  'contact_phone', '+998907400001', 'description', 'Bir kunlik ish: omborni tartiblash, 9 dan 18 gacha', 'salary_negotiable', false,
  'salary_from', 200000, 'show_phone', true) as p from fx;
grant select on vl to authenticated;

select pg_temp.login('5f000000-0000-0000-0000-000000000001');
create temp table r1 on commit drop as select public.save_simple_vacancy((select p || jsonb_build_object('client_ref', gen_random_uuid(), 'salary_type', 'daily') from vl)) as r;
create temp table r2 on commit drop as select public.save_simple_vacancy((select p || jsonb_build_object('client_ref', gen_random_uuid()) from vl)) as r;
create temp table r3 on commit drop as select public.save_simple_vacancy((select p || jsonb_build_object('client_ref', gen_random_uuid(), 'salary_type', 'hourly') from vl)) as r;
grant select on r1, r2, r3 to authenticated, anon;
select pg_temp.ok((select salary_type = 'daily' from public.vacancies where id = ((select r from r1) ->> 'vacancy_id')::uuid), 'kunlik haq saqlanadi');
select pg_temp.ok((select salary_type = 'monthly' from public.vacancies where id = ((select r from r2) ->> 'vacancy_id')::uuid), 'berilmasa — oylik (avvalgidek)');
select pg_temp.ok((select salary_type = 'monthly' from public.vacancies where id = ((select r from r3) ->> 'vacancy_id')::uuid), 'oddiy formada ruxsat etilmagan tur (soatlik) e''tiborsiz');

-- tahrir: salary_type berilmasa — mavjud tur saqlanadi; berilsa — almashadi
select public.save_simple_vacancy((select p || jsonb_build_object('vacancy_id', (select r from r1) ->> 'vacancy_id', 'description', 'Bir kunlik ish: omborni tartiblash, 8 dan 17 gacha') from vl));
select pg_temp.ok((select salary_type = 'daily' and description like '%8 dan 17%' from public.vacancies where id = ((select r from r1) ->> 'vacancy_id')::uuid),
  'tahrirda tur berilmasa — kunlik saqlanadi');
select public.save_simple_vacancy((select p || jsonb_build_object('vacancy_id', (select r from r2) ->> 'vacancy_id', 'salary_type', 'daily') from vl));
select pg_temp.ok((select salary_type = 'daily' from public.vacancies where id = ((select r from r2) ->> 'vacancy_id')::uuid), 'tahrirda oylik → kunlik');

-- qidiruv (mehmon): faqat kunliklar; eski funksiya o'zgarmagan
select pg_temp.superuser();
update public.vacancies set status = 'active', published_at = now(), expires_at = now() + interval '10 days' where owner_profile_id = (select a from fx);
select pg_temp.anon();
select pg_temp.ok((select count(*) = 2 and bool_and(salary_type = 'daily') from public.simple_search_vacancies_v2(p_region_id => (select region from fx), p_salary_type => 'daily', p_limit => 50)
  where id in (select id from public.vacancies where owner_profile_id = (select a from fx))), 'v2: kunlik filtr faqat kunliklarni qaytaradi');
select pg_temp.ok((select count(*) = 3 from public.simple_search_vacancies_v2(p_region_id => (select region from fx), p_limit => 50)
  where id in (select id from public.vacancies where owner_profile_id = (select a from fx))), 'v2: filtrsiz — hammasi');
select pg_temp.ok((select count(*) = 3 from public.simple_search_vacancies(p_region_id => (select region from fx), p_limit => 50)
  where id in (select id from public.vacancies where owner_profile_id = (select a from fx))), 'eski funksiya o''zgarmagan');

-- bosh sahifa sozlamalari: ochiq o'qiladi, mijoz yoza olmaydi
select pg_temp.ok((select count(*) = 2 from public.app_settings where key in ('home_banners', 'ai_search_button')), 'sozlamalar mehmonga ochiq');
select pg_temp.login('5f000000-0000-0000-0000-000000000001');
update public.app_settings set value = 'false'::jsonb where key = 'ai_search_button';
select pg_temp.superuser();
select pg_temp.ok((select value = 'true'::jsonb from public.app_settings where key = 'ai_search_button'), 'oddiy foydalanuvchi sozlamani o''zgartira olmaydi');

-- site-media: ommaviy, mijoz yozuvi siyosati yo'q
select pg_temp.ok((select public and allowed_mime_types = array['image/webp'] from storage.buckets where id = 'site-media'), 'site-media ommaviy, faqat WebP');
select pg_temp.login('5f000000-0000-0000-0000-000000000001');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('site-media', 'windows/v-' || repeat('ab', 32) || '.webp')$$,
  'site-media: mijoz fayl yuklay olmaydi (faqat server)', '42501');

rollback;
\echo '✓ daily_jobs.test.sql'
