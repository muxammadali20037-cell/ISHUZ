-- ISH.UZ · pipeline: suhbat sanasi, ommaviy amallar, shaxsiy izohlar
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
  ('e5000000-0000-0000-0000-000000000001', '+998906000001', now(), '{"first_name":"HR","last_name":"Egasi"}'),
  ('e5000000-0000-0000-0000-000000000002', '+998906000002', now(), '{"first_name":"Ishchi","last_name":"Bir"}'),
  ('e5000000-0000-0000-0000-000000000003', '+998906000003', now(), '{"first_name":"Ishchi","last_name":"Ikki"}'),
  ('e5000000-0000-0000-0000-000000000004', '+998906000004', now(), '{"first_name":"Ishchi","last_name":"Uch"}'),
  ('e5000000-0000-0000-0000-000000000009', '+998906000009', now(), '{"first_name":"Begona","last_name":"HR"}');

-- ish beruvchi: kompaniya + faol vakansiya
select pg_temp.login('e5000000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'company');
insert into public.companies (name, created_by) values ('Pipeline MChJ', auth.uid());
insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, salary_from)
select auth.uid(), co.id, 'Sotuvchi', c.id, r.id, 5000000 from public.companies co, public.categories c, public.regions r
where co.name = 'Pipeline MChJ' and c.slug = 'sales' and r.slug = 'tashkent_city';
select public.publish_vacancy((select id from public.vacancies where title = 'Sotuvchi' and company_id = (select id from public.companies where name = 'Pipeline MChJ')));
create temp table pv as select id from public.vacancies where company_id = (select id from public.companies where name = 'Pipeline MChJ');
grant select on pv to public;

-- uch ishchi ariza beradi
do $$
declare u uuid;
begin
  foreach u in array array['e5000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-000000000003', 'e5000000-0000-0000-0000-000000000004']::uuid[] loop
    perform pg_temp.login(u);
    insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at)
    select u, 'Sotuvchi', c.id, r.id, '1_2y', now() from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';
    perform public.apply_to_vacancy((select id from pv), 'Salom');
  end loop;
end $$;
select pg_temp.superuser();
create temp table apps as select a.id, w.profile_id from public.applications a join public.worker_profiles w on w.id = a.worker_id where a.vacancy_id = (select id from pv);
grant select on apps to public;
select pg_temp.ok((select count(*) from apps) = 3, '3 ta ariza');

-- ommaviy: ikkitasini saralash, uchinchisini rad etish
select pg_temp.login('e5000000-0000-0000-0000-000000000001');
select pg_temp.ok(public.bulk_set_application_status(array(select id from apps where profile_id <> 'e5000000-0000-0000-0000-000000000004'), 'shortlisted') = 2, 'ommaviy saralash: 2 ta');
select pg_temp.ok(public.bulk_set_application_status(array(select id from apps where profile_id = 'e5000000-0000-0000-0000-000000000004'), 'rejected', 'Tajriba yetarli emas') = 1, 'ommaviy rad etish: 1 ta');
select pg_temp.ok(public.bulk_set_application_status(array(select id from apps), 'shortlisted') = 0, 'yopiq va allaqachon saralanganlar o''tkazib yuboriladi');
select pg_temp.fails($$select public.bulk_set_application_status(array(select id from apps), 'hired')$$, 'ommaviy ishga olish taqiqlangan', 'invalid_status');

-- begona ish beruvchi hech narsa qila olmaydi
select pg_temp.login('e5000000-0000-0000-0000-000000000009');
select pg_temp.ok(public.bulk_set_application_status(array(select id from apps), 'rejected') = 0, 'begona: ommaviy amal 0 ta');
select pg_temp.fails($$select public.schedule_interview((select id from apps where profile_id = 'e5000000-0000-0000-0000-000000000002'), now() + interval '1 day')$$, 'begona suhbat belgilay olmaydi', '42501');
select pg_temp.fails($$insert into public.application_notes (application_id, body) select id, 'x' from apps limit 1$$, 'begona izoh yoza olmaydi', '42501');

-- suhbat: vaqt va joy
select pg_temp.login('e5000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select public.schedule_interview((select id from apps where profile_id = 'e5000000-0000-0000-0000-000000000002'), now() - interval '2 days')$$, 'o''tgan vaqtga suhbat belgilab bo''lmaydi', 'invalid_interview_time');
select public.schedule_interview((select id from apps where profile_id = 'e5000000-0000-0000-0000-000000000002'), date_trunc('hour', now()) + interval '2 days', 'Chilonzor, 9-kvartal', 'Pasport olib keling');
select pg_temp.superuser();
select pg_temp.ok((select status = 'interview' and interview_place = 'Chilonzor, 9-kvartal' from public.applications where id = (select id from apps where profile_id = 'e5000000-0000-0000-0000-000000000002')), 'holat interview, joy saqlandi');
select pg_temp.ok((select payload ? 'interview_at' and payload->>'interview_place' = 'Chilonzor, 9-kvartal' from public.notifications where profile_id = 'e5000000-0000-0000-0000-000000000002' and type = 'interview_invite'), 'nomzodga vaqt va joy bilan bildirishnoma');
select pg_temp.login('e5000000-0000-0000-0000-000000000001');
select public.schedule_interview((select id from apps where profile_id = 'e5000000-0000-0000-0000-000000000002'), date_trunc('hour', now()) + interval '3 days', 'Onlayn');
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e5000000-0000-0000-0000-000000000002' and type = 'interview_invite') = 2, 'vaqt o''zgarganda yana xabar');
select pg_temp.ok((select payload->>'rescheduled' = 'true' from public.notifications where profile_id = 'e5000000-0000-0000-0000-000000000002' and type = 'interview_invite' order by id desc limit 1), 'rescheduled belgisi');

-- izohlar: faqat boshqaruvchilar
select pg_temp.login('e5000000-0000-0000-0000-000000000001');
insert into public.application_notes (application_id, body) select id, 'Juda xushmuomala' from apps where profile_id = 'e5000000-0000-0000-0000-000000000002';
select pg_temp.ok((select count(*) from public.application_notes) = 1, 'egasi izohni ko''radi');
select pg_temp.login('e5000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.application_notes) = 0, 'nomzod izohni ko''rmaydi');
select pg_temp.login('e5000000-0000-0000-0000-000000000009');
select pg_temp.ok((select count(*) from public.application_notes) = 0, 'begona izohni ko''rmaydi');
select pg_temp.ok((select count(*) from public.applications where interview_at is not null) = 0, 'begona arizani ko''rmaydi');

select pg_temp.superuser();
rollback;
\echo '✓ pipeline testlari o''tdi'
