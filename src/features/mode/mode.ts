/**
 * Ilova rejimi: "worker" — ish izlovchi (ish e'lonlari, o'zi haqida e'lon), "employer" — ish beruvchi (ishchilar, ish e'loni).
 * Ikkalasi bir ilovada, lekin aralashmaydi: bosh sahifa, qidiruv, saqlanganlar va e'lon berish joriy rejimga qarab ishlaydi;
 * boshqa rejimga o'tish — faqat foydalanuvchi tasdig'i bilan.
 */
export type AppMode = "worker" | "employer";

/** Qurilmadagi tanlov (mehmon ham tanlaydi); kirgan foydalanuvchida — profiles.active_role ham */
export const MODE_COOKIE = "ib_mode";

export function parseMode(v: unknown): AppMode | null {
  return v === "worker" || v === "employer" ? v : null;
}

/** Rejim → qidiruv turi (/search?mode=...) */
export function findModeOf(mode: AppMode): "jobs" | "workers" {
  return mode === "worker" ? "jobs" : "workers";
}

/** Qidiruv turi → kerakli rejim */
export function modeOfFind(find: "jobs" | "workers"): AppMode {
  return find === "jobs" ? "worker" : "employer";
}

/**
 * Joriy rejim: shu qurilmadagi oxirgi ochiq tanlov (cookie; tanlov doim profilga ham yoziladi, kirishda profilga
 * sinxronlanadi) → profildagi faol rol (yangi qurilmada) → mavjud rollardan taxmin.
 * Hech biri yo'q — null (bosh sahifa avval "Siz nima qidiryapsiz?" deb so'raydi).
 */
export function resolveMode(input: { activeRole?: string | null; cookie?: string | null; roles?: readonly string[] }): AppMode | null {
  return (
    parseMode(input.cookie) ??
    parseMode(input.activeRole) ??
    (input.roles?.includes("worker") ? "worker" : input.roles?.includes("employer") ? "employer" : null)
  );
}
