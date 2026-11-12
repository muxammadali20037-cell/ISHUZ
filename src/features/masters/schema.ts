import { z } from "zod";
import { MASTER_PHOTOS_MAX, MASTER_SERVICES_MAX } from "./types";

const phone = z.string().regex(/^\+998\d{9}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** tekshirilgan rasm yo'li (vacancy-photos: <egasi>/v-<sha256>.webp) yoki karantin yo'li (serverda tekshiriladi) */
export const photoPath = z
  .string()
  .regex(
    /^[0-9a-f-]{36}\/(?:[0-9a-f-]{36}\.(?:jpg|png|webp)|v-[0-9a-f]{64}\.webp)$/,
  );

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Usta e'loni formasi — server ham, mijoz ham shu bilan tekshiradi */
export const masterListingSchema = z
  .object({
    id: z.uuid().nullable(),
    categoryId: z.uuid(),
    displayName: z.string().transform(clean).pipe(z.string().min(2).max(60)),
    title: z.string().transform(clean).pipe(z.string().min(3).max(120)),
    description: z.string().trim().min(10).max(3000),
    experienceYears: z.number().int().min(0).max(60),
    services: z
      .array(z.string().transform(clean).pipe(z.string().min(1).max(40)))
      .max(MASTER_SERVICES_MAX),
    regionId: z.uuid().nullable(),
    districtId: z.uuid().nullable(),
    serviceArea: z
      .string()
      .transform(clean)
      .pipe(z.string().max(200))
      .nullable(),
    phone,
    phonePublic: z.boolean(),
    priceNegotiable: z.boolean(),
    priceFrom: z.number().int().min(0).max(1_000_000_000).nullable(),
    priceTo: z.number().int().min(0).max(1_000_000_000).nullable(),
    workFrom: time.nullable(),
    workTo: time.nullable(),
    photos: z.array(photoPath).max(MASTER_PHOTOS_MAX),
    /** true — moderatsiyaga yuborish; false — qoralama */
    submit: z.boolean(),
  })
  .refine(
    (v) => v.priceNegotiable || v.priceFrom !== null || v.priceTo !== null,
    { path: ["priceFrom"] },
  )
  .refine(
    (v) =>
      v.priceFrom === null || v.priceTo === null || v.priceTo >= v.priceFrom,
    { path: ["priceTo"] },
  )
  .refine((v) => (v.workFrom === null) === (v.workTo === null), {
    path: ["workTo"],
  });
export type MasterListingInput = z.infer<typeof masterListingSchema>;

export const masterRequestSchema = z.object({
  listingId: z.uuid(),
  name: z.string().transform(clean).pipe(z.string().min(2).max(80)),
  phone,
  message: z.string().trim().max(1000).optional(),
});

export const masterReviewSchema = z.object({
  listingId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(1000).optional(),
});

/** Qidiruv parametrlari (URL): /ustalar/qidiruv?q=&k=<kategoriya slug>&region=<slug>&exp=1|3|5&sort=new|rating|experience&page= */
export interface MasterSearchParams {
  q: string;
  category: string;
  region: string;
  exp: 0 | 1 | 3 | 5;
  sort: "new" | "rating" | "experience";
  page: number;
}

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export function parseMasterSearch(
  sp: Record<string, string | string[] | undefined>,
): MasterSearchParams {
  const q = one(sp.q).replace(/\s+/g, " ").trim().slice(0, 80);
  const category = /^[a-z0-9_]{2,40}$/.test(one(sp.k)) ? one(sp.k) : "";
  const region = /^[a-z0-9_-]{1,64}$/.test(one(sp.region))
    ? one(sp.region)
    : "";
  const expRaw = Number.parseInt(one(sp.exp), 10);
  const exp = ([1, 3, 5] as const).find((n) => n === expRaw) ?? 0;
  const sortRaw = one(sp.sort);
  const sort =
    sortRaw === "rating" || sortRaw === "experience" ? sortRaw : "new";
  const page = Math.min(
    Math.max(Number.parseInt(one(sp.page), 10) || 1, 1),
    200,
  );
  return { q, category, region, exp, sort, page };
}

export function masterSearchHref(p: Partial<MasterSearchParams>): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.category) sp.set("k", p.category);
  if (p.region) sp.set("region", p.region);
  if (p.exp) sp.set("exp", String(p.exp));
  if (p.sort && p.sort !== "new") sp.set("sort", p.sort);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const qs = sp.toString();
  return qs ? `/ustalar/qidiruv?${qs}` : "/ustalar/qidiruv";
}

/** "o'rnatish, tozalash, diagnostika" → ["o'rnatish","tozalash","diagnostika"] */
export function parseServices(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,;\n]+/)
        .map((s) => clean(s))
        .filter(Boolean),
    ),
  ]
    .slice(0, MASTER_SERVICES_MAX)
    .map((s) => s.slice(0, 40));
}
