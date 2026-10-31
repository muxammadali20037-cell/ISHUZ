-- 0070 · Ish qidiruvi: maksimal maosh va ma'lumoti filtrlari (2026-10-31 auditi, §3.7)
--
-- search_vacancies_v3 = search_vacancies_v2 (0065 + 0068 tuzatishlari bilan, aynan bir xil tana) + 2 ta filtr:
--   * p_salary_max — maosh shu summadan oshmaydigan e'lonlar (oylik ekvivalentda: kunlik ×22, soatlik ×176 — p_salary_min
--     bilan bir xil qoida). Taqqoslanadi e'londagi eng kam summa (salary_from, bo'lmasa salary_to). "Kelishiladi" — o'tadi
--     (min filtri bilan bir xil: summa noma'lum).
--   * p_education — "mening ma'lumotim": e'lon talab qiladigan eng kam ma'lumot shu darajadan yuqori bo'lmasin; talab
--     ko'rsatilmagan e'lonlar o'tadi (education_rank — 0001).
-- v2 o'zgarmaydi (eski mijozlar ishlayveradi); ilova yangi filtrlar tanlanganda v3 ni chaqiradi, v3 yo'q bazada — v2 ga qaytadi.
-- Tana qo'lda nusxalanmaydi: joriy v2 ta'rifi olinib, nomi va 2 ta joyi almashtiriladi (0068 dagi patch_fn uslubi) —
-- kelajakda v2 ga kiritilgan tuzatishlar v3 ni qayta yaratishda yo'qolmaydi.

do $$
declare
  def text;
  n int;
  o text;
begin
  def := pg_get_functiondef('public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)'::regprocedure);

  -- 1) nom
  o := 'FUNCTION public.search_vacancies_v2(';
  n := (length(def) - length(replace(def, o, ''))) / length(o);
  if n <> 1 then raise exception '0070: funksiya nomi % marta uchradi', n; end if;
  def := replace(def, o, 'FUNCTION public.search_vacancies_v3(');

  -- 2) yangi parametrlar — oxirgisidan keyin (standart qiymat bilan: eski chaqiruvlar ham ishlaydi)
  o := 'p_offset integer DEFAULT 0)';
  n := (length(def) - length(replace(def, o, ''))) / length(o);
  if n <> 1 then raise exception '0070: p_offset % marta uchradi', n; end if;
  def := replace(def, o, 'p_offset integer DEFAULT 0, p_salary_max integer DEFAULT NULL::integer, p_education public.education_level DEFAULT NULL::public.education_level)');

  -- 3) filtrlar — min maosh shartidan keyin (base CTE)
  o := 'and (p_salary_min is null or v.salary_negotiable or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) >= p_salary_min)';
  n := (length(def) - length(replace(def, o, ''))) / length(o);
  if n <> 1 then raise exception '0070: min maosh sharti % marta uchradi', n; end if;
  def := replace(def, o, o || '
      and (p_salary_max is null or v.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(v.salary_from, v.salary_to), v.salary_type) <= p_salary_max)
      and (p_education is null or v.education_min is null
           or public.education_rank(v.education_min) <= public.education_rank(p_education))');

  execute def;
end $$;

grant execute on function public.search_vacancies_v3(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int, int, public.education_level) to anon, authenticated;
