-- ISH.UZ · majburiy moderatsiya (0049), moslik v2 (0050), xabarnomalar (0051), admin/MFA (0052)
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
  execute 'set role authenticated';
end $$;
-- ikki bosqichli kirishsiz sessiya (admin huquqlari ishlamasligi kerak)
create or replace function pg_temp.login_aal1(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal1')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false); end $$;
create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  execute 'set role service_role';
end $$;
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
update public.app_settings set value = 'true'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'admin_mfa_required');
update public.app_settings set value = 'false'::jsonb where key in ('listings_paid', 'billing_enabled', 'vacancy_moderation_enabled');
update public.app_settings set value = '90'::jsonb where key = 'match_notify_threshold';

create temp table fx on commit drop as
select
  (select id from public.profession_nodes where selectable and is_active order by (name_uz = 'Buxgalter') desc, depth limit 1) as node,
  (select id from public.regions where slug = 'tashkent_city') as region,
  (select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' order by d.sort_order limit 1) as district,
  (select id from public.regions where slug <> 'tashkent_city' order by sort_order limit 1) as other_region;
grant select on fx to anon, authenticated, service_role;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('6a000000-0000-0000-0000-000000000001', '+998907100001', now(), '{"first_name":"Ali","last_name":"Valiyev"}'),
  ('6a000000-0000-0000-0000-000000000002', '+998907100002', now(), '{"first_name":"Kafe","last_name":""}'),
  ('6a000000-0000-0000-0000-000000000003', '+998907100003', now(), '{"first_name":"Admin","last_name":""}'),
  ('6a000000-0000-0000-0000-000000000004', '+998907100004', now(), '{"first_name":"Tahlil","last_name":""}'),
  ('6a000000-0000-0000-0000-000000000005', '+998907100005', now(), '{"first_name":"Begona","last_name":""}');
insert into public.profile_contacts (profile_id, phone, phone_verified_at)
select id, phone, now() from auth.users where id::text like '6a000000-%'
on conflict (profile_id) do update set phone = excluded.phone, phone_verified_at = excluded.phone_verified_at;
insert into public.admin_users (profile_id, role) values
  ('6a000000-0000-0000-0000-000000000003', 'super_admin'),
  ('6a000000-0000-0000-0000-000000000004', 'analyst');

create temp table wl_args on commit drop as
select jsonb_build_object(
  'profession_node_id', node, 'region_id', region, 'district_id', district, 'first_name', 'Ali', 'last_name', 'Valiyev',
  'about', 'Buxgalteriyada 5 yil ishladim, 1C va soliq hisobotlari', 'experience_level', '3_5y', 'salary_expected', 6000000,
  'schedule', '5_2', 'show_phone', true, 'remote', false) as p
from fx;
create temp table vac_args on commit drop as
select jsonb_build_object(
  'client_ref', '7b000000-0000-4000-8000-000000000001', 'profession_node_id', node, 'region_id', region, 'district_id', district,
  'employer_type', 'person', 'org_name', 'Kafe egasi', 'contact_phone', '+998901112244', 'show_phone', true,
  'description', 'Kafega buxgalter kerak, ish 9:00 dan 18:00 gacha', 'salary_negotiable', false, 'salary_from', 4000000, 'salary_to', 6500000,
  'schedule', '5_2', 'experience_min_months', 12) as p
from fx;
grant select on wl_args, vac_args to anon, authenticated, service_role;

-- =====================================================================
-- Ishchi e'loni: tekshiruvsiz ommaga chiqmaydi
-- =====================================================================
select pg_temp.login('6a000000-0000-0000-0000-000000000001');
select pg_temp.ok((select public.save_simple_worker_listing((select p from wl_args)) ->> 'state') = 'moderation_pending', 'ishchi e''loni: tekshiruv kutilmoqda (joylandi emas)');
select pg_temp.ok((select not is_public and publish_requested and moderation_state = 'pending' from public.worker_profiles where profile_id = auth.uid()), 'qidiruvda emas, navbatda');
update public.worker_profiles set moderation_state = 'allowed', moderated_version = moderation_version, is_public = true where profile_id = auth.uid();
select pg_temp.ok((select not is_public and moderation_state = 'pending' from public.worker_profiles where profile_id = auth.uid()), 'foydalanuvchi moderatsiya ustunlari va is_public ni o''zi o''zgartira olmaydi');
select pg_temp.fails($$select public.moderation_apply('worker', public.current_worker_id(), 1, 'allow', 'job_related', 'x', null, '{}')$$, 'moderation_apply faqat serverda', '42501');
select pg_temp.ok((select count(*) from public.moderation_checks) = 0, 'oddiy foydalanuvchi tekshiruv tarixini ko''rmaydi');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx))) = 0, 'mehmon qidiruvida yo''q');

select pg_temp.superuser();
create temp table wid on commit drop as select id, moderation_version as ver from public.worker_profiles where profile_id = '6a000000-0000-0000-0000-000000000001';
grant select on wid to anon, authenticated, service_role;

select pg_temp.service();
create temp table claimed on commit drop as select * from public.moderation_claim(10);
select pg_temp.ok((select count(*) from claimed where o_entity = 'worker' and o_id = (select id from wid)) = 1, 'navbat: e''lon tekshiruvga olindi');
select pg_temp.ok((select count(*) from public.moderation_claim(10) where o_id = (select id from wid)) = 0, 'ijara: qayta olinmaydi (ikki marta tekshirilmaydi)');
select pg_temp.ok((select public.moderation_snapshot('worker', (select id from wid)) -> 'fields' ->> 'description') like 'Buxgalteriyada%', 'tekshiriladigan nusxa: aynan e''lon matni');
select pg_temp.ok((select public.moderation_apply('worker', (select id from wid), (select ver from wid) + 5, 'allow', 'job_related', 'ok', null, '{}', 'ai', 'test', 10, '{}', null, false)) = 'stale', 'boshqa versiya natijasi tashlanadi (stale)');
select pg_temp.fails($$select public.moderation_apply('worker', (select id from wid), (select ver from wid), 'approve', 'job_related', 'x', null, '{}')$$, 'noto''g''ri qaror qiymati qabul qilinmaydi', 'invalid_decision');
select pg_temp.fails($$select public.moderation_apply('worker', (select id from wid), (select ver from wid), 'allow', 'jobs', 'x', null, '{}')$$, 'noto''g''ri kategoriya qabul qilinmaydi', 'invalid_category');
select pg_temp.ok((select public.moderation_apply('worker', (select id from wid), (select ver from wid), 'allow', 'job_related', 'ok', null, '{}', 'ai', 'test', 10, '{}', null, false)) = 'listed', 'AI ruxsati → joylandi');
select pg_temp.superuser();
select pg_temp.ok((select is_public from public.worker_profiles where id = (select id from wid)), 'endi qidiruvda');
select pg_temp.ok((select count(*) from public.moderation_checks where entity_id = (select id from wid) and decision in ('allow', 'stale')) = 2, 'tekshiruv tarixi yozildi (allow + stale)');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_workers((select node from fx), (select region from fx)) where first_name = 'Ali') = 1, 'mehmon qidiruvida chiqdi');

-- Tahrir: o'zgargan matn qayta tekshiriladi, tekshirilmagan matn ommaga chiqmaydi
select pg_temp.login('6a000000-0000-0000-0000-000000000001');
update public.worker_profiles set about = 'Bosh buxgalter, 1C, soliq, kadrlar hisobi' where profile_id = auth.uid();
select pg_temp.ok((select not is_public and publish_requested and moderation_state = 'pending' and moderation_version = (select ver from wid) + 1
                   from public.worker_profiles where profile_id = auth.uid()), 'tahrir → yashirildi, versiya oshdi, qayta tekshiruv');
select pg_temp.ok((public.my_listing_state('worker', (select id from wid)) ->> 'state') = 'moderation_pending', 'holat: tekshiruvda');

-- Rad etish → sabab, maydon, qayta ko'rib chiqish so'rovi
select pg_temp.service();
select pg_temp.ok((select public.moderation_apply('worker', (select id from wid), (select ver from wid) + 1, 'reject', 'unrelated', 'not_job',
  'Ish Beruvchi faqat ish va ishchi qidirish e''lonlarini qabul qiladi.', array['description'], 'ai', 'test', 10, '{}', null, true)) = 'rejected', 'AI rad etdi');
select pg_temp.login('6a000000-0000-0000-0000-000000000001');
select pg_temp.ok((select (s ->> 'state') = 'rejected' and (s -> 'fields') ? 'description' and (s ->> 'can_appeal')::boolean and (s ->> 'message') like 'Ish Beruvchi%'
                   from public.my_listing_state('worker', (select id from wid)) s), 'egasi sababni va maydonni ko''radi');
select pg_temp.ok((select about from public.worker_profiles where profile_id = auth.uid()) = 'Bosh buxgalter, 1C, soliq, kadrlar hisobi', 'yozilgan ma''lumot o''chirilmadi');
select pg_temp.ok((select count(*) from public.notifications where payload ->> 'kind' = 'moderation_result' and payload ->> 'state' = 'rejected') = 1, 'rad etish haqida bildirishnoma');
select public.request_moderation_appeal('worker', (select id from wid), 'Bu oddiy buxgalter e''loni');
select pg_temp.ok((select moderation_state = 'review' from public.worker_profiles where profile_id = auth.uid()), 'qayta ko''rib chiqish so''raldi → admin navbatida');
select pg_temp.fails($$select public.request_moderation_appeal('worker', (select id from wid), 'yana')$$, 'ikkinchi marta so''rab bo''lmaydi', 'appeal_not_allowed');

-- Admin: MFA (aal2) bo'lmasa huquq yo'q
select pg_temp.login_aal1('6a000000-0000-0000-0000-000000000003');
select pg_temp.ok(not public.is_admin(), 'aal1 sessiyada admin emas');
select pg_temp.fails($$select public.admin_moderation_decide('worker', (select id from wid), 'allow')$$, 'MFA siz admin qaror qabul qila olmaydi', '42501');
select pg_temp.ok((public.my_admin_status() ->> 'is_staff')::boolean and not (public.my_admin_status() ->> 'aal_ok')::boolean, 'my_admin_status: xodim, lekin MFA kerak');
select pg_temp.login('6a000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.admin_moderation_decide('worker', (select id from wid), 'reject')$$, 'rad etishda sabab majburiy', 'message_required');
select pg_temp.ok(public.admin_moderation_decide('worker', (select id from wid), 'allow') = 'listed', 'admin ruxsati (aal2) → joylandi');
select pg_temp.ok((select count(*) from public.audit_logs where action = 'moderation.allow' and target_id = (select id from wid)::text) = 1, 'admin qarori auditda');

-- Ism o'zgarsa — qayta tekshiruv; egasi yashirsa — navbatdan chiqadi
select pg_temp.login('6a000000-0000-0000-0000-000000000001');
update public.profiles set first_name = 'Alisher' where id = auth.uid();
select pg_temp.ok((select not is_public and publish_requested and moderation_state = 'pending' from public.worker_profiles where profile_id = auth.uid()), 'ism o''zgardi → qayta tekshiruv');
select pg_temp.service();
select public.moderation_fail('worker', (select id from wid), (select moderation_version from public.worker_profiles where id = (select id from wid)), 'ai_timeout');
select pg_temp.superuser();
select pg_temp.ok((select moderation_attempts = 1 and moderation_next_at > now() and moderation_state = 'pending' from public.worker_profiles where id = (select id from wid)),
  'AI ishlamadi → e''lon kutishda qoladi, keyinroq qayta uriniladi');
select pg_temp.service();
select pg_temp.ok((select count(*) from public.moderation_claim(10) where o_id = (select id from wid)) = 0, 'qayta urinish vaqti kelmaguncha olinmaydi');
select pg_temp.ok((select public.moderation_apply('worker', (select id from wid), (select moderation_version from public.worker_profiles where id = (select id from wid)),
  'allow', 'job_related', 'ok', null, '{}', 'ai', 'test', 10, '{}', null, false)) = 'listed', 'qayta tekshiruv → joylandi');

-- =====================================================================
-- Vakansiya: moderatsiya + ish beruvchi darvozasi
-- =====================================================================
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
select pg_temp.ok((select public.save_simple_vacancy((select p from vac_args)) ->> 'state') = 'moderation_pending', 'vakansiya: tekshiruv kutilmoqda');
select pg_temp.superuser();
create temp table vid on commit drop as select id, moderation_version as ver from public.vacancies where client_ref = '7b000000-0000-4000-8000-000000000001';
grant select on vid to anon, authenticated, service_role;
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
update public.vacancies set status = 'active' where id = (select id from vid);
select pg_temp.ok((select status = 'pending_review' from public.vacancies where id = (select id from vid)), 'to''g''ridan-to''g''ri active qilib bo''lmaydi');
select pg_temp.anon();
select pg_temp.ok((select count(*) from public.simple_search_vacancies((select node from fx), (select region from fx))) = 0, 'tekshirilmagan vakansiya qidiruvda yo''q');

-- obunalar (Telegram) — vakansiya chiqishidan oldin
select pg_temp.login('6a000000-0000-0000-0000-000000000001');
select public.set_match_subscription('worker', true, 'instant');
select pg_temp.superuser();
insert into public.telegram_accounts (telegram_user_id, profile_id, bot_started) values (710000001, '6a000000-0000-0000-0000-000000000001', true);
select pg_temp.service();
select public.confirm_match_subscription('6a000000-0000-0000-0000-000000000001', 'worker');

select pg_temp.ok((select public.moderation_apply('vacancy', (select id from vid), (select ver from vid), 'allow', 'job_related', 'ok', null, '{}', 'ai', 'test', 10, '{}', null, false)) = 'verification_pending',
  'tekshiruvdan o''tdi, lekin ish beruvchi tasdiqlanmagan → kutadi');
select pg_temp.superuser();
select pg_temp.ok((select status = 'pending_review' from public.vacancies where id = (select id from vid)), 'birinchi vakansiya ommaga chiqmadi');
select pg_temp.ok((select count(*) from public.verification_requests where profile_id = '6a000000-0000-0000-0000-000000000002' and status = 'pending' and note = 'auto:first_vacancy') = 1, 'tasdiqlash so''rovi avtomatik yaratildi');
select pg_temp.ok((select verification_status = 'pending' from public.employer_profiles where profile_id = '6a000000-0000-0000-0000-000000000002'), 'ish beruvchi holati: tekshiruvda');
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
select pg_temp.ok((public.my_listing_state('vacancy', (select id from vid)) ->> 'state') = 'verification_pending', 'egasi holatni ko''radi: tasdiqlash kutilmoqda');
select pg_temp.fails($$update public.employer_profiles set verification_status = 'verified' where profile_id = auth.uid()$$, 'ish beruvchi o''zini tasdiqlay olmaydi (RLS)');
update public.employer_profiles set verification_checks = array['phone', 'documents'] where profile_id = auth.uid();
select pg_temp.ok((select verification_status = 'pending' and verification_checks = '{}' from public.employer_profiles where profile_id = auth.uid()), 'tekshirilgan maydonlar ro''yxatini ham o''zgartira olmaydi');

select pg_temp.login('6a000000-0000-0000-0000-000000000004');
select pg_temp.fails($$select public.admin_set_employer_status('6a000000-0000-0000-0000-000000000002', 'verified')$$, 'tahlilchi tasdiqlay olmaydi', '42501');
select pg_temp.ok((public.admin_stats_v2(now() - interval '1 day', now() + interval '1 minute') ->> 'users_new')::int >= 5, 'tahlilchi statistikani ko''radi');
select pg_temp.fails($$select public.admin_queue_status()$$, 'tahlilchi navbat xatolarini ko''rmaydi', '42501');

select pg_temp.login('6a000000-0000-0000-0000-000000000003');
select pg_temp.ok(public.admin_set_employer_status('6a000000-0000-0000-0000-000000000002', 'verified', array['phone', 'name', 'region'], null) = 1, 'admin tasdiqladi → kutayotgan vakansiya chiqdi');
select pg_temp.ok((select status = 'active' and expires_at > now() + interval '9 days' from public.vacancies where id = (select id from vid)), 'vakansiya faol, to''liq muddat bilan');
select pg_temp.ok((select verification_checks = array['phone', 'name', 'region'] and verified_at is not null from public.employer_profiles where profile_id = '6a000000-0000-0000-0000-000000000002'),
  'nima tekshirilgani saqlandi');
select pg_temp.ok((select (public.admin_queue_status() -> 'match_jobs' ->> 'queued')::int) >= 1, 'nashr hodisasi navbatga tushdi');

-- Moslik hodisasi → ishchiga (obunali) va ish beruvchiga (obunasiz) xabar
select pg_temp.service();
select public.process_match_jobs(10);
select pg_temp.superuser();
select pg_temp.ok((select score >= 90 and not hard_fail and complete from public.matches where worker_id = (select id from wid) and vacancy_id = (select id from vid)), 'moslik 90%+ va qat''iy talab buzilmagan');
select pg_temp.ok((select count(*) from public.notifications where profile_id = '6a000000-0000-0000-0000-000000000001' and type = 'new_matching_vacancy' and tg_status = 'queued') = 1,
  'obunali ishchiga Telegram xabari navbatda');
select pg_temp.ok((select count(*) from public.notifications where profile_id = '6a000000-0000-0000-0000-000000000002' and type = 'new_matching_worker' and tg_status = 'none') = 1,
  'obunasiz ish beruvchiga faqat ilova ichida (Telegram yo''q)');
select public.enqueue_match_job('vacancy', (select id from vid), 'updated');
select pg_temp.service();
select public.process_match_jobs(10);
select pg_temp.superuser();
select pg_temp.ok((select count(*) from public.notifications where type in ('new_matching_vacancy', 'new_matching_worker')) = 2, 'takroriy hodisa takroriy xabar yaratmaydi');
select pg_temp.ok((select count(*) from public.match_notifications) = 2, 'juftlik daftari: har tomonga bitta');

-- Obuna o'chirilsa — navbatdagi xabar to'xtaydi
select pg_temp.login('6a000000-0000-0000-0000-000000000001');
select public.set_match_subscription('worker', false, 'instant');
select pg_temp.superuser();
select pg_temp.ok((select tg_status = 'skipped' from public.notifications where profile_id = '6a000000-0000-0000-0000-000000000001' and type = 'new_matching_vacancy'), 'obuna o''chirildi → xabar yuborilmaydi');

-- Tahrir: active vakansiya matni o'zgarsa — qayta tekshiruv, muddat uzaymaydi
select pg_temp.superuser();
create temp table vexp on commit drop as select expires_at from public.vacancies where id = (select id from vid);
grant select on vexp to authenticated, service_role;
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
update public.vacancies set description = 'Kafega tajribali buxgalter kerak, 1C bilishi shart' where id = (select id from vid);
select pg_temp.ok((select status = 'pending_review' and moderation_state = 'pending' from public.vacancies where id = (select id from vid)), 'tahrir → tekshirilmagan matn ommaga chiqmaydi');
select pg_temp.service();
select pg_temp.ok((select public.moderation_apply('vacancy', (select id from vid), (select moderation_version from public.vacancies where id = (select id from vid)),
  'allow', 'job_related', 'ok', null, '{}', 'ai', 'test', 10, '{}', null, false)) = 'active', 'qayta tekshiruv → yana faol');
select pg_temp.superuser();
select pg_temp.ok((select expires_at = (select expires_at from vexp) from public.vacancies where id = (select id from vid)), 'muddat tahrir bilan uzaymadi');

-- Yopilgan vakansiya haqida navbatdagi xabar yaratilmaydi
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
select public.set_vacancy_status((select id from vid), 'closed');
select pg_temp.superuser();
select public.enqueue_match_job('vacancy', (select id from vid), 'updated');
select pg_temp.service();
select public.process_match_jobs(10);
select pg_temp.superuser();
select pg_temp.ok((select result ->> 'inactive' from public.match_jobs where entity_id = (select id from vid) order by id desc limit 1) = 'true', 'yopilgan e''lon bo''yicha xabar yo''q');

-- To'xtatish: vakansiyalar yashiriladi; qayta tasdiqlansa qaytadi
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
select public.publish_vacancy((select id from vid));
select pg_temp.ok((select status = 'active' from public.vacancies where id = (select id from vid)), 'tasdiqlangan ish beruvchi: o''zgarmagan e''lon qayta joylanadi');
select pg_temp.login('6a000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.admin_set_employer_status('6a000000-0000-0000-0000-000000000002', 'suspended')$$, 'to''xtatishda sabab majburiy', 'message_required');
select public.admin_set_employer_status('6a000000-0000-0000-0000-000000000002', 'suspended', '{}', 'Shikoyatlar');
select pg_temp.ok((select status = 'hidden' from public.vacancies where id = (select id from vid)), 'to''xtatildi → vakansiya yashirildi');
select pg_temp.ok(public.admin_set_employer_status('6a000000-0000-0000-0000-000000000002', 'verified', array['phone'], null) = 1, 'qayta tasdiqlandi → vakansiya qaytdi');

-- Rad etish (admin) → holat va sabab
select pg_temp.ok(public.admin_moderation_decide('vacancy', (select id from vid), 'reject', 'Matnda ishga aloqasiz reklama bor') = 'rejected', 'admin rad etdi');
select pg_temp.ok((select status = 'rejected' and moderation_message like 'Matnda%' from public.vacancies where id = (select id from vid)), 'vakansiya rad etildi, sabab saqlandi');

-- =====================================================================
-- Moslik v2: noma'lum ma'lumot "mos" emas, davrlar tenglashtirilmaydi, qat'iy talab
-- =====================================================================
select pg_temp.superuser();
update public.vacancies set salary_negotiable = true, salary_from = null, salary_to = null where id = (select id from vid);
select pg_temp.ok((select r ->> 'ok' from jsonb_array_elements(public.compute_match_v2((select id from wid), (select id from vid)) -> 'reasons') r where r ->> 'key' = 'salary_negotiable') = 'unknown',
  '"Kelishiladi" — to''liq moslik emas');
update public.vacancies set salary_negotiable = false, salary_from = 300000, salary_to = 400000, salary_type = 'daily' where id = (select id from vid);
select pg_temp.ok((select r ->> 'key' from jsonb_array_elements(public.compute_match_v2((select id from wid), (select id from vid)) -> 'reasons') r where r ->> 'key' like 'salary%') = 'salary_type_differs',
  'kunlik va oylik maosh tenglashtirilmaydi');
update public.vacancies set salary_type = 'monthly', salary_from = 4000000, salary_to = 6500000, region_id = (select other_region from fx), district_id = null where id = (select id from vid);
select pg_temp.ok((select (m ->> 'hard_fail')::boolean and (m -> 'hard') ? 'location_mismatch' from (select public.compute_match_v2((select id from wid), (select id from vid)) m) s),
  'boshqa viloyat → qat''iy nomuvofiqlik');

-- Admin: og'irliklar jami 100, chegara, versiya, audit
select pg_temp.login('6a000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.admin_update_matching('{"profession":30,"location":15,"salary":15,"experience":10,"skills":15,"schedule":10,"employment":5,"language":5}'::jsonb, 90)$$, 'og''irliklar jami 100 bo''lishi shart', 'weights_must_sum_100');
select pg_temp.ok(public.admin_update_matching('{"profession":25,"location":15,"salary":15,"experience":10,"skills":15,"schedule":10,"employment":5,"language":5}'::jsonb, 85) = 3, 'sozlama yangilandi, versiya oshdi');
select pg_temp.ok((select count(*) from public.audit_logs where action = 'matching.update') = 1, 'o''zgarish auditda');

-- =====================================================================
-- Telegram: bir martalik token
-- =====================================================================
select pg_temp.login('6a000000-0000-0000-0000-000000000002');
select pg_temp.fails($$select public.create_telegram_link_token('abc')$$, 'token xeshi formati tekshiriladi', 'invalid_token');
select public.create_telegram_link_token(repeat('a', 64), 'employer');
select public.create_telegram_link_token(repeat('b', 64), 'employer');
select pg_temp.fails($$select public.consume_telegram_link_token(repeat('a', 64), 1)$$, 'tokenni mijoz ishlata olmaydi', '42501');
select pg_temp.service();
select pg_temp.ok((public.consume_telegram_link_token(repeat('a', 64), 710000002, 'kafe', 'Kafe') ->> 'status') = 'linked', 'token → hisob bog''landi');
select pg_temp.ok((public.consume_telegram_link_token(repeat('a', 64), 710000002) ->> 'status') = 'used', 'token qayta ishlatilmaydi');
select pg_temp.ok((public.consume_telegram_link_token(repeat('b', 64), 710000001) ->> 'status') = 'linked_elsewhere', 'boshqa hisobga bog''langan Telegram ko''chirilmaydi');
select pg_temp.superuser();
update public.telegram_link_tokens set expires_at = now() - interval '1 minute', used_at = null where token_hash = repeat('b', 64);
select pg_temp.service();
select pg_temp.ok((public.consume_telegram_link_token(repeat('b', 64), 710000002) ->> 'status') = 'expired', 'muddati o''tgan token rad etiladi');
select pg_temp.superuser();
select pg_temp.ok((select profile_id = '6a000000-0000-0000-0000-000000000002' and bot_started from public.telegram_accounts where telegram_user_id = 710000002), 'chat_id hisobga bog''landi');
select public.telegram_blocked('6a000000-0000-0000-0000-000000000001');
select pg_temp.ok((select not bot_started from public.telegram_accounts where telegram_user_id = 710000001), 'bot bloklandi → yuborish to''xtadi');

-- Kuzatiladigan havola: ochilish alohida o'lchanadi
select pg_temp.anon();
select pg_temp.ok((select public.notification_open((select open_token from public.notifications limit 0))) is null, 'noma''lum token — hech narsa');
select pg_temp.superuser();
create temp table tok on commit drop as select open_token, link from public.notifications where type = 'new_matching_vacancy' limit 1;
grant select on tok to anon;
select pg_temp.anon();
select pg_temp.ok(public.notification_open((select open_token from tok)) = (select link from tok), 'havola ochildi → manzil qaytdi');
select pg_temp.superuser();
select pg_temp.ok((select opened_at is not null from public.notifications where open_token = (select open_token from tok)), 'ochilish vaqti yozildi');

rollback;
