# Chat / Notifications / Telegram / Cron — modul so'rovlari

Modul: `src/features/chat`, `src/features/notifications`, `src/app/messages/**`, `src/app/notifications/**`,
`src/app/api/telegram/**`, `src/app/api/cron/**`, `messages/{uz,ru}/{chat,notifications}.json`.

## 1. `vercel.json` — cron jadvali (repo ildizi, modul tashqarisida)

```json
{
  "crons": [
    { "path": "/api/cron/notifications", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/vacancies", "schedule": "0 3 * * *" }
  ]
}
```

* Vercel Cron so'rovni **GET** bilan yuboradi va `CRON_SECRET` env mavjud bo'lsa `Authorization: Bearer <CRON_SECRET>`
  sarlavhasini avtomatik qo'shadi. Ikkala route ham GET va POST ni qabul qiladi; `x-cron-secret: <CRON_SECRET>` ham ishlaydi.
* `/api/cron/vacancies`: `expire_vacancies()` + `expire_offers()` + `notify_expiring_vacancies()` (service role).
* `/api/cron/notifications`: `telegram_sent_at is null and created_at > now() - 2 days`, `telegram_accounts.bot_started = true`,
  200 tadan, `renderNotification` (i18n, profil tili) → Telegram `sendMessage` (HTML + `web_app` tugma) → `telegram_sent_at = now()`.
  403 ("bot was blocked") → `telegram_accounts.bot_started = false`. 429/5xx/tarmoq → belgilanmaydi, keyingi safar qayta uriniladi.

## 2. Bir martalik Telegram sozlash

```
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/telegram/setup
```
`setWebhook(<APP_URL>/api/telegram/webhook, secret_token = TELEGRAM_WEBHOOK_SECRET)` + `setChatMenuButton` (web_app).
Webhook `x-telegram-bot-api-secret-token` ni tekshiradi (401), faqat `message` update'lari (allowed_updates = ["message"]).

## 3. `src/lib/telegram/bot.ts` ga taklif (ixtiyoriy)

`sendTelegramMessage` hozir xatoda faqat `null` qaytaradi — `error_code` yo'qoladi. Cron dispatcher 403 (bot bloklangan) ni ajratishi
uchun modul ichida `src/features/notifications/telegram-dispatch.ts#sendTelegramHtml` (bir xil payload, `error_code` bilan) yozildi.
Agar `bot.ts` da `callBot` natijasi `{ ok, result, error_code, description }` shaklida qaytarilsa, dispatcher shu umumiy funksiyaga o'tkaziladi.

## 4. `new_matching_worker` bildirishnomasi

Enum'da bor, lekin trigger/RPC hozircha yaratmaydi. Renderer quyidagi payload'ni kutadi (kelajakdagi funksiya uchun):
`{ worker_id, worker_name, vacancy_id, vacancy_title, score }`, link: `/employer/vacancies/<vacancy_id>/applications` yoki `/workers/<worker_id>`.

## 5. Lokal `ishuz_dev` bazasi eskirgan

`ishuz_dev` da `worker_completeness` (`tips := tips || 'add_photo'` → "malformed array literal"), `unaccent` ruxsati va
`conversation_members` RLS rekursiyasi xatolari bor; toza bazada (`scripts/db-local.sh` bilan yangi DB) migratsiyalar to'g'ri ishlaydi —
`ishuz_dev` ni qayta yaratish tavsiya etiladi: `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ishuz_dev bash scripts/db-local.sh`.

## 6. `next.config.ts` (ixtiyoriy)

Chat rasmlari yopiq bucket'dan imzolangan URL bilan `<img>` orqali ko'rsatiladi (next/image `remotePatterns` sozlanmagani uchun).
Agar `images.remotePatterns` ga Supabase storage domeni qo'shilsa, `src/features/chat/components/attachment.tsx` da `next/image` ga o'tish mumkin.
