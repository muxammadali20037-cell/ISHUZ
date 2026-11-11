# Ishlab chiqish rejasi — Ish topdim 2.0

Asos: `docs/PROJECT_AUDIT.md` (nima bor), `docs/PRODUCT_ARCHITECTURE.md` (nima bo'lishi kerak), `docs/DESIGN_SYSTEM.md` (qanday ko'rinishi kerak).
Har bir bosqich: kichik commitlar → testlar → CI yashil → `docs/PROGRESS.md` yangilanadi → keyingi bosqich.
Mavjud ishlaydigan funksiya yangisi tayyor bo'lmaguncha o'chirilmaydi. Prod bazaga faqat ega (yoki uning aniq ruxsati bilan) migratsiya qo'llaydi.

## Oldingi shart: barqarorlashtirish — kod tayyor, ega amali kutilmoqda

Branch `claude/phase-0-barqarorlik`, CI yashil: Next 16.4.5, telefonlarni yopish (0074), webhook qayta urinishi (0075),
`/api/health`, Sentry, rad etilgan holat rangi. Ega amallari (`docs/RELEASE_CHECKLIST.md`):

1. Supabase'da zaxira → `scripts/prod-migration-check.sql` → 0069–0075 ni tartib bilan qo'llash.
2. Relizga ruxsat (`main` ga birlashtirish).
3. Sentry DSN va uptime monitor.

Bular bajarilmaguncha keyingi bosqichlar branchda ishlab chiqiladi va testlanadi, lekin prod'ga chiqmaydi.

## 0-bosqich — Audit ✅

Natija: `PROJECT_AUDIT.md`, `PRODUCT_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `IMPLEMENTATION_PLAN.md`, `ROUTES_MAP.md`,
`DATABASE_SCHEMA.md`, `PROGRESS.md`, `TEST_REPORT.md`, generator `scripts/gen-docs.py`. Kod o'zgarmadi.

## 1-bosqich — Dizayn tizimi

| Ish | Fayllar |
| --- | --- |
| Yangi ranglar (yorug' va qorong'u), bitta shrift, o'lchov tokenlari | `src/app/globals.css`, `src/app/layout.tsx` |
| Kontrast testi tokenlar uchun | `src/lib/design/contrast.test.ts` (yangi) |
| Mavjud komponentlarni yangilash | `src/components/ui/*` |
| Yangi komponentlar: table, drawer, alert, empty/error state, status-badge, stat-card, stepper, file-upload | `src/components/ui/*` |
| Qobiqlar: ochiq sayt sarlavhasi, kabinet sidebar'i, mobil pastki menyu (rolga qarab 5 band), Mini App qobig'i | `src/components/shared/app-shell.tsx`, `site-nav.tsx` |
| Komponentlar ko'rgazmasi | `/dev/ui` (prod'da yopiq) |

Darvoza: barcha mavjud E2E o'tadi; axe xatosiz; 360/390/430/768/1280/1440 skrinshotlar tekshirildi; eski hex ranglar kodda qolmagan.

## 2-bosqich — Ochiq sayt

Bosh sahifa (talabdagi 12 bo'lim, faqat haqiqiy raqamlar), yagona qidiruv (`/jobs` va `/search` birlashadi, eski manzil
yo'naltiriladi), vakansiya sahifasi, kasblar, hudud sahifalari (yangi, SEO), kompaniyalar va kompaniya profili (sharhlar —
faqat tasdiqlangan ishga olingandan keyin), aloqa sahifasi (yangi), masofaviy ishlar sahifasi (filtrli ko'rinish), footer.
Maoshlar sahifasi — faqat yetarli real ma'lumot to'plangach (oldindan qurilmaydi).

Darvoza: barcha ochiq marshrutlar 200 yoki to'g'ri 404; sitemap faqat haqiqiy kontent; Lighthouse mobil o'lchovi yozildi.

## 3-bosqich — Kirish va onboarding

Kirish/ro'yxatdan o'tish ekranlari yangi dizaynda; rol tanlash; ish izlovchi onboarding'i (talabdagi 13 qadam mavjud 9 qadamli
oqim asosida, progress serverda); ish beruvchi onboarding'i (kompaniya, soha, manzil, tasdiqlash so'rovi, birinchi vakansiya).
**SMS:** provayder shartnomasi bo'lmaguncha kod Telegram orqali (hozirgidek). SMS kanali alohida modul bo'lib keyin ulanadi.

Darvoza: yangi foydalanuvchi ikkala rolda ham E2E'da oxirigacha o'tadi; yarim yo'lda chiqib qaytsa, davom etadi.

## 4-bosqich — Ish izlovchi kabineti

Dashboard, Skill Passport (sertifikatlar va tasdiq darajalari — yangi `worker_certifications` jadvali), qidiruv, tavsiyalar,
saqlanganlar (bitta saqlash tizimi), arizalar (3 qadamli ariza, holat tarixi), suhbatlar sahifasi, xabarlar, sozlamalar.

DB: `worker_certifications`, `interviews` (bir nechta suhbat, vaqt, joy/onlayn), saqlash jadvallarini birlashtirish — har biri
qaytariladigan migratsiya va SQL test bilan.

## 5-bosqich — Ish beruvchi kabineti

Dashboard, kompaniya profili, **yagona** vakansiya yaratish (`/post/vacancy` va `/employer/vacancies/new` birlashadi; AI matndan
— shu oqimning bir varianti), vakansiyalarni boshqarish, nomzod qidiruvi, nomzod sahifasi (ruxsatsiz aloqa ko'rinmaydi),
pipeline (ro'yxat + kanban, ommaviy amallar), screener savollari, suhbatlar va baholash (`interview_feedback`), jamoa, analitika
(faqat yig'ilgan ma'lumot), tariflar (ko'rinadi, to'lov o'chiq).

## 6-bosqich — Admin

Mavjud 26 bo'lim yangi dizaynga; yangi: Kompaniyalar, Arizalar, Obunalar. Ruxsatlar bazada (`has_admin_permission`),
har bir amal sababi bilan `audit_logs` ga.

## 7-bosqich — Backend integratsiyasi

Oldingi bosqichlarda qo'shilgan jadvallar uchun RLS va SQL testlar, bildirishnomalar (sayt + bot), fayllar (yopiq storage),
qidiruv indekslari, TS moslash v1 ni olib tashlash. Har bir migratsiyaga `supabase/rollbacks/*.down.sql`.

## 8-bosqich — AI

Nomzod xulosasi, intervyu savollari, ko'nikma bo'shlig'i, ariza matni yordamchisi — yagona `src/lib/ai/client.ts` orqali,
prompt versiyasi, zod chiqish tekshiruvi, kunlik limit. AI ishlamasa asosiy oqim ishlaydi.

## 9-bosqich — QA va prod

Barcha marshrut va formalar, barcha rollar, mobil kengliklar, ruxsatlar (SQL/RLS), tezlik (RUM, Core Web Vitals),
deploy tekshiruvi `/api/health?deep=1` bilan. `TEST_REPORT.md` yakuniy.

## Monetizatsiya (keyin)

Faqat real faollik bo'lgach: tariflar, TOP, obunalar, Payme/Click (imzo tekshiruvi, idempotentlik, refund, solishtirish).
Ish izlovchidan oddiy ariza uchun pul olinmaydi.

## Sizning qaroringiz kerak bo'lgan savollar

| Savol | Tavsiya | Nega |
| --- | --- | --- |
| Telefon tasdig'i: SMS yoki Telegram kodi? | Hozircha Telegram kodi, SMS keyin | SMS pullik va provayder shartnomasi kerak (masalan Eskiz.uz); Telegram kodi bepul va allaqachon ishlaydi |
| Prod'ga chiqarish tartibi | Avval barqarorlashtirish reliz, keyin har bosqich alohida | Bitta katta reliz xatoni topishni qiyinlashtiradi |
| Haqiqiy suratlar | Fotosessiya (roziligi bilan) yoki suratsiz dizayn | Namuna rasmlardagi odamlar stok/AI — ishlatib bo'lmaydi |
