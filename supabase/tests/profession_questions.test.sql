-- ISH.UZ · kasbga qarab savollar: hamma o'qiydi, faqat admin tahrirlaydi
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
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e6000000-0000-0000-0000-000000000001', '+998908000001', now(), '{"first_name":"Oddiy","last_name":"U"}'),
  ('e6000000-0000-0000-0000-000000000009', null, null, '{"first_name":"Admin","last_name":"A"}');
insert into public.admin_users (profile_id, role) values ('e6000000-0000-0000-0000-000000000009', 'admin');

select pg_temp.anon();
select pg_temp.ok((select count(*) from public.skill_questions where slug = 'driver_license') = 1, 'anonim: savollarni o''qiydi');
select pg_temp.ok((select count(*) from public.skill_question_options o join public.skill_questions q on q.id = o.question_id where q.slug = 'driver_license') = 6, 'guvohnoma: 6 ta variant');

select pg_temp.login('e6000000-0000-0000-0000-000000000001');
select pg_temp.fails($$insert into public.skill_questions (category_id, slug, title_uz, title_ru) select id, 'x', 'x', 'x' from public.categories limit 1$$, 'oddiy foydalanuvchi savol qo''sha olmaydi', '42501');
update public.skill_questions set title_uz = 'buzildi' where slug = 'driver_license';
select pg_temp.ok((select title_uz <> 'buzildi' from public.skill_questions where slug = 'driver_license'), 'oddiy foydalanuvchi tahrirlay olmaydi');

select pg_temp.login('e6000000-0000-0000-0000-000000000009');
insert into public.skill_questions (category_id, slug, title_uz, title_ru) select id, 'beauty_test', 'Test', 'Тест' from public.categories where slug = 'beauty';
select pg_temp.ok((select count(*) from public.skill_questions where slug = 'beauty_test') = 1, 'admin savol qo''shadi');

select pg_temp.superuser();
rollback;
\echo '✓ kasb savollari testlari o''tdi'
