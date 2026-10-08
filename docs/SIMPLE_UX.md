# Sodda "Ish topdim" — murakkab joylar va ish rejasi

Maqsad: yoshi katta, texnologiyani yaxshi bilmaydigan odam ham mustaqil ishlata olsin.
Har ekranda bitta vazifa, keyingi qadam doim ko'rinib tursin.

## 1. Hozirgi holatda nima murakkab edi (kod bo'yicha tekshirilgan)

| Joy | Muammo |
|---|---|
| Birinchi kirish (`welcome-gate.tsx`) | Majburiy to'liq ekranli oyna: til → ism → rol. Sayt mazmuni ko'rinmaydi |
| Bosh sahifa (`landing-page.tsx`) | 2 ta karta + 12 ta soha + "qanday ishlaydi" + statistika + hudud/kasb havolalari. Qidiruv yo'li alohida ko'rinmaydi. Kirgan foydalanuvchi esa bosh sahifani umuman ko'rmaydi (darhol `/employer` yoki dashboardga yo'naltiriladi) |
| E'lon berish | Ikkala yo'nalish ham **avval kirishni** talab qiladi (`/onboarding/*` himoyalangan). Kiritilgan ma'lumot kirishdan keyin saqlanmaydi |
| Ishchi onboarding | 8 qadam (+ ko'rib chiqish). Ism **va** familiya majburiy. "Nima ish qila olasiz?" degan qisqa matn yo'q |
| Ish beruvchi | Avval alohida onboarding (tur → kompaniya formasi), keyin 10 qadamli vakansiya ustasi |
| Qidiruv | Ish qidirish ochiq (`/jobs`), ishchi qidirish faqat kirgan ish beruvchiga (`/workers`, `requireEmployer`). Matndan maqsad ("buxgalter kerak" / "ish kerak") aniqlanmaydi |
| Kartalar | Vakansiya va ishchi kartasida telefon ham, "Qo'ng'iroq qilish" tugmasi ham yo'q. Mehmon telefonni umuman ko'rmaydi |
| Vakansiya telefoni | Vakansiyada o'z aloqa raqami va uni ko'rsatishga rozilik yo'q |
| Hudud | Tuman shu viloyatga tegishliligi faqat ilova kodida tekshiriladi, bazada emas |
| Rasmlar | Haqiqiy AI rasm yaratish **yo'q**. Faqat matndan yasalgan reklama kartasi (`next/og`) bor. Kasb rasmlari yo'q |

## 2. Reja (bajarilish tartibi)

1. **Baza (`0047_simple_flows.sql`)**
   - `vacancy_contacts`: vakansiya aloqa raqami + ko'rsatishga rozilik, alohida jadvalda (raqam RLS bilan yopiq).
   - `vacancies.client_ref`: ikki marta bosish takroriy e'lon yaratmaydi.
   - Tuman → viloyat tekshiruvi trigger bilan.
   - `save_simple_worker_listing` va `save_simple_vacancy`: bitta tranzaksiyada saqlash. Natija haqiqiy holat bilan qaytadi: joylandi / to'lov kerak / tekshiruvda.
   - `simple_search_vacancies` va `simple_search_workers`: kasb + hudud + tuman, mehmonga ham ochiq. Telefon faqat egasi rozilik bergan bo'lsa qaytadi.
   - `profession_images` jadvali va `profession-images` bucketi, kunlik limit.
2. **Bosh sahifa**: 3 ta katta karta (ish qidiryapman / ishchi qidiryapman / qidirish) + ixcham "Kabinetim". Majburiy tanishtiruv oynasi olib tashlanadi, til tepada kichik tanlagichda.
3. **`/post/worker`**: 4 qadam — kasb → hudud → o'zingiz haqingizda → tekshirish. Qoralama brauzerda saqlanadi, kirishdan keyin shu qadamga qaytadi.
4. **`/post/vacancy`**: 4 qadam — mutaxassis → hudud → ish haqida → tekshirish.
5. **`/search`**: ish/ishchi tanlovi + matnli qidiruv (maqsadni aniqlash) → kasb → viloyat → tuman → natijalar. Qo'ng'iroq tugmali kartalar, bitta "Filtr", bo'sh natijada aniq tugmalar.
6. **Kasb rasmlari**: har bir kasb uchun bir marta yaratiladi va saqlanadi, fonda ishlaydi. Kalit va limit bo'lmasa soha ikonkasi chiqadi.
7. **Kabinetim**: e'lonlarim (o'zgartirish, "Ish topdim" / "Ishchi topdim"), xabarlar, arizalar, sozlamalar.
8. Tarjimalar (uz, oz, ru, en), testlar, lint, typecheck, build, brauzerda 360/390/430/768/1440 px tekshiruvi.

Eski sahifalar (`/onboarding/*`, `/employer/vacancies/new`, `/jobs`, `/workers`, profil tahrirlash) o'chirilmaydi — batafsil tahrirlash uchun qoladi. Asosiy kirish yo'llari esa yangi sodda sahifalarga olib boradi.

## 3. Nima qilindi (2026-10-08)

| Qism | Fayllar |
|---|---|
| Bosh sahifa: 3 karta + ixcham "Kabinetim" | `src/features/landing/home-three.tsx`, `src/app/page.tsx` |
| Navigatsiya: Bosh sahifa · Qidirish · Kabinetim; ixcham til tanlagich; majburiy tanishtiruv olib tashlandi | `src/components/shared/app-shell.tsx`, `top-bar.tsx`, `language-switcher.tsx`, `src/app/layout.tsx` |
| "Ish qidiryapman" (4 qadam) | `src/app/post/worker`, `src/features/post/components/worker-post.tsx` |
| "Ishchi qidiryapman" (4 qadam, tahrir `?edit=`) | `src/app/post/vacancy`, `src/features/post/components/vacancy-post.tsx` |
| Qoralama (localStorage) + qadam URL'da + kirishdan keyin qaytish | `src/features/post/use-draft.ts`, `src/proxy.ts` (`next` so'rovi saqlanadi), `/auth?phone=` |
| Saqlash (bitta tranzaksiya, haqiqiy holat, takroriy bosishdan himoya) | `supabase/migrations/0047_simple_flows.sql` → `save_simple_worker_listing`, `save_simple_vacancy` |
| Qidirish: ish/ishchi → kasb → viloyat → tuman → natija; matndan maqsad | `src/app/search`, `src/features/find/*` (`intent.ts` — "kerak"/"ish kerak"/ruscha) |
| Kartalar: rozilik bo'yicha telefon + `tel:` | `src/features/find/components/result-cards.tsx`, `simple_search_*`, `simple_vacancy_phone` |
| Ishchi e'loni sahifasi (mehmonga ochiq) | `src/app/listing/[id]` → `simple_worker_listing` |
| Kabinetim: e'lonlarim, o'zgartirish, "Ish topdim" / "Ishchi topdim", to'lov | `src/app/cabinet`, `src/features/cabinet/*` |
| Kasb rasmlari: bir marta yaratiladi, fonda, limit bilan, ikonka zaxira | `src/lib/profession-images/*`, `/api/cron/profession-images`, `profession_images` jadvali |
| Tuman ↔ viloyat tekshiruvi (bazada) | trigger `trg_check_district_region` |

## 4. Tekshirilgan

- SQL: `supabase/tests/simple_flows.test.sql` (45 ta tekshiruv) + barcha eski testlar.
- Unit: maqsadni aniqlash, URL holati, rasm so'rovi shabloni.
- Brauzer (Playwright):
  - mehmon e'lon to'ldiradi, joylashda kirishga yo'naltiriladi, kirgandan keyin 4-qadamga barcha javoblar bilan qaytadi;
  - sahifani yangilash va "orqaga" javoblarni yo'qotmaydi;
  - ish beruvchi e'loni: ikki marta bosish bitta e'lon yaratadi, tahrirlash va qayta joylash ishlaydi;
  - qidiruv: "Buxgalter kerak" → ishchilar, "Buxgalterlik bo'yicha ish kerak" → vakansiyalar, "Toshkentda haydovchi kerak" → Toshkent shahri tanlangan;
  - viloyat tanlanganda faqat uning tumanlari chiqadi;
  - natijada `tel:` havolasi bor, bo'sh natijada "Butun viloyatda qidirish" chiqadi;
  - "Ish topdim" ishlaydi;
  - 360/390/430/768/1440 px va 130% shriftda gorizontal siljish yo'q.
- Kasb rasmi: soxta provayder bilan to'liq zanjir sinaldi (so'rov → saqlash → `ready` → kartada ko'rinish). Haqiqiy Gemini kaliti bilan **sinalmagan**.

## 5. Tashqi sozlamalar (siz qilishingiz kerak)

- `IMAGE_GEN_API_KEY` (Google AI Studio, matnli AI kalitidan alohida). Ixtiyoriy: `IMAGE_GEN_MODEL` (standart `gemini-2.5-flash-image`).
  Kunlik limit: admin → Sozlamalar → `profession_images_daily_limit` (standart 30). O'chirish: `profession_images_enabled = false`.
- Soatlik vazifa `ishuz-profession-images` uchun mavjud `ishuz_app_url` va `ishuz_cron_secret` vault sirlari ishlatiladi.
