-- 0080 · Tariflar: Oddiy · Tezkor · Maksimal. Daraja oshgani sari: uzoqroq muddat, qidiruvda TOP, ishchida — AI PRO.
--        E'lon joylash bepul bo'lsa ham (prod holati) Tezkor/Maksimal — faol e'lonni kuchaytiradi; narx serverda,
--        birinchi to'lov chegirmasi bilan; noto'g'ri daraja / begona e'lon / mehmon — rad; Payme ham daraja bilan ishlaydi
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
create or replace function pg_temp.near(p_ts timestamptz, p_days int) returns boolean language sql as $$
  select p_ts between now() + make_interval(days => p_days) - interval '1 minute' and now() + make_interval(days => p_days) + interval '1 minute';
$$;

begin;
-- prod holati: e'lon joylash bepul, to'lovlar (billing) o'chiq; aksiya chegirmasi amalda
update public.app_settings set value = 'false'::jsonb where key in ('worker_phone_required', 'moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'ai_alerts_paid', 'listings_paid', 'billing_enabled');
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';
update public.app_settings set value = to_jsonb((now() + interval '30 days')::text) where key = 'listing_discount_until';
update public.app_settings set value = '50'::jsonb where key = 'listing_discount_percent';

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('80000000-0000-0000-0000-00000000000e', '+998908000001', now(), '{"first_name":"Ish beruvchi"}'),
  ('80000000-0000-0000-0000-00000000000a', '+998908000002', now(), '{"first_name":"Ishchi"}'),
  ('80000000-0000-0000-0000-00000000000c', '+998908000003', now(), '{"first_name":"Begona"}');
insert into public.wallets (profile_id, balance) values
  ('80000000-0000-0000-0000-00000000000e', 300000), ('80000000-0000-0000-0000-00000000000a', 100000);

-- ===== ochiq ma'lumot: narxlar o'sib boradi =====
select pg_temp.anon();
create temp table pt as select public.public_tariffs() as j;
select pg_temp.ok((select (j #>> '{vacancy,0,price}')::int = 30000 and (j #>> '{vacancy,1,price}')::int = 49000 and (j #>> '{vacancy,2,price}')::int = 99000 from pt),
  'vakansiya: 30 000 · 49 000 · 99 000 (Oddiy narxi 50 000 dan pasaytirildi)');
select pg_temp.ok((select (j #>> '{worker,0,price}')::int = 5000 and (j #>> '{worker,1,price}')::int = 12000 and (j #>> '{worker,2,price}')::int = 19000 from pt),
  'ishchi: 5 000 · 12 000 · 19 000 (Oddiy 10 000 dan pasaytirildi)');
select pg_temp.ok((select (j #>> '{vacancy,0,days}')::int < (j #>> '{vacancy,1,days}')::int and (j #>> '{vacancy,1,days}')::int < (j #>> '{vacancy,2,days}')::int
  and (j #>> '{vacancy,0,top_days}')::int = 0 and (j #>> '{vacancy,1,top_days}')::int < (j #>> '{vacancy,2,top_days}')::int from pt), 'daraja oshgani sari muddat va TOP ko''payadi');
select pg_temp.ok((select (j #>> '{worker,2,ai_days}')::int = 30 and (j #>> '{worker,1,ai_days}')::int = 0 from pt), 'ishchi Maksimal — 30 kun AI PRO');
select pg_temp.ok((select not (j ->> 'listings_paid')::boolean and (j ->> 'tariffs_enabled')::boolean from pt), 'joylash bepul, tariflar yoqilgan');
select pg_temp.fails($$select public.create_payment('vacancy_publish', gen_random_uuid(), 'boost')$$, 'mehmon to''lov yarata olmaydi', '42501');
select pg_temp.fails($$select public.wallet_pay('vacancy_publish', gen_random_uuid(), 'boost')$$, 'mehmon balansdan to''lay olmaydi', '42501');

-- ===== ish beruvchi: bepul joylangan vakansiya → Tezkor =====
select pg_temp.login('80000000-0000-0000-0000-00000000000e');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'person');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'T80-Sotuvchi', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select public.publish_vacancy(id) from public.vacancies where title = 'T80-Sotuvchi';
select pg_temp.ok((select status = 'active' and pg_temp.near(paid_until, 10) and not is_featured from public.vacancies where title = 'T80-Sotuvchi'), 'bepul joylandi: 10 kun, TOP yo''q');
create temp table q as select public.vacancy_publish_quote(id) as j from public.vacancies where title = 'T80-Sotuvchi';
select pg_temp.ok((select j ->> 'mode' in ('free', 'paid_window') and jsonb_array_length(j -> 'tiers') = 3 and (j #>> '{tiers,1,price}')::int = 24500 and (j #>> '{tiers,1,full_price}')::int = 49000 from q),
  'narx so''rovi: 3 daraja, Tezkor birinchi to''lovda 24 500 (−50%)');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'T80-Qoralama', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select pg_temp.fails($$select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Qoralama'), 'basic')$$, 'joylash bepul — Oddiy uchun to''lov yo''q', 'billing_disabled');
select pg_temp.fails($$select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Sotuvchi'), 'basic')$$, 'faol (muddatli) e''lon — Oddiy qayta sotilmaydi', 'already_paid');
select pg_temp.fails($$select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Sotuvchi'), 'gold')$$, 'noma''lum daraja — rad', 'validation');
select pg_temp.fails($$select public.wallet_pay('ai_alerts', null, 'max')$$, 'AI PRO uchun daraja yo''q — rad', 'validation');
create temp table b1 as select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Sotuvchi'), 'boost') as j;
select pg_temp.ok((select (j ->> 'amount')::int = 24500 and (j ->> 'balance')::int = 275500 from b1), 'Tezkor: 24 500, qoldiq 275 500');
select pg_temp.ok((select status = 'active' and is_featured and pg_temp.near(featured_until, 3) and pg_temp.near(paid_until, 25) and expires_at >= paid_until - interval '1 minute'
  from public.vacancies where title = 'T80-Sotuvchi'), 'faol qoldi: 3 kun TOP, muddat yana 15 kunga uzaydi (10 + 15)');
select pg_temp.ok((select plan = 'boost' and status = 'paid' and provider = 'wallet' from public.payments where order_no = (select (j ->> 'order_no')::bigint from b1)), 'to''lov yozuvida daraja: boost');
-- ikkinchi marta — chegirmasiz, TOP va muddat qo'shiladi (qisqarmaydi)
create temp table b2 as select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Sotuvchi'), 'max') as j;
select pg_temp.ok((select (j ->> 'amount')::int = 99000 from b2), 'ikkinchi to''lov — chegirmasiz: Maksimal 99 000');
select pg_temp.ok((select pg_temp.near(featured_until, 13) and pg_temp.near(paid_until, 55) from public.vacancies where title = 'T80-Sotuvchi'), 'TOP 3+10 = 13 kun, muddat 10+15+30 = 55 kun');
select pg_temp.ok((select count(*) = 2 from public.notifications where profile_id = auth.uid() and payload ->> 'kind' = 'payment_success' and payload ->> 'plan' in ('boost', 'max')), 'har to''lovdan keyin xabar (daraja bilan)');

-- begona vakansiya — rad, balans o'zgarmaydi
select pg_temp.login('80000000-0000-0000-0000-00000000000c');
select pg_temp.fails($$select public.create_payment('vacancy_publish', (select id from public.vacancies where title = 'T80-Sotuvchi'), 'boost')$$, 'begona vakansiyani kuchaytirib bo''lmaydi', '42501');

-- ===== ishchi: Maksimal = 30 kun + 7 kun TOP + 30 kun AI PRO =====
select pg_temp.login('80000000-0000-0000-0000-00000000000a');
insert into public.worker_profiles (profile_id) values (auth.uid());
update public.worker_profiles set onboarding_completed_at = now(), is_public = true where profile_id = auth.uid();
create temp table w as select public.worker_listing_quote() as j;
select pg_temp.ok((select j ->> 'mode' = 'free' and (j #>> '{tiers,2,price}')::int = 9500 from w), 'ishchi narx so''rovi: Maksimal birinchi to''lovda 9 500');
create temp table w1 as select public.wallet_pay('worker_listing', public.current_worker_id(), 'max') as j;
select pg_temp.ok((select (j ->> 'amount')::int = 9500 and (j ->> 'balance')::int = 90500 from w1), 'Maksimal: 9 500, qoldiq 90 500');
select pg_temp.ok((select is_public and pg_temp.near(listed_until, 30) and pg_temp.near(promoted_until, 7) from public.worker_profiles where profile_id = auth.uid()),
  'qidiruvda 30 kun, 7 kun TOP');
select pg_temp.superuser();
select pg_temp.ok((select pg_temp.near(paid_until, 30) from public.ai_alert_subscriptions where profile_id = '80000000-0000-0000-0000-00000000000a'), 'AI PRO 30 kun yoqildi');

-- ===== Payme: daraja bilan yaratilgan to'lov — o'sha daraja qo'llanadi =====
select pg_temp.login('80000000-0000-0000-0000-00000000000e');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'T80-Oshpaz', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select public.publish_vacancy(id) from public.vacancies where title = 'T80-Oshpaz';
create temp table pp as select public.create_payment('vacancy_publish', (select id from public.vacancies where title = 'T80-Oshpaz'), 'boost') as j;
select pg_temp.ok((select (j ->> 'amount')::int = 49000 and j ->> 'plan' = 'boost' from pp), 'Payme uchun to''lov: Tezkor 49 000 (chegirma birinchi to''lovda ishlatilgan)');
select pg_temp.superuser();
select pg_temp.ok((public.payme_check_perform((select j ->> 'order_no' from pp), 4900000) -> 'result' ->> 'allow')::boolean, 'payme: summa mos — qabul');
select pg_temp.ok((public.payme_check_perform((select j ->> 'order_no' from pp), 3000000) -> 'error' ->> 'code') = '-31001', 'payme: Oddiy narxi (30 000) bilan to''lab bo''lmaydi');
select pg_temp.ok((public.payme_create('t80-tx1', (extract(epoch from now()) * 1000)::bigint, (select j ->> 'order_no' from pp), 4900000) -> 'result' ->> 'state') = '1', 'payme: tranzaksiya');
select pg_temp.ok((public.payme_perform('t80-tx1') -> 'result' ->> 'state') = '2', 'payme: bajarildi');
select pg_temp.ok((select is_featured and pg_temp.near(featured_until, 3) from public.vacancies where title = 'T80-Oshpaz'), 'Payme orqali ham — 3 kun TOP');

-- ===== tariflar o'chirilsa — Tezkor/Maksimal sotilmaydi; eski 2 argumentli chaqiruv ishlaydi =====
update public.app_settings set value = 'false'::jsonb where key = 'tariffs_enabled';
select pg_temp.login('80000000-0000-0000-0000-00000000000e');
select pg_temp.fails($$select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Oshpaz'), 'boost')$$, 'tariflar o''chiq — rad', 'billing_disabled');
select pg_temp.superuser();
update public.app_settings set value = 'true'::jsonb where key = 'listings_paid';
select pg_temp.login('80000000-0000-0000-0000-00000000000e');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'T80-Haydovchi', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
create temp table old2 as select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'T80-Haydovchi')) as j;
select pg_temp.ok((select (j ->> 'amount')::int = 30000 from old2), 'eski chaqiruv (2 argument) — Oddiy 30 000');
select pg_temp.ok((select status = 'active' and pg_temp.near(expires_at, 10) and not is_featured from public.vacancies where title = 'T80-Haydovchi'), 'Oddiy: 10 kun, TOP yo''q');
select pg_temp.superuser();

do $$ begin raise notice '✓ tariffs: hammasi o''tdi'; end $$;
rollback;
