-- ISH TOPDIM · 0086 · Bir kishida bir nechta ishchi e'loni
--
-- Ega (2026-11-20): "men ishchiman — menga faqat 1 ta e'lon joylay olyapman; 10 ta, 100 ta joylasin kerak bo'lsa".
-- Tanlov (ega): har biri alohida e'lon (o'z kasbi, hududi, maoshi, raqami), bir kishiga ko'pi bilan 100 ta.
--
-- Yechim: har e'lon — worker_profiles qatori (qidiruv, e'lon sahifasi, kanal, moderatsiya, raqamlar, rasm — o'zgarishsiz
-- ishlaydi). Shaxsning ASOSIY qatori (is_primary) — avvalgidek: arizalar, takliflar, rezyume, "mening profilim";
-- qo'shimcha qatorlar (is_primary = false) — faqat e'lonlar.
--
--  1) worker_profiles.is_primary (mavjud qatorlar — asosiy) va "bir kishida bitta asosiy" (qisman unique indeks)
--     — avvalgi unique (profile_id) o'rniga. profile_id bo'yicha oddiy indeks.
--  2) "Mening ishchi profilim" so'rovlari — faqat asosiy qator: current_worker_id, can_view_phone, completeness triggeri
--     (ism o'zgarsa — barcha e'lonlari).
--  3) save_simple_worker_listing (aniq yamoq, naqsh 1 marta uchramasa — migratsiya to'xtaydi):
--       · worker_id — o'z e'lonini tahrirlash (boshqanikini emas);
--       · new_listing — yangi e'lon: asosiy hali bo'sh bo'lsa — o'sha; shu kasb va hududda e'loni bo'lsa — o'sha
--         yangilanadi (takror e'lon bo'lmasin); aks holda yangi qator; 100 tadan ortig'i — too_many_listings;
--       · ikkalasi ham yo'q — asosiy e'lon (avvalgidek).
--  4) send_offer — taklif qaysi e'londan yuborilsa ham shaxsga (asosiy qatorga) yoziladi: ishchi uni "Takliflar"ida ko'radi.
--  5) worker_preferences / worker_locations yozish huquqi — egasining barcha e'lonlari (avval faqat current_worker_id).
--
-- Mavjud ma'lumot o'chirilmaydi; qatorlar avvalgidek ishlaydi (hammasi asosiy). Takror ishga tushirish xavfsiz.
-- Rollback: supabase/rollbacks/0086_multi_worker_listings.down.sql (qo'shimcha e'lonlar bo'lsa — avval ularni o'chirish).

-- ---------------------------------------------------------------------------------------------------
-- 1. Asosiy qator
-- ---------------------------------------------------------------------------------------------------
alter table public.worker_profiles add column if not exists is_primary boolean not null default true;
create unique index if not exists worker_profiles_one_primary on public.worker_profiles (profile_id) where is_primary;
create index if not exists idx_worker_profiles_profile on public.worker_profiles (profile_id);
alter table public.worker_profiles drop constraint if exists worker_profiles_profile_id_key;

-- ---------------------------------------------------------------------------------------------------
-- 2. "Mening ishchi profilim" — asosiy qator
-- ---------------------------------------------------------------------------------------------------
create or replace function public.current_worker_id()
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select id from public.worker_profiles where profile_id = auth.uid() and is_primary;
$function$;

create or replace function public.trg_refresh_worker_completeness()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  wid uuid;
begin
  if tg_table_name = 'worker_profiles' then
    wid := coalesce(new.id, old.id);
  elsif tg_table_name = 'profiles' then
    -- 0086: ism, rasm — shaxsning barcha e'lonlariga
    for wid in select id from public.worker_profiles where profile_id = coalesce(new.id, old.id) loop
      perform public.refresh_worker_completeness(wid);
    end loop;
    return null;
  else
    wid := coalesce(new.worker_id, old.worker_id);
  end if;
  if wid is not null then
    perform public.refresh_worker_completeness(wid);
  end if;
  return null;
end $function$;

do $patch$
declare
  def text;
  olds text[];
  news text[];
  n int;
begin
  -- can_view_phone: ariza / taklif — shaxsning asosiy qatori bo'yicha
  def := replace(pg_get_functiondef('public.can_view_phone(uuid)'::regprocedure), E'\r', '');
  if position('and is_primary' in def) = 0 then
    olds := array[
$o1$  select id into owner_worker from public.worker_profiles where profile_id = p_owner;
$o1$,
$o2$  select id into viewer_worker from public.worker_profiles where profile_id = viewer;
$o2$];
    news := array[
$n1$  select id into owner_worker from public.worker_profiles where profile_id = p_owner and is_primary;
$n1$,
$n2$  select id into viewer_worker from public.worker_profiles where profile_id = viewer and is_primary;
$n2$];
    for i in 1 .. array_length(olds, 1) loop
      olds[i] := replace(olds[i], E'\r', '');
      news[i] := replace(news[i], E'\r', '');
      n := (length(def) - length(replace(def, olds[i], ''))) / length(olds[i]);
      if n <> 1 then raise exception '0086: can_view_phone naqsh #% % marta uchradi (1 kutilgan)', i, n; end if;
      def := replace(def, olds[i], news[i]);
    end loop;
    execute def;
  end if;

  -- send_offer: taklif shaxsga (asosiy qator)
  def := replace(pg_get_functiondef('public.send_offer(uuid,uuid,text,text,integer,integer)'::regprocedure), E'\r', '');
  if position('0086' in def) = 0 then
    olds := array[
$o3$    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;
$o3$];
    news := array[
$n3$    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;
  -- 0086: qaysi e'londan yuborilsa ham taklif shaxsga (asosiy qator) — ishchi uni "Takliflar"ida ko'radi, takror bo'lmaydi
  select coalesce((select pw.id from public.worker_profiles x
                     join public.worker_profiles pw on pw.profile_id = x.profile_id and pw.is_primary
                    where x.id = p_worker_id), p_worker_id)
    into p_worker_id;
$n3$];
    olds[1] := replace(olds[1], E'\r', '');
    news[1] := replace(news[1], E'\r', '');
    n := (length(def) - length(replace(def, olds[1], ''))) / length(olds[1]);
    if n <> 1 then raise exception '0086: send_offer naqsh % marta uchradi (1 kutilgan)', n; end if;
    execute replace(def, olds[1], news[1]);
  end if;
end $patch$;

-- ---------------------------------------------------------------------------------------------------
-- 3. save_simple_worker_listing: yangi e'lon / o'z e'lonini tahrirlash
-- ---------------------------------------------------------------------------------------------------
do $patch$
declare
  def text := replace(pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure), E'\r', '');
  olds text[];
  news text[];
  n int;
begin
  if position('new_listing' in def) > 0 then
    return; -- allaqachon yamalgan (takror ishga tushirish)
  end if;

  olds := array[
$o1$  st text;
begin
$o1$,
$o2$  select id into wid from public.worker_profiles where profile_id = me;
  if wid is null then
$o2$];

  news := array[
$n1$  st text;
  v_target uuid := nullif(p->>'worker_id', '')::uuid;
  v_new boolean := coalesce((p->>'new_listing')::boolean, false);
  v_count int;
begin
$n1$,
$n2$  -- 0086: bir kishida bir nechta e'lon. worker_id — o'z e'lonini tahrirlash; new_listing — yangi e'lon (asosiy hali bo'sh
  -- bo'lsa — o'sha; shu kasb va hududda e'loni bo'lsa — o'sha yangilanadi, takror bo'lmasin); ikkalasi yo'q — asosiy.
  select id into wid from public.worker_profiles where profile_id = me and is_primary;
  if v_target is not null then
    select id into wid from public.worker_profiles where id = v_target and profile_id = me;
    if wid is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  elsif v_new and wid is not null and exists (select 1 from public.worker_profiles x where x.id = wid and x.onboarding_completed_at is not null) then
    select x.id into wid from public.worker_profiles x
     where x.profile_id = me and x.region_id = v_region and x.onboarding_completed_at is not null
       and (x.profession_node_id = node.id or (node.id is null and lower(x.custom_profession) = lower(v_custom)))
     order by x.is_primary desc, x.created_at
     limit 1;
    if wid is null then
      select count(*) into v_count from public.worker_profiles where profile_id = me;
      if v_count >= 100 then raise exception 'too_many_listings' using errcode = '23514'; end if;
      insert into public.worker_profiles (profile_id, is_public, is_primary) values (me, false, false) returning id into wid;
    end if;
  end if;
  if wid is null then
$n2$];

  for i in 1 .. array_length(olds, 1) loop
    olds[i] := replace(olds[i], E'\r', '');
    news[i] := replace(news[i], E'\r', '');
    n := (length(def) - length(replace(def, olds[i], ''))) / length(olds[i]);
    if n <> 1 then raise exception '0086: save_simple_worker_listing naqsh #% % marta uchradi (1 kutilgan)', i, n; end if;
    def := replace(def, olds[i], news[i]);
  end loop;
  execute def;
end $patch$;

-- ---------------------------------------------------------------------------------------------------
-- 5. Maosh/jadval va ish joyi tumanlari — egasining barcha e'lonlari
-- ---------------------------------------------------------------------------------------------------
drop policy if exists "worker_preferences_write" on public.worker_preferences;
create policy "worker_preferences_write" on public.worker_preferences for all to authenticated
  using (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = (select auth.uid())))
  with check (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = (select auth.uid()))
              and (select public.is_active_user()));

drop policy if exists "worker_locations_write" on public.worker_locations;
create policy "worker_locations_write" on public.worker_locations for all to authenticated
  using (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = (select auth.uid())))
  with check (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = (select auth.uid()))
              and (select public.is_active_user()));
