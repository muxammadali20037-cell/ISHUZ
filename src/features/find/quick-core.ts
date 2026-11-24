import "server-only";

import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { getListingImageUrls } from "@/features/listing-image/server";
import { formatMoneyShort } from "@/lib/format";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { savedIdSet } from "@/features/saved/queries";
import { trackServer } from "@/features/analytics/server";
import { saveJobsSearch } from "@/features/saved-searches/actions";
import { smartResolveQuery } from "./ai-search";
import { textKeywords } from "./ai-keywords";
import { offTopic } from "./post-intent";
import { detectIntent, detectPostIntent } from "./intent";
import { EMPTY_FIND, findHref, type FindParams } from "./params";
import { PLACE_COOKIE, parsePlace } from "./place";
import { findJobs, findJobsByText, findJobsInCategory, findWorkers, getNodeInfo, getNodeTerms, type NodeInfo } from "./queries";
import { familyOf, wordsRelatedTo, type FamilyCategory } from "./families";
import type { JobCardData } from "./components/result-cards";
import type { WorkerRow } from "./queries";
import { fixManagerTypos } from "./manager-family";
import { NO_FILTERS, type QuickAnswers, type QuickFilters, type QuickForm, type QuickList, type QuickMode, type QuickOption, type QuickResult, type QuickSaveState } from "./quick-types";

/**
 * Yordamchi — oddiy qidiruv yadrosi (2026-11-16, ega: uzun AI matni o'rniga so'rovnoma).
 *  1) `prepareQuick` — yozilgan matndan kasb, hudud va maoshni tushunadi (lug'at, kerak bo'lsa AI) va oynani oldindan to'ldiradi;
 *  2) `runQuick` — oynadagi javoblar bilan bazadan HAQIQIY e'lonlarni oladi. Topilmasa: ish qidiruvchi kirgan bo'lsa —
 *     qidiruv saqlanadi (mos e'lon chiqsa bildirishnoma keladi, 0021 saved_searches), pastda — shunga yaqin kasblar.
 * Hech narsa o'ylab topilmaydi; AI faqat matnni tushunish uchun (javob matni yozmaydi). Limit va kirish — chaqiruvchida.
 */

const SHOW = 10;
const SIMILAR = 5;

interface Place {
  regionId: string | null;
  districtId: string | null;
  remote: boolean;
}

interface ResolvedPlace {
  place: Place;
  /** FindParams uchun */
  region: string;
  district: string | null;
  label: string;
  /** /jobs (saqlangan qidiruv) uchun viloyat slug'i */
  regionSlug: string | null;
}

/** Hudud tanlovi: "Butun O'zbekiston", (eslab qolingan tuman), "Masofaviy" (faqat ish qidirishda) va viloyatlar */
export async function placeOptions(mode: QuickMode, extra: QuickOption | null = null): Promise<QuickOption[]> {
  const [{ t, name }, regions] = await Promise.all([getT(), getRegions()]);
  return [
    { value: "all", label: t("easy.location.whole_country") },
    ...(extra ? [extra] : []),
    ...(mode === "jobs" ? [{ value: "remote", label: t("easy.quick.remote") }] : []),
    ...regions.map((r) => ({ value: r.slug, label: name(r) })),
  ];
}

/** "slug", "slug~tuman", "all", "remote" → qidiruv joyi; noto'g'ri qiymat — butun O'zbekiston */
async function resolvePlace(value: string): Promise<ResolvedPlace> {
  const { t, name } = await getT();
  const all: ResolvedPlace = { place: { regionId: null, districtId: null, remote: false }, region: "all", district: null, label: t("easy.location.whole_country"), regionSlug: null };
  if (value === "remote") return { place: { regionId: null, districtId: null, remote: true }, region: "remote", district: null, label: t("easy.quick.remote"), regionSlug: null };
  const [slug, districtId] = value.split("~");
  if (!slug || slug === "all") return all;
  const region = (await getRegions()).find((r) => r.slug === slug);
  if (!region) return all;
  const district = districtId ? ((await getDistricts(region.id)).find((d) => d.id === districtId) ?? null) : null;
  return {
    place: { regionId: region.id, districtId: district?.id ?? null, remote: false },
    region: region.slug,
    district: district?.id ?? "all",
    label: [name(region), district ? name(district) : null].filter(Boolean).join(", "),
    regionSlug: region.slug,
  };
}

function emptyForm(mode: QuickMode, text: string): QuickForm {
  return { mode, text, profession: "", nodeId: null, place: "all", salary: null, filters: NO_FILTERS, places: [] };
}

/** Yozilgan matn → oynaning boshlang'ich javoblari */
export async function prepareQuick(input: { text: string; mode: QuickMode; session: SessionContext | null }): Promise<QuickForm> {
  const { t, name } = await getT();
  // boshqa mavzu ("salom", "rahmat", "kimsan") — oyna chiqmaydi, qisqa javob (ega, 2026-11-17); tushunishga (AI) ham bormaydi
  const pre = input.text ? offTopic(input.text, false) : null;
  if (pre && pre !== "other") return { ...emptyForm(input.mode, input.text), reply: t(`easy.quick.reply.${pre}_${input.mode}`) };
  // e'lon berish ("vakansiya joylamoqchiman") — qidiruv emas: chat e'lon berishga yo'naltiradi
  const post = input.text ? detectPostIntent(input.text) : null;
  if (post) return { ...emptyForm(input.mode, input.text), post };
  const intent = input.text ? detectIntent(input.text) : null;
  const empty = { mode: input.mode, nodeId: null, regionSlug: null, districtId: null, remote: false, salary: null, pay: null, noexp: false, exp: false, schedule: null };
  const r = input.text ? await smartResolveQuery(input.text, input.session?.userId ?? null, input.mode) : empty;
  const node = r.nodeId ? await getNodeInfo(r.nodeId).catch(() => null) : null;
  // ish bilan bog'liq bo'lmagan savol ("ob-havo qanday?") — kasb, hudud yoki maosh tushunilmagan bo'lsa
  const off = pre && offTopic(input.text, !!node || !!r.regionSlug || !!r.salary || r.remote);
  if (off) return { ...emptyForm(input.mode, input.text), reply: t(`easy.quick.reply.${off}_${input.mode}`) };
  const regions = await getRegions();
  // kasb tushunilmasa — matndagi asosiy so'z (kompaniya nomi, erkin lavozim; hudud nomi emas); oynada o'zgartirsa bo'ladi
  const said = r.regionSlug ? regions.find((x) => x.slug === r.regionSlug) : undefined;
  // shu viloyatning barcha tumanlari: ikki tuman aytilsa ("Chilonzor yoki Yunusobod") tuman tanlanmaydi, lekin uning nomi
  // kasb deb olinmasin (QA, 2026-11-21: "Qanday ish?" ga "chilonzor" yozilib, shu so'z bo'yicha qidirilardi)
  const saidDistricts = said ? await getDistricts(said.id) : [];
  const placeNames = [said?.name_uz, said?.name_ru, ...saidDistricts.flatMap((d) => [d.name_uz, d.name_ru])].filter((x): x is string => !!x);
  // butun soha ("kuryer", "IT sohasida ish", "call-markaz") — bitta kasb emas, shu sohaning hamma vakansiyalari (faqat ish qidirishda)
  const family = input.mode === "jobs" && input.text ? familyOf(input.text, placeNames.flatMap((n) => n.split(/\s+/))) : null;
  const familyCat = family ? (await getCategories()).find((c) => c.slug === family) : undefined;
  const profession = familyCat ? name(familyCat) : node ? name(node.trail.at(-1)!) : (textKeywords(fixManagerTypos(input.text), placeNames, 1)[0] ?? "");

  // hudud: matnda aytilgani, bo'lmasa — shu qurilmada eslab qolingani ("Yaqin atrofda" / bosh sahifadagi joy)
  let place = "all";
  let placeKnown = false;
  let extra: QuickOption | null = null;
  if (r.remote && input.mode === "jobs") {
    place = "remote";
    placeKnown = true;
  } else {
    const remembered = parsePlace((await cookies()).get(PLACE_COOKIE)?.value);
    const slug = r.regionSlug ?? remembered?.region ?? null;
    const region = slug ? regions.find((x) => x.slug === slug) : undefined;
    const districtId = r.regionSlug ? r.districtId : remembered && remembered.district !== "all" ? remembered.district : null;
    const district = region && districtId ? ((await getDistricts(region.id)).find((d) => d.id === districtId) ?? null) : null;
    if (region) {
      place = district ? `${region.slug}~${district.id}` : region.slug;
      placeKnown = true;
      if (district) extra = { value: place, label: `${name(region)}, ${name(district)}` };
    }
  }
  return {
    mode: input.mode,
    text: input.text,
    profession,
    // ishchi qidirishga o'tilsa — aniq kasb bilan (soha bo'yicha ishchi qidiruvi yo'q)
    nodeId: node?.id ?? null,
    category: familyCat ? family : null,
    place,
    // ega (2026-11-17): "oylik maosh kerak emas" — oynada so'ralmaydi va qidiruvga qo'shilmaydi
    salary: null,
    filters: {
      pay: input.mode === "jobs" ? r.pay : null,
      noexp: input.mode === "jobs" && r.noexp,
      exp: input.mode === "workers" && r.exp,
      schedule: input.mode === "jobs" ? r.schedule : null,
    },
    places: await placeOptions(input.mode, extra),
    intent,
    placeKnown,
    placeSaid: (r.remote && input.mode === "jobs") || !!r.regionSlug,
  };
}

type Run = { ok: true; list: QuickList } | { ok: false };

function emptyList(href: string): QuickList {
  return { jobs: [], workers: [], images: {}, photos: {}, total: 0, href };
}

/**
 * `prefetch` — oyna ochilganda oldindan (foydalanuvchi "Qidirish"ni bosmasdan): hech narsa saqlanmaydi va statistikaga
 * yozilmaydi; topilmasa — o'xshashlar ham qidirilmaydi (bosilganda haqiqiy qidiruv o'zi qiladi).
 * Tezlik: kasb oldindan tushunilgan bo'lsa — qidiruv kasb ma'lumoti bilan bir vaqtda; o'xshashlar va saqlash — parallel.
 */
export async function runQuick(input: { mode: QuickMode; answers: QuickAnswers; session: SessionContext | null; prefetch?: boolean }): Promise<{ ok: true; data: QuickResult } | { ok: false }> {
  const { mode, answers, session } = input;
  const { t, name, locale, tEnum } = await getT();
  const where = await resolvePlace(answers.place);
  const f: QuickFilters = mode === "jobs" ? { ...answers.filters, exp: false } : { ...NO_FILTERS, exp: answers.filters.exp };
  // kunlik haqli ishda oylik maosh so'ralmaydi
  const salary = mode === "jobs" && !f.pay && answers.salary && answers.salary > 0 ? Math.min(Math.round(answers.salary), 1_000_000_000) : null;
  const text = answers.profession.replace(/\s+/g, " ").trim().slice(0, 120);
  const kind = mode === "jobs" ? "vacancy" : "worker";

  // o'xshashlarda faqat "kunlik" qoladi (tajriba, grafik va maosh — aynan so'ralganida)
  const params = (p: string | null, w: ResolvedPlace, s: number | null, q = "", strict = true): FindParams => ({
    ...EMPTY_FIND,
    mode,
    p,
    q,
    region: w.region,
    district: w.district,
    salary: s,
    pay: f.pay,
    noexp: strict && f.noexp,
    exp: strict && f.exp,
    schedule: strict ? f.schedule : null,
    page: 1,
  });
  const list = (items: Array<JobCardData | WorkerRow>, res: { images: Record<string, string>; photos?: Record<string, string>; total: number }, href: string): QuickList => ({
    jobs: mode === "jobs" ? (items as JobCardData[]) : [],
    workers: mode === "workers" ? (items as WorkerRow[]) : [],
    images: res.images,
    photos: res.photos ?? {},
    total: res.total,
    href,
  });
  const byNode = async (p: string | null, w: ResolvedPlace, s: number | null, limit: number, strict = true): Promise<Run> => {
    const fp = params(p, w, s, "", strict);
    const res = mode === "jobs" ? await findJobs(fp, w.place, limit) : await findWorkers(fp, w.place, limit);
    return res.ok ? { ok: true, list: list(res.items.slice(0, limit), res, findHref(fp)) } : { ok: false };
  };

  // kasb: oynada o'zgartirilmagan bo'lsa — tushunilgan tugun (qidiruv uning ma'lumoti bilan bir vaqtda boshlanadi);
  // aks holda yozilgan nom qaytadan tushuniladi
  // butun soha ("kuryer", "IT") — aniq kasb o'rniga shu kategoriyaning hamma vakansiyalari (faqat ish qidirishda)
  const category: FamilyCategory | null = mode === "jobs" && answers.category ? answers.category : null;
  const categoryRef = category ? ((await getCategories()).find((c) => c.slug === category) ?? null) : null;
  const early = !categoryRef && answers.nodeId ? byNode(answers.nodeId, where, salary, SHOW) : null;
  // kasb boshqacha tushunilsa — bu natija ishlatilmaydi (xatosi ham)
  early?.catch(() => null);
  let node: NodeInfo | null = !categoryRef && answers.nodeId ? await getNodeInfo(answers.nodeId).catch(() => null) : null;
  if (!categoryRef && !node && text.length >= 2) {
    const r = await smartResolveQuery(text, session?.userId ?? null, mode);
    node = r.nodeId ? await getNodeInfo(r.nodeId).catch(() => null) : null;
  }
  const words = node || categoryRef ? [] : textKeywords(text, [], 3);

  const byText = async (w: ResolvedPlace, s: number | null, limit: number, strict = true): Promise<Run> => {
    for (const word of words) {
      const fp = params(null, w, s, word, strict);
      const res = await findJobsByText(fp, w.place, limit);
      if (!res.ok) return { ok: false };
      if (res.total > 0) return { ok: true, list: list(res.items.slice(0, limit), res, findHref(fp)) };
    }
    return { ok: true, list: emptyList(findHref(params(null, w, s, words[0] ?? "", strict))) };
  };
  const byCategory = async (w: ResolvedPlace, s: number | null, limit: number, strict = true): Promise<Run> => {
    const fp = params(null, w, s, "", strict);
    const res = await findJobsInCategory(fp, w.place, categoryRef!.id, limit);
    return res.ok ? { ok: true, list: list(res.items.slice(0, limit), res, findHref({ ...fp, q: name(categoryRef!) })) } : { ok: false };
  };
  // kasb aniqlanmagan, lekin so'z bor (kompaniya nomi, erkin lavozim) — e'lon matnlaridan; xodim qidirishda matnli qidiruv yo'q
  const textual = !node && !categoryRef && words.length > 0 && mode === "jobs";

  // xodim qidirishda kasbga aylanmagan so'z ("kosmonavt") — hamma nomzodlar emas, "topilmadi"
  const unknownWorker = mode === "workers" && !node && words.length > 0;
  const main: Run = unknownWorker
    ? { ok: true, list: emptyList(findHref(params(null, where, null))) }
    : categoryRef
      ? await byCategory(where, salary, SHOW)
      : textual
      ? await byText(where, salary, SHOW)
      : early && node?.id === answers.nodeId
        ? await early
        : await byNode(node?.id ?? null, where, salary, SHOW);
  if (!main.ok) return { ok: false };

  const shownIds = [...main.list.jobs, ...main.list.workers].map((x) => x.id);
  const savedP = savedIdSet(session, kind, shownIds);
  let similar: QuickResult["similar"] = null;
  let save: QuickSaveState = null;
  if (main.list.total === 0 && !input.prefetch) {
    // pastda — shunga yaqin kasblar (ota yo'nalish: shu hududda, keyin hamma joyda); bo'lmasa — shu kasb boshqa hududlarda.
    // Hammasi bir vaqtda so'raladi, birinchi bo'sh bo'lmagani (shu tartibda) olinadi; qidiruv saqlanishi ham parallel
    const everywhere = await resolvePlace("all");
    const specific = answers.place !== "all";
    const parent = node && node.trail.length > 1 ? node.trail.at(-2)! : null;
    // aniq kasb bo'yicha yo'q — foydalanuvchi yozgan va shu kasbga tegishli so'z e'lon nomlarida ("kuryer" — "Piyoda kuryer"
    // tuguni bo'sh, lekin "Posilka kuryeri", "Oziq-ovqat kuryeri" e'lonlari bor). Faqat ish qidirishda
    const related = mode === "jobs" && node && answers.query ? wordsRelatedTo(textKeywords(answers.query, [], 3), await getNodeTerms(node.id).catch(() => [])) : [];
    const byRelated = (w: ResolvedPlace) => async (): Promise<Run> => {
      for (const word of related) {
        const fp = params(null, w, null, word, false);
        const res = await findJobsByText(fp, w.place, SIMILAR);
        if (!res.ok) return { ok: false };
        if (res.total > 0) return { ok: true, list: list(res.items.slice(0, SIMILAR), res, findHref(fp)) };
      }
      return { ok: true, list: emptyList(findHref(params(null, w, null))) };
    };
    const tries: { kind: "near" | "elsewhere"; run: () => Promise<Run> }[] = [
      ...(parent ? [{ kind: "near" as const, run: () => byNode(parent.id, where, null, SIMILAR, false) }] : []),
      ...(related.length ? [{ kind: "near" as const, run: byRelated(where) }] : []),
      ...(parent && specific ? [{ kind: "near" as const, run: () => byNode(parent.id, everywhere, null, SIMILAR, false) }] : []),
      ...(related.length && specific ? [{ kind: "near" as const, run: byRelated(everywhere) }] : []),
      ...((specific || salary || f.noexp || f.exp || f.schedule) && !unknownWorker
        ? [
            {
              kind: "elsewhere" as const,
              run: () => (categoryRef ? byCategory(everywhere, null, SIMILAR, false) : textual ? byText(everywhere, null, SIMILAR, false) : byNode(node?.id ?? null, everywhere, null, SIMILAR, false)),
            },
          ]
        : []),
    ];
    const [runs, saved] = await Promise.all([
      Promise.all(tries.map((x) => x.run().catch((): Run => ({ ok: false })))),
      mode === "jobs" ? saveSearch(session, node, words[0] ?? null, where, salary, categoryRef?.slug ?? null) : Promise.resolve<QuickSaveState>(null),
    ]);
    save = saved;
    const at = runs.findIndex((res) => res.ok && res.list.total > 0);
    const hit = at >= 0 ? runs[at]! : null;
    if (hit?.ok) {
      const ids = [...hit.list.jobs, ...hit.list.workers].map((x) => x.id);
      similar = { ...hit.list, kind: tries[at]!.kind, saved: [...(await savedIdSet(session, kind, ids))] };
    }
  }

  // AI e'lon rasmlari (bor bo'lsa) — asosiy ro'yxat va o'xshashlar uchun bitta so'rov
  const listed = [...main.list.jobs, ...main.list.workers, ...(similar ? [...similar.jobs, ...similar.workers] : [])].map((x) => x.id);
  const [savedIds, aiImages] = await Promise.all([savedP, getListingImageUrls(kind, listed)]);
  if (!input.prefetch) void trackServer("ai_find", session?.userId ?? null, { source: "quick", mode, results: main.list.total, similar: similar?.total ?? 0, save });
  const professionLabel = node ? name(node.trail.at(-1)!) : categoryRef ? name(categoryRef) : text || (mode === "jobs" ? t("easy.quick.any_job") : t("easy.quick.any_worker"));
  return {
    ok: true,
    data: {
      ...main.list,
      aiImages,
      mode,
      summary: [
        professionLabel,
        where.label,
        salary ? t("easy.search.salary_over", { amount: formatMoneyShort(salary, locale) }) : null,
        f.pay === "daily" ? t("easy.search.daily_jobs") : null,
        f.schedule ? tEnum("work_schedule", f.schedule) : null,
        f.noexp ? t("easy.search.no_experience") : null,
        f.exp ? t("easy.search.experienced") : null,
      ].filter((x): x is string => !!x),
      saved: [...savedIds],
      save,
      similar: similar ? { ...similar, aiImages } : null,
    },
  };
}

/**
 * Hech narsa topilmadi — qidiruv saqlanadi (bepul, kuniga bir marta tekshiriladi: mos yangi e'lon bo'lsa bildirishnoma).
 * Kasb nomi (yoki matndagi kalit so'z) bilan; kuzatadigan narsa bo'lmasa yoki saqlab bo'lmasa — "xabar beramiz" deyilmaydi.
 */
async function saveSearch(session: SessionContext | null, node: NodeInfo | null, word: string | null, where: ResolvedPlace, salary: number | null, category: string | null = null): Promise<QuickSaveState> {
  if (!session) return "login";
  const q = node ? node.trail.at(-1)!.name_uz : word;
  if ((!q || q.trim().length < 2) && !category) return "unclear";
  const query = new URLSearchParams(q && q.trim().length >= 2 ? { q: q.trim().slice(0, 120) } : {});
  if (node?.categorySlug) query.set("category", node.categorySlug);
  else if (category) query.set("category", category);
  if (where.place.remote) query.set("remote", "1");
  else if (where.regionSlug) {
    query.set("region", where.regionSlug);
    if (where.place.districtId) query.set("district", where.place.districtId);
  }
  if (salary) query.set("salary_min", String(salary));
  try {
    const res = await saveJobsSearch({ query: query.toString() });
    if (res.ok) return "saved";
    return res.error === "already_saved" ? "exists" : "failed";
  } catch {
    return "failed";
  }
}
