-- 0057 · sodda formalarda "Kasbim topilmadi": asl nom + soha saqlanadi, navbatga tushadi, soxta tugun yo'q, moderatsiya qamraydi
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2', 'iat', extract(epoch from now())::bigint + 5)::text, false);
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid');

create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by depth limit 1) as node,
  (select id from public.categories where is_active order by sort_order limit 1) as category,
  (select id from public.categories where is_active order by sort_order desc limit 1) as category2,
  (select id from public.regions where slug = 'tashkent_city') as region,
  (select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' order by d.sort_order limit 1) as district;
grant select on fx to authenticated;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('5c000000-0000-0000-0000-000000000001', '+998907100001', now(), '{"first_name":"Ali"}'),
  ('5c000000-0000-0000-0000-000000000002', '+998907100002', now(), '{"first_name":"Kafe"}');
insert into public.profile_contacts (profile_id, phone, phone_verified_at) values
  ('5c000000-0000-0000-0000-000000000001', '+998907100001', now()),
  ('5c000000-0000-0000-0000-000000000002', '+998907100002', now())
on conflict (profile_id) do update set phone = excluded.phone;

create temp table wl on commit drop as
select jsonb_build_object('region_id', region, 'district_id', district, 'first_name', 'Ali', 'last_name', '', 'about', 'Avtomaktabda 6 yil amaliy mashg''ulot o''tganman',
  'experience_level', '3_5y', 'show_phone', false, 'remote', false, 'custom_profession', '  Prava   o''qituvchisi ', 'category_id', category) as p from fx;
grant select on wl to authenticated;

-- ===== Ishchi =====
select pg_temp.login('5c000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select public.save_simple_worker_listing((select p - 'category_id' from wl))$$, 'custom kasb sohasiz — rad', 'invalid_category');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || '{"custom_profession":"x"}'::jsonb from wl))$$, 'juda qisqa custom nom — rad', 'invalid_custom_profession');
select pg_temp.fails($$select public.save_simple_worker_listing((select p || jsonb_build_object('category_id', gen_random_uuid()) from wl))$$, 'mavjud bo''lmagan soha — rad', 'invalid_category');
select pg_temp.fails($$select public.save_simple_worker_listing((select p - 'custom_profession' - 'category_id' from wl))$$, 'kasb ham custom ham yo''q — rad', 'invalid_profession');
select pg_temp.ok((select public.save_simple_worker_listing((select p from wl)) ? 'worker_id'), 'custom kasb bilan ishchi e''loni saqlandi');
select pg_temp.ok((select profession_node_id is null and custom_profession = 'Prava o''qituvchisi' and category_id = (select category from fx) and subcategory_id is null
                          and headline = 'Prava o''qituvchisi'
                   from public.worker_profiles where profile_id = auth.uid()), 'tugun yo''q, asl nom (bo''shliqlar tozalangan), soha va sarlavha saqlandi');
select pg_temp.ok((select count(*) = 1 from public.custom_occupation_requests where created_by = auth.uid() and context = 'worker' and raw_text = 'Prava o''qituvchisi' and status = 'pending'),
                  'katalogni boyitish navbatiga tushdi');
-- qayta saqlash dublikat so'rov yaratmaydi
select public.save_simple_worker_listing((select p || '{"about":"Avtomaktabda 7 yil amaliy mashg''ulot o''tganman"}'::jsonb from wl));
select pg_temp.ok((select count(*) = 1 from public.custom_occupation_requests where created_by = auth.uid() and context = 'worker'), 'takroriy saqlash — dublikat yo''q');
-- katalogdagi kasbga o'tilsa custom nom tozalanadi, soha tugundan olinadi
select public.save_simple_worker_listing((select p - 'custom_profession' - 'category_id' || jsonb_build_object('profession_node_id', (select node from fx)) from wl));
select pg_temp.ok((select profession_node_id = (select node from fx) and custom_profession is null
                          and category_id = (select category_id from public.profession_nodes where id = (select node from fx))
                   from public.worker_profiles where profile_id = auth.uid()), 'katalog kasbiga qaytish: custom tozalandi, soha tugundan');
-- tugun berilsa custom e'tiborsiz (soxta aralash holat yo'q)
select public.save_simple_worker_listing((select p || jsonb_build_object('profession_node_id', (select node from fx)) from wl));
select pg_temp.ok((select profession_node_id = (select node from fx) and custom_profession is null from public.worker_profiles where profile_id = auth.uid()), 'tugun ustun — custom yozilmaydi');

-- batafsil profildagi "any" (masofaviy ham, joyida ham) ilova yuborgan aniq qiymat bilan saqlanadi
select public.save_simple_worker_listing((select p || '{"remote":true,"remote_preference":"any"}'::jsonb from wl));
select pg_temp.ok((select remote_preference = 'any' from public.worker_profiles where profile_id = auth.uid()), 'remote_preference=any saqlanadi');
select public.save_simple_worker_listing((select p || '{"remote":false}'::jsonb from wl));
select pg_temp.ok((select remote_preference = 'no' from public.worker_profiles where profile_id = auth.uid()), 'aniq qiymat berilmasa — eski xatti-harakat (no)');

-- moderatsiya: custom nom snapshot'da (tekshiriladi)
select public.save_simple_worker_listing((select p from wl));
select pg_temp.superuser();
select pg_temp.ok((select public.moderation_snapshot('worker', w.id) -> 'fields' ->> 'profession' = 'Prava o''qituvchisi' from public.worker_profiles w where profile_id = '5c000000-0000-0000-0000-000000000001'),
                  'moderatsiya snapshot''ida custom nom bor');

-- ===== Ish beruvchi =====
create temp table vl on commit drop as
select jsonb_build_object('client_ref', gen_random_uuid(), 'region_id', region, 'district_id', district, 'employer_type', 'person', 'org_name', 'Kafe Sharq',
  'contact_phone', '+998907100002', 'description', 'Kechki smenaga tandirchi kerak, tajriba shart emas', 'salary_negotiable', true, 'show_phone', true,
  'custom_profession', 'Tandirchi', 'category_id', category2) as p from fx;
grant select on vl to authenticated;

select pg_temp.login('5c000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.save_simple_vacancy((select p - 'category_id' from vl))$$, 'vakansiya: sohasiz custom — rad', 'invalid_category');
create temp table vres on commit drop as select public.save_simple_vacancy((select p from vl)) as r;
grant select on vres to authenticated;
select pg_temp.ok((select v.profession_node_id is null and v.custom_profession = 'Tandirchi' and v.title = 'Tandirchi' and v.category_id = (select category2 from fx)
                   from public.vacancies v where v.id = ((select r from vres) ->> 'vacancy_id')::uuid), 'vakansiya: custom nom, sarlavha va soha saqlandi');
select pg_temp.ok((select count(*) = 1 from public.custom_occupation_requests where created_by = auth.uid() and context = 'vacancy' and raw_text = 'Tandirchi'), 'vakansiya so''rovi navbatda');
-- takroriy bosish (o'sha client_ref) — ikkinchi e'lon ham, ikkinchi so'rov ham yo'q
select public.save_simple_vacancy((select p from vl));
select pg_temp.ok((select count(*) = 1 from public.vacancies where owner_profile_id = auth.uid()) and (select count(*) = 1 from public.custom_occupation_requests where created_by = auth.uid()),
                  'takroriy bosish: bitta e''lon, bitta so''rov');
-- tahrirlash: custom → katalog kasbi
select public.save_simple_vacancy((select p - 'custom_profession' - 'category_id' || jsonb_build_object('vacancy_id', (select r from vres) ->> 'vacancy_id', 'profession_node_id', (select node from fx), 'title', '') from vl));
select pg_temp.ok((select v.profession_node_id = (select node from fx) and v.custom_profession is null from public.vacancies v where v.id = ((select r from vres) ->> 'vacancy_id')::uuid),
                  'tahrir: katalog kasbiga o''tdi, custom tozalandi');

select pg_temp.ok((select public.simple_listing_features() ->> 'custom_profession') = 'true', 'imkoniyat bayrog''i');
select pg_temp.superuser();
rollback;
\echo '✓ custom kasb testlari o''tdi'
