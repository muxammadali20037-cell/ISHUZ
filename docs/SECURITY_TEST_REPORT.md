# Xavfsizlik test hisoboti

Sana: 2026-10-10 · Muhit: **lokal staging** (PostgreSQL 16 + Supabase stub, PostgREST pre-request bilan, Next.js 16.3.8 production build, Telegram/AI mock'lar). Yuk/DDoS testi o'tkazilmadi (talab bo'yicha). Production'da faqat buzmaydigan `probe.mjs` (har tekshiruv 1 so'rov).

Natija belgilari: **PASS** — avtomatik test o'tdi · **FAIL** · **NOT_RUN** — avtomatik tekshirilmadi (sababi yozilgan).

## Umumiy

| To'plam | Natija |
|---|---|
| Unit (vitest) | 482 PASS, 18 skip (mavjud), 0 FAIL — shu jumladan `safe-path` 14, `request` 9, `headers` 8, `rules` 7, `safe-fetch` 7, `file-signature` 6, `verify` 5, `ai/json` 5, `rate-limit` 4, `postgrest` 2 |
| SQL (`scripts/db-test.sh`, 22 fayl) | PASS — `security_hardening.test.sql` da 100 ta tekshiruv |
| E2E s1–s10 (mavjud funksiyalar regressiyasi) | 12/12, 17/17, 23/23, 20/20, 12/12, 38/38, 4/4, 16/16, 4/4, 25/25 — hammasi PASS |
| E2E s1–s11 (fayl mazmuni tekshiruvidan keyin qayta, 2026-10-10) | Hammasi PASS. Izoh: ikkinchi to'liq yugurishda s4 da bir marta brauzerning «Transition was aborted because of timeout in DOM update» xabari (yuklama ostida sahifa almashish animatsiyasi vaqti; ilova kodida `startViewTransition` yo'q) — s4 alohida qayta: 20/20 |
| E2E s11 (xavfsizlik) | 35/35 PASS |
| Moderatsiya rasmi mazmuni (E2E, tasodifiy dalil) | PASS — lokal Storage emulyatori PNG o'rniga multipart so'rov tanasini saqlaganda, moderatsiya rasmni AI'ga yubormadi va `review` / `image_content_mismatch` qaydini yozdi. Emulyator tuzatilgach (faqat fayl qismi saqlanadi) haqiqiy PNG odatdagidek AI tekshiruvidan o'tdi (s4) |
| Yangi ilova + 0056'siz baza (deploy oynasi) | 6/6 PASS — kod yuborish/tekshirish eski limit funksiyasiga qaytadi, bot bog'lash bir bosqichli rejimga qaytadi, kompaniya sahifasi ishlaydi |
| `probe.mjs` (lokal) | 11/11 PASS |
| TypeScript / ESLint | 0 xato (3 ta eski ogohlantirish, bu ishga aloqasiz) |
| Production build | PASS |

## Qabul testlari A–K

| # | Talab | Natija | Dalil |
|---|---|---|---|
| A | Foydalanuvchilar bir-birining ma'lumotini ko'ra olmaydi | **PASS** | SQL: begona `employer_profiles` 0 qator, anon `companies.tin` 42501, ommaviy bucket list faqat o'z papkasi; E2E s11: REST orqali begona telefon/STIR bo'sh, anon tin 401/403 |
| B | Huquqni oshirib bo'lmaydi | **PASS** | SQL: `security_*`/`setting_bool`/`telegram_auth_lookup` 42501, admin maydonlari o'zgarmaydi, `is_blocked` 42501, moderator `security.view` yo'q, `verification_requests` INSERT 42501, `notifications.link` 42501, TRUNCATE yo'q, tasdiqlangan nom/STIR o'zgarmaydi, anon SECURITY DEFINER ro'yxati aniq; E2E s11: super_admin bor — ikkinchi egasi raqami admin bo'lmaydi |
| C | Soxta/muddati o'tgan token va initData rad etiladi | **PASS** | unit `verify.test.ts` (soxta imzo, boshqa token, >1 soat, kelajakdagi sana); E2E s11: boshqa kalit 401, 2 soatlik 401, muddati o'tgan JWT 401, soxta JWT 401 |
| D | Bloklangan / sessiyasi bekor qilingan foydalanuvchi to'xtatiladi (oyna: **yozish — darhol**, o'qish — access token muddatigacha, R-01) | **PASS** | SQL: auth.sessions o'chiriladi, ban, e'lonlar yashiriladi/qaytariladi, eski `iat` bilan yozish 42501, yangi kirish ishlaydi, bloklangan admin huquqsiz, o'zini/super adminni bloklash taqiq; E2E s11 (haqiqiy PostgREST): eski token PATCH 403 `account_restricted`, SECURITY DEFINER RPC 403, o'qish 200, brauzer `/blocked` ga |
| E | Parallel so'rovlar limitni chetlab o'tmaydi | **PASS** | E2E s11: 20 ta parallel kod so'rovidan ≤ 6 tasi o'tdi (atomik `security_hit`); SQL: hisoblagich ketma-ket qiymat qaytaradi |
| F | Begona odam jabrlanuvchini doimiy bloklay olmaydi | **PASS** | SQL: telefon cheklovi ≤ 1 soat (999999 s so'ralsa ham), hisob ≤ 7 kun, takroriy hujum muddatni uzaytirmaydi, jadval CHECK ≤ 7 kun, standart kuzatuv rejimi, `compromise_suspected` kirishni to'xtatmaydi, admin olib tashlaydi; unit `rules.test.ts`; E2E s11: kod yo'q telefon uchun urinish limitni "yemaydi" |
| G | Webhook imzosiz rad; takror idempotent | **PASS** | E2E s5: noto'g'ri secret 401/403, ishlatilgan token qayta bog'lamaydi, tasdiq qadami; E2E s11: bir xil `update_id` ikkinchi marta `duplicate`; SQL: `telegram_update_first_seen` true→false |
| H | Noto'g'ri fayl/manzil rad, yopiq fayllar himoyalangan | **PASS** (qisman qamrov) | SQL: hujjat yo'lida `..`/qo'shimcha papka rad, vakansiya rasm yo'lida `..` rad, tashqi/begona papka avatar rad, ro'yxatdan o'tishda ruxsatsiz avatar tashlanadi; E2E s11: REST orqali tashqi avatar 400; unit `file-signature`/`safe-fetch`: «image/png» deb kelgan HTML/SVG, «jpeg» deb PNG, «pdf» deb rasm rad etiladi (moderatsiya va tasdiqlash shu tekshiruvdan foydalanadi). **Yuklash paytidagi mazmun tekshiruvi yo'q (R-03) — NOT_RUN** |
| I | Loglarda sir/PII yo'q; ogohlantirish test kanaliga yetadi | **PASS** | E2E s11: yuqori hodisa → adminga 1 ta (dedupe) → tg-mock'da adminning chatiga «Xavfsizlik ogohlantirishi», telefon yo'q; limit kalitlarida ochiq raqam yo'q; SQL: ochiq telefon `subject_hash` ga yozilmaydi, `details` ≤ 4 KB, jurnal append-only |
| J | Boshqa domen/origin orqali chetlab o'tib bo'lmaydi | **PASS** | E2E s11: begona Origin 403, `Origin: null` 403, text/plain 415, admin host `frame-ancestors 'none'` + XFO DENY, asosiy hostda `/admin` 404, CSP buzilishlari 0 (ommaviy, kabinet, admin sahifalar); `probe.mjs` |
| K | Zaxiradan tiklash va ilova ishlashi | **PASS (lokal)** / **NOT_RUN (production)** | `restore-check.sh` lokal mashqi: nazorat yig'indisi, 8 jadval sonlari mos. Production zaxirasi GitHub sirlari qo'yilgach (RUNBOOK §6) ishlaydi |

## NOT_RUN va sabablari

| Nima | Sabab | Qanday tekshirish |
|---|---|---|
| To'liq Telegram kirish oqimi (createUser → magic link → sessiya) | Lokal GoTrue emulyatsiyasida `generateLink/verifyOtp` yo'q | Staging Supabase loyihasida: oldindan `tg_<id>@telegram.ishuz.local` bilan signUp → Mini App kirish → yangi hisob yaratilishi va `auth.telegram_email_preclaimed` hodisasi |
| Tasdiqlash hujjati ulanishi (`verification/ai-review.ts`) | Modul unit bilan tekshirilgan (`file-signature`); xizmat oqimi uchun integratsion test yo'q. (Moderatsiya ulanishi E2E'da tasdiqlandi — pastga qarang) | Staging'da «.pdf» nomli boshqa faylni hujjat qilib yuborish → admin kartasida «Hujjat mazmuni fayl turiga mos emas» |
| `Secure` cookie va HSTS | Lokal http | Production `probe.mjs` (HSTS) va brauzer DevTools (Secure) |
| Yuklash paytidagi mazmun tekshiruvi / qayta kodlash | Funksiya yo'q (R-03) | 4b-bosqich (SECURITY_PLAN) |

## Qayta ishga tushirish

```bash
npx tsc --noEmit && npm run lint && npx vitest run
bash scripts/db-test.sh                         # lokal Postgres kerak
node scripts/security/probe.mjs https://<sayt> https://<admin-host>
```
E2E to'plami lokal staging stend (PostgREST + GoTrue emulyatori + mock'lar) talab qiladi.

## Masofaviy (production) holat

| Qadam | Holat |
|---|---|
| 0056 ni rollback bilan quruq sinash (barcha funksiya yamoqlari, `alter role authenticator`, storage siyosatlari, auth.users yozish huquqi) | **PASS** — hech narsa saqlanmadi (tekshirildi) |
| 0056 ni qo'llash | **NOT_RUN** — 1-urinish: chaqiruv bekor qilindi; 2- va 3-urinish: Supabase MCP 60 soniyada javob bermadi (bazada hech qanday tranzaksiya boshlanmagan, o'zgarish yo'q — tekshirildi); bo'laklab qo'llash avtomatik ruxsat tizimi tomonidan rad etildi. Egasining aniq ruxsati yoki SQL Editor orqali qo'llash kerak (RUNBOOK §9). Ilova kodi 0056'siz ham ishlaydi |
| Production `probe.mjs` | Deploy'dan keyin ishga tushiriladi (RUNBOOK §0) |
