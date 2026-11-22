# ISH TOPDIM 2.0 — 1-bosqich yakuniy hisoboti (2026-11-22)

Branch: `feat/ish-topdim-2`. Audit: `docs/ISH_TOPDIM_2_AUDIT.md`.

Bu bosqich egasining 5 ta ustuvor talabiga qaratilgan: qidiruv, matnlar, haqiqiylik, ma'lumotlar, tekshiruv.
"Master prompt"ning qolgan bandlari egasining yaqindagi tanlovlariga zid. Ular audit §7 da sanab o'tilgan va
tasdiqlansa, alohida bosqichda qilinadi.

## 1. Nimalar tekshirildi?

- **Prod Supabase (faqat o'qish):**
  - migratsiyalar holati (0068…0088);
  - jadvallardagi yozuvlar soni;
  - tarif — Free, ya'ni avtomatik backup yo'q;
  - qidiruv jurnali (`search_logs`);
  - Supabase xavfsizlik va tezlik maslahatlari.
- **Qidiruv yo'li to'liq:**
  - chat (`start-chat/guided*.ts`) → server amallari (`find/quick-*.ts`);
  - tushunish: `find/intent.ts`, `search/understand.ts`, `find/queries.ts`;
  - SQL funksiyalari: `simple_search_vacancies`, `search_vacancies_v2`, `search_profession_nodes`.
- **Matnlar:** 31 sahifa/holat × 14 sozlama (320…1920px, uz/ru/oz, katta shrift).
- **Haqiqiylik:** qo'lda yozilgan raqamlar, namuna e'lonlar belgisi, sharh/reyting manbai, AI rasm belgilari.
- **Moderatsiya qoidalari:** benchmark ma'lumotida tasodifan topildi (§2, H1).

## 2. Qanday muammolar topildi?

To'liq jadval — auditda. Qisqacha:

| # | Muammo | Ustuvorlik | Holat |
|---|---|---|---|
| Q1 | "ish kerak" / "работа" — "hammasi" varianti yo'q, natija chiqmaydi | Yuqori | Tuzatildi |
| Q2 | "kuryer" faqat "Piyoda kuryer"ni qidiradi | Yuqori | Tuzatildi |
| H1 | "Sex boshlig'i" ("цех") e'loni yashiriladi, egasi **bloklanadi** | Yuqori | Tuzatildi |
| Q3 | Bo'sh natijada shu kasbga tegishli boshqa e'lonlar ko'rinmaydi | O'rta | Tuzatildi |
| Q4 | Bo'sh natijada boshqa qidiruv taklif qilinmaydi | O'rta | Tuzatildi |
| Q5 | "manual qa" → "Manual terapevt" | O'rta | Tuzatildi |
| M1–M3 | Katta shriftda: profilda telefon tugma ostida, tariflarda narx pastki qatorga tegadi | O'rta | Tuzatildi |
| Q6–Q7 | "grushik", "vakansiya" | Past | Tuzatildi |
| Q8 | "baliqchi" — tuman nomi ham | Past | Ataylab qoldirildi |
| Q9 | Ikkinchi so'zdagi imlo xatosi ("o'qituvchi matimatika") | Past | Qoldi |

## 3. Nimalar o'zgartirildi?

- **Chat:**
  - "Kasbingiz qanday?" da birinchi tugma «Hamma ishlar» / «Hamma ishchilar».
  - "farqi yo'q", "hammasi", "любая" kabi javoblar ham shu ma'noda tushuniladi.
  - Bo'sh natijada — "Hozir shu kasblarda ish bor:" takliflari, soni bilan.
- **Qidiruv:**
  - Butun soha so'zlari kategoriya bo'yicha qidiriladi.
  - Bo'sh natijada kasbga tegishli so'z e'lon nomlarida qidiriladi.
  - Qisqa kasb so'zlari va xalq yozuvi tushuniladi.
  - "vakansiya" kalit so'z emas.
- **Moderatsiya:** yalang'och "sex" so'zi qoidadan olindi (o'zbekcha "цех").
- **Matnlar:**
  - Profil kartasidagi tahrirlash tugmasi burchakka ko'chirildi, uzun ism keyingi qatorga o'tadi.
  - Tariflardagi narx qatori balandligi tuzatildi.
- **Testlar va vositalar:**
  - Keng audit kengaytirildi: 11 kenglik va chat sahifalari, `AUDIT_ONLY` filtri.
  - CI audit testiga 768 va 1920 qo'shildi.
  - Yangi e2e test: `search-quality.spec.ts`.
  - Qidiruv benchmarki: `scripts/search-bench/`.

## 4. Qaysi fayllar o'zgardi?

- **Qidiruv:**
  - `src/features/find/families.ts` (yangi);
  - `quick-core.ts`, `quick-types.ts`, `quick-actions.ts`;
  - `queries.ts` (`findJobsInCategory`, `getNodeTerms`);
  - `intent.ts`, `ai-keywords.ts`.
- **Chat:**
  - `src/features/start-chat/guided.ts`, `guided-logic.ts`, `actions.ts` (`chatProfessionsWithListings`);
  - `components/start-chat.tsx`, `components/chat-pickers.tsx`.
- **Moderatsiya:** `src/features/moderation/rules.ts`.
- **Matnlar:** `src/features/cabinet/components/cabinet-page.tsx`, `src/app/pricing/page.tsx`.
- **i18n:** `messages/{uz,ru,en,oz}/easy.json` — `guided.any_jobs`, `any_workers`, `suggest_jobs`,
  `suggest_workers`.
- **Testlar:**
  - unit: `find/families.test.ts` (yangi), `find/intent.test.ts`, `start-chat/guided-logic.test.ts`,
    `moderation/rules.test.ts`;
  - e2e: `e2e/specs/search-quality.spec.ts` (yangi), `layout-overlap.spec.ts`, `e2e/screens/overlap.audit.ts`.
- **Benchmark:** `scripts/search-bench/{seed.sql,bench.test.ts,vitest.config.ts}`, `package.json`
  (`bench:search`).
- **Hujjatlar:** `docs/ISH_TOPDIM_2_AUDIT.md`, shu fayl, `docs/CHANGELOG.md`.

## 5. Qaysi yangi komponentlar yaratildi?

- `Suggested` (start-chat.tsx ichida) — bo'sh natijadagi "Hozir shu kasblarda ish bor" tugmalari.
- `ProfessionChoices` ga `lead` (birinchi qo'shimcha tanlov) xususiyati qo'shildi.
- Server amali `chatProfessionsWithListings`.
- `findJobsInCategory` — soha bo'yicha qidiruv (mavjud `search_vacancies_v2` funksiyasi orqali, migratsiyasiz).

## 6. Qidiruv algoritmi qanday ishlaydi?

1. **Maqsad.** "ish kerak" → ish qidiryapti; "menga haydovchi kerak" → ishchi qidiryapti. Aniq bo'lmasa — bitta savol.
2. **Butun soha?** So'rovda to'ldiruvchi so'z va hudud nomidan boshqa so'z faqat soha so'zi bo'lsa ("kuryer",
   "IT", "call-markaz"), shu kategoriyaning hamma vakansiyalari olinadi (`families.ts`).
3. **Kasb.** Matn bo'laklarga ajratiladi: ibora → juftlar → so'zlar → qo'shimchasiz o'zak → kirill shakli. Har bo'lak
   kasblar daraxtida qidiriladi: lotin/rus/ingliz nomlari va sinonimlar, `uz_fold` kirill→lotin.
   - **Ball:** moslik + uzunlik + kasbning o'z nomi bonusi + gapdagi so'zlarni qamrashi.
   - Topilmasa — imlo xatosi tuzatiladi (1–2 harf farq).
   - Bazada AI kaliti bo'lsa, uzun gaplarda AI faqat so'zlarni ajratadi. Kasb va natijalar doim bazadan.
4. **Qidiruv.** Kasb va uning ichidagi kasblar (`profession_subtree`), hudud (viloyat/tuman), filtrlar.
   - **Tartib:** TOP (belgisi bilan) → aniq tuman → eng yangi.
   - Muddati o'tgan va faol bo'lmagan e'lonlar chiqmaydi.
5. **Bo'sh bo'lsa (shu tartibda):**
   1. ota-kasb shu hududda;
   2. kasbga tegishli so'z e'lon nomlarida;
   3. ota-kasb butun O'zbekistonda;
   4. shu kasb boshqa viloyatlarda;
   5. "Hozir shu kasblarda ish bor" takliflari.

   Hammasi haqiqiy e'lonlar. "Shunga yaqin" deb alohida belgilanadi.
6. **Hamma ishlar** — kasbsiz, faqat hudud va filtrlar bilan.

## 7. Qaysi testlar bajarildi? 8. Qaysi testlar o'tdi?

Lokal stendda, 2026-11-22. CI natijasi PR'da alohida ko'rinadi.

| Test | Natija |
|---|---|
| `tsc --noEmit` | ✅ xatosiz |
| `eslint .` | ✅ xatosiz |
| `vitest` (unit, 143 fayl) | ✅ 1084 o'tdi, 18 o'tkazib yuborilgan (avvaldan). `telegram/webhook/web-login.test.ts` bir marta yiqildi: kompyuter og'ir yuklangan paytda, kenglik auditi bilan bir vaqtda. Alohida va qayta ishga tushirilganda o'tdi |
| Yangi unit testlar | ✅ `families.test.ts` (soha so'zlari, tegishli so'zlar), `guided-logic.test.ts` ("Hamma ishlar", "любая"), `intent.test.ts` ("manual qa", "grushik"), `rules.test.ts` ("Sex boshlig'i", "tikuv sexi" — toza; "sexy", "sexual" — bloklanadi) |
| E2E to'liq (394 test) | 392 o'tdi, 2 yiqildi. Ikkalasining sababi bir: men ishga tushirgan kenglik auditi (`e2e/screens/demo-seed.ts`) stendda namunaviy ishchi e'lonini qoldirgan, va "Sotuvchi" ishchilar soni 1 taga ko'p chiqqan. Audit tozalashi tuzatildi (`cleanDemo`). Shu 2 spec qayta ishga tushirildi: ✅ 11/11 |
| Yangi e2e: `search-quality.spec.ts` | ✅ 5/5: "ish kerak" → Hamma ishlar; "работа" + "любая"; "voditel"; "kuryer" (butun soha); topilmadi → takliflar |
| Kenglik auditi (`overlap.audit.ts`) | 434 tekshiruvda 3 muammo topildi → tuzatildi → shu sahifalar 14 sozlamada qayta tekshirildi: ✅ 0 |
| Qidiruv benchmarki (`npm run bench:search`) | ✅ 84/84 so'rov to'g'ri; p50 49 ms, p95 172 ms (1224 vakansiya, lokal). `seed.sql` boshqa bazada xato bilan to'xtashi tekshirildi |
| Vizual tekshiruv | ✅ Skrinshotlar ko'rib chiqildi: "Kasbingiz qanday?" (Hamma ishlar), natijalar, kuryer, "topilmadi" + takliflar, profil va tariflar (katta shrift) |

## 9. Qaysi xatolar qolgan?

- **Q8 "baliqchi"** — tuman nomi ham. Hudud deb tushuniladi.
- **Q9** — ikkinchi so'zdagi imlo xatosi tuzatilmaydi.
- **Soha bo'yicha qidiruv kartalarida egasi ko'rinmaydi.** Shaxs sifatida joylagan ish beruvchining ismi
  ko'rsatilmaydi: `search_vacancies_v2` faqat kompaniya nomini qaytaradi. Tuzatish uchun migratsiya kerak.
- **Supabase maslahatlari (audit §6):**
  - `search_path` 5 ta funksiyada;
  - RLS initplan (tezlik);
  - "Leaked password protection" — egasi Dashboard'da yoqadi.
- **Ishchi qidirishda soha bo'yicha qidiruv yo'q** (faqat aniq kasb).

## 10. Production uchun nima kerak?

- **Shu bosqich uchun migratsiya kerak emas.** Faqat kod: PR → CI → egasi ruxsati → merge → Vercel.
- **Backup:** Supabase Free tarifida avtomatik zaxira yo'q. Bazaga tegadigan keyingi bosqichlardan oldin:
  - `supabase db dump` (CLI), yoki
  - muhim jadvallarni CSV qilib yuklab olish, yoki
  - Pro tarifga o'tish (kunlik backup, 7 kun).
- **OpenAI balansi:** to'ldirish kerak (e'lon va kasb rasmlari; Vercel loglarida `provider_http_429`).

## 11. Keyingi rivojlantirish tavsiyalari

1. **Sinonimlarni boshqarish.** Natijasiz qidiruvlar (`search_logs`, `results_count = 0`) bo'yicha admin panelda
   haftalik ro'yxat va bir bosishda sinonim qo'shish (hozir sinonimlar bazada, kasblar daraxti tahririda).
2. **Soha bo'yicha ishchi qidirish** va soha kartalarida ish beruvchi ismi (`search_vacancies_v2` ga
   `display_name` — migratsiya).
3. **Ikki so'zli imlo tuzatish** ("o'qituvchi matimatika" → "Matematika o'qituvchisi").
4. **Supabase:** `search_path` (5 funksiya), RLS initplan — bitta xavfsiz migratsiyada, `pending.sql` orqali.
5. Master promptdagi bosh sahifa, menyu va rang bo'yicha takliflar — egasi tasdiqlasa, alohida bosqichda,
   variantlar va skrinshotlar bilan.
