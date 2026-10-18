-- 0067 · Bosh sahifa (marketplace): soha kartalari va statistika uchun haqiqiy sonlar, bitta so'rovda.
--  home_market_counts() → {"categories": {"<category_id>": n, ...}, "employers": n}
--   - sohalar: faol va muddati o'tmagan vakansiyalar (qidiruv va /jobs?category= bilan bir xil qoida);
--   - ish beruvchilar: kamida bitta shunday vakansiyasi bor ish beruvchi (kompaniya, bo'lmasa e'lon egasi).
-- SECURITY INVOKER: chaqiruvchining RLS'i bilan ishlaydi (mehmon faqat faol e'lonlarni ko'radi) — yangi SECURITY DEFINER
-- yuzasi yo'q. Faqat yangi funksiya: mavjud jadval va funksiyalar o'zgarmaydi, drop yo'q.

create or replace function public.home_market_counts()
returns jsonb
language sql stable security invoker set search_path = public as $$
  with act as (
    select v.category_id, coalesce(v.company_id::text, v.owner_profile_id::text) as employer
    from public.vacancies v
    where v.status = 'active' and (v.expires_at is null or v.expires_at > now())
  )
  select jsonb_build_object(
    'categories', coalesce((select jsonb_object_agg(c.category_id, c.n)
                            from (select category_id, count(*) as n from act where category_id is not null group by category_id) c), '{}'::jsonb),
    'employers', (select count(distinct employer) from act)
  );
$$;

revoke execute on function public.home_market_counts() from public;
grant execute on function public.home_market_counts() to anon, authenticated;
