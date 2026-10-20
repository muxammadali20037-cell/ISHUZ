-- 0068 · maosh davrlari va ochiq e'lon qoidalari: saralash davr bo'yicha, moslik havzasi natijani kesmaydi, boshqa davr —
--        0 ball emas, nomzod byudjeti davr bo'yicha, muddati o'tgan e'lon kesh/bot/saqlangan qidiruvga kirmaydi, AI PRO payload
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
  ('68000000-0000-0000-0000-000000000001', '+998906800001', now(), '{"first_name":"Ish beruvchi"}'),
  ('68000000-0000-0000-0000-000000000002', '+998906800002', now(), '{"first_name":"Ishchi"}');
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
values ('68000000-0000-0000-0000-000000000001', 'person', 'S68 ish beruvchi', now()) on conflict (profile_id) do nothing;

select pg_temp.login('68000000-0000-0000-0000-000000000002');
insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at, is_public)
select '68000000-0000-0000-0000-000000000002', 'Yuk tashuvchi', c.id, r.id, '1_2y', now(), true
from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';
select pg_temp.superuser();
insert into public.worker_preferences (worker_id, salary_min, salary_expected, salary_type)
select id, 5000000, 6000000, 'monthly' from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002';

-- turli davrdagi e'lonlar (S68 belgisi bilan): kunlik 300 000 ≈ 6,6 mln/oy; oylik 5 mln; soatlik 20 000 ≈ 3,52 mln/oy
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, salary_from, salary_to, salary_type, salary_negotiable, published_at, expires_at)
select '68000000-0000-0000-0000-000000000001', t.title, c.id, r.id, 'Sinov e''loni: ' || t.title || ', ish vaqti 9 dan 18 gacha', 'active',
       t.sfrom, t.sto, t.stype::public.salary_type, t.neg, now() - t.age, t.exp
from public.categories c, public.regions r,
  (values ('S68 kunlik', 300000, null::int, 'daily', false, interval '1 hour', now() + interval '5 days'),
          ('S68 oylik', 5000000, null, 'monthly', false, interval '2 hours', now() + interval '5 days'),
          ('S68 soatlik', 20000, null, 'hourly', false, interval '3 hours', now() + interval '5 days'),
          ('S68 kelishiladi', null, null, 'negotiable', true, interval '4 hours', now() + interval '5 days'),
          ('S68 ishbay', 100000, null, 'piecework', false, interval '5 hours', now() + interval '5 days'),
          ('S68 muddati o''tgan', 9000000, null, 'monthly', false, interval '6 hours', now() - interval '1 minute')) as t(title, sfrom, sto, stype, neg, age, exp)
where c.slug = 'sales' and r.slug = 'tashkent_city';

-- 1) maosh bo'yicha saralash: oylik ekvivalent; kelishiladigan va ishbay — oxirida; muddati o'tgan — yo'q
select pg_temp.anon();
select pg_temp.ok(
  (select array_agg(title order by rn) from (
     select title, row_number() over () as rn from public.search_vacancies_v2(p_query => 'S68', p_sort => 'salary', p_limit => 50)) s)
  [1:3] = array['S68 kunlik', 'S68 oylik', 'S68 soatlik'],
  'maosh saralashi: 300 000/kun (≈6,6 mln) > 5 mln/oy > 20 000/soat (≈3,5 mln) — avval xom summa bilan kunlik oxirida edi');
select pg_temp.ok(
  (select array_agg(title order by rn) from (
     select title, row_number() over () as rn from public.search_vacancies_v2(p_query => 'S68', p_sort => 'salary', p_limit => 50)) s)
  [4:5] @> array['S68 kelishiladi', 'S68 ishbay'],
  'kelishiladigan va ishbay — taqqoslanmaydi, oxirida');
select pg_temp.ok(not exists (select 1 from public.search_vacancies_v2(p_query => 'S68', p_sort => 'salary', p_limit => 50) where title like 'S68 muddati%'),
  'muddati o''tgan e''lon qidiruvda yo''q');

-- 2) moslik havzasi: kirgan ishchida 300 dan ortiq natija kesilmaydi, son haqiqiy
select pg_temp.superuser();
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, salary_from, salary_type, published_at, expires_at)
select '68000000-0000-0000-0000-000000000001', 'S68cap ' || g, c.id, r.id, 'Sinov e''loni S68cap, ish vaqti 9 dan 18 gacha', 'active', 4000000, 'monthly',
       now() - make_interval(mins => g), now() + interval '5 days'
from public.categories c, public.regions r, generate_series(1, 310) g
where c.slug = 'sales' and r.slug = 'tashkent_city';
select pg_temp.login('68000000-0000-0000-0000-000000000002');
select pg_temp.ok((select max(total_count) from public.search_vacancies_v2(p_query => 'S68cap', p_sort => 'relevant', p_limit => 20)) = 310,
  'kirgan ishchi "Mos" ro''yxatida 310 ta natija (avval 300 bilan kesilardi)');
select pg_temp.ok(exists (select 1 from public.search_vacancies_v2(p_query => 'S68cap', p_sort => 'relevant', p_limit => 20, p_offset => 300) where title = 'S68cap 310'),
  'eng eski e''lon ham oxirgi sahifada ko''rinadi');
select pg_temp.ok((select count(*) filter (where match_score is not null) from public.search_vacancies_v2(p_query => 'S68cap', p_sort => 'relevant', p_limit => 20)) = 20,
  'birinchi sahifada moslik bali hisoblangan');
select pg_temp.ok((select bool_and(match_score is null) from public.search_vacancies_v2(p_query => 'S68cap', p_sort => 'relevant', p_limit => 10, p_offset => 300)),
  'havzadan tashqaridagilar — balsiz (soxta ball yo''q)');

-- 3) moslik: kunlik e'lon oylik kutgan ishchiga — 0 ball emas, "noma'lum" + taxminiy oylik ekvivalent
select pg_temp.superuser();
select pg_temp.ok(
  (select r ->> 'ok' = 'unknown' and (r ->> 'monthly_equivalent')::bigint = 6600000
   from jsonb_array_elements(public.compute_match_v2(
          (select id from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002'),
          (select id from public.vacancies where title = 'S68 kunlik')) -> 'reasons') r
   where r ->> 'key' = 'salary_type_differs'),
  'kunlik 300 000 → taxminan 6 600 000/oy (22 ish kuni), to''liq moslik deyilmaydi');
select pg_temp.ok(
  (public.compute_match_v2((select id from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002'), (select id from public.vacancies where title = 'S68 kunlik')) ->> 'score')::int
  > (public.compute_match_v2((select id from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002'), (select id from public.vacancies where title = 'S68 soatlik')) ->> 'score')::int,
  'ekvivalenti talabdan yuqori kunlik e''lon past soatlikdan yuqori baholanadi (0,5 > 0,25)');

-- 4) nomzod qidiruvi: byudjet 5 mln/oy, ishchi 300 000/kun (≈6,6 mln) so'raydi — mos emas (avval xom 300 000 ≤ 5 mln)
update public.worker_preferences set salary_min = 300000, salary_expected = 300000, salary_type = 'daily'
where worker_id = (select id from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002');
select pg_temp.login('68000000-0000-0000-0000-000000000001');
select pg_temp.ok(not exists (select 1 from public.search_workers_v2(p_salary_max => 5000000, p_limit => 50) w
                              join public.worker_profiles wp on wp.id = w.id where wp.profile_id = '68000000-0000-0000-0000-000000000002'),
  'byudjet 5 mln/oy: 300 000/kun so''ragan nomzod chiqmaydi');
select pg_temp.ok(exists (select 1 from public.search_workers_v2(p_salary_max => 7000000, p_limit => 50) w
                          join public.worker_profiles wp on wp.id = w.id where wp.profile_id = '68000000-0000-0000-0000-000000000002'),
  'byudjet 7 mln/oy: chiqadi');

-- 5) muddati o'tgan e'lon: moslik keshi, bot, saqlangan qidiruv
select pg_temp.superuser();
select public.refresh_matches_for_worker((select id from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002'));
select pg_temp.ok(not exists (select 1 from public.matches m join public.vacancies v on v.id = m.vacancy_id where v.title like 'S68 muddati%'),
  'moslik keshida muddati o''tgan e''lon yo''q');
select pg_temp.ok(public.refresh_matches_for_vacancy((select id from public.vacancies where title like 'S68 muddati%')) = 0,
  'muddati o''tgan e''lon uchun nomzodlar hisoblanmaydi');
select pg_temp.ok(not exists (select 1 from public.bot_matching_vacancies((select id from public.worker_profiles where profile_id = '68000000-0000-0000-0000-000000000002'), 500, 0) where title like 'S68 muddati%'),
  'bot ro''yxatida muddati o''tgan e''lon yo''q');
insert into public.saved_searches (id, profile_id, label, query_string, q, salary_min)
values ('68000000-0000-0000-0000-0000000000aa', '68000000-0000-0000-0000-000000000002', 'S68', 'q=S68', 'S68', 8000000);
-- "Kelishiladi" e'lon ham mos (maosh noma'lum) — shuning uchun muddati o'tganining hissasi farq bilan tekshiriladi
create temp table s68_cnt as select public.saved_search_new_count('68000000-0000-0000-0000-0000000000aa', now() - interval '1 day') as closed_n;
update public.vacancies set expires_at = now() + interval '1 day' where title like 'S68 muddati%';
select pg_temp.ok(public.saved_search_new_count('68000000-0000-0000-0000-0000000000aa', now() - interval '1 day') = (select closed_n from s68_cnt) + 1,
  'saqlangan qidiruv: muddati o''tgan 9 mln e''lon hisoblanmaydi, ochilsa — hisoblanadi');

-- 6) AI PRO xabari payload'i: e'lon, obuna va maosh davri bor
select pg_temp.ok(position('''alert_id'', a.id' in pg_get_functiondef('public.trg_vacancy_ai_alerts()'::regprocedure)) > 0
              and position('''salary_type'', new.salary_type' in pg_get_functiondef('public.trg_vacancy_ai_alerts()'::regprocedure)) > 0,
  'AI PRO payload: alert_id, vacancy_id, salary_type');

rollback;
\echo ✓ salary_periods
