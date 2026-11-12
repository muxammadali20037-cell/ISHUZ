-- 0076 · Universal ustalar: alohida jadvallar, RLS, moderatsiya, telefon maxfiyligi, demo e'lonlar, reyting faqat sharhdan.
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

begin;

-- U: usta (e'lon egasi) · M: mijoz · A: moderator admin
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('c7600000-0000-0000-0000-00000000000a', '+998909760001', now(), '{"first_name":"Usta","last_name":"U"}'),
  ('c7600000-0000-0000-0000-00000000000b', '+998909760002', now(), '{"first_name":"Mijoz","last_name":"M"}'),
  ('c7600000-0000-0000-0000-00000000000c', '+998909760003', now(), '{"first_name":"Admin","last_name":"A"}');
insert into public.admin_users (profile_id, role) values ('c7600000-0000-0000-0000-00000000000c', 'moderator');

-- ===== 1. Demo e'lonlar: har kategoriyaga 4 ta, telefonsiz, egasiz; ro'yxatda demo belgisi =====
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.master_listings where is_demo) = 4 * (select count(*) from public.master_categories where is_active), 'har kategoriyada 4 ta demo e''lon');
select pg_temp.ok((select count(*) from public.master_listings where is_demo and (phone is not null or phone_public or owner_profile_id is not null or rating_avg is not null)) = 0, 'demo: telefon, egasi va reyting yo''q');
select pg_temp.ok((select public.master_demo_seed()) = 0, 'seed takrorlansa — qo''shilmaydi (idempotent)');

-- ===== 2. Mehmon: jadvalga kira olmaydi, faqat funksiyalar; ro'yxatda telefon ustuni yo'q =====
select pg_temp.anon();
select pg_temp.fails($$select * from public.master_listings$$, 'mehmon e''lonlar jadvalini o''qimaydi', '42501');
select pg_temp.ok((select count(*) from public.master_listings_public(p_limit => 60)) = 48, 'mehmon ro''yxatni funksiya orqali ko''radi (demo belgisi bilan)');
select pg_temp.ok((select bool_and(is_demo) from public.master_listings_public(p_limit => 60)), 'hozircha hammasi demo');
select pg_temp.ok((select count(*) from public.master_category_counts() where active_count = 4 and real_count = 0) = 12, 'kategoriya sonlari: 4 faol, 0 haqiqiy');
select pg_temp.fails($$select public.master_demo_remove()$$, 'mehmon demo e''lonlarni o''chira olmaydi', '42501');
select pg_temp.fails($$select public.master_demo_seed()$$, 'mehmon demo e''lon yarata olmaydi', '42501');
select pg_temp.fails($$select public.master_request_create((select id from public.master_listings_public(p_limit => 1)), 'Ali', '+998901112233', 'salom')$$, 'mehmon so''rov funksiyasini to''g''ridan-to''g''ri chaqira olmaydi (faqat server)', '42501');
select pg_temp.fails($$select public.master_listing_hit((select id from public.master_listings_public(p_limit => 1)), 'view')$$, 'mehmon hisoblagichni to''g''ridan-to''g''ri oshira olmaydi (faqat server)', '42501');
select pg_temp.fails($$select public.master_review_add((select id from public.master_listings_public(p_limit => 1)), 5)$$, 'mehmon sharh funksiyasini chaqira olmaydi', '42501');
select pg_temp.fails($$select public.master_moderate((select id from public.master_listings_public(p_limit => 1)), 'approve')$$, 'mehmon moderatsiya funksiyasini chaqira olmaydi', '42501');
select pg_temp.superuser();
select pg_temp.fails($$select public.master_request_create((select id from public.master_listings where is_demo limit 1), 'Ali', '+998901112233', 'salom')$$, 'demo e''longa so''rov yuborib bo''lmaydi (server orqali ham)', 'master_listing_not_found');

-- ===== 3. Usta: e'lon yaratadi (draft), yuboradi (pending_review); 'active' ni o'zi qo'ya olmaydi =====
select pg_temp.login('c7600000-0000-0000-0000-00000000000a');
insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, experience_years, region_id, phone, phone_public, price_negotiable)
values ('c7600000-0000-0000-0000-00000000000a', (select id from public.master_categories where slug = 'plumber'), 'usta-test-1', 'Usta U', 'Santexnik — har qanday ish',
        'Quvur, kran, isitish tizimi. Toshkent bo''ylab chiqaman.', 6, (select id from public.regions where slug = 'tashkent_city'), '+998909760001', true, true);
select pg_temp.ok((select status from public.master_listings where slug = 'usta-test-1') = 'draft', 'yangi e''lon — qoralama');
select pg_temp.fails($$update public.master_listings set status = 'active' where slug = 'usta-test-1'$$, 'egasi o''zi faollashtira olmaydi', 'master_listing_status_transition');
select pg_temp.fails($$insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, status) values ('c7600000-0000-0000-0000-00000000000a', (select id from public.master_categories where slug = 'plumber'), 'usta-test-x', 'Usta U', 'Sarlavha', 'Tavsif tavsif tavsif', 'active')$$, 'faol holat bilan yaratib bo''lmaydi', 'master_listing_insert_fields');
select pg_temp.fails($$insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, is_demo) values (null, (select id from public.master_categories where slug = 'plumber'), 'usta-test-y', 'Demo', 'Sarlavha', 'Tavsif tavsif tavsif', true)$$, 'foydalanuvchi demo e''lon yarata olmaydi', '42501');
select pg_temp.fails($$insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description) values ('c7600000-0000-0000-0000-00000000000b', (select id from public.master_categories where slug = 'plumber'), 'usta-test-z', 'Boshqa', 'Sarlavha', 'Tavsif tavsif tavsif')$$, 'boshqa odam nomidan yaratib bo''lmaydi', '42501');
select pg_temp.fails($$update public.master_listings set photos = array['c7600000-0000-0000-0000-00000000000b/v-' || repeat('a', 64) || '.webp'] where slug = 'usta-test-1'$$, 'boshqa odam papkasidagi rasm yozilmaydi', 'master_listing_photo_path');
select pg_temp.fails($$update public.master_listings set photos = array['c7600000-0000-0000-0000-00000000000a/' || gen_random_uuid() || '.jpg'] where slug = 'usta-test-1'$$, 'tekshirilmagan (karantin) rasm yo''li yozilmaydi', 'master_listing_photo_path');
update public.master_listings set photos = array['c7600000-0000-0000-0000-00000000000a/v-' || repeat('b', 64) || '.webp'] where slug = 'usta-test-1';
select pg_temp.ok((select cardinality(photos) from public.master_listings where slug = 'usta-test-1') = 1, 'o''z papkasidagi tekshirilgan rasm yoziladi');
update public.master_listings set status = 'pending_review' where slug = 'usta-test-1';
select pg_temp.ok((select status from public.master_listings where slug = 'usta-test-1') = 'pending_review', 'moderatsiyaga yuborildi');
select pg_temp.ok((select count(*) from public.master_listings_public(p_limit => 60) where not is_demo) = 0, 'moderatsiyadagi e''lon ommaga ko''rinmaydi');
select pg_temp.fails($$select public.master_moderate((select id from public.master_listings where slug = 'usta-test-1'), 'approve')$$, 'oddiy foydalanuvchi moderatsiya qila olmaydi', '42501');

-- ===== 4. Admin tasdiqlaydi → faol; telefon faqat rozilik bilan, ro'yxatda hech qachon =====
select pg_temp.login('c7600000-0000-0000-0000-00000000000c');
select pg_temp.ok((select public.master_moderate((select id from public.master_listings where slug = 'usta-test-1'), 'approve')) = 'active', 'admin tasdiqladi');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.master_listings_public(p_limit => 60) where not is_demo) = 1, 'faol e''lon ro''yxatda');
select pg_temp.ok((select id from public.master_listings_public(p_limit => 1)) = (select id from public.master_listings_public(p_limit => 60) where not is_demo), 'haqiqiy e''lon demodan avval');
select pg_temp.ok((select phone from public.master_listing_public('usta-test-1')) = '+998909760001', 'egasi rozilik bergan — telefon e''lon sahifasida');
select pg_temp.superuser();
update public.master_listings set phone_public = false where slug = 'usta-test-1';
select pg_temp.anon();
select pg_temp.ok((select phone from public.master_listing_public('usta-test-1')) is null, 'rozilik olib tashlansa — telefon ko''rinmaydi');
select pg_temp.fails($$select phone from public.master_listings_public(p_limit => 1)$$, 'ro''yxat funksiyasida telefon ustuni umuman yo''q', '42703');

-- ===== 5. Mijoz so'rovi va hisoblagich — faqat server (service_role) orqali; egasi ko'radi, boshqa ko'rmaydi =====
select pg_temp.login('c7600000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.master_request_create((select id from public.master_listings_public(p_limit => 1)), 'Ali', '+998901112233', 'x')$$, 'kirgan foydalanuvchi ham so''rov funksiyasini to''g''ridan-to''g''ri chaqira olmaydi', '42501');
select pg_temp.fails($$select public.master_listing_hit((select id from public.master_listings_public(p_limit => 1)), 'phone')$$, 'kirgan foydalanuvchi hisoblagichni to''g''ridan-to''g''ri oshira olmaydi', '42501');
select pg_temp.superuser();
set role service_role;
select pg_temp.ok((select public.master_request_create((select id from public.master_listings where slug = 'usta-test-1'), 'Ali', '+998901112233', 'Ertaga kelasizmi?', null)) is not null, 'server: mehmon so''rovi yozildi');
select pg_temp.fails($$select public.master_request_create((select id from public.master_listings where slug = 'usta-test-1'), 'Usta U', '+998909760001', 'o''zimga', 'c7600000-0000-0000-0000-00000000000a')$$, 'o''z e''loniga so''rov yuborib bo''lmaydi', 'master_request_own');
select public.master_listing_hit((select id from public.master_listings where slug = 'usta-test-1'), 'view');
select public.master_listing_hit((select id from public.master_listings where slug = 'usta-test-1'), 'phone');
select public.master_listing_hit((select id from public.master_listings where is_demo limit 1), 'view');
reset role;
select pg_temp.ok((select coalesce(sum(views_count), 0) from public.master_listings where is_demo) = 0, 'demo e''londa ko''rish hisoblanmaydi');
select pg_temp.login('c7600000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.master_requests) = 0, 'begona foydalanuvchi so''rovlarni ko''rmaydi');
select pg_temp.fails($$insert into public.master_requests (listing_id, client_name, client_phone) values ((select id from public.master_listings_public(p_limit => 1)), 'X', '+998901112233')$$, 'so''rov jadvalga to''g''ridan-to''g''ri yozilmaydi', '42501');
select pg_temp.login('c7600000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.master_requests) = 1, 'egasi so''rovni ko''radi');
select pg_temp.ok((select views_count = 1 and phone_clicks_count = 1 from public.master_listings where slug = 'usta-test-1'), 'ko''rish va telefon hisoblagichlari');
update public.master_requests set status = 'seen';
select pg_temp.ok((select status from public.master_requests limit 1) = 'seen', 'egasi so''rov holatini belgilaydi');

-- ===== 6. Sharh: faqat kirgan, egasi emas, bir marta; reyting faqat sharhdan; demo e'longa yo'q =====
select pg_temp.login('c7600000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.master_review_add((select id from public.master_listings where slug = 'usta-test-1'), 5, 'o''zimga')$$, 'egasi o''ziga sharh yoza olmaydi', 'master_review_own');
select pg_temp.login('c7600000-0000-0000-0000-00000000000b');
select public.master_review_add((select id from public.master_listings_public(p_limit => 1)), 4, 'Tez keldi, toza ishladi');
select public.master_review_add((select id from public.master_listings_public(p_limit => 1)), 5, 'Yangilangan baho');
select pg_temp.ok((select count(*) from public.master_reviews) = 1, 'bitta foydalanuvchi — bitta sharh (yangilanadi)');
select pg_temp.ok((select rating_avg = 5 and rating_count = 1 from public.master_listings_public(p_limit => 60) where slug = 'usta-test-1'), 'reyting haqiqiy sharhdan hisoblandi');
select pg_temp.fails($$insert into public.master_reviews (listing_id, author_profile_id, rating) values ((select id from public.master_listings_public(p_limit => 1)), 'c7600000-0000-0000-0000-00000000000b', 5)$$, 'sharh jadvalga to''g''ridan-to''g''ri yozilmaydi', '42501');
select pg_temp.fails($$select public.master_review_add((select id from public.master_listings_public(p_limit => 60) where is_demo limit 1), 5, 'demo')$$, 'demo e''longa sharh yo''q', 'master_listing_not_found');
select pg_temp.anon();
select pg_temp.fails($$select public.master_review_add((select id from public.master_listings_public(p_limit => 1)), 5)$$, 'mehmon sharh yoza olmaydi', '42501');

-- ===== 7. Egasi faol e'lonni tahrirlasa — qayta moderatsiya; yashirish/qaytarish erkin; rad etish sababi =====
select pg_temp.login('c7600000-0000-0000-0000-00000000000a');
update public.master_listings set status = 'hidden' where slug = 'usta-test-1';
select pg_temp.ok((select status from public.master_listings where slug = 'usta-test-1') = 'hidden', 'egasi yashirdi');
update public.master_listings set status = 'active' where slug = 'usta-test-1';
select pg_temp.ok((select status from public.master_listings where slug = 'usta-test-1') = 'active', 'o''zgarishsiz qaytardi — moderatsiyasiz');
update public.master_listings set title = 'Santexnik — yangi sarlavha' where slug = 'usta-test-1';
select pg_temp.ok((select status from public.master_listings where slug = 'usta-test-1') = 'pending_review', 'mazmun o''zgardi — qayta moderatsiya');
select pg_temp.fails($$update public.master_listings set views_count = 999 where slug = 'usta-test-1'$$, 'hisoblagichni egasi o''zgartira olmaydi', 'master_listing_readonly_fields');
select pg_temp.login('c7600000-0000-0000-0000-00000000000c');
select pg_temp.ok((select public.master_moderate((select id from public.master_listings where slug = 'usta-test-1'), 'reject', 'Tavsif yetarli emas')) = 'rejected', 'admin rad etdi');
select pg_temp.login('c7600000-0000-0000-0000-00000000000a');
select pg_temp.ok((select reject_reason from public.master_listings where slug = 'usta-test-1') = 'Tavsif yetarli emas', 'egasi rad sababini ko''radi');
update public.master_listings set description = 'Quvur, kran, isitish tizimi, hammom va oshxona santexnikasi — kafolat bilan.' where slug = 'usta-test-1';
select pg_temp.ok((select status from public.master_listings where slug = 'usta-test-1') = 'pending_review', 'tuzatib qayta yubordi');

-- ===== 8. Demo e'lonlarni olib tashlash — faqat admin/server; haqiqiy e'longa tegmaydi =====
select pg_temp.login('c7600000-0000-0000-0000-00000000000c');
select pg_temp.ok((select public.master_demo_remove()) = 48, 'admin demo e''lonlarni bir buyruqda olib tashladi');
select pg_temp.ok((select count(*) from public.master_listings) = 1, 'haqiqiy e''lon qoldi');

-- oddiy foydalanuvchi (admin emas): funksiyani chaqira oladi, lekin ichki tekshiruvdan o'tmaydi
select pg_temp.login('c7600000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.master_demo_seed()$$, 'oddiy foydalanuvchi demo e''lon yarata olmaydi', 'forbidden');
select pg_temp.fails($$select public.master_demo_remove()$$, 'oddiy foydalanuvchi demo e''lonlarni o''chira olmaydi', 'forbidden');

-- baza operatori: vosita "SET ROLE postgres" qilgan bo'lsa ham (ba'zi CLI/boshqaruv vositalari) migratsiya oxiridagi seed va
-- qo'lda buyruqlar ishlaydi — egasi 0076 ni qo'llaganda "forbidden" bilan to'xtab qolmasin
select pg_temp.superuser();
set role postgres;
select pg_temp.ok((select public.master_demo_seed()) = 48, 'operator (SET ROLE postgres) demo e''lonlarni qaytaradi');
select pg_temp.ok((select public.master_demo_remove()) = 48, 'operator (SET ROLE postgres) demo e''lonlarni olib tashlaydi');
reset role;
select pg_temp.ok((select count(*) from public.master_listings) = 1, 'operator buyruqlari haqiqiy e''longa tegmadi');

rollback;
