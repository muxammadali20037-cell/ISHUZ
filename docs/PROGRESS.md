# Jarayon (PROGRESS)

Har bir bosqichdan keyin yangilanadi. Reja — `docs/IMPLEMENTATION_PLAN.md`.

| Bosqich | Holat | Sana |
| --- | --- | --- |
| Barqarorlashtirish (Next 16.4.5, 0074–0075, health, Sentry) | Kod tayyor, CI yashil · **ega amali kutilmoqda** | 2026-11-07 |
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

## AI HR yordamchi — 0 va 1-bosqich: audit, suhbat dvigateli (2026-11-11)

To'liq reja va holat: `docs/AI_ASSISTANT.md`.

**Bajarildi:** audit; suhbat dvigateli (`src/features/assistant/`): model suhbat kontekstini o'qiydi, qidiruv asbobini
chaqiradi, bazadan haqiqiy e'lonlar olinadi, javob oqim bilan keladi; AI ishlamasa — lug'at va shablon javob (4 tilda);
`POST /api/assistant` (NDJSON oqimi, CSRF/limit/blok himoyasi). `aiFind` yadrosi alohida modulga chiqarildi.

**Testlar:** Vitest 752 o'tdi (24 ta yangi); E2E `assistant-api.spec.ts` 5/5; AI qidiruv spec'lari 16/16 (refaktordan keyin).

**Qolgan muammo:** haqiqiy Claude bilan suhbat stendda sinalmagan (kalit faqat prod'da). Oyna (UI) hali eski — foydalanuvchi
yangi dvigatelni 2-bosqichdan keyin ko'radi.

**Keyingi aniq vazifa:** 2-bosqich — suhbat oynasini yangi dvigatelga ulash (oqimli matn, yozish indikatori, tavsiya savollar).
