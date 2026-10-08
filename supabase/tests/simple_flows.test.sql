-- ISH.UZ · sodda jarayonlar (0047): e'lon berish RPC'lari, rozilik bo'yicha telefon, takroriy bosish, tuman↔viloyat, mehmon qidiruvi
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
create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  execute 'set role service_role';
end $$;
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
update public.app_settings set value = 'true'::jsonb where key = 'listings_paid';
update public.app_settings set value = 'false'::jsonb where key = 'listing_free_trial';
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';

-- ma'lumotnomadan: tanlanadigan kasb, Toshkent shahri tumani va boshqa viloyat tumani
create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by (name_uz = 'Buxgalter') desc, depth limit 1) as node,
  (select id from public.regions where slug = 'tashkent_city') as region,
  (select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' order by d.sort_order limit 1) as district,
  (select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug <> 'tashkent_city' order by d.sort_order limit 1) as other_district;
grant select on fx to anon, authenticated, service_role;
select pg_temp.ok((select node is not null and region is not null and district is not null and other_district is not null from fx), 'ma''lumotnoma tayyor');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('5f000000-0000-0000-0000-000000000001', '+998907000001', now(), '{"first_name":"Ali","last_name":""}'),
  ('5f000000-0000-0000-0000-000000000002', '+998907000002', now(), '{"first_name":"Kafe","last_name":""}');
-- Telegram orqali kirgan, telefoni yo'q foydalanuvchi
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('5f000000-0000-0000-0000-000000000003', 'tg-5f03@telegram.local', now(), '{"first_name":"Tel","last_name":"Yoq"}');

create temp table wl_args on commit drop as
select jsonb_build_object(
  'profession_node_id', node, 'region_id', region, 'district_id', district, 'first_name', 'Ali', 'last_name', '',
  'about', 'Buxgalteriyada 5 yil ishladim, 1C bilaman', 'experience_level', '3_5y', 'salary_expected', 6000000,
  'schedule', '5_2', 'show_phone', true, 'remote', false) as p
from fx;
grant select on wl_args to anon, authenticated, service_role;

-- ===== Ishchi e'loni =====
select pg_temp.anon();
select pg_temp.fails($$select public.save_simple_worker_listing((select p from wl_args))$$, 'mehmon e''lon saqlay olmaydi', '42501');

select pg_temp.login('5f000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.save_simple_worker_listing((select p from wl_args))$$, 'telefonsiz hisob — phone_required', 'phone_required');

select pg_temp.superuser();
insert into public.profile_contacts (profile_id, phone, phone_verified_at) values ('5f000000-0000-0000-0000-000000000001', '+998907000001', now())
on conflict (profile_id) do update set phone = excluded.phone, phone_verified_at = excluded.phone_verified_at;
insert into public.profile_contacts (profile_id, phone, phone_verified_at) values ('5f000000-0000-0000-0000-000000000002', '+998907000002', now())
on conflict (profile_id) do update set phone = excluded.phone, phone_verified_at = excluded.phone_verified_at;

select pg_temp.login('5f000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || jsonb_build_object('district_id', (select other_district from fx)) from wl_args))$$, 'boshqa viloyat tumani rad etiladi', 'district_region_mismatch');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || '{"about":"qisqa"}'::jsonb from wl_args))$$, 'juda qisqa ma''lumot rad etiladi', 'invalid_about');
select pg_temp.ok((select public.save_simple_worker_listing((select p from wl_args)) ->> 'state') = 'payment_required', 'pullik rejim: saqlandi, lekin "joylandi" emas (payment_required)');
select pg_temp.ok((select not is_public and listed_until is null and onboarding_completed_at is not null and experience_level = '3_5y' from public.worker_profiles where profile_id = auth.uid()), 'profil saqlandi, qidiruvda emas');
select pg_temp.ok((select phone_visibility = 'everyone' from public.profile_contacts where profile_id = auth.uid()), 'rozilik → telefon hammaga');
select pg_temp.ok((select first_name = 'Ali' from public.profiles where id = auth.uid()), 'ism saqlandi (familiyasiz ham)');
-- qayta saqlash (tahrir) ham to'lovsiz qidiruvga chiqarmaydi va ma'lumotni yo'qotmaydi
select pg_temp.ok((select public.save_simple_worker_listing((select p || '{"about":"Buxgalter, 1C va soliq hisobotlari"}'::jsonb from wl_args)) ->> 'state') = 'payment_required', 'tahrir: holat to''g''ri qoladi');
select pg_temp.ok((select about = 'Buxgalter, 1C va soliq hisobotlari' from public.worker_profiles where profile_id = auth.uid()), 'tahrir saqlandi (trigger xatosi butun tranzaksiyani bekor qilmadi)');

select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx))) = 0, 'to''lovsiz e''lon qidiruvda ko''rinmaydi');

-- to'lov → qidiruvda
select pg_temp.login('5f000000-0000-0000-0000-000000000001');
select public.create_payment('worker_listing', public.current_worker_id());
select pg_temp.superuser();
update public.payments set status = 'paid', paid_at = now() where profile_id = '5f000000-0000-0000-0000-000000000001' and purpose = 'worker_listing';
select pg_temp.service();
select public.apply_payment_internal((select id from public.payments where profile_id = '5f000000-0000-0000-0000-000000000001' and purpose = 'worker_listing'));
select pg_temp.superuser();
create temp table wid on commit drop as select id from public.worker_profiles where profile_id = '5f000000-0000-0000-0000-000000000001';
grant select on wid to anon, authenticated;

select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx), (select district from fx)) where first_name = 'Ali' and phone = '+998907000001') = 1, 'mehmon: kasb + hudud + tuman bo''yicha topadi, rozilik bilan telefon ko''rinadi');
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx), (select other_district from fx)) where first_name = 'Ali') = 0, 'boshqa tumanda chiqmaydi');
select pg_temp.ok((select count(*) from public.simple_worker_listing((select id from wid)) where phone = '+998907000001') = 1, 'e''lon sahifasi: mehmonga ochiq, telefon bilan');

-- rozilik olib tashlansa — telefon yashirinadi
select pg_temp.login('5f000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.save_simple_worker_listing((select p || '{"show_phone":false}'::jsonb from wl_args)) ->> 'state') = 'listed', 'to''langan e''lon tahrirdan keyin ham qidiruvda');
select pg_temp.ok((select phone_visibility = 'applicants' from public.profile_contacts where profile_id = auth.uid()), 'rozilik olindi → faqat ariza yuborganlarga');
select pg_temp.anon();
select pg_temp.ok((select phone is null from public.simple_search_workers((select node from fx), (select region from fx)) where first_name = 'Ali'), 'mehmon endi telefonni ko''rmaydi');

-- "Ish topdim" → qidiruvdan chiqadi
select pg_temp.login('5f000000-0000-0000-0000-000000000001');
update public.worker_profiles set status = 'not_looking', is_public = false where profile_id = auth.uid();
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx)) where first_name = 'Ali') = 0, '"Ish topdim" dan keyin qidiruvda yo''q');
select pg_temp.ok((select count(*) from public.simple_worker_listing((select id from wid))) = 0, 'e''lon sahifasi ham yopiq');

-- ===== Ish beruvchi e'loni =====
create temp table vac_args on commit drop as
select jsonb_build_object(
  'client_ref', '7a000000-0000-4000-8000-000000000001', 'profession_node_id', node, 'region_id', region, 'district_id', district,
  'employer_type', 'person', 'org_name', 'Kafe egasi', 'contact_phone', '+998901112233', 'show_phone', true,
  'description', 'Kafega buxgalter kerak, ish 9:00 dan 18:00 gacha', 'salary_negotiable', false, 'salary_from', 4000000, 'salary_to', 6000000,
  'schedule', '5_2', 'experience_min_months', 12) as p
from fx;
grant select on vac_args to anon, authenticated, service_role;

select pg_temp.login('5f000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.save_simple_vacancy((select p || '{"salary_from":null,"salary_to":null}'::jsonb from vac_args))$$, 'maosh yoki "kelishiladi" shart', 'salary_required');
select pg_temp.fails($$select public.save_simple_vacancy((select p || '{"contact_phone":"12345"}'::jsonb from vac_args))$$, 'noto''g''ri telefon rad etiladi', 'invalid_phone');
select pg_temp.fails($$select public.save_simple_vacancy((select p || jsonb_build_object('district_id', (select other_district from fx)) from vac_args))$$, 'vakansiya: boshqa viloyat tumani rad etiladi', 'district_region_mismatch');
select pg_temp.ok((select public.save_simple_vacancy((select p from vac_args)) ->> 'state') = 'payment_required', 'pullik rejim: vakansiya saqlandi, to''lov kerak');
select pg_temp.ok((select public.save_simple_vacancy((select p from vac_args)) ->> 'state') = 'payment_required', 'ikkinchi bosish ham xatosiz');
select pg_temp.ok((select count(*) from public.vacancies where owner_profile_id = auth.uid()) = 1, 'takroriy bosish ikkinchi e''lon yaratmadi (client_ref)');
select pg_temp.ok((select employer_type = 'person' and company_id is null and onboarding_completed_at is not null from public.employer_profiles where profile_id = auth.uid()), 'jismoniy shaxs: rekvizitsiz, kompaniyasiz');
select pg_temp.ok((select status = 'draft' and schedule = '5_2' and experience_min_months = 12 and salary_from = 4000000 from public.vacancies where owner_profile_id = auth.uid()), 'vakansiya maydonlari saqlandi');
select pg_temp.ok((select show_phone and phone = '+998901112233' from public.vacancy_contacts vc join public.vacancies v on v.id = vc.vacancy_id where v.owner_profile_id = auth.uid()), 'aloqa raqami va rozilik saqlandi');

-- bepul rejimda — darhol faol
select pg_temp.superuser();
update public.app_settings set value = 'false'::jsonb where key = 'listings_paid';
select pg_temp.login('5f000000-0000-0000-0000-000000000002');
select pg_temp.ok((select public.save_simple_vacancy((select p from vac_args)) ->> 'state') = 'active', 'bepul rejimda e''lon darhol joylandi');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_vacancies((select node from fx), (select region from fx), (select district from fx)) where employer_name = 'Kafe egasi' and phone = '+998901112233') = 1, 'mehmon vakansiyani rozilik bilan telefon bilan topadi');
select pg_temp.ok((select public.simple_vacancy_phone((select id from public.vacancies where client_ref = '7a000000-0000-4000-8000-000000000001'))) = '+998901112233', 'vakansiya sahifasi telefoni');
select pg_temp.ok((select count(*) from public.simple_search_vacancies((select node from fx), (select region from fx), (select other_district from fx)) where employer_name = 'Kafe egasi') = 0, 'boshqa tumanda chiqmaydi');
select pg_temp.fails($$select * from public.vacancy_contacts$$, 'mehmon vacancy_contacts jadvalini o''qiy olmaydi', '42501');

-- rozilik olinsa — telefon ko'rinmaydi (kompaniya telefoniga ham qaytmaydi)
select pg_temp.login('5f000000-0000-0000-0000-000000000002');
select public.save_simple_vacancy((select p || '{"show_phone":false}'::jsonb from vac_args));
select pg_temp.anon();
select pg_temp.ok((select phone is null from public.simple_search_vacancies((select node from fx), (select region from fx)) where employer_name = 'Kafe egasi'), 'rozilik yo''q — telefon yashirin');
select pg_temp.ok((select public.simple_vacancy_phone((select id from public.vacancies where client_ref = '7a000000-0000-4000-8000-000000000001')) is null), 'vakansiya sahifasida ham yashirin');

-- "Ishchi topdim" → yopiladi va qidiruvdan chiqadi
select pg_temp.login('5f000000-0000-0000-0000-000000000002');
select public.set_vacancy_status((select id from public.vacancies where owner_profile_id = auth.uid()), 'closed');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_vacancies((select node from fx), (select region from fx)) where employer_name = 'Kafe egasi') = 0, '"Ishchi topdim" dan keyin qidiruvda yo''q');

-- tashkilot: kompaniya yaratiladi, keyingi e'lon shu kompaniyaga bog'lanadi
select pg_temp.login('5f000000-0000-0000-0000-000000000002');
select pg_temp.ok((select public.save_simple_vacancy((select p || '{"employer_type":"company","org_name":"Baraka MChJ","client_ref":"7a000000-0000-4000-8000-000000000002"}'::jsonb from vac_args)) ->> 'state') = 'active', 'tashkilot e''loni joylandi');
select pg_temp.ok((select c.name = 'Baraka MChJ' from public.vacancies v join public.companies c on c.id = v.company_id where v.client_ref = '7a000000-0000-4000-8000-000000000002'), 'kompaniya yaratilib e''longa bog''landi');

-- tuman↔viloyat trigger (to'g'ridan-to'g'ri yozuvda ham)
select pg_temp.fails($$update public.vacancies set district_id = (select other_district from fx) where client_ref = '7a000000-0000-4000-8000-000000000002'$$, 'trigger: boshqa viloyat tumani saqlanmaydi', 'district_region_mismatch');

-- ===== Kasb rasmlari: faqat server =====
select pg_temp.login('5f000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.claim_profession_image((select node from fx), 'x', 'y')$$, 'foydalanuvchi rasm navbatini ola olmaydi', '42501');
select pg_temp.fails($$insert into public.profession_images (node_id, status) values ((select node from fx), 'ready')$$, 'foydalanuvchi rasm yozuvini qo''sha olmaydi', '42501');
select pg_temp.service();
select pg_temp.ok(public.claim_profession_image((select node from fx), 'prompt', 'model'), 'server navbat oladi');
select pg_temp.ok(not public.claim_profession_image((select node from fx), 'prompt', 'model'), 'bir vaqtda ikkinchi urinish yo''q');
select pg_temp.superuser();
update public.app_settings set value = '0'::jsonb where key = 'profession_images_daily_limit';
delete from public.profession_images where node_id = (select node from fx);
delete from public.rate_limits where key = 'profession_images:day';
select pg_temp.service();
select pg_temp.ok(not public.claim_profession_image((select node from fx), 'prompt', 'model'), 'kunlik limit 0 — generatsiya yo''q');

select pg_temp.superuser();
rollback;
\echo '✓ sodda jarayonlar testlari o''tdi'
