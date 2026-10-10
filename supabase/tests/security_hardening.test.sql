-- 0056 · Xavfsizlikni mustahkamlash: qabul testlari (DB qismi). Harf — SECURITY_TEST_REPORT.md dagi A–K.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid, p_iat bigint default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::jsonb
      || case when p_iat is null then '{}'::jsonb else jsonb_build_object('iat', p_iat) end)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
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
-- PostgREST pre-request muhitini taqlid qilish
create or replace function pg_temp.pre(p_method text, p_headers json default '{}') returns text language plpgsql as $$
begin
  perform set_config('request.method', p_method, false);
  perform set_config('request.headers', p_headers::text, false);
  perform public.api_pre_request();
  return 'pass';
exception when others then
  return sqlerrm;
end $$;

begin;
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required');
update public.app_settings set value = 'true'::jsonb where key = 'listing_free_trial';

-- A: ish beruvchi · B: boshqa foydalanuvchi · S: super admin · M: admin · R: moderator
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('f5600000-0000-0000-0000-00000000000a', '+998909560001', now(), '{"first_name":"Ali","last_name":"Valiyev"}'),
  ('f5600000-0000-0000-0000-00000000000b', '+998909560002', now(), '{"first_name":"Bobur","last_name":"B"}'),
  ('f5600000-0000-0000-0000-00000000000c', '+998909560003', now(), '{"first_name":"Super","last_name":"S"}'),
  ('f5600000-0000-0000-0000-00000000000d', '+998909560004', now(), '{"first_name":"Admin","last_name":"M"}'),
  ('f5600000-0000-0000-0000-00000000000e', '+998909560005', now(), '{"first_name":"Moder","last_name":"R"}');
insert into public.admin_users (profile_id, role) values
  ('f5600000-0000-0000-0000-00000000000c', 'super_admin'),
  ('f5600000-0000-0000-0000-00000000000d', 'admin'),
  ('f5600000-0000-0000-0000-00000000000e', 'moderator');
insert into auth.sessions (user_id) values ('f5600000-0000-0000-0000-00000000000b'), ('f5600000-0000-0000-0000-00000000000b'), ('f5600000-0000-0000-0000-00000000000a');

-- ===================================================================================
-- A. Foydalanuvchilar orasida izolyatsiya
-- ===================================================================================
select pg_temp.login('f5600000-0000-0000-0000-00000000000a');
insert into public.employer_profiles (profile_id, employer_type, display_name, contact_phone, identity_number)
values (auth.uid(), 'person', 'Ali usta', '+998901112233', '12345678901234');
select pg_temp.ok((select contact_phone from public.employer_profiles where profile_id = auth.uid()) = '+998901112233', 'A: egasi o''z kontaktini ko''radi');

select pg_temp.login('f5600000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.employer_profiles where profile_id = 'f5600000-0000-0000-0000-00000000000a') = 0,
  'A: boshqa foydalanuvchi ish beruvchining telefoni/STIR ini o''qiy olmaydi');
select pg_temp.ok((select display_name from public.employer_public_names(array['f5600000-0000-0000-0000-00000000000a'::uuid])) = 'Ali usta',
  'A: faqat ko''rinadigan nom ochiq (employer_public_names)');

select pg_temp.login('f5600000-0000-0000-0000-00000000000d');
select pg_temp.ok((select count(*) from public.employer_profiles where profile_id = 'f5600000-0000-0000-0000-00000000000a') = 1, 'A: admin ko''radi');

select pg_temp.superuser();
insert into public.companies (name, slug, created_by, tin, phone) values ('Test MChJ', 'test-mchj-sec', 'f5600000-0000-0000-0000-00000000000a', '301234567', '+998712000000');
-- tasdiqlangan kompaniya va ish beruvchi: nom/STIR ni almashtirib nishonni saqlab bo'lmaydi
insert into public.company_members (company_id, profile_id, role) select id, 'f5600000-0000-0000-0000-00000000000a', 'owner' from public.companies where slug = 'test-mchj-sec' on conflict do nothing;
update public.companies set verification_status = 'verified', verified_at = now() where slug = 'test-mchj-sec';
update public.employer_profiles set verification_status = 'verified', verified_at = now() where profile_id = 'f5600000-0000-0000-0000-00000000000a';
select pg_temp.login('f5600000-0000-0000-0000-00000000000a');
update public.companies set name = 'Soliq qo''mitasi', tin = '999999999', about = 'yangi' where slug = 'test-mchj-sec';
update public.employer_profiles set display_name = 'Davlat organi', about = 'yangi' where profile_id = auth.uid();
select pg_temp.superuser();
select pg_temp.ok((select name = 'Test MChJ' and tin = '301234567' and about = 'yangi' from public.companies where slug = 'test-mchj-sec'), 'B: tasdiqlangan kompaniya nomi/STIR mijozdan o''zgarmaydi (boshqa maydonlar o''zgaradi)');
select pg_temp.ok((select display_name = 'Ali usta' and about = 'yangi' from public.employer_profiles where profile_id = 'f5600000-0000-0000-0000-00000000000a'), 'B: tasdiqlangan ish beruvchi nomi o''zgarmaydi');
update public.employer_profiles set verification_status = 'unverified', verified_at = null where profile_id = 'f5600000-0000-0000-0000-00000000000a';
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.companies where slug = 'test-mchj-sec') = 1, 'A: anon kompaniya nomini ko''radi');
select pg_temp.fails($$select tin from public.companies$$, 'A: anon STIR (tin) ni o''qiy olmaydi', '42501');
select pg_temp.fails($$select * from public.companies$$, 'A: anon select * — ruxsat yo''q (aniq ustunlar kerak)', '42501');

select pg_temp.superuser();
-- haqiqiy Supabase'dagi kabi jadval huquqlari (stub'da yo'q); RLS siyosatlari cheklaydi
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter table storage.objects enable row level security;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('avatars', 'f5600000-0000-0000-0000-00000000000a/avatar.jpg'),
  ('avatars', 'f5600000-0000-0000-0000-00000000000b/avatar.jpg');
select pg_temp.anon();
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'avatars') = 0, 'A: anon ommaviy bucket ro''yxatini ola olmaydi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'avatars') = 1, 'A: foydalanuvchi faqat o''z papkasini ro''yxatlaydi');

-- ===================================================================================
-- B. Huquqni oshirib bo'lmaydi
-- ===================================================================================
select pg_temp.login('f5600000-0000-0000-0000-00000000000a');
update public.profiles set blocked_reason = 'x', blocked_at = now(), created_at = '2000-01-01', sessions_revoked_at = '2000-01-01' where id = auth.uid();
select pg_temp.ok((select blocked_reason is null and blocked_at is null and created_at > '2020-01-01' and sessions_revoked_at is null
                   from public.profiles where id = auth.uid()), 'B: admin maydonlari (blocked_*, created_at, sessions_revoked_at) mijozdan o''zgarmaydi');
select pg_temp.fails($$update public.profiles set is_blocked = true where id = auth.uid()$$, 'B: is_blocked ni o''zi o''zgartira olmaydi');
select pg_temp.fails($$select public.security_log_event('x.test', 'high', 'test')$$, 'B: xavfsizlik jurnaliga mijoz yoza olmaydi', '42501');
select pg_temp.fails($$select public.security_restrict('account', auth.uid()::text, 'temporarily_restricted', 'x', 60, 'r1')$$, 'B: cheklovni mijoz qo''ya olmaydi', '42501');
select pg_temp.fails($$select public.security_revoke_sessions('f5600000-0000-0000-0000-00000000000b', 'x')$$, 'B: boshqaning sessiyasini bekor qila olmaydi', '42501');
select pg_temp.fails($$select public.admin_security_overview()$$, 'B: xavfsizlik paneli faqat admin', '42501');
select pg_temp.fails($$select public.admin_revoke_user_sessions('f5600000-0000-0000-0000-00000000000b')$$, 'B: admin_revoke_user_sessions faqat admin', '42501');
select pg_temp.fails($$insert into public.verification_requests (profile_id, type) values (auth.uid(), 'identity')$$, 'B: tekshiruv so''rovini to''g''ridan-to''g''ri yozib bo''lmaydi', '42501');
select pg_temp.fails($$select public.setting_bool('admin_mfa_required', true)$$, 'B: ichki sozlama funksiyasi yopiq', '42501');
select pg_temp.fails($$select public.telegram_auth_lookup(1)$$, 'B: telegram_auth_lookup faqat server', '42501');
select pg_temp.ok((select count(*) from public.security_events) = 0 and (select count(*) from public.security_restrictions) = 0, 'B: xavfsizlik jurnali/cheklovlar oddiy foydalanuvchiga ko''rinmaydi');
select pg_temp.superuser();
select public.notify('f5600000-0000-0000-0000-00000000000a', 'system', '{"kind":"test"}', '/cabinet');
select pg_temp.login('f5600000-0000-0000-0000-00000000000a');
select pg_temp.fails($$update public.notifications set link = '//evil.example' where profile_id = auth.uid()$$, 'B: bildirishnoma havolasini o''zgartirib bo''lmaydi (faqat read_at)', '42501');
update public.notifications set read_at = now() where profile_id = auth.uid();
select pg_temp.ok((select bool_and(read_at is not null) from public.notifications where profile_id = auth.uid()), 'B: read_at ni belgilash ishlaydi');
select pg_temp.fails($$truncate public.audit_logs$$, 'B: TRUNCATE yo''q', '42501');

select pg_temp.login('f5600000-0000-0000-0000-00000000000e');
select pg_temp.fails($$select public.admin_security_overview()$$, 'B: moderatorda security.view yo''q', '42501');
select pg_temp.login('f5600000-0000-0000-0000-00000000000d');
select pg_temp.ok((select public.admin_security_overview(24) ? 'recent'), 'B: admin xavfsizlik panelini ko''radi');

-- anon chaqira oladigan SECURITY DEFINER funksiyalar — aniq ro'yxat (yangi funksiya ongli ravishda qo'shiladi)
select pg_temp.superuser();
select pg_temp.ok((
  select coalesce(string_agg(p.proname, ',' order by p.proname), '')
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'execute')
) = 'ai_alerts_paid,api_pre_request,billing_enabled,can_edit_vacancy,can_view_worker,compute_match,current_worker_id,has_admin_permission,is_active_user,is_admin,is_allowed_media_url,is_company_member,listings_paid,notification_open,profile_rating,record_vacancy_view,salary_insight,simple_search_vacancies,simple_search_workers,simple_vacancy_phone,simple_worker_listing',
  'B: anon uchun ochiq SECURITY DEFINER funksiyalar faqat ruxsat etilgan ro''yxat');

-- ===================================================================================
-- D. Bloklash va sessiyalarni bekor qilish (belgilangan oyna ichida)
-- ===================================================================================
select pg_temp.login('f5600000-0000-0000-0000-00000000000b');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), 'Sotuvchi kerak', c.id, r.id from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';
select public.publish_vacancy((select id from public.vacancies where title = 'Sotuvchi kerak'));
select pg_temp.ok((select status = 'active' from public.vacancies where title = 'Sotuvchi kerak'), 'D: B ning e''loni faol');
select pg_temp.fails($$update public.vacancies set status = 'paused' where title = 'Sotuvchi kerak'$$, 'D: holat faqat RPC orqali', 'status_via_rpc');

select pg_temp.login('f5600000-0000-0000-0000-00000000000d');
select pg_temp.fails($$select public.admin_set_user_block('f5600000-0000-0000-0000-00000000000d', true, 'x')$$, 'D: admin o''zini bloklay olmaydi', 'cannot_block_self');
select pg_temp.fails($$select public.admin_set_user_block('f5600000-0000-0000-0000-00000000000c', true, 'x')$$, 'D: admin super adminni bloklay olmaydi', 'forbidden_hierarchy');
select public.admin_set_user_block('f5600000-0000-0000-0000-00000000000b', true, 'spam');
select pg_temp.superuser();
select pg_temp.ok((select count(*) from auth.sessions where user_id = 'f5600000-0000-0000-0000-00000000000b') = 0, 'D: bloklashda barcha sessiyalar o''chiriladi (refresh ishlamaydi)');
select pg_temp.ok((select count(*) from auth.sessions where user_id = 'f5600000-0000-0000-0000-00000000000a') = 1, 'D: boshqa foydalanuvchi sessiyasi tegilmaydi');
select pg_temp.ok((select banned_until > now() + interval '50 years' from auth.users where id = 'f5600000-0000-0000-0000-00000000000b'), 'D: auth darajasida ban');
select pg_temp.ok((select status = 'hidden' and moderation_note = 'owner_blocked' from public.vacancies where title = 'Sotuvchi kerak'), 'D: bloklangan egasining e''loni ommadan olinadi');
select pg_temp.ok((select count(*) from public.security_events where event_type = 'admin.user_blocked') = 1, 'D: bloklash xavfsizlik jurnalida');

-- eski (hali muddati tugamagan) access token bilan
select pg_temp.login('f5600000-0000-0000-0000-00000000000b', extract(epoch from now())::bigint - 60);
select pg_temp.ok(not public.is_active_user(), 'D: bloklangan foydalanuvchi faol emas');
select pg_temp.fails($$update public.profiles set first_name = 'Hacker' where id = auth.uid()$$, 'D: bloklangan foydalanuvchi profilga yoza olmaydi', '42501');
select pg_temp.fails($$insert into public.device_tokens (profile_id, token, platform) values (auth.uid(), 'x', 'web')$$, 'D: bloklangan foydalanuvchi boshqa jadvalga ham yoza olmaydi');
select pg_temp.ok(pg_temp.pre('POST') = 'account_restricted', 'D: pre-request — bloklangan hisobning POST/RPC so''rovi rad');
select pg_temp.ok(pg_temp.pre('GET') = 'pass', 'D: pre-request — GET o''tadi (/blocked sahifasi ishlaydi)');
select pg_temp.ok((select count(*) from public.profiles where id = auth.uid()) = 1, 'D: bloklangan foydalanuvchi o''z profilini o''qiy oladi');

select pg_temp.login('f5600000-0000-0000-0000-00000000000d');
select public.admin_set_user_block('f5600000-0000-0000-0000-00000000000b', false);
select pg_temp.superuser();
select pg_temp.ok((select status = 'active' and moderation_note is null from public.vacancies where title = 'Sotuvchi kerak'), 'D: blokdan chiqarilganda e''lon qaytadi');
select pg_temp.ok((select banned_until is null from auth.users where id = 'f5600000-0000-0000-0000-00000000000b'), 'D: ban olib tashlanadi');

-- sessiyalarni bekor qilish (bloklamasdan): eski token yoza olmaydi, yangi kirish ishlaydi
select pg_temp.service();
select pg_temp.ok((select (public.security_revoke_sessions('f5600000-0000-0000-0000-00000000000a', 'suspicious_login') ->> 'sessions')::int = 1), 'D: security_revoke_sessions sessiyani o''chiradi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint - 30);
select pg_temp.fails($$update public.profiles set first_name = 'X' where id = auth.uid()$$, 'D: bekor qilingandan oldingi token bilan yozib bo''lmaydi', '42501');
select pg_temp.ok(pg_temp.pre('PATCH') = 'account_restricted', 'D: pre-request eski tokenni rad etadi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
update public.profiles set first_name = 'Ali' where id = auth.uid();
select pg_temp.ok(pg_temp.pre('POST') = 'pass', 'D: qayta kirgandan keyingi token ishlaydi');

-- bloklangan admin admin emas
select pg_temp.login('f5600000-0000-0000-0000-00000000000c');
select public.admin_set_user_block('f5600000-0000-0000-0000-00000000000d', true, 'test');
select pg_temp.login('f5600000-0000-0000-0000-00000000000d', extract(epoch from now())::bigint + 5);
select pg_temp.ok(not public.is_admin() and not public.has_admin_permission('users.view'), 'D: bloklangan admin huquqlarini yo''qotadi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000c');
select public.admin_set_user_block('f5600000-0000-0000-0000-00000000000d', false);

-- pre-request: anon, service va sinov sarlavhasi
select pg_temp.anon();
select pg_temp.ok(pg_temp.pre('POST') = 'pass', 'D: pre-request anon so''rovga tegmaydi');
select pg_temp.ok(pg_temp.pre('GET', '{"x-ishuz-preflight":"1"}') = 'pre_request_active', 'D: pre-request yoqilganini tekshirish sarlavhasi');

-- ===================================================================================
-- F. Begona odam jabrlanuvchini doimiy bloklay olmaydi (cheklovlar muddatli)
-- ===================================================================================
select pg_temp.service();
create temp table r1 on commit drop as
  select public.security_restrict('phone', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'temporarily_restricted', 'otp_failures', 999999, 'otp-v1') as j;
select pg_temp.ok((select (j ->> 'expires_at')::timestamptz <= now() + interval '1 hour 1 second' from r1), 'F: telefon cheklovi ≤ 1 soat (so''ralgan muddatdan qat''i nazar)');
select pg_temp.ok((select (j ->> 'enforced')::boolean = false from r1), 'F: standart — kuzatuv rejimi (observe-first)');
select pg_temp.ok((select (public.security_restrict('phone', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'temporarily_restricted', 'otp_failures', 3600, 'otp-v1') ->> 'id')
                   = (select j ->> 'id' from r1)), 'F: takroriy hujum muddatni uzaytirmaydi');
select pg_temp.ok((select (public.security_restrict('account', 'f5600000-0000-0000-0000-00000000000a', 'compromise_suspected', 'tg_relink', 30 * 86400, 'acc-v1', null, true) ->> 'expires_at')::timestamptz
                   <= now() + interval '7 days 1 second'), 'F: hisob cheklovi ≤ 7 kun');
select pg_temp.fails($$insert into public.security_restrictions (scope, subject, state, reason_code, rule_version, expires_at) values ('ip', 'bbbbbbbbbbbbbbbb', 'throttled', 'x', 'v1', now() + interval '1 hour')$$,
  'F: service role cheklov jadvaliga to''g''ridan-to''g''ri yoza olmaydi (faqat security_restrict)', '42501');
select pg_temp.superuser();
select pg_temp.fails($$insert into public.security_restrictions (scope, subject, state, reason_code, rule_version, expires_at) values ('ip', 'bbbbbbbbbbbbbbbb', 'throttled', 'x', 'v1', now() + interval '30 days')$$,
  'F: jadval darajasida ham muddat ≤ 7 kun', '23514');
select pg_temp.service();
select pg_temp.ok((select public.security_active_restriction('account', 'f5600000-0000-0000-0000-00000000000a') ->> 'state') = 'compromise_suspected', 'F: faol cheklov topiladi');
select pg_temp.ok(not public.security_account_restricted('f5600000-0000-0000-0000-00000000000a'), 'F: compromise_suspected — kirishni bloklamaydi (qayta tasdiqlash)');
select public.security_restrict('account', 'f5600000-0000-0000-0000-00000000000b', 'temporarily_restricted', 'abuse', 600, 'acc-v1', null, true);
select pg_temp.login('f5600000-0000-0000-0000-00000000000b', extract(epoch from now())::bigint + 5);
select pg_temp.ok(pg_temp.pre('POST') = 'temporarily_restricted', 'F: majburiy vaqtinchalik cheklov pre-request da qo''llanadi');
-- d bloklanib-ochilgan: sessiyalari bekor qilingan, yangi kirish (yangi iat) kerak
select pg_temp.login('f5600000-0000-0000-0000-00000000000d', extract(epoch from now())::bigint + 5);
select public.admin_lift_restriction((select id from public.security_restrictions where subject = 'f5600000-0000-0000-0000-00000000000b' and lifted_at is null));
select pg_temp.login('f5600000-0000-0000-0000-00000000000b', extract(epoch from now())::bigint + 5);
select pg_temp.ok(pg_temp.pre('POST') = 'pass', 'F: admin cheklovni olib tashlaydi');

-- ===================================================================================
-- G. Telegram: takroriy update, bog'lash tasdig'i, almashtirish ogohlantirishi
-- ===================================================================================
select pg_temp.service();
select pg_temp.ok(public.telegram_update_first_seen(424242), 'G: update birinchi marta qayta ishlanadi');
select pg_temp.ok(not public.telegram_update_first_seen(424242), 'G: takroriy update e''tiborsiz (replay idempotent)');

select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
select public.create_telegram_link_token(repeat('a', 64), 'worker');
select pg_temp.service();
select pg_temp.ok((select public.preview_telegram_link_token(repeat('a', 64), 7001) ->> 'status') = 'ok', 'G: oldindan ko''rish');
select pg_temp.ok((select public.preview_telegram_link_token(repeat('a', 64), 7001) ->> 'name') = 'Ali V.', 'G: nom niqoblangan (familiya bosh harfi)');
select pg_temp.ok((select used_at is null from public.telegram_link_tokens where token_hash = repeat('a', 64)), 'G: oldindan ko''rish tokenni ishlatmaydi');
select pg_temp.ok((select public.consume_telegram_link_token(repeat('a', 64), 7001) ->> 'status') = 'linked', 'G: tasdiqdan keyin bog''landi');
select pg_temp.superuser();
select pg_temp.ok((select raw_app_meta_data ->> 'tg_id' = '7001' from auth.users where id = 'f5600000-0000-0000-0000-00000000000a'), 'G: app_metadata.tg_id yozildi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
select public.create_telegram_link_token(repeat('b', 64), null);
select pg_temp.service();
select pg_temp.ok((select (public.preview_telegram_link_token(repeat('b', 64), 7002) ->> 'replaces_other')::boolean), 'G: almashtirish oldindan ko''rsatiladi');
select pg_temp.ok((select public.consume_telegram_link_token(repeat('b', 64), 7002) ->> 'previous_telegram_user_id') = '7001', 'G: eski Telegram qaytariladi (xabar uchun)');
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.security_events where event_type = 'telegram.link_replaced' and actor_id = 'f5600000-0000-0000-0000-00000000000a') = 1, 'G: almashtirish jurnalda');
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'f5600000-0000-0000-0000-00000000000a' and payload ->> 'kind' = 'telegram_relinked') = 1, 'G: egasiga ilova ichida xabar');
select pg_temp.login('f5600000-0000-0000-0000-00000000000b', extract(epoch from now())::bigint + 5);
select public.create_telegram_link_token(repeat('c', 64), null);
select pg_temp.service();
select pg_temp.ok((select public.preview_telegram_link_token(repeat('c', 64), 7002) ->> 'status') = 'linked_elsewhere', 'G: boshqa hisobga bog''langan Telegram ko''chirilmaydi');

select pg_temp.superuser();
insert into auth.users (id, email, raw_app_meta_data) values
  ('f5600000-0000-0000-0000-0000000000f1', 'tg_9001@telegram.ishuz.local', '{}'),
  ('f5600000-0000-0000-0000-0000000000f2', 'tg_9002@telegram.ishuz.local', '{"tg_id": 9002}');
select pg_temp.service();
select pg_temp.ok(not (public.telegram_auth_lookup(9001) ->> 'email_trusted')::boolean, 'G: oldindan band qilingan texnik email ishonchsiz (qabul qilinmaydi)');
select pg_temp.ok((public.telegram_auth_lookup(9002) ->> 'email_trusted')::boolean, 'G: server yaratgan (tg_id) hisob ishonchli');

-- ===================================================================================
-- H. Fayl yo'llari va rasm manzillari
-- ===================================================================================
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
select pg_temp.fails($$select public.submit_employer_verification('12345678901234', null, array['f5600000-0000-0000-0000-00000000000a/../f5600000-0000-0000-0000-00000000000b/x.pdf'])$$, 'H: hujjat yo''lida ".." rad', 'invalid_documents');
select pg_temp.fails($$select public.submit_employer_verification('12345678901234', null, array['f5600000-0000-0000-0000-00000000000a/sub/x.pdf'])$$, 'H: hujjat yo''lida qo''shimcha papka rad', 'invalid_documents');
select public.submit_employer_verification('12345678901234', null, array['f5600000-0000-0000-0000-00000000000a/0b5c7d0e-1111-4222-8333-444455556666.pdf']);
select pg_temp.ok((select count(*) from public.verification_requests where profile_id = auth.uid()) = 1, 'H: to''g''ri yo''l qabul qilinadi');

select pg_temp.fails($$update public.profiles set avatar_url = 'https://evil.example/pixel.png' where id = auth.uid()$$, 'H: tashqi avatar URL rad', 'invalid_media_url');
select pg_temp.fails($$update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/f5600000-0000-0000-0000-00000000000b/avatar.jpg' where id = auth.uid()$$, 'H: boshqaning papkasidagi avatar rad', 'invalid_media_url');
update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/f5600000-0000-0000-0000-00000000000a/avatar.jpg?v=1712345678901' where id = auth.uid();
update public.profiles set avatar_url = 'https://t.me/i/userpic/320/AbCdEfGh12345678.jpg' where id = auth.uid();
select pg_temp.ok(true, 'H: o''z storage avatari va Telegram userpic qabul qilinadi');
select pg_temp.superuser();
update public.app_settings set value = '"https://x.supabase.co"'::jsonb where key = 'storage_public_origin';
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
select pg_temp.fails($$update public.profiles set avatar_url = 'https://y.supabase.co/storage/v1/object/public/avatars/f5600000-0000-0000-0000-00000000000a/avatar.jpg' where id = auth.uid()$$, 'H: storage_public_origin o''rnatilganda boshqa host rad', 'invalid_media_url');
select pg_temp.superuser();
insert into auth.users (id, raw_user_meta_data) values ('f5600000-0000-0000-0000-0000000000f3', '{"first_name":"Meta","avatar_url":"https://evil.example/a.png"}');
select pg_temp.ok((select avatar_url is null from public.profiles where id = 'f5600000-0000-0000-0000-0000000000f3'), 'H: ro''yxatdan o''tishda ruxsatsiz avatar_url tashlab yuboriladi');

select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
select pg_temp.fails($$insert into public.vacancies (owner_profile_id, title, category_id, region_id, photo_path)
  select auth.uid(), 'Rasm', c.id, r.id, 'f5600000-0000-0000-0000-00000000000a/../x.jpg' from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city'$$,
  'H: vakansiya rasm yo''lida ".." rad', 'invalid_photo_path');

-- ===================================================================================
-- I. Ogohlantirish: dedupe/cooldown, shaxsiy ma'lumot yozilmaydi
-- ===================================================================================
select pg_temp.service();
select public.security_log_event('auth.otp_bruteforce', 'high', 'otp_failures', null, 'cccccccccccccccccccccccccccccccc', null, '/api/auth/phone-code/verify', 'restricted', 'req-1', 'otp-v1', '{"attempts": 12}');
select public.security_log_event('auth.otp_bruteforce', 'high', 'otp_failures', null, 'cccccccccccccccccccccccccccccccc', null, '/api/auth/phone-code/verify', 'restricted', 'req-2', 'otp-v1', '{"attempts": 13}');
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.notifications where payload ->> 'kind' = 'security_alert' and payload ->> 'event_type' = 'auth.otp_bruteforce') = 2,
  'I: yuqori hodisa → super admin va admin (2) ga bitta ogohlantirish; takrori dedupe');
select pg_temp.ok((select count(*) from public.notifications where profile_id = 'f5600000-0000-0000-0000-00000000000e' and payload ->> 'kind' = 'security_alert') = 0,
  'I: moderatorga xavfsizlik ogohlantirishi yuborilmaydi');
select pg_temp.service();
select pg_temp.fails($$select public.security_log_event('auth.test', 'high', 'x', null, '+998901234567')$$, 'I: ochiq telefon raqami subject sifatida yozilmaydi (faqat HMAC)');
select pg_temp.fails($$select public.security_log_event('auth.test', 'info', 'x', null, null, null, null, 'logged', null, null, jsonb_build_object('blob', repeat('x', 5000)))$$, 'I: details hajmi cheklangan');
select pg_temp.fails($$update public.security_events set severity = 'info'$$, 'I: jurnal append-only (service role o''zgartira olmaydi)', '42501');
select pg_temp.fails($$delete from public.audit_logs$$, 'I: audit logni service role ham o''chira olmaydi', '42501');

-- ===================================================================================
-- Ishchi to'liqligi va ko'rishlar, masofa, texnik xizmat
-- ===================================================================================
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
insert into public.worker_profiles (profile_id, headline, is_public, last_active_at, created_at) values (auth.uid(), 'Usta', false, '2099-01-01', '2000-01-01');
select pg_temp.ok((select last_active_at < '2090-01-01' and created_at > '2020-01-01' from public.worker_profiles where profile_id = auth.uid()), 'B: ishchi reyting maydonlari mijozdan qo''yilmaydi');
select pg_temp.ok((select score from public.worker_completeness((select id from public.worker_profiles where profile_id = auth.uid()))) >= 0, 'B: o''z to''liqligini ko''radi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000b', extract(epoch from now())::bigint + 5);
select pg_temp.fails($$select public.worker_completeness((select id from public.worker_profiles where profile_id = 'f5600000-0000-0000-0000-00000000000a'))$$, 'B: begona ishchi to''liqligi yopiq', '42501');
select pg_temp.fails($$select public.refresh_worker_completeness((select id from public.worker_profiles where profile_id = 'f5600000-0000-0000-0000-00000000000a'))$$, 'B: begona ishchini qayta hisoblatib bo''lmaydi', '42501');
select pg_temp.superuser();
create temp table wa on commit drop as select id from public.worker_profiles where profile_id = 'f5600000-0000-0000-0000-00000000000a';
grant select on wa to authenticated;
select pg_temp.login('f5600000-0000-0000-0000-00000000000b', extract(epoch from now())::bigint + 5);
select public.record_worker_view((select id from wa));
select public.record_worker_view((select id from wa));
select public.record_worker_view((select id from wa));
select pg_temp.superuser();
select pg_temp.ok((select views_count = 1 from public.worker_profiles where id = (select id from wa)), 'B: bir ko''ruvchi soatiga 1 ko''rish (sun''iy ko''tarish yo''q)');

select pg_temp.ok((select pg_get_functiondef(p.oid) like '%greatest(2.0, ceil(public.distance_km(p_lat, p_lng, g.lat, g.lng))) <= greatest(2.0, ceil(p_max_distance_km))%'
                   from pg_proc p where p.proname = 'search_workers_v2'), 'A: masofa filtri butun km (min 2) — trilateratsiya qiyin');

select pg_temp.service();
select pg_temp.ok(public.security_hit('t:sec', 60) = 1 and public.security_hit('t:sec', 60) = 2, 'E: atomik hisoblagich sonini qaytaradi');
select pg_temp.ok((public.security_maintenance() ? 'rate_limits'), 'I: texnik xizmat funksiyasi ishlaydi');
select pg_temp.login('f5600000-0000-0000-0000-00000000000a', extract(epoch from now())::bigint + 5);
select pg_temp.fails($$select public.security_hit('x', 60)$$, 'E: hisoblagichni mijoz chaqira olmaydi', '42501');
select pg_temp.superuser();
rollback;
\echo '✓ xavfsizlikni mustahkamlash (0056) testlari o''tdi'
