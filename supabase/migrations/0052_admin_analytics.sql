-- ISH.UZ · 0052 · admin: MFA (aal2), tahlilchi roli, statistika hodisalari, AI ishlatilishi va xarajati.
--
--  * Admin huquqlari faqat ikki bosqichli kirish (TOTP, aal2) bilan ishlaydi — server va baza darajasida
--    (admin_mfa_required). Admin tugmasini yashirish himoya hisoblanmaydi.
--  * analyst — faqat agregat statistikani ko'radi (shaxsiy ma'lumotsiz).
--  * analytics_events — voronka hodisalari (shaxsiy ma'lumotsiz: profil id yoki tasodifiy anonim id).
--    "Qo'ng'iroq qilish" bosilishi suhbat yoki ishga joylashish deb hisoblanmaydi; ishga joylashish faqat
--    foydalanuvchi o'zi bildirgan natija ("Ish topdim" / "Ishchi topdim").
--  * ai_usage_log — har bir AI so'rovi: xususiyat, model, natija, kechikish, tokenlar (xarajatni o'lchash uchun).

insert into public.app_settings (key, value, is_public) values
  ('admin_mfa_required', 'true'::jsonb, false),
  ('ai_cost_per_mtok_in', '0.3'::jsonb, false),
  ('ai_cost_per_mtok_out', '2.5'::jsonb, false),
  ('ai_cost_per_image', '0.039'::jsonb, false)
on conflict (key) do nothing;

-- =====================================================================
-- 1. MFA: admin funksiyalari faqat aal2 sessiyada
-- =====================================================================
create or replace function public.admin_aal_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select not public.setting_bool('admin_mfa_required', true)
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.profile_id = auth.uid() and a.is_active)
     and public.admin_aal_ok();
$$;

create or replace function public.has_admin_permission(perm text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  a public.admin_users;
begin
  select * into a from public.admin_users where profile_id = auth.uid() and is_active;
  if not found then return false; end if;
  if not public.admin_aal_ok() then return false; end if;
  if a.role = 'super_admin' then return true; end if;
  if perm = any(a.permissions) then return true; end if;
  return case a.role
    when 'admin' then perm in (
      'users.view', 'users.block', 'users.contacts', 'workers.view', 'employers.view', 'employers.verify',
      'vacancies.view', 'vacancies.moderate', 'categories.manage', 'skills.manage', 'regions.manage',
      'reports.view', 'reports.resolve', 'reviews.moderate', 'chat.moderate', 'notifications.broadcast', 'analytics.view', 'audit.view')
    when 'moderator' then perm in (
      'users.view', 'workers.view', 'employers.view', 'vacancies.view', 'vacancies.moderate',
      'reports.view', 'reports.resolve', 'reviews.moderate', 'chat.moderate', 'analytics.view')
    when 'support' then perm in ('users.view', 'workers.view', 'employers.view', 'vacancies.view', 'reports.view', 'analytics.view')
    when 'analyst' then perm in ('analytics.view')
    else false
  end;
end $$;

-- Admin hisobi borligi (MFA'dan oldin ham) — faqat o'zi uchun: MFA sahifasiga yo'naltirish uchun
create or replace function public.my_admin_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'is_staff', exists (select 1 from public.admin_users a where a.profile_id = auth.uid() and a.is_active),
    'role', (select a.role from public.admin_users a where a.profile_id = auth.uid() and a.is_active),
    'aal_ok', public.admin_aal_ok(),
    'mfa_required', public.setting_bool('admin_mfa_required', true));
$$;

-- =====================================================================
-- 2. Hodisalar (voronka) va AI ishlatilishi
-- =====================================================================
create table if not exists public.analytics_events (
  id          bigserial primary key,
  name        text not null check (name ~ '^[a-z][a-z0-9_]{1,40}$'),
  profile_id  uuid references public.profiles(id) on delete set null,
  anon_id     text check (anon_id is null or anon_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

create table if not exists public.ai_usage_log (
  id             bigserial primary key,
  feature        text not null,
  provider       text not null,
  model          text,
  ok             boolean not null,
  latency_ms     int,
  input_tokens   int,
  output_tokens  int,
  images         int not null default 0,
  error          text,
  created_at     timestamptz not null default now()
);
create index if not exists ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
alter table public.ai_usage_log enable row level security;
revoke all on public.ai_usage_log from anon, authenticated;

create or replace function public.purge_analytics()
returns void language sql security definer set search_path = public as $$
  delete from public.analytics_events where created_at < now() - interval '400 days';
  delete from public.ai_usage_log where created_at < now() - interval '400 days';
$$;
revoke execute on function public.purge_analytics() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ishuz-purge-analytics', '37 3 * * 0', $job$select public.purge_analytics();$job$);
  end if;
end $$;

-- =====================================================================
-- 3. Statistika (faqat haqiqiy ma'lumotdan, agregat; Toshkent vaqti)
-- =====================================================================
create or replace function public.admin_stats_v2(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  res jsonb;
  cin numeric := coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'ai_cost_per_mtok_in'), 0);
  cout numeric := coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'ai_cost_per_mtok_out'), 0);
  cimg numeric := coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'ai_cost_per_image'), 0);
begin
  if not public.has_admin_permission('analytics.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
    'workers_active', (select count(*) from public.worker_profiles where is_public),
    'employers_active', (select count(distinct owner_profile_id) from public.vacancies where status = 'active'),
    'vacancies_active', (select count(*) from public.vacancies where status = 'active'),
    'employers_pending', (select count(*) from public.employer_profiles where verification_status = 'pending'),
    'employers_verified', (select count(*) from public.employer_profiles where verification_status = 'verified'),
    'moderation_pending', (select count(*) from public.vacancies where moderation_state = 'pending' and status in ('pending_review', 'draft') and moderation_requested_at is not null)
                        + (select count(*) from public.worker_profiles where moderation_state = 'pending' and publish_requested),
    'moderation_review', (select count(*) from public.vacancies where moderation_state = 'review')
                       + (select count(*) from public.worker_profiles where moderation_state = 'review'),
    'published', (select count(distinct (entity_type, entity_id)) from public.moderation_checks
                  where decision = 'allow' and created_at >= p_from and created_at < p_to),
    'rejected', (select count(distinct (entity_type, entity_id)) from public.moderation_checks
                 where decision = 'reject' and created_at >= p_from and created_at < p_to),
    'rejected_by_category', (select coalesce(jsonb_object_agg(category, n), '{}'::jsonb) from (
        select coalesce(category, 'uncertain') as category, count(*) as n from public.moderation_checks
        where decision = 'reject' and created_at >= p_from and created_at < p_to group by 1) s),
    'closed_found_job', (select count(*) from public.analytics_events where name = 'outcome_found_job' and created_at >= p_from and created_at < p_to),
    'closed_found_worker', (select count(*) from public.analytics_events where name = 'outcome_found_worker' and created_at >= p_from and created_at < p_to),
    'matches_90', (select count(*) from public.match_notifications where created_at >= p_from and created_at < p_to),
    'matches_90_cache', (select count(*) from public.matches where score >= public.setting_int('match_notify_threshold', 90) and not hard_fail and complete),
    'subscriptions', jsonb_build_object(
      'worker', (select count(*) from public.match_subscriptions where role = 'worker' and enabled and telegram_confirmed_at is not null),
      'employer', (select count(*) from public.match_subscriptions where role = 'employer' and enabled and telegram_confirmed_at is not null),
      'waiting_bot', (select count(*) from public.match_subscriptions where enabled and telegram_confirmed_at is null)),
    'telegram', jsonb_build_object(
      'sent', (select count(*) from public.notifications where tg_status = 'sent' and telegram_sent_at >= p_from and telegram_sent_at < p_to),
      'failed', (select count(*) from public.notifications where tg_status in ('failed', 'dead') and created_at >= p_from and created_at < p_to),
      'queued', (select count(*) from public.notifications where tg_status = 'queued'),
      'opened', (select count(*) from public.notifications where opened_at >= p_from and opened_at < p_to)),
    'ai_listings', jsonb_build_object(
      'started', (select count(*) from public.analytics_events where name = 'ai_draft_started' and created_at >= p_from and created_at < p_to),
      'prepared', (select count(*) from public.analytics_events where name = 'ai_draft_prepared' and created_at >= p_from and created_at < p_to),
      'published', (select count(*) from public.analytics_events where name = 'post_publish' and props ->> 'source' = 'ai' and created_at >= p_from and created_at < p_to)),
    'ai_usage', (select jsonb_build_object(
        'requests', count(*),
        'errors', count(*) filter (where not ok),
        'avg_latency_ms', coalesce(round(avg(latency_ms))::int, 0),
        'p95_latency_ms', coalesce((percentile_cont(0.95) within group (order by latency_ms))::int, 0),
        'input_tokens', coalesce(sum(input_tokens), 0),
        'output_tokens', coalesce(sum(output_tokens), 0),
        'images', coalesce(sum(images), 0),
        'cost_usd', round(coalesce(sum(input_tokens), 0) / 1e6 * cin + coalesce(sum(output_tokens), 0) / 1e6 * cout + coalesce(sum(images), 0) * cimg, 2),
        'by_feature', (select coalesce(jsonb_object_agg(feature, n), '{}'::jsonb) from (
            select feature, count(*) as n from public.ai_usage_log where created_at >= p_from and created_at < p_to group by 1) f))
      from public.ai_usage_log where created_at >= p_from and created_at < p_to),
    'top_professions', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select n.id, n.name_uz, n.name_ru, count(*) as searches,
               count(*) filter (where l.results_count = 0) as zero
        from public.search_logs l join public.profession_nodes n on n.id = (l.understood ->> 'node')::uuid
        where l.created_at >= p_from and l.created_at < p_to and l.understood ? 'node'
        group by n.id order by count(*) desc limit 15) x),
    'zero_queries', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select query_norm as query, count(*) as n from public.search_logs
        where results_count = 0 and created_at >= p_from and created_at < p_to and query_norm <> ''
        group by 1 order by 2 desc limit 15) x),
    'searches', (select count(*) from public.search_logs where created_at >= p_from and created_at < p_to),
    'searches_zero', (select count(*) from public.search_logs where results_count = 0 and created_at >= p_from and created_at < p_to),
    'regions', (select coalesce(jsonb_agg(x order by x.demand desc), '[]'::jsonb) from (
        select r.id, r.name_uz, r.name_ru,
          (select count(*) from public.search_logs l where (l.understood ->> 'region') = r.id::text and l.created_at >= p_from and l.created_at < p_to) as demand,
          (select count(*) from public.vacancies v where v.region_id = r.id and v.status = 'active') as vacancies,
          (select count(*) from public.worker_profiles w where w.region_id = r.id and w.is_public) as workers
        from public.regions r) x),
    'funnel', (select coalesce(jsonb_object_agg(step, n), '{}'::jsonb) from (
        select name as step, count(distinct coalesce(profile_id::text, anon_id, id::text)) as n
        from public.analytics_events
        where created_at >= p_from and created_at < p_to
          and name in ('home_view', 'direction_select', 'post_start', 'post_review', 'post_publish', 'contact_click', 'outcome_report')
        group by name) f)
  ) into res;
  return res;
end $$;

-- Kunlik qatorlar (grafik va CSV uchun), kun Toshkent vaqtida
create or replace function public.admin_stats_series(p_from timestamptz, p_to timestamptz)
returns table (day date, users_new bigint, published bigint, rejected bigint, searches bigint, searches_zero bigint,
               contact_clicks bigint, tg_sent bigint, tg_failed bigint, ai_requests bigint, outcomes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_permission('analytics.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  return query
  with days as (
    select generate_series((p_from at time zone 'Asia/Tashkent')::date, ((p_to - interval '1 second') at time zone 'Asia/Tashkent')::date, interval '1 day')::date as d
  )
  select d,
    (select count(*) from public.profiles x where (x.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(distinct (c.entity_type, c.entity_id)) from public.moderation_checks c where c.decision = 'allow' and (c.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(distinct (c.entity_type, c.entity_id)) from public.moderation_checks c where c.decision = 'reject' and (c.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.search_logs l where (l.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.search_logs l where l.results_count = 0 and (l.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.analytics_events e where e.name = 'contact_click' and (e.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.notifications n where n.tg_status = 'sent' and (n.telegram_sent_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.notifications n where n.tg_status in ('failed', 'dead') and (n.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.ai_usage_log a where (a.created_at at time zone 'Asia/Tashkent')::date = d),
    (select count(*) from public.analytics_events e where e.name in ('outcome_found_job', 'outcome_found_worker') and (e.created_at at time zone 'Asia/Tashkent')::date = d)
  from days order by d;
end $$;

-- Navbatlar holati (monitoring)
create or replace function public.admin_queue_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_permission('audit.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'moderation', jsonb_build_object(
      'pending', (select count(*) from public.vacancies where moderation_state = 'pending' and (status = 'pending_review' or (status = 'draft' and moderation_requested_at is not null)))
               + (select count(*) from public.worker_profiles where moderation_state = 'pending' and publish_requested and onboarding_completed_at is not null),
      'retrying', (select count(*) from public.vacancies where moderation_state = 'pending' and moderation_attempts > 0)
                + (select count(*) from public.worker_profiles where moderation_state = 'pending' and moderation_attempts > 0),
      'oldest', least((select min(moderation_requested_at) from public.vacancies where moderation_state = 'pending' and moderation_requested_at is not null),
                      (select min(updated_at) from public.worker_profiles where moderation_state = 'pending' and publish_requested)),
      'review', (select count(*) from public.vacancies where moderation_state = 'review') + (select count(*) from public.worker_profiles where moderation_state = 'review'),
      'errors_24h', (select count(*) from public.moderation_checks where decision = 'error' and created_at > now() - interval '1 day'),
      'last_errors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select entity_type, created_at, error from public.moderation_checks
                      where decision = 'error' order by created_at desc limit 10) x)),
    'match_jobs', jsonb_build_object(
      'queued', (select count(*) from public.match_jobs where status = 'queued'),
      'running', (select count(*) from public.match_jobs where status = 'running'),
      'failed', (select count(*) from public.match_jobs where status = 'failed'),
      'done_24h', (select count(*) from public.match_jobs where status = 'done' and finished_at > now() - interval '1 day'),
      'last_errors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select id, entity_type, created_at, last_error from public.match_jobs
                      where last_error is not null order by created_at desc limit 10) x)),
    'telegram', jsonb_build_object(
      'queued', (select count(*) from public.notifications where tg_status = 'queued'),
      'due', (select count(*) from public.notifications where tg_status = 'queued' and tg_next_at <= now()),
      'retrying', (select count(*) from public.notifications where tg_status = 'queued' and tg_attempts > 0),
      'failed_24h', (select count(*) from public.notifications where tg_status in ('failed', 'dead') and created_at > now() - interval '1 day'),
      'sent_24h', (select count(*) from public.notifications where tg_status = 'sent' and telegram_sent_at > now() - interval '1 day'),
      'last_errors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select id, type, created_at, tg_status, tg_error from public.notifications
                      where tg_error is not null order by created_at desc limit 10) x)),
    'ai_24h', (select jsonb_build_object('requests', count(*), 'errors', count(*) filter (where not ok)) from public.ai_usage_log where created_at > now() - interval '1 day'));
end $$;

-- Navbatni qayta urinish (monitoring tugmasi)
create or replace function public.admin_retry_queue(p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not public.has_admin_permission('settings.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_kind = 'match_jobs' then
    update public.match_jobs set status = 'queued', attempts = 0, last_error = null where status = 'failed';
    get diagnostics n = row_count;
  elsif p_kind = 'telegram' then
    update public.notifications set tg_status = 'queued', tg_attempts = 0, tg_next_at = now(), tg_error = null
    where tg_status = 'failed' and created_at > now() - interval '3 days';
    get diagnostics n = row_count;
  elsif p_kind = 'moderation' then
    perform set_config('ishuz.moderation_internal', '1', true);
    update public.vacancies set moderation_next_at = null, moderation_attempts = 0 where moderation_state = 'pending' and moderation_attempts > 0;
    get diagnostics n = row_count;
    update public.worker_profiles set moderation_next_at = null, moderation_attempts = 0 where moderation_state = 'pending' and moderation_attempts > 0;
    perform set_config('ishuz.moderation_internal', '', true);
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  perform public.write_audit('queue.retry', 'queue', p_kind, null, jsonb_build_object('count', n));
  return n;
end $$;

revoke execute on function public.admin_stats_v2(timestamptz, timestamptz), public.admin_stats_series(timestamptz, timestamptz),
  public.admin_queue_status(), public.admin_retry_queue(text), public.my_admin_status() from public, anon;
grant execute on function public.admin_stats_v2(timestamptz, timestamptz), public.admin_stats_series(timestamptz, timestamptz),
  public.admin_queue_status(), public.admin_retry_queue(text), public.my_admin_status() to authenticated;
grant execute on function public.admin_aal_ok() to authenticated;
