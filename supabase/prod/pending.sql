-- ISH TOPDIM · prod bazani yangilash: 0069…0077 migratsiyalari BITTA faylda (9 ta).
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

-- ═══════════════ 0069_closed_vacancy_page.sql ═══════════════
-- 0069 · Yopilgan / muddati o'tgan / to'xtatilgan vakansiya sahifasi (2026-10-31 auditi, §3.8)
--
-- Muammo: vakansiya yopilgach (yoki soatlik cron muddati o'tganini yopgach) RLS uni mehmondan yashiradi va /jobs/[slug]
-- 404 qaytaradi — Telegram'da ulashilgan havolalar "sahifa topilmadi" bo'lib qoladi, qidiruv tizimlari ham xato oladi.
--
-- Yechim: faqat AVVAL OMMAVIY bo'lgan (published_at bor) va hozir yopilgan/muddati o'tgan/to'xtatilgan vakansiyaning
-- ommaviy "ko'rinishi" — nom, kompaniya (nomi, sahifasi, tasdiq belgisi), hudud, soha, holat. Tavsif, maosh, aloqa,
-- manzil, egasi QAYTARILMAYDI. Sahifa "Bu vakansiya yopilgan" + o'xshash faol ishlar ko'rsatadi (noindex).
-- Qoralama, moderatsiyadagi, rad etilgan va admin yashirgan ("hidden") vakansiyalar — hech qachon (null).

create or replace function public.vacancy_public_stub(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug', v.slug,
    'title', v.title,
    'status', case when v.status = 'active' then 'expired' else v.status::text end,
    'category_id', v.category_id,
    'region_id', v.region_id,
    'district_id', v.district_id,
    'is_remote', v.is_remote,
    'published_at', v.published_at,
    'company', case when c.id is null then null else jsonb_build_object(
      'name', c.name, 'slug', c.slug, 'verified', c.verification_status = 'verified') end)
  from public.vacancies v
  left join public.companies c on c.id = v.company_id
  where v.slug = p_slug
    and v.published_at is not null
    and (v.status in ('closed', 'expired', 'paused')
         or (v.status = 'active' and v.expires_at is not null and v.expires_at <= now()))
  limit 1
$$;

revoke all on function public.vacancy_public_stub(text) from public;
grant execute on function public.vacancy_public_stub(text) to anon, authenticated;

comment on function public.vacancy_public_stub(text) is
  'Yopilgan/muddati o''tgan/to''xtatilgan (avval ommaviy) vakansiyaning ommaviy ko''rinishi: nom, kompaniya, hudud, soha, holat. Maxfiy maydonlar yo''q.';

-- ═══════════════ 0070_search_salary_max_education.sql ═══════════════
-- 0070 · Ish qidiruvi: maksimal maosh va ma'lumoti filtrlari (2026-10-31 auditi, §3.7)
--
-- search_vacancies_v3 = search_vacancies_v2 (0065 + 0068 tuzatishlari bilan, aynan bir xil tana) + 2 ta filtr:
--   * p_salary_max — maosh shu summadan oshmaydigan e'lonlar (oylik ekvivalentda: kunlik ×22, soatlik ×176 — p_salary_min
--     bilan bir xil qoida). Taqqoslanadi e'londagi eng kam summa (salary_from, bo'lmasa salary_to). "Kelishiladi" — o'tadi
--     (min filtri bilan bir xil: summa noma'lum).
--   * p_education — "mening ma'lumotim": e'lon talab qiladigan eng kam ma'lumot shu darajadan yuqori bo'lmasin; talab
--     ko'rsatilmagan e'lonlar o'tadi (education_rank — 0001).
-- v2 o'zgarmaydi (eski mijozlar ishlayveradi); ilova yangi filtrlar tanlanganda v3 ni chaqiradi, v3 yo'q bazada — v2 ga qaytadi.
-- Tana qo'lda nusxalanmaydi: joriy v2 ta'rifi olinib, nomi va 2 ta joyi almashtiriladi (0068 dagi patch_fn uslubi) —
-- kelajakda v2 ga kiritilgan tuzatishlar v3 ni qayta yaratishda yo'qolmaydi.

do $$
declare
  def text;
  n int;
  o text;
begin
  def := pg_get_functiondef('public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)'::regprocedure);

  -- 1) nom
  o := 'FUNCTION public.search_vacancies_v2(';
  n := (length(def) - length(replace(def, o, ''))) / length(o);
  if n <> 1 then raise exception '0070: funksiya nomi % marta uchradi', n; end if;
  def := replace(def, o, 'FUNCTION public.search_vacancies_v3(');

  -- 2) yangi parametrlar — oxirgisidan keyin (standart qiymat bilan: eski chaqiruvlar ham ishlaydi)
  o := 'p_offset integer DEFAULT 0)';
  n := (length(def) - length(replace(def, o, ''))) / length(o);
  if n <> 1 then raise exception '0070: p_offset % marta uchradi', n; end if;
  def := replace(def, o, 'p_offset integer DEFAULT 0, p_salary_max integer DEFAULT NULL::integer, p_education public.education_level DEFAULT NULL::public.education_level)');

  -- 3) filtrlar — min maosh shartidan keyin (base CTE)
  o := 'and (p_salary_min is null or v.salary_negotiable or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) >= p_salary_min)';
  n := (length(def) - length(replace(def, o, ''))) / length(o);
  if n <> 1 then raise exception '0070: min maosh sharti % marta uchradi', n; end if;
  def := replace(def, o, o || '
      and (p_salary_max is null or v.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(v.salary_from, v.salary_to), v.salary_type) <= p_salary_max)
      and (p_education is null or v.education_min is null
           or public.education_rank(v.education_min) <= public.education_rank(p_education))');

  execute def;
end $$;

grant execute on function public.search_vacancies_v3(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int, int, public.education_level) to anon, authenticated;

-- ═══════════════ 0071_companies_directory.sql ═══════════════
-- 0071 · "Kompaniyalar" katalogi (/companies) — 2026-10-31 auditi, §6 (sarlavha menyusi: Ish qidirish · Kompaniyalar · Kasblar ·
-- Ish beruvchilar uchun).
--
-- Hozir xodim qidirayotgan kompaniyalar: kamida bitta faol, muddati o'tmagan vakansiyasi bor, bloklanmagan. Tartib: tasdiqlangan
-- avval, keyin faol vakansiyalar soni, keyin nom. Qidiruv — nom bo'yicha (katta-kichik harf farqsiz). Hudud — kompaniya hududi.
-- security invoker: mehmon RLS bo'yicha faqat ommaviy ma'lumotni ko'radi (STIR, telefon qaytarilmaydi). Soxta yoki bo'sh
-- kompaniyalar ko'rsatilmaydi — sonlar haqiqiy.

create or replace function public.public_companies(
  p_query text default null,
  p_region_id uuid default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid, slug text, name text, logo_url text, verified boolean, is_government boolean,
  industry_category_id uuid, region_id uuid, about text, active_jobs bigint, total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with jobs as (
    select v.company_id, count(*) as n
    from public.vacancies v
    where v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.company_id is not null
    group by v.company_id
  )
  select c.id, c.slug, c.name, c.logo_url, c.verification_status = 'verified', c.is_government,
         c.industry_category_id, c.region_id, left(c.about, 220), j.n, count(*) over ()
  from public.companies c
  join jobs j on j.company_id = c.id
  where not c.is_blocked
    and (p_region_id is null or c.region_id = p_region_id)
    and (coalesce(btrim(p_query), '') = '' or c.name ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%')
  order by (c.verification_status = 'verified') desc, j.n desc, c.name
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.public_companies(text, uuid, int, int) from public;
grant execute on function public.public_companies(text, uuid, int, int) to anon, authenticated;

-- ═══════════════ 0072_duplicates_featured_audit.sql ═══════════════
-- 0072 · Ishonch va admin (2026-10-31 auditi, §5):
--   1) Takroriy vakansiya: bir ish beruvchi (yoki bitta kompaniya) bir xil nom + bir xil joy + bir xil to'lov davri (kunlik /
--      oylik / soatlik — boshqa davr boshqa taklif) bilan ikkinchi e'lonni
--      CHIQARA OLMAYDI, birinchisi faol / ko'rib chiqilmoqda / to'xtatilgan va muddati o'tmagan bo'lsa. Bir nechta odam kerak
--      bo'lsa — mavjud e'londagi "o'rinlar soni" (positions_count). Xato: duplicate_vacancy (ilova tushuntiradi va mavjud
--      e'longa havola beradi). Qoralama saqlash cheklanmaydi — faqat chiqarish (ommaga yoki moderatsiyaga yuborish).
--      Faqat ish beruvchining o'z amali tekshiriladi; admin tasdig'i va cron — yo'q (admin istisno qila oladi).
--   2) TOP vakansiya (admin): `is_featured` / `featured_until` ustunlari bor edi (qidiruv ularni birinchi qo'yadi — 0008), lekin
--      hech kim yoqa olmasdi. admin_set_vacancy_featured — 7/14/30 kun yoki olib tashlash; faqat faol vakansiya; audit bilan.
--      Pullik "TOP" mahsuloti — to'lov ulanganda (bu funksiya o'shanda ham ishlatiladi).
--   3) Admin audit: admin_log prefikslari — avval noma'lum prefiks "admins.manage" talab qilardi va oddiy admin uchun
--      "profession.update_meta" va o'z kirish ma'lumotini o'rnatish ("admin.login_credentials_set") audit qilinmasdi (xato).
--      Yangi: profession, media, verification (hujjat ko'rish), analytics (CSV eksport); o'z hisobi — har qanday faol admin.

-- ---------------------------------------------------------------------------------------------------
-- 1. Takroriy vakansiya
-- ---------------------------------------------------------------------------------------------------
create or replace function public.vacancy_title_key(p_title text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(lower(coalesce(p_title, '')), '[^[:alnum:]]+', ' ', 'g'))
$$;

create or replace function public.find_duplicate_vacancy(p_id uuid, p_owner uuid, p_company uuid, p_title text, p_region uuid, p_district uuid, p_remote boolean, p_salary_type public.salary_type)
returns text language sql stable security definer set search_path = public as $$
  select o.slug
  from public.vacancies o
  where o.id is distinct from p_id
    and (o.owner_profile_id = p_owner or (p_company is not null and o.company_id = p_company))
    and o.status in ('active', 'pending_review', 'paused')
    and (o.expires_at is null or o.expires_at > now())
    and public.vacancy_title_key(o.title) = public.vacancy_title_key(p_title)
    and o.salary_type is not distinct from p_salary_type
    and o.is_remote = coalesce(p_remote, false)
    and (coalesce(p_remote, false) or (o.region_id is not distinct from p_region and o.district_id is not distinct from p_district))
  order by o.published_at desc nulls last
  limit 1
$$;
-- faqat trigger va my_duplicate_vacancy ichida (Supabase standart huquqlari anon/authenticated ga ham beradi — aniq olinadi)
revoke all on function public.find_duplicate_vacancy(uuid, uuid, uuid, text, uuid, uuid, boolean, public.salary_type) from public, anon, authenticated;

create or replace function public.trg_vacancy_b_duplicate()
returns trigger language plpgsql security definer set search_path = public as $$
declare dup text;
begin
  if new.status not in ('active', 'pending_review') then return new; end if;
  -- faqat chiqarish paytida: yangi yozuv yoki qoralama/yopilgan/rad etilgan → faol/moderatsiya
  if tg_op = 'UPDATE' and old.status in ('active', 'pending_review', 'paused') then return new; end if;
  -- faqat ish beruvchining o'z amali (publish_vacancy, save_simple_vacancy — ular ichki bayroq bilan yozadi, shuning uchun
  -- moderation_internal emas, aktyor tekshiriladi). Admin tasdig'i va cron (auth.uid() boshqa yoki yo'q) — tekshirilmaydi
  if auth.uid() is null or not (new.owner_profile_id = auth.uid() or public.manages_vacancy(new.id)) then return new; end if;
  dup := public.find_duplicate_vacancy(new.id, new.owner_profile_id, new.company_id, new.title, new.region_id, new.district_id, new.is_remote, new.salary_type);
  if dup is not null then
    raise exception 'duplicate_vacancy' using errcode = 'P0001', detail = dup,
      hint = 'Sizda shu nom va joy bilan faol e''lon bor — uni tahrirlang yoki "o''rinlar soni"ni oshiring';
  end if;
  return new;
end $$;
drop trigger if exists trg_vacancy_b_duplicate on public.vacancies;
create trigger trg_vacancy_b_duplicate before insert or update of status on public.vacancies
  for each row execute function public.trg_vacancy_b_duplicate();

-- Ilova oldindan tekshirishi uchun (forma "Chiqarish" tugmasidan oldin ogohlantiradi): faqat o'z vakansiyasi
create or replace function public.my_duplicate_vacancy(p_vacancy_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v public.vacancies;
begin
  select * into v from public.vacancies where id = p_vacancy_id;
  if v.id is null or not public.can_edit_vacancy(v.id) then return null; end if;
  return public.find_duplicate_vacancy(v.id, v.owner_profile_id, v.company_id, v.title, v.region_id, v.district_id, v.is_remote, v.salary_type);
end $$;
revoke all on function public.my_duplicate_vacancy(uuid) from public, anon;
grant execute on function public.my_duplicate_vacancy(uuid) to authenticated;

create index if not exists idx_vacancies_owner_live on public.vacancies (owner_profile_id) where status in ('active', 'pending_review', 'paused');

-- ---------------------------------------------------------------------------------------------------
-- 2. TOP vakansiya (admin)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.admin_set_vacancy_featured(p_vacancy_id uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
declare before_row jsonb; st public.vacancy_status;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days is null or p_days not in (0, 7, 14, 30) then raise exception 'invalid_days' using errcode = '22023'; end if;
  select status, jsonb_build_object('is_featured', is_featured, 'featured_until', featured_until)
    into st, before_row from public.vacancies where id = p_vacancy_id;
  if st is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_days > 0 and st <> 'active' then raise exception 'vacancy_not_active' using errcode = '23514'; end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.vacancies
     set is_featured = p_days > 0,
         featured_until = case when p_days > 0 then now() + make_interval(days => p_days) end
   where id = p_vacancy_id;
  perform set_config('ishuz.moderation_internal', '', true);
  perform public.write_audit(case when p_days > 0 then 'vacancy.featured' else 'vacancy.unfeatured' end, 'vacancy', p_vacancy_id::text,
    before_row, jsonb_build_object('days', p_days));
end $$;
revoke all on function public.admin_set_vacancy_featured(uuid, int) from public, anon;
grant execute on function public.admin_set_vacancy_featured(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 3. Admin audit: prefiks → ruxsat
-- ---------------------------------------------------------------------------------------------------
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text default null, p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  prefix text;
  perm text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]+\.[a-z_]+$' then raise exception 'invalid_action' using errcode = '23514'; end if;
  prefix := split_part(p_action, '.', 1);
  perm := case
    -- o'z kirish ma'lumotini o'rnatish (/admin/account bu yozuvdan "parol o'rnatilgan" belgisini o'qiydi)
    when p_action = 'admin.login_credentials_set' then null
    else case prefix
    when 'category' then 'categories.manage'
    when 'subcategory' then 'categories.manage'
    when 'profession' then 'categories.manage'
    when 'skill' then 'skills.manage'
    when 'region' then 'regions.manage'
    when 'district' then 'regions.manage'
    when 'settings' then 'settings.manage'
    when 'media' then 'settings.manage'
    when 'verification' then 'employers.verify'
    when 'analytics' then 'analytics.view'
    when 'admin' then 'admins.manage'
    else 'admins.manage'
  end end;
  if perm is not null and not public.has_admin_permission(perm) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.write_audit(p_action, p_target_type, p_target_id, p_before, p_after);
end $$;

-- ═══════════════ 0073_profile_interests.sql ═══════════════
-- 0073 · "Mening dunyom" (2026-11): foydalanuvchi qiziqqan sohalar.
--   Kirgan odam "Dunyongizni yarating" oqimida qaysi sohalar qiziqtirishini tanlaydi (1–8 ta). Bosh sahifa shularga moslashadi:
--   har soha bo'yicha yangi ishlar, kunlik reja. Kasblar — mavjud worker_professions (CV) da; bu jadval — ish qidiruvchi profili
--   bo'lmasa ham ishlaydigan, faqat egasi ko'radigan qiziqishlar ro'yxati.
--   Ilova jadval yo'q bazada ham ishlaydi (oqim "keyinroq" deb ko'rsatiladi) — migratsiya ilovadan oldin qo'llanadi.

create table if not exists public.profile_interests (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, category_id)
);

alter table public.profile_interests enable row level security;

drop policy if exists profile_interests_own_select on public.profile_interests;
create policy profile_interests_own_select on public.profile_interests for select to authenticated using (profile_id = auth.uid());

-- yozish faqat set_my_interests orqali (limit va to'liq almashtirish bir tranzaksiyada)
revoke all on public.profile_interests from public, anon, authenticated;
grant select on public.profile_interests to authenticated;

create or replace function public.set_my_interests(p_category_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  ids uuid[];
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct c.id), '{}') into ids
    from public.categories c where c.id = any(coalesce(p_category_ids, '{}'));
  if cardinality(ids) < 1 or cardinality(ids) > 8 then raise exception 'invalid_interests' using errcode = '22023'; end if;
  delete from public.profile_interests where profile_id = me and category_id <> all(ids);
  insert into public.profile_interests (profile_id, category_id)
    select me, unnest(ids) on conflict do nothing;
  return cardinality(ids);
end $$;
revoke all on function public.set_my_interests(uuid[]) from public, anon;
grant execute on function public.set_my_interests(uuid[]) to authenticated;

-- ═══════════════ 0074_contact_privacy.sql ═══════════════
-- 0074 · Aloqa maxfiyligi (2026-11, audit: anonim telefon yig'ish va admin rollari telefon ko'rishi).
--
--   1. Qidiruv ro'yxatlari (simple_search_vacancies v1/v2/v3, simple_search_workers v1/v2) endi telefon qaytarmaydi.
--      Avval anonim so'rov bir chaqiruvda 50 tagacha raqam olardi (offset 4950 gacha, cheklovsiz) — ommaviy yig'ish yo'li.
--      Funksiya imzolari va qaytaradigan ustunlar o'zgarmaydi: `phone` ustuni bor, lekin har doim null.
--   2. Raqam faqat bitta e'lon sahifasida ochiladi (simple_vacancy_phone, simple_worker_listing) va faqat:
--      kirgan, faol foydalanuvchiga · avvalgi ko'rinish qoidalari bajarilganda · soatiga 40 / sutkasiga 150 ta turli
--      e'lon limiti ichida (contact_reveals jurnali). Egasi va `users.contacts` huquqli admin limitga kirmaydi.
--      Bir e'lonning raqamini 24 soat ichida qayta ko'rish limitni sarflamaydi.
--   3. telegram_accounts.phone / phone_shared_at ustunlari foydalanuvchi sessiyasidan (anon, authenticated) o'qilmaydi.
--      Avval `telegram_own` siyosati har qanday admin rolga (support, analyst ham) raqamni ochardi. Ilova bu ustunlarni
--      faqat server kaliti (service role) bilan o'qiydi, shuning uchun hech narsa buzilmaydi.
--      DIQQAT: jadvalga yangi ustun qo'shilsa, uni pastdagi grant ro'yxatiga ham qo'shing.
--
--   Qaytarish (rollback): supabase/rollbacks/0074_contact_privacy.down.sql

-- ---------------------------------------------------------------- 2a. reveal jurnali va limit
create table if not exists public.contact_reveals (
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_kind       text not null check (target_kind in ('vacancy', 'worker')),
  target_id         uuid not null,
  revealed_at       timestamptz not null default now(),
  primary key (viewer_profile_id, target_kind, target_id)
);
create index if not exists idx_contact_reveals_viewer_time on public.contact_reveals (viewer_profile_id, revealed_at desc);
alter table public.contact_reveals enable row level security;
-- siyosat yo'q: jadvalga faqat security definer funksiyalar yozadi/o'qiydi
revoke all on public.contact_reveals from public, anon, authenticated;

create or replace function public.contact_reveal_allowed(p_kind text, p_target uuid, p_owner uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  last_at timestamptz;
  per_hour int;
  per_day int;
begin
  if viewer is null then return false; end if;
  if not public.is_active_user() then return false; end if;
  if viewer = p_owner or public.has_admin_permission('users.contacts') then return true; end if;

  select revealed_at into last_at from public.contact_reveals
   where viewer_profile_id = viewer and target_kind = p_kind and target_id = p_target;
  if last_at is not null and last_at > now() - interval '24 hours' then return true; end if;

  select count(*) filter (where revealed_at > now() - interval '1 hour'), count(*)
    into per_hour, per_day
    from public.contact_reveals
   where viewer_profile_id = viewer and revealed_at > now() - interval '24 hours';
  if per_hour >= 40 or per_day >= 150 then return false; end if;

  insert into public.contact_reveals (viewer_profile_id, target_kind, target_id, revealed_at)
  values (viewer, p_kind, p_target, now())
  on conflict (viewer_profile_id, target_kind, target_id) do update set revealed_at = excluded.revealed_at;
  return true;
end $$;
revoke execute on function public.contact_reveal_allowed(text, uuid, uuid) from public, anon, authenticated;

-- eski yozuvlar (30 kundan eski) — limit faqat 24 soatga qaraydi
create or replace function public.purge_contact_reveals() returns int
language sql volatile security definer set search_path = public as $$
  with d as (delete from public.contact_reveals where revealed_at < now() - interval '30 days' returning 1) select count(*)::int from d;
$$;
revoke execute on function public.purge_contact_reveals() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ishuz-contact-reveals-purge';
    perform cron.schedule('ishuz-contact-reveals-purge', '17 22 * * *', 'select public.purge_contact_reveals()');
  end if;
end $$;

-- ---------------------------------------------------------------- 2b. vakansiya sahifasidagi raqam
create or replace function public.simple_vacancy_phone(p_vacancy_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_owner uuid;
  v_phone text;
begin
  select v.owner_profile_id,
    case
      when vc.vacancy_id is not null then case when vc.show_phone then vc.phone end
      else coalesce(co.phone, ep.contact_phone)
    end
  into v_owner, v_phone
  from public.vacancies v
  left join public.vacancy_contacts vc on vc.vacancy_id = v.id
  left join public.companies co on co.id = v.company_id
  left join public.employer_profiles ep on ep.profile_id = v.owner_profile_id
  where v.id = p_vacancy_id and v.status = 'active';

  if v_phone is null then return null; end if;
  if not public.contact_reveal_allowed('vacancy', p_vacancy_id, v_owner) then return null; end if;
  return v_phone;
end $$;
revoke execute on function public.simple_vacancy_phone(uuid) from public;
grant execute on function public.simple_vacancy_phone(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- 2c. ishchi e'loni sahifasi
CREATE OR REPLACE FUNCTION public.simple_worker_listing(p_id uuid)
 RETURNS TABLE(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, remote_ok boolean, experience_level experience_level, salary_expected integer, schedules work_schedule[], phone text, is_owner boolean, is_listed boolean, last_active_at timestamp with time zone)
 LANGUAGE sql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, w.headline,
    w.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon), w.about,
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    w.remote_preference = 'yes', w.experience_level, pr.salary_expected, coalesce(pr.schedules, '{}'),
    case when pc.phone is not null
      and (pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id))
      and public.contact_reveal_allowed('worker', w.id, w.profile_id)
    then pc.phone end,
    w.profile_id = auth.uid(),
    (w.is_public and w.status <> 'not_looking'),
    w.last_active_at
  from public.worker_profiles w
  join public.profiles pf on pf.id = w.profile_id
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_preferences pr on pr.worker_id = w.id
  left join public.profession_nodes pn on pn.id = w.profession_node_id
  left join public.categories cat on cat.id = w.category_id
  left join public.regions rg on rg.id = w.region_id
  left join public.districts d on d.id = w.district_id
  where w.id = p_id
    and w.onboarding_completed_at is not null
    and (w.profile_id = auth.uid() or (w.is_public and not pf.is_blocked and w.status <> 'not_looking'));
$function$;

-- ---------------------------------------------------------------- 1. qidiruv ro'yxatlari: telefon yo'q
CREATE OR REPLACE FUNCTION public.simple_search_vacancies(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_salary_min integer DEFAULT NULL::integer, p_schedule work_schedule DEFAULT NULL::work_schedule, p_no_experience boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, is_remote boolean, salary_from integer, salary_to integer, salary_type salary_type, salary_negotiable boolean, schedule work_schedule, work_time_from time without time zone, work_time_to time without time zone, experience_min_months integer, summary text, phone text, published_at timestamp with time zone, is_featured boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with matched as (
    -- kasb tanlanmagan: barcha faol (ids is null — bir martalik shart, tarmoq kerak bo'lmasa o'tkazib yuboriladi)
    select v.* from public.vacancies v
    where ids is null and v.status = 'active' and (v.expires_at is null or v.expires_at > now())
    union all
    -- kasb va uning ichidagi kasblar: idx_vacancies_node
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id = any(ids)
    union all
    -- eski e'lonlar (kasb tuguni yo'q): nomi aynan shu kasb nomini o'z ichiga olsa
    select v.* from public.vacancies v
    where ids is not null and node.id is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id is null
      and (lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')
  ),
  base as (
    select m.id as vid, m.published_at as pub,
      (m.is_featured and (m.featured_until is null or m.featured_until > now())) as featured_now,
      (p_district_id is not null and m.district_id is null) as wide
    from matched m
    where (case when p_remote then m.is_remote
                else (p_region_id is null or m.region_id = p_region_id)
                     and (p_district_id is null or m.district_id = p_district_id or m.district_id is null) end)
      and (p_salary_min is null or m.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(m.salary_to, m.salary_from), m.salary_type) >= p_salary_min)
      and (p_schedule is null or m.schedule = p_schedule)
      and (not p_no_experience or m.experience_min_months = 0)
    order by featured_now desc, wide asc, m.published_at desc nulls last, m.id
    limit 5000
  ),
  page as (
    select b.*, count(*) over () as total from base b
    order by b.featured_now desc, b.wide asc, b.pub desc nulls last, b.vid
    limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950))
  )
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    pg.wide, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi (ommaviy yig'ishga qarshi); raqam faqat vakansiya sahifasida, kirgan va limit ichida
    c.published_at, pg.featured_now, pg.total
  from page pg
  join public.vacancies c on c.id = pg.vid
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  order by pg.featured_now desc, pg.wide asc, pg.pub desc nulls last, pg.vid;
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_vacancies_v2(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_salary_min integer DEFAULT NULL::integer, p_schedule work_schedule DEFAULT NULL::work_schedule, p_no_experience boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_salary_type salary_type DEFAULT NULL::salary_type)
 RETURNS TABLE(id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, is_remote boolean, salary_from integer, salary_to integer, salary_type salary_type, salary_negotiable boolean, schedule work_schedule, work_time_from time without time zone, work_time_to time without time zone, experience_min_months integer, summary text, phone text, published_at timestamp with time zone, is_featured boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with matched as (
    select v.* from public.vacancies v
    where ids is null and v.status = 'active' and (v.expires_at is null or v.expires_at > now())
    union all
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id = any(ids)
    union all
    select v.* from public.vacancies v
    where ids is not null and node.id is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id is null
      and (lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')
  ),
  base as (
    select m.id as vid, m.published_at as pub,
      (m.is_featured and (m.featured_until is null or m.featured_until > now())) as featured_now,
      (p_district_id is not null and m.district_id is null) as wide
    from matched m
    where (case when p_remote then m.is_remote
                else (p_region_id is null or m.region_id = p_region_id)
                     and (p_district_id is null or m.district_id = p_district_id or m.district_id is null) end)
      and (p_salary_min is null or m.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(m.salary_to, m.salary_from), m.salary_type) >= p_salary_min)
      and (p_schedule is null or m.schedule = p_schedule)
      and (not p_no_experience or m.experience_min_months = 0)
      and (p_salary_type is null or m.salary_type = p_salary_type)
    order by featured_now desc, wide asc, m.published_at desc nulls last, m.id
    limit 5000
  ),
  page as (
    select b.*, count(*) over () as total from base b
    order by b.featured_now desc, b.wide asc, b.pub desc nulls last, b.vid
    limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950))
  )
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    pg.wide, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi (ommaviy yig'ishga qarshi); raqam faqat vakansiya sahifasida, kirgan va limit ichida
    c.published_at, pg.featured_now, pg.total
  from page pg
  join public.vacancies c on c.id = pg.vid
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  order by pg.featured_now desc, pg.wide asc, pg.pub desc nulls last, pg.vid;
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_vacancies_v3(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_salary_min integer DEFAULT NULL::integer, p_schedule work_schedule DEFAULT NULL::work_schedule, p_no_experience boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_salary_type salary_type DEFAULT NULL::salary_type, p_employer_type employer_type DEFAULT NULL::employer_type, p_featured boolean DEFAULT false, p_mass boolean DEFAULT false)
 RETURNS TABLE(id uuid, slug text, title text, employer_name text, employer_verified boolean, is_government boolean, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, is_remote boolean, salary_from integer, salary_to integer, salary_type salary_type, salary_negotiable boolean, schedule work_schedule, work_time_from time without time zone, work_time_to time without time zone, experience_min_months integer, summary text, phone text, published_at timestamp with time zone, is_featured boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with matched as (
    select v.* from public.vacancies v
    where ids is null and v.status = 'active' and (v.expires_at is null or v.expires_at > now())
    union all
    select v.* from public.vacancies v
    where ids is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id = any(ids)
    union all
    select v.* from public.vacancies v
    where ids is not null and node.id is not null and v.status = 'active' and (v.expires_at is null or v.expires_at > now()) and v.profession_node_id is null
      and (lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')
  ),
  base as (
    select m.id as vid, m.published_at as pub,
      (m.is_featured and (m.featured_until is null or m.featured_until > now())) as featured_now,
      (p_district_id is not null and m.district_id is null) as wide
    from matched m
    left join public.employer_profiles kp on kp.profile_id = m.owner_profile_id
    where (case when p_remote then m.is_remote
                else (p_region_id is null or m.region_id = p_region_id)
                     and (p_district_id is null or m.district_id = p_district_id or m.district_id is null) end)
      and (p_salary_min is null or m.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(m.salary_to, m.salary_from), m.salary_type) >= p_salary_min)
      and (p_schedule is null or m.schedule = p_schedule)
      and (not p_no_experience or m.experience_min_months = 0)
      and (p_salary_type is null or m.salary_type = p_salary_type)
      and (p_employer_type is null or public.vacancy_employer_kind(m.is_government, kp.employer_type, m.company_id) = p_employer_type)
      and (not p_featured or (m.is_featured and (m.featured_until is null or m.featured_until > now())))
      and (not p_mass or m.positions_count >= 5)
    order by featured_now desc, wide asc, m.published_at desc nulls last, m.id
    limit 5000
  ),
  page as (
    select b.*, count(*) over () as total from base b
    order by b.featured_now desc, b.wide asc, b.pub desc nulls last, b.vid
    limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950))
  )
  select c.id, c.slug, c.title,
    coalesce(co.name, ep.display_name, nullif(btrim(pf.first_name), '')),
    coalesce(co.verification_status = 'verified', false), c.is_government,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    pg.wide, c.is_remote,
    c.salary_from, c.salary_to, c.salary_type, c.salary_negotiable,
    c.schedule, c.work_time_from, c.work_time_to, c.experience_min_months,
    left(regexp_replace(coalesce(c.description, ''), '\s+', ' ', 'g'), 220),
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi (ommaviy yig'ishga qarshi); raqam faqat vakansiya sahifasida, kirgan va limit ichida
    c.published_at, pg.featured_now, pg.total
  from page pg
  join public.vacancies c on c.id = pg.vid
  left join public.companies co on co.id = c.company_id
  left join public.employer_profiles ep on ep.profile_id = c.owner_profile_id
  left join public.profiles pf on pf.id = c.owner_profile_id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  left join public.vacancy_contacts vc on vc.vacancy_id = c.id
  order by pg.featured_now desc, pg.wide asc, pg.pub desc nulls last, pg.vid;
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_workers(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_experienced boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, remote_ok boolean, experience_level experience_level, salary_expected integer, phone text, last_active_at timestamp with time zone, is_promoted boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with base as (
    select w.*,
      (w.promoted_until is not null and w.promoted_until > now()) as promoted_now,
      (p_district_id is not null and w.district_id is null) as wide
    from public.worker_profiles w
    join public.profiles pf on pf.id = w.profile_id
    where w.is_public and w.onboarding_completed_at is not null and not pf.is_blocked and w.status <> 'not_looking'
      and (ids is null or w.profession_node_id = any(ids)
           or (w.profession_node_id is null and node.id is not null
               and (lower(coalesce(w.headline, '')) like '%' || lower(node.name_uz) || '%' or lower(coalesce(w.headline, '')) like '%' || lower(node.name_ru) || '%')))
      and (case when p_remote then w.remote_preference = 'yes'
                else (p_region_id is null or w.region_id = p_region_id)
                     and (p_district_id is null or w.district_id = p_district_id or w.district_id is null
                          or exists (select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = p_district_id)) end)
      and (not p_experienced or w.experience_level not in ('none', 'lt_6m'))
    order by promoted_now desc, wide asc, w.last_active_at desc nulls last
    limit 5000
  ),
  counted as (select b.*, count(*) over () as total from base b)
  select c.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, c.headline,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    left(regexp_replace(coalesce(c.about, ''), '\s+', ' ', 'g'), 220),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    c.wide, c.remote_preference = 'yes', c.experience_level, pr.salary_expected,
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi; raqam faqat e'lon sahifasida, kirgan va limit ichida
    c.last_active_at, c.promoted_now, c.total
  from counted c
  join public.profiles pf on pf.id = c.profile_id
  left join public.profile_contacts pc on pc.profile_id = c.profile_id
  left join public.worker_preferences pr on pr.worker_id = c.id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  order by c.promoted_now desc, c.wide asc, c.last_active_at desc nulls last
  limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950));
end $function$;

CREATE OR REPLACE FUNCTION public.simple_search_workers_v2(p_profession_node_id uuid DEFAULT NULL::uuid, p_region_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_remote boolean DEFAULT false, p_experienced boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_daily boolean DEFAULT false)
 RETURNS TABLE(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, region_wide boolean, remote_ok boolean, experience_level experience_level, salary_expected integer, phone text, last_active_at timestamp with time zone, is_promoted boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ids uuid[] := public.profession_subtree(p_profession_node_id);
  node public.profession_nodes;
begin
  if p_profession_node_id is not null then select * into node from public.profession_nodes n where n.id = p_profession_node_id; end if;
  return query
  with base as (
    select w.*,
      (w.promoted_until is not null and w.promoted_until > now()) as promoted_now,
      (p_district_id is not null and w.district_id is null) as wide
    from public.worker_profiles w
    join public.profiles pf on pf.id = w.profile_id
    where w.is_public and w.onboarding_completed_at is not null and not pf.is_blocked and w.status <> 'not_looking'
      and (ids is null or w.profession_node_id = any(ids)
           or (w.profession_node_id is null and node.id is not null
               and (lower(coalesce(w.headline, '')) like '%' || lower(node.name_uz) || '%' or lower(coalesce(w.headline, '')) like '%' || lower(node.name_ru) || '%')))
      and (case when p_remote then w.remote_preference = 'yes'
                else (p_region_id is null or w.region_id = p_region_id)
                     and (p_district_id is null or w.district_id = p_district_id or w.district_id is null
                          or exists (select 1 from public.worker_locations wl where wl.worker_id = w.id and wl.district_id = p_district_id)) end)
      and (not p_experienced or w.experience_level not in ('none', 'lt_6m'))
      and (not p_daily or exists (select 1 from public.worker_preferences dp where dp.worker_id = w.id
                                  and (dp.salary_type = 'daily' or dp.availability in ('today', 'tomorrow'))))
    order by promoted_now desc, wide asc, w.last_active_at desc nulls last
    limit 5000
  ),
  counted as (select b.*, count(*) over () as total from base b)
  select c.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, c.headline,
    c.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon),
    left(regexp_replace(coalesce(c.about, ''), '\s+', ' ', 'g'), 220),
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    c.wide, c.remote_preference = 'yes', c.experience_level, pr.salary_expected,
    null::text, -- 0074: ro'yxatda telefon qaytarilmaydi; raqam faqat e'lon sahifasida, kirgan va limit ichida
    c.last_active_at, c.promoted_now, c.total
  from counted c
  join public.profiles pf on pf.id = c.profile_id
  left join public.profile_contacts pc on pc.profile_id = c.profile_id
  left join public.worker_preferences pr on pr.worker_id = c.id
  left join public.profession_nodes pn on pn.id = c.profession_node_id
  left join public.categories cat on cat.id = c.category_id
  left join public.regions rg on rg.id = c.region_id
  left join public.districts d on d.id = c.district_id
  order by c.promoted_now desc, c.wide asc, c.last_active_at desc nulls last
  limit greatest(1, least(p_limit, 50)) offset greatest(0, least(p_offset, 4950));
end $function$;

-- ---------------------------------------------------------------- 3. telegram_accounts: telefon ustunlari yopiq
revoke select on public.telegram_accounts from anon, authenticated;
grant select (telegram_user_id, profile_id, username, first_name, last_name, photo_url, language_code,
              bot_started, linked_at, last_seen_at, chat_verified_at)
  on public.telegram_accounts to authenticated;

-- ═══════════════ 0075_telegram_update_retry.sql ═══════════════
-- 0075 · Telegram webhook: xato bo'lgan update yo'qolmaydi (audit 2026-11: webhook xatoda ham 200 qaytarardi).
--
--   Avval: update_id "ko'rildi" deb belgilanadi → qayta ishlashda xato → 200 qaytariladi → Telegram qayta yubormaydi →
--   foydalanuvchi xabari jim yo'qoladi.
--   Endi: xato bo'lsa ilova `telegram_update_failed` ni chaqiradi. 3 urinishgacha belgi "qayta ishlash mumkin" holatiga
--   qaytadi va ilova 500 qaytaradi — Telegram update'ni qayta yuboradi. 3-urinishdan keyin ham xato bo'lsa — 200
--   (bitta buzuq update butun bot navbatini to'xtatib qo'ymasin), xato matni jadvalda qoladi.
--
--   Qaytarish: supabase/rollbacks/0075_telegram_update_retry.down.sql

alter table public.telegram_updates
  add column if not exists attempts   int not null default 1,
  add column if not exists failed_at  timestamptz,
  add column if not exists last_error text;

-- Birinchi marta yoki avvalgi urinish xato bilan tugagan (va urinishlar < 3) bo'lsa — true: qayta ishlash kerak
create or replace function public.telegram_update_first_seen(p_update_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.telegram_updates as t (update_id) values (p_update_id)
  on conflict (update_id) do update
    set attempts = t.attempts + 1, failed_at = null, received_at = now()
    where t.failed_at is not null and t.attempts < 3;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Qayta ishlash xato bilan tugadi. true — Telegram qayta yuborsin (ilova 500 qaytaradi), false — urinishlar tugadi.
create or replace function public.telegram_update_failed(p_update_id bigint, p_error text)
returns boolean language plpgsql security definer set search_path = public as $$
declare a int;
begin
  update public.telegram_updates
     set failed_at = now(), last_error = left(coalesce(p_error, ''), 500)
   where update_id = p_update_id
  returning attempts into a;
  return coalesce(a, 3) < 3;
end $$;

revoke execute on function public.telegram_update_first_seen(bigint) from public, anon, authenticated;
revoke execute on function public.telegram_update_failed(bigint, text) from public, anon, authenticated;
grant execute on function public.telegram_update_first_seen(bigint) to service_role;
grant execute on function public.telegram_update_failed(bigint, text) to service_role;

-- ═══════════════ 0076_masters.sql ═══════════════
-- 0076 · "Universal ustalar" — xizmat ko'rsatuvchi ustalar bozori (2026-11-12, egasi talabi).
--
-- Doimiy ish vakansiyalaridan ALOHIDA jadvallar (aralashmaydi): master_categories (12 ta xizmat turi), master_listings (usta
-- e'lonlari), master_requests (mijoz so'rovlari), master_reviews (sharhlar — bitta foydalanuvchi bitta e'longa bir marta).
--
-- Qoidalar:
--  • Yangi e'lon admin (vacancies.moderate huquqi) tasdig'idan keyin chiqadi: draft → pending_review → active | rejected.
--    Egasi faol e'lonni yashirishi/qaytarishi mumkin; mazmuni o'zgarsa — qayta moderatsiya (trigger).
--  • Telefon faqat egasi roziligi (phone_public) bilan va faqat faol e'londa ko'rsatiladi; ommaviy o'qish faqat
--    SECURITY DEFINER funksiyalar orqali (jadvalga anon kira olmaydi). Ro'yxatda ham telefon yo'q — faqat e'lon sahifasida.
--  • Reyting faqat haqiqiy sharhlardan (trigger hisoblaydi); demo e'lonlarga sharh yozib bo'lmaydi, reytingi yo'q.
--  • Demo e'lonlar (is_demo) — har kategoriyaga 4 tadan, egasiz, telefonsiz, "Demo" belgisi bilan; master_demo_remove()
--    bir buyruqda olib tashlaydi. Haqiqiy e'lonlar bilan aralashmaydi (alohida bayroq, alohida tozalash).
--  • Ko'rishlar va telefon bosishlar — hisoblagichlar (master_listing_hit) va mijoz so'rovi (master_request_create) — faqat
--    server kaliti bilan: ilova IP/foydalanuvchi limitini qo'yib chaqiradi (to'g'ridan-to'g'ri REST'dan chaqirib bo'lmaydi).
--  • anon chaqira oladigan SECURITY DEFINER funksiyalar faqat o'qish: master_listings_public, master_listing_public,
--    master_category_counts (telefonsiz / rozilik bilan) — supabase/tests/security_hardening.test.sql ro'yxatiga qo'shilgan.
--
-- Rollback: supabase/rollbacks/0076_masters.down.sql

-- ---------------------------------------------------------------------------------------------------
-- 1. Turlar va jadvallar
-- ---------------------------------------------------------------------------------------------------
-- Birinchi o'rnatishmi (jadval hali yo'q)? Faqat shunda fayl oxirida demo e'lonlar yaratiladi (pastga qarang).
select set_config('ishuz.masters_first_install', (to_regclass('public.master_listings') is null)::text, false);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'master_listing_status') then
    create type public.master_listing_status as enum ('draft', 'pending_review', 'active', 'hidden', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'master_request_status') then
    create type public.master_request_status as enum ('new', 'seen', 'done');
  end if;
end $$;

create table if not exists public.master_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]{2,40}$'),
  name_uz text not null,
  name_ru text not null,
  name_en text not null,
  name_oz text not null,
  /** lucide belgisi nomi (ilova xaritasi bo'yicha) */
  icon text not null default 'wrench',
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table if not exists public.master_listings (
  id uuid primary key default gen_random_uuid(),
  -- egasi; faqat demo e'londa bo'sh
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  category_id uuid not null references public.master_categories(id),
  slug text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 60),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  experience_years int not null default 0 check (experience_years between 0 and 60),
  -- qo'shimcha xizmatlar (chiplar), har biri qisqa
  services text[] not null default '{}' check (cardinality(services) <= 12),
  region_id uuid references public.regions(id),
  district_id uuid references public.districts(id),
  service_area text check (char_length(service_area) <= 200),
  phone text check (phone ~ '^\+998\d{9}$'),
  phone_public boolean not null default false,
  price_from int check (price_from is null or price_from between 0 and 1000000000),
  price_to int check (price_to is null or price_to between 0 and 1000000000),
  price_negotiable boolean not null default true,
  work_from time,
  work_to time,
  -- tekshirilgan rasmlar (vacancy-photos: <egasi>/v-<sha256>.webp), eng ko'pi 4 ta
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  status public.master_listing_status not null default 'draft',
  reject_reason text check (char_length(reject_reason) <= 500),
  is_demo boolean not null default false,
  views_count int not null default 0,
  phone_clicks_count int not null default 0,
  rating_avg numeric(3,2) check (rating_avg is null or (rating_avg between 1 and 5)),
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint master_listings_owner_or_demo check (is_demo or owner_profile_id is not null),
  constraint master_listings_demo_no_phone check (not is_demo or (phone is null and not phone_public)),
  constraint master_listings_price check (price_negotiable or price_from is not null or price_to is not null),
  constraint master_listings_price_order check (price_from is null or price_to is null or price_to >= price_from),
  constraint master_listings_phone_consent check (not phone_public or phone is not null)
);

create index if not exists idx_master_listings_active on public.master_listings (category_id, published_at desc) where status = 'active';
create index if not exists idx_master_listings_active_region on public.master_listings (region_id, published_at desc) where status = 'active';
create index if not exists idx_master_listings_owner on public.master_listings (owner_profile_id);
create index if not exists idx_master_listings_pending on public.master_listings (created_at) where status = 'pending_review';
create index if not exists idx_master_listings_title_trgm on public.master_listings using gin (title extensions.gin_trgm_ops);

create table if not exists public.master_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.master_listings(id) on delete cascade,
  client_profile_id uuid references public.profiles(id) on delete set null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_phone text not null check (client_phone ~ '^\+998\d{9}$'),
  message text check (char_length(message) <= 1000),
  status public.master_request_status not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists idx_master_requests_listing on public.master_requests (listing_id, created_at desc);

create table if not exists public.master_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.master_listings(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text text check (char_length(text) <= 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, author_profile_id)
);
create index if not exists idx_master_reviews_listing on public.master_reviews (listing_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------
-- 2. Kategoriyalar (12 ta) — tahrirlash: admin → ma'lumotnomalar
-- ---------------------------------------------------------------------------------------------------
insert into public.master_categories (slug, name_uz, name_ru, name_en, name_oz, icon, sort_order) values
  ('ac',        'Konditsioner ustasi',     'Мастер по кондиционерам',   'Air conditioner technician', 'Кондиционер устаси',      'snowflake',    10),
  ('plumber',   'Santexnik',               'Сантехник',                 'Plumber',                    'Сантехник',               'droplets',     20),
  ('electric',  'Elektrik',                'Электрик',                  'Electrician',                'Электрик',                'zap',          30),
  ('appliance', 'Maishiy texnika ustasi',  'Мастер по бытовой технике', 'Appliance repair',           'Маиший техника устаси',   'washing',      40),
  ('repair',    'Ta''mirlash ustasi',      'Мастер по ремонту',         'Home repair',                'Таъмирлаш устаси',        'hammer',       50),
  ('painter',   'Bo''yoqchi',              'Маляр',                     'Painter',                    'Бўёқчи',                  'paint',        60),
  ('builder',   'Quruvchi',                'Строитель',                 'Builder',                    'Қурувчи',                 'brick',        70),
  ('welder',    'Payvandchi',              'Сварщик',                   'Welder',                     'Пайвандчи',               'flame',        80),
  ('locksmith', 'Qulf ustasi',             'Мастер по замкам',          'Locksmith',                  'Қулф устаси',             'key',          90),
  ('moving',    'Yuk tashish',             'Грузоперевозки',            'Moving and transport',       'Юк ташиш',                'truck',       100),
  ('furniture', 'Mebel yig''uvchi',        'Сборщик мебели',            'Furniture assembly',         'Мебель йиғувчи',          'armchair',    110),
  ('other',     'Boshqa xizmatlar',        'Другие услуги',             'Other services',             'Бошқа хизматлар',         'grid',        120)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 3. Triggerlar: updated_at; egasining holat o'tishlari va qayta moderatsiya; reyting
-- ---------------------------------------------------------------------------------------------------
-- Rasm yo'llari: faqat egasining papkasidagi tekshirilgan (serverda qayta kodlangan) fayllar — <egasi>/v-<sha256>.webp.
-- Mijoz "v-" faylni o'zi yoza olmaydi (0058 storage siyosati), shuning uchun boshqa yo'l = tekshirilmagan fayl.
create or replace function public.master_photos_ok(p_owner uuid, p_photos text[])
returns boolean language sql immutable set search_path = public as $$
  select coalesce(bool_and(p ~ ('^' || p_owner::text || '/v-[0-9a-f]{64}\.webp$')), true) from unnest(p_photos) p;
$$;

create or replace function public.trg_master_listing_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_master_listing_touch on public.master_listings;
create trigger trg_master_listing_touch before update on public.master_listings for each row execute function public.trg_master_listing_touch();

-- Egasi (admin emas) uchun: ruxsat etilgan o'tishlar — draft→pending_review, active↔hidden, rejected→pending_review;
-- faol/yashirin/rad etilgan e'lon mazmuni o'zgarsa — pending_review (qayta moderatsiya). 'active' ni faqat admin qo'yadi.
create or replace function public.trg_master_listing_owner_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  content_changed boolean;
begin
  -- server kaliti / SECURITY DEFINER funksiya (moderatsiya, demo) yoki admin — cheklovsiz
  if not public.is_client_write() or public.has_admin_permission('vacancies.moderate') then
    if new.status = 'active' and old.status <> 'active' then new.published_at := coalesce(new.published_at, now()); end if;
    return new;
  end if;
  if new.photos <> old.photos and not public.master_photos_ok(old.owner_profile_id, new.photos) then
    raise exception 'master_listing_photo_path' using errcode = '42501';
  end if;
  if new.owner_profile_id is distinct from old.owner_profile_id or new.is_demo or new.views_count <> old.views_count
     or new.phone_clicks_count <> old.phone_clicks_count or new.rating_avg is distinct from old.rating_avg or new.rating_count <> old.rating_count
     or new.published_at is distinct from old.published_at or new.reject_reason is distinct from old.reject_reason then
    raise exception 'master_listing_readonly_fields' using errcode = '42501';
  end if;
  content_changed := new.category_id <> old.category_id or new.title <> old.title or new.description <> old.description
    or new.display_name <> old.display_name or new.experience_years <> old.experience_years or new.services <> old.services
    or new.region_id is distinct from old.region_id or new.district_id is distinct from old.district_id
    or new.service_area is distinct from old.service_area or new.phone is distinct from old.phone
    or new.price_from is distinct from old.price_from or new.price_to is distinct from old.price_to
    or new.price_negotiable <> old.price_negotiable or new.work_from is distinct from old.work_from
    or new.work_to is distinct from old.work_to or new.photos <> old.photos;
  if new.status <> old.status then
    if not ((old.status = 'draft' and new.status = 'pending_review')
         or (old.status = 'rejected' and new.status = 'pending_review')
         or (old.status = 'active' and new.status = 'hidden')
         or (old.status = 'hidden' and new.status = 'active' and not content_changed)
         or (old.status in ('pending_review', 'rejected', 'hidden') and new.status = 'draft')) then
      raise exception 'master_listing_status_transition' using errcode = '42501';
    end if;
  end if;
  if content_changed and old.status in ('active', 'hidden', 'rejected') and new.status in ('active', 'hidden', 'rejected') then
    new.status := 'pending_review';
  end if;
  -- telefon ko'rsatish roziligi o'zgarishi moderatsiya talab qilmaydi
  return new;
end $$;
drop trigger if exists trg_master_listing_owner_guard on public.master_listings;
create trigger trg_master_listing_owner_guard before update on public.master_listings for each row execute function public.trg_master_listing_owner_guard();

-- Insert: egasi faqat draft yoki pending_review bilan, demo emas, hisoblagichlar nol
create or replace function public.trg_master_listing_insert_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_client_write() or public.has_admin_permission('vacancies.moderate') then return new; end if;
  if new.is_demo or new.status not in ('draft', 'pending_review') or new.owner_profile_id is distinct from auth.uid()
     or new.views_count <> 0 or new.phone_clicks_count <> 0 or new.rating_avg is not null or new.rating_count <> 0 or new.published_at is not null then
    raise exception 'master_listing_insert_fields' using errcode = '42501';
  end if;
  if not public.master_photos_ok(new.owner_profile_id, new.photos) then
    raise exception 'master_listing_photo_path' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_master_listing_insert_guard on public.master_listings;
create trigger trg_master_listing_insert_guard before insert on public.master_listings for each row execute function public.trg_master_listing_insert_guard();

create or replace function public.trg_master_review_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lid uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.master_listings l
     set rating_avg = s.avg, rating_count = s.n
    from (select round(avg(r.rating)::numeric, 2) as avg, count(*)::int as n from public.master_reviews r where r.listing_id = lid) s
   where l.id = lid;
  return null;
end $$;
drop trigger if exists trg_master_review_rating on public.master_reviews;
create trigger trg_master_review_rating after insert or update or delete on public.master_reviews for each row execute function public.trg_master_review_rating();

-- ---------------------------------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------------------------------
alter table public.master_categories enable row level security;
alter table public.master_listings enable row level security;
alter table public.master_requests enable row level security;
alter table public.master_reviews enable row level security;

drop policy if exists master_categories_read on public.master_categories;
create policy master_categories_read on public.master_categories for select to anon, authenticated using (true);
drop policy if exists master_categories_admin on public.master_categories;
create policy master_categories_admin on public.master_categories for all to authenticated
  using ((select public.has_admin_permission('categories.manage'))) with check ((select public.has_admin_permission('categories.manage')));

-- e'lonlar: egasi o'zinikini (barcha holatlar), admin hammasini; ommaviy o'qish — faqat funksiyalar orqali (telefon himoyasi)
drop policy if exists master_listings_owner_select on public.master_listings;
create policy master_listings_owner_select on public.master_listings for select to authenticated
  using (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.view')));
drop policy if exists master_listings_owner_insert on public.master_listings;
create policy master_listings_owner_insert on public.master_listings for insert to authenticated
  with check (owner_profile_id = (select auth.uid()) and (select public.is_active_user()));
drop policy if exists master_listings_owner_update on public.master_listings;
create policy master_listings_owner_update on public.master_listings for update to authenticated
  using (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.moderate')))
  with check (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.moderate')));
drop policy if exists master_listings_owner_delete on public.master_listings;
create policy master_listings_owner_delete on public.master_listings for delete to authenticated
  using (owner_profile_id = (select auth.uid()) or (select public.has_admin_permission('vacancies.moderate')));

-- so'rovlar: e'lon egasi o'qiydi va holatini belgilaydi; admin ko'radi; yozish — faqat funksiya orqali
drop policy if exists master_requests_owner_select on public.master_requests;
create policy master_requests_owner_select on public.master_requests for select to authenticated
  using (exists (select 1 from public.master_listings l where l.id = listing_id and l.owner_profile_id = (select auth.uid()))
         or client_profile_id = (select auth.uid())
         or (select public.has_admin_permission('vacancies.view')));
drop policy if exists master_requests_owner_update on public.master_requests;
create policy master_requests_owner_update on public.master_requests for update to authenticated
  using (exists (select 1 from public.master_listings l where l.id = listing_id and l.owner_profile_id = (select auth.uid())))
  with check (exists (select 1 from public.master_listings l where l.id = listing_id and l.owner_profile_id = (select auth.uid())));

-- sharhlar: faol e'lonning sharhlari hammaga ochiq; muallif o'zinikini o'chira oladi; yozish — funksiya orqali
drop policy if exists master_reviews_read on public.master_reviews;
create policy master_reviews_read on public.master_reviews for select to anon, authenticated
  using (exists (select 1 from public.master_listings l where l.id = listing_id and l.status = 'active') or author_profile_id = (select auth.uid()));
drop policy if exists master_reviews_author_delete on public.master_reviews;
create policy master_reviews_author_delete on public.master_reviews for delete to authenticated
  using (author_profile_id = (select auth.uid()) or (select public.has_admin_permission('reviews.moderate')));

-- Supabase standart huquqlari (anon/authenticated ga hamma jadval) bekor: anon e'lonlar va so'rovlar jadvaliga umuman kirmaydi
-- (telefon ustuni), faqat funksiyalar orqali; authenticated — RLS doirasida (egasi / admin)
revoke all on public.master_listings, public.master_requests from anon;
revoke all on public.master_listings, public.master_requests, public.master_reviews, public.master_categories from authenticated;
grant select on public.master_categories to anon, authenticated;
grant select, insert, update, delete on public.master_listings to authenticated;
grant select, update on public.master_requests to authenticated;
grant select on public.master_reviews to anon, authenticated;
grant delete on public.master_reviews to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 5. Ommaviy o'qish (SECURITY DEFINER): ro'yxat (telefonsiz), bitta e'lon (telefon faqat rozilik bilan), kategoriya sonlari
-- ---------------------------------------------------------------------------------------------------
create or replace function public.master_listings_public(
  p_category uuid default null,
  p_region uuid default null,
  p_query text default null,
  p_min_experience int default null,
  p_sort text default 'new',
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid, slug text, display_name text, title text, category_id uuid, category_slug text, experience_years int, services text[],
  region_id uuid, district_id uuid, service_area text, phone_public boolean, price_from int, price_to int, price_negotiable boolean,
  work_from time, work_to time, photos text[], avatar_url text, is_demo boolean, rating_avg numeric, rating_count int,
  published_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public as $$
  select l.id, l.slug, l.display_name, l.title, l.category_id, c.slug, l.experience_years, l.services,
         l.region_id, l.district_id, l.service_area, l.phone_public, l.price_from, l.price_to, l.price_negotiable,
         l.work_from, l.work_to, l.photos, p.avatar_url, l.is_demo, l.rating_avg, l.rating_count, l.published_at, count(*) over ()
  from public.master_listings l
  join public.master_categories c on c.id = l.category_id
  left join public.profiles p on p.id = l.owner_profile_id and not p.is_blocked
  where l.status = 'active' and c.is_active
    and (l.owner_profile_id is null or exists (select 1 from public.profiles pp where pp.id = l.owner_profile_id and not pp.is_blocked))
    and (p_category is null or l.category_id = p_category)
    and (p_region is null or l.region_id = p_region)
    and (p_min_experience is null or l.experience_years >= p_min_experience)
    and (coalesce(btrim(p_query), '') = '' or l.title ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
         or l.description ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
         or c.name_uz ilike '%' || btrim(p_query) || '%' or c.name_ru ilike '%' || btrim(p_query) || '%')
  order by
    -- haqiqiy e'lonlar demo'dan avval; keyin tanlangan tartib
    l.is_demo asc,
    case when p_sort = 'rating' then coalesce(l.rating_avg, 0) end desc nulls last,
    case when p_sort = 'experience' then l.experience_years end desc nulls last,
    l.published_at desc nulls last, l.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.master_listings_public(uuid, uuid, text, int, text, int, int) from public;
grant execute on function public.master_listings_public(uuid, uuid, text, int, text, int, int) to anon, authenticated;

-- Bitta e'lon: telefon faqat egasi rozilik bergan va e'lon faol bo'lsa; tavsif to'liq
create or replace function public.master_listing_public(p_slug text)
returns table (
  id uuid, slug text, display_name text, title text, description text, category_id uuid, category_slug text, experience_years int,
  services text[], region_id uuid, district_id uuid, service_area text, phone text, phone_public boolean, price_from int, price_to int,
  price_negotiable boolean, work_from time, work_to time, photos text[], avatar_url text, is_demo boolean, rating_avg numeric,
  rating_count int, views_count int, published_at timestamptz, owner_profile_id uuid
)
language sql stable security definer set search_path = public as $$
  select l.id, l.slug, l.display_name, l.title, l.description, l.category_id, c.slug, l.experience_years, l.services,
         l.region_id, l.district_id, l.service_area, case when l.phone_public then l.phone end, l.phone_public,
         l.price_from, l.price_to, l.price_negotiable, l.work_from, l.work_to, l.photos, p.avatar_url, l.is_demo,
         l.rating_avg, l.rating_count, l.views_count, l.published_at, l.owner_profile_id
  from public.master_listings l
  join public.master_categories c on c.id = l.category_id
  left join public.profiles p on p.id = l.owner_profile_id
  where l.slug = p_slug and l.status = 'active'
    and (l.owner_profile_id is null or coalesce(not p.is_blocked, false))
  limit 1
$$;
revoke all on function public.master_listing_public(text) from public;
grant execute on function public.master_listing_public(text) to anon, authenticated;

create or replace function public.master_category_counts()
returns table (category_id uuid, active_count bigint, real_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, count(l.id), count(l.id) filter (where not l.is_demo)
  from public.master_categories c
  left join public.master_listings l on l.category_id = c.id and l.status = 'active'
  where c.is_active
  group by c.id
$$;
revoke all on function public.master_category_counts() from public;
grant execute on function public.master_category_counts() to anon, authenticated;

-- Hisoblagich: ko'rish yoki telefon bosish; demo e'londa hisoblanmaydi. FAQAT server kaliti (service_role): ilova IP + e'lon
-- bo'yicha soatiga bir marta chaqiradi — brauzerdan to'g'ridan-to'g'ri chaqirib sonni sun'iy oshirib bo'lmaydi.
create or replace function public.master_listing_hit(p_id uuid, p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.master_listings
     set views_count = views_count + (case when p_kind = 'view' then 1 else 0 end),
         phone_clicks_count = phone_clicks_count + (case when p_kind = 'phone' then 1 else 0 end)
   where id = p_id and status = 'active' and not is_demo and p_kind in ('view', 'phone')
$$;
revoke all on function public.master_listing_hit(uuid, text) from public, anon, authenticated;
grant execute on function public.master_listing_hit(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- 6. Mijoz so'rovi va sharh (yozish faqat funksiya orqali)
-- ---------------------------------------------------------------------------------------------------
-- So'rov: FAQAT server kaliti (ilova spam limitini qo'yib chaqiradi — to'g'ridan-to'g'ri REST orqali ustani so'rovlar bilan
-- to'ldirib bo'lmaydi). p_client — kirgan mijoz (bo'lsa); o'z e'loniga so'rov yuborib bo'lmaydi; demo/faol emas e'longa — yo'q.
create or replace function public.master_request_create(p_listing uuid, p_name text, p_phone text, p_message text default null, p_client uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  l public.master_listings;
begin
  select * into l from public.master_listings where id = p_listing and status = 'active' and not is_demo;
  if not found then raise exception 'master_listing_not_found' using errcode = 'P0002'; end if;
  if p_client is not null and l.owner_profile_id = p_client then raise exception 'master_request_own' using errcode = '42501'; end if;
  insert into public.master_requests (listing_id, client_profile_id, client_name, client_phone, message)
  values (p_listing, p_client, btrim(p_name), p_phone, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.master_request_create(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.master_request_create(uuid, text, text, text, uuid) to service_role;

create or replace function public.master_review_add(p_listing uuid, p_rating int, p_text text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  l public.master_listings;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'master_review_auth' using errcode = '42501'; end if;
  select * into l from public.master_listings where id = p_listing and status = 'active' and not is_demo;
  if not found then raise exception 'master_listing_not_found' using errcode = 'P0002'; end if;
  if l.owner_profile_id = auth.uid() then raise exception 'master_review_own' using errcode = '42501'; end if;
  insert into public.master_reviews (listing_id, author_profile_id, rating, text)
  values (p_listing, auth.uid(), p_rating, nullif(btrim(coalesce(p_text, '')), ''))
  on conflict (listing_id, author_profile_id) do update set rating = excluded.rating, text = excluded.text, created_at = now()
  returning id into rid;
  return rid;
end $$;
revoke all on function public.master_review_add(uuid, int, text) from public, anon;
grant execute on function public.master_review_add(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 7. Moderatsiya (admin, vacancies.moderate)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.master_moderate(p_id uuid, p_action text, p_reason text default null)
returns public.master_listing_status language plpgsql security definer set search_path = public as $$
declare
  st public.master_listing_status;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action = 'approve' then
    update public.master_listings set status = 'active', reject_reason = null, published_at = coalesce(published_at, now())
     where id = p_id and status in ('pending_review', 'hidden', 'rejected') returning status into st;
  elsif p_action = 'reject' then
    update public.master_listings set status = 'rejected', reject_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500)
     where id = p_id and status in ('pending_review', 'active', 'hidden') returning status into st;
  else
    raise exception 'master_moderate_action' using errcode = '22023';
  end if;
  if st is null then raise exception 'master_listing_not_found' using errcode = 'P0002'; end if;
  return st;
end $$;
revoke all on function public.master_moderate(uuid, text, text) from public, anon;
grant execute on function public.master_moderate(uuid, text, text) to authenticated;

-- Server kaliti (service_role), baza operatori (migratsiya, SQL Editor, psql) yoki moderatsiya huquqli admin.
-- SET ROLE qiymati ("role" sozlamasi) SECURITY DEFINER ichida ham o'qiladi — current_user esa definer bo'lib qoladi.
-- Operator: SET ROLE yo'q ('none') yoki vosita o'zi "SET ROLE postgres" qilgan (ba'zi CLI/boshqaruv vositalari shunday ishlaydi).
-- API orqali kelgan so'rovda bu qiymat faqat anon / authenticated / service_role bo'la oladi (authenticator boshqasiga o'ta olmaydi).
create or replace function public.master_privileged()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('role', true), 'none') in ('service_role', 'none', '', 'postgres', 'supabase_admin')
      or public.has_admin_permission('vacancies.moderate');
$$;
revoke all on function public.master_privileged() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 8. Demo e'lonlar: har kategoriyaga 4 tadan (egasiz, telefonsiz, reytingsiz, "Demo" belgisi); olib tashlash — bitta buyruq
-- ---------------------------------------------------------------------------------------------------
create or replace function public.master_demo_seed()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  c record;
  i int;
  r_slugs text[] := array['tashkent_city', 'samarkand', 'andijan', 'fergana'];
  exp int[] := array[3, 5, 7, 10];
  rid uuid;
begin
  if not public.master_privileged() then raise exception 'forbidden' using errcode = '42501'; end if;
  for c in select * from public.master_categories where is_active order by sort_order loop
    for i in 1..4 loop
      if exists (select 1 from public.master_listings where is_demo and category_id = c.id and slug = 'demo-' || c.slug || '-' || i) then continue; end if;
      select id into rid from public.regions where slug = r_slugs[i];
      insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, experience_years, services,
        region_id, service_area, phone, phone_public, price_negotiable, work_from, work_to, status, is_demo, published_at)
      values (null, c.id, 'demo-' || c.slug || '-' || i, 'Demo usta ' || i, c.name_uz || ' — namuna e''lon ' || i,
        'Bu demo e''lon: haqiqiy usta emas. Haqiqiy ustalar e''lon joylab, admin tasdig''idan o''tgach shu yerda ko''rinadi. ' ||
        'Xizmatlar, tajriba va ish vaqti namuna sifatida ko''rsatilgan.',
        exp[i], array['O''rnatish', 'Ta''mirlash', 'Maslahat'], rid, null, null, false, true, '09:00', '19:00', 'active', true, now() - (i || ' days')::interval);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.master_demo_seed() from public, anon;
grant execute on function public.master_demo_seed() to authenticated;

create or replace function public.master_demo_remove()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.master_privileged() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.master_listings where is_demo;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.master_demo_remove() from public, anon;
grant execute on function public.master_demo_remove() to authenticated;

-- Egasi talabi: dastlab har kategoriyada 4 ta demo e'lon ko'rinsin (olib tashlash: admin → Ustalar → "Demo e'lonlarni olib tashlash"
-- yoki SQL: select public.master_demo_remove();).
-- Faqat birinchi o'rnatishda (jadval shu ishga tushirishda yaratilgan): fayl takror ishga tushirilsa (masalan,
-- supabase/prod/pending.sql qayta qo'yilsa), olib tashlangan demo e'lonlar qaytib qolmaydi — haqiqiy e'lon hali bo'lmasa ham.
-- Qaytarish kerak bo'lsa — admin tugmasi yoki select public.master_demo_seed();
do $$
begin
  if coalesce(current_setting('ishuz.masters_first_install', true), 'false') = 'true' then
    perform public.master_demo_seed();
  end if;
  perform set_config('ishuz.masters_first_install', 'false', false);
end $$;

-- ═══════════════ 0077_demo_vacancies.sql ═══════════════
-- 0077 · Namuna (demo) vakansiyalar — haqiqiy vakansiyalardan ALOHIDA jadval.
--
-- Ega (2026-11-12): "barcha sohalar bo'yicha … vakansiyalar qo'sh"; avvalroq: "har biriga 4 tadan demo … keyin bir marta
-- olib tashla desam olib tashlaysan". Bazada hali haqiqiy e'lon yo'q — ilova bo'sh ko'rinmasin.
--
-- Nega alohida jadval (public.vacancies ga aralashtirilmaydi):
--   namuna e'lon haqiqiy e'lonlar quvuriga UMUMAN kirmaydi — ariza yuborib bo'lmaydi, moslik va xabarnomalar (AI kuzatuv,
--   saqlangan qidiruv, Telegram kanal) ishga tushmaydi, statistika va hisoblagichlarga qo'shilmaydi, sitemap va JobPosting'ga
--   chiqmaydi. Ilova ularni faqat haqiqiy e'lon bo'lmagan joyda, "Namuna" belgisi bilan alohida blokda ko'rsatadi.
--   Kompaniya nomi, telefon, rasm yo'q — o'ylab topilgan tashkilot ko'rsatilmaydi.
--
-- Olib tashlash: admin → "Namuna e'lonlar" → "Olib tashlash" yoki  select public.demo_vacancies_remove();
-- Takror ishga tushirish xavfsiz (if not exists / create or replace; seed faqat jadval bo'sh bo'lsa).

-- Birinchi o'rnatishmi (jadval hali yo'q)? Faqat shunda fayl oxirida namunalar yaratiladi: ega namunalarni olib tashlagach
-- fayl takror ishga tushirilsa (masalan, supabase/prod/pending.sql qayta qo'yilsa), ular qaytib qolmaydi.
select set_config('ishuz.demo_vacancies_first_install', (to_regclass('public.demo_vacancies') is null)::text, false);

create table if not exists public.demo_vacancies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^namuna-[a-z0-9-]{3,80}$'),
  category_id uuid not null references public.categories (id) on delete cascade,
  profession_node_id uuid references public.profession_nodes (id) on delete set null,
  title_uz text not null check (length(btrim(title_uz)) between 2 and 120),
  title_ru text,
  title_en text,
  region_id uuid references public.regions (id) on delete set null,
  district_id uuid references public.districts (id) on delete set null,
  is_remote boolean not null default false,
  salary_from integer check (salary_from is null or salary_from >= 0),
  salary_to integer check (salary_to is null or salary_to >= 0),
  salary_type public.salary_type not null default 'monthly',
  salary_negotiable boolean not null default false,
  schedule public.work_schedule not null default '5_2',
  employment_type public.employment_type not null default 'full_time',
  experience_min_months integer not null default 0 check (experience_min_months between 0 and 240),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint demo_vacancies_salary_order check (salary_from is null or salary_to is null or salary_to >= salary_from)
);

comment on table public.demo_vacancies is
  'Namuna (demo) vakansiyalar: faqat ko''rsatish uchun, "Namuna" belgisi bilan. Haqiqiy vakansiyalar (public.vacancies) bilan bog''lanmagan.';

create index if not exists demo_vacancies_category_idx on public.demo_vacancies (category_id, sort_order);

-- To'g'ridan-to'g'ri kirish yo'q: o'qish faqat quyidagi funksiyalar orqali (RLS yoqilgan, siyosat yo'q)
alter table public.demo_vacancies enable row level security;
revoke all on public.demo_vacancies from public, anon, authenticated;
grant select, insert, update, delete on public.demo_vacancies to service_role;

-- Server kaliti (service_role), baza operatori (migratsiya, SQL Editor, psql; vosita "SET ROLE postgres" qilgan bo'lsa ham)
-- yoki moderatsiya huquqli admin. API orqali "role" faqat anon / authenticated / service_role bo'la oladi.
create or replace function public.demo_privileged()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('role', true), 'none') in ('service_role', 'none', '', 'postgres', 'supabase_admin')
      or public.has_admin_permission('vacancies.moderate');
$$;
revoke all on function public.demo_privileged() from public, anon, authenticated;

-- Ommaviy ro'yxat: kartaga kerakli maydonlar (haqiqiy vakansiya kartasi bilan bir xil nomlar). p_region berilsa — o'sha
-- viloyatdagilar birinchi (boshqalari ham ko'rinadi: namuna hududga bog'lab yashirilmaydi).
create or replace function public.demo_vacancies_public(
  p_category text default null,
  p_region text default null,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title_uz text, title_ru text, title_en text,
  category_slug text, category_icon text, profession_node_id uuid,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  lat double precision, lng double precision,
  is_remote boolean, salary_from integer, salary_to integer, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, employment_type public.employment_type, experience_min_months integer,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  select v.id, v.slug, v.title_uz, v.title_ru, v.title_en,
         c.slug, c.icon, v.profession_node_id,
         r.name_uz, r.name_ru, r.name_en, r.name_oz,
         d.name_uz, d.name_ru, d.name_en, d.name_oz,
         d.lat, d.lng,
         v.is_remote, v.salary_from, v.salary_to, v.salary_type, v.salary_negotiable,
         v.schedule, v.employment_type, v.experience_min_months,
         count(*) over () as total_count
  from public.demo_vacancies v
  join public.categories c on c.id = v.category_id and c.is_active
  left join public.regions r on r.id = v.region_id
  left join public.districts d on d.id = v.district_id
  where (p_category is null or p_category = '' or c.slug = p_category)
    and (p_query is null or btrim(p_query) = ''
         or v.title_uz ilike '%' || btrim(p_query) || '%'
         or coalesce(v.title_ru, '') ilike '%' || btrim(p_query) || '%'
         or coalesce(v.title_en, '') ilike '%' || btrim(p_query) || '%')
  order by (p_region is not null and p_region <> '' and r.slug = p_region) desc, v.sort_order, v.slug
  limit least(greatest(coalesce(p_limit, 12), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Bitta namuna e'lon (sahifa uchun)
create or replace function public.demo_vacancy_public(p_slug text)
returns table (
  id uuid, slug text, title_uz text, title_ru text, title_en text,
  category_slug text, category_icon text, category_name_uz text, category_name_ru text, category_name_en text,
  region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text,
  district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text,
  is_remote boolean, salary_from integer, salary_to integer, salary_type public.salary_type, salary_negotiable boolean,
  schedule public.work_schedule, employment_type public.employment_type, experience_min_months integer
)
language sql stable security definer set search_path = public as $$
  select v.id, v.slug, v.title_uz, v.title_ru, v.title_en,
         c.slug, c.icon, c.name_uz, c.name_ru, c.name_en,
         r.name_uz, r.name_ru, r.name_en, r.name_oz,
         d.name_uz, d.name_ru, d.name_en, d.name_oz,
         v.is_remote, v.salary_from, v.salary_to, v.salary_type, v.salary_negotiable,
         v.schedule, v.employment_type, v.experience_min_months
  from public.demo_vacancies v
  join public.categories c on c.id = v.category_id
  left join public.regions r on r.id = v.region_id
  left join public.districts d on d.id = v.district_id
  where v.slug = p_slug;
$$;

-- Namuna e'lonlarni (qayta) yaratish: har faol sohada 4 tadan — o'sha sohaning ommabop kasblari, hududlar navbat bilan.
-- Maosh oralig'i — sohaga xos TAXMINIY namuna (statistika emas); 4-e'lon "kelishiladi". Avvalgi namunalar almashtiriladi.
create or replace function public.demo_vacancies_seed()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.demo_privileged() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.demo_vacancies;
  with cats as (
    select c.id, c.slug, row_number() over (order by c.sort_order, c.slug) - 1 as ci
    from public.categories c where c.is_active
  ),
  regs as (
    select r.id, row_number() over (order by r.sort_order, r.slug) - 1 as ri, count(*) over () as rc
    from public.regions r where r.is_active
  ),
  picks as (
    select c.id as category_id, c.slug as category_slug, c.ci, p.id as node_id, p.name_uz, p.name_ru, p.name_en,
           row_number() over (partition by c.id order by p.is_popular desc, p.sort_order, p.name_uz) as rn
    from cats c
    join public.profession_nodes p on p.category_id = c.id and p.selectable and p.is_active
  ),
  pay(slug, lo, hi) as (values
    ('it', 8000000, 20000000), ('sales', 4000000, 9000000), ('marketing', 5000000, 12000000), ('design', 5000000, 12000000),
    ('finance', 5000000, 12000000), ('driver', 5000000, 10000000), ('logistics', 4000000, 8000000), ('courier', 4000000, 9000000),
    ('construction', 5000000, 12000000), ('craftsman', 5000000, 10000000), ('electrician', 5000000, 10000000),
    ('plumber', 5000000, 10000000), ('mechanic', 5000000, 10000000), ('auto_service', 5000000, 10000000),
    ('restaurant', 3500000, 8000000), ('call_center', 3500000, 6000000), ('office', 4000000, 8000000),
    ('education', 3500000, 8000000), ('medicine', 4000000, 10000000), ('cleaning', 3000000, 5000000),
    ('security', 3000000, 5000000), ('sewing', 4000000, 8000000), ('beauty', 4000000, 10000000),
    ('production', 4000000, 8000000), ('agriculture', 3500000, 7000000), ('hotel', 4000000, 8000000),
    ('legal', 6000000, 14000000), ('science', 5000000, 10000000), ('management', 10000000, 25000000),
    ('government', 4000000, 8000000), ('engineering', 7000000, 15000000), ('telecom', 4000000, 9000000),
    ('energy', 5000000, 10000000), ('mining', 7000000, 15000000), ('culture', 4000000, 9000000),
    ('real_estate', 5000000, 15000000), ('crafts', 4000000, 9000000)
  )
  insert into public.demo_vacancies (
    slug, category_id, profession_node_id, title_uz, title_ru, title_en, region_id, district_id, is_remote,
    salary_from, salary_to, salary_type, salary_negotiable, schedule, employment_type, experience_min_months, sort_order
  )
  select
    'namuna-' || replace(p.category_slug, '_', '-') || '-' || p.rn,
    p.category_id, p.node_id, p.name_uz, p.name_ru, p.name_en,
    r.id,
    (select d.id from public.districts d where d.region_id = r.id and d.is_active and d.lat is not null order by d.sort_order, d.slug limit 1),
    (p.rn = 4 and p.category_slug in ('it', 'marketing', 'design', 'call_center')),
    case when p.rn = 4 then null
         else (round(coalesce(pay.lo, 4000000) * (1 + (p.rn - 1) * 0.15) / 100000.0) * 100000)::integer end,
    case when p.rn = 4 then null
         else (round(coalesce(pay.hi, 8000000) * (1 + (p.rn - 1) * 0.15) / 100000.0) * 100000)::integer end,
    'monthly'::public.salary_type,
    p.rn = 4,
    (case p.rn
       when 1 then '5_2'
       when 2 then case when p.category_slug = any(shift_cats.s) or p.category_slug = any(six_cats.s) then '6_1' else '5_2' end
       when 3 then case when p.category_slug = any(shift_cats.s) then '2_2' else '5_2' end
       else 'flexible' end)::public.work_schedule,
    (case p.rn
       when 3 then case when p.category_slug = any(shift_cats.s) then 'shift' else 'full_time' end
       when 4 then 'part_time'
       else 'full_time' end)::public.employment_type,
    (array[12, 0, 36, 0])[p.rn],
    p.rn * 100 + p.ci
  from picks p
  join regs r on r.ri = (p.ci * 4 + p.rn - 1) % r.rc
  left join pay on pay.slug = p.category_slug
  -- smenali ish odatiy bo'lgan sohalar (2/2) va olti kunlik hafta odatiy bo'lgan sohalar
  cross join (select array['security', 'restaurant', 'call_center', 'hotel', 'production', 'medicine', 'energy', 'mining',
                           'courier', 'driver', 'logistics', 'cleaning', 'auto_service'] as s) shift_cats
  cross join (select array['sales', 'construction', 'craftsman', 'beauty', 'sewing', 'agriculture', 'crafts', 'electrician',
                           'plumber', 'mechanic'] as s) six_cats
  where p.rn <= 4;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.demo_vacancies_remove()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.demo_privileged() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.demo_vacancies;
  get diagnostics n = row_count;
  return n;
end $$;

-- Huquqlar: ommaviy o'qish — hammaga; boshqaruv — faqat kirgan (ichida admin tekshiruvi) va server
revoke all on function public.demo_vacancies_public(text, text, text, integer, integer) from public;
revoke all on function public.demo_vacancy_public(text) from public;
grant execute on function public.demo_vacancies_public(text, text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.demo_vacancy_public(text) to anon, authenticated, service_role;
revoke all on function public.demo_vacancies_seed() from public, anon;
revoke all on function public.demo_vacancies_remove() from public, anon;
grant execute on function public.demo_vacancies_seed() to authenticated, service_role;
grant execute on function public.demo_vacancies_remove() to authenticated, service_role;

-- Birinchi o'rnatishda: har sohada 4 tadan namuna. Keyingi ishga tushirishlarda tegilmaydi (olib tashlangan bo'lsa — qaytmaydi).
-- Qaytarish: admin tugmasi yoki  select public.demo_vacancies_seed();
do $$
begin
  if coalesce(current_setting('ishuz.demo_vacancies_first_install', true), 'false') = 'true' then
    perform public.demo_vacancies_seed();
  end if;
  perform set_config('ishuz.demo_vacancies_first_install', 'false', false);
end $$;

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
  ('0077', 'demo_vacancies jadvali (namuna vakansiyalar)', to_regclass('public.demo_vacancies') is not null)
) as m(migration, tekshiruv, bor)
order by m.migration;
