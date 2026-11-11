-- ISH TOPDIM · prod bazadagi migratsiya holatini tekshirish (FAQAT O'QIYDI, hech narsani o'zgartirmaydi).
-- Qayerda: Supabase → loyiha → SQL Editor → shu faylni to'liq joylab "Run".
-- Natija: har bir migratsiya uchun "bor" yoki "YO'Q". "YO'Q" bo'lganlarini docs/RELEASE_CHECKLIST.md dagi tartibda qo'llang.
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
  ('0075', 'telegram_updates.attempts ustuni',        exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'telegram_updates' and column_name = 'attempts'))
) as m(migration, tekshiruv, bor)
order by m.migration;

-- Qo'shimcha: test / bo'sh kompaniyalar (faol vakansiyasi yo'q). O'CHIRMAYDI — faqat ro'yxat.
select c.id, c.name, c.slug, c.created_at,
       (select count(*) from public.vacancies v where v.company_id = c.id) as vakansiyalar_jami,
       (select count(*) from public.vacancies v where v.company_id = c.id and v.status = 'active') as faol
from public.companies c
where not exists (select 1 from public.vacancies v where v.company_id = c.id and v.status = 'active')
order by c.created_at;
