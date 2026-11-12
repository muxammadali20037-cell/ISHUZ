/**
 * Voronka va mahsulot hodisalari (shaxsiy ma'lumotsiz). Faqat shu ro'yxatlardagilar yoziladi.
 *
 * CLIENT_EVENTS — brauzer `/api/e` ga yuborishi mumkin bo'lganlar: `track("…")` chaqiruvlari va `[data-track="…"]` bosishlari.
 * 2026-10-31 auditi: avval faqat 5 ta nom qabul qilinardi — qolgan ~20 ta `data-track` (vakansiyani saqlash, "E'lon" tugmasi,
 * bosh sahifa bo'limlari…) 400 bilan tashlab yuborilardi. Endi koddagi har bir nom shu yerda; `events.test.ts` kodni
 * skanerlab, yangi `data-track`/`track()`/`trackServer()` nomi ro'yxatga qo'shilmagan bo'lsa yiqiladi.
 *
 * SERVER_EVENTS — faqat server yozadi (soxtalashtirib bo'lmaydi): e'lon joylandi, ariza yuborildi, shikoyat, ro'yxatdan o'tish…
 */
export const CLIENT_EVENTS = [
  // voronka
  "home_view",
  "direction_select",
  "post_start",
  "post_review",
  "contact_click",
  // bosishlar ([data-track])
  "ai_finder_open",
  "ai_hub",
  "auth_method",
  "entry_quick",
  "entry_role",
  "home_category",
  "catalog_category",
  "home_chip",
  "home_cta",
  "home_filters",
  "home_post_vacancy",
  "home_section",
  "home_service",
  "home_window",
  "mode_choose",
  "mode_switch",
  "nav_post",
  "near_me",
  "save_toggle",
  "search_all",
  "site_nav",
  // "Universal ustalar" bo'limiga kirish (bosh sahifa kartasi, yon menyu)
  "masters_entry",
] as const;

export const SERVER_EVENTS = [
  "post_publish",
  "outcome_report",
  "outcome_found_job",
  "outcome_found_worker",
  "ai_draft_started",
  "ai_draft_prepared",
  "ai_find",
  "search_submit",
  "search_error",
  "subscription_on",
  "subscription_off",
  "application_submit",
  "vacancy_report",
  "employer_register",
] as const;

export const ANALYTICS_EVENTS = [...CLIENT_EVENTS, ...SERVER_EVENTS] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(name: string): name is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

/** Brauzerdan qabul qilinadigan hodisa (server hodisalarini mijoz soxtalashtira olmaydi) */
export function isClientEvent(name: string): boolean {
  return (CLIENT_EVENTS as readonly string[]).includes(name);
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
