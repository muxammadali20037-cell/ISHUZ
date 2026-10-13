-- ISH.UZ · 0062 · Hamyon (F2) uchun to'lov turlari — alohida migratsiya (enum qiymati shu tranzaksiyada ishlatilmaydi):
--   wallet_topup — balansni Payme/Click orqali to'ldirish; wallet — xizmatga balansdan to'langan (ichki, pul tashqariga chiqmaydi).
-- Faqat qo'shimcha. Rollback: enum qiymatini olib tashlab bo'lmaydi — ishlatilmasa zarari yo'q.
alter type public.payment_purpose add value if not exists 'wallet_topup';
alter type public.payment_provider add value if not exists 'wallet';
