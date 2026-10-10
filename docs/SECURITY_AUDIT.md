# Xavfsizlik auditi — topilmalar va tuzatishlar

Sana: 2026-10-10 · Doira: butun repozitoriy (Next.js ilova, 56 ta migratsiya, Storage, Telegram bot, CI) va masofaviy Supabase loyihasi (faqat o'qish so'rovlari bilan tekshirilgan) · Usul: kod tahlili + lokal staging'da hujum ssenariylari (yuk testi yo'q).

Holat yorliqlari: **Tuzatildi+test** — kod va avtomatik test bor · **Tuzatildi** — kod bor, alohida test yo'q · **Tashqi** — provayder panelida sozlash kerak · **Qolgan xavf** — ongli qabul qilingan yoki keyingi bosqich.

Darajalar: Critical (masofadan, oson, keng) · High · Medium · Low. Hech qanday Critical topilmadi.

## High

| ID | Topilma | Joy (avval) | Ta'sir | Tuzatish | Regressiya testi | Holat |
|---|---|---|---|---|---|---|
| S-01 | Telegram hisobini egallash: `tg_<id>@telegram.ishuz.local` manzili ochiq ro'yxatdan o'tish orqali (o'z paroli bilan) oldindan band qilinsa, Telegram kirish o'sha hisobni "qabul qilardi" | `features/auth/telegram-session.ts` (createUser → "already" → email bo'yicha qabul) | Hujumchi parol bilan jabrlanuvchi hisobiga kiradi | Ishonch belgisi `app_metadata.tg_id` (faqat service role); belgisiz hisob qabul qilinmaydi → muqobil manzil bilan yangi hisob + **high** hodisa; email bo'yicha 4000 foydalanuvchini skanerlash o'rniga SQL `telegram_auth_lookup` | SQL G (`email_trusted`), E2E s11 C | Tuzatildi+test (to'liq GoTrue oqimi — NOT_RUN, qarang test hisoboti) |
| S-02 | Ish beruvchi PII: har qanday kirgan foydalanuvchi `employer_profiles` dan telefon, STIR/PINFL, tekshiruv izohlarini o'qiy olardi (`using (true)`) | 0010 `employer_profiles_read` | PII sizishi | Faqat egasi, kompaniya hamkasbi, admin; boshqalarga faqat nom — `employer_public_names()` | SQL A, E2E s11 A | Tuzatildi+test |
| S-03 | Vakansiya holatini to'g'ridan-to'g'ri `pending_review` qilib to'lov/publish qoidalarini chetlab o'tish | 0019 `vacancies_update` WITH CHECK | Pullik e'lon bepul chiqadi | `trg_00_vacancy_status_guard`: mijoz yozuvida holat faqat RPC orqali | SQL `moderation`, `security_hardening` D | Tuzatildi+test |
| S-04 | Bloklash samarasiz: sessiyalar qolardi, ko'p jadval/RPC'ga yozish mumkin edi, bloklangan admin admin bo'lib qolardi, ommaviy e'lonlar ko'rinardi, admin o'zini/yuqori rolni bloklay olardi | `admin_set_user_block`, siyosatlar, `is_admin` | Bloklangan hujumchi faol qoladi | Sessiyalar o'chiriladi + auth ban; `sessions_revoked_at` + JWT `iat` tekshiruvi; 43 jadval + storage'da RESTRICTIVE yozish siyosati; PostgREST pre-request (RPC'lar ham); e'lonlar yashiriladi/qaytariladi; ierarxiya | SQL D (17 ta), E2E s11 D | Tuzatildi+test |

## Medium

| ID | Topilma | Ta'sir | Tuzatish | Test | Holat |
|---|---|---|---|---|---|
| S-05 | Login CSRF: `/api/auth/telegram`, `/phone-code/verify`, `/telegram/link` boshqa saytdan (text/plain forma) chaqirilardi | Jabrlanuvchi hujumchi hisobiga kiritiladi | Faqat `application/json` + Origin/Sec-Fetch-Site (o'z sayti/admin host), tana ≤ 16 KB | E2E s11 J, `probe.mjs` | Tuzatildi+test |
| S-06 | Ochiq yo'naltirish: `?next=` (`\t`, `\\`, `//`), `/r/[token]`, admin xabarnoma havolasi | Fishing | `safeInternalPath()` barcha joyda | unit `safe-path.test.ts` (14), probe | Tuzatildi+test |
| S-07 | Telegram bog'lash havolasi tasdiqsiz va jim almashtiradi | Havola sizsa — hisob begona Telegram'ga ulanadi | Avval niqoblangan ism bilan tasdiq so'raladi; almashtirishda eski Telegram'ga va ilovaga xabar + hodisa | E2E s5 (12), SQL G | Tuzatildi+test |
| S-08 | OTP: jabrlanuvchi limitini begona odam "yeydi", qayta yuborish oldingi kodni o'ldiradi, urinishlar atomik emas, verify'da IP limiti yo'q | Kirishni bloklash / taxmin | Faqat xatolar sanaladi (atomik `security_hit`), 3 tagacha faol kod, har 5 xatoda kodlar yopiladi, IP/64 limitlari, holat mashinasi | E2E s11 E, unit `rules.test.ts` | Tuzatildi+test |
| S-09 | Barcha ilova limitlari fail-open (DB xatosida ruxsat) | Limitsiz hujum | Xavfsizlik limitlari `hitRate` — fail-closed (503) | unit (rules), E2E s11 | Tuzatildi+test |
| S-10 | `verification_requests` ga to'g'ridan-to'g'ri INSERT — `ai_review`, `submitted_data` ni soxtalash | Admin noto'g'ri qaror | INSERT/UPDATE/DELETE huquqi olindi (faqat RPC) | SQL B, `government` | Tuzatildi+test |
| S-11 | `notifications` ning har qanday ustunini (link, open_token, dedupe_key) o'zgartirish | Ochiq yo'naltirish, dedupe band qilish | Faqat `UPDATE(read_at)` | SQL B | Tuzatildi+test |
| S-12 | CSP, HSTS, frame-ancestors yo'q; admin panel ramkaga olinadi | XSS ta'siri, clickjacking | CSP (1-bosqich), HSTS, COOP; admin host `frame-ancestors 'none'` + XFO DENY | unit `headers.test.ts`, E2E s11 (CSP buzilishlari 0) | Tuzatildi+test |
| S-13 | `avatar_url`/`logo_url` ga ixtiyoriy URL (kuzatuv pikseli, bot token'li fayl URL) | Kuzatuv, kalit sizishi | DB triggeri: faqat o'z storage yo'li yoki `t.me/i/userpic`; CSP `img-src` | SQL H, E2E s11 H | Tuzatildi+test |
| S-14 | Ommaviy bucketlar ro'yxatini (list) har kim olardi | Barcha foydalanuvchi/portfolio fayllari ro'yxati | List faqat o'z papkasi (URL orqali ochish o'zgarmadi) | SQL A | Tuzatildi+test |
| S-15 | Masofa filtri aniq masofa bilan — ishchi joylashuvini trilateratsiya | Jismoniy xavfsizlik | Butun km, minimal 2 km | SQL (ta'rif tekshiruvi) | Tuzatildi+test (qolgan aniqlik ~1–2 km) |
| S-16 | Tasdiqlangan kompaniya/ish beruvchi nomini almashtirib nishonni saqlash | Soxta "tasdiqlangan" brend | Nom/STIR mijozdan o'zgarmaydi (qayta tasdiq admin orqali) | SQL B (2 ta) | Tuzatildi+test |
| S-17 | Egasi bootstrap: o'chirilgan super_admin qayta yoqilardi; SUPER_ADMIN_PHONES dagi raqam bilan har kim super_admin bo'lardi (SIM almashtirish) | Platformani egallash | Faqat server tasdiqlagan raqam, **faqat faol super_admin yo'q bo'lsa**, o'chirilgan admin qayta yoqilmaydi, rad → high hodisa | E2E s8 (16), s11 B | Tuzatildi+test |
| S-18 | Moderatsiya rasm yuklash `redirect: "follow"` va butun tanani o'qib keyin tekshirish | SSRF, xotira | Har yo'naltirish ishonchli ro'yxatda, oqim bilan hajm chegarasi | — | Tuzatildi (test NOT_RUN) |
| S-19 | AI uchun umumiy kunlik chegara yo'q | Xarajat hujumi | Funksiya bo'yicha va umumiy kunlik byudjet (fail-closed) + high hodisa | — | Tuzatildi (test NOT_RUN) |
| S-20 | Ishchi to'liqligi/ko'rishlar: begona ishchini qayta hisoblatish, to'liqlik tafsilotini o'qish, ko'rishlarni cheksiz oshirish | Reyting manipulyatsiyasi, ma'lumot | Faqat o'z/admin (to'g'ridan-to'g'ri chaqiruvda), ko'ruvchi×ishchi soatiga 1 | SQL (4 ta) | Tuzatildi+test |
| S-21 | Mijoz `last_active_at`, `created_at` (ishchi), `blocked_*`/`created_at` (profil) ni o'zgartira olardi | Reyting firibgarligi, audit buzilishi | Guard triggerlar | SQL B, E2E s11 B | Tuzatildi+test |
| S-22 | Ichki funksiyalar anon/authenticated uchun ochiq (`setting_bool` ixtiyoriy kalit oracle'i, `can_view_phone`, …) | Ma'lumot sizishi | Revoke; anon uchun ochiq SECURITY DEFINER funksiyalar aniq ro'yxat bilan testlanadi | SQL B (allowlist) | Tuzatildi+test |
| S-23 | Audit jurnali: service role o'chira/o'zgartira olardi, ilova rollarida TRUNCATE | Iz yo'qotish | Append-only huquqlar, TRUNCATE/REFERENCES/TRIGGER olindi | SQL I | Tuzatildi+test |

## Low

| ID | Topilma | Tuzatish | Holat |
|---|---|---|---|
| S-24 | initData 24 soat amal qilardi | 1 soat (+60 s soat farqi) | Tuzatildi+test (unit 5) |
| S-25 | Cookie'larda `Secure` yo'q | https'da Secure (Supabase, til, mavzu, welcome) | Tuzatildi (https da tekshiruv — production probe) |
| S-26 | `profile/actions.ts` `.or()` filtrida qisman ekranlash | Umumiy `safeFilterValue` | Tuzatildi+test (unit) |
| S-27 | `images.remotePatterns` — har qanday `*.supabase.co` | Faqat o'z loyihamiz + t.me | Tuzatildi |
| S-28 | `*_BASE_URL` / `TELEGRAM_API_BASE` env orqali kalitlarni begona serverga yuborish mumkin | Vercel production'da e'tiborsiz | Tuzatildi |
| S-29 | Webhook takroriy update'ni qayta ishlaydi | `telegram_updates` dedupe | Tuzatildi+test (E2E G) |
| S-30 | Limit kalitlarida ochiq telefon/IP | HMAC (`SECURITY_PEPPER`), deterministik tozalash (pg_cron) | Tuzatildi+test (E2E I) |
| S-31 | Promo rasm va CV PDF limitsiz | IP/foydalanuvchi limitlari | Tuzatildi |
| S-32 | O'lik kod: SMS OTP action'lari, Login Widget, `getCurrentUser` | O'chirildi | Tuzatildi |
| S-33 | Kod xeshi kaliti = service kaliti | Ixtiyoriy alohida `LOGIN_CODE_SECRET` | Tashqi (Vercel env) |
| S-34 | `callBot` timeout'siz | 10 s timeout | Tuzatildi |

Oldingi bosqich (df08d92): Next 16.3.8 va tranzitiv paketlar yangilandi (prod `npm audit` — 0), CI'da secret-scan va `npm audit --omit=dev`, CI token `contents: read`, shifrlangan kunlik zaxira (age).

## Qolgan xavf (ongli qabul qilingan yoki keyingi bosqich)

| ID | Xavf | Nima uchun hozir emas | Yumshatish / reja |
|---|---|---|---|
| R-01 | Sessiya bekor qilingandan keyin **o'qish** access token muddatigacha davom etadi (yozish darhol to'xtaydi) | RLS o'qish siyosatlarining hammasiga `iat` tekshiruvi qo'shish — katta yuk | Supabase → JWT expiry 3600 → 900–1800 s (Tashqi). Pre-request yozish/RPC'ni darhol to'xtatadi |
| R-02 | CSP `script-src 'unsafe-inline'` | Next.js App Router nonce'siz ishlamaydi; nonce barcha sahifalarni dinamik qiladi | 2-bosqich: nonce + `strict-dynamic` (SECURITY_PLAN) |
| R-03 | Yuklangan fayllarning haqiqiy turi (magic bytes) tekshirilmaydi, EXIF saqlanadi | Storage'ga brauzer to'g'ridan-to'g'ri yuklaydi | Bucket MIME/hajm cheklovi, ommaviy bucketlarda faqat rasm; reja: Edge Function bilan qayta kodlash |
| R-04 | Profil (tug'ilgan sana, jins) — `can_view_profile` bo'yicha ruxsatli ish beruvchilarga to'liq qator | Ustun huquqlari UI so'rovlarini buzadi | Mahsulot qarori; reja: ko'rinish (view) |
| R-05 | Kirgan foydalanuvchilar kompaniya `tin`/`created_by` ni ko'radi (anon — yo'q) | Admin/egasi so'rovlari `select *` | Tashkilot STIR'i ochiq reestr ma'lumoti |
| R-06 | `telegram_not_linked` javobi raqam ulanganini bildiradi | UX uchun kerak | Telefon/IP limitlari, HMAC |
| R-07 | KYC hujjatlari AI (Gemini) ga yuboriladi | Biznes qarori | Pullik tarif / maxfiylik siyosatida aytish (Tashqi) |
| R-08 | Admin TOTP birinchi ulashda TOFU | Supabase MFA modeli | Egasi bootstrap faqat birinchi marta; super_admin qo'lda |
| R-09 | Oddiy limitlar (`allowRate`) fail-open | Oddiy funksiyalar DB uzilishida to'xtamasin | Xavfsizlik limitlari fail-closed |
| R-10 | Yangi SQL funksiyalar standart bo'yicha anon'ga EXECUTE oladi (Supabase default privileges) | Platforma standarti | CI'dagi ro'yxat testi yangi ochiq funksiyani ushlaydi |
| R-11 | Dev-only 5 ta high (eslint-config-next → braces) | Faqat ishlab chiqish | Yangi versiya chiqqanda yangilash |
| R-12 | Supabase panel: ochiq ro'yxatdan o'tish, anonim kirish, Phone provider, legacy JWT kalitlari | Faqat panelda | SECURITY_RUNBOOK → "Provayder paneli" |
