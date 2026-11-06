/**
 * Rasmiy Telegram kanal uchun tayyor materiallar (egasi, 2026-11-06): manifest video, «Qanday ishlaydi» videosi va ikki rasm-albom.
 * Fayllar — public/media/kanal (sayt orqali ochiq; Telegram ularni URL bo'yicha o'zi yuklab oladi: video ≤ 20 MB, rasm ≤ 5 MB).
 * Matnlar — kanal tilida (o'zbekcha), admin yuborishdan oldin tahrirlay oladi.
 */
export type ChannelMediaId = "manifest" | "how_video" | "how_it_works" | "together";

export interface ChannelMedia {
  id: ChannelMediaId;
  kind: "video" | "album";
  /** sayt ildizidan yo'llar */
  files: string[];
  poster: string;
  width?: number;
  height?: number;
  duration?: number;
  caption: string;
}

const MANIFEST_CAPTION = `🇺🇿 O‘ZBEKISTON, KELING, BIRGALIKDA QURAMIZ!

Biz ISH TOPDIM loyihasini noldan boshladik. Maqsadimiz — butun O‘zbekiston bo‘ylab ish izlayotgan insonlar va munosib xodim qidirayotgan ish beruvchilarni bog‘lash.

Biz katta kompaniya emasmiz. Hali kamchiliklarimiz ko‘p — shuning uchun sizning fikringiz biz uchun muhim.

Bizga qo‘shiling:
✅ Loyihani qo‘llab-quvvatlang
✅ Kamchiliklarimizni ayting
✅ Taklif va g‘oyalaringizni yozing
✅ Ish izlayotgan tanishlaringizga ulashing
✅ Ishchi qidirayotgan tadbirkorlarga tavsiya qiling

🌐 Sayt: ishuz.vercel.app
📸 Instagram: @ishtopdim
🤖 CV bot: @ishberuvchi_bot
💬 Fikringizni izohlarda yozing.

#IshTopdim #BirgalikdaQuramiz`;

const HOW_VIDEO_CAPTION = `ISH TOPDIM qanday ishlaydi? — 1 daqiqada 👇

🔍 Ish izlovchi: kasb va hududni tanlaysiz → vakansiyani ochasiz → ariza yuborasiz.
🏢 Ish beruvchi: vakansiya joylaysiz → arizalarni ko‘rasiz → ishchilar ro‘yxatidan qidirasiz.
🤖 Telegram bot @ishberuvchi_bot orqali 2 daqiqada CV.

Videoda — saytning haqiqiy ekranlari, e’lonlar namuna sifatida.

🌐 Sayt: ishuz.vercel.app
💬 Savollaringizni izohlarda yozing.

#IshTopdim`;

const HOW_CAPTION = `ISH TOPDIM qanday ishlaydi? 👇

Ish izlayotgan bo‘lsangiz: kasb, hudud va ish turini tanlaysiz, vakansiyani ochasiz, ariza yuborasiz.

Ish beruvchi bo‘lsangiz: vakansiya joylashtirasiz, kelgan arizalarni ko‘rasiz, ishchilar ro‘yxatidan qidirasiz.

Telegram bot @ishberuvchi_bot orqali 2 daqiqada CV tuzish mumkin.

Savollaringiz bo‘lsa — izohlarda yozing.

🌐 ishuz.vercel.app`;

const TOGETHER_CAPTION = `Biz hammasini noldan boshlayapmiz — va bu yo‘lni yolg‘iz bosib o‘tmoqchi emasmiz. 🤝

Nimadir noto‘g‘ri bo‘lsa — ayting. Yaxshi g‘oya bo‘lsa — baham ko‘ring. Tanqiddan qochmaymiz.

💬 Izohlarda yozing — har bir taklif loyihani yaxshilaydi.`;

export const CHANNEL_MEDIA: ChannelMedia[] = [
  {
    id: "manifest",
    kind: "video",
    files: ["/media/kanal/birgalikda-quramiz.mp4"],
    poster: "/media/kanal/birgalikda-quramiz.jpg",
    width: 1080,
    height: 1920,
    duration: 84,
    caption: MANIFEST_CAPTION,
  },
  {
    id: "how_video",
    kind: "video",
    files: ["/media/kanal/qanday-ishlaydi.mp4"],
    poster: "/media/kanal/qanday-ishlaydi-video.jpg",
    width: 1080,
    height: 1920,
    duration: 57,
    caption: HOW_VIDEO_CAPTION,
  },
  {
    id: "how_it_works",
    kind: "album",
    files: [1, 2, 3, 4].map((n) => `/media/kanal/qanday-ishlaydi-${n}.jpg`),
    poster: "/media/kanal/qanday-ishlaydi-1.jpg",
    caption: HOW_CAPTION,
  },
  {
    id: "together",
    kind: "album",
    files: [1, 2, 3].map((n) => `/media/kanal/birgalikda-${n}.jpg`),
    poster: "/media/kanal/birgalikda-1.jpg",
    caption: TOGETHER_CAPTION,
  },
];

export const CHANNEL_MEDIA_IDS = CHANNEL_MEDIA.map((m) => m.id) as [ChannelMediaId, ...ChannelMediaId[]];

export function channelMedia(id: string | null | undefined): ChannelMedia | null {
  return CHANNEL_MEDIA.find((m) => m.id === id) ?? null;
}

/** Telegram cheklovlari: oddiy xabar — 4096, rasm/video izohi — 1024 belgi */
export const TEXT_LIMIT = 4096;
export const CAPTION_LIMIT = 1024;

/** Telegram belgilarni UTF-16 birliklarida sanaydi (emoji — 2) */
export function telegramLength(s: string): number {
  return s.length;
}

/**
 * Kanal manzilidan chat_id: "https://t.me/ish_topdim_uz" → "@ish_topdim_uz". Taklif havolalari (t.me/+…, joinchat)
 * va xabar havolalari (t.me/c/…) chat_id bera olmaydi — null. "@name" yoki "-100…" to'g'ridan-to'g'ri qabul qilinadi.
 */
export function channelChatIdFrom(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^-100\d{5,}$/.test(v)) return v;
  if (/^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(v)) return v;
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([A-Za-z][A-Za-z0-9_]{3,31})\/?$/);
  return m ? `@${m[1]}` : null;
}
