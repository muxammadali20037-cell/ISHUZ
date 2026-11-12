-- 0077 qaytarish: namuna (demo) vakansiyalar to'liq olib tashlanadi (jadval va funksiyalar). Haqiqiy vakansiyalarga tegmaydi.
-- Faqat namunalarni olib tashlash uchun bu fayl SHART EMAS:  select public.demo_vacancies_remove();
begin;

drop function if exists public.demo_vacancies_remove();
drop function if exists public.demo_vacancies_seed();
drop function if exists public.demo_vacancy_public(text);
drop function if exists public.demo_vacancies_public(text, text, text, integer, integer);
drop function if exists public.demo_privileged();
drop table if exists public.demo_vacancies;

commit;
