-- ISH TOPDIM · 0068 · maosh davrlari va "faqat ochiq e'lon" qoidalari (audit 2026-10-20)
--
-- 1. /jobs "Maosh bo'yicha" saralash davrni hisobga oladi: 300 000 so'm/kun (≈6,6 mln/oy) endi 5 mln/oy dan pastda
--    turmaydi. Qoida ochiq: salary_monthly_equivalent — kunlik ×22, soatlik ×176. Kelishiladigan va ishbay — oxirida
--    (taqqoslab bo'lmaydi).
-- 2. Kirgan ishchining "Mos" ro'yxati faqat eng yangi 300 ta e'lon bilan cheklanib qolmaydi: moslik bali (qimmat
--    hisob) 300 ta nomzod uchun hisoblanadi (avval ishchi sohasidagilar), qolganlari ro'yxatdan tushib qolmaydi —
--    balsiz, yangilik bo'yicha keyin keladi. Natijalar soni ham haqiqiy (avval 300 dan oshmasdi). Boshqa saralashlarda
--    moslik bali ham shu 300 ta bilan cheklanadi (avval 10 000 tagacha hisoblanardi).
-- 3. Moslik (compute_match_v2): maosh davri boshqa bo'lsa 0 ball emas. Avval kunlik haqli doimiy ish oylik kutgan
--    ishchiga hech qachon "mos" deb xabar qilinmasdi (maks. 85 < chegara 90). Endi "noma'lum" (0,5 yoki 0,25),
--    izohda taxminiy oylik ekvivalent — to'liq moslik deyilmaydi.
-- 4. Ish beruvchining nomzod qidiruvida "byudjet" ishchining davrini hisobga oladi (200 000/kun ≈ 4,4 mln/oy).
-- 5. Muddati o'tgan, lekin hali "active" turgan e'lon (expire_vacancies soatiga bir marta ishlaydi) moslik keshi, bot
--    ro'yxati, saqlangan qidiruv xabari va moslik navbatiga kirmaydi.
-- 6. AI PRO xabari payload'ida e'lon, obuna va maosh davri bor — yuborish paytida qayta tekshiriladi.
--
-- Faqat mavjud funksiyalar o'zgaradi (create or replace / aniq matnli yamoq), jadval va ma'lumot o'chirilmaydi.
-- Orqaga qaytarish: 0065/0050/0045/0027/0021/0051/0041 dagi oldingi ta'riflarni qayta qo'llash kifoya.

create or replace function pg_temp.patch_fn(p_fn regprocedure, p_old text, p_new text) returns void
language plpgsql as $$
declare
  def text := replace(pg_get_functiondef(p_fn), E'\r', '');
  o text := replace(p_old, E'\r', '');
  r text := replace(p_new, E'\r', '');
  n int;
begin
  n := (length(def) - length(replace(def, o, ''))) / greatest(length(o), 1);
  if n <> 1 then raise exception 'patch_fn %: naqsh % marta uchradi (1 kutilgan)', p_fn, n; end if;
  execute replace(def, o, r);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 1–2. search_vacancies_v2: maosh saralashi davr bo'yicha; moslik havzasi natijani kesmaydi
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn(
  'public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)'::regprocedure,
  $o$  wid uuid := public.current_worker_id();$o$,
  $n$  wid uuid := public.current_worker_id();
  -- moslik havzasida avval ishchining sohasidagi e'lonlar
  wcat uuid := (select wp.category_id from public.worker_profiles wp where wp.id = public.current_worker_id());$n$);

select pg_temp.patch_fn(
  'public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)'::regprocedure,
  $o$    order by b.published_at desc
    limit case when wid is not null and p_sort = 'relevant' then 300 else 10000 end  -- moslik faqat oxirgi 300 ta uchun hisoblanadi
  ),
  scored as (
    select b.*,
      case when wid is not null then m.score end as ms,
      case when wid is not null then m.reasons end as mr,
      case when q is not null then ts_rank(b.search_vector, q) else 0 end as rank,
      count(*) over () as total  -- total_count limitdan keyin: sahifalar soni real natijaga mos
    from counted b
    left join lateral (select * from public.compute_match(wid, b.id)) m on wid is not null
  )$o$,
  $n$    order by b.published_at desc
    limit 10000
  ),
  pool as (
    -- moslik bali (qimmat) faqat 300 ta nomzod uchun: avval ishchining sohasidagilar, keyin eng yangilari.
    -- Qolganlari natijadan tushib qolmaydi (avval 300 dan keyingilari umuman ko'rinmasdi) — balsiz, yangilik bo'yicha
    select c.*, row_number() over (order by (c.category_id is not distinct from wcat) desc, c.published_at desc) as pre_rank
    from counted c
  ),
  scored as (
    select b.*,
      m.score as ms,
      m.reasons as mr,
      case when q is not null then ts_rank(b.search_vector, q) else 0 end as rank,
      count(*) over () as total  -- haqiqiy natijalar soni (10 000 gacha), moslik havzasi uni kesmaydi
    from pool b
    left join lateral (select * from public.compute_match(wid, b.id) where wid is not null and b.pre_rank <= 300) m on true
  )$n$);

select pg_temp.patch_fn(
  'public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, int, int)'::regprocedure,
  $o$    case when p_sort = 'salary' then coalesce(s.salary_to, s.salary_from, 0) end desc nulls last,
    case when p_sort = 'relevant' then coalesce(s.ms, 0) + s.rank * 20 end desc nulls last,$o$,
  $n$    -- maosh: turli davrlar oylik ekvivalentda (kunlik ×22, soatlik ×176); kelishiladigan va ishbay — oxirida
    case when p_sort = 'salary' and not s.salary_negotiable and s.salary_type in ('monthly', 'daily', 'hourly')
         then public.salary_monthly_equivalent(coalesce(s.salary_to, s.salary_from), s.salary_type) end desc nulls last,
    -- moslik: bali hisoblanganlar avval (-1 — hisoblanmagan), keyin matn mosligi
    case when p_sort = 'relevant' then coalesce(s.ms, -1) + s.rank * 20 end desc nulls last,$n$);

-- ---------------------------------------------------------------------------------------------------
-- 3. compute_match_v2: boshqa davr — 0 emas, "noma'lum" + taxminiy oylik ekvivalent
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn('public.compute_match_v2(uuid, uuid)'::regprocedure,
  $o$  elsif v.salary_type <> w_type then
    f := 0; r := r || jsonb_build_object('key', 'salary_type_differs', 'ok', 'unknown', 'vacancy_type', v.salary_type);$o$,
  $n$  elsif v.salary_type <> w_type then
    -- davrlar har xil: to'liq moslik deyilmaydi. Taxmin ochiq (kunlik ×22, soatlik ×176): ekvivalent ishchining eng kam
    -- talabidan past bo'lmasa — 0,5, past bo'lsa — 0,25; ishbay bilan taqqoslanmaydi — 0,5
    f := case
      when 'piecework' in (v.salary_type, w_type) then 0.5
      when public.salary_monthly_equivalent(vmax, v.salary_type) >= public.salary_monthly_equivalent(w_min, w_type) then 0.5
      else 0.25 end;
    r := r || jsonb_build_object('key', 'salary_type_differs', 'ok', 'unknown', 'vacancy_type', v.salary_type,
      'monthly_equivalent', case when 'piecework' in (v.salary_type, w_type) then null else public.salary_monthly_equivalent(vmax, v.salary_type) end);$n$);

-- ---------------------------------------------------------------------------------------------------
-- 4. Nomzod qidiruvi: byudjet (oylik) bilan ishchining talabi uning davri bo'yicha taqqoslanadi
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn(
  (select p.oid::regprocedure from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'search_workers_v2' order by p.oid desc limit 1),
  $o$      and (p_salary_max is null or pr.salary_min is null or pr.salary_min <= p_salary_max)$o$,
  $n$      and (p_salary_max is null or pr.salary_min is null
           or public.salary_monthly_equivalent(pr.salary_min, coalesce(pr.salary_type, 'monthly')) <= p_salary_max)$n$);

-- ---------------------------------------------------------------------------------------------------
-- 5. Muddati o'tgan e'lon: moslik keshi, navbat, bot, saqlangan qidiruv
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn('public.refresh_matches_for_worker(uuid)'::regprocedure,
  $o$    where v.status = 'active' and (v.category_id = w.category_id or w.category_id is null)$o$,
  $n$    where v.status = 'active' and (v.expires_at is null or v.expires_at > now())
      and (v.category_id = w.category_id or w.category_id is null)$n$);

select pg_temp.patch_fn('public.refresh_matches_for_vacancy(uuid)'::regprocedure,
  $o$  if v.id is null or v.status <> 'active' then return 0; end if;$o$,
  $n$  if v.id is null or v.status <> 'active' or (v.expires_at is not null and v.expires_at <= now()) then return 0; end if;$n$);

select pg_temp.patch_fn('public.process_match_job(bigint)'::regprocedure,
  $o$    if v.id is null or v.status <> 'active' then$o$,
  $n$    if v.id is null or v.status <> 'active' or (v.expires_at is not null and v.expires_at <= now()) then$n$);

select pg_temp.patch_fn('public.process_match_job(bigint)'::regprocedure,
  $o$        and v2.status = 'active' and v2.owner_profile_id is distinct from w.profile_id$o$,
  $n$        and v2.status = 'active' and (v2.expires_at is null or v2.expires_at > now()) and v2.owner_profile_id is distinct from w.profile_id$n$);

select pg_temp.patch_fn('public.bot_matching_vacancies(uuid, int, int)'::regprocedure,
  $o$    where v.status = 'active'
      and (w.category_id is null or v.category_id = w.category_id)$o$,
  $n$    where v.status = 'active' and (v.expires_at is null or v.expires_at > now())
      and (w.category_id is null or v.category_id = w.category_id)$n$);

select pg_temp.patch_fn('public.saved_search_new_count(uuid, timestamptz)'::regprocedure,
  $o$  join public.vacancies v on v.status = 'active' and v.published_at > p_since$o$,
  $n$  join public.vacancies v on v.status = 'active' and v.published_at > p_since and (v.expires_at is null or v.expires_at > now())$n$);

-- ---------------------------------------------------------------------------------------------------
-- 6. AI PRO xabari: e'lon, obuna va maosh davri payload'da (Telegram yuborishda qayta tekshirish va "/oy", "/kun")
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn('public.trg_vacancy_ai_alerts()'::regprocedure,
  $o$        'negotiable', new.salary_negotiable
      ), '/jobs/' || new.slug);$o$,
  $n$        'negotiable', new.salary_negotiable,
        'salary_type', new.salary_type,
        'vacancy_id', new.id,
        'alert_id', a.id
      ), '/jobs/' || new.slug);$n$);
