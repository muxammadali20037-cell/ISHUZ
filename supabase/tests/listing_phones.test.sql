-- 0081 · Ishchi e'lonidagi telefon: oynada qo'lda yoziladi (hisob raqamidan boshqa bo'lishi mumkin), ixtiyoriy ikkinchi raqam.
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'listings_paid');

create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by (name_uz = 'Buxgalter') desc, depth limit 1) as node,
  (select id from public.regions where slug = 'tashkent_city') as region;
grant select on fx to anon, authenticated, service_role;

-- W: hisob raqami bor ishchi · T: Telegram orqali kirgan, hisobida raqam yo'q · E: ko'ruvchi (ish beruvchi)
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('81000000-0000-0000-0000-000000000001', '+998908100001', now(), '{"first_name":"Ali","last_name":"V"}'),
  ('81000000-0000-0000-0000-000000000003', '+998908100003', now(), '{"first_name":"Kafe","last_name":""}');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('81000000-0000-0000-0000-000000000002', 'tg-8102@telegram.local', now(), '{"first_name":"Tel","last_name":"Yoq"}');

create temp table wl on commit drop as
select jsonb_build_object(
  'profession_node_id', node, 'region_id', region, 'district_id', null, 'first_name', 'Ali', 'last_name', 'V',
  'about', 'Buxgalteriyada 5 yil ishladim, 1C bilaman', 'experience_level', '3_5y', 'salary_expected', null,
  'schedule', null, 'show_phone', true, 'remote', false) as p
from fx;
grant select on wl to anon, authenticated, service_role;

-- ===== 1. Raqam tekshiruvi =====
select pg_temp.login('81000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || '{"listing_phone":"+99890123"}'::jsonb from wl))$$, 'noto''g''ri raqam rad etiladi', 'invalid_phone');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || '{"listing_phone":"+998901112233","listing_phone2":"12345"}'::jsonb from wl))$$, 'noto''g''ri ikkinchi raqam rad etiladi', 'invalid_phone');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || '{"listing_phone2":"+998901112233"}'::jsonb from wl))$$, 'asosiy raqamsiz ikkinchi raqam rad etiladi', 'invalid_phone');

-- ===== 2. Qo'lda yozilgan raqam e'londa, hisob raqami esa o'zgarmaydi =====
select pg_temp.superuser();
update public.profile_contacts set phone_visibility = 'applicants' where profile_id = '81000000-0000-0000-0000-000000000001';
select pg_temp.login('81000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.save_simple_worker_listing((select p || '{"listing_phone":"+998901112233","listing_phone2":"+998935554433"}'::jsonb from wl)) ->> 'state') = 'listed', 'e''lon ikki raqam bilan joylandi');
select pg_temp.ok((select phone = '+998908100001' and phone_visibility = 'applicants' from public.profile_contacts where profile_id = auth.uid()), 'hisob raqami va uning ko''rinish sozlamasi o''zgarmadi');
select pg_temp.ok((select phone = '+998901112233' and phone2 = '+998935554433' from public.worker_listing_phones where worker_id = public.current_worker_id()), 'egasi o''z e''lon raqamlarini o''qiydi');
select pg_temp.ok((select phone = '+998901112233' and phone2 = '+998935554433' from public.simple_worker_listing(public.current_worker_id())), 'egasi o''z e''lonida ikkala raqamni ko''radi');

select pg_temp.superuser();
create temp table wid on commit drop as select id from public.worker_profiles where profile_id = '81000000-0000-0000-0000-000000000001';
grant select on wid to anon, authenticated;

select pg_temp.anon();
select pg_temp.ok((select phone is null and phone2 is null from public.simple_worker_listing((select id from wid))), 'mehmon raqamlarni ko''rmaydi');
select pg_temp.fails($$select * from public.worker_listing_phones$$, 'mehmon jadvalni o''qiy olmaydi', '42501');
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx)) where phone is not null) = 0, 'ro''yxatda telefon yo''q (0074)');

select pg_temp.login('81000000-0000-0000-0000-000000000003');
select pg_temp.ok((select phone = '+998901112233' and phone2 = '+998935554433' from public.simple_worker_listing((select id from wid))), 'kirgan foydalanuvchi e''londa qo''lda yozilgan ikkala raqamni ko''radi (hisob raqamini emas)');
select pg_temp.ok((select count(*) from public.worker_listing_phones) = 0, 'boshqa foydalanuvchi jadvaldan begona raqamni o''qimaydi');
update public.worker_listing_phones set phone = '+998900000000';
select pg_temp.fails($$insert into public.worker_listing_phones (worker_id, phone) values ((select id from wid), '+998900000000')$$, 'begona e''longa raqam yozib bo''lmaydi', '42501');
select pg_temp.superuser();
select pg_temp.ok((select phone = '+998901112233' from public.worker_listing_phones where worker_id = (select id from wid)), 'begona foydalanuvchi raqamni o''zgartira olmadi');

-- ===== 3. Qayta saqlash: ikkinchi raqam olib tashlanadi; bir xil ikkinchi raqam saqlanmaydi =====
select pg_temp.login('81000000-0000-0000-0000-000000000001');
select public.save_simple_worker_listing((select p || '{"listing_phone":"+998901112244"}'::jsonb from wl));
select pg_temp.ok((select phone = '+998901112244' and phone2 is null from public.worker_listing_phones where worker_id = public.current_worker_id()), 'tahrir: yangi raqam, ikkinchisi olib tashlandi');
select public.save_simple_worker_listing((select p || '{"listing_phone":"+998901112244","listing_phone2":"+998901112244"}'::jsonb from wl));
select pg_temp.ok((select phone2 is null from public.worker_listing_phones where worker_id = public.current_worker_id()), 'bir xil ikkinchi raqam saqlanmaydi');

-- ===== 4. To'liq forma (raqamsiz) — e'lon yana hisob raqami va rozilik qoidasiga qaytadi =====
select public.save_simple_worker_listing((select p from wl));
select pg_temp.ok((select count(*) from public.worker_listing_phones where worker_id = public.current_worker_id()) = 0, 'raqamsiz saqlandi — e''lon raqamlari olib tashlandi');
select pg_temp.ok((select phone_visibility = 'everyone' from public.profile_contacts where profile_id = auth.uid()), 'rozilik bilan — hisob raqami hammaga (avvalgidek)');
select pg_temp.login('81000000-0000-0000-0000-000000000003');
select pg_temp.ok((select phone = '+998908100001' and phone2 is null from public.simple_worker_listing((select id from wid))), 'e''londa hisob raqami (avvalgidek)');

-- ===== 5. Hisobida raqami yo'q (Telegram) — qo'lda yozilgan raqam bilan joylay oladi =====
select pg_temp.login('81000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || '{"first_name":"Tel"}'::jsonb from wl))$$, 'raqamsiz va hisobda raqam yo''q — phone_required', 'phone_required');
select pg_temp.ok((select public.save_simple_worker_listing((select p || '{"first_name":"Tel","listing_phone":"+998977776655"}'::jsonb from wl)) ->> 'state') = 'listed', 'qo''lda yozilgan raqam bilan joylandi');
select pg_temp.ok((select phone is null from public.profile_contacts where profile_id = auth.uid()), 'hisobga raqam yozilmadi');
select pg_temp.superuser();
create temp table tid on commit drop as select id from public.worker_profiles where profile_id = '81000000-0000-0000-0000-000000000002';
grant select on tid to anon, authenticated;
select pg_temp.login('81000000-0000-0000-0000-000000000003');
select pg_temp.ok((select phone = '+998977776655' from public.simple_worker_listing((select id from tid))), 'ko''ruvchi e''londagi raqamni ko''radi');

-- ===== 6. Hisob o'chsa — raqamlar ham o'chadi =====
select pg_temp.superuser();
delete from public.worker_profiles where profile_id = '81000000-0000-0000-0000-000000000002';
select pg_temp.ok((select count(*) from public.worker_listing_phones where worker_id = (select id from tid)) = 0, 'e''lon o''chsa raqamlar ham o''chadi (cascade)');

rollback;
\echo '✓ listing_phones'
