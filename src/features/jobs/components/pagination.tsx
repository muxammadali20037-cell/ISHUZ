import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { jobsHref, type JobsSearchParams } from "../search-params";

function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const set = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => set.add(p));
  const pages = [...set].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev > 1) out.push("gap");
    out.push(p);
  }
  return out;
}

const btn = "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary";
const disabled = "pointer-events-none opacity-40";

/** Prev/Next (mobil) + sahifa raqamlari (desktop). Havolalar orqali — ulashiladigan URL. */
export async function Pagination({ params, pageCount }: { params: JobsSearchParams; pageCount: number }) {
  if (pageCount <= 1) return null;
  const { t } = await getT();
  const page = Math.min(params.page, pageCount);
  const href = (p: number) => jobsHref(params, { page: p });
  return (
    <nav className="mt-6 flex items-center justify-between gap-2" aria-label={t("common.labels.page")}>
      <Link href={href(page - 1)} className={cn(btn, page <= 1 && disabled)} aria-disabled={page <= 1} rel="prev">
        <ChevronLeft className="size-4" /> {t("jobs.pagination.prev")}
      </Link>
      <span className="text-sm text-muted-foreground tabular sm:hidden">{t("jobs.pagination.page", { page, total: pageCount })}</span>
      <ul className="hidden items-center gap-1 sm:flex">
        {pageItems(page, pageCount).map((item, i) =>
          item === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={href(item)}
                aria-current={item === page ? "page" : undefined}
                className={cn(btn, "tabular", item === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ul>
      <Link href={href(page + 1)} className={cn(btn, page >= pageCount && disabled)} aria-disabled={page >= pageCount} rel="next">
        {t("jobs.pagination.next")} <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
