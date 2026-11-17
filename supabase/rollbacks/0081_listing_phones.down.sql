-- 0081 qaytarish: e'londagi qo'lda yozilgan raqamlar olib tashlanadi — e'lonlar yana hisob raqamini ko'rsatadi.
-- DIQQAT: worker_listing_phones jadvalidagi raqamlar o'chadi (hisob raqamlari — profile_contacts — o'zgarmaydi).
begin;

-- 1. save_simple_worker_listing: yamoqni teskari qo'llash
do $patch$
declare
  def text := replace(pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure), E'\r', '');
  s int;
  e int;
begin
  if position('listing_phone' in def) = 0 then return; end if;
  def := replace(def, $x$  v_lphone text := nullif(btrim(coalesce(p->>'listing_phone', '')), '');
  v_lphone2 text := nullif(btrim(coalesce(p->>'listing_phone2', '')), '');
$x$, '');
  def := replace(def, $x$  -- 0081: e'londagi raqam oynada qo'lda yoziladi; yozilgan bo'lsa hisobda tasdiqlangan raqam shart emas (vakansiyadagidek)
  if v_lphone is not null and v_lphone !~ '^\+998[0-9]{9}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_lphone2 is not null and (v_lphone is null or v_lphone2 !~ '^\+998[0-9]{9}$') then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_lphone2 = v_lphone then v_lphone2 := null; end if;
  if v_lphone is null and not exists$x$, '  if not exists');
  s := position('  if v_lphone is not null then' in def);
  e := position('    where profile_id = me;
  end if;
' in def);
  if s = 0 or e = 0 then raise exception '0081 rollback: naqsh topilmadi'; end if;
  def := left(def, s - 1) || $x$  update public.profile_contacts set phone_visibility = case
      when v_show_phone then 'everyone'::public.phone_visibility
      when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
      else phone_visibility end
  where profile_id = me;
$x$ || substr(def, e + length('    where profile_id = me;
  end if;
'));
  execute def;
end $patch$;

-- 2. simple_worker_listing: 0074 dagi ko'rinish (phone2 ustunisiz)
drop function if exists public.simple_worker_listing(uuid);
create function public.simple_worker_listing(p_id uuid)
 returns table(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, remote_ok boolean, experience_level experience_level, salary_expected integer, schedules work_schedule[], phone text, is_owner boolean, is_listed boolean, last_active_at timestamp with time zone)
 language sql
 volatile security definer
 set search_path to 'public'
as $function$
  select w.id, pf.first_name, left(coalesce(pf.last_name, ''), 1), pf.avatar_url, w.headline,
    w.profession_node_id, pn.name_uz, pn.name_ru, pn.name_en,
    cat.slug, coalesce(pn.icon, cat.icon), w.about,
    rg.name_uz, rg.name_ru, rg.name_en, rg.name_oz,
    d.name_uz, d.name_ru, d.name_en, d.name_oz,
    w.remote_preference = 'yes', w.experience_level, pr.salary_expected, coalesce(pr.schedules, '{}'),
    case when pc.phone is not null
      and (pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id))
      and public.contact_reveal_allowed('worker', w.id, w.profile_id)
    then pc.phone end,
    w.profile_id = auth.uid(),
    (w.is_public and w.status <> 'not_looking'),
    w.last_active_at
  from public.worker_profiles w
  join public.profiles pf on pf.id = w.profile_id
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_preferences pr on pr.worker_id = w.id
  left join public.profession_nodes pn on pn.id = w.profession_node_id
  left join public.categories cat on cat.id = w.category_id
  left join public.regions rg on rg.id = w.region_id
  left join public.districts d on d.id = w.district_id
  where w.id = p_id
    and w.onboarding_completed_at is not null
    and (w.profile_id = auth.uid() or (w.is_public and not pf.is_blocked and w.status <> 'not_looking'));
$function$;
grant execute on function public.simple_worker_listing(uuid) to anon, authenticated, service_role;

-- 3. jadval
drop table if exists public.worker_listing_phones;

commit;
