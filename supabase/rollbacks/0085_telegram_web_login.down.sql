-- 0085 qaytarish: kodsiz Telegram kirishi olib tashlanadi — sayt avvalgi usulga qaytadi (bot ochiladi, ilova tugmasi).
drop function if exists public.telegram_web_login_consume(uuid, text);
drop function if exists public.telegram_web_login_confirm(uuid, bigint, uuid);
drop function if exists public.telegram_web_login_preview(text);
drop function if exists public.telegram_web_login_create(text, text, text);
drop table if exists public.telegram_web_logins;
