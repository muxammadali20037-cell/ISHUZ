-- 0083 · vacancy_contacts.channel_phone_at: ustun bor, null standart, egasi o'zi yoza oladi, begona — yo'q.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end $$;
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;

select pg_temp.ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vacancy_contacts' and column_name = 'channel_phone_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES'),
  'channel_phone_at ustuni (timestamptz, null bo''lishi mumkin)');

-- majburiy moderatsiya bu yerda sinalmaydi (moderation.test.sql): e'lonlar darhol faol bo'lsin
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required');

-- ma'lumot: ish beruvchi, begona foydalanuvchi va bitta faol vakansiya
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('83000000-0000-0000-0000-000000000001', '+998908300001', now(), '{"first_name":"Egasi"}'),
  ('83000000-0000-0000-0000-000000000002', '+998908300002', now(), '{"first_name":"Begona"}');
insert into public.vacancies (owner_profile_id, title, category_id, region_id, status, salary_negotiable, published_at, expires_at)
select '83000000-0000-0000-0000-000000000001', 'Oshpaz', (select id from public.categories limit 1), (select id from public.regions where slug = 'tashkent_city'), 'active', true, now(), now() + interval '10 days';
create temp table ctx as
select v.id as vacancy_id, v.owner_profile_id as owner, '83000000-0000-0000-0000-000000000002'::uuid as stranger
from public.vacancies v where v.owner_profile_id = '83000000-0000-0000-0000-000000000001';
grant select on ctx to authenticated;
select pg_temp.ok((select count(*) = 1 from ctx), 'vakansiya yaratildi');

insert into public.vacancy_contacts (vacancy_id, phone, show_phone)
select vacancy_id, '+998901112233', true from ctx
on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = true, channel_phone_at = null;

select pg_temp.ok((select channel_phone_at is null from public.vacancy_contacts where vacancy_id = (select vacancy_id from ctx)), 'standart — null (kanalda raqamsiz)');

select pg_temp.login((select stranger from ctx));
update public.vacancy_contacts set channel_phone_at = now() where vacancy_id = (select vacancy_id from ctx);
select pg_temp.superuser();
select pg_temp.ok((select channel_phone_at is null from public.vacancy_contacts where vacancy_id = (select vacancy_id from ctx)), 'begona foydalanuvchi rozilikni yoza olmaydi (RLS)');

select pg_temp.login((select owner from ctx));
update public.vacancy_contacts set channel_phone_at = now() where vacancy_id = (select vacancy_id from ctx);
select pg_temp.superuser();
select pg_temp.ok((select channel_phone_at is not null from public.vacancy_contacts where vacancy_id = (select vacancy_id from ctx)), 'egasi o''z e''loniga rozilik yozadi');

rollback;
