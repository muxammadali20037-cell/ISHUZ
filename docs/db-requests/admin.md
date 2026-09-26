# Admin modul — DB/RPC so'rovlari

Modul: `src/app/admin/**`, `src/features/admin/**`, `messages/*/admin.json`.

## 1. `admin_log(action, target_type, target_id, before, after)` RPC — BAJARILDI ✓

`public.admin_log(p_action, p_target_type, p_target_id, p_before, p_after)` mavjud (0008_functions.sql).
Admin panel har bir to'g'ridan-to'g'ri jadval yozuvidan keyin uni chaqiradi (`src/features/admin/actions/guard.ts` → `logAdmin`,
`actions/reference.ts`, `actions/settings.ts`), before/after snapshot bilan. Ishlatiladigan action'lar:
`category|subcategory|region|district.(create|update|delete)`, `skill.(update|approve|unapprove|delete)`, `settings.update`,
`admin.(add|update|activate|deactivate)`. Target turlari: `category`, `subcategory`, `skill`, `region`, `district`, `app_setting`, `admin_user`.
`UnauditedNote` olib tashlandi. Quyidagi matn tarix uchun qoldirildi.

Ilgari `public.write_audit` faqat `service_role` ga ochiq edi va **to'g'ridan-to'g'ri jadval yozuvlari** audit jurnaliga tushmas edi:

- `categories`, `subcategories` (categories.manage)
- `skills` (skills.manage)
- `regions`, `districts` (regions.manage)
- `app_settings` (settings.manage)
- `admin_users` (admins.manage)

So'ralgan (va amalga oshirilgan) shakl:
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
Eslatma: `admin_log` xatosi asosiy yozuvni buzmaydi (yozuv allaqachon bajarilgan) — faqat server logiga tushadi.

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
