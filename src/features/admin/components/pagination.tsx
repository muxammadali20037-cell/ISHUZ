import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { Paged } from "../queries/shared";

function hrefWithPage(base: string, sp: Record<string, string | string[] | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page" || v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else if (v !== "") params.set(k, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Sahifalash: "1–50 / 1 234" + oldingi/keyingi (GET havolalar) */
export async function Pagination({ paged, base, searchParams }: { paged: Pick<Paged<unknown>, "page" | "pageCount" | "pageSize" | "total">; base: string; searchParams: Record<string, string | string[] | undefined> }) {
  const { t } = await getT();
  if (paged.total === 0) return null;
  const from = (paged.page - 1) * paged.pageSize + 1;
  const to = Math.min(paged.total, paged.page * paged.pageSize);
  const prev = paged.page > 1 ? hrefWithPage(base, searchParams, paged.page - 1) : null;
  const next = paged.page < paged.pageCount ? hrefWithPage(base, searchParams, paged.page + 1) : null;
  const btn = "flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-secondary";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="tabular">{t("admin.table.range", { from, to, total: paged.total })}</span>
      <div className="flex items-center gap-2">
        <span className="tabular">
          {t("common.labels.page")} {paged.page} {t("common.labels.of")} {paged.pageCount}
        </span>
        {prev ? (
          <Link href={prev} className={btn} aria-label={t("common.actions.back")}>
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")}>
            <ChevronLeft className="size-4" />
          </span>
        )}
        {next ? (
          <Link href={next} className={btn} aria-label={t("common.actions.next")}>
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")}>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
