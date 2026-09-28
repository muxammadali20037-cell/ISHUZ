-- ISH.UZ · 0025 · hisobni o'chirish (foydalanuvchining o'zi).
-- To'lov yozuvlari o'chirilmaydi (moliyaviy hisobot uchun): profil o'chsa profile_id bo'shaydi.
-- O'chirishdan oldin: egasiz qoladigan faol vakansiyalar yopiladi, audit logga yoziladi.
-- Auth foydalanuvchini o'chirish serverda (service role) bajariladi — qolgan ma'lumotlar FK cascade / set null.

alter table public.payments alter column profile_id drop not null;
alter table public.payments drop constraint if exists payments_profile_id_fkey;
alter table public.payments add constraint payments_profile_id_fkey foreign key (profile_id) references public.profiles(id) on delete set null;

create or replace function public.prepare_account_deletion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  closed int := 0;
  orphan_companies uuid[];
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  -- adminlar avval admin huquqidan chiqarilishi kerak (tizim egasiz qolmasin)
  if exists (select 1 from public.admin_users where profile_id = me and is_active) then
    raise exception 'admin_cannot_delete' using errcode = '42501';
  end if;

  -- faqat shu foydalanuvchi a'zo bo'lgan kompaniyalar
  select coalesce(array_agg(m.company_id), '{}') into orphan_companies
  from public.company_members m
  where m.profile_id = me
    and not exists (select 1 from public.company_members o where o.company_id = m.company_id and o.profile_id <> me);

  -- egasiz qoladigan faol vakansiyalar yopiladi (nomzodlar bo'sh e'longa ariza bermasin)
  with c as (
    update public.vacancies v set status = 'closed'
    where v.status in ('active', 'pending_review', 'paused')
      and ((v.owner_profile_id = me and v.company_id is null) or v.company_id = any(orphan_companies))
    returning 1
  )
  select count(*) into closed from c;

  perform public.write_audit('user.self_delete', 'profile', me::text, null, jsonb_build_object('closed_vacancies', closed));
  return jsonb_build_object('closed_vacancies', closed);
end $$;

revoke execute on function public.prepare_account_deletion() from public, anon, authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;
