# Universal ustalar — xizmat ko'rsatuvchi ustalar bozori

Sana: 2026-11-12 · Migratsiya: `0076_masters.sql` · Kod: `src/features/masters/`, `src/app/ustalar/`, `src/app/admin/(panel)/ustalar/`.

Ikki tomonlama bozor: **mijoz** ustani qidiradi, e'lon orqali qo'ng'iroq qiladi yoki so'rov yuboradi; **usta** o'z xizmati haqida
e'lon joylaydi va uni kabinetida boshqaradi. Doimiy ish vakansiyalaridan to'liq alohida (jadvallar, sahifalar, dizayn).

## 1. Sahifalar

| Manzil | Kim | Nima |
| --- | --- | --- |
| `/ustalar` | hamma | Bosh sahifa: sarlavha, qidiruv, 12 kategoriya (haqiqiy sonlar), eng ko'p e'lonli 3 kategoriyadan 4 tadan karta |
| `/ustalar/qidiruv` | hamma | Kategoriya chiplari, hudud, tajriba, tartib (yangi / reyting / tajriba), sahifalash. Oddiy GET forma — JS'siz ishlaydi |
| `/ustalar/[slug]` | hamma | E'lon: rasmlar, ism, xizmat, tajriba, hudud, ish vaqti, narx, sharhlar; bog'lanish (telefon yoki so'rov) |
| `/ustalar/elon` | kirgan | Yangi e'lon formasi |
| `/ustalar/elon/[id]` | egasi | Tahrirlash (rad sababi ko'rsatiladi) |
| `/ustalar/kabinet` | kirgan | Usta kabineti: e'lonlar, holatlar, statistika, mijoz so'rovlari |
| `/admin/ustalar` | admin (`vacancies.moderate`) | Moderatsiya navbati, demo e'lonlarni boshqarish |

Kirish nuqtalari (turkuaz rangda, boshqa bo'limlardan ajralib turadi): sayt menyusi (mehmon, kompyuter va telefon menyusi), kirgan
foydalanuvchining chap yon menyusi (kompyuter), ish izlovchi bosh sahifasidagi karta va "Kabinetim" sahifasidagi karta (telefonda
kirgan foydalanuvchi, ikkala rejim — u yerda yon menyu yo'q). Modul ichida o'z sarlavhasi (`MastersShell`): "Ish
topdim'ga qaytish", nom, qidiruv, "E'lon joylash", kabinet, til. Mavzu — `.theme-masters` (`globals.css`): faqat shu bo'lim ichida
`--primary` turkuaz (`#0f766e`, AA kontrast); asosiy sayt ko'k bo'lib qoladi.

## 2. Ma'lumotlar (0076)

| Jadval | Nima |
| --- | --- |
| `master_categories` | 12 xizmat turi (slug, 4 tilda nom, belgi) — ma'lumotnoma |
| `master_listings` | Usta e'loni: kategoriya, ism, sarlavha, tavsif, tajriba (yil), qo'shimcha xizmatlar, hudud, telefon + `phone_public` (rozilik), narx yoki "kelishiladi", ish vaqti, rasmlar (≤4), holat, rad sababi, `is_demo`, hisoblagichlar (ko'rish, telefon bosish), reyting |
| `master_requests` | Mijoz so'rovi: ism, telefon, xabar, holat (yangi → ko'rildi → bajarildi) |
| `master_reviews` | Sharh: 1–5 baho + matn; bitta foydalanuvchi bitta e'longa bitta (yangilanadi) |

Vakansiyalar (`vacancies`) bilan hech qanday umumiy jadval yo'q. Rasmlar vakansiya suratlari bilan bir xil xavfsiz quvurdan o'tadi
(karantin → serverda tekshirish va EXIF'siz WebP → `vacancy-photos/<egasi>/v-<sha256>.webp`); bazada ham yo'l tekshiriladi
(`master_photos_ok`) — begona yoki tekshirilmagan fayl yozilmaydi.

## 3. Qoidalar (baza darajasida — ilovani chetlab o'tib bo'lmaydi)

- **Moderatsiya.** `draft → pending_review → active | rejected`. `active` ni faqat admin qo'yadi (`master_moderate`, huquq
  `vacancies.moderate`). Egasi: yashirish/qaytarish (`active ↔ hidden`) — erkin; faol/yashirin/rad etilgan e'lon **mazmuni**
  o'zgarsa — avtomatik `pending_review` (trigger `trg_master_listing_owner_guard`). Telefon ko'rsatish roziligini o'zgartirish
  moderatsiya talab qilmaydi.
- **Telefon.** Ommaviy o'qish faqat `SECURITY DEFINER` funksiyalar orqali: ro'yxatda (`master_listings_public`) telefon ustuni
  umuman yo'q; e'lon sahifasida (`master_listing_public`) — faqat `phone_public = true` bo'lsa. Mehmon (`anon`) jadvalga kira
  olmaydi. Rozilik bo'lmasa mijoz faqat so'rov yuboradi. **Kartada raqamning o'zi yo'q** — faqat bog'lanish usuli: "Qo'ng'iroq
  qilish mumkin" (rozilik bor) yoki "Bog'lanish — so'rov orqali". Sabab: ro'yxat sahifalaridan raqamlarni ommaviy yig'ib olish
  (spam qo'ng'iroqlar) oldini olish va telefon bosishlarini hisoblash; vakansiyalardagi qoida (0074) bilan bir xil.
- **Reyting faqat haqiqiy sharhdan.** `rating_avg`/`rating_count` ni trigger hisoblaydi; egasi o'zgartira olmaydi, o'ziga sharh
  yoza olmaydi; mehmon yoza olmaydi; demo e'longa sharh yo'q. Soxta sharh yoki baho yaratadigan kod yo'q.
- **Hisoblagichlar.** Ko'rish va telefon bosish — `master_listing_hit`, faqat server kaliti bilan chaqiriladi: ilova IP + e'lon
  bo'yicha soatiga bir marta hisoblaydi, brauzerdan to'g'ridan-to'g'ri chaqirib sonni oshirib bo'lmaydi. Demo e'londa hisoblanmaydi.
  Kabinetdagi raqamlar — shu hisoblagichlar.
- **RLS.** Egasi faqat o'z e'lonlarini (barcha holatlarda) va ularga kelgan so'rovlarni ko'radi; admin — hammasini. So'rov va sharh
  jadvaliga to'g'ridan-to'g'ri yozib bo'lmaydi: so'rov — `master_request_create` (faqat server kaliti, ilova spam limitidan keyin),
  sharh — `master_review_add` (faqat kirgan foydalanuvchi). Mehmon chaqira oladigan funksiyalar faqat o'qish uchun (uchta) —
  `supabase/tests/security_hardening.test.sql` dagi ruxsat ro'yxatiga ongli qo'shilgan.
- **Spam.** So'rov: mehmon IP bo'yicha soatiga 10, kirgan 20; sharh 20; e'lon saqlash 60 (ilovada `allowRate`).

## 4. Demo e'lonlar

Egasi talabi bilan har kategoriyada **4 tadan** namuna e'lon (jami 48): `is_demo = true`, egasiz, **telefonsiz, reytingsiz,
suratsiz**, kartada va sahifada "Demo" belgisi, ostida "Demo ma'lumot. Haqiqiy ustalar telefon raqamlari tasdiqlangandan keyin
ko'rsatiladi." Demo e'longa qo'ng'iroq, so'rov va sharh yo'q; qidiruvda haqiqiy e'lonlar har doim demodan avval. Qidiruv
tizimlariga indekslanmaydi.

**Olib tashlash (bir bosish):** admin → *Universal ustalar* → **"Demo e'lonlarni olib tashlash"**. Yoki SQL Editor'da:

```sql
select public.master_demo_remove();   -- nechta o'chirilganini qaytaradi; haqiqiy e'lonlarga tegmaydi
select public.master_demo_seed();     -- qaytarish (yo'qlarini qo'shadi)
```

Maketdagi "4.9 (127 baho)", "Tasdiqlangan", "+998 90 123 45 67", "50 000+ mamnun mijoz", "100 % ishonchlilik" kabi yozuvlar
qo'yilmadi: bular soxta reyting, soxta raqam va o'lchanmagan statistika bo'lardi. Haqiqiy ustalar kelgach, shu joylarda haqiqiy
qiymatlar chiqadi (reyting — sharhlardan, telefon — rozilik bilan).

## 5. Prod'ga chiqarish

1. Kod `main` da — sahifalar bor, lekin **0076 qo'llanmaguncha** `/ustalar` "Bo'lim tayyorlanmoqda" holatida ochiladi (kategoriyalar
   ham shu migratsiyada), forma saqlanmaydi, admin sahifasi "0076 migratsiyasi qo'llanmagan" deb ko'rsatadi. Xato ekrani chiqmaydi;
   stendda jadvalni vaqtincha olib tashlab tekshirilgan.
2. Egasi: `docs/RELEASE_CHECKLIST.md` §3 — zaxira nusxa → **`supabase/prod/pending.sql`** (0069…0076 bitta faylda). Bittalab
   qo'llansa: 0069…0075 (hali qo'llanmagan) → **0076**. 0076 mustaqil (0069–0075 ga
   bog'liq emas: faqat prod'da allaqachon bor 0001–0068 dagi narsalarga tayanadi), lekin tartibni saqlagan ma'qul. Fayl takror ishga tushirilsa ham xato
   bermaydi; oxiridagi demo e'lonlar faqat birinchi o'rnatishda (jadval bo'sh bo'lsa) qo'shiladi.
3. Tekshirish: `CRON_SECRET=… npm run prod:check` → deep PASS; `/ustalar` da 12 kategoriya va 48 demo e'lon.
4. Qaytarish (favqulodda): `supabase/rollbacks/0076_masters.down.sql` — usta e'lonlari, so'rovlar va sharhlar o'chadi.

## 6. Testlar

- SQL (`supabase/tests/masters.test.sql`, 61 tekshiruv): RLS, holat o'tishlari, telefon maxfiyligi, rasm yo'li, sharh/reyting, demo,
  baza operatori (migratsiya/SQL Editor) yo'li.
- Vitest (`schema.test.ts`, 10): forma sxemasi, qidiruv parametrlari, xizmatlar ro'yxati.
- E2E (`e2e/specs/masters.spec.ts`, 5 ssenariy): katalog va demo; usta e'loni → moderatsiya → tasdiq → katalog → so'rov → sharh →
  statistika; rad etish va qayta moderatsiya, yashirish, o'chirish; xavfsizlik (begona e'lon, mehmon, admin sahifasi, HTML'da telefon
  yo'qligi); admin demo'ni olib tashlash va qaytarish. `a11y.spec.ts` ga 5 sahifa qo'shildi (kontrast, 44 px, siljish).
- Skrinshotlar: `docs/screenshots/masters-2026-11/` (`e2e/screens/masters.shots.ts`).

## 7. Keyingi qadamlar (egasi qarori)

- Usta **tasdiqlash belgisi** ("Tasdiqlangan") — hujjat tekshiruvi jarayoni kerak (kompaniya tasdiqlashiga o'xshash).
- Yangi so'rov haqida ustaga **Telegram xabari** (bot orqali) — hozir so'rov faqat kabinetda ko'rinadi.
- Kategoriyalarni admin panelidan tahrirlash (hozir migratsiya bilan).
- Ustalar uchun pullik "yuqoriga chiqarish" — to'lov tizimi yoqilgach.
