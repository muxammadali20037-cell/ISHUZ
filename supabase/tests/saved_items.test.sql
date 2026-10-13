-- 0061 · "Saqlanganlar" hamma uchun: profilsiz ham saqlash, faqat o'zinikini ko'rish/o'chirish, mehmon yo'q,
--        bloklangan yozmaydi, 500 chegarasi, ro'yxat funksiyalari faqat ko'rinadigan e'lonlarni qaytaradi, eski jadvallar ham qo'shiladi
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal1', 'iat', extract(epoch from now())::bigint + 5)::text, false);
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

-- A — ish izlovchi (profil to'ldirmagan), B — ish beruvchi (profil to'ldirmagan), C — boshqa odam, E — e'lon egasi, W — ishchi
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('61000000-0000-0000-0000-00000000000a', '+998907610001', now(), '{"first_name":"Aziz"}'),
  ('61000000-0000-0000-0000-00000000000b', '+998907610002', now(), '{"first_name":"Bobur"}'),
  ('61000000-0000-0000-0000-00000000000c', '+998907610003', now(), '{"first_name":"Charos"}'),
  ('61000000-0000-0000-0000-00000000000e', '+998907610004', now(), '{"first_name":"Erkin"}'),
  ('61000000-0000-0000-0000-000000000077', '+998907610005', now(), '{"first_name":"Vali","last_name":"Karimov"}');

create temp table fx on commit drop as
select (select id from public.regions where slug = 'tashkent_city') as region,
       (select id from public.profession_nodes where selectable and is_active order by depth limit 1) as node;
grant select on fx to authenticated, anon;

insert into public.vacancies (id, owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
select v.id, '61000000-0000-0000-0000-00000000000e', v.title, fx.region, 'Sinov e''loni: ish joyi va shartlar', v.status::public.vacancy_status, fx.node, 3000000, 'monthly', now(), now() + interval '10 days'
from fx, (values ('61000000-0000-0000-0000-0000000000f1'::uuid, 'Faol e''lon', 'active'), ('61000000-0000-0000-0000-0000000000f2'::uuid, 'Yopilgan e''lon', 'closed')) as v(id, title, status);

insert into public.worker_profiles (id, profile_id, headline, region_id, is_public, onboarding_completed_at, status)
select '61000000-0000-0000-0000-0000000000d1', '61000000-0000-0000-0000-000000000077', 'Haydovchi', region, true, now(), 'active' from fx;

-- ---------- A: profilsiz ish izlovchi vakansiyani saqlaydi ----------
select pg_temp.login('61000000-0000-0000-0000-00000000000a');
insert into public.saved_items (profile_id, vacancy_id) values ('61000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000f1');
insert into public.saved_items (profile_id, vacancy_id) values ('61000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000f2');
select pg_temp.ok((select count(*) from public.saved_items) = 2, 'profilsiz ish izlovchi ham saqlaydi (ishchi profili shart emas)');
select pg_temp.fails($$insert into public.saved_items (profile_id, vacancy_id) values ('61000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000f1')$$, 'bir e''lon ikki marta saqlanmaydi', '23505');
select pg_temp.ok((select count(*) from public.my_saved_vacancies()) = 1, 'ro''yxatda faqat faol e''lon (yopilgani ko''rinmaydi)');
select pg_temp.ok((select title from public.my_saved_vacancies()) = 'Faol e''lon', 'ro''yxatdagi e''lon to''g''ri');
select pg_temp.ok((select employer_name from public.my_saved_vacancies()) = 'Erkin', 'ish beruvchi nomi (profil ismidan)');
select pg_temp.fails($$insert into public.saved_items (profile_id, vacancy_id) values ('61000000-0000-0000-0000-00000000000c', '61000000-0000-0000-0000-0000000000f1')$$, 'boshqa odam nomidan saqlab bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.saved_items (profile_id, vacancy_id, worker_id) values ('61000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000f1', '61000000-0000-0000-0000-0000000000d1')$$, 'bitta yozuvda ikkita narsa — yo''q', '23514');
select pg_temp.fails($$insert into public.saved_items (profile_id) values ('61000000-0000-0000-0000-00000000000a')$$, 'bo''sh yozuv — yo''q', '23514');
select pg_temp.fails($$update public.saved_items set created_at = now() - interval '1 day'$$, 'tahrirlash huquqi yo''q', '42501');

-- ---------- B: profilsiz ish beruvchi ishchini saqlaydi ----------
select pg_temp.login('61000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.saved_items) = 0, 'boshqaning saqlanganlari ko''rinmaydi');
select pg_temp.ok((select count(*) from public.my_saved_vacancies()) = 0, 'ro''yxat funksiyasi ham faqat o''zinikini');
delete from public.saved_items where profile_id = '61000000-0000-0000-0000-00000000000a';
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.saved_items where profile_id = '61000000-0000-0000-0000-00000000000a') = 2, 'boshqaning saqlanganini o''chirib bo''lmaydi');
select pg_temp.login('61000000-0000-0000-0000-00000000000b');
insert into public.saved_items (profile_id, worker_id) values ('61000000-0000-0000-0000-00000000000b', '61000000-0000-0000-0000-0000000000d1');
select pg_temp.ok((select count(*) from public.my_saved_workers()) = 1, 'profilsiz ish beruvchi ishchini saqlaydi va ro''yxatda ko''radi');
select pg_temp.ok((select first_name || ' ' || last_initial from public.my_saved_workers()) = 'Vali K', 'ishchi kartasi: ism va familiya bosh harfi');
select pg_temp.superuser();
update public.worker_profiles set is_public = false where id = '61000000-0000-0000-0000-0000000000d1';
select pg_temp.login('61000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.my_saved_workers()) = 0, 'yashirilgan ishchi ro''yxatda ko''rinmaydi');
select pg_temp.superuser();
update public.worker_profiles set is_public = true where id = '61000000-0000-0000-0000-0000000000d1';

-- ---------- eski jadvallar ham qo'shiladi ----------
-- saved_workers ish beruvchi profilini talab qiladi (RLS) — tayyorlash superuser bilan
insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
values ('61000000-0000-0000-0000-00000000000c', 'person', 'Charos opa', now());
insert into public.saved_workers (employer_profile_id, worker_id) values ('61000000-0000-0000-0000-00000000000c', '61000000-0000-0000-0000-0000000000d1');
select pg_temp.login('61000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.my_saved_workers()) = 1, 'eski saved_workers yozuvi ham ro''yxatda');
insert into public.saved_items (profile_id, worker_id) values ('61000000-0000-0000-0000-00000000000c', '61000000-0000-0000-0000-0000000000d1');
select pg_temp.ok((select count(*) from public.my_saved_workers()) = 1, 'ikkala jadvalda bo''lsa ham bitta karta');

-- ---------- mehmon ----------
select pg_temp.anon();
select pg_temp.fails($$select count(*) from public.saved_items$$, 'mehmon jadvalni o''qiy olmaydi', '42501');
select pg_temp.fails($$insert into public.saved_items (profile_id, vacancy_id) values ('61000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000f1')$$, 'mehmon yoza olmaydi', '42501');
select pg_temp.fails($$select * from public.my_saved_vacancies()$$, 'mehmon ro''yxat funksiyasini chaqira olmaydi', '42501');
select pg_temp.fails($$select * from public.my_saved_workers()$$, 'mehmon ishchilar ro''yxatini chaqira olmaydi', '42501');

-- ---------- bloklangan foydalanuvchi ----------
select pg_temp.superuser();
update public.profiles set is_blocked = true where id = '61000000-0000-0000-0000-00000000000b';
select pg_temp.login('61000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$insert into public.saved_items (profile_id, vacancy_id) values ('61000000-0000-0000-0000-00000000000b', '61000000-0000-0000-0000-0000000000f1')$$, 'bloklangan foydalanuvchi saqlay olmaydi', '42501');
select pg_temp.superuser();
update public.profiles set is_blocked = false where id = '61000000-0000-0000-0000-00000000000b';

-- ---------- o'chirish va bog'liq yozuvlar ----------
select pg_temp.login('61000000-0000-0000-0000-00000000000a');
delete from public.saved_items where vacancy_id = '61000000-0000-0000-0000-0000000000f2';
select pg_temp.ok((select count(*) from public.saved_items) = 1, 'o''zinikini o''chiradi');
select pg_temp.superuser();
delete from public.vacancies where id = '61000000-0000-0000-0000-0000000000f1';
select pg_temp.ok((select count(*) from public.saved_items where profile_id = '61000000-0000-0000-0000-00000000000a') = 0, 'e''lon o''chsa — saqlangani ham o''chadi');

-- ---------- 500 chegarasi ----------
insert into public.vacancies (owner_profile_id, title, region_id, description, status, published_at, expires_at)
select '61000000-0000-0000-0000-00000000000e', 'Chegara ' || g, fx.region, 'Sinov e''loni: chegara tekshiruvi', 'active', now(), now() + interval '10 days'
from fx, generate_series(1, 501) g;
insert into public.saved_items (profile_id, vacancy_id)
select '61000000-0000-0000-0000-00000000000a', v.id from public.vacancies v where v.title like 'Chegara %' order by v.title limit 500;
select pg_temp.login('61000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$insert into public.saved_items (profile_id, vacancy_id) select '61000000-0000-0000-0000-00000000000a', v.id from public.vacancies v where v.title like 'Chegara %' and not exists (select 1 from public.saved_items s where s.vacancy_id = v.id) limit 1$$, '500 tadan ortiq saqlab bo''lmaydi', 'saved_limit');

select pg_temp.superuser();
select pg_temp.ok(public.simple_listing_features() @> '{"saved_items": true}', 'imkoniyat bayrog''i: saved_items');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.trg_saved_items_limit()', 'execute'), 'trigger funksiyasini to''g''ridan-to''g''ri chaqirib bo''lmaydi');

rollback;
