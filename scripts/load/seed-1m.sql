-- 1 mln foydalanuvchilik sintetik ma'lumot (FAQAT lokal test bazasi uchun: scripts/load-test.sh).
-- Triggerlar o'chiriladi (session_replication_role = replica) — tez yuklash uchun; masofaviy bazada ishlatilmaydi.
\timing on
set session_replication_role = replica;
create temp table nodes as select row_number() over () as rn, id, category_id, subcategory_id, name_uz from public.profession_nodes where selectable and is_active and category_id is not null;
create temp table dists as select row_number() over () as rn, id, region_id from public.districts;
select count(*) n_nodes from nodes; select count(*) n_dists from dists;
-- 1 000 000 profil
insert into public.profiles (id, first_name, last_name, locale)
select ('00000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, 'Ism' || g, 'Familiya', 'uz' from generate_series(1, 1000000) g;
-- 700 000 ish qidiruvchi (yarmi qidiruvda)
insert into public.worker_profiles (profile_id, category_id, subcategory_id, profession_node_id, region_id, district_id, is_public, onboarding_completed_at, status, last_active_at, listed_until, completeness, headline)
select ('00000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, n.category_id, n.subcategory_id, n.id, d.region_id, d.id, g % 2 = 0, now() - (g % 300) * interval '1 day', 'active', now() - (g % 90) * interval '1 day',
  case when g % 2 = 0 then now() + (g % 10) * interval '1 day' end, 40 + g % 60, n.name_uz
from generate_series(1, 700000) g
join nodes n on n.rn = 1 + g % (select count(*) from nodes)
join dists d on d.rn = 1 + (g * 7) % (select count(*) from dists);
-- 600 000 vakansiya (150 000 faol, qolgani tarix)
insert into public.vacancies (owner_profile_id, title, category_id, subcategory_id, profession_node_id, region_id, district_id, status, published_at, expires_at, salary_from, salary_to, salary_type, slug, search_vector, employment_type, schedule, experience_min_months)
select ('00000000-0000-4000-8000-' || lpad(to_hex(700000 + g % 300000 + 1), 12, '0'))::uuid, n.name_uz || ' ' || g, n.category_id, n.subcategory_id, n.id, d.region_id, d.id,
  (case when g % 4 = 0 then 'active' else 'expired' end)::public.vacancy_status,
  case when g % 4 = 0 then now() - (g % 10) * interval '1 day' else now() - (10 + g % 300) * interval '1 day' end,
  case when g % 4 = 0 then now() + (10 - g % 10) * interval '1 day' else now() - (g % 300) * interval '1 day' end,
  2000000 + (g % 80) * 100000, 4000000 + (g % 80) * 150000, 'monthly', 'load-' || g, to_tsvector('public.ishuz', n.name_uz || ' ' || g),
  'full_time', '5_2', (g % 4) * 12
from generate_series(1, 600000) g
join nodes n on n.rn = 1 + (g * 13) % (select count(*) from nodes)
join dists d on d.rn = 1 + (g * 11) % (select count(*) from dists);
-- 3 000 000 bildirishnoma
insert into public.notifications (profile_id, type, payload, link, created_at, read_at, telegram_sent_at)
select ('00000000-0000-4000-8000-' || lpad(to_hex(1 + g % 1000000), 12, '0'))::uuid, 'system', '{"kind":"x"}', '/', now() - (g % 200) * interval '1 day',
  case when g % 2 = 0 then now() end, now()
from generate_series(1, 3000000) g;
-- 500 000 ariza
insert into public.applications (vacancy_id, worker_id, status, created_at)
select v.id, w.id, 'sent', now() - (g % 10) * interval '1 day'
from generate_series(1, 500000) g
join lateral (select id from public.vacancies where slug = 'load-' || (4 * (1 + g % 150000))) v on true
join lateral (select id from public.worker_profiles where profile_id = ('00000000-0000-4000-8000-' || lpad(to_hex(1 + (g * 3) % 700000), 12, '0'))::uuid) w on true
on conflict do nothing;
set session_replication_role = origin;
vacuum analyze;
select (select count(*) from public.profiles) profiles, (select count(*) from public.worker_profiles) workers, (select count(*) from public.vacancies where status='active') active_vac, (select count(*) from public.notifications) notif, (select count(*) from public.applications) apps;
