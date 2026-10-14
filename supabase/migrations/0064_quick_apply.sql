-- 0064 · Tezkor ariza (G2): profil to'ldirmasdan ariza yuborish.
-- Ilova ariza uchun minimal yopiq (is_public = false) ishchi profilini yaratadi. Avval can_view_worker ariza/taklif
-- orqali ko'rishda ham onboarding_completed_at ni talab qilardi — ish beruvchi arizachini "Nomzod" deb, ismsiz ko'rardi.
-- Endi: ochiq qidiruv (is_public) uchun to'liq profil sharti saqlanadi; ariza yoki taklif bo'lsa — profil to'liq
-- bo'lmasa ham ish beruvchi (va kompaniya a'zolari) arizachini ko'radi. drop yo'q, faqat create or replace.

create or replace function public.can_view_worker(p_worker_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.worker_profiles w join public.profiles p on p.id = w.profile_id
    where w.id = p_worker_id and (
      w.profile_id = auth.uid() or public.is_admin()
      or (auth.uid() is not null and not p.is_blocked and (
        (w.is_public and w.onboarding_completed_at is not null)
        or exists (select 1 from public.applications a join public.vacancies v on v.id = a.vacancy_id
                   where a.worker_id = w.id and (v.owner_profile_id = auth.uid() or (v.company_id is not null and public.is_company_member(v.company_id))))
        or exists (select 1 from public.job_offers o where o.worker_id = w.id and (o.employer_profile_id = auth.uid() or (o.company_id is not null and public.is_company_member(o.company_id))))
      ))
    ));
$$;

-- ilova shu bayroq bo'yicha tezkor arizani yoqadi (eski bazada — avvalgidek profil to'ldirishga yuboradi)
create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true, 'photo_quarantine', true, 'media_quarantine', true, 'daily_jobs', true,
    'saved_items', true, 'wallet', true, 'quick_apply', true);
$$;
