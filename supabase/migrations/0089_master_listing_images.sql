-- ISH TOPDIM · 0089 · Usta e'loni rasmi (AI)
--
-- Ega (2026-11-23): "ustalarda ham rasm yaratish bo'lsin". 0087 dagi e'lon rasmlari (listing_images) endi usta e'loniga ham:
-- entity = 'master'. Rasm — e'lonning umumiy surati (muqova); usta yuklagan "ish namunalari" (master_listings.photos) bilan
-- aralashmaydi — u yerda faqat ustaning haqiqiy ishlari.
--  · listing_images.entity: 'vacancy' | 'worker' | 'master'.
--  · claim_listing_image — 'master' ham qabul qiladi (navbat va xarajat chegaralari o'sha: bir kishiga sutkada N ta, umumiy
--    sutkalik chegara, bir e'longa 3 urinish).
-- Hech narsa o'chirilmaydi; takror ishga tushirish xavfsiz.

alter table public.listing_images drop constraint if exists listing_images_entity_check;
alter table public.listing_images add constraint listing_images_entity_check check (entity in ('vacancy', 'worker', 'master'));

create or replace function public.claim_listing_image(p_entity text, p_entity_id uuid, p_owner uuid, p_prompt text, p_model text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.listing_images;
begin
  if p_entity not in ('vacancy', 'worker', 'master') then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('listing_images:' || p_entity || ':' || p_entity_id::text));
  select * into r from public.listing_images where entity = p_entity and entity_id = p_entity_id;
  if r.id is not null and r.status = 'pending' and r.updated_at > now() - interval '5 minutes' then return 'busy'; end if;
  if r.id is not null and r.attempts >= 3 then return 'too_many'; end if;
  -- xarajat: avval shaxsiy, keyin umumiy sutkalik chegara (har biri hisoblagichni oshiradi)
  if not public.check_rate_limit('listing_images:user:' || p_owner::text, public.setting_int('listing_images_user_daily', 5), 86400) then return 'user_limit'; end if;
  if not public.check_rate_limit('listing_images:day', public.setting_int('listing_images_daily_limit', 100), 86400) then return 'daily_limit'; end if;
  insert into public.listing_images (entity, entity_id, owner_profile_id, status, prompt, model, attempts, updated_at)
  values (p_entity, p_entity_id, p_owner, 'pending', p_prompt, p_model, 1, now())
  on conflict (entity, entity_id) do update set status = 'pending', owner_profile_id = excluded.owner_profile_id, prompt = excluded.prompt,
    model = excluded.model, attempts = public.listing_images.attempts + 1, last_error = null, updated_at = now();
  return 'ok';
end $$;
revoke execute on function public.claim_listing_image(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_listing_image(text, uuid, uuid, text, text) to service_role;
