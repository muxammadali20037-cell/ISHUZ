-- ISH.UZ · 0051 · ikki tomonlama moslashtirish + Telegram xabarnomalariga obuna + ishonchli yuborish (outbox).
--
--  * match_subscriptions — "Menga mos ish/ishchi chiqsa xabar bering" roziligi (rol bo'yicha alohida; pullik xizmat emas).
--    Faqat Telegram hisobi bog'langan va bot yozishi tasdiqlangan (telegram_confirmed_at) bo'lsa yuboriladi.
--  * telegram_link_tokens — /start uchun bir martalik, 15 daqiqalik token (faqat xeshi saqlanadi).
--  * match_jobs — nashr / muhim yangilanish hodisasi navbati (takroriy hodisa bitta ish bo'lib qoladi).
--  * match_notifications — juftlik bo'yicha yuborilgan tavsiyalar daftari: bir juftlik haqida bir marta.
--  * notifications — mavjud bildirishnomalar jadvali endi outbox: tg_status, urinishlar, keyingi urinish, xato,
--    dedupe_key, open_token (kuzatiladigan havola) va opened_at. Yangi parallel tizim yaratilmadi.

-- =====================================================================
-- 1. Sozlamalar
-- =====================================================================
insert into public.app_settings (key, value, is_public) values
  ('match_notify_daily_limit', '10'::jsonb, false),
  ('match_notify_batch', '5'::jsonb, false)
on conflict (key) do nothing;

-- =====================================================================
-- 2. Outbox ustunlari (mavjud notifications jadvali)
-- =====================================================================
alter table public.notifications
  add column if not exists tg_status text not null default 'queued',
  add column if not exists tg_attempts int not null default 0,
  add column if not exists tg_next_at timestamptz not null default now(),
  add column if not exists tg_error text,
  add column if not exists dedupe_key text,
  add column if not exists open_token uuid not null default gen_random_uuid(),
  add column if not exists opened_at timestamptz;
do $$ begin
  alter table public.notifications add constraint notifications_tg_status_check
    check (tg_status in ('none', 'queued', 'sent', 'skipped', 'failed', 'dead'));
exception when duplicate_object then null; end $$;
update public.notifications set tg_status = case
  when telegram_sent_at is not null then 'sent'
  when created_at < now() - interval '2 days' then 'skipped'
  else 'queued' end
where tg_status = 'queued';
create unique index if not exists notifications_dedupe_uq on public.notifications (dedupe_key) where dedupe_key is not null;
create unique index if not exists notifications_open_token_uq on public.notifications (open_token);
create index if not exists notifications_tg_queue_idx on public.notifications (tg_next_at) where tg_status = 'queued';

-- Telegram: bot yozishi tasdiqlangan vaqt (muvaffaqiyatli yetkazilgan xabar)
alter table public.telegram_accounts add column if not exists chat_verified_at timestamptz;

-- =====================================================================
-- 3. Obunalar
-- =====================================================================
create table if not exists public.match_subscriptions (
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  role                  text not null check (role in ('worker', 'employer')),
  enabled               boolean not null default false,
  mode                  text not null default 'instant' check (mode in ('instant', 'digest')),
  profession_node_id    uuid references public.profession_nodes(id) on delete set null,
  region_id             uuid references public.regions(id) on delete set null,
  salary_min            int check (salary_min is null or salary_min between 0 and 1000000000),
  schedules             public.work_schedule[] not null default '{}',
  vacancy_ids           uuid[] not null default '{}',
  telegram_confirmed_at timestamptz,
  paused_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (profile_id, role)
);
alter table public.match_subscriptions enable row level security;
drop policy if exists "match_subscriptions_own" on public.match_subscriptions;
create policy "match_subscriptions_own" on public.match_subscriptions for select to authenticated
  using (profile_id = auth.uid() or public.has_admin_permission('analytics.view'));
revoke insert, update, delete on public.match_subscriptions from anon, authenticated;
grant select on public.match_subscriptions to authenticated;

create or replace function public.set_match_subscription(
  p_role text, p_enabled boolean, p_mode text default 'instant', p_profession_node_id uuid default null,
  p_region_id uuid default null, p_salary_min int default null, p_schedules public.work_schedule[] default '{}',
  p_vacancy_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.match_subscriptions;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_role not in ('worker', 'employer') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if coalesce(p_mode, 'instant') not in ('instant', 'digest') then raise exception 'invalid_mode' using errcode = '22023'; end if;
  if p_salary_min is not null and (p_salary_min < 0 or p_salary_min > 1000000000) then raise exception 'invalid_salary' using errcode = '22023'; end if;
  if not public.check_rate_limit('subscription:' || me, 60, 3600) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if cardinality(coalesce(p_vacancy_ids, '{}')) > 0 and exists (
      select 1 from unnest(p_vacancy_ids) x where not public.manages_vacancy(x)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.match_subscriptions as m (profile_id, role, enabled, mode, profession_node_id, region_id, salary_min, schedules, vacancy_ids)
  values (me, p_role, coalesce(p_enabled, false), coalesce(p_mode, 'instant'), p_profession_node_id, p_region_id, p_salary_min,
          coalesce(p_schedules, '{}'), coalesce(p_vacancy_ids, '{}'))
  on conflict (profile_id, role) do update set
    enabled = excluded.enabled, mode = excluded.mode, profession_node_id = excluded.profession_node_id,
    region_id = excluded.region_id, salary_min = excluded.salary_min, schedules = excluded.schedules,
    vacancy_ids = excluded.vacancy_ids, updated_at = now(),
    paused_reason = case when excluded.enabled then null else m.paused_reason end
  returning * into s;
  -- o'chirilgan obuna bo'yicha navbatdagi Telegram xabarlari to'xtaydi
  if not s.enabled then
    update public.notifications set tg_status = 'skipped', tg_error = 'unsubscribed'
    where profile_id = me and tg_status = 'queued'
      and type = (case when p_role = 'worker' then 'new_matching_vacancy' else 'new_matching_worker' end)::public.notification_type;
  end if;
  return to_jsonb(s);
end $$;

-- Server: bot birinchi xabarni yetkazgach obuna faollashadi
create or replace function public.confirm_match_subscription(p_profile_id uuid, p_role text)
returns void language sql security definer set search_path = public as $$
  update public.match_subscriptions set telegram_confirmed_at = now(), paused_reason = null, updated_at = now()
  where profile_id = p_profile_id and (coalesce(p_role, '') = '' or role = p_role) and enabled;
  update public.telegram_accounts set chat_verified_at = now(), bot_started = true where profile_id = p_profile_id;
$$;

-- Server: bot bloklangan — cheksiz urinish yo'q, obunalar to'xtatiladi
create or replace function public.telegram_blocked(p_profile_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.telegram_accounts set bot_started = false, chat_verified_at = null where profile_id = p_profile_id;
  update public.match_subscriptions set telegram_confirmed_at = null, paused_reason = 'bot_blocked', updated_at = now()
  where profile_id = p_profile_id;
  update public.notifications set tg_status = 'dead', tg_error = 'bot_blocked'
  where profile_id = p_profile_id and tg_status = 'queued';
$$;

-- =====================================================================
-- 4. Telegramni xavfsiz bog'lash: bir martalik, muddati cheklangan token
-- =====================================================================
create table if not exists public.telegram_link_tokens (
  token_hash  text primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text check (role in ('worker', 'employer')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     bigint,
  created_at  timestamptz not null default now()
);
create index if not exists telegram_link_tokens_profile_idx on public.telegram_link_tokens (profile_id, created_at desc);
alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_link_tokens from anon, authenticated;

create or replace function public.create_telegram_link_token(p_token_hash text, p_role text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); exp timestamptz := now() + interval '15 minutes';
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_token' using errcode = '22023'; end if;
  if p_role is not null and p_role not in ('worker', 'employer') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if not public.check_rate_limit('tglink:' || me, 10, 3600) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  delete from public.telegram_link_tokens where profile_id = me and (used_at is not null or expires_at < now());
  insert into public.telegram_link_tokens (token_hash, profile_id, role, expires_at) values (p_token_hash, me, p_role, exp);
  return exp;
end $$;

-- Bot /start <token>: chat_id tekshirilgan holda hisobga bog'lanadi (username orqali emas)
create or replace function public.consume_telegram_link_token(
  p_token_hash text, p_telegram_user_id bigint, p_username text default null, p_first_name text default null,
  p_last_name text default null, p_language text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.telegram_link_tokens;
  other uuid;
begin
  select * into t from public.telegram_link_tokens where token_hash = p_token_hash for update;
  if t.token_hash is null then return jsonb_build_object('status', 'invalid'); end if;
  if t.used_at is not null then return jsonb_build_object('status', 'used'); end if;
  if t.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  select profile_id into other from public.telegram_accounts where telegram_user_id = p_telegram_user_id;
  if other is not null and other <> t.profile_id then
    -- bu Telegram boshqa hisobga bog'langan: o'zboshimchalik bilan ko'chirilmaydi
    update public.telegram_link_tokens set used_at = now(), used_by = p_telegram_user_id where token_hash = p_token_hash;
    return jsonb_build_object('status', 'linked_elsewhere');
  end if;
  update public.telegram_link_tokens set used_at = now(), used_by = p_telegram_user_id where token_hash = p_token_hash;
  -- hisob boshqa Telegramga bog'langan bo'lsa — egasi o'zi (kirgan holda) yangisiga almashtirdi
  delete from public.telegram_accounts where profile_id = t.profile_id and telegram_user_id <> p_telegram_user_id;
  insert into public.telegram_accounts (telegram_user_id, profile_id, username, first_name, last_name, language_code, bot_started, linked_at, last_seen_at)
  values (p_telegram_user_id, t.profile_id, p_username, p_first_name, p_last_name, p_language, true, now(), now())
  on conflict (telegram_user_id) do update set
    username = excluded.username, first_name = excluded.first_name, last_name = excluded.last_name,
    language_code = coalesce(excluded.language_code, public.telegram_accounts.language_code),
    bot_started = true, last_seen_at = now();
  return jsonb_build_object('status', 'linked', 'profile_id', t.profile_id, 'role', t.role);
end $$;

-- =====================================================================
-- 5. Moslik hodisalari navbati
-- =====================================================================
create table if not exists public.match_jobs (
  id           bigserial primary key,
  entity_type  text not null check (entity_type in ('vacancy', 'worker')),
  entity_id    uuid not null,
  reason       text not null default 'published' check (reason in ('published', 'updated')),
  status       text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts     int not null default 0,
  last_error   text,
  result       jsonb,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create unique index if not exists match_jobs_queued_uq on public.match_jobs (entity_type, entity_id) where status = 'queued';
create index if not exists match_jobs_status_idx on public.match_jobs (status, created_at);
alter table public.match_jobs enable row level security;
drop policy if exists "match_jobs_admin" on public.match_jobs;
create policy "match_jobs_admin" on public.match_jobs for select to authenticated using (public.has_admin_permission('audit.view'));
revoke insert, update, delete on public.match_jobs from anon, authenticated;
grant select on public.match_jobs to authenticated;

create or replace function public.enqueue_match_job(p_entity text, p_id uuid, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into public.match_jobs (entity_type, entity_id, reason) values (p_entity, p_id, p_reason)
  on conflict (entity_type, entity_id) where status = 'queued' do nothing;
$$;

create or replace function public.trg_vacancy_match_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform public.enqueue_match_job('vacancy', new.id, 'published');
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status = 'active'
     and (new.profession_node_id, new.category_id, new.region_id, new.district_id, new.is_remote, new.salary_from, new.salary_to,
          new.salary_type, new.salary_negotiable, new.schedule, new.employment_type, new.work_format, new.experience_min_months)
       is distinct from
         (old.profession_node_id, old.category_id, old.region_id, old.district_id, old.is_remote, old.salary_from, old.salary_to,
          old.salary_type, old.salary_negotiable, old.schedule, old.employment_type, old.work_format, old.experience_min_months) then
    perform public.enqueue_match_job('vacancy', new.id, 'updated');
  end if;
  return null;
end $$;
drop trigger if exists trg_vacancy_match_job on public.vacancies;
create trigger trg_vacancy_match_job after insert or update on public.vacancies
  for each row execute function public.trg_vacancy_match_job();

create or replace function public.trg_worker_match_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_public and (tg_op = 'INSERT' or not old.is_public) then
    perform public.enqueue_match_job('worker', new.id, 'published');
  elsif tg_op = 'UPDATE' and new.is_public and old.is_public
     and (new.profession_node_id, new.category_id, new.subcategory_id, new.region_id, new.district_id, new.remote_preference,
          new.experience_level, new.work_format)
       is distinct from
         (old.profession_node_id, old.category_id, old.subcategory_id, old.region_id, old.district_id, old.remote_preference,
          old.experience_level, old.work_format) then
    perform public.enqueue_match_job('worker', new.id, 'updated');
  end if;
  return null;
end $$;
drop trigger if exists trg_worker_match_job on public.worker_profiles;
create trigger trg_worker_match_job after insert or update on public.worker_profiles
  for each row execute function public.trg_worker_match_job();

-- Ishchi tafsilotlari (maosh, jadval, ko'nikma, til, hudud) — ochiq e'lon bo'lsa qayta hisoblash
create or replace function public.trg_worker_detail_match_job()
returns trigger language plpgsql security definer set search_path = public as $$
declare wid uuid := coalesce(new.worker_id, old.worker_id);
begin
  if exists (select 1 from public.worker_profiles w where w.id = wid and w.is_public) then
    perform public.enqueue_match_job('worker', wid, 'updated');
  end if;
  return null;
end $$;
drop trigger if exists trg_worker_preferences_match_job on public.worker_preferences;
create trigger trg_worker_preferences_match_job after insert or update on public.worker_preferences
  for each row execute function public.trg_worker_detail_match_job();
drop trigger if exists trg_worker_skills_match_job on public.worker_skills;
create trigger trg_worker_skills_match_job after insert or delete on public.worker_skills
  for each row execute function public.trg_worker_detail_match_job();
drop trigger if exists trg_worker_languages_match_job on public.worker_languages;
create trigger trg_worker_languages_match_job after insert or delete on public.worker_languages
  for each row execute function public.trg_worker_detail_match_job();
drop trigger if exists trg_worker_locations_match_job on public.worker_locations;
create trigger trg_worker_locations_match_job after insert or delete on public.worker_locations
  for each row execute function public.trg_worker_detail_match_job();

create or replace function public.trg_vacancy_detail_match_job()
returns trigger language plpgsql security definer set search_path = public as $$
declare vid uuid := coalesce(new.vacancy_id, old.vacancy_id);
begin
  if exists (select 1 from public.vacancies v where v.id = vid and v.status = 'active') then
    perform public.enqueue_match_job('vacancy', vid, 'updated');
  end if;
  return null;
end $$;
drop trigger if exists trg_vacancy_skills_match_job on public.vacancy_skills;
create trigger trg_vacancy_skills_match_job after insert or delete on public.vacancy_skills
  for each row execute function public.trg_vacancy_detail_match_job();
drop trigger if exists trg_vacancy_languages_match_job on public.vacancy_languages;
create trigger trg_vacancy_languages_match_job after insert or delete on public.vacancy_languages
  for each row execute function public.trg_vacancy_detail_match_job();

-- =====================================================================
-- 6. Yuborilgan tavsiyalar daftari (dublikatdan himoya)
-- =====================================================================
create table if not exists public.match_notifications (
  worker_id        uuid not null references public.worker_profiles(id) on delete cascade,
  vacancy_id       uuid not null references public.vacancies(id) on delete cascade,
  side             text not null check (side in ('worker', 'employer')),
  recipient_id     uuid not null references public.profiles(id) on delete cascade,
  score            int not null,
  rules_version    int not null,
  notification_id  bigint,
  created_at       timestamptz not null default now(),
  primary key (worker_id, vacancy_id, side)
);
create index if not exists match_notifications_created_idx on public.match_notifications (created_at desc);
alter table public.match_notifications enable row level security;
drop policy if exists "match_notifications_admin" on public.match_notifications;
create policy "match_notifications_admin" on public.match_notifications for select to authenticated
  using (recipient_id = auth.uid() or public.has_admin_permission('analytics.view'));
revoke insert, update, delete on public.match_notifications from anon, authenticated;
grant select on public.match_notifications to authenticated;

-- Telegram holati: obuna + filtrlar + kunlik limit + darhol / kunlik jamlanma
create or replace function public.match_tg_plan(p_profile_id uuid, p_role text, p_vacancy_id uuid)
returns table (o_status text, o_next_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.match_subscriptions;
  v public.vacancies;
  lim int := public.setting_int('match_notify_daily_limit', 10);
  sent int;
  local_now timestamp := (now() at time zone 'Asia/Tashkent');
begin
  o_status := 'none'; o_next_at := now();
  select * into s from public.match_subscriptions where profile_id = p_profile_id and role = p_role;
  if s.profile_id is null or not s.enabled or s.telegram_confirmed_at is null then return next; return; end if;
  if not exists (select 1 from public.telegram_accounts t where t.profile_id = p_profile_id and t.bot_started) then return next; return; end if;
  select * into v from public.vacancies where id = p_vacancy_id;
  if p_role = 'worker' then
    if s.profession_node_id is not null and not (v.profession_node_id = any(coalesce(public.profession_subtree(s.profession_node_id), '{}'))) then
      return next; return;
    end if;
    if s.region_id is not null and not (v.is_remote or v.region_id = s.region_id) then return next; return; end if;
    if s.salary_min is not null and (v.salary_negotiable or coalesce(v.salary_to, v.salary_from) is null
        or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) < s.salary_min) then
      return next; return;
    end if;
    if cardinality(s.schedules) > 0 and not (v.schedule = any(s.schedules)) then return next; return; end if;
  else
    if cardinality(s.vacancy_ids) > 0 and not (p_vacancy_id = any(s.vacancy_ids)) then return next; return; end if;
  end if;
  select count(*) into sent from public.notifications n
  where n.profile_id = p_profile_id and n.type in ('new_matching_vacancy', 'new_matching_worker')
    and n.tg_status in ('queued', 'sent') and n.created_at > now() - interval '1 day';
  if sent >= lim then o_status := 'skipped'; return next; return; end if;
  o_status := 'queued';
  if s.mode = 'digest' then
    -- har kuni 09:00 (Toshkent)
    o_next_at := ((date_trunc('day', local_now) + interval '9 hours'
                   + case when local_now >= date_trunc('day', local_now) + interval '9 hours' then interval '1 day' else interval '0' end)
                  at time zone 'Asia/Tashkent');
  end if;
  return next;
end $$;

-- =====================================================================
-- 7. Navbatni qayta ishlash: kesh → chegaradan o'tgan, qat'iy talabi buzilmagan, ma'lumoti to'liq juftliklar
-- =====================================================================
create or replace function public.process_match_job(p_job_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j public.match_jobs;
  v public.vacancies;
  w public.worker_profiles;
  threshold int := public.setting_int('match_notify_threshold', 90);
  ver int := public.match_rules_version();
  batch int := public.setting_int('match_notify_batch', 5);
  m record;
  plan record;
  nid bigint;
  new_workers jsonb := '[]'::jsonb;
  new_vacancies jsonb := '[]'::jsonb;
  to_worker int := 0;
  to_employer int := 0;
  owner_rows record;
begin
  select * into j from public.match_jobs where id = p_job_id for update skip locked;
  if j.id is null or j.status not in ('queued', 'running') then return jsonb_build_object('skipped', true); end if;
  update public.match_jobs set status = 'running', started_at = now(), attempts = attempts + 1 where id = j.id;

  if j.entity_type = 'vacancy' then
    select * into v from public.vacancies where id = j.entity_id;
    if v.id is null or v.status <> 'active' then
      update public.match_jobs set status = 'done', finished_at = now(), result = jsonb_build_object('inactive', true) where id = j.id;
      return jsonb_build_object('inactive', true);
    end if;
    perform public.refresh_matches_for_vacancy(v.id);
    for m in
      select mt.worker_id, mt.score, w2.profile_id, p.first_name, left(coalesce(p.last_name, ''), 1) as initial
      from public.matches mt
      join public.worker_profiles w2 on w2.id = mt.worker_id
      join public.profiles p on p.id = w2.profile_id
      where mt.vacancy_id = v.id and mt.score >= threshold and not mt.hard_fail and mt.complete
        and w2.is_public and w2.status <> 'not_looking' and not p.is_blocked
        and w2.profile_id is distinct from v.owner_profile_id
      order by mt.score desc
      limit 200
    loop
      -- ishchiga: "Sizga mos yangi ish topildi"
      insert into public.match_notifications (worker_id, vacancy_id, side, recipient_id, score, rules_version)
      values (m.worker_id, v.id, 'worker', m.profile_id, m.score, ver)
      on conflict do nothing;
      if found then
        nid := null;
        select * into plan from public.match_tg_plan(m.profile_id, 'worker', v.id);
        insert into public.notifications (profile_id, type, payload, link, tg_status, tg_next_at, dedupe_key)
        values (m.profile_id, 'new_matching_vacancy',
                jsonb_build_object('vacancy_id', v.id, 'vacancy_slug', v.slug, 'vacancy_title', v.title, 'score', m.score,
                                   'worker_id', m.worker_id, 'count', 1),
                '/jobs/' || v.slug, plan.o_status, plan.o_next_at, 'match:w:' || m.worker_id || ':' || v.id)
        on conflict (dedupe_key) where dedupe_key is not null do nothing
        returning id into nid;
        update public.match_notifications set notification_id = nid where worker_id = m.worker_id and vacancy_id = v.id and side = 'worker';
        to_worker := to_worker + 1;
      end if;
      -- ish beruvchiga: shu vakansiyaga mos nomzodlar (bitta jamlangan xabar)
      insert into public.match_notifications (worker_id, vacancy_id, side, recipient_id, score, rules_version)
      values (m.worker_id, v.id, 'employer', v.owner_profile_id, m.score, ver)
      on conflict do nothing;
      if found then
        new_workers := new_workers || jsonb_build_object('worker_id', m.worker_id, 'name', btrim(concat_ws(' ', m.first_name, nullif(m.initial, '') || '.')), 'score', m.score);
      end if;
    end loop;
    if jsonb_array_length(new_workers) > 0 and v.owner_profile_id is not null then
      select * into plan from public.match_tg_plan(v.owner_profile_id, 'employer', v.id);
      insert into public.notifications (profile_id, type, payload, link, tg_status, tg_next_at, dedupe_key)
      values (v.owner_profile_id, 'new_matching_worker',
              jsonb_build_object('vacancy_id', v.id, 'vacancy_title', v.title, 'count', jsonb_array_length(new_workers),
                                 'workers', (select jsonb_agg(x) from (select x from jsonb_array_elements(new_workers) x limit batch) s)),
              '/cabinet/matches?vacancy=' || v.id, plan.o_status, plan.o_next_at, 'match:e:job:' || j.id)
      returning id into nid;
      update public.match_notifications set notification_id = nid
      where vacancy_id = v.id and side = 'employer' and notification_id is null;
      to_employer := jsonb_array_length(new_workers);
    end if;

  else
    select * into w from public.worker_profiles where id = j.entity_id;
    if w.id is null or not w.is_public then
      update public.match_jobs set status = 'done', finished_at = now(), result = jsonb_build_object('inactive', true) where id = j.id;
      return jsonb_build_object('inactive', true);
    end if;
    perform public.refresh_matches_for_worker(w.id);
    for m in
      select mt.vacancy_id, mt.score, v2.slug, v2.title, v2.owner_profile_id
      from public.matches mt
      join public.vacancies v2 on v2.id = mt.vacancy_id
      where mt.worker_id = w.id and mt.score >= threshold and not mt.hard_fail and mt.complete
        and v2.status = 'active' and v2.owner_profile_id is distinct from w.profile_id
      order by mt.score desc
      limit 100
    loop
      -- ish beruvchiga: "Vakansiyangizga mos nomzod topildi"
      insert into public.match_notifications (worker_id, vacancy_id, side, recipient_id, score, rules_version)
      values (w.id, m.vacancy_id, 'employer', m.owner_profile_id, m.score, ver)
      on conflict do nothing;
      if found and m.owner_profile_id is not null then
        nid := null;
        select * into plan from public.match_tg_plan(m.owner_profile_id, 'employer', m.vacancy_id);
        insert into public.notifications (profile_id, type, payload, link, tg_status, tg_next_at, dedupe_key)
        values (m.owner_profile_id, 'new_matching_worker',
                jsonb_build_object('vacancy_id', m.vacancy_id, 'vacancy_title', m.title, 'count', 1,
                  'workers', jsonb_build_array(jsonb_build_object('worker_id', w.id,
                    'name', (select btrim(concat_ws(' ', p.first_name, nullif(left(coalesce(p.last_name, ''), 1), '') || '.')) from public.profiles p where p.id = w.profile_id),
                    'score', m.score))),
                '/cabinet/matches?vacancy=' || m.vacancy_id, plan.o_status, plan.o_next_at, 'match:e:' || w.id || ':' || m.vacancy_id)
        on conflict (dedupe_key) where dedupe_key is not null do nothing
        returning id into nid;
        update public.match_notifications set notification_id = nid where worker_id = w.id and vacancy_id = m.vacancy_id and side = 'employer';
        to_employer := to_employer + 1;
      end if;
      -- ishchiga: mos vakansiyalar (bitta jamlangan xabar)
      insert into public.match_notifications (worker_id, vacancy_id, side, recipient_id, score, rules_version)
      values (w.id, m.vacancy_id, 'worker', w.profile_id, m.score, ver)
      on conflict do nothing;
      if found then
        new_vacancies := new_vacancies || jsonb_build_object('vacancy_id', m.vacancy_id, 'slug', m.slug, 'title', m.title, 'score', m.score);
      end if;
    end loop;
    if jsonb_array_length(new_vacancies) > 0 then
      select * into plan from public.match_tg_plan(w.profile_id, 'worker', (new_vacancies->0->>'vacancy_id')::uuid);
      insert into public.notifications (profile_id, type, payload, link, tg_status, tg_next_at, dedupe_key)
      values (w.profile_id, 'new_matching_vacancy',
              jsonb_build_object('worker_id', w.id, 'count', jsonb_array_length(new_vacancies),
                'vacancy_id', new_vacancies->0->>'vacancy_id', 'vacancy_slug', new_vacancies->0->>'slug',
                'vacancy_title', new_vacancies->0->>'title', 'score', (new_vacancies->0->>'score')::int,
                'vacancies', (select jsonb_agg(x) from (select x from jsonb_array_elements(new_vacancies) x limit batch) s)),
              case when jsonb_array_length(new_vacancies) = 1 then '/jobs/' || (new_vacancies->0->>'slug') else '/cabinet/matches' end,
              plan.o_status, plan.o_next_at, 'match:w:job:' || j.id)
      returning id into nid;
      update public.match_notifications set notification_id = nid where worker_id = w.id and side = 'worker' and notification_id is null;
      to_worker := jsonb_array_length(new_vacancies);
    end if;
  end if;

  update public.match_jobs set status = 'done', finished_at = now(),
    result = jsonb_build_object('to_worker', to_worker, 'to_employer', to_employer) where id = j.id;
  return jsonb_build_object('to_worker', to_worker, 'to_employer', to_employer);
exception when others then
  update public.match_jobs set attempts = attempts + 1, status = case when attempts + 1 >= 5 then 'failed' else 'queued' end,
    last_error = left(sqlerrm, 500) where id = p_job_id;
  return jsonb_build_object('error', sqlerrm);
end $$;

create or replace function public.process_match_jobs(p_limit int default 20)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.match_jobs
    where status = 'queued' or (status = 'running' and started_at < now() - interval '10 minutes')
    order by created_at limit greatest(1, least(coalesce(p_limit, 20), 100))
  loop
    perform public.process_match_job(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- =====================================================================
-- 8. Outbox: Telegram yuboruvchi uchun navbatni olish (ijara bilan) va kuzatiladigan havola
-- =====================================================================
create or replace function public.telegram_outbox_claim(p_limit int default 100)
returns setof public.notifications language plpgsql security definer set search_path = public as $$
begin
  return query
  with c as (
    select n.id from public.notifications n
    where n.tg_status = 'queued' and n.tg_next_at <= now()
    order by n.tg_next_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  )
  update public.notifications n set tg_next_at = now() + interval '2 minutes'
  from c where n.id = c.id
  returning n.*;
end $$;

create or replace function public.notification_open(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare l text;
begin
  update public.notifications set opened_at = coalesce(opened_at, now()) where open_token = p_token returning link into l;
  return l;
end $$;

-- =====================================================================
-- 9. pg_cron: har daqiqa — ish bo'lsagina ilovaning /api/cron/tick endpointi
--    (moderatsiya navbati, moslik hodisalari, Telegram outbox)
-- =====================================================================
create or replace function public.dispatch_app_cron(p_path text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  base text;
  secret text;
begin
  if p_path not in ('/api/cron/notifications', '/api/cron/vacancies', '/api/cron/tick') then
    raise exception 'invalid_path' using errcode = '22023';
  end if;
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into base using 'ishuz_app_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into secret using 'ishuz_cron_secret';
  if base is null or secret is null then return null; end if;
  if p_path in ('/api/cron/notifications', '/api/cron/tick') and not (
    exists (select 1 from public.notifications n where n.tg_status = 'queued' and n.tg_next_at <= now())
    or exists (select 1 from public.match_jobs j where j.status = 'queued')
    or exists (select 1 from public.vacancies v where v.moderation_state = 'pending'
               and (v.status = 'pending_review' or (v.status = 'draft' and v.moderation_requested_at is not null))
               and (v.moderation_next_at is null or v.moderation_next_at <= now()))
    or exists (select 1 from public.worker_profiles w where w.moderation_state = 'pending' and w.publish_requested
               and w.onboarding_completed_at is not null and (w.moderation_next_at is null or w.moderation_next_at <= now()))
  ) then
    return null;
  end if;
  return net.http_post(
    url := rtrim(base, '/') || case when p_path = '/api/cron/notifications' then '/api/cron/tick' else p_path end,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 55000
  );
end $$;
revoke execute on function public.dispatch_app_cron(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ishuz-telegram', '* * * * *', $job$select public.dispatch_app_cron('/api/cron/tick');$job$);
  end if;
end $$;

-- =====================================================================
-- 10. Ruxsatlar
-- =====================================================================
revoke execute on function public.confirm_match_subscription(uuid, text), public.telegram_blocked(uuid),
  public.consume_telegram_link_token(text, bigint, text, text, text, text), public.enqueue_match_job(text, uuid, text),
  public.match_tg_plan(uuid, text, uuid), public.process_match_job(bigint), public.process_match_jobs(int),
  public.telegram_outbox_claim(int)
  from public, anon, authenticated;
grant execute on function public.confirm_match_subscription(uuid, text), public.telegram_blocked(uuid),
  public.consume_telegram_link_token(text, bigint, text, text, text, text), public.process_match_job(bigint),
  public.process_match_jobs(int), public.telegram_outbox_claim(int) to service_role;
revoke execute on function public.set_match_subscription(text, boolean, text, uuid, uuid, int, public.work_schedule[], uuid[]),
  public.create_telegram_link_token(text, text) from public, anon;
grant execute on function public.set_match_subscription(text, boolean, text, uuid, uuid, int, public.work_schedule[], uuid[]),
  public.create_telegram_link_token(text, text) to authenticated;
grant execute on function public.notification_open(uuid) to anon, authenticated;
