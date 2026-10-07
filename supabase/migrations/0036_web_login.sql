-- ISH BERUVCHI · 0036 · Brauzerda kodsiz kirish: "Telegram orqali kirish" → bot "Tasdiqlaysizmi?" → brauzer o'zi kiradi.
-- Token faqat hash ko'rinishida saqlanadi, 10 daqiqa amal qiladi, bir marta ishlatiladi. Jadval faqat server (service role) uchun.
create table if not exists public.web_login_requests (
  id                uuid primary key default gen_random_uuid(),
  token_hash        text not null unique,
  user_agent        text check (user_agent is null or length(user_agent) <= 300),
  telegram_user_id  bigint,
  tg_user           jsonb,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '10 minutes',
  confirmed_at      timestamptz,
  consumed_at       timestamptz
);
create index if not exists idx_web_login_requests_expires on public.web_login_requests(expires_at);
alter table public.web_login_requests enable row level security;
revoke all on public.web_login_requests from anon, authenticated;
