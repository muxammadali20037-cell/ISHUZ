# ISH TOPDIM — mahsulot auditi va ustuvor reja (2026-10-20)

**Kod holati:**
- branch `claude/gallant-thompson-q70fo3` (GitHub'dagi default branch);
- production — `main`, `84e8ba0`;
- oxirgi migratsiya avval 0067 edi, endi 0068.

**Stack:** Next.js 16.3 (app router, server actions), React 19.2, Tailwind 4, Supabase (Postgres + RLS, pg_cron, Storage), Telegram bot va Mini App, Gemini (zaxira sifatida Claude).

Har bandda tartib bir xil: **muammo → o'zgarish → sinov → natija → qolgan cheklov.** Dalil — fayl:qator va test.

## 1. Oldingi auditdagi 6 savol — hozirgi kod bo'yicha

| # | Savol | Holat (o'zgarishdan oldin) | Dalil | Endi |
|---|---|---|---|---|
| 1 | Telegram xabari yuborilganda `expires_at` tekshiriladimi? | **Qisman.** Moslik xabarida faqat `status`. `expire_vacancies` soatiga bir marta ishlaydi, shuning uchun muddati o'tgan e'lon ~1 soatgacha "active" turadi; dayjest (09:00) va qayta urinishlarda bu oyna yanada uzayadi. AI PRO xabari umuman qayta tekshirilmasdi. | `telegram-dispatch.ts` (eski :97, :213, :249); `0006:133-142` | ✅ Moslik va AI PRO: faol **va** muddati o'tmagan e'lon (`eligibility.ts`). Bloklangan foydalanuvchi o'tkazib yuboriladi. O'chirilgan AI PRO obunasi bo'yicha xabar yuborilmaydi. |
| 2 | Telegram xabarida maosh davri bormi? | **Yo'q.** "5 000 000 so'm" — oyiga yoki kuniga ekani noma'lum. Moslik xabarida "kamida" ham yo'qolardi. | `telegram-dispatch.ts:219`, `render.ts:199`, `cv-bot.ts:824` | ✅ "kamida 250 000 so'm/kun" — moslik, AI PRO, bot ro'yxati, kabinetdagi "Mos e'lonlar" (`formatSalaryWithPeriod`). |
| 3 | Kunlik va oylik maosh saralashda to'g'ri taqqoslanadimi? | **Yo'q.** `/jobs` "Maosh bo'yicha" xom summani taqqoslardi: 300 000/kun 5 mln/oy dan pastda. Filtr (`p_salary_min`) esa to'g'ri edi. | `0065:389` | ✅ Oylik ekvivalent (kunlik ×22, soatlik ×176). Kelishiladigan va ishbay — oxirida. |
| 4 | Moslik qidiruvi faqat eng yangi 300 ta e'lon bilan cheklanganmi? | **Ha.** Kirgan ishchining "Mos" ro'yxati 300 tadan oshmasdi, total ham 300 edi. Kesh yangilash — eng yangi 500 ta (soha bo'yicha). Bot — 200 ta. | `0065:357-358`, `0050:384-385`, `0027:37-38` | ✅ `/jobs`: ro'yxat kesilmaydi, son haqiqiy. Ball faqat 300 ta nomzod uchun hisoblanadi — avval ishchining sohasidagilar. ⚠️ Kesh (500) va bot (200) chegaralari qoldi — §4. |
| 5 | Kunlik ishlar — faqat `salary_type` filtrimi? | **Ha.** Ish sanasi, vaqti, kerakli odamlar soni, sig'im, ariza muddati yo'q. `positions_count` bor, lekin ariza/tasdiqlash uni tekshirmaydi. | `0066:138`, `0065:12-50` | ⏳ 6-bosqich: alohida jarayon (§4). |
| 6 | Backup Storage fayllarini ham qamrab oladimi, tiklash sinalganmi? | **Yo'q.** Faqat `pg_dump` (`public`, `auth`, `storage` sxemalari — fayllarning o'zi emas). Tiklash skripti bor, lekin production nusxasi hech qachon tiklanmagan. Zaxira yangiligi nazorati **birinchi kunidan** sintaksis xatosi bilan yiqilardi. | `backup.yml:68`, `db-backup.sh:15`, `backup-freshness.yml:27` | ✅ Nazorat tuzatildi + CI testi. ⏳ Storage zaxirasi va tiklash sinovi — 9-bosqich. |

## 2. Bu bosqichda topilgan va tuzatilgan boshqa xatolar

| Muammo | Oqibat | Tuzatish | Sinov |
|---|---|---|---|
| Moslikda maosh davri boshqa bo'lsa — 0 ball | Kunlik haqli doimiy ish oylik kutgan ishchiga hech qachon "mos" deb yuborilmasdi (eng ko'pi 85 < chegara 90) | "Noma'lum": 0,5 yoki 0,25, izohda taxminiy oylik ekvivalent. To'liq moslik deyilmaydi. | `salary_periods.test.sql` |
| Nomzod qidiruvida byudjet xom summa bilan taqqoslanardi | 300 000/kun so'ragan nomzod "5 mln/oy byudjetga mos" deb chiqardi | Ishchining davri bo'yicha oylik ekvivalent | `salary_periods.test.sql` |
| Muddati o'tgan (cron hali yopmagan) e'lon | Moslik keshi, navbat, saqlangan qidiruv xabari va kabinet tavsiyalariga kirardi | `expires_at` tekshiruvi qo'shildi | `salary_periods.test.sql` |
| Navbat: bot bloklanganda | Shu partiyada **yuborilgan** xabarlar ham "dead" bo'lib qolardi | Faqat yuborilmaganlari | kod ko'rigi |
| Navbat: jamlangan xabar | Urinishlar birinchi yozuv bo'yicha sanalardi | Eng ko'p urinilgani bo'yicha | kod ko'rigi |
| `backup-freshness.yml` | `"${latest:-yo'q}"` — bash sintaksis xatosi (exit 2). Nazorat 2026-10-12 dan beri hech ishlamagan | Tuzatildi, sana jq'da hisoblanadi | `workflow-scripts.test.ts` — barcha workflow skriptlari `bash -n` dan o'tadi, eski xato qayta tutiladi |

**Migratsiya 0068:**
- faqat mavjud funksiyalarni o'zgartiradi (aniq matnli yamoq; naqsh topilmasa — xato);
- jadval va ma'lumot o'chirilmaydi;
- eski ilova bilan mos (funksiya imzolari o'zgarmagan).

**Dalil:**
- 0068 siz: yangi SQL testning 16 tekshiruvidan **12 tasi FAIL**;
- 0068 bilan: barchasi **PASS**;
- mavjud 33 SQL test fayli ham o'tadi.

### Sinov natijalari (2026-10-20, lokal izolyatsiyalangan stend)

- **TypeScript va lint:** toza.
- **Unit:** 678 o'tdi, 18 skip (avvalgidek — tashqi xizmat kalitlari kerak bo'lgan testlar).
- **SQL:** 34 fayl o'tdi, shu jumladan yangi `salary_periods.test.sql` (0068 siz 12/16 FAIL, 0068 bilan 16/16 PASS).
- **E2E:** 202 dan 201 tasi o'tdi.
  - Yiqilgan bitta test: `flows.spec.ts:26` (til almashtirish). U avval ham barqaror emas edi (10 tadan 3 FAIL); bu safar 5 tadan 1 FAIL.
  - Ehtimoliy sabab: sahifa to'liq yuklanmasdan (hydration) til tanlansa, tanlov yo'qoladi. Bu sekin telefonda haqiqiy foydalanuvchi muammosi — 3-bosqichda (komponentlar) tuzatiladi.
- **CI tekshiruvi:** barcha workflow skriptlari `bash -n` dan o'tadi (yangi test).

## 3. Monitoring va tiklash — hozirgi holat (o'zgartirilmadi)

- **Yo'q:**
  - Sentry / APM;
  - `instrumentation.ts` (`onRequestError`);
  - `/api/health`;
  - 5xx va sekin SQL kuzatuvi;
  - kirish va ariza muvaffaqiyati metrikasi.
- **Bor:**
  - `/admin/queues` — navbatlar, Telegram, AI; faqat ochilganda yangilanadi, ogohlantirish yo'q;
  - AI xarajati va p95 (`/admin/analytics`);
  - xavfsizlik ogohlantirishlari (admin'ga Telegram).
- **Xato:** `trackServer("ai_find")` hodisasi ro'yxatda yo'q — jimgina tashlab yuboriladi.
- **RPO/RTO:** hujjatda RPO ≤ 24 soat, RTO ≤ 4 soat yozilgan. Production hajmida o'lchanmagan. Zaxiralar orasi amalda ~25 soatgacha.

## 4. Ustuvor reja (har bosqich ishlaydigan natija bilan yopiladi)

| Bosqich | Nima | Holat |
|---|---|---|
| 1 | Audit va o'lchov (shu hujjat) | ✅ |
| 2 | Biznes va xavfsizlik xatolari: Telegram tekshiruvlari, maosh davrlari, moslik havzasi, zaxira nazorati | ✅ kod va testlar. 0068 production'ga — egasining ruxsati bilan |
| 3 | Dizayn tizimi COBALT SUN: semantik tokenlar (#2457F5 / #FFC83D / #F6F8FC / #15213B), 4/8 spacing, typography 16/14/12, tugma holatlari (loading o'lchamni o'zgartirmaydi, dublikat yo'q), kontrast testi | navbatda |
| 4 | Ish qidiruvchi yo'li. Pastki menyu: **Ishlar · Saqlangan · Arizalar · Profil**; chat va bildirishnomalar — tepada. Suzuvchi AI tugmasi olib tashlanadi, AI qidiruv yonida. Birinchi ekranda haqiqiy vakansiya. Kartaning tartibi spec bo'yicha. Detail sahifada sticky "Ariza yuborish". Filtr/scroll saqlanadi. | navbatda |
| 5 | Ish beruvchi yo'li: "Bugun nima qilish kerak?" bosh sahifasi (nol kartalarsiz), 3 qadamli usta, qoralama tiklanishi, nomzodlar statusi | navbatda |
| 6 | Kunlik ishlar: ish sanasi va vaqti, kerakli odamlar soni, to'lov sharti, ariza muddati. "Ariza" va "tasdiqlash" alohida. Sig'im tranzaksiyada (`FOR UPDATE`): oxirgi o'ringa ikki kishi tasdiqlanmaydi. | navbatda |
| 7 | Qidiruv va AI: moslik keshi (500) va botdagi (200) chegaralar → kasb daraxti bo'yicha oldindan saralash; ikkinchi kasb (`worker_professions`); o'zbek/kirill/rus misollar to'plami bilan baholash | navbatda |
| 8 | Navbat, tezlik, yuklama: navbat holati (eng eski yozuv), indekslar EXPLAIN ANALYZE bilan, k6 profili izolyatsiyalangan muhitda | navbatda |
| 9 | Monitoring va tiklash: `onRequestError` va `/api/health`, Storage zaxirasi rejasi, production nusxasini izolyatsiyada tiklash sinovi va RTO o'lchovi | navbatda |
| 10 | Yakuniy qabul: 360–1440 px, WCAG 2.2 AA, ikki asosiy yo'l oxirigacha | navbatda |

**Kelishilishi kerak bo'lgan qarama-qarshilik.** 2026-10-19 da egasining so'rovi bilan rol **har kirishda** so'raladigan qilindi. Yangi topshiriqda esa: "Til, rol yoki hudud tanlovi qayta-qayta so'ralmasin" va "tanishtiruv karuseli bo'lmasin". 4-bosqichda rol faqat birinchi tashrifda so'raladi (va eslab qolinadi), almashtirish — Profil'dan. Shu yo'nalishni egasi tasdiqlashi kerak.
