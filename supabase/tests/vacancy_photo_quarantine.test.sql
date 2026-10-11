-- 0058 · ish joyi surati: yopiq karantin, mijoz "v-" (tekshirilgan) faylga tega olmaydi, vakansiyaga faqat tekshirilgan yo'l,
--        eski yo'llar saqlanadi, tashlab ketilgan fayllar ro'yxati faqat service role uchun
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2', 'iat', extract(epoch from now())::bigint + 5)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
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
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid');

-- haqiqiy Supabase'dagi kabi jadval huquqlari (stub'da yo'q); RLS siyosatlari cheklaydi
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter table storage.objects enable row level security;
-- faqat shu testda: o'z papkasini ko'rish (UPDATE/DELETE siyosatlarini alohida tekshirish uchun)
create policy "t_vacancy_photos_read" on storage.objects for select to authenticated using (bucket_id in ('vacancy-photos', 'vacancy-uploads') and (storage.foldername(name))[1] = auth.uid()::text);

create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by depth limit 1) as node,
  (select id from public.regions where slug = 'tashkent_city') as region,
  (select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' order by d.sort_order limit 1) as district,
  '5d000000-0000-0000-0000-000000000001'::uuid as a,
  '5d000000-0000-0000-0000-000000000002'::uuid as b,
  repeat('ab', 32) as h1,
  repeat('cd', 32) as h2,
  repeat('ef', 32) as h3;
grant select on fx to authenticated;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('5d000000-0000-0000-0000-000000000001', '+998907200001', now(), '{"first_name":"Aziz"}'),
  ('5d000000-0000-0000-0000-000000000002', '+998907200002', now(), '{"first_name":"Bek"}');
insert into public.profile_contacts (profile_id, phone, phone_verified_at) values
  ('5d000000-0000-0000-0000-000000000001', '+998907200001', now()),
  ('5d000000-0000-0000-0000-000000000002', '+998907200002', now())
on conflict (profile_id) do update set phone = excluded.phone;

select pg_temp.ok((select not public from storage.buckets where id = 'vacancy-uploads'), 'karantin bucket yopiq');

-- ===== Storage siyosatlari =====
select pg_temp.login('5d000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) values ('vacancy-uploads', '5d000000-0000-0000-0000-000000000001/0b000000-0000-4000-8000-000000000001.jpg');
select pg_temp.ok(true, 'karantinga o''z papkasiga yuklash mumkin');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('vacancy-uploads', '5d000000-0000-0000-0000-000000000002/0b000000-0000-4000-8000-000000000002.jpg')$$,
  'karantin: boshqa foydalanuvchi papkasiga — rad', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('vacancy-uploads', '5d000000-0000-0000-0000-000000000001/' || (select 'v-' || h1 from fx) || '.webp')$$,
  'karantin: ixtiyoriy nom (v-...) — rad', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('vacancy-uploads', '5d000000-0000-0000-0000-000000000001/sub/0b000000-0000-4000-8000-000000000003.jpg')$$,
  'karantin: ichki papka — rad', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('vacancy-photos', '5d000000-0000-0000-0000-000000000001/' || (select 'v-' || h1 from fx) || '.webp')$$,
  'ommaviy bucket: mijoz tekshirilgan nomli fayl yarata olmaydi', '42501');
insert into storage.objects (bucket_id, name) values ('vacancy-photos', '5d000000-0000-0000-0000-000000000001/0b000000-0000-4000-8000-000000000004.jpg');
select pg_temp.ok(true, 'eski usul (ommaviy bucket, xom nom) ishlashda davom etadi');

-- server tekshirilgan faylni yozadi
select pg_temp.service();
insert into storage.objects (bucket_id, name) select 'vacancy-photos', a || '/v-' || h1 || '.webp' from fx;

select pg_temp.login('5d000000-0000-0000-0000-000000000001');
update storage.objects set metadata = '{"x":1}'::jsonb where bucket_id = 'vacancy-photos' and name like '%/v-%';
delete from storage.objects where bucket_id = 'vacancy-photos' and name like '%/v-%';
select pg_temp.superuser();
select pg_temp.ok((select count(*) = 1 and bool_and(metadata is null) from storage.objects where bucket_id = 'vacancy-photos' and name like '%/v-%'),
  'mijoz tekshirilgan faylni o''zgartira ham, o''chira ham olmaydi');

-- ===== Vakansiyaga faqat tekshirilgan yo'l =====
create temp table vl on commit drop as
select jsonb_build_object('client_ref', gen_random_uuid(), 'profession_node_id', node, 'region_id', region, 'district_id', district, 'employer_type', 'person',
  'org_name', 'Bek savdo', 'contact_phone', '+998907200002', 'description', 'Do''konga sotuvchi kerak, ish vaqti 9 dan 18 gacha', 'salary_negotiable', true,
  'show_phone', true) as p from fx;
grant select on vl to authenticated;

select pg_temp.login('5d000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.save_simple_vacancy((select p || jsonb_build_object('photo_path', b || '/0b000000-0000-4000-8000-000000000005.jpg') from vl, fx))$$,
  'RPC: xom (tekshirilmagan) yo''l — rad', 'photo_not_verified');
select pg_temp.fails($$select public.save_simple_vacancy((select p || jsonb_build_object('photo_path', a || '/v-' || h1 || '.webp') from vl, fx))$$,
  'RPC: boshqa foydalanuvchining tekshirilgan fayli — rad', 'photo');
select pg_temp.fails($$select public.save_simple_vacancy((select p || jsonb_build_object('photo_path', b || '/v-' || h2 || '.png') from vl, fx))$$,
  'RPC: noto''g''ri kengaytma — rad', 'photo');
create temp table vres on commit drop as select public.save_simple_vacancy((select p || jsonb_build_object('photo_path', b || '/v-' || h2 || '.webp') from vl, fx)) as r;
grant select on vres to authenticated;
select pg_temp.ok((select v.photo_path = (select b || '/v-' || h2 || '.webp' from fx) from public.vacancies v where v.id = ((select r from vres) ->> 'vacancy_id')::uuid),
  'RPC: tekshirilgan yo''l saqlandi');
select pg_temp.fails($$update public.vacancies set photo_path = (select b || '/0b000000-0000-4000-8000-000000000006.png' from fx) where id = ((select r from vres) ->> 'vacancy_id')::uuid$$,
  'jadvalga to''g''ridan-to''g''ri xom yo''l — rad', 'photo_not_verified');

-- eski (0058 dan oldingi) yo'l: o'zgarmasa tahrir ishlaydi, mavjud rasm yo'qolmaydi
select pg_temp.service();
update public.vacancies set photo_path = (select b || '/0b000000-0000-4000-8000-000000000007.jpg' from fx) where id = ((select r from vres) ->> 'vacancy_id')::uuid;
select pg_temp.ok(true, 'server (service role) eski/maxsus yo''lni yoza oladi');
select pg_temp.login('5d000000-0000-0000-0000-000000000002');
select public.save_simple_vacancy((select p || jsonb_build_object('vacancy_id', (select r from vres) ->> 'vacancy_id', 'photo_path', b || '/0b000000-0000-4000-8000-000000000007.jpg',
  'description', 'Do''konga sotuvchi kerak, ish vaqti 9 dan 19 gacha') from vl, fx));
select pg_temp.ok((select v.photo_path like '%0b000000-0000-4000-8000-000000000007.jpg' and v.description like '%19 gacha' from public.vacancies v where v.id = ((select r from vres) ->> 'vacancy_id')::uuid),
  'eski yo''l o''zgarmasa — tahrir saqlanadi, rasm joyida');
update public.vacancies set photo_path = null where id = ((select r from vres) ->> 'vacancy_id')::uuid;
select pg_temp.ok((select v.photo_path is null from public.vacancies v where v.id = ((select r from vres) ->> 'vacancy_id')::uuid), 'rasmni olib tashlash mumkin');
update public.vacancies set photo_path = (select b || '/v-' || h2 || '.webp' from fx) where id = ((select r from vres) ->> 'vacancy_id')::uuid;

-- ===== Tashlab ketilgan fayllar =====
select pg_temp.superuser();
insert into storage.objects (bucket_id, name, created_at)
select x.bucket, x.name, now() - x.age from fx, lateral (values
  ('vacancy-uploads', a || '/0c000000-0000-4000-8000-000000000001.jpg', interval '2 days', true),   -- eski karantin
  ('vacancy-uploads', a || '/0c000000-0000-4000-8000-000000000002.jpg', interval '1 hour', false),  -- yangi karantin (hali ishlov kutmoqda)
  ('vacancy-photos', a || '/0c000000-0000-4000-8000-000000000003.jpg', interval '2 days', true),    -- eski xom, hech kim ishlatmaydi
  ('vacancy-photos', b || '/0b000000-0000-4000-8000-000000000008.jpg', interval '30 days', false),  -- eski xom, vakansiyada (pastda)
  ('vacancy-photos', a || '/v-' || h3 || '.webp', interval '3 days', false),                       -- tekshirilgan, qoralamada bo'lishi mumkin
  ('vacancy-photos', a || '/v-' || repeat('12', 32) || '.webp', interval '20 days', true),          -- tekshirilgan, 20 kun ishlatilmagan
  ('vacancy-photos', b || '/v-' || h2 || '.webp', interval '20 days', false)                        -- tekshirilgan, vakansiyada
) as x(bucket, name, age, stale);
insert into public.vacancies (owner_profile_id, title, region_id, district_id, description, status, photo_path, profession_node_id)
select b, 'Eski e''lon', region, district, 'Eski usulda yuklangan rasm bilan e''lon', 'draft', b || '/0b000000-0000-4000-8000-000000000008.jpg', node from fx;

select pg_temp.service();
create temp table stale on commit drop as select * from public.stale_raw_vacancy_photos(100);
select pg_temp.superuser();
select pg_temp.ok((select count(*) = 3 from stale where name in (
    (select a || '/0c000000-0000-4000-8000-000000000001.jpg' from fx), (select a || '/0c000000-0000-4000-8000-000000000003.jpg' from fx),
    (select a || '/v-' || repeat('12', 32) || '.webp' from fx))),
  'eski karantin, ishlatilmagan eski xom va 15 kundan eski ishlatilmagan tekshirilgan fayl ro''yxatda');
select pg_temp.ok((select count(*) = 0 from stale where name like '%0c000000-0000-4000-8000-000000000002%' or name like '%0b000000-0000-4000-8000-000000000008%'
    or name = (select a || '/v-' || h3 || '.webp' from fx) or name = (select b || '/v-' || h2 || '.webp' from fx)),
  'yangi karantin, vakansiyadagi (eski va tekshirilgan) va yaqinda tekshirilgan fayllar ro''yxatda yo''q');
select pg_temp.service();
select pg_temp.ok((select count(*) = 1 from public.stale_raw_vacancy_photos(1)), 'limit hurmat qilinadi');

select pg_temp.login('5d000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select * from public.stale_raw_vacancy_photos(10)$$, 'mijoz tozalash ro''yxatini ola olmaydi', '42501');
select pg_temp.ok((select public.simple_listing_features() ->> 'photo_quarantine') = 'true', 'imkoniyat bayrog''i: photo_quarantine');
select pg_temp.superuser();
rollback;
\echo '✓ ish joyi surati karantin testlari o''tdi'
