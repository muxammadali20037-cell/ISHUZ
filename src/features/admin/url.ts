import type { SearchParams } from "./queries/shared";

/** Joriy filtrlarni saqlab, bitta parametrni o'zgartirgan URL */
export function withParam(base: string, sp: SearchParams, key: string, value: string | null): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined || k === key) continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else if (v !== "") params.set(k, v);
  }
  if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function viewHref(base: string, sp: SearchParams, id: string) {
  return withParam(base, sp, "view", id);
}

export function closeHref(base: string, sp: SearchParams) {
  return withParam(base, sp, "view", null);
}
