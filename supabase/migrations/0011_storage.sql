-- ISH.UZ · 0011 · Storage bucket'lar va siyosatlar (faqat Supabase muhitida ishlaydi)

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    raise notice 'storage sxemasi yo''q — o''tkazib yuborildi';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
    ('company-logos', 'company-logos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
    ('portfolio', 'portfolio', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('chat', 'chat', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/ogg', 'audio/mpeg', 'audio/webm',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('documents', 'documents', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
end $$;

-- Siyosatlar: fayl yo'li birinchi papkasi = egasining profile_id (avatars/company-logos: company_id yoki profile_id)
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then return; end if;

  execute $p$ create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars') $p$;
  execute $p$ create policy "avatars_own_write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "avatars_own_update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "avatars_own_delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;

  execute $p$ create policy "logos_public_read" on storage.objects for select using (bucket_id = 'company-logos') $p$;
  execute $p$ create policy "logos_member_write" on storage.objects for insert to authenticated with check (bucket_id = 'company-logos' and public.is_company_admin(((storage.foldername(name))[1])::uuid)) $p$;
  execute $p$ create policy "logos_member_update" on storage.objects for update to authenticated using (bucket_id = 'company-logos' and public.is_company_admin(((storage.foldername(name))[1])::uuid)) $p$;
  execute $p$ create policy "logos_member_delete" on storage.objects for delete to authenticated using (bucket_id = 'company-logos' and public.is_company_admin(((storage.foldername(name))[1])::uuid)) $p$;

  execute $p$ create policy "portfolio_public_read" on storage.objects for select using (bucket_id = 'portfolio') $p$;
  execute $p$ create policy "portfolio_own_write" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "portfolio_own_update" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "portfolio_own_delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text) $p$;

  -- chat/<conversation_id>/... : faqat suhbat a'zolari
  execute $p$ create policy "chat_member_read" on storage.objects for select to authenticated using (bucket_id = 'chat' and exists (
    select 1 from public.conversation_members m where m.conversation_id = ((storage.foldername(name))[1])::uuid and m.profile_id = auth.uid())) $p$;
  execute $p$ create policy "chat_member_write" on storage.objects for insert to authenticated with check (bucket_id = 'chat' and exists (
    select 1 from public.conversation_members m where m.conversation_id = ((storage.foldername(name))[1])::uuid and m.profile_id = auth.uid())) $p$;

  -- documents/<profile_id>/... : egasi va verifikatsiya admini
  execute $p$ create policy "documents_own_read" on storage.objects for select to authenticated using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_admin_permission('employers.verify'))) $p$;
  execute $p$ create policy "documents_own_write" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "documents_own_delete" on storage.objects for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
end $$;
