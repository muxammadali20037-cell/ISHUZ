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
