# Masshtab: 1 mln foydalanuvchiga tayyorlik

Bu hujjat "1 mln odam ishlatsa osilib qolmasin, bosganda yengil va silliq ishlasin" bosqichida nima tekshirilgani,
nima o'zgargani, o'lchovlar va keyingi qadamlarni yozadi.

## 1. Yuklama testi (1 mln foydalanuvchi)

`npm run db:load` — toza **lokal** bazada (masofaviy bazaga ulanmaydi) barcha migratsiyalarni qo'llaydi,
sintetik ma'lumot yuklaydi va asosiy so'rovlarni o'lchaydi (`scripts/load-test.sh`, `scripts/load/*.sql`):

| Ma'lumot | Hajm |
|---|---|
| Profillar | 1 000 000 |
| Ishchi e'lonlari | 700 000 (yarmi ochiq) |
| Vakansiyalar | 600 000 (150 000 faol) |
| Bildirishnomalar | 3 000 000 |
| Arizalar | 500 000 |

O'lchov Supabase'dagi sozlama bilan (`random_page_cost = 1.1`, SSD), eng yaxshi natija, ms.
"Oldin" — 0054 holati, "keyin" — 0055 migratsiyasidan keyin:

| So'rov | Oldin | Keyin |
|---|---:|---:|
| Qidiruv: shifokorlar + Toshkent (mehmon) | 13 | 9 |
| Qidiruv: shifokorlar, butun mamlakat | 64 | 17 |
| Qidiruv: 3-sahifa | 62 | 15 |
| Nomzodlar qidiruvi: shifokorlar + Toshkent | 19 | 17 |
| So'nggi faol vakansiyalar (RLS) | 0,2 | 0,1 |
| O'qilmaganlar soni (har sahifada) | 0,7 | 0,5 |
| Bildirishnomalar, 20 ta (3 mln jadval) | 0,1 | 0,0 |
| Ishchi: mening arizalarim | 0,2 | 0,5 |
| Ish beruvchi: so'nggi arizalar | 0,5 | 0,8 |
| *[yomon namuna]* arizalar filtrsiz (500 ming) | 10 468 | 5 326 |

Ilovaning haqiqiy so'rovlari 1 mln ma'lumotda **1–17 ms**. Sekin namuna (oxirgi qator) ilovada yo'q — u filtrsiz
so'rov RLS'ni har qatorda tekshirishini ko'rsatadi (qarang: 5-bo'lim qoidalari).

## 2. Ma'lumotlar bazasi (migratsiya 0055)

**RLS initPlan.** Supabase performance advisor 54 ta qoidada `auth.uid()` va yordamchi funksiyalar
(`is_admin()`, `is_active_user()`, `current_worker_id()`, `current_employer_id()`, `has_admin_permission('…')`)
har qator uchun qayta chaqirilayotganini ko'rsatdi. 0055 ularni `(select …)` ko'rinishiga o'tkazadi — so'rov boshida
bir marta hisoblanadi. Mantiq o'zgarmaydi (funksiyalar STABLE), qoidalar o'chirilmaydi (`ALTER POLICY`),
takror ishga tushirilsa hech narsa o'zgarmaydi. Advisor: 54 → 14.

Qolgan 14 qoida 8 ta jadvalda (`profiles`, `vacancies`, `worker_profiles`, `companies`, `company_members`,
`employer_profiles`, `conversation_members`, `profile_contacts`) — ular ataylab o'zgartirilmadi: bu jadvallarning
qoidalari bir-biriga (yoki o'ziga, masalan `vacancies_update` eski qiymatni o'z jadvalidan o'qiydi) halqa bo'lib
murojaat qiladi. Ularga ichki so'rov qo'shilsa Postgres RLS'ni yoyishda `infinite recursion detected in policy`
xatosini beradi. Migratsiya bunday jadvallarni `pg_depend` orqali avtomatik aniqlaydi va chetlab o'tadi.

**Qidiruv funksiyasi** (`simple_search_vacancies`, eng ko'p chaqiriladigan so'rov) — natija o'sha-o'sha:
- "kasb tanlanmaganmi YOKI kasb tuguni YOKI eski e'lon nomi" bitta `OR`da bo'lgani uchun kasb indeksi ishlatilmay,
  barcha faol vakansiyalar ko'rib chiqilardi. Endi uchta alohida tarmoq (`UNION ALL`, kesishmaydi);
- kompaniya/hudud/kasb nomlari va tavsif qisqartmasi 5000 qatorga emas, faqat sahifadagi 20 tasiga qo'shiladi;
- bir xil sanadagi e'lonlar sahifalar orasida takrorlanmaydi (oxirgi tartib kaliti — `id`).

Eski va yangi funksiya 1 mln ma'lumotda 7 xil holatda (sahifalar, hudud, tuman, maosh, jadval, tajriba,
masofaviy) solishtirildi — umumiy son, tartib kalitlari va har bir ustun bir xil.

**Indekslar.** Profil yoki vakansiyaga ishora qiluvchi indekssiz tashqi kalitlar (profil o'chirilganda/tekshirilganda
3 mln qatorli jadval butunlay ko'rib chiqilmasin) va AI kuzatuvlari/obunalar mosligi uchun kasb/hudud indekslari.
Advisor: 37 → 18 (qolganlari — kichik ma'lumotnoma jadvallariga, ular deyarli o'chirilmaydi).

**Testlar:** `supabase/tests/scale_rls.test.sql` (qoidalar o'ralgani, halqali jadvallar tegilmagani, egasi
vakansiyani rekursiyasiz tahrirlashi, qidiruv: kasb daraxti, eski e'lonlar, sahifalar takrorlanmasligi) + barcha
avvalgi SQL testlar (565 tekshiruv).

## 3. Ilova (Next.js)

| Muammo | Yechim |
|---|---|
| Brauzerga 4 tilning barcha tarjimalari (≈890 KB JS) ketardi | Faqat joriy til va kerakli bo'limlar (`clientMessages`); admin/huquqiy/bot/CV — serverda |
| Qidiruv sahifasi forma tekshiruv kutubxonasini (zod, 391 KB) yuklardi | Pul formatlash va limitlar zod'siz fayllarga (`post/money.ts`, `jobs/limits.ts`) |
| Telegram SDK har bir foydalanuvchida sahifa "jonlanishini" kutdirardi | Faqat Telegram ichida yuklanadi (gidratsiyadan oldin, avvalgidek); oddiy brauzerda yuklanmaydi |
| Har so'rovda Auth serveriga `getUser()` | `getClaims()` — JWT'ni lokal tekshiradi (quyidagi 6-bo'limga qarang) |
| Ma'lumotnomalar (hudud, kasb, soha) har so'rovda bazadan | `unstable_cache` 1 soat + admin o'zgartirsa darhol yangilanadi (`updateTag("reference")`) |
| Sessiya va o'qilmaganlar ketma-ket | Parallel; kirmagan foydalanuvchi uchun so'rov yo'q |
| AI PRO kartasi butun sahifani kutdirardi | `Suspense` bilan alohida oqim |
| Bosganda javob yo'qdek tuyulardi | Bosilgan zahoti: yuqorida "yuklanmoqda" chizig'i, tugma "prujina"si, ovoz va tebranish |

Har bir sahifadagi JS ≈890 KB kamaydi (bosh sahifa endi ≈1,0 MB, siqilmagan), qidiruv sahifasi yana 391 KB.

`loading.tsx` ataylab qo'yilmadi: u sahifani oqimga aylantiradi va `notFound()` 404 o'rniga 200, server yo'naltirishi
esa brauzer yo'naltirishiga aylanadi (admin panel 404 bilan yashirinishi buziladi). Tezkor javobni `NavProgress`
beradi — u HTTP holatiga ta'sir qilmaydi.

## 4. Infratuzilma

- **Joylashuv:** Vercel `bom1` (Mumbay) va Supabase `ap-south-1` bir hududda — bazaga so'rov 1–2 ms.
- **Ulanishlar:** brauzer va server bazaga PostgREST (Supabase REST) orqali boradi — ulanishlar havzasi (pool)
  Supabase tomonida; serverless funksiyalar to'g'ridan-to'g'ri Postgres ulanishi ochmaydi.
- **Navbatlar:** moderatsiya, mos ishlar va Telegram — har daqiqada `/api/cron/tick` (Supabase `pg_cron`).
  Telegram: bir urinishda 200 tagacha xabar (ijara bilan, ikki marta yuborilmaydi), 429 bo'lsa `retry_after`
  kutiladi, bir foydalanuvchiga bir nechta moslik — bitta jamlangan xabar. Kuniga ~280 ming xabargacha yetadi;
  ko'proq kerak bo'lsa `limit` 500 gacha oshiriladi.
- **Hozirgi Supabase rejasi** eng kichik hisoblash quvvatida (`shared_buffers` 224 MB, `max_connections` 60).
  1 mln ro'yxatdan o'tgan foydalanuvchida kunlik faol foydalanuvchilar o'n minglab bo'lganda Dashboard → Database →
  Reports'dagi CPU/xotira grafiklariga qarab **Small/Medium** hisoblashga o'tish tavsiya etiladi (kod o'zgarmaydi).

## 5. Yangi kod uchun qoidalar

1. Jadvaldan o'qishda doim egasi/ishchi/vakansiya bo'yicha filtr (`.eq("worker_id", …)`, `.in("vacancy_id", …)`).
   RLS faqat xavfsizlik uchun, filtr o'rnini bosmaydi.
2. Katta jadvallarda filtrsiz `count: "exact"` ishlatmang; ro'yxat qidiruvlari — `SECURITY DEFINER` RPC
   (5000 tagacha chegara bilan) orqali.
3. Yangi RLS qoidasida `auth.uid()` o'rniga `(select auth.uid())`, argumentsiz yordamchilar ham `(select f())`.
   Jadval qoidasi o'z jadvaliga ichki so'rov bilan murojaat qilsa — bu jadvalning boshqa qoidalariga ichki so'rov
   qo'shmang (rekursiya xatosi).
4. Brauzer komponentiga og'ir kutubxona (zod va h.k.) import qilmang — kerakli yordamchini alohida faylga ajrating.
5. O'zgarishdan keyin `npm run db:load` bilan o'lchang.

## 6. Egasi qiladigan sozlamalar (ixtiyoriy, tavsiya)

- **JWT kalitlari — tayyor.** Joriy imzo kaliti ECC P-256 (ES256; loyihaning ochiq JWKS'ida tekshirildi), shuning
  uchun `getClaims()` imzoni lokal tekshiradi — har so'rovda Auth serveriga bormaydi. Eski "Legacy HS256" kalit
  "Previously used" bo'limida turibdi: faqat eski tokenlarni tekshirish uchun.
- **Eski kalitni bekor qilish (xavfsizlik, tezlikka ta'siri yo'q).** Legacy HS256 bekor qilinsa, eski `eyJ...`
  (JWT) anon/service_role API kalitlari ham ishlamay qoladi. Shuning uchun tartib bilan:
  1. Supabase → Project Settings → API Keys: `sb_publishable_…` bor; "Secret keys"da yangi `sb_secret_…` yarating.
  2. Vercel → Settings → Environment Variables: `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_…`,
     `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_…` (faqat Vercel'ga), so'ng Redeploy.
  3. Saytni tekshiring: kirish, e'lon joylash, admin panel, Telegram xabarlari (kirish kodlari shu kalitdan hosil
     qilinadi — almashtirish paytida yuborilgan 5 daqiqalik kodlar bekor bo'ladi, qayta so'raladi).
  4. API Keys → Legacy API Keys → "Disable JWT-based API keys".
  5. JWT Keys → "Legacy HS256" qatoridagi ⋮ → Revoke.
- **Hisoblash quvvati:** 4-bo'limga qarang.

## 7. Advisor'da qolganlar (ataylab)

| Ogohlantirish | Nega qoldi |
|---|---|
| `auth_rls_initplan` (14) | Halqali qoidali 8 jadval — 2-bo'lim. Ilova so'rovlari filtrlangan, ta'siri kichik |
| `multiple_permissive_policies` (75) | Qoidalarni birlashtirish — xavfsizlik mantiqini qayta yozish; alohida, testlar bilan qilinadi |
| `unindexed_foreign_keys` (18) | Kichik ma'lumotnoma jadvallariga (hudud, soha, til) — ular deyarli o'chirilmaydi |
| `unused_index` | Bazada hali ma'lumot kam — statistikada ishlatilmagan ko'rinadi |
| `function_search_path_mutable` (4) | Faqat `pg_catalog` funksiyalaridan foydalanadi; `SET search_path` so'rov ichiga joylashni (inlining) o'chirib, qidiruvni sekinlashtiradi |
| `*_security_definer_function_executable` | Ilova chaqiradigan RPC'lar — ichida huquq tekshiriladi; RLS qoidalarida ishlatiladiganlarini yopib bo'lmaydi |
| `rls_enabled_no_policy` (7) | Faqat server (service role) ishlatadigan jadvallar — brauzerdan yopiq bo'lishi kerak |
| `auth_leaked_password_protection` | Parol yo'q (telefon kodi / Telegram) |

## 8. HTTP yuklama testi va sig'im taxmini (2026-11-12)

1–7-bo'limlar bazani o'lchagan edi. Bu bo'lim **ilovani** o'lchaydi: bir vaqtda N ta ulanish asosiy sahifalarga so'rov
yuboradi (`load/http-load.mjs`, autocannon). Tahlil (2026-11-12) talab qilgan "10 / 50 / 100 ming parallel foydalanuvchi"
sinovi prod'da o'tkazilmaydi — pul (Vercel/Supabase) va firewall bloklanishi; staging yo'q. Shuning uchun o'lchov lokal
stendda, 1 mln foydalanuvchilik bazada (§1 seed'i, 150 ming faol vakansiya).

### 8.1. Muhit va cheklovlar (halol)

- Bitta `next start` jarayoni (production build), PostgREST, lokal Postgres — **2 vCPU, yuklama generatori ham shu mashinada**.
  Shuning uchun raqamlar pessimistik: prod'da Vercel har funksiya nusxasiga alohida CPU beradi va nusxalarni o'zi ko'paytiradi.
- Prod'dagidek kesh (`MARKET_CACHE_SECONDS` standart): `bash load/stand-app.sh` stend build'ini prod sozlamalari bilan
  `:3301` da ko'taradi (oddiy stend statistika keshini ataylab o'chiradi — testlar uchun).
- Mehmon (cookie'siz, faqat tanishuv o'tilgan). Kirgan foydalanuvchi sahifalari o'lchanmadi (sessiya bilan alohida oqim).
- Takrorlash: `bash e2e/stack/up.sh` → `psql …/ishuz_e2e -f scripts/load/seed-1m.sql` → `bash load/stand-app.sh` →
  `BASE=http://localhost:3301 CONN=50,200,500 DUR=15 SLUG=<faol slug> OUT=docs/load/http-<sana>.json node load/http-load.mjs`.

### 8.2. Topilgan va tuzatilgan (bitta ulanish, so'rov boshiga)

| Sahifa | Avval | Sabab | Keyin |
|---|---:|---|---:|
| `/` (ish izlovchi, mehmon) | **215 ms** | "Yangi e'lonlar": `simple_search_vacancies` filtrsiz — 150 ming faol qatorni o'qib, `featured_now` hisoblab saralaydi (~200 ms, indeks ishlamaydi) — har mehmon ochilishida | **28 ms** — hudud bo'yicha 60 s kesh (`unstable_cache`, teg `public-feed`); e'lon joylansa/yopilsa `updateTag` darhol yangilaydi |
| `/jobs/<slug>` | **186 ms** | "O'xshash vakansiyalar": `search_vacancies_v2` soha bo'yicha, "relevant" saralash + umumiy son (~150–200 ms) — har sahifada | **30 ms** — soha bo'yicha 60 s kesh, o'sha teg |
| `/kasblar` | 322 ms (keshsiz stend) | `home_market_counts()` — 150 ming faol vakansiyada 390 ms | 27 ms — prod'da allaqachon 10 daqiqa keshda edi; stend sozlamasi chalg'itgan |
| `/jobs` (ro'yxat, filtrsiz) | 76 ms | `search_vacancies_v2` barcha faol bo'yicha sahifalash + umumiy son | o'zgarmadi — keyingi qadam (8.4) |
| `/jobs?q=…`, `/api/professions/search` | 33 / 10 ms | indekslar ishlaydi | — |

Kesh faqat ochiq, foydalanuvchiga bog'liq bo'lmagan ro'yxatlarga qo'yildi; kirgan foydalanuvchining "Sizga mos" ro'yxati
(kasb bo'yicha, indeksli) va saqlangan/ariza belgilari avvalgidek har so'rovda hisoblanadi. `MARKET_CACHE_SECONDS=0` (E2E) —
keshsiz, testlar o'z ma'lumotini darhol ko'radi. Fayllar: `src/features/landing/home-queries.ts`, `src/features/jobs/queries.ts`,
`src/features/find/queries.ts` (`findJobs/findWorkers` — ixtiyoriy mijoz), `src/lib/supabase/public.ts` (`PUBLIC_FEED_TAG`,
`ReadClient`), `src/features/post/actions.ts`, `src/features/vacancies/actions.ts` (`updateTag`).

### 8.3. Parallel yuklama (tuzatishdan keyin, 15 s har biri)

| Sahifa | Ulanish | So'rov/s | p50 | p97.5 | p99 | Xato |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 50 | 40 | 1.2 s | 1.5 s | 1.5 s | 0 |
| `/` | 200 | 28 | 1.1 s | 11.6 s | 13.5 s | 0 |
| `/` | 500 | 32 | 1.2 s | 11.2 s | 13.7 s | 0 |
| `/jobs` | 50 | 16 | 2.0 s | 11.6 s | 13.6 s | 0 |
| `/jobs` | 200 | 17 | 2.0 s | 11.8 s | 13.4 s | 0 |
| `/jobs` | 500 | 8 | 1.6 s | 13.3 s | 14.1 s | 0 |
| `/jobs?q=shifokor` | 50 | 22 | 1.5 s | 10.5 s | 13.5 s | 0 |
| `/jobs?q=shifokor` | 200 | 20 | 1.5 s | 11.6 s | 13.1 s | 0 |
| `/jobs?q=shifokor` | 500 | 11 | 1.4 s | 12.8 s | 14.5 s | 0 |
| `/jobs?q=sotuvchi&region=tashkent_city` | 50 | 20 | 2.4 s | 2.7 s | 3.2 s | 0 |
| `/jobs?q=sotuvchi&region=tashkent_city` | 200 | 20 | 1.6 s | 10.6 s | 12.8 s | 0 |
| `/jobs?q=sotuvchi&region=tashkent_city` | 500 | 10 | 1.2 s | 13.4 s | 14.0 s | 0 |
| `/jobs/<slug>` | 50 | 25 | 1.6 s | 3.4 s | 3.8 s | 0 |
| `/jobs/<slug>` | 200 | 26 | 1.8 s | 11.3 s | 13.5 s | 0 |
| `/jobs/<slug>` | 500 | 18 | 1.6 s | 13.3 s | 14.5 s | 0 |
| `/api/professions/search?q=shif` | 50 | 199 | 241 ms | 320 ms | 342 ms | 0 |
| `/api/professions/search?q=shif` | 200 | 191 | 392 ms | 1.7 s | 8.1 s | 0 |
| `/api/professions/search?q=shif` | 500 | 194 | 391 ms | 2.3 s | 8.2 s | 0 |
| `/kasblar` | 50 | 27 | 1.8 s | 2.1 s | 2.1 s | 0 |
| `/kasblar` | 200 | 26 | 1.4 s | 10.7 s | 13.4 s | 0 |
| `/kasblar` | 500 | 18 | 1.3 s | 12.6 s | 14.1 s | 0 |
| `/api/health` | 50 | 328 | 145 ms | 217 ms | 225 ms | 0 |
| `/api/health` | 200 | 300 | 303 ms | 567 ms | 6.6 s | 0 |
| `/api/health` | 500 | 270 | 280 ms | 1.1 s | 7.4 s | 0 |

Xom natija: `docs/load/http-2026-11-12.json`. O'qish:
- **Xato, timeout, 2xx bo'lmagan javob — 0** (500 ulanishda ham). Ilova yiqilmaydi, navbatga qo'yadi.
- Bitta Node jarayoni (2 vCPU, generator bilan birga) **~30–40 sahifa/s** yoki **~200 API javob/s** beradi; undan ortig'i
  navbatda kutadi (p97.5 10 s+). Bu bitta nusxaning chegarasi, saytning emas.
- Sahifa chizish (React SSR, 300–480 KB HTML) — asosiy CPU xarajati. `/jobs` ro'yxati eng og'iri (DB 70 ms + chizish).

### 8.4. "100 ming bir vaqtda" uchun nima kerak (taxmin, kafolat emas)

Hisob: 1 mln ro'yxatdan o'tgan ≠ 1 mln bir vaqtda. Ish e'lonlari saytlarida kunlik faol foydalanuvchi ro'yxatning 3–8 %,
bir vaqtda — kunlikning 3–5 %, har biri ~30 s da bir sahifa. 1 mln ro'yxat → ~50 ming kunlik → **~2 ming bir vaqtda →
~70 sahifa/s** (tepalikda 2–3 baravar). 100 ming bir vaqtda = ~3 300 sahifa/s — bu O'zbekiston miqyosida butun bozor
bir onda kirgani; unga **arxitektura** bilan tayyorlanadi, kod bilan emas:

| Qadam | Nima beradi | Kim |
|---|---|---|
| Supabase compute Small → Medium/Large, pooler (transaction mode) | Baza CPU va ulanishlar — hozirgi asosiy chegara. Ilova so'rovlari 1–17 ms; 70 sahifa/s ≈ 1 baza yadrosi; 3 300/s ≈ 30–50 yadro (yoki o'qish replikasi + kesh) | ega (tarif) |
| Mehmon sahifalarini CDN'da keshlash (`/`, `/jobs?…` birinchi sahifa, `/kasblar`, `/company/*`) — `s-maxage=60, stale-while-revalidate` | Mehmon trafigi (SEO, reklama) bazaga umuman bormaydi; hozir `private, no-store` (sessiya cookie tufayli) — mehmon/kirgan ajratish kerak | kod (keyingi bosqich) |
| `search_vacancies_v2/v3`, `simple_search_vacancies`: filtrsiz tarmoqni indeks tartibida ikkiga bo'lish (featured / oddiy), umumiy sonni 5000+ da to'xtatish | `/jobs` ro'yxati 70 ms → ~5 ms 150 ming faol vakansiyada | kod (migratsiya 0076, parity testlari bilan) |
| Staging (alohida Supabase loyiha + Vercel preview) | Shu testni haqiqiy infratuzilmada 1 000 → 10 000 ulanishda o'tkazish | ega |
| Vercel Pro (Hobby'da funksiya parallelligi va kunlik limit cheklangan) | Nusxalar soni va 60 s funksiya vaqti | ega (tarif) |

Bugungi holat uchun xulosa: haqiqiy ma'lumot hajmi (yuzlab vakansiya) va kutilayotgan trafik (ming kunlik) uchun **hozirgi
tarif yetadi**; birinchi o'sish belgisi — `/api/health` dagi `db.ms` ning doimiy 300 ms+ bo'lishi va Supabase panelidagi CPU 60 %+.
