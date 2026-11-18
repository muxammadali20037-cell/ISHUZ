-- 0082 qaytarish: qidiruvdagi zaxira solishtiruv yana oddiy lower() bilan; uz_fold o'chiriladi. Ma'lumotga tegilmaydi.
begin;
do $patch$
declare
  fns text[] := array[
    'public.simple_search_vacancies(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer)',
    'public.simple_search_vacancies_v2(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer,salary_type)',
    'public.simple_search_vacancies_v3(uuid,uuid,uuid,boolean,integer,work_schedule,boolean,integer,integer,salary_type,employer_type,boolean,boolean)',
    'public.simple_search_workers(uuid,uuid,uuid,boolean,boolean,integer,integer)',
    'public.simple_search_workers_v2(uuid,uuid,uuid,boolean,boolean,integer,integer,boolean)'];
  vac_old text := replace($o$(lower(v.title) like '%' || lower(node.name_uz) || '%' or lower(v.title) like '%' || lower(node.name_ru) || '%')$o$, E'\r', '');
  vac_new text := replace($n$(public.uz_fold(v.title || ' ' || coalesce(v.custom_profession, '')) like '%' || public.uz_fold(node.name_uz) || '%' and length(public.uz_fold(node.name_uz)) >= 3
             or public.uz_fold(v.title || ' ' || coalesce(v.custom_profession, '')) like '%' || public.uz_fold(node.name_ru) || '%' and length(public.uz_fold(node.name_ru)) >= 3)$n$, E'\r', '');
  wrk_old text := replace($o$(lower(coalesce(w.headline, '')) like '%' || lower(node.name_uz) || '%' or lower(coalesce(w.headline, '')) like '%' || lower(node.name_ru) || '%')$o$, E'\r', '');
  wrk_new text := replace($n$(public.uz_fold(coalesce(w.headline, '') || ' ' || coalesce(w.custom_profession, '')) like '%' || public.uz_fold(node.name_uz) || '%' and length(public.uz_fold(node.name_uz)) >= 3
                   or public.uz_fold(coalesce(w.headline, '') || ' ' || coalesce(w.custom_profession, '')) like '%' || public.uz_fold(node.name_ru) || '%' and length(public.uz_fold(node.name_ru)) >= 3)$n$, E'\r', '');
  f text;
  def text;
begin
  foreach f in array fns loop
    def := replace(pg_get_functiondef(f::regprocedure), E'\r', '');
    if position('uz_fold' in def) = 0 then continue; end if;
    if position('simple_search_workers' in f) > 0 then def := replace(def, wrk_new, wrk_old); else def := replace(def, vac_new, vac_old); end if;
    if position('uz_fold' in def) > 0 then raise exception '0082 rollback: % — naqsh topilmadi', f; end if;
    execute def;
  end loop;
end $patch$;
drop function if exists public.uz_fold(text);
commit;
