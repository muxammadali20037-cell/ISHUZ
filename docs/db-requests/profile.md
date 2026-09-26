# Profile & Settings moduli — so'rovlar va eslatmalar

Modul: `src/features/profile`, `src/app/profile/**`, `src/app/settings/**`, `messages/*/profile.json`.
Hozirgi sxema/RPC'lar bilan hammasi ishlaydi; quyidagilar keyinroq uchun takliflar.

## Paketlar (ixtiyoriy)
- **`@react-pdf/renderer`** — `/profile/cv` hozir `window.print()` + `@media print` (A4, header/nav yashiriladi) orqali PDF beradi.
  Haqiqiy server-side PDF (`/api/cv/pdf`) kerak bo'lsa `@react-pdf/renderer` (yoki `puppeteer-core` + chromium) qo'shiladi;
  `CvDocument` tarkibi shunga mos qayta ishlatiladi.

## Umumiy kod (src/lib, src/app/layout) uchun takliflar
- **Mavzu (theme) skripti**: `setTheme` action `ishuz_theme` cookie'sini yozadi (`light|dark`, system → cookie o'chadi), `layout.tsx` faqat `dark` bo'lsa `<html class="dark">` beradi.
  "System" rejimida `prefers-color-scheme: dark` hozir faqat `/settings` sahifasidagi `ThemeSelector` effekti orqali qo'llanadi.
  Har sahifada to'g'ri ishlashi uchun `src/app/layout.tsx` ga (cookie yo'q bo'lganda) 3 qatorlik inline skript qo'shish tavsiya etiladi:
  `if(!document.cookie.includes('ishuz_theme=')&&matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')`.
- **`next.config.ts` → `images.remotePatterns`**: Supabase Storage domeni qo'shilsa portfolio/avatar rasmlarini `next/image` bilan optimallashtirish mumkin
  (hozir `MediaThumb` oddiy `<img>` ishlatadi).

## DB / RPC (hozircha kerak emas, kelajak uchun)
- `worker_portfolio` tartibini bitta chaqiruvda saqlash uchun `reorder_portfolio(p_ids uuid[])` RPC qulay bo'lardi (hozir har element uchun alohida `update`).
- `contact_grants` uchun "kim so'ragan" (so'rovlar jadvali) yo'q — `on_request` rejimida ruxsatni faqat egasi qo'lda beradi (bu modul faqat bekor qiladi).
- Bildirishnoma sozlamalari jadvali yo'q — Settings'da bu bo'lim ataylab yo'q.

## Ishlatilgan RPC / jadval huquqlari (tekshirilgan)
- RPC: `worker_completeness`, `refresh_worker_completeness`, `refresh_matches_for_worker`, `profile_rating`, `employer_dashboard_stats`.
- To'g'ridan-to'g'ri yozish (RLS egasi): `profiles` (ism, tug'ilgan sana, jins, avatar_url), `worker_profiles` (status, headline, about, hudud, kasb, experience_level, work_format, is_public),
  `worker_locations`, `worker_geo`, `worker_skills`, `worker_languages`, `worker_experience`, `worker_education`, `worker_preferences`, `worker_portfolio`,
  `skills` (faqat `is_custom=true, is_approved=false, created_by=me`), `profile_contacts.phone_visibility`, `contact_grants` (delete).
- Storage: `avatars/<profile_id>/avatar.<ext>` (upsert), `portfolio/<profile_id>/<uuid>.<ext>`; o'chirish server action ichida (`storage.remove`).
