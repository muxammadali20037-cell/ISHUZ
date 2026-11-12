# Reliz tartibi (ISH TOPDIM)

Bu hujjat kod va bazani prod'ga **xavfsiz** chiqarish tartibi. Prod bazaga faqat loyiha egasi (yoki uning aniq ruxsati
bilan) migratsiya qo'llaydi. Har bir qadamdan oldin zaxira nusxa.

## 0. Asosiy qoida: avval baza, keyin kod

Kod yangi migratsiyalarga tayanadi. Kod bazadan oldin chiqsa, sahifalar buziladi (2026-11 auditi: `/companies` va qidiruv
filtrlari aynan shu sababli ishlamadi — kod 0069–0073 ni kutardi, bazada ular yo'q edi).

Tartib:

1. CI yashil (`Secrets · Dependency audit`, `Lint · Typecheck · Test · Build`, `SQL`, `Browser E2E`).
2. Prod bazaning zaxira nusxasi (quyida).
3. Yetishmagan migratsiyalarni tartib bilan qo'llash.
4. Tekshirish (`scripts/prod-migration-check.sql` — hammasi "bor").
5. Kodni `main` ga chiqarish (Vercel avtomatik deploy qiladi).
6. Deploydan keyin `/api/health` va `/api/health?deep=1` tekshiruvi.

## 1. Zaxira nusxa

- Supabase → loyiha → **Database → Backups**: oxirgi kunlik nusxa sanasi bugungi ekanini ko'ring.
- Qo'shimcha: GitHub → Actions → **DB backup (encrypted)** → "Run workflow" (shifrlangan nusxa).
- Nusxa tayyor bo'lmaguncha migratsiya qo'llanmaydi.

## 2. Prod holatini tekshirish (faqat o'qiydi)

Supabase → **SQL Editor** → `scripts/prod-migration-check.sql` faylini to'liq joylab **Run**.
Natijada har bir migratsiya "bor" yoki "YO'Q". Ikkinchi jadval — faol vakansiyasiz kompaniyalar ro'yxati (o'chirmaydi).

## 3. Migratsiyalarni qo'llash

**Eng oson yo'l — bitta fayl (2026-11-12 dan):** `supabase/prod/pending.sql`. Unda prod'da hali yo'q barcha migratsiyalar
tartib bilan, bitta tranzaksiyada (xato bo'lsa hech narsa o'zgarmaydi). Takror ishga tushirish zarar qilmaydi.

1. GitHub'da `supabase/prod/pending.sql` ni oching → **Raw** → hammasini belgilab nusxalang (Ctrl+A, Ctrl+C).
2. Supabase → **SQL Editor** → **New query** → joylang (Ctrl+V) → **Run**.
3. Pastda jadval chiqadi — har qatorda **"bor"** bo'lishi kerak. Xato chiqsa, matnini yuboring.

Fayl avtomatik yaratiladi (`npm run prod:pending`) va har o'zgarishda CI'da prod'ga o'xshash bazada sinaladi
(`scripts/prod-pending-test.sh`: qo'llanadi, takror qo'llanadi, natija to'liq migratsiyalar bazasi bilan bir xil).
Ega qo'llaganini aytgach `scripts/gen-prod-pending.mjs` dagi `APPLIED_UNTIL` ko'tariladi.

**Bittalab qo'llash (eski yo'l, kerak bo'lsa):** faqat "YO'Q" bo'lganlarini, **raqam tartibida**: SQL Editor'ga
`supabase/migrations/00NN_*.sql` faylini to'liq joylab **Run**. Xato chiqsa — to'xtang, keyingisiga o'tmang, xato matnini yuboring.

| Migratsiya | Nima qiladi | Kod nimani kutadi |
| --- | --- | --- |
| 0069_closed_vacancy_page | Yopilgan vakansiya sahifasi (404 o'rniga qisqa ma'lumot) | `/jobs/[slug]` |
| 0070_search_salary_max_education | Maksimal maosh va ma'lumoti filtrlari | `/jobs` filtrlari |
| 0071_companies_directory | Kompaniyalar katalogi | `/companies` |
| 0072_duplicates_featured_audit | Takroriy e'lon himoyasi, TOP, audit bo'shliqlari | ish beruvchi, admin |
| 0073_profile_interests | "Mening dunyom" qiziqishlari | `/dunyo` |
| 0074_contact_privacy | Ro'yxatlarda telefon yo'q; raqam faqat kirganlarga, limit bilan; Telegram telefon ustuni yopiq | qidiruv, vakansiya sahifasi |
| 0075_telegram_update_retry | Webhook xatosida update yo'qolmaydi (3 urinish) | `/api/telegram/webhook` |
| 0076_masters | "Universal ustalar": alohida jadvallar, RLS, moderatsiya, 12 kategoriya, 48 ta demo e'lon | `/ustalar`, `/admin/ustalar` |
| 0077_demo_vacancies | Namuna vakansiyalar: alohida jadval (haqiqiy e'lonlar bilan aralashmaydi), har sohada 4 tadan | bosh sahifa / `/jobs` bo'sh holati, `/jobs/namuna`, `/admin/namuna` |

**Muhim:** 0074 avvalgi migratsiyalardagi funksiya ta'riflari asosida yozilgan — undan oldin 0069–0073 qo'llangan bo'lishi shart.
0076 mustaqil (boshqa migratsiyalarga bog'liq emas; 0001–0068 li bazada alohida qo'llab tekshirilgan — uni 0069–0075 dan oldin
ham, keyin ham qo'llash mumkin). U qo'llanmaguncha `/ustalar` "Bo'lim tayyorlanmoqda" deb ochiladi. Demo
e'lonlarni keyin olib tashlash: admin → Universal ustalar → "Demo e'lonlarni olib tashlash" yoki `select public.master_demo_remove();`
(`docs/MASTERS.md` §4).

Qaytarish (faqat favqulodda, ega ruxsati bilan): `supabase/rollbacks/00NN_*.down.sql`.

## 4. Kodni chiqarish

`main` ga birlashtirish → Vercel deploy. Deploy "Ready" bo'lgach:

```
curl https://ishuz.vercel.app/api/health
# {"status":"ok","db":{"ok":true,...},"release":"<commit>"}

curl -H "Authorization: Bearer $CRON_SECRET" "https://ishuz.vercel.app/api/health?deep=1"
# "schema":{"ok":true,"missing":[],"errors":[]}
```

`deep` javobida `missing` bo'sh bo'lmasa — o'sha migratsiyalar prod'da yo'q (3-qadamga qayting).

Hammasini bitta buyruq bilan (faqat o'qiydi): `CRON_SECRET=… bash scripts/prod-check.sh` — health, deep, ochiq sahifalar,
robots/sitemap/manifest/assetlinks, Telegram webhook va to'lov kirish nuqtalari, xavfsizlik sarlavhalari.
`TELEGRAM_BOT_TOKEN=…` ham berilsa, Telegram'dagi webhook manzili va oxirgi xatosi ko'rsatiladi (qiymatlar chop etilmaydi).

## 5. Monitoring (bir marta sozlanadi)

- **Sentry**: sentry.io da bepul loyiha (platforma: Next.js) → DSN ni Vercel → Project → Settings → Environment Variables
  ga `SENTRY_DSN` nomi bilan (Production) qo'shing → qayta deploy. DSN bo'lmasa monitoring o'chiq, sayt ishlayveradi.
- **Uptime**: istalgan bepul uptime xizmati (masalan UptimeRobot) → `https://ishuz.vercel.app/api/health`, har 5 daqiqa,
  kalit so'z `"status":"ok"`.

## 6. Reliz cheklisti (har safar)

- [ ] CI yashil, hech bir test o'chirilmagan yoki o'tkazib yuborilmagan
- [ ] Zaxira nusxa bugungi
- [ ] `prod-migration-check.sql` — hammasi "bor"
- [ ] `bash scripts/prod-check.sh` → FAIL=0 (`/api/health` ok, deep `missing: []`, sahifalar 200)
- [ ] Bosh sahifa, `/jobs`, bitta vakansiya, `/companies` qo'lda ochib ko'rildi
- [ ] Telegram bot `/start` javob beradi
- [ ] `docs/CHANGELOG.md` yangilandi
