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
