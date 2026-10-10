# Xavfsizlik rejasi — OWASP ASVS 5.0.0 (L2, muhim funksiyalarda L3)

Bu reja nima qilinganini, nima qolganini va qaysi tartibda yoqilishini ko'rsatadi. "100% himoya" yo'q — maqsad: har tahdid uchun tekshiriladigan nazorat va qolgan xavfni ochiq yozish.

## 1. ASVS 5.0 bo'limlari bo'yicha holat

| Bo'lim | Asosiy talablar | Holat | Dalil |
|---|---|---|---|
| V1 Encoding & Sanitization | Kontekstli escaping, parametrlangan so'rovlar | Bajarilgan | React escaping, PostgREST/RPC parametrlari, `safeFilterValue`, bot HTML `escapeHtml` |
| V2 Validation & Business Logic | Server tomonda validatsiya, biznes oqim tartibi, limitlar | Bajarilgan | zod; holat faqat RPC orqali (S-03); atomik limitlar; AI byudjeti |
| V3 Web Frontend Security | CSP, ramka, cookie, ochiq yo'naltirish | Qisman (CSP 1-bosqich) | `headers.ts`, `safe-path.ts`; 2-bosqich pastda |
| V4 API & Web Service | Content-Type, CSRF, metodlar | Bajarilgan | `rejectUnsafeRequest`, webhook secret, cron secret |
| V5 File Handling | Tur, hajm, joylashuv, imzoli URL | Qisman | Bucket MIME/hajm, papka siyosatlari, yo'l regex; magic-byte — R-03 |
| V6 Authentication | Kod limitlari, enumeratsiya, admin MFA | Bajarilgan (L2), admin L3 | OTP qoidalari; admin aal2 DB'da; TOFU — R-08 |
| V7 Session Management | Bekor qilish, bloklash, logout, cookie | Bajarilgan (yozish), o'qish — R-01 | `sessions_revoked_at`, pre-request, auth.sessions o'chirish, Secure cookie |
| V8 Authorization | Deny-by-default, RLS har amalda, service role yo'llarida tekshiruv | Bajarilgan | RLS hamma jadvalda; RESTRICTIVE siyosat; anon funksiyalar ro'yxati testi |
| V9 Self-contained Tokens | Imzo, muddat, algoritm | Bajarilgan | ES256 JWT (getClaims), initData HMAC + yosh; legacy HS256 o'chirish — Tashqi |
| V10 OAuth/OIDC | — | Qo'llanilmaydi | Telegram initData — V9 |
| V11 Cryptography | CSPRNG, HMAC, doimiy vaqt | Bajarilgan | `randomInt`, `randomBytes`, `timingSafeEqual`, HMAC subject |
| V12 Secure Communication | TLS, HSTS | Bajarilgan | Vercel TLS, HSTS 2 yil |
| V13 Configuration | Sirlar ajratilgan, minimal huquq, debug yo'q | Bajarilgan | Service key faqat server; test override production'da o'chiq; CI minimal token |
| V14 Data Protection | PII minimal, loglarda PII yo'q, saqlash muddati | Bajarilgan (asosiy) | HMAC subject, `security_events` 180 kun, PII RLS; R-04, R-07 |
| V15 Secure Coding & Architecture | Bog'liqliklar, o'lik kod | Bajarilgan | `npm audit` CI, secret-scan, o'lik kod olib tashlandi |
| V16 Logging & Error Handling | Xavfsizlik hodisalari, ogohlantirish, stack trace yo'q | Bajarilgan | `security_events`, admin Telegram ogohlantirish (dedupe), xatolar faqat kod bilan |
| V17 WebRTC | — | Qo'llanilmaydi | — |

## 2. Cheklovlar holat mashinasi (server qaror qiladi)

```
NORMAL ──(chegara 1)──► THROTTLED / CHALLENGE_REQUIRED ──(chegara 2)──► TEMPORARILY_RESTRICTED
                      COMPROMISE_SUSPECTED (faqat hisob: sessiyalar bekor qilinadi, kirish to'xtamaydi)
```

| Qoida (versiya) | Doira | Oyna | Qadamlar | Muddat |
|---|---|---|---|---|
| `auth.otp_verify_failures_phone` (otp-v1) | telefon (HMAC) | 1 soat | 10 → challenge_required · 20 → temporarily_restricted | 15 / 30 daq |
| `auth.otp_verify_failures_ip` (otp-v1) | IP /64 (HMAC) | 1 soat | 20 → throttled · 50 → temporarily_restricted | 15 / 60 daq |
| `auth.otp_send_ip` (otp-v1) | IP /64 (HMAC) | 1 soat | 30 → throttled · 100 → temporarily_restricted | 15 / 60 daq |

Kafolatlar (DB darajasida): telefon/IP/telegram cheklovi ≤ 1 soat, hisob ≤ 7 kun; takroriy hujum muddatni uzaytirmaydi; har cheklovda `scope, reason_code, created_at, expires_at, rule_version, event_id`. Begona odam jabrlanuvchini **doimiy** bloklay olmaydi; telefon bo'yicha cheklov Telegram Mini App orqali kirishga ta'sir qilmaydi (muqobil yo'l). AI hech qaysi cheklovning yagona qaror qiluvchisi emas.

Foydalanuvchiga xabarlar: `rate_limited` — «So'rovlar soni vaqtincha cheklangan. Birozdan keyin qayta urinib ko'ring.»; `temporarily_restricted` — «Xavfsizlik sababli ushbu amal vaqtincha cheklangan. Davom etish uchun qo'shimcha tasdiqlash kerak.»

## 3. Joriy etish bosqichlari

| Bosqich | Nima | Mezon / kim |
|---|---|---|
| 0 (bajarildi) | 0056 migratsiya, ilova o'zgarishlari, testlar, sarlavhalar | Barcha testlar yashil |
| 1 — kuzatuv (1–2 hafta) | `security_restrictions_enforce = false`: qoidalar faqat qayd va ogohlantirish | `/admin/security` da noto'g'ri ijobiy ulushi kuzatiladi |
| 2 — majburiy | Admin panelda «Majburiy rejimni yoqish» | Kuzatuvda haqiqiy foydalanuvchiga tushgan cheklovlar < 1%; chegaralar kerak bo'lsa `rules.ts` da versiya oshiriladi |
| 3 — CSP 2-bosqich | nonce + `'strict-dynamic'` (Report-Only bilan boshlab), Telegram SDK yuklovchisini nonce'li qilish | Sahifa tezligi ta'sirini o'lchab |
| 4 — fayllar | Yuklashdan keyin Edge Function: magic bytes, qayta kodlash, EXIF olib tashlash | R-03 |
| 5 — sessiya oynasi | JWT expiry 15–30 daq (panel), kerak bo'lsa o'qish siyosatlariga `is_active_user()` | R-01 |

## 4. Doimiy amaliyot

- Har PR: lint, typecheck, unit, SQL (22 fayl), secret-scan, `npm audit --omit=dev` (CI).
- Har yangi SQL funksiya: kim chaqiradi? anon uchun ochilsa — ro'yxat testini ongli yangilash.
- Har chiqarishdan keyin: `node scripts/security/probe.mjs <url> <admin-url>` (buzmaydigan tekshiruv).
- Har oy: `/admin/security` ko'rib chiqish, zaxiradan tiklash mashqi (`SECURITY_RUNBOOK.md`).
- Har 6 oy: tahdidlar modelini yangilash.
