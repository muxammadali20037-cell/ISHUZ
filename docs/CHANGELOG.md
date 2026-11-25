# O'zgarishlar jurnali

## 2026-11-25 · Bosh sahifa rolga qarab: faqat o'z oynasi va uzun «E'lon berish» (`feat/role-home-tiles`)

Ega: "qaysi rolni tanlagan bo'lsa shunaqa oyna chiqsin… e'lon berish uzunchoq bo'lib ko'rinsin" → variantlardan «B».
Migratsiya yo'q.

- Rol tanlangan bo'lsa bosh sahifada (va «Qidiruv»ning bo'sh holatida) faqat o'z oynasi: ish izlovchida «Ish qidiryapman»,
  ish beruvchida «Ishchi qidiryapman». Ostida sariq «E'lon berish» — ikkalasi to'liq kenglikda, ustma-ust (kompyuterda
  yonma-yon).
- «E'lon berish»da endi «ishchi izlash uchunmi yoki ish izlash uchunmi?» deb so'ralmaydi: ish izlovchida o'z e'loni shu
  chatda boshlanadi, ish beruvchida vakansiya yordamchisi ochiladi.
- Rol tanlanmagan mehmonda — avvalgidek uchala tugma va savol.
- Tanishtiruvda (tugmalar bilan tanishuv) ko'rinmaydigan tugmaning qadami o'tkazib yuboriladi; yoritish halqasi sahifa
  keyinroq siljisa ham tugmaga ergashadi.

## 2026-11-25 · Play Market'ga tayyorgarlik: tekshiruvchi uchun test kirish, AI natijasiga shikoyat (`feat/store-readiness`)

Ega: "Play Market, App Store'ga chiqarish uchun tayyormizmi" → "Ha, boshla". **Migratsiya: 0092** (faqat yangi enum qiymati).

- **Tekshiruvchi uchun test kirish**: saytga kirish Telegram orqali, Google/Apple tekshiruvchisida esa Telegram yo'q.
  Vercel'da `STORE_REVIEW_PHONE` va `STORE_REVIEW_CODE` berilsa, telefon formasida shu raqam va doimiy kod faqat
  alohida demo hisobga («App Review», doimiy id) kiritadi. Boshqa hech kimning hisobiga kirib bo'lmaydi; urinishlar oddiy kod
  kabi cheklanadi; egasining raqami berilsa — o'chiq; har kirish xavfsizlik jurnaliga yoziladi. Demo hisob e'lonlari
  Telegram kanalga chiqmaydi.
- **AI natijasiga shikoyat** (Google Play talabi): AI yaratgan e'lon rasmi va AI yozgan «O'zim haqimda» matni ostida
  «AI natijasi haqida xabar berish». Shikoyat admin → Shikoyatlar navbatiga «AI natijasi» bo'lib tushadi (0092).
- **Maxfiylik siyosati**: OpenAI (e'lon rasmi) xizmat ko'rsatuvchilar ro'yxatiga qo'shildi; AI natijasiga shikoyat
  saqlanishi yozildi (uz, ru, en).
- **Do'kon rasmlari** qayta olindi (yangi dizayn). Namunaviy kompaniya nomi «Namuna Savdo», tasdiq belgisisiz — haqiqiy
  kompaniyaga o'xshash nom yoki soxta «Tasdiqlangan» belgisi ko'rsatilmaydi.
- `docs/PLAY_MARKET.md`: test kirishni sozlash va Play Console'dagi «App access» javobi.

## 2026-11-24 · "Menejer" — "Qanday menejer kerak?"; adminlarga rasm chegarasi yo'q (`fix/manager-and-image-limit`)

Ega: "meneger degan kasb bormi" → "Ha, tuzat"; "bugun rasm yaratish chegarasiga yetdingiz deyapti nimaga" →
"Adminlarga chegarasiz". **Migratsiya: 0091** (faqat funksiya almashtirildi; prod'ga qo'llandi va tekshirildi).

- **Menejer**: bazada bitta "Menejer" kasbi yo'q — 77 ta aniq menejer bor. Avval "menejer kerak" deyilsa tasodifiy
  "Tadbir tashkilotchisi (event menejer)" tanlanib qolardi, "meneger" esa umuman tushunilmasdi. Endi:
  - "menejer", "meneger", "menedjer", "менеджер", "manager" — bitta so'z;
  - qaysi menejerligi aytilgan bo'lsa ("savdo menejeri", "restoranga meneger") — darhol o'sha kasb;
  - aytilmagan bo'lsa — ish beruvchiga "Qanday menejer kerak?", ishchiga "Aynan qanday menejersiz?": avval 12 ta ko'p
    so'raladigani (savdo, ofis, HR, loyiha, SMM, restoran, marketpleys, mijozlar bilan ishlash, kontent, mehmonxona,
    ta'minot, operatsion), "Hammasi · 77 ta" — qolgani;
  - qidiruvda "menejer" — bitta kasbga bog'lanmaydi, e'lon sarlavhalaridan qidiriladi ("meneger" ham).
- **E'lon rasmi**: faol adminlar uchun shaxsiy sutkalik chegara (5 ta) va bir e'longa 3 urinish chegarasi yo'q — sinab
  ko'rish uchun. Oddiy foydalanuvchilarda o'zgarish yo'q; umumiy sutkalik chegara (100 ta) adminga ham amal qiladi.
  Chegara har kuni 05:00 da (Toshkent vaqti) yangilanadi.

## 2026-11-24 · Audit: jinsi va yosh kanalga ham, ishchiga ham; har kasbga aniq savol; asosiy tugma — savollar bilan (`fix/audit-requirements`)

Ega: "bir marta umumiy audit qilib chiq, xatolarni top, tuzat; har bitta kasb uchun so'rov ber; kanalga jinsi, yoshi
kelmayapti e'londa — hammasini detalniy tekshir, kamchilik qolmasin". **Migratsiya yo'q.**

Topilgan xatolar va tuzatishlar:
- **Ish beruvchining asosiy "E'lon berish" tugmasi** (menyu, sarlavha, bosh sahifa) `/post/vacancy` — oddiy 4 qadamli
  formaga olib borardi: u yerda kasbga xos savollar, jinsi, yosh, ish vaqti yo'q edi. Endi yangi e'lon — doim savollar
  bilan (AI bilan vakansiya); oddiy forma — "Oddiy forma" bosilganda (`?step=…`) va tahrirlashda.
- **Oddiy formada ham** (3-qadam, "Talablar"): kasbga xos savollar, jinsi, yosh chegarasi, ish vaqti (kerak bo'lsa);
  javoblar e'lon matniga ✅ bilan, tahrirda saqlangan qiymatlar ko'rinadi.
- **Kanal posti (vakansiya)**: "👤 Jinsi: … · Yoshi: …" — har doim (talab yo'q bo'lsa — "farqi yo'q"); tavsifdagi ✅
  bandlar ko'proq sig'adi (14 qatorgacha).
- **Ishchi e'loni**: jinsi va yoshi so'raladi (chatda: "Siz erkakmisiz yoki ayol?", "Yoshingiz nechada?" — "28",
  "1998" ham tushuniladi; oddiy formada ham — ixtiyoriy). E'londa birinchi ✅ band ("Erkak, 28 yosh"); profilda
  jinsi bo'lmasa — u ham yoziladi (ishchi qidiruvidagi filtr uchun). Profildagi tug'ilgan sana o'z-o'zidan e'longa chiqmaydi.
- **Kanal posti (ishchi)**: e'londagi ✅ bandlar ham chiqadi — jinsi va yoshi, kasbga xos javoblar, izoh (raqam va
  havolasiz, 6 tagacha).
- **Kasbga mos bo'lmagan savollar**: soha ichida kasb nomiga qarab aniqlashtirildi — ta'lim (avtoinstruktor — guvohnoma,
  murabbiy — mashg'ulot joyi, dotsent — ilmiy daraja, psixolog/metodist — ma'lumoti, raqs/musiqa — joy va portfolio),
  energetika (elektr — xavfsizlik guruhi, boshqalar — tungi smena), logistika (omborchi — 1C, yuklovchi — doimiy/bir
  martalik va tungi smena, logist — tillar), telekom (montaj — balandlik, sotuv — ish haqi turi, pochtalon — transport),
  tozalash (enaga — doimiy/bir martalik, ishchida sanitar daftarcha), yurist (advokat — litsenziya, boshqalar —
  ma'lumoti), davlat xizmati (politsiya, harbiy — harbiy xizmat), qurilish texnikasi operatorlari (ishchida — vaxta),
  "Boshqa" soha (doimiy yoki bir martalik). Endi 1876 kasbning hammasida ikkala rol uchun kamida bitta savol bor.
- Stendda har soha bo'yicha avtomatik yurib chiqildi (ish beruvchi va ishchi): savol chiqadi, e'lon joylanadi, jinsi va
  yosh bazada, ✅ bandlar matnda.
- Supabase maslahatlari ko'rildi: yangi xavf yo'q (eski, ma'lum ogohlantirishlar — alohida ro'yxatda).

## 2026-11-24 · Hamma kasblar uchun aniq savollar — ish beruvchiga ham, ishchiga ham (`feat/smart-questions-all`)

Ega: "hozir ustadan, kuryerdan, haydovchidan aniq kasbga mos so'raydi — hamma kasblardan, har bitta bosqich, har bir rol
uchun so'rash kerak, aniqlik bo'lsin". **Migratsiya yo'q.**

- Savollar katalogi (`requirements.ts`): 37 soha ("Boshqa"dan tashqari) — har biriga 1–2 aniq savol, **ish beruvchi** va
  **ishchi** uchun alohida. Masalan: oshpaz — qanday joy (kafe, restoran, oshxona, fast-food, to'yxona) va sanitar
  daftarcha; o'qituvchi — qayerda dars (maktab, o'quv markazi, bog'cha, onlayn, repetitorlik) va sertifikat (IELTS, CEFR);
  shifokor — muassasa va ma'lumoti; qo'riqchi — navbatchilik (kunduzgi/tungi/sutkalik) va harbiy xizmat; sotuvchi —
  savdo joyi va ish haqi (oylik/oylik+foiz/foiz), ishchida — kassa; buxgalter — 1C/Excel; IT — format va daraja
  (Junior/Middle/Senior); tikuvchi — ishbay/oylik va mashina (to'g'ri tikuv/overlok); elektrik va energetika — elektr
  xavfsizligi guruhi (II–V); konchi — vaxta; qishloq xo'jaligi — dala/issiqxona/ferma/bog' va mavsumiy/doimiy;
  muhandis — AutoCAD/Revit/SolidWorks; menejer — jamoa kattaligi; yurist — advokatlik litsenziyasi; olim — ilmiy daraja;
  telekom — balandlikda ish; go'zallik — foiz/oylik, ishchida o'z mijozlari va asboblari; dizayn, marketing, madaniyat
  (ishchi) — portfolio; hunarmand — o'z ustaxonasi; fotograf — doimiy/bir martalik; yuklovchi — doimiy/bir martalik.
- Savollar kasbdan keyin darhol, katalogdagi tartibda; gapdan va kasb nomidan tushunilgani so'ralmaydi ("kafe",
  "sanitar daftarcha", "IELTS", "maktab", "sutkalik", "armiya", "vaxta", "III guruh", "1C va Excel", "Junior"…).
- "Farqi yo'q", "Shart emas", "Yo'q" — e'longa yozilmaydi; qolgan javoblar — ✅ bandlar.
- Tungi va sutkalik navbatchilikda ish vaqti so'ralmaydi.
- Ishchi yozib javob bersa ("maktabda", "o'quv markazi", "ha, bor", "3 guruh") — tugmalardagi matnga qarab tanilaydi.
- Test: har soha ikkala rolda savolli; har savol, variant va e'lon qatori 4 tilda borligi tekshiriladi.

## 2026-11-24 · Kasbga qarab savollar: jinsi, yosh chegarasi, ish vaqti; ustalar bo'limi yashirildi; "Hozir ish qidirmoqda" — yashil (`feat/smart-questions`)

Ega: "aqli odamlarni lol qoldirsin — yozganiga qarab savol bersin, tanlagan kasbiga qarab savol bersin… e'londa jinsi, yoshi
(aniq yosh emas — yosh chegaralari), ish vaqti — ish beruvchi uchun, faqat ishga qarab so'ralsin: usta kerak desa —
qanaqa ustaligini so'raydi, shunga qarab ish vaqtini so'raydi yoki so'ramaydi; ustalar bo'limini olib tashla hozircha —
chalkashtiryapti; «hozir ish qidirmoqda» yashil bo'lsin". Tanlovlar: "Ha, shunday", "Ha, ishchiga ham", "Hamma joydan
yashir". **Migratsiya yo'q**: jinsi, yosh va vaqt ustunlari bazada bor edi (`vacancies.gender`, `age_min/max`,
`work_time_from/to`) — e'lon saqlangach egasining o'z RLS huquqi bilan yoziladi; moderatsiya triggeri bu ustunlarga qaramaydi.

- **AI bilan vakansiya** (`/post/vacancy?ai=1`): har kasbga — "Erkak kerakmi yoki ayol?" (Erkak / Ayol / Farqi yo'q) va
  "Yoshi qancha bo'lsin?" (18–25, 18–35, 25–45, 35–55 yosh, farqi yo'q yoki o'zi: dan–gacha, 14–80).
  "Soat nechadan nechagacha ishlaydi?" (08–17, 09–18, 10–19, boshqa vaqt, kelishiladi) — faqat kerak joyda: masofaviy,
  bir martalik va smenali/erkin grafikda so'ralmaydi.
- **Kasbga xos savollar** (kasbdan keyin darhol): haydovchi — guvohnoma toifasi va mashina kimniki (avtobus, samosval
  kabi texnikada mashina so'ralmaydi; traktorda — toifa ham); kuryer — nimada yetkazadi; tikuvchi — ishbay yoki oylik
  (ishbayda maosh savoli "oyiga taxminan qancha"); usta/quruvchi/elektrik/santexnik — doimiy yoki bir martalik (bir
  martalikda grafik va vaqt so'ralmaydi); IT/dizayn — ofisda, masofadan yoki aralash ("masofadan" — joy so'ralmaydi).
  Javoblar e'lon matniga ✅ bandlar bo'lib tushadi.
- **Gapdan tushunadi**: "C toifa", "С тоифа", "o'z mashinasi bilan", "bir martalik", "dona bay", "masofadan", "25-45 yosh",
  "25 yoshdan 40 yoshgacha", "от 20 до 35 лет", "soat 8 dan 17 gacha", "с 9 до 18", "qiz kerak", "yigitlar", "девушка" —
  qayta so'ralmaydi ("Tushundim:" qatorida ko'rinadi). Kasb nomidan ham ("C toifa haydovchi", "Piyoda kuryer"). Yosh va
  maosh soat deb adashtirilmaydi; "men" (o'zbekcha) va "ayollar kiyimi" jins deb olinmaydi. AI ulangan bo'lsa — faqat
  matnda asosi bo'lsa qabul qilinadi (`keepGender`, `keepAge`, `keepHours`).
- "Ish vaqti qanday?" (5/2, 6/1…) savoli → **"Ish grafigi qanday?"**; e'lon matnida "Ish grafigi: 5/2."
- Jarayon ko'rsatkichi — shu e'longa kerakli savollar soni (masalan, haydovchida 16, masofaviy ishda 13).
- Oxirgi ekran va oddiy formaning tekshirish sahifasi: kasbga xos javoblar, ish vaqti, jinsi, yosh — "O'zgartirish" bilan.
- Telegram kanal posti: "🕘 5/2 · 09:00–18:00", "👤 Ayol · 18–35 yosh".
- **Ishchi e'loni (chatda)**: kasbdan keyin — haydovchi: "Haydovchilik guvohnomangiz qaysi toifada?" va "Shaxsiy
  mashinangiz bormi?"; kuryer: "Nimada yetkazasiz?"; usta: "O'z asboblaringiz bormi?". Tugma yoki yozib ("C", "ha",
  "нет", "velosipedda"); gapda aytilgani so'ralmaydi. Javoblar e'londa ✅ ("Shaxsiy mashinam bor"; "yo'q" yozilmaydi).
  Kasb sohasi serverda aniqlanib kasb tanlovlariga qo'shiladi (`worker-extras.ts`).
- **"Universal ustalar xizmati" yashirildi** (`MASTERS_ENABLED = false`, `features/masters/flags.ts`): yon menyu, planshet
  belgisi, sayt menyusi, footer, bosh sahifa bo'limlari va tezkor havolalar, Profil, sitemap, Telegram kanalga
  joylash. E'lonlar bazada qoladi, eski havolalar (`/ustalar…`) ochiladi; e'lon egalariga "E'lonlarim"da o'z e'loni
  ko'rinaveradi. Qaytarish — bayroqni `true` qilish.
- **"Hozir ish qidirmoqda" — yashil** (nuqta ham); "Hozir ishchi kerak" — qizilligicha.
- Testlar: `requirements.test.ts` (yangi), guide-logic, post-logic, ai-guard, autopost, autopost-format; e2e —
  vacancy-guide (haydovchi, IT masofadan, kuryer, usta), chat-post (haydovchi, usta), masters/simple-app/ai-entry/home-market.

## 2026-11-24 · Kartadagi tugma: "Ko'rish →" (o'ng tomonda), ko'k shaffof shisha, e'lon sahifasi (`feat/open-btn-blue`)

Ega (telefon skrinshoti): "yanada kichiklashtir; rangini ko'k qil; to'rtta burchakdan soya bo'lsin, ichini to'la rang
qilma; 4 ta burchakdan quyosh nuri ozgina tushadi — shunaqa, ko'k rang shaffof bo'lib"; keyin: "rang yaxshi, yozuv
boshqacha, ochishni boshqacha qilish kerak" — tanlovi: ochilishi — **alohida sahifa**; yozuv — "Ko'rish bo'lsin, o'ng
tomonda" (**"Ko'rish →"**, kartaning o'ng tomonida). Migratsiya yo'q.

- "E'lonni to'liq ko'rish" o'rniga "Ko'rish →" (o'ng tomonda): e'lonning o'z sahifasi (vakansiya — /jobs/…, ishchi — /listing/…; u yerda
  hamma ma'lumot, telefon, ariza). Kartaning o'zida ochilish (2026-11-19) va uning server amali (`card-details.ts`) olib
  tashlandi.
- Tugma kichikroq (ko'rinishi 36px, bosiladigan joy 44px — a11y), yozuv ko'k (`text-primary-ink`).
- `.glass-blue` (globals.css): yupqa ko'k tus (to'la rang emas), ko'k chegara, to'rt tomondan yumshoq ko'k soya, ichida
  chetlardan yorug'lik, to'rt burchagida kichik oq "nur" dog'lari (ega so'rovi bilan bezak — faqat shu tugmada).

## 2026-11-24 · Kanalga usta e'lonlari — ishchi e'lonlari kanaliga (`feat/masters-channel`)

Ega: "Kanalga e'lon bordimi, ustalar joylagan?" — yo'q edi (kanalga faqat vakansiya va ishchi e'lonlari chiqardi); ega
tanlovi — "Ishchi e'lonlari kanaliga", "faqat yangilari", "universal ustalar xizmati bo'lsin nomi — ilovada ham, e'londa
ham". **Migratsiya 0090 prod'ga qo'llandi** (ega: "o'zing qo'lla"; `apply_migration`, 2026-11-24): `channel_posts.entity_type`
— `master` ham; qatorlar 88 → 88 (ma'lumot o'zgarmadi). `APPLIED_UNTIL = 90`.

- Bo'lim nomi — **"Universal ustalar xizmati"** (ru "Сервис универсальных мастеров", en "Universal masters service"):
  menyular, bo'lim sahifasi, admin; kanal postining boshida ham — "🛠 Universal ustalar xizmati".

- Faol, haqiqiy (demo emas), egasi bloklanmagan usta e'loni — ishchi e'lonlari kanaliga, bir marta: darhol katalogga
  chiqsa — joylangan zahoti; tekshiruvdan o'tgani — fon navbati bilan (oxirgi 24 soat). Sozlama — "Ishchi e'lonlari va
  ustalar": o'chirilsa, ustalar ham chiqmaydi; alohida kanal ko'rsatilsa — o'sha kanalga.
- Post: "🛠 Universal ustalar xizmati", kategoriya (yoki "Boshqa xizmatlar"da ustaning o'z yozgani), sarlavha, xizmatlar,
  joy, tajriba, narx, tavsif (avtomatik tavsif takrorlanmaydi). Ism va telefon yo'q — "📞 Bog'lanish" saytdagi e'lonning
  aloqa qismiga. Rasm — e'lon rasmi (AI) yoki birinchi ish namunasi; ikkalasi ham yo'q — rasmsiz.
- Admin "Telegram kanal": "Ishchi e'lonlari va ustalar (ISHCHI)".

## 2026-11-24 · Ustalar: e'lon rasmi (AI) — 0089 (`feat/master-images`)

Ega: "ustalarda ham rasm yaratish bo'lsin"; "bazani yangila" (2026-11-24). **Migratsiya 0089 prod'ga qo'llandi**
(Supabase, `apply_migration`, 2026-11-24): `listing_images.entity` — `master` ham, `claim_listing_image` — `master` ham.
Hech narsa o'chirilmadi (oldin 9 ta rasm qatori — keyin ham 9 ta); anon/authenticated'ga ruxsat yo'q (tekshirildi).
`APPLIED_UNTIL = 89`, `pending.sql` — bo'sh.

- "Usta bo'lish"ning oxirgi oynasida — "E'lon rasmi" (AI; ish joyi va asboblar, odam portreti emas; ixtiyoriy).
- Rasm — kartada (ish namunasi bo'lmasa) va e'lon sahifasida banner. Ish namunalari — alohida (faqat ustaning haqiqiy
  ishlari; AI rasm u yerga qo'shilmaydi).
- Sahna xizmat kategoriyasi bo'yicha (konditsioner, santexnika, elektr, maishiy texnika, ta'mir, bo'yoq, qurilish,
  payvand, qulf, yuk tashish, mebel). Xarajat chegaralari — vakansiya va ishchi e'lonlari bilan bir xil.
- Ortga qaytarish (kerak bo'lsa): `listing_images_entity_check` — ('vacancy', 'worker'), `claim_listing_image` — 0087 dagi
  ko'rinish (avval `entity = 'master'` qatorlarini o'chirish kerak).

## 2026-11-24 · Chatda tayyor xat va qadalgan e'lon, shifokor/o'qituvchi savoli, ustalar qidiruvi (`feat/chat-intro-professions`)

Ega (telefon skrinshotlari): "Chatda yozishni bossa — e'lon qadalib, «Assalomu alaykum»dan boshlanadigan rasmiy tayyor
matn"; "shifokor/doktor deb yozsam — doktorant PhD bo'lib joylandi; doktor desa — qanday doktor, o'qituvchi desa — qanday
o'qituvchi" (qo'shimcha savol — **faqat guruhlarda**, ega tanlovi: oshpaz, buxgalter kabi aniq kasbda so'ralmaydi);
"E'lonni to'liq ko'rish — kichikroq, sariq shishasimon"; "ustalarda qidirsam bo'lmadi; qanday yozmasin tanib topsin".
Migratsiya yo'q. (Ustalar e'loni rasmi — alohida, bazaga 0089 qo'llangach.)

- **Chat:**
  - Suhbat tepasida — qadalgan e'lon (rasm yoki belgi, sarlavha, hudud; bosilsa — e'lon sahifasi).
  - Yozish maydonida tayyor rasmiy xat (faqat hali yozmagan tomonga; o'zgartirsa bo'ladi): ish beruvchidan ishchiga —
    "Assalomu alaykum, {ism}! «…» e'loningizni Ish topdim platformasida ko'rdim. Sizni bizga kerakli xodim deb o'yladim…";
    ishchidan vakansiyaga va arizachiga ham. uz/ru/en.
  - Sarlavhadagi kichik "E'lon: …" yozuvi o'rniga — qadalgan karta.
- **Kasbni tushunish:**
  - "Shifokor", "doktor", "vrach" — "Shifokorlar" guruhi: "Aynan qanday shifokorsiz?" (avval "tushunmadim" /
    "Tayanch doktorant (PhD)"). Guruhning aynan yozilgan sinonimi endi qidiruvda ham guruhni topadi ("kamaz", "frontend").
  - Variantlar ro'yxatida yopiq holatda har yo'nalishdan bittadan (terapevt, kardiolog, pediatr); hammasi — qidiruv bilan.
  - Ish beruvchi yordamchisida ("shifokor kerak") — turli yo'nalishdagi 12 tagacha shifokor (doktorantlar emas).
- **Karta:** "E'lonni to'liq ko'rish" — kichikroq, sariq shishasimon, soyali.
- **Ustalar:**
  - Qidiruv: "konditsioner ustasi kerak", "santexnk", "сантехник", "kir yuvish mashinasi" — kategoriya tanib olinadi
    (lotin/kirill/rus, qo'shimchalar, imlo xatosi), natija o'sha kategoriyadan; sarlavha va chip ham.
  - "Qanday ustasiz?" — yozib ham bo'ladi: "Topildi: Konditsioner ustasi"; tanilmasa — "Boshqa xizmatlar", yozgani xizmat.

## 2026-11-23 · Bosh sahifa: "nurli shisha" tugmalar, pastki menyuda "Bosh sahifa", e'lon tanlovi (`feat/home-tiles-glass`)

Ega: tugmalar uchun variantlardan **1 — nurli shisha**; "Bosh sahifa qo'shilsin pastga"; "e'lon berish bosilganda
birinchisi 'Ishchi izlash uchun', ikkinchisi 'Ish izlash uchun' deb chiqsin". Migratsiya yo'q.

- **Uchta tugma (nurli shisha):** "Ish qidiryapman" va "Ishchi qidiryapman" — to'q ko'k oynali tugmalar, oq yozuv,
  dumaloq belgi; ichida burchakdan ko'k/turkuaz nur, pastda yumshoq dog', tepada ingichka yaltirash. "E'lon berish" —
  shu uslubda sariq. Bosilganda biroz ko'tariladi. 320px'da yozuv so'z o'rtasidan bo'linmaydi (test).
- **Pastki menyu (telefon) va yon menyu (kompyuter):** birinchi bo'lim — **"Bosh sahifa"** ("/"). Kirgan foydalanuvchi
  ham "/" da endi Bosh sahifani ko'radi (avval chatga o'tkazilardi). Suhbat — "Qidiruv" (/chat).
  - Bosh sahifadagi qidiruv, "Ish/Ishchi qidiryapman" va "E'lon berish" — "Qidiruv"da yangi suhbat bo'lib ochiladi
    (`/chat?…&from=home`; oldingi suhbat tozalanadi, manzil o'zi tozalanadi).
  - Kirgandan va profil tugagach — avvalgidek chatga (ega, 2026-11-20).
- **"E'lon berish" tanlovi:** savol "E'lon nima uchun: ishchi izlash uchunmi yoki ish izlash uchunmi?"; tugmalar
  tartibi — 1) "Ishchi izlash uchun" (vakansiya), 2) "Ish izlash uchun" (o'zim haqimda e'lon). Rus va ingliz
  tillarida ham.
- Brend qo'riqchisi: `home-start.tsx` uchun "blur" — ega so'rovi bilan istisno.

## 2026-11-23 · Bosh sahifa kompyuterda kengroq va oynali yon menyu (`feat/home-wide`)

Ega (kompyuter skrinshoti): "sahifa juda tor" — katta ekranda o'rtada ingichka ustun, ikki yon bo'sh; "yon bar oynani
dizaynini mukammal qil, oynali qilib, ranglar ketma-ketligini mukammal ishla" — variantlardan **A (och shisha)**.
Migratsiya yo'q.

- **Yon menyu (kompyuter, kirgan foydalanuvchi):**
  - Ekran chetidan ajralgan, yumaloq burchakli oynali (shisha) panel. Orqasidan ko'k, sariq va turkuaz rangli xira
    dog'lar ko'rinib turadi.
  - Ranglar bir tartibda: "E'lon berish" — sariq (bosh sahifadagi tugma bilan bir xil), tanlangan bo'lim — och ko'k
    plita va chap chiziq, qolgan bo'limlar — bir xil kulrang. Avvalgi jigarrang "Qidiruv" va turkuaz "Universal
    ustalar" o'rniga oddiy qatorlar.
  - Brend qo'riqchisi: `app-shell.tsx` uchun "blur" — ega so'rovi bilan istisno.

- **Kenglik:** bosh ekran (chat bo'sh holati) kompyuterda kengroq: 1024px'dan — 64rem, 1280px'dan — 72rem,
  1536px'dan — 80rem. Telefon va planshetda o'zgarish yo'q. Suhbat boshlangach — avvalgidek o'qish uchun tor ustun.
- **Joylashuv (keng ekranda):** qidiruv qatori bir qatorda (matn · hudud · "Qidirish"); tezkor bo'limlar bir qatorda;
  "Eng yangi vakansiyalar" — 2 ta karta yonma-yon; "Barcha vakansiyalar (N)" o'rtada; sarlavha kattaroq.
- **Video:** birinchi kirishda ochiladigan video kengaymaydi (o'rtada, avvalgi o'lchamda).

## 2026-11-23 · Qidiruv qatoridagi yozuv va yangi "E'loningiz joylandi" ekrani (`feat/home-hint-done`)

Ega: qidiruv qatoridagi "Kim kerak: oshpaz, haydovchi…" kesilib qolardi — "Yozing, o'zingizga mosini toping" bo'lsin va
sig'sin; "E'loningiz joylandi" ekranining dizayni yoqmadi — variantlardan **A (yengil)** tanlandi. Migratsiya yo'q.

- **Qidiruv qatori:** ichidagi yozuv — "Yozing, o'zingizga mosini toping" (ish beruvchi va ish izlovchida bir xil).
  Tor telefonda kesilmaydi, ikkinchi qatorga o'tadi (320px'da ham to'liq).
- **"E'loningiz joylandi" ekrani** (vakansiya, ishchi e'loni, AI bilan e'lon — bitta komponent):
  - Katta yashil ramka o'rniga — yumaloq belgi, "E'loningiz joylandi!" va qisqa matn.
  - Joylangan e'lonning kartasi: nomi, maoshi, joyi va "Faol · Qidiruvda ko'rinyapti". Bu yozuv faqat e'lon
    haqiqatan qidiruvda ko'ringanda chiqadi.
  - Bitta katta tugma ("Ishchilarni ko'rish"). Ostida yonma-yon ikkita kichik tugma: "E'lonni ko'rish" va "Ulashish".
    "Ulashish" telefonda ulashish oynasini ochadi, kompyuterda havolani nusxalaydi.
  - Tekshiruvdagi va to'lov kutayotgan holatlar ham shu uslubda; "joylandi" deyilmaydi.

## 2026-11-23 · Yangi bosh ekran: qidiruv qatori va sariq "E'lon berish" (`feat/home-search-first`)

Ega variantlardan tanladi: bosh sahifa — **C (qidiruv qatori)**, pastki menyu — **hozirgidek 3 ta**, rang — hozirgi ko'k,
faqat **"E'lon berish" sariq**. Migratsiya yo'q.

- **Bosh ekran (chat bo'sh holati, "/" va "/chat"):**
  - Sarlavha "Ishingiz shu yerdan boshlanadi!".
  - Qidiruv qatori: kasb + hudud ro'yxati ("Butun O'zbekiston", viloyatlar, "Masofaviy") + "Qidirish". Natija shu
    chatda chiqadi, tanlangan hudud qayta so'ralmaydi. Matnda hudud aytilgan bo'lsa ("Samarqandda oshpaz") — o'sha
    hudud olinadi. Viloyat shu qurilmada eslab qolinadi. Ish beruvchi rejimida qator ishchilarni qidiradi.
  - Uchta katta tugma: "Ish qidiryapman", "Ishchi qidiryapman" va sariq **"E'lon berish"**. "E'lon berish"da kimligi
    so'ralmaydi: ikkala variant chiqadi ("O'zim haqimda" / "Vakansiya").
  - Tezkor bo'limlar: Yangi vakansiyalar, Kunlik ishlar, Talabalar uchun, Universal ustalar, Masofaviy. Ish
    beruvchida: Barcha ishchilar, Tajribali, Yaqin ishchilar, Universal ustalar.
  - **"Eng yangi vakansiyalar"**: bazadagi haqiqiy 2 ta e'lon va "Barcha vakansiyalar (N)". E'lon bo'lmasa bo'lim
    ko'rinmaydi. Ish beruvchida — yangi ishchilar.
  - "Qanday ishlaydi?" videosi birinchi kirishda tepada ochiq (avvalgidek), ko'rilgach — pastda kichik tugma.
  - Pastdagi yozish maydoni bosh ekranda yashirin (ikkita matn maydoni bo'lmasin), suhbat boshlangach chiqadi.
- **Tanishuv (tugmalar bilan):** sariq "E'lon berish" telefonda ham tushuntiriladi, "Ishchi qidiryapman"dan keyin.
- **Rang:** `--highlight-hover` qo'shildi. Sariq ustida to'q matn (kontrast testida tekshiriladi).
- **Testlar:** e2e'da bosh ekrandan yozish endi qidiruv qatoridan (`homeSearch`). Yangi testlar: tartib va 320–1280px
  sig'ishi (tugma yozuvi so'z o'rtasidan bo'linmaydi), qator + viloyat → savolsiz natija, sariq tugma.

## 2026-11-22 · ISH TOPDIM 2.0 — 1-bosqich: qidiruv, matnlar, haqiqiylik (`feat/ish-topdim-2`)

Ega: "foydalanuvchi «ish kerak», «voditel», «oshpaz», «работа» deb yozsa ham mazmunan mos natijalarni topishi kerak";
"320px dan 1920px gacha hech qanday matn boshqa element ustiga chiqmasin"; "mavjud bo'lmagan ish o'rinlari, soxta
kompaniyalar va sun'iy statistikalar ko'rsatilmasin"; "Supabase'dagi ma'lumotlar saqlansin". Migratsiya yo'q.
Audit: `docs/ISH_TOPDIM_2_AUDIT.md`, hisobot: `docs/ISH_TOPDIM_2_FINAL_REPORT.md`.

- **"ish kerak", "работа":** "Kasbingiz qanday?" savolida birinchi tugma **«Hamma ishlar»** (ish beruvchida —
  «Hamma ishchilar»). "farqi yo'q", "hammasi", "любая", "все" deb yozish ham shu ma'noda tushuniladi.
- **Butun soha so'zlari:** "kuryer", "доставка", "IT", "айти", "call-markaz" yozilsa, shu sohaning hamma vakansiyalari
  chiqadi. Avval faqat "Piyoda kuryer" qidirilardi.
- **Bo'sh natijada:**
  - Shu kasbga tegishli so'z e'lon nomlarida qidiriladi ("Shunga yaqin ishlar").
  - Yaqini ham bo'lmasa — **"Hozir shu kasblarda ish bor:"**: haqiqiy, sanalgan e'lonlari bor kasblar, bir bosishda
    qidiriladi.
- **Kasbni tushunish:** "manual qa" endi "Manual QA" (avval "Manual terapevt"). Qisqa so'zlar (qa, hr, ux, it)
  tashlab yuborilmaydi. "grushik" → "gruzchik". "vakansiya" so'zi kalit so'z emas.
- **Moderatsiya xatosi:** katalogdagi "Sex boshlig'i" ("цех") va "tikuv sexi" kabi e'lonlar yashirilib, egasi
  bloklanardi. Yalang'och "sex" qoidadan olindi. "seks", "sexy", "sexual" o'z joyida.
- **Matnlar (434 tekshiruv: 320…1920px, uz/ru/oz, katta shrift):**
  - Profilda telefon raqami tahrirlash tugmasi ostida qolardi — tuzatildi.
  - Tariflarda narx pastki qatorga tegardi — tuzatildi.
  - CI'ga 768 va 1920 qo'shildi.
- **Chat:** Profilda rol almashtirilsa, oldingi rolning yarim qolgan suhbati tiklanmaydi. Avval ish beruvchi
  ekranida ishchi savoli ("Kasbingiz qanday?") kutib turardi.
- **Benchmark:** `npm run bench:search` — lokal stendda 1224 ta namunaviy vakansiya va 84 so'rov. Natija: 84/84,
  p95 ≈ 170 ms. Seed faqat `ishuz_e2e` bazasida ishlaydi.

## 2026-11-22 · Moslik olib tashlandi, e'longa izoh, chatdagi tuzatishlar (`feat/no-matching`)

Ega: "moslikni hamma joydan olib tashla, umuman kerak emas — ish beruvchilar uchun ham, ish qidiruvchilar uchun ham";
"mavjud e'lonlarni ko'rdi — tagida kichkina «+ E'lon joylash»"; "izoh yozish bo'lsin — obed, yo'lkira tekin… chiroyli
e'lon qilib taxlash kerak, keyin joylash"; "pastdagi yozuv har bitta so'rovda o'zgarsin, jo'natish belgisi qimirlab
tursin"; skrinshotlardagi xatolar. Moslik bildirishnomalari: "ular ham o'chsin". Migratsiya yo'q.

- **Moslik yo'q**: kartalardagi «Mos»/foiz belgisi, vakansiya va ishchi sahifasidagi moslik bloki, «Sizga mos» bo'limi,
  arizalardagi «Mosligi bo'yicha» saralash, vakansiya boshqaruvidagi «Mos ishchilar», «Moslik tahlili» sahifasi, «PRO
  kuzatuv» (mos ish chiqsa — xabar) va uning tugmalari olib tashlandi. Eski havolalar boshi berk emas: `/cabinet/matches` →
  E'lonlarim, `/jobs/…/moslik` → vakansiyaning o'zi, `/ai-alerts` → Profil. «Telegramni bog'lash» sahifasi — faqat ulash.
- **Bildirishnomalar**: «mos ish / mos nomzod topildi» xabarlari ro'yxatda va sonda ko'rinmaydi, Telegram'ga yuborilmaydi
  (o'qilgan, `skipped`/`matching_off`); moslik navbati ishga tushirilmaydi. «Yangi ariza» xabarida «· Juda mos» yo'q.
- Tariflar va to'lov oynasida «PRO kuzatuv» va «mos ishchilarga xabar» endi va'da qilinmaydi; PRO kuzatuvga yangi to'lov
  qabul qilinmaydi. Matnlardagi «mos» so'zi (sarlavha, yordamchi, bo'sh holatlar) oddiyroq so'zlarga almashtirildi.
  Saqlangan qidiruv xabari qoldi («Shu so'rov bo'yicha yangi ish chiqsa, xabar beramiz»).
- **Izoh**: vakansiya yordamchisida «Qo'shimcha izoh bormi?» qadami (Obed tekin, Yo'lkira tekin, Yotoqxona bor… yoki o'zi
  yozadi), ishchi e'lonida — chatda (tajribadan keyin) va /ai/post oynasida. «obed, yo'lkira tekin» → «✅ Obed tekin» /
  «✅ Yo'lkira tekin»: bandlarga ajratiladi, telefon/havola olib tashlanadi, takrorlar yo'q. E'lon sahifasida va
  ko'rinishida yashil belgili ro'yxat. «yo'q» deb yozsa — izohsiz.
- **Chat**: natijalar ostida kichik «+ E'lon joylash» (ish izlovchi — shu chatda, qidirgan kasbi bilan; ish beruvchi —
  vakansiya yordamchisi); pastdagi yozuv har savolga mos (telefon savolida «Masalan: 90 123 45 67» va raqam klaviaturasi);
  jo'natish strelkasi sekin tepaga qimirlab turadi (harakatni kamaytirish yoqilgan bo'lsa — yo'q).
- **Tuzatishlar**: arizalar filtri qatori sig'adi; «Ish qidiruvchi ko'rinishi»dagi tugma va joy nomi kesilmaydi; vakansiya
  sahifasidagi bo'limlar qatori («Manzil» va boshqalar) kesilmaydi.

## 2026-11-22 · E'lon rasmi — joylashdan oldin (`feat/image-before-publish`)

Ega: "nimaga rasm yaratilmadi? rasmni e'lon joylashdan oldin yaratish kerak, ma'qul kelsa joylash kerak". Sabab: OpenAI
hisobida balans yo'q edi (429 credit_balance_exhausted) — ega to'ldiradi.

- **Rasm endi tekshirish sahifasida**, «Joylash»dan oldin: «Rasm yaratish» → rasm shu yerda ko'rinadi → ma'qul bo'lsa —
  e'lon shu rasm bilan joylanadi; «Boshqa rasm» — yangisi; «Rasmsiz» — olib tashlanadi. Vakansiya (oddiy forma va AI bilan
  oson joylash), ishchi e'loni (forma, /ai/post, chatdagi e'lon kartasi) — hammasida. Joylangandan keyingi savol olib
  tashlandi. Tahrirda ham shu yo'l (yangi rasm eskisining o'rnini oladi).
- Rasm qoralama sifatida yaratiladi va joylanganda e'longa biriktiriladi; begona e'lon id'si qoralama bo'la olmaydi.
- **OpenAI tomonidagi xato** (balans tugagan, chegara, xizmat ishlamayapti) urinish hisoblanmaydi va «Rasm xizmati hozir
  ishlamayapti — e'lonni rasmsiz joylashingiz mumkin» deb aytiladi (avval e'lon «3 marta urinildi» deb qulflanib qolardi).

## 2026-11-22 · Chatdagi kartalar rasm bilan (`feat/card-images`)

Ega: "rasm yaratib bersin chiroyli qilib e'lonlar uchun, ilovada ham rasm bilan ko'rinsin". Tanlov: yangi e'londa rasm —
so'rab (hozirgidek), eski e'lonlarga yaratilmaydi.

- Chat natijasidagi vakansiya va ishchi kartalari tepasida rasm: haqiqiy ish joyi surati («Ish joyi surati»), bo'lmasa —
  egasi yaratgan AI e'lon rasmi (belgisiz — ega: "«AI rasm» yozuvi bo'lmasin"). Rasmsiz e'lon — avvalgidek.
- Ishchi e'loni uchun AI rasmda endi kameraga qaragan portret chizilmaydi — ish joyi va asboblari (odam bo'lsa — orqadan yoki
  uzoqdan): belgisiz rasm e'lon egasining o'z surati deb o'ylanmasin.

## 2026-11-22 · Ovozli video va tugmalar bilan ovozli tanishuv (`feat/intro-voice`)

Ega: "video ovozini ber, keyin ilovaga kirganda ilovani ovozli tushuntirsin, tugmalar nima vazifani bajarishini — uni ham
ovozini ber". Ovozlarni ega ElevenLabs'da yaratib yubordi ("Farruh — Confident", erkak ovozi).

- **Video-tushuntirish** endi ovozli: "Ha, yoqing" — ovoz bilan, "Ovozsiz" — yozuv bilan. Sahnalar ovozdagi gaplar bilan
  bir vaqtda almashadi (29 soniya).
- **Tugmalar bilan tanishuv** video tugagach yoki yopilgach boshlanadi (avval ikkalasi bir vaqtda chiqib qolardi): ikki
  katta tugma, yozish maydoni, Qidiruv · E'lonlarim · Profil, keyin yuqori panel (E'lon berish, xabarlar, til, kirish,
  qo'ng'iroqcha). Har biri yoritiladi va ovoz bilan aytiladi. Videoda "Ovozsiz" tanlansa — tanishuv ham jim.
- Eski (endi yo'q bo'lgan) tugmalar — "Bosh sahifa", "Ishlar", "Sohalar", "Boshqaruv"… — tanishuvdan olib tashlandi.

## 2026-11-22 · Kanal postida heshteglar yo'q (`fix/channel-no-hashtags`)

Ega (kanaldagi postni belgilab): "shu belgilagan narsani olib tashla"; "ishchi ish qidiryapti, ish beruvchi ishchi
qidiryapti deb kelsin".

- Post matni boshida endi oddiy yozuv: "💼 Ish beruvchi ishchi qidiryapti" (vakansiya) / "👤 Ishchi ish qidiryapti"
  (ishchi). Heshteglar (#kasb #tuman) va "VAKANSIYA · / ISHCHI ·" yo'q. Faqat yangi postlarga; eskilari o'zgarmaydi.

## 2026-11-22 · Korporativ uslub, chat ketma-ketligi, kanalda ishchi raqamisiz (`feat/corporate-chat`)

Ega: "har bir oyna jiddiy, korporativ bo'lsin (oq + to'q ko'k)"; "avval 2 ta variant — ish qidiryapman / ishchi qidiryapman,
keyin ketma-ket"; "tanlashda boshida 3 tasi, «Tanlash» bosilsa hammasi yoki qidiruvga yozsin"; "kanalga nomeri bilan
bormasin — «Bog'lanish» raqam ochishga olib borsin"; "tepada video bilan tushuntirsin, ovozga ruxsat so'rasin".

- **Uslub (K1)**: ish beruvchi paneli to'q ko'k (avval binafsha), ishchi — yorqin ko'k; burchaklar kichikroq, soyalar yassi.
- **Chat bosh ekrani**: tepada qisqa video-tushuntirish (animatsiya, yozuv; ovoz — keyin qo'shiladi), sarlavha va ikki katta
  tugma — «Ish qidiryapman» / «Ishchi qidiryapman». Tugma bosilsa rejim ham shunga o'tadi.
- **Ketma-ketlik**: kasb (ommabop 3 tasi + «Hammasini ko'rish» + qidiruv) → viloyat (3 tasi + qolgani + qidiruv) →
  «Endi nima qilamiz?»: ish izlovchiga «Mavjud e'lonlarni ko'rish» / «O'zim haqimda e'lon berish» (kasb va viloyat bilan
  boshlanadi), ish beruvchiga «Mavjud ishchilarni ko'rish» / «Vakansiya joylash». Bitta to'liq gap yozilsa — darhol natija.
- «Aynan qanday o'qituvchisiz?» va e'londagi viloyat ham shu tanlovda: 3 tasi, hammasi, qidiruv.
- «E'lon joylamoqchiman» (kimligi aytilmagan) — rejimdan taxmin qilinmaydi, ikkala variant chiqadi.
- **Ishchi e'loni sahifasi** professional ko'rinishda: sarlavha (kasb), kutilayotgan maosh, odam qatori, «Ma'lumotlar» /
  «O'zi haqida» bo'limlari (hudud, tajriba, soha, ish grafigi).
- **Vakansiya sahifasi** ham shu uslubda: «Vakansiya» yorlig'i, sarlavha, katta ko'k maosh, holat; ish beruvchi qatori;
  asosiy shartlar (bandlik, grafik, tajriba, manzil) ikki ustunda; raqamlar (joylangan, ko'rishlar, arizalar) — pastda
  kichik qatorda; bo'limlar havolalari — tab ko'rinishida (bo'limlar avvalgidek ochiq).
- Testlar: ochilgan raqam oldingi yugurishdan qolmaydi (ai-post), joylashuv sahifa boshidan o'lchanadi (detail-pages),
  oqimda kelayotgan yashirin sahifa nusxasi hisobga olinmaydi (motion).
- **Telegram kanal**: ishchi postida raqam yo'q, tugma — «📞 Bog'lanish» (saytda e'londagi raqam ochish bo'limi). Vakansiya
  postida raqam avvalgidek. Formadagi yozuvlar shunga moslandi.

## 2026-11-22 · Ishchi raqamini ochish (4-bosqich, `feat/contact-unlock`)

Ega (master prompt, 4-bosqich): "ish beruvchi ishchi raqamini 5 000 so'mga ochadi (narx — admin), bir marta to'lanadi,
raqam ochilgach ochiq qoladi; Payme/Click kalitlari bo'lmaguncha — bepul". Tanlov: A varianti (narx tugmaning o'zida);
bepul davrda ham raqam ochilganda chat ochilsin; raqami yo'q e'lon — eslatma va qidiruvdan yashirish.

- **E'lon sahifasi va chatdagi ishchi kartasi**: bepul davrda "Raqamni ko'rsatish" — raqam, "Qo'ng'iroq qilish" va
  "Chatda yozish". Pullik rejimda "Raqamni ochish · 5 000 so'm" → to'lov oynasi (balans yetsa — hamyondan bir bosishda,
  aks holda Payme/Click) → raqam va chat shu sahifaning o'zida. Mehmonga — avval kirish, keyin shu e'longa qaytadi.
- **Bir marta — doim ochiq**: juftlik (kim kimning raqamini ochgan) saqlanadi; qayta ochish bepul, ochishlar soni
  cheklanmaydi. Ikki marta to'lab qo'yilsa — ortiqchasi hamyonga qaytadi.
- **Chat faqat raqam ochilgan juftlik uchun**: "Chatda yozish" suhbatni ochadi, sarlavhada "E'lon: <kasb>".
- **Admin → Tezkor boshqaruv**: "Ishchi raqamini ochish pullik" (o'chiq; Payme/Click ulanmaguncha yoqilmaydi) va
  "Raqam ochish narxi" (5 000 so'm).
- Pullik rejimda ishchi raqami boshqa yo'llardan ham chiqmaydi: mehmon tugmasi, eski sahifa chaqiruvi, hisob raqami,
  saqlangan ishchilar, Telegram kanal posti. Ish izlovchi uchun hammasi bepul (vakansiya raqamlari o'zgarmadi).
- **Raqami yo'q ishchi e'loni** qidiruvga chiqmaydi; egasiga Profilda va E'lonlarimda "Raqam qo'shish" eslatmasi, holat —
  "Raqam yo'q — qidiruvda ko'rinmaydi". Raqam qo'shilishi bilan e'lon o'zi qaytadi.
- Baza: `0088_contact_unlocks.sql` (pending.sql da, 0087 bilan birga). Qo'llanmaguncha sayt avvalgidek ishlaydi.

## 2026-11-21 · E'lon chatning o'zida (3-bosqich, `feat/chat-post`)

Ega (master prompt, 3-bosqich): "e'lon berish shu chatning o'zida: bittadan savol, so'ng tayyor e'lon kartasi va «Joylash»
tugmasi; rozilik — tugma ostida yozuv". Tanlov: "kasb, viloyat, ism, tajriba — tajriba bormi degan joyiga yozsin;
«raqamingizni to'lagan» deyilmasin".

- **Ishchi e'loni chatda**: "o'zim haqimda e'lon bermoqchiman" (yoki "E'lonlarim"dagi "+ E'lon joylash", "topilmadi"
  blokidagi "O'zingiz haqingizda e'lon qoldiring") — alohida ekranga o'tmaydi. Savollar bittadan: kasb (yoziladi;
  tushunilmasa — yozilganidek qaytarib, yana so'raladi; guruh bo'lsa — "aynan qaysi biri?" tugmalari) → viloyat
  (tugmalar) → ism (hisobda bo'lsa so'ralmaydi) → tajriba (yozadi — "2 yil", "6 oy", "yo'q" — yoki tugma) → telefon
  (yoziladi, majburiy; chala bo'lsa qayta so'raladi). Gapda aytilgani qayta so'ralmaydi ("Men oshpazman, …").
- **Tayyor karta**: kasb, ism, joy, e'lon matni (faqat aytilganlardan), raqam o'rtasi yopiq. Ostida "Joylash" va
  rozilik: "«Joylash»ni bossangiz, e'loningiz va telefon raqamingiz ish beruvchilarga ko'rsatilishiga rozilik
  bildirasiz." (to'lov haqida so'z yo'q).
- **Mehmon**: "Joylash" — bir marta kirib qaytadi (javoblar shu qurilmada saqlanadi), chatda o'sha karta qaytadi.
- Natija chatda: joylandi / tekshiruvda / rad etildi / to'lov kerak — haqiqiy holat bilan.
- E'lon paytida boshqa narsa yozilsa ("menga haydovchi kerak", "vakansiya joylamoqchiman") — e'lon to'xtaydi, oddiy so'rov.
- Vakansiya — hozircha yordamchi bilan alohida ekranda (o'zgarmadi).

## 2026-11-21 · Chat juda sodda: bitta yozuv va strelka; kanal — oynada (`feat/chat-simple`)

Ega (telefondagi rasm bilan): "panel to'lib qolgan, ortiqcha narsalar kerakmas — bitta strelka pastga belgisi,
«O'zingizga mos ishni yoki ishchini toping», bo'ldi. Telegram kanal ekranga chiqsin — kirgandan keyin «Obuna bo'lish»
yoki «Keyinroq»". Tanlovlar: yozuv o'rtada (A), ustalar — Profilga, tanishtiruv — qaytarilsin.

- **Chatning bo'sh holati**: o'rtada «O'zingizga mos ishni yoki ishchini toping» (hamma uchun bir xil), ostida yozish
  maydoniga qaragan strelka va yozish maydoni. Olib tashlandi: hikoya doirachalari (endi faqat ish beruvchi panelida),
  ostki izoh, misollar, kanal qatori, "Universal ustalar" havolasi. Suhbat boshlangach sarlavha faqat ekran o'qigich uchun.
- **Telegram kanal oynasi** ("Kanalga o'tish" / "Keyinroq") endi birinchi ochilishda ham chiqadi — 2-bosqichdan beri
  til ekrani yo'qligi sababli umuman chiqmay qolgan edi.
- **Tanishtiruv** (tugmalarni tushuntirish, ovozli) yangi mehmonga yana chiqadi — u ham shu sababdan to'xtab qolgan edi;
  kanal oynasi tanishtiruv tugagach chiqadi.
- **Universal ustalar** — Profilda: mehmonga kirish tugmasi ostida, kirganga "Boshqa sozlamalar" ichida birinchi qator.

## 2026-11-21 · Bosh sahifa — darhol chat (`feat/chat-home`)

Ega (master prompt, 2-bosqich): "reklama sahifasi kerak emas — kirgan zahoti chat; jaydari tilda so'rasin; AI kimligini
o'zi aniqlasin; yetishmaganini bittadan so'rasin, hududni bosib tanlasin; natija kartalar bilan shu chatda". Keyin:
"muloyim, aniq, jaydari so'zlar bilan so'rasin — odamlar nima haqda so'ralayotganini aniq bilsin".

- **Bosh sahifa ("/") = chat** (mehmon ham, kirgan ham — bir xil ekran). Tepada savol: mehmonga "Ish kerakmi yoki
  ishchi? Yozing — topib beramiz.", ish izlovchiga "Qanday ish qidiryapsiz?", ish beruvchiga "Sizga qanday ishchi
  kerak?". Ostida bosiladigan misollar — maydonga tushadi, o'zi yuborilmaydi. Birinchi ochilishda ham til/rol ekrani
  yo'q (u faqat kirish oqimida). Reklama sahifasi (qidiruv paneli, "Bo'limlar", yangi vakansiyalar, raqamlar, rejim
  almashtirgich) olib tashlandi; admin joylagan hikoyalar (doirachalar) sarlavha ustida, "Telegram kanalimizga obuna
  bo'ling" qatori misollar ostida qoladi (ega: "Telegram kanal qolsin").
- **AI rolni o'zi aniqlaydi**: "men elektrikman, ish kerak" — ish qidiradi; "menga haydovchi kerak" — ishchi qidiradi.
  Aniq bo'lmasa — bitta savol, ikki tugma ("Men ish qidiryapman" / "Menga ishchi kerak"). Mehmonning tanlovi eslab
  qolinadi.
- **Yetishmagani bittadan**: kasb aytilmagan bo'lsa — "Qanday ish qidiryapsiz? Kasbingizni yozing — masalan: …";
  tushunilmasa — bir marta aniqlashtiriladi (yozilganidek: «Kosmonavt»). Hudud — viloyat tugmalari, "Butun
  O'zbekiston", ish uchun "Masofaviy". "Kunlik ish", "masofaviy ish" kabi so'rovda kasb so'ralmaydi.
- **Natija — chatda kartalar**: "Mana, N ta ish topdim:" — avval 3 tasi, "Yana N tasini ko'rsatish", ko'p bo'lsa —
  "Hammasini ro'yxatda ko'rish". Topilmasa — e'lon qoldirish va "Boshqa viloyatda qidirish", pastda shunga yaqinlari.
- **E'lon niyati**: "vakansiya joylamoqchiman" / "o'zim haqimda e'lon bermoqchiman" — qidirmaydi, e'lon tayyorlashga
  tugma beradi (yordamchiga faqat mazmun — kasb, joy — o'tadi).
- **Sekin telefon**: skriptlar yuklanmasdan yuborilsa ham matn yo'qolmaydi (`/?q=…`), yuklangach o'zi yuboriladi.
- Suhbat shu tabda 30 daqiqa saqlanadi; boshqa hisob bilan kirilsa — ko'rinmaydi.
- Tanishtiruvdan "Rol" qadami olib tashlandi (almashtirgich yo'q). Eski reklama sahifasi testlari olib tashlandi,
  qolganlari chatga moslandi.

## 2026-11-21 · Menyu 3 ta bo'lim, E'lonlarim yorliqlari, sodda Profil (`feat/simple-3-tabs`)

Ega (master prompt, ekranma-ekran tanlovlar): "asosiy navigatsiya faqat 3 ta bo'lim; E'lonlarimda faol, yopilgan,
muddati tugagan; profil juda sodda". Keyin: "bir-biriga ariza topshirish bo'lmaydi — bog'lanish faqat telefon orqali".

- **Pastki menyu**: ikkala rejimda bir xil — Qidiruv · E'lonlarim · Profil (avval 5 ta, rejimga qarab). "Qidiruv" —
  AI yordamchi bilan chat (/chat), ko'k pilyula; odamlar o'rtasidagi yozishma bilan adashmasligi uchun shunday nomlandi.
  Ishlar/ishchilar ro'yxatlari, e'lon sahifalari va e'lon berish — "Qidiruv" bo'limida; "Sizga mos" — "E'lonlarim"da.
  Arizalar va takliflar son belgilari menyudan olib tashlandi. Kompyuterning yon menyusi: Qidiruv · E'lonlarim ·
  Xabarlar · Profil.
- **E'lonlarim**: tepada 3 ta yorliq — Faol · Yopilgan · Tugagan (`?holat=`), har birida soni; 320 px da son nom
  ostiga tushadi. Pastda ish izlovchiga "Sizga mos".
- **Profil**: ism, rol, telefon (tasdiqlangan belgisi bilan), ismni o'zgartirish, til, ish beruvchida to'lovlar va
  chiqish. Qolgan hamma narsa (rolni almashtirish, saqlanganlar, xabarlar, xabarnomalar, PRO kuzatuv, sozlamalar,
  yordam) — bitta yig'ma "Boshqa sozlamalar" ichida. "Yuborgan arizalarim" va "Ishga takliflar" qatorlari olib tashlandi.
- Tanishtiruvda "Yordamchi" qadami endi "Qidiruv" bo'limini yoritadi.

## 2026-11-21 · Foydalanuvchi sifatida tekshiruv: topilgan xatolar tuzatildi (`fix/qa-findings`)

Ega: "odam sifatida ilovaga kir, odamlar nima qilmoqchi bo'lsa — hammasini qilib ko'r, xato top". Mahalliy stendda
6 xil foydalanuvchi (mehmon, ish izlovchi, ish beruvchi; uz/ru/en) × 74 sahifa (444 ochilish) va 8 ta to'liq yo'l
(chat, e'lon berish, arizalar, rol almashtirish, chiqish) o'tildi.

- **Pastki menyu**: ish izlovchida "Sizga mos" ochilganda "Ishlar" ham birga yonib turardi — endi faqat bittasi.
  Unit-test: har rejimda istalgan sahifada ko'pi bilan bitta faol bo'lim.
- **Chat: uzun gap tushunilmasdi**: "Toshkentda sotuvchi ish kerak, tajribam 2 yil, oylik kamida 4 million, Chilonzor
  yoki Yunusobod…" — "sotuvchi" so'zi umuman qidirilmas, "Qanday ish?"ga "chilonzor" yozilib, shu so'z bo'yicha
  qidirilardi. Endi uzun gapda avval bitta so'zlar tekshiriladi, to'ldiruvchi so'zlar (tajriba, maosh, hafta, tuman…)
  tashlanadi, viloyatning tuman nomlari kasb deb olinmaydi (ruscha gaplar ham).
- **Chat izohi**: kasb tushunilmasa ("asdkjhqwe") "Hududni tanlang" emas — "Qanday ish kerakligini aniq yozing";
  hammasi tushunilsa — "Javoblarni tekshiring va «Qidirish»ni bosing".
- **Ruscha tor ekran**: bildirishnomalardagi "Отметить все как прочитанные" va ustalar sarlavhasidagi
  "Разместить объявление" 390 px ekrandan chiqib ketardi; o'rtadagi "Найти/Подать" (va kirillchada "Излаш/Эълон")
  320 px da kesilardi — endi "Поиск" / "Излаш", ustalarda telefonda qisqa "Объявление".
- **Sahifa nomi (h1)**: e'lon joylashning 1-qadamida va taklif havolasi sahifasida yo'q edi (ekran o'qigichi uchun).
- E2E: `qa-user-pass.spec.ts` — yuqoridagilar qaytmasin.

## 2026-11-21 · Chat ChatGPT kabi sokin: 2 ta ixcham qator, oq kartalar (`feat/chat-clean`)

Ega: "ChatGPT va biznikini solishtir — katta kartalar balo battar, 2 ta qator bo'lsin, uzunasiga, kamtarin va chiroyli;
tagidagi yozuvlar keraksiz; e'lon berish bosilsa — alohida ekranga; qidiruv oynasi ranglari yemagan, bolalarcha;
yozayotganda ustiga hech narsa chiqmasin".

- **Asosiy chat**: salom va savol — oddiy matn (pufakcha yo'q); ikkita ixcham qator bitta guruhda — "Ish izlash" /
  "E'lon berish" (ish beruvchida "Ishchi izlash" / "Vakansiya berish"), izohsiz. Izlash bosilsa — yozish maydoni darhol
  fokusda (klaviatura ochiladi). E'lon berish — darhol alohida ekran (yordamchi). "Yoki pastga yozing…" va pastdagi
  izoh olib tashlandi. Ustalar — ish beruvchining Izlash qadamida kichik havola.
- **Yozish maydoni**: sokin chegarali, dumaloq tugma (matn bo'lmasa — xira). Telefonda yozilayotganda pastki menyu
  yashiriladi va maydon ekran tagiga tushadi — orada bo'shliq, ostidan matn ko'rinmaydi.
- **Natijalar**: "N ta topildi" — oddiy qalin matn; "Ko'rish" — sokin tugma; yorliqlar kulrang. Topilmadi — oq karta,
  "+ O'zingiz haqingizda e'lon qoldiring" ekrandan chiqmaydi (to'liq kenglik, qatorga o'raladi).
- **Kartalar** (chatdagi): oq, sokin; qizil "Hozir ishchi qidirmoqda" chat kartasida yo'q (e'lon sahifasida bor);
  "E'lonni to'liq ko'rish" — sokin tugma.

## 2026-11-20 · E'lon rasmi (AI): «Rasm yaratilsinmi?» (`feat/listing-image`)

Ega: "e'lon berayotganda oxirida so'rasin — e'lon rasmi yaratilsinmi? Ha bo'lsa, e'lonni avtomatik o'qib, mos real rasm
joylashsin; kanalda ham, ilovada ham ixcham ko'rinsin" (provayder — ChatGPT / OpenAI, ega tanlovi).

- **0087** (`supabase/prod/pending.sql` orqali): `listing_images` (bitta e'longa bitta rasm, holati), ochiq
  `listing-images` bucket, `claim_listing_image` — navbat va xarajat chegarasi: bir kishiga sutkada 5 ta, umumiy 100 ta
  (`app_settings`), bir e'longa 3 urinish; faqat server.
- **Qachon**: e'lon joylangach (yordamchi bilan ishchi e'loni, oddiy forma, vakansiya) — "E'lon rasmi yaratilsinmi?
  Ha / Yo'q". Ha → 20–60 s, keyin tayyor rasm ko'rsatiladi.
- **Rasm**: OpenAI `gpt-image-1.5` (medium, 1536×1024 ≈ $0.05). So'rov e'londan avtomatik — kasb, kasb turi va ish joyi;
  rasmda yozuv yo'q (AI harflarni xato chizadi). Yaratilgan rasm moderatsiyadan o'tadi.
- **Ko'rinishi**: kanal posti rasmi — fon AI surat, chapda soya, yozuvlar (kasb, kompaniya, joy, maosh) shablondan;
  kanalda allaqachon chiqqan post rasmi almashtiriladi. E'lon sahifasida — ixcham keng banner.
- **Yoqish**: Vercel'da `OPENAI_API_KEY` (bo'lmasa savol chiqmaydi, bazaga so'rov ham yo'q). Avval 0087 qo'llanadi.
- E2E stendida OpenAI — soxta (shlyuzda), pul ketadigan so'rov yo'q.

## 2026-11-20 · Rolga mos ilova: menyu, chat, kirish savol bilan (`feat/role-chat`)

Ega (kechqurun): "ishchi panelida Ishchilar nimaga kerak — o'rniga qiziqarli narsa; men ishchiman — «ish yoki ishchi»
nimaga kerak, menga ish qidirish va o'zim haqimda e'lon kerak; Izlash bosilsa pastga strelka — yozing va toping,
chiqmasa «+ e'lon qoldiring»; E'lon berish — «Qanday ish qidiryapsiz?» yozsin, keyin telefon; bitta odam ikkala rolda
bo'lsa adashmasin, ma'lumotlari alohida; kirishdagi rasmlar yoqmayapti — savol bilan kirsin; Telegram'da «Ochish»
bosilsa saytga olib borsin".

- **Kirish ekrani** rasmsiz: "Assalomu alaykum! Nima qidiryapsiz?" → «O'zingizga mos ish qidiryapsizmi?» /
  «Korxonangizga ishchi qidiryapsizmi?» — bitta bosishda (JS'siz ham). Rol ekrani (/auth, /start/rol) — xuddi shunday.
- **Pastki menyu rejimga qarab**: ish izlovchi — **Sizga mos** · Ishlar · Izlash/E'lon · E'lonlarim · Profil;
  ish beruvchi — Ishchilar · **Arizalar** · Izlash/E'lon · E'lonlarim · Profil (tanlov — ega). Bo'limlarda "Orqaga" yo'q.
  "Sizga mos" va "Arizalar" — kirmagan yoki e'lonsiz foydalanuvchiga ham ochiladi: nima bo'lishi va bitta tugma.
- **Chat rolga mos**: ish izlovchi — Ish izlash / E'lon berish (o'zim haqimda); ish beruvchi — Ishchi izlash /
  Vakansiya berish (+ "Usta kerakmi?"). Izlash → "Pastga yozing va toping" + qimirlaydigan strelka, yozish maydoni
  yoritiladi. Topilmasa — "+ O'zingiz haqingizda e'lon qoldiring" (yozgani bilan). E'lon berish → "Qanday ish
  qidiryapsiz? Pastga yozing" → yordamchi (/ai/post yoki /post/vacancy?ai=1) shu gap bilan darhol boshlanadi.
- **Rollar aralashmaydi**: E'lonlarim, Profil va "Sizga mos" — faqat joriy rol; boshqa roldagi e'lonlar — soni va bir
  bosishda o'tish qatori (e'lon "yo'qoldi" deb o'ylamasin). Ish beruvchi vakansiyalari sahifasida ham shunday.
- **Telegram orqali kirish**: botdagi "Ochish" endi Mini App emas — saytni ochadi va o'sha brauzerni ham kiritadi
  (bir martalik havola, 5 daqiqa, 0085 jadvali — yangi migratsiya yo'q). Havola yaratilmasa — avvalgidek Mini App.

## 2026-11-20 · Sodda ilova: 5 ta bo'lim va chat — asosiy ekran (`feat/simple-nav`)

Ega: "ilova chalkash — kirgan odam hech nimani tushunmaydi, ketma-ketliklar chalkash, yozuvlar tushunarsiz. Pastda faqat
Ishchilar, Ishlar, E'lonlarim, Izlash va e'lon berish, Profil — bo'ldi. Kirish oynasidan kirgandan keyin chatga kirsin,
chatda tanlansin: ish qidirish yoki e'lon berish".

- **Pastki menyu** — ikkala rejimda va mehmonda bir xil: Ishchilar · Ishlar · **Izlash/E'lon** (o'rtada, chat) ·
  E'lonlarim · Profil. Xabarlar va bildirishnomalar — yuqori panelda (hamma uchun); alohida "Yordamchi" belgisi olib
  tashlandi. Kompyuterdagi yon menyu va planshetdagi yuqori menyu — xuddi shu bo'limlar (+ Xabarlar).
- **`/chat` — asosiy ekran**: "Assalomu alaykum, Ism! Nima qilmoqchisiz?" → [Izlash] [E'lon berish].
  Izlash → Ish / Ishchi: so'rovnoma va bazadagi haqiqiy e'lonlar shu suhbatda; yoki "Usta" → Universal ustalar
  (pastki menyuda yo'q, shu yerdan). E'lon berish → "Men ish izlayapman" (`/ai/post`) yoki "Menga ishchi kerak"
  (`/post/vacancy?ai=1`) — ikkalasi yordamchi bilan; rejim o'zi qo'yiladi, "Siz kimsiz?" deb qayta so'ralmaydi.
  Pastda yozish maydoni (tanlovsiz ham yozish mumkin).
- **Yo'naltirish**: kirish oqimi tugagach (ikkala rol) — `/chat`; kirgan foydalanuvchi "/" ni ochsa — `/chat`.
  Mehmon uchun "/" — avvalgidek ochiq bosh sahifa.
- **"Ishchilar"** ish izlovchiga ham to'siqsiz ochiladi (qidiruvdagi rejim tushuntirish oynasi olib tashlandi).
- Kirgan foydalanuvchining avvalgi bosh sahifasi ("Bo'limlar", "Yangi ishlar", "Sizga mos ishlar") endi ochilmaydi;
  mos e'lonlar — Profil → "Mos ishlar". Tanishtiruv (tour) chatda ham ishlaydi; ekranda yo'q tugmalar qadami o'tkaziladi.
- Analitika: `nav_chat`, `chat_choice`; `home_view` — "/" va "/chat" da. Test: E2E `simple-app.spec.ts`, eski menyu
  va bosh sahifa testlari yangi tartibga moslandi.

## 2026-11-20 · Ishchi bir nechta e'lon joylay oladi — 100 tagacha (`claude/multi-worker-listings`, 0086)

Ega: "men ishchiman — menga faqat 1 ta e'lon joylay olyapman; 10 ta, 100 ta joylasin kerak bo'lsa". Tanlov (ega): har
biri alohida e'lon (o'z kasbi, hududi, maoshi, raqami), bir kishiga 100 tagacha.

- **Baza (0086)**: har e'lon — `worker_profiles` qatori; shaxsning asosiy qatori (`is_primary`) — avvalgidek arizalar,
  takliflar, rezyume. Qidiruv, e'lon sahifasi, kanal, moderatsiya, raqamlar, rasm qo'shimcha e'lonlar uchun o'zgarishsiz
  ishlaydi. `save_simple_worker_listing`: `new_listing` (yangi e'lon; shu kasb va hududda e'loni bo'lsa — o'sha yangilanadi,
  takror bo'lmasin; 100 tadan ortig'i — `too_many_listings`) va `worker_id` (o'z e'lonini tahrirlash). Taklif qaysi
  e'londan yuborilsa ham shaxsga yoziladi. Maosh/tuman yozish huquqi — egasining barcha e'lonlari.
- **"E'lonlarim"**: barcha ishchi e'lonlari ("O'zim haqimdagi e'lonlar (N)"), har birida o'z "O'zgartirish" va "Ishga
  joylashdim"; pastda **"Yana e'lon joylash"** → `/post/worker?new=1` (bo'sh forma, "Yana bitta e'lon").
  `/post/worker?listing=<id>` — o'sha e'lonni tahrirlash (begonaniki — "Sahifa topilmadi").
- **AI bilan joylash** (bosh sahifa → Yordamchi): har joylash — yangi e'lon (avval eskisining ustiga yozardi).
- "Mening ishchi profilim" so'rovlari (sessiya, onboarding, bot, admin) — asosiy qator.
- Testlar: SQL `multi_worker_listings.test.sql` (22 tekshiruv), E2E `multi-worker-listings.spec.ts`.

## 2026-11-20 · Telefon raqam kanalda ham — bosilsa qo'ng'iroq (`claude/phones-everywhere`)

Ega: "hammaga majburiy qil telefon nomer kiritsin — ishchi qidiruvchi ham, ish qidiruvchi ham; telefon nomerlar 100%
ko'rinsin hammaga; kanalga kelyapti, nomer yo'q; kanalda nomer ustiga bossa telefon qilishga o'tsin — raqamlarni qo'shib
yozish kerak, masalan 998932728766".

Holat (prod, faqat o'qildi): yangi e'londa raqam ikkala formada ham allaqachon majburiy va doim ko'rinadi. Faol
e'lonlardan 2 ta vakansiya va 2 ta ishchi e'lonida raqam ko'rinmaydi — eski "ko'rsatilmasin" tanlovi; ular egalarining
roziligisiz ochilmadi (quyidagi eslatma).

- **Kanal posti — raqam bo'shliqsiz** (`+998932728766`): Telegram uni bosiladigan qiladi, bosilsa qo'ng'iroq
  (`dialable`). Avval "+998 93 272 87 66" edi — bosilmasdi.
- **Ishchi e'loni ham raqam bilan** (avval kanalda raqam yo'q edi): e'londagi raqam(lar) (`worker_listing_phones`, ikkalasi).
  Faqat `WORKER_CHANNEL_PHONES_FROM` dan keyin saqlanganlari — shu paytdan forma "raqam Telegram kanalidagi postda ham
  chiqadi" deydi; avvalgilarga "kanalda ko'rsatilmaydi" deb va'da berilgan edi (qayta joylasa — raqamli chiqadi).
- **To'liq formadagi vakansiya** (e'londa raqam qatori yo'q): kompaniya / ish beruvchi aloqa raqami — onboarding'da
  majburiy, "E'lonlarda ko'rsatiladi"; saytda ham shu raqam ochiq (0084).
- Matnlar 4 tilda: ishchi formasi (kanal izohi, "raqam hammaga ko'rinadi"), AI e'lon oldindan ko'rinishi, suhbat savoli
  ("ko'rsatish yoki yashirishni keyin tanlaysiz" — endi tanlov yo'q), admin "Telegram kanal" tavsifi.
- **"E'lonlarim" eslatmasi**: raqami ko'rinmaydigan eski e'lon kartasida — "Telefon raqamingiz bu e'londa ko'rinmayapti…
  «O'zgartirish»ni bosing" (qayta saqlansa raqam majburiy va ochiq).
- Testlar: `autopost-format.test.ts` (+2: ishchi raqamlari, `dialable`), `autopost.test.ts` (+2: to'liq forma vakansiyasi —
  kompaniya / ish beruvchi raqami; ishchi raqami — faqat yangi matndan keyin saqlangani), E2E `employer-my-listings.spec.ts`
  (+1: eslatma chiqadi va raqam ochilgach yo'qoladi).

## 2026-11-20 · "E'lonlarim"da barcha e'lonlar; e'lon joylangan zahoti kanalga (`claude/my-listings-channel`)

Ega: "e'lon joylangan — E'lonlarimda ko'rinmayapti, e'lon egasi o'z e'lonlarini, barcha e'lonlarini ko'rolmayapti; e'lon
joylagandan keyin srazu kanalga xabar bormayapti".

Sabab (prod ma'lumoti, faqat o'qildi): e'lon ish izlovchi rejimida "O'zim haqimda e'lon" sifatida joylangan (har kishida
bitta — qayta joylash o'shani yangilaydi), egasi esa ish beruvchi rejimida — u yerdagi "E'lonlarim" faqat vakansiyalarni
ko'rsatardi. Kanal: bu e'lon 17-noyabrda kanalga chiqqan edi, kanal esa har e'lonni faqat BIR marta yuborardi — qayta
joylangani hech qachon qayta chiqmasdi.

- **Ish beruvchi "E'lonlarim"** (`/employer/vacancies`): vakansiyalar ro'yxati ostida **"Boshqa e'lonlaringiz"** — o'zi
  haqidagi (ishchi) e'lon va usta e'lonlari, holati va "O'zgartirish" bilan (bo'lmasa bo'lim yo'q). `getMyListings(session,
  { vacancies: false })` — vakansiyalar ikki marta so'ralmaydi.
- **Kanalga darhol** (`postListingNow`): joylash amali muvaffaqiyatli bo'lib e'lon ommaga chiqqan zahoti (after) — shu
  e'lon kanalga, fon navbatini kutmasdan. **Qayta joylangan** (yangilangan) e'lon ham yana chiqadi — oxirgi postidan
  **24 soat** o'tgan bo'lsa (kanal ketma-ket qayta joylashdan to'lib ketmasin); urinishlari tugab xato bilan qolgani —
  darhol. O'sha `channel_posts` yozuvi shartli qayta band qilinadi (migratsiyasiz; ikki server nusxasi bir vaqtda olmaydi).
  Tekshiruvdagi / ish beruvchi tasdig'ini kutayotgan e'lon yuborilmaydi; kanal sozlamasi (o'chirilgan tur, alohida kanal)
  hisobga olinadi.
- **Ish beruvchi tasdiqlanganda** (admin → verifikatsiya "tasdiqlash") kutib turgan vakansiyalari kanalga va egasiga
  darhol (after → `runChannelAutopost`).
- Testlar: `autopost.test.ts` (+5) — yangi e'lon darhol va bir marta; 3 kun oldin chiqqan qayta joylansa — yana, 2 soat
  oldin chiqqani — yo'q, o'sha kuni yana — yo'q; xato bilan tugagani — qayta; ommaviy bo'lmagan / o'chirilgan tur — yo'q;
  alohida kanal. E2E `employer-my-listings.spec.ts` — ish beruvchi "E'lonlarim"ida o'zi haqidagi e'lon (holati,
  "O'zgartirish"), vakansiya ikki marta chiqmaydi; ishchi e'loni bo'lmasa bo'lim yo'q.

## 2026-11-20 · Telegram orqali kirish: "brauzerga qayting" o'rniga "Ochish" (`claude/tg-login-open`)

Ega: "Telegram orqali kirishda «saytga qayting, ochiladi» deyapti — demasin, pastda «Ochish» tursin, bossa ilova ochilsin".

- Botda "✅ Kirish" bosilgach **o'sha xabar o'zgartiriladi** (eski "Kirish / Bekor qilish" tugmalari qolmaydi): "✅ Kirish
  tasdiqlandi! Pastdagi «Ochish»ni bosing — Ish topdim shu yerning o'zida ochiladi." va pastda **"Ochish"** — Mini App
  (bosh sahifa), Telegram ichida initData bilan o'zi kiradi. Xabarni o'zgartirib bo'lmasa — yangi xabar, o'sha tugma bilan.
  Kirishni boshlagan brauzer ham avvalgidek o'zi kiradi.
- Matn 4 tilda (`notifications.telegram.web_login_ok`).
- Test: `webhook/web-login.test.ts` (3) — tasdiq → xabar o'zgaradi + Mini App tugmasi, "qayting" yo'q; o'zgartirib
  bo'lmasa — yangi xabar; muddati o'tgan — tugmasiz izoh.

## 2026-11-19 · Tanishtiruvga o'zbekcha ovoz (`claude/tour-voice`)

Ega ElevenLabs'da ("Farruh — Confident") 20 qatorni bitta faylda yozdirib yubordi. Pauzalar bo'yicha bo'lindi: qatorlar orasidagi
pauza 0,33–0,40 s, gaplar orasidagi 0,2–0,3 s; kesish joylari matn uzunligiga moslab tanlandi (dinamik moslash), E1/E2 chegarasi
W1 bilan taqqoslab tuzatildi. Tekshiruv: bir xil boshlanadigan qatorlar ovoz konverti o'xshashligi — W1/E1 0,97, W7/E7 0,90,
W6/E6 0,77 (bog'liq bo'lmagan juftlik — 0,14). Fayllar: `public/tour/uz/<kod>.mp3` (mono, 64 kbit/s, jami 788 KB), boshi va
oxiridagi jimlik qirqilgan. `TOUR_AUDIO.uz` — 20 kod; kirill o'zbekcha ham shu ovozni ishlatadi. Ruscha va inglizcha — hali
matn bilan. Testlar: unit (har qadam uchun fayl mavjud), E2E (ovozni o'chirish tugmasi, "Boshlash"dan keyin ovoz yuklanadi,
ruscha — ovozsiz).

## 2026-11-19 · Birinchi kirgandagi tugmalar tanishtiruvi (`claude/app-tour`)

Ega: "1-chi kirganlarga tugmalar vazifasini tushuntirsin — o'sha tilda; matnlarini tashla, ovozlarini men yozaman".

- `AppTour` (providers): bosh sahifada, xush kelibsiz ekranidan keyin, **har panel uchun bir marta** (`ib_tour` = w/e).
  Fon xiralashadi, navbatdagi tugma halqa bilan yoritiladi, yonida — nomi va vazifasi, "3 / 11". Tugma pastki yarmida
  bo'lsa karta ustida, aks holda ostida; boshida va oxirida — o'rtada. "Kerak emas" / "O'tkazib yuborish" / Escape ham
  eslab qolinadi; `?tour=1` — qayta ko'rsatadi.
- Qadamlar (`features/tour/steps.ts`): ish izlovchi — salom, rol, Bosh sahifa, Ishlar, Ish beruvchilar, Sohalar / Xabarlar,
  Profil, Yordamchi, Til, Kirish / qo'ng'iroqcha, yakun; ish beruvchi — Boshqaruv, E'lonlarim, E'lon (+), Ishchilar, Profil, ….
  Maqsad — `[data-tour]` belgili ko'rinadigan element; ekranda yo'q tugma (mehmonda "Xabarlar") o'tkazib yuboriladi.
  Telefonda pastki menyu, kompyuterda yuqori menyu.
- Matnlar 4 tilda (`easy.tour.*`). **Ovoz**: ega yozib beradi — `public/tour/<uz|ru|en>/<kod>.mp3` + `TOUR_AUDIO` ro'yxati;
  o'zbekcha ovoz lotin va kirill uchun bitta. Ovoz bo'lsa kartada ovozni o'chirish tugmasi chiqadi (tanlov eslab qolinadi).
- Telegram kanali taklifi tanishtiruv ochiq paytda chiqmaydi — tugagach chiqadi.
- E2E `tour.spec` (4): mehmon ish izlovchi / ish beruvchi / kirgan ish beruvchi qadamlari ketma-ketligi, yoritish tugma ustida,
  karta ekranda, bir martalik, Escape, `?tour=1`, ruscha. Boshqa testlarda `ib_tour` "ko'rilgan" (storageState, asGuest).
## 2026-11-19 · Ishga tushirishdan oldin ekranlar tekshiruvi (`claude/launch-readiness`)

Ega: "hozir hamma narsa tayyormi — yozuvlar ustiga chiqib ketmaganmi, shriftlar katta bo'lib ko'p joy egallamayaptimi?"
23 ta asosiy ekran (mehmon / ish izlovchi / ish beruvchi) × 4 til, 360 px: gorizontal siljish, ekrandan chiqqan va kesilgan
matn — yo'q. Topilgan va tuzatilgan:

- **Rus tilida "Откликнуться" tugmasi karta chetidan chiqib ketardi** (qizil holat va tugma joy talashardi): holatga faqat
  qolgan joy (`flex-1`), tugma doim to'liq.
- **"Ishlar" ro'yxati kartalarida qizil "Hozir ishchi qidirmoqda" yo'q edi** (bosh sahifada bor) — `VacancyCard`ga qo'shildi.
- **Sahifa sarlavhalari telefonda 30 px** (Profil, Ish beruvchilar, Sohalar, Saqlanganlar, …), "Xabarlar" esa 26 px —
  hammasi `text-page` (26 px) / kompyuterda 30 px. Vakansiya nomi telefonda 24 → 20 px (uzun nom 4 qatorni egallamasin).
- **Soha plitkalarida uzun so'z harf o'rtasidan bo'linardi** ("программирова / ние"): `softHyphenate()` — bo'g'in bo'yicha
  yashirin belgilar ("прог-рам-ми-…"), tugma nomi asl matn (`aria-label`); unit test.

## 2026-11-19 · Yordamchi: topilganlar yashirin — "Ko'rish" (ko'z) bilan ochiladi (`claude/assistant-results-toggle`)

Ega (skrinshot bilan): "2 ta ish topildi yoniga «Ko'rish» ko'z bilan — ichiga yashirib qo'y, bossa e'lonlar ko'rinsin".

- Yordamchi javobida yashil "N ta ish topildi" yonida ko'k **"Ko'rish"** (ko'z belgisi) tugmasi. Kartalar va "Hammasini
  ko'rish" yashirin turadi; bosilsa ochiladi, tugma "Yashirish" (ko'z ustidan chiziq) bo'ladi.
- Ochilgan holat sahifa ichida eslab qolinadi: e'lonni ochib, orqaga qaytilganda ro'yxat ochiq turadi (yangilansa — yopiq).
- Topilmaganda va "shunga yaqin" bo'limida o'zgarish yo'q.
- E2E: `quickSearch()` endi "Ko'rish"ni bosadi (`show: false` — bosmaydi), yangi `showFound()`; `assistant-chat` — avval
  kartalar yo'q, "Ko'rish" → bor, "Yashirish" → yana yo'q.

## 2026-11-19 · Yordamchi kartasi: alohida rangda, "E'lonni to'liq ko'rish" — telefongacha (`claude/assistant-job-card`)

Ega (skrinshot bilan): "1 ta ish topildi — tartib bilan, rangli, alohida rangda, ichida telefonigacha ko'rinsin; sodda va
chiroyli; nomi tagida yashil «E'lonni to'liq ko'rish» — bosilsa hamma ma'lumot tartib bilan".

- Yordamchi javobida o'z kartalari (`ai-cards.tsx`): och rangli fon, lavozim · qizil "Hozir ishchi qidirmoqda" · maosh ·
  ish beruvchi · hudud (to'liq, kesilmaydi) → yashil **"E'lonni to'liq ko'rish"**. Bosilganda shu kartaning ichida qatorma-qator
  (rangli belgilar bilan): manzil (+ xarita), ish grafigi, tajriba, bandlik turi · shakli, (ma'lumot, yosh/jins), joylangan sana,
  "Ish haqida" (to'liq matn), qulayliklar, **telefon** (katta "Qo'ng'iroq qilish" + raqam, ikkalasi `tel:`), "Ariza yuborish",
  "E'lon sahifasini ochish". Ishchi kartasi ham shunday (hudud, tajriba, maosh, o'zi haqida, telefon).
- Telefon faqat bosilganda ochiladi — limitlar o'sha-o'sha (mehmon — IP, kirgan — 0074). Server amallari `openVacancyCard`
  (sahifadagi ochiq maydonlar + raqam), `openWorkerCard` (raqam). `RevealPhone` — `initial` natija va kirgan foydalanuvchiga
  "Kirish" tugmasisiz (`loginHref = null`).
- "1 ta ish topildi" — yashil belgili yorliq.
- E2E (`assistant-chat`): yopiq kartada raqam yo'q; ochilganda tavsif, qatorlar, ikki `tel:` havola va ariza havolasi.

## 2026-11-19 · Ish taklifi: vakansiya tanlanmaydi — "Qanday vakansiya taklif qilmoqchisiz?" (`claude/offer-free-title`)

Ega (skrinshot bilan): "taklif yuborishda o'z joylagan e'loni bo'yicha yuboryapti — uni tanlamasin… «Qanday vakansiya taklif
qilmoqchisiz» deb chiqsin".

- Nomzod sahifasidagi "Ish taklifi yuborish" oynasida ish beruvchining vakansiyalari ro'yxati (radio) va "Yangi taklif" tanlovi
  olib tashlandi. O'rnida bitta majburiy maydon: "Qanday vakansiya taklif qilmoqchisiz?" (o'zi yozadi), maosh (dan/gacha) —
  ixtiyoriy, xabar — oldingidek. Taklif `vacancy_id = null`, `title` — yozilgani bilan yuboriladi (`send_offer` o'zgarmadi).
- Ishlatilmay qolgan matnlar (`choose_vacancy`, `new_offer*`, `already_offered`, `no_vacancies`, `post_vacancy`, `offer_title`)
  4 tilda olib tashlandi; yangi kalit `workers.offer.what_vacancy`.
- E2E (`applications.spec`): ro'yxat yo'q, bo'sh maydon — xato, yozilgan lavozim taklifga tushadi.

## 2026-11-19 · Raqam ustiga bosilsa — qo'ng'iroq; egasi oynasi soddalashtirildi (`claude/tap-to-call`)

Ega (skrinshot bilan): "ustiga bossa vizov ketsin, keyin sal oynani soddalashtir".

- **Egasi oynasi** (`/listing/[id]`, o'z e'loni): uch qator — holat (kichik belgi) → "E'londagi raqam" va har bir raqam alohida
  qatorda yashil telefon belgisi bilan (bosilsa `tel:` qo'ng'iroq) → pastda "E'lonni o'zgartirish ›" butun qator.
  Avval: belgi, katta tugma va ikki raqam bitta uzun qatorda " · " bilan.
- **Raqamning o'zi ham bosiladi:** katta "Qo'ng'iroq qilish" tugmasi ostidagi raqam matni ham `tel:` havola —
  ishchi e'loni (`CallBlock`), mehmonga ochilgan raqam (`RevealPhone`), vakansiyadagi ish beruvchi kartasi, kontakt kartasi.
- `telHref()` (`@/lib/format`) — bitta joyda; unit test. E2E: egasi raqami `tel:`, ochilgan raqamda tugma + raqam (2 havola).

## 2026-11-19 · Prod baza: 0084–0085 qo'llandi (`claude/prod-applied-85`)

Ega: "SQL'ga o'zing joyla" va Supabase ulanishini ISHUZ loyihasiga berdi. Avval faqat o'qish bilan tekshirildi: 0068–0083
bor (0082 — beshala qidiruv funksiyasida `uz_fold`, `uz_fold('Ўқитувчи') = 'oqituvchi'`), 0084–0085 yo'q. Keyin Supabase MCP
`apply_migration` bilan tartib bilan qo'llandi: `0084_public_listing_phones`, `0085_telegram_web_login` (repodagi fayllar
bilan bir xil). Keyin tekshirildi: beshala yangi funksiya — faqat `service_role` (anon/authenticated — yo'q), security
definer; `telegram_web_logins` — RLS yoqilgan, anon/authenticated o'qiy olmaydi; noma'lum e'lon — 0 qator, noma'lum token —
`invalid`. `APPLIED_UNTIL = 85` — pending.sql endi bo'sh (faqat holat jadvali).

## 2026-11-18 · Qizil "Hozir … qidirmoqda", telefon hammaga, Telegram orqali kodsiz kirish (`claude/phones-status-tglogin`)

Ega: "vakansiya tagiga «hozir ish qidirmoqda»ni jirniy qizil… telefon raqam hammaga ko'rinsin, e'lon joylayotganda
kiritish majburiy, qo'lda… Telegram orqali kirishda kod terib yurmasin, shunday kirib ketsin". Tanlovlar: qizil yozuv —
ikkalasida; raqam — "Raqamni ko'rsatish" tugmasi bilan (OLX kabi).

- **Qizil qalin holat** (`LiveStatus`): vakansiya kartasi va sahifasida "Hozir ishchi qidirmoqda" (faqat faol e'lon),
  ishchi kartasi, e'lon va nomzod sahifasida "Hozir ish qidirmoqda" (faqat holati `active`; "takliflarga ochiq" — yo'q).
  Qidiruv natijalariga ishchi holati server kaliti bilan qo'shiladi (faqat ochiq e'lonlar, faqat holat).
- **Telefon hammaga (0084):** mehmonga "Raqamni ko'rsatish" — bosilganda IP bo'yicha limit (soatiga 20, sutkasiga 60,
  fail-closed) bilan `listing_phones_public` (faqat server kaliti): vakansiyada rozilik berilgan raqam, ishchida e'londagi
  raqam(lar) yoki "hamma" ko'rinishidagi hisob raqami. Sahifada raqam oldindan yo'q; ro'yxatlar raqamsiz (0074 kabi).
  Kirgan foydalanuvchi — avvalgidek (shaxsiy limit).
- **E'londa raqam majburiy va qo'lda:** vakansiyada hisob/kompaniya raqami oldindan qo'yilmaydi; ishchi formasida kirgan
  foydalanuvchi ham raqamni o'zi yozadi (`listingPhone` majburiy, eski oyna — "raqam kerak"). "Raqamim ko'rinsin" belgisi
  o'rnida ochiq ogohlantirish: "Raqamingiz e'londa hammaga ko'rinadi" (vakansiyada — Telegram kanalda ham; ishchida —
  kanalda yo'q, va'dadagidek). Eski e'lonlar rozilik qoidasida qoladi (egasi qayta saqlasa — yangi qoida).
- **Telegram orqali kodsiz kirish (0085):** sahifa bir martalik so'rov yaratadi → `t.me/<bot>?start=w_<token>` → bot
  qaysi brauzer so'rayotganini ko'rsatib "✅ Kirish"ni so'raydi → brauzer (httpOnly cookie'dagi kalit bilan) har 2 s va
  sahifaga qaytganda holatni so'raydi va sessiya oladi. Token/kalit faqat xesh, 5 daqiqa, bir marta tasdiqlanadi va bir
  marta ishlatiladi; havola boshqaga o'tib qolsa ham sessiyani faqat so'rovni boshlagan brauzer oladi. Bot yoki 0085
  sozlanmagan bo'lsa — eski havola. Telefon + kod usuli qoladi.
- Testlar: SQL (`listing_phones_public`, `telegram_web_login`), unit (yordamchilar), E2E `phones-status.spec` (qizil holat,
  mehmon raqami, kodsiz kirish — haqiqiy status yo'li va sessiya; E2E shlyuzida magic link qo'shildi).
- Prod: `pending.sql` — 0082, 0083, 0084, 0085.

## 2026-11-18 · Pastki menyu: "Ish beruvchilar", "E'lonlarim", "Ishchilar"; har kirishda kanal taklifi (`claude/nav-employers-channel`)

Ega (skrinshotlar bilan): "Nomzodlar bo'limida barcha ishchilar chiqsin… bu yerda e'lonlarim bo'lsin, vakansiyalar emas…
har kirganda Telegram kanalga ulanish tugmasi chiqsin… o'rtadagi arizalar o'rniga ish beruvchilar ro'yxati bo'lsin, qisqa va
tushunarli, alohida belgi bilan".

- **Ish izlovchi menyusi:** Bosh sahifa · Ishlar · **Ish beruvchilar** (bino belgisi, `/companies`) · Xabarlar · Profil.
  "Arizalar" — bosh sahifadagi **"Arizalarim"** qatorida (soni, yangi taklif bo'lsa — matnda) va Profilda; yangi takliflar
  belgisi — Profil tugmasida. `/companies` — "Ish beruvchilar": har biri bitta qisqa qator (logotip/bosh harf, nomi,
  tasdiqlangan ✓ va davlat belgisi, soha · hudud, "N ta ish").
- **Ish beruvchi menyusi:** Boshqaruv · **E'lonlarim** (avval "Vakansiyalar"; sahifa sarlavhasi ham) · E'lon · **Ishchilar**
  (avval "Nomzodlar") — darhol barcha ishchi e'lonlari (butun O'zbekiston; filtr va qidiruv natijalar sahifasida).
- Menyu nomlari biroz zichroq (`tracking-tight`, yon bo'shliqsiz): "Ish beruvchilar" 360 px ekranda ham to'liq sig'adi.
  Rus/kirill: "Компании" / "Ташкилотлар" (to'liq nom sig'maydi; sahifa sarlavhasi — to'liq).
- **Kanal taklifi:** ilovaga har kirishda (sessiyada bir marta, ~2.5 s dan keyin) "Telegram kanalimizga qo'shiling" oynasi —
  Telegram belgisi o'z rangida, "Kanalga o'tish" (Mini App'da Telegram'ning o'zida ochiladi) va "Keyinroq". O'tilsa — 30 kun
  so'ralmaydi; Telegram orqali kirgan va kanalda bor foydalanuvchiga chiqmaydi (bot `getChatMember`, soatiga 20 tagacha);
  tanishtiruv tugamagan bo'lsa va admin/kirish sahifalarida — chiqmaydi. E2E: `channel-prompt.spec`, `nav-roles.spec`.

## 2026-11-18 · Qidiruv kirill/lotin, rol almashganda katta yozuv, kanalda to'liq e'lon (`claude/search-roles-channel`)

Ega (skrinshotlar bilan): "bazadagi e'lonni qidirsam topmayapti… ish beruvchidan ish izlovchiga o'tsa ekranda mayin katta
yozuvda… kanalga rasm kelyapti — ishchimi u, ish beruvchimi bilib bo'lmadi… rasm tagiga to'liq yozilsin, nomerlar bilan".

- **Qidiruv (0082).** "Men oqituvchiman menga ish kerak" — "Ўқитувчи" e'loni (kasbi ro'yxatdan tanlanmagan, nomi kirillcha)
  chiqmasdi. Ikki sabab: (1) lug'at tutuq belgisisiz "oqituvchi" ni "O'qituvchi" guruhining o'z nomi deb bilmay, "Katta
  o'qituvchi" ni tanlardi — endi taqqoslash tutuq belgisiz (`find/queries.ts`); (2) bazadagi zaxira moslik faqat lotin/rus
  nomini `lower()` bilan solishtirardi — endi `uz_fold()` (kirill → lotin, tutuq belgilari olib tashlanadi) va
  `custom_profession` ham (5 ta qidiruv funksiyasi, idempotent yamoq, CRLF'ga chidamli). SQL test + E2E.
- **Rol almashganda** (bosh sahifa menyusi, foydalanuvchi menyusi, Sozlamalar) — butun ekranda ~3 s yumshoq katta yozuv:
  "Siz ish beruvchi paneliga o'tdingiz" / "Siz ish izlovchi paneliga o'tdingiz" (4 tilda), yonib chiqadi va sekin o'chadi;
  bosilsa — darhol yopiladi (`RoleSwitchSplash`). E2E: modes, all-links.
- **Kanal posti.** Rasm: vakansiya — ko'k, "VAKANSIYA · ISHCHI KERAK"; ishchi — yashil, "ISHCHI · ISH QIDIRYAPTI" (oq yorliq,
  belgisi bilan). Rasm ostida — to'liq matn: vakansiyada turi, nomi, kompaniya, joy, maosh, ish vaqti, tajriba, tavsif
  (telefon/havola tozalangan) va **telefon — faqat rozilik bo'lsa**. Rozilik matni: "Aloqa raqamim e'londa va Telegram
  kanalda ko'rinsin"; vaqti `vacancy_contacts.channel_phone_at` (0083) — eski roziliklar (kanal tilga olinmagan) raqamsiz.
  Ishchi e'lonida ism va telefon yo'q (ularga shunday va'da berilgan). 1024 belgidan oshsa — tavsif qisqartiriladi.
- **Ish beruvchi paneli — binafsha** (ega 3 variantdan A ni tanladi). `<html data-panel="employer">` (rejim cookie'si
  bo'yicha, ildiz layout) — faqat ko'k tokenlar almashadi (tugma, urg'u, och fonlar, hero, yon menyu); holat ranglari va AI
  rangi o'zgarmaydi; kunduzgi va tungi rejim. Ish izlovchi — ko'k. E2E: modes (binafsha), all-links (qaytganda ko'k).
- Prod: `supabase/prod/pending.sql` — 0082 va 0083 (ega bir marta ishga tushiradi). `/api/health?deep=1` — 0082, 0083.

## 2026-11-18 · Telegram birinchi o'rinda: Mini App havolalari, kanalga obuna (`claude/telegram-first`)

Ega: "endi 1-o'rinda Telegram mini app va Telegram kanaldan foydalanamiz — obunachi va foydalanuvchi yig'ishimiz kerak".

- **Kanal postidagi tugma → Mini App.** `t.me/<bot>?startapp=…` (`src/lib/telegram/start-param.ts`: `/jobs/<slug>` →
  `j_<slug>`, e'lon/ishchi — `l_`/`w_` + uuid, boshqasi — `p_` + base64url; ≤ 64 belgi, faqat ichki yo'l). Ilova ochilganda
  `TelegramStartRoute` kerakli sahifaga o'tadi (bir ochilishda bir marta). Faqat BotFather'da asosiy Mini App yoqilib,
  Vercel'da `TELEGRAM_MAIN_APP=1` bo'lsa; aks holda — avvalgidek sayt havolasi. Rasm — saytdan.
- **Kirish sahifasi:** «Telegram orqali kirish» birinchi va asosiy (ko'k); telefon — ikkinchi.
- **Kanalga obuna:** bosh sahifa menyusida «Telegram kanalimizga obuna bo'ling — har kuni yangi ishlar» (rangsiz qator;
  Mini App ichida Telegram'ning o'zida ochiladi; `channel_cta` hodisasi). Bot menyusi: «📱 Ilovani ochish» birinchi qatorda,
  oxirida «📢 Kanalga obuna bo'lish».
- Testlar: start-param (vitest), kanal tugmasi Mini App rejimida, E2E `telegram-startapp.spec.ts`, bosh sahifadagi kanal qatori.
## 2026-11-17 · Prod baza: 0079–0081 qo'llandi (`claude/pending-applied-81`)

Ega pending.sql ni (CRLF tuzatishidan keyin) qo'lladi. `APPLIED_UNTIL = 81` — pending.sql endi bo'sh (faqat holat
jadvali). `/api/health?deep=1` tekshiruviga 0079 (`channel_posts`), 0080 (`public_tariffs`), 0081
(`worker_listing_phones`) qo'shildi; 0078 — faqat ma'lumot, tekshiradigan obyekt yo'q.

## 2026-11-17 · pending.sql — Windows SQL Editor'da 0081 xatosi tuzatildi (`claude/pending-crlf-fix`)

Ega pending.sql ni ishga tushirganda: "0081: save_simple_worker_listing naqsh #1 0 marta uchradi". Sabab: SQL Editor
(Windows) faylni CRLF qatorlar bilan yuboradi, 0081 yamog'idagi naqshlar esa `\r` dan tozalanmagan edi (0057 da bu bor
edi). Bitta tranzaksiya bo'lgani uchun bazada hech narsa o'zgarmagan. Tuzatildi: naqshlar ham LF ga keltiriladi (rollback
ham). `scripts/prod-pending-test.sh` endi pending.sql ni CRLF ko'rinishida ham ikki marta qo'llab tekshiradi.

## 2026-11-17 · E'londagi telefon — qo'lda, majburiy, "+ Yana raqam" (`claude/post-phone-manual`)

Ega: "telefon raqamini qo'lda kiritsin, kiritmasa e'lon berilmasin; 2 ta nomer bo'lsa — «yana nomer»; nomer majburiy,
profildagi nomer emas — boshqa nomer joylasin, xohlasa profildagini, lekin qo'lda yozilsin".

- **Oyna (/ai/post):** telefon maydoni hamma uchun bo'sh ("+998") — hisobdagi raqam oldindan qo'yilmaydi va "Tasdiqlangan"
  qutisi yo'q. Raqam yozilmasa — "Telefon raqamini to'liq yozing." va e'lon ko'rinishiga o'tmaydi. "+ Yana raqam" —
  ixtiyoriy ikkinchi raqam (chala yozilsa — xato, "×" bilan olib tashlanadi; birinchisi bilan bir xil bo'lsa — saqlanmaydi).
  E'lon ko'rinishida raqamning o'zi ko'rsatilmaydi — "Siz yozgan (ikkala) raqam e'londa ko'rinadi".
- **E'lon sahifasi:** kirgan foydalanuvchiga qo'lda yozilgan raqam (hisob raqami emas) va bo'lsa "Qo'shimcha raqam";
  egasiga — "E'londagi raqam: …". Mehmon va ro'yxatlar — avvalgidek telefonsiz (0074 limiti ham o'sha).
- **Hisob raqami** (kirish uchun) o'zgarmaydi va uning ko'rinish sozlamasiga tegilmaydi. Hisobida raqami yo'q (Telegram
  orqali kirgan) foydalanuvchi ham qo'lda yozilgan raqam bilan joylay oladi — vakansiyadagidek.
- To'liq forma (/post/worker, kabinetdan tahrirlash) avvalgidek: u bilan saqlansa e'lon yana hisob raqamiga qaytadi.
- **Baza — 0081** (`worker_listing_phones`, `save_simple_worker_listing` yamog'i, `simple_worker_listing` + `phone2`):
  `supabase/prod/pending.sql` ga qo'shildi. Qo'llanmaguncha oyna ishlaydi, lekin e'londa hisob raqami ko'rinadi.

## 2026-11-17 · E'lon rasmi — kanalga va e'lon egasiga (`claude/post-image-everywhere`)

Ega: "shunga o'xshab kelsin — e'lon joylandimi, shunaqa rasm bo'lib kelsin" (vakansiya kartasi rasmi) → "ikkalasi ham".

- **Kanal:** ishchi e'lonlari ("o'zim haqimda") ham vakansiyadek rasm bilan chiqadi — `/api/promo/worker/<id>`
  (1200×800): "ISHCHI · ish qidiryapti" yorlig'i, kasbi, tajribasi, joyi, kutilayotgan maosh. Ism, telefon, rasm va erkin
  matn yo'q; faqat ommaviy e'lon (aks holda 404). Rasm ketmasa — avvalgidek matn.
- **E'lon egasiga:** e'lon ommaga chiqqach (oxirgi 24 soat), bot orqali "✅ E'loningiz joylandi!" — o'sha rasm bilan va
  "E'lonlarimni ko'rish" tugmasi (ilovani Telegram ichida ochadi). Har e'lon — bir marta; bot ishga tushirilmagan yoki
  muallif bloklangan bo'lsa — yuborilmaydi. Kanal sozlamasidan qat'i nazar ishlaydi; kanalga avtomatik e'lon bilan bir
  navbatda (`channel_posts`, `chat_id = "dm:<telegram id>"` — admin sahifasida kanal yozuvlari bilan aralashmaydi).
- Ikkalasi ham 0079 (`channel_posts`) qo'llangan bo'lishini talab qiladi (`supabase/prod/pending.sql`).

## 2026-11-17 · Bo'limlarda Universal ustalar — ko'k (`claude/menu-masters-blue`)

Ega: "faqat ustalarni ko'k rang bilan ajratib qo'y". "Bo'limlar"da faqat Universal ustalar qatorining belgisi (och ko'k
quti, ko'k belgi) va nomi ko'k; qolganlari rangsiz.

## 2026-11-17 · "E'lonlarim" — ixcham kartalar (`claude/my-listings-compact`)

Ega: "e'lonlarimdagi juda katta, tushunarsiz — tartibga keltir, soddalashtir".

- Har bir e'lon — kichik karta: nomi va joyi (bosilsa e'lonning o'zi ochiladi, "›"), kichik holat belgisi va bir qatorda
  kichik tugmalar: "O'zgartirish" va "Ishga joylashdim" / "Ishchi topdim" (vakansiyada — "Arizalar: N"; kerak bo'lsa
  "To'lash"). Guruh nomlari oddiy kichik yozuv ("O'zim haqimda e'lon", "Vakansiyalarim", "Usta e'lonlarim").
- Olib tashlandi: katta "Batafsil" va "Mos ishlar / Mos ishchilar" tugmalari, xabarnoma obunasi bloki (Profil →
  "Telegram xabarnomalari" va bosh sahifadagi "Sizga mos ishlar" bor). Profildagi "Mening e'lonlarim" ham shunday.

## 2026-11-17 · "E'lonlarim" va "Yangi ishlar" — alohida sahifalar (`claude/home-rows`)

Ega: "yangi ishlarni bossa — yangi joylangan e'lonlar ichiga kirsin, o'sha oynada ochilmasin; tepasida e'lonlarim tursin —
bossa o'zi joylagan e'lonlar ichiga kirsin, holatlarini ko'rsin".

- Bosh sahifa (kirgan, telefonda): "E'lonlarim" qatori (son — o'zi haqidagi e'lon, vakansiyalar va usta e'lonlari), ostida
  "Yangi ishlar" qatori — endi yig'ilgan ro'yxat emas, havola: `/jobs?sort=newest` (hudud bilan; "Sizga mos ishlar" — kasb
  bo'yicha natijalar). Kompyuterda va mehmonda ro'yxat avvalgidek shu yerda. Qatorlar rangsiz ("Bo'limlar" bilan bir xil).
- Yangi sahifa **/cabinet/elonlar** — "E'lonlarim": o'zi haqidagi e'lon, vakansiyalar va usta e'lonlari, har birining
  haqiqiy holati va amallari (Profildagi "Mening e'lonlarim" bilan bir xil komponent — `MyListingsSection`); bo'lmasa —
  "E'lon joylash". Mehmon — kirishga.

## 2026-11-17 · Bosh menyu rangsiz (`claude/menu-neutral`)

Ega: "bosh menyudagi ranglar umuman yoqmayapti — rangni olib tashla".

- "Bo'limlar": belgilar bir xil kulrang qutida, nomlar bir xil (qora) rangda — Universal ustalar (yashil) va Yordamchi
  (to'q sariq) ham; "yangi" nuqtalari yo'q. Eng tagidagi "Ish beruvchiga o'tish" — qizil emas, boshqa qatorlar kabi.
  Kompyuterdagi chap yon menyu o'zgarmadi.

## 2026-11-17 · Bosh qism: sarlavha bitta qatorda, tashqi karta yo'q (`claude/hero-oneline`)

Ega: "«Qanday ish qidiryapsiz» yozuvini kichraytir — bitta qatorga sig'sin; oyna ustida oyna turibdi — olib tashla".

- Sarlavha o'lchami bosh qism kengligiga qarab (`cqw`): telefonda (320–412 px) "Qanday ish qidiryapsiz?" / "Qanday xodim
  kerak?" bitta qatorda (kirillchada ham); kompyuterda — eng ko'pi 3–3.5 rem.
- Tashqi oq karta (chegara, fon, soya) olib tashlandi — qidiruv maydoni va "+ E'lon joylash" sahifaning o'zida.

## 2026-11-17 · Bosh sahifa tartibi (`claude/home-tidy`)

Ega: "bosh sahifa umuman yoqmayapti — tartibsiz: pastda bor ishlar, arizalar, xabarlar, profil; profildagi sozlamalar bosh
sahifada ham bor — chalkash; e'lon berish juda katta; orqasidagi ikonka bo'rtib turibdi; hamma narsa tiqilmasin, kerakli
narsalar tursin, Universal ustalar tursin". Taklif chizib ko'rsatildi (Design kanvas), ega ma'qulladi.

- **"Bo'limlar" — faqat 6 ta qator** (boshqa joyda yo'q yo'llar): Universal ustalar, Yordamchi, Kunlik ish, Masofaviy ish,
  Tajriba talab qilinmaydigan ishlar, Yaqin atrofdagi ishlar (ish beruvchida: … Kunlik/Masofaviy/Tajribali/Yaqin atrofdagi
  ishchi). Olib tashlandi: Barcha vakansiyalar / Barcha nomzodlar (pastki menyu), arizalar, xabarlar, profil (pastki
  menyu), saqlanganlar, sozlamalar, yordam (Profil — "Yordam" Profil ro'yxatiga qo'shildi), "Ishlar xaritada" ("Yaqin
  atrofdagi ishlar" sahifasida xarita havolasi bor). Bo'limlar endi o'qilmagan sonlarni so'ramaydi.
- **Bosh qism:** "+ E'lon joylash" / "+ Vakansiya joylash" — ingichka (44 px), och ko'k; ko'k nur, 👋 va izoh qatori olib
  tashlandi.
- **Yuqori panel:** ish izlovchida telefonda xabar belgisi yo'q (pastki menyuda "Xabarlar" bor); ish beruvchida qoladi.

## 2026-11-17 · Soddalashtirish 2 (`claude/simplify-2`)

Ega: "kunlik ish, masofaviy, tajriba — hammasini bo'limlarga qo'sh; eng tepada Universal ustalar, keyin Barcha vakansiyalar…
hammasi bir qatorda; «O'zingizga mos ishni qidiring», «Topish» o'rniga «Izlash»; oila shifokori — noto'g'ri chiqdi; oylik
maosh kerak emas; ish beruvchi panelini ham sodda qil; birinchi kirishda kunduzgi rejim; mehmonlarda Xabarlar o'rniga
Sohalar; profil juda chalkash — Mening dunyom, O'zim haqimda e'lon, Yordamchi, Universal usta kerak emas".

- **Bosh sahifa — "Bo'limlar":** 4 ta tez yo'l plitkasi olib tashlandi, ular bo'limlarga ko'chdi. Tartib (ish izlovchi):
  Universal ustalar → Barcha vakansiyalar → Yordamchi → Kunlik ish → Masofaviy ish → Tajriba talab qilinmaydigan ishlar →
  Yaqin atrofdan → xarita, arizalar, saqlanganlar, xabarlar, profil, sozlamalar, yordam. Ish beruvchida: Universal ustalar →
  Barcha nomzodlar → Yordamchi → Kunlik/Masofaviy/Tajribali/Yaqin atrofdagi ishchi → … "E'lon joylash" bo'limlardan olib
  tashlandi (tepada katta tugma). Hammasi bitta ustunda, uzun nomlar qisqartirilmaydi. Mehmon ham ko'radi (shaxsiy
  bo'limlarsiz).
- **Qidiruv maydoni:** "O'zingizga mos ishni qidiring..." (ish beruvchida — "...xodimni..."), tugma — "Izlash".
- **Tushunish:** kasb nomi aytilgan so'zlarga qanchalik to'liq mos kelishi hisobga olinadi — "men oila shifokoriman" →
  "Oilaviy shifokor" (avval "Oila huquqi yuristi").
- **Qidiruv oynasi:** "Oylik maosh qancha bo'lsin?" savoli olib tashlandi (faqat "Qanday ish?" va "Qaysi hududda?").
- **Ish beruvchi paneli:** tez yo'llar, "AI bilan oson joylash" kartasi va ikkinchi tugma o'rnida — bitta katta
  "+ Vakansiya joylash" (yordamchi bilan); qolgani "Bo'limlar"da.
- **Mavzu:** birinchi kirishda — kunduzgi (telefon tungi rejimda bo'lsa ham). Tungi yoki "Tizim" — faqat sozlamalarda tanlansa.
- **Mehmonning pastki menyusi:** "Xabarlar" o'rnida "Sohalar" (kirganlarda o'zgarmagan). **/sohalar** — har bir soha
  qator bo'lib, eng ko'p ish o'rni bor soha tepada, ostida "N ta ish o'rni" (haqiqiy faol vakansiyalar; xato bo'lsa son
  ko'rsatilmaydi).
- **Profil:** "Mening dunyom", "O'zim haqimda e'lon berish", Yordamchi va Universal ustalar kartalari olib tashlandi;
  "Faoliyat"/"Hisob" yig'ilgan guruhlari o'rnida — bitta oddiy ro'yxat, oxirida "Hisobdan chiqish". Eski `/dunyo`
  havolasi — Profilga. Bazadagi tanlangan qiziqishlar (`profile_interests`) o'chirilmadi.

## 2026-11-17 · Qidiruv tezroq (`claude/search-speed`)

Ega: "hammasi tezlik bilan bo'lsin, qulay, sodda bo'lsin".

- **Oldindan qidiruv:** yordamchi oynasi ("Qanday ish?", "Qaysi hududda?") ochilishi bilan standart javoblar bo'yicha natija
  so'raladi (hech narsa saqlanmaydi, statistikaga yozilmaydi; alohida limit). "Qidirish" o'zgarishsiz bosilsa va e'lon
  topilgan bo'lsa — natija darhol (sinovda, bazagacha 60 ms kechikish bilan: 420 ms → 70 ms). Topilmasa — haqiqiy qidiruv
  ("so'rovingiz saqlandi" va o'xshashlar faqat unda).
- **Kamroq ketma-ket so'rov:** kasb oldindan tushunilgan bo'lsa qidiruv kasb ma'lumoti bilan bir vaqtda; "shunga yaqin
  ishlar" variantlari va qidiruvni saqlash — parallel; "Aynan qanday o'qituvchisiz?" variantlari — bitta so'rov bilan
  (avval ~9 ta); e'lon oynasidagi ism va telefon — tushunish bilan bir vaqtda.
- **AI tushunish:** qidiruv so'rovini tushunishda tezkor model (`claude-haiku-5-5`, `ANTHROPIC_FAST_MODEL` bilan
  almashtiriladi) va 4 soniya chegara (avval 8) — oshsa, lug'at qoidalari bilan davom etadi.

## 2026-11-17 · Usta e'loni — oynama-oyna, darhol joylanadi (`claude/masters-wizard`)

Ega: "Ustalar e'lon joylashda: kategoriyani tanladi — ikkinchi oyna, xizmatini tanlasin; keyin ism-familiya; keyingi
oynada hudud va telefon; narx ham, ish vaqti ham kerak emas; ish namunalari rasmi; «E'lon joylash»; moderatsiya kerak
emas — to'g'ridan-to'g'ri joylansin va kategoriyasiga olib borsin".

- **/ustalar/elon** — 5 oyna: 1) "Qanday ustasiz?" (katta plitkalar) → 2) "Qaysi ishlarni qilasiz?" (kategoriya
  xizmatlari ro'yxati + "Boshqa xizmat") → 3) ism, familiya → 4) hudud, tuman, telefon → 5) ish namunalari (ixtiyoriy) →
  "E'lon joylash". `?k=<kategoriya>` bilan — xizmatdan boshlanadi. Tahrirlash (`/ustalar/elon/[id]`) — avvalgi to'liq forma.
- **Darhol joylash** (`publishMasterQuick`): sarlavha va tavsif faqat tanlanganlardan ("Santexnik: Kran va smesitel,
  Oqishni tuzatish. Hudud: …"), narx — "Kelishiladi", telefon e'londa ochiq. Avtomatik tekshiruv: matn — qoidalar
  (taqiqlangan — saqlanmaydi, og'irida bloklanadi); rasm — AI. Toza bo'lsa e'lon shu zahoti faol va kategoriya sahifasiga
  o'tadi ("E'loningiz joylandi!"); shubha bo'lsa (yoki rasmni tekshirib bo'lmasa) — admin navbatida.
- Joylangan e'lonlar yangi qoidalar bilan baribir qayta tekshirib boriladi (avvalgidek).

## 2026-11-17 · "+ E'lon joylash" — yordamchi bilan e'lon (`claude/ai-post`)

Ega: "E'lon joylash bosilsa AI yordamchiga kirsin; «men o'qituvchiman», «uqituvchi», «oqtvchi» deb yozsa ham to'g'ri
tushunsin; kerak bo'lsa «aynan qanday o'qituvchisiz?» deb variantlar bersin; oylik maosh kerak emas, telefon raqamini
yozsin; «Tasdiqlash» → «Sizning e'loningiz shunday ko'rinadi» → «Joylash» → avtomatik tekshiruv → «Tabriklaymiz»; boshqa
mavzuda oyna chiqmasin".

- **/ai/post** (alohida to'liq ekran): bosh sahifadagi katta tugma, "Bo'limlar"dagi "E'lon joylash" va pastki/yuqori
  "E'lon" (ish izlovchi) shu yerga olib kiradi. Ish beruvchi rejimida — vakansiya joylash (avvalgidek).
- **Tushunish:** guruh ("O'qituvchi") — barcha aniq kasblar sarlavhalar bilan (Aniq fanlar, Chet tillari…); kasb nomi
  gapda haqiqatan bo'lishi shart ("bugun havo zo'r" → "Havo liniyasi elektromontyori" emas). "Salom", "rahmat", "kimsan",
  ish bilan bog'liq bo'lmagan savol — oyna emas, qisqa javob; "ish kerak" — oyna ochiladi, kasb unda yoziladi.
- **Oyna:** kasb, ism (familiya ixtiyoriy), hudud va tuman, tajriba (bitta bosish), telefon (kirgan — hisobdagi raqam;
  mehmon — yozadi, "Joylash"da SMS bilan kiradi va javoblari bilan shu yerga qaytadi). Maosh va ish vaqti so'ralmaydi.
- **Ko'rinishi:** joylanadigan matnning o'zi; "O'zim haqimda" — faqat aytilganlardan ("… sifatida ish qidiryapman.
  Tajribam — 1–3 yil. Hudud: …"), avvalgi e'londa o'z so'zlari bo'lsa (kasb o'sha) — o'shalar saqlanadi.
- **Joylash:** mavjud `publishWorkerListing` (majburiy avtomatik tekshiruv, haqiqiy holat): joylandi — "Tabriklaymiz",
  ilovada mos ish xabari va "Menga mos ish chiqsa xabar bering" (Telegram); tekshiruvda / rad etildi / to'lov — o'z ekrani.
- **Ish qidirishda ham:** "salom", "kimsan", "ob-havo qanday?" — oyna chiqmaydi, qisqa javob.

## 2026-11-17 · Soddalashtirish 1: kirish, bosh ekran, bo'limlar tartibi, "o'qituvchi" (`claude/simplify-1`)

Ega (2026-11-17, uzun ro'yxat — bosqichma-bosqich). 1-bosqich:

- **Kirish:** til → "Boshlash" → rol; "Qaysi kasblar sizga mos" va "Qayerda ishlashni xohlaysiz" olib tashlandi (eski
  havolalar bosh sahifaga).
- **Bosh ekran:** qidiruv ostida katta "+ E'lon joylash"; 4 ta tez yo'l hero ostida katta plitkalar; "Yaqin atrofdan ish
  qidirish", "Tajriba talab qilinmaydigan ishlar".
- **Bo'limlar ro'yxati (telefon, kirgan):** E'lon joylash → Yordamchi (sun'iy intellekt) → Universal ustalar → Barcha
  vakansiyalar → Kunlik ish → qolganlari.
- **Ustalar:** qidiruv — "Ustani qidirish".
- **Tushunish:** "мен ўқитувчиман" endi "Loyiha menejeri" emas (kirill olmoshlari, "-ман" qo'shimchasi); "o'qituvchi" —
  "O'qituvchi" guruhi (avval sinonimi o'xshash "Avtoinstruktor"); "uqituvchi", "oqtvchi" ham (bir harf xato, unlisiz yozuv).
- Gradientli tugmalar matni qorong'i mavzuda ham oq.

## 2026-11-16 · Yordamchi: uzun AI matni o'rniga so'rovnoma oynasi (`claude/quick-ai`)

Ega: "AI uzun matn yozmasin. So'rov qilgandan keyin oyna chiqsin — qaysi hududdan, oylik maoshi qancha bo'lsin — oxirida
«Qidirish». Ish yo'q bo'lsa — so'rovingiz qoldirildi, xabar beramiz, bo'ldi. Yaqin kasblar bo'lsa — pastda. Sodda bo'lsin".
Tanlov (AskUserQuestion): erkin suhbat ham olib tashlansin; matn — "So'rovingiz saqlandi".

- **Oqim:** yozilgan matn → kasb, hudud, maosh (va "kunlik", "tajribasiz" kabi shartlar) tushuniladi (lug'at, kerak bo'lsa
  AI — faqat tushunish uchun) → oyna (telefonda pastdan): "Qanday ish?", "Qaysi hududda?", "Oylik maosh qancha bo'lsin?"
  (oldindan to'ldirilgan) → "Qidirish" → qisqa xulosa ("Buxgalter · Toshkent shahri · 4 mln so'mdan yuqori") va kartalar.
- **Topilmasa:** bitta qisqa xabar. Kirgan ish izlovchi — qidiruv saqlanadi (bepul `saved_searches`, kuniga bir marta
  tekshiriladi, mos e'lon bo'lsa bildirishnoma) va "So'rovingiz saqlandi. Mos ish chiqsa, sizga xabar beramiz."; mehmon —
  "Kirsangiz — xabar beramiz" + "Kirish". Pastda — "Shunga yaqin ishlar" (ota yo'nalish yoki shu kasb boshqa joyda).
- Olib tashlandi: AI javob matni, jarayon izi, "+ Kunlik" aniqlashtirish, tavsiya savollar, bozor statistikasi kartasi,
  namuna e'lonlar (yordamchida), karyera/suhbat/vakansiya matni tezkor tugmalari va "Karyerangizni rivojlantiring" kartasi.
  `/api/assistant` serverda qoldi (UI ishlatmaydi).
- Lug'at: "men", "menga" kabi olmoshlar kasb deb olinmaydi; "-man/-miz" qo'shimchasi ("instruktorman" → "instruktor").
- Suhbat xotirasi kaliti yangilandi (v3) — eski uzun matnli suhbatlar ko'rinmaydi.

## 2026-11-16 · Logotip: egasining haqiqiy belgisi qaytdi (`claude/real-logo`)

Ega: "o'zimizning real logotip bo'lsin". 5.0 dagi gradient kvadrat + portfel belgisi olib tashlandi — hamma joyda
(sarlavha, yon menyu, kirish oynasi, admin, hikoyalar) yana `src/assets/brand/ishtopdim-mark.png` (oq plitada ko'k odam va
strelka). Favicon va ilova belgilari o'zgarmagan (ular doim shu belgi edi).

## 2026-11-16 · 5.0 "ko'k-oq" dizayn: Manrope, gradient, yangi bosh sahifa (`claude/blue-white`)

Ega: dizayn topshirig'i (oklch tokenlar, Manrope, shisha sarlavha, hero panel, 3+6 kartochka) — "Saytning o'ziga qo'llash".

- **Tokenlar va shrift:** barcha ranglar `oklch` da, asosiy ko'k `oklch(0.52 0.2 260)`; shrift Inter → Manrope Variable
  (400–800); radius 0.875rem; yangi `--gradient-brand`, `--gradient-hero`, `--shadow-card`, `--shadow-glow`, `--warm`.
  Kontrast testi oklch qiymatlarini o'qiydi — barcha AA juftlari o'tadi.
- **Sarlavha:** 64 px (telefonda 56) shaffof (blur) sticky; logo — gradient kvadratda oq portfel; pill menyu; "E'lon
  berish" gradient tugma; til va "Kirish" yumshoq. Kirgan foydalanuvchida kompyuterdagi yon menyu saqlandi.
- **Bosh sahifa:** rol almashtirgich pill; hero panel (joy, salom 👋, "Qanday **ish** qidiryapsiz?", qidiruv + gradient
  "Topish", 4 chip, filtrlar va xarita). Qidiruv endi sarlavhada emas, heroda (telefon va kompyuterda bir xil).
  "Yangi ishlar" va "Namuna e'lonlar" 3/2/1 ustun (kirganda telefonda "Yangi ishlar" avvalgidek yig'ilgan).
- **Kartalar:** yangi ish kartasi (maosh pill, hover ko'tarilish va nur; telefonda ixcham — 3 ta karta birinchi ekranda),
  namuna kartasi punktir chegarali.
- Footer: til tanlagich to'q fonda ko'rinadigan bo'ldi. Telegram Mini App panellari oklch tokenlardan ham to'g'ri rang
  oladi (hex ga aylantiriladi).
- Eski "sarlavhada doimiy qidiruv (Uzum uslubi)" yangi topshiriq bilan almashtirildi.

## 2026-11-16 · Tez o'tish: bosilgan zahoti yangi ekran (`claude/fast-nav`)

Ega: "tugma bosilgach keyingi oynaga o'tishi sekin — tepada ko'k chiziq keyingi ekranga o'tishni kutib turadi, umuman
yoqmayapti".

- Boshqa sahifaga havola bosilganda eski sahifa ustida kutilmaydi: kontent o'rnida darhol yangi sahifa skeleti (yuqori
  panel va pastki menyu joyida), pastki/yon menyuda bosilgan bo'lim darhol belgilanadi; javob kelishi bilan sahifa
  almashadi. Oldindan yuklangan sahifa (prefetch + `loading.tsx`) avvalgidek o'sha zahoti ochiladi — qatlam ko'rinmaydi.
- Tepadagi ko'k chiziq boshqa sahifaga o'tishda yo'q; faqat o'sha sahifada (filtr, sahifa raqami) va 0.2 s dan kechiksa.
- Qatlam bosishni to'smaydi, API/fayl havolalari va havola ichidagi tugmalarda chiqmaydi, 10 s da o'zi yo'qoladi.
- Ochilgan sahifaga qaytish keshi 30 s → 60 s (`staleTimes.dynamic`).
- Sinov: `e2e/specs/nav-instant.spec.ts` — sekin server (1.5 s, oldindan yuklashsiz) taqlidida 0.4 s ichida skelet va faol bo'lim.

## 2026-11-16 · 07–10: pastki menyu, qidiruv matni, 3 qadamli ariza (`claude/seeker-screens`)

Ega ("MASTER PROMPT", 5-bosqich).

- **Pastki menyu (ish qidiruvchi va mehmon):** Bosh sahifa · Ishlar (`/jobs`) · Arizalar · Xabarlar · Profil. "Saqlanganlar"
  va "O'zim haqimda e'lon" — Profilda (Kabinetim) va bosh sahifa "Bo'limlar" menyusida; kompyuterda yon menyudagi "E'lon"
  tugmasi joyida. Ish beruvchi menyusi o'zgarmadi. Kompyuterda "Xabarlar" — yuqori panel belgisida (takrorlanmaydi).
- **07 Qidiruv:** ish qidiruvchida sarlavhadagi qidiruv — "Lavozim yoki kompaniyani qidiring..." (qidiruv kompaniya nomini
  ham ko'radi); ish beruvchida — "Ish va ishchilar izlash".
- **10 Ariza — 3 qadam:** 1) rezyume (profildagi rezyume + PDF ko'rish/tahrirlash yoki tezkor ariza + "Avval to'liq rezyume
  yaratish"), 2) qo'shimcha (xabar va tez qo'shiladigan qatorlar), 3) tasdiqlash (vakansiya, rezyume, xabar). Natija:
  "Arizangiz muvaffaqiyatli yuborildi!". Takror arizaga qarshi himoya — avvalgidek (baza). PDF fayl yuklash bazada yo'q —
  tugmasi ham qo'yilmadi.
- 08 katalog (filtrlar, sahifalar) va 09 vakansiya sahifasi (kompaniya, logo, tasdiq belgisi, saqlash, ulashish, shikoyat,
  ariza) avvaldan bor — 4.0 ranglari bilan.

## 2026-11-16 · 04–06 ekranlar: rol, kasblar, hudud va tajriba (`claude/seeker-setup`)

Ega ("MASTER PROMPT", 4-bosqich). Kirish hamon talab qilinmaydi; tanlov shu qurilmada saqlanadi.

- **04 Rol:** "Siz qaysi maqsadda keldingiz?" — "Men ish qidiryapman" / "Men xodim qidiryapman" (4 tilda). Rolni keyin
  Profilda almashtirish o'zgarmadi.
- **05 Kasblar** (`/start/kasblar`): "Qaysi kasblar sizga mos keladi?" — umumiy kasb tanlagich (soha → kasb, qidiruv),
  bir nechta (5 tagacha), tanlanganlar tepada (olib tashlanadi), "1/2-qadam", "O'tkazib yuborish". Kasblar bazadan
  tekshiriladi (faol va tanlanadigan) va `ib_prefs` cookie'sida saqlanadi.
- **06 Hudud va tajriba** (`/start/hudud`): viloyat, tuman yoki shahar (mavjud `ib_place` cookie'si — bosh sahifa va qidiruv
  uni allaqachon ishlatadi), "Masofaviy ish ham mos keladi", tajriba (ixtiyoriy), "2/2-qadam".
- Mehmon ish qidiruvchi rolni tanlasa — 05 → 06 → bosh sahifa; ish beruvchi — darhol bosh sahifa; `next` bo'lsa — o'sha joyga.
- **Bosh sahifa "Sizga mos ishlar":** profilda kasb bo'lmasa — 05 da tanlangan kasblar bo'yicha (avval tanlangan hududda,
  "Tajriba yo'q" bo'lsa avval tajriba talab qilmaydiganlari), so'rovlar parallel. Faqat haqiqiy faol e'lonlar.
- Audit tuzatishi: bir nechta kasb uchun bazada jadval allaqachon bor (`worker_professions`, asosiy + 5 ta qo'shimcha) —
  yangi migratsiya kerak emas.

## 2026-11-16 · 01–03 ekranlar: splash, xush kelibsiz, kirish (`claude/entry-screens`)

Ega ("MASTER PROMPT", 3-bosqich).

- **01 Splash:** shior "Yaxshi ish — yorqin kelajak!" (4 tilda). Logo, yuklanish chizig'i va qisqa avtomatik o'tish o'zgarmadi.
- **02 Xush kelibsiz** (`/start/til`): haqiqiy surat (admin "home_photo" joyiga yuklaydi; bo'lmasa — egasi bergan surat),
  sarlavha "Kelajagingiz uchun to'g'ri imkoniyat shu yerdan boshlanadi.", izoh, ikkita katta tugma: **Boshlash** → rol
  tanlash (`/start/rol?from=welcome`), **Hisobim mavjud** → kirish (`/auth`). Til — tepada ixcham qator; "Qanday ishlaydi?" —
  tepada o'ngda. Rol kartalari xush kelibsiz ekranidan rol ekraniga o'tdi (kirish hamon talab qilinmaydi: mehmon rolni
  tanlab, darhol bosh sahifaga o'tadi). Bayroqlar olib tashlandi (`flags.tsx`).
- **03 Kirish:** o'zgarmadi — +998 raqam, kod Telegram bot orqali (SMS xizmati ulanmagan, soxta SMS yo'q), qayta yuborish
  taymeri, xatolar, foydalanish shartlari va maxfiylik. Google orqali kirish ulanmagan — ko'rsatilmaydi.

## 2026-11-16 · Dizayn tizimi 4.0 — ranglar (`claude/design-tokens`)

Ega ("MASTER PROMPT", 2-bosqich): Primary `#1558D6`, Secondary `#EAF1FF`, Background `#F5F7FA`, Surface `#FFFFFF`,
Text `#101828`, Secondary text `#667085`, Success `#16A36A`, Error `#DC3545`, kartalar 12–16px, yengil soya.

- `globals.css` yorug' mavzu tokenlari shu palitraga o'tdi; tuzilish va komponentlar o'zgarmadi.
- AA uchun matn variantlari: ikkilamchi matn `#626C81`, muvaffaqiyat `#107A4F`, xato `#C62F3E` (asl ranglar `#EAF1FF`
  yoki fon ustida 4.5:1 dan past). `#16A36A` — faqat belgi.
- `--radius` 12px, soyalar neytral va yengilroq. `brand-contrast.test.ts` 4.0 qiymatlarini mahkamlaydi.

## 2026-11-16 · Kanal posti — oddiy rasm va "Ariza qoldirish" (`claude/plain-post`)

Ega: "rasmi kerak emas, oddiy o'zi chiqsin: yozuv, vakansiya nomi, «Ariza qoldirish» chiqsin, sayt nomi kerak emas …
rasmli qil, prosta: rasmda faqat ish nomi, maoshi, lokatsiyasi, kompaniya nomi bo'lsin, tushunarli bo'lib".

- Kanalga avtomatik vakansiya e'loni: oddiy rasm (`/api/promo/vacancy/<slug>?f=post`, 1200×800) — faqat ish nomi,
  kompaniya, joylashuv va maosh; odam chizmasi, logotip, sayt nomi yo'q. Izohda faqat vakansiya nomi, tugma —
  "Ariza qoldirish" (oldin "Batafsil va ariza →"). Rasm ketmasa — to'liq matn, havola ko'rinishi o'chiq.
- Rasm har doim o'zbekcha (til cookie'siga bog'liq emas) va loyihadagi Manrope shrifti bilan (tarmoqsiz) chiziladi.
- Ishchi e'lonlari o'zgarmadi (matn). Ulashish uchun e'lon rasmlari (kvadrat, story) va kasb chizmalari joyida qoldi.

## 2026-11-16 · E'lon rasmi: kasbga mos kiyingan odam; kanalga rasm bilan (`claude/job-art`)

Ega: "e'lon joylanib, guruhga xabar borganda rasm bilan borsin; har bitta kasbga rasm tayyorla — odamning rasmi bo'lsin,
kasbga mos kiyintir".

- **Kasb chizmalari (`src/lib/job-art`):** 34 xil kiyim — oq xalat va stetoskop (shifokor), hamshira formasi, oshpaz
  qalpog'i va kurtkasi, ofitsiant nimchasi, sotuvchi fartugi, kassir formasi, haydovchi kepkasi, kuryer ryukzagi,
  quruvchi kaskasi va yorqin jileti, payvandchi niqobi, elektrik va muhandis kaskasi, santexnik kombinezoni, qo'riqchi
  furajkasi, o'qituvchi ko'zoynagi, dasturchi naushnigi, operator garniturasi, tikuvchi santimetri, dehqon shlyapasi
  va boshqalar. ~1900 kasbning har biri nomidan (o'zbek, rus, ingliz) yoki sohasidan kiyim turiga bog'lanadi; jinsi,
  teri va soch rangi, soch turmagi (ro'mol ham) kasb ID'sidan — har kasb doim bir xil ko'rinadi. Tashqi xizmatsiz,
  bepul, darhol. Uslub ataylab chizma: haqiqiy ish beruvchi yoki ishchining surati emas.
- **E'lon rasmi** (`/api/promo/vacancy/…`: kvadrat, story, havola oldindan ko'rinishi): o'ng tomonda (story'da — o'rtada)
  kasbga mos kiyingan odam, yonida soha belgisi. Telegram/Instagram'da havola ulashilganda ham shu rasm chiqadi.
- **Kanalga avtomatik e'lon:** vakansiya endi rasm bilan ketadi (kvadrat rasm + izoh + "Ochish" tugmasi); Telegram
  rasmni ololmasa — o'sha xabar matn bilan. Ishchi e'lonlari rasmsiz qoladi (chizma ishchining o'zi deb o'ylanmasin).
- Aniqlandi: AI bilan kasb rasmlarini yaratish (Gemini) prod'da ishlamayapti — Google kaliti 429 (limit yo'q) qaytaradi.
  Yangi chizmalar bunga bog'liq emas.
- Testlar: `job-art` unit (kasb → kiyim, adashtiradigan so'zlar, SVG to'g'riligi), `channel` (rasm, matnga qaytish,
  kanal xatosi), `autopost` va `autopost-format` yangilandi; `promo-image` e2e (PNG o'lchamlari, og:image, qoralama 404).

## 2026-11-16 · "AI bilan oson joylash" (ish beruvchi) va ovozsiz yordamchi (`claude/ai-vacancy`)

Ega: "ovoz yozish va ovoz chiqarib o'qishni olib tashla, kerak emas; ish beruvchi panelida «AI bilan vakansiyani oson
joylang» ajralib tursin; kirganda sodda bo'lsin — «menga shunaqa kerak» desa, ekranda savol chiqsin, tanlab-tanlab sen
bergan variantni o'tkazsin; yozuvlar kam va tushunarli bo'lsin".

- **Ovoz olib tashlandi:** yordamchida (bosh sahifa oynasi, /ai ekrani, AI to'ldirish maydoni) mikrofon, "Ovoz bilan
  javob" kaliti, "O'qib berish" tugmasi va ularning matnlari yo'q; salomlashuvdagi "mikrofonni bosib ayting" ham olindi.
  Chatdagi ovozli xabarlar (odamlar o'rtasida) qoldi. Maxfiylik siyosatidagi mikrofon jumlasi shunga moslandi
  (mikrofon — faqat chatda ovozli xabar uchun), cookie siyosatidan `ib_ai_speak` olindi (4 tilda, sana 2026-11-15).
- **"AI bilan oson joylash" (`/post/vacancy?ai=1`):** ish beruvchi bosh sahifasida "Vakansiya joylash" ustida alohida
  to'q sariq karta; oddiy formaning 1-qadamida ham shu kirish. Ish beruvchi bitta gap yozadi ("Chilonzordagi kafemizga
  oshpaz kerak, oyligi 5 mln") yoki tayyor misolni bosadi. Gapdan tushunilgani ("Tushundim: Oshpaz · Chilonzor · 5 mln")
  qayta so'ralmaydi; qolgani ekranda BITTADAN, katta variant tugmalari bilan: kasb (aniq bo'lmasa — variantlar, "Boshqa
  kasb"), viloyat → tuman, maosh (tayyor summalar, "Kelishiladi", "Boshqa summa", oylik/kunlik), ish vaqti, tajriba, kim
  ish beradi, nomi, telefon (profildan ma'lumlari so'ralmaydi), e'lon matni ("Ha, ma'qul" / "O'zgartirish"). Oxirida
  bitta ekranda hammasi — har qatorda "O'zgartirish" va "E'lonni joylash". "Orqaga" — oldingi savol; "Oddiy forma" —
  javoblar saqlanib oddiy qadamlarga o'tadi. Prod'da AI qo'shimcha to'ldiradi va e'lon matnini yozadi (faqat aytilgan
  faktlardan — maosh, tajriba, grafik o'ylab topilmaydi); AI bo'lmasa — lug'at va savollar bilan ishlaydi.
- **Imlo xatosi e'lon yozishda ham:** "santexnk", "oshpz" — eng yaqin kasb (ish izlovchi suhbatida ham).
- Eski "AI bilan tez tayyorlash" (bitta katta matn maydoni) olib tashlandi — o'rnini yangi oqim egalladi.
- Testlar: `vacancy-guide` (bosh sahifadan kirish → gap → savollar → joylash → bazada tekshirish; variantlar, orqaga,
  kunlik, oxirgi ekrandan o'zgartirish, oddiy formaga o'tish; xato bilan yozilgan kasb), `guide-logic` unit testlari;
  ai-finder, assistant-chat, assistant-stats, settings-legal — ovoz yo'qligi tekshiriladi.

## 2026-11-15 · Qidiruv tepada, ortiqcha matnlar qisqardi, 100+100 sinov (`claude/top-search`)

Ega: "Uzumnikiga o'xshatib qidiruvni tepaga chiqar (telefon), «masalan oshpaz» o'rniga «ish va ishchilar izlash» lupa
oldida tursin, bosganda kvadratcha chiqmasin; ortiqcha so'z-matnlar juda ko'p — maksimal qulay va tushunarli bo'lsin;
o'zing 100 ta vakansiya va 100 ta ishchi joylab, oddiy so'zlar bilan qidirib ko'r, kirishdan rol o'zgartirishgacha,
tugmalargacha hammasini test qil".

- **Qidiruv sarlavhada (telefon):** bosh sahifada (ish izlovchi ham, ish beruvchi ham) qidiruv maydoni yuqori panelning
  o'zida, lupa va "Ish va ishchilar izlash" yozuvi bilan; sahifa ichidagi takror maydon telefonda yashirildi (kompyuterda
  joyida). Yordamchi yoqilgan bo'lsa — yozilgani yordamchiga ketadi, o'chiq bo'lsa — oddiy qidiruv sahifasiga. Rejim
  tanlanmagan mehmon sahifasi o'zgarmadi (u yerda hudud/kompaniya qidiruvi bor).
- **Kvadratcha yo'q:** maydonni bosganda ichki kiritish joyi atrofida to'rtburchak halqa chiqmaydi — butun maydon
  yumshoq ramka bilan ajraladi.
- **Imlo xatosi bilan ham topadi:** kasb lug'atda aniq topilmasa, bitta-ikkita harf farqi bilan eng yaqin kasb olinadi
  ("oshpz" → Oshpaz, "kasir" → Kassir, "elektirk" → Elektrik). Faqat butun so'zlar, 5 harfdan qisqasi tuzatilmaydi;
  kasb bo'lmagan oddiy so'zlar ("kunlik", "restoran", "korzinkaga") kasbga aylanmaydi. Kasbning o'z nomi boshqa
  kasbning sinonimidan ustun ("enaga" → Enaga, "Tarbiyachi yordamchisi" emas).
- **Qisqa matnlar:** "Chat" → "Xabarlar"; yon menyu izohlari ("Barcha ishlar", "Yaqin atrofdagi ishlar"…), rol
  almashtirish, sozlamalar, ish beruvchi ro'yxatdan o'tishi, til va rol tanlash ekranlari qisqardi; sahifa
  sarlavhasi ostidagi ikkinchi darajali izohlar telefonda yashirildi; bildirishnomalarda bo'sh ro'yxatda ortiqcha
  qator yo'q.
- **100+100 sinov (faqat lokal stendda — jonli saytga soxta e'lon qo'yilmaydi):** `search-scale` 100 vakansiya va 100
  ishchi joylaydi, sarlavhadagi qidiruvdan oddiy so'zlar bilan qidiradi ("oshpaz", "Chilonzorda oshpaz", "kunlik ish",
  "haydovchi kerak", "Samarqandda sotuvchi", "oshpz", "повар нужен", "enaga kerak", "tajribali haydovchi"…) va topilgan
  son bazadagiga tengligini, har kartochka so'ralgan kasb/joy bo'yichaligini tekshiradi. `all-links` — mehmon, ish
  izlovchi, rol almashtirish, ish beruvchi: barcha ichki havolalar ochiladi.

## 2026-11-15 · E'lon berish soddalashtirildi: avval kasb, yordamchi — ixcham qator (`claude/simple-post`)

Ega: "shu yerni ham soddalashtir — juda katta va tushunarsiz bo'lgan, ketma-ketligini to'g'irla, e'lon berishni osonlashtir"
(ish izlovchi e'loni, 1-qadam: katta "Tez va qulay e'lon — yordamchi bilan" kartasi kasb savolidan oldin turardi).

- **1-qadam tartibi:** avval asosiy savol — "Qaysi kasb bo'yicha ish qidiryapsiz?" va qidiruv; uning ostida bitta ixcham qator
  "Yordamchi bilan to'ldirish — bir gap bilan yozing, qolganini o'zi so'raydi". Bosilsa — suhbat ochiladi (yozish maydoni
  darhol faol), "‹ Kasbni ro'yxatdan tanlash" bilan qaytiladi; "Qaytadan boshlash" ham ro'yxatga qaytaradi. Kasb yozilsa yoki
  tanlansa — qator yo'qoladi (ortiqcha narsa yo'q).
- **Eskirgan matnlar:** rol tanlash ekranidagi "Kabinetim → «Rolni o'zgartirish»" → "«Profil» sahifasining tepasidagi
  tugma"; yordam bo'limidagi "Kabinetim" havolalari → "Arizalar" / "Profil" (uz, oz, ru, en).
- Testlar: post-ai-chat (tartib, ochish/qaytish, fokus), moderation-ban.

## 2026-11-15 · "Yordamchi": alohida to'liq ekran, sodda tezkor imkoniyatlar (`claude/assistant-screen`)

Ega: "Barchasi siz uchun o'rniga Yordamchi; alohida panelga kirganda tagida menyular ko'rinmasin — alohida katta ekranga
kirsin; tezkor imkoniyatlar boshida ish qidirish, karyera maslahati, suhbat tursin; «Masalan, bosing» kerakmas; sodda qil".

- **Nomi:** "Barchasi siz uchun" → **"Yordamchi"** (oz "Ёрдамчи", ru "Помощник", en "Helper") — menyular, sarlavha, bosh
  sahifa bo'limlari.
- **/ai — alohida to'liq ekran:** yuqori panel, chap yon menyu va pastki menyu yo'q (`Shell bare`). O'z sarlavhasi:
  "‹" (oldingi sahifaga, to'g'ridan-to'g'ri ochilsa — bosh sahifaga), "Yordamchi" va holati, "Ovoz bilan javob",
  "Suhbatlar" (telefonda pastdan chiqadi), suhbat ketayotganda "+" (yangi suhbat), menyu. Yozish maydoni ekran tagida.
- **Tezkor imkoniyatlar:** boshida "Ish qidirish", "Karyera maslahati", "Suhbatga tayyorgarlik" (keyin CV, maosh, PRO
  kuzatuv); ish beruvchida — "Nomzod topish", "Vakansiya matni", "Suhbat savollari". Telefonda — ikki ustunli oq plitkalar
  (rangli belgilar), hammasi ko'rinadi, yonga surilmaydi.
- **Olib tashlandi:** "Masalan, bosing:" misollari; "Suhbatlar" panelidagi sayt bo'limlari ro'yxati (ilovaga "‹" bilan).
- Testlar: ai-entry, ai-workspace, sections, simple-mobile, ai-finder, home-market, layout-overlap yangilandi.

## 2026-11-15 · Yangi ranglar: ega yuborgan namuna rasmdagidek (tuzilish o'zgarmagan) (`claude/design-colors`)

Ega: "tuzilishini o'zgartirma, faqat dizaynni shunga mosla — ranglarni" (namuna: navy banner, yorqin ko'k tugmalar, oq
kartalar, rangli belgi plitkalari, maosh — och ko'k pilyulada).

- **Palitra 3.0** (`globals.css`, `docs/DESIGN_SYSTEM.md` §2): yorqin ko'k `#0B57F0`, navy matn `#0E1A3D`, och ko'kish fon
  `#F5F7FD`, ko'kish kulrang `#4B5884`, yumshoq ko'kish soyalar. Barcha juftliklar AA (brand-contrast.test.ts — yangi
  juftliklar: navy banner matni, plitka belgilari). Qorong'i mavzu ham moslandi.
- **Bosh sahifa (mehmon):** birinchi ekran — to'q navy banner (oq sarlavha, ko'k urg'u, oq "Men ish qidiryapman" tugmasi).
- **Rangli plitkalar** (ko'k · binafsha · yashil · to'q sariq): telefon bosh sahifasidagi tezkor yo'llar (endi oq kartalar),
  "Bo'limlar" menyusi, yig'iladigan bo'limlar, sohalar to'ri (/search, /kasblar), Profildagi bo'limlar.
- **Kartalar:** oq, deyarli ko'rinmas chegara va yumshoq soya (barcha `rounded-2xl` kartalar); e'lon kartalarida maosh —
  och ko'k pilyulada. Telefonda yuqori qism sahifa fonida — oq kartalar ajralib turadi.
- **Pastki menyu:** faol bo'lim ostida ko'k chiziq. **Sarlavha:** joylashuv — och ko'k pilyula.
- Namunadagi soxta raqamlar ("2 500+ vakansiya"), begona logotiplar va stok surat olinmadi.
- PWA manifest va xato sahifasi ranglari yangilandi.
- Ruscha + 150% shriftda: pastki menyu nomlari va tezkor yo'l plitkalari ekranga sig'adi (yonga surilmaydi).
- Testlar: brand-contrast (3.0 palitrasi va yangi juftliklar), telegram-fullscreen (yangi fon rangi).

## 2026-11-15 · Soddalashtirish: telefonda bo'limlar menyusi, "AI" o'rniga oddiy so'zlar, yig'iladigan bo'limlar (`claude/simplify-mobile`)

Ega: "telefonda kirganda kategoriyalar chiqsin — chap menyudagidek, oldida kichik harf bilan nima ekani; eng tagida qizilda
rolni o'zgartirish; AI o'rniga tushunarli so'z; yozuvlar juda ko'p — bugungi va yangi ishlarni ichiga yashir («ochish»,
«ko'rish»); profil katta va chalkash — ichiga yashir, rolni o'zgartirish eng tepada; ustalarda «+» emas «E'lon joylash»".

- **Telefon/planshet, bosh sahifa (kirgan):** "Bo'limlar" ro'yxati — kompyuterdagi chap menyu bilan bitta manba
  (`components/shared/nav-items.ts`); har bo'lim ostida kichik izoh ("Barcha ishlarni ko'rish va qidirish", "Yaqin atrofdagi
  ishlarni xaritada ko'rish"…), o'qilmaganlar soni. Eng tagida qizil "Ish beruvchiga o'tish" / "Ish izlovchiga o'tish" — bir
  bosishda (rejim yoziladi, bosh sahifa o'sha rolda ochiladi). "Yangi ishlar" / "Yangi nomzodlar" — yig'ilgan ("Ko'rish"),
  kompyuterda ochiq. Izoh matnlari, takroriy havolalar, "Universal ustalar" katta bloki va ish beruvchi panelidagi uzun
  ro'yxatlar telefonda yo'q (ular menyuda va raqamlarda). Pastki qism (footer) kirganlarga telefonda ixcham.
- **"AI" → oddiy so'zlar** (uz/oz, ru/en ham): bo'lim nomi "Barchasi siz uchun" (ru "Всё для вас", en "All for you"); qolgan
  joylarda "Yordamchi" / "Помощник" / "Helper", "Oddiy so'z bilan qidirish", "PRO kuzatuv" / "PRO-слежение" / "PRO watch".
  Yordamchi o'zini "Ish topdim yordamchisi" deb tanishtiradi ("kimsan?" savoliga sun'iy intellekt ekanini aytishi saqlangan).
  Admin matnlari o'zgarmagan.
- **"Barchasi siz uchun" sahifasi:** "Bugungi ishlar" va "Yangi ishlar" — yopiq qatorlar ("Ochish", "Ko'rish").
- **Profil** (sarlavha "Kabinetim" → "Profil"): tepada rolni almashtirish, keyin profil kartasi; "Mening e'lonlarim",
  "Mening dunyom", "PRO kuzatuv", "Faoliyat", "Hisob" — yig'iladigan bo'limlar. `/cabinet#dunyo` havolasi (dunyo yaratilgach)
  "Mening dunyom"ni o'zi ochadi (`Fold anchor`).
- **Universal ustalar:** telefonda ham "+ E'lon joylash" yozuvi (320 px da ham sig'adi).
- Yangi umumiy komponent: `Fold` (WAI-ARIA accordion: tugma sarlavha ichida, `aria-expanded`).
- Ixcham footer: "Foydalanish shartlari" / "Maxfiylik" havolalari ruscha va katta shriftda ham qatorga sig'adi (yonga surilmaydi).
- Testlar: E2E `simple-mobile.spec.ts` (7), yangilangan: ai-entry, ai-workspace, ai-finder, sections, applications,
  assistant-chat, auth, cabinet, entry-flow, home, home-market, journeys, layout-overlap, matches, modes, payments,
  post-ai-chat, saved, structure, tariffs, telegram-login, world; unit — engine.test.

## 2026-11-14 · Audit: telefonda "‹ Orqaga" va logotip ustma-ust tushmaydi (`claude/audit-back-logo`)

- Reklamadan oldingi tekshiruv (ega: "barcha muammolarni hal qil … odamlarga judayam qulay qil"): 390–430 px telefonlarda
  ichki sahifalarda logotip nomi bilan markazdan toshib "Orqaga" ustiga chiqib, "Orqa…" bo'lib qolardi. Endi telefonda
  (640 px dan tor) "Orqaga" bor bo'lsa — faqat logotip belgisi; planshet va kompyuterda nom ham ko'rinadi.
- Tekshirildi: 360/375/390/412/430/768/1024 px — ustma-ust yo'q; asosiy sahifalarda (bosh, tariflar, ishlar, kabinet,
  ish beruvchi) gorizontal toshish va konsol xatosi yo'q.
- "Tariflar" sahifasi narxlarni yuklay olmasa (prod'da 0080 hali qo'yilmagan) — bo'sh qolmaydi: "har doim bepul" qatori va
  "Vakansiya joylash" / "E'lon berish" tugmalari ko'rinadi. Onlayn to'lov ulanmagan bo'lsa — yo'q "TOP qilish" tugmasi
  haqida yozilmaydi ("Onlayn to'lov tez orada ulanadi").
- Test: E2E `global-back.spec.ts` (+1: 360–768 px oralig'ida "Orqaga" kesilmaydi va logotip ustiga tushmaydi),
  `tariffs.spec.ts` (+1: narxlar yuklanmasa; spec endi yolg'iz ham o'tadi — ish beruvchi profilini o'zi yaratadi).

## 2026-11-14 · Tariflar: Oddiy · Tezkor · Maksimal (`claude/tariffs`, 0080)

- Ega: "tariflarni mukammal tuzib chiq — tarif ko'tarilgan sari imkoniyatlar kengayib borsin; narxni baland qo'yma".
- Vakansiya: Oddiy — 10 kun (30 000; e'lon joylash bepul bo'lsa — bepul) · Tezkor — 15 kun + 3 kun TOP (49 000) ·
  Maksimal — 30 kun + 10 kun TOP (99 000). Ishchi e'loni: Oddiy — 10 kun (5 000 / bepul) · Tezkor — 30 kun + 3 kun TOP
  (12 000) · Maksimal — 30 kun + 7 kun TOP + 30 kun AI PRO (19 000). Birinchi to'lovga −50% (aksiya muddatida).
  Oddiy narxlari pasaytirildi (50 000 → 30 000, 10 000 → 5 000) — faqat admin o'zgartirmagan bo'lsa.
- TOP — haqiqiy ta'sir: vakansiya qidiruvda birinchi (is_featured/featured_until, "TOP" belgisi), ishchi — promoted_until.
- E'lon bepul bo'lsa ham Tezkor/Maksimal — faol e'lonni kuchaytirish ("TOP qilish": vakansiya sahifasi, ishchi e'loni
  sahifasi; faqat onlayn to'lov ulangan bo'lsa ko'rinadi). To'lov oynasida daraja tanlovi; narx doim serverda.
- Baza: payments.plan; tariff_of / tariff_price / tariff_tiers / public_tariffs; create_payment va wallet_pay 3 argumentli
  (eski 2 argumentli — Oddiy, eski ilova buzilmaydi); apply_payment_internal daraja bo'yicha; tariffs_enabled sozlamasi.
- Ochiq "Tariflar" sahifasi (/pricing) qayta yozildi — bazadagi narxlar, halol "Bepul", har doim footerda.
- Testlar: SQL `tariffs.test.sql` (yangi), wallet / paid_listings / security_hardening yangi narxlarga; unit `tiers.test.ts`;
  E2E `tariffs.spec.ts` (3), payments.spec yangi narxlarga.

## 2026-11-14 · Hikoyalar, kanalga avtomatik e'lon, telefonda lupa, "ish/ishchi" tugmalari (`claude/launch-ready`, 0079)

- Ega: "telefonda qidiruv joyida lupa ko'rinmayapti"; "ish izlovchida — ish, ish beruvchida — ishchi"; "rasmlar, videolar —
  xuddi Instagramdagidek, Ish topdimning o'zi joylaydi"; "har bir joylangan rezyume kanalga tashlansin".
- Qidiruv maydoni (AI): lupa endi har doim ko'rinadi (≤380px'da yashirilardi); tor telefonda joyni tugmadagi yulduzcha bo'shatadi.
- Bosh sahifa tezkor tugmalari: ish izlovchida "Kunlik ish · Yaqin atrofda ish · Masofaviy ish · Tajribasiz ish",
  ish beruvchida "Kunlik ishchi · Yaqin atrofdagi ishchi · Tajribali ishchi · Masofaviy ishchi" (`easy.chips.*`).
- Hikoyalar (`features/stories`, admin → "Hikoyalar"): bosh sahifa tepasida doirachalar (mehmon, ish izlovchi, ish beruvchi;
  kimga ko'rinishi tanlanadi), bosilsa to'liq ekranda — jarayon chizig'i, bosish/bosib turish/surish, klaviatura, ovoz,
  ixtiyoriy reklama tugmasi (faqat sayt ichidagi yo'l yoki https). Rasm serverda WebP'ga qayta kodlanadi; video (MP4/WebM/MOV,
  50 MB) admin brauzeridan bir martalik imzolangan havola bilan to'g'ridan-to'g'ri yuklanadi, server boshidagi baytlardan
  tekshiradi (niqoblangan fayl — rad etiladi va o'chiriladi). Ko'rilganlar shu qurilmada eslanadi. Statistika: `story_view`, `story_cta`.
- Telegram kanalga avtomatik e'lon (`telegram-channel/autopost.ts`, admin → "Telegram kanal" → "Avtomatik e'lonlar"):
  yangi vakansiya — "🟦 ISH", ishchi e'loni — "🟩 ISHCHI"; telefon, ism, rasm, tavsif yo'q (sarlavhadagi raqam/@nik/havola
  ham olib tashlanadi); har biri bir marta (`channel_posts`), qadamda ≤4 ta, bloklangan muallifniki yo'q, 3 marta qayta
  urinish, kanal xatosida to'xtaydi. Alohida kanallar ixtiyoriy. Ishchi e'loni formasida — bu haqda ochiq yozuv.
- 0079: `stories`, `channel_posts`, `story-videos` bucket. E2E shlyuzi imzolangan yuklashni qo'llaydi.
- Testlar: stories model (7), kanal matni (5), kanal runner (6), E2E `stories.spec.ts` (2); mavjud testlar yangi yozuvlarga.

## 2026-11-14 · Massaj e'lonlari to'liq olib tashlanadi — admin muallif, qo'shimcha kasb va namunalar ham (`claude/remove-massage`)

- Ega: "massajchi ham kerak emas, ular e'londa bor — hammasini yo'q qil".
- Topilgan teshiklar (`moderation/sweep.ts`): eski e'lonlar tekshiruvi faqat muallifni bloklash orqali yashirardi —
  muallif faol admin bo'lsa (bloklanmaydi) yoki egasiz namuna bo'lsa, taqiqlangan e'lon ochiq qolardi; ishchining
  qo'shimcha kasblari ("Sotuvchi" + "Massajchi"), namuna vakansiyalar va ustalar namunalari tekshirilmasdi; fon navbati
  (pg_cron → tick) faqat navbatda ish bo'lsa chaqiriladi — yangi e'lon bo'lmasa tekshiruv umuman yurmasdi.
- Endi: topilgan e'lonning O'ZI darhol ommadan olinadi (vakansiya → hidden, ishchi e'loni → ommaviy emas, usta → rejected,
  namuna vakansiya → o'chiriladi), so'ng muallif bloklanadi (adminlar bundan mustasno). Versiya `2026-11-14.hide-items` —
  hamma e'lonlar boshidan bir marta qayta o'tadi. Allaqachon bloklangan muallif uchun hodisa qayta yozilmaydi.
- Ishga tushirish (`moderation/sweep-trigger.ts`): statistika hodisasi (`/api/e`) va holat tekshiruvi (`/api/health`) javobdan
  keyin bir qadam yurgizadi — har server nusxasida bittadan, tugagach soatiga bir marta. Bazaga o'zgarish (migratsiya) kerak emas.
- Testlar: rules (+5 kasb nomi), sweep-trigger (3), E2E `moderation-ban.spec.ts` (admin muallif, qo'shimcha kasb, namuna).

## 2026-11-13 · Qat'iy taqiq: erotika, ekstremizm, noqonuniy, massaj/spa — e'lon yo'q, muallif bloklanadi (`claude/moderation-hard`)

- Ega: "erotika, diniy ekstremizm, qonunga xilof barcha e'lonlar va so'zlar umuman ishlatilmasin; joylamoqchi bo'lsa o'sha
  zahoti bloklansin; joylagandan keyin har bir so'z (ma'nosi yaqin bo'lsa ham) tekshirilsin — e'lon ham o'chirilsin, o'zi
  ham bloklansin; massaj, spa kerak emas".
- Qoidalar (`moderation/rules.ts`, `STRICT`): massaj (massaj, массаж, massage, masseur — tibbiy ham), spa (salon/markaz/
  xodim konteksti; IT'dagi "SPA" emas), relaks salon, erotika so'zlari (erotika, porno, seks, intim, webcam model …),
  pullik tanishuv, diniy ekstremizm va taqiqlangan tashkilotlar, diniy targ'ibot, giyohvand nomlari, qurol savdosi, qimor,
  a'zo savdosi — kontekstsiz "block". Yolg'on topilmalarga qarshi testlar: "seksiya", "narkolog", "giyohvand moddalar
  iste'mol qilmaydigan", ismlar (Shahid, Mujohid, Jihod), "React SPA", "masala", "masjid", "наша", "печенье", "ставка".
- AI moderatsiya (`verdict.ts`): so'zni emas, MA'NONI baholaydi (jargon, evfemizm, raqam bilan yozish, kirill/rus/ingliz);
  massaj va spa — istisnosiz rad.
- Jazo (`moderation/policy.ts`, `enforce.ts`): og'ir toifada rad etilsa (qoida yoki AI) — hisob bloklanadi
  (`profiles.is_blocked`, sabab `auto_moderation:…`), barcha ochiq e'lonlari yashiriladi (vakansiyalar → hidden, ishchi
  e'loni → ommaviy emas, ustalar → rejected), xavfsizlik hodisasi `moderation.auto_ban` (admin ogohlantirishi). Hech narsa
  o'chirilmaydi — admin "Blokdan chiqarish" bilan qaytaradi. Faol adminlar bloklanmaydi (hodisa yoziladi).
- Qayerda: e'lon joylash (ishchi, vakansiya), AI suhbat va AI qoralama (yozayotganda), ustalar e'loni, so'rov va sharh.
  Joylash "bloklangan" bilan tugaydi, keyingi sahifa — /blocked.
- Eski e'lonlar (`moderation/sweep.ts`): fon navbatida kuchaytirilgan qoidalar bilan bir marta qayta tekshiriladi
  (kursor app_settings'da, versiya `2026-11-13.strict`).
- Kasblar katalogi: massaj/spa kasblari ko'rsatilmaydi va tanlanmaydi (ilovada darhol; bazada — 0078,
  `supabase/prod/pending.sql`, ega qo'llaydi).
- Testlar: rules (+47), policy, masters content-check; E2E `moderation-ban.spec.ts` (yozayotganda bloklash, joylangandan
  keyin moderatsiyada, eski e'lonlar qayta tekshiruvi, toza e'lon bloklanmaydi), masters, post-ai-chat (holat qaytariladi).
- Topilgan va tuzatilgan: 150% shrift + rus tilida Profildagi "AI-помощник"/"Универсальные мастера" kartalari va rejim
  oynasi tugmalari yonga chiqardi (uzun so'z endi bo'linadi).

## 2026-11-13 · Mehmon bosh sahifasi soddalashtirildi — 2-bosqich (`claude/ux-simplify-2`)

- Rejim tanlamagan mehmon sahifasi telefonda ~8 600 px dan ~4 500 px ga: hero (ikki yo'l + qidiruv) → ommabop kasblar →
  bitta "Yangi vakansiyalar" ro'yxati → alohida yashil "Universal ustalar" → footer.
- Olib tashlandi (takror yoki ikkinchi darajali): "Tanlangan vakansiyalar" (yangilari bilan ikkinchi ro'yxat), ishonch
  bo'limi, ish beruvchilar bloki (hero'dagi "Menga ishchi kerak"ni takrorlardi), "Qanday ishlaydi" (birinchi ochilishda
  /start tanishtiruvida bor). Ishlatilmay qolgan kod (`FeaturedJobs`, `TrustedEmployers`, `EmployerBand`, `HowItWorks`)
  o'chirildi. Testlar moslandi (home-market, entry).

## 2026-11-13 · Bosh sahifa soddalashtirildi — 1-bosqich (`claude/ux-simplify`)

- Ega: "ISH TOPDIM — complete UX/UI simplification": bosh sahifada faqat joylashuv, salomlashuv, katta qidiruv, tezkor
  yo'llar, yangi e'lonlar va alohida "Universal ustalar". Audit va reja — `docs/UX_SIMPLIFICATION_2026-11.md`.
- Ish izlovchi bosh sahifasi: 11 blokdan 4 ga. Kompyuterda joylashuv tanlovi salomlashuv ustida (telefonda — yuqori panelda).
  Yangi ishlar to'liq kenglikda. Yangi `MastersHomeSection` — o'z yashil rangida: 7 ta xizmat turi (katalogdan) va
  "Ustalarni ko'rish".
- Ko'chirildi (o'chirilmadi): "Mening dunyom" va bugungi reja → Profil (`/cabinet#dunyo`, /dunyo tugagach shu yerga);
  "Mening faoliyatim" → "Arizalar" va Profil sarlavhasi; "O'zim haqimda e'lon" → pastki menyu "E'lon"; "Yangi ish chiqsa
  xabar" → Profil → AI PRO; AI kartasi → yuqori panel ✨ / yon menyu / Profil.
- Ish beruvchi: "Bo'limlar" ro'yxati olib tashlandi (menyuni takrorlardi), mehmon-ish beruvchidagi AI va xabar kartalari ham;
  "Universal ustalar" bo'limi qo'shildi.
- Bugungi reja qadamlari 44 px (bosish maydoni). Testlar yangi tuzilishga moslandi (home, ai-entry, masters, world,
  responsiveness).

## 2026-11-13 · Har bir sahifa tepasida "‹ Orqaga" (`claude/global-back`)

- Ega: "orqaga qaytish topolmayapti — har bir oynaning tepasida kichkina orqaga chiqib tursin". Telegram ichida brauzerning
  orqaga tugmasi ko'rinmaydi. Endi har bir sahifada (bosh sahifa, ish beruvchi bosh sahifasi va ustalar bosh sahifasidan
  tashqari) tepada kichik "‹ Orqaga" (`GlobalBack`): telefonda — yuqori panelda logotip oldida (birinchi ekrandagi e'lonlar
  joyi o'zgarmaydi; tor ekran/katta shriftda logotip o'rnida), kompyuterda — sahifa tepasida qator, ustalar mini-ilovasida —
  qator. Sayt ichidan kelingan bo'lsa — aynan oldingi sahifaga, havola orqali ochilgan bo'lsa — eng yaqin bo'lim sahifasiga
  (masalan, /employer/vacancies).
- Telegram/Instagram tugmasi katta shriftda tor ekranga sig'adi (@manzil qisqartiriladi).
- Sahifaning o'z "Orqaga"si bo'lsa (`data-page-back`: vakansiya, e'lon, nomzod, namuna, moslik, chat, qidiruv qadamlari) —
  umumiysi yashiriladi (ikkita bo'lmaydi). Sarlavha yonidagi kichik "‹" (PageHeader) — umumiy "‹ Orqaga" bor joyda yashirin,
  hamma joyda bir xil ko'rinish. Menyusiz e'lon berish ustasida — pastdagi katta "Orqaga" tugmasi (avvalgidek).

## 2026-11-13 · Ish beruvchi o'z e'lonini ish izlovchi ko'zi bilan ko'radi (`claude/employer-preview`)

- Ega: "ish beruvchi e'lon joylagandan keyin o'z e'lonini ish izlovchilar kabinetda qanday ko'rishini bilmoqchi".
- Boshqaruv sahifasida (`/employer/vacancies/[id]#korinish`) yangi blok "Ish izlovchilar qanday ko'radi":
  ko'rinish holati (ko'rinmoqda / tekshiruvda / qoralama / to'xtatilgan / yopilgan / yashirilgan), ish izlovchi shu kasbni
  shu hududda qidirganda e'lon nechanchi o'rinda chiqishi (o'sha qidiruv funksiyasi va tartibi, birinchi 50 ta ichida;
  topilmasa o'rin aytilmaydi) va ro'yxatdagi kartaning o'zi (`src/features/vacancies/seeker-view.ts`).
- `/jobs/[slug]?korinish=izlovchi` — faqat e'lon egasiga: sahifa ish izlovchi ko'radigandek (ariza, saqlash, aloqa),
  ustida tushuntirish va "Boshqaruvga qaytish"; tugmalar o'chiq (`inert`), ko'rishlar soni oshmaydi. Boshqalarga parametr
  ta'sir qilmaydi.
- Kirish nuqtalari: e'lon joylangach (oddiy oqim) "Ish izlovchilar qanday ko'radi"; "Vakansiyangiz joylandi" bannerida;
  boshqaruvdagi "Ish izlovchi ko'zi bilan" tugmasi va vakansiyalar ro'yxatidagi menyu.
- E2E: `employer-seeker-view.spec.ts` (o'rin, karta, ko'rinish, tekshiruvdagi e'lon, begona foydalanuvchi), `journeys`.

## 2026-11-12 · "Yangi" yozuvi o'rniga yozuvsiz nuqta; AI va ustalar bo'rtib turadi (`claude/standout-no-badge`)

- Ega: "yangi degan so'zlar kerak emas, qandaydir bo'rtib chiqib tursa bo'ldi; ranglar yomon emas". "YANGI" yozuvli
  belgilar olib tashlandi. O'rniga kichik yonib-o'chuvchi nuqta (`NewDot`, `.new-dot`, rangi — bo'lim rangi; harakatni
  kamaytirish sozlamasida to'lqinsiz) — AI yordamchi, Universal ustalar, "Ishlar xaritada" va bosh sahifadagi "Xaritada
  ko'rish". AI yordamchi va Universal ustalar yon menyuda va kartalarda rangli soya bilan bo'rtib turadi (ustiga kelganda
  biroz ko'tariladi). Ranglar o'zgarmadi. Nuqtalar 2027-01-15 da o'zi yo'qoladi; "Yangi" so'zi faqat ekran o'quvchiga.

## 2026-11-12 · AI yordamchi to'q sariq rangda; muhim yangi bo'limlarda "Yangi" belgisi (`claude/ai-orange`)

- Ega: "AI yordamchi boshqacha, orange rangda ajralib tursin; muhim yangiliklar ham ajralib tursin". Yangi rang tokenlari
  `--ai`, `--ai-soft`, `--ai-bright` (kontrast testlari bilan, docs/DESIGN_SYSTEM.md). AI yordamchi endi hamma joyda to'q sariq:
  yon menyu (turkuaz "Universal ustalar" kabi ajratilgan), yuqori menyu, telefon sarlavhasidagi belgi, bosh sahifa va kabinet
  kartasi, AI belgisi (suhbatda), "Tez va qulay e'lon" kartasi.
- "Yangi" belgisi: AI yordamchi, Universal ustalar, yon menyudagi yangi "Ishlar xaritada" (ish izlovchi), bosh sahifadagi
  "Xaritada ko'rish". Belgilar 2027-01-15 da o'zi yo'qoladi (`src/config/new-features.ts`).

## 2026-11-12 · Telegram va Instagram havolalari ko'rinadigan joylarda (`claude/social-links`)

- Ega: "instagram ishtopdim, telegram ish_topdim_uz — bosilsa olib boradigan qilib qo'shib qo'y". Rasmiy sahifalar (Vercel'dagi
  `SOCIAL_TELEGRAM_URL`, `SOCIAL_INSTAGRAM_URL`) endi belgili tugmalar: sayt pastki qismi (@manzil bilan), kompyuterdagi chap
  yon menyu ("Biz ijtimoiy tarmoqlarda"), telefonda kabinet sahifasi va "Yordam" sahifasi. Bosilsa yangi oynada ochiladi.
- Sozlanmagan tarmoq ko'rsatilmaydi (soxta havola yo'q); faqat `https://` havolalar.

## 2026-11-12 · AI yordamchi sahifasi butun ekranni egallaydi (`claude/ai-fullscreen`)

- Ega skrinshoti: `/ai` katta monitorda o'rtada kichik oyna edi. Endi kompyuterda suhbat oynasi ekran balandligini to'ldiradi
  (yozish maydoni pastda, ChatGPT kabi), 1536 px dan keng ekranda sahifa butun kenglikni egallaydi; yon panellar 1920 px dan
  kengroq. Xabarlar ustuni o'qish qulay bo'lishi uchun 1024 px dan oshmaydi; yangi suhbatda salomlashuv o'rtada.

## 2026-11-12 · Katta monitorlarda ekran to'liq ishlatiladi (`claude/wide-screens`)

- Ega: "nimaga haqiqiy saytlarga o'xshab butun ekranni egallamayapti" (2560 px monitor). Ro'yxat va bosh sahifalar endi
  `container-wide` da: 1536 px dan 1440, 1920 px dan 1760, 2400 px dan 2080 px gacha kengayadi (avval hamma joyda 1152 px).
  Kartalar ustunlari ko'payadi: bosh sahifa lentasi 3–4, qidiruv natijalari 2–4, namunalar 4–5, kompaniyalar va kasblar 4–5,
  ustalar 5–8, nomzodlar 2–3. Bosh sahifa qidiruv kartasi katta ekranda ikki ustun (o'ngda AI yordamchi va Universal ustalar).
- Matnli sahifalar (vakansiya, profil, kompaniya) — avvalgicha 1152 px: juda uzun qator o'qishga noqulay.
- Yangi o'lchamlar: `3xl` (1920 px), `4xl` (2400 px). 1440 px va undan kichik ekranlarda hech narsa o'zgarmadi.
## 2026-11-12 · "Tez va qulay e'lon — AI yordamchi bilan" (ish izlovchi) (`claude/post-ai-chat`)

### Mahsulot
- Ega: "kuryerlikdan ish qidirmoqchiman desa, e'lon uchun kerakli narsalarni AI o'zi so'rasin". E'lon berish (va
  o'zgartirish) sahifasining 1-qadamida suhbat: foydalanuvchi bir gap yozadi → yordamchi yetishmayotganlarini **birma-bir**
  so'raydi: kasb (bir nechta mos kelsa — "Aniqrog'i qaysi biri?" tugmalari: piyoda, moto, ekspress kuryer…), viloyat, tuman
  (yoki "Butun viloyat"), tajriba, grafik (yoki "Farqi yo'q"), maosh (yoki "Kelishiladi"), ism va telefon (faqat noma'lum
  bo'lsa), o'zi haqida (yoki "Javoblarimdan tuzib ber" — faqat aytilgan faktlardan). Har javobni tugma yoki matn bilan
  berish mumkin ("Toshkent, Chilonzor", "3 yil", "6 mln"); tushunilmasa — savol qayta beriladi.
- Birinchi gapdan tushunilganlar qayta so'ralmaydi ("Samarqandda oshpaz, 3 yil tajriba" → faqat tuman va qolganlari).
- Oxirida qisqa xulosa va "Tekshirish va joylash" — qoralama to'ldiriladi, tekshirish sahifasi ochiladi; hech narsa o'zi
  joylanmaydi. AI kaliti ishlamasa ham suhbat to'liq ishlaydi (lug'at va ma'lumotnoma); AI bo'lsa — uzun birinchi gapdan ism
  va "o'zim haqimda" ham olinadi (faqat matndagi faktlar).
- "kuryerlikdan" kabi qo'shma qo'shimchali so'z endi "kuryer" deb tushuniladi (avval "Kuryerlik xizmati dispetcheri" ga
  tushardi) — bu AI qidiruvni ham tuzatadi.

### Xavfsizlik
- Har bir javob taqiqlangan mazmunga tekshiriladi (e'longa ham, AI'ga ham bormaydi); yangi qoida: "giyohvand … sotaman /
  tarqataman / yetkazaman" (lotin va kirill). Soatlik limit: kirgan foydalanuvchi 120, mehmon 60 xabar.

## 2026-11-12 · AI yordamchi namuna e'lonlarni ko'rsatadi; "… kerak" statistika emas, qidiruv (`claude/ai-demo-samples`)

### Mahsulot
- Ega: "Namuna e'lonlarda Avtoinstruktor bor, AI esa 0 ta deydi". Endi haqiqiy vakansiya topilmasa (ish qidirishda, kasb
  tushunilganda) AI javobi ostida **shu kasb bo'yicha namuna e'lonlar** chiqadi (bo'lmasa shu sohadagilar) — "Namuna e'lonlar —
  haqiqiy emas" sarlavhasi, "Namuna" belgisi, ariza tugmasi yo'q; javob matni ham buni ochiq aytadi. Namunalar natijalar soniga
  va statistikaga **kirmaydi**; statistika javobida alohida qator: "Namuna e'lonlar: 1 ta — haqiqiy emas".
- "Maosh va talab" savolidan keyin "avto instruktor kerak" kabi xabar statistikaning davomi deb olinardi (0 ta deb javob). Endi
  "kerak", "bormi", "izlayapman", "нужен", "ищу", "need" kabi so'zli xabar — yangi qidiruv.
- AI modeli ham biladi: namunalar haqiqiy ish emas, sanalmaydi, ularga ariza tavsiya qilinmaydi.

### Kuzatuv
- AI chaqiruvi xato bersa (javob "oddiy rejim"da chiqadi) — sababi Vercel jurnalida ham yoziladi (`[ai] … failed …`; kalit va
  foydalanuvchi matni yozilmaydi). Admin bosh sahifasidagi "AI holati" kartasida ham ko'rinadi.

## 2026-11-12 · Yaqin atrofdagi ishlar xaritasi (Yandex) va AI: bozor statistikasi, karyera (`claude/jobs-map`)

### Mahsulot
- **`/jobs/xarita` — yaqin atrofdagi ishlar Yandex xaritasida.** Hudud va tuman tanlanadi yoki "Mening joylashuvim" bosiladi
  (koordinata serverga yuborilmaydi: brauzer eng yaqin tumanni topadi, faqat tuman saqlanadi). Xaritada ko'k belgilar — haqiqiy
  e'lonlar (aniq manzil bo'lsa — o'sha nuqta, bo'lmasa — tuman markazi, ro'yxatda "taxminan" deb yoziladi), kulrang — namuna.
  Ostida raqamlangan ro'yxat (masofa bilan), "Yandex Xaritada ochish". Kirish: bosh sahifada "Xaritada ko'rish", "Yaqin atrofda"
  bo'limi, sayt pastki qismi.
- **AI yordamchi — bozor statistikasi:** "oshpaz maoshi qancha?" → bazadagi faol vakansiyalar, ish izlovchilar soni va oylik maosh
  oralig'i kartasi (kamida 3 ta e'lon bo'lsa; aks holda halol "e'lonlar kam"). AI ulangan bo'lsa — `market_stats` asbobi.
- **Maslahat AI'siz ham ishlaydi:** rezyume, suhbatga tayyorgarlik, karyera rejasi, vakansiya matni, suhbat savollari — bosqichma-
  bosqich yo'riqnoma ("AI ulanmagan" degan boshi berk javob o'rniga). Yangi tez tugma "Maosh va talab".

### Xavfsizlik
- CSP `frame-src`: faqat o'z sayt va Yandex xarita vidjeti (`yandex.ru`, `yandex.uz`, `yandex.com`); test bilan qotirilgan.

## 2026-11-12 · Namuna vakansiyalar — barcha sohalar bo'yicha (`claude/demo-vacancies`)

### Mahsulot
- **Har sohada 4 tadan namuna vakansiya** (38 soha, 152 ta): haqiqiy e'lon yo'q joyda — bosh sahifa, `/jobs` va qidiruvning bo'sh
  holatida — "Namuna" belgisi bilan alohida blokda. `/jobs/namuna` — hammasi; har namuna sahifasida "haqiqiy ish emas" ogohlantirishi.
- **Bir bosishda olib tashlash:** admin → "Namuna e'lonlar". Qaytarish ham bor.
- Namunalar haqiqiy e'lonlar bilan aralashmaydi: ariza, xabarnoma, statistika, sitemap'ga tushmaydi; kompaniya va telefon yo'q.

### Xavfsizlik (Universal ustalar)
- Usta e'loni, mijoz so'rovi va sharh matni saqlanishidan oldin tekshiriladi: aniq taqiqlangan mazmun (intim xizmat, giyohvand
  moddalar, karta/akkaunt savdosi, soxta hujjat, buzib kirish, ekstremizm) saqlanmaydi; shubhali belgilar (savdo, oldindan
  to'lov, spam …) admin navbatida ogohlantirish bo'lib chiqadi. Admin navbatida har e'lonning rasmlari ko'rinadi.

### Baza
- `0077_demo_vacancies.sql` (alohida jadval) — `supabase/prod/pending.sql` ga qo'shildi. 0076 va 0077: demo/namuna faqat
  birinchi o'rnatishda yaratiladi (fayl qayta qo'yilsa, olib tashlanganlari qaytmaydi).

## 2026-11-12 · "AI yordamchi" bo'limi menyularda; prod baza uchun bitta fayl (`claude/ai-entry-everywhere`)

### Mahsulot
- **"AI yordamchi" endi nomli bo'lim:** kompyuterda chap yon menyuda va yuqori menyuda, telefonda yuqori paneldagi belgi va bosh
  sahifadagi karta, "Kabinetim"da karta. Bosilganda `/ai` — suhbat oynasi (chap panel, so'nggi suhbatlar, jarayon izi).
  Avval sahifa bor edi, lekin unga olib boradigan nomli tugma yo'q edi.
- Bosh sahifada ikki bo'lim kartasi yonma-yon: "AI yordamchi" va "Universal ustalar".

### Baza
- **`supabase/prod/pending.sql`** — prod'da hali yo'q barcha migratsiyalar (0069…0076) bitta faylda: ega SQL Editor'ga bir marta
  qo'yadi. Bitta tranzaksiya, takror ishga tushirish xavfsiz; CI'da prod'ga o'xshash bazada sinaladi.

## 2026-11-12 · Universal ustalar — xizmat ko'rsatuvchi ustalar bozori (`claude/universal-masters`)

### Mahsulot
- **Yangi bo'lim `/ustalar`** (turkuaz, alohida mini-ilova): 12 xizmat kategoriyasi, qidiruv va filtrlar, usta kartalari, e'lon sahifasi.
- **Ustalar e'lon joylaydi** (kategoriya, tavsif, tajriba, hudud, narx, ish vaqti, rasmlar) va **kabinetda boshqaradi**: holatlar,
  ko'rishlar, telefon bosishlar, mijoz so'rovlari, reyting.
- **Mijoz** ustaga qo'ng'iroq qiladi (usta telefonni ochiq ko'rsatishga rozi bo'lsa) yoki so'rov yuboradi; kirgan foydalanuvchi sharh yozadi.
- **Moderatsiya:** yangi va o'zgartirilgan e'lonlar admin tasdig'idan keyin chiqadi; rad etish sababi egasiga ko'rinadi.
- **Demo e'lonlar:** har kategoriyada 4 tadan, "Demo" belgisi bilan, telefonsiz va reytingsiz; admin bir bosishda olib tashlaydi.
- **Kirish:** sayt menyusi, yon menyu, bosh sahifa va "Kabinetim" sahifasida turkuaz "Universal ustalar".
- 0076 hali qo'llanmagan bazada bo'lim "Bo'lim tayyorlanmoqda" deb ochiladi (xato ekrani yo'q); admin sahifasi buni aniq aytadi.
- Usta kartasida bog'lanish usuli: "Qo'ng'iroq qilish mumkin" yoki "Bog'lanish — so'rov orqali" (raqamning o'zi — e'lon sahifasida).

### Baza
- `0076_masters.sql` — **prod'ga egasi qo'llaydi** (`docs/RELEASE_CHECKLIST.md`). Qaytarish: `supabase/rollbacks/0076_masters.down.sql`.

## 2026-11-12 · AI yordamchi — "ChatGPT kabi" ish maydoni (`claude/ai-workspace`)

### Mahsulot
- **/ai sahifasi qayta qurildi:** chapda "Yangi suhbat", bo'limlar va **so'nggi suhbatlar** (qurilmada, 7 kun), profil;
  o'rtada suhbat — ism bilan salomlashuv, **"Bugungi ishlar"** (mos vakansiyalar soni, profil to'liqligi, arizalar — faqat
  bazadan) va **"Sizga mos ishlar"** kartalari; o'ngda karyera, tezkor imkoniyatlar va kunlik maslahat. Telefonda panel pastdan.
- **Jarayon ko'rinib turadi:** har javobda "Tushunildi → Bazadan qidirildi · N ta → Javob: sun'iy intellekt / oddiy rejim".
- AI ulanmagan rejimda "menga mos ish toping" — kasb so'raladi; maslahat savollariga AI yo'qligi halol aytiladi.

## 2026-11-12 · Bozorga tayyorlik: prod tekshiruvi, HTTP yuklama testi, ochiq ro'yxatlar keshi (`claude/market-readiness`)

### Tezlik
- Mehmon bosh sahifasi va vakansiya sahifasi katta bazada 7× tezroq: "Yangi e'lonlar / Yangi ishchilar" va "O'xshash vakansiyalar"
  ro'yxatlari 60 s keshda (foydalanuvchiga bog'liq emas); e'lon joylansa, yopilsa yoki holati o'zgarsa darhol yangilanadi.

### Vositalar
- `npm run prod:check` — prod'ni tashqaridan tekshirish (health, migratsiyalar, sahifalar, Telegram, to'lov, sarlavhalar).
- `npm run load:http` — HTTP yuklama testi (lokal stend / staging), `load/stand-app.sh` — prod kesh bilan stend.

### Hujjatlar
- `docs/STATUS.md` — joriy holat (bitta sahifa); `docs/SCALE.md` §8 — HTTP yuklama testi va sig'im taxmini;
  eski hisobotlar tarixiy deb belgilandi.

## 2026-11-11 · 2.0: ish beruvchi paneli, xush kelibsiz ekrani, cookie, Play Market (`claude/v2-employer-entry-play`)

### Mahsulot
- **Ish beruvchi bosh sahifasi va paneli noldan:** "Qanday xodim kerak?" + bitta AI qidiruv maydoni, 4 ta tez yo'l, katta
  "Vakansiya joylash"; panelda — ko'rsatkichlar, yangi arizalar, nomzodlar, faol vakansiyalar. Plitkalar, fon surati, oynalar
  olib tashlandi.
- **Kirish bitta ekran:** til qatori + ikkita rasmli karta (ish qidiryapman / ishchi qidiryapman) — bir bosishda o'z bosh
  sahifasiga, kirishsiz. Tanishtiruv slaydlari ixtiyoriy.
- **Cookie:** `/cookies` siyosati (4 tilda), bir martalik eslatma, footer havolasi. Maxfiylik siyosati: AI yordamchi va mikrofon.

### Play Market
- Yangi do'kon rasmlari (ikona, feature graphic, 6 skrinshot × uz/ru) 2.0 dizaynda; hujjat yangilandi (Data safety: AI, mikrofon).

## 2026-11-11 · AI HR yordamchi: tabiiy suhbat va ovoz (`claude/ai-hr-assistant`)

### Mahsulot
- **AI yordamchi endi suhbatlashadi:** oldingi xabarlarni hisobga oladi, avval javob beradi, keyin bitta savol so'raydi;
  o'zbek (lotin, kirill), rus va ingliz tilida — foydalanuvchi qaysi tilda yozsa. Sun'iy intellekt ekanini yashirmaydi.
- **Vakansiya va nomzodlar faqat bazadan:** kartalar bazadagi ma'lumotdan chiziladi; model hech narsa o'ylab topa olmaydi.
- **Javob oqim bilan chiqadi**, to'xtatish mumkin; tavsiya savollar; uzun matndan nusxa olish.
- **Ish izlovchi:** rezyume yozishga yordam, suhbatga tayyorgarlik, profilidagi kasb va hudud bo'yicha qidirish.
- **Ish beruvchi:** nomzod qidirish, vakansiya matni, suhbat savollari. Yakuniy qaror — ish beruvchida.
- **Ovoz:** katta mikrofon, aytilgan gapni tekshirib yuborish, javobni o'qib berish (qurilma qo'llasa), istalgan payt to'xtatish.

### Ishonchlilik va xavfsizlik
- AI ishlamasa (xato, limit, 30 soniya) — foydalanuvchi baribir o'z tilida javob va bazadagi natijani oladi.
- API kaliti faqat serverda; suhbat matni va ovoz serverda saqlanmaydi; soatlik limit va kunlik AI byudjeti.
- Tuzatildi: hudud nomi kasb deb tushunilishi ("Samarqandda" → noto'g'ri kasb).

## 2026-11-11 · 2.0: sodda bosh sahifa va "yo'q" demaydigan AI qidiruv (`claude/v2-sodda-qidiruv`)

### Mahsulot
- **Ish izlovchi bosh sahifasi noldan:** bitta savol, bitta qidiruv maydoni, 4 ta tez yo'l, yangi ishlar. Fon surati, nol
  ko'rsatkichlar, plitkalar, bo'limlar va katalog olib tashlandi.
- **AI qidiruv:** aniq so'rov bo'sh chiqsa qidiruvni o'zi kengaytiradi (tuman → viloyat → butun O'zbekiston → shartlarsiz →
  yaqin kasb) va buni ochiq aytadi. Kasb tushunilmasa ham hudud/maosh/grafik bo'yicha qidiradi.
- **Kasb ro'yxatida yo'q so'z** (do'kon/kompaniya nomi, erkin lavozim): e'lon matnlaridan qidiradi va qaysi so'z bo'yicha
  topganini aytadi.
- **Hech narsa bo'lmasa:** halol javob + "Yangisi chiqsa — Telegram'da xabar bering" (yozgan matni tayyor) + "O'zim haqimda
  e'lon berish". Soxta e'lon yoki foiz yo'q.

### Ishonchlilik
- Sahifa to'liq yuklanmasdan "Topish" bosilsa, so'rov `/ai?q=…` sahifasida bajariladi (avval sahifa qayta ochilib qolardi).

### Admin
- "Bosh sahifa" izohlari yangilandi: oynalar faqat ish beruvchi bosh sahifasida; AI o'chirilsa — oddiy matnli qidiruv.

## 2026-11-07 · 0-bosqich: barqarorlashtirish (`claude/phase-0-barqarorlik`)

### Xavfsizlik
- Next.js 16.3.8 → **16.4.5** (kritik advisory'lar: Image Optimization RCE, Server Actions DoS, `use cache` RCE).
  `eslint-config-next` ham 16.4.5. `npm audit --omit=dev` — 0 zaiflik.
- **0074 aloqa maxfiyligi:** qidiruv ro'yxatlari (vakansiya v1/v2/v3, ishchi v1/v2) endi telefon qaytarmaydi — anonim
  ommaviy yig'ish yopildi. Raqam faqat bitta e'lon sahifasida, kirgan va faol foydalanuvchiga, soatiga 40 / sutkasiga 150 ta
  turli e'lon limiti bilan (`contact_reveals`). `telegram_accounts.phone` foydalanuvchi sessiyasidan (barcha admin
  rollaridan ham) o'qilmaydi — faqat server kaliti.
- Vakansiya sahifasida mehmonga raqam o'rniga "Kirish" taklifi.

### Ishonchlilik
- **0075 webhook:** qayta ishlashda xato bo'lsa update yo'qolmaydi — 3 urinishgacha 500 (Telegram qayta yuboradi),
  keyin 200 (navbat to'xtamaydi); xato `telegram_updates.last_error` da.
- **`/api/health`**: ochiq holat (baza ulanishi, reliz). `?deep=1` + `CRON_SECRET` — prod bazada yetishmagan migratsiyalar.
- **Sentry** (faqat server, `SENTRY_DSN` bo'lsa): render/route/action xatolari, webhook va cron. Telefon va e-mail
  yuborishdan oldin yashiriladi, so'rov sarlavhalari yuborilmaydi.

### Mahsulot
- Qidiruv kartasidagi o'z arizasi holati endi holat rangida: "Rad etildi" — qizil (avval yashil "✓" edi).
- Faol vakansiyasiz kompaniyalar sitemap'dan chiqarildi va sahifasi `noindex` (prod'dagi sinov kompaniyalari indeksga tushmaydi).

### CI
- `tsc` rasm importlarini taniydi (`src/types/next-images.d.ts`) — CI typecheck qadami tuzatildi.

### Ega amallari
`docs/RELEASE_CHECKLIST.md`: zaxira → `scripts/prod-migration-check.sql` → 0069–0075 → kod → `/api/health`.
