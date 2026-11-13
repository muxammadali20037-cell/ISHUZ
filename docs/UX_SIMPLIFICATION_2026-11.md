# Ish topdim — UX/UI soddalashtirish (2026-11-13)

Ega topshirig'i: "katta imkoniyatlar + juda sodda foydalanish". Har qarorda: *bu funksiya foydalanuvchiga haqiqatan kerakmi?
kerak bo'lsa — yanada sodda qilish mumkinmi?* Ishlayotgan funksiya o'chirilmaydi — kerak bo'lmagan joydan kerakli joyga
ko'chiriladi. Backend, baza, API va kirish o'zgarmaydi. Soxta ma'lumot yo'q.

## 1. Audit (2026-11-13, stend skrinshotlari: telefon 390 px va kompyuter 1440 px)

81 ta foydalanuvchi sahifasi (admin'siz). Asosiy oqimlar:

| Joy | Hozir | Talabga mos? |
|---|---|---|
| Birinchi ochilish | `/start`: til → tanishtiruv → "Ish qidiryapman / Ishchi qidiryapman" | ✅ rol tanlovi bor; Profil → "Rolni o'zgartirish" |
| Pastki menyu (ish izlovchi) | Ishlar · Saqlangan · **E'lon** · Arizalar · Profil | ✅ talabdagi 5 bo'lim, nomlari yozuv bilan |
| Pastki menyu (ish beruvchi) | Boshqaruv · Vakansiyalar · E'lon · Nomzodlar · Profil | ✅ |
| Qidiruv natijalari | qidiruv qatori + alohida "Filtr" oynasi; kartada maosh, joy, jadval, tajriba | ✅ filtrlar majburan ko'rsatilmaydi |
| E'lon sahifasi | nom, kompaniya, maosh, manzil, jadval, talablar; asosiy tugma "Ariza yuborish" | ✅ |
| Ariza | bitta oyna: qisqa xabar → yuborish (profil shart emas) | ✅ talabdagidan ham qisqa (kamroq bosqich) |
| E'lon berish | bosqichli usta, har bosqichda izoh; ish izlovchi uchun AI suhbat | ✅ |
| Universal ustalar | alohida mini-ilova, o'z rangi, 12 xizmat turi (santexnik, elektrik, …, boshqa) | ✅ |
| AI yordamchi | to'q sariq (iliq) rang, yuqori panel ✨ va yon menyu | ✅ qo'shimcha vosita |
| **Ish izlovchi bosh sahifasi** | 11 ta blok: salom, qidiruv, 4 tez yo'l, 2 havola, AI + ustalar plitkalari, "Mening faoliyatim", yangi ishlar, "O'zim haqimda e'lon", "Yangi ish chiqsa xabar", "Mening dunyom", "Bugungi rejangiz" | ❌ ortiqcha |
| **Ish beruvchi bosh sahifasi** | panel + "Bo'limlar" ro'yxati (menyuni takrorlaydi), AI va xabar kartalari | ❌ takror |
| **Mehmon bosh sahifasi** (rejim tanlanmagan) | telefonda ~8 500 px: hero, suratli katalog, tanlangan + yangi vakansiyalar (ikki ro'yxat), ishonch, ish beruvchilar bloki, "Qanday ishlaydi" | ❌ juda uzun |

## 2. Yangi tuzilish

**Bosh sahifa (ikkala rol)** — faqat: joylashuv · salomlashuv · katta qidiruv · tezkor yo'llar · yangi e'lonlar ·
alohida yashil "Universal ustalar". Boshqa hamma narsa o'z bo'limida:

| Ko'chirildi | Qayerga |
|---|---|
| "Mening dunyom" va bugungi reja | Profil (Kabinetim), `#dunyo` |
| "Mening faoliyatim" (arizalar soni) | "Arizalar" bo'limi va Profil sarlavhasidagi raqamlar (takror edi) |
| "O'zim haqimda e'lon berish" | pastki menyudagi "E'lon" |
| "Yangi ish chiqsa — xabar" | Profil → AI PRO kartasi |
| AI yordamchi kartasi | yuqori panel ✨ (telefon), yon menyu (kompyuter), Profil |
| Ish beruvchi "Bo'limlar" ro'yxati | pastki/yon menyu va Profil (o'sha havolalar) |

## 3. Bosqichlar

1. ✅ Ish izlovchi va ish beruvchi bosh sahifasi (shu hujjat bilan birga).
2. ✅ Mehmon bosh sahifasi: ikki yo'l + qidiruv → kasblar → bitta "Yangi vakansiyalar" ro'yxati → "Universal ustalar".
   Takrorlar ("Tanlangan" + "Yangi" ikki ro'yxat, ish beruvchilar bloki, ishonch, "Qanday ishlaydi") olib tashlandi.
3. Kichik matnlar: pastki menyu yozuvlari 11 px qoladi — 360 px ekranda ruscha "Вакансии/Кандидаты" 12 px da sig'maydi
   (tekshirildi); kartalardagi 2xs matnlar keyingi bosqichda ko'rib chiqiladi.
4. Har bosqichdan keyin: unit + to'liq E2E (telefon/kompyuter, 320–1440 px, a11y), CI yashil bo'lsa — chiqarish.
