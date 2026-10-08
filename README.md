# Ish beruvchi (ISH.UZ)

> Ish qidirmang. O'zingizga mos ishni toping. · Ko'p CV ko'rmang. Sizga mos xodimni toping.

O'zbekiston bozori uchun ish topish va ishchi topish platformasi: **Telegram Mini App**, **responsive web-ilova (PWA)** va **admin panel** — bitta Next.js kod bazasi, bitta Supabase (PostgreSQL) backend, bitta hisob.

## Texnologiyalar

| Qatlam | Stack |
|---|---|
| Frontend | Next.js 16 (App Router, RSC, Server Actions), TypeScript strict, Tailwind v4, radix-ui + cva (shadcn uslubi), TanStack Query, react-hook-form + zod, lucide, framer-motion |
| Backend | Supabase: PostgreSQL 17, Auth (telefon OTP + Telegram), Storage, Realtime, RLS, SQL RPC funksiyalar |
| Telegram | Mini App (initData server tomonda tekshiriladi), bot xabarnomalari, webhook |
| Mobil | PWA (hozir), arxitektura Expo React Native uchun tayyor (bir xil backend, API va tiplar) |
| i18n | O'zbek (lotin) va rus tili — `messages/{uz,ru}/*.json`, `t()` |

Hujjatlar: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (platformalar, ERD, xavfsizlik modeli), [docs/CONVENTIONS.md](docs/CONVENTIONS.md) (kod qoidalari, RPC ro'yxati).

## Tez boshlash (lokal)

```bash
npm install
cp .env.example .env.local        # Supabase URL/kalitlar, Telegram token
npm run dev                       # http://localhost:3000
```

Baza (Supabase loyihangizga migratsiyalarni qo'llash):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push              # supabase/migrations/*.sql tartib bilan
npm run db:types                  # src/types/database.types.ts ni yangilash (lokal DB dan)
```

Yoki Supabase Dashboard → SQL Editor da `supabase/migrations/0001…0014` fayllarini tartib bilan ishga tushiring.

> Ishlab chiqarish loyihasi `ISHUZ` (ref `oquqqubmicldvreeqgsg`, ap-south-1) ga 0001–0014 migratsiyalar qo'llangan (0012 seed to'rt qismga bo'lib: 0012a–0012d). `NEXT_PUBLIC_SUPABASE_URL=https://oquqqubmicldvreeqgsg.supabase.co`.

Lokal PostgreSQL bilan sxema/RLS testlari (Supabase stub bilan, Docker shart emas):

```bash
npm run db:local                  # ishuz_dev bazasini qayta yaratib migratsiyalarni qo'llaydi
npm run db:test                   # 140+ SQL test: RLS, moslik, ariza/taklif/chat oqimlari, admin
npm test                          # vitest (moslik dvigateli, sof mantiq)
npm run lint && npm run typecheck && npm run build
```

## Muhit o'zgaruvchilari

`.env.example` ga qarang. Asosiylari: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (faqat server),
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.

## Supabase sozlamalari

1. **Auth → Providers → Phone**: SMS provayder (Twilio / MessageBird / Vonage yoki [custom SMS hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) orqali Eskiz/Playmobile). Telefon OTP shu orqali ishlaydi.
2. **Auth → URL Configuration**: Site URL = ilova manzili.
3. **Storage**: bucket'lar migratsiya bilan yaratiladi (`avatars`, `company-logos`, `portfolio` — public; `chat`, `documents` — private).
4. **Realtime**: `messages`, `notifications`, `applications`, `job_offers`, `conversations` jadvallari publikatsiyaga qo'shilgan (migratsiyada).
5. **Cron** — migratsiya `0015` bilan Supabase ichida (`pg_cron` + `pg_net`) sozlangan: `ishuz-maintenance` (har kuni 03:05 Toshkent) va `ishuz-telegram` (har daqiqa, faqat yuboriladigan bildirishnoma bo'lsa ilovani chaqiradi). Telegram yuborish uchun deploydan keyin bir marta SQL Editor'da:
   ```sql
   select vault.create_secret('https://<domen>', 'ishuz_app_url');
   select vault.create_secret('<CRON_SECRET qiymati>', 'ishuz_cron_secret');
   ```
6. Birinchi adminni tayinlash: `insert into public.admin_users (profile_id, role) values ('<auth.users.id>', 'super_admin');`

## Telegram

1. @BotFather → bot yarating → token `TELEGRAM_BOT_TOKEN`.
2. Bot Settings → Menu Button / Mini App uchun ilova HTTPS manzili.
3. Deploydan keyin bir marta: `curl -X POST https://<domen>/api/telegram/setup -H "Authorization: Bearer $CRON_SECRET"` — webhook va menyu tugmasi o'rnatiladi.
4. Mini App ichida foydalanuvchi avtomatik kiradi (`/api/auth/telegram` initData imzosini tekshiradi). Telefon orqali kirgan foydalanuvchi Sozlamalar → Telegram orqali hisobini bog'laydi.

## Deploy (Vercel)

1. [vercel.com/new](https://vercel.com/new) → GitHub repo'ni import qiling (Framework: Next.js, sozlamalar standart).
2. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `APP_URL`, `CRON_SECRET` (masalan `openssl rand -hex 32`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` → Deploy.
3. `vercel.json` funksiyalarni `bom1` (Mumbai) regionida ishga tushiradi — Supabase (ap-south-1) bilan bir joyda. Cron'lar Vercel'da emas, Supabase `pg_cron` da (Hobby tarifi cheklovi yo'q).
4. Domen (masalan `ishtopdim.uz`) → `APP_URL`, `NEXT_PUBLIC_APP_URL`, Supabase Site URL va BotFather'dagi Mini App manziliga yozing.

## Mobil ilova

Sayt to'liq PWA (manifest, PNG/maskable ikonkalar, service worker, oflayn sahifa):

- **Telefonga o'rnatish (hozir):** Android Chrome → ⋮ → "Ilovani o'rnatish"; iPhone Safari → Ulashish → "Bosh ekranga qo'shish".
- **Google Play (Android, TWA) va Google qidiruvi:** bosqichma-bosqich qo'llanma, do'kon matnlari va rasmlar — [`docs/PLAY_MARKET.md`](docs/PLAY_MARKET.md) (paket: `uz.ishtopdim.app`).
- **App Store (iOS):** Mac + Apple Developer ($99/yil) kerak; Capacitor bilan o'raladi va push-bildirishnoma kabi native imkoniyat qo'shiladi.

## Tuzilma

```
src/app            yo'llar (public: /, /jobs, /jobs/[slug], /company/[slug]; app: /onboarding, /applications, /offers, /messages, /saved,
                   /notifications, /profile, /settings, /workers, /employer/**, /company/settings; admin: /admin/**; api: /api/**)
src/features       modullar: auth, onboarding, jobs, worker, profile, employer, vacancies, workers, applications, offers, chat,
                   notifications, matching, reports, contacts, admin, landing
src/components     ui (dizayn tizimi), shared (Shell, VacancyCard, WorkerCard, MatchScore ...)
src/lib            supabase, i18n, format, telegram, reference, env
supabase/          migrations (sxema, funksiyalar, RLS, storage, seed), tests (SQL)
messages/          uz/*.json, ru/*.json
legacy/express-v1  birinchi prototip (Express + SQLite) — faqat tarix uchun
```

## Moslik (matching)

Qoidaga asoslangan: kategoriya 25 · joylashuv 15 · maosh 15 · tajriba 10 · ko'nikmalar 15 · grafik 10 · bandlik/rasmiylik 5 · til 5 = 100.
SQL (`public.compute_match`) va TypeScript (`src/features/matching`) versiyalari bir xil; parity testi bilan tekshiriladi. Sabablar foydalanuvchiga ko'rsatiladi ("✓ Kasbingiz mos", "⚠ Rus tili talab qilinadi"). `MatchEngine` interfeysi kelajakda AI modelga almashtirishga tayyor.

## AI yordamchi va to'lovlar

**Sodda jarayonlar** (bosh sahifa → "Ish qidiryapman" / "Ishchi qidiryapman" / "Qidirish") — [docs/SIMPLE_UX.md](docs/SIMPLE_UX.md).

**Kasb rasmlari** — har kasb uchun bir marta yaratiladi (fonda) va qayta ishlatiladi; kalit bo'lmasa soha ikonkasi ko'rinadi.
`IMAGE_GEN_API_KEY` (Google AI Studio, matnli AI kalitidan alohida), ixtiyoriy `IMAGE_GEN_MODEL` (standart `gemini-2.5-flash-image`).
Kunlik limit — `app_settings.profession_images_daily_limit`.

**AI** — ishchi o'zi haqida, ish beruvchi vakansiya haqida erkin yozadi, AI bo'limlarga ajratadi.
Vercel → Environment Variables (bittasi kifoya; ikkalasi bo'lsa Gemini ishlatiladi):
- `GEMINI_API_KEY` — bepul: https://aistudio.google.com/apikey (ixtiyoriy `GEMINI_MODEL`, standart `gemini-flash-latest`)
- `ANTHROPIC_API_KEY` — pullik Claude: console.anthropic.com

Kalit bo'lmasa AI tugmalari ko'rinmaydi.

**To'lovlar** (narxlar `app_settings` da, admin → Sozlamalar'dan o'zgartiriladi):

| Xizmat | Narx | Bepul |
|---|---|---|
| Vakansiya e'loni (30 kun) | `price_vacancy_publish` = 50 000 so'm | birinchisi — 24 soat |
| Ishchi profili TOP (24 soat) | `price_worker_promotion` = 20 000 so'm | birinchisi |
| Aksiya | `billing_free_until` gacha hammasi bepul | |

Payme (merchant kabinetda endpoint: `https://<domen>/api/payments/payme`, hisob maydoni `order_id`):
`PAYME_MERCHANT_ID`, `PAYME_KEY` (test uchun `PAYME_TEST=1`).

Click (Prepare va Complete URL: `https://<domen>/api/payments/click`):
`CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`.

To'lov holati faqat server funksiyalarida o'zgaradi (`0019_billing.sql`), testlar: `supabase/tests/billing.test.sql`.
