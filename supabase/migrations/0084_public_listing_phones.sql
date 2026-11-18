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
