-- ISH TOPDIM · 0081 · Ishchi e'lonidagi telefon raqami — oynada qo'lda yoziladi, ikkinchi raqam ham bo'lishi mumkin
--
-- Ega (2026-11-17): "telefon raqamini qo'lda kiritsin, kiritmasa e'lon berilmasin; 2 ta nomer bo'lsa — «yana nomer»;
-- nomer majburiy, profildagi nomer emas — boshqa nomer joylasin, xohlasa profildagini, lekin qo'lda yozilsin".
--
--  1) worker_listing_phones — e'londa ko'rsatiladigan raqam (majburiy) va qo'shimcha raqam (ixtiyoriy). Hisob raqami
--     (profile_contacts.phone — kirish va tasdiqlash uchun) o'zgarmaydi va e'londa ko'rsatilmaydi.
--     O'qish/yozish — faqat e'lon egasi (RLS). Boshqalar raqamni faqat e'lon sahifasida ko'radi: simple_worker_listing
--     orqali, kirgan va 0074 limiti ichida (mehmon va ro'yxatlar — telefonsiz, avvalgidek).
--  2) save_simple_worker_listing — `listing_phone` / `listing_phone2` qabul qiladi (aniq yamoq, naqsh 1 marta uchramasa —
--     migratsiya to'xtaydi; allaqachon yamalgan bo'lsa — tegmaydi):
--       · raqam yozilgan bo'lsa — hisobda tasdiqlangan raqam bo'lishi shart emas (vakansiyadagidek), e'londa shu raqam,
--         hisob raqamining ko'rinish sozlamasi o'zgarmaydi;
--       · raqamsiz saqlansa (to'liq forma, /post/worker) — e'lon avvalgidek hisob raqami va rozilik qoidasiga qaytadi.
--  3) simple_worker_listing — e'londagi raqam (bo'lsa) hisob raqami o'rniga, oxirida yangi `phone2` ustuni.
--     Qaytaradigan ustunlar o'zgargani uchun funksiya qayta yaratiladi (drop + create, bitta tranzaksiyada).
--
-- Faqat qo'shimcha: mavjud ma'lumotga tegilmaydi. Takror ishga tushirish xavfsiz.
-- Rollback: supabase/rollbacks/0081_listing_phones.down.sql

-- ---------------------------------------------------------------------------------------------------
-- 1. Jadval
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.worker_listing_phones (
  worker_id   uuid primary key references public.worker_profiles(id) on delete cascade,
  phone       text not null,
  phone2      text,
  updated_at  timestamptz not null default now(),
  constraint worker_listing_phones_phone_format check (phone ~ '^\+998[0-9]{9}$'),
  constraint worker_listing_phones_phone2_format check (phone2 is null or (phone2 ~ '^\+998[0-9]{9}$' and phone2 <> phone))
);
drop trigger if exists trg_worker_listing_phones_updated on public.worker_listing_phones;
create trigger trg_worker_listing_phones_updated before update on public.worker_listing_phones
  for each row execute function public.set_updated_at();

alter table public.worker_listing_phones enable row level security;
revoke all on public.worker_listing_phones from public, anon, authenticated;
grant select, insert, update, delete on public.worker_listing_phones to authenticated;
grant all on public.worker_listing_phones to service_role;
drop policy if exists worker_listing_phones_own on public.worker_listing_phones;
create policy worker_listing_phones_own on public.worker_listing_phones for all to authenticated
  using (exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()))
  with check (not public.is_blocked(auth.uid())
              and exists (select 1 from public.worker_profiles w where w.id = worker_id and w.profile_id = auth.uid()));

-- ---------------------------------------------------------------------------------------------------
-- 2. save_simple_worker_listing: e'londagi raqam(lar)
-- ---------------------------------------------------------------------------------------------------
do $patch$
declare
  def text := replace(pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure), E'\r', '');
  olds text[];
  news text[];
  n int;
begin
  if position('listing_phone' in def) > 0 then
    return; -- allaqachon yamalgan (takror ishga tushirish)
  end if;

  olds := array[
$o1$  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
$o1$,
$o2$  if not exists (select 1 from public.profile_contacts c where c.profile_id = me and c.phone is not null) then
    raise exception 'phone_required' using errcode = '23514';
  end if;
$o2$,
$o3$  update public.profile_contacts set phone_visibility = case
      when v_show_phone then 'everyone'::public.phone_visibility
      when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
      else phone_visibility end
  where profile_id = me;
$o3$];

  news := array[
$n1$  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
  v_lphone text := nullif(btrim(coalesce(p->>'listing_phone', '')), '');
  v_lphone2 text := nullif(btrim(coalesce(p->>'listing_phone2', '')), '');
$n1$,
$n2$  -- 0081: e'londagi raqam oynada qo'lda yoziladi; yozilgan bo'lsa hisobda tasdiqlangan raqam shart emas (vakansiyadagidek)
  if v_lphone is not null and v_lphone !~ '^\+998[0-9]{9}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_lphone2 is not null and (v_lphone is null or v_lphone2 !~ '^\+998[0-9]{9}$') then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_lphone2 = v_lphone then v_lphone2 := null; end if;
  if v_lphone is null and not exists (select 1 from public.profile_contacts c where c.profile_id = me and c.phone is not null) then
    raise exception 'phone_required' using errcode = '23514';
  end if;
$n2$,
$n3$  if v_lphone is not null then
    -- 0081: e'londa — qo'lda yozilgan raqam(lar); hisob raqamining ko'rinish sozlamasi o'zgarmaydi
    insert into public.worker_listing_phones (worker_id, phone, phone2) values (wid, v_lphone, v_lphone2)
    on conflict (worker_id) do update set phone = excluded.phone, phone2 = excluded.phone2;
  else
    -- raqamsiz saqlandi (to'liq forma): e'lon yana hisob raqami va rozilik qoidasiga qaytadi
    delete from public.worker_listing_phones where worker_id = wid;
    -- telefonni e'londa ko'rsatish roziligi: rozilik → hammaga; rozilik olib tashlansa → faqat ariza yuborgan ish beruvchiga
    update public.profile_contacts set phone_visibility = case
        when v_show_phone then 'everyone'::public.phone_visibility
        when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
        else phone_visibility end
    where profile_id = me;
  end if;
$n3$];

  for i in 1 .. array_length(olds, 1) loop
    n := (length(def) - length(replace(def, olds[i], ''))) / length(olds[i]);
    if n <> 1 then raise exception '0081: save_simple_worker_listing naqsh #% % marta uchradi (1 kutilgan)', i, n; end if;
    def := replace(def, olds[i], news[i]);
  end loop;
  execute def;
end $patch$;

-- ---------------------------------------------------------------------------------------------------
-- 3. simple_worker_listing: e'londagi raqam(lar)
-- ---------------------------------------------------------------------------------------------------
drop function if exists public.simple_worker_listing(uuid);
create function public.simple_worker_listing(p_id uuid)
 returns table(id uuid, first_name text, last_initial text, avatar_url text, headline text, profession_node_id uuid, profession_name_uz text, profession_name_ru text, profession_name_en text, category_slug text, category_icon text, about text, region_name_uz text, region_name_ru text, region_name_en text, region_name_oz text, district_name_uz text, district_name_ru text, district_name_en text, district_name_oz text, remote_ok boolean, experience_level experience_level, salary_expected integer, schedules work_schedule[], phone text, is_owner boolean, is_listed boolean, last_active_at timestamp with time zone, phone2 text)
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
    -- 0081: e'londa qo'lda yozilgan raqam (egasi e'lon uchun bergan) — hisob raqami va uning ko'rinish sozlamasi o'rniga
    case when coalesce(lp.phone, pc.phone) is not null
      and (lp.phone is not null or pc.phone_visibility = 'everyone' or public.can_view_phone(w.profile_id))
      and public.contact_reveal_allowed('worker', w.id, w.profile_id)
    then coalesce(lp.phone, pc.phone) end,
    w.profile_id = auth.uid(),
    (w.is_public and w.status <> 'not_looking'),
    w.last_active_at,
    -- shu e'lonning raqami 24 soat ichida ochilgan bo'lsa, qayta tekshiruv limitni sarflamaydi (0074)
    case when lp.phone2 is not null and public.contact_reveal_allowed('worker', w.id, w.profile_id) then lp.phone2 end
  from public.worker_profiles w
  join public.profiles pf on pf.id = w.profile_id
  left join public.profile_contacts pc on pc.profile_id = w.profile_id
  left join public.worker_listing_phones lp on lp.worker_id = w.id
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
