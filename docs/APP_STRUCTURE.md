# Ilova tuzilmasi — talab va mavjud holat (S0 audit, 2026-10-16)

Manba: egasining "ISH TOPDIM — Professional app structure & UX architecture" talabi (11 ekran, rolga xos menyu) va
ishgo / Yandex Go namunalari (ilova kabi kirish, maqsad bo'yicha katta bo'limlar). Ranglar, logo va shriftlar — hozirgidek.
Qoida: soxta raqam, foiz yoki ishlamaydigan tugma yo'q; mavjud ishlaydigan oqimlar buzilmaydi.

| # | Talab | Hozir bor | Bo'shliq → reja |
|---|---|---|---|
| 1 | Splash | yo'q (Telegram/PWA'ning o'z yuklanishi) | **S1**: "Ish topdim" → kamera "topdim" so'ziga yaqinlashib kiradi; ilova ochilganda bir marta (~1 s), bosishni to'smaydi, reduced-motion'da yo'q |
| 2 | Onboarding 3 bosqich | rol tanlash sahifasi `/onboarding` (kirgandan keyin) | **S1**: birinchi ochilishda 3 slayd (ish topish · ishchi topish · aqlli tanlov), o'tkazib yuborish, oxirida rol; qayta ko'rsatilmaydi |
| 3 | Kirish + rol | `/auth` (telefon → Telegram kodi), Mini App'da avtomatik kirish; rol — `/onboarding` | **S3**: kirish sahifasida xush kelibsiz + rol kartalari; Google sozlanmagan — ko'rsatilmaydi |
| 4 | Mehmon / kirish oynasi | rejimsiz mehmon — ish qidiruvchi bosh sahifasi | **S1**: katta oyna — haqiqiy raqamlar, ikki katta tanlov (ish topaman / ishchi topaman), yangi e'lonlar |
| 5 | Ish qidiruvchi bosh sahifa | qidiruv, tez filtrlar, "Sizga mos"/"Yangi ishlar", mashhur kasblar, AI PRO qatori | **S2**: Yandex uslubidagi bo'limlar: katta (kunlik, masofaviy, yaqin, tajribasiz) + kichik (MChJ, YaTT, Davlat, jismoniy shaxs, TOP, ommaviy, sohalar) — har birida haqiqiy son |
| 6 | Ishlar ro'yxati | `/search` natijalari, kartalar, faol filtr chiplari | soha / ish beruvchi turi / davlat / TOP / ommaviy filtri yo'q → **S2** migratsiya 0066 (`simple_search_vacancies_v3`, bo'lim sonlari) |
| 7 | Filtrlar | pastki oyna (maosh, jadval, tajriba) | **S3**: "Natijalarni ko'rish (N)" — N haqiqiy son |
| 8 | Vakansiya tafsiloti | bir sahifada bo'limlar, yopishqoq amal paneli (ariza, saqlash, ulashish) | **S3**: Tavsif · Talablar · Imtiyozlar · Kompaniya tablari (ma'lumot borlari) |
| 9 | AI moslik | `matches` (avtomatik, navbat orqali), `compute_match_v2` (hard_fail, missing), sahifada faqat daraja | **S3**: `/jobs/[slug]/moslik` — foiz, nima uchun mos, nima yetishmaydi; faqat hisoblangan bo'lsa |
| 10 | Ish beruvchi paneli | salomlashuv, "Vakansiya joylash", 2 ko'rsatkich, so'nggi arizalar, bo'limlar | **S3**: bugungi ko'rsatkichlar (ko'rishlar, arizalar, saralanganlar — haqiqiy), menyu |
| 11 | Xabarlar | ro'yxat (avatar, ism, oxirgi xabar, vaqt, o'qilmagan), realtime | **S3**: qidiruv, "Barchasi · Ish beruvchilar · Nomzodlar" |
| 12 | Profil | kabinet: e'lonlar, AI PRO, tekis menyu; to'liqlik `/profile` da | **S3**: sarlavha kartasi, to'liqlik foizi, faoliyat sonlari, guruhlangan menyu |
| 13 | Pastki menyu | ish qidiruvchi: Ishlar · Saqlanganlar · Arizalar · Profil | **S2**: Asosiy · Ishlar · AI · Xabarlar · Profil; ish beruvchi: Asosiy · Vakansiyalar · Kandidatlar · Profil |
| 14 | AI | 3 alohida joy: lupa, `/cabinet/matches`, `/ai-alerts` | **S2**: `/ai` — "Sizga mos" (haqiqiy ball), aqlli qidiruv, AI yordamchi |

Ishlaydigan va saqlanadigan qismlar: telefon/Telegram kirish, Mini App avtomatik kirish, onboarding ustalari, ariza
(takrorsiz, yopilgan vakansiyaga yo'q — 0065), takliflar, chat, saqlanganlar, to'lov va hamyon, admin panel, AI PRO.

Ma'lumot cheklovlari (soxta raqam chiqmasligi uchun): TOP (`is_featured`) faqat admin qo'yadi — bo'sh bo'lsa bo'lim
yashiriladi; "MChJ" alohida yuridik shakl emas — `employer_type = company` (kompaniyalar); "kunlik ishchi" — ishchi
istagida kunlik to'lov yoki "bugun/ertaga" tayyor.

## S1 — kirish (bajarildi, `33693f2`)

- **Ochilish ekrani** (`components/shared/splash.tsx`, `globals.css` `.splash*`): "Ish topdim" → kamera "topdim" so'zining
  "o" harfi markaziga (brauzerda o'lchangan: 20.96% / 60.1%) uchib kiradi, ilova "o" ichidan ochiladi; ~1.2 s, sessiyada bir
  marta, bosishni to'smaydi; reduced-motion, admin panel va avtomatlashtirilgan brauzerda yo'q.
- **Tanishtiruv** (`features/intro`): 3 slayd — ish topish, ishchi topish, sizga mosini topamiz + rol tanlash; o'tkazib yuborish,
  oldingi/keyingi, nuqtalar, ←/→, barmoq surish; faqat haqiqiy sonlar; bir marta (`ib_intro`), qidiruv robotlariga ko'rsatilmaydi.
- **Kirish oynasi** (`features/landing/entry-home.tsx`) — rejim tanlanmagan mehmon: bugungi yangi e'lonlar soni, "Nima qidiryapsiz?",
  ikki katta maqsad (vakansiyalar / ishchilar soni bilan), qidiruv, tez kirish (ish izlovchilarga 4, ish beruvchilarga 4),
  yangi vakansiyalar (haqiqiy kartalar), "Nega Ish topdim", "Hisobingiz bormi? Kirish". Maqsad plitkalari — JS'siz ham ishlaydigan
  forma (`enterMode`: rejim yoziladi, faqat ichki manzilga o'tiladi).

## S2 — rolga xos bosh sahifa bo'limlari va pastki menyu

- **Migratsiya 0066** (`0066_home_sections.sql`, faqat yangi nomli funksiyalar, `drop` yo'q; 0065 dan keyin):
  `simple_search_vacancies_v3` (ish beruvchi turi, TOP, ommaviy 5+ o'rin), `vacancy_section_counts`,
  `simple_search_workers_v2` (kunlik ishchilar), `worker_section_counts`, `vacancy_employer_kind`. SQL test:
  `supabase/tests/home_sections.test.sql` (24 tekshiruv). **Production'ga qo'llangan (2026-10-17, egasi ruxsati bilan)**, 0065 bilan birga.
- **Bo'limlar** (`features/landing/section-tiles.tsx`): ish izlovchi — katta: Kunlik ishlar, Yaqin atrofda; kichik: Masofaviy,
  Tajribasiz, MChJ, YaTT, Davlat, Jismoniy shaxs, Ommaviy, TOP, Barcha sohalar. Ish beruvchi — katta: Kunlik ishchilar,
  Yaqin ishchilar; kichik: Tajribali, Masofaviy, Barcha ishchilar, Vakansiya joylash (panelda ham). Har bo'limda haqiqiy son;
  soni 0 bo'lgan kichik bo'lim ko'rsatilmaydi; 0066 yo'q bo'lsa — sonsiz ishlaydigan bo'limlargina qoladi.
- **Qidiruv**: `etype` (company | ie | person | gov), `top=1`, `mass=1`, ishchilar uchun `pay=daily`; natijalarda faol filtr
  chiplari, filtr oynasida ish beruvchi turi / ommaviy / TOP (0066 bo'lsa). Matnli qidiruv bu filtrlarni bajarmaydi — chip ham chiqmaydi.
- **Pastki menyu**: ish izlovchi — Asosiy · Ishlar · AI · Xabarlar · Profil; ish beruvchi — Asosiy · Vakansiyalar · Nomzodlar · Profil.
  Saqlanganlar, arizalar, takliflar — Profil (kabinet) ichida. **`/ai`**: oddiy so'z bilan qidiruv, "Sizga mos" (moslik dvigateli),
  AI PRO kuzatuv, AI bilan e'lon tuzish (faqat AI provayder sozlangan bo'lsa).

## S3 — ekranlar (kirish, vakansiya, moslik, xabarlar, profil, panel, filtr)

- **Kirish** (`/auth`): "Kim sifatida kirasiz?" — Ish izlovchi / Ish beruvchi kartalari (tanlov qurilmada, kirgach profilga ham
  yoziladi); telefon → Telegram kodi va Mini App avtomatik kirish o'zgarmagan. Google kirish yo'q (sozlanmagan — ko'rsatilmaydi).
- **Vakansiya** (`/jobs/[slug]`): asosiy faktlar birinchi ekranda, ostida **Tavsif · Talablar · Imtiyozlar · Kompaniya** tablari —
  faqat ma'lumoti borlari; barcha tab matni HTML'da (qidiruv tizimlari uchun). Yopishqoq "Ariza yuborish" + "Saqlash" — avvalgidek,
  takroriy ariza serverda rad etiladi (0065).
- **Moslik tahlili** (`/jobs/[slug]/moslik`, `match_explain` → matching v2): foiz faqat ma'lumot to'liq va majburiy talablar mos
  bo'lsa; aks holda — "ma'lumot yetarli emas" yoki "majburiy talab mos emas" (foizsiz). "Nima uchun mos", "E'tibor bering",
  "Nima yetishmaydi" (to'ldirish havolasi bilan). Faqat o'z profili bo'yicha (funksiya ichida egalik tekshiruvi).
- **Xabarlar** (`/messages`): qidiruv (ism, vakansiya, oxirgi xabar) va "Barchasi · Ish beruvchilar · Nomzodlar" — qarshi tomon
  ariza/taklif ishchisidan aniqlanadi; filtr faqat ikkala turdagi suhbat bo'lsa ko'rinadi.
- **Profil** (`/cabinet`): sarlavha kartasi (avatar, ism, rol), ish izlovchida profil to'liqligi (`worker_profiles.completeness`)
  va faoliyat sonlari (`worker_dashboard_stats`), ish beruvchida — faol vakansiyalar, yangi/jami arizalar, ishga olinganlar
  (`employer_dashboard_stats`); menyu "Faoliyat" va "Hisob" guruhlarida.
- **Ish beruvchi paneli**: "Arizalar holati" — barcha vakansiyalar bo'yicha yangi · ko'rilgan · saralangan · suhbat · ishga olingan.
- **Filtr oynasi**: "Natijalarni ko'rish (N)" — N sahifadagi qidiruv bilan aynan bir xil funksiyadan (`countFindResults`);
  aniqlab bo'lmasa (matnli qidiruv, kasb tanlanmagan) — sonsiz tugma.

## Deploy

- Vercel production endi `main` branch'idan chiqadi (2026-10-17 dan; avval ish branch'i `claude/gallant-thompson-q70fo3` edi).
  Ish branch'iga push — faqat Preview; saytga chiqishi uchun `main` ga merge kerak.
- 0065 va 0066 production bazasiga qo'llangan; tekshiruv: bo'lim sonlari va yangi qidiruv funksiyalari javob beradi,
  anon chaqira oladigan SECURITY DEFINER ro'yxati `security_hardening.test.sql` dagi bilan bir xil.
