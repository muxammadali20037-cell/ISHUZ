-- ISH.UZ · 0009 · bildirishnoma trigger'lari va hisoblagichlar

create or replace function public.notify(p_profile_id uuid, p_type public.notification_type, p_payload jsonb, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (profile_id, type, payload, link)
  select p_profile_id, p_type, p_payload, p_link
  where p_profile_id is not null and not public.is_blocked(p_profile_id);
$$;

-- Vakansiyani boshqaruvchi barcha profillar (egasi + kompaniya a'zolari)
create or replace function public.vacancy_managers(p_vacancy_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select v.owner_profile_id from public.vacancies v where v.id = p_vacancy_id
  union
  select m.profile_id from public.vacancies v join public.company_members m on m.company_id = v.company_id where v.id = p_vacancy_id;
$$;

-- Yangi ariza -> ish beruvchiga
create or replace function public.trg_application_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  wname text;
  mgr uuid;
begin
  select * into v from public.vacancies where id = new.vacancy_id;
  select trim(p.first_name || ' ' || left(p.last_name, 1) || '.') into wname
  from public.worker_profiles w join public.profiles p on p.id = w.profile_id where w.id = new.worker_id;
  update public.vacancies set applications_count = applications_count + 1 where id = new.vacancy_id;
  if new.status = 'sent' then
    for mgr in select * from public.vacancy_managers(new.vacancy_id) loop
      perform public.notify(mgr, 'application_received',
        jsonb_build_object('application_id', new.id, 'vacancy_id', v.id, 'vacancy_title', v.title, 'worker_name', wname, 'match_score', new.match_score),
        '/employer/vacancies/' || v.id || '/applications');
    end loop;
  end if;
  return new;
end $$;
create trigger trg_applications_inserted after insert on public.applications for each row execute function public.trg_application_inserted();

create or replace function public.trg_application_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.vacancies set applications_count = greatest(0, applications_count - 1) where id = old.vacancy_id;
  return old;
end $$;
create trigger trg_applications_deleted after delete on public.applications for each row execute function public.trg_application_deleted();

-- Ariza holati o'zgardi -> ishchiga (yoki withdrawn bo'lsa ish beruvchiga)
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
      jsonb_build_object('application_id', new.id, 'vacancy_id', v.id, 'vacancy_title', v.title, 'company_name', cname, 'status', new.status),
      '/applications/' || new.id);
  end if;
  return new;
end $$;
create trigger trg_applications_status after update of status on public.applications for each row execute function public.trg_application_status_changed();

-- Yangi taklif -> ishchiga
create or replace function public.trg_offer_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wprofile uuid;
  cname text;
  ename text;
begin
  select profile_id into wprofile from public.worker_profiles where id = new.worker_id;
  select name into cname from public.companies where id = new.company_id;
  select trim(first_name || ' ' || last_name) into ename from public.profiles where id = new.employer_profile_id;
  perform public.notify(wprofile, 'offer_received',
    jsonb_build_object('offer_id', new.id, 'title', new.title, 'company_name', coalesce(cname, ename), 'salary_from', new.salary_from, 'salary_to', new.salary_to),
    '/offers/' || new.id);
  return new;
end $$;
create trigger trg_offers_inserted after insert on public.job_offers for each row execute function public.trg_offer_inserted();

-- Taklifga javob -> ish beruvchiga
create or replace function public.trg_offer_responded()
returns trigger language plpgsql security definer set search_path = public as $$
declare wname text;
begin
  if new.status in ('accepted', 'declined') and old.status not in ('accepted', 'declined') then
    select trim(p.first_name || ' ' || p.last_name) into wname
    from public.worker_profiles w join public.profiles p on p.id = w.profile_id where w.id = new.worker_id;
    perform public.notify(new.employer_profile_id, 'offer_response',
      jsonb_build_object('offer_id', new.id, 'title', new.title, 'worker_name', wname, 'status', new.status),
      '/offers/' || new.id);
  end if;
  return new;
end $$;
create trigger trg_offers_responded after update of status on public.job_offers for each row execute function public.trg_offer_responded();

-- Yangi xabar -> boshqa a'zolarga (agar o'qilmagan xabar bildirishnomasi bo'lmasa)
create or replace function public.trg_message_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  member record;
  sname text;
begin
  select trim(first_name || ' ' || last_name) into sname from public.profiles where id = new.sender_id;
  for member in select cm.profile_id from public.conversation_members cm
                where cm.conversation_id = new.conversation_id and cm.profile_id <> new.sender_id and not cm.is_muted loop
    if not exists (select 1 from public.notifications n where n.profile_id = member.profile_id and n.type = 'new_message'
                   and n.read_at is null and n.payload->>'conversation_id' = new.conversation_id::text) then
      perform public.notify(member.profile_id, 'new_message',
        jsonb_build_object('conversation_id', new.conversation_id, 'sender_name', sname, 'preview', left(coalesce(new.body, ''), 80)),
        '/messages/' || new.conversation_id);
    end if;
  end loop;
  return new;
end $$;
create trigger trg_messages_inserted after insert on public.messages for each row execute function public.trg_message_inserted();

-- Verifikatsiya natijasi
create or replace function public.trg_verification_reviewed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('verified', 'rejected') and old.status = 'pending' then
    perform public.notify(new.profile_id, 'verification_result',
      jsonb_build_object('request_id', new.id, 'type', new.type, 'status', new.status, 'note', new.review_note), '/company/settings');
  end if;
  return new;
end $$;
create trigger trg_verification_reviewed after update of status on public.verification_requests for each row execute function public.trg_verification_reviewed();

-- Sharh tasdiqlandi -> nishonga
create or replace function public.trg_review_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    perform public.notify(new.target_profile_id, 'review_received', jsonb_build_object('review_id', new.id, 'rating', new.rating), '/profile');
  end if;
  return new;
end $$;
create trigger trg_review_approved after update of status on public.reviews for each row execute function public.trg_review_approved();

-- Ko'nikma ishlatilish soni
create or replace function public.trg_skill_usage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.skills set usage_count = usage_count + 1 where id = new.skill_id;
  elsif tg_op = 'DELETE' then
    update public.skills set usage_count = greatest(0, usage_count - 1) where id = old.skill_id;
  end if;
  return null;
end $$;
create trigger trg_worker_skills_usage after insert or delete on public.worker_skills for each row execute function public.trg_skill_usage();
create trigger trg_vacancy_skills_usage after insert or delete on public.vacancy_skills for each row execute function public.trg_skill_usage();

-- Rol qo'shilganda user_roles ni sinxronlash
create or replace function public.trg_worker_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (profile_id, role) values (new.profile_id, 'worker') on conflict do nothing;
  update public.profiles set active_role = coalesce(active_role, 'worker') where id = new.profile_id;
  return new;
end $$;
create trigger trg_worker_profiles_role after insert on public.worker_profiles for each row execute function public.trg_worker_profile_role();

create or replace function public.trg_employer_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (profile_id, role) values (new.profile_id, 'employer') on conflict do nothing;
  update public.profiles set active_role = coalesce(active_role, 'employer') where id = new.profile_id;
  return new;
end $$;
create trigger trg_employer_profiles_role after insert on public.employer_profiles for each row execute function public.trg_employer_profile_role();

-- Muddati tugayotgan vakansiyalar (cron: kuniga 1 marta)
create or replace function public.notify_expiring_vacancies()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; v record; mgr uuid;
begin
  for v in select id, title, expires_at from public.vacancies
           where status = 'active' and expires_at between now() + interval '1 day' and now() + interval '2 days' loop
    for mgr in select * from public.vacancy_managers(v.id) loop
      if not exists (select 1 from public.notifications where profile_id = mgr and type = 'vacancy_expiring' and payload->>'vacancy_id' = v.id::text) then
        perform public.notify(mgr, 'vacancy_expiring', jsonb_build_object('vacancy_id', v.id, 'vacancy_title', v.title, 'expires_at', v.expires_at), '/employer/vacancies/' || v.id);
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- Yangi mos vakansiya -> faol ish qidiruvchilarga (publish_vacancy dan keyin)
create or replace function public.notify_matching_workers(p_vacancy_id uuid, p_min_score int default 70)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; m record; v public.vacancies;
begin
  select * into v from public.vacancies where id = p_vacancy_id;
  for m in select mt.worker_id, mt.score, w.profile_id from public.matches mt join public.worker_profiles w on w.id = mt.worker_id
           where mt.vacancy_id = p_vacancy_id and mt.score >= p_min_score and w.status = 'active' limit 200 loop
    perform public.notify(m.profile_id, 'new_matching_vacancy',
      jsonb_build_object('vacancy_id', v.id, 'vacancy_slug', v.slug, 'vacancy_title', v.title, 'score', m.score), '/jobs/' || v.slug);
    n := n + 1;
  end loop;
  return n;
end $$;
