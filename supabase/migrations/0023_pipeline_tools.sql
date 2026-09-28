-- ISH.UZ · 0023 · ish beruvchi pipeline'i: suhbat sanasi/joyi, shaxsiy izohlar, ommaviy amallar.
-- Mavjud set_application_status qoidalari (faqat oldinga, yopiq arizaga tegilmaydi) o'zgarmaydi — hammasi u orqali.

alter table public.applications add column if not exists interview_at timestamptz;
alter table public.applications add column if not exists interview_place text;
alter table public.applications drop constraint if exists applications_interview_place_check;
alter table public.applications add constraint applications_interview_place_check check (interview_place is null or length(interview_place) <= 300);

-- Egasi pin qilingan ustunlarni RLS orqali o'zgartira olmaydi — faqat schedule_interview RPC yozadi.
-- (applications jadvaliga to'g'ridan-to'g'ri update siyosati yo'q.)

-- ---------------------------------------------------------------------
-- Suhbatga chaqirish / vaqtini o'zgartirish
-- ---------------------------------------------------------------------
create or replace function public.schedule_interview(p_application_id uuid, p_at timestamptz, p_place text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.applications;
  cname text;
  v public.vacancies;
  wprofile uuid;
begin
  select * into a from public.applications where id = p_application_id;
  if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.can_edit_vacancy(a.vacancy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status in ('hired', 'rejected', 'withdrawn', 'offered') then raise exception 'application_closed' using errcode = '23514'; end if;
  if p_at is null or p_at < now() - interval '1 hour' or p_at > now() + interval '120 days' then
    raise exception 'invalid_interview_time' using errcode = '23514';
  end if;

  update public.applications set interview_at = p_at, interview_place = nullif(trim(p_place), '') where id = a.id;
  if a.status <> 'interview' then
    -- holat trigger'i bildirishnomani yuboradi (vaqt va joy bilan)
    perform public.set_application_status(a.id, 'interview', p_note);
  else
    -- vaqt o'zgardi: tarixga yozamiz va nomzodga xabar beramiz
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (a.id, 'interview', 'interview', auth.uid(), nullif(trim(coalesce(p_note, '')), ''));
    select * into v from public.vacancies where id = a.vacancy_id;
    select name into cname from public.companies where id = v.company_id;
    select profile_id into wprofile from public.worker_profiles where id = a.worker_id;
    perform public.notify(wprofile, 'interview_invite',
      jsonb_build_object('application_id', a.id, 'vacancy_id', v.id, 'vacancy_title', v.title, 'company_name', cname, 'status', 'interview',
        'interview_at', p_at, 'interview_place', nullif(trim(p_place), ''), 'rescheduled', true),
      '/applications/' || a.id);
  end if;
end $$;

-- Holat trigger'i: suhbatga chaqirilganda vaqt va joy ham bildirishnomaga qo'shiladi
create or replace function public.trg_application_status_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  cname text;
  wprofile uuid;
  mgr uuid;
begin
  if new.status = old.status then return new; end if;
  select * into v from public.vacancies where id = new.vacancy_id;
  select name into cname from public.companies where id = v.company_id;
  select profile_id into wprofile from public.worker_profiles where id = new.worker_id;
  if new.status = 'withdrawn' then
    for mgr in select * from public.vacancy_managers(new.vacancy_id) loop
      perform public.notify(mgr, 'application_status',
        jsonb_build_object('application_id', new.id, 'vacancy_title', v.title, 'status', new.status),
        '/employer/vacancies/' || v.id || '/applications');
    end loop;
  else
    perform public.notify(wprofile,
      case when new.status = 'interview' then 'interview_invite'::public.notification_type else 'application_status'::public.notification_type end,
      jsonb_strip_nulls(jsonb_build_object('application_id', new.id, 'vacancy_id', v.id, 'vacancy_title', v.title, 'company_name', cname, 'status', new.status,
        'interview_at', case when new.status = 'interview' then new.interview_at end,
        'interview_place', case when new.status = 'interview' then new.interview_place end)),
      '/applications/' || new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Ommaviy amal: bir nechta arizani saralash / rad etish (har biri alohida tekshiriladi)
-- ---------------------------------------------------------------------
create or replace function public.bulk_set_application_status(p_ids uuid[], p_status public.application_status, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  aid uuid;
  done int := 0;
begin
  if p_status not in ('viewed', 'shortlisted', 'rejected') then raise exception 'invalid_status' using errcode = '23514'; end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 100 then raise exception 'invalid' using errcode = '22023'; end if;
  foreach aid in array p_ids loop
    begin
      if not exists (select 1 from public.applications a where a.id = aid and public.can_edit_vacancy(a.vacancy_id)) then
        raise exception 'forbidden' using errcode = '42501';
      end if;
      perform public.set_application_status(aid, p_status, p_note);
      done := done + 1;
    exception when others then
      -- yopiq yoki orqaga o'tish mumkin bo'lmagan ariza — o'tkazib yuboriladi
      null;
    end;
  end loop;
  return done;
end $$;

-- ---------------------------------------------------------------------
-- Shaxsiy izohlar: faqat vakansiya boshqaruvchilari ko'radi (nomzod hech qachon ko'rmaydi)
-- ---------------------------------------------------------------------
create table if not exists public.application_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications(id) on delete cascade,
  author_id       uuid references public.profiles(id) on delete set null default auth.uid(),
  body            text not null check (length(trim(body)) between 1 and 1000),
  created_at      timestamptz not null default now()
);
create index if not exists idx_application_notes_app on public.application_notes (application_id, created_at desc);

alter table public.application_notes enable row level security;
drop policy if exists "application_notes_read" on public.application_notes;
drop policy if exists "application_notes_insert" on public.application_notes;
drop policy if exists "application_notes_delete" on public.application_notes;
create policy "application_notes_read" on public.application_notes for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and public.manages_vacancy(a.vacancy_id)));
create policy "application_notes_insert" on public.application_notes for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user()
    and exists (select 1 from public.applications a where a.id = application_id and public.can_edit_vacancy(a.vacancy_id)));
create policy "application_notes_delete" on public.application_notes for delete to authenticated
  using (author_id = auth.uid());
grant select, insert, delete on public.application_notes to authenticated;

revoke execute on function public.schedule_interview(uuid, timestamptz, text, text), public.bulk_set_application_status(uuid[], public.application_status, text)
  from public, anon, authenticated;
grant execute on function public.schedule_interview(uuid, timestamptz, text, text), public.bulk_set_application_status(uuid[], public.application_status, text) to authenticated;
