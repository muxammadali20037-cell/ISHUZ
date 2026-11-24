-- ISH TOPDIM · 0090 · Kanalga usta e'lonlari
--
-- Ega (2026-11-24): "ustalar joylagan e'lonlar ham kanalga — ishchi e'lonlari kanaliga". channel_posts (0079) — har e'lon har
-- kanalga bir marta yuborilishini kuzatadi; endi usta e'loni ham: entity_type = 'master'.
-- Hech narsa o'chirilmaydi; takror ishga tushirish xavfsiz.

alter table public.channel_posts drop constraint if exists channel_posts_entity_type_check;
alter table public.channel_posts add constraint channel_posts_entity_type_check check (entity_type in ('vacancy', 'worker', 'master'));
