# ISH.UZ — kod konventsiyalari (barcha modullar uchun majburiy)

## Stack
Next.js 16 (App Router, `src/app`), TypeScript strict (`noUncheckedIndexedAccess`), Tailwind v4 (tokenlar `src/app/globals.css`),
radix-ui + cva komponentlar (`src/components/ui`), TanStack Query (client fetch/mutation), zod v4 + react-hook-form (formalar),
Supabase (`@supabase/ssr`), lucide-react ikonkalar, framer-motion (faqat zarur joyda).

## Papkalar
```
src/app/<route>/page.tsx            faqat routing, metadata, sessiya tekshiruvi, feature komponentini chaqirish
src/features/<module>/
  components/                       UI (server + client komponentlar)
  queries.ts                        server-side o'qish funksiyalari (createClient() bilan)
  actions.ts                        "use server" mutatsiyalar (zod validatsiya → supabase/rpc → ActionResult)
  schema.ts                         zod sxemalar (client va server bir xil)
  types.ts                          modul tiplari
messages/uz/<module>.json           tarjimalar (ru ham). Kalit: "<module>.<section>.<key>"
```
Modul o'z papkasidan tashqaridagi fayllarni O'ZGARTIRMAYDI (faqat o'z `messages/*/<module>.json`, o'z `src/features/<module>`, o'z `src/app/<routes>`).
Umumiy narsalar (`src/components/shared`, `src/lib`, `src/components/ui`) mavjud holicha ishlatiladi; yetishmasa — o'z modulida yozib, `docs/db-requests/<module>.md` ga qayd qiling.

## Sessiya va himoya
```ts
import { getSession, requireSession, requireWorker, requireEmployer, requireAdmin } from "@/features/auth/session";
const session = await requireWorker("/applications"); // redirect qiladi; session.workerId mavjud
```
Client'dagi rolga ISHONMANG. Har page/action serverda tekshiradi. RLS oxirgi himoya.

## Supabase
- Server komponent / action / route handler: `const supabase = await createClient()` (`@/lib/supabase/server`).
- Client komponent: `const supabase = createClient()` (`@/lib/supabase/client`) — faqat realtime/subscribe yoki client fetch uchun.
- Service role (`@/lib/supabase/admin`) — FAQAT `src/app/api/**` ichida, faqat Telegram/cron uchun.
- Yozish: iloji boricha RPC (`supabase.rpc("apply_to_vacancy", { p_vacancy_id, p_message })`). To'g'ridan-to'g'ri insert/update faqat egasi bo'lgan jadvallarda (RLS ruxsat beradi).
- Tiplar: `import type { Database, Tables, Enums } from "@/types/database.types"` — `Tables<"vacancies">`, `Enums<"application_status">`. `any` TAQIQLANGAN.
- Xatolik: `errorCode(error)` (`@/lib/utils`) → i18n kaliti: `t(\`common.errors.${code}\`)` yoki modul kalitlari.

Asosiy RPC'lar (supabase/migrations/0008_functions.sql):
`search_vacancies(...)`, `search_workers(...)`, `compute_match`, `get_contact(p_profile_id)`, `apply_to_vacancy`, `set_application_status`,
`send_offer`, `respond_offer`, `mark_offer_viewed`, `withdraw_offer`, `get_or_create_conversation`, `send_message`, `mark_conversation_read`,
`set_conversation_block`, `my_conversations`, `mark_notifications_read`, `unread_counts`, `create_review`, `profile_rating`,
`employer_dashboard_stats`, `worker_dashboard_stats`, `recommended_vacancies`, `recommended_workers`, `worker_completeness`,
`refresh_worker_completeness`, `refresh_matches_for_worker`, `publish_vacancy`, `set_vacancy_status`, `record_vacancy_view`, `record_worker_view`,
`submit_report(p_target_type, p_target_id, p_reason, p_details)` (shikoyat FAQAT shu RPC orqali), `delete_message(p_message_id)` (xabarni o'chirish faqat RPC),
`mark_offer_hired(p_offer_id)` (custom taklif bo'yicha ishga olindi), `create_review(p_application_id | p_job_offer_id, p_rating, p_text)`,
`accept_company_invite(p_token)` (kompaniyaga a'zo qo'shish faqat `company_invites` jadvali + shu RPC orqali; to'g'ridan-to'g'ri company_members insert TAQIQLANGAN),
`can_edit_vacancy(id)` (owner/admin/recruiter — viewer emas; UI'da tahrirlash tugmalarini shu bilan boshqaring), `expire_offers()` (cron, service role),
`admin_*` (stats, daily_stats, set_user_block, set_vacancy_status, review_verification, resolve_report, moderate_review, broadcast).

Muhim qoidalar (audit'dan keyin): faol (active) vakansiyani to'g'ridan-to'g'ri tahrirlash MUMKIN (holat saqlanadi); activ'ga o'tish faqat `publish_vacancy`.
Admin yashirgan (hidden) vakansiyaga egasi tega olmaydi; rad etilgan (rejected) ni tahrirlab qayta yuborsa — `pending_review` ga tushadi.
`profiles` jadvali faqat "aloqador" profillar uchun o'qiladi (ochiq ishchi, faol vakansiya egasi, suhbatdosh, ariza/taklif tomoni) — begona id bo'yicha o'qib bo'lmaydi.
`conversation_members` da foydalanuvchi faqat `is_muted` ni o'zgartira oladi. Masofa (`distance_km`, moslik `km`) butun km gacha yaxlitlangan.

## Server action shakli
```ts
"use server";
export async function applyToVacancy(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession(); if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_to_vacancy", { p_vacancy_id: parsed.data.vacancyId, p_message: parsed.data.message ?? undefined });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/applications");
  return { ok: true, data: { id: data } };
}
```
`ActionResult` — `@/features/auth/actions` dan import qiling.

## i18n
- Server: `const { t, tEnum, locale, name } = await getT()` (`@/lib/i18n/server`).
- Client: `const { t, tEnum, locale, name } = useT()` (`@/lib/i18n/client`).
- `t("jobs.filters.title")`, params: `t("common.labels.results", { count })`.
- Enum: `tEnum("employment_type", v.employment_type)`; ma'lumotnoma nomi: `name(category)` (name_uz/name_ru).
- Matn kodga qattiq yozilmaydi. Har kalit uz VA ru faylida bo'lishi shart.
- Moslik sabablari: `enums.match_reason.<key>` (params: km, matched, required, lang, level, min, max).

## Format
`@/lib/format`: `formatMoney(5000000, locale)` → "5 000 000 so'm"; `formatSalaryRange`, `formatMoneyShort`, `formatPhone`, `normalizePhone`,
`formatDate`, `formatDateTime`, `formatRelative`, `formatWorkTime`, `formatDistance`, `initials`, `fullName`, `shortName`, `ageFromBirthDate`.
Telefon bazada E.164 (+998901234567). Vaqt UI'da Asia/Tashkent.

## UI
- `@/components/ui`: Button, Input, Textarea, Select (native), Field/Label, Badge, Card*, Skeleton/ListSkeleton, Avatar, Progress, Checkbox, RadioGroup/RadioItem, Switch,
  Chip/ChipGroup/FilterChip, Dialog/Sheet(bottom sheet)/ConfirmDialog, Tabs, toast/Toaster, DropdownMenu, Spinner/PageSpinner, EmptyState, PageHeader, Stepper, InfoRow, SectionHeader.
- `@/components/shared`: Shell (TopBar + BottomNav), VacancyCard, WorkerCard, MatchScore/MatchReasons, SalaryText, CategoryIcon, LanguageSwitcher.
- Sahifa qobig'i: `<Shell>` (server) — `src/app/page.tsx` ga qarang. Onboarding/wizard sahifalarida `<Shell hideNav>`.
- Mobil-first: `container-app` (max 6xl) / `container-narrow` (max 2xl). Touch target ≥ 44px. Filtrlar — `Sheet` (bottom sheet). Yuklanish — Skeleton. Bo'sh holat — EmptyState.
- Har sahifa `export const metadata` yoki `generateMetadata`. Public sahifalar (jobs) SEO: title, description, openGraph.
- URL holati: qidiruv filtrlari `searchParams` da (`/jobs?category=sales&district=...&salary_min=5000000`). Sahifa `searchParams` ni o'qib RPC chaqiradi.

## Fayl yuklash (Storage)
bucket'lar: `avatars/<profile_id>/...`, `portfolio/<profile_id>/...`, `company-logos/<company_id>/...`, `chat/<conversation_id>/...`, `documents/<profile_id>/...`.
Client'da `createClient().storage.from("portfolio").upload(path, file, { upsert: true })`; MIME/hajm client'da ham tekshiriladi (rasm ≤ 3MB avatar, ≤ 25MB portfolio).
Public bucket URL: `supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl`.

## Tekshiruv (har modul yakunida)
```
npx tsc --noEmit --incremental false     # 0 xato (faqat o'z fayllaringizdagi xatolarni tuzating)
npx eslint src/features/<module> src/app/<routes>
```
`next build`, `npm install` ISHLATMANG (parallel ishlar buziladi). Yangi paket kerak bo'lsa — docs/db-requests/<module>.md ga yozing.
`confirm()`/`alert()` ishlatmang — ConfirmDialog. Ishlamaydigan tugma qoldirmang. TODO bilan muhim funksiyani tashlamang.
