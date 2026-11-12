# Namuna (demo) vakansiyalar

Ega (2026-11-12): "barcha sohalar bo'yicha vakansiyalar qo'sh … har biriga 4 tadan … keyin bir marta olib tashla desam olib
tashlaysan". Prod bazada hali haqiqiy e'lon yo'q — ilova bo'sh ko'rinmasligi uchun.

## 1. Qoida: haqiqiy e'lonlar bilan aralashmaydi

- **Alohida jadval** `public.demo_vacancies` (migratsiya `0077_demo_vacancies.sql`), `public.vacancies` ga hech narsa yozilmaydi.
  Shuning uchun namunalar haqiqiy e'lonlar quvuriga umuman kirmaydi: ariza yuborib bo'lmaydi, moslik va xabarnomalar (AI kuzatuv,
  saqlangan qidiruv, Telegram kanal) ishga tushmaydi, statistika va hisoblagichlarga qo'shilmaydi, sitemap va JobPosting'ga
  chiqmaydi.
- **Har sohada 4 tadan** (barcha faol sohalar — hozir 38 ta, 152 e'lon): nomi — o'sha sohaning ommabop kasbi, hududlar barcha
  viloyatlarga navbat bilan, maosh — sohaga xos **taxminiy** oraliq (statistika emas), 4-namuna "kelishiladi".
- **Kompaniya nomi, telefon, rasm, reyting yo'q** — o'ylab topilgan tashkilot yoki raqam ko'rsatilmaydi.
- Jadvalga to'g'ridan-to'g'ri kirish yo'q (RLS, huquqlar olingan); o'qish — `demo_vacancies_public`, `demo_vacancy_public`
  funksiyalari orqali; boshqarish (`demo_vacancies_seed`, `demo_vacancies_remove`) — faqat admin (`vacancies.moderate`),
  server kaliti yoki baza operatori (SQL Editor).

## 2. Qayerda ko'rinadi

| Joy | Qachon |
|---|---|
| Bosh sahifa (ish izlovchi) — "Yangi ishlar" ostida "Namuna e'lonlar" bloki (6 ta) | haqiqiy e'lonlar 4 tadan kam bo'lsa; haqiqiylari doim birinchi |
| `/jobs` — hech narsa topilmasa | soha tanlangan bo'lsa — o'sha sohadan 4 ta ("«…» sohasida hozircha haqiqiy e'lon yo'q") |
| `/search` (ish qidirish) — hech narsa topilmasa | tanlangan kasb sohasidan 4 ta |
| `/jobs/namuna` | barcha namunalar, soha bo'yicha saralash, sahifalash (noindex) |
| `/jobs/namuna/<slug>` | "Bu namuna e'lon — haqiqiy ish emas" ogohlantirishi, shartlar, keyingi qadamlar (noindex) |

Har kartada **"Namuna"** belgisi, kesik chiziqli hoshiya; saqlash, ariza, qo'ng'iroq tugmalari yo'q.

## 3. Olib tashlash (ega)

- **Admin panel → "Namuna e'lonlar" → "Namuna vakansiyalarni olib tashlash"** → tasdiqlash. Hammasi bir bosishda o'chadi,
  sayt darhol yangilanadi. Kerak bo'lsa shu yerda "qaytarish" tugmasi bor.
- Yoki Supabase → SQL Editor: `select public.demo_vacancies_remove();`
- Universal ustalar demo e'lonlari — alohida: admin → "Universal ustalar" (yoki `select public.master_demo_remove();`).
- Migratsiya fayli (yoki `supabase/prod/pending.sql`) qayta ishga tushirilsa, olib tashlangan namunalar **qaytmaydi** —
  ular faqat birinchi o'rnatishda yaratiladi.

## 4. Fayllar va testlar

- Baza: `supabase/migrations/0077_demo_vacancies.sql`, qaytarish `supabase/rollbacks/0077_demo_vacancies.down.sql`.
- Kod: `src/features/demo-vacancies/` (so'rovlar, karta, blok, admin amali), `src/app/jobs/namuna/`, `src/app/admin/(panel)/namuna/`.
- SQL: `supabase/tests/demo_vacancies.test.sql` — har sohada 4 ta, mehmon/oddiy foydalanuvchi boshqara olmaydi, jadvalga
  to'g'ridan-to'g'ri kirish yo'q, admin va operator olib tashlaydi/qaytaradi, takror o'rnatish qaytarmaydi, boshqa jadvallar bilan
  bog'lanmagan.
- E2E: `e2e/specs/demo-vacancies.spec.ts` (5 ssenariy). Stendda namunalar o'chirilgan holatda boshlanadi (boshqa testlarning bo'sh
  holatlari o'zgarmasin) — spec o'zi yaratadi va oxirida olib tashlaydi.
