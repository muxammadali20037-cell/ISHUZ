import "server-only";

import { isProhibitedProfession } from "@/features/moderation/policy";
import { createPublicClient } from "@/lib/supabase/public";
import { getDistricts, getRegions } from "@/lib/reference";
import { getProfessionTrail } from "@/features/professions/queries";
import type { PickedProfession } from "@/features/professions/types";
import { normalizeText, type understandQuery } from "@/features/search/understand";
import { professionCandidates, withoutPlaceOnly } from "@/features/find/intent";
import { professionByTypo } from "@/features/find/queries";
import type { PlaceChoice } from "./types";

/**
 * E'lon yozayotganning gapidan kasb va joyni tushunish (ish izlovchi suhbati va ish beruvchi "AI bilan oson joylash" uchun umumiy).
 * Faqat bazadagi ma'lumotnoma: kasb va hudud ID'lari o'ylab topilmaydi.
 */

export interface ProfessionOption {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
}

export async function picked(nodeId: string): Promise<PickedProfession | null> {
  const db = createPublicClient();
  const [trail, { data }] = await Promise.all([
    getProfessionTrail(nodeId),
    db
      .from("profession_nodes")
      .select("category_id, selectable")
      .eq("id", nodeId)
      .maybeSingle(),
  ]);
  if (!trail.length || !data?.category_id || !data.selectable) return null;
  return { id: nodeId, categoryId: data.category_id, trail };
}

/** Kichik guruhlardan navbat bilan (har biridan birinchisi, keyin ikkinchisi, …) — `n` tagacha */
export function spread<T>(branches: { items: T[] }[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < n && branches.some((b) => b.items.length > i); i++) {
    for (const b of branches) {
      if (out.length >= n) break;
      const it = b.items[i];
      if (it) out.push(it);
    }
  }
  return out;
}

export interface ProfessionBranch {
  /** kichik guruh ("Jarrohlik"); null — ildizning o'zidagi aniq kasblar */
  title: ProfessionOption | null;
  /** `more` — ichida yana aniq yo'nalishlar bor ("Buxgalter" → "Soliq buxgalteri", …) */
  items: (ProfessionOption & { more: boolean })[];
}

/**
 * Guruh ("Shifokorlar", "O'qituvchi") yoki aniq kasb ichidagi tanlanadigan kasblar — BITTA so'rov bilan (kasb yo'li `path`
 * bo'yicha), daraxtdagi tartibda, kichik guruhlar bo'yicha. Aniq kasbning ichidagi ixtisosliklar ro'yxatga kirmaydi
 * (ular — keyingi savol, `more`). Taqiqlangan kasblar yo'q. `max` — jami variantlar chegarasi.
 */
export async function professionBranches(rootId: string, max = 150): Promise<ProfessionBranch[]> {
  const { data } = await createPublicClient()
    .from("profession_nodes")
    .select("id, parent_id, name_uz, name_ru, name_en, selectable, sort_order, path")
    .contains("path", [rootId])
    .eq("is_active", true)
    .neq("id", rootId)
    .order("depth")
    .order("sort_order")
    .order("name_uz")
    .limit(800);
  const rows = (data ?? []).filter((r) => !isProhibitedProfession(r));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const hasKids = new Set(rows.filter((r) => r.selectable && r.parent_id).map((r) => r.parent_id as string));
  const buckets = new Map<string, ProfessionBranch["items"]>();
  let count = 0;
  for (const r of rows) {
    if (!r.selectable || count >= max) continue;
    const at = r.path.indexOf(rootId);
    const between = r.path.slice(at + 1, -1);
    // faol bo'lmagan oraliq tugun yoki aniq kasbning ichidagi ixtisoslik — o'tkazib yuboriladi
    if (at < 0 || between.some((id) => !byId.has(id) || byId.get(id)!.selectable)) continue;
    const key = between[0] ?? "";
    const item = { id: r.id, name_uz: r.name_uz, name_ru: r.name_ru, name_en: r.name_en, more: hasKids.has(r.id) };
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(item);
    count += 1;
  }
  const order = (key: string) => {
    const n = byId.get(key);
    return n ? ([n.sort_order, n.name_uz] as const) : ([-Infinity, ""] as const);
  };
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const [sa, na] = order(a);
      const [sb, nb] = order(b);
      return sa === sb ? na.localeCompare(nb) : sa - sb;
    })
    .map(([key, items]) => {
      const n = key ? byId.get(key) : undefined;
      return { title: n ? { id: n.id, name_uz: n.name_uz, name_ru: n.name_ru, name_en: n.name_en } : null, items };
    });
}

/**
 * Matndagi kasb: aniq bo'lsa — bitta (darhol tanlanadi); bir nechta deyarli teng mos keladigan bo'lsa ("kuryer" → piyoda, moto,
 * avto…) — 6 tagacha variant, foydalanuvchi o'zi tanlaydi (taxmin qilib noto'g'ri kasb qo'yilmaydi). Faqat tanlanadigan kasblar.
 * Guruh nomi yoki sinonimi aynan yozilgan bo'lsa ("shifokor", "doktor", "o'qituvchi") — guruh ichidagi kasblar variant bo'ladi
 * (ega, 2026-11-23: "doktor desa — qanday doktor? o'qituvchi desa — qanday o'qituvchi?"; avval "doktor" → "Doktorant (PhD)").
 */
export async function professionFrom(
  text: string,
  places: string[],
): Promise<{ one: PickedProfession | null; options: ProfessionOption[] }> {
  const candidates = withoutPlaceOnly(professionCandidates(text), places).slice(
    0,
    12,
  );
  if (!candidates.length) return { one: null, options: [] };
  const db = createPublicClient();
  const results = await Promise.all(
    candidates.map((c) =>
      db
        .rpc("search_profession_nodes", { p_query: c.slice(0, 80), p_limit: 8 })
        .then((r) => ({ c, hits: r.data ?? [] })),
    ),
  );
  const best = new Map<string, { o: ProfessionOption; score: number; from: string; exact: boolean }>();
  // guruh: nomi yoki sinonimi aynan yozilgan (search_profession_nodes: to'liq moslik — 3 + o'xshashlik), lekin xuddi shu
  // so'z bilan atalgan aniq kasb yo'q ("haydovchi" — "Haydovchi" kasbi; "shifokor" — faqat "Shifokorlar" guruhi)
  for (const { c, hits } of results) {
    const group = hits.find((h) => !h.selectable && h.score >= 3.5 && !isProhibitedProfession(h));
    const ownSelectable = hits.some((h) => h.selectable && [h.name_uz, h.name_ru, h.name_en].some((n) => !!n && normalizeText(n) === normalizeText(c)));
    if (group && !ownSelectable) {
      // 12 tagacha — har kichik guruhdan navbat bilan (faqat terapevtlar emas: terapevt, kardiolog, pediatr, jarroh, …)
      const items = spread(await professionBranches(group.id), 12);
      if (items.length === 1) return { one: await picked(items[0]!.id), options: [] };
      if (items.length) return { one: null, options: items.map(({ id, name_uz, name_ru, name_en }) => ({ id, name_uz, name_ru, name_en })) };
    }
  }
  for (const { c, hits } of results) {
    for (const h of hits) {
      if (!h.selectable || h.score < 2 || isProhibitedProfession(h)) continue;
      const score = h.score + c.split(" ").length * 0.3 - h.depth * 0.01;
      // kasb nomi aynan shu so'z ("oshpaz" → "Oshpaz") — so'ralmaydi, darhol tanlanadi (keyin o'zgartirish mumkin)
      const exact = [h.name_uz, h.name_ru, h.name_en].some((n) => !!n && normalizeText(n) === normalizeText(c));
      const prev = best.get(h.id);
      if (!prev || score > prev.score) best.set(h.id, { o: { id: h.id, name_uz: h.name_uz, name_ru: h.name_ru, name_en: h.name_en }, score, from: c, exact });
    }
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) {
    // imlo xatosi ("santexnk", "oshpz") — bitta-ikkita harf farqi bilan eng yaqin kasb
    const id = await professionByTypo(text, candidates);
    return { one: id ? await picked(id) : null, options: [] };
  }
  // variantlar — eng yaxshi moslik bergan so'z bo'yicha ("kuryer" → piyoda, moto, ekspress…); boshqa so'zdan chiqqan yaqin
  // natija ("kuryerlik" → "Kuryerlik xizmati dispetcheri") aralashmaydi
  const close = ranked.filter((r) => r.from === top.from && r.score >= top.score - 1.05).slice(0, 6);
  if (close.length === 1 || top.exact) return { one: await picked(top.o.id), options: [] };
  return { one: null, options: close.map((r) => r.o) };
}

export async function placeFrom(
  u: ReturnType<typeof understandQuery>,
  regionId: string | null,
): Promise<PlaceChoice | null> {
  const regions = await getRegions();
  const region =
    (u.region ? regions.find((r) => r.slug === u.region!.slug) : null) ??
    (regionId ? regions.find((r) => r.id === regionId) : null) ??
    null;
  if (!region) return null;
  const districts = (await getDistricts()).filter(
    (d) => d.region_id === region.id,
  );
  const district =
    u.districts
      .map((d) => districts.find((x) => x.id === d.id))
      .find(Boolean) ?? null;
  // viloyat nomining o'zi aytilgan ("Toshkent shahri") — tuman hali so'raladi; tuman aytilgan bo'lsa — tanlangan
  return {
    regionId: region.id,
    districtId: district?.id ?? null,
    districtChosen: !!district,
    remote: false,
  };
}

