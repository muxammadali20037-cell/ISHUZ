# O'zgarishlar jurnali

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
