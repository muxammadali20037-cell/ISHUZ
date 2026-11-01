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
