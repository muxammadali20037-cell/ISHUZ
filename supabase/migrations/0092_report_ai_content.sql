-- 0092 · AI yaratgan natijaga shikoyat (ega, 2026-11-25: Play Market'ga chiqish).
-- Google Play talabi (AI-Generated Content): AI bilan rasm yoki matn yaratadigan ilovada foydalanuvchi ilovadan chiqmasdan
-- haqoratli natija haqida xabar bera olishi kerak. Shikoyat oddiy shikoyatlar navbatiga (admin → Shikoyatlar) tushadi:
-- target_id — natija turi va izi ("listing_image:<xesh>"), details — nima yaratilgani (rasm havolasi yoki matn) va izoh.
-- Faqat yangi qiymat qo'shiladi; mavjud shikoyatlar va submit_report (blok, kunlik 20 ta, takror yo'q) o'zgarmaydi.
alter type public.report_target add value if not exists 'ai_content';
