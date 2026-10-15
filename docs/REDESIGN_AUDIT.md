# Qayta loyihalash — audit (R-A, 2026-10-15)

Asos: commit `7f3c9dd`, branch `claude/gallant-thompson-q70fo3`. Next 16.3.8, React 19.2.8, Supabase (Postgres 16), Tailwind 4.
Muhit: lokal izolyatsiyalangan stend (`e2e/stack/up.sh`) + demo ma'lumotlar (12 faol vakansiya, 8 ishchi). Skrinshotlar:
390 va 1280 px, mehmon / ish qidiruvchi / ish beruvchi (`docs/screenshots/redesign/before/`).

Belgilar: **XATO** — kod yoki brauzer bilan tasdiqlangan; **UX** — yaxshilanish (xato emas); **XAVF** — ehtimol bor,
tekshirilmagan yoki dizayn bo'yicha.

## 1. Bosh sahifa va navigatsiya

| # | Turi | Topilma | Dalil |
|---|---|---|---|
| A1 | UX | Bosh sahifada **bitta ham haqiqiy vakansiya yo'q**: rejim tanlash, rasmli oynalar, "O'zingiz haqingizda e'lon bering", "Ish e'lonlari" kartasi, katta AI PRO kartasi. Ish ko'rish uchun 2–3 bosish kerak | `src/features/landing/home-three.tsx`, skrinshot `g-home-390` |
| A2 | UX | Rejim tanlanmagan mehmon avval "Ish qidiryapman / Xodim qidiryapman" tanlashi kerak — vakansiyalar darhol ko'rinmaydi | `home-three.tsx:59-62`, `mode-chooser.tsx` |
| A3 | UX | Kompyuterda bosh sahifa tor ustun (~768 px), ikki tomonda bo'sh joy | `g-home-1280` |
| A4 | UX | Pastki menyu barcha rollar uchun bir xil: Bosh sahifa · Ish/Xodim topish · Saqlanganlar · Kabinetim. **Arizalar va takliflar menyuda yo'q** (Kabinet ichida); ish beruvchida "Vakansiyalar" ham yo'q | `app-shell.tsx:24-43` |
| A5 | UX | Ish beruvchi uchun yangi arizalar soni (`unread_counts.applications`) olinadi, lekin hech qayerda ko'rsatilmaydi | `unread-counts.ts`, `app-shell.tsx` |
| A6 | XATO | `/employer` 390 px da 36 px gorizontal siljish (overflow) | skrinshot logi `e-employer-390 overflow=36` |
| A7 | UX | AI PRO taklifi bosh sahifada katta va birinchi ekranga yaqin — talab bo'yicha ikkinchi darajali bo'lishi kerak | `g-home-390` |

## 2. Qidiruv

| # | Turi | Topilma | Dalil |
|---|---|---|---|
| S1 | UX | Qidiruv qatori matnni faqat **kasbga** aylantiradi; kompaniya nomi yoki erkin lavozim bo'yicha natija chiqmaydi ("tushunilmadi" + kasb tanlash). Kompaniya bo'yicha qidiruv faqat eski `search_vacancies_v2` da bor | `src/app/search/page.tsx` (smartResolveQuery), `0038:79` |
| S2 | UX | Natijalar sahifasida faol filtrlar alohida ko'rinmaydi (faqat "Filtr" tugmasidagi son), bittadan o'chirish yo'q | `find-page.tsx` |
| S3 | XAVF | Kunlik ishlar uchun sana/vaqt maydoni yo'q (faqat `salary_type='daily'`) — "kunlik" faqat to'lov davri. Sana/vaqt qo'shish — migratsiya | audit: `0001:30`, `vacancy-post.tsx:495` |
| S4 | XAVF | `simple_search_workers` mehmonga ochiq va telefoni "hammaga" ochiq ishchilarni 50 tadan qaytaradi, so'rov cheklovi yo'q (rozilik bilan ochilgan raqamlar ommaviy yig'ilishi mumkin) | `0047:445, 461` |

## 3. Kartalar va tafsilot

| # | Turi | Topilma | Dalil |
|---|---|---|---|
| C1 | UX | Natija kartasi (`JobResultCard`) tasdiqlangan ish beruvchi belgisini ko'rsatmaydi, garchi `employer_verified` ma'lumoti kelsa ham | `result-cards.tsx:34, 143` |
| C2 | XATO | Ishbay maosh qo'shimchasi bo'sh joysiz yopishadi: "5 000 000 so'mishbay" (`/oy`, `/kun` dan farqli, `ishbay` da ajratgich yo'q); kirill o'zbekchada `/oy`, `/kun`, `/soat` lotincha qolgan | `messages/*/enums.json` `salary_type_suffix`, `salary-text.tsx` |
| C3 | UX | `WorkerCard` maoshni 💰 emoji + ikonka bilan ko'rsatadi (brend qoidasi: ikonka yoki emoji), to'lov davri yo'q | `worker-card.tsx:62, 91` |
| C4 | UX | Taklif kartasi maoshni to'lov davrisiz ko'rsatadi | `offer-card.tsx` |

## 4. Ariza, taklif, xavfsizlik (backend)

| # | Turi | Topilma | Dalil |
|---|---|---|---|
| B1 | XATO | `apply_to_vacancy` faqat `status='active'` ni tekshiradi, **`expires_at` ni emas**. Muddati o'tgan, lekin cron hali yopmagan vakansiyaga ariza yuboriladi (cron soatda bir; pg_cron bo'lmasa umuman yopilmaydi). Qidiruv ham `expires_at` ni tekshirmaydi | `0008_functions.sql:591`, `0055:131-139`, `0015:45` |
| B2 | XATO | `respond_offer` taklif qabul qilinganda vakansiya holatini tekshirmasdan `offered` ariza yaratadi — yopilgan vakansiyaga ariza paydo bo'ladi | `0008:715-718` |
| B3 | OK | Takroriy ariza: `unique (vacancy_id, worker_id)` | `0007:14` |
| B4 | OK | Ariza holati: egalik `can_edit_vacancy`, faqat oldinga, yakuniy holatlar qaytmaydi; to'g'ridan-to'g'ri UPDATE RLS'da yo'q | `0008:630-643` |
| B5 | OK | Telefon: `can_view_phone` / `get_contact`; so'rov — rozilik bilan | `0008:6-71`, `0022` |
| B6 | OK | To'lov: narx serverda, Payme/Click imzo tekshiruvi, takroriy callback idempotent, kalit yo'q bo'lsa to'lov tugmasi yo'q (soxta "muvaffaqiyatli" yo'q) | `0046`, `0019`, `providers.ts` |
| B7 | XAVF | Admin MFA talabi `admin_mfa_required` sozlamasi bilan o'chirilishi mumkin; `updateSetting` istalgan kalitni qabul qiladi | `0052:12`, `admin/schema.ts:138` |
| B8 | XATO (kichik) | Kasblar daraxtini o'zgartirish va bosh sahifa rasmi yuklash audit jurnaliga yozilmaydi | `admin/actions/professions.ts:57,89`, `home.ts:63` |
| B9 | XAVF | Onboardingdagi fayllar (sertifikat) ochiq `portfolio` bucketiga yuklanadi — URL'ni bilgan har kim ko'radi | `onboarding/components/file-upload.tsx:41` |

## 5. Kirish, onboarding, formalar

| # | Turi | Topilma | Dalil |
|---|---|---|---|
| F1 | XATO | Ariza tugmasidan kirishga yuborilganda ayrim yo'llarda `?apply=1` yo'qoladi (kirgach oyna ochilmaydi); profil talab qilinsa `/onboarding/worker` qaytish manzilisiz | `vacancy-actions.tsx:85, 109, 112`, `onboarding/actions.ts:484` |
| F2 | XAVF | Mobil klaviatura: `visualViewport`/`interactive-widget` yo'q — pastki menyu va yopishqoq tugmalar klaviatura ustida qolishi mumkin (real telefonda tekshirilmagan) | `layout.tsx:45-53`, audit 8 |
| F3 | UX | Ruscha "Посуточно" (to'lov davri) ijara so'zi kabi o'qiladi — "За день" aniqroq | `messages/ru/easy.json` `vacancy.pay_daily` |
| F4 | OK | Telefon `+998` bilan formatlanadi (libphonenumber), kirishdan keyin `next` xavfsiz qaytadi, e'lon qoralamasi akkauntga bog'langan, AI matni tekshirib tasdiqlanadi, AI ishlamasa forma ishlaydi | audit 1, 3 |
| F5 | OK | Ovozli tugma/yordamchi yo'q (faqat chatdagi ovozli xabar) | audit 5 |
| F6 | OK | uz/ru kalitlari 25 faylda to'liq mos (0 ta yetishmaydi) | audit 6 |

## 6. Dizayn tizimi

| # | Turi | Topilma |
|---|---|---|
| D1 | OK | Tokenlar bitta joyda (`globals.css`): oq kartalar, och fon `#f6f8fb`, asosiy ko'k `#1d5fe0`, holat ranglari, radius/soya shkalasi; kontrast testlari bor (`a11y.spec.ts`) |
| D2 | UX | Brend nomi markaziy konfiguratsiyada emas — kodda 31 joyda qo'lda yozilgan (`layout.tsx`, `top-bar.tsx`, JSON-LD, metadata, bot, promo) |
| D3 | UX | `text-4xl` shkaladan tashqari (bosh sahifa, billing); ish beruvchi panelida katta ko'k banner va KATTA HARFLI sarlavha |

## 7. Bog'liqliklar

`npm audit --omit=dev`: **0 zaiflik**. Yangi versiyalar: Next 16.4.1, React 19.3.1 (aniq pin qilingan, framework — alohida
sinov bilan), TypeScript 7 / ESLint 10 / framer-motion 14 (major — bu bosqichda yo'q), qolganlari patch/minor (zod, supabase-js,
radix-ui, lucide, react-query, react-hook-form, vitest…). Qaror: semver-mos patch/minor yangilanadi va testlar bilan tekshiriladi;
Next/React/Playwright va major versiyalar bu bosqichda o'zgartirilmaydi (zaiflik yo'q, xavf foydadan katta).

## 8. Reja (bosqichlar)

- **R-B** dizayn tokenlari, brend konfiguratsiyasi, rolga xos navigatsiya (ish qidiruvchi: Ishlar · Saqlanganlar · Arizalar · Profil;
  ish beruvchi: Bosh sahifa · Vakansiyalar · Nomzodlar · Profil), A6.
- **R-C** bosh sahifa (qidiruv, tez filtrlar, haqiqiy ro'yxat, kasblar, AI PRO ikkinchi darajada; ish beruvchi paneli), qidiruvda
  kompaniya/lavozim matni (S1), faol filtr chiplari (S2), kartalar (C1–C4).
- **R-D/E** ariza qo'riqlari (B1, B2 — migratsiya, production uchun alohida tasdiq), kirishdan keyin ariza oynasi (F1), klaviatura (F2),
  admin audit (B8), ish beruvchi paneli.
- **R-F/G** 6 kenglikda tekshiruv, uz/ru, a11y, lab o'lchovlari, yakuniy hisobot.

## 9. Holat (bosqichlar bo'yicha)

| # | Holat | Qayerda | Qanday tekshirildi |
|---|---|---|---|
| A1 | ✅ R-C | bosh sahifada qidiruv, tez filtrlar va 8 tagacha haqiqiy e'lon ("Sizga mos ishlar" — profildagi kasb va viloyat bo'yicha, sababi yozilgan; aks holda "Yangi ishlar") | `home.spec`, `modes.spec`, skrinshot `after/` |
| A2 | ✅ R-C | rejim tanlanmagan mehmon — ish qidiruvchi ko'rinishi, savol ekrani yo'q; ish beruvchi — almashtirgich + tasdiq | `modes.spec` |
| A3 | ✅ R-C | kompyuterda ikki ustun: ro'yxat + bozor paneli | skrinshot 1280 |
| A4 | ✅ R-B | rolga xos pastki menyu | `home.spec`, `modes.spec` |
| A5 | ✅ R-B/R-C | yangi arizalar soni — "Vakansiyalar" belgisida va panelda ("Yangi arizalar" → `/employer/applications`) | `modes.spec` |
| A6 | ✅ R-B | `/employer` siljish 36 → 0 px | skrinshot logi |
| A7 | ✅ R-C | AI PRO — ro'yxatdan keyin bitta ixcham qator | `home.spec` (tartib) |
| S1 | ✅ R-C | kasbga aylanmagan matn → sarlavha, tavsif va kompaniya nomi bo'yicha natijalar (`search_vacancies_v2`), topilmasa — avvalgidek kasb tanlash | `home.spec` (kompaniya nomi) |
| S2 | ✅ R-C | faol filtrlar chip sifatida, bittadan yoki hammasi olib tashlanadi | `results-page.spec` |
| C1 | ✅ R-C | kartada kompaniya va faqat haqiqatan tasdiqlangan bo'lsa belgi; karta tartibi: nomi → maosh → kompaniya → hudud → 2 tagacha belgi (sig'magan belgi kesilmaydi — butunlay yashiriladi) | `home.spec`, `compact-cards.spec` |
| C3 | ✅ R-C | 💰 o'rniga ikonka + "/oy" | kod |
| C4 | ⏳ R-D/E | taklifda to'lov davri yo'q (jadvalda ustun yo'q — migratsiya kerak) | — |
| D2 | ✅ R-B | `src/config/brand.ts` | grep |
| D3 | ✅ R-C | ish beruvchi panelidagi KATTA HARFLI banner o'rniga oddiy "Vakansiya joylash" tugmasi; bosh sahifa sarlavhasi `text-2xl/3xl` | skrinshot |
| — | ✅ R-C | mobil inputlar 15 → 16 px (iOS fokusda kattalashtirmaydi) | `input.tsx`, `select.tsx` |
| X1 | ✅ R-C (yangi topilma, **XATO**) | `worker_profiles → profession_nodes` bog'lanishi 0028 dan beri PostgREST'da ikki ma'noli (`worker_professions` ko'p-ko'p, `PGRST201`): so'rov jim yiqilardi — `/cabinet/matches` da mos nomzodlar doim bo'sh, `/cabinet/alerts` da kasb nomi yo'q, Telegram'dagi "mos nomzod" xabarlari tashlab ketilardi. FK nomi aniq ko'rsatildi (4 joy) | `matches.spec`, PostgREST so'rovi (oldin `PGRST201`, keyin natija) |
| B8 | ↺ qayta baholandi | kasblar daraxtidagi yaratish, ko'chirish, nomini o'zgartirish va o'chirish/yoqish 0028 dagi trigger bilan auditga yoziladi; oyna rasmi saqlanganda `settings.update` yoziladi. Yozilmaydi: sinonimlar, ikonka, "mashhur", tartib (kichik) — R-D/E | `0028:474-488`, `admin-home.spec` |
