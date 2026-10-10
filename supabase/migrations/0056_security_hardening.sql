-- 0056 · Xavfsizlikni mustahkamlash (OWASP ASVS 5.0 L2 asosida; tahlil: docs/SECURITY_AUDIT.md)
--
--  1. Xavfsizlik hodisalari (security_events) va vaqtinchalik cheklovlar (security_restrictions) + admin ogohlantirish
--  2. Sessiyalarni bekor qilish: profiles.sessions_revoked_at, is_active_user() JWT iat tekshiruvi,
--     is_admin()/has_admin_permission() bloklangan/bekor qilingan sessiyani tan olmaydi
--  3. admin_set_user_block: o'zini/yuqori rolni bloklash taqiqi, sessiyalar o'chiriladi, auth ban, e'lonlar yashiriladi
--  4. Bloklangan foydalanuvchi hech qaysi jadvalga yoza olmaydi (RESTRICTIVE siyosatlar, storage ham)
--  5. PostgREST pre-request: bloklangan/cheklangan hisobning barcha yozish so'rovlari markazda to'xtatiladi
--  6. Telegram: auth foydalanuvchini app_metadata.tg_id bilan bog'lash, bog'lashni oldindan ko'rish, update_id dedupe
--  7. Shaxsiy ma'lumot: employer_profiles faqat egasi/kompaniya a'zosi/admin; anon companies.tin/created_by ko'rmaydi;
--     telefon yashirin bo'lsa kompaniya kartasiga ko'chirilmaydi
--  8. Himoya triggerlari: vakansiya holati faqat RPC orqali; ish ko'rsatkichlari/admin maydonlari mijozdan o'zgarmaydi;
--     tasdiqlangan kompaniya/ish beruvchi nomi o'zgarmaydi
--  9. Huquqlar: verification_requests ga to'g'ridan-to'g'ri INSERT yo'q, notifications faqat read_at, audit append-only
-- 10. Ommaviy bucketlar ro'yxatini olish (list) faqat o'z papkasi
-- 11. avatar_url / logo_url faqat o'z storage yo'li yoki Telegram userpic
-- 12. Hujjat va rasm yo'llari qat'iy shablon bilan
-- 13. Ichki funksiyalarni anon/authenticated chaqira olmaydi
-- 14. Ishchi to'liqligi/ko'rishlar: begona ishchi uchun to'g'ridan-to'g'ri chaqiruv yo'q, ko'rish hisobi cheklangan
-- 15. Masofa filtri kvantlanadi (trilateratsiya)
-- 16. Texnik xizmat: hisoblagich, hodisa va dedupe jadvallarini muntazam tozalash
--
-- DROP yo'q (ALTER POLICY / CREATE OR REPLACE). Rollback: docs/SECURITY_RUNBOOK.md → "0056 rollback".

-- Funksiya matnida aniq bir joyni almashtirish: naqsh aniq 1 marta uchramasa — migratsiya to'xtaydi (jim drift bo'lmaydi)
create or replace function pg_temp.patch_fn(p_fn regprocedure, p_old text, p_new text) returns void
language plpgsql as $$
declare def text := pg_get_functiondef(p_fn); n int;
begin
  n := (length(def) - length(replace(def, p_old, ''))) / greatest(length(p_old), 1);
  if n <> 1 then raise exception 'patch_fn %: naqsh % marta uchradi (1 kutilgan)', p_fn, n; end if;
  execute replace(def, p_old, p_new);
end $$;

-- =====================================================================================================
-- 1. Xavfsizlik hodisalari va cheklovlar
-- =====================================================================================================
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type ~ '^[a-z0-9_.]{3,64}$'),
  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  actor_id uuid,
  subject_hash text check (subject_hash is null or subject_hash ~ '^[0-9a-f]{16,64}$'),
  session_ref text check (session_ref is null or session_ref ~ '^[0-9a-f]{8,64}$'),
  route text check (route is null or length(route) <= 200),
  reason_code text not null check (reason_code ~ '^[a-z0-9_.]{2,64}$'),
  action_taken text not null default 'logged'
    check (action_taken in ('logged', 'observed', 'throttled', 'challenged', 'restricted', 'blocked', 'sessions_revoked', 'lifted')),
  request_id text check (request_id is null or request_id ~ '^[A-Za-z0-9:._-]{1,100}$'),
  rule_version text check (rule_version is null or rule_version ~ '^[A-Za-z0-9._-]{1,32}$'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096)
);
comment on table public.security_events is
  'Xavfsizlik hodisalari (append-only). Telefon/IP/token ochiq yozilmaydi — faqat HMAC (subject_hash). Saqlash: 180 kun.';
create index if not exists security_events_created_idx on public.security_events (created_at desc);
create index if not exists security_events_type_idx on public.security_events (event_type, created_at desc);
create index if not exists security_events_actor_idx on public.security_events (actor_id, created_at desc) where actor_id is not null;
alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated, service_role;
grant select on public.security_events to authenticated, service_role;
create policy security_events_admin_read on public.security_events
  for select to authenticated using ((select public.has_admin_permission('security.view')));

create table if not exists public.security_restrictions (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('account', 'phone', 'ip', 'telegram')),
  subject text not null check (subject ~ '^[0-9a-f-]{16,64}$'),
  state text not null check (state in ('throttled', 'challenge_required', 'temporarily_restricted', 'compromise_suspected')),
  reason_code text not null check (reason_code ~ '^[a-z0-9_.]{2,64}$'),
  rule_version text not null check (rule_version ~ '^[A-Za-z0-9._-]{1,32}$'),
  enforced boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  lifted_at timestamptz,
  lifted_by uuid,
  event_id uuid references public.security_events(id) on delete set null,
  constraint security_restrictions_ttl check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);
comment on table public.security_restrictions is
  'Vaqtinchalik cheklovlar holat mashinasi: throttled → challenge_required → temporarily_restricted (+ compromise_suspected). '
  'Doim muddatli (telefon/IP/telegram ≤ 1 soat, hisob ≤ 7 kun) — begona odam jabrlanuvchini doimiy bloklay olmaydi. '
  'enforced=false — kuzatuv rejimi (faqat qayd).';
create index if not exists security_restrictions_active_idx on public.security_restrictions (scope, subject, expires_at desc) where lifted_at is null;
create index if not exists security_restrictions_event_idx on public.security_restrictions (event_id) where event_id is not null;
alter table public.security_restrictions enable row level security;
revoke all on public.security_restrictions from anon, authenticated, service_role;
grant select on public.security_restrictions to authenticated, service_role;
create policy security_restrictions_admin_read on public.security_restrictions
  for select to authenticated using ((select public.has_admin_permission('security.view')));

insert into public.app_settings (key, value, is_public) values
  ('security_restrictions_enforce', 'false'::jsonb, false),
  ('security_alerts_enabled', 'true'::jsonb, false),
  ('storage_public_origin', '""'::jsonb, false)
on conflict (key) do nothing;

-- Adminlarga ogohlantirish (yuqori/kritik hodisa): ilova bildirishnomasi → Telegram outbox (tasdiqlangan chat).
-- Dedupe: bir admin × hodisa turi × sub'ekt × 15 daqiqa = 1 xabar; bir adminga soatiga ≤ 20 ta.
create or replace function public.security_alert_admins(p_event_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare e public.security_events; n int;
begin
  select * into e from public.security_events where id = p_event_id;
  if e.id is null or e.severity not in ('high', 'critical') or not public.setting_bool('security_alerts_enabled', true) then return 0; end if;
  insert into public.notifications (profile_id, type, payload, link, dedupe_key)
  select a.profile_id, 'system',
         jsonb_build_object('kind', 'security_alert', 'event_type', e.event_type, 'severity', e.severity,
                            'reason', e.reason_code, 'action', e.action_taken, 'at', e.created_at),
         '/admin/security',
         'sec:' || a.profile_id || ':' || e.event_type || ':' || coalesce(e.subject_hash, coalesce(e.actor_id::text, '-'))
           || ':' || floor(extract(epoch from e.created_at) / 900)::bigint
  from public.admin_users a
  join public.profiles p on p.id = a.profile_id
  where a.is_active and not p.is_blocked
    and (a.role in ('super_admin', 'admin') or 'security.view' = any(a.permissions))
    and public.check_rate_limit('secalert:' || a.profile_id, 20, 3600)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.security_log_event(
  p_event_type text,
  p_severity text,
  p_reason_code text,
  p_actor_id uuid default null,
  p_subject_hash text default null,
  p_session_ref text default null,
  p_route text default null,
  p_action_taken text default 'logged',
  p_request_id text default null,
  p_rule_version text default null,
  p_details jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  insert into public.security_events (event_type, severity, reason_code, actor_id, subject_hash, session_ref, route,
                                      action_taken, request_id, rule_version, details)
  values (p_event_type, p_severity, p_reason_code, p_actor_id, p_subject_hash, p_session_ref, left(p_route, 200),
          coalesce(p_action_taken, 'logged'), p_request_id, p_rule_version, coalesce(p_details, '{}'::jsonb))
  returning id into eid;
  perform public.security_alert_admins(eid);
  return eid;
end $$;

-- Cheklov qo'yish. Muddat DB'da cheklanadi (telefon/IP/telegram ≤ 1 soat, hisob ≤ 7 kun).
-- p_enforce null → app_settings.security_restrictions_enforce (standart: kuzatuv).
create or replace function public.security_restrict(
  p_scope text,
  p_subject text,
  p_state text,
  p_reason_code text,
  p_ttl_seconds integer,
  p_rule_version text,
  p_event_id uuid default null,
  p_enforce boolean default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap int := case p_scope when 'account' then 7 * 86400 else 3600 end;
  ttl int := least(greatest(coalesce(p_ttl_seconds, 60), 30), cap);
  enf boolean := coalesce(p_enforce, public.setting_bool('security_restrictions_enforce', false));
  r public.security_restrictions;
begin
  -- shu holatdagi faol cheklov bo'lsa — uzaytirilmaydi (hujumchi muddatni cheksiz cho'za olmaydi)
  select * into r from public.security_restrictions
  where scope = p_scope and subject = p_subject and state = p_state and lifted_at is null and expires_at > now()
    and enforced = enf
  order by expires_at desc limit 1;
  if r.id is null then
    insert into public.security_restrictions (scope, subject, state, reason_code, rule_version, enforced, expires_at, event_id)
    values (p_scope, p_subject, p_state, p_reason_code, p_rule_version, enf, now() + make_interval(secs => ttl), p_event_id)
    returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'state', r.state, 'enforced', r.enforced, 'expires_at', r.expires_at);
end $$;

-- Eng kuchli faol cheklov (kuzatuvdagilar ham qaytadi — enforced maydoniga qarang). Yo'q bo'lsa null.
create or replace function public.security_active_restriction(p_scope text, p_subject text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'state', r.state, 'reason_code', r.reason_code, 'enforced', r.enforced, 'expires_at', r.expires_at)
  from public.security_restrictions r
  where r.scope = p_scope and r.subject = p_subject and r.lifted_at is null and r.expires_at > now()
  order by r.enforced desc,
           case r.state when 'temporarily_restricted' then 4 when 'compromise_suspected' then 3 when 'challenge_required' then 2 else 1 end desc,
           r.expires_at desc
  limit 1;
$$;

-- Hisob darajasida majburiy vaqtinchalik cheklov bormi (pre-request va server tekshiruvlari uchun)
create or replace function public.security_account_restricted(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile_id is not null and exists (
    select 1 from public.security_restrictions r
    where r.scope = 'account' and r.subject = p_profile_id::text and r.state = 'temporarily_restricted'
      and r.enforced and r.lifted_at is null and r.expires_at > now());
$$;

-- =====================================================================================================
-- 2. Sessiyalarni bekor qilish va faol foydalanuvchi
-- =====================================================================================================
alter table public.profiles add column if not exists sessions_revoked_at timestamptz;
comment on column public.profiles.sessions_revoked_at is
  'Shu vaqtdan oldin berilgan JWT (iat) bilan yozish mumkin emas (bloklash, shubhali kirish, Telegram almashtirilishi).';

-- Faol = kirgan, bloklanmagan va JWT sessiyalar bekor qilingandan keyin berilgan.
-- Access token amal qilish muddati ichida ham (≤ JWT expiry) bloklangan/bekor qilingan token bilan yozib bo'lmaydi.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and coalesce((
    select not p.is_blocked
       and (p.sessions_revoked_at is null
            or coalesce((auth.jwt() ->> 'iat')::numeric, 0) > extract(epoch from p.sessions_revoked_at))
    from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.profile_id = auth.uid() and a.is_active)
     and public.admin_aal_ok()
     and public.is_active_user();
$$;

create or replace function public.has_admin_permission(perm text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  a public.admin_users;
begin
  select * into a from public.admin_users where profile_id = auth.uid() and is_active;
  if not found then return false; end if;
  if not public.admin_aal_ok() then return false; end if;
  if not public.is_active_user() then return false; end if;
  if a.role = 'super_admin' then return true; end if;
  if perm = any(a.permissions) then return true; end if;
  return case a.role
    when 'admin' then perm in (
      'users.view', 'users.block', 'users.contacts', 'workers.view', 'employers.view', 'employers.verify',
      'vacancies.view', 'vacancies.moderate', 'categories.manage', 'skills.manage', 'regions.manage',
      'reports.view', 'reports.resolve', 'reviews.moderate', 'chat.moderate', 'notifications.broadcast', 'analytics.view', 'audit.view',
      'security.view', 'security.manage')
    when 'moderator' then perm in (
      'users.view', 'workers.view', 'employers.view', 'vacancies.view', 'vacancies.moderate',
      'reports.view', 'reports.resolve', 'reviews.moderate', 'chat.moderate', 'analytics.view')
    when 'support' then perm in ('users.view', 'workers.view', 'employers.view', 'vacancies.view', 'reports.view', 'analytics.view')
    when 'analyst' then perm in ('analytics.view')
    else false
  end;
end $$;

-- Ichki: barcha sessiyalarni o'chirish (refresh ishlamaydi) + mavjud access tokenlar yozish huquqini yo'qotadi
create or replace function public.security_revoke_sessions_internal(p_profile_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  update public.profiles set sessions_revoked_at = now() where id = p_profile_id;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_profile_id;
    get diagnostics n = row_count;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'update auth.refresh_tokens set revoked = true where user_id = $1 and revoked is not true' using p_profile_id::text;
  end if;
  return n;
end $$;

-- Server (service role): shubhali holatda foydalanuvchining barcha sessiyalarini bekor qilish
create or replace function public.security_revoke_sessions(p_profile_id uuid, p_reason_code text, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; eid uuid;
begin
  if p_profile_id is null then raise exception 'invalid_profile' using errcode = '22023'; end if;
  n := public.security_revoke_sessions_internal(p_profile_id);
  eid := public.security_log_event('session.revoked', 'medium', p_reason_code, p_profile_id, null, null, null,
                                   'sessions_revoked', p_request_id, null, jsonb_build_object('sessions', n));
  return jsonb_build_object('sessions', n, 'event_id', eid);
end $$;

-- Admin: foydalanuvchini bloklamasdan barcha qurilmalardan chiqarish
create or replace function public.admin_revoke_user_sessions(p_profile_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.has_admin_permission('users.block') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  n := public.security_revoke_sessions_internal(p_profile_id);
  perform public.write_audit('user.sessions_revoke', 'profile', p_profile_id::text, null, jsonb_build_object('sessions', n));
  perform public.security_log_event('admin.sessions_revoked', 'medium', 'admin_action', auth.uid(), null, null, null,
                                    'sessions_revoked', null, null, jsonb_build_object('target', p_profile_id, 'sessions', n));
  return n;
end $$;

-- =====================================================================================================
-- 3. Bloklash: ierarxiya, sessiyalar, auth ban, ommaviy e'lonlar
-- =====================================================================================================
create or replace function public.admin_set_user_block(p_profile_id uuid, p_block boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  before_row jsonb;
  me_role public.admin_role;
  n_sessions int := 0;
  n_vacancies int := 0;
begin
  if not public.has_admin_permission('users.block') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_profile_id = auth.uid() then raise exception 'cannot_block_self' using errcode = '42501'; end if;
  select role into me_role from public.admin_users where profile_id = auth.uid() and is_active;
  -- faol admin(lar)ni faqat super_admin bloklaydi
  if exists (select 1 from public.admin_users where profile_id = p_profile_id and is_active)
     and me_role is distinct from 'super_admin' then
    raise exception 'forbidden_hierarchy' using errcode = '42501';
  end if;
  select to_jsonb(p) - 'sessions_revoked_at' into before_row from public.profiles p where id = p_profile_id;
  if before_row is null then raise exception 'not_found' using errcode = 'P0002'; end if;

  update public.profiles
  set is_blocked = p_block,
      blocked_reason = case when p_block then left(p_reason, 500) end,
      blocked_at = case when p_block then now() end
  where id = p_profile_id;

  if p_block then
    n_sessions := public.security_revoke_sessions_internal(p_profile_id);
    if to_regclass('auth.users') is not null then
      execute 'update auth.users set banned_until = now() + interval ''100 years'' where id = $1' using p_profile_id;
    end if;
    -- bloklangan egasining faol e'lonlari ommadan olinadi (blokdan chiqarilganda qaytariladi)
    update public.vacancies set status = 'hidden', moderation_note = 'owner_blocked'
    where owner_profile_id = p_profile_id and status = 'active';
    get diagnostics n_vacancies = row_count;
  else
    if to_regclass('auth.users') is not null then
      execute 'update auth.users set banned_until = null where id = $1' using p_profile_id;
    end if;
    update public.vacancies set status = 'active', moderation_note = null
    where owner_profile_id = p_profile_id and status = 'hidden' and moderation_note = 'owner_blocked'
      and (expires_at is null or expires_at > now());
    get diagnostics n_vacancies = row_count;
    update public.vacancies set status = 'expired', moderation_note = null
    where owner_profile_id = p_profile_id and status = 'hidden' and moderation_note = 'owner_blocked';
  end if;

  perform public.write_audit(case when p_block then 'user.block' else 'user.unblock' end, 'profile', p_profile_id::text, before_row,
                             jsonb_build_object('reason', p_reason, 'sessions_revoked', n_sessions, 'vacancies', n_vacancies));
  perform public.security_log_event(case when p_block then 'admin.user_blocked' else 'admin.user_unblocked' end, 'low', 'admin_action',
                                    auth.uid(), null, null, null, case when p_block then 'blocked' else 'lifted' end, null, null,
                                    jsonb_build_object('target', p_profile_id, 'sessions', n_sessions, 'vacancies', n_vacancies));
end $$;

-- =====================================================================================================
-- 4. Bloklangan / sessiyasi bekor qilingan foydalanuvchi yoza olmaydi (barcha jadvallar + storage)
-- =====================================================================================================
-- RESTRICTIVE siyosat mavjud ruxsat beruvchi siyosatlar bilan AND qilinadi: ularning matni o'zgarmaydi.
-- (select ...) — so'rov boshiga bir marta hisoblanadi (initplan). O'qish o'zgarmaydi (/blocked sahifasi ishlaydi).
-- UPDATE: WITH CHECK orqali — jim "0 qator" emas, aniq 42501 xato qaytadi.
do $$
declare r record; n int := 0;
begin
  for r in
    select distinct p.tablename
    from pg_policies p
    where p.schemaname = 'public' and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and p.roles && array['authenticated', 'public']::name[]
    order by 1
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tablename and policyname = 'sec_active_insert') then
      execute format('create policy sec_active_insert on public.%I as restrictive for insert to authenticated with check ((select public.is_active_user()))', r.tablename);
      execute format('create policy sec_active_update on public.%I as restrictive for update to authenticated using (true) with check ((select public.is_active_user()))', r.tablename);
      execute format('create policy sec_active_delete on public.%I as restrictive for delete to authenticated using ((select public.is_active_user()))', r.tablename);
      n := n + 1;
    end if;
  end loop;
  raise notice '0056: faol foydalanuvchi siyosati % ta jadvalga qo''shildi', n;
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null
     and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sec_active_insert') then
    create policy sec_active_insert on storage.objects as restrictive for insert to authenticated with check ((select public.is_active_user()));
    create policy sec_active_update on storage.objects as restrictive for update to authenticated using (true) with check ((select public.is_active_user()));
    create policy sec_active_delete on storage.objects as restrictive for delete to authenticated using ((select public.is_active_user()));
  end if;
end $$;

-- =====================================================================================================
-- 5. PostgREST pre-request: markaziy tekshiruv (SECURITY DEFINER RPC'lar ham qamrab olinadi)
-- =====================================================================================================
-- Faqat authenticated + yozish metodlari (POST/PATCH/PUT/DELETE). GET o'zgarmaydi.
-- Ichki xato bo'lsa — o'tkazadi (fail-open): asosiy himoya baribir RLS (4-bo'lim); bu qo'shimcha qatlam.
-- "x-ishuz-preflight: 1" sarlavhasi — faqat yoqilganini tekshirish uchun (so'rov o'zi rad etiladi).
create or replace function public.api_pre_request()
returns void language plpgsql stable security definer set search_path = public as $$
declare
  m text;
  role text;
  probe text;
  uid uuid;
begin
  begin
    m := upper(coalesce(current_setting('request.method', true), ''));
    role := coalesce(auth.jwt() ->> 'role', '');
    probe := nullif(current_setting('request.headers', true), '')::json ->> 'x-ishuz-preflight';
    uid := auth.uid();
  exception when others then
    return;
  end;
  if probe = '1' then raise exception 'pre_request_active' using errcode = 'PT418'; end if;
  if role <> 'authenticated' or m in ('', 'GET', 'HEAD', 'OPTIONS') then return; end if;
  if not public.is_active_user() then
    raise exception 'account_restricted' using errcode = '42501', hint = 'blocked_or_sessions_revoked';
  end if;
  if public.security_account_restricted(uid) then
    raise exception 'temporarily_restricted' using errcode = '42501', hint = 'security_restriction';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    begin
      execute 'alter role authenticator set pgrst.db_pre_request = ''public.api_pre_request''';
      raise notice '0056: pgrst.db_pre_request yoqildi';
    exception when insufficient_privilege then
      raise notice '0056: authenticator rolini o''zgartirish huquqi yo''q — pre-request qo''lda yoqiladi (RUNBOOK)';
    end;
  end if;
end $$;

-- =====================================================================================================
-- 6. Telegram identifikatsiyasi
-- =====================================================================================================
-- tg_<id>@telegram.ishuz.local manzili oldindan band qilingan bo'lsa (ochiq signUp) — o'sha hisob qabul qilinmaydi.
-- Ishonch belgisi: app_metadata.tg_id (faqat service role yoza oladi). Mavjud bog'langan hisoblarga to'ldiriladi.
do $$
begin
  if to_regclass('auth.users') is not null then
    update auth.users u
    set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tg_id', t.telegram_user_id)
    from public.telegram_accounts t
    where t.profile_id = u.id and (u.raw_app_meta_data ->> 'tg_id') is null;
  end if;
end $$;

-- Server: Telegram id uchun auth foydalanuvchi (bog'langan → texnik email + tg_id mosligi)
create or replace function public.telegram_auth_lookup(p_telegram_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare linked uuid; e_id uuid; e_tg text; e_blocked boolean;
begin
  select profile_id into linked from public.telegram_accounts where telegram_user_id = p_telegram_user_id;
  select u.id, u.raw_app_meta_data ->> 'tg_id' into e_id, e_tg
  from auth.users u where u.email = 'tg_' || p_telegram_user_id || '@telegram.ishuz.local' limit 1;
  select p.is_blocked into e_blocked from public.profiles p where p.id = coalesce(linked, e_id);
  return jsonb_build_object(
    'linked_profile_id', linked,
    'email_user_id', e_id,
    'email_trusted', e_id is not null and coalesce(e_tg = p_telegram_user_id::text, false),
    'blocked', coalesce(e_blocked, false));
end $$;

-- Bog'lash havolasini oldindan ko'rish (bot "Tasdiqlaysizmi?" deb so'raydi) — token ishlatilmaydi
create or replace function public.preview_telegram_link_token(p_token_hash text, p_telegram_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.telegram_link_tokens; other uuid; cur bigint; nm text;
begin
  select * into t from public.telegram_link_tokens where token_hash = p_token_hash;
  if t.token_hash is null then return jsonb_build_object('status', 'invalid'); end if;
  if t.used_at is not null then return jsonb_build_object('status', 'used'); end if;
  if t.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  if public.is_blocked(t.profile_id) then return jsonb_build_object('status', 'invalid'); end if;
  select profile_id into other from public.telegram_accounts where telegram_user_id = p_telegram_user_id;
  if other is not null and other <> t.profile_id then return jsonb_build_object('status', 'linked_elsewhere'); end if;
  select telegram_user_id into cur from public.telegram_accounts where profile_id = t.profile_id;
  select nullif(btrim(coalesce(p.first_name, '') || ' ' || left(coalesce(p.last_name, ''), 1) || case when coalesce(p.last_name, '') <> '' then '.' else '' end), '')
    into nm from public.profiles p where p.id = t.profile_id;
  return jsonb_build_object('status', case when other = t.profile_id then 'already_linked' else 'ok' end,
                            'name', coalesce(nm, '—'), 'role', t.role,
                            'replaces_other', cur is not null and cur <> p_telegram_user_id);
end $$;

create or replace function public.consume_telegram_link_token(p_token_hash text, p_telegram_user_id bigint, p_username text default null, p_first_name text default null, p_last_name text default null, p_language text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.telegram_link_tokens;
  other uuid;
  prev bigint;
begin
  select * into t from public.telegram_link_tokens where token_hash = p_token_hash for update;
  if t.token_hash is null then return jsonb_build_object('status', 'invalid'); end if;
  if t.used_at is not null then return jsonb_build_object('status', 'used'); end if;
  if t.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  if public.is_blocked(t.profile_id) then
    update public.telegram_link_tokens set used_at = now(), used_by = p_telegram_user_id where token_hash = p_token_hash;
    return jsonb_build_object('status', 'invalid');
  end if;
  select profile_id into other from public.telegram_accounts where telegram_user_id = p_telegram_user_id;
  if other is not null and other <> t.profile_id then
    -- bu Telegram boshqa hisobga bog'langan: o'zboshimchalik bilan ko'chirilmaydi
    update public.telegram_link_tokens set used_at = now(), used_by = p_telegram_user_id where token_hash = p_token_hash;
    return jsonb_build_object('status', 'linked_elsewhere');
  end if;
  update public.telegram_link_tokens set used_at = now(), used_by = p_telegram_user_id where token_hash = p_token_hash;
  -- hisob boshqa Telegramga bog'langan bo'lsa — egasi o'zi (kirgan holda) yangisiga almashtirdi; eski Telegram xabardor qilinadi
  select telegram_user_id into prev from public.telegram_accounts where profile_id = t.profile_id and telegram_user_id <> p_telegram_user_id;
  delete from public.telegram_accounts where profile_id = t.profile_id and telegram_user_id <> p_telegram_user_id;
  insert into public.telegram_accounts (telegram_user_id, profile_id, username, first_name, last_name, language_code, bot_started, linked_at, last_seen_at)
  values (p_telegram_user_id, t.profile_id, p_username, p_first_name, p_last_name, p_language, true, now(), now())
  on conflict (telegram_user_id) do update set
    username = excluded.username, first_name = excluded.first_name, last_name = excluded.last_name,
    language_code = coalesce(excluded.language_code, public.telegram_accounts.language_code),
    bot_started = true, last_seen_at = now();
  if to_regclass('auth.users') is not null then
    execute 'update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, ''{}''::jsonb) || jsonb_build_object(''tg_id'', $2::bigint) where id = $1'
      using t.profile_id, p_telegram_user_id;
  end if;
  if prev is not null then
    perform public.security_log_event('telegram.link_replaced', 'medium', 'owner_relinked', t.profile_id, null, null, null,
                                      'logged', null, null, '{}'::jsonb);
    perform public.notify(t.profile_id, 'system', jsonb_build_object('kind', 'telegram_relinked'), '/cabinet/alerts');
  end if;
  return jsonb_build_object('status', 'linked', 'profile_id', t.profile_id, 'role', t.role, 'previous_telegram_user_id', prev);
end $$;

-- Webhook takroriy yetkazilishi (Telegram qayta yuboradi) — update_id bo'yicha bir marta qayta ishlanadi
create table if not exists public.telegram_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;
revoke all on public.telegram_updates from anon, authenticated;

create or replace function public.telegram_update_first_seen(p_update_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.telegram_updates (update_id) values (p_update_id) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- =====================================================================================================
-- 7. Shaxsiy ma'lumotlarni toraytirish
-- =====================================================================================================
-- employer_profiles: contact_phone, identity_number (STIR/PINFL), verification_* — faqat egasi, kompaniya hamkasbi, admin
-- Diqqat: employer_profiles siklik jadval (update siyosatida o'ziga subso'rov) — bu yerda faqat oddiy funksiya chaqiruvlari,
-- (select ...) subso'rovi "infinite recursion detected in policy" ga olib keladi.
alter policy employer_profiles_read on public.employer_profiles
  using (profile_id = auth.uid()
         or public.is_admin()
         or (company_id is not null and public.is_company_member(company_id)));

-- Boshqalarga faqat ko'rinadigan nom (takliflar ro'yxati uchun)
create or replace function public.employer_public_names(p_profile_ids uuid[])
returns table (profile_id uuid, display_name text) language sql stable security definer set search_path = public as $$
  select e.profile_id, e.display_name
  from public.employer_profiles e
  where auth.uid() is not null and e.profile_id = any(p_profile_ids[1:200]);
$$;

-- companies: anon STIR (tin) va created_by ni ko'rmaydi (qolgan ustunlar ochiq sahifa uchun)
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'companies' and column_name not in ('tin', 'created_by');
  execute 'revoke select on public.companies from anon';
  execute format('grant select (%s) on public.companies to anon', cols);
end $$;

-- Telefon "ko'rsatilmasin" deb belgilangan bo'lsa — kompaniyaning ochiq telefoniga ko'chirilmaydi
select pg_temp.patch_fn('public.save_simple_vacancy(jsonb)'::regprocedure,
  'values (v_org, '''', me, v_type = ''government'', v_phone, v_region, v_district)',
  'values (v_org, '''', me, v_type = ''government'', case when v_show then nullif(v_phone, '''') end, v_region, v_district)');

-- =====================================================================================================
-- 8. Himoya triggerlari (mijoz to'g'ridan-to'g'ri yozganda; SECURITY DEFINER RPC'lar postgres sifatida ishlaydi)
-- =====================================================================================================
create or replace function public.is_client_write()
returns boolean language sql stable set search_path = public as $$
  select current_user in ('authenticated', 'anon');
$$;

-- vakansiya holati faqat RPC orqali (publish_vacancy: to'lov/moderatsiya qoidalari; set_vacancy_status)
create or replace function public.trg_vacancy_status_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_client_write() and new.status is distinct from old.status then
    raise exception 'status_via_rpc' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_00_vacancy_status_guard on public.vacancies;
create trigger trg_00_vacancy_status_guard before update of status on public.vacancies
  for each row execute function public.trg_vacancy_status_guard();

-- ishchi: reyting maydonlari (oxirgi faollik, yaratilgan sana, ko'rishlar) mijozdan o'zgarmaydi.
-- views_count/promoted_until/completeness o'zgartirish urinishi mavjud WITH CHECK bilan xato beradi.
create or replace function public.trg_worker_counters_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_client_write() then
    if tg_op = 'INSERT' then
      new.views_count := 0; new.last_active_at := now(); new.created_at := now();
    else
      new.last_active_at := old.last_active_at; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_00_worker_counters_guard on public.worker_profiles;
create trigger trg_00_worker_counters_guard before insert or update on public.worker_profiles
  for each row execute function public.trg_worker_counters_guard();

-- profil: admin maydonlari mijozdan o'zgarmaydi
create or replace function public.trg_profile_admin_fields_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_client_write() then
    -- is_blocked — mavjud WITH CHECK xato bilan rad etadi
    new.blocked_reason := old.blocked_reason; new.blocked_at := old.blocked_at;
    new.created_at := old.created_at; new.sessions_revoked_at := old.sessions_revoked_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_00_profile_admin_fields_guard on public.profiles;
create trigger trg_00_profile_admin_fields_guard before update on public.profiles
  for each row execute function public.trg_profile_admin_fields_guard();

-- tasdiqlangan kompaniya / ish beruvchi nomini (va STIR) almashtirib nishonni saqlab qolish mumkin emas:
-- o'zgarish e'tiborsiz qoldiriladi (qayta tasdiqlash — admin orqali)
create or replace function public.trg_verified_identity_lock()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_client_write() and old.verification_status = 'verified' then
    if tg_table_name = 'companies' then
      new.name := old.name; new.tin := old.tin;
    else
      new.display_name := old.display_name;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_00_company_verified_lock on public.companies;
create trigger trg_00_company_verified_lock before update on public.companies
  for each row execute function public.trg_verified_identity_lock();
drop trigger if exists trg_00_employer_verified_lock on public.employer_profiles;
create trigger trg_00_employer_verified_lock before update on public.employer_profiles
  for each row execute function public.trg_verified_identity_lock();

-- =====================================================================================================
-- 9. Jadval huquqlari
-- =====================================================================================================
-- Tekshiruv so'rovi faqat submit_employer_verification RPC orqali (ai_review/review_* ni mijoz yoza olmaydi)
revoke insert, update, delete on public.verification_requests from anon, authenticated;
-- Bildirishnoma: mijoz faqat read_at ni o'zgartira oladi (link/open_token/dedupe_key/tg_status emas)
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
-- Audit: ilova rollari o'zgartira/o'chira olmaydi
revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated;
revoke update, delete, truncate on public.audit_logs from service_role;
-- PostgREST ishlatmaydigan huquqlar (TRUNCATE RLS'ni chetlab o'tadi)
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- =====================================================================================================
-- 10. Ommaviy bucketlar: fayllar ochiq URL bilan ochiladi, lekin ro'yxat (list) faqat o'z papkasi
-- =====================================================================================================
do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  alter policy avatars_public_read on storage.objects to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  alter policy portfolio_public_read on storage.objects to authenticated
    using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);
  alter policy logos_public_read on storage.objects to authenticated
    using (bucket_id = 'company-logos' and public.is_company_admin(
      case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then ((storage.foldername(name))[1])::uuid end));
end $$;

-- =====================================================================================================
-- 11. Rasm manzillari: faqat o'z storage yo'li yoki Telegram userpic (kuzatuv pikseli / tashqi URL yo'q)
-- =====================================================================================================
create or replace function public.is_allowed_media_url(p_url text, p_bucket text, p_owner uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  origin text := coalesce((select value #>> '{}' from public.app_settings where key = 'storage_public_origin'), '');
  path_re text := '/storage/v1/object/public/' || p_bucket || '/' || p_owner::text || '/[A-Za-z0-9._-]{1,120}(\?[A-Za-z0-9=&._-]{0,100})?$';
begin
  if p_url is null then return true; end if;
  if length(p_url) > 500 or p_url like '%..%' then return false; end if;
  if p_url ~ '^https://t\.me/i/userpic/[0-9]{2,4}/[A-Za-z0-9_-]{8,200}\.(jpg|jpeg|png|webp|svg)$' then return true; end if;
  if origin <> '' then
    return left(p_url, length(origin)) = origin and substr(p_url, length(origin) + 1) ~ ('^' || path_re);
  end if;
  return p_url ~ ('^https?://[A-Za-z0-9.-]+(:[0-9]{2,5})?' || path_re);
end $$;

create or replace function public.trg_media_url_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'profiles' then
    if new.avatar_url is distinct from (case when tg_op = 'UPDATE' then old.avatar_url end)
       and not public.is_allowed_media_url(new.avatar_url, 'avatars', new.id) then
      if tg_op = 'INSERT' then new.avatar_url := null; else raise exception 'invalid_media_url' using errcode = '22023'; end if;
    end if;
  else
    if new.logo_url is distinct from (case when tg_op = 'UPDATE' then old.logo_url end)
       and not public.is_allowed_media_url(new.logo_url, 'company-logos', new.id) then
      if tg_op = 'INSERT' then new.logo_url := null; else raise exception 'invalid_media_url' using errcode = '22023'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_00_profile_media_guard on public.profiles;
create trigger trg_00_profile_media_guard before insert or update of avatar_url on public.profiles
  for each row execute function public.trg_media_url_guard();
drop trigger if exists trg_00_company_media_guard on public.companies;
create trigger trg_00_company_media_guard before insert or update of logo_url on public.companies
  for each row execute function public.trg_media_url_guard();

-- =====================================================================================================
-- 12. Fayl yo'llari: <egasi>/<fayl nomi> (".." va qo'shimcha papka yo'q)
-- =====================================================================================================
select pg_temp.patch_fn('public.submit_employer_verification(text,text,text[])'::regprocedure,
  'where d not like me::text || ''/%'')',
  'where d !~ (''^'' || me::text || ''/[A-Za-z0-9_-]{1,80}\.[A-Za-z0-9]{1,8}$''))');

select pg_temp.patch_fn('public.trg_vacancy_a_moderation()'::regprocedure,
  'new.photo_path not like new.owner_profile_id::text || ''/%'')',
  'new.photo_path !~ (''^'' || new.owner_profile_id::text || ''/[A-Za-z0-9_-]{1,80}\.[A-Za-z0-9]{1,8}$''))');

-- =====================================================================================================
-- 13. Ichki funksiyalar: anon/authenticated to'g'ridan-to'g'ri chaqira olmaydi
-- =====================================================================================================
do $$
declare f text;
begin
  -- faqat ichki (triggerlar, SECURITY DEFINER funksiyalar) — hech qaysi mijoz rolida kerak emas
  foreach f in array array[
    'public.admin_aal_ok()', 'public.billing_promo_until()', 'public.listing_discount_percent(payment_purpose)', 'public.listing_free_trial()',
    'public.match_weights()', 'public.match_rules_version()', 'public.moderation_enabled()',
    'public.can_view_phone(uuid)', 'public.refresh_matches_for_vacancy(uuid)',
    'public.security_alert_admins(uuid)', 'public.security_revoke_sessions_internal(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
  -- ixtiyoriy kalit bilan sozlama o'qish (xato orqali qiymat sizishi)
  for f in select p.oid::regprocedure::text from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('setting_bool', 'setting_int', 'setting_text', 'listing_price', 'profession_subtree', 'employer_can_publish')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  -- anon uchun emas (kirgan foydalanuvchi ilovada ishlatadi)
  foreach f in array array[
    'public.can_view_profile(uuid)', 'public.current_employer_id()', 'public.is_company_admin(uuid)', 'public.is_conversation_member(uuid)',
    'public.worker_related_to_vacancy(uuid)', 'public.manages_vacancy(uuid)', 'public.worker_listing_quote()', 'public.is_blocked(uuid)',
    'public.recommended_vacancies(integer)', 'public.recommended_workers(uuid,integer)', 'public.match_explain(uuid,uuid)',
    'public.refresh_worker_completeness(uuid)', 'public.worker_completeness(uuid)', 'public.record_worker_view(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
    end if;
  end loop;
  -- faqat server (service role)
  foreach f in array array[
    'public.security_log_event(text,text,text,uuid,text,text,text,text,text,text,jsonb)',
    'public.security_restrict(text,text,text,text,integer,text,uuid,boolean)',
    'public.security_active_restriction(text,text)', 'public.security_account_restricted(uuid)',
    'public.security_revoke_sessions(uuid,text,text)', 'public.telegram_auth_lookup(bigint)',
    'public.preview_telegram_link_token(text,bigint)', 'public.consume_telegram_link_token(text,bigint,text,text,text,text)',
    'public.telegram_update_first_seen(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function public.employer_public_names(uuid[]) from public, anon;
grant execute on function public.employer_public_names(uuid[]) to authenticated, service_role;
revoke execute on function public.admin_revoke_user_sessions(uuid) from public, anon;
grant execute on function public.admin_revoke_user_sessions(uuid) to authenticated;
-- pre-request PostgREST tomonidan JWT roli (anon/authenticated) sifatida chaqiriladi — EXECUTE shart
revoke execute on function public.api_pre_request() from public;
grant execute on function public.api_pre_request() to anon, authenticated, service_role;

-- =====================================================================================================
-- 14. Ishchi to'liqligi va ko'rishlar
-- =====================================================================================================
-- To'g'ridan-to'g'ri chaqiruv (trigger ichida emas) — faqat o'z ishchi profili yoki admin
create or replace function public.worker_access_ok(p_worker_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pg_trigger_depth() > 0
      or coalesce(auth.jwt() ->> 'role', '') not in ('authenticated', 'anon')
      or exists (select 1 from public.worker_profiles w where w.id = p_worker_id and w.profile_id = auth.uid())
      or public.is_admin();
$$;
revoke execute on function public.worker_access_ok(uuid) from public, anon, authenticated;

select pg_temp.patch_fn('public.refresh_worker_completeness(uuid)'::regprocedure,
  'begin
  select score into sc from public.worker_completeness(p_worker_id);',
  'begin
  if not public.worker_access_ok(p_worker_id) then raise exception ''forbidden'' using errcode = ''42501''; end if;
  select score into sc from public.worker_completeness(p_worker_id);');

do $$
declare def text := pg_get_functiondef('public.worker_completeness(uuid)'::regprocedure);
begin
  -- plpgsql: begin'dan keyin qo'riqchi; sql: o'rab olinadi
  if def ~* 'language plpgsql' then
    execute regexp_replace(def, '\nbegin\n', E'\nbegin\n  if not public.worker_access_ok(p_worker_id) then raise exception ''forbidden'' using errcode = ''42501''; end if;\n');
  else
    raise exception '0056: worker_completeness kutilmagan til';
  end if;
end $$;

-- Ko'rishlar: bir ko'ruvchi × ishchi soatiga 1 marta, ko'ruvchi soatiga ≤ 300 (sun'iy ko'tarish yo'q)
create or replace function public.record_worker_view(p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active_user() then return; end if;
  if not public.check_rate_limit('wview:' || auth.uid() || ':' || p_worker_id, 1, 3600) then return; end if;
  if not public.check_rate_limit('wview:' || auth.uid(), 300, 3600) then return; end if;
  update public.worker_profiles set views_count = views_count + 1
  where id = p_worker_id and profile_id <> auth.uid();
end $$;
revoke execute on function public.record_worker_view(uuid) from public, anon;

-- =====================================================================================================
-- 15. Masofa filtri: butun km (min 2) — aniq masofa orqali joylashuvni topib bo'lmaydi
-- =====================================================================================================
do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    to_regprocedure('public.search_workers(text,uuid,uuid,uuid,uuid[],integer,integer,work_schedule[],employment_type[],work_format,gender,education_level,text[],uuid[],worker_status[],availability[],boolean,boolean,boolean,uuid,double precision,double precision,double precision,text,integer,integer)'),
    to_regprocedure('public.search_workers_v2(text,uuid,uuid,uuid,uuid[],integer,integer,work_schedule[],employment_type[],work_format,gender,education_level,text[],uuid[],worker_status[],availability[],boolean,boolean,boolean,uuid,double precision,double precision,double precision,uuid,text,integer,integer)')
  ] loop
    if fn is not null then
      perform pg_temp.patch_fn(fn,
        'public.distance_km(p_lat, p_lng, g.lat, g.lng) <= p_max_distance_km)',
        'greatest(2.0, ceil(public.distance_km(p_lat, p_lng, g.lat, g.lng))) <= greatest(2.0, ceil(p_max_distance_km)))');
    end if;
  end loop;
end $$;

-- =====================================================================================================
-- 16. Texnik xizmat (kunlik cron): eski hisoblagichlar, hodisalar, dedupe
-- =====================================================================================================
create or replace function public.security_maintenance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int;
begin
  delete from public.rate_limits where window_start < now() - interval '2 days';
  get diagnostics a = row_count;
  delete from public.security_events where created_at < now() - interval '180 days';
  get diagnostics b = row_count;
  delete from public.security_restrictions where expires_at < now() - interval '30 days';
  get diagnostics c = row_count;
  delete from public.telegram_updates where received_at < now() - interval '3 days';
  get diagnostics d = row_count;
  return jsonb_build_object('rate_limits', a, 'security_events', b, 'restrictions', c, 'telegram_updates', d);
end $$;
revoke execute on function public.security_maintenance() from public, anon, authenticated;
grant execute on function public.security_maintenance() to service_role;

-- Admin: xavfsizlik paneli
create or replace function public.admin_security_overview(p_hours integer default 24)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare h int := least(greatest(coalesce(p_hours, 24), 1), 24 * 30);
begin
  if not public.has_admin_permission('security.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'hours', h,
    'enforce', public.setting_bool('security_restrictions_enforce', false),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', event_type, 'severity', severity, 'count', n) order by n desc)
      from (select event_type, severity, count(*) n from public.security_events
            where created_at > now() - make_interval(hours => h) group by 1, 2 order by 3 desc limit 50) s), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(e) - 'details' order by e.created_at desc)
      from (select id, created_at, event_type, severity, actor_id, route, reason_code, action_taken, rule_version
            from public.security_events order by created_at desc limit 100) e), '[]'::jsonb),
    'restrictions', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (select id, scope, left(subject, 12) as subject, state, reason_code, rule_version, enforced, created_at, expires_at
            from public.security_restrictions where lifted_at is null and expires_at > now()
            order by created_at desc limit 100) r), '[]'::jsonb));
end $$;

create or replace function public.admin_lift_restriction(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r public.security_restrictions;
begin
  if not public.has_admin_permission('security.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.security_restrictions set lifted_at = now(), lifted_by = auth.uid()
  where id = p_id and lifted_at is null returning * into r;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.write_audit('security.restriction_lift', 'security_restriction', p_id::text, to_jsonb(r), null);
  perform public.security_log_event('admin.restriction_lifted', 'low', r.reason_code, auth.uid(), null, null, null, 'lifted', null, r.rule_version,
                                    jsonb_build_object('restriction', p_id, 'scope', r.scope));
end $$;

create or replace function public.admin_set_security_enforce(p_enforce boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('security.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.app_settings (key, value, is_public) values ('security_restrictions_enforce', to_jsonb(coalesce(p_enforce, false)), false)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.write_audit('security.enforce', 'app_setting', 'security_restrictions_enforce', null, jsonb_build_object('enforce', p_enforce));
end $$;
revoke execute on function public.admin_security_overview(integer) from public, anon;
revoke execute on function public.admin_lift_restriction(bigint) from public, anon;
revoke execute on function public.admin_set_security_enforce(boolean) from public, anon;
grant execute on function public.admin_security_overview(integer), public.admin_lift_restriction(bigint), public.admin_set_security_enforce(boolean) to authenticated;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
