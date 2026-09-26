# Matching — moslik dvigateli

`public.compute_match(worker_id, vacancy_id)` (SQL) ning sof TypeScript nusxasi + almashtiriladigan `MatchEngine` interfeysi.
SQL ro'yxatlarni saralash/kesh (`matches`, `search_*`, `recommended_*`) uchun, TS esa UI tushuntirishlari, testlar va kelajakdagi
AI dvigatel uchun ishlatiladi. Ikkalasi **bir xil natija** beradi — buni paritet testi kafolatlaydi.

## Foydalanish

```ts
import { computeMatch, matchTone, summarizeReasons } from "@/features/matching";
import type { WorkerMatchInput, VacancyMatchInput } from "@/features/matching";

const result = computeMatch(worker, vacancy);          // { score: 0..100, reasons: MatchReason[] }
matchTone(result.score);                                // 'high' (≥75) | 'medium' (≥50) | 'low'
summarizeReasons(result.reasons);                       // { positives, warnings, negatives }
result.reasons.map((r) => t(`enums.match_reason.${r.key}`, r)); // i18n: params = r.km, r.matched, r.lang ...
```

Kirish tiplari (`types.ts`) DB jadvallariga mos: `WorkerMatchInput` = worker_profiles + profiles.birth_date + worker_preferences +
worker_skills + worker_languages + worker_education + worker_geo + worker_locations; `VacancyMatchInput` = vacancies + vacancy_skills
(hammasi, `is_required` dan qat'i nazar — SQL `count(*)` shunday) + vacancy_languages (`language_code` tartibida bering).

Sabab parametrlari SQL bilan bir xil: `km` (1 kasr yoki `null`), `matched`/`required`, `required_months`, `vacancy_max`/`worker_min`,
`vacancy_schedule`, `vacancy_type`, `vacancy_format`, `lang`/`level`, `level`, `min`/`max`. `null` qiymatlar saqlanadi
(`jsonb_build_object` kabi).

## Og'irliklar va darajalar

| Blok | Ball | Darajalar |
|---|---|---|
| Kategoriya | 25 | to'liq 25 · subkategoriya farq qilsa 18 (warn) · mos emas 0 |
| Joylashuv | 15 | masofaviy 15 · tuman (o'zi yoki worker_locations) 15 · ≤5 km 15 · ≤15 km 10 (warn) · viloyat 8 (warn) · uzoq 0 |
| Maosh | 15 | nomzod ko'rsatmagan 10 (warn) · kelishiladi/ko'rsatilmagan 8 (warn) · ≥ kutilgan 15 · ≥ minimum 12 · past 0 |
| Tajriba | 10 | yetarli 10 · 6 oygacha kam 5 (warn) · kam 0 |
| Ko'nikma | 15 | talab yo'q 15 · `round(15·matched/required)` |
| Grafik | 10 | mos / istak yo'q / `negotiable` 10 · `flexible` yoki vakansiya flexible/negotiable 5 (warn) · 0 |
| Bandlik + rasmiylik | 3 + 2 | tur mos 3 · format mos yoki `any` 2 |
| Til | 5 | talab yo'q 5 · `round(5·matched/total)`; yetishmagan har til uchun `language_required` |
| Ogohlantirish | 0 | `education_required`, `age_out_of_range` — ballga ta'sir qilmaydi |

Yaxlitlash Postgres `round(numeric)` kabi: 0.5 noldan uzoqqa (`roundNumeric`), `Math.round` emas. Yosh `extract(year from age())`
kabi UTC bo'yicha (`ageFromBirthDate(birthDate, now)`). Natija 0..100 ga qisiladi.

## Dvigatelni almashtirish

```ts
import { createMatchEngine } from "@/features/matching";
const engine = createMatchEngine();          // hozircha faqat 'rule_based'
engine.compute(worker, vacancy);
```

Yangi (masalan AI) dvigatel: `MatchEngineKind` ga qiymat qo'shing, `MatchEngine` ni amalga oshiring (`name`, `compute`) va
`createMatchEngine` switch'iga tarmoq qo'shing. Natija baribir `MatchResult` (0..100 + `MatchReason[]`) bo'lishi shart — UI va i18n
kalitlari (`enums.match_reason.<key>`) shunga bog'langan. SQL tomonidagi saralash `matches` keshini yangi natija bilan to'ldirish
orqali almashtiriladi.

## DB va TS qanday sinxron turadi

* `engine.ts` har bir blokda SQL'ning tegishli bo'limini izohda takrorlaydi. `compute_match` yoki `experience_level_months`,
  `education_rank`, `language_level_rank`, `distance_km` o'zgarsa — `engine.ts` ham o'zgaradi.
* `engine.parity.test.ts` haqiqiy Postgres'ga ulanadi (`DATABASE_URL` yoki `postgres://postgres:postgres@127.0.0.1:5432/ishuz_dev`),
  bitta tranzaksiyada 2 ta ishchi (to'liq va bo'sh profil) + 5 ta vakansiya yaratadi, har juftlik uchun `public.compute_match` ni
  chaqiradi va TS natijasi bilan **ball ham, sabablar ham** (deep-equal, tartib bilan) bir xil ekanini tekshiradi, so'ng ROLLBACK.
  Yordamchi funksiyalar ham enum bo'yicha solishtiriladi.
* Baza ulanmasa suite skip bo'ladi. Baza migratsiya fayllaridan **orqada** bo'lsa (tegishli funksiyalar tanasi
  `supabase/migrations` dagi bilan mos kelmasa) ham skip bo'ladi va ogohlantirish chiqaradi — `npm run db:local` bilan yangilang.
  Baza yangi bo'lib, TS orqada qolsa — test **yiqiladi**; bu kutilgan signal.

## Testlar

```
npx vitest run src/features/matching        # unit + parity
DATABASE_URL=postgres://... npx vitest run src/features/matching/engine.parity.test.ts
```
