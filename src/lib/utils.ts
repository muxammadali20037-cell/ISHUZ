import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Xatolik obyektidan foydalanuvchiga ko'rsatiladigan kalitni chiqaradi */
export function errorCode(error: unknown): string {
  if (!error) return "unknown";
  if (typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string") {
    const msg = (error as { message: string }).message;
    // Postgres RAISE EXCEPTION 'already_applied' → 'already_applied'
    const m = /^([a-z_]+)$/.exec(msg.trim());
    if (m) return m[1]!;
    if (/rate_limited/.test(msg)) return "rate_limited";
    if (/already_applied|already_offered/.test(msg)) return msg.includes("offered") ? "already_offered" : "already_applied";
    if (/blocked/.test(msg)) return "blocked";
    if (/forbidden|permission denied|row-level security/.test(msg)) return "forbidden";
    if (/not_authenticated|JWT/.test(msg)) return "not_authenticated";
  }
  return "unknown";
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** URLSearchParams → oddiy obyekt (bir xil kalit bir necha marta bo'lsa massiv) */
export function searchParamsToObject(params: URLSearchParams | Record<string, string | string[] | undefined>) {
  const out: Record<string, string | string[]> = {};
  const entries = params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : v === undefined ? [] : [[k, v] as [string, string]]));
  for (const [k, v] of entries) {
    const existing = out[k];
    if (existing === undefined) out[k] = v;
    else out[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
  }
  return out;
}
