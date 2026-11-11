import "server-only";

import { getT } from "@/lib/i18n/server";
import { formatMoneyShort } from "@/lib/format";
import { getDistricts, getRegions } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { savedIdSet } from "@/features/saved/queries";
import { trackServer } from "@/features/analytics/server";
import { aiProviderConfigured } from "@/lib/ai/json";
import { smartResolveQuery } from "./ai-search";
import type { AppliedFilters } from "./ai-chat-model";
import { EMPTY_FIND, findHref, type FindParams } from "./params";
import { findJobs, findJobsByText, findWorkers, getNodeInfo } from "./queries";
import { textKeywords } from "./ai-keywords";
import type { JobCardData } from "./components/result-cards";
import type { WorkerRow } from "./queries";
import type { AiFindResult } from "./ai-find-types";

const SHOW = 10;

export type AiFindOutcome = { ok: true; data: AiFindResult } | { ok: false; error: "search_failed" };

/**
 * Matn → bazadagi haqiqiy e'lonlar (AI qidiruvning yadrosi): lug'at (kerak bo'lsa AI) bilan tushunish → qidiruv → bo'sh chiqsa
 * birma-bir kengaytirish → kasb aniqlanmasa e'lon matnlaridan qidirish. Hech narsa o'ylab topilmaydi.
 * Chaqiruvchilar: `aiFind` server amali (bir martalik qidiruv) va AI yordamchi (suhbat, src/features/assistant) — yordamchi
 * so'rovni o'zi tozalab beradi, shuning uchun `ai: false` (ikkinchi AI chaqiruvi kerak emas).
 * Limit va kirish tekshiruvi — chaqiruvchida.
 */
export async function runAiFind(input: { text: string; mode: "jobs" | "workers" | null; session: SessionContext | null; ai?: boolean }): Promise<AiFindOutcome> {
  const { session } = input;
  const parsed = { data: { text: input.text, mode: input.mode } };
  const { t, name, tEnum, locale } = await getT();
  const r = await smartResolveQuery(parsed.data.text, session?.userId ?? null, parsed.data.mode, { ai: input.ai !== false });
  const mode = parsed.data.mode ?? r.mode ?? "jobs";
  const regions = await getRegions();
  const region = r.regionSlug ? (regions.find((x) => x.slug === r.regionSlug) ?? null) : null;
  const district = region && r.districtId ? ((await getDistricts(region.id)).find((d) => d.id === r.districtId) ?? null) : null;
  const params: FindParams = {
    ...EMPTY_FIND,
    mode,
    p: r.nodeId,
    region: r.remote ? "remote" : (region?.slug ?? "all"),
    district: district?.id ?? (region ? "all" : null),
    salary: r.salary,
    schedule: r.schedule,
    noexp: r.noexp,
    exp: r.exp,
    pay: mode === "jobs" ? r.pay : null,
  };

  const node = r.nodeId ? await getNodeInfo(r.nodeId) : null;
  const understood = [
    mode === "workers" ? t("easy.search.summary_workers") : t("easy.search.summary_jobs"),
    node ? name(node.trail.at(-1)!) : null,
    r.remote ? t("easy.location.remote") : region ? [name(region), district ? name(district) : null].filter(Boolean).join(", ") : null,
    params.pay === "daily" ? t("easy.search.daily_jobs") : null,
    mode === "jobs" && params.salary ? t("easy.search.salary_over", { amount: formatMoneyShort(params.salary, locale) }) : null,
    mode === "jobs" && params.schedule ? tEnum("work_schedule", params.schedule) : null,
    params.noexp ? t("easy.search.no_experience") : null,
    params.exp ? t("easy.search.experienced") : null,
  ].filter((x): x is string => !!x);

  const applied: AppliedFilters = { daily: params.pay === "daily", noexp: params.noexp, exp: params.exp, remote: r.remote, shift: params.schedule === "shift" };
  const alertHref = `/ai-alerts?${new URLSearchParams({ role: mode === "workers" ? "employer" : "worker", q: parsed.data.text })}`;
  const postHref = mode === "workers" ? "/post/vacancy" : "/post/worker";
  const baseCommon = { mode, understood, source: r.source, aiAvailable: aiProviderConfigured(), applied, alertHref, postHref };
  // kasb aniqlanmadi (kunlik ishlar bundan mustasno). Boshqa shart tushunilgan bo'lsa (hudud, maosh, grafik, tajriba, masofaviy) —
  // shu shartlar bilan barcha kasblar bo'yicha qidiriladi; hech narsa tushunilmagan bo'lsa (masalan "qwerty") — aniq savol
  const needProfession = !node && params.pay !== "daily";
  const hasOther = !!(region || r.remote || params.salary || params.schedule || params.noexp || params.exp);
  const base = { ...baseCommon, flags: { profession: !!node, filters: hasOther || params.pay === "daily" } };

  // Kasblar ro'yxatida yo'q so'z (kompaniya nomi, erkin lavozim: "korzinkaga ishga kirmoqchiman") — "tushunmadim" deb to'xtamaymiz:
  // matndagi kalit so'zlar bo'yicha e'lonlarning sarlavhasi, tavsifi va kompaniya nomidan qidiramiz — avval tushunilgan hududda,
  // bo'lmasa butun O'zbekistonda. Topilgani haqiqiy e'lonlar; qaysi so'z bo'yicha topilgani ochiq aytiladi.
  if (needProfession && mode === "jobs") {
    const names = [region?.name_uz, region?.name_ru, region?.name_en, district?.name_uz, district?.name_ru].filter((x): x is string => !!x);
    const words = textKeywords(parsed.data.text, names);
    const scopes = [
      { place: { regionId: region?.id ?? null, districtId: district?.id ?? null, remote: r.remote }, where: { region: params.region, district: params.district }, widened: false },
      ...(region && !r.remote ? [{ place: { regionId: null, districtId: null, remote: false }, where: { region: "all", district: null }, widened: true }] : []),
    ];
    for (const scope of words.length ? scopes : []) {
      const tries = await Promise.all(words.map((w) => findJobsByText({ ...params, p: null, q: w, page: 1 }, scope.place, SHOW)));
      const i = tries.findIndex((x) => x.ok && x.items.length > 0);
      const hit = tries[i];
      if (!hit?.ok) continue; // topilmadi yoki texnik xato — keyingi yo'l (xato "yo'q" deb ko'rsatilmaydi: pastda oddiy qidiruv bor)
      const word = words[i]!;
      const shown = hit.items.slice(0, SHOW);
      const saved = await savedIdSet(session, "vacancy", shown.map((x) => x.id));
      void trackServer("ai_find", session?.userId ?? null, { source: r.source, mode, results: hit.total, relaxed: scope.widened ? 2 : 1, text: true });
      return {
        ok: true,
        data: {
          ...base,
          understood: [...understood, `«${word}»`],
          flags: { profession: true, filters: base.flags.filters },
          needProfession: false,
          relaxed: [t("easy.finder.relaxed_text", { word }), ...(scope.widened && region ? [t("easy.finder.relaxed_region", { region: name(region) })] : [])],
          jobs: shown,
          workers: [],
          saved: [...saved],
          images: hit.images,
          photos: hit.photos ?? {},
          total: hit.total,
          href: findHref({ ...params, p: null, q: word, ...scope.where }),
        },
      };
    }
  }

  if (needProfession && !hasOther) {
    return { ok: true, data: { ...base, needProfession: true, relaxed: [], jobs: [], workers: [], images: {}, photos: {}, saved: [], total: 0, href: findHref({ ...params, p: null, region: null, district: null }) } };
  }

  const run = (p: FindParams, pl: Parameters<typeof findJobs>[1]) => (mode === "jobs" ? findJobs(p, pl) : findWorkers(p, pl));
  let cur: FindParams = needProfession ? { ...params, p: null } : params;
  let place = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote: r.remote };
  let res = await run(cur, place);
  if (!res.ok) return { ok: false, error: "search_failed" };

  // Bo'sh chiqsa — "yo'q" deb to'xtamaymiz: shartlarni birma-bir kengaytiramiz va buni ochiq aytamiz (hech narsa o'ylab topilmaydi)
  const relaxed: string[] = [];
  const steps: { applies: () => boolean; apply: () => void; note: () => string }[] = [
    {
      applies: () => !!place.districtId && !!region,
      apply: () => {
        cur = { ...cur, district: "all" };
        place = { ...place, districtId: null };
      },
      note: () => t("easy.finder.relaxed_district", { district: district ? name(district) : "", region: region ? name(region) : "" }),
    },
    {
      applies: () => !!place.regionId && !place.remote,
      apply: () => {
        cur = { ...cur, region: "all", district: null };
        place = { ...place, regionId: null, districtId: null };
      },
      note: () => t("easy.finder.relaxed_region", { region: region ? name(region) : "" }),
    },
    {
      applies: () => !!(cur.salary || cur.schedule || cur.noexp || cur.exp || cur.pay),
      apply: () => {
        cur = { ...cur, salary: null, schedule: null, noexp: false, exp: false, pay: null };
      },
      note: () => t("easy.finder.relaxed_filters"),
    },
    {
      applies: () => !!node && node.trail.length > 1 && cur.p === node.id,
      apply: () => {
        cur = { ...cur, p: node!.trail.at(-2)!.id };
      },
      note: () => t("easy.finder.relaxed_parent", { from: name(node!.trail.at(-1)!), to: name(node!.trail.at(-2)!) }),
    },
  ];
  for (const step of steps) {
    if (res.total > 0) break;
    if (!step.applies()) continue;
    step.apply();
    const next = await run(cur, place);
    if (!next.ok) return { ok: false, error: "search_failed" };
    res = next;
    relaxed.push(step.note());
  }
  if (res.total > 0 && needProfession) relaxed.unshift(t("easy.finder.relaxed_profession"));

  void trackServer("ai_find", session?.userId ?? null, { source: r.source, mode, results: res.total, relaxed: relaxed.length });
  const shown = res.items.slice(0, SHOW);
  const saved = await savedIdSet(session, mode === "jobs" ? "vacancy" : "worker", shown.map((i) => i.id));
  return {
    ok: true,
    data: {
      ...base,
      needProfession: needProfession && res.total === 0,
      relaxed: res.total > 0 ? relaxed : [],
      jobs: mode === "jobs" ? (shown as JobCardData[]) : [],
      workers: mode === "workers" ? (shown as WorkerRow[]) : [],
      saved: [...saved],
      images: res.images,
      photos: "photos" in res ? (res.photos ?? {}) : {},
      total: res.total,
      href: findHref(needProfession && res.total === 0 ? { ...params, p: null, region: null, district: null } : cur),
    },
  };
}
