-- 0086 · Bir kishida bir nechta ishchi e'loni: yangi e'lon, takror e'lon bo'lmasligi, o'z e'lonini tahrirlash, 100 ta
-- chegara, asosiy qator (arizalar, takliflar) va qidiruvda har e'lon alohida.
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'listings_paid');

create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by name_uz limit 1) as node_a,
  (select id from public.profession_nodes where selectable and is_active order by name_uz offset 1 limit 1) as node_b,
  (select id from public.regions where slug = 'tashkent_city') as region,
  (select id from public.regions where slug <> 'tashkent_city' order by slug limit 1) as region2;
grant select on fx to authenticated;

-- W: ishchi · O: boshqa ishchi · E: ish beruvchi
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('86000000-0000-0000-0000-000000000001', '+998908600001', now(), '{"first_name":"Ali","last_name":"V"}'),
  ('86000000-0000-0000-0000-000000000002', '+998908600002', now(), '{"first_name":"Olim","last_name":"B"}'),
  ('86000000-0000-0000-0000-000000000003', '+998908600003', now(), '{"first_name":"Kafe","last_name":""}');
insert into public.employer_profiles (profile_id, employer_type, display_name) values ('86000000-0000-0000-0000-000000000003', 'person', 'Kafe');

create temp table wl on commit drop as
select jsonb_build_object(
  'profession_node_id', node_a, 'region_id', region, 'district_id', null, 'first_name', 'Ali', 'last_name', 'V',
  'about', 'Ofitsiant bo''lib 2 yil ishladim', 'experience_level', '1_2y', 'salary_expected', null,
  'schedule', null, 'show_phone', true, 'remote', false, 'listing_phone', '+998901112233') as p
from fx;
grant select on wl to authenticated;

-- ===== 1. Birinchi e'lon — asosiy qator; "yangi e'lon" ham bo'sh asosiyni to'ldiradi =====
select pg_temp.login('86000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.save_simple_worker_listing((select p || '{"new_listing":true}'::jsonb from wl)) ->> 'state') = 'listed', '1-e''lon joylandi');
select pg_temp.ok((select count(*) = 1 and bool_and(is_primary) from public.worker_profiles where profile_id = auth.uid()), '1-e''lon — asosiy qator');

-- ===== 2. Boshqa kasb — yangi alohida e'lon (o'z raqami, maoshi) =====
create temp table second on commit drop as
select (public.save_simple_worker_listing((select p || jsonb_build_object('profession_node_id', node_b, 'new_listing', true, 'salary_expected', 6000000,
  'listing_phone', '+998935556677', 'about', 'Oshpaz yordamchisi bo''lib ishlayman') from wl, fx)) ->> 'worker_id')::uuid as id;
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = auth.uid()) = 2, 'boshqa kasb — 2-e''lon qo''shildi');
select pg_temp.ok((select not is_primary and is_public and profession_node_id = (select node_b from fx) from public.worker_profiles where id = (select id from second)), '2-e''lon — qo''shimcha, ommaviy, o''z kasbi bilan');
select pg_temp.ok((select phone = '+998935556677' from public.worker_listing_phones where worker_id = (select id from second)), '2-e''lonning o''z raqami');
select pg_temp.ok((select salary_expected = 6000000 from public.worker_preferences where worker_id = (select id from second)), '2-e''lonning o''z maoshi (yozish huquqi — barcha o''z e''lonlari)');
select pg_temp.ok((select current_worker_id() = (select id from public.worker_profiles where profile_id = auth.uid() and is_primary)), 'current_worker_id — asosiy qator');
select pg_temp.ok((select count(*) from public.my_listing_states() where entity = 'worker') = 2, '"E''lonlarim" holatlari — ikkala e''lon');

-- ===== 3. Shu kasb va hudud yana — takror e'lon emas, o'sha yangilanadi; boshqa hudud — yangi =====
select public.save_simple_worker_listing((select p || jsonb_build_object('profession_node_id', node_b, 'new_listing', true, 'about', 'Oshpaz yordamchisi, tajriba 3 yil') from wl, fx));
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = auth.uid()) = 2, 'shu kasb va hudud — yangi qator yo''q');
select pg_temp.ok((select about = 'Oshpaz yordamchisi, tajriba 3 yil' from public.worker_profiles where id = (select id from second)), 'o''sha e''lon yangilandi');
select public.save_simple_worker_listing((select p || jsonb_build_object('profession_node_id', node_b, 'region_id', region2, 'new_listing', true) from wl, fx));
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = auth.uid()) = 3, 'boshqa hudud — 3-e''lon');

-- ===== 4. O'z e'lonini tahrirlash; begonanikini — yo'q; bayroqsiz — asosiy (avvalgidek) =====
select public.save_simple_worker_listing((select p || jsonb_build_object('worker_id', (select id from second), 'profession_node_id', node_b, 'about', 'Tahrirlangan matn, oshxona') from wl, fx));
select pg_temp.ok((select about = 'Tahrirlangan matn, oshxona' from public.worker_profiles where id = (select id from second)), 'worker_id — o''sha e''lon tahrirlandi');
select public.save_simple_worker_listing((select p || '{"about":"Asosiy e''lon matni yangilandi"}'::jsonb from wl));
select pg_temp.ok((select about = 'Asosiy e''lon matni yangilandi' from public.worker_profiles where profile_id = auth.uid() and is_primary), 'bayroqsiz — asosiy e''lon (avvalgidek)');
select pg_temp.login('86000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || jsonb_build_object('first_name', 'Olim', 'worker_id', (select id from second)) from wl))$$, 'begona e''lonni tahrirlab bo''lmaydi', 'not_found');

-- ===== 5. Qidiruvda har e'lon alohida =====
select pg_temp.ok((select count(*) from public.simple_search_workers((select node_b from fx), (select region from fx)) where id = (select id from second)) = 1, 'qidiruvda 2-e''lon chiqadi');
select pg_temp.ok((select count(*) from public.simple_search_workers((select node_a from fx), (select region from fx)) s join public.worker_profiles w on w.id = s.id where w.profile_id = '86000000-0000-0000-0000-000000000001') = 1, 'qidiruvda 1-e''lon o''z kasbida');

-- ===== 6. Taklif qo'shimcha e'londan — shaxsga (asosiy qator), ishchi ko'radi; takror — yo'q =====
select pg_temp.login('86000000-0000-0000-0000-000000000003');
select public.send_offer((select id from second), null, 'Oshxonaga ishchi', 'Ertaga keling');
select pg_temp.superuser();
select pg_temp.ok((select o.worker_id = w.id from public.job_offers o join public.worker_profiles w on w.profile_id = '86000000-0000-0000-0000-000000000001' and w.is_primary
                   where o.employer_profile_id = '86000000-0000-0000-0000-000000000003'), 'taklif asosiy qatorga yozildi');
select pg_temp.login('86000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.job_offers) = 1, 'ishchi taklifni ko''radi');

-- ===== 7. Ikkinchi asosiy qator bo'lmaydi; 100 ta chegara =====
select pg_temp.superuser();
select pg_temp.fails($$insert into public.worker_profiles (profile_id) values ('86000000-0000-0000-0000-000000000001')$$, 'bir kishida ikkinchi asosiy qator yo''q', '23505');
insert into public.worker_profiles (profile_id, is_public, is_primary)
select '86000000-0000-0000-0000-000000000001', false, false from generate_series(1, 97);
select pg_temp.login('86000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = auth.uid()) = 100, '100 ta e''lon');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || jsonb_build_object('profession_node_id', node_a, 'region_id', region2, 'new_listing', true) from wl, fx))$$, '101-e''lon — too_many_listings', 'too_many_listings');

-- ===== 8. Hisob o'chsa — barcha e'lonlari o'chadi =====
select pg_temp.superuser();
delete from auth.users where id = '86000000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = '86000000-0000-0000-0000-000000000001') = 0, 'hisob o''chsa — barcha e''lonlar o''chadi');

rollback;
\echo '✓ multi_worker_listings'
