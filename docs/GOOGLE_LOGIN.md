# Google orqali kirish — egasi uchun sozlash

Kod tayyor. Tugma saytda **o'zi chiqmaydi** — Supabase'da Google yoqilgandan keyin 5 daqiqa ichida paydo bo'ladi.
Yoqilmaguncha hech narsa o'zgarmaydi.

Quyidagi ishlarni faqat egasi qiladi (Google hisobi va Supabase paroli kerak). Client Secret'ni hech kimga
(jumladan Claude'ga) yubormang — uni faqat Supabase'ga qo'yasiz.

## 1. Google Cloud — loyiha va «brending»

1. <https://console.cloud.google.com> ga kiring → yuqorida **Select project → New project** → nomi `Ish topdim` → Create.
2. Chap menyudan **Google Auth Platform** (yoki «APIs & Services → OAuth consent screen») → **Get started**.
3. **Branding** (ilova haqida):
   - App name: `Ish topdim`
   - User support email: o'zingizning emailingiz (keyin ochiladigan support email bilan almashtirasiz)
   - Logo: hozircha **qo'ymang** (logo qo'yilsa Google tekshiruvi talab qilinadi, bir necha kun)
   - App home page: `https://ishuz.vercel.app`
   - Privacy policy: `https://ishuz.vercel.app/privacy`
   - Terms of service: `https://ishuz.vercel.app/terms`
   - Developer contact: o'zingizning emailingiz
4. **Audience** → User type: **External**. Keyin **Publish app** (holat «In production» bo'lsin).
   «Testing» holatida faqat qo'lda qo'shilgan 100 ta odam kira oladi.
5. **Data access** → faqat `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   Bular oddiy ruxsatlar — Google tekshiruvi kerak emas.

## 2. Google Cloud — kalit (OAuth client)

1. **Clients → Create client** → Application type: **Web application**, Name: `Ish topdim web`.
2. **Authorized JavaScript origins** → `https://ishuz.vercel.app`
3. **Authorized redirect URIs** → aynan shu manzil (bitta harf farq qilsa ishlamaydi):

   ```
   https://oquqqubmicldvreeqgsg.supabase.co/auth/v1/callback
   ```

4. **Create** → chiqqan **Client ID** va **Client secret**ni nusxalang.

## 3. Supabase — Google'ni yoqish

1. <https://supabase.com/dashboard> → loyiha → **Authentication → Sign In / Providers → Google**.
2. **Enable Sign in with Google** — yoqing.
3. **Client IDs** ga Client ID, **Client Secret** ga secret'ni qo'ying. «Skip nonce check» — o'chiq qolsin.
4. **Save**.

## 4. Supabase — qaytish manzili

**Authentication → URL Configuration**:

- **Site URL** `https://ishuz.vercel.app` bo'lsa — hech narsa qo'shish shart emas.
- Boshqacha bo'lsa → **Redirect URLs → Add URL** (oxiridagi `/**` muhim: qaytish manzilida `?next=...` bor):

  ```
  https://ishuz.vercel.app/**
  ```

(Agar keyin o'z domeningiz bo'lsa — o'sha domen bilan ham xuddi shunday qo'shasiz, Google'dagi
«JavaScript origins»ga ham.)

## 5. Tekshirish

5 daqiqa kuting → <https://ishuz.vercel.app/auth> → «Google orqali kirish» tugmasi chiqadi → bosing → hisobni tanlang →
saytga qaytasiz. Ismingiz Google'dan olinadi; rasmingiz olinmaydi; email hech kimga ko'rinmaydi.

## Bilib qo'ying

- Google oynasida «oquqqubmicldvreeqgsg.supabase.co ga davom etish» deb yozadi — bu normal (Supabase sizning kirish
  xizmatingiz). Uni «ishuz…» qilish uchun Supabase'ning pullik «Custom domain» xizmati kerak.
- Telegram ichida (Mini App) va Instagram/Facebook/Telegram ichki brauzerida tugma ko'rinmaydi: Google bunday
  oynalarda kirishni o'zi bloklaydi (`disallowed_useragent`). U yerda Telegram/telefon orqali kiriladi.
- Bir xil email bilan avval kirgan hisob bo'lsa, Supabase Google'ni o'sha hisobga ulaydi (email tasdiqlangan bo'lsa).
  Admin panel baribir alohida 2-bosqichli kodni (TOTP) so'raydi.
- Bloklangan foydalanuvchi Google orqali ham kira olmaydi (`/blocked` sahifasiga tushadi).
- iPhone ilovasi chiqarilganda Apple qoidasi (4.8) bo'yicha «Sign in with Apple» ham kerak bo'ladi.

## Kod qayerda

| Nima | Fayl |
| --- | --- |
| Tugma (Mini App / webview'da yashirin) | `src/features/auth/components/google-login-button.tsx` |
| Yoqilganini tekshirish (`/auth/v1/settings`, 5 daq kesh) | `src/features/auth/google-login.ts` |
| Qaytish: kod → sessiya, ism, blok, til | `src/app/api/auth/google/callback/route.ts` |
| Ism ajratish, webview aniqlash | `src/features/auth/google-profile.ts` |
| E2E | `e2e/specs/google-login.spec.ts` (stend gateway Google'ni emulyatsiya qiladi) |
