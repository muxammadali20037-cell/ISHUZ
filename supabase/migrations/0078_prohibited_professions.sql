-- 0078 · Taqiqlangan kasblar katalogdan olinadi (ega, 2026-11-13: "massaj, spa kerak emas — hammasi shundan boshlanadi")
--
-- Massaj va spa kasblari (Massajchi, Spa massajchi, yuz/tay/antitsellyulit massaji …) va "massaj" bo'limi katalogda
-- ko'rsatilmaydi va tanlanmaydi. O'CHIRILMAYDI: is_active = false, selectable = false — kerak bo'lsa admin qaytaradi.
-- Ilova ham bu nomlarni katalogdan yashiradi (src/features/moderation/policy.ts) — bu migratsiya bazani shunga moslaydi.
-- Takror ishga tushirish xavfsiz (faqat hali faol qatorlar yangilanadi).

update public.profession_nodes
   set is_active = false, selectable = false
 where is_active
   and (name_uz ~* '(massaj|masaj|massaz)'
        or name_ru ~* 'массаж'
        or coalesce(name_en, '') ~* 'massage'
        or name_uz ~* '(^|[^a-z])spa([^a-z]|$)'
        or name_ru ~* '(^|[^а-я])спа([^а-я]|$)'
        or slug ~ '(massage|(^|-)spa(-|$))');

update public.subcategories
   set is_active = false
 where is_active
   and (slug ~ '(massage|(^|-)spa(-|$))' or name_uz ~* 'massaj' or name_ru ~* 'массаж');
