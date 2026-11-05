# Ish topdim — mahsulot rejasi va bosqichlar hisoboti (2026-11-05)

Egasi 2026-11-05 da "ISH TOPDIM — COMPLETE PRODUCT UI/UX MASTER PROMPT" (10 bosqich), "REAL PHOTOGRAPHY & VISUAL JOB
CATALOG REQUIREMENTS", namuna ekranlar va 8 ta ish joyi suratini berdi: "logotipni ham o'zgartirish kerak; Ish topdim haqiqiy
mahsulotga yetguncha jamoadasan". Bu hujjat — har bosqich oxirida talab qilingan hisobot (nima qilindi, nima yaxshilandi, nima
qoldi, ma'lum xatolar, keyingi qadam). Tarmoq: `claude/brend-foto` (asosi `claude/sat-uslub`).

## 1-bosqich — audit (mavjud loyiha va spetsifikatsiya)

Texnologiya o'zgarmaydi: Next.js 16 (App Router, RSC, server actions), TypeScript, Tailwind v4 tokenlari, Supabase (RLS,
SECURITY DEFINER funksiyalar), Telegram Mini App, Vercel. 73 ta migratsiya, ~95 ta sahifa, 4 til (uz, oz, ru, en).

**Tayyor (spetsifikatsiyaning katta qismi allaqachon ishlaydi):** ommaviy sayt (bosh sahifa, vakansiyalar ro'yxati va sahifasi,
kompaniyalar, qidiruv, narxlar, biz haqimizda, yordam, maxfiylik, shartlar), kirish (telefon + SMS kod, Telegram; parol yo'q —
ataylab), rol tanlash va bitta hisobda ikkala rol, ish izlovchi kabineti (profil, CV va PDF, arizalar va ariza sahifasi,
saqlanganlar, xabarlar, bildirishnomalar, sozlamalar, telefon maxfiyligi), ish beruvchi kabineti (kompaniya, vakansiya
yaratish/tahrirlash/oldindan ko'rish, arizalar bosqichlari, nomzodlar, saqlangan nomzodlar, xabarlar, to'lovlar), admin panel
(foydalanuvchilar, ish beruvchilar, vakansiyalar, moderatsiya, shikoyatlar, tasdiqlash, to'lovlar, kategoriyalar, kontent,
analitika, audit jurnali, sozlamalar), ishonch (kompaniya tasdig'i, moderatsiya, e'lon haqida xabar berish, bloklash, telefon
faqat ruxsat bilan — bazada majburlangan), SEO (sarlavha/tavsif, sitemap, robots, JobPosting JSON-LD, canonical), holatlar
(~45 ta yuklanish skeleti, bo'sh va xato holatlari, oflayn sahifa).

**Haqiqiy kamchiliklar (eng muhimi birinchi):**

| # | Kamchilik | Qayerda |
|---|---|---|
| 1 | Ariza — bitta oyna va bitta matn maydoni; spetsifikatsiyadagi 3 qadam (shaxsiy ma'lumot · tajriba · ko'rib chiqish va rozilik), rezyume biriktirish yo'q | `features/jobs/components/vacancy-actions.tsx` |
| 2 | Arizada maxfiylik roziligi belgisi yo'q; motivatsiya xati chegarasi 1000 (spetsifikatsiya — 500) | o'sha joy, `features/jobs/limits.ts` |
| 3 | Oddiy e'lon oqimida (`/post/vacancy`) vazifalar, talablar va imtiyozlar alohida maydon emas; vakansiya sahifasida ham alohida bo'lim yo'q | `features/post`, `vacancy-detail.tsx` |
| 4 | E'lon qadamlari spetsifikatsiyadagi 4 qadamdan farq qiladi (1-qadamda nom · soha · joy emas); har maydonda izoh yo'q | `features/post/components/vacancy-post.tsx` |
| 5 | Adminda arizalar ro'yxati yo'q; kompaniyalar va shikoyatlar alohida sahifa emas | `app/admin/(panel)` |
| 6 | Alohida "Aloqa" sahifasi yo'q (aloqa — "Biz haqimizda" va footerda, env sozlangan bo'lsa) | — |
| 7 | Ish beruvchi statistikasi — faqat 3 ta son va ko'rishlar; alohida sahifa va dinamika yo'q | `features/employer` |
| 8 | Ko'p sahifalarda o'z OG sarlavhasi yo'q; narxlar sahifasi sitemap va canonical'siz | `app/pricing` |
| ✓ | ~~Kasblar katalogi sahifasi yo'q~~ — **qilindi** (`/kasblar`, pastda) | |
| ✓ | ~~`/jobs` kartasida tajriba yo'q~~ — **qilindi** (`VacancyCard`) | |
| ✓ | ~~Standart OG rasmi yo'q~~ — **qilindi** (`public/brand/og-default.png`) | |

## 2-bosqich — brend va dizayn tizimi (bajarildi)

- **Logotip "Darvoza"** — `docs/BRAND_UI_GUIDE.md` 1.2: ravoq (peshtoq) + ✓; asosiy (tik), gorizontal, to'q fon uchun, faqat
  belgi, favicon (SVG + ICO 16/32/48), ilova belgilari (192/512, maskable, iPhone), OG rasmi. Hammasi bitta skriptdan
  (`scripts/brand/build-brand.py`, `rasterize.mjs`), yozuv konturda. Komponentlar — inline SVG (rasm yuklanmaydi).
  Ko'rib chiqish uchun yana 2 variant tayyorlangan ("Qidirdim → topdim" lupa va "Odam va o'sish belgisi"); egasi boshqasini
  tanlasa — o'zgarish bitta geometriyada.
- **Ranglar** spetsifikatsiyadan: `#1455D9` asosiy, `#3478F6` yorqin (fokus), `#16A36A` yashil (faqat belgi), fon `#F7F9FC`,
  matn `#101828`, ikkinchi matn `#636C81` (`#667085` WCAG AA dan o'tmagani uchun bir pog'ona to'qroq), chegara `#E5EAF2`.
  Kontrast testi (`brand-contrast.test.ts`) yangi juftlar bilan.
- Shrift — Inter (matn) + Geist (sarlavha), o'zimizda. Radius, soya, komponentlar — mavjud tizim (`components/ui/*`).

## 3-bosqich — ommaviy sahifalar: bosh sahifa va kasblar katalogi (bajarildi)

Egasi bergan tartibda: sarlavha → hero (katta haqiqiy surat) → qidiruv → ommabop kasblar (suratli) → tanlangan vakansiyalar →
yangi vakansiyalar → ishonchli ish beruvchilar → ish beruvchilar uchun → qanday ishlaydi → footer.

| Bo'lim | Nima | Haqiqiylik qoidasi |
|---|---|---|
| Hero | "Ish toping. Yoki jamoangizga odam toping.", "Men ish qidiryapman" / "Menga ishchi kerak", uch maydonli qidiruv (kasb yoki lavozim · hudud · ish turi), tezkor filtrlar; kompyuterda katta surat va ustida 2 ta raqam | raqamlar bazadan, 0 bo'lsa — yo'q; surat admin almashtira oladi (`home_photo`) |
| Ommabop kasblar | 4:3 suratli kartalar (telefon 2, planshet 3, kompyuter 4 ustun), har birida soha nomi va faol vakansiyalar soni; surati yo'q sohalar — "Boshqa kasblar" kartasida (har biri havola) | sonlar `home_market_counts` dan; surat — egasi bergan yoki admin yuklagan |
| `/kasblar` | Suratli kartalar + ma'lumotnomadagi barcha faol sohalar (son bilan, ko'pi birinchi) | sitemap'da, canonical, OG |
| Tanlangan vakansiyalar | 2–4 ustunli to'r: logo, lavozim, kompaniya (tasdiq belgisi), joy, maosh, ish turi, soha, tajriba, sana, saqlash | qoida ekranda yozilgan: tasdiqlangan ish beruvchilardan, maoshi ko'rsatilgan (TOP birinchi); ular kam bo'lsa — maoshi ko'rsatilgan e'lonlar; 2 tadan kam — bo'lim yo'q |
| Yangi vakansiyalar | Ro'yxat: logo, lavozim, kompaniya, shahar, ish turi, maosh, sana, saqlash | xato — "bo'sh" emas, tushuntirish va "Qayta urinish" |
| Ishonchli ish beruvchilar | Faqat tasdiqlangan va hozir xodim qidirayotgan kompaniyalar + uchta haqiqiy himoya qoidasi | soxta logo yo'q (logo bo'lmasa — bosh harflar) |

Olib tashlangan bo'limlar (spetsifikatsiya tartibida yo'q): "Yangi ishlar" filtrlari (`?ish=`), AI ko'rgazmasi, ishchilar
ko'rinishi, "Platforma raqamlarda", yakuniy chaqiruv. Funksiyalarning o'zi joyida (AI — heroda "AI bilan qidirish",
ishchilar — "Ish beruvchilar uchun" bo'limidan).

### Suratlar

| Surat (egasi bergan) | Qayerda | Holati |
|---|---|---|
| Qurilish ishchisi (sariq kaska) | Hero | ishlatildi (4:5) |
| Shifokor · O'qituvchi va sinf · Supermarket xodimi · Oshpaz · Avtoservis ustasi · Dehqon (paxta dalasi) | Katalog: Tibbiyot, Ta'lim, Savdo, Oshpazlik, Avtoservis, Qishloq xo'jaligi | ishlatildi (4:3, metama'lumotsiz, `scripts/photos/build-photos.py`) |
| Yetkazib beruvchi (furgon oldida) | — | **ishlatilmadi:** burchagida boshqa saytning belgisi bor — boshqa saytdan olingan bo'lishi mumkin. Spetsifikatsiya talabi: suv belgisisiz, tijoriy foydalanishga ruxsatli. Kesib yashirilmadi |

Kerak (admin → Kontent → Kirish ekranlari → "Kasblar katalogi", 4:3, 1200×900, odam markazda, yozuvsiz, tijoriy
foydalanishga ruxsatli): **Qurilish** (hero'dagidan boshqa), **Transport**, **Yetkazib berish**, **Ishlab chiqarish**,
**IT va dasturlash**, **Omborxona**, **Boshqaruv**, **Xizmat ko'rsatish**. Yuklangan zahoti kartasi bosh sahifada va `/kasblar`
da paydo bo'ladi (kod o'zgarmaydi). Dehqon surati Gemini bilan yasalgan (burchakdagi belgi kesimga tushmaydi); boshqa suratlarning
huquqi — egasi tomonidan tasdiqlanishi kerak.

## Ma'lum xatolar va cheklovlar

- Rasm optimallashtirishda AVIF yoqilmadi: lokal stendda sharp AVIF kodlashi bir o'lchamda osilib qoldi (WebP — ishonchli).
- "Tanlangan" uchun alohida tahririyat tanlovi yo'q (haqiqiy qoida bo'yicha). Admin qo'lda tanlashi kerak bo'lsa — TOP mexanizmi.
- Production bazasida 0069–0073 migratsiyalari hali qo'llanmagan: "Ishonchli ish beruvchilar" ro'yxati (0071 `public_companies`)
  ularsiz faqat himoya qoidalarini ko'rsatadi (sahifa buzilmaydi).

## Keyingi qadamlar (taklif etilgan tartib)

1. **4-bosqich (kirish) — o'zgarish kam:** telefon + kod va Telegram ishlaydi; profilni to'ldirish oqimini spetsifikatsiya
   matnlari bilan tekshirish.
2. **5-bosqich (ish izlovchi): 3 qadamli ariza** — 1) ism, telefon (tasdiqlangan, o'zgartirib bo'lmaydi), CV biriktirish
   (mavjud CV yoki fayl), 2) tajriba bor/yo'q, yillar, oldingi lavozim, xat (≤ 500), 3) ko'rib chiqish va maxfiylik roziligi;
   qadamlar orasida ma'lumot saqlanadi, takroriy ariza bazada bloklangan (mavjud). Migratsiya kerak (ariza maydonlari).
3. **6-bosqich (ish beruvchi): e'lonni 4 qadamga keltirish** (nom · soha · joy → maosh · bandlik · grafik · tajriba →
   vazifalar · talablar · imtiyozlar → ko'rib chiqish va joylash), har maydonda oddiy o'zbekcha izoh; vakansiya sahifasida
   "Vazifalar" va "Talablar" alohida. Migratsiya kerak (2 ta matn maydoni).
4. **7-bosqich (admin):** arizalar ro'yxati, kompaniyalar va shikoyatlar alohida; statistikaning dinamikasi.
5. Aloqa sahifasi; qolgan sahifalarga OG sarlavhalari; narxlar sahifasi sitemap va canonical.
