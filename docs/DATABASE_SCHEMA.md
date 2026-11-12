# Ma'lumotlar bazasi tuzilishi (DATABASE_SCHEMA)

> Avtomatik yaratilgan: barcha migratsiyalar (`supabase/migrations`) qo'llangan lokal bazadan (skript: `scripts/gen-docs.py`).
> Prod baza bilan farq bo'lishi mumkin: prod'dagi holatni `scripts/prod-migration-check.sql` ko'rsatadi.

Jami: **87 jadval** (RLS yoqilgan: 87), **312 funksiya**, **39 enum**.

Ustunlar: `ust.` — ustunlar soni, `RLS` — qator darajasidagi himoya, `sit.` — siyosatlar, `FK` — tashqi kalitlar, `ind.` — indekslar.

## Hisob va rollar (10)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `admin_users` | 7 | ha | 5 | 2 | 2 |
| `device_tokens` | 6 | ha | 4 | 1 | 3 |
| `login_codes` | 8 | ha | 0 | 1 | 3 |
| `profile_contacts` | 7 | ha | 5 | 1 | 2 |
| `profile_interests` | 3 | ha | 1 | 2 | 1 |
| `profiles` | 15 | ha | 6 | 1 | 1 |
| `telegram_accounts` | 13 | ha | 1 | 1 | 3 |
| `telegram_link_tokens` | 7 | ha | 0 | 1 | 2 |
| `user_roles` | 3 | ha | 1 | 1 | 1 |
| `web_login_requests` | 9 | ha | 0 | 0 | 3 |

## Ish izlovchi profili (Skill Passport asosi) (10)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `worker_education` | 8 | ha | 5 | 1 | 2 |
| `worker_experience` | 11 | ha | 5 | 1 | 2 |
| `worker_geo` | 4 | ha | 4 | 1 | 1 |
| `worker_languages` | 3 | ha | 5 | 2 | 1 |
| `worker_locations` | 2 | ha | 5 | 2 | 2 |
| `worker_portfolio` | 9 | ha | 5 | 1 | 2 |
| `worker_preferences` | 11 | ha | 5 | 1 | 1 |
| `worker_professions` | 4 | ha | 5 | 2 | 2 |
| `worker_profiles` | 37 | ha | 6 | 6 | 11 |
| `worker_skills` | 3 | ha | 5 | 2 | 2 |

## Kasb va katalog (12)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `benefits` | 6 | ha | 1 | 0 | 1 |
| `categories` | 11 | ha | 5 | 0 | 2 |
| `custom_occupation_requests` | 11 | ha | 6 | 5 | 5 |
| `districts` | 15 | ha | 5 | 1 | 4 |
| `languages` | 5 | ha | 1 | 0 | 1 |
| `profession_images` | 10 | ha | 1 | 1 | 1 |
| `profession_nodes` | 22 | ha | 5 | 4 | 7 |
| `regions` | 10 | ha | 5 | 0 | 3 |
| `skill_question_options` | 3 | ha | 5 | 2 | 1 |
| `skill_questions` | 12 | ha | 5 | 2 | 3 |
| `skills` | 12 | ha | 6 | 2 | 5 |
| `subcategories` | 11 | ha | 5 | 1 | 3 |

## Kompaniya va ish beruvchi (4)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `companies` | 22 | ha | 7 | 4 | 5 |
| `company_invites` | 9 | ha | 6 | 3 | 5 |
| `company_members` | 5 | ha | 6 | 3 | 3 |
| `employer_profiles` | 18 | ha | 6 | 4 | 3 |

## Vakansiyalar (5)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `vacancies` | 62 | ha | 9 | 7 | 21 |
| `vacancy_benefits` | 2 | ha | 5 | 2 | 1 |
| `vacancy_contacts` | 4 | ha | 5 | 1 | 1 |
| `vacancy_languages` | 3 | ha | 5 | 2 | 1 |
| `vacancy_skills` | 3 | ha | 5 | 2 | 2 |

## Arizalar va yollash (7)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `application_events` | 7 | ha | 1 | 2 | 3 |
| `application_notes` | 5 | ha | 6 | 2 | 3 |
| `applications` | 12 | ha | 1 | 2 | 4 |
| `contact_grants` | 3 | ha | 4 | 2 | 2 |
| `contact_requests` | 6 | ha | 1 | 2 | 3 |
| `contact_reveals` | 4 | ha | 0 | 1 | 2 |
| `job_offers` | 16 | ha | 1 | 4 | 5 |

## Moslash va tavsiyalar (10)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `ai_alert_subscriptions` | 3 | ha | 1 | 1 | 1 |
| `ai_job_alert_hits` | 3 | ha | 1 | 2 | 2 |
| `ai_job_alerts` | 19 | ha | 7 | 4 | 5 |
| `ai_usage_log` | 11 | ha | 0 | 0 | 2 |
| `ai_worker_alert_hits` | 3 | ha | 1 | 2 | 2 |
| `ai_worker_alerts` | 18 | ha | 7 | 4 | 5 |
| `match_jobs` | 11 | ha | 1 | 0 | 3 |
| `match_notifications` | 8 | ha | 1 | 3 | 4 |
| `match_subscriptions` | 13 | ha | 1 | 3 | 3 |
| `matches` | 9 | ha | 1 | 2 | 4 |

## Saqlanganlar va qidiruv (5)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `saved_items` | 5 | ha | 6 | 3 | 6 |
| `saved_searches` | 17 | ha | 4 | 4 | 4 |
| `saved_vacancies` | 4 | ha | 4 | 2 | 2 |
| `saved_workers` | 5 | ha | 4 | 2 | 2 |
| `search_logs` | 8 | ha | 1 | 1 | 4 |

## Xabarlar va bildirishnomalar (6)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `bot_sessions` | 6 | ha | 0 | 1 | 2 |
| `conversation_members` | 6 | ha | 5 | 2 | 2 |
| `conversations` | 6 | ha | 1 | 2 | 3 |
| `messages` | 11 | ha | 1 | 2 | 3 |
| `notifications` | 16 | ha | 6 | 1 | 7 |
| `telegram_updates` | 5 | ha | 0 | 0 | 1 |

## Ishonch, moderatsiya, xavfsizlik (8)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `audit_logs` | 10 | ha | 1 | 1 | 3 |
| `moderation_checks` | 16 | ha | 1 | 1 | 4 |
| `rate_limits` | 3 | ha | 0 | 0 | 1 |
| `reports` | 11 | ha | 1 | 2 | 5 |
| `reviews` | 12 | ha | 1 | 5 | 6 |
| `security_events` | 13 | ha | 1 | 0 | 4 |
| `security_restrictions` | 12 | ha | 1 | 1 | 3 |
| `verification_requests` | 13 | ha | 5 | 3 | 5 |

## To'lov (4)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `billing_usage` | 4 | ha | 1 | 1 | 1 |
| `payments` | 18 | ha | 1 | 3 | 6 |
| `wallet_ledger` | 6 | ha | 1 | 2 | 3 |
| `wallets` | 3 | ha | 1 | 1 | 1 |

## Tizim va analitika (2)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `analytics_events` | 6 | ha | 0 | 1 | 4 |
| `app_settings` | 4 | ha | 5 | 0 | 1 |

## Boshqa (4)

| Jadval | ust. | RLS | sit. | FK | ind. |
| --- | --- | --- | --- | --- | --- |
| `master_categories` | 9 | ha | 2 | 0 | 2 |
| `master_listings` | 30 | ha | 4 | 4 | 7 |
| `master_requests` | 8 | ha | 2 | 2 | 2 |
| `master_reviews` | 6 | ha | 2 | 2 | 3 |

## Enum turlari

| Enum | Qiymatlar |
| --- | --- |
| `admin_role` | super_admin, admin, moderator, support, analyst |
| `app_locale` | uz, oz, ru, en |
| `app_role` | worker, employer |
| `application_status` | sent, viewed, shortlisted, interview, offered, hired, rejected, withdrawn |
| `availability` | today, tomorrow, within_3_days, within_week, negotiable |
| `company_member_role` | owner, admin, recruiter, viewer |
| `company_size` | 1_10, 11_50, 51_200, 201_500, 500_plus |
| `contact_request_status` | pending, approved, declined |
| `device_platform` | web, android, ios |
| `education_level` | secondary, vocational, incomplete_higher, higher, master |
| `employer_type` | company, individual_entrepreneur, person, government, self_employed, other |
| `employment_type` | permanent, temporary, part_time, full_time, shift, remote, freelance, internship |
| `experience_level` | none, lt_6m, 6_12m, 1_2y, 2_3y, 3_5y, 5y_plus |
| `gender` | male, female |
| `language_level` | a1, a2, b1, b2, c1, c2, native |
| `master_listing_status` | draft, pending_review, active, hidden, rejected |
| `master_request_status` | new, seen, done |
| `message_type` | text, image, document, location, voice, system |
| `notification_type` | application_received, application_status, offer_received, offer_response, new_message, interview_invite, vacancy_expiring, new_matching_vacancy, new_matching_worker, verification_result, review_received, system |
| `offer_status` | sent, viewed, accepted, declined, expired, withdrawn |
| `opportunity_type` | job, fixed_term, one_time, seasonal, internship, practice, apprenticeship |
| `payment_provider` | payme, click, wallet |
| `payment_purpose` | vacancy_publish, worker_promotion, ai_alerts, worker_listing, wallet_topup |
| `payment_status` | pending, paid, cancelled, failed |
| `phone_visibility` | nobody, applicants, on_request, everyone |
| `portfolio_type` | image, video, pdf, document, link |
| `remote_preference` | yes, no, any |
| `report_reason` | fraud, fake_vacancy, asked_money, wrong_info, spam, abuse, other |
| `report_status` | open, in_review, resolved, dismissed |
| `report_target` | profile, vacancy, company, message, review |
| `review_status` | pending, approved, rejected |
| `salary_type` | monthly, daily, hourly, piecework, negotiable |
| `skill_level` | beginner, intermediate, good, professional |
| `vacancy_status` | draft, pending_review, active, paused, closed, expired, hidden, rejected |
| `verification_status` | unverified, pending, verified, rejected, suspended |
| `verification_type` | phone, telegram, identity, education, company, tin, documents |
| `work_format` | official, unofficial, any |
| `work_schedule` | 5_2, 6_1, 2_2, shift, flexible, negotiable |
| `worker_status` | active, open, not_looking |
