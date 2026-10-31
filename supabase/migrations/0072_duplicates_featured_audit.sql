-- 0072 · Ishonch va admin (2026-10-31 auditi, §5):
--   1) Takroriy vakansiya: bir ish beruvchi (yoki bitta kompaniya) bir xil nom + bir xil joy bilan ikkinchi e'lonni
--      CHIQARA OLMAYDI, birinchisi faol / ko'rib chiqilmoqda / to'xtatilgan va muddati o'tmagan bo'lsa. Bir nechta odam kerak
--      bo'lsa — mavjud e'londagi "o'rinlar soni" (positions_count). Xato: duplicate_vacancy (ilova tushuntiradi va mavjud
--      e'longa havola beradi). Qoralama saqlash cheklanmaydi — faqat chiqarish (ommaga yoki moderatsiyaga yuborish).
--      Faqat ish beruvchining o'z amali tekshiriladi; admin tasdig'i va cron — yo'q (admin istisno qila oladi).
--   2) TOP vakansiya (admin): `is_featured` / `featured_until` ustunlari bor edi (qidiruv ularni birinchi qo'yadi — 0008), lekin
--      hech kim yoqa olmasdi. admin_set_vacancy_featured — 7/14/30 kun yoki olib tashlash; faqat faol vakansiya; audit bilan.
--      Pullik "TOP" mahsuloti — to'lov ulanganda (bu funksiya o'shanda ham ishlatiladi).
--   3) Admin audit: admin_log prefikslari — avval noma'lum prefiks "admins.manage" talab qilardi va oddiy admin uchun
--      "profession.update_meta" va o'z kirish ma'lumotini o'rnatish audit qilinmasdi (xato). Yangi: profession, media,
--      verification (hujjat ko'rish), analytics (CSV eksport), account (o'z hisobi — har qanday faol admin).

-- ---------------------------------------------------------------------------------------------------
-- 1. Takroriy vakansiya
-- ---------------------------------------------------------------------------------------------------
create or replace function public.vacancy_title_key(p_title text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(lower(coalesce(p_title, '')), '[^[:alnum:]]+', ' ', 'g'))
$$;

create or replace function public.find_duplicate_vacancy(p_id uuid, p_owner uuid, p_company uuid, p_title text, p_region uuid, p_district uuid, p_remote boolean)
returns text language sql stable security definer set search_path = public as $$
  select o.slug
  from public.vacancies o
  where o.id is distinct from p_id
    and (o.owner_profile_id = p_owner or (p_company is not null and o.company_id = p_company))
    and o.status in ('active', 'pending_review', 'paused')
    and (o.expires_at is null or o.expires_at > now())
    and public.vacancy_title_key(o.title) = public.vacancy_title_key(p_title)
    and o.is_remote = coalesce(p_remote, false)
    and (coalesce(p_remote, false) or (o.region_id is not distinct from p_region and o.district_id is not distinct from p_district))
  order by o.published_at desc nulls last
  limit 1
$$;
revoke all on function public.find_duplicate_vacancy(uuid, uuid, uuid, text, uuid, uuid, boolean) from public;

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
  dup := public.find_duplicate_vacancy(new.id, new.owner_profile_id, new.company_id, new.title, new.region_id, new.district_id, new.is_remote);
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
  return public.find_duplicate_vacancy(v.id, v.owner_profile_id, v.company_id, v.title, v.region_id, v.district_id, v.is_remote);
end $$;
revoke all on function public.my_duplicate_vacancy(uuid) from public;
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
revoke all on function public.admin_set_vacancy_featured(uuid, int) from public;
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
  perm := case prefix
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
    when 'account' then null          -- o'z hisobi: har qanday faol admin
    when 'admin' then 'admins.manage'
    else 'admins.manage'
  end;
  if perm is not null and not public.has_admin_permission(perm) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.write_audit(p_action, p_target_type, p_target_id, p_before, p_after);
end $$;
