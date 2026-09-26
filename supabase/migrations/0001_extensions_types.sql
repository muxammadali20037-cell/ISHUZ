-- ISH.UZ · 0001 · kengaytmalar va enum turlar
-- Supabase'da kengaytmalar `extensions` sxemasida turadi; shuning uchun hamma joyda to'liq nom bilan murojaat qilinadi.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Matn qidiruv konfiguratsiyasi: lotin/kirill, diakritikasiz
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'ishuz') then
    create text search configuration public.ishuz (copy = simple);
    alter text search configuration public.ishuz
      alter mapping for hword, hword_part, word with extensions.unaccent, simple;
  end if;
end $$;

create type public.app_role as enum ('worker', 'employer');
create type public.gender as enum ('male', 'female');
create type public.app_locale as enum ('uz', 'ru', 'en');
create type public.phone_visibility as enum ('nobody', 'applicants', 'on_request', 'everyone');

create type public.experience_level as enum ('none', 'lt_6m', '6_12m', '1_2y', '2_3y', '3_5y', '5y_plus');
create type public.education_level as enum ('secondary', 'vocational', 'incomplete_higher', 'higher', 'master');
create type public.skill_level as enum ('beginner', 'intermediate', 'good', 'professional');
create type public.language_level as enum ('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native');

create type public.employment_type as enum ('permanent', 'temporary', 'part_time', 'full_time', 'shift', 'remote', 'freelance', 'internship');
create type public.work_schedule as enum ('5_2', '6_1', '2_2', 'shift', 'flexible', 'negotiable');
create type public.salary_type as enum ('monthly', 'daily', 'hourly', 'piecework', 'negotiable');
create type public.availability as enum ('today', 'tomorrow', 'within_3_days', 'within_week', 'negotiable');
create type public.work_format as enum ('official', 'unofficial', 'any');
create type public.remote_preference as enum ('yes', 'no', 'any');
create type public.worker_status as enum ('active', 'open', 'not_looking');

create type public.employer_type as enum ('company', 'individual_entrepreneur', 'person');
create type public.company_member_role as enum ('owner', 'admin', 'recruiter', 'viewer');
create type public.company_size as enum ('1_10', '11_50', '51_200', '201_500', '500_plus');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.verification_type as enum ('phone', 'telegram', 'identity', 'education', 'company', 'tin', 'documents');

create type public.vacancy_status as enum ('draft', 'pending_review', 'active', 'paused', 'closed', 'expired', 'hidden', 'rejected');
create type public.application_status as enum ('sent', 'viewed', 'shortlisted', 'interview', 'offered', 'hired', 'rejected', 'withdrawn');
create type public.offer_status as enum ('sent', 'viewed', 'accepted', 'declined', 'expired', 'withdrawn');
create type public.portfolio_type as enum ('image', 'video', 'pdf', 'document', 'link');

create type public.message_type as enum ('text', 'image', 'document', 'location', 'voice', 'system');
create type public.notification_type as enum (
  'application_received', 'application_status', 'offer_received', 'offer_response',
  'new_message', 'interview_invite', 'vacancy_expiring', 'new_matching_vacancy', 'new_matching_worker',
  'verification_result', 'review_received', 'system'
);
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.report_target as enum ('profile', 'vacancy', 'company', 'message', 'review');
create type public.report_reason as enum ('fraud', 'fake_vacancy', 'asked_money', 'wrong_info', 'spam', 'abuse', 'other');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.admin_role as enum ('super_admin', 'admin', 'moderator', 'support');
create type public.device_platform as enum ('web', 'android', 'ios');

-- updated_at ustunini avtomatik yangilash
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- "Kassir-konsultant INDEX" -> "kassir-konsultant-index"
create or replace function public.slugify(input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(coalesce(input, ''))),
    '[^a-z0-9а-яёўқғҳ]+', '-', 'g'));
$$;

create or replace function public.experience_level_months(level public.experience_level)
returns int language sql immutable as $$
  select case level
    when 'none' then 0
    when 'lt_6m' then 3
    when '6_12m' then 9
    when '1_2y' then 18
    when '2_3y' then 30
    when '3_5y' then 48
    when '5y_plus' then 72
  end;
$$;

create or replace function public.education_rank(level public.education_level)
returns int language sql immutable as $$
  select case level
    when 'secondary' then 1
    when 'vocational' then 2
    when 'incomplete_higher' then 3
    when 'higher' then 4
    when 'master' then 5
    else 0
  end;
$$;

create or replace function public.language_level_rank(level public.language_level)
returns int language sql immutable as $$
  select case level
    when 'a1' then 1 when 'a2' then 2 when 'b1' then 3
    when 'b2' then 4 when 'c1' then 5 when 'c2' then 6 when 'native' then 7
    else 0 end;
$$;

-- Haversine, km
create or replace function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371.0 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
  end;
$$;
