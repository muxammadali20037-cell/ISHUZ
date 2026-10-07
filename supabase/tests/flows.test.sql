-- ISH.UZ · RLS va biznes-oqim testlari (lokal Postgres + scripts/supabase-stub.sql)
-- Har bir tekshiruv muvaffaqiyatsiz bo'lsa exception beradi (psql ON_ERROR_STOP bilan ishga tushiriladi).
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
-- p_sql xato berishi shart (ixtiyoriy: kutilgan SQLSTATE yoki xabar qismi)
create or replace function pg_temp.fails(p_sql text, p_name text, p_expect text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_expect is not null and sqlstate <> p_expect and position(p_expect in sqlerrm) = 0 then
      raise exception 'TEST FAILED: % — kutilgan %, olingan % (%)', p_name, p_expect, sqlstate, sqlerrm;
    end if;
    raise notice 'ok - % (% %)', p_name, sqlstate, left(sqlerrm, 60);
    return;
  end;
  raise exception 'TEST FAILED: % — xato kutilgan edi, lekin muvaffaqiyatli bajarildi', p_name;
end $$;

begin;
-- 0043 dan oldingi qoidalar bilan sinaladi (yangi 10 kunlik pullik e'lonlar — paid_listings.test.sql)
update public.app_settings set value = 'false'::jsonb where key = 'listings_paid';
update public.app_settings set value = '30'::jsonb where key = 'vacancy_lifetime_days';
update public.app_settings set value = '50000'::jsonb where key = 'price_vacancy_publish';

-- ---------- foydalanuvchilar ----------
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '+998901111111', now(), '{"first_name":"Ali","last_name":"Valiyev"}'),
  ('22222222-2222-2222-2222-222222222222', '+998902222222', now(), '{"first_name":"Bobur","last_name":"Karimov"}'),
  ('33333333-3333-3333-3333-333333333333', '+998903333333', now(), '{"first_name":"Madina","last_name":"Tosheva"}'),
  ('44444444-4444-4444-4444-444444444444', '+998904444444', now(), '{"first_name":"Sardor","last_name":"Rahimov"}'),
  ('55555555-5555-5555-5555-555555555555', null, null, '{"first_name":"Admin","last_name":"Adminov"}');
insert into public.admin_users (profile_id, role) values ('55555555-5555-5555-5555-555555555555', 'admin');

select pg_temp.ok((select count(*) from public.profiles) = 5, 'handle_new_user: 5 ta profil yaratildi');
select pg_temp.ok((select phone from public.profile_contacts where profile_id = '11111111-1111-1111-1111-111111111111') = '+998901111111', 'telefon profile_contacts ga ko''chdi');

-- ---------- Ali: ishchi profili ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ok((select count(*) from public.profile_contacts where profile_id = '22222222-2222-2222-2222-222222222222') = 0, 'RLS: boshqa foydalanuvchi telefonini ko''rib bo''lmaydi');
select pg_temp.ok((select count(*) from public.profile_contacts) = 1, 'RLS: faqat o''z kontaktini ko''radi');

insert into public.worker_profiles (profile_id, headline, category_id, subcategory_id, experience_level, region_id, district_id, work_format, onboarding_completed_at)
select '11111111-1111-1111-1111-111111111111', 'Kassir', c.id, s.id, '1_2y', r.id, d.id, 'official', now()
from public.categories c join public.subcategories s on s.category_id = c.id and s.slug = 'cashier'
join public.regions r on r.slug = 'tashkent_city' join public.districts d on d.region_id = r.id and d.slug = 'chilonzor'
where c.slug = 'sales';
select pg_temp.ok((select role from public.user_roles where profile_id = '11111111-1111-1111-1111-111111111111') = 'worker', 'worker roli avtomatik qo''shildi');
select pg_temp.ok((select active_role from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'worker', 'active_role = worker');

insert into public.worker_preferences (worker_id, employment_types, schedules, salary_min, salary_expected, availability)
values (public.current_worker_id(), '{full_time}', '{6_1,5_2}', 5000000, 7000000, 'today');
insert into public.worker_skills (worker_id, skill_id, level)
select public.current_worker_id(), id, 'good' from public.skills where slug in ('sales_pos', 'sales_excel', 'sales_cash');
insert into public.worker_languages (worker_id, language_code, level) values (public.current_worker_id(), 'uz', 'native'), (public.current_worker_id(), 'ru', 'b1');
insert into public.worker_geo (worker_id, lat, lng) values (public.current_worker_id(), 41.2753, 69.2040);
select pg_temp.ok((select completeness from public.worker_profiles where profile_id = '11111111-1111-1111-1111-111111111111') >= 60, 'profil to''liqligi hisoblandi');
select pg_temp.fails($$insert into public.worker_profiles (profile_id) values ('22222222-2222-2222-2222-222222222222')$$, 'RLS: boshqa odam nomidan worker profil yaratib bo''lmaydi', '42501');

-- ---------- Bobur: ish beruvchi + kompaniya + vakansiya ----------
select pg_temp.login('22222222-2222-2222-2222-222222222222');
insert into public.employer_profiles (profile_id, employer_type) values ('22222222-2222-2222-2222-222222222222', 'company');
insert into public.companies (name, created_by, region_id) select 'Anor Market', '22222222-2222-2222-2222-222222222222', id from public.regions where slug = 'tashkent_city';
select pg_temp.ok((select slug from public.companies where name = 'Anor Market') = 'anor-market', 'kompaniya slug avtomatik');
select pg_temp.ok((select role from public.company_members where profile_id = '22222222-2222-2222-2222-222222222222') = 'owner', 'yaratuvchi owner bo''ldi');
select pg_temp.ok((select company_id from public.employer_profiles where profile_id = '22222222-2222-2222-2222-222222222222') is not null, 'employer_profiles.company_id bog''landi');
select pg_temp.fails($$update public.companies set verification_status = 'verified' where name = 'Anor Market'$$, 'RLS: kompaniya o''zini verified qila olmaydi');

insert into public.vacancies (owner_profile_id, company_id, title, category_id, subcategory_id, region_id, district_id, lat, lng, salary_from, salary_to, employment_type, schedule, experience_min_months, work_format, description)
select '22222222-2222-2222-2222-222222222222', co.id, 'Kassir', c.id, s.id, r.id, d.id, 41.28, 69.21, 5000000, 7000000, 'full_time', '6_1', 12, 'official', 'Savdo markazida kassir kerak'
from public.companies co, public.categories c join public.subcategories s on s.category_id = c.id and s.slug = 'cashier',
  public.regions r join public.districts d on d.region_id = r.id and d.slug = 'chilonzor'
where co.name = 'Anor Market' and c.slug = 'sales' and r.slug = 'tashkent_city';
select pg_temp.ok((select status from public.vacancies where title = 'Kassir') = 'draft', 'vakansiya draft holatida yaratildi');
select pg_temp.ok((select slug from public.vacancies where title = 'Kassir') like 'kassir-anor-market-toshkent-shahri-%', 'vakansiya slug SEO formatida');
insert into public.vacancy_skills (vacancy_id, skill_id) select v.id, s.id from public.vacancies v, public.skills s where v.title = 'Kassir' and s.slug in ('sales_pos', 'sales_1c');
insert into public.vacancy_languages (vacancy_id, language_code, min_level) select id, 'ru', 'b1' from public.vacancies where title = 'Kassir';
insert into public.vacancy_benefits (vacancy_id, benefit_code) select id, 'food' from public.vacancies where title = 'Kassir';
select pg_temp.fails($$update public.vacancies set status = 'active' where title = 'Kassir'$$, 'RLS: to''g''ridan-to''g''ri active qilib bo''lmaydi');
select pg_temp.ok((select public.publish_vacancy(id) from public.vacancies where title = 'Kassir') = 'active', 'publish_vacancy -> active');
select pg_temp.ok((select expires_at from public.vacancies where title = 'Kassir') > now() + interval '29 days', 'expires_at 30 kun');
select pg_temp.ok((select count(*) from public.matches m join public.vacancies v on v.id = m.vacancy_id where v.title = 'Kassir') = 1, 'publish: matches keshi yangilandi');

-- ---------- anonim qidiruv ----------
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.search_vacancies(p_query => 'kassir')) = 1, 'anonim: search_vacancies ishlaydi');
select pg_temp.ok((select match_score from public.search_vacancies() limit 1) is null, 'anonim: moslik balli yo''q');
select pg_temp.ok((select count(*) from public.vacancies) = 1, 'anonim: faqat active vakansiyalarni ko''radi');
select pg_temp.fails($$select * from public.search_workers()$$, 'anonim: search_workers taqiqlangan', '42501');

-- ---------- Ali: moslik va ariza ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ok((select match_score from public.search_vacancies(p_query => 'kassir')) between 80 and 100, 'Ali uchun moslik 80+ (kassir, chilonzor, maosh mos)');
select pg_temp.ok((select match_reasons @> '[{"key":"category_match","ok":true}]' from public.search_vacancies(p_query => 'kassir')), 'moslik sabablari: kategoriya mos');
select pg_temp.ok((select match_reasons @> '[{"key":"skills_matched","ok":"warn"}]' from public.search_vacancies(p_query => 'kassir')), 'moslik sabablari: ko''nikma qisman (POS bor, 1C yo''q)');
select pg_temp.fails($$select * from public.search_workers()$$, 'ishchi: search_workers taqiqlangan', '42501');
select pg_temp.fails($$insert into public.applications (vacancy_id, worker_id) select id, public.current_worker_id() from public.vacancies$$, 'RLS: applications ga to''g''ridan-to''g''ri insert taqiqlangan');
select pg_temp.ok((select public.apply_to_vacancy(id, 'Assalomu alaykum, qiziqyapman') from public.vacancies where title = 'Kassir') is not null, 'apply_to_vacancy');
select pg_temp.fails($$select public.apply_to_vacancy(id) from public.vacancies where title = 'Kassir'$$, 'ikkinchi marta ariza yuborib bo''lmaydi', 'already_applied');
select pg_temp.ok((select applications_count from public.vacancies where title = 'Kassir') = 1, 'applications_count trigger');
select pg_temp.ok((select has_applied from public.search_vacancies(p_query => 'kassir')), 'search_vacancies.has_applied = true');
select pg_temp.ok((select status from public.applications) = 'sent', 'ariza holati sent');
select pg_temp.ok((select count(*) from public.application_events) = 1, 'application_events: sent');
insert into public.saved_vacancies (worker_id, vacancy_id) select public.current_worker_id(), id from public.vacancies;
select pg_temp.ok((select is_saved from public.search_vacancies(p_query => 'kassir')), 'saqlangan vakansiya');

-- ---------- Bobur: nomzodlar, kontakt, holat ----------
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.ok((select count(*) from public.notifications where type = 'application_received') = 1, 'ish beruvchiga ariza bildirishnomasi');
select pg_temp.ok((select (payload->>'match_score')::int from public.notifications where type = 'application_received') >= 80, 'bildirishnomada moslik foizi');
select pg_temp.ok((select count(*) from public.search_workers(p_category_id => (select id from public.categories where slug = 'sales'))) = 1, 'search_workers: Ali topildi');
select pg_temp.ok((select match_score from public.search_workers(p_vacancy_id => (select id from public.vacancies where title = 'Kassir'))) >= 80, 'search_workers: vakansiya bo''yicha moslik');
select pg_temp.ok((select last_initial from public.search_workers()) = 'V', 'search_workers: familiya faqat bosh harf');
select pg_temp.ok((select distance_km from public.search_workers(p_lat => 41.28, p_lng => 69.21)) < 2, 'search_workers: masofa hisoblanadi');
select pg_temp.ok((select count(*) from public.search_workers(p_experience_min_months => 60)) = 0, 'filter: 5 yil tajriba -> topilmadi');
select pg_temp.ok((select count(*) from public.search_workers(p_language_codes => '{ru}')) = 1, 'filter: rus tili -> topildi');
select pg_temp.ok((select count(*) from public.search_workers(p_language_codes => '{en}')) = 0, 'filter: ingliz tili -> topilmadi');
select pg_temp.ok((select allowed from public.get_contact('11111111-1111-1111-1111-111111111111')), 'ariza yuborgan nomzod telefoni ko''rinadi');
select pg_temp.ok((select phone from public.get_contact('11111111-1111-1111-1111-111111111111')) = '+998901111111', 'get_contact telefon qaytaradi');
select pg_temp.ok((select count(*) from public.worker_geo) = 0, 'RLS: ish beruvchi aniq koordinatani ko''rmaydi');
select pg_temp.ok((select employer_dashboard_stats()->>'new_applications') = '1', 'employer_dashboard_stats');
select public.set_application_status((select id from public.applications), 'viewed');
select public.set_application_status((select id from public.applications), 'interview', 'Ertaga 10:00 da keling');
select pg_temp.ok((select status from public.applications) = 'interview', 'holat: interview');
select pg_temp.ok((select count(*) from public.application_events) = 3, 'timeline: sent, viewed, interview');
create temp table t_ids as select (select id from public.applications) as app_id, (select id from public.vacancies where title = 'Kassir') as vacancy_id;

-- ---------- Sardor: ariza yubormagan ish beruvchi telefonni ko'rmaydi ----------
select pg_temp.login('44444444-4444-4444-4444-444444444444');
insert into public.employer_profiles (profile_id, employer_type, display_name) values ('44444444-4444-4444-4444-444444444444', 'person', 'Sardor');
select pg_temp.ok(not (select allowed from public.get_contact('11111111-1111-1111-1111-111111111111')), 'aloqasi yo''q ish beruvchi telefonni ko''rmaydi');
select pg_temp.ok((select phone from public.get_contact('11111111-1111-1111-1111-111111111111')) is null, 'get_contact null');
select pg_temp.fails($$select public.set_application_status((select app_id from t_ids), 'rejected')$$, 'begona ariza holatini o''zgartira olmaydi', '42501');
update public.vacancies set title = 'Hack' where title = 'Kassir';  -- RLS: 0 qator (xatosiz)
select pg_temp.ok((select count(*) from public.search_vacancies(p_query => 'Hack')) = 0, 'RLS: begona vakansiyani tahrirlab bo''lmaydi');
select pg_temp.ok((select count(*) from public.applications) = 0, 'RLS: begona arizalarni ko''rmaydi');
select pg_temp.ok((select count(*) from public.notifications) = 0, 'RLS: begona bildirishnomalarni ko''rmaydi');

-- ---------- Ali: bildirishnoma, chat ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ok((select count(*) from public.notifications where type = 'interview_invite') = 1, 'ishchiga suhbat bildirishnomasi');
select pg_temp.ok((select count(*) from public.notifications where type = 'new_matching_vacancy') = 1, 'birinchi e''londa mos vakansiya bildirishnomasi');
select pg_temp.ok((select notifications from public.unread_counts()) = 3, 'unread_counts: 3 ta o''qilmagan');
select pg_temp.ok(public.mark_notifications_read() = 3, 'mark_notifications_read');
select pg_temp.ok((select public.get_or_create_conversation(p_application_id => (select id from public.applications))) is not null, 'chat ochildi');
select pg_temp.ok((select count(*) from public.conversation_members) = 2, 'chatda 2 a''zo');
select pg_temp.ok((select public.send_message((select id from public.conversations), 'text', 'Assalomu alaykum!')) is not null, 'xabar yuborildi');
select pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) select id, '11111111-1111-1111-1111-111111111111', 'x' from public.conversations$$, 'RLS: messages ga to''g''ridan-to''g''ri insert taqiqlangan');
select pg_temp.ok((select unread_count from public.my_conversations()) = 0, 'o''z xabari o''qilmagan hisoblanmaydi');

select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.ok((select unread_count from public.my_conversations()) = 1, 'ish beruvchida 1 o''qilmagan xabar');
select pg_temp.ok((select count(*) from public.notifications where type = 'new_message') = 1, 'yangi xabar bildirishnomasi');
select pg_temp.ok((select public.send_message((select id from public.conversations), 'text', 'Va alaykum assalom, ertaga kutamiz')) is not null, 'javob xabari');
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select pg_temp.ok((select count(*) from public.messages) = 0, 'RLS: begona chat xabarlarini ko''rmaydi');
select pg_temp.fails($$select public.send_message((select id from public.conversations limit 1), 'text', 'spam')$$, 'begona chatga yozib bo''lmaydi');

-- ---------- Taklif: Bobur -> Madina ----------
select pg_temp.login('33333333-3333-3333-3333-333333333333');
insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at)
select '33333333-3333-3333-3333-333333333333', 'Sotuvchi', c.id, r.id, '2_3y', now() from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';
update public.profile_contacts set phone_visibility = 'nobody' where profile_id = '33333333-3333-3333-3333-333333333333';
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.ok((select public.send_offer((select id from public.worker_profiles where profile_id = '33333333-3333-3333-3333-333333333333'), (select id from public.vacancies where title = 'Kassir'), null, 'Sizni taklif qilamiz')) is not null, 'send_offer');
select pg_temp.fails($$select public.send_offer((select id from public.worker_profiles where profile_id = '33333333-3333-3333-3333-333333333333'), (select id from public.vacancies where title = 'Kassir'))$$, 'takroriy taklif taqiqlangan', 'already_offered');
select pg_temp.ok(not (select allowed from public.get_contact('33333333-3333-3333-3333-333333333333')), 'phone_visibility=nobody: telefon yopiq');
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select pg_temp.ok((select count(*) from public.notifications where type = 'offer_received') = 1, 'ishchiga taklif bildirishnomasi');
select public.respond_offer((select id from public.job_offers), true);
select pg_temp.ok((select status from public.job_offers) = 'accepted', 'taklif qabul qilindi');
select pg_temp.ok((select status from public.applications where worker_id = public.current_worker_id()) = 'offered', 'qabul qilingan taklif -> ariza offered');
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.ok((select count(*) from public.notifications where type = 'offer_response') = 1, 'ish beruvchiga javob bildirishnomasi');
select pg_temp.ok(not (select allowed from public.get_contact('33333333-3333-3333-3333-333333333333')), 'nobody: taklif qabul qilinsa ham telefon yopiq');

-- ---------- Hired + sharh ----------
select public.set_application_status((select id from public.applications where worker_id = (select id from public.worker_profiles where profile_id = '11111111-1111-1111-1111-111111111111')), 'hired');
select pg_temp.fails($$select public.create_review((select id from public.applications where status = 'offered'), 5, 'zo''r')$$, 'hired bo''lmagan ariza uchun sharh yozib bo''lmaydi', 'review_requires_hire');
select pg_temp.ok((select public.create_review((select id from public.applications where status = 'hired'), 5, 'Ajoyib xodim')) is not null, 'sharh yaratildi (pending)');
select pg_temp.ok((select status from public.reviews) = 'pending', 'sharh moderatsiyada');
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select pg_temp.ok((select count(*) from public.reviews) = 0, 'pending sharh boshqalarga ko''rinmaydi');

-- ---------- Admin ----------
select pg_temp.login('55555555-5555-5555-5555-555555555555');
select pg_temp.ok(public.is_admin(), 'is_admin');
select pg_temp.ok(public.has_admin_permission('vacancies.moderate'), 'admin: vacancies.moderate');
select pg_temp.ok(not public.has_admin_permission('admins.manage'), 'admin: admins.manage yo''q (faqat super_admin)');
select public.admin_moderate_review((select id from public.reviews), 'approved');
select public.admin_set_vacancy_status((select id from public.vacancies where title = 'Kassir'), 'hidden', 'Tekshiruv');
select pg_temp.ok((select status from public.vacancies where title = 'Kassir') = 'hidden', 'admin vakansiyani yashirdi');
select pg_temp.ok((select count(*) from public.audit_logs) = 2, 'audit_logs: 2 ta yozuv');
select pg_temp.ok((select (admin_stats()->>'hires')::int) = 1, 'admin_stats.hires = 1');
select pg_temp.ok((select count(*) from public.admin_daily_stats(7)) = 7, 'admin_daily_stats: 7 kun');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.vacancies) = 0, 'yashirilgan vakansiya anonimga ko''rinmaydi');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ok((select count(*) from public.notifications where type = 'review_received') = 1, 'sharh tasdiqlandi -> bildirishnoma');
select pg_temp.ok((select avg_rating from public.profile_rating('11111111-1111-1111-1111-111111111111')) = 5.0, 'profile_rating');
select pg_temp.fails($$select public.admin_set_user_block('22222222-2222-2222-2222-222222222222', true)$$, 'oddiy foydalanuvchi admin RPC ni chaqira olmaydi', '42501');

-- ---------- Bloklash ----------
select pg_temp.login('55555555-5555-5555-5555-555555555555');
select public.admin_set_user_block('44444444-4444-4444-4444-444444444444', true, 'spam');
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select pg_temp.fails($$select public.send_offer((select id from public.worker_profiles where profile_id = '11111111-1111-1111-1111-111111111111'), null, 'Ish', 'x')$$, 'bloklangan foydalanuvchi taklif yubora olmaydi', 'blocked');
select pg_temp.fails($$update public.profiles set is_blocked = false where id = '44444444-4444-4444-4444-444444444444'$$, 'RLS: o''zini blokdan chiqara olmaydi');

select pg_temp.superuser();
rollback;
\echo '✓ barcha testlar o''tdi'
