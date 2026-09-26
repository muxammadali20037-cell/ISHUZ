"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { buildWorkersUrl, PAGE_SIZE, type WorkerSearchParams } from "../search-params";

/** Sahifalash: oldingi / raqamlar / keyingi. Havolalar URL holatini saqlaydi. */
export function Pagination({ params, total, pathname = "/workers" }: { params: WorkerSearchParams; total: number; pathname?: string }) {
  const { t } = useT();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const current = Math.min(params.page, pages);
  const href = (page: number) => buildWorkersUrl(params, { page }, pathname);

  const numbers = new Set<number>([1, pages, current, current - 1, current + 1]);
  const list = [...numbers].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return (
    <nav className="mt-5 flex items-center justify-between gap-2" aria-label={t("common.labels.page")}>
      <PageLink href={href(current - 1)} disabled={current <= 1} aria-label={t("workers.list.prev")}>
        <ChevronLeft className="size-5" />
        <span className="hidden sm:inline">{t("workers.list.prev")}</span>
      </PageLink>
      <ul className="flex items-center gap-1">
        {list.map((n, i) => {
          const prev = list[i - 1];
          const gap = prev !== undefined && n - prev > 1;
          return (
            <li key={n} className="flex items-center gap-1">
              {gap ? <span className="px-1 text-muted-foreground">…</span> : null}
              <Link
                href={href(n)}
                scroll
                aria-current={n === current ? "page" : undefined}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl text-sm font-semibold tabular transition-colors",
                  n === current ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary border border-border",
                )}
              >
                {n}
              </Link>
            </li>
          );
        })}
      </ul>
      <PageLink href={href(current + 1)} disabled={current >= pages} aria-label={t("workers.list.next")}>
        <span className="hidden sm:inline">{t("workers.list.next")}</span>
        <ChevronRight className="size-5" />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, disabled, children, ...rest }: { href: string; disabled: boolean; children: React.ReactNode; "aria-label": string }) {
  const cls = "inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold";
  if (disabled) {
    return (
      <span className={cn(cls, "opacity-40")} aria-disabled="true" {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} scroll className={cn(cls, "hover:bg-secondary")} {...rest}>
      {children}
    </Link>
  );
}
