-- ISH.UZ · 0026 · xavfsizlik:
-- 1) Kompaniya logotiplari ommaviy bucket'da — SVG ichida skript bo'lishi mumkin (stored XSS). SVG taqiqlanadi.
-- 2) Vakansiya yaratish spam'ga qarshi cheklov: bir foydalanuvchi sutkasiga 30 ta, soatiga 10 ta.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'company-logos';
  end if;
end $$;

create or replace function public.trg_vacancy_create_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- faqat foydalanuvchi yaratganda (service role, migratsiya va tizim ishlari cheklanmaydi)
  -- definer ichida current_user = egasi, shuning uchun chaqiruvchi roli JWT'dan olinadi
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'authenticated' then return new; end if;
  if auth.uid() is not null and not public.is_admin() then
    if not public.check_rate_limit('vacancy_create_h:' || auth.uid(), 10, 3600)
       or not public.check_rate_limit('vacancy_create_d:' || auth.uid(), 30, 86400) then
      raise exception 'rate_limited' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_vacancy_create_rate_limit on public.vacancies;
create trigger trg_vacancy_create_rate_limit before insert on public.vacancies for each row execute function public.trg_vacancy_create_rate_limit();
revoke execute on function public.trg_vacancy_create_rate_limit() from public, anon, authenticated;
