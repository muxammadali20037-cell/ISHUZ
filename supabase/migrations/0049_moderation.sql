-- ISH.UZ · 0049 · majburiy moderatsiya: ommaga faqat tekshiruvdan o'tgan, ishga oid e'lonlar chiqadi.
--
-- Har e'lon (vakansiya / ishchi e'loni) kontent versiyasiga ega. Matn, kasb, rasm yoki ish beruvchi nomi o'zgarsa
-- versiya oshadi va holat 'pending' bo'ladi. Qoida / AI / admin qarori aynan tekshirilgan versiyaga bog'lanadi
-- (moderation_checks — to'liq tarix). Ommaga chiqish — vakansiya 'active', ishchi is_public — FAQAT joriy versiya
-- 'allowed' bo'lsa: buni BEFORE trigger kafolatlaydi, shuning uchun frontend yoki to'g'ridan-to'g'ri API orqali
-- chetlab o'tib bo'lmaydi. Moderatsiya ustunlarini oddiy foydalanuvchi o'zgartira olmaydi.
--
-- Ish beruvchi darvozasi: vakansiya ommaga chiqishi uchun ish beruvchi admin tomonidan tasdiqlangan bo'lishi kerak
-- (employer_verification_required). Birinchi vakansiyada so'rov avtomatik yaratiladi.
--
-- moderation_enabled = false — favqulodda o'chirish (va eski SQL testlari): eski xatti-harakat qaytadi.

-- =====================================================================
-- 1. Sozlamalar va yordamchilar
-- =====================================================================
insert into public.app_settings (key, value, is_public) values
  ('moderation_enabled', 'true'::jsonb, false),
  ('moderation_without_ai', '"review"'::jsonb, false),
  ('moderation_ai_daily_limit', '3000'::jsonb, false),
  ('employer_verification_required', 'true'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = p_key), p_default);
$$;

create or replace function public.moderation_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select public.setting_bool('moderation_enabled', true);
$$;

-- Ichki (definer) funksiyalar moderatsiya ustunlarini yozishi uchun tranzaksiya ichidagi belgi
create or replace function public.moderation_internal()
returns boolean language sql stable as $$
  select coalesce(current_setting('ishuz.moderation_internal', true), '') = '1';
$$;

-- =====================================================================
-- 2. Ustunlar
-- =====================================================================
alter table public.vacancies
  add column if not exists moderation_state text not null default 'pending',
  add column if not exists moderation_version int not null default 1,
  add column if not exists moderated_version int,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderation_category text,
  add column if not exists moderation_message text,
  add column if not exists moderation_fields text[] not null default '{}',
  add column if not exists moderation_attempts int not null default 0,
  add column if not exists moderation_next_at timestamptz,
  add column if not exists moderation_requested_at timestamptz,
  add column if not exists moderation_appeal_at timestamptz,
  add column if not exists photo_path text;

alter table public.worker_profiles
  add column if not exists moderation_state text not null default 'pending',
  add column if not exists moderation_version int not null default 1,
  add column if not exists moderated_version int,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderation_category text,
  add column if not exists moderation_message text,
  add column if not exists moderation_fields text[] not null default '{}',
  add column if not exists moderation_attempts int not null default 0,
  add column if not exists moderation_next_at timestamptz,
  add column if not exists moderation_appeal_at timestamptz,
  add column if not exists publish_requested boolean not null default false;

do $$ begin
  alter table public.vacancies add constraint vacancies_moderation_state_check
    check (moderation_state in ('pending', 'allowed', 'rejected', 'review'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.worker_profiles add constraint worker_profiles_moderation_state_check
    check (moderation_state in ('pending', 'allowed', 'rejected', 'review'));
exception when duplicate_object then null; end $$;

create index if not exists vacancies_moderation_queue_idx on public.vacancies (moderation_next_at nulls first)
  where moderation_state = 'pending';
create index if not exists vacancies_moderation_review_idx on public.vacancies (moderated_at desc)
  where moderation_state in ('review', 'rejected');
create index if not exists worker_profiles_moderation_queue_idx on public.worker_profiles (moderation_next_at nulls first)
  where moderation_state = 'pending' and publish_requested;
create index if not exists worker_profiles_moderation_review_idx on public.worker_profiles (moderated_at desc)
  where moderation_state in ('review', 'rejected');

-- Ish beruvchini tasdiqlash ma'lumotlari (nima tekshirilgani badge'da tushuntiriladi)
alter table public.employer_profiles
  add column if not exists verification_checks text[] not null default '{}',
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text,
  add column if not exists identity_number text;

alter table public.verification_requests
  add column if not exists submitted_data jsonb not null default '{}'::jsonb,
  add column if not exists ai_review jsonb;

-- =====================================================================
-- 3. Tekshiruv tarixi (audit): har qaror qaysi versiyaga, kim/nima tomonidan, qanday sabab bilan
-- =====================================================================
create table if not exists public.moderation_checks (
  id             bigserial primary key,
  entity_type    text not null check (entity_type in ('vacancy', 'worker')),
  entity_id      uuid not null,
  version        int not null,
  source         text not null check (source in ('rules', 'ai', 'admin', 'appeal', 'system')),
  decision       text not null check (decision in ('allow', 'reject', 'review', 'error', 'stale', 'appeal', 'recheck')),
  category       text,
  reason_code    text,
  user_message   text,
  flagged_fields text[] not null default '{}',
  signals        text[] not null default '{}',
  model          text,
  latency_ms     int,
  error          text,
  actor_id       uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists moderation_checks_entity_idx on public.moderation_checks (entity_type, entity_id, created_at desc);
create index if not exists moderation_checks_created_idx on public.moderation_checks (created_at desc);
alter table public.moderation_checks enable row level security;
drop policy if exists "moderation_checks_admin" on public.moderation_checks;
create policy "moderation_checks_admin" on public.moderation_checks for select to authenticated
  using (public.has_admin_permission('vacancies.moderate'));
revoke insert, update, delete on public.moderation_checks from anon, authenticated;
grant select on public.moderation_checks to authenticated;

-- =====================================================================
-- 4. Ish beruvchi darvozasi
-- =====================================================================
create or replace function public.employer_can_publish(p_owner uuid, p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.setting_bool('employer_verification_required', true)
    or (
      not exists (select 1 from public.employer_profiles e where e.profile_id = p_owner and e.verification_status = 'suspended')
      and (
        exists (select 1 from public.employer_profiles e where e.profile_id = p_owner and e.verification_status = 'verified')
        or (p_company is not null and exists (
          select 1 from public.companies c where c.id = p_company and c.verification_status = 'verified' and not c.is_blocked))
      )
    );
$$;

-- Birinchi vakansiya tekshiruvdan o'tgach — tasdiqlash so'rovi avtomatik (hujjatsiz; admin kerak bo'lsa so'raydi)
create or replace function public.ensure_employer_verification_request(p_owner uuid, p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.employer_profiles; snapshot jsonb;
begin
  select * into e from public.employer_profiles where profile_id = p_owner;
  if e.id is null or e.verification_status not in ('unverified', 'pending') then return; end if;
  if not exists (select 1 from public.verification_requests r where r.profile_id = p_owner and r.status = 'pending') then
    select jsonb_build_object(
      'employer_type', e.employer_type,
      'name', coalesce((select c.name from public.companies c where c.id = coalesce(p_company, e.company_id)), e.display_name),
      'phone', (select pc.phone from public.profile_contacts pc where pc.profile_id = p_owner),
      'region_id', e.region_id,
      'identity_number', e.identity_number) into snapshot;
    insert into public.verification_requests (profile_id, company_id, type, note, status, submitted_data)
    values (p_owner, coalesce(p_company, e.company_id),
            case when coalesce(p_company, e.company_id) is null then 'identity'::public.verification_type else 'company'::public.verification_type end,
            'auto:first_vacancy', 'pending', snapshot);
  end if;
  if e.verification_status = 'unverified' then
    perform set_config('ishuz.moderation_internal', '1', true);
    update public.employer_profiles set verification_status = 'pending' where profile_id = p_owner;
    perform set_config('ishuz.moderation_internal', '', true);
  end if;
end $$;

-- Tasdiqlash ustunlarini faqat admin / ichki funksiyalar o'zgartiradi
create or replace function public.trg_employer_profile_verification_lock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.moderation_internal() or public.has_admin_permission('employers.verify') then return new; end if;
  if tg_op = 'INSERT' then
    new.verification_checks := '{}'; new.verified_at := null; new.verification_note := null;
  else
    new.verification_checks := old.verification_checks; new.verified_at := old.verified_at;
    new.verification_note := old.verification_note; new.identity_number := old.identity_number;
  end if;
  return new;
end $$;
drop trigger if exists trg_employer_profile_verification_lock on public.employer_profiles;
create trigger trg_employer_profile_verification_lock before insert or update on public.employer_profiles
  for each row execute function public.trg_employer_profile_verification_lock();

-- =====================================================================
-- 5. Himoya triggerlari (BEFORE; nomi alifbo bo'yicha boshqa triggerlardan oldin ishlaydi)
-- =====================================================================
create or replace function public.trg_vacancy_a_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  internal boolean := public.moderation_internal();
  changed boolean := false;
begin
  if not internal then
    if tg_op = 'INSERT' then
      new.moderation_state := 'pending'; new.moderation_version := 1; new.moderated_version := null;
      new.moderated_at := null; new.moderation_category := null; new.moderation_message := null;
      new.moderation_fields := '{}'; new.moderation_attempts := 0; new.moderation_next_at := null;
      new.moderation_requested_at := null; new.moderation_appeal_at := null;
    else
      new.moderation_state := old.moderation_state; new.moderation_version := old.moderation_version;
      new.moderated_version := old.moderated_version; new.moderated_at := old.moderated_at;
      new.moderation_category := old.moderation_category; new.moderation_message := old.moderation_message;
      new.moderation_fields := old.moderation_fields; new.moderation_attempts := old.moderation_attempts;
      new.moderation_next_at := old.moderation_next_at; new.moderation_requested_at := old.moderation_requested_at;
      new.moderation_appeal_at := old.moderation_appeal_at;
    end if;
  end if;
  if new.photo_path is not null and (new.owner_profile_id is null or new.photo_path not like new.owner_profile_id::text || '/%') then
    raise exception 'invalid_photo_path' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    changed := (new.title, new.description, new.custom_profession, new.profession_node_id, new.address, new.photo_path)
      is distinct from (old.title, old.description, old.custom_profession, old.profession_node_id, old.address, old.photo_path);
    if changed then
      new.moderation_version := old.moderation_version + 1;
      new.moderation_state := 'pending';
      new.moderation_attempts := 0;
      new.moderation_next_at := null;
      new.moderation_appeal_at := null;
      if old.status = 'active' then new.moderation_requested_at := now(); end if;
    end if;
  end if;
  -- Asosiy kafolat: ommaga chiqish faqat joriy versiya tasdiqlangan va ish beruvchi ruxsatli bo'lsa
  if public.moderation_enabled() and new.status = 'active'
     and (tg_op = 'INSERT' or old.status <> 'active' or changed) then
    if not (new.moderation_state = 'allowed' and new.moderated_version = new.moderation_version)
       or not public.employer_can_publish(new.owner_profile_id, new.company_id) then
      new.status := 'pending_review';
      new.moderation_requested_at := coalesce(new.moderation_requested_at, now());
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_vacancy_a_moderation on public.vacancies;
create trigger trg_vacancy_a_moderation before insert or update on public.vacancies
  for each row execute function public.trg_vacancy_a_moderation();

create or replace function public.trg_worker_a_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  internal boolean := public.moderation_internal();
  changed boolean := false;
begin
  if not internal then
    if tg_op = 'INSERT' then
      new.moderation_state := 'pending'; new.moderation_version := 1; new.moderated_version := null;
      new.moderated_at := null; new.moderation_category := null; new.moderation_message := null;
      new.moderation_fields := '{}'; new.moderation_attempts := 0; new.moderation_next_at := null;
      new.moderation_appeal_at := null; new.publish_requested := false;
    else
      new.moderation_state := old.moderation_state; new.moderation_version := old.moderation_version;
      new.moderated_version := old.moderated_version; new.moderated_at := old.moderated_at;
      new.moderation_category := old.moderation_category; new.moderation_message := old.moderation_message;
      new.moderation_fields := old.moderation_fields; new.moderation_attempts := old.moderation_attempts;
      new.moderation_next_at := old.moderation_next_at; new.moderation_appeal_at := old.moderation_appeal_at;
      new.publish_requested := old.publish_requested;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    changed := (new.headline, new.about, new.custom_profession, new.profession_node_id)
      is distinct from (old.headline, old.about, old.custom_profession, old.profession_node_id);
    if changed then
      new.moderation_version := old.moderation_version + 1;
      new.moderation_state := 'pending';
      new.moderation_attempts := 0;
      new.moderation_next_at := null;
      new.moderation_appeal_at := null;
    end if;
  end if;
  if not public.moderation_enabled() then
    return new;
  end if;
  if not internal then
    if new.status = 'not_looking' then
      new.publish_requested := false;
    elsif tg_op = 'UPDATE' and old.is_public and not new.is_public and not changed then
      new.publish_requested := false; -- egasi o'zi yashirdi yoki muddati tugadi
    end if;
  end if;
  if new.is_public and (tg_op = 'INSERT' or not old.is_public or changed)
     and not (new.moderation_state = 'allowed' and new.moderated_version = new.moderation_version) then
    new.is_public := false;
    if new.status <> 'not_looking' then new.publish_requested := true; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_worker_a_moderation on public.worker_profiles;
create trigger trg_worker_a_moderation before insert or update on public.worker_profiles
  for each row execute function public.trg_worker_a_moderation();

-- Ism / rasm (profiles) va tajriba matnlari o'zgarsa — ishchi e'loni qayta tekshiriladi
create or replace function public.moderation_bump_worker(p_worker_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.worker_profiles set
    moderation_version = moderation_version + 1, moderation_state = 'pending', moderation_attempts = 0,
    moderation_next_at = null, moderation_appeal_at = null,
    publish_requested = publish_requested or (is_public and status <> 'not_looking'),
    is_public = false
  where (id = p_worker_id or profile_id = p_profile_id);
  perform set_config('ishuz.moderation_internal', '', true);
end $$;

create or replace function public.trg_profile_moderation_bump()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.first_name, new.last_name, new.avatar_url) is distinct from (old.first_name, old.last_name, old.avatar_url) then
    perform public.moderation_bump_worker(null, new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_moderation_bump on public.profiles;
create trigger trg_profiles_moderation_bump after update of first_name, last_name, avatar_url on public.profiles
  for each row execute function public.trg_profile_moderation_bump();

create or replace function public.trg_worker_experience_moderation_bump()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.moderation_bump_worker(coalesce(new.worker_id, old.worker_id), null);
  return null;
end $$;
drop trigger if exists trg_worker_experience_moderation_bump on public.worker_experience;
create trigger trg_worker_experience_moderation_bump after insert or update or delete on public.worker_experience
  for each row execute function public.trg_worker_experience_moderation_bump();

-- Ish beruvchi nomi / logotipi / havolalari o'zgarsa — uning vakansiyalari qayta tekshiriladi
create or replace function public.moderation_bump_vacancies(p_company uuid, p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.vacancies set
    moderation_version = moderation_version + 1, moderation_state = 'pending', moderation_attempts = 0,
    moderation_next_at = null, moderation_appeal_at = null,
    moderation_requested_at = case when status in ('active', 'pending_review') then now() else moderation_requested_at end,
    status = case when status = 'active' then 'pending_review'::public.vacancy_status else status end
  where status in ('active', 'pending_review', 'draft', 'paused')
    and ((p_company is not null and company_id = p_company) or (p_owner is not null and owner_profile_id = p_owner and company_id is null));
  perform set_config('ishuz.moderation_internal', '', true);
end $$;

create or replace function public.trg_company_moderation_bump()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.name, new.logo_url, new.website, new.telegram, new.instagram)
     is distinct from (old.name, old.logo_url, old.website, old.telegram, old.instagram) then
    perform public.moderation_bump_vacancies(new.id, null);
  end if;
  return new;
end $$;
drop trigger if exists trg_company_moderation_bump on public.companies;
create trigger trg_company_moderation_bump after update on public.companies
  for each row execute function public.trg_company_moderation_bump();

create or replace function public.trg_employer_moderation_bump()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.display_name is distinct from old.display_name then
    perform public.moderation_bump_vacancies(null, new.profile_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_employer_moderation_bump on public.employer_profiles;
create trigger trg_employer_moderation_bump after update of display_name on public.employer_profiles
  for each row execute function public.trg_employer_moderation_bump();

-- =====================================================================
-- 6. Faollashtirish (yagona yo'l): tasdiqlangan versiya + ish beruvchi ruxsati + muddat
-- =====================================================================
create or replace function public.moderation_try_activate_vacancy(p_vacancy_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  window_end timestamptz;
  lifetime int := public.setting_int('vacancy_lifetime_days', 10);
begin
  select * into v from public.vacancies where id = p_vacancy_id for update;
  if v.id is null then return 'not_found'; end if;
  if v.status = 'active' then return 'active'; end if;
  if v.status <> 'pending_review' then return v.status::text; end if;
  if public.moderation_enabled() and not (v.moderation_state = 'allowed' and v.moderated_version = v.moderation_version) then
    return case v.moderation_state when 'rejected' then 'rejected' when 'review' then 'review' else 'moderation_pending' end;
  end if;
  if not public.employer_can_publish(v.owner_profile_id, v.company_id) then
    perform public.ensure_employer_verification_request(v.owner_profile_id, v.company_id);
    return 'verification_pending';
  end if;
  if v.published_at is not null and v.expires_at is not null and v.expires_at > now() then
    window_end := v.expires_at; -- tahrirdan keyin qayta tasdiqlandi: muddat uzaymaydi
  else
    -- tekshiruvda kutilgan vaqt muddatdan yeyilmaydi
    window_end := coalesce(v.paid_until, now() + make_interval(days => lifetime))
                  + greatest(interval '0', now() - coalesce(v.moderation_requested_at, now()));
  end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  if window_end <= now() + interval '1 minute' then
    update public.vacancies set status = 'expired' where id = p_vacancy_id;
    perform set_config('ishuz.moderation_internal', '', true);
    return 'expired';
  end if;
  update public.vacancies set
    status = 'active',
    published_at = case when v.published_at is not null and v.expires_at > now() then v.published_at else now() end,
    expires_at = window_end,
    paid_until = greatest(coalesce(paid_until, window_end), window_end),
    moderation_requested_at = null
  where id = p_vacancy_id;
  perform set_config('ishuz.moderation_internal', '', true);
  perform public.refresh_matches_for_vacancy(p_vacancy_id);
  return 'active';
end $$;

create or replace function public.moderation_try_list_worker(p_worker_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare w public.worker_profiles; st text;
begin
  select * into w from public.worker_profiles where id = p_worker_id for update;
  if w.id is null then return 'not_found'; end if;
  if w.is_public then return 'listed'; end if;
  if not w.publish_requested or w.status = 'not_looking' then return 'saved'; end if;
  if public.moderation_enabled() and not (w.moderation_state = 'allowed' and w.moderated_version = w.moderation_version) then
    return case w.moderation_state when 'rejected' then 'rejected' when 'review' then 'review' else 'moderation_pending' end;
  end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  begin
    update public.worker_profiles set is_public = true where id = p_worker_id;
    st := 'listed';
  exception when raise_exception then
    perform set_config('ishuz.moderation_internal', '', true);
    if sqlerrm <> 'listing_payment_required' then raise; end if;
    st := 'payment_required';
  end;
  perform set_config('ishuz.moderation_internal', '', true);
  if st = 'listed' then
    begin
      perform public.refresh_matches_for_worker(p_worker_id);
    exception when others then null;
    end;
  end if;
  return st;
end $$;

-- E'lon joylash: endi har doim avval tekshiruvga tushadi; tasdiqlangan versiya bo'lsa darhol faollashadi
create or replace function public.activate_vacancy_internal(p_vacancy_id uuid, p_window_end timestamptz)
returns public.vacancy_status language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  flags text[];
  manual boolean;
begin
  select * into v from public.vacancies where id = p_vacancy_id for update;
  if v.category_id is null or (v.region_id is null and not v.is_remote) then
    raise exception 'vacancy_incomplete' using errcode = '23514';
  end if;
  if v.status not in ('draft', 'paused', 'closed', 'expired', 'pending_review', 'rejected') then
    raise exception 'invalid_status' using errcode = '23514';
  end if;
  flags := public.vacancy_risk_flags(v.title, v.description);
  manual := public.setting_bool('vacancy_moderation_enabled', false) or v.requires_review;
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.vacancies
  set status = 'pending_review',
      paid_until = p_window_end,
      moderation_requested_at = now(),
      -- rad etilgan e'lon qayta yuborilsa — qayta tekshiruv
      moderation_state = case when moderation_state = 'rejected' then 'pending' else moderation_state end,
      moderation_next_at = null,
      moderation_note = case
        when cardinality(flags) > 0 and (moderation_note is null or moderation_note like 'auto:%') then 'auto:' || array_to_string(flags, ',')
        when cardinality(flags) = 0 and moderation_note like 'auto:%' then null
        else moderation_note end
  where id = p_vacancy_id;
  perform set_config('ishuz.moderation_internal', '', true);
  if not public.moderation_enabled() and (manual or cardinality(flags) > 0) then
    return 'pending_review';
  end if;
  perform public.moderation_try_activate_vacancy(p_vacancy_id);
  return (select status from public.vacancies where id = p_vacancy_id);
end $$;

-- =====================================================================
-- 7. Server (service role) uchun: navbat, tekshiriladigan nusxa, natijani yozish, xato
-- =====================================================================
create or replace function public.moderation_claim(p_limit int default 10)
returns table (o_entity text, o_id uuid, o_version int)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  perform set_config('ishuz.moderation_internal', '1', true);
  for r in
    select v.id, v.moderation_version from public.vacancies v
    where v.moderation_state = 'pending'
      and (v.status = 'pending_review' or (v.status = 'draft' and v.moderation_requested_at is not null))
      and (v.moderation_next_at is null or v.moderation_next_at <= now())
    order by coalesce(v.moderation_requested_at, v.updated_at)
    limit lim
    for update skip locked
  loop
    update public.vacancies set moderation_next_at = now() + interval '3 minutes' where id = r.id;
    o_entity := 'vacancy'; o_id := r.id; o_version := r.moderation_version; n := n + 1;
    return next;
  end loop;
  for r in
    select w.id, w.moderation_version from public.worker_profiles w
    where w.moderation_state = 'pending' and w.publish_requested and w.onboarding_completed_at is not null
      and w.status <> 'not_looking'
      and (w.moderation_next_at is null or w.moderation_next_at <= now())
    order by w.updated_at
    limit greatest(lim - n, 0)
    for update skip locked
  loop
    update public.worker_profiles set moderation_next_at = now() + interval '3 minutes' where id = r.id;
    o_entity := 'worker'; o_id := r.id; o_version := r.moderation_version;
    return next;
  end loop;
  perform set_config('ishuz.moderation_internal', '', true);
end $$;

-- Bitta e'lonni darhol tekshirish (joylash tugmasidan keyin): ijara — cron bilan bir vaqtda ikki marta tekshirilmaydi
create or replace function public.moderation_lease(p_entity text, p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare ver int;
begin
  perform set_config('ishuz.moderation_internal', '1', true);
  if p_entity = 'vacancy' then
    update public.vacancies set moderation_next_at = now() + interval '3 minutes'
    where id = p_id and moderation_state = 'pending' and (moderation_next_at is null or moderation_next_at <= now())
    returning moderation_version into ver;
  elsif p_entity = 'worker' then
    update public.worker_profiles set moderation_next_at = now() + interval '3 minutes'
    where id = p_id and moderation_state = 'pending' and (moderation_next_at is null or moderation_next_at <= now())
    returning moderation_version into ver;
  end if;
  perform set_config('ishuz.moderation_internal', '', true);
  return ver;
end $$;

-- Tekshiriladigan nusxa: aynan shu versiya matnlari, havolalar va rasmlar
create or replace function public.moderation_snapshot(p_entity text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v public.vacancies;
  w public.worker_profiles;
  p public.profiles;
  c public.companies;
  e public.employer_profiles;
  prof text;
  exp text;
begin
  if p_entity = 'vacancy' then
    select * into v from public.vacancies where id = p_id;
    if v.id is null then return null; end if;
    select * into c from public.companies where id = v.company_id;
    select * into e from public.employer_profiles where profile_id = v.owner_profile_id;
    select concat_ws(' / ', n.name_uz, n.name_ru) into prof from public.profession_nodes n where n.id = v.profession_node_id;
    return jsonb_build_object(
      'entity', 'vacancy', 'id', v.id, 'version', v.moderation_version, 'owner', v.owner_profile_id, 'attempts', v.moderation_attempts,
      'locale', (select locale from public.profiles where id = v.owner_profile_id),
      'fields', jsonb_strip_nulls(jsonb_build_object(
        'title', v.title,
        'profession', coalesce(nullif(btrim(v.custom_profession), ''), prof),
        'employer', coalesce(c.name, e.display_name),
        'description', v.description,
        'address', v.address,
        'links', nullif(concat_ws(' ', c.website, c.telegram, c.instagram), ''))),
      'images', jsonb_strip_nulls(jsonb_build_object('photo', v.photo_path, 'logo', c.logo_url)),
      'signals', to_jsonb(public.vacancy_risk_flags(v.title, v.description)));
  elsif p_entity = 'worker' then
    select * into w from public.worker_profiles where id = p_id;
    if w.id is null then return null; end if;
    select * into p from public.profiles where id = w.profile_id;
    select concat_ws(' / ', n.name_uz, n.name_ru) into prof from public.profession_nodes n where n.id = w.profession_node_id;
    select string_agg(concat_ws(' — ', x.position, x.company_name, x.responsibilities), E'\n') into exp
    from (select * from public.worker_experience we where we.worker_id = w.id order by we.started_on desc nulls last limit 10) x;
    return jsonb_build_object(
      'entity', 'worker', 'id', w.id, 'version', w.moderation_version, 'owner', w.profile_id, 'locale', p.locale, 'attempts', w.moderation_attempts,
      'fields', jsonb_strip_nulls(jsonb_build_object(
        'name', nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        'title', w.headline,
        'profession', coalesce(nullif(btrim(w.custom_profession), ''), prof),
        'description', w.about,
        'experience', exp)),
      'images', jsonb_strip_nulls(jsonb_build_object('photo', p.avatar_url)),
      'signals', '[]'::jsonb);
  end if;
  return null;
end $$;

-- Natijani yozish (AI / qoida / admin). Versiya mos kelmasa — natija tashlanadi ('stale').
create or replace function public.moderation_apply(
  p_entity text, p_id uuid, p_version int, p_decision text, p_category text, p_reason_code text,
  p_user_message text, p_flagged_fields text[], p_source text default 'ai', p_model text default null,
  p_latency_ms int default null, p_signals text[] default '{}', p_actor uuid default null, p_notify boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  w public.worker_profiles;
  decision text := p_decision;
  cur_version int;
  owner uuid;
  title text;
  result text;
begin
  if p_decision not in ('allow', 'reject', 'review') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  if p_category is not null and p_category not in ('job_related', 'sexual_services', 'extremism', 'illegal_activity',
       'political_content', 'religious_propaganda', 'spam', 'unrelated', 'uncertain') then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if p_source not in ('rules', 'ai', 'admin', 'system') then raise exception 'invalid_source' using errcode = '22023'; end if;

  if p_entity = 'vacancy' then
    select * into v from public.vacancies where id = p_id for update;
    if v.id is null then return 'not_found'; end if;
    cur_version := v.moderation_version; owner := v.owner_profile_id; title := v.title;
    -- qo'lda tekshiruv talab qilingan bo'lsa (sozlama yoki avval admin yashirgan) — AI ruxsati yetmaydi
    if decision = 'allow' and p_source <> 'admin'
       and (v.requires_review or public.setting_bool('vacancy_moderation_enabled', false)) then
      decision := 'review';
    end if;
  elsif p_entity = 'worker' then
    select * into w from public.worker_profiles where id = p_id for update;
    if w.id is null then return 'not_found'; end if;
    cur_version := w.moderation_version; owner := w.profile_id; title := w.headline;
  else
    raise exception 'invalid_entity' using errcode = '22023';
  end if;

  if cur_version <> p_version then
    insert into public.moderation_checks (entity_type, entity_id, version, source, decision, category, reason_code, model, latency_ms, actor_id)
    values (p_entity, p_id, p_version, p_source, 'stale', p_category, p_reason_code, p_model, p_latency_ms, p_actor);
    return 'stale';
  end if;

  insert into public.moderation_checks (entity_type, entity_id, version, source, decision, category, reason_code,
                                        user_message, flagged_fields, signals, model, latency_ms, actor_id)
  values (p_entity, p_id, p_version, p_source, decision, p_category, left(p_reason_code, 80),
          left(p_user_message, 500), coalesce(p_flagged_fields, '{}'), coalesce(p_signals, '{}'), left(p_model, 80), p_latency_ms, p_actor);

  perform set_config('ishuz.moderation_internal', '1', true);
  if p_entity = 'vacancy' then
    update public.vacancies set
      moderation_state = case decision when 'allow' then 'allowed' when 'reject' then 'rejected' else 'review' end,
      moderated_version = p_version, moderated_at = now(),
      moderation_category = p_category,
      moderation_message = case when decision = 'allow' then null else left(p_user_message, 500) end,
      moderation_fields = case when decision = 'allow' then '{}' else coalesce(p_flagged_fields, '{}') end,
      moderation_attempts = 0, moderation_next_at = null,
      requires_review = case when decision = 'allow' and p_source = 'admin' then false else requires_review end,
      status = case when decision = 'reject' and status in ('pending_review', 'active') then 'rejected'::public.vacancy_status else status end
    where id = p_id;
  else
    update public.worker_profiles set
      moderation_state = case decision when 'allow' then 'allowed' when 'reject' then 'rejected' else 'review' end,
      moderated_version = p_version, moderated_at = now(),
      moderation_category = p_category,
      moderation_message = case when decision = 'allow' then null else left(p_user_message, 500) end,
      moderation_fields = case when decision = 'allow' then '{}' else coalesce(p_flagged_fields, '{}') end,
      moderation_attempts = 0, moderation_next_at = null,
      is_public = case when decision = 'allow' then is_public else false end
    where id = p_id;
  end if;
  perform set_config('ishuz.moderation_internal', '', true);

  if decision = 'allow' then
    result := case when p_entity = 'vacancy' then public.moderation_try_activate_vacancy(p_id) else public.moderation_try_list_worker(p_id) end;
  else
    result := case decision when 'reject' then 'rejected' else 'review' end;
  end if;

  if p_notify then
    perform public.notify(owner, 'system', jsonb_build_object(
      'kind', 'moderation_result', 'entity', p_entity, 'id', p_id, 'title', title, 'state', result,
      'message', case when decision = 'allow' then null else left(p_user_message, 500) end),
      case when p_entity = 'vacancy' and result = 'active' then '/jobs/' || v.slug else '/cabinet' end);
  end if;
  return result;
end $$;

create or replace function public.moderation_fail(p_entity text, p_id uuid, p_version int, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ishuz.moderation_internal', '1', true);
  if p_entity = 'vacancy' then
    update public.vacancies set moderation_attempts = moderation_attempts + 1,
      moderation_next_at = now() + least(interval '60 minutes', make_interval(mins => power(2, least(moderation_attempts, 6))::int))
    where id = p_id and moderation_version = p_version and moderation_state = 'pending';
  elsif p_entity = 'worker' then
    update public.worker_profiles set moderation_attempts = moderation_attempts + 1,
      moderation_next_at = now() + least(interval '60 minutes', make_interval(mins => power(2, least(moderation_attempts, 6))::int))
    where id = p_id and moderation_version = p_version and moderation_state = 'pending';
  end if;
  perform set_config('ishuz.moderation_internal', '', true);
  insert into public.moderation_checks (entity_type, entity_id, version, source, decision, error)
  values (p_entity, p_id, p_version, 'system', 'error', left(p_error, 500));
end $$;

-- =====================================================================
-- 8. Egasi uchun: holat, tekshiruvni so'rash, qayta ko'rib chiqish
-- =====================================================================
create or replace function public.request_vacancy_moderation(p_vacancy_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_vacancy(p_vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.vacancies set moderation_requested_at = coalesce(moderation_requested_at, now())
  where id = p_vacancy_id and moderation_state = 'pending';
  perform set_config('ishuz.moderation_internal', '', true);
end $$;

create or replace function public.my_listing_state(p_entity text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v public.vacancies;
  w public.worker_profiles;
  st text;
begin
  if p_entity = 'vacancy' then
    select * into v from public.vacancies where id = p_id;
    if v.id is null or not (public.can_edit_vacancy(p_id) or public.is_admin()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    st := case
      when v.status = 'active' then 'active'
      when v.status in ('closed', 'expired', 'hidden', 'paused') then v.status::text
      when public.moderation_enabled() and v.moderation_state = 'rejected' then 'rejected'
      when public.moderation_enabled() and v.moderation_state = 'review' then 'review'
      when public.moderation_enabled() and v.moderation_state = 'pending' and (v.status = 'pending_review' or v.moderation_requested_at is not null) then 'moderation_pending'
      when public.moderation_enabled() and v.moderation_state = 'pending' then 'saved'
      when v.status = 'pending_review' and not public.employer_can_publish(v.owner_profile_id, v.company_id) then 'verification_pending'
      when v.status = 'pending_review' then 'review'
      when v.status = 'draft' and public.vacancy_publish_mode(p_id) = 'payment_required' then 'payment_required'
      when v.status = 'rejected' then 'rejected'
      else 'saved' end;
    return jsonb_build_object('state', st, 'message', v.moderation_message, 'fields', to_jsonb(v.moderation_fields),
      'category', v.moderation_category, 'slug', v.slug,
      'can_appeal', v.moderation_state = 'rejected' and v.moderation_appeal_at is null);
  elsif p_entity = 'worker' then
    select * into w from public.worker_profiles where id = p_id;
    if w.id is null or not (w.profile_id = auth.uid() or public.is_admin()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    st := case
      when w.is_public then 'listed'
      when w.status = 'not_looking' then 'closed'
      when public.moderation_enabled() and w.moderation_state = 'rejected' then 'rejected'
      when public.moderation_enabled() and w.moderation_state = 'review' then 'review'
      when public.moderation_enabled() and w.moderation_state = 'pending' and w.publish_requested then 'moderation_pending'
      when (w.publish_requested or not public.moderation_enabled()) and public.listings_paid() then 'payment_required'
      else 'saved' end;
    return jsonb_build_object('state', st, 'message', w.moderation_message, 'fields', to_jsonb(w.moderation_fields),
      'category', w.moderation_category, 'listed_until', w.listed_until,
      'can_appeal', w.moderation_state = 'rejected' and w.moderation_appeal_at is null);
  end if;
  raise exception 'invalid_entity' using errcode = '22023';
end $$;

-- "Qayta ko'rib chiqishni so'rash": xato rad etilgan e'lon admin navbatiga tushadi
create or replace function public.request_moderation_appeal(p_entity text, p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ver int;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.check_rate_limit('appeal:' || me, 5, 86400) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  if p_entity = 'vacancy' then
    if not public.can_edit_vacancy(p_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.vacancies set moderation_state = 'review', moderation_appeal_at = now(),
      status = case when status = 'rejected' then 'pending_review'::public.vacancy_status else status end
    where id = p_id and moderation_state = 'rejected' and moderation_appeal_at is null
    returning moderation_version into ver;
  elsif p_entity = 'worker' then
    update public.worker_profiles set moderation_state = 'review', moderation_appeal_at = now(), publish_requested = true
    where id = p_id and profile_id = me and moderation_state = 'rejected' and moderation_appeal_at is null
    returning moderation_version into ver;
  else
    raise exception 'invalid_entity' using errcode = '22023';
  end if;
  perform set_config('ishuz.moderation_internal', '', true);
  if ver is null then raise exception 'appeal_not_allowed' using errcode = '23514'; end if;
  insert into public.moderation_checks (entity_type, entity_id, version, source, decision, user_message, actor_id)
  values (p_entity, p_id, ver, 'appeal', 'appeal', left(btrim(coalesce(p_note, '')), 500), me);
end $$;

-- =====================================================================
-- 9. Admin: qaror, qayta tekshirish, ish beruvchi holati
-- =====================================================================
create or replace function public.admin_moderation_decide(p_entity text, p_id uuid, p_decision text, p_message text default null, p_category text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  ver int;
  before_row jsonb;
  result text;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_entity = 'vacancy' then
    select moderation_version, jsonb_build_object('state', moderation_state, 'status', status) into ver, before_row from public.vacancies where id = p_id;
  elsif p_entity = 'worker' then
    select moderation_version, jsonb_build_object('state', moderation_state, 'is_public', is_public) into ver, before_row from public.worker_profiles where id = p_id;
  else
    raise exception 'invalid_entity' using errcode = '22023';
  end if;
  if ver is null then raise exception 'not_found' using errcode = 'P0002'; end if;

  if p_decision = 'recheck' then
    perform set_config('ishuz.moderation_internal', '1', true);
    if p_entity = 'vacancy' then
      update public.vacancies set moderation_state = 'pending', moderation_attempts = 0, moderation_next_at = null,
        moderation_requested_at = coalesce(moderation_requested_at, now()),
        status = case when status in ('rejected', 'active') then 'pending_review'::public.vacancy_status else status end
      where id = p_id;
    else
      update public.worker_profiles set moderation_state = 'pending', moderation_attempts = 0, moderation_next_at = null,
        publish_requested = publish_requested or is_public, is_public = false
      where id = p_id;
    end if;
    perform set_config('ishuz.moderation_internal', '', true);
    insert into public.moderation_checks (entity_type, entity_id, version, source, decision, actor_id)
    values (p_entity, p_id, ver, 'admin', 'recheck', auth.uid());
    result := 'moderation_pending';
  elsif p_decision in ('allow', 'reject', 'review') then
    if p_decision = 'reject' and coalesce(btrim(p_message), '') = '' then
      raise exception 'message_required' using errcode = '22023';
    end if;
    if p_entity = 'vacancy' and p_decision = 'allow' then
      -- admin ruxsati: tekshiruv holatiga qaytaramiz, so'ng yagona faollashtirish yo'li ishlaydi
      perform set_config('ishuz.moderation_internal', '1', true);
      update public.vacancies set status = 'pending_review', moderation_requested_at = coalesce(moderation_requested_at, now())
      where id = p_id and status in ('rejected', 'draft', 'pending_review');
      perform set_config('ishuz.moderation_internal', '', true);
    end if;
    result := public.moderation_apply(p_entity, p_id, ver, p_decision,
      coalesce(p_category, case when p_decision = 'allow' then 'job_related' else 'uncertain' end),
      'admin_' || p_decision, p_message, '{}', 'admin', null, null, '{}', auth.uid(), true);
  else
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  perform public.write_audit('moderation.' || p_decision, p_entity, p_id::text, before_row,
    jsonb_build_object('result', result, 'message', p_message, 'category', p_category));
  return result;
end $$;

-- Eski admin tugmalari ham yagona yo'ldan o'tadi (active = admin ruxsati)
create or replace function public.admin_set_vacancy_status(p_vacancy_id uuid, p_status public.vacancy_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare before_row jsonb;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('active', 'hidden', 'rejected', 'closed') then raise exception 'invalid_status' using errcode = '23514'; end if;
  select jsonb_build_object('status', status, 'moderation_note', moderation_note, 'moderation_state', moderation_state)
    into before_row from public.vacancies where id = p_vacancy_id;
  if before_row is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_status = 'active' then
    perform set_config('ishuz.moderation_internal', '1', true);
    update public.vacancies set moderation_note = p_note, requires_review = false,
      status = case when status in ('rejected', 'hidden', 'draft', 'paused', 'closed', 'expired') then 'pending_review'::public.vacancy_status else status end
    where id = p_vacancy_id;
    perform set_config('ishuz.moderation_internal', '', true);
    perform public.moderation_apply('vacancy', p_vacancy_id, (select moderation_version from public.vacancies where id = p_vacancy_id),
      'allow', 'job_related', 'admin_allow', null, '{}', 'admin', null, null, '{}', auth.uid(), true);
  else
    perform set_config('ishuz.moderation_internal', '1', true);
    update public.vacancies set status = p_status, moderation_note = p_note, requires_review = (p_status in ('hidden', 'rejected')),
      moderation_state = case when p_status = 'rejected' then 'rejected' else moderation_state end,
      moderated_version = case when p_status = 'rejected' then moderation_version else moderated_version end,
      moderation_message = case when p_status = 'rejected' then left(p_note, 500) else moderation_message end
    where id = p_vacancy_id;
    perform set_config('ishuz.moderation_internal', '', true);
  end if;
  perform public.write_audit('vacancy.' || p_status, 'vacancy', p_vacancy_id::text, before_row, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

-- Ish beruvchi holati: tasdiqlash / rad etish / to'xtatish. Tasdiqlansa — kutib turgan vakansiyalari chiqadi.
create or replace function public.admin_set_employer_status(p_profile_id uuid, p_status public.verification_status, p_checks text[] default '{}', p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  e public.employer_profiles;
  r record;
  n int := 0;
begin
  if not public.has_admin_permission('employers.verify') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into e from public.employer_profiles where profile_id = p_profile_id for update;
  if e.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_status in ('rejected', 'suspended') and coalesce(btrim(p_note), '') = '' then
    raise exception 'message_required' using errcode = '22023';
  end if;
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.employer_profiles set
    verification_status = p_status,
    verification_checks = case when p_status = 'verified' then coalesce(p_checks, '{}') else verification_checks end,
    verified_at = case when p_status = 'verified' then now() else verified_at end,
    verification_note = p_note
  where profile_id = p_profile_id;
  if e.company_id is not null then
    update public.companies set verification_status = p_status,
      verified_at = case when p_status = 'verified' then now() else verified_at end
    where id = e.company_id;
  end if;
  if p_status in ('verified', 'rejected') then
    update public.verification_requests set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
    where profile_id = p_profile_id and status = 'pending';
  end if;
  if p_status = 'verified' then
    -- to'xtatilganda yashirilgan vakansiyalar qayta tekshiruvga
    update public.vacancies set status = 'pending_review', moderation_note = null, requires_review = false
    where status = 'hidden' and moderation_note = 'employer_suspended'
      and (owner_profile_id = p_profile_id or (e.company_id is not null and company_id = e.company_id));
  elsif p_status = 'suspended' then
    update public.vacancies set status = 'hidden', moderation_note = 'employer_suspended', requires_review = true
    where status in ('active', 'pending_review')
      and (owner_profile_id = p_profile_id or (e.company_id is not null and company_id = e.company_id));
  end if;
  perform set_config('ishuz.moderation_internal', '', true);
  if p_status = 'verified' then
    for r in select id from public.vacancies
             where status = 'pending_review' and (owner_profile_id = p_profile_id or (e.company_id is not null and company_id = e.company_id))
    loop
      if public.moderation_try_activate_vacancy(r.id) = 'active' then n := n + 1; end if;
    end loop;
  end if;
  perform public.notify(p_profile_id, 'system', jsonb_build_object('kind', 'employer_status', 'status', p_status, 'note', p_note, 'activated', n), '/cabinet');
  perform public.write_audit('employer.' || p_status, 'employer_profile', p_profile_id::text,
    jsonb_build_object('status', e.verification_status, 'checks', e.verification_checks),
    jsonb_build_object('status', p_status, 'checks', p_checks, 'note', p_note, 'activated', n));
  return n;
end $$;

-- So'rov orqali (eski admin sahifasi) — ish beruvchi holatini ham yagona funksiya bilan o'zgartiradi
create or replace function public.admin_review_verification(p_request_id uuid, p_status public.verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.verification_requests;
begin
  if not public.has_admin_permission('employers.verify') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('verified', 'rejected') then raise exception 'invalid_status' using errcode = '23514'; end if;
  select * into r from public.verification_requests where id = p_request_id;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.verification_requests set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;
  if exists (select 1 from public.employer_profiles e where e.profile_id = r.profile_id) then
    perform public.admin_set_employer_status(r.profile_id, p_status,
      case when p_status = 'verified' then array_remove(array['phone', 'name', 'region',
        case when r.type in ('company', 'tin') then 'identity' end,
        case when cardinality(r.document_paths) > 0 then 'documents' end], null) else '{}' end,
      coalesce(p_note, case when p_status = 'rejected' then 'rejected' end));
  elsif r.company_id is not null then
    update public.companies set verification_status = p_status, verified_at = case when p_status = 'verified' then now() end where id = r.company_id;
  end if;
  perform public.write_audit('verification.' || p_status, 'verification_request', p_request_id::text, to_jsonb(r), jsonb_build_object('status', p_status, 'note', p_note));
end $$;

-- Ish beruvchi o'zi tasdiqlash ma'lumotlarini yuboradi (jismoniy shaxsdan yuridik hujjat talab qilinmaydi)
create or replace function public.submit_employer_verification(p_identity_number text default null, p_note text default null, p_document_paths text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.employer_profiles;
  idn text := nullif(regexp_replace(coalesce(p_identity_number, ''), '\D', '', 'g'), '');
  docs text[] := coalesce(p_document_paths, '{}');
  snapshot jsonb;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.check_rate_limit('verify:' || me, 5, 86400) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  select * into e from public.employer_profiles where profile_id = me;
  if e.id is null then raise exception 'employer_profile_required' using errcode = '23514'; end if;
  if e.verification_status in ('verified', 'suspended') then raise exception 'invalid_status' using errcode = '23514'; end if;
  if idn is not null and char_length(idn) not in (9, 14) then raise exception 'invalid_identity_number' using errcode = '22023'; end if;
  if e.employer_type in ('company', 'government') and idn is null then raise exception 'identity_number_required' using errcode = '22023'; end if;
  if cardinality(docs) > 5 or exists (select 1 from unnest(docs) d where d not like me::text || '/%') then
    raise exception 'invalid_documents' using errcode = '22023';
  end if;
  snapshot := jsonb_build_object(
    'employer_type', e.employer_type,
    'name', coalesce((select c.name from public.companies c where c.id = e.company_id), e.display_name),
    'phone', (select pc.phone from public.profile_contacts pc where pc.profile_id = me),
    'region_id', e.region_id, 'identity_number', idn);
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.employer_profiles set identity_number = idn,
    verification_status = case when verification_status in ('unverified', 'rejected') then 'pending' else verification_status end
  where profile_id = me;
  perform set_config('ishuz.moderation_internal', '', true);
  update public.verification_requests set status = 'rejected', review_note = 'superseded', reviewed_at = now()
  where profile_id = me and status = 'pending';
  insert into public.verification_requests (profile_id, company_id, type, document_paths, note, status, submitted_data)
  values (me, e.company_id,
          case when e.company_id is not null then 'company'::public.verification_type
               when cardinality(docs) > 0 then 'documents'::public.verification_type else 'identity'::public.verification_type end,
          docs, left(btrim(coalesce(p_note, '')), 1000), 'pending', snapshot);
end $$;

-- =====================================================================
-- 10. Mavjud e'lonlar: ommaviy bo'lganlari ham qayta tekshiriladi (natija chiqquncha yashiriladi)
-- =====================================================================
do $$
begin
  perform set_config('ishuz.moderation_internal', '1', true);
  update public.vacancies set moderation_requested_at = now(), status = 'pending_review'
  where status = 'active';
  update public.vacancies set moderation_requested_at = now() where status = 'pending_review' and moderation_requested_at is null;
  update public.worker_profiles set publish_requested = true, is_public = false
  where is_public and onboarding_completed_at is not null and status <> 'not_looking';
  perform set_config('ishuz.moderation_internal', '', true);
end $$;

-- =====================================================================
-- 11. Ish joyi surati (vakansiya) — ochiq bucket, faqat egasining papkasi
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vacancy-photos', 'vacancy-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_photos_write') then
    create policy "vacancy_photos_write" on storage.objects for insert to authenticated
      with check (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_photos_update') then
    create policy "vacancy_photos_update" on storage.objects for update to authenticated
      using (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_photos_delete') then
    create policy "vacancy_photos_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- =====================================================================
-- 12. Ruxsatlar
-- =====================================================================
revoke execute on function public.moderation_claim(int), public.moderation_lease(text, uuid), public.moderation_snapshot(text, uuid),
  public.moderation_apply(text, uuid, int, text, text, text, text, text[], text, text, int, text[], uuid, boolean),
  public.moderation_fail(text, uuid, int, text), public.moderation_try_activate_vacancy(uuid), public.moderation_try_list_worker(uuid),
  public.moderation_bump_worker(uuid, uuid), public.moderation_bump_vacancies(uuid, uuid),
  public.ensure_employer_verification_request(uuid, uuid), public.activate_vacancy_internal(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.moderation_claim(int), public.moderation_lease(text, uuid), public.moderation_snapshot(text, uuid),
  public.moderation_apply(text, uuid, int, text, text, text, text, text[], text, text, int, text[], uuid, boolean),
  public.moderation_fail(text, uuid, int, text) to service_role;
revoke execute on function public.my_listing_state(text, uuid), public.request_moderation_appeal(text, uuid, text),
  public.request_vacancy_moderation(uuid), public.admin_moderation_decide(text, uuid, text, text, text),
  public.admin_set_employer_status(uuid, public.verification_status, text[], text), public.submit_employer_verification(text, text, text[])
  from public, anon;
grant execute on function public.my_listing_state(text, uuid), public.request_moderation_appeal(text, uuid, text),
  public.request_vacancy_moderation(uuid), public.admin_moderation_decide(text, uuid, text, text, text),
  public.admin_set_employer_status(uuid, public.verification_status, text[], text), public.submit_employer_verification(text, text, text[])
  to authenticated;
grant execute on function public.employer_can_publish(uuid, uuid), public.moderation_enabled(), public.setting_bool(text, boolean) to authenticated, anon;

-- =====================================================================
-- 13. Sodda e'lon berish RPC'lari (0047) — holat endi yagona my_listing_state dan
-- =====================================================================
create or replace function public.save_simple_worker_listing(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  v_first text := btrim(coalesce(p->>'first_name', ''));
  v_last text := btrim(coalesce(p->>'last_name', ''));
  v_about text := btrim(coalesce(p->>'about', ''));
  v_node uuid := nullif(p->>'profession_node_id', '')::uuid;
  v_region uuid := nullif(p->>'region_id', '')::uuid;
  v_district uuid := nullif(p->>'district_id', '')::uuid;
  v_remote boolean := coalesce((p->>'remote')::boolean, false);
  v_exp public.experience_level := coalesce(nullif(p->>'experience_level', ''), 'none')::public.experience_level;
  v_salary int := nullif(p->>'salary_expected', '')::int;
  v_schedule public.work_schedule := nullif(p->>'schedule', '')::public.work_schedule;
  v_show_phone boolean := coalesce((p->>'show_phone')::boolean, false);
  v_headline text;
  node public.profession_nodes;
  wid uuid;
  w public.worker_profiles;
  st text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if char_length(v_first) < 2 or char_length(v_first) > 60 then raise exception 'invalid_first_name' using errcode = '22023'; end if;
  if char_length(v_last) > 60 then raise exception 'invalid_last_name' using errcode = '22023'; end if;
  if char_length(v_about) < 10 or char_length(v_about) > 1000 then raise exception 'invalid_about' using errcode = '22023'; end if;
  select * into node from public.profession_nodes where id = v_node and is_active and selectable;
  if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
  if v_region is null then raise exception 'invalid_region' using errcode = '22023'; end if;
  if v_district is not null and not exists (select 1 from public.districts d where d.id = v_district and d.region_id = v_region) then
    raise exception 'district_region_mismatch' using errcode = '23514';
  end if;
  if v_salary is not null and (v_salary < 0 or v_salary > 1000000000) then raise exception 'invalid_salary' using errcode = '22023'; end if;
  if not exists (select 1 from public.profile_contacts c where c.profile_id = me and c.phone is not null) then
    raise exception 'phone_required' using errcode = '23514';
  end if;
  v_headline := left(coalesce(nullif(btrim(p->>'headline'), ''), node.name_uz), 80);

  update public.profiles set first_name = v_first, last_name = v_last, active_role = coalesce(active_role, 'worker') where id = me;

  select id into wid from public.worker_profiles where profile_id = me;
  if wid is null then
    insert into public.worker_profiles (profile_id, is_public) values (me, false) returning id into wid;
  end if;

  update public.worker_profiles set
    profession_node_id = node.id,
    custom_profession = null,
    headline = v_headline,
    about = v_about,
    region_id = v_region,
    district_id = v_district,
    remote_preference = case when v_remote then 'yes'::public.remote_preference else 'no'::public.remote_preference end,
    experience_level = v_exp,
    status = 'active',
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    onboarding_step = 9
  where id = wid;

  -- ish joyi tumanlari: tanlangan tuman qo'shiladi, boshqa viloyatdagilari olib tashlanadi
  delete from public.worker_locations wl using public.districts d
   where wl.worker_id = wid and d.id = wl.district_id and d.region_id is distinct from v_region;
  if v_district is not null then
    insert into public.worker_locations (worker_id, district_id) values (wid, v_district) on conflict do nothing;
  end if;

  insert into public.worker_preferences (worker_id, salary_expected, schedules)
  values (wid, v_salary, case when v_schedule is null then '{}'::public.work_schedule[] else array[v_schedule] end)
  on conflict (worker_id) do update set
    salary_expected = excluded.salary_expected,
    schedules = case when v_schedule is null then public.worker_preferences.schedules else excluded.schedules end;

  -- telefonni e'londa ko'rsatish roziligi: rozilik → hammaga; rozilik olib tashlansa → faqat ariza yuborgan ish beruvchiga
  update public.profile_contacts set phone_visibility = case
      when v_show_phone then 'everyone'::public.phone_visibility
      when phone_visibility = 'everyone' then 'applicants'::public.phone_visibility
      else phone_visibility end
  where profile_id = me;

  -- qidiruvga chiqarish so'rovi: moderatsiya (va pullik rejimda to'lov) o'tmaguncha trigger ommaga chiqarmaydi —
  -- ma'lumotlar saqlanib qoladi, e'lon navbatga tushadi
  begin
    update public.worker_profiles set is_public = true where id = wid;
  exception when raise_exception then
    if sqlerrm <> 'listing_payment_required' then raise; end if;
  end;

  begin
    perform public.refresh_worker_completeness(wid);
    perform public.refresh_matches_for_worker(wid);
  exception when others then
    null; -- yordamchi hisoblar; e'lonni saqlashga xalaqit bermasin
  end;

  select * into w from public.worker_profiles where id = wid;
  -- haqiqiy holat: joylandi / tekshiruvda / rad etildi / to'lov kerak / saqlandi
  st := public.my_listing_state('worker', wid) ->> 'state';
  return jsonb_build_object('worker_id', wid, 'state', st, 'listed_until', w.listed_until);
end $$;

create or replace function public.save_simple_vacancy(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  v_type public.employer_type := coalesce(nullif(p->>'employer_type', ''), 'company')::public.employer_type;
  v_org text := btrim(coalesce(p->>'org_name', ''));
  v_phone text := btrim(coalesce(p->>'contact_phone', ''));
  v_show boolean := coalesce((p->>'show_phone')::boolean, false);
  v_desc text := btrim(coalesce(p->>'description', ''));
  v_node uuid := nullif(p->>'profession_node_id', '')::uuid;
  v_title text := btrim(coalesce(p->>'title', ''));
  v_region uuid := nullif(p->>'region_id', '')::uuid;
  v_district uuid := nullif(p->>'district_id', '')::uuid;
  v_remote boolean := coalesce((p->>'remote')::boolean, false);
  v_negotiable boolean := coalesce((p->>'salary_negotiable')::boolean, false);
  v_from int := nullif(p->>'salary_from', '')::int;
  v_to int := nullif(p->>'salary_to', '')::int;
  v_schedule public.work_schedule := coalesce(nullif(p->>'schedule', ''), 'negotiable')::public.work_schedule;
  v_exp int := coalesce(nullif(p->>'experience_min_months', '')::int, 0);
  v_id uuid := nullif(p->>'vacancy_id', '')::uuid;
  v_ref uuid := nullif(p->>'client_ref', '')::uuid;
  v_photo text := nullif(btrim(coalesce(p->>'photo_path', '')), '');
  is_org boolean;
  node public.profession_nodes;
  ep public.employer_profiles;
  cid uuid;
  v public.vacancies;
  st text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if v_type not in ('company', 'government', 'individual_entrepreneur', 'person') then raise exception 'invalid_employer_type' using errcode = '22023'; end if;
  is_org := v_type <> 'person';
  if char_length(v_org) < 2 or char_length(v_org) > 120 then raise exception 'invalid_org_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+998[0-9]{9}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 4000 then raise exception 'invalid_description' using errcode = '22023'; end if;
  select * into node from public.profession_nodes where id = v_node and is_active and selectable;
  if node.id is null then raise exception 'invalid_profession' using errcode = '22023'; end if;
  v_title := left(coalesce(nullif(v_title, ''), node.name_uz), 120);
  if char_length(v_title) < 2 then raise exception 'invalid_title' using errcode = '22023'; end if;
  if v_remote then
    v_district := null;
  elsif v_region is null then
    raise exception 'invalid_region' using errcode = '22023';
  end if;
  if v_district is not null and not exists (select 1 from public.districts d where d.id = v_district and d.region_id = v_region) then
    raise exception 'district_region_mismatch' using errcode = '23514';
  end if;
  if v_negotiable then
    v_from := null; v_to := null;
  elsif v_from is null and v_to is null then
    raise exception 'salary_required' using errcode = '22023';
  end if;
  if (v_from is not null and (v_from < 0 or v_from > 1000000000)) or (v_to is not null and (v_to < 0 or v_to > 1000000000))
     or (v_from is not null and v_to is not null and v_to < v_from) then
    raise exception 'invalid_salary' using errcode = '22023';
  end if;
  if v_exp < 0 or v_exp > 600 then raise exception 'invalid_experience' using errcode = '22023'; end if;

  -- ish beruvchi profili (bo'lmasa yaratiladi; jismoniy shaxsdan rekvizit so'ralmaydi)
  select * into ep from public.employer_profiles where profile_id = me;
  if ep.profile_id is null then
    insert into public.employer_profiles (profile_id, employer_type, display_name, contact_phone, region_id, district_id)
    values (me, v_type, v_org, v_phone, v_region, v_district);
    select * into ep from public.employer_profiles where profile_id = me;
  end if;
  cid := ep.company_id;
  if is_org and cid is null then
    insert into public.companies (name, slug, created_by, is_government, phone, region_id, district_id)
    values (v_org, '', me, v_type = 'government', v_phone, v_region, v_district)
    returning id into cid;
  elsif is_org then
    -- tashkilot nomi o'zgargan bo'lsa (faqat tashkilot admini o'zgartira oladi; bo'lmasa eski nom qoladi)
    begin
      update public.companies set name = v_org where id = cid and name is distinct from v_org;
    exception when others then null;
    end;
  end if;
  update public.employer_profiles set
    employer_type = v_type,
    display_name = case when is_org then coalesce(display_name, v_org) else v_org end,
    contact_phone = coalesce(contact_phone, v_phone),
    company_id = coalesce(company_id, cid),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where profile_id = me;
  -- "O'zim uchun": kiritilgan ism profilda bo'lmasa — profilga ham yoziladi (hisob nomsiz qolmasin)
  update public.profiles set
    active_role = coalesce(active_role, 'employer'),
    first_name = case when not is_org and btrim(coalesce(first_name, '')) = '' then left(v_org, 60) else first_name end
  where id = me;

  -- vakansiya: tahrirlash (id) yoki qoralama UUID bo'yicha topiladi — takroriy bosish yangi e'lon yaratmaydi
  if v_id is not null then
    select * into v from public.vacancies where id = v_id;
    if v.id is null or not public.can_edit_vacancy(v.id) then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif v_ref is not null then
    select * into v from public.vacancies where owner_profile_id = me and client_ref = v_ref;
  end if;

  if v.id is null then
    insert into public.vacancies (owner_profile_id, company_id, title, slug, profession_node_id, description, region_id, district_id,
                                  is_remote, salary_from, salary_to, salary_negotiable, salary_type, schedule, experience_min_months,
                                  is_government, client_ref, photo_path)
    values (me, case when is_org then cid end, v_title, '', node.id, v_desc, case when v_remote then null else v_region end, v_district,
            v_remote, v_from, v_to, v_negotiable, 'monthly', v_schedule, v_exp, v_type = 'government', v_ref, v_photo)
    returning * into v;
  else
    if v.status = 'hidden' then raise exception 'vacancy_locked' using errcode = '42501'; end if;
    update public.vacancies set
      title = v_title, profession_node_id = node.id, custom_profession = null, description = v_desc,
      region_id = case when v_remote then null else v_region end, district_id = v_district, is_remote = v_remote,
      salary_from = v_from, salary_to = v_to, salary_negotiable = v_negotiable,
      schedule = v_schedule, experience_min_months = v_exp, photo_path = v_photo
    where id = v.id
    returning * into v;
  end if;

  insert into public.vacancy_contacts (vacancy_id, phone, show_phone) values (v.id, v_phone, v_show)
  on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = excluded.show_phone, updated_at = now();

  -- moderatsiya so'raladi (to'lov kutilayotgan qoralama ham oldindan tekshiriladi)
  perform public.request_vacancy_moderation(v.id);

  -- joylash: faol e'lon tahrirlansa holati saqlanadi; aks holda publish_vacancy (to'lov/tekshiruv qoidalari bilan)
  if v.status <> 'active' then
    begin
      perform public.publish_vacancy(v.id);
    exception when others then
      if sqlerrm = 'payment_required' then st := 'payment_required'; else raise; end if;
    end;
  end if;

  select * into v from public.vacancies where id = v.id;
  st := coalesce(st, public.my_listing_state('vacancy', v.id) ->> 'state');
  return jsonb_build_object('vacancy_id', v.id, 'slug', v.slug, 'state', st);
end $$;

-- Kabinet: egasining barcha e'lonlari holati bitta so'rovda
create or replace function public.my_listing_states()
returns table (entity text, id uuid, info jsonb)
language sql stable security definer set search_path = public as $$
  select 'worker'::text, w.id, public.my_listing_state('worker', w.id)
  from public.worker_profiles w where w.profile_id = auth.uid() and w.onboarding_completed_at is not null
  union all
  select 'vacancy'::text, v.id, public.my_listing_state('vacancy', v.id)
  from public.vacancies v where v.owner_profile_id = auth.uid()
  order by 1;
$$;
revoke execute on function public.my_listing_states() from public, anon;
grant execute on function public.my_listing_states() to authenticated;
