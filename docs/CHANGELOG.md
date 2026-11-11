# O'zgarishlar jurnali

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
