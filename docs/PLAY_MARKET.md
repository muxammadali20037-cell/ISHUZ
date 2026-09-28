# Google Play'ga chiqarish va Google qidiruvida chiqish

Ilova — PWA (sayt), Google Play'ga **TWA** (Trusted Web Activity) sifatida joylanadi.
Android ilova saytni brauzer panelisiz ochadi. Saytga har bir deploy ilovaga ham darhol tushadi,
shuning uchun Play'ga qayta yuklash faqat ikona, nom yoki paket o'zgarganda kerak bo'ladi.

Tayyor narsalar (shu repoda):

| Nima | Qayerda |
|---|---|
| Manifest, ikonkalar (512, maskable), service worker | `public/manifest.webmanifest`, `public/icons`, `public/sw.js` |
| Digital Asset Links (brauzer panelini yashirish) | `/.well-known/assetlinks.json` ← Vercel env `ANDROID_SHA256_CERT_FINGERPRINTS` |
| Maxfiylik siyosati | `https://SAYT/privacy` |
| Hisobni o'chirish sahifasi (Play talabi) | `https://SAYT/account-deletion` |
| Ikona 512×512 | `docs/play-store/icon-512.png` |
| Feature graphic 1024×500 | `docs/play-store/feature-graphic-uz.png`, `feature-graphic-ru.png` |
| Telefon skrinshotlari 1080×1920 (6 ta) | `docs/play-store/screenshots-uz/`, `screenshots-ru/` |

Paket nomi: **`uz.ishberuvchi.app`**. Play'ga birinchi yuklangandan keyin paket nomini **o'zgartirib bo'lmaydi**.
Boshqa nom kerak bo'lsa, hozir tanlang va Vercel'da `ANDROID_PACKAGE_NAME` ga yozing.

---

## 1. Google Play Console hisobi

1. <https://play.google.com/console> → ro'yxatdan o'tish (bir martalik to'lov **25 $**), shaxsni tasdiqlash.
2. **Shaxsiy (personal) hisob** bo'lsa, Google talabi: ilova production'ga chiqishdan oldin **yopiq testda kamida 12 tester 14 kun** ishlatishi kerak.
   Tanishlaringizning Gmail manzillarini yig'ib qo'ying.
   **Tashkilot (organization) hisobi** (D-U-N-S raqami bilan) bu talabdan ozod.

## 2. Android paketini (.aab) yasash — PWABuilder

1. Sayt Vercel'da ishlab turgan bo'lsin (masalan `https://ishberuvchi.uz`).
2. <https://www.pwabuilder.com> → sayt manzilini kiriting → **Package for stores** → **Android**.
3. Sozlamalar:
   - **Package ID:** `uz.ishberuvchi.app`
   - **App name:** `Ish beruvchi`, **Launcher name:** `Ish beruvchi`
   - **Theme / navigation color:** `#1d5fe0`, **background:** `#f6f8fb`
   - **Signing key:** "Create new" (yangi kalit).
4. **Download** → zip ichida `.aab`, `signing.keystore` va `signing-key-info.txt` bo'ladi.
   ⚠️ `signing.keystore` va parolni **xavfsiz joyda saqlang**. Yo'qolsa, ilovani yangilab bo'lmaydi. Uni repoga qo'ymang.

## 3. Play Console'da ilova yaratish

**Create app** → nom: `Ish beruvchi` → til: o'zbek → App (not game) → Free.

### Do'kon sahifasi (Main store listing)

**O'zbekcha** (asosiy):

- **Nom (30 belgigacha):** `Ish beruvchi: ish topish`
- **Qisqa tavsif (80):** `Ish va vakansiyalar: AI bilan rezyume, sizga mos ishlar, bir bosishda ariza.`
- **To'liq tavsif:**

```
«Ish beruvchi» — O'zbekistonda ish qidiruvchilar va ish beruvchilarni bir necha daqiqada bog'laydigan platforma.

ISH QIDIRUVCHILAR UCHUN
• Rezyume bir necha soniyada: o'zingiz haqingizda oddiy tilda yozing — AI hammasini joy-joyiga qo'yadi.
• Telegram botda ham CV tuzish mumkin: tugmalarni bosasiz, tayyor PDF rezyume chatga keladi.
• Oddiy tilda qidiruv: «Chilonzorda kassir 5 mln» — tizim o'zi filtrlarga aylantiradi.
• Har bir vakansiya sizga qanchalik mosligi sabablari bilan ko'rsatiladi.
• Bir bosishda ariza, suhbatga taklif va yangi mos ishlar haqida Telegram'da xabar.

ISH BERUVCHILAR UCHUN
• Vakansiya bitta gapdan: AI chiroyli e'lon tayyorlaydi va sifatini tekshiradi.
• Eng mos nomzodlar birinchi — arizalar moslik bo'yicha saralanadi.
• Suhbatga bir bosishda chaqirish, izohlar, ommaviy saralash.

XAVFSIZ
• Telefon raqamingiz faqat ruxsatingiz bilan ko'rinadi.
• Shubhali e'lonlar avtomatik tekshiriladi.
• Tasdiqlangan kompaniyalar belgisi.

O'zbek va rus tillarida. Ish qidirish — bepul.
```

**Ruscha** (Add translation → Russian):

- **Nom:** `Ish beruvchi: поиск работы`
- **Qisqa tavsif:** `Работа и вакансии: резюме с ИИ, подходящие вакансии, отклик в одно касание.`
- **To'liq tavsif:**

```
«Ish beruvchi» — платформа, которая за несколько минут соединяет соискателей и работодателей в Узбекистане.

ДЛЯ СОИСКАТЕЛЕЙ
• Резюме за секунды: напишите о себе простыми словами — ИИ всё заполнит сам.
• Резюме можно составить и в Telegram-боте: нажимаете кнопки — готовое PDF-резюме приходит в чат.
• Поиск простыми словами: «кассир Чиланзар 5 млн» — система сама настроит фильтры.
• Для каждой вакансии видно, насколько она вам подходит и почему.
• Отклик в одно касание, приглашения на собеседование и новые вакансии — уведомления в Telegram.

ДЛЯ РАБОТОДАТЕЛЕЙ
• Вакансия из одной фразы: ИИ составит красивое объявление и проверит его качество.
• Лучшие кандидаты первыми — отклики отсортированы по соответствию.
• Приглашение на собеседование в одно касание, заметки, массовая сортировка.

БЕЗОПАСНО
• Ваш номер виден только с вашего разрешения.
• Подозрительные вакансии проверяются автоматически.
• Значок проверенной компании.

На узбекском и русском языках. Поиск работы — бесплатно.
```

**Grafika:** ikona `docs/play-store/icon-512.png`, feature graphic `feature-graphic-uz.png` (ruscha tarjimaga — `-ru`),
telefon skrinshotlari `screenshots-uz/01…06.jpg` (ruscha tarjimaga — `screenshots-ru`).

**Kategoriya:** Business (Biznes). **Email:** aloqa manzilingiz. **Sayt:** `https://SAYT`.

### App content (Ilova tarkibi) bo'limi

| Savol | Javob |
|---|---|
| Privacy policy | `https://SAYT/privacy` |
| Ads (reklama bormi) | Yo'q |
| App access (kirish uchun login kerakmi) | Ha, ba'zi funksiyalar uchun. Tekshiruvchiga test hisobi bering: telefon raqami va kirish yo'li (masalan, Telegram orqali kirish) |
| Content rating | So'rovnoma: zo'ravonlik/qimor yo'q; **foydalanuvchilar o'zaro yozishadi (chat) — Ha**; foydalanuvchi joylashuvi (hudud/tuman) ulashiladi — Ha |
| Target audience | 18+ (kichik yoshdagilar uchun alohida talablar bo'lmasligi uchun) |
| News app | Yo'q |
| Government app | Yo'q |
| Financial features | Yo'q (Payme/Click faqat xizmat uchun to'lov) |
| Data deletion | Ha, foydalanuvchi hisobni o'chira oladi. Havola: `https://SAYT/account-deletion` |

**Data safety** (Ma'lumotlar xavfsizligi):

| Ma'lumot turi | Yig'iladi | Maqsad | Majburiymi |
|---|---|---|---|
| Ism, telefon raqami, email (ixtiyoriy) | Ha | Hisob, aloqa | Telefon — ha |
| Taxminiy joylashuv (viloyat/tuman, foydalanuvchi o'zi tanlaydi) | Ha | Ilova funksiyasi (mos ishlar) | Ha |
| Shaxsiy ma'lumot: tug'ilgan sana, jins, ish tarixi, ta'lim (rezyume) | Ha | Ilova funksiyasi | Qisman |
| Xabarlar (chat) | Ha | Ilova funksiyasi | Yo'q |
| Rasmlar va fayllar (portfolio, logotip) | Ha | Ilova funksiyasi | Yo'q |
| Xarid tarixi (xizmat to'lovlari) | Ha | Ilova funksiyasi | Yo'q |
| Ilova faoliyati (qidiruv so'rovlari) | Ha | Analitika (natijalarni yaxshilash) | Ha |

- Ma'lumotlar uchinchi shaxslarga **sotilmaydi** va **berilmaydi**. Xizmat ko'rsatuvchilar (xosting, Telegram, to'lov tizimlari) Google qoidasiga ko'ra "sharing" hisoblanmaydi.
- Uzatishda shifrlanadi (HTTPS) — **Ha**.
- Foydalanuvchi ma'lumotlarini o'chirishni so'rashi mumkin — **Ha**.

## 4. Yuklash va test

1. **Testing → Closed testing** → yangi track → `.aab` ni yuklang → testerlar ro'yxati (Gmail) → Review'ga yuboring.
2. **Setup → App signing** → **App signing key certificate** dagi **SHA-256** ni nusxalang.
   PWABuilder bergan `signing-key-info.txt` dagi SHA-256 ni ham oling.
3. Vercel → Settings → Environment Variables:
   `ANDROID_SHA256_CERT_FINGERPRINTS` = `AA:BB:...,CC:DD:...` (ikkalasi, vergul bilan).
   Paket nomi boshqa bo'lsa — `ANDROID_PACKAGE_NAME`. Keyin **Redeploy** qiling.
4. Tekshiring: `https://SAYT/.well-known/assetlinks.json` — ichida paket nomi va barmoq izlari bo'lishi kerak.
   Shunda ilovada yuqoridagi brauzer paneli ko'rinmaydi.
5. Shaxsiy hisobda 12 tester 14 kun ishlatgach: **Production → Apply for production access** → tasdiqlangach, production'ga chiqaring.
   Google tekshiruvi odatda bir necha kundan bir haftagacha davom etadi.

---

## 5. Google qidiruvida chiqish («ish», «Toshkentda ish», «vakansiya»)

Kodda tayyor:

- Har bir sahifada sarlavha va tavsif (masalan «Ish: Toshkent shahri — vakansiyalar»), o'zbekcha va ruscha versiyalar (`hreflang`, `?lang=ru`).
- Har bir vakansiya Google Jobs formatida (JobPosting). Google'dagi «ish» qidiruvida alohida vakansiyalar blokiga tushishi mumkin.
- `sitemap.xml`: barcha faol vakansiyalar, kompaniyalar, hudud va kasb sahifalari. `robots.txt`: shaxsiy sahifalar yopiq.
- Bosh sahifada hudud va kasb bo'yicha havolalar, sayt nomi va qidiruv (Organization/WebSite JSON-LD).

Sizning qadamlaringiz:

1. **Google Search Console** — <https://search.google.com/search-console> → Add property → **URL prefix** → `https://SAYT` → **HTML tag** usuli.
   `content="..."` ichidagi kodni Vercel env **`GOOGLE_SITE_VERIFICATION`** ga yozing → Redeploy → **Verify**.
2. Search Console → **Sitemaps** → `sitemap.xml` → Submit.
3. **Yandex Webmaster** (O'zbekistonda ham ishlatiladi) — <https://webmaster.yandex.com> → sayt qo'shish → meta-teg kodi → **`YANDEX_VERIFICATION`** → Redeploy → tasdiqlash → sitemap qo'shish.
4. Vercel env **`SUPPORT_EMAIL`** — maxfiylik sahifasidagi aloqa manzili (Play ham so'raydi).
5. O'z domeningiz bo'lsin (`.uz` yoki `.com`). `vercel.app` domen Google'da sekinroq ko'tariladi. Domen ulangach, `APP_URL` va `NEXT_PUBLIC_APP_URL` ni yangi domenga o'zgartiring.

**Ochiq gap:** «ish» kabi bitta umumiy so'z bo'yicha birinchi sahifaga chiqishni hech kim kafolatlay olmaydi. Bu so'z bo'yicha katta va eski saytlar raqobatlashadi.
Tezroq natija beradiganlari:

- aniq qidiruvlar: «Toshkentda ish», «kassir ishi», «haydovchi vakansiya» — bular uchun sahifalar tayyor;
- vakansiyalar soni va yangiligi — Google Jobs ko'proq faol e'lonlarni ko'rsatadi;
- boshqa saytlar va Telegram kanallaridan saytga havolalar;
- Play Market sahifasi — u ham Google'da alohida natija bo'lib chiqadi.

Indekslash odatda 1–4 hafta oladi. Search Console'dagi «Performance» bo'limida qaysi so'zlar bo'yicha chiqayotganingiz ko'rinadi.
