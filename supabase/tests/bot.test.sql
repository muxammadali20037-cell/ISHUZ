-- ISH.UZ · Telegram bot: suhbat holati (bot_sessions) va mos vakansiyalar (faqat service role)
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
  ('e7000000-0000-0000-0000-000000000001', '+998907000001', now(), '{"first_name":"Bot","last_name":"Ishchi"}'),
  ('e7000000-0000-0000-0000-000000000002', '+998907000002', now(), '{"first_name":"Bot","last_name":"Firma"}');

-- ishchi (kassir, Toshkent) va ish beruvchi (2 ta faol vakansiya: mos soha + boshqa soha)
insert into public.worker_profiles (profile_id, category_id, subcategory_id, region_id, status, is_public)
select 'e7000000-0000-0000-0000-000000000001', c.id, s.id, r.id, 'active', true
from public.categories c join public.subcategories s on s.category_id = c.id, public.regions r
where c.slug = 'restaurant' and s.slug = 'waiter' and r.slug = 'tashkent_city';
insert into public.employer_profiles (profile_id, employer_type) values ('e7000000-0000-0000-0000-000000000002', 'company');
insert into public.companies (name, created_by) values ('Bot kafe', 'e7000000-0000-0000-0000-000000000002');
insert into public.vacancies (owner_profile_id, company_id, title, category_id, subcategory_id, region_id, status, published_at, salary_from, salary_type)
select 'e7000000-0000-0000-0000-000000000002', co.id, 'Ofitsiant bot', c.id, s.id, r.id, 'active', now(), 5000000, 'monthly'
from public.companies co, public.categories c join public.subcategories s on s.category_id = c.id, public.regions r
where co.name = 'Bot kafe' and c.slug = 'restaurant' and s.slug = 'waiter' and r.slug = 'tashkent_city';
insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, status, published_at)
select 'e7000000-0000-0000-0000-000000000002', co.id, 'Yukchi bot', c.id, r.id, 'active', now()
from public.companies co, public.categories c, public.regions r where co.name = 'Bot kafe' and c.slug = 'logistics' and r.slug = 'tashkent_city';
insert into public.bot_sessions (telegram_user_id, profile_id, step, data) values (777001, 'e7000000-0000-0000-0000-000000000001', 'name', '{}');

-- service role: faqat ishchining sohasidagi faol vakansiyalar, moslik bali bilan
set role service_role;
select pg_temp.ok((select count(*) = 1 and bool_and(title = 'Ofitsiant bot') and bool_and(score > 0) and bool_and(total = 1)
  from public.bot_matching_vacancies((select id from public.worker_profiles where profile_id = 'e7000000-0000-0000-0000-000000000001'), 5, 0)), 'bot: faqat mos sohadagi vakansiya, bal bilan');
select pg_temp.ok((select count(*) from public.bot_matching_vacancies(gen_random_uuid(), 5, 0)) = 0, 'bot: noma''lum ishchi — bo''sh');
select pg_temp.ok((select count(*) from public.bot_sessions) = 1, 'bot: service role sessiyani o''qiydi');
reset role;

-- mijoz (anon / ishchining o'zi) sessiyani ham, funksiyani ham ko'ra olmaydi
select pg_temp.login('e7000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select * from public.bot_sessions$$, 'bot_sessions: foydalanuvchiga yopiq', '42501');
select pg_temp.fails($$select * from public.bot_matching_vacancies((select id from public.worker_profiles limit 1), 5, 0)$$, 'bot_matching_vacancies: foydalanuvchiga yopiq', '42501');
select pg_temp.anon();
select pg_temp.fails($$insert into public.bot_sessions (telegram_user_id, step) values (1, 'name')$$, 'bot_sessions: anon yoza olmaydi', '42501');
select pg_temp.fails($$select * from public.bot_matching_vacancies(gen_random_uuid(), 5, 0)$$, 'bot_matching_vacancies: anon yopiq', '42501');

select pg_temp.superuser();
rollback;
\echo '✓ bot testlari o''tdi'
