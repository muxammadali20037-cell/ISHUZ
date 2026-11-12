# Dizayn tizimi — Ish topdim 2.0

Holat: **ranglar, shrift va radius kodga qo'llandi** (1-bosqich, 1-qadam, 2026-11-11) — `src/app/globals.css`.
Komponentlar va qobiqlar keyingi qadamlarda. Kontrast `src/lib/brand-contrast.test.ts` da avtomatik tekshiriladi.
Bu hujjat `docs/BRAND_UI_GUIDE.md` o'rnini egallaydi (u Manrope shriftini aytadi, kod esa Inter ishlatadi — eskirgan).

## 1. Vizual yo'nalish

Premium, minimal, professional. Ko'p rang, gradient va animatsiya bilan emas, tartib, aniqlik va bo'sh joy bilan.
Namuna rasmlar — sifat darajasi uchun, piksel nusxasi uchun emas. Ulardan **olinmaydi**:

- soxta raqamlar ("10K+ faol e'lon", "12 540 ta ish", "4.8 (247 baho)", "246 ko'rish") — faqat bazadan hisoblangan haqiqiy son;
  son kichik bo'lsa (20 dan kam) umuman ko'rsatilmaydi;
- stok yoki AI yaratgan odam suratlari, begona kompaniya logolari;
- ma'lumot bo'lmagan joyda to'ldiruvchi grafiklar.

## 2. Ranglar

Asos — talabdagi palitra. Kontrast WCAG AA (oddiy matn ≥ 4.5:1) bo'yicha hisoblandi; o'tmagan joyda matn uchun to'qroq
variant qo'shildi. Faqat tokenlar ishlatiladi, komponentda hex yozilmaydi.

| Token | Qiymat | Ishlatilishi | Kontrast |
| --- | --- | --- | --- |
| `--navy` | `#101D35` | Sarlavha zonalari, admin sidebar, logo | oq matn 16.8:1 |
| `--primary` | `#276FE5` | Asosiy tugma foni, havola, faol holat | oq matn 4.7:1 ✓ |
| `--primary-ink` | `#1F5FCC` | Cloud fonda va och ko'k fonda ko'k **matn** | Cloud 5.4:1 ✓ (`#276FE5` Cloud'da 4.3 — o'tmaydi) |
| `--primary-soft` | `#EAF1FD` | Tanlangan chip, faol menyu foni | |
| `--background` | `#F4F6FA` (Cloud) | Sahifa foni | |
| `--card` | `#FFFFFF` | Kartalar, formalar | |
| `--foreground` | `#172033` | Asosiy matn | Cloud 15:1 ✓ |
| `--muted-foreground` | `#56657A` | Ikkinchi darajali matn | oq 5.9, Cloud 5.5 ✓ (talabdagi `#64748B` Cloud'da 4.4 — o'tmaydi) |
| `--border` | `#E5EAF0` | Chegaralar, ajratgichlar | dekorativ |
| `--brand-green` | `#16A378` | Muvaffaqiyat ikonkasi, nuqta, progress | matn sifatida 3.2:1 — **faqat matn emas** |
| `--ai` | `#C2410C` (qorong'ida `#FB923C`) | **AI yordamchi** bo'limi: menyudagi havola, kartalar, AI belgisi, "Yangi" belgisi | oq matn 5.2:1, karta 5.2, Cloud 4.8 ✓ |
| `--ai-soft` | `#FFF1E6` | AI kartasi foni | `--ai` matn 4.7:1 ✓ |
| `--ai-bright` | `#FB923C` | AI yordamchi va "Yangi" belgisi — to'q ko'k yon menyuda | navy ustida 7.4:1 ✓ |
| `--success` | `#0E7A5A` | "Qabul qilindi", "Tasdiqlangan" matni | oq 5.3, Cloud 4.9 ✓ |
| `--warning` | `#B54708` | "Suhbat", "Kutilmoqda" | oq 5.4 ✓ |
| `--destructive` | `#B42318` | "Rad etildi", xatolar | oq 6.6 ✓ |

Qoidalar:
- Ko'k matn va ikonka — faqat `text-primary-ink` klassi; `bg-primary` / `border-primary` — tugma va chegaralar.
- Yashil faqat muvaffaqiyat va tasdiq uchun. Rad etilgan ariza hech qachon yashil emas.
- Ariza holatlari ranglari qat'iy (`STATUS_TONE`): yangi/ko'rildi — neytral yoki ko'k, saralangan — ko'k, suhbat — sariq,
  taklif va qabul — yashil, rad — qizil, qaytarib olingan — kulrang.
- Qorong'u rejim saqlanadi; tokenlarning qorong'u qiymatlari 1-bosqichda xuddi shu kontrast qoidasi bilan hisoblanadi.

## 3. Tipografiya

- Bitta shrift oilasi: **Inter Variable** (lotin, kengaytirilgan lotin, kirill — o'zbek lotin va kirill, rus). Hozirgi
  ikkinchi (Geist) displey shrifti olib tashlanadi: bitta oila — kamroq yuklash va sahifalararo bir xil ko'rinish.
- O'lchamlar: 12 / 14 / 16 / 18 / 22 / 28 / 36 (faqat bosh sahifa sarlavhasi). Qator balandligi matn uchun 1.5, sarlavha uchun 1.2.
- Og'irliklar: 400, 500, 600, 700.
- Maosh va raqamlar: `font-variant-numeric: tabular-nums`.
- O'zbekcha `oʻ` / `gʻ` uchun `ʻ` (U+02BB) belgisi izchil.

## 4. O'lchovlar

| | Qiymat |
| --- | --- |
| Bo'shliq shkalasi | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 |
| Radius | tugma va input 10 px, karta 12 px, katta panel 16 px, chip — to'liq |
| Soya | `0 1px 2px rgb(16 29 53 / 0.06)`; ochiladigan oyna `0 8px 24px rgb(16 29 53 / 0.12)`. Boshqa soya yo'q |
| Chegara | 1 px `--border` |
| Tugma balandligi | 44 px (asosiy), 36 px (kichik), 52 px (mobil asosiy CTA) |
| Bosish maydoni | kamida 44 × 44 px |

## 5. Breakpoint va qobiqlar

| Nom | Kenglik | Qobiq |
| --- | --- | --- |
| mobil | 360 / 390 / 430 | 56 px yuqori panel + 5 bandli pastki menyu |
| planshet | 768 | yuqori panel, kontent 2 ustun |
| noutbuk | 1280 | chap sidebar (kabinetlar), ochiq saytda yuqori menyu |
| kompyuter | 1440+ | kontent maksimal kengligi 1200 px |
| Telegram Mini App | 360–430 | o'z sarlavhasi yo'q; Telegram BackButton / MainButton, mavzu ranglari |

Hamburger va pastki menyu bir vaqtda chiqmaydi. Mobil — desktopning kichraytirilgani emas, alohida tuzilma.

## 6. Komponentlar (mavjud `src/components/ui` asosida)

Hozir bor: avatar, badge, button, card, checkbox, chip, dialog, dropdown-menu, input, label, progress, select, skeleton,
tabs, toast. 1-bosqichda qo'shiladi: table, drawer (mobil pastki varaq), alert, empty-state, error-state, status-badge
(holatlar uchun yagona), stat-card, sidebar, bottom-nav, page-header, stepper, file-upload.

Har bir komponent uchun holatlar: odatiy, hover, fokus (ko'rinadigan halqa), bosilgan, o'chirilgan, yuklanmoqda, xato.

## 7. Sahifa holatlari

Har bir muhim ekran: yuklanmoqda (skeleton) · bo'sh (nima qilish kerakligi bilan) · xato (qayta urinish) ·
muvaffaqiyat · oflayn · ruxsat yo'q · forma xatolari. Bo'sh holat soxta ma'lumot bilan to'ldirilmaydi.

## 8. Vakansiya kartasi (yagona)

Tartib: lavozim → **maosh** (eng ko'zga ko'rinadigan) → kompaniya · tuman → bandlik turi → tasdiq belgisi (faqat haqiqiy
tasdiqlangan bo'lsa) → e'lon qilingan vaqt. Butun karta bosiladi; saqlash tugmasi o'ng yuqorida.

## 9. Suratlar va ikonkalar

- Ikonkalar: faqat Lucide, chiziq qalinligi 1.75, o'lcham 16 / 20 / 24.
- Odam suratlari: faqat roziligi olingan, O'zbekistonda suratga olingan haqiqiy kasb egalari. Ular tayyor bo'lguncha —
  tipografiya, ikonkalar va neytral kompozitsiya. Stok va AI odamlar ishlatilmaydi.
- Kompaniya logosi: faqat kompaniyaning o'zi yuklagani; bo'lmasa — bosh harf.

## 10. Tekshirish

- Kontrast: yangi tokenlar uchun avtomatik test (Vitest).
- axe: barcha ochiq sahifalar va kabinetlar, "moderate" va undan yuqori — test yiqiladi.
- Skrinshotlar: 360, 390, 430, 768, 1280, 1440 kengliklarda, uchta til.
