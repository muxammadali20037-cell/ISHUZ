# Bosh sahifa (marketplace) — talab va bajarilishi

**Kimga ko'rinadi:** mehmon yoki rejim (ish izlovchi / ish beruvchi) tanlamagan foydalanuvchi.

**Rejim tanlangach:** o'sha rolning bosh sahifasi ochiladi — `seeker-home.tsx` / `employer-home.tsx`. Ular avvalgidek
ishlaydi; pastki qism (footer) uchala ko'rinishda bir xil.

**Kod:** `src/features/landing/market/*`.

**Sahifa:** `src/app/page.tsx`. Footer `<main>` dan tashqarida joylashgan — `Shell footer` prop'i orqali.

## Qoidalar

- Hamma son va ro'yxat bazadan olinadi. Xato bo'lsa son ko'rsatilmaydi yoki tushuntirish bilan «Qayta urinish» chiqadi.
- Bo'sh ro'yxat «yo'q» deb aytiladi va keyingi qadamlar taklif qilinadi.
- Soxta vakansiya, ish beruvchi, raqam, sharh yoki logotip yo'q.
- Tugma va havolalar mavjud oqimlarga olib boradi:
  - qidiruv — `/search`;
  - sohalar — `/jobs?category=`;
  - e'lon berish — `/post/vacancy` (kirish joylashda so'raladi va qaytariladi);
  - ishchilar — `/search?mode=workers`.
- «Ish qidiraman», «Xodim qidiraman», tezkor filtrlar va ish beruvchi tugmalari mavjud `enterMode` formasi orqali ishlaydi:
  - rejim yoziladi va kerakli joyga o'tiladi;
  - JS'siz ham ishlaydi.

## Bo'limlar

| Talab | Bajarilishi | Ma'lumot manbai |
|---|---|---|
| Sarlavha (header) | **Kompyuter (md+):** Bosh sahifa · Ishlar · Ishchilar · Xizmatlar · Biz haqimizda.<br>**«Xizmatlar»** (`/pricing`) faqat `BILLING_ENABLED=true` bo'lganda chiqadi — o'lik havola yo'q.<br>**O'ng tomonda:** til, «Kirish», «Ro'yxatdan o'tish» (rol → telefon → profil).<br>**Telefonda:** ixcham sarlavha va «Menyu» (Ishchilar, Biz haqimizda, Yordam, Ro'yxatdan o'tish). Pastki menyu (ilova bo'limlari) o'zgarmagan.<br>**Bildirishnoma belgisi** faqat kirgan foydalanuvchida. | `components/shared/site-nav.tsx`, `top-bar.tsx`, `shell.tsx` |
| Hero | Sarlavha, tavsif, ikki yo'l. Tugmalarda haqiqiy son: faol vakansiyalar / ishchi e'lonlari.<br>Kompyuterda o'ngda rasmlar: admin → Kirish ekranlari; yuklanmagan bo'lsa — o'rnatilgan tasvir. Telefonda rasm yo'q. | `getEntryStats` (qidiruv bilan bir xil qoida) |
| Qidiruv paneli | Kasb (matn), hudud (viloyatlar ma'lumotnomadan + «Butun O'zbekiston», «Masofaviy»), ish turi (kunlik yoki grafik), maosh (oyiga, dan).<br>Server action qiymatlarni tekshiradi va `/search` ga yo'naltiradi. Viloyat tanlansa, `/search` keyingi qadamda tumanni so'raydi (mavjud oqim). | `market/actions.ts`, `market/model.ts` (`heroSearchHref`, unit test) |
| Tezkor filtrlar | Kunlik ishlar · Tajribasizlar uchun · Masofaviy ish · Yangi vakansiyalar (`/jobs?sort=newest`) · Yaqin atrofda.<br>«Yaqin atrofda» — mavjud joylashuv oqimi; ruxsat bo'lmasa ro'yxatdan tanlanadi. | `quick-filters.ts` |
| Ishonch qatori | **Tekshiruv:** har bir e'lon qidiruvga chiqishdan oldin avtomatik tekshiriladi, shubhalisini moderator ko'radi (0049).<br>**Maosh:** miqdor va to'lov davri.<br>**Aloqa:** qo'ng'iroq / ariza / xabar — e'lon egasi ruxsat bergan usulda.<br>**Yordam markazi:** `/help`. «24/7» va'dasi yo'q. | — |
| Sohalar | Ma'lumotnomadagi haqiqiy sohalar: 12 tasi ko'rinadi, qolgani «Barcha kategoriyalar (N)» ichida (`<details>`, JS'siz).<br>Son — faol, muddati o'tmagan vakansiyalar (qidiruv qoidasi). 0 yoki noma'lum bo'lsa son yozilmaydi. | `0067 home_market_counts()` (SECURITY INVOKER) |
| Yangi ishlar | Filtrlar: Barcha · Kunlik · Masofaviy · Tajribasizlar uchun (`?ish=`, URL'da saqlanadi).<br>6 ta haqiqiy karta: sarlavha, maosh va davri, ish beruvchi, tasdiq belgisi (faqat tasdiqlangan), joy, grafik, sana.<br>Holatlar: skelet, bo'sh (sabab + «Barcha ishlar», «Sohalar», «Vakansiya joylashtirish»), xato («Qayta urinish»).<br>Ostida «Barcha ishlarni ko'rish» — o'sha filtr bilan `/search`. | `findJobs` |
| Ish beruvchilar | «E'lon joylashtirish», «Xodimlarni ko'rish». Bepul/pullik haqida da'vo yo'q. | — |
| Ishchilar | Faqat ochiq ishchi e'lonlari. Telefon qidiruvdagi ruxsat qoidasi bilan. Bo'lmasa — «O'zingiz haqingizda e'lon bering». | `getNewWorkers` |
| Qanday ishlaydi | Ikki karta (ish izlovchi / ish beruvchi). Qadamlar mavjud oqimga mos. | — |
| Nega Ish topdim | To'rt tamoyil. Sohalar soni ma'lumotnomadan. Kafolat va'dalari yo'q. | `getCategories` |
| Raqamlar | Faol vakansiyalar, faol ish beruvchilar (kamida bitta faol vakansiya), ishchi e'lonlari, bugun qo'shilganlar.<br>Har birining ta'rifi bor; keshi ~10 daqiqa. 0 bo'lgani ko'rsatilmaydi. Hammasi 0 bo'lsa — maqsad matni chiqadi. | `getEntryStats`, `home_market_counts` |
| Footer | To'q ko'k fon. Bo'limlar: ish izlovchilarga · ish beruvchilarga · kompaniya va yordam · til.<br>«Aloqa» — `SUPPORT_EMAIL` bo'lsa; Telegram — rasmiy bot sozlangan bo'lsa. Ijtimoiy tarmoq havolalari yo'q (rasmiy akkaunt ma'lum emas). | `market/site-footer.tsx` |
| Biz haqimizda | `/about`: nima qilamiz, ishonch, «ochiq aytamiz» (kafolat yo'q), aloqa (faqat sozlangan kanallar). | `src/app/about/page.tsx` |
| SEO | Sarlavha «Ish topdim — O'zbekistonda ish topish va xodim qidirish», tavsif, canonical (filtrsiz `/`), Open Graph, bitta h1. Mavjud JSON-LD saqlangan: Organization, WebSite + SearchAction. | `src/app/page.tsx` |

## Ataylab qilinmagan (va nima uchun)

- **«Doimiy» filtri (Yangi ishlar):**
  - oddiy qidiruvda (`simple_search_vacancies*`) bandlik turi bo'yicha filtr yo'q;
  - u faqat `/jobs` da bor (`employment=permanent,full_time`);
  - soxta filtr qo'yilmadi — kerak bo'lsa, keyingi bosqichda `simple_search` ga bandlik parametri qo'shiladi.
- **Qidiruv panelida tuman:**
  - panelda faqat viloyat bor; tuman keyingi qadamda mavjud `/search` oqimi bilan tanlanadi (ro'yxat, «Joylashuvim bo'yicha»);
  - 200 dan ortiq tumanli bitta ochiladigan ro'yxat telefonda noqulay.
- **Rang va gradient:**
  - asosiy rang `#1d5fe0` qoldi: talabdagi `#1769FF` ga yaqin, oq fonda kontrast testi o'tgan;
  - gradient ishlatilmadi, chunki brend qo'riqchisi (`brand-guard.test.ts`) uni taqiqlaydi;
  - footer uchun yangi tokenlar qo'shildi: `--navy*` (yorug' va qorong'i mavzu).
- **Ijtimoiy isbot (sharhlar, logotiplar)** — tasdiqlangan haqiqiy manba yo'q.

## Production

`0067_home_market_counts.sql`:
- faqat yangi funksiya qo'shadi (drop yo'q);
- production'ga 2026-10-18 da egasining ruxsati bilan qo'llangan;
- tekshiruv: SECURITY INVOKER, anon va authenticated chaqira oladi, Supabase xavfsizlik maslahatchisida yangi ogohlantirish yo'q;
- qo'llash paytida bazada faol vakansiya bo'lmagani uchun sonlar hali chiqmaydi — e'lonlar paydo bo'lishi bilan avtomatik ko'rinadi (kesh ~10 daqiqa).

## Tekshiruvlar

- **Unit:** `src/features/landing/market/model.test.ts`
  - qidiruv paneli → URL;
  - filtrlar;
  - sonlar shaklini tekshirish.
- **SQL:** `supabase/tests/home_market_counts.test.sql`
  - faol, muddati o'tgan, qoralama va yopilgan e'lonlar;
  - ish beruvchilar soni;
  - INVOKER.
- **E2E:** `e2e/specs/home-market.spec.ts`
  - menyu (kompyuter va telefon);
  - qidiruv paneli parametrlari;
  - sohalar soni = baza;
  - filtrlar, bo'sh va xato holatlari;
  - raqamlar = baza;
  - footer havolalari (hammasi < 400);
  - SEO;
  - 320–1440 px.
- **Mavjud testlar yangi matnlarga moslangan** (`entry`, `modes`, `journeys`, `journey-apply`, `home`, `guards`, `entry-flow`). A11y testi (`a11y.spec`, «home») avvalgidek ishlaydi.
