# Kasblar katalogi qamrovi (v2, 0031)

Manba: `supabase/seed/professions.txt` → `scripts/gen-professions.py` → `supabase/migrations/0031_profession_catalog_v2.sql`.
Tekshirilgan sana: 2026-10-06 (toza lokal baza, barcha migratsiyalar 0001–0033).

## Umumiy ko'rsatkichlar

| Ko'rsatkich | Qiymat |
|---|---:|
| Jami tugunlar | **1 303** (0029 dan 700 + yangi 603) |
| Tanlanadigan kasblar / faqat guruhlar | 1 148 / 155 |
| Sohalar (categories) | 38 (32 eski + 6 yangi) |
| Maksimal chuqurlik | 6 |
| Chuqurlik taqsimoti (1/2/3/4/5/6) | 210 / 812 / 211 / 61 / 7 / 2 |
| Yetim tugun / sikl / path xatosi / soha nomuvofiqligi | 0 / 0 / 0 / 0 |
| name_uz, name_ru yoki name_en bo'sh tugun | 0 |
| Takroriy slug | 0 |
| 0031 hajmi | ~297 KB |

**Yangi sohalar:** `telecom` (Aloqa va telekommunikatsiya, radio-tower), `energy` (Energetika va kommunal xizmatlar, plug-zap),
`mining` (Konchilik, geologiya, neft-gaz, pickaxe), `culture` (Madaniyat, san'at va tadbirlar, drama),
`real_estate` (Ko'chmas mulk va obyekt boshqaruvi, building-2), `crafts` (Hunarmandchilik, gem).
Eski sohalarning sluglari o'zgarmagan.

## Migratsiya qanday ishlaydi

- `0029_profession_seed.sql` productionda qo'llangan — **o'zgartirilmagan** (bayt bo'yicha bir xil).
- 0031 to'liq katalogni (eski + yangi) `pg_temp._pn(...)` qatorlari bilan yozadi. Slug to'qnashuvida faqat sinonimlar
  birlashtiriladi, `name_en`/`icon` bo'sh bo'lsagina to'ldiriladi; `name_uz`, `name_ru`, ota-tugun va `sort_order` hech qachon
  ustidan yozilmaydi (admin tahrirlari saqlanadi).
- Generator eski tugunlarning slug va tartibini 0029 dan o'qib "qulflaydi" (kalit: soha + ota slug + name_uz). Eski tugun
  outline'dan o'chirilsa, nomi o'zgartirilsa yoki ko'chirilsa — generator xato beradi.
- Oxirida: eski yo'nalish sinonimlarini birlashtirish (0029 dagidek, lekin `usta`siz) va `usta` sinonimini
  Avtomexanik, Universal usta va G'isht teruvchi tugunlaridan olib tashlash.
- Tekshiruv: `ishuz_dev` (0029 bor) ustiga 0031 ikki marta qo'llandi — 1-marta 603 tugun qo'shildi, 2-marta **0 qator**
  o'zgardi. Yangilangan baza va toza baza daraxti (slug, ota, nomlar, sinonimlar, tartib) **to'liq bir xil** chiqdi.
- `bash scripts/db-test.sh` (toza `ishuz_test`) — barcha SQL test to'plamlari o'tdi.

## 42 yo'nalish bo'yicha qamrov

"Soha" — tugunlar joylashgan `categories.slug`. Bitta kasb faqat bitta joyda turadi (takror yo'q); boshqa yo'nalishga ham
tegishli bo'lsa, eng tabiiy joyda qoldirilgan va quyida izohlangan.

| # | Yo'nalish | Soha (host) | Tugunlar | Shundan yangi | Izoh |
|---:|---|---|---:|---:|---|
| 01 | Tibbiyot | medicine | 138 | 29 | 16 ta talab qilingan shifokor bor; Hamshira alohida (shifokor sinonimi emas) |
| 02 | Farmatsiya | medicine → Farmatsiya | 16 | 11 | farm. ishlab chiqarish, optika |
| 03 | Ta'lim | education | 101 | 24 | maxsus va professional ta'lim, avtomaktab (nazariya + amaliy instruktor, A/B/BE/C/CE/D) |
| 04 | IT | it | 69 | 15 | texnologiyalar asosan sinonim/ko'nikma; eski React/Next tugunlari qoldi |
| 05 | Aloqa va telekommunikatsiya | telecom | 18 | 18 | pochta ham shu yerda; "Telekommunikatsiya muhandisi" engineering'da qolgan |
| 06 | Buxgalteriya va audit | finance → Buxgalteriya, Audit | 20 | 7 | |
| 07 | Moliya, bank, sug'urta | finance | 27 | 14 | |
| 08 | Huquq | legal | 15 | 5 | prokuror/tergovchi — 36 da |
| 09 | HR va ofis | office, call_center | 23 | 5 | call-markaz shu yo'nalishga hisoblangan |
| 10 | Savdo | sales | 33 | 11 | |
| 11 | Marketing, PR, e-commerce | marketing | 29 | 10 | |
| 12 | Dizayn, media, kreativ | design | 30 | 11 | |
| 13 | Qurilish va ta'mirlash | construction, electrician, plumber | 75 | 21 | talab qilingan 16 yo'nalish bor |
| 14 | Arxitektura va muhandislik | engineering | 33 | 15 | Arxitektor construction'da qolgan |
| 15 | Avtomobil servisi | auto_service | 52 | 15 | motor (benzin/dizel), MKPP/AKPP/CVT/DSG, akkumulyator, peretyajka va h.k. |
| 16 | Haydovchilik va transport | driver, construction → Maxsus texnika | 62 | 40 | umumiy "Haydovchi", temir yo'l, aviatsiya, avtobus |
| 17 | Logistika va ombor | logistics, courier | 23 | 6 | |
| 18 | Sanoat va ishlab chiqarish | production | 27 | 17 | poligrafiya, sanoat operatorlari |
| 19 | Metallga ishlov | mechanic, construction → Payvandchi | 36 | 26 | payvand turlari Payvandchi (construction) ostida |
| 20 | Energetika va kommunal | energy | 25 | 25 | elektrik/santexnik ustalar 13 da; government → "Kommunal xizmatlar" (3) eski |
| 21 | Konchilik, geologiya, neft-gaz | mining | 28 | 28 | Geolog science'da, Neft va gaz muhandisi engineering'da qolgan |
| 22 | Qishloq xo'jaligi | agriculture | 13 | 8 | kombaynchi 16 da |
| 23 | Chorvachilik va veterinariya | agriculture → Chorvachilik, Baliqchilik, Uy hayvonlari | 19 | 14 | yem ishlab chiqarish shu yerda |
| 24 | Oziq-ovqat ishlab chiqarish | production | 17 | 15 | go'sht/sut, non, qandolat, texnologlar |
| 25 | Restoran | restaurant | 40 | 6 | |
| 26 | Mehmonxona va turizm | hotel | 15 | 4 | |
| 27 | Tikuvchilik, tekstil, charm | sewing, production → Tekstil ishlab chiqarish | 29 | 20 | charm/poyabzal guruhi |
| 28 | Mebel va yog'och | craftsman, construction → Duradgorlik | 16 | 10 | |
| 29 | Go'zallik | beauty | 27 | 5 | |
| 30 | Uy-ro'zg'or va parvarish | cleaning → Uy xizmatlari | 9 | 2 | Bemorga qarovchi medicine'da |
| 31 | Tozalash va obodonlashtirish | cleaning | 12 | 5 | Landshaft ishchisi construction'da |
| 32 | Xavfsizlik | security | 14 | 6 | |
| 33 | Sport va sog'lomlashtirish | education → Sport va trenerlik | 19 | 13 | eski joyi saqlangan (ko'chirilmadi) |
| 34 | Madaniyat, san'at, tadbirlar | culture | 33 | 33 | Kutubxonachi education'da, Animator other'da qolgan |
| 35 | Ilm-fan, laboratoriya, ekologiya | science | 26 | 15 | |
| 36 | Davlat va ijtimoiy xizmatlar | government | 33 | 19 | huquqni muhofaza, FVV |
| 37 | Ko'chmas mulk va obyekt boshqaruvi | real_estate | 15 | 15 | |
| 38 | Ta'mirlash va elektronika | craftsman | 21 | 15 | telefon, kompyuter, maishiy texnika, muzlatkich, konditsioner |
| 39 | Hunarmandchilik | crafts | 20 | 20 | charm buyumlar 27 da |
| 40 | Boshqaruv va loyihalar | management | 18 | 7 | |
| 41 | Tarjima va yozuv | office → Tarjimon, Yozuv va tahrir | 18 | 13 | Muharrir design → Media'da |
| 42 | Yordamchi va umumiy ishlar | other | 9 | 5 | |
| | **Jami** | | **1 303** | **603** | |

## Qidiruv testi (`search_profession_nodes(q, null, 3)`, birinchi natija)

| So'rov | Birinchi natija | Ball |
|---|---|---:|
| bugalter | Buxgalter | 4.00 |
| buhgaltir | Buxgalter | 4.00 |
| бухгалтер | Buxgalter | 4.00 |
| avta elektrik | Avtoelektrik | 4.00 |
| автоэлектрик | Avtoelektrik | 4.00 |
| shafyor | Haydovchi | 4.00 |
| xaydovchi | Haydovchi | 4.00 |
| haydovchi | Haydovchi | 4.00 |
| водитель | Haydovchi | 4.00 |
| ҳайдовчи | Haydovchi | 4.00 |
| prava oqituvchi | Avtoinstruktor | 4.00 |
| prava o'qituvchisi | Avtoinstruktor | 4.00 |
| vojdeniya instruktori | Avtoinstruktor | 4.00 |
| medsestra | Hamshira | 4.00 |
| медсестра | Hamshira | 4.00 |
| ҳамшира | Hamshira | 4.00 |
| oqtuvchi | O'qituvchi (guruh) | 4.00 |
| учитель | O'qituvchi (guruh) | 4.00 |
| ўқитувчи | O'qituvchi (guruh) | 4.00 |
| urolog | Urolog | 4.00 |
| svarchik | Payvandchi | 4.00 |
| motorchi | Dvigatel ustasi (motorist) | 4.00 |
| bolalar kardiojarrohi | Bolalar kardiojarrohi | 4.00 |
| ошпаз / сотувчи / фаррош | Oshpaz / Sotuvchi / Farrosh | 4.00 |
| usta | bitta aniq natija yo'q (Universal usta, Gaz plita ustasi, Pardozlovchi usta — barchasi 3.00) | — |

Taxminan 60 ta eng ommabop kasbga o'zbek kirill sinonimlari qo'shildi (ҳайдовчи, ўқитувчи, ошпаз, сотувчи, фаррош,
ҳамшира, шифокор, қўриқчи, тикувчи, сартарош, пайвандчи, қурувчи, ғишт терувчи, сувоқчи, кафелчи, бўёқчи, юкловчи,
омборчи, тарбиячи, дастурчи, нонвой, қандолатчи, энага, боғбон, дурадгор, таржимон, ҳуқуқшунос, котиба, деҳқон,
чорвадор, дорихоначи, массажчи, ...).

## Ma'lum kamchiliklar (halol)

- **ISCO-08 / ESCO kodlari hali bog'lanmagan.** `profession_nodes` da tashqi klassifikator kodi uchun ustun yo'q
  (`metadata` jsonb bor, lekin to'ldirilmagan). Kodlar uchun alohida ustun/jadval va moslashtirish — kelajakdagi ish.
- Katalog qo'lda tuzilgan (O'zbekiston mehnat bozori bo'yicha mantiqiy tanlov); rasmiy klassifikator yoki vakansiya
  statistikasi bilan solishtirilmagan.
- 0029 dagi ba'zi eski yaqin-takrorlar saqlanib qoldi, chunki 0031 eski tugunlarni o'chirmaydi/ko'chirmaydi:
  Ichki dizayner (construction) va Interyer dizayneri (design); Forklift haydovchisi (driver) va Forklift operatori
  (logistics); Traktor haydovchisi va Traktor operatori (pogruzchik); Direktor (education va management); Loyiha menejeri
  (office), Project Manager (IT) va Loyiha rahbari (management); Kassir va Kassir (restoran); Massajchi va Spa massajchi.
  Ularni admin paneldagi "birlashtirish" (`admin_merge_profession_node`) bilan tozalash tavsiya etiladi.
- Ayrim yo'nalishlar boshqa sohada joylashgan (masalan Sport — education ichida, payvand — construction ichida,
  elektrik/santexnik — alohida eski sohalarda). Yangi sohaga ko'chirish 0031 da qilinmadi (ota-tugunni ustidan yozmaslik qoidasi).
- Kichikroq yo'nalishlar: 30 (9 tugun), 42 (9), 31 (12), 22 (13) — keyingi bosqichda kengaytirish mumkin.
- Yangi tugunlarning `sort_order` qiymati eski qo'shni tugundan keyin (+1, +2, ...) beriladi; eski tugunlar tartibi o'zgarmaydi.
- Ilova tomonida `src/components/shared/category-icon.tsx` dagi ikonka xaritasida yangi ikonkalar (radio-tower, plug-zap,
  pickaxe, drama, building-2, gem) yo'q — hozircha Briefcase ko'rsatiladi; i18n/statik soha ro'yxatlari ham yangilanishi kerak.
