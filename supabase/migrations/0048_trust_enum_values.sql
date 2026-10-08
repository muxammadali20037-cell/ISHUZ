-- ISH.UZ · 0048 · yangi enum qiymatlari (alohida fayl: ADD VALUE yangi qiymatni o'sha tranzaksiyada ishlatib bo'lmaydi)
-- analyst — faqat statistika ko'radigan admin roli; suspended — ish beruvchi faoliyati to'xtatilgan.
alter type public.admin_role add value if not exists 'analyst';
alter type public.verification_status add value if not exists 'suspended';
