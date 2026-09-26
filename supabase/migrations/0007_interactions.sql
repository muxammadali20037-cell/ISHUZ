-- ISH.UZ · 0007 · arizalar, takliflar, saqlanganlar, moslik, chat, bildirishnoma, sharh, shikoyat

create table public.applications (
  id              uuid primary key default gen_random_uuid(),
  vacancy_id      uuid not null references public.vacancies(id) on delete cascade,
  worker_id       uuid not null references public.worker_profiles(id) on delete cascade,
  cover_message   text,
  status          public.application_status not null default 'sent',
  match_score     int,
  match_reasons   jsonb,
  viewed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (vacancy_id, worker_id),
  constraint applications_cover_check check (cover_message is null or length(cover_message) <= 1000)
);
create index idx_applications_worker on public.applications(worker_id, created_at desc);
create index idx_applications_vacancy on public.applications(vacancy_id, status, created_at desc);
create trigger trg_applications_updated before update on public.applications for each row execute function public.set_updated_at();

-- Ariza holati tarixi (timeline)
create table public.application_events (
  id              bigint generated always as identity primary key,
  application_id  uuid not null references public.applications(id) on delete cascade,
  from_status     public.application_status,
  to_status       public.application_status not null,
  actor_id        uuid references public.profiles(id) on delete set null,
  note            text,
  created_at      timestamptz not null default now()
);
create index idx_application_events_app on public.application_events(application_id, created_at);

create table public.job_offers (
  id                  uuid primary key default gen_random_uuid(),
  vacancy_id          uuid references public.vacancies(id) on delete cascade,      -- null = yangi (custom) taklif
  employer_profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id          uuid references public.companies(id) on delete set null,
  worker_id           uuid not null references public.worker_profiles(id) on delete cascade,
  title               text,                                                      -- custom taklif uchun lavozim
  message             text,
  salary_from         int,
  salary_to           int,
  status              public.offer_status not null default 'sent',
  viewed_at           timestamptz,
  responded_at        timestamptz,
  hired_at            timestamptz,                                               -- custom (vakansiyasiz) taklif bo'yicha ishga olindi
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint job_offers_title_check check (vacancy_id is not null or (title is not null and length(trim(title)) >= 2)),
  constraint job_offers_salary_check check (salary_from is null or salary_to is null or salary_to >= salary_from)
);
create unique index uq_job_offers_vacancy_worker on public.job_offers(vacancy_id, worker_id) where vacancy_id is not null and status in ('sent', 'viewed');
create index idx_job_offers_worker on public.job_offers(worker_id, created_at desc);
create index idx_job_offers_employer on public.job_offers(employer_profile_id, created_at desc);
create trigger trg_job_offers_updated before update on public.job_offers for each row execute function public.set_updated_at();

create table public.saved_vacancies (
  worker_id   uuid not null references public.worker_profiles(id) on delete cascade,
  vacancy_id  uuid not null references public.vacancies(id) on delete cascade,
  folder      text,
  created_at  timestamptz not null default now(),
  primary key (worker_id, vacancy_id)
);

create table public.saved_workers (
  employer_profile_id  uuid not null references public.profiles(id) on delete cascade,
  worker_id            uuid not null references public.worker_profiles(id) on delete cascade,
  folder               text,
  note                 text,
  created_at           timestamptz not null default now(),
  primary key (employer_profile_id, worker_id)
);
create index idx_saved_workers_worker on public.saved_workers(worker_id);

-- Moslik keshi
create table public.matches (
  worker_id    uuid not null references public.worker_profiles(id) on delete cascade,
  vacancy_id   uuid not null references public.vacancies(id) on delete cascade,
  score        int not null,
  reasons      jsonb not null default '[]'::jsonb,
  computed_at  timestamptz not null default now(),
  primary key (worker_id, vacancy_id),
  constraint matches_score_check check (score between 0 and 100)
);
create index idx_matches_vacancy_score on public.matches(vacancy_id, score desc);
create index idx_matches_worker_score on public.matches(worker_id, score desc);

-- Chat faqat ariza yoki taklif asosida
create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid unique references public.applications(id) on delete cascade,
  job_offer_id          uuid unique references public.job_offers(id) on delete cascade,
  last_message_at       timestamptz,
  last_message_preview  text,
  created_at            timestamptz not null default now(),
  constraint conversations_source_check check (num_nonnulls(application_id, job_offer_id) = 1)
);

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  last_read_at     timestamptz,
  is_muted         boolean not null default false,
  is_blocked       boolean not null default false,   -- bu a'zo suhbatdoshini bloklagan
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index idx_conversation_members_profile on public.conversation_members(profile_id);

create table public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid references public.profiles(id) on delete set null,
  type             public.message_type not null default 'text',
  body             text,
  attachment_path  text,                    -- storage: chat/<conversation_id>/...
  attachment_meta  jsonb,
  lat              double precision,
  lng              double precision,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint messages_body_check check (deleted_at is not null or (type = 'text' and body is not null and length(body) between 1 and 4000) or type <> 'text'),
  constraint messages_attachment_check check (type not in ('image', 'document', 'voice') or attachment_path is not null),
  constraint messages_location_check check (type <> 'location' or (lat is not null and lng is not null))
);
create index idx_messages_conversation on public.messages(conversation_id, created_at desc);

create table public.notifications (
  id                bigint generated always as identity primary key,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  type              public.notification_type not null,
  payload           jsonb not null default '{}'::jsonb,   -- {vacancy_title, company_name, application_id ...}
  link              text,
  read_at           timestamptz,
  telegram_sent_at  timestamptz,
  push_sent_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index idx_notifications_profile on public.notifications(profile_id, created_at desc);
create index idx_notifications_unread on public.notifications(profile_id) where read_at is null;
create index idx_notifications_telegram_queue on public.notifications(created_at) where telegram_sent_at is null;

create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  author_profile_id  uuid not null references public.profiles(id) on delete cascade,
  target_profile_id  uuid not null references public.profiles(id) on delete cascade,
  application_id     uuid references public.applications(id) on delete set null,  -- faqat real ish (hired) dan keyin
  job_offer_id       uuid references public.job_offers(id) on delete set null,     -- yoki custom taklif bo'yicha ishga olingandan keyin
  rating             int not null,
  text               text,
  status             public.review_status not null default 'pending',
  moderated_by       uuid references public.profiles(id) on delete set null,
  moderation_note    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_text_check check (text is null or length(text) <= 2000),
  constraint reviews_not_self check (author_profile_id <> target_profile_id)
);
create index idx_reviews_target on public.reviews(target_profile_id) where status = 'approved';
create unique index uq_reviews_application_author on public.reviews(application_id, author_profile_id) where application_id is not null;
create unique index uq_reviews_offer_author on public.reviews(job_offer_id, author_profile_id) where job_offer_id is not null;
create trigger trg_reviews_updated before update on public.reviews for each row execute function public.set_updated_at();

create table public.reports (
  id                   uuid primary key default gen_random_uuid(),
  reporter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  target_type          public.report_target not null,
  target_id            text not null,
  reason               public.report_reason not null,
  details              text,
  status               public.report_status not null default 'open',
  resolved_by          uuid references public.profiles(id) on delete set null,
  resolution_note      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint reports_details_check check (details is null or length(details) <= 2000)
);
create index idx_reports_status on public.reports(status, created_at desc);
create index idx_reports_target on public.reports(target_type, target_id);
create trigger trg_reports_updated before update on public.reports for each row execute function public.set_updated_at();
