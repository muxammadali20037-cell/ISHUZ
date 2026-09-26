-- ISH.UZ · 0014 · Supabase advisor: oddiy yordamchi funksiyalarga ham search_path mahkamlanadi
alter function public.set_updated_at() set search_path = public;
alter function public.slugify(text) set search_path = public, extensions;
alter function public.handle_company_slug() set search_path = public;
alter function public.distance_km(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.experience_level_months(public.experience_level) set search_path = public;
alter function public.education_rank(public.education_level) set search_path = public;
alter function public.language_level_rank(public.language_level) set search_path = public;
alter function public.current_profile_id() set search_path = public;
alter function public.application_stage_rank(public.application_status) set search_path = public;
