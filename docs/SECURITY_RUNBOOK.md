# Xavfsizlik bo'yicha amaliy qo'llanma (runbook)

Qisqa, bosqichma-bosqich. Har amal auditga yoziladi (`audit_logs`, `security_events`). Sirlarni hech qachon chatga, issue'ga yoki kodga yozmang — faqat Vercel env / GitHub Secrets.

## 0. Tezkor ma'lumot

| Nima | Qayerda |
|---|---|
| Xavfsizlik hodisalari, faol cheklovlar, rejim | Admin panel → **Xavfsizlik** (`/admin/security`, ruxsat `security.view`) |
| Ogohlantirishlar | Admin ilova bildirishnomasi + adminning tasdiqlangan Telegram chati (15 daq dedupe, soatiga ≤ 20) |
| Ilova loglari | Vercel → Logs (strukturali qatorlar `{"sec": ...}`; PII yo'q) |
| Buzmaydigan tekshiruv | `node scripts/security/probe.mjs https://<sayt> https://<admin-host>` |
| DB testlari | `bash scripts/db-test.sh` (lokal Postgres) |

## 1. Hodisa darajalari va javob vaqti

| Daraja | Misol | Javob |
|---|---|---|
| critical | Kalit sizishi, admin hisobi buzilgan | Darhol (≤ 1 soat): kalitni almashtirish, sessiyalarni bekor qilish |
| high | OTP brute-force, AI byudjeti tugadi, egasi bootstrap rad etildi, oldindan band qilingan texnik email | ≤ 4 soat: `/admin/security` ni ko'rish, kerak bo'lsa majburiy rejim |
| medium | Telegram almashtirildi, raqam boshqa hisobga ko'chdi, sessiyalar bekor qilindi | Kun ichida ko'rib chiqish |
| low/info | Admin amallari, bloklash | Haftalik ko'rib chiqish |

Har hodisada: (1) ta'sirni cheklash, (2) dalillarni saqlash (`security_events`, Vercel log eksporti), (3) tuzatish, (4) foydalanuvchilarni xabardor qilish (kerak bo'lsa), (5) qisqa yozma xulosa va regressiya testi.

## 2. Hisob buzilgan deb gumon

1. Admin → Foydalanuvchilar → foydalanuvchi → **Barcha qurilmalardan chiqarish** (`admin_revoke_user_sessions`): barcha sessiyalar o'chiriladi, mavjud tokenlar bilan yozish darhol to'xtaydi.
2. Zarur bo'lsa **Bloklash**: sessiyalar + auth ban + ommaviy e'lonlar yashiriladi.
3. Telegram almashtirilgan bo'lsa (`telegram.link_replaced`): `telegram_accounts` dagi yozuvni egasi bilan tekshirish; noto'g'ri bo'lsa SQL Editor'da o'chirib, egasidan qayta ulashni so'rash.
4. Blokdan chiqarish: shu tugma — e'lonlar muddati tugamagan bo'lsa qaytadi, ban olinadi. Foydalanuvchi qayta kiradi.

## 3. Kalit sizib chiqdi

| Kalit | Almashtirish | Keyin |
|---|---|---|
| Supabase secret key (`sb_secret_…`, Vercel `SUPABASE_SERVICE_ROLE_KEY`) | Supabase → Settings → API Keys → yangi secret key yaratish → Vercel env yangilash → Redeploy → eski kalitni **Delete** | `probe.mjs`, admin panel ishlashini tekshirish |
| Telegram bot token | @BotFather → /revoke → yangi token → Vercel `TELEGRAM_BOT_TOKEN` → Redeploy → `setWebhook` (yangi `TELEGRAM_WEBHOOK_SECRET` bilan) | Bot `/start` ishlashini tekshirish |
| `TELEGRAM_WEBHOOK_SECRET` | Yangi tasodifiy qiymat (`openssl rand -hex 32`) → Vercel → setWebhook | — |
| `CRON_SECRET` | Yangi qiymat → Vercel + pg_cron ish matnidagi sarlavha | Cron loglari |
| AI kalitlari (Gemini/Anthropic) | Provayder panelida o'chirish/yangisi → Vercel | AI holati kartasi (admin) |
| `SECURITY_PEPPER` / `LOGIN_CODE_SECRET` | Yangi qiymat → Vercel | Limit hisoblagichlari va faol kodlar yangilanadi (kutilgan) |
| Legacy JWT (HS256) | Supabase → JWT Keys → Legacy → Revoke; API Keys → "Disable JWT-based API keys" | Barcha foydalanuvchi qayta kirishi mumkin |

Sizgan kalit git tarixida bo'lsa — kalitni almashtirish yetarli (tarixni qayta yozish shart emas, kalit baribir yaroqsiz). CI `secret-scan` keyingi tasodifni ushlaydi.

## 4. Hujum paytida: cheklov rejimi

1. `/admin/security` → hodisalar turi va soni.
2. **Majburiy rejimni yoqish** (`security.manage`): qoida chegarasiga yetgan telefon/IP vaqtincha cheklanadi (≤ 1 soat).
3. Noto'g'ri cheklov (masalan, mobil operator NAT ortidagi ko'p foydalanuvchi) → **Olib tashlash**.
4. Hujum tugagach — kuzatuv rejimiga qaytish (yoki qoldirish).

SQL bilan (favqulodda): `update app_settings set value='true'::jsonb where key='security_restrictions_enforce';`

## 5. PostgREST pre-request

Yoqilganini tekshirish (so'rov ataylab rad etiladi):
```bash
curl -s -X POST "https://<ref>.supabase.co/rest/v1/rpc/billing_enabled" \
  -H "apikey: <publishable>" -H "content-type: application/json" -H "x-ishuz-preflight: 1" -d '{}'
# kutilgan: {"code":"PT418",...,"message":"pre_request_active"}
```
Favqulodda o'chirish (masalan, API xatolari ko'paysa):
```sql
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
```
RLS (RESTRICTIVE siyosatlar) baribir bloklangan foydalanuvchi yozuvlarini to'xtatadi; pre-request — qo'shimcha qatlam.

## 6. Zaxira nusxa va tiklash

Maqsad: **RPO ≤ 24 soat** (kunlik shifrlangan nusxa + Supabase'ning o'z kunlik zaxirasi), **RTO ≤ 4 soat**.

Sozlash (bir marta, egasi):
1. Kompyuterda: `age-keygen -o ~/.ishuz-backup.key` → chiqqan `age1…` — **ochiq** kalit. Yopiq kalit faylini oflayn (parolli arxiv / USB) saqlang, hech qayerga yuklamang.
2. GitHub → Settings → Secrets → Actions: `BACKUP_AGE_RECIPIENT` = `age1…`, `SUPABASE_DB_URL` = Supabase → Connect → Session pooler satri (parol bilan).
3. Actions → "DB backup (encrypted)" → Run workflow → artefakt paydo bo'lishini tekshiring (14 kun saqlanadi). Keyin har kuni 02:17 (Toshkent).
4. Storage fayllari (rasmlar/hujjatlar) DB nusxasiga kirmaydi: Supabase Pro'da PITR/Storage zaxirasi yoki oyiga bir marta `supabase storage` bilan yuklab olish.

Tiklash mashqi (oyiga bir marta, faqat lokal bazaga):
```bash
AGE_IDENTITY=~/.ishuz-backup.key bash scripts/backup/restore-check.sh ishuz-<vaqt>.dump.age
# ixtiyoriy: EXPECT_COUNTS="profiles=123 vacancies=45"
```
Haqiqiy tiklash (favqulodda): Supabase → Database → Backups (loyiha darajasida) yoki yangi loyihaga `pg_restore` → env'ni yangi loyihaga almashtirish → `probe.mjs` → foydalanuvchilarni xabardor qilish.

## 7. 0056 migratsiyani orqaga qaytarish (favqulodda)

Avval faqat sababchi qismni o'chiring (butun migratsiyani emas):
```sql
-- pre-request
alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';
-- yozish siyosatlari (agar faol foydalanuvchilar noto'g'ri bloklansa)
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where policyname like 'sec_active_%' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop; end $$;
-- vakansiya holati qo'riqchisi
drop trigger if exists trg_00_vacancy_status_guard on public.vacancies;
-- ish beruvchi PII siyosatini oldingi holatga (tavsiya etilmaydi)
-- alter policy employer_profiles_read on public.employer_profiles using (true);
```
Funksiyalarning oldingi matni 0049–0055 migratsiyalarida. Har qaytarishdan keyin `bash scripts/db-test.sh` va `probe.mjs`.

## 8. Provayder paneli (Tashqi sozlamalar)

| Joy | Sozlama | Nega |
|---|---|---|
| Supabase → Authentication → Sign In / Providers | **Allow new users to sign up — o'chirish**; Anonymous sign-ins — o'chiq; Phone provider — ishlatilmasa o'chirish; Email provider — ochiq ro'yxatdan o'tish yo'q | Hisoblarni faqat server yaratadi (S-01 ga qo'shimcha qatlam) |
| Supabase → Settings → JWT Keys | JWT expiry 900–1800 s; Legacy HS256 → Revoke | R-01, V9 |
| Supabase → API Keys | "Disable JWT-based API keys"; ishlatilmaydigan `default` secret key o'chirish | Eski kalitlar |
| Vercel → Environment | `SECURITY_PEPPER`, `LOGIN_CODE_SECRET` (har biri `openssl rand -hex 32`) | HMAC kalitlari service kalitidan ajratiladi |
| GitHub / Vercel / Supabase / domen registratori | Barcha egalarida MFA (TOTP yoki kalit) | Ta'minot zanjiri |
| GitHub → Secrets | `SUPABASE_DB_URL`, `BACKUP_AGE_RECIPIENT` | Zaxira (6-bo'lim) |
| Vercel → Domains / `headers.ts` (ixtiyoriy) | Barcha subdomenlar https ekani tasdiqlansa — HSTS'ga `includeSubDomains` (keyin preload) | Hozir faqat asosiy host (2 yil) |
| app_settings | `storage_public_origin` = `"https://<ref>.supabase.co"` | Rasm manzili hosti qat'iy tekshiriladi |

## 9. 0056 ni production'ga qo'lda qo'llash (SQL Editor)

Agar migratsiyani avtomatik qo'llab bo'lmasa (masalan, tasdiq oynasi vaqtida tasdiqlanmasa):
1. GitHub → `supabase/migrations/0056_security_hardening.sql` → **Raw** → hammasini nusxalash.
2. Supabase → SQL Editor → New query → joylash → **Run**. Bitta so'rovdagi barcha buyruqlar bitta tranzaksiyada bajariladi: xato bo'lsa, hech narsa o'zgarmaydi.
3. Tekshirish:
   ```sql
   select to_regclass('public.security_events') is not null as tables_ok,
          (select count(*) from pg_policies where policyname = 'sec_active_insert') as write_policies,
          (select setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticator') as authenticator_cfg;
   -- kutilgan: tables_ok = true, write_policies ≥ 40, authenticator_cfg ichida pgrst.db_pre_request=public.api_pre_request
   ```
4. 5-bo'limdagi `x-ishuz-preflight` so'rovi `PT418` qaytarishi kerak.
5. Rasm manzili hostini qat'iy qilish (qiymat `NEXT_PUBLIC_SUPABASE_URL` bilan aynan bir xil, oxirida `/` siz):
   ```sql
   update app_settings set value = '"https://<ref>.supabase.co"'::jsonb where key = 'storage_public_origin';
   ```
6. Sayt: kirish, e'lon joylash, profil rasmi, admin panel → **Xavfsizlik** sahifasi ochilishini tekshiring. Muammo bo'lsa — 7-bo'lim (qisman orqaga qaytarish).
