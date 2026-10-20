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

COBALT SUN palitrasi (2026-10, `docs/REDESIGN_2026-10.md`).

| Token | Yorug' | Qorong'i | Qachon |
|---|---|---|---|
| `primary` | `#2457f5` | `#7a9bff` | Asosiy tugma, faol holat, havola, tanlangan chip |
| `primary-soft` | `#eef3ff` | `#1b2a50` | Ikonka plitasi, tanlangan qator foni, ma'lumot paneli |
| `foreground` | `#15213b` | `#e7ecf5` | Asosiy matn |
| `muted-foreground` | `#5f6b7f` | `#9aa6bc` | Ikkinchi darajali matn, izoh (ochiq fonlarda ham ≥ 4.8:1) |
| `background` / `card` | `#f6f8fc` / `#ffffff` | `#0e1729` / `#152036` | Sahifa foni / karta va forma sirti |
| `border` / `input` | `#e4e9f2` / `#d5dce8` | `#26334d` / `#2f3e5c` | Chegara, ajratgich / forma maydoni chegarasi |
| `highlight` | `#ffc83d` | `#ffc83d` | **Kam ishlatiladigan sariq urg'u:** faqat TOP belgisi (`bg-highlight text-highlight-foreground`) |
| `success` | `#137a53` | `#34c38a` | **Faqat natija:** saqlandi, joylandi, tasdiqlandi, "Qidiruvda ko'rinadi" |
| `warning` | `#b45309` | `#f59e0b` | **Faqat ogohlantirish:** muddat tugayapti, tekshiruvda, chegirma muddati |
| `destructive` | `#c42719` | `#f26b5e` | **Faqat xato va o'chirish**, o'qilmagan hisoblagich |
| `info` | `#0369a1` | `#38bdf8` | **Faqat ariza/taklif holati** "Yuborildi", "Ko'rildi" (jarayonda, hali natija yo'q) — `bg-info-soft text-info` |

Radius 8 px asosida (`rounded-lg` = 8, `rounded-xl` = 12 px — kartalar); soyalar yengil, kartada soya o'rniga chegara.

Qoidalar:

- Har rang uchun ustidagi matn — o'sha rangning `*-foreground` tokeni (`bg-primary text-primary-foreground`).
  `text-white` / `bg-white` ishlatilmaydi: qorong'i mavzuda `primary`, `success`, `destructive` och rangga o'tadi va
  oq matn o'qilmay qoladi (C8.1c da 59 qator tokenlarga o'tkazildi).
- Yumshoq fon + to'q matn juftligi: `bg-success-soft text-success`, `bg-warning-soft text-warning` va h.k. (`Badge`).
- Ikki teng tanlov (masalan, "Ishchiman / Ish beruvchiman") bir xil ko'rinadi — biri yashil, biri ko'k bo'lmaydi.
- Tailwind palitrasi (`bg-violet-600`, `text-amber-300` …), hex rang (`bg-[#7c3aed]`) va komponent ichidagi gradient
  ishlatilmaydi — gradient va nur faqat §1.1 dagi tasdiqlangan utilitalar orqali.
- Uchinchi tomon belgisi o'z rangida faqat **ikonkada** qoladi (Telegram ikonkasi `#2AABEE`); tugmaning o'zi — bizning `Button`.
- Kontrast: barcha juftliklar ikkala mavzuda **≥ 4.5:1** (WCAG AA) — `src/lib/brand-contrast.test.ts` tekshiradi.

### 1.1 Premium qatlam (2026-10, egasining so'rovi bilan)

Egasi: "kirganda bron qilish mini-ilovasidek, tugmalar bo'rtib, yaltirab tursin, AI qidiruv qimirlab tursin, professional
bo'lsin". Shuning uchun "faqat tekis sirt" qoidasiga **nazoratli istisno** qo'shildi. Gradient, nur va harakat faqat
`globals.css` dagi tasdiqlangan utilitalarda yashaydi — komponentlarda xom gradient, hex yoki palitra rangi hali ham yo'q
(`brand-guard.test.ts` o'zgarmadi).

| Utilita | Qayerda | Qoida |
|---|---|---|
| `.hero-surface` | Bosh ekran sarlavhasi (ish qidiruvchi, ish beruvchi, mehmon), birinchi ochilishdagi brend kartasi, tanishtiruv ramkasi | Sahifada **bittadan**. Ustida faqat `text-hero-fg` / `text-hero-muted` (AA, `brand-contrast.test.ts`) |
| `.btn-3d` | `Button` (`default`), markaziy "E'lon" tugmasi, brend belgisi | Yuqorida yorug', pastda soya, rangli nur; bosilganda "botadi" |
| `.btn-light` | Ko'k sarlavha ustidagi asosiy amal ("Vakansiya joylash", "Ish qidiraman") | Ko'k sirtda ko'k tugma ko'rinmaydi — oq "bo'rtgan" tugma |
| `.shine` | Ekrandagi **eng muhim bitta-ikkita** amal: "E'lon", "Vakansiya joylash", "CV yaratish" belgisi | Har ~4 s da yorug' chiziq o'tadi; ko'p joyda ishlatilmaydi |
| `.ai-glow`, `.ai-twinkle`, `.type-caret` | Faqat "AI bilan qidirish" jonli qatori | Aylanuvchi rangli chegara (ko'k → binafsha → moviy) — AI ning yagona belgisi |
| `.badge-glossy .badge-{blue,violet,green,orange,rose,cyan,indigo,amber}` | Xizmatlar to'ri belgilari, rol kartalari, kirish ekrani belgisi | Rang **faqat belgida**; nom va izoh — oddiy matn tokenlari |
| `.tile-raise` | Xizmatlar to'ri, rol kartalari | Oq, yengil ko'tarilgan karta |
| `.nav-fab` | Pastki menyuning o'rtasidagi "E'lon" | Menyudan bo'rtib chiqadi (OLX/super-ilovalar uslubi) |
| `.hero-glass` | Sarlavha ustidagi ikkinchi darajali tugma ("Filtrlar", "Xodim qidiraman") | Shaffof oq |

- `prefers-reduced-motion` — yaltirash, aylanish, yozilib turish va ko'tarilib chiqish o'chadi (a11y testi).
- Yangi joyga gradient yoki nur kerak bo'lsa — avval shu jadvalga utilita sifatida qo'shiladi, keyin ishlatiladi.

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
- Balandlik 48 px, matn `text-base` (16 px — iOS fokusda sahifani kattalashtirmasin; R-C), label har doim ko'rinadi
  (placeholder label o'rnini bosmaydi). Qidiruv qatori — label o'rniga `aria-label` + `role="search"`.
- Xato matni: **nima bo'ldi + nima qilish kerak** ("Raqam to'liq emas: +998 va 9 ta raqam").
- Uzun placeholder tor ekranda qirqilmaydi — "…" bilan tugaydi (`Input` da `text-ellipsis`; R-F).

### Tanlov: `Checkbox`, `RadioItem`, `Switch`, `Chip`

- Checkbox — kvadrat (`rounded-xs`), radio — doira: ikkalasi farqlanadi (avval checkbox ham doira bo'lib chizilardi).
- Butun qator (label) bosiladi; kichik elementlarda `tap-target` (44×44).
- Matn ichida bo'lmagan alohida kichik havola (soha, "N ta ariza", karta sarlavhasi) ham boshqaruv: `tap-target relative`.
  Kengaygan maydon qo'shni havolani yopmasligi kerak — oraliq qoldiring (masalan, e'lon sahifasida soha qatori `mt-3`).
  `line-clamp`/`overflow-hidden` ichida maydon qirqiladi — qisqartirishni ichki `span` ga o'tkazing.
- Chip — filtr va ko'p tanlov; tanlangani `primary` fon + belgi.

### Vakansiya kartasi (`JobResultCard`) va nomzod kartasi (`WorkerResultCard`)

- Tartib: **nomi** → **maosh + to'lov davri** (`so'm/oy`, `/kun`, `/soat`, ` · ishbay`; maosh yo'q — "Kelishiladi", hech qachon
  "0 so'm") → kompaniya (belgi faqat `companies.verification_status = verified` bo'lsa) → hudud → amal, saqlash, sana.
- Belgilar 2 tadan ko'p emas (TOP bo'lsa — yana bitta): tajribasiz, jadval. Sig'maganlari butunlay yashiriladi — "T…" kabi
  kesilgan belgi bo'lmaydi.
- O'z arizasi bor bo'lsa — "Ariza yuborish" o'rniga holat ("Ariza: Ko'rib chiqildi", `bg-success-soft`), bosilsa — "Arizalar".
- Moslik foizi kartada yo'q; "Sizga mos ishlar" sababi matn bilan yoziladi ("Kasbingiz bo'yicha: Oshpaz · Toshkent").
- Maosh faqat `SalaryText` orqali: qator so'zlar orasida bo'linadi, raqam ("10 000 000") va birlik ("so'm/oy", "сум/мес")
  yaxlit qoladi. Faqat boshlang'ich maosh — "kamida 4 000 000 so'm" (`common.labels.salary_from`; o'zbekchada "dan" raqamdan
  oldin kelmaydi). Valyuta har tilning o'z yozuvida: so'm · сўм · сум · UZS (`formatMoney`) — R-F.
- Nomzod kartasida maosh — hamyon ikonkasi + summa, tajriba — qisqa ("3+ yil", "От 3 лет"); to'liq yozuv ("Kutilayotgan
  maosh: …", "Tajriba: …") ekran o'qigichi uchun `sr-only` va `title` da. Asosiy ma'lumot (nom, maosh, tajriba, tugma yozuvi)
  ru/oz/en da ham 360 px da "…" bilan kesilmasligi kerak — `i18n-fit.spec` (R-F).

### Filtr chiplari

- Tez filtrlar (bosh sahifa): `rounded-full border bg-card`, 44 px; telefonda bitta suriladigan qator (sahifa kengaymaydi).
- Faol filtrlar (natijalar): `bg-primary-soft/60 text-primary` + ✕, har biri alohida olib tashlanadi; 2 tadan ko'p bo'lsa —
  "Hammasini tozalash". Sarlavhada filtrlar takrorlanmaydi (faqat kasb · hudud).

### Belgi (`Badge`)

`default` neytral · `primary` yangi/ma'lumot · `success` joylandi/faol · `warning` tekshiruvda/muddat ·
`destructive` rad etildi/xato · `outline` xususiyat (yarim kun, masofaviy).

### AI yordamchi (`components/shared/ai-avatar.tsx`, `features/find/components/ai-chat.tsx`)

- **Yagona belgi** — `AiAvatar`: `bg-primary` plita + uchqun (`sm` 28 · `md` 36 · `lg` 48 px). Hamma AI joyida shu belgi:
  qidiruv yonidagi tugma, oyna sarlavhasi, suhbat, "AI bilan to'ldirish", mehmon bosh sahifasidagi bo'lim. "O'ylayapti"
  holatida (`busy`) atrofida yumshoq halqa (`.ai-orb`); boshqa bezak (gradient, porlash) yo'q.
- **Kirish nuqtalari:** qidiruv blokidagi "AI bilan qidirish" (belgi + matn, 44 px), kompyuterda bosh sahifa o'ng ustunida
  taklif kartasi (`variant="card"`), mehmon bosh sahifasida bo'lim va asosiy tugma (`variant="cta"`), bo'sh qidiruv natijasida,
  `/ai` sahifasi. Suzuvchi tugma yo'q.
- **Suhbat:** foydalanuvchi xabari — o'ngda `bg-primary`; yordamchi — chapda belgi + nom, matn `bg-secondary` pufakchada.
  Tushunilgani — chiplar ("Tushundim: Buxgalter · Toshkent shahri"), keyin soni va haqiqiy kartalar (faqat oxirgi javobda;
  oldingilari ixcham — "Natijalarni ochish"). Aniqlashtirish — `+ Kunlik`, `+ Tajribasiz`… (qo'llangani takrorlanmaydi).
- **Yozish maydoni** pastda (telefonda barmoq yetadigan joy): matn (Enter — yuborish), mikrofon (brauzer qo'llasa), yuborish.
  Ostida bir qator: "Faqat bazadagi haqiqiy e'lonlar. Qaror — sizniki." — soxta foiz yoki va'da yo'q.
- Suhbat shu tabda 30 daqiqa saqlanadi (e'lon ochilib "Orqaga" bosilsa yo'qolmaydi); "Yangi suhbat" — tozalash.

### Karta, oyna, bo'sh holat, yuklanish

- Karta: `rounded-2xl border bg-card shadow-sm`, ichki chegara 16–24. Ikonka plitasi — `bg-primary-soft text-primary`.
- Katta to'liq rangli karta (`bg-primary`, `bg-success` yuzali) ishlatilmaydi — to'liq rang faqat **tugmada** va sahifadagi
  bitta `.hero-surface` sarlavhada (§1.1). Ta'kidlangan
  bonus (AI yordamchi) — `bg-primary-soft` + `border-primary/25`, "PRO" belgisi `bg-primary`. Bosh sahifa testi buni tekshiradi.
- Bosh sahifa (R-C): birinchi ekranda qidiruv ("Kasb, lavozim yoki kompaniya"), tez filtr chiplari va haqiqiy e'lonlar;
  admin oynalari, e'lon berish va AI PRO — ro'yxatdan keyin ixcham qatorlar (rasm 48 px). Katta banner yo'q.
- Oyna (`Dialog`/`ConfirmDialog`): sarlavha + bir jumla izoh + "Bekor qilish" (outline) va amal tugmasi.
- Bo'sh holat (`EmptyState`): ikonka + nima uchun bo'sh + keyingi qadam tugmasi.
- Yuklanish: joyni egallaydigan `Skeleton` (sahifa sakramaydi); 30 s dan uzoq kutilmaydi (`callAction` → "Javob kechikdi").

## 5. Harakat, fokus, ovoz

- Bosilganda darhol javob: `.press` — `scale .97` 60 ms; qolgan o'zgarishlar (rang, soya, siljish) 200 ms,
  `--ease-std` (`cubic-bezier(0.4, 0, 0.2, 1)`). Ro'yxat paydo bo'lishi 150 ms, ketma-ket kechikishsiz.
- Kompyuterda (sichqoncha): asosiy tugma `.lift-sm` (1 px), bosiladigan karta `.lift` (2 px) ko'tarilib soya oladi.
- Sahifa o'tishi (K, operator paneli uslubi): yuqori panel va menyu joyida, kontent `page-enter` — 350 ms, 16 px pastdan;
  skeletdan keyin `page-swap` — 200 ms. Oddiy CSS animatsiya: bosishni bloklamaydi (C8.1b dagi View Transition EMAS).
- Oyna: parda 200 ms, oyna 300 ms (`zoom-in-95` + 10 px pastdan); bildirishnoma o'ngdan 350 ms + vaqt chizig'i;
  skelet — `skeleton-shimmer` (1,4 s).
- `prefers-reduced-motion` — barcha animatsiya va konfetti o'chadi.
- Klaviatura fokusi har elementda ko'rinadi (2 px `ring` + 2 px oraliq) — E2E tekshiradi.
- Avtomatik modal, majburiy tanishtiruv (tour) va ketma-ket toast yo'q — asosiy yo'l to'silmaydi (C8.2 da eski tur olib tashlandi).
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
| `e2e/specs/a11y.spec.ts` | 18 sahifa (shu jumladan `/dev/ui`, e'lon sahifasi, "Arizalarim", ish beruvchi vakansiyalari) × 5 kenglik: axe AA, gorizontal siljish, 24/44 px nishon; klaviatura fokusi; reduced-motion; **qorong'i mavzuda** 6 sahifa kontrasti |
| `e2e/specs/i18n-fit.spec.ts` | ru, 360 px: rejim tugmasi, nomzod maoshi va tajribasi kesilmaydi; "сум/мес" bo'linmaydi; "kamida …"; `<html lang>` BCP-47 |
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
