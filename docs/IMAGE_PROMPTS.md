# Rasmlar: qayerga, qanday rasm va generatsiya promptlari

Bu hujjat ilovadagi barcha rasm joylarini sanab chiqadi va har biri uchun tayyor prompt beradi. Texnik tafsilotlar (fayl
tekshiruvi, storage, kesh) — `ENTRY_MEDIA.md`.

## Qisqacha: nima qilish kerak

| # | Qayerga | Nechta | Kim qo'yadi | Majburiymi |
|---|---|---|---|---|
| A | **Admin → Kontent → Kirish ekranlari** (`/admin/entry`) | 5 | Siz, admin panelda | Tavsiya etiladi — eng ko'p ko'rinadigan joy |
| B | **Admin → Bosh sahifa → Rasmli oynalar** (`/admin/home`) | 6 (12 gacha) | Siz, admin panelda | Ixtiyoriy — rasm 48 px'da ko'rinadi |
| C | Havola ulashilganda chiqadigan rasm (OG, 1200×630) | 1 | Kod orqali | Hozir **yo'q** — qo'shish kerak (pastda) |
| D | Kasb rasmlari (kartalarda) | avtomatik | AI (Gemini), kod | Siz hech narsa qilmaysiz |
| E | Play Market (feature graphic, skrinshotlar) | bor | `docs/play-store/` | Faqat almashtirmoqchi bo'lsangiz |

Quyidagi joylarga rasm **kerak emas** (ataylab):

- vakansiya promo kartasi — shablon bo'yicha avtomatik chiziladi;
- soha ikonkalari va bo'sh holatlar — ikonka;
- avatar, kompaniya logotipi, ish joyi surati — foydalanuvchilar **o'zining haqiqiy** suratini yuklaydi. Bu joylarga AI rasm
  qo'yilmaydi.

Rasm yuklanmagan joyda sayt ichidagi oddiy brend tasviri chiqadi — sahifa bo'sh qolmaydi.

## Umumiy qoidalar (hamma rasm uchun)

- **Uslub:** haqiqiy, hujjatli fotosurat. Odamlar ish ustida, tabiiy holatda — kameraga qarab kulib turgan «stok» poza emas.
- **Muhit:** O'zbekiston — Toshkent ko'chasi, mahalla, do'kon, ustaxona, ofis, bozor, qurilish maydoni.
- **Yorug'lik:** kunduzgi yoki oddiy xona yorug'ligi. Neon, «kino» filtri, haddan tashqari kontrast yo'q.
- **Rang:** kiyim yoki fonda ko'k (brend rangi) bo'lsa yaxshi, majburiy emas.
- **Matn yo'q:** rasm ustiga matn, logotip, yozuvli peshtaxta qo'ymang — matn ekranning o'zida bor.
- **Kompozitsiya:** asosiy obyekt **markazda**, chetlarida bo'sh joy. Rasm ekranda burchaklari yumaloqlanib, ba'zi joyda
  kvadratga yaqin kesiladi.
- **Huquq:** haqiqiy surat bo'lsa — odamlarning roziligi. Begona brend logotipi, avtomobil raqami, hujjat matni
  ko'rinmasin. AI rasm ma'lum bir haqiqiy odamga o'xshamasin.
- **Fayl:** JPG, PNG yoki WebP, 4 MB gacha. Server o'zi WebP'ga o'tkazadi va metama'lumotni o'chiradi.

### Har bir promptga qo'shiladigan qism

Promptlar inglizcha yozilgan — rasm modellari uni yaxshiroq tushunadi. Quyidagi bloklarda sahna, uslub va «matn yo'q» qismi
allaqachon bor — blokni to'liq nusxalang. Nisbatni (4:3, 1:1, 16:9) generator sozlamasida tanlang (masalan, Midjourney'da
`--ar 4:3`).

**Taqiqlar (negative prompt maydoniga; maydon bo'lmasa — promptning oxiriga «Avoid: …» deb qo'shing):**

```text
3d render, cartoon, illustration, anime, CGI, plastic skin, airbrushed, overly smooth face, perfect symmetry,
glowing edges, neon lights, cinematic teal-orange grading, text, letters, numbers, watermark, logo, signage,
license plate, extra fingers, distorted hands, robot, holograms, floating UI elements, phone screen content
```

---

## A. Kirish ekranlari — `/admin/entry` (5 ta)

### A1. «Tanishtiruv 1 — ish topish» (`intro_jobs`)

- **Qayerda:** tanishtiruv 1-ekrani «Ish topish endi oson» (telefon va kompyuter) + **bosh sahifa, kompyuterda**, o'ngdagi
  yuqori karta «Ish izlovchi».
- **Nisbat:** 4:3, kamida 1200×900.
- **Kesilishi:** bosh sahifada 256×240 (deyarli kvadrat), pastki chap burchakda «Ish izlovchi» yozuvi turadi. Odam
  markazda bo'lsin, chap pastki burchak sokin bo'lsin.

```text
Documentary photograph, 4:3. A young Uzbek man in his early twenties with a backpack sits at a small street cafe table
in Tashkent, looking at his smartphone with a hopeful, focused expression while searching for a job. He is in the
center of the frame with generous empty space on both sides; the lower left corner is calm and uncluttered. Morning
daylight, shallow depth of field, city street softly blurred behind him. Shot on a full-frame camera, 35mm lens,
realistic skin texture, candid moment, slight film grain, true-to-life colors, everyday clothing. No text, no logos,
no readable signs.
```

### A2. «Tanishtiruv 2 — ishchi topish» (`intro_workers`)

- **Qayerda:** tanishtiruv 2-ekrani «Ishchi kerakmi?» + **bosh sahifa, kompyuterda**, o'ngdagi pastki karta «Ish beruvchi».
- **Nisbat:** 4:3, kamida 1200×900. Kesilishi A1 bilan bir xil — ikkala odam markazga yaqin tursin.

```text
Documentary photograph, 4:3. A friendly Uzbek small business owner in her forties talks with a young job candidate
across a wooden desk in a bright small office in Tashkent. She holds a tablet, both are seated and engaged in a real
conversation, the owner slightly closer to the camera. Both people are near the center of the frame so a square crop
keeps them; the lower left corner is calm. Natural window light, medium shot, full-frame camera, 35mm lens, realistic
skin texture, candid moment, slight film grain, true-to-life colors. No text, no logos, no readable papers or screens.
```

### A3. «Tanishtiruv 3 — mos imkoniyatlar» (`intro_ai`)

- **Qayerda:** tanishtiruv 3-ekrani «Sizga mosini o'zimiz topamiz».
- **Nisbat:** 4:3, kamida 1200×900.

```text
Documentary photograph, 4:3. A mechanic in a clean blue work uniform takes a short break in a car service workshop in
Tashkent and smiles while reading good news on his phone. Close-medium shot, subject centered, warm natural light from
an open garage door, tools softly blurred in the background. Full-frame camera, 50mm lens, realistic skin texture,
candid moment, slight film grain, true-to-life colors. The phone screen faces away from the camera. No text, no logos.
```

### A4. «Rol kartasi — ish qidiryapman» (`role_worker`)

- **Qayerda:** «Rolni tanlang» ekrani, 1-karta. Ekranda **96×96 px** ko'rinadi.
- **Nisbat:** 1:1, kamida 800×800. Yuz kadrning ~60% ini egallasin, fon oddiy bo'lsin — kichik o'lchamda ham tanilsin.

```text
Head-and-shoulders portrait, square 1:1. A young Uzbek woman in casual clothes, calm confident expression, looking
naturally at the camera, face filling most of the frame and centered. Plain light grey background, soft natural window
light from one side. Full-frame camera, 85mm lens, realistic skin texture with small imperfections, true-to-life
colors. No text, no logos, no jewelry brand marks.
```

### A5. «Rol kartasi — ishchi qidiryapman» (`role_employer`)

- **Qayerda:** «Rolni tanlang» ekrani, 2-karta, **96×96 px**.
- **Nisbat:** 1:1, kamida 800×800.

```text
Head-and-shoulders portrait, square 1:1. An Uzbek shop owner in his forties wearing a neat shirt, friendly professional
expression, standing in his small store, face centered and filling most of the frame. Background softly blurred with
plain shelves, no readable products. Soft natural light, full-frame camera, 85mm lens, realistic skin texture,
true-to-life colors. No text, no logos, no signage.
```

---

## B. Bosh sahifa oynalari — `/admin/home` (6 ta standart)

- **Qayerda:** ish izlovchi va ish beruvchi bosh sahifasida, e'lonlar ro'yxatidan keyin, «Tezkor bo'limlar» qatorlari. Har
  bir qatorda chapda **48×48 px** rasm (markazdan kvadrat kesiladi), yonida nomi va bir qator izoh.
- **Nisbat:** 16:9 (admin ko'rinishi). **Asosiy narsa markazdagi kvadratda bo'lsin** — chetlari kesib tashlanadi.
- **Maslahat:** 48 px'da mayda narsalar ko'rinmaydi. Bitta odam yoki bitta yirik narsa, oddiy fon, aniq siluet. Hozirgi
  o'rnatilgan tasvirlar ham yaxshi ishlaydi — bu bo'limga rasm qo'yish ixtiyoriy.
- Admin o'zi yangi oyna qo'shsa ham (12 tagacha) shu qoida amal qiladi.

| Oyna | Kimga | Sarlavha (uz) | Rasm g'oyasi |
|---|---|---|---|
| `jobs` | ish izlovchi | Endi o'zingizga mos ish topish oson | Yangi ish joyida mamnun yosh xodim |
| `daily` | ish izlovchi | Kunlik ishlar | Qo'lqopli ishchi quti ko'tarib turibdi |
| `near_jobs` | ish izlovchi | Yaqin atrofdagi ishlar | Mahalla ko'chasida piyoda ketayotgan odam |
| `workers` | ish beruvchi | Endi xodim topish oson | Turli kasbdagi 3 kishi yonma-yon |
| `near_workers` | ish beruvchi | Yaqin atrofdagi ishchilar | Asbob qutisi bilan uy eshigiga kelgan usta |
| `post_vacancy` | ish beruvchi | Ish e'loni bering | Kafe egasi peshtaxta ortida telefonda yozmoqda |

### B1. `jobs`

```text
Documentary photograph, 16:9, main subject inside the central square. A young Uzbek woman in a blue work apron smiles
on her first day at a bright modern cafe counter in Tashkent, chest-up, clearly separated from a softly blurred plain
background. Natural daylight, full-frame camera, 50mm lens, realistic skin texture, true-to-life colors. No text,
no logos, no signage.
```

### B2. `daily`

```text
Documentary photograph, 16:9, main subject inside the central square. A young Uzbek worker in work gloves and a plain
t-shirt carries a large cardboard box, strong clear silhouette, simple warehouse background softly blurred. Natural
daylight from a large door, full-frame camera, 35mm lens, realistic texture, true-to-life colors. No text, no logos,
no printed labels on the box.
```

### B3. `near_jobs`

```text
Documentary photograph, 16:9, main subject inside the central square. A young Uzbek man walks along a quiet
residential mahalla street in Tashkent toward a small neighborhood shop, seen from the side, trees and low houses
softly blurred. Morning daylight, full-frame camera, 35mm lens, true-to-life colors. No text, no signage, no license
plates.
```

### B4. `workers`

```text
Documentary photograph, 16:9, the three people fit inside the central square. Three Uzbek workers standing side by
side and looking confident: a builder in a hard hat, a cook in a white jacket and a shop assistant in a blue shirt.
Waist-up, plain light background, soft natural light, full-frame camera, 50mm lens, realistic skin texture,
true-to-life colors. No text, no logos, no badges.
```

### B5. `near_workers`

```text
Documentary photograph, 16:9, main subject inside the central square. An Uzbek electrician in his thirties with a
toolbox arrives at the gate of a house in a Tashkent mahalla, friendly expression, waist-up, background softly
blurred. Natural daylight, full-frame camera, 35mm lens, realistic texture, true-to-life colors. No text, no logos,
no house numbers.
```

### B6. `post_vacancy`

```text
Documentary photograph, 16:9, main subject inside the central square. An Uzbek cafe owner in her thirties stands
behind the counter of her small cafe and types on her phone, focused and calm, chest-up, interior softly blurred.
Warm natural light, full-frame camera, 50mm lens, realistic skin texture, true-to-life colors. The phone screen faces
away from the camera. No text, no menu boards, no logos.
```

---

## C. Ulashish rasmi (OG) — hozir yo'q

**Qayerda:** sayt havolasi Telegram, Facebook yoki boshqa joyda ulashilganda chiqadigan rasm (bosh sahifa va oddiy
sahifalar). Vakansiya va kompaniya sahifalarida o'z rasmi bor; umumiy sahifalarda esa hozir rasm chiqmaydi.

**Tavsiya:** bu rasm kod bilan qilinadi (`src/app/opengraph-image.tsx`): brend nomi, shiori va ko'k fon. AI rasm shart
emas — matn har doim aniq, o'qiladigan chiqadi.

Fon uchun foto ishlatilsa — 1200×630, chap yarmi matn uchun bo'sh:

```text
Documentary photograph, 1200x630 (1.91:1). On the right side, two Uzbek people shaking hands in a bright small office
in Tashkent, an employer and a new employee, medium shot. The left half of the frame is a calm, softly blurred light
wall, empty for a headline. Natural window light, full-frame camera, 35mm lens, true-to-life colors. No text,
no logos.
```

---

## D. Kasb rasmlari — avtomatik (siz hech narsa qilmaysiz)

- **Qayerda:**
  - ish va ishchi kartalari (qidiruv, bosh sahifa ro'yxatlari, saqlanganlar) — 48×48;
  - ishchi e'loni sahifasi — 64×64;
  - e'lon berishning tekshirish qadami — «Kasb tasviri».

  Haqiqiy surat (vakansiya surati yoki avatar) bo'lsa, o'shanisi chiqadi.
- **Qanday:** e'lon saqlanganda server shu kasb uchun bitta rasmni AI'dan (Gemini, 4:3) oladi, tekshiradi va saqlaydi.
  Har kasbga bir marta.
- **Kerakli sozlama:** Vercel env `IMAGE_GEN_API_KEY`. Bo'lmasa kartalarda kasb ikonkasi chiqadi.
- **Kod ichidagi prompt** (`src/lib/profession-images/prompt.ts`):

  ```text
  Create a professional, realistic occupation illustration for {profession}, specialization {specialization}.
  Show an adult professional performing a typical task in an appropriate workplace, with accurate tools, clothing
  and necessary safety equipment. Contemporary Uzbekistan context, clean composition, natural lighting,
  recognizable at small mobile card size. Consistent visual style across the collection. No text, letters, numbers,
  logos, watermarks or exaggerated luxury. This is an illustrative occupation image, not a portrait of the actual
  applicant or a photograph of the actual employer.
  ```

---

## E. Play Market

`docs/play-store/` da allaqachon bor:

- ikona 512×512;
- feature graphic 1024×500 (uz, ru);
- 6 ta skrinshot 1080×1920.

**Skrinshotlar** ilovaning haqiqiy ekranidan olinadi — Google qoidasi, AI rasm qo'yilmaydi.

**Feature graphic**ni almashtirmoqchi bo'lsangiz, fon uchun (matn va logotip keyin dizaynerda qo'shiladi):

```text
Documentary photograph, 1024x500. A wide view of a bright Tashkent street in the morning with a young Uzbek worker in
a blue jacket walking confidently toward the camera on the right third of the frame; the left two thirds are a calm,
softly blurred, slightly blue-tinted background left empty for a headline. Natural daylight, true-to-life colors.
No text, no logos, no signage.
```

---

## Hozir rasm qo'yib bo'lmaydigan joylar

Bu joylarda faqat o'rnatilgan tasvir bor, admin joyi yo'q. Kerak bo'lsa, admin joyi kod bilan qo'shiladi:

- ish izlovchi / ish beruvchi bosh sahifasidagi katta plitkalar («Kunlik ishlar», «Yaqin atrofda», «Barcha ishchilar») —
  16:9;
- «Siz nima qidiryapsiz?» tanlovi va noto'g'ri rejim ekrani — 16:9;
- mehmon bosh sahifasidagi «Sizga kerakli xodimni toping» ko'k bloki.

## Yuklashdan oldin tekshiring (AI rasm uchun)

- [ ] Barmoqlar, ko'zlar va tishlar tabiiy.
- [ ] Hech qayerda harf yoki «yozuvga o'xshash» chiziqlar yo'q (peshtaxta, kiyim, qog'oz, ekran).
- [ ] Teri haddan tashqari silliq emas, yorug'lik bir tomondan tushadi.
- [ ] Kvadratga kesilganda ham asosiy odam yoki narsa to'liq ko'rinadi.
- [ ] Rasm haqiqiy biror odamga (taniqli shaxsga) o'xshamaydi.

Shubha bo'lsa — boshqa variantni tanlang yoki haqiqiy surat oling.
