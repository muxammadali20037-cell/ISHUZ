-- 0066 · bosh sahifa bo'limlari: har bo'lim soni va shu bo'lim qidiruvi bir xil qoida bilan (faol, muddati o'tmagan);
--        ish beruvchi turi (kompaniya, YaTT, jismoniy shaxs, davlat), TOP, ommaviy; kunlik ishchilar. Mehmon ham chaqira oladi.
\set ON_ERROR_STOP on
\set QUIET on

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

begin;
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'listings_paid');

-- oldingi holat (seed'da boshqa e'lonlar bo'lishi mumkin — farqni tekshiramiz)
create temp table before_v as select * from public.vacancy_section_counts((select id from public.regions where slug = 'tashkent_city'), null);
create temp table before_w as select * from public.worker_section_counts((select id from public.regions where slug = 'tashkent_city'), null);
grant select on before_v, before_w to anon;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('66000000-0000-0000-0000-000000000001', '+998906600001', now(), '{"first_name":"Kompaniya"}'),
  ('66000000-0000-0000-0000-000000000002', '+998906600002', now(), '{"first_name":"YaTT"}'),
  ('66000000-0000-0000-0000-000000000003', '+998906600003', now(), '{"first_name":"Shaxs"}'),
  ('66000000-0000-0000-0000-000000000004', '+998906600004', now(), '{"first_name":"Ishchi1","last_name":"Kunlik"}'),
  ('66000000-0000-0000-0000-000000000005', '+998906600005', now(), '{"first_name":"Ishchi2","last_name":"Tajribali"}'),
  ('66000000-0000-0000-0000-000000000006', '+998906600006', now(), '{"first_name":"Maktab"}');
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values
  ('66000000-0000-0000-0000-000000000001', 'company', 'S2 MChJ', now()),
  ('66000000-0000-0000-0000-000000000002', 'individual_entrepreneur', 'S2 YaTT', now()),
  ('66000000-0000-0000-0000-000000000003', 'person', 'S2 Shaxs', now()),
  ('66000000-0000-0000-0000-000000000006', 'government', 'S2 Maktab', now())
on conflict (profile_id) do update set employer_type = excluded.employer_type;

-- e'lonlar: kompaniya (ommaviy, TOP), YaTT (kunlik, tajribasiz), shaxs, davlat tashkiloti (belgi trigger orqali),
-- masofaviy (boshqa viloyatda), muddati o'tgan va yopilgan (hech qayerda hisoblanmaydi)
insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, experience_min_months,
  positions_count, is_featured, is_government, is_remote, published_at, expires_at)
select t.owner::uuid, t.title, r.id, 'S2 sinov e''loni: ' || t.title || ', ish vaqti 9 dan 18 gacha', t.status::public.vacancy_status, 3000000, t.pay::public.salary_type, t.exp,
  t.positions, t.featured, t.gov, t.remote, now(), t.expires
from (values
  ('66000000-0000-0000-0000-000000000001', 'S2 Kassir ommaviy', 'active', 'monthly', 12, 10, true, false, false, 'tashkent_city', now() + interval '5 days'),
  ('66000000-0000-0000-0000-000000000002', 'S2 Yuk tashuvchi', 'active', 'daily', 0, 1, false, false, false, 'tashkent_city', now() + interval '5 days'),
  ('66000000-0000-0000-0000-000000000003', 'S2 Enaga', 'active', 'monthly', 0, 1, false, false, false, 'tashkent_city', now() + interval '5 days'),
  ('66000000-0000-0000-0000-000000000006', 'S2 Maktab o''qituvchisi', 'active', 'monthly', 24, 1, false, true, false, 'tashkent_city', null),
  ('66000000-0000-0000-0000-000000000002', 'S2 Masofaviy operator', 'active', 'monthly', 0, 1, false, false, true, 'samarkand', now() + interval '5 days'),
  ('66000000-0000-0000-0000-000000000002', 'S2 Muddati o''tgan', 'active', 'daily', 0, 9, true, false, true, 'tashkent_city', now() - interval '1 hour'),
  ('66000000-0000-0000-0000-000000000003', 'S2 Yopilgan', 'closed', 'daily', 0, 9, false, false, false, 'tashkent_city', now() + interval '5 days')
) as t(owner, title, status, pay, exp, positions, featured, gov, remote, region, expires)
join public.regions r on r.slug = t.region;

-- ishchilar: biri kunlik to'lov istagi bilan (tajribasiz), biri tajribali (oylik, "bir hafta ichida")
insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at, is_public)
select u.id, u.h, c.id, r.id, u.lvl::public.experience_level, now(), true
from (values ('66000000-0000-0000-0000-000000000004'::uuid, 'S2 Yukchi', 'none'), ('66000000-0000-0000-0000-000000000005'::uuid, 'S2 Elektrik', '3_5y')) as u(id, h, lvl),
  public.categories c, public.regions r
where c.slug = 'sales' and r.slug = 'tashkent_city';
insert into public.worker_preferences (worker_id, salary_type, availability)
select w.id, case when w.headline = 'S2 Yukchi' then 'daily' else 'monthly' end::public.salary_type,
  case when w.headline = 'S2 Yukchi' then 'within_week' else 'within_week' end::public.availability
from public.worker_profiles w where w.headline in ('S2 Yukchi', 'S2 Elektrik')
on conflict (worker_id) do update set salary_type = excluded.salary_type, availability = excluded.availability;

-- 1) vakansiya bo'limlari (mehmon): farq — faqat faol va muddati o'tmaganlar
select pg_temp.anon();
create temp table after_v as select * from public.vacancy_section_counts((select id from public.regions where slug = 'tashkent_city'), null);
select pg_temp.ok((select a.total - b.total from after_v a, before_v b) = 4, 'jami: toshkentdagi 4 ta faol (muddati o''tgan, yopilgan, boshqa viloyatdagi — yo''q)');
select pg_temp.ok((select a.today - b.today from after_v a, before_v b) = 4, 'bugungi: 4 ta');
select pg_temp.ok((select a.daily - b.daily from after_v a, before_v b) = 1, 'kunlik: 1 ta (muddati o''tgan va yopilgan kunliklar hisoblanmaydi)');
select pg_temp.ok((select a.remote - b.remote from after_v a, before_v b) = 1, 'masofaviy: hududdan qat''i nazar 1 ta');
select pg_temp.ok((select a.no_experience - b.no_experience from after_v a, before_v b) = 2, 'tajribasiz: 2 ta');
select pg_temp.ok((select a.company - b.company from after_v a, before_v b) = 1, 'kompaniya (MChJ): 1 ta — davlat tashkiloti kompaniyaga qo''shilmaydi');
select pg_temp.ok((select a.entrepreneur - b.entrepreneur from after_v a, before_v b) = 1, 'YaTT: 1 ta');
select pg_temp.ok((select a.person - b.person from after_v a, before_v b) = 1, 'jismoniy shaxs: 1 ta');
select pg_temp.ok((select a.government - b.government from after_v a, before_v b) = 1, 'davlat: 1 ta');
select pg_temp.ok((select a.featured - b.featured from after_v a, before_v b) = 1, 'TOP: 1 ta');
select pg_temp.ok((select a.mass - b.mass from after_v a, before_v b) = 1, 'ommaviy (5+ o''rin): 1 ta');

-- 2) bo'lim qidiruvi — son bilan bir xil natija
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_region_id => (select id from public.regions where slug = 'tashkent_city'), p_employer_type => 'company', p_limit => 50) where title like 'S2 %') = array['S2 Kassir ommaviy'], 'v3: kompaniya');
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_employer_type => 'individual_entrepreneur', p_limit => 50) where title like 'S2 %') = array['S2 Masofaviy operator', 'S2 Yuk tashuvchi'], 'v3: YaTT (butun O''zbekiston, muddati o''tgan yo''q)');
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_employer_type => 'government', p_limit => 50) where title like 'S2 %') = array['S2 Maktab o''qituvchisi'], 'v3: davlat');
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_featured => true, p_limit => 50) where title like 'S2 %') = array['S2 Kassir ommaviy'], 'v3: TOP');
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_mass => true, p_limit => 50) where title like 'S2 %') = array['S2 Kassir ommaviy'], 'v3: ommaviy');
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_salary_type => 'daily', p_limit => 50) where title like 'S2 %') = array['S2 Yuk tashuvchi'], 'v3: kunlik');
select pg_temp.ok((select array_agg(title order by title) from public.simple_search_vacancies_v3(p_remote => true, p_limit => 50) where title like 'S2 %') = array['S2 Masofaviy operator'], 'v3: masofaviy');
select pg_temp.ok((select count(*) from public.simple_search_vacancies_v3(p_limit => 50) where title like 'S2 %') = 5, 'v3 filtrsiz: 5 ta faol (v2 bilan bir xil qoida)');

-- 3) ishchilar bo'limlari: kunlik to'lov istagi yoki bugun/ertaga tayyor
create temp table after_w as select * from public.worker_section_counts((select id from public.regions where slug = 'tashkent_city'), null);
select pg_temp.ok((select a.total - b.total from after_w a, before_w b) = 2, 'ishchilar: 2 ta');
select pg_temp.ok((select a.daily - b.daily from after_w a, before_w b) = 1, 'kunlik ishchilar: 1 ta (kunlik to''lov istagi)');
select pg_temp.ok((select a.experienced - b.experienced from after_w a, before_w b) = 1, 'tajribali: 1 ta');
select pg_temp.ok((select array_agg(headline) from public.simple_search_workers_v2(p_daily => true, p_limit => 50) where headline like 'S2 %') = array['S2 Yukchi'], 'workers_v2: kunlik');
select pg_temp.superuser();
update public.worker_preferences set availability = 'today' where worker_id = (select id from public.worker_profiles where headline = 'S2 Elektrik');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_workers_v2(p_daily => true, p_limit => 50) where headline like 'S2 %') = 2, 'workers_v2: bugun tayyor ham kunlik ishchi');
select pg_temp.ok((select count(*) from public.simple_search_workers_v2(p_limit => 50) where headline like 'S2 %') = 2, 'workers_v2 filtrsiz: v1 bilan bir xil');

rollback;
\echo ✓ home_sections
