-- ISH TOPDIM · 0087 · E'lon rasmi (AI)
--
-- Ega (2026-11-20): "e'lon berayotganda oxirida so'rasin — e'lon rasmi yaratilsinmi? Ha bo'lsa, e'lonni avtomatik o'qib,
-- e'longa mos real rasm joylashi kerak; kanalda ham, ilovada ham ixcham ko'rinsin" (provayder — OpenAI, ega tanlovi).
--
--  · listing_images — har e'longa (vakansiya yoki ishchi e'loni) bitta rasm: holat (pending → ready | failed), saqlangan
--    joyi va ochiq manzili. Yozish faqat server (service role) orqali; o'qish — tayyor rasmlar hammaga (rasm baribir ochiq
--    bucket'da), egasi o'z yozuvlarini (holatini) ko'radi.
--  · listing-images — ochiq bucket (5 MB, jpeg/png/webp).
--  · claim_listing_image — navbat va xarajat nazorati (faqat service role): bir vaqtda bitta generatsiya, bir e'longa ko'pi
--    bilan 3 urinish, bir kishiga sutkada N ta (listing_images_user_daily, standart 5), umumiy sutkalik chegara
--    (listing_images_daily_limit, standart 100). Natija matni: ok | busy | too_many | user_limit | daily_limit.
-- Hech narsa o'chirilmaydi; takror ishga tushirish xavfsiz.

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('vacancy', 'worker')),
  entity_id uuid not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  image_url text,
  storage_path text,
  prompt text,
  model text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity, entity_id)
);
create index if not exists listing_images_owner_idx on public.listing_images (owner_profile_id, updated_at desc);

alter table public.listing_images enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_images' and policyname = 'listing_images_read_ready') then
    create policy "listing_images_read_ready" on public.listing_images for select using (status = 'ready');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_images' and policyname = 'listing_images_read_own') then
    create policy "listing_images_read_own" on public.listing_images for select to authenticated using (owner_profile_id = auth.uid());
  end if;
end $$;
revoke insert, update, delete on public.listing_images from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

insert into public.app_settings (key, value, is_public) values
  ('listing_images_daily_limit', '100'::jsonb, false),
  ('listing_images_user_daily', '5'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.claim_listing_image(p_entity text, p_entity_id uuid, p_owner uuid, p_prompt text, p_model text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.listing_images;
begin
  if p_entity not in ('vacancy', 'worker') then return 'invalid'; end if;
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
