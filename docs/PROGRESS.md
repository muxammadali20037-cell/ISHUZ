# Jarayon (PROGRESS)

Har bir bosqichdan keyin yangilanadi. Reja — `docs/IMPLEMENTATION_PLAN.md`.

| Bosqich | Holat | Sana |
| --- | --- | --- |
| Barqarorlashtirish (Next 16.4.5, 0074–0075, health, Sentry) | Kod tayyor, CI yashil · **ega amali kutilmoqda** | 2026-11-07 |
| 0. Audit | ✅ Tugadi | 2026-11-11 |
| 1. Dizayn tizimi | Navbatda | |
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
