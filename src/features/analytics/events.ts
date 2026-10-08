/** Voronka va mahsulot hodisalari (shaxsiy ma'lumotsiz). Faqat shu ro'yxatdagilar qabul qilinadi. */
export const ANALYTICS_EVENTS = [
  "home_view",
  "direction_select",
  "post_start",
  "post_review",
  "post_publish",
  "contact_click",
  "outcome_report",
  "outcome_found_job",
  "outcome_found_worker",
  "ai_draft_started",
  "ai_draft_prepared",
  "search_submit",
  "subscription_on",
  "subscription_off",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(name: string): name is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

/** props: faqat qisqa skalyar qiymatlar (ism, telefon kabi shaxsiy ma'lumot yozilmaydi) */
export function cleanProps(props: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props || typeof props !== "object" || Array.isArray(props)) return out;
  for (const [k, v] of Object.entries(props as Record<string, unknown>).slice(0, 8)) {
    if (!/^[a-z_]{1,24}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && /^[A-Za-z0-9_.:\/-]{0,64}$/.test(v)) out[k] = v;
  }
  return out;
}
