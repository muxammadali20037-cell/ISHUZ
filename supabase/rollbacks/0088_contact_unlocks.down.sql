-- 0088 qaytarish: ishchi raqamini ochish (pullik rejim, juftliklar, chat) va raqamsiz e'lon cheklovi olib tashlanadi.
-- Eslatma: enum qiymati 'contact_unlock' olib tashlanmaydi (ishlatilmasa zarari yo'q). Funksiyalar 0080/0081/0084/0049/0008
-- holatiga qaytariladi — shu fayllardagi tegishli bo'limlarni qayta ishga tushiring (create or replace):
--   0080 §4–§7 (create_payment, apply_payment_internal, wallet_enabled, billing_guard_payment),
--   0081 §3 (simple_worker_listing — 1 argumentli), 0084 (listing_phones_public), 0049 (moderation_try_list_worker,
--   my_listing_state), 0008 (my_conversations), 0086 (can_view_phone yamog'i).
-- Yashirilgan raqamsiz e'lonlar publish_requested = true bilan qoladi — egasi saqlasa qaytadi.
begin;
drop trigger if exists trg_worker_b_phone_gate on public.worker_profiles;
drop trigger if exists trg_listing_phone_relist on public.worker_listing_phones;
drop trigger if exists trg_contact_phone_relist on public.profile_contacts;
drop function if exists public.trg_worker_b_phone_gate();
drop function if exists public.trg_listing_phone_relist();
drop function if exists public.trg_contact_phone_relist();
drop function if exists public.relist_worker_phone_ready(uuid, uuid);
drop function if exists public.my_listings_without_phone();
drop function if exists public.open_contact_chat(uuid);
drop function if exists public.unlock_worker_contact(uuid);
drop function if exists public.contact_unlock_quote(uuid);
alter table public.conversations drop constraint if exists conversations_source_check;
delete from public.conversations where unlock_viewer is not null;
alter table public.conversations add constraint conversations_source_check check (num_nonnulls(application_id, job_offer_id) = 1);
alter table public.conversations drop constraint if exists conversations_unlock_fkey;
drop index if exists public.conversations_unlock_pair_idx;
alter table public.conversations drop column if exists unlock_viewer, drop column if exists unlock_target;
update public.app_settings set value = 'false'::jsonb where key in ('contact_unlock_paid', 'worker_phone_required');
commit;
-- So'ng: yuqorida sanalgan funksiyalarni eski holatiga qaytaring; contact_unlocks jadvali (tarix) qoldiriladi.
