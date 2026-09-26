# Onboarding (worker) — DB/RPC so'rovlar va eslatmalar

Modul hozirgi sxema bilan to'liq ishlaydi; quyidagilar ixtiyoriy yaxshilanishlar.

## 1. `profile_contacts.phone` ni to'g'ridan-to'g'ri o'rnatib bo'lmaydi (RLS)
`contacts_update_own` siyosati `phone is not distinct from (eski phone)` ni talab qiladi — hatto `phone` NULL bo'lsa ham
(subselect o'sha statement ichida eski qatorni ko'radi). Shu sababli onboarding'da telefon **faqat Supabase Auth "phone change" OTP** orqali
qo'shiladi (`auth.updateUser({ phone })` → `verifyOtp({ type: 'phone_change' })` → `on_auth_user_updated` trigger'i `profile_contacts.phone`
va `phone_verified_at` ni yozadi). Bu xavfsizroq (raqam tasdiqlangan bo'ladi) va migratsiya talab qilmaydi.
Agar tasdiqlanmagan raqamni saqlash kerak bo'lsa — `set_contact_phone(p_phone text)` RPC (faqat `phone is null` bo'lganda) qo'shish mumkin.

## 2. `worker_profiles` insert + `RETURNING`
`worker_profiles_read` (`can_view_worker(id)`) yangi qatorni o'sha statement ichida ko'rmaydi, shuning uchun `insert ... returning` RLS xatosi beradi.
Modul `insert` (return=minimal) + alohida `select` qiladi. Istalsa siyosatga `profile_id = auth.uid()` shartini to'g'ridan-to'g'ri qo'shib soddalashtirish mumkin:
`using (profile_id = auth.uid() or public.can_view_worker(id))`.

## 3. Lokal `ishuz_dev` bazasi eskirgan
`public.worker_completeness` lokal bazada `tips := tips || 'add_photo'` (malformed array literal) — migratsiya faylida esa `array_append` (to'g'ri).
`scripts/db-local.sh` ni qayta ishga tushirish kerak; kod migratsiya faylidagi versiyaga yozilgan.

## 4. Ixtiyoriy: replace-set uchun RPC
Qadamlar (`worker_skills`, `worker_languages`, `worker_locations`, `worker_experience`, `worker_education`, `worker_portfolio`) hozir
`delete` + `insert` bilan yangilanadi (bir tranzaksiyada emas). Bitta `save_worker_step(p_step int, p_payload jsonb)` security definer RPC atomik qilib berardi.
