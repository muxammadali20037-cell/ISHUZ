import type { AppliedFilters } from "./ai-chat-model";
import type { JobCardData } from "./components/result-cards";
import type { WorkerRow } from "./queries";

export interface AiFindResult {
  mode: "jobs" | "workers";
  /** matndan nima tushunildi (foydalanuvchiga ko'rsatiladi) */
  understood: string[];
  /** kasb aniqlanmadi — ro'yxatdan tanlash taklif qilinadi */
  needProfession: boolean;
  /** "ai" — sun'iy intellekt tahlil qildi; "rules" — lug'at bilan tushunildi (AI kerak bo'lmadi yoki ulanmagan) */
  source: "ai" | "rules";
  aiAvailable: boolean;
  /** qo'llangan shartlar — AI yordamchi aniqlashtirish takliflarini takrorlamaydi */
  applied: AppliedFilters;
  /** oddiy qidiruv yoki — kasb aniqlanmaganda — e'lon matnlari bo'yicha topilganlar (bir xil karta shakli) */
  jobs: JobCardData[];
  workers: WorkerRow[];
  images: Record<string, string>;
  photos: Record<string, string>;
  /** natijadagi saqlanganlar ("Saqlash" belgisi holati) */
  saved: string[];
  total: number;
  /** to'liq natijalar sahifasi (filtrlar, sahifalar) */
  href: string;
  /**
   * Aniq so'rov bo'yicha bo'sh chiqqanda qidiruv qanday kengaytirildi (foydalanuvchiga ochiq aytiladi):
   * masalan "Chilonzorda yo'q — butun Toshkent bo'yicha". Natija topilmasa — bo'sh.
   */
  relaxed: string[];
  /** hech narsa topilmadi: yangi mos e'lon chiqsa Telegram'ga xabar (yozgan matni tayyor) va o'zi e'lon berishi */
  alertHref: string;
  postHref: string;
  /**
   * Matndan nima tushunildi (suhbat konteksti uchun): `profession` — kasb yoki e'lon matnidagi kalit so'z topildi;
   * `filters` — hudud, maosh, grafik, tajriba, kunlik yoki masofaviy shartlardan biri bor. Ikkalasi ham false — matn
   * qidiruv so'rovi sifatida tushunilmadi.
   */
  flags: { profession: boolean; filters: boolean };
}
