-- ISH.UZ · 0063 · Hamyon (F2): balansni bir marta to'ldirib, keyingi xizmatlarga karta kiritmasdan bir bosishda to'lash.
--
--  1) wallets — kimning balansi qancha (so'm); wallet_ledger — har bir harakat (to'ldirish, bonus, xizmatga sarf).
--     RLS: faqat o'zinikini o'qiydi; yozish faqat SECURITY DEFINER funksiyalar orqali (mijoz balansni o'zgartira olmaydi).
--  2) create_topup(summa) — balansni to'ldirish uchun to'lov (Payme/Click, mavjud oqim). To'lov tasdiqlanganda
--     apply_payment_internal balansga yozadi; sozlamada bonus bo'lsa (wallet_bonus_percent, wallet_bonus_min dan katta
--     to'ldirishda) — bonus alohida qator bilan qo'shiladi. Standart bonus — 0 (admin yoqadi).
--  3) wallet_pay(maqsad, obyekt) — narx, huquq va cheklovlar create_payment bilan bir xil; balans qatori qulflanadi
--     (bir vaqtda ikki to'lov balansni manfiy qila olmaydi), yetmasa — insufficient_balance va hech narsa yozilmaydi.
--  4) my_wallet() — sahifa uchun balans va to'ldirish qoidalari. simple_listing_features(): wallet = true.
--
-- Faqat qo'shimcha: jadval/ma'lumot o'chirilmaydi. payments_target cheklovi 0041/0043 dagidek qayta e'lon qilinadi
-- (wallet_topup — obyektsiz; obyekt faqat kutilayotgan to'lovda majburiy). Tuzatish: to'lov qilingan e'lonni o'chirish
-- endi ishlaydi; o'chirilgan e'lonning kutilayotgan to'lovi bekor qilinadi. Rollback: wallet_pay/create_topup/my_wallet ni olib tashlash; apply_payment_internal va
-- billing_guard_payment ni 0043 holatiga qaytarish; jadvallar qoladi (tarix).

insert into public.app_settings (key, value, is_public) values
  ('wallet_bonus_percent', '0'::jsonb, true),
  ('wallet_bonus_min', '100000'::jsonb, true),
  ('wallet_topup_min', '5000'::jsonb, true),
  ('wallet_topup_max', '2000000'::jsonb, true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 1. Jadvallar
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  delta      bigint not null check (delta <> 0),
  kind       text not null check (kind in ('topup', 'bonus', 'spend', 'adjust')),
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_profile_idx on public.wallet_ledger (profile_id, created_at desc);
create index if not exists wallet_ledger_payment_idx on public.wallet_ledger (payment_id) where payment_id is not null;

alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'wallets' and policyname = 'wallets_own_select') then
    create policy "wallets_own_select" on public.wallets for select to authenticated
      using (profile_id = (select auth.uid()) or public.has_admin_permission('settings.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'wallet_ledger' and policyname = 'wallet_ledger_own_select') then
    create policy "wallet_ledger_own_select" on public.wallet_ledger for select to authenticated
      using (profile_id = (select auth.uid()) or public.has_admin_permission('settings.manage'));
  end if;
end $$;
revoke all on public.wallets, public.wallet_ledger from anon, authenticated;
grant select on public.wallets, public.wallet_ledger to authenticated;

-- To'ldirish to'lovi obyektga bog'lanmaydi. Obyekt faqat KUTILAYOTGAN to'lovda majburiy: to'langan/bekor to'lov tarix
-- sifatida qoladi, e'lon o'chirilsa havola bo'shaydi (oldin bu cheklov tufayli to'lov qilingan e'lonni o'chirib bo'lmasdi).
alter table public.payments drop constraint if exists payments_target;
alter table public.payments add constraint payments_target check (
  status <> 'pending'
  or (purpose = 'vacancy_publish' and vacancy_id is not null)
  or (purpose in ('worker_promotion', 'worker_listing') and worker_id is not null)
  or purpose in ('ai_alerts', 'wallet_topup'));

-- E'lon yoki ishchi profili o'chirilsa — uning kutilayotgan to'lovi bekor (Payme keyin Perform qila olmaydi: state −1)
create or replace function public.trg_cancel_pending_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  update public.payments
     set status = 'cancelled', cancelled_at = now(),
         provider_state = case when provider_state = 1 then -1 else provider_state end,
         provider_cancel_time = case when provider_state = 1 then now_ms else provider_cancel_time end,
         cancel_reason = case when provider_state = 1 then coalesce(cancel_reason, 3) else cancel_reason end
   where status = 'pending'
     and ((tg_table_name = 'vacancies' and vacancy_id = old.id) or (tg_table_name = 'worker_profiles' and worker_id = old.id));
  return old;
end $$;
create or replace trigger trg_vacancies_cancel_payments before delete on public.vacancies
  for each row execute function public.trg_cancel_pending_payments();
create or replace trigger trg_worker_profiles_cancel_payments before delete on public.worker_profiles
  for each row execute function public.trg_cancel_pending_payments();

-- ---------------------------------------------------------------------------------------------------
-- 2. Qachon hamyon ishlaydi: kamida bitta pullik xizmat yoqilgan bo'lsa (hammasi bepul bo'lsa — to'ldirish ma'nosiz)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.wallet_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select public.listings_paid() or public.ai_alerts_paid() or public.billing_enabled();
$$;

-- To'lov yaratish qoidasi (0043) + hamyonni to'ldirish
create or replace function public.billing_guard_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.purpose <> 'ai_alerts'
     and not (public.listings_paid() and new.purpose in ('vacancy_publish', 'worker_listing'))
     and not (new.purpose = 'wallet_topup' and public.wallet_enabled())
     and not public.billing_enabled()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. To'lov tasdiqlanganda (0043 + hamyonni to'ldirish)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.apply_payment_internal(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  v public.vacancies;
  window_end timestamptz;
  bonus bigint;
begin
  select * into p from public.payments where id = p_payment_id;
  if p.purpose = 'vacancy_publish' and p.vacancy_id is not null then
    select * into v from public.vacancies where id = p.vacancy_id for update;
    if v.id is null then return; end if;
    window_end := greatest(coalesce(v.paid_until, now()), now()) + make_interval(days => public.setting_int('vacancy_lifetime_days', 10));
    if v.status in ('draft', 'paused', 'closed', 'expired', 'rejected') and v.category_id is not null and (v.region_id is not null or v.is_remote) then
      perform public.activate_vacancy_internal(v.id, window_end);
    else
      update public.vacancies set paid_until = window_end,
        expires_at = case when status = 'active' then window_end else expires_at end
      where id = v.id;
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/employer/vacancies/' || v.id);
  elsif p.purpose = 'worker_promotion' and p.worker_id is not null then
    perform public.extend_worker_promotion_internal(p.worker_id);
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/');
  elsif p.purpose = 'worker_listing' and p.worker_id is not null then
    perform public.extend_worker_listing_internal(p.worker_id);
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/profile/listing');
  elsif p.purpose = 'ai_alerts' then
    insert into public.ai_alert_subscriptions (profile_id, paid_until)
    values (p.profile_id, now() + make_interval(days => public.setting_int('ai_alerts_days', 30)))
    on conflict (profile_id) do update
      set paid_until = greatest(public.ai_alert_subscriptions.paid_until, now()) + make_interval(days => public.setting_int('ai_alerts_days', 30)),
          updated_at = now();
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/ai-alerts');
  elsif p.purpose = 'wallet_topup' then
    -- bir to'lov — bir marta (qayta chaqirilsa ham balans ikki marta oshmaydi)
    if exists (select 1 from public.wallet_ledger where payment_id = p.id and kind = 'topup') then return; end if;
    bonus := case when p.amount >= public.setting_int('wallet_bonus_min', 100000)
                  then (p.amount * greatest(0, least(50, public.setting_int('wallet_bonus_percent', 0)))) / 100 else 0 end;
    insert into public.wallets (profile_id, balance) values (p.profile_id, p.amount + bonus)
    on conflict (profile_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now();
    insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (p.profile_id, p.amount, 'topup', p.id);
    if bonus > 0 then
      insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (p.profile_id, bonus, 'bonus', p.id);
    end if;
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount, 'bonus', bonus), '/billing');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Foydalanuvchi funksiyalari
-- ---------------------------------------------------------------------------------------------------
create or replace function public.create_topup(p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  p public.payments;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.wallet_enabled() then raise exception 'billing_disabled' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount < public.setting_int('wallet_topup_min', 5000) or p_amount > public.setting_int('wallet_topup_max', 2000000) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if not public.check_rate_limit('create_payment:' || me, 20, 3600) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  insert into public.payments (profile_id, purpose, amount) values (me, 'wallet_topup', p_amount) returning * into p;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount);
end $$;

create or replace function public.wallet_pay(p_purpose public.payment_purpose, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pay jsonb;
  pid uuid;
  amt bigint;
  bal bigint;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_purpose = 'wallet_topup' then raise exception 'validation' using errcode = 'P0001'; end if;
  -- narx, huquq (begona e'lon), "allaqachon to'langan", bloklash va chastota — oddiy to'lov bilan aynan bir xil
  pay := public.create_payment(p_purpose, p_target_id);
  pid := (pay ->> 'id')::uuid;
  amt := (pay ->> 'amount')::bigint;
  select balance into bal from public.wallets where profile_id = me for update;
  if coalesce(bal, 0) < amt then raise exception 'insufficient_balance' using errcode = 'P0001'; end if;
  update public.wallets set balance = balance - amt, updated_at = now() where profile_id = me;
  insert into public.wallet_ledger (profile_id, delta, kind, payment_id) values (me, -amt, 'spend', pid);
  update public.payments set status = 'paid', provider = 'wallet', paid_at = now() where id = pid;
  perform public.apply_payment_internal(pid);
  return jsonb_build_object('order_no', pay -> 'order_no', 'amount', amt, 'balance', bal - amt);
end $$;

create or replace function public.my_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', public.wallet_enabled(),
    'balance', coalesce((select w.balance from public.wallets w where w.profile_id = auth.uid()), 0),
    'bonus_percent', greatest(0, least(50, public.setting_int('wallet_bonus_percent', 0))),
    'bonus_min', public.setting_int('wallet_bonus_min', 100000),
    'topup_min', public.setting_int('wallet_topup_min', 5000),
    'topup_max', public.setting_int('wallet_topup_max', 2000000));
$$;

create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true, 'photo_quarantine', true, 'media_quarantine', true, 'daily_jobs', true,
    'saved_items', true, 'wallet', true);
$$;

-- ---------------------------------------------------------------------------------------------------
-- 5. Huquqlar: mehmonga hech biri; foydalanuvchiga — faqat to'ldirish, balansdan to'lash va o'z hamyonini ko'rish
-- ---------------------------------------------------------------------------------------------------
revoke execute on function public.wallet_enabled(), public.create_topup(bigint), public.wallet_pay(public.payment_purpose, uuid),
  public.my_wallet(), public.apply_payment_internal(uuid), public.trg_cancel_pending_payments() from public, anon, authenticated;
grant execute on function public.create_topup(bigint), public.wallet_pay(public.payment_purpose, uuid), public.my_wallet() to authenticated;
