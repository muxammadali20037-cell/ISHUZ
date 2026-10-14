-- 0064 · Tezkor ariza: profil to'ldirmasdan ariza; ish beruvchi arizachini ism bilan ko'radi, begonalar va mehmon ko'rmaydi;
--        to'ldirilmagan profil ochiq qidiruvga chiqmaydi; bloklangan — hech kimga
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal1', 'iat', extract(epoch from now())::bigint + 5)::text, false);
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required');

-- W — profilsiz ish izlovchi (tezkor ariza), E — ish beruvchi, X — boshqa ish beruvchi, P — to'ldirilmagan, lekin "ochiq" profil
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('64000000-0000-0000-0000-00000000000a', '+998906400001', now(), '{"first_name":"Jasur"}'),
  ('64000000-0000-0000-0000-00000000000b', '+998906400002', now(), '{"first_name":"Dilnoza"}'),
  ('64000000-0000-0000-0000-00000000000c', '+998906400003', now(), '{"first_name":"Sardor"}'),
  ('64000000-0000-0000-0000-00000000000d', '+998906400004', now(), '{"first_name":"Malika"}');
insert into public.vacancies (owner_profile_id, title, category_id, region_id, status, published_at, expires_at)
select '64000000-0000-0000-0000-00000000000b', 'QA-Kassir-64', c.id, r.id, 'active', now(), now() + interval '10 days'
from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
insert into public.worker_profiles (profile_id, is_public) values ('64000000-0000-0000-0000-00000000000d', true);

select pg_temp.ok((public.simple_listing_features() ->> 'quick_apply')::boolean, 'bayroq: quick_apply yoqilgan');

-- ===== W: profil to'ldirmasdan ariza =====
select pg_temp.login('64000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.apply_to_vacancy((select id from public.vacancies where title = 'QA-Kassir-64'))$$, 'profil umuman yo''q — RPC baribir rad (ilova avval yopiq profil yaratadi)', 'worker_profile_required');
insert into public.worker_profiles (profile_id, is_public) values (auth.uid(), false);
select pg_temp.fails($$insert into public.worker_profiles (profile_id, is_public) values ('64000000-0000-0000-0000-00000000000c', false)$$, 'boshqa odam nomidan profil yaratib bo''lmaydi');
select pg_temp.ok((select onboarding_completed_at is null and not is_public from public.worker_profiles where profile_id = auth.uid()), 'yopiq, to''ldirilmagan profil');

-- ariza yuborilmaguncha ish beruvchi ko'rmaydi
select pg_temp.login('64000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '64000000-0000-0000-0000-00000000000a') = 0, 'arizagacha: ish beruvchi yopiq profilni ko''rmaydi');

select pg_temp.login('64000000-0000-0000-0000-00000000000a');
create temp table a1 as select public.apply_to_vacancy((select id from public.vacancies where title = 'QA-Kassir-64')) as id;
select pg_temp.ok((select count(*) from public.applications where id = (select id from a1)) = 1, 'ariza yuborildi');

-- E: arizachini ism bilan ko'radi (avval "Nomzod" edi)
select pg_temp.login('64000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '64000000-0000-0000-0000-00000000000a') = 1, 'ariza bor: ish beruvchi to''ldirilmagan profilni ko''radi');
select pg_temp.ok((select p.first_name from public.applications a join public.worker_profiles w on w.id = a.worker_id
  join public.profiles p on p.id = w.profile_id where a.id = (select id from a1)) = 'Jasur', 'ish beruvchi arizachining ismini ko''radi');

-- X: aloqasi yo'q — ko'rmaydi; to'ldirilmagan "ochiq" profil ham hech kimga ko'rinmaydi (avvalgi qoida saqlangan)
select pg_temp.login('64000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '64000000-0000-0000-0000-00000000000a') = 0, 'begona ish beruvchi yopiq profilni ko''rmaydi');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '64000000-0000-0000-0000-00000000000d') = 0, 'to''ldirilmagan ochiq profil qidiruvchilarga ko''rinmaydi');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '64000000-0000-0000-0000-00000000000a') = 0, 'mehmon ko''rmaydi');

-- bloklangan arizachi — ish beruvchiga ham ko'rinmaydi
select pg_temp.superuser();
update public.profiles set is_blocked = true where id = '64000000-0000-0000-0000-00000000000a';
select pg_temp.login('64000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '64000000-0000-0000-0000-00000000000a') = 0, 'bloklangan arizachi ko''rinmaydi');
select pg_temp.superuser();

do $$ begin raise notice '✓ quick_apply: hammasi o''tdi'; end $$;
rollback;
