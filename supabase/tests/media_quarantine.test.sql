-- 0059 · profil rasmi va logotip: yopiq karantin (o'z papkasi / kompaniya admini), mijoz "v-" faylga tega olmaydi,
--        profil/kompaniyaga faqat tekshirilgan manzil (eski qiymatlar saqlanadi), qolib ketgan fayllar — faqat service role
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
update public.app_settings set value = '"https://x.supabase.co"'::jsonb where key = 'storage_public_origin';

grant select, insert, update, delete on storage.objects to anon, authenticated;
alter table storage.objects enable row level security;
-- faqat shu testda: o'z papkasini ko'rish (UPDATE/DELETE siyosatlarini alohida tekshirish uchun)
create policy "t_media_read" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'company-logos', 'media-uploads'));

create temp table fx on commit drop as
select
  '5e000000-0000-0000-0000-000000000001'::uuid as a,
  '5e000000-0000-0000-0000-000000000002'::uuid as b,
  repeat('ab', 32) as h1,
  repeat('cd', 32) as h2,
  'https://x.supabase.co/storage/v1/object/public' as origin;
grant select on fx to authenticated;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('5e000000-0000-0000-0000-000000000001', '+998907300001', now(), '{"first_name":"Aziz"}'),
  ('5e000000-0000-0000-0000-000000000002', '+998907300002', now(), '{"first_name":"Bek"}');
insert into public.companies (name, created_by) values ('Media MChJ', '5e000000-0000-0000-0000-000000000001');
insert into public.company_members (company_id, profile_id, role)
select id, '5e000000-0000-0000-0000-000000000001', 'owner' from public.companies where name = 'Media MChJ' on conflict do nothing;
create temp table co on commit drop as select id as c from public.companies where name = 'Media MChJ';
grant select on co to authenticated;

select pg_temp.ok((select not public and file_size_limit = 5242880 from storage.buckets where id = 'media-uploads'), 'karantin bucket yopiq, 5 MB');
select pg_temp.ok((select (public.simple_listing_features() ->> 'media_quarantine')::boolean), 'imkoniyat bayrog''i: media_quarantine');

-- ===== Karantin: profil rasmi — faqat o'z papkasi =====
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) select 'media-uploads', 'avatar/' || a || '/0d000000-0000-4000-8000-000000000001.jpg' from fx;
select pg_temp.ok(true, 'avatar: o''z papkasiga yuklash mumkin');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'media-uploads', 'avatar/' || b || '/0d000000-0000-4000-8000-000000000002.jpg' from fx$$,
  'avatar: boshqa foydalanuvchi papkasi — rad', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'media-uploads', 'avatar/' || a || '/0d000000-0000-4000-8000-000000000003.svg' from fx$$,
  'avatar: SVG nom — rad', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'media-uploads', a || '/0d000000-0000-4000-8000-000000000004.jpg' from fx$$,
  'karantin: tur papkasisiz (eski shakl) — rad', '42501');

-- ===== Karantin: logotip — faqat kompaniya admini =====
insert into storage.objects (bucket_id, name) select 'media-uploads', 'logo/' || c || '/0d000000-0000-4000-8000-000000000005.png' from co;
select pg_temp.ok(true, 'logo: kompaniya admini yuklaydi');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('media-uploads', 'logo/not-a-uuid/0d000000-0000-4000-8000-000000000006.png')$$,
  'logo: uuid bo''lmagan papka — rad (cast xatosisiz)', '42501');
select pg_temp.login('5e000000-0000-0000-0000-000000000002');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'media-uploads', 'logo/' || c || '/0d000000-0000-4000-8000-000000000007.png' from co$$,
  'logo: kompaniya a''zosi bo''lmagan — rad', '42501');
-- karantindagi faylni mijoz o'qiy/almashtira/o'chira olmaydi (UPDATE/DELETE siyosati yo'q)
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
update storage.objects set metadata = '{"x":1}'::jsonb where bucket_id = 'media-uploads';
delete from storage.objects where bucket_id = 'media-uploads';
select pg_temp.superuser();
select pg_temp.ok((select count(*) = 2 and bool_and(metadata is null) from storage.objects where bucket_id = 'media-uploads'), 'karantin: mijoz almashtira ham, o''chira ham olmaydi');

-- ===== Ommaviy bucket'lar: faqat eski nomdagi bitta fayl; "v-" — faqat server =====
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) select 'avatars', a || '/avatar.jpg' from fx;
select pg_temp.ok(true, 'avatars: eski nom (o''tish davri) yozish mumkin');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'avatars', a || '/v-' || h1 || '.webp' from fx$$,
  'avatars: mijoz tekshirilgan nomli fayl yarata olmaydi', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'avatars', a || '/boshqa.jpg' from fx$$,
  'avatars: ixtiyoriy nom (fayl joylash uchun) — rad', '42501');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'avatars', b || '/avatar.jpg' from fx$$,
  'avatars: boshqa papka — rad', '42501');
insert into storage.objects (bucket_id, name) select 'company-logos', c || '/logo.png' from co;
select pg_temp.ok(true, 'company-logos: admin eski nomga yozadi');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'company-logos', c || '/v-' || (select h1 from fx) || '.webp' from co$$,
  'company-logos: mijoz tekshirilgan nomli fayl yarata olmaydi', '42501');
select pg_temp.login('5e000000-0000-0000-0000-000000000002');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) select 'company-logos', c || '/logo.webp' from co$$,
  'company-logos: a''zo bo''lmagan — rad', '42501');

-- server tekshirilgan fayllarni yozadi; mijoz ularni o'zgartira/o'chira olmaydi
select pg_temp.service();
insert into storage.objects (bucket_id, name) select 'avatars', a || '/v-' || h1 || '.webp' from fx;
insert into storage.objects (bucket_id, name) select 'company-logos', c || '/v-' || (select h1 from fx) || '.webp' from co;
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
update storage.objects set metadata = '{"x":1}'::jsonb where bucket_id in ('avatars', 'company-logos') and name like '%/v-%';
delete from storage.objects where bucket_id in ('avatars', 'company-logos') and name like '%/v-%';
delete from storage.objects where bucket_id = 'avatars' and name like '%/avatar.jpg';
select pg_temp.superuser();
select pg_temp.ok((select count(*) = 2 and bool_and(metadata is null) from storage.objects where bucket_id in ('avatars', 'company-logos') and name like '%/v-%'),
  'mijoz tekshirilgan fayllarni o''zgartira ham, o''chira ham olmaydi');
select pg_temp.ok((select count(*) = 0 from storage.objects where bucket_id = 'avatars' and name like '%/avatar.jpg'), 'eski nomdagi o''z faylini o''chira oladi');

-- ===== Profilga faqat tekshirilgan manzil =====
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
select pg_temp.fails($$update public.profiles set avatar_url = (select origin || '/avatars/' || a || '/avatar.jpg?v=1' from fx) where id = auth.uid()$$,
  'profil: tekshirilmagan (xom) rasm — rad', 'media_not_verified');
update public.profiles set avatar_url = (select origin || '/avatars/' || a || '/v-' || h1 || '.webp' from fx) where id = auth.uid();
select pg_temp.ok((select avatar_url like '%/v-%.webp' from public.profiles where id = auth.uid()), 'profil: tekshirilgan rasm saqlandi');
select pg_temp.fails($$update public.profiles set avatar_url = (select origin || '/avatars/' || b || '/v-' || h1 || '.webp' from fx) where id = auth.uid()$$,
  'profil: boshqa foydalanuvchining tekshirilgan fayli — rad', '22023');
update public.profiles set avatar_url = 'https://t.me/i/userpic/320/AbCdEfGh123.jpg' where id = auth.uid();
select pg_temp.ok(true, 'profil: Telegram rasmi ruxsat etiladi');
update public.profiles set avatar_url = null where id = auth.uid();
select pg_temp.ok(true, 'profil: rasmni olib tashlash mumkin');

-- eski (0059 dan oldingi) qiymat: o'zgarmasa boshqa maydonlarni tahrirlash ishlaydi
select pg_temp.service();
update public.profiles set avatar_url = (select origin || '/avatars/' || a || '/avatar.jpg?v=1' from fx) where id = (select a from fx);
select pg_temp.ok(true, 'server eski manzilni yoza oladi');
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
update public.profiles set first_name = 'Aziza' where id = auth.uid();
select pg_temp.ok((select first_name = 'Aziza' and avatar_url like '%/avatar.jpg?v=1' from public.profiles where id = auth.uid()), 'eski rasm o''zgarmasa tahrir saqlanadi, rasm joyida');

-- ===== Kompaniyaga faqat tekshirilgan logotip =====
select pg_temp.fails($$update public.companies set logo_url = (select origin || '/company-logos/' || c || '/logo.png?v=1' from fx, co) where id = (select c from co)$$,
  'kompaniya: tekshirilmagan logotip — rad', 'media_not_verified');
update public.companies set logo_url = (select origin || '/company-logos/' || c || '/v-' || h1 || '.webp' from fx, co) where id = (select c from co);
select pg_temp.ok((select logo_url like '%/v-%.webp' from public.companies where id = (select c from co)), 'kompaniya: tekshirilgan logotip saqlandi');

-- ===== Qolib ketgan karantin fayllari =====
select pg_temp.superuser();
insert into storage.objects (bucket_id, name, created_at)
select 'media-uploads', x.name, now() - x.age from fx, lateral (values
  ('avatar/' || a || '/0e000000-0000-4000-8000-000000000001.jpg', interval '2 days'),
  ('avatar/' || a || '/0e000000-0000-4000-8000-000000000002.jpg', interval '1 hour')
) as x(name, age);
select pg_temp.login('5e000000-0000-0000-0000-000000000001');
select pg_temp.fails($$select * from public.stale_raw_media(10)$$, 'stale_raw_media: mijoz chaqira olmaydi', '42501');
select pg_temp.service();
select pg_temp.ok((select array_agg(name) = array[(select 'avatar/' || a || '/0e000000-0000-4000-8000-000000000001.jpg' from fx)] from public.stale_raw_media(10)),
  'stale_raw_media: faqat 1 kundan eski karantin fayli');

rollback;
\echo '✓ media_quarantine.test.sql'
