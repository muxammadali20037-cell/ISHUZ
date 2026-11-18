-- 0085 · Telegram orqali kodsiz kirish (brauzerda)
--
--   Ega (2026-11-18): "Telegram orqali kirishda bossa Telegramga olib kirsin, kod terib yurmasin — shunday kirib ketsin".
--   Oqim: sayt bir martalik so'rov yaratadi → Telegram bot `/start w_<token>` bilan ochiladi → bot "✅ Kirish" tugmasini
--   ko'rsatadi (qaysi brauzer so'rayotgani yozilgan) → bosilganda so'rov tasdiqlanadi → brauzer (o'sha cookie bilan)
--   holatni so'raydi va sessiya ochiladi. Kod yozilmaydi.
--
--   Xavfsizlik:
--     · token va brauzer kaliti faqat xesh ko'rinishida saqlanadi; token — Telegram havolasida, brauzer kaliti — httpOnly
--       cookie'da (havola boshqaga o'tib qolsa ham, sessiyani faqat so'rovni boshlagan brauzer oladi);
--     · 5 daqiqa amal qiladi, bir marta tasdiqlanadi va bir marta ishlatiladi (atomik);
--     · jadvalga faqat server kaliti (security definer funksiyalar) kiradi: anon/authenticated — yo'q.
--
--   Faqat yangi jadval va funksiyalar. Takror ishga tushirish xavfsiz.
--   Qaytarish (rollback): supabase/rollbacks/0085_telegram_web_login.down.sql

create table if not exists public.telegram_web_logins (
  id               uuid primary key default gen_random_uuid(),
  token_hash       text not null unique,
  browser_hash     text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '5 minutes',
  telegram_user_id bigint,
  profile_id       uuid references public.profiles(id) on delete cascade,
  confirmed_at     timestamptz,
  consumed_at      timestamptz,
  constraint telegram_web_logins_hash_format check (token_hash ~ '^[0-9a-f]{64}$' and browser_hash ~ '^[0-9a-f]{64}$'),
  constraint telegram_web_logins_ua_len check (user_agent is null or length(user_agent) <= 120)
);
create index if not exists idx_telegram_web_logins_expires on public.telegram_web_logins (expires_at);
alter table public.telegram_web_logins enable row level security;
-- siyosat yo'q: faqat pastdagi funksiyalar (server kaliti)
revoke all on public.telegram_web_logins from public, anon, authenticated;
grant all on public.telegram_web_logins to service_role;

-- 1. so'rov yaratish (sayt). Eskilar (1 kundan eski) shu yerda tozalanadi.
create or replace function public.telegram_web_login_create(p_token_hash text, p_browser_hash text, p_user_agent text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  delete from public.telegram_web_logins where expires_at < now() - interval '1 day';
  insert into public.telegram_web_logins (token_hash, browser_hash, user_agent)
  values (p_token_hash, p_browser_hash, left(nullif(trim(p_user_agent), ''), 120))
  returning id into v_id;
  return v_id;
end $$;

-- 2. bot: token bo'yicha so'rovni topish (tasdiqlash tugmasi uchun). status: ok | expired | used | invalid
create or replace function public.telegram_web_login_preview(p_token_hash text)
returns table (id uuid, status text, user_agent text)
language sql stable security definer set search_path = public as $$
  select l.id,
         case when l.confirmed_at is not null or l.consumed_at is not null then 'used'
              when l.expires_at <= now() then 'expired'
              else 'ok' end,
         l.user_agent
    from public.telegram_web_logins l
   where l.token_hash = p_token_hash
  union all
  select null::uuid, 'invalid', null::text
   where not exists (select 1 from public.telegram_web_logins where token_hash = p_token_hash);
$$;

-- 3. bot: "✅ Kirish" bosildi — bir marta, muddati ichida. status: ok | expired | used | invalid
create or replace function public.telegram_web_login_confirm(p_id uuid, p_telegram_user_id bigint, p_profile_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare r public.telegram_web_logins;
begin
  update public.telegram_web_logins
     set telegram_user_id = p_telegram_user_id, profile_id = p_profile_id, confirmed_at = now()
   where id = p_id and confirmed_at is null and consumed_at is null and expires_at > now()
  returning * into r;
  if found then return 'ok'; end if;
  select * into r from public.telegram_web_logins where id = p_id;
  if not found then return 'invalid'; end if;
  if r.confirmed_at is not null or r.consumed_at is not null then return 'used'; end if;
  return 'expired';
end $$;

-- 4. brauzer: holat. Tasdiqlangan bo'lsa — atomik ishlatiladi va profil qaytadi (faqat o'sha brauzer kaliti bilan).
--    status: pending | ok | expired | used | invalid
create or replace function public.telegram_web_login_consume(p_id uuid, p_browser_hash text)
returns table (status text, profile_id uuid, telegram_user_id bigint)
language plpgsql volatile security definer set search_path = public as $$
declare r public.telegram_web_logins;
begin
  select * into r from public.telegram_web_logins l where l.id = p_id and l.browser_hash = p_browser_hash;
  if not found then return query select 'invalid'::text, null::uuid, null::bigint; return; end if;
  if r.consumed_at is not null then return query select 'used'::text, null::uuid, null::bigint; return; end if;
  if r.confirmed_at is null then
    if r.expires_at <= now() then return query select 'expired'::text, null::uuid, null::bigint; return; end if;
    return query select 'pending'::text, null::uuid, null::bigint; return;
  end if;
  update public.telegram_web_logins l set consumed_at = now()
   where l.id = p_id and l.consumed_at is null
  returning * into r;
  if not found then return query select 'used'::text, null::uuid, null::bigint; return; end if;
  return query select 'ok'::text, r.profile_id, r.telegram_user_id;
end $$;

revoke execute on function public.telegram_web_login_create(text, text, text) from public, anon, authenticated;
revoke execute on function public.telegram_web_login_preview(text) from public, anon, authenticated;
revoke execute on function public.telegram_web_login_confirm(uuid, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.telegram_web_login_consume(uuid, text) from public, anon, authenticated;
grant execute on function public.telegram_web_login_create(text, text, text) to service_role;
grant execute on function public.telegram_web_login_preview(text) to service_role;
grant execute on function public.telegram_web_login_confirm(uuid, bigint, uuid) to service_role;
grant execute on function public.telegram_web_login_consume(uuid, text) to service_role;
