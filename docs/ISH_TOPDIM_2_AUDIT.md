# ISH TOPDIM 2.0 — audit (2026-11-22)

Egasining ustuvor talablari (shu tartibda):

1. **Qidiruv sifati.** "ish kerak", "voditel", "oshpaz", "работа" yozilsa ham mazmunan mos natija chiqishi kerak.
2. **Matnlar.** 320px dan 1920px gacha hech qanday matn boshqa element ustiga chiqmasligi kerak.
3. **Haqiqiylik.** Mavjud bo'lmagan ish o'rni, soxta kompaniya va sun'iy statistika ko'rsatilmasligi kerak.
4. **Ma'lumotlar.** Supabase'dagi mavjud foydalanuvchilar va e'lonlar saqlanishi kerak.
5. **Tekshiruv.** Har o'zgarishdan keyin build, test va vizual tekshiruv bajarilishi kerak.

Ish tartibi: alohida branch (`feat/ish-topdim-2`), backup va migratsiya holati avval tekshiriladi, o'zgarishlar
bosqichma-bosqich, PR orqali. Egasi ko'rib chiqmaguncha prod o'zgarmaydi.

"Master prompt"dagi boshqa bandlar bu bosqichga kiritilmadi. Ular egasining yaqindagi tanlovlariga zid keladi (pastda, §7).

---

## 0. Boshlang'ich holat (faqat o'qib tekshirildi)

| Narsa | Holat | Qanday tekshirildi |
|---|---|---|
| Prod migratsiyalari | 0068…0088 hammasi bor; kutib turgan migratsiya yo'q | `scripts/prod-migration-check.sql` so'rovi prod'da (SELECT) |
| Prod ma'lumotlari | 9 profil, 52 vakansiya (25 faol), 16 ishchi e'loni (11 ochiq), 11 ariza, 5 kompaniya, 152 namuna vakansiya | `count(*)` so'rovlari |
| Faol vakansiyalarning kategoriyasi | 25/25 da bor (soha bo'yicha qidiruv uchun muhim) | `category_id is null` soni = 0 |
| **Backup** | ⚠️ **Yo'q.** Supabase tashkiloti **Free** tarifda | `get_organization` → `plan: free` |
| Supabase maslahatlari | Pastda, §6 | `get_advisors` (security, performance) |

**Backup bo'yicha.** Supabase hujjatiga ko'ra kunlik avtomatik zaxira faqat Pro, Team va Enterprise tariflarida bor.
Bepul tarifda ma'lumotni muntazam `supabase db dump` bilan o'zi saqlab borish tavsiya etiladi.

Bu bosqichdagi o'zgarishlar **bazani o'zgartirmaydi**: migratsiya yo'q, ma'lumot yozilmaydi.

Keyinchalik bazaga biror narsa kiritishdan oldin egasi zaxira nusxa olishi kerak. Ikki yo'l bor: CLI bilan
`supabase db dump`, yoki muhim jadvallarni Table Editor → Export CSV orqali yuklab olish.

---

## 1. Qidiruv

### 1.1 Qanday tekshirildi

- **Benchmark:** `scripts/search-bench/`.
  - Lokal e2e stend bazasiga 1224 ta namunaviy vakansiya yoziladi. Ular 300 ta kasbdan, turli viloyatlardan, nomlari
    o'zbekcha va ruscha aralash. Seed boshqa bazada ishlamaydi: `current_database()` tekshiruvi bor.
  - 85 ta so'rov sinaldi: egasining 4 ta misoli, lotin/kirill/rus yozuvi, imlo xatolari, gaplar, prod jurnalidagi
    haqiqiy so'rovlar.
  - Har so'rovda haqiqiy server kodi ishlaydi: `resolveFindQuery`, `familyOf`, `findJobs*`.
- **Chatni ko'z bilan tekshirish:** mehmon sifatida bosh sahifadagi chatda shu so'rovlar yozildi va har qadamda
  skrinshot olindi.
- **Prod jurnali:** `search_logs` (171 yozuv) — faqat so'rov matnlari va natija soni. Raqamli so'rovlar
  chiqarilmadi.

### 1.2 Topilgan muammolar

| # | Muammo | Sabab | Fayl | Foydalanuvchiga ta'siri | Tuzatish | Ustuvorlik |
|---|---|---|---|---|---|---|
| Q1 | "ish kerak", "работа", "ish bormi" yozilsa natija chiqmaydi | Chat "Kasbingiz qanday?" deb so'raydi, lekin "hammasi" varianti yo'q. "hammasi" deb yozilsa, shu so'z bo'yicha qidiradi va hech narsa topmaydi | `start-chat/guided-logic.ts` (`nextAsk`), `chat-pickers.tsx` | Eng ko'p yoziladigan so'rov boshi berk ko'chaga kirib qoladi | Ro'yxat boshida **"Hamma ishlar"** / **"Hamma ishchilar"** tugmasi. "farqi yo'q", "hammasi", "любая", "все" deb yozish ham shu ma'noda tushuniladi (`isAnyProfession`) | Yuqori |
| Q2 | "kuryer" → faqat "Piyoda kuryer" | "kuryer" sinonimi faqat shu kasbda. Posilka, oziq-ovqat, moto va avto kuryerlari daraxtda alohida kasblar | `profession_nodes.aliases` (ma'lumot), `find/quick-core.ts` | Benchmarkda kuryer e'lonlari bor bo'lsa ham "topilmadi" chiqdi | **Butun soha** so'zlari (`find/families.ts`: kuryer/доставка, IT/айти, call-markaz) → kategoriyaning hamma vakansiyalari (`findJobsInCategory`) | Yuqori |
| Q3 | Aniq kasbda e'lon yo'q bo'lsa, shu kasbga tegishli boshqa e'lonlar ko'rinmaydi | Fallback faqat ota-kasb va "boshqa viloyat" bo'yicha | `find/quick-core.ts` | "topilmadi" ko'p chiqadi | Yozilgan va **shu kasbning nomi/sinonimiga tegishli** so'z e'lon nomlarida qidiriladi ("Shunga yaqin ishlar"). Aloqasiz so'z olinmaydi (`wordsRelatedTo`) | O'rta |
| Q4 | Hech narsa yo'q bo'lsa, foydalanuvchiga boshqa qidiruv taklif qilinmaydi | — | `start-chat.tsx` | Prod'da 25 ta faol vakansiya bor, ko'p qidiruv bo'sh chiqadi | **"Hozir shu kasblarda ish bor:"** — haqiqiy, sanalgan e'lonlari bor kasblar (soni bilan). Bir bosishda butun O'zbekiston bo'yicha qidiradi | O'rta |
| Q5 | "manual qa" → "Manual terapevt" | 3 harfdan qisqa so'zlar ("qa", "hr", "ux", "it") tashlab yuborilardi | `find/intent.ts` | Noto'g'ri kasb chiqadi | Qisqa kasb so'zlari ro'yxati (`SHORT_TERMS`) | O'rta |
| Q6 | "grushik" tushunilmaydi | "грузчик"ning xalq yozuvi; imlo tuzatish 7 harfli so'zda faqat 1 xatoga ruxsat beradi | `find/intent.ts` | Natija yo'q | `SLANG` lug'ati (grushik → gruzchik) | Past |
| Q7 | "vakansiya" kalit so'z deb olinardi | Matn qidiruvi to'xtatish so'zlarida yo'q edi | `find/ai-keywords.ts` | Tavsifida "vakansiya" so'zi bor hamma e'lonlar chiqadi | To'xtatish so'zlariga qo'shildi | Past |
| Q8 | "baliqchi" kasb emas, hudud deb tushuniladi | Andijondagi Baliqchi tumani | `search/understand.ts` | Baliqchi tumanidagi ishlar chiqadi | **O'zgartirilmadi.** Ikki ma'no ham to'g'ri. Hujjatlashtirildi | Past |
| Q9 | "o'qituvchi matimatika" → "O'qituvchi" guruhi | Ikkinchi so'zdagi imlo xatosi tuzatilmaydi | `find/queries.ts` | Natija baribir o'qituvchilar, faqat aniq emas | **Qoldi** (keyingi bosqich) | Past |

### 1.3 Allaqachon yaxshi ishlayotgan narsalar (o'zgartirilmadi)

- **Kasblar daraxti:** 1876 ta tanlanadigan kasb, lotin/rus/ingliz nomlari va sinonimlari bilan. Kirill → lotin
  o'girish bor (`normalizeText`, bazada `uz_fold`).
- **Imlo xatosi:** tahrir masofasi bilan tuzatiladi ("oshpz", "haydochi", "kasir", "elektirk", "santexnk").
- **Kasb bo'yicha qidiruv shu kasbning ichidagi kasblarni ham oladi:** "Oshpaz" → "Sovuq taomlar oshpazi",
  "Parhez taomlar oshpazi" (`profession_subtree`).
- **Saralash:** TOP (belgisi bilan) → aniq tuman → eng yangi. Natijalar sun'iy ko'tarilmaydi. Pullik TOP doim
  "TOP" belgisi bilan ko'rsatiladi.
- **Benchmark (o'zgarishlardan keyin):** 85 so'rovdan 81 tasida kutilgan kasb yoki soha topildi. 4 tasi:
  "baliqchi" (Q8); "o'qituvchi matimatika" (Q9); "it" va "IT" — natijalar IT e'lonlari, lekin tekshiruvning
  andozasi tor edi, u tuzatildi. Tezlik: p50 ≈ 40 ms, p95 ≈ 150 ms (lokal).

---

## 2. Matnlar ustma-ust chiqmasligi (320–1920px)

Mavjud vosita: `e2e/overlap.ts` (`findLayoutIssues`). U quyidagilarni topadi:

- yozuv boshqa element ostida qolgani;
- ikki yozuv kesishgani;
- belgi yozuv ustiga tushgani;
- yozuv ekran chetidan chiqqani;
- "…"siz qirqilgani.

Ikki ishlatilish joyi bor:

- **CI:** `e2e/specs/layout-overlap.spec.ts` (320 uz, 390 ru katta shrift, 1440 uz).
- **Keng audit:** `e2e/screens/overlap.audit.ts` (CI'da emas).

Keng audit shu bosqichda kengaytirildi:

- **Kengliklar:** 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440, 1920.
- **Tillar va shrift:** uz/ru/oz, katta shrift (1.15–1.3×).
- **Yangi sahifalar:** chat natijalari, "Kasbingiz qanday?", tariflar, namunalar, ustalar, kompaniyalar.
- `/ai-alerts` olib tashlandi: u endi Profilga yo'naltiradi.

Natija — §2.1 (audit tugagach to'ldiriladi).

### 2.1 Natija

Tekshiruv hajmi: 31 sahifa/holat × 14 sozlama = **434 tekshiruv** (16,5 daqiqa). **3 ta muammo topildi.** Uchalasi ham
390px, ruscha, katta shrift (1.25×) sozlamasida chiqdi:

| # | Sahifa | Muammo | Sabab | Fayl | Tuzatish |
|---|---|---|---|---|---|
| M1 | Profil (ish izlovchi) | Telefon raqami "Ismni o'zgartirish" tugmasi ostida qoladi | Tugma alohida ustun bo'lib, matn ustunini toraytirardi. Raqam bo'linmaydi (`nowrap`, to'g'ri) | `cabinet/components/cabinet-page.tsx` | Tugma kartaning burchagida (`absolute`). Matn ustuni butun kenglikda, faqat ism tugmaga joy qoldiradi. Uzun ism endi "…" bilan kesilmaydi, keyingi qatorga o'tadi |
| M2 | Profil (ish beruvchi) | Xuddi shu | Xuddi shu | Xuddi shu | Xuddi shu |
| M3 | Tariflar | Narx ("Бесплатно", "6 000 сум") pastki qatorga tegib ketadi | `text-3xl` qator balandligi (1.2) shriftning harf balandligidan kichik | `app/pricing/page.tsx` | `leading-snug` |

Tuzatishdan keyin shu 3 sahifa 14 sozlamaning hammasida qayta tekshirildi: **0 muammo**.

Boshqa sahifalarda (bosh sahifa, chat natijalari, "Kasbingiz qanday?", qidiruv, vakansiya, ishchi e'loni, arizalar,
saqlanganlar, bildirishnomalar, e'lon berish, ish beruvchi sahifalari, yordam, talabalar, namunalar, ustalar,
kompaniyalar) 320…1920 oralig'ida muammo topilmadi.

CI'dagi `layout-overlap.spec.ts` ga 768 (planshet) va 1920 (katta monitor) qo'shildi.

---

## 3. Haqiqiylik (soxta ma'lumot yo'qligi)

| Tekshiruv | Natija |
|---|---|
| Koddagi va matnlardagi qo'lda yozilgan raqamlar ("10 000+", "98%") | Yo'q. Faqat bildirishnoma hisoblagichida "99+" bor |
| Bosh sahifa va bo'lim sonlari | Bazadan sanaladi (0067 `home_market_counts`) |
| Namuna vakansiyalar (152 ta) | Har joyda **"Namuna"** belgisi va "haqiqiy ish emas" izohi bor. Ariza yuborib bo'lmaydi. Haqiqiy e'lon paydo bo'lganda ko'rsatilmaydi |
| Sharh va reyting | Faqat haqiqiy foydalanuvchilarniki ("Hali sharh yo'q" holati bor) |
| AI rasm | Ish joyi surati alohida belgilanadi. AI rasm portretsiz |
| Yangi "Hozir shu kasblarda ish bor" takliflari | Faqat RLS bo'yicha ochiq faol vakansiyalar sanaladi (soni ko'rsatiladi) |

**Topilgan muhim xato (qidiruv benchmarkida):**

| # | Muammo | Sabab | Fayl | Ta'siri | Tuzatish | Ustuvorlik |
|---|---|---|---|---|---|---|
| H1 | **"Sex boshlig'i"** (katalogdagi kasb, o'zbekcha "sex" = "цех") e'loni avtomatik yashiriladi va **egasi bloklanadi** | Moderatsiya qoidasida (`strict_erotic`) yalang'och "sex" so'zi bor edi | `moderation/rules.ts` | Halol ish beruvchi bloklanadi. "Tikuv sexiga tikuvchi kerak" kabi ko'p uchraydigan e'lonlar ham. Prod'da hozircha bunday e'lon yo'q (tekshirildi) | Yalang'och "sex" qoidadan olindi. "seks", "sexy", "sexual", "seksual" qoldi. 5 ta toza va 2 ta bloklanadigan test qo'shildi | **Yuqori** |

---

## 4. Ma'lumotlar xavfsizligi

- Shu bosqichda **migratsiya yo'q**, prod'ga hech narsa yozilmadi. Prod'ga faqat o'qiydigan so'rovlar yuborildi.
- Benchmark ma'lumoti faqat lokal stendda. Seed boshqa bazada xato bilan to'xtaydi.
- Yangi server amali (`chatProfessionsWithListings`) faqat ochiq qatorlarni o'qiydi: anon kalit va RLS bilan,
  10 daqiqa keshda. Shaxsiy ma'lumot qaytarmaydi.
- `quickSearch` sxemasiga ikki ixtiyoriy maydon qo'shildi:
  - `category` — enum bilan cheklangan;
  - `query` — 600 belgigacha.

  Matn serverda saqlanmaydi (avvalgidek).

---

## 5. Testlar

Har o'zgarishdan keyin bajarildi: `tsc`, `eslint`, `vitest`, stendni qayta qurish, e2e va skrinshot. Batafsil —
yakuniy hisobotda (`docs/ISH_TOPDIM_2_FINAL_REPORT.md`).

---

## 6. Xavfsizlik va tezlik bo'yicha Supabase maslahatlari (prod, o'zgartirilmadi)

| Maslahat | Soni | Izoh |
|---|---|---|
| `rls_enabled_no_policy` | 11 | `login_codes`, `rate_limits`, `telegram_*` va hokazo. RLS yoqilgan, siyosat yo'q, ya'ni anon va authenticated uchun **yopiq**. Server service role bilan ishlaydi. Xavfsiz, ataylab shunday |
| `function_search_path_mutable` | 5 | `moderation_internal`, `normalize_search_text`, `payme_error`, `profession_relation`, `trg_master_listing_touch` — `set search_path` qo'shish kerak (keyingi migratsiya) |
| `*_security_definer_function_executable` | 50 / 162 | Arxitektura shunday: RPC funksiyalar SECURITY DEFINER, ichida egalik tekshiruvi bor. RLS testlari CI'da (`SQL migrations + RLS tests`) |
| `auth_leaked_password_protection` | 1 | Supabase Dashboard → Auth → "Leaked password protection" ni yoqish (egasi, 1 bosish) |
| `auth_rls_initplan` | 18 | Tezlik: siyosatlarda `auth.uid()` → `(select auth.uid())`. Ma'lumot kam, hozir sezilmaydi (keyingi migratsiya) |
| `unindexed_foreign_keys` / `unused_index` | 29 / 57 | Hozirgi hajmda ta'siri yo'q |

---

## 7. Bu bosqichga kiritilmagan bandlar (egasining tanlovlariga zid)

- **Bosh sahifani "Ishingiz shu yerdan boshlanadi!" va 3 tugma qilish.** 2026-11-21 dan bosh sahifa — chat (ega).
- **Mobil menyu 5 ta tugma** (Bosh sahifa, Qidiruv, E'lon berish, Xabarlar, Profil). Hozir 3 ta: Qidiruv,
  E'lonlarim, Profil (ega, 2026-11-21).
- **"Moslik algoritmi" va "AI mos nomzod tavsiyasi".** 2026-11-22 da ega moslikni hamma joydan olib tashlatdi.
  Qidiruvdagi ichki saralash (`compute_match` — yangi e'lonlar orasida) ko'rinmaydi va o'zgartirilmadi.
- **Yangi rang palitrasi** (#2457F5 va boshqalar). Brend tokenlari `globals.css` da bor, raw hex brend qo'riqchisi
  tomonidan taqiqlangan.

Bularni egasi alohida tasdiqlasa — alohida bosqichda.
