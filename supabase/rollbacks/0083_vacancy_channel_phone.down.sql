-- 0083 qaytarish: kanal roziligi ustuni olib tashlanadi — kanal postlari yana raqamsiz chiqadi
-- (ilova ustun yo'qligini ko'tara oladi: autopost xatoni yutadi, saqlash yangilashi e'tiborsiz qoladi).
alter table public.vacancy_contacts drop column if exists channel_phone_at;
