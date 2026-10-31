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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'listings_paid');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('72000000-0000-0000-0000-000000000001', '+998907200001', now(), '{"first_name":"Ish beruvchi"}'),
  ('72000000-0000-0000-0000-000000000002', '+998907200002', now(), '{"first_name":"Boshqa"}'),
  ('72000000-0000-0000-0000-000000000003', '+998907200003', now(), '{"first_name":"Moderator"}'),
  ('72000000-0000-0000-0000-000000000004', '+998907200004', now(), '{"first_name":"Tahlilchi"}'),
  ('72000000-0000-0000-0000-000000000005', '+998907200005', now(), '{"first_name":"Admin"}');
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values
  ('72000000-0000-0000-0000-000000000001', 'person', 'D72 bir', now()),
  ('72000000-0000-0000-0000-000000000002', 'person', 'D72 ikki', now())
on conflict (profile_id) do nothing;
insert into public.admin_users (profile_id, role) values
  ('72000000-0000-0000-0000-000000000003', 'moderator'),
  ('72000000-0000-0000-0000-000000000004', 'analyst'),
  ('72000000-0000-0000-0000-000000000005', 'admin');

create temp table ref on commit drop as
select (select id from public.categories where slug = 'sales') as cat,
       (select id from public.regions where slug = 'tashkent_city') as reg,
       (select id from public.regions where slug = 'samarkand') as reg2;
grant select on ref to authenticated;

-- ---------- 1. takroriy vakansiya ----------
-- trigger ish beruvchining o'z amalida ishlaydi (to'g'ridan-to'g'ri yozuv ham, RPC ham); admin/cron — yo'q
create temp table o1 on commit drop as select '72000000-0000-0000-0000-000000000001'::uuid as id;
grant select on o1 to authenticated;
select pg_temp.as_owner('72000000-0000-0000-0000-000000000001');
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, published_at, expires_at)
select o1.id, 'Kassir', cat, reg, 'Birinchi kassir e''loni, ish vaqti 9 dan 18 gacha', 'active', now(), now() + interval '7 days' from ref, o1;

select pg_temp.fails($$insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, published_at, expires_at)
  select o1.id, '  KASSIR! ', cat, reg, 'Ikkinchi kassir e''loni, xuddi shu joyda', 'active', now(), now() + interval '7 days' from ref, o1$$,
  'bir xil nom (katta-kichik harf, belgilar farqi) + bir xil joy → duplicate_vacancy', 'duplicate_vacancy');

-- ish beruvchi qoralama yaratadi (RLS: faqat draft) va RPC orqali chiqarishga urinadi
select pg_temp.login('72000000-0000-0000-0000-000000000001');
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, employment_type, schedule)
select auth.uid(), 'Kassir', cat, reg, 'Qoralama — saqlash cheklanmaydi, faqat chiqarish. Ish vaqti 9-18', 'draft', 'full_time', '5_2' from ref;
select pg_temp.ok((select count(*) from public.vacancies where owner_profile_id = auth.uid() and status = 'draft') = 1, 'qoralama saqlanadi');
select pg_temp.ok((select public.my_duplicate_vacancy(id) is not null from public.vacancies where owner_profile_id = auth.uid() and status = 'draft'),
  'oldindan tekshiruv: qoralama uchun takror topiladi (mavjud e''lon slug''i)');
select pg_temp.fails($$select public.publish_vacancy((select id from public.vacancies where owner_profile_id = auth.uid() and status = 'draft'))$$,
  'qoralamani chiqarish (publish_vacancy) → duplicate_vacancy', 'duplicate_vacancy');
select pg_temp.superuser();

insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, published_at, expires_at)
select o1.id, 'Kassir', cat, reg2, 'Boshqa viloyatdagi kassir e''loni — takror emas', 'active', now(), now() + interval '7 days' from ref, o1;
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, published_at, expires_at)
select o1.id, 'Katta kassir', cat, reg, 'Boshqa lavozim nomi — takror emas, ish vaqti 9-18', 'active', now(), now() + interval '7 days' from ref, o1;
select pg_temp.ok((select count(*) from public.vacancies v, o1 where v.owner_profile_id = o1.id and v.status = 'active') = 3, 'boshqa hudud va boshqa nom — chiqadi');

-- birinchisi yopilsa — qoralamani chiqarish mumkin
update public.vacancies v set status = 'closed' from ref, o1 where v.owner_profile_id = o1.id and v.title = 'Kassir' and v.region_id = ref.reg and v.status = 'active';
select pg_temp.login('72000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.my_duplicate_vacancy(id) is null from public.vacancies where owner_profile_id = auth.uid() and status = 'draft'),
  'birinchisi yopilgach takror yo''q');
select pg_temp.as_owner('72000000-0000-0000-0000-000000000001');
update public.vacancies v set status = 'active', published_at = now(), expires_at = now() + interval '7 days' from o1 where v.owner_profile_id = o1.id and v.status = 'draft';
select pg_temp.ok((select count(*) from public.vacancies v, o1 where v.owner_profile_id = o1.id and v.status = 'active' and v.title = 'Kassir') = 2, 'yopilgandan keyin yangi e''lon chiqadi');

-- pauza → faol (qayta ochish) takror tekshiruviga tushmaydi
update public.vacancies v set status = 'paused' from o1 where v.owner_profile_id = o1.id and v.title = 'Katta kassir';
update public.vacancies v set status = 'active' from o1 where v.owner_profile_id = o1.id and v.title = 'Katta kassir';
select pg_temp.ok((select v.status = 'active' from public.vacancies v, o1 where v.owner_profile_id = o1.id and v.title = 'Katta kassir'), 'pauzadan qaytarish — erkin');

-- boshqa ish beruvchi xuddi shu nom va joy bilan — erkin
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, published_at, expires_at)
select '72000000-0000-0000-0000-000000000002', 'Kassir', cat, reg, 'Boshqa ish beruvchining kassir e''loni', 'active', now(), now() + interval '7 days' from ref;
select pg_temp.ok((select count(*) from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002') = 1, 'boshqa ish beruvchi — takror emas');
select pg_temp.login('72000000-0000-0000-0000-000000000002');
select pg_temp.ok((select public.my_duplicate_vacancy(v.id) from public.vacancies v, o1 where v.owner_profile_id = o1.id limit 1) is null,
  'begona vakansiyani tekshira olmaydi (null)');

-- ---------- 2. TOP vakansiya ----------
select pg_temp.fails($$select public.admin_set_vacancy_featured((select id from public.vacancies where owner_profile_id = auth.uid() limit 1), 7)$$,
  'oddiy foydalanuvchi TOP qila olmaydi', 'forbidden');
select pg_temp.fails($$update public.vacancies set is_featured = true where owner_profile_id = auth.uid()$$, 'ish beruvchi o''zi TOP qila olmaydi (RLS)');
select pg_temp.superuser();
select pg_temp.ok((select not is_featured from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 'is_featured o''zgarmadi');

select pg_temp.login('72000000-0000-0000-0000-000000000004');
select pg_temp.fails($$select public.admin_set_vacancy_featured((select id from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 7)$$,
  'tahlilchi (vacancies.moderate yo''q) — forbidden', 'forbidden');

select pg_temp.login('72000000-0000-0000-0000-000000000003');
select public.admin_set_vacancy_featured((select id from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 7);
select pg_temp.fails($$select public.admin_set_vacancy_featured((select id from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 5)$$,
  'faqat 0/7/14/30 kun', 'invalid_days');
select pg_temp.superuser();
select pg_temp.ok((select is_featured and featured_until between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
  from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 'moderator: 7 kunga TOP');
select pg_temp.ok((select count(*) = 1 from public.audit_logs where action = 'vacancy.featured' and actor_id = '72000000-0000-0000-0000-000000000003'), 'audit: vacancy.featured');
select pg_temp.ok(
  (select s.id from public.search_vacancies_v2(p_region_id => (select reg from ref), p_sort => 'newest', p_limit => 1) s)
    = (select id from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'),
  'qidiruvda TOP birinchi (hatto "eng yangi" saralashda ham)');

select pg_temp.login('72000000-0000-0000-0000-000000000003');
select public.admin_set_vacancy_featured((select id from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 0);
select pg_temp.superuser();
select pg_temp.ok((select not is_featured and featured_until is null from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 'TOPdan olindi');
update public.vacancies set status = 'paused' where owner_profile_id = '72000000-0000-0000-0000-000000000002';
select pg_temp.login('72000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.admin_set_vacancy_featured((select id from public.vacancies where owner_profile_id = '72000000-0000-0000-0000-000000000002'), 7)$$,
  'faol bo''lmagan vakansiya TOP bo''lmaydi', 'vacancy_not_active');

-- ---------- 3. admin_log prefikslari ----------
-- moderator: employers.verify yo'q, analytics.view bor; admin: employers.verify bor; tahlilchi: faqat analytics.view
select pg_temp.fails($$select public.admin_log('verification.document_view', 'document', 'x/y.pdf')$$, 'moderator — employers.verify yo''q → forbidden', 'forbidden');
select public.admin_log('analytics.export', 'analytics', 'summary');
select public.admin_log('account.login_credentials_set', 'admin_user', auth.uid()::text);
select pg_temp.login('72000000-0000-0000-0000-000000000005');
select public.admin_log('verification.document_view', 'document', 'x/y.pdf');
select public.admin_log('profession.update_meta', 'profession_node', 'n1');
select pg_temp.login('72000000-0000-0000-0000-000000000004');
select pg_temp.fails($$select public.admin_log('verification.document_view', 'document', 'x')$$, 'tahlilchi — employers.verify yo''q → forbidden', 'forbidden');
select pg_temp.fails($$select public.admin_log('profession.update_meta', 'profession_node', 'n1')$$, 'tahlilchi — categories.manage yo''q → forbidden', 'forbidden');
select pg_temp.login('72000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.admin_log('account.login_credentials_set', 'admin_user', 'x')$$, 'admin bo''lmagan — forbidden', 'forbidden');
select pg_temp.superuser();
select pg_temp.ok((select count(*) = 4 from public.audit_logs where action in ('verification.document_view', 'account.login_credentials_set', 'analytics.export', 'profession.update_meta')
  and actor_id::text like '72000000-%'), 'audit: hujjat ko''rish, o''z hisobi (moderator), eksport, kasb (oddiy admin) yozildi');

rollback;
\echo ✓ duplicates_featured
