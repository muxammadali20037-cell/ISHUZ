-- ISH.UZ · xavfsizlik testlari (audit topilmalari bo'yicha)
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
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

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', '+998901000001', now(), '{"first_name":"Ali","last_name":"Valiyev"}'),      -- ishchi
  ('a1000000-0000-0000-0000-000000000002', '+998901000002', now(), '{"first_name":"Bobur","last_name":"Karimov"}'),    -- kompaniya egasi
  ('a1000000-0000-0000-0000-000000000003', '+998901000003', now(), '{"first_name":"Vali","last_name":"Rekruter"}'),    -- rekruter (taklif orqali)
  ('a1000000-0000-0000-0000-000000000004', '+998901000004', now(), '{"first_name":"Gani","last_name":"Viewer"}'),      -- viewer
  ('a1000000-0000-0000-0000-000000000005', '+998901000005', now(), '{"first_name":"Xakker","last_name":"X"}'),         -- begona
  ('a1000000-0000-0000-0000-000000000006', null, null, '{"first_name":"Support","last_name":"S"}'),
  ('a1000000-0000-0000-0000-000000000007', null, null, '{"first_name":"Admin","last_name":"A"}'),
  ('a1000000-0000-0000-0000-000000000008', '+998901000008', now(), '{"first_name":"Yashirin","last_name":"Odam"}');   -- ochiq bo'lmagan foydalanuvchi
insert into public.admin_users (profile_id, role) values ('a1000000-0000-0000-0000-000000000006', 'support'), ('a1000000-0000-0000-0000-000000000007', 'admin');

-- ---------- Ali: ishchi ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
insert into public.worker_profiles (profile_id, headline, category_id, region_id, district_id, experience_level, onboarding_completed_at)
select 'a1000000-0000-0000-0000-000000000001', 'Kassir', c.id, r.id, d.id, '3_5y', now()
from public.categories c, public.regions r join public.districts d on d.region_id = r.id and d.slug = 'chilonzor' where c.slug = 'sales' and r.slug = 'tashkent_city';
insert into public.worker_geo (worker_id, lat, lng) values (public.current_worker_id(), 41.2753, 69.2040);
select pg_temp.fails($$update public.worker_profiles set views_count = 9999 where profile_id = auth.uid()$$, 'RLS: views_count ni o''zi oshira olmaydi');
select pg_temp.ok((select count(*) from public.profiles where id = 'a1000000-0000-0000-0000-000000000008') = 0, 'RLS: aloqasi yo''q profil ko''rinmaydi');
select pg_temp.ok((select count(*) from public.profiles where id = 'a1000000-0000-0000-0000-000000000001') = 1, 'RLS: o''z profili ko''rinadi');

-- ---------- Bobur: kompaniya + vakansiya ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
insert into public.employer_profiles (profile_id, employer_type) values ('a1000000-0000-0000-0000-000000000002', 'company');
select pg_temp.fails($$insert into public.companies (name, created_by, verification_status) values ('Firibgar', 'a1000000-0000-0000-0000-000000000002', 'verified')$$, 'RLS: o''zini verified qilib kompaniya ochib bo''lmaydi');
insert into public.companies (name, created_by) values ('Anor Market', 'a1000000-0000-0000-0000-000000000002');
create temp table t as select id as company_id from public.companies where name = 'Anor Market';
select pg_temp.fails($$insert into public.company_members (company_id, profile_id, role) select company_id, 'a1000000-0000-0000-0000-000000000003', 'recruiter' from t$$, 'RLS: a''zoni roziligisiz qo''shib bo''lmaydi');
insert into public.company_invites (company_id, invited_by, role) select company_id, 'a1000000-0000-0000-0000-000000000002', 'recruiter' from t;
insert into public.company_invites (company_id, invited_by, role) select company_id, 'a1000000-0000-0000-0000-000000000002', 'viewer' from t;
alter table t add column recruiter_token text, add column viewer_token text;
update t set recruiter_token = (select token from public.company_invites where role = 'recruiter'), viewer_token = (select token from public.company_invites where role = 'viewer');

insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, district_id, lat, lng, salary_from, salary_to, experience_min_months)
select 'a1000000-0000-0000-0000-000000000002', t.company_id, 'Kassir', c.id, r.id, d.id, 41.30, 69.25, 5000000, 7000000, 60
from t, public.categories c, public.regions r join public.districts d on d.region_id = r.id and d.slug = 'yunusobod' where c.slug = 'sales' and r.slug = 'tashkent_city';
alter table t add column vacancy_id uuid; update t set vacancy_id = (select id from public.vacancies where title = 'Kassir');
select pg_temp.fails($$insert into public.vacancies (owner_profile_id, title, is_featured) values (auth.uid(), 'Featured', true)$$, 'RLS: is_featured bilan yaratib bo''lmaydi');
select pg_temp.fails($$update public.vacancies set owner_profile_id = 'a1000000-0000-0000-0000-000000000005' where id = (select vacancy_id from t)$$, 'RLS: vakansiya egasini o''zgartirib bo''lmaydi');
select pg_temp.fails($$update public.vacancies set expires_at = now() + interval '10 years' where id = (select vacancy_id from t)$$, 'RLS: expires_at ni o''zi uzaytira olmaydi');
select pg_temp.ok((select public.publish_vacancy(vacancy_id) from t) = 'active', 'publish -> active');
update public.vacancies set title = 'Kassir-konsultant' where id = (select vacancy_id from t);
select pg_temp.ok((select title from public.vacancies where id = (select vacancy_id from t)) = 'Kassir-konsultant', 'faol vakansiyani tahrirlash mumkin (holat saqlanadi)');
select pg_temp.ok((select status from public.vacancies where id = (select vacancy_id from t)) = 'active', 'tahrirdan keyin holat active');

-- ---------- Rekruter va viewer taklif orqali qo'shiladi ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000003');
select public.accept_company_invite((select recruiter_token from t));
select pg_temp.ok((select role from public.company_members where profile_id = auth.uid()) = 'recruiter', 'taklif qabul qilindi: recruiter');
select pg_temp.fails($$select public.accept_company_invite((select recruiter_token from t))$$, 'taklif ikkinchi marta ishlamaydi', 'invite_invalid');
select pg_temp.ok(public.can_edit_vacancy((select vacancy_id from t)), 'recruiter vakansiyani tahrirlay oladi');
select pg_temp.login('a1000000-0000-0000-0000-000000000004');
select public.accept_company_invite((select viewer_token from t));
select pg_temp.ok(public.manages_vacancy((select vacancy_id from t)) and not public.can_edit_vacancy((select vacancy_id from t)), 'viewer ko''radi, lekin tahrirlay olmaydi');
select pg_temp.fails($$select public.set_vacancy_status((select vacancy_id from t), 'closed')$$, 'viewer vakansiyani yopa olmaydi', '42501');
select pg_temp.fails($$select public.send_offer(public.current_worker_id(), (select vacancy_id from t))$$, 'viewer taklif yubora olmaydi');

-- ---------- Masofa va compute_match ruxsati ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select pg_temp.ok((select distance_km from public.search_workers(p_lat => 41.30, p_lng => 69.25)) = ceil((select distance_km from public.search_workers(p_lat => 41.30, p_lng => 69.25))), 'masofa butun km (trilateratsiyaga qarshi)');
select pg_temp.ok((select (r->>'km')::numeric from public.compute_match((select id from public.worker_profiles limit 1), (select vacancy_id from t)), jsonb_array_elements(reasons) r where r->>'key' like 'distance%') = ceil((select (r->>'km')::numeric from public.compute_match((select id from public.worker_profiles limit 1), (select vacancy_id from t)), jsonb_array_elements(reasons) r where r->>'key' like 'distance%')), 'compute_match km butun son');
select pg_temp.ok((select score from public.compute_match((select id from public.worker_profiles limit 1), (select vacancy_id from t))) >= 75, '3–5 yil tajriba 5 yil talabga mos (yuqori chegara)');
select pg_temp.login('a1000000-0000-0000-0000-000000000005');
select pg_temp.fails($$select * from public.compute_match((select id from public.worker_profiles limit 1), (select vacancy_id from t))$$, 'begona compute_match chaqira olmaydi', '42501');
select pg_temp.fails($$select public.refresh_matches_for_worker((select id from public.worker_profiles limit 1))$$, 'begona refresh_matches chaqira olmaydi', '42501');

-- ---------- Ariza: qaytarib olish va qayta yuborish ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select public.apply_to_vacancy((select vacancy_id from t), 'salom');
select public.set_application_status((select id from public.applications), 'withdrawn');
select pg_temp.ok((select public.apply_to_vacancy((select vacancy_id from t), 'yana')) is not null, 'qaytarib olingandan keyin qayta ariza');
select pg_temp.ok((select status from public.applications) = 'sent', 'qayta ariza holati sent');
select pg_temp.login('a1000000-0000-0000-0000-000000000003');
select public.set_application_status((select id from public.applications), 'interview');
select pg_temp.fails($$select public.set_application_status((select id from public.applications), 'shortlisted')$$, 'orqaga o''tish taqiqlangan', 'invalid_transition');
select public.set_application_status((select id from public.applications), 'rejected');
-- Rad etilgan arizani taklif orqali tiriltirib bo'lmaydi
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select public.send_offer((select id from public.worker_profiles limit 1), (select vacancy_id from t));
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select public.respond_offer((select id from public.job_offers), true);
select pg_temp.ok((select status from public.applications) = 'rejected', 'rad etilgan ariza taklif bilan tirilmaydi');

-- ---------- Yopiq profil ham ariza yuborgan ish beruvchisiga ko'rinadi; arxiv vakansiya ishchiga ko'rinadi ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
update public.worker_profiles set is_public = false where profile_id = auth.uid();
select pg_temp.login('a1000000-0000-0000-0000-000000000005');
select pg_temp.ok((select count(*) from public.worker_profiles) = 0, 'yopiq profil begonaga ko''rinmaydi');
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.worker_profiles where profile_id = 'a1000000-0000-0000-0000-000000000001') = 1, 'yopiq profil ariza olgan ish beruvchiga ko''rinadi');
select public.set_vacancy_status((select vacancy_id from t), 'closed');
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.vacancies where id = (select vacancy_id from t)) = 1, 'yopilgan vakansiya ariza yuborgan ishchiga ko''rinadi');
update public.worker_profiles set is_public = true where profile_id = auth.uid();
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select public.publish_vacancy((select vacancy_id from t));

-- ---------- Custom taklif → ishga olish → sharh ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select public.send_offer((select id from public.worker_profiles limit 1), null, 'Omborchi', 'Sizni taklif qilamiz', 4000000, 5000000);
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select public.respond_offer((select id from public.job_offers where vacancy_id is null), true);
select pg_temp.fails($$select public.create_review(p_job_offer_id => (select id from public.job_offers where vacancy_id is null), p_rating => 5)$$, 'ishga olinmagan taklif uchun sharh yo''q', 'review_requires_hire');
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select public.mark_offer_hired((select id from public.job_offers where vacancy_id is null));
select pg_temp.ok((select public.create_review(p_job_offer_id => (select id from public.job_offers where vacancy_id is null), p_rating => 4, p_text => 'Yaxshi')) is not null, 'custom taklif bo''yicha sharh');
select pg_temp.ok((select target_profile_id from public.reviews) = 'a1000000-0000-0000-0000-000000000001', 'sharh nishoni — ishchi');

-- ---------- Shikoyat faqat RPC orqali ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select pg_temp.fails($$insert into public.reports (reporter_profile_id, target_type, target_id, reason) values (auth.uid(), 'vacancy', 'x', 'spam')$$, 'RLS: reports ga to''g''ridan-to''g''ri insert taqiqlangan');
select pg_temp.ok((select public.submit_report('vacancy', (select vacancy_id from t)::text, 'wrong_info', 'noto''g''ri maosh')) is not null, 'submit_report');
select pg_temp.fails($$select public.submit_report('vacancy', (select vacancy_id from t)::text, 'spam')$$, 'takroriy shikoyat', 'already_reported');

-- ---------- Chat: o'chirish faqat RPC ----------
select public.get_or_create_conversation(p_job_offer_id => (select id from public.job_offers where vacancy_id is null));
select public.send_message((select id from public.conversations), 'text', 'salom');
update public.messages set body = 'o''zgartirildi' where sender_id = auth.uid();  -- RLS: 0 qator
select pg_temp.ok((select body from public.messages) = 'salom', 'RLS: xabar matnini o''zgartirib bo''lmaydi');
select public.delete_message((select id from public.messages));
select pg_temp.ok((select deleted_at is not null and body is null from public.messages), 'delete_message');
select pg_temp.fails($$update public.conversation_members set last_read_at = '2000-01-01' where profile_id = auth.uid()$$, 'RLS: last_read_at to''g''ridan-to''g''ri o''zgarmaydi');
select pg_temp.fails($$update public.conversation_members set is_blocked = true where profile_id = auth.uid()$$, 'RLS: is_blocked to''g''ridan-to''g''ri o''zgarmaydi');
update public.conversation_members set is_muted = true where profile_id = auth.uid();
select pg_temp.ok((select is_muted from public.conversation_members where profile_id = auth.uid()), 'is_muted ni o''zgartirish mumkin');

-- ---------- Admin: moderatsiya qaytarilmaydi ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000007');
select public.admin_set_vacancy_status((select vacancy_id from t), 'hidden', 'shubhali');
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
update public.vacancies set status = 'draft' where id = (select vacancy_id from t);  -- RLS USING: hidden → 0 qator
select pg_temp.ok((select status from public.vacancies where id = (select vacancy_id from t)) = 'hidden', 'egasi yashirilgan vakansiyani o''zgartira olmaydi');
select pg_temp.fails($$select public.publish_vacancy((select vacancy_id from t))$$, 'yashirilgan vakansiyani e''lon qilib bo''lmaydi', 'invalid_status');
select pg_temp.login('a1000000-0000-0000-0000-000000000007');
select public.admin_set_vacancy_status((select vacancy_id from t), 'rejected', 'maosh noto''g''ri');
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
update public.vacancies set salary_to = 8000000 where id = (select vacancy_id from t);
select pg_temp.ok((select public.publish_vacancy((select vacancy_id from t))) = 'pending_review', 'rad etilgan vakansiya faqat moderatsiyaga qaytadi');
select pg_temp.login('a1000000-0000-0000-0000-000000000007');
select public.admin_set_vacancy_status((select vacancy_id from t), 'active');
select pg_temp.ok((select status = 'active' and not requires_review and expires_at > now() from public.vacancies where id = (select vacancy_id from t)), 'admin tasdiqladi: active, requires_review = false');

-- ---------- Admin darajalari ----------
select pg_temp.login('a1000000-0000-0000-0000-000000000006');
select pg_temp.ok((select count(*) from public.profile_contacts where profile_id <> auth.uid()) = 0, 'support admin telefonlarni ko''rmaydi');
select pg_temp.ok((select count(*) from public.messages) = 0, 'support admin chatni ko''rmaydi');
select pg_temp.ok(not (select allowed from public.get_contact('a1000000-0000-0000-0000-000000000001')), 'support get_contact yopiq');
select pg_temp.login('a1000000-0000-0000-0000-000000000007');
select pg_temp.ok((select count(*) from public.profile_contacts where profile_id <> auth.uid()) > 0, 'admin telefonlarni ko''radi');
select pg_temp.ok((select count(*) from public.messages) = 1, 'admin chatni ko''radi (moderatsiya)');

-- ---------- Bloklangan foydalanuvchi yoza olmaydi ----------
select public.admin_set_user_block('a1000000-0000-0000-0000-000000000002', true, 'spam');
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
update public.vacancies set title = 'X' where id = (select vacancy_id from t);  -- RLS USING: 0 qator
select pg_temp.ok((select title from public.vacancies where id = (select vacancy_id from t)) <> 'X', 'bloklangan: vakansiyani tahrirlay olmaydi');
select pg_temp.fails($$update public.companies set about = 'x' where id = (select company_id from t)$$, 'bloklangan: kompaniyani tahrirlay olmaydi');
select pg_temp.fails($$select public.set_application_status((select id from public.applications), 'hired')$$, 'bloklangan: ariza holatini o''zgartira olmaydi', 'blocked');
select pg_temp.fails($$select public.submit_report('profile', 'a1000000-0000-0000-0000-000000000001', 'spam')$$, 'bloklangan: shikoyat yubora olmaydi', 'blocked');

select pg_temp.superuser();
rollback;
\echo '✓ xavfsizlik testlari o''tdi'
