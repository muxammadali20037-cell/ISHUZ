# JOBS moduli — DB/RPC kuzatuvlar va so'rovlar

Modul: `/jobs`, `/jobs/[slug]`, `/saved`, `WorkerHome`. Barcha kerakli RPC'lar mavjud (`search_vacancies`, `compute_match`,
`apply_to_vacancy`, `worker_dashboard_stats`, `record_vacancy_view`, `manages_vacancy`) — lokal Postgres'da 33 ta ssenariy tekshirildi.
Quyidagilar majburiy emas, lekin foydali bo'lardi:

1. **`vacancies` INSERT … RETURNING RLS bilan ishlamaydi** (ish beruvchi moduli uchun muhim). `vacancies_read_own` SELECT siyosati
   `manages_vacancy(id)` ni chaqiradi; bu funksiya jadvaldan o'qiydi va xuddi shu statement ichida yangi qatorni ko'rmaydi →
   `insert(...).select()` (supabase-js) "new row violates row-level security policy" beradi. Taklif: SELECT siyosatiga
   `or owner_profile_id = auth.uid()` qo'shish (yoki `vacancies_insert` dan keyin alohida select qilish).
2. **Saqlangan, lekin nofaol vakansiya** (`saved_vacancies` → `vacancies` RLS tufayli null): UI "Vakansiya endi mavjud emas"
   kartasini ko'rsatadi, sarlavhasiz. Ixtiyoriy RPC: `my_saved_vacancies()` — `security definer`, nofaol vakansiya uchun ham
   `title, status, company_name` qaytarsa, karta to'liqroq bo'ladi.
3. **`search_vacancies` uchun `p_exclude_id uuid default null`** — "O'xshash vakansiyalar" hozir `limit+1` olib, joriysini TS'da
   filtrlaydi; parametr bo'lsa aniqroq.
4. `record_vacancy_view` har bir ko'rishda (bot/egasi ham) sanaydi. UI boshqaruvchi (manages_vacancy) ko'rganda chaqirmaydi;
   RPC ichida `owner_profile_id <> auth.uid()` sharti bo'lsa yana ham to'g'ri bo'ladi.
5. `owner_profile_id` endi nullable (0006 o'zgardi) — UI `ContactCard` ni faqat u mavjud bo'lsa ko'rsatadi. `can_edit_vacancy`
   hali `database.types.ts` da yo'q — turlar qayta generatsiya qilinsa, "Boshqarish" havolasi uchun `manages_vacancy` o'rniga
   ishlatish mumkin.

Paket so'rovi: yo'q.
