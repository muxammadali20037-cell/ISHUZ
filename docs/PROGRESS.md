# Jarayon (PROGRESS)

Har bir bosqichdan keyin yangilanadi. Reja — `docs/IMPLEMENTATION_PLAN.md`.

| Bosqich | Holat | Sana |
| --- | --- | --- |
| Barqarorlashtirish (Next 16.4.5, 0074–0075, health, Sentry) | Kod tayyor, CI yashil · **ega amali kutilmoqda** | 2026-11-07 |
| 0. Audit | ✅ Tugadi | 2026-11-11 |
| 1. Dizayn tizimi | Davom etmoqda: 1-qadam (tokenlar) ✅ | 2026-11-11 |
| 2. Ochiq sayt | — | |
| 3. Kirish va onboarding | — | |
| 4. Ish izlovchi | — | |
| 5. Ish beruvchi | — | |
| 6. Admin | — | |
| 7. Backend integratsiyasi | — | |
| 8. AI | — | |
| 9. QA va prod | — | |

## 0-bosqich — Audit (2026-11-11)

**Bajarildi:** repo, marshrutlar, baza katalogi, navigatsiya, testlar va yangi talablar solishtirildi.

**Yaratilgan fayllar:**
- `docs/PROJECT_AUDIT.md`, `docs/PRODUCT_ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/IMPLEMENTATION_PLAN.md`
- `docs/ROUTES_MAP.md`, `docs/DATABASE_SCHEMA.md` — `scripts/gen-docs.py` yaratadi (qayta yaratish:
  `DB=postgres://postgres:postgres@127.0.0.1:5432/ishuz_test python3 scripts/gen-docs.py .`)
- `docs/PROGRESS.md`, `docs/TEST_REPORT.md`

**O'zgartirilgan fayllar:** yo'q (ilova kodi tegilmadi).

**Testlar:** kod o'zgarmagani uchun yangi test yo'q; oxirgi to'liq natija — `docs/TEST_REPORT.md`.

**Qolgan muammolar:** prod baza 0069–0075 siz; prod'da real vakansiya yo'q; takroriy oqimlar (qidiruv, vakansiya yaratish,
saqlash); SMS provayder yo'q.

**Keyingi aniq vazifa:** 1-bosqich — `src/app/globals.css` dagi rang tokenlarini `docs/DESIGN_SYSTEM.md` §2 bo'yicha
almashtirish va kontrast testini yozish.

## 1-bosqich, 1-qadam — Rang, shrift, radius tokenlari (2026-11-11)

**Bajarildi:**
- Yangi palitra: Midnight Navy `#101D35`, Professional Blue `#276FE5`, Cloud `#F4F6FA`, matn `#172033`, chegara `#E5EAF0`,
  Success `#16A378` (belgi) / `#0E7A5A` (matn). AA dan o'tmagan juftliklar uchun to'q variantlar (`docs/DESIGN_SYSTEM.md` §2).
- Ko'k matn uchun yangi token `--primary-ink` (`#1F5FCC`): barcha `text-primary` (394 joy, 179 fayl) `text-primary-ink` ga
  almashtirildi; qo'riqchi test endi oddiy `text-primary` ni taqiqlaydi.
- Bitta shrift: Inter Variable (Geist olib tashlandi, `geist` paketi o'chirildi).
- Radius shkalasi: tugma/maydon 10 px, karta 12 px, panel 16 px.
- Qolgan eski hex: `global-error.tsx`, `manifest.webmanifest`.

**O'zgartirilgan fayllar:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/global-error.tsx`,
`public/manifest.webmanifest`, `src/components/shared/brand-logo.tsx`, `package.json`, `src/lib/brand-contrast.test.ts`,
`src/lib/brand-guard.test.ts`, `e2e/specs/telegram-fullscreen.spec.ts`, va 179 ta komponent fayli (faqat klass nomi).

**Testlar:** Vitest 712 o'tdi (18 skip — eskirgan TS moslash, ma'lum); kontrast testi yorug' va qorong'i mavzuda
(matn ≥ 4.5:1, UI elementlar ≥ 3:1); typecheck, lint (0 xato); E2E 235/236 — yiqilgan bitta test eski fon rangini kutardi,
yangilandi va o'tdi.

**Qolgan muammo:** mobilda hamburger va pastki menyu birga chiqadi (talab: bittasi) — qobiqlar qadamida.

**Keyingi aniq vazifa:** 1-bosqich, 2-qadam — `src/components/ui` komponentlarini spetsifikatsiyaga keltirish
(tugma balandliklari 44/36/52, karta, input) va yangi komponentlar: status-badge, empty-state, alert, table, drawer.
