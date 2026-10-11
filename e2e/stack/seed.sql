-- E2E sinov ma'lumotlari (faqat izolyatsiyalangan ishuz_e2e bazasi). Production'ga qo'llanmaydi.
\set ON_ERROR_STOP on

-- natija aniq bo'lsin: moderatsiya, to'lov va ish beruvchi tasdig'i o'chiq (bu oqimlar SQL testlarida alohida sinaladi)
update public.app_settings set value = 'false'::jsonb
where key in ('moderation_enabled', 'listings_paid', 'employer_verification_required', 'ai_alerts_paid');

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('7e2e0000-0000-4000-8000-000000000001', '+998901110001', now(), '{"first_name":"Anvar","last_name":"Aliyev"}'),
  ('7e2e0000-0000-4000-8000-000000000002', '+998901110002', now(), '{"first_name":"Botir","last_name":"Boboyev"}'),
  ('7e2e0000-0000-4000-8000-000000000003', '+998901110003', now(), '{"first_name":"Dilnoza","last_name":""}')
on conflict (id) do nothing;

insert into public.profile_contacts (profile_id, phone, phone_verified_at) values
  ('7e2e0000-0000-4000-8000-000000000001', '+998901110001', now()),
  ('7e2e0000-0000-4000-8000-000000000002', '+998901110002', now()),
  ('7e2e0000-0000-4000-8000-000000000003', '+998901110003', now())
on conflict (profile_id) do update set phone = excluded.phone, phone_verified_at = excluded.phone_verified_at;
