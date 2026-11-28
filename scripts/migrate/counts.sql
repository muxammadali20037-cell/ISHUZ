-- Ko'chirish tekshiruvi: har jadvaldagi qatorlar soni (public, auth, storage) — eski va yangi loyihada bir xil chiqishi kerak.
-- Faqat jadval nomi va son chiqadi (shaxsiy ma'lumot yo'q). docs/FRANKFURT_MIGRATION.md §5.
select t.table_schema || '.' || t.table_name as tbl,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint as n
from information_schema.tables t
where t.table_type = 'BASE TABLE'
  and t.table_schema in ('public', 'auth', 'storage')
  -- Supabase'ning o'z ichki jadvallari (versiyaga qarab farq qiladi) va tez o'zgaradigan hisoblagichlar
  and t.table_name not in ('schema_migrations', 'migrations', 'audit_log_entries', 'flow_state', 'one_time_tokens', 'refresh_tokens', 'sessions', 'mfa_amr_claims', 'rate_limits')
order by 1;
