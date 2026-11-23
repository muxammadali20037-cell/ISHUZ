-- ISH TOPDIM · prod bazani yangilash: 0089…0089 migratsiyalari BITTA faylda (1 ta).
-- BU FAYL AVTOMATIK YARATILADI (scripts/gen-prod-pending.mjs) — qo'lda tahrirlamang.
--
-- Qanday qo'llanadi (ega):
--   1) Supabase → loyiha → Database → Backups: bugungi zaxira nusxa borligini ko'ring.
--   2) Shu faylni to'liq nusxalang (GitHub'da "Raw" → Ctrl+A → Ctrl+C).
--   3) Supabase → SQL Editor → New query → joylang → Run.
--   4) Pastda jadval chiqadi: har qatorda "bor" bo'lishi kerak. Xato chiqsa — matnini yuboring (hech narsa o'zgarmagan bo'ladi).
--
-- Xavfsizlik: hammasi bitta tranzaksiyada (xato bo'lsa to'liq bekor qilinadi). Takror ishga tushirish zarar qilmaydi:
-- allaqachon bor narsalar qayta yaratilmaydi, ma'lumot o'chirilmaydi.

begin;

-- ═══════════════ 0089_master_listing_images.sql ═══════════════
-- ISH TOPDIM · 0089 · Usta e'loni rasmi (AI)
--
-- Ega (2026-11-23): "ustalarda ham rasm yaratish bo'lsin". 0087 dagi e'lon rasmlari (listing_images) endi usta e'loniga ham:
-- entity = 'master'. Rasm — e'lonning umumiy surati (muqova); usta yuklagan "ish namunalari" (master_listings.photos) bilan
-- aralashmaydi — u yerda faqat ustaning haqiqiy ishlari.
--  · listing_images.entity: 'vacancy' | 'worker' | 'master'.
--  · claim_listing_image — 'master' ham qabul qiladi (navbat va xarajat chegaralari o'sha: bir kishiga sutkada N ta, umumiy
--    sutkalik chegara, bir e'longa 3 urinish).
-- Hech narsa o'chirilmaydi; takror ishga tushirish xavfsiz.

alter table public.listing_images drop constraint if exists listing_images_entity_check;
alter table public.listing_images add constraint listing_images_entity_check check (entity in ('vacancy', 'worker', 'master'));

create or replace function public.claim_listing_image(p_entity text, p_entity_id uuid, p_owner uuid, p_prompt text, p_model text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.listing_images;
begin
  if p_entity not in ('vacancy', 'worker', 'master') then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('listing_images:' || p_entity || ':' || p_entity_id::text));
  select * into r from public.listing_images where entity = p_entity and entity_id = p_entity_id;
  if r.id is not null and r.status = 'pending' and r.updated_at > now() - interval '5 minutes' then return 'busy'; end if;
  if r.id is not null and r.attempts >= 3 then return 'too_many'; end if;
  -- xarajat: avval shaxsiy, keyin umumiy sutkalik chegara (har biri hisoblagichni oshiradi)
  if not public.check_rate_limit('listing_images:user:' || p_owner::text, public.setting_int('listing_images_user_daily', 5), 86400) then return 'user_limit'; end if;
  if not public.check_rate_limit('listing_images:day', public.setting_int('listing_images_daily_limit', 100), 86400) then return 'daily_limit'; end if;
  insert into public.listing_images (entity, entity_id, owner_profile_id, status, prompt, model, attempts, updated_at)
  values (p_entity, p_entity_id, p_owner, 'pending', p_prompt, p_model, 1, now())
  on conflict (entity, entity_id) do update set status = 'pending', owner_profile_id = excluded.owner_profile_id, prompt = excluded.prompt,
    model = excluded.model, attempts = public.listing_images.attempts + 1, last_error = null, updated_at = now();
  return 'ok';
end $$;
revoke execute on function public.claim_listing_image(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_listing_image(text, uuid, uuid, text, text) to service_role;

commit;

-- Natija: har migratsiya bo'yicha holat (hammasi "bor" bo'lishi kerak)
select m.migration, m.tekshiruv,
       case when m.bor then 'bor' else 'YO''Q' end as holat
from (values
  ('0068', 'search_vacancies_v2 funksiyasi',          to_regprocedure('public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)') is not null),
  ('0069', 'vacancy_public_stub funksiyasi',          to_regprocedure('public.vacancy_public_stub(text)') is not null),
  ('0070', 'search_vacancies_v3 funksiyasi',          exists (select 1 from pg_proc where proname = 'search_vacancies_v3' and pronamespace = 'public'::regnamespace)),
  ('0071', 'public_companies funksiyasi',             exists (select 1 from pg_proc where proname = 'public_companies' and pronamespace = 'public'::regnamespace)),
  ('0072', 'find_duplicate_vacancy funksiyasi',       exists (select 1 from pg_proc where proname = 'find_duplicate_vacancy' and pronamespace = 'public'::regnamespace)),
  ('0073', 'profile_interests jadvali',               to_regclass('public.profile_interests') is not null),
  ('0074', 'contact_reveals jadvali',                 to_regclass('public.contact_reveals') is not null),
  ('0075', 'telegram_updates.attempts ustuni',        exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'telegram_updates' and column_name = 'attempts')),
  ('0076', 'master_listings jadvali (Universal ustalar)', to_regclass('public.master_listings') is not null),
  ('0077', 'demo_vacancies jadvali (namuna vakansiyalar)', to_regclass('public.demo_vacancies') is not null),
  ('0078', 'massaj/spa kasblari katalogdan olingan',  not exists (select 1 from public.profession_nodes where is_active and (name_ru ~* 'массаж' or name_uz ~* 'massaj'))),
  ('0079', 'stories va channel_posts jadvallari (hikoyalar, kanalga avtomatik e''lon)', to_regclass('public.stories') is not null and to_regclass('public.channel_posts') is not null),
  ('0080', 'tariflar (payments.plan, public_tariffs)',  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'plan') and to_regprocedure('public.public_tariffs()') is not null),
  ('0081', 'e''londagi qo''lda yozilgan raqamlar (worker_listing_phones)', to_regclass('public.worker_listing_phones') is not null and position('listing_phone' in pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure)) > 0),
  ('0082', 'qidiruv: kirill/lotin (uz_fold)', to_regprocedure('public.uz_fold(text)') is not null and position('uz_fold' in pg_get_functiondef('public.simple_search_vacancies(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer)'::regprocedure)) > 0),
  ('0083', 'vakansiya raqami kanalda: rozilik vaqti (vacancy_contacts.channel_phone_at)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vacancy_contacts' and column_name = 'channel_phone_at')),
  ('0084', 'mehmonga "Raqamni ko''rsatish" (listing_phones_public)', to_regprocedure('public.listing_phones_public(text, uuid)') is not null),
  ('0085', 'Telegram orqali kodsiz kirish (telegram_web_logins)', to_regclass('public.telegram_web_logins') is not null),
  ('0086', 'bir kishida bir nechta ishchi e''loni (worker_profiles.is_primary)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'worker_profiles' and column_name = 'is_primary') and position('new_listing' in pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure)) > 0),
  ('0087', 'listing_images jadvali (e''lon rasmi, AI)', to_regclass('public.listing_images') is not null and to_regprocedure('public.claim_listing_image(text, uuid, uuid, text, text)') is not null),
  ('0088', 'contact_unlocks jadvali (ishchi raqamini ochish, chat)', to_regclass('public.contact_unlocks') is not null and to_regprocedure('public.unlock_worker_contact(uuid)') is not null and to_regprocedure('public.simple_worker_listing(uuid, boolean)') is not null),
  ('0089', 'usta e''loni rasmi (listing_images: master)', exists (select 1 from pg_constraint where conrelid = 'public.listing_images'::regclass and conname = 'listing_images_entity_check' and pg_get_constraintdef(oid) like '%master%'))
) as m(migration, tekshiruv, bor)
order by m.migration;
