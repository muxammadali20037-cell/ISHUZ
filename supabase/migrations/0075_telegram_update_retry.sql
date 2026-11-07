-- 0075 · Telegram webhook: xato bo'lgan update yo'qolmaydi (audit 2026-11: webhook xatoda ham 200 qaytarardi).
--
--   Avval: update_id "ko'rildi" deb belgilanadi → qayta ishlashda xato → 200 qaytariladi → Telegram qayta yubormaydi →
--   foydalanuvchi xabari jim yo'qoladi.
--   Endi: xato bo'lsa ilova `telegram_update_failed` ni chaqiradi. 3 urinishgacha belgi "qayta ishlash mumkin" holatiga
--   qaytadi va ilova 500 qaytaradi — Telegram update'ni qayta yuboradi. 3-urinishdan keyin ham xato bo'lsa — 200
--   (bitta buzuq update butun bot navbatini to'xtatib qo'ymasin), xato matni jadvalda qoladi.
--
--   Qaytarish: supabase/rollbacks/0075_telegram_update_retry.down.sql

alter table public.telegram_updates
  add column if not exists attempts   int not null default 1,
  add column if not exists failed_at  timestamptz,
  add column if not exists last_error text;

-- Birinchi marta yoki avvalgi urinish xato bilan tugagan (va urinishlar < 3) bo'lsa — true: qayta ishlash kerak
create or replace function public.telegram_update_first_seen(p_update_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.telegram_updates as t (update_id) values (p_update_id)
  on conflict (update_id) do update
    set attempts = t.attempts + 1, failed_at = null, received_at = now()
    where t.failed_at is not null and t.attempts < 3;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Qayta ishlash xato bilan tugadi. true — Telegram qayta yuborsin (ilova 500 qaytaradi), false — urinishlar tugadi.
create or replace function public.telegram_update_failed(p_update_id bigint, p_error text)
returns boolean language plpgsql security definer set search_path = public as $$
declare a int;
begin
  update public.telegram_updates
     set failed_at = now(), last_error = left(coalesce(p_error, ''), 500)
   where update_id = p_update_id
  returning attempts into a;
  return coalesce(a, 3) < 3;
end $$;

revoke execute on function public.telegram_update_first_seen(bigint) from public, anon, authenticated;
revoke execute on function public.telegram_update_failed(bigint, text) from public, anon, authenticated;
grant execute on function public.telegram_update_first_seen(bigint) to service_role;
grant execute on function public.telegram_update_failed(bigint, text) to service_role;
