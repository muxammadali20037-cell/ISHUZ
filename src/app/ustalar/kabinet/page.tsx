import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Inbox, Pencil, PhoneCall, Plus, Star } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatPhone, formatRelative } from "@/lib/format";
import { requireSession } from "@/features/auth/session";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { CategoryIcon } from "@/features/masters/components/category-icon";
import {
  ListingActions,
  RequestStatusButtons,
} from "@/features/masters/components/cabinet-client";
import {
  getMasterCategories,
  getMyMasterListings,
  getMyMasterRequests,
} from "@/features/masters/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MasterListingStatus } from "@/features/masters/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: `${t("masters.cab.title")} · ${t("masters.name")}`,
    robots: { index: false },
  };
}

const TONE: Record<MasterListingStatus, string> = {
  active: "bg-success-soft text-success",
  pending_review: "bg-warning-soft text-warning",
  rejected: "bg-destructive-soft text-destructive",
  hidden: "bg-secondary text-muted-foreground",
  draft: "bg-secondary text-muted-foreground",
};

/**
 * /ustalar/kabinet — usta kabineti: e'lonlar (holat, rad sababi, ko'rishlar, telefon bosishlar, so'rovlar, reyting — hammasi
 * bazadagi hisoblagichlar), amallar (tahrirlash, yashirish/qaytarish, yuborish, o'chirish) va mijoz so'rovlari.
 */
export default async function MasterCabinetPage() {
  const session = await requireSession("/ustalar/kabinet");
  const [{ t, name, locale }, listings, requests, categories] =
    await Promise.all([
      getT(),
      getMyMasterListings(session.userId),
      getMyMasterRequests(session.userId),
      getMasterCategories(),
    ]);
  const reqCount = (id: string) =>
    requests.filter((r) => r.listing_id === id).length;

  return (
    <MastersShell search={false}>
      <div className="container-app space-y-6 py-5 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t("masters.cab.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("masters.cab.intro")}
            </p>
          </div>
          <Button asChild size="lg" className="text-base">
            <Link href="/ustalar/elon">
              <Plus className="size-5" aria-hidden /> {t("masters.post")}
            </Link>
          </Button>
        </div>

        {listings.length ? (
          <ul className="grid gap-3 lg:grid-cols-2" data-masters-my-listings>
            {listings.map((l) => {
              const c = categories.find((x) => x.id === l.category_id);
              return (
                <li
                  key={l.id}
                  className="space-y-3 rounded-2xl border border-border bg-card p-4"
                  data-status={l.status}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm text-primary-ink">
                        {c ? (
                          <CategoryIcon icon={c.icon} className="size-4" />
                        ) : null}{" "}
                        {c ? name(c) : ""}
                      </p>
                      <h2 className="mt-0.5 text-lg font-bold leading-snug">
                        {l.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {formatRelative(l.updated_at, locale)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                        TONE[l.status],
                      )}
                      data-masters-status
                    >
                      {t(`masters.status.${l.status}`)}
                    </span>
                  </div>
                  {l.status === "rejected" && l.reject_reason ? (
                    <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive">
                      {t("masters.cab.reject_reason", {
                        reason: l.reject_reason,
                      })}{" "}
                      {t("masters.cab.reject_hint")}
                    </p>
                  ) : null}
                  <dl className="grid grid-cols-4 gap-2 text-center">
                    {[
                      [Eye, t("masters.cab.views"), l.views_count],
                      [
                        PhoneCall,
                        t("masters.cab.phone_clicks"),
                        l.phone_clicks_count,
                      ],
                      [Inbox, t("masters.cab.requests"), reqCount(l.id)],
                      [
                        Star,
                        t("masters.cab.rating"),
                        l.rating_count
                          ? `${Number(l.rating_avg).toFixed(1)} (${l.rating_count})`
                          : "—",
                      ],
                    ].map(([Icon, label, value]) => {
                      const I = Icon as typeof Eye;
                      return (
                        <div
                          key={String(label)}
                          className="rounded-xl bg-secondary px-1 py-2"
                        >
                          <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <I className="size-3.5" aria-hidden />{" "}
                            <span className="truncate">{String(label)}</span>
                          </dt>
                          <dd className="text-base font-bold">
                            {String(value)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/ustalar/elon/${l.id}`}
                      className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/50"
                    >
                      <Pencil className="size-4" aria-hidden />{" "}
                      {t("masters.cab.edit")}
                    </Link>
                    {l.status === "active" ? (
                      <Link
                        href={`/ustalar/${l.slug}`}
                        className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/50"
                      >
                        <Eye className="size-4" aria-hidden />{" "}
                        {t("masters.card.open")}
                      </Link>
                    ) : null}
                    <ListingActions id={l.id} status={l.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-lg font-bold">{t("masters.cab.empty_title")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("masters.cab.empty_desc")}
            </p>
          </div>
        )}

        <section aria-labelledby="m-requests" data-masters-requests>
          <h2 id="m-requests" className="text-xl font-bold">
            {t("masters.cab.requests_title")}
          </h2>
          {requests.length ? (
            <ul className="mt-3 space-y-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold">
                      {t("masters.cab.from", {
                        name: r.client_name,
                        phone: formatPhone(r.client_phone),
                      })}{" "}
                      <span
                        className={cn(
                          "ml-1 rounded-full px-2 py-0.5 text-xs font-bold",
                          r.status === "new"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {t(`masters.cab.request_${r.status}`)}
                      </span>
                    </p>
                    {r.listing ? (
                      <p className="text-sm text-muted-foreground">
                        {t("masters.cab.listing_of", {
                          title: r.listing.title,
                        })}
                      </p>
                    ) : null}
                    {r.message ? (
                      <p className="mt-1 whitespace-pre-wrap text-base">
                        {r.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelative(r.created_at, locale)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <a
                      href={`tel:${r.client_phone}`}
                      className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
                    >
                      <PhoneCall className="size-4" aria-hidden />{" "}
                      {t("masters.card.call")}
                    </a>
                    <RequestStatusButtons id={r.id} status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">
              {t("masters.cab.requests_empty")}
            </p>
          )}
        </section>
      </div>
    </MastersShell>
  );
}
