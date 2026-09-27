-- ISH.UZ · 0016 · Saytda telefon raqam bilan kirish, kod Telegram bot orqali (SMS o'rniga)
-- Oqim: foydalanuvchi botda "📱 Raqamni yuborish" (request_contact) → telegram_accounts.phone;
-- saytda raqam kiritadi → login_codes ga hash yoziladi, kod bot orqali yuboriladi → tekshiruv → sessiya.
-- Jadval faqat service_role uchun (RLS yoqilgan, siyosat yo'q).

alter table public.telegram_accounts add column if not exists phone text;
alter table public.telegram_accounts add column if not exists phone_shared_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'telegram_accounts_phone_format') then
    alter table public.telegram_accounts add constraint telegram_accounts_phone_format check (phone is null or phone ~ '^\+[0-9]{8,15}$');
  end if;
end $$;
create unique index if not exists uq_telegram_accounts_phone on public.telegram_accounts(phone) where phone is not null;

create table if not exists public.login_codes (
  id                uuid primary key default gen_random_uuid(),
  telegram_user_id  bigint not null references public.telegram_accounts(telegram_user_id) on delete cascade,
  phone             text not null,
  code_hash         text not null,
  attempts          int not null default 0,
  expires_at        timestamptz not null,
  consumed_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_login_codes_phone on public.login_codes(phone, created_at desc);
alter table public.login_codes enable row level security;
revoke all on public.login_codes from anon, authenticated;
