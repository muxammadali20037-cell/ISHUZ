-- 0093 · Kasb rasmi (foydalanuvchi va admin navbati): xarajat faqat serverda; tayyori qayta yaratilmaydi; oldindan yaratish
-- va almashtirish — faqat faol admin; mehmon faqat tayyor rasmni ko'radi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('93000000-0000-0000-0000-000000000001', '+998909300001', now(), '{"first_name":"Oddiy"}'),
  ('93000000-0000-0000-0000-000000000002', '+998909300002', now(), '{"first_name":"Admin"}');
insert into public.admin_users (profile_id, role) values ('93000000-0000-0000-0000-000000000002', 'admin');
insert into public.profession_nodes (id, category_id, name_uz, name_ru, name_en, slug)
select v.id::uuid, (select id from public.categories order by slug limit 1), v.uz, v.ru, v.en, v.slug
from (values
  ('93000000-0000-0000-0000-0000000000a1', 'Sinov kasbi 1', 'Тест 1', 'Test job 1', 'zz-sinov-kasbi-1'),
  ('93000000-0000-0000-0000-0000000000a2', 'Sinov kasbi 2', 'Тест 2', 'Test job 2', 'zz-sinov-kasbi-2'),
  ('93000000-0000-0000-0000-0000000000a3', 'Sinov kasbi 3', 'Тест 3', 'Test job 3', 'zz-sinov-kasbi-3'),
  ('93000000-0000-0000-0000-0000000000a4', 'Sinov kasbi 4', 'Тест 4', 'Test job 4', 'zz-sinov-kasbi-4')
) as v(id, uz, ru, en, slug);
update public.app_settings set value = 'true'::jsonb where key = 'profession_images_enabled';
update public.app_settings set value = '2'::jsonb where key = 'listing_images_user_daily';
update public.app_settings set value = '100'::jsonb where key = 'listing_images_daily_limit';
update public.app_settings set value = '1'::jsonb where key = 'profession_images_admin_daily';
delete from public.rate_limits where key like 'listing_images:%' or key like 'profession_images:%';

-- foydalanuvchi: birinchi — ok, yaratilayotganda — busy; yo'q kasb — invalid
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a1', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'ok', '1-so''rov: ok');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a1', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'busy', 'yaratilayotganda: busy');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000ff', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'invalid', 'yo''q kasb: invalid');
-- tayyor bo'lsa — qayta yaratilmaydi
update public.profession_images set status = 'ready', image_url = 'https://x/p.jpg' where node_id = '93000000-0000-0000-0000-0000000000a1';
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a1', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'exists', 'tayyor: exists');
-- shaxsiy sutkalik chegara e'lon rasmlari bilan umumiy (sinovda 2 ta)
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a2', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'ok', '2-so''rov: ok');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a3', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'user_limit', '3-so''rov: user_limit');
select pg_temp.ok(not exists (select 1 from public.profession_images where node_id = '93000000-0000-0000-0000-0000000000a3'), 'chegarada yozuv yaratilmaydi');
select pg_temp.ok(public.claim_listing_image('worker', '93000000-0000-0000-0000-0000000000c1', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'user_limit', 'e''lon rasmi bilan umumiy hisoblagich');
-- 3 marta xato — oddiy foydalanuvchiga too_many
update public.app_settings set value = '50'::jsonb where key = 'listing_images_user_daily';
update public.profession_images set status = 'failed', attempts = 3 where node_id = '93000000-0000-0000-0000-0000000000a2';
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a2', '93000000-0000-0000-0000-000000000001', 'p', 'm') = 'too_many', '3 xatodan keyin: too_many');
-- o'chirilgan bo'lsa — hech kimga
update public.app_settings set value = 'false'::jsonb where key = 'profession_images_enabled';
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a4', '93000000-0000-0000-0000-000000000002', 'p', 'm') = 'disabled', 'o''chirilgan: disabled');
update public.app_settings set value = 'true'::jsonb where key = 'profession_images_enabled';

-- oldindan yaratish va almashtirish — faqat admin
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a3', '93000000-0000-0000-0000-000000000001', 'p', 'm', true) = 'forbidden', 'oddiy: batch — forbidden');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a1', '93000000-0000-0000-0000-000000000001', 'p', 'm', false, true) = 'forbidden', 'oddiy: force — forbidden');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a3', '93000000-0000-0000-0000-000000000002', 'p', 'm', true) = 'ok', 'admin batch: ok');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a4', '93000000-0000-0000-0000-000000000002', 'p', 'm', true) = 'daily_limit', 'admin batch: o''z sutkalik chegarasi (sinovda 1)');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a1', '93000000-0000-0000-0000-000000000002', 'p', 'm', false, true) = 'ok', 'admin force: tayyorini almashtiradi');
select pg_temp.ok((select image_url = 'https://x/p.jpg' and status = 'pending' from public.profession_images where node_id = '93000000-0000-0000-0000-0000000000a1'), 'almashtirilayotganda eski manzil saqlanadi');
select pg_temp.ok(public.claim_profession_image_by('93000000-0000-0000-0000-0000000000a2', '93000000-0000-0000-0000-000000000002', 'p', 'm') = 'ok', 'admin: 3 xatodan keyin ham ok');

-- o'qish: mehmon — faqat tayyor
update public.profession_images set status = 'ready', image_url = 'https://x/w.jpg' where node_id = '93000000-0000-0000-0000-0000000000a2';
set local role anon;
select pg_temp.ok((select count(*) = 1 from public.profession_images where node_id::text like '93000000-%'), 'mehmon: faqat tayyor rasm');
reset role;

-- huquqlar: yozish va navbat — faqat server
select pg_temp.ok(not has_table_privilege('authenticated', 'public.profession_images', 'insert'), 'authenticated yoza olmaydi');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean)', 'execute'), 'authenticated navbat ololmaydi');
select pg_temp.ok(not has_function_privilege('anon', 'public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean)', 'execute'), 'anon navbat ololmaydi');

-- provayder kvotasi sababli to'xtaganlar (migratsiyadagi qadam) — qayta urinish mumkin; boshqa xatolar o'zgarmaydi
insert into public.profession_images (node_id, status, attempts, last_error) values
  ('93000000-0000-0000-0000-0000000000a4', 'failed', 3, 'provider_http_429');
update public.profession_images set status = 'failed', attempts = 3, last_error = 'moderation_reject' where node_id = '93000000-0000-0000-0000-0000000000a3';
update public.profession_images set attempts = 0, updated_at = now() - interval '1 hour'
where status = 'failed' and attempts > 0 and last_error ~ '^provider_http_(429|5[0-9][0-9]|401|403)';
select pg_temp.ok((select attempts = 0 from public.profession_images where node_id = '93000000-0000-0000-0000-0000000000a4'), 'kvota xatosi: urinish nolga');
select pg_temp.ok((select attempts = 3 from public.profession_images where node_id = '93000000-0000-0000-0000-0000000000a3'), 'boshqa xato: o''zgarmaydi');

rollback;
\echo '✓ profession_images'
