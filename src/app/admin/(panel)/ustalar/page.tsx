import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { formatPhone, formatRelative } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader } from "@/features/admin/components/notes";
import {
  DemoControls,
  ModerateButtons,
} from "@/features/masters/components/admin-client";
import {
  getMasterAdminStats,
  getMasterCategories,
  getMasterModerationQueue,
} from "@/features/masters/queries";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.masters")} · ${t("admin.shell.title")}` };
}

/**
 * /admin/ustalar — "Universal ustalar" moderatsiyasi: navbatdagi e'lonlar (to'liq matn, telefon va rozilik holati), tasdiqlash yoki
 * sabab bilan rad etish; demo e'lonlarni bir bosishda olib tashlash/qaytarish. Huquq: vacancies.moderate.
 */
export default async function AdminMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx.can("vacancies.moderate")) notFound();
  const [{ t, name, locale }, sp, categories, stats] = await Promise.all([
    getT(),
    searchParams,
    getMasterCategories(),
    getMasterAdminStats(),
  ]);
  const all = sp.all === "1";
  // kategoriyalar bo'sh = 0076 hali bazada yo'q (yoki baza javob bermadi): nollar va ishlamaydigan tugma o'rniga halol izoh
  const ready = categories.length > 0;
  const queue = await getMasterModerationQueue(all);
  const tab = (on: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold",
      on
        ? "bg-primary-soft text-primary-ink"
        : "text-muted-foreground hover:bg-secondary",
    );

  return (
    <div className="space-y-5" data-admin-masters>
      <AdminPageHeader
        title={t("masters.admin.title")}
        subtitle={t("masters.admin.stats", stats)}
      />

      {ready ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold">
            {t("masters.admin.demo_title")}
          </h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            {t("masters.admin.demo_desc", { count: stats.demo })}
          </p>
          <DemoControls count={stats.demo} />
        </section>
      ) : (
        <p
          role="status"
          data-masters-not-ready
          className="rounded-2xl border border-border bg-secondary p-4 text-sm font-semibold"
        >
          {t("masters.admin.not_ready")}
        </p>
      )}

      <nav className="flex gap-1" aria-label={t("masters.admin.title")}>
        <Link
          href="/admin/ustalar"
          className={tab(!all)}
          aria-current={!all ? "page" : undefined}
        >
          {t("masters.admin.pending")} ({stats.pending})
        </Link>
        <Link
          href="/admin/ustalar?all=1"
          className={tab(all)}
          aria-current={all ? "page" : undefined}
        >
          {t("masters.admin.all")}
        </Link>
      </nav>

      {queue.length ? (
        <ul className="space-y-3">
          {queue.map((l) => {
            const c = categories.find((x) => x.id === l.category_id);
            return (
              <li
                key={l.id}
                className="space-y-2 rounded-2xl border border-border bg-card p-4"
                data-masters-queue-item
                data-status={l.status}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {c ? name(c) : ""} · {t(`masters.status.${l.status}`)} ·{" "}
                      {formatRelative(l.created_at, locale)}
                    </p>
                    <h2 className="text-lg font-bold">{l.title}</h2>
                    <p className="text-sm">
                      {l.display_name} · {t("masters.admin.owner")}:{" "}
                      {[l.owner?.first_name, l.owner?.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {l.phone ? formatPhone(l.phone) : "—"} ·{" "}
                      {l.phone_public
                        ? t("masters.admin.phone_public_yes")
                        : t("masters.admin.phone_public_no")}
                    </p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-base">{l.description}</p>
                {l.services.length ? (
                  <p className="text-sm text-muted-foreground">
                    {l.services.join(" · ")}
                  </p>
                ) : null}
                {l.reject_reason ? (
                  <p className="text-sm text-destructive">
                    {t("masters.cab.reject_reason", {
                      reason: l.reject_reason,
                    })}
                  </p>
                ) : null}
                {l.status === "pending_review" ||
                l.status === "active" ||
                l.status === "hidden" ? (
                  <ModerateButtons id={l.id} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
          {t("masters.admin.empty")}
        </p>
      )}
    </div>
  );
}
