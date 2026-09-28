-- ISH.UZ · kasblar daraxti: yo'l, ko'chirish, sikl, avtomatik soha, ierarxik moslik, huquqlar
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
  ('e8000000-0000-0000-0000-000000000001', '+998908000001', now(), '{"first_name":"Kardio","last_name":"Jarroh"}'),
  ('e8000000-0000-0000-0000-000000000002', '+998908000002', now(), '{"first_name":"Uro","last_name":"Log"}'),
  ('e8000000-0000-0000-0000-000000000003', '+998908000003', now(), '{"first_name":"Klinika","last_name":"Egasi"}'),
  ('e8000000-0000-0000-0000-000000000009', null, null, '{"first_name":"Admin","last_name":"T"}');
insert into public.admin_users (profile_id, role) values ('e8000000-0000-0000-0000-000000000009', 'admin');

-- seed: chuqur yo'l va meros subcategory
select pg_temp.ok((select depth = 5 and effective_subcategory_id = (select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.slug = 'medicine' and s.slug = 'doctor')
  from public.profession_nodes where slug = 'medicine-pediatric-cardiac-surgeon'), 'chuqur tugun: depth 5, "doctor" meros');
select pg_temp.ok((select count(*) from public.search_profession_nodes('svarchik') where name_uz = 'Payvandchi') = 1, 'qidiruv: svarchik → Payvandchi');
select pg_temp.ok((select jsonb_array_length(trail) = 3 from public.search_profession_nodes('urolog-androlog') limit 1), 'qidiruv: yo''l (breadcrumb) qaytadi');

-- yangi tugunlar (superuser — seed kabi), ko'chirish va sikl
insert into public.profession_nodes (parent_id, category_id, slug, name_uz, name_ru)
select null, c.id, 't-root', 'Test ildiz', 'Тест корень' from public.categories c where c.slug = 'medicine';
insert into public.profession_nodes (parent_id, category_id, slug, name_uz, name_ru)
select (select id from public.profession_nodes where slug = 't-root'), c.id, 't-child', 'Test bola', 'Тест ребёнок' from public.categories c where c.slug = 'medicine';
insert into public.profession_nodes (parent_id, category_id, slug, name_uz, name_ru)
select (select id from public.profession_nodes where slug = 't-child'), c.id, 't-grand', 'Test nevara', 'Тест внук' from public.categories c where c.slug = 'medicine';
update public.profession_nodes set parent_id = (select id from public.profession_nodes where slug = 'medicine-doctors') where slug = 't-root';
select pg_temp.ok((select depth = 4 and path[1] = (select id from public.profession_nodes where slug = 'medicine-doctors') from public.profession_nodes where slug = 't-grand'), 'ko''chirish: nevara yo''li qayta hisoblandi');
select pg_temp.fails($$update public.profession_nodes set parent_id = (select id from public.profession_nodes where slug = 't-grand') where slug = 't-root'$$, 'sikl taqiqlangan', 'cycle_detected');

-- ishchi va vakansiya: tugun → category/subcategory avtomatik
insert into public.worker_profiles (profile_id, profession_node_id, region_id, status, is_public)
select 'e8000000-0000-0000-0000-000000000001', (select id from public.profession_nodes where slug = 'medicine-cardiac-surgeon'), r.id, 'active', true from public.regions r where r.slug = 'tashkent_city';
insert into public.worker_profiles (profile_id, profession_node_id, region_id, status, is_public)
select 'e8000000-0000-0000-0000-000000000002', (select id from public.profession_nodes where slug = 'medicine-urologist'), r.id, 'active', true from public.regions r where r.slug = 'tashkent_city';
select pg_temp.ok((select category_id = (select id from public.categories where slug = 'medicine') and subcategory_id is not null
  from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000001'), 'ishchi: soha va yo''nalish tugundan to''ldirildi');
insert into public.employer_profiles (profile_id, employer_type) values ('e8000000-0000-0000-0000-000000000003', 'company');
insert into public.companies (name, created_by) values ('Test klinika', 'e8000000-0000-0000-0000-000000000003');
insert into public.vacancies (owner_profile_id, company_id, title, profession_node_id, region_id, status, published_at)
select 'e8000000-0000-0000-0000-000000000003', co.id, 'Kardiojarroh kerak', (select id from public.profession_nodes where slug = 'medicine-cardiac-surgeon'), r.id, 'active', now()
from public.companies co, public.regions r where co.name = 'Test klinika' and r.slug = 'tashkent_city';
select pg_temp.ok((select category_id = (select id from public.categories where slug = 'medicine') from public.vacancies where title = 'Kardiojarroh kerak'), 'vakansiya: soha tugundan');

-- ierarxik moslik: kardiojarroh (aynan) > urolog (bir shox)
select pg_temp.ok((select reasons @> '[{"key":"profession_exact"}]' from public.compute_match(
  (select id from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000001'), (select id from public.vacancies where title = 'Kardiojarroh kerak'))), 'moslik: aynan kasb');
select pg_temp.ok((select reasons @> '[{"key":"profession_related"}]' from public.compute_match(
  (select id from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000002'), (select id from public.vacancies where title = 'Kardiojarroh kerak'))), 'moslik: urolog — o''xshash yo''nalish (to''liq emas)');
select pg_temp.ok((select a.score - b.score = 13 from
  public.compute_match((select id from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000001'), (select id from public.vacancies where title = 'Kardiojarroh kerak')) a,
  public.compute_match((select id from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000002'), (select id from public.vacancies where title = 'Kardiojarroh kerak')) b), 'moslik: farq 13 ball');
-- qo'shimcha kasb: urologga kardiojarrohlik qo'shilsa — aynan mos
insert into public.worker_professions (worker_id, node_id)
select id, (select id from public.profession_nodes where slug = 'medicine-cardiac-surgeon') from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000002';
select pg_temp.ok((select reasons @> '[{"key":"profession_exact"}]' from public.compute_match(
  (select id from public.worker_profiles where profile_id = 'e8000000-0000-0000-0000-000000000002'), (select id from public.vacancies where title = 'Kardiojarroh kerak'))), 'moslik: qo''shimcha kasb hisobga olinadi');

-- ishlatilayotgan tugunni o'chirib bo'lmaydi
select pg_temp.fails($$delete from public.profession_nodes where slug = 'medicine-cardiac-surgeon'$$, 'ishlatilgan tugun o''chmaydi', 'node_in_use');

-- huquqlar: anon o'qiydi va qidiradi, yoza olmaydi; oddiy foydalanuvchi ham yoza olmaydi; admin yozadi
select pg_temp.anon();
select pg_temp.ok((select count(*) > 500 from public.profession_nodes), 'anon: daraxtni o''qiydi');
select pg_temp.ok((select count(*) > 0 from public.search_profession_nodes('urolog')), 'anon: qidiradi');
select pg_temp.fails($$insert into public.profession_nodes (category_id, slug, name_uz, name_ru) select id, 'x-anon', 'Xx', 'Xx' from public.categories limit 1$$, 'anon yoza olmaydi', '42501');
select pg_temp.login('e8000000-0000-0000-0000-000000000003');
select pg_temp.fails($$insert into public.profession_nodes (category_id, slug, name_uz, name_ru) select id, 'x-user', 'Xx', 'Xx' from public.categories limit 1$$, 'foydalanuvchi yoza olmaydi', '42501');
select pg_temp.fails($$select public.admin_merge_profession_node((select id from public.profession_nodes where slug = 't-grand'), (select id from public.profession_nodes where slug = 't-child'))$$, 'birlashtirish faqat admin', '42501');
select pg_temp.login('e8000000-0000-0000-0000-000000000009');
insert into public.profession_nodes (parent_id, category_id, slug, name_uz, name_ru)
select (select id from public.profession_nodes where slug = 't-child'), c.id, 't-admin', 'Admin tuguni', 'Узел админа' from public.categories c where c.slug = 'medicine';
select pg_temp.ok((select depth = 4 from public.profession_nodes where slug = 't-admin'), 'admin: tugun qo''shadi');
select public.admin_merge_profession_node((select id from public.profession_nodes where slug = 't-admin'), (select id from public.profession_nodes where slug = 't-grand'));
select pg_temp.ok((select not is_active from public.profession_nodes where slug = 't-admin') and (select 'Admin tuguni' = any(aliases) from public.profession_nodes where slug = 't-grand'), 'birlashtirish: eski tugun nofaol, nomi sinonim bo''ldi');
select pg_temp.ok((select count(*) >= 2 from public.audit_logs where action like 'profession.%'), 'admin o''zgarishlari audit logda');

select pg_temp.superuser();
rollback;
\echo '✓ kasblar daraxti testlari o''tdi'
