# «Ish beruvchi» — mahsulot va arxitektura auditi

Ushbu hujjat "dunyo darajasidagi ish platformasi" talablar ro'yxatini (119 band) mavjud kod bilan solishtiradi.
Har bir yo'nalish uchun: **HOZIRGI HOLAT → MUAMMO → YECHIM**. Tamoyil: ishlab turgan narsani buzmaslik,
faqat haqiqiy bo'shliqlarni to'ldirish, har bir migratsiyadan keyin ilova ishlaydigan holatda qolishi.

Stek: Next.js 16 (App Router, server actions) · Supabase (Postgres + RLS + security-definer RPC, pg_cron) ·
uz/ru i18n (`messages/`) · Telegram Mini App + PWA · Gemini/Claude (ixtiyoriy AI) · Payme/Click.

## 1. Allaqachon mavjud va ishlaydi (saqlandi)

| Yo'nalish | Qayerda |
|---|---|
| Ikki asosiy tugma (Ish qidiryapman / Ishchi qidiryapman), birinchi kirishda til + qisqa tanishtiruv | `features/landing`, `components/shared/welcome-gate.tsx` |
| Rolga qarab bosh sahifa (ishchi / ish beruvchi) | `app/page.tsx`, `features/worker`, `features/employer/components/dashboard` |
| Kasblar daraxti: soha → kasb → ko'nikma, admin tahrirlaydi | `0002`, `0012`, `admin/categories`, `admin/skills` |
| Bittadan savol beriladigan onboarding + AI bilan "o'zingiz haqingizda yozing" | `components/shared/question-flow.tsx`, `app/onboarding/worker/ai` |
| Avtomatik CV va to'liqlik foizi | `worker_completeness()`, `app/profile/cv` |
| AI bilan bir gapdan vakansiya + qadamma-qadam wizard (har qadam serverda saqlanadi) | `features/ai`, `features/vacancies/components/wizard` |
| Ikki tomonlama moslik dvigateli (SQL + TS parity testlari, sabablar bilan) | `compute_match`, `features/matching` |
| Filtrlar: tezkor chiplar, sheet, faol filtrlar soni, tozalash | `features/jobs/components/filters-bar.tsx` |
| Arizalar (8 holat, tarix), taklif, chat (bloklash, shikoyat), bildirishnomalar (Telegram) | `features/applications`, `features/offers`, `features/chat`, `features/notifications` |
| Telefon maxfiyligi (`phone_visibility`, `contact_grants`) | `0008`, sozlamalar |
| Shikoyatlar, moderatsiya holatlari, audit log, admin RBAC | `reports`, `audit_logs`, `features/admin` |
| Rate limit (ariza, xabar, qidiruv, AI, to'lov) | `check_rate_limit` |
| To'lovlar: Payme/Click, idempotent, server tekshiruvi | `0019_billing.sql`, `app/api/payments` |
| SEO: metadata, JobPosting JSON-LD, OG rasm | `features/jobs/metadata.ts`, `api/promo` |

## 2. Shu bosqichda yopilgan bo'shliqlar

### 2.1 Qidiruv odam tilini tushunmasdi
- **Hozirgi holat:** tsquery + `ilike`; faqat kasb nomi 1:1 mos kelsa kategoriya qo'yilardi.
- **Muammo:** "chilonzorda sotuvchi", "svarchik", "kunlik 300 ming", "uydan ishlaydigan operator" kabi so'rovlar natija bermasdi yoki noaniq natija berardi.
- **Yechim:**
  - `features/search/understand.ts`: AI'siz, deterministik tahlil.
    - Kirill → lotin, apostroflar, o'zbek va rus qo'shimchalari ("-da", "-lar", "-а").
    - Nimalarni taniydi: kasb (sinonimlar bilan), tuman/viloyat, grafik, bandlik turi, masofaviy ish, tajribasiz, tajriba yili, maosh ("5 mln", "300 ming", "$500"; kunlik/soatlik).
  - Tanilgan qismlar oddiy URL filtrlariga aylanadi: foydalanuvchi ularni ko'radi va bittadan olib tashlay oladi. Tanilmagan so'zlar matn qidiruviga qoladi. "Aynan shu so'z bilan qidirish" havolasi (`exact=1`) bor.
  - Ish qidiruvchi (`/jobs`) va ish beruvchi (`/workers`) qidiruvida bir xil ishlaydi.
  - `subcategories.aliases`: 120+ kasb uchun 530+ sinonim, admin formada tahrirlanadi, kod o'zgarmaydi.
  - +51 yangi kasb qo'shildi: payvandchi, ekskavatorchi, CCTV, bosh oshpaz, pogruzchik, mardikor va boshqalar.
  - Maosh filtri normallashtirildi: kunlik ×22, soatlik ×176 (`salary_monthly_equivalent`).
- **Testlar:** `understand.test.ts`, `apply.test.ts`, `supabase/tests/search.test.sql`.

### 2.2 "Hech narsa topilmadi" tupik edi
- **Yechim:** `SmartEmptyState`. Har bir faol filtr bittadan olib tashlanib, **haqiqiy** natijalar soni hisoblanadi: "Maosh chegarasini olib tashlash → 12 ta". Soxta raqam ko'rsatilmaydi.

### 2.3 Natijasiz qidiruvlar ko'rinmasdi
- **Yechim:**
  - `search_logs` jadvali: faqat server yozadi, faqat `analytics.view` huquqli admin o'qiydi, 90 kundan keyin tozalanadi.
  - `admin/search` sahifasi: eng ko'p natijasiz qolgan so'rovlarni ko'rsatadi, admin ulardan sinonim qo'shadi.

### 2.4 E'lon sifati tekshirilmasdi
- **Yechim:**
  - `features/vacancies/quality.ts` (deterministik) tekshiradi:
    - oldindan pul so'rash belgilari;
    - matnda telefon yoki havola;
    - maosh yo'q yoki g'ayrioddiy;
    - qisqa tavsif;
    - KATTA HARFLAR va "!!!";
    - ko'nikma, manzil yoki ish vaqti yo'q.
  - Natija texnik ogohlantirish emas, amaliy maslahat ("Tuzatish" havolasi bilan) sifatida ko'rsatiladi.
  - **Serverda:** `vacancy_risk_flags()` firibgarlik belgisi bo'lgan e'lonni avtomatik `pending_review` holatiga o'tkazadi va `moderation_note = auto:scam_words` yozadi.
    - E'lon o'chirilmaydi va bloklanmaydi.
    - Matn tuzatilsa, izoh o'z-o'zidan olib tashlanadi.
- **Takroriy e'lon:** `similar_vacancies()` (pg_trgm) ish beruvchining o'ziga o'xshash faol e'lonini ko'rsatadi, faqat ogohlantirish sifatida.
- **Maosh tavsiyasi:** `salary_insight()` faqat haqiqiy faol e'lonlardan hisoblanadi.
  - Kamida 5 ta e'lon bo'lsa "odatda X–Y" ko'rsatiladi; kam bo'lsa hech narsa ko'rsatilmaydi.
  - Bosilsa oraliq maydonlarga qo'yiladi.

### 2.5 Moslik soxta aniqlik bilan ko'rsatilardi
- **Hozirgi holat:** "Sizga 73% mos".
- **Yechim:** "Juda mos / Mos / Qisman mos / Kam mos" va sabablar ro'yxati. Foiz faqat yordamchi `title` sifatida qoladi.

## 3. Ikkinchi bosqich (bajarildi)

1. **Saqlangan qidiruv + kunlik xabar** — `saved_searches`, `run_saved_search_alerts` (pg_cron 09:05), "N ta yangi" belgisi (`0021`).
2. **Telefon so'rash** — `contact_requests`: so'rov → ruxsat / rad (7 kun kutish, kuniga 30 ta), ikki tomonga bildirishnoma (`0022`).
3. **Ish beruvchi pipeline'i** — suhbat sanasi/joyi (`schedule_interview`, Toshkent vaqti), ommaviy saralash/rad etish, shaxsiy izohlar (nomzod ko'rmaydi) (`0023`).
4. **Kasbga qarab savollar** — `skill_questions`: haydovchi toifasi, buxgalteriya dasturlari, IT stek, oshxona... javob = ko'nikma (`0024`).
5. **Hisobni o'chirish** — to'lovlar ismsiz saqlanadi, egasiz vakansiyalar yopiladi, audit; `sitemap.xml`, `robots.txt`, umumiy xato sahifalari (`0025`).
6. **Xavfsizlik** — logotiplarda SVG taqiqlandi (stored XSS), vakansiya yaratishga cheklov: soatiga 10, sutkasiga 30 (`0026`).
7. **Telegram bot ichida CV** — `/cv`: tugmali savol-javob (orqaga, o'tkazib yuborish, kasbga mos ko'nikmalar) → profil saqlanadi → professional PDF CV chatga yuboriladi → `/jobs` mos vakansiyalar (moslik darajasi, «Yana 5 ta», «🔔 Xabar berish»); `/pdf` — CV'ni qayta olish. Holat `bot_sessions` da, faqat server (`0027`, `features/bot`).

## 4. Keyingi imkoniyatlar

- Filial (branch) va jamoa huquqlarini nozik taqsimlash; obuna/entitlement arxitekturasi.
- Chatda tezkor javoblar; bildirishnoma sozlamalari (tur/kanal bo'yicha).
- "Qaysi kasb sizga mos?" yo'naltiruvchi; kompaniyalarni kuzatish.
- Admin panelda kasb savollarini tahrirlash sahifasi (hozir jadval RLS bilan tayyor, UI yo'q).

## 5. Tamoyillar (har bir o'zgarishda tekshiriladi)
- AI ixtiyoriy: qidiruv, filtrlar, vakansiya yaratish va ariza AI'siz ham ishlaydi.
- Mijoz rolga ishonilmaydi: hamma cheklov RLS va security-definer RPC'da.
- Soxta raqam, soxta belgi, soxta shoshilinchlik yo'q: statistika faqat haqiqiy ma'lumotdan olinadi, yetarli bo'lmasa ko'rsatilmaydi.
- Foydalanuvchidan tizim o'zi bilishi mumkin bo'lgan narsa so'ralmaydi.
