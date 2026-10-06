# Geo qamrovi: tumanlar va shaharlar (SOATO/MHOBT)

Maʼlumotlar fayli: `supabase/seed/geo_uz.json` (yaratilgan sana: 2026-10-06).

## Manbalar (2026-10-06 da olingan)

| # | Manba | Nima olindi |
|---|---|---|
| 1 | https://raw.githubusercontent.com/MIMAXUZ/uzbekistan-regions-data/master/JSON/districts.json va `regions.json` | SOATO kodi, name_uz / name_oz (kirill) / name_ru |
| 2 | https://raw.githubusercontent.com/nurbekjummayev/laravel-region/main/database/data/regions.json (packagist: `nurbekjummayev/laravel-region`) | COATO kodi, `district`/`city` turi, name_uz / name_oz / name_ru |
| 3 | https://kun.uz/news/2019/09/30/andijon-viloyatining-boz-tumani-boston-tumaniga-ozgartirildi | Bo'z → Bo'ston qayta nomlanishi (faqat qidiruv natijasi orqali) |
| 4 | stat.uz: 01.01.2023 holatiga respublika/viloyat ahamiyatidagi 32 ta shahar va viloyatlar bo'yicha taqsimoti | Shaharlar sonini tekshirish (faqat qidiruv parchasi orqali) |

**Muhim:** rasmiy saytlar (stat.uz, siat.stat.uz, lex.uz, data.gov.uz) va Wikipedia ushbu muhitda tarmoq siyosati tomonidan bloklangan, shuning uchun rasmiy SOATO klassifikatori **to'g'ridan-to'g'ri yuklab olinmadi**. Maʼlumotlar SOATO kodlarini keltiruvchi ikkita mustaqil ochiq to'plamdan birlashtirildi va o'zaro solishtirildi. Rasmiy klassifikator bilan yakuniy tekshiruv hali qilinmagan.

## Viloyatlar bo'yicha soni

| Viloyat (slug) | Tumanlar | Shaharlar | Jami |
|---|---:|---:|---:|
| andijan | 14 | 2 | 16 |
| bukhara | 11 | 2 | 13 |
| fergana | 15 | 4 | 19 |
| jizzakh | 12 | 1 | 13 |
| karakalpakstan | 16 | 1 | 17 |
| kashkadarya | 14 | 2 | 16 |
| khorezm | 11 | 2 | 13 |
| namangan | 13* | 1 | 14 |
| navoi | 8 | 3 | 11 |
| samarkand | 14 | 2 | 16 |
| surkhandarya | 14 | 1 | 15 |
| syrdarya | 8 | 3 | 11 |
| tashkent_city | 12 (shahar tumanlari) | 0 | 12 |
| tashkent_region | 15 | 7 | 22 |
| **Jami** | **177** | **31** | **208** |

\* Namangan: 11 ta tuman + Namangan shahri ichidagi 2 ta tuman (Davlatobod, Yangi Namangan; SOATO 1714401365 / 1714401367, `parent_city_soato` bilan belgilangan).
Shaharlar: 31 ta viloyat ahamiyatidagi shahar + Toshkent shahri (alohida region) = 32, bu stat.uz ko'rsatgan 32 taga va viloyatlar bo'yicha taqsimotiga mos keladi.

## Ishonchlilik

- 208 birlikning barchasi **ikkala** manbada bir xil SOATO kodi va viloyat bilan mavjud.
- `name_oz` (kirill) hammasi manbadan olingan (`oz_source: "source"`), transliteratsiya ishlatilmagan.
- `lat`/`lng` — barchasi `null`: manbalarda koordinata yo'q, o'ylab topilmadi.
- Ruscha nomlardagi lotin "p", "c" kabi harflar (homoglif) kirillchaga almashtirildi; boshqa o'zgartirish yo'q.

## Noaniq / qo'lda hal qilingan holatlar

1. **Bo'ston tumani (1703209)** — 1-manba eski nom "Bo'z", 2-manba "Bo'ston"; 2019-yilda qayta nomlangan (kun.uz). 2-manbadagi kodsiz "Bo'z tumani" dublikati tashlab yuborildi.
2. **G'ozg'on (1712412)** — ikkala manba "tuman" deydi, lekin kod 4xx (shahar seriyasi) va stat.uz bo'yicha Navoiyda 3 ta shahar → `city` deb belgilandi.
3. **Shahrisabz (1710405)** — 2-manba turini `district` deb beradi, nomi "shahar", kod 4xx → `city`.
4. **Sharof Rashidov tumani**, **Shahrixon**, **Shayxontohur** — manbalar orasida yozilishdagi kichik farqlar; 1-manba / to'liq rasmiy shakl olindi.
5. **Baxt (1724414)** — faqat 1-manbada "shahar" sifatida bor; stat.uz bo'yicha Sirdaryoda 3 ta shahar (Guliston, Shirin, Yangiyer), Baxt esa tuman tarkibidagi shahar ko'rinadi → **kiritilmadi**. Rasmiy klassifikator bilan tekshirish kerak.
6. Viloyat bo'ysunuvidagi bo'lmagan (tuman tarkibidagi) shaharlar, shaharchalar va mahallalar ushbu to'plamga **kirmaydi**.

## Mavjud `districts` jadvali bilan moslash

- Bazadagi 186 qatorning **barchasi** rasmiy birlikka moslandi (`existing_slug`). Mos kelmagan qator yo'q.
- Taxallus orqali moslanganlar: `tashkent_city/sergeli` → Sirg'ali tumani, `samarkand/toyloq` → Tayloq tumani, `andijan/boz` → Bo'ston tumani, `fergana/bagdod` → Bog'dod tumani.
- **Ikki maʼnoli (tuman ham, shahar ham bor) — tekshirish kerak.** Bazadagi nomda "shahri" yo'q, shuning uchun tumanga moslandi (`match_note: ambiguous`): `bukhara/kogon`, `karakalpakstan/nukus`, `kashkadarya/karshi`, `kashkadarya/shahrisabz`, `khorezm/khiva`, `khorezm/urgench`, `samarkand/kattaqorgon`, `surkhandarya/termez`, `syrdarya/guliston`, `tashkent_region/bekobod`, `tashkent_region/ohangaron`, `tashkent_region/yangiyol`. Ayrimlari (masalan `karshi`, `urgench`, `termez`, `khiva`, `nukus`) ehtimol aslida shaharni nazarda tutgan — mahsulot egasi qaror qilishi kerak.
- Bazada yo'q, yangi qo'shilishi kerak bo'lgan 22 ta birlik (ro'yxat `geo_uz.json` → `notes.units_without_existing_row`): masalan Andijon, Buxoro, Farg'ona, Namangan, Samarqand, Toshkent tumanlari; Quva, Ko'kdala tumanlari; Davlatobod, Yangi Namangan; Qarshi, Nukus, Urganch, Xiva, Termiz, Guliston, Kogon, Kattaqo'rg'on, Shahrisabz, Bekobod, Ohangaron, Yangiyo'l shaharlari.

## Qolgan ishlar

- Rasmiy SOATO (stat.uz / siat.stat.uz/data/307) bilan to'g'ridan-to'g'ri solishtirish — tarmoq ruxsati bo'lgan joyda.
- Koordinatalar uchun alohida manba (hozir yo'q).
