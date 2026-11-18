-- 0084 · listing_phones_public: mehmonga faqat ochiq raqam; anon/authenticated chaqira olmaydi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('84000000-0000-0000-0000-000000000001', '+998908400001', now(), '{"first_name":"Ish beruvchi"}'),
  ('84000000-0000-0000-0000-000000000002', '+998908400002', now(), '{"first_name":"Ishchi"}'),
  ('84000000-0000-0000-0000-000000000003', '+998908400003', now(), '{"first_name":"Yashirin"}');

-- vakansiyalar: rozilik bor / yo'q / yopilgan
insert into public.vacancies (id, owner_profile_id, title, category_id, region_id, status, salary_negotiable, published_at, expires_at)
select x.id, '84000000-0000-0000-0000-000000000001', x.t, (select id from public.categories limit 1),
       (select id from public.regions where slug = 'tashkent_city'), 'active', true, now(), now() + interval '10 days'
  from (values ('84100000-0000-0000-0000-000000000001'::uuid, 'Oshpaz'), ('84100000-0000-0000-0000-000000000002'::uuid, 'Kassir'),
               ('84100000-0000-0000-0000-000000000003'::uuid, 'Qorovul')) x(id, t);
update public.vacancies set status = 'closed' where id = '84100000-0000-0000-0000-000000000003';
insert into public.vacancy_contacts (vacancy_id, phone, show_phone) values
  ('84100000-0000-0000-0000-000000000001', '+998901112233', true),
  ('84100000-0000-0000-0000-000000000002', '+998904445566', false),
  ('84100000-0000-0000-0000-000000000003', '+998907778899', true)
on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = excluded.show_phone;

select pg_temp.ok((select phone = '+998901112233' from public.listing_phones_public('vacancy', '84100000-0000-0000-0000-000000000001')), 'vakansiya: rozilik bor — raqam');
select pg_temp.ok((select count(*) = 0 from public.listing_phones_public('vacancy', '84100000-0000-0000-0000-000000000002')), 'vakansiya: rozilik yo''q — raqamsiz');
select pg_temp.ok((select count(*) = 0 from public.listing_phones_public('vacancy', '84100000-0000-0000-0000-000000000003')), 'yopilgan vakansiya — raqamsiz');

-- ishchilar: e'londagi raqam / hisob raqami (ko'rinishi everyone emas) / bloklangan
insert into public.worker_profiles (id, profile_id, headline, region_id, category_id, experience_level, is_public, status, onboarding_completed_at)
select x.id, x.p, 'Usta', (select id from public.regions where slug = 'tashkent_city'), (select id from public.categories limit 1), '3_5y', true, 'active', now()
  from (values ('84200000-0000-0000-0000-000000000002'::uuid, '84000000-0000-0000-0000-000000000002'::uuid),
               ('84200000-0000-0000-0000-000000000003'::uuid, '84000000-0000-0000-0000-000000000003'::uuid)) x(id, p);
update public.worker_profiles set is_public = true where id in ('84200000-0000-0000-0000-000000000002', '84200000-0000-0000-0000-000000000003');
insert into public.worker_listing_phones (worker_id, phone, phone2) values ('84200000-0000-0000-0000-000000000002', '+998935550011', '+998935550022');
update public.profile_contacts set phone_visibility = 'on_request' where profile_id = '84000000-0000-0000-0000-000000000003';

select pg_temp.ok((select phone = '+998935550011' and phone2 = '+998935550022' from public.listing_phones_public('worker', '84200000-0000-0000-0000-000000000002')), 'ishchi: e''londagi ikki raqam');
select pg_temp.ok((select count(*) = 0 from public.listing_phones_public('worker', '84200000-0000-0000-0000-000000000003')), 'ishchi: hisob raqami "so''rov bilan" — mehmonga yo''q');

update public.profiles set is_blocked = true where id = '84000000-0000-0000-0000-000000000002';
select pg_temp.ok((select count(*) = 0 from public.listing_phones_public('worker', '84200000-0000-0000-0000-000000000002')), 'bloklangan ishchi — raqamsiz');
select pg_temp.ok((select count(*) = 0 from public.listing_phones_public('job', '84100000-0000-0000-0000-000000000001')), 'noma''lum tur — bo''sh');

-- huquqlar: faqat server kaliti
select pg_temp.ok(not has_function_privilege('anon', 'public.listing_phones_public(text, uuid)', 'execute'), 'anon chaqira olmaydi');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.listing_phones_public(text, uuid)', 'execute'), 'authenticated chaqira olmaydi');
select pg_temp.ok(has_function_privilege('service_role', 'public.listing_phones_public(text, uuid)', 'execute'), 'service_role chaqiradi');

rollback;
