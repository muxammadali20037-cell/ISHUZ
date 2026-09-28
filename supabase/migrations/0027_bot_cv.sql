-- ISH.UZ · 0027 · Telegram bot ichida CV to'ldirish: suhbat holati + mos vakansiyalar.
-- Faqat server (service role) ishlatadi: jadval RLS yoqilgan, siyosatsiz — mijoz o'qiy/yoza olmaydi.

create table if not exists public.bot_sessions (
  telegram_user_id  bigint primary key,
  profile_id        uuid references public.profiles(id) on delete cascade,
  flow              text not null default 'cv' check (flow in ('cv')),
  step              text not null,
  data              jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);
alter table public.bot_sessions enable row level security;
revoke all on public.bot_sessions from anon, authenticated;
grant all on public.bot_sessions to service_role;

-- Ishchiga mos faol vakansiyalar (bot uchun): avval kasb bo'yicha, moslik bali bo'yicha saralangan.
-- auth.uid() ishlatilmaydi — worker_id aniq beriladi, shuning uchun faqat service role chaqira oladi.
create or replace function public.bot_matching_vacancies(p_worker_id uuid, p_limit int default 5, p_offset int default 0)
returns table (
  id uuid, slug text, title text, company_name text,
  salary_from int, salary_to int, salary_type public.salary_type, salary_negotiable boolean,
  region_name_uz text, region_name_ru text, district_name_uz text, district_name_ru text,
  is_remote boolean, score int, total bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  w public.worker_profiles;
begin
  select * into w from public.worker_profiles where worker_profiles.id = p_worker_id;
  if not found then return; end if;
  return query
  with base as (
    select v.*
    from public.vacancies v
    where v.status = 'active'
      and (w.category_id is null or v.category_id = w.category_id)
    order by (w.subcategory_id is not null and v.subcategory_id = w.subcategory_id) desc, v.published_at desc
    limit 200
  ),
  scored as (
    select b.*, coalesce(m.score, 0) as sc, count(*) over () as cnt
    from base b
    left join lateral (select * from public.compute_match(p_worker_id, b.id)) m on true
  )
  select s.id, s.slug, s.title, c.name, s.salary_from, s.salary_to, s.salary_type, s.salary_negotiable,
         rg.name_uz, rg.name_ru, d.name_uz, d.name_ru, s.is_remote, s.sc, s.cnt
  from scored s
  left join public.companies c on c.id = s.company_id
  left join public.regions rg on rg.id = s.region_id
  left join public.districts d on d.id = s.district_id
  order by s.sc desc, s.published_at desc
  limit greatest(1, least(p_limit, 10)) offset greatest(0, p_offset);
end $$;

revoke execute on function public.bot_matching_vacancies(uuid, int, int) from public, anon, authenticated;
grant execute on function public.bot_matching_vacancies(uuid, int, int) to service_role;

-- Eski (tugallanmagan) suhbatlar 30 kundan keyin tozalanadi
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ishuz-bot-sessions-cleanup';
    perform cron.schedule('ishuz-bot-sessions-cleanup', '41 3 * * *', $c$delete from public.bot_sessions where updated_at < now() - interval '30 days'$c$);
  end if;
end $$;
