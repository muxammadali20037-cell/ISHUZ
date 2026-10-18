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
- **Kompozitsiya.** Asosiy obyekt markazda bo'lsin: rasm ekranda burchaklari yumaloqlangan holda kesiladi.
  «Tanishtiruv 1» va «Tanishtiruv 2» kompyuterdagi bosh sahifada ham chiqadi — 256×240 (deyarli kvadrat), pastki chap
  burchagida yozuv bilan. Shuning uchun chetlari va chap pastki burchagi muhim bo'lmasin.
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

## Generatsiya prompti

Har bir joy uchun tayyor promptlar, taqiqlar ro'yxati va yuklashdan oldingi tekshiruv — `IMAGE_PROMPTS.md`, A bo'limi.
Ilovadagi boshqa rasm joylari ham o'sha hujjatda.

## Texnik tafsilotlar

- Sozlama: `app_settings.entry_media` (ochiq o'qiladi) — `{ "intro_jobs": "site-media/entry/v-<sha256>.webp", … }`.
  Faqat o'z storage'imizdagi qayta kodlangan fayl yo'li qabul qilinadi (`src/features/entry/media.ts`). Tashqi URL
  qabul qilinmaydi.
- Kesh: 5 daqiqa, admin saqlaganda darhol yangilanadi (`updateTag("entry-media")`).
- Migratsiya kerak emas: sozlama qatori birinchi saqlashda yaratiladi (RLS: `settings.manage`).
