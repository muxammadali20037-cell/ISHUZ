# Loyiha auditi — Ish topdim 2.0 (0-bosqich)

| | |
| --- | --- |
| Sana | 2026-11-11 |
| Branch | `claude/phase-0-barqarorlik` (prod `main` = `476cc60`, branch 12 commit oldinda, relizga chiqmagan) |
| Usul | Kodni o'qish, lokal bazadan katalog so'rovlari, CI natijalari, ochiq prod sahifalar. Prod bazaga kirish yo'q |
| Batafsil | `docs/ROUTES_MAP.md` (102 sahifa), `docs/DATABASE_SCHEMA.md` (83 jadval) — ikkalasi koddan avtomatik yaratilgan |

Belgilar: **BOR** — kodda bor va testlangan · **QISMAN** — bor, lekin talabdan kam · **YO'Q** — kodda yo'q ·
**PROD BUZUQ** — kodda bor, prod'da ishlamaydi · **TEKSHIRILMAGAN** — ko'rib bo'lmadi.

## 1. Qisqa xulosa

Loyiha demo emas: ishlaydigan, testlangan mahsulot. Yangi talablarning taxminan uchdan ikki qismi kodda allaqachon bor.
Shuning uchun **qayta yozish emas, birlashtirish va yangi dizayn** kerak. Asosiy muammolar:

1. Prod bazasi koddan orqada (0069–0075 qo'llanmagan) — `/companies` buzilgan, filtrlar jim ishlamaydi. Yechim tayyor,
   ega amalini kutmoqda (`docs/RELEASE_CHECKLIST.md`).
2. Prod'da real vakansiya yo'q (0 ta faol). Har qanday dizayn bo'sh ko'rinadi — bu texnik emas, kontent muammosi.
3. Takroriy oqimlar: 2 ta qidiruv (`/jobs` va `/search`), 2 ta vakansiya yaratish (`/post/vacancy` va
   `/employer/vacancies/new` + `/new/ai`), 3 ta saqlash jadvali, 2 ta moslash dvigateli (SQL v2 va eskirgan TS v1).
4. Vizual tizim tarqoq: brend qo'llanmasi Manrope deydi, kod Inter + Geist ishlatadi; asosiy ko'k `#1455D9`, yangi
   talab `#276FE5` + `#101D35`. `docs/` da 39 ta hujjat, ko'plari bir-birini takrorlaydi.
5. Yangi talabdagi ba'zi qismlar umuman yo'q: maoshlar sahifasi, intervyu kalendari va baholash, sertifikatlar,
   ish beruvchi analitikasi, obuna/tariflar modeli, SMS orqali tasdiqlash.

## 2. Texnologiyalar (tekshirilgan, `package.json`)

| Qatlam | Texnologiya | Holat |
| --- | --- | --- |
| Frontend | Next.js **16.4.5** (App Router, Server Actions, `src/proxy.ts`), React 19.2, TypeScript, Tailwind v4, Radix, Lucide | Saqlanadi |
| Backend | Supabase: Postgres + PostgREST + RLS, 297 SQL funksiya, `pg_cron` → `/api/cron/tick` | Saqlanadi |
| Auth | Telegram Login + Mini App `initData` HMAC; telefon kodi **Telegram bot orqali** (SMS emas); admin — parol + TOTP (aal2) | Saqlanadi |
| AI | Gemini → Claude fallback (`src/lib/ai/client.ts`), kunlik limit, `ai_usage_log` | Saqlanadi |
| To'lov | Payme, Click (`/api/payments/*`) — kod bor, hozir o'chiq (bepul rejim) | Keyin |
| Monitoring | `/api/health`, Sentry (faqat server, `SENTRY_DSN` bilan) — branchda, prod'da hali yo'q | Ega amali |
| Hosting | Vercel (`bom1`), GitHub Actions CI, shifrlangan DB zaxira | Saqlanadi |
| Test | 96 Vitest fayl (708 test), 47 Playwright spec (236 test), 38 SQL test | CI yashil |

Stekni almashtirishga texnik sabab yo'q. Talabdagi "Next.js + PostgreSQL/Supabase + Vercel" bilan to'liq mos.

## 3. Ishlayotgan narsalar (testlar bilan tasdiqlangan)

- Ro'yxatdan o'tish va kirish (Telegram, telefon kodi), rol tanlash, ikkinchi rolni qo'shish (`user_roles`, rejim almashtirish).
- Ish izlovchi onboarding'i 9 qadamda, **progress serverda saqlanadi** (`worker_profiles.onboarding_step`).
- Profil = CV: tajriba, ta'lim, ko'nikmalar, tillar, portfolio, PDF eksport (`/api/cv/pdf`).
- Vakansiya yaratish (4 qadamli wizard + AI matndan), moderatsiya, muddat, yopish.
- Qidiruv: kasb daraxti (`profession_nodes`), hudud/tuman, maosh, jadval, bandlik turi, tajriba.
- Ariza va holatlar: `sent → viewed → shortlisted → interview → offered → hired`, `rejected`, `withdrawn` — talabdagi 7 holatni to'liq qoplaydi.
- Ish beruvchi pipeline'i: arizalar ro'yxati, izohlar (`application_notes`), tarix (`application_events`), takliflar (`job_offers`), bitta intervyu vaqti.
- Moslash: `compute_match_v2` (izohli, versiyali, admin o'zgartiradigan vaznlar), 90%+ Telegram alert.
- Xabarlar (`conversations`, `messages`), bildirishnomalar (sayt + bot outbox).
- Admin: 26 bo'lim, 5 rol (`super_admin, admin, moderator, support, analyst`), aal2, audit jurnali, moderatsiya va tasdiqlash navbatlari.
- Xavfsizlik: RLS 83/83 jadvalda, rate limit, firibgarlik iboralari tekshiruvi, shikoyatlar, cheklovlar, aloqa maxfiyligi (0074).

## 4. Talab bo'yicha bo'shliqlar tahlili

### A. Ochiq sayt

| Talab | Hozir | Holat |
| --- | --- | --- |
| Bosh sahifa | `/` | BOR — yangi dizayn kerak; hero matni talabdagidan farq qiladi |
| Ish qidirish | `/jobs` **va** `/search?mode=jobs` | QISMAN — ikki tizim, bittaga birlashtirish |
| Vakansiya sahifasi | `/jobs/[slug]`, moslik: `/jobs/[slug]/moslik` | BOR |
| Kasblar katalogi | `/kasblar` | BOR |
| Hudud / shahar sahifalari | faqat `/jobs?region=` filtri | QISMAN — alohida SEO sahifalar yo'q |
| Kompaniyalar katalogi | `/companies` | PROD BUZUQ (0071 migratsiyasi kerak) |
| Kompaniya profili va sharhlar | `/company/[slug]`; `reviews` jadvali bor | QISMAN — sahifada sharhlar ko'rsatilmaydi |
| Maoshlar sahifasi | — | YO'Q (real ma'lumot yetarli bo'lgandagina, to'qima statistika mumkin emas) |
| Masofaviy / loyiha ishlari | filtr (`remote`, `freelance`) | QISMAN — alohida sahifa yo'q |
| Yordam, Biz haqimizda, Maxfiylik, Shartlar | `/help`, `/about`, `/privacy`, `/terms` | BOR |
| Aloqa (Contact) | — | YO'Q |
| Talabalar | `/students` | BOR (talabda yo'q, saqlanadi) |

### B. Ish izlovchi

| Talab | Hozir | Holat |
| --- | --- | --- |
| Boshqaruv paneli | `/cabinet` | BOR — yangi tuzilma kerak |
| Mening profilim / Skill Passport | `/profile`, `/profile/edit`, `/profile/cv`, `/profile/portfolio`; `worker_*` jadvallari | QISMAN — sertifikatlar va har bir ma'lumotning tasdiq darajasi yo'q |
| Ish qidirish, Tavsiyalar | `/search`, `/cabinet/matches`, `/ai-alerts` | BOR |
| Saqlangan, Arizalarim | `/saved`, `/applications` | BOR |
| Suhbatlar (intervyu) | `applications.interview_at` (bitta vaqt) | QISMAN — alohida sahifa, kalendar yo'q |
| Xabarlar, Sozlamalar, Bildirishnomalar | `/messages`, `/settings`, `/notifications` | BOR |
| Takliflar | `/offers` | BOR |
| Onboarding 13 qadam | 9 qadam, progress saqlanadi | QISMAN — tuzilma talabdan farq qiladi |
| SMS orqali tasdiqlash | kod Telegram bot orqali keladi | YO'Q — SMS provayder (masalan Eskiz) shartnomasi va kaliti kerak |
| 3 qadamli ariza | ariza oynasi (bir qadam) | QISMAN |
| Screener savollari | — | YO'Q |

### C. Ish beruvchi

| Talab | Hozir | Holat |
| --- | --- | --- |
| Umumiy ko'rinish | `/employer` | BOR |
| Vakansiyalar, yaratish | `/employer/vacancies`, `/employer/vacancies/new`, `/new/ai`, **`/post/vacancy`** | QISMAN — ikki yaratish oqimi, bittaga birlashtirish |
| Nomzodlar bazasi, aqlli qidiruv | `/workers`, `/search?mode=workers`, `/employer/candidates` | BOR |
| Saqlangan nomzodlar | `/employer/saved` (`saved_workers`) | BOR |
| Yollash jarayoni (pipeline) | `/employer/applications`, `/employer/vacancies/[id]/applications` | BOR — vizual kanban yo'q |
| Suhbatlar, baholash, fikr | `schedule_interview` (bitta vaqt + joy) | QISMAN — `interviews`, `interview_feedback`, baholash yo'q |
| Kompaniya profili, Jamoa | `/company/settings`, `/company/join`, `company_members`, `company_invites` | BOR |
| Analitika | vakansiya ko'rishlari bor, alohida sahifa yo'q | QISMAN |
| Tariflar va to'lovlar | `/pricing`, `/billing` (o'chiq) | BOR (yoqilmagan) |
| Onboarding | `/onboarding/employer` | BOR — STIR tekshiruvi qo'lda (admin) |

### D. Admin

| Talab | Hozir | Holat |
| --- | --- | --- |
| Dashboard, Users, Employers, Vacancies, Categories, Professions, Regions, Verification, Reports, Moderation, Payments, Analytics, Audit, Settings, Security | `/admin/...` (26 bo'lim) | BOR |
| Companies | `/admin/employers` ichida | QISMAN |
| Applications | — | YO'Q (alohida bo'lim) |
| Subscriptions | — | YO'Q (obuna modeli yo'q) |

### E. Umumiy modullar va ma'lumotlar bazasi

| Talabdagi jadval | Hozirgi ekvivalent | Holat |
| --- | --- | --- |
| users, user_roles, profiles | `auth.users`, `user_roles`, `profiles` | BOR |
| experiences, educations, portfolios | `worker_experience`, `worker_education`, `worker_portfolio` | BOR |
| skills, user_skills | `skills`, `worker_skills` | BOR |
| certifications | — | YO'Q |
| companies, company_members | `companies`, `company_members`, `company_invites` | BOR |
| jobs, job_categories, job_skills | `vacancies`, `profession_nodes` + `categories`, `vacancy_skills` | BOR (nomlari boshqa) |
| applications, application_events | shu nomlar bilan | BOR |
| saved_jobs, saved_candidates | `saved_vacancies`, `saved_workers` **va** `saved_items` | QISMAN — 3 jadval, bittaga birlashtirish |
| candidate_notes | `application_notes` (arizaga bog'liq, nomzodga emas) | QISMAN |
| interviews, interview_feedback | `applications.interview_at/place` | YO'Q |
| conversations, messages, notifications | shu nomlar bilan | BOR |
| verifications, reports, moderation_actions | `verification_requests`, `reports`, `moderation_checks` + `audit_logs` | BOR |
| plans, subscriptions, transactions | `payments`, `wallets`, `wallet_ledger`, `billing_usage` | QISMAN — tarif/obuna modeli yo'q |
| audit_logs | `audit_logs`, `security_events` | BOR |

Qoida: mavjud jadvallar talabdagi nomlarga **qayta nomlanmaydi** — bu prod ma'lumotlarni va 297 funksiyani xavf ostiga qo'yadi.
Faqat yetishmaganlari qo'shiladi (`interviews`, `interview_feedback`, `worker_certifications`, `plans`, `subscriptions`).

### F. AI

| Talab | Hozir | Holat |
| --- | --- | --- |
| CV yordamchisi, AI onboarding | `/onboarding/worker/ai`, `/ai` | BOR |
| Vakansiya matnidan yaratish | `/employer/vacancies/new/ai` | BOR |
| Moslash va izoh | `compute_match_v2`, `/jobs/[slug]/moslik` | BOR |
| Nomzod xulosasi, intervyu savollari, ko'nikma bo'shlig'i | — | YO'Q |
| Himoyalangan belgilarni ishlatmaslik | moslash omillarida jins/din/millat yo'q | BOR (tekshirildi: 0050 omillari) |

## 5. Xavflar va texnik qarz

| Xavf | Dalil | Ta'sir |
| --- | --- | --- |
| Kod va prod baza nomuvofiqligi | 0069–0075 prod'da yo'q | Sahifalar buziladi. Ega amali: `docs/RELEASE_CHECKLIST.md` |
| Bo'sh bozor | prod'da 0 faol vakansiya | Dizayn qanchalik yaxshi bo'lmasin, sayt bo'sh ko'rinadi |
| Ikki qidiruv tizimi | `/jobs` va `/search` | Turli natija, ikki baravar test va dizayn ishi |
| Ikki vakansiya oqimi | `/post/vacancy` va `/employer/vacancies/new` | Bir xil ma'lumot ikki xil so'raladi |
| Eskirgan TS moslash dvigateli | `src/features/matching/README.md`: v1, 18 paritet testi skip | Kelajakda noto'g'ri ball xavfi (runtime ishlatmaydi) |
| Hujjatlar ko'pligi | `docs/` da 39 fayl, bir nechta REDESIGN/AUDIT | Qaysi biri amalda — noaniq. Yangi 8 hujjat asosiy bo'ladi, eskilari `docs/archive/` ga |
| Rang kontrasti | `#16A378` oqda 3.2:1, `#276FE5` Cloud fonda 4.3:1 | Matn uchun to'q variantlar kerak (`docs/DESIGN_SYSTEM.md`) |
| Namuna rasmdagi soxta raqamlar | "10K+ faol e'lon", "12 540 ta ish", "4.8 (247 baho)" | Ko'chirilmaydi: faqat haqiqiy hisoblangan raqam |
| SMS yo'q | kod Telegram orqali | Telegram'siz foydalanuvchi kira olmaydi. SMS — pullik provayder |

## 6. Ko'rib bo'lmagan narsalar (TEKSHIRILMAGAN)

- Prod bazaning haqiqiy holati (kirish yo'q) — `scripts/prod-migration-check.sql` bilan ega tekshiradi.
- Supabase Auth sozlamalari (e-mail ro'yxatdan o'tish yopiqmi), storage zaxiralari.
- Real foydalanuvchi tezlik ko'rsatkichlari (RUM) — yig'ilmagan; laboratoriya o'lchovlari `docs/PERFORMANCE_BASELINE.md` da.
