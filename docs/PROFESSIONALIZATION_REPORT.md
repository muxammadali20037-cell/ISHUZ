# "Ish topdim" — professionallashtirish hisoboti

Sana: 2026-10-11 · Audit tayanchi: `506473a` · Ushbu hisobot holati: branch `claude/gallant-thompson-q70fo3` = `main`.
Ish jurnali: [PROFESSIONALIZATION_PROGRESS.md](PROFESSIONALIZATION_PROGRESS.md). Eski hisobotlar (`MASTER_SPEC_STATUS.md`,
`SECURITY_TEST_REPORT.md`, `SCALE.md`) o'z sanasidagi tarix sifatida qoldi — joriy holat shu faylda.

Belgilar: **PASS** — shu sessiyada haqiqatan bajarildi va o'tdi · **NOT_RUN** — bajarilmadi (sababi yozilgan) ·
**BLOCKED** — tashqi ruxsat/kalit/qurilma kerak · **UNKNOWN** — tekshirib bo'lmadi.

## 1. Reliz holati (bitta jadval)

| Muhit | Kod | Baza | Holat |
|---|---|---|---|
| Lokal / CI (izolyatsiyalangan stend) | HEAD | 0001…0058 toza bazaga | ✅ lint, typecheck, unit, SQL, build, 24 ta brauzer E2E — PASS |
| Production (Vercel, `main`) | HEAD (avtomatik deploy) | **0001…0058** (egasi SQL Editor'da qo'lladi, 2026-10-11; read-only tekshirildi — §2 F-02) | ✅ xavfsizlik qatlami, "Kasbim topilmadi" va rasm karantini yoqilgan |
| Staging | — | — | ❌ yo'q (yuklama testi va haqiqiy Telegram oqimi uchun kerak) |

Qolgan to'siqlar (egasi): staging muhit (yuklama testi, haqiqiy Telegram oqimi). Zaxira — ✅ ishlayapti (F-01).

## 2. Topilmalar: muammo → sabab → fayl → yechim → tekshiruv → qolgan cheklov

### F-01 · P0 · Zaxira nusxa yaratmagan — ✅ tuzatildi, production'da birinchi shifrlangan nusxa yaratildi (2026-10-12)
- **Sabab:** `backup.yml` sir yo'q bo'lsa qadamlarni jim o'tkazib yuborardi → run "yashil", artifact 0 (run `38097724597`).
- **Yechim:** sir yo'q → `::error` va qizil run (faqat `vars.BACKUP_DISABLED=true` bo'lsa ataylab o'chiq, sariq ogohlantirish);
  dump bir oqimda TOC bilan o'qiladi; yaxlitlik: fayl bo'sh emas, TOC bor, `profiles/worker_profiles/vacancies/applications`
  ma'lumotlari bor; manifest JSON → run summary. Yangi `backup-freshness.yml`: oxirgi artifact 26 soatdan eski bo'lsa qizil.
  `restore-check.sh`: tiklash vaqti + funksional tekshiruv (qidiruv RPC'lari, kasb qidiruvi, profiles↔auth.users, RLS).
- **Fayllar:** `.github/workflows/backup.yml`, `.github/workflows/backup-freshness.yml`, `scripts/backup/db-backup.sh`, `scripts/backup/restore-check.sh`.
- **Tekshiruv (PASS, lokal):** shifrlangan dump 1.2 MB, 84 jadval ma'lumoti, 1353 TOC yozuvi; izolyatsiyalangan bazaga tiklash **4 s**, funksional tekshiruvlar o'tdi.
- **Production (2026-10-12):** tungi run `38188329869` sir yetishmaganda (`BACKUP_AGE_RECIPIENT`) **qizil** bo'ldi va sababini aytdi — tuzatish
  kutilgandek ishladi. Egasi ikkala sirni qo'shgach qo'lda run `38207925133` — **PASS**: `ishuz-20261012T052634Z.dump.age` 1.4 MB, 113 jadval ma'lumoti,
  yaxlitlik tekshiruvlari o'tdi, artefakt `db-backup-38207925133` (14 kun). Dump vaqti ~2.5 daqiqa.
- **Qolgan:** production nusxasini ochib tiklash — faqat egasida bo'lgan yopiq kalit bilan (NOT_RUN bu muhitda; `age -d` + `restore-check.sh`).
  Provayder (Supabase) backup'i — tarif bo'yicha; Storage baytlari pg_dump'ga **kirmaydi** (alohida reja kerak).
  Taklif: RPO ≤ 24 soat (kunlik), RTO — o'lchangan tiklash 4 s (lokal kichik baza) + deploy; bu **kafolat emas**, haqiqiy hajmda qayta o'lchansin.

### F-02 · P0 · 0056 production holati — ✅ qo'llandi va tekshirildi (2026-10-11)
- **Avval:** 0056/0057/0058 qo'llanmagan edi (MCP `apply_migration` tasdiq oynasida bekor bo'lgan).
- **Birinchi qo'lda urinishdagi xato:** SQL Editor `patch_fn … naqsh 0 marta uchradi` — muharrir skriptni CRLF qatorlar bilan yuboradi, ko'p qatorli
  yamoq naqshi LF bilan saqlangan funksiyaga mos kelmadi. Butun skript bitta tranzaksiya edi — hech narsa o'zgarmagani read-only tasdiqlandi.
  Tuzatish (`2f73f5c`): `patch_fn` solishtirishdan oldin `\r` ni olib tashlaydi; CRLF nusxalari 0055 holatidagi bazada sinaldi, yamoqlanadigan 8 funksiya
  production bilan solishtirildi (6 tasi baytma-bayt bir xil, 2 tasida yamoq joyi aynan 1 marta).
- **Egasi qo'lladi:** 0056 → `storage_public_origin` → 0057 → 0058 (SQL Editor).
- **Read-only tekshiruv (PASS):** `security_events` bor; `sec_active_*` yozuv siyosatlari — 44; `refresh_worker_completeness` va `worker_completeness` da qo'riqchi;
  `authenticator` → `pgrst.db_pre_request=public.api_pre_request`, preflight → `PT418 pre_request_active`; `storage_public_origin` o'rnatilgan;
  `simple_listing_features()` → `{custom_profession: true, photo_quarantine: true}`; `vacancy-uploads` yopiq; trigger, yuklash siyosati va 3 ta toraytirilgan
  `vacancy_photos_*` siyosati bor; `stale_raw_vacancy_photos` faqat service role uchun (anon/authenticated — yo'q).
  Supabase security advisors: ERROR yo'q; WARN'lar avvaldan bor (SECURITY DEFINER RPC'lar ichki tekshiruv bilan; `api_pre_request` PostgREST uchun anon'ga ochiq bo'lishi shart).
  Generatsiya qilingan tiplar lokal `database.types.ts` bilan mos (78 jadval, 214 funksiya, 22 enum).
- **Tekshirilmadi:** sayt va REST API'ga HTTP so'rov (bu muhitning tarmoq siyosati `ishtopdim.uz` va `*.supabase.co` ni bloklaydi) — egasi brauzerda tekshiradi.

### F-03 · P1 · Qoralamalar hisobga ajratilmagan — ✅ tuzatildi
- **Sabab:** bitta umumiy `localStorage` kaliti; chiqish/hisob almashganda boshqa odam ko'rardi; JSON tekshirilmasdi.
- **Yechim:** kalit `ib_draft:v2:<entity>:<new|e:id>:<u:userId|g:guestId>`; konvert `{schema, owner, updatedAt, handoffAt}`; 14 kun TTL;
  maydon-maydon tekshiruv; `DraftGuard` — hisob almashsa/chiqsa barcha qoralamalar o'chadi, mehmon ID yangilanadi; mehmon "Hisobga kirish"
  bosgan qoralama 2 soat ichida aynan o'sha hisobga o'tadi; tozalangandan keyin avtosaqlash qoralamani "tiriltirmaydi" (faqat o'zgarishdan keyin yoziladi);
  server ma'lumoti va qurilma qoralamasi farq qilsa — "Qurilmadagi o'zgarishlar" ogohlantirishi (saqlash/bekor qilish).
- **E2E topgan haqiqiy xato:** mehmon → kirish o'tkazish belgisi avtosaqlashda yo'qolardi (qoralama o'tmasdi) — tuzatildi.
- **Fayllar:** `src/features/post/{draft-store,draft-rules,use-draft}.ts`, `src/components/shared/draft-guard.tsx`, formalar.
- **Tekshiruv:** 13 unit (draft-store), 4 E2E (`e2e/specs/drafts.spec.ts`) — PASS.
- **Qolgan:** ikki tabda bir vaqtda tahrir — oxirgi yozuv yutadi (`storage` hodisasi faqat hisob almashishini kuzatadi).

### F-04 · P1 · Qidiruvdagi texnik xato "natija yo'q"ga aylanardi — ✅ tuzatildi
- **Yechim:** `FindOutcome` (ok/error) + 8 belgili xato kodi (so'rov matnisiz log); xato holati "Natijalarni yuklab bo'lmadi" + "Qayta urinish"
  (filtrlar URL'da saqlanadi); `search_error` analytics; bo'sh qidiruv statistikasi faqat muvaffaqiyatli 1-sahifada; chegaradan tashqari sahifa —
  "Bu sahifada natija qolmadi" + birinchi sahifaga havola; ma'lumotnoma (kategoriya/hudud) bo'sh kelsa xato chegarasi.
- **Fayllar:** `src/features/find/{queries.ts,components/find-page.tsx,components/find-client.tsx}`, `src/app/search/page.tsx`.
- **Tekshiruv:** 5 unit, 3 E2E (`search.spec.ts`: haqiqiy RPC xatosi PostgREST'da funksiya nomini vaqtincha o'zgartirib) — PASS.

### F-05 · P1 · Sodda formalarda katalogdan tashqari kasb — ✅ (0057 production'da)
- **Yechim:** "Kasbim topilmadi" → asl nom → eng yaqin soha; Zod (2–120 belgi, aniq bitta: tugun yoki custom) → server action →
  0057 RPC yamoqlari → `custom_occupation_requests` (dublikatsiz) → moderatsiya snapshot; custom kasb katalog tuguni sifatida ko'rsatilmaydi ("Qo'lda yozilgan").
  Qisqa formadan tahrir batafsil qiymatlarni yo'qotmaydi (aniq tajriba darajasi, sarlavha, qo'shimcha jadval, masofaviy "any", maosh davri).
- **Tekshiruv:** 19 SQL, 4 unit (`keep.test.ts`), 1 E2E (ishchi) — PASS. Vakansiya uchun custom — SQL'da PASS, E2E — NOT_RUN.

### F-06 · P1 · Fayl tekshiruvi yuklashdan keyin — ✅ vakansiya rasmi (0058 production'da) · avatar/logo ochiq
- **Yechim:** xom fayl yopiq karantinga (`vacancy-uploads`) → server darhol: hajm ≤5 MB, magic bytes, piksel ≤40 MP, xavfsiz dekoder →
  EXIF/GPS'siz WebP ≤1600 px → `<egasi>/v-<sha256>.webp` (o'zgarmas, mijoz yoza/almashtira/o'chira olmaydi); vakansiyaga faqat shu yo'l (trigger);
  karantindagi xom fayl natijadan qat'i nazar darhol o'chadi; tashlab ketilgan fayllar soatiga tozalanadi (ishlatilayotgani tegilmaydi).
  Eski e'londagi rasm: o'zgarmasa tahrirni to'xtatmaydi, o'qib bo'lsa tekshirilgan nusxaga o'tadi.
- **Tekshiruv:** 11 unit (EXIF, yo'nalish, o'lcham, soxta tur, buzilgan fayl, piksel bombasi, yo'llar), 21 SQL, 4 E2E — PASS.
- **Qolgan:** avatar va kompaniya logotipi hali brauzerdan to'g'ridan-to'g'ri ommaviy bucket'ga (magic-byte tekshiruvi bor, qayta kodlash yo'q);
  KYC hujjatlari yopiq bucket'da — AI'ga yuborish/saqlash muddati sozlamasi ochiq vazifa.

### F-07 · P1 · Qayta ishlatiladigan E2E/CI yo'q edi — ✅
- **Yechim:** `e2e/stack` — toza baza (barcha migratsiyalar + seed), PostgREST v12.2.3 (checksum bilan), Auth/Storage shlyuz emulyatori
  (har run tasodifiy JWT siri), Next production build. CI'da `e2e` job; xatoda hisobot, trace, skrinshot va loglar artifact.
- **Tekshiruv:** 24 spec — PASS lokal; GitHub CI (main, `1236594`) — PASS.
- **Cheklov:** Auth va Storage — emulyator (Storage RLS emas): haqiqiy siyosatlar SQL testlarida; Telegram kirishi — imzolangan sessiya cookie bilan.

### F-08 · P2 · Hujjatlar ortda — ✅
`.env.example` (MAJBURIY/IXTIYORIY, PUBLIC/SERVER, faqat namunalar), README (Telegram kod bilan kirish, 4 til, 0001…0058, E2E buyruqlari),
shu hisobot, flag matritsasi (§6), tashqi sozlamalar (§7).

### F-09 · P2 · Ko'p foydalanuvchiga tayyorlik o'lchovi — ❌ NOT_RUN
SQL benchmark (`SCALE.md`) saqlandi. Staging yo'q — aralash HTTP yuklama testi (p50/p95/p99, xato, CPU, DB ulanishlari, navbat kechikishi)
bajarilmadi. "Million foydalanuvchiga tayyor" deb **e'lon qilinmaydi**. Lab o'lchovi — §4.

## 3. C bosqichi — foydalanuvchi tajribasi (o'lchangan)

Avtomatik audit: `e2e/specs/a11y.spec.ts` — axe-core (WCAG 2.1 AA) + gorizontal siljish + bosish nishoni o'lchami;
7 sahifa × 5 kenglik (360/390/430/768/1440; 768 ≈ 1440 ekranda 200% zoom); reduced-motion va klaviatura fokusi.

| Sahifa | axe buzilish (tugun, 5 kenglik jami) | gorizontal siljish | < 24 px | < 44 px |
|---|---|---|---|---|
| auth | 25 → **0** | yo'q → yo'q | 0 → 0 | 25 → **0** |
| cabinet | 15 → **0** | 768px: +66 px → **yo'q** | 0 → 0 | 22 → **0** |
| home | 18 → **0** | yo'q → yo'q | 0 → 0 | 7 → **0** |
| post-vacancy | 5 → **0** | yo'q → yo'q | 5 → **0** | 12 → **0** |
| post-worker | 5 → **0** | yo'q → yo'q | 5 → **0** | 12 → **0** |
| search-results | 10 → **0** | yo'q → yo'q | 0 → 0 | 7 → **0** |
| search-start | 10 → **0** | yo'q → yo'q | 0 → 0 | 7 → **0** |

Nima o'zgardi va nega:
- **Kontrast (sabab — tokenlar):** `--muted-foreground` #64748b → #5b687c (och fonlarda 4.23–4.47 → 4.89–5.65), `--success` #16a34a → #15803d
  (oq matn 3.29 → 5.02), `--warning` #d97706 → #b45309 (3.19 → 5.02); shaffof oq matnlar (/75…/90) birlamchi va yashil fonlarda to'liq yoki ≥4.5:1;
  AI va to'lov gradientlari 700 tusga.
- **Planshet (768 px) sarlavhasi:** matnli menyu o'ng tomondagi tugmalarni ekrandan chiqarardi → md'da faqat belgi (nomi `title` va ekran o'quvchisi uchun), lg'dan matn; `aria-current`.
- **Bosish nishoni ≥ 44 px:** sarlavhadagi chat/bildirishnoma (36 → 44), avatar (40 → 44), logotip, til tugmalari (24 → 44), "Topilmadimi? O'zingiz yozing" (20 → 44).
- **Klaviatura:** Tab bilan o'tilganda har bir element fokus halqasi bilan — PASS; **reduced-motion:** animatsiya/o'tishlar 0 — PASS.
- **Til almashishi:** e'lon qoralamasi va qidiruv filtrlari (URL) saqlanadi — E2E PASS; ikki marta "E'lonni joylash" → bitta e'lon — E2E PASS.
- **E'lon formasi birinchi chizish:** server HTML'da endi "Yuklanmoqda…" o'rniga haqiqiy forma (qurilma qoralamasi o'qilguncha bir lahza `inert` + `aria-busy`,
  kiritilgan narsa yo'qolmaydi). Ta'siri — §4.

## 4. D bosqichi — o'lchov

### Lab tezlik o'lchovi (field ma'lumot EMAS)
`node e2e/perf/lab.mjs 3` — lokal production build, 390×844 DPR3, 150 ms RTT, 1.6 Mbit/s, CPU 4× sekin; 3 run mediana.
"Bosish" — sahifa tayyor bo'lgach bitta haqiqiy bosish (INP o'rnini bosuvchi lab ko'rsatkich, INP emas). JS — siqilgan, birinchi yuklash.

| Sahifa | LCP avval → keyin | CLS | Bosish kechikishi | JS (KB, siqilgan / fayl) | HTML KB | `load` |
|---|---|---|---|---|---|---|
| `/` | 1508 → 1556 ms | 0 | 136 ms | 257 / 18 | 58 | 2.6 s |
| `/search` | 900 → 964 ms | 0 | 112 ms | 367 / 20 | 53 | 3.1 s |
| `/search?…` (natija) | 1500 → 984 ms¹ | 0 | — | 367 / 20 | 52 | 3.0 s |
| `/post/worker` | **4064 → 1148 ms** | 0 | 72 ms | 465 / 24 | 74 | 3.4 s |
| `/auth` | 856 → 940 ms | 0 | — | 239 / 17 | 50 | 2.5 s |
| `/cabinet` | 980 → 1140 ms | 0 | — | 260 / 18 | 59 | 2.6 s |

Faqat `/post/worker` (va xuddi shu tuzatish qo'llangan `/post/vacancy`) kod o'zgarishi bilan yaxshilandi: sabab — server HTML'da
"Yuklanmoqda…" turar, haqiqiy forma JS gidratsiyasidan keyin chizilardi; endi forma serverda chiziladi. Boshqa qatorlardagi ±15% farq — run
shovqini (3 run mediana), yaxshilanish deb hisoblanmaydi. ¹ ikkinchi o'lchovda natija ro'yxati bo'sh edi — taqqoslanmaydi.
Eng og'ir sahifa JS bo'yicha — `/post/worker` (465 KB, 24 fayl): kasb tanlagich, hudud va forma bitta qadamda; keyingi optimallashtirish nomzodi
(3–4-qadam komponentlarini kechiktirib yuklash), lekin lab LCP/INP maqsad ichida bo'lgani uchun ko'r-ko'rona qilinmadi.

Maqsadlar (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) — **real 75-percentile field** natijasi uchun; bu jadval laboratoriya. Real qurilma/field o'lchovi — NOT_RUN
(Vercel Speed Insights yoki CrUX ulanishi kerak).

Metodika tuzatishi: dastlabki o'lchovda ~700 ms "bosish" ko'rindi — bu yuklanish paytidagi avtomatik `pointerover` hodisalari edi; endi faqat `interactionId > 0`
(INP qoidasi) hisoblanadi. Ovoz effekti (WebAudio) bosish kechikishiga sezilarli ta'sir qilmasligi A/B bilan tekshirildi (16–80 ms, 4× CPU).

### Xavfsizlik
Avvalgi tekshiruvlar ([SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md)) saqlandi. Shu sessiyada qo'shilgan: Storage karantin siyosatlari va "v-" fayl himoyasi (SQL),
vakansiya rasm yo'li triggeri (mijoz va SECURITY DEFINER RPC orqali ham), service-only tozalash funksiyasi, server action'da rate limit.
0056 production'da 2026-10-11 qo'llandi — [SECURITY_AUDIT.md](SECURITY_AUDIT.md) dagi tuzatishlarning DB qismi endi amalda (F-02 dagi tekshiruv).

## 5. E bosqichi — test va qabul mezonlari (24 band)

Yig'indi: unit **515 PASS / 18 skip** · SQL **24 fayl PASS** · brauzer E2E **24 PASS** (lokal va GitHub CI).

| # | Oqim | Holat | Dalil |
|---|---|---|---|
| 1 | Mehmon qidiruvi; texnik xato va 0 natija alohida | PASS | `search.spec.ts` |
| 2 | Xato zero-results'ga yozilmaydi; retry filtrni saqlaydi | PASS | `search.spec.ts` |
| 3 | Ishchi forma → login → o'sha qadam/javoblar | PASS (login — imzolangan cookie) | `drafts.spec.ts` #3 |
| 4 | Ish beruvchi forma → e'lon → tahrirlash | PASS (kabinet ko'rinishi tekshirilmadi) | `vacancy-photo.spec.ts`, `flows.spec.ts` |
| 5 | Ikkala formada katalogda yo'q kasb | Ishchi E2E PASS · vakansiya SQL PASS, E2E NOT_RUN | `custom-profession.spec.ts`, `simple_custom_profession.test.sql` |
| 6 | A qoralamasi B'da ko'rinmaydi | PASS | `drafts.spec.ts` #1–2 |
| 7 | Mehmon qoralamasi import; eski server ma'lumoti buzilmaydi | PASS | `drafts.spec.ts` #3, `keep.test.ts` |
| 8 | Buzilgan/eski versiya qoralama; muddat; yopiq storage | PASS (ikki tab, Back — NOT_RUN) | `drafts.spec.ts` #4, `draft-store.test.ts` |
| 9 | Muvaffaqiyatdan keyin tozalangan qoralama qaytmaydi | PASS (unit) | `draft-store.test.ts` |
| 10 | Parallel bosish → bitta e'lon | PASS | `flows.spec.ts`, `flows.test.sql` (client_ref) |
| 11 | Batafsil profil qisqa formada tahrir — ma'lumot saqlanadi | PASS | `keep.test.ts`, `simple_custom_profession.test.sql`, `vacancy-photo.spec.ts` |
| 12 | Telefon ko'rinishi karta/detail/REST'da mos | PASS (lokal SQL) · production'da 0056 qo'llangan (read-only) | `security*.test.sql`, `contact_requests.test.sql` |
| 13 | Begona ID bilan draft/telefon/CV/KYC/chat | PASS (lokal SQL) | `security*.test.sql` |
| 14 | Moderatsiya approve/review/reject, appeal, timeout, retry | PASS (SQL) · E2E NOT_RUN | `moderation.test.sql` |
| 15 | Zararli/soxta upload, begona yo'l, EXIF, almashtirish | PASS | `photo-finalize.test.ts`, `vacancy_photo_quarantine.test.sql`, `vacancy-photo.spec.ts` |
| 16 | AI o'chiq/nosoz/noto'g'ri JSON | PASS (E2E AI kalitlarisiz; unit) | butun E2E to'plami, `json.test.ts`, `gemini.test.ts` |
| 17 | Telegram soxta/eskirgan initData, takroriy webhook | PASS (unit/SQL) | `telegram-session.test.ts`, `bot.test.sql` |
| 18 | Haqiqiy staging Supabase + Telegram kirish | BLOCKED | staging va test bot kerak |
| 19 | OTP qayta yuborish/muddat/parallel, bekor sessiya | NOT_RUN | test yo'q — ochiq vazifa |
| 20 | Billing yoqilgan/o'chiq, callback takrori/bekor | PASS (unit/SQL) · test provayder bilan NOT_RUN | `providers.test.ts`, `billing*.test.sql` |
| 21 | Ariza → javob → taklif/chat → natija | PASS (SQL) · E2E NOT_RUN | `pipeline.test.sql`, `flows.test.sql` |
| 22 | Til, 360–1440, 200% zoom, klaviatura, reduced-motion | PASS (uz/ru/en; oz — unit tarjima tekshiruvi) | `a11y.spec.ts`, `flows.spec.ts` |
| 23 | Backup disabled/success/failure; artifact; restore | failure (sir yo'q) va success (artefakt) production'da PASS · tiklash lokal PASS, production nusxasi NOT_RUN (yopiq kalit egasida) | runs `38188329869`, `38207925133` |
| 24 | Barcha migratsiyalar toza bazada; destructive yo'q | PASS (toza baza, CI; CRLF nusxa 0055 ustiga) · production 0056–0058 qo'llangan | `scripts/db-test.sh`, F-02 |

**18 ta skip (yashirilmaydi):** hammasi `src/features/matching/engine.parity.test.ts` — TS `computeMatch` ↔ SQL `compute_match` paritet testi.
Sabab topildi: suite `compute_match` tanasini faqat `0008` fayli bilan solishtiradi, funksiya esa 0013/0028/**0050** da qayta yozilgan —
shuning uchun u doim "baza orqada" deb o'tkazib yuborilgan. Oxirgi ta'rif bilan ishga tushirilganda **15/18 holat mos kelmadi**:
TS nusxa v1, SQL — matching v2 (0050). Ilova runtime'da TS dvigatelni ishlatmaydi (foydalanuvchi ko'radigan ball SQL'dan) — foydalanuvchiga
ta'sir yo'q, lekin README'dagi "bir xil natija" da'vosi noto'g'ri edi (tuzatildi). Ochiq vazifa: TS'ni v2 ga ko'chirish yoki olib tashlash.

## 6. Feature flag matritsasi

| Bayroq | Qayerda | Lokal/CI sukut | Production (read-only, 2026-10-11) | Ta'siri |
|---|---|---|---|---|
| `ADMIN_UI_ENABLED` | env (server) | yoqilgan (`false` emas) | env — ko'rinmaydi | `false` → admin panel butunlay o'chiq |
| `ADMIN_HOST` | env (server) | bo'sh | env — ko'rinmaydi | admin faqat shu hostda; asosiy saytda `/admin` 404 |
| `BILLING_ENABLED` | env (server) | o'chiq | env — ko'rinmaydi | to'lov UI uchun **ham** env, **ham** `billing_enabled` kerak |
| `billing_enabled` | `app_settings` | false | **false** | false → barcha pullik oqimlar bepul |
| `listings_paid` | `app_settings` | true | true (billing o'chiq bo'lgani uchun amalda bepul) | e'lon joylash pullikmi |
| `ai_alerts_paid` | `app_settings` | true | **false** | AI PRO obunasi pullikmi |
| `moderation_enabled` | `app_settings` | true | true | e'lonlar moderatsiyadan o'tadi |
| `vacancy_moderation_enabled` | `app_settings` | false | false | eski vakansiya moderatsiya bayrog'i |
| `employer_verification_required` | `app_settings` | true | true | birinchi vakansiya admin tasdig'idan keyin |
| `admin_mfa_required` | `app_settings` | true | true | admin amallari uchun MFA |
| `profession_images_enabled` | `app_settings` | true | true | AI kasb tasvirlari |
| `security_alerts_enabled`, `security_restrictions_enforce` | `app_settings` (0056) | true / false | 0056 bilan qo'shildi (sukut) | xavfsizlik hodisalari va cheklovlar |
| `simple_listing_features().custom_profession` | DB funksiya (0057) | true | **true** | "Kasbim topilmadi" |
| `simple_listing_features().photo_quarantine` | DB funksiya (0058) | true | **true** | yopiq karantin bucket |
| AI kalitlari (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `IMAGE_GEN_API_KEY`) | env | bo'sh | env — ko'rinmaydi | bo'sh → AI tugmalari ko'rinmaydi, asosiy xizmat ishlaydi |

## 7. Tashqi sozlamalar (sir qiymatlari bu yerda yo'q)

| Nomi | Qayerga | Vazifasi | Qanday tekshiriladi |
|---|---|---|---|
| ~~0056 → 0057 → 0058~~ | Supabase → SQL Editor | ✅ 2026-10-11 qo'llandi | F-02 |
| `SUPABASE_DB_URL` | GitHub → Settings → Secrets → Actions | kunlik shifrlangan zaxira (Session pooler satri) | Actions → "DB backup" → Run → summary'dagi manifest |
| `BACKUP_AGE_RECIPIENT` | GitHub Secrets | age **ochiq** kaliti (yopiq kalit egasida oflayn) | o'sha run |
| `BACKUP_DISABLED` (ixtiyoriy) | GitHub → Variables | zaxirani ataylab o'chirish (run sariq, qizil emas) | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel → Environment Variables | server: rasm qayta kodlash, moderatsiya, fon ishlari | rasm yuklang → `v-…webp` yo'li |
| `CRON_SECRET`, `SECURITY_PEPPER`, `LOGIN_CODE_SECRET` | Vercel | cron himoyasi, HMAC kalitlari | `.env.example` izohlari |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Vercel + BotFather | kirish kodi, Mini App, bildirishnomalar | /auth → kod keladi |
| `storage_public_origin` | `app_settings` (0056 dan keyin) | rasm hostini qat'iy qilish | RUNBOOK §9 5-qadam |
| Staging loyiha | Supabase + Vercel Preview | yuklama testi, haqiqiy Telegram oqimi | F-09 |
| Field web-vitals | Vercel Speed Insights | real LCP/INP/CLS (p75) | Vercel paneli |

## 8. Ekranlar (avval/keyin, faqat test ma'lumotlari)

`docs/screenshots/` — `before-*` (audit tayanchi `506473a`) va `after-*` (HEAD), mobil (m, 390), planshet (t, 768), desktop (d, 1440):
bosh sahifa, qidiruv natijasi, qidiruv xatosi, "Kasbim topilmadi", kabinet. Yaratish: `node e2e/screens/capture.mjs <url> <prefiks>`.

| Nima ko'rinadi | Avval | Keyin |
|---|---|---|
| Qidiruv RPC xatosi (F-04): avval "e'lon topilmadi" (fayl bo'sh natija bilan baytma-bayt bir xil), endi xato + "Qayta urinish" + kod | [mobil](screenshots/before-search-error-m.jpg) | [mobil](screenshots/after-search-error-m.jpg) |
| "Kasbim topilmadi" (F-05): avval yo'l yo'q, endi "Qo'lda yozilgan" karta va tugma | [mobil](screenshots/before-post-worker-custom-m.jpg) | [mobil](screenshots/after-post-worker-custom-m.jpg) |
| Kabinet 768 px: avval sarlavha ekrandan chiqib, avatar kesilgan; endi sig'adi | [planshet](screenshots/before-cabinet-t.jpg) | [planshet](screenshots/after-cabinet-t.jpg) |
| Kontrast (tokenlar) | [desktop](screenshots/before-home-d.jpg) | [desktop](screenshots/after-home-d.jpg) |

## 9. Migratsiyalar va qaytish

| Migratsiya | Ta'sir | Qaytish |
|---|---|---|
| 0056 | xavfsizlik (RLS yozuv siyosatlari, pre-request, xavfsizlik hodisalari) | RUNBOOK §7 |
| 0057 | 2 ta RPC'ga aniq yamoq + `simple_listing_features()` | 0049 dagi funksiya matnlari (0056 yamog'i bilan) + funksiyani olib tashlash |
| 0058 | yangi yopiq bucket, 3 siyosat `ALTER POLICY` bilan toraytirildi, trigger, indeks, tozalash funksiyasi | 0049 dagi siyosat ifodalarini `ALTER POLICY` bilan qaytarish; triggerni o'chirish; bayroqni 0057 holatiga |

Hammasi qo'shimcha (DROP/DELETE yo'q), qayta qo'llash xavfsiz (0058) yoki xato bilan to'xtaydi (0057 — o'zgarishsiz).

## 10. C8 — ekranlar birma-bir (yangilangan master prompt)

Tartib: 1 poydevor → 2 bosh sahifa va navigatsiya → 3 qidiruv/filtr/kartalar → 4 ishchi e'loni → 5 vakansiya e'loni →
6 kirish va hisob → 7 kabinet/e'lon/profil → 8 arizalar/takliflar/chat/bildirishnomalar → 9 sozlamalar/yordam/huquqiy/admin →
10 regressiya. Har bosqich: OLDIN · KEYIN · fayllar · skrinshot · test · ochiq masala.

| # | Ekran | Holat | Commit |
|---|---|---|---|
| C8.1a | UI ovozlari | ✅ to'liq olib tashlandi | `6493eb6` |
| C8.1b | Qotishlar (C7) | ✅ 4 ta o'lchangan qotish tuzatildi — [PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md) | `3581aa0` |
| C8.1c | Yagona brend tizimi | ✅ — [BRAND_UI_GUIDE.md](BRAND_UI_GUIDE.md) | `c48c5ab` |
| C8.2 | Bosh sahifa va navigatsiya | ✅ | `8f5baca` |
| C8.3 | Qidiruv, filtr, kartalar | ✅ | `b595af3` |
| C8.4 | Ishchi e'loni | ✅ | `48c53fe` |
| C8.5 | Vakansiya e'loni | ✅ | `8eea94f` |
| C8.6 | Kirish va hisob | ✅ (haqiqiy Telegram yetkazish — BLOCKED) | `e705ab0` |
| C8.7 | Kabinet, e'lon, profil | ✅ | shu bosqich |
| C8.8 | Arizalar, takliflar, chat, bildirishnomalar | ⏳ keyingi | — |
| C8.9–C8.10 | … | ⏳ | — |

### C8.1c · Yagona brend tizimi

**OLDIN** (3581aa0, o'lchangan): 59 ta Tailwind palitra rangi, 6 ta bezak gradienti, 18 ta `backdrop-blur`, 80 ta ixtiyoriy
px-shrift, 52 ta `rounded-3xl`; AI PRO kartalari binafsha→ko'k gradient + blur + sariq toj; to'lov paneli sariq→to'q sariq
gradient; Telegram tugmalari `#229ED9`; tezkor amallar 4 xil rangda (ko'k, yashil, sariq, binafsha); kasb rasmi zaxirasi har
soha uchun boshqa rangli gradient. Checkbox (20 px, radius 12) amalda **doira** bo'lib chizilib, radiodan farqlanmasdi.
`Field` xato matni maydonga bog'lanmagan (90 ta xatoli maydon, ilovada atigi 5 ta `aria-describedby`).
**Qorong'i mavzu** (tizim sozlamasidan avtomatik yoqiladi) — 6 ta token juftligi AA dan past: yashil/sariq/qizil tugmadagi
oq matn 2.3 / 2.2 / 3.8:1, bosh sahifa oq tugmasidagi och-ko'k/yashil matn 3.15 / 2.27:1.

**KEYIN:**

- Bitta aksent (`primary`), semantik ranglar faqat ma'no uchun; barcha sirtlar tokenlarda (palitra/hex/gradient/blur — 0,
  istisnolar sababi bilan ro'yxatda).
- Shkalalar: shrift 2xs·xs·sm·md·base·lg·xl·2xl·3xl (yangi `text-2xs`, `text-md` tokenlari), radius xs…2xl, soya sm/md/lg.
- Qorong'i mavzu tokenlari tuzatildi (`--*-foreground` qorong'i fonlarda to'q matn; `primary #5a8ef8`, `destructive #f05252`);
  yorug' `destructive #d12020` (yumshoq fonda 4.23 → 4.67:1). Rangli fonda `text-white` → `*-foreground` (59 qator).
- 44 px barmoq maydoni: `tap-target` (ko'rinish o'zgarmaydi) — kichik tugma, chip, checkbox, switch.
- `Field` → `aria-describedby` + `aria-invalid` avtomatik.
- Rol tanlash (welcome) — ikki teng karta (yashil "aksent" yo'q), "Keyinroq" tugmasi 44 px.
- Konfetti — brend ranglarida; NavProgress — tekis `primary` (porlashsiz).
- `/dev/ui` — UI kit (faqat dev/E2E; production'da 404, noindex). Qo'llanma — `docs/BRAND_UI_GUIDE.md`.

**Fayllar:** `src/app/globals.css`, `src/components/ui/{button,chip,checkbox,dialog,label}.tsx`,
`src/components/shared/{quick-actions,profession-image,welcome-gate,coach-tour}.tsx`, `src/features/ai-alerts/*`,
`src/features/billing/components/{payment-dialog,top-profile-card}.tsx`, `src/lib/celebrate.ts`, `src/app/dev/ui/page.tsx`
va 80+ faylda mexanik shkala almashtirish (ko'rinishi bir xil: `rounded-3xl` = `rounded-2xl` = 24 px).

**Skrinshotlar** (bir xil E2E ma'lumotlari, chap — 3581aa0, o'ng — keyin; eski build `bash e2e/screens/old-build.sh 3581aa0` bilan :3301 da):
[bosh sahifa](screenshots/c8/c8-1-home-full-m.jpg) · [bosh sahifa, qorong'i](screenshots/c8/c8-1-home-dark-m.jpg) ·
[kabinet](screenshots/c8/c8-1-cabinet-full-m.jpg) · [qidiruv natijasi](screenshots/c8/c8-1-search-results-m.jpg) ·
UI kit: [mobil](screenshots/c8/c8-1-ui-kit-m.jpg), [desktop](screenshots/c8/c8-1-ui-kit-d.jpg).

**Testlar (PASS):**

| Test | Natija |
|---|---|
| `src/lib/brand-guard.test.ts` — 8 qoida × 300+ fayl | ✅ 10/10; ataylab qo'yilgan buzilishli fayl 7 qoidada ushlandi (tekshirildi va o'chirildi) |
| `src/lib/brand-contrast.test.ts` — 19 juftlik × 2 mavzu | ✅ (oldin: yorug' 1, qorong'i 5 juftlik AA dan past) |
| `src/components/ui/field.test.tsx` | ✅ 3/3 |
| Unit jami | ✅ 534 o'tdi, 18 skip (paritet suite — sababi §2 F-07 va README'da) |
| E2E jami (`npx playwright test -c e2e`) | ✅ 34/34 (yangi: UI kit a11y × 5 kenglik, qorong'i mavzu kontrasti × 6 sahifa) |
| `tsc`, `eslint` | ✅ |

**Ochiq (keyingi ekranlarda):**

- Bosh sahifa: ikki katta rangli karta (ko'k + yashil) — "bitta aksent" qoidasiga zid; qorong'i mavzuda juda yorqin.
  Qidiruv kartasida emoji + ikonka takrori. Kartalarda sakrovchi (`cubic-bezier(…1.56…)`) hover → C8.2.
- Qidiruv kartasida ish joyi rasmi yuklanmasa alt-matn chiqadi (buzilgan rasm) → C8.3.
- Kabinet: yashil "Ishga joylashdim" tugmasi `success`ni aksent sifatida ishlatadi; tugma uslublari aralash → C8.7.
- Qorong'i mavzu kontrasti E2E da 6 sahifada tekshiriladi; qolgan sahifalar o'z bosqichida qo'shiladi.
- ~~Bir E2E yugurishida qorong'i mavzu testi `networkidle` ni kutib qoldi~~ — sababi C8.2 da topildi va tuzatildi (Q8).

### C8.2 · Bosh sahifa va navigatsiya

**OLDIN** (c48c5ab):

- **Chalkash CTA:** "Siz ish qidiryapsizmi? → **Ish qidiryapman**" tugmasi ish e'lonlari ro'yxatini emas, **o'zingiz haqingizda
  e'lon berish formasini** ochardi; "Ishchi qidiryapman" — vakansiya formasini. Ro'yxatni ko'rish alohida 3-kartada edi.
  Xuddi shu yorliqlar kabinet ("Yangi e'lon"), "Menga mos ishlar" va tasdiqlash sahifalarida ham shu formalarga olib borardi.
- **Uchta dominant rangli sirt:** ko'k karta + yashil karta + to'liq ko'k AI PRO kartasi; qorong'i mavzuda — juda yorqin.
  AI kartasida doimiy miltillovchi qo'ng'iroq, kartalarda sakrovchi hover (`cubic-bezier(…1.56…)`); "🔍" emoji + ikonka takrori.
- **Planshet (768 px):** 3 ustun juda tor — sarlavhalar so'z o'rtasida bo'linardi ("qidiryapsizm / i?").
- Mehmon 390 px da faqat belgini ko'rardi (brend nomi yo'q); "Kirish" — to'liq ko'k tugma, kartalar bilan raqobat.
- Navigatsiya landmark'i inglizcha `aria-label="Main"`; desktop havolalari `<nav>` siz.
- **Ishlamaydigan tugma:** Yordam → "Qisqa turni qayta ko'rish" cookie'ni o'chirib bosh sahifaga o'tkazardi, u yerda tur yo'q —
  hech narsa bo'lmasdi. Tur faqat ulanmagan `WelcomeGate` qo'yadigan cookie bilan boshlanardi, ya'ni yangi foydalanuvchilarda
  hech qachon chiqmasdi. O'lik kod: `WelcomeGate`, `LandingPage`, `WorkerHome` (+ unga bog'liq 5 komponent) hech qayerga ulanmagan.

**KEYIN:**

- Uchta yo'l saqlandi, lekin har biri **qayerga olib borishini aytadi**: "Ish qidiryapsizmi? → **O'zim haqimda e'lon berish**",
  "Ishchi kerakmi? → **Ish e'loni berish**", "E'lonlarni ko'rish → **Ish e'lonlari** / **Ishchilar**" (ro'yxatdan o'tmasdan;
  qidiruvning birinchi savoli o'tkazib yuboriladi — bitta bosish kam). Tavsif "keyin nima bo'ladi"ni aytadi
  ("ish beruvchilar sizni qidiruvda topib, bog'lanadi"). 4 tilda.
- Neytral kartalar, rang faqat tugmalarda; AI PRO — yumshoq brend sirti, asosiy yo'llardan keyin; miltillash/sakrash yo'q.
- Joylashuv: telefon 1 ustun · planshet 2 + 1 · 1024 px dan 3 ustun.
- Mehmon: brend nomi har kenglikda; "Kirish" — `soft`. Navigatsiya: `<nav aria-label="Asosiy bo'limlar">` (mobil va desktop).
- Tur va "turni qayta ko'rish" tugmasi olib tashlandi (master prompt C9: majburiy tanishtiruv yo'q); 9 ta o'lik fayl va
  ishlatilmaydigan `welcome.*` matnlari o'chirildi (−280 qator JSON, client bundle kichraydi).
- **Qotish Q8 (topildi va tuzatildi):** kirgan foydalanuvchida `/search` ochilganda namunaviy so'rov havolalari
  (`/search?q=Buxgalter kerak` …) oldindan yuklanadi (prefetch). Bu manzillar serverda boshqa URL'ga yo'naltiriladi.
  Dalil (log-proksi): server ikkala so'rovga 24–29 ms da to'liq javob bergan, lekin brauzerda ular 15 s+ ochiq qolgan —
  Next router yo'naltirilgan prefetch javobini yopmay ushlab turadi. HTTP/1.1 da xostga 6 ta ulanish bor: bir necha
  marta ochilsa, keyingi so'rovlar navbatda qoladi (sahifa "qotadi"). Shu sabab E2E (qorong'i mavzu) va CI (`main`,
  c48c5ab) vaqti-vaqti bilan yiqilgan. Tuzatish: shu havolalarda `prefetch={false}` (yo'naltiriladigan sahifani oldindan
  yuklash foydasiz). Takrorlash sinovi: kirgan foydalanuvchi bilan bosh sahifa → `/search` 20 marta — **oldin**
  3 ta sinovda 1–2-urinishdayoq osilgan, **keyin 0/20**; to'liq E2E 42/42.
- CI: E2E artefaktlari endi yuklanadi (`include-hidden-files: true` — avval `e2e/.stack` yashirin papka sifatida
  o'tkazib yuborilardi, CI yiqilishi dalilsiz qolardi); CI'da Playwright `github` reporter (yiqilish annotatsiyada).

**Fayllar:** `src/features/landing/home-three.tsx`, `src/features/ai-alerts/components/ai-pro-card.tsx`,
`src/components/shared/{top-bar,app-shell,welcome-cookie}.tsx`, `src/app/help/page.tsx`,
`src/features/employer/components/dashboard/{employer-dashboard,employer-sections}.tsx`, `messages/*/{easy,common,welcome}.json`;
o'chirildi: `welcome-gate`, `coach-tour`, `replay-tour-button`, `landing-page`, `worker-home`, `worker-main-cards`,
`ai-alerts-card`, `profession-focus`, `worker-stats`. Testlar: `e2e/specs/home.spec.ts` (yangi), `no-ui-sound`, `responsiveness`.

**Skrinshotlar** (chap — c48c5ab, o'ng — keyin): [mobil](screenshots/c8/c8-2-home-full-m.jpg) ·
[planshet](screenshots/c8/c8-2-home-t.jpg) · [desktop](screenshots/c8/c8-2-home-d.jpg) ·
[qorong'i](screenshots/c8/c8-2-home-dark-m.jpg) · [kabinet (AI kartasi)](screenshots/c8/c8-2-cabinet-full-m.jpg).

**Testlar:**

| Test | Natija |
|---|---|
| `home.spec.ts`: 4 yo'l × "tugma → kutilgan sahifa va sarlavha" | ✅ 4/4 |
| `home.spec.ts`: bitta h1; ≥ 80 px rangli sirt yo'q; AI bonusi asosiy yo'llardan pastda | ✅ |
| `home.spec.ts`: mehmonda brend nomi va "Kirish"; `aria-current` bo'lim almashganda ko'chadi | ✅ |
| `home.spec.ts`: kirgan foydalanuvchi 360/390 px — gorizontal siljish yo'q, chat/bildirishnoma ko'rinadi | ✅ |
| `home.spec.ts`: 360/768/1024/1440 px — karta matni chetdan chiqmaydi | ✅ |
| a11y (8 sahifa × 5 kenglik, qorong'i mavzu — endi tinchlanmasa tugamagan so'rovlarni ko'rsatib yiqiladi), `no-ui-sound`, `responsiveness` (20 o'tishda tinglovchi 429 → 429) | ✅ |
| Q8 takrorlash: kirgan foydalanuvchi, bosh sahifa → `/search` × 20 | ✅ 0/20 osilish (oldin 1–2-urinishda) |
| To'liq E2E (`npx playwright test -c e2e`) | ✅ 42/42 |
| Unit 534 ✅ / 18 skip · `tsc` ✅ · `eslint` ✅ | ✅ |

### C8.3 · Qidiruv, filtr, kartalar

**OLDIN** (8f5baca):

- **Buzilgan rasm:** ish joyi surati ochilmasa (fayl o'chirilgan/karantinda/tarmoq) kartada buzilgan belgi va kartadan
  chiqib ketadigan "Ish joyi surati" alt-matni ko'rinardi (E2E stendida doim, production'da ham fayl yo'qolsa).
- **Filtr xatosi:** "Filtrni tozalash" dan keyin oyna qayta ochilsa, eski tanlov belgilangan turardi va "Natijalarni
  ko'rsatish" uni qayta yoqardi (oyna holati URL bilan sinxronlanmagan).
- **Bo'sh natija:** "Butun O'zbekiston" bo'yicha ham "Bu hududda… topilmadi" va foydasiz "Hududni o'zgartirish" tugmasi;
  ishchilar qidiruvida ham "e'lon topilmadi"; filtr sababli bo'sh bo'lsa — filtrni olib tashlash yo'li yo'q.
- "Nimani qidiryapsiz?" — ko'k + yashil dominant kartalar; kartadagi "Qo'ng'iroq qilish" yashil (semantik rang aksent sifatida).
- **Kirill (oz) imlo xatosi (butun ilova):** transliterator `yo'` ni "ёъ" ga o'girardi — 22 faylda **~110 joy**:
  "Ёъқ" (yo'q), "Ёъналиш" (yo'nalish), "Ёъл" (yo'l) … Bazadagi kasb/hudud nomlari ham ko'rsatishda shu funksiyadan o'tadi.

**KEYIN:**

- `Photo` komponenti (`next/image`, `unoptimized`, `onError`): rasm ochilmasa — kasb tasviri; hydration'dan oldingi xato ham
  ushlanadi. Qidiruv kartalari (ish va ishchi), e'lon sahifasi, vakansiya tafsiloti. 4 ta `eslint-disable` olib tashlandi.
- Filtr oynasi har ochilishda URL'dagi joriy filtrlardan boshlanadi.
- Bo'sh natija: mamlakat bo'yicha — "Hozircha «Haydovchi» bo'yicha ish e'loni yo'q" + "Kasbni o'zgartirish"; hudud bo'yicha —
  "Bu hududda hozircha ish e'loni yo'q / ishchi topilmadi" + kengaytirish; filtr bo'lsa — "Filtrlarsiz qidirish". 4 tilda.
- Maqsad kartalari neytral; "Qo'ng'iroq qilish" — kartaning yagona asosiy amali (`primary`), "Batafsil" — standart ikkinchi darajali.
- Transliterator: `yo` dan keyin tutuq belgisi bo'lsa → "йў"; mavjud `oz` fayllarida faqat shu xato almashtirildi
  (qo'lda yaxshilangan tarjimalar saqlandi); regressiya testi — `oz` da "ёъ" bo'lmasligi.

**Fayllar:** `src/components/shared/photo.tsx` (yangi), `src/features/find/components/{find-page,find-client,result-cards}.tsx`,
`src/features/jobs/components/vacancy-detail.tsx`, `src/app/listing/[id]/page.tsx`, `src/lib/i18n/translit.ts`,
`messages/*/easy.json`, `messages/oz/*.json` (22 fayl, faqat "ёъ"→"йў"). Testlar: `e2e/specs/search-ui.spec.ts` (yangi),
`src/lib/i18n/translit.test.ts`.

**Skrinshotlar** (chap — 8f5baca, o'ng — keyin): [qidiruv boshi](screenshots/c8/c8-3-search-start-m.jpg) ·
[natija (rasm ochilmaydi)](screenshots/c8/c8-3-search-results-full-m.jpg) · [bo'sh natija](screenshots/c8/c8-3-search-empty-m.jpg) ·
[ishchilar, bo'sh](screenshots/c8/c8-3-search-workers-m.jpg).

**Testlar:**

| Test | Eski build (8f5baca) | Keyin |
|---|---|---|
| `search-ui.spec.ts` — rasm ochilmasa kasb tasviri, buzilgan `<img>` 0 | ❌ | ✅ |
| — mamlakat bo'yicha bo'sh: kasb nomi, "Hududni o'zgartirish" yo'q | ❌ | ✅ |
| — hudud bo'yicha bo'sh (ishchilar): "Bu hududda… ishchi topilmadi" → kengaytirish | ❌ | ✅ |
| — filtr sababli bo'sh → "Filtrlarsiz qidirish" | ❌ | ✅ |
| — "Filtrni tozalash" dan keyin oyna toza | ❌ (hali belgilangan) | ✅ |
| — qidiruv boshi: ≥ 80 px rangli sirt yo'q | ❌ | ✅ |
| `translit.test.ts` — yo'q/yo'l/yo'nalish; `oz` fayllarida "ёъ" yo'q | — | ✅ 15/15 |
| To'liq E2E · unit · tsc · eslint | — | ✅ 48/48 · 536 / 18 skip · ✅ · ✅ |

### C8.4 · Ishchi e'loni

4 qadam, katalogda yo'q kasb, qoralama, oflayn va ikki marta bosish oldingi bosqichlarda (B1, B3, C8.1b) tuzatilgan va testlangan.
Bu bosqichda qabul #32 dagi **to'liq yo'l** birinchi marta oxirigacha yurgizildi va u ikkita haqiqiy xatoni ochdi.

**OLDIN** (b595af3):

- **Telefon raqami buziladi (3 ta forma, shu jumladan kirish/login):** maydonga O'zbekistonda odatiy ko'rinishda
  `901234567` yoki `90 123 45 67` yozilsa/joylansa, u **"+90 1234567"** (Turkiya kodi) ga aylanardi va "Telefon raqamini
  to'liq yozing" xatosi chiqardi — mehmon e'lonni joylay olmasdi. To'liq raqam ustiga qisqa ko'rinishda joylash esa
  "o'chirish" deb tushunilib, formatlanmasdi.
- **Javoblar yo'qoladi:** mehmon formani to'ldirib, sarlavhadagi **"Kirish"** ni bossa, kirgandan keyin o'sha qadamga qaytardi,
  lekin barcha javoblari bo'sh edi (o'tkazish faqat formaning ichki tugmalarida ishlardi).
- Tekshirish qadamida kasb "Buxgalteriya va moliya › Buxgalteriya › Buxgalter" — uch qatorga cho'zilardi.

**KEYIN:**

- `phoneInputValue` / `phoneInputChange` (`src/lib/format`): "+" siz raqam — mahalliy (+998), `998…` — xalqaro, eski
  `8 90 …` — +998; o'chirish faqat raqamlar oldingisining boshi bo'lganda formatlanmaydi. Ishchi va vakansiya formasi,
  ro'yxatdan o'tish va **kirish formasi** — bitta funksiya.
- Sarlavhadagi "Kirish" `ishuz:auth-handoff` hodisasini yuboradi; ochiq e'lon formasi (`useDraft`) qoralamani kirgan hisobga
  o'tkazishga tayyorlaydi — xuddi formaning o'z "Kirish va e'lonni joylash" tugmasidek (B1 izolyatsiyasi saqlanadi).
- Tekshirish qadamida — kasb nomi, soha yo'li ostida kichik.

**Fayllar:** `src/lib/format/index.ts`, `src/features/post/components/{inputs,worker-post}.tsx`,
`src/features/auth/components/auth-form.tsx`, `src/features/onboarding/components/steps/step-1-personal.tsx`,
`src/components/shared/login-link.tsx`, `src/features/post/use-draft.ts`. Testlar: `e2e/specs/journeys.spec.ts` (yangi),
`drafts.spec.ts` (+1), `src/lib/format/phone.test.ts` (yangi); `no-ui-sound`/`responsiveness` — o'z holatini o'zi tayyorlaydi.

**Skrinshotlar** (chap — b595af3, o'ng — keyin): [telefon `901234567` → keyingi qadam](screenshots/c8/c8-4-phone-m.jpg) ·
[tekshirish qadami](screenshots/c8/c8-4-review-m.jpg).

**Testlar:**

| Test | Eski build (b595af3) | Keyin |
|---|---|---|
| `journeys.spec.ts` — mobil: bosh sahifa → e'lon → "Kirish va e'lonni joylash" → kirish → joylash → kabinet | ❌ (3-qadamda telefon xatosi) | ✅ |
| — desktop (1440): xuddi shu yo'l | ❌ | ✅ |
| — kirish sahifasiga raqam `+998901234567` bo'lib o'tadi; `90 123 45 67` joylansa formatlanadi | ❌ | ✅ |
| `drafts.spec.ts` — sarlavhadagi "Kirish" dan keyin javoblar joyida | ❌ (javob `""`) | ✅ |
| `phone.test.ts` — 6 holat (mahalliy, xalqaro, `8 90`, yozish, o'chirish, ustiga joylash) | — | ✅ |
| To'liq E2E · unit · tsc · eslint | — | ✅ 51/51 · 542 / 18 skip · ✅ · ✅ |

**Ochiq:** haqiqiy Telegram kodi bilan kirish (kod kechikishi, qayta yuborish, eskirgan kod) — stendda Telegram yo'q,
**BLOCKED** (C8.6 da matn va holatlar tekshiriladi, haqiqiy yuborish — staging/real bot bilan).

### C8.5 · Vakansiya e'loni

4 qadam, tashkilot turi (xususiy/davlat/YATT/o'zim uchun), maosh davri ("Maosh (so'm, oyiga)", tahrirda boshqa davr — batafsil
tahrirga havola), aloqa roziligi (belgilanmasa raqam ko'rinmaydi) va idempotent joylash (`clientRef`, C8.1b) avvaldan bor.
Bu bosqichda vakansiya uchun ham to'liq yo'l yurgizildi.

**OLDIN** (48c53fe):

- **Eskirgan xatolar (ikkala forma):** "Davom etish" bo'sh bosilgach, foydalanuvchi har bir maydonni to'g'rilasa ham qizil
  xatolar ("Kim e'lon berayotganini tanlang", "Nomini yozing", "kamida 10 ta harf yozing", "Maoshni yozing…") va qizil chegaralar
  joyida qolardi — faqat keyingi bosishda yo'qolardi. Ekran "hammasi noto'g'ri" deb ko'rsatardi.
- Tekshirish qadamida "Mutaxassis: Buxgalteriya va moliya › Buxgalteriya › Buxgalter" — uch qatorga cho'zilardi.

**KEYIN:**

- `clearEditedErrors` (`src/features/post/field-errors.ts`): maydon tahrirlangan zahoti o'sha maydon xatosi o'chadi (maosh
  "dan/gacha/kelishiladi" — bitta xato); barcha maydon xatosi ketgach umumiy xabar ham. Qayta tekshiruv — keyingi bosishda.
  Moderatsiya belgilagan maydon ham tahrirlangach tozalanadi. Ishchi va vakansiya formalari.
- Tekshirish qadamida — kasb nomi, soha yo'li ostida.
- C8.4 dagi telefon formati va sarlavha "Kirish" o'tkazishi vakansiya formasida ham ishlaydi (umumiy kod).

**Fayllar:** `src/features/post/field-errors.ts` (+ unit test), `src/features/post/components/{vacancy-post,worker-post}.tsx`.
Testlar: `e2e/specs/post-forms.spec.ts` (yangi), `e2e/specs/journeys.spec.ts` (+2: ish beruvchi yo'li, mobil va desktop).

**Skrinshot:** [3-qadam: maydonlar to'ldirilgach](screenshots/c8/c8-5-stale-errors-m.jpg) (chap — 48c53fe, o'ng — keyin).

**Testlar:**

| Test | Eski build (48c53fe) | Keyin |
|---|---|---|
| `post-forms.spec.ts` — vakansiya: xatolar birma-bir yo'qoladi, `aria-invalid` 0, keyingi qadam ochiladi | ❌ | ✅ |
| — ishchi: ism/tajriba xatosi tuzatilgach yo'qoladi | ❌ | ✅ |
| `journeys.spec.ts` — ish beruvchi: bosh sahifa → e'lon → kirish → joylash (`monthly`, 4–6 mln) → kabinet → mehmon qidiruvida, mobil + desktop | — | ✅ |
| `field-errors.test.ts` — 4 holat | — | ✅ |
| To'liq E2E · unit · tsc · eslint | — | ✅ 55/55 · 546 / 18 skip · ✅ · ✅ |

### C8.6 · Kirish va hisob

Veb'da kirish: telefon raqam → kod Telegram bot orqali → tasdiqlash; Telegram Mini App ichida — `initData` bilan avtomatik.
Qaytish yo'li (`next`) va mehmon qoralamasini o'tkazish C8.4 da tekshirildi.

**OLDIN** (8eea94f):

- **Noto'g'ri va'da:** kirish sahifasi "Telegram orqali bir bosishda kiring — parol ham, **kod ham kerak emas**" derdi, keyin esa
  aynan kod so'rardi (4 tilda).
- **Internet uzilsa** — umumiy "Kirib bo'lmadi. Qayta urinib ko'ring." (oflayn ekanligi aytilmasdi).
- Serverning 4 ta aniq javobi (`temporarily_unavailable`, `temporarily_restricted`, `blocked`, `cross_site`) uchun matn bor
  edi, lekin forma ularni tanimas va umumiy xato ko'rsatardi (masalan, bloklangan foydalanuvchi sababini bilmasdi).
- Kod qadamida "Raqamni o'zgartirish" va "Kodni qayta yuborish" — 20 px balandlikdagi matnli tugmalar.
- Telefon maydonidagi "+90…" xatosi — C8.4 da tuzatildi (kirish formasi ham).

**KEYIN:**

- Sarlavha: "Telefon raqamingizni yozing — kirish kodini Telegram orqali yuboramiz. Parol kerak emas." (4 tilda).
- `offline` / `network` xatolari: "Internet aloqasi yo'q. Ulanishni tekshirib, qayta urinib ko'ring." / "Serverga ulanib bo'lmadi…".
- Server javoblari aniq matn bilan; kichik matnli tugmalar 44 px.
- Bot sozlanmagan bo'lsa — "Telegram orqali kirish hozircha o'chirilgan", **soxta "kod yuborildi" yo'q** (E2E tasdiqlaydi).

**Fayllar:** `src/features/auth/components/auth-form.tsx`, `messages/*/auth.json`. Test: `e2e/specs/auth.spec.ts` (yangi, 6 test).

**Skrinshotlar** (chap — 8eea94f, o'ng — keyin): [internet yo'q](screenshots/c8/c8-6-auth-offline-m.jpg) ·
[server vaqtincha ishlamayapti](screenshots/c8/c8-6-auth-503-m.jpg).

**Testlar** (Telegram stendda yo'q: "bot sozlanmagan" — haqiqiy server; qolgan server javoblari `page.route` bilan):

| Test | Eski build | Keyin |
|---|---|---|
| bot sozlanmagan — aniq xabar, "yuborildi" yo'q, tugma ishlaydi; sarlavha kod haqida to'g'ri aytadi | ✅ (sarlavhasiz) | ✅ |
| internet yo'q → "Internet aloqasi yo'q" | ❌ | ✅ |
| 503 → "Xizmat vaqtincha ishlamayapti", umumiy xato emas | ❌ | ✅ |
| raqam Telegram'ga ulanmagan → 3 qadamli yo'riqnoma | ✅ | ✅ |
| kod: noto'g'ri → eskirgan → 60 s hisoblagich → qayta yuborish (Playwright soati) | ✅ | ✅ |
| chiqish → sarlavhada "Kirish"; kabinet "Hisobga kiring" + qaytish havolasi | ✅ | ✅ |
| To'liq E2E · unit · tsc · eslint | — | ✅ 61/61 · 546 / 18 skip · ✅ · ✅ |

**BLOCKED / NOT_RUN:** haqiqiy Telegram bot orqali kod yetkazish, kod kechikishi va bot bloklangan holat (`telegram_blocked`) —
staging'da haqiqiy bot tokeni bilan tekshirilishi kerak. Muqobil kirish (SMS) — provayder va narx qarori kerak (soxta SMS yo'q).

### C8.7 · Kabinet, e'lon sahifasi, profil

Kabinet ikkala rol uchun bitta sahifa: "Mening e'lonlarim" (holat + keyingi amal), AI PRO kartasi, "Yangi e'lon berish",
"Boshqa bo'limlar". E'lon sahifasi (`/jobs/[slug]`, `/listing/[id]`) va `/profile` (oddiy e'lon bergan foydalanuvchi uchun —
profil turini tanlash) shu bosqichda.

**OLDIN** (dd39e27):

- **Yopuvchi amal eng yorqin:** "Ishchi topdim" / "Ishga joylashdim" — to'q yashil to'ldirilgan tugma, kartadagi eng ko'zga
  tashlanadigan element. Bu e'lonni *yopadi*; asosiy amal emas, tasodifan bosilishi oson.
- Muddat: "Faol — qidiruvda ko'rinadi · 22 Oktabr 2026" — nima ekanligi aytilmagan ("gacha" yo'q), oy bosh harf bilan.
- "Yangi e'lon berish": ikki teng yo'l — biri ko'k, biri yashil chegarali (ikki aksent rang).
- Vakansiya sahifasi: "Bandlik turi: **Full-time**" (inglizcha; "Part-time", "Freelance" ham). Kasb yo'li mobil'da yangi qator
  boshida yolg'iz "·" bilan boshlanardi. Yangi e'lon: "**0 sekund oldin** joylangan".
- `/profile` → tanlov ekrani: "Ish qidiryapman" — to'liq ko'k karta (oq tugma bilan), "Ishchi qidiryapman" — oq karta: teng
  tanlovlardan biri ustun ko'rinardi. "Ikkala rejimdan foydalanish mumkin" izohi sarlavha ostida ham, pastda ham takrorlanardi.
- Ishchi e'loni (`/listing/[id]`, egasi): holat — qalin yashil chegarali katta blok; surat ham, kasb rasmi ham bo'lmasa, ikonka
  plitasi ustida "Kasb tasviri" yozuvi (rasm yo'q joyda "tasvir" deyilardi).

**KEYIN:**

- "Ishchi topdim" / "Ishga joylashdim" — `outline` tugma, yashil faqat belgida (`CheckCircle2`); asosiy aksent qolmadi.
  Tasdiqlash oynasi avvalgidek.
- Muddat: "Faol — qidiruvda ko'rinadi · 22-oktabr 2026 gacha" (`easy.cabinet.status.active_until`, 4 tilda). `formatDate`
  o'zbek imlosiga mos: "22-oktabr 2026", "22-okt 2026, 12:00" (lotin va kirill; rus/ingliz o'zgarmaydi) — butun ilovada.
- "Yangi e'lon berish": ikki bir xil neytral karta, belgi `primary-soft` plitkada.
- Bandlik turi: "To'liq kun", "Yarim kun", "Frilans" (uz/oz). Kasb yo'li o'z qatorida, ajratuvchi nuqtasiz.
- Nisbiy vaqt: bir daqiqagacha "hozirgina" / "ҳозиргина" / "только что" / "just now" (`formatRelative`, 54 joyda ishlatiladi).
- Profil tanlovi: ikki teng neytral karta, ikkalasida bir xil asosiy tugma; takrorlangan pastki izoh olib tashlandi.
- Ishchi e'loni: neytral karta + kabinetdagi bilan bir xil holat yozuvi (`StatusPill`, endi umumiy komponent). "Kasb tasviri"
  yozuvi faqat haqiqiy kasb rasmi ustida (`ProfessionImage` — qidiruv kartalari, e'lon sahifasi, formalar).

**Fayllar:** `src/features/cabinet/components/{cabinet-page,listing-actions,status-pill}.tsx`, `src/app/onboarding/page.tsx`,
`src/app/listing/[id]/page.tsx`, `src/components/shared/profession-image.tsx`,
`src/features/jobs/components/vacancy-detail.tsx`, `src/lib/format/index.ts` (+ `date.test.ts`),
`messages/*/{easy,onboarding}.json`, `messages/{uz,oz}/enums.json`. Test: `e2e/specs/cabinet.spec.ts` (yangi, 4 test).

**Skrinshotlar** (chap — dd39e27, o'ng — keyin): [kabinet, ish beruvchi](screenshots/c8/c8-7-cabinet-employer-m.jpg) ·
[vakansiya sahifasi](screenshots/c8/c8-7-job-detail-m.jpg) · [profil tanlovi](screenshots/c8/c8-7-profile-choice-m.jpg) ·
[ishchi e'loni, egasi](screenshots/c8/c8-7-listing-owner-m.jpg).

**Testlar:**

| Test | Eski build (dd39e27) | Keyin |
|---|---|---|
| `cabinet.spec.ts` — muddat "22-oktabr 2026 gacha"; "Ishchi topdim" foni `--success` emas; ikki "yangi e'lon" havolasi bir xil chegara | ❌ | ✅ |
| — vakansiya: "To'liq kun", "Full-time" yo'q; qator boshida yolg'iz "·" yo'q | ❌ | ✅ |
| — `/profile` → tanlov: ≥80 px brend rangli sirt 0 ta, "ikkala rejim" izohi 1 marta | ❌ | ✅ |
| — ishchi e'loni (egasi): yashil chegarali element 0 ta, "Kasb tasviri" ikonka ustida yo'q | ❌ | ✅ |
| `date.test.ts` — o'zbek sana imlosi (lotin/kirill), rus/ingliz o'zgarmaydi, "hozirgina" | — | ✅ |
| To'liq E2E · unit · tsc · eslint | — | ✅ 65/65 · 552 / 18 skip · ✅ · ✅ |

**Ochiq masalalar:**

- "Toshkent shahri · **Butun viloyat**" — shahar uchun "viloyat" so'zi noto'g'ri (kartalar va e'lon sahifasi; RPC hudud turini
  qaytarmaydi). C8.10 regressiyada hudud turi bilan tuzatiladi.
- `eslint-disable` izohlari 12 joyda qolgan (`<img>`: imzolangan vaqtinchalik URL, satori, SVG data URI va h.k.) — barchasi C8 dan
  oldingi, sababi yozilgan; yangi kodda yo'q. C8.10 da har biri `Photo`/`next/image`ga o'tkazish yoki asos bilan qoldirish
  sifatida ko'rib chiqiladi.
