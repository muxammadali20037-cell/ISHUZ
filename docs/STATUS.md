# Joriy holat (STATUS)

Bitta sahifa: kod qayerda, prod qayerda, nima ishlaydi, nima egasini kutyapti. Har relizdan keyin yangilanadi.
Eski hisobotlar (`PROFESSIONALIZATION_REPORT.md`, `AUDIT_*.md`, `MASTER_SPEC_STATUS.md`, `SCALE.md` 1–7) o'z sanasidagi
tarix — ulardagi raqamlar (migratsiya soni, test soni) hozirgi holatni ko'rsatmaydi.

Yangilangan: **2026-11-12** (kechki) · oxirgi relizlar: AI ish maydoni (#13), Universal ustalar (#14, #15, #17) · prod'da `c7ac0c8`.

## 1. Kod va baza

| | Kod (`main`) | Prod baza (Supabase `oquqqubmicldvreeqgsg`) |
|---|---|---|
| Migratsiyalar | **0001 … 0076** (76 ta) | **0001 … 0068** (hujjatlar bo'yicha; aniq ro'yxat — `/api/health?deep=1`) — `0069–0076` qo'llanmagan |
| Natija | Vercel avtomatik deploy, `/api/health` ok | `/companies` → "Ro'yxat vaqtincha ochilmadi" (0071 yo'q); maosh/ma'lumot filtrlari (0070), telefon maxfiyligi (0074), Telegram qayta urinish (0075) ishlamaydi; `/ustalar` → "Bo'lim tayyorlanmoqda" (0076 yo'q) |

**Birinchi navbatdagi ega amali:** `docs/RELEASE_CHECKLIST.md` §1–3 — zaxira nusxa → `scripts/prod-migration-check.sql` →
0069…0076 ni tartib bilan SQL Editor'da. Keyin `CRON_SECRET=… bash scripts/prod-check.sh` — "deep" qatori PASS bo'lishi kerak.

## 2. Tekshiruv (oxirgi to'liq o'tkazish — 2026-11-12, lokal stend + GitHub CI)

| Tekshiruv | Natija |
|---|---|
| Vitest (birlik) | 776 o'tdi / 18 skip (eskirgan TS moslash, ma'lum) |
| Brauzer E2E (Playwright, toza baza) | 277 / 277 |
| SQL migratsiyalar + RLS testlari (CI) | o'tdi |
| Lint, typecheck, build | 0 xato |
| Xavfsizlik testlari | o'chirilmagan, hammasi o'tadi (`docs/SECURITY_TEST_REPORT.md` tartibi) |
| Baza yuklama testi (1 mln profil, 600 ming vakansiya) | so'rovlar 1–17 ms (`docs/SCALE.md` §1) |
| HTTP yuklama testi (50/200/500 parallel ulanish) | xatosiz; bitta Node jarayoni ~30–40 sahifa/s (`docs/SCALE.md` §8) |

Prod'ni tashqaridan tekshirish (faqat o'qiydi): `bash scripts/prod-check.sh` — health, deep (migratsiyalar), 9 ta ochiq sahifa,
robots/sitemap/manifest/assetlinks, Telegram webhook va to'lov kirish nuqtalari, xavfsizlik sarlavhalari.

## 3. Nima ishlaydi (prod'da, bugun)

- Ochiq sayt: bosh sahifa (ish izlovchi / ish beruvchi), `/jobs`, vakansiya sahifasi, `/kasblar`, kompaniya sahifasi, huquqiy
  sahifalar (`/privacy`, `/terms`, `/cookies`), 4 til.
- Kirish: Telegram bot orqali bir martalik kod; Mini App ichida initData; admin — email + parol + autentifikator.
- Ish izlovchi: profil, rezyume (PDF), ariza, saqlanganlar, AI yordamchi (Claude; AI o'chiq bo'lsa — qoidalar rejimi), ovozli qidiruv.
- Ish beruvchi: kompaniya, vakansiya joylash (moderatsiya bilan), nomzodlar qidiruvi, arizalar, takliflar.
- Universal ustalar (`/ustalar`, 0076 qo'llangach): katalog, usta e'lonlari (moderatsiya bilan), so'rovlar, sharhlar, usta kabineti.
- Admin: moderatsiya, ma'lumotnomalar, foydalanuvchilar, xavfsizlik jurnali, statistika.
- Infratuzilma: `/api/health` (uptime uchun), shifrlangan kunlik zaxira (GitHub Actions), Sentry (DSN berilsa).

## 4. Nima bloklangan (faqat ega qila oladi)

| # | Amal | Nega kerak | Qayerda yozilgan |
|---|---|---|---|
| 1 | Prod bazaga 0069–0076 | `/companies`, filtrlar, telefon maxfiyligi, Telegram qayta urinish, **Universal ustalar** | `RELEASE_CHECKLIST.md` §1–3, `MASTERS.md` §5 |
| 2 | `SENTRY_DSN` + uptime monitor | Xatolar va yiqilishlar ko'rinmaydi | `RELEASE_CHECKLIST.md` §5 |
| 3 | Telegram: `POST /api/telegram/setup` (CRON_SECRET bilan) va bot `/start` tekshiruvi | Kirish kodlari va bildirishnomalar shu orqali | `ISH_TOPDIM.md` |
| 4 | To'lovlar: Payme/Click merchant hisoblari, `PAYME_*`/`CLICK_*` env; "pullik" tugmalar admin'da | Pullik xizmatlar yoqilmagan — kod bor, haqiqiy pul bilan sinalmagan | `PROFESSIONALIZATION_REPORT.md` (to'lov matritsasi) |
| 5 | Play Market: Console hisobi, `.aab` (PWABuilder), SHA-256 → `ANDROID_SHA256_CERT_FINGERPRINTS`, test hisobi, 12 tester / 14 kun | Android ilova | `PLAY_MARKET.md` |
| 6 | `SUPPORT_EMAIL` env | Huquqiy sahifalarda aloqa manzili yo'q | `PLAY_MARKET.md` |
| 7 | Staging muhit (alohida Supabase + Vercel preview) | Haqiqiy Telegram oqimi va yuklama testi prod'ga tegmasdan | `SCALE.md` §8 |
| 8 | Haqiqiy foydalanuvchi bilan sinov (kirish → profil → ariza; kompaniya → vakansiya → nomzod) | Avtomatik testlar stendda; prod'da real oqim bir marta qo'lda o'tilishi kerak | `RELEASE_CHECKLIST.md` §6 |
| 9 | GitHub: **Settings → General → Default branch** ni `main` ga o'tkazish (hozir `claude/gallant-thompson-q70fo3`) | Sayt `main` dan chiqadi, lekin GitHub'dagi "Compare & pull request" tugmasi va rejali ishlar (kunlik zaxira nusxa) eski tarmoqqa qaraydi — #12, #16, #18 shu sababli o'sha tarmoqqa ochilgan (saytga ta'sir qilmagan) | shu yer |

**PR'larni birlashtirish.** Ega ruxsati bilan (2026-11) PR'larni CI yashil bo'lgach Claude o'zi `main` ga birlashtiradi — GitHub'da
"Merge" bosish shart emas. Agar ega o'zi bossa: avval sahifadagi barcha tekshiruvlar yashil bo'lishini kutish kerak (#17 tekshiruvlar
tugamasdan birlashtirilgan; kod lokal to'liq tekshirilgan edi va `main` dagi CI keyin yashil chiqdi).

## 5. Sig'im: bugun nima yetadi, 1 mln uchun nima kerak

- **Baza** 1 mln profil / 600 ming vakansiyada o'lchangan: ilova so'rovlari 1–17 ms (`SCALE.md` §1). Filtrsiz "eng yangi" va
  "o'xshash" ro'yxatlar 150 ming faol vakansiyada 150–200 ms edi — 2026-11-12 dan 60 s keshda (`SCALE.md` §8).
- **Ilova** (Vercel, serverless): har funksiya nusxasi ~30–40 sahifa/s; Vercel nusxalarni o'zi ko'paytiradi — ilova tomoni
  gorizontal masshtablanadi. Chegara — baza ulanishlari va CPU.
- **"100 ming bir vaqtda"** — bu tarif va arxitektura masalasi, kod emas: Supabase compute (hozir eng kichik tarif), pooler,
  mehmon sahifalarini CDN'da keshlash. Hisob-kitob va qadamlar — `SCALE.md` §8.3.
- Haqiqiy chegara staging'siz o'lchab bo'lmaydi; prod'ga yuklama yuborish — pul va firewall bloklanishi (`load/http-load.mjs`
  prod manzilini qabul qilmaydi).

## 6. Hujjatlar xaritasi (qaysi biri joriy)

| Hujjat | Holati |
|---|---|
| `STATUS.md` (shu) | joriy holat |
| `PROGRESS.md`, `CHANGELOG.md` | har reliz |
| `RELEASE_CHECKLIST.md` | reliz tartibi (joriy) |
| `AI_ASSISTANT.md`, `MASTERS.md`, `PLAY_MARKET.md`, `SECURITY_RUNBOOK.md`, `ADMIN_LOGIN.md`, `ISH_TOPDIM.md` | joriy qo'llanmalar |
| `SCALE.md` §1–7 (2026-10), `PERFORMANCE_BASELINE.md` (2026-10-12) | o'lchovlar o'z sanasida; §8 — 2026-11-12 |
| `ROUTES_MAP.md`, `DATABASE_SCHEMA.md` | avtomatik (`scripts/gen-docs.py`), 2026-11-12 |
| `PROFESSIONALIZATION_REPORT.md` (2026-10-14, 64 migratsiya), `AUDIT_2026-10-31.md`, `PRODUCT_AUDIT_2026-10.md`, `MASTER_SPEC_STATUS.md`, `REDESIGN_*.md`, `SECURITY_TEST_REPORT.md` | tarix — o'sha sanadagi holat |

## 7. Yo'l xaritasi bo'yicha fikr (2026-11-12 tahliliga javob)

Tahlil to'g'ri: muammo kod yozish emas, mahsulotni bozorga chiqarish. Ustuvorlik:

1. **P0 — prod'ni kod bilan tenglashtirish** (4-bo'lim, 1–3-qator). Bu bajarilmaguncha qolgan hamma narsa stendda "ishlaydi",
   prod'da emas.
2. **P0 — bitta haqiqiy oqim qo'lda:** 3 ta haqiqiy kompaniya, 10 ta haqiqiy vakansiya, 20 ta haqiqiy ish izlovchi. Avtomatik test
   buni almashtirmaydi.
3. **P1 — ish beruvchilarni jalb qilish** — biznes ishi; kod tomonidan yordam: vakansiyalarni Telegram kanallaridan import
   (`features/telegram-channel` bor), ko'p vakansiyani birdan yuklash (CSV), kompaniya taklifnomasi. Qaysi biri — egasi qarori.
4. **P1 — AI haqiqiy qiymat:** bugun AI yordamchi bazadan qidiradi va moslik sabablarini tushuntiradi (`features/matching`:
   kasb, hudud, tajriba, maosh, jadval bo'yicha qoidali ball). "Qobiliyatni aniqlash" (savol-javob orqali kasb tavsiyasi) —
   yangi mahsulot bo'lagi: profil ma'lumotini saqlash roziligi va alohida dizayn kerak; `AI_ASSISTANT.md` "egasi savollari".
5. **P1 — hujjatlar:** shu sahifa; eski hisobotlar tarix deb belgilandi.

Keyingi ikki bosqich (3 tizim: qobiliyat → moslik → rivojlanish) — mahsulot qarori; texnik poydevor (matching engine, AI
yordamchi, kasblar daraxti, profil) bunga tayyor, lekin avval 1–2-bandlar.
