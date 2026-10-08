import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatRelative, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { listReviews, parseReviewFilters, reviewStatusCounts, REVIEW_STATUSES } from "@/features/admin/queries/moderation";
import type { SearchParams } from "@/features/admin/queries/shared";
import { withParam } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterHidden, FilterSearch, FilterSelect } from "@/features/admin/components/filters";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, QueryError } from "@/features/admin/components/notes";
import { StatusBadge } from "@/features/admin/components/status-badge";
import { ReviewActions } from "@/features/admin/components/review-actions";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.reviews")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-3.5" fill={i < rating ? "currentColor" : "none"} strokeWidth={i < rating ? 0 : 1.5} />
      ))}
    </span>
  );
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale } = await getT();
  const sp = await searchParams;
  const f = parseReviewFilters(sp);
  const [paged, counts] = await Promise.all([listReviews(f), reviewStatusCounts()]);
  const canModerate = ctx.can("reviews.moderate");
  const person = (p: { id: string; first_name: string; last_name: string } | null) =>
    p ? <Link href={`/admin/users?q=${p.id}`} className="hover:underline">{fullName(p.first_name, p.last_name) || p.id.slice(0, 8)}</Link> : <span className="text-muted-foreground">—</span>;

  return (
    <div>
      <AdminPageHeader title={t("admin.reviews.title")} subtitle={t("admin.reviews.subtitle")} />
      <LinkTabs
        tabs={[
          ...REVIEW_STATUSES.map((s) => ({ href: withParam(BASE, { q: f.q }, "status", s), label: tEnum("review_status", s), count: counts[s], active: f.status === s })),
          { href: withParam(BASE, { q: f.q }, "status", "all"), label: t("admin.vacancies.all"), active: !f.status },
        ]}
      />
      <Filters action={BASE} hasActive={Boolean(f.q || f.rating)}>
        <FilterHidden name="status" value={f.status ?? "all"} />
        <FilterSearch name="q" defaultValue={f.q} placeholder={t("admin.reviews.search_placeholder")} />
        <FilterSelect name="rating" defaultValue={f.rating?.toString()} placeholder={t("admin.reviews.rating")} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` }))} className="sm:w-32" />
      </Filters>
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("admin.reviews.empty")} />}
        columns={[
          {
            key: "review",
            header: t("admin.reviews.col_review"),
            render: (r) => (
              <div className="max-w-[360px]">
                <Stars rating={r.rating} />
                <p className="mt-1 whitespace-pre-line text-sm">{r.text || <span className="text-muted-foreground">—</span>}</p>
                {r.moderation_note ? <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">{t("admin.vacancies.note")}:</span> {r.moderation_note}</p> : null}
              </div>
            ),
          },
          { key: "author", header: t("admin.reviews.col_author"), render: (r) => person(r.author) },
          { key: "target", header: t("admin.reviews.col_target"), render: (r) => person(r.target) },
          {
            key: "created",
            header: t("admin.users.col_created"),
            render: (r) => (
              <div className="text-xs">
                <p title={formatDateTime(r.created_at, locale)}>{formatRelative(r.created_at, locale)}</p>
                {r.moderator ? <p className="text-muted-foreground">{t("admin.reports.by", { name: fullName(r.moderator.first_name, r.moderator.last_name) })}</p> : null}
              </div>
            ),
          },
          { key: "status", header: t("admin.vacancies.col_status"), render: (r) => <StatusBadge status={r.status} label={tEnum("review_status", r.status)} size="sm" /> },
          { key: "actions", header: "", align: "right", render: (r) => <ReviewActions reviewId={r.id} status={r.status} canModerate={canModerate} /> },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />
    </div>
  );
}
