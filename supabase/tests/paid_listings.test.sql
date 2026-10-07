-- ISH.UZ · e'lonlar 10 kun: har tomon uchun 1 marta bepul, keyingisi 20 000 so'm; ko'rish bepul
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

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  execute 'set role service_role';
end $$;

begin;
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';
select pg_temp.ok(public.listings_paid() and not public.billing_enabled(), 'e''lonlar pullik, umumiy billing (TOP) o''chiq');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e9000000-0000-0000-0000-000000000001', '+998906000001', now(), '{"first_name":"Kafe","last_name":"Egasi"}'),
  ('e9000000-0000-0000-0000-000000000002', '+998906000002', now(), '{"first_name":"Ishchi","last_name":"Aziz"}');

-- ===== Ish beruvchi =====
select pg_temp.login('e9000000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'person');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), t, c.id, r.id from unnest(array['PL-Pishiriqchi-e9', 'PL-Ofitsiant-e9']) t, public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select pg_temp.ok((select public.vacancy_publish_quote(id) ->> 'mode' from public.vacancies where title = 'PL-Pishiriqchi-e9') = 'free_trial', 'birinchi vakansiya: bepul');
select public.publish_vacancy(id) from public.vacancies where title = 'PL-Pishiriqchi-e9';
select pg_temp.ok((select status = 'active' and expires_at between now() + interval '9 days 23 hours' and now() + interval '10 days 1 hour' from public.vacancies where title = 'PL-Pishiriqchi-e9'), 'birinchi vakansiya 10 kunga faol');
select pg_temp.ok((select public.vacancy_publish_quote(id) ->> 'mode' from public.vacancies where title = 'PL-Ofitsiant-e9') = 'payment_required', 'ikkinchisi pullik');
select pg_temp.ok((select (public.vacancy_publish_quote(id) ->> 'price')::int from public.vacancies where title = 'PL-Ofitsiant-e9') = 20000, 'narx 20 000 so''m');
select pg_temp.fails($$select public.publish_vacancy(id) from public.vacancies where title = 'PL-Ofitsiant-e9'$$, 'to''lovsiz ikkinchisini joylab bo''lmaydi', 'payment_required');
select pg_temp.ok((public.create_payment('vacancy_publish', (select id from public.vacancies where title = 'PL-Ofitsiant-e9')) ->> 'amount')::int = 20000, 'to''lov yaratiladi (umumiy billing o''chiq bo''lsa ham)');
select pg_temp.fails($$select public.create_payment('worker_promotion', null)$$, 'TOP uchun to''lov hali yopiq', 'billing_disabled');
select pg_temp.service();
select public.apply_payment_internal((select id from public.payments where vacancy_id = (select id from public.vacancies where title = 'PL-Ofitsiant-e9')));
select pg_temp.superuser();
select pg_temp.ok((select status = 'active' and expires_at > now() + interval '9 days' from public.vacancies where title = 'PL-Ofitsiant-e9'), 'to''lovdan keyin 10 kunga faol');

-- 10 kun o'tdi → avtomatik e'londan tushadi
update public.vacancies set expires_at = now() - interval '1 minute' where title = 'PL-Pishiriqchi-e9';
select public.expire_vacancies();
select pg_temp.ok((select status from public.vacancies where title = 'PL-Pishiriqchi-e9') = 'expired', 'muddati tugagan vakansiya avtomatik yopiladi');

-- ko'rish bepul: kirmagan foydalanuvchi ham faol vakansiyani ko'radi
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.search_vacancies_v2(p_query => 'PL-Ofitsiant-e9')) = 1, 'ko''rish va qidirish bepul (anon)');
select pg_temp.superuser();

-- ===== Ish qidiruvchi =====
select pg_temp.login('e9000000-0000-0000-0000-000000000002');
insert into public.worker_profiles (profile_id, listed_until) values (auth.uid(), now() + interval '1 year');
select pg_temp.ok((select listed_until is null from public.worker_profiles where profile_id = auth.uid()), 'listed_until ni o''zi yozolmaydi (insert)');
update public.worker_profiles set onboarding_completed_at = now(), is_public = true where profile_id = auth.uid();
select pg_temp.ok((select is_public and listed_until between now() + interval '9 days 23 hours' and now() + interval '10 days 1 hour' from public.worker_profiles where profile_id = auth.uid()), 'birinchi e''lon bepul — 10 kun qidiruvda');
update public.worker_profiles set listed_until = now() + interval '1 year' where profile_id = auth.uid();
select pg_temp.ok((select listed_until < now() + interval '11 days' from public.worker_profiles where profile_id = auth.uid()), 'listed_until ni o''zi uzaytirolmaydi');
select pg_temp.ok((select public.worker_listing_quote() ->> 'mode') = 'paid_window', 'holat: faol');

-- muddat tugadi → qidiruvdan chiqadi, xabar boradi
select pg_temp.superuser();
select set_config('ishuz.listing_internal', '1', true);
update public.worker_profiles set listed_until = now() - interval '1 minute' where profile_id = 'e9000000-0000-0000-0000-000000000002';
select set_config('ishuz.listing_internal', '', true);
select pg_temp.ok(public.expire_worker_listings() = 1, 'muddati tugagan e''lon qidiruvdan chiqarildi');
select pg_temp.ok((select not is_public from public.worker_profiles where profile_id = 'e9000000-0000-0000-0000-000000000002'), 'is_public = false');
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e9000000-0000-0000-0000-000000000002' and payload->>'kind' = 'listing_expired') = 1, 'xabar: e''lon muddati tugadi');

-- qayta yoqish: bepul allaqachon ishlatilgan → to'lov kerak
select pg_temp.login('e9000000-0000-0000-0000-000000000002');
select pg_temp.fails($$update public.worker_profiles set is_public = true where profile_id = auth.uid()$$, 'qayta qidiruvga chiqish pullik', 'listing_payment_required');
select pg_temp.ok((select (public.worker_listing_quote() ->> 'price')::int) = 20000 and (select public.worker_listing_quote() ->> 'mode') = 'payment_required', 'narx 20 000 so''m');
select pg_temp.ok((public.create_payment('worker_listing', public.current_worker_id()) ->> 'amount')::int = 20000, 'to''lov yaratildi');
select pg_temp.service();
select public.apply_payment_internal((select id from public.payments where purpose = 'worker_listing' and profile_id = 'e9000000-0000-0000-0000-000000000002'));
select pg_temp.superuser();
select pg_temp.ok((select is_public and listed_until > now() + interval '9 days' from public.worker_profiles where profile_id = 'e9000000-0000-0000-0000-000000000002'), 'to''lovdan keyin 10 kun qidiruvda');

-- ogohlantirish: 1 kun qolganda bir marta
select set_config('ishuz.listing_internal', '1', true);
update public.worker_profiles set listed_until = now() + interval '5 hours' where profile_id = 'e9000000-0000-0000-0000-000000000002';
select set_config('ishuz.listing_internal', '', true);
select public.expire_worker_listings();
select public.expire_worker_listings();
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'e9000000-0000-0000-0000-000000000002' and payload->>'kind' = 'listing_expiring') = 1, 'tugashidan oldin bir marta ogohlantiriladi');

-- profilni oddiy tahrirlash to'lov so'ramaydi
select pg_temp.login('e9000000-0000-0000-0000-000000000002');
update public.worker_profiles set headline = 'Oshpaz' where profile_id = auth.uid();
select pg_temp.ok((select headline = 'Oshpaz' from public.worker_profiles where profile_id = auth.uid()), 'oddiy tahrirlash bepul');

select pg_temp.superuser();
rollback;
\echo '✓ pullik e''lonlar testlari o''tdi'
