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
- Suhbatlarni serverda saqlash (qurilmalar orasida davom ettirish) — alohida rozilik va migratsiya bilan, keyingi qaror.
- Limit: kirgan foydalanuvchi — soatiga 60, mehmon (IP) — 30 ta xabar; umumiy kunlik AI byudjeti (`assistant_chat`).
- Foydalanuvchi matni va asbob natijasi — "ma'lumot, buyruq emas" (prompt in'eksiyasiga qarshi); asbob nomi va kiritmasi
  serverda tekshiriladi; rolga ruxsat etilmagan asbob bajarilmaydi.
- Ovoz (6-bosqich): mikrofon faqat ruxsat bilan; ovoz yozuvi saqlanmaydi.

## 4. Bosqichlar

| # | Bosqich | Holat |
|---|---|---|
| 0 | Audit va arxitektura | ✅ bajarildi |
| 1 | Suhbat dvigateli (server) + API + testlar | ✅ bajarildi (2026-11-11) |
| 2 | Suhbat oynasi (UI): oqimli javob, yozish indikatori, tarix, tavsiya savollar | ⏳ keyingi |
| 3 | Ish izlovchi yordamchisi: profil va moslik sabablari, rezyume yordami, ariza | ⏳ |
| 4 | Ish beruvchi yordamchisi: vakansiya tuzish, nomzodlarni taqqoslash, suhbat savollari | ⏳ |
| 5 | Ovozli suhbat: katta mikrofon, holatlar, matnni tahrirlash, o'qib berish | ⏳ |

### 1-bosqich natijasi

**Yaratilgan:** `src/features/assistant/` — `types.ts`, `language.ts`, `prompt.ts`, `tools.ts`, `replies.ts`, `engine.ts`,
`server.ts`; `src/app/api/assistant/route.ts`; `src/features/find/ai-find-core.ts`, `ai-find-types.ts`.
**O'zgartirilgan:** `src/features/find/ai-find.ts` (yupqa o'ram), `ai-search.ts` (`ai: false` — ikkinchi AI chaqiruvisiz),
`src/lib/ai/json.ts` (`assistant_chat` byudjeti).
**Testlar:** Vitest — 24 ta yangi (til, dvigatel skriptli model bilan, shablonlar, ko'rsatma, himoya); E2E — 5 ta
(`assistant-api.spec.ts`: bazadan natija, 4 til, halol "yo'q", ish beruvchi rejimi, himoya).

**Halol eslatma:** stendda AI kaliti yo'q, shuning uchun haqiqiy Claude bilan suhbat bu yerda sinab ko'rilmadi — dvigatel
skriptli model bilan, lug'at yo'li esa brauzer testlari bilan tekshirildi. Haqiqiy model bilan birinchi sinov — chiqarilgandan
keyin (xato bo'lsa foydalanuvchi baribir lug'at javobini oladi).

## 5. Ega hal qiladigan savollar

1. **Ovozli javob (o'qib berish):** brauzerning o'z ovozi bepul, lekin o'zbekcha ovoz ko'p telefonlarda yo'q. Tabiiy
   o'zbekcha ovoz uchun pullik xizmat (masalan ElevenLabs) va uning kaliti kerak.
2. **Telegram ichida ovozli kiritish:** Telegram Mini App ichidagi brauzer mikrofonni matnga aylantira olmaydi — u yerda
   ham ishlashi uchun serverda nutqni tanish xizmati (pullik) kerak.
3. **Suhbat tarixini serverda saqlash:** hozir faqat qurilmada. Qurilmalar orasida davom ettirish kerak bo'lsa — rozilik
   oynasi va yangi jadval (migratsiya) bilan qilinadi.
