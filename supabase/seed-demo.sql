-- ISH.UZ · DEMO ma'lumotlar (faqat development!). Haqiqiy kompaniya nomlari emas — "(demo)" belgisi bilan.
-- Ishga tushirish: npm run db:seed-demo  (lokal)  yoki Supabase SQL Editor (postgres roli).
-- Demo foydalanuvchilar parol/OTP bilan kira olmaydi; ular ro'yxatlar, moslik va qidiruvni ko'rish uchun.
begin;

create temp table demo_users (key text primary key, id uuid, first_name text, last_name text, phone text, locale text default 'uz');
insert into demo_users (key, id, first_name, last_name, phone, locale) values
  ('aziz',    'd0000000-0000-4000-8000-000000000001', 'Aziz',     'Rahimov',   '+998901110001', 'uz'),
  ('sardor',  'd0000000-0000-4000-8000-000000000002', 'Sardor',   'Karimov',   '+998901110002', 'uz'),
  ('madina',  'd0000000-0000-4000-8000-000000000003', 'Madina',   'Tosheva',   '+998901110003', 'ru'),
  ('dilnoza', 'd0000000-0000-4000-8000-000000000004', 'Dilnoza',  'Yusupova',  '+998901110004', 'uz'),
  ('jasur',   'd0000000-0000-4000-8000-000000000005', 'Jasur',    'Tursunov',  '+998901110005', 'uz'),
  ('nodira',  'd0000000-0000-4000-8000-000000000006', 'Nodira',   'Alimova',   '+998901110006', 'ru'),
  ('bekzod',  'd0000000-0000-4000-8000-000000000007', 'Bekzod',   'Nazarov',   '+998901110007', 'uz'),
  ('kamola',  'd0000000-0000-4000-8000-000000000008', 'Kamola',   'Saidova',   '+998901110008', 'uz'),
  ('index',   'd0000000-0000-4000-8000-000000000101', 'Bobur',    'Ismoilov',  '+998901110101', 'uz'),
  ('texno',   'd0000000-0000-4000-8000-000000000102', 'Gulnora',  'Xasanova',  '+998901110102', 'ru'),
  ('resto',   'd0000000-0000-4000-8000-000000000103', 'Otabek',   'Mirzayev',  '+998901110103', 'uz'),
  ('qurilish','d0000000-0000-4000-8000-000000000104', 'Sherzod',  'Qodirov',   '+998901110104', 'uz'),
  ('dokon',   'd0000000-0000-4000-8000-000000000105', 'Malika',   'Ergasheva', '+998901110105', 'uz');

insert into auth.users (id, instance_id, aud, role, email, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, phone, now(),
       '{"provider":"phone","providers":["phone"]}'::jsonb,
       jsonb_build_object('first_name', first_name, 'last_name', last_name, 'locale', locale), now() - interval '20 days', now()
from demo_users
on conflict (id) do nothing;

-- Ba'zilariga Telegram username (kontakt uchun)
update public.profile_contacts set telegram_username = 'aziz_r' where profile_id = (select id from demo_users where key = 'aziz');
update public.profile_contacts set telegram_username = 'madina_t', phone_visibility = 'on_request' where profile_id = (select id from demo_users where key = 'madina');

-- ---------------- yordamchilar ----------------
create or replace function pg_temp.cat(p_slug text) returns uuid language sql as $$ select id from public.categories where slug = p_slug $$;
create or replace function pg_temp.sub(p_cat text, p_slug text) returns uuid language sql as $$
  select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.slug = p_cat and s.slug = p_slug $$;
create or replace function pg_temp.reg(p_slug text) returns uuid language sql as $$ select id from public.regions where slug = p_slug $$;
create or replace function pg_temp.dist(p_reg text, p_slug text) returns uuid language sql as $$
  select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = p_reg and d.slug = p_slug $$;
create or replace function pg_temp.skill(p_slug text) returns uuid language sql as $$ select id from public.skills where slug = p_slug $$;
create or replace function pg_temp.uid(p_key text) returns uuid language sql as $$ select id from demo_users where key = p_key $$;

-- ---------------- ishchilar ----------------
create or replace function pg_temp.mk_worker(
  p_key text, p_headline text, p_cat text, p_sub text, p_exp public.experience_level, p_reg text, p_dist text,
  p_lat double precision, p_lng double precision, p_format public.work_format, p_about text,
  p_emp public.employment_type[], p_sched public.work_schedule[], p_min int, p_exp_salary int, p_avail public.availability,
  p_skills text[], p_langs jsonb, p_edu public.education_level, p_gender public.gender, p_birth date, p_status public.worker_status default 'active'
) returns uuid language plpgsql as $$
declare wid uuid; sk text; l jsonb;
begin
  update public.profiles set gender = p_gender, birth_date = p_birth where id = pg_temp.uid(p_key);
  insert into public.worker_profiles (profile_id, headline, category_id, subcategory_id, experience_level, about, status, region_id, district_id, work_format, onboarding_completed_at, onboarding_step, last_active_at)
  values (pg_temp.uid(p_key), p_headline, pg_temp.cat(p_cat), pg_temp.sub(p_cat, p_sub), p_exp, p_about, p_status, pg_temp.reg(p_reg), pg_temp.dist(p_reg, p_dist), p_format, now(), 9, now() - (random() * interval '3 days'))
  returning id into wid;
  insert into public.worker_geo (worker_id, lat, lng) values (wid, p_lat, p_lng);
  insert into public.worker_locations (worker_id, district_id) values (wid, pg_temp.dist(p_reg, p_dist)) on conflict do nothing;
  insert into public.worker_preferences (worker_id, employment_types, schedules, salary_min, salary_expected, availability, work_time_from, work_time_to)
  values (wid, p_emp, p_sched, p_min, p_exp_salary, p_avail, '09:00', '18:00');
  foreach sk in array p_skills loop
    if pg_temp.skill(sk) is not null then insert into public.worker_skills (worker_id, skill_id, level) values (wid, pg_temp.skill(sk), 'good') on conflict do nothing; end if;
  end loop;
  for l in select * from jsonb_array_elements(p_langs) loop
    insert into public.worker_languages (worker_id, language_code, level) values (wid, l->>'code', (l->>'level')::public.language_level) on conflict do nothing;
  end loop;
  insert into public.worker_education (worker_id, level) values (wid, p_edu);
  perform public.refresh_worker_completeness(wid);
  return wid;
end $$;

select pg_temp.mk_worker('aziz', 'Sotuvchi-konsultant', 'sales', 'consultant', '2_3y', 'tashkent_city', 'chilonzor', 41.2753, 69.2040, 'official',
  'Elektronika do''konida 2 yil sotuvchi-konsultant bo''lib ishlaganman. Mijozlar bilan muloqotni yaxshi bilaman.',
  '{full_time,permanent}', '{6_1,5_2}', 5000000, 7000000, 'today', '{sales_pos,sales_cash,sales_crm,general_russian,general_communication}',
  '[{"code":"uz","level":"native"},{"code":"ru","level":"b1"}]', 'vocational', 'male', '1999-04-12');
select pg_temp.mk_worker('sardor', 'Backend dasturchi (Node.js)', 'it', 'backend', '3_5y', 'tashkent_city', 'yunusobod', 41.3640, 69.2860, 'official',
  'Node.js, PostgreSQL, Docker. Fintech loyihalarda 4 yil.', '{full_time,remote}', '{5_2,flexible}', 15000000, 20000000, 'within_week',
  '{it_nodejs,it_typescript,it_postgresql,it_docker,it_git,general_english}', '[{"code":"uz","level":"native"},{"code":"ru","level":"c1"},{"code":"en","level":"b2"}]', 'higher', 'male', '1996-09-03');
select pg_temp.mk_worker('madina', 'SMM mutaxassis', 'marketing', 'smm', '1_2y', 'samarkand', 'samarkand_city', 39.6540, 66.9600, 'any',
  'Instagram va Telegram kanallarini yuritaman, target reklama.', '{part_time,remote,freelance}', '{flexible}', 4000000, 6000000, 'tomorrow',
  '{marketing_instagram,marketing_telegram,marketing_target_ads,marketing_canva,marketing_content_plan}', '[{"code":"uz","level":"native"},{"code":"ru","level":"b2"}]', 'higher', 'female', '2001-01-20');
select pg_temp.mk_worker('dilnoza', 'Buxgalter', 'finance', 'accountant', '5y_plus', 'tashkent_city', 'mirobod', 41.2870, 69.2870, 'official',
  '1C, soliq hisobotlari, 7 yil tajriba.', '{full_time}', '{5_2}', 8000000, 10000000, 'within_3_days',
  '{finance_1c_acc,finance_excel_f,finance_tax,finance_didox,finance_payroll}', '[{"code":"uz","level":"native"},{"code":"ru","level":"c1"}]', 'higher', 'female', '1990-06-15');
select pg_temp.mk_worker('jasur', 'Elektrik', 'electrician', 'electrician', '3_5y', 'tashkent_city', 'sergeli', 41.2230, 69.2220, 'unofficial',
  'Turar joy va ofislarda elektr montaj. Shchit yig''ish, avtomatika.', '{full_time,temporary,shift}', '{6_1,shift}', 6000000, 8000000, 'today',
  '{electrician_wiring,electrician_panel,electrician_automation,general_responsibility}', '[{"code":"uz","level":"native"},{"code":"ru","level":"a2"}]', 'vocational', 'male', '1994-11-08');
select pg_temp.mk_worker('nodira', 'Kassir', 'sales', 'cashier', '6_12m', 'tashkent_city', 'chilonzor', 41.2800, 69.2100, 'official',
  'Supermarketda kassir bo''lib ishlaganman.', '{full_time,shift}', '{2_2,6_1}', 4000000, 5000000, 'today',
  '{sales_pos,sales_cash,sales_click,sales_payme}', '[{"code":"uz","level":"native"},{"code":"ru","level":"b1"}]', 'secondary', 'female', '2003-03-30');
select pg_temp.mk_worker('bekzod', 'Motorist', 'auto_service', 'motorist', '5y_plus', 'tashkent_region', 'chirchiq', 41.4690, 69.5820, 'any',
  'Chevrolet va Kia dvigatellari, kompyuter diagnostikasi.', '{full_time}', '{6_1}', 7000000, 9000000, 'negotiable',
  '{auto_service_engine,auto_service_diagnostics,auto_service_chevrolet,auto_service_kia_hyundai}', '[{"code":"uz","level":"native"},{"code":"ru","level":"b1"}]', 'vocational', 'male', '1988-02-17', 'open');
select pg_temp.mk_worker('kamola', 'Oshpaz', 'restaurant', 'cook', '2_3y', 'tashkent_city', 'yakkasaroy', 41.2860, 69.2470, 'any',
  'Milliy va yevropa taomlari, HACCP.', '{full_time,shift}', '{2_2,shift}', 5000000, 6500000, 'today',
  '{restaurant_uzbek_cuisine,restaurant_european,restaurant_haccp}', '[{"code":"uz","level":"native"},{"code":"ru","level":"a2"}]', 'secondary', 'female', '1997-07-07');

-- ---------------- ish beruvchilar va kompaniyalar ----------------
create or replace function pg_temp.mk_company(p_key text, p_name text, p_industry text, p_size public.company_size, p_reg text, p_dist text, p_about text, p_verified boolean)
returns uuid language plpgsql as $$
declare cid uuid;
begin
  insert into public.employer_profiles (profile_id, employer_type, onboarding_completed_at) values (pg_temp.uid(p_key), 'company', now());
  insert into public.companies (name, created_by, industry_category_id, size, region_id, district_id, about, phone, verification_status, verified_at)
  values (p_name, pg_temp.uid(p_key), pg_temp.cat(p_industry), p_size, pg_temp.reg(p_reg), pg_temp.dist(p_reg, p_dist), p_about,
          (select phone from demo_users where key = p_key), case when p_verified then 'verified' else 'unverified' end::public.verification_status, case when p_verified then now() end)
  returning id into cid;
  update public.profiles set active_role = 'employer' where id = pg_temp.uid(p_key);
  return cid;
end $$;

select pg_temp.mk_company('index', 'INDEX Avtodrom (demo)', 'auto_service', '51_200', 'tashkent_city', 'yashnobod', 'Avtomobil servis markazi. Demo kompaniya.', true);
select pg_temp.mk_company('texno', 'Texno Savdo (demo)', 'sales', '201_500', 'tashkent_city', 'chilonzor', 'Maishiy texnika do''konlari tarmog''i. Demo kompaniya.', true);
select pg_temp.mk_company('resto', 'Anor Restoran (demo)', 'restaurant', '11_50', 'tashkent_city', 'yakkasaroy', 'Milliy taomlar restorani. Demo kompaniya.', false);
select pg_temp.mk_company('qurilish', 'Baraka Qurilish (demo)', 'construction', '51_200', 'tashkent_city', 'sergeli', 'Turar joy majmualari qurilishi. Demo kompaniya.', true);
insert into public.employer_profiles (profile_id, employer_type, display_name, contact_phone, region_id, district_id, onboarding_completed_at)
values (pg_temp.uid('dokon'), 'person', 'Malika opa do''koni (demo)', '+998901110105', pg_temp.reg('tashkent_city'), pg_temp.dist('tashkent_city', 'uchtepa'), now());
update public.profiles set active_role = 'employer' where id = pg_temp.uid('dokon');

-- ---------------- vakansiyalar ----------------
create or replace function pg_temp.mk_vacancy(
  p_owner text, p_title text, p_cat text, p_sub text, p_reg text, p_dist text, p_lat double precision, p_lng double precision,
  p_from int, p_to int, p_emp public.employment_type, p_sched public.work_schedule, p_exp int, p_format public.work_format,
  p_desc text, p_skills text[], p_langs jsonb, p_benefits text[], p_remote boolean default false, p_edu public.education_level default null
) returns uuid language plpgsql as $$
declare vid uuid; sk text; l jsonb; b text;
begin
  insert into public.vacancies (owner_profile_id, company_id, title, category_id, subcategory_id, region_id, district_id, lat, lng, is_remote,
    salary_from, salary_to, employment_type, schedule, work_time_from, work_time_to, experience_min_months, work_format, official_terms, education_min, description, status, published_at, expires_at)
  values (pg_temp.uid(p_owner), (select company_id from public.employer_profiles where profile_id = pg_temp.uid(p_owner)), p_title, pg_temp.cat(p_cat), pg_temp.sub(p_cat, p_sub),
    pg_temp.reg(p_reg), pg_temp.dist(p_reg, p_dist), p_lat, p_lng, p_remote, p_from, p_to, p_emp, p_sched, '09:00', '18:00', p_exp, p_format,
    case when p_format = 'official' then '{labor_contract,card_salary,paid_leave}'::text[] else '{}'::text[] end, p_edu, p_desc, 'active', now() - (random() * interval '10 days'), now() + interval '25 days')
  returning id into vid;
  foreach sk in array p_skills loop
    if pg_temp.skill(sk) is not null then insert into public.vacancy_skills (vacancy_id, skill_id) values (vid, pg_temp.skill(sk)) on conflict do nothing; end if;
  end loop;
  for l in select * from jsonb_array_elements(p_langs) loop
    insert into public.vacancy_languages (vacancy_id, language_code, min_level) values (vid, l->>'code', (l->>'level')::public.language_level) on conflict do nothing;
  end loop;
  foreach b in array p_benefits loop
    insert into public.vacancy_benefits (vacancy_id, benefit_code) values (vid, b) on conflict do nothing;
  end loop;
  perform public.refresh_matches_for_vacancy(vid);
  return vid;
end $$;

select pg_temp.mk_vacancy('texno', 'Kassir', 'sales', 'cashier', 'tashkent_city', 'chilonzor', 41.2760, 69.2050, 5000000, 7000000, 'full_time', '6_1', 12, 'official',
  'Savdo markazidagi do''konimizga kassir kerak.
- POS terminal va naqd pul bilan ishlash
- Click/Payme qabul qilish
- Smena 09:00–18:00, ovqat bilan', '{sales_pos,sales_cash,sales_1c}', '[{"code":"ru","level":"b1"}]', '{food,uniform,training}');
select pg_temp.mk_vacancy('texno', 'Sotuvchi-konsultant (maishiy texnika)', 'sales', 'consultant', 'tashkent_city', 'yunusobod', 41.3600, 69.2900, 4500000, 8000000, 'full_time', '6_1', 6, 'official',
  'Maishiy texnika bo''limiga sotuvchi-konsultant. Oylik + savdodan foiz (KPI).', '{sales_sales,sales_customer_service,sales_crm}', '[{"code":"ru","level":"b1"}]', '{food,kpi,bonus,career_growth}');
select pg_temp.mk_vacancy('index', 'Motorist', 'auto_service', 'motorist', 'tashkent_city', 'yashnobod', 41.2930, 69.3230, 7000000, 12000000, 'full_time', '6_1', 36, 'official',
  'Chevrolet va Kia/Hyundai avtomobillari dvigatel ta''miri. Zamonaviy uskunalar, o''qitish.', '{auto_service_engine,auto_service_diagnostics,auto_service_chevrolet}', '[]', '{food,uniform,training,bonus}');
select pg_temp.mk_vacancy('index', 'Avtoelektrik', 'auto_service', 'auto_electric', 'tashkent_city', 'yashnobod', 41.2930, 69.3230, 6000000, 10000000, 'full_time', '6_1', 24, 'official',
  'Avtoelektrika va kompyuter diagnostikasi bo''yicha mutaxassis.', '{auto_service_auto_el,auto_service_diagnostics}', '[]', '{food,uniform}');
select pg_temp.mk_vacancy('resto', 'Oshpaz (milliy taomlar)', 'restaurant', 'cook', 'tashkent_city', 'yakkasaroy', 41.2860, 69.2470, 5000000, 7000000, 'shift', '2_2', 12, 'unofficial',
  'Milliy taomlar oshpazi. Smena 2/2, ovqat va transport bilan.', '{restaurant_uzbek_cuisine,restaurant_haccp}', '[]', '{food,transport}');
select pg_temp.mk_vacancy('resto', 'Ofitsiant', 'restaurant', 'waiter', 'tashkent_city', 'yakkasaroy', 41.2860, 69.2470, 3500000, 5000000, 'shift', '2_2', 0, 'unofficial',
  'Tajribasiz nomzodlarni o''qitamiz. Choychaqa alohida.', '{restaurant_service}', '[{"code":"ru","level":"a2"}]', '{food,training}');
select pg_temp.mk_vacancy('qurilish', 'Elektrik (qurilish)', 'electrician', 'electromontage', 'tashkent_city', 'sergeli', 41.2200, 69.2300, 6000000, 9000000, 'full_time', '6_1', 24, 'official',
  'Yangi turar joy majmuasida elektr montaj ishlari.', '{electrician_wiring,electrician_panel}', '[]', '{food,transport,dormitory}');
select pg_temp.mk_vacancy('qurilish', 'Suvoqchi', 'construction', 'plasterer', 'tashkent_city', 'sergeli', 41.2200, 69.2300, 5000000, 8000000, 'temporary', '6_1', 12, 'unofficial',
  'Ishbay to''lov ham mumkin. Yotoqxona bor.', '{construction_plastering}', '[]', '{dormitory,food}');
select pg_temp.mk_vacancy('dokon', 'Sotuvchi (oziq-ovqat do''koni)', 'sales', 'seller', 'tashkent_city', 'uchtepa', 41.2930, 69.1720, 3000000, 4000000, 'full_time', 'flexible', 0, 'unofficial',
  'Mahalla do''koniga sotuvchi kerak. Yaqin atrofdan bo''lsa yaxshi.', '{sales_cash}', '[]', '{food}');
select pg_temp.mk_vacancy('texno', 'Backend dasturchi (Node.js)', 'it', 'backend', 'tashkent_city', 'chilonzor', 41.2760, 69.2050, 15000000, 25000000, 'full_time', '5_2', 36, 'official',
  'Ichki tizimlar uchun backend dasturchi. Gibrid format.', '{it_nodejs,it_postgresql,it_docker,it_typescript}', '[{"code":"en","level":"b1"}]', '{health_insurance,career_growth,training}', true, 'higher');
select pg_temp.mk_vacancy('texno', 'SMM mutaxassis', 'marketing', 'smm', 'tashkent_city', 'chilonzor', 41.2760, 69.2050, 5000000, 8000000, 'full_time', '5_2', 12, 'official',
  'Instagram/Telegram kanallari, target, kontent-plan.', '{marketing_instagram,marketing_target_ads,marketing_content_plan}', '[{"code":"ru","level":"b2"}]', '{bonus,flexible_hours}');
select pg_temp.mk_vacancy('texno', 'Buxgalter', 'finance', 'accountant', 'tashkent_city', 'chilonzor', 41.2760, 69.2050, 8000000, 12000000, 'full_time', '5_2', 36, 'official',
  '1C, Didox, soliq hisobotlari.', '{finance_1c_acc,finance_tax,finance_didox}', '[{"code":"ru","level":"b2"}]', '{health_insurance,paid_leave}', false, 'higher');

-- Ishchilar uchun moslik keshi
select public.refresh_matches_for_worker(id) from public.worker_profiles where profile_id in (select id from demo_users);

-- Bir nechta ariza va taklif (oqimni ko'rish uchun)
insert into public.applications (vacancy_id, worker_id, cover_message, status, match_score, match_reasons)
select v.id, w.id, 'Assalomu alaykum, ushbu vakansiya bilan qiziqyapman.', 'sent', m.score, m.reasons
from public.vacancies v, public.worker_profiles w, lateral public.compute_match(w.id, v.id) m
where v.title = 'Kassir' and w.profile_id = pg_temp.uid('nodira');
insert into public.application_events (application_id, from_status, to_status, actor_id) select id, null, 'sent', (select profile_id from public.worker_profiles where id = worker_id) from public.applications;
insert into public.applications (vacancy_id, worker_id, cover_message, status, match_score, match_reasons, viewed_at)
select v.id, w.id, 'Tajribam 4 yil, portfolio GitHub da.', 'interview', m.score, m.reasons, now()
from public.vacancies v, public.worker_profiles w, lateral public.compute_match(w.id, v.id) m
where v.title = 'Backend dasturchi (Node.js)' and w.profile_id = pg_temp.uid('sardor');
insert into public.job_offers (vacancy_id, employer_profile_id, company_id, worker_id, title, message, salary_from, salary_to, expires_at)
select v.id, v.owner_profile_id, v.company_id, w.id, v.title, 'Sizni suhbatga taklif qilamiz.', v.salary_from, v.salary_to, now() + interval '14 days'
from public.vacancies v, public.worker_profiles w where v.title = 'Motorist' and w.profile_id = pg_temp.uid('bekzod');

commit;
\echo '✓ demo ma''lumotlar yuklandi'
