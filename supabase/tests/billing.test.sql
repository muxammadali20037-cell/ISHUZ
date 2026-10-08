-- Ish Beruvchi · to'lovlar (billing_enabled=true holatida): aksiya davri, bepul vakansiya (24 soat), to'lov talabi, Payme/Click oqimlari, TOP profil
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  execute 'set role service_role';
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
-- 0049+: bu fayl eski oqimlarni sinaydi; majburiy moderatsiya va ish beruvchi darvozasi — moderation.test.sql da
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required');
-- 0043 dan oldingi qoidalar bilan sinaladi (yangi 10 kunlik pullik e'lonlar — paid_listings.test.sql)
update public.app_settings set value = 'false'::jsonb where key = 'listings_paid';
update public.app_settings set value = '30'::jsonb where key = 'vacancy_lifetime_days';
update public.app_settings set value = '50000'::jsonb where key = 'price_vacancy_publish';
update public.app_settings set value = 'true'::jsonb where key = 'listing_free_trial';
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'listing_discount_until';
-- 0030 dan beri to'lov sukut bo'yicha o'chiq; bu test yoqilgan rejimni tekshiradi
update public.app_settings set value = 'true'::jsonb where key = 'billing_enabled';

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e7000000-0000-0000-0000-000000000001', '+998903000001', now(), '{"first_name":"Kafe","last_name":"Egasi"}'),
  ('e7000000-0000-0000-0000-000000000002', '+998903000002', now(), '{"first_name":"Ishchi","last_name":"Aziz"}');

-- Yordamchi: 4 ta qoralama vakansiya
select pg_temp.login('e7000000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'person');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), t, c.id, r.id from unnest(array['V1', 'V2', 'V3', 'V4']) t, public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
create temp table vx as select title, id from public.vacancies where owner_profile_id = auth.uid();
grant select on vx to public;

-- ---------- 1. Aksiya davri: hammasi bepul, 30 kun ----------
select pg_temp.ok((select public.vacancy_publish_quote((select id from vx where title = 'V1')) ->> 'mode') = 'promo', 'aksiya: rejim promo');
select public.publish_vacancy((select id from vx where title = 'V1'));
select pg_temp.ok((select status = 'active' and expires_at > now() + interval '29 days' and paid_until = expires_at from public.vacancies where title = 'V1'), 'aksiya: 30 kunga faol');
select pg_temp.ok((select count(*) from public.billing_usage where profile_id = auth.uid()) = 0, 'aksiya: bepul limit sarflanmaydi');

-- ---------- 2. Aksiya tugadi: birinchi vakansiya bepul (0043 dan: to'liq muddat), keyingisi pullik ----------
select pg_temp.superuser();
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';
select pg_temp.login('e7000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.vacancy_publish_quote((select id from vx where title = 'V2')) ->> 'mode') = 'free_trial', 'birinchi bepul: rejim free_trial');
select public.publish_vacancy((select id from vx where title = 'V2'));
select pg_temp.ok((select status = 'active' and expires_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' from public.vacancies where title = 'V2'), 'bepul vakansiya to''liq muddatga');
select pg_temp.ok((select public.vacancy_publish_quote((select id from vx where title = 'V3')) ->> 'mode') = 'payment_required', 'ikkinchisi: to''lov kerak');
select pg_temp.fails($$select public.publish_vacancy((select id from vx where title = 'V3'))$$, 'to''lovsiz e''lon qilib bo''lmaydi', 'payment_required');

-- pauza → qayta yoqish: to'langan muddat ichida bepul
select public.set_vacancy_status((select id from vx where title = 'V1'), 'paused');
select pg_temp.ok((select public.vacancy_publish_quote((select id from vx where title = 'V1')) ->> 'mode') = 'paid_window', 'pauzadan qaytish: paid_window');
select public.publish_vacancy((select id from vx where title = 'V1'));
select pg_temp.ok((select status = 'active' from public.vacancies where title = 'V1'), 'pauzadan qaytdi');

-- mijoz to'lov maydonlarini o'zgartira olmaydi
select pg_temp.fails($$update public.vacancies set paid_until = now() + interval '1 year' where title = 'V3'$$, 'paid_until ni qo''lda qo''yib bo''lmaydi (RLS)', '42501');
select pg_temp.fails($$insert into public.billing_usage (profile_id) values (auth.uid())$$, 'billing_usage ga yozib bo''lmaydi');
select pg_temp.fails($$select public.apply_payment_internal(gen_random_uuid())$$, 'ichki funksiya foydalanuvchiga yopiq', '42501');
select pg_temp.fails($$select public.payme_perform('x')$$, 'Payme funksiyasi foydalanuvchiga yopiq', '42501');

-- 24 soat o'tgach bepul vakansiya yopiladi
select pg_temp.superuser();
update public.vacancies set expires_at = now() - interval '1 minute' where title = 'V2';
select public.expire_vacancies();
select pg_temp.ok((select status = 'expired' from public.vacancies where title = 'V2'), 'muddati o''tgan bepul vakansiya yopildi');

-- ---------- 3. Payme: to'lov → vakansiya avtomatik e'lon qilinadi ----------
select pg_temp.login('e7000000-0000-0000-0000-000000000001');
create temp table pay as select (public.create_payment('vacancy_publish', (select id from vx where title = 'V3'))) as j;
grant select on pay to public;
select pg_temp.ok((select (j ->> 'amount')::int = 50000 from pay), 'narx 50 000 so''m');
select pg_temp.fails($$select public.create_payment('worker_promotion', (select id from vx where title = 'V3'))$$, 'begona ishchini TOP ga to''lab bo''lmaydi', '42501');

select pg_temp.service();
select pg_temp.ok((select public.payme_check_perform('999999999', 5000000) -> 'error' ->> 'code') = '-31050', 'payme: noma''lum buyurtma');
select pg_temp.ok((select public.payme_check_perform((select j ->> 'order_no' from pay), 100) -> 'error' ->> 'code') = '-31001', 'payme: noto''g''ri summa');
select pg_temp.ok((select (public.payme_check_perform((select j ->> 'order_no' from pay), 5000000) -> 'result' ->> 'allow')::boolean), 'payme: CheckPerform allow');
select pg_temp.ok((select (public.payme_create('tx1', (extract(epoch from now()) * 1000)::bigint, (select j ->> 'order_no' from pay), 5000000) -> 'result' ->> 'state') = '1'), 'payme: CreateTransaction state 1');
select pg_temp.ok((select (public.payme_create('tx1', (extract(epoch from now()) * 1000)::bigint, (select j ->> 'order_no' from pay), 5000000) -> 'result' ->> 'state') = '1'), 'payme: takroriy Create idempotent');
select pg_temp.ok((select public.payme_create('tx2', (extract(epoch from now()) * 1000)::bigint + 1, (select j ->> 'order_no' from pay), 5000000) -> 'error' ->> 'code') = '-31099', 'payme: band buyurtmaga ikkinchi tranzaksiya yo''q');
select pg_temp.ok((select (public.payme_perform('tx1') -> 'result' ->> 'state') = '2'), 'payme: PerformTransaction state 2');
select pg_temp.ok((select (public.payme_perform('tx1') -> 'result' ->> 'state') = '2'), 'payme: takroriy Perform idempotent');
select pg_temp.ok((select status = 'active' and paid_until > now() + interval '29 days' from public.vacancies where title = 'V3'), 'to''lovdan keyin vakansiya 30 kunga e''lon qilindi');
select pg_temp.ok((select status = 'paid' from public.payments where provider_txn_id = 'tx1'), 'to''lov paid');
select pg_temp.ok((select public.payme_cancel('tx1', 5) -> 'error' ->> 'code') = '-31007', 'payme: bajarilganni bekor qilib bo''lmaydi');
select pg_temp.ok((select (public.payme_check('tx1') -> 'result' ->> 'state') = '2'), 'payme: CheckTransaction');
select pg_temp.ok((select jsonb_array_length(public.payme_statement(0, 9999999999999) -> 'result' -> 'transactions') = 1), 'payme: GetStatement');
-- 12 soatdan eski tranzaksiya bajarilmaydi (Payme talabi)
select pg_temp.superuser();
insert into public.payments (profile_id, purpose, vacancy_id, amount, provider, provider_txn_id, provider_state, provider_create_time)
select 'e7000000-0000-0000-0000-000000000001', 'vacancy_publish', id, 50000, 'payme', 'tx-old', 1, 1700000000000 from vx where title = 'V4';
select pg_temp.service();
select pg_temp.ok((select public.payme_perform('tx-old') -> 'error' ->> 'code') = '-31008', 'payme: muddati o''tgan tranzaksiya bajarilmaydi');
select pg_temp.ok((select status = 'cancelled' from public.payments where provider_txn_id = 'tx-old'), 'payme: muddati o''tgani bekor qilindi');
select pg_temp.ok((select public.payme_check_perform((select j ->> 'order_no' from pay), 5000000) -> 'error' ->> 'code') = '-31051', 'payme: to''langan buyurtma qayta to''lanmaydi');
select pg_temp.ok((select count(*) = 1 from public.notifications where profile_id = 'e7000000-0000-0000-0000-000000000001' and payload ->> 'kind' = 'payment_success'), 'to''lov bildirishnomasi');

-- Payme: bekor qilish (to'lanmagan)
select pg_temp.login('e7000000-0000-0000-0000-000000000001');
create temp table pay2 as select (public.create_payment('vacancy_publish', (select id from vx where title = 'V4'))) as j;
grant select on pay2 to public;
select pg_temp.service();
select public.payme_create('tx3', (extract(epoch from now()) * 1000)::bigint, (select j ->> 'order_no' from pay2), 5000000);
select pg_temp.ok((select (public.payme_cancel('tx3', 3) -> 'result' ->> 'state') = '-1'), 'payme: to''lanmagan tranzaksiya bekor');
select pg_temp.ok((select status = 'draft' from public.vacancies where title = 'V4'), 'bekor qilingan to''lov vakansiyani e''lon qilmaydi');

-- ---------- 4. Click ----------
select pg_temp.login('e7000000-0000-0000-0000-000000000001');
create temp table pay3 as select (public.create_payment('vacancy_publish', (select id from vx where title = 'V4'))) as j;
grant select on pay3 to public;
select pg_temp.service();
select pg_temp.ok((select (public.click_prepare(777, (select j ->> 'order_no' from pay3), 100, 0) ->> 'error') = '-2'), 'click: noto''g''ri summa');
select pg_temp.ok((select (public.click_prepare(777, (select j ->> 'order_no' from pay3), 50000, 0) ->> 'error') = '0'), 'click: prepare');
select pg_temp.ok((select (public.click_complete(888, (select j ->> 'order_no' from pay3), (select (j ->> 'order_no')::bigint from pay3), 50000, 0) ->> 'error') = '-6'), 'click: begona click_trans_id');
select pg_temp.ok((select (public.click_complete(777, (select j ->> 'order_no' from pay3), (select (j ->> 'order_no')::bigint from pay3), 50000, 0) ->> 'error') = '0'), 'click: complete');
select pg_temp.ok((select (public.click_complete(777, (select j ->> 'order_no' from pay3), (select (j ->> 'order_no')::bigint from pay3), 50000, 0) ->> 'error') = '-4'), 'click: takroriy complete — already paid');
select pg_temp.ok((select status = 'active' from public.vacancies where title = 'V4'), 'click to''lovidan keyin e''lon qilindi');

-- ---------- 5. TOP profil ----------
select pg_temp.superuser();
insert into public.worker_profiles (profile_id, onboarding_completed_at, is_public) values ('e7000000-0000-0000-0000-000000000002', now(), true);
select pg_temp.login('e7000000-0000-0000-0000-000000000002');
select pg_temp.fails($$update public.worker_profiles set promoted_until = now() + interval '1 year' where profile_id = auth.uid()$$, 'promoted_until ni qo''lda qo''yib bo''lmaydi', '42501');
select pg_temp.ok((select public.worker_promotion_quote() ->> 'mode') = 'free_trial', 'TOP: birinchisi bepul');
select public.promote_worker();
select pg_temp.ok((select promoted_until between now() + interval '23 hours' and now() + interval '25 hours' from public.worker_profiles where profile_id = auth.uid()), 'TOP 24 soat');
select pg_temp.fails($$select public.promote_worker()$$, 'ikkinchi TOP pullik', 'payment_required');
create temp table pay4 as select (public.create_payment('worker_promotion', public.current_worker_id())) as j;
grant select on pay4 to public;
select pg_temp.ok((select (j ->> 'amount')::int = 20000 from pay4), 'TOP narxi 20 000 so''m');
select pg_temp.service();
select public.click_prepare(999, (select j ->> 'order_no' from pay4), 20000, 0);
select public.click_complete(999, (select j ->> 'order_no' from pay4), (select (j ->> 'order_no')::bigint from pay4), 20000, 0);
select pg_temp.ok((select promoted_until > now() + interval '47 hours' from public.worker_profiles where profile_id = 'e7000000-0000-0000-0000-000000000002'), 'to''langan TOP muddatni uzaytiradi');

rollback;
\echo 'billing.test.sql: OK'
