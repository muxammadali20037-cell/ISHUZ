# Applications & Offers moduli — DB/RLS so'rovlari

Modul: `src/features/applications`, `src/features/offers`, route'lar `/applications`, `/offers`, `/employer/vacancies/[id]/applications`.
Barcha yozishlar RPC orqali: `set_application_status`, `respond_offer`, `mark_offer_viewed`, `withdraw_offer`, `mark_offer_hired`, `create_review`.
O'qishlar: `applications` ⋈ `vacancies` ⋈ `companies` ⋈ `application_events`, `applications` ⋈ `worker_profiles` ⋈ `profiles`,
`job_offers` ⋈ `vacancies`/`companies`/`profiles`/`worker_profiles`, `reviews` (o'z sharhim), rpc `manages_vacancy`, `can_edit_vacancy`.

## Hozirgi RLS bilan UI qanday yo'l tutadi (so'rovlar emas, qayd)

1. **Ishchi arxiv arizasida vakansiya ko'rinmaydi.** `vacancies_read_active` faqat `status = 'active'` bo'lganda o'qishga ruxsat beradi.
   Yopilgan/to'xtatilgan vakansiyaga yuborilgan ariza ishchi ro'yxatida `vacancy = null` bo'lib keladi — UI "Vakansiya endi mavjud emas" ko'rsatadi,
   havola va ContactCard yashiriladi. **So'rov:** ishchi o'zi ariza yuborgan (yoki taklif olgan) vakansiyani statusidan qat'i nazar o'qiy olsin:
   ```sql
   create policy "vacancies_read_applied" on public.vacancies for select to authenticated
     using (exists (select 1 from public.applications a where a.vacancy_id = vacancies.id and a.worker_id = public.current_worker_id())
         or exists (select 1 from public.job_offers o where o.vacancy_id = vacancies.id and o.worker_id = public.current_worker_id()));
   ```
2. **Yopiq (is_public = false) nomzod ish beruvchi pipeline'ida ko'rinmaydi.** `can_view_worker` faqat ochiq profilni beradi; ariza yuborgan nomzod
   profilini yopib qo'ysa, `worker_profiles` join `null` keladi — UI "Nomzod profili yopiq" ko'rsatadi (holat amallari va chat ishlayveradi).
   **So'rov:** `can_view_worker` ga "nomzod mening vakansiyamga ariza yuborgan / taklifimni qabul qilgan" shartini qo'shish
   (`can_view_profile` da bu allaqachon bor — `worker_profiles` uchun ham xuddi shunday).
3. **`withdraw_offer` / `mark_offer_viewed` jim ishlaydi** (void, xatosiz). Action natijani qayta o'qib (`job_offers.status`) foydalanuvchiga
   `offer_closed` qaytaradi. Ixtiyoriy: RPC `boolean` (o'zgardi/o'zgarmadi) qaytarsa qo'shimcha so'rov kerak bo'lmaydi.

## Tekshirilgan (lokal Postgres, `scripts/db-local.sh` sxemasi)

`set_application_status`: sent→viewed (idempotent)→shortlisted→interview(izoh)→offered→hired; orqaga → `invalid_transition`;
yakunlangan → `application_closed`; ishchi faqat `withdrawn`; begona → `42501`. `create_review` ariza (hired) va taklif (`hired_at`) bo'yicha,
takroriy → `23505` (UI: `review_exists`). `respond_offer`: accept/decline, yakunlangan → `offer_closed`, muddati o'tgan → `offer_expired` (+status `expired`).
`withdraw_offer`, `mark_offer_hired`, `manages_vacancy`, `can_edit_vacancy` — kutilganidek.

## Boshqa modullardan kutiladigan route'lar (havolalar)

`/messages/new?application_id=<id>` va `/messages/new?offer_id=<id>` (chat), `/jobs/[slug]`, `/workers/[workerId]`, `/company/[slug]`,
`/employer/vacancies/[id]` (vakansiya sahifasi; undan `/employer/vacancies/[id]/applications` ga havola kutiladi), `/onboarding/worker`, `/onboarding/employer`, `/profile`.

## Yangi paket kerak emas.
