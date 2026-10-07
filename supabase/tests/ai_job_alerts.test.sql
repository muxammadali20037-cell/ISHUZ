-- ISH.UZ · aqlli AI qidiruv: RLS, limit, darhol xabar, to'lov rejimi
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
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

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e4000000-0000-0000-0000-000000000001', '+998905000001', now(), '{"first_name":"Ishchi","last_name":"A"}'),
  ('e4000000-0000-0000-0000-000000000002', '+998905000002', now(), '{"first_name":"Boshqa","last_name":"B"}'),
  ('e4000000-0000-0000-0000-000000000003', '+998905000003', now(), '{"first_name":"Klinika","last_name":"C"}');

-- ishchi: "Toshkentda shifokor (har qanday), 5 mln dan" — kasb ota yo'nalishi bo'yicha
select pg_temp.login('e4000000-0000-0000-0000-000000000001');
insert into public.ai_job_alerts (profile_id, prompt, label, profession_node_id, category_id, region_id, salary_min)
select auth.uid(), 'Toshkentda shifokor bo''lib ishlamoqchiman, 5 mln dan', 'Shifokor · Toshkent', n.id, n.category_id, r.id, 5000000
from public.profession_nodes n, public.regions r where n.slug = 'medicine-doctors' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.ai_job_alerts) = 1, 'o''z alertini ko''radi');
select pg_temp.fails($$insert into public.ai_job_alerts (profile_id, prompt, label, q) values ('e4000000-0000-0000-0000-000000000002', 'xxx', 'x', 'x')$$, 'boshqa odam nomidan yaratib bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.ai_job_alerts (profile_id, prompt, label, q, paid_until) values (auth.uid(), 'oshpaz', 'Oshpaz', 'oshpaz', now() + interval '1 year')$$, 'to''lov muddatini o''zi yozib bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.ai_job_alerts (profile_id, prompt, label) values (auth.uid(), 'nimadir', 'x')$$, 'mezonsiz alert bo''lmaydi', '23514');
select pg_temp.fails($$update public.ai_job_alerts set paid_until = now() + interval '1 year'$$, 'paid_until ni o''zgartirib bo''lmaydi', '42501');
update public.ai_job_alerts set is_active = true;
insert into public.ai_job_alerts (profile_id, prompt, label, q) values (auth.uid(), 'a1a', 'a1', 'aa'), (auth.uid(), 'a2a', 'a2', 'bb');
select pg_temp.fails($$insert into public.ai_job_alerts (profile_id, prompt, label, q) values (auth.uid(), 'a3a', 'a3', 'cc')$$, '3 tadan ortiq alert bo''lmaydi', 'ai_alert_limit');
delete from public.ai_job_alerts where q in ('aa', 'bb');

select pg_temp.login('e4000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.ai_job_alerts) = 0, 'begona alertlar ko''rinmaydi');

-- klinika vakansiyalar joylaydi
select pg_temp.superuser();
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, published_at, salary_from, salary_type, slug)
select 'e4000000-0000-0000-0000-000000000003', t.title, n.category_id, n.id, r.id, t.st::public.vacancy_status, now(), t.sal, 'monthly', t.slug
from (values
  ('Kardiolog', 'medicine-cardiologist', 7000000, 'active', 'ai-test-kardiolog'),
  ('Arzon kardiolog', 'medicine-cardiologist', 2000000, 'active', 'ai-test-arzon'),
  ('Hamshira', 'medicine-nurse', 6000000, 'active', 'ai-test-hamshira'),
  ('Pediatr (qoralama)', 'medicine-pediatrician', 8000000, 'draft', 'ai-test-pediatr')
) t(title, node, sal, st, slug)
join public.profession_nodes n on n.slug = t.node, public.regions r where r.slug = 'tashkent_city';

select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e4000000-0000-0000-0000-000000000001' and payload->>'kind' = 'ai_alert') = 1, 'faqat mos vakansiya: 1 ta darhol xabar (kardiolog, 7 mln)');
select pg_temp.ok((select payload->>'title' = 'Kardiolog' and payload->>'who' <> '' and link = '/jobs/ai-test-kardiolog' from public.notifications where profile_id = 'e4000000-0000-0000-0000-000000000001' and payload->>'kind' = 'ai_alert'), 'xabarda vakansiya, kim joylagani va havola bor');

-- qoralama faollashtirildi → xabar; to'xtatib qayta faollashtirish → takror yo'q
update public.vacancies set status = 'active' where slug = 'ai-test-pediatr';
update public.vacancies set status = 'paused' where slug = 'ai-test-pediatr';
update public.vacancies set status = 'active' where slug = 'ai-test-pediatr';
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e4000000-0000-0000-0000-000000000001' and payload->>'kind' = 'ai_alert') = 2, 'faollashganda xabar; qayta faollashganda takrorlanmaydi');
select pg_temp.ok((select hits_count from public.ai_job_alerts where profile_id = 'e4000000-0000-0000-0000-000000000001') = 2, 'topilganlar soni 2');

-- o'chirilgan alert xabar bermaydi
update public.ai_job_alerts set is_active = false;
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, published_at, salary_from, salary_type, slug)
select 'e4000000-0000-0000-0000-000000000003', 'Nevrolog', n.category_id, n.id, r.id, 'active', now(), 9000000, 'monthly', 'ai-test-nevrolog'
from public.profession_nodes n, public.regions r where n.slug = 'medicine-neurologist' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e4000000-0000-0000-0000-000000000001' and payload->>'kind' = 'ai_alert') = 2, 'o''chirilgan alert jim');

-- to'lov yoqilsa: faqat to'langan alertlar ishlaydi
update public.ai_job_alerts set is_active = true;
update public.app_settings set value = 'true'::jsonb where key = 'billing_enabled';
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, published_at, salary_from, salary_type, slug)
select 'e4000000-0000-0000-0000-000000000003', 'Manual terapevt', n.category_id, n.id, r.id, 'active', now(), 9000000, 'monthly', 'ai-test-manual'
from public.profession_nodes n, public.regions r where n.slug = 'medicine-manual-therapist' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e4000000-0000-0000-0000-000000000001' and payload->>'kind' = 'ai_alert') = 2, 'to''lov yoqilganda to''lanmagan alert jim');
update public.ai_job_alerts set paid_until = now() + interval '30 days';
insert into public.vacancies (owner_profile_id, title, category_id, profession_node_id, region_id, status, published_at, salary_from, salary_type, slug)
select 'e4000000-0000-0000-0000-000000000003', 'Lor', n.category_id, n.id, r.id, 'active', now(), 9000000, 'monthly', 'ai-test-lor'
from public.profession_nodes n, public.regions r where n.slug = 'medicine-ent-specialist' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e4000000-0000-0000-0000-000000000001' and payload->>'kind' = 'ai_alert') = 3, 'to''langan alert ishlaydi');

rollback;
\echo '✓ aqlli AI qidiruv testlari o''tdi'
