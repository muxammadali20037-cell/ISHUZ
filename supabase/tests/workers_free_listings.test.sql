-- 0094: ega qarori (2026-11-28) — ish beruvchi vakansiya joylash va ishchi raqamini ochish uchun to'laydi, TOP — ixtiyoriy;
-- ishchi (ish izlovchi) e'loni bepul. listings_paid = true bo'lsa ham worker_listings_paid (sukut — false) yoqilmaguncha
-- ishchi e'loni to'lovsiz qidiruvga chiqadi; vakansiya esa to'lov talab qiladi.
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

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  execute 'set role service_role';
end $$;

begin;
update public.app_settings set value = 'false'::jsonb where key in ('worker_phone_required', 'moderation_enabled', 'employer_verification_required');
update public.app_settings set value = 'true'::jsonb where key = 'listings_paid';
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';
select pg_temp.ok((select value = 'false'::jsonb from public.app_settings where key = 'worker_listings_paid'), 'sozlama bor: worker_listings_paid = false (sukut)');
select pg_temp.ok(public.listings_paid() and not public.worker_listings_paid(), 'vakansiya pullik, ishchi e''loni bepul');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e9400000-0000-0000-0000-000000000001', '+998906400001', now(), '{"first_name":"Kafe","last_name":"Egasi"}'),
  ('e9400000-0000-0000-0000-000000000002', '+998906400002', now(), '{"first_name":"Ishchi","last_name":"Aziz"}');

-- ish beruvchi: vakansiya — to'lov kerak
select pg_temp.login('e9400000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'person');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'WF-Oshpaz-e94', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select pg_temp.ok((select public.vacancy_publish_quote(id) ->> 'mode' from public.vacancies where title = 'WF-Oshpaz-e94') = 'payment_required', 'vakansiya: to''lov kerak');
select pg_temp.fails($$select public.publish_vacancy(id) from public.vacancies where title = 'WF-Oshpaz-e94'$$, 'vakansiyani to''lovsiz joylab bo''lmaydi', 'payment_required');
select pg_temp.ok((public.create_payment('vacancy_publish', (select id from public.vacancies where title = 'WF-Oshpaz-e94')) ->> 'amount')::int > 0, 'vakansiya uchun to''lov yaratiladi');
select pg_temp.superuser();

-- ishchi: e'lon bepul — to'lovsiz qidiruvga chiqadi
select pg_temp.login('e9400000-0000-0000-0000-000000000002');
insert into public.worker_profiles (profile_id) values (auth.uid());
update public.worker_profiles set onboarding_completed_at = now(), is_public = true where profile_id = auth.uid();
select pg_temp.ok((select is_public from public.worker_profiles where profile_id = auth.uid()), 'ishchi e''loni to''lovsiz qidiruvda');
select pg_temp.ok((select public.worker_listing_quote() ->> 'mode') = 'free', 'ishchi narx so''rovi: bepul');
select pg_temp.ok((select public.my_listing_state('worker', public.current_worker_id()) ->> 'state') = 'listed', 'ishchi holati: e''londa');
-- oddiy (bepul) ishchi e'loni uchun to'lov ochilmaydi (to'lov o'chiq)
select pg_temp.fails($$select public.create_payment('worker_listing', public.current_worker_id())$$, 'bepul ishchi e''loniga to''lov yo''q', 'billing_disabled');
select pg_temp.superuser();

-- ommaviy tariflar sahifasi: ikkala bayroq alohida
select pg_temp.anon();
select pg_temp.ok((select (j ->> 'listings_paid')::boolean and not (j ->> 'worker_listings_paid')::boolean from (select public.public_tariffs() j) x), 'tariflar: vakansiya pullik, ishchi bepul');
select pg_temp.fails($$select public.worker_listings_paid()$$, 'yangi funksiya anon uchun yopiq', '42501');
select pg_temp.superuser();

-- ega keyin ishchini ham pullik qilsa — avvalgi (0043) qoida qaytadi
update public.app_settings set value = 'true'::jsonb where key = 'worker_listings_paid';
select pg_temp.ok(public.worker_listings_paid(), 'worker_listings_paid = true — ishchi e''loni pullik');
select pg_temp.login('e9400000-0000-0000-0000-000000000002');
select pg_temp.ok((select public.worker_listing_quote() ->> 'mode') <> 'free', 'pullik rejimda narx so''rovi bepul emas');
select pg_temp.superuser();

rollback;
\echo '✓ ishchi e''loni bepul, vakansiya pullik (0094) testlari o''tdi'
