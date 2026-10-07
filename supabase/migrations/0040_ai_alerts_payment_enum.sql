-- ISH.UZ · 0040 · Aqlli AI qidiruv obunasi uchun to'lov turi (alohida migratsiya: yangi enum qiymati
-- shu tranzaksiyada ishlatilmasligi kerak)
alter type public.payment_purpose add value if not exists 'ai_alerts';
