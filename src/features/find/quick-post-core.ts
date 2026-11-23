import "server-only";

import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { formatNotes, stripNotes, withNotes } from "@/features/post/notes";
import { getDistricts, getRegions } from "@/lib/reference";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import { getPostViewer } from "@/features/post/queries";
import { professionBranches, professionFrom } from "@/features/post/understand-listing";
import { isProhibitedProfession } from "@/features/moderation/policy";
import { resolveFindQuery } from "./queries";
import { PLACE_COOKIE, parsePlace } from "./place";
import { normalizeText } from "@/features/search/understand";
import { hasJobIntent, offTopic, professionMentioned } from "./post-intent";
import type { QuickOption } from "./quick-types";
import { shortName, type PostAnswers, type PostChoice, type PostChoiceGroup, type PostForm, type PostPreview, type PostUnderstood } from "./quick-post-types";

/**
 * Yordamchi orqali e'lon (ega, 2026-11-17: "«+ E'lon joylash» bosilsa yordamchiga kirsin; «o'qituvchiman», «uqituvchi»,
 * «oqtvchi» deb yozsa ham to'g'ri tushunsin; kerak bo'lsa «aynan qanday o'qituvchisiz?» deb variantlar bersin").
 * Matn → aniq kasb (tanlanadigan) yoki variantlar (guruh ichidagi kasblar yoki teng mos kelganlar); hudud — matndan yoki shu
 * qurilmada eslab qolingan joydan; ism va telefon — hisobdan. Hech narsa o'ylab topilmaydi: faqat kasblar daraxti.
 */

/** Guruh ichidagi variantlar soni chegarasi (Shifokorlar — ~96 ta, O'qituvchi — ~32 ta; hammasi ko'rinadi, qidiruv bilan) */
const MAX_OPTIONS = 150;

type NodeRow = { id: string; parent_id: string | null; name_uz: string; name_ru: string; name_en: string | null; selectable: boolean; sort_order: number };
type NodeFull = NodeRow & { aliases: string[] };

const namesOf = (n: { name_uz: string; name_ru: string; name_en: string | null; aliases?: string[] }) => [n.name_uz, n.name_ru, n.name_en ?? "", ...(n.aliases ?? [])].filter(Boolean);

/**
 * Guruh ("O'qituvchi", "Shifokorlar") ichidagi tanlanadigan kasblar — kichik guruhlar bo'yicha ("Chet tillari" → Ingliz tili
 * o'qituvchisi, …). Aniq kasbning ichidagi ixtisosliklar ("IELTS o'qituvchisi") ro'yxatga kirmaydi — ular keyingi savol
 * (`more`). Daraxtdagi tartibda.
 */
async function groupOptions(groupId: string): Promise<PostChoiceGroup[]> {
  const { name } = await getT();
  const branches = await professionBranches(groupId, MAX_OPTIONS);
  return branches.map((b) => ({ title: b.title ? name(b.title) : null, items: b.items.map((it) => ({ id: it.id, name: name(it), ...(it.more ? { more: true } : {}) })) }));
}

/**
 * Aniq kasbning ichidagi yo'nalishlar (ega, 2026-11-23: "kasblarni ich-ichigacha bilib olib, keyin e'lon joylansin"):
 * "Buxgalter" → avval kasbning o'zi (umumiy), keyin "Soliq buxgalteri", "Ish haqi buxgalteri", … Ichida yo'nalish yo'q — null.
 */
export async function refineOptions(node: { id: string; name: string }): Promise<{ question: string; groups: PostChoiceGroup[] } | null> {
  const { t } = await getT();
  const subs = (await groupOptions(node.id)).flatMap((g) => g.items);
  if (!subs.length) return null;
  return {
    question: t("easy.post_ai.which_area", { name: node.name }),
    groups: [
      { title: null, items: [{ id: node.id, name: node.name }] },
      { title: t("easy.post_ai.which_area_list"), items: subs },
    ],
  };
}

/** "Aynan qanday o'qituvchisiz?" — bitta so'zli guruh nomi bilan; ko'p so'zli bo'lsa — "… : aynan qaysi biri?" */
function whichQuestion(t: (k: string, p?: Record<string, string | number>) => string, group: string | null, uzName?: string): string {
  if (!group) return t("easy.post_ai.which_one");
  const g = group.trim();
  // ko'plikdagi guruh nomi ("Shifokorlar"): o'zbekchada — birlikda ("Aynan qanday shifokorsiz?"), boshqa tillarda — "Врачи: какой
  // именно?" ("Какой именно вы врачи?" emas)
  const plural = !!uzName && /^\S+(lar|ler)$/i.test(uzName.trim());
  const single = plural && /^\S+(lar|ler)$/i.test(g) ? g.replace(/(lar|ler)$/i, "") : g;
  if (/^\S+$/.test(single) && (!plural || single !== g)) return t("easy.post_ai.which", { name: single.charAt(0).toLocaleLowerCase("uz") + single.slice(1) });
  return t("easy.post_ai.which_named", { name: g });
}

/** E'lon oynasining umumiy qismi: hudud (matndan yoki eslab qolingan), ro'yxatlar, hisobdagi ism va telefon */
async function baseForm(text: string, viewerP: ReturnType<typeof getPostViewer>, said: { regionSlug: string | null; districtId: string | null }): Promise<PostForm> {
  const { name } = await getT();
  const [regions, districts, viewer] = await Promise.all([getRegions(), getDistricts(), viewerP]);
  let regionSlug = said.regionSlug;
  let districtId = said.districtId;
  if (!regionSlug) {
    const remembered = parsePlace((await cookies()).get(PLACE_COOKIE)?.value);
    if (remembered) {
      regionSlug = remembered.region;
      districtId = remembered.district !== "all" ? remembered.district : null;
    }
  }
  const region = regionSlug ? regions.find((x) => x.slug === regionSlug) : undefined;
  const district = region && districtId ? districts.find((d) => d.id === districtId && d.region_id === region.id) : undefined;
  const byRegion: Record<string, QuickOption[]> = {};
  for (const d of districts) (byRegion[d.region_id] ??= []).push({ value: d.id, label: name(d) });
  return {
    text,
    profession: null,
    regionId: region?.id ?? null,
    districtId: district?.id ?? null,
    regions: regions.map((x) => ({ value: x.id, label: name(x) })),
    districts: byRegion,
    loggedIn: viewer.loggedIn,
    firstName: viewer.firstName,
    lastName: viewer.lastName,
  };
}

async function selectableNode(id: string): Promise<NodeFull | null> {
  const { data } = await createPublicClient()
    .from("profession_nodes")
    .select("id, parent_id, name_uz, name_ru, name_en, selectable, sort_order, aliases")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return data && !isProhibitedProfession(data) ? data : null;
}

/** Ro'yxatdan tanlangan kasb ichidagi yo'nalishlar (chatda "qaysi yo'nalish?"); yo'q yoki kasb topilmasa — null */
export async function refineById(id: string): Promise<{ question: string; groups: PostChoiceGroup[] } | null> {
  const { name } = await getT();
  const node = await selectableNode(id);
  if (!node?.selectable) return null;
  return refineOptions({ id: node.id, name: name(node) });
}

/** Yozilgan matn → boshqa mavzu (qisqa javob), variantlar yoki tayyor oyna */
export async function preparePost(input: { text: string; session: SessionContext | null }): Promise<PostUnderstood> {
  const { t, name } = await getT();
  const text = input.text.trim();
  // hisobdagi ism va telefon — tushunish bilan bir vaqtda (ketma-ket kutilmaydi)
  const viewerP = getPostViewer(input.session);
  // boshqa mavzu bo'lsa kutilmaydi — xatosi ishlanmagan bo'lib qolmasin
  viewerP.catch(() => null);
  if (!text) return { kind: "form", form: await baseForm("", viewerP, { regionSlug: null, districtId: null }) };

  // salomlashish, rahmat, "kimsan" — darhol qisqa javob (kasb qidirilmaydi)
  const pre = offTopic(text, false);
  if (pre && pre !== "other") return { kind: "reply", reply: t(`easy.post_ai.reply.${pre}`) };

  const r = await resolveFindQuery(text);
  let profession: PostChoice | null = null;
  let groups: PostChoiceGroup[] = [];
  let group: string | null = null;

  // kasb nomi gapda haqiqatan bo'lishi kerak ("bugun havo zo'r" → "Havo … elektromontyori" emas)
  const hit = r.nodeId ? await selectableNode(r.nodeId) : null;
  const node = hit && professionMentioned(text, namesOf(hit), normalizeText) ? hit : null;
  if (node?.selectable) profession = { id: node.id, name: name(node) };
  else if (node) {
    // guruh ("O'qituvchi") — aynan qaysi biri, so'raladi
    groups = await groupOptions(node.id);
    group = name(node);
    const all = groups.flatMap((g) => g.items);
    if (all.length === 1) {
      profession = all[0]!;
      groups = [];
    }
  }
  if (!profession && !groups.length) {
    const regions = await getRegions();
    const said = r.regionSlug ? regions.find((x) => x.slug === r.regionSlug) : undefined;
    const res = await professionFrom(text, said ? [said.name_uz, said.name_ru] : []);
    const one = res.one ? await selectableNode(res.one.id) : null;
    const options = res.options.filter((o) => professionMentioned(text, namesOf(o), normalizeText));
    if (one && professionMentioned(text, namesOf(one), normalizeText)) profession = { id: one.id, name: name(one) };
    else if (options.length) groups = [{ title: null, items: options.map((o) => ({ id: o.id, name: name(o) })) }];
  }

  const found = !!profession || groups.length > 0;
  const off = pre && offTopic(text, found);
  if (off) return { kind: "reply", reply: t(`easy.post_ai.reply.${off}`) };
  // kasb tushunilmadi va gap ish haqida emas ("bugun havo zo'r") — oyna emas, kasbni qaytadan so'rash;
  // "ish kerak", "e'lon joylamoqchiman" — oyna ochiladi, kasb unda yoziladi
  if (!found && !hasJobIntent(text)) return { kind: "reply", reply: t("easy.post_ai.reply.unclear") };

  let question = groups.length ? whichQuestion(t, group, node?.name_uz) : null;
  // aniq kasbning ichida yo'nalishlar bor ("Buxgalter", "Oshpaz") — qaysi yo'nalish, so'raladi (birinchi variant — kasbning o'zi)
  if (profession && !groups.length) {
    const refine = await refineOptions(profession);
    if (refine) {
      groups = refine.groups;
      question = refine.question;
      profession = null;
    }
  }
  const form = { ...(await baseForm(text, viewerP, { regionSlug: r.regionSlug, districtId: r.districtId })), profession };
  if (groups.length && question) return { kind: "options", question, groups, form };
  return { kind: "form", form };
}

/**
 * Avvalgi e'londagi o'z so'zlari bilan yozilgan "O'zim haqimda" — kasb o'zgarmagan bo'lsa saqlanadi (qisqa oyna uni
 * avtomatik matn bilan jim almashtirib yubormasin)
 */
async function keptAbout(session: SessionContext | null, professionId: string): Promise<string | null> {
  if (!session?.workerId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("worker_profiles").select("profession_node_id, about").eq("id", session.workerId).maybeSingle();
  const about = data?.about?.trim() ?? "";
  return data?.profession_node_id === professionId && about.length >= 10 ? about : null;
}

/**
 * "Sizning e'loningiz shunday ko'rinadi": javoblar tekshiriladi va joylanadigan matn yig'iladi. "O'zim haqimda" — faqat
 * foydalanuvchi aytgan narsalardan (kasb, tajriba, hudud) yoki avvalgi e'londagi o'z matni; hech narsa qo'shilmaydi.
 * null — kasb, hudud yoki tuman noto'g'ri (ro'yxatda yo'q).
 */
export async function buildPreview(session: SessionContext | null, answers: PostAnswers): Promise<PostPreview | null> {
  const { t, name } = await getT();
  const [node, regions, districts, viewer] = await Promise.all([selectableNode(answers.professionId), getRegions(), getDistricts(), getPostViewer(session)]);
  const region = regions.find((x) => x.id === answers.regionId);
  if (!node?.selectable || !region) return null;
  const district = answers.districtId ? districts.find((d) => d.id === answers.districtId && d.region_id === region.id) : undefined;
  if (answers.districtId && !district) return null;
  const profession = name(node);
  const place = [name(region), district ? name(district) : null].filter(Boolean).join(", ");
  const kept = await keptAbout(session, node.id);
  const own = kept ?? t("easy.post_ai.about", { profession, experience: t(`easy.post_ai.about_exp.${answers.experience}`), place });
  // "Izoh" (ega, 2026-11-22: "obed, yo'lkira tekin…" — chiroyli taxlab) — matn oxirida ✅ bilan; yangisi eskisining o'rniga
  const notes = formatNotes("", answers.notes ?? []);
  // izoh savoliga javob berilgan bo'lsa (bo'sh — "Izohsiz") avvalgi e'londagi eski ✅ qatorlar olib tashlanadi
  const about = answers.notes ? withNotes(stripNotes(own), notes) : own;
  return {
    answers,
    profession,
    name: shortName(answers.firstName, answers.lastName),
    place,
    about,
    loggedIn: viewer.loggedIn,
  };
}
