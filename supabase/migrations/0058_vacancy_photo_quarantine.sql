-- 0058 · Ish joyi surati (F-06): karantin → serverda tekshirish va qayta kodlash → o'zgarmas, tekshirilgan fayl.
--
--  1) vacancy-uploads — YOPIQ karantin bucket: brauzer xom faylni faqat o'z papkasiga yuklaydi, o'qiy/almashtira olmaydi.
--  2) Server (service role) faylni o'qiydi, mazmunini tekshiradi, EXIF/joylashuvsiz WebP qilib qayta kodlaydi va ommaviy
--     vacancy-photos ga <egasi>/v-<sha256>.webp nomi bilan yozadi. Mijoz "v-" fayllarni yoza, almashtira, o'chira olmaydi.
--  3) Mijoz (to'g'ridan-to'g'ri yoki RPC orqali) vakansiyaga faqat o'z papkasidagi tekshirilgan yo'lni yoza oladi.
--     Mavjud (eski) yo'llar o'zgarmasa tegilmaydi — eski e'lonlar va rasmlar saqlanadi.
--  4) stale_raw_vacancy_photos() — tashlab ketilgan fayllar ro'yxati (faqat service role; o'chirish Storage API orqali).
--
-- Faqat qo'shimcha: DROP/DELETE yo'q; mavjud siyosatlar ALTER POLICY bilan toraytiriladi (nomi va maqsadi o'sha).
-- Tartib: kod (vacancy-uploads bo'lmasa eski bucket bilan ishlaydi) 0058 dan oldin ham, keyin ham ishlaydi.
-- Rollback: 0049 dagi uch vacancy_photos_* siyosat ifodasini ALTER POLICY bilan qaytarish; trg_vacancy_a_photo_verified
--           triggerini o'chirish; simple_listing_features() ni 0057 dagi holatga qaytarish.

-- ---------------------------------------------------------------------------------------------------
-- 1. Karantin bucket (yopiq)
-- ---------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vacancy-uploads', 'vacancy-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_uploads_insert') then
    -- faqat INSERT: o'qish (SELECT), almashtirish (UPDATE) va o'chirish (DELETE) siyosati yo'q — xom fayl faqat serverga
    create policy "vacancy_uploads_insert" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'vacancy-uploads'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Ommaviy vacancy-photos: mijoz tekshirilgan ("v-") fayllarga tega olmaydi
-- ---------------------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_photos_write') then
    alter policy "vacancy_photos_write" on storage.objects
      with check (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and name !~ '/v-[^/]*$');
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_photos_update') then
    alter policy "vacancy_photos_update" on storage.objects
      using (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and name !~ '/v-[^/]*$')
      with check (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and name !~ '/v-[^/]*$');
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vacancy_photos_delete') then
    alter policy "vacancy_photos_delete" on storage.objects
      using (bucket_id = 'vacancy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and name !~ '/v-[^/]*$');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Vakansiyaga faqat tekshirilgan yo'l (mijoz yozuvi: jadvalga to'g'ridan-to'g'ri yoki SECURITY DEFINER RPC orqali)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.trg_vacancy_photo_verified()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.photo_path is not null
     and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path)
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon')
     and new.photo_path !~ ('^' || coalesce(new.owner_profile_id::text, '-') || '/v-[0-9a-f]{64}\.webp$') then
    raise exception 'photo_not_verified' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.trg_vacancy_photo_verified() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_vacancy_a_photo_verified' and tgrelid = 'public.vacancies'::regclass) then
    create trigger trg_vacancy_a_photo_verified before insert or update of photo_path on public.vacancies
      for each row execute function public.trg_vacancy_photo_verified();
  end if;
end $$;

-- tozalashda "bu fayl ishlatilyaptimi?" tekshiruvi tez bo'lsin
create index if not exists vacancies_photo_path_idx on public.vacancies (photo_path) where photo_path is not null;

-- ---------------------------------------------------------------------------------------------------
-- 4. Tashlab ketilgan fayllar (faqat service role)
--    · karantin: 1 kundan eski har qanday xom fayl (tekshirilgani allaqachon vacancy-photos da);
--    · vacancy-photos: hech qaysi vakansiya ishlatmaydigan eski xom fayl (1 kun) yoki tekshirilgan fayl (15 kun —
--      qoralama muddati 14 kun, qoralamadagi rasm yo'qolmasin).
-- ---------------------------------------------------------------------------------------------------
create or replace function public.stale_raw_vacancy_photos(p_limit int default 200)
returns table (bucket_id text, name text)
language sql stable security definer set search_path = public, storage as $$
  with lim as (select greatest(1, least(coalesce(p_limit, 200), 1000)) as n)
  select s.bucket_id, s.name from (
    (select o.bucket_id, o.name, o.created_at from storage.objects o
      where o.bucket_id = 'vacancy-uploads' and o.created_at < now() - interval '1 day'
      order by o.created_at limit (select n from lim))
    union all
    (select o.bucket_id, o.name, o.created_at from storage.objects o
      where o.bucket_id = 'vacancy-photos'
        and o.created_at < now() - case when o.name ~ '/v-[0-9a-f]{64}\.webp$' then interval '15 days' else interval '1 day' end
        and not exists (select 1 from public.vacancies v where v.photo_path = o.name)
      order by o.created_at limit (select n from lim))
  ) s
  order by s.created_at
  limit (select n from lim);
$$;
revoke execute on function public.stale_raw_vacancy_photos(int) from public, anon, authenticated;
grant execute on function public.stale_raw_vacancy_photos(int) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- 5. Imkoniyat bayrog'i: ilova karantin bucket'ini faqat u mavjud bo'lsa ishlatadi
-- ---------------------------------------------------------------------------------------------------
create or replace function public.simple_listing_features()
returns jsonb language sql immutable security invoker set search_path = public as $$
  select jsonb_build_object('custom_profession', true, 'photo_quarantine', true);
$$;
