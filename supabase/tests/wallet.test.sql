-- 0063 · Hamyon: Payme orqali to'ldirish (bonus bilan), balansdan bir bosishda to'lash, yetmasa — hech narsa yozilmaydi;
--        begona e'lon, bloklangan, mehmon — rad; balansni mijoz o'zgartira olmaydi; rad etilgan pullik e'lon muddat ichida
--        qayta to'lovsiz yuboriladi (to'lov oynasidagi va'da)
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
create or replace function pg_temp.bal(p uuid) returns bigint language sql as $$
  select coalesce((select balance from public.wallets where profile_id = p), 0);
$$;

begin;
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'ai_alerts_paid');
update public.app_settings set value = 'true'::jsonb where key = 'listings_paid';
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';
update public.app_settings set value = to_jsonb((now() + interval '30 days')::text) where key = 'listing_discount_until';
update public.app_settings set value = '10'::jsonb where key = 'wallet_bonus_percent';
update public.app_settings set value = '100000'::jsonb where key = 'wallet_bonus_min';

-- W — ish izlovchi, E — ish beruvchi, X — boshqa odam (balansi yo'q), B — bloklangan
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('63000000-0000-0000-0000-00000000000a', '+998906300001', now(), '{"first_name":"Aziz"}'),
  ('63000000-0000-0000-0000-00000000000b', '+998906300002', now(), '{"first_name":"Dilnoza"}'),
  ('63000000-0000-0000-0000-00000000000c', '+998906300003', now(), '{"first_name":"Sardor"}'),
  ('63000000-0000-0000-0000-00000000000d', '+998906300004', now(), '{"first_name":"Bekzod"}');

-- ===== mehmon =====
select pg_temp.anon();
select pg_temp.fails($$select public.my_wallet()$$, 'mehmon hamyonni ko''rmaydi', '42501');
select pg_temp.fails($$select public.create_topup(50000)$$, 'mehmon to''ldira olmaydi', '42501');
select pg_temp.fails($$select public.wallet_pay('ai_alerts', null)$$, 'mehmon balansdan to''lay olmaydi', '42501');
select pg_temp.fails($$select * from public.wallets$$, 'mehmon wallets jadvalini o''qimaydi', '42501');

-- ===== to'ldirish =====
select pg_temp.login('63000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select (w ->> 'enabled')::boolean and (w ->> 'balance')::int = 0 and (w ->> 'bonus_percent')::int = 10 from (select public.my_wallet() w) x), 'yangi foydalanuvchi: balans 0, hamyon yoqilgan, bonus 10%');
select pg_temp.fails($$select public.create_topup(1000)$$, 'eng kam summadan kam — rad', 'invalid_amount');
select pg_temp.fails($$select public.create_topup(3000000)$$, 'eng ko''p summadan ko''p — rad', 'invalid_amount');
create temp table t1 as select public.create_topup(50000) as j;
select pg_temp.ok((select purpose = 'wallet_topup' and amount = 50000 and status = 'pending' and vacancy_id is null and worker_id is null
  from public.payments where id = (select (j ->> 'id')::uuid from t1)), 'to''ldirish to''lovi yaratildi (obyektsiz, kutilmoqda)');
select pg_temp.fails($$insert into public.wallets (profile_id, balance) values (auth.uid(), 1000000)$$, 'balansni o''zi yoza olmaydi', '42501');
select pg_temp.fails($$update public.wallets set balance = 1000000 where profile_id = auth.uid()$$, 'balansni o''zi o''zgartira olmaydi', '42501');
select pg_temp.fails($$insert into public.wallet_ledger (profile_id, delta, kind) values (auth.uid(), 1000000, 'adjust')$$, 'tarixga o''zi yoza olmaydi', '42501');

-- Payme: tekshiruv → yaratish → bajarish (server, tiyinda)
select pg_temp.superuser();
select pg_temp.ok((public.payme_check_perform((select j ->> 'order_no' from t1), 5000000) -> 'result' ->> 'allow')::boolean, 'payme: to''ldirishni qabul qiladi');
select pg_temp.ok((public.payme_create('w-tx1', (extract(epoch from now()) * 1000)::bigint, (select j ->> 'order_no' from t1), 5000000) -> 'result' ->> 'state') = '1', 'payme: tranzaksiya yaratildi');
select pg_temp.ok((public.payme_perform('w-tx1') -> 'result' ->> 'state') = '2', 'payme: bajarildi');
select pg_temp.ok(pg_temp.bal('63000000-0000-0000-0000-00000000000a') = 50000, 'balans 50 000 (bonus chegarasidan kam — bonus yo''q)');
select pg_temp.ok((public.payme_perform('w-tx1') -> 'result' ->> 'state') = '2' and pg_temp.bal('63000000-0000-0000-0000-00000000000a') = 50000, 'qayta Perform — balans ikki marta oshmaydi');
select public.apply_payment_internal((select (j ->> 'id')::uuid from t1));
select pg_temp.ok(pg_temp.bal('63000000-0000-0000-0000-00000000000a') = 50000, 'apply_payment_internal qayta chaqirilsa ham balans o''zgarmaydi');
select pg_temp.ok((public.payme_cancel('w-tx1', 5) -> 'error' ->> 'code') = '-31007', 'bajarilgan to''ldirishni Payme bekor qila olmaydi');

-- 100 000 dan — 10% bonus
select pg_temp.login('63000000-0000-0000-0000-00000000000a');
create temp table t2 as select public.create_topup(100000) as j;
select pg_temp.superuser();
update public.payments set status = 'paid', paid_at = now() where id = (select (j ->> 'id')::uuid from t2);
select public.apply_payment_internal((select (j ->> 'id')::uuid from t2));
select pg_temp.ok(pg_temp.bal('63000000-0000-0000-0000-00000000000a') = 160000, 'balans 50 000 + 100 000 + 10 000 bonus = 160 000');
select pg_temp.ok((select count(*) = 3 and sum(delta) = 160000 and count(*) filter (where kind = 'bonus' and delta = 10000) = 1
  from public.wallet_ledger where profile_id = '63000000-0000-0000-0000-00000000000a'), 'tarix: 2 ta to''ldirish va 1 ta bonus');
select pg_temp.ok((select count(*) = 2 from public.notifications where profile_id = '63000000-0000-0000-0000-00000000000a' and payload ->> 'purpose' = 'wallet_topup'), 'har to''ldirishdan keyin xabar');

-- ===== balansdan to'lash: ish qidirish e'loni =====
select pg_temp.login('63000000-0000-0000-0000-00000000000a');
insert into public.worker_profiles (profile_id) values (auth.uid());
update public.worker_profiles set onboarding_completed_at = now(), is_public = true where profile_id = auth.uid();
select pg_temp.ok((select not is_public from public.worker_profiles where profile_id = auth.uid()), 'to''lovsiz qidiruvda yo''q');
create temp table s1 as select public.wallet_pay('worker_listing', public.current_worker_id()) as j;
select pg_temp.ok((select (j ->> 'amount')::int = 5000 and (j ->> 'balance')::int = 155000 from s1), 'balansdan 5 000 (birinchi e''lon chegirmasi bilan), qoldiq 155 000');
select pg_temp.ok((select is_public and listed_until > now() + interval '9 days' from public.worker_profiles where profile_id = auth.uid()), 'e''lon darhol 10 kunga qidiruvda');
select pg_temp.ok((select status = 'paid' and provider = 'wallet' and paid_at is not null from public.payments where order_no = (select (j ->> 'order_no')::bigint from s1)), 'to''lov yozuvi: to''langan, hamyondan');
select pg_temp.ok((select count(*) = 1 from public.wallet_ledger where profile_id = auth.uid() and kind = 'spend' and delta = -5000), 'tarixda sarf: −5 000');

-- begona ishchi e'loni — rad, balans o'zgarmaydi
select pg_temp.login('63000000-0000-0000-0000-00000000000c');
insert into public.worker_profiles (profile_id) values (auth.uid());
select pg_temp.login('63000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.wallet_pay('worker_listing', (select id from public.worker_profiles where profile_id = '63000000-0000-0000-0000-00000000000c'))$$, 'begona e''lon uchun to''lab bo''lmaydi', '42501');
select pg_temp.ok(pg_temp.bal('63000000-0000-0000-0000-00000000000a') = 155000, 'rad etilganda balans o''zgarmadi');
select pg_temp.fails($$select public.wallet_pay('wallet_topup', null)$$, 'balansdan balansni to''ldirib bo''lmaydi', 'validation');

-- ===== yetmasa — hech narsa yozilmaydi; boshqa odamning hamyoni ko'rinmaydi =====
select pg_temp.login('63000000-0000-0000-0000-00000000000c');
select pg_temp.fails($$select public.wallet_pay('ai_alerts', null)$$, 'balans yetmasa — rad', 'insufficient_balance');
select pg_temp.ok((select count(*) = 0 from public.payments where profile_id = auth.uid()), 'yetmaganda to''lov yozuvi qolmaydi');
select pg_temp.ok((select count(*) = 0 from public.wallets) and (select count(*) = 0 from public.wallet_ledger), 'boshqa odam hamyoni va tarixini ko''rmaydi');

-- ===== ish beruvchi: vakansiya balansdan; rad etilsa muddat ichida qayta to'lovsiz =====
select pg_temp.superuser();
insert into public.wallets (profile_id, balance) values ('63000000-0000-0000-0000-00000000000b', 30000);
select pg_temp.login('63000000-0000-0000-0000-00000000000b');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'person');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'WL-Kassir-63', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
select pg_temp.ok((select public.vacancy_publish_quote(id) ->> 'mode' from public.vacancies where title = 'WL-Kassir-63') = 'payment_required', 'vakansiya pullik');
create temp table s2 as select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'WL-Kassir-63')) as j;
select pg_temp.ok((select (j ->> 'amount')::int = 25000 and (j ->> 'balance')::int = 5000 from s2), 'balansdan 25 000, qoldiq 5 000');
select pg_temp.ok((select status = 'active' and expires_at > now() + interval '9 days' from public.vacancies where title = 'WL-Kassir-63'), 'vakansiya darhol 10 kunga faol');
select pg_temp.fails($$select public.wallet_pay('vacancy_publish', (select id from public.vacancies where title = 'WL-Kassir-63'))$$, 'shu vakansiya uchun qayta to''lov — rad', 'already_paid');
select pg_temp.ok(pg_temp.bal('63000000-0000-0000-0000-00000000000b') = 5000, 'qayta to''lov rad etilganda balans o''zgarmadi');
select pg_temp.superuser();
update public.vacancies set status = 'rejected' where title = 'WL-Kassir-63';
select pg_temp.login('63000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select public.vacancy_publish_quote(id) ->> 'mode' from public.vacancies where title = 'WL-Kassir-63') = 'paid_window', 'rad etilgan pullik vakansiya: muddat ichida — to''langan holat');
select public.publish_vacancy(id) from public.vacancies where title = 'WL-Kassir-63';
select pg_temp.ok((select status = 'active' from public.vacancies where title = 'WL-Kassir-63') and pg_temp.bal('63000000-0000-0000-0000-00000000000b') = 5000,
  'tuzatib qayta yuborildi — qayta to''lovsiz faol');

-- ===== bloklangan =====
select pg_temp.superuser();
insert into public.wallets (profile_id, balance) values ('63000000-0000-0000-0000-00000000000d', 50000);
update public.profiles set is_blocked = true where id = '63000000-0000-0000-0000-00000000000d';
select pg_temp.login('63000000-0000-0000-0000-00000000000d');
select pg_temp.fails($$select public.wallet_pay('ai_alerts', null)$$, 'bloklangan balansdan to''lay olmaydi', 'blocked');
select pg_temp.fails($$select public.create_topup(50000)$$, 'bloklangan to''ldira olmaydi', 'blocked');

-- ===== balans manfiy bo'la olmaydi (baza cheklovi) =====
select pg_temp.superuser();
select pg_temp.fails($$update public.wallets set balance = -1 where profile_id = '63000000-0000-0000-0000-00000000000a'$$, 'balans manfiy bo''lmaydi', '23514');

-- ===== to'lov qilingan e'lonni o'chirish; kutilayotgan to'lov bilan e'lon o'chirilsa — to'lov bekor =====
select pg_temp.superuser();
update public.vacancies set status = 'expired' where title = 'WL-Kassir-63';
select pg_temp.login('63000000-0000-0000-0000-00000000000b');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'WL-Oshpaz-63', c.id, r.id from public.categories c, public.regions r where c.slug = 'restaurant' and r.slug = 'tashkent_city';
create temp table pp as select public.create_payment('vacancy_publish', (select id from public.vacancies where title = 'WL-Oshpaz-63')) as j;
select pg_temp.superuser();
select pg_temp.ok((public.payme_create('w-tx9', (extract(epoch from now()) * 1000)::bigint, (select j ->> 'order_no' from pp), (select (j ->> 'amount')::bigint * 100 from pp)) -> 'result' ->> 'state') = '1', 'Payme tranzaksiyasi ochildi (foydalanuvchi to''lov sahifasida)');
select pg_temp.login('63000000-0000-0000-0000-00000000000b');
delete from public.vacancies where title in ('WL-Kassir-63', 'WL-Oshpaz-63');
select pg_temp.ok((select count(*) = 0 from public.vacancies where title in ('WL-Kassir-63', 'WL-Oshpaz-63')), 'to''lov qilingan (muddati tugagan) va kutilayotgan to''lovli e''lonlar o''chirildi');
select pg_temp.superuser();
select pg_temp.ok((select count(*) = 1 from public.payments where profile_id = '63000000-0000-0000-0000-00000000000b' and status = 'paid' and provider = 'wallet' and vacancy_id is null),
  'to''langan to''lov tarixda qoldi (e''lon havolasi bo''shadi)');
select pg_temp.ok((select status = 'cancelled' and provider_state = -1 from public.payments where order_no = (select (j ->> 'order_no')::bigint from pp)), 'kutilayotgan to''lov bekor qilindi');
select pg_temp.ok((public.payme_perform('w-tx9') -> 'error' ->> 'code') = '-31008', 'Payme o''chirilgan e''lon to''lovini bajara olmaydi');

-- ===== hamma narsa bepul bo'lsa — to'ldirish ma'nosiz =====
update public.app_settings set value = 'false'::jsonb where key = 'listings_paid';
select pg_temp.login('63000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select not (public.my_wallet() ->> 'enabled')::boolean), 'pullik xizmat yo''q — hamyon o''chiq');
select pg_temp.fails($$select public.create_topup(50000)$$, 'pullik xizmat yo''q — to''ldirib bo''lmaydi', 'billing_disabled');
select pg_temp.superuser();

do $$ begin raise notice '✓ wallet: hammasi o''tdi'; end $$;
rollback;
