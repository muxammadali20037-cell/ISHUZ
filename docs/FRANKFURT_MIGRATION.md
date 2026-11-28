# Bazani Frankfurtga ko'chirish (4-bosqich)

Sabab: ZRU-1125 (26.03.2026) bo'yicha shaxsiy ma'lumot chet elda faqat "yetarli himoya" ro'yxatidagi davlatda saqlanadi.
Hindiston (Supabase `ap-south-1`, Mumbay) ro'yxatda yo'q, Germaniya bor. Supabase loyihaning hududini joyida
o'zgartirmaydi — yangi loyiha ochib, ma'lumot va fayllar ko'chiriladi
([Supabase: Migrating within Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase)).

Hozirgi hajm (27.11.2026): baza 47 MB, 9 ta foydalanuvchi, 12 ta bucket va 110 ta fayl, 11 ta pg_cron vazifa, 2 ta vault siri.
Kichik — ko'chirishning o'zi bir necha daqiqa; sayt 30–60 daqiqa "texnik ishlar"da turadi.

## 1. Nima qayerda (tekshirildi)

| Qism | Ko'chirish usuli |
| --- | --- |
| Sxema (jadval, RLS, funksiya, storage siyosatlari, cron, bucket'lar) | `supabase/migrations/*.sql` tartib bilan — CI'dagi kabi; keyin `scripts/schema-fingerprint.sql` eski va yangini solishtiradi |
| Ma'lumot: `public` va `auth` (foydalanuvchilar, Google/Telegram bog'lanishlari) | `pg_dump --data-only` → `session_replication_role = replica` bilan yuklash (triggerlar ikki marta ishlamaydi) |
| Seanslar | ko'chirilmaydi — yangi loyihaning kaliti boshqa, hamma bir marta qayta kiradi |
| Fayllar (Storage) | `scripts/migrate/storage-copy.mjs` (service kalit bilan, qayta ishga tushirsa xavfsiz) |
| Saqlangan to'liq manzillar (`https://<eski-ref>.supabase.co/...`: e'lon rasmlari, kasb rasmlari, avatar, 1 ta sozlama — ~65 qator) | `scripts/migrate/post-restore.sql` almashtiradi |
| Vault sirlari (`ishuz_app_url`, `ishuz_cron_secret`) | yangi loyihada qaytadan yaratiladi (eski kalit bilan shifrlangani ochilmaydi) |
| Vercel kalitlari (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) | ega almashtiradi — eng oxirgi qadam |
| Google kirish | yangi loyihada Google provider yoqiladi; Google Cloud'da yangi callback qo'shiladi |
| Kunlik zaxira (`backup.yml`) | `SUPABASE_DB_URL` siri yangi loyihaga almashtiriladi |

Hammasi `.github/workflows/region-migrate.yml` da: qo'lda ishga tushadi, eski bazani faqat o'qiydi, yangi bazaga yozadi.

## 2. Ega tayyorlaydi (bir marta, ~20 daqiqa)

1. **Yangi loyiha.** supabase.com/dashboard → New project → nomi `ISHUZ-EU`, hudud **Central EU (Frankfurt)**,
   kuchli parol (parol menejerda saqlang). Bepul tarifda 2 ta loyiha mumkin — eski loyiha ko'chirishdan keyin ham bir
   muddat turadi.
2. **Kengaytmalar:** yangi loyiha → Database → Extensions → `pg_cron` va `pg_net` ni yoqing.
3. **GitHub sirlari** (repo → Settings → Secrets and variables → Actions). Qiymatlarni hech kimga yubormang, faqat shu yerga:
   - `NEW_SUPABASE_DB_URL` — yangi loyiha → Connect → **Session pooler** satri, `[YOUR-PASSWORD]` o'rniga parol;
   - `NEW_SUPABASE_SERVICE_KEY` — yangi loyiha → Settings → API Keys → `service_role` (yoki secret) kaliti;
   - `OLD_SUPABASE_SERVICE_KEY` — eski loyihaning shu kaliti (Vercel'dagi `SUPABASE_SERVICE_ROLE_KEY` bilan bir xil);
   - `CRON_SECRET` — Vercel'dagi `CRON_SECRET` bilan bir xil;
   - **Variables** bo'limida: `NEW_SUPABASE_URL` = `https://<yangi-ref>.supabase.co`.
   `SUPABASE_DB_URL` (eski) zaxira uchun allaqachon bor.
4. **Auth sozlamalari** (yangi loyiha → Authentication):
   - URL Configuration: Site URL va Redirect URLs — eski loyihadagidek (`https://ishuz.vercel.app`, `https://ishuz.vercel.app/**`);
   - Providers → Google: eski loyihadagi Client ID va Client Secret (docs/GOOGLE_LOGIN.md §3);
   - Google Cloud Console → o'sha OAuth client → Authorized redirect URIs ga qo'shing:
     `https://<yangi-ref>.supabase.co/auth/v1/callback` (eskisi ham ko'chirish tugaguncha qolsin).

## 3. Sinov (sayt ishlayveradi)

GitHub → Actions → **Region migration** → Run workflow: `mode = rehearse`, `confirm = <yangi-ref>`.
Natija (Summary): sxema bir xilmi, har jadvaldagi qatorlar soni (eski ↔ yangi), fayllar soni. Eski sayt shu payt ham
ishlaydi, shuning uchun tez o'zgaradigan jadvallarda (analitika, bildirishnomalar) kichik farq bo'lishi normal.
Xato chiqsa — tuzatib, qayta ishga tushiriladi: har safar yangi bazaning ma'lumoti eski bazadan qaytadan yoziladi.

Sinovdan keyin tekshiruv (Claude): yangi loyihaga ulangan preview-deploy (Vercel Preview muhiti kalitlari bilan) —
kirish (telefon/Telegram/Google), vakansiya, ishchi e'loni, rasm, admin panel.

## 4. Yakuniy ko'chirish (ega tanlagan vaqtda, kam odam bo'lgan payt — masalan 02:00–03:00 Toshkent)

1. Vercel → Settings → Environment Variables → `MAINTENANCE_MODE` = `1` (Production) → Redeploy.
   Sayt "Texnik ishlar olib borilmoqda" ko'rsatadi, bazaga hech narsa yozilmaydi; Telegram xabarlari keyin qayta keladi.
2. Actions → Region migration → `mode = final`. Sonlar 1:1 mos bo'lmasa ish xato bilan tugaydi — keyingi qadamga o'tilmaydi.
3. Vercel'da uchta kalitni yangi loyihanikiga almashtiring: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`; `MAINTENANCE_MODE` ni o'chiring → Redeploy.
4. Tekshiruv (Claude): sayt ochiladi, kirish, e'lonlar, rasmlar, admin, cron (`/api/cron/*` ishlayapti), xatolar yo'q.
5. GitHub sirida `SUPABASE_DB_URL` ni yangi loyihanikiga almashtiring (kunlik zaxira endi Frankfurt'dan).

**Qaytarish (biror narsa ishlamasa):** Vercel kalitlarini eski qiymatlarga qaytarib Redeploy — eski loyiha o'zgarmagan,
sayt avvalgidek ishlaydi (ko'chirish payti yozilgan narsa yo'q, chunki sayt texnik ishlarda edi).

## 5. Keyin

- 2 hafta eski loyiha "pauza"da turadi (o'chirilmaydi), keyin ega o'chiradi.
- pd.gov.uz — Davlat reyestriga ro'yxatdan o'tkazish (operator — YaTT). Yig'iladigan ma'lumotlar ro'yxati: ism-familiya,
  telefon, email (ixtiyoriy, Google orqali), Telegram ID va foydalanuvchi nomi, profil rasmi (ixtiyoriy), tug'ilgan sana va
  jinsi (ixtiyoriy, ishchi e'loni uchun), hudud, kasb va tajriba, rezyume matni, ish beruvchi tashkiloti, arizalar va
  chat xabarlari, to'lovlar (summa, sana; karta ma'lumoti bizda saqlanmaydi — Payme/Click'da), qurilma va tashrif
  statistikasi (cookie). Saqlash joyi: Germaniya (Supabase, AWS eu-central-1); sayt — Vercel (AQSh, DPF).
- Maxfiylik siyosatidagi "ma'lumot qayerda saqlanadi" bandi yangilanadi (legal.json).
