# Ish topdim — moderatsiya, moslik, Telegram, AI va admin panel

> «Siz e'lon berasiz. Tizim sizga mos ish yoki ishchini topib, xabar beradi.»

Bu hujjat 0048–0053 migratsiyalari va ular bilan bog'liq kodni, tashqi sozlamalarni va hali kalit
kerak bo'lgan joylarni tushuntiradi.

## 1. Imkoniyatlar

| Bo'lim | Nima qiladi | Asosiy fayllar |
| --- | --- | --- |
| Majburiy moderatsiya | Faqat ish/ishchi e'lonlari. Normalizatsiya (lotin/kirill, raqam bilan yashirilgan harflar) → qoidalar → AI (qat'iy sxema) → rasm va undagi yozuv. Natija aynan shu versiyaga bog'lanadi; tahrir qayta tekshiriladi; AI ishlamasa e'lon kutishda qoladi. | `supabase/migrations/0049_moderation.sql`, `src/features/moderation/*` |
| Qayta ko'rib chiqish | Rad etilgan e'lon uchun «Qayta ko'rib chiqishni so'rash» — admin navbatida. | `request_moderation_appeal`, `/admin/moderation?tab=appeals` |
| Ish beruvchi tasdig'i | unverified / pending / verified / rejected / suspended. Birinchi vakansiya tasdiqlanguncha ommaga chiqmaydi. Admin nima tekshirilganini belgilaydi (telefon, nom, hudud, STIR, hujjat). AI faqat nomuvofiqlik eslatmasi beradi. Hujjatlar maxfiy bucketda, imzolangan havola bilan. | `admin_set_employer_status`, `src/features/verification/*` |
| Moslik foizi v2 | Hisoblanadi va izohlanadi (AI taxmini emas). Og'irliklar 25/15/15/10/15/10/5/5, majburiy shartlar, noma'lum ma'lumot — 0 ball, maosh oylikka keltiriladi, qoidalar versiyalanadi. | `0050_matching_v2.sql` |
| Ikki tomonlama xabar | Nashr/yangilanish → navbat → moslik → ≥90% va to'liq ma'lumot bo'lsa Telegram. Bir juftlik uchun bitta xabar, kunlik limit, bir nechta moslik bitta xabarda, kuzatiladigan havola (`/r/<token>`). | `0051_match_notifications.sql`, `src/features/notifications/*` |
| Telegram obunasi | Bir martalik token (`/start sub_<token>`, 15 daqiqa, bazada faqat sha256 xeshi). Bot yoza olmaguncha «yoqildi» ko'rsatilmaydi. Username bo'yicha bog'lanmaydi. | `src/features/alerts/*`, `/cabinet/alerts` |
| AI bilan tez tayyorlash | Ishchi va vakansiya uchun. Kasb/hudud bazadan topiladi; matnda yo'q maosh, tajriba, jadval, ism olib tashlanadi; avtomatik joylanmaydi. | `src/features/post/ai-actions.ts`, `ai-guard.ts` |
| Aqlli qidiruv | Avval lug'at qoidalari, kerak bo'lsa AI (qat'iy sxema). Natija faqat bazadan. Kunlik maosh oylikka tenglashtirilmaydi. AI ishlamasa — qoidalar. | `src/features/find/smart.ts`, `ai-search.ts` |
| Admin panel | Alohida host, TOTP (aal2), rollar (super_admin, admin, moderator, support, analyst), moderatsiya navbati, ish beruvchilar, moslik qoidalari, navbatlar monitoringi, statistika (Toshkent vaqti) + CSV. | `src/app/admin/*`, `src/proxy.ts`, `0052`, `0053` |
| Statistika | Faqat haqiqiy hodisalar. «Qo'ng'iroq» bosilishi ishga olish emas; Telegram'da yetkazilgan xabar «o'qilgan» emas (ochilish faqat havola orqali). | `admin_stats_v2`, `/api/e` |
| Brend | «Ish topdim», yangi belgi (portfel + belgi), sahifalar orasida yo'nalishli o'tishlar. | `public/icon.svg`, `src/app/template.tsx` |

## 2. Migratsiyalar

`0048_trust_enum_values` · `0049_moderation` · `0050_matching_v2` · `0051_match_notifications` ·
`0052_admin_analytics` · `0053_admin_panel` — tartib bilan qo'llanadi. Mavjud e'lonlar 0049 dan keyin
qayta tekshiruvga tushadi (natija chiqquncha yashirin) — AI kaliti va cron ishlayotgan bo'lishi kerak.

## 3. Muhit o'zgaruvchilari (Vercel)

Majburiy: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`APP_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
`TELEGRAM_WEBHOOK_SECRET`.

AI: `GEMINI_API_KEY` (yoki `ANTHROPIC_API_KEY`), ixtiyoriy `GEMINI_MODEL`. Kasb rasmlari: `IMAGE_GEN_API_KEY`.

Admin: `ADMIN_HOST=admin.<domen>` (bo'sh bo'lsa panel asosiy domenda `/admin` da — faqat lokal uchun).

Kalitlarni hech qachon chatga yoki kodga yozmang — faqat Vercel → Settings → Environment Variables.

## 4. Tashqi sozlamalar

1. **Supabase Vault** (SQL Editor): `select vault.create_secret('https://<domen>', 'ishuz_app_url');`
   va `select vault.create_secret('<CRON_SECRET>', 'ishuz_cron_secret');` — pg_cron har daqiqa
   `/api/cron/tick` ni chaqiradi (moderatsiya navbati, moslik, Telegram yuborish).
2. **Telegram webhook**: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domen>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`.
   BotFather → Bot Settings → Menu Button / Mini App manzili — asosiy domen.
3. **Admin domeni**: Vercel → Project → Domains → `admin.<domen>` qo'shing; DNS'da `admin` uchun CNAME
   `cname.vercel-dns.com`. Keyin `ADMIN_HOST=admin.<domen>`. Bu misol domen — o'zingiznikini qo'ying;
   sozlanmaguncha u ishlamaydi.
4. **Supabase Auth → MFA**: TOTP yoqilgan bo'lsin (standart yoqilgan). Admin birinchi kirishda QR kodni
   autentifikator ilovaga qo'shadi. `app_settings.admin_mfa_required = true` (standart).
5. **Admin qo'shish**: faqat `super_admin` `/admin/settings` → Adminlar bo'limidan; ommaviy ro'yxatdan o'tish yo'q.

## 5. Sinovlar

- SQL: `supabase/tests/*.test.sql` (19 to'plam, 524 tekshiruv), shu jumladan `moderation.test.sql` (90).
- Unit: `npm test` (400 test) — qoidalar, normalizatsiya, AI hukmi, AI guard, aqlli qidiruv, davr (Toshkent),
  admin host yo'naltirishi, tarjima kalitlari.
- E2E (soxta Gemini va Telegram bilan, 360/390/1280 px): AI e'lon (ishchi/vakansiya), taqiqlangan matn
  (lotin, kirill, raqamli yashirish), rad etish → tahrir → qayta tekshiruv, AI uzilishi va noto'g'ri format,
  rasm ichidagi yozuv, aqlli qidiruv, admin MFA/navbat/tasdiqlash/CSV, REST orqali chetlab o'tish urinishlari,
  Telegram obunasi (bir martalik token).

## 6. Hali kalit yoki qo'lda sozlash kerak bo'lgan joylar

- `GEMINI_API_KEY` (yoki `ANTHROPIC_API_KEY`) qo'yilmaguncha yangi e'lonlar «tekshiruvda» kutadi
  (avtomatik tasdiq yo'q) va AI tugmalari ko'rinmaydi.
- Telegram webhook va Vault sirlari qo'yilmaguncha xabarlar yuborilmaydi.
- `admin.<domen>` DNS va `ADMIN_HOST` sozlanmaguncha admin panel prod'da ochilmaydi (asosiy domenda 404).
- Play Market: yangi ikon tayyor (`docs/play-store/icon-512.png`), lekin feature-graphic va skrinshotlarda
  eski nom bor — yangidan olish kerak. Paket nomi `uz.ishtopdim.app` (ilova avval eski paket bilan yuklangan
  bo'lsa `ANDROID_PACKAGE_NAME` eski qiymatda qolsin).
