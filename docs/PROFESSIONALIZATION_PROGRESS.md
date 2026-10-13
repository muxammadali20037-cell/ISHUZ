# Professionallashtirish — ish jurnali

Manba: `ISHUZ_Professional_Audit_va_Prompt_2026-10-11_1.md` (audit tayanch commiti `506473a`).
To'liq natija va dalillar: [PROFESSIONALIZATION_REPORT.md](PROFESSIONALIZATION_REPORT.md). Bu fayl — keyingi sessiya qayerdan
davom etishini ko'rsatadigan qisqa holat. Bir xil auditni qaytadan boshlamang.

Oxirgi yangilanish: 2026-10-13 · branch `claude/gallant-thompson-q70fo3` (main bilan bir xil, fast-forward).

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
| E1 — ish izlovchi / ish beruvchi alohida | ✅ birinchi ochilishda "Siz nima qidiryapsiz?"; keyin faqat o'z rejimining oynalari, qidiruvi, lupasi, e'loni; boshqa rejim bo'limi — tushuntirish va tasdiq; e'lon berishdan oldin "Sizga xodim kerakmi?"; admin oynalariga "Kimga ko'rinadi" | shu bosqich |
| E2 — "Saqlanganlar" pastki menyuda | ✅ profilsiz saqlash (0061 `saved_items`, RLS, 500 limit), kartalarda "Saqlash", `/saved` rejimga mos, mehmonga tushuntirish; **0061 production'ga — egasi ruxsatini kutmoqda** | shu bosqich |
| E3 — yaqin atrofda | ✅ joylashuv → eng yaqin tuman → barcha kasblar (koordinata serverga bormaydi), tuman 180 kun eslab qolinadi, viloyat qadamida "Joylashuvim bo'yicha" | shu bosqich |

## Keyingi sessiya uchun

0. C8, D (D1–D7) va E (E1–E3, hisobot §13) yakunlandi. Keyingi ish — hisobot §11 "Production relizni nima to'sib turibdi" va C8.10 "ochiq" ro'yxati
   (staging, `SUPPORT_EMAIL`, #30 haqiqiy qurilmada, tarmoq sekinlashtirish testi).
   Yangi o'zgarishda: OLDIN/KEYIN/fayllar/skrinshot/test/ochiq masala; yangi test eski build'da yiqilishini ko'rsating.
   "Oldin" skrinshoti: `bash e2e/screens/old-build.sh <commit>` (:3301, o'sha stend bazasi), oxirida `… <commit> stop`.
1. ✅ 0056 → 0057 → 0058 production'da (2026-10-11, read-only tekshirildi). Saytni brauzerda tekshirish: "Kasbim topilmadi", rasm yuklash.
2. ✅ Zaxira sirlari sozlandi, birinchi shifrlangan nusxa yaratildi (run `38207925133`). Egasi: bir marta yopiq kalit bilan ochib ko'rsin (`age -d`).
3. ✅ Avatar va logotip karantini (D2). ✅ 0059 va 0060 production'da (2026-10-13, egasi ruxsati bilan; tekshiruvlar — hisobot §12 "Production").
   Egasi: telefonda 2 daqiqalik tekshiruv (o'sha bo'lim).
3b. **E: 0061 (`saved_items`) production'ga hali qo'llanmagan — egasi ruxsati kerak.** Usiz kod buzilmaydi: saqlash eski
    jadvallarga tushadi (profil talabi bilan). E ochiq: rejim tanlovi Telegram'da haqiqiy qurilmada — NOT_RUN; joylashuv
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
