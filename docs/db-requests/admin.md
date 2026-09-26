# Admin modul — DB/RPC so'rovlari

Modul: `src/app/admin/**`, `src/features/admin/**`, `messages/*/admin.json`.

## 1. `admin_log(action, target_type, target_id, before, after)` RPC — audit uchun (MUHIM)

Hozir `public.write_audit` faqat `service_role` ga ochiq, `audit_logs` ga insert RLS bilan yopiq.
Admin paneldagi **to'g'ridan-to'g'ri jadval yozuvlari** (RLS `*.manage` orqali) audit jurnaliga tushmaydi:

- `categories`, `subcategories` (categories.manage)
- `skills` (skills.manage)
- `regions`, `districts` (regions.manage)
- `app_settings` (settings.manage)
- `admin_users` (admins.manage)

UI da bu bo'limlarda «Bu bo'limdagi o'zgarishlar audit jurnaliga yozilmaydi» belgisi ko'rsatilgan
(`src/features/admin/components/notes.tsx` → `UnauditedNote`).

So'rov:
```sql
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text, p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- faqat ma'lumotnoma/sozlama/admin prefikslari (ixtiyoriy cheklov)
  if p_action !~ '^(category|subcategory|skill|region|district|setting|admin)\.' then raise exception 'invalid_action' using errcode = '23514'; end if;
  perform public.write_audit(p_action, p_target_type, p_target_id, p_before, p_after);
end $$;
grant execute on function public.admin_log(text, text, text, jsonb, jsonb) to authenticated;
```
Tayyor bo'lgach `src/features/admin/actions/reference.ts` va `actions/settings.ts` dagi har bir yozuvdan keyin
`supabase.rpc("admin_log", {...})` chaqiriladi va `UnauditedNote` olib tashlanadi.

Muqobil (yaxshiroq): trigger'lar orqali `categories/skills/regions/districts/app_settings/admin_users` ga
`after insert/update/delete` da `write_audit(...)` chaqirish — u holda kod o'zgarmaydi.

## 2. `admin_users` RLS — o'z-o'zini o'chirish/pasaytirish himoyasi (ixtiyoriy)

Server action (`upsertAdminUser`, `setAdminActive`) o'zini `is_active=false` yoki `super_admin`dan pasaytirishni bloklaydi,
lekin DB darajasida ham `with check (profile_id <> auth.uid() or (is_active and role = 'super_admin'))` qo'shish tavsiya etiladi.

## 3. `notifications` — tarqatmalar tarixi

`notifications` RLS faqat egasiga ochiq, shuning uchun /admin/notifications «So'nggi tarqatmalar» ro'yxati
`audit_logs.action = 'notifications.broadcast'` dan olinadi (`after_data.title/role/count`). Bu `audit.view` ruxsatini talab qiladi
(moderator/support ko'rmaydi). Agar tarix hammaga kerak bo'lsa — `admin_broadcasts` view yoki RPC.

## 4. Kelajakdagi kichik qulayliklar (shart emas)

- `admin_stats()` ga `pending_reviews` (reviews.status = 'pending') qo'shish — hozir yon panel uchun alohida `count` so'rov qilinadi.
- `reports.target_id` `message` uchun `messages.id` (bigint) yoki `conversation_id` ekanini hujjatlashtirish; admin panel raqamli ID ni `messages.id` deb qabul qiladi.
