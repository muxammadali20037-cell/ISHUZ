-- ISH.UZ · 0015 · Rejalashtirilgan ishlar Supabase ichida (pg_cron + pg_net)
-- Sabab: Vercel Hobby tarifi faqat kuniga 1 marta cron'ga ruxsat beradi, bildirishnomalar esa daqiqa sayin yuborilishi kerak.
--  * ishuz-maintenance  — har kuni 03:05 (Toshkent): muddati o'tgan vakansiya/takliflar, tugayotganlar haqida ogohlantirish (to'g'ridan-to'g'ri SQL)
--  * ishuz-telegram     — har daqiqa: yuborilmagan Telegram bildirishnomalari bo'lsagina ilovaning /api/cron/notifications endpointini chaqiradi
-- Telegram yuborish uchun Vault'da 2 ta secret kerak (deploydan keyin bir marta):
--   select vault.create_secret('https://<domen>', 'ishuz_app_url');
--   select vault.create_secret('<CRON_SECRET bilan bir xil>', 'ishuz_cron_secret');
-- Secretlar bo'lmasa job hech narsa qilmaydi (xato ham bermaydi).

create or replace function public.dispatch_app_cron(p_path text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  base text;
  secret text;
begin
  if p_path not in ('/api/cron/notifications', '/api/cron/vacancies') then
    raise exception 'invalid_path' using errcode = '22023';
  end if;
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into base using 'ishuz_app_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into secret using 'ishuz_cron_secret';
  if base is null or secret is null then return null; end if;
  -- ilovani behuda uyg'otmaslik: faqat yuboriladigan narsa bo'lsa (dispatcher tanlovi bilan bir xil shart)
  if p_path = '/api/cron/notifications' and not exists (
    select 1 from public.notifications n
    join public.telegram_accounts t on t.profile_id = n.profile_id and t.bot_started
    where n.telegram_sent_at is null and n.created_at > now() - interval '2 days'
  ) then
    return null;
  end if;
  return net.http_post(
    url := rtrim(base, '/') || p_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 30000
  );
end $$;
revoke execute on function public.dispatch_app_cron(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.schedule('ishuz-maintenance', '5 22 * * *',
      $job$select public.expire_vacancies(); select public.expire_offers(); select public.notify_expiring_vacancies();$job$);
    perform cron.schedule('ishuz-telegram', '* * * * *',
      $job$select public.dispatch_app_cron('/api/cron/notifications');$job$);
  else
    raise notice 'pg_cron yo''q (lokal muhit) — rejalashtirish o''tkazib yuborildi';
  end if;
end $$;
