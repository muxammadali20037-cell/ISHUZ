# EMPLOYER moduli — DB/RPC so'rovlar va kuzatuvlar

## Ochiq so'rovlar
Hozircha yo'q. `company_invites` + `accept_company_invite(p_token)` (0005/0010) modulda to'liq ishlatilgan:
`/company/settings#members` (taklif yaratish/o'chirish/havola nusxalash) va `/company/join?token=...` (qabul qilish).

## Modul ishlatadigan DB obyektlar (ma'lumot uchun)
- Jadvallar: `employer_profiles` (insert/update o'zi), `companies` (insert created_by=me, update owner/admin; `slug: ""` → trigger yaratadi),
  `company_members` (select/update role/delete), `company_invites` (insert/select/delete — faqat admin), `verification_requests` (insert pending, select o'zi),
  `vacancies` (select; "meniki" filtri `owner_profile_id = me OR company_id = my_company` — RLS faol vakansiyalarni hammaga ochgani uchun aniq filtr),
  `applications` (select `vacancies!inner(title)`, `worker_profiles!inner(profiles!worker_profiles_profile_id_fkey(...))`).
- RPC: `employer_dashboard_stats`, `search_workers`, `search_vacancies(p_company_id)`, `profile_rating`, `accept_company_invite`.
- Storage: `company-logos/<company_id>/logo.<ext>` (upsert, URL ga `?v=` qo'shiladi), `documents/<profile_id>/<uuid>.<ext>`.

## Kuzatuvlar (lokal dev bazasi, `ishuz_dev`)
- `handle_company_slug` → `slugify` → `unaccent` uchun `authenticated` roliga EXECUTE huquqi yo'q edi (lokal bazada). 0010 da grant bo'lsa ham lokal baza eskirgan bo'lishi mumkin — `db:local` ni qayta yurgizish kerak.
- `worker_completeness` da `tips := tips || 'add_photo'` "malformed array literal" xatosi (lokal bazadagi eski versiya) — worker_profiles insert trigger'ini yiqitadi.
- `handle_company_created` trigger `employer_type = 'company'` qilib qo'yadi; YaTT uchun modul o'zi turini qaytaradi (`individual_entrepreneur`). Xohlasangiz trigger `employer_type` ga tegmasin (faqat `company_id`).
