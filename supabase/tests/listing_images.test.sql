-- 0087 · E'lon rasmi (AI): navbat va xarajat chegarasi faqat serverda; mehmon faqat tayyor rasmni, egasi o'z holatini ko'radi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('87000000-0000-0000-0000-000000000001', '+998908700001', now(), '{"first_name":"Rasmchi"}'),
  ('87000000-0000-0000-0000-000000000002', '+998908700002', now(), '{"first_name":"Begona"}');
update public.app_settings set value = '2'::jsonb where key = 'listing_images_user_daily';
delete from public.rate_limits where key like 'listing_images:%';

-- navbat: birinchi — ok, ishlayotgan paytda ikkinchisi — busy
select pg_temp.ok(public.claim_listing_image('vacancy', '87000000-0000-0000-0000-0000000000a1', '87000000-0000-0000-0000-000000000001', 'p', 'm') = 'ok', '1-so''rov: ok');
select pg_temp.ok(public.claim_listing_image('vacancy', '87000000-0000-0000-0000-0000000000a1', '87000000-0000-0000-0000-000000000001', 'p', 'm') = 'busy', 'yaratilayotganda takror: busy');
select pg_temp.ok(public.claim_listing_image('company', '87000000-0000-0000-0000-0000000000a1', '87000000-0000-0000-0000-000000000001', 'p', 'm') = 'invalid', 'noma''lum tur: invalid');
-- shaxsiy sutkalik chegara (sinovda 2 ta)
select pg_temp.ok(public.claim_listing_image('worker', '87000000-0000-0000-0000-0000000000a2', '87000000-0000-0000-0000-000000000001', 'p', 'm') = 'ok', '2-so''rov: ok');
select pg_temp.ok(public.claim_listing_image('worker', '87000000-0000-0000-0000-0000000000a3', '87000000-0000-0000-0000-000000000001', 'p', 'm') = 'user_limit', '3-so''rov: user_limit');
select pg_temp.ok(not exists (select 1 from public.listing_images where entity_id = '87000000-0000-0000-0000-0000000000a3'), 'chegaradan oshganda yozuv yaratilmaydi');
-- bir e'longa 3 urinishdan ko'p emas
update public.listing_images set status = 'failed', attempts = 3 where entity_id = '87000000-0000-0000-0000-0000000000a1';
select pg_temp.ok(public.claim_listing_image('vacancy', '87000000-0000-0000-0000-0000000000a1', '87000000-0000-0000-0000-000000000002', 'p', 'm') = 'too_many', '3 urinishdan keyin: too_many');

-- o'qish: mehmon — faqat tayyor; egasi — o'zining hammasi; begona — faqat tayyor
update public.listing_images set status = 'ready', image_url = 'https://x/a.jpg' where entity_id = '87000000-0000-0000-0000-0000000000a2';
set local role anon;
select pg_temp.ok((select count(*) = 1 from public.listing_images), 'mehmon: faqat tayyor rasm');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '87000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.ok((select count(*) = 2 from public.listing_images), 'egasi: o''z yozuvlari (holati bilan)');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '87000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.ok((select count(*) = 1 from public.listing_images), 'begona: faqat tayyor rasm');
reset role;

-- huquqlar: yozish va navbat — faqat server
select pg_temp.ok(not has_table_privilege('authenticated', 'public.listing_images', 'insert'), 'authenticated yoza olmaydi');
select pg_temp.ok(not has_table_privilege('anon', 'public.listing_images', 'update'), 'anon o''zgartira olmaydi');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.claim_listing_image(text, uuid, uuid, text, text)', 'execute'), 'authenticated navbat ololmaydi');
select pg_temp.ok(not has_function_privilege('anon', 'public.claim_listing_image(text, uuid, uuid, text, text)', 'execute'), 'anon navbat ololmaydi');
select pg_temp.ok((select public from storage.buckets where id = 'listing-images'), 'listing-images bucket ochiq');

rollback;
\echo '✓ listing_images'
