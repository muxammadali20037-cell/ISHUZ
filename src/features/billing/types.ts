import type { PaymentProvider } from "./providers";

export type PublishMode = "paid_window" | "free" | "promo" | "free_trial" | "payment_required";

/** Aksiya chegirmasi (birinchi to'lovda): price — chegirmali, full_price — asl narx */
export interface ListingDiscount {
  full_price: number;
  discount_percent: number;
  discount_until: string | null;
}

export interface VacancyQuote extends ListingDiscount {
  mode: PublishMode;
  price: number;
  lifetime_days: number;
  free_hours: number;
  promo_until: string | null;
  paid_until: string | null;
  providers: PaymentProvider[];
}

export interface ListingQuote extends ListingDiscount {
  mode: Exclude<PublishMode, "promo">;
  price: number;
  lifetime_days: number;
  listed_until: string | null;
  providers: PaymentProvider[];
}

export interface PromotionQuote {
  mode: Exclude<PublishMode, "paid_window">;
  price: number;
  hours: number;
  promo_until: string | null;
  promoted_until: string | null;
  providers: PaymentProvider[];
}

/** To'lov oynasi qaysi xizmat uchun ochiladi */
export type CheckoutPurpose = "vacancy_publish" | "worker_promotion" | "worker_listing" | "ai_alerts";

/** Hamyon (0063): balans va to'ldirish qoidalari; migratsiya yo'q yoki pullik xizmat yo'q bo'lsa — null */
export interface WalletInfo {
  balance: number;
  bonusPercent: number;
  bonusMin: number;
  topupMin: number;
  topupMax: number;
}

/** To'lov oynasi uchun bitta javob: narx, chegirma, muddat, to'lov usullari va hamyon */
export interface CheckoutQuote {
  purpose: CheckoutPurpose;
  /** payment_required — to'lov kerak; boshqasi (bepul, aksiya, to'langan) — to'lov oynasi ko'rsatilmaydi */
  mode: string;
  price: number;
  fullPrice: number;
  discountPercent: number;
  discountUntil: string | null;
  days: number | null;
  hours: number | null;
  providers: PaymentProvider[];
  wallet: WalletInfo | null;
}
