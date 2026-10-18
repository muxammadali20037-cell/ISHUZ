# Ish topdim

> Ish qidirmang. O'zingizga mos ishni toping. · Ko'p CV ko'rmang. Sizga mos xodimni toping.

O'zbekiston bozori uchun ish topish va ishchi topish platformasi: **Telegram Mini App**, **responsive web-ilova (PWA)** va **admin panel** — bitta Next.js kod bazasi, bitta Supabase (PostgreSQL) backend, bitta hisob.

> Moderatsiya, moslik v2, Telegram obunasi, AI e'lon/qidiruv va alohida admin panel bo'yicha to'liq qo'llanma:
> [`docs/ISH_TOPDIM.md`](docs/ISH_TOPDIM.md) (muhit o'zgaruvchilari, Vault, webhook, admin domeni, sinovlar).

## Texnologiyalar

| Qatlam | Stack |
|---|---|
| Frontend | Next.js 16 (App Router, RSC, Server Actions), TypeScript strict, Tailwind v4, radix-ui + cva (shadcn uslubi), TanStack Query, react-hook-form + zod, lucide, framer-motion |
| Backend | Supabase: PostgreSQL 17, Auth (veb: kod Telegram bot orqali; Mini App: Telegram initData), Storage, Realtime, RLS, SQL RPC funksiyalar |
| Telegram | Mini App (initData server tomonda tekshiriladi), bot xabarnomalari, webhook |
| Mobil | PWA (hozir), arxitektura Expo React Native uchun tayyor (bir xil backend, API va tiplar) |
| i18n | O'zbek lotin, o'zbek kirill, rus, ingliz — `messages/{uz,oz,ru,en}/*.json` (`oz` — `scripts/gen-oz-messages.mjs`), `t()` |

Hujjatlar: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (platformalar, ERD, xavfsizlik modeli), [docs/CONVENTIONS.md](docs/CONVENTIONS.md) (kod qoidalari, RPC ro'yxati).

## Tez boshlash (lokal)

```bash
npm ci
cp .env.example .env.local        # [MAJBURIY]/[IXTIYORIY], [PUBLIC]/[SERVER] belgilari bilan
npm run dev                       # http://localhost:3000
```

Baza (Supabase loyihangizga migratsiyalarni qo'llash):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push              # supabase/migrations/*.sql tartib bilan
npm run db:types                  # src/types/database.types.ts ni yangilash (lokal DB dan)
```

Yoki Supabase Dashboard → SQL Editor da `supabase/migrations/0001…0058` fayllarini tartib bilan ishga tushiring (har biri bitta tranzaksiya).

> Production/staging/lokal holati (qaysi migratsiya qo'llangan, nima tashqi sozlama kutyapti) — [`docs/PROFESSIONALIZATION_REPORT.md`](docs/PROFESSIONALIZATION_REPORT.md) → "Reliz holati". Eski hisobotlar (`MASTER_SPEC_STATUS.md` va boshq.) sanasi bilan tarix sifatida qoladi.

Lokal PostgreSQL bilan sxema/RLS testlari (Supabase stub bilan, Docker shart emas):

```bash
npm run db:local                  # ishuz_dev bazasini qayta yaratib migratsiyalarni qo'llaydi
npm run db:test                   # 23 fayl SQL test: RLS, xavfsizlik, moslik, ariza/taklif/chat, custom kasb, admin
npm test                          # vitest (sof mantiq, server modullari)
npm run lint && npm run typecheck && npm run build
```

Brauzer E2E (izolyatsiyalangan stend: toza baza + PostgREST + Auth/Storage emulyatori; tashqi xizmatlarga murojaat yo'q):

```bash
bash e2e/stack/up.sh              # PostgreSQL 16 va postgrest binari kerak (POSTGREST_BIN)
npx playwright test -c e2e        # qoralamalar, qidiruv xatosi/bo'sh natija, "Kasbim topilmadi"
bash e2e/stack/down.sh
```
CI'da `e2e` job shu stendni ko'taradi; xato bo'lsa trace, skrinshot va loglar artefakt sifatida yuklanadi.

## Muhit o'zgaruvchilari

`.env.example` — har bir o'zgaruvchi majburiy/ixtiyoriy va public/server belgisi bilan (qiymatlarsiz). Funksiya bayroqlari
(to'lov, AI, admin, moderatsiya) matritsasi: `docs/PROFESSIONALIZATION_REPORT.md`.

## Supabase sozlamalari

1. **Kirish**: veb-saytda bir martalik kod **Telegram bot orqali** yuboriladi (`/api/auth/phone-code/*`, SMS provayder ishlatilmaydi); Mini App ichida — Telegram initData. Supabase'ning Phone provayderi va ochiq ro'yxatdan o'tish kerak emas — o'chirib qo'ying (`docs/SECURITY_RUNBOOK.md` §8). Telegram ulanmagan foydalanuvchi uchun SMS kerak bo'lsa — provayder va xarajat alohida qaror.
2. **Auth → URL Configuration**: Site URL = ilova manzili.
3. **Storage**: bucket'lar migratsiya bilan yaratiladi (`avatars`, `company-logos`, `portfolio` — public; `chat`, `documents` — private).
4. **Realtime**: `messages`, `notifications`, `applications`, `job_offers`, `conversations` jadvallari publikatsiyaga qo'shilgan (migratsiyada).
5. **Cron** — migratsiya `0015` bilan Supabase ichida (`pg_cron` + `pg_net`) sozlangan: `ishuz-maintenance` (har kuni 03:05 Toshkent) va `ishuz-telegram` (har daqiqa, faqat yuboriladigan bildirishnoma bo'lsa ilovani chaqiradi). Telegram yuborish uchun deploydan keyin bir marta SQL Editor'da:
   ```sql
   select vault.create_secret('https://<domen>', 'ishuz_app_url');
   select vault.create_secret('<CRON_SECRET qiymati>', 'ishuz_cron_secret');
   ```
6. Birinchi admin: `SUPER_ADMIN_PHONES` (tasdiqlangan telefon bilan kirgan egasi avtomatik super_admin bo'ladi) yoki SQL: `insert into public.admin_users (profile_id, role) values ('<auth.users.id>', 'super_admin');`
7. Telegram'siz zaxira kirish (email + parol + autentifikator kodi): `SUPER_ADMIN_EMAILS` va panelda «Kirish usullari» — [docs/ADMIN_LOGIN.md](docs/ADMIN_LOGIN.md).

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
