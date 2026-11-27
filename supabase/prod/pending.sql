-- ISH TOPDIM · prod bazani yangilash: 0093…0093 migratsiyalari BITTA faylda (1 ta).
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

-- ═══════════════ 0093_profession_images.sql ═══════════════
-- ISH TOPDIM · 0093 · Kasb rasmi: e'lonning tayyor rasmi, foydalanuvchi va admin uchun navbat
--
-- Ega (2026-11-27): "har bitta kasbga rasm yaratib olsak, birinchi qo'yib chiqsin — oddiy rasmni tanlab «Joylash» bossa
-- buzilmasin" → tanlovi: "Kerak bo'lganda + tugma".
--
-- 0047 dagi profession_images (har kasbga bitta rasm, soatlik fon vazifasi) saqlanadi; rasm provayderi ilovada OpenAI'ga
-- o'tkazildi (e'lon rasmlari bilan bir xil). Bu migratsiya:
--  · claim_profession_image_by — foydalanuvchi e'lon tekshiruvida "Rasm yaratish"ni bosganda kasbga rasm (shu zahoti) va
--    admin panelidagi "oldindan yaratish" tugmasi uchun navbat (faqat service role). Foydalanuvchi — e'lon rasmlari bilan
--    umumiy hisoblagichlar (listing_images:user:<id> — kishiga sutkada listing_images_user_daily, adminga yo'q;
--    listing_images:day — umumiy listing_images_daily_limit). Admin oldindan yaratganda (p_batch) — alohida sutkalik
--    chegara (profession_images_admin_daily, standart 200). Tayyor rasm qayta yaratilmaydi ('exists'), faqat faol admin
--    p_force bilan almashtira oladi (yangisi chiqmasa — eskisi qoladi, ilova qaytaradi).
--    Natija: ok | exists | busy | too_many | user_limit | daily_limit | forbidden | disabled | invalid.
--  · Provayder xatosi (Gemini 429 — kvota) bilan to'xtab qolgan urinishlar hisoblagichi nolga qaytariladi: bu kasbning
--    aybi emas, yangi provayder bilan qayta urinilsin. Rasm va yozuvlar o'chirilmaydi.
-- Takror ishga tushirish xavfsiz.

insert into public.app_settings (key, value, is_public) values
  ('profession_images_admin_daily', '200'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.claim_profession_image_by(
  p_node_id uuid, p_owner uuid, p_prompt text, p_model text, p_batch boolean default false, p_force boolean default false
)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.profession_images;
  admin boolean := exists (select 1 from public.admin_users a where a.profile_id = p_owner and a.is_active);
begin
  if p_node_id is null or p_owner is null then return 'invalid'; end if;
  if (p_batch or p_force) and not admin then return 'forbidden'; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'profession_images_enabled'), false) then return 'disabled'; end if;
  if not exists (select 1 from public.profession_nodes n where n.id = p_node_id and n.is_active) then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('profession_images:' || p_node_id::text));
  select * into r from public.profession_images where node_id = p_node_id;
  if r.status = 'pending' and r.updated_at > now() - interval '5 minutes' then return 'busy'; end if;
  if r.status = 'ready' and not p_force then return 'exists'; end if;
  if r.status = 'failed' and r.attempts >= 3 and not admin then return 'too_many'; end if;
  if p_batch then
    if not public.check_rate_limit('profession_images:admin_day', public.setting_int('profession_images_admin_daily', 200), 86400) then return 'daily_limit'; end if;
  else
    if not admin and not public.check_rate_limit('listing_images:user:' || p_owner::text, public.setting_int('listing_images_user_daily', 5), 86400) then return 'user_limit'; end if;
    if not public.check_rate_limit('listing_images:day', public.setting_int('listing_images_daily_limit', 100), 86400) then return 'daily_limit'; end if;
  end if;
  insert into public.profession_images (node_id, status, prompt, model, attempts, updated_at)
  values (p_node_id, 'pending', p_prompt, p_model, 1, now())
  on conflict (node_id) do update set status = 'pending', prompt = excluded.prompt, model = excluded.model,
    attempts = public.profession_images.attempts + 1, last_error = null, updated_at = now();
  return 'ok';
end $$;
revoke execute on function public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean) to service_role;

-- provayder kvotasi tugagani sababli to'xtagan urinishlar — qayta (bir marta: faqat hali 'failed' va provayder xatosi)
update public.profession_images
set attempts = 0, updated_at = now() - interval '1 hour'
where status = 'failed' and attempts > 0 and last_error ~ '^provider_http_(429|5[0-9][0-9]|401|403)';

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
  ('0089', 'usta e''loni rasmi (listing_images: master)', exists (select 1 from pg_constraint where conrelid = 'public.listing_images'::regclass and conname = 'listing_images_entity_check' and pg_get_constraintdef(oid) like '%master%')),
  ('0090', 'kanalga usta e''lonlari (channel_posts: master)', exists (select 1 from pg_constraint where conrelid = 'public.channel_posts'::regclass and conname = 'channel_posts_entity_type_check' and pg_get_constraintdef(oid) like '%master%')),
  ('0091', 'e''lon rasmi: adminlarga shaxsiy chegara yo''q', exists (select 1 from pg_proc where proname = 'claim_listing_image' and pg_get_functiondef(oid) like '%admin_users%')),
  ('0092', 'AI natijasiga shikoyat (report_target: ai_content)', exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'report_target' and e.enumlabel = 'ai_content')),
  ('0093', 'kasb rasmi: foydalanuvchi va admin navbati (claim_profession_image_by)', to_regprocedure('public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean)') is not null)
) as m(migration, tekshiruv, bor)
order by m.migration;
