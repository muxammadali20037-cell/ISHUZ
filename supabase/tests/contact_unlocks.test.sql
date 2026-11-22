-- 0088 · Ishchi raqamini ochish: bepul rejim (limit + juftlik → chat), pullik rejim (to'lov, hamyon, qaytarish), raqamsiz
-- e'lon qidiruvga chiqmaydi, raqam qo'shilsa qaytadi; eski yo'llar (simple_worker_listing, mehmon, get_contact) pullik rejimda yopiq.
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
update public.app_settings set value = 'false'::jsonb
 where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid', 'billing_enabled');

select pg_temp.ok(not public.contact_unlock_paid(), 'standart: pullik rejim o''chiq');
select pg_temp.ok(public.contact_unlock_price() = 5000, 'standart narx 5 000');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('88000000-0000-0000-0000-000000000001', '+998908800001', now(), '{"first_name":"Ish beruvchi"}'),
  ('88000000-0000-0000-0000-000000000002', '+998908800002', now(), '{"first_name":"Ishchi"}'),
  ('88000000-0000-0000-0000-000000000003', '+998908800003', now(), '{"first_name":"Yashirin"}'),
  ('88000000-0000-0000-0000-000000000004', '+998908800004', now(), '{"first_name":"Boshqa"}'),
  ('88000000-0000-0000-0000-000000000005', '+998908800005', now(), '{"first_name":"Karta"}');
update public.profile_contacts set phone_visibility = 'on_request'
 where profile_id in ('88000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000003');

-- ikki e'lon: W — e'londa raqam bor, H — raqam yashirin
insert into public.worker_profiles (id, profile_id, headline, region_id, category_id, experience_level, is_public, status, onboarding_completed_at)
select x.id, x.p, 'Santexnik', (select id from public.regions where slug = 'tashkent_city'), (select id from public.categories limit 1), '3_5y', false, 'active', now()
  from (values ('88200000-0000-0000-0000-000000000002'::uuid, '88000000-0000-0000-0000-000000000002'::uuid),
               ('88200000-0000-0000-0000-000000000003'::uuid, '88000000-0000-0000-0000-000000000003'::uuid)) x(id, p);
insert into public.worker_listing_phones (worker_id, phone, phone2) values ('88200000-0000-0000-0000-000000000002', '+998935550011', '+998935550022');
update public.worker_profiles set is_public = true
 where id in ('88200000-0000-0000-0000-000000000002', '88200000-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------- raqamsiz e'lon
select pg_temp.ok((select is_public from public.worker_profiles where id = '88200000-0000-0000-0000-000000000002'), 'raqamli e''lon qidiruvda');
select pg_temp.ok((select not is_public and publish_requested from public.worker_profiles where id = '88200000-0000-0000-0000-000000000003'),
  'raqamsiz e''lon qidiruvga chiqmaydi, so''rov saqlanadi');
select pg_temp.login('88000000-0000-0000-0000-000000000003');
select pg_temp.ok((public.my_listing_state('worker', '88200000-0000-0000-0000-000000000003') ->> 'state') = 'phone_required', 'egasiga holat: raqam kerak');
select pg_temp.ok((select count(*) = 1 from public.my_listings_without_phone()), 'eslatma ro''yxatida bitta e''lon');
select pg_temp.superuser();
insert into public.worker_listing_phones (worker_id, phone) values ('88200000-0000-0000-0000-000000000003', '+998935550033');
select pg_temp.ok((select is_public from public.worker_profiles where id = '88200000-0000-0000-0000-000000000003'), 'raqam qo''shildi — e''lon qaytadan chiqdi');
select pg_temp.login('88000000-0000-0000-0000-000000000003');
select pg_temp.ok((select count(*) = 0 from public.my_listings_without_phone()), 'eslatma yo''qoldi');
select pg_temp.superuser();
-- hisob raqami "hamma"ga ochilsa ham qaytadi
delete from public.worker_listing_phones where worker_id = '88200000-0000-0000-0000-000000000003';
update public.worker_profiles set is_public = true where id = '88200000-0000-0000-0000-000000000003';
select pg_temp.ok((select not is_public from public.worker_profiles where id = '88200000-0000-0000-0000-000000000003'), 'raqam olib tashlansa — yana yashirin');
update public.profile_contacts set phone_visibility = 'everyone' where profile_id = '88000000-0000-0000-0000-000000000003';
select pg_temp.ok((select is_public from public.worker_profiles where id = '88200000-0000-0000-0000-000000000003'), 'hisob raqami hammaga ochildi — e''lon qaytdi');

-- ---------------------------------------------------------------- bepul rejim
select pg_temp.login('88000000-0000-0000-0000-000000000001');
select pg_temp.ok((select phone is null and not unlocked from public.simple_worker_listing('88200000-0000-0000-0000-000000000002', false)),
  'yangi ilova: ochilmaguncha raqam yo''q');
select pg_temp.ok((public.contact_unlock_quote('88200000-0000-0000-0000-000000000002') ->> 'mode') = 'free', 'narx so''rovi: bepul');
select pg_temp.fails($$select public.open_contact_chat('88000000-0000-0000-0000-000000000002')$$, 'ochilmaguncha chat yo''q', 'chat_requires_unlock');
create temp table r1 as select public.unlock_worker_contact('88200000-0000-0000-0000-000000000002') as j;
select pg_temp.ok((select j ->> 'status' = 'shown' and j ->> 'phone' = '+998935550011' and j ->> 'phone2' = '+998935550022' from r1), 'bepul: raqam ochildi');
select pg_temp.ok((select amount = 0 and worker_id = '88200000-0000-0000-0000-000000000002' from public.contact_unlocks
                    where viewer_profile_id = '88000000-0000-0000-0000-000000000001'), 'bepul: juftlik yozildi (0 so''m)');
select pg_temp.ok((select phone = '+998935550011' and phone2 = '+998935550022' and unlocked from public.simple_worker_listing('88200000-0000-0000-0000-000000000002', false)),
  'ochilgandan keyin sahifada raqam');
create temp table c1 as select public.open_contact_chat('88000000-0000-0000-0000-000000000002') as id;
select pg_temp.ok((select public.open_contact_chat('88000000-0000-0000-0000-000000000002') = (select id from c1)), 'chat: takror ochilsa — o''sha suhbat');
select pg_temp.ok((select context_title = 'Santexnik' from public.my_conversations() where id = (select id from c1)), 'chat ro''yxatida kasb');
select public.send_message((select id from c1), 'text', 'Salom');
select pg_temp.login('88000000-0000-0000-0000-000000000002');
select pg_temp.ok((select public.open_contact_chat('88000000-0000-0000-0000-000000000001') = (select id from c1)), 'ishchi tomondan ham o''sha suhbat');
select pg_temp.ok((select unread_count = 1 from public.my_conversations() where id = (select id from c1)), 'ishchi xabarni ko''radi');
select pg_temp.login('88000000-0000-0000-0000-000000000004');
select pg_temp.fails($$select public.open_contact_chat('88000000-0000-0000-0000-000000000002')$$, 'begona juftlik — chat yo''q', 'chat_requires_unlock');
select pg_temp.ok((select count(*) = 0 from public.contact_unlocks), 'RLS: begona juftliklar ko''rinmaydi');
select pg_temp.fails($$select public.create_payment('contact_unlock', '88200000-0000-0000-0000-000000000002')$$, 'bepul rejimda to''lov yaratilmaydi', 'billing_disabled');

-- ---------------------------------------------------------------- pullik rejim
select pg_temp.superuser();
update public.app_settings set value = 'true'::jsonb where key = 'contact_unlock_paid';
insert into public.wallets (profile_id, balance) values ('88000000-0000-0000-0000-000000000004', 12000);

select pg_temp.login('88000000-0000-0000-0000-000000000004');
select pg_temp.ok((public.unlock_worker_contact('88200000-0000-0000-0000-000000000002') ->> 'status') = 'payment_required', 'pullik: to''lov kerak');
select pg_temp.ok((public.contact_unlock_quote('88200000-0000-0000-0000-000000000002') ->> 'mode') = 'payment_required', 'narx so''rovi: to''lov kerak');
select pg_temp.ok((select phone is null and phone2 is null from public.simple_worker_listing('88200000-0000-0000-0000-000000000002')),
  'eski ilova yo''li ham pullik rejimda yopiq');
select pg_temp.ok((select allowed = false from public.get_contact('88000000-0000-0000-0000-000000000003')), 'hisob raqami (hamma) — pullik rejimda ochmaganga yopiq');
insert into public.saved_items (profile_id, worker_id) values ('88000000-0000-0000-0000-000000000004', '88200000-0000-0000-0000-000000000003');
select pg_temp.ok((select phone is null from public.my_saved_workers(50) where id = '88200000-0000-0000-0000-000000000003'), 'saqlangan ishchilar: pullik rejimda raqam yo''q');
select pg_temp.fails($$select public.create_payment('contact_unlock', '88200000-0000-0000-0000-000000000002', 'boost')$$, 'daraja bilan to''lov yo''q', 'validation');
create temp table w1 as select public.wallet_pay('contact_unlock', '88200000-0000-0000-0000-000000000002') as j;
select pg_temp.ok((select (j ->> 'balance')::int = 7000 from w1), 'hamyondan 5 000 yechildi');
select pg_temp.ok((select phone = '+998935550011' and unlocked from public.simple_worker_listing('88200000-0000-0000-0000-000000000002', false)), 'to''lovdan keyin raqam ochiq');
select pg_temp.ok((public.unlock_worker_contact('88200000-0000-0000-0000-000000000002') ->> 'status') = 'shown', 'qayta ochish — bepul (doim ochiq)');
select pg_temp.fails($$select public.wallet_pay('contact_unlock', '88200000-0000-0000-0000-000000000002')$$, 'ikki marta to''lab bo''lmaydi', 'already_paid');
select pg_temp.ok((select open_contact_chat is not null from public.open_contact_chat('88000000-0000-0000-0000-000000000002')), 'to''lovdan keyin chat ochiladi');
select pg_temp.login('88000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.create_payment('contact_unlock', '88200000-0000-0000-0000-000000000002')$$, 'o''z raqamini ochib bo''lmaydi', 'forbidden');
select pg_temp.ok((select phone = '+998935550011' and not unlocked from public.simple_worker_listing('88200000-0000-0000-0000-000000000002', false)), 'egasi o''z raqamini ko''radi');

-- karta (Payme/Click) va ikkinchi to'lov — pul hamyonga qaytadi
select pg_temp.login('88000000-0000-0000-0000-000000000005');
create temp table p1 as select public.create_payment('contact_unlock', '88200000-0000-0000-0000-000000000003') as j;
create temp table p2 as select public.create_payment('contact_unlock', '88200000-0000-0000-0000-000000000003') as j;
select pg_temp.ok((select (j ->> 'amount')::int = 5000 from p1), 'karta to''lovi: 5 000');
select pg_temp.superuser();
update public.payments set status = 'paid', provider = 'payme', paid_at = now() where id in ((select (j ->> 'id')::uuid from p1), (select (j ->> 'id')::uuid from p2));
select public.apply_payment_internal((select (j ->> 'id')::uuid from p1));
select public.apply_payment_internal((select (j ->> 'id')::uuid from p1));
select pg_temp.ok((select amount = 5000 and payment_id = (select (j ->> 'id')::uuid from p1) from public.contact_unlocks
                    where viewer_profile_id = '88000000-0000-0000-0000-000000000005'), 'karta: juftlik ochildi (takror qo''llash zararsiz)');
select pg_temp.ok((select count(*) = 1 from public.notifications where profile_id = '88000000-0000-0000-0000-000000000005' and link = '/listing/88200000-0000-0000-0000-000000000003'),
  'to''lovchiga bildirishnoma (e''longa havola)');
select public.apply_payment_internal((select (j ->> 'id')::uuid from p2));
select public.apply_payment_internal((select (j ->> 'id')::uuid from p2));
select pg_temp.ok((select balance = 5000 from public.wallets where profile_id = '88000000-0000-0000-0000-000000000005'), 'ikkinchi to''lov — hamyonga bir marta qaytdi');
select pg_temp.service();
select pg_temp.ok((select count(*) = 0 from public.listing_phones_public('worker', '88200000-0000-0000-0000-000000000002')), 'mehmon: pullik rejimda ishchi raqami yo''q');
select pg_temp.superuser();

-- huquqlar
select pg_temp.ok(not has_function_privilege('anon', 'public.unlock_worker_contact(uuid)', 'execute'), 'anon raqam ocha olmaydi');
select pg_temp.ok(not has_function_privilege('anon', 'public.open_contact_chat(uuid)', 'execute'), 'anon chat ocha olmaydi');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.worker_visible_phone(uuid)', 'execute'), 'ichki: worker_visible_phone yopiq');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.has_contact_unlock(uuid, uuid)', 'execute'), 'ichki: has_contact_unlock yopiq');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.moderation_try_list_worker(uuid)', 'execute'), 'ichki: moderation_try_list_worker yopiq');
select pg_temp.login('88000000-0000-0000-0000-000000000004');
select pg_temp.fails($$insert into public.contact_unlocks (viewer_profile_id, target_profile_id) values ('88000000-0000-0000-0000-000000000004', '88000000-0000-0000-0000-000000000003')$$,
  'juftlikni qo''lda yozib bo''lmaydi', '42501');
select pg_temp.superuser();

rollback;
