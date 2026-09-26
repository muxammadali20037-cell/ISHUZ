# ISH.UZ

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

Yoki Supabase Dashboard → SQL Editor da `supabase/migrations/0001…0012` fayllarini tartib bilan ishga tushiring.

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
5. **Cron** (ixtiyoriy, pg_cron): `select cron.schedule('expire', '0 3 * * *', $$select public.expire_vacancies(); select public.expire_offers(); select public.notify_expiring_vacancies();$$);` — yoki Vercel cron (`vercel.json`) `/api/cron/vacancies` ni chaqiradi.
6. Birinchi adminni tayinlash: `insert into public.admin_users (profile_id, role) values ('<auth.users.id>', 'super_admin');`

## Telegram

1. @BotFather → bot yarating → token `TELEGRAM_BOT_TOKEN`.
2. Bot Settings → Menu Button / Mini App uchun ilova HTTPS manzili.
3. Deploydan keyin bir marta: `curl -X POST https://<domen>/api/telegram/setup -H "Authorization: Bearer $CRON_SECRET"` — webhook va menyu tugmasi o'rnatiladi.
4. Mini App ichida foydalanuvchi avtomatik kiradi (`/api/auth/telegram` initData imzosini tekshiradi). Telefon orqali kirgan foydalanuvchi Sozlamalar → Telegram orqali hisobini bog'laydi.

## Deploy (Vercel)

1. Repo'ni Vercel'ga ulang, env o'zgaruvchilarini kiriting.
2. `vercel.json` cron'lari avtomatik ishlaydi (`CRON_SECRET` Vercel tomonidan yuboriladi).
3. Domen (`ishuz.uz`) → `APP_URL`, `NEXT_PUBLIC_APP_URL`, Supabase Site URL va BotFather'dagi Mini App manziliga yozing.

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
