# Jarayon (PROGRESS)

Har bir bosqichdan keyin yangilanadi. Reja — `docs/IMPLEMENTATION_PLAN.md`.

| Bosqich | Holat | Sana |
| --- | --- | --- |
| Barqarorlashtirish (Next 16.4.5, 0074–0075, health, Sentry) | Kod tayyor, CI yashil · **ega amali kutilmoqda** | 2026-11-07 |
| Bozorga tayyorlik: prod tekshiruv skripti, HTTP yuklama testi, ochiq ro'yxatlar keshi, STATUS.md | ✅ Tugadi | 2026-11-12 |
| AI ish maydoni ("ChatGPT kabi" /ai): chap panel, so'nggi suhbatlar, bugungi ishlar, jarayon izi | ✅ Tugadi | 2026-11-12 |
| Universal ustalar: ikki tomonlama bozor (0076), katalog, e'lon formasi, kabinet, moderatsiya, demo | Kod tayyor · **0076 — ega amali** | 2026-11-12 |
| 0. Audit | ✅ Tugadi | 2026-11-11 |
| 1. Dizayn tizimi | Davom etmoqda: 1-qadam (tokenlar) ✅, 2-qadam (komponentlar) ✅ | 2026-11-11 |
| 2. Ochiq sayt | — | |
| 3. Kirish va onboarding | — | |
| 4. Ish izlovchi | — | |
| 5. Ish beruvchi | — | |
| 6. Admin | — | |
| 7. Backend integratsiyasi | — | |
| 8. AI | — | |
| 9. QA va prod | — | |

## Universal ustalar — xizmat ko'rsatuvchi ustalar bozori (2026-11-12)

Egasi talabi va maketi bo'yicha. To'liq tavsif: `docs/MASTERS.md`.

**Bajarildi:**
- Baza (`0076_masters.sql`): `master_categories` (12), `master_listings`, `master_requests`, `master_reviews` — vakansiyalardan alohida;
  RLS; holatlar va qayta moderatsiya triggerlari; telefon faqat rozilik bilan va faqat e'lon sahifasida; reyting faqat sharhdan;
  rasm yo'li tekshiruvi; hisoblagichlar; demo e'lonlar (48, `is_demo`) va ularni bir buyruqda olib tashlash.
- Sahifalar: `/ustalar` (turkuaz mini-ilova: sarlavha, qidiruv, katalog), `/ustalar/qidiruv` (filtrlar), `/ustalar/[slug]` (telefon yoki
  so'rov, sharhlar), `/ustalar/elon` va `/elon/[id]` (forma, rasmlar), `/ustalar/kabinet` (holatlar, statistika, so'rovlar),
  `/admin/ustalar` (moderatsiya, demo boshqaruvi).
- Kirish: sayt menyusi, yon menyu, bosh sahifa va "Kabinetim" (telefonda yon menyu yo'q) — turkuaz "Universal ustalar".
- 0076 qo'llanmagan baza (prod'dagi deploy oynasi): `/ustalar` va `/ustalar/qidiruv` — "Bo'lim tayyorlanmoqda", `/admin/ustalar` —
  "0076 migratsiyasi qo'llanmagan" izohi (demo tugmalari yashirin). Stendda jadvallarni vaqtincha olib tashlab tekshirildi.
- 4 til (`messages/*/masters.json`), maxfiylik siyosati (usta va mijoz ma'lumotlari), sitemap/robots.
- Maketdagi soxta reyting, "Tasdiqlangan", telefon raqamlari va "50 000+ mijoz" kabi raqamlar **qo'yilmadi** — demo e'lonlar "Demo"
  belgisi bilan, telefonsiz va reytingsiz.

**Fayllar:** `supabase/migrations/0076_masters.sql`, `supabase/rollbacks/0076_masters.down.sql`, `supabase/tests/masters.test.sql`,
`src/features/masters/*`, `src/app/ustalar/*`, `src/app/admin/(panel)/ustalar/page.tsx`, `src/app/globals.css` (`.theme-masters`),
`src/components/shared/{app-shell,site-nav}.tsx`, `src/features/landing/seeker-home.tsx`, `src/features/cabinet/components/cabinet-page.tsx`,
`src/features/admin/{nav.ts,components/sidebar-nav.tsx}`,
`src/features/health/schema-probes.ts`, `scripts/prod-migration-check.sql`, `src/types/database.types.ts`, `messages/*/{masters,admin,legal}.json`,
`e2e/specs/{masters,a11y}.spec.ts`, `e2e/screens/masters.shots.ts`, `docs/{MASTERS,STATUS,RELEASE_CHECKLIST,ROUTES_MAP,DATABASE_SCHEMA}.md`.

**Testlar:** SQL 61 tekshiruv (to'liq SQL to'plami toza bazada o'tdi); Vitest 776 / 18 skip; E2E 277/277 (5 ta yangi ssenariy +
5 ta a11y sahifa); lint, typecheck 0 xato.

**Yo'l-yo'lakay tuzatildi:** `supabase/tests/scale_rls.test.sql` — sinov ma'lumoti uchun kasb juftligi bir xil `sort_order`'li
qatorlar orasidan tasodifiy tanlanardi; "Zargarlik / Zargar" tushsa test yiqilardi (ota nomi bola nomini o'z ichiga oladi). Endi
tanlov to'liq aniqlangan (slug bo'yicha) va bunday juftlik olinmaydi. Tekshiruvning o'zi o'zgarmadi.

**Relizdan keyingi mustahkamlash (#15, 0076 hali prod'ga qo'llanmagan — fayl joyida tuzatildi):**
- `master_privileged()`: baza operatori vositasi `SET ROLE postgres` qilgan bo'lsa ham (ba'zi CLI/boshqaruv vositalari) migratsiya
  oxiridagi demo seed "forbidden" bilan to'xtab qolmaydi. API orqali bu qiymatga yetib bo'lmaydi (authenticator faqat anon /
  authenticated / service_role ga o'tadi). Testda tasdiqlandi: eski funksiya shu holatda rad etardi.
- Fayl oxiridagi demo seed — faqat birinchi o'rnatishda (jadval bo'sh): tasodifiy takror ishga tushirish olib tashlangan demo
  e'lonlarni haqiqiylar yoniga qaytarmaydi.
- SQL test: oddiy foydalanuvchi demo'ni boshqara olmaydi; operator yo'li ishlaydi (+5 tekshiruv).

**Karta: bog'lanish usuli (#17).** Egasi talabida kartada "telefon" ham bor edi. Raqamning o'zi ro'yxatda ko'rsatilmaydi (ommaviy
yig'ib olishdan himoya, 0074 qoidasi bilan bir xil), lekin endi har haqiqiy kartada bog'lanish usuli ko'rinadi: "Qo'ng'iroq qilish
mumkin" (usta rozi) yoki "Bog'lanish — so'rov orqali". Raqam — e'lon sahifasida, bir bosishda. E2E: ikkala holat va ro'yxatda
raqam yo'qligi tekshiriladi.

**Qolgan (ega):** prod bazaga 0076 (u qo'llanmaguncha `/ustalar` "Bo'lim tayyorlanmoqda" deb ochiladi). Keyingi qadamlar — `MASTERS.md` §7.

## AI ish maydoni — "ChatGPT kabi" /ai (2026-11-12)

Egasi yuborgan maket bo'yicha. Batafsil: `docs/AI_ASSISTANT.md` 6-bosqich.

**Bajarildi:** `/ai` — uch ustun (chap: yangi suhbat, bo'limlar, so'nggi suhbatlar, profil; o'rta: suhbat, salomlashuv,
"Bugungi ishlar" va "Sizga mos ishlar" faqat bazadan; o'ng: karyera, tezkor imkoniyatlar, maslahat), telefonda panel pastdan;
har javobda jarayon izi (tushunildi → bazadan qidirildi · N → javob: AI/oddiy rejim); suhbatlar qurilmada (10 ta, 7 kun);
AI'siz rejimda umumiy va maslahat savollariga halol javob. 4 til.

**Fayllar:** `src/features/ai/components/ai-workspace.tsx`, `ai-workspace-client.tsx`, `src/features/ai/workspace-data.ts`,
`src/features/find/ai-chat-model.ts` (+test), `src/features/find/components/ai-chat.tsx` (suhbatlar, `Trace`, `bar` prop,
`data-ai-you`), `src/features/assistant/replies.ts` (+engine test), `src/app/ai/page.tsx` (eski `ai-hub.tsx` o'chirildi),
`messages/*/easy.json` (`aiws`), `messages/*/legal.json` (cookie: `ib_ai_convs`), `e2e/specs/ai-workspace.spec.ts`,
`e2e/screens/ai-workspace.shots.ts`, `ai-finder/sections/assistant-chat/layout-overlap` speclari yangilandi.

**Testlar:** Vitest 766 / 18 skip; E2E 267/267 (10 ta yangi); lint, typecheck 0 xato.

**Qolgan:** suhbatlarni serverda saqlash (rozilik + migratsiya) — egasi qarori; haqiqiy Claude bilan prod'da tekshirish
("Sun'iy intellekt" yozuvi).

## Bozorga tayyorlik — prod tekshiruvi, yuklama testi, hujjatlar (2026-11-12)

Egasi yuborgan tashqi tahlilga javob (P0: prod holati, yuklama testi; P1: hujjatlar). Kod bilan solishtirildi:
tahlil to'g'ri — hisobot 2026-10-14 holatini (64 migratsiya) tasvirlaydi, `main` da 75 ta; prod bazada 0069–0075 yo'q
(prod'da `/companies` "Ro'yxat vaqtincha ochilmadi" — tekshirildi).

**Bajarildi:**
- `scripts/prod-check.sh` (`npm run prod:check`) — prod'ni tashqaridan, faqat o'qib tekshiradi: health + deep (CRON_SECRET bilan —
  qaysi migratsiya yo'q), 9 ta ochiq sahifa (baza xatosi matnlarini ham tutadi), robots/sitemap/manifest/assetlinks, Telegram
  webhook va Payme/Click kirish nuqtalari (deploy va himoya), Telegram `getWebhookInfo` (token berilsa), xavfsizlik sarlavhalari.
  Lokal stendda sinaldi: FAIL=0, WARN=2 (assetlinks bo'sh, bot token yo'q — kutilgan).
- `load/http-load.mjs` (`npm run load:http`, autocannon) — HTTP yuklama testi; prod manzilini qabul qilmaydi.
  `load/stand-app.sh` — stend build'ini prod kesh sozlamalari bilan `:3301` da ko'taradi (`build` — qayta build).
- O'lchov 1 mln foydalanuvchilik bazada (150 ming faol vakansiya): 50/200/500 ulanishda xato 0; bitta Node jarayoni ~30–40 sahifa/s.
  Ikkita issiq nuqta topildi va tuzatildi: mehmon bosh sahifasi 215 → 28 ms, vakansiya sahifasi 186 → 30 ms (ochiq ro'yxatlar
  60 s keshda, e'lon joylansa/yopilsa `updateTag(PUBLIC_FEED_TAG)` darhol yangilaydi). Batafsil: `docs/SCALE.md` §8.
- `docs/STATUS.md` — joriy holatning yagona sahifasi (kod/prod, testlar, nima ishlaydi, ega amallari, sig'im, hujjatlar xaritasi,
  yo'l xaritasi bo'yicha fikr). Eski hisobotga "tarixiy" banner; README va RELEASE_CHECKLIST yangilandi.

**O'zgartirilgan fayllar:** `src/features/landing/home-queries.ts`, `src/features/jobs/queries.ts`, `src/features/find/queries.ts`,
`src/lib/supabase/public.ts`, `src/features/post/actions.ts`, `src/features/vacancies/actions.ts`, `scripts/prod-check.sh`,
`load/http-load.mjs`, `load/stand-app.sh`, `package.json` (autocannon dev), `docs/STATUS.md`, `docs/SCALE.md`,
`docs/load/http-2026-11-12.json`, `docs/PROFESSIONALIZATION_REPORT.md`, `docs/RELEASE_CHECKLIST.md`, `README.md`.

**Testlar:** Vitest 762 / 18 skip; E2E 257/257 (toza stend); typecheck, lint 0 xato. Kesh yoqilgan rejimda (`:3301`) home va
detail speclari qo'lda o'tkazildi — faqat SQL orqali to'g'ridan-to'g'ri qo'shilgan e'lonni "darhol" kutgan 1 ta test 60 s kesh tufayli
kutadi (loyihada e'lon faqat action orqali joylanadi — u keshni darhol yangilaydi; moderatsiya/cron orqali faollashganlar ≤ 60 s).

**Qolgan muammolar / keyingi qadam:** `docs/STATUS.md` §4 (ega amallari, birinchisi — 0069–0075) va `docs/SCALE.md` §8.4
(`/jobs` ro'yxati uchun qidiruv funksiyasini indeks tartibiga o'tkazish — migratsiya 0076; mehmon sahifalarini CDN keshi).

## 0-bosqich — Audit (2026-11-11)

**Bajarildi:** repo, marshrutlar, baza katalogi, navigatsiya, testlar va yangi talablar solishtirildi.

**Yaratilgan fayllar:**
- `docs/PROJECT_AUDIT.md`, `docs/PRODUCT_ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/IMPLEMENTATION_PLAN.md`
- `docs/ROUTES_MAP.md`, `docs/DATABASE_SCHEMA.md` — `scripts/gen-docs.py` yaratadi (qayta yaratish:
  `DB=postgres://postgres:postgres@127.0.0.1:5432/ishuz_test python3 scripts/gen-docs.py .`)
- `docs/PROGRESS.md`, `docs/TEST_REPORT.md`

**O'zgartirilgan fayllar:** yo'q (ilova kodi tegilmadi).

**Testlar:** kod o'zgarmagani uchun yangi test yo'q; oxirgi to'liq natija — `docs/TEST_REPORT.md`.

**Qolgan muammolar:** prod baza 0069–0075 siz; prod'da real vakansiya yo'q; takroriy oqimlar (qidiruv, vakansiya yaratish,
saqlash); SMS provayder yo'q.

**Keyingi aniq vazifa:** 1-bosqich — `src/app/globals.css` dagi rang tokenlarini `docs/DESIGN_SYSTEM.md` §2 bo'yicha
almashtirish va kontrast testini yozish.

## 1-bosqich, 1-qadam — Rang, shrift, radius tokenlari (2026-11-11)

**Bajarildi:**
- Yangi palitra: Midnight Navy `#101D35`, Professional Blue `#276FE5`, Cloud `#F4F6FA`, matn `#172033`, chegara `#E5EAF0`,
  Success `#16A378` (belgi) / `#0E7A5A` (matn). AA dan o'tmagan juftliklar uchun to'q variantlar (`docs/DESIGN_SYSTEM.md` §2).
- Ko'k matn uchun yangi token `--primary-ink` (`#1F5FCC`): barcha `text-primary` (394 joy, 179 fayl) `text-primary-ink` ga
  almashtirildi; qo'riqchi test endi oddiy `text-primary` ni taqiqlaydi.
- Bitta shrift: Inter Variable (Geist olib tashlandi, `geist` paketi o'chirildi).
- Radius shkalasi: tugma/maydon 10 px, karta 12 px, panel 16 px.
- Qolgan eski hex: `global-error.tsx`, `manifest.webmanifest`.

**O'zgartirilgan fayllar:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/global-error.tsx`,
`public/manifest.webmanifest`, `src/components/shared/brand-logo.tsx`, `package.json`, `src/lib/brand-contrast.test.ts`,
`src/lib/brand-guard.test.ts`, `e2e/specs/telegram-fullscreen.spec.ts`, va 179 ta komponent fayli (faqat klass nomi).

**Testlar:** Vitest 712 o'tdi (18 skip — eskirgan TS moslash, ma'lum); kontrast testi yorug' va qorong'i mavzuda
(matn ≥ 4.5:1, UI elementlar ≥ 3:1); typecheck, lint (0 xato); E2E 235/236 — yiqilgan bitta test eski fon rangini kutardi,
yangilandi va o'tdi.

**Qolgan muammo:** mobilda hamburger va pastki menyu birga chiqadi (talab: bittasi) — qobiqlar qadamida.

**Keyingi aniq vazifa:** 1-bosqich, 2-qadam — `src/components/ui` komponentlarini spetsifikatsiyaga keltirish
(tugma balandliklari 44/36/52, karta, input) va yangi komponentlar: status-badge, empty-state, alert, table, drawer.

## 1-bosqich, 2-qadam — Komponentlar (2026-11-11)

**Bajarildi:**
- Yangi komponentlar: `Alert` (ma'lumot / muvaffaqiyat / ogohlantirish / xato; xato va ogohlantirish `role="alert"`),
  `Table` (tor ekranda o'z ichida suriladi, `scope="col"`), `StatCard` (faqat haqiqiy son; noma'lum — "—").
- Tugma: `lg` = 52 px (mobil asosiy CTA). Qolgan o'lchamlar talabga allaqachon mos edi (44 / 36).
- Mavjud va qayta ishlatiladigan: `Sheet` (pastki varaq / drawer), `EmptyState`, `Stepper`, `PageHeader`, `Badge`,
  arizalar uchun `StatusBadge` — yangisi yaratilmadi (takror bo'lmasin).
- Komponentlar ko'rgazmasi `/dev/ui` yangilandi (yangi palitra, radius, shrift, yangi komponentlar). Prod'da 404.

**Yaratilgan fayllar:** `src/components/ui/alert.tsx`, `table.tsx`, `stat-card.tsx`, `primitives-2.test.tsx`.
**O'zgartirilgan:** `src/components/ui/index.ts`, `button.tsx`, `src/app/dev/ui/page.tsx`.

**Testlar:** 7 ta yangi Vitest (rol, halollik, jadval); qo'riqchi test; 390 va 1280 px skrinshotlar ko'rib chiqildi.

**Keyingi aniq vazifa:** 1-bosqich, 3-qadam — qobiqlar: mobilda hamburger va pastki menyu birga chiqmasin; ish izlovchi
(Bosh sahifa · Qidiruv · Saqlangan · Arizalar · Profil) va ish beruvchi (Panel · Ishlar · Nomzodlar · Xabarlar · Kompaniya)
pastki menyulari; kompyuterda kabinet sidebar'i (`src/components/shared/app-shell.tsx`).

## 2.0 · Ish izlovchi bosh sahifasi va AI qidiruv — noldan (2026-11-11)

**Ega qarori:** "Ekranlarni noldan" — barcha ekranlar yangi sodda dizaynda qayta quriladi; baza, ma'lumotlar, xavfsizlik va
testlar saqlanadi. Birinchi ekran — ish izlovchi bosh sahifasi ("umuman adashmasin") va AI qidiruv ("yo'q deb o'tirmasin").

**Bajarildi:**
- **Bosh sahifa (ish izlovchi) qayta yozildi** — bir ekranda bitta vazifa: salom, "Qanday ish qidiryapsiz?", BITTA qidiruv
  maydoni ("Topish"), 4 ta tez yo'l (Kunlik ish · Yaqin atrofda · Masofaviy · Tajribasiz), "Filtrlar bilan qidirish",
  keyin yangi ishlar. O'ngda (kompyuterda): "O'zim haqimda e'lon" va "Yangi ish chiqsa — xabar beramiz".
  Olib tashlandi: fon surati, nol ko'rsatkichlar ("0 faol vakansiya"), 8 ta plitka, bo'limlar ro'yxati, ommabop kasblar,
  rasmli katalog, admin oynalari. "Mening dunyom" — faqat kirgan foydalanuvchiga, ro'yxatdan keyin.
- **AI qidiruv "yo'q" deb to'xtamaydi** (`src/features/find/ai-find.ts`): aniq so'rov bo'sh chiqsa qidiruv birma-bir
  kengaytiriladi — tuman → viloyat → butun O'zbekiston → qo'shimcha shartlarsiz → yaqin (ota) kasb — va har qadam
  foydalanuvchiga ochiq aytiladi ("Chilonzorda hozircha yo'q — butun Toshkent bo'yicha ko'rsatildi"). Kasb tushunilmasa-yu,
  hudud/maosh/grafik tushunilsa — shu shartlar bilan barcha kasblardan qidiradi. Hech narsa o'ylab topilmaydi.
- **Kasblar ro'yxatida yo'q so'z** (do'kon yoki kompaniya nomi, erkin lavozim — "korzinkaga ishga kirmoqchiman"): matndan
  kalit so'zlar ajratiladi (`src/features/find/ai-keywords.ts`: to'ldiruvchi so'zlar va hudud nomi tashlanadi, kelishik
  qo'shimchasisiz o'zak ham sinab ko'riladi) va e'lonlarning sarlavhasi, tavsifi, kompaniya nomidan qidiriladi — avval
  aytilgan hududda, bo'lmasa butun O'zbekistonda. Qaysi so'z bo'yicha topilgani aytiladi.
- Qidiruv kengaytirilgan javobda: "Aynan so'raganingiz chiqsa — Telegram'da xabar olish" (yozgan matni tayyor).
- **Umuman yo'q bo'lsa — halol javob va keyingi qadam:** "Yangisi chiqsa — Telegram'da xabar bering" (yozgan matni
  `/ai-alerts` formasida tayyor turadi) va "O'zim haqimda e'lon berish".
- **Sekin telefon himoyasi:** sahifa skriptlari yuklanmasdan "Topish" bosilsa, matn `/ai?q=…` sahifasiga boradi va savol
  o'sha yerda o'zi yuboriladi (avval sahifa shunchaki qayta ochilib qolardi). Maydon boshqarilmaydigan (uncontrolled) —
  oldindan yozilgan matn yo'qolmaydi.
- Admin → "Bosh sahifa": izohlar haqiqatga keltirildi (oynalar hozir faqat ish beruvchi bosh sahifasida; AI o'chirilsa —
  oddiy matnli qidiruv qoladi).
- Ishlatilmay qolgan kod olib tashlandi: `SeekerSectionList`, `getPopularProfessions`.

**Yaratilgan:** `e2e/specs/ai-search-relax.spec.ts` (7 test), `src/features/find/ai-keywords.ts` + `ai-keywords.test.ts` (6 test).
**O'zgartirilgan:** `src/features/landing/seeker-home.tsx` (qayta yozildi), `src/features/find/ai-find.ts`,
`src/features/find/components/ai-chat.tsx`, `ai-finder.tsx` (`variant="field"`), `src/app/ai/page.tsx`,
`src/features/ai/components/ai-hub.tsx`, `src/app/ai-alerts/page.tsx`, `ai-alerts-panel.tsx`, `section-tiles.tsx`,
`home-queries.ts`, `messages/*/easy.json`, `messages/*/admin.json`; E2E: `home`, `home-windows`, `admin-home`, `ai-finder`,
`entry`, `entry-flow`, `journeys`, `journey-apply`, `modes`, `sections`, `layout-overlap`, `no-ui-sound`, `responsiveness`.

**Qolgan muammo / ega amali:**
- Prod bazada 0 ta faol vakansiya — AI qanchalik aqlli bo'lmasin, ko'rsatadigan e'lon bo'lmasa "hozircha yo'q + xabar
  bering" chiqadi. Kontent kerak (birinchi ish beruvchilar, kanal orqali e'lonlar).
- Prod'da 0069–0075 migratsiyalar hali qo'llanmagan (`docs/RELEASE_CHECKLIST.md`).
- Admin → "Bosh sahifa"dagi ish izlovchi oynalari endi saytda ko'rinmaydi — admin panel qayta qurilganda olib tashlanadi.

**Keyingi aniq vazifa:** qobiqlar (mobilda hamburger va pastki menyu birga chiqmasin), keyin ish beruvchi bosh sahifasi
va natijalar sahifasi — shu sodda uslubda noldan.

## 2.0 bosh sahifa saytga chiqarildi (2026-11-11)

Ega ruxsati bilan PR #8 `main`ga qo'shildi (`1d5c564`), Vercel prod — READY, `/api/health` — ok.

## AI HR yordamchi — 0–5-bosqich (2026-11-11)

To'liq reja, arxitektura, maxfiylik va cheklovlar: `docs/AI_ASSISTANT.md`.

**Bajarildi:**
- **Suhbat dvigateli** (`src/features/assistant/`): model suhbat kontekstini o'qiydi, qidiruv asbobini chaqiradi, bazadan
  haqiqiy e'lonlar olinadi, javob oqim bilan keladi; AI ishlamasa — lug'at va shablon javob (4 tilda). `POST /api/assistant`.
- **Suhbat oynasi** (`ai-chat.tsx`): oqimli javob, yozish indikatori, to'xtatish, tavsiya savollar, xatolar va qayta urinish,
  tarix (qurilmada), nusxa olish, keyingi qadam havolalari.
- **Ish izlovchi / ish beruvchi:** profil konteksti, rezyume va vakansiya matni, suhbat savollari, nomzod qidirish.
- **Ovoz** (`ai-voice.ts`, `speech.ts`): katta mikrofon, holatlar, aytilgan matnni tekshirish, javobni o'qib berish va to'xtatish.
- **Tuzatildi (yo'l-yo'lakay topilgan):** hudud nomi kasb deb tushunilardi ("Samarqandda" → "Qog'ozgar"); mikrofon
  to'xtatilganda matn tekshirilmasdan yuborilib ketishi mumkin edi (tugma qayta ishlatilishi).

**Testlar:** Vitest 770+ o'tdi; E2E `assistant-api.spec.ts` (6), `assistant-chat.spec.ts` (6), AI qidiruv spec'lari; to'liq E2E
va CI natijasi — PR'da.

**Qolgan muammo:** haqiqiy Claude bilan suhbat stendda sinalmagan (kalit faqat prod'da) — chiqarilgandan keyin jonli tekshiruv
kerak (`docs/AI_ASSISTANT.md` → "Halol eslatma"). Ovoz brauzerga bog'liq (Telegram ichida ishlamaydi, o'zbekcha ovoz kam).

**Keyingi aniq vazifa:** ega qarori bilan — serverda nutq xizmati (hamma qurilmada ovoz); suhbat matnini e'lon formasiga
ko'chirish; keyin 2.0 qayta qurish davomi (qobiqlar, ish beruvchi bosh sahifasi).

## AI HR yordamchi saytga chiqarildi (2026-11-11)

Ega ruxsati bilan PR #9 `main`ga qo'shildi (`4137b44`). Ega keyingi nashrlar uchun doimiy ruxsat berdi ("so'rama"):
CI yashil bo'lsa chiqariladi; baza migratsiyasi va destruktiv amallar — avvalgidek faqat ega bilan.

## 2.0: ish beruvchi paneli, xush kelibsiz ekrani, cookie, Play Market (2026-11-11)

**Bajarildi:**
- **Ish beruvchi bosh sahifasi va paneli noldan** (`employer-head.tsx`, `employer-home.tsx`, `employer-dashboard.tsx`): bitta
  savol "Qanday xodim kerak?", yagona AI qidiruv maydoni (nomzodlar ichidan), 4 ta tez yo'l (Kunlik ishchilar · Yaqin atrofda ·
  Tajribali · Masofaviy), "Barcha nomzodlar", katta "Vakansiya joylash". Panelda keyin: ko'rsatkichlar, yangi arizalar, nomzodlar,
  faol vakansiyalar, bo'limlar. Olib tashlandi: fon surati, 8 ta plitka, admin oynalari, arizalar holati qatori, ikkinchi matnli
  qidiruv, AI PRO kartasi. O'lik kod o'chirildi (`service-tiles`, `section-tiles`, `home-windows` komponenti, `hero-backdrop`,
  `PipelineTiles`, `AiProRow`, hero rasm joylari).
- **Kirish soddalashtirildi** (`welcome-screen.tsx`): til → 3 slayd → rol o'rniga BITTA ekran — til qatori (bosilsa darhol) va
  ikkita rasmli karta "Ish qidiryapman" / "Ishchi qidiryapman" (egasi bergan suratlar; admin almashtira oladi) — bir bosishda o'z
  bosh sahifasiga, kirishsiz. Slaydlar ixtiyoriy ("Qanday ishlaydi?"). JS'siz ham ishlaydi (`/start/loading.tsx` olib tashlandi —
  oqimli chizish formani yashirardi).
- **Cookie:** `/cookies` sahifasi (4 tilda: har bir cookie, maqsadi, muddati; brauzer xotirasi; nima yo'q; boshqarish),
  bir martalik eslatma (pastki menyu ustida, `ib_consent`, 1 yil, testlarda ko'rsatilmaydi), footer havolasi, sitemap/robots.
  Maxfiylik siyosati yangilandi: AI yordamchi suhbati (serverda saqlanmaydi, AI xizmatiga uzatiladi), mikrofon (faqat tugma
  bosilganda, ovoz saqlanmaydi), cookie havolasi; sana 2026-11-11.
- **Play Market:** do'kon ikonasi (ilovaning o'z belgisi), feature graphic va 6 ta skrinshot (uz, ru) 2.0 dizaynda —
  `e2e/screens/play-store.shots.ts` bilan qayta yasaladi; `docs/PLAY_MARKET.md` yangilandi (ranglar, cookie, Data safety:
  AI suhbati va mikrofon qatorlari, tekshiruvchiga izoh); manifestga `screenshots` (`public/store`).

**Testlar:** Vitest 762; E2E 257/257 (yangi: xush kelibsiz ekrani 3 ta, cookie 2 ta; yangilandi: entry-flow, home-windows,
admin-home, modes, sections, journeys, entry).

**Qolgan muammo / ega amali:**
- Play Console: hisob, `.aab` (PWABuilder), imzo barmoq izi → Vercel `ANDROID_SHA256_CERT_FINGERPRINTS`, test hisobi —
  `docs/PLAY_MARKET.md` 0–4 bo'limlar. Shaxsiy hisobda 12 tester / 14 kun.
- Admin → "Bosh sahifa" oynalari muharriri saytga ta'sir qilmaydi — admin panel qayta qurilganda olib tashlanadi.

**Keyingi aniq vazifa:** qobiqlar (mobil hamburger + pastki menyu), natijalar va e'lon sahifalari — 2.0 uslubida; admin
panelni tozalash.
