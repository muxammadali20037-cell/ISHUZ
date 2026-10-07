-- ISH.UZ · 0042 · Ish qidiruvchi e'loni (10 kun) uchun to'lov turi — alohida migratsiya (enum qiymati shu tranzaksiyada ishlatilmaydi)
alter type public.payment_purpose add value if not exists 'worker_listing';
