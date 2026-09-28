-- ISH.UZ · saqlangan qidiruvlar: RLS, limit, yangi vakansiya hisobi, kunlik xabar
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
  ('e3000000-0000-0000-0000-000000000001', '+998904000001', now(), '{"first_name":"Ishchi","last_name":"A"}'),
  ('e3000000-0000-0000-0000-000000000002', '+998904000002', now(), '{"first_name":"Boshqa","last_name":"B"}'),
  ('e3000000-0000-0000-0000-000000000003', '+998904000003', now(), '{"first_name":"Kafe","last_name":"C"}');

-- ishchi qidiruvni saqlaydi
select pg_temp.login('e3000000-0000-0000-0000-000000000001');
insert into public.saved_searches (profile_id, label, query_string, category_id, region_id, salary_min)
select auth.uid(), 'Oshpaz · Toshkent', 'category=restaurant&region=tashkent_city', c.id, r.id, 4000000
from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.my_saved_searches()) = 1, 'o''z qidiruvini ko''radi');
select pg_temp.fails($$insert into public.saved_searches (profile_id, label, query_string) values ('e3000000-0000-0000-0000-000000000002', 'x', 'q=x')$$, 'boshqa odam nomidan saqlab bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.saved_searches (profile_id, label, query_string) values (auth.uid(), 'Takror', 'category=restaurant&region=tashkent_city')$$, 'bir xil qidiruv ikki marta saqlanmaydi', '23505');
insert into public.saved_searches (profile_id, label, query_string) select auth.uid(), 'q' || g, 'q=' || g from generate_series(1, 19) g;
select pg_temp.fails($$insert into public.saved_searches (profile_id, label, query_string) values (auth.uid(), 'ortiqcha', 'q=21')$$, '20 tadan ortiq saqlab bo''lmaydi', 'saved_search_limit');
delete from public.saved_searches where query_string like 'q=%';

select pg_temp.login('e3000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.saved_searches) = 0, 'begona qidiruvlar ko''rinmaydi');
select pg_temp.ok((select count(*) from public.my_saved_searches()) = 0, 'my_saved_searches faqat o''zinikini');
select pg_temp.fails($$select public.run_saved_search_alerts()$$, 'cron funksiyasi foydalanuvchiga yopiq', '42501');

-- yangi vakansiyalar: mos (Toshkent, oshpaz, 5 mln), mos emas (maosh past), mos emas (boshqa soha)
select pg_temp.superuser();
insert into public.vacancies (owner_profile_id, title, category_id, region_id, status, published_at, salary_from, salary_type)
select 'e3000000-0000-0000-0000-000000000003', t.title, c.id, r.id, 'active', now(), t.sal, t.st::public.salary_type
from (values ('Oshpaz', 'restaurant', 5000000, 'monthly'), ('Kunlik oshpaz', 'restaurant', 250000, 'daily'), ('Arzon oshpaz', 'restaurant', 2000000, 'monthly'), ('Kassir', 'sales', 6000000, 'monthly')) t(title, cat, sal, st)
join public.categories c on c.slug = t.cat, public.regions r where r.slug = 'tashkent_city';
update public.saved_searches set last_checked_at = now() - interval '1 day' where profile_id = 'e3000000-0000-0000-0000-000000000001';

select pg_temp.login('e3000000-0000-0000-0000-000000000001');
select pg_temp.ok((select new_count from public.my_saved_searches()) = 2, 'yangi: 2 ta (oylik 5 mln + kunlik 250 ming×22)');
select pg_temp.superuser();
select pg_temp.ok(public.run_saved_search_alerts() = 1, 'kunlik xabar: 1 ta bildirishnoma');
select pg_temp.ok((select payload->>'count' = '2' and link like '/jobs?category=restaurant%' from public.notifications where profile_id = 'e3000000-0000-0000-0000-000000000001' and payload->>'kind' = 'saved_search'), 'bildirishnoma: soni va havola');
select pg_temp.ok(public.run_saved_search_alerts() = 0, 'qayta ishga tushsa takror yubormaydi');

-- ko'rildi deb belgilash: faqat o'ziniki
update public.saved_searches set last_checked_at = now() - interval '3 days';
select pg_temp.login('e3000000-0000-0000-0000-000000000002');
select public.mark_saved_search_seen((select id from public.my_saved_searches() limit 1));
select public.mark_saved_search_seen('00000000-0000-0000-0000-000000000000');
select pg_temp.superuser();
select pg_temp.ok((select last_checked_at < now() - interval '2 days' from public.saved_searches where profile_id = 'e3000000-0000-0000-0000-000000000001'), 'begona foydalanuvchi belgilay olmaydi');
select pg_temp.login('e3000000-0000-0000-0000-000000000001');
select public.mark_saved_search_seen((select id from public.my_saved_searches() limit 1));
select pg_temp.ok((select new_count from public.my_saved_searches()) = 0, 'o''zi ochdi → yangi hisoblagich 0');

select pg_temp.superuser();
rollback;
\echo '✓ saqlangan qidiruv testlari o''tdi'
