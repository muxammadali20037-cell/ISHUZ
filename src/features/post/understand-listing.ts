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

/**
 * Matndagi kasb: aniq bo'lsa — bitta (darhol tanlanadi); bir nechta deyarli teng mos keladigan bo'lsa ("kuryer" → piyoda, moto,
 * avto…) — 6 tagacha variant, foydalanuvchi o'zi tanlaydi (taxmin qilib noto'g'ri kasb qo'yilmaydi). Faqat tanlanadigan kasblar.
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

