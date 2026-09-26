# Ish UZ

**Maqsad:** ish qidirayotganlarni ish bilan, ishchi qidirayotganlarni munosib xodim bilan ta'minlash va ularni bir-biriga bog'lash.

Bitta kod bazasi uch ko'rinishda ishlaydi:

- **Telegram Mini App** — bot menyusidagi tugma orqali ochiladi, Telegram hisobi bilan avtomatik kiradi, yangi so'rovlar haqida botdan xabar keladi.
- **Sayt** — oddiy brauzerda ochiladi (ism bilan kirish).
- **Ilova (PWA)** — telefonda "Bosh ekranga qo'shish" orqali ilova sifatida o'rnatiladi.

## Qanday ishlaydi

### 🔎 Ish qidiryapman
Ma'lumotlar bosqichma-bosqich, bitta-bitta so'raladi:
ism-familiya → tug'ilgan yil, jins → telefon → viloyat/tuman → **kategoriya** → **mutaxassislik (kasb)** → **ish staji** → ma'lumoti → tillar → ko'nikmalar → **ish turi** (to'liq/yarim stavka, masofaviy, smenali, vaqtinchalik) va **rasmiy/norasmiy** → kutilayotgan maosh → **portfolio** (profil rasmi, ish namunalari rasmlari, havolalar) → o'zi haqida → tekshirish.

Qoralama avtomatik saqlanadi. Rezyume saqlangach, unga **mos vakansiyalar moslik foizi bilan** ko'rsatiladi.

### 🧑‍💼 Ishchi kerak
Kategoriyani tanlaysiz → **Filtr** bosasiz (viloyat, mutaxassislik, staj, ish turi, rasmiylik, ma'lumot, jins, yosh, maosh, til, portfoliosi borligi) → mos ishchilar chiqadi.
Vakansiya joylasangiz, ishchilar vakansiyangizga moslik foizi bo'yicha saralanadi.

### 🤝 Bog'lash
- Ish beruvchi ishchiga **taklif**, ishchi vakansiyaga **ariza** yuboradi.
- Telefon raqamlar so'rov **qabul qilinmaguncha yashirin**.
- Qabul qilingach, ikkala tomon bir-birining telefoni va Telegramini ko'radi; Telegram foydalanuvchilarga bot orqali xabar boradi.

## Ishga tushirish

```bash
npm install
cp .env.example .env   # BOT_TOKEN va WEBAPP_URL ni kiriting (ixtiyoriy)
npm start              # http://localhost:3000
npm test
```

Node.js 20+ kerak. Ma'lumotlar SQLite faylida (`data/ishuz.db`), yuklangan rasmlar `uploads/` papkasida saqlanadi.

### Telegram bot ulash
1. [@BotFather](https://t.me/BotFather) da bot yarating, tokenni `.env` dagi `BOT_TOKEN` ga yozing.
2. Serverni HTTPS domen ortida joylashtiring va manzilni `WEBAPP_URL` ga yozing (Telegram Mini App faqat HTTPS bilan ishlaydi).
3. Serverni qayta ishga tushiring — bot `/start` ga Mini App tugmasi bilan javob beradi va menyu tugmasini o'rnatadi.

## Tuzilishi

```
src/
  server.js      kirish nuqtasi (.env, server, bot)
  app.js         REST API (auth, rezyume, vakansiya, qidiruv, bog'lanish, rasm yuklash)
  db.js          SQLite sxema
  auth.js        Telegram initData imzosini tekshirish
  matching.js    rezyume ↔ vakansiya moslik foizi
  validate.js    kiruvchi ma'lumotlarni tekshirish
  constants.js   kategoriyalar, viloyatlar, ish turlari va h.k.
  bot.js         Telegram bot (long polling, xabarnomalar)
public/          Mini App / sayt / PWA (kutubxonasiz JS)
test/            API testlari (node:test)
```

## API qisqacha

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/api/meta` | kategoriyalar, viloyatlar, ish turlari |
| POST | `/api/auth/telegram` · `/api/auth/web` | kirish (token qaytaradi) |
| GET | `/api/me` | mening rezyume/vakansiyalarim |
| POST/PUT/DELETE | `/api/resumes[/:id]`, `/api/vacancies[/:id]` | yaratish, tahrirlash, o'chirish |
| PATCH | `/api/resumes/:id/active` | faollashtirish / yashirish |
| GET | `/api/search/workers?category=&region=&experience_min=&…&vacancy_id=` | ishchilarni filtrlash |
| GET | `/api/search/vacancies?category=&region=&…&resume_id=` | vakansiyalarni filtrlash |
| POST | `/api/upload` | portfolio rasmlari |
| GET/POST | `/api/connections`, `/api/connections/:id/respond` | bog'lanish so'rovlari |

## Keyingi qadamlar (tavsiya)
- Sayt foydalanuvchilari uchun SMS/Telegram Login orqali tasdiqlangan kirish (hozir sayt hisobi qurilmaga bog'langan).
- Rate-limit va spamga qarshi himoya, admin panel (e'lonlarni moderatsiya qilish).
- Yangi mos vakansiya/ishchi paydo bo'lganda botdan avtomatik xabar.
