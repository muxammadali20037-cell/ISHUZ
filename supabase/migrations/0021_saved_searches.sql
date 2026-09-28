-- ISH.UZ · 0021 · saqlangan qidiruvlar + kunlik xabar ("Chilonzorda sizga mos 3 ta yangi ish chiqdi")
-- Filtrlar tuzilgan ustunlarda saqlanadi (JSON emas): cron ularni to'g'ridan-to'g'ri vakansiyalarga solishtiradi.

create table if not exists public.saved_searches (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  label            text not null check (length(trim(label)) between 1 and 160),
  -- /jobs?<query_string> — qidiruvni qayta ochish uchun
  query_string     text not null check (length(query_string) <= 2000),
  q                text check (q is null or length(q) <= 120),
  category_id      uuid references public.categories(id) on delete cascade,
  subcategory_id   uuid references public.subcategories(id) on delete set null,
  region_id        uuid references public.regions(id) on delete set null,
  district_ids     uuid[] not null default '{}' check (cardinality(district_ids) <= 30),
  salary_min       int check (salary_min is null or salary_min > 0),
  employment_types public.employment_type[] not null default '{}',
  schedules        public.work_schedule[] not null default '{}',
  is_remote        boolean not null default false,
  no_experience    boolean not null default false,
  notify           boolean not null default true,
  last_checked_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (profile_id, query_string)
);
create index if not exists idx_saved_searches_profile on public.saved_searches (profile_id, created_at desc);
create index if not exists idx_saved_searches_notify on public.saved_searches (last_checked_at) where notify;

alter table public.saved_searches enable row level security;
drop policy if exists "saved_searches_own" on public.saved_searches;
create policy "saved_searches_own" on public.saved_searches for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_active_user());
grant select, insert, update, delete on public.saved_searches to authenticated;

-- Foydalanuvchi boshiga 20 ta — spam va og'ir cron'dan himoya
create or replace function public.trg_saved_searches_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_searches where profile_id = new.profile_id) >= 20 then
    raise exception 'saved_search_limit' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_saved_searches_limit on public.saved_searches;
create trigger trg_saved_searches_limit before insert on public.saved_searches for each row execute function public.trg_saved_searches_limit();

-- Saqlangan qidiruvga mos faol vakansiyalar (p_since dan keyin e'lon qilinganlari)
create or replace function public.saved_search_new_count(p_search_id uuid, p_since timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.saved_searches s
  join public.vacancies v on v.status = 'active' and v.published_at > p_since
  left join public.companies c on c.id = v.company_id
  where s.id = p_search_id
    and (s.category_id is null or v.category_id = s.category_id)
    and (s.subcategory_id is null or v.subcategory_id = s.subcategory_id)
    and (s.region_id is null or v.region_id = s.region_id or v.is_remote)
    and (cardinality(s.district_ids) = 0 or v.district_id = any(s.district_ids) or v.is_remote)
    and (s.salary_min is null or v.salary_negotiable or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) >= s.salary_min)
    and (cardinality(s.employment_types) = 0 or v.employment_type = any(s.employment_types))
    and (cardinality(s.schedules) = 0 or v.schedule = any(s.schedules))
    and (not s.is_remote or v.is_remote)
    and (not s.no_experience or v.experience_min_months = 0)
    and (s.q is null or s.q = '' or v.search_vector @@ plainto_tsquery('public.ishuz', s.q) or v.title ilike '%' || s.q || '%' or c.name ilike '%' || s.q || '%')
    and (v.owner_profile_id is distinct from s.profile_id);
$$;

-- Foydalanuvchi o'z saqlangan qidiruvlari uchun: oxirgi ko'rishdan beri nechta yangi
create or replace function public.my_saved_searches()
returns table (id uuid, label text, query_string text, notify boolean, new_count int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.label, s.query_string, s.notify, public.saved_search_new_count(s.id, s.last_checked_at), s.created_at
  from public.saved_searches s
  where s.profile_id = auth.uid()
  order by s.created_at desc;
$$;

-- Qidiruv ochildi → "yangi" hisoblagichi nolga tushadi
create or replace function public.mark_saved_search_seen(p_search_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.saved_searches set last_checked_at = now() where id = p_search_id and profile_id = auth.uid();
$$;

-- Kunlik xabar: har bir saqlangan qidiruv bo'yicha oxirgi tekshiruvdan beri yangi vakansiyalar bo'lsa — bitta bildirishnoma
create or replace function public.run_saved_search_alerts()
returns int language plpgsql security definer set search_path = public as $$
declare
  s record;
  n int;
  sent int := 0;
begin
  for s in select * from public.saved_searches where notify and last_checked_at < now() - interval '20 hours' order by last_checked_at limit 5000 loop
    n := public.saved_search_new_count(s.id, s.last_checked_at);
    if n > 0 then
      perform public.notify(s.profile_id, 'system', jsonb_build_object('kind', 'saved_search', 'label', s.label, 'count', n), '/jobs?' || s.query_string);
      sent := sent + 1;
    end if;
    update public.saved_searches set last_checked_at = now() where id = s.id;
  end loop;
  return sent;
end $$;

revoke execute on function public.trg_saved_searches_limit(), public.saved_search_new_count(uuid, timestamptz), public.run_saved_search_alerts(),
  public.my_saved_searches(), public.mark_saved_search_seen(uuid) from public, anon, authenticated;
grant execute on function public.my_saved_searches(), public.mark_saved_search_seen(uuid) to authenticated;
grant execute on function public.run_saved_search_alerts(), public.saved_search_new_count(uuid, timestamptz) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ishuz-saved-search-alerts';
    -- Toshkent 09:05 (UTC 04:05)
    perform cron.schedule('ishuz-saved-search-alerts', '5 4 * * *', 'select public.run_saved_search_alerts()');
  end if;
end $$;
