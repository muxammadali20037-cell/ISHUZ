import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { checkRules } from "./rules";
import { banForViolation } from "./enforce";
import { shouldBan } from "./policy";

/**
 * Joylangan (eski) e'lonlarni yangi qoidalar bilan qayta tekshirish (ega, 2026-11-13: "joylagandan keyin har bir so'z
 * tekshirilsin — e'lon ham o'chirilsin, o'zi ham bloklansin"). Yangi e'lonlar joylashda tekshiriladi; bu esa qoidalar
 * kuchaytirilishidan OLDIN joylanganlar uchun.
 *
 * Fon navbatida (cron, har daqiqa) kichik bo'laklarda: vakansiyalar, ishchi e'lonlari, ustalar e'lonlari — id tartibida,
 * kursor app_settings'da. Qoidalar versiyasi o'zgarsa (RULES_VERSION) — hammasi boshidan bir marta qayta o'tadi.
 * Og'ir topilmada: muallif bloklanadi va barcha e'lonlari yashiriladi (enforce.ts). Hech narsa o'chirilmaydi.
 */
export const RULES_VERSION = "2026-11-13.strict";
const KEY = "moderation_rules_sweep";

type Entity = "vacancy" | "worker" | "master";
const ENTITIES: Entity[] = ["vacancy", "worker", "master"];
interface Cursor {
  version: string;
  after: Partial<Record<Entity, string>>;
  done: Partial<Record<Entity, boolean>>;
}
interface Row {
  id: string;
  owner: string | null;
  fields: Record<string, string | null | undefined>;
}
type Db = ReturnType<typeof createAdminClient>;

const FIRST_ID = "00000000-0000-0000-0000-000000000000";

async function loadCursor(db: Db): Promise<Cursor> {
  const { data } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? null) as Cursor | null;
  if (!v || v.version !== RULES_VERSION) return { version: RULES_VERSION, after: {}, done: {} };
  return { version: v.version, after: v.after ?? {}, done: v.done ?? {} };
}

async function saveCursor(db: Db, c: Cursor) {
  await db.from("app_settings").upsert({ key: KEY, value: c as unknown as NonNullable<Json>, is_public: false }, { onConflict: "key" });
}

const names = (n: { name_uz: string; name_ru: string } | null | undefined) => (n ? `${n.name_uz} / ${n.name_ru}` : null);

async function batch(db: Db, entity: Entity, after: string, limit: number): Promise<Row[]> {
  if (entity === "vacancy") {
    const { data, error } = await db
      .from("vacancies")
      .select("id, owner_profile_id, title, description, address, custom_profession, profession:profession_nodes!vacancies_profession_node_id_fkey(name_uz, name_ru), company:companies!vacancies_company_id_fkey(name)")
      .in("status", ["active", "pending_review", "paused"])
      .gt("id", after)
      .order("id")
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((v) => ({
      id: v.id,
      owner: v.owner_profile_id,
      fields: { title: v.title, description: v.description, address: v.address, profession: v.custom_profession ?? names(v.profession), employer: v.company?.name },
    }));
  }
  if (entity === "worker") {
    const { data, error } = await db
      .from("worker_profiles")
      .select("id, profile_id, headline, about, custom_profession, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz, name_ru)")
      .eq("is_public", true)
      .gt("id", after)
      .order("id")
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((w) => ({
      id: w.id,
      owner: w.profile_id,
      fields: { title: w.headline, description: w.about, profession: w.custom_profession ?? names(w.profession) },
    }));
  }
  const { data, error } = await db
    .from("master_listings")
    .select("id, owner_profile_id, display_name, title, description, services, service_area")
    .in("status", ["active", "pending_review", "hidden"])
    .eq("is_demo", false)
    .gt("id", after)
    .order("id")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    owner: m.owner_profile_id,
    fields: { displayName: m.display_name, title: m.title, description: m.description, services: (m.services ?? []).join("\n"), serviceArea: m.service_area },
  }));
}

/** Bir qadam: har turdan `limit` tagacha. Qaytaradi: tekshirilgan va bloklangan soni. */
export async function sweepPublishedContent(limit = 100, budgetMs = 10_000): Promise<{ checked: number; banned: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { checked: 0, banned: 0 };
  const started = Date.now();
  const db = createAdminClient();
  const cursor = await loadCursor(db);
  if (ENTITIES.every((e) => cursor.done[e])) return { checked: 0, banned: 0 };
  let checked = 0;
  let banned = 0;
  const seen = new Set<string>();
  for (const entity of ENTITIES) {
    if (cursor.done[entity] || Date.now() - started > budgetMs) continue;
    let rows: Row[];
    try {
      rows = await batch(db, entity, cursor.after[entity] ?? FIRST_ID, limit);
    } catch (e) {
      // bir turdagi xato (masalan, jadval hali yo'q) boshqalarini to'xtatmasin; keyingi qadamda qayta urinadi
      console.error("[moderation] sweep", entity, e instanceof Error ? e.message : e);
      continue;
    }
    for (const row of rows) {
      checked += 1;
      const block = checkRules(row.fields).block;
      if (block && row.owner && !seen.has(row.owner) && shouldBan({ decision: "reject", category: block.category })) {
        seen.add(row.owner);
        const did = await banForViolation({ profileId: row.owner, category: block.category, code: `sweep_rule_${block.rule}`, source: "rules", entity });
        if (did) banned += 1;
      }
    }
    const last = rows.at(-1);
    if (last) cursor.after[entity] = last.id;
    if (rows.length < limit) cursor.done[entity] = true;
  }
  await saveCursor(db, cursor);
  return { checked, banned };
}
