-- 1 mln ma'lumotda asosiy so'rovlar vaqti (eng yaxshi natija, ms). scripts/load-test.sh ishga tushiradi.
-- Supabase'dagi kabi SSD narxi bilan: PGOPTIONS="-c random_page_cost=1.1"
\pset pager off
\set QUIET on
create or replace function pg_temp.as_anon() returns void language plpgsql as $$ begin perform set_config('request.jwt.claims','{"role":"anon"}',false); execute 'set role anon'; end $$;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text,false); execute 'set role authenticated'; end $$;
create or replace function pg_temp.t(label text, q text, runs int default 3) returns void language plpgsql as $$
declare t0 timestamptz; best numeric := 1e9; ms numeric; i int;
begin
  for i in 1..runs loop
    t0 := clock_timestamp();
    execute q;
    ms := extract(epoch from clock_timestamp() - t0) * 1000;
    best := least(best, ms);
  end loop;
  raise notice '% | % ms', rpad(label, 58), round(best, 1);
end $$;
insert into public.employer_profiles (profile_id, employer_type, onboarding_completed_at) values ('00000000-0000-4000-8000-0000000dbba1', 'person', now()) on conflict do nothing;
-- eng ko'p arizali ishchi va eng ko'p vakansiyali ish beruvchi
select w.id as worker, w.profile_id as worker_profile from public.worker_profiles w join public.applications a on a.worker_id = w.id group by w.id order by count(*) desc limit 1 \gset
select owner_profile_id as employer from public.vacancies where status = 'active' group by 1 order by count(*) desc limit 1 \gset

select pg_temp.as_anon();
select pg_temp.t('qidiruv: shifokorlar + Toshkent (mehmon)', $q$select * from public.simple_search_vacancies((select id from public.profession_nodes where slug='medicine-doctors'), (select id from public.regions where slug='tashkent_city'))$q$);
select pg_temp.t('qidiruv: shifokorlar, butun mamlakat', $q$select * from public.simple_search_vacancies((select id from public.profession_nodes where slug='medicine-doctors'))$q$);
select pg_temp.t('qidiruv: 3-sahifa', $q$select * from public.simple_search_vacancies((select id from public.profession_nodes where slug='medicine-doctors'), p_offset => 40)$q$);
select pg_temp.t('so''nggi faol vakansiyalar (jadval, RLS)', $q$select id, title from public.vacancies where status='active' order by published_at desc limit 20$q$);
select pg_temp.as_user('00000000-0000-4000-8000-0000000dbba1');
select pg_temp.t('nomzodlar: shifokorlar + Toshkent', $q$select * from public.simple_search_workers((select id from public.profession_nodes where slug='medicine-doctors'), (select id from public.regions where slug='tashkent_city'))$q$);
select pg_temp.t('ishchi e''lonlari (RLS) 20 ta', $q$select id from public.worker_profiles where is_public order by last_active_at desc limit 20$q$);
select pg_temp.as_user('00000000-0000-4000-8000-000000000064');
select pg_temp.t('o''qilmaganlar soni (har sahifada)', $q$select * from public.unread_counts()$q$);
select pg_temp.t('bildirishnomalar 20 ta (RLS, 3M jadval)', $q$select id from public.notifications order by created_at desc limit 20$q$);
select pg_temp.as_user(:'worker_profile');
select pg_temp.t('ishchi: mening arizalarim (worker_id filtri)', format($q$select a.id, v.title from public.applications a left join public.vacancies v on v.id = a.vacancy_id where a.worker_id = %L order by a.updated_at desc limit 300$q$, :'worker'));
select pg_temp.as_user(:'employer');
select pg_temp.t('ish beruvchi: mening vakansiyalarim', format($q$select id, title, status from public.vacancies where owner_profile_id = %L order by created_at desc limit 50$q$, :'employer'));
select pg_temp.t('ish beruvchi: so''nggi arizalar', format($q$select a.id from public.applications a where a.vacancy_id in (select id from public.vacancies where owner_profile_id = %L) order by a.created_at desc limit 20$q$, :'employer'));
-- Filtrsiz so'rov (ilova bunday qilmaydi): RLS har qatorda tekshiriladi — doim egasi/ishchi/vakansiya bo'yicha filtrlang
select pg_temp.as_user(:'worker_profile');
select pg_temp.t('[yomon namuna] arizalar filtrsiz (500k)', $q$select id from public.applications order by created_at desc limit 20$q$, 1);
reset role;
