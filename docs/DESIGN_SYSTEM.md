# Dizayn tizimi — Ish topdim 5.0 "ko'k-oq" (ranglar, shrift, bosh sahifa), 2.0 (tuzilish)

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

### 5.0 "ko'k-oq" (2026-11-16, ega dizayn topshirig'i) — amaldagi qiymatlar

Tokenlar `oklch` da (`src/app/globals.css`), shrift **Manrope Variable** 400–800 (`@fontsource-variable/manrope`),
radius `0.875rem`. Kontrast `brand-contrast.test.ts` da oklch → hex orqali tekshiriladi (barcha AA juftlari ✓).

| Token | Qiymat |
| --- | --- |
| `--background` | `oklch(0.982 0.004 250)` |
| `--foreground` | `oklch(0.2 0.03 260)` |
| `--card`, `--popover` | `oklch(1 0 0)` |
| `--primary`, `--primary-ink`, `--ring`, `--brand` | `oklch(0.52 0.2 260)` |
| `--primary-soft`, `--accent`, `--tint-blue` | `oklch(0.95 0.03 260)` |
| `--secondary` / `--muted` | `oklch(0.96 0.01 255)` / `oklch(0.96 0.008 255)` |
| `--muted-foreground` | `oklch(0.52 0.03 260)` |
| `--brand-green` (nuqta, belgi) / `--success` (matn, AA) | `oklch(0.62 0.15 155)` / `oklch(0.5 0.13 155)` |
| `--warm` | `oklch(0.66 0.18 45)` |
| `--border` | `oklch(0.92 0.01 255)` |
| `--gradient-brand` | `linear-gradient(135deg, oklch(0.55 0.21 262), oklch(0.62 0.17 230))` |
| `--gradient-hero` | `radial-gradient(circle at 90% 0%, oklch(0.93 0.05 260) 0%, transparent 45%)` |
| `--shadow-card`, `--shadow-glow` | karta soyasi; ko'k "nur" (asosiy tugma, hover) |

Komponentlarda gradient/blur to'g'ridan-to'g'ri yozilmaydi (`brand-guard.test.ts`) — faqat utilitlar orqali:
`brand-fill` (gradient fon + oq matn), `brand-text` (gradient so'z), `hero-glow`, `glass-bar` (shaffof sticky sarlavha),
`rounded-hero` (2rem), `live-dot` (miltillovchi nuqta), `shadow-card`, `shadow-glow`.

Tuzilish (5.0):

- **Sarlavha** — 64 px (telefonda 56), sticky, `glass-bar`; logo 36 px — egasining haqiqiy belgisi (`src/assets/brand/ishtopdim-mark.png`) + "Ish topdim";
  5 ta pill menyu (Bosh sahifa · Yordamchi · Ishlar · Arizalar · Profil), o'ngda "E'lon berish" (gradient pill), til,
  "Kirish". Telefonda — pastki menyu. Kirgan foydalanuvchida kompyuterda avvalgidek chap yon menyu (ega talabi, 2026-11).
- **Bosh sahifa** — rol almashtirgich (pill) → hero panel (radius 2rem, `hero-glow`, joy pilli, salom 👋, gradient so'zli
  H1, izoh, qidiruv + gradient "Topish", 4 ta rangli chip — telefonda 2×2, filtrlar va xarita havolasi) → "Yangi ishlar"
  (3/2/1 ustun) → "Namuna e'lonlar" (kolba belgisi, punktir kartalar). Ortiqcha bo'lim qo'shilmadi; avvaldan bor
  "Universal ustalar" bloki saqlandi. Kirgan foydalanuvchida telefonda "Yangi ishlar" avvalgidek yig'ilgan ("Ko'rish").
- **Ish kartasi** — `rounded-2xl`, `shadow-card`, ichki 20 px (telefonda ixcham — 390×844 da 3 ta karta to'liq), hover:
  4 px ko'tariladi, `shadow-glow`, tepada gradient chiziq; maosh — `primary-soft` pill; bugungi e'londa yashil nuqta.

### 4.0 ranglari (2026-11-16, ega "MASTER PROMPT" dizayn tizimi) — 5.0 bilan almashtirildi

Ega talabi: Primary `#1558D6`, Secondary `#EAF1FF`, Background `#F5F7FA`, Surface `#FFFFFF`, Text `#101828`,
Secondary text `#667085`, Success `#16A36A`, Error `#DC3545`; Inter; 8px oraliq; kartalar 12–16px; yengil soya.
Tuzilish o'zgarmadi — faqat tokenlar. AA (≥ 4.5:1) dan o'tmagan uchta rang uchun matn varianti olindi (asl rang — belgi/nuqta):

| Token | 4.0 qiymati | Kontrast |
| --- | --- | --- |
| `--primary`, `--primary-ink`, `--ring`, `--brand` | `#1558D6` | oq matn 6.2, fon 5.8, `#EAF1FF` 5.5 ✓ |
| `--primary-hover` | `#1149B5` | oq 7.9 |
| `--primary-soft`, `--secondary`, `--accent`, `--hero-soft`, `--tint-blue` | `#EAF1FF` | |
| `--background` | `#F5F7FA` | |
| `--card` | `#FFFFFF` | |
| `--foreground` | `#101828` | fon 16.5 ✓ |
| `--muted-foreground` | `#626C81` (talab `#667085`) | `#667085` `#EAF1FF` ustida 4.4 — o'tmaydi; `#626C81`: oq 5.3, fon 4.9, `#EAF1FF` 4.65 ✓ |
| `--success` / `--brand-green` | `#107A4F` matn / `#16A36A` belgi | `#16A36A` oq ustida 3.2 — faqat belgi |
| `--destructive` | `#C62F3E` (talab `#DC3545`) | `#DC3545` fonda 4.2 — o'tmaydi; `#C62F3E`: oq 5.4, fon 5.1 ✓ |
| `--border` / `--input` | `#EAECF0` / `#D0D5DD` | dekorativ |
| `--radius` | `0.75rem` (12px); kartalar `rounded-2xl` (16px) | |
| `--shadow-*` | neytral `rgb(16 24 40 / …)`, yengil | |

Navy (`--navy`, footer va yon menyu) va "AI" to'q sariq rangi o'zgarmadi. Qorong'i mavzu — keyingi qadamda.

### 3.0 ranglari (2026-11-15, ega yuborgan namuna rasm) — tarix

Ega: "tuzilishini o'zgartirma, faqat dizaynni shunga mosla — ranglarni". Tuzilish (sahifalar, bloklar tartibi) 2.0 dagidek;
o'zgargani — ranglar, soyalar, belgi plitkalari. Namunadagi soxta raqamlar ("2 500+ vakansiya"), begona logotiplar va stok
odam surati **olinmadi** (1-bo'lim qoidasi).

| Token | 3.0 qiymati | Kontrast |
| --- | --- | --- |
| `--primary` | `#0B57F0` (yorqin ko'k) | oq matn 5.8, fonda 5.4 ✓ |
| `--primary-ink` | `#0847CF` | oq 7.5, fon 7.0, och ko'k 6.4 ✓ |
| `--primary-soft` | `#E7EEFE` | maosh "pilyulasi", joylashuv tugmasi foni |
| `--background` | `#F5F7FD` (och ko'kish) | |
| `--foreground` | `#0E1A3D` (chuqur navy) | fon 15.9 ✓ |
| `--muted-foreground` | `#4B5884` (ko'kish kulrang) | oq 6.9, fon 6.5 ✓ |
| `--border` | `#E6EBF5` | dekorativ |
| `--navy` / `--navy-2` | `#0D1F3F` / `#1A3563` | bosh sahifa banneri (`.hero-navy`, yengil gradient), yon menyu |
| `--hero-accent` | `#6EA8FF` | navy banner ustidagi ko'k urg'u so'zlar: navy 6.8, navy-2 5.0 ✓ |
| `--tint-blue/violet/green/orange` (+ `-ink`) | `#E3EDFE/#0A4FD8`, `#EBE9FE/#4F46E5`, `#E1F5F1/#05845F`, `#FFEFE3/#EA580C` | faqat belgi plitkasi (≥ 3:1) |
| `--shadow-sm` / `--shadow-md` | yumshoq ko'kish soya | oq kartalar (`rounded-2xl border bg-card` — avtomatik) |

- Rangli plitkalar: `components/shared/tints.ts` (`TINT_TILE`, `tintAt(i)` — navbatma-navbat, `tintFor(key)` — menyu bo'limlari).
- Pastki menyu: faol bo'lim ostida ko'k chiziq. Maosh — och ko'k pilyulada (`bg-primary-soft text-primary-ink`).
- "Universal ustalar" o'z turkuaz mavzusida qoladi; "Barchasi siz uchun" — to'q sariq (`--ai`).

### 2.0 (tarix)

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
| `--ai` | `#C2410C` (qorong'ida `#FB923C`) | **AI yordamchi** bo'limi: menyudagi havola, kartalar, AI belgisi | oq matn 5.2:1, karta 5.2, Cloud 4.8 ✓ |
| `--ai-soft` | `#FFF1E6` | AI kartasi foni | `--ai` matn 4.7:1 ✓ |
| `--ai-bright` | `#FB923C` | AI yordamchi — to'q ko'k yon menyuda | navy ustida 7.4:1 ✓ |
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

- Bitta shrift oilasi: **Manrope Variable** (5.0 dan; avval Inter Variable) (lotin, kengaytirilgan lotin, kirill — o'zbek lotin va kirill, rus). Hozirgi
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
| noutbuk | 1280 | chap sidebar (kirgan foydalanuvchi), mehmonda yuqori pill menyu |
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
