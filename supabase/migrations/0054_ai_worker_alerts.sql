-- ISH.UZ · 0054 · AI yordamchi (PRO) ish beruvchi uchun: "qanday ishchi kerak"ligini o'z so'zi bilan yozadi,
-- AI uni kasb / hudud / tajriba / maosh byudjetiga ajratadi; mos ishchi e'loni ochiq bo'lishi bilan (moderatsiyadan
-- o'tgach) Telegram'ga xabar boradi.
--
--  * Obuna umumiy: ai_alert_subscriptions (0041) — bitta to'lov ikkala yo'nalishni ham qamraydi
--    ("Menga ish topsin" va "Menga ishchi topsin"). app_settings.ai_alerts_paid=false bo'lsa — bepul.
--  * Xabar mavjud outbox orqali (notifications, kind = ai_worker_alert) — alohida yuborish tizimi yo'q.
--  * Ish beruvchiga ishchining telefoni yuborilmaydi: faqat ism + familiya bosh harfi, kasb, hudud, tajriba.
-- Idempotent, drop'siz.

create table if not exists public.ai_worker_alerts (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  prompt                text not null check (length(trim(prompt)) between 3 and 500),
  label                 text not null check (length(trim(label)) between 1 and 160),
  profession_node_id    uuid references public.profession_nodes(id) on delete set null,
  category_id           uuid references public.categories(id) on delete set null,
  region_id             uuid references public.regions(id) on delete set null,
  district_ids          uuid[] not null default '{}' check (cardinality(district_ids) <= 30),
  experience_min_months int not null default 0 check (experience_min_months between 0 and 120),
  salary_max            int check (salary_max is null or salary_max > 0),
  employment_types      public.employment_type[] not null default '{}',
  schedules             public.work_schedule[] not null default '{}',
  remote_only           boolean not null default false,
  q                     text check (q is null or length(q) <= 120),
  is_active             boolean not null default true,
  hits_count            int not null default 0,
  last_hit_at           timestamptz,
  created_at            timestamptz not null default now(),
  -- kamida bitta mezon (aks holda har bir ishchi haqida xabar ketadi)
  constraint ai_worker_alerts_has_criteria check (profession_node_id is not null or category_id is not null or (q is not null and length(trim(q)) >= 2))
);
create index if not exists idx_ai_worker_alerts_profile on public.ai_worker_alerts (profile_id, created_at desc);
create index if not exists idx_ai_worker_alerts_active on public.ai_worker_alerts (category_id) where is_active;

-- Bir alertga bitta ishchi haqida bitta xabar
create table if not exists public.ai_worker_alert_hits (
  alert_id   uuid not null references public.ai_worker_alerts(id) on delete cascade,
  worker_id  uuid not null references public.worker_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alert_id, worker_id)
);
create index if not exists idx_ai_worker_alert_hits_worker on public.ai_worker_alert_hits (worker_id);

alter table public.ai_worker_alerts enable row level security;
alter table public.ai_worker_alert_hits enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_worker_alerts' and policyname = 'ai_worker_alerts_own_select') then
    create policy "ai_worker_alerts_own_select" on public.ai_worker_alerts for select to authenticated using (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_worker_alerts' and policyname = 'ai_worker_alerts_own_insert') then
    create policy "ai_worker_alerts_own_insert" on public.ai_worker_alerts for insert to authenticated
      with check (profile_id = auth.uid() and public.is_active_user() and hits_count = 0 and last_hit_at is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_worker_alerts' and policyname = 'ai_worker_alerts_own_update') then
    create policy "ai_worker_alerts_own_update" on public.ai_worker_alerts for update to authenticated
      using (profile_id = auth.uid()) with check (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_worker_alerts' and policyname = 'ai_worker_alerts_own_delete') then
    create policy "ai_worker_alerts_own_delete" on public.ai_worker_alerts for delete to authenticated using (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_worker_alert_hits' and policyname = 'ai_worker_alert_hits_own') then
    create policy "ai_worker_alert_hits_own" on public.ai_worker_alert_hits for select to authenticated
      using (exists (select 1 from public.ai_worker_alerts a where a.id = alert_id and a.profile_id = auth.uid()));
  end if;
end $pol$;
revoke all on public.ai_worker_alerts, public.ai_worker_alert_hits from anon, authenticated;
grant select, insert, delete on public.ai_worker_alerts to authenticated;
-- Faqat yoqish/o'chirish (topilganlar soni — yo'q)
grant update (is_active) on public.ai_worker_alerts to authenticated;
grant select on public.ai_worker_alert_hits to authenticated;

-- Bir foydalanuvchiga 3 ta kuzatuv
create or replace function public.trg_ai_worker_alerts_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ai_worker_alerts where profile_id = new.profile_id) >= 3 then
    raise exception 'ai_alert_limit' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace trigger trg_ai_worker_alerts_limit before insert on public.ai_worker_alerts
  for each row execute function public.trg_ai_worker_alerts_limit();

-- Ishchi e'loni ochiq bo'lganda (moderatsiyadan o'tib) — mos ish beruvchi kuzatuvlariga darhol bildirishnoma
create or replace function public.trg_worker_ai_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anc uuid[];
  dists uuid[];
  pref public.worker_preferences;
  sal int;
  a record;
  who text;
  prof_uz text;
  prof_ru text;
  region_uz text;
  region_ru text;
  district_uz text;
  district_ru text;
  paid_only boolean := public.ai_alerts_paid();
begin
  if not new.is_public or (tg_op = 'UPDATE' and old.is_public) then
    return null;
  end if;
  if new.status = 'not_looking' or public.is_blocked(new.profile_id) then
    return null;
  end if;

  -- ishchi kasblari (asosiy + qo'shimcha) va ularning barcha ota yo'nalishlari ("Kardiolog" → "Shifokorlar" → "Tibbiyot")
  with recursive base as (
    select new.profession_node_id as id where new.profession_node_id is not null
    union
    select wp.node_id from public.worker_professions wp where wp.worker_id = new.id
  ), up as (
    select n.id, n.parent_id from public.profession_nodes n join base b on b.id = n.id
    union
    select p.id, p.parent_id from public.profession_nodes p join up on p.id = up.parent_id
  ) select array_agg(distinct up.id) into anc from up;

  -- ishlay oladigan tumanlar: asosiy + qo'shimcha
  select array_agg(distinct x) into dists from (
    select new.district_id as x where new.district_id is not null
    union
    select wl.district_id from public.worker_locations wl where wl.worker_id = new.id
  ) s;

  select * into pref from public.worker_preferences where worker_id = new.id;
  if coalesce(pref.salary_min, pref.salary_expected) is not null then
    sal := public.salary_monthly_equivalent(coalesce(pref.salary_min, pref.salary_expected), coalesce(pref.salary_type, 'monthly'));
  end if;

  select btrim(concat_ws(' ', p.first_name, nullif(left(coalesce(p.last_name, ''), 1), '') || '.')) into who
  from public.profiles p where p.id = new.profile_id;
  select n.name_uz, n.name_ru into prof_uz, prof_ru from public.profession_nodes n where n.id = new.profession_node_id;
  select r.name_uz, r.name_ru into region_uz, region_ru from public.regions r where r.id = new.region_id;
  select d.name_uz, d.name_ru into district_uz, district_ru from public.districts d where d.id = new.district_id;

  for a in
    select al.* from public.ai_worker_alerts al
    where al.is_active
      and al.profile_id is distinct from new.profile_id
      and not public.is_blocked(al.profile_id)
      and (not paid_only
           or exists (select 1 from public.ai_alert_subscriptions s where s.profile_id = al.profile_id and s.paid_until > now()))
      -- kasb (ota yo'nalish ham — "shifokor" → barcha shifokorlar); kasb aytilmagan bo'lsa — soha
      and (al.profession_node_id is null or al.profession_node_id = any(coalesce(anc, '{}')))
      and (al.category_id is null or al.profession_node_id is not null or al.category_id = new.category_id)
      -- hudud: masofaviy ish bo'lsa — ahamiyatsiz
      and (al.region_id is null or al.remote_only or new.region_id = al.region_id
           or exists (select 1 from public.districts d where d.id = any(coalesce(dists, '{}')) and d.region_id = al.region_id))
      and (cardinality(al.district_ids) = 0 or al.remote_only
           or coalesce(dists, '{}') && al.district_ids
           or (new.district_id is null and new.region_id = al.region_id))
      and (not al.remote_only or new.remote_preference in ('yes', 'any'))
      and (al.experience_min_months = 0 or public.experience_level_months(new.experience_level) >= al.experience_min_months)
      -- maosh: ishchi kutgani byudjetdan oshmasin (kutilgan maosh yozilmagan bo'lsa — mos)
      and (al.salary_max is null or sal is null or sal <= al.salary_max)
      and (cardinality(al.schedules) = 0 or cardinality(coalesce(pref.schedules, '{}')) = 0 or pref.schedules && al.schedules)
      and (cardinality(al.employment_types) = 0 or cardinality(coalesce(pref.employment_types, '{}')) = 0 or pref.employment_types && al.employment_types)
      and (al.q is null or al.q = '' or new.headline ilike '%' || al.q || '%' or new.custom_profession ilike '%' || al.q || '%')
  loop
    insert into public.ai_worker_alert_hits (alert_id, worker_id) values (a.id, new.id) on conflict do nothing;
    if found then
      update public.ai_worker_alerts set hits_count = hits_count + 1, last_hit_at = now() where id = a.id;
      perform public.notify(a.profile_id, 'system', jsonb_build_object(
        'kind', 'ai_worker_alert',
        'label', a.label,
        'worker_id', new.id,
        'name', coalesce(who, ''),
        'profession', coalesce(prof_uz, nullif(new.headline, ''), new.custom_profession, ''),
        'profession_ru', coalesce(prof_ru, prof_uz, nullif(new.headline, ''), new.custom_profession, ''),
        'region', concat_ws(', ', region_uz, district_uz),
        'region_ru', concat_ws(', ', coalesce(region_ru, region_uz), coalesce(district_ru, district_uz)),
        'experience', new.experience_level,
        'salary', sal
      ), '/listing/' || new.id);
    end if;
  end loop;
  return null;
end $$;
create or replace trigger trg_worker_ai_alerts after insert or update of is_public on public.worker_profiles
  for each row execute function public.trg_worker_ai_alerts();

revoke execute on function public.trg_ai_worker_alerts_limit(), public.trg_worker_ai_alerts() from public, anon, authenticated;
