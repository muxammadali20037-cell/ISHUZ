-- ISH TOPDIM · 0091 · E'lon rasmi: adminlarga shaxsiy chegara yo'q
--
-- Ega (2026-11-24): "bugun rasm yaratish chegarasiga yetdingiz deyapti — nimaga?" → tanlovi: "Adminlarga chegarasiz".
-- claim_listing_image: faol admin (admin_users.is_active) uchun shaxsiy sutkalik chegara (listing_images_user_daily, 5) va
-- bir e'longa 3 urinish chegarasi qo'llanmaydi. Umumiy sutkalik chegara (listing_images_daily_limit, 100) — hammaga, adminga
-- ham (xarajat himoyasi). Oddiy foydalanuvchilar uchun hech narsa o'zgarmaydi.
-- Faqat funksiya almashtiriladi; ma'lumot o'zgarmaydi; takror ishga tushirish xavfsiz.

create or replace function public.claim_listing_image(p_entity text, p_entity_id uuid, p_owner uuid, p_prompt text, p_model text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.listing_images;
  admin boolean := exists (select 1 from public.admin_users a where a.profile_id = p_owner and a.is_active);
begin
  if p_entity not in ('vacancy', 'worker', 'master') then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('listing_images:' || p_entity || ':' || p_entity_id::text));
  select * into r from public.listing_images where entity = p_entity and entity_id = p_entity_id;
  if r.id is not null and r.status = 'pending' and r.updated_at > now() - interval '5 minutes' then return 'busy'; end if;
  if r.id is not null and r.attempts >= 3 and not admin then return 'too_many'; end if;
  -- xarajat: avval shaxsiy (adminga — yo'q), keyin umumiy sutkalik chegara (har biri hisoblagichni oshiradi)
  if not admin and not public.check_rate_limit('listing_images:user:' || p_owner::text, public.setting_int('listing_images_user_daily', 5), 86400) then return 'user_limit'; end if;
  if not public.check_rate_limit('listing_images:day', public.setting_int('listing_images_daily_limit', 100), 86400) then return 'daily_limit'; end if;
  insert into public.listing_images (entity, entity_id, owner_profile_id, status, prompt, model, attempts, updated_at)
  values (p_entity, p_entity_id, p_owner, 'pending', p_prompt, p_model, 1, now())
  on conflict (entity, entity_id) do update set status = 'pending', owner_profile_id = excluded.owner_profile_id, prompt = excluded.prompt,
    model = excluded.model, attempts = public.listing_images.attempts + 1, last_error = null, updated_at = now();
  return 'ok';
end $$;
revoke execute on function public.claim_listing_image(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_listing_image(text, uuid, uuid, text, text) to service_role;
