-- ISH TOPDIM · prod bazani yangilash: 0082…0083 migratsiyalari BITTA faylda (2 ta).
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

-- ═══════════════ 0082_search_translit.sql ═══════════════
-- ISH TOPDIM · 0082 · Qidiruv: kirill/lotin va tutuq belgisidan qat'i nazar e'lon topiladi
--
-- Ega (2026-11-18): "bazadagi e'lonlarni qidirsam topmayapti". Sabab: kasbi ro'yxatdan tanlanmagan (o'zi yozgan) e'lon
-- sarlavhasi bo'yicha qidiriladi, lekin faqat kasbning lotin (name_uz) va rus (name_ru) nomi bilan solishtirilardi.
-- Kirill harfida yozilgan "Ўқитувчи" yoki tutuq belgisisiz "Oqituvchi" — "O'qituvchi" bo'yicha topilmasdi.
--
--  1) public.uz_fold(text) — solishtirish uchun yagona shakl: kichik harf, o'zbek/rus kirill → lotin, tutuq belgilari
--     (' ‘ ’ ʻ ʼ `) olib tashlanadi, qolgan belgilar — bo'shliq. "Ўқитувчи", "O'qituvchi", "Oʻqituvchi", "oqituvchi" → "oqituvchi".
--  2) Kasbsiz e'lon/ishchi uchun zaxira solishtiruv (simple_search_vacancies, _v2, _v3, simple_search_workers, _v2)
--     uz_fold bilan va o'zi yozgan kasb nomi (custom_profession) ham qo'shiladi. Aniq yamoq: naqsh har funksiyada aynan
--     1 marta uchrashi shart (aks holda migratsiya to'xtaydi); allaqachon yamalgan bo'lsa — tegmaydi. CRLF (Windows SQL
--     Editor) bilan ham ishlaydi.
--
-- Ma'lumotga tegilmaydi. Takror ishga tushirish xavfsiz. Rollback: supabase/rollbacks/0082_search_translit.down.sql

create or replace function public.uz_fold(t text)
returns text language sql immutable parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        -- so'z boshidagi "е" — "ye" ("Етказиб" → "yetkazib")
        regexp_replace(lower(coalesce(t, '')), '(^|[^а-яёўқғҳ])е', '\1ye', 'g'),
        'ш', 'sh'), 'ч', 'ch'), 'щ', 'sh'), 'ё', 'yo'), 'ю', 'yu'), 'я', 'ya'), 'ц', 'ts'), 'ў', 'o'), 'ғ', 'g'), 'ъ', ''), 'ь', ''), 'ж', 'j'),
      'абвгдезийклмнопрстуфхқҳыэ''‘’ʻʼ`´',
      'abvgdeziyklmnoprstufxqhie'),
    '[^a-z0-9]+', ' ', 'g'));
$$;
grant execute on function public.uz_fold(text) to anon, authenticated, service_role;

do $patch$
declare
  fns text[] := array[
    'public.simple_search_vacancies(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer)',
    'public.simple_search_vacancies_v2(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer,salary_type)',
    'public.simple_search_vacancies_v3(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer,salary_type,employer_type,boolean,boolean)',
    'public.simple_search_workers(uuid,uuid,uuid,boolean,boolean,integer,integer)',
    'public.simple_search_workers_v2(uuid,uuid,uuid,boolean,boolean,integer,integer,boolean)'];
  vac_old text := replace($o$(lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')$o$, E'\r', '');
  vac_new text := replace($n$(public.uz_fold(v.title || ' ' || coalesce(v.custom_profession, '')) like '%' || public.uz_fold(node.name_uz) || '%' and length(public.uz_fold(node.name_uz)) >= 3
             or public.uz_fold(v.title || ' ' || coalesce(v.custom_profession, '')) like '%' || public.uz_fold(node.name_ru) || '%' and length(public.uz_fold(node.name_ru)) >= 3)$n$, E'\r', '');
  wrk_old text := replace($o$(lower(coalesce(w.headline, '')) like '%' || lower(node.name_uz) || '%' or lower(coalesce(w.headline, '')) like '%' || lower(node.name_ru) || '%')$o$, E'\r', '');
  wrk_new text := replace($n$(public.uz_fold(coalesce(w.headline, '') || ' ' || coalesce(w.custom_profession, '')) like '%' || public.uz_fold(node.name_uz) || '%' and length(public.uz_fold(node.name_uz)) >= 3
                   or public.uz_fold(coalesce(w.headline, '') || ' ' || coalesce(w.custom_profession, '')) like '%' || public.uz_fold(node.name_ru) || '%' and length(public.uz_fold(node.name_ru)) >= 3)$n$, E'\r', '');
  f text;
  def text;
  old text;
  new text;
  n int;
begin
  foreach f in array fns loop
    def := replace(pg_get_functiondef(f::regprocedure), E'\r', '');
    if position('uz_fold' in def) > 0 then continue; end if; -- allaqachon yamalgan
    if position('simple_search_workers' in f) > 0 then old := wrk_old; new := wrk_new; else old := vac_old; new := vac_new; end if;
    n := (length(def) - length(replace(def, old, ''))) / length(old);
    if n <> 1 then raise exception '0082: % — naqsh % marta uchradi (1 kutilgan)', f, n; end if;
    execute replace(def, old, new);
  end loop;
end $patch$;

-- ═══════════════ 0083_vacancy_channel_phone.sql ═══════════════
-- 0083 · Vakansiya raqami Telegram kanalda (ega, 2026-11-18: "rasm tagiga to'liq yozilsin, nomerlar bilan to'liq vakansiya").
--
--   vacancy_contacts.channel_phone_at — ish beruvchi "Aloqa raqamim e'londa va Telegram kanalda ko'rinsin" roziligini
--   bergan vaqt. Ilova e'lonni saqlaganda yozadi (egasining o'z RLS huquqi bilan: vacancy_contacts_write); rozilik
--   olib tashlansa — null. Kanal posti raqamni FAQAT show_phone = true va channel_phone_at bor bo'lsa ko'rsatadi.
--   Bu ustundan oldingi roziliklar (matnda kanal tilga olinmagan edi) — null, ya'ni kanalda raqamsiz.
--   Ishchi e'lonlari o'zgarmaydi: kanalda ism va telefon yo'q (ularga shunday va'da berilgan).
--
--   Qaytarish (rollback): supabase/rollbacks/0083_vacancy_channel_phone.down.sql

alter table public.vacancy_contacts add column if not exists channel_phone_at timestamptz;

comment on column public.vacancy_contacts.channel_phone_at is
  'Ish beruvchi raqamni Telegram kanal postida ko''rsatishga rozilik bergan vaqt (null — kanalda raqamsiz)';

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
  ('0083', 'vakansiya raqami kanalda: rozilik vaqti (vacancy_contacts.channel_phone_at)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vacancy_contacts' and column_name = 'channel_phone_at'))
) as m(migration, tekshiruv, bor)
order by m.migration;
