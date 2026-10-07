-- ISH.UZ · 0039 · Aqlli AI qidiruv (PRO): ish qidiruvchi o'z so'zi bilan qanday ish kerakligini yozadi,
-- AI uni kasb/hudud/maoshga ajratadi; mos vakansiya e'lon qilinishi bilan (bir daqiqa ichida) Telegram'ga xabar boradi.
-- To'lov: app_settings.billing_enabled=false bo'lsa — bepul (ishga tushirish davri); yoqilgach faqat paid_until > now().
-- Idempotent, drop'siz.

create table if not exists public.ai_job_alerts (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  prompt             text not null check (length(trim(prompt)) between 3 and 500),
  label              text not null check (length(trim(label)) between 1 and 160),
  profession_node_id uuid references public.profession_nodes(id) on delete set null,
  category_id        uuid references public.categories(id) on delete set null,
  region_id          uuid references public.regions(id) on delete set null,
  district_ids       uuid[] not null default '{}' check (cardinality(district_ids) <= 30),
  salary_min         int check (salary_min is null or salary_min > 0),
  employment_types   public.employment_type[] not null default '{}',
  schedules          public.work_schedule[] not null default '{}',
  is_remote          boolean not null default false,
  no_experience      boolean not null default false,
  q                  text check (q is null or length(q) <= 120),
  is_active          boolean not null default true,
  paid_until         timestamptz,
  hits_count         int not null default 0,
  last_hit_at        timestamptz,
  created_at         timestamptz not null default now(),
  -- kamida bitta mezon bo'lishi shart (aks holda har bir vakansiya haqida xabar ketadi)
  constraint ai_job_alerts_has_criteria check (profession_node_id is not null or category_id is not null or (q is not null and length(trim(q)) >= 2))
);
create index if not exists idx_ai_job_alerts_profile on public.ai_job_alerts (profile_id, created_at desc);
create index if not exists idx_ai_job_alerts_active on public.ai_job_alerts (category_id) where is_active;

-- Har bir vakansiya bo'yicha bitta alertga bitta xabar
create table if not exists public.ai_job_alert_hits (
  alert_id   uuid not null references public.ai_job_alerts(id) on delete cascade,
  vacancy_id uuid not null references public.vacancies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alert_id, vacancy_id)
);

alter table public.ai_job_alerts enable row level security;
alter table public.ai_job_alert_hits enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_job_alerts' and policyname = 'ai_job_alerts_own_select') then
    create policy "ai_job_alerts_own_select" on public.ai_job_alerts for select to authenticated using (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_job_alerts' and policyname = 'ai_job_alerts_own_insert') then
    -- paid_until mijozdan kelmaydi: faqat to'lov tizimi (service_role) yozadi
    create policy "ai_job_alerts_own_insert" on public.ai_job_alerts for insert to authenticated
      with check (profile_id = auth.uid() and public.is_active_user() and paid_until is null and hits_count = 0);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_job_alerts' and policyname = 'ai_job_alerts_own_delete') then
    create policy "ai_job_alerts_own_delete" on public.ai_job_alerts for delete to authenticated using (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_job_alert_hits' and policyname = 'ai_job_alert_hits_own') then
    create policy "ai_job_alert_hits_own" on public.ai_job_alert_hits for select to authenticated
      using (exists (select 1 from public.ai_job_alerts a where a.id = alert_id and a.profile_id = auth.uid()));
  end if;
end $$;
revoke all on public.ai_job_alerts, public.ai_job_alert_hits from anon, authenticated;
grant select, insert, delete on public.ai_job_alerts to authenticated;
-- Faqat yoqish/o'chirish ustunini o'zgartirish mumkin (paid_until, hits — yo'q)
grant update (is_active) on public.ai_job_alerts to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_job_alerts' and policyname = 'ai_job_alerts_own_update') then
    create policy "ai_job_alerts_own_update" on public.ai_job_alerts for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
  end if;
end $$;
grant select on public.ai_job_alert_hits to authenticated;

-- Bir foydalanuvchiga 3 ta alert
create or replace function public.trg_ai_job_alerts_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ai_job_alerts where profile_id = new.profile_id) >= 3 then
    raise exception 'ai_alert_limit' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace trigger trg_ai_job_alerts_limit before insert on public.ai_job_alerts for each row execute function public.trg_ai_job_alerts_limit();

-- Vakansiya faol bo'lganda (e'lon / moderatsiyadan o'tish) — mos alertlarga darhol bildirishnoma
create or replace function public.trg_vacancy_ai_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anc uuid[];
  a record;
  who text;
  verified boolean;
  region text;
  paid_only boolean := public.billing_enabled();
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then
    return null;
  end if;

  -- vakansiya kasbi va uning barcha ota yo'nalishlari ("Kardiolog" → "Shifokorlar" → "Tibbiyot")
  if new.profession_node_id is not null then
    with recursive up as (
      select n.id, n.parent_id from public.profession_nodes n where n.id = new.profession_node_id
      union all
      select p.id, p.parent_id from public.profession_nodes p join up on p.id = up.parent_id
    ) select array_agg(up.id) into anc from up;
  end if;

  select coalesce(c.name, ep.display_name, trim(concat(pf.first_name, ' ', pf.last_name))),
         coalesce(c.verification_status = 'verified', false)
    into who, verified
  from public.profiles pf
  left join public.companies c on c.id = new.company_id
  left join public.employer_profiles ep on ep.profile_id = new.owner_profile_id
  where pf.id = new.owner_profile_id;
  select r.name_uz into region from public.regions r where r.id = new.region_id;

  for a in
    select al.* from public.ai_job_alerts al
    where al.is_active
      and (not paid_only or al.paid_until > now())
      and al.profile_id is distinct from new.owner_profile_id
      and (al.profession_node_id is null or al.profession_node_id = any(coalesce(anc, '{}')))
      and (al.category_id is null or al.category_id = new.category_id)
      and (al.region_id is null or al.region_id = new.region_id or new.is_remote)
      and (cardinality(al.district_ids) = 0 or new.district_id = any(al.district_ids) or new.is_remote)
      and (al.salary_min is null or new.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(new.salary_to, new.salary_from), new.salary_type) >= al.salary_min)
      and (cardinality(al.employment_types) = 0 or new.employment_type = any(al.employment_types))
      and (cardinality(al.schedules) = 0 or new.schedule = any(al.schedules))
      and (not al.is_remote or new.is_remote)
      and (not al.no_experience or new.experience_min_months = 0)
      and (al.q is null or al.q = '' or new.title ilike '%' || al.q || '%' or new.search_vector @@ plainto_tsquery('public.ishuz', al.q))
  loop
    insert into public.ai_job_alert_hits (alert_id, vacancy_id) values (a.id, new.id) on conflict do nothing;
    if found then
      update public.ai_job_alerts set hits_count = hits_count + 1, last_hit_at = now() where id = a.id;
      perform public.notify(a.profile_id, 'system', jsonb_build_object(
        'kind', 'ai_alert',
        'label', a.label,
        'title', new.title,
        'who', coalesce(who, ''),
        'verified', verified,
        'region', coalesce(region, ''),
        'salary_from', new.salary_from,
        'salary_to', new.salary_to,
        'negotiable', new.salary_negotiable
      ), '/jobs/' || new.slug);
    end if;
  end loop;
  return null;
end $$;
create or replace trigger trg_vacancy_ai_alerts after insert or update of status on public.vacancies
  for each row execute function public.trg_vacancy_ai_alerts();

revoke execute on function public.trg_ai_job_alerts_limit(), public.trg_vacancy_ai_alerts() from public, anon, authenticated;
