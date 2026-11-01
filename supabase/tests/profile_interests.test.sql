-- 0072 · takroriy vakansiya, TOP vakansiya (admin), admin_log prefikslari
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2', 'iat', extract(epoch from now())::bigint + 5)::text, false);
  execute 'set role authenticated';
end $$;
-- superuser qoladi (RLS chetlanadi), lekin auth.uid() = p_user — trigger "ish beruvchining o'z amali" deb ko'radi
create or replace function pg_temp.as_owner(p_user uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
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
  ('73000000-0000-0000-0000-000000000001', '+998907300001', now(), '{"first_name":"Dunyo"}'),
  ('73000000-0000-0000-0000-000000000002', '+998907300002', now(), '{"first_name":"Boshqa"}');

create temp table c3 on commit drop as select id from public.categories order by sort_order limit 9;
grant select on c3 to authenticated, anon;

-- 1) mehmon chaqira olmaydi; to'g'ridan-to'g'ri yozish yo'q
select pg_temp.superuser();
set role anon;
select pg_temp.fails($$select public.set_my_interests(array(select id from c3 limit 2))$$, 'anon: set_my_interests yo''q', '42501');
reset role;

select pg_temp.login('73000000-0000-0000-0000-000000000001');
select pg_temp.fails($$insert into public.profile_interests (profile_id, category_id) select auth.uid(), id from c3 limit 1$$, 'to''g''ridan-to''g''ri insert yo''q', '42501');

-- 2) 1–8 ta: bo'sh va 9 ta — rad etiladi
select pg_temp.fails($$select public.set_my_interests('{}'::uuid[])$$, 'bo''sh ro''yxat', 'invalid_interests');
select pg_temp.fails($$select public.set_my_interests(array(select id from c3))$$, '9 ta — ko''p', 'invalid_interests');

-- 3) o'rnatish, takror id va noma'lum id e'tiborsiz; to'liq almashtirish
select pg_temp.ok(public.set_my_interests(array(select id from c3 limit 3) || array(select id from c3 limit 1) || array['00000000-0000-0000-0000-0000000000ff'::uuid]) = 3, '3 ta saqlandi (takror va noma''lum — tashlab yuborildi)');
select pg_temp.ok((select count(*) from public.profile_interests) = 3, 'o''zi 3 tasini ko''radi');
select pg_temp.ok(public.set_my_interests(array(select id from c3 order by id desc limit 1)) = 1, 'almashtirish');
select pg_temp.ok((select count(*) from public.profile_interests) = 1, 'eskilari o''chdi');

-- 4) boshqa foydalanuvchi birovnikini ko'rmaydi
select pg_temp.login('73000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.profile_interests) = 0, 'boshqaning qiziqishlari ko''rinmaydi');
select pg_temp.superuser();
rollback;
\echo ✓ profile_interests
