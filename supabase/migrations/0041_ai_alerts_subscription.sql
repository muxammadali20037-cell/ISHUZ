-- ISH.UZ · 0041 · Aqlli AI qidiruv — oyiga 15 000 so'm (Payme/Click), 30 kun.
-- Vakansiya e'loni va TOP hali ham bepul qoladi (billing_enabled=false); AI qidiruv o'z bayrog'i bilan pullik:
-- app_settings.ai_alerts_paid=true bo'lsa xabarlar faqat obunasi faol foydalanuvchilarga boradi.

insert into public.app_settings (key, value, is_public) values
  ('ai_alerts_paid', 'true'::jsonb, true),
  ('price_ai_alerts', '15000'::jsonb, true),
  ('ai_alerts_days', '30'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.ai_alerts_paid()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'ai_alerts_paid'), false);
$$;

-- Obuna foydalanuvchi bo'yicha (barcha kuzatuvlariga amal qiladi); faqat to'lov tizimi yozadi
create table if not exists public.ai_alert_subscriptions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  paid_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.ai_alert_subscriptions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_alert_subscriptions' and policyname = 'ai_alert_subscriptions_own') then
    create policy "ai_alert_subscriptions_own" on public.ai_alert_subscriptions for select to authenticated using (profile_id = auth.uid());
  end if;
end $$;
revoke all on public.ai_alert_subscriptions from anon, authenticated;
grant select on public.ai_alert_subscriptions to authenticated;

-- To'lov yozuvi: ai_alerts maqsadi vakansiya/ishchiga bog'lanmaydi
alter table public.payments drop constraint if exists payments_target;
alter table public.payments add constraint payments_target check (
  (purpose = 'vacancy_publish' and vacancy_id is not null)
  or (purpose = 'worker_promotion' and worker_id is not null)
  or purpose = 'ai_alerts');

-- To'lov o'chiq rejimda ham AI qidiruv obunasi uchun to'lov yaratish mumkin
create or replace function public.billing_guard_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.purpose <> 'ai_alerts' and not public.billing_enabled()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'billing_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.create_payment(p_purpose public.payment_purpose, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  amt bigint;
  p public.payments;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_blocked(me) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.check_rate_limit('create_payment:' || me, 20, 3600) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if p_purpose = 'vacancy_publish' then
    if not public.can_edit_vacancy(p_target_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if exists (select 1 from public.vacancies where id = p_target_id and paid_until > now() + interval '1 day') then
      raise exception 'already_paid' using errcode = 'P0001';
    end if;
    amt := public.setting_int('price_vacancy_publish', 50000);
    insert into public.payments (profile_id, purpose, vacancy_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  elsif p_purpose = 'ai_alerts' then
    amt := public.setting_int('price_ai_alerts', 15000);
    insert into public.payments (profile_id, purpose, amount) values (me, p_purpose, amt) returning * into p;
  else
    if p_target_id is distinct from public.current_worker_id() then raise exception 'forbidden' using errcode = '42501'; end if;
    amt := public.setting_int('price_worker_promotion', 20000);
    insert into public.payments (profile_id, purpose, worker_id, amount) values (me, p_purpose, p_target_id, amt) returning * into p;
  end if;
  return jsonb_build_object('id', p.id, 'order_no', p.order_no, 'amount', p.amount);
end $$;

create or replace function public.apply_payment_internal(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  v public.vacancies;
  window_end timestamptz;
begin
  select * into p from public.payments where id = p_payment_id;
  if p.purpose = 'vacancy_publish' and p.vacancy_id is not null then
    select * into v from public.vacancies where id = p.vacancy_id for update;
    if v.id is null then return; end if;
    window_end := greatest(coalesce(v.paid_until, now()), now()) + make_interval(days => public.setting_int('vacancy_lifetime_days', 30));
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
  elsif p.purpose = 'ai_alerts' then
    -- muddat uzaytiriladi: faol bo'lsa oxiridan, aks holda hozirdan
    insert into public.ai_alert_subscriptions (profile_id, paid_until)
    values (p.profile_id, now() + make_interval(days => public.setting_int('ai_alerts_days', 30)))
    on conflict (profile_id) do update
      set paid_until = greatest(public.ai_alert_subscriptions.paid_until, now()) + make_interval(days => public.setting_int('ai_alerts_days', 30)),
          updated_at = now();
    perform public.notify(p.profile_id, 'system', jsonb_build_object('kind', 'payment_success', 'purpose', p.purpose, 'amount', p.amount), '/ai-alerts');
  end if;
end $$;

-- Trigger: AI qidiruv pullik bo'lsa — faqat obunasi (yoki alohida paid_until) faol bo'lganlar
create or replace function public.trg_vacancy_ai_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anc uuid[];
  a record;
  who text;
  verified boolean;
  region text;
  paid_only boolean := public.ai_alerts_paid();
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then
    return null;
  end if;

  if new.profession_node_id is not null then
    with recursive up as (
      select n.id, n.parent_id from public.profession_nodes n where n.id = new.profession_node_id
      union all
      select p.id, p.parent_id from public.profession_nodes p join up on p.id = up.parent_id
    ) select array_agg(up.id) into anc from up;
  end if;

  select coalesce(c.name, ep.display_name, trim(concat(pf.first_name, ' ', pf.last_name))),
         coalesce(c.verification_status = 'verified', false)
    into who, verified
  from public.profiles pf
  left join public.companies c on c.id = new.company_id
  left join public.employer_profiles ep on ep.profile_id = new.owner_profile_id
  where pf.id = new.owner_profile_id;
  select r.name_uz into region from public.regions r where r.id = new.region_id;

  for a in
    select al.* from public.ai_job_alerts al
    where al.is_active
      and (not paid_only or al.paid_until > now()
           or exists (select 1 from public.ai_alert_subscriptions s where s.profile_id = al.profile_id and s.paid_until > now()))
      and al.profile_id is distinct from new.owner_profile_id
      and (al.profession_node_id is null or al.profession_node_id = any(coalesce(anc, '{}')))
      and (al.category_id is null or al.category_id = new.category_id)
      and (al.region_id is null or al.region_id = new.region_id or new.is_remote)
      and (cardinality(al.district_ids) = 0 or new.district_id = any(al.district_ids) or new.is_remote)
      and (al.salary_min is null or new.salary_negotiable
           or public.salary_monthly_equivalent(coalesce(new.salary_to, new.salary_from), new.salary_type) >= al.salary_min)
      and (cardinality(al.employment_types) = 0 or new.employment_type = any(al.employment_types))
      and (cardinality(al.schedules) = 0 or new.schedule = any(al.schedules))
      and (not al.is_remote or new.is_remote)
      and (not al.no_experience or new.experience_min_months = 0)
      and (al.q is null or al.q = '' or new.title ilike '%' || al.q || '%' or new.search_vector @@ plainto_tsquery('public.ishuz', al.q))
  loop
    insert into public.ai_job_alert_hits (alert_id, vacancy_id) values (a.id, new.id) on conflict do nothing;
    if found then
      update public.ai_job_alerts set hits_count = hits_count + 1, last_hit_at = now() where id = a.id;
      perform public.notify(a.profile_id, 'system', jsonb_build_object(
        'kind', 'ai_alert',
        'label', a.label,
        'title', new.title,
        'who', coalesce(who, ''),
        'verified', verified,
        'region', coalesce(region, ''),
        'salary_from', new.salary_from,
        'salary_to', new.salary_to,
        'negotiable', new.salary_negotiable
      ), '/jobs/' || new.slug);
    end if;
  end loop;
  return null;
end $$;

revoke execute on function public.create_payment(public.payment_purpose, uuid), public.apply_payment_internal(uuid) from public, anon;
grant execute on function public.create_payment(public.payment_purpose, uuid) to authenticated;
revoke execute on function public.apply_payment_internal(uuid), public.trg_vacancy_ai_alerts() from authenticated;
grant execute on function public.ai_alerts_paid() to anon, authenticated;
