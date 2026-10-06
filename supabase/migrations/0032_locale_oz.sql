-- ISH BERUVCHI · 0032 · O'zbek kirill interfeysi: profiles.locale uchun 'oz' (o'zbek kirill) qiymati.
-- Bazadagi nomlar (soha, kasb, hudud) kirillda ilova tomonida lotin nomidan o'giriladi.
alter type public.app_locale add value if not exists 'oz' after 'uz';
