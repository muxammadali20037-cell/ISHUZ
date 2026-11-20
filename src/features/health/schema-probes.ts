import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** PostgREST / Postgres "obyekt yo'q" kodlari: funksiya, jadval yoki ustun hali yaratilmagan (migratsiya qo'llanmagan) */
const MISSING_CODES = new Set(["PGRST202", "PGRST205", "PGRST204", "42P01", "42883", "42703"]);

export function isMissingObject(error: { code?: string | null } | null | undefined): boolean {
  return !!error?.code && MISSING_CODES.has(error.code);
}

type Probe = { migration: string; run: (db: Admin) => PromiseLike<{ error: { code?: string | null; message?: string } | null }> };

/**
 * Har bir yangi migratsiya uchun bitta zararsiz tekshiruv (yozmaydi, ma'lumot qaytarmaydi). Prod bazada qaysi migratsiya
 * qo'llanmaganini kod bilan baza nomuvofiqligi sababli buzilishdan oldin ko'rsatadi (audit 2026-11: 0069–0073 yo'q edi).
 * Yangi migratsiya qo'shilganda — shu ro'yxatga ham qo'shing.
 */
export const SCHEMA_PROBES: readonly Probe[] = [
  { migration: "0069", run: (db) => db.rpc("vacancy_public_stub", { p_slug: "__health__" }) },
  { migration: "0070", run: (db) => db.rpc("search_vacancies_v3", { p_limit: 1, p_offset: 0 }) },
  { migration: "0071", run: (db) => db.rpc("public_companies", { p_limit: 1 }) },
  { migration: "0072", run: (db) => db.rpc("my_duplicate_vacancy", { p_vacancy_id: "00000000-0000-0000-0000-000000000000" }) },
  { migration: "0073", run: (db) => db.from("profile_interests").select("profile_id").limit(0) },
  { migration: "0074", run: (db) => db.from("contact_reveals").select("target_id").limit(0) },
  { migration: "0075", run: (db) => db.from("telegram_updates").select("attempts").limit(0) },
  { migration: "0076", run: (db) => db.from("master_listings").select("id").limit(0) },
  { migration: "0077", run: (db) => db.rpc("demo_vacancies_public", { p_limit: 1, p_offset: 0 }) },
  // 0078 — faqat ma'lumot (taqiqlangan kasblar), tekshiradigan obyekt yo'q
  { migration: "0079", run: (db) => db.from("channel_posts").select("id").limit(0) },
  { migration: "0080", run: (db) => db.rpc("public_tariffs") },
  { migration: "0081", run: (db) => db.from("worker_listing_phones").select("worker_id").limit(0) },
  { migration: "0082", run: (db) => db.rpc("uz_fold", { t: "test" }) },
  { migration: "0083", run: (db) => db.from("vacancy_contacts").select("channel_phone_at").limit(0) },
  { migration: "0084", run: (db) => db.rpc("listing_phones_public", { p_kind: "none", p_id: "00000000-0000-0000-0000-000000000000" }) },
  { migration: "0085", run: (db) => db.from("telegram_web_logins").select("id").limit(0) },
  { migration: "0086", run: (db) => db.from("worker_profiles").select("is_primary").limit(0) },
];

export type SchemaReport = { ok: boolean; missing: string[]; errors: string[] };

export async function checkSchema(db: Admin): Promise<SchemaReport> {
  const results = await Promise.all(
    SCHEMA_PROBES.map(async (p) => {
      try {
        const { error } = await p.run(db);
        // 42501 — obyekt bor, faqat bu rolga ruxsat yo'q: migratsiya qo'llangan
        if (!error || error.code === "42501") return { migration: p.migration, state: "ok" as const };
        return { migration: p.migration, state: isMissingObject(error) ? ("missing" as const) : ("error" as const) };
      } catch {
        return { migration: p.migration, state: "error" as const };
      }
    }),
  );
  const missing = results.filter((r) => r.state === "missing").map((r) => r.migration);
  const errors = results.filter((r) => r.state === "error").map((r) => r.migration);
  return { ok: missing.length === 0 && errors.length === 0, missing, errors };
}
