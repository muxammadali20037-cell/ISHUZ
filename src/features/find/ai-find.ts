"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { formatMoneyShort } from "@/lib/format";
import { getDistricts, getRegions } from "@/lib/reference";
import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { trackServer } from "@/features/analytics/server";
import { aiProviderConfigured } from "@/lib/ai/json";
import { smartResolveQuery } from "./ai-search";
import { EMPTY_FIND, findHref, type FindParams } from "./params";
import { findJobs, findWorkers, getNodeInfo, type JobRow, type WorkerRow } from "./queries";

const input = z.object({
  text: z.string().trim().min(2).max(300),
  mode: z.enum(["jobs", "workers"]).nullable(),
});

const SHOW = 10;

export interface AiFindResult {
  mode: "jobs" | "workers";
  /** matndan nima tushunildi (foydalanuvchiga ko'rsatiladi) */
  understood: string[];
  /** kasb aniqlanmadi — ro'yxatdan tanlash taklif qilinadi */
  needProfession: boolean;
  /** "ai" — sun'iy intellekt tahlil qildi; "rules" — lug'at bilan tushunildi (AI kerak bo'lmadi yoki ulanmagan) */
  source: "ai" | "rules";
  aiAvailable: boolean;
  jobs: JobRow[];
  workers: WorkerRow[];
  images: Record<string, string>;
  photos: Record<string, string>;
  total: number;
  /** to'liq natijalar sahifasi (filtrlar, sahifalar) */
  href: string;
}

/**
 * "O'zingizga mosini toping" (lupa tugmasi): qisqa matn → maqsad, kasb, hudud, kunlik/oylik, maosh (lug'at, kerak bo'lsa AI) →
 * bazadagi haqiqiy e'lonlar, qidiruv sahifasidagi tartibda saralangan (ajratilgan, tuman, yangi). Natija ilova ichida ko'rsatiladi.
 */
export async function aiFind(raw: unknown): Promise<ActionResult<AiFindResult>> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  const key = session ? `ai_find:${session.userId}` : `ai_find_ip:${subjectHash("ip", ipBucket(clientIp(await headers())))}`;
  if (!(await allowRate(key, 30, 3600))) return { ok: false, error: "rate_limited" };

  const { t, name, tEnum, locale } = await getT();
  const r = await smartResolveQuery(parsed.data.text, session?.userId ?? null, parsed.data.mode);
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

  const base: Omit<AiFindResult, "needProfession" | "href"> = { mode, understood, source: r.source, aiAvailable: aiProviderConfigured(), jobs: [], workers: [], images: {}, photos: {}, total: 0 };
  // kasb aniqlanmadi (kunlik ishlar bundan mustasno) — taxminiy ro'yxat emas, aniq savol
  if (!node && params.pay !== "daily") {
    return { ok: true, data: { ...base, needProfession: true, href: findHref({ ...params, p: null, region: null, district: null }) } };
  }

  const place = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote: r.remote };
  const res = mode === "jobs" ? await findJobs(params, place) : await findWorkers(params, place);
  if (!res.ok) return { ok: false, error: "search_failed" };
  void trackServer("ai_find", session?.userId ?? null, { source: r.source, mode, results: res.total });
  return {
    ok: true,
    data: {
      ...base,
      needProfession: false,
      jobs: mode === "jobs" ? (res.items as JobRow[]).slice(0, SHOW) : [],
      workers: mode === "workers" ? (res.items as WorkerRow[]).slice(0, SHOW) : [],
      images: res.images,
      photos: "photos" in res ? (res.photos ?? {}) : {},
      total: res.total,
      href: findHref(params),
    },
  };
}
