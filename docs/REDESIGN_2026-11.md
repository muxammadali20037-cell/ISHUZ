# Redizayn 2026-11 — "keyingi avlod" ko'rinishi (5 ta namuna asosida)

Egasi 2026-11-01 da beshta namuna rasm va "NEXT-GENERATION SMART EMPLOYMENT ECOSYSTEM" spetsifikatsiyasini berdi:
"profesinla darajada shu rasmga ohshatib qil". Har bir namuna — ilovaning tegishli ekraniga. Qoidalar o'zgarmadi: soxta raqam,
soxta avatar, soxta "AI moslik foizi", soxta logotip yo'q; hamma son va ro'yxat — bazadan; xato bo'lsa ko'rsatilmaydi.

| Namuna | Ekran | Nima qilindi |
|---|---|---|
| Jobio (bosh sahifa) | `/` mehmon — `features/landing/market/hero.tsx` | Oq fon, katta sarlavha "To'g'ri ish. To'g'ri inson. **Bitta platformada.**" (oxirgi qator ko'k), bir jumlali izoh, ikki tugma (to'ldirilgan "Ish qidiraman", chiziqli "Ish beruvchiman"). Kompyuterda o'ngda katta ko'k doira: admin surati (`home_photo`) yoki **haqiqiy** 3 ta yangi vakansiya (bosiladi); suzuvchi kartada haqiqiy raqamlar (faol vakansiyalar, ishchi e'lonlari — 0 bo'lsa yo'q). Qidiruv paneli hero chegarasida (kulrang maydonlar, belgilar bilan), ostida "Tezkor:" filtrlar. |
| Talently (vakansiya) | `/jobs/[slug]` — `features/jobs/components/vacancy-detail.tsx` | Bitta sarlavha kartasi: logo, kompaniya (tasdiqlangan bo'lsa — belgi), nom, soha › kasb, shartlar qatori (bandlik · grafik · joy), katta maosh, kompyuterda amallar qatori ("Ariza yuborish" · "Saqlash" · "Ulashish"), raqamlar qutisi (tajriba · arizalar · joylangan · ko'rishlar — hammasi haqiqiy). Bo'limlar bitta kartada ajratgichlar bilan. O'ng ustun: "Nima uchun sizga mos?" (faqat ish izlovchi profili bo'lsa, hisoblangan sabablar bilan), aloqa, "O'xshash vakansiyalar". |
| Hirelly (dashboard) | kirgan foydalanuvchi, kompyuter — `components/shared/app-shell.tsx` (`SideNav`), `app-frame.tsx`, `features/landing/seeker-dashboard.tsx` | Chap to'q ko'k yon menyu (lg+): ish izlovchi — Bosh sahifa · Vakansiyalar · Arizalarim · Saqlanganlar · Xabarlar · Profil; ish beruvchi — Bosh sahifa · Vakansiyalarim · Arizalar · Nomzodlar · Xabarlar · Kompaniya · Profil; "Boshqa": Bildirishnomalar · Sozlamalar · Yordam (hisoblagichlar — haqiqiy o'qilmaganlar). Ish izlovchi bosh sahifasida "Mening faoliyatim": 4 raqam kartasi (yuborilgan · ko'rib chiqilmoqda · suhbat va takliflar · saqlanganlar) va "So'nggi arizalar" (holat belgisi bilan) / "Saqlangan vakansiyalar" panellari. Ariza ham, saqlangan ham bo'lmasa — bo'lim yo'q. Telefon/planshet — avvalgidek pastki menyu. |
| Hiring Flow (nomzodlar) | `/employer/applications` | Bosqich kartalari (yangi · ko'rib chiqilmoqda · suhbat va taklif · ishga olingan; jami arizalardagi ulushi chizig'i bilan), holat bo'yicha filtr (`?holat=`, sonlari bilan), jadval (nomzod · vakansiya · sana · holat). "AI ball" va "reyting yulduzlari" — yo'q (bunday ma'lumot yo'q; soxta qo'yilmaydi). |
| Outreach (onboarding) | `/start/rol`, `/onboarding/employer`, `/onboarding/worker` | Markazda "QADAM 1 / 4" va bo'lakli chiziq, markazdagi savol va izoh. Ish beruvchi turi — 3×2 kartalar (chap yuqorida belgi katakchasi, markazda belgi, nom, izoh). Rol tanlash — kompyuterda ikki karta yonma-yon. |

## "Mening dunyom" (egasi, 2026-11-01 kechqurun)

"Odam kirganda o'z dunyosiga kirsin, o'sha yerda dunyosini yaratsin, ilovada doim band bo'lsin; nimalarga qiziqishi va kasblari
bo'yicha tahlil qilib, o'sha dunyoga olib kirish kerak — Telegram'da ham, telefonda ham."

| Qism | Fayl | Nima qiladi |
|---|---|---|
| Qiziqishlar (0073) | `supabase/migrations/0073_profile_interests.sql` | `profile_interests` (faqat egasi o'qiydi), `set_my_interests(uuid[])` — 1–8 soha, to'liq almashtiradi, mehmonga yopiq. SQL test: `supabase/tests/profile_interests.test.sql`. |
| "Dunyongizni yarating" | `/dunyo` — `features/world/components/world-builder.tsx` | 3 qadam ("Outreach"): sohalar (e'loni ko'plari birinchi, har birida haqiqiy son) → hudud → "Dunyongiz tayyor!" (tanlangan sohalardagi faol vakansiyalar soni, qilinmagan keyingi qadamlar: CV, Telegram xabarlari). Sayt sarlavhasi va menyusiz — telefonda va Telegram Mini App'da to'liq ekran (safe-area, Telegram "orqaga" tugmasi, muvaffaqiyatda tebranish). |
| Bosh sahifadagi dunyo | `features/world/components/my-world.tsx` | Qiziqish yo'q — "Dunyongizni yarating" taklifi (mehmonga ham; kirgach o'sha oqim). Bor — "Sohalaringizda N ta faol vakansiya", soha plitkalari (son bilan), har soha bo'yicha eng yangi 3 ta e'lon (hududda, bo'lmasa butun mamlakatda; bugungilari — "Yangi"). |
| "Bugungi rejangiz" | `features/world/queries.ts` (`getDailyPlan`) | Har kuni yangilanadigan 5 qadam — hammasi haqiqiy holatdan: qiziqishlar tanlangan; profil to'liqligi (%), bugun saqlangan vakansiya, bugun yuborilgan ariza, Telegram bot ulangan. Soxta "streak", ball yoki mukofot yo'q. |

E2E: `e2e/specs/world.spec.ts` (mehmon → kirish; yaratish oqimi; bazada 2 ta qiziqish; hudud eslab qolinadi; bosh sahifa moslashadi).

## Ataylab qilinmagan (va nega)

- **Odam surati** (Jobio'dagi kabi): tashqi foto banklari tarmoqdan yopiq va begona odam suratini "bizning foydalanuvchi" deb
  ko'rsatish halol emas. Admin → Kontent → Kirish ekranlari → **"Bosh sahifa: o'ngdagi surat"** (4:5, 1200×1500, odam markazda)
  yuklansa — ko'k doira ustida o'sha surat chiqadi. Yuklanmaguncha — haqiqiy yangi vakansiyalar.
- **Avatarlar to'plami** (Jobio'dagi "+" kartasi): haqiqiy foydalanuvchi suratlarini ruxsatsiz ko'rsatib bo'lmaydi — o'rniga
  haqiqiy raqamlar kartasi.
- **"Match Score: 92%"** (Talently) va **"AI Score"** (Hiring Flow): foiz faqat profildan hisoblangan bo'lsa (mavjud `MatchRing`)
  — ish izlovchi profili bo'lmasa karta yo'q.
- **"Ikkala imkoniyatdan ham foydalanaman"** (spetsifikatsiya): bitta hisobda ikkala rol allaqachon bor (Kabinetim → "Rolni
  o'zgartirish"); uchinchi tugma yangi hech narsa qilmasdi — rol ekranidagi izoh shuni aytadi.

## Ma'lumotlar bazasi

Dizayn qismi uchun migratsiya yo'q; "Mening dunyom" — 0073 (yuqorida). Yangi so'rovlar mavjud jadvallardan o'qiydi: `getApplicationStageCounts` (arizalar holati),
`getWorkerApplications` + `listSavedJobs` ("Mening faoliyatim"), `findJobs` (hero ro'yxati).

## Tekshiruv

typecheck · lint · unit (brend qo'riqchisi va kontrast bilan) · E2E (390 px) · ustma-ust tushish auditi; skrinshotlar —
`docs/screenshots/redesign-2026-11/`.

## "SAT MASTER" uslubi (egasi, 2026-11-04) — tarmoq `claude/sat-uslub`

Egasi: "https://sat-iota-nine.vercel.app/dashboard/subscription — Ish topdim'ning hamma dizaynini shu bilan bir xil qil, tugmani
bosganda boshqa oynaga o'tish tezligini ham". Namuna — egasining o'z loyihasi (`muxammadali20037-cell/sat-`); tokenlar va qobiq
uning kodidan (`src/app/globals.css`, `components/layout/app-shell.tsx`, `route-states.tsx`) olindi.

| Qism | Nima o'zgardi |
|---|---|
| Ranglar | fon `#f5f7fb`, matn `#172033`, chegara `#e5eaf2`, asosiy ko'k `#3164dc` (namunada `#356ae6` — AA kontrast uchun bir pog'ona to'q), navy `#101b35`, yon menyu faol bandi `#1d2d52`, urg'u `#6d9eff`; qorong'i mavzu ham namunadan |
| Shriftlar | Inter (matn) + Geist (sarlavhalar), o'zimizda (`@fontsource-variable/inter`, `geist`) — Google Fonts'ga bog'liq emas; qalinlik yengilroq (bold → 600) |
| Burchaklar | tugma/maydon 6 px, karta 8–12 px |
| Qobiq (kirgan, kompyuter) | ekran bo'yi to'q ko'k yon menyu: logo + bildirishnomalar, "E'lon berish", bo'limlar, "Boshqa", til, foydalanuvchi kartasi (rejim almashtirish, chiqish); yuqori panel yo'q |
| Qobiq (telefon) | yuqori panel + pastki 5 tab (11 px yozuv, faol — ko'k) |
| Mehmon bosh sahifasi | sarlavha va hero bitta to'q ko'k maydonda, markazda katta sarlavha, ikki tugma, haqiqiy raqamlar belgilar bilan; maydondan chiqib turgan ramkada qidiruv va eng yangi 3 vakansiya |
| Tezlik | har sahifa uchun yuklanish skeleti (`app/loading.tsx` — menyu joyida qoladi), shuning uchun dinamik sahifalar ham oldindan yuklanadi va bosilganda darhol javob beradi; `staleTimes.dynamic = 30` — ochilgan sahifaga 30 s ichida qaytish oniy; sahifa almashish animatsiyasi olib tashlandi |

## Logotip, ranglar va haqiqiy suratlar (egasi, 2026-11-05) — tarmoq `claude/brend-foto`

Egasi: "logotipni ham o'zgartirish kerak", "REAL PHOTOGRAPHY & VISUAL JOB CATALOG REQUIREMENTS", bosh mahsulot spetsifikatsiyasi
va 8 ta ish joyi surati. To'liq hisobot va qolgan bosqichlar — `docs/MAHSULOT_REJA_2026-11.md`.

| Qism | Nima o'zgardi |
|---|---|
| Logotip | "Darvoza": peshtoq ravog'i + ✓ (vektor, 16 px da ham o'qiladi); asosiy, gorizontal, to'q fon, belgi, favicon, ilova belgilari, OG rasmi — `docs/BRAND_UI_GUIDE.md` 1.2 |
| Ranglar | `#1455D9` asosiy, `#3478F6` fokus, `#16A36A` yashil belgi, fon `#F7F9FC`, matn `#101828`, ikkinchi matn `#636C81` (AA) |
| Bosh sahifa | och ko'k hero va katta haqiqiy surat; "Ish toping. Yoki jamoangizga odam toping."; "Men ish qidiryapman" / "Menga ishchi kerak"; qidiruv: kasb · hudud · ish turi |
| Kasblar katalogi | suratli kartalar (4:3) bosh sahifada va `/kasblar` da; surati yo'q sohalar — "Boshqa kasblar"; admin har soha uchun surat yuklay oladi |
| Vakansiyalar | "Tanlangan vakansiyalar" to'ri (qoida ekranda yozilgan) va "Yangi vakansiyalar" ro'yxati (xato ≠ bo'sh) |
| Ishonch | faqat tasdiqlangan kompaniyalar + uchta haqiqiy himoya qoidasi |
| Sarlavha | bosh sahifada ham oq (to'q ko'k emas); "Kasblar" menyusi → `/kasblar` |
