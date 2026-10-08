import { NextResponse, type NextRequest } from "next/server";
import { adminUiEnabled } from "@/lib/features";
import { getAdminActor } from "@/features/admin/context";
import { resolvePeriod } from "@/features/admin/period";
import { SERIES_METRICS, getStatsSeries, getStatsV2 } from "@/features/admin/queries/panel";

/** CSV hujayra: Excel formula in'ektsiyasidan himoya (=, +, -, @ bilan boshlansa — apostrof) */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Statistikani CSV ko'rinishida yuklab olish (analytics.view; bazada ham tekshiriladi) */
export async function GET(request: NextRequest) {
  if (!adminUiEnabled()) return new NextResponse("Not found", { status: 404 });
  const ctx = await getAdminActor();
  if (!ctx || !ctx.can("analytics.view")) return new NextResponse("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("period") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const kind = sp.get("kind") === "series" ? "series" : "summary";
  let body: string;
  if (kind === "series") {
    const { rows, error } = await getStatsSeries(period.from, period.to);
    if (error) return new NextResponse("Error", { status: 500 });
    body = csv([["day", ...SERIES_METRICS], ...rows.map((r) => [r.day, ...SERIES_METRICS.map((m) => r[m])])]);
  } else {
    const { stats, error } = await getStatsV2(period.from, period.to);
    if (error || !stats) return new NextResponse("Error", { status: 500 });
    const out: unknown[][] = [["section", "key", "value", "extra"]];
    const flat = (prefix: string, o: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v)) continue;
        if (v && typeof v === "object") flat(`${prefix}${k}.`, v as Record<string, unknown>);
        else out.push(["metric", `${prefix}${k}`, v, ""]);
      }
    };
    flat("", stats as unknown as Record<string, unknown>);
    for (const r of stats.top_professions) out.push(["top_profession", r.name_uz, r.searches, `zero=${r.zero}`]);
    for (const r of stats.zero_queries) out.push(["zero_query", r.query, r.n, ""]);
    for (const r of stats.regions) out.push(["region", r.name_uz, r.demand, `vacancies=${r.vacancies};workers=${r.workers}`]);
    body = csv(out);
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ishtopdim-${kind}-${period.fromDay}_${period.toDay}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
