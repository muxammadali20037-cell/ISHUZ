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
