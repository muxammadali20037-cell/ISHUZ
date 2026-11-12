-- Sxema "barmoq izi": ikki bazaning public sxemasi bir xilligini solishtirish uchun (pg_dump versiyasiga bog'liq emas).
-- Qatorlar: ustunlar, funksiyalar (matn xeshi va huquqlari), siyosatlar, triggerlar, indekslar, cheklovlar, jadval huquqlari, enum'lar.
select 'col|' || c.table_name || '.' || c.column_name || '|' || c.udt_name || '|' || c.is_nullable || '|' || coalesce(c.column_default, '')
  from information_schema.columns c where c.table_schema = 'public'
union all
select 'fn|' || p.oid::regprocedure::text || '|' || md5(pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
union all
select 'pol|' || tablename || '.' || policyname || '|' || cmd || '|' || roles::text || '|' || md5(coalesce(qual, '') || '|' || coalesce(with_check, ''))
  from pg_policies where schemaname = 'public'
union all
select 'trg|' || t.tgrelid::regclass::text || '.' || t.tgname || '|' || md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class r on r.oid = t.tgrelid where not t.tgisinternal and r.relnamespace = 'public'::regnamespace
union all
select 'idx|' || indexname || '|' || md5(indexdef) from pg_indexes where schemaname = 'public'
union all
select 'con|' || conrelid::regclass::text || '.' || conname || '|' || md5(pg_get_constraintdef(oid))
  from pg_constraint where connamespace = 'public'::regnamespace and conrelid <> 0
union all
select 'rel|' || r.relname || '|' || r.relkind::text || '|rls=' || r.relrowsecurity::text || '|' || coalesce(r.relacl::text, '')
  from pg_class r where r.relnamespace = 'public'::regnamespace and r.relkind in ('r', 'v', 'm', 'S')
union all
select 'enum|' || t.typname || '|' || string_agg(e.enumlabel, ',' order by e.enumsortorder)
  from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typnamespace = 'public'::regnamespace group by t.typname
order by 1;
