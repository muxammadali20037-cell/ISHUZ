import { Constants, type Enums } from "@/types/database.types";

/**
 * Ish qidiruvchining boshlang'ich tanlovi (05 kasblar, 06 hudud va tajriba — ega "MASTER PROMPT", 2026-11-16): shu qurilmada
 * cookie'da, kirish talab qilinmaydi. Hudud alohida — mavjud `ib_place` (find/place.ts) cookie'sida (bosh sahifa va qidiruv
 * uni allaqachon o'qiydi). Bu yerda: tanlangan kasblar (profession_nodes.id, 5 tagacha), "masofaviy ham mos" va tajriba.
 * Format: "<uuid>.<uuid>~<0|1>~<tajriba|->" — cookie'da kodlanmaydigan belgilar (place.ts dagi kabi).
 */
export const PREFS_COOKIE = "ib_prefs";
export const MAX_PREF_PROFESSIONS = 5;

export type ExperienceLevel = Enums<"experience_level">;
export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = Constants.public.Enums.experience_level;

export interface SeekerPrefs {
  professions: string[];
  remote: boolean;
  experience: ExperienceLevel | null;
}

export const EMPTY_PREFS: SeekerPrefs = { professions: [], remote: false, experience: null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isExperienceLevel(v: unknown): v is ExperienceLevel {
  return typeof v === "string" && (EXPERIENCE_LEVELS as readonly string[]).includes(v);
}

/** Kasb ID'lari: faqat uuid, takrorsiz, tartib saqlanadi, 5 tagacha */
export function cleanProfessionIds(ids: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !UUID.test(id)) continue;
    const v = id.toLowerCase();
    if (!out.includes(v)) out.push(v);
    if (out.length >= MAX_PREF_PROFESSIONS) break;
  }
  return out;
}

export function parsePrefs(raw: string | null | undefined): SeekerPrefs {
  if (!raw || raw.length > 400) return EMPTY_PREFS;
  const [p = "", r = "", x = ""] = raw.split("~");
  return {
    professions: cleanProfessionIds(p ? p.split(".") : []),
    remote: r === "1",
    experience: isExperienceLevel(x) ? x : null,
  };
}

export function formatPrefs(p: SeekerPrefs): string {
  return `${cleanProfessionIds(p.professions).join(".")}~${p.remote ? "1" : "0"}~${p.experience ?? "-"}`;
}
