import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { checkRules } from "./rules";
import { banForViolation } from "./enforce";
import { shouldBan } from "./policy";

/**
 * Joylangan (eski) e'lonlarni yangi qoidalar bilan qayta tekshirish (ega, 2026-11-13: "joylagandan keyin har bir so'z
 * tekshirilsin — e'lon ham o'chirilsin, o'zi ham bloklansin"; 2026-11-14: "massajchi ham kerakmas, ular e'londa bor —
 * hammasini yo'q qil"). Yangi e'lonlar joylashda tekshiriladi; bu esa qoidalar kuchaytirilishidan OLDIN joylanganlar uchun.
 *
 * Kichik bo'laklarda, id tartibida, kursor app_settings'da: vakansiyalar, ishchi e'lonlari (qo'shimcha kasblari bilan),
 * ustalar e'lonlari (namunalari bilan) va namuna vakansiyalar. Qoidalar versiyasi o'zgarsa (RULES_VERSION) — hammasi
 * boshidan bir marta qayta o'tadi. Ishga tushiruvchilar: fon navbati (tick) va sayt trafigi (sweep-trigger.ts).
 *
 * Og'ir topilmada:
 *  1) e'lonning O'ZI darhol ommadan olinadi — muallif kim bo'lishidan qat'i nazar (admin ham, egasiz namuna ham):
 *     vakansiya → "hidden", ishchi e'loni → ommaviy emas, usta e'loni → "rejected", namuna vakansiya → o'chiriladi
 *     (u haqiqiy foydalanuvchi ma'lumoti emas, admin "Namuna e'lonlar"dan qayta yaratadi);
 *  2) muallif bloklanadi va boshqa e'lonlari ham yashiriladi (enforce.ts; faol adminlar bloklanmaydi).
 * Foydalanuvchi e'lonlari bazadan o'chirilmaydi — admin qaytaradi.
 */
export const RULES_VERSION = "2026-11-14.hide-items";
const KEY = "moderation_rules_sweep";

type Entity = "vacancy" | "worker" | "master" | "demo";
const ENTITIES: Entity[] = ["vacancy", "worker", "master", "demo"];
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
      .select(
        "id, profile_id, headline, about, custom_profession, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz, name_ru), extra:worker_professions(node:profession_nodes!worker_professions_node_id_fkey(name_uz, name_ru))",
      )
      .eq("is_public", true)
      .gt("id", after)
      .order("id")
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((w) => ({
      id: w.id,
      owner: w.profile_id,
      fields: {
        title: w.headline,
        description: w.about,
        profession: w.custom_profession ?? names(w.profession),
        // qo'shimcha kasblar ham kartada ko'rinadi (masalan asosiy — Sotuvchi, qo'shimcha — Massajchi)
        extra: (w.extra ?? []).map((e) => names(e.node)).filter(Boolean).join("\n") || null,
      },
    }));
  }
  if (entity === "demo") {
    const { data, error } = await db.from("demo_vacancies").select("id, title_uz, title_ru, title_en").gt("id", after).order("id").limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({ id: d.id, owner: null, fields: { title: [d.title_uz, d.title_ru, d.title_en].filter(Boolean).join(" / ") } }));
  }
  const { data, error } = await db
    .from("master_listings")
    .select("id, owner_profile_id, display_name, title, description, services, service_area")
    .in("status", ["active", "pending_review", "hidden"])
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

/** Topilgan e'lonning o'zini ommadan olish (muallifdan qat'i nazar). Qaytaradi: haqiqatan o'zgardimi. */
async function hideItem(db: Db, entity: Entity, id: string): Promise<boolean> {
  if (entity === "vacancy") {
    const { data } = await db.from("vacancies").update({ status: "hidden" }).eq("id", id).in("status", ["active", "pending_review", "paused"]).select("id");
    return (data?.length ?? 0) > 0;
  }
  if (entity === "worker") {
    const { data } = await db.from("worker_profiles").update({ is_public: false }).eq("id", id).eq("is_public", true).select("id");
    return (data?.length ?? 0) > 0;
  }
  if (entity === "master") {
    const { data } = await db
      .from("master_listings")
      .update({ status: "rejected", reject_reason: "prohibited_content" })
      .eq("id", id)
      .in("status", ["active", "pending_review", "hidden"])
      .select("id");
    return (data?.length ?? 0) > 0;
  }
  const { data } = await db.from("demo_vacancies").delete().eq("id", id).select("id");
  return (data?.length ?? 0) > 0;
}

export interface SweepResult {
  checked: number;
  /** ommadan olingan e'lonlar */
  hidden: number;
  /** bloklangan mualliflar */
  banned: number;
  /** joriy qoidalar versiyasi bo'yicha hammasi tekshirib bo'lingan */
  done: boolean;
}

/** Bir qadam: har turdan `limit` tagacha. */
export async function sweepPublishedContent(limit = 100, budgetMs = 10_000): Promise<SweepResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { checked: 0, hidden: 0, banned: 0, done: true };
  const started = Date.now();
  const db = createAdminClient();
  const cursor = await loadCursor(db);
  if (ENTITIES.every((e) => cursor.done[e])) return { checked: 0, hidden: 0, banned: 0, done: true };
  let checked = 0;
  let hidden = 0;
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
      if (!block) continue;
      try {
        if (await hideItem(db, entity, row.id)) hidden += 1;
      } catch (e) {
        console.error("[moderation] sweep hide", entity, e instanceof Error ? e.message : e);
      }
      if (row.owner && !seen.has(row.owner) && shouldBan({ decision: "reject", category: block.category })) {
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
  if (hidden || banned) console.info("[moderation] sweep", { checked, hidden, banned });
  return { checked, hidden, banned, done: ENTITIES.every((e) => cursor.done[e]) };
}
