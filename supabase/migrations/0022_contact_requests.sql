-- ISH.UZ · 0022 · telefon raqamini so'rash: "so'radi → egasi ruxsat berdi / rad etdi"
-- Ruxsat berilsa mavjud contact_grants ga yoziladi (can_view_phone o'zgarmaydi).
-- Telefon "hech kimga" yashirilgan bo'lsa so'rov qabul qilinmaydi.

create type public.contact_request_status as enum ('pending', 'approved', 'declined');

create table if not exists public.contact_requests (
  id                    uuid primary key default gen_random_uuid(),
  requester_profile_id  uuid not null references public.profiles(id) on delete cascade,
  owner_profile_id      uuid not null references public.profiles(id) on delete cascade,
  status                public.contact_request_status not null default 'pending',
  created_at            timestamptz not null default now(),
  responded_at          timestamptz,
  unique (requester_profile_id, owner_profile_id),
  check (requester_profile_id <> owner_profile_id)
);
create index if not exists idx_contact_requests_owner on public.contact_requests (owner_profile_id, created_at desc) where status = 'pending';

alter table public.contact_requests enable row level security;
drop policy if exists "contact_requests_read" on public.contact_requests;
create policy "contact_requests_read" on public.contact_requests for select to authenticated
  using (requester_profile_id = auth.uid() or owner_profile_id = auth.uid());
-- yozish faqat RPC orqali
revoke all on public.contact_requests from anon, authenticated;
grant select on public.contact_requests to authenticated;

-- Ko'rinadigan nom: kompaniya → ish beruvchi nomi (YaTT/shaxs) → ism familiya
create or replace function public.profile_display_name(p_profile uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(c.name), '') from public.employer_profiles e join public.companies c on c.id = e.company_id where e.profile_id = p_profile),
    (select nullif(trim(c.name), '') from public.company_members m join public.companies c on c.id = m.company_id where m.profile_id = p_profile limit 1),
    (select nullif(trim(e.display_name), '') from public.employer_profiles e where e.profile_id = p_profile),
    (select nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') from public.profiles p where p.id = p_profile),
    '');
$$;

-- Ko'ruvchi uchun holat: 'allowed' | 'pending' | 'declined' | 'hidden' | 'none'
create or replace function public.contact_status_for(p_owner uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  st public.contact_request_status;
begin
  if auth.uid() is null then return 'none'; end if;
  if public.can_view_phone(p_owner) then return 'allowed'; end if;
  if coalesce((select phone_visibility from public.profile_contacts where profile_id = p_owner), 'nobody') = 'nobody' then return 'hidden'; end if;
  select status into st from public.contact_requests where requester_profile_id = auth.uid() and owner_profile_id = p_owner;
  return coalesce(st::text, 'none');
end $$;

create or replace function public.request_contact(p_owner uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing public.contact_requests;
  who text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'blocked' using errcode = '42501'; end if;
  if me = p_owner then raise exception 'invalid' using errcode = '22023'; end if;
  if public.can_view_phone(p_owner) then return 'allowed'; end if;
  if coalesce((select phone_visibility from public.profile_contacts where profile_id = p_owner), 'nobody') = 'nobody' then
    raise exception 'contact_hidden' using errcode = '23514';
  end if;
  select * into existing from public.contact_requests where requester_profile_id = me and owner_profile_id = p_owner;
  if found and existing.status = 'pending' then return 'pending'; end if;
  -- rad etilgan bo'lsa: 7 kundan keyin qayta so'rash mumkin (bezovta qilmaslik uchun)
  if found and existing.status = 'declined' and existing.responded_at > now() - interval '7 days' then
    raise exception 'declined_recently' using errcode = '23514';
  end if;
  if not public.check_rate_limit('contact_request:' || me, 30, 86400) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.contact_requests (requester_profile_id, owner_profile_id)
  values (me, p_owner)
  on conflict (requester_profile_id, owner_profile_id) do update set status = 'pending', created_at = now(), responded_at = null;

  who := public.profile_display_name(me);
  perform public.notify(p_owner, 'system', jsonb_build_object('kind', 'contact_request', 'name', coalesce(who, '')), '/settings#contact-requests');
  return 'pending';
end $$;

create or replace function public.respond_contact_request(p_request_id uuid, p_approve boolean)
returns public.contact_request_status language plpgsql security definer set search_path = public as $$
declare
  r public.contact_requests;
  who text;
begin
  select * into r from public.contact_requests where id = p_request_id for update;
  if not found or r.owner_profile_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'blocked' using errcode = '42501'; end if;
  update public.contact_requests
  set status = case when p_approve then 'approved' else 'declined' end::public.contact_request_status, responded_at = now()
  where id = r.id;
  if p_approve then
    insert into public.contact_grants (owner_profile_id, grantee_profile_id) values (r.owner_profile_id, r.requester_profile_id)
    on conflict do nothing;
    who := public.profile_display_name(r.owner_profile_id);
    perform public.notify(r.requester_profile_id, 'system', jsonb_build_object('kind', 'contact_approved', 'name', coalesce(who, '')), null);
  end if;
  return case when p_approve then 'approved' else 'declined' end::public.contact_request_status;
end $$;

-- Egasiga: kutilayotgan so'rovlar (kim so'radi)
create or replace function public.my_contact_requests()
returns table (id uuid, requester_profile_id uuid, name text, person text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.requester_profile_id, public.profile_display_name(r.requester_profile_id),
         nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
         p.avatar_url, r.created_at
  from public.contact_requests r
  join public.profiles p on p.id = r.requester_profile_id
  where r.owner_profile_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc
  limit 100;
$$;

revoke execute on function public.profile_display_name(uuid), public.contact_status_for(uuid), public.request_contact(uuid), public.respond_contact_request(uuid, boolean), public.my_contact_requests()
  from public, anon, authenticated;
grant execute on function public.contact_status_for(uuid), public.request_contact(uuid), public.respond_contact_request(uuid, boolean), public.my_contact_requests() to authenticated;
