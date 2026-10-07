# ISH BERUVCHI — ULTRA PROMPT (yakuniy versiya)

> Bu matnni dasturlash agentiga (Claude Code) to'liq bering. Mavjud loyiha bo'lsa, o'sha loyiha ichida ishlatilsin.

---

## 0. SEN KIMSAN VA NIMA QURASAN

Sen tajribali mahsulot dizayneri, mobil UX mutaxassisi va senior full-stack muhandissan. Vazifang — **"Ish Beruvchi"** ilovasini qurish yoki mavjudini shu talablarga keltirish.

**Maqsad:** O'zbekistondagi har bir ish beruvchi kerakli xodimni, har bir ish izlovchi esa mos ishni **bir necha daqiqada, hech kimdan yordam so'ramasdan** topsin.

**Bosqich:** hozir faqat O'zbekiston. Keyin xalqaro bozorga chiqiladi, shuning uchun mamlakat, til, valyuta va hududlar boshidan **alohida, almashtiriladigan** qilib qurilsin. Ammo ilovada hozir boshqa davlat ko'rinmasin.

**Oltin qoida:** 7 yoshli bola ham, 70 yoshli buvi ham ishlata olsin. Har bir ekranda **bitta savol, bitta asosiy tugma**. Agar biror joy murakkab bo'lib qolsa — bu xato, soddalashtir.

---

## 1. ASOSIY TAMOYILLAR (hamma ekranga tegishli)

1. **Ilova o'zi yetaklaydi.** Foydalanuvchi bitta qadamni to'ldirdi — ilova avtomatik keyingisiga o'tadi. "Keyingi" tugmasi faqat kerak bo'lsa.
2. **Bir ekran — bitta savol.** Uzun forma yo'q. Har qadam tepasida ingichka progress chizig'i ("3 / 6").
3. **Tanlash birinchi, yozish ikkinchi.** Har qadamda katta tugmalar (kartochkalar) bilan tanlash. Har doim pastda: **"Ro'yxatda yo'qmi? O'zingiz yozing"**.
4. **Orqaga qaytish xavfsiz.** Kiritilgan ma'lumot hech qachon yo'qolmaydi (har qadam serverga saqlanadi). Ilova yopilsa, keyingi safar o'sha joydan davom etadi.
5. **Qayta so'ramaslik.** Bir marta berilgan ma'lumot (til, rol, joy) qayta so'ralmaydi. Tayyor foydalanuvchi qaytganda onboarding qayta boshlanmaydi.
6. **Kod bilan kirish yo'q.** SMS kod, parol so'ralmaydi:
   - Telegram Mini App ichida — Telegram ma'lumoti (initData) orqali **avtomatik** kirish. Server initData imzosi va muddatini tekshiradi.
   - Veb — "Telegram orqali kirish" tugmasi (bir bosish).
   - Telefon raqami faqat Telegram'ning "Raqamni ulashish" tugmasi orqali olinadi (yozdirilmaydi).
7. **Professional dizayn.** "AI qilganday" bachkana ranglar, gradient, emoji-to'qnashuvi yo'q. Bitta asosiy rang (chuqur ko'k), oq/kulrang fon, toza tipografiya (Inter), katta bosiladigan maydonlar (kamida 48px), yengil soyalar. Namuna darajasi: Uber, Revolut, Airbnb. Tun rejimi ham bor.
8. **Har tugma tushunarli.** Har ikon yonida so'z. Ikon yolg'iz qolmasin.

---

## 2. BIRINCHI KIRISH: KETMA-KETLIK

### 2.1. Umumiy boshlanish (hamma uchun)

| Qadam | Ekran | Izoh |
|---|---|---|
| 1 | **Til** | 3 ta katta karta: "O'zbekcha", "Ўзбекча", "Русский". Har biri o'z yozuvida. Bayroq yolg'iz belgi bo'lmasin. Tanlandi — darhol keyingisi. |
| 2 | **Rol** | 2 ta juda katta karta: **"Ish qidiryapman"** va **"Xodim qidiryapman"**. Ostida bitta qatordan izoh. |
| 3 | **Telefon** | "Raqamni ulashish" bitta tugmasi (Telegram). Kod yo'q. |

So'ng rolga qarab yo'l ajraladi.

### 2.2. Xodim qidiruvchi (ish beruvchi) yo'li

| Qadam | Ekran | Izoh |
|---|---|---|
| 1 | **Siz kimsiz?** | Kartalar: Xususiy kompaniya · Davlat tashkiloti · YaTT (yakka tartibdagi tadbirkor) · O'zini o'zi band qilgan · O'zim yoki oilam uchun (uy ishlari, enaga, haydovchi) · Boshqa (izoh yozadi). |
| 2 | **Joylashuv ruxsati** | "Kompaniyangiz qayerda? Joylashuvni aniqlaymizmi?" — [Ha, aniqlash] [Qo'lda tanlayman]. Rad etilsa ham ilova to'xtamaydi. |
| 3 | **Viloyat** | 14 ta hudud ro'yxati (Toshkent shahri va Toshkent viloyati alohida). GPS bo'lsa oldindan belgilangan, foydalanuvchi faqat tasdiqlaydi. |
| 4 | **Tuman / shahar** | Tanlangan viloyatning barcha tumanlari va shaharlari. Bir xil nomlilar "Qarshi shahri" / "Qarshi tumani" deb aniq ajratilgan. |
| 5 | **Aniq manzil** (ixtiyoriy) | Xaritada nuqta yoki mo'ljal ("Chorsu bozori yonida"). O'tkazib yuborish mumkin. |
| 6 | **Kompaniya nomi** | Faqat kompaniya, davlat, YaTT uchun. "O'zim uchun" tanlaganlardan **so'ralmaydi**. STIR ixtiyoriy, majburiy emas. |
| 7 | **Tayyor** | "Kompaniyangiz tayyor!" → darhol **"Birinchi vakansiyani joylashtiraylik"** tugmasi + "Keyinroq". |

**Muhim:** qurilma GPS'i kompaniya manzili deb yashirincha saqlanmaydi — foydalanuvchi tasdiqlagandagina.

### 2.3. Ish qidiruvchi yo'li

| Qadam | Ekran | Izoh |
|---|---|---|
| 1 | **Ism** | Telegram'dan oldindan to'ldirilgan, faqat tasdiqlash. |
| 2 | **Joylashuv** | Ruxsat → viloyat → tuman (yuqoridagi kabi). |
| 3 | **Kasb** | Kasb tanlagich (4-bo'lim). "Talabaman / tajribam yo'q" kartasi ham bor. |
| 4 | **Tajriba** | 4 ta karta: Tajribasiz · 1 yilgacha · 1–3 yil · 3+ yil. |
| 5 | **Kutilgan maosh** (ixtiyoriy) | "Kelishiladi" tugmasi bor. "Kelishiladi" — bu 0 emas. |
| 6 | **Tayyor** | Bosh sahifaga. |

Qolgan ma'lumotlar (ko'nikmalar, ta'lim, rasm, tillar) **keyin**, "E'lonimni to'ldirish" orqali, istalgan vaqtda.

---

## 3. ASOSIY EKRANLAR (DASHBOARD)

### 3.1. Ish beruvchi paneli

Yuqoridan pastga:

1. Salom + kompaniya nomi.
2. **Katta asosiy tugma:** "+ Vakansiya joylashtirish" (ekran kengligida).
3. **3 ta raqamli kartochka:** Faol vakansiyalar · Yangi arizalar · Mos nomzodlar. Har biri bosilsa — tegishli ro'yxatga.
4. **Bo'limlar (katta qatorlar, ikon + nom + son):**
   - Mening e'lonlarim (faol / qoralama / yopilgan)
   - Kelgan arizalar (yangi belgisi bilan)
   - Nomzodlar qidiruvi (soha va hudud bo'yicha)
   - Tarix (yopilgan e'lonlar, ishga olinganlar)
   - Xabarlar (chat)
   - Kompaniya profili
5. Pastki menyu (4 ta): Bosh sahifa · Nomzodlar · E'lonlarim · Profil.

### 3.2. Ish qidiruvchi paneli

1. Salom + ism.
2. **Ikkita juda katta karta** (ekranning yarmini egallaydi):
   - **"Bo'sh ish o'rinlarini ko'rish"**
   - **"Ish qidirish e'lonimni yaratish"** (holati: "Faol", "To'ldirilmagan" belgisi bilan)
3. Ostida kichik havolalar: Arizalarim · Saqlanganlar · Kelgan takliflar · Yordam.
4. **"Talabalar va tajribasizlar uchun"** kartasi → stajirovka, amaliyot, shogirdlik, darsdan keyingi ishlar.
5. "Sizga mos ishlar" (gorizontal ro'yxat).
6. Pastki menyu (4 ta): Bosh sahifa · Ishlar · Saqlanganlar · Profil.

---

## 4. KASBLAR KATALOGI — ENG MUHIM QATLAM

**Talab:** O'zbekistondagi barcha soha, kasb va hunarlar — ikir-chikirigacha. Kamida 40 ta yo'nalish, 1500+ kasb va ixtisoslik. Har bir kasb uchun: o'zbekcha (lotin + kirill), ruscha nom va **sinonimlar ro'yxati** (xalq tilida, xato yozilganlari bilan).

**Tuzilma — daraxt:** Soha → Guruh → Kasb → Ixtisoslik. Masalan:
- Ta'lim → O'qituvchilar → Ingliz tili o'qituvchisi
- Ta'lim → Avtomaktab → **Avtoinstruktor** (sinonim: "prava o'qituvchisi")
- Avtoservis → Avtomexanik → Karobka ustasi

**"Usta" muammosi:** foydalanuvchi "usta" deb bossa, ilova bitta kasbga majburlamaydi, avval **qaysi usta?** deb so'raydi:
`Avtomobil ustasi · Qurilish ustasi · Elektrik · Santexnik · Mebel ustasi · Maishiy texnika · Telefon ustasi · Boshqa usta` → so'ng aniq kasb.

Xuddi shunday: "o'qituvchi" → qaysi fan? "haydovchi" → qaysi toifa/transport? "operator" → qaysi soha?

**Tanlagich ekrani:**
- Tepada qidiruv (lupa): yozilishi bilan natija chiqadi.
- Ostida sohalar kartalari (ikon + nom).
- Har bosqichda "Orqaga" va yo'l ko'rsatgich (Ta'lim › O'qituvchilar).
- Eng pastda: **"Topilmadimi? O'zingiz yozing"** → matn + "qaysi sohaga yaqin?" → e'lon shu nom bilan chiqadi, matn ko'rib chiqish navbatiga tushadi (avtomatik katalogga qo'shilmaydi).

**Hududlar:** barcha 14 hudud, barcha tumanlar va shaharlar, rasmiy SOATO kodlari bilan. Manba va sana hujjatda yoziladi.

---

## 5. AQLLI QIDIRUV (AI)

1. **Har qanday yozuvni tushunadi:** "bugalter" → Buxgalter, "shafyor" → Haydovchi, "medsestra" → Hamshira, "prava oqituvchi" → Avtoinstruktor, "povar" → Oshpaz, "svarshik" → Payvandchi, "программист" → Dasturchi. Lotin, kirill, rus, aralash yozuv.
2. **Ishlash tartibi (tez va arzon):** avval bazadagi sinonimlar + noaniq (fuzzy) qidiruv → topilmasa AI faqat **bazadagi mavjud kasblar ro'yxatidan** tanlaydi. AI yangi kasb, vakansiya yoki kompaniya o'ylab topmaydi. AI ishlamasa ham oddiy qidiruv ishlaydi.
3. **Natija tartibi:** avval foydalanuvchiga **eng yaqin** e'lonlar (masofa yoki "Siz bilan bir tumanda"). Soxta kilometr yozilmaydi; masofaviy ishga masofa ko'rsatilmaydi.
4. **Uzoqroq ishlamoqchi bo'lsa:** "Hudud" tugmasi → viloyatlar kesimida tanlash. Tanlangan hudud har doim GPS'dan ustun.
5. **Filtrlar** (pastdan chiqadigan oyna, oddiy): Soha · Hudud · Maosh · Ish turi (doimiy, vaqtinchalik, bir martalik, mavsumiy, stajirovka, amaliyot, shogirdlik) · Grafik · Tajribasiz · Talabalarga mos · Davlat tashkiloti.
6. **Moslik foizi ko'rsatilmaydi** — o'rniga sabablar: "Kasbingiz mos", "Sizga yaqin", "Tajribasiz qabul qilinadi".

---

## 6. VAKANSIYA YARATISH (ilova o'zi yetaklaydi)

| Qadam | Savol |
|---|---|
| 1 | Qanday xodim kerak? (kasb tanlagich, "usta" aniqlashtiriladi, o'zi yozish mumkin) |
| 2 | Qancha odam kerak? (1 · 2 · 3 · 5+ ) |
| 3 | Ish turi (doimiy · muddatli · bir martalik · mavsumiy · stajirovka · amaliyot · shogirdlik) |
| 4 | Grafik (to'liq kun · yarim kun · smenali · masofaviy · moslashuvchan) |
| 5 | Maosh: summa yoki oraliq + davr (oylik · kunlik · soatlik · ish uchun) yoki **"Kelishiladi"**. Stajirovkada "Haq to'lanadimi?" alohida savol. |
| 6 | Talablar: tajriba, til, guvohnoma (kasbga qarab — haydovchiga "Prava toifasi?", buxgalterga "1C bilasizmi?") |
| 7 | Ish joyi (kompaniya manzili oldindan belgilangan, o'zgartirish mumkin) |
| 8 | Qo'shimcha izoh (ixtiyoriy) — AI qisqa tavsif taklif qiladi, foydalanuvchi tahrirlaydi |
| 9 | **Ko'rib chiqish** → "E'lon qilish" |

E'lon qilingach: "E'loningiz faol! Mos nomzodlar: 12 ta" → nomzodlar ro'yxatiga.

---

## 7. ARIZA VA TAKLIF

- Ishchi "Ariza berish" — bitta bosish. Ikki marta bosish, sahifani yangilash yoki ikki oyna **dublikat ariza yaratmaydi**.
- Holatlar: Yuborildi · Ko'rildi · Suhbatga taklif · Ishga olindi · Mos kelmadi. Faqat haqiqiy voqeaga bog'lanadi.
- Ish beruvchi qidiruvdan nomzodga **taklif** yuborishi mumkin (alohida obyekt). Nomzod qabul qiladi yoki rad etadi.
- Telefon raqami faqat nomzod ruxsat bersa ko'rinadi.
- Yopilgan vakansiyaga yangi ariza qabul qilinmaydi va tushunarli xabar chiqadi.

---

## 8. O'RGATISH VA YORDAM

1. **Interaktiv tanishtiruv (coach marks):** birinchi kirishda ekran xiralashadi, har bir muhim tugma alohida yoritiladi va 1 jumla bilan tushuntiriladi ("Bu yerda vakansiyalarni ko'rasiz"). "Keyingi" / "O'tkazib yuborish". Har rol uchun alohida, 4–6 qadam.
2. **Yordam sahifasi:** savol-javob, oddiy til, rasmlar bilan. Turni qayta ochish tugmasi.
3. **Video qo'llanmalar:** har asosiy yo'l uchun 30–60 soniyalik video (uz, uz-kirill, ru). Video tayyor bo'lmaguncha joyi bo'sh qoladi va "tez orada" deb yoziladi — **soxta havola qo'yilmaydi**.
4. Har bo'sh ekranda (natija yo'q, e'lon yo'q) — nima qilish kerakligini aytadigan matn va tugma.

---

## 9. TEXNIK TALABLAR

- **Stack:** mavjud loyiha (Next.js App Router + Supabase Postgres + Telegram Mini App). Yangi texnologiya faqat sababi bo'lsa.
- **Xavfsizlik:** RLS hamma jadvalda; mijozdan kelgan rolga ishonilmaydi; service role kaliti faqat serverda; Telegram bot tokeni faqat serverda; kalitlar repoga yozilmaydi.
- **Admin panel — alohida ilova** (alohida domen yoki loyiha). Asosiy ilovada admin sahifa yoki tugma umuman yo'q. Admin uchun API kontraktlari tayyorlab qo'yiladi.
- **To'lovlar keyin.** Kod bayroq (feature flag) ortida, hozir o'chiq. Ilovada narx, paywall, checkout ko'rinmaydi.
- **Xalqaro tayyorgarlik:** `country_code`, til fayllari, valyuta, hududlar daraxti — hammasi konfiguratsiyadan. Yangi davlat qo'shish = ma'lumot qo'shish, kod qayta yozish emas.
- **Tillar:** uz-Latn, uz-Cyrl, ru — barcha matnlar to'liq tarjima qilingan; qattiq yozilgan matn yo'q.
- **Tezlik:** Telegram ichida birinchi ekran 2 soniyadan tez; sekin internetda ham ishlaydi.
- **Deploy:** Telegram bot menyusi va `APP_URL` **doimiy domenga** ulanadi (bitta deployga bog'langan tasodifiy URL emas), aks holda Mini App yangilanmaydi.
- **Migratsiyalar:** toza bazada boshidan oxirigacha ishlaydi, qayta ishga tushirilsa dublikat bermaydi.

---

## 10. QABUL SINOVLARI (hammasi real ikki hisob bilan tekshiriladi)

1. Birinchi ochilishda: til → rol. Tayyor foydalanuvchida onboarding qayta chiqmaydi.
2. Kirishda SMS kod yoki parol so'ralmaydi; soxta/eskirgan Telegram ma'lumoti bilan kirib bo'lmaydi.
3. Joylashuv rad etilsa, viloyat → tuman qo'lda tanlanadi va davom etadi.
4. Toshkent shahri / viloyati va bir xil nomli shahar/tumanlar adashmaydi.
5. "O'zim uchun" ish beruvchidan kompaniya nomi so'ralmaydi.
6. Ish qidiruvchi bosh sahifasida aynan 2 ta katta karta aniq ko'rinadi.
7. "usta" → yo'nalish tanlash → aniq kasb. "prava oqituvchi" → Avtoinstruktor, "medsestra" → Hamshira, "bugalter" → Buxgalter.
8. Katalogda yo'q kasb qo'lda yoziladi, e'lon chiqadi, matn navbatga tushadi.
9. AI o'chirilganda qidiruv, filtr va e'lon yaratish ishlaydi.
10. Vakansiya e'lon qilinadi → boshqa qurilmada ko'rinadi → ariza beriladi → ish beruvchida chiqadi → javob nomzodda ko'rinadi.
11. Dublikat ariza yaratib bo'lmaydi.
12. A kompaniya B kompaniyaning arizalarini ko'ra olmaydi.
13. Maosh: oylik/kunlik/soatlik va "Kelishiladi" to'g'ri saqlanadi.
14. Talaba tajribasiz e'lon yaratadi va stajirovkaga ariza beradi; to'lanadigan va to'lanmaydigan amaliyot aralashmaydi.
15. Wizard o'rtasida ilova yopilsa, ma'lumot yo'qolmaydi.
16. 360–430px ekranda va Telegram ichida barcha tugmalar bosiladi, klaviatura tugmani yopmaydi.
17. Tanishtiruv o'tkazib yuboriladi va yordamdan qayta ochiladi.
18. Ilovada admin sahifa, to'lov va chet el bozori yo'q.
19. Uch tilda barcha ekranlar to'liq tarjima qilingan.
20. Bot menyusidagi Mini App oxirgi deploy qilingan versiyani ochadi.

---

## 11. ISH TARTIBI (agent uchun)

1. Avval mavjud kodni o'rgan; ishlab turgan narsani sababsiz buzma.
2. Bosqichma-bosqich qur — har bosqich oxirida foydalanuvchi **o'z telefonida ko'rib** tekshira oladigan natija bo'lsin:
   - **1-bosqich:** kirish + til + rol + joylashuv (ikkala rol).
   - **2-bosqich:** ish beruvchi paneli + vakansiya yaratish.
   - **3-bosqich:** ish qidiruvchi paneli + qidiruv + ariza.
   - **4-bosqich:** kasblar katalogi to'liq + AI qidiruv.
   - **5-bosqich:** tanishtiruv, yordam, talabalar bo'limi, sayqal.
3. Har bosqichda: TypeScript, lint, testlar, build — toza. Keyin deploy va Telegram'da tekshirish.
4. Har kichik qadamda "davom etaymi?" deb so'rama. Faqat haqiqatan foydalanuvchi qaror qilishi kerak bo'lganda so'ra.
5. **Halol hisobot:** har bosqich oxirida qisqa ro'yxat — ✅ tayyor / 🟡 qisman / ⛔ bloklangan (sababi bilan). "Hammasi mukammal" deb yozma. Real odamlar bilan sinov o'tkazilmagan bo'lsa, o'tkazilgandek yozma.
6. Foydalanuvchiga faqat o'zbek tilida, sodda so'zlar bilan javob ber.

---

## 12. KEYINGI BOSQICHLAR (hozir qilinmaydi, lekin yo'l ochiq qoladi)

To'lovlar (Payme, Click) · TOP e'lonlar · alohida admin ilova · Android/iOS ilova · Qozog'iston, Qirg'iziston, Tojikiston va boshqa bozorlar · ingliz tili · ish beruvchi reytingi.
