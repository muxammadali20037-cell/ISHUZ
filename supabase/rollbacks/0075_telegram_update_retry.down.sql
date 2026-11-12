-- 0075 qaytarish: webhook xatosida qayta urinish olib tashlanadi (0056 holati: update bir marta, xato bo'lsa ham).
-- Ilova kodi `telegram_update_failed` bo'lmasa ham ishlaydi (xatoni faqat logga yozadi).
begin;

drop function if exists public.telegram_update_failed(bigint, text);

create or replace function public.telegram_update_first_seen(p_update_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.telegram_updates (update_id) values (p_update_id) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

alter table public.telegram_updates
  drop column if exists attempts,
  drop column if exists failed_at,
  drop column if exists last_error;

commit;
