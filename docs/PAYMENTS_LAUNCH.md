# To'lovni ishga tushirish (5-bosqich) — tekshiruv ro'yxati

Kod tayyor: Payme Merchant API (`/api/payments/payme`) va Click SHOP API (`/api/payments/click`), hamyon, tariflar,
birinchi to'lov chegirmasi, Android va Telegram ichida sotilmaydi (`usePurchaseLock`), admin'da kunlik daromad hisoboti.
Holat mantiqi SQL'da (`0019_billing.sql`), sinovlar: `supabase/tests/billing.test.sql` (Payme/Click holatlari),
`src/app/api/payments/payme/route.test.ts` (JSON-RPC, fiskal chek), `e2e/specs/payments.spec.ts`, `tariffs.spec.ts`.

## 1. Ega olib keladi

| Nima | Qayerdan | Vercel env |
| --- | --- | --- |
| Payme kassa ID | business.payme.uz → kassa | `PAYME_MERCHANT_ID` |
| Payme kaliti (test va asosiy) | kassa → Sozlamalar → Kalit | `PAYME_KEY` (+ testda `PAYME_TEST=1`) |
| Click service_id, merchant_id, secret_key | Click merchant kabineti | `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` |
| IKPU (MXIK) kodi — 17 raqam | buxgalter, tasnif.soliq.uz | `PAYME_FISCAL_CODE` |
| Qadoq kodi (IKPU sahifasida) | buxgalter | `PAYME_FISCAL_PACKAGE_CODE` |
| QQS foizi (YaTT aylanma solig'ida — odatda 0) | buxgalter | `PAYME_FISCAL_VAT` |

Kalitlar faqat Vercel'ga (Production; sinov uchun Preview) — chatga yuborilmaydi.

## 2. Kabinetlarda manzillar

- Payme kassa → Endpoint URL: `https://<domen>/api/payments/payme`
- Click → Prepare URL va Complete URL: ikkalasi ham `https://<domen>/api/payments/click`

## 3. Fiskal chek

- **Payme:** `PAYME_FISCAL_CODE` va `PAYME_FISCAL_PACKAGE_CODE` qo'yilsa, CheckPerformTransaction javobida `detail` ketadi:
  bitta xizmat qatori (masalan «Ish topdim: vakansiya e'lonini joylash (Tezkor)»), narx tiyinda, soni 1, IKPU, qadoq
  kodi, QQS. Payme chekni ro'yxatdan o'tkazgach `SetFiscalData` yuboradi — tranzaksiya bo'lsa `success` qaytadi
  (chek havolasi Payme kabinetida; bizda saqlash — keyingi ish, migratsiya kerak).
  Kod noto'g'ri formatda bo'lsa (17 raqam emas) — detail yuborilmaydi, to'lov ishlayveradi.
- **Click:** fiskal ma'lumot alohida API orqali yuboriladi (merchant_user_id kerak) — kalitlar kelgach qo'shiladi.
  Hozircha Click'ni faqat chek masalasi buxgalter bilan hal bo'lgach yoqing.
- Hamyonni to'ldirish chekda «xizmatlar uchun oldindan to'lov» bo'lib chiqadi — buxgalter bilan tasdiqlang.

## 4. Sinov (Preview muhitida, `PAYME_TEST=1` va test kaliti bilan)

test.paycom.uz → kassa sinovi. Biz tekshirgan holatlar (SQL va route testlarida bor):
noto'g'ri kalit (-32504), noma'lum buyurtma (-31050), noto'g'ri summa (-31001), CheckPerform (allow + detail),
Create (takroriy — o'sha natija; band buyurtmaga ikkinchi tranzaksiya — -31099), Perform (takroriy — o'sha natija;
12 soatdan eski — -31008), Cancel (to'lanmagan — -1, takroriy — o'sha; bajarilgan — -31007), CheckTransaction
(sabab va vaqtlar), GetStatement, noma'lum tranzaksiya (-31003), SetFiscalData.
Click: imzo xato (-1), summa (-2, "50000.00" ham mos), noma'lum buyurtma (-5), begona tranzaksiya (-6),
takroriy Complete (-4). Click xatosi bilan kelgan Complete (masalan mablag' yetmasa) buyurtmani bekor qiladi (-9) —
SQL'da bor, sandbox'da tekshiriladi.

**Qaytarish:** to'langan (bajarilgan) xizmatni Payme orqali bekor qilish hozircha yo'q — Payme qoidasiga mos -31007
qaytadi (xizmat berilgan). Pul qaytarish kerak bo'lsa — Payme/Click kabinetidan va admin'da qo'lda. Avtomatik
qaytarish (TOP'ni o'chirish, hamyondan yechish) — kerak bo'lsa alohida ish.

## 5. Yoqish (ega ruxsati bilan)

1. Vercel Production: Payme (va tayyor bo'lsa Click) kalitlari, fiskal kodlar, `BILLING_ENABLED=true` → Redeploy.
2. Admin → Tezkor boshqaruv: «To'lov» yoqiladi (`billing_enabled`). E'lon joylash bepul qoladi (`listings_paid=false`),
   raqam ochish bepul (`contact_unlock_paid=false`) — sotiladi faqat TOP (Tezkor/Maksimal) va hamyon.
3. Ega bitta haqiqiy TOP xaridi qiladi: e'lon TOP'da, Admin → To'lovlar hisobotida ko'rinadi, Payme'da chek bor.
4. Birinchi hafta: Admin → To'lovlar har kuni; `get_runtime_errors` (Vercel) — `[payme]` / `[click]` xatolari.
