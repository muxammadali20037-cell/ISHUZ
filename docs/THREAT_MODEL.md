# Tahdidlar modeli — «Ish topdim»

Holat: 2026-10-10 · Standart: OWASP ASVS 5.0.0, L2 (kirish, admin, to'lov — L3 talablari bilan) · Bog'liq: `SECURITY_AUDIT.md`, `SECURITY_PLAN.md`, `SECURITY_RUNBOOK.md`, `SECURITY_TEST_REPORT.md`.

Bu hujjat "tizim buzilmaydi" demaydi. U nimani himoya qilayotganimiz, kim va qayerdan hujum qilishi mumkinligi, qaysi nazorat bor/yo'qligi va har biri qanday tekshirilishini yozadi.

## 1. Tizim chegaralari

```
Brauzer / Telegram Mini App ──HTTPS──► Vercel (Next.js 16, bom1)
                                         │  proxy.ts (sessiya, admin host, til)
                                         │  route handlers /api/* , server actions
                                         ├──► Supabase PostgREST  (anon/authenticated JWT → RLS, pre-request)
                                         ├──► Supabase Auth (GoTrue)  (service role: createUser, magic link)
                                         ├──► Supabase Storage (bucketlar, RLS)
                                         ├──► Telegram Bot API (bot token)
                                         └──► Gemini / Anthropic (AI kalitlari)
Telegram ──webhook (secret header)──► /api/telegram/webhook
pg_cron ──► SQL texnik xizmat;  Vercel/pg_cron ──► /api/cron/* (CRON_SECRET)
GitHub Actions ──► CI (lint/test/secret-scan/audit), shifrlangan zaxira (age)
```

Ishonch chegaralari: (1) mijoz ↔ Vercel; (2) Vercel ↔ Supabase (service role faqat serverda); (3) mijoz ↔ PostgREST (to'g'ridan-to'g'ri, faqat anon/publishable kalit + foydalanuvchi JWT — **barcha himoya RLS va SQL funksiyalarda**); (4) Telegram ↔ webhook; (5) admin host ↔ ommaviy host.

## 2. Aktivlar

| Aktiv | Nima uchun qimmat | Qayerda |
|---|---|---|
| Foydalanuvchi hisoblari va sessiyalar | Hisobni egallash → ma'lumot, e'lon, chat | auth.users, auth.sessions, cookie `sb-*` |
| Telefon raqamlari, STIR/PINFL, hujjatlar | Shaxsiy ma'lumot (PII), firibgarlik | profile_contacts, employer_profiles, `documents` bucket |
| Ishchi joylashuvi (worker_geo) | Jismoniy xavfsizlik | worker_geo, search_workers* |
| Admin huquqlari | Butun platformani boshqarish | admin_users, aal2 (TOTP) |
| Vakansiya/e'lon holati va to'lovlar | Pul, ishonch (tasdiqlangan nishon) | vacancies, payments, billing_usage |
| Kalitlar va sirlar | Hammasini ochadi | Vercel env: service/secret key, bot token, webhook secret, CRON_SECRET, AI kalitlari |
| Audit va xavfsizlik jurnali | Tergov, javobgarlik | audit_logs, security_events |
| AI byudjeti | Pul (xarajat hujumi) | Gemini/Anthropic |
| Zaxira nusxalar | To'liq baza nusxasi | GitHub artefakt (age bilan shifrlangan) |

## 3. Hujumchilar

- **A1 Anonim internet** — skanerlar, botlar, spam, xarajat hujumi.
- **A2 Ro'yxatdan o'tgan foydalanuvchi** — Telegram orqali bepul hisob; boshqalar ma'lumotiga, huquqqa intiladi (IDOR, RLS chetlab o'tish).
- **A3 Begona odam jabrlanuvchiga qarshi** — raqamini bilib kodlarni bloklash, hisobini egallash, Telegram'ni ulab olish.
- **A4 Firibgar ish beruvchi** — soxta tasdiqlangan nishon, pullik e'lonni bepul chiqarish, ishchilar joylashuvini aniqlash.
- **A5 Buzilgan admin hisobi / SIM almashtirish** — super_admin bo'lib olish.
- **A6 Ta'minot zanjiri / sizgan kalit** — npm paket, GitHub, Vercel env.

## 4. Kirish nuqtalari va tahdidlar (STRIDE)

| # | Kirish nuqtasi | Tahdid | Ta'sir | Mavjud nazorat | Tekshiruv |
|---|---|---|---|---|---|
| E1 | `POST /api/auth/telegram` | Soxta/eskirgan initData (S), login CSRF (S), oldindan band qilingan texnik email orqali egallash (E) | Hisobni egallash | HMAC initData, yoshi ≤ 1 soat, JSON + Origin, `app_metadata.tg_id` ishonch belgisi, bloklangan → 403, IP limit | unit `verify.test.ts`, SQL G, E2E s11 C/J |
| E2 | `POST /api/auth/phone-code/send` | Spam, raqam bo'yicha bloklash (D), enumeratsiya (I) | Bezovtalik, kirish to'xtashi | Atomik fail-closed limitlar (telefon 6/soat, IP/64 30/soat), 3 tagacha faol kod, holat mashinasi (kuzatuv), HMAC kalitlar | E2E s11 E, unit rules |
| E3 | `POST /api/auth/phone-code/verify` | Kodni taxmin qilish (S), parallel urinish (T), jabrlanuvchi limitini yeyish (D) | Hisobni egallash | Faqat xatolar sanaladi, har 5 xatoda kodlar yopiladi, IP limiti, doimiy vaqtli taqqoslash, atomik iste'mol | E2E s11 E |
| E4 | PostgREST (`/rest/v1`) to'g'ridan-to'g'ri | IDOR, ustun/qatorni o'zgartirish (T/E), PII o'qish (I) | Ma'lumot sizishi, nishon/to'lov firibgarligi | RLS hamma jadvalda, RESTRICTIVE faol foydalanuvchi siyosati, guard triggerlar, ustun huquqlari, pre-request | SQL 22 fayl (100 ta 0056 tekshiruvi), E2E s11 A/B/D |
| E5 | SECURITY DEFINER RPC'lar | Huquqsiz chaqiruv, ichki funksiya oracle'lari (I/E) | Ma'lumot sizishi | Har RPC ichida tekshiruv, anon uchun ochiq funksiyalar **aniq ro'yxat** (test), ichki funksiyalar yopiq | SQL B (allowlist) |
| E6 | Server actions | CSRF (Next.js Origin tekshiruvi), validatsiya | — | Next.js o'rnatilgan Origin tekshiruvi, zod | mavjud unit testlar |
| E7 | `POST /api/telegram/webhook` | Soxta update (S), takror (R), bog'lash havolasini o'g'irlash (E) | Hisobni Telegram'ga ulab olish | Secret header (doimiy vaqt), update_id dedupe, bog'lashda **tasdiq qadami**, eski Telegram'ga xabar, bloklangan hisob yozmaydi | E2E s5, s11 G |
| E8 | Storage | Ro'yxatni olish (I), begona papkaga yozish (T), noto'g'ri tur | PII, zararli fayl | Bucket MIME/hajm, papka = uid siyosatlari, ommaviy bucket list faqat o'z papkasi, hujjatlar yopiq + imzoli URL | SQL A |
| E9 | `/admin` va admin host | Clickjacking, huquqni oshirish, sessiya | Platforma nazorati | Alohida host, aal2 (TOTP) DB'da, `frame-ancestors 'none'` + XFO DENY, bloklangan admin huquqsiz, ierarxiya | E2E s3, s8, s11 J |
| E10 | `/r/[token]`, `?next=` | Ochiq yo'naltirish (S) | Fishing | `safeInternalPath` hamma joyda | unit 14 ta, probe |
| E11 | AI funksiyalari | Xarajat hujumi (D), prompt injection (T) | Pul, noto'g'ri moderatsiya | Kunlik byudjet (fail-closed), IP/foydalanuvchi limitlari, AI faqat maslahatchi (sxema + qoidalar), moderatsiyada inson | `gemini.test.ts`, E2E s1/s7 |
| E12 | Moderatsiya rasm yuklash | SSRF (I) | Ichki tarmoq | Ishonchli host ro'yxati, har yo'naltirishda qayta tekshirish, oqim bilan hajm chegarasi | kod ko'rib chiqish (test: NOT_RUN) |
| E13 | Cron / zaxira / CI | Kalit sizishi, ruxsatsiz ishga tushirish | — | CRON_SECRET, CI `permissions: contents: read`, secret-scan, age (yopiq kalit oflayn) | CI, probe |
| E14 | Brauzer (XSS) | Skript in'ektsiyasi | Sessiya o'g'irlash | React escaping, CSP (object/base/form/frame cheklangan, tashqi skript faqat telegram.org), rasm manzili allowlist | E2E s11 CSP |

## 5. Hal qilinmagan / qabul qilingan xavflar

`SECURITY_AUDIT.md` → "Qolgan xavf" bo'limiga qarang (R-01 … R-12). Eng muhimlari: JWT o'qish oynasi (yozish darhol to'xtaydi, o'qish token muddatigacha), CSP'da `'unsafe-inline'`, yuklangan fayllarning haqiqiy turi tekshirilmaydi, Supabase panel sozlamalari (ochiq ro'yxatdan o'tish, JWT muddati).

## 6. Qayta ko'rib chiqish

Har katta o'zgarishda (yangi kirish nuqtasi, to'lov yoqilishi, yangi tashqi integratsiya) va kamida 6 oyda bir marta. Yangi SECURITY DEFINER funksiya anon uchun ochilsa — `security_hardening.test.sql` dagi ro'yxat testi yiqiladi va ongli ravishda yangilanadi.
