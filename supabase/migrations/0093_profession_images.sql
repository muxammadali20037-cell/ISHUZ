-- ISH TOPDIM · 0093 · Kasb rasmi: e'lonning tayyor rasmi, foydalanuvchi va admin uchun navbat
--
-- Ega (2026-11-27): "har bitta kasbga rasm yaratib olsak, birinchi qo'yib chiqsin — oddiy rasmni tanlab «Joylash» bossa
-- buzilmasin" → tanlovi: "Kerak bo'lganda + tugma".
--
-- 0047 dagi profession_images (har kasbga bitta rasm, soatlik fon vazifasi) saqlanadi; rasm provayderi ilovada OpenAI'ga
-- o'tkazildi (e'lon rasmlari bilan bir xil). Bu migratsiya:
--  · claim_profession_image_by — foydalanuvchi e'lon tekshiruvida "Rasm yaratish"ni bosganda kasbga rasm (shu zahoti) va
--    admin panelidagi "oldindan yaratish" tugmasi uchun navbat (faqat service role). Foydalanuvchi — e'lon rasmlari bilan
--    umumiy hisoblagichlar (listing_images:user:<id> — kishiga sutkada listing_images_user_daily, adminga yo'q;
--    listing_images:day — umumiy listing_images_daily_limit). Admin oldindan yaratganda (p_batch) — alohida sutkalik
--    chegara (profession_images_admin_daily, standart 200). Tayyor rasm qayta yaratilmaydi ('exists'), faqat faol admin
--    p_force bilan almashtira oladi (yangisi chiqmasa — eskisi qoladi, ilova qaytaradi).
--    Natija: ok | exists | busy | too_many | user_limit | daily_limit | forbidden | disabled | invalid.
--  · Provayder xatosi (Gemini 429 — kvota) bilan to'xtab qolgan urinishlar hisoblagichi nolga qaytariladi: bu kasbning
--    aybi emas, yangi provayder bilan qayta urinilsin. Rasm va yozuvlar o'chirilmaydi.
-- Takror ishga tushirish xavfsiz.

insert into public.app_settings (key, value, is_public) values
  ('profession_images_admin_daily', '200'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.claim_profession_image_by(
  p_node_id uuid, p_owner uuid, p_prompt text, p_model text, p_batch boolean default false, p_force boolean default false
)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.profession_images;
  admin boolean := exists (select 1 from public.admin_users a where a.profile_id = p_owner and a.is_active);
begin
  if p_node_id is null or p_owner is null then return 'invalid'; end if;
  if (p_batch or p_force) and not admin then return 'forbidden'; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'profession_images_enabled'), false) then return 'disabled'; end if;
  if not exists (select 1 from public.profession_nodes n where n.id = p_node_id and n.is_active) then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('profession_images:' || p_node_id::text));
  select * into r from public.profession_images where node_id = p_node_id;
  if r.status = 'pending' and r.updated_at > now() - interval '5 minutes' then return 'busy'; end if;
  if r.status = 'ready' and not p_force then return 'exists'; end if;
  if r.status = 'failed' and r.attempts >= 3 and not admin then return 'too_many'; end if;
  if p_batch then
    if not public.check_rate_limit('profession_images:admin_day', public.setting_int('profession_images_admin_daily', 200), 86400) then return 'daily_limit'; end if;
  else
    if not admin and not public.check_rate_limit('listing_images:user:' || p_owner::text, public.setting_int('listing_images_user_daily', 5), 86400) then return 'user_limit'; end if;
    if not public.check_rate_limit('listing_images:day', public.setting_int('listing_images_daily_limit', 100), 86400) then return 'daily_limit'; end if;
  end if;
  insert into public.profession_images (node_id, status, prompt, model, attempts, updated_at)
  values (p_node_id, 'pending', p_prompt, p_model, 1, now())
  on conflict (node_id) do update set status = 'pending', prompt = excluded.prompt, model = excluded.model,
    attempts = public.profession_images.attempts + 1, last_error = null, updated_at = now();
  return 'ok';
end $$;
revoke execute on function public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.claim_profession_image_by(uuid, uuid, text, text, boolean, boolean) to service_role;

-- provayder kvotasi tugagani sababli to'xtagan urinishlar — qayta (bir marta: faqat hali 'failed' va provayder xatosi)
update public.profession_images
set attempts = 0, updated_at = now() - interval '1 hour'
where status = 'failed' and attempts > 0 and last_error ~ '^provider_http_(429|5[0-9][0-9]|401|403)';
