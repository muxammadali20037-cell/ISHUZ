# "Ish topdim" — brend va UI qo'llanmasi

Sana: 2026-10-12 · Holat: C8.1c bo'yicha amalda (kod va testlar bilan majburlangan).

Bu hujjat ilovaning yagona ko'rinish qoidalarini beradi. Qoidalar faqat yozib qo'yilmagan, testlar orqali
**majburlanadi**: qoidani buzgan kod CI'da yiqiladi (pastdagi "Tekshiruv" bo'limiga qarang).

- Tokenlar manbai: `src/app/globals.css` (`:root` — yorug', `.dark` — qorong'i, `@theme inline` — Tailwind nomlari).
- Komponentlar: `src/components/ui/*` (`Button`, `Input`, `Select`, `Field`, `Chip`, `Badge`, `Card`, `Dialog` …).
- Jonli namuna: `/dev/ui` — faqat ishlab chiquvchi uchun (production'da 404; lokal E2E stendida `UI_KIT_PREVIEW=1`).
  Foydalanuvchi menyusida yo'q, `robots: noindex`.

## 1. Rang

**Bitta aksent.** Brend rangi — ko'k (`primary`). Qolgan ranglar faqat **ma'no** uchun ishlatiladi, bezak uchun emas.

| Token | Yorug' | Qorong'i | Qachon |
|---|---|---|---|
| `primary` | `#1d5fe0` | `#5a8ef8` | Asosiy tugma, faol holat, havola, tanlangan chip |
| `primary-soft` | `#e8effc` | `#16274a` | Ikonka plitasi, tanlangan qator foni, ma'lumot paneli |
| `foreground` | `#0f172a` | `#e6ebf3` | Asosiy matn |
| `muted-foreground` | `#5b687c` | `#94a3b8` | Ikkinchi darajali matn, izoh |
| `background` / `card` | `#f6f8fb` / `#ffffff` | `#0b1220` / `#111a2b` | Sahifa foni / karta va forma sirti |
| `border` | `#e2e8f0` | `#223047` | Chegara, ajratgich |
| `success` | `#15803d` | `#22c55e` | **Faqat natija:** saqlandi, joylandi, tasdiqlandi, "Qidiruvda ko'rinadi" |
| `warning` | `#b45309` | `#f59e0b` | **Faqat ogohlantirish:** muddat tugayapti, tekshiruvda, chegirma muddati |
| `destructive` | `#d12020` | `#f05252` | **Faqat xato va o'chirish**, o'qilmagan hisoblagich |

Qoidalar:

- Har rang uchun ustidagi matn — o'sha rangning `*-foreground` tokeni (`bg-primary text-primary-foreground`).
  `text-white` / `bg-white` ishlatilmaydi: qorong'i mavzuda `primary`, `success`, `destructive` och rangga o'tadi va
  oq matn o'qilmay qoladi (C8.1c da 59 qator tokenlarga o'tkazildi).
- Yumshoq fon + to'q matn juftligi: `bg-success-soft text-success`, `bg-warning-soft text-warning` va h.k. (`Badge`).
- Ikki teng tanlov (masalan, "Ishchiman / Ish beruvchiman") bir xil ko'rinadi — biri yashil, biri ko'k bo'lmaydi.
- Tailwind palitrasi (`bg-violet-600`, `text-amber-300` …), hex rang (`bg-[#7c3aed]`) va bezak gradienti ishlatilmaydi.
- Uchinchi tomon belgisi o'z rangida faqat **ikonkada** qoladi (Telegram ikonkasi `#2AABEE`); tugmaning o'zi — bizning `Button`.
- Kontrast: barcha juftliklar ikkala mavzuda **≥ 4.5:1** (WCAG AA) — `src/lib/brand-contrast.test.ts` tekshiradi.

## 2. Shrift

**Manrope** — bitta oila, lotin va kirill (`next/font/google`, o'zimizdan yuklanadi, tashqi so'rov yo'q). O'zbek lotin
(`o'`, `g'`, `ʻ`), kirill (`ў`, `қ`, `ғ`, `ҳ`) va rus harflari bir xil chiziladi.

| Klass | O'lcham | Qatorlar | Qayerda |
|---|---|---|---|
| `text-3xl font-extrabold` | 30 | 36 | Sahifa sarlavhasi (`h1`, bittadan) |
| `text-2xl font-bold` | 24 | 32 | Bo'lim sarlavhasi |
| `text-xl font-semibold` | 20 | 28 | Karta sarlavhasi, oyna sarlavhasi |
| `text-lg` | 18 | 28 | Katta matn, forma savoli |
| `text-base` | 16 | 24 | Asosiy matn |
| `text-md` | 15 | 22 | Kiritish maydoni, ixcham matn, tugma |
| `text-sm` | 14 | 20 | Izoh, yordamchi matn, kichik tugma |
| `text-xs` | 12 | 16 | Yorliq, pastki navigatsiya |
| `text-2xs` | 11 | 16 | **Faqat** hisoblagich, vaqt belgisi, foto ustidagi yozuv |

- Ixtiyoriy o'lcham (`text-[13px]`) ishlatilmaydi — 80 joy shkalaga o'tkazildi.
- Qalinlik: 400 matn · 500 yorliq · 600 tugma/sarlavha · 700–800 faqat katta sarlavha va raqam.
- Sarlavhalar `text-wrap: balance`; raqamlar jadvalda `tabular`.

## 3. Oraliq, radius, soya

- **Oraliq — 4/8 tizim** (Tailwind `1` = 4 px): 4 · 8 · 12 · 16 · 24 · 32 · 48. Karta ichki chegarasi 16–24,
  kartalar orasi 12–16, bo'limlar orasi 32–48. Telefonda sahifa yon chegarasi 16.
- **Radius** (bitta `--radius: 14px` dan hisoblanadi):

  | Klass | px | Qayerda |
  |---|---|---|
  | `rounded-xs` | 5 | Checkbox |
  | `rounded-sm` | 8 | Ichki kichik belgi |
  | `rounded-md` | 12 | Toast, kichik rasm |
  | `rounded-lg` | 14 | Kichik tugma, badge |
  | `rounded-xl` | 18 | Tugma, kiritish maydoni, ikonka plitasi |
  | `rounded-2xl` | 24 | Karta, bo'lim, oyna, katta tugma |
  | `rounded-full` | — | Chip, avatar, hisoblagich |

  `rounded-3xl` (24 px bilan bir xil edi) olib tashlandi; ixtiyoriy radius (`rounded-[…]`) yo'q.
- **Soya** — ixcham, faqat 3 daraja: `shadow-sm` karta · `shadow-md` ko'tarilgan (bosh sahifa kartalari) ·
  `shadow-lg` faqat qalqib chiquvchi qatlam (oyna, menyu, toast, suzuvchi panel). `shadow-xl/2xl` yo'q.
- **Blur yo'q.** Yopishqoq sarlavha, pastki panel va oyna fonlari — to'liq sirt (`bg-card`). `backdrop-filter` past
  darajali Android'da har scroll kadrida qayta chiziladi (18 joydan olib tashlandi).

## 4. Komponentlar

### Tugma (`Button`)

| Variant | Qachon |
|---|---|
| `default` | Ekrandagi **bitta** asosiy amal ("E'lonni joylash", "Davom etish") |
| `outline` | Ikkinchi darajali amal ("Orqaga", "Batafsil", "O'zgartirish") |
| `soft` | Uchinchi darajali, lekin ko'zga tashlanishi kerak ("Menga mos ishlar") |
| `ghost` / `link` | Matnli amal, navigatsiya |
| `destructive` / `destructive-soft` | O'chirish, rad etish (har doim tasdiqlash oynasi bilan) |
| `success` | Faqat natijani tasdiqlovchi amal (kamdan-kam; asosiy amal o'rnida emas) |

- O'lcham: `default` 44 · `lg` 52 · `xl` 56 · `sm` 36 (ko'rinishi) — `sm` va `icon-sm` ga `tap-target` qo'yilgan:
  barmoq maydoni baribir **44×44**.
- `loading` — aylanuvchi belgi + tugma bloklanadi (ikki marta bosilmaydi). Matn o'zgarmaydi yoki "…moqda" bo'ladi.
- `disabled` — 50% shaffof; nega o'chiqligi yonida yoziladi (masalan, "Kasbni tanlang").
- Faqat ikonka bo'lsa — `aria-label` majburiy.

### Kiritish maydoni (`Field` + `Input` / `Textarea` / `Select`)

- Holatlar: oddiy · fokus (ko'k chegara + halqa) · xato (qizil chegara + pastda matn) · o'chiq.
- `Field` xato yoki izoh matniga `id` beradi va ichidagi `Input`/`Textarea`/`Select` ga avtomatik
  `aria-describedby` va `aria-invalid` qo'yadi (ekran o'quvchi xatoni maydon bilan birga o'qiydi) — `field.test.tsx`.
- Balandlik 48 px, matn `text-md`; label har doim ko'rinadi (placeholder label o'rnini bosmaydi).
- Xato matni: **nima bo'ldi + nima qilish kerak** ("Raqam to'liq emas: +998 va 9 ta raqam").

### Tanlov: `Checkbox`, `RadioItem`, `Switch`, `Chip`

- Checkbox — kvadrat (`rounded-xs`), radio — doira: ikkalasi farqlanadi (avval checkbox ham doira bo'lib chizilardi).
- Butun qator (label) bosiladi; kichik elementlarda `tap-target` (44×44).
- Chip — filtr va ko'p tanlov; tanlangani `primary` fon + belgi.

### Belgi (`Badge`)

`default` neytral · `primary` yangi/ma'lumot · `success` joylandi/faol · `warning` tekshiruvda/muddat ·
`destructive` rad etildi/xato · `outline` xususiyat (yarim kun, masofaviy).

### Karta, oyna, bo'sh holat, yuklanish

- Karta: `rounded-2xl border bg-card shadow-sm`, ichki chegara 16–24. Ikonka plitasi — `bg-primary-soft text-primary`.
- Brend sirti (`bg-primary`) faqat bitta asosiy taklif uchun (masalan, AI yordamchi); ichida oq "PRO" belgisi.
- Oyna (`Dialog`/`ConfirmDialog`): sarlavha + bir jumla izoh + "Bekor qilish" (outline) va amal tugmasi.
- Bo'sh holat (`EmptyState`): ikonka + nima uchun bo'sh + keyingi qadam tugmasi.
- Yuklanish: joyni egallaydigan `Skeleton` (sahifa sakramaydi); 30 s dan uzoq kutilmaydi (`callAction` → "Javob kechikdi").

## 5. Harakat, fokus, ovoz

- Bosilganda darhol javob: `.press` — 120 ms, `scale .97`, sakrashsiz. Ro'yxat paydo bo'lishi 150 ms, ketma-ket kechikishsiz.
- Sahifa o'tishida animatsiya yo'q (C8.1b: View Transition bosishni 0.5 s bloklardi).
- `prefers-reduced-motion` — barcha animatsiya va konfetti o'chadi.
- Klaviatura fokusi har elementda ko'rinadi (2 px `ring` + 2 px oraliq) — E2E tekshiradi.
- **UI ovozi yo'q** (C8.1a). Telegram ichida tebranish faqat natijada (muvaffaqiyat/xato), har bosishda emas.
- Konfetti — faqat muhim natijada, brend ranglarida (`primary`, `success`, `warning`), kamalak emas.

## 6. Ikonka

- `lucide-react`, chiziq 2 px; o'lcham 16 (matn ichida) · 20 (tugma) · 24–32 (plita). Bezak ikonkasi `aria-hidden`.
- Bir joyda ikonka **yoki** emoji — ikkalasi birga emas.

## 7. Matn ohangi

- Oddiy o'zbek tili, "siz" bilan, qisqa jumla. Texnik so'z yo'q ("server", "xatolik kodi").
- Tugma — fe'l bilan: "E'lonni joylash", "Qo'ng'iroq qilish", "Davom etish".
- Xato — aybsiz va yechim bilan: "Internet aloqasi uzildi. Javoblaringiz saqlandi — yana bosing."
- Natija — aniq: "E'loningiz joylandi. Ish beruvchilar uni qidiruvda ko'radi."
- Bitta tushuncha — bitta so'z (masalan, doim "e'lon", goh "vakansiya" emas). Brend nomi — "Ish topdim".
- 4 tilda (uz, oz, ru, en) bir xil ma'no; kirill (`oz`) lotindan avtomatik hosil qilinadi (`scripts/gen-oz-messages.mjs`).

## 8. Istisnolar (sababi bilan)

| Fayl | Nimadan ozod | Sabab |
|---|---|---|
| `features/profile/components/cv/cv-document.tsx` | palitra, hex, px-shrift, oq | Chop etiladigan CV — doim oq qog'oz |
| `features/promo/card.tsx` | hex, gradient | Serverda PNG'ga chiziladigan ulashiladigan karta (CSS tokenlari yo'q) |
| `app/global-error.tsx` | hex | Ildiz layout yiqilganda CSS yuklanmagan bo'lishi mumkin |
| `app/layout.tsx` | hex | Brauzer `themeColor` meta |
| `features/auth/components/auth-form.tsx` | hex | Telegram ikonkasining rasmiy rangi |
| `components/ui/checkbox.tsx` | oq | Switch tutqichi ikkala mavzuda oq |
| `features/admin/components/mfa-form.tsx` | oq | QR kod faqat oq fonda o'qiladi |
| `features/workers/components/portfolio-gallery.tsx` | oq | To'liq ekranli qora foto ko'rgich |

Foto/video ustidagi qora parda (`bg-black/60 text-white`) — avtomatik istisno (rasm har ikki mavzuda bir xil).
Yangi istisno faqat `src/lib/brand-guard.test.ts` dagi ro'yxatga sababi bilan qo'shiladi.

## 9. Tekshiruv (avtomatik)

| Test | Nima tekshiradi |
|---|---|
| `src/lib/brand-guard.test.ts` | `src/**/*.tsx` da palitra rangi, hex, gradient, blur, radius/shrift/soya shkalasidan tashqari qiymat, rangli fonda `text-white` yo'qligi |
| `src/lib/brand-contrast.test.ts` | 19 rang juftligi × 2 mavzu ≥ 4.5:1 (globals.css dan o'qiladi) |
| `src/components/ui/field.test.tsx` | Xato/izoh matni maydonga `aria-describedby` bilan bog'langan |
| `e2e/specs/a11y.spec.ts` | 8 sahifa (shu jumladan `/dev/ui`) × 5 kenglik: axe AA, gorizontal siljish, 24/44 px nishon; klaviatura fokusi; reduced-motion; **qorong'i mavzuda** 6 sahifa kontrasti |
| `e2e/specs/no-ui-sound.spec.ts` | AudioContext yaratilmaydi, ovoz tugmasi yo'q |

## 10. Yangi ekran uchun nazorat ro'yxati

1. Bitta `h1`; bitta asosiy tugma; qolganlari `outline`/`soft`.
2. Faqat tokenlar: `bg-card`, `text-muted-foreground`, `bg-primary-soft text-primary` …
3. Rangli fonda — `*-foreground`; semantik rang faqat ma'nosi uchun.
4. Forma — `Field` + `Input`/`Select`/`Textarea`; xato matni yechim bilan.
5. Bo'sh, yuklanish, xato, oflayn holatlari bor; server amali `callAction` orqali.
6. 360 px da gorizontal siljish yo'q; nishonlar ≥ 44 px; klaviatura bilan o'tiladi.
7. Ikkala mavzuda ko'rib chiqing (`/settings` → Mavzu yoki `ishuz_theme=dark` cookie).
8. `npm test` (brend qo'riqchisi) va `npx playwright test -c e2e e2e/specs/a11y.spec.ts` toza.
