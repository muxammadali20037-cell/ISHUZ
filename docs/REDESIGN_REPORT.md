# Qayta loyihalash (R-A … R-G) — yakuniy hisobot

Sana: 2026-10-15 · branch `claude/gallant-thompson-q70fo3` · main'ga qo'shilmagan, production'ga deploy qilinmagan.
Batafsil topilmalar va har birining holati: [REDESIGN_AUDIT.md](REDESIGN_AUDIT.md) (§1–7 topilmalar, §9 holat).
Tezlik o'lchovlari: [PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md) ("R-F" bo'limi). Dizayn qoidalari: [BRAND_UI_GUIDE.md](BRAND_UI_GUIDE.md).

Bu hisobotdagi har bir "✅" yonida uni tekshiradigan test yoki o'lchov ko'rsatilgan. Tekshirilmagan narsa NOT_RUN deb yozilgan.
"Xatosiz", "hech qachon qotmaydi" yoki "million foydalanuvchiga tayyor" degan da'vo yo'q: lab o'lchovi real foydalanuvchi
natijasi emas, E2E esa lokal stendda (haqiqiy Supabase/Telegram/to'lov emas) ishlaydi.

## 0. Commit'lar

| Bosqich | Nima | Commit |
|---|---|---|
| R-A | Joriy ekranlar auditi (390/1280 px), topilmalar turi bilan: XATO / UX / XAVF | `3d56138` |
| R-B | Brend konfiguratsiyasi, rolga xos menyu, ishbay qo'shimchasi, `/employer` siljishi, xavfsiz paket yangilanishlari | `f6b11d2` |
| R-C | Bosh sahifa (qidiruv + haqiqiy e'lonlar), ish beruvchi paneli, matnli qidiruv, filtr chiplari, karta tartibi | `a52001b` |
| R-C | Topilgan xato X1: mos nomzodlar doim bo'sh edi (PostgREST `PGRST201`) | `4d97e68` |
| R-D | Server qo'riqlari, migratsiya 0065 (production'ga qo'llanmagan) | `f012106` |
| R-E | Kirish/profil to'ldirishdan keyin ariza oynasiga qaytish, klaviatura, taklif maoshi davri | `71c362a` |
| R-F/G | Tillar va tor ekran, a11y kengaytmasi, JS hajmi, yakuniy tekshiruv va shu hisobot | shu commit |

## 1. Muammolar va tuzatishlar

**R-A — audit.** 14 ekran × 2 kenglik suratga olindi (`docs/screenshots/redesign/before/`), har topilma dalil (fayl:qator,
o'lchov) bilan. Asosiy xulosa: bosh sahifada qidiruv va haqiqiy e'lonlar birinchi ekranda yo'q edi, menyu rolga mos emas edi,
matnli qidiruv kasbga aylanmasa natija bermasdi, server tomonda muddati o'tgan vakansiyaga ariza qabul qilinardi.

**R-B — asos.** Foydalanuvchiga ko'rinadigan nom bitta joyda (`src/config/brand.ts`). Rolga xos pastki menyu: ish qidiruvchiga
Ishlar · Saqlanganlar · Arizalar · Profil, ish beruvchiga Bosh sahifa · Vakansiyalar · Nomzodlar · Profil (yangi ariza/taklif
belgisi bilan). "5 000 000 so'mishbay" → "· ishbay"; `/employer` 390 px da 36 px yonga siljirdi → 0.

**R-C — asosiy ekranlar.** Bosh sahifada birinchi ekranda qidiruv, tez filtrlar va 8 tagacha haqiqiy e'lon: profilda kasb bo'lsa
"Sizga mos ishlar" (sababi yozilgan, soxta foiz yo'q), aks holda "Yangi ishlar". Ish beruvchi — panel (haqiqiy ko'rsatkichlar,
oddiy "Vakansiya joylash" tugmasi). Kasbga aylanmagan matn → sarlavha, tavsif va kompaniya nomi bo'yicha natija. Faol filtrlar
chip sifatida. Karta tartibi: nomi → maosh → kompaniya → hudud → belgilar; tasdiqlangan belgi faqat haqiqatan tasdiqlanganda.
Mobil inputlar 16 px (iOS fokusda kattalashtirmaydi). Yo'l-yo'lakay topilgan **X1**: `worker_profiles → profession_nodes`
bog'lanishi PostgREST'da ikki ma'noli edi — so'rov jim yiqilib, mos nomzodlar ro'yxati doim bo'sh, "Sizga mos ishlar" hech chiqmasdi.

**R-D — server qo'riqlari (0065).** Muddati o'tgan (soatlik vazifa hali yopmagan) vakansiyaga ariza bazada rad etiladi va qidiruvda
ko'rinmaydi; yopilgan vakansiya bo'yicha taklifni qabul qilib bo'lmaydi (ariza yaratilmaydi, sababi aytiladi); admin MFA
sozlamasini faqat `admins.manage` (super_admin) o'zgartira oladi — bazada trigger va ilovada tekshiruv. Kasb meta maydonlari
o'zgarishi auditga yoziladi.

**R-E — oqimlar.** "Ariza yuborish" → kirish yoki profil to'ldirish → aynan o'sha vakansiya, ariza oynasi ochiq (`?next=`, faqat
shu saytdagi yo'l). Profili yo'q foydalanuvchi "Arizalar"da onboardingga majburan emas, tushuntirish oladi. Telefonda matn
yozilayotganda pastki menyu va lupa yashiriladi, sahifa klaviatura bilan qisqaradi (`interactive-widget=resizes-content`).
Taklifda maosh davri ko'rsatiladi.

**R-F/G — tillar, a11y, tezlik.** Qo'shimcha topilma va tuzatishlar (tafsilot — audit §9, L1–L5, P1, R):
- ru/oz/en tilida 360–390 px da asosiy ma'lumot "…" bilan kesilardi: "Работодатель" tugmasi, ishchi maoshi va tajribasi,
  vakansiya kartasida "сум/" ‖ "мес" ikki qatorga bo'linardi → tuzatildi; kesilgan matnlar 139 → 50 (qolgani ikkinchi darajali izohlar).
- O'zbekchada faqat boshlang'ich maosh "dan 4 000 000 so'm" (grammatik xato) → "kamida 4 000 000 so'm/oy"; kirill o'zbekchada
  summa lotincha "so'm" edi → "сўм", "mln/ming" → "млн/минг".
- `<html lang="oz">` (yaroqsiz kod) → "uz-Cyrl".
- a11y testi e'lon sahifasi, "Arizalarim" va ish beruvchi vakansiyalariga kengaytirildi; 44 px dan kichik 4 xil bosish maydoni tuzatildi.
- zod (~89 KB siqilgan) natija kartasi bor har sahifaga keraksiz yuklanardi → `env-public.ts`; lab o'lchovi metodikasidagi xato
  (service worker keshidan kelgan fayllar siqilmagan hajmda hisoblanardi) tuzatildi.

## 2. O'zgargan ekranlar

Bosh sahifa (ish qidiruvchi, ish beruvchi, mehmon) · qidiruv natijalari (ishlar, ishchilar, matnli qidiruv) · vakansiya sahifasi ·
ish beruvchi paneli va vakansiyalar ro'yxati · kabinet · "Arizalarim" · taklif sahifasi · onboarding (qaytish yo'li) · pastki va
yuqori menyu · rejim almashtirgich. Admin panelning ko'rinishi qayta ishlanmadi (faqat MFA kaliti himoyasi va kasb auditi).

## 3. Avval / keyin

| Papka | Nima |
|---|---|
| `docs/screenshots/redesign/before/` | R-A: 14 ekran × 390 va 1280 px (qayta loyihalashdan oldin) |
| `docs/screenshots/redesign/after-rc/` | R-C: bosh sahifa (mehmon, ish qidiruvchi, ish beruvchi), filtrlar, matnli qidiruv |
| `docs/screenshots/redesign/after-rf/ru-360-before-after.jpg` | Ruscha, 360 px: bosh sahifa, ishlar, ishchilar, ish beruvchi — avval (`71c362a`) va keyin |
| `docs/screenshots/redesign/after-rf/w6-*-mobile.jpg`, `w6-*-wide.jpg` | Bosh sahifa, natijalar, e'lon, ish beruvchi — 360/390/430 va 768/1280/1440 px |

Kenglik bo'yicha o'lchov (12 sahifa: bosh sahifa ×3, natijalar, matnli qidiruv, e'lon, kirish, kabinet, arizalar, ish beruvchi
vakansiyalari, ishchilar, admin): o'zbekchada 6 kenglik (72 holat), ruschada 360/390/1280 (36 holat) — gorizontal siljish 0,
kesilgan (`overflow: hidden`, "…"siz) matn 0, ustma-ust bosiladigan element 0.

## 4. Testlar va natijalar (shu commit, lokal)

| Tekshiruv | Buyruq | Natija |
|---|---|---|
| ESLint | `npm run lint` | 0 xato, 2 ogohlantirish (avvaldan: ishlatilmagan o'zgaruvchi `match-score.tsx`, react-hook-form `step-schedule.tsx`) |
| TypeScript | `npm run typecheck` | 0 xato |
| Unit | `npm test` | 627 o'tdi, 18 o'tkazib yuborildi (TS↔SQL moslik paritet to'plami — sababi PROFESSIONALIZATION_REPORT'da) |
| SQL/RLS | `bash scripts/db-test.sh` | 853 tekshiruv `ok`, xato yo'q (0065 qo'riqlari, RLS, to'lov, hamyon) |
| E2E | `bash e2e/stack/up.sh && npx playwright test -c e2e` | 148/148 (oxirgi to'liq yurgizish); keyin qo'shilgan 3 a11y sahifasi va `tap-target` tuzatishidan so'ng o'zgargan spec'lar (a11y, detail-pages, i18n-fit, flows, home-windows, compact-cards, regression) alohida o'tdi |
| Production build | `npm run build` (CI'dagi placeholder env bilan) | muvaffaqiyatli |
| Sir skaneri | `bash scripts/security/secret-scan.sh` | sir topilmadi |
| Paketlar | `npm audit --omit=dev` | 0 zaiflik |

**Yangi testlar eski build'da yiqilishi** (test haqiqatan xatoni ushlashining isboti):
`i18n-fit.spec` — `71c362a` da 4/4 yiqiladi ("Работодатель" sig'maydi, maosh qatori kesilgan, "сум/мес" bo'lingan,
"dan 4 000 000 so'm"), 3 marta takrorlandi; `matches.spec` — `f6b11d2` da yiqiladi; `apply_guards.test.sql` — 0065'siz bazada yiqiladi.
Bitta topilma test ishonchliligi haqida: oqim (streaming) paytida kontent bir lahza yashirin nusxada turadi va kenglik o'lchovi
0 = 0 bo'lib "sig'di" chiqardi (eski build'da 3 urinishdan 1 tasida xato o'tkazib yuborilardi) — o'lchovdan oldin ko'rinish kutiladi.

**Mavjud testlar o'zgarishi** (hech biri o'chirilmagan yoki yumshatilmagan):
`compact-cards.spec` — ekrandagi tajriba yozuvi "3 yildan ko'p" → "3+ yil" (to'liq yozuv tekshiruvi saqlangan);
`a11y.spec` — 3 sahifa qo'shildi. Bitta o'zgarish testga zid kelgani uchun **qaytarildi**: bosh sahifadagi tezkor bo'lim izohini
2 qatorga chiqarish R-C dagi "qator ≤ 96 px" talabini buzdi (`home-windows.spec`, 106 px) — test emas, o'zgarish bekor qilindi.

## 5. Qabul mezonlari

| Mezon | Dalil | Holat |
|---|---|---|
| Mehmon: qidiradi, filtrlaydi, e'lonni ochadi | `journey-apply.spec` (bosh sahifa → qidiruv → batafsil), `results-page.spec`, `search-ui.spec` | ✅ |
| Kirgandan keyin o'sha vakansiyaga qaytadi | `journey-apply.spec` (kirish bilan, shu vakansiyaga qaytib), `guards.spec` (`?next=`), `ease.spec` G2 | ✅ |
| Ariza yuboradi va holatini ko'radi | `ease.spec` (ariza → arizani ko'rish), `applications.spec` | ✅ |
| Ish beruvchi vakansiya joylaydi va arizani ko'radi | `journeys.spec` (ish e'loni → joylash → kabinet → qidiruvda), `applications.spec` (kabinetdan ochadi, holatni o'zgartiradi) | ✅ |
| Ruxsatsiz kirish rad etiladi | `admin-home.spec` (admin bo'lmagan foydalanuvchi), SQL: `security*.test.sql`, `scale_rls.test.sql`, `apply_guards.test.sql` (MFA kaliti) | ✅ |
| Takroriy bosishda dublikat yo'q | `flows.spec` (joylash tugmasini ikki marta bosish — bitta e'lon); takroriy ariza — `unique (vacancy_id, worker_id)` | ✅ |
| Yopilgan / muddati o'tgan vakansiya ariza qabul qilmaydi | `guards.spec`, `apply_guards.test.sql` | ✅ (0065 production'da emas) |
| Tarmoq xatosidan keyin qayta urinish | `regression.spec` #27 (tarmoq uzilsa — aniq xato, tugma qayta ishlaydi), `search.spec` (RPC xatosi → qayta urinish), `auth.spec` (internet yo'q) | ✅ |
| uz / ru | `flows.spec` (til almashganda qoralama va filtrlar saqlanadi), `regression.spec` #31 (ru, 150% shrift), `i18n-fit.spec` | ✅ |
| Klaviatura asosiy tugmani yopmaydi | `guards.spec` (sensorli qurilma emulyatsiyasi) | qisman — **real iPhone/Android'da NOT_RUN** |
| 360/390/430/768/1280/1440 px skrinshotlar | §3, `after-rf/` | ✅ |
| LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | Lab (5 run, Slow 4G'ga yaqin, CPU 4×): LCP 0.85–1.32 s, CLS ≤ 0.005, bitta bosish ≤ 80 ms | lab'da maqsad ichida; **real foydalanuvchi (p75) — NOT_RUN** |

## 6. Xavfsizlik, shaxsiy ma'lumot, to'lov

- **Server tekshiruvlari.** Ariza, taklif, holat o'zgarishi — `SECURITY DEFINER` funksiyalarda egalik va rol tekshiruvi, to'g'ridan-to'g'ri
  yozish RLS bilan yopiq (audit B3/B4). 0065: muddati o'tgan vakansiya va yopilgan vakansiya bo'yicha taklif bazada rad etiladi.
- **Sirlar.** Mijozga faqat `NEXT_PUBLIC_*` chiqadi (`src/lib/env-public.ts`); service role kaliti faqat serverda
  (`src/lib/supabase/admin.ts`, `server-only`); Telegram bot kaliti mijozda yo'q; CI'da sir skaneri.
- **Telefon va CV.** Telefon `can_view_phone` / `get_contact` orqali, egasining tanlovi va rozilik so'rovi bilan (audit B5).
  **Ochiq xavf S4:** `simple_search_workers` mehmonga ochiq va telefoni "hammaga ochiq" ishchilarni 50 tadan qaytaradi, so'rov
  cheklovi yo'q — rozilik bilan ochilgan raqamlar ommaviy yig'ilishi mumkin. Mahsulot qarori kerak (cheklov yoki kirish talabi).
  **Ochiq xavf B9:** onboardingdagi sertifikat fayllari ochiq `portfolio` bucketiga yuklanadi.
- **To'lov** (avvalgi F bosqichi, bu ishda o'zgarmadi). Narx serverda; Payme/Click imzosi tekshiriladi; takroriy callback ikkinchi
  marta pul yoki xizmat yozmaydi; integratsiya sozlanmagan bo'lsa to'lov tugmasi yo'q, soxta "muvaffaqiyatli" yo'q. SQL dalillari
  (`billing.test.sql`, `wallet.test.sql`, `billing_off.test.sql`): "payme: noto'g'ri summa", "takroriy Create/Perform idempotent",
  "click: takroriy complete — already paid", "qayta Perform — balans ikki marta oshmaydi", "pullik xizmat yo'q — to'ldirib bo'lmaydi".
- **Ovoz.** Ovozli tugma yoki ovozli yordamchi qo'shilmagan (`no-ui-sound.spec`).

## 7. Ishga tushirish

```bash
npm ci
cp .env.example .env.local     # qiymatlarni o'zingiz to'ldirasiz; sirlar faqat Vercel env'da
npm run dev                     # http://localhost:3000

npm run lint && npm run typecheck && npm test           # unit
bash scripts/db-test.sh                                  # SQL/RLS (lokal PostgreSQL 16, toza baza)
bash e2e/stack/up.sh && npx playwright test -c e2e       # brauzer E2E (lokal stend, tashqi xizmatlarsiz)
node e2e/perf/lab.mjs 5                                  # lab tezlik o'lchovi → e2e/.stack/perf.json
E2E_BASE_URL=http://localhost:3301 node e2e/perf/lab.mjs 5   # boshqa build (masalan, eski commit) bilan solishtirish
```

## 8. Muhit o'zgaruvchilari

Qayta loyihalash **yangi o'zgaruvchi qo'shmadi**. Ro'yxat va izohlar — `.env.example` (qiymatlarsiz).

| Guruh | Nomlar |
|---|---|
| Majburiy (production) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (faqat server), `APP_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (kirish kodi bot orqali boradi) |
| Tavsiya | `SECURITY_PEPPER`, `LOGIN_CODE_SECRET` (bo'sh bo'lsa boshqa server kaliti ishlatiladi) |
| AI (ixtiyoriy) | `GEMINI_API_KEY`, `GEMINI_MODEL`, `ANTHROPIC_API_KEY`, `IMAGE_GEN_API_KEY`, `IMAGE_GEN_MODEL` |
| To'lov (ixtiyoriy) | `BILLING_ENABLED`, `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST`, `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` |
| Admin | `ADMIN_HOST`, `SUPER_ADMIN_PHONES`, `ADMIN_UI_ENABLED` |
| SEO, huquqiy, Android | `GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION`, `SUPPORT_EMAIL`, `LEGAL_OPERATOR`, `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINTS` |
| Faqat sinov (production'da e'tiborsiz) | `GEMINI_BASE_URL`, `IMAGE_GEN_BASE_URL`, `TELEGRAM_API_BASE`, `DATABASE_URL` (lokal SQL testlar) |
| Ixtiyoriy sozlash (`.env.example` da yo'q) | `MARKET_CACHE_SECONDS` — bozor paneli va mashhur kasblar keshi, standart 600 s (E2E stendda 0) |

## 9. Migratsiyalar

| Migratsiya | Holat |
|---|---|
| `0065_apply_guards.sql` (R-D) | Lokal tekshirilgan (SQL to'plami, 0065'siz yiqiladigan test). **Production'ga qo'llanmagan — egasining alohida ruxsati kerak.** Ma'lumot o'zgartirmaydi va o'chirmaydi: `create or replace` funksiyalar (`apply_to_vacancy`, `respond_offer`, 3 qidiruv funksiyasi) va yangi trigger. Qaytarish — oldingi funksiya ta'riflarini qayta qo'llash |
| R-F/G | Migratsiya yo'q |

## 10. Tekshirilmagan integratsiyalar (NOT_RUN)

- Haqiqiy Payme/Click kassasida to'lov (imzo va idempotentlik — unit va SQL testlarda).
- Haqiqiy Telegram bot: kirish kodi, bildirishnomalar, Mini App ichida avtomatik kirish (stendda soxta API).
- Haqiqiy AI provayderlari (Gemini/Claude) — stendda kalit yo'q.
- Real iPhone/Android: klaviatura va pastki tugmalar (F2), Telegram ichidagi safe area.
- Real foydalanuvchi web-vitals (Vercel Speed Insights yoki CrUX ulanishi kerak).
- Shu branch'ning Vercel preview/production deploy'i va 0065 qo'llangan production bazasi.
- E2E haqiqiy Supabase Auth/Storage emas, ularning lokal emulyatori ustida ishlaydi.

## 11. Cheklovlar va ochiq masalalar

- **S3:** kunlik ishlar uchun sana/vaqt maydoni yo'q ("kunlik" faqat to'lov davri) — migratsiya kerak, qilinmadi.
- **S4, B9** — §6 dagi ochiq xavflar.
- Admin panel ko'rinishi yagona dizaynga to'liq keltirilmadi (faqat xavfsizlik tuzatishlari).
- Matnli qidiruv natijasida telefon yo'q — kartada qo'ng'iroq o'rniga "Ariza yuborish".
- Taklifdagi maosh davri — yozuv kelishuvi ("Oylik maosh"), alohida ustun emas.
- Kesilgan matnlar qoldi (50 ta, 4 til × 2 kenglik): tezkor bo'limlar izohi (R-C ixcham qatori, ≤ 96 px talabi) va
  "o'xshash e'lonlar" manzili; asosiy ma'lumot (nom, maosh, tajriba, tugma yozuvlari) kesilmaydi.
- Eng og'ir sahifa JS bo'yicha — `/post/worker` (480 KB, forma zod'ni haqiqatan ishlatadi); qadamlarni kechiktirib yuklash
  mumkin, lekin lab LCP maqsad ichida bo'lgani uchun qilinmadi.
- Paketlar: production bog'liqliklarida zaiflik yo'q. Faqat dev'da `braces` (eslint-config-next orqali) — buzmaydigan tuzatish
  yo'q, mahsulotga kirmaydi. Next/React/Playwright va major versiyalar (TypeScript 7, ESLint 10) ataylab yangilanmadi (R-B, audit §7).
