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

- `callAction` hozircha faqat ikki e'lon formasida. Boshqa server amallari (ariza, taklif, chat, sozlamalar) C8 tartibida
  har ekranni yakunlashda ko'chiriladi.
- 429/503: server action javobi xato bo'lsa, natija `network` bo'ladi (Q4 bilan bir xil yo'l). Alohida test — NOT_RUN.
- Telegram ichidagi klaviatura va safe area (qabul #30) — haqiqiy qurilma kerak, NOT_RUN.
- Real qurilmadagi field web-vitals — NOT_RUN (Vercel Speed Insights ulanishi kerak).
