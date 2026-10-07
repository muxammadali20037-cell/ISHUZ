-- ISH.UZ · xavfsizlik 2: vakansiya yaratish cheklovi, logo bucket SVG taqiqi
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
-- bu test xavfsizlik haqida: e'lon to'lovi sozlamasi aralashmasin
update public.app_settings set value = 'true'::jsonb where key = 'listing_free_trial';
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e8000000-0000-0000-0000-000000000001', '+998909200001', now(), '{"first_name":"Spam","last_name":"S"}');

select pg_temp.login('e8000000-0000-0000-0000-000000000001');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'Vakansiya ' || g, c.id, r.id from generate_series(1, 10) g, public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.vacancies where owner_profile_id = auth.uid()) = 10, 'soatiga 10 tagacha yaratish mumkin');
select pg_temp.fails($$insert into public.vacancies (owner_profile_id, title, category_id, region_id) select auth.uid(), 'Ortiqcha', c.id, r.id from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city'$$, '11-chisi soat ichida — cheklov', 'rate_limited');

select pg_temp.superuser();
select pg_temp.ok(not exists (select 1 from storage.buckets where id = 'company-logos' and 'image/svg+xml' = any(allowed_mime_types)) or not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets'), 'logo bucket: SVG taqiqlangan');
rollback;
\echo '✓ xavfsizlik (2) testlari o''tdi'
