# Test hisoboti (TEST_REPORT)

Har bir bosqichdan keyin yangilanadi. Hech bir test yashirilmaydi yoki CI uchun o'chirilmaydi.

## Oxirgi to'liq yurish — 2026-11-07, commit `c6374c1`, CI run 42348648659 (yashil)

| Qatlam | Natija | Qayerda |
| --- | --- | --- |
| Secret scan + `npm audit --omit=dev` (high) | ✅ 0 zaiflik | CI |
| ESLint, TypeScript | ✅ 0 xato | CI |
| Vitest | ✅ 708 o'tdi, 18 o'tkazib yuborildi | CI |
| SQL migratsiyalar + RLS testlari (38 fayl) | ✅ | CI |
| Playwright E2E (izolyatsiyalangan stend) | ✅ 236 o'tdi | CI va lokal |
| `next build` | ✅ | CI |

**O'tkazib yuborilgan 18 Vitest testi:** `src/features/matching/engine.parity.test.ts` — eskirgan TS moslash dvigatelini
(v1) SQL v2 bilan solishtiradi; v2 ga mos emasligi ma'lum (`src/features/matching/README.md`). Runtime TS dvigatelni
ishlatmaydi. 7-bosqichda TS dvigatel olib tashlanadi yoki v2 ga ulanadi — shunda bu testlar ham hal bo'ladi.

## Ma'lum beqaror test (tuzatildi)

`e2e/specs/responsiveness.spec.ts` "20 marta sahifa almashtirish": CI'da ba'zan o'lchov sahifa to'liq tinchimasdan olinardi
(465 → 591 tinglovchi; lokal stendda 6× sekinlashtirilganda ham o'sish yo'q). O'lchov endi barqaror o'qishni kutadi,
chegaralar o'zgarmadi. Keyingi CI yurishi yashil.

## Tekshirilmagan

- Prod bazada SQL testlar (kirish yo'q).
- Real foydalanuvchi tezligi (RUM yig'ilmaydi).
