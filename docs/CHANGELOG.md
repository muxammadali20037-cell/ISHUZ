# O'zgarishlar jurnali

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
