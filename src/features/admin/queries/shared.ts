import "server-only";

export const PAGE_SIZE = 50;

export type SearchParams = Record<string, string | string[] | undefined>;

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** searchParams dan bitta string qiymat */
export function param(sp: SearchParams, key: string): string {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? "").trim();
}

export function parsePage(sp: SearchParams): number {
  const n = Number.parseInt(param(sp, "page"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  const from = (page - 1) * size;
  return [from, from + size - 1];
}

export function toPaged<T>(rows: T[] | null, count: number | null, page: number, size = PAGE_SIZE): Paged<T> {
  const total = count ?? 0;
  return { rows: rows ?? [], total, page, pageSize: size, pageCount: Math.max(1, Math.ceil(total / size)) };
}

/** ilike uchun foydalanuvchi kiritganini tozalash (%, _ , vergul PostgREST or() ni buzadi) */
export function likeTerm(q: string): string {
  return `%${q.replace(/[%_,()\\]/g, " ").trim()}%`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** enum qiymatini tekshirib qaytaradi, aks holda undefined */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** ?days= → 7 | 30 | 90 */
export function parseDays(sp: SearchParams, fallback = 30): 7 | 30 | 90 {
  const n = Number.parseInt(param(sp, "days"), 10);
  return n === 7 || n === 30 || n === 90 ? n : (fallback as 7 | 30 | 90);
}
