# Tezlik va qotishlar — reproduksiya, o'lchov, avval/keyin

Sana: 2026-10-12. Bu fayl C7 (qotish va javobsiz qolish) bo'yicha **o'lchangan** natijalarni saqlaydi. Har band uchun:
ekran → amal → muhit → dalil → avval → keyin. Reproduksiya qilinmagan muammo "tuzatildi" deb yozilmaydi.

## Sinov muhiti

- Lokal izolyatsiyalangan stend (`bash e2e/stack/up.sh`): production build, PostgREST, Auth/Storage emulyatori.
- Brauzer: Chromium (Playwright 1.56.1), oyna 390×844.
- **CPU 4× sekinlashtirilgan** (CDP `Emulation.setCPUThrottlingRate`) — o'rta Android telefoniga yaqin.
- Bu **laboratoriya** natijasi. Real qurilmadagi field ko'rsatkichlar (p75 LCP/INP/CLS) emas.
- Takrorlash: `npx playwright test -c e2e e2e/specs/responsiveness.spec.ts`. Natijalar `e2e/.stack/responsiveness/*.json` ga yoziladi.
- Boshqa build'ga qarshi o'lchash (masalan, eski commit): `E2E_BASE_URL=http://localhost:3301 npx playwright test …`.

## Natijalar

| # | Ekran va amal | Turi (C7) | Dalil | Avval | Keyin | Holat |
|---|---|---|---|---|---|---|
| Q1 | Har qanday sahifa o'tishi (bosh → qidiruv → "Ish e'lonlari") | UI: o'tish animatsiyasi bosishni bloklaydi | `document.startViewTransition` davomiyligi; URL almashgach yangi havola qachon bosiladi | View Transition **538 / 478 ms**; yangi sahifa **359 / 484 ms** bosishni qabul qilmaydi | View Transition **yo'q**; 302 / 147 ms — bu Playwright'ning element barqarorligini kutishi, bloklash emas | ✅ tuzatildi |
| Q2 | Qidiruv natijalari ro'yxati | UI: animatsiya natijani kechiktiradi | Barcha `.pop-list` animatsiyalari tugash vaqti | **420 ms** (sakrovchi, ketma-ket kechikish 560 ms gacha) | **1 ms** (150 ms yumshoq paydo bo'lish, ketma-ketliksiz) | ✅ |
| Q3 | E'lon formasi → kasb qidiruvi: "bux" yozib, javob kelmasdan "b" ga qisqartirish | Network: bekor qilingan so'rov holatni tozalamaydi | 2.5 s dan keyin `svg.animate-spin` soni | **1** — aylanuvchi belgi abadiy qoladi | **0**; eski so'rov `AbortController` bilan bekor, javob tartib raqami bilan tekshiriladi | ✅ |
| Q4 | Ishchi e'loni → "E'lonni joylash", tarmoq uzilgan | Network: server action istisnosi | Sahifada nima ko'rinadi, tugma holati | Butun sahifa **"Nimadir xato ketdi"**, forma va tugma yo'qoladi | Forma joyida, **"Internet aloqasi uzildi… javoblaringiz saqlandi — yana bosing"**, tugma ishlaydi; internet qaytgach o'sha tugma bilan **bitta** e'lon | ✅ |
| Q5 | Javob kelmasa (server osilib qolsa) | Network: cheksiz kutish | unit: `callAction` 30 s dan keyin `timeout` | Chegara yo'q — tugma abadiy "kutilmoqda" | 30 s → "Javob kechikdi… yana bosing, ikki marta joylanmaydi" (vakansiya `clientRef`, ishchi — upsert) | ✅ |
| Q6 | 20 marta bosh ↔ qidiruv o'tish | Listener/DOM sizib chiqishi | CDP `JSEventListeners`, `Nodes` (1-, 10-, 20-aylana) | 393 → 395; 1230 → 1283 | 395 → 395; 1381 → 1381 | ✅ sizib chiqish **yo'q** (avval ham yo'q edi) |
| Q7 | E'lon formasi: kasb yozish, "Tanlash", "Davom etish" | Main thread | Event Timing (faqat `interactionId > 0`), 3 run | ovozli build: harf maks 40–64 ms; bosish maks 96–120 ms | harf maks 56–72 ms; bosish maks 88–144 ms (bir run 216 ms) | ➖ farq **yo'q**; eng sekini — "Davom etish" (keyingi qadamni chizish, klik ishlovi 47–67 ms). 200 ms maqsad ichida |

| Q8 | Kirgan foydalanuvchi: bosh sahifa → `/search` | Network: ochiq qolgan prefetch (ulanish band) | Log-proksi: server javobi tugash vaqti; brauzerdagi tugamagan so'rovlar; 20 marta takrorlash | Server 24–29 ms da javob bergan, brauzerda 2 ta `?q=` prefetch **15 s+ ochiq**; 1–2-urinishda takrorlanadi | `prefetch={false}` (yo'naltiriladigan namunaviy havolalar) — **0/20** | ✅ (C8.2) |

Ovoz olib tashlanishi (6493eb6) **bosish kechikishini sezilarli o'zgartirmadi** (Q7). U mahsulot talabi sifatida bajarildi, tezlik
yaxshilanishi deb hisoblanmaydi.

## Tuzatishlar (fayllar)

- **Q1:** `src/app/template.tsx` o'chirildi (sahifa darajasidagi `<ViewTransition>`); qidiruv qadamlaridagi `<ViewTransition>`
  (`src/app/search/page.tsx`); barcha `transitionTypes`; `globals.css` dagi view-transition kadrlar. Bosilganini yuqoridagi
  ingichka chiziq (`NavProgress`) darhol ko'rsatadi — u bosishni bloklamaydi (`pointer-events: none`).
- **Q2:** `.pop-list` — 150 ms opacity, kechikishsiz; forma qadamlari 150 ms; `.press` — 120 ms, sakrashsiz.
- **Q3:** `src/features/professions/components/profession-picker.tsx` — `AbortController` + `searchSeq`.
- **Q4/Q5:** `src/lib/action-call.ts` (`callAction`: istisno → `network`/`offline`, 30 s → `timeout`) + 4 unit test;
  `worker-post.tsx`, `vacancy-post.tsx`; xato matnlari 4 tilda (`easy.errors.offline|network|timeout`).

## Qolganlar (o'lchanmagan yoki keyingi ekranlar bosqichida)

- ~~`callAction` hozircha faqat ikki e'lon formasida~~ → C8.10 da barcha mijoz server amallari (98 chaqiruv) o'tkazildi.
- 429/503: server action javobi xato bo'lsa, natija `network` bo'ladi (Q4 bilan bir xil yo'l). Alohida test — NOT_RUN.
- Telegram ichidagi klaviatura va safe area (qabul #30) — haqiqiy qurilma kerak, NOT_RUN.
- Real qurilmadagi field web-vitals — NOT_RUN (Vercel Speed Insights ulanishi kerak).

## D1 · Qadamdan qadamga o'tish (2026-10-12)

Foydalanuvchi: "qaysidir bosqichni bosganda sekin o'tyapti". O'lchov: `node e2e/perf/steps.mjs 3` (lab, field EMAS).

**Sharoit:**
- 390×844, CPU 4× sekin, 1,6 Mbit/s;
- brauzer↔server RTT 150 ms ("Slow 4G") yoki 400 ms (O'zbekistondan uzoq server, kuchsiz tarmoq) — `STEPS_RTT_MS`;
- har bir Supabase so'roviga +60 ms (shlyuz `E2E_DB_LATENCY_MS=60`, Vercel→Supabase masofasi taxmini).

**Ko'rsatkichlar** (mediana, 3 o'tish). Vaqt sahifaning o'zida o'lchanadi — haqiqiy `click` hodisasidan:
- **javob** — ekranda birinchi o'zgarish (kerakli qadam yoki kutish belgisi);
- **tayyor** — kerakli qadam ko'rindi.

| Qadam | Oldin (1a0a556) javob / tayyor, RTT 400 | Keyin javob / tayyor, RTT 400 | Keyin, RTT 150 | Server so'rovi (oldin → keyin) |
|---|---|---|---|---|
| Bosh sahifa → kasb qadami | 719 / 752 ms | **152** / 788 ms | 156 / 509 ms | 2 → 2 |
| Kasb → viloyat | 551 / 572 ms | **129 / 134 ms** | 115 / 120 ms | 1 → **0** |
| Viloyat → tuman | 526 / 536 ms | **74 / 84 ms** | 69 / 73 ms | 1 → **0** |
| Tuman → natijalar | 526 / 533 ms | **42** / 526 ms | 42 / 277 ms | 3 → 3 |
| E'lon formasi: 4 ta qadam | 60–125 ms | 50–115 ms (o'zgarmadi — mijozda edi) | — | 0 |

**Sabab:** qidiruvning har qadami serverga to'liq so'rov edi. So'rov kelguncha ekranda eski qadam turib qolardi, faqat
tepada ingichka chiziq ko'rinardi. Haqiqiy tarmoqda va server "uyg'onganda" (cold start) bu bir necha soniyagacha cho'ziladi.

**Tuzatish:**
- `src/features/find/components/find-steps.tsx` — kasb, viloyat va tuman qadamlari bitta mijoz komponentida.
  - URL `history.pushState` bilan yangilanadi: Orqaga/Oldinga, sahifani yangilash va havolani ulashish o'zgarmadi.
  - Viloyat va tumanlar ma'lumotnoma keshidan bir marta keladi.
  - Natijaga olib boruvchi qatorda `useLinkStatus` aylanuvchi belgisi ko'rsatiladi.
- `src/app/search/loading.tsx` — bosh sahifadan qidiruvga va qidiruv ichida server javobi kutilganda darhol skelet.
- Test: `e2e/specs/step-speed.spec.ts`:
  - kasb → viloyat → tuman uchun server so'rovi 0;
  - Orqaga/Oldinga/«Orqaga» tugmasi va yangilash to'g'ri ishlaydi;
  - natija 1,5 s kechiksa, 1 s ichida kutish belgisi chiqadi.

**Qolgan:**
- Natijalar va bosh sahifadan birinchi o'tish serverga bog'liq. Haqiqiy production vaqti (Vercel hududi, cold start)
  bu muhitdan o'lchanmadi, chunki tarmoq siyosati production manziliga chiqishga ruxsat bermaydi — NOT_RUN.
- Eng qisqa yo'l: Vercel Speed Insights yoki telefonda Telegram ichida bir marta yozib olish.

## K · Sahifa o'tishi va bosishga javob (2026-10-14)

Operator paneli (AVTODROM) uslubi: sahifa yuklanayotganda qobiq (yuqori panel, menyu) joyida, kontent 350 ms da pastdan
chiqadi. Q1 dagi muammo qaytmaydi — bu View Transition emas, oddiy CSS animatsiya (ustiga parda yo'q, bosish bloklanmaydi,
`fill: backwards`). Oldin `/saved` → "Ish topish" (CPU 4×, RTT 150 ms) 134–593 ms oralig'ida yuqori panel va menyu
yo'qolardi; keyin — butun vaqt joyida, bosilgan bo'lim 200 ms kadrida faol. Tafsilot va kadrlar — hisobot §19,
test — `e2e/specs/motion.spec.ts`.

