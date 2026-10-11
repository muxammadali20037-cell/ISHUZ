# Professionallashtirish — ish jurnali

Manba: `ISHUZ_Professional_Audit_va_Prompt_2026-10-11_1.md` (audit tayanch commiti `506473a`).
To'liq natija va dalillar: [PROFESSIONALIZATION_REPORT.md](PROFESSIONALIZATION_REPORT.md). Bu fayl — keyingi sessiya qayerdan
davom etishini ko'rsatadigan qisqa holat. Bir xil auditni qaytadan boshlamang.

Oxirgi yangilanish: 2026-10-11 · branch `claude/gallant-thompson-q70fo3` (main bilan bir xil, fast-forward).

## Bosqichlar

| Bosqich | Holat | Commit |
|---|---|---|
| A — boshlang'ich dalil | ✅ bajarildi (stack, route'lar, forma maydonlari solishtirildi; baseline testlar; production read-only holati) | — |
| B1 — qoralamalar (F-03) | ✅ | `5e686ae`, `5abef32` (handoff tuzatishi) |
| B2 — qidiruv xato/bo'sh (F-04) | ✅ | `8366626` |
| B3 — katalogda yo'q kasb (F-05) | ✅ kod · ⏳ production'da 0057 kutilmoqda | `ffe7556` |
| B4 — ishonchli upload (F-06) | ✅ vakansiya rasmi · ⏳ 0058 · avatar/logo — ochiq | `1236594` |
| B5 — zaxira (F-01) va 0056 (F-02) | ✅ kod/workflow · ⏳ sirlar va 0056 egasi tomonidan | `8bb81da` |
| C — UX/a11y | ✅ o'lchangan tuzatishlar (kontrast, nishon o'lchami, planshet sarlavhasi, tez birinchi chizish) | shu sessiya oxirgi commit |
| D — o'lchov | ✅ lab o'lchovi · ❌ staging yuklama testi va field web-vitals — NOT_RUN | — |
| E — E2E + CI | ✅ 24 spec CI'da (izolyatsiyalangan stend) | `5abef32` va keyingilar |

## Keyingi sessiya uchun

1. Egasi: SQL Editor'da 0056 → 0057 → 0058 (SECURITY_RUNBOOK §9, §9.1), keyin `select public.simple_listing_features()`.
2. Egasi: GitHub Secrets `SUPABASE_DB_URL`, `BACKUP_AGE_RECIPIENT`; Actions → "DB backup" → Run workflow; manifest'ni tekshirish.
3. Ochiq: avatar va kompaniya logotipi uchun ham karantin + qayta kodlash (F-06 qolgan qismi).
4. Ochiq: TS matching dvigatelini SQL v2 ga ko'chirish yoki olib tashlash (paritet suite — 18 skip; sababi hisobotda).
5. Ochiq: staging'da aralash HTTP yuklama testi (F-09) va real qurilmada web-vitals.
6. Ochiq: login (Telegram kod) — kechikish/qayta yuborish/offline holatlari uchun E2E (haqiqiy bot kerak — BLOCKED).

## Qanday tekshiriladi

```bash
npm run lint && npm run typecheck && npm test           # unit
bash scripts/db-test.sh                                  # SQL (lokal PostgreSQL, toza baza)
bash e2e/stack/up.sh && npx playwright test -c e2e       # brauzer E2E (lokal stend)
node e2e/perf/lab.mjs 3                                  # lab tezlik o'lchovi → e2e/.stack/perf.json
node e2e/screens/capture.mjs http://localhost:3300 after # ekranlar → docs/screenshots/
```
