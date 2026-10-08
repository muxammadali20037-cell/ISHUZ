import type { Enums } from "@/types/database.types";
import type { FindMode } from "./intent";

/** /search URL holati: har bir qadam URL'da — orqaga tugmasi va sahifani yangilash javoblarni yo'qotmaydi */
export interface FindParams {
  mode: FindMode | null;
  q: string;
  /** profession_nodes.id */
  p: string | null;
  /** viloyat slug | "all" (butun O'zbekiston) | "remote" (masofadan) */
  region: string | null;
  /** tuman id | "all" (butun viloyat) */
  district: string | null;
  page: number;
  salary: number | null;
  schedule: Enums<"work_schedule"> | null;
  noexp: boolean;
  exp: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCHEDULES = new Set(["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"]);

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFindParams(raw: Raw): FindParams {
  const mode = one(raw.mode);
  const p = one(raw.p);
  const region = one(raw.region);
  const district = one(raw.district);
  const page = Math.min(Math.max(Number.parseInt(one(raw.page), 10) || 1, 1), 250);
  const salary = Number.parseInt(one(raw.salary).replace(/\D/g, ""), 10);
  const schedule = one(raw.schedule);
  return {
    mode: mode === "jobs" || mode === "workers" ? mode : null,
    q: one(raw.q).replace(/\s+/g, " ").trim().slice(0, 120),
    p: UUID.test(p) ? p : null,
    region: /^[a-z0-9_-]{2,60}$/.test(region) ? region : null,
    district: district === "all" || UUID.test(district) ? district : null,
    page,
    salary: Number.isFinite(salary) && salary > 0 && salary < 1_000_000_000 ? salary : null,
    schedule: SCHEDULES.has(schedule) ? (schedule as Enums<"work_schedule">) : null,
    noexp: one(raw.noexp) === "1",
    exp: one(raw.exp) === "1",
  };
}

/** URL yasash: berilgan maydonlar almashtiriladi, null — olib tashlanadi */
export function findHref(base: FindParams, patch: Partial<FindParams> = {}): string {
  const v = { ...base, ...patch };
  const q = new URLSearchParams();
  if (v.mode) q.set("mode", v.mode);
  if (v.q && (!v.mode || !v.p)) q.set("q", v.q);
  if (v.p) q.set("p", v.p);
  if (v.region) q.set("region", v.region);
  if (v.district && v.region && v.region !== "all" && v.region !== "remote") q.set("district", v.district);
  if (v.mode === "jobs") {
    if (v.salary) q.set("salary", String(v.salary));
    if (v.schedule) q.set("schedule", v.schedule);
    if (v.noexp) q.set("noexp", "1");
  }
  if (v.mode === "workers" && v.exp) q.set("exp", "1");
  if (v.page > 1) q.set("page", String(v.page));
  const s = q.toString();
  return s ? `/search?${s}` : "/search";
}

export const EMPTY_FIND: FindParams = { mode: null, q: "", p: null, region: null, district: null, page: 1, salary: null, schedule: null, noexp: false, exp: false };

export function activeFilterCount(p: FindParams): number {
  return p.mode === "jobs" ? Number(!!p.salary) + Number(!!p.schedule) + Number(p.noexp) : Number(p.exp);
}
