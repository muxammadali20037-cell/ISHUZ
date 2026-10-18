# Admin panelga kirish: Telegram va zaxira yo'l (email + parol)

Har bir yo'lda panel faqat **autentifikator kodi (TOTP, aal2)** bilan ochiladi. Bu qoidani baza ham tekshiradi
(`admin_aal_ok`). Parol yoki email havolasining o'zi panelni ochmaydi.

| Yo'l | Qayerda | Kim uchun |
|---|---|---|
| Telefon / Telegram (kod bot orqali) | `/auth?next=/admin` | hamma admin |
| Email + parol | `/auth/admin` (kirish ekranida «Email va parol» — faqat `next` admin panel bo'lganda) | faol admin, parol o'rnatgan bo'lsa |
| Email havolasi (parol o'rnatish / tiklash) | `/auth/admin/tiklash` → xat → `/auth/admin/havola` | faol adminning emaili yoki egasining `SUPER_ADMIN_EMAILS` dagi emaili |

## Telegram'siz birinchi marta (egasi)

1. **Vercel → Settings → Environment Variables:** `SUPER_ADMIN_EMAILS` qo'shing (qiymati — o'z emailingiz,
   Production). Keyin **Redeploy**.
2. **Supabase → Authentication → URL Configuration → Redirect URLs:** `https://<admin domeni>/auth/admin/havola`
   qo'shing. Alohida admin domeni bo'lmasa, asosiy domen. Qo'shilmasa ham ishlaydi: havola Site URL'ga tushadi va sahifa
   tokenlarni o'z joyiga olib boradi.
3. `https://<admin domeni>/auth/admin/tiklash` ni oching, emailni yozing va «Havola yuborish»ni bosing.
4. Xatdagi havolani oching. Autentifikator kodi so'raladi; ilova bo'lmasa, yangisini ulash uchun QR chiqadi.
   Keyin «Kirish usullari» sahifasi ochiladi: shu yerda parol o'rnatasiz.
5. Keyingi safar: `/auth/admin` → email + parol → autentifikator kodi.

Email faqat **yagona faol super_admin**ga biriktiriladi. Super_admin bir nechta bo'lsa, tasdiqlangan raqami
`SUPER_ADMIN_PHONES` da bo'lgan **aniq bitta** hisob tanlanadi. Hisobda boshqa haqiqiy email bo'lsa, u
almashtirilmaydi. Har biriktirish `audit_logs` ga (`admin.owner_email_attach`) va xavfsizlik jurnaliga yoziladi
(`admin.owner_email_attached`, high — adminlarga ogohlantirish).

### Xat kelmasa

- Supabase'ning standart pochta xizmati faqat **loyiha jamoasi a'zolarining** emaillariga yuboradi va soatiga bir
  necha xat bilan cheklangan. Boshqa emailga yuborish uchun **Supabase → Authentication → Emails → SMTP Settings**
  da o'z SMTP'ingizni (masalan Resend, Brevo) ulang.
- «Spam» papkasini tekshiring. Havola bir martalik. Muddati Supabase'dagi email OTP muddati bilan bir xil.
- Server jurnalida `auth.admin_link_send_failed` hodisasi sababni (`over_email_send_rate_limit` va h.k.) ko'rsatadi.
- Email bilan kirish o'chirilgan bo'lsa (Supabase → Authentication → Providers → Email), kirish sahifasi «Email bilan
  kirish hozircha yoqilmagan» deydi.

## Panel ichida: «Kirish usullari» (`/admin/account`)

- Har bir admin faqat **o'z** hisobiga email va parol o'rnatadi. Boshqa adminning parolini hech kim qo'ya olmaydi.
- Uning uchun aal2 sessiya kerak (`getAdminActor`).
- Parol qoidasi formada ham, serverda ham bir xil (`passwordProblem`):
  - uzunligi 12–128 belgi;
  - kamida 5 xil belgi;
  - email nomini o'z ichiga olmaydi.
- Parol auditga yozilmaydi. Auditda faqat `admin.login_credentials_set` va `email_changed` belgisi qoladi.
- Telegram/telefon kirishi o'zgarmaydi. Sessiya hisobning **joriy** emaili orqali ochiladi
  (`startSessionForProfile`). Hisob esa `telegram_accounts.profile_id` bilan bog'langan.

## Xavfsizlik

- `POST /api/auth/admin/password`:
  - `rejectUnsafeRequest` (boshqa saytdan so'rov yo'q);
  - limitlar fail-closed: email 10 / 15 daqiqa, IP (/64) 30 / soat;
  - IP bo'yicha faol cheklov tekshiriladi;
  - xato javobi bitta (`invalid_credentials`).
- Paroli to'g'ri, lekin **faol admin bo'lmagan** hisob (oddiy foydalanuvchi, o'chirilgan yoki bloklangan admin)
  uchun sessiya darhol yopiladi (`signOut`) va o'sha umumiy xato qaytadi. Hodisa:
  `auth.admin_password_not_admin`.
- `POST /api/auth/admin/recover`:
  - javob doim bir xil (email kimniki ekani bildirilmaydi);
  - limit: email 3 / soat, IP 10 / soat;
  - xat faqat faol adminning emailiga yoki `SUPER_ADMIN_EMAILS` ga yuboriladi.
- Havola «implicit» oqimda. Tokenlar URL qismida (`#`) keladi va serverga yetmaydi. Sahifa ularni darhol manzil
  satridan o'chiradi va `no-referrer` beradi. Sessiya aal1 bo'ladi, panelga yana kod kerak.
- Jurnal hodisalari:
  - `auth.admin_password_login`;
  - `auth.admin_password_failed`;
  - `auth.admin_password_rate_limited`;
  - `auth.admin_link_sent`, `auth.admin_link_send_failed`, `auth.admin_link_unknown`;
  - `admin.password_set`.

## Tekshiruvlar

- Unit: `src/features/auth/admin-login.test.ts` (email, parol qoidasi, `SUPER_ADMIN_EMAILS`, havola qismi, qaytish
  manzili).
- E2E: `e2e/specs/admin-password.spec.ts`. Lokal shlyuz Supabase Auth'ni taqlid qiladi: parol bilan kirish,
  admin users, tiklash xati («pochta qutisi» — `/__e2e/mail`).
  - Egasi Telegram'siz: havola → kod sahifasi → parol → email + parol → yana kod sahifasi.
  - Oddiy hisob va o'chirilgan admin kira olmaydi.
  - Begona email uchun xat yuborilmaydi.
  - Eskirgan havola.
  - Site URL'ga tushgan havola.
