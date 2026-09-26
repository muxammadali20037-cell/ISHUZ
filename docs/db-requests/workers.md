# WORKERS moduli — so'rovlar va eslatmalar

Modul: `/workers`, `/workers/[id]`, `/employer/candidates`, `/employer/saved` (`src/features/workers`).
Hozirgi sxema va RPC'lar bilan to'liq ishlaydi; quyidagilar boshqa modullarga/egaga eslatma.

## Boshqa modullardan kutiladigan kontrakt (DB emas)
1. **Chat moduli** — `/messages/new?application_id=<uuid>` va `/messages/new?offer_id=<uuid>` marshrutlari.
   Nomzod sahifasidagi "Yozish" tugmasi mavjud ariza (menga yuborilgan, `withdrawn` emas) yoki taklif (`sent|viewed|accepted`) bo'lsa shu havolaga olib boradi;
   yangi taklif yuborilgach `?offer_id=<yangi id>` ga. Marshrut `get_or_create_conversation` ni chaqirib chatga redirect qilishi kutiladi.
2. **Onboarding** — `/onboarding/employer` (requireEmployer redirecti va `employer_only` bo'sh holatidagi CTA).
3. **Vacancies** — `/employer/vacancies/new` (bo'sh holatlar va taklif sheet'idagi CTA).

## Ixtiyoriy yaxshilanishlar (kerak bo'lsa)
- `next.config.ts` → `images.remotePatterns` ga Supabase Storage hostini qo'shish. Hozir portfolio rasmlari `<img>` bilan ko'rsatiladi
  (`next/image` remotePatterns'siz ishlamaydi). Qo'shilsa `portfolio-gallery.tsx` da `next/image` ga o'tish mumkin.
- `search_workers` da `p_salary_max` faqat `salary_min` ga qaraydi (`salary_expected` emas) — UI "Kutilayotgan maosh … gacha" deb ko'rsatadi;
  agar `coalesce(salary_min, salary_expected) <= p_salary_max` bo'lsa aniqroq bo'lardi.
- `getSkills()` (src/lib/reference.ts) 300 ta bilan cheklangan — ko'nikma tanlovida kategoriya bo'yicha + eng ko'p ishlatiladiganlar ko'rinadi;
  kam ishlatiladigan ko'nikmalar filtrga URL orqali (`skills=<uuid>`) kelsa nomi alohida `skills` so'rovi bilan olinadi.

## Yangi paket kerak emas.
