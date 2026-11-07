-- 0074 · Aloqa maxfiyligi: ro'yxatlarda telefon yo'q, e'lon sahifasida — faqat kirgan va limit ichida,
-- telegram_accounts.phone foydalanuvchi sessiyasidan (admin rollari ham) o'qilmaydi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end $$;
-- superuser sifatida, lekin auth.uid() = p_user (ichki funksiyani to'g'ridan-to'g'ri sinash uchun)
create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false); end $$;
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

-- V: ko'ruvchi · O: e'lon egasi · S: support admin · A: users.contacts huquqli admin
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('c7400000-0000-0000-0000-00000000000a', '+998909740001', now(), '{"first_name":"Vali","last_name":"V"}'),
  ('c7400000-0000-0000-0000-00000000000b', '+998909740002', now(), '{"first_name":"Olim","last_name":"O"}'),
  ('c7400000-0000-0000-0000-00000000000c', '+998909740003', now(), '{"first_name":"Sardor","last_name":"S"}'),
  ('c7400000-0000-0000-0000-00000000000d', '+998909740004', now(), '{"first_name":"Anvar","last_name":"A"}');
insert into public.admin_users (profile_id, role) values
  ('c7400000-0000-0000-0000-00000000000c', 'support'),
  ('c7400000-0000-0000-0000-00000000000d', 'admin');
insert into public.telegram_accounts (telegram_user_id, profile_id, username, phone, phone_shared_at) values
  (974000001, 'c7400000-0000-0000-0000-00000000000b', 'olim_o', '+998909740002', now());

-- ===== 1. telegram_accounts: telefon ustuni sessiyadan yopiq =====
select pg_temp.login('c7400000-0000-0000-0000-00000000000b');
select pg_temp.ok((select username from public.telegram_accounts where profile_id = auth.uid()) = 'olim_o', 'egasi o''z Telegram nomini o''qiydi');
select pg_temp.fails($$select phone from public.telegram_accounts$$, 'egasi ham telefon ustunini sessiyadan o''qimaydi (faqat server kaliti)', '42501');
select pg_temp.login('c7400000-0000-0000-0000-00000000000c');
select pg_temp.fails($$select phone from public.telegram_accounts$$, 'support admin Telegram telefonini o''qimaydi', '42501');
select pg_temp.fails($$select * from public.telegram_accounts$$, 'select * ham telefon ustuni tufayli rad etiladi', '42501');
select pg_temp.ok((select count(*) from public.telegram_accounts where username = 'olim_o') = 1, 'admin telefonsiz ustunlarni ko''radi (foydalanuvchi kartasi buzilmaydi)');
select pg_temp.anon();
select pg_temp.fails($$select username from public.telegram_accounts$$, 'mehmon jadvalni umuman o''qimaydi', '42501');

-- ===== 2. ro'yxatlar telefon qaytarmaydi (hech kimga) =====
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_vacancies(p_limit => 50, p_offset => 0) where phone is not null) = 0, 'anon: vakansiyalar ro''yxatida telefon yo''q');
select pg_temp.ok((select count(*) from public.simple_search_workers(p_limit => 50, p_offset => 0) where phone is not null) = 0, 'anon: ishchilar ro''yxatida telefon yo''q');
select pg_temp.login('c7400000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.simple_search_vacancies_v3(p_limit => 50, p_offset => 0) where phone is not null) = 0, 'kirgan: v3 ro''yxatida ham telefon yo''q');
select pg_temp.ok((select count(*) from public.simple_search_workers_v2(p_limit => 50, p_offset => 0) where phone is not null) = 0, 'kirgan: ishchilar v2 ro''yxatida ham telefon yo''q');

-- ===== 3. ichki limit funksiyasi to'g'ridan-to'g'ri chaqirilmaydi =====
select pg_temp.login('c7400000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.contact_reveal_allowed('vacancy', gen_random_uuid(), null)$$, 'contact_reveal_allowed sessiyadan chaqirilmaydi', '42501');
select pg_temp.fails($$select * from public.contact_reveals$$, 'contact_reveals jurnali sessiyadan o''qilmaydi', '42501');

-- ===== 4. limit: soatiga 40 ta turli e'lon =====
select pg_temp.superuser();
select pg_temp.anon();
select pg_temp.superuser();
select pg_temp.ok((select public.contact_reveal_allowed('vacancy', gen_random_uuid(), null) is false), 'mehmon (auth.uid() yo''q) — rad');
select pg_temp.as_user('c7400000-0000-0000-0000-00000000000a');
create temp table targets on commit drop as select gen_random_uuid() as id, g from generate_series(1, 41) g;
select pg_temp.ok((select bool_and(public.contact_reveal_allowed('vacancy', t.id, null)) from (select id from targets where g <= 40 order by g) t), '40 ta turli e''lon — ruxsat');
select pg_temp.ok((select count(*) from public.contact_reveals where viewer_profile_id = 'c7400000-0000-0000-0000-00000000000a') = 40, 'har biri jurnalga yozildi');
select pg_temp.ok((select public.contact_reveal_allowed('vacancy', (select id from targets where g = 41), null) is false), '41-chi turli e''lon bir soat ichida — rad');
select pg_temp.ok((select public.contact_reveal_allowed('vacancy', (select id from targets where g = 1), null)), 'avval ochilgan e''lonni qayta ko''rish limitni sarflamaydi');
select pg_temp.ok((select public.contact_reveal_allowed('worker', gen_random_uuid(), 'c7400000-0000-0000-0000-00000000000a')), 'o''z e''loni — limitdan tashqari');
select pg_temp.as_user('c7400000-0000-0000-0000-00000000000d');
select pg_temp.ok((select public.contact_reveal_allowed('worker', gen_random_uuid(), null)), 'users.contacts huquqli admin — limitdan tashqari');
select pg_temp.ok((select count(*) from public.contact_reveals where viewer_profile_id = 'c7400000-0000-0000-0000-00000000000d') = 0, 'admin ko''rishi limit jurnaliga yozilmaydi');

-- soat o'tdi, lekin sutkalik 150 limit
select pg_temp.superuser();
update public.contact_reveals set revealed_at = now() - interval '2 hours' where viewer_profile_id = 'c7400000-0000-0000-0000-00000000000a';
select pg_temp.as_user('c7400000-0000-0000-0000-00000000000a');
select pg_temp.ok((select public.contact_reveal_allowed('vacancy', (select id from targets where g = 41), null)), 'bir soatdan keyin yana ruxsat');
select pg_temp.superuser();
insert into public.contact_reveals (viewer_profile_id, target_kind, target_id, revealed_at)
select 'c7400000-0000-0000-0000-00000000000a', 'worker', gen_random_uuid(), now() - interval '3 hours' from generate_series(1, 109);
select pg_temp.as_user('c7400000-0000-0000-0000-00000000000a');
select pg_temp.ok((select public.contact_reveal_allowed('worker', gen_random_uuid(), null) is false), 'sutkasiga 150 ta turli e''lon — keyingisi rad');

-- ===== 5. bloklangan foydalanuvchi raqam olmaydi =====
select pg_temp.superuser();
update public.profiles set is_blocked = true where id = 'c7400000-0000-0000-0000-00000000000b';
select pg_temp.as_user('c7400000-0000-0000-0000-00000000000b');
select pg_temp.ok((select public.contact_reveal_allowed('vacancy', gen_random_uuid(), null) is false), 'bloklangan foydalanuvchi — rad');

-- ===== 6. eski yozuvlarni tozalash =====
select pg_temp.superuser();
update public.contact_reveals set revealed_at = now() - interval '31 days' where viewer_profile_id = 'c7400000-0000-0000-0000-00000000000a' and target_kind = 'worker';
select pg_temp.ok((select public.purge_contact_reveals()) >= 109, '30 kundan eski yozuvlar tozalanadi');

rollback;
\echo '✓ contact_privacy'
