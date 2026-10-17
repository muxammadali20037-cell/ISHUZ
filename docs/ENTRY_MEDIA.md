# Kirish ekranlari rasmlari — suratga olish va generatsiya qo'llanmasi

Kirish oqimidagi 5 ta rasm admin panelda almashtiriladi: **Admin → Kontent → Kirish ekranlari** (`/admin/entry`, ruxsat:
`settings.manage`). Har bir joyga alohida fayl yuklanadi. Server faylni tekshiradi (magic bytes, piksel) va metama'lumotsiz
WebP'ga o'tkazadi. Rasm saytda darhol ko'rinadi, har bir o'zgarish audit jurnaliga yoziladi. Rasm yuklanmagan joyda
o'rnatilgan brend tasviri ko'rinadi: sodda, faqat brend ranglari, tarmoqsiz ochiladi.

Repoda tayyor fotosurat yo'q. Bu muhitdan tashqi foto banklarga ulanib bo'lmaydi, shuning uchun haqiqiy suratlarni admin o'zi
yuklaydi. Quyida har bir joy uchun nima kerakligi yozilgan.

## Umumiy talablar

- **Haqiqiy, hujjatli uslub.** Odamlar tabiiy holatda bo'lsin: kamera bilan to'qnash kulib turgan "stok" poza emas,
  ish ustidagi lahza. O'zbekistonga xos muhit: Toshkent ko'chasi, do'kon, ustaxona, ofis, bozor, qurilish maydoni.
- **Yorug'lik.** Tabiiy kunduzgi yoki oddiy xona yorug'ligi. Kuchli rangli neon, "kino" filtri va haddan tashqari
  kontrast bo'lmasin.
- **Rang.** Kiyim yoki fonda ko'k (brend rangi) bo'lsa yaxshi, lekin majburiy emas. Rasm ustiga matn va logotip qo'shmang:
  matn ekranning o'zida bor.
- **Kompozitsiya.** Asosiy obyekt markazda yoki biroz chapda bo'lsin: rasm ekranda burchaklari yumaloqlangan holda
  kesiladi.
- **Ruxsat.** Rasmdagi odamlarning roziligi bo'lsin (model release). Begona logotip, avtomobil raqami, hujjat matni
  ko'rinmasin.
- **Fayl.** JPG, PNG yoki WebP, 4 MB gacha. Brauzer yuklashdan oldin 1600 px gacha kichraytiradi.

## Joylar

| Joy (admin) | Ekran | Nisbat | Kamida | Mazmun |
|---|---|---|---|---|
| Tanishtiruv 1 — ish topish | 3-ekran "Ish topish endi osonroq" | 4:3 | 1200×900 | Ish qidirayotgan yosh odam |
| Tanishtiruv 2 — ishchi topish | 4-ekran "Ishchi topish bir joyda" | 4:3 | 1200×900 | Ish beruvchi nomzod bilan suhbatda |
| Tanishtiruv 3 — mos imkoniyatlar | 5-ekran "AI yordamchingiz…" | 4:3 | 1200×900 | Telefonda mos e'lonni ko'rayotgan odam |
| Rol kartasi — ish qidiryapman | 7-ekran, 1-karta | 1:1 | 800×800 | Bitta odam, yuz va yelka |
| Rol kartasi — ishchi qidiryapman | 7-ekran, 2-karta | 1:1 | 800×800 | Rahbar yoki do'kon egasi, yuz va yelka |

## Suratga olish ro'yxati (haqiqiy fotosessiya uchun)

1. **Tanishtiruv 1.** 20–28 yoshli yigit yoki qiz Toshkent ko'chasida yoki kafeda o'tirib telefoniga qarab turibdi.
   Yelkasida ryukzak bor. Kamera ko'z balandligida, 35–50 mm, orqa fon biroz xira. Telefon ekrani ko'rinmasa ham bo'ladi.
2. **Tanishtiruv 2.** Kichik ofis yoki do'konda ish beruvchi (35–50 yosh) stol ortida nomzod bilan gaplashmoqda,
   qo'lida planshet yoki qog'oz. Ikkalasi kadrda, ish beruvchi kameraga yaqinroq.
3. **Tanishtiruv 3.** Usta yoki sotuvchi tanaffusda telefoniga qarab mamnun jilmaymoqda (ish kiyimida). Yaqin plan,
   ekran yorug'ligi yuziga tushib turibdi.
4. **Rol: ish qidiryapman.** Bitta odamning portreti, yelkagacha, oddiy kiyimda, neytral och fonda, kameraga
   tabiiy qarab turibdi.
5. **Rol: ishchi qidiryapman.** Kostyum yoki toza ish kiyimidagi rahbar, yelkagacha, ofis yoki do'kon fonida.

## Generatsiya prompti (fotoreal model uchun)

Haqiqiy suratga olish imkoni bo'lmasa, quyidagi promptlar fotoreal model uchun yozilgan (inglizcha — modellar uni yaxshiroq
tushunadi). Har biriga **umumiy qo'shimcha** va **taqiqlar** qismini qo'shing.

**Umumiy qo'shimcha:**
`documentary photograph, shot on a full-frame camera with a 35mm lens, natural daylight, realistic skin texture with
pores and small imperfections, candid moment, slight film grain, true-to-life colors, Central Asian (Uzbek) people,
everyday clothing, Tashkent, Uzbekistan`

**Taqiqlar (negative prompt):**
`3d render, cartoon, illustration, anime, CGI, plastic skin, airbrushed, overly smooth face, perfect symmetry,
glowing edges, neon lights, cinematic teal-orange grading, text, watermark, logo, extra fingers, distorted hands,
robot, holograms, floating UI elements`

1. **intro_jobs (4:3):**
   `a young Uzbek man in his twenties with a backpack sitting at a street cafe table in Tashkent, looking at his
   smartphone while searching for jobs, relaxed posture, morning light, shallow depth of field, city street softly
   blurred behind him`
2. **intro_workers (4:3):**
   `a small business owner in her forties interviewing a young job candidate in a bright small office in Tashkent,
   holding a tablet, both seated at a wooden desk, natural window light, genuine conversation, medium shot`
3. **intro_ai (4:3):**
   `a mechanic in a clean blue work uniform taking a short break in a car service workshop, smiling while reading a
   message on his phone, warm natural light from an open garage door, close-medium shot`
4. **role_worker (1:1):**
   `head-and-shoulders portrait of a young Uzbek woman in casual clothes, neutral light grey background, soft natural
   light, calm confident expression, looking at the camera`
5. **role_employer (1:1):**
   `head-and-shoulders portrait of an Uzbek shop owner in his forties wearing a neat shirt, standing in his small store,
   background softly blurred, soft natural light, friendly professional expression`

**AI ko'rinishini tekshirish (yuklashdan oldin):** qo'l barmoqlari, ko'zlar, tishlar, yozuvlar va orqa fondagi narsalar
tabiiy bo'lishi kerak. Teri haddan tashqari silliq bo'lmasin, yorug'lik bir tomondan tushsin. Shubha bo'lsa — boshqa
variantni tanlang yoki haqiqiy surat oling.

## Texnik tafsilotlar

- Sozlama: `app_settings.entry_media` (ochiq o'qiladi) — `{ "intro_jobs": "site-media/entry/v-<sha256>.webp", … }`.
  Faqat o'z storage'imizdagi qayta kodlangan fayl yo'li qabul qilinadi (`src/features/entry/media.ts`). Tashqi URL
  qabul qilinmaydi.
- Kesh: 5 daqiqa, admin saqlaganda darhol yangilanadi (`updateTag("entry-media")`).
- Migratsiya kerak emas: sozlama qatori birinchi saqlashda yaratiladi (RLS: `settings.manage`).
