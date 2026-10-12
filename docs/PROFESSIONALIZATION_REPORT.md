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
