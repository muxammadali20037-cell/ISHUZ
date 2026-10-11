-- 0057 · Sodda e'lon formalarida "Kasbim topilmadi" (F-05): katalogda yo'q kasb asl nomi + eng yaqin soha bilan saqlanadi.
--        + qisqa formadan saqlashda batafsil profildagi masofaviy tanlov (any) saqlanadi.
--
-- Mavjud infratuzilma qayta ishlatiladi (0035): worker_profiles/vacancies.custom_profession + custom_occupation_requests
-- (katalogni boyitish navbati, dublikat — unique indeks). Soxta kasb UUID yaratilmaydi, boshqa kasbga bog'lanmaydi;
-- custom kasb katalog tuguni sifatida ko'rsatilmaydi. Moderatsiya: snapshot va o'zgarish triggerlari custom_profession'ni
-- allaqachon qamraydi (0049). Qidiruv: tugunsiz e'lonlar sarlavha/headline bo'yicha topiladi (custom matn shu maydonda).
--
-- Faqat qo'shimcha: DROP/DELETE yo'q. Funksiyalar aniq yamoq bilan o'zgartiriladi (naqsh 1 marta uchramasa — migratsiya
-- to'xtaydi). 0056 dagi save_simple_vacancy yamog'i (yashirin telefon) saqlanadi.
-- Rollback: 0049_moderation.sql dagi ikki funksiya matnini qayta qo'llash (0056 yamog'i bilan) + simple_listing_features() ni olib tashlash.

create or replace function pg_temp.patch_fn(p_fn regprocedure, p_old text, p_new text) returns void
language plpgsql as $$
declare def text := pg_get_functiondef(p_fn); n int;
begin
  n := (length(def) - length(replace(def, p_old, ''))) / greatest(length(p_old), 1);
  if n <> 1 then raise exception 'patch_fn %: naqsh % marta uchradi (1 kutilgan)', p_fn, n; end if;
  execute replace(def, p_old, p_new);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Ishchi e'loni
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn('public.save_simple_worker_listing(jsonb)'::regprocedure,
  $o$  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);$o$,
  $n$  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
  v_custom text := nullif(regexp_replace(btrim(coalesce(p->>'custom_profession', '')), '\s+', ' ', 'g'), '');
  v_category uuid := nullif(p->>'category_id', '')::uuid;$n$);

select pg_temp.patch_fn('public.save_simple_worker_listing(jsonb)'::regprocedure,
  $o$  select * into node from public.profession_nodes where id = v_node and is_active and selectable;
  if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;$o$,
  $n$  if v_node is null and v_custom is not null then
    -- katalogda yo'q kasb: asl nom + eng yaqin soha (faol); tugun bog'lanmaydi
    if char_length(v_custom) < 2 or char_length(v_custom) > 120 then raise exception 'invalid_custom_profession' using errcode = '22023'; end if;
    if not exists (select 1 from public.categories c where c.id = v_category and c.is_active) then raise exception 'invalid_category' using errcode = '22023'; end if;
  else
    select * into node from public.profession_nodes where id = v_node and is_active and selectable;
    if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
    v_custom := null;
  end if;$n$);

select pg_temp.patch_fn('public.save_simple_worker_listing(jsonb)'::regprocedure,
  $o$  v_headline := left(coalesce(nullif(btrim(p->>'headline'), ''), node.name_uz), 80);$o$,
  $n$  v_headline := left(coalesce(nullif(btrim(p->>'headline'), ''), node.name_uz, v_custom), 80);$n$);

select pg_temp.patch_fn('public.save_simple_worker_listing(jsonb)'::regprocedure,
  $o$    profession_node_id = node.id,
    custom_profession = null,$o$,
  $n$    profession_node_id = node.id,
    custom_profession = v_custom,
    category_id = case when v_custom is not null then v_category else category_id end,
    subcategory_id = case when v_custom is not null then null else subcategory_id end,$n$);

select pg_temp.patch_fn('public.save_simple_worker_listing(jsonb)'::regprocedure,
  $o$    onboarding_step = 9
  where id = wid;$o$,
  $n$    onboarding_step = 9
  where id = wid;

  -- katalogni boyitish navbati (bir ishchi × bir matn — bir marta)
  if v_custom is not null then
    insert into public.custom_occupation_requests (raw_text, category_id, context, worker_id)
    values (v_custom, v_category, 'worker', wid)
    on conflict do nothing;
  end if;$n$);

-- Batafsil profildagi "masofaviy ham, joyida ham" (any) qisqa formadan saqlanganda 'no' ga aylanmasin:
-- ilova o'zgarmagan qiymatni aniq yuboradi (berilmasa — avvalgi xatti-harakat)
select pg_temp.patch_fn('public.save_simple_worker_listing(jsonb)'::regprocedure,
  $o$    remote_preference = case when v_remote then 'yes'::public.remote_preference else 'no'::public.remote_preference end,$o$,
  $n$    remote_preference = coalesce(nullif(p->>'remote_preference', '')::public.remote_preference,
                                 case when v_remote then 'yes'::public.remote_preference else 'no'::public.remote_preference end),$n$);

-- ---------------------------------------------------------------------------------------------------
-- Ish beruvchi e'loni
-- ---------------------------------------------------------------------------------------------------
select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$  v_photo text := nullif(btrim(coalesce(p->>'photo_path', '')), '');$o$,
  $n$  v_photo text := nullif(btrim(coalesce(p->>'photo_path', '')), '');
  v_custom text := nullif(regexp_replace(btrim(coalesce(p->>'custom_profession', '')), '\s+', ' ', 'g'), '');
  v_category uuid := nullif(p->>'category_id', '')::uuid;$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$  select * into node from public.profession_nodes where id = v_node and is_active and selectable;
  if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
  v_title := left(coalesce(nullif(v_title, ''), node.name_uz), 120);$o$,
  $n$  if v_node is null and v_custom is not null then
    if char_length(v_custom) < 2 or char_length(v_custom) > 120 then raise exception 'invalid_custom_profession' using errcode = '22023'; end if;
    if not exists (select 1 from public.categories c where c.id = v_category and c.is_active) then raise exception 'invalid_category' using errcode = '22023'; end if;
  else
    select * into node from public.profession_nodes where id = v_node and is_active and selectable;
    if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
    v_custom := null;
  end if;
  v_title := left(coalesce(nullif(v_title, ''), node.name_uz, v_custom), 120);$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$                                  is_government, client_ref, photo_path)$o$,
  $n$                                  is_government, client_ref, photo_path, custom_profession, category_id)$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$            v_remote, v_from, v_to, v_negotiable, 'monthly', v_schedule, v_exp, v_type = 'government', v_ref, v_photo)$o$,
  $n$            v_remote, v_from, v_to, v_negotiable, 'monthly', v_schedule, v_exp, v_type = 'government', v_ref, v_photo,
            v_custom, case when v_custom is not null then v_category end)$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$      title = v_title, profession_node_id = node.id, custom_profession = null, description = v_desc,$o$,
  $n$      title = v_title, profession_node_id = node.id, custom_profession = v_custom, description = v_desc,
      category_id = case when v_custom is not null then v_category else category_id end,
      subcategory_id = case when v_custom is not null then null else subcategory_id end,$n$);

select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  $o$  on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = excluded.show_phone, updated_at = now();$o$,
  $n$  on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = excluded.show_phone, updated_at = now();

  if v_custom is not null then
    insert into public.custom_occupation_requests (raw_text, category_id, context, vacancy_id)
    values (v_custom, v_category, 'vacancy', v.id)
    on conflict do nothing;
  end if;$n$);

-- ---------------------------------------------------------------------------------------------------
-- Ilova qaysi imkoniyat bazada borligini biladi (yangi kod eski bazada "Kasbim topilmadi" tugmasini ko'rsatmaydi)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true);
$$;
revoke execute on function public.simple_listing_features() from public;
grant execute on function public.simple_listing_features() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
