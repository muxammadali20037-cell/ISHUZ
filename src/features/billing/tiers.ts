import { TARIFF_PLANS, type TariffPlan, type Tier } from "./types";

/** Server javobidagi "tiers" → toza ro'yxat (uch daraja to'liq bo'lmasa — null: eski oqim) */
export function parseTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Tier[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const plan = o.plan as TariffPlan;
    const n = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : null);
    const price = n("price");
    const days = n("days");
    if (!TARIFF_PLANS.includes(plan) || price === null || days === null) return null;
    out.push({ plan, price, fullPrice: n("full_price") ?? n("price") ?? price, days, topDays: n("top_days") ?? 0, aiDays: n("ai_days") ?? 0 });
  }
  return out.length === TARIFF_PLANS.length && TARIFF_PLANS.every((p, i) => out[i]!.plan === p) ? out : null;
}

/** Tanlash mumkin bo'lgan darajalar: to'lov kerak bo'lsa — uchalasi; e'lon bepul/faol bo'lsa — faqat kuchaytirish */
export function selectableTiers(tiers: Tier[] | null, mode: string, upgrade: boolean): Tier[] {
  if (!tiers) return [];
  if (mode === "payment_required") return tiers;
  return upgrade ? tiers.filter((t) => t.plan !== "basic") : [];
}
