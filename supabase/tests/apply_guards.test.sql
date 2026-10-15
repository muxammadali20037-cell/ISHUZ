-- 0065 · ariza qo'riqlari: muddati o'tgan (cron hali yopmagan) vakansiyaga ariza yo'q; yopilgan/muddati o'tgan vakansiya
--        bo'yicha taklif qabul qilinmaydi (rad etish mumkin); qidiruv muddati o'tganlarni ko'rsatmaydi
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2', 'iat', extract(epoch from now())::bigint + 5)::text, false);
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'listings_paid');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('65000000-0000-0000-0000-000000000001', '+998906500001', now(), '{"first_name":"Ish beruvchi"}'),
  ('65000000-0000-0000-0000-000000000002', '+998906500002', now(), '{"first_name":"Ishchi"}');

-- ishchi profili (to'ldirilgan)
select pg_temp.login('65000000-0000-0000-0000-000000000002');
insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at)
select '65000000-0000-0000-0000-000000000002', 'Sotuvchi', c.id, r.id, '1_2y', now() from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';

-- ish beruvchi (profil bilan — taklif yuborish uchun): uchta faol vakansiya (muddati o'tgan, ochiq, taklif uchun)
select pg_temp.superuser();
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
values ('65000000-0000-0000-0000-000000000001', 'person', 'Sinov ish beruvchi', now()) on conflict (profile_id) do nothing;
insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, published_at, expires_at)
select '65000000-0000-0000-0000-000000000001', t.title, r.id, 'Sinov e''loni: ' || t.title || ', 9 dan 18 gacha', 'active', 4000000, 'monthly', now() - interval '40 days', t.exp
from public.regions r, (values ('G1 muddati o''tgan', now() - interval '1 hour'), ('G1 ochiq', now() + interval '5 days'), ('G1 taklif', now() + interval '5 days')) as t(title, exp)
where r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.vacancies where title like 'G1 %' and status = 'active') = 3, 'uchta faol vakansiya (biri muddati o''tgan, cron hali yopmagan)');

-- 1) ariza: muddati o'tganiga — yo'q; ochig'iga — bor
select pg_temp.login('65000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.apply_to_vacancy((select id from public.vacancies where title = 'G1 muddati o''tgan'))$$, 'muddati o''tgan vakansiyaga ariza yo''q', 'vacancy_not_active');
select pg_temp.ok((select public.apply_to_vacancy((select id from public.vacancies where title = 'G1 ochiq'))) is not null, 'ochiq vakansiyaga ariza yuboriladi');
select pg_temp.fails($$select public.apply_to_vacancy((select id from public.vacancies where title = 'G1 ochiq'))$$, 'takroriy ariza yo''q', 'already_applied');

-- 2) qidiruv: muddati o'tgani ko'rinmaydi (mehmon ham, ishchi ham)
select pg_temp.anon();
select pg_temp.ok(not exists (select 1 from public.simple_search_vacancies(p_limit => 50) where title = 'G1 muddati o''tgan'), 'simple_search: muddati o''tgan ko''rinmaydi');
select pg_temp.ok(exists (select 1 from public.simple_search_vacancies(p_limit => 50) where title = 'G1 ochiq'), 'simple_search: ochiq ko''rinadi');
select pg_temp.ok(not exists (select 1 from public.simple_search_vacancies_v2(p_limit => 50) where title = 'G1 muddati o''tgan'), 'simple_search_v2: muddati o''tgan ko''rinmaydi');
select pg_temp.ok(not exists (select 1 from public.search_vacancies_v2(p_query => 'G1', p_limit => 50) where title = 'G1 muddati o''tgan'), 'search_vacancies_v2 (matn): muddati o''tgan ko''rinmaydi');
select pg_temp.ok(exists (select 1 from public.search_vacancies_v2(p_query => 'G1', p_limit => 50) where title = 'G1 ochiq'), 'search_vacancies_v2 (matn): ochiq ko''rinadi');

-- 3) taklif: vakansiya yopilgach qabul qilinmaydi, rad etish mumkin
select pg_temp.login('65000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.send_offer((select id from public.worker_profiles where profile_id = '65000000-0000-0000-0000-000000000002'), (select id from public.vacancies where title = 'G1 taklif'), null, 'Taklif')) is not null, 'taklif yuborildi');
select pg_temp.superuser();
update public.vacancies set status = 'closed' where title = 'G1 taklif';
select pg_temp.login('65000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.respond_offer((select id from public.job_offers where vacancy_id = (select id from public.vacancies where title = 'G1 taklif')), true)$$, 'yopilgan vakansiya bo''yicha taklif qabul qilinmaydi', 'vacancy_not_active');
select pg_temp.ok(not exists (select 1 from public.applications a join public.vacancies v on v.id = a.vacancy_id where v.title = 'G1 taklif'), 'yopilgan vakansiyaga ariza yaratilmadi');
select public.respond_offer((select id from public.job_offers where vacancy_id = (select id from public.vacancies where title = 'G1 taklif')), false);
select pg_temp.ok((select status from public.job_offers where vacancy_id = (select id from public.vacancies where title = 'G1 taklif')) = 'declined', 'rad etish mumkin');

-- 4) admin MFA talabi: settings.manage ruxsati berilgan oddiy admin o'chira olmaydi (boshqa sozlamani o'zgartiradi);
--    adminlarni boshqaruvchi (super_admin) — o'zgartiradi
select pg_temp.superuser();
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('65000000-0000-0000-0000-0000000000a1', '+998906500091', now(), '{"first_name":"Narx admini"}'),
  ('65000000-0000-0000-0000-0000000000a2', '+998906500092', now(), '{"first_name":"Bosh admin"}');
insert into public.admin_users (profile_id, role, permissions) values
  ('65000000-0000-0000-0000-0000000000a1', 'admin', array['settings.manage']),
  ('65000000-0000-0000-0000-0000000000a2', 'super_admin', '{}');
select pg_temp.login('65000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$update public.app_settings set value = 'false'::jsonb where key = 'admin_mfa_required'$$, 'settings.manage bilan ham admin MFA talabini o''chirib bo''lmaydi', '42501');
update public.app_settings set value = 'false'::jsonb where key = 'ai_search_button';
select pg_temp.ok((select value from public.app_settings where key = 'ai_search_button') = 'false'::jsonb, 'oddiy sozlama (lupa tugmasi) o''zgaradi');
select pg_temp.login('65000000-0000-0000-0000-0000000000a2');
update public.app_settings set value = 'false'::jsonb where key = 'admin_mfa_required';
select pg_temp.ok((select value from public.app_settings where key = 'admin_mfa_required') = 'false'::jsonb, 'super_admin admin MFA talabini o''zgartiradi');

rollback;
\echo ✓ apply_guards
