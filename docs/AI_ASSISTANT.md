# AI HR yordamchi — audit, arxitektura va bosqichlar

Ega topshirig'i (2026-11-11): Ish topdim'ga tabiiy, insoniy muloqot qiladigan AI HR yordamchi (matn va ovoz).
Bu hujjat — reja va holat. Har bosqich tugaganda yangilanadi.

## 1. Audit: loyihada hozir nima bor

| Qism | Holat | Fayl |
|---|---|---|
| Claude ulanishi (kalit faqat serverda) | bor, prod'da kalit sozlangan | `src/lib/ai/client.ts` |
| Qat'iy sxemali AI chaqiruvi, kunlik byudjet, jurnal | bor | `src/lib/ai/json.ts`, `usage.ts` |
| Matndan kasb/hudud/maosh ajratish (lug'at + AI) | bor | `src/features/find/ai-search.ts`, `smart.ts` |
| Bazadan qidirish, kengaytirish, matnli qidiruv | bor (2.0) | `src/features/find/ai-find-core.ts` |
| Suhbat oynasi (yozish, ovoz bilan aytish, tarix qurilmada) | bor, lekin "savol → natija" ko'rinishida | `src/features/find/components/ai-chat.tsx` |
| Ovozli kiritish | bor: brauzerning Web Speech API'si | `ai-chat.tsx` (`AiPromptBox`) |
| Ovozli javob (o'qib berish) | yo'q | — |
| E'lon/rezyume matnini AI bilan tuzish | bor (forma ichida) | `src/features/ai/components/*-composer.tsx` |
| Moslik dvigateli (sabablari bilan) | bor | `src/features/matching/` |
| Telegram xabarnomasi (AI PRO) | bor | `src/features/ai-alerts/` |

**Yetishmagani:** haqiqiy suhbat — kontekstni eslab qolish, tabiiy javob, bitta savol bilan davom ettirish, oqimli
(streaming) javob, ovoz bilan javob. Avvalgi oyna har xabarni alohida qidiruv deb ko'rardi.

**Texnologiya almashtirilmaydi:** Next.js 16, Supabase, Claude (Anthropic SDK), mavjud qidiruv funksiyalari.

## 2. Arxitektura

```
Brauzer (suhbat oynasi)                Server                                   Baza
  xabarlar (oxirgi 12 ta)  ──POST──▶  /api/assistant  ──▶ Suhbat dvigateli
                                         │  himoya: CSRF, limit, blok              │
                                         ▼                                         │
                                      Claude (oqim) ──asbob: search_jobs──▶ runAiFind ──▶ vakansiyalar
                                         │            search_workers                    nomzodlar
  ◀── NDJSON oqimi: status · text · results · suggestions · done ──┘
```

- **Suhbat dvigateli** (`src/features/assistant/engine.ts`) — sof modul, test qilinadi. Model suhbatni o'qiydi, kerak
  bo'lsa qidiruv asbobini chaqiradi; server bazadan haqiqiy e'lonlarni oladi; model shu natijaga tayanib qisqa javob yozadi.
- **Kartalar model matnidan emas, bazadan chiziladi** (`results` hodisasi). Model e'lon "o'ylab topsa" ham, ekranda faqat
  bazadagi e'lonlar ko'rinadi. Modelga telefon va ism berilmaydi.
- **AI ishlamasa** (kalit yo'q, kunlik byudjet tugadi, xato, 30 soniyadan oshdi) — lug'at va shablon javob
  (`replies.ts`): xuddi shu bazaviy qidiruv, foydalanuvchi tilida tayyor gap. Foydalanuvchi javobsiz qolmaydi.
- **Til:** xabar tili va yozuvi aniqlanadi (`language.ts`): o'zbek lotin, o'zbek kirill, rus, ingliz.
- **Xarakter va qoidalar:** bitta joyda — `prompt.ts` (avval javob, keyin ko'pi bilan bitta savol; emoji yo'q; AI ekanini
  yashirmaydi; o'ylab topmaydi; ishga olish bo'yicha yakuniy qaror chiqarmaydi; kamsitmaydi).

## 3. Maxfiylik va xavfsizlik

- API kaliti faqat serverda (`ANTHROPIC_API_KEY`), brauzerga chiqmaydi.
- **Suhbat matni serverda saqlanmaydi.** Tarix foydalanuvchi qurilmasida (brauzer xotirasi); serverga har safar faqat oxirgi
  12 ta xabar kontekst uchun yuboriladi. Jurnalga faqat tokenlar soni, kechikish va xato kodi yoziladi.
- AI provayderiga (Anthropic) boradigan ma'lumot: suhbatning oxirgi xabarlari, kirgan foydalanuvchining ismi (familiyasiz) va
  o'z e'lonidagi kasb/hudud/tajriba, hamda bazadan topilgan e'lonlarning ommaviy maydonlari. Telefon raqamlar bormaydi.
- Suhbatlarni serverda saqlash (qurilmalar orasida davom ettirish) — alohida rozilik va migratsiya bilan, keyingi qaror.
- Limit: kirgan foydalanuvchi — soatiga 80, mehmon (IP bo'yicha, ko'p odam bitta IP ortida bo'lishi mumkin) — 150 ta xabar;
  umumiy kunlik AI byudjeti (`assistant_chat`) — tugasa lug'at javobi.
- Foydalanuvchi matni va asbob natijasi — "ma'lumot, buyruq emas" (prompt in'eksiyasiga qarshi); asbob nomi va kiritmasi
  serverda tekshiriladi; rolga ruxsat etilmagan asbob bajarilmaydi.
- Ovoz: mikrofon faqat ruxsat bilan; ovoz yozuvi saqlanmaydi va serverga yuborilmaydi.

## 4. Bosqichlar

| # | Bosqich | Holat |
|---|---|---|
| 0 | Audit va arxitektura | ✅ bajarildi |
| 1 | Suhbat dvigateli (server) + API + testlar | ✅ bajarildi (2026-11-11) |
| 2 | Suhbat oynasi (UI): oqimli javob, yozish indikatori, tarix, tavsiya savollar, to'xtatish | ✅ bajarildi (2026-11-11) |
| 3 | Ish izlovchi yordamchisi: profil konteksti, rezyume yordami, keyingi qadam | ✅ asosiy qismi bajarildi |
| 4 | Ish beruvchi yordamchisi: nomzod qidirish, vakansiya matni, suhbat savollari | ✅ asosiy qismi bajarildi |
| 5 | Ovozli suhbat: katta mikrofon, holatlar, matnni tahrirlash, o'qib berish | ✅ brauzer ovozi bilan bajarildi |

### 1-bosqich — suhbat dvigateli

**Yaratilgan:** `src/features/assistant/` — `types.ts`, `language.ts`, `prompt.ts`, `tools.ts`, `replies.ts`, `engine.ts`,
`server.ts`; `src/app/api/assistant/route.ts`; `src/features/find/ai-find-core.ts`, `ai-find-types.ts`.
**O'zgartirilgan:** `ai-search.ts` (`ai: false` — ikkinchi AI chaqiruvisiz), `src/lib/ai/json.ts` (`assistant_chat` byudjeti).
**Testlar:** Vitest (til, dvigatel skriptli model bilan, shablonlar, ko'rsatma, himoya); E2E `assistant-api.spec.ts` (6 ta).

### 2-bosqich — suhbat oynasi

Bitta komponent ikki joyda: bosh sahifadagi oyna va `/ai` sahifasi (`src/features/find/components/ai-chat.tsx`).
- Javob matni **oqim bilan** chiqadi; kutilayotganda — uch nuqta va holat ("So'zlaringizni tushunmoqdaman…", "…saralamoqdaman…").
- Avval yordamchining gapi, keyin "Tushundim" belgilari, kengaytirish izohlari va bazadagi kartalar.
- **To'xtatish:** javob kelayotganda yuborish tugmasi o'rnida "Javobni to'xtatish"; kelgan qismi qoladi.
- **Tavsiya savollar** (bosiladi) va natija bo'lsa — toraytirish tugmalari ("+ Kunlik" …).
- **Xatolar:** limit, vaqt tugashi, internet — tushunarli matn va "Qayta urinish" (xato xabari o'rnini yangi javob oladi);
  javob o'rtasida uzilsa — kelgan qismi qoladi.
- **Tarix:** shu qurilmada, shu tabda, 30 daqiqa (8 ta savol-javob); serverga faqat oxirgi 6 ta savol-javob kontekst uchun.
- Eski `aiFind` server amali olib tashlandi (uning yadrosi — `runAiFind` — dvigatel ichida ishlaydi).

### 3–4-bosqich — ish izlovchi va ish beruvchi

- **Profil konteksti** (faqat kirgan foydalanuvchi va AI javob berayotganda, `server.ts`): ish izlovchining o'z e'lonidagi kasb,
  hudud, tajriba, kutilayotgan maosh; ish beruvchining faol vakansiyalari nomi. Yordamchi so'ramasdan mosini qidira oladi va
  nega mos kelishini shu ma'lumotga tayanib tushuntiradi. Telefon, familiya, manzil berilmaydi.
- **Rezyume / vakansiya matni / suhbat savollari:** model foydalanuvchi aytgan faktlardan tuzadi (o'ylab topmaydi). Uzun javobda
  "Nusxa olish" va keyingi qadam: "O'zim haqimda e'lon berish" yoki "Vakansiya joylash".
- **Nomzodlarni taqqoslash:** faqat ommaviy ma'lumot (kasb, hudud, tajriba darajasi, kutilayotgan maosh) bo'yicha; tanlov —
  ish beruvchida. Jins, yosh, millat va shu kabilar bo'yicha saralash taqiqlangan (ko'rsatmada).
- **Suhbat konteksti AI'siz ham:** "oshpaz kerak" → "Samarqandda" → "5 mln dan" — shartlar oldingi xabarlardagi kasb bilan
  birga qidiriladi (`engine.ts`, `flags`). Hudud nomi endi kasb sifatida tushunilmaydi (`intent.ts: withoutPlaceOnly`).
- **Hali yo'q (keyingi):** suhbatdagi matnni e'lon formasiga avtomatik ko'chirish; ariza yuborishni suhbat ichidan boshlash;
  moslik dvigatelining (`src/features/matching`) aniq sabablarini kartada ko'rsatish.

### 5-bosqich — ovozli suhbat (alohida modul: `src/features/find/components/ai-voice.ts`, `src/features/assistant/speech.ts`)

- **Katta mikrofon:** maydon bo'sh bo'lsa asosiy tugma — mikrofon (48 px); matn yozilsa — "Yuborish" (messenjerlardagi kabi).
- **Holatlar:** tinglayapti (qizil hoshiya, pulsli "To'xtatish", "Gapiring — eshityapman… Ovoz saqlanmaydi."), ishlayapti
  (yozish indikatori), o'qib beryapti ("Javobni o'qib beryapman…" + "Ovozni to'xtatish"), xato (ruxsat yo'q / tanib bo'lmadi).
- **Tekshirish va tahrirlash:** aytilgan gap maydonga yoziladi va **o'zi yuborilmaydi** — foydalanuvchi ko'radi, tuzatadi, yuboradi.
- **O'qib berish:** "Ovoz bilan javob" kaliti (qurilmada eslab qolinadi) yoki har javob ostidagi "O'qib berish". Tilga mos ovoz
  tanlanadi; qurilmada shu til uchun ovoz bo'lmasa — boshqa til ovozi bilan buzib o'qilmaydi, "ovoz yo'q" deb aytiladi.
- **Ovozli va matnli suhbat birga:** bitta suhbat, bitta tarix; yangi savol yuborilsa yoki mikrofon bosilsa o'qish to'xtaydi.
- **Maxfiylik:** mikrofon faqat tugma bosilganda va brauzer ruxsati bilan; ovoz bizning serverga yuborilmaydi va saqlanmaydi
  (matnga brauzerning o'zi aylantiradi — Chrome'da bu Google xizmati orqali).
- **Cheklovlar (halol):** (1) Telegram ichidagi oyna va ayrim brauzerlar ovozni tanimaydi — u yerda mikrofon tugmasi ko'rinmaydi,
  matnli suhbat ishlaydi; (2) o'zbekcha o'qiydigan ovoz ko'p telefonlarda yo'q; (3) o'zbek tilini tanish sifati brauzerga bog'liq.
  Hammasida bir xil ishlashi uchun serverda pullik nutq xizmati kerak — 5-bo'limdagi ega qarori.

**Testlar (2–5-bosqich):** Vitest — oqim o'quvchi, ovoz tanlash, kontekst; E2E `assistant-chat.spec.ts` (6 ta: suhbat, AI
oqimi, xatolar, to'xtatish, o'qib berish, mikrofon), `ai-finder.spec.ts`, `ai-search-relax.spec.ts` yangilandi.

**Halol eslatma:** stendda AI kaliti yo'q, shuning uchun haqiqiy Claude bilan suhbat bu yerda sinab ko'rilmadi — dvigatel
skriptli model bilan, oyna esa almashtirilgan oqim bilan tekshirildi. Chiqarilgandan keyin tekshirish: yordamchiga
"rezyume yozishga yordam bering" deb yozing. Javob ostida **"Sun'iy intellekt tahlil qildi"** chiqsa — Claude ishlayapti;
**"So'zlaringizdan tushunildi"** va "kasbni tushunmadim" chiqsa — AI yo'li ishlamayapti (admin → AI statistikasi → xato matni).

### 6-bosqich — AI ish maydoni, "ChatGPT kabi" (2026-11-12, `src/features/ai/`)

Egasi yuborgan maket bo'yicha `/ai` sahifasi qayta qurildi (`components/ai-workspace.tsx` — server, `ai-workspace-client.tsx` — mijoz):

- **Chap panel:** "Yangi suhbat", bo'limlar (mehmonga va telefon panelida; kirgan foydalanuvchining bo'limlari kompyuterda sayt
  yon menyusida — takrorlanmaydi), **so'nggi suhbatlar** (qurilmada, `localStorage` `ib_ai_convs_v1:<rejim>`, 10 ta, 7 kun;
  ochish, o'chirish; `ai-chat-model.ts` — `parseStoredConversations`, `upsertConversation`), profil kartasi (mehmonga — "Kirish").
  Telefonda panel pastdan chiqadi (`Sheet`).
- **Suhbat:** sarlavha (holat: "Sun'iy intellekt · tayyor" / "Oddiy rejim (AI ulanmagan)" / "Javob yozilmoqda…"), ovoz
  kaliti, menyu (yangi suhbat, o'chirish, ovoz). Bo'sh holat: salomlashuv ism bilan, **"Bugungi ishlar"** va **"Sizga mos ishlar"**
  (`workspace-data.ts`): faqat bazadan — profilga mos vakansiyalar soni (bosh sahifa ro'yxati bilan bir manba), profil
  to'liqligi (`worker_dashboard_stats.completeness`), ko'rib chiqilayotgan arizalar; ish beruvchida — yangi arizalar, faol
  vakansiyalar, yangi nomzodlar; mehmonga — kirish qadami. So'rov xato bersa — o'sha qator yo'q (soxta raqam yo'q).
- **Jarayon izi** (`Trace`, `ai-chat.tsx`, `[data-ai-trace]`): "Tushunilmoqda… → Bazadan qidirilmoqda… → Javob yozilmoqda…" va
  tugagach "Tushunildi · Bazadan qidirildi · N ta · Javob: sun'iy intellekt / oddiy rejim". Bosh sahifadagi oynada ham.
- **O'ng panel:** "Karyerangizni rivojlantiring" (savol yuboradi), tezkor imkoniyatlar (CV, ish qidirish, karyera maslahati,
  suhbatga tayyorgarlik, AI PRO kuzatuv; ish beruvchida — vakansiya joylash, nomzod topish, vakansiya matni, suhbat savollari),
  kunlik maslahat (3 ta, o'qlar bilan). Telefonda tezkor imkoniyatlar — salomlashuv ostida chiplar.
- **AI'siz rejim halol:** "Menga mos ish toping" kabi umumiy iltimos — kasb so'raladi (lug'at "mos" so'zini kasbga o'xshatib
  soxta qidirmaydi); karyera/rezyume/suhbat savollari — "bu savolga sun'iy intellekt javob beradi, hozir ulanmagan" (`replies.ts`:
  `FORME`, `ADVICE`). AI ulanganda bular Claude'ga boradi.
- Maketdan farqlar (qoida — soxta ma'lumot yo'q): "5 ta yangi vakansiya", "CV 80 %" — faqat haqiqiy qiymat; Beeline/Uzcard/Click
  logotiplari o'rniga bazadagi haqiqiy e'lonlar; "Karyera markazi" bo'limi yo'q — "Kasblar va karyera" (`/kasblar`); fayl
  biriktirish tugmasi yo'q (bunday imkoniyat yo'q).

**Testlar:** Vitest — suhbatlar ro'yxati (3), `FORME`/`ADVICE` (engine, 1); E2E `ai-workspace.spec.ts` — 5 ta ssenariy × telefon
va kompyuter (mehmon, ish izlovchi — bazadagi qiymat bilan solishtiriladi, suhbat va ro'yxat, tezkor imkoniyat, ish beruvchi).
Skrinshotlar: `docs/screenshots/ai-workspace-2026-11/` (`e2e/screens/ai-workspace.shots.ts`).

## 5. Ega hal qiladigan savollar

1. **Ovozli javob (o'qib berish):** brauzerning o'z ovozi bepul, lekin o'zbekcha ovoz ko'p telefonlarda yo'q. Tabiiy
   o'zbekcha ovoz uchun pullik xizmat (masalan ElevenLabs) va uning kaliti kerak.
2. **Telegram ichida ovozli kiritish:** Telegram Mini App ichidagi brauzer mikrofonni matnga aylantira olmaydi — u yerda
   ham ishlashi uchun serverda nutqni tanish xizmati (pullik) kerak.
3. **Suhbat tarixini serverda saqlash:** hozir faqat qurilmada (so'nggi 10 ta suhbat, 7 kun — chap panelda). Qurilmalar orasida davom ettirish kerak bo'lsa — rozilik
   oynasi va yangi jadval (migratsiya) bilan qilinadi.
