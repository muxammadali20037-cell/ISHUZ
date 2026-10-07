-- ISH.UZ · 0044 · 1 mln foydalanuvchiga tayyorgarlik: yetishmagan indekslar, eski ma'lumotlarni tozalash, autovacuum.
-- Idempotent (if not exists), drop'siz. Hozirgi hajmda oddiy create index bir zumda o'tadi.

-- Foydalanuvchi ma'lumotlari bo'yicha FK (hisob o'chirilganda kaskad va JOIN'lar ketma-ket o'qishsiz)
create index if not exists idx_contact_grants_grantee on public.contact_grants (grantee_profile_id);
create index if not exists idx_messages_sender on public.messages (sender_id);
create index if not exists idx_saved_vacancies_vacancy on public.saved_vacancies (vacancy_id);
create index if not exists idx_application_events_actor on public.application_events (actor_id);
create index if not exists idx_application_notes_author on public.application_notes (author_id);
create index if not exists idx_reports_reporter on public.reports (reporter_profile_id);
create index if not exists idx_reviews_author on public.reviews (author_profile_id);
create index if not exists idx_payments_vacancy on public.payments (vacancy_id) where vacancy_id is not null;
create index if not exists idx_payments_worker on public.payments (worker_id) where worker_id is not null;
create index if not exists idx_search_logs_profile on public.search_logs (profile_id) where profile_id is not null;
create index if not exists idx_bot_sessions_profile on public.bot_sessions (profile_id);
create index if not exists idx_job_offers_company on public.job_offers (company_id);
create index if not exists idx_login_codes_tg on public.login_codes (telegram_user_id);
create index if not exists idx_verification_requests_company on public.verification_requests (company_id);
create index if not exists idx_ai_job_alert_hits_vacancy on public.ai_job_alert_hits (vacancy_id);

-- Qidiruv: kategoriyasiz faqat hudud / tuman bo'yicha, kasb yo'nalishi bo'yicha nomzodlar
create index if not exists idx_vacancies_active_region on public.vacancies (region_id, published_at desc) where status = 'active';
create index if not exists idx_vacancies_active_district on public.vacancies (district_id) where status = 'active';
create index if not exists idx_vacancies_active_published on public.vacancies (published_at desc) where status = 'active';
create index if not exists idx_worker_profiles_region on public.worker_profiles (region_id) where is_public;
create index if not exists idx_worker_professions_node on public.worker_professions (node_id);

-- Aqlli AI qidiruv triggeri: faol kuzatuvlar kasb / hudud bo'yicha
create index if not exists idx_ai_job_alerts_node on public.ai_job_alerts (profession_node_id) where is_active;

-- Tez-tez yangilanadigan jadvallar: autovacuum ertaroq ishlasin (shishib ketmasin)
alter table public.notifications set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
alter table public.rate_limits set (autovacuum_vacuum_scale_factor = 0.05);
alter table public.vacancies set (autovacuum_analyze_scale_factor = 0.02);
alter table public.worker_profiles set (autovacuum_analyze_scale_factor = 0.02);

-- Eski bildirishnomalar: o'qilganlari 90 kundan, qolganlari 180 kundan keyin o'chiriladi (har kecha, bo'laklab)
create or replace function public.purge_old_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.notifications where id in (
    select id from public.notifications
    where (read_at is not null and created_at < now() - interval '90 days') or created_at < now() - interval '180 days'
    limit 50000);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_old_notifications() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ishuz-purge-notifications', '17 22 * * *', $job$select public.purge_old_notifications();$job$);
  end if;
end $$;
