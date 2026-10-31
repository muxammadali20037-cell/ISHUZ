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
