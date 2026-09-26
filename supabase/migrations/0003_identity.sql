-- ISH.UZ · 0003 · identitet: profiles, kontaktlar, rollar, telegram, admin, audit

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  first_name      text not null default '',
  last_name       text not null default '',
  avatar_url      text,
  birth_date      date,
  gender          public.gender,
  locale          public.app_locale not null default 'uz',
  active_role     public.app_role,
  is_blocked      boolean not null default false,
  blocked_reason  text,
  blocked_at      timestamptz,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_birth_date_check check (birth_date is null or (birth_date > current_date - interval '90 years' and birth_date < current_date - interval '14 years'))
);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Maxfiy kontaktlar alohida jadvalda: RLS bilan qat'iy himoyalanadi
create table public.profile_contacts (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  phone              text unique,                       -- E.164: +998901234567
  phone_verified_at  timestamptz,
  email              text,
  telegram_username  text,
  phone_visibility   public.phone_visibility not null default 'applicants',
  updated_at         timestamptz not null default now(),
  constraint profile_contacts_phone_format check (phone is null or phone ~ '^\+998[0-9]{9}$')
);
create trigger trg_profile_contacts_updated before update on public.profile_contacts for each row execute function public.set_updated_at();

create table public.user_roles (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  primary key (profile_id, role)
);

create table public.telegram_accounts (
  telegram_user_id  bigint primary key,
  profile_id        uuid not null unique references public.profiles(id) on delete cascade,
  username          text,
  first_name        text,
  last_name         text,
  photo_url         text,
  language_code     text,
  bot_started       boolean not null default false,  -- bot unga xabar yubora oladimi
  linked_at         timestamptz not null default now(),
  last_seen_at      timestamptz
);

create table public.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  platform      public.device_platform not null,
  token         text not null unique,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index idx_device_tokens_profile on public.device_tokens(profile_id);

-- Foydalanuvchi o'z telefonini ko'rishga ruxsat bergan profillar ("Men ruxsat berganda")
create table public.contact_grants (
  owner_profile_id    uuid not null references public.profiles(id) on delete cascade,
  grantee_profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (owner_profile_id, grantee_profile_id),
  check (owner_profile_id <> grantee_profile_id)
);

create table public.admin_users (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  role         public.admin_role not null default 'support',
  permissions  text[] not null default '{}',   -- qo'shimcha ruxsatlar, masalan '{users.block,vacancies.moderate}'
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_admin_users_updated before update on public.admin_users for each row execute function public.set_updated_at();

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,             -- 'user.block', 'vacancy.hide', 'employer.verify' ...
  target_type   text not null,
  target_id     text,
  before_data   jsonb,
  after_data    jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index idx_audit_logs_actor on public.audit_logs(actor_id, created_at desc);
create index idx_audit_logs_target on public.audit_logs(target_type, target_id);

-- Oddiy rate limiting: kalit + oyna
create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (key, window_start)
);

alter table public.skills add constraint skills_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- ---------- yordamchi funksiyalar ----------

create or replace function public.current_profile_id()
returns uuid language sql stable as $$
  select auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.profile_id = auth.uid() and a.is_active);
$$;

-- Ruxsat: super_admin hammasini, admin — moderatorlik + verifikatsiya + foydalanuvchilar,
-- moderator — kontent moderatsiyasi, support — faqat o'qish + hisobotlar.
create or replace function public.has_admin_permission(perm text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  a public.admin_users;
begin
  select * into a from public.admin_users where profile_id = auth.uid() and is_active;
  if not found then return false; end if;
  if a.role = 'super_admin' then return true; end if;
  if perm = any(a.permissions) then return true; end if;
  return case a.role
    when 'admin' then perm in (
      'users.view', 'users.block', 'workers.view', 'employers.view', 'employers.verify',
      'vacancies.view', 'vacancies.moderate', 'categories.manage', 'skills.manage', 'regions.manage',
      'reports.view', 'reports.resolve', 'reviews.moderate', 'notifications.broadcast', 'analytics.view', 'audit.view')
    when 'moderator' then perm in (
      'users.view', 'workers.view', 'employers.view', 'vacancies.view', 'vacancies.moderate',
      'reports.view', 'reports.resolve', 'reviews.moderate', 'analytics.view')
    when 'support' then perm in ('users.view', 'workers.view', 'employers.view', 'vacancies.view', 'reports.view', 'analytics.view')
    else false
  end;
end $$;

create or replace function public.is_blocked(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_blocked from public.profiles where id = pid), false);
$$;

-- Rate limit: key uchun window_seconds ichida limit dan oshmaganini tekshiradi va sanaydi
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, ws, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  -- eski oynalarni vaqti-vaqti bilan tozalash
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_limit;
end $$;

-- Audit log yozish (faqat security definer funksiyalar ichidan chaqiriladi)
create or replace function public.write_audit(p_action text, p_target_type text, p_target_id text, p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, before_data, after_data)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_before, p_after);
$$;

-- auth.users yaratilganda profil + kontakt yozuvlarini ochish
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, first_name, last_name, avatar_url, locale)
  values (
    new.id,
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    meta->>'avatar_url',
    case when meta->>'locale' in ('uz', 'ru', 'en') then (meta->>'locale')::public.app_locale else 'uz' end
  )
  on conflict (id) do nothing;

  insert into public.profile_contacts (profile_id, phone, phone_verified_at, email)
  values (
    new.id,
    case when new.phone ~ '^\+?998[0-9]{9}$' then '+' || ltrim(new.phone, '+') else null end,
    case when new.phone_confirmed_at is not null then new.phone_confirmed_at else null end,
    case when new.email is not null and new.email not like '%@telegram.ishuz.local' then lower(new.email) else null end
  )
  on conflict (profile_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Telefon tasdiqlanganda profile_contacts ni yangilash
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is distinct from old.phone or new.phone_confirmed_at is distinct from old.phone_confirmed_at then
    update public.profile_contacts
    set phone = case when new.phone ~ '^\+?998[0-9]{9}$' then '+' || ltrim(new.phone, '+') else phone end,
        phone_verified_at = coalesce(new.phone_confirmed_at, phone_verified_at)
    where profile_id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();
