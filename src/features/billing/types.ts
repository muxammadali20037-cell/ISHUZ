import type { PaymentProvider } from "./providers";

export type PublishMode = "paid_window" | "free" | "promo" | "free_trial" | "payment_required";

export interface VacancyQuote {
  mode: PublishMode;
  price: number;
  lifetime_days: number;
  free_hours: number;
  promo_until: string | null;
  paid_until: string | null;
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
