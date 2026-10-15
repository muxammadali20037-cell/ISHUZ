# Professionallashtirish — ish jurnali

Manba: `ISHUZ_Professional_Audit_va_Prompt_2026-10-11_1.md` (audit tayanch commiti `506473a`).
To'liq natija va dalillar: [PROFESSIONALIZATION_REPORT.md](PROFESSIONALIZATION_REPORT.md). Bu fayl — keyingi sessiya qayerdan
davom etishini ko'rsatadigan qisqa holat. Bir xil auditni qaytadan boshlamang.

Oxirgi yangilanish: 2026-10-15 · branch `claude/gallant-thompson-q70fo3` (qayta loyihalash R-A…R-G; main'ga hali qo'shilmagan).

## Bosqichlar

| Bosqich | Holat | Commit |
|---|---|---|
| A — boshlang'ich dalil | ✅ bajarildi (stack, route'lar, forma maydonlari solishtirildi; baseline testlar; production read-only holati) | — |
| B1 — qoralamalar (F-03) | ✅ | `5e686ae`, `5abef32` (handoff tuzatishi) |
| B2 — qidiruv xato/bo'sh (F-04) | ✅ | `8366626` |
| B3 — katalogda yo'q kasb (F-05) | ✅ (0057 production'da) | `ffe7556` |
| B4 — ishonchli upload (F-06) | ✅ vakansiya rasmi (0058 production'da) · avatar/logo — ochiq | `1236594` |
| B5 — zaxira (F-01) va 0056 (F-02) | ✅ zaxira production'da ishlayapti (2026-10-12) · ✅ 0056 production'da | `8bb81da`, `2f73f5c` |
| C — UX/a11y | ✅ o'lchangan tuzatishlar (kontrast, nishon o'lchami, planshet sarlavhasi, tez birinchi chizish) | shu sessiya oxirgi commit |
| D — o'lchov | ✅ lab o'lchovi · ❌ staging yuklama testi va field web-vitals — NOT_RUN | — |
| E — E2E + CI | ✅ 24 spec CI'da (izolyatsiyalangan stend) | `5abef32` va keyingilar |
| C8.1a — UI ovozlari | ✅ olib tashlandi | `6493eb6` |
| C8.1b — qotishlar | ✅ 4 ta o'lchangan qotish ([PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md)) | `3581aa0` |
| C8.1c — brend tizimi | ✅ tokenlar, shkalalar, qorong'i mavzu kontrasti, UI kit `/dev/ui`, [BRAND_UI_GUIDE.md](BRAND_UI_GUIDE.md) | shu bosqich |
| C8.2 — bosh sahifa, navigatsiya | ✅ aniq yo'llar, neytral kartalar, tur olib tashlandi, prefetch qotishi (Q8) | `8f5baca` |
| C8.3 — qidiruv, filtr, kartalar | ✅ rasm zaxirasi, filtr sinxroni, bo'sh natija, kirill "ёъ" xatosi | `b595af3` |
| C8.4 — ishchi e'loni | ✅ telefon formati (3 forma + login), sarlavha "Kirish" javoblarni saqlaydi, to'liq yo'l E2E | `48c53fe` |
| C8.5 — vakansiya e'loni | ✅ eskirgan xatolar tozalanadi (ikkala forma), ish beruvchi to'liq yo'li E2E | `8eea94f` |
| C8.6 — kirish va hisob | ✅ to'g'ri sarlavha, oflayn/server xatolari, 44 px; haqiqiy Telegram — BLOCKED | `e705ab0` |
| C8.7 — kabinet, e'lon, profil | ✅ yopuvchi amal neytral, "… gacha" muddat, o'zbekcha bandlik turi, "hozirgina", neytral tanlov va holat | `c3243f0` |
| C8.8 — arizalar, takliflar, chat, bildirishnomalar | ✅ ikki rol E2E; kabinetda arizalar soni, ish beruvchiga uchinchi shaxs sabablari, "Botir ." va foiz yo'q, rolga mos chat bo'sh holati, mobil'da amallar yuqorida; realtime — NOT_RUN | `9f600ca` |
| C8.9 — sozlamalar, yordam, huquqiy, admin | ✅ yordam hozirgi nomlar bilan (+guard test), oz huquqiy matn, aloqa zaxirasi, Telegram ulash havolasi, "Boshqaruv paneli", "Ish beruvchi", admin 390 px | `f15254c` |
| C8.10 — to'liq regressiya | ✅ internet uzilganda sahifa yiqilmaydi (`callAction` hamma joyda), kirill sarlavhali vakansiya ochiladi, ru + 150% shriftda layout, "Butun shahar", `info` tokeni, J1 E2E; 32 mezon jadvali (FAIL 0, #18/#30 BLOCKED) va yakuniy xulosa — hisobot §5, §10, §11 | `1a0a556` |
| D1 — qadamlar sekinligi | ✅ kasb/viloyat/tuman mijozda: 526–551 → 74–134 ms (lab, RTT 400), server so'rovi 0; natijaga o'tishda darhol kutish belgisi; production vaqti — NOT_RUN | `6eb9060` |
| D2 — avatar va logotip karantini | ✅ yopiq bucket → server → EXIF'siz WebP `v-<sha256>`, baza triggeri; 0059 production'da (2026-10-13) | `8407d92` |
| D3 — rasmli oynalar va kunlik ishlar | ✅ bosh sahifa tepasida 3 oyna (nomi rasm tagida), "Oylik/Kunlik" forma, "Kunlik ishlar" ro'yxati; 0060 production'da (2026-10-13) | `ccd9c19` |
| D4 — "O'zingizga mosini toping" lupa | ✅ o'ng pastda doim; qisqa matn → "Tushundim" + mos e'lonlar shu oynada; pastki menyu/yopishqoq panellarni yopmaydi | `ef2ca0a` |
| D5 — Telegram'da oson kirish | ✅ Mini App ochilishi bilan avtomatik kirish (bir marta); haqiqiy qurilma — BLOCKED; Telegram Web iframe — ochiq | `3fb690f` |
| D6 — admin "Bosh sahifa" | ✅ oynalar (rasm, matn 4 tilda, tartib, ko'rinish) va lupa tugmasi admin paneldan, audit + kesh; telefon paneli va standart matn ko'rinishi tuzatildi; hisobot §12 | `5d816c4` + shu bosqich |
| D7 — oynalar ixchamroq (my.gov.uz kabi) | ✅ telefonda 286×281 → 136×191 px, 2 tasi to'liq ko'rinadi, nomi kesilmaydi; kompyuterda 306 → 247 px; admin eslatmasi | `3136d4d` |
| E1 — ish izlovchi / ish beruvchi alohida | ✅ birinchi ochilishda "Siz nima qidiryapsiz?"; keyin faqat o'z rejimining oynalari, qidiruvi, lupasi, e'loni; boshqa rejim bo'limi — tushuntirish va tasdiq; e'lon berishdan oldin "Sizga xodim kerakmi?"; admin oynalariga "Kimga ko'rinadi" | `d06a93d` |
| E2 — "Saqlanganlar" pastki menyuda | ✅ profilsiz saqlash (0061 `saved_items`, RLS, 500 limit), kartalarda "Saqlash", `/saved` rejimga mos, mehmonga tushuntirish; ✅ 0061 production'da (2026-10-14) | `d06a93d` |
| E3 — yaqin atrofda | ✅ joylashuv → eng yaqin tuman → barcha kasblar (koordinata serverga bormaydi), tuman 180 kun eslab qolinadi, viloyat qadamida "Joylashuvim bo'yicha" | `d06a93d` |
| F — to'lov qulay va professional | ✅ to'lov paneli e'lon natijasi ekranida (foyda, kunlik narx, ishonch, oxirgi usul birinchi — Payme/Click'gacha 1 bosish); hamyon (0062/0063: to'ldirish + ixtiyoriy bonus, balansdan bir bosishda, atomar); "To'lovlarim", chek, "Qayta to'lash"; to'langan e'lonni o'chirish xatosi tuzatildi; ✅ 0062–0063 production'da (2026-10-14) | `4788373` |
| G — ish/ishchi topish oson | ✅ "Ish topish" bosilgan zahoti "Barcha ish e'lonlari · N ta" va eng yangi 3 tasi (ro'yxatgacha 5→3, menyudan 4→2 bosish, yozish yo'q); profilsiz tezkor ariza (anketa o'rniga 2 bosish, kirgach oyna o'zi ochiladi; 0064 — ish beruvchi arizachini ko'radi, bayroqsiz bazada eski yo'l); kartada "Ariza yuborish" / "Bog'lanish"; ishchi e'lonida bir bosishda raqam so'rovi; ✅ 0064 production'da (2026-10-14) | `e9dd099`, `9d4cbd8` |
| H — ixcham natijalar kartasi | ✅ 390 px ekranda 1 → 3 ta karta (karta 479 → 151 px), 360 px'da 0 → 2; butun karta bosiladi, "Batafsil" yo'q; pastda bitta qatorda kichik "Qo'ng'iroq" / "Ariza yuborish" / "Bog'lanish", "Saqlash", jadval, sana; sarlavhada kichik "Orqaga"; kompyuterda 2 → 8 ta | `4a42710` |
| I — ixcham e'lon sahifalari | ✅ ish e'loni: nomi → maosh → ish beruvchi → joy birinchi ekranda, faktlar ikki ustunda, qo'ng'iroq tavsifdan oldin, "Talablar va qulayliklar" bitta blok, o'xshashlar ixcham qatorda; sahifa 2016 → 1702 px; ishchi e'loni: ism 459 → 173 px, "Bog'lanish" birinchi ekranda; "Orqaga" — o'sha qidiruv natijalariga; kompaniyasiz ish beruvchi nomi tuzatildi ("Ish beruvchi" emas) | `4bc38cd`, `fcef075` |
| J — natijalar sahifasi (ishgo uslubi) | ✅ tepada qidiruv qatori + "Filtr", kichik sarlavha, soni, "O'zgartirish"; telefonda birinchi karta 241 → 207 px; kompyuterda bitta ustun + o'ng panel (e'lon berish, statistika, yirik ish beruvchilar — ochiq ma'lumot, 10 daq. kesh); o'z tizimi (rejimlar, kasb/hudud qadamlari, aqlli qidiruv) saqlandi; CI tuzatishi: bo'sh `/search` endi haqiqiy 307 (oldin 200 + `<meta>` — sahifa ikki marta yuklanardi), qidiruv qatori sahifani qayta yuklamaydi (`next/form`) | `2f2a7ac`, `36a5ef0` |
| K — harakat va bosish tezligi (AVTODROM uslubi) | ✅ sahifa yuklanayotganda yuqori panel, pastki menyu va lupa joyida (oldin 134–593 ms yo'qolardi), bosilgan bo'lim darhol faol; kontent 350 ms da pastdan chiqadi (skeletdan keyin 200 ms ochiladi); o'zgarishlar 200 ms; oyna 300 ms kattalashib; bildirishnoma o'ngdan + vaqt chizig'i; skelet shimmer; kompyuterda hover ko'tarilish | `7f3c9dd` |
| R-A — qayta loyihalash auditi | ✅ joriy ekranlar 390/1280 px, topilmalar turi bilan (XATO / UX / XAVF) va dalil — `docs/REDESIGN_AUDIT.md` | `3d56138` |
| R-B — brend konfiguratsiyasi, rolga xos menyu | ✅ `src/config/brand.ts` (31 joy), ish qidiruvchi: Ishlar · Saqlanganlar · Arizalar · Profil; ish beruvchi: Bosh sahifa · Vakansiyalar · Nomzodlar · Profil; ishbay qo'shimchasi, `/employer` 36 px siljish | `f6b11d2` |
| R-C — bosh sahifa, qidiruv, kartalar | ✅ birinchi ekranda qidiruv + tez filtrlar + haqiqiy e'lonlar ("Sizga mos" / "Yangi ishlar", rejim so'ralmaydi); ish beruvchi paneli (oddiy tugma, haqiqiy ko'rsatkichlar); matn → kompaniya/lavozim bo'yicha natija; faol filtr chiplari; karta tartibi, tasdiq belgisi, ariza holati; inputlar 16 px; topilgan xato X1 (mos nomzodlar doim bo'sh edi) tuzatildi | `a52001b`, `4d97e68` |
| R-D/E — asosiy oqim qo'riqlari | ✅ 0065: muddati o'tgan vakansiyaga ariza yo'q, qidiruvda yo'q; yopilgan vakansiya bo'yicha taklif qabul qilinmaydi; admin MFA kaliti — faqat super_admin (lokal SQL testlar; **production'ga qo'llash egasi ruxsatini kutadi**); kirish/profil to'ldirishdan keyin ariza oynasiga qaytish; profilsiz "Arizalar"; klaviatura; taklif maoshi davri bilan; kasb meta-audit | `f012106`, `71c362a` |
| R-F/G — moslashuv, tillar, a11y, tezlik, yakuniy tekshiruv | ✅ 12 sahifa × 6 kenglik (uz) va × 3 (ru): siljish/kesilish/ustma-ust 0; ru/oz/en da kesilgan asosiy ma'lumot (rejim tugmasi, ishchi maoshi va tajribasi, "сум/мес" bo'linishi) tuzatildi; "dan 4 000 000 so'm" → "kamida …"; kirillda "сўм"; `lang="uz-Cyrl"`; a11y 3 sahifaga kengaytirildi, kichik bosish maydonlari tuzatildi; zod mijoz JS'idan chiqarildi (−89 KB, lab); yakuniy hisobot `docs/REDESIGN_REPORT.md` | (shu commit) |

## Keyingi sessiya uchun

00. Qayta loyihalash (R-A…R-G) yakunlandi — natija, testlar va ochiq masalalar: [REDESIGN_REPORT.md](REDESIGN_REPORT.md).
    **0065 (`apply_guards`) production'ga qo'llanmagan — egasining alohida ruxsati kerak.** Main'ga birlashtirish va deploy — alohida ruxsat bilan.
0. C8, D (D1–D7), E (E1–E3, §13), F (to'lov, §14), G (ish/ishchi topish oson, §15), H (ixcham kartalar, §16), I (ixcham e'lon sahifalari, §17), J (natijalar sahifasi, §18) va K (harakat va bosish tezligi, §19) yakunlandi. Keyingi ish — hisobot §11 "Production relizni nima to'sib turibdi" va C8.10 "ochiq" ro'yxati
   (staging, `SUPPORT_EMAIL`, #30 haqiqiy qurilmada, tarmoq sekinlashtirish testi).
   Yangi o'zgarishda: OLDIN/KEYIN/fayllar/skrinshot/test/ochiq masala; yangi test eski build'da yiqilishini ko'rsating.
   "Oldin" skrinshoti: `bash e2e/screens/old-build.sh <commit>` (:3301, o'sha stend bazasi), oxirida `… <commit> stop`.
1. ✅ 0056 → 0057 → 0058 production'da (2026-10-11, read-only tekshirildi). Saytni brauzerda tekshirish: "Kasbim topilmadi", rasm yuklash.
2. ✅ Zaxira sirlari sozlandi, birinchi shifrlangan nusxa yaratildi (run `38207925133`). Egasi: bir marta yopiq kalit bilan ochib ko'rsin (`age -d`).
3. ✅ Avatar va logotip karantini (D2). ✅ 0059 va 0060 production'da (2026-10-13, egasi ruxsati bilan; tekshiruvlar — hisobot §12 "Production").
   Egasi: telefonda 2 daqiqalik tekshiruv (o'sha bo'lim).
3b. ✅ E/F/G: 0061 (`saved_items`), 0062–0063 (hamyon), 0064 (tezkor ariza) production'da (2026-10-14, egasi ruxsati
    bilan; tekshiruvlar — hisobot §15 "Production"). Egasi: telefonda 2 daqiqalik tekshiruv (o'sha bo'lim).
    F: haqiqiy Payme/Click kassasida bitta kichik to'ldirish bilan tekshirish — NOT_RUN; ofertaga hamyon bandi — egasi bilan.
    E ochiq: rejim tanlovi Telegram'da haqiqiy qurilmada — NOT_RUN; joylashuv
    aniqligi qurilmaga bog'liq (tuman markazigacha masofa); ish beruvchi panelidagi papkali saqlash (`/employer/saved`)
    alohida qoldi.
3a. D ochiq: Telegram Web (iframe) ichida avtomatik kirish cookie'si; lupa sahifa o'rtasida kontent tugmasi ustiga tushishi mumkin;
    haqiqiy AI provayderi bilan lupa — NOT_RUN (stendda kalit yo'q).
4. Ochiq: TS matching dvigatelini SQL v2 ga ko'chirish yoki olib tashlash (paritet suite — 18 skip; sababi hisobotda).
5. Ochiq: staging'da aralash HTTP yuklama testi (F-09) va real qurilmada web-vitals.
6. Ochiq: login (Telegram kod) — kechikish/qayta yuborish/offline holatlari uchun E2E (haqiqiy bot kerak — BLOCKED).

## Qanday tekshiriladi

```bash
npm run lint && npm run typecheck && npm test           # unit
bash scripts/db-test.sh                                  # SQL (lokal PostgreSQL, toza baza)
bash e2e/stack/up.sh && npx playwright test -c e2e       # brauzer E2E (lokal stend)
node e2e/perf/lab.mjs 3                                  # lab tezlik o'lchovi → e2e/.stack/perf.json
node e2e/screens/capture.mjs http://localhost:3300 after # ekranlar → docs/screenshots/
node e2e/screens/capture.mjs http://localhost:3300 x home-full,ui-kit /tmp/x  # tanlangan ekranlar, boshqa papka
```
