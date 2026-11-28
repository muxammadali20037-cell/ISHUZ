-- Bazani Frankfurtga ko'chirish (4-bosqich), tiklashdan keyin YANGI loyihada bir marta (qayta ishga tushirsa ham xavfsiz).
-- docs/FRANKFURT_MIGRATION.md §3. Muhit o'zgaruvchilaridan o'qiladi (buyruq satrida ham, logda ham ko'rinmaydi):
--   OLD_REF     — eski loyiha ref (oquqqubmicldvreeqgsg)
--   NEW_REF     — yangi loyiha ref
--   APP_URL     — sayt manzili (pg_cron → /api/cron/*), masalan https://ishuz.vercel.app
--   CRON_SECRET — Vercel'dagi CRON_SECRET bilan bir xil
-- Biri yo'q bo'lsa — psql sintaksis xatosi bilan to'xtaydi (hech narsa o'zgarmaydi).
\set ON_ERROR_STOP on
\getenv old_ref OLD_REF
\getenv new_ref NEW_REF
\getenv app_url APP_URL
\getenv cron_secret CRON_SECRET
\o /dev/null
select set_config('migrate.old_ref', :'old_ref', false), set_config('migrate.new_ref', :'new_ref', false),
       set_config('migrate.app_url', :'app_url', false), set_config('migrate.cron_secret', :'cron_secret', false);
\o

begin;
-- triggerlar ishlamasin (updated_at, moderatsiya versiyasi, bildirishnomalar) — bu ma'lumotni o'zgartirish emas, manzilni almashtirish
set local session_replication_role = replica;

-- 1. Saqlangan to'liq manzillar: https://<old_ref>.supabase.co/... → https://<new_ref>.supabase.co/...
--    (rasm URL'lari: listing_images, profession_images, profiles.avatar_url, app_settings va h.k.). Faqat public sxema,
--    matn va jsonb ustunlar; har ustun bo'yicha nechta qator o'zgargani chiqadi (mazmun emas).
do $$
declare
  c record;
  n bigint;
  old_host text := current_setting('migrate.old_ref') || '.supabase.co';
  new_host text := current_setting('migrate.new_ref') || '.supabase.co';
begin
  if old_host = new_host then raise exception 'old_ref = new_ref'; end if;
  for c in
    select col.table_name, col.column_name, col.data_type
    from information_schema.columns col
    join information_schema.tables t on t.table_schema = col.table_schema and t.table_name = col.table_name and t.table_type = 'BASE TABLE'
    where col.table_schema = 'public' and col.data_type in ('text', 'character varying', 'jsonb') and col.is_generated = 'NEVER'
  loop
    if c.data_type = 'jsonb' then
      execute format('update public.%I set %I = replace(%I::text, $1, $2)::jsonb where %I::text like $3', c.table_name, c.column_name, c.column_name, c.column_name)
        using old_host, new_host, '%' || old_host || '%';
    else
      execute format('update public.%I set %I = replace(%I, $1, $2) where %I like $3', c.table_name, c.column_name, c.column_name, c.column_name)
        using old_host, new_host, '%' || old_host || '%';
    end if;
    get diagnostics n = row_count;
    if n > 0 then raise notice 'url: %.% — % qator', c.table_name, c.column_name, n; end if;
  end loop;
end $$;

-- 2. Vault sirlari: eski loyihaning kaliti bilan shifrlangan nusxa yangisida ochilmaydi — qaytadan yaratiladi
delete from vault.secrets where name in ('ishuz_app_url', 'ishuz_cron_secret');
select vault.create_secret(current_setting('migrate.app_url'), 'ishuz_app_url') is not null as app_url_saved;
select vault.create_secret(current_setting('migrate.cron_secret'), 'ishuz_cron_secret') is not null as cron_secret_saved;

commit;
