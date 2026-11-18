-- ISH TOPDIM · 0082 · Qidiruv: kirill/lotin va tutuq belgisidan qat'i nazar e'lon topiladi
--
-- Ega (2026-11-18): "bazadagi e'lonlarni qidirsam topmayapti". Sabab: kasbi ro'yxatdan tanlanmagan (o'zi yozgan) e'lon
-- sarlavhasi bo'yicha qidiriladi, lekin faqat kasbning lotin (name_uz) va rus (name_ru) nomi bilan solishtirilardi.
-- Kirill harfida yozilgan "Ўқитувчи" yoki tutuq belgisisiz "Oqituvchi" — "O'qituvchi" bo'yicha topilmasdi.
--
--  1) public.uz_fold(text) — solishtirish uchun yagona shakl: kichik harf, o'zbek/rus kirill → lotin, tutuq belgilari
--     (' ‘ ’ ʻ ʼ `) olib tashlanadi, qolgan belgilar — bo'shliq. "Ўқитувчи", "O'qituvchi", "Oʻqituvchi", "oqituvchi" → "oqituvchi".
--  2) Kasbsiz e'lon/ishchi uchun zaxira solishtiruv (simple_search_vacancies, _v2, _v3, simple_search_workers, _v2)
--     uz_fold bilan va o'zi yozgan kasb nomi (custom_profession) ham qo'shiladi. Aniq yamoq: naqsh har funksiyada aynan
--     1 marta uchrashi shart (aks holda migratsiya to'xtaydi); allaqachon yamalgan bo'lsa — tegmaydi. CRLF (Windows SQL
--     Editor) bilan ham ishlaydi.
--
-- Ma'lumotga tegilmaydi. Takror ishga tushirish xavfsiz. Rollback: supabase/rollbacks/0082_search_translit.down.sql

create or replace function public.uz_fold(t text)
returns text language sql immutable parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        -- so'z boshidagi "е" — "ye" ("Етказиб" → "yetkazib")
        regexp_replace(lower(coalesce(t, '')), '(^|[^а-яёўқғҳ])е', '\1ye', 'g'),
        'ш', 'sh'), 'ч', 'ch'), 'щ', 'sh'), 'ё', 'yo'), 'ю', 'yu'), 'я', 'ya'), 'ц', 'ts'), 'ў', 'o'), 'ғ', 'g'), 'ъ', ''), 'ь', ''), 'ж', 'j'),
      'абвгдезийклмнопрстуфхқҳыэ''‘’ʻʼ`´',
      'abvgdeziyklmnoprstufxqhie'),
    '[^a-z0-9]+', ' ', 'g'));
$$;
grant execute on function public.uz_fold(text) to anon, authenticated, service_role;

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
  old text;
  new text;
  n int;
begin
  foreach f in array fns loop
    def := replace(pg_get_functiondef(f::regprocedure), E'\r', '');
    if position('uz_fold' in def) > 0 then continue; end if; -- allaqachon yamalgan
    if position('simple_search_workers' in f) > 0 then old := wrk_old; new := wrk_new; else old := vac_old; new := vac_new; end if;
    n := (length(def) - length(replace(def, old, ''))) / length(old);
    if n <> 1 then raise exception '0082: % — naqsh % marta uchradi (1 kutilgan)', f, n; end if;
    execute replace(def, old, new);
  end loop;
end $patch$;
