-- ISH TOPDIM · prod bazani yangilash: 0082…0085 migratsiyalari BITTA faylda (4 ta).
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

-- ═══════════════ 0084_public_listing_phones.sql ═══════════════
-- 0084 · E'londagi telefon raqamini mehmon ham ko'ra oladi — "Raqamni ko'rsatish" tugmasi orqali
--
--   Ega (2026-11-18): "telefon raqam hammaga ko'rinsin" — kirmagan mehmonga ham; tanlangan usul: raqam tugma bosilganda
--   ochiladi (OLX kabi), ommaviy yig'ish qiyin bo'lsin.
--
--   listing_phones_public(kind, id) — bitta faol e'lonning ochiq raqami(lar)i. Qoidalar kirgan foydalanuvchidagi bilan
--   bir xil (0074 simple_vacancy_phone, 0081 simple_worker_listing), faqat mehmonga ochiq bo'lganlari:
--     · vakansiya: e'londagi raqam (vacancy_contacts, faqat show_phone — egasi rozi bo'lsa) yoki kompaniya / ish beruvchi
--       aloqa raqami (eski to'liq formadagi e'lonlar); e'lon faol va egasi bloklanmagan;
--     · ishchi: e'londagi raqam(lar) (worker_listing_phones — e'lon uchun qo'lda yozilgan) yoki hisob raqami faqat
--       ko'rinishi "hamma" (everyone) bo'lsa; e'lon ochiq, holati "ish qidirmayapti" emas, egasi bloklanmagan.
--   Funksiyani faqat server kaliti chaqiradi (anon/authenticated — yo'q): ilova avval IP bo'yicha tezlik cheklovini
--   tekshiradi (soatiga/sutkasiga), keyin chaqiradi. Kirgan foydalanuvchi avvalgidek 0074 limiti bilan ko'radi.
--   Ro'yxatlar (qidiruv) raqam qaytarmaydi — o'zgarmaydi.
--
--   Faqat yangi funksiya: mavjud ma'lumot va funksiyalarga tegilmaydi. Takror ishga tushirish xavfsiz.
--   Qaytarish (rollback): supabase/rollbacks/0084_public_listing_phones.down.sql

create or replace function public.listing_phones_public(p_kind text, p_id uuid)
returns table (phone text, phone2 text)
language sql stable security definer set search_path = public as $$
  select x.phone, x.phone2 from (
    select case
             when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
             else coalesce(co.phone, ep.contact_phone)
           end as phone,
           null::text as phone2
      from public.vacancies v
      left join public.profiles op on op.id = v.owner_profile_id
      left join public.vacancy_contacts vc on vc.vacancy_id = v.id
      left join public.companies co on co.id = v.company_id
      left join public.employer_profiles ep on ep.profile_id = v.owner_profile_id
     where p_kind = 'vacancy' and v.id = p_id and v.status = 'active' and coalesce(op.is_blocked, false) = false
    union all
    select coalesce(lp.phone, case when pc.phone_visibility = 'everyone' then pc.phone end),
           lp.phone2
      from public.worker_profiles w
      join public.profiles pf on pf.id = w.profile_id
      left join public.worker_listing_phones lp on lp.worker_id = w.id
      left join public.profile_contacts pc on pc.profile_id = w.profile_id
     where p_kind = 'worker' and w.id = p_id
       and w.is_public and w.status <> 'not_looking' and w.onboarding_completed_at is not null and not pf.is_blocked
  ) x
  where x.phone is not null;
$$;
revoke execute on function public.listing_phones_public(text, uuid) from public, anon, authenticated;
grant execute on function public.listing_phones_public(text, uuid) to service_role;

comment on function public.listing_phones_public(text, uuid) is
  'Mehmon uchun "Raqamni ko''rsatish": faol e''londagi ochiq raqam(lar). Faqat server kaliti (ilova IP limitini tekshiradi).';

-- ═══════════════ 0085_telegram_web_login.sql ═══════════════
-- 0085 · Telegram orqali kodsiz kirish (brauzerda)
--
--   Ega (2026-11-18): "Telegram orqali kirishda bossa Telegramga olib kirsin, kod terib yurmasin — shunday kirib ketsin".
--   Oqim: sayt bir martalik so'rov yaratadi → Telegram bot `/start w_<token>` bilan ochiladi → bot "✅ Kirish" tugmasini
--   ko'rsatadi (qaysi brauzer so'rayotgani yozilgan) → bosilganda so'rov tasdiqlanadi → brauzer (o'sha cookie bilan)
--   holatni so'raydi va sessiya ochiladi. Kod yozilmaydi.
--
--   Xavfsizlik:
--     · token va brauzer kaliti faqat xesh ko'rinishida saqlanadi; token — Telegram havolasida, brauzer kaliti — httpOnly
--       cookie'da (havola boshqaga o'tib qolsa ham, sessiyani faqat so'rovni boshlagan brauzer oladi);
--     · 5 daqiqa amal qiladi, bir marta tasdiqlanadi va bir marta ishlatiladi (atomik);
--     · jadvalga faqat server kaliti (security definer funksiyalar) kiradi: anon/authenticated — yo'q.
--
--   Faqat yangi jadval va funksiyalar. Takror ishga tushirish xavfsiz.
--   Qaytarish (rollback): supabase/rollbacks/0085_telegram_web_login.down.sql

create table if not exists public.telegram_web_logins (
  id               uuid primary key default gen_random_uuid(),
  token_hash       text not null unique,
  browser_hash     text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '5 minutes',
  telegram_user_id bigint,
  profile_id       uuid references public.profiles(id) on delete cascade,
  confirmed_at     timestamptz,
  consumed_at      timestamptz,
  constraint telegram_web_logins_hash_format check (token_hash ~ '^[0-9a-f]{64}$' and browser_hash ~ '^[0-9a-f]{64}$'),
  constraint telegram_web_logins_ua_len check (user_agent is null or length(user_agent) <= 120)
);
create index if not exists idx_telegram_web_logins_expires on public.telegram_web_logins (expires_at);
alter table public.telegram_web_logins enable row level security;
-- siyosat yo'q: faqat pastdagi funksiyalar (server kaliti)
revoke all on public.telegram_web_logins from public, anon, authenticated;
grant all on public.telegram_web_logins to service_role;

-- 1. so'rov yaratish (sayt). Eskilar (1 kundan eski) shu yerda tozalanadi.
create or replace function public.telegram_web_login_create(p_token_hash text, p_browser_hash text, p_user_agent text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  delete from public.telegram_web_logins where expires_at < now() - interval '1 day';
  insert into public.telegram_web_logins (token_hash, browser_hash, user_agent)
  values (p_token_hash, p_browser_hash, left(nullif(trim(p_user_agent), ''), 120))
  returning id into v_id;
  return v_id;
end $$;

-- 2. bot: token bo'yicha so'rovni topish (tasdiqlash tugmasi uchun). status: ok | expired | used | invalid
create or replace function public.telegram_web_login_preview(p_token_hash text)
returns table (id uuid, status text, user_agent text)
language sql stable security definer set search_path = public as $$
  select l.id,
         case when l.confirmed_at is not null or l.consumed_at is not null then 'used'
              when l.expires_at <= now() then 'expired'
              else 'ok' end,
         l.user_agent
    from public.telegram_web_logins l
   where l.token_hash = p_token_hash
  union all
  select null::uuid, 'invalid', null::text
   where not exists (select 1 from public.telegram_web_logins where token_hash = p_token_hash);
$$;

-- 3. bot: "✅ Kirish" bosildi — bir marta, muddati ichida. status: ok | expired | used | invalid
create or replace function public.telegram_web_login_confirm(p_id uuid, p_telegram_user_id bigint, p_profile_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare r public.telegram_web_logins;
begin
  update public.telegram_web_logins
     set telegram_user_id = p_telegram_user_id, profile_id = p_profile_id, confirmed_at = now()
   where id = p_id and confirmed_at is null and consumed_at is null and expires_at > now()
  returning * into r;
  if found then return 'ok'; end if;
  select * into r from public.telegram_web_logins where id = p_id;
  if not found then return 'invalid'; end if;
  if r.confirmed_at is not null or r.consumed_at is not null then return 'used'; end if;
  return 'expired';
end $$;

-- 4. brauzer: holat. Tasdiqlangan bo'lsa — atomik ishlatiladi va profil qaytadi (faqat o'sha brauzer kaliti bilan).
--    status: pending | ok | expired | used | invalid
create or replace function public.telegram_web_login_consume(p_id uuid, p_browser_hash text)
returns table (status text, profile_id uuid, telegram_user_id bigint)
language plpgsql volatile security definer set search_path = public as $$
declare r public.telegram_web_logins;
begin
  select * into r from public.telegram_web_logins l where l.id = p_id and l.browser_hash = p_browser_hash;
  if not found then return query select 'invalid'::text, null::uuid, null::bigint; return; end if;
  if r.consumed_at is not null then return query select 'used'::text, null::uuid, null::bigint; return; end if;
  if r.confirmed_at is null then
    if r.expires_at <= now() then return query select 'expired'::text, null::uuid, null::bigint; return; end if;
    return query select 'pending'::text, null::uuid, null::bigint; return;
  end if;
  update public.telegram_web_logins l set consumed_at = now()
   where l.id = p_id and l.consumed_at is null
  returning * into r;
  if not found then return query select 'used'::text, null::uuid, null::bigint; return; end if;
  return query select 'ok'::text, r.profile_id, r.telegram_user_id;
end $$;

revoke execute on function public.telegram_web_login_create(text, text, text) from public, anon, authenticated;
revoke execute on function public.telegram_web_login_preview(text) from public, anon, authenticated;
revoke execute on function public.telegram_web_login_confirm(uuid, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.telegram_web_login_consume(uuid, text) from public, anon, authenticated;
grant execute on function public.telegram_web_login_create(text, text, text) to service_role;
grant execute on function public.telegram_web_login_preview(text) to service_role;
grant execute on function public.telegram_web_login_confirm(uuid, bigint, uuid) to service_role;
grant execute on function public.telegram_web_login_consume(uuid, text) to service_role;

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
  ('0085', 'Telegram orqali kodsiz kirish (telegram_web_logins)', to_regclass('public.telegram_web_logins') is not null)
) as m(migration, tekshiruv, bor)
order by m.migration;
