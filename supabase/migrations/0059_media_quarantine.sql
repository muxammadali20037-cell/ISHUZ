-- 0059 · Profil rasmi va kompaniya logotipi (F-06 qolgan qismi): karantin → serverda tekshirish va qayta kodlash →
--        o'zgarmas, tekshirilgan fayl. 0058 (ish joyi surati) bilan bir xil sxema.
--
--  1) media-uploads — YOPIQ karantin bucket. Brauzer xom faylni faqat yuklay oladi (o'qish/almashtirish/o'chirish yo'q):
--       avatar/<o'zi>/<uuid>.<ext>        — faqat o'z papkasiga;
--       logo/<kompaniya>/<uuid>.<ext>     — faqat shu kompaniya admini.
--  2) Server (service role) faylni o'qiydi, mazmunini tekshiradi, EXIF/joylashuvsiz WebP qilib qayta kodlaydi va ommaviy
--     avatars / company-logos ga <egasi>/v-<sha256>.webp nomi bilan yozadi.
--     Mijoz avatars / company-logos ga endi faqat eski nomdagi bitta faylni (avatar.<ext> / logo.<ext>) yoza oladi —
--     o'tish davri uchun (eski ilova nusxasi); server uni ham qayta kodlab, "v-" nusxaga o'tkazadi. "v-" fayllarga mijoz tegolmaydi.
--  3) profiles.avatar_url / companies.logo_url: mijoz faqat tekshirilgan (…/v-<64 hex>.webp) manzil yoki Telegram rasmini
--     yoza oladi. O'zgarmagan (eski) qiymatlarga tegilmaydi — mavjud rasmlar saqlanadi.
--  4) stale_raw_media() — karantinda qolib ketgan fayllar ro'yxati (faqat service role; o'chirish Storage API orqali).
--  5) simple_listing_features(): media_quarantine = true (ilova karantin bucket'ini ishlatadi).
--
-- Faqat qo'shimcha: DROP/DELETE yo'q; mavjud siyosatlar ALTER POLICY bilan toraytiriladi (nomi va maqsadi o'sha).
-- Tartib: kod 0059 dan oldin ham ishlaydi (eski nom bilan yuklaydi, server baribir qayta kodlaydi), keyin ham.
-- Rollback: 0011 dagi avatars_own_* / logos_member_* siyosat ifodalarini ALTER POLICY bilan qaytarish;
--           trg_01_profile_media_verified, trg_01_company_media_verified triggerlarini o'chirish;
--           simple_listing_features() ni 0058 dagi holatga qaytarish.

-- ---------------------------------------------------------------------------------------------------
-- 1. Karantin bucket (yopiq)
-- ---------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-uploads', 'media-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_uploads_insert') then
    -- faqat INSERT. CASE — uuid'ga aylantirishdan oldin nom shakli tekshirilsin (OR tartibi kafolatlanmaydi)
    create policy "media_uploads_insert" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'media-uploads'
        and case
          when name ~ '^avatar/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
            then (storage.foldername(name))[2] = (select auth.uid())::text
          when name ~ '^logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(jpg|png|webp)$'
            then public.is_company_admin(((storage.foldername(name))[2])::uuid)
          else false
        end
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Ommaviy bucket'lar: mijoz faqat eski nomdagi bitta faylga yozadi; "v-" (tekshirilgan) fayllar — faqat server
-- ---------------------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_own_write') then
    alter policy "avatars_own_write" on storage.objects
      with check (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|png|webp)$'));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_own_update') then
    alter policy "avatars_own_update" on storage.objects
      using (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|png|webp)$'))
      with check (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|png|webp)$'));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_own_delete') then
    alter policy "avatars_own_delete" on storage.objects
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and name !~ '/v-[^/]*$');
  end if;

  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'logos_member_write') then
    alter policy "logos_member_write" on storage.objects
      with check (
        bucket_id = 'company-logos'
        and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo\.(jpg|png|webp)$'
                 then public.is_company_admin(((storage.foldername(name))[1])::uuid) else false end
      );
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'logos_member_update') then
    alter policy "logos_member_update" on storage.objects
      using (
        bucket_id = 'company-logos'
        and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo\.(jpg|png|webp)$'
                 then public.is_company_admin(((storage.foldername(name))[1])::uuid) else false end
      )
      with check (
        bucket_id = 'company-logos'
        and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo\.(jpg|png|webp)$'
                 then public.is_company_admin(((storage.foldername(name))[1])::uuid) else false end
      );
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'logos_member_delete') then
    alter policy "logos_member_delete" on storage.objects
      using (
        bucket_id = 'company-logos'
        and name !~ '/v-[^/]*$'
        and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                 then public.is_company_admin(((storage.foldername(name))[1])::uuid) else false end
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Profil va kompaniyaga faqat tekshirilgan rasm manzili (mijoz yozuvi; service role va trigger ichidagi yozuv — erkin)
--    trg_00_*_media_guard (0056) manzil o'z storage'imizdami — tekshiradi; bu trigger undan keyin ishlaydi (nom tartibi).
-- ---------------------------------------------------------------------------------------------------
create or replace function public.trg_media_verified()
returns trigger language plpgsql set search_path = public as $$
declare
  v text;
  prev text;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    v := new.avatar_url;
    prev := case when tg_op = 'UPDATE' then old.avatar_url end;
  else
    v := new.logo_url;
    prev := case when tg_op = 'UPDATE' then old.logo_url end;
  end if;
  if v is null or v is not distinct from prev then return new; end if;
  if tg_table_name = 'profiles' and v ~ '^https://t\.me/i/userpic/' then return new; end if;
  if v !~ '/v-[0-9a-f]{64}\.webp$' then
    raise exception 'media_not_verified' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.trg_media_verified() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_01_profile_media_verified' and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_01_profile_media_verified before insert or update of avatar_url on public.profiles
      for each row execute function public.trg_media_verified();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_01_company_media_verified' and tgrelid = 'public.companies'::regclass) then
    create trigger trg_01_company_media_verified before insert or update of logo_url on public.companies
      for each row execute function public.trg_media_verified();
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Karantinda qolib ketgan fayllar (1 kundan eski; tekshirilgani allaqachon ommaviy bucket'da) — faqat service role
-- ---------------------------------------------------------------------------------------------------
create or replace function public.stale_raw_media(p_limit int default 200)
returns table (bucket_id text, name text)
language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id = 'media-uploads' and o.created_at < now() - interval '1 day'
  order by o.created_at
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;
revoke execute on function public.stale_raw_media(int) from public, anon, authenticated;
grant execute on function public.stale_raw_media(int) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- 5. Imkoniyat bayrog'i
-- ---------------------------------------------------------------------------------------------------
create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true, 'photo_quarantine', true, 'media_quarantine', true);
$$;
