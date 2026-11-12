# Mahsulot arxitekturasi — Ish topdim 2.0

Bu hujjat **maqsadli** tuzilma. Hozirgi holat — `docs/PROJECT_AUDIT.md`, ish tartibi — `docs/IMPLEMENTATION_PLAN.md`.

## 1. Tamoyillar

1. **Bitta mahsulot, uchta interfeys:** ochiq sayt + kabinetlar, Telegram (bot va Mini App), admin paneli.
   Hammasi bitta Supabase bazasi, bitta qoidalar to'plami va bitta ruxsatlar tizimidan foydalanadi.
2. **Har bir biznes amalining bitta egasi bor:** ariza holati faqat `applications` moduli orqali o'zgaradi, sayt, bot va
   Mini App uni faqat chaqiradi. Bir xil mantiq ikki joyda yozilmaydi.
3. **Modulli monolit:** Next.js + Supabase. Mikroservislar yo'q, toki o'lchangan ehtiyoj paydo bo'lmaguncha.
4. **Xavfsizlik bazada:** RLS har bir jadvalda, muhim amallar `security definer` RPC'larda, server tomonda zod tekshiruvi.
5. **Halollik:** to'qima raqam, soxta sharh, soxta tasdiq belgisi, sun'iy odam surati yo'q. Ma'lumot bo'lmasa — buni ochiq aytamiz.
6. **Bepul boshlanish:** ish izlovchi uchun hamma narsa bepul. Pullik funksiyalar real faollik va ishonchli to'lov
   infratuzilmasidan keyin yoqiladi.

## 2. Rollar

| Rol | Kim | Qanday paydo bo'ladi |
| --- | --- | --- |
| Mehmon | Kirmagan tashrifchi | Qidiruv, vakansiya va kompaniya sahifalarini ko'radi; aloqa raqamlari yopiq |
| Ish izlovchi | `user_roles.role = worker` | Onboarding'dan keyin |
| Ish beruvchi | `user_roles.role = employer` + `company_members` (owner / admin / recruiter / viewer) | Kompaniya yaratish yoki taklif orqali |
| Admin | `admin_users.role`: super_admin / admin / moderator / support / analyst | Faqat super_admin qo'shadi; kirish parol + TOTP (aal2) |

Bitta odam ikkala rolga ega bo'lishi mumkin, rejim almashtirish orqali (`src/features/mode`). Ikkinchi akkaunt kerak emas.

## 3. Modullar va egalari

| Modul | Kod | Asosiy jadvallar | Eslatma |
| --- | --- | --- | --- |
| Identifikatsiya | `features/auth` | `profiles`, `user_roles`, `telegram_accounts`, `login_codes` | Telegram + telefon kodi; SMS — keyin, provayder bilan |
| Onboarding | `features/onboarding` | `worker_profiles.onboarding_step` | Progress serverda |
| Skill Passport (profil = CV) | `features/profile`, `features/cv` | `worker_profiles`, `worker_*`, (+ `worker_certifications`) | Har bir yozuvga tasdiq darajasi qo'shiladi |
| Kasb taksonomiyasi | `features/professions`, `features/catalog` | `profession_nodes`, `skills` | Yagona manba; bot ham shunga o'tadi |
| Kompaniya | `features/companies`, `features/employer` | `companies`, `company_members`, `company_invites` | |
| Vakansiya | `features/vacancies`, `features/post` | `vacancies`, `vacancy_*` | **Bitta** yaratish oqimi (birlashtiriladi) |
| Qidiruv | `features/search`, `features/find` | `search_vacancies_v3`, `simple_search_*` | **Bitta** qidiruv tajribasi (birlashtiriladi) |
| Moslash | SQL `compute_match_v2` | `matches`, `match_*` | TS v1 olib tashlanadi yoki v2 ga ulanadi |
| Arizalar va yollash | `features/applications`, `features/offers` | `applications`, `application_events`, `application_notes`, `job_offers`, (+ `interviews`, `interview_feedback`) | Holat mashinasi bitta |
| Saqlanganlar | `features/saved` | `saved_vacancies`, `saved_workers`, `saved_items` | Bitta tizimga keltiriladi |
| Xabarlar | `features/chat` | `conversations`, `messages` | |
| Bildirishnomalar | `features/notifications`, `features/bot` | `notifications`, bot outbox | Sayt + Telegram bir manbadan |
| Ishonch | `features/verification`, `features/moderation`, `features/reports` | `verification_requests`, `moderation_checks`, `reports`, `security_*` | Pul so'rash iboralari tekshiruvi |
| Admin | `features/admin` | barcha jadvallar, ruxsat bilan | Har bir amal `audit_logs` ga |
| AI | `src/lib/ai`, `features/ai` | `ai_usage_log` | Kalitlar faqat serverda; AI yakuniy qaror qabul qilmaydi |
| To'lov | `features/billing` | `payments`, `wallets`, (+ `plans`, `subscriptions`) | Hozir o'chiq |
| Monitoring | `src/lib/monitoring.ts`, `/api/health` | `security_events` | Sentry, uptime |

## 4. Navigatsiya (maqsad)

### Ochiq sayt — yuqori menyu
Ishlar · Kompaniyalar · Kasblar · Ish beruvchilarga · [Kirish] · [Vakansiya joylash]

### Ish izlovchi — kompyuterda chap sidebar

| Talabdagi band | Marshrut | Holat |
| --- | --- | --- |
| Boshqaruv paneli | `/cabinet` | bor |
| Mening profilim / Skill Passport | `/profile` | bor, kengaytiriladi |
| Ish qidirish | `/search?mode=jobs` (yagona) | birlashtiriladi |
| Tavsiyalar | `/cabinet/matches` | bor |
| Saqlangan vakansiyalar | `/saved` | bor |
| Arizalarim | `/applications` | bor |
| Suhbatlar | `/interviews` | yangi |
| Xabarlar | `/messages` | bor |
| Sozlamalar | `/settings` | bor |

Mobil pastki menyu (5): Bosh sahifa · Qidiruv · Saqlangan · Arizalar · Profil.

### Ish beruvchi — kompyuterda chap sidebar

| Talabdagi band | Marshrut | Holat |
| --- | --- | --- |
| Umumiy ko'rinish | `/employer` | bor |
| Vakansiyalar / Vakansiya yaratish | `/employer/vacancies`, `/employer/vacancies/new` (yagona) | birlashtiriladi |
| Nomzodlar bazasi / Aqlli qidiruv | `/search?mode=workers` | bor |
| Saqlangan nomzodlar | `/employer/saved` | bor |
| Yollash jarayoni | `/employer/applications` (kanban ko'rinishi bilan) | kengaytiriladi |
| Suhbatlar | `/employer/interviews` | yangi |
| Xabarlar | `/messages` | bor |
| Kompaniya profili / Jamoa | `/company/settings` | bor |
| Analitika | `/employer/analytics` | yangi |
| Tariflar va to'lovlar | `/billing` | bor (o'chiq) |
| Sozlamalar | `/settings` | bor |

Mobil pastki menyu (5): Panel · Ishlar · Nomzodlar · Xabarlar · Kompaniya.

### Telegram Mini App
Mobil qobiq bilan bir xil, lekin sayt sarlavhasi va pastki menyusi o'rniga Telegram `BackButton`, `MainButton`, mavzu
ranglari va `language_code`. Hamburger va pastki menyu bir vaqtda ko'rsatilmaydi.

### Admin
Hozirgi 26 bo'lim saqlanadi. Qo'shiladi: Kompaniyalar (alohida), Arizalar, Obunalar.

## 5. Ma'lumot oqimi (misol: ariza)

1. Ish izlovchi saytda, Mini App'da yoki botda "Ariza" bosadi → bitta server amali → `applications` ga yozuv,
   `application_events` ga tarix.
2. Trigger bildirishnoma yaratadi → sayt bildirishnomasi + bot outbox (Telegram, limit va rozilik bilan).
3. Ish beruvchi holatni o'zgartiradi → bitta RPC, ruxsat RLS bilan → ish izlovchiga xabar.
4. Har bir qadam testda: SQL test (ruxsat), Vitest (mantiq), Playwright (to'liq yo'l).

## 6. AI qatlami

- Yagona o'rovchi `src/lib/ai/client.ts`: provayder almashtirish, kunlik limit, xarajat jurnali, strukturali JSON, zod tekshiruvi.
- Moslash bali AI emas, `compute_match_v2` qoidalari: har bir omil izohlanadi, ma'lumot yo'q bo'lsa "noma'lum".
- Himoyalangan belgilar (jins, yosh, millat, din) saralash omili emas.
- AI ishlamasa ham asosiy amallar (qidiruv, ariza, e'lon) ishlaydi.

## 7. Saqlanadigan qarorlar

- Jadvallar talabdagi inglizcha nomlarga qayta nomlanmaydi (`vacancies` → `jobs` emas): prod ma'lumotlar va 297 funksiya xavfsizligi.
- Mavjud marshrutlar yangisi ishlamaguncha o'chirilmaydi; eski manzildan yangisiga yo'naltirish qo'yiladi.
