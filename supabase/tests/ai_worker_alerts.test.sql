-- ISH.UZ · AI yordamchi (ish beruvchi): RLS, limit, mos ishchi e'loni ochilganda darhol xabar, to'lov rejimi
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
-- ishchi e'loni: kasb, hudud, tuman, tajriba, kutilgan maosh; keyin ochiq qilinadi
create or replace function pg_temp.worker(p_user uuid, p_node text, p_region text, p_district text, p_exp text, p_salary int,
  p_headline text default null, p_remote text default 'any', p_status text default 'active') returns uuid language plpgsql as $$
declare wid uuid;
begin
  insert into public.worker_profiles (profile_id, headline, profession_node_id, category_id, region_id, district_id, experience_level,
                                      remote_preference, status, onboarding_completed_at, is_public)
  select p_user, coalesce(p_headline, n.name_uz), n.id, n.category_id, r.id, d.id, p_exp::public.experience_level,
         p_remote::public.remote_preference, p_status::public.worker_status, now(), false
  from public.regions r
  left join public.profession_nodes n on n.slug = p_node
  left join public.districts d on d.region_id = r.id and d.slug = p_district
  where r.slug = p_region
  returning id into wid;
  insert into public.worker_preferences (worker_id, salary_min, salary_type) values (wid, p_salary, 'monthly');
  return wid;
end $$;
create or replace function pg_temp.hits(p_user uuid) returns int language sql as $$
  select count(*)::int from public.notifications where profile_id = p_user and payload->>'kind' = 'ai_worker_alert';
$$;

begin;
-- eski oqim sozlamalari: moderatsiya va to'lovlar — o'z testlarida
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid', 'ai_alerts_paid');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e5400000-0000-0000-0000-000000000001', '+998905400001', now(), '{"first_name":"Restoran","last_name":"Egasi"}'),
  ('e5400000-0000-0000-0000-000000000002', '+998905400002', now(), '{"first_name":"Boshqa","last_name":"Firma"}'),
  ('e5400000-0000-0000-0000-000000000011', '+998905400011', now(), '{"first_name":"Ali","last_name":"Valiyev"}'),
  ('e5400000-0000-0000-0000-000000000012', '+998905400012', now(), '{"first_name":"Yangi","last_name":"Boshlovchi"}'),
  ('e5400000-0000-0000-0000-000000000013', '+998905400013', now(), '{"first_name":"Qimmat","last_name":"Oshpaz"}'),
  ('e5400000-0000-0000-0000-000000000014', '+998905400014', now(), '{"first_name":"Barista","last_name":"B"}'),
  ('e5400000-0000-0000-0000-000000000015', '+998905400015', now(), '{"first_name":"Sergeli","last_name":"S"}'),
  ('e5400000-0000-0000-0000-000000000016', '+998905400016', now(), '{"first_name":"Butun","last_name":"Shahar"}'),
  ('e5400000-0000-0000-0000-000000000017', '+998905400017', now(), '{"first_name":"Samarqand","last_name":"S"}'),
  ('e5400000-0000-0000-0000-000000000018', '+998905400018', now(), '{"first_name":"Izlamayapti","last_name":"N"}'),
  ('e5400000-0000-0000-0000-000000000019', '+998905400019', now(), '{"first_name":"Bloklangan","last_name":"X"}'),
  ('e5400000-0000-0000-0000-000000000020', '+998905400020', now(), '{"first_name":"Operator","last_name":"Uydan"}'),
  ('e5400000-0000-0000-0000-000000000021', '+998905400021', now(), '{"first_name":"Operator","last_name":"Ofis"}'),
  ('e5400000-0000-0000-0000-000000000022', '+998905400022', now(), '{"first_name":"Kechikkan","last_name":"K"}'),
  ('e5400000-0000-0000-0000-000000000023', '+998905400023', now(), '{"first_name":"Obunachi","last_name":"O"}');

-- ---------- RLS va cheklovlar ----------
select pg_temp.login('e5400000-0000-0000-0000-000000000001');
insert into public.ai_worker_alerts (profile_id, prompt, label, profession_node_id, category_id, region_id, district_ids, experience_min_months, salary_max)
select auth.uid(), 'Chilonzor yoki Yunusobodda oshpaz kerak, 2 yildan tajriba, 6 mln gacha', 'Oshpaz · Toshkent', n.id, n.category_id, r.id,
       array(select d.id from public.districts d where d.region_id = r.id and d.slug in ('chilonzor', 'yunusobod')), 24, 6000000
from public.profession_nodes n, public.regions r where n.slug = 'restaurant-cook' and r.slug = 'tashkent_city';
select pg_temp.ok((select count(*) from public.ai_worker_alerts) = 1, 'o''z kuzatuvini ko''radi');
select pg_temp.fails($$insert into public.ai_worker_alerts (profile_id, prompt, label, q) values ('e5400000-0000-0000-0000-000000000002', 'xxx', 'x', 'xx')$$, 'boshqa odam nomidan yaratib bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.ai_worker_alerts (profile_id, prompt, label, q, hits_count) values (auth.uid(), 'oshpaz', 'Oshpaz', 'oshpaz', 50)$$, 'topilganlar sonini o''zi yozib bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.ai_worker_alerts (profile_id, prompt, label) values (auth.uid(), 'nimadir', 'x')$$, 'mezonsiz kuzatuv bo''lmaydi', '23514');
select pg_temp.fails($$update public.ai_worker_alerts set hits_count = 99$$, 'hits_count ni o''zgartirib bo''lmaydi', '42501');
select pg_temp.fails($$insert into public.ai_worker_alert_hits (alert_id, worker_id) select id, id from public.ai_worker_alerts limit 1$$, 'topilganlar jadvaliga yozib bo''lmaydi', '42501');
update public.ai_worker_alerts set is_active = true;
insert into public.ai_worker_alerts (profile_id, prompt, label, q) values (auth.uid(), 'a1a', 'a1', 'aa'), (auth.uid(), 'a2a', 'a2', 'bb');
select pg_temp.fails($$insert into public.ai_worker_alerts (profile_id, prompt, label, q) values (auth.uid(), 'a3a', 'a3', 'cc')$$, '3 tadan ortiq kuzatuv bo''lmaydi', 'ai_alert_limit');
delete from public.ai_worker_alerts where q in ('aa', 'bb');

select pg_temp.login('e5400000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.ai_worker_alerts) = 0, 'begona kuzatuvlar ko''rinmaydi');
-- masofaviy operator kerak (hudud muhim emas)
insert into public.ai_worker_alerts (profile_id, prompt, label, q, remote_only) values (auth.uid(), 'Uydan ishlaydigan operator kerak', 'Operator · masofaviy', 'operator', true);
select pg_temp.anon();
select pg_temp.fails($$select count(*) from public.ai_worker_alerts$$, 'mehmon kuzatuvlarni o''qiy olmaydi', '42501');

-- ---------- ishchilar e'lon joylaydi ----------
select pg_temp.superuser();
-- ishchi o'zi ham oshpaz-kuzatuvchi bo'lsa — o'z e'loni haqida xabar olmaydi
insert into public.ai_worker_alerts (profile_id, prompt, label, profession_node_id, category_id)
select 'e5400000-0000-0000-0000-000000000011', 'oshpaz kerak', 'Oshpaz', n.id, n.category_id from public.profession_nodes n where n.slug = 'restaurant-cook';
create temp table w (k text primary key, id uuid) on commit drop;
insert into w values
  ('mos',        pg_temp.worker('e5400000-0000-0000-0000-000000000011', 'restaurant-banquet-cook', 'tashkent_city', 'chilonzor', '2_3y', 5000000)),
  ('tajribasiz', pg_temp.worker('e5400000-0000-0000-0000-000000000012', 'restaurant-banquet-cook', 'tashkent_city', 'chilonzor', '6_12m', 5000000)),
  ('qimmat',     pg_temp.worker('e5400000-0000-0000-0000-000000000013', 'restaurant-banquet-cook', 'tashkent_city', 'chilonzor', '3_5y', 9000000)),
  ('barista',    pg_temp.worker('e5400000-0000-0000-0000-000000000014', 'restaurant-barista', 'tashkent_city', 'chilonzor', '3_5y', 5000000)),
  ('sergeli',    pg_temp.worker('e5400000-0000-0000-0000-000000000015', 'restaurant-canteen-cook', 'tashkent_city', 'sergeli', '5y_plus', null)),
  ('butun',      pg_temp.worker('e5400000-0000-0000-0000-000000000016', 'restaurant-canteen-cook', 'tashkent_city', null, '2_3y', 4000000)),
  ('samarqand',  pg_temp.worker('e5400000-0000-0000-0000-000000000017', 'restaurant-canteen-cook', 'samarkand', null, '2_3y', 4000000)),
  ('izlamaydi',  pg_temp.worker('e5400000-0000-0000-0000-000000000018', 'restaurant-canteen-cook', 'tashkent_city', 'chilonzor', '2_3y', 4000000, null, 'any', 'not_looking')),
  ('bloklangan', pg_temp.worker('e5400000-0000-0000-0000-000000000019', 'restaurant-canteen-cook', 'tashkent_city', 'chilonzor', '2_3y', 4000000)),
  ('uydan',      pg_temp.worker('e5400000-0000-0000-0000-000000000020', null, 'samarkand', null, '1_2y', 3000000, 'Call-markaz operatori', 'yes')),
  ('ofis',       pg_temp.worker('e5400000-0000-0000-0000-000000000021', null, 'samarkand', null, '1_2y', 3000000, 'Operator', 'no'));
-- Sergelidagi ishchi Yunusobodda ham ishlay oladi (qo'shimcha tuman)
insert into public.worker_locations (worker_id, district_id)
select (select id from w where k = 'sergeli'), d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' and d.slug = 'yunusobod';
update public.profiles set is_blocked = true where id = 'e5400000-0000-0000-0000-000000000019';

select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000001') = 0, 'e''lon hali ochiq emas — xabar yo''q');
update public.worker_profiles set is_public = true where id in (select id from w);

select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000001') = 3, 'faqat mos ishchilar: 3 ta xabar (mos, qo''shimcha tuman, butun shahar)');
select pg_temp.ok(exists (select 1 from public.notifications n where n.profile_id = 'e5400000-0000-0000-0000-000000000001' and n.link = '/listing/' || (select id from w where k = 'mos')), 'mos ishchi: havola e''longa');
select pg_temp.ok(exists (select 1 from public.notifications n where n.profile_id = 'e5400000-0000-0000-0000-000000000001' and n.link = '/listing/' || (select id from w where k = 'sergeli')), 'qo''shimcha tuman (Yunusobod) hisobga olinadi');
select pg_temp.ok(exists (select 1 from public.notifications n where n.profile_id = 'e5400000-0000-0000-0000-000000000001' and n.link = '/listing/' || (select id from w where k = 'butun')), 'butun shahar bo''ylab ishlaydigan ishchi mos');
select pg_temp.ok(not exists (select 1 from public.notifications n where n.profile_id = 'e5400000-0000-0000-0000-000000000001'
  and n.link in (select '/listing/' || id from w where k in ('tajribasiz', 'qimmat', 'barista', 'samarqand', 'izlamaydi', 'bloklangan'))),
  'tajriba, byudjet, kasb, hudud, "izlamayapti" va bloklangan — xabar yo''q');
select pg_temp.ok((select payload->>'name' = 'Ali V.' and payload->>'experience' = '2_3y' and payload->>'profession' = 'Banket (to''y) oshpazi'
                          and (payload->>'salary')::int = 5000000 and payload->>'region' like 'Toshkent%Chilonzor%' and tg_status = 'queued'
                   from public.notifications where profile_id = 'e5400000-0000-0000-0000-000000000001' and link = '/listing/' || (select id from w where k = 'mos')),
  'xabarda ism (familiya bosh harfi), kasb, hudud, tajriba, maosh; Telegram navbatida');
select pg_temp.ok(not exists (select 1 from public.notifications where payload->>'kind' = 'ai_worker_alert' and payload::text ~ '\+998|998905'), 'xabarda telefon raqami yo''q');
select pg_temp.ok(not exists (select 1 from public.notifications where profile_id = 'e5400000-0000-0000-0000-000000000011'
  and link = '/listing/' || (select id from w where k = 'mos')) and pg_temp.hits('e5400000-0000-0000-0000-000000000011') > 0,
  'o''z e''loni haqida xabar yo''q (boshqa oshpazlar haqida — bor)');
select pg_temp.ok((select hits_count from public.ai_worker_alerts where profile_id = 'e5400000-0000-0000-0000-000000000001') = 3, 'topilganlar soni 3');

-- masofaviy: faqat uydan ishlashga tayyor operator
select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000002') = 1, 'masofaviy kuzatuv: hudud ahamiyatsiz, faqat uydan ishlashga tayyor');
select pg_temp.ok((select link = '/listing/' || (select id from w where k = 'uydan') from public.notifications where profile_id = 'e5400000-0000-0000-0000-000000000002' and payload->>'kind' = 'ai_worker_alert'), 'operator (uydan) topildi');

-- qayta ochilganda takror yo'q
update public.worker_profiles set is_public = false where id = (select id from w where k = 'mos');
update public.worker_profiles set is_public = true where id = (select id from w where k = 'mos');
select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000001') = 3, 'qayta ochilganda takrorlanmaydi');

-- egasi kuzatuvni o'chirdi — jim
update public.ai_worker_alerts set is_active = false where profile_id = 'e5400000-0000-0000-0000-000000000001';
insert into w values ('ochiq1', pg_temp.worker('e5400000-0000-0000-0000-000000000022', 'restaurant-canteen-cook', 'tashkent_city', 'chilonzor', '5y_plus', 4000000));
update public.worker_profiles set is_public = true where id = (select id from w where k = 'ochiq1');
select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000001') = 3, 'o''chirilgan kuzatuv jim');

-- ---------- pullik rejim: obunasizlar jim, to'lovdan keyin xabar ----------
update public.ai_worker_alerts set is_active = true;
update public.app_settings set value = 'true'::jsonb where key = 'ai_alerts_paid';
insert into w values ('obuna1', pg_temp.worker('e5400000-0000-0000-0000-000000000023', 'restaurant-canteen-cook', 'tashkent_city', 'yunusobod', '5y_plus', 4000000));
update public.worker_profiles set is_public = true where id = (select id from w where k = 'obuna1');
select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000001') = 3, 'obunasiz — xabar yo''q');

-- bitta to'lov: AI yordamchi ikkala yo'nalish uchun (ish ham, ishchi ham)
select pg_temp.login('e5400000-0000-0000-0000-000000000001');
select pg_temp.ok((public.create_payment('ai_alerts', null) ->> 'amount')::int = 15000, 'ish beruvchi ham AI yordamchi uchun to''lov yaratadi (15 000 so''m)');
select pg_temp.superuser();
update public.payments set status = 'paid', paid_at = now() where profile_id = 'e5400000-0000-0000-0000-000000000001' and purpose = 'ai_alerts';
select public.apply_payment_internal((select id from public.payments where profile_id = 'e5400000-0000-0000-0000-000000000001' and purpose = 'ai_alerts'));
update public.worker_profiles set is_public = false where id = (select id from w where k = 'obuna1');
update public.worker_profiles set is_public = true where id = (select id from w where k = 'obuna1');
select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000001') = 4, 'obuna bilan xabar keladi');
select pg_temp.ok(pg_temp.hits('e5400000-0000-0000-0000-000000000002') = 1, 'boshqa (obunasiz) ish beruvchi jim');

rollback;
\echo '✓ AI yordamchi (ish beruvchi) testlari o''tdi'
