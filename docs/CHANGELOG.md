# O'zgarishlar jurnali

## 2026-11-18 · Telegram birinchi o'rinda: Mini App havolalari, kanalga obuna (`claude/telegram-first`)

Ega: "endi 1-o'rinda Telegram mini app va Telegram kanaldan foydalanamiz — obunachi va foydalanuvchi yig'ishimiz kerak".

- **Kanal postidagi tugma → Mini App.** `t.me/<bot>?startapp=…` (`src/lib/telegram/start-param.ts`: `/jobs/<slug>` →
  `j_<slug>`, e'lon/ishchi — `l_`/`w_` + uuid, boshqasi — `p_` + base64url; ≤ 64 belgi, faqat ichki yo'l). Ilova ochilganda
  `TelegramStartRoute` kerakli sahifaga o'tadi (bir ochilishda bir marta). Faqat BotFather'da asosiy Mini App yoqilib,
  Vercel'da `TELEGRAM_MAIN_APP=1` bo'lsa; aks holda — avvalgidek sayt havolasi. Rasm — saytdan.
- **Kirish sahifasi:** «Telegram orqali kirish» birinchi va asosiy (ko'k); telefon — ikkinchi.
- **Kanalga obuna:** bosh sahifa menyusida «Telegram kanalimizga obuna bo'ling — har kuni yangi ishlar» (rangsiz qator;
  Mini App ichida Telegram'ning o'zida ochiladi; `channel_cta` hodisasi). Bot menyusi: «📱 Ilovani ochish» birinchi qatorda,
  oxirida «📢 Kanalga obuna bo'lish».
- Testlar: start-param (vitest), kanal tugmasi Mini App rejimida, E2E `telegram-startapp.spec.ts`, bosh sahifadagi kanal qatori.
## 2026-11-17 · Prod baza: 0079–0081 qo'llandi (`claude/pending-applied-81`)

Ega pending.sql ni (CRLF tuzatishidan keyin) qo'lladi. `APPLIED_UNTIL = 81` — pending.sql endi bo'sh (faqat holat
jadvali). `/api/health?deep=1` tekshiruviga 0079 (`channel_posts`), 0080 (`public_tariffs`), 0081
(`worker_listing_phones`) qo'shildi; 0078 — faqat ma'lumot, tekshiradigan obyekt yo'q.

## 2026-11-17 · pending.sql — Windows SQL Editor'da 0081 xatosi tuzatildi (`claude/pending-crlf-fix`)

Ega pending.sql ni ishga tushirganda: "0081: save_simple_worker_listing naqsh #1 0 marta uchradi". Sabab: SQL Editor
(Windows) faylni CRLF qatorlar bilan yuboradi, 0081 yamog'idagi naqshlar esa `\r` dan tozalanmagan edi (0057 da bu bor
edi). Bitta tranzaksiya bo'lgani uchun bazada hech narsa o'zgarmagan. Tuzatildi: naqshlar ham LF ga keltiriladi (rollback
ham). `scripts/prod-pending-test.sh` endi pending.sql ni CRLF ko'rinishida ham ikki marta qo'llab tekshiradi.

## 2026-11-17 · E'londagi telefon — qo'lda, majburiy, "+ Yana raqam" (`claude/post-phone-manual`)

Ega: "telefon raqamini qo'lda kiritsin, kiritmasa e'lon berilmasin; 2 ta nomer bo'lsa — «yana nomer»; nomer majburiy,
profildagi nomer emas — boshqa nomer joylasin, xohlasa profildagini, lekin qo'lda yozilsin".

- **Oyna (/ai/post):** telefon maydoni hamma uchun bo'sh ("+998") — hisobdagi raqam oldindan qo'yilmaydi va "Tasdiqlangan"
  qutisi yo'q. Raqam yozilmasa — "Telefon raqamini to'liq yozing." va e'lon ko'rinishiga o'tmaydi. "+ Yana raqam" —
  ixtiyoriy ikkinchi raqam (chala yozilsa — xato, "×" bilan olib tashlanadi; birinchisi bilan bir xil bo'lsa — saqlanmaydi).
  E'lon ko'rinishida raqamning o'zi ko'rsatilmaydi — "Siz yozgan (ikkala) raqam e'londa ko'rinadi".
- **E'lon sahifasi:** kirgan foydalanuvchiga qo'lda yozilgan raqam (hisob raqami emas) va bo'lsa "Qo'shimcha raqam";
  egasiga — "E'londagi raqam: …". Mehmon va ro'yxatlar — avvalgidek telefonsiz (0074 limiti ham o'sha).
- **Hisob raqami** (kirish uchun) o'zgarmaydi va uning ko'rinish sozlamasiga tegilmaydi. Hisobida raqami yo'q (Telegram
  orqali kirgan) foydalanuvchi ham qo'lda yozilgan raqam bilan joylay oladi — vakansiyadagidek.
- To'liq forma (/post/worker, kabinetdan tahrirlash) avvalgidek: u bilan saqlansa e'lon yana hisob raqamiga qaytadi.
- **Baza — 0081** (`worker_listing_phones`, `save_simple_worker_listing` yamog'i, `simple_worker_listing` + `phone2`):
  `supabase/prod/pending.sql` ga qo'shildi. Qo'llanmaguncha oyna ishlaydi, lekin e'londa hisob raqami ko'rinadi.

## 2026-11-17 · E'lon rasmi — kanalga va e'lon egasiga (`claude/post-image-everywhere`)

Ega: "shunga o'xshab kelsin — e'lon joylandimi, shunaqa rasm bo'lib kelsin" (vakansiya kartasi rasmi) → "ikkalasi ham".

- **Kanal:** ishchi e'lonlari ("o'zim haqimda") ham vakansiyadek rasm bilan chiqadi — `/api/promo/worker/<id>`
  (1200×800): "ISHCHI · ish qidiryapti" yorlig'i, kasbi, tajribasi, joyi, kutilayotgan maosh. Ism, telefon, rasm va erkin
  matn yo'q; faqat ommaviy e'lon (aks holda 404). Rasm ketmasa — avvalgidek matn.
- **E'lon egasiga:** e'lon ommaga chiqqach (oxirgi 24 soat), bot orqali "✅ E'loningiz joylandi!" — o'sha rasm bilan va
  "E'lonlarimni ko'rish" tugmasi (ilovani Telegram ichida ochadi). Har e'lon — bir marta; bot ishga tushirilmagan yoki
  muallif bloklangan bo'lsa — yuborilmaydi. Kanal sozlamasidan qat'i nazar ishlaydi; kanalga avtomatik e'lon bilan bir
  navbatda (`channel_posts`, `chat_id = "dm:<telegram id>"` — admin sahifasida kanal yozuvlari bilan aralashmaydi).
- Ikkalasi ham 0079 (`channel_posts`) qo'llangan bo'lishini talab qiladi (`supabase/prod/pending.sql`).

## 2026-11-17 · Bo'limlarda Universal ustalar — ko'k (`claude/menu-masters-blue`)

Ega: "faqat ustalarni ko'k rang bilan ajratib qo'y". "Bo'limlar"da faqat Universal ustalar qatorining belgisi (och ko'k
quti, ko'k belgi) va nomi ko'k; qolganlari rangsiz.

## 2026-11-17 · "E'lonlarim" — ixcham kartalar (`claude/my-listings-compact`)

Ega: "e'lonlarimdagi juda katta, tushunarsiz — tartibga keltir, soddalashtir".

- Har bir e'lon — kichik karta: nomi va joyi (bosilsa e'lonning o'zi ochiladi, "›"), kichik holat belgisi va bir qatorda
  kichik tugmalar: "O'zgartirish" va "Ishga joylashdim" / "Ishchi topdim" (vakansiyada — "Arizalar: N"; kerak bo'lsa
  "To'lash"). Guruh nomlari oddiy kichik yozuv ("O'zim haqimda e'lon", "Vakansiyalarim", "Usta e'lonlarim").
- Olib tashlandi: katta "Batafsil" va "Mos ishlar / Mos ishchilar" tugmalari, xabarnoma obunasi bloki (Profil →
  "Telegram xabarnomalari" va bosh sahifadagi "Sizga mos ishlar" bor). Profildagi "Mening e'lonlarim" ham shunday.

## 2026-11-17 · "E'lonlarim" va "Yangi ishlar" — alohida sahifalar (`claude/home-rows`)

Ega: "yangi ishlarni bossa — yangi joylangan e'lonlar ichiga kirsin, o'sha oynada ochilmasin; tepasida e'lonlarim tursin —
bossa o'zi joylagan e'lonlar ichiga kirsin, holatlarini ko'rsin".

- Bosh sahifa (kirgan, telefonda): "E'lonlarim" qatori (son — o'zi haqidagi e'lon, vakansiyalar va usta e'lonlari), ostida
  "Yangi ishlar" qatori — endi yig'ilgan ro'yxat emas, havola: `/jobs?sort=newest` (hudud bilan; "Sizga mos ishlar" — kasb
  bo'yicha natijalar). Kompyuterda va mehmonda ro'yxat avvalgidek shu yerda. Qatorlar rangsiz ("Bo'limlar" bilan bir xil).
- Yangi sahifa **/cabinet/elonlar** — "E'lonlarim": o'zi haqidagi e'lon, vakansiyalar va usta e'lonlari, har birining
  haqiqiy holati va amallari (Profildagi "Mening e'lonlarim" bilan bir xil komponent — `MyListingsSection`); bo'lmasa —
  "E'lon joylash". Mehmon — kirishga.

## 2026-11-17 · Bosh menyu rangsiz (`claude/menu-neutral`)

Ega: "bosh menyudagi ranglar umuman yoqmayapti — rangni olib tashla".

- "Bo'limlar": belgilar bir xil kulrang qutida, nomlar bir xil (qora) rangda — Universal ustalar (yashil) va Yordamchi
  (to'q sariq) ham; "yangi" nuqtalari yo'q. Eng tagidagi "Ish beruvchiga o'tish" — qizil emas, boshqa qatorlar kabi.
  Kompyuterdagi chap yon menyu o'zgarmadi.

## 2026-11-17 · Bosh qism: sarlavha bitta qatorda, tashqi karta yo'q (`claude/hero-oneline`)

Ega: "«Qanday ish qidiryapsiz» yozuvini kichraytir — bitta qatorga sig'sin; oyna ustida oyna turibdi — olib tashla".

- Sarlavha o'lchami bosh qism kengligiga qarab (`cqw`): telefonda (320–412 px) "Qanday ish qidiryapsiz?" / "Qanday xodim
  kerak?" bitta qatorda (kirillchada ham); kompyuterda — eng ko'pi 3–3.5 rem.
- Tashqi oq karta (chegara, fon, soya) olib tashlandi — qidiruv maydoni va "+ E'lon joylash" sahifaning o'zida.

## 2026-11-17 · Bosh sahifa tartibi (`claude/home-tidy`)

Ega: "bosh sahifa umuman yoqmayapti — tartibsiz: pastda bor ishlar, arizalar, xabarlar, profil; profildagi sozlamalar bosh
sahifada ham bor — chalkash; e'lon berish juda katta; orqasidagi ikonka bo'rtib turibdi; hamma narsa tiqilmasin, kerakli
narsalar tursin, Universal ustalar tursin". Taklif chizib ko'rsatildi (Design kanvas), ega ma'qulladi.

- **"Bo'limlar" — faqat 6 ta qator** (boshqa joyda yo'q yo'llar): Universal ustalar, Yordamchi, Kunlik ish, Masofaviy ish,
  Tajriba talab qilinmaydigan ishlar, Yaqin atrofdagi ishlar (ish beruvchida: … Kunlik/Masofaviy/Tajribali/Yaqin atrofdagi
  ishchi). Olib tashlandi: Barcha vakansiyalar / Barcha nomzodlar (pastki menyu), arizalar, xabarlar, profil (pastki
  menyu), saqlanganlar, sozlamalar, yordam (Profil — "Yordam" Profil ro'yxatiga qo'shildi), "Ishlar xaritada" ("Yaqin
  atrofdagi ishlar" sahifasida xarita havolasi bor). Bo'limlar endi o'qilmagan sonlarni so'ramaydi.
- **Bosh qism:** "+ E'lon joylash" / "+ Vakansiya joylash" — ingichka (44 px), och ko'k; ko'k nur, 👋 va izoh qatori olib
  tashlandi.
- **Yuqori panel:** ish izlovchida telefonda xabar belgisi yo'q (pastki menyuda "Xabarlar" bor); ish beruvchida qoladi.

## 2026-11-17 · Soddalashtirish 2 (`claude/simplify-2`)

Ega: "kunlik ish, masofaviy, tajriba — hammasini bo'limlarga qo'sh; eng tepada Universal ustalar, keyin Barcha vakansiyalar…
hammasi bir qatorda; «O'zingizga mos ishni qidiring», «Topish» o'rniga «Izlash»; oila shifokori — noto'g'ri chiqdi; oylik
maosh kerak emas; ish beruvchi panelini ham sodda qil; birinchi kirishda kunduzgi rejim; mehmonlarda Xabarlar o'rniga
Sohalar; profil juda chalkash — Mening dunyom, O'zim haqimda e'lon, Yordamchi, Universal usta kerak emas".

- **Bosh sahifa — "Bo'limlar":** 4 ta tez yo'l plitkasi olib tashlandi, ular bo'limlarga ko'chdi. Tartib (ish izlovchi):
  Universal ustalar → Barcha vakansiyalar → Yordamchi → Kunlik ish → Masofaviy ish → Tajriba talab qilinmaydigan ishlar →
  Yaqin atrofdan → xarita, arizalar, saqlanganlar, xabarlar, profil, sozlamalar, yordam. Ish beruvchida: Universal ustalar →
  Barcha nomzodlar → Yordamchi → Kunlik/Masofaviy/Tajribali/Yaqin atrofdagi ishchi → … "E'lon joylash" bo'limlardan olib
  tashlandi (tepada katta tugma). Hammasi bitta ustunda, uzun nomlar qisqartirilmaydi. Mehmon ham ko'radi (shaxsiy
  bo'limlarsiz).
- **Qidiruv maydoni:** "O'zingizga mos ishni qidiring..." (ish beruvchida — "...xodimni..."), tugma — "Izlash".
- **Tushunish:** kasb nomi aytilgan so'zlarga qanchalik to'liq mos kelishi hisobga olinadi — "men oila shifokoriman" →
  "Oilaviy shifokor" (avval "Oila huquqi yuristi").
- **Qidiruv oynasi:** "Oylik maosh qancha bo'lsin?" savoli olib tashlandi (faqat "Qanday ish?" va "Qaysi hududda?").
- **Ish beruvchi paneli:** tez yo'llar, "AI bilan oson joylash" kartasi va ikkinchi tugma o'rnida — bitta katta
  "+ Vakansiya joylash" (yordamchi bilan); qolgani "Bo'limlar"da.
- **Mavzu:** birinchi kirishda — kunduzgi (telefon tungi rejimda bo'lsa ham). Tungi yoki "Tizim" — faqat sozlamalarda tanlansa.
- **Mehmonning pastki menyusi:** "Xabarlar" o'rnida "Sohalar" (kirganlarda o'zgarmagan). **/sohalar** — har bir soha
  qator bo'lib, eng ko'p ish o'rni bor soha tepada, ostida "N ta ish o'rni" (haqiqiy faol vakansiyalar; xato bo'lsa son
  ko'rsatilmaydi).
- **Profil:** "Mening dunyom", "O'zim haqimda e'lon berish", Yordamchi va Universal ustalar kartalari olib tashlandi;
  "Faoliyat"/"Hisob" yig'ilgan guruhlari o'rnida — bitta oddiy ro'yxat, oxirida "Hisobdan chiqish". Eski `/dunyo`
  havolasi — Profilga. Bazadagi tanlangan qiziqishlar (`profile_interests`) o'chirilmadi.

## 2026-11-17 · Qidiruv tezroq (`claude/search-speed`)

Ega: "hammasi tezlik bilan bo'lsin, qulay, sodda bo'lsin".

- **Oldindan qidiruv:** yordamchi oynasi ("Qanday ish?", "Qaysi hududda?") ochilishi bilan standart javoblar bo'yicha natija
  so'raladi (hech narsa saqlanmaydi, statistikaga yozilmaydi; alohida limit). "Qidirish" o'zgarishsiz bosilsa va e'lon
  topilgan bo'lsa — natija darhol (sinovda, bazagacha 60 ms kechikish bilan: 420 ms → 70 ms). Topilmasa — haqiqiy qidiruv
  ("so'rovingiz saqlandi" va o'xshashlar faqat unda).
- **Kamroq ketma-ket so'rov:** kasb oldindan tushunilgan bo'lsa qidiruv kasb ma'lumoti bilan bir vaqtda; "shunga yaqin
  ishlar" variantlari va qidiruvni saqlash — parallel; "Aynan qanday o'qituvchisiz?" variantlari — bitta so'rov bilan
  (avval ~9 ta); e'lon oynasidagi ism va telefon — tushunish bilan bir vaqtda.
- **AI tushunish:** qidiruv so'rovini tushunishda tezkor model (`claude-haiku-5-5`, `ANTHROPIC_FAST_MODEL` bilan
  almashtiriladi) va 4 soniya chegara (avval 8) — oshsa, lug'at qoidalari bilan davom etadi.

## 2026-11-17 · Usta e'loni — oynama-oyna, darhol joylanadi (`claude/masters-wizard`)

Ega: "Ustalar e'lon joylashda: kategoriyani tanladi — ikkinchi oyna, xizmatini tanlasin; keyin ism-familiya; keyingi
oynada hudud va telefon; narx ham, ish vaqti ham kerak emas; ish namunalari rasmi; «E'lon joylash»; moderatsiya kerak
emas — to'g'ridan-to'g'ri joylansin va kategoriyasiga olib borsin".

- **/ustalar/elon** — 5 oyna: 1) "Qanday ustasiz?" (katta plitkalar) → 2) "Qaysi ishlarni qilasiz?" (kategoriya
  xizmatlari ro'yxati + "Boshqa xizmat") → 3) ism, familiya → 4) hudud, tuman, telefon → 5) ish namunalari (ixtiyoriy) →
  "E'lon joylash". `?k=<kategoriya>` bilan — xizmatdan boshlanadi. Tahrirlash (`/ustalar/elon/[id]`) — avvalgi to'liq forma.
- **Darhol joylash** (`publishMasterQuick`): sarlavha va tavsif faqat tanlanganlardan ("Santexnik: Kran va smesitel,
  Oqishni tuzatish. Hudud: …"), narx — "Kelishiladi", telefon e'londa ochiq. Avtomatik tekshiruv: matn — qoidalar
  (taqiqlangan — saqlanmaydi, og'irida bloklanadi); rasm — AI. Toza bo'lsa e'lon shu zahoti faol va kategoriya sahifasiga
  o'tadi ("E'loningiz joylandi!"); shubha bo'lsa (yoki rasmni tekshirib bo'lmasa) — admin navbatida.
- Joylangan e'lonlar yangi qoidalar bilan baribir qayta tekshirib boriladi (avvalgidek).

## 2026-11-17 · "+ E'lon joylash" — yordamchi bilan e'lon (`claude/ai-post`)

Ega: "E'lon joylash bosilsa AI yordamchiga kirsin; «men o'qituvchiman», «uqituvchi», «oqtvchi» deb yozsa ham to'g'ri
tushunsin; kerak bo'lsa «aynan qanday o'qituvchisiz?» deb variantlar bersin; oylik maosh kerak emas, telefon raqamini
yozsin; «Tasdiqlash» → «Sizning e'loningiz shunday ko'rinadi» → «Joylash» → avtomatik tekshiruv → «Tabriklaymiz»; boshqa
mavzuda oyna chiqmasin".

- **/ai/post** (alohida to'liq ekran): bosh sahifadagi katta tugma, "Bo'limlar"dagi "E'lon joylash" va pastki/yuqori
  "E'lon" (ish izlovchi) shu yerga olib kiradi. Ish beruvchi rejimida — vakansiya joylash (avvalgidek).
- **Tushunish:** guruh ("O'qituvchi") — barcha aniq kasblar sarlavhalar bilan (Aniq fanlar, Chet tillari…); kasb nomi
  gapda haqiqatan bo'lishi shart ("bugun havo zo'r" → "Havo liniyasi elektromontyori" emas). "Salom", "rahmat", "kimsan",
  ish bilan bog'liq bo'lmagan savol — oyna emas, qisqa javob; "ish kerak" — oyna ochiladi, kasb unda yoziladi.
- **Oyna:** kasb, ism (familiya ixtiyoriy), hudud va tuman, tajriba (bitta bosish), telefon (kirgan — hisobdagi raqam;
  mehmon — yozadi, "Joylash"da SMS bilan kiradi va javoblari bilan shu yerga qaytadi). Maosh va ish vaqti so'ralmaydi.
- **Ko'rinishi:** joylanadigan matnning o'zi; "O'zim haqimda" — faqat aytilganlardan ("… sifatida ish qidiryapman.
  Tajribam — 1–3 yil. Hudud: …"), avvalgi e'londa o'z so'zlari bo'lsa (kasb o'sha) — o'shalar saqlanadi.
- **Joylash:** mavjud `publishWorkerListing` (majburiy avtomatik tekshiruv, haqiqiy holat): joylandi — "Tabriklaymiz",
  ilovada mos ish xabari va "Menga mos ish chiqsa xabar bering" (Telegram); tekshiruvda / rad etildi / to'lov — o'z ekrani.
- **Ish qidirishda ham:** "salom", "kimsan", "ob-havo qanday?" — oyna chiqmaydi, qisqa javob.

## 2026-11-17 · Soddalashtirish 1: kirish, bosh ekran, bo'limlar tartibi, "o'qituvchi" (`claude/simplify-1`)

Ega (2026-11-17, uzun ro'yxat — bosqichma-bosqich). 1-bosqich:

- **Kirish:** til → "Boshlash" → rol; "Qaysi kasblar sizga mos" va "Qayerda ishlashni xohlaysiz" olib tashlandi (eski
  havolalar bosh sahifaga).
- **Bosh ekran:** qidiruv ostida katta "+ E'lon joylash"; 4 ta tez yo'l hero ostida katta plitkalar; "Yaqin atrofdan ish
  qidirish", "Tajriba talab qilinmaydigan ishlar".
- **Bo'limlar ro'yxati (telefon, kirgan):** E'lon joylash → Yordamchi (sun'iy intellekt) → Universal ustalar → Barcha
  vakansiyalar → Kunlik ish → qolganlari.
- **Ustalar:** qidiruv — "Ustani qidirish".
- **Tushunish:** "мен ўқитувчиман" endi "Loyiha menejeri" emas (kirill olmoshlari, "-ман" qo'shimchasi); "o'qituvchi" —
  "O'qituvchi" guruhi (avval sinonimi o'xshash "Avtoinstruktor"); "uqituvchi", "oqtvchi" ham (bir harf xato, unlisiz yozuv).
- Gradientli tugmalar matni qorong'i mavzuda ham oq.

## 2026-11-16 · Yordamchi: uzun AI matni o'rniga so'rovnoma oynasi (`claude/quick-ai`)

Ega: "AI uzun matn yozmasin. So'rov qilgandan keyin oyna chiqsin — qaysi hududdan, oylik maoshi qancha bo'lsin — oxirida
«Qidirish». Ish yo'q bo'lsa — so'rovingiz qoldirildi, xabar beramiz, bo'ldi. Yaqin kasblar bo'lsa — pastda. Sodda bo'lsin".
Tanlov (AskUserQuestion): erkin suhbat ham olib tashlansin; matn — "So'rovingiz saqlandi".

- **Oqim:** yozilgan matn → kasb, hudud, maosh (va "kunlik", "tajribasiz" kabi shartlar) tushuniladi (lug'at, kerak bo'lsa
  AI — faqat tushunish uchun) → oyna (telefonda pastdan): "Qanday ish?", "Qaysi hududda?", "Oylik maosh qancha bo'lsin?"
  (oldindan to'ldirilgan) → "Qidirish" → qisqa xulosa ("Buxgalter · Toshkent shahri · 4 mln so'mdan yuqori") va kartalar.
- **Topilmasa:** bitta qisqa xabar. Kirgan ish izlovchi — qidiruv saqlanadi (bepul `saved_searches`, kuniga bir marta
  tekshiriladi, mos e'lon bo'lsa bildirishnoma) va "So'rovingiz saqlandi. Mos ish chiqsa, sizga xabar beramiz."; mehmon —
  "Kirsangiz — xabar beramiz" + "Kirish". Pastda — "Shunga yaqin ishlar" (ota yo'nalish yoki shu kasb boshqa joyda).
- Olib tashlandi: AI javob matni, jarayon izi, "+ Kunlik" aniqlashtirish, tavsiya savollar, bozor statistikasi kartasi,
  namuna e'lonlar (yordamchida), karyera/suhbat/vakansiya matni tezkor tugmalari va "Karyerangizni rivojlantiring" kartasi.
  `/api/assistant` serverda qoldi (UI ishlatmaydi).
- Lug'at: "men", "menga" kabi olmoshlar kasb deb olinmaydi; "-man/-miz" qo'shimchasi ("instruktorman" → "instruktor").
- Suhbat xotirasi kaliti yangilandi (v3) — eski uzun matnli suhbatlar ko'rinmaydi.

## 2026-11-16 · Logotip: egasining haqiqiy belgisi qaytdi (`claude/real-logo`)

Ega: "o'zimizning real logotip bo'lsin". 5.0 dagi gradient kvadrat + portfel belgisi olib tashlandi — hamma joyda
(sarlavha, yon menyu, kirish oynasi, admin, hikoyalar) yana `src/assets/brand/ishtopdim-mark.png` (oq plitada ko'k odam va
strelka). Favicon va ilova belgilari o'zgarmagan (ular doim shu belgi edi).

## 2026-11-16 · 5.0 "ko'k-oq" dizayn: Manrope, gradient, yangi bosh sahifa (`claude/blue-white`)

Ega: dizayn topshirig'i (oklch tokenlar, Manrope, shisha sarlavha, hero panel, 3+6 kartochka) — "Saytning o'ziga qo'llash".

- **Tokenlar va shrift:** barcha ranglar `oklch` da, asosiy ko'k `oklch(0.52 0.2 260)`; shrift Inter → Manrope Variable
  (400–800); radius 0.875rem; yangi `--gradient-brand`, `--gradient-hero`, `--shadow-card`, `--shadow-glow`, `--warm`.
  Kontrast testi oklch qiymatlarini o'qiydi — barcha AA juftlari o'tadi.
- **Sarlavha:** 64 px (telefonda 56) shaffof (blur) sticky; logo — gradient kvadratda oq portfel; pill menyu; "E'lon
  berish" gradient tugma; til va "Kirish" yumshoq. Kirgan foydalanuvchida kompyuterdagi yon menyu saqlandi.
- **Bosh sahifa:** rol almashtirgich pill; hero panel (joy, salom 👋, "Qanday **ish** qidiryapsiz?", qidiruv + gradient
  "Topish", 4 chip, filtrlar va xarita). Qidiruv endi sarlavhada emas, heroda (telefon va kompyuterda bir xil).
  "Yangi ishlar" va "Namuna e'lonlar" 3/2/1 ustun (kirganda telefonda "Yangi ishlar" avvalgidek yig'ilgan).
- **Kartalar:** yangi ish kartasi (maosh pill, hover ko'tarilish va nur; telefonda ixcham — 3 ta karta birinchi ekranda),
  namuna kartasi punktir chegarali.
- Footer: til tanlagich to'q fonda ko'rinadigan bo'ldi. Telegram Mini App panellari oklch tokenlardan ham to'g'ri rang
  oladi (hex ga aylantiriladi).
- Eski "sarlavhada doimiy qidiruv (Uzum uslubi)" yangi topshiriq bilan almashtirildi.

## 2026-11-16 · Tez o'tish: bosilgan zahoti yangi ekran (`claude/fast-nav`)

Ega: "tugma bosilgach keyingi oynaga o'tishi sekin — tepada ko'k chiziq keyingi ekranga o'tishni kutib turadi, umuman
yoqmayapti".

- Boshqa sahifaga havola bosilganda eski sahifa ustida kutilmaydi: kontent o'rnida darhol yangi sahifa skeleti (yuqori
  panel va pastki menyu joyida), pastki/yon menyuda bosilgan bo'lim darhol belgilanadi; javob kelishi bilan sahifa
  almashadi. Oldindan yuklangan sahifa (prefetch + `loading.tsx`) avvalgidek o'sha zahoti ochiladi — qatlam ko'rinmaydi.
- Tepadagi ko'k chiziq boshqa sahifaga o'tishda yo'q; faqat o'sha sahifada (filtr, sahifa raqami) va 0.2 s dan kechiksa.
- Qatlam bosishni to'smaydi, API/fayl havolalari va havola ichidagi tugmalarda chiqmaydi, 10 s da o'zi yo'qoladi.
- Ochilgan sahifaga qaytish keshi 30 s → 60 s (`staleTimes.dynamic`).
- Sinov: `e2e/specs/nav-instant.spec.ts` — sekin server (1.5 s, oldindan yuklashsiz) taqlidida 0.4 s ichida skelet va faol bo'lim.

## 2026-11-16 · 07–10: pastki menyu, qidiruv matni, 3 qadamli ariza (`claude/seeker-screens`)

Ega ("MASTER PROMPT", 5-bosqich).

- **Pastki menyu (ish qidiruvchi va mehmon):** Bosh sahifa · Ishlar (`/jobs`) · Arizalar · Xabarlar · Profil. "Saqlanganlar"
  va "O'zim haqimda e'lon" — Profilda (Kabinetim) va bosh sahifa "Bo'limlar" menyusida; kompyuterda yon menyudagi "E'lon"
  tugmasi joyida. Ish beruvchi menyusi o'zgarmadi. Kompyuterda "Xabarlar" — yuqori panel belgisida (takrorlanmaydi).
- **07 Qidiruv:** ish qidiruvchida sarlavhadagi qidiruv — "Lavozim yoki kompaniyani qidiring..." (qidiruv kompaniya nomini
  ham ko'radi); ish beruvchida — "Ish va ishchilar izlash".
- **10 Ariza — 3 qadam:** 1) rezyume (profildagi rezyume + PDF ko'rish/tahrirlash yoki tezkor ariza + "Avval to'liq rezyume
  yaratish"), 2) qo'shimcha (xabar va tez qo'shiladigan qatorlar), 3) tasdiqlash (vakansiya, rezyume, xabar). Natija:
  "Arizangiz muvaffaqiyatli yuborildi!". Takror arizaga qarshi himoya — avvalgidek (baza). PDF fayl yuklash bazada yo'q —
  tugmasi ham qo'yilmadi.
- 08 katalog (filtrlar, sahifalar) va 09 vakansiya sahifasi (kompaniya, logo, tasdiq belgisi, saqlash, ulashish, shikoyat,
  ariza) avvaldan bor — 4.0 ranglari bilan.

## 2026-11-16 · 04–06 ekranlar: rol, kasblar, hudud va tajriba (`claude/seeker-setup`)

Ega ("MASTER PROMPT", 4-bosqich). Kirish hamon talab qilinmaydi; tanlov shu qurilmada saqlanadi.

- **04 Rol:** "Siz qaysi maqsadda keldingiz?" — "Men ish qidiryapman" / "Men xodim qidiryapman" (4 tilda). Rolni keyin
  Profilda almashtirish o'zgarmadi.
- **05 Kasblar** (`/start/kasblar`): "Qaysi kasblar sizga mos keladi?" — umumiy kasb tanlagich (soha → kasb, qidiruv),
  bir nechta (5 tagacha), tanlanganlar tepada (olib tashlanadi), "1/2-qadam", "O'tkazib yuborish". Kasblar bazadan
  tekshiriladi (faol va tanlanadigan) va `ib_prefs` cookie'sida saqlanadi.
- **06 Hudud va tajriba** (`/start/hudud`): viloyat, tuman yoki shahar (mavjud `ib_place` cookie'si — bosh sahifa va qidiruv
  uni allaqachon ishlatadi), "Masofaviy ish ham mos keladi", tajriba (ixtiyoriy), "2/2-qadam".
- Mehmon ish qidiruvchi rolni tanlasa — 05 → 06 → bosh sahifa; ish beruvchi — darhol bosh sahifa; `next` bo'lsa — o'sha joyga.
- **Bosh sahifa "Sizga mos ishlar":** profilda kasb bo'lmasa — 05 da tanlangan kasblar bo'yicha (avval tanlangan hududda,
  "Tajriba yo'q" bo'lsa avval tajriba talab qilmaydiganlari), so'rovlar parallel. Faqat haqiqiy faol e'lonlar.
- Audit tuzatishi: bir nechta kasb uchun bazada jadval allaqachon bor (`worker_professions`, asosiy + 5 ta qo'shimcha) —
  yangi migratsiya kerak emas.

## 2026-11-16 · 01–03 ekranlar: splash, xush kelibsiz, kirish (`claude/entry-screens`)

Ega ("MASTER PROMPT", 3-bosqich).

- **01 Splash:** shior "Yaxshi ish — yorqin kelajak!" (4 tilda). Logo, yuklanish chizig'i va qisqa avtomatik o'tish o'zgarmadi.
- **02 Xush kelibsiz** (`/start/til`): haqiqiy surat (admin "home_photo" joyiga yuklaydi; bo'lmasa — egasi bergan surat),
  sarlavha "Kelajagingiz uchun to'g'ri imkoniyat shu yerdan boshlanadi.", izoh, ikkita katta tugma: **Boshlash** → rol
  tanlash (`/start/rol?from=welcome`), **Hisobim mavjud** → kirish (`/auth`). Til — tepada ixcham qator; "Qanday ishlaydi?" —
  tepada o'ngda. Rol kartalari xush kelibsiz ekranidan rol ekraniga o'tdi (kirish hamon talab qilinmaydi: mehmon rolni
  tanlab, darhol bosh sahifaga o'tadi). Bayroqlar olib tashlandi (`flags.tsx`).
- **03 Kirish:** o'zgarmadi — +998 raqam, kod Telegram bot orqali (SMS xizmati ulanmagan, soxta SMS yo'q), qayta yuborish
  taymeri, xatolar, foydalanish shartlari va maxfiylik. Google orqali kirish ulanmagan — ko'rsatilmaydi.

## 2026-11-16 · Dizayn tizimi 4.0 — ranglar (`claude/design-tokens`)

Ega ("MASTER PROMPT", 2-bosqich): Primary `#1558D6`, Secondary `#EAF1FF`, Background `#F5F7FA`, Surface `#FFFFFF`,
Text `#101828`, Secondary text `#667085`, Success `#16A36A`, Error `#DC3545`, kartalar 12–16px, yengil soya.

- `globals.css` yorug' mavzu tokenlari shu palitraga o'tdi; tuzilish va komponentlar o'zgarmadi.
- AA uchun matn variantlari: ikkilamchi matn `#626C81`, muvaffaqiyat `#107A4F`, xato `#C62F3E` (asl ranglar `#EAF1FF`
  yoki fon ustida 4.5:1 dan past). `#16A36A` — faqat belgi.
- `--radius` 12px, soyalar neytral va yengilroq. `brand-contrast.test.ts` 4.0 qiymatlarini mahkamlaydi.

## 2026-11-16 · Kanal posti — oddiy rasm va "Ariza qoldirish" (`claude/plain-post`)

Ega: "rasmi kerak emas, oddiy o'zi chiqsin: yozuv, vakansiya nomi, «Ariza qoldirish» chiqsin, sayt nomi kerak emas …
rasmli qil, prosta: rasmda faqat ish nomi, maoshi, lokatsiyasi, kompaniya nomi bo'lsin, tushunarli bo'lib".

- Kanalga avtomatik vakansiya e'loni: oddiy rasm (`/api/promo/vacancy/<slug>?f=post`, 1200×800) — faqat ish nomi,
  kompaniya, joylashuv va maosh; odam chizmasi, logotip, sayt nomi yo'q. Izohda faqat vakansiya nomi, tugma —
  "Ariza qoldirish" (oldin "Batafsil va ariza →"). Rasm ketmasa — to'liq matn, havola ko'rinishi o'chiq.
- Rasm har doim o'zbekcha (til cookie'siga bog'liq emas) va loyihadagi Manrope shrifti bilan (tarmoqsiz) chiziladi.
- Ishchi e'lonlari o'zgarmadi (matn). Ulashish uchun e'lon rasmlari (kvadrat, story) va kasb chizmalari joyida qoldi.

## 2026-11-16 · E'lon rasmi: kasbga mos kiyingan odam; kanalga rasm bilan (`claude/job-art`)

Ega: "e'lon joylanib, guruhga xabar borganda rasm bilan borsin; har bitta kasbga rasm tayyorla — odamning rasmi bo'lsin,
kasbga mos kiyintir".

- **Kasb chizmalari (`src/lib/job-art`):** 34 xil kiyim — oq xalat va stetoskop (shifokor), hamshira formasi, oshpaz
  qalpog'i va kurtkasi, ofitsiant nimchasi, sotuvchi fartugi, kassir formasi, haydovchi kepkasi, kuryer ryukzagi,
  quruvchi kaskasi va yorqin jileti, payvandchi niqobi, elektrik va muhandis kaskasi, santexnik kombinezoni, qo'riqchi
  furajkasi, o'qituvchi ko'zoynagi, dasturchi naushnigi, operator garniturasi, tikuvchi santimetri, dehqon shlyapasi
  va boshqalar. ~1900 kasbning har biri nomidan (o'zbek, rus, ingliz) yoki sohasidan kiyim turiga bog'lanadi; jinsi,
  teri va soch rangi, soch turmagi (ro'mol ham) kasb ID'sidan — har kasb doim bir xil ko'rinadi. Tashqi xizmatsiz,
  bepul, darhol. Uslub ataylab chizma: haqiqiy ish beruvchi yoki ishchining surati emas.
- **E'lon rasmi** (`/api/promo/vacancy/…`: kvadrat, story, havola oldindan ko'rinishi): o'ng tomonda (story'da — o'rtada)
  kasbga mos kiyingan odam, yonida soha belgisi. Telegram/Instagram'da havola ulashilganda ham shu rasm chiqadi.
- **Kanalga avtomatik e'lon:** vakansiya endi rasm bilan ketadi (kvadrat rasm + izoh + "Ochish" tugmasi); Telegram
  rasmni ololmasa — o'sha xabar matn bilan. Ishchi e'lonlari rasmsiz qoladi (chizma ishchining o'zi deb o'ylanmasin).
- Aniqlandi: AI bilan kasb rasmlarini yaratish (Gemini) prod'da ishlamayapti — Google kaliti 429 (limit yo'q) qaytaradi.
  Yangi chizmalar bunga bog'liq emas.
- Testlar: `job-art` unit (kasb → kiyim, adashtiradigan so'zlar, SVG to'g'riligi), `channel` (rasm, matnga qaytish,
  kanal xatosi), `autopost` va `autopost-format` yangilandi; `promo-image` e2e (PNG o'lchamlari, og:image, qoralama 404).

## 2026-11-16 · "AI bilan oson joylash" (ish beruvchi) va ovozsiz yordamchi (`claude/ai-vacancy`)

Ega: "ovoz yozish va ovoz chiqarib o'qishni olib tashla, kerak emas; ish beruvchi panelida «AI bilan vakansiyani oson
joylang» ajralib tursin; kirganda sodda bo'lsin — «menga shunaqa kerak» desa, ekranda savol chiqsin, tanlab-tanlab sen
bergan variantni o'tkazsin; yozuvlar kam va tushunarli bo'lsin".

- **Ovoz olib tashlandi:** yordamchida (bosh sahifa oynasi, /ai ekrani, AI to'ldirish maydoni) mikrofon, "Ovoz bilan
  javob" kaliti, "O'qib berish" tugmasi va ularning matnlari yo'q; salomlashuvdagi "mikrofonni bosib ayting" ham olindi.
  Chatdagi ovozli xabarlar (odamlar o'rtasida) qoldi. Maxfiylik siyosatidagi mikrofon jumlasi shunga moslandi
  (mikrofon — faqat chatda ovozli xabar uchun), cookie siyosatidan `ib_ai_speak` olindi (4 tilda, sana 2026-11-15).
- **"AI bilan oson joylash" (`/post/vacancy?ai=1`):** ish beruvchi bosh sahifasida "Vakansiya joylash" ustida alohida
  to'q sariq karta; oddiy formaning 1-qadamida ham shu kirish. Ish beruvchi bitta gap yozadi ("Chilonzordagi kafemizga
  oshpaz kerak, oyligi 5 mln") yoki tayyor misolni bosadi. Gapdan tushunilgani ("Tushundim: Oshpaz · Chilonzor · 5 mln")
  qayta so'ralmaydi; qolgani ekranda BITTADAN, katta variant tugmalari bilan: kasb (aniq bo'lmasa — variantlar, "Boshqa
  kasb"), viloyat → tuman, maosh (tayyor summalar, "Kelishiladi", "Boshqa summa", oylik/kunlik), ish vaqti, tajriba, kim
  ish beradi, nomi, telefon (profildan ma'lumlari so'ralmaydi), e'lon matni ("Ha, ma'qul" / "O'zgartirish"). Oxirida
  bitta ekranda hammasi — har qatorda "O'zgartirish" va "E'lonni joylash". "Orqaga" — oldingi savol; "Oddiy forma" —
  javoblar saqlanib oddiy qadamlarga o'tadi. Prod'da AI qo'shimcha to'ldiradi va e'lon matnini yozadi (faqat aytilgan
  faktlardan — maosh, tajriba, grafik o'ylab topilmaydi); AI bo'lmasa — lug'at va savollar bilan ishlaydi.
- **Imlo xatosi e'lon yozishda ham:** "santexnk", "oshpz" — eng yaqin kasb (ish izlovchi suhbatida ham).
- Eski "AI bilan tez tayyorlash" (bitta katta matn maydoni) olib tashlandi — o'rnini yangi oqim egalladi.
- Testlar: `vacancy-guide` (bosh sahifadan kirish → gap → savollar → joylash → bazada tekshirish; variantlar, orqaga,
  kunlik, oxirgi ekrandan o'zgartirish, oddiy formaga o'tish; xato bilan yozilgan kasb), `guide-logic` unit testlari;
  ai-finder, assistant-chat, assistant-stats, settings-legal — ovoz yo'qligi tekshiriladi.

## 2026-11-15 · Qidiruv tepada, ortiqcha matnlar qisqardi, 100+100 sinov (`claude/top-search`)

Ega: "Uzumnikiga o'xshatib qidiruvni tepaga chiqar (telefon), «masalan oshpaz» o'rniga «ish va ishchilar izlash» lupa
oldida tursin, bosganda kvadratcha chiqmasin; ortiqcha so'z-matnlar juda ko'p — maksimal qulay va tushunarli bo'lsin;
o'zing 100 ta vakansiya va 100 ta ishchi joylab, oddiy so'zlar bilan qidirib ko'r, kirishdan rol o'zgartirishgacha,
tugmalargacha hammasini test qil".

- **Qidiruv sarlavhada (telefon):** bosh sahifada (ish izlovchi ham, ish beruvchi ham) qidiruv maydoni yuqori panelning
  o'zida, lupa va "Ish va ishchilar izlash" yozuvi bilan; sahifa ichidagi takror maydon telefonda yashirildi (kompyuterda
  joyida). Yordamchi yoqilgan bo'lsa — yozilgani yordamchiga ketadi, o'chiq bo'lsa — oddiy qidiruv sahifasiga. Rejim
  tanlanmagan mehmon sahifasi o'zgarmadi (u yerda hudud/kompaniya qidiruvi bor).
- **Kvadratcha yo'q:** maydonni bosganda ichki kiritish joyi atrofida to'rtburchak halqa chiqmaydi — butun maydon
  yumshoq ramka bilan ajraladi.
- **Imlo xatosi bilan ham topadi:** kasb lug'atda aniq topilmasa, bitta-ikkita harf farqi bilan eng yaqin kasb olinadi
  ("oshpz" → Oshpaz, "kasir" → Kassir, "elektirk" → Elektrik). Faqat butun so'zlar, 5 harfdan qisqasi tuzatilmaydi;
  kasb bo'lmagan oddiy so'zlar ("kunlik", "restoran", "korzinkaga") kasbga aylanmaydi. Kasbning o'z nomi boshqa
  kasbning sinonimidan ustun ("enaga" → Enaga, "Tarbiyachi yordamchisi" emas).
- **Qisqa matnlar:** "Chat" → "Xabarlar"; yon menyu izohlari ("Barcha ishlar", "Yaqin atrofdagi ishlar"…), rol
  almashtirish, sozlamalar, ish beruvchi ro'yxatdan o'tishi, til va rol tanlash ekranlari qisqardi; sahifa
  sarlavhasi ostidagi ikkinchi darajali izohlar telefonda yashirildi; bildirishnomalarda bo'sh ro'yxatda ortiqcha
  qator yo'q.
- **100+100 sinov (faqat lokal stendda — jonli saytga soxta e'lon qo'yilmaydi):** `search-scale` 100 vakansiya va 100
  ishchi joylaydi, sarlavhadagi qidiruvdan oddiy so'zlar bilan qidiradi ("oshpaz", "Chilonzorda oshpaz", "kunlik ish",
  "haydovchi kerak", "Samarqandda sotuvchi", "oshpz", "повар нужен", "enaga kerak", "tajribali haydovchi"…) va topilgan
  son bazadagiga tengligini, har kartochka so'ralgan kasb/joy bo'yichaligini tekshiradi. `all-links` — mehmon, ish
  izlovchi, rol almashtirish, ish beruvchi: barcha ichki havolalar ochiladi.

## 2026-11-15 · E'lon berish soddalashtirildi: avval kasb, yordamchi — ixcham qator (`claude/simple-post`)

Ega: "shu yerni ham soddalashtir — juda katta va tushunarsiz bo'lgan, ketma-ketligini to'g'irla, e'lon berishni osonlashtir"
(ish izlovchi e'loni, 1-qadam: katta "Tez va qulay e'lon — yordamchi bilan" kartasi kasb savolidan oldin turardi).

- **1-qadam tartibi:** avval asosiy savol — "Qaysi kasb bo'yicha ish qidiryapsiz?" va qidiruv; uning ostida bitta ixcham qator
  "Yordamchi bilan to'ldirish — bir gap bilan yozing, qolganini o'zi so'raydi". Bosilsa — suhbat ochiladi (yozish maydoni
  darhol faol), "‹ Kasbni ro'yxatdan tanlash" bilan qaytiladi; "Qaytadan boshlash" ham ro'yxatga qaytaradi. Kasb yozilsa yoki
  tanlansa — qator yo'qoladi (ortiqcha narsa yo'q).
- **Eskirgan matnlar:** rol tanlash ekranidagi "Kabinetim → «Rolni o'zgartirish»" → "«Profil» sahifasining tepasidagi
  tugma"; yordam bo'limidagi "Kabinetim" havolalari → "Arizalar" / "Profil" (uz, oz, ru, en).
- Testlar: post-ai-chat (tartib, ochish/qaytish, fokus), moderation-ban.

## 2026-11-15 · "Yordamchi": alohida to'liq ekran, sodda tezkor imkoniyatlar (`claude/assistant-screen`)

Ega: "Barchasi siz uchun o'rniga Yordamchi; alohida panelga kirganda tagida menyular ko'rinmasin — alohida katta ekranga
kirsin; tezkor imkoniyatlar boshida ish qidirish, karyera maslahati, suhbat tursin; «Masalan, bosing» kerakmas; sodda qil".

- **Nomi:** "Barchasi siz uchun" → **"Yordamchi"** (oz "Ёрдамчи", ru "Помощник", en "Helper") — menyular, sarlavha, bosh
  sahifa bo'limlari.
- **/ai — alohida to'liq ekran:** yuqori panel, chap yon menyu va pastki menyu yo'q (`Shell bare`). O'z sarlavhasi:
  "‹" (oldingi sahifaga, to'g'ridan-to'g'ri ochilsa — bosh sahifaga), "Yordamchi" va holati, "Ovoz bilan javob",
  "Suhbatlar" (telefonda pastdan chiqadi), suhbat ketayotganda "+" (yangi suhbat), menyu. Yozish maydoni ekran tagida.
- **Tezkor imkoniyatlar:** boshida "Ish qidirish", "Karyera maslahati", "Suhbatga tayyorgarlik" (keyin CV, maosh, PRO
  kuzatuv); ish beruvchida — "Nomzod topish", "Vakansiya matni", "Suhbat savollari". Telefonda — ikki ustunli oq plitkalar
  (rangli belgilar), hammasi ko'rinadi, yonga surilmaydi.
- **Olib tashlandi:** "Masalan, bosing:" misollari; "Suhbatlar" panelidagi sayt bo'limlari ro'yxati (ilovaga "‹" bilan).
- Testlar: ai-entry, ai-workspace, sections, simple-mobile, ai-finder, home-market, layout-overlap yangilandi.

## 2026-11-15 · Yangi ranglar: ega yuborgan namuna rasmdagidek (tuzilish o'zgarmagan) (`claude/design-colors`)

Ega: "tuzilishini o'zgartirma, faqat dizaynni shunga mosla — ranglarni" (namuna: navy banner, yorqin ko'k tugmalar, oq
kartalar, rangli belgi plitkalari, maosh — och ko'k pilyulada).

- **Palitra 3.0** (`globals.css`, `docs/DESIGN_SYSTEM.md` §2): yorqin ko'k `#0B57F0`, navy matn `#0E1A3D`, och ko'kish fon
  `#F5F7FD`, ko'kish kulrang `#4B5884`, yumshoq ko'kish soyalar. Barcha juftliklar AA (brand-contrast.test.ts — yangi
  juftliklar: navy banner matni, plitka belgilari). Qorong'i mavzu ham moslandi.
- **Bosh sahifa (mehmon):** birinchi ekran — to'q navy banner (oq sarlavha, ko'k urg'u, oq "Men ish qidiryapman" tugmasi).
- **Rangli plitkalar** (ko'k · binafsha · yashil · to'q sariq): telefon bosh sahifasidagi tezkor yo'llar (endi oq kartalar),
  "Bo'limlar" menyusi, yig'iladigan bo'limlar, sohalar to'ri (/search, /kasblar), Profildagi bo'limlar.
- **Kartalar:** oq, deyarli ko'rinmas chegara va yumshoq soya (barcha `rounded-2xl` kartalar); e'lon kartalarida maosh —
  och ko'k pilyulada. Telefonda yuqori qism sahifa fonida — oq kartalar ajralib turadi.
- **Pastki menyu:** faol bo'lim ostida ko'k chiziq. **Sarlavha:** joylashuv — och ko'k pilyula.
- Namunadagi soxta raqamlar ("2 500+ vakansiya"), begona logotiplar va stok surat olinmadi.
- PWA manifest va xato sahifasi ranglari yangilandi.
- Ruscha + 150% shriftda: pastki menyu nomlari va tezkor yo'l plitkalari ekranga sig'adi (yonga surilmaydi).
- Testlar: brand-contrast (3.0 palitrasi va yangi juftliklar), telegram-fullscreen (yangi fon rangi).

## 2026-11-15 · Soddalashtirish: telefonda bo'limlar menyusi, "AI" o'rniga oddiy so'zlar, yig'iladigan bo'limlar (`claude/simplify-mobile`)

Ega: "telefonda kirganda kategoriyalar chiqsin — chap menyudagidek, oldida kichik harf bilan nima ekani; eng tagida qizilda
rolni o'zgartirish; AI o'rniga tushunarli so'z; yozuvlar juda ko'p — bugungi va yangi ishlarni ichiga yashir («ochish»,
«ko'rish»); profil katta va chalkash — ichiga yashir, rolni o'zgartirish eng tepada; ustalarda «+» emas «E'lon joylash»".

- **Telefon/planshet, bosh sahifa (kirgan):** "Bo'limlar" ro'yxati — kompyuterdagi chap menyu bilan bitta manba
  (`components/shared/nav-items.ts`); har bo'lim ostida kichik izoh ("Barcha ishlarni ko'rish va qidirish", "Yaqin atrofdagi
  ishlarni xaritada ko'rish"…), o'qilmaganlar soni. Eng tagida qizil "Ish beruvchiga o'tish" / "Ish izlovchiga o'tish" — bir
  bosishda (rejim yoziladi, bosh sahifa o'sha rolda ochiladi). "Yangi ishlar" / "Yangi nomzodlar" — yig'ilgan ("Ko'rish"),
  kompyuterda ochiq. Izoh matnlari, takroriy havolalar, "Universal ustalar" katta bloki va ish beruvchi panelidagi uzun
  ro'yxatlar telefonda yo'q (ular menyuda va raqamlarda). Pastki qism (footer) kirganlarga telefonda ixcham.
- **"AI" → oddiy so'zlar** (uz/oz, ru/en ham): bo'lim nomi "Barchasi siz uchun" (ru "Всё для вас", en "All for you"); qolgan
  joylarda "Yordamchi" / "Помощник" / "Helper", "Oddiy so'z bilan qidirish", "PRO kuzatuv" / "PRO-слежение" / "PRO watch".
  Yordamchi o'zini "Ish topdim yordamchisi" deb tanishtiradi ("kimsan?" savoliga sun'iy intellekt ekanini aytishi saqlangan).
  Admin matnlari o'zgarmagan.
- **"Barchasi siz uchun" sahifasi:** "Bugungi ishlar" va "Yangi ishlar" — yopiq qatorlar ("Ochish", "Ko'rish").
- **Profil** (sarlavha "Kabinetim" → "Profil"): tepada rolni almashtirish, keyin profil kartasi; "Mening e'lonlarim",
  "Mening dunyom", "PRO kuzatuv", "Faoliyat", "Hisob" — yig'iladigan bo'limlar. `/cabinet#dunyo` havolasi (dunyo yaratilgach)
  "Mening dunyom"ni o'zi ochadi (`Fold anchor`).
- **Universal ustalar:** telefonda ham "+ E'lon joylash" yozuvi (320 px da ham sig'adi).
- Yangi umumiy komponent: `Fold` (WAI-ARIA accordion: tugma sarlavha ichida, `aria-expanded`).
- Ixcham footer: "Foydalanish shartlari" / "Maxfiylik" havolalari ruscha va katta shriftda ham qatorga sig'adi (yonga surilmaydi).
- Testlar: E2E `simple-mobile.spec.ts` (7), yangilangan: ai-entry, ai-workspace, ai-finder, sections, applications,
  assistant-chat, auth, cabinet, entry-flow, home, home-market, journeys, layout-overlap, matches, modes, payments,
  post-ai-chat, saved, structure, tariffs, telegram-login, world; unit — engine.test.

## 2026-11-14 · Audit: telefonda "‹ Orqaga" va logotip ustma-ust tushmaydi (`claude/audit-back-logo`)

- Reklamadan oldingi tekshiruv (ega: "barcha muammolarni hal qil … odamlarga judayam qulay qil"): 390–430 px telefonlarda
  ichki sahifalarda logotip nomi bilan markazdan toshib "Orqaga" ustiga chiqib, "Orqa…" bo'lib qolardi. Endi telefonda
  (640 px dan tor) "Orqaga" bor bo'lsa — faqat logotip belgisi; planshet va kompyuterda nom ham ko'rinadi.
- Tekshirildi: 360/375/390/412/430/768/1024 px — ustma-ust yo'q; asosiy sahifalarda (bosh, tariflar, ishlar, kabinet,
  ish beruvchi) gorizontal toshish va konsol xatosi yo'q.
- "Tariflar" sahifasi narxlarni yuklay olmasa (prod'da 0080 hali qo'yilmagan) — bo'sh qolmaydi: "har doim bepul" qatori va
  "Vakansiya joylash" / "E'lon berish" tugmalari ko'rinadi. Onlayn to'lov ulanmagan bo'lsa — yo'q "TOP qilish" tugmasi
  haqida yozilmaydi ("Onlayn to'lov tez orada ulanadi").
- Test: E2E `global-back.spec.ts` (+1: 360–768 px oralig'ida "Orqaga" kesilmaydi va logotip ustiga tushmaydi),
  `tariffs.spec.ts` (+1: narxlar yuklanmasa; spec endi yolg'iz ham o'tadi — ish beruvchi profilini o'zi yaratadi).

## 2026-11-14 · Tariflar: Oddiy · Tezkor · Maksimal (`claude/tariffs`, 0080)

- Ega: "tariflarni mukammal tuzib chiq — tarif ko'tarilgan sari imkoniyatlar kengayib borsin; narxni baland qo'yma".
- Vakansiya: Oddiy — 10 kun (30 000; e'lon joylash bepul bo'lsa — bepul) · Tezkor — 15 kun + 3 kun TOP (49 000) ·
  Maksimal — 30 kun + 10 kun TOP (99 000). Ishchi e'loni: Oddiy — 10 kun (5 000 / bepul) · Tezkor — 30 kun + 3 kun TOP
  (12 000) · Maksimal — 30 kun + 7 kun TOP + 30 kun AI PRO (19 000). Birinchi to'lovga −50% (aksiya muddatida).
  Oddiy narxlari pasaytirildi (50 000 → 30 000, 10 000 → 5 000) — faqat admin o'zgartirmagan bo'lsa.
- TOP — haqiqiy ta'sir: vakansiya qidiruvda birinchi (is_featured/featured_until, "TOP" belgisi), ishchi — promoted_until.
- E'lon bepul bo'lsa ham Tezkor/Maksimal — faol e'lonni kuchaytirish ("TOP qilish": vakansiya sahifasi, ishchi e'loni
  sahifasi; faqat onlayn to'lov ulangan bo'lsa ko'rinadi). To'lov oynasida daraja tanlovi; narx doim serverda.
- Baza: payments.plan; tariff_of / tariff_price / tariff_tiers / public_tariffs; create_payment va wallet_pay 3 argumentli
  (eski 2 argumentli — Oddiy, eski ilova buzilmaydi); apply_payment_internal daraja bo'yicha; tariffs_enabled sozlamasi.
- Ochiq "Tariflar" sahifasi (/pricing) qayta yozildi — bazadagi narxlar, halol "Bepul", har doim footerda.
- Testlar: SQL `tariffs.test.sql` (yangi), wallet / paid_listings / security_hardening yangi narxlarga; unit `tiers.test.ts`;
  E2E `tariffs.spec.ts` (3), payments.spec yangi narxlarga.

## 2026-11-14 · Hikoyalar, kanalga avtomatik e'lon, telefonda lupa, "ish/ishchi" tugmalari (`claude/launch-ready`, 0079)

- Ega: "telefonda qidiruv joyida lupa ko'rinmayapti"; "ish izlovchida — ish, ish beruvchida — ishchi"; "rasmlar, videolar —
  xuddi Instagramdagidek, Ish topdimning o'zi joylaydi"; "har bir joylangan rezyume kanalga tashlansin".
- Qidiruv maydoni (AI): lupa endi har doim ko'rinadi (≤380px'da yashirilardi); tor telefonda joyni tugmadagi yulduzcha bo'shatadi.
- Bosh sahifa tezkor tugmalari: ish izlovchida "Kunlik ish · Yaqin atrofda ish · Masofaviy ish · Tajribasiz ish",
  ish beruvchida "Kunlik ishchi · Yaqin atrofdagi ishchi · Tajribali ishchi · Masofaviy ishchi" (`easy.chips.*`).
- Hikoyalar (`features/stories`, admin → "Hikoyalar"): bosh sahifa tepasida doirachalar (mehmon, ish izlovchi, ish beruvchi;
  kimga ko'rinishi tanlanadi), bosilsa to'liq ekranda — jarayon chizig'i, bosish/bosib turish/surish, klaviatura, ovoz,
  ixtiyoriy reklama tugmasi (faqat sayt ichidagi yo'l yoki https). Rasm serverda WebP'ga qayta kodlanadi; video (MP4/WebM/MOV,
  50 MB) admin brauzeridan bir martalik imzolangan havola bilan to'g'ridan-to'g'ri yuklanadi, server boshidagi baytlardan
  tekshiradi (niqoblangan fayl — rad etiladi va o'chiriladi). Ko'rilganlar shu qurilmada eslanadi. Statistika: `story_view`, `story_cta`.
- Telegram kanalga avtomatik e'lon (`telegram-channel/autopost.ts`, admin → "Telegram kanal" → "Avtomatik e'lonlar"):
  yangi vakansiya — "🟦 ISH", ishchi e'loni — "🟩 ISHCHI"; telefon, ism, rasm, tavsif yo'q (sarlavhadagi raqam/@nik/havola
  ham olib tashlanadi); har biri bir marta (`channel_posts`), qadamda ≤4 ta, bloklangan muallifniki yo'q, 3 marta qayta
  urinish, kanal xatosida to'xtaydi. Alohida kanallar ixtiyoriy. Ishchi e'loni formasida — bu haqda ochiq yozuv.
- 0079: `stories`, `channel_posts`, `story-videos` bucket. E2E shlyuzi imzolangan yuklashni qo'llaydi.
- Testlar: stories model (7), kanal matni (5), kanal runner (6), E2E `stories.spec.ts` (2); mavjud testlar yangi yozuvlarga.

## 2026-11-14 · Massaj e'lonlari to'liq olib tashlanadi — admin muallif, qo'shimcha kasb va namunalar ham (`claude/remove-massage`)

- Ega: "massajchi ham kerak emas, ular e'londa bor — hammasini yo'q qil".
- Topilgan teshiklar (`moderation/sweep.ts`): eski e'lonlar tekshiruvi faqat muallifni bloklash orqali yashirardi —
  muallif faol admin bo'lsa (bloklanmaydi) yoki egasiz namuna bo'lsa, taqiqlangan e'lon ochiq qolardi; ishchining
  qo'shimcha kasblari ("Sotuvchi" + "Massajchi"), namuna vakansiyalar va ustalar namunalari tekshirilmasdi; fon navbati
  (pg_cron → tick) faqat navbatda ish bo'lsa chaqiriladi — yangi e'lon bo'lmasa tekshiruv umuman yurmasdi.
- Endi: topilgan e'lonning O'ZI darhol ommadan olinadi (vakansiya → hidden, ishchi e'loni → ommaviy emas, usta → rejected,
  namuna vakansiya → o'chiriladi), so'ng muallif bloklanadi (adminlar bundan mustasno). Versiya `2026-11-14.hide-items` —
  hamma e'lonlar boshidan bir marta qayta o'tadi. Allaqachon bloklangan muallif uchun hodisa qayta yozilmaydi.
- Ishga tushirish (`moderation/sweep-trigger.ts`): statistika hodisasi (`/api/e`) va holat tekshiruvi (`/api/health`) javobdan
  keyin bir qadam yurgizadi — har server nusxasida bittadan, tugagach soatiga bir marta. Bazaga o'zgarish (migratsiya) kerak emas.
- Testlar: rules (+5 kasb nomi), sweep-trigger (3), E2E `moderation-ban.spec.ts` (admin muallif, qo'shimcha kasb, namuna).

## 2026-11-13 · Qat'iy taqiq: erotika, ekstremizm, noqonuniy, massaj/spa — e'lon yo'q, muallif bloklanadi (`claude/moderation-hard`)

- Ega: "erotika, diniy ekstremizm, qonunga xilof barcha e'lonlar va so'zlar umuman ishlatilmasin; joylamoqchi bo'lsa o'sha
  zahoti bloklansin; joylagandan keyin har bir so'z (ma'nosi yaqin bo'lsa ham) tekshirilsin — e'lon ham o'chirilsin, o'zi
  ham bloklansin; massaj, spa kerak emas".
- Qoidalar (`moderation/rules.ts`, `STRICT`): massaj (massaj, массаж, massage, masseur — tibbiy ham), spa (salon/markaz/
  xodim konteksti; IT'dagi "SPA" emas), relaks salon, erotika so'zlari (erotika, porno, seks, intim, webcam model …),
  pullik tanishuv, diniy ekstremizm va taqiqlangan tashkilotlar, diniy targ'ibot, giyohvand nomlari, qurol savdosi, qimor,
  a'zo savdosi — kontekstsiz "block". Yolg'on topilmalarga qarshi testlar: "seksiya", "narkolog", "giyohvand moddalar
  iste'mol qilmaydigan", ismlar (Shahid, Mujohid, Jihod), "React SPA", "masala", "masjid", "наша", "печенье", "ставка".
- AI moderatsiya (`verdict.ts`): so'zni emas, MA'NONI baholaydi (jargon, evfemizm, raqam bilan yozish, kirill/rus/ingliz);
  massaj va spa — istisnosiz rad.
- Jazo (`moderation/policy.ts`, `enforce.ts`): og'ir toifada rad etilsa (qoida yoki AI) — hisob bloklanadi
  (`profiles.is_blocked`, sabab `auto_moderation:…`), barcha ochiq e'lonlari yashiriladi (vakansiyalar → hidden, ishchi
  e'loni → ommaviy emas, ustalar → rejected), xavfsizlik hodisasi `moderation.auto_ban` (admin ogohlantirishi). Hech narsa
  o'chirilmaydi — admin "Blokdan chiqarish" bilan qaytaradi. Faol adminlar bloklanmaydi (hodisa yoziladi).
- Qayerda: e'lon joylash (ishchi, vakansiya), AI suhbat va AI qoralama (yozayotganda), ustalar e'loni, so'rov va sharh.
  Joylash "bloklangan" bilan tugaydi, keyingi sahifa — /blocked.
- Eski e'lonlar (`moderation/sweep.ts`): fon navbatida kuchaytirilgan qoidalar bilan bir marta qayta tekshiriladi
  (kursor app_settings'da, versiya `2026-11-13.strict`).
- Kasblar katalogi: massaj/spa kasblari ko'rsatilmaydi va tanlanmaydi (ilovada darhol; bazada — 0078,
  `supabase/prod/pending.sql`, ega qo'llaydi).
- Testlar: rules (+47), policy, masters content-check; E2E `moderation-ban.spec.ts` (yozayotganda bloklash, joylangandan
  keyin moderatsiyada, eski e'lonlar qayta tekshiruvi, toza e'lon bloklanmaydi), masters, post-ai-chat (holat qaytariladi).
- Topilgan va tuzatilgan: 150% shrift + rus tilida Profildagi "AI-помощник"/"Универсальные мастера" kartalari va rejim
  oynasi tugmalari yonga chiqardi (uzun so'z endi bo'linadi).

## 2026-11-13 · Mehmon bosh sahifasi soddalashtirildi — 2-bosqich (`claude/ux-simplify-2`)

- Rejim tanlamagan mehmon sahifasi telefonda ~8 600 px dan ~4 500 px ga: hero (ikki yo'l + qidiruv) → ommabop kasblar →
  bitta "Yangi vakansiyalar" ro'yxati → alohida yashil "Universal ustalar" → footer.
- Olib tashlandi (takror yoki ikkinchi darajali): "Tanlangan vakansiyalar" (yangilari bilan ikkinchi ro'yxat), ishonch
  bo'limi, ish beruvchilar bloki (hero'dagi "Menga ishchi kerak"ni takrorlardi), "Qanday ishlaydi" (birinchi ochilishda
  /start tanishtiruvida bor). Ishlatilmay qolgan kod (`FeaturedJobs`, `TrustedEmployers`, `EmployerBand`, `HowItWorks`)
  o'chirildi. Testlar moslandi (home-market, entry).

## 2026-11-13 · Bosh sahifa soddalashtirildi — 1-bosqich (`claude/ux-simplify`)

- Ega: "ISH TOPDIM — complete UX/UI simplification": bosh sahifada faqat joylashuv, salomlashuv, katta qidiruv, tezkor
  yo'llar, yangi e'lonlar va alohida "Universal ustalar". Audit va reja — `docs/UX_SIMPLIFICATION_2026-11.md`.
- Ish izlovchi bosh sahifasi: 11 blokdan 4 ga. Kompyuterda joylashuv tanlovi salomlashuv ustida (telefonda — yuqori panelda).
  Yangi ishlar to'liq kenglikda. Yangi `MastersHomeSection` — o'z yashil rangida: 7 ta xizmat turi (katalogdan) va
  "Ustalarni ko'rish".
- Ko'chirildi (o'chirilmadi): "Mening dunyom" va bugungi reja → Profil (`/cabinet#dunyo`, /dunyo tugagach shu yerga);
  "Mening faoliyatim" → "Arizalar" va Profil sarlavhasi; "O'zim haqimda e'lon" → pastki menyu "E'lon"; "Yangi ish chiqsa
  xabar" → Profil → AI PRO; AI kartasi → yuqori panel ✨ / yon menyu / Profil.
- Ish beruvchi: "Bo'limlar" ro'yxati olib tashlandi (menyuni takrorlardi), mehmon-ish beruvchidagi AI va xabar kartalari ham;
  "Universal ustalar" bo'limi qo'shildi.
- Bugungi reja qadamlari 44 px (bosish maydoni). Testlar yangi tuzilishga moslandi (home, ai-entry, masters, world,
  responsiveness).

## 2026-11-13 · Har bir sahifa tepasida "‹ Orqaga" (`claude/global-back`)

- Ega: "orqaga qaytish topolmayapti — har bir oynaning tepasida kichkina orqaga chiqib tursin". Telegram ichida brauzerning
  orqaga tugmasi ko'rinmaydi. Endi har bir sahifada (bosh sahifa, ish beruvchi bosh sahifasi va ustalar bosh sahifasidan
  tashqari) tepada kichik "‹ Orqaga" (`GlobalBack`): telefonda — yuqori panelda logotip oldida (birinchi ekrandagi e'lonlar
  joyi o'zgarmaydi; tor ekran/katta shriftda logotip o'rnida), kompyuterda — sahifa tepasida qator, ustalar mini-ilovasida —
  qator. Sayt ichidan kelingan bo'lsa — aynan oldingi sahifaga, havola orqali ochilgan bo'lsa — eng yaqin bo'lim sahifasiga
  (masalan, /employer/vacancies).
- Telegram/Instagram tugmasi katta shriftda tor ekranga sig'adi (@manzil qisqartiriladi).
- Sahifaning o'z "Orqaga"si bo'lsa (`data-page-back`: vakansiya, e'lon, nomzod, namuna, moslik, chat, qidiruv qadamlari) —
  umumiysi yashiriladi (ikkita bo'lmaydi). Sarlavha yonidagi kichik "‹" (PageHeader) — umumiy "‹ Orqaga" bor joyda yashirin,
  hamma joyda bir xil ko'rinish. Menyusiz e'lon berish ustasida — pastdagi katta "Orqaga" tugmasi (avvalgidek).

## 2026-11-13 · Ish beruvchi o'z e'lonini ish izlovchi ko'zi bilan ko'radi (`claude/employer-preview`)

- Ega: "ish beruvchi e'lon joylagandan keyin o'z e'lonini ish izlovchilar kabinetda qanday ko'rishini bilmoqchi".
- Boshqaruv sahifasida (`/employer/vacancies/[id]#korinish`) yangi blok "Ish izlovchilar qanday ko'radi":
  ko'rinish holati (ko'rinmoqda / tekshiruvda / qoralama / to'xtatilgan / yopilgan / yashirilgan), ish izlovchi shu kasbni
  shu hududda qidirganda e'lon nechanchi o'rinda chiqishi (o'sha qidiruv funksiyasi va tartibi, birinchi 50 ta ichida;
  topilmasa o'rin aytilmaydi) va ro'yxatdagi kartaning o'zi (`src/features/vacancies/seeker-view.ts`).
- `/jobs/[slug]?korinish=izlovchi` — faqat e'lon egasiga: sahifa ish izlovchi ko'radigandek (ariza, saqlash, aloqa),
  ustida tushuntirish va "Boshqaruvga qaytish"; tugmalar o'chiq (`inert`), ko'rishlar soni oshmaydi. Boshqalarga parametr
  ta'sir qilmaydi.
- Kirish nuqtalari: e'lon joylangach (oddiy oqim) "Ish izlovchilar qanday ko'radi"; "Vakansiyangiz joylandi" bannerida;
  boshqaruvdagi "Ish izlovchi ko'zi bilan" tugmasi va vakansiyalar ro'yxatidagi menyu.
- E2E: `employer-seeker-view.spec.ts` (o'rin, karta, ko'rinish, tekshiruvdagi e'lon, begona foydalanuvchi), `journeys`.

## 2026-11-12 · "Yangi" yozuvi o'rniga yozuvsiz nuqta; AI va ustalar bo'rtib turadi (`claude/standout-no-badge`)

- Ega: "yangi degan so'zlar kerak emas, qandaydir bo'rtib chiqib tursa bo'ldi; ranglar yomon emas". "YANGI" yozuvli
  belgilar olib tashlandi. O'rniga kichik yonib-o'chuvchi nuqta (`NewDot`, `.new-dot`, rangi — bo'lim rangi; harakatni
  kamaytirish sozlamasida to'lqinsiz) — AI yordamchi, Universal ustalar, "Ishlar xaritada" va bosh sahifadagi "Xaritada
  ko'rish". AI yordamchi va Universal ustalar yon menyuda va kartalarda rangli soya bilan bo'rtib turadi (ustiga kelganda
  biroz ko'tariladi). Ranglar o'zgarmadi. Nuqtalar 2027-01-15 da o'zi yo'qoladi; "Yangi" so'zi faqat ekran o'quvchiga.

## 2026-11-12 · AI yordamchi to'q sariq rangda; muhim yangi bo'limlarda "Yangi" belgisi (`claude/ai-orange`)

- Ega: "AI yordamchi boshqacha, orange rangda ajralib tursin; muhim yangiliklar ham ajralib tursin". Yangi rang tokenlari
  `--ai`, `--ai-soft`, `--ai-bright` (kontrast testlari bilan, docs/DESIGN_SYSTEM.md). AI yordamchi endi hamma joyda to'q sariq:
  yon menyu (turkuaz "Universal ustalar" kabi ajratilgan), yuqori menyu, telefon sarlavhasidagi belgi, bosh sahifa va kabinet
  kartasi, AI belgisi (suhbatda), "Tez va qulay e'lon" kartasi.
- "Yangi" belgisi: AI yordamchi, Universal ustalar, yon menyudagi yangi "Ishlar xaritada" (ish izlovchi), bosh sahifadagi
  "Xaritada ko'rish". Belgilar 2027-01-15 da o'zi yo'qoladi (`src/config/new-features.ts`).

## 2026-11-12 · Telegram va Instagram havolalari ko'rinadigan joylarda (`claude/social-links`)

- Ega: "instagram ishtopdim, telegram ish_topdim_uz — bosilsa olib boradigan qilib qo'shib qo'y". Rasmiy sahifalar (Vercel'dagi
  `SOCIAL_TELEGRAM_URL`, `SOCIAL_INSTAGRAM_URL`) endi belgili tugmalar: sayt pastki qismi (@manzil bilan), kompyuterdagi chap
  yon menyu ("Biz ijtimoiy tarmoqlarda"), telefonda kabinet sahifasi va "Yordam" sahifasi. Bosilsa yangi oynada ochiladi.
- Sozlanmagan tarmoq ko'rsatilmaydi (soxta havola yo'q); faqat `https://` havolalar.

## 2026-11-12 · AI yordamchi sahifasi butun ekranni egallaydi (`claude/ai-fullscreen`)

- Ega skrinshoti: `/ai` katta monitorda o'rtada kichik oyna edi. Endi kompyuterda suhbat oynasi ekran balandligini to'ldiradi
  (yozish maydoni pastda, ChatGPT kabi), 1536 px dan keng ekranda sahifa butun kenglikni egallaydi; yon panellar 1920 px dan
  kengroq. Xabarlar ustuni o'qish qulay bo'lishi uchun 1024 px dan oshmaydi; yangi suhbatda salomlashuv o'rtada.

## 2026-11-12 · Katta monitorlarda ekran to'liq ishlatiladi (`claude/wide-screens`)

- Ega: "nimaga haqiqiy saytlarga o'xshab butun ekranni egallamayapti" (2560 px monitor). Ro'yxat va bosh sahifalar endi
  `container-wide` da: 1536 px dan 1440, 1920 px dan 1760, 2400 px dan 2080 px gacha kengayadi (avval hamma joyda 1152 px).
  Kartalar ustunlari ko'payadi: bosh sahifa lentasi 3–4, qidiruv natijalari 2–4, namunalar 4–5, kompaniyalar va kasblar 4–5,
  ustalar 5–8, nomzodlar 2–3. Bosh sahifa qidiruv kartasi katta ekranda ikki ustun (o'ngda AI yordamchi va Universal ustalar).
- Matnli sahifalar (vakansiya, profil, kompaniya) — avvalgicha 1152 px: juda uzun qator o'qishga noqulay.
- Yangi o'lchamlar: `3xl` (1920 px), `4xl` (2400 px). 1440 px va undan kichik ekranlarda hech narsa o'zgarmadi.
## 2026-11-12 · "Tez va qulay e'lon — AI yordamchi bilan" (ish izlovchi) (`claude/post-ai-chat`)

### Mahsulot
- Ega: "kuryerlikdan ish qidirmoqchiman desa, e'lon uchun kerakli narsalarni AI o'zi so'rasin". E'lon berish (va
  o'zgartirish) sahifasining 1-qadamida suhbat: foydalanuvchi bir gap yozadi → yordamchi yetishmayotganlarini **birma-bir**
  so'raydi: kasb (bir nechta mos kelsa — "Aniqrog'i qaysi biri?" tugmalari: piyoda, moto, ekspress kuryer…), viloyat, tuman
  (yoki "Butun viloyat"), tajriba, grafik (yoki "Farqi yo'q"), maosh (yoki "Kelishiladi"), ism va telefon (faqat noma'lum
  bo'lsa), o'zi haqida (yoki "Javoblarimdan tuzib ber" — faqat aytilgan faktlardan). Har javobni tugma yoki matn bilan
  berish mumkin ("Toshkent, Chilonzor", "3 yil", "6 mln"); tushunilmasa — savol qayta beriladi.
- Birinchi gapdan tushunilganlar qayta so'ralmaydi ("Samarqandda oshpaz, 3 yil tajriba" → faqat tuman va qolganlari).
- Oxirida qisqa xulosa va "Tekshirish va joylash" — qoralama to'ldiriladi, tekshirish sahifasi ochiladi; hech narsa o'zi
  joylanmaydi. AI kaliti ishlamasa ham suhbat to'liq ishlaydi (lug'at va ma'lumotnoma); AI bo'lsa — uzun birinchi gapdan ism
  va "o'zim haqimda" ham olinadi (faqat matndagi faktlar).
- "kuryerlikdan" kabi qo'shma qo'shimchali so'z endi "kuryer" deb tushuniladi (avval "Kuryerlik xizmati dispetcheri" ga
  tushardi) — bu AI qidiruvni ham tuzatadi.

### Xavfsizlik
- Har bir javob taqiqlangan mazmunga tekshiriladi (e'longa ham, AI'ga ham bormaydi); yangi qoida: "giyohvand … sotaman /
  tarqataman / yetkazaman" (lotin va kirill). Soatlik limit: kirgan foydalanuvchi 120, mehmon 60 xabar.

## 2026-11-12 · AI yordamchi namuna e'lonlarni ko'rsatadi; "… kerak" statistika emas, qidiruv (`claude/ai-demo-samples`)

### Mahsulot
- Ega: "Namuna e'lonlarda Avtoinstruktor bor, AI esa 0 ta deydi". Endi haqiqiy vakansiya topilmasa (ish qidirishda, kasb
  tushunilganda) AI javobi ostida **shu kasb bo'yicha namuna e'lonlar** chiqadi (bo'lmasa shu sohadagilar) — "Namuna e'lonlar —
  haqiqiy emas" sarlavhasi, "Namuna" belgisi, ariza tugmasi yo'q; javob matni ham buni ochiq aytadi. Namunalar natijalar soniga
  va statistikaga **kirmaydi**; statistika javobida alohida qator: "Namuna e'lonlar: 1 ta — haqiqiy emas".
- "Maosh va talab" savolidan keyin "avto instruktor kerak" kabi xabar statistikaning davomi deb olinardi (0 ta deb javob). Endi
  "kerak", "bormi", "izlayapman", "нужен", "ищу", "need" kabi so'zli xabar — yangi qidiruv.
- AI modeli ham biladi: namunalar haqiqiy ish emas, sanalmaydi, ularga ariza tavsiya qilinmaydi.

### Kuzatuv
- AI chaqiruvi xato bersa (javob "oddiy rejim"da chiqadi) — sababi Vercel jurnalida ham yoziladi (`[ai] … failed …`; kalit va
  foydalanuvchi matni yozilmaydi). Admin bosh sahifasidagi "AI holati" kartasida ham ko'rinadi.

## 2026-11-12 · Yaqin atrofdagi ishlar xaritasi (Yandex) va AI: bozor statistikasi, karyera (`claude/jobs-map`)

### Mahsulot
- **`/jobs/xarita` — yaqin atrofdagi ishlar Yandex xaritasida.** Hudud va tuman tanlanadi yoki "Mening joylashuvim" bosiladi
  (koordinata serverga yuborilmaydi: brauzer eng yaqin tumanni topadi, faqat tuman saqlanadi). Xaritada ko'k belgilar — haqiqiy
  e'lonlar (aniq manzil bo'lsa — o'sha nuqta, bo'lmasa — tuman markazi, ro'yxatda "taxminan" deb yoziladi), kulrang — namuna.
  Ostida raqamlangan ro'yxat (masofa bilan), "Yandex Xaritada ochish". Kirish: bosh sahifada "Xaritada ko'rish", "Yaqin atrofda"
  bo'limi, sayt pastki qismi.
- **AI yordamchi — bozor statistikasi:** "oshpaz maoshi qancha?" → bazadagi faol vakansiyalar, ish izlovchilar soni va oylik maosh
  oralig'i kartasi (kamida 3 ta e'lon bo'lsa; aks holda halol "e'lonlar kam"). AI ulangan bo'lsa — `market_stats` asbobi.
- **Maslahat AI'siz ham ishlaydi:** rezyume, suhbatga tayyorgarlik, karyera rejasi, vakansiya matni, suhbat savollari — bosqichma-
  bosqich yo'riqnoma ("AI ulanmagan" degan boshi berk javob o'rniga). Yangi tez tugma "Maosh va talab".

### Xavfsizlik
- CSP `frame-src`: faqat o'z sayt va Yandex xarita vidjeti (`yandex.ru`, `yandex.uz`, `yandex.com`); test bilan qotirilgan.

## 2026-11-12 · Namuna vakansiyalar — barcha sohalar bo'yicha (`claude/demo-vacancies`)

### Mahsulot
- **Har sohada 4 tadan namuna vakansiya** (38 soha, 152 ta): haqiqiy e'lon yo'q joyda — bosh sahifa, `/jobs` va qidiruvning bo'sh
  holatida — "Namuna" belgisi bilan alohida blokda. `/jobs/namuna` — hammasi; har namuna sahifasida "haqiqiy ish emas" ogohlantirishi.
- **Bir bosishda olib tashlash:** admin → "Namuna e'lonlar". Qaytarish ham bor.
- Namunalar haqiqiy e'lonlar bilan aralashmaydi: ariza, xabarnoma, statistika, sitemap'ga tushmaydi; kompaniya va telefon yo'q.

### Xavfsizlik (Universal ustalar)
- Usta e'loni, mijoz so'rovi va sharh matni saqlanishidan oldin tekshiriladi: aniq taqiqlangan mazmun (intim xizmat, giyohvand
  moddalar, karta/akkaunt savdosi, soxta hujjat, buzib kirish, ekstremizm) saqlanmaydi; shubhali belgilar (savdo, oldindan
  to'lov, spam …) admin navbatida ogohlantirish bo'lib chiqadi. Admin navbatida har e'lonning rasmlari ko'rinadi.

### Baza
- `0077_demo_vacancies.sql` (alohida jadval) — `supabase/prod/pending.sql` ga qo'shildi. 0076 va 0077: demo/namuna faqat
  birinchi o'rnatishda yaratiladi (fayl qayta qo'yilsa, olib tashlanganlari qaytmaydi).

## 2026-11-12 · "AI yordamchi" bo'limi menyularda; prod baza uchun bitta fayl (`claude/ai-entry-everywhere`)

### Mahsulot
- **"AI yordamchi" endi nomli bo'lim:** kompyuterda chap yon menyuda va yuqori menyuda, telefonda yuqori paneldagi belgi va bosh
  sahifadagi karta, "Kabinetim"da karta. Bosilganda `/ai` — suhbat oynasi (chap panel, so'nggi suhbatlar, jarayon izi).
  Avval sahifa bor edi, lekin unga olib boradigan nomli tugma yo'q edi.
- Bosh sahifada ikki bo'lim kartasi yonma-yon: "AI yordamchi" va "Universal ustalar".

### Baza
- **`supabase/prod/pending.sql`** — prod'da hali yo'q barcha migratsiyalar (0069…0076) bitta faylda: ega SQL Editor'ga bir marta
  qo'yadi. Bitta tranzaksiya, takror ishga tushirish xavfsiz; CI'da prod'ga o'xshash bazada sinaladi.

## 2026-11-12 · Universal ustalar — xizmat ko'rsatuvchi ustalar bozori (`claude/universal-masters`)

### Mahsulot
- **Yangi bo'lim `/ustalar`** (turkuaz, alohida mini-ilova): 12 xizmat kategoriyasi, qidiruv va filtrlar, usta kartalari, e'lon sahifasi.
- **Ustalar e'lon joylaydi** (kategoriya, tavsif, tajriba, hudud, narx, ish vaqti, rasmlar) va **kabinetda boshqaradi**: holatlar,
  ko'rishlar, telefon bosishlar, mijoz so'rovlari, reyting.
- **Mijoz** ustaga qo'ng'iroq qiladi (usta telefonni ochiq ko'rsatishga rozi bo'lsa) yoki so'rov yuboradi; kirgan foydalanuvchi sharh yozadi.
- **Moderatsiya:** yangi va o'zgartirilgan e'lonlar admin tasdig'idan keyin chiqadi; rad etish sababi egasiga ko'rinadi.
- **Demo e'lonlar:** har kategoriyada 4 tadan, "Demo" belgisi bilan, telefonsiz va reytingsiz; admin bir bosishda olib tashlaydi.
- **Kirish:** sayt menyusi, yon menyu, bosh sahifa va "Kabinetim" sahifasida turkuaz "Universal ustalar".
- 0076 hali qo'llanmagan bazada bo'lim "Bo'lim tayyorlanmoqda" deb ochiladi (xato ekrani yo'q); admin sahifasi buni aniq aytadi.
- Usta kartasida bog'lanish usuli: "Qo'ng'iroq qilish mumkin" yoki "Bog'lanish — so'rov orqali" (raqamning o'zi — e'lon sahifasida).

### Baza
- `0076_masters.sql` — **prod'ga egasi qo'llaydi** (`docs/RELEASE_CHECKLIST.md`). Qaytarish: `supabase/rollbacks/0076_masters.down.sql`.

## 2026-11-12 · AI yordamchi — "ChatGPT kabi" ish maydoni (`claude/ai-workspace`)

### Mahsulot
- **/ai sahifasi qayta qurildi:** chapda "Yangi suhbat", bo'limlar va **so'nggi suhbatlar** (qurilmada, 7 kun), profil;
  o'rtada suhbat — ism bilan salomlashuv, **"Bugungi ishlar"** (mos vakansiyalar soni, profil to'liqligi, arizalar — faqat
  bazadan) va **"Sizga mos ishlar"** kartalari; o'ngda karyera, tezkor imkoniyatlar va kunlik maslahat. Telefonda panel pastdan.
- **Jarayon ko'rinib turadi:** har javobda "Tushunildi → Bazadan qidirildi · N ta → Javob: sun'iy intellekt / oddiy rejim".
- AI ulanmagan rejimda "menga mos ish toping" — kasb so'raladi; maslahat savollariga AI yo'qligi halol aytiladi.

## 2026-11-12 · Bozorga tayyorlik: prod tekshiruvi, HTTP yuklama testi, ochiq ro'yxatlar keshi (`claude/market-readiness`)

### Tezlik
- Mehmon bosh sahifasi va vakansiya sahifasi katta bazada 7× tezroq: "Yangi e'lonlar / Yangi ishchilar" va "O'xshash vakansiyalar"
  ro'yxatlari 60 s keshda (foydalanuvchiga bog'liq emas); e'lon joylansa, yopilsa yoki holati o'zgarsa darhol yangilanadi.

### Vositalar
- `npm run prod:check` — prod'ni tashqaridan tekshirish (health, migratsiyalar, sahifalar, Telegram, to'lov, sarlavhalar).
- `npm run load:http` — HTTP yuklama testi (lokal stend / staging), `load/stand-app.sh` — prod kesh bilan stend.

### Hujjatlar
- `docs/STATUS.md` — joriy holat (bitta sahifa); `docs/SCALE.md` §8 — HTTP yuklama testi va sig'im taxmini;
  eski hisobotlar tarixiy deb belgilandi.

## 2026-11-11 · 2.0: ish beruvchi paneli, xush kelibsiz ekrani, cookie, Play Market (`claude/v2-employer-entry-play`)

### Mahsulot
- **Ish beruvchi bosh sahifasi va paneli noldan:** "Qanday xodim kerak?" + bitta AI qidiruv maydoni, 4 ta tez yo'l, katta
  "Vakansiya joylash"; panelda — ko'rsatkichlar, yangi arizalar, nomzodlar, faol vakansiyalar. Plitkalar, fon surati, oynalar
  olib tashlandi.
- **Kirish bitta ekran:** til qatori + ikkita rasmli karta (ish qidiryapman / ishchi qidiryapman) — bir bosishda o'z bosh
  sahifasiga, kirishsiz. Tanishtiruv slaydlari ixtiyoriy.
- **Cookie:** `/cookies` siyosati (4 tilda), bir martalik eslatma, footer havolasi. Maxfiylik siyosati: AI yordamchi va mikrofon.

### Play Market
- Yangi do'kon rasmlari (ikona, feature graphic, 6 skrinshot × uz/ru) 2.0 dizaynda; hujjat yangilandi (Data safety: AI, mikrofon).

## 2026-11-11 · AI HR yordamchi: tabiiy suhbat va ovoz (`claude/ai-hr-assistant`)

### Mahsulot
- **AI yordamchi endi suhbatlashadi:** oldingi xabarlarni hisobga oladi, avval javob beradi, keyin bitta savol so'raydi;
  o'zbek (lotin, kirill), rus va ingliz tilida — foydalanuvchi qaysi tilda yozsa. Sun'iy intellekt ekanini yashirmaydi.
- **Vakansiya va nomzodlar faqat bazadan:** kartalar bazadagi ma'lumotdan chiziladi; model hech narsa o'ylab topa olmaydi.
- **Javob oqim bilan chiqadi**, to'xtatish mumkin; tavsiya savollar; uzun matndan nusxa olish.
- **Ish izlovchi:** rezyume yozishga yordam, suhbatga tayyorgarlik, profilidagi kasb va hudud bo'yicha qidirish.
- **Ish beruvchi:** nomzod qidirish, vakansiya matni, suhbat savollari. Yakuniy qaror — ish beruvchida.
- **Ovoz:** katta mikrofon, aytilgan gapni tekshirib yuborish, javobni o'qib berish (qurilma qo'llasa), istalgan payt to'xtatish.

### Ishonchlilik va xavfsizlik
- AI ishlamasa (xato, limit, 30 soniya) — foydalanuvchi baribir o'z tilida javob va bazadagi natijani oladi.
- API kaliti faqat serverda; suhbat matni va ovoz serverda saqlanmaydi; soatlik limit va kunlik AI byudjeti.
- Tuzatildi: hudud nomi kasb deb tushunilishi ("Samarqandda" → noto'g'ri kasb).

## 2026-11-11 · 2.0: sodda bosh sahifa va "yo'q" demaydigan AI qidiruv (`claude/v2-sodda-qidiruv`)

### Mahsulot
- **Ish izlovchi bosh sahifasi noldan:** bitta savol, bitta qidiruv maydoni, 4 ta tez yo'l, yangi ishlar. Fon surati, nol
  ko'rsatkichlar, plitkalar, bo'limlar va katalog olib tashlandi.
- **AI qidiruv:** aniq so'rov bo'sh chiqsa qidiruvni o'zi kengaytiradi (tuman → viloyat → butun O'zbekiston → shartlarsiz →
  yaqin kasb) va buni ochiq aytadi. Kasb tushunilmasa ham hudud/maosh/grafik bo'yicha qidiradi.
- **Kasb ro'yxatida yo'q so'z** (do'kon/kompaniya nomi, erkin lavozim): e'lon matnlaridan qidiradi va qaysi so'z bo'yicha
  topganini aytadi.
- **Hech narsa bo'lmasa:** halol javob + "Yangisi chiqsa — Telegram'da xabar bering" (yozgan matni tayyor) + "O'zim haqimda
  e'lon berish". Soxta e'lon yoki foiz yo'q.

### Ishonchlilik
- Sahifa to'liq yuklanmasdan "Topish" bosilsa, so'rov `/ai?q=…` sahifasida bajariladi (avval sahifa qayta ochilib qolardi).

### Admin
- "Bosh sahifa" izohlari yangilandi: oynalar faqat ish beruvchi bosh sahifasida; AI o'chirilsa — oddiy matnli qidiruv.

## 2026-11-07 · 0-bosqich: barqarorlashtirish (`claude/phase-0-barqarorlik`)

### Xavfsizlik
- Next.js 16.3.8 → **16.4.5** (kritik advisory'lar: Image Optimization RCE, Server Actions DoS, `use cache` RCE).
  `eslint-config-next` ham 16.4.5. `npm audit --omit=dev` — 0 zaiflik.
- **0074 aloqa maxfiyligi:** qidiruv ro'yxatlari (vakansiya v1/v2/v3, ishchi v1/v2) endi telefon qaytarmaydi — anonim
  ommaviy yig'ish yopildi. Raqam faqat bitta e'lon sahifasida, kirgan va faol foydalanuvchiga, soatiga 40 / sutkasiga 150 ta
  turli e'lon limiti bilan (`contact_reveals`). `telegram_accounts.phone` foydalanuvchi sessiyasidan (barcha admin
  rollaridan ham) o'qilmaydi — faqat server kaliti.
- Vakansiya sahifasida mehmonga raqam o'rniga "Kirish" taklifi.

### Ishonchlilik
- **0075 webhook:** qayta ishlashda xato bo'lsa update yo'qolmaydi — 3 urinishgacha 500 (Telegram qayta yuboradi),
  keyin 200 (navbat to'xtamaydi); xato `telegram_updates.last_error` da.
- **`/api/health`**: ochiq holat (baza ulanishi, reliz). `?deep=1` + `CRON_SECRET` — prod bazada yetishmagan migratsiyalar.
- **Sentry** (faqat server, `SENTRY_DSN` bo'lsa): render/route/action xatolari, webhook va cron. Telefon va e-mail
  yuborishdan oldin yashiriladi, so'rov sarlavhalari yuborilmaydi.

### Mahsulot
- Qidiruv kartasidagi o'z arizasi holati endi holat rangida: "Rad etildi" — qizil (avval yashil "✓" edi).
- Faol vakansiyasiz kompaniyalar sitemap'dan chiqarildi va sahifasi `noindex` (prod'dagi sinov kompaniyalari indeksga tushmaydi).

### CI
- `tsc` rasm importlarini taniydi (`src/types/next-images.d.ts`) — CI typecheck qadami tuzatildi.

### Ega amallari
`docs/RELEASE_CHECKLIST.md`: zaxira → `scripts/prod-migration-check.sql` → 0069–0075 → kod → `/api/health`.
