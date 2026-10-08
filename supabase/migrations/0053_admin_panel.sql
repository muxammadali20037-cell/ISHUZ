-- ISH.UZ · 0053 · admin panel: moderatsiya navbati (ko'rib chiqish, shikoyat/apellyatsiya, rad etilganlar, xatolar).
--
--  * Faqat vacancies.moderate ruxsati (aal2) bilan. Qaror admin_moderation_decide orqali (audit bilan).
--  * Shaxsiy kontakt ma'lumotlari qaytarilmaydi — faqat e'lon matni va egasining ismi.

create or replace function public.admin_moderation_queue(p_tab text default 'review', p_entity text default null, p_limit int default 30, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if not public.has_admin_permission('vacancies.moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tab not in ('review', 'appeals', 'pending', 'rejected', 'errors') then raise exception 'invalid_tab' using errcode = '22023'; end if;
  if p_entity is not null and p_entity not in ('vacancy', 'worker') then raise exception 'invalid_entity' using errcode = '22023'; end if;

  with items as (
    select 'vacancy'::text as entity, v.id, v.title as title, left(v.description, 400) as preview, v.photo_path,
           v.owner_profile_id as owner_id, v.status::text as status, v.moderation_state as state, v.moderation_category as category,
           v.moderation_message as message, v.moderation_fields as fields, v.moderation_attempts as attempts,
           v.moderation_version as version, v.moderated_version, v.moderation_appeal_at as appeal_at,
           coalesce(v.moderation_requested_at, v.updated_at) as requested_at, v.updated_at
    from public.vacancies v
    where (p_entity is null or p_entity = 'vacancy')
      and case p_tab
        when 'review' then v.moderation_state = 'review'
        when 'appeals' then v.moderation_appeal_at is not null and v.moderation_state in ('review', 'rejected')
        when 'pending' then v.moderation_state = 'pending' and v.moderation_requested_at is not null and v.status in ('pending_review', 'draft')
        when 'rejected' then v.moderation_state = 'rejected'
        when 'errors' then v.moderation_state = 'pending' and v.moderation_attempts > 0
      end
    union all
    select 'worker', w.id, coalesce(nullif(w.headline, ''), w.custom_profession, ''), left(w.about, 400), null,
           w.profile_id, case when w.is_public then 'public' else 'hidden' end, w.moderation_state, w.moderation_category,
           w.moderation_message, w.moderation_fields, w.moderation_attempts,
           w.moderation_version, w.moderated_version, w.moderation_appeal_at,
           w.updated_at, w.updated_at
    from public.worker_profiles w
    where (p_entity is null or p_entity = 'worker')
      and case p_tab
        when 'review' then w.moderation_state = 'review'
        when 'appeals' then w.moderation_appeal_at is not null and w.moderation_state in ('review', 'rejected')
        when 'pending' then w.moderation_state = 'pending' and w.publish_requested
        when 'rejected' then w.moderation_state = 'rejected'
        when 'errors' then w.moderation_state = 'pending' and w.moderation_attempts > 0
      end
  )
  select jsonb_build_object(
    'total', (select count(*) from items),
    'counts', jsonb_build_object(
      'review', (select count(*) from public.vacancies where moderation_state = 'review') + (select count(*) from public.worker_profiles where moderation_state = 'review'),
      'appeals', (select count(*) from public.vacancies where moderation_appeal_at is not null and moderation_state in ('review', 'rejected'))
               + (select count(*) from public.worker_profiles where moderation_appeal_at is not null and moderation_state in ('review', 'rejected')),
      'errors', (select count(*) from public.vacancies where moderation_state = 'pending' and moderation_attempts > 0)
              + (select count(*) from public.worker_profiles where moderation_state = 'pending' and moderation_attempts > 0)),
    'rows', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select i.*, p.first_name as owner_first_name, p.last_name as owner_last_name, p.is_blocked as owner_blocked,
               (select jsonb_build_object('decision', c.decision, 'source', c.source, 'reason_code', c.reason_code, 'signals', c.signals, 'error', c.error, 'created_at', c.created_at)
                from public.moderation_checks c where c.entity_type = i.entity and c.entity_id = i.id order by c.created_at desc limit 1) as last_check
        from items i left join public.profiles p on p.id = i.owner_id
        order by (i.appeal_at is not null) desc, i.requested_at asc
        limit lim offset off) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;

revoke execute on function public.admin_moderation_queue(text, text, int, int) from public, anon;
grant execute on function public.admin_moderation_queue(text, text, int, int) to authenticated;
