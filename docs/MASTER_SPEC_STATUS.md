# Ish Beruvchi — ULTRA MASTER spetsifikatsiyasi bo'yicha holat

Sana: 2026-10-06. Belgilar: **tayyor** — kodda bor va avtomatik test/qo'lda E2E bilan tekshirilgan;
**qisman** — asosiy qismi bor, lekin spetsifikatsiyaning bir bo'lagi yo'q yoki faqat avtomatik tekshirilgan;
**bloklangan** — tashqi ma'lumot, odam yoki infratuzilma kerak.

Bu hujjat "hammasi tayyor" degan da'vo emas. Real odamlar bilan UX sinovi **o'tkazilmagan**;
yuklama (load) o'lchovi **o'tkazilmagan**.

## Qisqa texnik qarorlar

| Qaror | Sabab |
| --- | --- |
| Admin panel va to'lovlar o'chirilmadi, **flag** ortiga yashirildi (`ADMIN_UI_ENABLED`, `BILLING_ENABLED`, DB: `app_settings.billing_enabled=false`) | Spetsifikatsiya ularni ilovada taqiqlaydi, lekin kod va ma'lumotlar keyingi bosqich uchun kerak. Flag o'chiq: `/admin` va `/pricing` → 404, e'lonlar bepul 30 kunga chiqadi, `payments` ga mijoz rolidan yozish trigger bilan bloklangan |
| Kirill (`oz`) tarjima o'zbek lotin matnidan **mexanik transliteratsiya** (`src/lib/i18n/translit.ts`) + qo'lda tuzatishlar (`messages/oz-overrides.json`) | Uch tilni sinxron saqlash; hudud nomlari bazadagi rasmiy `name_oz` dan olinadi |
| Ingliz tili (`en`) o'chirilmadi, lekin til ekranida faqat kichik havola | Avvalgi foydalanuvchilar uchun; asosiy tillar uz-Latn, uz-Cyrl, ru |
| Bir xil nomli shahar/tuman: mavjud yozuv **shaharga** biriktirildi, tuman yangi yozuv sifatida qo'shildi (`*_district`) | Mavjud vakansiya/profillar odatda shaharni nazarda tutgan; ko'chirish ehtimoli kamroq xato |
| Moslik foizi olib tashlandi, faqat sabab yorliqlari | Kalibrlanmagan % foydalanuvchini chalg'itadi |
| Imkoniyat turi (`opportunity_type`) bandlik turi va ish formatidan alohida ustun | Spetsifikatsiya talabi; to'lanmaydigan faqat stajirovka/amaliyot/shogirdlik bo'lishi DB constraint bilan |
| Qo'lda yozilgan kasb e'lonni to'xtatmaydi: `custom_profession` saqlanadi, `custom_occupation_requests` navbatiga tushadi | Katalogga qo'shish va e'lonni faollashtirish alohida jarayon |

## Bo'limlar

| § | Mavzu | Holat | Izoh |
| --- | --- | --- | --- |
| 2 | Reliz chegarasi: admin/to'lov/chet el yo'q | tayyor | Flag o'chiq; `/pricing` 404, ishchi uchun `/admin` 404, sitemap/robots tozalangan. `en` lokali qolgan (bozor emas, til) |
| 5 | Til → maqsad → yo'l | tayyor | Tillar o'z yozuvida, bayroqsiz |
| 6 | Hududlar (SOATO) | qisman | 208 birlik (177 tuman + 31 shahar), barchasida SOATO. Rasmiy saytlar (stat.uz, soliq.uz) konteynerdan **ochilmadi**, ikki ochiq GitHub to'plami solishtirildi — `docs/GEO_COVERAGE.md`. Rasmiy manba bilan qayta tekshirish kerak |
| 7 | Ish beruvchi bosh sahifasi | tayyor | Katta "+ Vakansiya joylashtirish", 3 ko'rsatkich |
| 8 | Vakansiya ustasi | tayyor | Imkoniyat turi, haq to'lanadimi, talabalarga mos; maosh davri va "Kelishiladi" |
| 9 | Nomzod bosh sahifasi | tayyor | 2 katta karta + ixcham havolalar + talabalar kirish nuqtasi (E2E skrinshot, uz va oz) |
| 10 | Ish qidirish e'loni | tayyor | `/profile/listing`: tayyorlik, 8 bo'lim, ko'rinish (qidiruvda / faqat ariza berganlarimga / yashirin), "Ish topdim" |
| 11 | Vakansiya kartasi | tayyor | Imkoniyat va "Haq to'lanmaydi" belgisi |
| 12 | Ariza/taklif | tayyor | Ariza va taklif alohida; `unique(vacancy_id, worker_id)` |
| 13 | Talabalar | tayyor | `/students`, filtrlar `opportunity[]`, `students=1` |
| 14 | Kasblar katalogi | qisman | 1303 tugun, 38 yo'nalish, sinonim/xato yozuvlar. ISCO/ESCO kodlari **biriktirilmagan**; 4 ta yupqa yo'nalish va ba'zi yaqin-dublikat tugunlar bor — `docs/CATALOG_COVERAGE.md` |
| 15 | Aqlli qidiruv | qisman | pg_trgm + sinonimlar; `catalog_search.test.sql` (16 holat). "Usta" bir nechta kasb beradi, lekin avval yo'nalish tanlatuvchi alohida ekran yo'q |
| 16 | Moslik va AI | tayyor | Sabab yorliqlari; AI faqat to'ldirish yordamchisi, AI o'chsa oddiy qidiruv ishlaydi |
| 18 | Yordam, tur, video | qisman | `/help` + turni qayta ochish tayyor. **Video qo'llanmalar yo'q** — soxta havola qo'yilmadi; videolar yozilishi kerak |
| 22 | Telegram Mini App | tayyor | initData HMAC + muddat tekshiruvi (`src/lib/telegram/verify.ts`). Bot tilini `oz` uchun yangilash uchun setup so'rovini qayta yuborish kerak |
| 23 | Maxfiylik | tayyor | RLS + SQL xavfsizlik testlari |
| 24 | Million foydalanuvchi o'lchovi | bloklangan | Yuklama testi va tiklash sinovi o'tkazilmagan |

## 38 ta majburiy qabul sinovi

| # | Holat | Dalil / izoh |
| --- | --- | --- |
| 01 | tayyor | welcome-gate: til → rol |
| 02 | tayyor | `onboarding_completed_at` bo'lsa bosh sahifa (E2E) |
| 03 | tayyor | Viloyat/tuman qo'lda tanlanadi, GPS ixtiyoriy |
| 04 | tayyor | Toshkent shahri va viloyati alohida; bir xil nomlilar `kind` bilan ajratilgan |
| 05 | tayyor | GPS faqat foydalanuvchi bosganda, kompaniya manzili sifatida yashirin saqlanmaydi |
| 06 | tayyor | 6 tur; shaxs/o'zini o'zi band qilgandan kompaniya nomi va STIR so'ralmaydi |
| 07 | tayyor | E2E skrinshot |
| 08 | qisman | "usta" → bir nechta kasb (test), lekin yo'nalish bosqichi ekrani alohida emas |
| 09 | tayyor | `catalog_search.test.sql`: "prava oqituvchi" → Avtoinstruktor, "medsestra" → Hamshira |
| 10 | tayyor | "Topilmadimi? O'zingiz yozing" → asl matn + soha + navbat yozuvi |
| 11 | qisman | Lotin va ruscha translit xatolar test qilingan; kirill yozuvdagi so'rovlar uchun alohida test to'plami yo'q |
| 12 | tayyor | Qidiruv va e'lon AI'siz ishlaydi |
| 13 | tayyor | AI natija yaratmaydi, faqat mavjud ID'lardan tanlaydi |
| 14 | tayyor | Filtrdagi hudud ustun |
| 15 | tayyor | Koordinatasiz/remote uchun masofa ko'rsatilmaydi |
| 16 | tayyor | Server-side saqlash, `flows.test.sql` |
| 17 | tayyor | Zod + DB constraint |
| 18 | qisman | Tajribasiz e'lon va stajirovka filtri bor; ikki hisobli to'liq E2E o'tkazilmadi |
| 19 | tayyor | `vacancies_unpaid_only_learning` constraint |
| 20 | tayyor | `flows.test.sql` |
| 21 | tayyor | `unique(vacancy_id, worker_id)` |
| 22 | tayyor | Yopilgan vakansiyaga ariza server tomonidan rad etiladi (`flows.test.sql`) |
| 23 | tayyor | RLS, `security*.test.sql` |
| 24 | tayyor | RLS; yashirin profil qidiruvda chiqmaydi |
| 25 | qisman | Egasi/a'zo rollari bor; a'zolikni bekor qilish oqimi alohida test qilinmagan |
| 26 | tayyor | `search_vacancies` faqat `active` |
| 27 | tayyor | initData tekshiruvi |
| 28 | qisman | OTP Supabase Auth limitlariga tayanadi; o'z limit testimiz yo'q |
| 29 | tayyor | Wizard har qadamni serverga saqlaydi |
| 30 | qisman | Server xatosida "yuborildi" chiqmaydi; avtomatik keyin yuborish navbati yo'q |
| 31 | qisman | 390 px E2E; Telegram ichida qo'lda tekshirilmadi |
| 32 | qisman | Fokus/klaviatura asosiy; to'liq a11y audit yo'q |
| 33 | qisman | Tur o'tkazib yuboriladi va `/help` dan qayta ochiladi; **video yo'q** |
| 34 | qisman | Bildirishnoma dublikatga qarshi kalitlar bor; kanal o'chirilganda yubormaslik alohida test qilinmagan |
| 35 | tayyor | `account_deletion.test.sql` |
| 36 | tayyor | E2E: `/admin` 404, `/pricing` 404, to'lov triggeri |
| 37 | tayyor | Toza bazada barcha migratsiyalar + 16 SQL test to'plami; katalog seed idempotent |
| 38 | bloklangan | Yuklama/tiklash o'lchovi o'tkazilmagan |

**Jami:** 27 tayyor · 10 qisman · 1 bloklangan (#38). #33 dagi video qismi ham tashqi ish (videolarni yozish) kutmoqda.

## Real foydalanuvchi sinovi rejasi (o'tkazilmagan)

5 kishi: texnologiyaga kam tanish odam, talaba, hunarmand (usta), kichik ish beruvchi, 50+ yoshli foydalanuvchi.
Har biri yordamsiz: (1) ro'yxatdan o'tish, (2) kasb topish yoki yozish, (3) ariza berish / vakansiya joylash.
O'lchov: bajarildi/yo'q, vaqt, qayerda to'xtadi. Natijalar shu hujjatga qo'shiladi.

## Keyingi eng zarur qadamlar

1. Video qo'llanmalar (uz, oz, ru) yozish va `/help` ga ulash.
2. Hududlarni rasmiy SOATO manbasi bilan solishtirish.
3. Katalogga ISCO-08 kodlarini biriktirish, yaqin-dublikatlarni birlashtirish, `custom_occupation_requests` navbatini ko'rib chiqish (kelajakdagi admin tizimida).
4. 5 kishilik real UX sinovi.
5. Yuklama testi (k6) va zaxiradan tiklash sinovi.
