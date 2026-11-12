-- 0076 qaytarish: "Universal ustalar" moduli to'liq olib tashlanadi (jadvallar, funksiyalar, turlar). Faqat favqulodda,
-- egasi ruxsati bilan — usta e'lonlari, so'rovlar va sharhlar YO'QOLADI (avval zaxira nusxa).
begin;

drop function if exists public.master_demo_remove();
drop function if exists public.master_demo_seed();
drop function if exists public.master_privileged();
drop function if exists public.master_moderate(uuid, text, text);
drop function if exists public.master_review_add(uuid, int, text);
drop function if exists public.master_request_create(uuid, text, text, text, uuid);
drop function if exists public.master_listing_hit(uuid, text);
drop function if exists public.master_category_counts();
drop function if exists public.master_listing_public(text);
drop function if exists public.master_listings_public(uuid, uuid, text, int, text, int, int);

drop table if exists public.master_reviews;
drop table if exists public.master_requests;
drop table if exists public.master_listings;
drop table if exists public.master_categories;

drop function if exists public.trg_master_review_rating();
drop function if exists public.trg_master_listing_insert_guard();
drop function if exists public.trg_master_listing_owner_guard();
drop function if exists public.trg_master_listing_touch();
drop function if exists public.master_photos_ok(uuid, text[]);

drop type if exists public.master_request_status;
drop type if exists public.master_listing_status;

commit;
