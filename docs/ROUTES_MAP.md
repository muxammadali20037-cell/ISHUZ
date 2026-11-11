# Marshrutlar xaritasi (ROUTES_MAP)

> Avtomatik yaratilgan: `src/app` dagi har bir `page.tsx` va `route.ts` dan (skript: `scripts/gen-docs.py`).
> "Kirish" ustuni sahifa kodidagi himoya chaqiruvidan aniqlangan (`requireSession` / `requireEmployer` / `requireWorker`),
> admin bo'limi `src/app/admin/(panel)/layout.tsx` da himoyalangan. Qo'lda tahrirlamang — skriptni qayta ishga tushiring.

Jami: **102 sahifa**, **24 API / maxsus marshrut**.

## A. Ochiq sayt (14)

| Marshrut | Kirish | Fayl |
| --- | --- | --- |
| `/` | ochiq; mehmonga alohida ko'rinish | `src/app/(home)/page.tsx` |
| `/about` | ochiq | `src/app/about/page.tsx` |
| `/companies` | ochiq | `src/app/companies/page.tsx` |
| `/company/[slug]` | ochiq; mehmonga alohida ko'rinish | `src/app/company/[slug]/page.tsx` |
| `/dunyo` | kirgan foydalanuvchi | `src/app/dunyo/page.tsx` |
| `/for-employers` | ochiq | `src/app/for-employers/page.tsx` |
| `/help` | ochiq | `src/app/help/page.tsx` |
| `/jobs` | ochiq | `src/app/jobs/(list)/page.tsx` |
| `/jobs/[slug]` | ochiq; mehmonga alohida ko'rinish | `src/app/jobs/[slug]/page.tsx` |
| `/jobs/[slug]/moslik` | kirgan foydalanuvchi | `src/app/jobs/[slug]/moslik/page.tsx` |
| `/kasblar` | ochiq | `src/app/kasblar/page.tsx` |
| `/privacy` | ochiq | `src/app/privacy/page.tsx` |
| `/students` | ochiq | `src/app/students/page.tsx` |
| `/terms` | ochiq | `src/app/terms/page.tsx` |

## Kirish va onboarding (12)

| Marshrut | Kirish | Fayl |
| --- | --- | --- |
| `/auth` | ochiq | `src/app/auth/page.tsx` |
| `/auth/admin` | ochiq | `src/app/auth/admin/page.tsx` |
| `/auth/admin/havola` | ochiq | `src/app/auth/admin/havola/page.tsx` |
| `/auth/admin/tiklash` | ochiq | `src/app/auth/admin/tiklash/page.tsx` |
| `/auth/telefon` | ochiq | `src/app/auth/telefon/page.tsx` |
| `/blocked` | ochiq | `src/app/blocked/page.tsx` |
| `/onboarding` | kirgan foydalanuvchi | `src/app/onboarding/page.tsx` |
| `/start` | ochiq; mehmonga alohida ko'rinish | `src/app/start/page.tsx` |
| `/start/rol` | ochiq | `src/app/start/rol/page.tsx` |
| `/start/tanishtiruv` | ochiq | `src/app/start/tanishtiruv/page.tsx` |
| `/start/tayyor` | kirgan foydalanuvchi | `src/app/start/tayyor/page.tsx` |
| `/start/til` | ochiq | `src/app/start/til/page.tsx` |

## B. Ish izlovchi (20)

| Marshrut | Kirish | Fayl |
| --- | --- | --- |
| `/ai-alerts` | kirgan foydalanuvchi | `src/app/ai-alerts/page.tsx` |
| `/applications` | kirgan foydalanuvchi | `src/app/applications/page.tsx` |
| `/applications/[id]` | ish izlovchi | `src/app/applications/[id]/page.tsx` |
| `/cabinet` | ochiq; mehmonga alohida ko'rinish | `src/app/cabinet/page.tsx` |
| `/cabinet/alerts` | kirgan foydalanuvchi | `src/app/cabinet/alerts/page.tsx` |
| `/cabinet/matches` | kirgan foydalanuvchi | `src/app/cabinet/matches/page.tsx` |
| `/cabinet/verification` | kirgan foydalanuvchi | `src/app/cabinet/verification/page.tsx` |
| `/listing/[id]` | ochiq; mehmonga alohida ko'rinish | `src/app/listing/[id]/page.tsx` |
| `/offers` | kirgan foydalanuvchi | `src/app/offers/page.tsx` |
| `/offers/[id]` | kirgan foydalanuvchi | `src/app/offers/[id]/page.tsx` |
| `/onboarding/worker` | kirgan foydalanuvchi | `src/app/onboarding/worker/page.tsx` |
| `/onboarding/worker/ai` | kirgan foydalanuvchi | `src/app/onboarding/worker/ai/page.tsx` |
| `/post/worker` | ochiq; mehmonga alohida ko'rinish | `src/app/post/worker/page.tsx` |
| `/profile` | kirgan foydalanuvchi | `src/app/profile/page.tsx` |
| `/profile/cv` | ish izlovchi | `src/app/profile/cv/page.tsx` |
| `/profile/edit` | ish izlovchi | `src/app/profile/edit/page.tsx` |
| `/profile/listing` | ish izlovchi | `src/app/profile/listing/page.tsx` |
| `/profile/portfolio` | ish izlovchi | `src/app/profile/portfolio/page.tsx` |
| `/profile/profession` | ish izlovchi | `src/app/profile/profession/page.tsx` |
| `/saved` | ochiq; mehmonga alohida ko'rinish | `src/app/saved/page.tsx` |

## C. Ish beruvchi (20)

| Marshrut | Kirish | Fayl |
| --- | --- | --- |
| `/billing` | kirgan foydalanuvchi | `src/app/billing/page.tsx` |
| `/billing/return` | kirgan foydalanuvchi | `src/app/billing/return/page.tsx` |
| `/company/join` | kirgan foydalanuvchi | `src/app/company/join/page.tsx` |
| `/company/settings` | ish beruvchi | `src/app/company/settings/page.tsx` |
| `/employer` | ish beruvchi | `src/app/employer/page.tsx` |
| `/employer/applications` | ish beruvchi | `src/app/employer/applications/page.tsx` |
| `/employer/candidates` | ish beruvchi | `src/app/employer/candidates/page.tsx` |
| `/employer/saved` | ish beruvchi | `src/app/employer/saved/page.tsx` |
| `/employer/vacancies` | ish beruvchi | `src/app/employer/vacancies/page.tsx` |
| `/employer/vacancies/[id]` | ish beruvchi | `src/app/employer/vacancies/[id]/page.tsx` |
| `/employer/vacancies/[id]/applications` | ish beruvchi | `src/app/employer/vacancies/[id]/applications/page.tsx` |
| `/employer/vacancies/[id]/applications/[applicationId]` | ish beruvchi | `src/app/employer/vacancies/[id]/applications/[applicationId]/page.tsx` |
| `/employer/vacancies/[id]/edit` | ish beruvchi | `src/app/employer/vacancies/[id]/edit/page.tsx` |
| `/employer/vacancies/new` | ish beruvchi | `src/app/employer/vacancies/new/page.tsx` |
| `/employer/vacancies/new/ai` | ish beruvchi | `src/app/employer/vacancies/new/ai/page.tsx` |
| `/onboarding/employer` | kirgan foydalanuvchi | `src/app/onboarding/employer/page.tsx` |
| `/post/vacancy` | ochiq; mehmonga alohida ko'rinish | `src/app/post/vacancy/page.tsx` |
| `/pricing` | ochiq | `src/app/pricing/page.tsx` |
| `/workers` | ish beruvchi | `src/app/workers/page.tsx` |
| `/workers/[id]` | ish beruvchi | `src/app/workers/[id]/page.tsx` |

## Umumiy (ikkala rol) (9)

| Marshrut | Kirish | Fayl |
| --- | --- | --- |
| `/account-deletion` | ochiq | `src/app/account-deletion/page.tsx` |
| `/ai` | ochiq; mehmonga alohida ko'rinish | `src/app/ai/page.tsx` |
| `/dev/ui` | ochiq | `src/app/dev/ui/page.tsx` |
| `/messages` | kirgan foydalanuvchi | `src/app/messages/page.tsx` |
| `/messages/[id]` | kirgan foydalanuvchi | `src/app/messages/[id]/page.tsx` |
| `/messages/new` | kirgan foydalanuvchi | `src/app/messages/new/page.tsx` |
| `/notifications` | kirgan foydalanuvchi | `src/app/notifications/page.tsx` |
| `/search` | ochiq; mehmonga alohida ko'rinish | `src/app/search/page.tsx` |
| `/settings` | kirgan foydalanuvchi | `src/app/settings/page.tsx` |

## D. Admin paneli (27)

| Marshrut | Kirish | Fayl |
| --- | --- | --- |
| `/admin` | admin (rol + aal2) | `src/app/admin/(panel)/page.tsx` |
| `/admin/account` | admin (rol + aal2) | `src/app/admin/(panel)/account/page.tsx` |
| `/admin/analytics` | admin (rol + aal2) | `src/app/admin/(panel)/analytics/page.tsx` |
| `/admin/audit` | admin (rol + aal2) | `src/app/admin/(panel)/audit/page.tsx` |
| `/admin/categories` | admin (rol + aal2) | `src/app/admin/(panel)/categories/page.tsx` |
| `/admin/employers` | admin (rol + aal2) | `src/app/admin/(panel)/employers/page.tsx` |
| `/admin/entry` | admin (rol + aal2) | `src/app/admin/(panel)/entry/page.tsx` |
| `/admin/home` | admin (rol + aal2) | `src/app/admin/(panel)/home/page.tsx` |
| `/admin/matching` | admin (rol + aal2) | `src/app/admin/(panel)/matching/page.tsx` |
| `/admin/mfa` | admin (rol + aal2) | `src/app/admin/mfa/page.tsx` |
| `/admin/moderation` | admin (rol + aal2) | `src/app/admin/(panel)/moderation/page.tsx` |
| `/admin/notifications` | admin (rol + aal2) | `src/app/admin/(panel)/notifications/page.tsx` |
| `/admin/payments` | admin (rol + aal2) | `src/app/admin/(panel)/payments/page.tsx` |
| `/admin/professions` | admin (rol + aal2) | `src/app/admin/(panel)/professions/page.tsx` |
| `/admin/queues` | admin (rol + aal2) | `src/app/admin/(panel)/queues/page.tsx` |
| `/admin/regions` | admin (rol + aal2) | `src/app/admin/(panel)/regions/page.tsx` |
| `/admin/reports` | admin (rol + aal2) | `src/app/admin/(panel)/reports/page.tsx` |
| `/admin/reviews` | admin (rol + aal2) | `src/app/admin/(panel)/reviews/page.tsx` |
| `/admin/search` | admin (rol + aal2) | `src/app/admin/(panel)/search/page.tsx` |
| `/admin/security` | admin (rol + aal2) | `src/app/admin/(panel)/security/page.tsx` |
| `/admin/settings` | admin (rol + aal2) | `src/app/admin/(panel)/settings/page.tsx` |
| `/admin/skills` | admin (rol + aal2) | `src/app/admin/(panel)/skills/page.tsx` |
| `/admin/telegram` | admin (rol + aal2) | `src/app/admin/(panel)/telegram/page.tsx` |
| `/admin/users` | admin (rol + aal2) | `src/app/admin/(panel)/users/page.tsx` |
| `/admin/vacancies` | admin (rol + aal2) | `src/app/admin/(panel)/vacancies/page.tsx` |
| `/admin/verifications` | admin (rol + aal2) | `src/app/admin/(panel)/verifications/page.tsx` |
| `/admin/workers` | admin (rol + aal2) | `src/app/admin/(panel)/workers/page.tsx` |

## API va maxsus marshrutlar

| Marshrut |
| --- |
| `/.well-known/assetlinks.json` |
| `/admin/analytics/export` |
| `/api/auth/admin/password` |
| `/api/auth/admin/recover` |
| `/api/auth/phone-code/send` |
| `/api/auth/phone-code/verify` |
| `/api/auth/telegram` |
| `/api/auth/telegram/link` |
| `/api/cron/notifications` |
| `/api/cron/profession-images` |
| `/api/cron/tick` |
| `/api/cron/vacancies` |
| `/api/cv/pdf` |
| `/api/e` |
| `/api/health` |
| `/api/payments/click` |
| `/api/payments/payme` |
| `/api/profession-images` |
| `/api/professions/nodes` |
| `/api/professions/search` |
| `/api/professions/trail` |
| `/api/telegram/setup` |
| `/api/telegram/webhook` |
| `/r/[token]` |
