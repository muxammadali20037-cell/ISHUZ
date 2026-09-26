-- ISH.UZ · 0010 · Row Level Security
-- Qoida: hamma jadvalda RLS yoqiq. Yozish asosan RPC (security definer) orqali;
-- to'g'ridan-to'g'ri insert/update faqat egasi uchun.

-- ---------- ma'lumotnoma: hamma o'qiydi, admin yozadi ----------
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.skills enable row level security;
alter table public.regions enable row level security;
alter table public.districts enable row level security;
alter table public.languages enable row level security;
alter table public.benefits enable row level security;
alter table public.app_settings enable row level security;

create policy "categories_read" on public.categories for select using (true);
create policy "categories_admin" on public.categories for all using (public.has_admin_permission('categories.manage')) with check (public.has_admin_permission('categories.manage'));
create policy "subcategories_read" on public.subcategories for select using (true);
create policy "subcategories_admin" on public.subcategories for all using (public.has_admin_permission('categories.manage')) with check (public.has_admin_permission('categories.manage'));
create policy "skills_read" on public.skills for select using (is_approved or created_by = auth.uid() or public.is_admin());
create policy "skills_insert_custom" on public.skills for insert to authenticated with check (is_custom and created_by = auth.uid() and not is_approved);
create policy "skills_admin" on public.skills for all using (public.has_admin_permission('skills.manage')) with check (public.has_admin_permission('skills.manage'));
create policy "regions_read" on public.regions for select using (true);
create policy "regions_admin" on public.regions for all using (public.has_admin_permission('regions.manage')) with check (public.has_admin_permission('regions.manage'));
create policy "districts_read" on public.districts for select using (true);
create policy "districts_admin" on public.districts for all using (public.has_admin_permission('regions.manage')) with check (public.has_admin_permission('regions.manage'));
create policy "languages_read" on public.languages for select using (true);
create policy "benefits_read" on public.benefits for select using (true);
create policy "app_settings_read" on public.app_settings for select using (is_public or public.is_admin());
create policy "app_settings_admin" on public.app_settings for all using (public.has_admin_permission('settings.manage')) with check (public.has_admin_permission('settings.manage'));

-- ---------- identitet ----------
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.user_roles enable row level security;
alter table public.telegram_accounts enable row level security;
alter table public.device_tokens enable row level security;
alter table public.contact_grants enable row level security;
alter table public.admin_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Profil (ism, avatar) — kirgan foydalanuvchilar ko'radi; bloklanganlar faqat o'ziga va adminga
create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or not is_blocked);
create policy "profiles_read_public_names" on public.profiles for select to anon
  using (not is_blocked and exists (select 1 from public.vacancies v where v.owner_profile_id = profiles.id and v.status = 'active'));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and is_blocked = (select p.is_blocked from public.profiles p where p.id = auth.uid()));

-- Kontaktlar — faqat egasi (boshqalar get_contact() RPC orqali, ruxsat bo'lsa)
create policy "contacts_own" on public.profile_contacts for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "contacts_update_own" on public.profile_contacts for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid()
    and phone is not distinct from (select c.phone from public.profile_contacts c where c.profile_id = auth.uid())
    and phone_verified_at is not distinct from (select c.phone_verified_at from public.profile_contacts c where c.profile_id = auth.uid()));

create policy "user_roles_own" on public.user_roles for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "telegram_own" on public.telegram_accounts for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "device_tokens_own" on public.device_tokens for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "contact_grants_own" on public.contact_grants for all to authenticated
  using (owner_profile_id = auth.uid() or grantee_profile_id = auth.uid()) with check (owner_profile_id = auth.uid());
create policy "admin_users_read" on public.admin_users for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "admin_users_manage" on public.admin_users for all using (public.has_admin_permission('admins.manage')) with check (public.has_admin_permission('admins.manage'));
create policy "audit_logs_read" on public.audit_logs for select using (public.has_admin_permission('audit.view'));
-- rate_limits: hech kim to'g'ridan-to'g'ri o'qimaydi/yozmaydi (faqat security definer funksiyalar)

-- ---------- ish qidiruvchi ----------
alter table public.worker_profiles enable row level security;
alter table public.worker_geo enable row level security;
alter table public.worker_preferences enable row level security;
alter table public.worker_locations enable row level security;
alter table public.worker_skills enable row level security;
alter table public.worker_languages enable row level security;
alter table public.worker_experience enable row level security;
alter table public.worker_education enable row level security;
alter table public.worker_portfolio enable row level security;

create or replace function public.can_view_worker(p_worker_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.worker_profiles w join public.profiles p on p.id = w.profile_id
    where w.id = p_worker_id and (
      w.profile_id = auth.uid() or public.is_admin()
      or (auth.uid() is not null and w.is_public and not p.is_blocked and w.onboarding_completed_at is not null)
    ));
$$;

create policy "worker_profiles_read" on public.worker_profiles for select to authenticated using (public.can_view_worker(id));
create policy "worker_profiles_insert" on public.worker_profiles for insert to authenticated with check (profile_id = auth.uid() and not public.is_blocked(auth.uid()));
create policy "worker_profiles_update" on public.worker_profiles for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "worker_profiles_delete" on public.worker_profiles for delete to authenticated using (profile_id = auth.uid());

create policy "worker_geo_own" on public.worker_geo for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_preferences_read" on public.worker_preferences for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_preferences_write" on public.worker_preferences for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_locations_read" on public.worker_locations for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_locations_write" on public.worker_locations for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_skills_read" on public.worker_skills for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_skills_write" on public.worker_skills for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_languages_read" on public.worker_languages for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_languages_write" on public.worker_languages for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_experience_read" on public.worker_experience for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_experience_write" on public.worker_experience for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_education_read" on public.worker_education for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_education_write" on public.worker_education for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

create policy "worker_portfolio_read" on public.worker_portfolio for select to authenticated using (public.can_view_worker(worker_id));
create policy "worker_portfolio_write" on public.worker_portfolio for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());

-- ---------- ish beruvchi ----------
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.verification_requests enable row level security;

create policy "companies_read" on public.companies for select using (not is_blocked or public.is_company_member(id) or public.is_admin());
create policy "companies_insert" on public.companies for insert to authenticated with check (created_by = auth.uid() and not public.is_blocked(auth.uid()));
create policy "companies_update" on public.companies for update to authenticated
  using (public.is_company_admin(id))
  with check (public.is_company_admin(id)
    and verification_status is not distinct from (select c.verification_status from public.companies c where c.id = companies.id)
    and is_blocked is not distinct from (select c.is_blocked from public.companies c where c.id = companies.id));
create policy "companies_admin" on public.companies for update using (public.has_admin_permission('employers.verify')) with check (public.has_admin_permission('employers.verify'));

create policy "company_members_read" on public.company_members for select to authenticated using (public.is_company_member(company_id) or profile_id = auth.uid() or public.is_admin());
create policy "company_members_manage" on public.company_members for insert to authenticated with check (public.is_company_admin(company_id) and role <> 'owner');
create policy "company_members_update" on public.company_members for update to authenticated using (public.is_company_admin(company_id) and role <> 'owner') with check (public.is_company_admin(company_id) and role <> 'owner');
create policy "company_members_delete" on public.company_members for delete to authenticated using ((public.is_company_admin(company_id) and role <> 'owner') or (profile_id = auth.uid() and role <> 'owner'));

create policy "employer_profiles_read" on public.employer_profiles for select to authenticated using (true);
create policy "employer_profiles_insert" on public.employer_profiles for insert to authenticated with check (profile_id = auth.uid() and not public.is_blocked(auth.uid()));
create policy "employer_profiles_update" on public.employer_profiles for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid()
    and verification_status is not distinct from (select e.verification_status from public.employer_profiles e where e.profile_id = auth.uid())
    and (company_id is null or public.is_company_member(company_id)));

create policy "verification_requests_own" on public.verification_requests for select to authenticated using (profile_id = auth.uid() or public.has_admin_permission('employers.verify'));
create policy "verification_requests_insert" on public.verification_requests for insert to authenticated
  with check (profile_id = auth.uid() and status = 'pending' and (company_id is null or public.is_company_admin(company_id)));

-- ---------- vakansiyalar ----------
alter table public.vacancies enable row level security;
alter table public.vacancy_skills enable row level security;
alter table public.vacancy_languages enable row level security;
alter table public.vacancy_benefits enable row level security;

create policy "vacancies_read_active" on public.vacancies for select using (status = 'active');
create policy "vacancies_read_own" on public.vacancies for select to authenticated using (public.manages_vacancy(id) or public.has_admin_permission('vacancies.view'));
create policy "vacancies_insert" on public.vacancies for insert to authenticated
  with check (owner_profile_id = auth.uid() and status = 'draft' and not public.is_blocked(auth.uid())
    and (company_id is null or public.is_company_member(company_id)));
create policy "vacancies_update" on public.vacancies for update to authenticated
  using (public.manages_vacancy(id))
  with check (public.manages_vacancy(id)
    and status in ('draft', 'paused', 'closed', 'pending_review')  -- active/hidden ga o'tish faqat RPC orqali
    and (company_id is null or public.is_company_member(company_id))
    and is_featured is not distinct from (select v.is_featured from public.vacancies v where v.id = vacancies.id));
create policy "vacancies_delete" on public.vacancies for delete to authenticated using (public.manages_vacancy(id) and status in ('draft', 'closed', 'expired', 'rejected'));

create policy "vacancy_skills_read" on public.vacancy_skills for select using (exists (select 1 from public.vacancies v where v.id = vacancy_id));
create policy "vacancy_skills_write" on public.vacancy_skills for all to authenticated using (public.manages_vacancy(vacancy_id)) with check (public.manages_vacancy(vacancy_id));
create policy "vacancy_languages_read" on public.vacancy_languages for select using (exists (select 1 from public.vacancies v where v.id = vacancy_id));
create policy "vacancy_languages_write" on public.vacancy_languages for all to authenticated using (public.manages_vacancy(vacancy_id)) with check (public.manages_vacancy(vacancy_id));
create policy "vacancy_benefits_read" on public.vacancy_benefits for select using (exists (select 1 from public.vacancies v where v.id = vacancy_id));
create policy "vacancy_benefits_write" on public.vacancy_benefits for all to authenticated using (public.manages_vacancy(vacancy_id)) with check (public.manages_vacancy(vacancy_id));

-- ---------- arizalar, takliflar ----------
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.job_offers enable row level security;
alter table public.saved_vacancies enable row level security;
alter table public.saved_workers enable row level security;
alter table public.matches enable row level security;

create policy "applications_read" on public.applications for select to authenticated
  using (worker_id = public.current_worker_id() or public.manages_vacancy(vacancy_id) or public.is_admin());
-- insert/update faqat apply_to_vacancy / set_application_status RPC orqali
create policy "application_events_read" on public.application_events for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and (a.worker_id = public.current_worker_id() or public.manages_vacancy(a.vacancy_id))) or public.is_admin());

create policy "job_offers_read" on public.job_offers for select to authenticated
  using (worker_id = public.current_worker_id() or employer_profile_id = auth.uid() or (company_id is not null and public.is_company_member(company_id)) or public.is_admin());
-- insert/update faqat send_offer / respond_offer / withdraw_offer RPC orqali

create policy "saved_vacancies_own" on public.saved_vacancies for all to authenticated
  using (worker_id = public.current_worker_id()) with check (worker_id = public.current_worker_id());
create policy "saved_workers_own" on public.saved_workers for all to authenticated
  using (employer_profile_id = auth.uid()) with check (employer_profile_id = auth.uid() and public.current_employer_id() is not null);

create policy "matches_read" on public.matches for select to authenticated
  using (worker_id = public.current_worker_id() or public.manages_vacancy(vacancy_id));

-- ---------- chat ----------
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "conversations_member" on public.conversations for select to authenticated
  using (public.is_conversation_member(id) or public.is_admin());
create policy "conversation_members_read" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id) or public.is_admin());
create policy "conversation_members_update_own" on public.conversation_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "messages_read" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id) or public.is_admin());
create policy "messages_delete_own" on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
-- insert faqat send_message RPC orqali

-- ---------- bildirishnoma, sharh, shikoyat ----------
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

create policy "notifications_own" on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "notifications_delete_own" on public.notifications for delete to authenticated using (profile_id = auth.uid());

create policy "reviews_read" on public.reviews for select using (status = 'approved' or author_profile_id = auth.uid() or target_profile_id = auth.uid() or public.is_admin());
-- insert faqat create_review RPC orqali

create policy "reports_insert" on public.reports for insert to authenticated with check (reporter_profile_id = auth.uid() and status = 'open');
create policy "reports_read" on public.reports for select to authenticated using (reporter_profile_id = auth.uid() or public.has_admin_permission('reports.view'));

-- ---------- Realtime uchun publikatsiya ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.applications, public.job_offers, public.conversations;
  end if;
end $$;

-- ---------- Funksiyalarga kirish huquqlari ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.slugify(text), public.distance_km(double precision, double precision, double precision, double precision),
  public.experience_level_months(public.experience_level), public.education_rank(public.education_level), public.language_level_rank(public.language_level)
  to anon, authenticated;
grant execute on function public.search_vacancies(text, uuid, uuid, uuid, uuid[], int, public.employment_type[], public.work_schedule[], public.work_format, int, boolean, text[], boolean, boolean, boolean, uuid, text, int, int) to anon, authenticated;
grant execute on function public.record_vacancy_view(uuid), public.profile_rating(uuid) to anon, authenticated;
-- RLS siyosatlari va security invoker qidiruv ichida ishlatiladigan predikatlar (anon uchun ham kerak)
grant execute on function public.current_profile_id(), public.is_admin(), public.has_admin_permission(text), public.is_blocked(uuid),
  public.is_company_member(uuid), public.is_company_admin(uuid), public.current_worker_id(), public.current_employer_id(),
  public.manages_vacancy(uuid), public.can_view_worker(uuid), public.compute_match(uuid, uuid), public.is_conversation_member(uuid) to anon;
grant execute on function
  public.current_profile_id(), public.is_admin(), public.has_admin_permission(text), public.is_blocked(uuid),
  public.can_view_phone(uuid), public.get_contact(uuid), public.compute_match(uuid, uuid),
  public.refresh_matches_for_worker(uuid), public.refresh_matches_for_vacancy(uuid),
  public.search_workers(text, uuid, uuid, uuid, uuid[], int, int, public.work_schedule[], public.employment_type[], public.work_format, public.gender, public.education_level, text[], uuid[], public.worker_status[], public.availability[], boolean, boolean, boolean, uuid, double precision, double precision, double precision, text, int, int),
  public.record_worker_view(uuid), public.publish_vacancy(uuid), public.set_vacancy_status(uuid, public.vacancy_status),
  public.apply_to_vacancy(uuid, text), public.set_application_status(uuid, public.application_status, text),
  public.send_offer(uuid, uuid, text, text, int, int), public.respond_offer(uuid, boolean), public.mark_offer_viewed(uuid), public.withdraw_offer(uuid),
  public.get_or_create_conversation(uuid, uuid), public.send_message(uuid, public.message_type, text, text, jsonb, double precision, double precision),
  public.mark_conversation_read(uuid), public.set_conversation_block(uuid, boolean), public.my_conversations(),
  public.mark_notifications_read(bigint[]), public.unread_counts(), public.create_review(uuid, int, text),
  public.employer_dashboard_stats(), public.worker_dashboard_stats(), public.recommended_vacancies(int), public.recommended_workers(uuid, int),
  public.worker_completeness(uuid), public.refresh_worker_completeness(uuid), public.touch_last_seen(),
  public.is_company_member(uuid), public.is_company_admin(uuid), public.current_worker_id(), public.current_employer_id(), public.manages_vacancy(uuid), public.can_view_worker(uuid), public.is_conversation_member(uuid),
  public.admin_set_user_block(uuid, boolean, text), public.admin_set_vacancy_status(uuid, public.vacancy_status, text),
  public.admin_review_verification(uuid, public.verification_status, text), public.admin_resolve_report(uuid, public.report_status, text),
  public.admin_moderate_review(uuid, public.review_status, text), public.admin_broadcast(text, text, public.app_role, text),
  public.admin_stats(), public.admin_daily_stats(int)
  to authenticated;
-- Faqat server (service_role): expire_vacancies, notify_expiring_vacancies, notify_matching_workers, check_rate_limit, write_audit, notify
grant execute on all functions in schema public to service_role;
