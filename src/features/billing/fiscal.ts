/**
 * Fiskal chek ma'lumoti (Payme Merchant API, CheckPerformTransaction → result.detail): har to'lovda bitta xizmat qatori —
 * nomi, narxi (tiyin), soni, IKPU (MXIK) kodi, qadoq kodi, QQS foizi. Kodlar buxgalterdan (Vercel env: PAYME_FISCAL_*);
 * bo'lmasa — null va detail yuborilmaydi. Sof modul — testlanadi. docs/PAYMENTS_LAUNCH.md §3.
 */
export interface FiscalConfig {
  code?: string;
  packageCode?: string;
  vat?: number;
}

export interface FiscalPayment {
  purpose: string;
  plan: string | null;
  amount: number;
}

export interface PaymeDetail {
  receipt_type: 0;
  items: { title: string; price: number; count: 1; code: string; package_code: string; vat_percent: number }[];
}

const PLAN = { basic: "Oddiy", boost: "Tezkor", max: "Maksimal" } as const;

/** Chekdagi xizmat nomi (o'zbekcha; chek tili — kassa sozlamasi) */
export function fiscalTitle(p: Pick<FiscalPayment, "purpose" | "plan">): string {
  const plan = p.plan && p.plan in PLAN ? PLAN[p.plan as keyof typeof PLAN] : null;
  const withPlan = (base: string) => (plan ? `${base} (${plan})` : base);
  switch (p.purpose) {
    case "vacancy_publish":
      return withPlan("Ish topdim: vakansiya e'lonini joylash");
    case "worker_listing":
      return withPlan("Ish topdim: ishchi e'lonini joylash");
    case "worker_promotion":
      return "Ish topdim: profilni TOP qilish";
    case "contact_unlock":
      return "Ish topdim: nomzod raqamini ochish";
    case "wallet_topup":
      return "Ish topdim: xizmatlar uchun oldindan to'lov";
    default:
      return "Ish topdim: e'lon xizmati";
  }
}

/** Payme detail (summa so'mda → tiyin). Kodlar to'liq bo'lmasa — null */
export function paymeDetail(p: FiscalPayment, cfg: FiscalConfig): PaymeDetail | null {
  if (!cfg.code || !cfg.packageCode || !(p.amount > 0)) return null;
  return {
    receipt_type: 0,
    items: [{ title: fiscalTitle(p), price: p.amount * 100, count: 1, code: cfg.code, package_code: cfg.packageCode, vat_percent: cfg.vat ?? 0 }],
  };
}
