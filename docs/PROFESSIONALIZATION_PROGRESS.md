# Professionallashtirish — ish jurnali

Manba: `ISHUZ_Professional_Audit_va_Prompt_2026-10-11_1.md` (audit tayanch commiti `506473a`).
To'liq natija va dalillar: [PROFESSIONALIZATION_REPORT.md](PROFESSIONALIZATION_REPORT.md). Bu fayl — keyingi sessiya qayerdan
davom etishini ko'rsatadigan qisqa holat. Bir xil auditni qaytadan boshlamang.

Oxirgi yangilanish: 2026-10-12 · branch `claude/gallant-thompson-q70fo3` (main bilan bir xil, fast-forward).

## Bosqichlar

| Bosqich | Holat | Commit |
|---|---|---|
| A — boshlang'ich dalil | ✅ bajarildi (stack, route'lar, forma maydonlari solishtirildi; baseline testlar; production read-only holati) | — |
| B1 — qoralamalar (F-03) | ✅ | `5e686ae`, `5abef32` (handoff tuzatishi) |
| B2 — qidiruv xato/bo'sh (F-04) | ✅ | `8366626` |
| B3 — katalogda yo'q kasb (F-05) | ✅ (0057 production'da) | `ffe7556` |
| B4 — ishonchli upload (F-06) | ✅ vakansiya rasmi (0058 production'da) · avatar/logo — ochiq | `1236594` |
| B5 — zaxira (F-01) va 0056 (F-02) | ✅ zaxira production'da ishlayapti (2026-10-12) · ✅ 0056 production'da | `8bb81da`, `2f73f5c` |
| C — UX/a11y | ✅ o'lchangan tuzatishlar (kontrast, nishon o'lchami, planshet sarlavhasi, tez birinchi chizish) | shu sessiya oxirgi commit |
| D — o'lchov | ✅ lab o'lchovi · ❌ staging yuklama testi va field web-vitals — NOT_RUN | — |
| E — E2E + CI | ✅ 24 spec CI'da (izolyatsiyalangan stend) | `5abef32` va keyingilar |
| C8.1a — UI ovozlari | ✅ olib tashlandi | `6493eb6` |
| C8.1b — qotishlar | ✅ 4 ta o'lchangan qotish ([PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md)) | `3581aa0` |
| C8.1c — brend tizimi | ✅ tokenlar, shkalalar, qorong'i mavzu kontrasti, UI kit `/dev/ui`, [BRAND_UI_GUIDE.md](BRAND_UI_GUIDE.md) | shu bosqich |
| C8.2 — bosh sahifa, navigatsiya | ✅ aniq yo'llar, neytral kartalar, tur olib tashlandi, prefetch qotishi (Q8) | `8f5baca` |
| C8.3 — qidiruv, filtr, kartalar | ✅ rasm zaxirasi, filtr sinxroni, bo'sh natija, kirill "ёъ" xatosi | `b595af3` |
| C8.4 — ishchi e'loni | ✅ telefon formati (3 forma + login), sarlavha "Kirish" javoblarni saqlaydi, to'liq yo'l E2E | `48c53fe` |
| C8.5 — vakansiya e'loni | ✅ eskirgan xatolar tozalanadi (ikkala forma), ish beruvchi to'liq yo'li E2E | `8eea94f` |
| C8.6 — kirish va hisob | ✅ to'g'ri sarlavha, oflayn/server xatolari, 44 px; haqiqiy Telegram — BLOCKED | `e705ab0` |
| C8.7 — kabinet, e'lon, profil | ✅ yopuvchi amal neytral, "… gacha" muddat, o'zbekcha bandlik turi, "hozirgina", neytral tanlov va holat | shu bosqich |
| C8.8–C8.10 — ekranlar | ⏳ keyingisi C8.8 (arizalar, takliflar, chat, bildirishnomalar — ikki rol bilan); jadval — hisobot §10 | — |

## Keyingi sessiya uchun

0. C8.8 dan davom eting (hisobot §10 dagi "Ochiq" ro'yxati). Har ekran: OLDIN/KEYIN/fayllar/skrinshot/test/ochiq masala.
   "Oldin" skrinshoti: `bash e2e/screens/old-build.sh <commit>` (:3301, o'sha stend bazasi), oxirida `… <commit> stop`.
1. ✅ 0056 → 0057 → 0058 production'da (2026-10-11, read-only tekshirildi). Saytni brauzerda tekshirish: "Kasbim topilmadi", rasm yuklash.
2. ✅ Zaxira sirlari sozlandi, birinchi shifrlangan nusxa yaratildi (run `38207925133`). Egasi: bir marta yopiq kalit bilan ochib ko'rsin (`age -d`).
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
node e2e/screens/capture.mjs http://localhost:3300 x home-full,ui-kit /tmp/x  # tanlangan ekranlar, boshqa papka
```
