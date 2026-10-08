-- ISH.UZ · hisobni o'chirish: vakansiyalar yopiladi, to'lovlar saqlanadi, admin o'chira olmaydi
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
  ('e7100000-0000-0000-0000-000000000001', '+998909100001', now(), '{"first_name":"Ketadigan","last_name":"U"}'),
  ('e7100000-0000-0000-0000-000000000002', '+998909100002', now(), '{"first_name":"Hamkor","last_name":"H"}'),
  ('e7100000-0000-0000-0000-000000000009', null, null, '{"first_name":"Admin","last_name":"A"}');
insert into public.admin_users (profile_id, role) values ('e7100000-0000-0000-0000-000000000009', 'admin');

select pg_temp.login('e7100000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'company');
insert into public.companies (name, created_by) values ('Yolg''iz MChJ', auth.uid());
insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id)
select auth.uid(), co.id, 'Yolg''iz vakansiya', c.id, r.id from public.companies co, public.categories c, public.regions r
where co.name = 'Yolg''iz MChJ' and c.slug = 'sales' and r.slug = 'tashkent_city';
select public.publish_vacancy((select id from public.vacancies where title = 'Yolg''iz vakansiya'));
select pg_temp.superuser();
insert into public.payments (profile_id, purpose, amount, provider, vacancy_id) select 'e7100000-0000-0000-0000-000000000001', 'vacancy_publish', 50000, 'payme', id from public.vacancies where title = 'Yolg''iz vakansiya';

select pg_temp.login('e7100000-0000-0000-0000-000000000009');
select pg_temp.fails($$select public.prepare_account_deletion()$$, 'admin o''zini o''chira olmaydi', 'admin_cannot_delete');

select pg_temp.login('e7100000-0000-0000-0000-000000000001');
select pg_temp.ok((public.prepare_account_deletion()->>'closed_vacancies')::int = 1, 'egasiz qoladigan faol vakansiya yopildi');
select pg_temp.superuser();
select pg_temp.ok((select status = 'closed' from public.vacancies where title = 'Yolg''iz vakansiya'), 'holat: closed');
select pg_temp.ok((select count(*) from public.audit_logs where action = 'user.self_delete' and target_id = 'e7100000-0000-0000-0000-000000000001') = 1, 'audit logga yozildi');
delete from auth.users where id = 'e7100000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.profiles where id = 'e7100000-0000-0000-0000-000000000001') = 0, 'profil o''chdi');
select pg_temp.ok((select count(*) from public.payments where amount = 50000 and profile_id is null) = 1, 'to''lov yozuvi saqlandi (profil bo''sh)');
select pg_temp.ok((select owner_profile_id is null from public.vacancies where title = 'Yolg''iz vakansiya'), 'vakansiya egasi bo''shadi, yozuv qoldi');

select pg_temp.superuser();
rollback;
\echo '✓ hisobni o''chirish testlari o''tdi'
