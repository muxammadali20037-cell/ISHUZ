-- 0083 · Vakansiya raqami Telegram kanalda (ega, 2026-11-18: "rasm tagiga to'liq yozilsin, nomerlar bilan to'liq vakansiya").
--
--   vacancy_contacts.channel_phone_at — ish beruvchi "Aloqa raqamim e'londa va Telegram kanalda ko'rinsin" roziligini
--   bergan vaqt. Ilova e'lonni saqlaganda yozadi (egasining o'z RLS huquqi bilan: vacancy_contacts_write); rozilik
--   olib tashlansa — null. Kanal posti raqamni FAQAT show_phone = true va channel_phone_at bor bo'lsa ko'rsatadi.
--   Bu ustundan oldingi roziliklar (matnda kanal tilga olinmagan edi) — null, ya'ni kanalda raqamsiz.
--   Ishchi e'lonlari o'zgarmaydi: kanalda ism va telefon yo'q (ularga shunday va'da berilgan).
--
--   Qaytarish (rollback): supabase/rollbacks/0083_vacancy_channel_phone.down.sql

alter table public.vacancy_contacts add column if not exists channel_phone_at timestamptz;

comment on column public.vacancy_contacts.channel_phone_at is
  'Ish beruvchi raqamni Telegram kanal postida ko''rsatishga rozilik bergan vaqt (null — kanalda raqamsiz)';
