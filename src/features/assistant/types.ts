import type { AiFindResult } from "@/features/find/ai-find-types";

/** Kim bilan gaplashilyapti: ish izlovchi yoki ish beruvchi (rejimdan; tanlanmagan mehmon — ish izlovchi) */
export type AssistantRole = "seeker" | "employer";

/** Javob tili: o'zbek lotin, o'zbek kirill, rus, ingliz */
export type AssistantLang = "uz" | "oz" | "ru" | "en";

/** Suhbatdagi bitta xabar (qurilmada saqlanadi; serverga faqat oxirgi bir nechtasi kontekst uchun yuboriladi) */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * Server → brauzer oqimi (har qator bitta JSON, NDJSON):
 *  - status: yordamchi nima qilyapti ("o'ylayapti" / "bazadan qidiryapti") — yozish indikatori uchun;
 *  - text: javob matnining navbatdagi bo'lagi (oqim bilan chiqadi);
 *  - results: bazadan topilgan HAQIQIY e'lonlar (kartalar shu ma'lumotdan chiziladi — model matnidan emas);
 *  - suggestions: bosiladigan keyingi savollar;
 *  - done: javob tugadi (source: "ai" — sun'iy intellekt, "rules" — lug'at va shablon: AI ulanmagan yoki ishlamadi);
 *  - error: xato kodi (limit, vaqt tugadi va h.k.) — foydalanuvchiga tushunarli matn brauzerda tanlanadi.
 */
export type AssistantEvent =
  | { type: "status"; stage: "thinking" | "searching" }
  | { type: "text"; delta: string }
  | { type: "results"; data: AiFindResult }
  | { type: "suggestions"; items: string[] }
  | { type: "done"; source: "ai" | "rules"; lang: AssistantLang }
  | { type: "error"; code: "rate_limited" | "unavailable" | "timeout" | "validation" | "search_failed" };

export type Emit = (event: AssistantEvent) => void;

/** Kontekstga olinadigan xabarlar soni va uzunligi (xarajat va maxfiylik: butun tarix yuborilmaydi) */
export const HISTORY_MESSAGES = 12;
export const MESSAGE_MAX_CHARS = 600;
