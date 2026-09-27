-- ISH.UZ · aqlli qidiruv: sinonimlar, qidiruv jurnali, maosh tahlili, o'xshash vakansiyalar
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
  ('e2000000-0000-0000-0000-000000000001', '+998903000001', now(), '{"first_name":"Kafe","last_name":"Egasi"}'),
  ('e2000000-0000-0000-0000-000000000002', '+998903000002', now(), '{"first_name":"Boshqa","last_name":"Firma"}'),
  ('e2000000-0000-0000-0000-000000000009', null, null, '{"first_name":"Admin","last_name":"S"}');
insert into public.admin_users (profile_id, role) values ('e2000000-0000-0000-0000-000000000009', 'admin');

-- sinonimlar
select pg_temp.ok((select 'svarchik' = any(aliases) from public.subcategories where slug = 'welder' and category_id = (select id from public.categories where slug = 'craftsman')), 'sinonim: svarchik → payvandchi');
select pg_temp.ok((select count(distinct slug) from public.subcategories where slug in ('chef', 'forklift', 'daily_worker', 'excavator')) = 4, 'yangi kasblar qo''shildi');

-- qidiruv jurnali: oddiy foydalanuvchi o'qiy/yoza olmaydi, admin o'qiydi
select pg_temp.superuser();
insert into public.search_logs (scope, query, query_norm, results_count) values ('jobs', 'motorchi', 'motorchi', 0), ('jobs', 'motorchi', 'motorchi', 0), ('jobs', 'kassir', 'kassir', 7);
select pg_temp.login('e2000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.search_logs) = 0, 'foydalanuvchi qidiruv jurnalini ko''rmaydi');
select pg_temp.fails($$insert into public.search_logs (scope, query, query_norm, results_count) values ('jobs', 'x', 'x', 0)$$, 'foydalanuvchi jurnalga yoza olmaydi', '42501');
select pg_temp.fails($$select * from public.admin_search_insights()$$, 'insights: oddiy foydalanuvchiga yopiq', '42501');
select pg_temp.login('e2000000-0000-0000-0000-000000000009');
select pg_temp.ok((select query_norm = 'motorchi' and zero_results = 2 from public.admin_search_insights() limit 1), 'admin: eng ko''p natijasiz qidiruv birinchi');

-- o'xshash vakansiyalar
select pg_temp.login('e2000000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'company');
insert into public.companies (name, created_by) values ('Qidiruv kafe', auth.uid());
insert into public.vacancies (owner_profile_id, company_id, title, category_id, subcategory_id, region_id, status)
select auth.uid(), co.id, t.title, c.id, s.id, r.id, 'draft'
from (values ('Ofitsiant'), ('Ofitsiantka'), ('Buxgalter')) t(title), public.companies co, public.categories c, public.subcategories s, public.regions r
where co.name = 'Qidiruv kafe' and c.slug = 'restaurant' and s.slug = 'waiter' and s.category_id = c.id and r.slug = 'tashkent_city';
select pg_temp.superuser();
update public.vacancies set status = 'active', published_at = now() where title = 'Ofitsiant';
select pg_temp.login('e2000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.similar_vacancies((select id from public.vacancies where title = 'Ofitsiantka'))) = 1, 'o''xshash: faol "Ofitsiant" topildi');
select pg_temp.ok((select count(*) from public.similar_vacancies((select id from public.vacancies where title = 'Buxgalter'))) = 0, 'o''xshash emas: Buxgalter');
select pg_temp.login('e2000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select * from public.similar_vacancies((select id from public.vacancies where title = 'Ofitsiantka'))$$, 'begona vakansiya bo''yicha so''rab bo''lmaydi', '42501');

-- firibgarlik belgisi: oldindan to'lov → moderatsiyaga (o'chirilmaydi)
select pg_temp.login('e2000000-0000-0000-0000-000000000001');
update public.vacancies set description = 'Ishga kirish uchun oldindan to''lov 200 ming' where title = 'Buxgalter';
select pg_temp.ok(public.publish_vacancy((select id from public.vacancies where title = 'Buxgalter')) = 'pending_review', 'oldindan to''lov → pending_review');
select pg_temp.superuser();
select pg_temp.ok((select moderation_note = 'auto:scam_words' from public.vacancies where title = 'Buxgalter'), 'avtomatik izoh: auto:scam_words');
select pg_temp.login('e2000000-0000-0000-0000-000000000001');
update public.vacancies set description = 'Tajribali buxgalter kerak, 1C bilishi shart' where title = 'Buxgalter';
select pg_temp.ok(public.publish_vacancy((select id from public.vacancies where title = 'Buxgalter')) = 'active', 'matn tuzatildi → active');
select pg_temp.superuser();
select pg_temp.ok((select moderation_note is null from public.vacancies where title = 'Buxgalter'), 'avtomatik izoh olib tashlandi');
select pg_temp.ok(public.vacancy_risk_flags('Кассир', 'Требуется предоплата за форму') = array['scam_words'], 'ruscha: предоплата');
select pg_temp.ok(cardinality(public.vacancy_risk_flags('Kassir', 'Oylik 5 mln, tushlik bepul')) = 0, 'oddiy matn: belgi yo''q');
-- maosh filtri kunlik maoshni oylikka keltirib solishtiradi (300 ming × 22 = 6,6 mln)
insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, status, published_at, salary_from, salary_type)
select 'e2000000-0000-0000-0000-000000000001', co.id, 'Kunlik yukchi', c.id, r.id, 'active', now(), 300000, 'daily'
from public.companies co, public.categories c, public.regions r where co.name = 'Qidiruv kafe' and c.slug = 'logistics' and r.slug = 'tashkent_city';
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.search_vacancies(p_query => 'yukchi', p_salary_min => 5000000)) = 1, 'kunlik 300 ming: oyiga 5 mln filtrida chiqadi');
select pg_temp.ok((select count(*) from public.search_vacancies(p_query => 'yukchi', p_salary_min => 7000000)) = 0, 'kunlik 300 ming: oyiga 7 mln filtrida chiqmaydi');
select pg_temp.superuser();

-- maosh tahlili: 5 tadan kam bo'lsa raqam bermaydi
select pg_temp.superuser();
insert into public.vacancies (owner_profile_id, company_id, title, category_id, subcategory_id, region_id, status, published_at, salary_from, salary_to)
select 'e2000000-0000-0000-0000-000000000001', co.id, 'Oshpaz ' || g, c.id, s.id, r.id, 'active', now(), 3000000 + g * 1000000, 4000000 + g * 1000000
from generate_series(1, 4) g, public.companies co, public.categories c, public.subcategories s, public.regions r
where co.name = 'Qidiruv kafe' and c.slug = 'restaurant' and s.slug = 'cook' and s.category_id = c.id and r.slug = 'tashkent_city';
select pg_temp.anon();
select pg_temp.ok((select sample_size = 4 and p50 is null from public.salary_insight((select id from public.subcategories where slug = 'cook'))), 'maosh: 4 ta e''lon — raqam berilmaydi');
select pg_temp.superuser();
insert into public.vacancies (owner_profile_id, company_id, title, category_id, subcategory_id, region_id, status, published_at, salary_from)
select 'e2000000-0000-0000-0000-000000000001', co.id, 'Oshpaz 5', c.id, s.id, r.id, 'active', now(), 9000000
from public.companies co, public.categories c, public.subcategories s, public.regions r
where co.name = 'Qidiruv kafe' and c.slug = 'restaurant' and s.slug = 'cook' and s.category_id = c.id and r.slug = 'tashkent_city';
select pg_temp.anon();
select pg_temp.ok((select sample_size = 5 and p25 <= p50 and p50 <= p75 and p50 = 6500000 from public.salary_insight((select id from public.subcategories where slug = 'cook'))), 'maosh: 5 ta e''lon — oraliq hisoblandi');

select pg_temp.superuser();
rollback;
\echo '✓ aqlli qidiruv testlari o''tdi'
