-- ISH TOPDIM · prod bazani yangilash: 0078…0078 migratsiyalari BITTA faylda (1 ta).
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

-- ═══════════════ 0078_prohibited_professions.sql ═══════════════
-- 0078 · Taqiqlangan kasblar katalogdan olinadi (ega, 2026-11-13: "massaj, spa kerak emas — hammasi shundan boshlanadi")
--
-- Massaj va spa kasblari (Massajchi, Spa massajchi, yuz/tay/antitsellyulit massaji …) va "massaj" bo'limi katalogda
-- ko'rsatilmaydi va tanlanmaydi. O'CHIRILMAYDI: is_active = false, selectable = false — kerak bo'lsa admin qaytaradi.
-- Ilova ham bu nomlarni katalogdan yashiradi (src/features/moderation/policy.ts) — bu migratsiya bazani shunga moslaydi.
-- Takror ishga tushirish xavfsiz (faqat hali faol qatorlar yangilanadi).

update public.profession_nodes
   set is_active = false, selectable = false
 where is_active
   and (name_uz ~* '(massaj|masaj|massaz)'
        or name_ru ~* 'массаж'
        or coalesce(name_en, '') ~* 'massage'
        or name_uz ~* '(^|[^a-z])spa([^a-z]|$)'
        or name_ru ~* '(^|[^а-я])спа([^а-я]|$)'
        or slug ~ '(massage|(^|-)spa(-|$))');

update public.subcategories
   set is_active = false
 where is_active
   and (slug ~ '(massage|(^|-)spa(-|$))' or name_uz ~* 'massaj' or name_ru ~* 'массаж');

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
  ('0078', 'massaj/spa kasblari katalogdan olingan',  not exists (select 1 from public.profession_nodes where is_active and (name_ru ~* 'массаж' or name_uz ~* 'massaj')))
) as m(migration, tekshiruv, bor)
order by m.migration;
